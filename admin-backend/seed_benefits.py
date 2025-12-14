import json
from app.database import SessionLocal
from app.models import CardBenefit


def seed_benefits():
    """Load benefits from benefits_db.json into the database"""
    db = SessionLocal()

    try:
        # Clear existing benefits
        db.query(CardBenefit).delete()

        # Load benefits from JSON
        with open('benefits_db.json', 'r', encoding='utf-8') as f:
            benefits_db = json.load(f)

        count = 0
        # Parse nested structure: { category: { "default": [...] } }
        for category, subcategories in benefits_db.items():
            for subcategory, cards in subcategories.items():
                for card_data in cards:
                    # Determine discount type and value
                    discount_type = None
                    discount_value = 0
                    max_discount = None

                    if card_data.get('discount_rate', 0) > 0:
                        discount_type = 'percent'
                        discount_value = int(card_data['discount_rate'])
                        if card_data.get('discount_amount', 0) > 0:
                            max_discount = card_data['discount_amount']
                    elif card_data.get('discount_amount', 0) > 0:
                        discount_type = 'amount'
                        discount_value = card_data['discount_amount']
                    elif card_data.get('point_rate', 0) > 0:
                        discount_type = 'point'
                        discount_value = int(card_data['point_rate'])

                    # Build discount display text
                    discount_display = None
                    if discount_type == 'percent':
                        discount_display = f"{discount_value}% 할인"
                        if max_discount:
                            discount_display += f" (최대 {max_discount:,}원)"
                    elif discount_type == 'amount':
                        discount_display = f"{discount_value:,}원 할인"
                    elif discount_type == 'point':
                        discount_display = f"{discount_value}% 적립"

                    # Pre-month config
                    pre_month_config = None
                    if card_data.get('pre_month_money', 0) > 0:
                        pre_month_config = {
                            'required_amount': card_data['pre_month_money']
                        }

                    benefit = CardBenefit(
                        card_name=card_data['card'],
                        category=category,
                        places=None,  # Will be populated from benefit_text if needed
                        discount_type=discount_type,
                        discount_value=discount_value,
                        max_discount=max_discount,
                        pre_month_config=json.dumps(pre_month_config) if pre_month_config else None,
                        limit_config=None,
                        places_display=None,
                        discount_display=discount_display,
                        limit_display=None,
                        max_discount_display=f"최대 {max_discount:,}원" if max_discount else None
                    )
                    db.add(benefit)
                    count += 1

        db.commit()
        print(f"Successfully seeded {count} benefits")

    except Exception as e:
        print(f"Error seeding benefits: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


def seed_corporate_card_benefits():
    """법인카드 혜택 데이터 추가"""
    db = SessionLocal()

    # 법인카드 5개에 대한 혜택 정의
    corporate_cards = [
        {
            'card_name': '신한 법인카드',
            'benefits': {
                'cafe': {'discount_type': 'percent', 'discount_value': 10, 'max_discount': 3000, 'display': '10% 할인 (최대 3,000원)'},
                'restaurant': {'discount_type': 'percent', 'discount_value': 5, 'max_discount': 5000, 'display': '5% 할인 (최대 5,000원)'},
                'convenience': {'discount_type': 'percent', 'discount_value': 5, 'max_discount': 2000, 'display': '5% 할인 (최대 2,000원)'},
                'gas_station': {'discount_type': 'percent', 'discount_value': 3, 'max_discount': 10000, 'display': '3% 할인 (최대 10,000원)'},
            }
        },
        {
            'card_name': '삼성 기업카드 A',
            'benefits': {
                'cafe': {'discount_type': 'percent', 'discount_value': 15, 'max_discount': 5000, 'display': '15% 할인 (최대 5,000원)'},
                'restaurant': {'discount_type': 'percent', 'discount_value': 10, 'max_discount': 10000, 'display': '10% 할인 (최대 10,000원)'},
                'movie': {'discount_type': 'amount', 'discount_value': 4000, 'max_discount': None, 'display': '4,000원 할인'},
                'online': {'discount_type': 'percent', 'discount_value': 5, 'max_discount': 5000, 'display': '5% 할인 (최대 5,000원)'},
            }
        },
        {
            'card_name': '현대 비즈니스카드',
            'benefits': {
                'cafe': {'discount_type': 'percent', 'discount_value': 10, 'max_discount': 3000, 'display': '10% 할인 (최대 3,000원)'},
                'restaurant': {'discount_type': 'percent', 'discount_value': 7, 'max_discount': 7000, 'display': '7% 할인 (최대 7,000원)'},
                'department': {'discount_type': 'percent', 'discount_value': 5, 'max_discount': 20000, 'display': '5% 할인 (최대 20,000원)'},
                'gas_station': {'discount_type': 'percent', 'discount_value': 5, 'max_discount': 15000, 'display': '5% 할인 (최대 15,000원)'},
            }
        },
        {
            'card_name': '롯데 기업카드',
            'benefits': {
                'cafe': {'discount_type': 'percent', 'discount_value': 10, 'max_discount': 3000, 'display': '10% 할인 (최대 3,000원)'},
                'restaurant': {'discount_type': 'percent', 'discount_value': 5, 'max_discount': 5000, 'display': '5% 할인 (최대 5,000원)'},
                'movie': {'discount_type': 'amount', 'discount_value': 6000, 'max_discount': None, 'display': '6,000원 할인'},
                'mart': {'discount_type': 'percent', 'discount_value': 5, 'max_discount': 10000, 'display': '5% 할인 (최대 10,000원)'},
            }
        },
        {
            'card_name': 'KB국민 비즈 법인카드',
            'benefits': {
                'cafe': {'discount_type': 'percent', 'discount_value': 10, 'max_discount': 4000, 'display': '10% 할인 (최대 4,000원)'},
                'restaurant': {'discount_type': 'percent', 'discount_value': 8, 'max_discount': 8000, 'display': '8% 할인 (최대 8,000원)'},
                'convenience': {'discount_type': 'percent', 'discount_value': 10, 'max_discount': 3000, 'display': '10% 할인 (최대 3,000원)'},
                'transit': {'discount_type': 'percent', 'discount_value': 10, 'max_discount': 5000, 'display': '10% 할인 (최대 5,000원)'},
            }
        },
    ]

    try:
        count = 0
        for card in corporate_cards:
            for category, benefit_data in card['benefits'].items():
                # 기존에 같은 카드-카테고리 혜택이 있으면 스킵
                existing = db.query(CardBenefit).filter(
                    CardBenefit.card_name == card['card_name'],
                    CardBenefit.category == category
                ).first()
                if existing:
                    continue

                benefit = CardBenefit(
                    card_name=card['card_name'],
                    category=category,
                    places=None,
                    discount_type=benefit_data['discount_type'],
                    discount_value=benefit_data['discount_value'],
                    max_discount=benefit_data['max_discount'],
                    pre_month_config=None,
                    limit_config=None,
                    places_display=None,
                    discount_display=benefit_data['display'],
                    limit_display=None,
                    max_discount_display=f"최대 {benefit_data['max_discount']:,}원" if benefit_data['max_discount'] else None
                )
                db.add(benefit)
                count += 1

        db.commit()
        print(f"Successfully seeded {count} corporate card benefits")

    except Exception as e:
        print(f"Error seeding corporate card benefits: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_benefits()
    seed_corporate_card_benefits()
