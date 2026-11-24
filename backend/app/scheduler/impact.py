from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
from sqlalchemy.orm import Session

from app.models.entities import (
    Roster, RosterAssignment, Employee, Brand, Process,
    EmployeeAssignment, OperatingRule, EmployeeAvailability, Pod,
    SchedulingConflict, AuditLog
)
from app.scheduler.constraints import ConstraintChecker

class ImpactAnalyzer:
    def __init__(self, db: Session):
        self.db = db

    def analyze_unavailability_impact(
        self,
        roster_id: int,
        employee_id: int,
        target_date: date,
        new_status: str = "Approved Leave"
    ) -> Dict[str, Any]:
        """
        Analyzes the exact impact if employee becomes unavailable on target_date.
        Finds affected processes, calculates before/after coverage, ranks backup candidates.
        """
        roster = self.db.query(Roster).filter(Roster.id == roster_id).first()
        if not roster:
            raise ValueError(f"Roster {roster_id} not found")

        affected_emp = self.db.query(Employee).filter(Employee.id == employee_id).first()
        if not affected_emp:
            raise ValueError(f"Employee {employee_id} not found")

        # 1. Check employee's current assignment on that date
        cur_ra = self.db.query(RosterAssignment).filter(
            RosterAssignment.roster_id == roster_id,
            RosterAssignment.employee_id == employee_id,
            RosterAssignment.date == target_date
        ).first()

        is_working = (cur_ra and cur_ra.work_status == "Working")
        
        # 2. Find all active capabilities of this employee (brands and processes they cover)
        emp_assignments = self.db.query(EmployeeAssignment).filter(
            EmployeeAssignment.employee_id == employee_id,
            EmployeeAssignment.active == True
        ).all()

        affected_processes = []
        for ea in emp_assignments:
            brand = self.db.query(Brand).filter(Brand.id == ea.brand_id).first()
            proc = self.db.query(Process).filter(Process.id == ea.process_id).first()
            if brand and proc:
                affected_processes.append({
                    "brand_id": brand.id,
                    "brand_name": brand.name,
                    "process_id": proc.id,
                    "process_name": proc.name,
                    "role": ea.assigned_role,
                    "priority": ea.priority
                })

        # 3. Calculate current roster stats
        current_conflicts = self.db.query(SchedulingConflict).filter(
            SchedulingConflict.roster_id == roster_id
        ).all()
        critical_before = sum(1 for c in current_conflicts if c.severity == "CRITICAL")
        
        critical_after = critical_before + (len(affected_processes) if is_working else 0)

        cov_before = 100.0 if critical_before == 0 else max(70.0, 100.0 - (critical_before * 2.5))
        cov_after = max(50.0, cov_before - (len(affected_processes) * 4.0 if is_working else 0.0))

        # 4. Find and Rank Backup Candidates
        availabilities = self.db.query(EmployeeAvailability).filter(
            EmployeeAvailability.date == target_date
        ).all()
        
        all_active_emps = self.db.query(Employee).filter(
            Employee.status == "Active",
            Employee.id != employee_id
        ).all()

        working_on_date = {
            ra.employee_id: ra for ra in self.db.query(RosterAssignment).filter(
                RosterAssignment.roster_id == roster_id,
                RosterAssignment.date == target_date,
                RosterAssignment.work_status == "Working"
            ).all()
        }

        # Calculate shift counts for current week
        week_start = target_date - timedelta(days=target_date.weekday())
        week_end = week_start + timedelta(days=6)
        weekly_shifts = defaultdict(int)
        for ra in self.db.query(RosterAssignment).filter(
            RosterAssignment.roster_id == roster_id,
            RosterAssignment.date >= week_start,
            RosterAssignment.date <= week_end,
            RosterAssignment.work_status == "Working"
        ).all():
            weekly_shifts[ra.employee_id] += 1

        all_pods = {p.id: p for p in self.db.query(Pod).all()}
        all_skills = {e.id: [s.strip().lower() for s in (e.skills or "").split(",") if s.strip()] for e in all_active_emps}

        # What skills are needed?
        needed_skills = set()
        for p in affected_processes:
            p_name = p["process_name"].lower()
            if "customer" in p_name or "cs" in p_name:
                needed_skills.add("customer support")
            if "cart" in p_name or "acc" in p_name:
                needed_skills.add("acc")
            if "ndr" in p_name:
                needed_skills.add("ndr")
            if "retention" in p_name:
                needed_skills.add("retention")

        backup_candidates = []
        for cand in all_active_emps:
            # Check hard unavailability (leave, comp-off, training)
            is_unavail, _ = ConstraintChecker.is_employee_hard_unavailable(cand, target_date, availabilities)
            if is_unavail:
                continue

            c_shifts = weekly_shifts[cand.id]
            is_currently_working = (cand.id in working_on_date)

            # Scoring:
            # Same pod bonus: 35 pts
            # Skill match bonus: 35 pts
            # Lower weekly shifts: up to 25 pts
            # Off-duty bonus: +30 pts if on Weekly Off (ideal replacement)
            is_same_pod = (cand.pod_id == affected_emp.pod_id)
            pod_bonus = 35.0 if is_same_pod else 10.0

            cand_skills = all_skills.get(cand.id, [])
            skill_matched = bool(needed_skills.intersection(cand_skills)) or ("support" in " ".join(cand_skills))
            skill_bonus = 35.0 if skill_matched else 15.0

            workload_bonus = max(0.0, (6 - c_shifts) * 4.0)
            status_bonus = 30.0 if not is_currently_working else 5.0
            pref_off_penalty = 10.0 if (cand.preferred_weekly_off == target_date.weekday()) else 0.0

            total_score = round(pod_bonus + skill_bonus + workload_bonus + status_bonus - pref_off_penalty, 1)

            pod_name = all_pods.get(cand.pod_id).pod_name if cand.pod_id in all_pods else "General"

            explanation_parts = []
            if not is_currently_working:
                explanation_parts.append("Currently on Weekly Off (Available for shift replacement)")
            else:
                explanation_parts.append("Currently scheduled (Can cross-cover or swap shift)")
            if is_same_pod:
                explanation_parts.append(f"Same operational pod ({pod_name})")
            if skill_matched:
                explanation_parts.append("Matched required process skills")
            explanation_parts.append(f"Weekly workload: {c_shifts}/6 shifts")

            backup_candidates.append({
                "employee_id": cand.id,
                "employee_name": cand.full_name,
                "pod_id": cand.pod_id,
                "pod_name": pod_name,
                "current_weekly_shifts": c_shifts,
                "max_weekly_shifts": 6,
                "is_same_pod": is_same_pod,
                "skill_match": skill_matched,
                "recommendation_score": total_score,
                "explanation": " • ".join(explanation_parts)
            })

        backup_candidates.sort(key=lambda x: x["recommendation_score"], reverse=True)

        return {
            "affected_employee_id": employee_id,
            "affected_employee_name": affected_emp.full_name,
            "date": target_date,
            "new_status": new_status,
            "affected_assignments": affected_processes,
            "coverage_before_percent": round(cov_before, 1),
            "coverage_after_percent": round(cov_after, 1),
            "critical_conflicts_before": critical_before,
            "critical_conflicts_after": critical_after,
            "backup_recommendations": backup_candidates[:6],
            "can_auto_replace": len(backup_candidates) > 0
        }

    def apply_replacement(
        self,
        roster_id: int,
        affected_employee_id: int,
        target_date: date,
        new_status: str,
        replacement_employee_id: Optional[int],
        modified_by: str = "Operations Lead",
        reason: str = "Workforce impact resolution"
    ) -> Dict[str, Any]:
        cur_ra = self.db.query(RosterAssignment).filter(
            RosterAssignment.roster_id == roster_id,
            RosterAssignment.employee_id == affected_employee_id,
            RosterAssignment.date == target_date
        ).first()

        prev_brand_id = cur_ra.brand_id if cur_ra else None
        prev_proc_id = cur_ra.process_id if cur_ra else None
        prev_status = cur_ra.work_status if cur_ra else "Working"

        if cur_ra:
            cur_ra.work_status = new_status
            cur_ra.brand_id = None
            cur_ra.process_id = None
            cur_ra.shift_start = "00:00"
            cur_ra.shift_end = "00:00"
            cur_ra.notes = f"Changed to {new_status}: {reason}"
            cur_ra.assignment_source = "manual"

        if replacement_employee_id and prev_brand_id and prev_proc_id:
            rep_ra = self.db.query(RosterAssignment).filter(
                RosterAssignment.roster_id == roster_id,
                RosterAssignment.employee_id == replacement_employee_id,
                RosterAssignment.date == target_date
            ).first()

            if rep_ra:
                rep_ra.work_status = "Working"
                rep_ra.brand_id = prev_brand_id
                rep_ra.process_id = prev_proc_id
                rep_ra.shift_start = "09:00"
                rep_ra.shift_end = "18:00"
                rep_ra.notes = f"Replacement assigned for employee #{affected_employee_id}"
                rep_ra.assignment_source = "manual"
            else:
                rep_ra = RosterAssignment(
                    roster_id=roster_id,
                    employee_id=replacement_employee_id,
                    date=target_date,
                    brand_id=prev_brand_id,
                    process_id=prev_proc_id,
                    shift_start="09:00",
                    shift_end="18:00",
                    work_status="Working",
                    assignment_source="manual",
                    notes=f"Replacement assigned for employee #{affected_employee_id}"
                )
                self.db.add(rep_ra)

        avail = self.db.query(EmployeeAvailability).filter(
            EmployeeAvailability.employee_id == affected_employee_id,
            EmployeeAvailability.date == target_date
        ).first()

        if not avail:
            avail = EmployeeAvailability(
                employee_id=affected_employee_id,
                date=target_date,
                status=new_status,
                leave_type="Sick Leave" if "Leave" in new_status else new_status,
                approval_status="Approved",
                reason=reason
            )
            self.db.add(avail)
        else:
            avail.status = new_status
            avail.approval_status = "Approved"

        audit = AuditLog(
            roster_id=roster_id,
            employee_id=affected_employee_id,
            action="IMPACT_REPLACEMENT_APPLIED",
            previous_value=f"{prev_status} on brand #{prev_brand_id}",
            new_value=f"Replaced by employee #{replacement_employee_id} ({new_status})",
            modified_by=modified_by,
            reason=reason
        )
        self.db.add(audit)
        self.db.commit()

        from app.scheduler.validator import RosterValidator
        validator = RosterValidator(self.db)
        val_result = validator.validate_roster(roster_id)

        return {
            "success": True,
            "message": "Replacement applied and roster successfully revalidated.",
            "validation": val_result
        }
