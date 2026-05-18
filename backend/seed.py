"""
쇼핑몰 운영사 시나리오 더미 데이터 시딩.
최근 7일간 배송 지연 이슈 급증 패턴을 포함합니다.
실행: uv run python seed.py [--reset]
"""
import sys
import random
from datetime import datetime, timedelta, UTC
from database import SessionLocal, engine
import models
from auth import hash_password
from services.analysis import analyze

random.seed(42)
models.Base.metadata.create_all(bind=engine)

PRODUCTS = ["여름 원피스", "청바지", "운동화", "스니커즈", "백팩", "선글라스", "니트", "가디건", "반팔 티셔츠", "레깅스"]

# ── 카테고리별 VOC 텍스트 풀 ──────────────────────────────────────────────────

DELIVERY_COMPLAINTS = [
    ("주문한 지 5일이 지났는데 아직도 배송이 안 왔어요. 출고는 됐다고 하는데 택배 조회가 안 됩니다.", 1),
    ("배송이 너무 늦어요. 빠른 배송 선택했는데 3일째 기다리고 있습니다.", 1),
    ("배송지연 안내 문자도 없이 그냥 기다리라고만 하네요. 언제 오는 건가요?", 2),
    ("출고가 됐다고 알림 왔는데 이틀이 지나도 택배사 조회가 안 됩니다. 어떻게 된 건가요?", 2),
    ("급하게 필요해서 주문했는데 배송 지연으로 행사날 못 입게 됐어요. 너무 실망입니다.", 1),
    ("배송 예정일이 이미 지났는데 연락도 없고 배송도 안 왔습니다.", 1),
    ("이번이 세 번째 구매인데 항상 배송이 늦어요. 이번엔 정말 기다리다 지쳤습니다.", 2),
    ("오배송됐어요. 다른 제품이 왔습니다. 교환 요청했는데 아직 답이 없어요.", 1),
    ("배송 중에 박스가 완전히 찌그러진 채로 왔어요. 내용물도 파손됐습니다.", 1),
    ("배송지연이 벌써 일주일째입니다. 고객센터 연결도 안 되고 너무 힘드네요.", 1),
]

DELIVERY_SPIKE = [  # 최근 7일 급증분
    ("어제 주문했는데 배송 지연이라고 알림이 왔어요. 이게 맞나요?", 2),
    ("배송이 또 지연됐어요. 지난번에도 이런 일이 있었는데 개선이 안 되는 것 같아요.", 2),
    ("배송 지연 때문에 선물로 준비했던 게 다 망했어요. 환불해주세요.", 1),
    ("출고 완료 문자 받은 지 4일이 지났는데 배송이 안 왔습니다. 분실된 건가요?", 1),
    ("택배 기사님이 배송 완료 처리를 해놨는데 실제로 받지 못했어요. 확인 부탁드립니다.", 1),
    ("배송 지연으로 인해 반품 신청합니다. 이미 필요한 시점이 지났어요.", 1),
    ("배송 예정일보다 3일 늦게 왔어요. 특별한 설명도 없었고요.", 2),
    ("이번 배송 정말 너무 느렸어요. 다음번엔 다른 곳에서 살 것 같아요.", 2),
    ("주문 후 열흘이 지났는데 아직도 배송 중이에요. 어떻게 된 건지 알고 싶습니다.", 1),
    ("배송이 늦어서 취소 요청했는데 이미 발송됐다고 취소가 안 된다고 하네요.", 1),
    ("배송 지연 문제가 최근에 계속 발생하는 것 같던데, 해결될 예정인가요?", 2),
    ("빠른 배송 옵션 결제했는데 일반 배송보다도 늦게 왔어요. 차액 환불 요청드립니다.", 1),
]

