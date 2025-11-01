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
