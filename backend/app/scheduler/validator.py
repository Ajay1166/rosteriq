import calendar
from datetime import date
from typing import List, Dict, Tuple, Set
from collections import defaultdict
from sqlalchemy.orm import Session

from app.models.entities import (
    Roster, RosterAssignment, SchedulingConflict,
    Employee, Brand, Process, EmployeeAssignment, OperatingRule,
    EmployeeAvailability, PublicHoliday
)
from app.scheduler.calendar_rules import is_operating_day, is_public_holiday

class RosterValidator:
    def __init__(self, db: Session):
        self.db = db

    def validate_roster(self, roster_id: int) -> dict:
        """
        Independent validator that inspects stored roster assignments.
        Cleans previous unresolved conflicts and generates fresh conflicts.
        Updates roster status and validation_status.
        """
        roster = self.db.query(Roster).filter(Roster.id == roster_id).first()
        if not roster:
            raise ValueError(f"Roster {roster_id} not found")

        # Collect existing resolved conflicts so manager overrides are preserved
        resolved_conflicts = self.db.query(SchedulingConflict).filter(
            SchedulingConflict.roster_id == roster_id,
            SchedulingConflict.resolved == True
        ).all()
        resolved_lookup = {
            (c.date, c.brand_id, c.process_id, c.employee_id, c.severity): c.resolution_notes
            for c in resolved_conflicts
        }

        # Clear existing un-resolved auto conflicts for this roster
        self.db.query(SchedulingConflict).filter(
            SchedulingConflict.roster_id == roster_id,
            SchedulingConflict.resolved == False
        ).delete()
        self.db.flush()

        # Gather context
        num_days = calendar.monthrange(roster.year, roster.month)[1]
        dates = [date(roster.year, roster.month, day) for day in range(1, num_days + 1)]

        all_employees = {e.id: e for e in self.db.query(Employee).all()}
        all_brands = {b.id: b for b in self.db.query(Brand).all()}
        all_processes = {p.id: p for p in self.db.query(Process).all()}
        all_rules = {(r.brand_id, r.process_id): r for r in self.db.query(OperatingRule).all()}
        holidays = self.db.query(PublicHoliday).all()
        availabilities = self.db.query(EmployeeAvailability).filter(
            EmployeeAvailability.date >= dates[0],
            EmployeeAvailability.date <= dates[-1]
        ).all()
        # Map: (employee_id, date) -> availability
        avail_map: Dict[Tuple[int, date], EmployeeAvailability] = {
            (av.employee_id, av.date): av for av in availabilities
        }

        # Active assignments
        active_assignments = self.db.query(EmployeeAssignment).filter(EmployeeAssignment.active == True).all()
        emp_brand_procs: Dict[int, Set[Tuple[int, int]]] = defaultdict(set)
        brand_assigned_emps: Dict[int, Set[int]] = defaultdict(set)
        for ea in active_assignments:
            emp_brand_procs[ea.employee_id].add((ea.brand_id, ea.process_id))
            brand_assigned_emps[ea.brand_id].add(ea.employee_id)

        # Stored roster assignments
        assignments = self.db.query(RosterAssignment).filter(
            RosterAssignment.roster_id == roster_id
        ).all()

        # Index assignments:
        # by (date, employee_id) -> list of RosterAssignment
        date_emp_assignments: Dict[Tuple[date, int], List[RosterAssignment]] = defaultdict(list)
        # by (date, brand_id, process_id) -> list of working employee_ids
        brand_proc_coverage: Dict[Tuple[date, int, int], Set[int]] = defaultdict(set)

        for ra in assignments:
            date_emp_assignments[(ra.date, ra.employee_id)].append(ra)
            if ra.work_status == "Working" and ra.brand_id:
                if ra.process_id:
                    brand_proc_coverage[(ra.date, ra.brand_id, ra.process_id)].add(ra.employee_id)
                # If employee is allocated to other processes of the same brand, count them as covered too
                for (b_id, p_id) in emp_brand_procs.get(ra.employee_id, []):
                    if b_id == ra.brand_id:
                        brand_proc_coverage[(ra.date, b_id, p_id)].add(ra.employee_id)

                # For single-resource brands (<=1 primary assigned employee), a scheduled working shift covers all operating processes of that brand
                if len(brand_assigned_emps.get(ra.brand_id, set())) <= 1:
                    for (b_id, p_id) in all_rules.keys():
                        if b_id == ra.brand_id:
                            brand_proc_coverage[(ra.date, b_id, p_id)].add(ra.employee_id)

        conflicts: List[SchedulingConflict] = []
        total_required_slots = 0
        covered_required_slots = 0

        # Filter target brands if roster is scoped
        target_brands = list(all_brands.values())
        if roster.brand_id:
            target_brands = [b for b in target_brands if b.id == roster.brand_id]
        elif roster.pod_id:
            target_brands = [b for b in target_brands if b.assigned_pod_id == roster.pod_id]

        # 1. Coverage Validation per Operating Brand & Process
        assigned_brand_procs = {(ea.brand_id, ea.process_id) for ea in active_assignments}
        for cur_date in dates:
            for b in target_brands:
                for p in all_processes.values():
                    rule = all_rules.get((b.id, p.id))
                    has_assignments = (b.id, p.id) in assigned_brand_procs
                    if not rule:
                        if not has_assignments:
                            # Brand does not operate this process
                            continue
                        rule = OperatingRule(
                            brand_id=b.id, process_id=p.id, operating_mode="365_DAYS",
                            min_required_employees=1, max_required_employees=1
                        )
                    elif rule.min_required_employees <= 0:
                        continue

                    is_op, op_reason = is_operating_day(rule, cur_date, b.code, holidays)
                    if is_op:
                        min_req = rule.min_required_employees
                        total_required_slots += min_req
                        actual_assigned = len(brand_proc_coverage[(cur_date, b.id, p.id)])
                        
                        if actual_assigned >= min_req:
                            covered_required_slots += min_req
                        else:
                            covered_required_slots += actual_assigned
                            conflicts.append(SchedulingConflict(
                                roster_id=roster_id,
                                severity="CRITICAL",
                                date=cur_date,
                                brand_id=b.id,
                                process_id=p.id,
                                expected_staffing=min_req,
                                actual_staffing=actual_assigned,
                                explanation=(
                                    f"Coverage Gap: {b.name} [{p.name}] requires {min_req} staff "
                                    f"on {cur_date.strftime('%d %b %Y')}, but only {actual_assigned} assigned."
                                ),
                                suggested_resolution="Assign a qualified backup employee to meet the client service level requirement."
                            ))

        # 2. Employee-Level Checks
        # Track consecutive working days per employee
        emp_consecutive_days: Dict[int, int] = defaultdict(int)

        for cur_date in dates:
            for emp_id, emp in all_employees.items():
                day_ras = date_emp_assignments.get((cur_date, emp_id), [])
                working_ras = [ra for ra in day_ras if ra.work_status == "Working"]

                # A. Check double booking across different brands
                working_brands = {ra.brand_id for ra in working_ras if ra.brand_id}
                if len(working_brands) > 1:
                    conflicts.append(SchedulingConflict(
                        roster_id=roster_id,
                        severity="CRITICAL",
                        date=cur_date,
                        employee_id=emp_id,
                        expected_staffing=1,
                        actual_staffing=len(working_brands),
                        explanation=f"Double-Booking Conflict: {emp.full_name} is assigned to multiple distinct brands on {cur_date.strftime('%d %b')}.",
                        suggested_resolution="Remove one of the overlapping brand assignments."
                    ))

                # Check if employee is working
                if working_ras:
                    emp_consecutive_days[emp_id] += 1
                    if emp_consecutive_days[emp_id] > 6:
                        conflicts.append(SchedulingConflict(
                            roster_id=roster_id,
                            severity="WARNING",
                            date=cur_date,
                            employee_id=emp_id,
                            expected_staffing=1,
                            actual_staffing=1,
                            explanation=f"Excessive Workload: {emp.full_name} scheduled for {emp_consecutive_days[emp_id]} consecutive days without a weekly off.",
                            suggested_resolution="Schedule a compensatory day off to comply with labor and wellness guidelines."
                        ))

                    # B. Approved leave conflict
                    av = avail_map.get((emp_id, cur_date))
                    if av:
                        av_stat = av.status.strip().title()
                        if av_stat in ["Approved Leave", "Leave"] or (av.approval_status == "Approved" and av_stat != "Available"):
                            conflicts.append(SchedulingConflict(
                                roster_id=roster_id,
                                severity="CRITICAL",
                                date=cur_date,
                                employee_id=emp_id,
                                expected_staffing=0,
                                actual_staffing=1,
                                explanation=f"Approved Leave Conflict: {emp.full_name} is scheduled to work while on approved leave ({av.leave_type or 'Leave'}: {av.reason}).",
                                suggested_resolution="Cancel shift or designate replacement."
                            ))
                        elif av_stat == "Comp-Off" or av.leave_type == "Comp-Off":
                            conflicts.append(SchedulingConflict(
                                roster_id=roster_id,
                                severity="CRITICAL",
                                date=cur_date,
                                employee_id=emp_id,
                                expected_staffing=0,
                                actual_staffing=1,
                                explanation=f"Comp-Off Conflict: {emp.full_name} is scheduled to work on an approved Comp-Off day.",
                                suggested_resolution="Change shift status to Comp-Off and reassign duties."
                            ))
                        elif av_stat in ["Unavailable", "Training"]:
                            conflicts.append(SchedulingConflict(
                                roster_id=roster_id,
                                severity="CRITICAL",
                                date=cur_date,
                                employee_id=emp_id,
                                expected_staffing=0,
                                actual_staffing=1,
                                explanation=f"Unavailability Conflict: {emp.full_name} is marked as {av_stat} on {cur_date.strftime('%d %b')}.",
                                suggested_resolution="Reassign to an available resource."
                            ))

                    # C. Fixed weekly off violation
                    if emp.fixed_weekly_off is not None and cur_date.weekday() == emp.fixed_weekly_off:
                        conflicts.append(SchedulingConflict(
                            roster_id=roster_id,
                            severity="CRITICAL",
                            date=cur_date,
                            employee_id=emp_id,
                            expected_staffing=0,
                            actual_staffing=1,
                            explanation=f"Fixed Weekly Off Violation: {emp.full_name} is assigned to work on their mandatory fixed off day ({cur_date.strftime('%A')}).",
                            suggested_resolution="Relieve employee and schedule an alternate team member."
                        ))
                    elif cur_date.weekday() == emp.preferred_weekly_off:
                        # Preferred weekly off warning
                        conflicts.append(SchedulingConflict(
                            roster_id=roster_id,
                            severity="WARNING",
                            date=cur_date,
                            employee_id=emp_id,
                            expected_staffing=0,
                            actual_staffing=1,
                            explanation=f"Preferred Weekly Off Overridden: {emp.full_name} is scheduled on preferred off ({cur_date.strftime('%A')}).",
                            suggested_resolution="Consider adjusting other shifts if workload permits."
                        ))

                    # D. Non-operating day assignment
                    for ra in working_ras:
                        if ra.brand_id and ra.process_id:
                            rule = all_rules.get((ra.brand_id, ra.process_id))
                            b = all_brands.get(ra.brand_id)
                            if rule and b:
                                is_op, op_msg = is_operating_day(rule, cur_date, b.code, holidays)
                                if not is_op:
                                    conflicts.append(SchedulingConflict(
                                        roster_id=roster_id,
                                        severity="WARNING",
                                        date=cur_date,
                                        brand_id=b.id,
                                        process_id=ra.process_id,
                                        employee_id=emp_id,
                                        expected_staffing=0,
                                        actual_staffing=1,
                                        explanation=f"Non-Operating Day Shift: {emp.full_name} scheduled for {b.name} on a closed day ({op_msg}).",
                                        suggested_resolution="Remove shift as the brand process does not operate on this date."
                                    ))
                else:
                    emp_consecutive_days[emp_id] = 0

        # Check against previously resolved conflicts to preserve manager overrides
        for c in conflicts:
            key = (c.date, c.brand_id, c.process_id, c.employee_id, c.severity)
            if key in resolved_lookup:
                c.resolved = True
                c.resolution_notes = resolved_lookup[key]

        # Deduplicate conflicts before saving
        unique_conflicts = []
        seen = set()
        for c in conflicts:
            k = (c.roster_id, c.date, c.brand_id, c.process_id, c.employee_id, c.severity, c.explanation)
            if k not in seen:
                seen.add(k)
                unique_conflicts.append(c)

        # Save all conflicts
        self.db.bulk_save_objects(unique_conflicts)

        # Calculate coverage percentage
        coverage_pct = round((covered_required_slots / total_required_slots * 100), 2) if total_required_slots > 0 else 100.0

        # Determine Roster Status (only unresolved critical conflicts require attention)
        critical_count = sum(1 for c in unique_conflicts if c.severity == "CRITICAL" and not c.resolved)
        warning_count = sum(1 for c in unique_conflicts if c.severity == "WARNING" and not c.resolved)

        if critical_count > 0:
            roster.status = "Needs Attention"
            roster.validation_status = "Invalid"
        else:
            if roster.status != "Published":
                roster.status = "Validated"
            roster.validation_status = "Valid"

        self.db.commit()

        return {
            "roster_id": roster_id,
            "status": roster.status,
            "validation_status": roster.validation_status,
            "total_required_slots": total_required_slots,
            "covered_required_slots": covered_required_slots,
            "coverage_percentage": coverage_pct,
            "critical_conflicts": critical_count,
            "warnings_count": warning_count,
            "conflicts_count": len(conflicts)
        }
