import io
from datetime import datetime
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
import pandas as pd
from database import get_db
from auth import get_current_user
from services.analysis import analyze
import models

router = APIRouter(prefix="/voc", tags=["voc"])

REQUIRED_COLUMNS = {"id", "createdAt", "sourceType", "customerText"}


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSV 파일만 업로드 가능합니다.")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=400, detail="CSV 파일을 읽을 수 없습니다.")

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"필수 컬럼 누락: {', '.join(missing)}")

    df = df.dropna(subset=["customerText"])
    df["customerText"] = df["customerText"].astype(str).str.strip()
    df = df[df["customerText"] != ""]

    success, failed, errors = 0, 0, []

    for _, row in df.iterrows():
        try:
            created_at = None
            raw_date = str(row.get("createdAt", ""))
            if raw_date and raw_date != "nan":
                try:
                    created_at = pd.to_datetime(raw_date).to_pydatetime()
                except Exception:
                    errors.append(f"id={row.get('id', '?')}: 날짜 형식 오류 ({raw_date})")
                    failed += 1
                    continue

            rating = None
            raw_rating = row.get("rating")
            if raw_rating is not None and str(raw_rating) != "nan":
                try:
                    rating = float(raw_rating)
                except Exception:
                    pass

            record = models.VocRecord(
                user_id=user.id,
                external_id=str(row.get("id", "")),
                created_at=created_at,
                source_type=str(row.get("sourceType", "inquiry")),
                product_name=str(row.get("productName", "")) or None,
                branch_name=str(row.get("branchName", "")) or None,
                customer_text=str(row["customerText"]),
                rating=rating,
            )
            db.add(record)
            db.flush()

            result = analyze(record.customer_text, record.rating)
            analysis = models.VocAnalysis(
                voc_record_id=record.id,
                category=result["category"],
                sentiment=result["sentiment"],
                keywords=result["keywords"],
                priority_score=result["priority_score"],
            )
            db.add(analysis)
            success += 1

        except Exception as e:
            failed += 1
            errors.append(f"id={row.get('id', '?')}: {str(e)}")

    db.commit()
    return {"total": success + failed, "success": success, "failed": failed, "errors": errors[:10]}


@router.get("/records")
def list_records(
    start_date: str = Query(None),
    end_date: str = Query(None),
    sentiment: str = Query(None),
    category: str = Query(None),
    product_name: str = Query(None),
    source_type: str = Query(None),
    keyword: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.VocRecord)
        .join(models.VocAnalysis, isouter=True)
        .filter(models.VocRecord.user_id == user.id)
    )

    if start_date:
        q = q.filter(models.VocRecord.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        q = q.filter(models.VocRecord.created_at <= datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59))
    if sentiment:
        q = q.filter(models.VocAnalysis.sentiment == sentiment)
    if category:
        q = q.filter(models.VocAnalysis.category == category)
    if product_name:
        q = q.filter(models.VocRecord.product_name == product_name)
    if source_type:
        q = q.filter(models.VocRecord.source_type == source_type)
    if keyword:
        q = q.filter(models.VocRecord.customer_text.contains(keyword))

    total = q.count()
    records = q.order_by(models.VocRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_serialize(r) for r in records],
    }


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    from sqlalchemy import func
    from datetime import timedelta

    all_records = db.query(models.VocRecord).filter(models.VocRecord.user_id == user.id).all()
    all_analyses = [r.analysis for r in all_records if r.analysis]

    total = len(all_records)
    neg = sum(1 for a in all_analyses if a.sentiment == "negative")
    pos = sum(1 for a in all_analyses if a.sentiment == "positive")
    neu = sum(1 for a in all_analyses if a.sentiment == "neutral")

    from collections import Counter
    cat_counter = Counter(a.category for a in all_analyses)
    sentiment_dist = {"negative": neg, "positive": pos, "neutral": neu}

    now = datetime.utcnow()
    trend_7 = _daily_trend(all_records, now, 7)
    trend_30 = _daily_trend(all_records, now, 30)

    product_neg: Counter = Counter()
    for r in all_records:
        if r.analysis and r.analysis.sentiment == "negative":
            key = r.product_name or r.branch_name or "미분류"
            product_neg[key] += 1

    return {
        "total": total,
        "negative_ratio": round(neg / total * 100, 1) if total else 0,
        "sentiment_distribution": sentiment_dist,
        "category_distribution": dict(cat_counter.most_common()),
        "top_complaints": [{"category": k, "count": v} for k, v in cat_counter.most_common(5)],
        "trend_7days": trend_7,
        "trend_30days": trend_30,
        "product_issue_ranking": [{"name": k, "count": v} for k, v in product_neg.most_common(10)],
    }


def _daily_trend(records: list, now: datetime, days: int) -> list:
    from datetime import timedelta
    from collections import defaultdict
    counts: dict = defaultdict(int)
    cutoff = now - timedelta(days=days)
    for r in records:
        if r.created_at and r.created_at >= cutoff:
            day = r.created_at.strftime("%Y-%m-%d")
            counts[day] += 1
    result = []
    for i in range(days):
        day = (cutoff + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        result.append({"date": day, "count": counts.get(day, 0)})
    return result


def _serialize(r: models.VocRecord) -> dict:
    return {
        "id": r.id,
        "external_id": r.external_id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "source_type": r.source_type,
        "product_name": r.product_name,
        "branch_name": r.branch_name,
        "customer_text": r.customer_text,
        "rating": r.rating,
        "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None,
        "analysis": {
            "category": r.analysis.category,
            "sentiment": r.analysis.sentiment,
            "keywords": r.analysis.keywords,
            "priority_score": r.analysis.priority_score,
        } if r.analysis else None,
    }
