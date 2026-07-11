"""Serialize site content (FAQ JSON, API output)."""

from __future__ import annotations

import json
from typing import Any

from . import models, schemas

DEFAULT_FAQ_ITEMS: list[dict[str, str]] = [
    {
        "q_en": "Do I need previous riding experience?",
        "q_ar": "هل أحتاج إلى خبرة سابقة؟",
        "a_en": "No. Our team gives a safety briefing and recommends routes based on your comfort level.",
        "a_ar": "لا. يقدم فريقنا شرحاً للسلامة ويقترح المسار المناسب لمستوى راحتك.",
    },
    {
        "q_en": "Can tourists book online?",
        "q_ar": "هل يمكن للسياح الحجز عبر الإنترنت؟",
        "a_en": "Yes. Guests can book online and pay by Visa card.",
        "a_ar": "نعم. يمكن للضيوف الحجز عبر الإنترنت والدفع ببطاقة فيزا.",
    },
    {
        "q_en": "Is safety equipment included?",
        "q_ar": "هل معدات السلامة مشمولة؟",
        "a_en": "Yes. Helmets and basic safety gear are included with every ride.",
        "a_ar": "نعم. الخوذات ومعدات السلامة الأساسية مشمولة مع كل رحلة.",
    },
]


def parse_faq_items_json(raw: str | None) -> list[schemas.FaqItem]:
    if not raw or not str(raw).strip():
        return [schemas.FaqItem(**item) for item in DEFAULT_FAQ_ITEMS]
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return [schemas.FaqItem(**item) for item in DEFAULT_FAQ_ITEMS]
    if not isinstance(data, list) or not data:
        return [schemas.FaqItem(**item) for item in DEFAULT_FAQ_ITEMS]
    items: list[schemas.FaqItem] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        try:
            items.append(schemas.FaqItem.model_validate(entry))
        except Exception:
            continue
    return items or [schemas.FaqItem(**item) for item in DEFAULT_FAQ_ITEMS]


def serialize_faq_items(items: list[Any]) -> str:
    normalized: list[dict[str, str]] = []
    for entry in items:
        if hasattr(entry, "model_dump"):
            payload = entry.model_dump()
        elif isinstance(entry, dict):
            payload = entry
        else:
            continue
        normalized.append(
            {
                "q_en": str(payload.get("q_en", "")).strip(),
                "q_ar": str(payload.get("q_ar", "")).strip(),
                "a_en": str(payload.get("a_en", "")).strip(),
                "a_ar": str(payload.get("a_ar", "")).strip(),
            }
        )
    return json.dumps(normalized, ensure_ascii=False)


def apply_site_content_payload(content: models.SiteContent, data: dict[str, Any]) -> None:
    payload = dict(data)
    faq_items = payload.pop("faq_items", None)
    if faq_items is not None:
        content.faq_items_json = serialize_faq_items(faq_items)
    for key, value in payload.items():
        if key == "faq_items_json":
            continue
        if hasattr(content, key):
            setattr(content, key, value)


