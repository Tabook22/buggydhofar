from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(150), index=True)
    nationality: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name_en: Mapped[str] = mapped_column(String(120))
    name_ar: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(80))
    seats: Mapped[int] = mapped_column(Integer)
    price_per_hour: Mapped[float] = mapped_column(Float)
    image_url: Mapped[str] = mapped_column(Text)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    display_on_home: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bookings: Mapped[list["Booking"]] = relationship(back_populates="vehicle")


class FleetUnit(Base):
    """Individual physical buggy bike in the fleet."""

    __tablename__ = "fleet_units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    unit_number: Mapped[int] = mapped_column(Integer, unique=True, index=True)
    name_en: Mapped[str] = mapped_column(String(120))
    name_ar: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bookings: Mapped[list["Booking"]] = relationship(back_populates="fleet_unit")
    booking_bikes: Mapped[list["BookingBike"]] = relationship(back_populates="fleet_unit")


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name_en: Mapped[str] = mapped_column(String(120))
    name_ar: Mapped[str] = mapped_column(String(120))
    description_en: Mapped[str] = mapped_column(Text)
    description_ar: Mapped[str] = mapped_column(Text)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float)
    image_url: Mapped[str] = mapped_column(Text)
    start_location: Mapped[str] = mapped_column(String(180), default="Salalah Tourism Area")
    end_location: Mapped[str] = mapped_column(String(180), default="Dhofar Khareef Viewpoint")
    start_lat: Mapped[float] = mapped_column(Float, default=17.0194)
    start_lng: Mapped[float] = mapped_column(Float, default=54.0897)
    end_lat: Mapped[float] = mapped_column(Float, default=17.0896)
    end_lng: Mapped[float] = mapped_column(Float, default=54.1657)
    path_points: Mapped[str] = mapped_column(Text, default="[]")
    is_popular: Mapped[bool] = mapped_column(Boolean, default=False)
    display_on_home: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bookings: Mapped[list["Booking"]] = relationship(back_populates="route")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_number: Mapped[str | None] = mapped_column(String(4), unique=True, index=True, nullable=True)
    customer_name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(String(150))
    nationality: Mapped[str] = mapped_column(String(100))
    hotel_location: Mapped[str] = mapped_column(String(180))
    date: Mapped[str] = mapped_column(String(20), index=True)
    time: Mapped[str] = mapped_column(String(20), index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"))
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"))
    fleet_unit_id: Mapped[int | None] = mapped_column(ForeignKey("fleet_units.id"), nullable=True, index=True)
    passengers: Mapped[int] = mapped_column(Integer)
    subtotal: Mapped[float | None] = mapped_column(Float, nullable=True)
    tax_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_price: Mapped[float] = mapped_column(Float)
    payment_method: Mapped[str] = mapped_column(String(40))
    payment_status: Mapped[str] = mapped_column(String(40), default="pending")
    booking_status: Mapped[str] = mapped_column(String(40), default="pending")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    national_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    booking_mode: Mapped[str] = mapped_column(String(20), default="group")
    waiver_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    waiver_accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    waiver_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    waiver_language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    check_in_token: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vehicle: Mapped[Vehicle] = relationship(back_populates="bookings")
    route: Mapped[Route] = relationship(back_populates="bookings")
    fleet_unit: Mapped["FleetUnit | None"] = relationship(back_populates="bookings")
    bikes: Mapped[list["BookingBike"]] = relationship(back_populates="booking", cascade="all, delete-orphan")
    email_logs: Mapped[list["BookingEmailLog"]] = relationship(back_populates="booking")


class BookingBike(Base):
    """Bikes assigned to a group booking (one row per physical buggy)."""

    __tablename__ = "booking_bikes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), index=True)
    fleet_unit_id: Mapped[int] = mapped_column(ForeignKey("fleet_units.id"), index=True)
    passengers: Mapped[int] = mapped_column(Integer)

    booking: Mapped["Booking"] = relationship(back_populates="bikes")
    fleet_unit: Mapped["FleetUnit"] = relationship(back_populates="booking_bikes")


class BookingEmailLog(Base):
    """Archive of every email sent for a booking (confirmation or admin reply)."""

    __tablename__ = "booking_email_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), index=True)
    email_type: Mapped[str] = mapped_column(String(40), index=True)
    recipient: Mapped[str] = mapped_column(String(150))
    subject: Mapped[str] = mapped_column(String(220))
    body_plain: Mapped[str] = mapped_column(Text)
    sender: Mapped[str] = mapped_column(String(150), default="info@buggydhofar.com")
    delivery_status: Mapped[str] = mapped_column(String(40), default="sent")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    booking: Mapped["Booking"] = relationship(back_populates="email_logs")


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="admin")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SiteContent(Base):
    __tablename__ = "site_content"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hero_badge_en: Mapped[str] = mapped_column(String(180))
    hero_badge_ar: Mapped[str] = mapped_column(String(180))
    hero_title_en: Mapped[str] = mapped_column(String(220))
    hero_title_ar: Mapped[str] = mapped_column(String(220))
    hero_subtitle_en: Mapped[str] = mapped_column(Text)
    hero_subtitle_ar: Mapped[str] = mapped_column(Text)
    hero_cta_en: Mapped[str] = mapped_column(String(80))
    hero_cta_ar: Mapped[str] = mapped_column(String(80))
    hero_secondary_en: Mapped[str] = mapped_column(String(80))
    hero_secondary_ar: Mapped[str] = mapped_column(String(80))
    hero_note_en: Mapped[str] = mapped_column(String(220))
    hero_note_ar: Mapped[str] = mapped_column(String(220))
    hero_background_url: Mapped[str] = mapped_column(Text)
    hero_side_image_url: Mapped[str] = mapped_column(Text)
    vehicles_title_en: Mapped[str] = mapped_column(String(180))
    vehicles_title_ar: Mapped[str] = mapped_column(String(180))
    vehicles_subtitle_en: Mapped[str] = mapped_column(Text)
    vehicles_subtitle_ar: Mapped[str] = mapped_column(Text)
    routes_title_en: Mapped[str] = mapped_column(String(180))
    routes_title_ar: Mapped[str] = mapped_column(String(180))
    routes_subtitle_en: Mapped[str] = mapped_column(Text)
    routes_subtitle_ar: Mapped[str] = mapped_column(Text)
    why_title_en: Mapped[str] = mapped_column(String(180))
    why_title_ar: Mapped[str] = mapped_column(String(180))
    why_image_url: Mapped[str] = mapped_column(Text)
    transfer_title_en: Mapped[str] = mapped_column(String(180), default="Payment Instructions")
    transfer_title_ar: Mapped[str] = mapped_column(String(180), default="تعليمات الدفع")
    transfer_bank_name_en: Mapped[str] = mapped_column(String(180), default="")
    transfer_bank_name_ar: Mapped[str] = mapped_column(String(180), default="")
    transfer_account_name_en: Mapped[str] = mapped_column(String(180), default="")
    transfer_account_name_ar: Mapped[str] = mapped_column(String(180), default="")
    transfer_account_number: Mapped[str] = mapped_column(String(80), default="")
    transfer_iban: Mapped[str] = mapped_column(String(80), default="")
    transfer_mobile_wallet_en: Mapped[str] = mapped_column(String(180), default="")
    transfer_mobile_wallet_ar: Mapped[str] = mapped_column(String(180), default="")
    transfer_mobile_number: Mapped[str] = mapped_column(String(80), default="")
    transfer_notes_en: Mapped[str] = mapped_column(Text, default="")
    transfer_notes_ar: Mapped[str] = mapped_column(Text, default="")
    transfer_show_title: Mapped[bool] = mapped_column(Boolean, default=True)
    transfer_show_bank_name: Mapped[bool] = mapped_column(Boolean, default=True)
    transfer_show_account_name: Mapped[bool] = mapped_column(Boolean, default=True)
    transfer_show_account_number: Mapped[bool] = mapped_column(Boolean, default=True)
    transfer_show_iban: Mapped[bool] = mapped_column(Boolean, default=True)
    transfer_show_mobile_wallet: Mapped[bool] = mapped_column(Boolean, default=True)
    transfer_show_mobile_number: Mapped[bool] = mapped_column(Boolean, default=True)
    transfer_show_notes: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
