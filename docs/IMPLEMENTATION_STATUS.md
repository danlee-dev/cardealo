# Cardealo 구현 현황 문서

> 문서 작성일: 2025년 12월 8일
> 버전: 2.0.0
> 작성자: 소프트웨어공학 7팀 (이성민, 민제민)

---

## 1. 시스템 아키텍처

### 1.1 전체 시스템 구성

```
+---------------------------+     +---------------------------+
|      Mobile App           |     |      Admin Web            |
|   (React Native/Expo)     |     |      (Next.js)            |
|   - 20개 화면             |     |   - 결제 처리             |
|   - Naver Maps            |     |   - QR/바코드 스캔        |
|   - Socket.io             |     |   - 결제 내역 관리        |
+-----------+---------------+     +-----------+---------------+
            |                                 |
            v                                 v
+-----------+---------------+     +-----------+---------------+
|      User Backend         |<--->|     Admin Backend         |
|        (Flask)            |     |       (FastAPI)           |
|   - REST API              |     |   - 결제 처리 API         |
|   - WebSocket             |     |   - 혜택 계산             |
|   - AI 코스 추천          |     |   - Webhook 연동          |
+-----------+---------------+     +-----------+---------------+
            |                                 |
            v                                 v
+-----------+---------------+     +-----------+---------------+
|      PostgreSQL           |     |      SQLite               |
|    (Railway 호스팅)       |     |    (Admin 전용 DB)        |
|   - 17개 테이블           |     |   - 3개 테이블            |
+---------------------------+     +---------------------------+
            |
            v
+---------------------------+
|      External APIs        |
|   - Google Places API     |
|   - Google Gemini AI      |
|   - Naver Maps/OCR API    |
|   - TMAP Directions API   |
+---------------------------+
```

### 1.2 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend (Mobile)** | React Native, Expo SDK 54, TypeScript |
| **Frontend (Admin)** | Next.js 15, Tailwind CSS, TypeScript |
| **Backend (User)** | Flask 3.0, SQLAlchemy, Flask-SocketIO |
| **Backend (Admin)** | FastAPI, SQLAlchemy, Pydantic |
| **Database** | PostgreSQL (User), SQLite (Admin) |
| **지도** | Naver Maps (@mj-studio/react-native-naver-map) |
| **실시간 통신** | Socket.io (WebSocket) |
| **AI/ML** | Google Gemini API |
| **OCR** | Naver Cloud Platform OCR |
| **경로 안내** | TMAP API, Google Directions API |
| **배포** | Railway (Backend), Vercel (Admin-Frontend), EAS Build (Mobile) |

---

## 2. 구현 완료 기능 상세

### 2.1 홈 화면 (HomeScreen)

#### 지도 기능
| 기능 | 상태 | 설명 |
|------|------|------|
| Naver Maps 지도 표시 | 완료 | 현재 위치 기반 지도 렌더링 |
| 현재 위치 추적 | 완료 | expo-location 사용, 실시간 위치 업데이트 |
| 주변 가맹점 마커 표시 | 완료 | Google Places API 연동, 혜택 점수 기반 색상 분류 |
| 현 지도에서 검색 버튼 | 완료 | 지도 이동 후 해당 영역 재검색 |
| 마커 클릭 시 상세 정보 | 완료 | BottomSheet로 가게 정보 표시 |

#### 검색 기능
| 기능 | 상태 | 설명 |
|------|------|------|
| 장소 검색 | 완료 | Google Places Text Search API 연동 |
| 검색 자동완성 | 완료 | Google Places Autocomplete API 연동 |
| 검색 기록 모달 | 완료 | 최근 검색어 저장 및 표시 |
| 실시간 검색 결과 리스트 | 완료 | 입력 시 실시간 검색 결과 모달 표시 |

#### 필터 기능
| 기능 | 상태 | 설명 |
|------|------|------|
| 카테고리 필터 | 완료 | 즐겨찾기/카페/음식점/마트/편의점 등 8개 카테고리 |
| 혜택순 정렬 | 완료 | 카드 혜택 점수 기준 정렬 |
| 거리순 정렬 | 완료 | 현재 위치 기준 거리순 정렬 |
| 추천순 정렬 | 완료 | AI 추천 점수 기준 정렬 |

