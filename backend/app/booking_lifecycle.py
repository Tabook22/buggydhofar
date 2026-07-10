"""Booking status rules and lifecycle helpers."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from . import models

# Admin-facing statuses — only admin may set paid or cancelled.
BOOKING_STATUSES = ("pending", "paid", "cancelled")

# Blocks a buggy on the availability board.
ACTIVE_BOOKING_STATUSES = ("pending", "paid")

# Counts toward revenue and dashboard booking totals (fully paid only).
COUNTED_BOOKING_STATUSES = ("paid",)

# Shown in admin archive / overview day lists (fully paid only).
ARCHIVE_LIST_STATUSES = ("paid",)

REVENUE_STATUSES = ("paid",)

AUTO_CANCEL_HOURS = 24
VISA_PAYMENT_HOLD_MINUTES = 30


def normalize_status(status: str) -> str:
    if status in {"confirmed", "completed"}:
        return "pending"
    return status


def is_booking_cancelled(status: str) -> bool:
    return status == "cancelled"


def is_booking_confirmed(status: str) -> bool:
    return normalize_status(status) == "paid"


def is_booking_visible(status: str) -> bool:
    return normalize_status(status) != "cancelled" and status != "cancelled"


def is_customer_facing_booking(booking: models.Booking) -> bool:
    """Paid bookings, or legacy bank-transfer pending awaiting verification."""
    if booking.booking_status == "paid" and booking.payment_status == "paid":
        return True
    if booking.booking_status == "pending" and booking.payment_method == "bank_transfer":
        return True
    return False


def cancel_all_unpaid_visa_bookings(db: Session) -> int:
    pending_visa = (
        db.query(models.Booking)
        .filter(
            models.Booking.booking_status == "pending",
            models.Booking.payment_method == "visa",
        )
        .all()
    )
    if not pending_visa:
        return 0
    from . import promo_codes

    for booking in pending_visa:
        promo_codes.release_promo_usage(db, booking)
        booking.booking_status = "cancelled"
        booking.payment_status = "cancelled"
    db.commit()
    return len(pending_visa)


def cancel_unpaid_visa_booking(db: Session, booking: models.Booking, *, commit: bool = True) -> bool:
    if booking.payment_method != "visa":
        return False
    if booking.booking_status != "pending" or booking.payment_status == "paid":
        return False

    from . import promo_codes

    promo_codes.release_promo_usage(db, booking)
    booking.booking_status = "cancelled"
    booking.payment_status = "cancelled"
    if commit:
        db.commit()
    return True


def normalize_legacy_statuses(db: Session) -> int:
    updated = (
        db.query(models.Booking)
        .filter(models.Booking.booking_status.in_(["confirmed", "completed"]))
        .update(
            {
                models.Booking.booking_status: "pending",
                models.Booking.payment_status: "pending",
            },
            synchronize_session=False,
        )
    )
    if updated:
        db.commit()
    return updated


def expire_stale_pending_bookings(db: Session) -> list[models.Booking]:
    now = datetime.utcnow()
    visa_cutoff = now - timedelta(minutes=VISA_PAYMENT_HOLD_MINUTES)
    default_cutoff = now - timedelta(hours=AUTO_CANCEL_HOURS)
    pending = db.query(models.Booking).filter(models.Booking.booking_status == "pending").all()
    stale = [
        booking
        for booking in pending
        if booking.created_at
        < (visa_cutoff if booking.payment_method == "visa" else default_cutoff)
    ]
    if not stale:
        return []

    from . import promo_codes

    for booking in stale:
        promo_codes.release_promo_usage(db, booking)
        booking.booking_status = "cancelled"
        booking.payment_status = "cancelled"

    db.commit()
    return stale
