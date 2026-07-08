"""Booking status rules and lifecycle helpers."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from . import models

# Admin-facing statuses — only admin may set paid or cancelled.
BOOKING_STATUSES = ("pending", "paid", "cancelled")

# Blocks a buggy on the availability board.
ACTIVE_BOOKING_STATUSES = ("pending", "paid")

# Counts toward revenue and dashboard booking totals.
COUNTED_BOOKING_STATUSES = ("pending", "paid")

# Shown in admin archive list (includes cancelled for audit/history).
ARCHIVE_LIST_STATUSES = COUNTED_BOOKING_STATUSES + ("cancelled", "confirmed", "completed")

REVENUE_STATUSES = ("paid",)

AUTO_CANCEL_HOURS = 24


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
    cutoff = datetime.utcnow() - timedelta(hours=AUTO_CANCEL_HOURS)
    stale = (
        db.query(models.Booking)
        .filter(
            models.Booking.booking_status == "pending",
            models.Booking.created_at < cutoff,
        )
        .all()
    )
    if not stale:
        return []

    from . import promo_codes

    for booking in stale:
        promo_codes.release_promo_usage(db, booking)
        booking.booking_status = "cancelled"
        booking.payment_status = "cancelled"

    db.commit()
    return stale
