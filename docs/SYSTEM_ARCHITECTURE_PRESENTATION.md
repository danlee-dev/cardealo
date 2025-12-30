# Cardealo 시스템 아키텍처 (발표용)

> 버전: 2.1.0 | 작성일: 2025-12-12

---

## 1. 전체 시스템 아키텍처

```mermaid
flowchart TB
    subgraph CLIENT["CLIENT LAYER"]
        subgraph MobileApp["Mobile App (React Native + Expo)"]
            MA_Screens["20 Screens"]
            MA_Map["Naver Maps SDK"]
            MA_Socket["Socket.io Client"]
            MA_Camera["expo-camera (OCR)"]
        end

        subgraph AdminWeb["Admin Web (Next.js 15)"]
            AW_Scanner["QR/Barcode Scanner"]
            AW_Payment["Payment Processing"]
            AW_History["Transaction History"]
        end
    end

    subgraph SERVER["SERVER LAYER"]
        subgraph UserBackend["User Backend (Flask)"]
            UB_Auth["Auth Module"]
            UB_Card["Card Module"]
            UB_Location["Location Module"]
            UB_AI["AI Course Module"]
            UB_Payment["Payment Module"]
            UB_Chat["Chat Module"]
            UB_Corporate["Corporate Module"]
            UB_WebSocket["WebSocket (Socket.io)"]
        end

        subgraph AdminBackend["Admin Backend (FastAPI)"]
            AB_Merchant["Merchant Module"]
            AB_QR["QR/Barcode Module"]
            AB_Payment["Payment Module"]
            AB_Benefit["Benefit Calculator"]
        end
    end

    subgraph DATABASE["DATABASE LAYER"]
        PostgreSQL[("PostgreSQL\n17 Tables\n(Railway)")]
        SQLite[("SQLite\n3 Tables\n(Admin)")]
    end

    subgraph EXTERNAL["EXTERNAL API LAYER"]
        Google_Places["Google Places API"]
        Google_Gemini["Google Gemini AI"]
        Google_Directions["Google Directions API"]
        TMAP["TMAP API"]
        Naver_Maps["Naver Maps API"]
        Naver_OCR["Naver Cloud OCR"]
    end

    MobileApp <-->|REST API + WebSocket| UserBackend
    AdminWeb <-->|REST API| AdminBackend
    UserBackend <-->|HTTP Webhook| AdminBackend

    UserBackend --> PostgreSQL
    AdminBackend --> SQLite
    AdminBackend -.->|Read| PostgreSQL

    UserBackend --> Google_Places
    UserBackend --> Google_Gemini
    UserBackend --> Google_Directions
    UserBackend --> TMAP
    UserBackend --> Naver_OCR
    MobileApp --> Naver_Maps
    AdminBackend --> Google_Places
```

---

## 2. 상세 시스템 구성도

```mermaid
flowchart LR
    subgraph Mobile["Mobile App"]
        direction TB
        Home["HomeScreen\n(Map + Search)"]
        Profile["ProfileScreen\n(MyPage)"]
        Chat["ChatScreen\n(Messaging)"]
        Friends["FriendsScreen"]
        Notification["NotificationScreen"]
        Settings["SettingsScreen"]
        CardBenefit["CardBenefitScreen"]
        AdminDash["AdminDashboardScreen"]
        EmployeeDash["EmployeeDashboardScreen"]
        Receipt["ReceiptScanScreen"]
    end

    subgraph Features["Core Features"]
        direction TB
        F1["Location-based\nStore Search"]
        F2["AI Course\nRecommendation"]
        F3["OnePay\nPayment"]
        F4["Real-time\nChat"]
        F5["Corporate Card\nManagement"]
        F6["Receipt\nOCR"]
    end

    subgraph Backend["Backend Services"]
        direction TB
        S1["LocationService"]
        S2["GeminiCourseRecommender"]
        S3["PaymentService"]
        S4["ChatService\n(WebSocket)"]
        S5["CorporateService"]
        S6["OCRService"]
    end

    Home --> F1 --> S1
    Home --> F2 --> S2
    Home --> F3 --> S3
    Chat --> F4 --> S4
    AdminDash --> F5 --> S5
    Receipt --> F6 --> S6
```

