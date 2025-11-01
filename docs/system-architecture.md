# CARDEALO 시스템 아키텍처

## 1. 시스템 개요

CARDEALO는 사용자의 위치 기반으로 주변 가맹점에서 최적의 카드 혜택을 추천하는 모바일 애플리케이션입니다.

### 1.1 핵심 기능
- 실시간 위치 기반 주변 가맹점 검색
- 사용자 보유 카드 기반 혜택 추천
- 건물 내부 감지 및 실내 결제 지원
- 카드별 혜택 상세 정보 제공
- One Pay 간편 결제 기능

### 1.2 기술 스택

**Frontend**
- React Native (0.81.5)
- Expo (54.0.20)
- TypeScript
- Naver Maps SDK
- React Native Gesture Handler & Reanimated

**Backend**
- Python 3.x
- Flask
- Naver Maps API
- Google Places API

**Development Tools**
- Expo Dev Client
- Expo Config Plugins (자동화)
- Metro Bundler

## 2. 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Mobile App                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Home     │  │  One Pay   │  │  Profile   │            │
│  │  Screen    │  │   Screen   │  │   Screen   │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│         │                │                │                  │
│         └────────────────┴────────────────┘                  │
│                         │                                    │
│                    Navigation                                │
└─────────────────────────┼────────────────────────────────────┘
                          │
                   REST API (HTTP)
                          │
┌─────────────────────────┼────────────────────────────────────┐
│                   Backend Server                              │
│  ┌──────────────────────┴────────────────────────┐           │
│  │              Flask Application                 │           │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  │           │
│  │   │ Location │  │ Benefit  │  │ Geocoding│  │           │
│  │   │ Service  │  │ Lookup   │  │ Service  │  │           │
│  │   └──────────┘  └──────────┘  └──────────┘  │           │
│  └───────────────────────────────────────────────┘           │
│                         │                                    │
│              ┌──────────┴──────────┐                         │
│              │                     │                         │
│       ┌──────▼──────┐       ┌─────▼──────┐                  │
│       │   Benefits  │       │   Places   │                  │
│       │  Database   │       │   Cache    │                  │
│       │   (JSON)    │       └────────────┘                  │
│       └─────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
                          │
                   External APIs
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌─────▼─────┐    ┌─────▼─────┐
   │  Naver  │      │  Google   │    │   Other   │
   │  Maps   │      │  Places   │    │   APIs    │
   └─────────┘      └───────────┘    └───────────┘
```

## 3. 프론트엔드 아키텍처

### 3.1 디렉토리 구조

```
frontend/
├── src/
│   ├── components/       # 재사용 가능한 컴포넌트
│   │   └── svg/         # SVG 아이콘 컴포넌트
│   ├── screens/         # 화면 컴포넌트
│   │   ├── HomeScreen.tsx
│   │   ├── OnePayScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   └── SplashScreen.tsx
│   ├── constants/       # 상수 및 설정
│   │   ├── theme.ts
│   │   ├── userCards.ts
│   │   └── merchantImages.ts
│   └── types/          # TypeScript 타입 정의
├── assets/             # 이미지, 폰트, 아이콘
├── plugins/            # Expo Config Plugins
│   ├── withNaverMaps.js
│   ├── withNaverMapsGradle.js
│   └── withPodfileSource.js
└── scripts/            # 빌드 스크립트
    └── generate-app-icon.js
```

### 3.2 주요 화면 구성

**HomeScreen**
- Naver Maps 지도 표시
- 사용자 위치 기반 주변 가맹점 마커
- 카테고리 필터 (즐겨찾기, 카페, 음식점, 마트, 편의점)
- 정렬 필터 (영업중, 혜택순, 거리순, 추천순)
- 건물 내부 감지 시 "결제 중이신가요?" 메시지
- BottomSheet로 가맹점 목록 및 상세 정보 표시

**OnePayScreen**
- 바코드/QR 코드 토글 표시
- 3분 타이머 및 갱신 기능
- 카드별 혜택 한도 및 실적 진행률
- 수평 스크롤 카드 선택 (중앙 카드 1.1배 확대)

**ProfileScreen**
- 사용자 정보 표시
- 보유 카드 관리
- 카드 등록 (카메라/갤러리)

### 3.3 상태 관리

React Hooks 기반 로컬 상태 관리:
- `useState`: 화면별 로컬 상태
- `useRef`: 맵 참조, 애니메이션 값, 타이머
- `useEffect`: API 호출, 타이머 관리, 애니메이션

### 3.4 API 통신

**Axios 기반 REST API 통신**

주요 엔드포인트:
```typescript
// 주변 가맹점 조회
GET /api/nearby-recommendations
params: { lat, lng, user_lat, user_lng, radius, cards }

