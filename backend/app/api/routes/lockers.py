"""Storage endpoints."""

from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_storage_operator, require_tenant_admin, require_tenant_operator
from ...models import Location, Reservation, ReservationStatus, Storage, StorageStatus, User
from ...services.limits import get_plan_limits_for_tenant
from ...services.quota_checks import check_storage_quota
from ...schemas import StorageCreate, StorageRead, StorageUpdate
from ...services.storage_utils import generate_storage_code
from ...services.storage_availability import (
    is_storage_available,
    get_storage_calendar,
    StorageCalendarResponse,
)

router = APIRouter(prefix="/storages", tags=["storages"])

# Backward compatibility: also register /lockers endpoint
legacy_router = APIRouter(prefix="/lockers", tags=["lockers"])


class AvailableStorageRead(BaseModel):
    """Storage with availability info."""
    id: str
    code: str
    location_id: str
    location_name: Optional[str] = None
    status: str
    capacity: int
    is_available: bool = True


@router.get("/available", response_model=List[AvailableStorageRead])
async def list_available_storages(
    start_datetime: datetime = Query(..., description="Reservation start datetime"),
    end_datetime: datetime = Query(..., description="Reservation end datetime"),
    location_id: Optional[str] = Query(None, description="Filter by location"),
    min_capacity: int = Query(1, description="Minimum capacity required"),
    current_user: User = Depends(require_storage_operator),
    session: AsyncSession = Depends(get_session),
) -> List[AvailableStorageRead]:
    """List storage units with availability info for the given time window.
    
    Returns storages sorted by availability (available first), then by location match.
    Occupied storages are included but marked as unavailable.
    """
    stmt = (
        select(Storage, Location.name.label("location_name"))
        .join(Location, Storage.location_id == Location.id)
        .where(
            Storage.tenant_id == current_user.tenant_id,
            Storage.capacity >= min_capacity,
        )
    )
    
    if location_id:
        stmt = stmt.where(Storage.location_id == location_id)
    
    stmt = stmt.order_by(Storage.created_at.desc())
    result = await session.execute(stmt)
    rows = result.all()
    
    available_storages: List[AvailableStorageRead] = []
    unavailable_storages: List[AvailableStorageRead] = []
    
    for storage, location_name in rows:
        # Check if storage is available for the time window
        is_avail = False
        if storage.status == StorageStatus.IDLE.value:
            is_avail = await is_storage_available(
                session,
                storage_id=storage.id,
                start_datetime=start_datetime,
                end_datetime=end_datetime,
            )
        
        storage_read = AvailableStorageRead(
            id=storage.id,
            code=storage.code,
            location_id=storage.location_id,
            location_name=location_name,
            status=storage.status,
            capacity=storage.capacity,
            is_available=is_avail,
        )
        
        if is_avail:
            available_storages.append(storage_read)
        else:
            unavailable_storages.append(storage_read)
    
    # Return available storages first
    return available_storages + unavailable_storages


