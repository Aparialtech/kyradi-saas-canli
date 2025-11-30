"""Reporting endpoints."""

from datetime import datetime, time, timedelta, timezone

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
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
    defaults = PartnerSummary(
        active_reservations=0,
        locker_occupancy_pct=0.0,
        today_revenue_minor=0,
        total_reservations=0,
        report_exports_today=0,
        storage_used_mb=0,
        plan_limits=TenantPlanLimits(),
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
        logger.warning("reports/summary: current_user has no tenant_id, returning defaults")
        return defaults

    try:
        tenant = await session.get(Tenant, tenant_id)
        if tenant is None:
            logger.warning("reports/summary: tenant not found, returning defaults")
            return defaults

        now = datetime.now(timezone.utc)
        day_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)

        total_reservations = 0
        active_reservations = 0
        cancelled_reservations = 0

        try:
            total_reservations = (await session.execute(
                select(func.count()).where(WidgetReservation.tenant_id == tenant_id)
            )).scalar_one()
            active_reservations = (await session.execute(
                select(func.count()).where(
                    WidgetReservation.tenant_id == tenant_id,
                    WidgetReservation.status.in_(("pending", "confirmed")),
                )
            )).scalar_one()
            cancelled_reservations = (await session.execute(
                select(func.count()).where(
                    WidgetReservation.tenant_id == tenant_id,
                    WidgetReservation.status == ReservationStatus.CANCELLED.value,
                )
            )).scalar_one()
        except SQLAlchemyError as e:
            logger.warning("reports/summary: widget reservations table issue, returning defaults", exc_info=e)
            await session.rollback()
            return defaults

        locker_count = (await session.execute(
            select(func.count()).where(Locker.tenant_id == tenant_id)
        )).scalar_one()

        revenue = (await session.execute(
            select(func.coalesce(func.sum(Payment.amount_minor), 0)).where(
                Payment.tenant_id == tenant_id,
                Payment.status == PaymentStatus.PAID.value,
                Payment.paid_at >= day_start,
                Payment.paid_at < day_end,
            )
        )).scalar_one() or 0

        exports_today = await report_exports_last24h(session, tenant_id)
        storage_used_mb = await get_storage_usage_mb(session, tenant_id)
        self_service_today = await self_service_reservations_last24h(session, tenant_id)
        limits = await get_plan_limits_for_tenant(session, tenant_id)

        occupancy_pct = 0.0
        if locker_count:
            occupancy_pct = round(min(active_reservations / locker_count * 100, 100), 2)

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

        maybe_warn(limits.max_active_reservations, int(active_reservations), "Aktif rezervasyon")
        maybe_warn(limits.max_reservations_total, int(total_reservations), "Toplam rezervasyon")
        maybe_warn(limits.max_report_exports_daily, exports_today, "Rapor export")
        maybe_warn(limits.max_self_service_daily, self_service_today, "Self-service rezervasyon")
        maybe_warn(limits.max_storage_mb, storage_used_mb, "Depolama")

        return PartnerSummary(
            active_reservations=int(active_reservations),
            locker_occupancy_pct=occupancy_pct,
            today_revenue_minor=int(revenue or 0),
            total_reservations=int(total_reservations or 0),
            report_exports_today=exports_today,
            storage_used_mb=storage_used_mb,
            plan_limits=limits,
            warnings=warnings,
            report_exports_reset_at=report_reset_at,
            report_exports_remaining=report_remaining,
            self_service_remaining=self_service_remaining,
            total_revenue=int(revenue or 0),
            cancelled_reservations=int(cancelled_reservations),
            monthly_revenue=[],
            monthly_reservations=[],
        )
    except SQLAlchemyError as e:
        logger.error("reports/summary: database error, returning defaults", exc_info=e)
        try:
            await session.rollback()
        except Exception:
            pass
        return defaults
    except Exception as e:
        logger.error("reports/summary: unexpected error, returning defaults", exc_info=e)
        return defaults


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