// 특정 가맹점 상세 혜택 조회
POST /api/merchant-recommendations
body: { merchant_name, category, user_cards }

// 장소 검색
GET /api/search-place
params: { query }
```

### 3.5 자동화 설정 (Config Plugins)

**withNaverMaps.js**
- AndroidManifest.xml에 Naver Maps 클라이언트 ID 자동 추가
- 환경변수에서 `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` 읽어 적용

**withNaverMapsGradle.js**
- build.gradle에 Naver Maps Maven repository 자동 추가
- `https://repository.map.naver.com/archive/maven`

**withPodfileSource.js**
- iOS Podfile에 CocoaPods GitHub source 자동 추가
- CDN 연결 문제 해결

## 4. 백엔드 아키텍처

### 4.1 디렉토리 구조

```
backend/
├── app.py              # Flask 메인 애플리케이션
├── services/           # 비즈니스 로직 서비스
│   ├── location_service.py
│   ├── geocoding_service.py
│   └── benefit_lookup_service.py
├── scripts/            # 유틸리티 스크립트
├── benefits_db.json    # 카드 혜택 데이터베이스
└── requirements.txt    # Python 의존성
```

### 4.2 주요 서비스

**Location Service**
- 건물 내부 감지 (`detect_indoor`)
- 건물 내 가맹점 검색 (`search_building_stores`)
- 주변 가맹점 검색 및 거리 계산

**Geocoding Service**
- Naver Geocoding API 연동
- 좌표 → 주소 변환
- 장소명 검색

**Benefit Lookup Service**
- 카드별 혜택 데이터베이스 조회
- 가맹점-카드 매칭
- 혜택 점수 계산 및 순위 산정

### 4.3 데이터 구조

**Benefits Database (benefits_db.json)**
```json
{
  "카드명": {
    "가맹점": {
      "할인율": 0.1,
      "할인한도": 5000,
      "전월실적": 300000,
      "월한도": 50000,
      "적립률": 0.02
    }
  }
}
```

### 4.4 건물 감지 로직

```python
def detect_indoor(lat, lng, user_lat, user_lng):
    # 사용자와 검색 위치 간 거리 계산
    distance = haversine(user_lat, user_lng, lat, lng)

    # 30m 이내면 건물 내부로 판단
    if distance < 30:
        # 주소 정보로 건물명 추출
        address_info = get_address_from_coords(lat, lng)
        return True, building_name

    return False, None
```

## 5. 데이터 흐름

### 5.1 가맹점 검색 및 추천 플로우

```
1. 사용자 위치 획득 (GPS)
   │
   ▼
2. 카메라 이동 감지 (지도 탐색)
   │
   ▼
3. Backend API 호출
   GET /api/nearby-recommendations
   - 검색 중심 좌표 (lat, lng)
   - 사용자 현재 위치 (user_lat, user_lng)
   - 검색 반경 (radius)
   - 보유 카드 목록 (cards)
   │
   ▼
4. Backend 처리
   4-1. 건물 내부 감지
        - 사용자 위치와 검색 위치 거리 < 30m
        - 주소 정보에서 건물명 추출

   4-2. 가맹점 검색
        - 건물 내부: 해당 건물의 가맹점만 검색
        - 건물 외부: 반경 내 모든 가맹점 검색

   4-3. 혜택 계산
        - 각 가맹점별 최적 카드 선정
        - 혜택 점수 계산 및 순위 산정
   │
   ▼
5. Frontend 렌더링
   - 지도에 가맹점 마커 표시
     * 혜택 수준별 색상 구분 (상위 20%, 중위, 하위 20%)
   - BottomSheet에 가맹점 목록 표시
     * 건물 내부: "결제 중이신가요?" 메시지
     * 건물 외부: 필터 버튼 표시
   - 정렬 필터 적용
```

### 5.2 가맹점 상세 정보 조회 플로우

```
1. 사용자가 가맹점 선택
   │
   ▼
2. Backend API 호출
   POST /api/merchant-recommendations
   - 가맹점명 (merchant_name)
   - 카테고리 (category)
   - 보유 카드 목록 (user_cards)
   │
   ▼
3. Backend 처리
   - 해당 가맹점의 모든 카드 혜택 조회
   - 카드별 점수 계산 및 순위 산정
   - 혜택 상세 정보 구성
   │
   ▼
4. Frontend 렌더링
   - 카드 수평 스크롤 표시
   - 선택된 카드의 혜택 상세 정보
     * 할인율/할인금액
     * 적립률
     * 전월 실적 조건
   - 실적 및 혜택 한도 진행률
```

## 6. 주요 기능별 상세 설명

### 6.1 지도 기반 가맹점 검색

