import os
from sqlalchemy import create_engine, Column, String, Integer, Boolean, ForeignKey, select, delete, DateTime, Text, Date
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session
from sqlalchemy_utils import PasswordType
from datetime import datetime, date

import json
import csv


# 데이터베이스 경로 설정
LOCAL_DATABASE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cardealo.db')
cards_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ai/cards.json')
card_benefits_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ai/card_benefits.csv')

# DATABASE_URL 환경변수 사용 (Railway에서 자동 제공)
# 로컬에서는 SQLite 사용
DATABASE_URL = os.environ.get('DATABASE_URL', f"sqlite:///{LOCAL_DATABASE}")

# Railway PostgreSQL URL 수정 (postgres:// -> postgresql://)
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

# SQLAlchemy 설정
is_sqlite = DATABASE_URL.startswith('sqlite')
engine_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=engine_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# 모델 정의
class User(Base):
    __tablename__ = 'user'

    user_id = Column(String, primary_key=True)
    user_name = Column(String)
    user_email = Column(String, unique=True)
    user_pw = Column(PasswordType(schemes=['pbkdf2_sha512', 'md5_crypt'], deprecated=['md5_crypt']))
    user_age = Column(Integer)
    user_phone = Column(String)
    monthly_spending = Column(Integer, default=0)
    monthly_savings = Column(Integer, default=0)
    isBusiness = Column(Boolean, default=False)
    balance = Column(Integer, default=0)  # 사용자 잔액 (원)

    mycards = relationship("MyCard", back_populates="user", cascade="all, delete-orphan")


class MyCard(Base):
    __tablename__ = 'mycard'

    cid = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('user.user_id'))
    mycard_name = Column(String)
    mycard_detail = Column(String)
    mycard_pre_month_money = Column(Integer)
    mycard_pre_YN = Column(Boolean, default=False)

    # 새로 추가되는 필드 (결제 시스템용)
    monthly_limit = Column(Integer, default=0)  # 월 한도 (원)
    used_amount = Column(Integer, default=0)  # 사용 금액 (원)
    monthly_performance = Column(Integer, default=0)  # 월 실적 (원)
    daily_count = Column(Integer, default=0)  # 일 사용 횟수
    monthly_count = Column(Integer, default=0)  # 월 사용 횟수
    last_used_date = Column(Date)  # 마지막 사용 날짜
    reset_date = Column(Date)  # 한도 리셋 날짜 (매월 1일)

    user = relationship("User", back_populates="mycards")

class Card(Base):
    __tablename__ = 'card'

    card_id = Column(Integer, primary_key=True, autoincrement=True)
    card_name = Column(String, unique=True)  # unique for FK reference from CardBenefit
    card_benefit = Column(String)
    card_pre_month_money = Column(Integer)
    card_benefits = relationship("CardBenefit", back_populates="card")

class CardBenefit(Base):
    __tablename__ = 'card_benefit'

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_name = Column(String, ForeignKey('card.card_name'))

    # Category and merchant matching
    category = Column(String)  # 'convenience', 'mart', 'cafe', etc.
    places = Column(String)  # JSON array: '["CU", "GS25"]' or null for all

    # Discount configuration
    discount_type = Column(String)  # 'percent', 'amount', 'point', 'per_unit'
    discount_value = Column(Integer)  # 10 (for 10%), 1000 (for 1000원)
    max_discount = Column(Integer)  # 최대 할인/적립 금액

    # Pre-month requirements (JSON)
    pre_month_config = Column(String)  # JSON: 전월실적 티어 정보

    # Limit conditions (JSON)
    limit_config = Column(String)  # JSON: 사용 제한 조건들

    # Display fields (원본 자연어)
    places_display = Column(String)  # "CU, GS25, 세븐일레븐"
    discount_display = Column(String)  # "10% 할인"
    limit_display = Column(String)  # "일 1회, 월 5회..."
    max_discount_display = Column(String)  # "1회 최대 1천원"

    card = relationship("Card", back_populates="card_benefits")


