# CARDEALO 구현 상태 문서

> 문서 작성일: 2025년 11월 2일
> 최종 업데이트: 2025-11-02
> 버전: 1.0.0
> 작성자: 소프트웨어공학 7팀 (이성민, 민제민)

## 1. 프로젝트 개요

**Cardealo**는 사용자의 위치와 소비 패턴을 분석하여 최적의 신용카드 혜택을 실시간으로 추천하는 위치 기반 개인화 카드 혜택 추천 플랫폼입니다.

- **개발 기간**: 2025.10 ~
- **플랫폼**: Android (React Native)
- **백엔드**: Flask + PostgreSQL
- **주요 기술**: Google Maps API, Naver Cloud Platform API

## 2. 구현 완료 기능

### 2.1 프론트엔드 (Frontend)

#### 2.1.1 화면 구조
- **SplashScreen**: 앱 초기 로딩 화면 (완료)
- **LoginScreen**: 소셜 로그인 UI (완료)
  - Google, Kakao, Naver, Apple 로그인 버튼
  - UI only (백엔드 인증 연동 미완)
- **HomeScreen**: 메인 지도 화면 (완료)
  - Google Maps 기반 지도 표시
  - 현재 위치 트래킹
  - 주변 가맹점 마커 표시 (핀 색상: 빨강/주황/초록)
  - 카테고리 필터 (전체/마트/편의점/카페/음식점/약국/영화관/뷰티)
  - 현 지도에서 검색 버튼
  - 장소 검색 기능
  - BottomSheet (4단계: 25%, 45%, 70%, 85%)
  - 위치 디버그 모달
- **CardRegistrationScreen**: 카드 등록 화면 (UI 완료)
  - 카메라 권한 요청
  - 이미지 선택 기능 (OCR 연동 미완)
- **ProfileScreen**: 프로필 화면 (기본 구조만 완료)
- **OnePayScreen**: 원페이 화면 (기본 구조만 완료)

#### 2.1.2 컴포넌트
- **LocationDebugModal**: 위치 디버깅 모달 (완료)
  - 좌표 직접 입력
  - 주소 입력 → 좌표 변환
  - 위치 초기화
- **SVG Icons**: 커스텀 아이콘 세트 (완료)

#### 2.1.3 위치 기반 기능
- **현재 위치 추적**: expo-location 사용 (완료)
- **주변 가맹점 검색**: Google Places API 연동 (완료)
- **카테고리별 필터링**: 8개 카테고리 지원 (완료)
- **반경 검색**: 500m 기본 반경 (완료)
- **장소 검색**:
  - 위치 정보 있을 때: Nearby Search (5km 반경)
  - 위치 정보 없을 때: Text Search
- **위치 디버그 기능**: 개발용 위치 설정 (완료)

#### 2.1.4 지도 핀 색상 알고리즘
- **알고리즘**: 혜택 점수 기반 3단계 분류
  - 빨강 (High): 상위 33%
  - 주황 (Medium): 중위 33%
  - 초록 (Low): 하위 33%
- **구현 방식**: 전체 점수 정렬 후 tertile 기반 분류
- **엣지 케이스 처리**: 점수 0개, 1개 상황 핸들링

### 2.2 백엔드 (Backend)

#### 2.2.1 API 엔드포인트

**Geocoding API**
- `GET /api/geocode`: 주소 → 좌표 변환 (완료)
- `POST /api/geocode/batch`: 다중 주소 변환 (완료)

**Location & Recommendation API**
- `GET /api/nearby-recommendations`: 주변 가맹점 + 카드 추천 (완료)
  - GPS 정확도 기반 실내/실외 판단
  - 건물 내부 감지 시스템
  - 거리 계산 (Haversine formula)
  - 카드 혜택 추천
- `POST /api/merchant-recommendations`: 특정 가맹점 상세 추천 (완료)
- `GET /api/search-place`: 장소 검색 (완료)
  - Nearby Search (위치 기반)
  - Text Search (전역 검색)

**Legacy API**
- `GET /api/stores`: 샘플 데이터 반환 (deprecated)

**Health Check**
- `GET /health`: 서버 상태 확인 (완료)

#### 2.2.2 서비스 레이어

**LocationService**
- `detect_indoor()`: 실내/실외 감지 (완료)
  - GPS 정확도 체크 (< 15m = 실외)
  - 체류 시간 체크 (>= 180초)
  - Google Places API로 건물 검색
  - 거리 기반 판단 (10m strict / 20m relaxed)
  - 도로/주소 필터링
- `search_nearby_stores()`: 주변 가맹점 검색 (완료)
  - 반경 500m 기본값
  - 카테고리 필터 지원
  - 중복 제거 (place_id 기준)
  - 거리순 정렬
- `search_building_stores()`: 건물 내부 가맹점 검색 (완료)
  - 50m 반경 검색
  - 건물명 태깅
- `calculate_distance()`: Haversine 거리 계산 (완료)

