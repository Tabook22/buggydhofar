"""Flat buggy-bike pricing (OMR)."""

import math

PRICE_1_PASSENGER = 25.0
PRICE_PER_PASSENGER_2 = 15.0
MAX_PASSENGERS_PER_BIKE = 2
MAX_GROUP_PASSENGERS = 40

TIME_SLOTS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"]

ACTIVE_BOOKING_STATUSES = ("pending", "paid")

TAX_RATE = 0.05
TAX_PERCENT = 5


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


def calculate_buggy_price(passengers: int) -> float:
    if passengers == 1:
        return PRICE_1_PASSENGER
    if passengers == 2:
        return PRICE_PER_PASSENGER_2 * 2
    raise ValueError(f"Each bike holds 1 or 2 passengers, got {passengers}")


def calculate_group_price(total_passengers: int) -> float:
    return calculate_booking_price(total_passengers, BOOKING_MODE_GROUP)


def calculate_booking_price(total_passengers: int, mode: str = BOOKING_MODE_GROUP) -> float:
    return sum(
        calculate_buggy_price(count)
        for count in distribute_passengers_across_bikes(total_passengers, mode)
    )


def calculate_tax(subtotal: float) -> float:
    return round(subtotal * TAX_RATE, 2)


def calculate_total_with_tax(subtotal: float) -> float:
    return round(subtotal + calculate_tax(subtotal), 2)


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
