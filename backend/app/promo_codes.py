"""Promo code validation and pricing helpers."""

from __future__ import annotations

import re
import secrets
import string

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models, pricing

DISCOUNT_TYPE_FIXED = "fixed"
DISCOUNT_TYPE_PERCENT = "percent"
DISCOUNT_TYPES = frozenset({DISCOUNT_TYPE_FIXED, DISCOUNT_TYPE_PERCENT})

_CODE_PATTERN = re.compile(r"^[A-Z0-9_-]{3,32}$")


def normalize_code(value: str) -> str:
    return value.strip().upper()


def validate_code_format(value: str) -> str:
    code = normalize_code(value)
    if not _CODE_PATTERN.fullmatch(code):
        raise ValueError("Promo code must be 3–32 characters (letters, numbers, _ or -).")
    return code


def generate_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def normalize_discount_type(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in DISCOUNT_TYPES:
        raise ValueError("Discount type must be fixed or percent.")
    return normalized


def calculate_discount_amount(subtotal: float, promo: models.PromoCode) -> float:
    subtotal = round(float(subtotal), 2)
    if subtotal <= 0:
        return 0.0
    discount_type = normalize_discount_type(promo.discount_type)
    value = float(promo.discount_value)
    if discount_type == DISCOUNT_TYPE_PERCENT:
        amount = round(subtotal * (value / 100.0), 2)
    else:
        amount = round(value, 2)
    return min(amount, subtotal)


def build_discounted_totals(subtotal: float, promo: models.PromoCode | None) -> tuple[float, float, float, float]:
    subtotal = round(float(subtotal), 2)
    discount_amount = calculate_discount_amount(subtotal, promo) if promo else 0.0
    discounted_subtotal = round(subtotal - discount_amount, 2)
    tax_amount = pricing.calculate_tax(discounted_subtotal)
    total_price = pricing.calculate_total_with_tax(discounted_subtotal)
    return subtotal, discount_amount, tax_amount, total_price


def promo_has_uses_remaining(promo: models.PromoCode) -> bool:
    if not promo.is_active:
        return False
    if promo.max_uses is None:
        return True
    return promo.used_count < promo.max_uses


def get_active_promo(db: Session, code: str) -> models.PromoCode | None:
    normalized = normalize_code(code)
    if not normalized:
        return None
    return (
        db.query(models.PromoCode)
        .filter(models.PromoCode.code == normalized, models.PromoCode.is_active == True)  # noqa: E712
        .first()
    )


def validate_promo_for_booking(
    db: Session,
    code: str,
    subtotal: float,
    *,
    consume: bool = False,
) -> tuple[models.PromoCode, float, float, float, float]:
    promo = get_active_promo(db, code)
    if not promo:
        raise HTTPException(status_code=400, detail="Invalid or inactive promo code.")
    if not promo_has_uses_remaining(promo):
        raise HTTPException(status_code=400, detail="This promo code has reached its usage limit.")

    subtotal, discount_amount, tax_amount, total_price = build_discounted_totals(subtotal, promo)
    if consume:
        promo.used_count += 1
    return promo, subtotal, discount_amount, tax_amount, total_price


def release_promo_usage(db: Session, booking: models.Booking) -> None:
    promo_id = getattr(booking, "promo_code_id", None)
    if not promo_id:
        return
    promo = db.get(models.PromoCode, promo_id)
    if promo and promo.used_count > 0:
        promo.used_count -= 1