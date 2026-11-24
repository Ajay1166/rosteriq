from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Process
from app.schemas.schemas import ProcessCreate, ProcessUpdate, ProcessOut

router = APIRouter(prefix="/processes", tags=["Processes"])

@router.get("", response_model=List[ProcessOut])
def get_processes(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Process)
    if status:
        query = query.filter(Process.status == status)
    return query.order_by(Process.id.asc()).all()

@router.post("", response_model=ProcessOut)
def create_process(payload: ProcessCreate, db: Session = Depends(get_db)):
    existing = db.query(Process).filter(Process.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Process code already exists")
    proc = Process(**payload.model_dump())
    db.add(proc)
    db.commit()
    db.refresh(proc)
    return proc

@router.get("/{id}", response_model=ProcessOut)
def get_process(id: int, db: Session = Depends(get_db)):
    proc = db.query(Process).filter(Process.id == id).first()
    if not proc:
        raise HTTPException(status_code=404, detail="Process not found")
    return proc

@router.put("/{id}", response_model=ProcessOut)
def update_process(id: int, payload: ProcessUpdate, db: Session = Depends(get_db)):
    proc = db.query(Process).filter(Process.id == id).first()
    if not proc:
        raise HTTPException(status_code=404, detail="Process not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(proc, k, v)
    db.commit()
    db.refresh(proc)
    return proc

@router.delete("/{id}")
def delete_process(id: int, db: Session = Depends(get_db)):
    proc = db.query(Process).filter(Process.id == id).first()
    if not proc:
        raise HTTPException(status_code=404, detail="Process not found")
    proc.status = "Inactive"
    db.commit()
    return {"success": True, "message": "Process deactivated"}
