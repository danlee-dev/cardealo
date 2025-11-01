# Naver Maps Marker Import Issue

Date: 2025-10-31

## 문제

Naver Maps에 마커를 추가하려고 시도했을 때 "Element type is invalid" 에러 발생.

### 증상
- 마커 컴포넌트를 임포트하고 사용했지만 렌더링 실패
- 콘솔 에러: "Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined"
- 홈 화면에서 가맹점 위치를 지도에 표시하지 못함

### 재현 코드
```tsx
// 잘못된 임포트
import { NaverMapView, Marker } from '@mj-studio/react-native-naver-map';

<NaverMapView>
  <Marker
    latitude={37.5853}
    longitude={127.0302}
  />
</NaverMapView>
```

## 원인

`@mj-studio/react-native-naver-map` 패키지는 `Marker`라는 이름의 컴포넌트를 export하지 않음.

### 실제 export 이름
패키지의 index.d.ts에서 확인한 결과:
- 마커 컴포넌트의 정확한 이름: `NaverMapMarkerOverlay`
- `Marker`는 존재하지 않는 export

## 해결 방법

올바른 컴포넌트 이름 사용.

### 최종 코드
```tsx
import { NaverMapView, NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';

<NaverMapView
  initialCamera={{
    latitude: 37.5847,
    longitude: 127.0297,
    zoom: 16,
  }}
>
  {stores.map((store) => (
    <NaverMapMarkerOverlay
      key={store.id}
      latitude={store.latitude}
      longitude={store.longitude}
      onTap={() => {
        console.log(`마커 클릭: ${store.name}`);
      }}
    />
  ))}
</NaverMapView>
```

### 적용 결과
- 마커가 지도에 정상적으로 표시됨
- 마커 클릭 이벤트 정상 작동
- 카테고리 필터링에 따라 마커도 함께 필터링됨

## 학습 내용

1. **정확한 컴포넌트 이름 확인**
   - 패키지 문서를 먼저 확인
   - TypeScript 정의 파일(index.d.ts) 참고
   - 추측하지 말고 정확한 export 이름 사용

2. **Naver Maps SDK의 Overlay 컴포넌트**
   - 마커: `NaverMapMarkerOverlay`
   - 원형: `NaverMapCircleOverlay`
   - 경로: `NaverMapPathOverlay`
   - 폴리곤: `NaverMapPolygonOverlay`
   - 모든 오버레이 컴포넌트가 `NaverMap*Overlay` 형식

3. **패키지 export 확인 방법**
   ```bash
   cat node_modules/@mj-studio/react-native-naver-map/lib/typescript/module/src/index.d.ts
   ```

## 참고 자료

- [@mj-studio/react-native-naver-map GitHub](https://github.com/mym0404/react-native-naver-map)
- Package exports: node_modules/@mj-studio/react-native-naver-map/lib/typescript/module/src/index.d.ts

## 관련 컴포넌트

HomeScreen.tsx:85-92에서 NaverMapMarkerOverlay 사용 중
