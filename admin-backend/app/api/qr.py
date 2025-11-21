from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
import uuid
from datetime import datetime
from ..database import get_db
from ..models import PaymentTransaction, Merchant
from ..schemas import QRScanRequest, BenefitCalculationResult
from ..services.qr_validator import verify_qr_signature, is_qr_expired
from ..services.benefit_calculator import calculate_benefit
from ..services.webhook import notify_qr_scan_status
from ..config import settings

router = APIRouter()


@router.post("/scan", response_model=BenefitCalculationResult)
async def scan_qr(request: QRScanRequest, db: Session = Depends(get_db)):
    """QR/바코드 스캔 및 혜택 계산"""
    try:
        # QR 데이터 파싱
        qr_data = json.loads(request.qr_data)

        # 서명 검증
        if not verify_qr_signature(request.qr_data, settings.jwt_secret):
            raise HTTPException(status_code=401, detail="Invalid QR signature")

        # 타임스탬프 검증 (5분 이내)
        if is_qr_expired(qr_data["timestamp"], max_age_minutes=5):
            raise HTTPException(status_code=401, detail="QR code expired")

        # 가맹점 조회
        merchant = db.query(Merchant).filter(Merchant.id == request.merchant_id).first()
        if not merchant:
            raise HTTPException(status_code=404, detail="Merchant not found")

        # 혜택 계산
        benefit_result = await calculate_benefit(
            card_name=qr_data["card_name"],
            merchant_category=merchant.category or "default",
            merchant_name=merchant.name,
            payment_amount=request.payment_amount,
            db=db
        )

        # Transaction 생성 (pending 상태)
        transaction_id = str(uuid.uuid4())
        transaction = PaymentTransaction(
            transaction_id=transaction_id,
            merchant_id=request.merchant_id,
            user_id=qr_data["user_id"],
            user_name=qr_data["user_name"],
            card_name=qr_data["card_name"],
            card_id=qr_data.get("card_id"),
            payment_amount=request.payment_amount,
            discount_amount=benefit_result["discount_amount"],
            discount_type=benefit_result["discount_type"],
            final_amount=request.payment_amount - benefit_result["discount_amount"],
            benefit_text=benefit_result["benefit_text"],
            payment_status="pending",
            payment_method="qr_code",
            qr_data=request.qr_data
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)

        # 사용자 백엔드에 QR 스캔 알림 전송
        try:
            await notify_qr_scan_status({
                "user_id": qr_data["user_id"],
                "timestamp": qr_data["timestamp"],
                "status": "scanned",
                "merchant_name": merchant.name
            })
        except Exception as e:
            print(f"Failed to notify QR scan status: {str(e)}")
            # QR 스캔 알림 실패해도 Transaction은 계속 진행

        return BenefitCalculationResult(
            transaction_id=transaction_id,
            discount_amount=benefit_result["discount_amount"],
            discount_type=benefit_result["discount_type"],
            final_amount=transaction.final_amount,
            benefit_text=benefit_result["benefit_text"],
            is_eligible=True
        )

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid QR data format")
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing required field: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
