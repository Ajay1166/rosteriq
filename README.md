# RosterIQ – Intelligent Workforce & Operations Management System

> **DATASTRAW Technologies Internship Assessment**  
> **Production-Grade Solution by Full-Stack & Systems Engineering**

---

## 1. Executive Summary

**RosterIQ** is an enterprise-grade, browser-based workforce management and intelligent scheduling operations system built to solve real-world D2C brand operations challenges. Unlike static dashboards or generative prototype mocks, RosterIQ features a **deterministic, constraint-based Python scheduling engine**, an **independent conflict validation module**, and a **Workforce Impact Analyzer** for real-time leave gap resolution.

The application satisfies the **80% single-resource brand staffing constraint** across **25 D2C brands**, **30 active employees**, **5 operational pods**, and **7 configurable workflows**.

---

## 2. Core Architecture & Tech Stack

```text
rosteriq/
│
├── frontend/                     # React 18 + Vite 6 + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── layouts/DashboardLayout.tsx   # Enterprise 12-page dark navy / light canvas layout
│   │   ├── pages/                        # 12 functional operational modules
│   │   │   ├── Overview.tsx              # Live database metrics & charts
│   │   │   ├── RosterPlanner.tsx         # High-density monthly matrix & manual edit modal
│   │   │   ├── Employees.tsx             # Staff directory, skills & profile modal
│   │   │   ├── Brands.tsx                # D2C portfolio & operating calendar rule editor
│   │   │   ├── Processes.tsx             # SLA process definitions & shift durations
│   │   │   ├── Pods.tsx                  # 5 operational squad boards & leads
│   │   │   ├── ResourceAllocation.tsx    # Visual multi-process assignment matrix
│   │   │   ├── Availability.tsx          # Leave governance & manager approvals
│   │   │   ├── Holidays.tsx              # Public holiday regional calendars
│   │   │   ├── CoverageConflicts.tsx     # Brand coverage matrix & conflict resolution
│   │   │   ├── ReportsExports.tsx        # 1-click CSV & printable reports
│   │   │   └── Settings.tsx              # Workforce Impact Analyzer & SPOF Radar
│   │   ├── services/api.ts               # Axios client connecting to FastAPI
│   │   └── types/index.ts                # TypeScript strict interfaces
│   └── package.json
│
├── backend/                      # Python 3.12 + FastAPI + SQLAlchemy 2.0 + SQLite/Postgres
│   ├── app/
│   │   ├── api/                          # REST endpoints (employees, brands, rosters, impact...)
│   │   ├── models/entities.py            # Normalized relational database models
│   │   ├── schemas/schemas.py            # Pydantic validation schemas
│   │   ├── scheduler/
│   │   │   ├── engine.py                 # Deterministic 12-step scheduling solver
│   │   │   ├── validator.py              # Independent roster validator
│   │   │   ├── constraints.py            # Hard & soft constraint checkers
│   │   │   ├── calendar_rules.py         # 365, Daily except holidays, Sunday rules
│   │   │   ├── impact.py                 # Workforce Impact Analyzer & backup ranking
│   │   │   ├── optimizer.py              # Mathematical fairness score (StdDev/Mean)
│   │   │   └── spof.py                   # Single Point of Failure risk detector
│   │   ├── database.py                   # SQLAlchemy engine & session factory
│   │   ├── seed.py                       # Realistic seed data (30 emps, 25 brands, 5 pods)
│   │   └── main.py                       # FastAPI application & CORS
│   ├── tests/test_scenarios.py           # 12 automated backend scenario tests
│   ├── requirements.txt
│   └── .env.example
├── render.yaml                           # Cloud backend deployment
└── README.md                             # Technical blueprint & evaluation answers
```

---

## 3. Database Schema & Relational Design

The system implements a normalized relational schema:

