from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.scheduler.impact import ImpactAnalyzer
from app.schemas.schemas import ImpactAnalysisRequest, ImpactAnalysisResult, ApplyImpactRequest

router = APIRouter(prefix="/impact", tags=["Workforce Impact Analyzer"])

@router.post("/analyze", response_model=ImpactAnalysisResult)
def analyze_impact(payload: ImpactAnalysisRequest, roster_id: int, db: Session = Depends(get_db)):
    """
    Simulates employee absence on a specific date:
    - Identifies affected assignments and processes
    - Computes coverage impact before vs after
    - Suggests ranked backup candidates based on skills, pod proximity, workload
    """
    analyzer = ImpactAnalyzer(db)
    result = analyzer.analyze_unavailability_impact(
        roster_id=roster_id,
        employee_id=payload.employee_id,
        target_date=payload.date,
        new_status=payload.new_status
    )
    return result

@router.post("/apply")
def apply_impact_replacement(payload: ApplyImpactRequest, db: Session = Depends(get_db)):
    """
    Applies the employee unavailability status and assigns selected replacement employee.
    Automatically re-validates the roster and updates audit logs.
    """
    analyzer = ImpactAnalyzer(db)
    result = analyzer.apply_replacement(
        roster_id=payload.roster_id,
        affected_employee_id=payload.employee_id,
        target_date=payload.date,
        new_status=payload.new_status,
        replacement_employee_id=payload.replacement_employee_id,
        reason=payload.reason or "Impact replacement"
    )
    return result
