from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/internship_manager"
    db_pool_min_size: int = 1
    db_pool_max_size: int = 10
    db_pool_timeout: int = 15

    admin_password: str = "admin123"
    admin_password_hash: Optional[str] = None
    jwt_secret_key: str = "changeme-super-secret-key-32chars!!"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    email_user: str = ""
    email_pass: str = ""
    notification_email: str = ""

    frontend_url: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        extra="ignore",
    )


settings = Settings()
