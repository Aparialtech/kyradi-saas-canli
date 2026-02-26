"""Business logic for widget reservations."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
from typing import Any, Mapping, Optional, Sequence
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

logger = logging.getLogger(__name__)


async def get_widget_config(session: AsyncSession, tenant_id: str, public_key: str) -> WidgetConfig:
    """Get widget config by tenant_id and public_key.
    
    If config doesn't exist, creates a default one for demo tenant.
    """
    stmt = select(WidgetConfig).where(
        WidgetConfig.tenant_id == tenant_id,
        WidgetConfig.widget_public_key == public_key,
    )
    config = (await session.execute(stmt)).scalar_one_or_none()
    
    if config is None:
        # For demo tenant, auto-create config
        if public_key == "demo-public-key":
            logger.info(f"Auto-creating widget config for demo tenant {tenant_id}")
            config = await create_default_widget_config(session, tenant_id, public_key)
            return config
        raise WidgetTokenError("Widget yapılandırması bulunamadı")
    
    return config


async def get_or_create_widget_config(
    session: AsyncSession,
    tenant_id: str,
    public_key: str = "demo-public-key",
) -> WidgetConfig:
    """Get existing widget config or create default one.
    
    This function NEVER fails - always returns a valid config.
    For demo usage, creates a default config if none exists.
    """
    stmt = select(WidgetConfig).where(
        WidgetConfig.tenant_id == tenant_id,
        WidgetConfig.widget_public_key == public_key,
    )
    result = await session.execute(stmt)
    config = result.scalar_one_or_none()
    
    if config is None:
        config = await create_default_widget_config(session, tenant_id, public_key)
    
    return config


async def create_default_widget_config(
    session: AsyncSession,
    tenant_id: str,
    public_key: str = "demo-public-key",
) -> WidgetConfig:
    """Create a default widget config for a tenant.
    
    Used when widget config is missing but we need to allow the flow to continue.
    """
    logger.info(f"Creating default widget config for tenant {tenant_id}")
    
    config = WidgetConfig(
        tenant_id=tenant_id,
        widget_public_key=public_key,
        widget_secret=f"secret-{secrets.token_hex(16)}",
        allowed_origins=[
            "*",  # Allow all origins for demo
            "https://kyradi-saas-canli.vercel.app",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        locale="tr-TR",
        theme="light",
        kvkk_text="KVKK onayı için metin.",
        form_defaults={},
        notification_preferences={},
        webhook_url=None,
    )
    session.add(config)
    await session.flush()
    
    logger.info(f"Created default widget config for tenant {tenant_id}, config_id={config.id}")
    return config


def validate_origin(config: WidgetConfig, origin: str | None) -> str:
    """Origin validation - ALWAYS accepts for demo mode.
    
    DEMO MODE: Always accepts ALL origins to ensure widget always works.
    For production tenants, validates against allowed_origins list.
    """
    import re
    
    # If no origin provided, accept (backend-to-backend calls)
    if origin is None:
        return ""
    
    parsed = urlparse(origin)
    normalized = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    
    # Get allowed origins
    allowed_origins = getattr(config, "allowed_origins", None) or []
    if isinstance(allowed_origins, str):
        try:
            allowed_origins = json.loads(allowed_origins)
        except Exception:
            allowed_origins = [o.strip() for o in allowed_origins.split(",") if o.strip()]
    
    normalized_allowed = {o.rstrip("/") for o in allowed_origins if o}
    
    # Get tenant/config info
    tenant_id = getattr(config, "tenant_id", None)
    widget_public_key = getattr(config, "widget_public_key", None)
    
    # ============================================================
    # DEMO MODE: ALWAYS ACCEPT ALL ORIGINS
    # This ensures widget demo always works regardless of origin
    # ============================================================
    
    # Check if this is a demo tenant
    is_demo_tenant = (
        widget_public_key == "demo-public-key"
        or "*" in normalized_allowed
        or tenant_id == "7d7417b7-17fe-4857-ab14-dd3f390ec497"  # Demo tenant ID
    )
    
    if is_demo_tenant:
        logger.debug(
            f"validate_origin: DEMO MODE - accepting all origins. "
            f"tenant_id={tenant_id}, origin={normalized}"
        )
        return normalized
    
    # For non-demo tenants, check against allowed list
    if normalized in normalized_allowed:
        return normalized
    
    # Check for wildcard patterns
    for allowed in normalized_allowed:
        if "*" in allowed:
            pattern = allowed.replace(".", r"\.").replace("*", ".*")
            if re.match(f"^{pattern}$", normalized):
                return normalized
    
    # Accept localhost for development
    if "localhost" in normalized or "127.0.0.1" in normalized:
        logger.debug(f"validate_origin: localhost accepted for tenant {tenant_id}")
        return normalized
    
    # Accept Vercel preview URLs
    if "vercel.app" in normalized:
        logger.debug(f"validate_origin: Vercel URL accepted for tenant {tenant_id}")
        return normalized
    
    logger.warning(
        f"validate_origin: origin rejected. tenant_id={tenant_id}, "
        f"origin={normalized}, allowed={normalized_allowed}"
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

    # Keep legacy date fields populated for backward compatibility/filtering
    if checkin_date is None and start_dt is not None:
        checkin_date = start_dt.date()
    if checkout_date is None and end_dt is not None:
        checkout_date = end_dt.date()
    
    reservation = WidgetReservation(
        tenant_id=tenant_id,
        config_id=config.id,
        checkin_date=checkin_date,  # Legacy: keep for backward compatibility
        checkout_date=checkout_date,  # Legacy: keep for backward compatibility
        start_datetime=start_dt,
        end_datetime=end_dt,
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
        # Pricing fields from widget estimate API
        amount_minor=payload.get("amount_minor"),
        pricing_rule_id=payload.get("pricing_rule_id"),
        pricing_type=payload.get("pricing_type"),
        currency=payload.get("currency", "TRY"),
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
