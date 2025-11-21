# React Native "Unable to load script" Error

**Date**: 2025-10-30
**Platform**: Android Emulator (Medium_Phone_API_36)
**Environment**: Expo SDK 54, React Native 0.81.5

## Problem

Android 에뮬레이터에서 앱 실행 시 지속적으로 다음 에러 발생:
```
Unable to load script. Make sure you're either running a Metro server (run 'react-native start') or that your bundle 'index.android.bundle' is packaged correctly for release.
```

빨간색 에러 화면이 표시되며 앱이 정상 작동하지 않음.

## Attempted Solutions (Failed)

### 1. Port Forwarding
```bash
adb reverse tcp:8081 tcp:8081
```
- 결과: 실패
- 이유: 에뮬레이터 재부팅 시 설정이 초기화되었으나, 근본 원인은 Metro 서버 자체의 문제였음

### 2. Metro Bundler Restart (Multiple Times)
```bash
# Metro 프로세스 종료 시도
kill <pid>
# Metro 재시작
npx expo start --clear
```
- 결과: 실패
- 이유: 백그라운드에서 실행 중인 다른 Metro 프로세스(pid 80044)가 8081 포트를 계속 점유하고 있었음

### 3. Clean Build
```bash
cd android
./gradlew clean
cd ..
npm run android
```
- 결과: 실패
- 이유: 빌드 자체는 성공했으나 Metro 서버 연결 문제는 해결되지 않음

### 4. App Uninstall/Reinstall
```bash
adb uninstall com.danleedev.frontend
npm run android
```
- 결과: 실패
- 이유: 앱 자체의 문제가 아니라 Metro 서버 연결 문제였음

### 5. Release Bundle Generation Attempts
```bash
# Attempt 1
npx expo export --platform android

# Attempt 2
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle

# Attempt 3
cd android && ./gradlew assembleRelease
```
- 결과: 모두 실패하거나 문제 해결에 도움 안됨
- 이유: 근본 원인인 Metro 서버 포트 충돌을 해결하지 못함

## Root Cause

두 가지 복합적인 문제:

1. **Metro 서버 포트 충돌**
   - 이전에 실행된 Metro 프로세스(pid 80044)가 백그라운드에서 8081 포트를 계속 점유
   - 새로운 Metro 서버를 시작하려 해도 포트 충돌로 정상 작동 불가
   - `npx expo start --clear` 실행 시 "Port 8081 is running this app in another window" 경고 발생

2. **에뮬레이터 상태 불안정**
   - 이미 실행 중인 에뮬레이터에 반복적으로 앱을 재설치하면서 adb 연결이 불안정해짐
   - adb reverse 설정이 에뮬레이터 재부팅 시 초기화되었으나 제대로 재설정되지 않음

## Solution

```bash
# 1. 기존 Metro 프로세스 완전 종료
kill -9 80044

# 2. 에뮬레이터 완전 재시작 (cold boot)
npm run android
```

이 방법으로:
- Metro 서버가 8081 포트를 정상적으로 사용
- 에뮬레이터가 cold boot되면서 모든 설정 초기화
- adb 연결도 자동으로 새로 설정됨

## Technical Details

### Metro Bundler 작동 원리
- Metro는 8081 포트에서 WebSocket 서버를 실행
- Android 앱은 localhost:8081로 JavaScript 번들을 요청
- 에뮬레이터는 `adb reverse`로 localhost를 호스트 머신에 포워딩

### 왜 다른 방법들은 실패했는가?

1. **adb reverse만으로는 부족**: 포트 포워딩은 정상이었지만, Metro 서버 자체가 제대로 작동하지 않았음
2. **Metro 재시작만으로는 부족**: 이미 실행 중인 프로세스를 완전히 종료하지 못해 포트 충돌 지속
3. **Clean build는 무관**: 빌드 산출물의 문제가 아니라 런타임 연결 문제였음
4. **Release build는 우회 방법**: 번들을 미리 생성하면 Metro 없이 실행 가능하지만, 개발 환경에서는 비효율적

### 에뮬레이터 Cold Boot의 중요성
- `npm run android`는 에뮬레이터가 꺼져있으면 자동으로 시작
- 이때 구글 로고부터 로딩되는 것이 cold boot의 증거
- 모든 네트워크 설정과 adb 연결이 깨끗한 상태로 초기화됨

## Key Takeaways

1. Metro 서버 문제 발생 시 항상 포트 점유 상태 확인:
   ```bash
   lsof -i :8081
   # 또는
   netstat -an | grep 8081
   ```

2. 프로세스 종료는 확실하게:
   ```bash
   kill -9 <pid>  # SIGKILL로 강제 종료
   ```

3. 에뮬레이터 상태가 의심되면 cold boot:
   - 이미 실행 중인 에뮬레이터 종료
   - `npm run android`로 새로 시작

4. 문제 해결 시 우선순위:
   - Metro 서버 상태 확인 (포트, 프로세스)
   - adb 연결 상태 확인
   - 에뮬레이터 재시작
   - 마지막으로 clean build

## References

- https://velog.io/@nudge411/React-Native-Android-빌드시-자주-보게되는-Unable-to-load-script.-Make-sure-youre-either-running-a-Metro-server-run-react-native-start-or-that-your-bundle-index.android.bundle-is-packaged-correctly-for-release의-근본적인-해결방법
- https://dlevelb.tistory.com/1142
- https://borntodevelop.tistory.com/entry/React-Native-Error-Unable-to-load-script...