1. **`employees`**: `employee_id`, `full_name`, `email`, `phone`, `status`, `pod_id` (FK), `designation`, `joining_date`, `employment_type`, `max_hours_per_day`, `preferred_weekly_off`, `fixed_weekly_off`, `skills`.
2. **`pods`**: `pod_name`, `pod_lead_name`, `description`, `status`.
3. **`brands`**: `name`, `code`, `industry`, `description`, `status`, `assigned_pod_id` (FK).
4. **`processes`**: `name`, `code` (`CS`, `ACC`, `RET`, `NDR`, `OM`, `RR`, `ESC`), `default_shift_duration`, `status`.
5. **`employee_assignments`**: Many-to-many relationship mapping employees across multiple brands and processes with `assigned_role`, `allocation_percentage`, and `priority`.
6. **`operating_rules`**: Brand-process calendar rules (`operating_mode`: `365_DAYS`, `DAILY_EXCEPT_HOLIDAYS`, `SUNDAYS_AND_HOLIDAYS_OFF`, `CUSTOM`, `working_weekdays`, `min_required_employees`, `shift_start_time`, `shift_end_time`).
7. **`employee_availabilities`**: Tracks `Planned Leave`, `Approved Leave`, `Comp-Off`, `Unavailable`, and `Training` with approval workflows.
8. **`public_holidays`**: Regional holiday calendar (`applicable_brands`: `ALL` or specific codes).
9. **`rosters`**: Month, year, version, status (`Draft`, `Generated`, `Needs Attention`, `Validated`, `Published`).
10. **`roster_assignments`**: Daily shift assignments (`Working`, `Weekly Off`, `Leave`, `Comp-Off`, `Public Holiday`, `Unavailable`).
11. **`scheduling_conflicts`**: Recorded conflicts (`CRITICAL`, `WARNING`, `INFO`), required vs actual staffing, and suggested resolutions.
12. **`audit_logs` & `roster_versions`**: Audit trail of manual modifications and version snapshots.

---

## 4. Deterministic Scheduling Engine

### Hard Constraints (Never Silently Violated)
1. **Approved Leaves & Comp-Offs**: Employees on approved leave or comp-off are never scheduled as working.
2. **Mandatory Fixed Weekly Off**: Strict adherence to contractually fixed off days.
3. **Operating Calendar Rules**: Closed brand processes on Sundays or holidays receive zero staffing.
4. **Minimum Staffing SLA**: Every operating brand-process must meet `min_required_employees`.
5. **Shift Incompatibility**: Employees cannot be double-booked across different brands on the same calendar date.
6. **Eligibility**: Employees can only cover brands and processes they are actively allocated to.

### Soft Constraints (Optimized with Penalties)
1. **Preferred Weekly Off**: Respect employee preferences unless client SLA coverage requires duty.
2. **Fair Workload Distribution**: Associates with fewer shifts in the current monthly window are prioritized.
3. **Pod Proximity**: Backup allocations favor same-pod colleagues.

### Exact Coverage Percentage Formula
$$\text{Coverage Percentage} = \left(\frac{\text{Covered Required Staffing Slots}}{\text{Total Required Staffing Slots}}\right) \times 100$$
*(A process slot is only counted as covered when its minimum staffing requirement is satisfied on an active operating day).*

### Independent Validation Engine
An independent validation module inspects saved roster assignments rather than trusting the generation algorithm. It detects:
- Understaffed operating processes (CRITICAL)
- Double-booking across distinct brands (CRITICAL)
- Scheduled duty during approved leave or comp-off (CRITICAL)
- Fixed weekly off violations (CRITICAL)
- Excessive consecutive working days > 6 (WARNING)
- Overridden preferred weekly off (WARNING)

---

## 5. Unique Product Differentiators

### A. Workforce Impact Analyzer
When an associate (e.g., Rahul Sharma) takes leave, the Impact Analyzer:
1. Calculates process-level gaps before and after.
2. Scans all active employees for availability on that date.
3. Ranks replacement candidates by:
   - Same operational pod (+35 pts)
   - Verified process skill match (+35 pts)
   - Current weekly workload capacity (+4 pts per remaining slot)
   - Off-duty weekly-off status (+30 pts)
