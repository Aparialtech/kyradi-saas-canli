"""Reporting endpoints."""

from datetime import datetime, time, timedelta, timezone

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import DBAPIError, ProgrammingError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_operator
from ...models import Locker, Reservation, ReservationStatus, User, Tenant, Payment, Location, Storage
from ...models.enums import PaymentStatus
from ...schemas import PartnerSummary, TenantPlanLimits, LimitWarning
from ...services.limits import (
    get_plan_limits_for_tenant,
    report_exports_last24h,
    get_storage_usage_mb,
    self_service_reservations_last24h,
)
from ...services.audit import record_audit

router = APIRouter(prefix="/reports", tags=["reports"])

logger = logging.getLogger(__name__)


def _coerce_plan_limits(raw: object | None) -> TenantPlanLimits:
    """
    plan_limits DB tipini (PlanLimits, dict vs.) güvenli şekilde
    API şemasındaki TenantPlanLimits tipine dönüştürür.

    Hangi tür gelirse gelsin her zaman TenantPlanLimits döndürerek
    Pydantic ValidationError almamayı garanti ediyoruz.
    """
    if raw is None:
        return TenantPlanLimits(
            max_locations=0,
            max_lockers=0,
            max_active_reservations=0,
            max_users=0,
            max_self_service_daily=0,
            max_reservations_total=0,
            max_report_exports_daily=0,
            max_storage_mb=0,
        )

    if isinstance(raw, TenantPlanLimits):
        return raw

    data = None
    try:
        if hasattr(raw, "model_dump"):
            data = raw.model_dump()
        elif isinstance(raw, dict):
            data = raw
        else:
            data = raw.__dict__
    except Exception:
        data = {}

    if not isinstance(data, dict):
        data = {}

    return TenantPlanLimits(
        max_locations=int(data.get("max_locations") or 0),
        max_lockers=int(data.get("max_lockers") or 0),
        max_active_reservations=int(data.get("max_active_reservations") or 0),
        max_users=int(data.get("max_users") or 0),
        max_self_service_daily=int(data.get("max_self_service_daily") or 0),
        max_reservations_total=int(data.get("max_reservations_total") or 0),
        max_report_exports_daily=int(data.get("max_report_exports_daily") or 0),
        max_storage_mb=int(data.get("max_storage_mb") or 0),
    )


async def _safe_scalar(session: AsyncSession, stmt, default_value, metric_name: str):
    """Execute scalar query safely and rollback on failure."""
    try:
        result = await session.execute(stmt)
        return result.scalar_one()
    except (
        ProgrammingError,
        DBAPIError,
    ) as exc:
        logger.warning(
            "reports/summary: metric %s failed with %s, returning default %s",
            metric_name,
            exc.__class__.__name__,
            default_value,
        )
        try:
            await session.rollback()
        except Exception:
            pass
        return default_value
    except Exception as exc:  # noqa: BLE001
        logger.error("reports/summary: unexpected error for %s: %s", metric_name, exc)
        try:
            await session.rollback()
        except Exception:
            pass
        return default_value


def _fallback_summary() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "active_reservations": 0,
        "locker_occupancy_pct": 0.0,
        "today_revenue_minor": 0,
        "total_reservations": 0,
        "report_exports_today": 0,
        "storage_used_mb": 0,
        "plan_limits": TenantPlanLimits(),
        "warnings": [],
        "report_exports_reset_at": now,
        "report_exports_remaining": None,
        "self_service_remaining": None,
        "total_revenue": 0,
        "cancelled_reservations": 0,
        "monthly_revenue": [],
        "monthly_reservations": [],
    }


