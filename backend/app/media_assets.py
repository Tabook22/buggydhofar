"""Media library helpers for curated Instagram and site assets."""

from __future__ import annotations

from fastapi import HTTPException

from . import models

MEDIA_KIND_IMAGE = "image"
MEDIA_KIND_VIDEO = "video"
MEDIA_KINDS = frozenset({MEDIA_KIND_IMAGE, MEDIA_KIND_VIDEO})

MEDIA_CATEGORY_GALLERY = "gallery"
MEDIA_CATEGORY_HERO = "hero"
MEDIA_CATEGORY_ROUTES = "routes"
MEDIA_CATEGORY_TESTIMONIALS = "testimonials"
MEDIA_CATEGORY_GENERAL = "general"
MEDIA_CATEGORIES = frozenset(
    {
        MEDIA_CATEGORY_GALLERY,
        MEDIA_CATEGORY_HERO,
        MEDIA_CATEGORY_ROUTES,
        MEDIA_CATEGORY_TESTIMONIALS,
        MEDIA_CATEGORY_GENERAL,
    }
)


def normalize_media_kind(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in MEDIA_KINDS:
        raise ValueError("Media kind must be image or video.")
    return normalized


def normalize_category(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in MEDIA_CATEGORIES:
        raise ValueError("Invalid media category.")
    return normalized


def validate_media_payload(
    *,
    category: str,
    media_kind: str,
    url: str,
    thumbnail_url: str | None = None,
) -> tuple[str, str, str, str | None]:
    normalized_category = normalize_category(category)
    normalized_kind = normalize_media_kind(media_kind)
    media_url = url.strip()
    if not media_url:
        raise HTTPException(status_code=400, detail="Media URL is required.")
    thumb = thumbnail_url.strip() if thumbnail_url else None
    if thumb == "":
        thumb = None
    return normalized_category, normalized_kind, media_url, thumb