#### 가게 상세 정보
| 기능 | 상태 | 설명 |
|------|------|------|
| 가게 사진 표시 | 완료 | Google Places Photos API 연동 (일부 가게만 사진 보유) |
| 상세 정보 조회 | 완료 | View Detail 버튼으로 사진, 전화번호, 영업시간, 리뷰 표시 |
| 카드 혜택 자동 선택 | 완료 | 해당 가게에서 최대 혜택 카드 자동 선택 |
| 카드 정보 가로 스크롤 | 완료 | FlatList 기반 카드 캐러셀 |
| 즐겨찾기 저장 | 완료 | 별표 클릭으로 즐겨찾기 저장 |

---

### 2.2 AI 코스 추천 (코스 모드)

#### 코스 생성
| 기능 | 상태 | 설명 |
|------|------|------|
| 자연어 코스 요청 | 완료 | "주말 단풍 데이트" 등 자연어 입력 |
| AI 의도 분석 | 완료 | Gemini API로 사용자 의도 파악 |
| 카드 UI 스트리밍 효과 | 완료 | 추천 중 카드 형태로 슬라이딩 표시, 지루하지 않게 구현 |
| 보유 카드 기반 혜택 최적화 | 완료 | 사용자 카드 혜택 최대화 코스 생성 |
| 코스 상세 정보 | 완료 | 각 장소별 예상 비용, 시간, 혜택 표시 |

#### 경로 안내
| 기능 | 상태 | 설명 |
|------|------|------|
| TMAP 경로 안내 연결 | 완료 | TMAP Directions API 연동 |
| 도보 경로 안내 | 완료 | 도보 모드 경로 표시 |
| 자동차 경로 안내 | 완료 | 자차 모드 경로 표시, 바텀시트 접히며 지도 전환 |
| 대중교통 경로 안내 | 완료 | 버스/지하철 경로, 환승 정보 표시 |
| 구간별 교통수단 선택 | 완료 | 각 경로마다 교통수단 선택 가능 |
| 환승 정보 표시 | 완료 | 대중교통 이용 시 환승 역/정류장 표시 |
| 거리/요금/시간 표시 | 완료 | 각 구간별 및 전체 정보 표시 |
| 1-2-3 순차 전환 효과 | 완료 | 코스 진입 시 원이 순차적으로 검정색으로 변하는 효과 |

#### 코스 관리
| 기능 | 상태 | 설명 |
|------|------|------|
| 코스 저장 | 완료 | 코스 제목 옆 저장 버튼으로 저장 |
| 코스 리스트 조회 | 완료 | 저장된 코스 목록 확인 |
| 코스 공유 (코스 리스트) | 완료 | 친구 코스 리스트에 직접 공유 (채팅방 공유와 별도) |
| 코스 삭제 | 완료 | 저장된 코스 삭제 |

---

### 2.3 OnePay 결제 시스템

#### 결제 준비
| 기능 | 상태 | 설명 |
|------|------|------|
| 카드 룰렛 효과 | 완료 | ONEPAY 버튼 클릭 시 카드 셔플 애니메이션 |
| 최적 카드 자동 선택 | 완료 | 가게 카테고리에 맞는 최대 혜택 카드 선택 |
| QR 코드 생성 | 완료 | 결제용 QR 코드 생성 (5분 유효) |
| 바코드 생성 | 완료 | 결제용 바코드 생성 (12자리) |
| QR/바코드 전환 | 완료 | 탭으로 QR/바코드 전환 표시 |
| 결제 코드 카운트다운 | 완료 | 5분 유효시간 카운트다운 표시 |

