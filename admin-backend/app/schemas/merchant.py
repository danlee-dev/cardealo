from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


class MerchantCreate(BaseModel):
    place_id: str
    name: str
    category: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None


class MerchantResponse(BaseModel):
    id: int
    place_id: str
    name: str
    category: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    created_at: datetime

    class Config:
        from_attributes = True
