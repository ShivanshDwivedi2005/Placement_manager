from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    sqlite_db_path: str = str(Path(__file__).resolve().parent / "data" / "internship_manager.db")

    admin_password: str = "admin123"
    admin_password_hash: Optional[str] = None
    jwt_secret_key: str = "changeme-super-secret-key-32chars!!"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    email_user: str = ""
    email_pass: str = ""
    notification_email: str = ""

    frontend_url: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
