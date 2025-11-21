# Cardealo 배포 가이드

## 백엔드 배포 (Railway)

### 1. Railway 프로젝트 생성

```bash
# Railway CLI 설치 (아직 안했다면)
npm install -g @railway/cli

# Railway 로그인
railway login

# 새 프로젝트 생성
cd backend
railway init
```

### 2. 환경변수 설정

Railway 대시보드에서 다음 환경변수들을 설정하세요:

```
NCP_CLIENT_ID=실제_ncp_client_id
NCP_CLIENT_SECRET=실제_ncp_client_secret
GOOGLE_MAPS_API_KEY=실제_google_maps_api_key
GEMINI_API_KEY=실제_gemini_api_key
NAVER_OCR_SECRET_KEY=실제_naver_ocr_secret_key
NAVER_OCR_INVOKE_URL=실제_naver_ocr_invoke_url
FLASK_ENV=production
JWT_SECRET=랜덤한_비밀키_32자_이상
PORT=5001
```

또는 CLI로 설정:

```bash
railway variables set NCP_CLIENT_ID="your_value"
railway variables set NCP_CLIENT_SECRET="your_value"
railway variables set GOOGLE_MAPS_API_KEY="your_value"
railway variables set GEMINI_API_KEY="your_value"
railway variables set JWT_SECRET="your_secret_key"
railway variables set FLASK_ENV="production"
```

### 3. 배포

```bash
# backend 디렉토리에서
railway up
```

배포 완료 후 Railway 대시보드에서 도메인을 확인하세요.
예: `https://cardealo-production.up.railway.app`

### 4. 배포 확인

```bash
# 헬스 체크
curl https://your-app.up.railway.app/api/health

# 또는
railway open
```

## 프론트엔드 설정

### 1. 백엔드 URL 업데이트

`frontend/.env` 파일 생성:

```bash
EXPO_PUBLIC_API_URL=https://your-railway-app.up.railway.app
```

### 2. Expo 빌드 (선택사항)

#### 개발 모드로 테스트

```bash
cd frontend
npx expo start
```

#### 프로덕션 빌드 (EAS Build)

```bash
# EAS CLI 설치
npm install -g eas-cli

# EAS 로그인
eas login

# 프로젝트 설정
eas build:configure

# Android 빌드
eas build --platform android

# iOS 빌드 (Mac 필요)
eas build --platform ios
```

## 배포 체크리스트

### 백엔드
- [ ] Railway 프로젝트 생성
- [ ] 환경변수 모두 설정
- [ ] `railway up` 실행
- [ ] API 엔드포인트 테스트
- [ ] 데이터베이스 초기화 확인 (SQLite는 자동 생성)

### 프론트엔드
- [ ] `.env` 파일에 백엔드 URL 설정
- [ ] Expo 앱 실행 테스트
- [ ] 테스트 계정으로 로그인 확인
- [ ] 카드 혜택 조회 테스트
- [ ] 코스 추천 기능 테스트

## 트러블슈팅

### Railway 배포 실패

1. **Python 버전 확인**
   - `runtime.txt`에 `python-3.11.6` 명시되어 있는지 확인

2. **의존성 오류**
   - `requirements.txt`에 모든 패키지가 명시되어 있는지 확인
   - Railway 로그 확인: `railway logs`

3. **환경변수 누락**
   - Railway 대시보드에서 모든 필수 환경변수 확인

### 프론트엔드 연결 실패

1. **CORS 오류**
   - 백엔드의 CORS 설정 확인 (이미 설정됨)

2. **API URL 오류**
   - `.env` 파일의 URL이 정확한지 확인
   - https:// 포함 여부 확인

## 모니터링

### Railway 로그 확인

```bash
railway logs
```

### 데이터베이스 백업

SQLite는 Railway의 볼륨에 저장됩니다. 정기적으로 백업하세요:

```bash
# Railway 볼륨 다운로드
railway run python -c "import shutil; shutil.copy('cardealo.db', 'backup.db')"
```

## 추가 설정 (선택사항)

### Custom Domain 설정

Railway 대시보드 → Settings → Domains에서 커스텀 도메인 추가

### 자동 배포 설정

GitHub 연동:
1. Railway 대시보드에서 GitHub 레포 연결
2. 자동 배포 활성화
3. `main` 또는 `develop` 브랜치 푸시 시 자동 배포
