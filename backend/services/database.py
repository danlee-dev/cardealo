import os
from sqlalchemy import create_engine, Column, String, Integer, Boolean, ForeignKey, select, DateTime, Text, Date
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session
from sqlalchemy_utils import PasswordType
from datetime import datetime, date

import json
import csv


# 데이터베이스 경로 설정 (backend 폴더에 저장)
DATABASE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cardealo.db')
cards_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ai/cards.json')
card_benefits_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ai/card_benefits.csv')

# SQLAlchemy 설정
DATABASE_URL = f"sqlite:///{DATABASE}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
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
    card_name = Column(String)
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


class PaymentHistory(Base):
    """결제 내역 (관리자 시스템에서 전송받음)"""
    __tablename__ = 'payment_history'

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(String(36), unique=True, nullable=False)
    user_id = Column(String, ForeignKey('user.user_id'))
    card_id = Column(Integer, ForeignKey('mycard.cid'))
    merchant_name = Column(String)
    payment_amount = Column(Integer)
    discount_amount = Column(Integer)
    final_amount = Column(Integer)
    benefit_text = Column(Text)
    payment_date = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    card = relationship("MyCard")


class QRScanStatus(Base):
    """QR 스캔 상태 추적"""
    __tablename__ = 'qr_scan_status'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey('user.user_id'))
    card_id = Column(Integer, ForeignKey('mycard.cid'))
    timestamp = Column(Integer, nullable=False)  # QR 생성 시간
    status = Column(String, default='waiting')  # waiting, scanned, processing, completed, failed, cancelled
    merchant_name = Column(String)
    scanned_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    card = relationship("MyCard")

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
    """데이터베이스 테이블을 초기화합니다"""
    Base.metadata.create_all(bind=engine)
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
        for row in card_benefits_data:
            card_name, category, places, discount_type, discount_value, max_discount, pre_month_config, limit_config, places_display, discount_display, limit_display, max_discount_display = row
            if card_name in cards_data:
                existing_card = db.scalars(select(CardBenefit).where(CardBenefit.card_name == card_name)).first()
                if existing_card:
                    continue
                new_card_benefit = CardBenefit(card_name=card_name, category=category, places=places, discount_type=discount_type, discount_value=discount_value, max_discount=max_discount, pre_month_config=pre_month_config, limit_config=limit_config, places_display=places_display, discount_display=discount_display, limit_display=limit_display, max_discount_display=max_discount_display)
                db.add(new_card_benefit)
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

    # 테스트 사용자 자동 생성
    create_test_user()