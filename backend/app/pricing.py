"""Flat buggy-bike pricing (OMR)."""

PRICE_1_PASSENGER = 24.0
PRICE_PER_PASSENGER_2 = 15.0
MAX_PASSENGERS_PER_BIKE = 2

TIME_SLOTS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"]

ACTIVE_BOOKING_STATUSES = ("pending", "paid")


def calculate_buggy_price(passengers: int) -> float:
    if passengers == 1:
        return PRICE_1_PASSENGER
    if passengers == 2:
        return PRICE_PER_PASSENGER_2 * 2
    raise ValueError(f"Passengers must be 1 or 2, got {passengers}")
