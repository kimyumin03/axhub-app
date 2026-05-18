# 피드백 분석 — 고객 피드백 자동 분류·분석 SaaS

B2B 고객사가 보유한 리뷰·문의·불만 데이터를 업로드하면 자동으로 분류·분석하고, 대시보드와 리포트로 시각화해 주는 풀스택 웹 애플리케이션입니다.

---

## 주요 기능

| 기능 | 설명 |
|---|---|
| **CSV / Excel / TXT 업로드** | 3단계 위저드 — 파일 선택 → 컬럼 매핑 → 결과 확인 |
| **컬럼 자동 감지** | 파일 컬럼명을 보고 내부 필드를 자동 추천, 수동 재매핑 가능 |
| **스마트 분석** | 카테고리 분류, 감정 분류, 키워드 추출, 우선순위 산정 |
| **대시보드** | 감정 분포, 카테고리별 피드백, 일별 추이, 제품/지점 부정 순위 |
| **고객 피드백 목록** | 날짜·감정·카테고리·유형·키워드 필터 + 페이지네이션 |
| **리포트 생성·삭제** | 기간 지정 → TOP 이슈·급증 키워드·개선 제안 자동 생성 |
| **JWT 인증** | 회원가입 / 로그인, 토큰 기반 API 보호 |

---

## 기술 스택

**Frontend** — Next.js 15 (App Router) · TypeScript · Tailwind CSS · Recharts · Axios  
**Backend** — FastAPI · SQLAlchemy · SQLite · python-jose (JWT) · bcrypt · pandas · openpyxl  
**Dev** — uv (Python 패키지 관리) · npm

---

## 로컬 실행

### 사전 요구사항
- Node.js 18+
- Python 3.13+
- [uv](https://docs.astral.sh/uv/) 설치

### 백엔드 (터미널 1)

```bash
cd backend
uv run uvicorn main:app --reload
# http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

### 프론트엔드 (터미널 2)

```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

### 데모 데이터 시딩 (선택)

```bash
cd backend
uv run python seed.py          # 73건 쇼핑몰 데모 데이터 삽입
uv run python seed.py --reset  # DB 초기화 후 재삽입
```

---

## 업로드 파일 형식

| 항목 | 내용 |
|---|---|
| **지원 형식** | CSV, XLSX, XLS, TXT |
| **최대 크기** | 100MB (~35만 행) |
| **필수 컬럼** | 고객 원문 (컬럼명 무관 — 업로드 시 매핑) |
| **선택 컬럼** | 날짜, 유형(review/inquiry/complaint), 제품명, 지점명, 평점(1~5) |
| **TXT 처리** | 구분자 자동 감지(탭·쉼표·파이프) / 한 줄=리뷰 형식 모두 지원 |

---

## 프로젝트 구조

```
axhub/
├── backend/
│   ├── main.py              # FastAPI 앱, 라우터 등록
│   ├── models.py            # SQLAlchemy 모델
│   ├── database.py          # DB 연결 (SQLite: voc.db)
│   ├── auth.py              # JWT 인증, bcrypt 해싱
│   ├── seed.py              # 데모 데이터
│   ├── routers/
│   │   ├── auth.py          # /auth/*
│   │   ├── voc.py           # /voc/* (업로드·대시보드·피드백 목록)
│   │   └── reports.py       # /reports/*
│   └── services/
│       ├── analysis.py      # 스마트 분석 엔진 (LLM 교체 가능)
│       └── report.py        # 리포트 생성 로직
└── frontend/
    └── src/
        ├── app/
        │   ├── (auth)/      # 로그인·회원가입 페이지
        │   └── (dashboard)/ # 대시보드·업로드·피드백·리포트 페이지
        ├── components/
        │   └── Sidebar.tsx
        └── lib/
            └── api.ts       # Axios 인스턴스 + API 함수
```

---

## 분석 엔진 교체

현재 `backend/services/analysis.py` 의 `analyze()` 함수는 규칙 기반(키워드 가중치)으로 동작합니다.  
LLM(OpenAI / Claude 등)으로 교체할 경우 **이 함수 본문만 교체**하면 됩니다. 반환 타입(`AnalysisResult` TypedDict)을 유지하면 나머지 코드는 무수정입니다.

```python
# services/analysis.py
def analyze(text: str, rating: float | None = None) -> AnalysisResult:
    # 이 블록만 교체
    ...
```
