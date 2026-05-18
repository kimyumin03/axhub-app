"""
Rule-based analysis service.
LLM 연동 시 이 파일만 교체하면 됩니다 — 인터페이스는 동일하게 유지.
"""

import re
from typing import TypedDict

CATEGORY_RULES: dict[str, list[str]] = {
    "배송": ["배송", "택배", "배달", "출고", "도착", "지연", "늦"],
    "환불": ["환불", "취소", "반품", "교환", "돌려"],
    "품질": ["품질", "불량", "파손", "망가", "고장", "냄새", "맛", "상한"],
    "가격": ["가격", "비싸", "할인", "쿠폰", "포인트", "가성비"],
    "직원 응대": ["직원", "상담", "응대", "친절", "불친절", "무시", "태도"],
    "예약": ["예약", "예약취소", "노쇼", "대기", "자리"],
    "결제": ["결제", "카드", "오류", "이중", "중복", "청구"],
    "앱 오류": ["앱", "어플", "로그인", "오류", "버그", "튕", "느려", "안됨", "안돼"],
}

NEGATIVE_WORDS = ["불만", "화", "짜증", "최악", "실망", "별로", "나쁨", "불편", "문제", "이상", "안됨", "못", "없음", "지연", "오류", "불량", "파손", "늦", "환불", "취소", "거절"]
POSITIVE_WORDS = ["좋", "만족", "훌륭", "최고", "감사", "빠르", "친절", "깔끔", "완벽", "추천", "재구매", "최애"]


class AnalysisResult(TypedDict):
    category: str
    sentiment: str
    keywords: list[str]
    priority_score: str


def analyze(text: str, rating: float | None = None) -> AnalysisResult:
    lower = text.lower()

    category = _classify_category(lower)
    sentiment = _classify_sentiment(lower, rating)
    keywords = _extract_keywords(text, category)
    priority_score = _calc_priority(sentiment, keywords)

    return AnalysisResult(
        category=category,
        sentiment=sentiment,
        keywords=keywords,
        priority_score=priority_score,
    )


def _classify_category(text: str) -> str:
    scores: dict[str, int] = {}
    for cat, words in CATEGORY_RULES.items():
        scores[cat] = sum(1 for w in words if w in text)
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "기타"


def _classify_sentiment(text: str, rating: float | None) -> str:
    neg = sum(1 for w in NEGATIVE_WORDS if w in text)
    pos = sum(1 for w in POSITIVE_WORDS if w in text)

    if rating is not None:
        if rating <= 2:
            neg += 2
        elif rating >= 4:
            pos += 2

    if neg > pos:
        return "negative"
    if pos > neg:
        return "positive"
    return "neutral"


def _extract_keywords(text: str, category: str) -> list[str]:
    keywords: list[str] = []
    if category != "기타":
        keywords.append(category)

    patterns = [
        r"(배송\s*지연)", r"(환불\s*거절)", r"(앱\s*오류)", r"(로그인\s*오류)",
        r"(품질\s*문제)", r"(직원\s*불친절)", r"(결제\s*오류)", r"(예약\s*취소)",
    ]
    for p in patterns:
        m = re.search(p, text)
        if m:
            kw = m.group(1).replace(" ", " ")
            if kw not in keywords:
                keywords.append(kw)

    return keywords[:5]


def _calc_priority(sentiment: str, keywords: list[str]) -> str:
    if sentiment == "negative" and len(keywords) >= 2:
        return "high"
    if sentiment == "negative":
        return "medium"
    if sentiment == "neutral":
        return "low"
    return "low"
