from sqlalchemy.orm import Session
from ..models import CardBenefit
import json


async def calculate_benefit(
    card_name: str,
    merchant_category: str,
    merchant_name: str,
    payment_amount: int,
    db: Session
) -> dict:
    """
    카드 혜택 계산

    Args:
        card_name: 카드명
        merchant_category: 가맹점 카테고리
        merchant_name: 가맹점명
        payment_amount: 결제 금액
        db: DB 세션

    Returns:
        {
            "discount_amount": 할인 금액,
            "discount_type": 할인 유형,
            "benefit_text": 혜택 설명
        }
    """
    try:
        # 카드 혜택 조회
        benefits = db.query(CardBenefit).filter(
            CardBenefit.card_name == card_name,
            CardBenefit.category == merchant_category
        ).all()

        if not benefits:
            # 기본 혜택 없음
            return {
                "discount_amount": 0,
                "discount_type": "none",
                "benefit_text": "적용 가능한 혜택이 없습니다"
            }

        # 가맹점명과 매칭되는 혜택 찾기
        matched_benefit = None
        for benefit in benefits:
            if benefit.places:
                places = json.loads(benefit.places) if isinstance(benefit.places, str) else benefit.places
                for place in places:
                    if place.lower() in merchant_name.lower() or merchant_name.lower() in place.lower():
                        matched_benefit = benefit
                        break
                if matched_benefit:
                    break

        # 매칭되는 혜택이 없으면 첫 번째 혜택 사용 (default)
        if not matched_benefit and benefits:
            matched_benefit = benefits[0]

        if not matched_benefit:
            return {
                "discount_amount": 0,
                "discount_type": "none",
                "benefit_text": "적용 가능한 혜택이 없습니다"
            }

        # 할인 계산
        discount_amount = 0
        discount_type = matched_benefit.discount_type or "percent"

        if discount_type == "percent":
            # 퍼센트 할인
            discount_amount = int(payment_amount * (matched_benefit.discount_value / 100))
        elif discount_type == "amount":
            # 정액 할인
            discount_amount = matched_benefit.discount_value
        elif discount_type == "point":
            # 포인트 적립 (할인으로 처리하지 않음)
            discount_amount = 0

        # 최대 할인 금액 적용
        if matched_benefit.max_discount and discount_amount > matched_benefit.max_discount:
            discount_amount = matched_benefit.max_discount

        # 혜택 텍스트 생성
        benefit_text = matched_benefit.discount_display or f"{card_name} 혜택"
        if matched_benefit.max_discount_display:
            benefit_text += f" ({matched_benefit.max_discount_display})"

        return {
            "discount_amount": discount_amount,
            "discount_type": discount_type,
            "benefit_text": benefit_text
        }

    except Exception as e:
        print(f"Benefit calculation error: {str(e)}")
        return {
            "discount_amount": 0,
            "discount_type": "error",
            "benefit_text": "혜택 계산 중 오류가 발생했습니다"
        }
