from datetime import date, datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, EmailStr

# Base config
class BaseSchema(BaseModel):
    class Config:
        from_attributes = True

# POD
class PodBase(BaseSchema):
    pod_name: str
    pod_lead_name: str
    description: Optional[str] = None
    status: str = "Active"

class PodCreate(PodBase):
    pass

class PodUpdate(BaseSchema):
    pod_name: Optional[str] = None
    pod_lead_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class PodOut(PodBase):
    id: int
    created_at: datetime
    employee_count: Optional[int] = 0

# EMPLOYEE
class EmployeeBase(BaseSchema):
    employee_id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    status: str = "Active"
    pod_id: Optional[int] = None
    designation: str = "Associate"
    joining_date: date = Field(default_factory=date.today)
    employment_type: str = "Full-Time"
    max_hours_per_day: float = 8.0
    preferred_weekly_off: int = 6 # 0=Mon, 6=Sun
    fixed_weekly_off: Optional[int] = None
    skills: str = ""

class EmployeeCreate(EmployeeBase):
    pass

class EmployeeUpdate(BaseSchema):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    pod_id: Optional[int] = None
    designation: Optional[str] = None
    employment_type: Optional[str] = None
    max_hours_per_day: Optional[float] = None
    preferred_weekly_off: Optional[int] = None
    fixed_weekly_off: Optional[int] = None
    skills: Optional[str] = None

class EmployeeOut(EmployeeBase):
    id: int
    created_at: datetime
    pod_name: Optional[str] = None
    assigned_brands: Optional[List[str]] = []
    assigned_processes: Optional[List[str]] = []

# PROCESS
class ProcessBase(BaseSchema):
    name: str
    code: str
    description: Optional[str] = None
    default_shift_duration: float = 8.0
    status: str = "Active"

class ProcessCreate(ProcessBase):
    pass

class ProcessUpdate(BaseSchema):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    default_shift_duration: Optional[float] = None
    status: Optional[str] = None

class ProcessOut(ProcessBase):
    id: int

# OPERATING RULE
class OperatingRuleBase(BaseSchema):
    brand_id: int
    process_id: int
    operating_mode: str = "365_DAYS"
    working_weekdays: str = "0,1,2,3,4,5,6"
    sunday_operation: bool = True
    public_holiday_operation: bool = True
    min_required_employees: int = 1
    max_required_employees: int = 1
    shift_start_time: str = "09:00"
    shift_end_time: str = "18:00"
    effective_date: date = Field(default_factory=date.today)

class OperatingRuleCreate(OperatingRuleBase):
    pass

class OperatingRuleUpdate(BaseSchema):
    operating_mode: Optional[str] = None
    working_weekdays: Optional[str] = None
    sunday_operation: Optional[bool] = None
    public_holiday_operation: Optional[bool] = None
    min_required_employees: Optional[int] = None
    max_required_employees: Optional[int] = None
    shift_start_time: Optional[str] = None
    shift_end_time: Optional[str] = None
    effective_date: Optional[date] = None

class OperatingRuleOut(OperatingRuleBase):
    id: int
    process_name: Optional[str] = None
    brand_name: Optional[str] = None

# BRAND
class BrandBase(BaseSchema):
    name: str
    code: str
    industry: str
    description: Optional[str] = None
    status: str = "Active"
    assigned_pod_id: Optional[int] = None

class BrandCreate(BrandBase):
    pass

class BrandUpdate(BaseSchema):
    name: Optional[str] = None
    code: Optional[str] = None
    industry: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    assigned_pod_id: Optional[int] = None

class BrandOut(BrandBase):
    id: int
    created_at: datetime
    assigned_pod_name: Optional[str] = None
    employee_count: Optional[int] = 0
    operating_rules: Optional[List[OperatingRuleOut]] = []

# ASSIGNMENT
class AssignmentBase(BaseSchema):
    employee_id: int
    brand_id: int
    process_id: int
    assigned_role: str = "Primary"
    allocation_percentage: float = 100.0
    priority: int = 1
    effective_start_date: date = Field(default_factory=date.today)
    effective_end_date: Optional[date] = None
    active: bool = True

class AssignmentCreate(AssignmentBase):
    pass

class AssignmentUpdate(BaseSchema):
    assigned_role: Optional[str] = None
    allocation_percentage: Optional[float] = None
    priority: Optional[int] = None
    effective_start_date: Optional[date] = None
    effective_end_date: Optional[date] = None
    active: Optional[bool] = None

class AssignmentOut(AssignmentBase):
    id: int
    employee_name: Optional[str] = None
    brand_name: Optional[str] = None
    process_name: Optional[str] = None

