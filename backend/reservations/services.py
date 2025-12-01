"""Business logic for widget reservations."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any, Mapping, Sequence
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Tenant

from common.audit import audit_log
from common.security import WidgetTokenError

from .availability import check_availability
from .models import WebhookDelivery, WidgetConfig, WidgetReservation


async def get_widget_config(session: AsyncSession, tenant_id: str, public_key: str) -> WidgetConfig:
    stmt = select(WidgetConfig).where(
        WidgetConfig.tenant_id == tenant_id,
        WidgetConfig.widget_public_key == public_key,
    )
    config = (await session.execute(stmt)).scalar_one_or_none()
    if config is None:
        raise WidgetTokenError("Widget yapılandırması bulunamadı")
    return config


def validate_origin(config: WidgetConfig, origin: str | None) -> str:
    """Origin doğrulama - demo tenant için gevşek, diğerleri için sıkı."""
    import logging
    import re
    
    logger = logging.getLogger(__name__)
    
    if origin is None:
        return None  # backend->backend çağrılarında engelleme

    parsed = urlparse(origin)
    normalized = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    allowed_origins = getattr(config, "allowed_origins", None) or []
    # allowed_origins string ise json veya virgül ayrımlı olabilir
    if isinstance(allowed_origins, str):
        try:
            allowed_origins = json.loads(allowed_origins)
        except Exception:
            allowed_origins = [o.strip() for o in allowed_origins.split(",") if o.strip()]

    normalized_allowed = {o.rstrip("/") for o in allowed_origins if o}

    # Check tenant info from config
    tenant = getattr(config, "tenant", None)
    tenant_slug = getattr(tenant, "slug", None) if tenant else None
    is_demo = getattr(tenant, "is_demo", False) if tenant else False
    tenant_id = getattr(config, "tenant_id", None)
    widget_public_key = getattr(config, "widget_public_key", None)
    
    # Demo tenant detection: by slug, is_demo flag, or known demo widget key
    is_demo_tenant = (
        tenant_slug == "demo-hotel" 
        or is_demo 
        or widget_public_key == "demo-public-key"
    )

    # Demo tenant için gevşek kabul - Vercel preview URLs dahil
    if is_demo_tenant:
        # Accept any kyradi-saas-canli Vercel URL pattern
        vercel_pattern = r"https://kyradi-saas-canli[^.]*\.vercel\.app"
        is_vercel_preview = bool(re.match(vercel_pattern, normalized))
        
        if normalized in normalized_allowed or is_vercel_preview:
            logger.debug(
                "validate_origin: demo tenant origin accepted. tenant_id=%s origin=%s",
                tenant_id,
                normalized,
            )
            return normalized
        
        # Accept localhost for development
        if "localhost" in normalized or "127.0.0.1" in normalized:
            logger.debug(
                "validate_origin: demo tenant localhost accepted. tenant_id=%s origin=%s",
                tenant_id,
                normalized,
            )
            return normalized
        
        # Still accept if in allowed list, or warn but accept for demo
        logger.warning(
            "validate_origin: demo tenant origin not in allowed list but accepted. tenant_id=%s origin=%s allowed=%s",
            tenant_id,
            normalized,
            normalized_allowed,
        )
        return normalized

    # For non-demo tenants, strict validation
    if normalized_allowed and normalized in normalized_allowed:
        return normalized
    
    # Check for wildcard patterns in allowed_origins (e.g., *.vercel.app)
    for allowed in normalized_allowed:
        if "*" in allowed:
            # Convert wildcard pattern to regex
            pattern = allowed.replace(".", r"\.").replace("*", ".*")
            if re.match(f"^{pattern}$", normalized):
                return normalized

    logger.warning(
        "validate_origin: origin rejected. tenant_id=%s origin=%s allowed=%s",
        tenant_id,
        normalized,
        normalized_allowed,
    )
    raise WidgetTokenError("Bu domain için yetki bulunmuyor")


async def ensure_tenant_exists(session: AsyncSession, tenant_id: str) -> None:
    stmt = select(Tenant.id).where(Tenant.id == tenant_id)
    if (await session.execute(stmt)).scalar_one_or_none() is None:
        raise WidgetTokenError("Tenant bulunamadı")


async def create_reservation(
    session: AsyncSession,
    *,
    tenant_id: str,
    config: WidgetConfig,
    payload: Mapping[str, Any],
    origin: str,
    user_agent: str | None,
) -> WidgetReservation:
    is_available = await check_availability(
        tenant_id,
        payload.get("checkin_date"),
        payload.get("checkout_date"),
        payload.get("locker_size"),
    )
    if not is_available:
        raise ValueError("Uygunluk bulunamadı")

    # Extract guest info
    guest = payload.get("guest", {})
    guest_name = guest.get("name") or guest.get("full_name")
    guest_email = guest.get("email")
    guest_phone = guest.get("phone") or guest.get("phone_number")
    tc_identity_number = guest.get("tc_identity_number")
    passport_number = guest.get("passport_number")
    
    # Use luggage_count if provided, otherwise baggage_count
    luggage_count = payload.get("luggage_count") or payload.get("baggage_count", 1)
    luggage_type = payload.get("luggage_type")
    luggage_description = payload.get("luggage_description")
    
    # KVKK consent - check both fields for backward compatibility
    kvkk_consent = payload.get("kvkk_consent", False) or payload.get("kvkk_approved", False)
    terms_consent = payload.get("terms_consent", False)
    disclosure_consent = payload.get("disclosure_consent", False)
    
    # Extract datetime fields (prefer new hourly fields, fall back to legacy date fields)
    from datetime import datetime, timezone, date
    start_dt = payload.get("start_datetime")
    end_dt = payload.get("end_datetime")
    checkin_date = payload.get("checkin_date")
    checkout_date = payload.get("checkout_date")
    
    # Parse datetime strings if they come as strings (from JSON)
    if start_dt and isinstance(start_dt, str):
        try:
            start_dt = datetime.fromisoformat(start_dt.replace('Z', '+00:00'))
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid start_datetime format: {start_dt}") from e
    
    if end_dt and isinstance(end_dt, str):
        try:
            end_dt = datetime.fromisoformat(end_dt.replace('Z', '+00:00'))
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid end_datetime format: {end_dt}") from e
    
    # If datetime not provided, convert date to datetime
    if not start_dt and checkin_date:
        if isinstance(checkin_date, str):
            checkin_date = date.fromisoformat(checkin_date)
        start_dt = datetime.combine(checkin_date, datetime.min.time(), tzinfo=timezone.utc)
    if not end_dt and checkout_date:
        if isinstance(checkout_date, str):
            checkout_date = date.fromisoformat(checkout_date)
        end_dt = datetime.combine(checkout_date, datetime.max.time().replace(microsecond=0), tzinfo=timezone.utc)
    
    # If still no datetime, use current time + 1 hour as default
    if not start_dt or not end_dt:
        now = datetime.now(timezone.utc)
        start_dt = now.replace(second=0, microsecond=0)
        end_dt = start_dt.replace(hour=start_dt.hour + 1) if start_dt.hour < 23 else start_dt.replace(day=start_dt.day + 1, hour=0)
    
    reservation = WidgetReservation(
        tenant_id=tenant_id,
        config_id=config.id,
        checkin_date=checkin_date,  # Legacy: keep for backward compatibility
        checkout_date=checkout_date,  # Legacy: keep for backward compatibility
        baggage_count=luggage_count,
        luggage_count=luggage_count,
        locker_size=payload.get("locker_size"),
        guest_name=guest_name,
        full_name=guest_name,
        guest_email=guest_email,
        guest_phone=guest_phone,
        phone_number=guest_phone,
        tc_identity_number=tc_identity_number,
        passport_number=passport_number,
        hotel_room_number=payload.get("hotel_room_number"),
        luggage_type=luggage_type,
        luggage_description=luggage_description,
        notes=payload.get("notes"),
        kvkk_approved=kvkk_consent,
        kvkk_consent=kvkk_consent,
        terms_consent=terms_consent,
        disclosure_consent=disclosure_consent,
        origin=origin,
        user_agent=user_agent,
    )
    session.add(reservation)
    await session.flush()
    return reservation


async def send_webhook(
    session: AsyncSession,
    *,
    reservation: WidgetReservation,
    config: WidgetConfig,
    event_type: str,
) -> None:
    if not config.webhook_url:
        return
    body = {
        "id": reservation.id,
        "event": event_type,
        "tenant_id": reservation.tenant_id,
        "status": reservation.status,
        "guest": {
            "name": reservation.guest_name,
            "email": reservation.guest_email,
            "phone": reservation.guest_phone,
        },
        "baggage_count": reservation.baggage_count,
        "locker_size": reservation.locker_size,
        "created_at": reservation.created_at.isoformat(),
    }
    serialized = json.dumps(body, ensure_ascii=False)
    signature = _sign_webhook(serialized)
    status_code: int | None = None
    error: str | None = None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                config.webhook_url,
                content=serialized.encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "X-Kyradi-Signature": signature,
                },
            )
        status_code = response.status_code
        if status_code >= 400:
            error = response.text[:500]
    except httpx.HTTPError as exc:  # noqa: BLE001
        error = str(exc)

    delivery = WebhookDelivery(
        tenant_id=reservation.tenant_id,
        event_type=event_type,
        target_url=config.webhook_url,
        request_body=body,
        signature=signature,
        status_code=status_code,
        error=error,
    )
    session.add(delivery)
    await session.flush()


def _sign_webhook(payload: str) -> str:
    secret = settings.webhook_signature_secret.encode("utf-8")
    return hmac.new(secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()


async def log_reservation_audit(
    session: AsyncSession,
    *,
    tenant_id: str,
    reservation: WidgetReservation,
    actor_ip: str | None,
    origin: str | None,
) -> None:
    await audit_log(
        session,
        tenant_id=tenant_id,
        actor="widget",
        action="reservation.create",
        actor_ip=actor_ip,
        origin=origin,
        meta={
            "reservation_id": reservation.id,
            "guest_name": reservation.guest_name,
            "guest_email": reservation.guest_email,
            "origin": origin,
        },
    )