#### 결제 처리
| 기능 | 상태 | 설명 |
|------|------|------|
| 결제 상태 폴링 | 완료 | 결제 완료 시까지 상태 확인 |
| 결제 완료 알림 | 완료 | 결제 완료 시 알림 + 결과 화면 |
| 할인 금액 표시 | 완료 | 적용된 할인 금액 및 혜택 표시 |
| 잔액 부족 처리 | 완료 | 잔액 부족 시 모달 표시 |
| 한도 초과 처리 | 완료 | 카드 한도 초과 시 오류 표시 |

---

### 2.4 채팅 기능

#### 채팅 목록 (ChatListScreen)
| 기능 | 상태 | 설명 |
|------|------|------|
| 대화방 목록 조회 | 완료 | 최근 메시지 및 시간 표시 |
| 읽지 않은 메시지 표시 | 완료 | 안 읽은 메시지 개수 배지 |
| 대화방 검색 | 완료 | 이름으로 대화방 검색 |
| 친구 추가 탭 | 완료 | 이메일로 사용자 검색 및 친구 요청 |

#### 채팅방 (ChatRoomScreen)
| 기능 | 상태 | 설명 |
|------|------|------|
| 실시간 메시지 | 완료 | WebSocket 기반 실시간 메시지 송수신 |
| 메시지 기록 조회 | 완료 | 페이지네이션 기반 이전 메시지 로드 |
| 날짜별 메시지 그룹핑 | 완료 | 날짜 구분선 표시 |
| 타이핑 인디케이터 | 완료 | 상대방 입력 중 표시 |

#### 채팅방 더치페이 (정산)
| 기능 | 상태 | 설명 |
|------|------|------|
| 정산 요청 기능 | 완료 | + 버튼 > 정산 요청으로 금액 요청 |
| 정산 금액 송금 | 완료 | 가상 잔액에서 송금 처리 |
| 정산 완료 확인 | 완료 | 정산 완료 시 양쪽 확인 |

#### 채팅방 코스 공유
| 기능 | 상태 | 설명 |
|------|------|------|
| 저장된 코스 공유 | 완료 | + 버튼 > 코스 공유로 코스 전송 |
| 코스 보기 | 완료 | 공유된 코스 클릭 시 길 안내 페이지 이동 |

---

### 2.5 친구 기능 (FriendsScreen)

| 기능 | 상태 | 설명 |
|------|------|------|
| 친구 목록 조회 | 완료 | 수락된 친구 목록 표시 |
| 친구 요청 보내기 | 완료 | 이메일 검색으로 친구 요청 |
| 친구 요청 수락 | 완료 | 알림 탭에서 수락/거절 |
| 친구 요청 거절 | 완료 | 알림 탭에서 거절 |
| 친구 삭제 | 완료 | 친구 목록에서 삭제 |
| 친구 차단 | 완료 | 차단 기능 구현 |
| 사용자 검색 | 완료 | 이메일 또는 이름으로 검색 (예: "hong", "kim") |

---

### 2.6 알림 기능 (NotificationScreen)

| 기능 | 상태 | 설명 |
|------|------|------|
| 알림 목록 조회 | 완료 | 타입별 알림 표시 (결제, 친구요청, 혜택팁, 코스공유) |
| 실시간 알림 수신 | 완료 | WebSocket 기반 실시간 알림 |
| 알림 읽음 처리 | 완료 | 개별/전체 읽음 처리 |
| 알림 탭 이동 | 완료 | 알림 클릭 시 관련 화면으로 이동 |
| 친구 요청 수락/거절 | 완료 | 알림에서 직접 수락/거절 버튼 |
| 알림 배지 | 완료 | 읽지 않은 알림 개수 표시 |

---

### 2.7 마이페이지 (ProfileScreen)

#### 기본 정보
| 기능 | 상태 | 설명 |
|------|------|------|
| 사용자 정보 표시 | 완료 | 이름, 전화번호 표시 |
| 월별 소비/절감 통계 | 완료 | 이번 달 소비 금액, 혜택 금액 표시 |
| 알림/설정 아이콘 | 완료 | 상단 알림, 설정 페이지 이동 버튼 |

