from datetime import date, datetime
import logging
import os

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import extract, func, text
from sqlalchemy.orm import Session

from . import admin_permissions as perm, auth, amwal, booking_archive, booking_lifecycle, booking_numbers, booking_qr, email_service, fleet, media_assets, media_storage, models, pricing, promo_codes, routes_geo, schemas, waiver
from .database import Base, SessionLocal, engine, get_db
from .seed import seed_database, seed_payment_transfer_defaults

Base.metadata.create_all(bind=engine)

logger = logging.getLogger(__name__)

app = FastAPI(title="Khareef Adventure Booking API")

_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://buggydhofar.com",
    "https://www.buggydhofar.com",
    "http://buggydhofar.com",
    "http://www.buggydhofar.com",
]


def _cors_origins() -> list[str]:
    extra = os.getenv("CORS_ORIGINS", "")
    origins = list(_DEFAULT_CORS_ORIGINS)
    if extra.strip():
        origins.extend(part.strip() for part in extra.split(",") if part.strip())
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    media_storage.PUBLIC_UPLOAD_PREFIX,
    StaticFiles(directory=str(media_storage.upload_root())),
    name="uploads",
)


def ensure_route_location_columns() -> None:
    defaults = {
        "start_location": "TEXT DEFAULT 'Salalah Tourism Area'",
        "end_location": "TEXT DEFAULT 'Dhofar Khareef Viewpoint'",
        "start_lat": "FLOAT DEFAULT 17.0194",
        "start_lng": "FLOAT DEFAULT 54.0897",
        "end_lat": "FLOAT DEFAULT 17.0896",
        "end_lng": "FLOAT DEFAULT 54.1657",
        "path_points": "TEXT DEFAULT '[]'",
        "display_on_home": "BOOLEAN DEFAULT 1",
    }
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(routes)"))}
        for column, definition in defaults.items():
            if column not in existing_columns:
                connection.execute(text(f"ALTER TABLE routes ADD COLUMN {column} {definition}"))


def ensure_vehicle_display_columns() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(vehicles)"))}
        if "display_on_home" not in existing_columns:
            connection.execute(text("ALTER TABLE vehicles ADD COLUMN display_on_home BOOLEAN DEFAULT 1"))


def ensure_booking_fleet_column() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(bookings)"))}
        if "fleet_unit_id" not in existing_columns:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN fleet_unit_id INTEGER REFERENCES fleet_units(id)"))


def ensure_booking_number_column() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(bookings)"))}
        if "booking_number" not in existing_columns:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN booking_number TEXT"))
        connection.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_bookings_booking_number ON bookings(booking_number)")
        )


def ensure_hero_background_type_column() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(site_content)"))}
        if "hero_background_type" not in existing_columns:
            connection.execute(text("ALTER TABLE site_content ADD COLUMN hero_background_type TEXT DEFAULT 'image'"))


def ensure_footer_nav_content_columns() -> None:
    defaults = {
        "site_name_en": "TEXT DEFAULT 'Buggy Bike Booking'",
        "site_name_ar": "TEXT DEFAULT 'حجز الباجي'",
        "footer_text_en": "TEXT DEFAULT 'Simple buggy bike booking for guests in Salalah.'",
        "footer_text_ar": "TEXT DEFAULT 'حجز بسيط للباجي للضيوف في صلالة.'",
        "nav_book_en": "TEXT DEFAULT 'Book Now'",
        "nav_book_ar": "TEXT DEFAULT 'احجز الآن'",
        "footer_admin_en": "TEXT DEFAULT 'Admin'",
        "footer_admin_ar": "TEXT DEFAULT 'الإدارة'",
    }
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(site_content)"))}
        for column, definition in defaults.items():
            if column not in existing_columns:
                connection.execute(text(f"ALTER TABLE site_content ADD COLUMN {column} {definition}"))


def ensure_availability_board_content_columns() -> None:
    defaults = {
        "availability_live_en": "TEXT DEFAULT 'Live availability'",
        "availability_live_ar": "TEXT DEFAULT 'توفر مباشر'",
        "availability_title_en": "TEXT DEFAULT 'Buggy Bikes Board'",
        "availability_title_ar": "TEXT DEFAULT 'لوحة الباجيات'",
        "availability_subtitle_en": "TEXT DEFAULT 'Real-time fleet status by time slot — like an airport departures screen.'",
        "availability_subtitle_ar": "TEXT DEFAULT 'حالة الأسطول حسب الوقت — مثل شاشة المطارات.'",
    }
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(site_content)"))}
        for column, definition in defaults.items():
            if column not in existing_columns:
                connection.execute(text(f"ALTER TABLE site_content ADD COLUMN {column} {definition}"))


def ensure_payment_transfer_columns() -> None:
    defaults = {
        "transfer_title_en": "TEXT DEFAULT 'Payment Instructions'",
        "transfer_title_ar": "TEXT DEFAULT 'تعليمات الدفع'",
        "transfer_bank_name_en": "TEXT DEFAULT ''",
        "transfer_bank_name_ar": "TEXT DEFAULT ''",
        "transfer_account_name_en": "TEXT DEFAULT ''",
        "transfer_account_name_ar": "TEXT DEFAULT ''",
        "transfer_account_number": "TEXT DEFAULT ''",
        "transfer_iban": "TEXT DEFAULT ''",
        "transfer_mobile_wallet_en": "TEXT DEFAULT ''",
        "transfer_mobile_wallet_ar": "TEXT DEFAULT ''",
        "transfer_mobile_number": "TEXT DEFAULT ''",
        "transfer_notes_en": "TEXT DEFAULT ''",
        "transfer_notes_ar": "TEXT DEFAULT ''",
        "transfer_show_title": "BOOLEAN DEFAULT 1",
        "transfer_show_bank_name": "BOOLEAN DEFAULT 1",
        "transfer_show_account_name": "BOOLEAN DEFAULT 1",
        "transfer_show_account_number": "BOOLEAN DEFAULT 1",
        "transfer_show_iban": "BOOLEAN DEFAULT 1",
        "transfer_show_mobile_wallet": "BOOLEAN DEFAULT 1",
        "transfer_show_mobile_number": "BOOLEAN DEFAULT 1",
        "transfer_show_notes": "BOOLEAN DEFAULT 1",
    }
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(site_content)"))}
        for column, definition in defaults.items():
            if column not in existing_columns:
                connection.execute(text(f"ALTER TABLE site_content ADD COLUMN {column} {definition}"))


def ensure_booking_mode_column() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(bookings)"))}
        if "booking_mode" not in existing_columns:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN booking_mode TEXT DEFAULT 'group'"))


def ensure_booking_group_type_column() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(bookings)"))}
        if "group_type" not in existing_columns:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN group_type TEXT"))


def ensure_booking_tax_columns() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(bookings)"))}
        if "subtotal" not in existing_columns:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN subtotal REAL"))
        if "tax_amount" not in existing_columns:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN tax_amount REAL"))


def ensure_booking_promo_columns() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(bookings)"))}
        columns = {
            "discount_amount": "REAL",
            "promo_code_id": "INTEGER",
            "promo_code": "TEXT",
        }
        for column, definition in columns.items():
            if column not in existing_columns:
                connection.execute(text(f"ALTER TABLE bookings ADD COLUMN {column} {definition}"))


def ensure_booking_waiver_columns() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(bookings)"))}
        columns = {
            "national_id": "TEXT",
            "waiver_accepted": "BOOLEAN DEFAULT 0",
            "waiver_accepted_at": "DATETIME",
            "waiver_text": "TEXT",
            "waiver_language": "TEXT",
        }
        for column, definition in columns.items():
            if column not in existing_columns:
                connection.execute(text(f"ALTER TABLE bookings ADD COLUMN {column} {definition}"))


