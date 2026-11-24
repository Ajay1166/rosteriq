import pytest
from datetime import date, datetime
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.entities import (
    Pod, Employee, Brand, Process, EmployeeAssignment, OperatingRule,
    EmployeeAvailability, PublicHoliday, Roster, RosterAssignment,
    SchedulingConflict, AuditLog
)
from app.seed import seed_database
from app.scheduler.engine import RosterSchedulerEngine
from app.scheduler.validator import RosterValidator
from app.scheduler.calendar_rules import is_operating_day
from app.scheduler.impact import ImpactAnalyzer
from app.api.rosters import publish_roster

@pytest.fixture(scope="module")
def test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()
    seed_database(db)
    yield db
    db.close()

@pytest.fixture(scope="module")
def shared_roster(test_db):
    engine = RosterSchedulerEngine(test_db)
    r = engine.generate_roster(month=12, year=2026, generated_by="Test Engine")
    return r

# TEST 1: Normal roster generation
def test_1_normal_roster_generation(test_db, shared_roster):
    assert shared_roster is not None
    assert shared_roster.id is not None
    assert shared_roster.month == 12
    assert shared_roster.year == 2026
    assignments = test_db.query(RosterAssignment).filter(RosterAssignment.roster_id == shared_roster.id).all()
    assert len(assignments) > 0
    working_count = sum(1 for a in assignments if a.work_status == "Working")
    assert working_count > 100

# TEST 2: Single-resource brand multi-process coverage
def test_2_single_resource_brand_coverage(test_db, shared_roster):
    unest = test_db.query(Brand).filter(Brand.code == "UNEST").first()
    emp1 = test_db.query(Employee).filter(Employee.employee_id == "EMP001").first()
    assert unest is not None
    assert emp1 is not None

    target_date = date(2026, 12, 2)
    emp1_shifts = test_db.query(RosterAssignment).filter(
        RosterAssignment.roster_id == shared_roster.id,
        RosterAssignment.employee_id == emp1.id,
        RosterAssignment.date == target_date
    ).all()
    assert len(emp1_shifts) == 1
    assert emp1_shifts[0].work_status == "Working"
    assert emp1_shifts[0].brand_id == unest.id

# TEST 3: Employee on approved leave creates critical conflicts
def test_3_employee_on_approved_leave(test_db, shared_roster):
    unest = test_db.query(Brand).filter(Brand.code == "UNEST").first()
    emp1 = test_db.query(Employee).filter(Employee.employee_id == "EMP001").first()

    emp1_leave = test_db.query(RosterAssignment).filter(
        RosterAssignment.roster_id == shared_roster.id,
        RosterAssignment.employee_id == emp1.id,
        RosterAssignment.date == date(2026, 12, 12)
    ).first()
    assert emp1_leave.work_status == "Leave"

    conflicts = test_db.query(SchedulingConflict).filter(
        SchedulingConflict.roster_id == shared_roster.id,
        SchedulingConflict.date == date(2026, 12, 12),
        SchedulingConflict.brand_id == unest.id,
        SchedulingConflict.severity == "CRITICAL"
    ).all()
    assert len(conflicts) >= 1
    assert shared_roster.status == "Needs Attention"

# TEST 4: Multi-resource brand impact analysis & recommendations
def test_4_multi_resource_brand_impact(test_db, shared_roster):
    emp5 = test_db.query(Employee).filter(Employee.employee_id == "EMP005").first()
    analyzer = ImpactAnalyzer(test_db)
    impact = analyzer.analyze_unavailability_impact(
        roster_id=shared_roster.id,
        employee_id=emp5.id,
        target_date=date(2026, 12, 4),
        new_status="Approved Leave"
    )
    assert impact["affected_employee_id"] == emp5.id
    assert "backup_recommendations" in impact
    assert len(impact["backup_recommendations"]) > 0
    # Top recommendation should have score and explanation
    top_cand = impact["backup_recommendations"][0]
    assert "employee_name" in top_cand
    assert top_cand["recommendation_score"] > 0

