from datetime import date
from typing import List, Optional, Dict, Any
from app.models.entities import (
    Employee, EmployeeAvailability, EmployeeAssignment, OperatingRule, PublicHoliday
)

class ConstraintChecker:
    @staticmethod
    def get_employee_availability(
        employee_id: int, target_date: date, availabilities: List[EmployeeAvailability]
    ) -> Optional[EmployeeAvailability]:
        """Find any availability record for employee on target_date."""
        for av in availabilities:
            if av.employee_id == employee_id and av.date == target_date:
                return av
        return None

    @staticmethod
    def is_employee_hard_unavailable(
        employee: Employee, target_date: date, availabilities: List[EmployeeAvailability]
    ) -> tuple[bool, str]:
        """
        Hard constraint check:
        1. Approved Leave
        2. Approved Comp-Off
        3. Explicit Unavailable / Training
        4. Fixed Weekly Off
        """
        # Fixed weekly off
        if employee.fixed_weekly_off is not None and target_date.weekday() == employee.fixed_weekly_off:
            return True, f"Mandatory Fixed Weekly Off ({target_date.strftime('%A')})"

        # Check availability table
        av = ConstraintChecker.get_employee_availability(employee.id, target_date, availabilities)
        if av:
            status_clean = av.status.strip().title()
            if status_clean in ["Approved Leave", "Leave"] or (av.approval_status == "Approved" and status_clean != "Available"):
                return True, f"Approved Leave ({av.leave_type or 'Leave'}: {av.reason})"
            if status_clean == "Comp-Off" or av.leave_type == "Comp-Off":
                return True, f"Approved Comp-Off ({av.reason})"
            if status_clean in ["Unavailable", "Training"]:
                return True, f"Employee is {status_clean} ({av.reason})"

        return False, "Available"

    @staticmethod
    def is_preferred_weekly_off(employee: Employee, target_date: date) -> bool:
        """Soft constraint: preferred weekly off."""
        return employee.preferred_weekly_off == target_date.weekday()
