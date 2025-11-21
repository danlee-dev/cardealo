import httpx
from ..config import settings


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
