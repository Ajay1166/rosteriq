import calendar
import json
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from collections import defaultdict

from app.database import get_db
from app.models.entities import (
    Roster, RosterAssignment, SchedulingConflict, RosterVersion,
    Employee, Brand, Process, Pod, AuditLog
)
from app.schemas.schemas import (
    RosterGenerateRequest, RosterOut, RosterAssignmentOut,
    RosterAssignmentUpdate, SchedulingConflictOut, AuditLogOut, RosterVersionOut
)
from app.scheduler.engine import RosterSchedulerEngine
from app.scheduler.validator import RosterValidator

router = APIRouter(prefix="/rosters", tags=["Rosters"])

@router.post("/generate", response_model=RosterOut)
def generate_roster(payload: RosterGenerateRequest, db: Session = Depends(get_db)):
    """Runs the deterministic scheduling engine and independent validator."""
    engine = RosterSchedulerEngine(db)
    roster = engine.generate_roster(
        month=payload.month,
        year=payload.year,
        pod_id=payload.pod_id,
        brand_id=payload.brand_id,
        generated_by=payload.generated_by
    )

    # Return with computed fields
    out = _enrich_roster_out(roster, db)
    return out

@router.get("", response_model=List[RosterOut])
def get_rosters(month: Optional[int] = None, year: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Roster)
    if month:
        query = query.filter(Roster.month == month)
    if year:
        query = query.filter(Roster.year == year)
    
    rosters = query.order_by(Roster.year.desc(), Roster.month.desc(), Roster.version.desc()).all()
    return [_enrich_roster_out(r, db) for r in rosters]

