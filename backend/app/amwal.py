"""AMWAL SmartBox payment helpers (hash generation and verification)."""

from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timezone
from typing import Any

AMWAL_ENV_URLS = {
    "production": "https://checkout.amwalpg.com/js/SmartBox.js?v=1.1",
    "uat": "https://test.amwalpg.com:7443/js/SmartBox.js?v=1.1",
    "sit": "https://test.amwalpg.com:19443/js/SmartBox.js?v=1.1",
}

SUCCESS_RESPONSE_CODES = {"00", "0"}


def amwal_configured() -> bool:
    return bool(_raw_secret_key() and _merchant_id() and _terminal_id())


def _merchant_id() -> str:
    return os.getenv("AMWAL_MID", "").strip()


def _terminal_id() -> str:
    return os.getenv("AMWAL_TID", "").strip()


def _raw_secret_key() -> str:
    return os.getenv("AMWAL_SECRET_KEY", "").strip().strip('"').strip("'")


def _secret_key() -> str:
    raw = _raw_secret_key()
    if not raw:
        raise ValueError("AMWAL_SECRET_KEY is not configured")
    return _normalize_hex_key(raw)


def _normalize_hex_key(raw: str) -> str:
    cleaned = raw.replace("\r", "").replace("\n", "").strip()
    if ":" in cleaned:
        tail = cleaned.rsplit(":", 1)[-1].strip()
        if len(tail) >= 32:
            cleaned = tail
    cleaned = "".join(cleaned.split())
    if not cleaned:
        raise ValueError("AMWAL_SECRET_KEY is empty.")
    if len(cleaned) % 2 != 0:
        raise ValueError("AMWAL_SECRET_KEY must be an even-length hexadecimal value.")
    try:
        bytes.fromhex(cleaned)
    except ValueError as exc:
        raise ValueError(
            "AMWAL_SECRET_KEY must contain only hexadecimal characters (0-9, A-F)."
        ) from exc
    return cleaned


def _environment() -> str:
    env = os.getenv("AMWAL_ENV", "uat").strip().lower()
    return env if env in AMWAL_ENV_URLS else "uat"


def smartbox_script_url() -> str:
    return AMWAL_ENV_URLS[_environment()]


def public_site_url() -> str:
    return os.getenv("PUBLIC_SITE_URL", "https://buggydhofar.com").rstrip("/")


def format_amount(amount: float) -> str:
    return f"{amount:.3f}"


def trx_datetime_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _sorted_param_string(params: dict[str, Any]) -> str:
    normalized: dict[str, str] = {}
    for key, value in params.items():
        if key in {"SecureHash", "secureHashValue", "secureHash"}:
            continue
        if value is None:
            normalized[key] = ""
        elif isinstance(value, bool):
            normalized[key] = str(value).lower()
        elif isinstance(value, (int, float)):
            normalized[key] = str(value)
        else:
            normalized[key] = str(value)
    return "&".join(f"{key}={normalized[key]}" for key in sorted(normalized))


def generate_hmac_sha256(data_string: str, hex_key: str) -> str:
    key_bytes = bytes.fromhex(_normalize_hex_key(hex_key))
    digest = hmac.new(key_bytes, data_string.encode("utf-8"), hashlib.sha256).hexdigest()
    return digest.upper()


def generate_request_secure_hash(params: dict[str, Any]) -> str:
    secret = _secret_key()
    return generate_hmac_sha256(_sorted_param_string(params), secret)


def build_smartbox_request_hash(
    *,
    amount: str,
    merchant_reference: str,
    request_datetime: str,
    session_token: str = "",
) -> str:
    return generate_request_secure_hash(
        {
            "Amount": amount,
            "CurrencyId": "512",
            "MerchantId": _merchant_id(),
            "MerchantReference": merchant_reference,
            "RequestDateTime": request_datetime,
            "SessionToken": session_token,
            "TerminalId": _terminal_id(),
        }
    )


def verify_callback_secure_hash(payload: dict[str, Any]) -> bool:
    received = (
        payload.get("secureHashValue")
        or payload.get("SecureHash")
        or payload.get("secureHash")
        or ""
    )
    if not received:
        return False
    params = {
        "amount": payload.get("amount", ""),
        "currencyId": payload.get("currencyId", ""),
        "customerId": payload.get("customerId", ""),
        "customerTokenId": payload.get("customerTokenId", ""),
        "merchantId": payload.get("merchantId", ""),
        "merchantReference": payload.get("merchantReference", ""),
        "responseCode": payload.get("responseCode", ""),
        "terminalId": payload.get("terminalId", ""),
        "transactionId": payload.get("transactionId", ""),
        "transactionTime": payload.get("transactionTime", ""),
    }
    expected = generate_request_secure_hash(params)
    return hmac.compare_digest(expected, str(received).upper())


def verify_cloud_notification_secure_hash(payload: dict[str, Any]) -> bool:
    received = payload.get("SecureHash") or payload.get("secureHashValue") or ""
    if not received:
        return False
    params = {
        "Amount": payload.get("Amount", ""),
        "AuthorizationDateTime": payload.get("AuthorizationDateTime", ""),
        "CurrencyId": payload.get("CurrencyId", ""),
        "DateTimeLocalTrxn": payload.get("DateTimeLocalTrxn", ""),
        "MerchantId": payload.get("MerchantId", ""),
        "MerchantReference": payload.get("MerchantReference", ""),
        "Message": payload.get("Message", ""),
        "PaidThrough": payload.get("PaidThrough", ""),
        "ResponseCode": payload.get("ResponseCode", ""),
        "SystemReference": payload.get("SystemReference", ""),
        "TerminalId": payload.get("TerminalId", ""),
        "TxnType": payload.get("TxnType", ""),
    }
    expected = generate_request_secure_hash(params)
    return hmac.compare_digest(expected, str(received).upper())


def is_success_response_code(code: Any) -> bool:
    return str(code or "").strip() in SUCCESS_RESPONSE_CODES


def build_smartbox_configure(
    *,
    amount: float,
    merchant_reference: str,
    language_id: str,
) -> dict[str, Any]:
    amount_str = format_amount(amount)
    trx_datetime = trx_datetime_iso()
    secure_hash = build_smartbox_request_hash(
        amount=amount_str,
        merchant_reference=merchant_reference,
        request_datetime=trx_datetime,
    )
    site = public_site_url()
    return {
        "scriptUrl": smartbox_script_url(),
        "MID": _merchant_id(),
        "TID": _terminal_id(),
        "CurrencyId": 512,
        "AmountTrxn": amount_str,
        "MerchantReference": merchant_reference,
        "LanguageId": language_id,
        "PaymentViewType": 1,
        "TrxDateTime": trx_datetime,
        "SessionToken": "",
        "ContactInfoType": 1,
        "ReturnUrl": f"{site}/booking",
        "CancelUrl": f"{site}/booking",
        "IgnoreReceipt": "false",
        "SecureHash": secure_hash,
        "primaryColor": "#2d6a4f",
    }