#### 잔액 관리
| 기능 | 상태 | 설명 |
|------|------|------|
| 잔액 표시 | 완료 | 현재 OnePay 잔액 표시 |
| 잔액 충전 | 완료 | 가상 금액 충전 (빠른 금액 버튼 제공) |
| 잔액 부족 경고 | 완료 | 결제 시 잔액 부족하면 오류 표시 |

#### 카드 관리 (Mydeck Report)
| 기능 | 상태 | 설명 |
|------|------|------|
| 카드 캐러셀 | 완료 | 등록된 카드 가로 스크롤 (페이지네이션) |
| 카드 등록 (OCR) | 완료 | 카드 사진 촬영 후 OCR로 카드명 인식 |
| 카드 등록 (검색) | 완료 | 카드명 검색으로 직접 등록 |
| 카드 수정 | 완료 | 등록된 카드 정보 수정 |
| 카드 삭제 | 완료 | 등록된 카드 삭제 |
| 카드 혜택 상세보기 | 완료 | 일부 카드(약 10개)는 상세 혜택 내역 표시 |
| 카드 실적/한도 표시 | 완료 | 월 사용액, 한도, 실적 달성률 표시 |

---

### 2.8 법인카드 관리 (기업용)

#### 관리자 기능 (AdminDashboardScreen)
| 기능 | 상태 | 설명 |
|------|------|------|
| 관리자 인증 | 완료 | 법인카드 소유자만 접근 가능 |
| 대시보드 통계 | 완료 | 총 사용액, 혜택액, 활성 카드 수, 부서 수, 혜택률 표시 |
| 부서별 사용 현황 | 완료 | 부서별 사용량 바 그래프 + 색상 구분 |
| 법인카드 목록 | 완료 | 등록된 법인카드 리스트 |

#### 부서 관리 (AdminDepartmentScreen)
| 기능 | 상태 | 설명 |
|------|------|------|
| 부서 목록 조회 | 완료 | 부서별 한도, 사용량, 인원 수 표시 |
| 부서 한도 설정 | 완료 | 부서별 월 한도 수정 |
| 부서 색상 구분 | 완료 | 부서별 고유 색상 |

#### 직원 관리 (AdminMembersScreen)
| 기능 | 상태 | 설명 |
|------|------|------|
| 직원 목록 조회 | 완료 | 법인카드 사용 직원 목록 |
| 직원 추가 | 완료 | 이메일로 사용자 검색 후 직원 등록 |
| 직원 제거 | 완료 | 등록된 직원 제거 |
| 직원 한도 설정 | 완료 | 개인별 월 한도 설정 |
| 부서 배정 | 완료 | 직원을 부서에 배정 |
| 사용량 추적 | 완료 | 직원별 사용 금액 추적 |

#### 직원용 기능 (EmployeeDashboardScreen)
| 기능 | 상태 | 설명 |
|------|------|------|
| 직원 대시보드 | 완료 | 직원 등록 시 마이페이지에 직원용 버튼 생성 |
| 개인 할당량 조회 | 완료 | 본인 한도 및 사용량 표시 |
| 부서 현황 조회 | 완료 | 소속 부서 사용 현황 (제한된 정보) |
| 잔여 한도 표시 | 완료 | 남은 사용 가능 금액 표시 |

#### 한도 관리
| 기능 | 상태 | 설명 |
|------|------|------|
| 한도 초과 오류 | 완료 | 법인카드 한도 초과 시 결제 차단 + 오류 메시지 |
| 한도 경고 알림 | 완료 | 한도 75%, 90% 도달 시 WebSocket 알림 |

---

### 2.9 영수증 스캔 (ReceiptScanScreen)

| 기능 | 상태 | 설명 |
|------|------|------|
| 영수증 스캔 버튼 표시 | 완료 | 법인카드 사용자로 등록된 경우에만 마이페이지에 표시 |
| 영수증 촬영 | 완료 | 카메라로 영수증 촬영 |
| OCR 처리 | 완료 | Naver Cloud OCR로 영수증 정보 추출 |
| 정보 추출 | 완료 | 가맹점명, 금액, 날짜, 카드번호, 승인번호 추출 |
| 영수증 저장 | 완료 | 추출된 정보 확인 후 저장 |
| 사용액 자동 업데이트 | 완료 | 개인/부서/카드 사용액 자동 반영 |

