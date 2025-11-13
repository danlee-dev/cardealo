# CARDEALO Backend

> 작성일: 2025-11-02
> 작성자: 이성민 (민제민 팀원 대신 임시 구현)

Flask 기반 CARDEALO 카드 혜택 추천 플랫폼 백엔드 서버입니다.

## 중요 공지 (민제민 팀원에게)

현재 백엔드는 **이성민이 임시로 구현**한 상태입니다.
민제민 팀원이 시간이 없어서 프론트엔드 개발을 위해 필요한 최소한의 API만 구현했습니다.

**구현된 기능**:
- 위치 기반 가맹점 검색
- 카드 혜택 추천 알고리즘
- 건물 내부/외부 감지 로직
- Geocoding 서비스

**미구현 기능**:
- PostgreSQL 데이터베이스 연동 (현재 JSON 파일 사용)
- 사용자 인증 (OAuth2, JWT)
- 카드 관리 API
- OCR API 연동

나중에 시간 나면 이 문서 보고 인수인계 받으세요.

---

## 프로젝트 구조

```
backend/
├── app.py                      # Flask 메인 서버
├── requirements.txt            # Python 의존성
├── .env.example               # 환경 변수 예시
├── benefits_db.json           # 혜택 데이터베이스 (JSON)
├── benefits_db_old.json       # 백업 데이터
├── services/                  # 서비스 레이어
│   ├── __init__.py
│   ├── location_service.py    # 위치 기반 서비스
│   ├── benefit_lookup_service.py  # 혜택 조회 서비스
│   └── geocoding_service.py   # 주소 변환 서비스
└── scripts/                   # 유틸리티 스크립트 (있으면)
```

---

## 설치 및 실행

### 1. 가상환경 생성

```bash
python3 -m venv venv
source venv/bin/activate  # Mac/Linux
# or
venv\Scripts\activate  # Windows
```

### 2. 의존성 설치

```bash
pip install -r requirements.txt
```

**현재 설치된 패키지**:
- Flask 3.0.0
- Flask-CORS 4.0.0
- python-dotenv 1.0.0
- requests 2.31.0

### 3. 환경 변수 설정

`.env.example`을 복사해서 `.env` 파일 생성:

```bash
cp .env.example .env
```

`.env` 파일 내용:

```bash
# Naver Cloud Platform
NCP_CLIENT_ID=your_naver_client_id
NCP_CLIENT_SECRET=your_naver_client_secret

# Google Maps API
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Flask
FLASK_PORT=5000
FLASK_ENV=development
```

### 4. 서버 실행

```bash
python app.py
```

서버 주소: `http://localhost:5000` 또는 `http://127.0.0.1:5000`

---

## API 엔드포인트

### Health Check

서버 상태 확인

```
GET /health
```

**응답**:
```json
{
  "status": "healthy",
  "service": "cardealo-backend"
}
```

---

### 1. Geocoding API

#### 1.1 주소 → 좌표 변환

```
GET /api/geocode?address={주소}
```

**예시**:
```bash
curl "http://localhost:5000/api/geocode?address=서울특별시%20성북구%20안암로%20145"
```

**응답**:
```json
{
  "latitude": 37.585285,
  "longitude": 127.029601,
  "address": "서울특별시 성북구 안암로 145"
}
```

#### 1.2 다중 주소 변환

```
POST /api/geocode/batch
Content-Type: application/json
```

**요청 본문**:
```json
{
  "addresses": [
    "서울특별시 성북구 안암로 145",
    "서울특별시 성북구 안암동5가 126-1"
  ]
}
```

**응답**:
```json
{
  "results": [
    {
      "address": "서울특별시 성북구 안암로 145",
      "latitude": 37.585285,
      "longitude": 127.029601
    }
  ]
}
```

---

### 2. Location & Recommendation API

#### 2.1 주변 가맹점 + 카드 추천 (핵심 API)

