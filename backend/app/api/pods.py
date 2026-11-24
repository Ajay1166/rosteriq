from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Pod, Employee, Brand
from app.schemas.schemas import PodCreate, PodUpdate, PodOut

router = APIRouter(prefix="/pods", tags=["Pods"])

@router.get("", response_model=List[PodOut])
def get_pods(db: Session = Depends(get_db)):
    pods = db.query(Pod).order_by(Pod.id.asc()).all()
    results = []
    for pod in pods:
        emp_count = db.query(Employee).filter(Employee.pod_id == pod.id, Employee.status == "Active").count()
        out = PodOut.model_validate(pod)
        out.employee_count = emp_count
        results.append(out)
    return results

@router.post("", response_model=PodOut)
def create_pod(payload: PodCreate, db: Session = Depends(get_db)):
    existing = db.query(Pod).filter(Pod.pod_name == payload.pod_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Pod name already exists")
    pod = Pod(**payload.model_dump())
    db.add(pod)
    db.commit()
    db.refresh(pod)
    out = PodOut.model_validate(pod)
    out.employee_count = 0
    return out

@router.get("/{id}", response_model=PodOut)
def get_pod(id: int, db: Session = Depends(get_db)):
    pod = db.query(Pod).filter(Pod.id == id).first()
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    out = PodOut.model_validate(pod)
    out.employee_count = db.query(Employee).filter(Employee.pod_id == id, Employee.status == "Active").count()
    return out

@router.put("/{id}", response_model=PodOut)
def update_pod(id: int, payload: PodUpdate, db: Session = Depends(get_db)):
    pod = db.query(Pod).filter(Pod.id == id).first()
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(pod, k, v)
    db.commit()
    db.refresh(pod)
    out = PodOut.model_validate(pod)
    out.employee_count = db.query(Employee).filter(Employee.pod_id == id, Employee.status == "Active").count()
    return out

@router.delete("/{id}")
def delete_pod(id: int, db: Session = Depends(get_db)):
    pod = db.query(Pod).filter(Pod.id == id).first()
    if not pod:
        raise HTTPException(status_code=404, detail="Pod not found")
    pod.status = "Inactive"
    db.commit()
    return {"success": True, "message": "Pod deactivated"}
