# 프로젝트 실행 가이드

## 개발 환경 실행 방법

VSCode를 처음 열었을 때 개발 환경을 실행하는 방법입니다.

### 1. 터미널 3개 준비

VSCode에서 터미널 3개를 열어둡니다.

### 2. 터미널 1: Metro Bundler 실행

```bash
cd frontend
npm start
```

Metro bundler가 시작되면 그대로 두고 다른 터미널로 이동합니다.

### 3. 터미널 2: iOS 시뮬레이터 실행

```bash
cd frontend
npm run ios
```

자동으로 iOS 시뮬레이터가 열리고 앱이 설치됩니다.

### 4. 터미널 3: Android 시뮬레이터 실행

```bash
cd frontend
npm run android
```

자동으로 Android 에뮬레이터가 열리고 앱이 설치됩니다.

### 5. 개발 중 Hot Reload

코드를 수정하면 Metro bundler가 자동으로 감지하여 양쪽 시뮬레이터 모두 새로고침됩니다.

수동으로 새로고침하려면:
- iOS: `Cmd + R`
- Android: `R` 키 두 번 빠르게

### 6. 로그 확인

**중요**: `npm run ios`와 `npm run android`는 빌드 후 종료되므로 로그가 보이지 않습니다.

**앱 실행 로그 확인 방법:**
- Metro bundler를 실행한 터미널(터미널 1)에서 모든 로그를 확인할 수 있습니다
- `console.log`, 에러, 경고가 모두 실시간으로 표시됩니다
- `npm run ios/android` 터미널이 아닌 `npm start` 터미널을 보세요

## 문제 해결

### Metro Bundler 포트 충돌

8081 포트가 이미 사용 중일 때 발생합니다.

**증상:**
- "Port 8081 is running this app in another window" 에러
- Metro bundler가 시작되지 않음

**해결 방법:**
```bash
# 8081 포트를 사용 중인 프로세스를 찾아서 강제 종료
lsof -ti:8081 | xargs kill -9

# 그 다음 Metro bundler 재시작
npm start
```

**명령어 설명:**
- `lsof -ti:8081`: 8081 포트를 사용 중인 프로세스 ID 찾기
- `|`: 파이프로 결과를 다음 명령어에 전달
- `xargs kill -9`: 찾은 프로세스 ID를 강제 종료 (-9는 강제 종료 신호)

### 캐시 문제

```bash
npm start -- --clear
```

### 네이티브 모듈 변경 후

iOS:
```bash
cd ios
pod install
cd ..
npm run ios
```

Android:
```bash
npm run android
```

## 시뮬레이터 단축키

### iOS 시뮬레이터
- `Cmd + R`: Reload
- `Cmd + D`: Dev Menu

### Android 에뮬레이터
- `R` 두 번: Reload
- `Cmd + M`: Dev Menu

## 주의사항

1. Metro bundler는 항상 실행 상태로 유지
2. 네이티브 코드 변경 시 앱 재빌드 필요
3. iOS pod install 후 항상 iOS 재빌드
4. Android gradle 변경 시 Android 재빌드
