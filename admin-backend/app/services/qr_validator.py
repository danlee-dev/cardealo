import hmac
import hashlib
import json
from datetime import datetime, timedelta


def verify_qr_signature(qr_data: str, secret_key: str) -> bool:
    """QR/바코드 데이터의 서명을 검증"""
    try:
        data = json.loads(qr_data)
        signature = data.get('signature')
        if not signature:
            return False

        # 서명 제외하고 데이터 복사
        data_copy = {k: v for k, v in data.items() if k != 'signature'}

        # 예상 서명 계산
        expected_signature = hmac.new(
            secret_key.encode(),
            json.dumps(data_copy, sort_keys=True).encode(),
            hashlib.sha256
        ).hexdigest()

        # 서명 비교 (타이밍 공격 방지)
        return hmac.compare_digest(signature, expected_signature)
    except Exception as e:
        print(f"Signature verification error: {str(e)}")
        return False


def is_qr_expired(timestamp: int, max_age_minutes: int = 5) -> bool:
    """QR 코드 유효기간 확인 (재사용 공격 방지)"""
    try:
        qr_time = datetime.fromtimestamp(timestamp)
        now = datetime.now()
        age = now - qr_time
        return age > timedelta(minutes=max_age_minutes)
    except Exception:
        return True  # 오류 시 만료로 처리
