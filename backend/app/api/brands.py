from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Brand, Pod, EmployeeAssignment, OperatingRule, Process
from app.schemas.schemas import BrandCreate, BrandUpdate, BrandOut, OperatingRuleCreate, OperatingRuleOut

router = APIRouter(prefix="/brands", tags=["Brands"])

@router.get("", response_model=List[BrandOut])
def get_brands(pod_id: Optional[int] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Brand)
    if pod_id:
        query = query.filter(Brand.assigned_pod_id == pod_id)
    if status:
        query = query.filter(Brand.status == status)
    
    brands = query.order_by(Brand.name.asc()).all()
    results = []
    for b in brands:
        emp_count = len({ea.employee_id for ea in b.assignments if ea.active})
        pod_name = b.assigned_pod.pod_name if b.assigned_pod else None
        
        # Populate operating rules
        rules_out = []
        for r in b.operating_rules:
            r_out = OperatingRuleOut.model_validate(r)
            r_out.process_name = r.process.name if r.process else None
            r_out.brand_name = b.name
            rules_out.append(r_out)

        out = BrandOut.model_validate(b)
        out.assigned_pod_name = pod_name
        out.employee_count = emp_count
        out.operating_rules = rules_out
        results.append(out)
    return results

@router.post("", response_model=BrandOut)
def create_brand(payload: BrandCreate, db: Session = Depends(get_db)):
    existing = db.query(Brand).filter(Brand.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Brand code already exists")
    
    b = Brand(**payload.model_dump())
    db.add(b)
    db.commit()
    db.refresh(b)
    out = BrandOut.model_validate(b)
    out.assigned_pod_name = b.assigned_pod.pod_name if b.assigned_pod else None
    return out

@router.get("/{id}", response_model=BrandOut)
def get_brand(id: int, db: Session = Depends(get_db)):
    b = db.query(Brand).filter(Brand.id == id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    out = BrandOut.model_validate(b)
    out.assigned_pod_name = b.assigned_pod.pod_name if b.assigned_pod else None
    out.employee_count = len({ea.employee_id for ea in b.assignments if ea.active})
    return out

@router.put("/{id}", response_model=BrandOut)
def update_brand(id: int, payload: BrandUpdate, db: Session = Depends(get_db)):
    b = db.query(Brand).filter(Brand.id == id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    for key, val in payload.model_dump(exclude_unset=True).items():
        setattr(b, key, val)
    db.commit()
    db.refresh(b)
    out = BrandOut.model_validate(b)
    out.assigned_pod_name = b.assigned_pod.pod_name if b.assigned_pod else None
    return out

@router.delete("/{id}")
def delete_brand(id: int, db: Session = Depends(get_db)):
    b = db.query(Brand).filter(Brand.id == id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Brand not found")
    b.status = "Inactive"
    db.commit()
    return {"success": True, "message": "Brand deactivated"}

@router.post("/{id}/rules", response_model=OperatingRuleOut)
def set_brand_rule(id: int, payload: OperatingRuleCreate, db: Session = Depends(get_db)):
    b = db.query(Brand).filter(Brand.id == id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    rule = db.query(OperatingRule).filter(
        OperatingRule.brand_id == id,
        OperatingRule.process_id == payload.process_id
    ).first()

    if rule:
        for k, v in payload.model_dump(exclude={"brand_id", "process_id"}).items():
            setattr(rule, k, v)
    else:
        rule = OperatingRule(**payload.model_dump())
        db.add(rule)

    db.commit()
    db.refresh(rule)
    out = OperatingRuleOut.model_validate(rule)
    out.brand_name = b.name
    out.process_name = rule.process.name if rule.process else None
    return out
