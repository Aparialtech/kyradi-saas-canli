"""Partner reservation operations."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...dependencies import require_tenant_staff
from ...db.session import get_session
from ...models import Reservation, ReservationStatus, User
from ...schemas import ReservationExtendRequest, ReservationRead, ReservationStatusResponse
from ...services.audit import record_audit
from ...services.reservation_operations import (
    cancel_reservation_operation,
    extend_reservation,
    mark_luggage_received,
    mark_luggage_returned,
    mark_reservation_lost,
)

router = APIRouter(prefix="/partner/reservations", tags=["partner-reservations"])


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


@router.post("/{reservation_id}/check-in", response_model=ReservationRead)
async def check_in_reservation(
    reservation_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_tenant_staff),
) -> ReservationRead:
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    try:
        updated = await mark_luggage_received(
            session,
            reservation=reservation,
            actor_user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ReservationRead.model_validate(updated)


@router.post("/{reservation_id}/check-out", response_model=ReservationRead)
async def check_out_reservation(
    reservation_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_tenant_staff),
) -> ReservationRead:
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    try:
        updated = await mark_luggage_returned(
            session,
            reservation=reservation,
            actor_user_id=current_user.id,
            returned_by=current_user.email,
            returned_at=datetime.now(timezone.utc),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ReservationRead.model_validate(updated)


@router.post("/{reservation_id}/extend", response_model=ReservationRead)
async def extend_reservation_window(
    reservation_id: str,
    payload: ReservationExtendRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_tenant_staff),
) -> ReservationRead:
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    if not payload.new_end_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="new_end_at is required")
    try:
        updated = await extend_reservation(
            session,
            reservation=reservation,
            actor_user_id=current_user.id,
            new_end_at=payload.new_end_at,
            notes=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ReservationRead.model_validate(updated)


@router.post("/{reservation_id}/cancel", response_model=ReservationStatusResponse)
async def cancel_reservation(
    reservation_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_tenant_staff),
) -> ReservationStatusResponse:
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    try:
        updated = await cancel_reservation_operation(
            session,
            reservation=reservation,
            actor_user_id=current_user.id,
            notes="Cancelled via partner UI",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ReservationStatusResponse(id=updated.id, status=ReservationStatus.CANCELLED)


@router.post("/{reservation_id}/mark-lost", response_model=ReservationStatusResponse)
async def mark_lost_reservation(
    reservation_id: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_tenant_staff),
) -> ReservationStatusResponse:
    reservation = await _get_reservation_for_tenant(reservation_id, current_user.tenant_id, session)
    try:
        updated = await mark_reservation_lost(
            session,
            reservation=reservation,
            actor_user_id=current_user.id,
            notes="Partner reported reservation as lost",
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ReservationStatusResponse(id=updated.id, status=ReservationStatus.LOST)

