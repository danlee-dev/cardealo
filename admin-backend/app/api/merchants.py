from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import os
import requests
from ..database import get_db
from ..models import Merchant
from ..schemas import MerchantCreate, MerchantResponse

router = APIRouter()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


@router.get("/search")
async def search_merchants(
    query: str,
    latitude: float = None,
    longitude: float = None
):
    """Google Places API를 사용하여 가맹점 검색"""
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=500, detail="Google Maps API key not configured")

    try:
        # Use Nearby Search if location is provided
        if latitude is not None and longitude is not None:
            print(f"[Search] Nearby Search: '{query}' at {latitude}, {longitude}")

            params = {
                'location': f'{latitude},{longitude}',
                'radius': 5000,  # 5km radius
                'keyword': query,
                'key': GOOGLE_MAPS_API_KEY,
                'language': 'ko',
            }

            response = requests.get(
                'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
                params=params
            )
        else:
            # Use Text Search for global search
            print(f"[Search] Text Search: '{query}'")

            params = {
                'query': query,
                'key': GOOGLE_MAPS_API_KEY,
                'language': 'ko',
                'region': 'kr'
            }

            response = requests.get(
                'https://maps.googleapis.com/maps/api/place/textsearch/json',
                params=params
            )

        data = response.json()

        print(f"[Search] API Status: {data.get('status')}")

        if data.get("status") == "ZERO_RESULTS":
            return {"results": [], "message": "No results found"}

        if data.get("status") != "OK":
            error_msg = data.get("error_message", data.get("status"))
            print(f"[Search] API Error: {error_msg}")
            return {"results": [], "message": f"Search failed: {error_msg}"}

        results = []
        for place in data.get("results", [])[:10]:  # 최대 10개만
            results.append({
                "place_id": place.get("place_id"),
                "name": place.get("name"),
                "address": place.get("formatted_address") or place.get("vicinity"),
                "category": place.get("types", [])[0] if place.get("types") else None,
                "latitude": place.get("geometry", {}).get("location", {}).get("lat"),
                "longitude": place.get("geometry", {}).get("location", {}).get("lng")
            })

        print(f"[Search] Found {len(results)} results")
        return {"results": results, "message": "Success"}

    except Exception as e:
        print(f"[Search] Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@router.post("/select", response_model=MerchantResponse)
async def select_merchant(merchant: MerchantCreate, db: Session = Depends(get_db)):
    """선택한 가맹점을 DB에 저장"""
    # 이미 존재하는지 확인
    existing = db.query(Merchant).filter(Merchant.place_id == merchant.place_id).first()
    if existing:
        return existing

    # 새로 생성
    db_merchant = Merchant(**merchant.model_dump())
    db.add(db_merchant)
    db.commit()
    db.refresh(db_merchant)
    return db_merchant


@router.get("/", response_model=List[MerchantResponse])
async def list_merchants(db: Session = Depends(get_db)):
    """저장된 가맹점 목록 조회"""
    merchants = db.query(Merchant).all()
    return merchants


@router.get("/{merchant_id}", response_model=MerchantResponse)
async def get_merchant(merchant_id: int, db: Session = Depends(get_db)):
    """특정 가맹점 조회"""
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return merchant