```
GET /api/nearby-recommendations?lat={위도}&lng={경도}&user_lat={사용자_위도}&user_lng={사용자_경도}&radius={반경}&cards={카드목록}&gps_accuracy={GPS정확도}&staying_duration={체류시간}
```

**파라미터**:
- `lat`: 검색 중심 위도 (필수)
- `lng`: 검색 중심 경도 (필수)
- `user_lat`: 사용자 실제 위도 (선택, 기본값: lat)
- `user_lng`: 사용자 실제 경도 (선택, 기본값: lng)
- `radius`: 검색 반경 (m) (선택, 기본값: 500)
- `cards`: 보유 카드 목록 (쉼표 구분) (선택)
- `gps_accuracy`: GPS 정확도 (m) (선택)
- `staying_duration`: 체류 시간 (초) (선택)

**예시**:
```bash
curl "http://localhost:5000/api/nearby-recommendations?lat=37.5856&lng=127.0292&cards=신한카드,국민카드&gps_accuracy=20&staying_duration=200"
```

**응답**:
```json
{
  "indoor": true,
  "building_name": "홈플러스 안암점",
  "address": "서울특별시 성북구 안암로 145",
  "stores": [
    {
      "name": "스타벅스",
      "category": "cafe",
      "address": "서울특별시 성북구...",
      "latitude": 37.5856,
      "longitude": 127.0292,
      "distance": 50,
      "place_id": "ChIJ...",
      "top_card": {
        "card": "신한카드",
        "score": 85,
        "benefit": "10% 할인 • 최대 5,000원 할인"
      }
    }
  ]
}
```

**로직 설명**:

1. **실내/실외 감지** (`detect_indoor`):
   - GPS 정확도 < 15m → 실외
   - 거리 <= 10m → 실내
   - 거리 <= 20m + 3분 체류 → 실내
   - 그 외 → 실외

2. **가맹점 검색**:
   - 실내인 경우: 건물 내부 50m 반경 검색
   - 실외인 경우: 주변 500m 반경 검색

3. **카드 추천**:
   - 각 가맹점별로 최적 카드 선택
   - 점수 기반 정렬

#### 2.2 특정 가맹점 상세 추천

```
POST /api/merchant-recommendations
Content-Type: application/json
```

**요청 본문**:
```json
{
  "merchant_name": "스타벅스",
  "category": "cafe",
  "user_cards": ["신한카드", "국민카드", "삼성카드"]
}
```

**응답**:
```json
{
  "merchant_name": "스타벅스",
  "category": "cafe",
  "recommendations": [
    {
      "rank": 1,
      "card": "신한카드",
      "score": 85,
      "discount_rate": 10,
      "discount_amount": 5000,
      "monthly_limit": 50000,
      "point_rate": 0,
      "pre_month_money": 300000,
      "benefit_summary": "10% 할인 • 최대 5,000원 할인 • 전월 30만원 이상"
    }
  ]
}
```

#### 2.3 장소 검색

```
GET /api/search-place?query={검색어}&latitude={위도}&longitude={경도}
```

**파라미터**:
- `query`: 검색어 (필수)
- `latitude`: 사용자 위도 (선택)
- `longitude`: 사용자 경도 (선택)

**동작**:
- 위치 정보 있으면: Nearby Search (5km 반경)
- 위치 정보 없으면: Text Search (전역)

**응답**:
```json
{
  "location": {
    "latitude": 37.5856,
    "longitude": 127.0292,
    "name": "홈플러스 안암점",
    "address": "서울특별시 성북구 안암로 145"
  }
}
```

---

### 3. Legacy API (Deprecated)

#### 3.1 샘플 가맹점 데이터

```
GET /api/stores
```

**주의**: 이 API는 deprecated 상태입니다. `/api/nearby-recommendations` 사용을 권장합니다.

---

## 서비스 레이어 설명

### LocationService (location_service.py)

