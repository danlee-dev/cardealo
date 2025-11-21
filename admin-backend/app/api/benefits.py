from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import CardBenefit

router = APIRouter()


@router.get("/sync")
async def sync_benefits(db: Session = Depends(get_db)):
    """사용자 백엔드의 benefits_db.json과 동기화"""
    # TODO: 사용자 백엔드에서 혜택 데이터 가져와서 동기화
    return {"message": "Benefit sync not implemented yet", "status": "pending"}


@router.get("/cards")
async def list_card_benefits(card_name: str = None, db: Session = Depends(get_db)):
    """카드 혜택 목록 조회"""
    query = db.query(CardBenefit)
    if card_name:
        query = query.filter(CardBenefit.card_name.contains(card_name))
    benefits = query.all()
    return {"benefits": benefits}
