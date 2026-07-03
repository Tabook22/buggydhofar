from sqlalchemy.orm import Session

from . import models
from .pricing import ACTIVE_BOOKING_STATUSES, TIME_SLOTS, calculate_buggy_price


def active_fleet_units(db: Session) -> list[models.FleetUnit]:
    return (
        db.query(models.FleetUnit)
        .filter(models.FleetUnit.is_active == True)  # noqa: E712
        .order_by(models.FleetUnit.unit_number)
        .all()
    )


def booked_fleet_unit_ids(db: Session, booking_date: str, booking_time: str) -> set[int]:
    rows = (
        db.query(models.Booking.fleet_unit_id)
        .filter(
            models.Booking.date == booking_date,
            models.Booking.time == booking_time,
            models.Booking.fleet_unit_id.isnot(None),
            models.Booking.booking_status.in_(ACTIVE_BOOKING_STATUSES),
        )
        .all()
    )
    return {row[0] for row in rows if row[0] is not None}


def available_fleet_units(db: Session, booking_date: str, booking_time: str) -> list[models.FleetUnit]:
    fleet = active_fleet_units(db)
    booked = booked_fleet_unit_ids(db, booking_date, booking_time)
    return [unit for unit in fleet if unit.id not in booked]


def slot_availability(db: Session, booking_date: str) -> list[dict]:
    fleet = active_fleet_units(db)
    total = len(fleet)
    slots = []
    for slot_time in TIME_SLOTS:
        booked_count = len(booked_fleet_unit_ids(db, booking_date, slot_time))
        slots.append(
            {
                "time": slot_time,
                "total_bikes": total,
                "booked": booked_count,
                "available": max(total - booked_count, 0),
            }
        )
    return slots


def validate_booking(
    db: Session,
    booking_date: str,
    booking_time: str,
    fleet_unit_id: int,
    passengers: int,
) -> None:
    if booking_time not in TIME_SLOTS:
        raise ValueError("Invalid time slot.")
    if passengers not in (1, 2):
        raise ValueError("Each buggy holds 1 or 2 passengers.")
    unit = db.get(models.FleetUnit, fleet_unit_id)
    if not unit or not unit.is_active:
        raise ValueError("Selected buggy is not available.")
    if fleet_unit_id in booked_fleet_unit_ids(db, booking_date, booking_time):
        raise ValueError("This buggy is already booked for the selected time slot.")


def server_booking_price(passengers: int) -> float:
    return calculate_buggy_price(passengers)
