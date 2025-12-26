"""Reservation endpoints."""

from datetime import datetime, timezone
from typing import List, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...db.session import get_session
from ...dependencies import require_tenant_operator, require_tenant_staff
from ...models import Reservation, ReservationStatus, Storage, StorageStatus, User, Payment, PaymentStatus

logger = logging.getLogger(__name__)

# Backward compatibility
Locker = Storage
from ...schemas import (
    ReservationCreate,
    ReservationRead,
    ReservationStatusResponse,
    ReservationHandoverRequest,
    ReservationReturnRequest,
)
from ...schemas.payment import PaymentRead, ReservationPaymentInfo
from ...services.reservations import (
    create_reservation as create_reservation_service,
    mark_reservation_returned,
    mark_reservation_handover,
)
from ...services.reservation_operations import (
    mark_luggage_received,
    mark_no_show,
    mark_luggage_returned,
    cancel_reservation_operation,
)
from ...services.audit import record_audit
from ...services.payment_service import (
    create_payment_for_reservation,
    get_or_create_payment,
    get_existing_payment,
)

router = APIRouter(prefix="/reservations", tags=["reservations"])
logger = logging.getLogger(__name__)


async def _get_reservation_for_tenant(
    reservation_id: str,
    tenant_id: str,
    session: AsyncSession,
) -> Reservation:
    stmt = (
        select(Reservation)
        .options(selectinload(Reservation.storage).selectinload(Storage.location))
        .where(
            Reservation.id == reservation_id,
            Reservation.tenant_id == tenant_id,
        )
    )
    reservation = (await session.execute(stmt)).scalar_one_or_none()
    if reservation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    return reservation


def _payment_to_response(payment: Payment) -> ReservationPaymentInfo:
    """Serialize Payment into a lightweight response for the UI."""
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