def site_content_to_out(content: models.SiteContent) -> schemas.SiteContentOut:
    return schemas.SiteContentOut(
        id=content.id,
        hero_badge_en=content.hero_badge_en,
        hero_badge_ar=content.hero_badge_ar,
        hero_title_en=content.hero_title_en,
        hero_title_ar=content.hero_title_ar,
        hero_subtitle_en=content.hero_subtitle_en,
        hero_subtitle_ar=content.hero_subtitle_ar,
        hero_cta_en=content.hero_cta_en,
        hero_cta_ar=content.hero_cta_ar,
        hero_secondary_en=content.hero_secondary_en,
        hero_secondary_ar=content.hero_secondary_ar,
        hero_note_en=content.hero_note_en,
        hero_note_ar=content.hero_note_ar,
        hero_background_type=content.hero_background_type,
        hero_background_url=content.hero_background_url,
        hero_side_image_url=content.hero_side_image_url,
        vehicles_title_en=content.vehicles_title_en,
        vehicles_title_ar=content.vehicles_title_ar,
        vehicles_subtitle_en=content.vehicles_subtitle_en,
        vehicles_subtitle_ar=content.vehicles_subtitle_ar,
        routes_title_en=content.routes_title_en,
        routes_title_ar=content.routes_title_ar,
        routes_subtitle_en=content.routes_subtitle_en,
        routes_subtitle_ar=content.routes_subtitle_ar,
        why_title_en=content.why_title_en,
        why_title_ar=content.why_title_ar,
        why_image_url=content.why_image_url,
        availability_live_en=content.availability_live_en,
        availability_live_ar=content.availability_live_ar,
        availability_title_en=content.availability_title_en,
        availability_title_ar=content.availability_title_ar,
        availability_subtitle_en=content.availability_subtitle_en,
        availability_subtitle_ar=content.availability_subtitle_ar,
        site_name_en=content.site_name_en,
        site_name_ar=content.site_name_ar,
        footer_text_en=content.footer_text_en,
        footer_text_ar=content.footer_text_ar,
        nav_book_en=content.nav_book_en,
        nav_book_ar=content.nav_book_ar,
        footer_admin_en=content.footer_admin_en,
        footer_admin_ar=content.footer_admin_ar,
        how_title_en=content.how_title_en,
        how_title_ar=content.how_title_ar,
        how_step1_title_en=content.how_step1_title_en,
        how_step1_title_ar=content.how_step1_title_ar,
        how_step1_text_en=content.how_step1_text_en,
        how_step1_text_ar=content.how_step1_text_ar,
        how_step2_title_en=content.how_step2_title_en,
        how_step2_title_ar=content.how_step2_title_ar,
        how_step2_text_en=content.how_step2_text_en,
        how_step2_text_ar=content.how_step2_text_ar,
        how_step3_title_en=content.how_step3_title_en,
        how_step3_title_ar=content.how_step3_title_ar,
        how_step3_text_en=content.how_step3_text_en,
        how_step3_text_ar=content.how_step3_text_ar,
        how_step4_title_en=content.how_step4_title_en,
        how_step4_title_ar=content.how_step4_title_ar,
        how_step4_text_en=content.how_step4_text_en,
        how_step4_text_ar=content.how_step4_text_ar,
        transfer_title_en=content.transfer_title_en,
        transfer_title_ar=content.transfer_title_ar,
        transfer_bank_name_en=content.transfer_bank_name_en,
        transfer_bank_name_ar=content.transfer_bank_name_ar,
        transfer_account_name_en=content.transfer_account_name_en,
        transfer_account_name_ar=content.transfer_account_name_ar,
        transfer_account_number=content.transfer_account_number,
        transfer_iban=content.transfer_iban,
        transfer_mobile_wallet_en=content.transfer_mobile_wallet_en,
        transfer_mobile_wallet_ar=content.transfer_mobile_wallet_ar,
        transfer_mobile_number=content.transfer_mobile_number,
        transfer_notes_en=content.transfer_notes_en,
        transfer_notes_ar=content.transfer_notes_ar,
        transfer_show_title=content.transfer_show_title,
        transfer_show_bank_name=content.transfer_show_bank_name,
        transfer_show_account_name=content.transfer_show_account_name,
        transfer_show_account_number=content.transfer_show_account_number,
        transfer_show_iban=content.transfer_show_iban,
        transfer_show_mobile_wallet=content.transfer_show_mobile_wallet,
        transfer_show_mobile_number=content.transfer_show_mobile_number,
        transfer_show_notes=content.transfer_show_notes,
        faq_title_en=getattr(content, "faq_title_en", None) or "Frequently Asked Questions",
        faq_title_ar=getattr(content, "faq_title_ar", None) or "الأسئلة الشائعة",
        faq_items=parse_faq_items_json(getattr(content, "faq_items_json", None)),
        contact_phone=getattr(content, "contact_phone", None) or "",
        contact_whatsapp=getattr(content, "contact_whatsapp", None) or "",
    )