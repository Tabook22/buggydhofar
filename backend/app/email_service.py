import html
import logging
import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from . import models
from .booking_numbers import booking_reference
from .booking_qr import build_check_in_url, qr_code_image_url
from .fleet import booking_fleet_units, format_bike_label
from .pricing import TAX_PERCENT, booking_price_breakdown

logger = logging.getLogger(__name__)

FROM_EMAIL = os.getenv("SMTP_FROM", "info@buggydhofar.com")
FROM_NAME = os.getenv("SMTP_FROM_NAME", "Buggy Dhofar")


def smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST", "").strip())


def is_production_mode() -> bool:
    site = os.getenv("PUBLIC_SITE_URL", "").strip().lower()
    if site and "localhost" not in site and "127.0.0.1" not in site:
        return True
    return os.getenv("KHAREEF_ENV", "").strip().lower() == "production"


AUTO_REPLY_BLOCKED_DOMAINS = frozenset(
    {
        "example.com",
        "example.org",
        "example.net",
        "test.com",
        "invalid",
        "localhost",
    }
)


def can_send_contact_auto_reply(email: str) -> bool:
    parts = email.rsplit("@", 1)
    if len(parts) != 2 or not parts[0].strip() or not parts[1].strip():
        return False
    domain = parts[1].strip().lower()
    return domain not in AUTO_REPLY_BLOCKED_DOMAINS


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


def _price_breakdown(booking: models.Booking) -> tuple[float, float, float]:
    return booking_price_breakdown(booking.subtotal, booking.tax_amount, booking.total_price)


def _price_plain_lines(booking: models.Booking) -> str:
    subtotal, tax_amount, total = _price_breakdown(booking)
    if tax_amount <= 0:
        return f"Total: {total:.2f} OMR"
    return (
        f"Subtotal: {subtotal:.2f} OMR\n"
        f"Tax ({TAX_PERCENT}%): {tax_amount:.2f} OMR\n"
        f"Total (incl. tax): {total:.2f} OMR"
    )


def _price_html_rows(booking: models.Booking) -> str:
    subtotal, tax_amount, total = _price_breakdown(booking)
    if tax_amount <= 0:
        return (
            f"<tr><td style='padding:8px 0;border-bottom:1px solid #eee'><strong>Total</strong></td>"
            f"<td style='padding:8px 0;border-bottom:1px solid #eee'>{total:.2f} OMR</td></tr>"
        )
    return (
        f"<tr><td style='padding:8px 0;border-bottom:1px solid #eee'><strong>Subtotal</strong></td>"
        f"<td style='padding:8px 0;border-bottom:1px solid #eee'>{subtotal:.2f} OMR</td></tr>"
        f"<tr><td style='padding:8px 0;border-bottom:1px solid #eee'><strong>Tax ({TAX_PERCENT}%)</strong></td>"
        f"<td style='padding:8px 0;border-bottom:1px solid #eee'>{tax_amount:.2f} OMR</td></tr>"
        f"<tr><td style='padding:8px 0;border-bottom:1px solid #eee'><strong>Total (incl. tax)</strong></td>"
        f"<td style='padding:8px 0;border-bottom:1px solid #eee'><strong>{total:.2f} OMR</strong></td></tr>"
    )


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


def _waiver_email_blocks(booking: models.Booking) -> tuple[str, str]:
    if not booking.waiver_text:
        return "", ""
    plain = f"\n\n--- Liability waiver (signed electronically) ---\n\n{booking.waiver_text}"
    escaped = html.escape(booking.waiver_text)
    html_block = f"""
  <hr style="margin:28px 0;border:none;border-top:1px solid #ddd" />
  <h3 style="color:#1f7a4f;margin-bottom:8px">Liability waiver (signed electronically)</h3>
  <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;background:#f7f7f7;padding:16px;border-radius:8px;border:1px solid #eee">{escaped}</pre>"""
    return plain, html_block


def _qr_email_blocks(booking: models.Booking) -> tuple[str, str]:
    if not booking.check_in_token:
        return "", ""
    check_in_url = build_check_in_url(booking.check_in_token)
    qr_url = qr_code_image_url(check_in_url)
    plain = f"""

Check-in QR code: {check_in_url}
Show this QR code when you arrive so our team can verify your booking."""
    html_block = f"""
  <hr style="margin:28px 0;border:none;border-top:1px solid #ddd" />
  <h3 style="color:#1f7a4f;margin-bottom:8px">Your check-in QR code</h3>
  <p style="color:#555">Show this QR code when you arrive. Our team will scan it to verify your booking, date, and time.</p>
  <p style="text-align:center;margin:16px 0"><img src="{qr_url}" alt="Booking QR code" width="200" height="200" style="border:1px solid #eee;border-radius:8px" /></p>
  <p style="font-size:12px;color:#888;word-break:break-all">{check_in_url}</p>"""
    return plain, html_block