---

## 3. OnePay 결제 흐름

```mermaid
sequenceDiagram
    autonumber
    participant App as Mobile App
    participant UB as User Backend
    participant AB as Admin Backend
    participant Web as Admin Web
    participant DB as PostgreSQL

    App->>UB: ONEPAY Button Click
    Note over App: Card Roulette Animation

    App->>UB: POST /api/qr/generate
    UB->>DB: Create QRScanStatus
    UB-->>App: QR Code + 5min Timer

    Web->>AB: Scan QR Code
    AB->>UB: GET /api/qr/verify
    UB-->>AB: user_id, card_info

    AB->>AB: Calculate Benefits
    AB-->>Web: Show discount info

    Web->>AB: POST /api/payment/process
    AB->>UB: POST /api/balance/check

    alt Balance Sufficient
        UB-->>AB: OK
        AB->>UB: POST /api/balance/deduct
        UB->>DB: Update balance, Create PaymentHistory
        UB-->>AB: Success
        AB-->>Web: Payment Complete
        UB-->>App: WebSocket: payment_update
        Note over App: Payment Success Screen
    else Balance Insufficient
        UB-->>AB: insufficient_balance
        AB->>UB: POST /api/payment/notify-failure
        UB-->>App: WebSocket: payment_failed
        Note over App: Show Error Modal
    end
```

---

## 4. AI 코스 추천 흐름

```mermaid
sequenceDiagram
    autonumber
    participant App as Mobile App
    participant UB as User Backend
    participant Gemini as Google Gemini
    participant Places as Google Places
    participant TMAP as TMAP API

    App->>UB: POST /api/ai/course-recommend
    Note over App: "Weekend cafe hopping"

    UB->>Gemini: Analyze Intent
    Gemini-->>UB: {mood, budget, categories}

    UB->>Places: Search Nearby Places
    Places-->>UB: Place candidates

    UB->>UB: Filter by User Cards
    UB->>UB: Calculate Benefits
    UB->>UB: Optimize Route

    UB->>Gemini: Generate Course
    Gemini-->>UB: {stops, order, tips}

    UB-->>App: Course Result
    Note over App: Card Slide-in Animation

    App->>UB: POST /api/course-directions
    UB->>TMAP: Get Route (per segment)
    TMAP-->>UB: Polyline + Time + Distance
    UB-->>App: Route Info

    Note over App: Show Route on Map
```

---

## 5. 실시간 채팅 및 정산 흐름

```mermaid
sequenceDiagram
    autonumber
    participant A as User A
    participant WS as WebSocket Server
    participant B as User B
    participant DB as PostgreSQL

    A->>WS: join_conversation(room_id)
    B->>WS: join_conversation(room_id)

    A->>WS: send_message("Hello!")
    WS->>DB: Save Message
    WS->>B: new_message

    A->>WS: typing_start
    WS->>B: user_typing

    Note over A,B: Settlement Request

    A->>WS: send_message(type: settlement, amount: 25000)
    WS->>DB: Save Settlement Request
    WS->>B: settlement_request

    B->>WS: accept_settlement
    WS->>DB: Transfer Balance (A <- B)
    WS->>A: settlement_complete
    WS->>B: settlement_complete
```

---

## 6. 법인카드 결제 및 한도 관리 흐름