**기술 구성**
- Naver Maps SDK for React Native
- 사용자 위치 추적 (expo-location)
- 카메라 이동 감지 및 디바운싱 (1초)

**최적화**
- 줌 레벨별 마커 클러스터링
- 검색 반경 자동 조정 (zoom < 14: 2km, zoom < 15: 1km, 기본: 500m)

### 6.2 건물 감지 및 실내 결제

**감지 로직**
- 사용자 위치와 검색 위치 간 거리 < 30m
- Haversine 공식 기반 거리 계산

**UI 변화**
- 건물 내부: "결제 중이신가요?" 메시지 + 해당 건물 가맹점만 표시
- 건물 외부: 필터 버튼 표시 + 전체 가맹점 표시

### 6.3 필터 및 정렬

**필터 옵션**
- 영업중: 현재 영업 중인 가맹점만 표시
- 혜택순: 카드 혜택 점수 기준 정렬
- 거리순: 사용자 위치 기준 거리순 정렬
- 추천순: 혜택 점수 기준 정렬 (혜택순과 동일)

**정렬 방향**
- 각 필터별 오름차순/내림차순 토글

### 6.4 One Pay 간편 결제

**기능**
- 바코드/QR 코드 토글 표시
- 3분 타이머 (자동 갱신)
- 수평 스크롤 카드 선택
- 선택된 카드 1.1배 확대 애니메이션
- 카드별 실적 및 혜택 한도 진행률 표시

## 7. 배포 및 빌드

### 7.1 개발 환경 실행

**Frontend**
```bash
# Metro bundler 시작
npm start

# Android 개발 빌드
npx expo run:android

# iOS 개발 빌드
npx expo run:ios
```

**Backend**
```bash
# Python 가상환경 활성화
python -m venv venv
source venv/bin/activate  # Mac/Linux

# 의존성 설치
pip install -r requirements.txt

# Flask 서버 실행
python app.py
```

### 7.2 빌드 프로세스

**Native 재빌드**
```bash
# Android + iOS 네이티브 폴더 재생성
npx expo prebuild --clean

# 플랫폼별 재생성
npx expo prebuild --platform android --clean
npx expo prebuild --platform ios --clean
```

**앱 아이콘 생성**
```bash
npm run generate-icons
```

### 7.3 환경 변수

**.env**
```
EXPO_PUBLIC_NAVER_MAP_CLIENT_ID=your_client_id
EXPO_PUBLIC_NAVER_MAP_CLIENT_SECRET=your_client_secret
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key
EXPO_PUBLIC_API_URL=http://your-backend-url
```

## 8. 보안 고려사항

### 8.1 API 키 관리
- 환경 변수를 통한 API 키 관리
- Git에 `.env` 파일 제외 (.gitignore)
- Config Plugins를 통한 네이티브 빌드 시 자동 주입

### 8.2 데이터 통신
- HTTPS 사용 권장
- API 응답 데이터 검증

## 9. 성능 최적화

### 9.1 Frontend
- FlatList의 `getItemLayout`으로 레이아웃 계산 최적화
- 이미지 lazy loading
- 애니메이션 useNativeDriver 사용
- API 요청 디바운싱 (지도 이동)

### 9.2 Backend
- 가맹점 데이터 캐싱
- 효율적인 거리 계산 (Haversine)
- JSON 파일 기반 빠른 조회

## 10. 향후 개선 사항

### 10.1 기능 개선
- 실제 영업 시간 데이터 연동
- 실시간 카드 사용 내역 연동
- 즐겨찾기 기능 백엔드 연동
- 푸시 알림 (근처 혜택 알림)

### 10.2 기술 개선
- 데이터베이스 마이그레이션 (JSON → PostgreSQL/MongoDB)
- 캐싱 레이어 추가 (Redis)
- 로그 및 모니터링 시스템
- 테스트 코드 작성 (Unit, Integration)

## 11. 트러블슈팅

### 11.1 일반적인 문제

**Metro bundler 캐시 문제**
```bash
npx expo start --clear
```

**네이티브 의존성 문제**
```bash
# Android
cd android && ./gradlew clean && cd ..

# iOS
cd ios && pod install && cd ..
```

**Naver Maps SDK 오류**
- `npx expo prebuild` 실행으로 config plugins 적용 확인
- AndroidManifest.xml 및 build.gradle 설정 확인
- iOS Info.plist에 NMFNcpKeyId 확인

### 11.2 디버깅 팁

**React Native Debugger**
- Chrome DevTools 사용
- Network 탭에서 API 호출 확인
- Console에서 로그 확인

**Backend 로그**
- Flask 개발 서버 콘솔 출력 확인
- API 요청/응답 로깅

---

**문서 버전**: 1.0
**최종 업데이트**: 2025-11-01
**작성자**: CARDEALO Development Team
