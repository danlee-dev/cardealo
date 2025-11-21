# Development Logs (Troubleshooting Records)

프로젝트 개발 중 발생한 문제와 해결 방법을 기록합니다.

## 로그 파일 목록

### 네트워킹 / 빌드 시스템
- [2025-10-30-metro-bundler-connection-error.md](./2025-10-30-metro-bundler-connection-error.md)
  - Metro Bundler 연결 오류 해결
  - TCP connection timeout 문제
  - Watchman 설정 이슈

### 인증 / API
- [2025-10-30-naver-maps-authentication-fix.md](./2025-10-30-naver-maps-authentication-fix.md)
  - Naver Maps SDK [401] Unauthorized 에러
  - 올바른 키 이름 사용법
  - iOS/Android 플랫폼별 설정

### 컴포넌트 / Import
- [2025-10-31-naver-maps-marker-import-issue.md](./2025-10-31-naver-maps-marker-import-issue.md)
  - Naver Maps Marker 컴포넌트 임포트 오류
  - NaverMapMarkerOverlay가 올바른 이름
  - 패키지 export 확인 방법

### UI / 스타일링
- [2025-10-31-android-elevation-borderradius-issue.md](./2025-10-31-android-elevation-borderradius-issue.md)
  - Android elevation과 borderRadius 호환 문제
  - Platform별 스타일 분기 처리
  - 그림자 vs 테두리 대안

## 로그 작성 규칙

### 파일명 형식
```
YYYY-MM-DD-brief-description.md
```

### 필수 섹션
1. **문제 (Problem)**
   - 증상
   - 에러 메시지
   - 재현 코드

2. **원인 (Root Cause)**
   - 문제 발생 이유
   - 기술적 배경

3. **해결 방법 (Solution)**
   - 최종 해결 코드
   - 적용 방법
   - 검증 방법

4. **학습 내용 (Lessons Learned)**
   - 얻은 지식
   - 주의사항
   - 참고 자료

### 선택 섹션
- 시도했으나 실패한 방법
- 시행착오
- 참고 자료
- 관련 이슈 링크

## 카테고리별 분류

향후 로그가 많아지면 다음과 같이 폴더로 분류:

```
dev-logs/
├── README.md
├── networking/
│   └── metro-bundler-issues.md
├── authentication/
│   └── naver-maps-auth.md
├── styling/
│   └── android-elevation.md
└── build/
    └── gradle-issues.md
```

## 검색 팁

### 키워드로 검색
```bash
grep -r "elevation" dev-logs/
```

### 날짜로 검색
```bash
ls dev-logs/ | grep "2025-10-31"
```

### 카테고리별 검색
```bash
grep -l "Android" dev-logs/*.md
```

## 기여 가이드

새로운 문제 해결 시:
1. 날짜-문제요약.md 형식으로 파일 생성
2. 필수 섹션 모두 작성
3. 코드 블록에 언어 지정
4. 스크린샷이 있다면 images/ 폴더에 저장
5. README.md의 목록에 추가

## 유용한 명령어

### 최근 로그 확인
```bash
ls -lt dev-logs/*.md | head -5
```

### 전체 로그 내용 검색
```bash
grep -r "keyword" dev-logs/
```

### 로그 파일 수 확인
```bash
ls -1 dev-logs/*.md | wc -l
```
