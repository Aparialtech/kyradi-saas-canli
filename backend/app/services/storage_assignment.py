"""Storage assignment helpers used by partner APIs."""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Reservation, Storage, StorageStatus
from ..services.storage_availability import is_storage_available


async def suggest_storage_for_reservation(
    session: AsyncSession,
    reservation: Reservation,
) -> tuple[Optional[Storage], str]:
    """Return the best matching storage for a reservation based on capacity and location."""
    required_capacity = max(getattr(reservation, "baggage_count", 1) or 1, 1)
    stmt = (
        select(Storage)
        .where(
            Storage.tenant_id == reservation.tenant_id,
            Storage.status == StorageStatus.IDLE.value,
            Storage.capacity >= required_capacity,
        )
    )
    if reservation.storage_id:
        stmt = stmt.where(Storage.id != reservation.storage_id)

    location_priority = reservation.location_id
    if location_priority:
        stmt = stmt.order_by(
            (Storage.location_id == location_priority).desc(),
            Storage.capacity.asc(),
            Storage.created_at,
        )
    else:
        stmt = stmt.order_by(Storage.capacity.asc(), Storage.created_at)

    result = await session.execute(stmt)
    candidates = result.scalars().all()

    for storage in candidates:
        if await is_storage_available(
            session,
            storage_id=storage.id,
            start_datetime=reservation.start_datetime or reservation.start_at,
            end_datetime=reservation.end_datetime or reservation.end_at,
            exclude_reservation_id=reservation.id,
        ):
            reason = (
                "location matched and capacity sufficient"
                if storage.location_id == location_priority
                else "capacity sufficient and previously idle"
            )
            return storage, reason

    return None, "no suitable storage found"

