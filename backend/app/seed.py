import random
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app.models.entities import (
    Pod, Employee, Brand, Process, EmployeeAssignment,
    OperatingRule, EmployeeAvailability, PublicHoliday
)

def seed_database(db: Session = None):
    close_db = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_db = True

    try:
        # Check if already seeded
        if db.query(Employee).count() >= 30:
            print("Database already has 30+ employees. Skipping seed.")
            return

        print("Seeding database with realistic D2C enterprise data...")

        # 1. 5 Operational Pods with 5 Leads
        pod_data = [
            ("Alpha Falcon", "Aarav Sharma", "High-growth lifestyle & apparel brands pod"),
            ("Beta Phoenix", "Pooja Patel", "Beauty, personal care & skincare brands pod"),
            ("Gamma Titan", "Vikram Malhotra", "Health, fitness, supplements & wellness pod"),
            ("Delta Orion", "Neha Gupta", "Home decor, furnishings & smart living pod"),
            ("Omega Apex", "Rohan Verma", "Consumer tech, accessories & food brands pod")
        ]
        pods = []
        for name, lead, desc in pod_data:
            pod = db.query(Pod).filter(Pod.pod_name == name).first()
            if not pod:
                pod = Pod(pod_name=name, pod_lead_name=lead, description=desc, status="Active")
                db.add(pod)
                db.flush()
            pods.append(pod)

        # 2. 7 Configurable Processes
        process_defs = [
            ("Customer Support (CS)", "CS", "Inbound customer ticketing, chat, and voice support", 8.0),
            ("Abandoned Cart Conversion (ACC)", "ACC", "Proactive conversion of checkout drop-offs via WhatsApp and calls", 8.0),
            ("Retention & Loyalty", "RET", "Customer lifetime value optimization and repeat order campaigns", 8.0),
            ("Non-Delivery Report (NDR)", "NDR", "Real-time delivery exception verification and reattempt resolution", 8.0),
            ("Order Management", "OM", "Order verification, address validation, and dispatch synchronization", 8.0),
            ("Returns & Refunds", "RR", "Reverse logistics authorization and refund processing", 8.0),
            ("Escalations & Quality", "ESC", "High-priority customer grievances and agent quality auditing", 8.0)
        ]
        processes = []
        for name, code, desc, duration in process_defs:
            proc = db.query(Process).filter(Process.code == code).first()
            if not proc:
                proc = Process(name=name, code=code, description=desc, default_shift_duration=duration, status="Active")
                db.add(proc)
                db.flush()
            processes.append(proc)

        # 3. 30 Employees across 5 Pods (6 per pod)
        # Realistic Indian names with varying designations, weekly-offs, skills
        employee_records = [
            # Pod 1: Alpha Falcon (6)
            ("EMP001", "Rahul Sharma", "rahul.sharma@datastraw.io", "+91 98201 11001", "Senior Support Specialist", 0, 6, None, "Customer Support, Escalations, ACC"),
            ("EMP002", "Ananya Iyer", "ananya.iyer@datastraw.io", "+91 98201 11002", "Operations Associate", 0, 6, None, "Customer Support, Order Management"),
            ("EMP003", "Karan Kapoor", "karan.kapoor@datastraw.io", "+91 98201 11003", "Retention Specialist", 0, 5, None, "Retention, ACC, Customer Support"),
            ("EMP004", "Simran Kaur", "simran.kaur@datastraw.io", "+91 98201 11004", "Logistics Associate", 0, 6, 6, "NDR, Returns & Refunds"), # Fixed Sunday off
            ("EMP005", "Aditya Nair", "aditya.nair@datastraw.io", "+91 98201 11005", "Customer Support Associate", 0, 0, None, "Customer Support, ACC"), # Preferred Monday off
            ("EMP006", "Sneha Joshi", "sneha.joshi@datastraw.io", "+91 98201 11006", "Support Specialist", 0, 5, None, "Customer Support, NDR"),

            # Pod 2: Beta Phoenix (6)
            ("EMP007", "Riya Sen", "riya.sen@datastraw.io", "+91 98201 11007", "Senior Support Specialist", 1, 6, None, "Customer Support, Returns & Refunds"),
            ("EMP008", "Manish Tiwari", "manish.tiwari@datastraw.io", "+91 98201 11008", "E-commerce Associate", 1, 6, None, "ACC, Order Management, CS"),
            ("EMP009", "Priyanka Das", "priyanka.das@datastraw.io", "+91 98201 11009", "Customer Support Associate", 1, 5, None, "Customer Support, Retention"),
            ("EMP010", "Varun Mehta", "varun.mehta@datastraw.io", "+91 98201 11010", "Logistics Specialist", 1, 6, 6, "NDR, Order Management"), # Fixed Sunday off
            ("EMP011", "Divya Menon", "divya.menon@datastraw.io", "+91 98201 11011", "Retention Associate", 1, 1, None, "Retention, ACC"), # Preferred Tuesday off
            ("EMP012", "Amitabh Saxena", "amitabh.saxena@datastraw.io", "+91 98201 11012", "Operations Specialist", 1, 6, None, "Customer Support, NDR, RR"),

            # Pod 3: Gamma Titan (6)
            ("EMP013", "Rajesh Pillai", "rajesh.pillai@datastraw.io", "+91 98201 11013", "Customer Support Lead", 2, 6, None, "Customer Support, Escalations"),
            ("EMP014", "Deepika Rao", "deepika.rao@datastraw.io", "+91 98201 11014", "Conversion Associate", 2, 5, None, "ACC, Retention, Customer Support"),
            ("EMP015", "Nikhil Kulkarni", "nikhil.kulkarni@datastraw.io", "+91 98201 11015", "Support Specialist", 2, 6, None, "Customer Support, Order Management"),
            ("EMP016", "Tanvi Bhatia", "tanvi.bhatia@datastraw.io", "+91 98201 11016", "Logistics Specialist", 2, 6, 6, "NDR, Returns & Refunds"),
            ("EMP017", "Gaurav Chopra", "gaurav.chopra@datastraw.io", "+91 98201 11017", "Customer Support Associate", 2, 2, None, "Customer Support, ACC"), # Preferred Wednesday off
            ("EMP018", "Meera Nambiar", "meera.nambiar@datastraw.io", "+91 98201 11018", "Operations Associate", 2, 6, None, "Returns & Refunds, CS"),

            # Pod 4: Delta Orion (6)
            ("EMP019", "Arjun Reddy", "arjun.reddy@datastraw.io", "+91 98201 11019", "Senior Support Specialist", 3, 6, None, "Customer Support, Escalations, NDR"),
            ("EMP020", "Kavita Singhania", "kavita.singhania@datastraw.io", "+91 98201 11020", "Conversion Specialist", 3, 5, None, "ACC, Retention, CS"),
            ("EMP021", "Siddharth Jain", "siddharth.jain@datastraw.io", "+91 98201 11021", "Customer Support Associate", 3, 6, None, "Customer Support, Order Management"),
            ("EMP022", "Pallavi Deshmukh", "pallavi.deshmukh@datastraw.io", "+91 98201 11022", "Operations Specialist", 3, 6, 6, "NDR, Returns & Refunds"),
            ("EMP023", "Harsh Vardhan", "harsh.vardhan@datastraw.io", "+91 98201 11023", "Customer Support Associate", 3, 3, None, "Customer Support, ACC"), # Preferred Thursday off
            ("EMP024", "Shalini Bose", "shalini.bose@datastraw.io", "+91 98201 11024", "Support Specialist", 3, 6, None, "Customer Support, NDR"),

            # Pod 5: Omega Apex (6)
            ("EMP025", "Ishaan Trivedi", "ishaan.trivedi@datastraw.io", "+91 98201 11025", "Operations Lead Specialist", 4, 6, None, "Customer Support, Escalations, OM"),
            ("EMP026", "Aakanksha Roy", "aakanksha.roy@datastraw.io", "+91 98201 11026", "Conversion Associate", 4, 5, None, "ACC, Retention, CS"),
            ("EMP027", "Pranav Hegde", "pranav.hegde@datastraw.io", "+91 98201 11027", "Customer Support Associate", 4, 6, None, "Customer Support, Order Management"),
            ("EMP028", "Swati Chawla", "swati.chawla@datastraw.io", "+91 98201 11028", "Logistics Associate", 4, 6, 6, "NDR, Returns & Refunds"),
            ("EMP029", "Kunal Agarwal", "kunal.agarwal@datastraw.io", "+91 98201 11029", "Support Specialist", 4, 4, None, "Customer Support, ACC"), # Preferred Friday off
            ("EMP030", "Zoya Farooqui", "zoya.farooqui@datastraw.io", "+91 98201 11030", "Senior Customer Support", 4, 6, None, "Customer Support, Escalations, CS")
        ]

        employees = []
        for emp_id, name, email, phone, desig, pod_idx, pref_off, fix_off, skills in employee_records:
            emp = db.query(Employee).filter(Employee.employee_id == emp_id).first()
            if not emp:
                emp = Employee(
                    employee_id=emp_id,
                    full_name=name,
                    email=email,
                    phone=phone,
                    status="Active",
                    pod_id=pods[pod_idx].id,
                    designation=desig,
                    joining_date=date(2025, 1, 15),
                    employment_type="Full-Time",
                    max_hours_per_day=8.0,
                    preferred_weekly_off=pref_off,
                    fixed_weekly_off=fix_off,
                    skills=skills
                )
                db.add(emp)
                db.flush()
            employees.append(emp)

        # 4. 25 Brands (20 Single-Resource Brands, 5 Multi-Resource Brands)
        # Achieving exactly 80% single-resource brand distribution as mandated by Part 3.
        brand_defs = [
            # 20 Single-Resource Brands (Dedicated 1 employee managing all processes)
            ("UrbanNest", "UNEST", "Home & Furniture", "Modern minimalist home furnishings", 0), # Dedicated to EMP001
            ("TrendHive", "THIVE", "Fashion & Apparel", "Gen-Z fast fashion and streetwear", 0), # EMP002
            ("FitFuel", "FFUEL", "Health & Nutrition", "Clean whey protein and workout supplements", 0), # EMP003
            ("HomeLoom", "HLOOM", "Home Textiles", "Handcrafted artisanal bed linens and curtains", 0), # EMP004
            ("DailyDose", "DDOSE", "Beverages & Tea", "Cold-pressed juices and organic herbal teas", 1), # EMP007
            ("StyleSprint", "SSPRNT", "Footwear", "High-performance ergonomic running sneakers", 1), # EMP008
            ("NutriBasket", "NBASK", "Organic Groceries", "Farm-fresh organic pantry essentials", 1), # EMP009
            ("LuxeLiving", "LUXLIV", "Luxury Decor", "Premium brass and ceramic homeware", 1), # EMP010
            ("AuraGleam", "AGLEAM", "Cosmetics", "Cruelty-free botanical beauty essentials", 2), # EMP013
            ("VitalBites", "VBITES", "Snacks & Nutrition", "Millet-based guilt-free baked snacks", 2), # EMP014
            ("ChicThreads", "CTHRD", "Apparel", "Sustainable organic cotton everyday wear", 2), # EMP015
            ("ZenSpace", "ZENSP", "Wellness & Aromas", "Soy candles and essential oil diffusers", 2), # EMP016
            ("BrewCraft", "BCRAFT", "Specialty Coffee", "Single-origin artisanal roast coffees", 3), # EMP019
            ("VelvetSkin", "VSKIN", "Dermatology Care", "Active ingredient skincare serums", 3), # EMP020
            ("TerraGreens", "TGREEN", "Indoor Plants", "Curated air-purifying indoor plants", 3), # EMP021
            ("OptiVision", "OPTIV", "Eyewear", "Blue-light blocking designer eyewear", 3), # EMP022
            ("AudioBlitz", "ABLITZ", "Consumer Electronics", "True wireless noise-cancelling earbuds", 4), # EMP025
            ("SilkCrest", "SCREST", "Premium Silkwear", "Mulberry silk pillowcases and sleepwear", 4), # EMP026
            ("ByteBites", "BBITE", "Energy Bars", "Clean plant-protein energy nutrition bars", 4), # EMP027
            ("PetParadise", "PPARA", "Pet Care", "Holistic grain-free pet food & toys", 4), # EMP028

            # 5 Multi-Resource Brands (2 to 3 employees sharing processes)
            ("GlowCart", "GCART", "Beauty & Personal Care", "Multi-brand prestige skincare and haircare", 0), # EMP005 & EMP006 (shared CS)
            ("PureAura", "PAURA", "Ayurvedic Wellness", "Authentic Ayurvedic elixirs and oils", 1), # EMP011 & EMP012
            ("PeakFitness", "PFIT", "Fitness Equipment", "Smart resistance bands and gym accessories", 2), # EMP017 & EMP018
            ("UrbanCraze", "UCRAZ", "Streetwear & Merch", "Graphic hoodies and oversized tees", 3), # EMP023 & EMP024
            ("NeoKitchen", "NEOKIT", "Smart Kitchenware", "Cast-iron cookware and smart blenders", 4) # EMP029 & EMP030
        ]

        brands = []
        for name, code, ind, desc, pod_idx in brand_defs:
            b = db.query(Brand).filter(Brand.code == code).first()
            if not b:
                b = Brand(
                    name=name,
                    code=code,
                    industry=ind,
                    description=desc,
                    status="Active",
                    assigned_pod_id=pods[pod_idx].id
                )
                db.add(b)
                db.flush()
            brands.append(b)

        # 5. Configurable Operating Rules
        # Mix of: 365_DAYS, DAILY_EXCEPT_HOLIDAYS, SUNDAYS_AND_HOLIDAYS_OFF, and CUSTOM
        # Single-resource brands have 3 processes each (e.g. CS, ACC, NDR)
        cs_proc = processes[0]  # CS
        acc_proc = processes[1] # ACC
        ndr_proc = processes[2] # Retention / NDR
        om_proc = processes[4]  # Order Management
        rr_proc = processes[5]  # Returns & Refunds

        operating_modes = ["365_DAYS", "DAILY_EXCEPT_HOLIDAYS", "SUNDAYS_AND_HOLIDAYS_OFF", "365_DAYS"]

        for idx, b in enumerate(brands):
            mode = operating_modes[idx % len(operating_modes)]
            # Assign rules for CS, ACC, NDR for this brand
            for p_idx, proc in enumerate([cs_proc, acc_proc, processes[3]]):
                # If UrbanNest, let's make CS 365_DAYS, ACC DAILY_EXCEPT_HOLIDAYS, NDR SUNDAYS_AND_HOLIDAYS_OFF to demonstrate process-specific overrides!
                proc_mode = mode
                if b.code == "UNEST":
                    if proc.code == "CS": proc_mode = "365_DAYS"
                    elif proc.code == "ACC": proc_mode = "DAILY_EXCEPT_HOLIDAYS"
                    elif proc.code == "NDR": proc_mode = "SUNDAYS_AND_HOLIDAYS_OFF"

                rule = db.query(OperatingRule).filter(
                    OperatingRule.brand_id == b.id,
                    OperatingRule.process_id == proc.id
                ).first()
                if not rule:
                    is_sunday = (proc_mode in ["365_DAYS", "DAILY_EXCEPT_HOLIDAYS"])
                    is_holiday = (proc_mode == "365_DAYS")
                    rule = OperatingRule(
                        brand_id=b.id,
                        process_id=proc.id,
                        operating_mode=proc_mode,
                        working_weekdays="0,1,2,3,4,5,6" if is_sunday else "0,1,2,3,4,5",
                        sunday_operation=is_sunday,
                        public_holiday_operation=is_holiday,
                        min_required_employees=1,
                        max_required_employees=2,
                        shift_start_time="09:00",
                        shift_end_time="18:00",
                        effective_date=date(2025, 1, 1)
                    )
                    db.add(rule)

        # 6. Employee Assignments (Many-to-Many)
        # Dedicated 20 single-resource brands:
        # EMP001 -> UrbanNest (CS, ACC, NDR)
        # EMP002 -> TrendHive (CS, ACC, NDR)
        # ...
        # EMP028 -> PetParadise
        # Multi-resource 5 brands:
        # GlowCart -> EMP005 & EMP006 share CS, EMP005 handles ACC, EMP006 handles NDR!
        # PureAura -> EMP011 & EMP012 share CS, EMP011 handles ACC, EMP012 handles NDR!
        # PeakFitness -> EMP017 & EMP018 share CS, EMP017 handles ACC, EMP018 handles NDR!
        # UrbanCraze -> EMP023 & EMP024 share CS, EMP023 handles ACC, EMP024 handles NDR!
        # NeoKitchen -> EMP029 & EMP030 share CS, EMP029 handles ACC, EMP030 handles NDR!

        # Single-resource mapping:
        single_resource_brands = brands[:20]
        # Use employees: 0, 1, 2, 3,  6, 7, 8, 9,  12, 13, 14, 15,  18, 19, 20, 21,  24, 25, 26, 27
        single_emp_indices = [
            0, 1, 2, 3,        # Pod 1: EMP001-EMP004
            6, 7, 8, 9,        # Pod 2: EMP007-EMP010
            12, 13, 14, 15,    # Pod 3: EMP013-EMP016
            18, 19, 20, 21,    # Pod 4: EMP019-EMP022
            24, 25, 26, 27     # Pod 5: EMP025-EMP028
        ]

        for s_idx, b in enumerate(single_resource_brands):
            emp = employees[single_emp_indices[s_idx]]
            for p in [cs_proc, acc_proc, processes[3]]: # CS, ACC, NDR
                ea = db.query(EmployeeAssignment).filter(
                    EmployeeAssignment.employee_id == emp.id,
                    EmployeeAssignment.brand_id == b.id,
                    EmployeeAssignment.process_id == p.id
                ).first()
                if not ea:
                    ea = EmployeeAssignment(
                        employee_id=emp.id,
                        brand_id=b.id,
                        process_id=p.id,
                        assigned_role="Primary Sole Operator",
                        allocation_percentage=100.0,
                        priority=1,
                        effective_start_date=date(2025, 1, 1),
                        active=True
                    )
                    db.add(ea)

        # Multi-resource mapping for remaining 5 brands:
        multi_pairs = [
            (brands[20], employees[4], employees[5]),   # GlowCart: EMP005 & EMP006
            (brands[21], employees[10], employees[11]), # PureAura: EMP011 & EMP012
            (brands[22], employees[16], employees[17]), # PeakFitness: EMP017 & EMP018
            (brands[23], employees[22], employees[23]), # UrbanCraze: EMP023 & EMP024
            (brands[24], employees[28], employees[29])  # NeoKitchen: EMP029 & EMP030
        ]

        for b, emp_a, emp_b in multi_pairs:
            # Both share Customer Support (demonstrating shared process requirement from Part 3!)
            for emp in [emp_a, emp_b]:
                ea = db.query(EmployeeAssignment).filter(
                    EmployeeAssignment.employee_id == emp.id,
                    EmployeeAssignment.brand_id == b.id,
                    EmployeeAssignment.process_id == cs_proc.id
                ).first()
                if not ea:
                    db.add(EmployeeAssignment(
                        employee_id=emp.id,
                        brand_id=b.id,
                        process_id=cs_proc.id,
                        assigned_role="Shared Associate",
                        allocation_percentage=50.0,
                        priority=1,
                        effective_start_date=date(2025, 1, 1),
                        active=True
                    ))
            # emp_a handles ACC
            ea_acc = db.query(EmployeeAssignment).filter(
                EmployeeAssignment.employee_id == emp_a.id,
                EmployeeAssignment.brand_id == b.id,
                EmployeeAssignment.process_id == acc_proc.id
            ).first()
            if not ea_acc:
                db.add(EmployeeAssignment(
                    employee_id=emp_a.id,
                    brand_id=b.id,
                    process_id=acc_proc.id,
                    assigned_role="Conversion Lead",
                    allocation_percentage=50.0,
                    priority=1,
                    effective_start_date=date(2025, 1, 1),
                    active=True
                ))
            # emp_b handles NDR
            ea_ndr = db.query(EmployeeAssignment).filter(
                EmployeeAssignment.employee_id == emp_b.id,
                EmployeeAssignment.brand_id == b.id,
                EmployeeAssignment.process_id == processes[3].id
            ).first()
            if not ea_ndr:
                db.add(EmployeeAssignment(
                    employee_id=emp_b.id,
                    brand_id=b.id,
                    process_id=processes[3].id,
                    assigned_role="Logistics Lead",
                    allocation_percentage=50.0,
                    priority=1,
                    effective_start_date=date(2025, 1, 1),
                    active=True
                ))

        # 7. Public Holidays (Realistic Indian national/festival holidays for 2026)
        holiday_list = [
            ("Republic Day", date(2026, 1, 26), "National", "ALL"),
            ("Holi", date(2026, 3, 4), "Festival", "ALL"),
            ("Good Friday", date(2026, 4, 3), "National", "ALL"),
            ("Eid-ul-Fitr", date(2026, 3, 20), "Festival", "ALL"),
            ("Independence Day", date(2026, 8, 15), "National", "ALL"),
            ("Mahatma Gandhi Jayanti", date(2026, 10, 2), "National", "ALL"),
            ("Dussehra", date(2026, 10, 20), "Festival", "ALL"),
            ("Diwali", date(2026, 11, 8), "Festival", "ALL"),
            ("Christmas", date(2026, 12, 25), "Festival", "ALL")
        ]
        for name, h_date, h_type, brands_app in holiday_list:
            if not db.query(PublicHoliday).filter(PublicHoliday.date == h_date).first():
                db.add(PublicHoliday(
                    holiday_name=name,
                    date=h_date,
                    applicable_region="All India",
                    applicable_brands=brands_app,
                    holiday_type=h_type
                ))

        # 8. Employee Availabilities (Leaves, Comp-Offs, Planned leaves)
        # Add realistic leaves for December 2026
        # E.g. Rahul Sharma (EMP001) has an approved leave on 12 December 2026 to showcase impact analysis!
        availability_records = [
            (employees[0].id, date(2026, 12, 12), "Approved Leave", "Sick Leave", "Approved", "Medical Consultation"),
            (employees[2].id, date(2026, 12, 15), "Approved Leave", "Casual Leave", "Approved", "Family Function"),
            (employees[4].id, date(2026, 12, 18), "Comp-Off", "Comp-Off", "Approved", "Compensatory off for weekend overtime"),
            (employees[7].id, date(2026, 12, 22), "Planned Leave", "Privilege Leave", "Pending", "Annual vacation request"),
            (employees[10].id, date(2026, 12, 5), "Approved Leave", "Casual Leave", "Approved", "Personal emergency"),
            (employees[14].id, date(2026, 12, 28), "Comp-Off", "Comp-Off", "Approved", "Worked on festive dispatch"),
            (employees[18].id, date(2026, 12, 10), "Unavailable", "Training", "Approved", "Mandatory quarterly quality compliance")
        ]

        for emp_id, a_date, status, l_type, app_status, reason in availability_records:
            if not db.query(EmployeeAvailability).filter(
                EmployeeAvailability.employee_id == emp_id,
                EmployeeAvailability.date == a_date
            ).first():
                db.add(EmployeeAvailability(
                    employee_id=emp_id,
                    date=a_date,
                    status=status,
                    leave_type=l_type,
                    approval_status=app_status,
                    reason=reason
                ))

        db.commit()
        print("Database successfully seeded with 30 employees, 25 brands (20 single, 5 multi), 5 pods, 7 processes, and calendar rules!")

    finally:
        if close_db:
            db.close()

if __name__ == "__main__":
    seed_database()