```mermaid
sequenceDiagram
    autonumber
    participant Emp as Employee App
    participant UB as User Backend
    participant AB as Admin Backend
    participant Admin as Admin Dashboard
    participant DB as PostgreSQL

    Emp->>UB: Generate Corp QR (corp_{card_id})
    UB-->>Emp: QR Code

    Note over AB: Merchant scans QR

    AB->>UB: Check Limits

    UB->>DB: Check Personal Limit
    UB->>DB: Check Department Limit
    UB->>DB: Check Card Total Limit

    alt All Limits OK
        UB-->>AB: {allowed: true}
        AB->>UB: Process Payment
        UB->>DB: Update all used_amounts
        UB-->>Emp: WebSocket: payment_update
        UB-->>Admin: WebSocket: payment_update
    else Limit Exceeded
        UB-->>AB: {allowed: false, reason: "limit_exceeded"}
        AB->>UB: Notify Failure
        UB-->>Emp: WebSocket: payment_failed
    end

    Note over UB: Check Alert Threshold

    alt Used > 75% or 90%
        UB-->>Emp: WebSocket: limit_alert
        UB-->>Admin: WebSocket: limit_alert
    end
```

---

## 7. Mobile App 화면 구조

```mermaid
flowchart TB
    subgraph Navigation["Bottom Tab Navigation"]
        Home["Home"]
        Chat["Chat"]
        Friends["Friends"]
        Profile["Profile"]
    end

    subgraph HomeStack["Home Stack"]
        HomeScreen["HomeScreen"]
        StoreDetail["Store Detail\n(BottomSheet)"]
        CourseMode["Course Mode"]
        CourseDetail["CourseDetailScreen"]
    end

    subgraph ChatStack["Chat Stack"]
        ChatList["ChatListScreen"]
        ChatRoom["ChatRoomScreen"]
    end

    subgraph FriendsStack["Friends Stack"]
        FriendsList["FriendsScreen"]
        AddFriend["Add Friend Modal"]
    end

    subgraph ProfileStack["Profile Stack"]
        ProfileScreen["ProfileScreen"]
        CardBenefit["CardBenefitScreen"]
        Settings["SettingsScreen"]
        Notification["NotificationScreen"]
        AdminDashboard["AdminDashboardScreen"]
        AdminMembers["AdminMembersScreen"]
        AdminDepartment["AdminDepartmentScreen"]
        EmployeeDashboard["EmployeeDashboardScreen"]
        ReceiptScan["ReceiptScanScreen"]
    end

    Home --> HomeStack
    Chat --> ChatStack
    Friends --> FriendsStack
    Profile --> ProfileStack

    HomeScreen --> StoreDetail
    HomeScreen --> CourseMode
    CourseMode --> CourseDetail

    ChatList --> ChatRoom

    ProfileScreen --> CardBenefit
    ProfileScreen --> Settings
    ProfileScreen --> Notification
    ProfileScreen --> AdminDashboard
    ProfileScreen --> EmployeeDashboard
    ProfileScreen --> ReceiptScan

    AdminDashboard --> AdminMembers
    AdminDashboard --> AdminDepartment
```

---

## 8. HomeScreen 기능 구조

```mermaid
flowchart TB
    subgraph HomeScreen["HomeScreen"]
        subgraph Search["Search Area"]
            SearchBar["Search Bar\n(TextInput)"]
            Autocomplete["Autocomplete\nDropdown"]
            SearchHistory["Recent\nSearch"]
        end

        subgraph Filter["Category Filter"]
            Favorites["Favorites"]
            Cafe["Cafe"]
            Restaurant["Restaurant"]
            Mart["Mart"]
            Convenience["Convenience"]
            Gas["Gas Station"]
        end

        subgraph Map["Naver Map"]
            UserMarker["User Location\n(Blue Pin)"]
            StoreMarkers["Store Markers\n(Benefit Color)"]
            SearchMarker["Search Result\n(Red Pin)"]
            CourseRoute["Course Route\n(Polyline)"]
        end

        subgraph BottomSheet["BottomSheet"]
            StoreList["Store List"]
            SortOptions["Sort:\nBenefit/Distance/AI"]
            StoreDetail["Store Detail"]
            CardCarousel["Card Carousel"]
            ActionButtons["View/OnePay/Navigate"]
        end

        subgraph CourseMode["Course Mode"]
            CourseInput["Natural Language\nInput"]
            CourseCards["AI Result\nCards"]
            RouteOptions["Transport\nOptions"]
            CourseActions["Save/Share/Start"]
        end
    end

    SearchBar --> Autocomplete
    SearchBar --> SearchHistory
    Filter --> Map
    Map --> BottomSheet
    StoreList --> StoreDetail
    StoreDetail --> CardCarousel
    StoreDetail --> ActionButtons
```

