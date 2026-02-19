"""Public widget endpoints."""

from __future__ import annotations

from typing import Any, Optional
import logging
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.services.payment_providers import get_payment_provider
from app.services.revenue import calculate_settlement
from app.models import Payment, PaymentStatus, Reservation

from common.rate_limit import RateLimitError, RateLimiter
from common.security import WidgetTokenError, create_widget_token, verify_widget_token
from .schemas import ReservationPublicResponse, ReservationSubmit, WidgetInitResponse
from .services import (
    create_default_widget_config,
    create_reservation,
    get_or_create_widget_config,
    get_widget_config,
    log_reservation_audit,
    send_webhook,
    validate_origin,
)

router = APIRouter(prefix="/public/widget", tags=["widget"])
logger = logging.getLogger(__name__)

rate_limiter = RateLimiter(settings.rate_limit_public_per_min)


@router.get("/init", response_model=WidgetInitResponse)
async def init_widget(
    tenant_id: str,
    key: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> WidgetInitResponse:
    """Initialize widget - ALWAYS returns valid config.
    
    For demo tenant, auto-creates widget config if missing.
    Origin validation is permissive for demo mode.
    """
    origin = request.headers.get("origin") or request.headers.get("referer")
    
    # Use get_or_create to ensure config always exists for demo
    try:
        config = await get_widget_config(session, tenant_id, key)
    except Exception as exc:
        # If config not found, create default for demo
        logger.warning(f"Widget config not found, creating default: {exc}")
        config = await get_or_create_widget_config(session, tenant_id, key)
    
    # Validate origin (permissive for demo)
    try:
        normalized_origin = validate_origin(config, origin)
    except Exception as exc:
        logger.warning(f"Origin validation failed but allowing for demo: {exc}")
        normalized_origin = origin or ""

    token = create_widget_token(tenant_id, key, normalized_origin)
    return WidgetInitResponse(
        access_token=token,
        expires_in=settings.jwt_widget_expire_min * 60,
        locale=config.locale,
        theme=config.theme,
        kvkk_text=config.kvkk_text,
    )


@router.post("/reservations", response_model=ReservationPublicResponse)
async def submit_reservation(
    payload: ReservationSubmit,
    request: Request,
    authorization: str = Header(..., alias="Authorization"),
    session: AsyncSession = Depends(get_session),
) -> ReservationPublicResponse:
    """Create a widget reservation with automatic conversion and payment setup.
    
    This endpoint:
    1. Validates the widget token and payload
    2. Creates a WidgetReservation
    3. Automatically converts to a normal Reservation (with storage assignment)
    4. Creates a single Payment record (via widget_conversion)
    5. Returns reservation and payment info
    
    Note: Payment is created ONLY in widget_conversion to avoid duplicates.
    """
    try:
        logger.info(f"Widget reservation request received. Payload keys: {list(payload.model_dump().keys())}")
    except Exception as log_exc:
        logger.warning(f"Error logging payload keys: {log_exc}")
    
    # Extract token from Authorization header
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header bulunamadı")
    
    # Handle both "Bearer token" and just "token" formats
    if authorization.startswith("Bearer "):
        token = authorization.replace("Bearer", "").strip()
    else:
        token = authorization.strip()
    
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Widget token bulunamadı")
    
    try:
        payload_claims = verify_widget_token(token)
        logger.debug(f"Widget token verified for tenant: {payload_claims.get('tenant_id')}")
    except WidgetTokenError as exc:
        logger.warning(f"Widget token verification failed: {exc}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    tenant_id = payload_claims["tenant_id"]
    key_id = payload_claims["key_id"]
    token_origin = payload_claims["origin"]
    request_origin = request.headers.get("origin") or token_origin
    client_ip = request.client.host if request.client else None

    config = await get_widget_config(session, tenant_id, key_id)
    normalized_origin = validate_origin(config, request_origin)
    if normalized_origin != token_origin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Domain eşleşmiyor")

    # Validate consents
    kvkk_consent = payload.kvkk_consent or payload.kvkk_approved
    if not kvkk_consent:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="KVKK onayı zorunlu")
    if not payload.terms_consent:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Kullanım şartları onayı zorunlu")
    
    # Validate dates/datetimes - prefer new datetime fields, fall back to legacy date fields
    from datetime import date, datetime, timezone
    
    start_dt = payload.start_datetime
    end_dt = payload.end_datetime
    
    # Parse datetime strings if they come as strings (Pydantic might pass strings)
    if start_dt and isinstance(start_dt, str):
        try:
            # Handle ISO format with Z or +00:00
            dt_str = start_dt.replace('Z', '+00:00') if 'Z' in start_dt else start_dt
            start_dt = datetime.fromisoformat(dt_str)
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError) as e:
            logger.error(f"Error parsing start_datetime: {start_dt}, error: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Geçersiz başlangıç tarih/saat formatı: {start_dt}"
            ) from e
    
    if end_dt and isinstance(end_dt, str):
        try:
            # Handle ISO format with Z or +00:00
            dt_str = end_dt.replace('Z', '+00:00') if 'Z' in end_dt else end_dt
            end_dt = datetime.fromisoformat(dt_str)
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError) as e:
            logger.error(f"Error parsing end_datetime: {end_dt}, error: {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Geçersiz bitiş tarih/saat formatı: {end_dt}"
            ) from e
    
    # If datetime fields not provided, convert date fields to datetime
    if not start_dt and payload.checkin_date:
        checkin = payload.checkin_date
        if isinstance(checkin, str):
            checkin = date.fromisoformat(checkin)
        start_dt = datetime.combine(checkin, datetime.min.time(), tzinfo=timezone.utc)
    if not end_dt and payload.checkout_date:
        checkout = payload.checkout_date
        if isinstance(checkout, str):
            checkout = date.fromisoformat(checkout)
        end_dt = datetime.combine(checkout, datetime.max.time().replace(microsecond=0), tzinfo=timezone.utc)
    
    if not start_dt or not end_dt:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Giriş ve çıkış tarih/saatleri zorunlu")
    
    if end_dt <= start_dt:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Çıkış tarihi/saati giriş tarihi/saatinden önce olamaz")
    
    now = datetime.now(timezone.utc)
    if start_dt < now:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Giriş tarihi/saati geçmiş bir zaman olamaz")
    
    # Validate minimum duration (at least 0.5 hours)
    duration_seconds = (end_dt - start_dt).total_seconds()
    duration_hours = duration_seconds / 3600.0
    if duration_hours < 0.5:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Minimum süre 30 dakikadır")
    
    # Validate guest info
    if not payload.guest.name and not payload.guest.full_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Ad Soyad zorunlu")
    if not payload.guest.email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="E-posta zorunlu")
    if not payload.guest.phone and not payload.guest.phone_number:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Telefon numarası zorunlu")
    
    # Validate TCKN if provided
    if payload.guest.tc_identity_number:
        tc_identity = payload.guest.tc_identity_number.strip()
        if len(tc_identity) != 11 or not tc_identity.isdigit():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="TC Kimlik No 11 haneli olmalıdır")
    
    # Validate luggage count
    luggage_count = payload.luggage_count or payload.baggage_count or 1
    if luggage_count < 1:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Bavul sayısı en az 1 olmalıdır")

    if settings.widget_hcaptcha_enabled:
        await _verify_captcha(payload.captcha_token, client_ip, payload.payment_provider)

    identity = f"{tenant_id}:{normalized_origin}:{client_ip}"
    try:
        await rate_limiter.check(identity)
    except RateLimitError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc

    # Variables to track flow results
    widget_reservation = None
    normal_reservation = None
    payment_record = None
    conversion_error = None
    
    try:
        payload_dict = payload.model_dump()
        logger.info(f"Creating widget reservation for tenant {tenant_id}")
        
        # Create widget reservation
        widget_reservation = await create_reservation(
            session,
            tenant_id=tenant_id,
            config=config,
            payload=payload_dict,
            origin=normalized_origin,
            user_agent=request.headers.get("user-agent"),
        )
        await session.flush()
        logger.info(f"Widget reservation created: {widget_reservation.id}")
        
        # Convert widget reservation to normal reservation with storage assignment
        # This also creates the payment record (only place where payment is created!)
        from app.services.widget_conversion import convert_widget_reservation_to_reservation
        
        try:
            logger.info(f"Attempting to convert widget reservation {widget_reservation.id} to normal reservation")
            normal_reservation = await convert_widget_reservation_to_reservation(
                session,
                widget_reservation_id=widget_reservation.id,
                tenant_id=tenant_id,
                storage_id=None,  # Auto-assign storage
                preferred_location_id=None,
            )
            await session.flush()
            logger.info(
                f"Auto-converted widget reservation {widget_reservation.id} "
                f"to normal reservation {normal_reservation.id}"
            )
            
            # Get the payment created by widget_conversion
            payment_stmt = select(Payment).where(Payment.reservation_id == normal_reservation.id)
            payment_result = await session.execute(payment_stmt)
            payment_record = payment_result.scalar_one_or_none()
            
            if payment_record:
                logger.info(
                    f"Found payment created by conversion: payment_id={payment_record.id}, "
                    f"checkout_url={payment_record.meta.get('checkout_url') if payment_record.meta else None}"
                )
            else:
                logger.warning(
                    f"No payment found after conversion for reservation {normal_reservation.id}"
                )
                
        except ValueError as conv_exc:
            # If conversion fails, still return widget reservation info
            # but log the error - user can convert manually later
            logger.warning(
                f"Failed to auto-convert widget reservation {widget_reservation.id} "
                f"to normal reservation: {conv_exc}. User can convert manually."
            )
            conversion_error = str(conv_exc)
            normal_reservation = None
        except Exception as conv_exc:
            # Log unexpected conversion errors but don't fail the whole request
            logger.error(
                f"Unexpected error converting widget reservation {widget_reservation.id}: {conv_exc}",
                exc_info=True
            )
            conversion_error = f"Conversion error: {str(conv_exc)}"
            normal_reservation = None
        
        await session.commit()
        
    except ValueError as exc:
        await session.rollback()
        error_msg = str(exc)
        # If it's a storage availability error, return 400 with helpful message
        if "No available storage" in error_msg or "storage" in error_msg.lower() or "depo" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Depo bulunamadı: {error_msg}. Lütfen sistem yöneticisine başvurun.",
            ) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg) from exc
    except Exception as exc:
        await session.rollback()
        import traceback
        error_detail = str(exc)
        error_traceback = traceback.format_exc()
        error_type = type(exc).__name__
        logger.error(
            f"Unexpected error in widget reservation submission: {error_type}: {error_detail}",
            exc_info=True
        )
        # Return user-friendly error, not raw exception
        error_message = "Rezervasyon oluşturulurken bir hata oluştu. Lütfen tekrar deneyin."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message,
        ) from exc

    # Log audit and send webhook
    try:
        await log_reservation_audit(
            session,
            tenant_id=tenant_id,
            reservation=widget_reservation,
            actor_ip=client_ip,
            origin=normalized_origin,
        )
        await session.commit()
        await send_webhook(session, reservation=widget_reservation, config=config, event_type="reservation.created")
        await session.commit()
    except Exception as audit_exc:
        logger.warning(f"Failed to log audit or send webhook: {audit_exc}")
        # Don't fail the response for audit/webhook errors

    # Determine payment info from the payment created by conversion
    payment_required = payment_record is not None
    payment_url = None
    payment_intent_id = None
    
    if payment_record:
        payment_intent_id = payment_record.provider_intent_id
        if payment_record.meta:
            payment_url = payment_record.meta.get("checkout_url")

    return ReservationPublicResponse(
        id=widget_reservation.id,
        status=widget_reservation.status,
        created_at=widget_reservation.created_at,
        payment_required=payment_required,
        payment_url=payment_url,
        payment_intent_id=payment_intent_id,
    )


async def _verify_captcha(token: str | None, ip: str | None, payment_provider: str | None = None) -> None:
    if not settings.widget_hcaptcha_enabled:
        return
    # Skip captcha verification for demo/fake payment provider
    if payment_provider == "fake":
        return
    if not token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Captcha doğrulanamadı")
    if not settings.hcaptcha_secret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Captcha yapılandırması eksik")
    data: dict[str, Any] = {
        "secret": settings.hcaptcha_secret,
        "response": token,
    }
    if ip:
        data["remoteip"] = ip
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post("https://hcaptcha.com/siteverify", data=data)
    payload = response.json()
    if not payload.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Captcha doğrulaması başarısız")

