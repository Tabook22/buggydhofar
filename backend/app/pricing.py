"""Flat buggy-bike pricing (OMR)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date as date_cls, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

# Fallback advertised totals including VAT. Live values come from pricing_settings.
DEFAULT_PRICE_1_INCL_VAT = 16.5
DEFAULT_PRICE_2_INCL_VAT = 26.5
DEFAULT_VAT_PERCENT = 5.0
MAX_PASSENGERS_PER_BIKE = 2
MAX_GROUP_PASSENGERS = 40

# Sat–Thu: full day including midday
TIME_SLOTS = ["08:00", "10:00", "12:00", "14:00", "16:00", "17:00"]

# Friday only — same slots except 12:00 is excluded (prayer time)
FRIDAY_TIME_SLOTS = ["08:00", "10:00", "14:00", "16:00", "17:00"]

# Python weekday: Monday=0 … Friday=4 … Sunday=6
FRIDAY_WEEKDAY = 4


def time_slots_for_date(booking_date: str | None = None) -> list[str]:
    """Return bookable time slots for a calendar date (YYYY-MM-DD). Fridays use special slots."""
    if not booking_date:
        return list(TIME_SLOTS)
    try:
        day = date_cls.fromisoformat(booking_date.strip()[:10])
    except ValueError:
        return list(TIME_SLOTS)
    if day.weekday() == FRIDAY_WEEKDAY:
        return list(FRIDAY_TIME_SLOTS)
    return list(TIME_SLOTS)


def is_valid_time_slot(booking_time: str, booking_date: str | None = None) -> bool:
    return booking_time in time_slots_for_date(booking_date)

ACTIVE_BOOKING_STATUSES = ("pending", "paid")

TAX_RATE = DEFAULT_VAT_PERCENT / 100.0
TAX_PERCENT = int(DEFAULT_VAT_PERCENT)


@dataclass(frozen=True)
class PricingSettingsData:
    price_1_incl_vat: float
    price_2_incl_vat: float
    vat_percent: float

    @property
    def vat_rate(self) -> float:
        return round(self.vat_percent / 100.0, 6)

    @property
    def price_1_pre_vat(self) -> float:
        return pre_vat_from_inclusive(self.price_1_incl_vat, self.vat_percent)

    @property
    def price_2_pre_vat(self) -> float:
        return pre_vat_from_inclusive(self.price_2_incl_vat, self.vat_percent)

    @property
    def price_1_vat_amount(self) -> float:
        return round(self.price_1_incl_vat - self.price_1_pre_vat, 2)

    @property
    def price_2_vat_amount(self) -> float:
        return round(self.price_2_incl_vat - self.price_2_pre_vat, 2)


def pre_vat_from_inclusive(inclusive: float, vat_percent: float) -> float:
    total = round(float(inclusive), 2)
    rate = float(vat_percent) / 100.0
    if rate <= 0:
        return total
    return round(total / (1 + rate), 2)


def default_pricing_settings() -> PricingSettingsData:
    return PricingSettingsData(
        price_1_incl_vat=DEFAULT_PRICE_1_INCL_VAT,
        price_2_incl_vat=DEFAULT_PRICE_2_INCL_VAT,
        vat_percent=DEFAULT_VAT_PERCENT,
    )


def validate_pricing_input(price_1_incl_vat: float, price_2_incl_vat: float, vat_percent: float) -> PricingSettingsData:
    price_1 = round(float(price_1_incl_vat), 2)
    price_2 = round(float(price_2_incl_vat), 2)
    vat = round(float(vat_percent), 2)
    if price_1 < 0.5:
        raise ValueError("One-person price must be at least 0.50 OMR.")
    if price_2 < 0.5:
        raise ValueError("Two-person price must be at least 0.50 OMR.")
    if vat < 0 or vat > 100:
        raise ValueError("VAT must be between 0 and 100 percent.")
    return PricingSettingsData(price_1_incl_vat=price_1, price_2_incl_vat=price_2, vat_percent=vat)


def get_pricing_settings(db: Session) -> PricingSettingsData:
    from . import models

    row = db.query(models.PricingSettings).order_by(models.PricingSettings.id.asc()).first()
    if not row:
        return default_pricing_settings()
    return PricingSettingsData(
        price_1_incl_vat=round(float(row.price_1_incl_vat), 2),
        price_2_incl_vat=round(float(row.price_2_incl_vat), 2),
        vat_percent=round(float(row.vat_percent), 2),
    )


def save_pricing_settings(db: Session, settings: PricingSettingsData) -> PricingSettingsData:
    from . import models

    row = db.query(models.PricingSettings).order_by(models.PricingSettings.id.asc()).first()
    if row is None:
        row = models.PricingSettings(
            price_1_incl_vat=settings.price_1_incl_vat,
            price_2_incl_vat=settings.price_2_incl_vat,
            vat_percent=settings.vat_percent,
        )
        db.add(row)
    else:
        row.price_1_incl_vat = settings.price_1_incl_vat
        row.price_2_incl_vat = settings.price_2_incl_vat
        row.vat_percent = settings.vat_percent
        row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return get_pricing_settings(db)


def settings_payload(settings: PricingSettingsData) -> dict[str, float]:
    return {
        "price_1_incl_vat": settings.price_1_incl_vat,
        "price_2_incl_vat": settings.price_2_incl_vat,
        "vat_percent": settings.vat_percent,
        "price_1_pre_vat": settings.price_1_pre_vat,
        "price_2_pre_vat": settings.price_2_pre_vat,
        "price_1_vat_amount": settings.price_1_vat_amount,
        "price_2_vat_amount": settings.price_2_vat_amount,
    }


# Backwards-compatible aliases used as fallbacks when no DB row exists.
PRICE_1_PASSENGER = default_pricing_settings().price_1_pre_vat
PRICE_2_PASSENGERS = default_pricing_settings().price_2_pre_vat
PRICE_PER_PASSENGER_2 = PRICE_2_PASSENGERS / 2


BOOKING_MODE_GROUP = "group"
BOOKING_MODE_INDIVIDUAL = "individual"
BOOKING_MODES = (BOOKING_MODE_GROUP, BOOKING_MODE_INDIVIDUAL)

GROUP_TYPE_FAMILY = "family"
GROUP_TYPE_LADIES = "ladies"
GROUP_TYPE_MEN = "men"
GROUP_TYPE_MIX = "mix"
GROUP_TYPES = frozenset({GROUP_TYPE_FAMILY, GROUP_TYPE_LADIES, GROUP_TYPE_MEN, GROUP_TYPE_MIX})


def normalize_group_type(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    if normalized not in GROUP_TYPES:
        raise ValueError("Invalid group type. Choose Family, Ladies, Men, or General.")
    return normalized


def group_type_label(value: str | None, *, language: str = "en") -> str:
    labels_en = {
        GROUP_TYPE_FAMILY: "Family",
        GROUP_TYPE_LADIES: "Ladies",
        GROUP_TYPE_MEN: "Men",
        GROUP_TYPE_MIX: "General",
    }
    labels_ar = {
        GROUP_TYPE_FAMILY: "عائلة",
        GROUP_TYPE_LADIES: "سيدات",
        GROUP_TYPE_MEN: "رجال",
        GROUP_TYPE_MIX: "عامة",
    }
    if not value:
        return ""
    lang = "ar" if language.startswith("ar") else "en"
    table = labels_ar if lang == "ar" else labels_en
    return table.get(value, value)


def normalize_booking_mode(mode: str) -> str:
    if mode == BOOKING_MODE_INDIVIDUAL:
        return BOOKING_MODE_INDIVIDUAL
    return BOOKING_MODE_GROUP


def bikes_required_for_passengers(passengers: int, mode: str = BOOKING_MODE_GROUP) -> int:
    if passengers < 1:
        raise ValueError("At least one passenger is required.")
    if normalize_booking_mode(mode) == BOOKING_MODE_INDIVIDUAL:
        return passengers
    return math.ceil(passengers / MAX_PASSENGERS_PER_BIKE)


def distribute_passengers_across_bikes(total_passengers: int, mode: str = BOOKING_MODE_GROUP) -> list[int]:
    """Split passengers across bikes. Individual mode assigns one passenger per bike."""
    if normalize_booking_mode(mode) == BOOKING_MODE_INDIVIDUAL:
        return [1] * total_passengers
    remaining = total_passengers
    per_bike: list[int] = []
    while remaining > 0:
        take = min(MAX_PASSENGERS_PER_BIKE, remaining)
        per_bike.append(take)
        remaining -= take
    return per_bike


def calculate_buggy_price(passengers: int, settings: PricingSettingsData | None = None) -> float:
    cfg = settings or default_pricing_settings()
    if passengers == 1:
        return cfg.price_1_pre_vat
    if passengers == 2:
        return cfg.price_2_pre_vat
    raise ValueError(f"Each bike holds 1 or 2 passengers, got {passengers}")


def calculate_group_price(total_passengers: int, settings: PricingSettingsData | None = None) -> float:
    return calculate_booking_price(total_passengers, BOOKING_MODE_GROUP, settings)


def calculate_booking_price(
    total_passengers: int,
    mode: str = BOOKING_MODE_GROUP,
    settings: PricingSettingsData | None = None,
) -> float:
    return sum(
        calculate_buggy_price(count, settings)
        for count in distribute_passengers_across_bikes(total_passengers, mode)
    )


def calculate_tax(subtotal: float, vat_percent: float | None = None) -> float:
    percent = DEFAULT_VAT_PERCENT if vat_percent is None else float(vat_percent)
    return round(subtotal * (percent / 100.0), 2)


def calculate_total_with_tax(subtotal: float, vat_percent: float | None = None) -> float:
    return round(subtotal + calculate_tax(subtotal, vat_percent), 2)


def booking_price_breakdown(subtotal: float | None, tax_amount: float | None, total_price: float) -> tuple[float, float, float]:
    """Return (subtotal, tax, total) with sensible fallbacks for legacy rows."""
    if subtotal is not None and tax_amount is not None:
        return round(float(subtotal), 2), round(float(tax_amount), 2), round(float(total_price), 2)
    if tax_amount is not None and tax_amount > 0:
        sub = round(float(total_price) - float(tax_amount), 2)
        return sub, round(float(tax_amount), 2), round(float(total_price), 2)
    # Legacy booking without tax columns — treat stored total as subtotal
    sub = round(float(total_price), 2)
    return sub, 0.0, sub
