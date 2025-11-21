from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime
from typing import Optional
import json
from ..database import get_db
from ..models import PaymentTransaction, Merchant
from ..schemas import PaymentProcessRequest, PaymentResponse, PaymentHistoryResponse
from ..services.webhook import notify_user_backend, notify_qr_scan_status

router = APIRouter()


@router.post("/process", response_model=PaymentResponse)
async def process_payment(request: PaymentProcessRequest, db: Session = Depends(get_db)):
    """결제 처리 및 사용자 백엔드로 전송"""
    # Transaction 조회
    transaction = db.query(PaymentTransaction).filter(
        PaymentTransaction.transaction_id == request.transaction_id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if transaction.payment_status == "completed":
        raise HTTPException(status_code=400, detail="Already completed")

    if not request.confirm:
        raise HTTPException(status_code=400, detail="Payment not confirmed")

    # 가맹점 정보 조회
    merchant = db.query(Merchant).filter(Merchant.id == transaction.merchant_id).first()

    # 결제 완료 처리
    transaction.payment_status = "completed"
    transaction.completed_at = datetime.utcnow()
    db.commit()

    # 사용자 백엔드로 Webhook 전송
    try:
        await notify_user_backend({
            "transaction_id": transaction.transaction_id,
            "user_id": transaction.user_id,
            "card_id": transaction.card_id,
            "merchant_name": merchant.name if merchant else "Unknown",
            "payment_amount": transaction.payment_amount,
            "discount_amount": transaction.discount_amount,
            "final_amount": transaction.final_amount,
            "benefit_text": transaction.benefit_text
        })
    except Exception as e:
        print(f"Webhook notification failed: {str(e)}")
        # Webhook 실패해도 결제는 완료됨

    # QR 스캔 상태를 'completed'로 업데이트
    try:
        if transaction.qr_data:
            qr_data = json.loads(transaction.qr_data)
            await notify_qr_scan_status({
                "user_id": transaction.user_id,
                "timestamp": qr_data.get("timestamp"),
                "status": "completed"
            })
    except Exception as e:
        print(f"QR status update failed: {str(e)}")
        # QR 상태 업데이트 실패해도 결제는 완료됨

    return PaymentResponse(
        transaction_id=transaction.transaction_id,
        status="completed",
        user_name=transaction.user_name,
        card_name=transaction.card_name,
        payment_amount=transaction.payment_amount,
        discount_amount=transaction.discount_amount,
        final_amount=transaction.final_amount,
        benefit_text=transaction.benefit_text
    )


@router.get("/history")
async def get_payment_history(
    merchant_id: Optional[int] = None,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """결제 기록 조회 (가맹점별 > 사용자별 온톨로지)"""
    query = db.query(PaymentTransaction).filter(
        PaymentTransaction.payment_status == "completed"
    )

    if merchant_id:
        query = query.filter(PaymentTransaction.merchant_id == merchant_id)
    if user_id:
        query = query.filter(PaymentTransaction.user_id == user_id)

    transactions = query.order_by(desc(PaymentTransaction.created_at)).all()

    # 가맹점별로 그룹화
    merchants_map = {}
    for tx in transactions:
        merchant = db.query(Merchant).filter(Merchant.id == tx.merchant_id).first()
        merchant_name = merchant.name if merchant else "Unknown"

        if tx.merchant_id not in merchants_map:
            merchants_map[tx.merchant_id] = {
                "merchant_id": tx.merchant_id,
                "merchant_name": merchant_name,
                "total_transactions": 0,
                "total_amount": 0,
                "users": {}
            }

        # 사용자별로 그룹화
        if tx.user_id not in merchants_map[tx.merchant_id]["users"]:
            merchants_map[tx.merchant_id]["users"][tx.user_id] = {
                "user_id": tx.user_id,
                "user_name": tx.user_name,
                "transactions": []
            }

        merchants_map[tx.merchant_id]["users"][tx.user_id]["transactions"].append({
            "transaction_id": tx.transaction_id,
            "card_name": tx.card_name,
            "payment_amount": tx.payment_amount,
            "discount_amount": tx.discount_amount,
            "final_amount": tx.final_amount,
            "benefit_text": tx.benefit_text,
            "payment_date": tx.completed_at
        })

        merchants_map[tx.merchant_id]["total_transactions"] += 1
        merchants_map[tx.merchant_id]["total_amount"] += tx.final_amount

    # 온톨로지 구조로 변환
    result = []
    for merchant_data in merchants_map.values():
        merchant_data["users"] = list(merchant_data["users"].values())
        result.append(merchant_data)

    return {"merchants": result}
