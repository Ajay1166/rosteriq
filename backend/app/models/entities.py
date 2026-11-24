from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, Date, DateTime,
    ForeignKey, Text
)
from sqlalchemy.orm import relationship
from app.database import Base

class Pod(Base):
    __tablename__ = "pods"

    id = Column(Integer, primary_key=True, index=True)
    pod_name = Column(String(100), unique=True, nullable=False, index=True)
    pod_lead_name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="Active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    employees = relationship("Employee", back_populates="pod", cascade="all, delete-orphan")
    brands = relationship("Brand", back_populates="assigned_pod")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(50), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    status = Column(String(50), default="Active", nullable=False)
    pod_id = Column(Integer, ForeignKey("pods.id", ondelete="SET NULL"), nullable=True)
    designation = Column(String(100), nullable=False)
    joining_date = Column(Date, default=date.today, nullable=False)
    employment_type = Column(String(50), default="Full-Time", nullable=False)
    max_hours_per_day = Column(Float, default=8.0, nullable=False)
    preferred_weekly_off = Column(Integer, default=6, nullable=False) # 0=Mon, 6=Sun
    fixed_weekly_off = Column(Integer, nullable=True) # None or 0..6
    skills = Column(Text, default="", nullable=False) # Comma-separated or JSON string
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    pod = relationship("Pod", back_populates="employees")
    assignments = relationship("EmployeeAssignment", back_populates="employee", cascade="all, delete-orphan")
    availabilities = relationship("EmployeeAvailability", back_populates="employee", cascade="all, delete-orphan")
    roster_assignments = relationship("RosterAssignment", back_populates="employee", cascade="all, delete-orphan")


