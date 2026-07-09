"""Admin role and per-module permission helpers."""

from __future__ import annotations

import json
from typing import Any

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from . import auth, models
from .database import get_db

ROLE_SUPER_ADMIN = "super_admin"
ROLE_ADMIN = "admin"
ROLE_SCANNER = "scanner"

MODULES = (
    "overview",
    "bookings",
    "promo",
    "transfer",
    "content",
    "fleet",
    "paths",
    "vehicles",
    "users",
)

ACTIONS = ("view", "create", "edit", "delete")

TRANSFER_FIELD_PREFIX = "transfer_"


def full_permissions() -> dict[str, dict[str, bool]]:
    return {module: {action: True for action in ACTIONS} for module in MODULES}


def empty_permissions() -> dict[str, dict[str, bool]]:
    return {module: {action: False for action in ACTIONS} for module in MODULES}


def normalize_permissions(raw: Any) -> dict[str, dict[str, bool]]:
    base = empty_permissions()
    if not isinstance(raw, dict):
        return base
    for module in MODULES:
        module_value = raw.get(module)
        if not isinstance(module_value, dict):
            continue
        for action in ACTIONS:
            base[module][action] = bool(module_value.get(action))
    return base


def permissions_from_admin(admin: models.Admin) -> dict[str, dict[str, bool]]:
    if is_super_admin(admin):
        return full_permissions()
    raw = getattr(admin, "permissions", None)
    if not raw:
        return full_permissions()
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return full_permissions()
        return normalize_permissions(parsed)
    return normalize_permissions(raw)


def permissions_to_json(permissions: dict[str, dict[str, bool]]) -> str:
    return json.dumps(normalize_permissions(permissions), separators=(",", ":"))


def is_super_admin(admin: models.Admin) -> bool:
    role = getattr(admin, "role", None) or ROLE_ADMIN
    return role == ROLE_SUPER_ADMIN


def is_panel_admin(admin: models.Admin) -> bool:
    role = getattr(admin, "role", None) or ROLE_ADMIN
    return role in {ROLE_SUPER_ADMIN, ROLE_ADMIN}


def has_permission(admin: models.Admin, module: str, action: str) -> bool:
    if is_super_admin(admin):
        return True
    permissions = permissions_from_admin(admin)
    module_perms = permissions.get(module, {})
    return bool(module_perms.get(action))


def require_permission(module: str, action: str):
    def _dependency(
        admin: models.Admin = Depends(auth.get_current_admin),
    ) -> models.Admin:
        if not has_permission(admin, module, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have permission to {action} {module}.",
            )
        return admin

    return _dependency


def require_any_permission(modules: tuple[str, ...], action: str):
    def _dependency(
        admin: models.Admin = Depends(auth.get_current_admin),
    ) -> models.Admin:
        if any(has_permission(admin, module, action) for module in modules):
            return admin
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission for this action.",
        )

    return _dependency


def require_super_admin():
    def _dependency(
        admin: models.Admin = Depends(auth.get_current_admin),
    ) -> models.Admin:
        if not is_super_admin(admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the main administrator can manage admin users.",
            )
        return admin

    return _dependency


def can_edit_site_content(admin: models.Admin) -> bool:
    return has_permission(admin, "content", "edit") or has_permission(admin, "transfer", "edit")


def filter_site_content_payload(
    admin: models.Admin,
    payload: dict[str, Any],
) -> dict[str, Any]:
    if is_super_admin(admin):
        return payload
    content_edit = has_permission(admin, "content", "edit")
    transfer_edit = has_permission(admin, "transfer", "edit")
    if content_edit and transfer_edit:
        return payload
    allowed: dict[str, Any] = {}
    for key, value in payload.items():
        is_transfer_field = key.startswith(TRANSFER_FIELD_PREFIX)
        if is_transfer_field and transfer_edit:
            allowed[key] = value
        elif not is_transfer_field and content_edit:
            allowed[key] = value
    return allowed


def permissions_to_schema(admin: models.Admin) -> schemas.AdminPermissionsOut:
    from . import schemas

    raw = permissions_from_admin(admin)
    return schemas.AdminPermissionsOut(**raw)


def admin_user_out(admin: models.Admin) -> schemas.AdminUserOut:
    from . import schemas

    return schemas.AdminUserOut(
        id=admin.id,
        username=admin.username,
        role=admin.role,
        is_super_admin=is_super_admin(admin),
        permissions=permissions_to_schema(admin),
        created_at=admin.created_at,
    )


def auth_token_payload(admin: models.Admin) -> dict:
    role = auth.admin_role(admin)
    return {
        "access_token": auth.create_access_token(admin.username, role),
        "token_type": "bearer",
        "role": role,
        "username": admin.username,
        "is_super_admin": is_super_admin(admin),
        "permissions": permissions_to_schema(admin),
    }


def count_super_admins(db: Session, exclude_id: int | None = None) -> int:
    query = db.query(models.Admin).filter(models.Admin.role == ROLE_SUPER_ADMIN)
    if exclude_id is not None:
        query = query.filter(models.Admin.id != exclude_id)
    return query.count()