def backfill_booking_tax(db: Session) -> int:
    missing = db.query(models.Booking).filter(models.Booking.subtotal.is_(None)).all()
    if not missing:
        return 0
    for booking in missing:
        booking.subtotal = booking.total_price
        booking.tax_amount = 0.0
    db.commit()
    return len(missing)


def ensure_booking_check_in_columns() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(bookings)"))}
        if "check_in_token" not in existing_columns:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN check_in_token TEXT"))
        if "checked_in_at" not in existing_columns:
            connection.execute(text("ALTER TABLE bookings ADD COLUMN checked_in_at DATETIME"))


def backfill_check_in_tokens(db: Session) -> int:
    missing = db.query(models.Booking).filter(models.Booking.check_in_token.is_(None)).all()
    if not missing:
        return 0
    for booking in missing:
        booking.check_in_token = booking_qr.ensure_unique_check_in_token(db)
    db.commit()
    return len(missing)


def ensure_admin_role_column() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(admins)"))}
        if "role" not in existing_columns:
            connection.execute(text("ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'admin'"))


def ensure_admin_permissions_column() -> None:
    with engine.begin() as connection:
        existing_columns = {row[1] for row in connection.execute(text("PRAGMA table_info(admins)"))}
        if "permissions" not in existing_columns:
            connection.execute(text("ALTER TABLE admins ADD COLUMN permissions TEXT"))


def backfill_primary_super_admin(db: Session) -> None:
    primary = db.query(models.Admin).filter(models.Admin.username == "admin").first()
    if primary and primary.role == auth.ROLE_ADMIN:
        primary.role = perm.ROLE_SUPER_ADMIN
        db.commit()


def backfill_scanner_user(db: Session) -> None:
    from .auth import hash_password

    if db.query(models.Admin).filter(models.Admin.username == "scanner").first() is None:
        db.add(models.Admin(username="scanner", password_hash=hash_password("scanner123"), role="scanner"))
        db.commit()


def booking_check_in_out(booking: models.Booking, db: Session) -> schemas.BookingCheckInOut:
    route = db.get(models.Route, booking.route_id)
    units = fleet.booking_fleet_units(db, booking)
    token = booking.check_in_token or ""
    return schemas.BookingCheckInOut(
        booking_id=booking.id,
        booking_number=booking.booking_number or "",
        customer_name=booking.customer_name,
        phone=booking.phone,
        email=booking.email,
        date=booking.date,
        time=booking.time,
        passengers=booking.passengers,
        bike_count=len(units) or (1 if booking.fleet_unit_id else 0),
        fleet_unit_numbers=[unit.unit_number for unit in units],
        route_name_en=route.name_en if route else None,
        route_name_ar=route.name_ar if route else None,
        booking_mode=getattr(booking, "booking_mode", None) or "group",
        group_type=getattr(booking, "group_type", None),
        booking_status=booking_lifecycle.normalize_status(booking.booking_status),
        payment_status=booking.payment_status,
        total_price=booking.total_price,
        checked_in_at=booking.checked_in_at,
        check_in_url=booking_qr.build_check_in_url(token) if token else "",
    )


def booking_to_out(booking: models.Booking, db: Session) -> schemas.BookingOut:
    units = fleet.booking_fleet_units(db, booking)
    fleet_unit_ids = [unit.id for unit in units]
    fleet_unit_numbers = [unit.unit_number for unit in units]
    return schemas.BookingOut(
        id=booking.id,
        booking_number=booking.booking_number or "",
        customer_name=booking.customer_name,
        phone=booking.phone,
        email=booking.email,
        nationality=booking.nationality,
        hotel_location=booking.hotel_location,
        date=booking.date,
        time=booking.time,
        vehicle_id=booking.vehicle_id,
        route_id=booking.route_id,
        fleet_unit_ids=fleet_unit_ids,
        fleet_unit_numbers=fleet_unit_numbers,
        bike_count=len(fleet_unit_ids) or (1 if booking.fleet_unit_id else 0),
        booking_mode=getattr(booking, "booking_mode", None) or "group",
        group_type=getattr(booking, "group_type", None),
        passengers=booking.passengers,
        subtotal=booking.subtotal,
        tax_amount=booking.tax_amount,
        discount_amount=getattr(booking, "discount_amount", None),
        promo_code=getattr(booking, "promo_code", None),
        total_price=booking.total_price,
        payment_method=booking.payment_method,
        payment_status=booking.payment_status,
        booking_status=booking_lifecycle.normalize_status(booking.booking_status),
        notes=booking.notes,
        national_id=booking.national_id,
        waiver_accepted=bool(booking.waiver_accepted),
        waiver_accepted_at=booking.waiver_accepted_at,
        check_in_token=booking.check_in_token,
        check_in_url=booking_qr.build_check_in_url(booking.check_in_token) if booking.check_in_token else None,
        checked_in_at=booking.checked_in_at,
        created_at=booking.created_at,
    )


def booking_to_admin_out(booking: models.Booking, db: Session) -> schemas.BookingAdminOut:
    route = db.get(models.Route, booking.route_id)
    email_count = db.query(models.BookingEmailLog).filter(models.BookingEmailLog.booking_id == booking.id).count()
    base = booking_to_out(booking, db)
    first_unit = fleet.booking_fleet_units(db, booking)
    first = first_unit[0] if first_unit else None
    return schemas.BookingAdminOut(
        **base.model_dump(),
        confirmation_email_sent=booking_archive.booking_has_confirmation(db, booking.id),
        booking_confirmed=booking_lifecycle.is_booking_confirmed(booking.booking_status),
        fleet_unit_number=first.unit_number if first else None,
        fleet_unit_id=first.id if first else booking.fleet_unit_id,
        route_name_en=route.name_en if route else None,
        email_count=email_count,
    )


def process_expired_pending_bookings(db: Session) -> None:
    expired = booking_lifecycle.expire_stale_pending_bookings(db)
    for booking in expired:
        email_service.send_admin_expired_booking_notice(booking.id)
        email_service.send_booking_cancelled_task(booking.id, auto_expired=True)


@app.on_event("startup")
def startup() -> None:
    ensure_route_location_columns()
    ensure_vehicle_display_columns()
    ensure_booking_fleet_column()
    ensure_booking_number_column()
    ensure_booking_mode_column()
    ensure_booking_group_type_column()
    ensure_booking_tax_columns()
    ensure_booking_promo_columns()
    ensure_booking_waiver_columns()
    ensure_booking_check_in_columns()
    ensure_admin_role_column()
    ensure_admin_permissions_column()
    ensure_payment_transfer_columns()
    ensure_hero_background_type_column()
    ensure_availability_board_content_columns()
    ensure_footer_nav_content_columns()
    db = SessionLocal()
    try:
        seed_database(db)
        for route in db.query(models.Route).all():
            normalized = routes_geo.normalize_route_payload(
                {
                    "start_location": route.start_location,
                    "end_location": route.end_location,
                    "start_lat": route.start_lat,
                    "start_lng": route.start_lng,
                    "end_lat": route.end_lat,
                    "end_lng": route.end_lng,
                    "path_points": route.path_points,
                }
            )
            for key, value in normalized.items():
                setattr(route, key, value)
        db.commit()
        booking_lifecycle.normalize_legacy_statuses(db)
        booking_numbers.backfill_booking_numbers(db)
        fleet.backfill_booking_bikes(db)
        backfill_booking_tax(db)
        backfill_check_in_tokens(db)
        backfill_scanner_user(db)
        backfill_primary_super_admin(db)
        seed_payment_transfer_defaults(db)
        process_expired_pending_bookings(db)
    finally:
        db.close()


@app.get("/api/vehicles", response_model=list[schemas.VehicleOut])
def get_vehicles(db: Session = Depends(get_db)):
    return (
        db.query(models.Vehicle)
        .filter(models.Vehicle.is_available == True, models.Vehicle.display_on_home == True)  # noqa: E712
        .order_by(models.Vehicle.id)
        .all()
    )