class SavedCourse(Base):
    __tablename__ = 'saved_course'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('user.user_id'))
    title = Column(String, nullable=False)
    description = Column(Text)
    stops = Column(Text)  # JSON: 코스 장소 목록
    route_info = Column(Text)  # JSON: 경로 정보
    total_distance = Column(Integer)  # 총 거리 (미터)
    total_duration = Column(Integer)  # 총 소요 시간 (분)
    total_benefit_score = Column(Integer)  # 총 혜택 점수
    num_people = Column(Integer, default=2)  # 인원
    budget = Column(Integer, default=100000)  # 예산
    created_at = Column(DateTime, default=datetime.utcnow)
    save_count = Column(Integer, default=0)  # 저장 횟수 (인기도)

    user = relationship("User")


class SavedCourseUser(Base):
    """사용자가 저장한 코스 (다대다 관계)"""
    __tablename__ = 'saved_course_user'

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey('saved_course.id'))
    user_id = Column(String, ForeignKey('user.user_id'))
    saved_at = Column(DateTime, default=datetime.utcnow)


class SharedCourse(Base):
    """친구에게 공유된 코스"""
    __tablename__ = 'shared_course'

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey('saved_course.id'), nullable=False)
    shared_by = Column(String, ForeignKey('user.user_id'), nullable=False)  # 공유한 사람
    shared_to = Column(String, ForeignKey('user.user_id'), nullable=False)  # 공유받은 사람
    shared_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("SavedCourse")
    sender = relationship("User", foreign_keys=[shared_by])
    receiver = relationship("User", foreign_keys=[shared_to])


class Friendship(Base):
    """친구 관계 테이블"""
    __tablename__ = 'friendship'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('user.user_id'), nullable=False)  # 요청한 사용자
    friend_id = Column(String, ForeignKey('user.user_id'), nullable=False)  # 요청받은 사용자
    status = Column(String, default='pending')  # pending, accepted, rejected, blocked
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], backref="friendships_sent")
    friend = relationship("User", foreign_keys=[friend_id], backref="friendships_received")
    


class PaymentHistory(Base):
    """결제 내역 (관리자 시스템에서 전송받음)"""
    __tablename__ = 'payment_history'

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(36), unique=True, nullable=False)
    user_id = Column(String, ForeignKey('user.user_id'))
    card_id = Column(Integer, nullable=True)  # 개인카드 cid (법인카드인 경우 null)
    corporate_card_id = Column(Integer, nullable=True)  # 법인카드 id (개인카드인 경우 null)
    is_corporate = Column(Boolean, default=False)  # 법인카드 결제 여부
    merchant_name = Column(String)
    payment_amount = Column(Integer)
    discount_amount = Column(Integer)
    final_amount = Column(Integer)
    benefit_text = Column(Text)
    payment_date = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class QRScanStatus(Base):
    """QR 스캔 상태 추적"""
    __tablename__ = 'qr_scan_status'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('user.user_id'))
    card_id = Column(Integer)  # 개인카드 cid 또는 법인카드 id
    is_corporate = Column(Boolean, default=False)  # 법인카드 여부
    timestamp = Column(Integer, nullable=False)  # QR 생성 시간
    status = Column(String, default='waiting')  # waiting, scanned, processing, completed, failed, cancelled
    merchant_name = Column(String)
    scanned_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


# ============ 법인카드 관련 모델들 ============

class CorporateCard(Base):
    """법인카드 정보"""
    __tablename__ = 'corporate_card'

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_name = Column(String, nullable=False)
    card_number = Column(String)  # 마스킹된 카드번호 (예: ****-****-****-1234)
    card_company = Column(String)  # 카드사
    owner_user_id = Column(String, ForeignKey('user.user_id'), nullable=False)  # 법인카드 소유자 (관리자)
    monthly_limit = Column(Integer, default=10000000)  # 월 한도 (기본 1000만원)
    used_amount = Column(Integer, default=0)  # 사용 금액
    benefit_summary = Column(Text)  # 혜택 요약
    benefits_json = Column(Text)  # JSON 형태의 혜택 상세
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", backref="corporate_cards")
    members = relationship("CorporateCardMember", back_populates="corporate_card", cascade="all, delete-orphan")
    departments = relationship("Department", back_populates="corporate_card", cascade="all, delete-orphan")
    payments = relationship("CorporatePaymentHistory", back_populates="corporate_card", cascade="all, delete-orphan")


