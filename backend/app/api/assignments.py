from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import EmployeeAssignment, Employee, Brand, Process
from app.schemas.schemas import AssignmentCreate, AssignmentUpdate, AssignmentOut

router = APIRouter(prefix="/assignments", tags=["Assignments"])

@router.get("", response_model=List[AssignmentOut])
def get_assignments(
    employee_id: Optional[int] = None,
    brand_id: Optional[int] = None,
    process_id: Optional[int] = None,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(EmployeeAssignment)
    if active_only:
        query = query.filter(EmployeeAssignment.active == True)
    if employee_id:
        query = query.filter(EmployeeAssignment.employee_id == employee_id)
    if brand_id:
        query = query.filter(EmployeeAssignment.brand_id == brand_id)
    if process_id:
        query = query.filter(EmployeeAssignment.process_id == process_id)

    assignments = query.order_by(EmployeeAssignment.brand_id.asc(), EmployeeAssignment.priority.asc()).all()
    results = []
    for ea in assignments:
        out = AssignmentOut.model_validate(ea)
        out.employee_name = ea.employee.full_name if ea.employee else None
        out.brand_name = ea.brand.name if ea.brand else None
        out.process_name = ea.process.name if ea.process else None
        results.append(out)
    return results

@router.post("", response_model=AssignmentOut)
def create_assignment(payload: AssignmentCreate, db: Session = Depends(get_db)):
    # Validate employee capacity
    current_allocations = db.query(EmployeeAssignment).filter(
        EmployeeAssignment.employee_id == payload.employee_id,
        EmployeeAssignment.active == True
    ).all()
    # If adding this exceeds 150%, we can warn or accept with flag
    ea = EmployeeAssignment(**payload.model_dump())
    db.add(ea)
    db.commit()
    db.refresh(ea)
    out = AssignmentOut.model_validate(ea)
    out.employee_name = ea.employee.full_name if ea.employee else None
    out.brand_name = ea.brand.name if ea.brand else None
    out.process_name = ea.process.name if ea.process else None
    return out

@router.put("/{id}", response_model=AssignmentOut)
def update_assignment(id: int, payload: AssignmentUpdate, db: Session = Depends(get_db)):
    ea = db.query(EmployeeAssignment).filter(EmployeeAssignment.id == id).first()
    if not ea:
        raise HTTPException(status_code=404, detail="Assignment not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(ea, k, v)
    db.commit()
    db.refresh(ea)
    out = AssignmentOut.model_validate(ea)
    out.employee_name = ea.employee.full_name if ea.employee else None
    out.brand_name = ea.brand.name if ea.brand else None
    out.process_name = ea.process.name if ea.process else None
    return out

@router.delete("/{id}")
def delete_assignment(id: int, db: Session = Depends(get_db)):
    ea = db.query(EmployeeAssignment).filter(EmployeeAssignment.id == id).first()
    if not ea:
        raise HTTPException(status_code=404, detail="Assignment not found")
    ea.active = False
    db.commit()
    return {"success": True, "message": "Assignment deactivated"}