@router.get("", response_model=List[ReservationRead])
async def list_reservations(
    status_filter: Optional[ReservationStatus] = Query(default=None, alias="status"),
    date_from: Optional[datetime] = Query(default=None, alias="from"),
    date_to: Optional[datetime] = Query(default=None, alias="to"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> List[ReservationRead]:
    """List reservations for the tenant with optional filters."""
    stmt = (
        select(Reservation)
        .options(selectinload(Reservation.storage).selectinload(Storage.location))
        .where(Reservation.tenant_id == current_user.tenant_id)
    )
    if status_filter:
        stmt = stmt.where(Reservation.status == status_filter.value)
    if date_from:
        stmt = stmt.where(Reservation.start_at >= date_from)
    if date_to:
        stmt = stmt.where(Reservation.end_at <= date_to)
    stmt = stmt.order_by(Reservation.start_at.desc())

    result = await session.execute(stmt)
    reservations = result.scalars().all()
    
    # Include payment information and storage/location details
    from ...models import Payment, Location
    reservation_reads = []
    for res in reservations:
        storage = res.storage
        location = storage.location if storage else None
        
        # Get payment for this reservation
        payment_stmt = select(Payment).where(
            Payment.reservation_id == res.id,
            Payment.tenant_id == res.tenant_id,
        ).order_by(Payment.created_at.desc()).limit(1)
        payment_result = await session.execute(payment_stmt)
        payment = payment_result.scalar_one_or_none()
        
        # Mask TCKN in response for security
        from app.reservations.validation import mask_tckn
        res_dict = {
            **res.__dict__,
            "tc_identity_number": mask_tckn(res.tc_identity_number) if res.tc_identity_number else None,
            "storage_code": storage.code if storage else None,
            "location_id": location.id if location else None,
            "location_name": location.name if location else None,
        }
        reservation_obj = ReservationRead.model_validate(res_dict)
        if payment:
            # Serialize payment to dict with JSON-compatible values (datetime -> ISO string)
            reservation_obj.payment = PaymentRead.model_validate(payment).model_dump(mode='json')
        reservation_reads.append(reservation_obj)
    
    return reservation_reads


@router.get("/{reservation_id}", response_model=ReservationRead)
async def get_reservation(
    reservation_id: str,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> ReservationRead:
    """Get a single reservation by ID."""
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    
    storage = reservation.storage
    location = storage.location if storage else None
    
    # Get payment for this reservation
    from ...models import Payment
    payment_stmt = select(Payment).where(
        Payment.reservation_id == reservation.id,
        Payment.tenant_id == reservation.tenant_id,
    ).order_by(Payment.created_at.desc()).limit(1)
    payment_result = await session.execute(payment_stmt)
    payment = payment_result.scalar_one_or_none()
    
    # Mask TCKN in response for security
    from app.reservations.validation import mask_tckn
    reservation_dict_data = {
        **reservation.__dict__,
        "tc_identity_number": mask_tckn(reservation.tc_identity_number) if reservation.tc_identity_number else None,
        "storage_code": storage.code if storage else None,
        "location_id": location.id if location else None,
        "location_name": location.name if location else None,
    }
    reservation_obj = ReservationRead.model_validate(reservation_dict_data)
    # Add payment info as a dict (not part of schema to avoid forward reference)
    if payment:
        # Serialize payment to dict with JSON-compatible values (datetime -> ISO string)
        reservation_obj.payment = PaymentRead.model_validate(payment).model_dump(mode='json')
    else:
        reservation_obj.payment = None
    
    return reservation_obj


@router.get("/{reservation_id}/payment", response_model=ReservationPaymentInfo)
async def get_reservation_payment(
    reservation_id: str,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> ReservationPaymentInfo:
    """Return the real payment status/details for a reservation."""
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)

    payment = await get_existing_payment(session, reservation.id)

    # If no payment exists, create one using centralized pricing
    if not payment:
        payment = await create_payment_for_reservation(
            session,
            reservation=reservation,
            storage=reservation.storage,
            create_checkout_session=True,
        )
    else:
        # Refresh amount if it was missing/zero
        if payment.amount_minor in (None, 0) and payment.status in [PaymentStatus.PENDING.value, PaymentStatus.AUTHORIZED.value]:
            try:
                payment, _ = await get_or_create_payment(
                    session,
                    reservation_id=reservation.id,
                    tenant_id=reservation.tenant_id,
                    amount_minor=payment.amount_minor,
                    currency=payment.currency,
                    provider=payment.provider,
                    mode=payment.mode,
                    storage_id=payment.storage_id,
                    metadata=payment.meta,
                    reservation=reservation,
                )
            except Exception as exc:  # pragma: no cover - safety log
                logger.error("Failed to refresh payment amount for reservation %s: %s", reservation.id, exc, exc_info=True)

    await session.commit()
    return _payment_to_response(payment)


@router.post("", response_model=ReservationRead, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    payload: ReservationCreate,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> ReservationRead:
    """Create a reservation if the storage unit is available."""
    # Handle both storage_id and locker_id for backward compatibility
    storage_id = getattr(payload, "storage_id", None) or getattr(payload, "locker_id", None)
    if not storage_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="storage_id or locker_id required")
    
    storage = await session.get(Storage, storage_id)
    if storage is None or storage.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storage not found")

    try:
        reservation = await create_reservation_service(
            session,
            tenant_id=current_user.tenant_id,
            storage=storage,
            payload=payload,
            actor_user_id=current_user.id,
            source="partner",
        )
    except ValueError as exc:
        message = str(exc)
        logger.warning(f"ValueError in reservation creation: {message} (tenant={current_user.tenant_id}, user={current_user.id})")
        if "Plan limit" in message:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message) from exc
        if "Storage already reserved" in message or "Locker already reserved" in message:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from exc

    return ReservationRead.model_validate(reservation)


@router.post("/{reservation_id}/cancel", response_model=ReservationStatusResponse)
async def cancel_reservation(
    reservation_id: str,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> ReservationStatusResponse:
    """Cancel an active or reserved reservation.
    
    This endpoint:
    1. Marks the reservation as CANCELLED
    2. Releases the associated storage (sets to IDLE)
    3. Marks pending payments as CANCELLED
    
    Idempotent: calling on already cancelled reservation returns success.
    """
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    
    # Idempotent: if already cancelled, just return success
    if reservation.status == ReservationStatus.CANCELLED.value:
        logger.info(f"Reservation {reservation_id} already cancelled, returning success")
        return ReservationStatusResponse(id=reservation.id, status=ReservationStatus.CANCELLED)
    
    # Only active or reserved reservations can be cancelled
    allowed_statuses = [ReservationStatus.ACTIVE.value, ReservationStatus.RESERVED.value]
    if reservation.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel reservation with status '{reservation.status}'. Only active or reserved reservations can be cancelled."
        )

    reservation.status = ReservationStatus.CANCELLED.value
    
    # Release the associated storage
    if reservation.storage_id:
        storage = await session.get(Storage, reservation.storage_id)
        if storage and storage.status == StorageStatus.OCCUPIED.value:
            storage.status = StorageStatus.IDLE.value
            logger.info(f"Released storage {storage.id} (code: {storage.code}) for cancelled reservation {reservation_id}")
    
    # Mark pending payment as cancelled
    payment_stmt = select(Payment).where(
        Payment.reservation_id == reservation_id,
        Payment.status == PaymentStatus.PENDING.value,
    )
    payment_result = await session.execute(payment_stmt)
    pending_payment = payment_result.scalar_one_or_none()
    if pending_payment:
        pending_payment.status = PaymentStatus.CANCELLED.value
        logger.info(f"Cancelled pending payment {pending_payment.id} for reservation {reservation_id}")
    
    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="reservation.cancel",
        entity="reservations",
        entity_id=reservation.id,
    )
    await session.commit()
    
    logger.info(f"Reservation {reservation_id} cancelled by user {current_user.email}")
    return ReservationStatusResponse(id=reservation.id, status=ReservationStatus.CANCELLED)


@router.post("/{reservation_id}/complete", response_model=ReservationStatusResponse)
async def complete_reservation(
    reservation_id: str,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> ReservationStatusResponse:
    """Mark a reservation as completed (delivered).
    
    This endpoint:
    1. Marks the reservation as COMPLETED
    2. Releases the associated storage (sets to IDLE)
    3. Records the returned_by and returned_at fields
    
    Idempotent: calling on already completed reservation returns success.
    """
    try:
        reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error fetching reservation {reservation_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cannot fetch reservation: {str(exc)}"
        )
    
    # Idempotent: if already completed, just return success
    if reservation.status == ReservationStatus.COMPLETED.value:
        logger.info(f"Reservation {reservation_id} already completed, returning success")
        return ReservationStatusResponse(id=reservation.id, status=ReservationStatus.COMPLETED)
    
    # Allow completing RESERVED or ACTIVE reservations
    allowed_statuses = [ReservationStatus.RESERVED.value, ReservationStatus.ACTIVE.value]
    if reservation.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete reservation with status '{reservation.status}'. Only reserved or active reservations can be completed."
        )
    
    # If status is RESERVED, automatically transition to ACTIVE first
    if reservation.status == ReservationStatus.RESERVED.value:
        reservation.status = ReservationStatus.ACTIVE.value
        logger.info(f"Reservation {reservation_id} auto-transitioned from RESERVED to ACTIVE before completion")

    reservation.status = ReservationStatus.COMPLETED.value
    reservation.returned_by = current_user.email
    reservation.returned_at = datetime.now(timezone.utc)
    
    # Release the associated storage
    if reservation.storage_id:
        storage = await session.get(Storage, reservation.storage_id)
        if storage and storage.status == StorageStatus.OCCUPIED.value:
            storage.status = StorageStatus.IDLE.value
            logger.info(f"Released storage {storage.id} (code: {storage.code}) for completed reservation {reservation_id}")
    
    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="reservation.complete",
        entity="reservations",
        entity_id=reservation.id,
    )
    await session.commit()
    
    logger.info(f"Reservation {reservation_id} completed by user {current_user.email}")
    return ReservationStatusResponse(id=reservation.id, status=ReservationStatus.COMPLETED)