위치 기반 서비스를 제공합니다.

**주요 메서드**:

#### `detect_indoor(lat, lng, gps_accuracy, staying_duration)`
실내/실외 감지

**알고리즘**:
1. GPS 정확도 < 15m → 실외
2. Google Places API로 가장 가까운 장소 검색
3. 도로/주소만 감지 → 실외
4. 거리 <= 10m → 실내
5. 거리 <= 20m AND 체류 >= 3분 → 실내
6. 그 외 → 실외

**반환값**:
```python
{
    'indoor': bool,
    'building_name': str or None,
    'address': str
}
```

### Register

```
POST /api/register
Content-Type: application/json

{
    "user_id":"test",
    "user_name":"홍길동",
    "user_email":"asdf@asdf.com",
    "user_pw":"test",
    "user_age":23,
    "isBusiness":false,
    "card_name":"신한카드 The CLASSIC-Y"
}
```

Response:

```json
{
    "msg": "registered",
    "success": true
}

If the card_name value is not in the database
{
    "msg": "Card not found",
    "success": false
}
```

### Login

```
POST /api/login
Content-Type: application/json

{
    "user_email":"asdf@asdf.com",
    "user_pw":"test",
}
```

Response:

```json
{
  "msg": "logged in",
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9.ovXxDNossgChX4TpIcRy1SvCuIntuAJ54l0fMAUk0TQ"
}
```

### Mypage

```
GET /api/mypage
Authorization: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9.ovXxDNossgChX4TpIcRy1SvCuIntuAJ54l0fMAUk0TQ
```

Response:

```json
{
    "msg": "mypage",
    "success": true,
    "user": {
        "cards": [
            {
                "card_benefit": "Gift Option 서비스는 매년 1회 아래 품목 중 한 가지를 선택하여 이용하실 수 있습니다.- 포인트 : 마이신한포인트 적립(7만점) / 1년1회- 문화 : 문화상품권(8만원) / 1년1회- 요식 : 패밀리 레스토랑 11만원 이용권 / 1년1회- 호텔 : 호텔 애프터눈 티 SET 이용권 / ... (생략)",
                "card_name": "신한카드 The CLASSIC-Y",
                "card_pre_month_money": 0
            },
        ],
        "isBusiness": false,
        "user_age": 1,
        "user_id": "test",
        "user_name": "홍길동",
        "user_email":"asdf@asdf.com",
    }
}
```

### Get card list

1page = 25item

```
GET /api/mypage?keyword=&page=
```

Response:

```json
{
  "cards": [
    {
      "card_benefit": "[기본 혜택] 전월 이용 금액... (생략)",
      "card_name": "네이버 현대카드 Edition2",
      "card_pre_month_money": 500000
    }
  ],
  "msg": "card list",
  "success": true
}
```

### Add card

```
POST /api/card/add
Authorization: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9.ovXxDNossgChX4TpIcRy1SvCuIntuAJ54l0fMAUk0TQ
Content-Type: application/json

{
    "card_name":"네이버 현대카드 Edition2"
}
```

Response:

```json
{
    "msg": "card added",
    "success": true
}

If the card_name value is not in the database
{
    "msg": "Card not found",
    "success": false
}
```

### Edit card

```
POST /api/card/edit
Authorization: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9.ovXxDNossgChX4TpIcRy1SvCuIntuAJ54l0fMAUk0TQ
Content-Type: application/json

{
    "old_card_name":"네이버 현대카드 Edition2",
    "new_card_name":"신한카드 The CLASSIC-Y"
}
```

Response:

```json
{
    "msg": "card edited",
    "success": true
}
```

### Delete card

```
POST /api/card/del
Authorization: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9.ovXxDNossgChX4TpIcRy1SvCuIntuAJ54l0fMAUk0TQ
Content-Type: application/json

{
    "card_name":"네이버 현대카드 Edition2"
}
```

Response:

