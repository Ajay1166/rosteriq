#!/usr/bin/env python3
"""
RosterIQ - Supabase PostgreSQL Connection & Verification Utility

Usage:
    python connect_supabase.py [DATABASE_URL]

Example:
    python connect_supabase.py "postgresql://postgres.xxx:mypassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    OR
    python connect_supabase.py  (reads from backend/.env or environment variable DATABASE_URL)
"""

import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models.entities import Base, Employee, Brand, Process, Pod, EmployeeAssignment
from app.seed import seed_database

def test_and_provision(database_url: str):
    print("=" * 65)
    print("   RosterIQ Supabase Connection & Provisioning Utility")
    print("=" * 65)

    # Normalize url
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    # Mask password for display
    display_url = database_url
    if "@" in display_url and ":" in display_url.split("@")[0]:
        user_part = display_url.split("@")[0]
        prefix = user_part.split("://")[0] + "://"
        creds = user_part.split("://")[1]
        user = creds.split(":")[0]
        host_part = display_url.split("@")[1]
        display_url = f"{prefix}{user}:****@{host_part}"

    print(f"\n[1/4] Connecting to Supabase instance: \n      {display_url}")

    connect_args = {}
    if "sslmode" not in database_url and not database_url.startswith("sqlite"):
        connect_args["sslmode"] = "require"

    try:
        engine = create_engine(
            database_url,
            connect_args=connect_args,
            pool_pre_ping=True
        )
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();")).fetchone()
            print(f"      [OK] Connected successfully!")
            if result:
                print(f"      Database Engine: {result[0][:60]}...")
    except Exception as e:
        print(f"\n[ERROR] Failed to connect to Supabase database:")
        print(f"        {e}")
        print("\nTroubleshooting tips:")
        print("1. Verify your database password in the connection string.")
        print("2. Ensure your Supabase project is active (not paused).")
        print("3. Check if you are using Supabase's direct connection (port 5432) or transaction pooler (port 6543).")
        print("4. Supabase passwords containing special characters (like '@', '#', '%') must be URL-encoded.")
        sys.exit(1)

    print("\n[2/4] Verifying and provisioning database schema...")
    try:
        Base.metadata.create_all(bind=engine)
        print("      [OK] All tables verified and synchronized.")
    except Exception as e:
        print(f"      [ERROR] Failed creating tables: {e}")
        sys.exit(1)

    print("\n[3/4] Checking and seeding enterprise initial data...")
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    try:
        emp_count = session.query(Employee).count()
        if emp_count < 30:
            print("      No data detected or incomplete. Running enterprise seeder...")
            seed_database(session)
            print("      [OK] Database successfully seeded with 30 employees, 25 brands, 5 pods, 7 processes.")
        else:
            print(f"      [OK] Database already initialized with {emp_count} employees.")
    except Exception as e:
        print(f"      [ERROR] Seeding failed: {e}")
        session.rollback()
    finally:
        session.close()

    print("\n[4/4] Final Verification Statistics:")
    session = Session()
    try:
        employees = session.query(Employee).count()
        brands = session.query(Brand).count()
        processes = session.query(Process).count()
        pods = session.query(Pod).count()
        assignments = session.query(EmployeeAssignment).count()
        print(f"      - Employees:    {employees}")
        print(f"      - Brands:       {brands}")
        print(f"      - Processes:    {processes}")
        print(f"      - Pods:         {pods}")
        print(f"      - Allocations:  {assignments}")
        print("\n" + "=" * 65)
        print(" [SUCCESS] Supabase PostgreSQL is fully ready for RosterIQ!")
        print("=" * 65)
    finally:
        session.close()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].strip():
        target_url = sys.argv[1].strip()
    else:
        # Check environment or .env file
        from app.config import settings
        target_url = settings.DATABASE_URL
        if target_url.startswith("sqlite"):
            print("Notice: No DATABASE_URL argument passed and environment defaults to SQLite.")
            print("To test Supabase, provide the connection string:")
            print("  python connect_supabase.py \"postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres\"")
            sys.exit(0)

    test_and_provision(target_url)