def _build_confirmation_bodies(
    booking: models.Booking,
    route: models.Route | None,
    fleet_units: list[models.FleetUnit],
    site_content: models.SiteContent | None = None,
) -> tuple[str, str]:
    route_name = route.name_en if route else "—"
    buggy_label = format_bike_label(fleet_units)
    bike_count = len(fleet_units)
    notes_block = f"\nNotice: {booking.notes}" if booking.notes else ""
    waiver_plain, waiver_html = _waiver_email_blocks(booking)
    qr_plain, qr_html = _qr_email_blocks(booking)

    ref = booking_reference(booking)
    mode_label = "Individual bikes (one per person)" if getattr(booking, "booking_mode", "group") == "individual" else "Group (share bikes)"
    plain = f"""Dear {booking.customer_name},

Thank you for booking with Buggy Dhofar. We have received your booking request.

Booking number: {ref}
Booking type: {mode_label}
Name: {booking.customer_name}
Email: {booking.email}
Mobile: {booking.phone}
Date: {booking.date}
Time: {booking.time}
Buggy bike(s): {buggy_label}
Bikes booked: {bike_count}
Route: {route_name}
Passengers: {booking.passengers}
{_price_plain_lines(booking)}
Payment method: {_payment_label(booking.payment_method)}
Status: Pending — our team will confirm your booking within 24 hours.
Please keep booking number {ref} for all follow-up.{notes_block}{_format_transfer_block(site_content) if booking.payment_method == "bank_transfer" else ""}{qr_plain}{waiver_plain}

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
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Buggy bike(s)</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{buggy_label}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Bikes</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{bike_count}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Route</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{route_name}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Passengers</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{booking.passengers}</td></tr>
    {_price_html_rows(booking)}
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Payment</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{_payment_label(booking.payment_method)}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Mobile</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{booking.phone}</td></tr>
    {"<tr><td style='padding:8px 0;border-bottom:1px solid #eee'><strong>Notice</strong></td><td style='padding:8px 0;border-bottom:1px solid #eee'>" + booking.notes + "</td></tr>" if booking.notes else ""}
  </table>
  <p style="color:#555">We look forward to seeing you in Salalah / Dhofar.</p>{qr_html}{waiver_html}
  <p style="color:#1f7a4f;font-weight:bold">Buggy Dhofar<br>info@buggydhofar.com</p>
</body>
</html>"""

    return plain, html


def _build_confirmed_bodies(
    booking: models.Booking,
    route: models.Route | None,
    fleet_units: list[models.FleetUnit],
) -> tuple[str, str]:
    ref = booking_reference(booking)
    route_name = route.name_en if route else "—"
    buggy_label = format_bike_label(fleet_units)
    bike_count = len(fleet_units)
    waiver_plain, waiver_html = _waiver_email_blocks(booking)
    qr_plain, qr_html = _qr_email_blocks(booking)
    plain = f"""Dear {booking.customer_name},

Great news — your booking with Buggy Dhofar is confirmed.

Booking number: {ref}
Date: {booking.date}
Time: {booking.time}
Buggy bike(s): {buggy_label}
Bikes booked: {bike_count}
Route: {route_name}
Passengers: {booking.passengers}
{_price_plain_lines(booking)}

Please keep booking number {ref} and show it when you arrive.{qr_plain}{waiver_plain}

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
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Buggy bike(s)</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{buggy_label}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Bikes</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{bike_count}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Route</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{route_name}</td></tr>
    {_price_html_rows(booking)}
  </table>{qr_html}{waiver_html}
  <p style="color:#1f7a4f;font-weight:bold">Buggy Dhofar<br>info@buggydhofar.com</p>
</body>
</html>"""
    return plain, html


def _build_cancelled_bodies(
    booking: models.Booking,
    route: models.Route | None,
    fleet_units: list[models.FleetUnit],
    *,
    auto_expired: bool = False,
) -> tuple[str, str]:
    ref = booking_reference(booking)
    route_name = route.name_en if route else "—"
    buggy_label = format_bike_label(fleet_units)
    bike_count = len(fleet_units)
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
Buggy bike(s): {buggy_label}
Bikes booked: {bike_count}
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