---

### 2.10 설정 (SettingsScreen)

| 기능 | 상태 | 설명 |
|------|------|------|
| 프로필 표시 | 완료 | 이름, 전화번호 표시 |
| 알림 설정 | 완료 | 푸시 알림 on/off 토글 |
| 테마 설정 | 완료 | 다크/라이트 모드 설정 |
| 개인정보 설정 | 완료 | 개인정보 관련 설정 |
| 비밀번호 변경 | 완료 | 비밀번호 변경 기능 |
| 계정 삭제 | 완료 | 회원 탈퇴 기능 |
| 로그아웃 | 완료 | 로그아웃 기능 |

---

### 2.11 카드 혜택 조회 (CardBenefitScreen)

| 기능 | 상태 | 설명 |
|------|------|------|
| 카드별 혜택 그룹핑 | 완료 | 카드명 기준 혜택 그룹화 |
| 혜택 상세 정보 | 완료 | 카테고리, 가맹점, 할인율, 한도 표시 |
| 혜택 없는 카드 처리 | 완료 | 상세 혜택 데이터 없는 카드는 기본 정보만 표시 |

---

### 2.12 가맹점 결제 시스템 (Admin-Frontend)

#### 결제 처리
| 기능 | 상태 | 설명 |
|------|------|------|
| QR 스캔 | 완료 | Html5Qrcode 라이브러리로 QR 인식 |
| 바코드 스캔 | 완료 | 12자리 바코드 인식 지원 |
| 자동 인식 구분 | 완료 | QR/바코드 자동 구분 |
| 혜택 계산 | 완료 | 카드/가맹점 기반 혜택 자동 계산 |
| 결제 확정 | 완료 | 결제 금액 입력 후 확정 처리 |
| 결제 완료 알림 | 완료 | 사용자 앱으로 결제 완료 알림 전송 |

#### 가맹점 관리
| 기능 | 상태 | 설명 |
|------|------|------|
| 가맹점 검색 | 완료 | Google Places API로 가맹점 검색 |
| 가맹점 등록 | 완료 | 검색된 가맹점 선택하여 등록 |
| 가맹점 목록 조회 | 완료 | 등록된 가맹점 리스트 |

#### 결제 내역
| 기능 | 상태 | 설명 |
|------|------|------|
| 결제 내역 조회 | 완료 | 가맹점별 > 사용자별 계층 구조 |
| 결제 상세 정보 | 완료 | 카드, 금액, 할인, 날짜 표시 |
| 통계 카드 | 완료 | 총 거래 수, 총 금액 표시 |

---

## 3. API 엔드포인트 요약

### 3.1 User Backend (Flask) - 주요 API

