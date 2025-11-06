# CARDEALO Backend

Flask backend for CARDEALO card benefit platform.

## Features

- Naver Geocoding API integration
- Store location to coordinate conversion
- REST API endpoints

## Setup

### 1. Create virtual environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Mac/Linux
# or
venv\Scripts\activate  # On Windows
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your Naver API credentials:

```
NAVER_CLIENT_ID=your_client_id
NAVER_CLIENT_SECRET=your_client_secret
```

### 4. Run the server

```bash
python app.py
```

Server runs on `http://localhost:5000`

## API Endpoints

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "cardealo-backend"
}
```

### Geocode Single Address

```
GET /api/geocode?address=서울특별시 성북구 안암로 145
```

Response:
```json
{
  "latitude": 37.585285,
  "longitude": 127.029601,
  "address": "서울특별시 성북구 안암로 145"
}
```

### Geocode Multiple Addresses

```
POST /api/geocode/batch
Content-Type: application/json

{
  "addresses": [
    "서울특별시 성북구 안암로 145",
    "서울특별시 성북구 안암동5가 126-1"
  ]
}
```

Response:
```json
{
  "results": [
    {
      "address": "서울특별시 성북구 안암로 145",
      "latitude": 37.585285,
      "longitude": 127.029601
    },
    {
      "address": "서울특별시 성북구 안암동5가 126-1",
      "latitude": 37.584120,
      "longitude": 127.028475
    }
  ]
}
```

### Get Stores with Coordinates

```
GET /api/stores
```

Response:
```json
{
  "stores": [
    {
      "id": "1",
      "name": "홈플러스",
      "branch": "안암점",
      "address": "서울특별시 성북구 안암로 145",
      "latitude": 37.585285,
      "longitude": 127.029601,
      "category": "mart",
      "cardName": "THE1",
      "benefit": "1만원 이상 결제 시 5,680원 할인"
    }
  ]
}
```

### Register

```
POST /api/register
Content-Type: application/json

{
    "user_id":"test",
    "user_pw":"test",
    "user_age":23,
    "isBusiness":false,
    "card_name":"신한카드 The CLASSIC-Y"
}
```

Response:

```json
{
    "msg": "registered",
    "success": true
}

If the card_name value is not in the database
{
    "msg": "Card not found",
    "success": false
}
```

### Login

```
POST /api/login
Content-Type: application/json

{
    "user_id":"test",
    "user_pw":"test",
}
```

Response:

```json
{
  "msg": "logged in",
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9.ovXxDNossgChX4TpIcRy1SvCuIntuAJ54l0fMAUk0TQ"
}
```

### Mypage

```
GET /api/mypage
Authorization: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9.ovXxDNossgChX4TpIcRy1SvCuIntuAJ54l0fMAUk0TQ
```

Response:

```json
{
    "msg": "mypage",
    "success": true,
    "user": {
        "cards": [
            {
                "card_benefit": "Gift Option 서비스는 매년 1회 아래 품목 중 한 가지를 선택하여 이용하실 수 있습니다.- 포인트 : 마이신한포인트 적립(7만점) / 1년1회- 문화 : 문화상품권(8만원) / 1년1회- 요식 : 패밀리 레스토랑 11만원 이용권 / 1년1회- 호텔 : 호텔 애프터눈 티 SET 이용권 / ... (생략)",
                "card_name": "신한카드 The CLASSIC-Y",
                "card_pre_month_money": 0
            },
        ],
        "isBusiness": false,
        "user_age": 1,
        "user_id": "test"
    }
}
```

### Get card list

1page = 25item

```
GET /api/mypage?keyword=&page=
```

Response:

```json
{
  "cards": [
    {
      "card_benefit": "[기본 혜택] 전월 이용 금액... (생략)",
      "card_name": "네이버 현대카드 Edition2",
      "card_pre_month_money": 500000
    }
  ],
  "msg": "card list",
  "success": true
}
```

### Add card

```
POST /api/card/add
Authorization: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9.ovXxDNossgChX4TpIcRy1SvCuIntuAJ54l0fMAUk0TQ
Content-Type: application/json

{
    "card_name":"네이버 현대카드 Edition2"
}
```

Response:

```json
{
    "msg": "card added",
    "success": true
}

If the card_name value is not in the database
{
    "msg": "Card not found",
    "success": false
}
```

### Edit card

```
POST /api/card/edit
Authorization: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9.ovXxDNossgChX4TpIcRy1SvCuIntuAJ54l0fMAUk0TQ
Content-Type: application/json

{
    "old_card_name":"네이버 현대카드 Edition2",
    "new_card_name":"신한카드 The CLASSIC-Y"
}
```

Response:

```json
{
    "msg": "card edited",
    "success": true
}
```

### Delete card

```
POST /api/card/del
Authorization: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdCJ9.ovXxDNossgChX4TpIcRy1SvCuIntuAJ54l0fMAUk0TQ
Content-Type: application/json

{
    "card_name":"네이버 현대카드 Edition2"
}
```

Response:

```json
{
    "msg": "card deleted",
    "success": true
}
```



## Development

### Project Structure

```
backend/
├── .env
├── .env.example
├── .gitignore
├── README.md
├── requirements.txt
├── app.py
└── services/
    ├── __init__.py
    └── geocoding_service.py
```

### Testing with curl

Health check:
```bash
curl http://localhost:5000/health
```

Geocode single address:
```bash
curl "http://localhost:5000/api/geocode?address=서울특별시%20성북구%20안암로%20145"
```

Get stores:
```bash
curl http://localhost:5000/api/stores
```

## Troubleshooting

### Port already in use

```bash
# Find process using port 5000
lsof -ti:5000

# Kill the process
lsof -ti:5000 | xargs kill -9
```

### Naver API errors

Check that:
1. NAVER_CLIENT_ID and NAVER_CLIENT_SECRET are correct in `.env`
2. Geocoding API is enabled in Naver Cloud Platform
3. API usage limits are not exceeded