4. Displays a real-time **Before vs After vs After-Replacement** comparison.
5. Allows 1-click replacement application, which updates the shift, assigns the backup, and revalidates the entire roster.

### B. Single Point of Failure (SPOF) Risk Radar
Scans all 25 brands to identify single-resource vulnerabilities:
- **HIGH RISK**: 1 dedicated employee managing 2 or more processes (e.g., UrbanNest: CS, ACC, NDR).
- **MEDIUM RISK**: 1 employee managing 1 process without designated redundancy.
- **LOW RISK**: Multi-resource brand with shared coverage (e.g., GlowCart: shared CS).

### C. Workload Fairness & Mathematical Equity Score
$$\text{Workload Balance} = \left(1 - \frac{\sigma}{\mu}\right) \times 100$$
Where $\mu$ is the mean working days per active associate, and $\sigma$ is the standard deviation. A score above 85% indicates equitable rotation.

---

## 6. Answers to the 8 Evaluation Questions

### Question 1: How did you model employees, brands, processes, pods, and their relationships?
**Answer:**  
We designed a normalized relational data model using SQLAlchemy. Rather than coupling employees directly to brands, we introduced the `employee_assignments` junction table. This many-to-many relationship allows:
- An employee to be allocated across multiple brands and processes with configurable allocation percentages (e.g., 50% CS on GlowCart, 50% ACC on GlowCart).
- A single employee to manage all processes of a brand (the 80% single-resource structure).
- Multiple employees to share a single process (e.g., EMP005 and EMP006 sharing Customer Support on GlowCart).
- Each employee belongs to an operational pod (`pods` table), facilitating pod-lead ownership, escalation routing, and localized backup coverage.

### Question 2: How does your system generate a roster and determine whether it satisfies the required constraints?
**Answer:**  
The system uses a 12-step deterministic solver (`RosterSchedulerEngine`):
1. For every date in the month, it determines whether each brand-process operates by evaluating its `OperatingRule` against the calendar date, Sunday flags, and `PublicHoliday` records.
2. It aggregates eligible candidates from `employee_assignments`, filtering out any associate with approved leave, comp-off, training, or fixed weekly off.
3. Candidates are ranked using a multi-factor score: assignment priority + workload penalty + preferred-off penalty.
4. For single-resource brands, assigning an associate covers all assigned processes under that brand for that shift without duplicating headcount.
5. After generation, an **independent validator** (`RosterValidator`) inspects the stored records. It calculates total required slots versus covered slots to derive the exact Coverage Percentage. If any critical gap or hard constraint violation exists, the roster status is locked to `Needs Attention` (`validation_status = 'Invalid'`), prohibiting publication until resolved.

### Question 3: How did you handle single-resource and multiple-resource brands?
**Answer:**  
In our seed data and scheduling logic:
- **Single-Resource Brands (20 out of 25 brands = 80%)**: A dedicated employee (e.g., Rahul Sharma for UrbanNest) is mapped to CS, ACC, and NDR. During generation, scheduling Rahul on an operating day simultaneously covers all three processes for UrbanNest during his 09:00–18:00 shift. Rahul is counted only once in company-wide headcount, but satisfies coverage for all three processes.
- **Multiple-Resource Brands (5 out of 25 brands = 20%)**: Brands like GlowCart, PureAura, and PeakFitness have 2 to 3 employees assigned with split responsibilities. For example, on GlowCart, EMP005 and EMP006 both have shared 50% allocations to Customer Support, while EMP005 handles ACC and EMP006 handles NDR.

