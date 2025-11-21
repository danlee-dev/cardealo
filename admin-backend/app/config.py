from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    database_url: str = Field(
        default="sqlite:///./cardealo_admin.db",
        validation_alias="DATABASE_URL"
    )
    jwt_secret: str = Field(
        default="your-jwt-secret",
        validation_alias="JWT_SECRET"
    )
    admin_secret_key: str = Field(
        default="your-admin-secret",
        validation_alias="ADMIN_SECRET_KEY"
    )
    user_backend_url: str = Field(
        default="http://localhost:5001",
        validation_alias="USER_BACKEND_URL"
    )
    google_maps_api_key: str = Field(
        default="",
        validation_alias="GOOGLE_MAPS_API_KEY"
    )

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


settings = Settings()
