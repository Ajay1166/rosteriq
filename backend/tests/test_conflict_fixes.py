import pytest
from datetime import date, datetime
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.entities import (
    Pod, Employee, Brand, Process, EmployeeAssignment, OperatingRule,
    EmployeeAvailability, PublicHoliday, Roster, RosterAssignment,
    SchedulingConflict, AuditLog, RosterVersion
)
from app.seed import seed_database
from app.scheduler.engine import RosterSchedulerEngine
from app.scheduler.validator import RosterValidator
from app.api.rosters import (
    publish_roster, clear_roster_conflicts, reset_draft_roster,
    regenerate_roster, get_roster_conflicts
)
from app.api.analytics import get_dashboard_analytics

@pytest.fixture(scope="module")
def test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()
    seed_database(db)
    yield db
    db.close()

# SCENARIO 1: Running validation three times does not create duplicate conflicts
def test_validation_idempotency_no_duplicates(test_db):
    engine = RosterSchedulerEngine(test_db)
    roster = engine.generate_roster(month=12, year=2026, generated_by="Test Engine")
    validator = RosterValidator(test_db)

    # First validation run
    res1 = validator.validate_roster(roster.id)
    count1 = test_db.query(SchedulingConflict).filter(SchedulingConflict.roster_id == roster.id).count()

    # Second validation run
    res2 = validator.validate_roster(roster.id)
    count2 = test_db.query(SchedulingConflict).filter(SchedulingConflict.roster_id == roster.id).count()

    # Third validation run
    res3 = validator.validate_roster(roster.id)
    count3 = test_db.query(SchedulingConflict).filter(SchedulingConflict.roster_id == roster.id).count()

    assert count1 == count2 == count3, f"Validation is not idempotent: counts were {count1}, {count2}, {count3}"
    assert res1["critical_conflicts"] == res2["critical_conflicts"] == res3["critical_conflicts"]
    assert res1["warnings_count"] == res2["warnings_count"] == res3["warnings_count"]

# SCENARIO 2: Artificial ~3,100 conflicts are eliminated
def test_no_artificial_coverage_gaps(test_db):
    # Retrieve the roster
    roster = test_db.query(Roster).filter(Roster.month == 12, Roster.year == 2026).order_by(Roster.version.desc()).first()
    assert roster is not None

    conflicts = test_db.query(SchedulingConflict).filter(SchedulingConflict.roster_id == roster.id).all()
    # The artificial 3,100 unstaffed coverage gap conflicts are eliminated
    assert len(conflicts) < 1000, f"Found excessive conflicts ({len(conflicts)}), artificial rules are still firing!"

    # Verify no coverage gap for unstaffed processes that brands don't operate
    om_proc = test_db.query(Process).filter(Process.code == "OM").first()
    if om_proc:
        om_conflicts = [c for c in conflicts if c.process_id == om_proc.id]
        assert len(om_conflicts) == 0, "Unconfigured Order Management process should not produce artificial coverage gaps"

# SCENARIO 3: Clearing validation results does not delete actual roster data or core entities
def test_clear_validation_results_preserves_data(test_db):
    engine = RosterSchedulerEngine(test_db)
    roster = engine.generate_roster(month=11, year=2026, generated_by="Test Clear")

    initial_assignments = test_db.query(RosterAssignment).filter(RosterAssignment.roster_id == roster.id).count()
    initial_employees = test_db.query(Employee).count()
    initial_brands = test_db.query(Brand).count()
    assert initial_assignments > 0

    # Call clear_roster_conflicts
    res = clear_roster_conflicts(roster.id, db=test_db)
    assert res["success"] is True

    # Conflicts should be cleared
    unresolved_conflicts = test_db.query(SchedulingConflict).filter(
        SchedulingConflict.roster_id == roster.id,
        SchedulingConflict.resolved == False
    ).count()
    assert unresolved_conflicts == 0

    # Assignments and core data must be 100% intact
    remaining_assignments = test_db.query(RosterAssignment).filter(RosterAssignment.roster_id == roster.id).count()
    assert remaining_assignments == initial_assignments
    assert test_db.query(Employee).count() == initial_employees
    assert test_db.query(Brand).count() == initial_brands

