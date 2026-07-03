"""Unique 4-digit booking reference numbers."""

import secrets

from sqlalchemy.orm import Session

from . import models

BOOKING_NUMBER_MIN = 1000
BOOKING_NUMBER_MAX = 9999
MAX_ATTEMPTS = 200


def booking_reference(booking: models.Booking) -> str:
    if booking.booking_number:
        return booking.booking_number
    return str(booking.id).zfill(4)


def generate_unique_booking_number(db: Session) -> str:
    used = {
        row[0]
        for row in db.query(models.Booking.booking_number)
        .filter(models.Booking.booking_number.isnot(None))
        .all()
        if row[0]
    }
    for _ in range(MAX_ATTEMPTS):
        number = str(secrets.randbelow(BOOKING_NUMBER_MAX - BOOKING_NUMBER_MIN + 1) + BOOKING_NUMBER_MIN)
        if number not in used:
            return number
    raise RuntimeError("Could not allocate a unique booking number")


def backfill_booking_numbers(db: Session) -> int:
    missing = (
        db.query(models.Booking)
        .filter((models.Booking.booking_number.is_(None)) | (models.Booking.booking_number == ""))
        .order_by(models.Booking.id)
        .all()
    )
    if not missing:
        return 0
    for booking in missing:
        booking.booking_number = generate_unique_booking_number(db)
    db.commit()
    return len(missing)
