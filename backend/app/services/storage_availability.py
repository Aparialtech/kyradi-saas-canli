"""Storage availability checking utilities."""

from datetime import datetime
from typing import Optional

from sqlalchemy import and_, func, or_, select
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Reservation, ReservationStatus, Storage


async def is_storage_available(
    session: AsyncSession,
    storage_id: str,
    start_datetime: datetime,
    end_datetime: datetime,
    exclude_reservation_id: Optional[str] = None,
) -> bool:
    """Check if a storage is available for the given time window.
    
    A storage is considered available if there are no overlapping reservations
    with blocking statuses (RESERVED, ACTIVE) for the given time window.
    
    Args:
        session: Database session
        storage_id: Storage ID to check
        start_datetime: Reservation start datetime
        end_datetime: Reservation end datetime
        exclude_reservation_id: Optional reservation ID to exclude from check
            (useful when updating an existing reservation)
        
    Returns:
        True if storage is available, False otherwise
    """
    if start_datetime >= end_datetime:
        return False
    
    # Check for overlapping reservations with blocking statuses
    overlap_stmt = select(func.count()).where(
        Reservation.storage_id == storage_id,
        Reservation.status.in_([ReservationStatus.RESERVED.value, ReservationStatus.ACTIVE.value]),
        or_(
            # Overlap case 1: Reservation starts before window and ends during window
            and_(
                sa.func.coalesce(Reservation.start_datetime, Reservation.start_at) <= start_datetime,
                sa.func.coalesce(Reservation.end_datetime, Reservation.end_at) > start_datetime
            ),
            # Overlap case 2: Reservation starts during window and ends after window
            and_(
                sa.func.coalesce(Reservation.start_datetime, Reservation.start_at) < end_datetime,
                sa.func.coalesce(Reservation.end_datetime, Reservation.end_at) >= end_datetime
            ),
            # Overlap case 3: Reservation is completely within window
            and_(
                sa.func.coalesce(Reservation.start_datetime, Reservation.start_at) >= start_datetime,
                sa.func.coalesce(Reservation.end_datetime, Reservation.end_at) <= end_datetime
            ),
        ),
    )
    
    # Exclude a specific reservation (useful for updates)
    if exclude_reservation_id:
        overlap_stmt = overlap_stmt.where(Reservation.id != exclude_reservation_id)
    
    overlap_count = (await session.execute(overlap_stmt)).scalar_one()
    return overlap_count == 0

