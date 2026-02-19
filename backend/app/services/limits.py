"""Plan limit helpers for tenant-scoped resources."""

from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AuditLog, Reservation, Tenant, TenantPlanLimit, User


@dataclass(frozen=True)
class PlanLimits:
    max_locations: Optional[int] = None
    max_lockers: Optional[int] = None
    max_active_reservations: Optional[int] = None
    max_users: Optional[int] = None
    max_self_service_daily: Optional[int] = None
    max_reservations_total: Optional[int] = None
    max_report_exports_daily: Optional[int] = None
    max_storage_mb: Optional[int] = None


PLAN_LIMITS: Dict[str, PlanLimits] = {
    "standard": PlanLimits(
        max_locations=5,
        max_lockers=50,
        max_active_reservations=100,
        max_users=10,
        max_self_service_daily=50,
        max_reservations_total=500,
        max_report_exports_daily=25,
        max_storage_mb=1024,
    ),
    "pro": PlanLimits(
        max_locations=20,
        max_lockers=200,
        max_active_reservations=500,
        max_users=40,
        max_self_service_daily=200,
        max_reservations_total=5000,
        max_report_exports_daily=100,
        max_storage_mb=5120,
    ),
    "enterprise": PlanLimits(),  # unlimited
}

CUSTOM_PLAN_SUFFIX = "::custom"
PLAN_LIMIT_FIELDS = (
    "max_locations",
    "max_lockers",
    "max_active_reservations",
    "max_users",
    "max_self_service_daily",
    "max_reservations_total",
    "max_report_exports_daily",
    "max_storage_mb",
)


def _apply_overrides(base: PlanLimits, overrides: Optional[Dict[str, Optional[int]]]) -> PlanLimits:
    if not overrides:
        return base
    data: Dict[str, Optional[int]] = {}
    for field in PLAN_LIMIT_FIELDS:
        if field in overrides:
            data[field] = overrides[field]
    if not data:
        return base
    return replace(base, **data)


async def get_plan_limits_for_tenant(session: AsyncSession, tenant_id: str) -> PlanLimits:
    """Return plan limits for the given tenant."""
    result = await session.execute(
        select(Tenant.plan, Tenant.metadata_, TenantPlanLimit)
        .outerjoin(TenantPlanLimit, TenantPlanLimit.tenant_id == Tenant.id)
        .where(Tenant.id == tenant_id)
    )
    row = result.first()
    if not row:
        return PLAN_LIMITS["standard"]

    plan_name, metadata, plan_limit = row
    metadata = metadata or {}

    base_plan = plan_name or "standard"
    if base_plan.endswith(CUSTOM_PLAN_SUFFIX):
        base_plan = base_plan.replace(CUSTOM_PLAN_SUFFIX, "")

    base = PLAN_LIMITS.get(base_plan, PLAN_LIMITS["standard"])

    if plan_limit:
        overrides = {field: getattr(plan_limit, field) for field in PLAN_LIMIT_FIELDS}
        base = _apply_overrides(base, overrides)

    legacy_overrides = metadata.get("plan_limits")
    if legacy_overrides:
        base = _apply_overrides(base, legacy_overrides)

    return base


async def save_custom_plan_limits(
    session: AsyncSession,
    tenant_id: str,
    limits: PlanLimits,
) -> None:
    """Persist custom plan limits for a tenant."""
    existing = await session.execute(
        select(TenantPlanLimit).where(TenantPlanLimit.tenant_id == tenant_id)
    )
    record = existing.scalar_one_or_none()
    payload = {field: getattr(limits, field) for field in PLAN_LIMIT_FIELDS}

    if record:
        for field, value in payload.items():
            setattr(record, field, value)
    else:
        session.add(TenantPlanLimit(tenant_id=tenant_id, **payload))

    tenant = await session.get(Tenant, tenant_id)
    if tenant:
        metadata = dict(tenant.metadata_ or {})
        if "plan_limits" in metadata:
            metadata.pop("plan_limits", None)
            tenant.metadata_ = metadata or None


async def active_user_count(session: AsyncSession, tenant_id: str) -> int:
    """Return the number of active users for tenant."""
    stmt = select(func.count()).select_from(User).where(
        User.tenant_id == tenant_id,
        User.is_active.is_(True),
    )
    count = await session.scalar(stmt)
    return int(count or 0)


async def ensure_user_limit(session: AsyncSession, tenant_id: str) -> None:
    """Raise ValueError when tenant active user count has reached plan limit."""
    limits = await get_plan_limits_for_tenant(session, tenant_id)
    if limits.max_users is None:
        return
    count = await active_user_count(session, tenant_id)
    if count >= limits.max_users:
        raise ValueError("Plan limit reached: maximum active users")


async def self_service_reservations_last24h(session: AsyncSession, tenant_id: str) -> int:
    """Return count of reservations created via self-service in last 24h."""
    window_start = datetime.now(timezone.utc) - timedelta(hours=24)
    stmt = select(func.count()).select_from(Reservation).where(
        Reservation.tenant_id == tenant_id,
        Reservation.created_at >= window_start,
        Reservation.created_by_user_id.is_(None),
    )
    count = await session.scalar(stmt)
    return int(count or 0)


async def report_exports_last24h(session: AsyncSession, tenant_id: str) -> int:
    """Return count of reservation report exports recorded in the last 24h."""
    window_start = datetime.now(timezone.utc) - timedelta(hours=24)
    stmt = select(func.count()).select_from(AuditLog).where(
        AuditLog.tenant_id == tenant_id,
        AuditLog.action == "report.reservations.export",
        AuditLog.created_at >= window_start,
    )
    count = await session.scalar(stmt)
    return int(count or 0)


async def get_storage_usage_mb(session: AsyncSession, tenant_id: str) -> int:
    """Return the storage usage for a tenant as stored in metadata."""
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        return 0
    metadata = tenant.metadata_ or {}
    return int(metadata.get("storage_usage_mb") or 0)


async def update_tenant_plan(
    session: AsyncSession,
    tenant_id: str,
    *,
    plan: str,
    overrides: Optional[PlanLimits] = None,
) -> None:
    """Update tenant plan and optional overrides."""
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise ValueError("Tenant not found")

    tenant.plan = plan
    metadata = dict(tenant.metadata_ or {})
    if "plan_limits" in metadata:
        metadata.pop("plan_limits", None)
    tenant.metadata_ = metadata or None

    if overrides:
        await save_custom_plan_limits(session, tenant_id, limits=overrides)
    else:
        await session.execute(
            delete(TenantPlanLimit).where(TenantPlanLimit.tenant_id == tenant_id)
        )
