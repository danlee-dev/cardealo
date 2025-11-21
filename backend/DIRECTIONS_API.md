# Google Directions API - 경로 안내 서비스

## 개요

Google Directions API를 활용한 경로 안내 서비스입니다. 대중교통 요금 정보를 자동으로 제공하며, Google API에서 요금 정보가 제공되지 않을 경우 서울 대중교통 요금 기준으로 추정 계산합니다.

## 주요 기능

1. 다중 경유지 경로 계산
2. 이동 모드별 경로 제공 (도보, 대중교통, 자동차, 자전거)
3. 대중교통 요금 자동 계산
4. 서울 대중교통 요금 Fallback 계산

## API 엔드포인트

### 1. POST `/api/directions`

기본 경로 검색

**요청:**
```json
{
  "origin": {"latitude": 37.5133, "longitude": 127.1028},
  "destination": {"latitude": 37.4979, "longitude": 127.0276},
  "waypoints": [
    {"latitude": 37.xxx, "longitude": 127.xxx}
  ],
  "mode": "transit",
  "alternatives": false,
  "avoid": ["tolls", "highways"]
}
```

**응답:**
```json
{
  "status": "OK",
  "routes": [...],
  "total_distance": 12345,
  "total_duration": 1800,
  "total_distance_text": "12.3 km",
  "total_duration_text": "30분",
  "fare": {
    "currency": "KRW",
    "value": 1400
  },
  "fare_text": "1,400원",
  "fare_source": "google_api"
}
```

### 2. POST `/api/course-directions-mixed`

구간별 교통수단 자동 선택 경로 검색

**요청:**
```json
{
  "course_stops": [
    {"name": "스타벅스", "latitude": 37.xxx, "longitude": 127.xxx},
    {"name": "레스토랑", "latitude": 37.xxx, "longitude": 127.xxx}
  ],
  "start_location": {"latitude": 37.xxx, "longitude": 127.xxx},
  "leg_modes": ["walking", "transit"]
}
```

**응답:**
```json
{
  "status": "OK",
  "legs_summary": [
    {
      "from": "현재 위치",
      "to": "스타벅스",
      "mode": "walking",
      "distance": 500,
      "duration": 360,
      "fare": null,
      "distance_text": "500 m",
      "duration_text": "6분",
      "fare_text": null,
      "polyline": "encoded_polyline_string_for_map"
    },
    {
      "from": "스타벅스",
      "to": "레스토랑",
      "mode": "transit",
      "distance": 3000,
      "duration": 720,
      "fare": 1400,
      "distance_text": "3.0 km",
      "duration_text": "12분",
      "fare_text": "1,400원",
      "polyline": "encoded_polyline_string_for_map"
    }
  ],
  "total_distance": 3500,
  "total_duration": 1080,
  "total_fare": 1400,
  "total_distance_text": "3.5 km",
  "total_duration_text": "18분",
  "total_fare_text": "1,400원"
}
```

**특징:**
- `leg_modes` 파라미터가 없으면 자동으로 거리 기반 교통수단 선택
- 800m 이하: 도보 (walking)
- 800m 초과: 대중교통 (transit)
- 각 구간별로 개별 API 호출 및 요금 계산
- 대중교통 구간의 요금을 합산하여 전체 요금 제공
- **각 구간의 `polyline` 필드**: 프론트엔드 지도에 경로를 그리기 위한 인코딩된 좌표 데이터
  - Google Maps Polyline Encoding 형식
  - `@mapbox/polyline` 라이브러리로 디코딩 가능
  - React Native Maps의 `Polyline` 컴포넌트로 표시

### 3. POST `/api/course-directions`

AI 코스용 경로 검색 (장소 리스트 기반, 단일 교통수단)

**요청:**
```json
{
  "course_stops": [
    {"name": "스타벅스", "latitude": 37.xxx, "longitude": 127.xxx},
    {"name": "레스토랑", "latitude": 37.xxx, "longitude": 127.xxx}
  ],
  "start_location": {"latitude": 37.xxx, "longitude": 127.xxx},
  "mode": "walking"
}
```

**응답:**
```json
{
  "status": "OK",
  "routes": [...],
  "legs_summary": [
    {
      "from": "현재 위치",
      "to": "스타벅스",
      "distance": 500,
      "duration": 360,
      "distance_text": "500 m",
      "duration_text": "6분"
    }
  ],
  "total_distance": 1500,
  "total_duration": 1200,
  "total_distance_text": "1.5 km",
  "total_duration_text": "20분",
  "fare": {"currency": "KRW", "value": 1400},
  "fare_text": "1,400원 (추정)",
  "fare_source": "estimated_seoul"
}
```

## 이동 모드

- `walking` - 도보
- `driving` - 자동차
- `transit` - 대중교통 (지하철, 버스)
- `bicycling` - 자전거

## 대중교통 요금 계산

### Google API 요금 제공 시

`mode=transit`일 때 Google API가 요금 정보를 제공하면 그대로 반환합니다.

```json
{
  "fare": {"currency": "KRW", "value": 1400},
  "fare_text": "1,400원",
  "fare_source": "google_api"
}
```

### Fallback 계산 (서울 기준)

Google API에서 요금 정보가 제공되지 않으면 서울 대중교통 요금표를 기반으로 자동 추정합니다.

