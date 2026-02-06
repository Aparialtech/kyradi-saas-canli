"""Staff (eleman) management endpoints."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...db.session import get_session
from ...dependencies import require_tenant_admin
from ...models import Location, Staff, Storage, User
from ...schemas.staff import StaffCreate, StaffRead, StaffUpdate

router = APIRouter(prefix="/staff", tags=["staff"])


@router.get("", response_model=List[StaffRead])
async def list_staff(
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> List[StaffRead]:
    """List all staff for the tenant."""
    # Eager load assigned_storages to avoid MissingGreenlet error
    stmt = (
        select(Staff)
        .where(Staff.tenant_id == current_user.tenant_id)
        .options(selectinload(Staff.assigned_storages))
    )
    result = await session.execute(stmt)
    staff_list = result.scalars().unique().all()
    
    return [
        StaffRead(
            id=staff.id,
            tenant_id=staff.tenant_id,
            user_id=staff.user_id,
            assigned_storage_ids=[s.id for s in (staff.assigned_storages or [])],
            assigned_location_ids=staff.assigned_location_ids.split(",") if staff.assigned_location_ids else [],
            created_at=staff.created_at,
        )
        for staff in staff_list
    ]


@router.get("/", response_model=List[StaffRead])
async def list_staff_slash(
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> List[StaffRead]:
    """List all staff for the tenant (trailing slash)."""
    return await list_staff(current_user, session)


@router.post("", response_model=StaffRead, status_code=status.HTTP_201_CREATED)
async def create_staff(
    payload: StaffCreate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> StaffRead:
    """Create staff assignment."""
    # Verify user belongs to tenant
    user = await session.get(User, payload.user_id)
    if user is None or user.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Check if staff assignment already exists
    existing = await session.execute(
        select(Staff).where(Staff.user_id == payload.user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Staff assignment already exists")
    
    # Verify storages belong to tenant
    storages = []
    if payload.storage_ids:
        stmt = select(Storage).where(
            Storage.id.in_(payload.storage_ids),
            Storage.tenant_id == current_user.tenant_id,
        )
        result = await session.execute(stmt)
        storages = list(result.scalars().all())
        if len(storages) != len(payload.storage_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Some storages not found")
    
    # Verify locations belong to tenant
    if payload.location_ids:
        stmt = select(Location).where(
            Location.id.in_(payload.location_ids),
            Location.tenant_id == current_user.tenant_id,
        )
        result = await session.execute(stmt)
        locations = list(result.scalars().all())
        if len(locations) != len(payload.location_ids):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Some locations not found")
    
    staff = Staff(
        tenant_id=current_user.tenant_id,
        user_id=payload.user_id,
        assigned_storages=storages,
        assigned_location_ids=",".join(payload.location_ids) if payload.location_ids else None,
    )
    
    session.add(staff)
    await session.commit()
    
    # Reload staff with eager loading to avoid MissingGreenlet
    stmt = (
        select(Staff)
        .where(Staff.id == staff.id)
        .options(selectinload(Staff.assigned_storages))
    )
    result = await session.execute(stmt)
    staff = result.scalar_one()
    
    return StaffRead(
        id=staff.id,
        tenant_id=staff.tenant_id,
        user_id=staff.user_id,
        assigned_storage_ids=[s.id for s in (staff.assigned_storages or [])],
        assigned_location_ids=staff.assigned_location_ids.split(",") if staff.assigned_location_ids else [],
        created_at=staff.created_at,
    )


@router.patch("/{staff_id}", response_model=StaffRead)
async def update_staff(
    staff_id: str,
    payload: StaffUpdate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> StaffRead:
    """Update staff assignment."""
    # Fetch staff with eager loading
    stmt = (
        select(Staff)
        .where(Staff.id == staff_id, Staff.tenant_id == current_user.tenant_id)
        .options(selectinload(Staff.assigned_storages))
    )
    result = await session.execute(stmt)
    staff = result.scalar_one_or_none()
    
    if staff is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found")
    
    # Update storages
    if payload.storage_ids is not None:
        stmt = select(Storage).where(
            Storage.id.in_(payload.storage_ids),
            Storage.tenant_id == current_user.tenant_id,
        )
        result = await session.execute(stmt)
        staff.assigned_storages = list(result.scalars().all())
    
    # Update locations
    if payload.location_ids is not None:
        staff.assigned_location_ids = ",".join(payload.location_ids) if payload.location_ids else None
    
    await session.commit()
    
    # Reload with eager loading to avoid MissingGreenlet
    stmt = (
        select(Staff)
        .where(Staff.id == staff_id)
        .options(selectinload(Staff.assigned_storages))
    )
    result = await session.execute(stmt)
    staff = result.scalar_one()
    
    return StaffRead(
        id=staff.id,
        tenant_id=staff.tenant_id,
        user_id=staff.user_id,
        assigned_storage_ids=[s.id for s in (staff.assigned_storages or [])],
        assigned_location_ids=staff.assigned_location_ids.split(",") if staff.assigned_location_ids else [],
        created_at=staff.created_at,
    )


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staff(
    staff_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete staff assignment."""
    staff = await session.get(Staff, staff_id)
    if staff is None or staff.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found")
    
    await session.delete(staff)
    await session.commit()