# AVAILABILITY
class AvailabilityBase(BaseSchema):
    employee_id: int
    date: date
    status: str = "Available"
    leave_type: Optional[str] = None
    approval_status: str = "Approved"
    reason: str = ""
    notes: Optional[str] = None

class AvailabilityCreate(AvailabilityBase):
    pass

class AvailabilityUpdate(BaseSchema):
    status: Optional[str] = None
    leave_type: Optional[str] = None
    approval_status: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class AvailabilityOut(AvailabilityBase):
    id: int
    employee_name: Optional[str] = None

# PUBLIC HOLIDAY
class PublicHolidayBase(BaseSchema):
    holiday_name: str
    date: date
    applicable_region: str = "All India"
    applicable_brands: str = "ALL"
    holiday_type: str = "National"

class PublicHolidayCreate(PublicHolidayBase):
    pass

class PublicHolidayUpdate(BaseSchema):
    holiday_name: Optional[str] = None
    date: Optional[date] = None
    applicable_region: Optional[str] = None
    applicable_brands: Optional[str] = None
    holiday_type: Optional[str] = None

class PublicHolidayOut(PublicHolidayBase):
    id: int

# ROSTER ASSIGNMENT
class RosterAssignmentOut(BaseSchema):
    id: int
    roster_id: int
    employee_id: int
    date: date
    brand_id: Optional[int] = None
    process_id: Optional[int] = None
    shift_start: str
    shift_end: str
    work_status: str
    assignment_source: str
    notes: Optional[str] = None
    employee_name: Optional[str] = None
    brand_name: Optional[str] = None
    process_name: Optional[str] = None

class RosterAssignmentUpdate(BaseSchema):
    work_status: Optional[str] = None
    brand_id: Optional[int] = None
    process_id: Optional[int] = None
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    notes: Optional[str] = None
    force_override: bool = False
    modified_by: str = "Operations Manager"

# CONFLICT
class SchedulingConflictOut(BaseSchema):
    id: int
    roster_id: int
    severity: str
    date: date
    brand_id: Optional[int] = None
    process_id: Optional[int] = None
    employee_id: Optional[int] = None
    expected_staffing: int
    actual_staffing: int
    explanation: str
    suggested_resolution: str
    resolved: bool
    resolution_notes: Optional[str] = None
    brand_name: Optional[str] = None
    process_name: Optional[str] = None
    employee_name: Optional[str] = None

# ROSTER
class RosterGenerateRequest(BaseSchema):
    month: int # 1..12
    year: int
    pod_id: Optional[int] = None
    brand_id: Optional[int] = None
    generated_by: str = "Operations Lead"

class RosterOut(BaseSchema):
    id: int
    month: int
    year: int
    version: int
    status: str
    generated_date: datetime
    generated_by: str
    validation_status: str
    published_date: Optional[datetime] = None
    published_by: Optional[str] = None
    pod_id: Optional[int] = None
    brand_id: Optional[int] = None
    total_assignments: Optional[int] = 0
    coverage_percentage: Optional[float] = 0.0
    critical_conflicts: Optional[int] = 0
    warnings_count: Optional[int] = 0

# IMPACT ANALYSIS
class ImpactAnalysisRequest(BaseSchema):
    employee_id: int
    date: date
    new_status: str # e.g. "Approved Leave", "Unavailable", "Weekly Off"
    leave_type: Optional[str] = "Sick Leave"
    reason: Optional[str] = "Personal Emergency"

class BackupCandidate(BaseSchema):
    employee_id: int
    employee_name: str
    pod_id: Optional[int] = None
    pod_name: Optional[str] = None
    current_weekly_shifts: int
    max_weekly_shifts: int
    is_same_pod: bool
    skill_match: bool
    recommendation_score: float
    explanation: str

class ImpactAnalysisResult(BaseSchema):
    affected_employee_id: int
    affected_employee_name: str
    date: date
    new_status: str
    affected_assignments: List[Dict[str, Any]]
    coverage_before_percent: float
    coverage_after_percent: float
    critical_conflicts_before: int
    critical_conflicts_after: int
    backup_recommendations: List[BackupCandidate]
    can_auto_replace: bool

class ApplyImpactRequest(BaseSchema):
    employee_id: int
    date: date
    new_status: str
    replacement_employee_id: Optional[int] = None
    roster_id: int
    reason: Optional[str] = "Impact replacement"

# AUDIT & VERSION
class AuditLogOut(BaseSchema):
    id: int
    roster_id: int
    employee_id: Optional[int] = None
    action: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    modified_by: str
    timestamp: datetime
    reason: Optional[str] = None

class RosterVersionOut(BaseSchema):
    id: int
    roster_id: int
    version: int
    created_at: datetime
    created_by: str
    notes: Optional[str] = None