```json
{
    "msg": "card deleted",
    "success": true
}
```



#### `search_nearby_stores(lat, lng, radius, category)`
주변 가맹점 검색

**파라미터**:
- `lat`, `lng`: 검색 중심 좌표
- `radius`: 검색 반경 (m), 기본값 500m
- `category`: 카테고리 필터 (선택)

**지원 카테고리**:
- mart: 마트
- convenience: 편의점
- cafe: 카페
- bakery: 베이커리
- restaurant: 음식점
- beauty: 뷰티
- pharmacy: 약국
- movie: 영화관

**반환값**:
```python
[
    {
        'name': str,
        'category': str,
        'address': str,
        'latitude': float,
        'longitude': float,
        'distance': int,  # meters
        'place_id': str
    }
]
```

#### `search_building_stores(building_name, user_lat, user_lng)`
건물 내부 가맹점 검색 (50m 반경)

#### `calculate_distance(lat1, lng1, lat2, lng2)`
Haversine 공식을 사용한 거리 계산 (m)

---

### BenefitLookupService (benefit_lookup_service.py)

카드 혜택 조회 서비스

**주요 메서드**:

#### `get_recommendations(merchant_name, category, user_cards)`
카드 추천 목록 반환

**로직**:
1. 가맹점명으로 혜택 검색
2. 없으면 카테고리 기본 혜택 사용
3. 사용자 보유 카드 필터링
4. 점수순 정렬

**점수 계산**:
- 할인율 + 할인액 + 적립률 등을 종합한 가중치 기반 점수
- 높을수록 혜택이 좋음

#### `get_top_card_for_merchant(merchant_name, category, user_cards)`
최상위 카드 1개 반환

---

### GeocodingService (geocoding_service.py)

Naver Geocoding API를 사용한 주소 변환

**주요 메서드**:

#### `get_coordinates(address)`
주소 → 좌표 변환

**API**: Naver Cloud Platform Geocoding API

#### `batch_geocode(addresses)`
다중 주소 변환

---

## 데이터베이스

### benefits_db.json

현재는 **JSON 파일**로 혜택 데이터를 관리합니다.

**구조**:
```json
{
  "카테고리": {
    "가맹점명": [
      {
        "card": "카드명",
        "score": 85,
        "discount_rate": 10,
        "discount_amount": 5000,
        "point_rate": 0,
        "monthly_limit": 50000,
        "pre_month_money": 300000
      }
    ],
    "default": [
      // 기본 혜택
    ]
  }
}
```

**향후 계획**: PostgreSQL로 마이그레이션 필요

---

## 외부 API 연동

### Google Maps Places API

**용도**: 주변 가맹점 검색, 장소 검색, 건물 감지

**엔드포인트**:
- Nearby Search: `https://maps.googleapis.com/maps/api/place/nearbysearch/json`
- Text Search: `https://maps.googleapis.com/maps/api/place/textsearch/json`

**설정**: `.env` 파일에 `GOOGLE_MAPS_API_KEY` 필요

### Naver Cloud Platform Geocoding API

**용도**: 한국 주소 → 좌표 변환

**엔드포인트**: `https://maps.apigw.ntruss.com/map-geocode/v2/geocode`

**설정**: `.env` 파일에 `NCP_CLIENT_ID`, `NCP_CLIENT_SECRET` 필요

---

## 개발 가이드

### 로컬 테스트

#### curl 사용

```bash
# Health Check
curl http://localhost:5000/health

# 주소 변환
curl "http://localhost:5000/api/geocode?address=서울특별시%20성북구%20안암로%20145"

# 주변 가맹점 검색
curl "http://localhost:5000/api/nearby-recommendations?lat=37.5856&lng=127.0292&cards=신한카드,국민카드"
```

#### Python requests 사용