| 카테고리 | 메서드 | 경로 | 설명 |
|----------|--------|------|------|
| **인증** | POST | /api/login | 로그인 |
| | POST | /api/register | 회원가입 |
| | GET | /api/user/me | 현재 사용자 정보 |
| **마이페이지** | GET | /api/mypage | 사용자 정보, 카드, 잔액 조회 |
| **잔액** | GET | /api/balance | 잔액 조회 |
| | POST | /api/balance/charge | 잔액 충전 |
| | POST | /api/balance/check | 잔액 확인 |
| | POST | /api/balance/deduct | 잔액 차감 |
| **카드** | POST | /api/ocr/card | 카드 OCR |
| | GET | /api/card/list | 카드 목록 검색 |
| | POST | /api/card/add | 카드 등록 |
| | POST | /api/card/edit | 카드 수정 |
| | POST | /api/card/del | 카드 삭제 |
| | GET | /api/card/benefit | 카드 혜택 조회 |
| **장소** | GET | /api/nearby-recommendations | 주변 가맹점 추천 |
| | POST | /api/merchant-recommendations | 특정 가맹점 카드 추천 |
| | GET | /api/search-place | 장소 검색 |
| | GET | /api/search-autocomplete | 검색 자동완성 |
| | GET | /api/place/details | 장소 상세 정보 |
| **AI 코스** | POST | /api/ai/course-recommend | AI 코스 추천 |
| **코스 관리** | POST | /api/course/save | 코스 저장 |
| | GET | /api/course/saved | 저장된 코스 목록 |
| | GET | /api/course/<id> | 코스 상세 |
| | POST | /api/course/share | 코스 공유 |
| | GET | /api/course/shared | 공유받은 코스 |
| **경로** | POST | /api/directions | 경로 정보 |
| | POST | /api/course-directions | 코스 경로 정보 |
| | POST | /api/course-directions-mixed | 혼합 교통수단 경로 |
| **결제** | POST | /api/qr/generate | QR/바코드 생성 |
| | GET | /api/qr/scan-status | 스캔 상태 확인 |
| | POST | /api/payment/process | 결제 처리 |
| | POST | /api/payment/webhook | 결제 웹훅 수신 |
| **친구** | GET | /api/friends | 친구 목록 |
| | GET | /api/friends/search | 친구 검색 |
| | POST | /api/friends/request | 친구 요청 |
| | POST | /api/friends/accept | 친구 수락 |
| | POST | /api/friends/reject | 친구 거절 |
| | DELETE | /api/friends/<id> | 친구 삭제 |
| **채팅** | GET | /api/chat/conversations | 대화방 목록 |
| | GET | /api/chat/messages/<id> | 메시지 조회 |
| | POST | /api/chat/send | 메시지 전송 |
| | POST | /api/chat/start | 대화 시작 |
| **알림** | GET | /api/notifications | 알림 목록 |
| | POST | /api/notifications/read | 알림 읽음 처리 |
| | GET | /api/notifications/unread-count | 읽지 않은 알림 수 |
| **법인카드** | GET | /api/corporate/cards | 법인카드 목록 |
| | POST | /api/corporate/cards | 법인카드 등록 |
| | GET | /api/corporate/is-admin | 관리자 여부 확인 |
| | GET | /api/corporate/is-employee | 직원 여부 확인 |
| | GET | /api/corporate/dashboard/<id> | 관리자 대시보드 |
| | GET | /api/corporate/employee/dashboard | 직원 대시보드 |
| | GET | /api/corporate/cards/<id>/members | 직원 목록 |
| | POST | /api/corporate/cards/<id>/members | 직원 추가 |
| | DELETE | /api/corporate/cards/<id>/members/<mid> | 직원 제거 |
| | GET | /api/corporate/cards/<id>/departments | 부서 목록 |
| **영수증** | POST | /api/ocr/receipt | 영수증 OCR |
| | POST | /api/corporate/receipt/save | 영수증 저장 |

### 3.2 Admin Backend (FastAPI) - 주요 API

| 카테고리 | 메서드 | 경로 | 설명 |
|----------|--------|------|------|
| **가맹점** | GET | /api/merchants/search | 가맹점 검색 |
| | POST | /api/merchants/select | 가맹점 선택/등록 |
| | GET | /api/merchants | 등록된 가맹점 목록 |
| **결제** | POST | /api/qr/scan | QR 스캔 + 혜택 계산 |
| | POST | /api/qr/scan-barcode | 바코드 스캔 + 혜택 계산 |
| | POST | /api/payment/process | 결제 확정 |
| | GET | /api/payment/history | 결제 내역 |

---

## 4. 데이터베이스 모델

### 4.1 User Backend (17개 테이블)

