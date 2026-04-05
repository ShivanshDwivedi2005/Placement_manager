import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.jwt_handler import create_access_token, get_current_admin
from config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


def _ensure_password_hash() -> bytes:
    if settings.admin_password_hash:
        return settings.admin_password_hash.encode("utf-8")
    return bcrypt.hashpw(settings.admin_password.encode("utf-8"), bcrypt.gensalt())


_stored_password_hash = _ensure_password_hash()


class LoginRequest(BaseModel):
    password: str


@router.post("/login")
def login(req: LoginRequest):
    if not bcrypt.checkpw(req.password.encode("utf-8"), _stored_password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")
    token = create_access_token({"sub": "admin", "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/verify")
def verify_token_route(_=Depends(get_current_admin)):
    return {"valid": True}
