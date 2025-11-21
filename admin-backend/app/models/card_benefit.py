from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from ..database import Base


class CardBenefit(Base):
    __tablename__ = "card_benefits"

    id = Column(Integer, primary_key=True, index=True)
    card_name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), index=True)
    places = Column(JSON)  # ["CU", "GS25"]
    discount_type = Column(String(50))
    discount_value = Column(Integer)
    max_discount = Column(Integer)
    pre_month_config = Column(JSON)
    limit_config = Column(JSON)
    places_display = Column(Text)
    discount_display = Column(Text)
    limit_display = Column(Text)
    max_discount_display = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<CardBenefit {self.card_name} - {self.category}>"
