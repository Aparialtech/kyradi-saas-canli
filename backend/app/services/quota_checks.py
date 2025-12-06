"""Quota checking functions that read from tenant metadata."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Location, Reservation, Storage, Tenant, User


async def get_tenant_quota_from_metadata(
    session: AsyncSession,
    tenant_id: str,
    quota_key: str,
) -> int | None:
    """Get quota limit from tenant metadata.
    
    Args:
        session: Database session
        tenant_id: Tenant ID
        quota_key: One of: max_location_count, max_storage_count, max_user_count, max_reservation_count
    
    Returns:
        Quota limit or None if unlimited
    """
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        return None
    
    metadata = tenant.metadata_ or {}
    quotas = metadata.get("quotas", {})
    return quotas.get(quota_key)


async def check_location_quota(
    session: AsyncSession,
    tenant_id: str,
) -> tuple[bool, int | None, int]:
    """Check if tenant can create a new location.
    
    Returns:
        (can_create, quota_limit, current_count)
    """
    quota = await get_tenant_quota_from_metadata(session, tenant_id, "max_location_count")
    if quota is None:
        return (True, None, 0)
    
    stmt = select(func.count()).select_from(Location).where(Location.tenant_id == tenant_id)
    current_count = await session.scalar(stmt) or 0
    
    can_create = current_count < quota
    return (can_create, quota, current_count)


async def check_storage_quota(
    session: AsyncSession,
    tenant_id: str,
) -> tuple[bool, int | None, int]:
    """Check if tenant can create a new storage.
    
    Returns:
        (can_create, quota_limit, current_count)
    """
    quota = await get_tenant_quota_from_metadata(session, tenant_id, "max_storage_count")
    if quota is None:
        return (True, None, 0)
    
    stmt = select(func.count()).select_from(Storage).where(Storage.tenant_id == tenant_id)
    current_count = await session.scalar(stmt) or 0
    
    can_create = current_count < quota
    return (can_create, quota, current_count)


async def check_user_quota(
    session: AsyncSession,
    tenant_id: str,
) -> tuple[bool, int | None, int]:
    """Check if tenant can create a new user.
    
    Returns:
        (can_create, quota_limit, current_count)
    """
    quota = await get_tenant_quota_from_metadata(session, tenant_id, "max_user_count")
    if quota is None:
        return (True, None, 0)
    
    stmt = select(func.count()).select_from(User).where(
        User.tenant_id == tenant_id,
        User.is_active.is_(True),
    )
    current_count = await session.scalar(stmt) or 0
    
    can_create = current_count < quota
    return (can_create, quota, current_count)


async def check_reservation_quota(
    session: AsyncSession,
    tenant_id: str,
) -> tuple[bool, int | None, int]:
    """Check if tenant can create a new reservation.
    
    Returns:
        (can_create, quota_limit, current_count)
    """
    quota = await get_tenant_quota_from_metadata(session, tenant_id, "max_reservation_count")
    if quota is None:
        return (True, None, 0)
    
    stmt = select(func.count()).select_from(Reservation).where(Reservation.tenant_id == tenant_id)
    current_count = await session.scalar(stmt) or 0
    
    can_create = current_count < quota
    return (can_create, quota, current_count)


async def get_tenant_commission_rate(
    session: AsyncSession,
    tenant_id: str,
) -> float:
    """Get commission rate from tenant metadata.
    
    Returns:
        Commission rate percentage (0-100), default 5.0
    """
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        return 5.0
    
    metadata = tenant.metadata_ or {}
    financial = metadata.get("financial", {})
    return float(financial.get("commission_rate", 5.0))

