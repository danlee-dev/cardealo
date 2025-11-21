from sqlalchemy import Column, Integer, String, DECIMAL, DateTime
from sqlalchemy.sql import func
from ..database import Base


class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(Integer, primary_key=True, index=True)
    place_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100))
    address = Column(String(500))
    latitude = Column(DECIMAL(10, 8))
    longitude = Column(DECIMAL(11, 8))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<Merchant {self.name}>"
