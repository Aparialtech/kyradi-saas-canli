"""Storage availability checking utilities."""

from datetime import date, datetime, timedelta
from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Reservation, ReservationStatus, Storage


class StorageCalendarDay(BaseModel):
    """Single day availability info."""
    date: str  # ISO date string YYYY-MM-DD
    status: str  # "free" | "occupied"
    reservation_ids: List[str]


class StorageCalendarResponse(BaseModel):
    """Storage calendar response."""
    storage_id: str
    storage_code: str
    start_date: str
    end_date: str
    days: List[StorageCalendarDay]


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


async def get_overlapping_reservations_for_day(
    session: AsyncSession,
    storage_id: str,
    day: date,
) -> List[str]:
    """Get reservation IDs that overlap with a specific day.
    
    Args:
        session: Database session
        storage_id: Storage ID to check
        day: The specific date to check
        
    Returns:
        List of reservation IDs that overlap with this day
    """
    # Day boundaries: from 00:00:00 to 23:59:59
    day_start = datetime.combine(day, datetime.min.time())
    day_end = datetime.combine(day + timedelta(days=1), datetime.min.time())
    
    # Find reservations that overlap with this day
    stmt = select(Reservation.id).where(
        Reservation.storage_id == storage_id,
        Reservation.status.in_([ReservationStatus.RESERVED.value, ReservationStatus.ACTIVE.value]),
        # Overlap: reservation starts before day ends AND ends after day starts
        sa.func.coalesce(Reservation.start_datetime, Reservation.start_at) < day_end,
        sa.func.coalesce(Reservation.end_datetime, Reservation.end_at) > day_start,
    )
    
    result = await session.execute(stmt)
    return [str(row[0]) for row in result.all()]


async def get_storage_calendar(
    session: AsyncSession,
    storage_id: str,
    start_date: date,
    end_date: date,
    tenant_id: Optional[str] = None,
) -> StorageCalendarResponse:
    """Get storage availability calendar for a date range.
    
    Args:
        session: Database session
        storage_id: Storage ID to get calendar for
        start_date: Start date of the calendar range
        end_date: End date of the calendar range (inclusive)
        tenant_id: Optional tenant ID for access control
        
    Returns:
        StorageCalendarResponse with daily availability info
        
    Raises:
        ValueError: If storage not found or access denied
    """
    # Get storage
    storage = await session.get(Storage, storage_id)
    if storage is None:
        raise ValueError("Storage not found")
    
    if tenant_id and storage.tenant_id != tenant_id:
        raise ValueError("Access denied")
    
    # Validate date range
    if end_date < start_date:
        raise ValueError("End date must be after start date")
    
    # Get all relevant reservations for this storage in the date range
    # We need to find reservations that have any overlap with our date range
    range_start = datetime.combine(start_date, datetime.min.time())
    range_end = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
    
    stmt = select(Reservation).where(
        Reservation.storage_id == storage_id,
        Reservation.status.in_([ReservationStatus.RESERVED.value, ReservationStatus.ACTIVE.value]),
        # Overlaps with our range
        sa.func.coalesce(Reservation.start_datetime, Reservation.start_at) < range_end,
        sa.func.coalesce(Reservation.end_datetime, Reservation.end_at) > range_start,
    )
    
    result = await session.execute(stmt)
    reservations = result.scalars().all()
    
    # Build calendar days
    days: List[StorageCalendarDay] = []
    current_date = start_date
    
    while current_date <= end_date:
        day_start = datetime.combine(current_date, datetime.min.time())
        day_end = datetime.combine(current_date + timedelta(days=1), datetime.min.time())
        
        # Find reservations that overlap with this day
        overlapping_ids: List[str] = []
        for res in reservations:
            res_start = res.start_datetime or res.start_at
            res_end = res.end_datetime or res.end_at
            
            # Check if reservation overlaps with this day
            if res_start < day_end and res_end > day_start:
                overlapping_ids.append(str(res.id))
        
        days.append(StorageCalendarDay(
            date=current_date.isoformat(),
            status="occupied" if overlapping_ids else "free",
            reservation_ids=overlapping_ids,
        ))
        
        current_date += timedelta(days=1)
    
    return StorageCalendarResponse(
        storage_id=str(storage.id),
        storage_code=storage.code,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        days=days,
    )

