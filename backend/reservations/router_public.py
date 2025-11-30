"""Public widget endpoints."""

from __future__ import annotations

from typing import Any
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
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
    create_reservation,
    get_widget_config,
    log_reservation_audit,
    send_webhook,
    validate_origin,
)

router = APIRouter(prefix="/public/widget", tags=["widget"])

rate_limiter = RateLimiter(settings.rate_limit_public_per_min)


@router.get("/init", response_model=WidgetInitResponse)
async def init_widget(
    tenant_id: str,
    key: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> WidgetInitResponse:
    origin = request.headers.get("origin") or request.headers.get("referer")
    config = await get_widget_config(session, tenant_id, key)
    normalized_origin = validate_origin(config, origin)

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
    import logging
    import traceback
    logger = logging.getLogger(__name__)
    
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

    try:
        payload_dict = payload.model_dump()
        logger.info(f"Creating widget reservation for tenant {tenant_id}")
        logger.debug(f"Payload start_datetime: {payload_dict.get('start_datetime')}, type: {type(payload_dict.get('start_datetime'))}")
        logger.debug(f"Payload end_datetime: {payload_dict.get('end_datetime')}, type: {type(payload_dict.get('end_datetime'))}")
        logger.debug(f"Payload guest: {payload_dict.get('guest')}")
        
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
        # Note: We try to convert automatically, but if it fails (e.g., no available storage),
        # the user can convert manually later via the demo flow page
        from app.services.widget_conversion import convert_widget_reservation_to_reservation
        
        normal_reservation = None
        conversion_error = None
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
        except ValueError as conv_exc:
            # If conversion fails, still return widget reservation info
            # but log the error - user can convert manually later
            logger.warning(
                f"Failed to auto-convert widget reservation {widget_reservation.id} "
                f"to normal reservation: {conv_exc}. User can convert manually."
            )
            conversion_error = str(conv_exc)
            # Continue with widget reservation only - conversion can be done manually
            normal_reservation = None
        except Exception as conv_exc:
            # Log unexpected conversion errors but don't fail the whole request
            logger.error(
                f"Unexpected error converting widget reservation {widget_reservation.id}: {conv_exc}",
                exc_info=True
            )
            conversion_error = f"Conversion error: {str(conv_exc)}"
            normal_reservation = None
        
        # Calculate amount using pricing service
        from datetime import datetime, timezone
        from app.services.pricing import calculate_reservation_price
        
        if widget_reservation.checkin_date and widget_reservation.checkout_date:
            # Convert date to datetime (start of day for checkin, end of day for checkout)
            start_at = datetime.combine(
                widget_reservation.checkin_date,
                datetime.min.time(),
                tzinfo=timezone.utc,
            )
            end_at = datetime.combine(
                widget_reservation.checkout_date,
                datetime.max.time().replace(microsecond=0),
                tzinfo=timezone.utc,
            )
            amount_minor = await calculate_reservation_price(
                session,
                tenant_id=tenant_id,
                start_at=start_at,
                end_at=end_at,
            )
        else:
            # Default to 1 day if dates not provided
            from datetime import timedelta
            now = datetime.now(timezone.utc)
            start_at = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end_at = start_at + timedelta(days=1)
            amount_minor = await calculate_reservation_price(
                session,
                tenant_id=tenant_id,
                start_at=start_at,
                end_at=end_at,
            )
        
        # Create payment intent if payment provider is specified
        # Default to "fake" provider for demo purposes if not specified
        payment_provider = payload.payment_provider or "fake"
        payment_url = None
        payment_intent_id = None
        payment_required = False
        payment_record = None
        
        # For demo flow, always enable payments if provider is "fake" (demo mode)
        # In production, check settings.payments_enabled
        payments_allowed = settings.payments_enabled or (payment_provider == "fake")
        
        if payment_provider and payments_allowed:
            try:
                payment_required = True
                logger.info(f"Creating payment intent with provider: {payment_provider}, amount: {amount_minor}")
                provider = get_payment_provider(payment_provider)
                payment_data = await provider.create_payment_intent(
                    amount_minor=amount_minor,
                    currency="TRY",
                    metadata={
                        "widget_reservation_id": widget_reservation.id,
                        "reservation_id": normal_reservation.id if normal_reservation else None,
                        "tenant_id": tenant_id,
                        "guest_email": widget_reservation.guest_email,
                    },
                )
                payment_intent_id = payment_data.get("intent_id")
                payment_url = payment_data.get("payment_url")
                logger.info(f"Payment intent created: {payment_intent_id}")
            except Exception as payment_exc:
                logger.error(f"Error creating payment intent: {payment_exc}", exc_info=True)
                # Don't fail the whole request if payment creation fails
                payment_required = False
                payment_intent_id = None
                payment_url = None
            
            # Create payment record - link to normal reservation if available
            # If normal reservation doesn't exist yet, we'll update it later via convert endpoint
            reservation_id_for_payment = normal_reservation.id if normal_reservation else None
            payment_record = Payment(
                tenant_id=tenant_id,
                reservation_id=reservation_id_for_payment,  # May be None if conversion failed
                provider=payment_provider,
                provider_intent_id=payment_intent_id,
                status=PaymentStatus.PENDING.value,
                amount_minor=amount_minor,
                currency="TRY",
                meta={
                    "widget_reservation_id": widget_reservation.id,
                    "guest_email": widget_reservation.guest_email,
                },
            )
            session.add(payment_record)
            await session.flush()
            # Note: If normal_reservation is None, payment.reservation_id will be updated later via convert endpoint
        
        await session.commit()
    except ValueError as exc:
        await session.rollback()
        error_msg = str(exc)
        # If it's a storage availability error, return 400 with helpful message
        if "No available storage" in error_msg or "storage" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Depo bulunamadı: {error_msg}. Lütfen sistem yöneticisine başvurun.",
            ) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg) from exc
    except Exception as exc:
        await session.rollback()
        import logging
        import traceback
        logger = logging.getLogger(__name__)
        error_detail = str(exc)
        error_traceback = traceback.format_exc()
        error_type = type(exc).__name__
        logger.error(f"Unexpected error in widget reservation submission: {error_type}: {error_detail}", exc_info=True)
        logger.error(f"Traceback: {error_traceback}")
        # Always return detailed error message for debugging
        # Include error type and message for better debugging
        error_message = f"Rezervasyon oluşturulurken bir hata oluştu: [{error_type}] {error_detail}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message,
        ) from exc

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
