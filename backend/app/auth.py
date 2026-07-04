from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from sqlalchemy.orm import Session

from . import models
from .database import get_db

SECRET_KEY = os.getenv("KHAREEF_SECRET_KEY", "change-this-secret-for-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("KHAREEF_TOKEN_HOURS", "168"))
bearer_scheme = HTTPBearer()

ROLE_ADMIN = "admin"
ROLE_SCANNER = "scanner"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return "pbkdf2_sha256$120000$" + base64.b64encode(salt).decode("ascii") + "$" + base64.b64encode(digest).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt_value, digest_value = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_value)
        expected = base64.b64decode(digest_value)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def normalize_role(role: str | None) -> str:
    if role == ROLE_SCANNER:
        return ROLE_SCANNER
    return ROLE_ADMIN


def create_access_token(subject: str, role: str = ROLE_ADMIN) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": subject, "role": normalize_role(role), "exp": int(expires.timestamp())}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _get_admin_from_token(
    credentials: HTTPAuthorizationCredentials,
    db: Session,
) -> models.Admin:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
    except ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired") from exc
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    admin = db.query(models.Admin).filter(models.Admin.username == username).first()
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return admin


def admin_role(admin: models.Admin) -> str:
    return normalize_role(getattr(admin, "role", None) or ROLE_ADMIN)


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.Admin:
    admin = _get_admin_from_token(credentials, db)
    if admin_role(admin) == ROLE_SCANNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Scanner accounts must sign in at the staff portal.",
        )
    return admin


def get_current_staff(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.Admin:
    return _get_admin_from_token(credentials, db)
