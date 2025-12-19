"""Location endpoints for tenant operators."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_admin, require_tenant_operator
from ...models import Location, Locker, User
from ...services.limits import get_plan_limits_for_tenant
from ...services.quota_checks import check_location_quota
from ...schemas import LocationCreate, LocationRead, LocationUpdate

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=List[LocationRead])
async def list_locations(
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> List[LocationRead]:
    """List locations for the current tenant."""
    stmt = select(Location).where(Location.tenant_id == current_user.tenant_id).order_by(Location.created_at.desc())
    result = await session.execute(stmt)
    locations = result.scalars().all()
    return [LocationRead.model_validate(loc) for loc in locations]


@router.get("/{location_id}", response_model=LocationRead)
async def get_location(
    location_id: str,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> LocationRead:
    """Get a single location by ID."""
    stmt = select(Location).where(
        Location.id == location_id,
        Location.tenant_id == current_user.tenant_id,
    )
    location = (await session.execute(stmt)).scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return LocationRead.model_validate(location)


@router.post("", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
async def create_location(
    payload: LocationCreate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> LocationRead:
    """Create a new location for the tenant."""
    # Check quota from metadata (new system) first, fallback to plan limits
    can_create, quota_limit, current_count = await check_location_quota(session, current_user.tenant_id)
    if not can_create and quota_limit is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Max lokasyon kotasına ulaşıldı. Mevcut: {current_count}, Limit: {quota_limit}",
        )
    
    # Fallback to plan limits (backward compatibility)
    limits = await get_plan_limits_for_tenant(session, current_user.tenant_id)
    if limits.max_locations is not None and quota_limit is None:
        location_count = await session.scalar(
            select(func.count()).select_from(Location).where(Location.tenant_id == current_user.tenant_id)
        )
        if location_count >= limits.max_locations:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Plan limit reached: maximum locations for this tenant. Mevcut: {location_count}, Limit: {limits.max_locations}",
            )

    location = Location(
        tenant_id=current_user.tenant_id,
        name=payload.name,
        address=payload.address,
        phone_number=payload.phone_number,
        working_hours=payload.working_hours,
        lat=payload.lat,
        lon=payload.lon,
    )
    session.add(location)
    await session.commit()
    await session.refresh(location)
    return LocationRead.model_validate(location)


@router.patch("/{location_id}", response_model=LocationRead)
async def update_location(
    location_id: str,
    payload: LocationUpdate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> LocationRead:
    """Update a tenant location."""
    stmt = select(Location).where(
        Location.id == location_id,
        Location.tenant_id == current_user.tenant_id,
    )
    location = (await session.execute(stmt)).scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(location, field, value)

    await session.commit()
    await session.refresh(location)
    return LocationRead.model_validate(location)


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a location if it has no lockers."""
    stmt = select(Location).where(
        Location.id == location_id,
        Location.tenant_id == current_user.tenant_id,
    )
    location = (await session.execute(stmt)).scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    locker_check = await session.execute(
        select(Locker.id).where(Locker.location_id == location.id).limit(1)
    )
    if locker_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Location has lockers")

    await session.delete(location)
    await session.commit()
