"""Reservation related service helpers."""

from datetime import datetime, timezone
from typing import Optional
import logging

from sqlalchemy import and_, func, or_, select
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Reservation, ReservationStatus, Storage, StorageStatus, Tenant

# Backward compatibility
Locker = Storage
from ..schemas import ReservationCreate
from .audit import record_audit
from .limits import get_plan_limits_for_tenant
from .quota_checks import check_reservation_quota
from .pricing_calculator import calculate_reservation_price
from .storage_availability import is_storage_available

logger = logging.getLogger(__name__)


async def create_reservation(
    session: AsyncSession,
    *,
    tenant_id: str,
    storage: Storage,
    payload: ReservationCreate,
    actor_user_id: Optional[str],
    source: str,
) -> Reservation:
    """Create a reservation for the given tenant and storage unit."""
    
    # Backward compatibility: accept locker parameter
    locker = storage
    if payload.start_at >= payload.end_at:
        raise ValueError("Invalid reservation window")

    # Check quota from metadata (new system) first
    can_create, quota_limit, current_count = await check_reservation_quota(session, tenant_id)
    if not can_create and quota_limit is not None:
        raise ValueError(f"Max rezervasyon kotasına ulaşıldı. Mevcut: {current_count}, Limit: {quota_limit}")
    
    # Fallback to plan limits (backward compatibility)
    limits = await get_plan_limits_for_tenant(session, tenant_id)
    if limits.max_active_reservations is not None:
        active_reservation_count = await session.scalar(
            select(func.count()).select_from(Reservation).where(
                Reservation.tenant_id == tenant_id,
                Reservation.status == ReservationStatus.ACTIVE.value,
            )
        )
        if active_reservation_count >= limits.max_active_reservations:
            raise ValueError("Plan limit reached: maximum active reservations")
    if limits.max_reservations_total is not None and quota_limit is None:
        total_reservation_count = await session.scalar(
            select(func.count()).select_from(Reservation).where(
                Reservation.tenant_id == tenant_id,
            )
        )
        if total_reservation_count >= limits.max_reservations_total:
            raise ValueError("Plan limit reached: maximum total reservations")

    # Check for overlapping reservations with blocking statuses (RESERVED, ACTIVE)
    # Use start_datetime/end_datetime if available, otherwise fall back to start_at/end_at
    start_dt = payload.start_datetime if payload.start_datetime else payload.start_at
    end_dt = payload.end_datetime if payload.end_datetime else payload.end_at
    
    # Validate datetime window
    if start_dt >= end_dt:
        raise ValueError("start_datetime must be before end_datetime")
    
    # Use is_storage_available helper function for cleaner code
    if not await is_storage_available(session, storage.id, start_dt, end_dt):
        raise ValueError("Storage already reserved for this time window")
    
    # Calculate duration in hours
    duration_seconds = (end_dt - start_dt).total_seconds()
    duration_hours = max(duration_seconds / 3600.0, 0.01)  # Minimum 0.01 hours

    # Varsayılan saatlik ücret (tenant veya payload)
    tenant = await session.get(Tenant, tenant_id)
    hourly_rate = getattr(payload, 'hourly_rate', None)
    if hourly_rate is None:
        hourly_rate = tenant.default_hourly_rate if tenant and tenant.default_hourly_rate else 1500  # Default 15.00 TRY

    luggage_count = getattr(payload, 'luggage_count', None) or payload.baggage_count or 1

    # Ücreti fiyatlandırma kuralına göre hesapla; hata olursa mevcut mantıkla devam et
    pricing_result = None
    try:
        pricing_result = await calculate_reservation_price(
            session=session,
            tenant_id=tenant_id,
            start_datetime=start_dt,
            end_datetime=end_dt,
            baggage_count=luggage_count,
            location_id=storage.location_id,
            storage_id=storage.id,
        )
    except Exception as pricing_exc:  # pragma: no cover - log ve devam
        logger.warning(f"Pricing hesaplama hatası, varsayılanla devam: {pricing_exc}")

    price_via_pricing = pricing_result.total_minor if pricing_result else None

    # Calculate estimated total price
    estimated_total_price = price_via_pricing if price_via_pricing is not None else int(duration_hours * hourly_rate)

    # Eğer fiyatlandırma kuralı günlük/haftalık ise gösterim için efektif saatlik ücret türet
    if pricing_result and duration_hours > 0:
        hourly_rate = int(pricing_result.hourly_rate_minor or price_via_pricing / duration_hours)
    
    # Use estimated_total_price as amount_minor if not provided or pricing kuralı geldiyse onu kullan
    amount_minor = price_via_pricing if price_via_pricing is not None else payload.amount_minor
    if amount_minor is None:
        amount_minor = estimated_total_price

    currency = pricing_result.currency if pricing_result else (payload.currency or "TRY")
    qr_code = f"QR-{storage.id[:6]}-{datetime.now(timezone.utc).timestamp():.0f}"

    # Map customer fields - support both old and new field names
    customer_name = payload.full_name or payload.customer_name
    customer_phone = payload.phone_number or payload.customer_phone
    customer_email = getattr(payload, 'customer_email', None)
    reservation = Reservation(
        tenant_id=tenant_id,
        storage_id=storage.id,
        customer_name=customer_name,
        full_name=customer_name,
        customer_phone=customer_phone,
        phone_number=customer_phone,
        customer_email=customer_email,
        tc_identity_number=getattr(payload, 'tc_identity_number', None),
        passport_number=getattr(payload, 'passport_number', None),
        hotel_room_number=getattr(payload, 'hotel_room_number', None),
        start_at=start_dt,  # Backward compatibility
        end_at=end_dt,  # Backward compatibility
        start_datetime=start_dt,
        end_datetime=end_dt,
        duration_hours=float(duration_hours),
        hourly_rate=hourly_rate,
        estimated_total_price=estimated_total_price,
        status=ReservationStatus.RESERVED.value,  # New reservations start as RESERVED
        amount_minor=amount_minor,
        currency=currency,
        qr_code=qr_code,
        created_by_user_id=actor_user_id,
        baggage_count=luggage_count,
        baggage_type=payload.baggage_type,
        weight_kg=payload.weight_kg,
        notes=payload.notes,
        evidence_url=payload.evidence_url,
        handover_by=payload.handover_by,
        handover_at=payload.handover_at,
        returned_by=payload.returned_by,
        returned_at=payload.returned_at,
        kvkk_consent=getattr(payload, 'kvkk_consent', False),
        terms_consent=getattr(payload, 'terms_consent', False),
    )

    session.add(reservation)
    await session.flush()
    
    # Note: Storage status is updated when reservation becomes ACTIVE (luggage dropped off)
    # For RESERVED status, storage remains IDLE until luggage is actually received
    await session.flush()
    
    # Create payment record automatically
    # Payment will be created in PENDING status
    # For gateway mode, checkout session will be created
    # For POS mode, payment can be confirmed later via confirm-pos endpoint
    try:
        from .payment_service import create_payment_for_reservation
        
        # Determine payment mode from tenant config or default to GATEWAY_DEMO
        # tenant already fetched above, reuse it if available
        if tenant is None:
            tenant = await session.get(Tenant, tenant_id)
        tenant_metadata = tenant.metadata_ if tenant else {}
        payment_mode = tenant_metadata.get("payment_mode", "GATEWAY_DEMO")
        
        payment = await create_payment_for_reservation(
            session,
            reservation=reservation,
            storage=storage,
            mode=payment_mode,
            create_checkout_session=(payment_mode == "GATEWAY_DEMO"),
        )
        await session.flush()
        
        logger.info(
            f"Auto-created payment for reservation: reservation_id={reservation.id}, "
            f"payment_id={payment.id}, mode={payment_mode}"
        )
    except Exception as exc:
        logger.error(f"Failed to create payment for reservation: {exc}", exc_info=True)
        # Don't fail reservation creation if payment creation fails
        # Payment can be created manually later

    await record_audit(
        session,
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        action=f"reservation.create.{source}",
        entity="reservations",
        entity_id=reservation.id,
        meta={
            "storage_id": reservation.storage_id,
            "locker_id": reservation.locker_id,  # Backward compatibility
            "start_at": reservation.start_at.isoformat(),
            "end_at": reservation.end_at.isoformat(),
            "amount_minor": reservation.amount_minor,
            "source": source,
        },
    )

    await session.commit()
    await session.refresh(reservation)
    return reservation


