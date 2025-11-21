# Naver Maps SDK Authentication Issue

Date: 2025-10-30

## 문제

Naver Maps SDK에서 [401] Unauthorized client 에러 발생.

### 증상
- iOS, Android 모두에서 지도가 로드되지 않음
- 콘솔 에러: "Authorization failed: [401] Unauthorized client"
- Naver Cloud Platform에서 Application 설정은 정상

## 원인

공식 문서와 다른 키 이름을 사용하여 인증 실패.

### 잘못된 설정

#### iOS (app.config.js)
```javascript
// ❌ 잘못된 키 이름
infoPlist: {
  NMFClientId: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID,
  NMFClientSecret: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_SECRET
}
```

#### Android (AndroidManifest.xml)
```xml
<!-- ❌ 잘못된 키 이름 -->
<meta-data android:name="com.naver.maps.map.CLIENT_ID"
    android:value="31t54pbm6t"/>
```

### 추가 문제
- Client Secret을 추가했지만, Naver Maps SDK는 Client ID만 필요
- 불필요한 환경 변수 설정

## 해결 방법

공식 문서([iOS](https://navermaps.github.io/ios-map-sdk/guide-ko/1.html), [Android](https://navermaps.github.io/android-map-sdk/guide-ko/1.html))에 명시된 정확한 키 이름 사용.

### iOS 올바른 설정

**app.config.js**
```javascript
ios: {
  infoPlist: {
    NMFNcpKeyId: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID
  }
}
```

**.env**
```
EXPO_PUBLIC_NAVER_MAP_CLIENT_ID=31t54pbm6t
```

### Android 올바른 설정

**AndroidManifest.xml**
```xml
<application>
  <meta-data
      android:name="com.naver.maps.map.NCP_KEY_ID"
      android:value="31t54pbm6t" />
</application>
```

## 핵심 포인트

1. **올바른 키 이름 사용**
   - iOS: `NMFNcpKeyId` (NMFClientId ❌)
   - Android: `com.naver.maps.map.NCP_KEY_ID` (CLIENT_ID ❌)

2. **Client Secret 불필요**
   - Naver Maps SDK는 Client ID만 사용
   - Client Secret은 서버 API 호출에만 필요

3. **Naver Cloud Platform 설정**
   - "Mobile Dynamic Map" 서비스 활성화 필요
   - 패키지 이름 정확히 일치: `com.danleedev.frontend`
   - iOS Bundle ID 일치: `com.danleedev.frontend`

## 시행착오

### 1. Client Secret 추가
- Naver Maps가 Client ID와 Secret 모두 필요하다고 오해
- 실제로는 Client ID만 필요

### 2. 잘못된 키 이름 사용
- 예상 키 이름으로 추측하여 설정
- 공식 문서 확인 필요

### 3. Web 서비스 URL 설정
- Mobile SDK에는 불필요
- Web Dynamic Map에만 필요

## 검증 방법

1. **환경 변수 확인**
```bash
cat .env
# EXPO_PUBLIC_NAVER_MAP_CLIENT_ID가 있는지 확인
```

2. **iOS 설정 확인**
```bash
grep -r "NMFNcpKeyId" ios/
```

3. **Android 설정 확인**
```bash
grep -r "NCP_KEY_ID" android/
```

## 참고 자료

- [Naver Maps iOS SDK 공식 문서](https://navermaps.github.io/ios-map-sdk/guide-ko/1.html)
- [Naver Maps Android SDK 공식 문서](https://navermaps.github.io/android-map-sdk/guide-ko/1.html)
- Naver Cloud Platform Console

## 최종 파일 구조

```
frontend/
├── .env
│   └── EXPO_PUBLIC_NAVER_MAP_CLIENT_ID=31t54pbm6t
├── app.config.js
│   └── ios.infoPlist.NMFNcpKeyId
└── android/app/src/main/AndroidManifest.xml
    └── <meta-data name="com.naver.maps.map.NCP_KEY_ID" />
```