def _deliver_email(
    recipient: str,
    subject: str,
    plain: str,
    html: str,
    *,
    reply_to: str | None = None,
) -> tuple[str, str | None]:
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    if not smtp_host:
        _save_dev_copy("email", recipient, subject, plain)
        return "saved_dev", None

    smtp_port = int(os.getenv("SMTP_PORT", "465"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    use_ssl = os.getenv("SMTP_USE_SSL", "").lower() in {"1", "true", "yes"} or smtp_port == 465
    use_tls = os.getenv("SMTP_USE_TLS", "false").lower() in {"1", "true", "yes"}

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    message["To"] = recipient
    message["Reply-To"] = reply_to or FROM_EMAIL
    message.attach(MIMEText(plain, "plain", "utf-8"))
    message.attach(MIMEText(html, "html", "utf-8"))

    try:
        if use_ssl:
            server_factory = lambda: smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
        else:
            server_factory = lambda: smtplib.SMTP(smtp_host, smtp_port, timeout=30)

        with server_factory() as server:
            if not use_ssl and use_tls:
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


def send_booking_confirmation(booking: models.Booking, route: models.Route | None, fleet_units: list[models.FleetUnit], site_content: models.SiteContent | None = None) -> None:
    from .database import SessionLocal

    plain, html = _build_confirmation_bodies(booking, route, fleet_units, site_content)
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
        fleet_units = booking_fleet_units(db, booking)
        site_content = db.query(models.SiteContent).first()
        send_booking_confirmation(booking, route, fleet_units, site_content)
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
        fleet_units = booking_fleet_units(db, booking)
        plain, html = _build_confirmed_bodies(booking, route, fleet_units)
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
        fleet_units = booking_fleet_units(db, booking)
        plain, html = _build_cancelled_bodies(booking, route, fleet_units, auto_expired=auto_expired)
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
        fleet_units = booking_fleet_units(db, booking)
        buggy_label = format_bike_label(fleet_units)
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


CONTACT_ADMIN_SUBJECT = "New contact form message — Buggy Dhofar"
CONTACT_AUTO_REPLY_SUBJECT = "We received your message — Buggy Dhofar"


def _build_contact_admin_bodies(full_name: str, phone: str, email: str, message: str) -> tuple[str, str]:
    escaped_message = html.escape(message)
    plain = f"""New message from the Buggy Dhofar contact form

Name: {full_name}
Email: {email}
Phone: {phone}

Message:
{message}

Reply directly to this visitor at {email}.
"""
    html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:560px">
  <h2 style="color:#1f7a4f">New contact form message</h2>
  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Name</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{html.escape(full_name)}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Email</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee"><a href="mailto:{html.escape(email)}">{html.escape(email)}</a></td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee"><strong>Phone</strong></td><td style="padding:8px 0;border-bottom:1px solid #eee">{html.escape(phone)}</td></tr>
  </table>
  <h3 style="color:#1f7a4f;margin-bottom:8px">Message</h3>
  <p style="white-space:pre-wrap;background:#f7f7f7;padding:16px;border-radius:8px;border:1px solid #eee">{escaped_message}</p>
  <p style="color:#555;font-size:13px">Reply directly to the visitor — their address is set as Reply-To on this email.</p>
</body>
</html>"""
    return plain, html_body


def _build_contact_auto_reply_bodies(full_name: str) -> tuple[str, str]:
    plain = f"""Dear {full_name},

Thank you for contacting Buggy Dhofar. We have received your message and will get back to you as soon as possible.

Salalah, Dhofar, Oman
info@buggydhofar.com

Buggy Dhofar
"""
    html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a1a;max-width:560px">
  <h2 style="color:#1f7a4f">Thank you for contacting us</h2>
  <p>Dear {html.escape(full_name)},</p>
  <p>We have received your message and will reply as soon as possible.</p>
  <p style="color:#1f7a4f;font-weight:bold">Buggy Dhofar<br>info@buggydhofar.com<br>Salalah, Dhofar, Oman</p>
</body>
</html>"""
    return plain, html_body


def send_contact_message(full_name: str, phone: str, email: str, message: str) -> tuple[str, str | None]:
    admin_email = os.getenv("ADMIN_NOTIFY_EMAIL", FROM_EMAIL).strip() or FROM_EMAIL
    admin_plain, admin_html = _build_contact_admin_bodies(full_name, phone, email, message)
    status, error = _deliver_email(
        admin_email,
        CONTACT_ADMIN_SUBJECT,
        admin_plain,
        admin_html,
        reply_to=email,
    )
    if status == "failed":
        return status, error

    if can_send_contact_auto_reply(email):
        auto_plain, auto_html = _build_contact_auto_reply_bodies(full_name)
        auto_status, auto_error = _deliver_email(email, CONTACT_AUTO_REPLY_SUBJECT, auto_plain, auto_html)
        if auto_status == "failed":
            logger.warning("Contact auto-reply failed for %s: %s", email, auto_error)
    else:
        logger.info("Skipping contact auto-reply for blocked or invalid address: %s", email)

    if status == "sent":
        logger.info("Contact form message sent to %s from %s", admin_email, email)
    elif status == "saved_dev":
        logger.info("Contact form message saved locally from %s", email)

    return status, error
