import os
from flask import Flask, jsonify, request
from functools import wraps
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_migrate import Migrate
from dotenv import load_dotenv
from sqlalchemy import select, cast, String
from services.geocoding_service import GeocodingService
from services.benefit_lookup_service import BenefitLookupService
from services.location_service import LocationService
from services.directions_service import DirectionsService
from services.tmap_service import tmap_service
from services.ocr_service import NaverOCRService
from services.database import init_db, get_db, Base, DATABASE_URL
from services.database import User, Card, MyCard, CardBenefit, SavedCourse, SavedCourseUser, SharedCourse, PaymentHistory, QRScanStatus, Friendship, Notification
from services.database import CorporateCard, Department, CorporateCardMember, CorporatePaymentHistory
from services.database import Conversation, Message
from sqlalchemy import or_, and_, func, desc
import uuid
from services.jwt_service import JwtService
from utils.utils import parse_place_name
from pprint import pprint
import json
import qrcode
import barcode
from barcode.writer import ImageWriter
from io import BytesIO
import base64
import hmac
import hashlib
from datetime import datetime, date, timedelta, timezone

# 한국 시간대 (KST = UTC+9)
KST = timezone(timedelta(hours=9))

def get_kst_now():
    """현재 한국 시간 반환 (naive datetime)"""
    return datetime.now(KST).replace(tzinfo=None)

def timestamp_to_kst(ts):
    """Unix timestamp를 한국 시간 datetime으로 변환 (naive)"""
    return datetime.fromtimestamp(ts, tz=KST).replace(tzinfo=None)

load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Flask-Migrate 설정
migrate = Migrate(app, Base, render_as_batch=True)

geocoding_service = GeocodingService()
benefit_service = BenefitLookupService()
location_service = LocationService()
directions_service = DirectionsService()
ocr_service = NaverOCRService()
jwt_service = JwtService()
# 데이터베이스 초기화 (마이그레이션 후 초기 데이터 시딩)
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
                return jsonify({'error': 'invalid_token'}), 401
            if result.get('error') == 'token_expired':
                return jsonify({'error': 'token_expired', 'message': '토큰이 만료되었습니다. 다시 로그인해주세요.'}), 401
            if result.get('error') == 'invalid_token':
                return jsonify({'error': 'invalid_token', 'message': '유효하지 않은 토큰입니다.'}), 401
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

        # 법인카드 pending 초대 자동 활성화
        pending_memberships = db.scalars(
            select(CorporateCardMember).where(
                CorporateCardMember.invited_email == user_email,
                CorporateCardMember.status == 'pending'
            )
        ).all()

        for membership in pending_memberships:
            membership.user_id = user_id
            membership.status = 'active'
            membership.joined_at = datetime.utcnow()

            # 법인카드 정보 조회하여 알림 생성
            corp_card = db.scalars(
                select(CorporateCard).where(CorporateCard.id == membership.corporate_card_id)
            ).first()

            if corp_card:
                notification = Notification(
                    user_id=user_id,
                    type='corporate_card',
                    title='법인카드 등록 완료',
                    message=f'{corp_card.card_name} 법인카드가 등록되었습니다.',
                    data=json.dumps({
                        'card_id': corp_card.id,
                        'card_name': corp_card.card_name,
                        'monthly_limit': membership.monthly_limit
                    }, ensure_ascii=False)
                )
                db.add(notification)

        if pending_memberships:
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

