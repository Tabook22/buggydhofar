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

# Legacy booking_status filter — admin lists use payment_status == "paid" instead.
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


def is_token_accessible_booking(booking: models.Booking) -> bool:
    """Bookings reachable via secret check-in token (confirmation / payment completion)."""
    if is_customer_facing_booking(booking):
        return True
    if (
        booking.payment_method == "visa"
        and booking.payment_status != "paid"
        and booking.booking_status != "cancelled"
    ):
        return True
    return False


def is_paid_booking(booking: models.Booking) -> bool:
    return booking.payment_status == "paid"


def is_unpaid_visa_booking(booking: models.Booking) -> bool:
    if is_paid_booking(booking):
        return False
    return booking.payment_method == "visa" and booking.booking_status == "pending"


def admin_listed_bookings_query(db: Session):
    """Bookings with confirmed payment — shown in admin archive and overview."""
    return db.query(models.Booking).filter(models.Booking.payment_status == "paid")


def sync_paid_booking_statuses(db: Session) -> int:
    """Repair rows where payment succeeded but booking_status was not updated."""
    mismatched = (
        db.query(models.Booking)
        .filter(models.Booking.payment_status == "paid", models.Booking.booking_status != "paid")
        .all()
    )
    if not mismatched:
        return 0
    for booking in mismatched:
        booking.booking_status = "paid"
    db.commit()
    return len(mismatched)


def delete_booking_and_related(db: Session, booking: models.Booking, *, commit: bool = True) -> None:
    """Remove booking, fleet holds, promo usage, and email logs."""
    from . import promo_codes

    booking_id = booking.id
    promo_codes.release_promo_usage(db, booking)
    db.query(models.BookingEmailLog).filter(models.BookingEmailLog.booking_id == booking_id).delete(
        synchronize_session=False
    )
    db.delete(booking)

    if commit:
        db.commit()


def delete_unpaid_visa_booking(db: Session, booking: models.Booking, *, commit: bool = True) -> bool:
    if not is_unpaid_visa_booking(booking):
        return False
    delete_booking_and_related(db, booking, commit=commit)
    return True


def delete_all_unpaid_visa_bookings(db: Session) -> int:
    pending_visa = (
        db.query(models.Booking)
        .filter(
            models.Booking.payment_method == "visa",
            models.Booking.payment_status != "paid",
            models.Booking.booking_status != "paid",
        )
        .all()
    )
    if not pending_visa:
        return 0
    for booking in pending_visa:
        delete_booking_and_related(db, booking, commit=False)
    db.commit()
    return len(pending_visa)


def purge_cancelled_unpaid_visa_bookings(db: Session) -> int:
    """Remove legacy cancelled Visa rows that never completed payment."""
    legacy = (
        db.query(models.Booking)
        .filter(
            models.Booking.payment_method == "visa",
            models.Booking.booking_status == "cancelled",
            models.Booking.payment_status != "paid",
        )
        .all()
    )
    if not legacy:
        return 0
    for booking in legacy:
        delete_booking_and_related(db, booking, commit=False)
    db.commit()
    return len(legacy)


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
    """Delete incomplete pending bookings past their hold window (no cancel emails)."""
    now = datetime.utcnow()
    visa_cutoff = now - timedelta(minutes=VISA_PAYMENT_HOLD_MINUTES)
    default_cutoff = now - timedelta(hours=AUTO_CANCEL_HOURS)
    pending = db.query(models.Booking).filter(models.Booking.booking_status == "pending").all()
    stale = [
        booking
        for booking in pending
        if booking.payment_status != "paid"
        and booking.created_at
        < (visa_cutoff if booking.payment_method == "visa" else default_cutoff)
    ]
    if not stale:
        return []

    for booking in stale:
        delete_booking_and_related(db, booking, commit=False)

    db.commit()
    return stale


# Backwards-compatible aliases used during rollout
cancel_unpaid_visa_booking = delete_unpaid_visa_booking
cancel_all_unpaid_visa_bookings = delete_all_unpaid_visa_bookings