@router.get("/summary", response_model=PartnerSummary)
async def partner_summary(
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> PartnerSummary:
    """Return dashboard summary metrics for the tenant."""
    defaults = PartnerSummary(
        active_reservations=0,
        locker_occupancy_pct=0.0,
        today_revenue_minor=0,
        total_reservations=0,
        report_exports_today=0,
        storage_used_mb=0,
        plan_limits=_coerce_plan_limits(None),
        warnings=[],
        report_exports_reset_at=datetime.now(timezone.utc),
        report_exports_remaining=None,
        self_service_remaining=None,
        total_revenue=0,
        cancelled_reservations=0,
        monthly_revenue=[],
        monthly_reservations=[],
    )

    tenant_id = getattr(current_user, "tenant_id", None)
    if not tenant_id:
        logger.warning("reports/summary: current_user has no tenant_id; returning zeros")
        return defaults

    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        logger.warning("reports/summary: tenant not found; returning zeros")
        return defaults

    locker_stmt = select(func.count()).select_from(Locker).where(Locker.tenant_id == tenant_id)
    locker_count = await _safe_scalar(session, locker_stmt, 0, "locker_count")

    total_res_stmt = select(func.count()).select_from(Reservation).where(Reservation.tenant_id == tenant_id)
    total_reservations = await _safe_scalar(session, total_res_stmt, 0, "total_reservations")

    active_res_stmt = select(func.count()).select_from(Reservation).where(
        Reservation.tenant_id == tenant_id,
        Reservation.status.in_([ReservationStatus.RESERVED.value, ReservationStatus.ACTIVE.value]),
    )
    active_reservations = await _safe_scalar(session, active_res_stmt, 0, "active_reservations")

    cancelled_res_stmt = select(func.count()).select_from(Reservation).where(
        Reservation.tenant_id == tenant_id,
        Reservation.status == ReservationStatus.CANCELLED.value,
    )
    cancelled_reservations = await _safe_scalar(session, cancelled_res_stmt, 0, "cancelled_reservations")

    revenue_stmt = select(func.coalesce(func.sum(Payment.amount_minor), 0)).where(
        Payment.tenant_id == tenant_id,
        Payment.status == PaymentStatus.PAID.value,
    )
    revenue_minor = await _safe_scalar(session, revenue_stmt, 0, "revenue_minor")

    try:
        exports_today = await report_exports_last24h(session, tenant_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("reports/summary: report_exports_last24h failed, defaulting to 0", exc_info=exc)
        exports_today = 0

    try:
        storage_used_mb = await get_storage_usage_mb(session, tenant_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("reports/summary: get_storage_usage_mb failed, defaulting to 0", exc_info=exc)
        storage_used_mb = 0

    try:
        self_service_today = await self_service_reservations_last24h(session, tenant_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("reports/summary: self_service_reservations_last24h failed, defaulting to 0", exc_info=exc)
        self_service_today = 0

    try:
        limits_raw = await get_plan_limits_for_tenant(session, tenant_id)
        limits = _coerce_plan_limits(limits_raw)
    except Exception as exc:  # noqa: BLE001
        logger.warning("reports/summary: get_plan_limits_for_tenant failed, using empty limits", exc_info=exc)
        limits = _coerce_plan_limits(None)

    occupancy_pct = 0.0
    if locker_count:
        occupancy_pct = round(min(active_reservations / locker_count * 100, 100), 2)

    warnings: list[LimitWarning] = []
    report_reset_at = datetime.combine(datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc) + timedelta(days=1)
    report_remaining = None
    if getattr(limits, "max_report_exports_daily", None) is not None:
        report_remaining = max(limits.max_report_exports_daily - exports_today, 0)
    self_service_remaining = None
    if getattr(limits, "max_self_service_daily", None) is not None:
        self_service_remaining = max(limits.max_self_service_daily - self_service_today, 0)

    def maybe_warn(limit, usage: int, label: str) -> None:
        if limit is None:
            return
        remaining = max(limit - usage, 0)
        if limit == 0:
            return
        ratio = usage / limit if limit else 0
        if ratio >= 1:
            warnings.append(
                LimitWarning(
                    type=label,
                    message=f"{label} limiti aşıldı",
                    remaining=0,
                )
            )
        elif ratio >= 0.9:
            warnings.append(
                LimitWarning(
                    type=label,
                    message=f"{label} limitine çok yaklaşıldı ({usage}/{limit})",
                    remaining=remaining,
                )
            )

    maybe_warn(getattr(limits, "max_active_reservations", None), int(active_reservations), "Aktif rezervasyon")
    maybe_warn(getattr(limits, "max_reservations_total", None), int(total_reservations), "Toplam rezervasyon")
    maybe_warn(getattr(limits, "max_report_exports_daily", None), exports_today, "Rapor export")
    maybe_warn(getattr(limits, "max_self_service_daily", None), self_service_today, "Self-service rezervasyon")
    maybe_warn(getattr(limits, "max_storage_mb", None), storage_used_mb, "Depolama")

    return PartnerSummary(
        active_reservations=int(active_reservations or 0),
        locker_occupancy_pct=occupancy_pct,
        today_revenue_minor=int(revenue_minor or 0),
        total_reservations=int(total_reservations or 0),
        report_exports_today=exports_today,
        storage_used_mb=storage_used_mb,
        plan_limits=_coerce_plan_limits(limits),
        warnings=warnings,
        report_exports_reset_at=report_reset_at,
        report_exports_remaining=report_remaining,
        self_service_remaining=self_service_remaining,
        total_revenue=int(revenue_minor or 0),
        cancelled_reservations=int(cancelled_reservations or 0),
        monthly_revenue=[],
        monthly_reservations=[],
    )


@router.post("/reservations/export-log")
async def register_reservation_export(
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
):
    """Track a reservation export action and enforce plan limits."""
    tenant_id = current_user.tenant_id
    if tenant_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant context required")

    limits = await get_plan_limits_for_tenant(session, tenant_id)
    exports_today = await report_exports_last24h(session, tenant_id)
    if limits.max_report_exports_daily is not None and exports_today >= limits.max_report_exports_daily:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Plan limit reached: maximum report exports for today",
        )

    await record_audit(
        session,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        action="report.reservations.export",
        entity="reports",
        entity_id=tenant_id,
    )
    await session.commit()

    remaining = None
    if limits.max_report_exports_daily is not None:
        remaining = max(limits.max_report_exports_daily - (exports_today + 1), 0)
    return {"remaining": remaining}


@router.get("/partner-overview")
async def get_partner_overview(
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
):
    """Get comprehensive analytics overview for partner dashboard.
    
    Returns:
        - summary: Total revenue, reservations, active reservations, occupancy rate
        - daily: Last 30 days of daily revenue
        - by_location: Revenue and reservation counts by location
        - by_storage: Most used storages (top 10)
    """
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant context required")
    
    # Summary metrics
    total_revenue_stmt = select(func.coalesce(func.sum(Payment.amount_minor), 0)).where(
        Payment.tenant_id == tenant_id,
        Payment.status == PaymentStatus.PAID.value,
    )
    total_revenue_minor = await _safe_scalar(session, total_revenue_stmt, 0, "total_revenue")
    
    total_reservations_stmt = select(func.count()).select_from(Reservation).where(
        Reservation.tenant_id == tenant_id
    )
    total_reservations = await _safe_scalar(session, total_reservations_stmt, 0, "total_reservations")
    
    active_reservations_stmt = select(func.count()).select_from(Reservation).where(
        Reservation.tenant_id == tenant_id,
        Reservation.status.in_([ReservationStatus.RESERVED.value, ReservationStatus.ACTIVE.value]),
    )
    active_reservations = await _safe_scalar(session, active_reservations_stmt, 0, "active_reservations")
    
    # Calculate occupancy rate
    storage_count_stmt = select(func.count()).select_from(Storage).where(Storage.tenant_id == tenant_id)
    storage_count = await _safe_scalar(session, storage_count_stmt, 0, "storage_count")
    
    occupancy_rate = 0.0
    if storage_count > 0:
        occupancy_rate = round(min(active_reservations / storage_count * 100, 100), 2)
    
    # Daily revenue for last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    daily_revenue = []
    
    try:
        # Get daily revenue grouped by date
        from sqlalchemy import cast, Date
        daily_stmt = select(
            cast(Payment.created_at, Date).label('date'),
            func.sum(Payment.amount_minor).label('revenue_minor')
        ).where(
            Payment.tenant_id == tenant_id,
            Payment.status == PaymentStatus.PAID.value,
            Payment.created_at >= thirty_days_ago
        ).group_by(
            cast(Payment.created_at, Date)
        ).order_by(
            cast(Payment.created_at, Date)
        )
        
        result = await session.execute(daily_stmt)
        daily_data = result.fetchall()
        
        for row in daily_data:
            daily_revenue.append({
                "date": row.date.isoformat() if row.date else "",
                "revenue_minor": int(row.revenue_minor or 0)
            })
    except Exception as exc:
        logger.warning(f"Failed to get daily revenue: {exc}")
    
    # Revenue by location
    by_location = []
    
    try:
        from sqlalchemy.orm import aliased
        
        # Join reservations with payments and locations
        location_stmt = select(
            Location.id.label('location_id'),
            Location.name.label('location_name'),
            func.coalesce(func.sum(Payment.amount_minor), 0).label('revenue_minor'),
            func.count(Reservation.id).label('reservations')
        ).select_from(Location).outerjoin(
            Storage, Storage.location_id == Location.id
        ).outerjoin(
            Reservation, Reservation.storage_id == Storage.id
        ).outerjoin(
            Payment, Payment.reservation_id == Reservation.id
        ).where(
            Location.tenant_id == tenant_id
        ).group_by(
            Location.id, Location.name
        ).order_by(
            func.coalesce(func.sum(Payment.amount_minor), 0).desc()
        ).limit(5)
        
        result = await session.execute(location_stmt)
        location_data = result.fetchall()
        
        for row in location_data:
            by_location.append({
                "location_name": row.location_name or "Unknown",
                "revenue_minor": int(row.revenue_minor or 0),
                "reservations": int(row.reservations or 0)
            })
    except Exception as exc:
        logger.warning(f"Failed to get revenue by location: {exc}")
    
    # Most used storages
    by_storage = []
    
    try:
        storage_stmt = select(
            Storage.id.label('storage_id'),
            Storage.code.label('storage_code'),
            Location.name.label('location_name'),
            func.count(Reservation.id).label('reservations')
        ).select_from(Storage).join(
            Location, Location.id == Storage.location_id
        ).outerjoin(
            Reservation, Reservation.storage_id == Storage.id
        ).where(
            Storage.tenant_id == tenant_id
        ).group_by(
            Storage.id, Storage.code, Location.name
        ).order_by(
            func.count(Reservation.id).desc()
        ).limit(10)
        
        result = await session.execute(storage_stmt)
        storage_data = result.fetchall()
        
        for row in storage_data:
            by_storage.append({
                "storage_code": row.storage_code or "Unknown",
                "location_name": row.location_name or "Unknown",
                "reservations": int(row.reservations or 0)
            })
    except Exception as exc:
        logger.warning(f"Failed to get storage usage: {exc}")
    
    return {
        "summary": {
            "total_revenue_minor": int(total_revenue_minor),
            "total_reservations": int(total_reservations),
            "active_reservations": int(active_reservations),
            "occupancy_rate": occupancy_rate
        },
        "daily": daily_revenue,
        "by_location": by_location,
        "by_storage": by_storage
    }
