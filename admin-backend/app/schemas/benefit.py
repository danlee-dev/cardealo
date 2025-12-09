from pydantic import BaseModel
from typing import Optional


class BenefitCalculationResult(BaseModel):
    transaction_id: str
    discount_amount: int
    discount_type: str
    final_amount: int
    benefit_text: str
    is_eligible: bool = True
    error_message: Optional[str] = None
    user_name: Optional[str] = None
    card_name: Optional[str] = None
