import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

from services.geocoding_service import GeocodingService
from services.benefit_lookup_service import BenefitLookupService
from services.location_service import LocationService

load_dotenv()

app = Flask(__name__)
CORS(app)

geocoding_service = GeocodingService()
benefit_service = BenefitLookupService()
location_service = LocationService()


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'cardealo-backend'
    }), 200


@app.route('/api/geocode', methods=['GET'])
def geocode():
    address = request.args.get('address')

    if not address:
        return jsonify({
            'error': 'Address parameter is required'
        }), 400

    result = geocoding_service.get_coordinates(address)

    if result:
        return jsonify(result), 200
    else:
        return jsonify({
            'error': 'Address not found'
        }), 404


@app.route('/api/geocode/batch', methods=['POST'])
def geocode_batch():
    data = request.get_json()

    if not data or 'addresses' not in data:
        return jsonify({
            'error': 'addresses array is required in request body'
        }), 400

    addresses = data['addresses']

    if not isinstance(addresses, list):
        return jsonify({
            'error': 'addresses must be an array'
        }), 400

    results = geocoding_service.batch_geocode(addresses)

    return jsonify({
        'results': results
    }), 200


@app.route('/api/nearby-recommendations', methods=['GET'])
def nearby_recommendations():
    """
    Get nearby stores with card recommendations
    """
    try:
        lat = float(request.args.get('lat'))
        lng = float(request.args.get('lng'))
        # 사용자의 실제 위치 (거리 계산용)
        user_lat = float(request.args.get('user_lat', lat))
        user_lng = float(request.args.get('user_lng', lng))
        radius = int(request.args.get('radius', 500))
        cards = request.args.get('cards', '').split(',')
        print(f"\n[API] nearby-recommendations 요청")
        print(f"[API] 검색 위치: {lat}, {lng}, radius={radius}m")
        print(f"[API] 사용자 위치: {user_lat}, {user_lng}")
        print(f"[API] 카드: {cards}")
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid parameters'}), 400

    # Detect indoor/outdoor
    location_info = location_service.detect_indoor(lat, lng)
    print(f"[API] 위치 정보: indoor={location_info['indoor']}, building={location_info['building_name']}")

    # Search nearby stores
    if location_info['indoor'] and location_info['building_name']:
        print(f"[API] 건물 내부 검색: {location_info['building_name']}")
        stores = location_service.search_building_stores(location_info['building_name'])

        # Fallback to nearby search if no stores found
        if len(stores) == 0:
            print(f"[API] 건물 검색 실패, 주변 검색으로 전환...")
            stores = location_service.search_nearby_stores(lat, lng, radius)
    else:
        print(f"[API] 주변 가맹점 검색 시작...")
        stores = location_service.search_nearby_stores(lat, lng, radius)

    print(f"[API] 검색 완료: {len(stores)}개 가맹점 발견")

    # Recalculate distance from user's actual location
    for store in stores:
        actual_distance = location_service.calculate_distance(
            user_lat, user_lng,
            store['latitude'], store['longitude']
        )
        store['distance'] = int(actual_distance)

    # Sort by distance from user
    stores.sort(key=lambda x: x['distance'])

    # Add top card recommendation for each store
    for store in stores:
        top_card = benefit_service.get_top_card_for_merchant(
            store['name'],
            store['category'],
            cards
        )

        if top_card:
            store['top_card'] = {
                'card': top_card['card'],
                'score': top_card['score'],
                'benefit': format_benefit(top_card)
            }
        else:
            store['top_card'] = None

    return jsonify({
        'indoor': location_info['indoor'],
        'building_name': location_info['building_name'],
        'address': location_info['address'],
        'stores': stores
    }), 200


@app.route('/api/merchant-recommendations', methods=['POST'])
def merchant_recommendations():
    """
    Get detailed card recommendations for a specific merchant
    """
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    merchant_name = data.get('merchant_name')
    category = data.get('category')
    user_cards = data.get('user_cards', [])

    if not category or not user_cards:
        return jsonify({'error': 'category and user_cards are required'}), 400

    recommendations = benefit_service.get_recommendations(
        merchant_name,
        category,
        user_cards
    )

    # Format recommendations
    formatted_recs = []
    for rec in recommendations:
        formatted_recs.append({
            'rank': rec['rank'],
            'card': rec['card'],
            'score': rec['score'],
            'discount_rate': rec['discount_rate'],
            'discount_amount': rec['discount_amount'],
            'monthly_limit': rec['monthly_limit'],
            'point_rate': rec['point_rate'],
            'pre_month_money': rec['pre_month_money'],
            'benefit_summary': format_benefit(rec)
        })

    return jsonify({
        'merchant_name': merchant_name,
        'category': category,
        'recommendations': formatted_recs
    }), 200


@app.route('/api/search-place', methods=['GET'])
def search_place():
    """
    Search for a place using Google Places Text Search
    """
    query = request.args.get('query')

    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400

    try:
        import requests as req
        response = req.get('https://maps.googleapis.com/maps/api/place/textsearch/json', params={
            'query': query,
            'key': os.getenv('GOOGLE_MAPS_API_KEY'),
            'language': 'ko',
        })
        response.raise_for_status()

        data = response.json()
        results = data.get('results', [])

        print(f"[Search] 검색어: '{query}', 결과: {len(results)}개")

        if results:
            place = results[0]
            location = place['geometry']['location']
            return jsonify({
                'location': {
                    'latitude': location['lat'],
                    'longitude': location['lng'],
                    'name': place['name'],
                    'address': place.get('formatted_address', ''),
                }
            }), 200
        else:
            return jsonify({'location': None}), 200

    except Exception as e:
        print(f"Place search error: {e}")
        return jsonify({'error': 'Search failed'}), 500


@app.route('/api/stores', methods=['GET'])
def get_stores():
    """
    Return sample store data with coordinates (deprecated - use nearby-recommendations)
    """
    stores = [
        {
            'id': '1',
            'name': '홈플러스',
            'branch': '안암점',
            'address': '서울특별시 성북구 안암로 145',
            'category': 'mart',
            'cardName': 'THE1',
            'benefit': '1만원 이상 결제 시 5,680원 할인'
        },
        {
            'id': '2',
            'name': '올리브영',
            'branch': '안암점',
            'address': '서울특별시 성북구 안암동5가 126-1',
            'category': 'mart',
            'cardName': '진다 조인트카드',
            'benefit': '5% 할인'
        }
    ]

    # Add coordinates to stores
    for store in stores:
        coords = geocoding_service.get_coordinates(store['address'])
        if coords:
            store['latitude'] = coords['latitude']
            store['longitude'] = coords['longitude']
            store['distance'] = 'N/A'  # Will be calculated based on user location

    return jsonify({'stores': stores}), 200


def format_benefit(benefit: dict) -> str:
    """Format benefit info into human-readable string"""
    parts = []

    if benefit.get('discount_rate'):
        parts.append(f"{benefit['discount_rate']}% 할인")

    if benefit.get('discount_amount'):
        parts.append(f"최대 {benefit['discount_amount']:,}원 할인")

    if benefit.get('point_rate'):
        parts.append(f"{benefit['point_rate']}% 적립")

    if benefit.get('pre_month_money'):
        parts.append(f"전월 {benefit['pre_month_money']//10000}만원 이상")

    return ' • '.join(parts) if parts else '혜택 없음'


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'

    app.run(host='0.0.0.0', port=port, debug=debug)