**BenefitLookupService**
- `get_recommendations()`: 카드 추천 목록 (완료)
  - 가맹점별 혜택 조회
  - 카테고리별 기본 혜택
  - 점수 기반 정렬
- `get_top_card_for_merchant()`: 최상위 카드 추천 (완료)
- 혜택 DB: JSON 파일 기반 (benefits_db.json)

**GeocodingService**
- `get_coordinates()`: 주소 → 좌표 (완료)
  - Naver Geocoding API 연동
- `batch_geocode()`: 다중 주소 변환 (완료)

#### 2.2.3 Location Intelligence 알고리즘

**건물 내부 감지 로직**
1. GPS 정확도 < 15m → 실외 판정
2. Google Places Nearby Search (rankby=distance)
3. 도로/주소만 감지 → 실외 판정
4. 거리 <= 10m → 실내 판정
5. 거리 <= 20m + 3분 체류 → 실내 판정
6. 그 외 → 실외 판정

**카테고리 매핑**
- mart: supermarket, grocery_or_supermarket
- convenience: convenience_store
- cafe: cafe
- bakery: bakery
- restaurant: restaurant
- beauty: beauty_salon, store
- pharmacy: pharmacy
- movie: movie_theater

### 2.3 데이터

#### 2.3.1 혜택 데이터베이스
- **형식**: JSON 파일 (benefits_db.json)
- **구조**: 카테고리 → 가맹점 → 카드 혜택 배열
- **필드**:
  - card: 카드명
  - score: 혜택 점수
  - discount_rate: 할인율
  - discount_amount: 최대 할인액
  - point_rate: 적립률
  - monthly_limit: 월 한도
  - pre_month_money: 전월 실적 조건

#### 2.3.2 카테고리
- mart (마트)
- convenience (편의점)
- cafe (카페)
- bakery (베이커리)
- restaurant (음식점)
- beauty (뷰티)
- pharmacy (약국)
- movie (영화관)

### 2.4 개발 환경

#### 2.4.1 프론트엔드
- React Native 0.81.5
- Expo SDK ~54.0.20
- TypeScript 5.9.2
- @gorhom/bottom-sheet 5.2.6
- react-native-maps 1.20.1
- expo-location 19.0.7
- axios 1.13.1

#### 2.4.2 백엔드
- Flask 3.0.0
- Flask-CORS 4.0.0
- Python 3.9+
- requests 2.31.0

#### 2.4.3 외부 API
- Google Maps API (Places, Geocoding) - 연동 완료
- Naver Cloud Platform Geocoding API - 연동 완료

## 3. 부분 구현 기능

### 3.1 카드 등록
- **완료**: UI 구조, 카메라 권한, 이미지 선택
- **미완**: OCR API 연동, 카드 정보 추출, 서버 저장

### 3.2 소셜 로그인
- **완료**: UI 디자인 (Google, Kakao, Naver, Apple)
- **미완**: OAuth 인증 로직, JWT 토큰 관리, 사용자 세션

### 3.3 프로필/원페이 화면
- **완료**: 기본 화면 구조
- **미완**: 실제 기능 구현

## 4. 미구현 기능

### 4.1 인증 시스템
- OAuth2 소셜 로그인 연동
- JWT 토큰 기반 인증
- 사용자 세션 관리
- 보안 토큰 저장

### 4.2 데이터베이스
- PostgreSQL 스키마 설계
- 사용자 테이블
- 카드 테이블
- 거래 내역 테이블
- 혜택 정보 테이블
- ORM 설정 (SQLAlchemy 등)

### 4.3 카드 관리
- 카드 목록 조회
- 카드 추가/삭제
- 카드 상세 정보
- 혜택 사용 내역

### 4.4 OCR 카드 등록
- Naver Cloud OCR API 연동
- 카드 이미지 전처리
- 카드 번호/이름 추출
- 자동 카드 등록

### 4.5 개인화 추천
- 사용자 소비 패턴 분석
- ML 기반 추천 알고리즘
- 맞춤형 카드 제안
- 혜택 사용 예측

### 4.6 통계 및 분석
- 월별 혜택 사용 통계
- 카테고리별 소비 분석
- 카드별 절감액 계산
- 시각화 대시보드

### 4.7 알림 시스템
- Push 알림
- 혜택 만료 알림
- 프로모션 알림
- 위치 기반 알림

### 4.8 크롤링 시스템
- 카드사 혜택 정보 크롤링
- 자동 업데이트 스케줄러
- 데이터 검증 로직
- robots.txt 준수

### 4.9 소셜 기능
- 사용자 간 공유
- 혜택 리뷰
- 추천 랭킹
- 커뮤니티

### 4.10 결제 연동
- 카카오페이 연동
- 네이버페이 연동
- 간편 결제
- 결제 내역 자동 수집

## 5. 기술 부채 및 개선 사항