# SCENARIO 4: Resetting a draft does not delete published history & published rosters cannot be reset
def test_reset_draft_preserves_published_history(test_db):
    engine = RosterSchedulerEngine(test_db)
    pub_roster = engine.generate_roster(month=10, year=2026, generated_by="Test Pub")

    # Manually mark all critical conflicts as resolved to allow publishing
    conflicts = test_db.query(SchedulingConflict).filter(
        SchedulingConflict.roster_id == pub_roster.id,
        SchedulingConflict.severity == "CRITICAL"
    ).all()
    for c in conflicts:
        c.resolved = True
        c.resolution_notes = "Approved by management"
    test_db.commit()

    # Publish it
    publish_roster(pub_roster.id, published_by="Test Admin", db=test_db)
    assert pub_roster.status == "Published"

    # Attempting to reset a published roster must raise HTTPException 400
    with pytest.raises(HTTPException) as excinfo:
        reset_draft_roster(pub_roster.id, db=test_db)
    assert excinfo.value.status_code == 400

    # Published assignments must remain
    pub_assignments = test_db.query(RosterAssignment).filter(RosterAssignment.roster_id == pub_roster.id).count()
    assert pub_assignments > 0

# SCENARIO 5: Roster with hard conflicts cannot be published
def test_hard_conflicts_block_publishing(test_db):
    engine = RosterSchedulerEngine(test_db)
    draft_roster = engine.generate_roster(month=9, year=2026, generated_by="Test Gate")

    # Inject an unresolved hard critical conflict
    cur_date = date(2026, 9, 15)
    b = test_db.query(Brand).first()
    p = test_db.query(Process).first()
    test_db.add(SchedulingConflict(
        roster_id=draft_roster.id,
        severity="CRITICAL",
        date=cur_date,
        brand_id=b.id,
        process_id=p.id,
        expected_staffing=2,
        actual_staffing=0,
        explanation="Unresolved hard coverage gap",
        suggested_resolution="Assign backup",
        resolved=False
    ))
    test_db.commit()

    # Publication must be rejected with 400
    with pytest.raises(HTTPException) as excinfo:
        publish_roster(draft_roster.id, published_by="Operations Lead", db=test_db)
    assert excinfo.value.status_code == 400
    assert "Publication rejected" in str(excinfo.value.detail)

# SCENARIO 6: Clean, fully validated roster can be published and creates RosterVersion
def test_clean_roster_publishes_and_creates_version(test_db):
    engine = RosterSchedulerEngine(test_db)
    clean_roster = engine.generate_roster(month=8, year=2026, generated_by="Clean Test")

    # Resolve all critical conflicts with management approval
    conflicts = test_db.query(SchedulingConflict).filter(
        SchedulingConflict.roster_id == clean_roster.id,
        SchedulingConflict.severity == "CRITICAL"
    ).all()
    for c in conflicts:
        c.resolved = True
        c.resolution_notes = "Approved by operations lead"
    test_db.commit()

    # Publish
    res = publish_roster(clean_roster.id, published_by="Operations Lead", db=test_db)
    assert res.status == "Published"

    # Verify RosterVersion snapshot was created
    version_snapshot = test_db.query(RosterVersion).filter(RosterVersion.roster_id == clean_roster.id).first()
    assert version_snapshot is not None
    assert version_snapshot.version == clean_roster.version
    assert len(version_snapshot.snapshot_data) > 0

# SCENARIO 7: Dashboard conflict counts match actual conflict records
def test_dashboard_conflict_counts_match(test_db):
    dash = get_dashboard_analytics(db=test_db)
    latest_r = test_db.query(Roster).order_by(Roster.generated_date.desc()).first()
    assert latest_r is not None

    actual_critical = test_db.query(SchedulingConflict).filter(
        SchedulingConflict.roster_id == latest_r.id,
        SchedulingConflict.severity == "CRITICAL",
        SchedulingConflict.resolved == False
    ).count()

    assert dash["metrics"]["open_critical_conflicts"] == actual_critical

# SCENARIO 8: Old roster conflicts do not appear in a new roster version
def test_old_roster_conflicts_isolated_by_version(test_db):
    engine = RosterSchedulerEngine(test_db)
    r_v1 = engine.generate_roster(month=7, year=2026, generated_by="v1")
    r_v2 = engine.generate_roster(month=7, year=2026, generated_by="v2")

    assert r_v2.version == r_v1.version + 1

    # Filter conflicts for r_v2
    v2_conflicts = get_roster_conflicts(id=r_v2.id, db=test_db)
    for c in v2_conflicts:
        assert c.roster_id == r_v2.id
        assert c.roster_id != r_v1.id
