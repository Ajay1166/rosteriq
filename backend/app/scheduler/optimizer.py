import math
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.entities import Roster, RosterAssignment, Employee, Pod, Brand

class WorkloadOptimizer:
    def __init__(self, db: Session):
        self.db = db

    def calculate_workload_analytics(self, roster_id: int) -> Dict[str, Any]:
        """
        Calculates workload distribution and fairness score according to Part 14:
        Workload Balance = 1 - (StdDev / Mean)
        Clamped between 0% and 100%.
        """
        roster = self.db.query(Roster).filter(Roster.id == roster_id).first()
        if not roster:
            return {"error": "Roster not found"}

        assignments = self.db.query(RosterAssignment).filter(
            RosterAssignment.roster_id == roster_id
        ).all()

        employees = self.db.query(Employee).filter(Employee.status == "Active").all()
        emp_map = {e.id: e for e in employees}
        pods = {p.id: p for p in self.db.query(Pod).all()}
        brands = {b.id: b for b in self.db.query(Brand).all()}

        # Metrics per employee
        working_days = {e.id: 0 for e in employees}
        weekly_offs = {e.id: 0 for e in employees}
        weekend_shifts = {e.id: 0 for e in employees}
        leave_days = {e.id: 0 for e in employees}

        for ra in assignments:
            if ra.employee_id in emp_map:
                if ra.work_status == "Working":
                    working_days[ra.employee_id] += 1
                    if ra.date.weekday() in [5, 6]: # Saturday or Sunday
                        weekend_shifts[ra.employee_id] += 1
                elif ra.work_status == "Weekly Off":
                    weekly_offs[ra.employee_id] += 1
                elif ra.work_status in ["Leave", "Comp-Off"]:
                    leave_days[ra.employee_id] += 1

        # Calculate Mean and Standard Deviation of working days
        counts = list(working_days.values())
        if counts and len(counts) > 0:
            mean_workload = sum(counts) / len(counts)
            if mean_workload > 0:
                variance = sum((c - mean_workload) ** 2 for c in counts) / len(counts)
                std_dev = math.sqrt(variance)
                # Formula: 1 - (std_dev / mean)
                raw_balance = 1.0 - (std_dev / mean_workload)
                # Clamp to 0..1 then * 100
                fairness_score = max(0.0, min(1.0, raw_balance)) * 100.0
            else:
                std_dev = 0.0
                fairness_score = 100.0
        else:
            mean_workload = 0.0
            std_dev = 0.0
            fairness_score = 100.0

        # High, Low workload employees
        sorted_by_shifts = sorted(employees, key=lambda e: working_days.get(e.id, 0), reverse=True)
        top_workload = [
            {
                "employee_id": e.id,
                "name": e.full_name,
                "pod": pods.get(e.pod_id).pod_name if e.pod_id in pods else "Unassigned",
                "working_days": working_days[e.id],
                "weekend_shifts": weekend_shifts[e.id]
            }
            for e in sorted_by_shifts[:5]
        ]
        lowest_workload = [
            {
                "employee_id": e.id,
                "name": e.full_name,
                "pod": pods.get(e.pod_id).pod_name if e.pod_id in pods else "Unassigned",
                "working_days": working_days[e.id],
                "weekend_shifts": weekend_shifts[e.id]
            }
            for e in sorted_by_shifts[-5:][::-1]
        ]

        # Pod distribution
        pod_stats = []
        for p in pods.values():
            p_emps = [e for e in employees if e.pod_id == p.id]
            p_shifts = sum(working_days.get(e.id, 0) for e in p_emps)
            avg_shifts = (p_shifts / len(p_emps)) if p_emps else 0
            pod_stats.append({
                "pod_id": p.id,
                "pod_name": p.pod_name,
                "headcount": len(p_emps),
                "total_shifts": p_shifts,
                "average_shifts": round(avg_shifts, 1)
            })

        return {
            "roster_id": roster_id,
            "fairness_score": round(fairness_score, 1),
            "mean_working_days": round(mean_workload, 1),
            "standard_deviation": round(std_dev, 2),
            "top_workload_employees": top_workload,
            "lowest_workload_employees": lowest_workload,
            "pod_distribution": pod_stats,
            "suggestions": [
                f"Workload fairness is currently {round(fairness_score, 1)}%. Target > 85% for optimal team morale.",
                "Review lowest-workload staff for backup cross-training to relieve top-tier associates."
            ]
        }
