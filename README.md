# 소프트웨어 공학 7팀 - CARDEALO

<div align="center">
<img width="300" alt="cardealo-logo" src="https://raw.githubusercontent.com/danlee-dev/cardealo/main/images/cardealo-logo.png">
</div>

<div align="center">
<h3>위치 기반 개인화 카드 혜택 추천 플랫폼</h3>
</div>

> 개발기간: 2025.10 ~ 2025.12
>
> Built with React Native, Flask, FastAPI, PostgreSQL

## 프로젝트 개요

**Cardealo**는 사용자의 위치와 소비 패턴을 분석하여 최적의 신용카드 혜택을 실시간으로 추천하는 플랫폼입니다.

AI 기반 코스 추천, OCR 카드 등록, 실시간 위치 기반 혜택 분석을 통해 사용자 맞춤형 카드 혜택 정보를 제공합니다. 기업용 법인카드 관리 및 가맹점 결제 시스템도 지원합니다.

## 시스템 아키텍처

```
+-------------------+     +-------------------+
|   Mobile App      |     |   Admin Web       |
|  (React Native)   |     |    (Next.js)      |
+--------+----------+     +--------+----------+
         |                         |
         v                         v
+--------+----------+     +--------+----------+
|   User Backend    |<--->|  Admin Backend    |
|     (Flask)       |     |    (FastAPI)      |
+--------+----------+     +--------+----------+
         |                         |
         v                         v
+--------+----------+     +--------+----------+
|   PostgreSQL      |     |   PostgreSQL      |
|   (User DB)       |     |   (Admin DB)      |
+---------+---------+     +-------------------+
          |
          v
+-------------------+
|   External APIs   |
| - Google Places   |
| - Naver Maps/OCR  |
| - TMAP Directions |
| - Gemini AI       |
+-------------------+
```

## 주요 기능

### 위치 기반 실시간 추천
- 현재 위치 기반 실시간 카드 혜택 분석
- Naver Maps 기반 지도 UI
- Google Places API 연동으로 주변 가맹점 정보 제공
- 혜택 점수 기반 마커 색상 분류 (상위/중위/하위)

### AI 코스 추천
- Gemini AI 기반 개인화 데이트/여행 코스 추천
- 사용자 보유 카드 기반 혜택 최적화
- TMAP 연동 경로 안내 (도보/대중교통/자동차)
- 코스 저장 및 친구 공유 기능

### 카드 관리
- OCR 기반 카드 자동 등록 (Naver Cloud OCR)
- 보유 카드 목록 관리 및 혜택 정보 통합
- 카드별 혜택 상세 조회

### OnePay 결제 시스템
- QR/바코드 기반 간편 결제
- 실시간 잔액 관리
- 결제 내역 조회

### 기업용 기능
- 법인카드 등록 및 관리
- 부서별 사용 현황 대시보드
- 직원 결제 권한 관리

### 소셜 기능
- 친구 추가 및 관리
- 코스 공유 및 저장
- 알림 시스템

### 가맹점 관리 (Admin)
- 가맹점 등록 및 인증
- 결제 처리 시스템
- 매출 현황 대시보드

## 기술 스택

### 프론트엔드 (Mobile)
- **프레임워크**: React Native (Expo SDK 54)
- **플랫폼**: Android
- **지도**: Naver Maps (@mj-studio/react-native-naver-map)
- **네비게이션**: React Navigation
- **상태 관리**: React Context API
- **빌드**: EAS Build

### 백엔드 (User)
- **프레임워크**: Flask 3.0
- **데이터베이스**: PostgreSQL (SQLAlchemy ORM)
- **인증**: JWT
- **배포**: Railway

### 백엔드 (Admin)
- **프레임워크**: FastAPI
- **데이터베이스**: PostgreSQL (SQLAlchemy ORM)
- **마이그레이션**: Alembic
- **배포**: Railway

### 프론트엔드 (Admin)
- **프레임워크**: Next.js 15
- **스타일링**: Tailwind CSS
- **언어**: TypeScript

### AI/ML
- **추천 엔진**: Google Gemini AI
- **OCR**: Naver Cloud OCR API

### 외부 API
- **장소 검색**: Google Places API (New)
- **지도**: Naver Maps API
- **경로 안내**: TMAP API (SK OpenAPI)
- **주소 변환**: Naver Geocoding API
- **AI**: Google Gemini API
- **OCR**: Naver Cloud OCR

## 데이터베이스 스키마

### User Backend (17 모델)
- User, MyCard, Card, CardBenefit
- SavedCourse, SavedCourseUser, SharedCourse
- PaymentHistory, Friendship, Notification
- CorporateCard, Employee, EmployeePaymentHistory
- Department, DepartmentMember, QRPayment
- TransactionVerification

