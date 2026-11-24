from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.entities import Employee, Pod, EmployeeAssignment, Brand, Process, RosterAssignment
from app.schemas.schemas import EmployeeCreate, EmployeeUpdate, EmployeeOut

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.get("", response_model=List[EmployeeOut])
def get_employees(
    pod_id: Optional[int] = None,
    designation: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Employee)
    if pod_id:
        query = query.filter(Employee.pod_id == pod_id)
    if designation:
        query = query.filter(Employee.designation.ilike(f"%{designation}%"))
    if status:
        query = query.filter(Employee.status == status)
    if search:
        query = query.filter(
            or_(
                Employee.full_name.ilike(f"%{search}%"),
                Employee.employee_id.ilike(f"%{search}%"),
                Employee.email.ilike(f"%{search}%")
            )
        )
    
    employees = query.order_by(Employee.employee_id.asc()).all()
    results = []
    for emp in employees:
        pod_name = emp.pod.pod_name if emp.pod else None
        brands = list({ea.brand.name for ea in emp.assignments if ea.brand and ea.active})
        processes = list({ea.process.name for ea in emp.assignments if ea.process and ea.active})
        out = EmployeeOut.model_validate(emp)
        out.pod_name = pod_name
        out.assigned_brands = brands
        out.assigned_processes = processes
        results.append(out)
    return results

@router.post("", response_model=EmployeeOut)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    existing = db.query(Employee).filter(
        or_(Employee.employee_id == payload.employee_id, Employee.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee ID or Email already exists")
    
    emp = Employee(**payload.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    out = EmployeeOut.model_validate(emp)
    out.pod_name = emp.pod.pod_name if emp.pod else None
    return out

@router.get("/{id}", response_model=EmployeeOut)
def get_employee(id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    out = EmployeeOut.model_validate(emp)
    out.pod_name = emp.pod.pod_name if emp.pod else None
    out.assigned_brands = list({ea.brand.name for ea in emp.assignments if ea.brand and ea.active})
    out.assigned_processes = list({ea.process.name for ea in emp.assignments if ea.process and ea.active})
    return out

@router.put("/{id}", response_model=EmployeeOut)
def update_employee(id: int, payload: EmployeeUpdate, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(emp, key, val)
    db.commit()
    db.refresh(emp)
    out = EmployeeOut.model_validate(emp)
    out.pod_name = emp.pod.pod_name if emp.pod else None
    return out

@router.delete("/{id}")
def deactivate_employee(id: int, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Check if employee has roster history
    has_history = db.query(RosterAssignment).filter(RosterAssignment.employee_id == id).count() > 0
    if has_history:
        # Graceful deactivation to preserve historical records as required by Part 6
        emp.status = "Inactive"
        db.commit()
        return {"success": True, "message": "Employee deactivated to preserve historical roster records"}
    else:
        db.delete(emp)
        db.commit()
        return {"success": True, "message": "Employee deleted"}

@router.get("/{id}/schedule")
def get_employee_schedule(id: int, month: Optional[int] = None, year: Optional[int] = None, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    query = db.query(RosterAssignment).filter(RosterAssignment.employee_id == id)
    if month and year:
        from datetime import date
        import calendar
        num_days = calendar.monthrange(year, month)[1]
        query = query.filter(
            RosterAssignment.date >= date(year, month, 1),
            RosterAssignment.date <= date(year, month, num_days)
        )
    
    shifts = query.order_by(RosterAssignment.date.asc()).all()
    schedule_data = []
    for s in shifts:
        schedule_data.append({
            "date": s.date.isoformat(),
            "work_status": s.work_status,
            "shift_start": s.shift_start,
            "shift_end": s.shift_end,
            "brand_name": s.brand.name if s.brand else None,
            "process_name": s.process.name if s.process else None,
            "notes": s.notes
        })
    return {
        "employee_id": emp.employee_id,
        "full_name": emp.full_name,
        "designation": emp.designation,
        "schedule": schedule_data
    }
