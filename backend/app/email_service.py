import logging
import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from . import models
from .booking_numbers import booking_reference

logger = logging.getLogger(__name__)

FROM_EMAIL = os.getenv("SMTP_FROM", "info@buggydhofar.com")
FROM_NAME = os.getenv("SMTP_FROM_NAME", "Buggy Dhofar")
CONFIRMATION_SUBJECT = "Booking request received"
CONFIRMED_SUBJECT = "Your booking is confirmed"
CANCELLED_SUBJECT = "Booking cancelled"

PAYMENT_LABELS = {
    "visa": "Pay by Visa",
    "bank_transfer": "Bank Transfer",
    "arrival": "Pay on Arrival",
}


def _payment_label(method: str) -> str:
    return PAYMENT_LABELS.get(method, method.replace("_", " ").title())


def _format_transfer_block(content: models.SiteContent | None) -> str:
    if not content:
        return ""
    lines = ["\nPayment transfer details:"]
    has_bank = False
    if content.transfer_show_bank_name and content.transfer_bank_name_en:
        lines.append(f"  Bank: {content.transfer_bank_name_en}")
        has_bank = True
    if content.transfer_show_account_name and content.transfer_account_name_en:
        lines.append(f"  Account name: {content.transfer_account_name_en}")
        has_bank = True
    if content.transfer_show_account_number and content.transfer_account_number:
        lines.append(f"  Account number: {content.transfer_account_number}")
        has_bank = True
    if content.transfer_show_iban and content.transfer_iban:
        lines.append(f"  IBAN: {content.transfer_iban}")
        has_bank = True
    has_mobile = False
    if content.transfer_show_mobile_number and content.transfer_mobile_number:
        if not has_mobile:
            lines.append("Mobile transfer:")
        lines.append(f"  Mobile number: {content.transfer_mobile_number}")
        has_mobile = True
    if content.transfer_show_notes and content.transfer_notes_en:
        lines.append(content.transfer_notes_en)
    if not has_bank and not has_mobile and not (content.transfer_show_notes and content.transfer_notes_en):
        return ""
    return "\n".join(lines) + "\n"


def _build_confirmation_bodies(
    booking: models.Booking,
    route: models.Route | None,
    fleet_unit: models.FleetUnit | None,
    site_content: models.SiteContent | None = None,
) -> tuple[str, str]:
    route_name = route.name_en if route else "—"
    buggy_label = f"Buggy #{fleet_unit.unit_number}" if fleet_unit else "—"
    notes_block = f"\nNotice: {booking.notes}" if booking.notes else ""

    ref = booking_reference(booking)
    plain = f"""Dear {booking.customer_name},

Thank you for booking with Buggy Dhofar. We have received your booking request.

Booking number: {ref}
Name: {booking.customer_name}
Email: {booking.email}
Mobile: {booking.phone}
Date: {booking.date}
Time: {booking.time}
Buggy bike: {buggy_label}
Route: {route_name}
Passengers: {booking.passengers}
Total: {booking.total_price:.2f} OMR
Payment method: {_payment_label(booking.payment_method)}
Status: Pending — our team will confirm your booking within 24 hours.
Please keep booking number {ref} for all follow-up.{notes_block}{_format_transfer_block(site_content) if booking.payment_method == "bank_transfer" else ""}

We look forward to seeing you in Salalah / Dhofar.

Buggy Dhofar
info@buggydhofar.com
"""

    html = f"""<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:560px">
  <h2 style="color:#1f7a4f">Booking confirmation</h2>
  <p>Dear {booking.customer_name},</p>
  <p>Thank you for booking with <strong>Buggy Dhofar</strong>. We have received your booking request.</p>
  <p style="color:#b45309;font-weight:bold">Status: Pending — our team will confirm your booking within 24 hours.</p>
  <p style="color:#1f7a4f;font-weight:bold">Your booking number: {ref}</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0">
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Booking number</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{ref}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Date</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{booking.date}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Time</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{booking.time}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Buggy bike</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{buggy_label}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Route</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{route_name}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Passengers</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{booking.passengers}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Total</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{booking.total_price:.2f} OMR</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Payment</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{_payment_label(booking.payment_method)}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Mobile</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{booking.phone}</td></tr>
    {"<tr><td style='padding:8px 0;border-bottom:1px solid #eee'><strong>Notice</strong></td><td style='padding:8px 0;border-bottom:1px solid #eee'>" + booking.notes + "</td></tr>" if booking.notes else ""}
  </table>
  <p style="color:#555">We look forward to seeing you in Salalah / Dhofar.</p>
  <p style="color:#1f7a4f;font-weight:bold">Buggy Dhofar<br>info@buggydhofar.com</p>
</body>
</html>"""

    return plain, html