---

## 9. 데이터베이스 ER 다이어그램

```mermaid
erDiagram
    User ||--o{ MyCard : has
    User ||--o{ Friendship : has
    User ||--o{ Notification : receives
    User ||--o{ PaymentHistory : makes
    User ||--o{ SavedCourse : creates
    User ||--o{ CorporateCardMember : "is member of"

    User {
        int user_id PK
        string user_name
        string user_email UK
        string user_pw
        int balance
        datetime created_at
    }

    MyCard {
        int cid PK
        int user_id FK
        string mycard_name
        int monthly_limit
        int used_amount
    }

    Card {
        int card_id PK
        string card_name
        string card_benefit
        int card_pre_month_money
        string card_img_url
    }

    CardBenefit {
        int id PK
        string card_name
        string category
        string places
        string discount_type
        float discount_value
        int monthly_limit
    }

    Friendship {
        int id PK
        int user_id FK
        int friend_id FK
        string status
        datetime created_at
    }

    Conversation ||--o{ Message : contains
    Conversation {
        int id PK
        int user1_id FK
        int user2_id FK
        datetime created_at
    }

    Message {
        int id PK
        int conversation_id FK
        int sender_id FK
        string content
        string msg_type
        boolean is_read
        datetime created_at
    }

    Notification {
        int id PK
        int user_id FK
        string type
        string title
        string message
        json data
        boolean is_read
        datetime created_at
    }

    SavedCourse ||--o{ SavedCourseUser : "shared with"
    SavedCourse ||--o{ SharedCourse : "shared as"
    SavedCourse {
        int id PK
        int user_id FK
        string title
        json stops
        json route_info
        float total_distance
        int total_duration
        datetime created_at
    }

    SavedCourseUser {
        int course_id FK
        int user_id FK
        datetime saved_at
    }

    SharedCourse {
        int id PK
        int course_id FK
        int shared_by FK
        int shared_to FK
        datetime shared_at
    }

    PaymentHistory {
        string transaction_id PK
        int user_id FK
        int card_id FK
        string merchant_name
        string category
        int amount
        int discount_amount
        int final_amount
        datetime created_at
    }

    QRScanStatus {
        string transaction_id PK
        int user_id FK
        string status
        string merchant_name
        string category
        string card_name
        datetime created_at
        datetime expires_at
    }

    CorporateCard ||--o{ CorporateCardMember : has
    CorporateCard ||--o{ Department : has
    CorporateCard ||--o{ CorporatePaymentHistory : records
    CorporateCard {
        int id PK
        string card_name
        int owner_user_id FK
        int monthly_limit
        int used_amount
        datetime created_at
    }

    CorporateCardMember {
        int id PK
        int corporate_card_id FK
        int user_id FK
        int department_id FK
        string role
        int monthly_limit
        int used_amount
        string status
        datetime created_at
    }

    Department {
        int id PK
        int corporate_card_id FK
        string name
        int monthly_limit
        int used_amount
        string color
    }

    CorporatePaymentHistory {
        int id PK
        int corporate_card_id FK
        int member_id FK
        string merchant_name
        int amount
        int discount_amount
        string receipt_image_url
        datetime created_at
    }
```

---

## 10. Backend API 구조

