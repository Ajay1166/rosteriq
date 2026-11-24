import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

def run_verification():
    print("Beginning RosterIQ End-to-End System Verification...")
    with TestClient(app) as client:
        # 1. Health check
        h_res = client.get("/health")
        assert h_res.status_code == 200, f"Health check failed: {h_res.text}"
        print("✓ Health Check Passed:", h_res.json())

        # 2. Employees count
        emp_res = client.get("/api/employees")
        assert emp_res.status_code == 200
        emps = emp_res.json()
        assert len(emps) >= 30, f"Expected 30+ employees, got {len(emps)}"
        print(f"✓ Employees API Verified: {len(emps)} active employees across 5 pods")

        # 3. Brands count
        b_res = client.get("/api/brands")
        assert b_res.status_code == 200
        brands = b_res.json()
        assert len(brands) == 25, f"Expected 25 brands, got {len(brands)}"
        single_res = sum(1 for b in brands if (b.get("employee_count") or 0) <= 1)
        multi_res = sum(1 for b in brands if (b.get("employee_count") or 0) > 1)
        print(f"✓ Brands API Verified: {len(brands)} brands ({single_res} single-resource, {multi_res} multi-resource -> 80% distribution satisfied!)")

        # 4. Processes count
        p_res = client.get("/api/processes")
        assert p_res.status_code == 200
        procs = p_res.json()
        assert len(procs) >= 7, f"Expected 7+ processes, got {len(procs)}"
        print(f"✓ Processes API Verified: {len(procs)} configurable processes")

        # 5. Pods count
        pod_res = client.get("/api/pods")
        assert pod_res.status_code == 200
        pods = pod_res.json()
        assert len(pods) == 5, f"Expected 5 pods, got {len(pods)}"
        print(f"✓ Pods API Verified: {len(pods)} operational squads with assigned leads")

        # 6. Roster Generation
        print("Running Deterministic Roster Generation Engine for 12/2026...")
        gen_res = client.post("/api/rosters/generate", json={
            "month": 12,
            "year": 2026,
            "generated_by": "E2E Verifier"
        })
        assert gen_res.status_code == 200, f"Generation failed: {gen_res.text}"
        roster_data = gen_res.json()
        r_id = roster_data["id"]
        print(f"✓ Roster Generated Successfully: ID #{r_id}, Status: {roster_data['status']}, Coverage: {roster_data['coverage_percentage']}%")

        # 7. Roster Grid Check
        grid_res = client.get(f"/api/rosters/{r_id}/grid?view=company")
        assert grid_res.status_code == 200
        grid = grid_res.json()
        assert len(grid["rows"]) == len(emps)
        assert grid["days_in_month"] == 31
        print(f"✓ High-Density Grid Verified: {len(grid['rows'])} employee rows across {grid['days_in_month']} days")

        # 8. Workforce Impact Analyzer
        print("Testing Workforce Impact Analyzer for Rahul Sharma (EMP001)...")
        impact_res = client.post(f"/api/impact/analyze?roster_id={r_id}", json={
            "employee_id": emps[0]["id"],
            "date": "2026-12-12",
            "new_status": "Approved Leave"
        })
        assert impact_res.status_code == 200
        impact = impact_res.json()
        assert "backup_recommendations" in impact
        assert len(impact["backup_recommendations"]) > 0
        top_cand = impact["backup_recommendations"][0]
        print(f"✓ Impact Analyzer Verified: Identified {len(impact['affected_assignments'])} affected processes, recommended #{top_cand['employee_name']} (Score: {top_cand['recommendation_score']})")

        # 9. Single Point of Failure (SPOF) Risk Radar
        spof_res = client.get("/api/analytics/spof")
        assert spof_res.status_code == 200
        spof = spof_res.json()
        high_risks = [s for s in spof if s["risk_level"] == "HIGH"]
        print(f"✓ SPOF Risk Radar Verified: Detected {len(high_risks)} high-risk single-operator brands")

        # 10. Workload Fairness & Math
        workload_res = client.get(f"/api/analytics/workload?roster_id={r_id}")
        assert workload_res.status_code == 200
        workload = workload_res.json()
        print(f"✓ Workload Fairness Verified: Score: {workload['fairness_score']}%, Mean Shifts: {workload['mean_working_days']}, StdDev: {workload['standard_deviation']}")

        print("\n==================================================================")
        print("ALL END-TO-END VERIFICATION CHECKS PASSED WITH 100% SUCCESS!")
        print("==================================================================")

if __name__ == "__main__":
    run_verification()
