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


if __name__ == "__main__":
    seed_benefits()