```mermaid
flowchart LR
    subgraph UserBackend["User Backend (Flask)"]
        subgraph Auth["Auth"]
            login["/api/login"]
            register["/api/register"]
            me["/api/user/me"]
        end

        subgraph Balance["Balance"]
            balance_get["/api/balance"]
            balance_charge["/api/balance/charge"]
            balance_check["/api/balance/check"]
            balance_deduct["/api/balance/deduct"]
        end

        subgraph CardAPI["Card"]
            card_ocr["/api/ocr/card"]
            card_list["/api/card/list"]
            card_add["/api/card/add"]
            card_benefit["/api/card/benefit"]
        end

        subgraph Location["Location"]
            nearby["/api/nearby-recommendations"]
            search["/api/search-place"]
            autocomplete["/api/search-autocomplete"]
            details["/api/place/details"]
        end

        subgraph AI["AI Course"]
            course_recommend["/api/ai/course-recommend"]
            course_save["/api/course/save"]
            course_share["/api/course/share"]
        end

        subgraph Payment["Payment"]
            qr_generate["/api/qr/generate"]
            qr_status["/api/qr/scan-status"]
            payment_webhook["/api/payment/webhook"]
        end

        subgraph Social["Social"]
            friends["/api/friends"]
            chat["/api/chat"]
            notifications["/api/notifications"]
        end

        subgraph Corporate["Corporate"]
            corp_cards["/api/corporate/cards"]
            corp_members["/api/corporate/cards/:id/members"]
            corp_dashboard["/api/corporate/dashboard/:id"]
            receipt_ocr["/api/ocr/receipt"]
        end
    end

    subgraph AdminBackend["Admin Backend (FastAPI)"]
        merchant_search["/api/merchants/search"]
        merchant_select["/api/merchants/select"]
        qr_scan["/api/qr/scan"]
        payment_process["/api/payment/process"]
        payment_history["/api/payment/history"]
        corp_limit["/api/corporate/check-limit"]
    end
```

---

## 11. 기술 스택

```mermaid
flowchart TB
    subgraph Frontend["Frontend"]
        subgraph Mobile["Mobile App"]
            RN["React Native 0.76"]
            Expo["Expo SDK 54"]
            TS1["TypeScript"]
            NaverMap["Naver Maps SDK"]
            SocketClient["Socket.io Client"]
            BottomSheet["@gorhom/bottom-sheet"]
        end

        subgraph Web["Admin Web"]
            Next["Next.js 15"]
            Tailwind["Tailwind CSS"]
            TS2["TypeScript"]
            QRScanner["html5-qrcode"]
        end
    end

    subgraph Backend["Backend"]
        subgraph UserBE["User Backend"]
            Flask["Flask 3.0"]
            SQLAlchemy1["SQLAlchemy"]
            SocketIO["Flask-SocketIO"]
            JWT["PyJWT"]
        end

        subgraph AdminBE["Admin Backend"]
            FastAPI["FastAPI"]
            SQLAlchemy2["SQLAlchemy"]
            Pydantic["Pydantic v2"]
            HTTPX["httpx"]
        end
    end

    subgraph Database["Database"]
        PG["PostgreSQL 15"]
        SQ["SQLite"]
    end

    subgraph External["External APIs"]
        GP["Google Places API"]
        GG["Google Gemini AI"]
        GD["Google Directions"]
        TM["TMAP API"]
        NM["Naver Maps"]
        NO["Naver Cloud OCR"]
    end

    subgraph Deploy["Deployment"]
        Railway["Railway"]
        Vercel["Vercel"]
        EAS["EAS Build"]
    end

    Mobile --> UserBE
    Web --> AdminBE
    UserBE --> PG
    AdminBE --> SQ
    UserBE --> External
    AdminBE --> GP

    UserBE --> Railway
    AdminBE --> Railway
    Web --> Vercel
    Mobile --> EAS
```

---

## 12. 배포 아키텍처

