from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import EmployeeAvailability, Employee
from app.schemas.schemas import AvailabilityCreate, AvailabilityUpdate, AvailabilityOut

router = APIRouter(prefix="/availability", tags=["Availability"])

@router.get("", response_model=List[AvailabilityOut])
def get_availabilities(
    employee_id: Optional[int] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(EmployeeAvailability)
    if employee_id:
        query = query.filter(EmployeeAvailability.employee_id == employee_id)
    if status:
        query = query.filter(EmployeeAvailability.status == status)
    if month and year:
        import calendar
        num_days = calendar.monthrange(year, month)[1]
        query = query.filter(
            EmployeeAvailability.date >= date(year, month, 1),
            EmployeeAvailability.date <= date(year, month, num_days)
        )
    
    records = query.order_by(EmployeeAvailability.date.asc()).all()
    results = []
    for r in records:
        out = AvailabilityOut.model_validate(r)
        out.employee_name = r.employee.full_name if r.employee else None
        results.append(out)
    return results

@router.post("", response_model=AvailabilityOut)
def create_availability(payload: AvailabilityCreate, db: Session = Depends(get_db)):
    av = EmployeeAvailability(**payload.model_dump())
    db.add(av)
    db.commit()
    db.refresh(av)
    out = AvailabilityOut.model_validate(av)
    out.employee_name = av.employee.full_name if av.employee else None
    return out

@router.put("/{id}", response_model=AvailabilityOut)
def update_availability(id: int, payload: AvailabilityUpdate, db: Session = Depends(get_db)):
    av = db.query(EmployeeAvailability).filter(EmployeeAvailability.id == id).first()
    if not av:
        raise HTTPException(status_code=404, detail="Availability record not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(av, k, v)
    db.commit()
    db.refresh(av)
    out = AvailabilityOut.model_validate(av)
    out.employee_name = av.employee.full_name if av.employee else None
    return out

@router.delete("/{id}")
def delete_availability(id: int, db: Session = Depends(get_db)):
    av = db.query(EmployeeAvailability).filter(EmployeeAvailability.id == id).first()
    if not av:
        raise HTTPException(status_code=404, detail="Availability record not found")
    db.delete(av)
    db.commit()
    return {"success": True, "message": "Availability record deleted"}