```python
import requests

# Health check
response = requests.get('http://localhost:5000/health')
print(response.json())

# 주변 가맹점 검색
params = {
    'lat': 37.5856,
    'lng': 127.0292,
    'cards': '신한카드,국민카드',
    'gps_accuracy': 20,
    'staying_duration': 200
}
response = requests.get('http://localhost:5000/api/nearby-recommendations', params=params)
print(response.json())
```

### 디버깅

콘솔에 상세한 로그가 출력됩니다:

```
[API] nearby-recommendations 요청
[API] 검색 위치: 37.5856, 127.0292, radius=500m
[API] 사용자 위치: 37.5856, 127.0292
[Indoor Detection] 좌표: 37.5856, 127.0292
[Indoor Detection] GPS 정확도: 20.0m, 체류 시간: 200초
[Indoor Detection] 가장 가까운 장소: 홈플러스 안암점
[Indoor Detection] 거리: 8.5m
[Indoor Detection] 건물 내부 판정: True (거리 8.5m)
```

---

## 에러 처리

### API 에러 코드

- `400`: 잘못된 요청 (파라미터 누락, 타입 오류)
- `404`: 리소스 없음 (주소 찾을 수 없음)
- `500`: 서버 내부 오류

### 일반적인 문제

#### 1. Port already in use

```bash
# 포트 사용 중인 프로세스 확인
lsof -ti:5000

# 프로세스 종료
lsof -ti:5000 | xargs kill -9
```

#### 2. API 키 오류

`.env` 파일 확인:
- `NCP_CLIENT_ID`, `NCP_CLIENT_SECRET` 올바른지 확인
- `GOOGLE_MAPS_API_KEY` 올바른지 확인
- API 사용량 제한 확인

#### 3. CORS 오류

`Flask-CORS` 설정 확인:
```python
CORS(app)  # app.py에 설정되어 있음
```

---

## 향후 개발 과제 (민제민 팀원에게)

### 우선순위 1 (즉시 필요)

1. **PostgreSQL 연동**
   - SQLAlchemy ORM 설정
   - 스키마 설계 및 마이그레이션
   - benefits_db.json → PostgreSQL 이전

2. **사용자 인증**
   - OAuth2 소셜 로그인 (Google, Kakao, Naver)
   - JWT 토큰 발급/검증
   - 사용자 세션 관리

3. **카드 관리 API**
   - `POST /api/cards`: 카드 등록
   - `GET /api/cards`: 카드 목록 조회
   - `DELETE /api/cards/:id`: 카드 삭제

4. **OCR API 연동**
   - Naver Cloud OCR API
   - 카드 이미지 → 카드 정보 추출

### 우선순위 2 (단기)

1. **로깅 시스템**
   - Python logging 모듈
   - 파일 로깅, 로그 레벨 설정

2. **에러 핸들링 표준화**
   - 커스텀 Exception 클래스
   - 에러 응답 포맷 통일

3. **API 문서화**
   - Swagger/OpenAPI 연동
   - API 문서 자동 생성

4. **테스트 코드**
   - pytest 설정
   - 유닛 테스트, 통합 테스트

### 우선순위 3 (중기)

1. **크롤링 시스템**
   - 카드사 혜택 정보 크롤링
   - 스케줄러 (APScheduler)
   - 데이터 업데이트 자동화

2. **캐싱**
   - Redis 도입
   - API 응답 캐싱

3. **Rate Limiting**
   - Flask-Limiter
   - API 호출 제한

---

## 참고 자료

- [Flask 공식 문서](https://flask.palletsprojects.com/)
- [Google Places API](https://developers.google.com/maps/documentation/places/web-service)
- [Naver Cloud Platform Geocoding](https://api.ncloud-docs.com/docs/ai-naver-mapsgeocoding)

---

## 문의

구현 관련 질문이나 인수인계 필요사항이 있으면 이성민(danlee-dev)에게 연락주세요.

**작성일**: 2025-11-02
**작성자**: 이성민 (23학번, 2023320132)