class RecordPaymentRequest(BaseModel):
    """Request to record a manual payment."""
    method: str = Field(default="cash", description="Payment method: cash, pos, bank_transfer, magicpay")
    notes: Optional[str] = Field(default=None, description="Optional notes about the payment")


@router.post("/{reservation_id}/ensure-payment", response_model=PaymentRead)
async def ensure_payment(
    reservation_id: str,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> PaymentRead:
    """Get or create a payment for the reservation (idempotent).
    
    This endpoint:
    1. Checks if a payment already exists for the reservation
    2. If exists, returns the existing payment
    3. If not, creates a new payment using the reservation amount
    
    This is idempotent - calling multiple times will not create duplicate payments.
    """
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    
    # Get or create payment
    payment, created = await get_or_create_payment(
        session,
        reservation_id=reservation.id,
        tenant_id=reservation.tenant_id,
        amount_minor=reservation.amount_minor or reservation.estimated_total_price or 0,
        currency=reservation.currency or "TRY",
        storage_id=reservation.storage_id,
        reservation=reservation,
    )
    
    await session.commit()
    
    if created:
        logger.info(f"Created new payment {payment.id} for reservation {reservation_id}")
    else:
        logger.info(f"Found existing payment {payment.id} for reservation {reservation_id}")
    
    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="reservation.ensure_payment",
        entity="payments",
        entity_id=payment.id,
    )
    
    return PaymentRead.model_validate(payment)


