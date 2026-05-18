"""더미 데이터 시딩 — python seed.py"""
import random
from datetime import datetime, timedelta
from database import SessionLocal, engine
import models
from auth import hash_password
from services.analysis import analyze

models.Base.metadata.create_all(bind=engine)

TEXTS = [
    ("배송이 너무 늦어요. 3일이 지났는데 아직도 출고가 안 됐습니다.", "complaint", "A상품", None, 1),
    ("환불 신청했는데 일주일째 처리가 안 되고 있어요.", "complaint", "B상품", None, 1),
    ("앱 로그인이 계속 오류나요. 어떻게 해야 하나요?", "inquiry", "앱", None, 2),
    ("상품 품질이 정말 좋아요! 재구매 의사 있습니다.", "review", "A상품", None, 5),
    ("직원이 너무 불친절해서 다시는 방문하고 싶지 않아요.", "complaint", "서울지점", None, 1),
    ("가격 대비 품질이 훌륭합니다. 추천합니다!", "review", "C상품", None, 5),
    ("배송 지연 안내도 없이 그냥 기다리라고만 하네요.", "complaint", "B상품", None, 2),
    ("결제 오류가 계속 발생합니다. 카드가 두 번 결제됐어요.", "complaint", "앱", None, 1),
    ("예약이 갑자기 취소됐는데 아무 연락도 없었어요.", "complaint", "부산지점", None, 1),
    ("품질 불량입니다. 받자마자 파손돼 있었어요.", "complaint", "A상품", None, 1),
    ("빠른 배송 감사합니다. 만족스러워요.", "review", "C상품", None, 5),
    ("앱이 너무 느려요. 개선이 필요합니다.", "inquiry", "앱", None, 2),
    ("환불 처리가 빠르고 친절했어요. 감사합니다.", "review", "B상품", None, 4),
    ("가격이 너무 비싸요. 할인 이벤트는 없나요?", "inquiry", "A상품", None, 3),
    ("직원 응대가 매우 친절하고 좋았어요!", "review", "서울지점", None, 5),
    ("배송이 또 지연됐어요. 이번이 세 번째입니다.", "complaint", "B상품", None, 1),
    ("앱 로그인 오류 때문에 구매를 못하고 있어요.", "complaint", "앱", None, 2),
    ("상품 냄새가 이상해요. 불량인 것 같아요.", "complaint", "C상품", None, 1),
    ("포인트가 적립이 안 됐어요. 확인 부탁드립니다.", "inquiry", "앱", None, 3),
    ("전반적으로 만족스럽습니다. 다음에도 이용하겠습니다.", "review", "A상품", None, 4),
]

BRANCHES = ["서울지점", "부산지점", "대구지점", None]


def seed():
    db = SessionLocal()
    try:
        existing = db.query(models.User).filter(models.User.email == "demo@voc.com").first()
        if existing:
            print("이미 시딩된 데이터가 있습니다.")
            return

        user = models.User(
            email="demo@voc.com",
            name="데모 관리자",
            password_hash=hash_password("demo1234"),
        )
        db.add(user)
        db.flush()

        now = datetime.utcnow()
        for i, (text, src, product, _, rating) in enumerate(TEXTS * 4):
            days_ago = random.randint(0, 30)
            created = now - timedelta(days=days_ago, hours=random.randint(0, 23))
            record = models.VocRecord(
                user_id=user.id,
                external_id=f"VOC-{i+1:04d}",
                created_at=created,
                source_type=src,
                product_name=product if random.random() > 0.3 else None,
                branch_name=random.choice(BRANCHES),
                customer_text=text,
                rating=float(rating),
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

        db.commit()
        print(f"시딩 완료 — 사용자: demo@voc.com / demo1234, VOC: {len(TEXTS) * 4}건")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