async def mark_reservation_handover(
    session: AsyncSession,
    *,
    reservation: Reservation,
    actor_user_id: Optional[str],
    handover_by: Optional[str],
    handover_at: Optional[datetime],
    evidence_url: Optional[str],
    notes: Optional[str],
    source: str = "partner",
) -> Reservation:
    if reservation.status != ReservationStatus.ACTIVE.value:
        raise ValueError("Reservation not active")

    if handover_at and handover_at < reservation.start_at:
        raise ValueError("Invalid handover timestamp")

    reservation.handover_by = handover_by
    reservation.handover_at = handover_at or datetime.now(timezone.utc)
    reservation.evidence_url = evidence_url or reservation.evidence_url
    if notes:
        reservation.notes = notes

    await record_audit(
        session,
        tenant_id=reservation.tenant_id,
        actor_user_id=actor_user_id,
        action="reservation.handover",
        entity="reservations",
        entity_id=reservation.id,
        meta={
            "handover_by": reservation.handover_by,
            "handover_at": reservation.handover_at.isoformat() if reservation.handover_at else None,
            "source": source,
        },
    )

    await session.commit()
    await session.refresh(reservation)
    return reservation


async def mark_reservation_returned(
    session: AsyncSession,
    *,
    reservation: Reservation,
    actor_user_id: Optional[str],
    returned_by: Optional[str],
    returned_at: Optional[datetime],
    evidence_url: Optional[str],
    notes: Optional[str],
    source: str = "partner",
) -> Reservation:
    """Legacy return function - use mark_luggage_returned for new code."""
    if reservation.status != ReservationStatus.ACTIVE.value:
        raise ValueError("Reservation not active")

    reservation.status = ReservationStatus.COMPLETED.value
    reservation.returned_by = returned_by
    reservation.returned_at = returned_at or datetime.now(timezone.utc)
    reservation.evidence_url = evidence_url or reservation.evidence_url
    if notes:
        reservation.notes = notes
    
    # Free the storage
    if reservation.storage:
        from ..models import StorageStatus
        reservation.storage.status = StorageStatus.IDLE.value

    await record_audit(
        session,
        tenant_id=reservation.tenant_id,
        actor_user_id=actor_user_id,
        action="reservation.return",
        entity="reservations",
        entity_id=reservation.id,
        meta={
            "returned_by": reservation.returned_by,
            "returned_at": reservation.returned_at.isoformat() if reservation.returned_at else None,
            "source": source,
        },
    )

    await session.commit()
    await session.refresh(reservation)
    return reservation
