import os
from flask import Flask, jsonify, request
from functools import wraps
import jwt
from flask_cors import CORS
from dotenv import load_dotenv
from sqlalchemy import select
from services.geocoding_service import GeocodingService
from services.benefit_lookup_service import BenefitLookupService
from services.location_service import LocationService
from services.database import init_db, get_db
from services.database import User, Card, MyCard
from services.jwt_service import JwtService

load_dotenv()

app = Flask(__name__)
CORS(app)

geocoding_service = GeocodingService()
benefit_service = BenefitLookupService()
location_service = LocationService()
jwt_service = JwtService()
# 데이터베이스 초기화
init_db()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'Authorization' not in request.headers:
            return jsonify({
                'error': 'Authorization header is required'
            }), 401
        token = request.headers['Authorization'].split(' ')[1]
        try:
            result = jwt_service.verify_token(token)
            if not result:
                return jsonify({'error': 'Invalid token'}), 401
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    return decorated_function


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'cardealo-backend'
    }), 200

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    user_id = data.get('user_id')
    user_pw = data.get('user_pw')
    user_email = data.get('user_email')
    user_age = data.get('user_age')
    isBusiness = data.get('isBusiness')
    card_name = data.get('card_name')
    print(f"user_id: {user_id}, user_pw: {user_pw}, user_email: {user_email}, user_age: {user_age}, isBusiness: {isBusiness}, card_name: {card_name}")
    
    if not user_id or not user_pw or not user_email or not user_age or isBusiness is None or not card_name:
        return jsonify({'success':False, 'error': 'user_id, user_pw, user_email, user_age, isBusiness, card_name are required'}), 400
    
    if isinstance(isBusiness, str):
        if not isBusiness or isBusiness.strip() == '':
            isBusiness = False
        else:
            isBusiness = isBusiness.lower() in ('true', '1', 'yes')
    elif isinstance(isBusiness, bool):
        pass
    else:
        isBusiness = bool(isBusiness) if isBusiness else False
    
    try:
        user_age = int(user_age)
    except (ValueError, TypeError):
        return jsonify({'success':False, 'error': 'user_age must be a valid integer'}), 400

    try:
        db = get_db()
        existing_user = db.scalars(select(User).where(User.user_id == user_id or User.user_email == user_email)).first()
        if existing_user:
            return jsonify({
                'error': 'User already exists'
            }), 400
        check_card = db.scalars(select(Card).where(Card.card_name == card_name)).first()
        if not check_card:
            return jsonify({'success':False, 'error': 'Card not found'}), 404
        user = User(user_id=user_id, user_pw=user_pw, user_age=user_age, isBusiness=isBusiness, user_email=user_email)
        mycard = MyCard(user_id=user_id, mycard_name=card_name, mycard_detail=check_card.card_benefit, mycard_pre_month_money=check_card.card_pre_month_money)
        db.add(mycard)
        db.add(user)
        db.commit()
        return jsonify({'success':True, 'msg': 'registered'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'success':False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user_email = data.get('user_email')
    user_pw = data.get('user_pw')
    
    try:
        db = get_db()
        user = db.scalars(select(User).where(User.user_email == user_email)).first()
        if not user:
            return jsonify({'success':False, 'error': 'User not found'}), 404
        if not user.user_pw == user_pw:
            return jsonify({'success':False, 'error': 'Invalid password'}), 401
        return jsonify({'success':True, 'msg': 'logged in', 'token': jwt_service.generate_token(user.user_id)}), 200
    except Exception as e:
        return jsonify({'success':False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/mypage', methods=['GET'])
@login_required
def mypage():
    user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
    try:
        db = get_db()
        user = db.scalars(select(User).where(User.user_id == user_id)).first()
        if not user:
            return jsonify({'success':False, 'error': 'User not found'}), 404
        user_data = {
            'user_id': user.user_id,
            'user_age': user.user_age,
            'isBusiness': user.isBusiness,
            'user_email': user.user_email,
            'cards': []
        }
        cards = db.scalars(select(MyCard).where(MyCard.user_id == user_id)).all()
        for card in cards:
            user_data['cards'].append({
                'card_name': card.mycard_name,
                'card_benefit': card.mycard_detail,
                'card_pre_month_money': card.mycard_pre_month_money
            })
        return jsonify({'success':True, 'msg': 'mypage', 'user':user_data}), 200
    except Exception as e:
        return jsonify({'success':False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/card/list', methods=['GET'])
def card_list():
    keyword = request.args.get('keyword')
    page = request.args.get('page')
    if not page:
        page = 1
    else:
        page = int(page)
    cards_data = []
    if not keyword:
        try:
            db = get_db()
            cards = db.scalars(select(Card).limit(25).offset((page-1)*25)).all()
            for card in cards:
                cards_data.append({
                    'card_name': card.card_name,
                    'card_benefit': card.card_benefit,
                    'card_pre_month_money': card.card_pre_month_money
                })
            return jsonify({'success':True, 'msg': 'card list', 'cards': cards_data}), 200
        except Exception as e:
            return jsonify({'success':False, 'error': str(e)}), 500
        finally:
            db.close()
    else:
        try:
            db = get_db()
            cards = db.scalars(select(Card).where(Card.card_name.like(f'%{keyword}%')).limit(25).offset((page-1)*25)).all()
            cards_data = []
            for card in cards:
                cards_data.append({
                    'card_name': card.card_name,
                    'card_benefit': card.card_benefit,
                    'card_pre_month_money': card.card_pre_month_money
                })
            return jsonify({'success':True, 'msg': 'card list', 'cards': cards_data}), 200
        except Exception as e:
            return jsonify({'success':False, 'error': str(e)}), 500
        finally:
            db.close()

@app.route('/api/card/add', methods=['POST'])
@login_required
def card_add():
    user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
    data = request.get_json()
    card_name = data.get('card_name')
    if not card_name:
        return jsonify({'success':False, 'error': 'card_name is required'}), 400
    try:
        db = get_db()
        check_card = db.scalars(select(Card).where(Card.card_name == card_name)).first()
        if not check_card:
            return jsonify({'success':False, 'error': 'Card not found'}), 404
        mycard = MyCard(user_id=user_id, mycard_name=card_name, mycard_detail=check_card.card_benefit, mycard_pre_month_money=check_card.card_pre_month_money)
        db.add(mycard)
        db.commit()
        return jsonify({'success':True, 'msg': 'card added'}), 200
    except Exception as e:
        return jsonify({'success':False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/card/edit', methods=['POST'])
@login_required
def card_edit():
    user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
    data = request.get_json()
    old_card_name = data.get('old_card_name')
    new_card_name = data.get('new_card_name')
    if not old_card_name:
        return jsonify({'success':False, 'error': 'old_card_name is required'}), 400
    if not new_card_name:
        return jsonify({'success':False, 'error': 'new_card_name is required'}), 400
    try:
        db = get_db()
        mycard = db.scalars(select(MyCard).where(MyCard.user_id == user_id, MyCard.mycard_name == old_card_name)).first()
        if not mycard:
            return jsonify({'success':False, 'error': 'MyCard not found'}), 404
        check_card = db.scalars(select(Card).where(Card.card_name == new_card_name)).first()
        if not check_card:
            return jsonify({'success':False, 'error': 'Card not found'}), 404
        mycard.mycard_name = new_card_name
        mycard.mycard_detail = check_card.card_benefit
        mycard.mycard_pre_month_money = check_card.card_pre_month_money
        db.commit()
        return jsonify({'success':True, 'msg': 'card edited'}), 200
    except Exception as e:
        db.rollback()
        return jsonify({'success':False, 'error': str(e)}), 500

@app.route('/api/card/del', methods=['POST'])
@login_required
def card_delete():
    user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
    data = request.get_json()
    card_name = data.get('card_name')
    if not card_name:
        return jsonify({'success':False, 'error': 'card_name is required'}), 400
    try:
        db = get_db()
        card = db.scalars(select(MyCard).where(MyCard.user_id == user_id, MyCard.mycard_name == card_name)).first()
        if not card:
            return jsonify({'success':False, 'error': 'Card not found'}), 404
        db.delete(card)
        db.commit()
        return jsonify({'success':True, 'msg': 'card deleted'}), 200
    except Exception as e:
        return jsonify({'success':False, 'error': str(e)}), 500
    finally:
        db.close()

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
        gps_accuracy = request.args.get('gps_accuracy', type=float)
        staying_duration = request.args.get('staying_duration', type=int)
        print(f"\n[API] nearby-recommendations 요청")
        print(f"[API] 검색 위치: {lat}, {lng}, radius={radius}m")
        print(f"[API] 사용자 위치: {user_lat}, {user_lng}")
        print(f"[API] GPS 정확도: {gps_accuracy}m")
        print(f"[API] 체류 시간: {staying_duration}초")
        print(f"[API] 카드: {cards}")
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid parameters'}), 400

    # Detect indoor/outdoor
    location_info = location_service.detect_indoor(lat, lng, gps_accuracy, staying_duration)
    print(f"[API] 위치 정보: indoor={location_info['indoor']}, building={location_info['building_name']}")

    # Search nearby stores
    if location_info['indoor'] and location_info['building_name']:
        print(f"[API] 건물 내부 검색: {location_info['building_name']}")
        stores = location_service.search_building_stores(
            location_info['building_name'],
            user_lat,
            user_lng
        )

        # Fallback to nearby search if no stores found
        if len(stores) == 0:
            print(f"[API] 건물 검색 실패, 주변 검색으로 전환...")
            stores = location_service.search_nearby_stores(lat, lng, radius)
        else:
            # Limit to 6 stores when inside building
            stores = stores[:6]
            print(f"[API] 건물 내부 - 최대 6개 가맹점으로 제한")
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
    Search for a place using Google Places API
    - If user location provided: Use Nearby Search (location-based)
    - Otherwise: Use Text Search (global search)
    """
    query = request.args.get('query')
    latitude = request.args.get('latitude', type=float)
    longitude = request.args.get('longitude', type=float)

    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400

    try:
        import requests as req

        # Use Nearby Search if location is provided (강제 위치 기반)
        if latitude is not None and longitude is not None:
            print(f"[Search] Nearby Search: '{query}' at {latitude}, {longitude}")

            params = {
                'location': f'{latitude},{longitude}',
                'radius': 5000,  # 5km radius (강제 필터)
                'keyword': query,  # 'query' 대신 'keyword' 사용
                'key': os.getenv('GOOGLE_MAPS_API_KEY'),
                'language': 'ko',
            }

            response = req.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', params=params)
        else:
            # Use Text Search for global search (위치 정보 없을 때)
            print(f"[Search] Text Search: '{query}'")

            params = {
                'query': query,
                'key': os.getenv('GOOGLE_MAPS_API_KEY'),
                'language': 'ko',
            }

            response = req.get('https://maps.googleapis.com/maps/api/place/textsearch/json', params=params)

        response.raise_for_status()
        data = response.json()
        results = data.get('results', [])

        print(f"[Search] 검색 결과: {len(results)}개")

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
