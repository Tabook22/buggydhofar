from datetime import date, datetime

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import extract, func, text
from sqlalchemy.orm import Session

from . import auth, booking_archive, booking_lifecycle, booking_numbers, email_service, fleet, models, pricing, routes_geo, schemas
from .database import Base, SessionLocal, engine, get_db
from .seed import seed_database, seed_payment_transfer_defaults

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Khareef Adventure Booking API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


def booking_to_admin_out(booking: models.Booking, db: Session) -> schemas.BookingAdminOut:
    fleet_unit = db.get(models.FleetUnit, booking.fleet_unit_id) if booking.fleet_unit_id else None
    route = db.get(models.Route, booking.route_id)
    email_count = db.query(models.BookingEmailLog).filter(models.BookingEmailLog.booking_id == booking.id).count()
    payload = schemas.BookingOut.model_validate(booking).model_dump()
    normalized_status = booking_lifecycle.normalize_status(booking.booking_status)
    payload["booking_status"] = normalized_status
    return schemas.BookingAdminOut(
        **payload,
        confirmation_email_sent=booking_archive.booking_has_confirmation(db, booking.id),
        booking_confirmed=booking_lifecycle.is_booking_confirmed(booking.booking_status),
        fleet_unit_number=fleet_unit.unit_number if fleet_unit else None,
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
    ensure_payment_transfer_columns()
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

    try:
        fleet.validate_booking(db, payload.date, payload.time, payload.fleet_unit_id, payload.passengers)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    expected_price = fleet.server_booking_price(payload.passengers)
    if abs(payload.total_price - expected_price) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid price. Expected {expected_price} OMR for {payload.passengers} passenger(s).",
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

    booking = models.Booking(
        customer_name=payload.customer_name,
        phone=payload.phone,
        email=payload.email,
        nationality=payload.nationality,
        hotel_location=payload.hotel_location,
        date=payload.date,
        time=payload.time,
        vehicle_id=payload.vehicle_id,
        route_id=payload.route_id,
        fleet_unit_id=payload.fleet_unit_id,
        passengers=payload.passengers,
        total_price=expected_price,
        payment_method=payload.payment_method,
        notes=payload.notes,
        booking_number=booking_numbers.generate_unique_booking_number(db),
        payment_status="pending",
        booking_status="pending",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    fleet_unit = db.get(models.FleetUnit, booking.fleet_unit_id) if booking.fleet_unit_id else None
    background_tasks.add_task(email_service.send_booking_confirmation_task, booking.id)

    return booking


@app.post("/api/payments/create")
def create_payment():
    return {"payment_url": "https://example.com/payments/demo", "status": "created"}


@app.post("/api/admin/login", response_model=schemas.TokenOut)
def admin_login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(models.Admin).filter(models.Admin.username == payload.username).first()
    if not admin or not auth.verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"access_token": auth.create_access_token(admin.username), "token_type": "bearer"}


@app.get("/api/admin/bookings", response_model=list[schemas.BookingAdminOut])
def admin_bookings(
    year: int | None = None,
    month: int | None = None,
    day: int | None = None,
    _: models.Admin = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    process_expired_pending_bookings(db)
    bookings = booking_archive.filter_bookings_query(db, year, month, day).all()
    return [booking_to_admin_out(booking, db) for booking in bookings]


@app.get("/api/admin/bookings/archive", response_model=schemas.BookingArchiveOut)
def admin_bookings_archive(_: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    process_expired_pending_bookings(db)
    return booking_archive.build_booking_archive(db)


@app.get("/api/admin/bookings/{booking_id}/emails", response_model=list[schemas.BookingEmailLogOut])
def admin_booking_emails(
    booking_id: int,
    _: models.Admin = Depends(auth.get_current_admin),
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
    _: models.Admin = Depends(auth.get_current_admin),
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
def admin_vehicles(_: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    return db.query(models.Vehicle).order_by(models.Vehicle.id).all()


@app.get("/api/admin/routes", response_model=list[schemas.RouteOut])
def admin_routes(_: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    return db.query(models.Route).order_by(models.Route.id).all()


@app.get("/api/admin/site-content", response_model=schemas.SiteContentOut)
def admin_site_content(_: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    return get_site_content(db)


@app.put("/api/admin/site-content", response_model=schemas.SiteContentOut)
def update_site_content(
    payload: schemas.SiteContentBase,
    _: models.Admin = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    content = db.query(models.SiteContent).first()
    if not content:
        content = models.SiteContent(**payload.model_dump())
        db.add(content)
    else:
        for key, value in payload.model_dump().items():
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
    _: models.Admin = Depends(auth.get_current_admin),
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
    return booking


@app.post("/api/admin/vehicles", response_model=schemas.VehicleOut)
def create_vehicle(payload: schemas.VehicleCreate, _: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    vehicle = models.Vehicle(**payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@app.put("/api/admin/vehicles/{vehicle_id}", response_model=schemas.VehicleOut)
def update_vehicle(vehicle_id: int, payload: schemas.VehicleCreate, _: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    vehicle = db.get(models.Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    for key, value in payload.model_dump().items():
        setattr(vehicle, key, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@app.delete("/api/admin/vehicles/{vehicle_id}")
def delete_vehicle(vehicle_id: int, _: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    vehicle = db.get(models.Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(vehicle)
    db.commit()
    return {"deleted": True}


@app.post("/api/admin/routes", response_model=schemas.RouteOut)
def create_route(payload: schemas.RouteCreate, _: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    route_data = routes_geo.normalize_route_payload(payload.model_dump())
    route = models.Route(**route_data)
    db.add(route)
    db.commit()
    db.refresh(route)
    return route


@app.put("/api/admin/routes/{route_id}", response_model=schemas.RouteOut)
def update_route(route_id: int, payload: schemas.RouteCreate, _: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
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
def delete_route(route_id: int, _: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
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
def delete_all_routes(_: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    """Remove every path so the admin can start fresh. Linked bookings are removed too."""
    db.query(models.Booking).delete()
    deleted = db.query(models.Route).delete()
    db.commit()
    return {"deleted": deleted}


@app.patch("/api/admin/routes/{route_id}/display", response_model=schemas.RouteOut)
def update_route_display(
    route_id: int,
    payload: schemas.RouteDisplayUpdate,
    _: models.Admin = Depends(auth.get_current_admin),
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
def admin_fleet(_: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    return db.query(models.FleetUnit).order_by(models.FleetUnit.unit_number).all()


@app.post("/api/admin/fleet", response_model=schemas.FleetUnitOut)
def create_fleet_unit(
    payload: schemas.FleetUnitCreate,
    _: models.Admin = Depends(auth.get_current_admin),
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
    _: models.Admin = Depends(auth.get_current_admin),
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
def delete_fleet_unit(unit_id: int, _: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
    unit = db.get(models.FleetUnit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Fleet unit not found")
    active_booking = (
        db.query(models.Booking)
        .filter(
            models.Booking.fleet_unit_id == unit_id,
            models.Booking.booking_status.in_(fleet.ACTIVE_BOOKING_STATUSES),
        )
        .first()
    )
    if active_booking:
        raise HTTPException(status_code=409, detail="Cannot delete a buggy with active bookings. Deactivate it instead.")
    db.delete(unit)
    db.commit()
    return {"deleted": True}


@app.get("/api/admin/dashboard-stats", response_model=schemas.DashboardStats)
def dashboard_stats(_: models.Admin = Depends(auth.get_current_admin), db: Session = Depends(get_db)):
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
