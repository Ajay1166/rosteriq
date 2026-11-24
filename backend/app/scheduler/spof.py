from typing import List, Dict, Any
from collections import defaultdict
from sqlalchemy.orm import Session

from app.models.entities import Brand, EmployeeAssignment, Process, Employee, Pod

class SPOFDetector:
    def __init__(self, db: Session):
        self.db = db

    def analyze_single_points_of_failure(self) -> List[Dict[str, Any]]:
        """
        Scans all active brands and identifies Single Point of Failure (SPOF) risks:
        - Brands with only 1 dedicated employee across all assigned processes.
        - Processes where only 1 employee is allocated.
        Categorizes risk into HIGH, MEDIUM, LOW.
        """
        brands = self.db.query(Brand).filter(Brand.status == "Active").all()
        assignments = self.db.query(EmployeeAssignment).filter(EmployeeAssignment.active == True).all()
        employees = {e.id: e for e in self.db.query(Employee).all()}
        processes = {p.id: p for p in self.db.query(Process).all()}
        pods = {pod.id: pod for pod in self.db.query(Pod).all()}

        # Group assignments by brand_id
        brand_emps: Dict[int, set] = defaultdict(set)
        brand_procs: Dict[int, set] = defaultdict(set)
        brand_proc_emps: Dict[int, Dict[int, set]] = defaultdict(lambda: defaultdict(set))

        for ea in assignments:
            brand_emps[ea.brand_id].add(ea.employee_id)
            brand_procs[ea.brand_id].add(ea.process_id)
            brand_proc_emps[ea.brand_id][ea.process_id].add(ea.employee_id)

        spof_results = []
        for b in brands:
            emp_ids = brand_emps[b.id]
            proc_ids = brand_procs[b.id]
            pod = pods.get(b.assigned_pod_id)

            dedicated_count = len(emp_ids)
            proc_count = len(proc_ids)
            dedicated_emps = [employees[eid].full_name for eid in emp_ids if eid in employees]

            # Determine Risk Level
            if dedicated_count <= 1 and proc_count >= 2:
                risk_level = "HIGH"
                risk_summary = f"Extreme Dependency: Sole employee ({dedicated_emps[0] if dedicated_emps else 'None'}) owns all {proc_count} processes."
                mitigation = "Cross-train and assign a secondary backup associate from the same operational pod."
            elif dedicated_count <= 1 and proc_count == 1:
                risk_level = "MEDIUM"
                risk_summary = f"Single operator handling {proc_count} process with no designated redundancy."
                mitigation = "Assign secondary backup resource."
            elif dedicated_count == 2 and proc_count >= 3:
                risk_level = "MEDIUM"
                risk_summary = f"Tight Staffing: 2 employees distributed across {proc_count} processes."
                mitigation = "Review cross-coverage during concurrent leaves."
            else:
                risk_level = "LOW"
                risk_summary = f"Healthy Staffing: {dedicated_count} employees assigned across {proc_count} processes."
                mitigation = "Maintain current rotation schedule."

            spof_results.append({
                "brand_id": b.id,
                "brand_name": b.name,
                "brand_code": b.code,
                "industry": b.industry,
                "pod_name": pod.pod_name if pod else "Unassigned",
                "dedicated_employees_count": dedicated_count,
                "dedicated_employees": dedicated_emps,
                "process_count": proc_count,
                "risk_level": risk_level,
                "risk_summary": risk_summary,
                "recommended_mitigation": mitigation
            })

        # Sort by HIGH risk first, then MEDIUM, then LOW
        risk_priority = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        spof_results.sort(key=lambda x: risk_priority.get(x["risk_level"], 3))

        return spof_results