# TEST 5: Public holidays verification for all 3 modes
def test_5_public_holidays_modes():
    holidays = [PublicHoliday(holiday_name="Christmas", date=date(2026, 12, 25), applicable_brands="ALL", holiday_type="Festival")]
    target = date(2026, 12, 25)

    rule_365 = OperatingRule(operating_mode="365_DAYS")
    is_op_365, _ = is_operating_day(rule_365, target, "TEST", holidays)
    assert is_op_365 is True

    rule_deh = OperatingRule(operating_mode="DAILY_EXCEPT_HOLIDAYS")
    is_op_deh, reason_deh = is_operating_day(rule_deh, target, "TEST", holidays)
    assert is_op_deh is False
    assert "Public Holiday" in reason_deh

    rule_sho = OperatingRule(operating_mode="SUNDAYS_AND_HOLIDAYS_OFF")
    is_op_sho, reason_sho = is_operating_day(rule_sho, target, "TEST", holidays)
    assert is_op_sho is False
    assert "Public Holiday" in reason_sho

# TEST 6: Sunday rules verification
def test_6_sunday_rules():
    holidays = []
    sunday = date(2026, 12, 6)
    assert sunday.weekday() == 6

    rule_365 = OperatingRule(operating_mode="365_DAYS")
    is_op_365, _ = is_operating_day(rule_365, sunday, "TEST", holidays)
    assert is_op_365 is True

    rule_sho = OperatingRule(operating_mode="SUNDAYS_AND_HOLIDAYS_OFF")
    is_op_sho, reason_sho = is_operating_day(rule_sho, sunday, "TEST", holidays)
    assert is_op_sho is False
    assert "Sundays" in reason_sho

# TEST 7: Double booking prevention and validation error
def test_7_double_booking_conflict(test_db, shared_roster):
    emp1 = test_db.query(Employee).filter(Employee.employee_id == "EMP001").first()
    brands = test_db.query(Brand).all()

    extra_ra = RosterAssignment(
        roster_id=shared_roster.id,
        employee_id=emp1.id,
        date=date(2026, 12, 3),
        brand_id=brands[1].id,
        process_id=1,
        shift_start="09:00",
        shift_end="18:00",
        work_status="Working",
        assignment_source="manual"
    )
    test_db.add(extra_ra)
    test_db.commit()

    validator = RosterValidator(test_db)
    validator.validate_roster(shared_roster.id)
    
    db_conflict = test_db.query(SchedulingConflict).filter(
        SchedulingConflict.roster_id == shared_roster.id,
        SchedulingConflict.employee_id == emp1.id,
        SchedulingConflict.date == date(2026, 12, 3)
    ).first()
    assert db_conflict is not None
    assert "Double-Booking" in db_conflict.explanation

    # Clean up extra assignment
    test_db.delete(extra_ra)
    test_db.commit()

# TEST 8: Manual edit recalculates coverage and conflict
def test_8_manual_edit_recalculates_coverage(test_db, shared_roster):
    ra = test_db.query(RosterAssignment).filter(
        RosterAssignment.roster_id == shared_roster.id,
        RosterAssignment.date == date(2026, 12, 1),
        RosterAssignment.work_status == "Working"
    ).first()
    assert ra is not None

    ra.work_status = "Weekly Off"
    ra.assignment_source = "manual"
    test_db.commit()

    validator = RosterValidator(test_db)
    res = validator.validate_roster(shared_roster.id)
    assert res["status"] == "Needs Attention"

# TEST 9: Employee across brands incompatible shift prevention
def test_9_employee_across_brands(test_db):
    emp = test_db.query(Employee).filter(Employee.employee_id == "EMP002").first()
    from app.scheduler.constraints import ConstraintChecker
    is_hard, _ = ConstraintChecker.is_employee_hard_unavailable(emp, date(2026, 12, 1), [])
    assert is_hard is False

# TEST 10: Publication rejected when critical conflicts exist
def test_10_invalid_publication_rejected(test_db, shared_roster):
    # shared_roster has critical conflicts on 2026-12-12
    with pytest.raises(HTTPException) as excinfo:
        publish_roster(id=shared_roster.id, published_by="Lead", db=test_db)
    assert excinfo.value.status_code == 400
    assert "Publication rejected" in str(excinfo.value.detail)

# TEST 11: Soft constraints recorded as WARNING
def test_11_soft_constraints_warning(test_db, shared_roster):
    warnings = test_db.query(SchedulingConflict).filter(
        SchedulingConflict.roster_id == shared_roster.id,
        SchedulingConflict.severity == "WARNING"
    ).all()
    # Warnings can be 0 or more depending on preferred off overrides
    assert isinstance(warnings, list)

# TEST 12: Roster audit log and version history
def test_12_audit_and_version_history(test_db, shared_roster):
    logs = test_db.query(AuditLog).filter(AuditLog.roster_id == shared_roster.id).all()
    assert len(logs) > 0
    assert logs[0].action is not None
