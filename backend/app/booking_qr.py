"""QR check-in tokens and URLs for booking verification."""

import os
import secrets

from sqlalchemy.orm import Session

from . import models


PRODUCTION_SITE_URL = "https://buggydhofar.com"


def public_site_url() -> str:
    return os.getenv("PUBLIC_SITE_URL", PRODUCTION_SITE_URL).rstrip("/")


def generate_check_in_token() -> str:
    return secrets.token_urlsafe(24)


def build_check_in_url(token: str) -> str:
    return f"{public_site_url()}/checkin/{token}"


def qr_code_image_url(check_in_url: str, size: int = 220) -> str:
    from urllib.parse import quote

    return f"https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={quote(check_in_url)}"


def ensure_unique_check_in_token(db: Session) -> str:
    for _ in range(20):
        token = generate_check_in_token()
        exists = db.query(models.Booking).filter(models.Booking.check_in_token == token).first()
        if not exists:
            return token
    raise RuntimeError("Could not generate a unique check-in token")