@router.get("", response_model=List[StorageRead])
async def list_storages(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> List[StorageRead]:
    """List storage units for the tenant."""
    stmt = select(Storage).where(Storage.tenant_id == current_user.tenant_id)
    if status_filter:
        stmt = stmt.where(Storage.status == status_filter)
    stmt = stmt.order_by(Storage.created_at.desc())
    result = await session.execute(stmt)
    storages = result.scalars().all()
    return [StorageRead.model_validate(storage) for storage in storages]


@legacy_router.get("", response_model=List[StorageRead])
async def list_lockers(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> List[StorageRead]:
    """List storage units for the tenant (legacy endpoint)."""
    return await list_storages(status_filter, current_user, session)


@router.post("", response_model=StorageRead, status_code=status.HTTP_201_CREATED)
async def create_storage(
    payload: StorageCreate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> StorageRead:
    """Create a storage unit for a given location."""
    # Check quota from metadata (new system) first, fallback to plan limits
    can_create, quota_limit, current_count = await check_storage_quota(session, current_user.tenant_id)
    if not can_create and quota_limit is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Max depo kotasına ulaşıldı. Mevcut: {current_count}, Limit: {quota_limit}",
        )
    
    # Fallback to plan limits (backward compatibility)
    limits = await get_plan_limits_for_tenant(session, current_user.tenant_id)
    max_storages = getattr(limits, "max_storages", None) or getattr(limits, "max_lockers", None)
    if max_storages is not None and quota_limit is None:
        storage_count = await session.scalar(
            select(func.count()).select_from(Storage).where(Storage.tenant_id == current_user.tenant_id)
        )
        if storage_count >= max_storages:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Plan limit reached: maximum storage units for this tenant. Mevcut: {storage_count}, Limit: {max_storages}",
            )

    location = await session.get(Location, payload.location_id)
    if location is None or location.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    storage_code = payload.code
    if not storage_code:
        storage_code = await generate_storage_code(
            session,
            tenant_id=current_user.tenant_id,
            location_name=location.name,
        )
    capacity_value = payload.capacity if payload.capacity is not None else 1
    storage = Storage(
        tenant_id=current_user.tenant_id,
        location_id=payload.location_id,
        code=storage_code,
        status=payload.status.value if hasattr(payload.status, "value") else payload.status,
        capacity=capacity_value,
    )
    session.add(storage)
    await session.commit()
    await session.refresh(storage)
    return StorageRead.model_validate(storage)


@legacy_router.post("", response_model=StorageRead, status_code=status.HTTP_201_CREATED)
async def create_locker(
    payload: StorageCreate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> StorageRead:
    """Create a storage unit for a given location (legacy endpoint)."""
    return await create_storage(payload, current_user, session)


@router.patch("/{storage_id}", response_model=StorageRead)
async def update_storage(
    storage_id: str,
    payload: StorageUpdate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> StorageRead:
    """Update storage unit attributes."""
    storage = await session.get(Storage, storage_id)
    if storage is None or storage.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storage not found")

    data = payload.model_dump(exclude_unset=True)
    if "location_id" in data:
        location = await session.get(Location, data["location_id"])
        if location is None or location.tenant_id != current_user.tenant_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    for field, value in data.items():
        if hasattr(value, "value"):
            value = value.value
        setattr(storage, field, value)

    await session.commit()
    await session.refresh(storage)
    return StorageRead.model_validate(storage)


@legacy_router.patch("/{locker_id}", response_model=StorageRead)
async def update_locker(
    locker_id: str,
    payload: StorageUpdate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> StorageRead:
    """Update storage unit attributes (legacy endpoint)."""
    return await update_storage(locker_id, payload, current_user, session)


@router.delete("/{storage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storage(
    storage_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a storage unit without active reservations."""
    storage = await session.get(Storage, storage_id)
    if storage is None or storage.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storage not found")

    active_reservation = await session.execute(
        select(Reservation.id).where(
            Reservation.storage_id == storage_id,
            Reservation.status == ReservationStatus.ACTIVE.value,
        )
    )
    if active_reservation.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Storage has active reservations")

    await session.delete(storage)
    await session.commit()


@legacy_router.delete("/{locker_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_locker(
    locker_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a storage unit without active reservations (legacy endpoint)."""
    return await delete_storage(locker_id, current_user, session)


@router.get("/{storage_id}/calendar", response_model=StorageCalendarResponse)
async def get_storage_calendar_endpoint(
    storage_id: str,
    start_date: Optional[date] = Query(None, description="Start date (default: today)"),
    end_date: Optional[date] = Query(None, description="End date (default: today + 30 days)"),
    current_user: User = Depends(require_storage_operator),
    session: AsyncSession = Depends(get_session),
) -> StorageCalendarResponse:
    """Get storage availability calendar for a date range.
    
    Returns daily availability status for the specified storage:
    - status: "free" | "occupied"
    - reservation_ids: List of reservation IDs overlapping that day
    
    Default date range is today to today + 30 days.
    """
    # Default date range
    today = date.today()
    if start_date is None:
        start_date = today
    if end_date is None:
        end_date = today + timedelta(days=30)
    
    # Validate date range
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date must be after start date",
        )
    
    # Limit range to 365 days to prevent abuse
    if (end_date - start_date).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Date range cannot exceed 365 days",
        )
    
    try:
        calendar = await get_storage_calendar(
            session,
            storage_id=storage_id,
            start_date=start_date,
            end_date=end_date,
            tenant_id=current_user.tenant_id,
        )
        return calendar
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@legacy_router.get("/{locker_id}/calendar", response_model=StorageCalendarResponse)
async def get_locker_calendar_endpoint(
    locker_id: str,
    start_date: Optional[date] = Query(None, description="Start date (default: today)"),
    end_date: Optional[date] = Query(None, description="End date (default: today + 30 days)"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> StorageCalendarResponse:
    """Get storage availability calendar for a date range (legacy endpoint)."""
    return await get_storage_calendar_endpoint(storage_id=locker_id, start_date=start_date, end_date=end_date, current_user=current_user, session=session)