### Admin Backend (3 모델)
- AdminMerchant, AdminTransaction, CardBenefit

## 프로젝트 구조

```
cardealo/
  frontend/           # React Native 모바일 앱
    src/
      screens/        # 20개 화면
      contexts/       # AuthContext
      utils/          # API, 유틸리티
  backend/            # Flask 사용자 백엔드
    services/         # 비즈니스 로직
    ai/               # Gemini AI 서비스
    app.py            # 메인 애플리케이션
  admin-backend/      # FastAPI 가맹점 백엔드
    app/
      routers/        # API 라우터
      services/       # 결제 서비스
      schemas/        # Pydantic 스키마
  admin-frontend/     # Next.js 가맹점 웹
    app/              # 페이지
  docs/               # 문서
```

## 시작하기

### 필수 요구사항
- Node.js 18+
- Python 3.9+
- PostgreSQL 14+
- Expo CLI
- Android Studio (Android 개발용)

### 환경 변수 설정

**Backend (.env)**
```bash
NCP_CLIENT_ID=<Naver Cloud Platform Client ID>
NCP_CLIENT_SECRET=<Naver Cloud Platform Secret>
GOOGLE_MAPS_API_KEY=<Google Maps API Key>
GEMINI_API_KEY=<Google Gemini API Key>
TMAP_API_KEY=<TMAP API Key>
NAVER_OCR_SECRET_KEY=<Naver OCR Secret Key>
NAVER_OCR_INVOKE_URL=<Naver OCR Invoke URL>
JWT_SECRET=<JWT Secret Key>
ADMIN_SECRET_KEY=<Admin Secret Key>
```

**Frontend (.env)**
```bash
EXPO_PUBLIC_NAVER_MAP_CLIENT_ID=<Naver Map Client ID>
EXPO_PUBLIC_NAVER_MAP_CLIENT_SECRET=<Naver Map Client Secret>
EXPO_PUBLIC_API_URL=http://127.0.0.1:5001
EXPO_PUBLIC_ENABLE_LOCATION_DEBUG=true
EXPO_PUBLIC_ENABLE_TEST_LOGIN=true
```

**Admin-Backend (.env)**
```bash
DATABASE_URL=<PostgreSQL URL>
JWT_SECRET=<JWT Secret Key>
ADMIN_SECRET_KEY=<Admin Secret Key>
USER_BACKEND_URL=<User Backend URL>
GOOGLE_MAPS_API_KEY=<Google Maps API Key>
```

### 설치 및 실행

**프론트엔드**
```bash
cd frontend
npm install
npx expo start
```

**백엔드**
```bash
cd backend
pip install -r requirements.txt
python app.py
```

**Admin 백엔드**
```bash
cd admin-backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Admin 프론트엔드**
```bash
cd admin-frontend
npm install
npm run dev
```

## API 문서

### User Backend API
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/auth/login | 로그인 |
| POST | /api/auth/signup | 회원가입 |
| GET | /api/nearby-recommendations | 주변 가맹점 추천 |
| POST | /api/ai/recommend-course | AI 코스 추천 |
| POST | /api/cards/register-ocr | OCR 카드 등록 |
| GET | /api/cards/my-cards | 보유 카드 목록 |
| POST | /api/courses/save | 코스 저장 |
| POST | /api/courses/share | 코스 공유 |
| GET | /api/transit-route | 대중교통 경로 |
| POST | /api/qr-payment | QR 결제 |

### Admin Backend API
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/merchants/register | 가맹점 등록 |
| POST | /api/merchants/login | 가맹점 로그인 |
| POST | /api/payments/process | 결제 처리 |
| GET | /api/payments/history | 결제 내역 |

## 참여자

| 이성민 (Seongmin Lee) | 민제민 (Jemin Min) |
| --- | --- |
| <img src="https://avatars.githubusercontent.com/danlee-dev" width="160px" alt="Seongmin Lee" /> | <img src="https://avatars.githubusercontent.com/AliceLacie" width="160px" alt="Jemin Min" /> |
| [GitHub: @danlee-dev](https://github.com/danlee-dev) | [GitHub: @AliceLacie](https://github.com/AliceLacie) |
| 프론트엔드, AI/ML | 백엔드, AI/ML |
| 고려대학교 컴퓨터학과 | 고려대학교 컴퓨터학과 |

## 문서

- [Class Diagram](./docs/CLASS_DIAGRAM.md) - 클래스 다이어그램
- [System Architecture](./docs/system-architecture.md) - 시스템 아키텍처

## 라이선스

본 프로젝트는 교육 목적으로 개발되었습니다.

## 문의

프로젝트 관련 문의사항은 GitHub Issues를 통해 남겨주시기 바랍니다.