@app.get("/api/routes", response_model=list[schemas.RouteOut])
def get_routes(db: Session = Depends(get_db)):
    return (
        db.query(models.Route)
        .filter(models.Route.display_on_home == True)  # noqa: E712
        .order_by(models.Route.id)
        .all()
    )


@app.get("/api/site-content", response_model=schemas.SiteContentOut)
def get_site_content(db: Session = Depends(get_db)):
    content = db.query(models.SiteContent).first()
    if not content:
        raise HTTPException(status_code=404, detail="Site content not found")
    return content


@app.get("/api/gallery", response_model=list[schemas.MediaAssetOut])
def get_home_gallery(db: Session = Depends(get_db)):
    return (
        db.query(models.MediaAsset)
        .filter(
            models.MediaAsset.is_active == True,  # noqa: E712
            models.MediaAsset.show_on_home_gallery == True,  # noqa: E712
        )
        .order_by(models.MediaAsset.sort_order.asc(), models.MediaAsset.id.desc())
        .all()
    )


@app.post("/api/contact", response_model=schemas.ContactOut)
def submit_contact(payload: schemas.ContactCreate):
    if payload.website.strip():
        return {"status": "sent", "message": "Thank you. We will be in touch soon."}

    status, error = email_service.send_contact_message(
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip(),
        email=str(payload.email).strip(),
        message=payload.message.strip(),
    )
    if status == "failed":
        raise HTTPException(status_code=502, detail=error or "Unable to send your message. Please try again later.")
    if status == "saved_dev" and email_service.is_production_mode():
        logger.error("Contact form cannot send email: SMTP_HOST is not configured in production.")
        raise HTTPException(
            status_code=503,
            detail="Email is not configured on the server yet. Please email info@buggydhofar.com directly.",
        )

    return {
        "status": status,
        "message": "Thank you. We have received your message and will reply soon.",
    }


@app.get("/api/time-slots")
def get_time_slots():
    return {"slots": pricing.TIME_SLOTS}


@app.get("/api/fleet", response_model=list[schemas.FleetUnitOut])
def get_fleet(db: Session = Depends(get_db)):
    return fleet.active_fleet_units(db)


@app.get("/api/availability/board", response_model=schemas.AvailabilityBoard)
def get_availability_board(date: str, db: Session = Depends(get_db)):
    process_expired_pending_bookings(db)
    units = fleet.active_fleet_units(db)
    return {
        "date": date,
        "total_bikes": len(units),
        "slots": fleet.slot_availability(db, date),
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }


@app.get("/api/availability/fleet")
def get_fleet_availability(date: str, time: str, db: Session = Depends(get_db)):
    if time not in pricing.TIME_SLOTS:
        raise HTTPException(status_code=400, detail="Invalid time slot")
    process_expired_pending_bookings(db)
    units = fleet.active_fleet_units(db)
    booked = fleet.booked_fleet_unit_ids(db, date, time)
    available = fleet.available_fleet_units(db, date, time)
    return {
        "date": date,
        "time": time,
        "total_bikes": len(units),
        "booked": len(booked),
        "available": len(available),
        "units": [
            schemas.FleetUnitAvailability(
                id=unit.id,
                unit_number=unit.unit_number,
                name_en=unit.name_en,
                name_ar=unit.name_ar,
                is_active=unit.is_active,
                created_at=unit.created_at,
                is_available=unit.id not in booked,
            )
            for unit in units
        ],
    }


@app.get("/api/availability")
def get_availability(date: str, time: str, vehicle_id: int, route_id: int, db: Session = Depends(get_db)):
    route = db.get(models.Route, route_id)
    if not route:
        return {"available": False, "message": "Selected route is unavailable."}
    available_units = fleet.available_fleet_units(db, date, time)
    count = len(available_units)
    return {
        "available": count > 0,
        "available_count": count,
        "total_bikes": len(fleet.active_fleet_units(db)),
        "message": f"{count} buggy bike(s) available" if count else "No buggy bikes available for this time slot",
    }


