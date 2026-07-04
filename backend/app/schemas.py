from datetime import datetime

from pydantic import BaseModel, EmailStr


class FleetUnitBase(BaseModel):
    unit_number: int
    name_en: str
    name_ar: str
    is_active: bool = True


class FleetUnitCreate(FleetUnitBase):
    pass


class FleetUnitOut(FleetUnitBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class FleetUnitAvailability(FleetUnitOut):
    is_available: bool


class SlotAvailability(BaseModel):
    time: str
    total_bikes: int
    booked: int
    available: int


class AvailabilityBoard(BaseModel):
    date: str
    total_bikes: int
    slots: list[SlotAvailability]
    updated_at: str


class VehicleBase(BaseModel):
    name_en: str
    name_ar: str
    type: str
    seats: int
    price_per_hour: float
    image_url: str
    is_available: bool = True
    display_on_home: bool = True


class VehicleCreate(VehicleBase):
    pass


class VehicleOut(VehicleBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RouteBase(BaseModel):
    name_en: str
    name_ar: str
    description_en: str
    description_ar: str
    duration_minutes: int
    price: float
    image_url: str
    start_location: str = "Salalah Tourism Area"
    end_location: str = "Dhofar Khareef Viewpoint"
    start_lat: float = 17.0194
    start_lng: float = 54.0897
    end_lat: float = 17.0896
    end_lng: float = 54.1657
    path_points: str = "[]"
    is_popular: bool = False
    display_on_home: bool = True


class RouteCreate(RouteBase):
    pass


class RouteDisplayUpdate(BaseModel):
    display_on_home: bool


class RouteOut(RouteBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BookingCreate(BaseModel):
    customer_name: str
    phone: str
    email: EmailStr
    national_id: str
    nationality: str
    hotel_location: str
    date: str
    time: str
    vehicle_id: int
    route_id: int
    fleet_unit_ids: list[int]
    passengers: int
    booking_mode: str = "group"
    total_price: float
    payment_method: str
    waiver_accepted: bool
    waiver_language: str = "ar"
    notes: str | None = None


class BookingOut(BaseModel):
    id: int
    booking_number: str
    customer_name: str
    phone: str
    email: EmailStr
    nationality: str
    hotel_location: str
    date: str
    time: str
    vehicle_id: int
    route_id: int
    fleet_unit_ids: list[int] = []
    fleet_unit_numbers: list[int] = []
    bike_count: int = 1
    booking_mode: str = "group"
    passengers: int
    subtotal: float | None = None
    tax_amount: float | None = None
    total_price: float
    payment_method: str
    payment_status: str
    booking_status: str
    notes: str | None = None
    national_id: str | None = None
    waiver_accepted: bool = False
    waiver_accepted_at: datetime | None = None
    check_in_token: str | None = None
    check_in_url: str | None = None
    checked_in_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class BookingEmailLogOut(BaseModel):
    id: int
    booking_id: int
    email_type: str
    recipient: str
    subject: str
    body_plain: str
    sender: str
    delivery_status: str
    error_message: str | None = None
    sent_at: datetime

    class Config:
        from_attributes = True


class BookingAdminOut(BookingOut):
    confirmation_email_sent: bool = False
    booking_confirmed: bool = False
    fleet_unit_number: int | None = None
    fleet_unit_id: int | None = None
    route_name_en: str | None = None
    email_count: int = 0


class BookingWaiverOut(BaseModel):
    booking_id: int
    booking_number: str
    customer_name: str
    national_id: str | None = None
    waiver_accepted: bool = False
    waiver_accepted_at: datetime | None = None
    waiver_language: str | None = None
    waiver_text: str | None = None

    class Config:
        from_attributes = True


class BookingCheckInOut(BaseModel):
    booking_id: int
    booking_number: str
    customer_name: str
    phone: str
    email: EmailStr
    date: str
    time: str
    passengers: int
    bike_count: int
    fleet_unit_numbers: list[int] = []
    route_name_en: str | None = None
    route_name_ar: str | None = None
    booking_status: str
    payment_status: str
    total_price: float
    checked_in_at: datetime | None = None
    check_in_url: str


class BookingArchiveDay(BaseModel):
    day: int
    date: str
    count: int


class BookingArchiveMonth(BaseModel):
    month: int
    month_label: str
    count: int
    days: list[BookingArchiveDay]


class BookingArchiveYear(BaseModel):
    year: int
    count: int
    months: list[BookingArchiveMonth]


class BookingArchiveOut(BaseModel):
    total: int
    years: list[BookingArchiveYear]


class AdminEmailReply(BaseModel):
    subject: str
    message: str


class BookingStatusUpdate(BaseModel):
    booking_status: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DashboardStats(BaseModel):
    total_revenue: float
    confirmed_bookings: int
    pending_bookings: int
    uncompleted_bookings: int
    daily_bookings: int
    monthly_bookings: int
    total_bookings: int


class SiteContentBase(BaseModel):
    hero_badge_en: str
    hero_badge_ar: str
    hero_title_en: str
    hero_title_ar: str
    hero_subtitle_en: str
    hero_subtitle_ar: str
    hero_cta_en: str
    hero_cta_ar: str
    hero_secondary_en: str
    hero_secondary_ar: str
    hero_note_en: str
    hero_note_ar: str
    hero_background_url: str
    hero_side_image_url: str
    vehicles_title_en: str
    vehicles_title_ar: str
    vehicles_subtitle_en: str
    vehicles_subtitle_ar: str
    routes_title_en: str
    routes_title_ar: str
    routes_subtitle_en: str
    routes_subtitle_ar: str
    why_title_en: str
    why_title_ar: str
    why_image_url: str
    transfer_title_en: str = "Bank Account & Mobile Transfer"
    transfer_title_ar: str = "الحساب البنكي والتحويل عبر الجوال"
    transfer_bank_name_en: str = ""
    transfer_bank_name_ar: str = ""
    transfer_account_name_en: str = ""
    transfer_account_name_ar: str = ""
    transfer_account_number: str = ""
    transfer_iban: str = ""
    transfer_mobile_wallet_en: str = ""
    transfer_mobile_wallet_ar: str = ""
    transfer_mobile_number: str = ""
    transfer_notes_en: str = ""
    transfer_notes_ar: str = ""
    transfer_show_title: bool = True
    transfer_show_bank_name: bool = True
    transfer_show_account_name: bool = True
    transfer_show_account_number: bool = True
    transfer_show_iban: bool = True
    transfer_show_mobile_wallet: bool = True
    transfer_show_mobile_number: bool = True
    transfer_show_notes: bool = True


class SiteContentOut(SiteContentBase):
    id: int

    class Config:
        from_attributes = True
