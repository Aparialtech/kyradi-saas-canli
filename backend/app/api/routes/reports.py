"""Reporting endpoints."""

from datetime import datetime, time, timedelta, timezone

import asyncpg
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import ProgrammingError, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_operator
from ...models import Locker, Reservation, ReservationStatus, User, Tenant, Payment
from ...models.enums import PaymentStatus
from app.reservations.models import WidgetReservation
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
    try:
        tenant_id = current_user.tenant_id
        if tenant_id is None:
            logger.warning("reports/summary: tenant context missing, returning defaults")
            return _fallback_summary()

        tenant = await session.get(Tenant, tenant_id)
        if tenant is None:
            logger.warning("reports/summary: tenant not found, returning defaults")
            return _fallback_summary()

        now = datetime.now(timezone.utc)
        day_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)

        try:
            active_stmt = select(func.count()).where(
                WidgetReservation.tenant_id == tenant_id,
                WidgetReservation.status.in_(("pending", "confirmed")),
            )
            active_count = (await session.execute(active_stmt)).scalar_one()
        except (asyncpg.exceptions.UndefinedTableError, ProgrammingError) as exc:
            if 'relation "widget_reservations"' in str(exc):
                active_count = 0
            else:
                logger.exception("reports/summary: error getting active reservations")
                return _fallback_summary()

        locker_stmt = select(func.count()).where(Locker.tenant_id == tenant_id)
        locker_count = (await session.execute(locker_stmt)).scalar_one()

        revenue_stmt = select(func.coalesce(func.sum(Payment.amount_minor), 0)).where(
            Payment.tenant_id == tenant_id,
            Payment.status == PaymentStatus.PAID.value,
            Payment.paid_at >= day_start,
            Payment.paid_at < day_end,
        )
        revenue = (await session.execute(revenue_stmt)).scalar_one() or 0

        try:
            total_reservations_stmt = select(func.count()).where(WidgetReservation.tenant_id == tenant_id)
            total_reservations = (await session.execute(total_reservations_stmt)).scalar_one()
        except (asyncpg.exceptions.UndefinedTableError, ProgrammingError) as exc:
            if 'relation "widget_reservations"' in str(exc):
                total_reservations = 0
            else:
                logger.exception("reports/summary: error getting total reservations")
                return _fallback_summary()

        exports_today = await report_exports_last24h(session, tenant_id)
        storage_used_mb = await get_storage_usage_mb(session, tenant_id)
        self_service_today = await self_service_reservations_last24h(session, tenant_id)
        limits = await get_plan_limits_for_tenant(session, tenant_id)

        occupancy_pct = 0.0
        if locker_count:
            occupancy_pct = round(min(active_count / locker_count * 100, 100), 2)

        warnings: list[LimitWarning] = []
        report_reset_at = day_end
        report_remaining = None
        if limits.max_report_exports_daily is not None:
            report_remaining = max(limits.max_report_exports_daily - exports_today, 0)
        self_service_remaining = None
        if limits.max_self_service_daily is not None:
            self_service_remaining = max(limits.max_self_service_daily - self_service_today, 0)

        def maybe_warn(limit, usage: int, label: str) -> None:
            if limit is None:
                return
            remaining = max(limit - usage, 0)
            if limit == 0:
                return
            ratio = usage / limit
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

        maybe_warn(limits.max_active_reservations, int(active_count), "Aktif rezervasyon")
        maybe_warn(limits.max_reservations_total, int(total_reservations), "Toplam rezervasyon")
        maybe_warn(limits.max_report_exports_daily, exports_today, "Rapor export")
        maybe_warn(limits.max_self_service_daily, self_service_today, "Self-service rezervasyon")
        maybe_warn(limits.max_storage_mb, storage_used_mb, "Depolama")

        plan_limits = TenantPlanLimits(
            max_locations=limits.max_locations,
            max_lockers=limits.max_lockers,
            max_active_reservations=limits.max_active_reservations,
            max_users=limits.max_users,
            max_self_service_daily=limits.max_self_service_daily,
            max_reservations_total=limits.max_reservations_total,
            max_report_exports_daily=limits.max_report_exports_daily,
            max_storage_mb=limits.max_storage_mb,
        )

        return PartnerSummary(
            active_reservations=int(active_count),
            locker_occupancy_pct=occupancy_pct,
            today_revenue_minor=int(revenue or 0),
            total_reservations=int(total_reservations or 0),
            report_exports_today=exports_today,
            storage_used_mb=storage_used_mb,
            plan_limits=plan_limits,
            warnings=warnings,
            report_exports_reset_at=report_reset_at,
            report_exports_remaining=report_remaining,
            self_service_remaining=self_service_remaining,
        )
    except Exception:
        logger.exception("reports/summary: unexpected error, returning defaults")
        return _fallback_summary()


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
