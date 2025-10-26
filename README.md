# 소프트웨어 공학 7팀 - CARDEALO

<div align="center">
<img width="300" alt="cardealo-logo" src="https://raw.githubusercontent.com/danlee-dev/cardealo/main/images/cardealo-logo.png">
</div>

<div align="center">
<h3>위치 기반 개인화 카드 혜택 추천 플랫폼</h3>
</div>

> 개발기간: 2025.10 ~
>
> Built with React Native, Flask, PostgreSQL

## 프로젝트 개요

**Cardealo**는 사용자의 위치와 소비 패턴을 분석하여 최적의 신용카드 혜택을 실시간으로 추천하는 플랫폼입니다.

사용자가 방문한 식당, 카페, 상점에서 어떤 카드를 사용하면 최대 혜택을 받을 수 있는지 자동으로 분석하고 추천합니다. OCR 기술을 활용한 카드 자동 등록 기능과 Google Maps API를 통한 위치 기반 서비스를 제공하며, 개인화된 추천 알고리즘으로 사용자 맞춤형 카드 혜택 정보를 제공합니다.

## 주요 기능

### 위치 기반 실시간 추천
- 현재 위치 기반 실시간 카드 혜택 분석
- Google Maps API 연동으로 주변 가맹점 정보 제공
- 방문 예정 장소의 최적 카드 자동 추천

### 카드 관리
- OCR 기반 카드 자동 등록 (네이버 클라우드 OCR API)
- 보유 카드 목록 관리 및 혜택 정보 통합
- 카드별 혜택 비교 및 분석

### 개인화 혜택 제공
- 사용자 소비 패턴 기반 맞춤 추천
- 카테고리별 최적 카드 제안
- 혜택 누적 및 통계 제공

### 자동 데이터 업데이트
- 주간/월간 자동 크롤링으로 최신 혜택 정보 유지
- 카드사별 프로모션 정보 자동 수집
- 실시간 혜택 변경사항 반영

## 기술 스택

### 프론트엔드
- **프레임워크**: React Native (Expo)
- **플랫폼**: Android
- **네비게이션**: React Navigation
- **상태 관리**: TBD

### 백엔드
- **프레임워크**: Flask
- **데이터베이스**: PostgreSQL (psql)
- **배포**: Railway

### AI/ML
- **초기 알고리즘**: 가중치 기반 점수 알고리즘
- **향후 계획**: ML/딥러닝 기반 개인화 추천
- **데이터 처리**: 사용자 행동 패턴 분석

### 외부 API
- **OCR**: 네이버 클라우드 OCR API
- **지도**: Google Maps API (Geocoding 포함)
- **인증**: JWT, OAuth2 (Google 로그인)

### 데이터 수집
- **크롤링**: requests 라이브러리 (robots.txt 준수)
- **스케줄러**: 주간/월간 자동 크롤링
- **수집 대상**: 카드사 혜택 정보, 가맹점 정보

## 개발 계획

### Phase 1 (현재)
- 프로젝트 초기화 및 환경 설정
- 데이터베이스 스키마 설계
- 기본 UI/UX 구조
- OCR 카드 등록 기능 연동

### Phase 2 (계획)
- 위치 기반 추천 엔진
- 실시간 카드 혜택 분석
- 사용자 인증 시스템
- 카드 관리 기능

### Phase 3 (계획)
- ML 기반 개인화 추천
- 사용자 행동 패턴 분석
- 혜택 트래킹 고도화
- 통계 및 분석 대시보드

### Phase 4 (향후)
- 소셜 기능 및 공유
- 고급 분석 기능
- 혜택 알림 푸시
- 멀티 플랫폼 지원 (iOS)

## 시작하기

### 필수 요구사항
- Node.js 18+
- Python 3.9+
- PostgreSQL 14+
- Expo CLI
- Android Studio (Android 개발용)

### 설치

**프론트엔드**:
```bash
cd frontend
npm install
npx expo start
```

**백엔드**:
```bash
cd backend
pip install -r requirements.txt
flask run
```

## API 키 설정

다음 API 키들이 필요합니다:
- 네이버 클라우드 OCR API 키
- Google Maps API 키
- 데이터베이스 연결 문자열

프로젝트 루트에 `.env.example` 파일을 참고하여 `.env` 파일을 생성하세요.

## 참여자

| 이성민 (Seongmin Lee) | 민제민 (Jemin Min) |
| --- | --- |
| <img src="https://avatars.githubusercontent.com/danlee-dev" width="160px" alt="Seongmin Lee" /> | <img src="https://avatars.githubusercontent.com/AliceLacie" width="160px" alt="Jemin Min" /> |
| [GitHub: @danlee-dev](https://github.com/danlee-dev) | [GitHub: @AliceLacie](https://github.com/AliceLacie) |
| 프론트엔드, AI/ML | 백엔드, AI/ML |
| 고려대학교 컴퓨터학과 | 고려대학교 컴퓨터학과 |

## 라이선스

본 프로젝트는 교육 목적으로 개발되었습니다.

## 문의

프로젝트 관련 문의사항은 GitHub Issues를 통해 남겨주시기 바랍니다.
