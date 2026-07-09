from sqlalchemy.orm import Session

from . import models
from .auth import hash_password

FLEET_DEFAULT_SIZE = 20

VEHICLES = [
    {
        "name_en": "1 Seat Buggy",
        "name_ar": "جو باجي فردي",
        "type": "buggy",
        "seats": 1,
        "price_per_hour": 10,
        "image_url": "https://images.unsplash.com/photo-1612118756064-5403ff7747de?auto=format&fit=crop&w=900&q=80",
        "display_on_home": True,
    },
    {
        "name_en": "2 Seat Buggy",
        "name_ar": "جو باجي لشخصين",
        "type": "buggy",
        "seats": 2,
        "price_per_hour": 15,
        "image_url": "https://images.unsplash.com/photo-1748460078692-acb877cb6c21?auto=format&fit=crop&w=900&q=80",
        "display_on_home": True,
    },
    {
        "name_en": "Quad Bike",
        "name_ar": "دراجة رباعية",
        "type": "quad",
        "seats": 1,
        "price_per_hour": 12,
        "image_url": "https://images.unsplash.com/photo-1507621320306-87a4aac1816c?auto=format&fit=crop&w=900&q=80",
        "display_on_home": True,
    },
    {
        "name_en": "Mountain Bike",
        "name_ar": "دراجة جبلية",
        "type": "bicycle",
        "seats": 1,
        "price_per_hour": 6,
        "image_url": "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80",
        "display_on_home": True,
    },
    {
        "name_en": "Electric Bike",
        "name_ar": "دراجة كهربائية",
        "type": "electric_bike",
        "seats": 1,
        "price_per_hour": 8,
        "image_url": "https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=900&q=80",
        "display_on_home": True,
    },
]

ROUTES = [
    {
        "name_en": "Mountain Trail",
        "name_ar": "مسار الجبال",
        "description_en": "Explore green mountain roads and misty valleys.",
        "description_ar": "استكشف الطرق الجبلية الخضراء والوديان الضبابية.",
        "duration_minutes": 60,
        "price": 15,
        "image_url": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
        "start_location": "Itin Plain, Salalah",
        "end_location": "Ittin Mountain Viewpoint, Dhofar",
        "start_lat": 17.0615,
        "start_lng": 54.0436,
        "end_lat": 17.0916,
        "end_lng": 54.0372,
        "path_points": '[{"lat":17.0719,"lng":54.0404},{"lat":17.0821,"lng":54.0383}]',
        "is_popular": True,
        "display_on_home": True,
    },
    {
        "name_en": "Wadi Explorer",
        "name_ar": "مستكشف الوادي",
        "description_en": "Ride through beautiful wadis and natural landscapes.",
        "description_ar": "تجربة قيادة بين الأودية والمناظر الطبيعية.",
        "duration_minutes": 90,
        "price": 25,
        "image_url": "https://images.unsplash.com/photo-1748460078692-acb877cb6c21?auto=format&fit=crop&w=900&q=80",
        "start_location": "Ain Razat, Salalah",
        "end_location": "Wadi Darbat, Dhofar",
        "start_lat": 17.1206,
        "start_lng": 54.2374,
        "end_lat": 17.1057,
        "end_lng": 54.4484,
        "path_points": '[{"lat":17.1188,"lng":54.2995},{"lat":17.1112,"lng":54.3717}]',
        "is_popular": True,
        "display_on_home": True,
    },
    {
        "name_en": "Waterfall Adventure",
        "name_ar": "مغامرة الشلالات",
        "description_en": "A premium route near waterfalls and scenic roads.",
        "description_ar": "مسار مميز بالقرب من الشلالات والطرق الخلابة.",
        "duration_minutes": 120,
        "price": 35,
        "image_url": "https://images.unsplash.com/photo-1489731300081-a03b0ce82303?auto=format&fit=crop&w=900&q=80",
        "start_location": "Taqah Coastal Road",
        "end_location": "Wadi Darbat Waterfall Area",
        "start_lat": 17.0361,
        "start_lng": 54.4019,
        "end_lat": 17.1057,
        "end_lng": 54.4484,
        "path_points": '[{"lat":17.0573,"lng":54.4165},{"lat":17.0834,"lng":54.4328}]',
        "is_popular": True,
        "display_on_home": True,
    },
]