```mermaid
flowchart TB
    subgraph Users["Users"]
        iOS["iOS App"]
        Android["Android App"]
        Browser["Web Browser"]
    end

    subgraph CDN["Content Delivery"]
        AppStore["App Store"]
        PlayStore["Google Play"]
        VercelCDN["Vercel Edge"]
    end

    subgraph Cloud["Cloud Services"]
        subgraph Railway["Railway"]
            FlaskServer["User Backend\n(Flask)\nPort 5001"]
            FastAPIServer["Admin Backend\n(FastAPI)\nPort 8000"]
            PostgreSQLDB[("PostgreSQL\n17 Tables")]
        end

        subgraph VercelCloud["Vercel"]
            NextApp["Admin Frontend\n(Next.js)"]
        end
    end

    subgraph ExternalAPIs["External APIs"]
        GoogleCloud["Google Cloud\n(Places, Gemini,\nDirections)"]
        NaverCloud["Naver Cloud\n(Maps, OCR)"]
        SKCloud["SK Open API\n(TMAP)"]
    end

    iOS --> AppStore
    Android --> PlayStore
    Browser --> VercelCDN

    AppStore --> FlaskServer
    PlayStore --> FlaskServer
    VercelCDN --> NextApp
    NextApp --> FastAPIServer

    FlaskServer <--> FastAPIServer
    FlaskServer --> PostgreSQLDB
    FastAPIServer --> PostgreSQLDB

    FlaskServer --> GoogleCloud
    FlaskServer --> NaverCloud
    FlaskServer --> SKCloud
    FastAPIServer --> GoogleCloud
```

---

## 13. WebSocket 이벤트 구조

```mermaid
flowchart LR
    subgraph Client["Client Events"]
        join_notifications["join_notifications"]
        join_conversation["join_conversation"]
        join_dashboard["join_dashboard"]
        send_message["send_message"]
        typing["typing"]
    end

    subgraph Server["Server Events"]
        new_notification["new_notification"]
        new_message["new_message"]
        user_typing["user_typing"]
        payment_update["payment_update"]
        limit_alert["limit_alert"]
        friend_request_accepted["friend_request_accepted"]
        settlement_request["settlement_request"]
        settlement_complete["settlement_complete"]
    end

    subgraph Types["Notification Types"]
        payment["payment\n(결제 완료)"]
        friend_request["friend_request\n(친구 요청)"]
        benefit_tip["benefit_tip\n(혜택 팁)"]
        course_share["course_share\n(코스 공유)"]
        limit_warning["limit_warning\n(한도 경고)"]
    end

    join_notifications --> new_notification
    join_conversation --> new_message
    join_conversation --> user_typing
    join_dashboard --> payment_update
    join_dashboard --> limit_alert
    send_message --> new_message
    typing --> user_typing

    new_notification --> Types
```

---

## 14. 혜택 계산 로직

```mermaid
flowchart TB
    Start["Store Selected"] --> GetCards["Get User's Cards"]
    GetCards --> Loop["For Each Card"]

    Loop --> CheckCategory{"Category\nMatch?"}
    CheckCategory -->|Yes| CheckPlace{"Place\nMatch?"}
    CheckCategory -->|No| NextCard["Next Card"]

    CheckPlace -->|Yes| CalcDiscount["Calculate Discount"]
    CheckPlace -->|No| CheckGeneral{"General\nBenefit?"}

    CheckGeneral -->|Yes| CalcGeneral["Apply General Rate"]
    CheckGeneral -->|No| NextCard

    CalcDiscount --> CheckLimit{"Within\nMonthly Limit?"}
    CalcGeneral --> CheckLimit

    CheckLimit -->|Yes| AddScore["Add to Score"]
    CheckLimit -->|No| ReduceScore["Reduce Score"]

    AddScore --> NextCard
    ReduceScore --> NextCard
    NextCard --> Loop

    Loop -->|Done| SortCards["Sort by Score"]
    SortCards --> SelectBest["Select Best Card"]
    SelectBest --> Display["Display with\nBenefit Color"]

    subgraph Colors["Marker Colors"]
        Green["Green: >10%"]
        Yellow["Yellow: 5-10%"]
        Gray["Gray: <5%"]
    end

    Display --> Colors
```

---

**문서 버전**: 2.1.0
**최종 업데이트**: 2025-12-12