REFUND_COMPLAINTS = [
    ("환불 신청한 지 10일이 지났는데 아직도 처리가 안 됐어요.", 1),
    ("반품 택배 보낸 지 5일이 됐는데 환불이 안 들어왔어요.", 2),
    ("환불 처리 기간이 왜 이렇게 길어요? 다른 쇼핑몰은 3일 안에 다 돼요.", 2),
    ("사이즈 교환 요청했는데 재고가 없다고 해서 환불 요청했더니 절차가 너무 복잡해요.", 2),
    ("제품 하자로 반품 신청했는데 제 귀책이라며 왕복 택배비를 부과했어요. 억울합니다.", 1),
    ("환불 완료 문자 왔는데 실제 입금이 안 됐어요. 확인 부탁드립니다.", 1),
]

QUALITY_COMPLAINTS = [
    ("받자마자 봉제 상태가 엉망이에요. 실밥도 많고 솔기가 다 터져 있어요.", 1),
    ("사진에서 보던 색상이랑 실물이 완전히 달라요. 색상 보정이 너무 심한 것 같아요.", 2),
    ("세탁 한 번 했더니 색이 빠지고 늘어났어요. 품질이 너무 나쁩니다.", 1),
    ("소재가 홈페이지 설명과 달라요. 폴리 100%라고 하더니 만져보니 아니에요.", 2),
    ("지퍼가 처음부터 잘 안 잠겨요. 불량품인 것 같습니다.", 1),
    ("착용 이틀 만에 단추가 떨어졌어요. 내구성이 너무 낮아요.", 1),
    ("냄새가 너무 심해요. 세탁 두 번 했는데도 화학 냄새가 빠지지 않아요.", 2),
    ("포장이 너무 대충 되어있었고 제품에 흠집이 있었어요.", 2),
]

CS_COMPLAINTS = [
    ("고객센터 전화가 30분 동안 연결이 안 됐어요. 챗봇도 쓸모가 없고요.", 2),
    ("상담사가 너무 무뚝뚝하고 제 질문을 제대로 안 듣는 것 같아요.", 2),
    ("같은 문제로 세 번 전화했는데 매번 다른 답변을 받았습니다.", 1),
    ("문의 이메일 보낸 지 5일이 됐는데 아직 답장이 없어요.", 2),
    ("담당자가 책임을 계속 다른 부서로 넘기기만 해요. 해결이 안 되고 있어요.", 1),
]

POSITIVE_REVIEWS = [
    ("배송도 빠르고 상품 품질도 정말 만족스러워요! 재구매 의사 100%입니다.", 5),
    ("패키징이 너무 예쁘게 되어있어서 선물하기 딱 좋아요. 품질도 훌륭합니다.", 5),
    ("가격 대비 품질이 정말 좋아요. 사진보다 실물이 더 예쁘네요!", 5),
    ("사이즈 고민했는데 문의 남겼더니 빠르게 친절하게 답해주셨어요. 덕분에 잘 골랐어요.", 5),
    ("처음 구매했는데 품질에 깜짝 놀랐어요. 이 가격에 이 퀄리티면 대박이에요.", 5),
    ("빠른 배송에 꼼꼼한 포장까지! 다음에도 꼭 이용할게요.", 5),
    ("소재가 너무 좋아요. 가볍고 시원해서 여름에 딱이에요.", 4),
    ("색상이 사진이랑 거의 똑같아요. 믿고 살 수 있는 쇼핑몰이에요.", 4),
    ("교환 요청했는데 빠르게 처리해주셔서 감사해요. 친절한 응대에 감동받았습니다.", 5),
    ("단골이 됐어요. 매번 퀄리티를 유지해주셔서 감사합니다.", 5),
]

NEUTRAL_INQUIRIES = [
    ("사이즈가 평소 사이즈랑 다른지 궁금해요. 키 168에 55kg인데 M이 맞을까요?", 3),
    ("재입고 예정이 있나요? 품절 상품인데 꼭 사고 싶어요.", 3),
    ("쿠폰 사용 방법을 모르겠어요. 어디서 적용하나요?", 3),
    ("세탁 방법이 궁금해요. 드라이클리닝만 가능한가요?", 3),
    ("포인트 적립이 안 된 것 같아요. 확인 부탁드립니다.", 3),
    ("주문 취소가 가능한지 알고 싶어요. 아직 발송 전인 것 같은데요.", 3),
]