@router.post("/{reservation_id}/payments", response_model=PaymentRead)
async def record_payment(
    reservation_id: str,
    payload: RecordPaymentRequest,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> PaymentRead:
    """Record a manual payment for a reservation.
    
    This endpoint is used to record payments made via:
    - cash: Nakit ödeme
    - pos: Otelin kendi POS cihazı
    - bank_transfer: Havale/EFT
    - magicpay: Online ödeme (will redirect to MagicPay)
    
    For cash/pos/bank_transfer, the payment is immediately marked as PAID.
    For magicpay, use the /ensure-payment endpoint instead.
    """
    from ...models import PaymentProvider, PaymentMode
    
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    
    # Map method string to PaymentMode
    method_to_mode = {
        "cash": PaymentMode.CASH.value,
        "pos": PaymentMode.POS.value,
        "bank_transfer": PaymentMode.POS.value,  # Use POS mode for bank transfers too
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
    
    # Get or create payment
    payment, created = await get_or_create_payment(
        session,
        reservation_id=reservation.id,
        tenant_id=reservation.tenant_id,
        amount_minor=reservation.amount_minor or reservation.estimated_total_price or 0,
        currency=reservation.currency or "TRY",
        provider=provider,
        mode=mode,
        storage_id=reservation.storage_id,
        reservation=reservation,
        metadata={
            "method": payload.method,
            "notes": payload.notes,
            "recorded_by": current_user.email,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    
    # For manual payments (cash, pos, bank_transfer), mark as PAID immediately
    if payload.method.lower() in ["cash", "pos", "bank_transfer"]:
        payment.status = PaymentStatus.PAID.value
        payment.paid_at = datetime.now(timezone.utc)
        
        # Also update reservation status to ACTIVE if it was RESERVED
        if reservation.status == ReservationStatus.RESERVED.value:
            reservation.status = ReservationStatus.ACTIVE.value
    
    await session.commit()
    
    logger.info(
        f"Recorded {payload.method} payment {payment.id} for reservation {reservation_id}, "
        f"amount={payment.amount_minor}, status={payment.status}"
    )
    
    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action=f"reservation.record_payment.{payload.method}",
        entity="payments",
        entity_id=payment.id,
    )
    
    return PaymentRead.model_validate(payment)


@router.post("/{reservation_id}/handover", response_model=ReservationRead)
async def handover_reservation(
    reservation_id: str,
    payload: ReservationHandoverRequest,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> ReservationRead:
    """Mark reservation as handed over to storage."""
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    try:
        updated = await mark_reservation_handover(
            session,
            reservation=reservation,
            actor_user_id=current_user.id,
            handover_by=payload.handover_by or current_user.email,
            handover_at=payload.handover_at,
            evidence_url=payload.evidence_url,
            notes=payload.notes,
            source="partner",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ReservationRead.model_validate(updated)


@router.post("/{reservation_id}/return", response_model=ReservationRead)
async def return_reservation(
    reservation_id: str,
    payload: ReservationReturnRequest,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> ReservationRead:
    """Mark reservation as completed/returned."""
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    try:
        updated = await mark_reservation_returned(
            session,
            reservation=reservation,
            actor_user_id=current_user.id,
            returned_by=payload.returned_by or current_user.email,
            returned_at=payload.returned_at,
            evidence_url=payload.evidence_url,
            notes=payload.notes,
            source="partner",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ReservationRead.model_validate(updated)