def _build_confirmed_bodies(
    booking: models.Booking,
    route: models.Route | None,
    fleet_unit: models.FleetUnit | None,
) -> tuple[str, str]:
    ref = booking_reference(booking)
    route_name = route.name_en if route else "—"
    buggy_label = f"Buggy #{fleet_unit.unit_number}" if fleet_unit else "—"
    plain = f"""Dear {booking.customer_name},

Great news — your booking with Buggy Dhofar is confirmed.

Booking number: {ref}
Date: {booking.date}
Time: {booking.time}
Buggy bike: {buggy_label}
Route: {route_name}
Passengers: {booking.passengers}
Total: {booking.total_price:.2f} OMR

Please keep booking number {ref} and show it when you arrive.

We look forward to seeing you in Salalah / Dhofar.

Buggy Dhofar
info@buggydhofar.com
"""
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:560px">
  <h2 style="color:#1f7a4f">Booking confirmed</h2>
  <p>Dear {booking.customer_name},</p>
  <p>Your booking is <strong>confirmed</strong>. Please keep your booking number for reference.</p>
  <p style="font-size:24px;font-weight:bold;color:#1f7a4f;letter-spacing:2px">{ref}</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0">
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Date</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{booking.date}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Time</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{booking.time}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Buggy bike</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{buggy_label}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Route</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{route_name}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Total</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{booking.total_price:.2f} OMR</td></tr>
  </table>
  <p style="color:#1f7a4f;font-weight:bold">Buggy Dhofar<br>info@buggydhofar.com</p>
</body>
</html>"""
    return plain, html


def _build_cancelled_bodies(
    booking: models.Booking,
    route: models.Route | None,
    fleet_unit: models.FleetUnit | None,
    *,
    auto_expired: bool = False,
) -> tuple[str, str]:
    ref = booking_reference(booking)
    route_name = route.name_en if route else "—"
    buggy_label = f"Buggy #{fleet_unit.unit_number}" if fleet_unit else "—"
    reason = (
        "It was not confirmed within 24 hours."
        if auto_expired
        else "Your booking has been cancelled by our team."
    )
    plain = f"""Dear {booking.customer_name},

Your booking with Buggy Dhofar has been cancelled.

Booking number: {ref}
{reason}

Date: {booking.date}
Time: {booking.time}
Buggy bike: {buggy_label}
Route: {route_name}

If you have questions, contact us at info@buggydhofar.com and quote booking number {ref}.

Buggy Dhofar
info@buggydhofar.com
"""
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:560px">
  <h2 style="color:#b45309">Booking cancelled</h2>
  <p>Dear {booking.customer_name},</p>
  <p>Booking number <strong>{ref}</strong> has been cancelled. {reason}</p>
  <ul>
    <li><strong>Date:</strong> {booking.date} {booking.time}</li>
    <li><strong>Buggy:</strong> {buggy_label}</li>
    <li><strong>Route:</strong> {route_name}</li>
  </ul>
  <p style="color:#555">Contact info@buggydhofar.com if you need help.</p>
</body>
</html>"""
    return plain, html


def _build_reply_html(customer_name: str, message: str) -> str:
    escaped = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")
    return f"""<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:560px">
  <p>Dear {customer_name},</p>
  <div style="margin:16px 0">{escaped}</div>
  <p style="color:#1f7a4f;font-weight:bold">Buggy Dhofar<br>info@buggydhofar.com</p>
</body>
</html>"""


def _save_dev_copy(kind: str, recipient: str, subject: str, plain: str) -> Path:
    out_dir = Path(__file__).resolve().parent.parent / "sent_emails"
    out_dir.mkdir(exist_ok=True)
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_recipient = recipient.replace("@", "_at_")
    path = out_dir / f"{kind}_{stamp}_{safe_recipient}.txt"
    path.write_text(f"To: {recipient}\nSubject: {subject}\nFrom: {FROM_EMAIL}\n\n{plain}", encoding="utf-8")
    return path


