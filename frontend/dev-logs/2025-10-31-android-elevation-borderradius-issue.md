# Android Elevation과 BorderRadius 호환 문제

Date: 2025-10-31

## 문제

Android에서 `elevation` 속성을 사용한 그림자가 `borderRadius`를 무시하고 사각형으로 표시됨.

### 증상
- iOS: borderRadius가 적용된 둥근 모서리에 그림자가 정상적으로 표시
- Android: borderRadius를 무시하고 사각형 영역에 그림자 생성
- 카드 모서리 주변에 이상한 사각형 그림자가 보임

### 재현 코드
```tsx
storeCard: {
  backgroundColor: '#F5F5F5',
  borderRadius: 12,
  elevation: 3,  // Android에서 borderRadius 무시
}
```

## 원인

Android의 `elevation` 속성은 Material Design 그림자를 생성하지만, borderRadius를 반영하지 않는 버그가 있음.

**Android elevation 제약사항:**
- `borderRadius`와 함께 사용 시 호환성 문제 발생
- `overflow: 'hidden'` 사용 시 내부 콘텐츠까지 숨겨짐
- 둥근 모서리에 그림자를 표현할 수 없음

## 해결 방법

Platform별로 다른 스타일을 적용하여 해결.

### 최종 코드
```tsx
import { Platform } from 'react-native';

storeCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#F5F5F5',
  borderRadius: 12,
  padding: 16,
  marginHorizontal: 12,
  marginBottom: 12,
  ...Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      borderWidth: 1,
      borderColor: '#E8E8E8',
    },
  }),
}
```

### 적용 결과
- **iOS**: 그림자로 입체감 표현 (shadowColor, shadowOffset 등)
- **Android**: 얇은 테두리로 입체감 표현 (elevation 제거)

## 시도했으나 실패한 방법

### 1. overflow: 'hidden' 사용
```tsx
storeCard: {
  borderRadius: 12,
  elevation: 3,
  overflow: 'hidden',  // ❌ 내부 콘텐츠까지 숨김
}
```
**문제**: 카드 내부의 모든 콘텐츠가 사라짐

### 2. elevation 값 조정
```tsx
storeCard: {
  borderRadius: 12,
  elevation: 1,  // ❌ 그림자는 약해지지만 여전히 사각형
}
```
**문제**: 그림자 강도만 변하고 사각형 문제는 해결되지 않음

### 3. 배경색 조정
```tsx
bottomSheetContent: {
  backgroundColor: COLORS.background,  // ❌ 부분적 해결
}
```
**문제**: 이상한 배경은 제거되지만 사각형 그림자는 여전히 존재

## 학습 내용

1. **Android elevation의 한계**
   - borderRadius와 호환되지 않음
   - Material Design의 제약사항
   - 둥근 모서리에는 부적합

2. **Platform별 UI 처리**
   - `Platform.select()`로 플랫폼별 스타일 분기
   - iOS와 Android의 디자인 시스템 차이 인식
   - 각 플랫폼에 최적화된 접근 필요

3. **대안적 입체감 표현**
   - Android: border, backgroundColor 조합
   - iOS: shadow 시스템
   - 같은 시각적 효과, 다른 구현 방법

## 참고 사항

- React Native 0.81.5 기준
- Android elevation 버그는 오래된 이슈
- 공식 문서에서도 borderRadius와 elevation 조합 사용 시 주의 권장
