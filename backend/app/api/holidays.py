from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import PublicHoliday
from app.schemas.schemas import PublicHolidayCreate, PublicHolidayUpdate, PublicHolidayOut

router = APIRouter(prefix="/holidays", tags=["Public Holidays"])

@router.get("", response_model=List[PublicHolidayOut])
def get_holidays(year: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(PublicHoliday)
    if year:
        from datetime import date
        query = query.filter(
            PublicHoliday.date >= date(year, 1, 1),
            PublicHoliday.date <= date(year, 12, 31)
        )
    return query.order_by(PublicHoliday.date.asc()).all()

@router.post("", response_model=PublicHolidayOut)
def create_holiday(payload: PublicHolidayCreate, db: Session = Depends(get_db)):
    h = PublicHoliday(**payload.model_dump())
    db.add(h)
    db.commit()
    db.refresh(h)
    return h

@router.put("/{id}", response_model=PublicHolidayOut)
def update_holiday(id: int, payload: PublicHolidayUpdate, db: Session = Depends(get_db)):
    h = db.query(PublicHoliday).filter(PublicHoliday.id == id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holiday not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return h

@router.delete("/{id}")
def delete_holiday(id: int, db: Session = Depends(get_db)):
    h = db.query(PublicHoliday).filter(PublicHoliday.id == id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(h)
    db.commit()
    return {"success": True, "message": "Holiday deleted"}
