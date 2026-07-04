from sqlalchemy.orm import Session

from . import models
from .pricing import (
    ACTIVE_BOOKING_STATUSES,
    MAX_GROUP_PASSENGERS,
    TIME_SLOTS,
    bikes_required_for_passengers,
    calculate_booking_price,
    distribute_passengers_across_bikes,
    normalize_booking_mode,
)


def active_fleet_units(db: Session) -> list[models.FleetUnit]:
    return (
        db.query(models.FleetUnit)
        .filter(models.FleetUnit.is_active == True)  # noqa: E712
        .order_by(models.FleetUnit.unit_number)
        .all()
    )


def booked_fleet_unit_ids(db: Session, booking_date: str, booking_time: str) -> set[int]:
    booked: set[int] = set()
    legacy_rows = (
        db.query(models.Booking.fleet_unit_id)
        .filter(
            models.Booking.date == booking_date,
            models.Booking.time == booking_time,
            models.Booking.fleet_unit_id.isnot(None),
            models.Booking.booking_status.in_(ACTIVE_BOOKING_STATUSES),
        )
        .all()
    )
    booked.update(row[0] for row in legacy_rows if row[0] is not None)

    bike_rows = (
        db.query(models.BookingBike.fleet_unit_id)
        .join(models.Booking, models.BookingBike.booking_id == models.Booking.id)
        .filter(
            models.Booking.date == booking_date,
            models.Booking.time == booking_time,
            models.Booking.booking_status.in_(ACTIVE_BOOKING_STATUSES),
        )
        .all()
    )
    booked.update(row[0] for row in bike_rows if row[0] is not None)
    return booked


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


def booking_fleet_unit_ids(db: Session, booking: models.Booking) -> list[int]:
    rows = (
        db.query(models.BookingBike.fleet_unit_id)
        .filter(models.BookingBike.booking_id == booking.id)
        .order_by(models.BookingBike.id)
        .all()
    )
    if rows:
        return [row[0] for row in rows]
    if booking.fleet_unit_id:
        return [booking.fleet_unit_id]
    return []


def booking_fleet_units(db: Session, booking: models.Booking) -> list[models.FleetUnit]:
    ids = booking_fleet_unit_ids(db, booking)
    units: list[models.FleetUnit] = []
    for unit_id in ids:
        unit = db.get(models.FleetUnit, unit_id)
        if unit:
            units.append(unit)
    return units


def format_bike_label(units: list[models.FleetUnit]) -> str:
    if not units:
        return "—"
    return ", ".join(f"Buggy #{unit.unit_number}" for unit in units)


def validate_group_booking(
    db: Session,
    booking_date: str,
    booking_time: str,
    fleet_unit_ids: list[int],
    passengers: int,
    booking_mode: str = "group",
) -> None:
    if booking_time not in TIME_SLOTS:
        raise ValueError("Invalid time slot.")
    if passengers < 1 or passengers > MAX_GROUP_PASSENGERS:
        raise ValueError(f"Passengers must be between 1 and {MAX_GROUP_PASSENGERS}.")
    mode = normalize_booking_mode(booking_mode)
    required_bikes = bikes_required_for_passengers(passengers, mode)
    if len(fleet_unit_ids) != required_bikes:
        if mode == "individual":
            raise ValueError(
                f"Individual booking: {passengers} passenger(s) need {required_bikes} separate bike(s). "
                f"You selected {len(fleet_unit_ids)}."
            )
        raise ValueError(
            f"{passengers} passenger(s) require {required_bikes} bike(s). "
            f"You selected {len(fleet_unit_ids)}."
        )
    if len(set(fleet_unit_ids)) != len(fleet_unit_ids):
        raise ValueError("Each bike can only be selected once.")

    booked = booked_fleet_unit_ids(db, booking_date, booking_time)
    for fleet_unit_id in fleet_unit_ids:
        unit = db.get(models.FleetUnit, fleet_unit_id)
        if not unit or not unit.is_active:
            raise ValueError("One of the selected buggies is not available.")
        if fleet_unit_id in booked:
            raise ValueError("One of the selected buggies is already booked for this time slot.")


def create_booking_bikes(db: Session, booking: models.Booking, fleet_unit_ids: list[int]) -> None:
    mode = normalize_booking_mode(getattr(booking, "booking_mode", "group"))
    per_bike_passengers = distribute_passengers_across_bikes(booking.passengers, mode)
    for fleet_unit_id, bike_passengers in zip(fleet_unit_ids, per_bike_passengers, strict=True):
        db.add(
            models.BookingBike(
                booking_id=booking.id,
                fleet_unit_id=fleet_unit_id,
                passengers=bike_passengers,
            )
        )


def backfill_booking_bikes(db: Session) -> int:
    missing = (
        db.query(models.Booking)
        .outerjoin(models.BookingBike, models.BookingBike.booking_id == models.Booking.id)
        .filter(models.BookingBike.id.is_(None), models.Booking.fleet_unit_id.isnot(None))
        .all()
    )
    if not missing:
        return 0
    for booking in missing:
        db.add(
            models.BookingBike(
                booking_id=booking.id,
                fleet_unit_id=booking.fleet_unit_id,
                passengers=booking.passengers,
            )
        )
    db.commit()
    return len(missing)


def server_booking_price(passengers: int, booking_mode: str = "group") -> float:
    return calculate_booking_price(passengers, booking_mode)
