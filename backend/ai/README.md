# CARDEALO AI Course Recommender

AI 기반 카드 혜택 최적화 코스 추천 서비스

## 기능

### 기존 시스템 (course_recommender.py)
- Gemini AI를 활용한 사용자 의도 분석
- 카드 혜택을 고려한 최적 코스 추천
- TMAP/네이버 지도 API 연동 경로 제공
- 여러 옵션 (혜택 우선, 거리 우선, 혼합) 제공

### 신규: Gemini 기반 혜택 극대화 시스템 (gemini_course_recommender.py)
- **5단계 AI 파이프라인**으로 혜택 극대화 코스 추천
- 사용자 자연어 입력 분석 (Gemini 1차)
- 후보 장소 자동 검색 (Places API)
- 카드 혜택 자동 매칭 (자체 DB)
- 혜택 우선 코스 생성 (Gemini 2차)
- 경로 및 시간 자동 계산

## 설치

### 1. 가상환경 생성

```bash
cd ai
python3 -m venv venv
source venv/bin/activate  # Mac/Linux
```

### 2. 의존성 설치

```bash
pip install -r requirements.txt
```

### 3. 환경 변수 설정

`.env.example`을 복사해서 `.env` 파일 생성:

```bash
cp .env.example .env
```

`.env` 파일 수정:
- `GEMINI_API_KEY`: Google Gemini API 키
- `TMAP_API_KEY`: TMAP API 키 (선택)
- `NCP_CLIENT_ID`, `NCP_CLIENT_SECRET`: 네이버 클라우드 (선택)
- `BACKEND_API_URL`: 백엔드 API URL (기본: http://localhost:5001)

### 4. 서버 실행

```bash
python app.py
```

서버 주소: `http://localhost:5002`

## API 사용법

### 신규: POST /api/ai/course-recommend (Backend)

**혜택 극대화** 기반 AI 코스 추천 (Gemini 5단계 파이프라인)

**요청:**

```json
{
  "user_input": "주말 잠실에서 데이트 코스 추천해줘",
  "user_location": {
    "latitude": 37.5133,
    "longitude": 127.1028
  },
  "user_cards": ["현대카드 M Edition2", "신한카드 Deep Dream"],
  "max_distance": 5000
}
```

**응답:**

```json
{
  "intent": {
    "keywords": ["데이트", "잠실", "주말"],
    "theme": "데이트",
    "categories": ["cafe", "restaurant", "park"],
    "num_places": 3,
    "preferences": {
      "focus_on_benefits": true,
      "time_of_day": "afternoon",
      "transport_mode": "WALK"
    }
  },
  "course": {
    "title": "혜택까지 알뜰한 잠실 산책 코스",
    "benefit_summary": "최대 30% 할인 혜택",
    "reasoning": "카드 혜택을 최대한 활용할 수 있는 코스입니다.",
    "stops": [
      {
        "name": "스타벅스 잠실점",
        "category": "cafe",
        "address": "서울시 송파구...",
        "latitude": 37.xxx,
        "longitude": 127.xxx,
        "distance": 200,
        "benefit": {
          "card": "현대카드 M Edition2",
          "summary": "10% 할인",
          "score": 85,
          "discount_rate": 10
        }
      }
    ],
    "routes": [
      {
        "from": "지점 0",
        "to": "스타벅스 잠실점",
        "distance": 200,
        "duration": 3,
        "mode": "WALK"
      }
    ],
    "total_distance": 1500,
    "total_duration": 25,
    "total_benefit_score": 250
  }
}
```

### 기존: POST /api/recommend-course

사용자 입력을 바탕으로 AI가 코스를 추천합니다.

**요청:**

```json
{
  "user_input": "데이트 코스 추천해줘",
  "user_location": {
    "latitude": 37.5856,
    "longitude": 127.0292
  },
  "user_cards": ["신한카드", "국민카드"],
  "max_distance": 5000,
  "num_options": 3
}
```

**응답:**

```json
{
  "intent": {
    "theme": "date",
    "categories": ["cafe", "restaurant", "movie"],
    "time_of_day": "evening",
    "transport_mode": "WALK",
    "estimated_duration_hours": 4,
    "num_places": 3,
    "preferences": {
      "budget": "medium",
      "pace": "relaxed",
      "style": "trendy"
    },
    "reasoning": "데이트 코스는 카페, 식사, 영화 순서로..."
  },
  "courses": [
    {
      "rank": 1,
      "places": [
        {
          "name": "스타벅스 안암점",
          "category": "cafe",
          "latitude": 37.5856,
          "longitude": 127.0292,
          "address": "서울시 성북구...",
          "distance": 100,
          "top_benefit": {
            "card": "신한카드",
            "score": 85,
            "benefit": "10% 할인",
            "discount_rate": 10,
            "discount_amount": 5000
          }
        }
      ],
      "routes": [
        {
          "type": "WALK",
          "distance": 500,
          "duration": 7,
          "path": [...],
          "polyline": [[37.xxx, 127.xxx], ...]
        }
      ],
      "total_distance": 2000,
      "total_duration": 30,
      "total_benefit_score": 250,
      "transport_mode": "WALK",
      "summary": "스타벅스, 맛집, 영화관을 여유롭게 즐기는 코스입니다."
    }
  ]
}
```

## 아키텍처

### 신규: Gemini 5단계 파이프라인

```
사용자 입력 ("주말 단풍 데이트")
    ↓
[Step 1] 의도 분석 (Gemini 1차)
    - 키워드 추출: ["단풍", "산책", "카페"]
    - 테마 파악: "데이트"
    - 카테고리 결정: ["cafe", "restaurant", "park"]
    ↓
[Step 2] 후보 장소 검색 (Places API)
    - Backend API 호출
    - 각 카테고리별 장소 검색
    - 후보 장소 리스트 생성
    ↓
[Step 3] 카드 혜택 매칭 (자체 DB)
    - Backend Benefit API 호출
    - place_id + user_cards → 혜택 정보
    - 장소에 혜택 정보 보강
    ↓
[Step 4] AI 코스 계획 (Gemini 2차)
    - 혜택 보강된 장소 리스트를 재료로 제공
    - 혜택 최우선 고려하여 코스 생성
    - 창의적인 코스 제목 생성
    ↓
[Step 5] 경로 및 시간 보강
    - Haversine 거리 계산
    - 이동 시간 추정
    - 경로 정보 추가
    ↓
결과 반환
```

### 기존: CourseRecommender 시스템

```
사용자 입력
    ↓
LLMService (Gemini)
    - 의도 분석 (테마, 카테고리, 교통수단 등)
    ↓
CourseRecommender
    - 장소 검색 (백엔드 API 호출)
    - 여러 코스 후보 생성
    ↓
BenefitCalculator
    - 각 장소의 카드 혜택 조회
    - 총 혜택 점수 계산
    - 순위화
    ↓
RouteOptimizer
    - TMAP 대중교통 경로
    - 네이버 도보/자가용 경로
    - 방문 순서 최적화
    ↓
LLMService
    - 코스 요약 설명 생성
    ↓
결과 반환
```

## 파일 구조

```
ai/
├── app.py                         # Flask API 서버 (기존)
├── course_recommender.py          # 기존 추천 로직
├── gemini_course_recommender.py   # 신규: Gemini 5단계 파이프라인
├── llm_service.py                 # Gemini LLM 서비스
├── benefit_calculator.py          # 혜택 계산
├── route_optimizer.py             # 경로 최적화
├── test_course_recommend.py       # 테스트 스크립트
├── requirements.txt               # 의존성
├── .env                           # 환경 변수 (gitignore)
├── .env.example                   # 환경 변수 예시
└── README.md                      # 문서
```

## 테스트

### 신규: Gemini 5단계 파이프라인 테스트

**Python 테스트 스크립트:**

```bash
# Backend 서버 먼저 실행 (터미널 1)
cd backend
python app.py

# 테스트 실행 (터미널 2)
cd ai
python test_course_recommend.py
```

**cURL 테스트:**

```bash
curl -X POST http://localhost:5001/api/ai/course-recommend \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "주말 잠실에서 데이트 코스 추천해줘",
    "user_location": {
      "latitude": 37.5133,
      "longitude": 127.1028
    },
    "user_cards": ["현대카드 M Edition2", "신한카드 Deep Dream"],
    "max_distance": 3000
  }'
```

### 기존: CourseRecommender 테스트

```bash
curl -X POST http://localhost:5002/api/recommend-course \
  -H "Content-Type: application/json" \
  -d '{
    "user_input": "강남에서 데이트 코스 추천해줘",
    "user_location": {
      "latitude": 37.5856,
      "longitude": 127.0292
    },
    "user_cards": ["신한카드", "국민카드"]
  }'
```

## 향후 개선 사항

1. 더 정교한 경로 최적화 알고리즘 (TSP)
2. 사용자 피드백 학습
3. 시간대별 영업 정보 반영
4. 날씨 정보 연동
5. 예산 제약 조건 추가
6. 과거 방문 이력 기반 추천

## 작성자

이성민 (23학번, 2023320132)
작성일: 2025-11-11