| 모델 | 주요 필드 | 설명 |
|------|-----------|------|
| **User** | user_id, user_name, user_email, user_pw, balance | 사용자 기본 정보 |
| **MyCard** | cid, user_id, mycard_name, monthly_limit, used_amount | 사용자 보유 카드 |
| **Card** | card_id, card_name, card_benefit, card_pre_month_money | 카드 마스터 데이터 |
| **CardBenefit** | card_name, category, places, discount_type, discount_value | 카드별 혜택 상세 |
| **SavedCourse** | id, user_id, title, stops, route_info, total_distance | 저장된 코스 |
| **SavedCourseUser** | course_id, user_id, saved_at | 코스-사용자 관계 |
| **SharedCourse** | course_id, shared_by, shared_to, shared_at | 공유된 코스 |
| **PaymentHistory** | transaction_id, user_id, card_id, merchant_name, amount | 결제 내역 |
| **QRScanStatus** | transaction_id, user_id, status, merchant_name | QR 스캔 상태 |
| **Friendship** | user_id, friend_id, status | 친구 관계 |
| **Conversation** | user1_id, user2_id | 채팅 대화방 |
| **Message** | conversation_id, sender_id, content, is_read | 채팅 메시지 |
| **Notification** | user_id, type, title, message, is_read | 알림 |
| **CorporateCard** | id, card_name, owner_user_id, monthly_limit | 법인카드 |
| **CorporateCardMember** | corporate_card_id, user_id, role, monthly_limit | 법인카드 멤버 |
| **Department** | corporate_card_id, name, monthly_limit | 부서 |
| **CorporatePaymentHistory** | corporate_card_id, member_id, amount | 법인카드 결제 내역 |

### 4.2 Admin Backend (3개 테이블)

| 모델 | 주요 필드 | 설명 |
|------|-----------|------|
| **Merchant** | id, place_id, name, category, address, lat, lng | 등록된 가맹점 |
| **CardBenefit** | card_name, category, places, discount_type, discount_value | 혜택 데이터 (동기화) |
| **PaymentTransaction** | transaction_id, merchant_id, user_id, amount, status | 결제 트랜잭션 |

---

## 5. 외부 API 연동

| API | 용도 | 사용처 |
|-----|------|--------|
| **Google Places API (New)** | 장소 검색, 상세 정보, 사진 | 홈 화면, 코스 추천 |
| **Google Gemini API** | AI 코스 추천, 의도 분석 | 코스 추천 |
| **Google Directions API** | 경로 안내 (driving/walking/transit) | 코스 경로 |
| **TMAP API** | 경로 안내 (혼합 교통수단) | 코스 경로, 대중교통 |
| **Naver Maps API** | 지도 표시, Geocoding | 홈 화면 지도 |
| **Naver Cloud OCR** | 카드/영수증 이미지 인식 | 카드 등록, 영수증 스캔 |

---

## 6. WebSocket 이벤트

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| **join_notifications** | Client -> Server | 알림 룸 참가 |
| **new_notification** | Server -> Client | 새 알림 브로드캐스트 |
| **join_dashboard** | Client -> Server | 법인카드 대시보드 룸 참가 |
| **payment_update** | Server -> Client | 새 결제 업데이트 |
| **limit_alert** | Server -> Client | 한도 경고 알림 |
| **join_conversation** | Client -> Server | 채팅방 참가 |
| **typing** | Client -> Server | 타이핑 상태 |
| **friend_request_accepted** | Server -> Client | 친구 요청 수락 알림 |

---

## 7. 테스트 시나리오

### 7.1 결제 테스트 (OnePay)

1. 테스트 페이 서비스 접속: https://cardealo.vercel.app/
2. 테스트 페이서비스에서 가맹점 선택 & 금액 입력
3. 앱에서 OnePay QR 또는 바코드 생성
4. 테스트 페이서비스에서 스캔
5. 결제 완료 확인 -> 마이페이지 소비 금액 & 혜택 금액 반영 확인

### 7.2 친구/채팅 테스트

1. 친구 추가 (이메일 검색: "hong", "kim" 등)
2. 상대방 계정으로 로그인 -> 마이페이지 > 알림 > 친구 요청 수락
3. 채팅 시작
4. 정산 요청 -> 상대방 계정에서 송금 -> 정산 완료 확인
5. 코스 공유 -> 코스 보기 클릭 -> 길 안내 확인

### 7.3 법인카드 테스트

