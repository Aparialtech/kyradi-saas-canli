"""Reservation endpoints."""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_operator, require_tenant_staff
from ...models import Reservation, ReservationStatus, Storage, User

# Backward compatibility
Locker = Storage
from ...schemas import (
    ReservationCreate,
    ReservationRead,
    ReservationStatusResponse,
    ReservationHandoverRequest,
    ReservationReturnRequest,
)
from ...schemas.payment import PaymentRead
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

router = APIRouter(prefix="/reservations", tags=["reservations"])


async def _get_reservation_for_tenant(
    reservation_id: str,
    tenant_id: str,
    session: AsyncSession,
) -> Reservation:
    stmt = select(Reservation).where(
        Reservation.id == reservation_id,
        Reservation.tenant_id == tenant_id,
    )
    reservation = (await session.execute(stmt)).scalar_one_or_none()
    if reservation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    return reservation


@router.get("", response_model=List[ReservationRead])
async def list_reservations(
    status_filter: Optional[ReservationStatus] = Query(default=None, alias="status"),
    date_from: Optional[datetime] = Query(default=None, alias="from"),
    date_to: Optional[datetime] = Query(default=None, alias="to"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> List[ReservationRead]:
    """List reservations for the tenant with optional filters."""
    stmt = select(Reservation).where(Reservation.tenant_id == current_user.tenant_id)
    if status_filter:
        stmt = stmt.where(Reservation.status == status_filter.value)
    if date_from:
        stmt = stmt.where(Reservation.start_at >= date_from)
    if date_to:
        stmt = stmt.where(Reservation.end_at <= date_to)
    stmt = stmt.order_by(Reservation.start_at.desc())

    result = await session.execute(stmt)
    reservations = result.scalars().all()
    
    # Include payment information
    from ...models import Payment
    reservation_reads = []
    for res in reservations:
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
        }
        reservation_dict = ReservationRead.model_validate(res_dict).model_dump()
        if payment:
            reservation_dict["payment"] = PaymentRead.model_validate(payment).model_dump()
        reservation_reads.append(ReservationRead.model_validate(reservation_dict))
    
    return reservation_reads


@router.get("/{reservation_id}", response_model=ReservationRead)
async def get_reservation(
    reservation_id: str,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> ReservationRead:
    """Get a single reservation by ID."""
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    
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
    }
    reservation_dict = ReservationRead.model_validate(reservation_dict_data).model_dump()
    # Add payment info as a dict (not part of schema to avoid forward reference)
    if payment:
        reservation_dict["payment"] = PaymentRead.model_validate(payment).model_dump()
    else:
        reservation_dict["payment"] = None
    
    return ReservationRead.model_validate(reservation_dict)


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
    """Cancel an active reservation."""
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    if reservation.status != ReservationStatus.ACTIVE.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only active reservations can be cancelled")

    reservation.status = ReservationStatus.CANCELLED.value
    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="reservation.cancel",
        entity="reservations",
        entity_id=reservation.id,
    )
    await session.commit()
    return ReservationStatusResponse(id=reservation.id, status=ReservationStatus.CANCELLED)


@router.post("/{reservation_id}/complete", response_model=ReservationStatusResponse)
async def complete_reservation(
    reservation_id: str,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> ReservationStatusResponse:
    """Mark a reservation as completed."""
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    if reservation.status != ReservationStatus.ACTIVE.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reservation not active")

    reservation.status = ReservationStatus.COMPLETED.value
    reservation.returned_by = current_user.email
    reservation.returned_at = datetime.now(timezone.utc)
    await record_audit(
        session,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        action="reservation.complete",
        entity="reservations",
        entity_id=reservation.id,
    )
    await session.commit()
    return ReservationStatusResponse(id=reservation.id, status=ReservationStatus.COMPLETED)


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
