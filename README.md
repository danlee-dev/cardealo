# 소프트웨어 공학 7팀 - CARDEALO

<div align="center">
<img width="280" alt="cardealo-logo-dark" src="./images/logo(dark).png">
&nbsp;&nbsp;&nbsp;&nbsp;
<img width="280" alt="cardealo-logo-white" src="./images/logo(white).png">
</div>

<div align="center">
<h3>위치 기반 개인화 카드 혜택 추천 플랫폼</h3>
<p>사용자의 위치와 보유 카드를 분석하여 최적의 혜택을 실시간으로 추천합니다</p>
</div>

<div align="center">

**개발기간**: 2025.10 ~ 2025.12

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)

</div>

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [주요 기능](#주요-기능)
3. [화면 구성](#화면-구성)
4. [시스템 아키텍처](#시스템-아키텍처)
5. [기술 스택](#기술-스택)
6. [데이터베이스 설계](#데이터베이스-설계)
7. [API 명세](#api-명세)
8. [설치 및 실행](#설치-및-실행)
9. [참여자](#참여자)
10. [문서](#문서)

---

## 프로젝트 개요

**Cardealo**는 사용자의 위치와 소비 패턴을 분석하여 최적의 신용카드 혜택을 실시간으로 추천하는 플랫폼입니다.

AI 기반 코스 추천, OCR 카드 등록, 실시간 위치 기반 혜택 분석을 통해 사용자 맞춤형 카드 혜택 정보를 제공합니다. 기업용 법인카드 관리 및 가맹점 결제 시스템도 지원합니다.

### 핵심 가치

- **실시간 혜택 분석**: 현재 위치의 가맹점에서 최대 혜택을 받을 수 있는 카드 자동 추천
- **AI 코스 추천**: Gemini AI 기반 개인화 데이트/여행 코스 생성
- **간편 결제**: OnePay QR/바코드 기반 간편 결제 시스템
- **기업용 기능**: 법인카드 관리, 부서별 한도 설정, 직원 결제 추적

---

## 주요 기능

### 1. 위치 기반 실시간 추천
- 현재 위치 기반 실시간 카드 혜택 분석
- Naver Maps 기반 지도 UI
- Google Places API 연동으로 주변 가맹점 정보 제공
- 혜택 점수 기반 마커 색상 분류 (상위/중위/하위)
- 카테고리 필터 (카페/음식점/마트/편의점/주유소 등)

### 2. AI 코스 추천
- Gemini AI 기반 개인화 데이트/여행 코스 추천
- 자연어 입력 지원 ("주말 단풍 데이트", "맛집 투어" 등)
- 사용자 보유 카드 기반 혜택 최적화
- TMAP 연동 경로 안내 (도보/대중교통/자동차)
- 코스 저장 및 친구 공유 기능

### 3. 카드 관리
- OCR 기반 카드 자동 등록 (Naver Cloud OCR)
- 보유 카드 목록 관리 및 혜택 정보 통합
- 카드별 혜택 상세 조회
- 월 실적/한도 관리

### 4. OnePay 결제 시스템
- QR/바코드 기반 간편 결제
- 최적 카드 자동 선택 (가맹점 기반)
- 실시간 잔액 관리
- 결제 내역 조회

### 5. 기업용 기능
- 법인카드 등록 및 관리
- 부서별 사용 현황 대시보드
- 직원 결제 권한 관리
- 영수증 OCR 스캔 및 자동 사용액 반영
- 한도 초과 경고 알림

### 6. 소셜 기능
- 친구 추가 및 관리
- 실시간 채팅 (WebSocket)
- 코스 공유
- 더치페이 (정산 요청/송금)
- 알림 시스템

---

## 화면 구성

### 인증 화면

<div align="center">
<table>
<tr>
<td align="center"><b>로그인</b></td>
<td align="center"><b>회원가입 (1)</b></td>
<td align="center"><b>회원가입 (2)</b></td>
</tr>
<tr>
<td><img src="./images/1_로그인.png" width="250"/></td>
<td><img src="./images/2_회원가입-1.png" width="250"/></td>
<td><img src="./images/2_회원가입-2.png" width="250"/></td>
</tr>
</table>
</div>

### 홈 화면 (지도 기반)

<div align="center">
<table>
<tr>
<td align="center"><b>홈 화면 (검색 기록 포함)</b></td>
<td align="center"><b>가게 혜택 상세</b></td>
<td align="center"><b>가게 정보 상세</b></td>
</tr>
<tr>
<td><img src="./images/3_홈(검색 기록 기능 포함).png" width="250"/></td>
<td><img src="./images/4_가게혜택상세.png" width="250"/></td>
<td><img src="./images/5_가게정보상세.png" width="250"/></td>
</tr>
</table>
</div>

- 현재 위치 기반 주변 가맹점 마커 표시
- 카테고리 필터 및 정렬 기능
- 가맹점 클릭 시 카드 혜택 정보 표시
- 검색 기록 저장 및 자동완성

### OnePay 결제

<div align="center">
<table>
<tr>
<td align="center"><b>OnePay 결제 화면</b></td>
</tr>
<tr>
<td><img src="./images/6_ONEPAY결제.png" width="300"/></td>
</tr>
</table>
</div>

- QR/바코드 기반 간편 결제
- 가맹점 카테고리에 맞는 최적 카드 자동 선택
- 5분 유효시간 카운트다운
- 결제 완료 시 실시간 알림

### 가맹점 결제 시스템 (Admin Web)

> 테스트 결제 서비스: https://cardealo.vercel.app/

<div align="center">
<table>
<tr>
<td align="center"><b>메인 화면</b></td>
<td align="center"><b>QR/바코드 인식</b></td>
</tr>
<tr>
<td><img src="./images/0_테스트페이서비스-화면.png" width="350"/></td>
<td><img src="./images/0_테스트페이서비스-QR및바코드인식.png" width="350"/></td>
</tr>
</table>
</div>

<div align="center">
<table>
<tr>
<td align="center"><b>결제 화면</b></td>
<td align="center"><b>앱 결제 대기 중</b></td>
<td align="center"><b>앱 결제 완료</b></td>
</tr>
<tr>
<td><img src="./images/0_테스트페이서비스-결제화면.png" width="250"/></td>
<td><img src="./images/0_테스트페이서비스-사용자앱결제대기중화면.png" width="250"/></td>
<td><img src="./images/0_테스트페이서비스-사용자앱결제완료모달.png" width="250"/></td>
</tr>
</table>
</div>

<div align="center">
<table>
<tr>
<td align="center"><b>결제 기록</b></td>
<td align="center"><b>결제 상세 기록</b></td>
<td align="center"><b>CSV 내보내기</b></td>
</tr>
<tr>
<td><img src="./images/0_테스트페이서비스-결제기록.png" width="250"/></td>
<td><img src="./images/0_테스트페이서비스-결제상세기록.png" width="250"/></td>
<td><img src="./images/0_테스트페이서비스-결제상세기록내보내기(csv).png" width="250"/></td>
</tr>
</table>
</div>

- 가맹점 등록 및 검색 (Google Places API 연동)
- QR 코드 / 바코드 자동 인식
- 카드 혜택 자동 계산 및 할인 적용
- 결제 내역 관리 및 CSV 내보내기
- 사용자 앱과 실시간 연동 (결제 완료 알림)

### 채팅 및 소셜

<div align="center">
<table>
<tr>
<td align="center"><b>채팅방</b></td>
<td align="center"><b>코스 공유</b></td>
<td align="center"><b>더치페이 카드 UI</b></td>
</tr>
<tr>
<td><img src="./images/7_채팅방.png" width="250"/></td>
<td><img src="./images/8_채팅-코스공유.png" width="250"/></td>
<td><img src="./images/8_채팅-코스공유및더치페이카드UI.png" width="250"/></td>
</tr>
</table>
</div>

- WebSocket 기반 실시간 채팅
- 코스 공유 및 길 안내 연동
- 정산 요청 및 송금 기능

### 마이페이지

<div align="center">
<table>
<tr>
<td align="center"><b>마이페이지</b></td>
<td align="center"><b>카드 등록</b></td>
<td align="center"><b>카드 혜택 상세</b></td>
</tr>
<tr>
<td><img src="./images/9_마이페이지.png" width="250"/></td>
<td><img src="./images/9_마이페이지-카드등록.png" width="250"/></td>
<td><img src="./images/9_마이페이지-카드혜택상세.png" width="250"/></td>
</tr>
</table>
</div>

<div align="center">
<table>
<tr>
<td align="center"><b>잔액 충전</b></td>
<td align="center"><b>알림 리스트</b></td>
<td align="center"><b>설정</b></td>
</tr>
<tr>
<td><img src="./images/9_마이페이지-잔액충전.png" width="250"/></td>
<td><img src="./images/9_마이페이지-알림리스트.png" width="250"/></td>
<td><img src="./images/9_마이페이지-설정.png" width="250"/></td>
</tr>
</table>
</div>

- 월별 소비/절감 통계
- OCR 기반 카드 자동 등록
- 카드별 혜택 상세 조회
- 잔액 충전 (빠른 금액 버튼 제공)

### 법인카드 관리 (기업용)

<div align="center">
<table>
<tr>
<td align="center"><b>관리자 전환</b></td>
<td align="center"><b>관리자 대시보드</b></td>
<td align="center"><b>사용자 대시보드</b></td>
</tr>
<tr>
<td><img src="./images/9_마이페이지-관리자.png" width="250"/></td>
<td><img src="./images/9_마이페이지-관리자-대시보드.png" width="250"/></td>
<td><img src="./images/9_마이페이지-법인카드사용자(관리자아님)-법인카드대쉬보드.png" width="250"/></td>
</tr>
</table>
</div>

<div align="center">
<table>
<tr>
<td align="center"><b>직원 관리</b></td>
<td align="center"><b>직원 초대</b></td>
<td align="center"><b>영수증 스캔</b></td>
</tr>
<tr>
<td><img src="./images/9_마이페이지-관리자-대시보드-직원관리.png" width="250"/></td>
<td><img src="./images/9_마이페이지-관리자-대시보드-직원관리-직원초대.png" width="250"/></td>
<td><img src="./images/9_마이페이지-영수증스캔(법인카드소유자 혹은법인카드 사용자일 경우에만 뜸).png" width="250"/></td>
</tr>
</table>
</div>

- 법인카드 소유자 전용 관리자 대시보드
- 법인카드 사용자(직원)용 개인 대시보드
- 부서별 사용 현황 바 그래프
- 직원 추가/제거 및 한도 설정
- 영수증 OCR 스캔 및 자동 사용액 반영

### AI 코스 추천

<div align="center">
<table>
<tr>
<td align="center"><b>코스 추천중 (1)</b></td>
<td align="center"><b>코스 추천중 (2)</b></td>
<td align="center"><b>코스 추천중 (3)</b></td>
</tr>
<tr>
<td><img src="./images/10_코스추천모드-코스추천중-1.png" width="250"/></td>
<td><img src="./images/10_코스추천모드-코스추천중-2.png" width="250"/></td>
<td><img src="./images/10_코스추천모드-코스추천중-3.png" width="250"/></td>
</tr>
</table>
</div>

<div align="center">
<table>
<tr>
<td align="center"><b>코스 추천 완료</b></td>
<td align="center"><b>코스 안내</b></td>
</tr>
<tr>
<td><img src="./images/10_코스추천모드-코스추천완료.png" width="300"/></td>
<td><img src="./images/11_코스안내.png" width="300"/></td>
</tr>
</table>
</div>

<div align="center">
<table>
<tr>
<td align="center"><b>도보 경로</b></td>
<td align="center"><b>자동차 경로</b></td>
<td align="center"><b>대중교통 경로</b></td>
</tr>
<tr>
<td><img src="./images/11_상세코스안내(도보).png" width="250"/></td>
<td><img src="./images/11_상세코스안내(자동차).png" width="250"/></td>
<td><img src="./images/11_상세코스안내(대중교통).png" width="250"/></td>
</tr>
</table>
</div>

<div align="center">
<table>
<tr>
<td align="center"><b>대중교통 상세 (토글)</b></td>
<td align="center"><b>버스 경로 미리보기</b></td>
</tr>
<tr>
<td><img src="./images/11_상세코스안내(대중교통)-토글연버전(버스&지하철&도보 상세경로 표시).png" width="300"/></td>
<td><img src="./images/11_코스안내(버스경로미리보기).png" width="300"/></td>
</tr>
</table>
</div>

- Gemini AI 기반 코스 생성
- 카드 혜택 최적화된 장소 추천
- 도보/자동차/대중교통 경로 선택
- 구간별 교통수단 전환 가능
- 환승 정보 및 요금 표시

### 알림

<div align="center">
<table>
<tr>
<td align="center"><b>채팅 알림</b></td>
<td align="center"><b>코스 공유 알림</b></td>
<td align="center"><b>정산 요청 알림</b></td>
<td align="center"><b>친구 요청 알림</b></td>
</tr>
<tr>
<td><img src="./images/12_알림(채팅).jpeg" width="200"/></td>
<td><img src="./images/12_알림(코스공유).jpeg" width="200"/></td>
<td><img src="./images/12_알림(정산요청).jpeg" width="200"/></td>
<td><img src="./images/12_알림(친구요청).jpeg" width="200"/></td>
</tr>
</table>
</div>

- WebSocket 기반 실시간 알림
- 타입별 알림 구분 (결제/채팅/친구/코스공유/정산)
- 알림 클릭 시 관련 화면으로 이동

---

## 시스템 아키텍처

```
+---------------------------+     +---------------------------+
|      Mobile App           |     |      Admin Web            |
|   (React Native/Expo)     |     |      (Next.js)            |
|   - 20개 화면             |     |   - 결제 처리             |
|   - Naver Maps            |     |   - QR/바코드 스캔        |
|   - Socket.io             |     |   - 결제 내역 관리        |
+-----------+---------------+     +-----------+---------------+
            |                                 |
            v                                 v
+-----------+---------------+     +-----------+---------------+
|      User Backend         |<--->|     Admin Backend         |
|        (Flask)            |     |       (FastAPI)           |
|   - REST API              |     |   - 결제 처리 API         |
|   - WebSocket             |     |   - 혜택 계산             |
|   - AI 코스 추천          |     |   - Webhook 연동          |
+-----------+---------------+     +-----------+---------------+
            |                                 |
            v                                 v
+-----------+---------------+     +-----------+---------------+
|      PostgreSQL           |     |      SQLite               |
|    (Railway 호스팅)       |     |    (Admin 전용 DB)        |
|   - 17개 테이블           |     |   - 3개 테이블            |
+---------------------------+     +---------------------------+
            |
            v
+---------------------------+
|      External APIs        |
|   - Google Places API     |
|   - Google Gemini AI      |
|   - Naver Maps/OCR API    |
|   - TMAP Directions API   |
+---------------------------+
```

---

## 기술 스택

### Frontend (Mobile)
| 기술 | 설명 |
|------|------|
| React Native | 크로스 플랫폼 모바일 앱 개발 |
| Expo SDK 54 | 개발 환경 및 빌드 도구 |
| TypeScript | 정적 타입 지원 |
| Naver Maps | 지도 UI (@mj-studio/react-native-naver-map) |
| Socket.io | 실시간 통신 |
| EAS Build | 앱 빌드 및 배포 |

### Backend (User)
| 기술 | 설명 |
|------|------|
| Flask 3.0 | Python 웹 프레임워크 |
| SQLAlchemy | ORM |
| Flask-SocketIO | WebSocket 지원 |
| PostgreSQL | 관계형 데이터베이스 |
| Railway | 클라우드 배포 |

### Backend (Admin)
| 기술 | 설명 |
|------|------|
| FastAPI | Python 비동기 웹 프레임워크 |
| SQLAlchemy | ORM |
| Pydantic | 데이터 검증 |
| SQLite | 경량 데이터베이스 |

### Frontend (Admin)
| 기술 | 설명 |
|------|------|
| Next.js 15 | React 프레임워크 |
| Tailwind CSS | 유틸리티 CSS |
| TypeScript | 정적 타입 지원 |
| Html5Qrcode | QR/바코드 스캔 |

### AI/ML & External APIs
| API | 용도 |
|-----|------|
| Google Gemini AI | AI 코스 추천, 의도 분석 |
| Google Places API (New) | 장소 검색, 상세 정보, 사진 |
| Naver Maps API | 지도 표시, Geocoding |
| TMAP API | 경로 안내 (대중교통 포함) |
| Naver Cloud OCR | 카드/영수증 이미지 인식 |

---

## 데이터베이스 설계

### ERD (Entity Relationship Diagram)

<div align="center">
<img src="./images/erd.png" alt="ERD Diagram" width="100%"/>
</div>

### User Backend (17개 테이블)

| 도메인 | 테이블 | 설명 |
|--------|--------|------|
| **사용자** | User, MyCard | 사용자 정보, 보유 카드 |
| **카드** | Card, CardBenefit | 카드 마스터, 혜택 데이터 |
| **코스** | SavedCourse, SavedCourseUser, SharedCourse | 코스 저장/공유 |
| **소셜** | Friendship, Conversation, Message, Notification | 친구/채팅/알림 |
| **결제** | PaymentHistory, QRScanStatus | 결제 내역, QR 상태 |
| **법인카드** | CorporateCard, CorporateCardMember, Department, CorporatePaymentHistory | 법인카드 관리 |
| **캐시** | RouteCache | 경로 캐싱 |

### Admin Backend (3개 테이블)

| 테이블 | 설명 |
|--------|------|
| Merchant | 등록된 가맹점 |
| CardBenefit | 혜택 데이터 (동기화) |
| PaymentTransaction | 결제 트랜잭션 |

> 상세 ERD 코드는 [docs/ERD.dbml](./docs/ERD.dbml) 참조

---

## API 명세

### User Backend (Flask) - 주요 엔드포인트

| 카테고리 | Method | Endpoint | 설명 |
|----------|--------|----------|------|
| **인증** | POST | /api/login | 로그인 |
| | POST | /api/register | 회원가입 |
| **카드** | POST | /api/ocr/card | 카드 OCR |
| | POST | /api/card/add | 카드 등록 |
| | GET | /api/card/benefit | 카드 혜택 조회 |
| **장소** | GET | /api/nearby-recommendations | 주변 가맹점 추천 |
| | GET | /api/place/details | 장소 상세 정보 |
| **AI 코스** | POST | /api/ai/course-recommend | AI 코스 추천 |
| **코스** | POST | /api/course/save | 코스 저장 |
| | POST | /api/course/share | 코스 공유 |
| **경로** | POST | /api/course-directions | 코스 경로 정보 |
| **결제** | POST | /api/qr/generate | QR/바코드 생성 |
| | POST | /api/payment/process | 결제 처리 |
| **친구** | POST | /api/friends/request | 친구 요청 |
| | POST | /api/friends/accept | 친구 수락 |
| **채팅** | POST | /api/chat/send | 메시지 전송 |
| **법인카드** | GET | /api/corporate/dashboard | 관리자 대시보드 |
| | POST | /api/corporate/cards/{id}/members | 직원 추가 |

### Admin Backend (FastAPI) - 주요 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/merchants/search | 가맹점 검색 |
| POST | /api/merchants/select | 가맹점 등록 |
| POST | /api/qr/scan | QR 스캔 + 혜택 계산 |
| POST | /api/payment/process | 결제 확정 |
| GET | /api/payment/history | 결제 내역 |

> 전체 API 명세는 [docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md) 참조

---

## 설치 및 실행

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
ENABLE_STORE_PHOTOS=false  # true for demo
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

### 실행 방법

**Frontend (Mobile)**
```bash
cd frontend
npm install
npx expo start
```

**Backend (User)**
```bash
cd backend
pip install -r requirements.txt
python app.py
```

**Admin Backend**
```bash
cd admin-backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Admin Frontend**
```bash
cd admin-frontend
npm install
npm run dev
```

---

## 프로젝트 구조

```
cardealo/
├── frontend/                    # React Native 모바일 앱
│   ├── src/
│   │   ├── screens/            # 20개 화면
│   │   ├── components/         # 공통 컴포넌트 + SVG 아이콘
│   │   ├── contexts/           # AuthContext, NotificationContext
│   │   └── utils/              # API, 유틸리티
│   ├── app.config.js           # Expo 설정
│   └── package.json
│
├── backend/                     # Flask 사용자 백엔드
│   ├── app.py                  # 메인 앱 (모든 라우트)
│   ├── services/               # 비즈니스 로직
│   │   ├── database.py         # SQLAlchemy 모델
│   │   ├── location_service.py # Google Places 연동
│   │   ├── directions_service.py # 경로 안내
│   │   ├── tmap_service.py     # TMAP 연동
│   │   └── ocr_service.py      # Naver OCR
│   ├── ai/                     # AI 서비스
│   │   ├── gemini_course_recommender.py
│   │   └── benefit_calculator.py
│   └── requirements.txt
│
├── admin-backend/              # FastAPI 가맹점 백엔드
│   ├── app/
│   │   ├── main.py             # FastAPI 앱
│   │   ├── routers/            # API 라우터
│   │   ├── services/           # 혜택 계산, QR 검증
│   │   └── models/             # SQLAlchemy 모델
│   └── requirements.txt
│
├── admin-frontend/             # Next.js 가맹점 웹
│   ├── app/                    # 페이지
│   └── package.json
│
├── docs/                       # 문서
│   ├── CLASS_DIAGRAM.md        # 클래스 다이어그램
│   ├── IMPLEMENTATION_STATUS.md # 구현 현황
│   └── ERD.dbml                # ERD 코드
│
└── images/                     # 스크린샷 및 로고
```

---

## 참여자

### 기획

| 이름 | 소속 | 역할 | 연락처 |
|------|------|------|--------|
| 송치언 | 건축사회환경공학부 | 팀장, 기획 | rbkhan0229@korea.ac.kr |
| 정은수 | 경영학과 | 기획, 마케팅 | nsoodang1110@gmail.com |
| 차수진 | 경영학과 | 기획, 마케팅 | nerissa.cha71@gmail.com |

### 개발

<div align="left">
<table>
<tr>
<td align="center"><b>이성민</b></td>
<td align="center"><b>민제민</b></td>
</tr>
<tr>
<td align="center"><img src="https://avatars.githubusercontent.com/danlee-dev" width="140px" alt="이성민" /></td>
<td align="center"><img src="https://avatars.githubusercontent.com/AliceLacie" width="140px" alt="민제민" /></td>
</tr>
<tr>
<td align="center"><a href="https://github.com/danlee-dev">@danlee-dev</a></td>
<td align="center"><a href="https://github.com/AliceLacie">@AliceLacie</a></td>
</tr>
<tr>
<td align="center">개발 팀장, 프론트엔드, AI/ML</td>
<td align="center">백엔드</td>
</tr>
<tr>
<td align="center">컴퓨터학과</td>
<td align="center">인공지능사이버보안학과</td>
</tr>
<tr>
<td align="center">hi.danleedev@gmail.com</td>
<td align="center">gottisttot4678@gmail.com</td>
</tr>
</table>
</div>

### 디자인

| 이름 | 소속 | 역할 | 연락처 |
|------|------|------|--------|
| 이정은 | 불어불문학과 | 디자인 | ljellen15@gmail.com |
| 장추우 | 미디어학부 | 디자인 | qiuyuu1020@gmail.com |

---

## 문서

| 문서 | 설명 |
|------|------|
| [CLASS_DIAGRAM.md](./docs/CLASS_DIAGRAM.md) | 클래스 다이어그램 |
| [IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md) | 구현 현황 상세 |
| [ERD.dbml](./docs/ERD.dbml) | 데이터베이스 ERD 코드 |

---

## Project Tech Stack

### Environment

![Visual Studio Code](https://img.shields.io/badge/VS_Code-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)

### Frontend (Mobile)

![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

### Frontend (Admin Web)

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

### Backend

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

### Database

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

### Infrastructure & Deployment

![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Naver Cloud](https://img.shields.io/badge/Naver_Cloud-03C75A?style=for-the-badge&logo=naver&logoColor=white)

### AI & External APIs

![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)
![Google Maps](https://img.shields.io/badge/Google_Maps-4285F4?style=for-the-badge&logo=googlemaps&logoColor=white)
![Naver](https://img.shields.io/badge/Naver_Maps-03C75A?style=for-the-badge&logo=naver&logoColor=white)
![TMAP](https://img.shields.io/badge/TMAP-EF4123?style=for-the-badge&logo=tmobile&logoColor=white)

---

## 라이선스

본 프로젝트는 교육 목적으로 개발되었습니다.

## 문의

프로젝트 관련 문의사항은 [GitHub Issues](https://github.com/danlee-dev/cardealo/issues)를 통해 남겨주시기 바랍니다.
