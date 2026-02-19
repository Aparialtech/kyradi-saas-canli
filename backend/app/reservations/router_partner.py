"""Partner-facing widget reservation endpoints."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import List, Optional

import asyncpg
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select, text
from sqlalchemy.exc import ProgrammingError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import require_tenant_operator, require_tenant_staff
from app.models import Payment, PaymentStatus, Reservation, User
from app.schemas.payment import ReservationPaymentInfo
from app.services.payment_service import get_or_create_payment
from sqlalchemy import cast, String

from .models import WidgetConfig, WidgetReservation
from .schemas import WidgetConfigCreate, WidgetReservationList, WidgetReservationRead, ManualReservationCreate

reservations_router = APIRouter(prefix="/partners/widget-reservations", tags=["reservations"])
config_router = APIRouter(prefix="/partners/widget-config", tags=["reservations"])

logger = logging.getLogger(__name__)

DEFAULT_WIDGET_CONFIG = {
    "widget_public_key": "demo-public-key",
    "widget_secret": "demo-secret-key",
    "allowed_origins": ["*"],
    "locale": "tr-TR",
    "theme": "light",
    "kvkk_text": "Bu sadece demo ortamıdır.",
    "form_defaults": {},
    "notification_preferences": {},
    "webhook_url": "",
}


def _payment_to_response(payment: Payment) -> ReservationPaymentInfo:
    checkout_url = None
    if payment.meta:
        checkout_url = payment.meta.get("checkout_url")
    if not checkout_url and payment.provider_intent_id:
        checkout_url = f"/payments/magicpay/demo/{payment.provider_intent_id}"

    return ReservationPaymentInfo(
        payment_id=payment.id,
        reservation_id=payment.reservation_id,
        status=payment.status,
        amount_minor=payment.amount_minor,
        currency=payment.currency,
        provider=payment.provider,
        mode=payment.mode,
        provider_intent_id=payment.provider_intent_id,
        transaction_id=payment.transaction_id,
        paid_at=payment.paid_at,
        checkout_url=checkout_url,
        meta=payment.meta,
    )


@reservations_router.post("", response_model=WidgetReservationRead)
async def create_manual_reservation(
    payload: ManualReservationCreate,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> WidgetReservationRead:
    """Create a manual reservation from the partner panel."""
    from app.models import Payment, PaymentStatus, PaymentProvider, PaymentMode
    import uuid
    
    # Create the widget reservation
    reservation = WidgetReservation(
        tenant_id=current_user.tenant_id,
        status="confirmed",  # Manual reservations are auto-confirmed
        guest_name=payload.guest_name,
        full_name=payload.guest_name,
        guest_email=payload.guest_email,
        guest_phone=payload.guest_phone,
        phone_number=payload.guest_phone,
        tc_identity_number=payload.tc_identity_number,
        passport_number=payload.passport_number,
        hotel_room_number=payload.hotel_room_number,
        checkin_date=payload.checkin_date,
        checkout_date=payload.checkout_date,
        baggage_count=payload.baggage_count,
        luggage_count=payload.baggage_count,
        luggage_type=payload.luggage_type,
        luggage_description=payload.luggage_description,
        locker_size=payload.locker_size,
        notes=payload.notes,
        origin="panel",  # Mark as created from panel
        kvkk_approved=True,
        kvkk_consent=True,
        terms_consent=True,
        disclosure_consent=True,
        created_at=datetime.now(timezone.utc),
    )
    
    # Handle start/end datetime
    if payload.start_datetime:
        reservation.start_datetime = payload.start_datetime
    if payload.end_datetime:
        reservation.end_datetime = payload.end_datetime
    
    session.add(reservation)
    await session.flush()  # Get the ID
    
    # Create payment if amount is provided
    if payload.amount_minor and payload.amount_minor > 0:
        payment_mode = payload.payment_mode or "CASH"
        payment = Payment(
            id=str(uuid.uuid4()),
            tenant_id=current_user.tenant_id,
            status=PaymentStatus.PAID.value,  # Manual payments are marked as paid
            amount_minor=payload.amount_minor,
            currency="TRY",
            provider=PaymentProvider.POS.value if payment_mode in ["POS", "CASH"] else PaymentProvider.MAGIC_PAY.value,
            mode=payment_mode,
            paid_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
            meta={"widget_reservation_id": reservation.id, "created_by": current_user.email},
        )
        session.add(payment)
    
    await session.commit()
    await session.refresh(reservation)
    
    logger.info("Manual reservation created: id=%s, tenant=%s, by=%s", reservation.id, current_user.tenant_id, current_user.email)
    return WidgetReservationRead.model_validate(reservation)


@reservations_router.get("", response_model=WidgetReservationList)
async def list_widget_reservations(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    origin: Optional[str] = Query(default=None),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> WidgetReservationList:
    filters = [WidgetReservation.tenant_id == current_user.tenant_id]
    if status_filter:
        filters.append(WidgetReservation.status == status_filter)
    if date_from:
        filters.append(WidgetReservation.checkin_date >= date_from)
    if date_to:
        filters.append(WidgetReservation.checkout_date <= date_to)
    if origin:
        filters.append(WidgetReservation.origin == origin)

    stmt = select(WidgetReservation).where(and_(*filters)).order_by(WidgetReservation.created_at.desc())
    reservations = (await session.execute(stmt)).scalars().all()
    return WidgetReservationList(
        items=[WidgetReservationRead.model_validate(res) for res in reservations]
    )


@reservations_router.get("/{reservation_id}", response_model=WidgetReservationRead)
async def get_widget_reservation(
    reservation_id: int,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> WidgetReservationRead:
    reservation = await _get_reservation(session, reservation_id, current_user.tenant_id)
    return WidgetReservationRead.model_validate(reservation)


@reservations_router.get("/{reservation_id}/payment", response_model=ReservationPaymentInfo)
async def get_widget_reservation_payment(
    reservation_id: int,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> ReservationPaymentInfo:
    """Return real payment info for a widget reservation."""
    reservation = await _get_reservation(session, reservation_id, current_user.tenant_id)

    payment_stmt = (
        select(Payment)
        .where(
            Payment.tenant_id == current_user.tenant_id,
            cast(Payment.meta["widget_reservation_id"], String) == str(reservation_id),
        )
        .order_by(Payment.created_at.desc())
        .limit(1)
    )
    payment_result = await session.execute(payment_stmt)
    payment = payment_result.scalar_one_or_none()

    # Fallback: if payment is linked to reservation_id directly
    if not payment and reservation.external_ref:
        fallback_stmt = (
            select(Payment)
            .where(
                Payment.tenant_id == current_user.tenant_id,
                Payment.provider_intent_id == reservation.external_ref,
            )
            .order_by(Payment.created_at.desc())
            .limit(1)
        )
        payment = (await session.execute(fallback_stmt)).scalar_one_or_none()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found for this widget reservation",
        )

    # Refresh amount if missing and we have a linked reservation
    if payment.reservation_id and payment.amount_minor in (None, 0) and payment.status in [PaymentStatus.PENDING.value, PaymentStatus.AUTHORIZED.value]:
        linked_reservation = await session.get(Reservation, payment.reservation_id)
        if linked_reservation:
            try:
                payment, _ = await get_or_create_payment(
                    session,
                    reservation_id=linked_reservation.id,
                    tenant_id=linked_reservation.tenant_id,
                    amount_minor=payment.amount_minor,
                    currency=payment.currency,
                    provider=payment.provider,
                    mode=payment.mode,
                    storage_id=payment.storage_id,
                    metadata=payment.meta,
                    reservation=linked_reservation,
                )
            except Exception as exc:  # pragma: no cover
                logger.error("Failed to refresh widget payment %s: %s", payment.id, exc, exc_info=True)

    await session.commit()
    return _payment_to_response(payment)


@reservations_router.post("/{reservation_id}/confirm", response_model=WidgetReservationRead)
async def confirm_widget_reservation(
    reservation_id: int,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> WidgetReservationRead:
    reservation = await _get_reservation(session, reservation_id, current_user.tenant_id)
    if reservation.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="İptal edilmiş kayıt onaylanamaz")
    reservation.status = "confirmed"
    await session.commit()
    return WidgetReservationRead.model_validate(reservation)


@reservations_router.post("/{reservation_id}/cancel", response_model=WidgetReservationRead)
async def cancel_widget_reservation(
    reservation_id: int,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> WidgetReservationRead:
    """Cancel a widget reservation."""
    reservation = await _get_reservation(session, reservation_id, current_user.tenant_id)
    reservation.status = "cancelled"
    await session.commit()
    return WidgetReservationRead.model_validate(reservation)


@reservations_router.post("/{reservation_id}/complete", response_model=WidgetReservationRead)
async def complete_widget_reservation(
    reservation_id: int,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> WidgetReservationRead:
    """Mark a widget reservation as completed (luggage returned)."""
    reservation = await _get_reservation(session, reservation_id, current_user.tenant_id)
    if reservation.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="İptal edilmiş rezervasyon tamamlanamaz")
    reservation.status = "completed"
    reservation.returned_at = datetime.now()
    reservation.returned_by = current_user.email
    await session.commit()
    return WidgetReservationRead.model_validate(reservation)


@reservations_router.post("/{reservation_id}/return", response_model=WidgetReservationRead)
async def return_widget_reservation(
    reservation_id: int,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> WidgetReservationRead:
    """Mark a widget reservation luggage as returned."""
    reservation = await _get_reservation(session, reservation_id, current_user.tenant_id)
    if reservation.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="İptal edilmiş rezervasyon tamamlanamaz")
    reservation.status = "completed"
    reservation.returned_at = datetime.now()
    reservation.returned_by = current_user.email
    await session.commit()
    return WidgetReservationRead.model_validate(reservation)


@reservations_router.post("/{reservation_id}/ensure-payment")
async def ensure_widget_reservation_payment(
    reservation_id: int,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Check/ensure payment for a widget reservation."""
    reservation = await _get_reservation(session, reservation_id, current_user.tenant_id)
    # Widget reservations may or may not have payments
    # Return the reservation info with payment status
    return {
        "id": reservation.id,
        "status": reservation.status,
        "payment_status": getattr(reservation, 'payment_status', 'unknown'),
        "amount_minor": getattr(reservation, 'estimated_total_price', 0) or 0,
        "currency": "TRY",
        "message": "Ödeme bilgisi kontrol edildi"
    }


