from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


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
    group_type: str | None = None
    total_price: float
    payment_method: str
    waiver_accepted: bool
    waiver_language: str = "ar"
    notes: str | None = None
    promo_code: str | None = None


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
    group_type: str | None = None
    passengers: int
    subtotal: float | None = None
    tax_amount: float | None = None
    discount_amount: float | None = None
    promo_code: str | None = None
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
    booking_mode: str = "group"
    group_type: str | None = None
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


class BookingBulkDelete(BaseModel):
    ids: list[int]


class PromoCodeBase(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    max_uses: int | None = None
    is_active: bool = True


class PromoCodeCreate(PromoCodeBase):
    pass


class PromoCodeUpdate(BaseModel):
    discount_type: str | None = None
    discount_value: float | None = None
    max_uses: int | None = None
    is_active: bool | None = None


class PromoCodeOut(BaseModel):
    id: int
    code: str
    discount_type: str
    discount_value: float
    max_uses: int | None
    used_count: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PromoValidateRequest(BaseModel):
    code: str
    passengers: int
    booking_mode: str = "group"


MEDIA_ASSET_CATEGORIES = ("gallery", "hero", "routes", "testimonials", "general")


class MediaAssetBase(BaseModel):
    category: str = "gallery"
    media_kind: str = "image"
    url: str
    thumbnail_url: str | None = None
    title_en: str | None = None
    title_ar: str | None = None
    instagram_url: str | None = None
    sort_order: int = 0
    is_active: bool = True
    show_on_home_gallery: bool = False


class MediaAssetCreate(MediaAssetBase):
    pass


class MediaAssetUpdate(BaseModel):
    category: str | None = None
    media_kind: str | None = None
    url: str | None = None
    thumbnail_url: str | None = None
    title_en: str | None = None
    title_ar: str | None = None
    instagram_url: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
    show_on_home_gallery: bool | None = None


class MediaAssetOut(BaseModel):
    id: int
    category: str
    media_kind: str
    url: str
    thumbnail_url: str | None = None
    title_en: str | None = None
    title_ar: str | None = None
    instagram_url: str | None = None
    sort_order: int
    is_active: bool
    show_on_home_gallery: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PromoValidateOut(BaseModel):
    valid: bool
    code: str
    discount_type: str
    discount_value: float
    subtotal: float
    discount_amount: float
    tax_amount: float
    total_price: float
    message: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class AmwalInitRequest(BaseModel):
    booking_id: int
    language_id: str = "en"


class AmwalSmartBoxConfigOut(BaseModel):
    booking_id: int
    booking_number: str
    script_url: str
    mid: str
    tid: str
    currency_id: int
    amount_trxn: str
    merchant_reference: str
    language_id: str
    payment_view_type: int
    trx_date_time: str
    session_token: str = ""
    contact_info_type: int
    return_url: str
    cancel_url: str
    ignore_receipt: str
    secure_hash: str
    primary_color: str


class AmwalCompleteRequest(BaseModel):
    booking_id: int | None = None
    check_in_token: str | None = None
    amount: str | float | None = None
    currencyId: str | int | None = None
    customerId: str | None = None
    customerTokenId: str | None = None
    merchantId: str | int | None = None
    merchantReference: str | None = None
    responseCode: str | None = None
    terminalId: str | int | None = None
    transactionId: str | None = None
    transactionTime: str | None = None
    secureHashValue: str | None = None


class AmwalPaymentResultOut(BaseModel):
    success: bool
    payment_status: str
    booking_status: str
    message: str


class AmwalAbandonRequest(BaseModel):
    booking_id: int
    check_in_token: str
    force: bool = False


class AdminModulePermissions(BaseModel):
    view: bool = False
    create: bool = False
    edit: bool = False
    delete: bool = False


class AdminPermissionsOut(BaseModel):
    overview: AdminModulePermissions = AdminModulePermissions()
    bookings: AdminModulePermissions = AdminModulePermissions()
    promo: AdminModulePermissions = AdminModulePermissions()
    transfer: AdminModulePermissions = AdminModulePermissions()
    content: AdminModulePermissions = AdminModulePermissions()
    fleet: AdminModulePermissions = AdminModulePermissions()
    paths: AdminModulePermissions = AdminModulePermissions()
    vehicles: AdminModulePermissions = AdminModulePermissions()
    users: AdminModulePermissions = AdminModulePermissions()


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "admin"
    username: str = ""
    is_super_admin: bool = False
    permissions: AdminPermissionsOut | None = None


class AdminUserOut(BaseModel):
    id: int
    username: str
    role: str
    is_super_admin: bool
    permissions: AdminPermissionsOut
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserCreate(BaseModel):
    username: str
    password: str
    role: Literal["admin", "normal"] = "admin"
    permissions: AdminPermissionsOut


class AdminUserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    role: Literal["admin", "normal"] | None = None
    permissions: AdminPermissionsOut | None = None


class DashboardStats(BaseModel):
    total_revenue: float
    confirmed_bookings: int
    pending_bookings: int
    uncompleted_bookings: int
    daily_bookings: int
    monthly_bookings: int
    total_bookings: int


class FaqItem(BaseModel):
    q_en: str = ""
    q_ar: str = ""
    a_en: str = ""
    a_ar: str = ""


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
    hero_background_type: str = "image"
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
    availability_live_en: str = "Live availability"
    availability_live_ar: str = "توفر مباشر"
    availability_title_en: str = "Buggy Bikes Board"
    availability_title_ar: str = "لوحة الباجيات"
    availability_subtitle_en: str = "Real-time fleet status by time slot — like an airport departures screen."
    availability_subtitle_ar: str = "حالة الأسطول حسب الوقت — مثل شاشة المطارات."
    site_name_en: str = "Buggy Bike Booking"
    site_name_ar: str = "حجز الباجي"
    footer_text_en: str = "Simple buggy bike booking for guests in Salalah."
    footer_text_ar: str = "حجز بسيط للباجي للضيوف في صلالة."
    nav_book_en: str = "Book Now"
    nav_book_ar: str = "احجز الآن"
    footer_admin_en: str = "Admin"
    footer_admin_ar: str = "الإدارة"
    how_title_en: str = "Simple Booking Steps"
    how_title_ar: str = "خطوات الحجز البسيطة"
    how_step1_title_en: str = "Choose Date"
    how_step1_title_ar: str = "اختر التاريخ"
    how_step1_text_en: str = "Pick your preferred date."
    how_step1_text_ar: str = "حدد التاريخ المناسب لك."
    how_step2_title_en: str = "Pick Time Slot"
    how_step2_title_ar: str = "اختر الوقت"
    how_step2_text_en: str = "See how many buggies are free for each time."
    how_step2_text_ar: str = "شاهد عدد الباجيات المتاحة لكل وقت."
    how_step3_title_en: str = "Select Buggy"
    how_step3_title_ar: str = "اختر الباجي"
    how_step3_text_en: str = "Choose an available buggy bike from the fleet."
    how_step3_text_ar: str = "اختر دراجة باجي متاحة من الأسطول."
    how_step4_title_en: str = "Pay"
    how_step4_title_ar: str = "ادفع"
    how_step4_text_en: str = "Pay by Visa or bank transfer."
    how_step4_text_ar: str = "ادفع بالفيزا أو التحويل البنكي."
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
    faq_title_en: str = "Frequently Asked Questions"
    faq_title_ar: str = "الأسئلة الشائعة"
    faq_items: list[FaqItem] = []
    contact_phone: str = ""
    contact_whatsapp: str = ""


class SiteContentOut(SiteContentBase):
    id: int

    class Config:
        from_attributes = True


class BookingLookupCreate(BaseModel):
    booking_number: str | None = None
    email: EmailStr | None = None
    phone: str | None = None


class BookingLookupOut(BaseModel):
    booking_number: str
    customer_name: str
    phone: str
    email: EmailStr
    date: str
    time: str
    route_name_en: str | None = None
    route_name_ar: str | None = None
    fleet_unit_numbers: list[int] = []
    bike_count: int = 1
    booking_mode: str = "group"
    group_type: str | None = None
    passengers: int
    total_price: float
    payment_method: str
    payment_status: str
    booking_status: str
    check_in_url: str | None = None
    checked_in_at: datetime | None = None
    created_at: datetime


class ContactCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    phone: str = Field(min_length=5, max_length=50)
    email: EmailStr
    message: str = Field(min_length=10, max_length=5000)
    website: str = ""


class ContactOut(BaseModel):
    status: str
    message: str
