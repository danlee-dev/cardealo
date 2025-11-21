# Cardealo 테스트 결제 시스템

테스트용 QR 코드 기반 결제 시스템 구현 문서입니다.

## 시스템 구조

```
[사용자 앱 (React Native Expo)]
         ↓ QR/바코드 생성
         ↓
[관리자 웹 (Next.js)] → QR 스캔
         ↓
[관리자 백엔드 (FastAPI + PostgreSQL)]
         ↓ 결제 정보 전송
         ↓
[사용자 백엔드 (Flask + SQLite)]
         ↓ 한도/실적 업데이트
         ↓
[사용자 앱] → 결제 완료 알림
```

## 디렉토리 구조

```
cardealo/
├── admin-frontend/          # 관리자 웹 (Next.js)
│   ├── app/
│   │   ├── page.tsx        # 대시보드
│   │   ├── scan/           # QR 스캔
│   │   ├── payment/        # 결제 처리
│   │   └── history/        # 결제 기록
│   └── package.json
│
├── admin-backend/           # 관리자 백엔드 (FastAPI)
│   ├── app/
│   │   ├── main.py
│   │   ├── api/            # API 라우터
│   │   ├── models/         # DB 모델
│   │   ├── schemas/        # Pydantic 스키마
│   │   └── services/       # 비즈니스 로직
│   ├── requirements.txt
│   └── Dockerfile
│
├── backend/                 # 사용자 백엔드 (Flask)
│   ├── app.py
│   └── services/
│       └── database.py     # MyCard, PaymentHistory 모델
│
└── frontend/                # 사용자 앱 (React Native)
    └── src/
        └── screens/
            └── ProfileScreen.tsx
```

## 주요 기능

### 1. QR/바코드 생성 (사용자 앱)
- 사용자가 카드 선택 시 실시간 QR 코드 생성
- 5분 타임스탬프 만료 시간
- HMAC 서명으로 보안 강화

### 2. QR 스캔 (관리자 웹)
- HTML5 QRCode 라이브러리 사용
- 카메라 접근 및 실시간 스캔
- 스캔 완료 시 자동으로 결제 화면 이동

### 3. 혜택 계산 (관리자 백엔드)
- QR 데이터 검증 (서명, 타임스탬프)
- 카드 혜택 DB 조회
- 실시간 할인 금액 계산

### 4. 결제 처리 (관리자 백엔드)
- Transaction 생성 및 저장
- Webhook으로 사용자 백엔드에 전송
- 결제 완료 상태 업데이트

### 5. 한도/실적 업데이트 (사용자 백엔드)
- 카드별 월 한도, 사용 금액 추적
- 일/월 사용 횟수 카운트
- 매월 1일 자동 리셋

### 6. 결제 완료 알림 (사용자 앱)
- 5초 간격 폴링으로 최근 결제 조회
- Alert로 결제 완료 알림
- 카드 한도 정보 실시간 업데이트

## 데이터베이스 스키마

### 관리자 PostgreSQL

#### merchants (가맹점)
- id, place_id, name, category, address, latitude, longitude

#### payment_transactions (결제 기록)
- id, transaction_id, merchant_id, user_id, card_id
- payment_amount, discount_amount, final_amount
- benefit_text, payment_status, qr_data

#### card_benefits (카드 혜택)
- id, card_name, category, places, discount_type, discount_value
- max_discount, pre_month_config, limit_config

### 사용자 SQLite

#### MyCard (사용자 카드) - 새로 추가된 필드
- monthly_limit (월 한도)
- used_amount (사용 금액)
- monthly_performance (월 실적)
- daily_count, monthly_count
- last_used_date, reset_date

#### PaymentHistory (결제 내역) - 신규 테이블
- transaction_id, user_id, card_id, merchant_name
- payment_amount, discount_amount, final_amount
- benefit_text, payment_date

## API 엔드포인트

### 사용자 백엔드 (Flask)

#### POST /api/qr/generate
QR/바코드 생성
```json
Request:
{
  "card_id": 1,
  "type": "qr"
}

Response:
{
  "qr_image": "data:image/png;base64,...",
  "expires_in": 300
}
```

