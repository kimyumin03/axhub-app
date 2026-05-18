import io
import json
from datetime import datetime
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
import pandas as pd
from database import get_db
from auth import get_current_user
from services.analysis import analyze
import models

router = APIRouter(prefix="/voc", tags=["voc"])

VALID_SOURCE_TYPES = {"review", "inquiry", "complaint"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
CHUNK_SIZE = 500

# 내부 필드명 → 흔히 쓰이는 컬럼명 패턴 (자동 매핑 추천용)
AUTO_DETECT: dict[str, list[str]] = {
    "customerText": ["customertext", "customer_text", "review_text", "content", "body",
                     "text", "message", "comment", "feedback", "description",
                     "내용", "문의내용", "리뷰내용", "고객의견", "본문"],
    "createdAt":    ["createdat", "created_at", "date", "created_date", "reg_date",
                     "timestamp", "날짜", "등록일", "작성일", "접수일"],
    "sourceType":   ["sourcetype", "source_type", "type", "category", "분류", "유형"],
    "id":           ["id", "no", "seq", "번호", "순번"],
    "productName":  ["productname", "product_name", "product", "item", "goods",
                     "상품명", "상품", "제품명", "제품"],
    "branchName":   ["branchname", "branch_name", "branch", "store", "location",
                     "지점명", "지점", "매장", "지역"],
    "rating":       ["rating", "score", "star", "grade", "평점", "별점", "점수"],
}


def _parse_date(raw: str):
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return pd.to_datetime(raw, format=fmt).to_pydatetime()
        except Exception:
            pass
    try:
        return pd.to_datetime(raw).to_pydatetime()
    except Exception:
        return None


def _auto_detect_mapping(columns: list[str]) -> dict[str, str]:
    """CSV 컬럼명을 보고 내부 필드로 자동 추천."""
    lower_cols = {c.lower().replace(" ", "").replace("_", ""): c for c in columns}
    result: dict[str, str] = {}
    for field, patterns in AUTO_DETECT.items():
        for pat in patterns:
            key = pat.lower().replace(" ", "").replace("_", "")
            if key in lower_cols:
                result[field] = lower_cols[key]
                break
    return result


SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


async def _read_file(file: UploadFile) -> tuple[pd.DataFrame, bytes]:
    filename = file.filename or ""
    ext = next((e for e in SUPPORTED_EXTENSIONS if filename.lower().endswith(e)), None)
    if ext is None:
        raise HTTPException(status_code=400, detail="CSV 또는 Excel(xlsx/xls) 파일만 업로드 가능합니다.")
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"파일 크기는 {MAX_FILE_SIZE // (1024 * 1024)}MB를 초과할 수 없습니다.")
    try:
        buf = io.BytesIO(content)
        if ext == ".csv":
            df = pd.read_csv(buf, dtype=str)
        else:
            df = pd.read_excel(buf, dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일을 읽을 수 없습니다: {e}")
    return df, content


@router.post("/preview")
async def preview_csv(
    file: UploadFile = File(...),
    user: models.User = Depends(get_current_user),
):
    """1단계: CSV 컬럼명 + 샘플 3행 + 자동 매핑 추천 반환."""
    df, _ = await _read_file(file)
    columns = list(df.columns)
    sample = df.head(3).fillna("").to_dict(orient="records")
    suggested = _auto_detect_mapping(columns)
    return {
        "columns": columns,
        "sample_rows": sample,
        "total_rows": len(df),
        "suggested_mapping": suggested,
    }


def _df_chunks(content: bytes, ext: str):
    """파일을 CHUNK_SIZE 행씩 나눠서 DataFrame으로 yield — 메모리 절약."""
    buf = io.BytesIO(content)
    if ext == ".csv":
        yield from pd.read_csv(buf, dtype=str, chunksize=CHUNK_SIZE)
    else:
        df = pd.read_excel(buf, dtype=str)
        for start in range(0, len(df), CHUNK_SIZE):
            yield df.iloc[start:start + CHUNK_SIZE].reset_index(drop=True)


@router.post("/upload")
async def upload_csv(
    file: UploadFile = File(...),
    mapping: str = Form(default="{}"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """2단계: 매핑 정보를 받아 청크 단위로 분석·저장."""
    filename = file.filename or ""
    ext = next((e for e in SUPPORTED_EXTENSIONS if filename.lower().endswith(e)), None)
    if ext is None:
        raise HTTPException(status_code=400, detail="CSV 또는 Excel(xlsx/xls) 파일만 업로드 가능합니다.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"파일 크기는 {MAX_FILE_SIZE // (1024 * 1024)}MB를 초과할 수 없습니다.")

    try:
        col_map: dict[str, str] = json.loads(mapping)
    except Exception:
        raise HTTPException(status_code=400, detail="mapping 형식이 올바르지 않습니다.")

    # 컬럼 목록을 첫 청크로 확인
    first_chunk = next(_df_chunks(content, ext), None)
    if first_chunk is None or first_chunk.empty:
        raise HTTPException(status_code=400, detail="파일에 데이터가 없습니다.")

    columns = list(first_chunk.columns)
    if not col_map:
        col_map = _auto_detect_mapping(columns)

    def _get(row: pd.Series, field: str, default: str = "") -> str:
        csv_col = col_map.get(field)
        if csv_col and csv_col in row.index:
            return str(row[csv_col]).strip()
        if field in row.index:
            return str(row[field]).strip()
        return default

    customer_text_col = col_map.get("customerText", "customerText")
    text_col = customer_text_col if customer_text_col in columns else "customerText"
    if text_col not in columns:
        raise HTTPException(status_code=400, detail="고객 원문 컬럼을 지정해주세요.")

    success, failed = 0, 0
    failed_rows: list[dict] = []
    row_offset = 2  # 헤더가 1행

    for chunk in _df_chunks(content, ext):
        chunk[text_col] = chunk[text_col].fillna("").str.strip()

        for i, (_, row) in enumerate(chunk.iterrows()):
            row_num = row_offset + i
            customer_text = _get(row, "customerText")
            if not customer_text or customer_text.lower() == "nan":
                continue

            ext_id = _get(row, "id") or f"ROW-{row_num}"
            text_preview = customer_text[:60]

            created_at = None
            raw_date = _get(row, "createdAt")
            if raw_date and raw_date.lower() != "nan":
                created_at = _parse_date(raw_date)
                if created_at is None:
                    failed += 1
                    failed_rows.append({"row": row_num, "id": ext_id, "reason": f"날짜 형식 오류: '{raw_date}'", "preview": text_preview})
                    continue

            source_type = _get(row, "sourceType", "inquiry").lower()
            if source_type not in VALID_SOURCE_TYPES:
                source_type = "inquiry"

            rating = None
            raw_rating = _get(row, "rating")
            if raw_rating and raw_rating.lower() != "nan":
                try:
                    rating = float(raw_rating)
                    if not (1.0 <= rating <= 5.0):
                        failed_rows.append({"row": row_num, "id": ext_id, "reason": f"rating 범위 오류: {rating} (1~5)", "preview": text_preview})
                        failed += 1
                        continue
                except ValueError:
                    failed_rows.append({"row": row_num, "id": ext_id, "reason": f"rating 형식 오류: '{raw_rating}'", "preview": text_preview})
                    failed += 1
                    continue

            try:
                product = _get(row, "productName")
                branch = _get(row, "branchName")
                record = models.VocRecord(
                    user_id=user.id,
                    external_id=ext_id,
                    created_at=created_at,
                    source_type=source_type,
                    product_name=product if product and product.lower() != "nan" else None,
                    branch_name=branch if branch and branch.lower() != "nan" else None,
                    customer_text=customer_text,
                    rating=rating,
                )
                db.add(record)
                db.flush()

                result = analyze(record.customer_text, record.rating)
                db.add(models.VocAnalysis(
                    voc_record_id=record.id,
                    category=result["category"],
                    sentiment=result["sentiment"],
                    keywords=result["keywords"],
                    priority_score=result["priority_score"],
                ))
                success += 1

            except Exception as e:
                failed += 1
                failed_rows.append({"row": row_num, "id": ext_id, "reason": str(e), "preview": text_preview})

        db.commit()  # 청크 단위 커밋 — 대용량 파일 중간 실패 시 손실 최소화
        row_offset += len(chunk)

    return {
        "total": success + failed,
        "success": success,
        "failed": failed,
        "failed_rows": failed_rows[:20],
    }


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