def _add_record(db, user_id, idx, text, src, product, rating, days_ago):
    now = datetime.now(UTC).replace(tzinfo=None)
    created = now - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
    record = models.VocRecord(
        user_id=user_id,
        external_id=f"SM-{idx:04d}",
        created_at=created,
        source_type=src,
        product_name=product,
        branch_name=None,
        customer_text=text,
        rating=float(rating) if rating is not None else None,
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
    return record


def seed(reset: bool = False):
    db = SessionLocal()
    try:
        existing = db.query(models.User).filter(models.User.email == "demo@voc.com").first()
        if existing:
            if not reset:
                print("이미 시딩된 데이터가 있습니다. 재시딩하려면 --reset 플래그를 사용하세요.")
                return
            # reset: 기존 데이터 삭제
            db.query(models.VocAnalysis).filter(
                models.VocAnalysis.voc_record_id.in_(
                    db.query(models.VocRecord.id).filter(models.VocRecord.user_id == existing.id)
                )
            ).delete(synchronize_session=False)
            db.query(models.VocRecord).filter(models.VocRecord.user_id == existing.id).delete()
            db.query(models.Report).filter(models.Report.user_id == existing.id).delete()
            db.flush()
            user = existing
        else:
            user = models.User(
                email="demo@voc.com",
                name="스타일마켓 운영팀",
                password_hash=hash_password("demo1234"),
            )
            db.add(user)
            db.flush()

        idx = 1

        # ── 과거 23일치 (D-30 ~ D-8): 배송 불만 10건, 환불 6건, 품질 8건, CS 5건, 긍정 12건, 중립 6건
        old_batches = [
            (DELIVERY_COMPLAINTS, "complaint", 10, 8, 30),
            (REFUND_COMPLAINTS,   "complaint",  6, 8, 30),
            (QUALITY_COMPLAINTS,  "complaint",  8, 8, 30),
            (CS_COMPLAINTS,       "complaint",  5, 8, 30),
            (POSITIVE_REVIEWS,    "review",    12, 8, 30),
            (NEUTRAL_INQUIRIES,   "inquiry",    6, 8, 30),
        ]
        for pool, src, count, day_min, day_max in old_batches:
            for _ in range(count):
                text, rating = random.choice(pool)
                product = random.choice(PRODUCTS)
                days_ago = random.randint(day_min, day_max)
                _add_record(db, user.id, idx, text, src, product, rating, days_ago)
                idx += 1

        # ── 최근 7일 (D-7 ~ D-0): 배송 지연 급증 (일반 배송 불만 + spike 12건)
        for text, rating in DELIVERY_SPIKE:
            product = random.choice(PRODUCTS)
            days_ago = random.randint(0, 6)
            _add_record(db, user.id, idx, text, "complaint", product, rating, days_ago)
            idx += 1

        # 최근 7일 기타 (환불 3, 품질 3, 긍정 5, 중립 3)
        recent_others = [
            (REFUND_COMPLAINTS,  "complaint", 3, 0, 6),
            (QUALITY_COMPLAINTS, "complaint", 3, 0, 6),
            (POSITIVE_REVIEWS,   "review",    5, 0, 6),
            (NEUTRAL_INQUIRIES,  "inquiry",   3, 0, 6),
        ]
        for pool, src, count, day_min, day_max in recent_others:
            for _ in range(count):
                text, rating = random.choice(pool)
                product = random.choice(PRODUCTS)
                days_ago = random.randint(day_min, day_max)
                _add_record(db, user.id, idx, text, src, product, rating, days_ago)
                idx += 1

        db.commit()
        total = idx - 1
        print(f"시딩 완료 ─ 사용자: demo@voc.com / demo1234 | VOC {total}건")
        print(f"  └ 최근 7일 배송 이슈 급증 패턴 포함 ({len(DELIVERY_SPIKE)}건)")
    finally:
        db.close()


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
