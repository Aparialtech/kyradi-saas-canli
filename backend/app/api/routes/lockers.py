"""Storage endpoints."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_storage_operator, require_tenant_admin, require_tenant_operator
from ...models import Location, Reservation, ReservationStatus, Storage, User
from ...services.limits import get_plan_limits_for_tenant
from ...schemas import StorageCreate, StorageRead, StorageUpdate
from ...services.storage_utils import generate_storage_code

router = APIRouter(prefix="/storages", tags=["storages"])

# Backward compatibility: also register /lockers endpoint
legacy_router = APIRouter(prefix="/lockers", tags=["lockers"])


@router.get("", response_model=List[StorageRead])
async def list_storages(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current_user: User = Depends(require_storage_operator),
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
    limits = await get_plan_limits_for_tenant(session, current_user.tenant_id)
    # Check max_storages, fallback to max_lockers for backward compatibility
    max_storages = getattr(limits, "max_storages", None) or getattr(limits, "max_lockers", None)
    if max_storages is not None:
        storage_count = await session.scalar(
            select(func.count()).select_from(Storage).where(Storage.tenant_id == current_user.tenant_id)
        )
        if storage_count >= max_storages:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Plan limit reached: maximum storage units for this tenant",
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
