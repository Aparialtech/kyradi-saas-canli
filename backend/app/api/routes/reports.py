"""Reporting endpoints."""

from datetime import datetime, time, timedelta, timezone
from typing import Optional

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, and_
from sqlalchemy.exc import DBAPIError, ProgrammingError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_operator
from ...models import Locker, Reservation, ReservationStatus, User, Tenant, Payment, Location, Storage
from ...models.enums import PaymentStatus
from ...schemas import PartnerSummary, TenantPlanLimits, LimitWarning
from ...schemas.quota import PartnerQuotaInfo, PartnerQuotaLimits, PartnerQuotaUsage
from ...services.limits import (
    get_plan_limits_for_tenant,
    report_exports_last24h,
    get_storage_usage_mb,
    self_service_reservations_last24h,
)
from ...services.quota_checks import (
    get_tenant_quota_from_metadata,
    check_location_quota,
    check_storage_quota,
    check_user_quota,
    check_reservation_quota,
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


@router.get("/quota", response_model=PartnerQuotaInfo)
async def get_partner_quota(
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> PartnerQuotaInfo:
    """Get quota usage information for the current tenant."""
    tenant_id = getattr(current_user, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant not found")
    
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    
    # Load limits from tenant metadata
    metadata = tenant.metadata_ or {}
    quotas = metadata.get("quotas", {})
    financial = metadata.get("financial", {})
    
    limits = PartnerQuotaLimits(
        max_locations=quotas.get("max_location_count"),
        max_storages=quotas.get("max_storage_count"),
        max_users=quotas.get("max_user_count"),
        max_reservations=quotas.get("max_reservation_count"),
        commission_rate=financial.get("commission_rate"),
    )
    
    # Load usage counts
    locations_count = await session.scalar(
        select(func.count()).select_from(Location).where(Location.tenant_id == tenant_id)
    ) or 0
    
    storages_count = await session.scalar(
        select(func.count()).select_from(Storage).where(Storage.tenant_id == tenant_id)
    ) or 0
    
    users_count = await session.scalar(
        select(func.count()).select_from(User).where(
            User.tenant_id == tenant_id,
            User.is_active.is_(True),
        )
    ) or 0
    
    reservations_count = await session.scalar(
        select(func.count()).select_from(Reservation).where(Reservation.tenant_id == tenant_id)
    ) or 0
    
    usage = PartnerQuotaUsage(
        locations_count=int(locations_count),
        storages_count=int(storages_count),
        users_count=int(users_count),
        reservations_count=int(reservations_count),
    )
    
    return PartnerQuotaInfo(limits=limits, usage=usage)


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
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    location_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
):
    """Get comprehensive analytics overview for partner dashboard.
    
    Args:
        date_from: Filter reservations/payments from this date
        date_to: Filter reservations/payments until this date
        location_id: Filter by location
        status: Filter reservations by status (reserved, active, completed, cancelled)
    
    Returns:
        - summary: Total revenue, reservations, active reservations, occupancy rate
        - daily: Daily revenue (filtered by date range or last 30 days)
        - by_location: Revenue and reservation counts by location
        - by_storage: Most used storages (top 10)
    """
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant context required")
    
    # Build base filters
    payment_filters = [
        Payment.tenant_id == tenant_id,
        Payment.status == PaymentStatus.PAID.value,
    ]
    reservation_filters = [
        Reservation.tenant_id == tenant_id,
    ]
    
    # Apply date filters
    if date_from:
        payment_filters.append(Payment.created_at >= date_from)
        reservation_filters.append(Reservation.created_at >= date_from)
    if date_to:
        payment_filters.append(Payment.created_at <= date_to)
        reservation_filters.append(Reservation.created_at <= date_to)
    
    # Apply location filter
    # Reservation doesn't have location_id directly - it's through Storage -> Location
    # Storage is already imported at the top of the file, so we use it directly here
    if location_id:
        reservation_filters.append(
            Reservation.storage_id.in_(
                select(Storage.id).where(Storage.location_id == location_id)
            )
        )
        # For payments, we need to join with reservation through storage
        payment_filters.append(
            Payment.reservation_id.in_(
                select(Reservation.id).where(
                    Reservation.storage_id.in_(
                        select(Storage.id).where(Storage.location_id == location_id)
                    )
                )
            )
        )
    
    # Apply status filter
    if status:
        reservation_filters.append(Reservation.status == status)
    
    # Summary metrics with filters
    total_revenue_stmt = select(func.coalesce(func.sum(Payment.amount_minor), 0))
    if payment_filters:
        total_revenue_stmt = total_revenue_stmt.where(and_(*payment_filters))
    total_revenue_minor = await _safe_scalar(session, total_revenue_stmt, 0, "total_revenue")
    
    total_reservations_stmt = select(func.count()).select_from(Reservation)
    if reservation_filters:
        total_reservations_stmt = total_reservations_stmt.where(and_(*reservation_filters))
    total_reservations = await _safe_scalar(session, total_reservations_stmt, 0, "total_reservations")
    
    active_reservation_filters = reservation_filters.copy()
    active_reservation_filters.append(
        Reservation.status.in_([ReservationStatus.RESERVED.value, ReservationStatus.ACTIVE.value])
    )
    active_reservations_stmt = select(func.count()).select_from(Reservation)
    if active_reservation_filters:
        active_reservations_stmt = active_reservations_stmt.where(and_(*active_reservation_filters))
    active_reservations = await _safe_scalar(session, active_reservations_stmt, 0, "active_reservations")
    
    # Calculate occupancy rate
    storage_count_stmt = select(func.count()).select_from(Storage).where(Storage.tenant_id == tenant_id)
    storage_count = await _safe_scalar(session, storage_count_stmt, 0, "storage_count")
    
    occupancy_rate = 0.0
    if storage_count > 0:
        occupancy_rate = round(min(active_reservations / storage_count * 100, 100), 2)
    
    # Daily revenue - use date range or default to last 30 days
    if not date_from:
        date_from = datetime.now(timezone.utc) - timedelta(days=30)
    if not date_to:
        date_to = datetime.now(timezone.utc)
    
    daily_revenue = []
    
    try:
        # Get daily revenue grouped by date
        from sqlalchemy import cast, Date
        daily_payment_filters = payment_filters.copy()
        if date_from:
            daily_payment_filters.append(Payment.created_at >= date_from)
        if date_to:
            daily_payment_filters.append(Payment.created_at <= date_to)
        
        daily_stmt = select(
            cast(Payment.created_at, Date).label('date'),
            func.sum(Payment.amount_minor).label('revenue_minor')
        ).where(
            *daily_payment_filters
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
        
        # Build location filters
        location_filters = [Location.tenant_id == tenant_id]
        if location_id:
            location_filters.append(Location.id == location_id)
        
        # Build reservation join filters
        reservation_join_filters = [Reservation.storage_id == Storage.id]
        if status:
            reservation_join_filters.append(Reservation.status == status)
        
        # Build payment join filters
        payment_join_filters = [
            Payment.reservation_id == Reservation.id,
            Payment.status == PaymentStatus.PAID.value
        ]
        
        # Build date filters for payments
        payment_date_filters = []
        if date_from:
            payment_date_filters.append(Payment.created_at >= date_from)
        if date_to:
            payment_date_filters.append(Payment.created_at <= date_to)
        
        # Join reservations with payments and locations
        location_stmt = select(
            Location.id.label('location_id'),
            Location.name.label('location_name'),
            func.coalesce(func.sum(Payment.amount_minor), 0).label('revenue_minor'),
            func.count(Reservation.id).label('reservations')
        ).select_from(Location).outerjoin(
            Storage, Storage.location_id == Location.id
        ).outerjoin(
            Reservation, and_(*reservation_join_filters)
        ).outerjoin(
            Payment, and_(*payment_join_filters)
        )
        
        # Apply location filters
        if location_filters:
            location_stmt = location_stmt.where(and_(*location_filters))
        
        # Apply date filters to payments
        if payment_date_filters:
            location_stmt = location_stmt.where(and_(*payment_date_filters))
        
        location_stmt = location_stmt.group_by(
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
        logger.warning("Failed to get revenue by location: %s", exc, exc_info=True)
    
    # Revenue by payment method
    by_payment_method = []
    
    try:
        method_filters = payment_filters.copy()
        if date_from:
            method_filters.append(Payment.created_at >= date_from)
        if date_to:
            method_filters.append(Payment.created_at <= date_to)
        method_filters.append(Payment.status == PaymentStatus.PAID.value)
        
        method_stmt = select(
            Payment.mode.label('method'),
            func.coalesce(func.sum(Payment.amount_minor), 0).label('revenue_minor'),
            func.count(Payment.id).label('count')
        ).where(
            *method_filters
        ).group_by(
            Payment.mode
        ).order_by(
            func.sum(Payment.amount_minor).desc()
        )
        
        result = await session.execute(method_stmt)
        method_data = result.fetchall()
        
        # Method display names
        method_names = {
            "CASH": "Nakit",
            "POS": "POS / Kart",
            "GATEWAY_DEMO": "Online (MagicPay Demo)",
            "GATEWAY_LIVE": "Online (MagicPay)",
        }
        
        for row in method_data:
            method_name = method_names.get(row.method, row.method or "Diğer")
            by_payment_method.append({
                "method": row.method or "unknown",
                "method_name": method_name,
                "revenue_minor": int(row.revenue_minor or 0),
                "count": int(row.count or 0)
            })
    except Exception as exc:
        logger.warning("Failed to get revenue by payment method: %s", exc, exc_info=True)
    
    # Most used storages
    by_storage = []
    
    try:
        storage_filters = [Storage.tenant_id == tenant_id]
        if location_id:
            storage_filters.append(Storage.location_id == location_id)
        
        reservation_join_filters = [Reservation.storage_id == Storage.id]
        if status:
            reservation_join_filters.append(Reservation.status == status)
        if date_from:
            reservation_join_filters.append(Reservation.created_at >= date_from)
        if date_to:
            reservation_join_filters.append(Reservation.created_at <= date_to)
        
        storage_stmt = select(
            Storage.id.label('storage_id'),
            Storage.code.label('storage_code'),
            Location.name.label('location_name'),
            func.count(Reservation.id).label('reservations')
        ).select_from(Storage).join(
            Location, Location.id == Storage.location_id
        ).outerjoin(
            Reservation, and_(*reservation_join_filters)
        )
        
        # Apply storage filters
        if storage_filters:
            storage_stmt = storage_stmt.where(and_(*storage_filters))
        
        storage_stmt = storage_stmt.group_by(
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
        logger.warning("Failed to get storage usage: %s", exc, exc_info=True)
    
    return {
        "summary": {
            "total_revenue_minor": int(total_revenue_minor),
            "total_reservations": int(total_reservations),
            "active_reservations": int(active_reservations),
            "occupancy_rate": occupancy_rate
        },
        "daily": daily_revenue,
        "by_location": by_location,
        "by_payment_method": by_payment_method,
        "by_storage": by_storage
    }


@router.get("/export")
async def export_reports(
    format: str = Query(default="csv", description="Export format: csv, xlsx, template"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    location_id: Optional[str] = None,
    status: Optional[str] = None,
    anonymous: bool = Query(default=False, description="Mask guest information"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
):
    """Export reservation and revenue data in various formats.
    
    Formats:
        - csv: CSV file with detailed data
        - xlsx: Excel file with detailed data
        - template: Kyradi-branded HTML/PDF report
    """
    from fastapi.responses import StreamingResponse, Response
    from sqlalchemy.orm import selectinload
    import csv
    import io
    from datetime import date
    
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant context required")
    
    try:
        # Build filters (same as partner-overview)
        reservation_filters = [Reservation.tenant_id == tenant_id]
        if date_from:
            reservation_filters.append(Reservation.created_at >= date_from)
        if date_to:
            reservation_filters.append(Reservation.created_at <= date_to)
        if location_id:
            # Reservation doesn't have location_id directly - it's through Storage -> Location
            reservation_filters.append(
                Reservation.storage_id.in_(
                    select(Storage.id).where(Storage.location_id == location_id)
                )
            )
        if status:
            reservation_filters.append(Reservation.status == status)
        
        # Fetch reservations with eager loading of related data
        stmt = (
            select(Reservation)
            .options(
                selectinload(Reservation.storage).selectinload(Storage.location)
            )
            .where(and_(*reservation_filters))
            .order_by(Reservation.created_at.desc())
        )
        result = await session.execute(stmt)
        reservations = result.scalars().all()
        
        if format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            if anonymous:
                writer.writerow([
                    "ID", "Tarih", "Durum", "Depo", "Lokasyon", 
                    "Bavul Sayısı", "Tutar", "Para Birimi"
                ])
            else:
                writer.writerow([
                    "ID", "Tarih", "Durum", "Depo", "Lokasyon",
                    "Misafir Adı", "E-posta", "Telefon", "Bavul Sayısı", "Tutar", "Para Birimi"
                ])
            
            # Write rows
            for res in reservations:
                # Safe attribute access for nested relationships
                storage = getattr(res, "storage", None)
                location = None
                if storage:
                    location = getattr(storage, "location", None)
                
                storage_code = getattr(storage, "code", "") if storage else ""
                location_name = getattr(location, "name", "") if location else ""
                
                if anonymous:
                    writer.writerow([
                        res.id,
                        res.created_at.isoformat() if res.created_at else "",
                        res.status,
                        storage_code,
                        location_name,
                        res.baggage_count or 0,
                        res.amount_minor or 0,
                        res.currency or "TRY",
                    ])
                else:
                    writer.writerow([
                        res.id,
                        res.created_at.isoformat() if res.created_at else "",
                        res.status,
                        storage_code,
                        location_name,
                        res.full_name or res.customer_name or "—",
                        res.customer_email or "—",
                        res.customer_phone or res.phone_number or "—",
                        res.baggage_count or 0,
                        res.amount_minor or 0,
                        res.currency or "TRY",
                    ])
            
            output.seek(0)
            filename = f"kyradi-report-{date.today().isoformat()}.csv"
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )
        
        elif format == "xlsx":
            try:
                import openpyxl
                from openpyxl import Workbook
            except ImportError:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="XLSX export requires openpyxl package"
                )
            
            wb = Workbook()
            ws = wb.active
            ws.title = "Rezervasyonlar"
            
            # Write header
            if anonymous:
                headers = ["ID", "Tarih", "Durum", "Depo", "Lokasyon", "Bavul Sayısı", "Tutar", "Para Birimi"]
            else:
                headers = ["ID", "Tarih", "Durum", "Depo", "Lokasyon", "Misafir Adı", "E-posta", "Telefon", "Bavul Sayısı", "Tutar", "Para Birimi"]
            
            ws.append(headers)
            
            # Write rows
            for res in reservations:
                # Safe attribute access for nested relationships
                storage = getattr(res, "storage", None)
                location = None
                if storage:
                    location = getattr(storage, "location", None)
                
                storage_code = getattr(storage, "code", "") if storage else ""
                location_name = getattr(location, "name", "") if location else ""
                
                if anonymous:
                    ws.append([
                        res.id,
                        res.created_at.isoformat() if res.created_at else "",
                        res.status,
                        storage_code,
                        location_name,
                        res.baggage_count or 0,
                        res.amount_minor or 0,
                        res.currency or "TRY",
                    ])
                else:
                    ws.append([
                        res.id,
                        res.created_at.isoformat() if res.created_at else "",
                        res.status,
                        storage_code,
                        location_name,
                        res.full_name or res.customer_name or "—",
                        res.customer_email or "—",
                        res.customer_phone or res.phone_number or "—",
                        res.baggage_count or 0,
                        res.amount_minor or 0,
                        res.currency or "TRY",
                ])
            
            output = io.BytesIO()
            wb.save(output)
            output.seek(0)
            filename = f"kyradi-report-{date.today().isoformat()}.xlsx"
            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )
        
        elif format == "template":
            # Generate Kyradi-branded HTML report
            tenant = await session.get(Tenant, tenant_id)
            tenant_name = tenant.name if tenant else "Partner"
            
            html_content = f"""
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kyradi Rapor - {date.today().isoformat()}</title>
    <style>
        body {{ font-family: 'Inter', system-ui, sans-serif; margin: 40px; color: #1a1a1a; }}
        .header {{ border-bottom: 3px solid #00a389; padding-bottom: 20px; margin-bottom: 30px; }}
        .header h1 {{ color: #00a389; margin: 0; }}
        .header p {{ color: #666; margin: 5px 0 0; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th {{ background: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; }}
        td {{ padding: 10px; border-bottom: 1px solid #e9ecef; }}
        .summary {{ background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 30px; }}
        .summary h2 {{ margin-top: 0; color: #16a34a; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Kyradi Rezervasyon Raporu</h1>
        <p>{tenant_name} • {date.today().strftime('%d %B %Y')}</p>
    </div>
    
    <div class="summary">
        <h2>Özet</h2>
        <p><strong>Toplam Rezervasyon:</strong> {len(reservations)}</p>
        <p><strong>Tarih Aralığı:</strong> {date_from.strftime('%d.%m.%Y') if date_from else 'Başlangıç'} - {date_to.strftime('%d.%m.%Y') if date_to else 'Bugün'}</p>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Tarih</th>
                <th>Durum</th>
                <th>Depo</th>
                <th>Lokasyon</th>
                {"<th>Misafir</th><th>E-posta</th><th>Telefon</th>" if not anonymous else ""}
                <th>Bavul</th>
                <th>Tutar</th>
            </tr>
        </thead>
        <tbody>
"""
            
            for res in reservations:
                # Safe attribute access for nested relationships
                storage = getattr(res, "storage", None)
                location = None
                if storage:
                    location = getattr(storage, "location", None)
                
                storage_code = getattr(storage, "code", "—") if storage else "—"
                location_name = getattr(location, "name", "—") if location else "—"
                guest_name = "***" if anonymous else (res.full_name or res.customer_name or "—")
                guest_email = "***" if anonymous else (res.customer_email or "—")
                guest_phone = "***" if anonymous else (res.customer_phone or res.phone_number or "—")
                
                html_content += f"""
            <tr>
                <td>{res.id}</td>
                <td>{res.created_at.strftime('%d.%m.%Y %H:%M') if res.created_at else '—'}</td>
                <td>{res.status}</td>
                <td>{storage_code}</td>
                <td>{location_name}</td>
                {f'<td>{guest_name}</td><td>{guest_email}</td><td>{guest_phone}</td>' if not anonymous else ''}
                <td>{res.baggage_count or 0}</td>
                <td>{(res.amount_minor or 0) / 100:.2f} {res.currency or 'TRY'}</td>
            </tr>
"""
            
            html_content += """
        </tbody>
    </table>
</body>
</html>
"""
            
            filename = f"kyradi-report-{date.today().isoformat()}.html"
            return Response(
                content=html_content,
                media_type="text/html",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported format: {format}. Use csv, xlsx, or template"
            )
    
    except Exception as exc:
        logger.error("Failed to export reports: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Export failed. Please try again or contact support."
        ) from exc
