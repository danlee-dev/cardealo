import jwt
import os
from datetime import datetime, timedelta


class JwtService:
    def __init__(self):
        self.secret_key = os.getenv('JWT_SECRET')
        self.algorithm = 'HS256'
        self.expires_in = timedelta(days=30)  # 30일 만료

    def generate_token(self, user_id: str) -> str:
        payload = {
            'user_id': user_id,
            'exp': datetime.utcnow() + self.expires_in,
            'iat': datetime.utcnow(),
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def verify_token(self, token: str) -> dict:
        try:
            return jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
        except jwt.ExpiredSignatureError:
            return {'error': 'token_expired'}
        except jwt.InvalidTokenError:
            return {'error': 'invalid_token'}