@app.route('/api/user/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current user info"""
    token = request.headers['Authorization'].split(' ')[1]
    user_info = jwt_service.verify_token(token)
    if not user_info:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user_id = user_info.get('user_id')
    try:
        db = get_db()
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        return jsonify({
            'success': True,
            'user': {
                'id': user.user_id,
                'name': user.user_name,
                'email': user.user_email,
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
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
            'balance': user.balance or 0,
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

        # 법인카드 멤버 여부 확인 및 법인카드 정보 추가
        corporate_memberships = db.scalars(
            select(CorporateCardMember).where(
                CorporateCardMember.user_id == user_id,
                CorporateCardMember.status == 'active'
            )
        ).all()

        # 소유자(관리자)로서 보유한 법인카드도 확인
        owned_corporate_cards = db.scalars(
            select(CorporateCard).where(CorporateCard.owner_user_id == user_id)
        ).all()

        user_data['is_corporate_user'] = len(corporate_memberships) > 0 or len(owned_corporate_cards) > 0

        # 법인카드 정보를 cards 배열에 추가 (is_corporate 플래그로 구분)
        user_data['corporate_cards'] = []
        added_card_ids = set()  # 중복 방지용

        # 1. 소유자(관리자)로서 보유한 법인카드 추가
        for corp_card in owned_corporate_cards:
            added_card_ids.add(corp_card.id)
            user_data['corporate_cards'].append({
                'cid': f"corp_{corp_card.id}",
                'card_id': corp_card.id,
                'card_name': corp_card.card_name,
                'card_company': corp_card.card_company,
                'card_benefit': corp_card.benefit_summary,
                'is_corporate': True,
                'role': 'admin',
                'department': None,
                'monthly_limit': corp_card.monthly_limit,
                'used_amount': corp_card.used_amount,
                'remaining': corp_card.monthly_limit - corp_card.used_amount,
                'card_monthly_limit': corp_card.monthly_limit,
                'card_used_amount': corp_card.used_amount
            })

        # 2. 멤버(직원)로서 등록된 법인카드 추가 (소유자로 이미 추가된 카드는 제외)
        for membership in corporate_memberships:
            if membership.corporate_card_id in added_card_ids:
                continue  # 이미 소유자로 추가된 카드는 스킵
            corp_card = db.scalars(
                select(CorporateCard).where(CorporateCard.id == membership.corporate_card_id)
            ).first()
            if corp_card:
                # 부서 정보 조회
                dept_name = None
                if membership.department_id:
                    dept = db.scalars(
                        select(Department).where(Department.id == membership.department_id)
                    ).first()
                    if dept:
                        dept_name = dept.name

                user_data['corporate_cards'].append({
                    'cid': f"corp_{corp_card.id}",  # 일반 카드와 구분을 위해 prefix 추가
                    'card_id': corp_card.id,
                    'card_name': corp_card.card_name,
                    'card_company': corp_card.card_company,
                    'card_benefit': corp_card.benefit_summary,
                    'is_corporate': True,
                    'role': membership.role,
                    'department': dept_name,
                    'monthly_limit': membership.monthly_limit,
                    'used_amount': membership.used_amount,
                    'remaining': membership.monthly_limit - membership.used_amount,
                    'card_monthly_limit': corp_card.monthly_limit,
                    'card_used_amount': corp_card.used_amount
                })

        return jsonify({'success':True, 'msg': 'mypage', 'user':user_data}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success':False, 'error': str(e)}), 500
    finally:
        db.close()


# ==================== 잔액 관리 API ====================

@app.route('/api/balance', methods=['GET'])
@login_required
def get_balance():
    """사용자 잔액 조회"""
    token = request.headers['Authorization'].split(' ')[1]
    user_info = jwt_service.verify_token(token)
    if not user_info:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user_id = user_info.get('user_id')
    try:
        db = get_db()
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        return jsonify({
            'success': True,
            'balance': user.balance or 0
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/balance/charge', methods=['POST'])
@login_required
def charge_balance():
    """잔액 충전 (가상)"""
    token = request.headers['Authorization'].split(' ')[1]
    user_info = jwt_service.verify_token(token)
    if not user_info:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user_id = user_info.get('user_id')
    data = request.get_json()
    amount = data.get('amount', 0)

    if amount <= 0:
        return jsonify({'success': False, 'error': 'Amount must be positive'}), 400

    if amount > 10000000:  # 최대 1000만원 제한
        return jsonify({'success': False, 'error': 'Maximum charge amount is 10,000,000 won'}), 400

    try:
        db = get_db()
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        user.balance = (user.balance or 0) + amount
        db.commit()

        return jsonify({
            'success': True,
            'message': f'{amount:,}원이 충전되었습니다.',
            'balance': user.balance
        })
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/balance/check', methods=['POST'])
@login_required
def check_balance():
    """결제 전 잔액 확인"""
    token = request.headers['Authorization'].split(' ')[1]
    user_info = jwt_service.verify_token(token)
    if not user_info:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user_id = user_info.get('user_id')
    data = request.get_json()
    amount = data.get('amount', 0)

    try:
        db = get_db()
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        current_balance = user.balance or 0
        has_sufficient = current_balance >= amount

        return jsonify({
            'success': True,
            'sufficient': has_sufficient,
            'balance': current_balance,
            'required': amount,
            'shortage': max(0, amount - current_balance)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/balance/deduct', methods=['POST'])
@login_required
def deduct_balance():
    """잔액 차감 (결제 시)"""
    token = request.headers['Authorization'].split(' ')[1]
    user_info = jwt_service.verify_token(token)
    if not user_info:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user_id = user_info.get('user_id')
    data = request.get_json()
    amount = data.get('amount', 0)
    description = data.get('description', '')

    if amount <= 0:
        return jsonify({'success': False, 'error': 'Amount must be positive'}), 400

    try:
        db = get_db()
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        current_balance = user.balance or 0
        if current_balance < amount:
            return jsonify({
                'success': False,
                'error': 'insufficient_balance',
                'message': '잔액이 부족합니다.',
                'balance': current_balance,
                'required': amount,
                'shortage': amount - current_balance
            }), 400

        user.balance = current_balance - amount
        db.commit()

        return jsonify({
            'success': True,
            'message': f'{amount:,}원이 결제되었습니다.',
            'balance': user.balance,
            'deducted': amount
        })
    except Exception as e:
        db.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500
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


@app.route('/api/search-autocomplete', methods=['GET'])
def search_autocomplete():
    """
    Search autocomplete using Google Places API
    Returns multiple results for user selection
    """
    query = request.args.get('query')
    latitude = request.args.get('latitude', type=float)
    longitude = request.args.get('longitude', type=float)
    limit = request.args.get('limit', 10, type=int)

    if not query or len(query) < 2:
        return jsonify({'results': []}), 200

    try:
        import requests as req

        # Use Google Places Autocomplete API
        params = {
            'input': query,
            'key': os.getenv('GOOGLE_MAPS_API_KEY'),
            'language': 'ko',
            'components': 'country:kr',
        }

        # Add location bias if available
        if latitude is not None and longitude is not None:
            params['location'] = f'{latitude},{longitude}'
            params['radius'] = 50000  # 50km bias

        response = req.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', params=params)
        response.raise_for_status()
        data = response.json()
        predictions = data.get('predictions', [])[:limit]

        results = []
        for pred in predictions:
            # Get place details for coordinates
            place_id = pred.get('place_id')
            if place_id:
                detail_params = {
                    'place_id': place_id,
                    'fields': 'geometry,name,formatted_address,types',
                    'key': os.getenv('GOOGLE_MAPS_API_KEY'),
                    'language': 'ko',
                }
                detail_response = req.get('https://maps.googleapis.com/maps/api/place/details/json', params=detail_params)
                detail_data = detail_response.json()
                place = detail_data.get('result', {})

                if place.get('geometry'):
                    location = place['geometry']['location']
                    results.append({
                        'place_id': place_id,
                        'name': place.get('name', pred.get('structured_formatting', {}).get('main_text', '')),
                        'address': place.get('formatted_address', pred.get('description', '')),
                        'latitude': location['lat'],
                        'longitude': location['lng'],
                        'types': place.get('types', []),
                    })

        return jsonify({'results': results}), 200

    except Exception as e:
        print(f"Autocomplete error: {e}")
        return jsonify({'error': 'Autocomplete failed', 'results': []}), 500


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


@app.route('/api/place/details', methods=['GET'])
def get_place_details():
    """
    Get detailed information about a place

    Query params:
        place_id: Google Place ID

    Response:
    {
        'place_id': str,
        'name': str,
        'address': str,
        'phone': str,
        'website': str,
        'rating': float,
        'user_ratings_total': int,
        'opening_hours': {
            'open_now': bool,
            'weekday_text': List[str]
        },
        'photos': List[str],
        'price_level': int,
        'types': List[str]
    }
    """
    place_id = request.args.get('place_id')

    if not place_id:
        return jsonify({'error': 'place_id is required'}), 400

    details = location_service.get_place_details(place_id)

    if not details:
        return jsonify({'error': 'Failed to get place details'}), 404

    return jsonify(details), 200


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


@app.route('/api/course/<int:course_id>', methods=['GET'])
@login_required
def get_course_by_id(course_id):
    """
    단일 코스 조회 API

    Path params:
        - course_id: 코스 ID

    Response:
    {
        "success": true,
        "course": {
            "id": 1,
            "title": "...",
            "description": "...",
            "stops": [...],
            ...
        }
    }
    """
    user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')

    try:
        db = get_db()

        course = db.scalar(
            select(SavedCourse)
            .where(SavedCourse.id == course_id)
        )

        if not course:
            return jsonify({
                'success': False,
                'error': '코스를 찾을 수 없습니다'
            }), 404

        # Check if user has access to this course (owner, saved, or shared)
        is_owner = course.user_id == user_id
        is_saved = db.scalar(
            select(SavedCourseUser)
            .where(SavedCourseUser.course_id == course_id)
            .where(SavedCourseUser.user_id == user_id)
        ) is not None
        is_shared = db.scalar(
            select(SharedCourse)
            .where(SharedCourse.course_id == course_id)
            .where(SharedCourse.shared_to == user_id)
        ) is not None

        if not (is_owner or is_saved or is_shared):
            return jsonify({
                'success': False,
                'error': '이 코스에 접근할 권한이 없습니다'
            }), 403

        course_data = {
            'id': str(course.id),
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
            'is_saved_by_user': is_saved or is_owner
        }

        return jsonify({
            'success': True,
            'course': course_data
        }), 200

    except Exception as e:
        print(f"[Error] 코스 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': '코스 조회에 실패했습니다',
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


@app.route('/api/course/share', methods=['POST'])
@login_required
def share_course():
    """
    코스 공유 API

    Request:
    {
        "course_id": "1",
        "friend_ids": ["friend1", "friend2"]
    }

    Response:
    {
        "success": true,
        "message": "코스를 공유했습니다"
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()

        course_id = data.get('course_id')
        friend_ids = data.get('friend_ids', [])

        if not course_id:
            return jsonify({'success': False, 'error': 'course_id is required'}), 400

        if not friend_ids:
            return jsonify({'success': False, 'error': 'friend_ids is required'}), 400

        db = get_db()

        # 코스 존재 확인
        course = db.scalars(select(SavedCourse).where(SavedCourse.id == course_id)).first()
        if not course:
            db.close()
            return jsonify({'success': False, 'error': '코스를 찾을 수 없습니다'}), 404

        # 본인 코스인지 확인
        if course.user_id != user_id:
            db.close()
            return jsonify({'success': False, 'error': '본인의 코스만 공유할 수 있습니다'}), 403

        shared_count = 0
        for friend_id in friend_ids:
            # 친구 관계 확인
            friendship = db.scalars(
                select(Friendship).where(
                    ((Friendship.user_id == user_id) & (Friendship.friend_id == friend_id)) |
                    ((Friendship.user_id == friend_id) & (Friendship.friend_id == user_id)),
                    Friendship.status == 'accepted'
                )
            ).first()

            if not friendship:
                continue  # 친구가 아니면 건너뛰기

            # 이미 공유했는지 확인
            existing = db.scalars(
                select(SharedCourse).where(
                    SharedCourse.course_id == course_id,
                    SharedCourse.shared_by == user_id,
                    SharedCourse.shared_to == friend_id
                )
            ).first()

            if existing:
                continue  # 이미 공유했으면 건너뛰기

            # 공유 생성
            shared = SharedCourse(
                course_id=course_id,
                shared_by=user_id,
                shared_to=friend_id
            )
            db.add(shared)
            shared_count += 1

        db.commit()
        db.close()

        return jsonify({
            'success': True,
            'message': f'{shared_count}명에게 코스를 공유했습니다'
        }), 200

    except Exception as e:
        print(f"[Error] 코스 공유 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/course/shared', methods=['GET'])
@login_required
def get_shared_courses():
    """
    공유받은 코스 조회 API

    Query params:
        - limit: 최대 결과 개수 (기본: 10)

    Response:
    {
        "success": true,
        "courses": [
            {
                "id": 1,
                "title": "코스 제목",
                "description": "코스 설명",
                "stops": [...],
                "shared_by": {
                    "user_id": "friend1",
                    "user_name": "친구이름"
                },
                "shared_at": "2024-01-01T12:00:00"
            }
        ]
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        limit = request.args.get('limit', 10, type=int)

        db = get_db()

        # 공유받은 코스 가져오기
        shared_courses = db.scalars(
            select(SharedCourse)
            .where(SharedCourse.shared_to == user_id)
            .order_by(SharedCourse.shared_at.desc())
            .limit(limit)
        ).all()

        courses_data = []
        for shared in shared_courses:
            course = shared.course
            sender = shared.sender

            if course:
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
                    'shared_by': {
                        'user_id': sender.user_id if sender else None,
                        'user_name': sender.user_name if sender else None
                    },
                    'shared_at': shared.shared_at.isoformat() if shared.shared_at else None
                })

        db.close()

        return jsonify({
            'success': True,
            'courses': courses_data
        }), 200

    except Exception as e:
        print(f"[Error] 공유받은 코스 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


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


@app.route('/api/route/detail', methods=['POST'])
def get_route_detail():
    """
    Get detailed route with turn-by-turn navigation and transit info

    Request:
    {
        "start": {"latitude": 37.xxx, "longitude": 127.xxx},
        "end": {"latitude": 37.xxx, "longitude": 127.xxx},
        "mode": "driving" | "walking" | "transit"
    }

    Response:
    {
        "success": true,
        "route": {
            "summary": {...},
            "steps": [...],
            "polyline": str,
            "itineraries": [...]  // for transit
        }
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Request body required'}), 400

        start = data.get('start')
        end = data.get('end')
        mode = data.get('mode', 'driving')

        if not start or not end:
            return jsonify({'success': False, 'error': 'start and end required'}), 400

        print(f"[Route Detail] Mode: {mode}")

        if mode == 'driving':
            result = tmap_service.get_driving_route(start, end)
        elif mode == 'walking':
            result = tmap_service.get_pedestrian_route(start, end)
        elif mode == 'transit':
            result = tmap_service.get_transit_route(start, end)
        else:
            return jsonify({'success': False, 'error': f'Invalid mode: {mode}'}), 400

        if not result:
            return jsonify({
                'success': False,
                'error': 'Failed to get route'
            }), 500

        # Check for transit-specific errors
        if isinstance(result, dict) and result.get('error'):
            print(f"[Route Detail] Transit error: {result.get('error')}")
            # Still return success but with error info for frontend to handle
            return jsonify({
                'success': True,
                'route': result,
                'warning': result.get('error')
            }), 200

        return jsonify({
            'success': True,
            'route': result
        }), 200

    except Exception as e:
        print(f"[Error] Route Detail API: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
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

        # 법인카드인지 개인카드인지 확인
        is_corporate = isinstance(card_id, str) and card_id.startswith('corp_')

        if is_corporate:
            # 법인카드 처리
            try:
                corporate_card_id = int(card_id.replace('corp_', ''))
            except ValueError:
                return jsonify({'error': 'Invalid corporate card ID format'}), 400

            # 법인카드 조회
            corp_card = db.scalars(
                select(CorporateCard).where(CorporateCard.id == corporate_card_id)
            ).first()
            if not corp_card:
                return jsonify({'error': 'Corporate card not found'}), 404

            # 사용자가 해당 법인카드의 멤버인지 확인
            membership = db.scalars(
                select(CorporateCardMember).where(
                    CorporateCardMember.corporate_card_id == corporate_card_id,
                    CorporateCardMember.user_id == user_id,
                    CorporateCardMember.status == 'active'
                )
            ).first()
            if not membership:
                return jsonify({'error': 'You are not a member of this corporate card'}), 403

            card_cid = corporate_card_id  # Use integer ID for database storage
            card_name = corp_card.card_name
        else:
            # 개인카드 처리
            card = db.scalars(select(MyCard).where(MyCard.cid == card_id, MyCard.user_id == user_id)).first()
            if not card:
                return jsonify({'error': 'Card not found'}), 404

            card_cid = card.cid
            card_name = card.mycard_name

        # QR 데이터 생성
        timestamp = int(datetime.now().timestamp())
        qr_data = {
            "user_id": user_id,
            "user_name": user.user_name,
            "card_id": card_cid,
            "card_name": card_name,
            "is_corporate": is_corporate,
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
            card_id=card_cid,
            is_corporate=is_corporate,
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

        # 바코드 이미지 생성 (Code128 포맷)
        # 바코드 데이터: 짧은 숫자 기반 코드 (12자리) - 스캔 용이성을 위해
        # timestamp 마지막 8자리 + card_id 4자리 (0패딩)
        # 법인카드의 경우 corporate_card_id를 사용
        if is_corporate:
            barcode_card_id = str(corporate_card_id).zfill(4)
        else:
            barcode_card_id = str(card_cid).zfill(4)
        barcode_data = f"{str(timestamp)[-8:]}{barcode_card_id}"
        print(f">>> [QR Generate] user_id: {user_id}, card_cid: {card_cid}, is_corporate: {is_corporate}")
        print(f">>> [QR Generate] barcode_card_id: {barcode_card_id}, barcode_data: {barcode_data}, length: {len(barcode_data)}")
        code128 = barcode.get('code128', barcode_data, writer=ImageWriter())
        barcode_buffered = BytesIO()
        code128.write(barcode_buffered, options={
            'module_width': 0.4,
            'module_height': 15,
            'font_size': 10,
            'text_distance': 5,
            'quiet_zone': 6.5
        })
        barcode_buffered.seek(0)
        barcode_str = base64.b64encode(barcode_buffered.getvalue()).decode()
        barcode_image = f"data:image/png;base64,{barcode_str}"

        db.close()

        return jsonify({
            'success': True,
            'qr_image': qr_image,
            'barcode_image': barcode_image,
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

        # 타임아웃 체크 (60초) - KST 기준
        if qr_status.status in ['waiting', 'scanned'] and \
           (get_kst_now() - qr_status.created_at).seconds > 60:
            qr_status.status = 'failed'
            db.commit()

        response = {
            'status': qr_status.status,
        }

        if qr_status.merchant_name:
            response['merchant_name'] = qr_status.merchant_name

        if qr_status.scanned_at:
            response['scanned_at'] = qr_status.scanned_at.isoformat()

        print(f">>> [QR Status] id={qr_status.id}, user={user_id}, ts={timestamp_int}, status={qr_status.status}")

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


@app.route('/api/balance/check-for-admin', methods=['POST'])
@require_admin_auth
def check_balance_for_admin():
    """관리자 백엔드에서 호출하는 잔액 확인 API"""
    data = request.get_json()
    user_id = data.get('user_id')
    amount = data.get('amount', 0)

    if not user_id:
        return jsonify({'success': False, 'error': 'user_id is required'}), 400

    try:
        db = get_db()
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        current_balance = user.balance or 0
        has_sufficient = current_balance >= amount

        return jsonify({
            'success': True,
            'sufficient': has_sufficient,
            'balance': current_balance,
            'required': amount,
            'shortage': max(0, amount - current_balance)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/payment/failure', methods=['POST'])
@require_admin_auth
def payment_failure():
    """
    결제 실패 알림 API (관리자 백엔드가 호출)

    Request:
    {
        "user_id": "hong_gildong",
        "reason": "insufficient_balance",
        "balance": 5000,
        "required": 10000,
        "merchant_name": "스타벅스"
    }
    """
    data = request.get_json()
    user_id = data.get('user_id')
    reason = data.get('reason', 'unknown')
    balance = data.get('balance', 0)
    required = data.get('required', 0)
    merchant_name = data.get('merchant_name', 'Unknown')

    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400

    try:
        db = get_db()

        # 결제 실패 알림 메시지 생성
        if reason == 'insufficient_balance':
            shortage = required - balance
            title = '결제 실패'
            message = f'{merchant_name}에서 결제 실패: 잔액 부족 (부족 금액: {shortage:,}원)'
        elif reason == 'card_limit_exceeded':
            title = '결제 실패'
            message = f'{merchant_name}에서 결제 실패: 카드 한도 초과'
        else:
            title = '결제 실패'
            message = f'{merchant_name}에서 결제 실패'

        # 알림 생성
        notification = Notification(
            user_id=user_id,
            type='payment_failure',
            title=title,
            message=message,
            data=json.dumps({
                'reason': reason,
                'balance': balance,
                'required': required,
                'shortage': required - balance if reason == 'insufficient_balance' else 0,
                'merchant_name': merchant_name
            }, ensure_ascii=False)
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        # 실시간 알림 전송
        notification_data = {
            'id': notification.id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'data': json.loads(notification.data),
            'is_read': notification.is_read,
            'created_at': notification.created_at.isoformat()
        }
        broadcast_notification(user_id, notification_data)

        db.close()

        return jsonify({'status': 'success'}), 200

    except Exception as e:
        print(f">>> Payment failure notification error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/corporate/check-limit', methods=['POST'])
@require_admin_auth
def check_corporate_card_limit():
    """
    법인카드 한도 확인 API (관리자 백엔드가 호출)

    Request:
    {
        "user_id": "hong_gildong",
        "card_id": 1,
        "amount": 50000
    }

    Response:
    {
        "success": true,
        "sufficient": true/false,
        "member_limit": 500000,
        "member_used": 100000,
        "member_remaining": 400000,
        "department_limit": 2000000,
        "department_used": 500000,
        "card_limit": 10000000,
        "card_used": 2000000
    }
    """
    data = request.get_json()
    user_id = data.get('user_id')
    card_id = data.get('card_id')
    amount = data.get('amount', 0)

    if not user_id or not card_id:
        return jsonify({'success': False, 'error': 'user_id and card_id are required'}), 400

    try:
        db = get_db()

        # 사용자의 법인카드 멤버십 조회
        membership = db.scalars(
            select(CorporateCardMember).where(
                CorporateCardMember.user_id == user_id,
                CorporateCardMember.corporate_card_id == card_id,
                CorporateCardMember.status == 'active'
            )
        ).first()

        if not membership:
            return jsonify({
                'success': False,
                'error': 'Not a member of this corporate card'
            }), 404

        # 법인카드 정보 조회
        corporate_card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == card_id)
        ).first()

        if not corporate_card:
            return jsonify({'success': False, 'error': 'Corporate card not found'}), 404

        # 한도 체크
        member_remaining = membership.monthly_limit - membership.used_amount
        card_remaining = corporate_card.monthly_limit - corporate_card.used_amount

        # 부서 한도 체크
        dept_limit = None
        dept_used = None
        dept_remaining = None
        if membership.department_id:
            dept = db.scalars(
                select(Department).where(Department.id == membership.department_id)
            ).first()
            if dept:
                dept_limit = dept.monthly_limit
                dept_used = dept.used_amount
                dept_remaining = dept.monthly_limit - dept.used_amount

        # 한도 초과 체크 (개인, 부서, 카드 전체)
        is_sufficient = True
        exceeded_type = None

        if amount > member_remaining:
            is_sufficient = False
            exceeded_type = 'member'
        elif dept_remaining is not None and amount > dept_remaining:
            is_sufficient = False
            exceeded_type = 'department'
        elif amount > card_remaining:
            is_sufficient = False
            exceeded_type = 'card'

        return jsonify({
            'success': True,
            'sufficient': is_sufficient,
            'exceeded_type': exceeded_type,
            'member_limit': membership.monthly_limit,
            'member_used': membership.used_amount,
            'member_remaining': member_remaining,
            'department_limit': dept_limit,
            'department_used': dept_used,
            'department_remaining': dept_remaining,
            'card_limit': corporate_card.monthly_limit,
            'card_used': corporate_card.used_amount,
            'card_remaining': card_remaining
        })

    except Exception as e:
        print(f">>> Corporate limit check error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/barcode/lookup', methods=['POST'])
@require_admin_auth
def lookup_barcode():
    """
    바코드로 결제 정보 조회 API (관리자 백엔드가 호출)

    Request:
    {
        "barcode_data": "649477060002"  // 12자리 숫자
    }

    Response:
    {
        "success": true,
        "qr_data": "{...}"  // QR과 동일한 JSON 문자열
    }
    """
    try:
        data = request.get_json()
        barcode_data = data.get('barcode_data', '')

        print(f">>> [Barcode Lookup] Received barcode: {barcode_data}, length: {len(barcode_data)}")

        # 바코드 파싱 (12자리: timestamp 마지막 8자리 + card_id 4자리)
        if len(barcode_data) != 12 or not barcode_data.isdigit():
            print(f">>> [Barcode Lookup] Invalid format - length: {len(barcode_data)}, isdigit: {barcode_data.isdigit()}")
            return jsonify({'success': False, 'error': 'Invalid barcode format'}), 400

        timestamp_suffix = barcode_data[:8]  # 처음 8자리 = timestamp 마지막 8자리
        card_id = int(barcode_data[8:])  # 마지막 4자리 = card_id

        print(f">>> [Barcode Lookup] Parsed - timestamp_suffix: {timestamp_suffix}, card_id: {card_id}")

        db = get_db()

        # QRScanStatus에서 매칭되는 레코드 찾기
        # waiting 또는 failed 상태 모두 허용 (failed 후 바코드로 재시도 가능)
        qr_status = db.scalars(
            select(QRScanStatus).where(
                cast(QRScanStatus.timestamp, String).like(f'%{timestamp_suffix}'),
                QRScanStatus.card_id == card_id,
                QRScanStatus.status.in_(['waiting', 'failed', 'scanned'])  # 대기/실패/스캔됨 상태
            ).order_by(QRScanStatus.created_at.desc())
        ).first()

        print(f">>> [Barcode Lookup] QRScanStatus found: {qr_status is not None}")
        if qr_status:
            print(f">>> [Barcode Lookup] QRScanStatus - user_id: {qr_status.user_id}, card_id: {qr_status.card_id}, timestamp: {qr_status.timestamp}")

        if not qr_status:
            # 디버그: 모든 waiting 상태의 QRScanStatus 조회
            all_waiting = db.scalars(
                select(QRScanStatus).where(QRScanStatus.status == 'waiting').order_by(QRScanStatus.created_at.desc()).limit(5)
            ).all()
            print(f">>> [Barcode Lookup] Recent waiting QRScanStatus records:")
            for qs in all_waiting:
                print(f">>>   - user_id: {qs.user_id}, card_id: {qs.card_id}, timestamp: {qs.timestamp}, is_corporate: {qs.is_corporate}")
            db.close()
            return jsonify({'success': False, 'error': 'Barcode not found or expired'}), 404

        # 사용자 정보 조회
        user = db.scalars(select(User).where(User.user_id == qr_status.user_id)).first()
        if not user:
            db.close()
            return jsonify({'success': False, 'error': 'User not found'}), 404

        # 법인카드/개인카드에 따라 조회
        is_corporate = qr_status.is_corporate if hasattr(qr_status, 'is_corporate') and qr_status.is_corporate else False

        if is_corporate:
            # 법인카드 조회
            corp_card = db.scalars(select(CorporateCard).where(CorporateCard.id == qr_status.card_id)).first()
            if not corp_card:
                db.close()
                return jsonify({'success': False, 'error': 'Corporate card not found'}), 404
            card_name = corp_card.card_name
        else:
            # 개인카드 조회
            card = db.scalars(select(MyCard).where(MyCard.cid == qr_status.card_id)).first()
            if not card:
                db.close()
                return jsonify({'success': False, 'error': 'Card not found'}), 404
            card_name = card.mycard_name

        # QR 데이터 재생성 (QR과 동일한 형식)
        qr_data = {
            "user_id": qr_status.user_id,
            "user_name": user.user_name,
            "card_id": qr_status.card_id,
            "card_name": card_name,
            "is_corporate": is_corporate,
            "timestamp": qr_status.timestamp
        }

        # 서명 생성
        jwt_secret = os.getenv('JWT_SECRET', 'default-secret')
        signature = hmac.new(
            jwt_secret.encode(),
            json.dumps(qr_data, sort_keys=True).encode(),
            hashlib.sha256
        ).hexdigest()
        qr_data["signature"] = signature

        db.close()

        return jsonify({
            'success': True,
            'qr_data': json.dumps(qr_data)
        }), 200

    except Exception as e:
        print(f"[Error] 바코드 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


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

        # timestamp를 int로 변환
        try:
            timestamp_int = int(timestamp)
        except (ValueError, TypeError):
            return jsonify({'error': 'invalid timestamp format'}), 400

        db = get_db()

        # QR 스캔 상태 조회 (GET 엔드포인트와 동일하게 order_by 사용)
        qr_status = db.scalars(
            select(QRScanStatus).where(
                QRScanStatus.user_id == user_id,
                QRScanStatus.timestamp == timestamp_int
            ).order_by(QRScanStatus.created_at.desc())
        ).first()

        if not qr_status:
            db.close()
            print(f">>> [QR Update] NOT FOUND - user {user_id}, timestamp {timestamp_int}")
            return jsonify({'error': 'QR not found'}), 404

        # 상태 업데이트
        old_status = qr_status.status
        record_id = qr_status.id
        print(f">>> [QR Update] BEFORE - id={record_id}, user={user_id}, ts={timestamp_int}, status={old_status}")

        qr_status.status = status
        if merchant_name:
            qr_status.merchant_name = merchant_name
        if status == 'scanned' and not qr_status.scanned_at:
            qr_status.scanned_at = get_kst_now()

        db.commit()

        # 커밋 후 확인
        db.refresh(qr_status)
        print(f">>> [QR Update] AFTER COMMIT - id={record_id}, status={qr_status.status} (expected: {status})")

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
        is_corporate = data.get('is_corporate', False)

        db = get_db()

        # 사용자 정보 업데이트 (월간 소비, 절약)
        user = db.scalars(select(User).where(User.user_id == user_id)).first()
        if user:
            user.monthly_spending += final_amount
            user.monthly_savings += discount_amount

            # 개인카드 결제 시 잔액 차감
            if not is_corporate:
                user.balance -= final_amount

        # 카드 정보 업데이트
        card = None
        corp_card = None
        if is_corporate:
            # 법인카드: card_id가 "corp_1" 형식이면 숫자만 추출
            corp_card_id = card_id
            if isinstance(card_id, str) and card_id.startswith('corp_'):
                corp_card_id = int(card_id.replace('corp_', ''))
            elif isinstance(card_id, str) and card_id.isdigit():
                corp_card_id = int(card_id)

            corp_card = db.scalars(select(CorporateCard).where(CorporateCard.id == corp_card_id)).first()
            if corp_card:
                corp_card.used_amount += final_amount
                # 멤버십 사용량도 업데이트
                membership = db.scalars(
                    select(CorporateCardMember).where(
                        CorporateCardMember.corporate_card_id == corp_card_id,
                        CorporateCardMember.user_id == user_id,
                        CorporateCardMember.status == 'active'
                    )
                ).first()
                if membership:
                    membership.used_amount += final_amount
        else:
            # 개인카드
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
        if is_corporate:
            # 법인카드 결제: corporate_card_id 사용
            corp_card_id_for_history = card_id
            if isinstance(card_id, str) and card_id.startswith('corp_'):
                corp_card_id_for_history = int(card_id.replace('corp_', ''))
            elif isinstance(card_id, str) and card_id.isdigit():
                corp_card_id_for_history = int(card_id)

            payment = PaymentHistory(
                transaction_id=transaction_id,
                user_id=user_id,
                card_id=None,
                corporate_card_id=corp_card_id_for_history,
                is_corporate=True,
                merchant_name=merchant_name,
                payment_amount=payment_amount,
                discount_amount=discount_amount,
                final_amount=final_amount,
                benefit_text=benefit_text
            )
        else:
            # 개인카드 결제: card_id 사용
            payment = PaymentHistory(
                transaction_id=transaction_id,
                user_id=user_id,
                card_id=card_id,
                corporate_card_id=None,
                is_corporate=False,
                merchant_name=merchant_name,
                payment_amount=payment_amount,
                discount_amount=discount_amount,
                final_amount=final_amount,
                benefit_text=benefit_text
            )
        db.add(payment)
        db.commit()

        # 결제 알림 생성
        if corp_card:
            card_name = corp_card.card_name
        elif card:
            card_name = card.mycard_name
        else:
            card_name = '카드'
        notification = Notification(
            user_id=user_id,
            type='payment',
            title='결제 완료',
            message=f'{merchant_name}에서 {final_amount:,}원 결제 완료' + (f' ({discount_amount:,}원 할인)' if discount_amount > 0 else ''),
            data=json.dumps({
                'transaction_id': transaction_id,
                'merchant_name': merchant_name,
                'payment_amount': payment_amount,
                'discount_amount': discount_amount,
                'final_amount': final_amount,
                'card_name': card_name,
                'benefit_text': benefit_text
            }, ensure_ascii=False)
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        # 실시간 알림 전송
        notification_data = {
            'id': notification.id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'data': json.loads(notification.data),
            'is_read': notification.is_read,
            'created_at': notification.created_at.isoformat()
        }
        broadcast_notification(user_id, notification_data)

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


@app.route('/api/payment/process', methods=['POST'])
def process_payment():
    """
    결제 처리 API (가맹점에서 호출)
    잔액을 확인하고 부족하면 insufficient_balance 에러 반환

    Request:
    {
        "transaction_id": "uuid",
        "confirm": true
    }
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        transaction_id = data.get('transaction_id')
        confirm = data.get('confirm', False)

        if not transaction_id:
            return jsonify({'error': 'transaction_id is required'}), 400

        db = get_db()

        # QR 스캔 데이터에서 트랜잭션 정보 조회
        qr_status = db.scalars(
            select(QRStatus).where(QRStatus.transaction_id == transaction_id)
        ).first()

        if not qr_status:
            return jsonify({'error': '트랜잭션을 찾을 수 없습니다'}), 404

        if qr_status.status != 'scanned':
            return jsonify({'error': '처리할 수 없는 트랜잭션 상태입니다'}), 400

        # 사용자 정보 조회
        user = db.scalars(select(User).where(User.user_id == qr_status.user_id)).first()
        if not user:
            return jsonify({'error': '사용자를 찾을 수 없습니다'}), 404

        # 결제 금액 (final_amount 사용 - 할인 적용 후 금액)
        final_amount = qr_status.final_amount or qr_status.payment_amount

        # 법인카드 여부 확인
        card_id = qr_status.card_id
        is_corporate = isinstance(card_id, str) and card_id.startswith('corp_')

        if is_corporate:
            # 법인카드 한도 체크
            try:
                corporate_card_id = int(card_id.replace('corp_', ''))
            except ValueError:
                return jsonify({'error': 'Invalid corporate card ID'}), 400

            corp_card = db.scalars(
                select(CorporateCard).where(CorporateCard.id == corporate_card_id)
            ).first()
            if not corp_card:
                return jsonify({'error': 'Corporate card not found'}), 404

            membership = db.scalars(
                select(CorporateCardMember).where(
                    CorporateCardMember.corporate_card_id == corporate_card_id,
                    CorporateCardMember.user_id == qr_status.user_id,
                    CorporateCardMember.status == 'active'
                )
            ).first()
            if not membership:
                return jsonify({'error': 'Not a member of this corporate card'}), 403

            # 개인 한도 체크
            member_remaining = membership.monthly_limit - (membership.used_amount or 0)
            if member_remaining < final_amount:
                return jsonify({
                    'error': 'insufficient_limit',
                    'message': '법인카드 개인 한도를 초과했습니다',
                    'limit': membership.monthly_limit,
                    'used': membership.used_amount or 0,
                    'remaining': member_remaining,
                    'required': final_amount,
                    'shortage': final_amount - member_remaining
                }), 400

            # 법인카드 전체 한도 체크
            card_remaining = corp_card.monthly_limit - (corp_card.used_amount or 0)
            if card_remaining < final_amount:
                return jsonify({
                    'error': 'insufficient_card_limit',
                    'message': '법인카드 전체 한도를 초과했습니다',
                    'card_limit': corp_card.monthly_limit,
                    'card_used': corp_card.used_amount or 0,
                    'card_remaining': card_remaining,
                    'required': final_amount
                }), 400
        else:
            # 개인카드: 잔액 확인
            user_balance = user.balance or 0
            if user_balance < final_amount:
                return jsonify({
                    'error': 'insufficient_balance',
                    'message': '잔액이 부족합니다',
                    'balance': user_balance,
                    'required': final_amount,
                    'shortage': final_amount - user_balance
                }), 400

        if confirm:
            discount_amount = qr_status.discount_amount or 0

            if is_corporate:
                # 법인카드 결제 처리 - 사용자 잔액 차감 안 함
                # 멤버십과 법인카드 사용금액 업데이트
                membership.used_amount = (membership.used_amount or 0) + final_amount
                corp_card.used_amount = (corp_card.used_amount or 0) + final_amount

                # 법인카드 결제 내역 저장
                corp_payment = CorporatePaymentHistory(
                    corporate_card_id=corporate_card_id,
                    user_id=qr_status.user_id,
                    member_id=membership.id,
                    merchant_name=qr_status.merchant_name,
                    payment_amount=qr_status.payment_amount or 0,
                    discount_amount=discount_amount,
                    final_amount=final_amount,
                    benefit_text=qr_status.benefit_text,
                    receipt_image=None
                )
                db.add(corp_payment)

                card_name = corp_card.card_name
            else:
                # 개인카드 결제 처리 - 사용자 잔액 차감
                user.balance = user_balance - final_amount

                # 월간 소비 및 절약 업데이트
                user.monthly_spending = (user.monthly_spending or 0) + final_amount
                user.monthly_savings = (user.monthly_savings or 0) + discount_amount

                # 카드 정보 업데이트
                card = db.scalars(select(MyCard).where(MyCard.cid == qr_status.card_id)).first()
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
                    card.used_amount = (card.used_amount or 0) + final_amount
                    card.monthly_performance = (card.monthly_performance or 0) + (qr_status.payment_amount or 0)
                    card.daily_count = (card.daily_count or 0) + 1
                    card.monthly_count = (card.monthly_count or 0) + 1
                    card.last_used_date = today

                # 결제 내역 저장
                payment = PaymentHistory(
                    transaction_id=transaction_id,
                    user_id=qr_status.user_id,
                    card_id=qr_status.card_id,
                    merchant_name=qr_status.merchant_name,
                    payment_amount=qr_status.payment_amount,
                    discount_amount=discount_amount,
                    final_amount=final_amount,
                    benefit_text=qr_status.benefit_text
                )
                db.add(payment)

                card_name = card.mycard_name if card else '카드'

            # QR 상태 업데이트
            qr_status.status = 'completed'

            # 결제 알림 생성
            if is_corporate:
                remaining_limit = membership.monthly_limit - membership.used_amount
                notification_data_dict = {
                    'transaction_id': transaction_id,
                    'merchant_name': qr_status.merchant_name,
                    'payment_amount': qr_status.payment_amount,
                    'discount_amount': discount_amount,
                    'final_amount': final_amount,
                    'card_name': card_name,
                    'benefit_text': qr_status.benefit_text,
                    'is_corporate': True,
                    'remaining_limit': remaining_limit
                }
                notification_message = f'{qr_status.merchant_name}에서 {final_amount:,}원 결제 완료 (법인카드)' + (f' ({discount_amount:,}원 할인)' if discount_amount > 0 else '')
            else:
                notification_data_dict = {
                    'transaction_id': transaction_id,
                    'merchant_name': qr_status.merchant_name,
                    'payment_amount': qr_status.payment_amount,
                    'discount_amount': discount_amount,
                    'final_amount': final_amount,
                    'card_name': card_name,
                    'benefit_text': qr_status.benefit_text,
                    'new_balance': user.balance
                }
                notification_message = f'{qr_status.merchant_name}에서 {final_amount:,}원 결제 완료' + (f' ({discount_amount:,}원 할인)' if discount_amount > 0 else '')

            notification = Notification(
                user_id=qr_status.user_id,
                type='payment',
                title='결제 완료',
                message=notification_message,
                data=json.dumps(notification_data_dict, ensure_ascii=False)
            )
            db.add(notification)
            db.commit()
            db.refresh(notification)

            # 실시간 알림 전송
            notification_broadcast = {
                'id': notification.id,
                'type': notification.type,
                'title': notification.title,
                'message': notification.message,
                'data': json.loads(notification.data),
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat()
            }
            broadcast_notification(qr_status.user_id, notification_broadcast)

        db.close()

        # 응답 생성
        if is_corporate:
            remaining_limit = membership.monthly_limit - membership.used_amount
            return jsonify({
                'success': True,
                'message': '결제가 완료되었습니다' if confirm else '결제 가능합니다',
                'is_corporate': True,
                'remaining_limit': remaining_limit
            }), 200
        else:
            return jsonify({
                'success': True,
                'message': '결제가 완료되었습니다' if confirm else '결제 가능합니다',
                'new_balance': user.balance
            }), 200

    except Exception as e:
        print(f"[Error] 결제 처리 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': '결제 처리에 실패했습니다',
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

    Query Params:
    - after_timestamp: QR 생성 시간 (이 시간 이후의 결제만 반환)

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

        # QR 생성 시간 이후의 결제만 조회 (after_timestamp 파라미터)
        # 모든 시간은 KST로 통일
        after_timestamp = request.args.get('after_timestamp', type=int)
        if after_timestamp:
            # Unix timestamp를 KST datetime으로 변환 (naive)
            after_datetime = timestamp_to_kst(after_timestamp).replace(tzinfo=None)
        else:
            # fallback: 최근 5분 이내 (KST 기준)
            after_datetime = get_kst_now() - timedelta(minutes=5)

        print(f">>> [Payment Recent] user={user_id}, after_ts={after_timestamp}, after_dt={after_datetime} (KST)")

        recent_payment = db.scalars(
            select(PaymentHistory)
            .where(
                PaymentHistory.user_id == user_id,
                PaymentHistory.payment_date > after_datetime
            )
            .order_by(PaymentHistory.payment_date.desc())
            .limit(1)
        ).first()

        if recent_payment:
            print(f">>> [Payment Recent] FOUND - tx={recent_payment.transaction_id}, payment_date={recent_payment.payment_date}")
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
        else:
            print(f">>> [Payment Recent] NOT FOUND")

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


# ============ 친구 관리 API ============

@app.route('/api/friends/search', methods=['GET'])
@login_required
def search_friends():
    """
    친구 검색 API (이메일 또는 user_id로 검색)
    
    Query params:
        - query: 검색어 (이메일 또는 user_id)
    
    Response:
    {
        "success": true,
        "users": [
            {
                "user_id": "kim_chulsoo",
                "user_name": "김철수",
                "user_email": "kim@cardealo.com",
                "is_friend": false,
                "friendship_status": null  // null, "pending", "accepted", "sent_pending"
            }
        ]
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        query = request.args.get('query', '').strip()
        
        if not query:
            return jsonify({'success': False, 'error': 'query parameter is required'}), 400
        
        if len(query) < 2:
            return jsonify({'success': False, 'error': 'Query must be at least 2 characters'}), 400
        
        db = get_db()
        
        # 이메일 또는 user_id로 검색 (자기 자신 제외)
        users = db.scalars(
            select(User).where(
                (User.user_email.like(f'%{query}%')) | (User.user_id.like(f'%{query}%')),
                User.user_id != user_id
            ).limit(20)
        ).all()
        
        users_data = []
        for user in users:
            # 친구 상태 확인
            friendship = db.scalars(
                select(Friendship).where(
                    ((Friendship.user_id == user_id) & (Friendship.friend_id == user.user_id)) |
                    ((Friendship.user_id == user.user_id) & (Friendship.friend_id == user_id))
                )
            ).first()
            
            friendship_status = None
            is_friend = False
            
            if friendship:
                if friendship.status == 'accepted':
                    is_friend = True
                    friendship_status = 'accepted'
                elif friendship.user_id == user_id:
                    friendship_status = 'sent_pending'  # 내가 보낸 요청
                else:
                    friendship_status = 'pending'  # 받은 요청
            
            users_data.append({
                'user_id': user.user_id,
                'user_name': user.user_name,
                'user_email': user.user_email,
                'is_friend': is_friend,
                'friendship_status': friendship_status
            })
        
        db.close()
        
        return jsonify({
            'success': True,
            'users': users_data
        }), 200
        
    except Exception as e:
        print(f"[Error] 친구 검색 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/friends/request', methods=['POST'])
@login_required
def send_friend_request():
    """
    친구 요청 API
    
    Request:
    {
        "friend_id": "kim_chulsoo"
    }
    
    Response:
    {
        "success": true,
        "message": "친구 요청을 보냈습니다"
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()
        
        friend_id = data.get('friend_id')
        
        if not friend_id:
            return jsonify({'success': False, 'error': 'friend_id is required'}), 400
        
        if friend_id == user_id:
            return jsonify({'success': False, 'error': '자기 자신에게 친구 요청을 보낼 수 없습니다'}), 400
        
        db = get_db()
        
        # 상대방이 존재하는지 확인
        friend = db.scalars(select(User).where(User.user_id == friend_id)).first()
        if not friend:
            db.close()
            return jsonify({'success': False, 'error': '사용자를 찾을 수 없습니다'}), 404
        
        # 이미 친구 관계가 있는지 확인
        existing = db.scalars(
            select(Friendship).where(
                ((Friendship.user_id == user_id) & (Friendship.friend_id == friend_id)) |
                ((Friendship.user_id == friend_id) & (Friendship.friend_id == user_id))
            )
        ).first()
        
        if existing:
            db.close()
            if existing.status == 'accepted':
                return jsonify({'success': False, 'error': '이미 친구입니다'}), 400
            elif existing.status == 'pending':
                return jsonify({'success': False, 'error': '이미 친구 요청이 대기 중입니다'}), 400
            elif existing.status == 'blocked':
                return jsonify({'success': False, 'error': '차단된 사용자입니다'}), 400
        
        # 친구 요청 생성
        friendship = Friendship(
            user_id=user_id,
            friend_id=friend_id,
            status='pending'
        )
        db.add(friendship)
        db.commit()
        db.refresh(friendship)

        # 요청 보낸 사람 정보
        sender = db.scalars(select(User).where(User.user_id == user_id)).first()
        sender_name = sender.user_name if sender else user_id

        # 친구 요청 알림 생성
        notification = Notification(
            user_id=friend_id,
            type='friend_request',
            title='친구 요청',
            message=f'{sender_name}님이 친구 요청을 보냈습니다',
            data=json.dumps({
                'request_id': friendship.id,
                'sender_id': user_id,
                'sender_name': sender_name,
                'action_type': 'friend_request',
                'action_target': friendship.id
            }, ensure_ascii=False)
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        # 실시간 알림 전송
        notification_data = {
            'id': notification.id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'data': json.loads(notification.data),
            'is_read': notification.is_read,
            'created_at': notification.created_at.isoformat()
        }
        broadcast_notification(friend_id, notification_data)

        db.close()

        return jsonify({
            'success': True,
            'message': '친구 요청을 보냈습니다'
        }), 200

    except Exception as e:
        print(f"[Error] 친구 요청 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/friends/requests', methods=['GET'])
@login_required
def get_friend_requests():
    """
    받은 친구 요청 목록 조회
    
    Response:
    {
        "success": true,
        "requests": [
            {
                "id": 1,
                "user_id": "hong_gildong",
                "user_name": "홍길동",
                "user_email": "hong@cardealo.com",
                "created_at": "2024-01-01T12:00:00"
            }
        ]
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()
        
        # 받은 친구 요청 (status가 pending이고 내가 friend_id인 경우)
        requests = db.scalars(
            select(Friendship).where(
                Friendship.friend_id == user_id,
                Friendship.status == 'pending'
            ).order_by(Friendship.created_at.desc())
        ).all()
        
        requests_data = []
        for req in requests:
            requester = db.scalars(select(User).where(User.user_id == req.user_id)).first()
            if requester:
                requests_data.append({
                    'id': req.id,
                    'user_id': requester.user_id,
                    'user_name': requester.user_name,
                    'user_email': requester.user_email,
                    'created_at': req.created_at.isoformat() if req.created_at else None
                })
        
        db.close()
        
        return jsonify({
            'success': True,
            'requests': requests_data
        }), 200
        
    except Exception as e:
        print(f"[Error] 친구 요청 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/friends/accept', methods=['POST'])
@login_required
def accept_friend_request():
    """
    친구 요청 수락
    
    Request:
    {
        "request_id": 1
    }
    
    Response:
    {
        "success": true,
        "message": "친구 요청을 수락했습니다"
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()
        
        request_id = data.get('request_id')
        
        if not request_id:
            return jsonify({'success': False, 'error': 'request_id is required'}), 400
        
        db = get_db()
        
        # 친구 요청 조회 (내가 받은 요청만)
        friendship = db.scalars(
            select(Friendship).where(
                Friendship.id == request_id,
                Friendship.friend_id == user_id,
                Friendship.status == 'pending'
            )
        ).first()
        
        if not friendship:
            db.close()
            return jsonify({'success': False, 'error': '친구 요청을 찾을 수 없습니다'}), 404
        
        # 상태를 accepted로 변경
        friendship.status = 'accepted'
        friendship.updated_at = datetime.utcnow()
        db.commit()

        # 수락한 사람 정보 (알림 보낼 때 필요)
        accepter = db.scalars(select(User).where(User.user_id == user_id)).first()
        accepter_name = accepter.user_name if accepter else user_id

        # 친구 요청 수락 알림 생성 (원래 요청 보낸 사람에게)
        notification = Notification(
            user_id=friendship.user_id,  # 원래 요청 보낸 사람
            type='friend_accepted',
            title='친구 요청 수락',
            message=f'{accepter_name}님이 친구 요청을 수락했습니다',
            data=json.dumps({
                'friend_id': user_id,
                'friend_name': accepter_name
            }, ensure_ascii=False)
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        # 실시간 알림 전송
        notification_data = {
            'id': notification.id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'data': json.loads(notification.data),
            'is_read': notification.is_read,
            'created_at': notification.created_at.isoformat()
        }
        broadcast_notification(friendship.user_id, notification_data)

        db.close()

        return jsonify({
            'success': True,
            'message': '친구 요청을 수락했습니다'
        }), 200

    except Exception as e:
        print(f"[Error] 친구 요청 수락 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/friends/reject', methods=['POST'])
@login_required
def reject_friend_request():
    """
    친구 요청 거절
    
    Request:
    {
        "request_id": 1
    }
    
    Response:
    {
        "success": true,
        "message": "친구 요청을 거절했습니다"
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()
        
        request_id = data.get('request_id')
        
        if not request_id:
            return jsonify({'success': False, 'error': 'request_id is required'}), 400
        
        db = get_db()
        
        # 친구 요청 조회 (내가 받은 요청만)
        friendship = db.scalars(
            select(Friendship).where(
                Friendship.id == request_id,
                Friendship.friend_id == user_id,
                Friendship.status == 'pending'
            )
        ).first()
        
        if not friendship:
            db.close()
            return jsonify({'success': False, 'error': '친구 요청을 찾을 수 없습니다'}), 404
        
        # 요청 삭제
        db.delete(friendship)
        db.commit()
        db.close()
        
        return jsonify({
            'success': True,
            'message': '친구 요청을 거절했습니다'
        }), 200
        
    except Exception as e:
        print(f"[Error] 친구 요청 거절 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/friends', methods=['GET'])
@login_required
def get_friends():
    """
    친구 목록 조회
    
    Response:
    {
        "success": true,
        "friends": [
            {
                "user_id": "kim_chulsoo",
                "user_name": "김철수",
                "user_email": "kim@cardealo.com",
                "friendship_id": 1,
                "became_friends_at": "2024-01-01T12:00:00"
            }
        ]
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()
        
        # 수락된 친구 관계 조회 (내가 요청했거나 받은 경우 모두)
        friendships = db.scalars(
            select(Friendship).where(
                ((Friendship.user_id == user_id) | (Friendship.friend_id == user_id)),
                Friendship.status == 'accepted'
            ).order_by(Friendship.updated_at.desc())
        ).all()
        
        friends_data = []
        for friendship in friendships:
            # 상대방 user_id 찾기
            friend_user_id = friendship.friend_id if friendship.user_id == user_id else friendship.user_id
            
            friend = db.scalars(select(User).where(User.user_id == friend_user_id)).first()
            if friend:
                friends_data.append({
                    'user_id': friend.user_id,
                    'user_name': friend.user_name,
                    'user_email': friend.user_email,
                    'friendship_id': friendship.id,
                    'became_friends_at': friendship.updated_at.isoformat() if friendship.updated_at else None
                })
        
        db.close()
        
        return jsonify({
            'success': True,
            'friends': friends_data
        }), 200
        
    except Exception as e:
        print(f"[Error] 친구 목록 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/friends/<string:friend_user_id>', methods=['DELETE'])
@login_required
def delete_friend(friend_user_id):
    """
    친구 삭제
    
    Response:
    {
        "success": true,
        "message": "친구를 삭제했습니다"
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()
        
        # 친구 관계 조회
        friendship = db.scalars(
            select(Friendship).where(
                ((Friendship.user_id == user_id) & (Friendship.friend_id == friend_user_id)) |
                ((Friendship.user_id == friend_user_id) & (Friendship.friend_id == user_id)),
                Friendship.status == 'accepted'
            )
        ).first()
        
        if not friendship:
            db.close()
            return jsonify({'success': False, 'error': '친구 관계를 찾을 수 없습니다'}), 404
        
        # 친구 관계 삭제
        db.delete(friendship)
        db.commit()
        db.close()
        
        return jsonify({
            'success': True,
            'message': '친구를 삭제했습니다'
        }), 200
        
    except Exception as e:
        print(f"[Error] 친구 삭제 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/friends/<string:friend_user_id>/courses', methods=['GET'])
@login_required
def get_friend_courses(friend_user_id):
    """
    친구의 데이트 코스 조회 API
    
    Query params:
        - limit: 최대 결과 개수 (기본: 10)
        - offset: 오프셋 (기본: 0)
    
    Response:
    {
        "success": true,
        "friend": {
            "user_id": "kim_chulsoo",
            "user_name": "김철수",
            "user_email": "kim@cardealo.com"
        },
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
                "is_shared_with_me": true,
                "member_count": 2,
                "members": ["hong_gildong", "kim_chulsoo"]
            }
        ]
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        limit = request.args.get('limit', 10, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        db = get_db()
        
        # 친구 관계 확인
        friendship = db.scalars(
            select(Friendship).where(
                ((Friendship.user_id == user_id) & (Friendship.friend_id == friend_user_id)) |
                ((Friendship.user_id == friend_user_id) & (Friendship.friend_id == user_id)),
                Friendship.status == 'accepted'
            )
        ).first()
        
        if not friendship:
            db.close()
            return jsonify({
                'success': False,
                'error': '친구 관계가 아닙니다'
            }), 403
        
        # 친구 정보 조회
        friend = db.scalars(select(User).where(User.user_id == friend_user_id)).first()
        if not friend:
            db.close()
            return jsonify({
                'success': False,
                'error': '사용자를 찾을 수 없습니다'
            }), 404
        
        # 친구가 저장한 코스 ID 가져오기
        friend_course_ids = db.scalars(
            select(SavedCourseUser.course_id)
            .where(SavedCourseUser.user_id == friend_user_id)
        ).all()
        
        # 코스 정보 가져오기
        courses = db.scalars(
            select(SavedCourse)
            .where(SavedCourse.id.in_(friend_course_ids))
            .order_by(SavedCourse.created_at.desc())
            .limit(limit)
            .offset(offset)
        ).all()
        
        courses_data = []
        for course in courses:
            # 해당 코스의 멤버 조회
            course_members = db.scalars(
                select(SavedCourseUser).where(SavedCourseUser.course_id == course.id)
            ).all()
            
            member_ids = [cu.user_id for cu in course_members]
            is_shared_with_me = user_id in member_ids
            
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
                'creator_id': course.user_id,
                'is_shared_with_me': is_shared_with_me,
                'member_count': len(member_ids),
                'members': member_ids
            })
        
        db.close()
        
        return jsonify({
            'success': True,
            'friend': {
                'user_id': friend.user_id,
                'user_name': friend.user_name,
                'user_email': friend.user_email
            },
            'courses': courses_data
        }), 200
        
    except Exception as e:
        print(f"[Error] 친구 코스 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': '친구 코스 조회에 실패했습니다',
            'message': str(e)
        }), 500



@app.route('/api/course/<int:course_id>/invite', methods=['POST'])
@login_required
def invite_friend_to_course(course_id):
    """
    기존 코스에 친구 초대 (나중에 추가로 초대하는 기능)
    
    Request:
    {
        "friend_user_id": "kim_chulsoo"
    }
    
    Response:
    {
        "success": true,
        "message": "친구를 코스에 초대했습니다"
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()
        
        friend_user_id = data.get('friend_user_id')
        
        if not friend_user_id:
            return jsonify({'success': False, 'error': 'friend_user_id is required'}), 400
        
        db = get_db()
        
        # 코스 존재 확인
        course = db.scalars(select(SavedCourse).where(SavedCourse.id == course_id)).first()
        if not course:
            db.close()
            return jsonify({'success': False, 'error': '코스를 찾을 수 없습니다'}), 404
        
        # 코스 참여 확인 (참여 중인 사람만 초대 가능)
        course_user = db.scalars(
            select(SavedCourseUser).where(
                SavedCourseUser.course_id == course_id,
                SavedCourseUser.user_id == user_id
            )
        ).first()
        
        if not course_user:
            db.close()
            return jsonify({'success': False, 'error': '코스에 접근 권한이 없습니다'}), 403
        
        # 친구 관계 확인
        friendship = db.scalars(
            select(Friendship).where(
                ((Friendship.user_id == user_id) & (Friendship.friend_id == friend_user_id)) |
                ((Friendship.user_id == friend_user_id) & (Friendship.friend_id == user_id)),
                Friendship.status == 'accepted'
            )
        ).first()
        
        if not friendship:
            db.close()
            return jsonify({'success': False, 'error': '친구만 초대할 수 있습니다'}), 403
        
        # 이미 코스에 참여 중인지 확인
        existing = db.scalars(
            select(SavedCourseUser).where(
                SavedCourseUser.course_id == course_id,
                SavedCourseUser.user_id == friend_user_id
            )
        ).first()
        
        if existing:
            db.close()
            return jsonify({'success': False, 'error': '이미 코스에 참여 중입니다'}), 400
        
        # 친구를 코스에 추가
        friend_course_user = SavedCourseUser(
            course_id=course_id,
            user_id=friend_user_id
        )
        db.add(friend_course_user)
        
        # 저장 횟수 증가
        course.save_count += 1
        
        db.commit()
        db.close()
        
        return jsonify({
            'success': True,
            'message': '친구를 코스에 초대했습니다'
        }), 200
        
    except Exception as e:
        print(f"[Error] 코스 초대 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/course/<int:course_id>/members', methods=['GET'])
@login_required
def get_course_members(course_id):
    """
    코스 참여 멤버 목록 조회
    
    Response:
    {
        "success": true,
        "members": [
            {
                "user_id": "hong_gildong",
                "user_name": "홍길동",
                "user_email": "hong@cardealo.com",
                "joined_at": "2024-01-01T12:00:00",
                "is_creator": true
            }
        ],
        "creator_id": "hong_gildong"
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()
        
        # 코스 존재 확인
        course = db.scalars(select(SavedCourse).where(SavedCourse.id == course_id)).first()
        if not course:
            db.close()
            return jsonify({'success': False, 'error': '코스를 찾을 수 없습니다'}), 404
        
        # 코스 참여 확인
        course_user = db.scalars(
            select(SavedCourseUser).where(
                SavedCourseUser.course_id == course_id,
                SavedCourseUser.user_id == user_id
            )
        ).first()
        
        if not course_user:
            db.close()
            return jsonify({'success': False, 'error': '코스에 접근 권한이 없습니다'}), 403
        
        # 멤버 목록 조회
        course_users = db.scalars(
            select(SavedCourseUser).where(SavedCourseUser.course_id == course_id)
        ).all()
        
        members_data = []
        for cu in course_users:
            user = db.scalars(select(User).where(User.user_id == cu.user_id)).first()
            if user:
                members_data.append({
                    'user_id': user.user_id,
                    'user_name': user.user_name,
                    'user_email': user.user_email,
                    'joined_at': cu.saved_at.isoformat() if cu.saved_at else None,
                    'is_creator': user.user_id == course.user_id
                })
        
        db.close()
        
        return jsonify({
            'success': True,
            'members': members_data,
            'creator_id': course.user_id
        }), 200
        
    except Exception as e:
        print(f"[Error] 코스 멤버 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/course/<int:course_id>/leave', methods=['POST'])
@login_required
def leave_course(course_id):
    """
    코스 나가기 (생성자가 아닌 경우만 가능)
    
    Response:
    {
        "success": true,
        "message": "코스에서 나갔습니다"
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()
        
        # 코스 조회
        course = db.scalars(select(SavedCourse).where(SavedCourse.id == course_id)).first()
        if not course:
            db.close()
            return jsonify({'success': False, 'error': '코스를 찾을 수 없습니다'}), 404
        
        # 생성자는 나갈 수 없음
        if course.user_id == user_id:
            db.close()
            return jsonify({'success': False, 'error': '코스 생성자는 나갈 수 없습니다'}), 400
        
        # 코스 참여 정보 조회
        course_user = db.scalars(
            select(SavedCourseUser).where(
                SavedCourseUser.course_id == course_id,
                SavedCourseUser.user_id == user_id
            )
        ).first()
        
        if not course_user:
            db.close()
            return jsonify({'success': False, 'error': '코스에 참여하고 있지 않습니다'}), 404
        
        # 참여 정보 삭제
        db.delete(course_user)
        
        # 저장 횟수 감소
        if course.save_count > 0:
            course.save_count -= 1
        
        db.commit()
        db.close()
        
        return jsonify({
            'success': True,
            'message': '코스에서 나갔습니다'
        }), 200
        
    except Exception as e:
        print(f"[Error] 코스 나가기 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500



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


@app.route('/api/corporate/is-employee', methods=['GET'])
@login_required
def check_is_corporate_employee():
    """
    현재 사용자가 법인카드 직원인지 확인 (직원 대시보드 접근 권한)
    관리자가 아닌 활성 직원만 해당
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()

        # 먼저 관리자인지 확인 (관리자는 직원 대시보드 대신 관리자 대시보드 사용)
        owned_card = db.scalars(
            select(CorporateCard).where(CorporateCard.owner_user_id == user_id)
        ).first()

        if owned_card:
            db.close()
            return jsonify({
                'success': True,
                'is_employee': False,
                'is_admin': True
            }), 200

        # 활성 직원 멤버십 확인
        member = db.scalars(
            select(CorporateCardMember).where(
                CorporateCardMember.user_id == user_id,
                CorporateCardMember.status == 'active'
            )
        ).first()

        if not member:
            db.close()
            return jsonify({
                'success': True,
                'is_employee': False,
                'is_admin': False
            }), 200

        # 직원 정보와 함께 반환
        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == member.corporate_card_id)
        ).first()

        department = None
        if member.department_id:
            dept = db.scalars(
                select(Department).where(Department.id == member.department_id)
            ).first()
            if dept:
                department = {
                    'id': dept.id,
                    'name': dept.name,
                    'monthly_limit': dept.monthly_limit,
                    'used_amount': dept.used_amount,
                    'color': dept.color
                }

        db.close()

        return jsonify({
            'success': True,
            'is_employee': True,
            'is_admin': False,
            'membership': {
                'id': member.id,
                'card_id': member.corporate_card_id,
                'card_name': card.card_name if card else None,
                'card_company': card.card_company if card else None,
                'role': member.role,
                'monthly_limit': member.monthly_limit,
                'used_amount': member.used_amount,
                'department': department
            }
        }), 200

    except Exception as e:
        print(f"[Error] 직원 확인 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/corporate/employee/dashboard', methods=['GET'])
@login_required
def get_employee_dashboard():
    """
    직원용 대시보드 데이터 반환
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        db = get_db()

        # 활성 직원 멤버십 확인
        member = db.scalars(
            select(CorporateCardMember).where(
                CorporateCardMember.user_id == user_id,
                CorporateCardMember.status == 'active'
            )
        ).first()

        if not member:
            db.close()
            return jsonify({'success': False, 'error': '직원 권한이 없습니다'}), 403

        # 법인카드 정보
        card = db.scalars(
            select(CorporateCard).where(CorporateCard.id == member.corporate_card_id)
        ).first()

        if not card:
            db.close()
            return jsonify({'success': False, 'error': '법인카드를 찾을 수 없습니다'}), 404

        # 부서 정보
        my_department = None
        if member.department_id:
            dept = db.scalars(
                select(Department).where(Department.id == member.department_id)
            ).first()
            if dept:
                my_department = {
                    'id': dept.id,
                    'name': dept.name,
                    'monthly_limit': dept.monthly_limit,
                    'used_amount': dept.used_amount,
                    'color': dept.color,
                    'usage_percent': round((dept.used_amount / dept.monthly_limit) * 100) if dept.monthly_limit > 0 else 0
                }

        # 전체 부서 사용량 (간략 정보만)
        all_departments = db.scalars(
            select(Department).where(Department.corporate_card_id == card.id)
        ).all()

        departments_overview = []
        for dept in all_departments:
            departments_overview.append({
                'id': dept.id,
                'name': dept.name,
                'used_amount': dept.used_amount,
                'monthly_limit': dept.monthly_limit,
                'usage_percent': round((dept.used_amount / dept.monthly_limit) * 100) if dept.monthly_limit > 0 else 0,
                'color': dept.color,
                'is_my_department': dept.id == member.department_id
            })

        # 개인 사용률 계산
        my_usage_percent = round((member.used_amount / member.monthly_limit) * 100) if member.monthly_limit > 0 else 0

        db.close()

        return jsonify({
            'success': True,
            'card': {
                'id': card.id,
                'name': card.card_name,
                'company': card.card_company,
                'total_limit': card.monthly_limit,
                'total_used': card.used_amount
            },
            'my_info': {
                'role': member.role,
                'monthly_limit': member.monthly_limit,
                'used_amount': member.used_amount,
                'remaining': member.monthly_limit - member.used_amount,
                'usage_percent': my_usage_percent,
                'department': my_department
            },
            'departments_overview': departments_overview
        }), 200

    except Exception as e:
        print(f"[Error] 직원 대시보드 조회 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ============ 직원 초대 시스템 ============

@app.route('/api/corporate/users/search', methods=['GET'])
@login_required
def search_users_for_invite():
    """
    직원 초대용 사용자 검색 (이메일로 검색)
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        query = request.args.get('q', '').strip()

        if not query or len(query) < 2:
            return jsonify({'success': True, 'users': []}), 200

        db = get_db()

        # 이메일에 검색어가 포함된 사용자 검색 (최대 10명)
        users = db.scalars(
            select(User).where(
                User.user_email.ilike(f'%{query}%')
            ).limit(10)
        ).all()

        users_data = []
        for user in users:
            # 본인은 제외
            if user.user_id == user_id:
                continue
            users_data.append({
                'user_id': user.user_id,
                'user_name': user.user_name,
                'user_email': user.user_email
            })

        db.close()

        return jsonify({
            'success': True,
            'users': users_data
        }), 200

    except Exception as e:
        print(f"[Error] 사용자 검색 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


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

        # 기존 사용자인 경우 알림 전송
        if invited_user:
            notification = Notification(
                user_id=invited_user.user_id,
                type='corporate_card',
                title='법인카드 등록 완료',
                message=f'{card.card_name} 법인카드가 등록되었습니다.',
                data=json.dumps({
                    'card_id': card_id,
                    'card_name': card.card_name,
                    'monthly_limit': monthly_limit
                }, ensure_ascii=False)
            )
            db.add(notification)
            db.commit()
            db.refresh(notification)

            # 실시간 알림 전송
            notification_data = {
                'id': notification.id,
                'type': notification.type,
                'title': notification.title,
                'message': notification.message,
                'data': json.loads(notification.data),
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat()
            }
            broadcast_notification(invited_user.user_id, notification_data)

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


@app.route('/api/corporate/cards/<int:card_id>/members/<int:member_id>', methods=['PATCH'])
@login_required
def update_corporate_member(card_id, member_id):
    """
    팀원 월 한도 수정
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

        # 팀원 조회
        member = db.scalars(
            select(CorporateCardMember).where(
                CorporateCardMember.id == member_id,
                CorporateCardMember.corporate_card_id == card_id
            )
        ).first()

        if not member:
            db.close()
            return jsonify({'success': False, 'error': 'Member not found'}), 404

        data = request.get_json()
        new_limit = data.get('monthly_limit')

        if new_limit is None:
            db.close()
            return jsonify({'success': False, 'error': 'monthly_limit is required'}), 400

        # 현재 사용량 이상이어야 함
        if new_limit < member.used_amount:
            db.close()
            return jsonify({
                'success': False,
                'error': f'한도는 현재 사용량({member.used_amount:,}원) 이상이어야 합니다.'
            }), 400

        member.monthly_limit = new_limit
        db.commit()

        # 세션 닫기 전에 데이터 복사
        result_data = {
            'id': member.id,
            'monthly_limit': member.monthly_limit,
            'used_amount': member.used_amount
        }
        db.close()

        return jsonify({
            'success': True,
            'member': result_data
        }), 200

    except Exception as e:
        print(f"[Error] 팀원 한도 수정 실패: {e}")
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
            # Get member IDs for this department
            dept_member_ids = [m.id for m in members]
            dept_payments = [p for p in card.payments if p.member_id in dept_member_ids]
            dept_benefit = sum(p.discount_amount or 0 for p in dept_payments)
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


@app.route('/api/corporate/receipt/save', methods=['POST'])
@login_required
def save_corporate_receipt():
    """
    영수증 스캔 결과를 법인카드 결제 내역에 저장하고 사용액 업데이트

    Request:
    {
        "merchant_name": "스타벅스",
        "merchant_category": "카페",
        "total_amount": 5500,
        "payment_date": "2024-03-15",
        "payment_time": "14:30",
        "card_number": "1234-****-****-5678",
        "approval_number": "12345678",
        "receipt_image": "base64...",  // optional
        "raw_text": "영수증 원본 텍스트"  // optional
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json()

        db = get_db()

        # 사용자가 법인카드 멤버인지 확인
        member = db.query(CorporateCardMember).filter(
            CorporateCardMember.user_id == user_id,
            CorporateCardMember.status == 'active'
        ).first()

        if not member:
            db.close()
            return jsonify({
                'success': False,
                'error': '법인카드 멤버가 아닙니다'
            }), 400

        # 결제 금액
        payment_amount = data.get('total_amount', 0)
        if not payment_amount or payment_amount <= 0:
            db.close()
            return jsonify({
                'success': False,
                'error': '유효한 결제 금액이 필요합니다'
            }), 400

        # 한도 체크
        if member.used_amount + payment_amount > member.monthly_limit:
            remaining = member.monthly_limit - member.used_amount
            db.close()
            return jsonify({
                'success': False,
                'error': f'개인 월 한도를 초과합니다 (잔여: {remaining:,}원)'
            }), 400

        # 부서 한도 체크
        if member.department:
            if member.department.used_amount + payment_amount > member.department.monthly_limit:
                remaining = member.department.monthly_limit - member.department.used_amount
                db.close()
                return jsonify({
                    'success': False,
                    'error': f'부서 월 한도를 초과합니다 (잔여: {remaining:,}원)'
                }), 400

        # 결제일시 파싱
        payment_datetime = datetime.utcnow()
        if data.get('payment_date'):
            try:
                date_str = data['payment_date']
                time_str = data.get('payment_time', '00:00')
                payment_datetime = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
            except:
                pass

        # 결제 내역 저장
        import uuid
        payment = CorporatePaymentHistory(
            transaction_id=str(uuid.uuid4()),
            corporate_card_id=member.corporate_card_id,
            member_id=member.id,
            user_id=user_id,
            merchant_name=data.get('merchant_name'),
            merchant_category=data.get('merchant_category'),
            payment_amount=payment_amount,
            discount_amount=0,
            final_amount=payment_amount,
            benefit_text=None,
            receipt_image=data.get('receipt_image'),
            receipt_ocr_data=json.dumps(data, ensure_ascii=False) if data else None,
            payment_date=payment_datetime,
            synced_at=datetime.utcnow()
        )
        db.add(payment)

        # 멤버 사용액 업데이트
        member.used_amount += payment_amount

        # 부서 사용액 업데이트
        if member.department:
            member.department.used_amount += payment_amount

        # 카드 전체 사용액 업데이트
        card = db.query(CorporateCard).filter(CorporateCard.id == member.corporate_card_id).first()
        if card:
            card.used_amount += payment_amount

        db.commit()

        # 응답 데이터
        result = {
            'success': True,
            'payment_id': payment.id,
            'updated_usage': {
                'personal': {
                    'used': member.used_amount,
                    'limit': member.monthly_limit,
                    'remaining': member.monthly_limit - member.used_amount
                }
            }
        }

        if member.department:
            result['updated_usage']['department'] = {
                'name': member.department.name,
                'used': member.department.used_amount,
                'limit': member.department.monthly_limit,
                'remaining': member.department.monthly_limit - member.department.used_amount
            }

        db.close()
        return jsonify(result), 200

    except Exception as e:
        print(f"[Error] 영수증 저장 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============ 알림 시스템 ============

# 사용자별 WebSocket 연결 관리
user_sockets = {}  # user_id -> [socket_ids]


@app.route('/api/notifications', methods=['GET'])
@login_required
def get_notifications():
    """
    알림 목록 조회

    Query params:
        - limit: 최대 결과 개수 (기본: 20)
        - offset: 오프셋 (기본: 0)
        - unread_only: 읽지 않은 알림만 (기본: false)

    Response:
    {
        "success": true,
        "notifications": [...],
        "unread_count": 5
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)
        unread_only = request.args.get('unread_only', 'false').lower() == 'true'

        db = get_db()

        # 읽지 않은 알림 개수
        unread_count = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).count()

        # 알림 목록 조회
        query = db.query(Notification).filter(Notification.user_id == user_id)

        if unread_only:
            query = query.filter(Notification.is_read == False)

        notifications = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset).all()

        notifications_data = []
        for notif in notifications:
            notifications_data.append({
                'id': notif.id,
                'type': notif.type,
                'title': notif.title,
                'message': notif.message,
                'data': json.loads(notif.data) if notif.data else None,
                'is_read': notif.is_read,
                'created_at': notif.created_at.isoformat() if notif.created_at else None
            })

        db.close()

        return jsonify({
            'success': True,
            'notifications': notifications_data,
            'unread_count': unread_count
        }), 200

    except Exception as e:
        print(f"[Error] 알림 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/notifications/read', methods=['POST'])
@login_required
def mark_notifications_read():
    """
    알림 읽음 처리

    Request:
    {
        "notification_ids": [1, 2, 3]  // 비어있으면 전체 읽음 처리
    }

    Response:
    {
        "success": true,
        "updated_count": 3
    }
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')
        data = request.get_json() or {}
        notification_ids = data.get('notification_ids', [])

        db = get_db()

        if notification_ids:
            # 특정 알림만 읽음 처리
            updated = db.query(Notification).filter(
                Notification.user_id == user_id,
                Notification.id.in_(notification_ids),
                Notification.is_read == False
            ).update({Notification.is_read: True}, synchronize_session=False)
        else:
            # 전체 읽음 처리
            updated = db.query(Notification).filter(
                Notification.user_id == user_id,
                Notification.is_read == False
            ).update({Notification.is_read: True}, synchronize_session=False)

        db.commit()
        db.close()

        return jsonify({
            'success': True,
            'updated_count': updated
        }), 200

    except Exception as e:
        print(f"[Error] 알림 읽음 처리 실패: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/notifications/unread-count', methods=['GET'])
@login_required
def get_unread_count():
    """
    읽지 않은 알림 개수 조회
    """
    try:
        user_id = jwt_service.verify_token(request.headers['Authorization'].split(' ')[1]).get('user_id')

        db = get_db()

        unread_count = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).count()

        db.close()

        return jsonify({
            'success': True,
            'unread_count': unread_count
        }), 200

    except Exception as e:
        print(f"[Error] 읽지 않은 알림 개수 조회 실패: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


def create_notification(user_id: str, notification_type: str, title: str, message: str, data: dict = None):
    """
    알림 생성 및 실시간 전송 헬퍼 함수
    """
    try:
        db = get_db()

        notification = Notification(
            user_id=user_id,
            type=notification_type,
            title=title,
            message=message,
            data=json.dumps(data, ensure_ascii=False) if data else None
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        notification_data = {
            'id': notification.id,
            'type': notification.type,
            'title': notification.title,
            'message': notification.message,
            'data': data,
            'is_read': notification.is_read,
            'created_at': notification.created_at.isoformat() if notification.created_at else None
        }

        db.close()

        # 실시간 알림 전송
        broadcast_notification(user_id, notification_data)

        return notification_data

    except Exception as e:
        print(f"[Error] 알림 생성 실패: {e}")
        return None


def broadcast_notification(user_id: str, notification_data: dict):
    """
    특정 사용자에게 실시간 알림 전송
    """
    room = f'user_{user_id}'
    socketio.emit('new_notification', notification_data, room=room)
    print(f"[WebSocket] Notification sent to user {user_id}")


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
    # 사용자 알림 룸에서 제거
    for user_id in list(user_sockets.keys()):
        if request.sid in user_sockets.get(user_id, []):
            user_sockets[user_id].remove(request.sid)
            leave_room(f'user_{user_id}')


@socketio.on('join_notifications')
def handle_join_notifications(data):
    """
    사용자 알림 룸 참가
    """
    token = data.get('token')

    if not token:
        emit('error', {'message': 'token is required'})
        return

    try:
        # 토큰 검증
        user_data = jwt_service.verify_token(token)
        user_id = user_data.get('user_id')

        if not user_id:
            emit('error', {'message': 'Invalid token'})
            return

        # 룸 참가
        room = f'user_{user_id}'
        join_room(room)

        if user_id not in user_sockets:
            user_sockets[user_id] = []
        user_sockets[user_id].append(request.sid)

        emit('notifications_joined', {'user_id': user_id, 'message': 'Successfully joined notifications'})
        print(f"[WebSocket] User {user_id} joined notification room {room}")

    except Exception as e:
        print(f"[WebSocket] Join notifications error: {e}")
        emit('error', {'message': str(e)})


@socketio.on('leave_notifications')
def handle_leave_notifications(data):
    """
    사용자 알림 룸 떠나기
    """
    token = data.get('token')

    if token:
        try:
            user_data = jwt_service.verify_token(token)
            user_id = user_data.get('user_id')

            if user_id:
                room = f'user_{user_id}'
                leave_room(room)
                if user_id in user_sockets and request.sid in user_sockets[user_id]:
                    user_sockets[user_id].remove(request.sid)
                emit('notifications_left', {'user_id': user_id})
        except Exception as e:
            print(f"[WebSocket] Leave notifications error: {e}")


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


# ============================================================
# Chat API Endpoints
# ============================================================

@app.route('/api/chat/conversations', methods=['GET'])
@login_required
def get_conversations():
    """Get all conversations for the current user, including friends without conversations"""
    token = request.headers['Authorization'].split(' ')[1]
    user_info = jwt_service.verify_token(token)
    if not user_info:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user_id = user_info['user_id']
    db = get_db()

    try:
        # Get all accepted friends
        friendships = db.query(Friendship).filter(
            or_(
                and_(Friendship.user_id == user_id, Friendship.status == 'accepted'),
                and_(Friendship.friend_id == user_id, Friendship.status == 'accepted')
            )
        ).all()

        # Build a dict of friend_id -> friend info
        friends_dict = {}
        for friendship in friendships:
            friend_id = friendship.friend_id if friendship.user_id == user_id else friendship.user_id
            friend = db.query(User).filter(User.user_id == friend_id).first()
            if friend:
                friends_dict[friend_id] = {
                    'friend_id': friend_id,
                    'friend_name': friend.user_name,
                    'friend_email': friend.user_email,
                }

        # Get all conversations where user is either user1 or user2
        conversations = db.query(Conversation).filter(
            or_(
                Conversation.user1_id == user_id,
                Conversation.user2_id == user_id
            )
        ).order_by(desc(Conversation.updated_at)).all()

        result = []
        total_unread = 0
        friends_with_conv = set()

        # First add conversations with messages
        for conv in conversations:
            # Determine the friend (the other user)
            friend_id = conv.user2_id if conv.user1_id == user_id else conv.user1_id
            friends_with_conv.add(friend_id)

            friend = db.query(User).filter(User.user_id == friend_id).first()
            if not friend:
                continue

            # Get unread count for this conversation
            unread_count = db.query(func.count(Message.id)).filter(
                Message.conversation_id == conv.id,
                Message.sender_id != user_id,
                Message.is_read == False
            ).scalar()

            total_unread += unread_count

            # Get last message
            last_message = db.query(Message).filter(
                Message.conversation_id == conv.id
            ).order_by(desc(Message.created_at)).first()

            result.append({
                'id': conv.id,
                'friend_id': friend_id,
                'friend_name': friend.user_name,
                'friend_email': friend.user_email,
                'last_message': last_message.content if last_message else None,
                'last_message_time': last_message.created_at.isoformat() if last_message else None,
                'unread_count': unread_count,
            })

        # Then add friends without conversations
        for friend_id, friend_info in friends_dict.items():
            if friend_id not in friends_with_conv:
                result.append({
                    'id': None,  # No conversation yet
                    'friend_id': friend_id,
                    'friend_name': friend_info['friend_name'],
                    'friend_email': friend_info['friend_email'],
                    'last_message': None,
                    'last_message_time': None,
                    'unread_count': 0,
                })

        return jsonify({
            'success': True,
            'conversations': result,
            'total_unread': total_unread
        })

    except Exception as e:
        print(f"Error getting conversations: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/chat/messages/<int:conversation_id>', methods=['GET'])
@login_required
def get_messages(conversation_id):
    """Get messages for a conversation"""
    token = request.headers['Authorization'].split(' ')[1]
    user_info = jwt_service.verify_token(token)
    if not user_info:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user_id = user_info['user_id']
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 30, type=int)
    offset = (page - 1) * limit

    db = get_db()

    try:
        # Verify user is part of this conversation
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            or_(
                Conversation.user1_id == user_id,
                Conversation.user2_id == user_id
            )
        ).first()

        if not conv:
            return jsonify({'success': False, 'error': 'Conversation not found'}), 404

        # Get messages with pagination (newest first for pagination, then reverse)
        total = db.query(func.count(Message.id)).filter(
            Message.conversation_id == conversation_id
        ).scalar()

        messages = db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).order_by(desc(Message.created_at)).offset(offset).limit(limit).all()

        # Reverse to get chronological order
        messages = list(reversed(messages))

        result = []
        for msg in messages:
            sender = db.query(User).filter(User.user_id == msg.sender_id).first()
            result.append({
                'id': msg.id,
                'conversation_id': msg.conversation_id,
                'sender_id': msg.sender_id,
                'sender_name': sender.user_name if sender else 'Unknown',
                'content': msg.content,
                'is_read': msg.is_read,
                'created_at': msg.created_at.isoformat(),
            })

        return jsonify({
            'success': True,
            'messages': result,
            'total': total,
            'page': page,
            'limit': limit,
            'has_more': offset + limit < total
        })

    except Exception as e:
        print(f"Error getting messages: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/chat/send', methods=['POST'])
@login_required
def send_message():
    """Send a message to a conversation"""
    token = request.headers['Authorization'].split(' ')[1]
    user_info = jwt_service.verify_token(token)
    if not user_info:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user_id = user_info['user_id']
    data = request.get_json()
    conversation_id = data.get('conversation_id')
    content = data.get('content', '').strip()

    if not conversation_id or not content:
        return jsonify({'success': False, 'error': 'conversation_id and content are required'}), 400

    db = get_db()

    try:
        # Verify user is part of this conversation
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            or_(
                Conversation.user1_id == user_id,
                Conversation.user2_id == user_id
            )
        ).first()

        if not conv:
            return jsonify({'success': False, 'error': 'Conversation not found'}), 404

        # Create message
        message = Message(
            conversation_id=conversation_id,
            sender_id=user_id,
            content=content
        )
        db.add(message)

        # Update conversation timestamp
        conv.updated_at = datetime.utcnow()

        db.commit()

        # Notify via WebSocket
        friend_id = conv.user2_id if conv.user1_id == user_id else conv.user1_id
        sender = db.query(User).filter(User.user_id == user_id).first()

        socketio.emit('new_message', {
            'id': message.id,
            'conversation_id': conversation_id,
            'sender_id': user_id,
            'sender_name': sender.user_name if sender else 'Unknown',
            'content': content,
            'created_at': message.created_at.isoformat()
        }, room=f'user_{friend_id}')

        return jsonify({
            'success': True,
            'message': {
                'id': message.id,
                'conversation_id': conversation_id,
                'sender_id': user_id,
                'content': content,
                'created_at': message.created_at.isoformat()
            }
        })

    except Exception as e:
        db.rollback()
        print(f"Error sending message: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/chat/start', methods=['POST'])
@login_required
def start_conversation():
    """Start a new conversation with a friend"""
    token = request.headers['Authorization'].split(' ')[1]
    user_info = jwt_service.verify_token(token)
    if not user_info:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user_id = user_info['user_id']
    data = request.get_json()
    friend_id = data.get('friend_id')

    if not friend_id:
        return jsonify({'success': False, 'error': 'friend_id is required'}), 400

    db = get_db()

    try:
        # Check if they are friends
        friendship = db.query(Friendship).filter(
            Friendship.status == 'accepted',
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_id == friend_id),
                and_(Friendship.user_id == friend_id, Friendship.friend_id == user_id)
            )
        ).first()

        if not friendship:
            return jsonify({'success': False, 'error': 'You are not friends with this user'}), 400

        # Check if conversation already exists
        conv = db.query(Conversation).filter(
            or_(
                and_(Conversation.user1_id == user_id, Conversation.user2_id == friend_id),
                and_(Conversation.user1_id == friend_id, Conversation.user2_id == user_id)
            )
        ).first()

        if conv:
            # Return existing conversation
            friend = db.query(User).filter(User.user_id == friend_id).first()
            return jsonify({
                'success': True,
                'conversation': {
                    'id': conv.id,
                    'friend_id': friend_id,
                    'friend_name': friend.user_name if friend else 'Unknown',
                    'friend_email': friend.user_email if friend else '',
                },
                'existing': True
            })

        # Create new conversation
        conv = Conversation(
            user1_id=user_id,
            user2_id=friend_id
        )
        db.add(conv)
        db.commit()

        friend = db.query(User).filter(User.user_id == friend_id).first()

        return jsonify({
            'success': True,
            'conversation': {
                'id': conv.id,
                'friend_id': friend_id,
                'friend_name': friend.user_name if friend else 'Unknown',
                'friend_email': friend.user_email if friend else '',
            },
            'existing': False
        })

    except Exception as e:
        db.rollback()
        print(f"Error starting conversation: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/chat/read/<int:conversation_id>', methods=['POST'])
@login_required
def mark_messages_read(conversation_id):
    """Mark all messages in a conversation as read"""
    token = request.headers['Authorization'].split(' ')[1]
    user_info = jwt_service.verify_token(token)
    if not user_info:
        return jsonify({'success': False, 'error': 'Invalid token'}), 401

    user_id = user_info['user_id']
    db = get_db()

    try:
        # Verify user is part of this conversation
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            or_(
                Conversation.user1_id == user_id,
                Conversation.user2_id == user_id
            )
        ).first()

        if not conv:
            return jsonify({'success': False, 'error': 'Conversation not found'}), 404

        # Mark messages from the other user as read
        db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id,
            Message.is_read == False
        ).update({'is_read': True})

        db.commit()

        # Notify the sender that messages were read
        friend_id = conv.user2_id if conv.user1_id == user_id else conv.user1_id
        socketio.emit('message_read', {
            'conversation_id': conversation_id,
            'reader_id': user_id
        }, room=f'user_{friend_id}')

        return jsonify({'success': True})

    except Exception as e:
        db.rollback()
        print(f"Error marking messages as read: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()


# ============================================================
# User WebSocket Events (for chat and notifications)
# ============================================================

@socketio.on('join_user')
def on_join_user(data):
    """Join user's personal room for notifications and chat"""
    token = data.get('token')
    if not token:
        return

    user_info = jwt_service.verify_token(token)
    if not user_info:
        return

    user_id = user_info['user_id']
    room = f'user_{user_id}'
    join_room(room)
    print(f'User {user_id} joined room {room}')


@socketio.on('leave_user')
def on_leave_user(data):
    """Leave user's personal room"""
    token = data.get('token')
    if not token:
        return

    user_info = jwt_service.verify_token(token)
    if not user_info:
        return

    user_id = user_info['user_id']
    room = f'user_{user_id}'
    leave_room(room)
    print(f'User {user_id} left room {room}')


@socketio.on('join_conversation')
def on_join_conversation(data):
    """Join a conversation room for real-time messages"""
    conversation_id = data.get('conversation_id')
    if conversation_id:
        room = f'conversation_{conversation_id}'
        join_room(room)


@socketio.on('leave_conversation')
def on_leave_conversation(data):
    """Leave a conversation room"""
    conversation_id = data.get('conversation_id')
    if conversation_id:
        room = f'conversation_{conversation_id}'
        leave_room(room)


@socketio.on('typing')
def on_typing(data):
    """Broadcast typing indicator"""
    conversation_id = data.get('conversation_id')
    user_id = data.get('user_id')
    is_typing = data.get('is_typing', False)

    if conversation_id:
        room = f'conversation_{conversation_id}'
        emit('typing', {
            'conversation_id': conversation_id,
            'user_id': user_id,
            'is_typing': is_typing
        }, room=room, include_self=False)


@socketio.on('friend_request_accepted')
def on_friend_request_accepted(data):
    """Broadcast friend request acceptance"""
    request_id = data.get('request_id')
    if request_id:
        # Get the friendship to find the other user
        db = get_db()
        try:
            friendship = db.query(Friendship).filter(Friendship.id == request_id).first()
            if friendship:
                # Notify both users
                socketio.emit('friend_request_accepted', {
                    'request_id': request_id
                }, room=f'user_{friendship.user_id}')
                socketio.emit('friend_request_accepted', {
                    'request_id': request_id
                }, room=f'user_{friendship.friend_id}')
        finally:
            db.close()


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5001))
    debug = os.getenv('FLASK_ENV') == 'development'

    # SocketIO로 실행
    socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True)