### Question 4: What happens when an employee managing all processes for a brand becomes unavailable?
**Answer:**  
When an associate managing all processes takes approved leave (demonstrated in Test 3 with EMP001 on 12 December):
1. The scheduler marks the employee's daily shift as `Leave` rather than `Working`.
2. Because UrbanNest has no other assigned resources, all three operating processes (CS, ACC, NDR) fail their minimum staffing SLA of 1.
3. The validation engine records 3 distinct **CRITICAL Coverage Gap Conflicts**.
4. The roster status flips to `Needs Attention` (`Invalid`).
5. In the **Workforce Impact Analyzer**, the manager can inspect the incident: the system displays the 3 affected processes, computes the coverage drop (from 100% to 88%), and ranks available backup candidates from the same operational pod. With one click, the manager selects the recommended candidate, applies the replacement, and the system revalidates the roster back to `Validated`.

### Question 5: How does the system handle conflicting requirements or insufficient staffing?
**Answer:**  
The engine strictly differentiates **Hard Constraints** from **Soft Constraints**:
- **Hard Constraints** (leaves, fixed weekly off, client operating calendars, shift overlaps) are non-negotiable. If insufficient staff exists, the engine *never* silently violates a leave or creates an impossible double-booking. Instead, it generates a `CRITICAL` conflict with date, brand, process, expected vs actual staffing, and resolution guidance.
- **Soft Constraints** (preferred weekly off, workload balance) can be overridden when client coverage demands it. When an associate is scheduled on their preferred weekly off to prevent an operating gap, the engine logs a `WARNING` conflict, maintaining client SLA while notifying leadership of the preference compromise.

### Question 6: Which parts are automated and which are under human control?
**Answer:**  
- **Automated**:
  - Daily operating calendar evaluation (mode, Sunday rules, holiday exclusions).
  - Constraint filtering and candidate scoring.
  - Multi-process shift synchronization for single-resource brands.
  - Independent post-generation validation and gap identification.
  - Candidate backup recommendation scoring.
  - Workload balance and fairness computation.
- **Under Human Control**:
  - Leave and comp-off approval/rejection workflows.
  - Creation and editing of operating rules and staffing thresholds.
  - Cell-level manual shift modifications with mandatory audit justification.
  - Acceptance or rejection of backup replacement proposals.
  - Final publication approval (strictly gated by zero unresolved critical conflicts).

### Question 7: If the company doubled its team and brand count, what would you change?
**Answer:**  
If scaling from 30 to 60+ employees and 25 to 50+ brands:
1. **Database Indexing & Partitioning**: Add composite indices on `(roster_id, date, employee_id)` and `(roster_id, brand_id, process_id)`. Partition `roster_assignments` by year and month.
2. **Asynchronous Background Processing**: Migrate generation and impact simulations from synchronous request threads to Celery or Redis Queue (RQ) with Redis caching.
3. **Integer Linear Programming (ILP) Solver**: Complement the greedy deterministic heuristic with PuLP / OR-Tools for global mathematical optimization of fairness scores across large employee sets.
4. **Read Replicas**: Separate operational reads (high-density calendar rendering) from transactional schedule mutations.

### Question 8: If you had one additional week, what would you improve first?
**Answer:**  
1. **Interactive Drag-and-Drop Shift Swapping**: Visual drag-and-drop between associates with live client-side constraint previews.
2. **Automated WhatsApp / Email Shift Notifications**: Direct integration with Twilio/SendGrid to alert employees of published monthly rosters and swap requests.
3. **Multi-Tier Role-Based Access Control (RBAC)**: Distinct permissions for Pod Leads (approve pod leaves), Operations Managers (publish rosters), and Associates (view own schedule and submit leave).
4. **Historical Shift Swap Auditing**: Version comparison diff highlighting added, removed, and swapped shifts between draft revisions.

---

## 7. Verification & Automated Test Suite

The backend contains 12 automated scenario tests in `backend/tests/test_scenarios.py` fulfilling all Part 19 specifications:

```bash
cd backend
python -m pytest --rootdir . tests/test_scenarios.py -v
```

