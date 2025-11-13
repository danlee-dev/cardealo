# 지도에 경로 표시하기

## 개요

Google Directions API에서 받은 경로 데이터를 React Native 지도에 표시하는 방법입니다.

## 필요한 라이브러리

```bash
# React Native Maps (이미 설치되어 있음)
npm install react-native-maps

# Polyline 디코딩 라이브러리
npm install @mapbox/polyline
```

## 1. Backend API 응답 구조

```typescript
interface DirectionsResponse {
  status: string;
  routes: Array<{
    overview_polyline: {
      points: string;  // 인코딩된 polyline 문자열
    };
    legs: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      steps: Array<{
        html_instructions: string;
        polyline: { points: string };
        travel_mode: string;
      }>;
    }>;
  }>;
  total_distance: number;
  total_duration: number;
  fare?: { currency: string; value: number };
}
```

## 2. Polyline 디코딩 및 표시

### 방법 A: react-native-maps의 Polyline 컴포넌트 사용

```typescript
import MapView, { Polyline, Marker } from 'react-native-maps';
import polyline from '@mapbox/polyline';

interface RouteDisplayProps {
  route: DirectionsResponse;
}

const RouteDisplay: React.FC<RouteDisplayProps> = ({ route }) => {
  // Polyline 디코딩
  const decodedPath = route.routes[0]?.overview_polyline?.points
    ? polyline.decode(route.routes[0].overview_polyline.points)
    : [];

  // MapView 좌표 형식으로 변환
  const coordinates = decodedPath.map(([latitude, longitude]) => ({
    latitude,
    longitude,
  }));

  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: coordinates[0]?.latitude || 37.5665,
        longitude: coordinates[0]?.longitude || 126.9780,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {/* 경로 선 */}
      <Polyline
        coordinates={coordinates}
        strokeColor="#007AFF"
        strokeWidth={4}
      />

      {/* 출발지 마커 */}
      {coordinates.length > 0 && (
        <Marker
          coordinate={coordinates[0]}
          title="출발지"
          pinColor="green"
        />
      )}

      {/* 도착지 마커 */}
      {coordinates.length > 0 && (
        <Marker
          coordinate={coordinates[coordinates.length - 1]}
          title="도착지"
          pinColor="red"
        />
      )}
    </MapView>
  );
};
```

### 방법 B: react-native-maps-directions 라이브러리 사용 (더 간단)

```bash
npm install react-native-maps-directions
```

```typescript
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

const GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY';

interface RouteDisplayProps {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  waypoints?: Array<{ latitude: number; longitude: number }>;
}

const RouteDisplay: React.FC<RouteDisplayProps> = ({
  origin,
  destination,
  waypoints,
}) => {
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: origin.latitude,
        longitude: origin.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {/* 자동으로 경로 표시 */}
      <MapViewDirections
        origin={origin}
        destination={destination}
        waypoints={waypoints}
        apikey={GOOGLE_MAPS_API_KEY}
        strokeWidth={4}
        strokeColor="#007AFF"
        mode="TRANSIT"
        onReady={(result) => {
          console.log(`거리: ${result.distance} km`);
          console.log(`시간: ${result.duration} 분`);
        }}
      />

      <Marker coordinate={origin} title="출발지" pinColor="green" />
      <Marker coordinate={destination} title="도착지" pinColor="red" />
    </MapView>
  );
};
```

## 3. 혼합 모드 경로 표시 (Mixed-Mode)

```typescript
import MapView, { Polyline, Marker } from 'react-native-maps';
import polyline from '@mapbox/polyline';

interface MixedModeRouteProps {
  legs: Array<{
    from: string;
    to: string;
    mode: string;
    polyline: string;  // Backend에서 받은 인코딩된 polyline
  }>;
}

const MixedModeRouteDisplay: React.FC<MixedModeRouteProps> = ({ legs }) => {
  return (
    <MapView style={{ flex: 1 }}>
      {legs.map((leg, index) => {
        const coordinates = polyline
          .decode(leg.polyline)
          .map(([latitude, longitude]) => ({ latitude, longitude }));

        // 모드별 색상
        const color = leg.mode === 'walking' ? '#00C853' : '#007AFF';

        return (
          <Polyline
            key={index}
            coordinates={coordinates}
            strokeColor={color}
            strokeWidth={4}
          />
        );
      })}
    </MapView>
  );
};
```

## 4. 단계별 안내 (Step-by-Step Navigation)

```typescript
interface NavigationStep {
  instruction: string;
  distance: string;
  duration: string;
  polyline: string;
}

const StepByStepNavigation: React.FC<{ steps: NavigationStep[] }> = ({
  steps,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <View>
      <MapView style={{ flex: 1 }}>
        {steps.map((step, index) => {
          const coordinates = polyline
            .decode(step.polyline)
            .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));

          return (
            <Polyline
              key={index}
              coordinates={coordinates}
              strokeColor={index === currentStep ? '#FF5722' : '#CCCCCC'}
              strokeWidth={index === currentStep ? 6 : 3}
            />
          );
        })}
      </MapView>

      {/* 하단 안내 패널 */}
      <View style={{ padding: 16, backgroundColor: 'white' }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
          {steps[currentStep].instruction}
        </Text>
        <Text>{steps[currentStep].distance}</Text>
        <Text>{steps[currentStep].duration}</Text>
      </View>
    </View>
  );
};
```

## 5. Backend에서 Polyline 데이터 포함하도록 수정

현재 Backend는 polyline을 반환하지만, mixed-mode에서는 각 leg별 polyline을 추가해야 합니다.

### directions_service.py 수정 필요

```python
# get_course_directions_mixed_mode에서
leg_result = self.get_directions(...)

if leg_result['status'] == 'OK':
    # Polyline 추가
    leg_polyline = leg_result.get('routes', [{}])[0].get('overview_polyline', {}).get('points', '')

    legs_summary.append({
        'from': ...,
        'to': ...,
        'mode': mode,
        'polyline': leg_polyline,  # 추가
        ...
    })
```

## 6. 실제 사용 예시

```typescript
// AI 코스 추천 후 경로 표시
const CourseMapScreen = ({ courseData }) => {
  const [route, setRoute] = useState(null);

  useEffect(() => {
    // Backend에서 경로 가져오기
    fetch('http://localhost:5001/api/course-directions-mixed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        course_stops: courseData.places,
        start_location: userLocation,
      }),
    })
      .then((res) => res.json())
      .then((data) => setRoute(data));
  }, []);

  if (!route) return <LoadingSpinner />;

  return (
    <MapView style={{ flex: 1 }}>
      {route.legs_summary.map((leg, index) => {
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
  );
};
```

## 권장 방법

1. **간단한 경로**: `react-native-maps-directions` 사용 (가장 간단)
2. **커스텀 스타일링**: `@mapbox/polyline` + `react-native-maps` Polyline
3. **혼합 모드**: Backend에서 각 leg별 polyline 받아서 모드별 색상으로 표시

## 주의사항

- Google Maps API 키가 필요합니다
- iOS에서는 Google Maps SDK 설정 필요
- Polyline 디코딩 시 [latitude, longitude] 순서 주의