1. 홍길동 계정 로그인 (법인카드 등록된 계정)
2. 마이페이지 > 관리자 버튼 접근
3. 직원 추가 (이메일로 사용자 검색)
4. 추가된 직원 계정 > 마이페이지에 직원용 버튼 확인
5. 한도 설정 후 한도 초과 결제 시도 -> 오류 확인
6. 영수증 스캔 -> 자동 사용액 업데이트 확인

---

## 8. 환경 변수 목록

### Backend (.env)
```
NCP_CLIENT_ID=
NCP_CLIENT_SECRET=
GOOGLE_MAPS_API_KEY=
GEMINI_API_KEY=
TMAP_API_KEY=
NAVER_OCR_SECRET_KEY=
NAVER_OCR_INVOKE_URL=
JWT_SECRET=
ADMIN_SECRET_KEY=
```

### Frontend (.env)
```
EXPO_PUBLIC_NAVER_MAP_CLIENT_ID=
EXPO_PUBLIC_NAVER_MAP_CLIENT_SECRET=
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_ENABLE_LOCATION_DEBUG=
EXPO_PUBLIC_ENABLE_TEST_LOGIN=
```

### Admin-Backend (.env)
```
DATABASE_URL=
JWT_SECRET=
ADMIN_SECRET_KEY=
USER_BACKEND_URL=
GOOGLE_MAPS_API_KEY=
```

---

## 9. 주의사항

1. **TMAP 경로 API**: 후불제이므로 과도한 호출 주의
2. **Google Places API**: 사진 조회 시 비용 발생, 캐싱 구현됨
3. **법인카드 테스트**: 홍길동 계정만 법인카드 등록됨, 다른 계정은 접근 불가
4. **카드 혜택 상세**: 약 10개 카드만 상세 혜택 데이터 있음 (예: 신한카드 Deep Oil)

---

## 10. 프로젝트 구조

```
cardealo/
├── frontend/                    # React Native 모바일 앱
│   ├── src/
│   │   ├── screens/            # 20개 화면
│   │   ├── components/         # 공통 컴포넌트 + SVG 아이콘
│   │   ├── contexts/           # AuthContext, NotificationContext
│   │   └── utils/              # API, 유틸리티
│   ├── app.config.js           # Expo 설정
│   └── package.json
│
├── backend/                     # Flask 사용자 백엔드
│   ├── app.py                  # 메인 앱 (모든 라우트)
│   ├── services/               # 비즈니스 로직
│   │   ├── database.py         # SQLAlchemy 모델
│   │   ├── location_service.py # Google Places 연동
│   │   ├── directions_service.py # 경로 안내
│   │   ├── tmap_service.py     # TMAP 연동
│   │   ├── ocr_service.py      # Naver OCR
│   │   └── route_cache.py      # 경로 캐싱
│   ├── ai/                     # AI 서비스
│   │   ├── gemini_course_recommender.py # Gemini 코스 추천
│   │   ├── benefit_calculator.py # 혜택 계산
│   │   └── route_optimizer.py  # 경로 최적화
│   └── requirements.txt
│
├── admin-backend/              # FastAPI 가맹점 백엔드
│   ├── app/
│   │   ├── main.py             # FastAPI 앱
│   │   ├── routers/            # API 라우터
│   │   ├── services/           # 혜택 계산, QR 검증, 웹훅
│   │   ├── models/             # SQLAlchemy 모델
│   │   └── schemas/            # Pydantic 스키마
│   └── requirements.txt
│
├── admin-frontend/             # Next.js 가맹점 웹
│   ├── app/                    # 페이지
│   │   ├── page.tsx            # 메인 결제 페이지
│   │   ├── scan/               # QR/바코드 스캔
│   │   ├── payment/            # 결제 처리
│   │   ├── history/            # 결제 내역
│   │   └── merchant/           # 가맹점 설정
│   └── package.json
│
└── docs/                       # 문서
    ├── CLASS_DIAGRAM.md
    ├── IMPLEMENTATION_STATUS.md
    └── system-architecture.md
```

---

**문서 버전**: 2.0.0
**최종 업데이트**: 2025-12-08
