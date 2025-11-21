import os
from flask import Flask, jsonify, request
from functools import wraps
from flask_cors import CORS
from dotenv import load_dotenv
from sqlalchemy import select
from services.geocoding_service import GeocodingService
from services.benefit_lookup_service import BenefitLookupService
from services.location_service import LocationService
from services.directions_service import DirectionsService
from services.ocr_service import NaverOCRService
from services.database import init_db, get_db
from services.database import User, Card, MyCard, CardBenefit, SavedCourse, SavedCourseUser
from services.jwt_service import JwtService
from utils.utils import parse_place_name
from pprint import pprint
import json

load_dotenv()

app = Flask(__name__)
CORS(app)

geocoding_service = GeocodingService()
benefit_service = BenefitLookupService()
location_service = LocationService()
directions_service = DirectionsService()
ocr_service = NaverOCRService()
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
    user_name = data.get('user_name')
    user_id = data.get('user_id')
    user_pw = data.get('user_pw')
    user_email = data.get('user_email')
    user_age = data.get('user_age')
    isBusiness = data.get('isBusiness')
    card_name = data.get('card_name')
    print(f"user_id: {user_id}, user_pw: {user_pw}, user_email: {user_email}, user_age: {user_age}, isBusiness: {isBusiness}, card_name: {card_name}")
    
    if not user_name or not user_id or not user_pw or not user_email or not user_age or isBusiness is None or not card_name:
        return jsonify({'success':False, 'error': 'user_name, user_id, user_pw, user_email, user_age, isBusiness, card_name are required'}), 400
    
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
        user = User(user_id=user_id, user_name=user_name, user_pw=user_pw, user_age=user_age, isBusiness=isBusiness, user_email=user_email)
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

        # PasswordType 비교 방식 수정
        try:
            if user.user_pw != user_pw:
                return jsonify({'success':False, 'error': 'Invalid password'}), 401
        except Exception as pw_error:
            print(f"[Password comparison error] {pw_error}")
            return jsonify({'success':False, 'error': 'Password comparison failed'}), 500

        return jsonify({'success':True, 'msg': 'logged in', 'token': jwt_service.generate_token(user.user_id)}), 200
    except Exception as e:
        print(f"[Login error] {e}")
        import traceback
        traceback.print_exc()
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
            'user_name': user.user_name,
            'user_id': user.user_id,
            'user_age': user.user_age,
            'user_phone': user.user_phone,
            'monthly_spending': user.monthly_spending,
            'monthly_savings': user.monthly_savings,
            'isBusiness': user.isBusiness,
            'user_email': user.user_email,
            'cards': []
        }
        cards = db.scalars(select(MyCard).where(MyCard.user_id == user_id)).all()
        for card in cards:
            user_data['cards'].append({
                'card_name': card.mycard_name,
                'card_benefit': card.mycard_detail,
                'card_pre_month_money': card.mycard_pre_month_money,
                'card_pre_YN': card.mycard_pre_YN
            })
        return jsonify({'success':True, 'msg': 'mypage', 'user':user_data}), 200
    except Exception as e:
        return jsonify({'success':False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/ocr/card', methods=['POST'])
def ocr_card():
    """
    카드 이미지 OCR 처리 및 카드 검색

    Request:
    {
        "image": "base64_encoded_image",
        "image_format": "jpg"  // jpg, png, pdf, tiff
    }

    Response:
    {
        "success": true,
        "ocr_result": {
            "card_number": "1234567890123456",
            "card_name": "신한",
            "expiry_date": "12/25",
            "raw_text": "..."
        },
        "matching_cards": [
            {
                "card_name": "신한 Deep Dream 체크카드",
                "card_benefit": "...",
                "card_pre_month_money": 300000
            }
        ]
    }
    """
    data = request.get_json()

    if not data:
        return jsonify({'success': False, 'error': 'Request body is required'}), 400

    image_base64 = data.get('image')
    image_format = data.get('image_format', 'jpg')

    if not image_base64:
        return jsonify({'success': False, 'error': 'image is required'}), 400

    try:
        # OCR 처리
        ocr_result = ocr_service.extract_card_info(image_base64, image_format)

        if not ocr_result.get('success'):
            return jsonify({
                'success': False,
                'error': 'OCR processing failed',
                'details': ocr_result.get('error')
            }), 500

        # 카드 검색 (OCR에서 추출된 카드사 이름으로)
        matching_cards = []
        card_name_from_ocr = ocr_result.get('card_name')

        if card_name_from_ocr:
            db = get_db()
            cards = db.scalars(
                select(Card)
                .where(Card.card_name.like(f'%{card_name_from_ocr}%'))
                .limit(10)
            ).all()

            for card in cards:
                matching_cards.append({
                    'card_name': card.card_name,
                    'card_benefit': card.card_benefit,
                    'card_pre_month_money': card.card_pre_month_money
                })

            db.close()

        return jsonify({
            'success': True,
            'ocr_result': {
                'card_number': ocr_result.get('card_number'),
                'card_name': ocr_result.get('card_name'),
                'expiry_date': ocr_result.get('expiry_date'),
                'raw_text': ocr_result.get('raw_text')
            },
            'matching_cards': matching_cards
        }), 200

    except Exception as e:
        print(f"[OCR API Error] {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'details': str(e)
        }), 500

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

@app.route('/api/card/benefit', methods=['GET'])
@login_required
def card_benefit():
    user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
    res = {}
    try:
        db = get_db()
        user_cards = db.scalars(select(MyCard).where(MyCard.user_id == user_id)).all()
        for card in user_cards:
            res[card.mycard_name] = []
            card_benefit = db.scalars(select(CardBenefit).where(CardBenefit.card_name == card.mycard_name)).all()
            for benefit in card_benefit:
                category = benefit.category
                places = benefit.places
                discount_type = benefit.discount_type
                discount_value = benefit.discount_value
                max_discount = benefit.max_discount
                pre_month_config = benefit.pre_month_config
                limit_config = benefit.limit_config
                places_display = benefit.places_display
                discount_display = benefit.discount_display
                limit_display = benefit.limit_display
                max_discount_display = benefit.max_discount_display
                tmp = {}
                tmp['category'] = category
                tmp['places'] = json.loads(places)
                tmp['discount_type'] = discount_type
                tmp['discount_value'] = discount_value
                tmp['max_discount'] = max_discount
                tmp['pre_month_config'] = json.loads(pre_month_config)
                tmp['limit_config'] = json.loads(limit_config)
                tmp['places_display'] = places_display
                tmp['discount_display'] = discount_display
                tmp['limit_display'] = limit_display
                tmp['max_discount_display'] = max_discount_display
                res[card.mycard_name].append(tmp)
        # pprint(res)
    finally:
        db.close()
    return jsonify({'success':True, 'msg': 'card benefit', 'data': res}), 200


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
    Query params:
        - pagetoken: Optional pagination token from previous request
    """
    try:
        lat = float(request.args.get('lat'))
        lng = float(request.args.get('lng'))
        # 사용자의 실제 위치 (거리 계산용)
        user_lat = float(request.args.get('user_lat', lat))
        user_lng = float(request.args.get('user_lng', lng))
        radius = int(request.args.get('radius'))  # Required: calculated from map viewport
        cards = request.args.get('cards', '').split(',')
        gps_accuracy = request.args.get('gps_accuracy', type=float)
        staying_duration = request.args.get('staying_duration', type=int)
        category = request.args.get('category')
        pagetoken = request.args.get('pagetoken')
        print(f"\n[API] nearby-recommendations 요청")
        print(f"[API] 검색 위치: {lat}, {lng}, radius={radius}m")
        print(f"[API] 사용자 위치: {user_lat}, {user_lng}")
        print(f"[API] GPS 정확도: {gps_accuracy}m")
        print(f"[API] 체류 시간: {staying_duration}초")
        print(f"[API] 카드: {cards}")
        print(f"[API] 카테고리: {category}")
        print(f"[API] 페이지 토큰: {pagetoken}")
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid parameters'}), 400

    next_page_token = None

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
            result = location_service.search_nearby_stores(lat, lng, radius, category, pagetoken)

            # Check for errors
            if 'error' in result:
                return jsonify({
                    'error': result['error'],
                    'message': result['message']
                }), 500

            stores = result['stores']
            next_page_token = result['next_page_token']
        else:
            # Limit to 6 stores when inside building
            stores = stores[:6]
            print(f"[API] 건물 내부 - 최대 6개 가맹점으로 제한")
    else:
        print(f"[API] 주변 가맹점 검색 시작...")
        result = location_service.search_nearby_stores(lat, lng, radius, category, pagetoken)

        # Check for errors
        if 'error' in result:
            return jsonify({
                'error': result['error'],
                'message': result['message']
            }), 500

        stores = result['stores']
        next_page_token = result['next_page_token']

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

    response_data = {
        'indoor': location_info['indoor'],
        'building_name': location_info['building_name'],
        'address': location_info['address'],
        'stores': stores
    }

    # Add next_page_token if available
    if next_page_token:
        response_data['next_page_token'] = next_page_token

    return jsonify(response_data), 200


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


@app.route('/api/ai/course-recommend', methods=['POST'])
def ai_course_recommend():
    """
    AI 기반 혜택 극대화 코스 추천 API

    Request:
    {
        "user_input": "주말 단풍 데이트",
        "user_location": {"latitude": 37.xxx, "longitude": 127.xxx},
        "user_cards": ["현대 M카드", "신한 Love카드"],
        "max_distance": 5000,
        "num_people": 2,
        "budget": 100000
    }

    Response:
    {
        "intent": {...},
        "course": {
            "title": "혜택까지 알뜰한 잠실 산책 코스",
            "benefit_summary": "최대 50% 할인 혜택",
            "reasoning": "...",
            "stops": [...],
            "routes": [...],
            "total_distance": 1234,
            "total_duration": 45,
            "total_benefit_score": 250
        }
    }
    """
    try:
        # AI 서비스 모듈 동적 import
        import sys
        import os
        ai_path = os.path.join(os.path.dirname(__file__), 'ai')
        if ai_path not in sys.path:
            sys.path.insert(0, ai_path)

        from gemini_course_recommender import GeminiCourseRecommender

        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        user_input = data.get('user_input')
        user_location = data.get('user_location')
        user_cards = data.get('user_cards', [])
        max_distance = data.get('max_distance', 5000)
        num_people = data.get('num_people', 2)
        budget = data.get('budget', 100000)

        if not user_input or not user_location:
            return jsonify({
                'error': 'user_input and user_location are required'
            }), 400

        # Gemini 기반 코스 추천
        recommender = GeminiCourseRecommender()
        result = recommender.recommend_course_with_benefits(
            user_input=user_input,
            user_location=user_location,
            user_cards=user_cards,
            max_distance=max_distance,
            num_people=num_people,
            budget=budget
        )

        return jsonify(result), 200

    except Exception as e:
        print(f"[Error] AI 코스 추천 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'AI course recommendation failed',
            'message': str(e)
        }), 500


@app.route('/api/course/save', methods=['POST'])
@login_required
def save_course():
    """
    코스 저장 API

    Request:
    {
        "title": "잠실 석촌호수 산책 코스",
        "description": "혜택까지 알뜰한 코스",
        "stops": [...],  // JSON: 코스 장소 목록
        "route_info": {...},  // JSON: 경로 정보
        "total_distance": 1234,
        "total_duration": 45,
        "total_benefit_score": 250,
        "num_people": 2,
        "budget": 100000
    }

    Response:
    {
        "success": true,
        "course_id": 1,
        "message": "코스가 저장되었습니다"
    }
    """
    user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
    data = request.get_json()

    if not data:
        return jsonify({'success': False, 'error': 'Request body is required'}), 400

    title = data.get('title')
    description = data.get('description', '')
    stops = data.get('stops', [])
    route_info = data.get('route_info')
    total_distance = data.get('total_distance', 0)
    total_duration = data.get('total_duration', 0)
    total_benefit_score = data.get('total_benefit_score', 0)
    num_people = data.get('num_people', 2)
    budget = data.get('budget', 100000)

    if not title or not stops:
        return jsonify({
            'success': False,
            'error': 'title and stops are required'
        }), 400

    try:
        db = get_db()

        # 코스 저장
        new_course = SavedCourse(
            user_id=user_id,
            title=title,
            description=description,
            stops=json.dumps(stops, ensure_ascii=False),
            route_info=json.dumps(route_info, ensure_ascii=False) if route_info else None,
            total_distance=total_distance,
            total_duration=total_duration,
            total_benefit_score=total_benefit_score,
            num_people=num_people,
            budget=budget,
            save_count=1
        )
        db.add(new_course)
        db.commit()
        db.refresh(new_course)

        # 사용자-코스 매핑 추가
        course_user = SavedCourseUser(
            course_id=new_course.id,
            user_id=user_id
        )
        db.add(course_user)
        db.commit()

        return jsonify({
            'success': True,
            'course_id': new_course.id,
            'message': '코스가 저장되었습니다'
        }), 200

    except Exception as e:
        print(f"[Error] 코스 저장 실패: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return jsonify({
            'success': False,
            'error': '코스 저장에 실패했습니다',
            'message': str(e)
        }), 500
    finally:
        db.close()


@app.route('/api/course/saved', methods=['GET'])
@login_required
def get_saved_courses():
    """
    사용자가 저장한 코스 조회 API

    Query params:
        - limit: 최대 결과 개수 (기본: 10)
        - offset: 오프셋 (기본: 0)

    Response:
    {
        "success": true,
        "courses": [
            {
                "id": 1,
                "title": "잠실 석촌호수 산책 코스",
                "description": "혜택까지 알뜰한 코스",
                "stops": [...],
                "route_info": {...},
                "total_distance": 1234,
                "total_duration": 45,
                "total_benefit_score": 250,
                "num_people": 2,
                "budget": 100000,
                "created_at": "2024-01-01T00:00:00",
                "is_saved_by_user": true
            }
        ]
    }
    """
    user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
    limit = request.args.get('limit', 10, type=int)
    offset = request.args.get('offset', 0, type=int)

    try:
        db = get_db()

        # 사용자가 저장한 코스 ID 가져오기
        saved_course_ids = db.scalars(
            select(SavedCourseUser.course_id)
            .where(SavedCourseUser.user_id == user_id)
        ).all()

        # 코스 정보 가져오기
        courses = db.scalars(
            select(SavedCourse)
            .where(SavedCourse.id.in_(saved_course_ids))
            .order_by(SavedCourse.created_at.desc())
            .limit(limit)
            .offset(offset)
        ).all()

        courses_data = []
        for course in courses:
            courses_data.append({
                'id': course.id,
                'title': course.title,
                'description': course.description,
                'stops': json.loads(course.stops) if course.stops else [],
                'route_info': json.loads(course.route_info) if course.route_info else None,
                'total_distance': course.total_distance,
                'total_duration': course.total_duration,
                'total_benefit_score': course.total_benefit_score,
                'num_people': course.num_people,
                'budget': course.budget,
                'created_at': course.created_at.isoformat() if course.created_at else None,
                'user_id': course.user_id,
                'is_saved_by_user': True
            })

        return jsonify({
            'success': True,
            'courses': courses_data
        }), 200

    except Exception as e:
        print(f"[Error] 저장 코스 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': '저장 코스 조회에 실패했습니다',
            'message': str(e)
        }), 500
    finally:
        db.close()


@app.route('/api/course/popular', methods=['GET'])
def get_popular_courses():
    """
    인기 코스 조회 API

    Query params:
        - limit: 최대 결과 개수 (기본: 10)
        - offset: 오프셋 (기본: 0)

    Response:
    {
        "success": true,
        "courses": [
            {
                "id": 1,
                "title": "잠실 석촌호수 산책 코스",
                "description": "혜택까지 알뜰한 코스",
                "stops": [...],
                "route_info": {...},
                "total_distance": 1234,
                "total_duration": 45,
                "total_benefit_score": 250,
                "num_people": 2,
                "budget": 100000,
                "created_at": "2024-01-01T00:00:00",
                "save_count": 42
            }
        ]
    }
    """
    limit = request.args.get('limit', 10, type=int)
    offset = request.args.get('offset', 0, type=int)

    try:
        db = get_db()

        # 저장 횟수 기준 인기 코스 가져오기
        courses = db.scalars(
            select(SavedCourse)
            .where(SavedCourse.save_count > 0)
            .order_by(SavedCourse.save_count.desc())
            .limit(limit)
            .offset(offset)
        ).all()

        courses_data = []
        for course in courses:
            courses_data.append({
                'id': course.id,
                'title': course.title,
                'description': course.description,
                'stops': json.loads(course.stops) if course.stops else [],
                'route_info': json.loads(course.route_info) if course.route_info else None,
                'total_distance': course.total_distance,
                'total_duration': course.total_duration,
                'total_benefit_score': course.total_benefit_score,
                'num_people': course.num_people,
                'budget': course.budget,
                'created_at': course.created_at.isoformat() if course.created_at else None,
                'user_id': course.user_id,
                'save_count': course.save_count
            })

        return jsonify({
            'success': True,
            'courses': courses_data
        }), 200

    except Exception as e:
        print(f"[Error] 인기 코스 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': '인기 코스 조회에 실패했습니다',
            'message': str(e)
        }), 500
    finally:
        db.close()


@app.route('/api/directions', methods=['POST'])
def get_directions():
    """
    경로 안내 정보 조회 API (Google Directions API)

    Request:
    {
        "origin": {"latitude": 37.xxx, "longitude": 127.xxx},
        "destination": {"latitude": 37.xxx, "longitude": 127.xxx},
        "waypoints": [
            {"latitude": 37.xxx, "longitude": 127.xxx}
        ],
        "mode": "walking",  // "driving", "walking", "transit", "bicycling"
        "alternatives": false,
        "avoid": ["tolls", "highways"]
    }

    Response:
    {
        "status": "OK",
        "routes": [...],
        "total_distance": 1234,
        "total_duration": 900,
        "total_distance_text": "1.2 km",
        "total_duration_text": "15분",
        "fare": {"currency": "KRW", "value": 1400},  // 대중교통만
        "fare_text": "1,400원",  // 대중교통만
        "fare_source": "google_api" // 또는 "estimated_seoul"
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        origin = data.get('origin')
        destination = data.get('destination')
        waypoints = data.get('waypoints', [])
        mode = data.get('mode', 'walking')
        alternatives = data.get('alternatives', False)
        avoid = data.get('avoid', [])

        if not origin or not destination:
            return jsonify({
                'error': 'origin and destination are required'
            }), 400

        result = directions_service.get_directions(
            origin=origin,
            destination=destination,
            waypoints=waypoints if waypoints else None,
            mode=mode,
            alternatives=alternatives,
            avoid=avoid if avoid else None
        )

        return jsonify(result), 200

    except Exception as e:
        print(f"[Error] Directions API 호출 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Failed to get directions',
            'message': str(e)
        }), 500


@app.route('/api/course-directions', methods=['POST'])
def get_course_directions():
    """
    AI 코스 추천 결과를 위한 경로 정보 조회 API

    Request:
    {
        "course_stops": [
            {"name": "스타벅스", "latitude": 37.xxx, "longitude": 127.xxx},
            {"name": "레스토랑", "latitude": 37.xxx, "longitude": 127.xxx}
        ],
        "start_location": {"latitude": 37.xxx, "longitude": 127.xxx},
        "mode": "walking"
    }

    Response:
    {
        "status": "OK",
        "routes": [...],
        "legs_summary": [
            {
                "from": "현재 위치",
                "to": "스타벅스",
                "distance": 500,
                "duration": 360,
                "distance_text": "500 m",
                "duration_text": "6분"
            }
        ],
        "total_distance": 1500,
        "total_duration": 1200,
        "total_distance_text": "1.5 km",
        "total_duration_text": "20분",
        "fare": {"currency": "KRW", "value": 1400},  // 대중교통만
        "fare_text": "1,400원"  // 대중교통만
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        course_stops = data.get('course_stops', [])
        start_location = data.get('start_location')
        mode = data.get('mode', 'walking')

        if not course_stops:
            return jsonify({
                'error': 'course_stops is required'
            }), 400

        result = directions_service.get_course_directions(
            course_stops=course_stops,
            start_location=start_location,
            mode=mode
        )

        return jsonify(result), 200

    except Exception as e:
        print(f"[Error] Course Directions API 호출 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Failed to get course directions',
            'message': str(e)
        }), 500


@app.route('/api/course-directions-mixed', methods=['POST'])
def get_course_directions_mixed():
    """
    구간별 교통수단 자동 선택 경로 정보 조회 API

    Request:
    {
        "course_stops": [
            {"name": "스타벅스", "latitude": 37.xxx, "longitude": 127.xxx},
            {"name": "레스토랑", "latitude": 37.xxx, "longitude": 127.xxx}
        ],
        "start_location": {"latitude": 37.xxx, "longitude": 127.xxx},
        "leg_modes": ["walking", "transit"]  // Optional: 각 구간의 교통수단 (없으면 자동 판단)
    }

    Response:
    {
        "status": "OK",
        "legs_summary": [
            {
                "from": "현재 위치",
                "to": "스타벅스",
                "mode": "walking",
                "distance": 500,
                "duration": 360,
                "fare": null,
                "distance_text": "500 m",
                "duration_text": "6분",
                "fare_text": null
            },
            {
                "from": "스타벅스",
                "to": "레스토랑",
                "mode": "transit",
                "distance": 3000,
                "duration": 720,
                "fare": 1400,
                "distance_text": "3.0 km",
                "duration_text": "12분",
                "fare_text": "1,400원"
            }
        ],
        "total_distance": 3500,
        "total_duration": 1080,
        "total_fare": 1400,
        "total_distance_text": "3.5 km",
        "total_duration_text": "18분",
        "total_fare_text": "1,400원"
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        course_stops = data.get('course_stops', [])
        start_location = data.get('start_location')
        leg_modes = data.get('leg_modes')

        if not course_stops:
            return jsonify({
                'error': 'course_stops is required'
            }), 400

        result = directions_service.get_course_directions_mixed_mode(
            course_stops=course_stops,
            start_location=start_location,
            leg_modes=leg_modes
        )

        return jsonify(result), 200

    except Exception as e:
        print(f"[Error] Mixed Mode Course Directions API 호출 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Failed to get mixed mode course directions',
            'message': str(e)
        }), 500


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5001))
    debug = os.getenv('FLASK_ENV') == 'development'

    app.run(host='0.0.0.0', port=port, debug=debug)