def _deliver_email(recipient: str, subject: str, plain: str, html: str) -> tuple[str, str | None]:
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    if not smtp_host:
        _save_dev_copy("email", recipient, subject, plain)
        return "saved_dev", None

    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    message["To"] = recipient
    message["Reply-To"] = FROM_EMAIL
    message.attach(MIMEText(plain, "plain", "utf-8"))
    message.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            if use_tls:
                server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(FROM_EMAIL, [recipient], message.as_string())
        return "sent", None
    except Exception as exc:
        logger.exception("SMTP delivery failed to %s", recipient)
        return "failed", str(exc)


def _log_email(
    db,
    *,
    booking_id: int,
    email_type: str,
    recipient: str,
    subject: str,
    body_plain: str,
    delivery_status: str,
    error_message: str | None = None,
) -> models.BookingEmailLog:
    entry = models.BookingEmailLog(
        booking_id=booking_id,
        email_type=email_type,
        recipient=recipient,
        subject=subject,
        body_plain=body_plain,
        sender=FROM_EMAIL,
        delivery_status=delivery_status,
        error_message=error_message,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def send_booking_confirmation(booking: models.Booking, route: models.Route | None, fleet_unit: models.FleetUnit | None, site_content: models.SiteContent | None = None) -> None:
    from .database import SessionLocal

    plain, html = _build_confirmation_bodies(booking, route, fleet_unit, site_content)
    status, error = _deliver_email(booking.email, CONFIRMATION_SUBJECT, plain, html)

    db = SessionLocal()
    try:
        _log_email(
            db,
            booking_id=booking.id,
            email_type="confirmation",
            recipient=booking.email,
            subject=CONFIRMATION_SUBJECT,
            body_plain=plain,
            delivery_status=status,
            error_message=error,
        )
    finally:
        db.close()

    if status == "sent":
        logger.info("Booking confirmation sent to %s for booking #%s", booking.email, booking.id)
    elif status == "saved_dev":
        logger.info("Booking confirmation archived locally for booking #%s", booking.id)


def send_booking_confirmation_task(booking_id: int) -> None:
    from .database import SessionLocal

    db = SessionLocal()
    try:
        booking = db.get(models.Booking, booking_id)
        if not booking:
            logger.warning("Booking #%s not found for confirmation email", booking_id)
            return
        route = db.get(models.Route, booking.route_id)
        fleet_unit = db.get(models.FleetUnit, booking.fleet_unit_id) if booking.fleet_unit_id else None
        site_content = db.query(models.SiteContent).first()
        send_booking_confirmation(booking, route, fleet_unit, site_content)
    except Exception:
        logger.exception("Failed to send booking confirmation for #%s", booking_id)
    finally:
        db.close()


def send_booking_confirmed_task(booking_id: int) -> None:
    from .database import SessionLocal

    db = SessionLocal()
    try:
        booking = db.get(models.Booking, booking_id)
        if not booking:
            logger.warning("Booking #%s not found for confirmed email", booking_id)
            return
        route = db.get(models.Route, booking.route_id)
        fleet_unit = db.get(models.FleetUnit, booking.fleet_unit_id) if booking.fleet_unit_id else None
        plain, html = _build_confirmed_bodies(booking, route, fleet_unit)
        status, error = _deliver_email(booking.email, CONFIRMED_SUBJECT, plain, html)
        _log_email(
            db,
            booking_id=booking.id,
            email_type="booking_confirmed",
            recipient=booking.email,
            subject=CONFIRMED_SUBJECT,
            body_plain=plain,
            delivery_status=status,
            error_message=error,
        )
        ref = booking_reference(booking)
        if status == "sent":
            logger.info("Booking confirmed email sent to %s for booking %s", booking.email, ref)
    except Exception:
        logger.exception("Failed to send booking confirmed email for #%s", booking_id)
    finally:
        db.close()


def send_booking_cancelled_task(booking_id: int, auto_expired: bool = False) -> None:
    from .database import SessionLocal

    db = SessionLocal()
    try:
        booking = db.get(models.Booking, booking_id)
        if not booking:
            logger.warning("Booking #%s not found for cancellation email", booking_id)
            return
        route = db.get(models.Route, booking.route_id)
        fleet_unit = db.get(models.FleetUnit, booking.fleet_unit_id) if booking.fleet_unit_id else None
        plain, html = _build_cancelled_bodies(booking, route, fleet_unit, auto_expired=auto_expired)
        status, error = _deliver_email(booking.email, CANCELLED_SUBJECT, plain, html)
        _log_email(
            db,
            booking_id=booking.id,
            email_type="booking_cancelled",
            recipient=booking.email,
            subject=CANCELLED_SUBJECT,
            body_plain=plain,
            delivery_status=status,
            error_message=error,
        )
        ref = booking_reference(booking)
        if status == "sent":
            logger.info("Booking cancelled email sent to %s for booking %s", booking.email, ref)
    except Exception:
        logger.exception("Failed to send booking cancelled email for #%s", booking_id)
    finally:
        db.close()


def send_admin_reply_task(booking_id: int, subject: str, message: str) -> None:
    from .database import SessionLocal

    db = SessionLocal()
    try:
        booking = db.get(models.Booking, booking_id)
        if not booking:
            logger.warning("Booking #%s not found for admin reply", booking_id)
            return

        plain = f"Dear {booking.customer_name},\n\n{message.strip()}\n\nBuggy Dhofar\ninfo@buggydhofar.com"
        html = _build_reply_html(booking.customer_name, message.strip())
        status, error = _deliver_email(booking.email, subject.strip(), plain, html)
        _log_email(
            db,
            booking_id=booking.id,
            email_type="admin_reply",
            recipient=booking.email,
            subject=subject.strip(),
            body_plain=plain,
            delivery_status=status,
            error_message=error,
        )
    except Exception:
        logger.exception("Failed to send admin reply for booking #%s", booking_id)
    finally:
        db.close()


def send_admin_expired_booking_notice(booking_id: int) -> None:
    from .database import SessionLocal

    admin_email = os.getenv("ADMIN_NOTIFY_EMAIL", FROM_EMAIL)
    db = SessionLocal()
    try:
        booking = db.get(models.Booking, booking_id)
        if not booking:
            return
        fleet_unit = db.get(models.FleetUnit, booking.fleet_unit_id) if booking.fleet_unit_id else None
        buggy_label = f"Buggy #{fleet_unit.unit_number}" if fleet_unit else "—"
        ref = booking_reference(booking)
        subject = f"Booking {ref} auto-cancelled (24h expired)"
        plain = f"""Admin notice — booking auto-cancelled

Booking number {ref} was not confirmed within 24 hours and has been cancelled.
The buggy bike has been released back to the fleet.

Customer: {booking.customer_name}
Email: {booking.email}
Mobile: {booking.phone}
Ride date: {booking.date} at {booking.time}
Buggy: {buggy_label}
Total: {booking.total_price:.2f} OMR

Buggy Dhofar Admin
"""
        html = f"""<!DOCTYPE html><html><body style="font-family:Arial,sans-serif">
<h2 style="color:#b45309">Booking auto-cancelled</h2>
<p>Booking <strong>{ref}</strong> was not confirmed within 24 hours and has been cancelled. The buggy is available again.</p>
<ul>
<li><strong>Customer:</strong> {booking.customer_name}</li>
<li><strong>Email:</strong> {booking.email}</li>
<li><strong>Mobile:</strong> {booking.phone}</li>
<li><strong>Ride:</strong> {booking.date} {booking.time}</li>
<li><strong>Buggy:</strong> {buggy_label}</li>
<li><strong>Total:</strong> {booking.total_price:.2f} OMR</li>
</ul>
</body></html>"""
        status, error = _deliver_email(admin_email, subject, plain, html)
        _log_email(
            db,
            booking_id=booking.id,
            email_type="admin_expiry_notice",
            recipient=admin_email,
            subject=subject,
            body_plain=plain,
            delivery_status=status,
            error_message=error,
        )
    except Exception:
        logger.exception("Failed to notify admin about expired booking #%s", booking_id)
    finally:
        db.close()
