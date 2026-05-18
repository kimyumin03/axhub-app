"""
Rule-based VOC analysis service.
LLM 교체 시 이 파일의 `analyze()` 함수만 교체하면 됩니다 — TypedDict 인터페이스 유지.
"""

import re
from typing import TypedDict

# ── 카테고리 키워드 가중치 (단어: 점수) ──────────────────────────────────────
CATEGORY_WEIGHTS: dict[str, dict[str, int]] = {
    "배송": {
        "배송지연": 5, "배송 지연": 5, "배송이 늦": 4, "출고가 안": 4, "아직 안 왔": 4,
        "배송": 2, "택배": 2, "배달": 2, "출고": 2, "도착": 1, "지연": 2, "늦": 1,
        "운송": 1, "배송조회": 2, "송장": 2, "반송": 3,
    },
    "환불/반품": {
        "환불 거절": 5, "환불이 안": 5, "환불 처리": 4, "반품 거절": 5,
        "환불": 3, "반품": 3, "취소": 2, "교환": 2, "돌려": 2, "반환": 2, "철회": 2,
    },
    "상품 품질": {
        "불량품": 5, "파손됐": 5, "파손": 4, "불량": 4, "망가": 4, "고장": 4,
        "품질": 2, "냄새": 3, "변색": 4, "찢어": 4, "얼룩": 3, "오염": 3,
        "사진과 다": 4, "설명과 다": 4, "실물이 달": 4, "기대 이하": 3,
    },
    "가격/할인": {
        "너무 비싸": 4, "가격 대비": 3, "가성비": 3,
        "가격": 2, "비싸": 3, "할인": 2, "쿠폰": 2, "포인트": 2, "적립": 2, "이벤트": 1,
    },
    "고객센터": {
        "직원이 무시": 5, "불친절": 4, "응대가 나": 4, "상담사가": 3,
        "직원": 2, "상담": 2, "응대": 2, "친절": 2, "태도": 3, "전화": 1, "답변": 2,
    },
    "결제": {
        "이중 결제": 5, "중복 결제": 5, "결제 오류": 4, "결제가 안": 4,
        "결제": 2, "카드": 2, "청구": 2, "영수증": 2, "PG": 2, "간편결제": 2,
    },
    "앱/웹 오류": {
        "로그인이 안": 5, "앱이 튕": 5, "로딩이 안": 4, "오류 메시지": 4,
        "앱": 2, "어플": 2, "오류": 3, "버그": 3, "느려": 3, "안됨": 3, "안돼": 3, "로그인": 2,
    },
    "포장": {
        "포장이 엉망": 5, "포장 불량": 5, "박스가 찌그러": 4, "포장이 뜯겨": 4,
        "포장": 2, "박스": 2, "에어캡": 2, "완충재": 2,
    },
}

# ── 감정 키워드 (단어: 점수) ──────────────────────────────────────────────────
NEGATIVE_W: dict[str, int] = {
    "최악": 4, "쓰레기": 4, "환불할게요": 4, "다시는": 4, "고소": 4,
    "불만": 3, "실망": 3, "화났": 3, "짜증": 3, "어이없": 3, "황당": 3,
    "별로": 2, "나쁨": 2, "불편": 2, "문제": 2, "이상": 2, "오류": 2,
    "지연": 2, "불량": 2, "파손": 2, "늦": 1, "못": 1, "안됨": 2,
    "재구매 안": 3, "이용 안": 3, "탈퇴": 3,
}
POSITIVE_W: dict[str, int] = {
    "최고": 4, "완벽": 4, "강추": 4, "대만족": 4,
    "만족": 3, "훌륭": 3, "좋아요": 3, "감사": 3, "행복": 3,
    "좋": 2, "빠르": 2, "친절": 2, "깔끔": 2, "추천": 2, "재구매": 3,
    "또 살게": 3, "또 구매": 3, "또 이용": 3,
}

# 부정어 앞에 긍정어가 오면 감정 반전
NEGATION_PATTERNS = [r"(좋|만족|훌륭|추천|완벽).{0,5}(않|안|못|없|아니)"]

