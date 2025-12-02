import os
from flask import Flask, jsonify, request
from functools import wraps
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from dotenv import load_dotenv
from sqlalchemy import select
from services.geocoding_service import GeocodingService
from services.benefit_lookup_service import BenefitLookupService
from services.location_service import LocationService
from services.directions_service import DirectionsService
from services.ocr_service import NaverOCRService
from services.database import init_db, get_db
from services.database import User, Card, MyCard, CardBenefit, SavedCourse, SavedCourseUser, PaymentHistory, QRScanStatus
from services.database import CorporateCard, Department, CorporateCardMember, CorporatePaymentHistory
import uuid
from services.jwt_service import JwtService
from utils.utils import parse_place_name
from pprint import pprint
import json
import qrcode
from io import BytesIO
import base64
import hmac
import hashlib
from datetime import datetime, date

load_dotenv()

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

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
                'cid': card.cid,
                'card_name': card.mycard_name,
                'card_benefit': card.mycard_detail,
                'card_pre_month_money': card.mycard_pre_month_money,
                'card_pre_YN': card.mycard_pre_YN,
                # 결제 추적 필드
                'monthly_limit': card.monthly_limit or 0,
                'used_amount': card.used_amount or 0,
                'monthly_performance': card.monthly_performance or 0,
                'daily_count': card.daily_count or 0,
                'monthly_count': card.monthly_count or 0,
                'last_used_date': card.last_used_date.isoformat() if card.last_used_date else None,
                'reset_date': card.reset_date.isoformat() if card.reset_date else None
            })
        return jsonify({'success':True, 'msg': 'mypage', 'user':user_data}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
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


@app.route('/api/qr/generate', methods=['POST'])
@login_required
def generate_qr():
    """
    QR/바코드 생성 API

    Request:
    {
        "card_id": 1,
        "type": "qr"  // or "barcode"
    }

    Response:
    {
        "qr_image": "data:image/png;base64,...",
        "barcode_image": "data:image/png;base64,...",
        "expires_in": 300  // seconds
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        card_id = data.get('card_id')
        qr_type = data.get('type', 'qr')

        if not card_id:
            return jsonify({'error': 'card_id is required'}), 400

        db = get_db()

        # 사용자 및 카드 정보 조회
        user = db.scalars(select(User).where(User.user_id == user_id)).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        card = db.scalars(select(MyCard).where(MyCard.cid == card_id, MyCard.user_id == user_id)).first()
        if not card:
            return jsonify({'error': 'Card not found'}), 404

        # QR 데이터 생성
        timestamp = int(datetime.now().timestamp())
        qr_data = {
            "user_id": user_id,
            "user_name": user.user_name,
            "card_id": card.cid,
            "card_name": card.mycard_name,
            "timestamp": timestamp
        }

        # 서명 생성 (보안)
        jwt_secret = os.getenv('JWT_SECRET', 'default-secret')
        signature = hmac.new(
            jwt_secret.encode(),
            json.dumps(qr_data, sort_keys=True).encode(),
            hashlib.sha256
        ).hexdigest()
        qr_data["signature"] = signature

        qr_data_str = json.dumps(qr_data)

        # QR 스캔 상태 생성
        qr_status = QRScanStatus(
            user_id=user_id,
            card_id=card.cid,
            timestamp=timestamp,
            status='waiting'
        )
        db.add(qr_status)
        db.commit()

        # QR 코드 이미지 생성
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(qr_data_str)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        qr_image = f"data:image/png;base64,{img_str}"

        db.close()

        return jsonify({
            'success': True,
            'qr_image': qr_image,
            'barcode_image': qr_image,  # 동일하게 사용
            'expires_in': 300,
            'timestamp': timestamp  # QR 스캔 상태 확인용
        }), 200

    except Exception as e:
        print(f"[Error] QR 생성 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': 'QR 생성에 실패했습니다',
            'message': str(e)
        }), 500


@app.route('/api/qr/scan-status', methods=['GET'])
@login_required
def get_qr_scan_status():
    """
    QR 스캔 상태 확인 API

    Query Params:
        timestamp: QR 생성 시간 (Unix timestamp)

    Response:
    {
        "status": "waiting" | "scanned" | "processing" | "completed" | "failed" | "cancelled",
        "merchant_name": "스타벅스" (if scanned),
        "scanned_at": "2025-11-22T..." (if scanned)
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        timestamp = request.args.get('timestamp')

        if not timestamp:
            return jsonify({'error': 'timestamp is required'}), 400

        # Validate timestamp is numeric
        try:
            timestamp_int = int(timestamp)
        except ValueError:
            return jsonify({'error': 'invalid timestamp format'}), 400

        db = get_db()

        # QR 스캔 상태 조회
        qr_status = db.scalars(
            select(QRScanStatus).where(
                QRScanStatus.user_id == user_id,
                QRScanStatus.timestamp == timestamp_int
            ).order_by(QRScanStatus.created_at.desc())
        ).first()

        if not qr_status:
            db.close()
            return jsonify({'error': 'QR not found'}), 404

        # 타임아웃 체크 (60초)
        if qr_status.status in ['waiting', 'scanned'] and \
           (datetime.utcnow() - qr_status.created_at).seconds > 60:
            qr_status.status = 'failed'
            db.commit()

        response = {
            'status': qr_status.status,
        }

        if qr_status.merchant_name:
            response['merchant_name'] = qr_status.merchant_name

        if qr_status.scanned_at:
            response['scanned_at'] = qr_status.scanned_at.isoformat()

        db.close()

        return jsonify(response), 200

    except Exception as e:
        print(f"[Error] QR 상태 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'QR 상태 조회에 실패했습니다', 'message': str(e)}), 500


def require_admin_auth(f):
    """관리자 권한 검증 데코레이터"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'Authorization' not in request.headers:
            return jsonify({'error': 'Authorization header is required'}), 401

        token = request.headers['Authorization']
        admin_secret = os.getenv('ADMIN_SECRET_KEY', 'default-admin-secret')

        if token != f"Bearer {admin_secret}":
            return jsonify({'error': 'Invalid admin token'}), 401

        return f(*args, **kwargs)
    return decorated_function


@app.route('/api/qr/update-status', methods=['POST'])
@require_admin_auth
def update_qr_scan_status():
    """
    QR 스캔 상태 업데이트 API (관리자 백엔드가 호출)

    Request:
    {
        "user_id": "hong_gildong",
        "timestamp": 1234567890,
        "status": "scanned" | "processing" | "completed" | "failed" | "cancelled",
        "merchant_name": "스타벅스" (optional)
    }

    Response:
    {
        "success": true
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        user_id = data.get('user_id')
        timestamp = data.get('timestamp')
        status = data.get('status')
        merchant_name = data.get('merchant_name')

        if not user_id or not timestamp or not status:
            return jsonify({'error': 'user_id, timestamp, and status are required'}), 400

        if status not in ['waiting', 'scanned', 'processing', 'completed', 'failed', 'cancelled']:
            return jsonify({'error': 'Invalid status'}), 400

        db = get_db()

        # QR 스캔 상태 조회
        qr_status = db.scalars(
            select(QRScanStatus).where(
                QRScanStatus.user_id == user_id,
                QRScanStatus.timestamp == timestamp
            )
        ).first()

        if not qr_status:
            db.close()
            return jsonify({'error': 'QR not found'}), 404

        # 상태 업데이트
        qr_status.status = status
        if merchant_name:
            qr_status.merchant_name = merchant_name
        if status == 'scanned' and not qr_status.scanned_at:
            qr_status.scanned_at = datetime.utcnow()

        db.commit()
        db.close()

        return jsonify({'success': True}), 200

    except Exception as e:
        print(f"[Error] QR 상태 업데이트 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'QR 상태 업데이트에 실패했습니다', 'message': str(e)}), 500


@app.route('/api/payment/webhook', methods=['POST'])
@require_admin_auth
def payment_webhook():
    """
    관리자 백엔드로부터 결제 정보 수신 API

    Request:
    {
        "transaction_id": "uuid",
        "user_id": "hong_gildong",
        "card_id": 1,
        "merchant_name": "스타벅스",
        "payment_amount": 5000,
        "discount_amount": 500,
        "final_amount": 4500,
        "benefit_text": "신한카드 15% 할인"
    }

    Response:
    {
        "status": "success"
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        transaction_id = data.get('transaction_id')
        user_id = data.get('user_id')
        card_id = data.get('card_id')
        merchant_name = data.get('merchant_name')
        payment_amount = data.get('payment_amount')
        discount_amount = data.get('discount_amount')
        final_amount = data.get('final_amount')
        benefit_text = data.get('benefit_text')

        db = get_db()

        # 사용자 정보 업데이트 (월간 소비, 절약)
        user = db.scalars(select(User).where(User.user_id == user_id)).first()
        if user:
            user.monthly_spending += final_amount
            user.monthly_savings += discount_amount

        # 카드 정보 업데이트
        card = db.scalars(select(MyCard).where(MyCard.cid == card_id)).first()
        if card:
            today = date.today()

            # 일자가 바뀌면 daily_count 리셋
            if card.last_used_date != today:
                card.daily_count = 0

            # 월이 바뀌면 모든 카운터 리셋
            if card.reset_date is None or (today.month != card.reset_date.month or today.year != card.reset_date.year):
                card.used_amount = 0
                card.monthly_performance = 0
                card.monthly_count = 0
                card.reset_date = today.replace(day=1)

            # 사용 금액 및 실적 업데이트
            card.used_amount += final_amount  # 실제 사용 금액 (할인 적용 후)
            card.monthly_performance += payment_amount  # 실적 (할인 전 금액)
            card.daily_count += 1
            card.monthly_count += 1
            card.last_used_date = today

        # 결제 내역 저장
        payment = PaymentHistory(
            transaction_id=transaction_id,
            user_id=user_id,
            card_id=card_id,
            merchant_name=merchant_name,
            payment_amount=payment_amount,
            discount_amount=discount_amount,
            final_amount=final_amount,
            benefit_text=benefit_text
        )
        db.add(payment)
        db.commit()
        db.close()

        return jsonify({'status': 'success'}), 200

    except Exception as e:
        print(f"[Error] Webhook 처리 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Webhook 처리에 실패했습니다',
            'message': str(e)
        }), 500


@app.route('/api/card/limits', methods=['GET'])
@login_required
def get_card_limits():
    """
    카드별 한도 및 실적 조회 API

    Response:
    {
        "cards": [
            {
                "card_id": 1,
                "card_name": "신한카드 Deep Dream",
                "monthly_limit": 50000,
                "used_amount": 12500,
                "remaining": 37500,
                "monthly_performance": 320000,
                "pre_month_required": 300000,
                "is_eligible": true,
                "daily_count": 2,
                "monthly_count": 8
            }
        ]
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()

        cards = db.scalars(select(MyCard).where(MyCard.user_id == user_id)).all()

        cards_data = []
        for card in cards:
            # 한도 계산 (기본값 설정)
            monthly_limit = card.monthly_limit or 50000
            used_amount = card.used_amount or 0
            remaining = max(0, monthly_limit - used_amount)

            # 전월 실적 체크
            monthly_performance = card.monthly_performance or 0
            pre_month_required = card.mycard_pre_month_money or 300000
            is_eligible = monthly_performance >= pre_month_required

            cards_data.append({
                'card_id': card.cid,
                'card_name': card.mycard_name,
                'monthly_limit': monthly_limit,
                'used_amount': used_amount,
                'remaining': remaining,
                'monthly_performance': monthly_performance,
                'pre_month_required': pre_month_required,
                'is_eligible': is_eligible,
                'daily_count': card.daily_count or 0,
                'monthly_count': card.monthly_count or 0
            })

        db.close()

        return jsonify({
            'success': True,
            'cards': cards_data
        }), 200

    except Exception as e:
        print(f"[Error] 카드 한도 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': '카드 한도 조회에 실패했습니다',
            'message': str(e)
        }), 500


@app.route('/api/payment/recent', methods=['GET'])
@login_required
def get_recent_payment():
    """
    최근 결제 내역 조회 (결제 완료 알림용)

    Response:
    {
        "new_payment": true,
        "transaction_id": "uuid",
        "merchant_name": "스타벅스",
        "payment_amount": 5000,
        "discount_amount": 500,
        "final_amount": 4500,
        "benefit_text": "신한카드 15% 할인",
        "payment_date": "2024-01-01T12:00:00"
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()

        # 최근 5분 이내 결제 내역 조회
        five_minutes_ago = datetime.now().timestamp() - 300
        recent_payment = db.scalars(
            select(PaymentHistory)
            .where(PaymentHistory.user_id == user_id)
            .order_by(PaymentHistory.payment_date.desc())
            .limit(1)
        ).first()

        if recent_payment and recent_payment.payment_date.timestamp() > five_minutes_ago:
            return jsonify({
                'new_payment': True,
                'transaction_id': recent_payment.transaction_id,
                'merchant_name': recent_payment.merchant_name,
                'payment_amount': recent_payment.payment_amount,
                'discount_amount': recent_payment.discount_amount,
                'final_amount': recent_payment.final_amount,
                'benefit_text': recent_payment.benefit_text,
                'payment_date': recent_payment.payment_date.isoformat()
            }), 200

        db.close()

        return jsonify({'new_payment': False}), 200

    except Exception as e:
        print(f"[Error] 최근 결제 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': '최근 결제 조회에 실패했습니다',
            'message': str(e)
        }), 500


# ============ 법인카드 API ============

@app.route('/api/corporate/cards', methods=['GET'])
@login_required
def get_corporate_cards():
    """
    사용자가 소유한 법인카드 목록 조회
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()

        # 소유한 법인카드 조회
        cards = db.scalars(
            select(CorporateCard).where(CorporateCard.owner_user_id == user_id)
        ).all()

        cards_data = []
        for card in cards:
            # 부서 정보
            departments = []
            for dept in card.departments:
                member_count = len([m for m in card.members if m.department_id == dept.id])
                departments.append({
                    'id': dept.id,
                    'name': dept.name,
                    'monthly_limit': dept.monthly_limit,
                    'used_amount': dept.used_amount,
                    'color': dept.color,
                    'member_count': member_count
                })

            # 팀원 수
            total_members = len(card.members)
            active_members = len([m for m in card.members if m.status == 'active'])

            cards_data.append({
                'id': card.id,
                'card_name': card.card_name,
                'card_number': card.card_number,
                'card_company': card.card_company,
                'monthly_limit': card.monthly_limit,
                'used_amount': card.used_amount,
                'benefit_summary': card.benefit_summary,
                'is_active': card.is_active,
                'departments': departments,
                'total_members': total_members,
                'active_members': active_members
            })

        db.close()

        return jsonify({
            'success': True,
            'cards': cards_data
        }), 200

    except Exception as e:
        print(f"[Error] 법인카드 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/corporate/cards', methods=['POST'])
@login_required
def create_corporate_card():
    """
    법인카드 등록
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()

        card_name = data.get('card_name')
        card_number = data.get('card_number')
        card_company = data.get('card_company')
        monthly_limit = data.get('monthly_limit', 10000000)
        benefit_summary = data.get('benefit_summary', '')
        benefits_json = data.get('benefits_json', '{}')

        if not card_name:
            return jsonify({'success': False, 'error': 'card_name is required'}), 400

        db = get_db()

        # 법인카드 생성
        corporate_card = CorporateCard(
            card_name=card_name,
            card_number=card_number,
            card_company=card_company,
            owner_user_id=user_id,
            monthly_limit=monthly_limit,
            benefit_summary=benefit_summary,
            benefits_json=json.dumps(benefits_json) if isinstance(benefits_json, dict) else benefits_json
        )
        db.add(corporate_card)
        db.flush()

        # 소유자를 관리자로 자동 등록
        user = db.scalars(select(User).where(User.user_id == user_id)).first()
        owner_member = CorporateCardMember(
            corporate_card_id=corporate_card.id,
            user_id=user_id,
            invited_email=user.user_email,
            role='admin',
            monthly_limit=monthly_limit,
            status='active',
            joined_at=datetime.utcnow()
        )
        db.add(owner_member)
        db.commit()

        result = {
            'id': corporate_card.id,
            'card_name': corporate_card.card_name
        }
        db.close()

        return jsonify({'success': True, 'card': result}), 201

    except Exception as e:
        print(f"[Error] 법인카드 등록 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/corporate/cards/<int:card_id>/check-admin', methods=['GET'])
@login_required
def check_corporate_admin():
    """
    법인카드 관리자 권한 확인
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        card_id = request.view_args.get('card_id')
        db = get_db()

        # 법인카드 조회
        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == card_id)
        ).first()

        if not card:
            db.close()
            return jsonify({'success': False, 'error': 'Card not found'}), 404

        is_admin = card.owner_user_id == user_id
        db.close()

        return jsonify({
            'success': True,
            'is_admin': is_admin,
            'card_name': card.card_name
        }), 200

    except Exception as e:
        print(f"[Error] 관리자 권한 확인 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/corporate/is-admin', methods=['GET'])
@login_required
def check_is_corporate_admin():
    """
    현재 사용자가 법인카드 소유자인지 확인 (관리자 페이지 접근 권한)
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()

        # 소유한 법인카드가 있는지 확인
        card = db.scalars(
            select(CorporateCard).where(CorporateCard.owner_user_id == user_id)
        ).first()

        is_admin = card is not None
        db.close()

        return jsonify({
            'success': True,
            'is_admin': is_admin
        }), 200

    except Exception as e:
        print(f"[Error] 관리자 확인 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ============ 직원 초대 시스템 ============

@app.route('/api/corporate/cards/<int:card_id>/members', methods=['GET'])
@login_required
def get_corporate_members(card_id):
    """
    법인카드 팀원 목록 조회
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()

        # 권한 확인
        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == card_id)
        ).first()

        if not card or card.owner_user_id != user_id:
            db.close()
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403

        members_data = []
        for member in card.members:
            user_info = None
            if member.user:
                user_info = {
                    'user_id': member.user.user_id,
                    'user_name': member.user.user_name
                }

            dept_info = None
            if member.department:
                dept_info = {
                    'id': member.department.id,
                    'name': member.department.name
                }

            members_data.append({
                'id': member.id,
                'invited_email': member.invited_email,
                'role': member.role,
                'monthly_limit': member.monthly_limit,
                'used_amount': member.used_amount,
                'status': member.status,
                'invited_at': member.invited_at.isoformat() if member.invited_at else None,
                'joined_at': member.joined_at.isoformat() if member.joined_at else None,
                'user': user_info,
                'department': dept_info
            })

        db.close()

        return jsonify({
            'success': True,
            'members': members_data
        }), 200

    except Exception as e:
        print(f"[Error] 팀원 조회 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/corporate/cards/<int:card_id>/members', methods=['POST'])
@login_required
def invite_corporate_member(card_id):
    """
    이메일로 팀원 초대
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()

        invited_email = data.get('email')
        department_id = data.get('department_id')
        role = data.get('role', 'member')
        monthly_limit = data.get('monthly_limit', 500000)

        if not invited_email:
            return jsonify({'success': False, 'error': 'email is required'}), 400

        db = get_db()

        # 권한 확인
        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == card_id)
        ).first()

        if not card or card.owner_user_id != user_id:
            db.close()
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403

        # 이미 초대된 이메일인지 확인
        existing_member = db.scalars(
            select(CorporateCardMember).where(
                CorporateCardMember.corporate_card_id == card_id,
                CorporateCardMember.invited_email == invited_email
            )
        ).first()

        if existing_member:
            db.close()
            return jsonify({'success': False, 'error': 'Already invited'}), 400

        # 해당 이메일로 가입된 사용자 확인
        invited_user = db.scalars(
            select(User).where(User.user_email == invited_email)
        ).first()

        # 팀원 초대 생성
        member = CorporateCardMember(
            corporate_card_id=card_id,
            user_id=invited_user.user_id if invited_user else None,
            invited_email=invited_email,
            department_id=department_id,
            role=role,
            monthly_limit=monthly_limit,
            status='active' if invited_user else 'pending',
            joined_at=datetime.utcnow() if invited_user else None
        )
        db.add(member)
        db.commit()

        result = {
            'id': member.id,
            'invited_email': member.invited_email,
            'status': member.status
        }
        db.close()

        return jsonify({'success': True, 'member': result}), 201

    except Exception as e:
        print(f"[Error] 팀원 초대 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/corporate/cards/<int:card_id>/members/<int:member_id>', methods=['DELETE'])
@login_required
def remove_corporate_member(card_id, member_id):
    """
    팀원 제거
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()

        # 권한 확인
        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == card_id)
        ).first()

        if not card or card.owner_user_id != user_id:
            db.close()
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403

        # 팀원 조회 및 삭제
        member = db.scalars(
            select(CorporateCardMember).where(
                CorporateCardMember.id == member_id,
                CorporateCardMember.corporate_card_id == card_id
            )
        ).first()

        if not member:
            db.close()
            return jsonify({'success': False, 'error': 'Member not found'}), 404

        # 관리자 자신은 삭제 불가
        if member.role == 'admin' and member.user_id == user_id:
            db.close()
            return jsonify({'success': False, 'error': 'Cannot remove yourself'}), 400

        db.delete(member)
        db.commit()
        db.close()

        return jsonify({'success': True}), 200

    except Exception as e:
        print(f"[Error] 팀원 제거 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ============ 부서 관리 ============

@app.route('/api/corporate/cards/<int:card_id>/departments', methods=['GET'])
@login_required
def get_departments(card_id):
    """
    부서 목록 조회
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()

        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == card_id)
        ).first()

        if not card or card.owner_user_id != user_id:
            db.close()
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403

        departments_data = []
        for dept in card.departments:
            members = [m for m in card.members if m.department_id == dept.id]
            # Calculate benefit for this department's payments
            dept_payments = [p for p in card.payments if p.department_id == dept.id]
            dept_benefit = sum(p.benefit_amount for p in dept_payments)
            departments_data.append({
                'id': dept.id,
                'name': dept.name,
                'monthly_limit': dept.monthly_limit,
                'used_amount': dept.used_amount,
                'color': dept.color,
                'card_count': len(members),
                'member_count': len(members),
                'benefit': dept_benefit,
                'usage_percent': round((dept.used_amount / dept.monthly_limit) * 100, 1) if dept.monthly_limit > 0 else 0
            })

        db.close()

        return jsonify({
            'success': True,
            'departments': departments_data
        }), 200

    except Exception as e:
        print(f"[Error] 부서 조회 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/corporate/cards/<int:card_id>/departments', methods=['POST'])
@login_required
def create_department(card_id):
    """
    부서 생성
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()

        name = data.get('name')
        monthly_limit = data.get('monthly_limit', 2000000)
        color = data.get('color', '#4AA63C')

        if not name:
            return jsonify({'success': False, 'error': 'name is required'}), 400

        db = get_db()

        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == card_id)
        ).first()

        if not card or card.owner_user_id != user_id:
            db.close()
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403

        department = Department(
            corporate_card_id=card_id,
            name=name,
            monthly_limit=monthly_limit,
            color=color
        )
        db.add(department)
        db.commit()

        result = {
            'id': department.id,
            'name': department.name,
            'monthly_limit': department.monthly_limit,
            'color': department.color
        }
        db.close()

        return jsonify({'success': True, 'department': result}), 201

    except Exception as e:
        print(f"[Error] 부서 생성 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/corporate/cards/<int:card_id>/departments/<int:dept_id>', methods=['PUT'])
@login_required
def update_department(card_id, dept_id):
    """
    부서 수정
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()

        db = get_db()

        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == card_id)
        ).first()

        if not card or card.owner_user_id != user_id:
            db.close()
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403

        dept = db.scalars(
            select(Department).where(Department.id == dept_id, Department.corporate_card_id == card_id)
        ).first()

        if not dept:
            db.close()
            return jsonify({'success': False, 'error': 'Department not found'}), 404

        if 'name' in data:
            dept.name = data['name']
        if 'monthly_limit' in data:
            dept.monthly_limit = data['monthly_limit']
        if 'color' in data:
            dept.color = data['color']

        db.commit()
        db.close()

        return jsonify({'success': True}), 200

    except Exception as e:
        print(f"[Error] 부서 수정 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ============ 법인카드 결제 내역 동기화 ============

@app.route('/api/corporate/cards/<int:card_id>/payments', methods=['GET'])
@login_required
def get_corporate_payments(card_id):
    """
    법인카드 결제 내역 조회
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()

        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == card_id)
        ).first()

        if not card or card.owner_user_id != user_id:
            db.close()
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403

        payments_data = []
        for payment in card.payments:
            member_info = None
            if payment.member:
                member_info = {
                    'id': payment.member.id,
                    'email': payment.member.invited_email
                }

            user_info = None
            if payment.user:
                user_info = {
                    'user_id': payment.user.user_id,
                    'user_name': payment.user.user_name
                }

            payments_data.append({
                'id': payment.id,
                'transaction_id': payment.transaction_id,
                'merchant_name': payment.merchant_name,
                'merchant_category': payment.merchant_category,
                'payment_amount': payment.payment_amount,
                'discount_amount': payment.discount_amount,
                'final_amount': payment.final_amount,
                'benefit_text': payment.benefit_text,
                'payment_date': payment.payment_date.isoformat() if payment.payment_date else None,
                'member': member_info,
                'user': user_info
            })

        # 최신순 정렬
        payments_data.sort(key=lambda x: x['payment_date'] or '', reverse=True)

        db.close()

        return jsonify({
            'success': True,
            'payments': payments_data
        }), 200

    except Exception as e:
        print(f"[Error] 결제 내역 조회 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/corporate/payment/sync', methods=['POST'])
@login_required
def sync_corporate_payment():
    """
    직원 결제 시 법인카드 결제 내역 동기화
    개인 결제 시 법인카드 멤버십 확인 후 동기화
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()

        merchant_name = data.get('merchant_name')
        merchant_category = data.get('merchant_category', '')
        payment_amount = data.get('payment_amount')
        discount_amount = data.get('discount_amount', 0)
        final_amount = data.get('final_amount')
        benefit_text = data.get('benefit_text', '')

        if not merchant_name or not payment_amount:
            return jsonify({'success': False, 'error': 'merchant_name and payment_amount are required'}), 400

        db = get_db()

        # 사용자가 속한 법인카드 멤버십 확인
        memberships = db.scalars(
            select(CorporateCardMember).where(
                CorporateCardMember.user_id == user_id,
                CorporateCardMember.status == 'active'
            )
        ).all()

        if not memberships:
            db.close()
            return jsonify({'success': True, 'synced': False, 'message': 'No corporate membership'}), 200

        synced_count = 0
        for membership in memberships:
            # 법인카드 결제 내역 생성
            transaction_id = str(uuid.uuid4())
            payment = CorporatePaymentHistory(
                transaction_id=transaction_id,
                corporate_card_id=membership.corporate_card_id,
                member_id=membership.id,
                user_id=user_id,
                merchant_name=merchant_name,
                merchant_category=merchant_category,
                payment_amount=payment_amount,
                discount_amount=discount_amount,
                final_amount=final_amount,
                benefit_text=benefit_text,
                synced_at=datetime.utcnow()
            )
            db.add(payment)

            # 멤버 사용 금액 업데이트
            membership.used_amount += final_amount

            # 법인카드 사용 금액 업데이트
            corporate_card = db.scalars(
                select(CorporateCard).where(CorporateCard.id == membership.corporate_card_id)
            ).first()
            if corporate_card:
                corporate_card.used_amount += final_amount

            # 부서 사용 금액 업데이트 및 한도 경고 확인
            dept_name = None
            dept_usage_percent = 0
            if membership.department_id:
                dept = db.scalars(
                    select(Department).where(Department.id == membership.department_id)
                ).first()
                if dept:
                    dept.used_amount += final_amount
                    dept_name = dept.name
                    dept_usage_percent = (dept.used_amount / dept.monthly_limit) * 100 if dept.monthly_limit > 0 else 0

            synced_count += 1

            # WebSocket 브로드캐스트 - 결제 업데이트
            payment_data = {
                'merchant_name': merchant_name,
                'merchant_category': merchant_category,
                'payment_amount': payment_amount,
                'final_amount': final_amount,
                'discount_amount': discount_amount,
                'department': dept_name,
                'timestamp': datetime.utcnow().isoformat()
            }
            broadcast_payment_update(membership.corporate_card_id, payment_data)

            # 한도 경고 알림 (85% 이상)
            if dept_name and dept_usage_percent >= 85:
                broadcast_limit_alert(membership.corporate_card_id, dept_name, dept_usage_percent)

            # 대시보드 새로고침 요청
            broadcast_dashboard_refresh(membership.corporate_card_id)

        db.commit()
        db.close()

        return jsonify({
            'success': True,
            'synced': True,
            'synced_count': synced_count
        }), 200

    except Exception as e:
        print(f"[Error] 결제 동기화 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============ 관리자 대시보드 데이터 ============

@app.route('/api/corporate/dashboard/<int:card_id>', methods=['GET'])
@login_required
def get_corporate_dashboard(card_id):
    """
    법인카드 대시보드 데이터 조회 (실제 데이터)
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()

        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == card_id)
        ).first()

        if not card or card.owner_user_id != user_id:
            db.close()
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403

        # 통계 계산
        total_spent = card.used_amount
        total_benefit = sum(p.discount_amount or 0 for p in card.payments)
        active_cards = len([m for m in card.members if m.status == 'active'])
        total_departments = len(card.departments)

        # 혜택 발굴률 계산 (할인 받은 결제 / 전체 결제)
        total_payments = len(card.payments)
        discounted_payments = len([p for p in card.payments if p.discount_amount and p.discount_amount > 0])
        benefit_rate = round((discounted_payments / total_payments) * 100, 1) if total_payments > 0 else 0

        # 부서별 통계
        departments_stats = []
        for dept in card.departments:
            dept_members = [m for m in card.members if m.department_id == dept.id]
            dept_payments = [p for p in card.payments if p.member and p.member.department_id == dept.id]
            dept_benefit = sum(p.discount_amount or 0 for p in dept_payments)

            departments_stats.append({
                'id': dept.id,
                'name': dept.name,
                'card_count': len(dept_members),
                'monthly_limit': dept.monthly_limit,
                'used_amount': dept.used_amount,
                'usage_percent': round((dept.used_amount / dept.monthly_limit) * 100, 1) if dept.monthly_limit > 0 else 0,
                'benefit': dept_benefit,
                'color': dept.color
            })

        # 최근 알림 (한도 경고 등)
        alerts = []
        for dept in card.departments:
            usage_percent = (dept.used_amount / dept.monthly_limit) * 100 if dept.monthly_limit > 0 else 0
            if usage_percent >= 85:
                alerts.append({
                    'id': f'dept_{dept.id}',
                    'department': dept.name,
                    'message': f'법인카드 한도 {int(usage_percent)}% 사용',
                    'type': 'warning',
                    'time': '방금 전'
                })

        db.close()

        return jsonify({
            'success': True,
            'stats': {
                'total_spent': total_spent,
                'total_benefit': total_benefit,
                'active_cards': active_cards,
                'total_departments': total_departments,
                'benefit_rate': benefit_rate
            },
            'departments': departments_stats,
            'alerts': alerts[:5]  # 최근 5개만
        }), 200

    except Exception as e:
        print(f"[Error] 대시보드 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============ 영수증 OCR ============

@app.route('/api/ocr/receipt', methods=['POST'])
@login_required
def ocr_receipt():
    """
    영수증 OCR 처리
    """
    try:
        data = request.get_json()
        image_base64 = data.get('image')
        image_format = data.get('image_format', 'jpg')

        if not image_base64:
            return jsonify({'success': False, 'error': 'image is required'}), 400

        # OCR 서비스 호출 (기존 서비스 확장)
        ocr_result = ocr_service.extract_receipt_info(image_base64, image_format)

        return jsonify({
            'success': True,
            'receipt': ocr_result
        }), 200

    except Exception as e:
        print(f"[Error] 영수증 OCR 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============ WebSocket 이벤트 핸들러 ============

# 연결된 사용자들을 법인카드별로 관리
connected_users = {}

@socketio.on('connect')
def handle_connect():
    """
    클라이언트 연결 시 처리
    """
    print(f"[WebSocket] Client connected: {request.sid}")


@socketio.on('disconnect')
def handle_disconnect():
    """
    클라이언트 연결 해제 시 처리
    """
    print(f"[WebSocket] Client disconnected: {request.sid}")
    # 모든 룸에서 사용자 제거
    for card_id in list(connected_users.keys()):
        if request.sid in connected_users.get(card_id, []):
            connected_users[card_id].remove(request.sid)
            leave_room(f'corporate_card_{card_id}')


@socketio.on('join_dashboard')
def handle_join_dashboard(data):
    """
    대시보드 룸 참가 (법인카드별)
    """
    card_id = data.get('card_id')
    token = data.get('token')

    if not card_id or not token:
        emit('error', {'message': 'card_id and token are required'})
        return

    try:
        # 토큰 검증
        user_data = jwt_service.verify_token(token)
        user_id = user_data.get('user_id')

        # 법인카드 접근 권한 확인
        db = get_db()
        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == card_id)
        ).first()

        if not card or card.owner_user_id != user_id:
            db.close()
            emit('error', {'message': 'Unauthorized'})
            return

        db.close()

        # 룸 참가
        room = f'corporate_card_{card_id}'
        join_room(room)

        if card_id not in connected_users:
            connected_users[card_id] = []
        connected_users[card_id].append(request.sid)

        emit('joined', {'card_id': card_id, 'message': 'Successfully joined dashboard'})
        print(f"[WebSocket] User {user_id} joined room {room}")

    except Exception as e:
        print(f"[WebSocket] Join error: {e}")
        emit('error', {'message': str(e)})


