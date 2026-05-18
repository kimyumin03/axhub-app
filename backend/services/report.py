from datetime import datetime, timedelta
from collections import Counter
from sqlalchemy.orm import Session
import models


def generate_report(db: Session, user_id: int, start_date: datetime, end_date: datetime) -> dict:
    records = (
        db.query(models.VocRecord)
        .filter(
            models.VocRecord.user_id == user_id,
            models.VocRecord.created_at >= start_date,
            models.VocRecord.created_at <= end_date,
        )
        .all()
    )

    analyses = [r.analysis for r in records if r.analysis]

    total = len(records)
    neg_count = sum(1 for a in analyses if a.sentiment == "negative")
    neg_ratio = round(neg_count / total * 100, 1) if total else 0

    category_counter = Counter(a.category for a in analyses)
    top_issues = [{"category": cat, "count": cnt} for cat, cnt in category_counter.most_common(5)]

    all_keywords = [kw for a in analyses for kw in (a.keywords or [])]
    keyword_counter = Counter(all_keywords)

    prev_start = start_date - (end_date - start_date)
    prev_end = start_date
    prev_records = (
        db.query(models.VocRecord)
        .filter(
            models.VocRecord.user_id == user_id,
            models.VocRecord.created_at >= prev_start,
            models.VocRecord.created_at < prev_end,
        )
        .all()
    )
    prev_analyses = [r.analysis for r in prev_records if r.analysis]
    prev_keywords = Counter(kw for a in prev_analyses for kw in (a.keywords or []))

    rising = []
    for kw, cnt in keyword_counter.most_common(10):
        prev_cnt = prev_keywords.get(kw, 0)
        if prev_cnt == 0 and cnt > 0:
            rising.append({"keyword": kw, "count": cnt, "change": "신규"})
        elif prev_cnt > 0:
            pct = round((cnt - prev_cnt) / prev_cnt * 100)
            if pct > 20:
                rising.append({"keyword": kw, "count": cnt, "change": f"+{pct}%"})
    rising = rising[:5]

    suggestions = _generate_suggestions(top_issues, rising, neg_ratio)

    product_counter: Counter = Counter()
    for r in records:
        if r.analysis and r.analysis.sentiment == "negative":
            key = r.product_name or r.branch_name or "미분류"
            product_counter[key] += 1

    summary = {
        "total": total,
        "negative_ratio": neg_ratio,
        "negative_count": neg_count,
        "top_product_issues": [{"name": k, "count": v} for k, v in product_counter.most_common(5)],
    }

    return {
        "summary": summary,
        "top_issues": top_issues,
        "rising_keywords": rising,
        "improvement_suggestions": suggestions,
    }


def _generate_suggestions(top_issues: list, rising: list, neg_ratio: float) -> list[str]:
    suggestions = []

    for issue in top_issues[:3]:
        cat = issue["category"]
        cnt = issue["count"]
        if cat == "배송":
            suggestions.append(f"배송 관련 불만이 {cnt}건 발생했습니다. 출고 안내 메시지 개선과 물류사 SLA 점검이 필요합니다.")
        elif cat == "환불":
            suggestions.append(f"환불/반품 문의가 {cnt}건으로 집계됩니다. 환불 처리 기준을 명확히 안내하고 처리 속도를 개선하세요.")
        elif cat == "품질":
            suggestions.append(f"품질 불만이 {cnt}건입니다. 입고 검수 기준 강화 및 불량 원인 추적 체계를 점검하세요.")
        elif cat == "직원 응대":
            suggestions.append(f"직원 응대 관련 부정 VOC가 {cnt}건입니다. 현장 응대 매뉴얼 교육을 우선 검토하세요.")
        elif cat == "앱 오류":
            suggestions.append(f"앱 오류 보고가 {cnt}건입니다. 주요 오류 재현 후 긴급 패치를 고려하세요.")

    for kw_info in rising[:2]:
        kw = kw_info["keyword"]
        change = kw_info["change"]
        suggestions.append(f"'{kw}' 키워드가 {change} 급증했습니다. 해당 이슈를 우선 모니터링하세요.")

    if neg_ratio > 50:
        suggestions.append(f"전체 VOC의 {neg_ratio}%가 부정 의견입니다. 고객 경험 전반에 대한 긴급 점검이 필요합니다.")

    return suggestions[:5]
