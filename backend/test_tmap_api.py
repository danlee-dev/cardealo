import requests
import json
import os
from dotenv import load_dotenv
from pathlib import Path

# Load env from backend/.env
backend_dir = Path(__file__).parent
env_path = backend_dir / '.env'
load_dotenv(dotenv_path=env_path)

TMAP_API_KEY = os.getenv('TMAP_API_KEY')

print(f"TMAP API Key: {TMAP_API_KEY[:10]}...")

# Test coordinates (Seoul)
start = {"lat": 37.5885061, "lng": 127.03376739999999}  # 고려대
end = {"lat": 37.5796128, "lng": 127.03868480000001}    # 경동시장

# 1. Test driving route (with turn-by-turn)
print("\n" + "="*60)
print("1. DRIVING ROUTE (자동차 경로)")
print("="*60)

response = requests.post(
    "https://apis.openapi.sk.com/tmap/routes",
    headers={
        'appKey': TMAP_API_KEY,
        'Content-Type': 'application/json'
    },
    json={
        'startX': str(start['lng']),
        'startY': str(start['lat']),
        'endX': str(end['lng']),
        'endY': str(end['lat']),
        'reqCoordType': 'WGS84GEO',
        'resCoordType': 'WGS84GEO',
    }
)

if response.status_code == 200:
    data = response.json()
    features = data.get('features', [])
    print(f"Total features: {len(features)}")
    
    # Print first few features to understand structure
    for i, feature in enumerate(features[:5]):
        props = feature.get('properties', {})
        geom = feature.get('geometry', {})
        print(f"\n[Feature {i}]")
        print(f"  Type: {geom.get('type')}")
        print(f"  Properties: {list(props.keys())}")
        if props.get('description'):
            print(f"  Description: {props.get('description')}")
        if props.get('turnType'):
            print(f"  Turn Type: {props.get('turnType')}")
        if props.get('totalDistance'):
            print(f"  Total Distance: {props.get('totalDistance')}m")
        if props.get('totalTime'):
            print(f"  Total Time: {props.get('totalTime')}s")
else:
    print(f"Error: {response.status_code}")
    print(response.text[:500])

# 2. Test transit route (대중교통)
print("\n" + "="*60)
print("2. TRANSIT ROUTE (대중교통 경로)")
print("="*60)

response = requests.post(
    "https://apis.openapi.sk.com/transit/routes",
    headers={
        'appKey': TMAP_API_KEY,
        'Content-Type': 'application/json'
    },
    json={
        'startX': str(start['lng']),
        'startY': str(start['lat']),
        'endX': str(end['lng']),
        'endY': str(end['lat']),
        'format': 'json',
        'count': 3
    }
)

print(f"Status: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(json.dumps(data, indent=2, ensure_ascii=False)[:3000])
else:
    print(response.text[:1000])

# 3. Test pedestrian route (도보)
print("\n" + "="*60)
print("3. PEDESTRIAN ROUTE (도보 경로)")
print("="*60)

response = requests.post(
    "https://apis.openapi.sk.com/tmap/routes/pedestrian",
    headers={
        'appKey': TMAP_API_KEY,
        'Content-Type': 'application/json'
    },
    json={
        'startX': str(start['lng']),
        'startY': str(start['lat']),
        'endX': str(end['lng']),
        'endY': str(end['lat']),
        'startName': '출발지',
        'endName': '도착지',
        'reqCoordType': 'WGS84GEO',
        'resCoordType': 'WGS84GEO',
    }
)

if response.status_code == 200:
    data = response.json()
    features = data.get('features', [])
    print(f"Total features: {len(features)}")
    
    # Check for turn-by-turn info
    for i, feature in enumerate(features[:5]):
        props = feature.get('properties', {})
        geom = feature.get('geometry', {})
        print(f"\n[Feature {i}]")
        print(f"  Type: {geom.get('type')}")
        if props.get('description'):
            print(f"  Description: {props.get('description')}")
        if props.get('turnType'):
            print(f"  Turn Type: {props.get('turnType')}")
else:
    print(f"Error: {response.status_code}")
    print(response.text[:500])
