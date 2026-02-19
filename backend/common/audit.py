"""Audit logging helpers with PII masking."""

from __future__ import annotations

import re
from typing import Any, Mapping, MutableMapping

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog

EMAIL_RE = re.compile(r"(?P<local>[A-Za-z0-9._%+-]+)@(?P<domain>[A-Za-z0-9.-]+\.[A-Za-z]{2,})")
PHONE_RE = re.compile(r"(\+?\d[\d\s\-]{7,}\d)")


def _mask_email(value: str) -> str:
    match = EMAIL_RE.search(value)
    if not match:
        return value
    local = match.group("local")
    if len(local) <= 2:
        masked = "*" * len(local)
    else:
        masked = local[0] + "***" + local[-1]
    return EMAIL_RE.sub(f"{masked}@{match.group('domain')}", value)


def _mask_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) <= 4:
        return "***"
    return f"{digits[:2]}***{digits[-2:]}"


def mask_pii(obj: Any) -> Any:
    """Mask e-mail and phone values within mappings."""
    if isinstance(obj, str):
        masked = _mask_email(obj)
        masked = PHONE_RE.sub(_mask_phone, masked)
        return masked
    if isinstance(obj, Mapping):
        return {key: mask_pii(value) for key, value in obj.items()}
    if isinstance(obj, list):
        return [mask_pii(item) for item in obj]
    return obj


async def audit_log(
    session: AsyncSession,
    *,
    tenant_id: str | None,
    actor: str,
    action: str,
    meta: MutableMapping[str, Any] | None = None,
    actor_ip: str | None = None,
    origin: str | None = None,
) -> None:
    """Persist an audit log entry."""
    payload: dict[str, Any] = {}
    if meta:
        payload.update(meta)
    if actor_ip:
        payload["actor_ip"] = actor_ip
    if origin:
        payload["origin"] = origin

    log = AuditLog(
        tenant_id=tenant_id,
        action=action,
        entity="widget_reservations",
        meta_json=mask_pii(payload),
        actor_user_id=None,
    )
    # store actor info inside meta for compatibility
    log.meta_json["actor"] = actor
    session.add(log)
    await session.flush()