### Test Results Summary
- `test_1_normal_roster_generation`: Verified 30 employees, monthly assignments created. (PASSED)
- `test_2_single_resource_brand_coverage`: UrbanNest multi-process coverage by sole associate without shift duplicate. (PASSED)
- `test_3_employee_on_approved_leave`: Critical conflict generated when sole resource takes leave; status set to Needs Attention. (PASSED)
- `test_4_multi_resource_brand_impact`: Impact analyzer recalculates gaps and ranks backup candidates with scores. (PASSED)
- `test_5_public_holidays_modes`: 365_DAYS operates; DAILY_EXCEPT_HOLIDAYS & SUNDAYS_AND_HOLIDAYS_OFF close on holiday. (PASSED)
- `test_6_sunday_rules`: 365_DAYS operates on Sunday; SUNDAYS_AND_HOLIDAYS_OFF closes on Sunday. (PASSED)
- `test_7_double_booking_conflict`: Overlapping assignments across brands trigger CRITICAL double-booking conflict. (PASSED)
- `test_8_manual_edit_recalculates_coverage`: Manual edit to Weekly Off creates gap and revalidates status. (PASSED)
- `test_9_employee_across_brands`: Incompatible overlapping shifts prevented. (PASSED)
- `test_10_invalid_publication_rejected`: Publication with critical conflicts rejected with HTTP 400. (PASSED)
- `test_11_soft_constraints_warning`: Preferred weekly off override recorded as WARNING. (PASSED)
- `test_12_audit_and_version_history`: Full audit trail preserved on modifications. (PASSED)

**All 12 backend scenario tests pass with 100% success.**

---

## 8. Local Setup & Execution Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### Backend Setup
```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Run database seed (creates 30 employees, 25 brands, 5 pods, calendar rules)
python -m app.seed

# Start FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Backend will be live at `http://127.0.0.1:8000` with Swagger docs at `http://127.0.0.1:8000/docs`.

### Frontend Setup
```bash
# In a new terminal, navigate to frontend
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 9. Production Deployment Configuration

### 1. Database (Supabase PostgreSQL)
1. Create a new Supabase project.
2. In Project Settings > Database, copy the Connection String URI.
3. In `backend/.env`, set:
   ```env
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
4. Run `python -m app.seed` to initialize the schema and populate seed data.

### 2. Backend (Render)
1. Link your GitHub repository to Render.
2. Create a new **Web Service** using `render.yaml` or manual configuration:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variable**: `DATABASE_URL` set to your Supabase PostgreSQL URI.
3. Health check path: `/health`.

### 3. Frontend (Vercel)
1. Import repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Set **Framework Preset** to `Vite`.
4. Environment variable:
   ```env
   VITE_API_URL=https://your-backend-service.onrender.com/api
   ```
5. Deploy. SPA routing is managed via `frontend/vercel.json`.

---

## 10. Quality Checklist Verification

- [x] 30 employees seeded across 5 operational pods (6 per pod).
- [x] 25 brands seeded (20 dedicated single-resource, 5 multi-resource = 80% distribution).
- [x] 7 configurable processes (CS, ACC, Retention, NDR, Order Mgmt, Returns, Escalations).
- [x] Shared process assignments demonstrated (GlowCart shared CS).
- [x] Operating calendars configured (365 Days, Daily except holidays, Sundays & holidays off).
- [x] Public holiday and Sunday rules enforced.
- [x] Planned and approved leaves, comp-offs enforced as hard constraints.
- [x] Deterministic monthly roster generation.
- [x] Company, Pod, Brand, Process, and Employee matrix views.
- [x] Independent conflict validation engine with Critical, Warning, Info severities.
- [x] Manual roster cell editing with audit logging.
- [x] Workforce Impact Analyzer with ranked candidate scoring.
- [x] Single Point of Failure (SPOF) Risk Radar.
- [x] Mathematical workload fairness score ($1 - \frac{\sigma}{\mu}$).
- [x] Publication approval gated by critical conflicts.
- [x] CSV and printer exports.
- [x] 12 automated backend scenario tests passing.
- [x] Production deployment configuration and environment examples.