@app.post("/api/bookings", response_model=schemas.BookingOut)
def create_booking(payload: schemas.BookingCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    route = db.get(models.Route, payload.route_id)
    vehicle = db.get(models.Vehicle, payload.vehicle_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    if not vehicle or not vehicle.is_available:
        raise HTTPException(status_code=400, detail="Selected vehicle type is unavailable")

    booking_mode = pricing.normalize_booking_mode(payload.booking_mode)
    try:
        group_type = pricing.normalize_group_type(payload.group_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if booking_mode == pricing.BOOKING_MODE_GROUP and not group_type:
        raise HTTPException(
            status_code=400,
            detail="Please select a group type: Family, Ladies, Men, or General.",
        )
    if booking_mode == pricing.BOOKING_MODE_INDIVIDUAL:
        group_type = None

    try:
        fleet.validate_group_booking(
            db, payload.date, payload.time, payload.fleet_unit_ids, payload.passengers, booking_mode
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if not payload.waiver_accepted:
        raise HTTPException(status_code=400, detail="You must accept the liability waiver to complete your booking.")
    national_id = payload.national_id.strip()
    if not national_id:
        raise HTTPException(status_code=400, detail="National / resident ID is required for the liability waiver.")

    subtotal = fleet.server_booking_price(payload.passengers, booking_mode)
    promo_record = None
    discount_amount = 0.0
    promo_code_text = None
    if payload.promo_code and payload.promo_code.strip():
        promo_record, subtotal, discount_amount, tax_amount, expected_price = promo_codes.validate_promo_for_booking(
            db,
            payload.promo_code,
            subtotal,
            consume=False,
        )
        promo_code_text = promo_record.code
    else:
        tax_amount = pricing.calculate_tax(subtotal)
        expected_price = pricing.calculate_total_with_tax(subtotal)

    if abs(payload.total_price - expected_price) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid price. Expected {expected_price} OMR (including 5% tax) for {payload.passengers} passenger(s).",
        )

    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if user is None:
        user = models.User(
            full_name=payload.customer_name,
            phone=payload.phone,
            email=payload.email,
            nationality=payload.nationality,
        )
        db.add(user)

    accepted_at = datetime.utcnow()
    waiver_lang = "ar" if payload.waiver_language.startswith("ar") else "en"
    waiver_body = waiver.build_waiver_text(
        customer_name=payload.customer_name.strip(),
        national_id=national_id,
        phone=payload.phone.strip(),
        email=str(payload.email),
        ride_date=f"{payload.date} {payload.time}",
        language=waiver_lang,
        signed_at=accepted_at,
    )

    primary_fleet_unit_id = payload.fleet_unit_ids[0]
    check_in_token = booking_qr.ensure_unique_check_in_token(db)
    booking = models.Booking(
        customer_name=payload.customer_name,
        phone=payload.phone,
        email=payload.email,
        national_id=national_id,
        nationality=payload.nationality,
        hotel_location=payload.hotel_location,
        date=payload.date,
        time=payload.time,
        vehicle_id=payload.vehicle_id,
        route_id=payload.route_id,
        fleet_unit_id=primary_fleet_unit_id,
        passengers=payload.passengers,
        booking_mode=booking_mode,
        group_type=group_type,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount_amount or None,
        promo_code_id=promo_record.id if promo_record else None,
        promo_code=promo_code_text,
        total_price=expected_price,
        payment_method=payload.payment_method,
        notes=payload.notes,
        waiver_accepted=True,
        waiver_accepted_at=accepted_at,
        waiver_text=waiver_body,
        waiver_language=waiver_lang,
        check_in_token=check_in_token,
        booking_number=booking_numbers.generate_unique_booking_number(db),
        payment_status="pending",
        booking_status="pending",
    )
    db.add(booking)
    db.flush()
    if promo_record:
        promo_record.used_count += 1
    fleet.create_booking_bikes(db, booking, payload.fleet_unit_ids)
    db.commit()
    db.refresh(booking)

    # Visa: confirmation email is sent after successful online payment (_mark_booking_paid).
    # Bank transfer: customer confirms transfer in the UI before this request is made.
    if payload.payment_method == "bank_transfer":
        background_tasks.add_task(email_service.send_booking_confirmation_task, booking.id)

    return booking_to_out(booking, db)


@app.get("/api/bookings/confirmation/{token}", response_model=schemas.BookingOut)
def get_booking_confirmation(token: str, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.check_in_token == token).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking_to_out(booking, db)


def _normalize_lookup_phone(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def _find_booking_for_lookup(
    db: Session,
    booking_number: str | None,
    email: str | None,
    phone: str | None,
) -> models.Booking | None:
    number_value = (booking_number or "").strip()
    email_value = (email or "").strip().lower()
    phone_value = _normalize_lookup_phone(phone or "")

    if not number_value and not email_value and not phone_value:
        return None

    if number_value:
        booking = db.query(models.Booking).filter(models.Booking.booking_number == number_value).first()
        if not booking:
            return None
        if email_value and booking.email.strip().lower() != email_value:
            return None
        if phone_value and _normalize_lookup_phone(booking.phone) != phone_value:
            return None
        return booking

    if email_value and phone_value:
        bookings = (
            db.query(models.Booking)
            .filter(func.lower(models.Booking.email) == email_value)
            .order_by(models.Booking.created_at.desc())
            .all()
        )
        for booking in bookings:
            if _normalize_lookup_phone(booking.phone) == phone_value:
                return booking
        return None

    if email_value:
        return (
            db.query(models.Booking)
            .filter(func.lower(models.Booking.email) == email_value)
            .order_by(models.Booking.created_at.desc())
            .first()
        )

    recent = db.query(models.Booking).order_by(models.Booking.created_at.desc()).limit(2000).all()
    for booking in recent:
        if _normalize_lookup_phone(booking.phone) == phone_value:
            return booking
    return None


def booking_to_lookup_out(booking: models.Booking, db: Session) -> schemas.BookingLookupOut:
    route = db.get(models.Route, booking.route_id)
    units = fleet.booking_fleet_units(db, booking)
    fleet_unit_numbers = [unit.unit_number for unit in units]
    token = booking.check_in_token or ""
    return schemas.BookingLookupOut(
        booking_number=booking.booking_number or "",
        customer_name=booking.customer_name,
        phone=booking.phone,
        email=booking.email,
        date=booking.date,
        time=booking.time,
        route_name_en=route.name_en if route else None,
        route_name_ar=route.name_ar if route else None,
        fleet_unit_numbers=fleet_unit_numbers,
        bike_count=len(fleet_unit_numbers) or (1 if booking.fleet_unit_id else 0),
        booking_mode=getattr(booking, "booking_mode", None) or "group",
        group_type=getattr(booking, "group_type", None),
        passengers=booking.passengers,
        total_price=booking.total_price,
        payment_method=booking.payment_method,
        payment_status=booking.payment_status,
        booking_status=booking_lifecycle.normalize_status(booking.booking_status),
        check_in_url=booking_qr.build_check_in_url(token) if token else None,
        checked_in_at=booking.checked_in_at,
        created_at=booking.created_at,
    )


@app.post("/api/bookings/lookup", response_model=schemas.BookingLookupOut)
def lookup_booking(payload: schemas.BookingLookupCreate, db: Session = Depends(get_db)):
    booking = _find_booking_for_lookup(
        db,
        payload.booking_number,
        str(payload.email) if payload.email else None,
        payload.phone,
    )
    if not booking:
        number_value = (payload.booking_number or "").strip()
        email_value = str(payload.email).strip() if payload.email else ""
        phone_value = (payload.phone or "").strip()
        if not number_value and not email_value and not phone_value:
            raise HTTPException(
                status_code=400,
                detail="Please enter your booking number, email, or phone number.",
            )
        raise HTTPException(
            status_code=404,
            detail="No booking found with those details.",
        )

    return booking_to_lookup_out(booking, db)


@app.get("/api/check-in/{token}", response_model=schemas.BookingCheckInOut)
def get_check_in_booking(token: str, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.check_in_token == token).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking_check_in_out(booking, db)


def perform_booking_check_in(token: str, db: Session) -> schemas.BookingCheckInOut:
    booking = db.query(models.Booking).filter(models.Booking.check_in_token == token).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.booking_status == "cancelled":
        raise HTTPException(status_code=400, detail="This booking has been cancelled.")
    if booking.checked_in_at is not None:
        return booking_check_in_out(booking, db)
    booking.checked_in_at = datetime.utcnow()
    db.commit()
    db.refresh(booking)
    return booking_check_in_out(booking, db)


@app.post("/api/admin/check-in/{token}", response_model=schemas.BookingCheckInOut)
def admin_check_in_booking(
    token: str,
    _: models.Admin = Depends(auth.get_current_staff),
    db: Session = Depends(get_db),
):
    return perform_booking_check_in(token, db)


@app.get("/api/payments/amwal/status")
def amwal_payment_status():
    return {
        "configured": amwal.amwal_configured(),
        "environment": os.getenv("AMWAL_ENV", "uat").strip().lower() or "uat",
    }


@app.post("/api/payments/amwal/init", response_model=schemas.AmwalSmartBoxConfigOut)
def init_amwal_payment(payload: schemas.AmwalInitRequest, db: Session = Depends(get_db)):
    if not amwal.amwal_configured():
        raise HTTPException(status_code=503, detail="Online payment is not configured yet.")
    booking = db.get(models.Booking, payload.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.payment_method != "visa":
        raise HTTPException(status_code=400, detail="This booking does not use online card payment.")
    if booking.payment_status == "paid":
        raise HTTPException(status_code=400, detail="This booking is already paid.")
    language = "ar" if payload.language_id.startswith("ar") else "en"
    merchant_reference = booking.booking_number or str(booking.id)
    check_in_token = booking.check_in_token or ""
    try:
        config = amwal.build_smartbox_configure(
            amount=float(booking.total_price),
            merchant_reference=merchant_reference,
            language_id=language,
            check_in_token=check_in_token,
        )
    except ValueError as exc:
        logger.exception("AMWAL configuration error for booking %s", booking.id)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("AMWAL init failed for booking %s", booking.id)
        raise HTTPException(status_code=500, detail="Payment initialization failed.") from exc
    return schemas.AmwalSmartBoxConfigOut(
        booking_id=booking.id,
        booking_number=merchant_reference,
        script_url=config["scriptUrl"],
        mid=config["MID"],
        tid=config["TID"],
        currency_id=config["CurrencyId"],
        amount_trxn=config["AmountTrxn"],
        merchant_reference=config["MerchantReference"],
        language_id=config["LanguageId"],
        payment_view_type=config["PaymentViewType"],
        trx_date_time=config["TrxDateTime"],
        session_token=config["SessionToken"],
        contact_info_type=config["ContactInfoType"],
        return_url=config["ReturnUrl"],
        cancel_url=config["CancelUrl"],
        ignore_receipt=config["IgnoreReceipt"],
        secure_hash=config["SecureHash"],
        primary_color=config["primaryColor"],
    )


def _mark_booking_paid(booking: models.Booking, db: Session, background_tasks: BackgroundTasks | None = None) -> None:
    previous_status = booking.booking_status
    booking.payment_status = "paid"
    booking.booking_status = "paid"
    db.commit()
    db.refresh(booking)
    if background_tasks and previous_status != "paid":
        background_tasks.add_task(email_service.send_booking_confirmed_task, booking.id)


@app.post("/api/payments/amwal/complete", response_model=schemas.AmwalPaymentResultOut)
def complete_amwal_payment(
    payload: schemas.AmwalCompleteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not amwal.amwal_configured():
        raise HTTPException(status_code=503, detail="Online payment is not configured yet.")
    booking = db.get(models.Booking, payload.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.payment_status == "paid":
        return schemas.AmwalPaymentResultOut(
            success=True,
            payment_status="paid",
            booking_status=booking.booking_status,
            message="Already paid.",
        )
    callback_data = payload.model_dump(exclude={"booking_id"}, exclude_none=True)
    if not amwal.verify_callback_secure_hash(callback_data):
        raise HTTPException(status_code=400, detail="Payment verification failed.")
    if payload.merchantReference and payload.merchantReference != booking.booking_number:
        raise HTTPException(status_code=400, detail="Booking reference mismatch.")
    if not amwal.is_success_response_code(payload.responseCode):
        return schemas.AmwalPaymentResultOut(
            success=False,
            payment_status=booking.payment_status,
            booking_status=booking.booking_status,
            message="Payment was not successful.",
        )
    _mark_booking_paid(booking, db, background_tasks)
    return schemas.AmwalPaymentResultOut(
        success=True,
        payment_status="paid",
        booking_status="paid",
        message="Payment successful.",
    )


@app.post("/api/payments/amwal/notify")
def amwal_cloud_notification(payload: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not amwal.amwal_configured():
        raise HTTPException(status_code=503, detail="Online payment is not configured yet.")
    if not amwal.verify_cloud_notification_secure_hash(payload):
        raise HTTPException(status_code=400, detail="Invalid notification signature.")
    merchant_reference = payload.get("MerchantReference")
    if not merchant_reference:
        return {"success": True, "message": "success"}
    booking = db.query(models.Booking).filter(models.Booking.booking_number == str(merchant_reference)).first()
    if booking and booking.payment_status != "paid" and amwal.is_success_response_code(payload.get("ResponseCode")):
        _mark_booking_paid(booking, db, background_tasks)
    return {"success": True, "message": "success"}


@app.post("/api/payments/create")
def create_payment():
    raise HTTPException(status_code=410, detail="Use /api/payments/amwal/init for online payments.")


@app.post("/api/admin/login", response_model=schemas.TokenOut)
def admin_login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(models.Admin).filter(models.Admin.username == payload.username).first()
    if not admin or not auth.verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    role = auth.admin_role(admin)
    if role == auth.ROLE_SCANNER:
        raise HTTPException(status_code=403, detail="Scanner accounts must sign in at the staff portal.")
    if role not in {perm.ROLE_SUPER_ADMIN, perm.ROLE_ADMIN, perm.ROLE_NORMAL}:
        raise HTTPException(status_code=403, detail="This account cannot access the admin dashboard.")
    return perm.auth_token_payload(admin)


@app.get("/api/admin/me", response_model=schemas.TokenOut)
def admin_me(admin: models.Admin = Depends(auth.get_current_admin)):
    return perm.auth_token_payload(admin)


@app.get("/api/admin/users", response_model=list[schemas.AdminUserOut])
def admin_list_users(
    _: models.Admin = Depends(perm.require_super_admin()),
    db: Session = Depends(get_db),
):
    users = db.query(models.Admin).filter(models.Admin.role != perm.ROLE_SCANNER).order_by(models.Admin.id).all()
    return [perm.admin_user_out(user) for user in users]


@app.post("/api/admin/users", response_model=schemas.AdminUserOut)
def admin_create_user(
    payload: schemas.AdminUserCreate,
    _: models.Admin = Depends(perm.require_super_admin()),
    db: Session = Depends(get_db),
):
    username = payload.username.strip()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if db.query(models.Admin).filter(models.Admin.username == username).first():
        raise HTTPException(status_code=409, detail="Username already exists.")
    if payload.role not in perm.MANAGEABLE_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role. Choose admin or normal.")
    sanitized = perm.sanitize_permissions_for_role(payload.role, payload.permissions.model_dump())
    user = models.Admin(
        username=username,
        password_hash=auth.hash_password(payload.password),
        role=payload.role,
        permissions=perm.permissions_to_json(sanitized),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return perm.admin_user_out(user)


@app.patch("/api/admin/users/{user_id}", response_model=schemas.AdminUserOut)
def admin_update_user(
    user_id: int,
    payload: schemas.AdminUserUpdate,
    current: models.Admin = Depends(perm.require_super_admin()),
    db: Session = Depends(get_db),
):
    user = db.get(models.Admin, user_id)
    if not user or user.role == perm.ROLE_SCANNER:
        raise HTTPException(status_code=404, detail="Admin user not found.")
    if perm.is_super_admin(user) and (payload.permissions is not None or payload.role is not None):
        raise HTTPException(
            status_code=400,
            detail="Super admin role and permissions cannot be changed. You can update username and password only.",
        )
    if payload.role is not None:
        if payload.role not in perm.MANAGEABLE_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role. Choose admin or normal.")
        user.role = payload.role
    if payload.username is not None:
        username = payload.username.strip()
        if len(username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
        conflict = db.query(models.Admin).filter(models.Admin.username == username, models.Admin.id != user_id).first()
        if conflict:
            raise HTTPException(status_code=409, detail="Username already exists.")
        user.username = username
    if payload.password:
        if len(payload.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
        user.password_hash = auth.hash_password(payload.password)
    if payload.permissions is not None and not perm.is_super_admin(user):
        sanitized = perm.sanitize_permissions_for_role(user.role, payload.permissions.model_dump())
        user.permissions = perm.permissions_to_json(sanitized)
    elif payload.role == perm.ROLE_NORMAL and not perm.is_super_admin(user):
        existing = perm.permissions_from_admin(user)
        user.permissions = perm.permissions_to_json(
            perm.sanitize_permissions_for_role(perm.ROLE_NORMAL, existing)
        )
    db.commit()
    db.refresh(user)
    if current.id == user.id and payload.username:
        pass
    return perm.admin_user_out(user)


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    current: models.Admin = Depends(perm.require_super_admin()),
    db: Session = Depends(get_db),
):
    if current.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")
    user = db.get(models.Admin, user_id)
    if not user or user.role == perm.ROLE_SCANNER:
        raise HTTPException(status_code=404, detail="Admin user not found.")
    if perm.is_super_admin(user) and perm.count_super_admins(db, exclude_id=user_id) == 0:
        raise HTTPException(status_code=400, detail="At least one super admin must remain.")
    db.delete(user)
    db.commit()
    return {"deleted": True, "user_id": user_id}


@app.post("/api/staff/login", response_model=schemas.TokenOut)
def staff_login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(models.Admin).filter(models.Admin.username == payload.username).first()
    if not admin or not auth.verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    role = auth.admin_role(admin)
    return {
        "access_token": auth.create_access_token(admin.username, role),
        "token_type": "bearer",
        "role": role,
        "username": admin.username,
    }


@app.post("/api/staff/check-in/{token}", response_model=schemas.BookingCheckInOut)
def staff_check_in_booking(
    token: str,
    _: models.Admin = Depends(auth.get_current_staff),
    db: Session = Depends(get_db),
):
    return perform_booking_check_in(token, db)


@app.post("/api/promo-codes/validate", response_model=schemas.PromoValidateOut)
def validate_promo_code(payload: schemas.PromoValidateRequest, db: Session = Depends(get_db)):
    if payload.passengers < 1:
        raise HTTPException(status_code=400, detail="At least one passenger is required.")
    booking_mode = pricing.normalize_booking_mode(payload.booking_mode)
    subtotal = fleet.server_booking_price(payload.passengers, booking_mode)
    try:
        promo, _, discount_amount, tax_amount, total_price = promo_codes.validate_promo_for_booking(
            db,
            payload.code,
            subtotal,
            consume=False,
        )
    except HTTPException as exc:
        return schemas.PromoValidateOut(
            valid=False,
            code=promo_codes.normalize_code(payload.code),
            discount_type="fixed",
            discount_value=0,
            subtotal=subtotal,
            discount_amount=0,
            tax_amount=pricing.calculate_tax(subtotal),
            total_price=pricing.calculate_total_with_tax(subtotal),
            message=str(exc.detail),
        )
    return schemas.PromoValidateOut(
        valid=True,
        code=promo.code,
        discount_type=promo.discount_type,
        discount_value=promo.discount_value,
        subtotal=subtotal,
        discount_amount=discount_amount,
        tax_amount=tax_amount,
        total_price=total_price,
    )


@app.get("/api/admin/media-assets", response_model=list[schemas.MediaAssetOut])
def admin_list_media_assets(
    category: str | None = None,
    _: models.Admin = Depends(perm.require_permission("content", "view")),
    db: Session = Depends(get_db),
):
    query = db.query(models.MediaAsset)
    if category:
        try:
            normalized = media_assets.normalize_category(category)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        query = query.filter(models.MediaAsset.category == normalized)
    return query.order_by(models.MediaAsset.sort_order.asc(), models.MediaAsset.id.desc()).all()


@app.post("/api/admin/media-assets", response_model=schemas.MediaAssetOut)
def admin_create_media_asset(
    payload: schemas.MediaAssetCreate,
    _: models.Admin = Depends(perm.require_permission("content", "create")),
    db: Session = Depends(get_db),
):
    try:
        category, media_kind, url, thumbnail_url = media_assets.validate_media_payload(
            category=payload.category,
            media_kind=payload.media_kind,
            url=payload.url,
            thumbnail_url=payload.thumbnail_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    asset = models.MediaAsset(
        category=category,
        media_kind=media_kind,
        url=url,
        thumbnail_url=thumbnail_url,
        title_en=(payload.title_en or "").strip() or None,
        title_ar=(payload.title_ar or "").strip() or None,
        instagram_url=(payload.instagram_url or "").strip() or None,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
        show_on_home_gallery=payload.show_on_home_gallery,
    )
    db.add(asset)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not save media asset.") from exc
    db.refresh(asset)
    return asset


@app.patch("/api/admin/media-assets/{asset_id}", response_model=schemas.MediaAssetOut)
def admin_update_media_asset(
    asset_id: int,
    payload: schemas.MediaAssetUpdate,
    _: models.Admin = Depends(perm.require_permission("content", "edit")),
    db: Session = Depends(get_db),
):
    asset = db.get(models.MediaAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    data = payload.model_dump(exclude_unset=True)
    category = data.get("category", asset.category)
    media_kind = data.get("media_kind", asset.media_kind)
    url = data.get("url", asset.url)
    thumbnail_url = data.get("thumbnail_url", asset.thumbnail_url)
    try:
        category, media_kind, url, thumbnail_url = media_assets.validate_media_payload(
            category=category,
            media_kind=media_kind,
            url=url,
            thumbnail_url=thumbnail_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    data["category"] = category
    data["media_kind"] = media_kind
    data["url"] = url
    data["thumbnail_url"] = thumbnail_url
    if "title_en" in data:
        data["title_en"] = (data["title_en"] or "").strip() or None
    if "title_ar" in data:
        data["title_ar"] = (data["title_ar"] or "").strip() or None
    if "instagram_url" in data:
        data["instagram_url"] = (data["instagram_url"] or "").strip() or None

    for key, value in data.items():
        setattr(asset, key, value)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not update media asset.") from exc
    db.refresh(asset)
    return asset


@app.delete("/api/admin/media-assets/{asset_id}")
def admin_delete_media_asset(
    asset_id: int,
    _: models.Admin = Depends(perm.require_permission("content", "delete")),
    db: Session = Depends(get_db),
):
    asset = db.get(models.MediaAsset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Media asset not found")
    db.delete(asset)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not delete media asset.") from exc
    return {"status": "deleted", "asset_id": asset_id}


@app.get("/api/admin/promo-codes", response_model=list[schemas.PromoCodeOut])
def admin_list_promo_codes(_: models.Admin = Depends(perm.require_permission("promo", "view")), db: Session = Depends(get_db)):
    return db.query(models.PromoCode).order_by(models.PromoCode.created_at.desc()).all()


@app.post("/api/admin/promo-codes", response_model=schemas.PromoCodeOut)
def admin_create_promo_code(
    payload: schemas.PromoCodeCreate,
    _: models.Admin = Depends(perm.require_permission("promo", "create")),
    db: Session = Depends(get_db),
):
    try:
        code = promo_codes.validate_code_format(payload.code)
        discount_type = promo_codes.normalize_discount_type(payload.discount_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if discount_type == promo_codes.DISCOUNT_TYPE_PERCENT:
        if payload.discount_value <= 0 or payload.discount_value > 100:
            raise HTTPException(status_code=400, detail="Percent discount must be between 1 and 100.")
    elif payload.discount_value <= 0:
        raise HTTPException(status_code=400, detail="Fixed discount must be greater than zero.")

    max_uses = payload.max_uses
    if max_uses is not None and max_uses < 1:
        raise HTTPException(status_code=400, detail="Max uses must be at least 1, or leave empty for unlimited.")

    if db.query(models.PromoCode).filter(models.PromoCode.code == code).first():
        raise HTTPException(status_code=409, detail="This promo code already exists.")

    promo = models.PromoCode(
        code=code,
        discount_type=discount_type,
        discount_value=float(payload.discount_value),
        max_uses=max_uses,
        is_active=payload.is_active,
    )
    db.add(promo)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not save promo code.") from exc
    db.refresh(promo)
    return promo


@app.patch("/api/admin/promo-codes/{promo_id}", response_model=schemas.PromoCodeOut)
def admin_update_promo_code(
    promo_id: int,
    payload: schemas.PromoCodeUpdate,
    _: models.Admin = Depends(perm.require_permission("promo", "edit")),
    db: Session = Depends(get_db),
):
    promo = db.get(models.PromoCode, promo_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")

    data = payload.model_dump(exclude_unset=True)
    if "discount_type" in data and data["discount_type"] is not None:
        try:
            data["discount_type"] = promo_codes.normalize_discount_type(data["discount_type"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    discount_type = data.get("discount_type", promo.discount_type)
    discount_value = data.get("discount_value", promo.discount_value)
    if discount_type == promo_codes.DISCOUNT_TYPE_PERCENT:
        if discount_value <= 0 or discount_value > 100:
            raise HTTPException(status_code=400, detail="Percent discount must be between 1 and 100.")
    elif discount_value <= 0:
        raise HTTPException(status_code=400, detail="Fixed discount must be greater than zero.")

    if "max_uses" in data and data["max_uses"] is not None and data["max_uses"] < 1:
        raise HTTPException(status_code=400, detail="Max uses must be at least 1, or leave empty for unlimited.")
    if "max_uses" in data and data["max_uses"] is not None and data["max_uses"] < promo.used_count:
        raise HTTPException(status_code=400, detail="Max uses cannot be less than times already used.")

    for key, value in data.items():
        setattr(promo, key, value)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not update promo code.") from exc
    db.refresh(promo)
    return promo


@app.delete("/api/admin/promo-codes/{promo_id}")
def admin_delete_promo_code(
    promo_id: int,
    _: models.Admin = Depends(perm.require_permission("promo", "delete")),
    db: Session = Depends(get_db),
):
    promo = db.get(models.PromoCode, promo_id)
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")
    db.delete(promo)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not delete promo code.") from exc
    return {"status": "deleted", "promo_id": promo_id}


@app.get("/api/admin/bookings", response_model=list[schemas.BookingAdminOut])
def admin_bookings(
    year: int | None = None,
    month: int | None = None,
    day: int | None = None,
    _: models.Admin = Depends(perm.require_permission("bookings", "view")),
    db: Session = Depends(get_db),
):
    process_expired_pending_bookings(db)
    bookings = booking_archive.filter_bookings_query(db, year, month, day).all()
    return [booking_to_admin_out(booking, db) for booking in bookings]


@app.get("/api/admin/bookings/archive", response_model=schemas.BookingArchiveOut)
def admin_bookings_archive(_: models.Admin = Depends(perm.require_permission("bookings", "view")), db: Session = Depends(get_db)):
    process_expired_pending_bookings(db)
    return booking_archive.build_booking_archive(db)


def delete_booking_record(db: Session, booking_id: int) -> bool:
    booking = db.get(models.Booking, booking_id)
    if not booking:
        return False
    promo_codes.release_promo_usage(db, booking)
    db.query(models.BookingEmailLog).filter(models.BookingEmailLog.booking_id == booking_id).delete(
        synchronize_session=False
    )
    db.delete(booking)
    return True


@app.post("/api/admin/bookings/bulk-delete")
def admin_delete_bookings_bulk(
    payload: schemas.BookingBulkDelete,
    _: models.Admin = Depends(perm.require_permission("bookings", "delete")),
    db: Session = Depends(get_db),
):
    ids = list(dict.fromkeys(payload.ids))
    if not ids:
        raise HTTPException(status_code=400, detail="No booking ids provided.")
    deleted: list[int] = []
    not_found: list[int] = []
    for booking_id in ids:
        if delete_booking_record(db, booking_id):
            deleted.append(booking_id)
        else:
            not_found.append(booking_id)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not delete bookings. Please try again.") from exc
    return {"deleted": deleted, "not_found": not_found, "count": len(deleted)}


@app.delete("/api/admin/bookings/{booking_id}")
def admin_delete_booking(
    booking_id: int,
    _: models.Admin = Depends(perm.require_permission("bookings", "delete")),
    db: Session = Depends(get_db),
):
    if not delete_booking_record(db, booking_id):
        raise HTTPException(status_code=404, detail="Booking not found")
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not delete booking. Please try again.") from exc
    return {"status": "deleted", "booking_id": booking_id}


@app.get("/api/admin/bookings/{booking_id}/waiver", response_model=schemas.BookingWaiverOut)
def admin_booking_waiver(
    booking_id: int,
    _: models.Admin = Depends(perm.require_permission("bookings", "view")),
    db: Session = Depends(get_db),
):
    booking = db.get(models.Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return schemas.BookingWaiverOut(
        booking_id=booking.id,
        booking_number=booking.booking_number or "",
        customer_name=booking.customer_name,
        national_id=booking.national_id,
        waiver_accepted=bool(booking.waiver_accepted),
        waiver_accepted_at=booking.waiver_accepted_at,
        waiver_language=booking.waiver_language,
        waiver_text=booking.waiver_text,
    )


@app.get("/api/admin/bookings/{booking_id}/emails", response_model=list[schemas.BookingEmailLogOut])
def admin_booking_emails(
    booking_id: int,
    _: models.Admin = Depends(perm.require_permission("bookings", "view")),
    db: Session = Depends(get_db),
):
    booking = db.get(models.Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return (
        db.query(models.BookingEmailLog)
        .filter(models.BookingEmailLog.booking_id == booking_id)
        .order_by(models.BookingEmailLog.sent_at.desc())
        .all()
    )


@app.post("/api/admin/bookings/{booking_id}/reply")
def admin_reply_to_booking(
    booking_id: int,
    payload: schemas.AdminEmailReply,
    _: models.Admin = Depends(perm.require_permission("bookings", "edit")),
    db: Session = Depends(get_db),
):
    booking = db.get(models.Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    subject = payload.subject.strip()
    message = payload.message.strip()
    if not subject or not message:
        raise HTTPException(status_code=400, detail="Subject and message are required.")
    email_service.send_admin_reply_task(booking_id, subject, message)
    latest = (
        db.query(models.BookingEmailLog)
        .filter(models.BookingEmailLog.booking_id == booking_id, models.BookingEmailLog.email_type == "admin_reply")
        .order_by(models.BookingEmailLog.sent_at.desc())
        .first()
    )
    if latest and latest.delivery_status == "failed":
        raise HTTPException(status_code=502, detail=latest.error_message or "Email delivery failed.")
    return {
        "status": latest.delivery_status if latest else "sent",
        "recipient": booking.email,
    }


@app.get("/api/admin/vehicles", response_model=list[schemas.VehicleOut])
def admin_vehicles(_: models.Admin = Depends(perm.require_permission("vehicles", "view")), db: Session = Depends(get_db)):
    return db.query(models.Vehicle).order_by(models.Vehicle.id).all()


@app.get("/api/admin/routes", response_model=list[schemas.RouteOut])
def admin_routes(_: models.Admin = Depends(perm.require_permission("paths", "view")), db: Session = Depends(get_db)):
    return db.query(models.Route).order_by(models.Route.id).all()


@app.post("/api/admin/media/upload")
async def admin_upload_media(
    media_kind: str = "image",
    file: UploadFile = File(...),
    _: models.Admin = Depends(perm.require_permission("content", "create")),
):
    return await media_storage.save_upload(file, media_kind)


@app.get("/api/admin/site-content", response_model=schemas.SiteContentOut)
def admin_site_content(
    _: models.Admin = Depends(perm.require_any_permission(("content", "transfer"), "view")),
    db: Session = Depends(get_db),
):
    return get_site_content(db)


@app.put("/api/admin/site-content", response_model=schemas.SiteContentOut)
def update_site_content(
    payload: schemas.SiteContentBase,
    admin: models.Admin = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    if not perm.can_edit_site_content(admin):
        raise HTTPException(status_code=403, detail="You do not have permission to edit site content.")
    data = perm.filter_site_content_payload(admin, payload.model_dump())
    if not data:
        raise HTTPException(status_code=403, detail="You do not have permission to edit these settings.")
    bg_type = str(data.get("hero_background_type", "image")).strip().lower()
    data["hero_background_type"] = "video" if bg_type == "video" else "image"

    content = db.query(models.SiteContent).first()
    if not content:
        content = models.SiteContent(**data)
        db.add(content)
    else:
        for key, value in data.items():
            setattr(content, key, value)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="Could not save settings. Please try again.") from exc
    db.refresh(content)
    return content


@app.patch("/api/admin/bookings/{booking_id}/status", response_model=schemas.BookingOut)
def update_booking_status(
    booking_id: int,
    payload: schemas.BookingStatusUpdate,
    background_tasks: BackgroundTasks,
    _: models.Admin = Depends(perm.require_permission("bookings", "edit")),
    db: Session = Depends(get_db),
):
    if payload.booking_status not in booking_lifecycle.BOOKING_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid booking status")
    booking = db.get(models.Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not booking.booking_number:
        booking.booking_number = booking_numbers.generate_unique_booking_number(db)
    previous_status = booking.booking_status
    booking.booking_status = payload.booking_status
    if payload.booking_status == "paid":
        booking.payment_status = "paid"
    elif payload.booking_status == "cancelled":
        booking.payment_status = "cancelled"
    elif payload.booking_status == "pending":
        booking.payment_status = "pending"
    db.commit()
    db.refresh(booking)
    if previous_status != "paid" and booking.booking_status == "paid":
        background_tasks.add_task(email_service.send_booking_confirmed_task, booking.id)
    elif previous_status != "cancelled" and booking.booking_status == "cancelled":
        background_tasks.add_task(email_service.send_booking_cancelled_task, booking.id)
    return booking_to_out(booking, db)


@app.post("/api/admin/vehicles", response_model=schemas.VehicleOut)
def create_vehicle(
    payload: schemas.VehicleCreate,
    _: models.Admin = Depends(perm.require_permission("vehicles", "create")),
    db: Session = Depends(get_db),
):
    vehicle = models.Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@app.put("/api/admin/vehicles/{vehicle_id}", response_model=schemas.VehicleOut)
def update_vehicle(
    vehicle_id: int,
    payload: schemas.VehicleCreate,
    _: models.Admin = Depends(perm.require_permission("vehicles", "edit")),
    db: Session = Depends(get_db),
):
    vehicle = db.get(models.Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    for key, value in payload.model_dump().items():
        setattr(vehicle, key, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@app.delete("/api/admin/vehicles/{vehicle_id}")
def delete_vehicle(
    vehicle_id: int,
    _: models.Admin = Depends(perm.require_permission("vehicles", "delete")),
    db: Session = Depends(get_db),
):
    vehicle = db.get(models.Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(vehicle)
    db.commit()
    return {"deleted": True}


@app.post("/api/admin/routes", response_model=schemas.RouteOut)
def create_route(
    payload: schemas.RouteCreate,
    _: models.Admin = Depends(perm.require_permission("paths", "create")),
    db: Session = Depends(get_db),
):
    route_data = routes_geo.normalize_route_payload(payload.model_dump())
    route = models.Route(**route_data)
    db.add(route)
    db.commit()
    db.refresh(route)
    return route


@app.put("/api/admin/routes/{route_id}", response_model=schemas.RouteOut)
def update_route(
    route_id: int,
    payload: schemas.RouteCreate,
    _: models.Admin = Depends(perm.require_permission("paths", "edit")),
    db: Session = Depends(get_db),
):
    route = db.get(models.Route, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    route_data = routes_geo.normalize_route_payload(payload.model_dump())
    for key, value in route_data.items():
        setattr(route, key, value)
    db.commit()
    db.refresh(route)
    return route


@app.delete("/api/admin/routes/{route_id}")
def delete_route(
    route_id: int,
    _: models.Admin = Depends(perm.require_permission("paths", "delete")),
    db: Session = Depends(get_db),
):
    route = db.get(models.Route, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    booking_count = db.query(models.Booking).filter(models.Booking.route_id == route_id).count()
    if booking_count:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete this path: {booking_count} booking(s) are linked to it.",
        )
    db.delete(route)
    db.commit()
    return {"deleted": True}


@app.delete("/api/admin/routes")
def delete_all_routes(_: models.Admin = Depends(perm.require_permission("paths", "delete")), db: Session = Depends(get_db)):
    """Remove every path so the admin can start fresh. Linked bookings are removed too."""
    db.query(models.Booking).delete()
    deleted = db.query(models.Route).delete()
    db.commit()
    return {"deleted": deleted}


@app.patch("/api/admin/routes/{route_id}/display", response_model=schemas.RouteOut)
def update_route_display(
    route_id: int,
    payload: schemas.RouteDisplayUpdate,
    _: models.Admin = Depends(perm.require_permission("paths", "edit")),
    db: Session = Depends(get_db),
):
    route = db.get(models.Route, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    route.display_on_home = payload.display_on_home
    db.commit()
    db.refresh(route)
    return route


@app.get("/api/admin/fleet", response_model=list[schemas.FleetUnitOut])
def admin_fleet(_: models.Admin = Depends(perm.require_permission("fleet", "view")), db: Session = Depends(get_db)):
    return db.query(models.FleetUnit).order_by(models.FleetUnit.unit_number).all()


@app.post("/api/admin/fleet", response_model=schemas.FleetUnitOut)
def create_fleet_unit(
    payload: schemas.FleetUnitCreate,
    _: models.Admin = Depends(perm.require_permission("fleet", "create")),
    db: Session = Depends(get_db),
):
    existing = db.query(models.FleetUnit).filter(models.FleetUnit.unit_number == payload.unit_number).first()
    if existing:
        raise HTTPException(status_code=409, detail="Unit number already exists")
    unit = models.FleetUnit(**payload.model_dump())
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@app.put("/api/admin/fleet/{unit_id}", response_model=schemas.FleetUnitOut)
def update_fleet_unit(
    unit_id: int,
    payload: schemas.FleetUnitCreate,
    _: models.Admin = Depends(perm.require_permission("fleet", "edit")),
    db: Session = Depends(get_db),
):
    unit = db.get(models.FleetUnit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Fleet unit not found")
    conflict = (
        db.query(models.FleetUnit)
        .filter(models.FleetUnit.unit_number == payload.unit_number, models.FleetUnit.id != unit_id)
        .first()
    )
    if conflict:
        raise HTTPException(status_code=409, detail="Unit number already exists")
    for key, value in payload.model_dump().items():
        setattr(unit, key, value)
    db.commit()
    db.refresh(unit)
    return unit


@app.delete("/api/admin/fleet/{unit_id}")
def delete_fleet_unit(
    unit_id: int,
    _: models.Admin = Depends(perm.require_permission("fleet", "delete")),
    db: Session = Depends(get_db),
):
    unit = db.get(models.FleetUnit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Fleet unit not found")
    active_booking = (
        db.query(models.Booking)
        .outerjoin(models.BookingBike, models.BookingBike.booking_id == models.Booking.id)
        .filter(
            models.Booking.booking_status.in_(fleet.ACTIVE_BOOKING_STATUSES),
            (
                (models.Booking.fleet_unit_id == unit_id)
                | (models.BookingBike.fleet_unit_id == unit_id)
            ),
        )
        .first()
    )
    if active_booking:
        raise HTTPException(status_code=409, detail="Cannot delete a buggy with active bookings. Deactivate it instead.")
    db.query(models.BookingBike).filter(models.BookingBike.fleet_unit_id == unit_id).delete(
        synchronize_session=False
    )
    db.query(models.Booking).filter(models.Booking.fleet_unit_id == unit_id).update(
        {models.Booking.fleet_unit_id: None},
        synchronize_session=False,
    )
    db.delete(unit)
    db.commit()
    return {"deleted": True}


@app.get("/api/admin/dashboard-stats", response_model=schemas.DashboardStats)
def dashboard_stats(_: models.Admin = Depends(perm.require_permission("overview", "view")), db: Session = Depends(get_db)):
    process_expired_pending_bookings(db)
    today = date.today().isoformat()
    active_filter = models.Booking.booking_status.in_(booking_lifecycle.COUNTED_BOOKING_STATUSES)
    total_revenue = (
        db.query(func.coalesce(func.sum(models.Booking.total_price), 0))
        .filter(models.Booking.booking_status.in_(booking_lifecycle.REVENUE_STATUSES))
        .scalar()
    )
    confirmed_bookings = (
        db.query(models.Booking).filter(models.Booking.booking_status == "paid").count()
    )
    pending_bookings = (
        db.query(models.Booking).filter(models.Booking.booking_status == "pending").count()
    )
    uncompleted_bookings = (
        db.query(models.Booking).filter(models.Booking.booking_status == "cancelled").count()
    )
    daily_bookings = db.query(models.Booking).filter(models.Booking.date == today, active_filter).count()
    monthly_bookings = (
        db.query(models.Booking)
        .filter(extract("month", models.Booking.created_at) == date.today().month)
        .filter(extract("year", models.Booking.created_at) == date.today().year)
        .filter(active_filter)
        .count()
    )
    total_bookings = db.query(models.Booking).filter(active_filter).count()
    return {
        "total_revenue": total_revenue,
        "confirmed_bookings": confirmed_bookings,
        "pending_bookings": pending_bookings,
        "uncompleted_bookings": uncompleted_bookings,
        "daily_bookings": daily_bookings,
        "monthly_bookings": monthly_bookings,
        "total_bookings": total_bookings,
    }
