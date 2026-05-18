from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from auth import get_current_user
from services.report import generate_report
import models

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportRequest(BaseModel):
    title: str
    start_date: str  # YYYY-MM-DD
    end_date: str


@router.post("/generate")
def create_report(req: ReportRequest, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    try:
        start = datetime.strptime(req.start_date, "%Y-%m-%d")
        end = datetime.strptime(req.end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    data = generate_report(db, user.id, start, end)

    report = models.Report(
        user_id=user.id,
        title=req.title,
        start_date=start,
        end_date=end,
        summary=data["summary"],
        top_issues=data["top_issues"],
        rising_keywords=data["rising_keywords"],
        improvement_suggestions=data["improvement_suggestions"],
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _serialize(report)


@router.get("/")
def list_reports(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    reports = db.query(models.Report).filter(models.Report.user_id == user.id).order_by(models.Report.created_at.desc()).all()
    return [_serialize(r) for r in reports]


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    report = db.query(models.Report).filter(models.Report.id == report_id, models.Report.user_id == user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="리포트를 찾을 수 없습니다.")
    return _serialize(report)


def _serialize(r: models.Report) -> dict:
    return {
        "id": r.id,
        "title": r.title,
        "start_date": r.start_date.strftime("%Y-%m-%d"),
        "end_date": r.end_date.strftime("%Y-%m-%d"),
        "summary": r.summary,
        "top_issues": r.top_issues,
        "rising_keywords": r.rising_keywords,
        "improvement_suggestions": r.improvement_suggestions,
        "created_at": r.created_at.isoformat(),
    }
