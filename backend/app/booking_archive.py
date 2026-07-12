from collections import defaultdict

from sqlalchemy.orm import Session

from . import models
from . import booking_lifecycle

MONTH_NAMES = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]


def _booking_date_parts(booking: models.Booking) -> tuple[int, int, int, str]:
    if booking.date and len(booking.date.split("-")) == 3:
        year_s, month_s, day_s = booking.date.split("-")
        return int(year_s), int(month_s), int(day_s), booking.date
    created = booking.created_at
    date_iso = created.strftime("%Y-%m-%d")
    return created.year, created.month, created.day, date_iso


def build_booking_archive(db: Session) -> dict:
    bookings = (
        booking_lifecycle.admin_listed_bookings_query(db)
        .order_by(models.Booking.date.desc(), models.Booking.time.desc())
        .all()
    )
    years: dict[int, dict] = defaultdict(lambda: {"months": defaultdict(lambda: {"days": {}})})

    for booking in bookings:
        year, month, day, date_iso = _booking_date_parts(booking)
        year_entry = years[year]
        year_entry.setdefault("year", year)
        year_entry["count"] = year_entry.get("count", 0) + 1

        month_bucket = year_entry["months"][month]
        month_bucket.setdefault("month", month)
        month_bucket.setdefault("month_label", MONTH_NAMES[month])
        month_bucket["count"] = month_bucket.get("count", 0) + 1

        day_bucket = month_bucket["days"].setdefault(
            day,
            {"day": day, "date": date_iso, "count": 0},
        )
        day_bucket["count"] += 1

    archive_years = []
    for year in sorted(years.keys(), reverse=True):
        year_data = years[year]
        months_list = []
        for month in sorted(year_data["months"].keys(), reverse=True):
            month_data = year_data["months"][month]
            days_list = [month_data["days"][day] for day in sorted(month_data["days"].keys(), reverse=True)]
            months_list.append(
                {
                    "month": month_data["month"],
                    "month_label": month_data["month_label"],
                    "count": month_data["count"],
                    "days": days_list,
                }
            )
        archive_years.append({"year": year_data["year"], "count": year_data["count"], "months": months_list})

    return {"total": len(bookings), "years": archive_years}


def filter_bookings_query(db: Session, year: int | None, month: int | None, day: int | None):
    query = booking_lifecycle.admin_listed_bookings_query(db)
    if year and month and day:
        prefix = f"{year:04d}-{month:02d}-{day:02d}"
        query = query.filter(models.Booking.date == prefix)
    elif year and month:
        prefix = f"{year:04d}-{month:02d}-"
        query = query.filter(models.Booking.date.like(f"{prefix}%"))
    elif year:
        prefix = f"{year:04d}-"
        query = query.filter(models.Booking.date.like(f"{prefix}%"))
    return query.order_by(models.Booking.date.desc(), models.Booking.time.desc(), models.Booking.id.desc())


def booking_has_confirmation(db: Session, booking_id: int) -> bool:
    return (
        db.query(models.BookingEmailLog)
        .filter(
            models.BookingEmailLog.booking_id == booking_id,
            models.BookingEmailLog.email_type == "confirmation",
            models.BookingEmailLog.delivery_status.in_(["sent", "saved_dev"]),
        )
        .first()
        is not None
    )