### 5.1 프론트엔드
- 상태 관리 라이브러리 미도입 (Redux, Zustand 등)
- API 에러 핸들링 개선 필요
- 로딩 상태 UI 부족
- 오프라인 모드 미지원
- 성능 최적화 (메모이제이션, 가상화)

### 5.2 백엔드
- 데이터베이스 미연동 (현재 JSON 파일 사용)
- 인증/인가 시스템 부재
- API 레이트 리밋 미설정
- 로깅 시스템 미흡
- 에러 핸들링 표준화 필요
- 테스트 코드 부재

### 5.3 보안
- HTTPS 설정
- API 키 관리 (환경 변수 사용 중)
- 사용자 데이터 암호화
- SQL Injection 방지 (DB 미연동으로 해당 없음)

### 5.4 배포
- CI/CD 파이프라인 미구축
- 모니터링 시스템 부재
- 백업 전략 부재
- 스케일링 전략 부재

## 6. 다음 단계 (Next Steps)

### 6.1 우선순위 1 (즉시 필요)
1. PostgreSQL 데이터베이스 연동
2. 사용자 인증 시스템 구현 (OAuth2 + JWT)
3. 카드 CRUD API 완성
4. OCR 카드 등록 기능 완성

### 6.2 우선순위 2 (단기)
1. 상태 관리 라이브러리 도입
2. 에러 핸들링 표준화
3. 로깅 시스템 구축
4. 테스트 코드 작성

### 6.3 우선순위 3 (중기)
1. ML 기반 추천 알고리즘 개발
2. 사용자 소비 패턴 분석
3. 통계 및 분석 대시보드
4. Push 알림 시스템

### 6.4 우선순위 4 (장기)
1. 크롤링 시스템 구축
2. 결제 서비스 연동
3. 소셜 기능 개발
4. iOS 플랫폼 지원

## 7. API 연동 현황

| API | 용도 | 상태 | 비고 |
|-----|------|------|------|
| Google Maps Places API | 주변 가맹점 검색 | 완료 | Nearby Search, Text Search |
| Google Maps Geocoding API | 좌표 변환 | 사용 안 함 | Naver API로 대체 |
| Naver Cloud Geocoding | 주소 → 좌표 | 완료 | |
| Naver Cloud OCR | 카드 이미지 인식 | 미완 | UI만 완료 |
| OAuth2 (Google) | 소셜 로그인 | 미완 | UI만 완료 |
| OAuth2 (Kakao) | 소셜 로그인 | 미완 | UI만 완료 |
| OAuth2 (Naver) | 소셜 로그인 | 미완 | UI만 완료 |
| Apple Sign In | 소셜 로그인 | 미완 | UI만 완료 |

## 8. 환경 변수

### 8.1 필수 환경 변수
```bash
# Backend (.env)
NCP_CLIENT_ID=<Naver Cloud Platform Client ID>
NCP_CLIENT_SECRET=<Naver Cloud Platform Secret>
GOOGLE_MAPS_API_KEY=<Google Maps API Key>
FLASK_PORT=5000
FLASK_ENV=development

# Frontend (.env)
EXPO_PUBLIC_API_URL=http://127.0.0.1:5000
```

### 8.2 미설정 환경 변수 (향후 필요)
```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# JWT
JWT_SECRET_KEY=<Secret Key>
JWT_ACCESS_TOKEN_EXPIRES=3600

# OAuth
GOOGLE_CLIENT_ID=<Client ID>
GOOGLE_CLIENT_SECRET=<Secret>
KAKAO_REST_API_KEY=<API Key>
NAVER_CLIENT_ID=<Client ID>
NAVER_CLIENT_SECRET=<Secret>

# OCR
NCP_OCR_SECRET_KEY=<OCR Secret Key>
```

## 9. 성능 지표

### 9.1 현재 측정값
- API 응답 시간: 측정 안 됨
- 지도 로딩 속도: 측정 안 됨
- 가맹점 검색 속도: 측정 안 됨
- 메모리 사용량: 측정 안 됨

### 9.2 목표 지표 (향후 설정)
- API 응답 시간 < 500ms
- 지도 로딩 < 2초
- 가맹점 검색 < 1초
- 메모리 사용량 < 200MB

## 10. 알려진 이슈

1. 장소 검색 시 위치 정보 없으면 전역 검색 (의도된 동작)
2. 건물 내부 감지 시 Google Places 정확도 의존
3. 혜택 데이터베이스가 JSON 파일 (DB 미연동)
4. 카드 추천 알고리즘이 단순 가중치 기반 (ML 미적용)
5. 실시간 혜택 업데이트 불가 (크롤링 미구현)

## 11. 참고 문서

- [System Architecture](./system-architecture.md) - 시스템 아키텍처 및 향후 계획
- [README.md](../README.md) - 프로젝트 개요 및 설치 가이드

---

**문서 작성일**: 2025년 11월 2일
**문서 버전**: 1.0.0
**최종 업데이트**: 2025-11-02
**작성자**: 소프트웨어공학 7팀 (이성민, 민제민)
