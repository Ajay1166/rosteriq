import io
import csv
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Roster, RosterAssignment, SchedulingConflict, EmployeeAvailability

router = APIRouter(prefix="/exports", tags=["Reports & Exports"])

@router.get("/roster")
def export_roster_csv(roster_id: int, db: Session = Depends(get_db)):
    """Exports monthly roster assignments as standard CSV."""
    roster = db.query(Roster).filter(Roster.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")

    assignments = db.query(RosterAssignment).filter(
        RosterAssignment.roster_id == roster_id
    ).order_by(RosterAssignment.date.asc(), RosterAssignment.employee_id.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Date", "Employee ID", "Employee Name", "Pod", "Work Status",
        "Brand Name", "Process Name", "Shift Start", "Shift End", "Source", "Notes"
    ])

    for ra in assignments:
        emp = ra.employee
        writer.writerow([
            ra.date.isoformat(),
            emp.employee_id if emp else "",
            emp.full_name if emp else "",
            emp.pod.pod_name if (emp and emp.pod) else "",
            ra.work_status,
            ra.brand.name if ra.brand else "",
            ra.process.name if ra.process else "",
            ra.shift_start,
            ra.shift_end,
            ra.assignment_source,
            ra.notes or ""
        ])

    csv_data = output.getvalue()
    filename = f"RosterIQ_Roster_{roster.month}_{roster.year}_v{roster.version}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/conflicts")
def export_conflicts_csv(roster_id: int, db: Session = Depends(get_db)):
    """Exports unresolved conflicts and gaps as CSV."""
    conflicts = db.query(SchedulingConflict).filter(
        SchedulingConflict.roster_id == roster_id
    ).order_by(SchedulingConflict.severity.asc(), SchedulingConflict.date.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Conflict ID", "Severity", "Date", "Brand", "Process",
        "Employee", "Expected Staffing", "Actual Staffing",
        "Explanation", "Suggested Resolution", "Resolved"
    ])

    for c in conflicts:
        writer.writerow([
            c.id,
            c.severity,
            c.date.isoformat(),
            c.brand.name if c.brand else "All",
            c.process.name if c.process else "All",
            c.employee.full_name if c.employee else "N/A",
            c.expected_staffing,
            c.actual_staffing,
            c.explanation,
            c.suggested_resolution,
            "Yes" if c.resolved else "No"
        ])

    csv_data = output.getvalue()
    filename = f"RosterIQ_Conflicts_Roster_{roster_id}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
