from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from ..database import Base


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(36), unique=True, nullable=False, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), index=True)
    user_id = Column(String(255), nullable=False, index=True)
    user_name = Column(String(255))
    card_name = Column(String(255), nullable=False)
    card_id = Column(String(50))  # String으로 변경: 법인카드 "corp_1" 형식 지원
    is_corporate = Column(Boolean, default=False)  # 법인카드 여부
    payment_amount = Column(Integer, nullable=False)
    discount_amount = Column(Integer, default=0)
    discount_type = Column(String(50))
    final_amount = Column(Integer, nullable=False)
    benefit_text = Column(Text)
    payment_status = Column(String(20), default='pending')  # pending, completed, failed
    payment_method = Column(String(50))  # qr_code, barcode
    qr_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True))

    def __repr__(self):
        return f"<PaymentTransaction {self.transaction_id}>"