class Brand(Base):
    __tablename__ = "brands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    industry = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="Active", nullable=False)
    assigned_pod_id = Column(Integer, ForeignKey("pods.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    assigned_pod = relationship("Pod", back_populates="brands")
    assignments = relationship("EmployeeAssignment", back_populates="brand", cascade="all, delete-orphan")
    operating_rules = relationship("OperatingRule", back_populates="brand", cascade="all, delete-orphan")


class Process(Base):
    __tablename__ = "processes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    default_shift_duration = Column(Float, default=8.0, nullable=False)
    status = Column(String(50), default="Active", nullable=False)

    assignments = relationship("EmployeeAssignment", back_populates="process", cascade="all, delete-orphan")
    operating_rules = relationship("OperatingRule", back_populates="process", cascade="all, delete-orphan")


class EmployeeAssignment(Base):
    __tablename__ = "employee_assignments"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    brand_id = Column(Integer, ForeignKey("brands.id", ondelete="CASCADE"), nullable=False)
    process_id = Column(Integer, ForeignKey("processes.id", ondelete="CASCADE"), nullable=False)
    assigned_role = Column(String(50), default="Primary", nullable=False)
    allocation_percentage = Column(Float, default=100.0, nullable=False)
    priority = Column(Integer, default=1, nullable=False) # 1=Highest priority
    effective_start_date = Column(Date, default=date.today, nullable=False)
    effective_end_date = Column(Date, nullable=True)
    active = Column(Boolean, default=True, nullable=False)

    employee = relationship("Employee", back_populates="assignments")
    brand = relationship("Brand", back_populates="assignments")
    process = relationship("Process", back_populates="assignments")


class OperatingRule(Base):
    __tablename__ = "operating_rules"

    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id", ondelete="CASCADE"), nullable=False)
    process_id = Column(Integer, ForeignKey("processes.id", ondelete="CASCADE"), nullable=False)
    operating_mode = Column(String(50), default="365_DAYS", nullable=False)
    # Options: "365_DAYS", "DAILY_EXCEPT_HOLIDAYS", "SUNDAYS_AND_HOLIDAYS_OFF", "CUSTOM"
    working_weekdays = Column(String(50), default="0,1,2,3,4,5,6", nullable=False) # comma-separated 0..6
    sunday_operation = Column(Boolean, default=True, nullable=False)
    public_holiday_operation = Column(Boolean, default=True, nullable=False)
    min_required_employees = Column(Integer, default=1, nullable=False)
    max_required_employees = Column(Integer, default=1, nullable=False)
    shift_start_time = Column(String(20), default="09:00", nullable=False)
    shift_end_time = Column(String(20), default="18:00", nullable=False)
    effective_date = Column(Date, default=date.today, nullable=False)

    brand = relationship("Brand", back_populates="operating_rules")
    process = relationship("Process", back_populates="operating_rules")


class EmployeeAvailability(Base):
    __tablename__ = "employee_availabilities"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    status = Column(String(50), default="Available", nullable=False)
    # Available, Planned Leave, Approved Leave, Comp-Off, Unavailable, Training
    leave_type = Column(String(50), nullable=True)
    # Sick Leave, Casual Leave, Privilege Leave, Comp-Off, etc.
    approval_status = Column(String(50), default="Approved", nullable=False)
    # Pending, Approved, Rejected
    reason = Column(String(255), default="", nullable=False)
    notes = Column(Text, nullable=True)

    employee = relationship("Employee", back_populates="availabilities")


class PublicHoliday(Base):
    __tablename__ = "public_holidays"

    id = Column(Integer, primary_key=True, index=True)
    holiday_name = Column(String(150), nullable=False)
    date = Column(Date, nullable=False, index=True)
    applicable_region = Column(String(100), default="All India", nullable=False)
    applicable_brands = Column(String(255), default="ALL", nullable=False)
    holiday_type = Column(String(50), default="National", nullable=False) # National, Festival, Optional


class Roster(Base):
    __tablename__ = "rosters"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(Integer, nullable=False) # 1-12
    year = Column(Integer, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    status = Column(String(50), default="Draft", nullable=False)
    # Draft, Generated, Needs Attention, Validated, Published, Archived
    generated_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    generated_by = Column(String(100), default="System", nullable=False)
    validation_status = Column(String(50), default="Needs Review", nullable=False)
    # Valid, Invalid, Needs Review
    published_date = Column(DateTime, nullable=True)
    published_by = Column(String(100), nullable=True)
    pod_id = Column(Integer, nullable=True) # Optional filter if generated for specific pod
    brand_id = Column(Integer, nullable=True) # Optional filter if generated for specific brand

    assignments = relationship("RosterAssignment", back_populates="roster", cascade="all, delete-orphan")
    conflicts = relationship("SchedulingConflict", back_populates="roster", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="roster", cascade="all, delete-orphan")
    versions = relationship("RosterVersion", back_populates="roster", cascade="all, delete-orphan")


class RosterAssignment(Base):
    __tablename__ = "roster_assignments"

    id = Column(Integer, primary_key=True, index=True)
    roster_id = Column(Integer, ForeignKey("rosters.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id", ondelete="SET NULL"), nullable=True)
    process_id = Column(Integer, ForeignKey("processes.id", ondelete="SET NULL"), nullable=True)
    shift_start = Column(String(20), default="09:00", nullable=False)
    shift_end = Column(String(20), default="18:00", nullable=False)
    work_status = Column(String(50), default="Working", nullable=False)
    # Working, Weekly Off, Public Holiday, Leave, Comp-Off, Unavailable
    assignment_source = Column(String(50), default="automatic", nullable=False) # automatic, manual
    notes = Column(Text, nullable=True)

    roster = relationship("Roster", back_populates="assignments")
    employee = relationship("Employee", back_populates="roster_assignments")
    brand = relationship("Brand")
    process = relationship("Process")


class SchedulingConflict(Base):
    __tablename__ = "scheduling_conflicts"

    id = Column(Integer, primary_key=True, index=True)
    roster_id = Column(Integer, ForeignKey("rosters.id", ondelete="CASCADE"), nullable=False)
    severity = Column(String(50), nullable=False) # CRITICAL, WARNING, INFO
    date = Column(Date, nullable=False, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id", ondelete="SET NULL"), nullable=True)
    process_id = Column(Integer, ForeignKey("processes.id", ondelete="SET NULL"), nullable=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    expected_staffing = Column(Integer, default=1, nullable=False)
    actual_staffing = Column(Integer, default=0, nullable=False)
    explanation = Column(Text, nullable=False)
    suggested_resolution = Column(Text, nullable=False)
    resolved = Column(Boolean, default=False, nullable=False)
    resolution_notes = Column(Text, nullable=True)

    roster = relationship("Roster", back_populates="conflicts")
    brand = relationship("Brand")
    process = relationship("Process")
    employee = relationship("Employee")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    roster_id = Column(Integer, ForeignKey("rosters.id", ondelete="CASCADE"), nullable=False)
    employee_id = Column(Integer, nullable=True)
    action = Column(String(100), nullable=False)
    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    modified_by = Column(String(100), default="Operations Manager", nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    reason = Column(Text, nullable=True)

    roster = relationship("Roster", back_populates="audit_logs")


class RosterVersion(Base):
    __tablename__ = "roster_versions"

    id = Column(Integer, primary_key=True, index=True)
    roster_id = Column(Integer, ForeignKey("rosters.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    snapshot_data = Column(Text, nullable=False) # JSON dump of assignments
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String(100), default="System", nullable=False)
    notes = Column(Text, nullable=True)

    roster = relationship("Roster", back_populates="versions")