**서울 대중교통 요금표 (2024년 3월 기준, 성인 카드)**

| 교통수단 | 기본 요금 | 추가 요금 |
|---------|----------|----------|
| 지하철 | 1,400원 (10km) | 5km당 100원 |
| 시내버스 (파랑/초록) | 1,500원 | - |
| 마을버스 | 1,200원 | - |
| 광역버스 (빨강) | 3,000원 | - |
| 심야버스 | 2,500원 | - |

**계산 로직:**

1. **지하철만 이용:**
   - 10km 이하: 1,400원
   - 10km 초과: 1,400원 + (초과 거리 / 5km) × 100원

   예시:
   - 8km: 1,400원
   - 15km: 1,400원 + 100원 = 1,500원
   - 22km: 1,400원 + 300원 = 1,700원

2. **버스만 이용:**
   - 시내버스: 1,500원
   - 마을버스: 1,200원
   - 광역버스: 3,000원
   - 심야버스: 2,500원

3. **지하철 + 버스 환승:**
   - 거리 합산 계산
   - 기본 요금 중 높은 것 + 거리 추가 요금

**Fallback 응답:**

```json
{
  "fare": {"currency": "KRW", "value": 1700},
  "fare_text": "1,700원 (추정)",
  "fare_source": "estimated_seoul"
}
```

## fare_source 값

- `google_api` - Google Directions API에서 제공한 실제 요금
- `estimated_seoul` - Google API에서 요금 정보가 없어 서울 기준으로 추정 계산한 요금

## 테스트

```bash
# Backend 서버 실행
cd backend
python app.py

# 테스트 실행 (다른 터미널)
python test_directions.py
```

테스트 케이스:
1. 기본 대중교통 경로 (잠실 → 강남)
2. 경유지 포함 경로 (도보)
3. AI 코스용 경로
4. 서울 지하철 요금 (강남 → 홍대)
5. 장거리 지하철 요금 계산 (잠실 → 인천공항)
6. 구간별 자동 교통수단 선택
7. 구간별 수동 교통수단 지정

## 예시

### cURL 예시

```bash
# 대중교통 경로 + 요금
curl -X POST http://localhost:5001/api/directions \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"latitude": 37.5133, "longitude": 127.1028},
    "destination": {"latitude": 37.4979, "longitude": 127.0276},
    "mode": "transit"
  }'

# 구간별 자동 교통수단 선택
curl -X POST http://localhost:5001/api/course-directions-mixed \
  -H "Content-Type: application/json" \
  -d '{
    "course_stops": [
      {"name": "잠실역", "latitude": 37.5133, "longitude": 127.1028},
      {"name": "강남역", "latitude": 37.4979, "longitude": 127.0276}
    ],
    "start_location": {"latitude": 37.5150, "longitude": 127.1050}
  }'
```

### Python 예시

```python
import requests

response = requests.post(
    "http://localhost:5001/api/directions",
    json={
        "origin": {"latitude": 37.5133, "longitude": 127.1028},
        "destination": {"latitude": 37.4979, "longitude": 127.0276},
        "mode": "transit"
    }
)

result = response.json()
print(f"거리: {result['total_distance_text']}")
print(f"시간: {result['total_duration_text']}")
print(f"요금: {result.get('fare_text', '없음')}")
print(f"출처: {result.get('fare_source', 'N/A')}")
```

## 제한 사항

1. **Fallback 계산은 서울 기준**
   - 서울 외 지역은 요금이 다를 수 있음
   - 청소년/어린이 요금은 별도 계산 필요

2. **환승 할인 단순화**
   - 실제 환승 할인은 더 복잡한 로직
   - 현재는 단순화된 계산 사용

3. **버스 타입 추정**
   - 노선명으로 버스 타입 추정
   - 정확하지 않을 수 있음

4. **Google API 의존성**
   - Google API 장애 시 경로 검색 불가
   - API 키 할당량 제한 적용

## 향후 개선 사항

1. 지역별 요금표 추가 (부산, 대구 등)
2. 청소년/어린이 요금 옵션
3. 환승 할인 정확도 개선
4. 실시간 교통 정보 반영
5. 경로 대안 비교 (최단 vs 최저가)

## 프론트엔드에서 지도에 경로 표시하기

자세한 내용은 `/frontend/ROUTE_DISPLAY.md` 참조

### 간단한 예시 (React Native)

```bash
npm install @mapbox/polyline
```

```typescript
import MapView, { Polyline } from 'react-native-maps';
import polyline from '@mapbox/polyline';

// Backend API 호출
const response = await fetch('/api/course-directions-mixed', {
  method: 'POST',
  body: JSON.stringify({ course_stops, start_location }),
});
const data = await response.json();

// 지도에 표시
<MapView style={{ flex: 1 }}>
  {data.legs_summary.map((leg, index) => {
    // Polyline 디코딩
    const coords = polyline
      .decode(leg.polyline)
      .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

    return (
      <Polyline
        key={index}
        coordinates={coords}
        strokeColor={leg.mode === 'walking' ? '#00C853' : '#007AFF'}
        strokeWidth={4}
      />
    );
  })}
</MapView>
```

## 작성자

이성민 (23학번, 2023320132)
작성일: 2025-11-11