@socketio.on('leave_dashboard')
def handle_leave_dashboard(data):
    """
    대시보드 룸 떠나기
    """
    card_id = data.get('card_id')
    if card_id:
        room = f'corporate_card_{card_id}'
        leave_room(room)
        if card_id in connected_users and request.sid in connected_users[card_id]:
            connected_users[card_id].remove(request.sid)
        emit('left', {'card_id': card_id})


def broadcast_payment_update(card_id: int, payment_data: dict):
    """
    결제 업데이트를 해당 법인카드 룸에 브로드캐스트
    """
    room = f'corporate_card_{card_id}'
    socketio.emit('payment_update', {
        'type': 'new_payment',
        'card_id': card_id,
        'payment': payment_data
    }, room=room)


def broadcast_limit_alert(card_id: int, department_name: str, usage_percent: float):
    """
    한도 경고 알림을 해당 법인카드 룸에 브로드캐스트
    """
    room = f'corporate_card_{card_id}'
    alert_type = 'danger' if usage_percent >= 95 else 'warning'
    socketio.emit('limit_alert', {
        'type': alert_type,
        'card_id': card_id,
        'department': department_name,
        'usage_percent': usage_percent,
        'message': f'{department_name} 부서 한도 {int(usage_percent)}% 사용'
    }, room=room)


def broadcast_dashboard_refresh(card_id: int):
    """
    대시보드 데이터 새로고침 요청을 브로드캐스트
    """
    room = f'corporate_card_{card_id}'
    socketio.emit('dashboard_refresh', {
        'card_id': card_id,
        'message': 'Dashboard data updated'
    }, room=room)


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5001))
    debug = os.getenv('FLASK_ENV') == 'development'

    # SocketIO로 실행
    socketio.run(app, host='0.0.0.0', port=port, debug=debug)