# 카테고리별 긴급도 (priority 계산에 사용)
URGENCY: dict[str, int] = {
    "결제": 5, "환불/반품": 5, "상품 품질": 4,
    "배송": 3, "고객센터": 3, "앱/웹 오류": 3,
    "포장": 2, "가격/할인": 1,
}

# 복합 키워드 패턴 (추출용)
KEYWORD_PATTERNS = [
    r"배송\s*지연", r"환불\s*거절", r"환불\s*지연", r"반품\s*거절",
    r"이중\s*결제", r"중복\s*결제", r"결제\s*오류",
    r"앱\s*오류", r"로그인\s*오류", r"로그인\s*안",
    r"포장\s*불량", r"포장\s*파손", r"상품\s*불량", r"상품\s*파손",
    r"불친절", r"응대\s*불량", r"직원\s*태도",
    r"출고\s*지연", r"배송\s*누락", r"오배송",
    r"사진과\s*다름", r"설명과\s*다름", r"실물\s*차이",
    r"재구매\s*의사", r"단골\s*고객", r"재이용",
]


class AnalysisResult(TypedDict):
    category: str
    sentiment: str
    keywords: list[str]
    priority_score: str  # low / medium / high


def analyze(text: str, rating: float | None = None) -> AnalysisResult:
    normalized = _normalize(text)
    category = _classify_category(normalized)
    sentiment = _classify_sentiment(normalized, text, rating)
    keywords = _extract_keywords(text, normalized, category)
    priority_score = _calc_priority(sentiment, category, rating, keywords)
    return AnalysisResult(
        category=category,
        sentiment=sentiment,
        keywords=keywords,
        priority_score=priority_score,
    )


def _normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    return text


def _classify_category(text: str) -> str:
    scores: dict[str, float] = {}
    for cat, kw_map in CATEGORY_WEIGHTS.items():
        score = 0.0
        for kw, w in kw_map.items():
            if kw in text:
                score += w
        scores[cat] = score
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "기타"


def _classify_sentiment(normalized: str, original: str, rating: float | None) -> str:
    neg = sum(w for kw, w in NEGATIVE_W.items() if kw in normalized)
    pos = sum(w for kw, w in POSITIVE_W.items() if kw in normalized)

    # 부정 표현이 긍정어를 감싸는 패턴 ("만족스럽지 않다")
    for pat in NEGATION_PATTERNS:
        if re.search(pat, normalized):
            pos = max(0, pos - 3)
            neg += 2

    # 평점 반영 (강한 신호)
    if rating is not None:
        if rating == 1:
            neg += 6
        elif rating == 2:
            neg += 3
        elif rating == 3:
            pass  # neutral signal
        elif rating == 4:
            pos += 3
        elif rating == 5:
            pos += 6

    if neg > pos:
        return "negative"
    if pos > neg:
        return "positive"
    return "neutral"


def _extract_keywords(original: str, normalized: str, category: str) -> list[str]:
    found: list[str] = []

    # 복합 패턴 우선 추출
    for pat in KEYWORD_PATTERNS:
        m = re.search(pat, normalized)
        if m:
            raw = m.group(0).strip()
            kw = re.sub(r"\s+", " ", raw)
            if kw not in found:
                found.append(kw)

    # 카테고리명 추가 (복합 키워드와 중복 안 되면)
    cat_short = category.split("/")[0]
    if not any(cat_short in f for f in found):
        found.insert(0, cat_short)

    return found[:5]


def _calc_priority(sentiment: str, category: str, rating: float | None, keywords: list[str]) -> str:
    score = 0

    # 감정 기여
    if sentiment == "negative":
        score += 3
    elif sentiment == "neutral":
        score += 1

    # 카테고리 긴급도
    score += URGENCY.get(category, 1)

    # 평점 기여
    if rating is not None:
        if rating <= 1:
            score += 3
        elif rating == 2:
            score += 2

    # 복합 키워드 수
    score += min(len(keywords), 3)

    if score >= 9:
        return "high"
    if score >= 5:
        return "medium"
    return "low"