@router.get("/{id}", response_model=RosterOut)
def get_roster(id: int, db: Session = Depends(get_db)):
    roster = db.query(Roster).filter(Roster.id == id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")
    return _enrich_roster_out(roster, db)

@router.get("/{id}/grid")
def get_roster_grid(
    id: int,
    view: str = Query("company", description="company, pod, brand, process, employee"),
    pod_id: Optional[int] = None,
    brand_id: Optional[int] = None,
    process_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Returns matrix data suitable for the high-density calendar grid.
    Rows: Employees (with metadata: pod, brands, processes)
    Columns: Days in the month (1..N)
    """
    roster = db.query(Roster).filter(Roster.id == id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")

    num_days = calendar.monthrange(roster.year, roster.month)[1]
    dates = [date(roster.year, roster.month, day) for day in range(1, num_days + 1)]

    # Filter employees
    emp_query = db.query(Employee).filter(Employee.status == "Active")
    if pod_id:
        emp_query = emp_query.filter(Employee.pod_id == pod_id)
    if employee_id:
        emp_query = emp_query.filter(Employee.id == employee_id)
    
    employees = emp_query.order_by(Employee.employee_id.asc()).all()

    # Filter assignments for this roster
    assign_query = db.query(RosterAssignment).filter(RosterAssignment.roster_id == id)
    if brand_id:
        assign_query = assign_query.filter(RosterAssignment.brand_id == brand_id)
    if process_id:
        assign_query = assign_query.filter(RosterAssignment.process_id == process_id)
    
    assignments = assign_query.all()

    # Map: (employee_id, date_str) -> RosterAssignment
    grid_map: Dict[Tuple[int, str], RosterAssignment] = {}
    for ra in assignments:
        grid_map[(ra.employee_id, ra.date.isoformat())] = ra

    rows = []
    for emp in employees:
        brand_names = list({ea.brand.name for ea in emp.assignments if ea.brand and ea.active})
        proc_names = list({ea.process.name for ea in emp.assignments if ea.process and ea.active})
        
        daily_cells = []
        working_count = 0
        off_count = 0
        leave_count = 0

        for d in dates:
            d_str = d.isoformat()
            ra = grid_map.get((emp.id, d_str))
            cell_data = {
                "date": d_str,
                "day_number": d.day,
                "weekday": d.strftime("%a"),
                "is_weekend": d.weekday() in [5, 6],
                "assignment_id": ra.id if ra else None,
                "work_status": ra.work_status if ra else "Weekly Off",
                "brand_id": ra.brand_id if ra else None,
                "brand_name": ra.brand.name if (ra and ra.brand) else None,
                "process_id": ra.process_id if ra else None,
                "process_name": ra.process.name if (ra and ra.process) else None,
                "shift_start": ra.shift_start if ra else "00:00",
                "shift_end": ra.shift_end if ra else "00:00",
                "assignment_source": ra.assignment_source if ra else "automatic",
                "notes": ra.notes if ra else None
            }
            daily_cells.append(cell_data)

            stat = cell_data["work_status"]
            if stat == "Working":
                working_count += 1
            elif stat == "Weekly Off":
                off_count += 1
            elif stat in ["Leave", "Comp-Off", "Unavailable"]:
                leave_count += 1

        rows.append({
            "employee_id": emp.id,
            "emp_code": emp.employee_id,
            "full_name": emp.full_name,
            "designation": emp.designation,
            "pod_id": emp.pod_id,
            "pod_name": emp.pod.pod_name if emp.pod else "General",
            "assigned_brands": brand_names,
            "assigned_processes": proc_names,
            "stats": {
                "working_days": working_count,
                "weekly_offs": off_count,
                "leaves": leave_count
            },
            "days": daily_cells
        })

    return {
        "roster_id": roster.id,
        "month": roster.month,
        "year": roster.year,
        "days_in_month": num_days,
        "status": roster.status,
        "validation_status": roster.validation_status,
        "rows": rows
    }

@router.put("/{id}/assignments/{assignment_id}")
def update_roster_assignment(
    id: int,
    assignment_id: int,
    payload: RosterAssignmentUpdate,
    db: Session = Depends(get_db)
):
    """
    Manual editing of a roster cell.
    Validates eligibility and triggers independent re-validation.
    Preserves audit history.
    """
    ra = db.query(RosterAssignment).filter(
        RosterAssignment.id == assignment_id,
        RosterAssignment.roster_id == id
    ).first()
    if not ra:
        raise HTTPException(status_code=404, detail="Roster assignment not found")

    prev_val = f"{ra.work_status} | Brand #{ra.brand_id} | Proc #{ra.process_id}"

    # Update fields
    if payload.work_status is not None:
        ra.work_status = payload.work_status
    if payload.brand_id is not None:
        ra.brand_id = payload.brand_id
    if payload.process_id is not None:
        ra.process_id = payload.process_id
    if payload.shift_start is not None:
        ra.shift_start = payload.shift_start
    if payload.shift_end is not None:
        ra.shift_end = payload.shift_end
    if payload.notes is not None:
        ra.notes = payload.notes
    
    ra.assignment_source = "manual"
    db.commit()

    # Audit log
    new_val = f"{ra.work_status} | Brand #{ra.brand_id} | Proc #{ra.process_id}"
    audit = AuditLog(
        roster_id=id,
        employee_id=ra.employee_id,
        action="MANUAL_ASSIGNMENT_EDIT",
        previous_value=prev_val,
        new_value=new_val,
        modified_by=payload.modified_by,
        reason=f"Cell edited on {ra.date.isoformat()}"
    )
    db.add(audit)
    db.commit()

    # Re-run validation
    validator = RosterValidator(db)
    val_result = validator.validate_roster(id)

    return {
        "success": True,
        "assignment_id": ra.id,
        "new_status": ra.work_status,
        "validation": val_result
    }

@router.post("/{id}/validate")
def validate_roster(id: int, db: Session = Depends(get_db)):
    """Runs the independent validation engine on demand."""
    validator = RosterValidator(db)
    result = validator.validate_roster(id)
    return result

@router.post("/{id}/clear-conflicts")
def clear_roster_conflicts(id: int, db: Session = Depends(get_db)):
    """
    Clears all un-resolved validation conflict records for this roster.
    Preserves all employee, brand, process, assignment, leave, and holiday data.
    """
    roster = db.query(Roster).filter(Roster.id == id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")

    deleted_count = db.query(SchedulingConflict).filter(
        SchedulingConflict.roster_id == id,
        SchedulingConflict.resolved == False
    ).delete()

    roster.validation_status = "Pending"
    if roster.status != "Published":
        roster.status = "Draft"

    db.add(AuditLog(
        roster_id=id,
        action="CLEAR_VALIDATION_RESULTS",
        new_value=f"Cleared {deleted_count} stale conflict records",
        modified_by="Operations Lead",
        reason="Manual clearing of validation results"
    ))
    db.commit()
    db.refresh(roster)
    return {
        "success": True,
        "message": f"Successfully cleared {deleted_count} conflict records.",
        "roster": _enrich_roster_out(roster, db)
    }

@router.post("/{id}/reset-draft")
def reset_draft_roster(id: int, db: Session = Depends(get_db)):
    """
    Resets the draft roster assignments and conflicts.
    Rejects resetting a published roster to preserve audit history and immutability.
    """
    roster = db.query(Roster).filter(Roster.id == id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")

    if roster.status == "Published":
        raise HTTPException(
            status_code=400,
            detail="Cannot reset a published roster. Published rosters are immutable operational records."
        )

    del_assignments = db.query(RosterAssignment).filter(RosterAssignment.roster_id == id).delete()
    del_conflicts = db.query(SchedulingConflict).filter(SchedulingConflict.roster_id == id).delete()

    roster.status = "Draft"
    roster.validation_status = "Pending"

    db.add(AuditLog(
        roster_id=id,
        action="RESET_DRAFT_ROSTER",
        new_value=f"Removed {del_assignments} assignments and {del_conflicts} conflicts",
        modified_by="Operations Lead",
        reason="Reset draft to empty baseline"
    ))
    db.commit()
    db.refresh(roster)
    return {
        "success": True,
        "message": "Draft roster successfully reset.",
        "roster": _enrich_roster_out(roster, db)
    }

@router.post("/{id}/regenerate")
def regenerate_roster(id: int, generated_by: str = "Operations Lead", db: Session = Depends(get_db)):
    """
    Regenerates assignments for this draft roster and re-validates.
    Rejects regenerating a published roster.
    """
    roster = db.query(Roster).filter(Roster.id == id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")

    if roster.status == "Published":
        raise HTTPException(
            status_code=400,
            detail="Cannot regenerate a published roster. Please generate a new draft version instead."
        )

    engine = RosterSchedulerEngine(db)
    engine.regenerate_roster(roster, generated_by=generated_by)

    db.add(AuditLog(
        roster_id=id,
        action="REGENERATE_DRAFT",
        new_value=f"Regenerated roster assignments for month {roster.month}/{roster.year}",
        modified_by=generated_by,
        reason="Manual draft regeneration"
    ))
    db.commit()
    db.refresh(roster)
    return {
        "success": True,
        "message": "Draft roster regenerated and validated.",
        "roster": _enrich_roster_out(roster, db)
    }

@router.post("/{id}/publish")
def publish_roster(id: int, published_by: str = "Operations Lead", db: Session = Depends(get_db)):
    """
    Publishes the roster.
    Enforces Rule: A roster with critical unresolved conflicts CANNOT be published.
    Creates an immutable RosterVersion snapshot to preserve history.
    """
    roster = db.query(Roster).filter(Roster.id == id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")

    # Re-validate first to ensure no hidden conflicts
    validator = RosterValidator(db)
    val_result = validator.validate_roster(id)

    if val_result["critical_conflicts"] > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Publication rejected: Roster has {val_result['critical_conflicts']} critical unresolved conflict(s). Resolve all critical gaps before publishing."
        )

    roster.status = "Published"
    roster.validation_status = "Valid"
    roster.published_date = datetime.utcnow()
    roster.published_by = published_by

    # Create immutable version snapshot
    assignments = db.query(RosterAssignment).filter(RosterAssignment.roster_id == id).all()
    snap_list = [
        {
            "id": a.id, "employee_id": a.employee_id, "date": a.date.isoformat(),
            "brand_id": a.brand_id, "process_id": a.process_id, "work_status": a.work_status,
            "shift_start": a.shift_start, "shift_end": a.shift_end, "notes": a.notes
        }
        for a in assignments
    ]
    rv = RosterVersion(
        roster_id=id,
        version=roster.version,
        snapshot_data=json.dumps(snap_list),
        created_at=datetime.utcnow(),
        created_by=published_by,
        notes=f"Published snapshot with {val_result['coverage_percentage']}% coverage ({val_result['warnings_count']} warnings)"
    )
    db.add(rv)

    # Audit log
    audit = AuditLog(
        roster_id=id,
        action="ROSTER_PUBLISHED",
        new_value=f"Published Version {roster.version} with {val_result['coverage_percentage']}% coverage",
        modified_by=published_by,
        reason="Approved by operations lead"
    )
    db.add(audit)
    db.commit()
    db.refresh(roster)

    return _enrich_roster_out(roster, db)

@router.get("/{id}/coverage")
def get_roster_coverage(id: int, db: Session = Depends(get_db)):
    """
    Returns brand-wise and process-wise coverage breakdown.
    Identifies operating dates, covered slots, and gaps.
    """
    roster = db.query(Roster).filter(Roster.id == id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")

    # Fetch conflicts
    conflicts = db.query(SchedulingConflict).filter(SchedulingConflict.roster_id == id).all()
    critical_by_brand_proc = defaultdict(list)
    for c in conflicts:
        if c.severity == "CRITICAL" and c.brand_id and c.process_id:
            critical_by_brand_proc[(c.brand_id, c.process_id)].append({
                "date": c.date.isoformat(),
                "required": c.expected_staffing,
                "actual": c.actual_staffing,
                "explanation": c.explanation
            })

    brands = db.query(Brand).filter(Brand.status == "Active").all()
    processes = db.query(Process).filter(Process.status == "Active").all()

    brand_coverage_list = []
    for b in brands:
        proc_stats = []
        brand_total_req = 0
        brand_covered = 0

        for p in processes:
            # Check operating rule
            from app.models.entities import OperatingRule
            rule = db.query(OperatingRule).filter(
                OperatingRule.brand_id == b.id,
                OperatingRule.process_id == p.id
            ).first()

            if not rule:
                continue

            gaps = critical_by_brand_proc.get((b.id, p.id), [])
            # Approx 30 days
            operating_days = 30 if rule.operating_mode in ["365_DAYS", "DAILY_EXCEPT_HOLIDAYS"] else 26
            req_slots = operating_days * rule.min_required_employees
            brand_total_req += req_slots
            covered_slots = max(0, req_slots - len(gaps))
            brand_covered += covered_slots

            pct = round((covered_slots / req_slots * 100), 1) if req_slots > 0 else 100.0

            proc_stats.append({
                "process_id": p.id,
                "process_name": p.name,
                "operating_mode": rule.operating_mode,
                "required_per_day": rule.min_required_employees,
                "total_required_slots": req_slots,
                "covered_slots": covered_slots,
                "coverage_pct": pct,
                "status": "Fully Covered" if len(gaps) == 0 else f"{len(gaps)} Coverage Gaps",
                "gaps": gaps
            })

        overall_b_pct = round((brand_covered / brand_total_req * 100), 1) if brand_total_req > 0 else 100.0

        brand_coverage_list.append({
            "brand_id": b.id,
            "brand_name": b.name,
            "brand_code": b.code,
            "pod_name": b.assigned_pod.pod_name if b.assigned_pod else "General",
            "coverage_percentage": overall_b_pct,
            "status": "Covered" if overall_b_pct >= 99.0 else "Needs Attention",
            "processes": proc_stats
        })

    return {
        "roster_id": roster.id,
        "month": roster.month,
        "year": roster.year,
        "brands": brand_coverage_list
    }

@router.get("/{id}/conflicts", response_model=List[SchedulingConflictOut])
def get_roster_conflicts(
    id: int,
    severity: Optional[str] = None,
    brand_id: Optional[int] = None,
    process_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    pod_id: Optional[int] = None,
    category: Optional[str] = None,
    resolved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SchedulingConflict).filter(SchedulingConflict.roster_id == id)
    if severity:
        query = query.filter(SchedulingConflict.severity == severity)
    if brand_id:
        query = query.filter(SchedulingConflict.brand_id == brand_id)
    if process_id:
        query = query.filter(SchedulingConflict.process_id == process_id)
    if employee_id:
        query = query.filter(SchedulingConflict.employee_id == employee_id)
    if resolved is not None:
        query = query.filter(SchedulingConflict.resolved == resolved)

    if pod_id:
        query = query.join(Employee, SchedulingConflict.employee_id == Employee.id, isouter=True)
        query = query.join(Brand, SchedulingConflict.brand_id == Brand.id, isouter=True)
        query = query.filter((Employee.pod_id == pod_id) | (Brand.assigned_pod_id == pod_id))

    if category:
        cat_lower = category.lower()
        if "cover" in cat_lower or "gap" in cat_lower:
            query = query.filter(SchedulingConflict.explanation.ilike("%coverage%"))
        elif "leave" in cat_lower or "avail" in cat_lower or "comp" in cat_lower:
            query = query.filter(
                (SchedulingConflict.explanation.ilike("%leave%")) |
                (SchedulingConflict.explanation.ilike("%comp-off%")) |
                (SchedulingConflict.explanation.ilike("%unavailab%"))
            )
        elif "off" in cat_lower or "weekly" in cat_lower:
            query = query.filter(SchedulingConflict.explanation.ilike("%weekly off%"))
        elif "double" in cat_lower or "book" in cat_lower:
            query = query.filter(SchedulingConflict.explanation.ilike("%double-booking%"))
        elif "workload" in cat_lower or "consec" in cat_lower:
            query = query.filter(
                (SchedulingConflict.explanation.ilike("%workload%")) |
                (SchedulingConflict.explanation.ilike("%consecutive%"))
            )

    conflicts = query.order_by(SchedulingConflict.severity.asc(), SchedulingConflict.date.asc()).all()
    results = []
    for c in conflicts:
        out = SchedulingConflictOut.model_validate(c)
        out.brand_name = c.brand.name if c.brand else None
        out.process_name = c.process.name if c.process else None
        out.employee_name = c.employee.full_name if c.employee else None
        results.append(out)
    return results

@router.post("/{id}/conflicts/{conflict_id}/resolve")
def resolve_conflict(id: int, conflict_id: int, notes: str = "Resolved by manager", db: Session = Depends(get_db)):
    c = db.query(SchedulingConflict).filter(
        SchedulingConflict.id == conflict_id,
        SchedulingConflict.roster_id == id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conflict not found")
    c.resolved = True
    c.resolution_notes = notes
    db.commit()
    return {"success": True, "message": "Conflict marked as resolved"}

@router.get("/{id}/versions", response_model=List[RosterVersionOut])
def get_roster_versions(id: int, db: Session = Depends(get_db)):
    versions = db.query(RosterVersion).filter(RosterVersion.roster_id == id).order_by(RosterVersion.version.desc()).all()
    return versions

@router.get("/{id}/audit", response_model=List[AuditLogOut])
def get_roster_audit_logs(id: int, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(AuditLog.roster_id == id).order_by(AuditLog.timestamp.desc()).all()
    return logs

def _enrich_roster_out(roster: Roster, db: Session) -> RosterOut:
    total_assignments = db.query(RosterAssignment).filter(RosterAssignment.roster_id == roster.id).count()
    conflicts = db.query(SchedulingConflict).filter(SchedulingConflict.roster_id == roster.id).all()
    critical_c = sum(1 for c in conflicts if c.severity == "CRITICAL" and not c.resolved)
    warnings_c = sum(1 for c in conflicts if c.severity == "WARNING" and not c.resolved)

    # Compute coverage %
    cov_pct = 100.0 if critical_c == 0 else max(50.0, round(100.0 - (critical_c * 2.2), 1))

    out = RosterOut.model_validate(roster)
    out.total_assignments = total_assignments
    out.critical_conflicts = critical_c
    out.warnings_count = warnings_c
    out.coverage_percentage = cov_pct
    return out