HOME_CONTENT = {
    "hero_badge_en": "Simple booking in Salalah",
    "hero_badge_ar": "حجز بسيط في صلالة",
    "hero_title_en": "Book Your Buggy Bike",
    "hero_title_ar": "احجز الباجي",
    "hero_subtitle_en": "Choose the date, time, buggy type, and number of passengers. Pay by Visa or bank transfer.",
    "hero_subtitle_ar": "اختر التاريخ والوقت ونوع الباجي وعدد الأشخاص. ادفع بالفيزا أو التحويل البنكي.",
    "hero_cta_en": "Book Now",
    "hero_cta_ar": "احجز الآن",
    "hero_secondary_en": "View Experiences",
    "hero_secondary_ar": "عرض التجارب",
    "hero_note_en": "Fast booking for guests and families",
    "hero_note_ar": "حجز سريع للضيوف والعائلات",
    "hero_background_type": "image",
    "hero_background_url": "https://images.unsplash.com/photo-1748460078692-acb877cb6c21?auto=format&fit=crop&w=2200&q=85",
    "hero_side_image_url": "https://images.unsplash.com/photo-1612118756064-5403ff7747de?auto=format&fit=crop&w=1100&q=85",
    "vehicles_title_en": "Choose Your Buggy or Bike",
    "vehicles_title_ar": "اختر الباجي أو الدراجة المناسبة",
    "vehicles_subtitle_en": "Book a ride for yourself or your family, then choose the date and time that fits your Khareef Salalah plan.",
    "vehicles_subtitle_ar": "احجز رحلة لك أو لعائلتك ثم اختر التاريخ والوقت المناسبين لخطة خريف صلالة.",
    "routes_title_en": "Popular Routes & Experiences",
    "routes_title_ar": "المسارات والتجارب المميزة",
    "routes_subtitle_en": "Premium adventure routes designed for Khareef weather, scenery, and safety.",
    "routes_subtitle_ar": "مسارات مغامرة مصممة لأجواء الخريف والمناظر الطبيعية والسلامة.",
    "why_title_en": "Why Book With Us?",
    "why_title_ar": "لماذا تحجز معنا؟",
    "why_image_url": "https://images.unsplash.com/photo-1507621320306-87a4aac1816c?auto=format&fit=crop&w=1200&q=85",
}

PAYMENT_TRANSFER_DEFAULTS = {
    "transfer_title_en": "Bank Account & Mobile Transfer",
    "transfer_title_ar": "الحساب البنكي والتحويل عبر الجوال",
    "transfer_bank_name_en": "Bank Muscat",
    "transfer_bank_name_ar": "بنك مسقط",
    "transfer_account_name_en": "Buggy Dhofar",
    "transfer_account_name_ar": "باجي ظفار",
    "transfer_account_number": "",
    "transfer_iban": "",
    "transfer_mobile_wallet_en": "",
    "transfer_mobile_wallet_ar": "",
    "transfer_mobile_number": "",
    "transfer_notes_en": "Please include your name and booking date in the transfer reference.",
    "transfer_notes_ar": "يرجى ذكر اسمك وتاريخ الحجز في ملاحظة التحويل.",
}


def seed_payment_transfer_defaults(db: Session) -> None:
    content = db.query(models.SiteContent).first()
    if not content:
        return
    if content.transfer_account_number or content.transfer_iban or content.transfer_mobile_number:
        return
    if not content.transfer_bank_name_en:
        for key, value in PAYMENT_TRANSFER_DEFAULTS.items():
            setattr(content, key, value)
        db.commit()


def normalize_fleet_size(db: Session) -> int:
    """Keep fleet at FLEET_DEFAULT_SIZE bikes; drop unused extras or deactivate if booked."""
    units = db.query(models.FleetUnit).order_by(models.FleetUnit.unit_number).all()
    if len(units) <= FLEET_DEFAULT_SIZE:
        return 0

    changed = 0
    for unit in units[FLEET_DEFAULT_SIZE:]:
        has_bike_rows = (
            db.query(models.BookingBike.id).filter(models.BookingBike.fleet_unit_id == unit.id).first() is not None
        )
        has_legacy = (
            db.query(models.Booking.id).filter(models.Booking.fleet_unit_id == unit.id).first() is not None
        )
        if has_bike_rows or has_legacy:
            if unit.is_active:
                unit.is_active = False
                changed += 1
            continue
        db.delete(unit)
        changed += 1

    if changed:
        db.commit()
    return changed


def seed_database(db: Session) -> None:
    if db.query(models.Vehicle).count() == 0:
        db.add_all(models.Vehicle(**vehicle) for vehicle in VEHICLES)
    else:
        for vehicle_data in VEHICLES:
            vehicle = db.query(models.Vehicle).filter(models.Vehicle.name_en == vehicle_data["name_en"]).first()
            if vehicle is None:
                db.add(models.Vehicle(**vehicle_data))

    # Only seed default paths on a brand-new database. Do not re-create paths the admin deleted.
    if db.query(models.Route).count() == 0 and db.query(models.SiteContent).first() is None:
        db.add_all(models.Route(**route) for route in ROUTES)

    if db.query(models.Admin).filter(models.Admin.username == "admin").first() is None:
        db.add(
            models.Admin(
                username="admin",
                password_hash=hash_password("admin123"),
                role="super_admin",
            )
        )

    if db.query(models.Admin).filter(models.Admin.username == "scanner").first() is None:
        db.add(models.Admin(username="scanner", password_hash=hash_password("scanner123"), role="scanner"))

    if db.query(models.SiteContent).first() is None:
        db.add(models.SiteContent(**HOME_CONTENT))

    if db.query(models.FleetUnit).count() == 0:
        db.add_all(
            models.FleetUnit(
                unit_number=number,
                name_en=f"Buggy Bike #{number}",
                name_ar=f"دراجة باجي #{number}",
                is_active=True,
            )
            for number in range(1, FLEET_DEFAULT_SIZE + 1)
        )

    normalize_fleet_size(db)
    db.commit()
