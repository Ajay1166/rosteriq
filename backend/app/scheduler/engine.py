import calendar
from datetime import date, datetime
from typing import List, Dict, Optional, Tuple, Set
from collections import defaultdict
from sqlalchemy.orm import Session

from app.models.entities import (
    Roster, RosterAssignment, SchedulingConflict, RosterVersion,
    Employee, Brand, Process, EmployeeAssignment, OperatingRule,
    EmployeeAvailability, PublicHoliday, AuditLog
)
from app.scheduler.calendar_rules import is_operating_day, is_public_holiday
from app.scheduler.constraints import ConstraintChecker
from app.scheduler.validator import RosterValidator

class RosterSchedulerEngine:
    def __init__(self, db: Session):
        self.db = db

    def generate_roster(
        self,
        month: int,
        year: int,
        pod_id: Optional[int] = None,
        brand_id: Optional[int] = None,
        generated_by: str = "Operations Lead"
    ) -> Roster:
        """
        Deterministic, constraint-based scheduling engine.
        Follows the 12-step scheduling procedure from Part 9.
        """
        # 1. Fetch reference data
        num_days = calendar.monthrange(year, month)[1]
        dates = [date(year, month, day) for day in range(1, num_days + 1)]

        emp_query = self.db.query(Employee).filter(Employee.status == "Active")
        if pod_id:
            emp_query = emp_query.filter(Employee.pod_id == pod_id)
        all_employees = emp_query.all()
        emp_map = {e.id: e for e in all_employees}

        brand_query = self.db.query(Brand).filter(Brand.status == "Active")
        if brand_id:
            brand_query = brand_query.filter(Brand.id == brand_id)
        elif pod_id:
            brand_query = brand_query.filter(Brand.assigned_pod_id == pod_id)
        all_brands = brand_query.all()
        brand_map = {b.id: b for b in all_brands}

        all_processes = self.db.query(Process).filter(Process.status == "Active").all()
        process_map = {p.id: p for p in all_processes}

        # Active assignments
        assign_query = self.db.query(EmployeeAssignment).filter(EmployeeAssignment.active == True)
        if brand_id:
            assign_query = assign_query.filter(EmployeeAssignment.brand_id == brand_id)
        all_assignments = assign_query.all()

        # Operating rules
        all_rules = self.db.query(OperatingRule).all()
        # Map: (brand_id, process_id) -> OperatingRule
        rule_map: Dict[Tuple[int, int], OperatingRule] = {}
        for r in all_rules:
            rule_map[(r.brand_id, r.process_id)] = r

        # Public holidays
        holidays = self.db.query(PublicHoliday).all()

        # Employee Availabilities in the month
        start_date = dates[0]
        end_date = dates[-1]
        availabilities = self.db.query(EmployeeAvailability).filter(
            EmployeeAvailability.date >= start_date,
            EmployeeAvailability.date <= end_date
        ).all()

        # 2. Check if a roster already exists for this month/year/filters
        existing_roster = self.db.query(Roster).filter(
            Roster.month == month,
            Roster.year == year,
            Roster.pod_id == pod_id,
            Roster.brand_id == brand_id
        ).order_by(Roster.version.desc()).first()

        new_version = (existing_roster.version + 1) if existing_roster else 1

        roster = Roster(
            month=month,
            year=year,
            version=new_version,
            status="Draft",
            generated_date=datetime.utcnow(),
            generated_by=generated_by,
            validation_status="Needs Review",
            pod_id=pod_id,
            brand_id=brand_id
        )
        self.db.add(roster)
        self.db.flush()

        # Map employee assignments by (brand_id, process_id) -> list of EmployeeAssignment
        brand_proc_assignments: Dict[Tuple[int, int], List[EmployeeAssignment]] = defaultdict(list)
        # Also map employee_id -> list of (brand_id, process_id)
        emp_capabilities: Dict[int, List[Tuple[int, int]]] = defaultdict(list)
        for ea in all_assignments:
            if ea.employee_id in emp_map and ea.brand_id in brand_map:
                brand_proc_assignments[(ea.brand_id, ea.process_id)].append(ea)
                emp_capabilities[ea.employee_id].append((ea.brand_id, ea.process_id))

        # Track monthly working days per employee for workload balance
        employee_workload: Dict[int, int] = defaultdict(int)

        generated_assignments: List[RosterAssignment] = []
        conflicts_to_create: List[SchedulingConflict] = []

        total_required_slots = 0
        covered_required_slots = 0

        # Day-by-day scheduling
        for cur_date in dates:
            # Track who is assigned today to which brand: employee_id -> brand_id
            emp_assigned_today: Dict[int, int] = {}
            # Track process coverage today: (brand_id, process_id) -> list of assigned employee_ids
            proc_coverage_today: Dict[Tuple[int, int], List[int]] = defaultdict(list)

            # Step 1 & 2: Identify active operating brand-processes today
            operating_today: List[Tuple[Brand, Process, OperatingRule]] = []
            for b in all_brands:
                for p in all_processes:
                    rule = rule_map.get((b.id, p.id))
                    if not rule:
                        # Fallback default rule: 365 days, 1 employee
                        rule = OperatingRule(
                            brand_id=b.id,
                            process_id=p.id,
                            operating_mode="365_DAYS",
                            min_required_employees=1,
                            max_required_employees=1,
                            shift_start_time="09:00",
                            shift_end_time="18:00"
                        )
                    
                    is_op, _ = is_operating_day(rule, cur_date, b.code, holidays)
                    if is_op:
                        operating_today.append((b, p, rule))

            # Sort operating processes: single-resource brand processes first, then high-priority
            operating_today.sort(key=lambda item: (item[0].id, item[1].id))

            # Step 3: For each operating brand-process, find qualified candidates
            for brand, process, rule in operating_today:
                min_req = rule.min_required_employees
                total_required_slots += min_req

                eligible_eas = brand_proc_assignments.get((brand.id, process.id), [])
                
                # Check if someone already scheduled today covers this process
                # (e.g. employee already assigned to this brand handles all its processes)
                already_assigned = [
                    eid for eid in eligible_eas
                    if eid.employee_id in emp_assigned_today and emp_assigned_today[eid.employee_id] == brand.id
                ]
                for ea in already_assigned:
                    if ea.employee_id not in proc_coverage_today[(brand.id, process.id)]:
                        proc_coverage_today[(brand.id, process.id)].append(ea.employee_id)

                needed = min_req - len(proc_coverage_today[(brand.id, process.id)])
                if needed <= 0:
                    covered_required_slots += min_req
                    continue

                # Filter eligible employees who are available
                candidate_pool = []
                for ea in eligible_eas:
                    emp = emp_map.get(ea.employee_id)
                    if not emp:
                        continue

                    # Already working on another brand today?
                    if emp.id in emp_assigned_today:
                        if emp_assigned_today[emp.id] != brand.id:
                            continue # Incompatible brand shift overlap

                    # Hard unavailability check
                    is_hard_unavail, reason = ConstraintChecker.is_employee_hard_unavailable(
                        emp, cur_date, availabilities
                    )
                    if is_hard_unavail:
                        continue

                    # Soft constraint score
                    is_pref_off = ConstraintChecker.is_preferred_weekly_off(emp, cur_date)
                    current_shifts = employee_workload[emp.id]
                    # Score calculation: lower score is assigned first
                    # Priority 1 is preferred over Priority 2
                    # Working on preferred off has penalty 100
                    # Current workload penalty 10 per prior shift
                    score = (ea.priority * 10) + (100 if is_pref_off else 0) + (current_shifts * 2)
                    candidate_pool.append((score, is_pref_off, emp, ea))

                # Sort by score ascending (best candidate first)
                candidate_pool.sort(key=lambda x: x[0])

                # Assign needed candidates
                assigned_count = 0
                for score, is_pref_off, emp, ea in candidate_pool:
                    if assigned_count >= needed:
                        break
                    
                    if emp.id not in proc_coverage_today[(brand.id, process.id)]:
                        proc_coverage_today[(brand.id, process.id)].append(emp.id)
                        assigned_count += 1

                        if emp.id not in emp_assigned_today:
                            emp_assigned_today[emp.id] = brand.id
                            employee_workload[emp.id] += 1

                            # If this employee also covers other processes of the same brand, link them!
                            for (b_id, p_id) in emp_capabilities.get(emp.id, []):
                                if b_id == brand.id and p_id != process.id:
                                    if emp.id not in proc_coverage_today[(b_id, p_id)]:
                                        proc_coverage_today[(b_id, p_id)].append(emp.id)

                            # Create RosterAssignment record for employee
                            ra = RosterAssignment(
                                roster_id=roster.id,
                                employee_id=emp.id,
                                date=cur_date,
                                brand_id=brand.id,
                                process_id=process.id,
                                shift_start=rule.shift_start_time,
                                shift_end=rule.shift_end_time,
                                work_status="Working",
                                assignment_source="automatic",
                                notes=f"Assigned to {brand.name} - {process.name}"
                            )
                            generated_assignments.append(ra)

                            # If assigned on preferred weekly off, log a WARNING conflict
                            if is_pref_off:
                                conflicts_to_create.append(SchedulingConflict(
                                    roster_id=roster.id,
                                    severity="WARNING",
                                    date=cur_date,
                                    brand_id=brand.id,
                                    process_id=process.id,
                                    employee_id=emp.id,
                                    expected_staffing=min_req,
                                    actual_staffing=len(proc_coverage_today[(brand.id, process.id)]),
                                    explanation=f"{emp.full_name} scheduled on preferred weekly off ({cur_date.strftime('%A')}) to meet coverage for {brand.name}.",
                                    suggested_resolution="If possible, allocate a cross-pod or backup resource to restore weekly off."
                                ))

                # Count coverage
                current_staffing = len(proc_coverage_today[(brand.id, process.id)])
                if current_staffing >= min_req:
                    covered_required_slots += min_req
                else:
                    covered_required_slots += current_staffing
                    # Step 9: Record CRITICAL conflict
                    conflicts_to_create.append(SchedulingConflict(
                        roster_id=roster.id,
                        severity="CRITICAL",
                        date=cur_date,
                        brand_id=brand.id,
                        process_id=process.id,
                        employee_id=eligible_eas[0].employee_id if eligible_eas else None,
                        expected_staffing=min_req,
                        actual_staffing=current_staffing,
                        explanation=(
                            f"Coverage Gap for {brand.name} [{process.name}] on {cur_date.strftime('%d %b %Y')}. "
                            f"Required: {min_req}, Actual: {current_staffing}. "
                            f"Reason: Eligible assigned staff is on leave, unavailable, or insufficient."
                        ),
                        suggested_resolution="Assign a qualified backup employee from another pod or adjust leave approval."
                    ))

            # Step 10: For all active employees who are NOT working today, assign non-working status
            for emp in all_employees:
                if emp.id not in emp_assigned_today:
                    # Check reason
                    av = ConstraintChecker.get_employee_availability(emp.id, cur_date, availabilities)
                    status_text = "Weekly Off"
                    note_text = "Scheduled Weekly Off"

                    if av:
                        av_stat = av.status.strip().title()
                        if av_stat in ["Approved Leave", "Leave"] or (av.approval_status == "Approved" and av_stat != "Available"):
                            status_text = "Leave"
                            note_text = f"Approved Leave: {av.leave_type or 'Leave'} ({av.reason})"
                        elif av_stat == "Comp-Off" or av.leave_type == "Comp-Off":
                            status_text = "Comp-Off"
                            note_text = f"Comp-Off: {av.reason}"
                        elif av_stat in ["Unavailable", "Training"]:
                            status_text = "Unavailable"
                            note_text = f"{av_stat}: {av.reason}"
                    else:
                        # Check public holiday
                        # If today is public holiday across all brands
                        pub_h = is_public_holiday(cur_date, "ALL", holidays)
                        if pub_h:
                            status_text = "Public Holiday"
                            note_text = f"Public Holiday: {pub_h.holiday_name}"
                        elif emp.fixed_weekly_off is not None and cur_date.weekday() == emp.fixed_weekly_off:
                            status_text = "Weekly Off"
                            note_text = f"Fixed Weekly Off ({cur_date.strftime('%A')})"
                        elif cur_date.weekday() == emp.preferred_weekly_off:
                            status_text = "Weekly Off"
                            note_text = f"Preferred Weekly Off ({cur_date.strftime('%A')})"

                    ra = RosterAssignment(
                        roster_id=roster.id,
                        employee_id=emp.id,
                        date=cur_date,
                        brand_id=None,
                        process_id=None,
                        shift_start="00:00",
                        shift_end="00:00",
                        work_status=status_text,
                        assignment_source="automatic",
                        notes=note_text
                    )
                    generated_assignments.append(ra)

        # Bulk save assignments and conflicts
        self.db.bulk_save_objects(generated_assignments)
        self.db.bulk_save_objects(conflicts_to_create)
        self.db.commit()

        # Step 11: Run independent validation engine
        validator = RosterValidator(self.db)
        validator.validate_roster(roster.id)

        # Audit log for roster generation
        audit = AuditLog(
            roster_id=roster.id,
            action="ROSTER_GENERATED",
            new_value=f"Generated {len(generated_assignments)} day-assignments for {month}/{year}",
            modified_by=generated_by,
            reason="Automated deterministic generation"
        )
        self.db.add(audit)
        self.db.commit()

        # Step 12: Return reloaded roster
        self.db.refresh(roster)
        return roster
