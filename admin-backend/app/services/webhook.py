import httpx
from ..config import settings


async def check_user_balance(user_id: str, amount: int) -> dict:
    """
    사용자 백엔드에서 잔액 확인

    Args:
        user_id: 사용자 ID
        amount: 결제 금액

    Returns:
        잔액 확인 결과
    """
    url = f"{settings.user_backend_url}/api/balance/check-for-admin"
    headers = {
        "Authorization": f"Bearer {settings.admin_secret_key}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json={"user_id": user_id, "amount": amount},
                headers=headers
            )
            return response.json()
    except httpx.HTTPError as e:
        print(f"Balance check HTTP error: {str(e)}")
        raise
    except Exception as e:
        print(f"Balance check error: {str(e)}")
        raise


async def check_corporate_card_limit(user_id: str, card_id: int, amount: int) -> dict:
    """
    법인카드 한도 확인

    Args:
        user_id: 사용자 ID
        card_id: 법인카드 ID
        amount: 결제 금액

    Returns:
        한도 확인 결과
    """
    url = f"{settings.user_backend_url}/api/corporate/check-limit"
    headers = {
        "Authorization": f"Bearer {settings.admin_secret_key}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                json={"user_id": user_id, "card_id": card_id, "amount": amount},
                headers=headers
            )
            return response.json()
    except httpx.HTTPError as e:
        print(f"Corporate limit check HTTP error: {str(e)}")
        raise
    except Exception as e:
        print(f"Corporate limit check error: {str(e)}")
        raise


async def notify_payment_failure(failure_data: dict) -> dict:
    """
    사용자 백엔드로 결제 실패 알림 전송

    Args:
        failure_data: 결제 실패 정보
        {
            "user_id": "hong_gildong",
            "reason": "insufficient_balance",
            "balance": 5000,
            "required": 10000,
            "merchant_name": "스타벅스"
        }

    Returns:
        사용자 백엔드 응답
    """
    url = f"{settings.user_backend_url}/api/payment/failure"
    headers = {
        "Authorization": f"Bearer {settings.admin_secret_key}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=failure_data, headers=headers)
            return response.json()
    except httpx.HTTPError as e:
        print(f"Payment failure notification HTTP error: {str(e)}")
        raise
    except Exception as e:
        print(f"Payment failure notification error: {str(e)}")
        raise


async def notify_user_backend(transaction_data: dict) -> dict:
    """
    사용자 백엔드로 결제 정보 전송 (Webhook)

    Args:
        transaction_data: 결제 정보

    Returns:
        사용자 백엔드 응답
    """
    url = f"{settings.user_backend_url}/api/payment/webhook"
    headers = {
        "Authorization": f"Bearer {settings.admin_secret_key}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=transaction_data, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"Webhook HTTP error: {str(e)}")
        raise
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        raise


async def notify_qr_scan_status(status_data: dict) -> dict:
    """
    사용자 백엔드로 QR 스캔 상태 전송

    Args:
        status_data: QR 스캔 상태 정보
        {
            "user_id": "hong_gildong",
            "timestamp": 1234567890,
            "status": "scanned" | "processing" | "completed" | "failed" | "cancelled",
            "merchant_name": "스타벅스" (optional)
        }

    Returns:
        사용자 백엔드 응답
    """
    url = f"{settings.user_backend_url}/api/qr/update-status"
    headers = {
        "Authorization": f"Bearer {settings.admin_secret_key}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=status_data, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        print(f"QR scan status notification HTTP error: {str(e)}")
        raise
    except Exception as e:
        print(f"QR scan status notification error: {str(e)}")
        raise
