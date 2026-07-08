"""Save and serve uploaded site media (images and videos)."""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

IMAGE_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
VIDEO_MIME_TYPES = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
}
MAX_IMAGE_BYTES = 12 * 1024 * 1024
MAX_VIDEO_BYTES = 80 * 1024 * 1024

PUBLIC_UPLOAD_PREFIX = "/api/uploads"


def upload_root() -> Path:
    configured = os.getenv("MEDIA_UPLOAD_DIR", "").strip()
    if configured:
        root = Path(configured)
    else:
        root = Path(__file__).resolve().parent.parent / "uploads"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _safe_stem(filename: str | None) -> str:
    stem = Path(filename or "upload").stem.lower()
    cleaned = re.sub(r"[^a-z0-9_-]+", "-", stem).strip("-")
    return cleaned[:48] or "upload"


async def save_upload(file: UploadFile, media_kind: str) -> dict[str, str]:
    kind = (media_kind or "image").strip().lower()
    if kind not in {"image", "video"}:
        raise HTTPException(status_code=400, detail="media_kind must be image or video.")

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    allowed = IMAGE_MIME_TYPES if kind == "image" else VIDEO_MIME_TYPES
    extension = allowed.get(content_type)
    if not extension:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported {kind} type. Allowed: {', '.join(sorted(allowed))}.",
        )

    data = await file.read()
    max_bytes = MAX_IMAGE_BYTES if kind == "image" else MAX_VIDEO_BYTES
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(data) > max_bytes:
        limit_mb = max_bytes // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"File is too large. Maximum size is {limit_mb} MB.")

    filename = f"{_safe_stem(file.filename)}-{uuid.uuid4().hex[:12]}{extension}"
    destination = upload_root() / filename
    destination.write_bytes(data)

    return {
        "url": f"{PUBLIC_UPLOAD_PREFIX}/{filename}",
        "filename": filename,
        "media_kind": kind,
        "content_type": content_type,
    }