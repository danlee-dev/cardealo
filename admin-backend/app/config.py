from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    database_url: str = "postgresql://user:password@localhost:5432/cardealo_admin"
    jwt_secret: str = "your-jwt-secret"
    admin_secret_key: str = "your-admin-secret"
    user_backend_url: str = "http://localhost:5001"
    google_maps_api_key: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