from pydantic import BaseModel, Field
from typing import Optional as Opt

class RecordPaymentRequest(BaseModel):
    """Request to record a manual payment."""
    method: str = Field(default="cash", description="Payment method: cash, pos, bank_transfer, magicpay")
    notes: Opt[str] = Field(default=None, description="Optional notes about the payment")


@reservations_router.post("/{reservation_id}/payments", response_model=ReservationPaymentInfo)
async def record_widget_reservation_payment(
    reservation_id: int,
    payload: RecordPaymentRequest,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> ReservationPaymentInfo:
    """Record a manual payment for a widget reservation.
    
    This endpoint is used to record payments made via:
    - cash: Nakit ödeme
    - pos: Otelin kendi POS cihazı
    - bank_transfer: Havale/EFT
    - magicpay: Online ödeme (will redirect to MagicPay)
    """
    from app.models import PaymentProvider, PaymentMode
    import uuid
    
    reservation = await _get_reservation(session, reservation_id, current_user.tenant_id)
    
    # Map method string to PaymentMode
    method_to_mode = {
        "cash": PaymentMode.CASH.value,
        "pos": PaymentMode.POS.value,
        "bank_transfer": PaymentMode.POS.value,
        "magicpay": PaymentMode.GATEWAY_DEMO.value,
    }
    
    method_to_provider = {
        "cash": "CASH",
        "pos": "POS",
        "bank_transfer": "BANK_TRANSFER",
        "magicpay": PaymentProvider.MAGIC_PAY.value,
    }
    
    mode = method_to_mode.get(payload.method.lower(), PaymentMode.CASH.value)
    provider = method_to_provider.get(payload.method.lower(), "CASH")
    
    # Calculate amount from reservation
    amount = reservation.amount_minor or getattr(reservation, 'estimated_total_price', 0) or 0
    
    # Create payment record
    payment = Payment(
        id=str(uuid.uuid4()),
        tenant_id=current_user.tenant_id,
        status=PaymentStatus.PAID.value if payload.method.lower() in ["cash", "pos", "bank_transfer"] else PaymentStatus.PENDING.value,
        amount_minor=amount,
        currency="TRY",
        provider=provider,
        mode=mode,
        paid_at=datetime.now(timezone.utc) if payload.method.lower() in ["cash", "pos", "bank_transfer"] else None,
        created_at=datetime.now(timezone.utc),
        meta={
            "widget_reservation_id": reservation.id,
            "method": payload.method,
            "notes": payload.notes,
            "recorded_by": current_user.email,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    session.add(payment)
    
    # Update reservation status to confirmed for manual payments
    if payload.method.lower() in ["cash", "pos", "bank_transfer"]:
        reservation.status = "confirmed"
    
    await session.commit()
    await session.refresh(payment)
    
    logger.info(
        f"Recorded {payload.method} payment {payment.id} for widget reservation {reservation_id}, "
        f"amount={payment.amount_minor}, status={payment.status}"
    )
    
    return _payment_to_response(payment)


async def _get_reservation(session: AsyncSession, reservation_id: int, tenant_id: str) -> WidgetReservation:
    stmt = select(WidgetReservation).where(
        WidgetReservation.id == reservation_id,
        WidgetReservation.tenant_id == tenant_id,
    )
    reservation = (await session.execute(stmt)).scalar_one_or_none()
    if reservation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rezervasyon bulunamadı")
    return reservation


async def _widget_table_exists(session: AsyncSession) -> bool:
    try:
        result = await session.execute(text("SELECT to_regclass('public.widget_configs')"))
        return bool(result.scalar())
    except (asyncpg.exceptions.UndefinedTableError, ProgrammingError):
        return False


def _as_response(config: WidgetConfig | None, tenant_id: str) -> dict:
    if config is None:
        return {"tenant_id": tenant_id, **DEFAULT_WIDGET_CONFIG}
    return {
        "tenant_id": tenant_id,
        "widget_public_key": config.widget_public_key,
        "widget_secret": config.widget_secret,
        "allowed_origins": config.allowed_origins or [],
        "locale": config.locale or "tr-TR",
        "theme": config.theme or "light",
        "kvkk_text": config.kvkk_text or "",
        "form_defaults": config.form_defaults or {},
        "notification_preferences": config.notification_preferences or {},
        "webhook_url": config.webhook_url or "",
    }


@config_router.get("")
async def get_widget_config_for_partner(
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> dict:
    tenant_id = current_user.tenant_id
    try:
        if not await _widget_table_exists(session):
            return _as_response(None, tenant_id)
        stmt = select(WidgetConfig).where(WidgetConfig.tenant_id == tenant_id)
        config = (await session.execute(stmt)).scalar_one_or_none()
        return _as_response(config, tenant_id)
    except (asyncpg.exceptions.UndefinedTableError, ProgrammingError, SQLAlchemyError) as exc:
        if 'relation "widget_configs"' in str(exc):
            logger.warning("widget-config table missing, returning defaults")
            return _as_response(None, tenant_id)
        raise
    except Exception:
        logger.exception("widget-config: error for tenant_id=%s", tenant_id)
        return _as_response(None, tenant_id)


@config_router.post("", response_model=dict)
async def create_or_update_widget_config(
    payload: WidgetConfigCreate,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> dict:
    tenant_id = current_user.tenant_id
    try:
        if not await _widget_table_exists(session):
            return _as_response(None, tenant_id)
        stmt = select(WidgetConfig).where(WidgetConfig.tenant_id == tenant_id)
        config = (await session.execute(stmt)).scalar_one_or_none()
        if config is None:
            config = WidgetConfig(
                tenant_id=tenant_id,
                widget_public_key=payload.widget_public_key,
                widget_secret=payload.widget_secret,
                allowed_origins=list(payload.allowed_origins),
                locale=payload.locale,
                theme=payload.theme,
                kvkk_text=payload.kvkk_text,
                form_defaults=payload.form_defaults,
                notification_preferences=payload.notification_preferences,
                webhook_url=payload.webhook_url,
            )
            session.add(config)
        else:
            config.widget_public_key = payload.widget_public_key
            config.widget_secret = payload.widget_secret
            config.allowed_origins = list(payload.allowed_origins)
            config.locale = payload.locale
            config.theme = payload.theme
            config.kvkk_text = payload.kvkk_text
            config.form_defaults = payload.form_defaults
            config.notification_preferences = payload.notification_preferences
            config.webhook_url = payload.webhook_url
        await session.commit()
        await session.refresh(config)
        return _as_response(config, tenant_id)
    except (asyncpg.exceptions.UndefinedTableError, ProgrammingError, SQLAlchemyError) as exc:
        if 'relation "widget_configs"' in str(exc):
            logger.warning("widget-config table missing on create/update, returning defaults")
            return _as_response(None, tenant_id)
        raise
    except Exception:
        logger.exception("widget-config: error on create/update for tenant_id=%s", tenant_id)
        return _as_response(None, tenant_id)