#### POST /api/payment/webhook
관리자로부터 결제 정보 수신 (관리자 전용)
```json
{
  "transaction_id": "uuid",
  "user_id": "hong_gildong",
  "card_id": 1,
  "merchant_name": "스타벅스",
  "payment_amount": 5000,
  "discount_amount": 500,
  "final_amount": 4500
}
```

#### GET /api/card/limits
카드 한도/실적 조회

#### GET /api/payment/recent
최근 결제 내역 조회 (알림용)

### 관리자 백엔드 (FastAPI)

#### POST /api/qr/scan
QR 스캔 및 혜택 계산
```json
{
  "qr_data": "...",
  "merchant_id": 1,
  "payment_amount": 5000
}
```

#### POST /api/payment/process
결제 처리
```json
{
  "transaction_id": "uuid",
  "confirm": true
}
```

#### GET /api/payment/history
결제 기록 조회 (가맹점별 > 사용자별 온톨로지)

## 보안

### QR 데이터 서명
```python
signature = hmac.new(
    JWT_SECRET.encode(),
    json.dumps(qr_data).encode(),
    hashlib.sha256
).hexdigest()
```

### 관리자 인증
```python
Authorization: Bearer {ADMIN_SECRET_KEY}
```

### 타임스탬프 검증
- QR 코드는 5분 후 만료
- 재사용 공격 방지

## 설치 및 실행

### 관리자 백엔드

```bash
cd admin-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# PostgreSQL 설정
export DATABASE_URL="postgresql://user:password@localhost:5432/cardealo_admin"
export JWT_SECRET="your-secret"
export ADMIN_SECRET_KEY="your-admin-secret"
export USER_BACKEND_URL="http://localhost:5001"

# 실행
uvicorn app.main:app --reload --port 8000
```

### 관리자 프론트엔드

```bash
cd admin-frontend
npm install

# 환경 변수 설정 (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your-key

# 실행
npm run dev
```

### 사용자 백엔드

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt

# 환경 변수 추가
export ADMIN_SECRET_KEY="your-admin-secret"
export JWT_SECRET="your-secret"

# 실행
python app.py
```

### 사용자 앱

```bash
cd frontend
npm install
npm start
```

## 배포

### Railway (관리자 백엔드)
1. Railway 프로젝트 생성
2. PostgreSQL 데이터베이스 추가
3. 환경 변수 설정
4. `railway up` 또는 GitHub 연동

### Vercel (관리자 프론트엔드)
1. Vercel 프로젝트 연결
2. 환경 변수 설정
3. 자동 배포

### Railway (사용자 백엔드)
- 기존 배포 유지
- 환경 변수에 ADMIN_SECRET_KEY 추가

### EAS (사용자 앱)
```bash
cd frontend
eas update --channel preview
```

## 테스트 시나리오

1. 사용자 앱 로그인 (hong_gildong / test1234!)
2. 프로필 화면에서 카드 선택
3. QR 코드 생성 확인
4. 관리자 웹에서 QR 스캔
5. 결제 금액 입력 (5,000원)
6. 혜택 계산 확인 (750원 할인)
7. 결제 완료
8. 사용자 앱에서 결제 완료 알림 수신
9. 카드 한도 업데이트 확인
10. 관리자 웹에서 결제 기록 조회

## 주의사항

1. 가짜 데이터 없음 - 모든 데이터는 실제 DB에서 조회
2. 임시 fallback 없음 - 에러 발생 시 명확한 에러 메시지
3. 보안 중요 - QR 서명 검증 필수
4. HTTPS 사용 권장 (프로덕션)
5. PostgreSQL 백업 정기적으로 수행

## 문제 해결

### QR 스캔이 안 될 때
- 카메라 권한 확인
- HTTPS 환경인지 확인 (로컬은 HTTP 가능)
- QR 코드 유효기간 확인 (5분)

### 혜택이 계산되지 않을 때
- card_benefits 테이블에 데이터 있는지 확인
- 카드명이 정확히 일치하는지 확인
- 가맹점 카테고리 매핑 확인

### Webhook이 실패할 때
- 사용자 백엔드 URL 확인
- ADMIN_SECRET_KEY 일치 확인
- 네트워크 연결 확인

## 라이센스

MIT License
