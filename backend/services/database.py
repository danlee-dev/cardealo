import os
from sqlalchemy import create_engine, Column, String, Integer, Boolean, ForeignKey, select
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session
from sqlalchemy_utils import PasswordType

import json
import csv


# 데이터베이스 경로 설정 (backend 폴더에 저장)
DATABASE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cardealo.db')
cards_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '../ai/cards.json')
card_benefits_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '../ai/card_benefits.csv')
# print(cards_path)

# SQLAlchemy 설정
DATABASE_URL = f"sqlite:///{DATABASE}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite용 설정
    echo=False  # SQL 쿼리 로깅 (디버깅 시 True로 변경)
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
                continue  # 이미 존재하면 건너뛰기
            
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