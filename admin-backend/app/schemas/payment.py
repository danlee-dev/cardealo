from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class QRScanRequest(BaseModel):
    qr_data: str
    merchant_id: int
    payment_amount: int


class BarcodeScanRequest(BaseModel):
    barcode_data: str  # 12자리 숫자
    merchant_id: int
    payment_amount: int


class PaymentProcessRequest(BaseModel):
    transaction_id: str
    confirm: bool = True


class PaymentResponse(BaseModel):
    transaction_id: str
    status: str
    user_name: str
    card_name: str
    payment_amount: int
    discount_amount: int
    final_amount: int
    benefit_text: Optional[str] = None

    class Config:
        from_attributes = True


class TransactionDetail(BaseModel):
    transaction_id: str
    card_name: str
    payment_amount: int
    discount_amount: int
    final_amount: int
    benefit_text: Optional[str]
    payment_date: datetime


class UserTransactions(BaseModel):
    user_id: str
    user_name: str
    transactions: List[TransactionDetail]


class MerchantHistory(BaseModel):
    merchant_id: int
    merchant_name: str
    total_transactions: int
    total_amount: int
    users: List[UserTransactions]


class PaymentHistoryResponse(BaseModel):
    merchants: List[MerchantHistory]