class Department(Base):
    """부서 정보"""
    __tablename__ = 'department'

    id = Column(Integer, primary_key=True, autoincrement=True)
    corporate_card_id = Column(Integer, ForeignKey('corporate_card.id'), nullable=False)
    name = Column(String, nullable=False)  # 부서명
    monthly_limit = Column(Integer, default=2000000)  # 부서별 월 한도 (기본 200만원)
    used_amount = Column(Integer, default=0)  # 사용 금액
    color = Column(String, default='#4AA63C')  # UI 표시용 색상
    created_at = Column(DateTime, default=datetime.utcnow)

    corporate_card = relationship("CorporateCard", back_populates="departments")
    members = relationship("CorporateCardMember", back_populates="department")


class CorporateCardMember(Base):
    """법인카드 팀원 (이메일로 초대)"""
    __tablename__ = 'corporate_card_member'

    id = Column(Integer, primary_key=True, autoincrement=True)
    corporate_card_id = Column(Integer, ForeignKey('corporate_card.id'), nullable=False)
    user_id = Column(String, ForeignKey('user.user_id'))  # 가입된 사용자 연결 (nullable - 초대 상태일 때는 null)
    invited_email = Column(String, nullable=False)  # 초대된 이메일
    department_id = Column(Integer, ForeignKey('department.id'))  # 소속 부서
    role = Column(String, default='member')  # admin, manager, member
    monthly_limit = Column(Integer, default=500000)  # 개인별 월 한도 (기본 50만원)
    used_amount = Column(Integer, default=0)  # 사용 금액
    status = Column(String, default='pending')  # pending, active, inactive
    invited_at = Column(DateTime, default=datetime.utcnow)
    joined_at = Column(DateTime)  # 초대 수락 시간

    corporate_card = relationship("CorporateCard", back_populates="members")
    user = relationship("User", backref="corporate_memberships")
    department = relationship("Department", back_populates="members")


class Notification(Base):
    """사용자 알림"""
    __tablename__ = 'notification'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('user.user_id'), nullable=False)
    type = Column(String, nullable=False)  # payment, benefit_tip, friend_request, friend_accepted, course_shared, system
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    data = Column(Text)  # JSON: 추가 데이터 (action_type, action_target 등)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="notifications")


class CorporatePaymentHistory(Base):
    """법인카드 결제 내역"""
    __tablename__ = 'corporate_payment_history'

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(36), unique=True, nullable=False)
    corporate_card_id = Column(Integer, ForeignKey('corporate_card.id'), nullable=False)
    member_id = Column(Integer, ForeignKey('corporate_card_member.id'))  # 결제한 팀원
    user_id = Column(String, ForeignKey('user.user_id'))  # 결제한 사용자
    merchant_name = Column(String)
    merchant_category = Column(String)  # 가맹점 카테고리
    payment_amount = Column(Integer)
    discount_amount = Column(Integer, default=0)
    final_amount = Column(Integer)
    benefit_text = Column(Text)
    receipt_image = Column(Text)  # 영수증 이미지 (base64 또는 URL)
    receipt_ocr_data = Column(Text)  # OCR 추출 데이터 (JSON)
    payment_date = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime)  # 동기화 시간

    corporate_card = relationship("CorporateCard", back_populates="payments")
    member = relationship("CorporateCardMember")
    user = relationship("User")


