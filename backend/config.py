from functools import cached_property
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/internship_manager"
    db_pool_min_size: int = 1
    db_pool_max_size: int = 10
    db_pool_timeout: int = 15
    gzip_minimum_size: int = 500

    admin_password: str = "admin123"
    admin_password_hash: Optional[str] = None
    jwt_secret_key: str = "changeme-super-secret-key-32chars!!"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    email_user: str = ""
    email_pass: str = ""
    notification_email: str = ""

    frontend_url: str = "http://localhost:5173"
    frontend_urls: str = ""
    cors_allow_origin_regex: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        extra="ignore",
    )

    @cached_property
    def cors_allowed_origins(self) -> list[str]:
        raw_origins = [
            self.frontend_url,
            self.frontend_urls,
            "http://localhost:5173",
            "http://localhost:3000",
        ]
        normalized = []
        seen = set()

        for raw_origin in raw_origins:
            for origin in str(raw_origin or "").split(","):
                cleaned = origin.strip().rstrip("/")
                if not cleaned or cleaned in seen:
                    continue
                seen.add(cleaned)
                normalized.append(cleaned)

        return normalized


settings = Settings()
