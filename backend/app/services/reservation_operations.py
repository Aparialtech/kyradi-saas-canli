"""Operational functions for reservation lifecycle management."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from ..models import Reservation, ReservationStatus, Storage, StorageStatus
from .audit import record_audit
from .storage_availability import is_storage_available



async def mark_luggage_received(
    session: AsyncSession,
    *,
    reservation: Reservation,
    actor_user_id: Optional[str],
    handover_by: Optional[str] = None,
    handover_at: Optional[datetime] = None,
    notes: Optional[str] = None,
) -> Reservation:
    """Mark luggage as received - transition RESERVED → ACTIVE."""
    if reservation.status != ReservationStatus.RESERVED.value:
        raise ValueError(f"Reservation must be RESERVED to mark luggage as received. Current status: {reservation.status}")
    
    reservation.status = ReservationStatus.ACTIVE.value
    reservation.handover_by = handover_by
    reservation.handover_at = handover_at or datetime.now(timezone.utc)
    if notes:
        reservation.notes = notes
    
    # Update storage status to OCCUPIED
    if reservation.storage:
        reservation.storage.status = StorageStatus.OCCUPIED.value
    
    await record_audit(
        session,
        tenant_id=reservation.tenant_id,
        actor_user_id=actor_user_id,
        action="reservation.luggage_received",
        entity="reservations",
        entity_id=reservation.id,
        meta={
            "previous_status": ReservationStatus.RESERVED.value,
            "new_status": ReservationStatus.ACTIVE.value,
            "handover_by": handover_by,
            "handover_at": reservation.handover_at.isoformat() if reservation.handover_at else None,
        },
    )
    
    await session.commit()
    await session.refresh(reservation)
    return reservation


async def mark_no_show(
    session: AsyncSession,
    *,
    reservation: Reservation,
    actor_user_id: Optional[str],
    notes: Optional[str] = None,
) -> Reservation:
    """Mark reservation as no-show - transition RESERVED → NO_SHOW."""
    if reservation.status != ReservationStatus.RESERVED.value:
        raise ValueError(f"Reservation must be RESERVED to mark as no-show. Current status: {reservation.status}")
    
    reservation.status = ReservationStatus.NO_SHOW.value
    if notes:
        reservation.notes = notes
    
    # Free the storage if it was assigned
    if reservation.storage:
        reservation.storage.status = StorageStatus.IDLE.value
    
    await record_audit(
        session,
        tenant_id=reservation.tenant_id,
        actor_user_id=actor_user_id,
        action="reservation.no_show",
        entity="reservations",
        entity_id=reservation.id,
        meta={
            "previous_status": ReservationStatus.RESERVED.value,
            "new_status": ReservationStatus.NO_SHOW.value,
        },
    )
    
    await session.commit()
    await session.refresh(reservation)
    return reservation


async def mark_luggage_returned(
    session: AsyncSession,
    *,
    reservation: Reservation,
    actor_user_id: Optional[str],
    returned_by: Optional[str] = None,
    returned_at: Optional[datetime] = None,
    notes: Optional[str] = None,
) -> Reservation:
    """Mark luggage as returned - transition ACTIVE → COMPLETED."""
    if reservation.status != ReservationStatus.ACTIVE.value:
        raise ValueError(f"Reservation must be ACTIVE to mark luggage as returned. Current status: {reservation.status}")
    
    reservation.status = ReservationStatus.COMPLETED.value
    reservation.returned_by = returned_by
    reservation.returned_at = returned_at or datetime.now(timezone.utc)
    if notes:
        reservation.notes = notes
    
    # Free the storage
    if reservation.storage:
        reservation.storage.status = StorageStatus.IDLE.value
    
    await record_audit(
        session,
        tenant_id=reservation.tenant_id,
        actor_user_id=actor_user_id,
        action="reservation.luggage_returned",
        entity="reservations",
        entity_id=reservation.id,
        meta={
            "previous_status": ReservationStatus.ACTIVE.value,
            "new_status": ReservationStatus.COMPLETED.value,
            "returned_by": returned_by,
            "returned_at": reservation.returned_at.isoformat() if reservation.returned_at else None,
        },
    )
    
    await session.commit()
    await session.refresh(reservation)
    return reservation


async def cancel_reservation_operation(
    session: AsyncSession,
    *,
    reservation: Reservation,
    actor_user_id: Optional[str],
    notes: Optional[str] = None,
) -> Reservation:
    """Cancel a reservation - transition RESERVED → CANCELLED."""
    if reservation.status not in [ReservationStatus.RESERVED.value, ReservationStatus.ACTIVE.value]:
        raise ValueError(f"Reservation must be RESERVED or ACTIVE to cancel. Current status: {reservation.status}")
    
    previous_status = reservation.status
    reservation.status = ReservationStatus.CANCELLED.value
    if notes:
        reservation.notes = notes
    
    # Free the storage
    if reservation.storage:
        reservation.storage.status = StorageStatus.IDLE.value
    
    await record_audit(
        session,
        tenant_id=reservation.tenant_id,
        actor_user_id=actor_user_id,
        action="reservation.cancel",
        entity="reservations",
        entity_id=reservation.id,
        meta={
            "previous_status": previous_status,
            "new_status": ReservationStatus.CANCELLED.value,
        },
    )
    
    await session.commit()
    await session.refresh(reservation)
    return reservation


async def extend_reservation(
    session: AsyncSession,
    *,
    reservation: Reservation,
    actor_user_id: Optional[str],
    new_end_at: datetime,
    notes: Optional[str] = None,
) -> Reservation:
    """Extend reservation duration and ensure storage availability."""
    if reservation.status not in {
        ReservationStatus.RESERVED.value,
        ReservationStatus.ACTIVE.value,
    }:
        raise ValueError("Only reserved or active reservations can be extended")

    current_end = reservation.end_datetime or reservation.end_at
    if new_end_at <= current_end:
        raise ValueError("New end time must be after the current end time")

    start_dt = reservation.start_datetime or reservation.start_at
    if not await is_storage_available(
        session,
        storage_id=reservation.storage_id,
        start_datetime=start_dt,
        end_datetime=new_end_at,
        exclude_reservation_id=reservation.id,
    ):
        raise ValueError("Storage is not available for the requested extension window")

    reservation.end_at = new_end_at
    reservation.end_datetime = new_end_at
    duration_seconds = (new_end_at - start_dt).total_seconds()
    reservation.duration_hours = max(duration_seconds / 3600.0, 0.01)
    if reservation.hourly_rate:
        reservation.estimated_total_price = int(reservation.duration_hours * reservation.hourly_rate)
    if notes:
        reservation.notes = notes

    await record_audit(
        session,
        tenant_id=reservation.tenant_id,
        actor_user_id=actor_user_id,
        action="reservation.extend",
        entity="reservations",
        entity_id=reservation.id,
        meta={
            "previous_end": current_end.isoformat() if current_end else None,
            "new_end": new_end_at.isoformat(),
            "notes": notes,
        },
    )

    await session.commit()
    await session.refresh(reservation)
    return reservation


async def mark_reservation_lost(
    session: AsyncSession,
    *,
    reservation: Reservation,
    actor_user_id: Optional[str],
    notes: Optional[str] = None,
) -> Reservation:
    """Mark reservation as lost and release storage."""
    if reservation.status not in {
        ReservationStatus.RESERVED.value,
        ReservationStatus.ACTIVE.value,
    }:
        raise ValueError("Only reserved or active reservations can be marked as lost")

    reservation.status = ReservationStatus.LOST.value
    if notes:
        reservation.notes = notes
    if reservation.storage:
        reservation.storage.status = StorageStatus.IDLE.value

    await record_audit(
        session,
        tenant_id=reservation.tenant_id,
        actor_user_id=actor_user_id,
        action="reservation.mark_lost",
        entity="reservations",
        entity_id=reservation.id,
        meta={"notes": notes},
    )

    await session.commit()
    await session.refresh(reservation)
    return reservation