class Conversation(Base):
    """채팅 대화방 (두 사용자 간의 1:1 대화)"""
    __tablename__ = 'conversation'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user1_id = Column(String, ForeignKey('user.user_id'), nullable=False)
    user2_id = Column(String, ForeignKey('user.user_id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    """채팅 메시지"""
    __tablename__ = 'message'

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey('conversation.id'), nullable=False)
    sender_id = Column(String, ForeignKey('user.user_id'), nullable=False)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User")


class RouteCache(Base):
    """경로 정보 캐시 (API 비용 절감)"""
    __tablename__ = 'route_cache'

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 캐시 키: 좌표 + 모드 조합 (좌표는 소수점 4자리로 반올림하여 약 11m 정확도)
    cache_key = Column(String, unique=True, nullable=False, index=True)
    origin_lat = Column(String, nullable=False)  # 소수점 4자리
    origin_lng = Column(String, nullable=False)
    dest_lat = Column(String, nullable=False)
    dest_lng = Column(String, nullable=False)
    mode = Column(String, nullable=False)  # walking, driving, transit

    # 캐시된 응답 데이터 (JSON)
    response_data = Column(Text, nullable=False)

    # 메타데이터
    created_at = Column(DateTime, default=datetime.utcnow)
    hit_count = Column(Integer, default=0)  # 캐시 적중 횟수
    last_hit_at = Column(DateTime)  # 마지막 캐시 적중 시간


def get_db() -> Session:
    """
    데이터베이스 세션을 가져옵니다.
    사용 후 반드시 db.close()를 호출하거나 컨텍스트 매니저로 사용하세요.
    
    사용 예시:
        db = get_db()
        try:
            # 데이터베이스 작업
            user = db.query(User).filter(User.user_id == 'test').first()
        finally:
            db.close()
    """
    return SessionLocal()


def create_test_user():
    """테스트 사용자 5명을 생성합니다"""
    db = get_db()

    test_users = [
        {
            'user_id': 'hong_gildong',
            'user_name': '홍길동',
            'user_email': 'hong@cardealo.com',
            'user_pw': 'test1234!',
            'user_age': 28,
            'user_phone': '010-1111-1111',
            'card_names': ['신한카드 The CLASSIC-Y', '신한카드 B.Big(삑)', '신한카드 Deep Oil']
        },
        {
            'user_id': 'hong_gilsoon',
            'user_name': '홍길순',
            'user_email': 'gilsoon@cardealo.com',
            'user_pw': 'test1234!',
            'user_age': 26,
            'user_phone': '010-2222-2222',
            'card_names': ['신세계 신한카드', '신한카드 Simple+', '신한카드 Mr.Life']
        },
        {
            'user_id': 'kim_chulsoo',
            'user_name': '김철수',
            'user_email': 'kim@cardealo.com',
            'user_pw': 'test1234!',
            'user_age': 32,
            'user_phone': '010-3333-3333',
            'card_names': ['GS칼텍스 신한카드 Shine', '신한카드 Shopping']
        },
        {
            'user_id': 'lee_younghee',
            'user_name': '이영희',
            'user_email': 'lee@cardealo.com',
            'user_pw': 'test1234!',
            'user_age': 29,
            'user_phone': '010-4444-4444',
            'card_names': ['신한카드 Edu', '신한카드 YOLO ⓘ', '신한카드 The BEST-F', '신한카드 Deep Store']
        },
        {
            'user_id': 'park_minsoo',
            'user_name': '박민수',
            'user_email': 'park@cardealo.com',
            'user_pw': 'test1234!',
            'user_age': 35,
            'user_phone': '010-5555-5555',
            'card_names': ['신한카드 Air Platinum#', '신한카드 Simple Platinum#']
        }
    ]

    try:
        created_count = 0
        for user_data in test_users:
            # 사용자가 이미 존재하는지 확인
            existing_user = db.scalars(select(User).where(User.user_id == user_data['user_id'])).first()
            if existing_user:
                continue

            # 테스트 사용자 생성
            test_user = User(
                user_id=user_data['user_id'],
                user_name=user_data['user_name'],
                user_email=user_data['user_email'],
                user_pw=user_data['user_pw'],
                user_age=user_data['user_age'],
                user_phone=user_data['user_phone'],
                monthly_spending=0,
                monthly_savings=0,
                isBusiness=False
            )
            db.add(test_user)
            db.commit()

            # 사용자의 카드 추가 - Card 테이블에서 실제 데이터 가져오기
            for card_name in user_data['card_names']:
                card = db.scalars(select(Card).where(Card.card_name == card_name)).first()
                if card:
                    my_card = MyCard(
                        user_id=user_data['user_id'],
                        mycard_name=card.card_name,
                        mycard_detail=card.card_benefit,
                        mycard_pre_month_money=card.card_pre_month_money or 300000,
                        mycard_pre_YN=True if card.card_pre_month_money and card.card_pre_month_money > 0 else False
                    )
                    db.add(my_card)
                else:
                    print(f'[DB] Warning: Card "{card_name}" not found in Card table')

            db.commit()
            created_count += 1

        if created_count > 0:
            print(f'[DB] {created_count} test users created successfully')
        else:
            print('[DB] All test users already exist')

    except Exception as e:
        db.rollback()
        print(f'[DB] Failed to create test users: {e}')
    finally:
        db.close()


def init_db():
    """데이터베이스 초기화 및 시딩"""
    from sqlalchemy import inspect

    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    required_tables = ['card', 'card_benefit', 'user', 'mycard', 'corporate_card']

    missing_tables = [t for t in required_tables if t not in existing_tables]
    if missing_tables:
        print(f'[DB] Creating missing tables: {missing_tables}')
        Base.metadata.create_all(engine, checkfirst=True)
        print('[DB] All tables created successfully')
        # Re-inspect after creation
        inspector = inspect(engine)

    # Auto-migration: Add balance column if not exists
    try:
        user_columns = [col['name'] for col in inspector.get_columns('user')]
        if 'balance' not in user_columns:
            from sqlalchemy import text
            with engine.connect() as conn:
                # PostgreSQL and SQLite compatible syntax
                if 'postgresql' in DATABASE_URL:
                    conn.execute(text('ALTER TABLE "user" ADD COLUMN balance INTEGER DEFAULT 0'))
                else:
                    conn.execute(text('ALTER TABLE user ADD COLUMN balance INTEGER DEFAULT 0'))
                conn.commit()
            print('[DB] Added balance column to user table')
    except Exception as e:
        print(f'[DB] Auto-migration check (user.balance): {e}')

    # Auto-migration: Add is_corporate column to qr_scan_status if not exists
    try:
        if 'qr_scan_status' in inspector.get_table_names():
            qr_columns = [col['name'] for col in inspector.get_columns('qr_scan_status')]
            if 'is_corporate' not in qr_columns:
                from sqlalchemy import text
                with engine.connect() as conn:
                    conn.execute(text('ALTER TABLE qr_scan_status ADD COLUMN is_corporate BOOLEAN DEFAULT FALSE'))
                    conn.commit()
                print('[DB] Added is_corporate column to qr_scan_status table')
    except Exception as e:
        print(f'[DB] Auto-migration check (qr_scan_status.is_corporate): {e}')

    # Auto-migration: Add unique constraint to card.card_name for PostgreSQL FK support
    try:
        if 'card' in inspector.get_table_names():
            # Check if unique constraint exists
            indexes = inspector.get_indexes('card')
            unique_on_card_name = any(
                idx.get('unique') and 'card_name' in idx.get('column_names', [])
                for idx in indexes
            )
            if not unique_on_card_name:
                from sqlalchemy import text
                with engine.connect() as conn:
                    if 'postgresql' in DATABASE_URL:
                        conn.execute(text('ALTER TABLE card ADD CONSTRAINT card_card_name_key UNIQUE (card_name)'))
                    else:
                        conn.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS idx_card_card_name ON card (card_name)'))
                    conn.commit()
                print('[DB] Added unique constraint to card.card_name')
    except Exception as e:
        print(f'[DB] Auto-migration check (card.card_name unique): {e}')

    # Auto-migration: Add corporate_card_id and is_corporate columns to payment_history
    try:
        if 'payment_history' in inspector.get_table_names():
            ph_columns = [col['name'] for col in inspector.get_columns('payment_history')]
            from sqlalchemy import text
            with engine.connect() as conn:
                if 'corporate_card_id' not in ph_columns:
                    conn.execute(text('ALTER TABLE payment_history ADD COLUMN corporate_card_id INTEGER'))
                    print('[DB] Added corporate_card_id column to payment_history table')
                if 'is_corporate' not in ph_columns:
                    conn.execute(text('ALTER TABLE payment_history ADD COLUMN is_corporate BOOLEAN DEFAULT FALSE'))
                    print('[DB] Added is_corporate column to payment_history table')
                conn.commit()
    except Exception as e:
        print(f'[DB] Auto-migration check (payment_history columns): {e}')

    with open(cards_path, 'r', encoding='utf-8') as f:
        cards_data = json.load(f)
    card_benefits_data = csv.reader(open(card_benefits_path, 'r', encoding='utf-8'))

    db = get_db()
    try:
        for card_name in cards_data:
            existing_card = db.scalars(select(Card).where(Card.card_name == card_name)).first()
            if existing_card:
                continue

            card = cards_data[card_name]
            card_pre_month_money = card.get('pre_month_money', 0)
            card_benefit = ''
            for benefit in card.get('key_benefit', []):
                card_benefit += benefit + '\n'

            new_card = Card(card_name=card_name, card_benefit=card_benefit, card_pre_month_money=card_pre_month_money)
            db.add(new_card)
        db.commit()
        # Helper to convert "null" string to None for integer columns
        def parse_int(val):
            if val is None or val == '' or val.lower() == 'null':
                return None
            try:
                return int(val)
            except (ValueError, TypeError):
                return None

        for row in card_benefits_data:
            card_name, category, places, discount_type, discount_value, max_discount, pre_month_config, limit_config, places_display, discount_display, limit_display, max_discount_display = row
            if card_name in cards_data:
                existing_card = db.scalars(select(CardBenefit).where(CardBenefit.card_name == card_name)).first()
                if existing_card:
                    continue
                new_card_benefit = CardBenefit(
                    card_name=card_name,
                    category=category,
                    places=places if places and places.lower() != 'null' else None,
                    discount_type=discount_type,
                    discount_value=parse_int(discount_value),
                    max_discount=parse_int(max_discount),
                    pre_month_config=pre_month_config if pre_month_config and pre_month_config.lower() != 'null' else None,
                    limit_config=limit_config if limit_config and limit_config.lower() != 'null' else None,
                    places_display=places_display,
                    discount_display=discount_display,
                    limit_display=limit_display,
                    max_discount_display=max_discount_display
                )
                db.add(new_card_benefit)
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

    # 테스트 사용자 자동 생성
    create_test_user()

    # 법인카드 테스트 데이터 생성
    create_corporate_cards()


def create_corporate_cards():
    """실제 한국 법인카드 상품 5개를 생성합니다"""
    db = get_db()

    # 실제 한국 법인카드 상품 데이터 (5개)
    corporate_cards_data = [
        {
            'card_name': '신한 법인카드',
            'card_number': '9411-7800-1234-1234',
            'card_company': '신한카드',
            'owner_email': 'hong@cardealo.com',
            'monthly_limit': 20000000,
            'benefit_summary': '전 가맹점 0.1% 마이신한포인트 적립, 연간 적립한도 없음',
            'benefits_json': json.dumps({
                'categories': [
                    {'category': '전가맹점', 'discount_type': 'point', 'discount_value': 0.1, 'max_discount': None, 'description': '정상결제금액의 0.1% 기본 적립'},
                    {'category': '신한은행가맹점', 'discount_type': 'point', 'discount_value': 0.3, 'max_discount': None, 'description': '신한은행 결제계좌 연결 가맹점 추가 적립'}
                ],
                'pre_month_requirement': 0,
                'annual_fee': {'local': 5000, 'visa_master': 10000}
            }, ensure_ascii=False),
            'departments': [
                {'name': '영업팀', 'monthly_limit': 5000000, 'color': '#0046FF'},
                {'name': '물류팀', 'monthly_limit': 8000000, 'color': '#4CAF50'}
            ]
        },
        {
            'card_name': '삼성카드 CORPORATE #2',
            'card_number': '****-****-****-5678',
            'card_company': '삼성카드',
            'owner_email': 'hong@cardealo.com',
            'monthly_limit': 50000000,
            'benefit_summary': '국내외 전 가맹점 0.2% 캐시백 또는 빅포인트 적립',
            'benefits_json': json.dumps({
                'categories': [
                    {'category': '국내가맹점', 'discount_type': 'cashback', 'discount_value': 0.2, 'max_discount': None},
                    {'category': '해외가맹점', 'discount_type': 'cashback', 'discount_value': 0.2, 'max_discount': None},
                    {'category': '빅포인트', 'discount_type': 'point', 'discount_value': 0.2, 'max_discount': None, 'description': '캐시백 대신 빅포인트 선택 가능'}
                ],
                'pre_month_requirement': 0
            }, ensure_ascii=False),
            'departments': [
                {'name': '마케팅팀', 'monthly_limit': 10000000, 'color': '#0066B3'},
                {'name': '개발팀', 'monthly_limit': 15000000, 'color': '#FF5722'},
                {'name': '경영지원팀', 'monthly_limit': 8000000, 'color': '#607D8B'}
            ]
        },
        {
            'card_name': '삼성카드 CORPORATE 마일리지',
            'card_number': '****-****-****-9012',
            'card_company': '삼성카드',
            'owner_email': 'hong@cardealo.com',
            'monthly_limit': 30000000,
            'benefit_summary': '전월실적/적립한도 없이 스카이패스 마일리지 적립',
            'benefits_json': json.dumps({
                'categories': [
                    {'category': '전가맹점', 'discount_type': 'mileage', 'discount_value': 1000, 'unit': '원당 1마일', 'max_mileage': None, 'description': '스카이패스 마일리지 무제한 적립'},
                    {'category': '대한항공', 'discount_type': 'mileage', 'discount_value': 1000, 'unit': '원당 2마일', 'max_mileage': None, 'description': '대한항공 결제 시 2배 적립'}
                ],
                'pre_month_requirement': 0
            }, ensure_ascii=False),
            'departments': [
                {'name': '해외영업팀', 'monthly_limit': 15000000, 'color': '#00BCD4'}
            ]
        },
        {
            'card_name': '현대카드 M 포인트 법인',
            'card_number': '****-****-****-3456',
            'card_company': '현대카드',
            'owner_email': 'hong@cardealo.com',
            'monthly_limit': 100000000,
            'benefit_summary': '전가맹점 0.5~1% M포인트 적립, 주유/통신료 추가 적립',
            'benefits_json': json.dumps({
                'categories': [
                    {'category': '전가맹점', 'discount_type': 'point', 'discount_value': 0.5, 'max_discount': None, 'description': 'M포인트 기본 적립'},
                    {'category': '주유', 'discount_type': 'point', 'discount_value': 1, 'max_discount': 50000, 'description': 'SK/GS/S-OIL/현대오일뱅크'},
                    {'category': '통신료', 'discount_type': 'point', 'discount_value': 1, 'max_discount': 30000, 'description': 'SKT/KT/LG U+ 자동이체'}
                ],
                'pre_month_requirement': 300000
            }, ensure_ascii=False),
            'departments': [
                {'name': '임원실', 'monthly_limit': 50000000, 'color': '#1A1A1A'}
            ]
        },
        {
            'card_name': 'KB국민 비즈 법인카드',
            'card_number': '****-****-****-7890',
            'card_company': 'KB국민카드',
            'owner_email': 'hong@cardealo.com',
            'monthly_limit': 15000000,
            'benefit_summary': '전가맹점 0.2% 포인트리 적립, 주유/대형마트 추가 할인',
            'benefits_json': json.dumps({
                'categories': [
                    {'category': '전가맹점', 'discount_type': 'point', 'discount_value': 0.2, 'max_discount': None, 'description': '포인트리 기본 적립'},
                    {'category': '주유', 'discount_type': 'per_unit', 'discount_value': 60, 'unit': '리터', 'max_discount': 50000, 'description': 'SK/GS/S-OIL/현대오일뱅크'},
                    {'category': '대형마트', 'discount_type': 'percent', 'discount_value': 5, 'places': ['이마트', '홈플러스', '롯데마트'], 'max_discount': 30000}
                ],
                'pre_month_requirement': 300000
            }, ensure_ascii=False),
            'departments': [
                {'name': '총무팀', 'monthly_limit': 5000000, 'color': '#FFBC00'},
                {'name': '구매팀', 'monthly_limit': 8000000, 'color': '#009688'}
            ]
        }
    ]

    try:
        # 먼저 hong@cardealo.com의 기존 법인카드 모두 삭제
        hong_user = db.scalars(
            select(User).where(User.user_email == 'hong@cardealo.com')
        ).first()

        if hong_user:
            existing_cards = db.scalars(
                select(CorporateCard).where(CorporateCard.owner_user_id == hong_user.user_id)
            ).all()

            deleted_count = 0
            for card in existing_cards:
                # 관련 데이터 먼저 삭제 (cascade가 설정되어 있지 않을 수 있으므로 명시적으로)
                db.execute(delete(CorporatePaymentHistory).where(CorporatePaymentHistory.corporate_card_id == card.id))
                db.execute(delete(CorporateCardMember).where(CorporateCardMember.corporate_card_id == card.id))
                db.execute(delete(Department).where(Department.corporate_card_id == card.id))
                db.delete(card)
                deleted_count += 1

            if deleted_count > 0:
                db.commit()  # 삭제 후 커밋하여 중복 체크 시 정확하게 반영
                print(f'[DB] Deleted {deleted_count} existing corporate cards from hong@cardealo.com')

        created_count = 0
        for card_data in corporate_cards_data:
            # 기존 카드가 있으면 삭제 (중복 방지)
            existing_cards = db.scalars(
                select(CorporateCard).where(CorporateCard.card_name == card_data['card_name'])
            ).all()
            for existing_card in existing_cards:
                db.execute(delete(CorporatePaymentHistory).where(CorporatePaymentHistory.corporate_card_id == existing_card.id))
                db.execute(delete(CorporateCardMember).where(CorporateCardMember.corporate_card_id == existing_card.id))
                db.execute(delete(Department).where(Department.corporate_card_id == existing_card.id))
                db.delete(existing_card)
            if existing_cards:
                db.commit()
                print(f'[DB] Deleted {len(existing_cards)} duplicate cards with name: {card_data["card_name"]}')

            # 소유자 찾기
            owner = db.scalars(
                select(User).where(User.user_email == card_data['owner_email'])
            ).first()
            if not owner:
                print(f"[DB] Warning: Owner {card_data['owner_email']} not found")
                continue

            # 법인카드 생성
            corporate_card = CorporateCard(
                card_name=card_data['card_name'],
                card_number=card_data['card_number'],
                card_company=card_data['card_company'],
                owner_user_id=owner.user_id,
                monthly_limit=card_data['monthly_limit'],
                benefit_summary=card_data['benefit_summary'],
                benefits_json=card_data['benefits_json']
            )
            db.add(corporate_card)
            db.flush()  # ID 생성을 위해 flush

            # 부서 생성
            for dept_data in card_data.get('departments', []):
                department = Department(
                    corporate_card_id=corporate_card.id,
                    name=dept_data['name'],
                    monthly_limit=dept_data['monthly_limit'],
                    color=dept_data['color']
                )
                db.add(department)

            # 소유자를 관리자로 자동 등록
            owner_member = CorporateCardMember(
                corporate_card_id=corporate_card.id,
                user_id=owner.user_id,
                invited_email=owner.user_email,
                role='admin',
                monthly_limit=card_data['monthly_limit'],
                status='active',
                joined_at=datetime.utcnow()
            )
            db.add(owner_member)

            created_count += 1

        db.commit()

        if created_count > 0:
            print(f'[DB] {created_count} corporate cards created successfully')
        else:
            print('[DB] All corporate cards already exist')

    except Exception as e:
        db.rollback()
        print(f'[DB] Failed to create corporate cards: {e}')
    finally:
        db.close()