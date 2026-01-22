"""Partner-specific reporting endpoints with unified structure.

All endpoints return real database data, no fake/mock data.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, and_, or_, cast, Date, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...db.session import get_session
from ...dependencies import require_tenant_operator
from ...models import (
    Reservation,
    ReservationStatus,
    Payment,
    PaymentStatus,
    Storage,
    Location,
    Settlement,
    User,
    Tenant,
)
from ...models.enums import PaymentStatus
from ...reservations.models import WidgetReservation

router = APIRouter(prefix="/partners/reports", tags=["partner-reports"])
logger = logging.getLogger(__name__)


# =============================================================================
# SCHEMAS
# =============================================================================

class OverviewSummary(BaseModel):
    """Overview summary metrics."""
    total_revenue_minor: int
    total_reservations: int
    active_reservations: int
    occupancy_rate: float
    total_commission_minor: int
    tenant_settlement_minor: int


class TrendDataPoint(BaseModel):
    """Single data point for trend charts."""
    date: str  # ISO date string
    revenue_minor: int
    reservations: int
    commission_minor: int


class RevenueBreakdown(BaseModel):
    """Revenue breakdown by category."""
    total_revenue_minor: int
    tenant_settlement_minor: int
    commission_minor: int
    currency: str = "TRY"


class LocationPerformance(BaseModel):
    """Location performance metrics."""
    location_id: str
    location_name: str
    revenue_minor: int
    reservations: int
    occupancy_rate: float


class StorageUsage(BaseModel):
    """Storage usage metrics."""
    storage_id: str
    storage_code: str
    location_name: str
    reservations: int
    occupancy_rate: float
    total_revenue_minor: int


class WidgetAnalytics(BaseModel):
    """Widget performance analytics."""
    total_widget_reservations: int
    converted_reservations: int
    conversion_rate: float
    revenue_from_widget_minor: int
    avg_reservation_value_minor: int
    hourly_distribution: List[dict]  # [{hour: int, count: int}]


class HourlyDistribution(BaseModel):
    """Hourly distribution data."""
    hour: int
    count: int


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/overview")
async def get_reports_overview(
    date_from: Optional[datetime] = Query(None, alias="date_from"),
    date_to: Optional[datetime] = Query(None, alias="date_to"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> OverviewSummary:
    """Get comprehensive overview metrics for partner dashboard.
    
    Returns real-time data from database:
    - Total revenue (from paid payments)
    - Total reservations
    - Active reservations
    - Occupancy rate
    - Commission breakdown
    """
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required"
        )
    
    # Default to last 30 days if no date range provided
    if not date_from:
        date_from = datetime.now(timezone.utc) - timedelta(days=30)
    if not date_to:
        date_to = datetime.now(timezone.utc)
    
    # Total revenue from paid payments
    revenue_stmt = select(
        func.coalesce(func.sum(Payment.amount_minor), 0).label("total_revenue")
    ).where(
        Payment.tenant_id == tenant_id,
        Payment.status == PaymentStatus.PAID.value,
        Payment.created_at >= date_from,
        Payment.created_at <= date_to,
    )
    total_revenue_result = await session.execute(revenue_stmt)
    total_revenue_minor = int(total_revenue_result.scalar_one() or 0)
    
    # Total reservations
    total_res_stmt = select(func.count()).select_from(Reservation).where(
        Reservation.tenant_id == tenant_id,
        Reservation.created_at >= date_from,
        Reservation.created_at <= date_to,
    )
    total_reservations = int((await session.execute(total_res_stmt)).scalar_one() or 0)
    
    # Active reservations
    active_res_stmt = select(func.count()).select_from(Reservation).where(
        Reservation.tenant_id == tenant_id,
        Reservation.status.in_([
            ReservationStatus.RESERVED.value,
            ReservationStatus.ACTIVE.value,
        ]),
    )
    active_reservations = int((await session.execute(active_res_stmt)).scalar_one() or 0)
    
    # Storage count for occupancy
    storage_count_stmt = select(func.count()).select_from(Storage).where(
        Storage.tenant_id == tenant_id,
    )
    storage_count = int((await session.execute(storage_count_stmt)).scalar_one() or 0)
    
    occupancy_rate = 0.0
    if storage_count > 0:
        occupancy_rate = round(min(active_reservations / storage_count * 100, 100), 2)
    
    # Commission calculation (from settlements)
    commission_stmt = select(
        func.coalesce(func.sum(Settlement.kyradi_commission_minor), 0).label("commission")
    ).where(
        Settlement.tenant_id == tenant_id,
        Settlement.created_at >= date_from,
        Settlement.created_at <= date_to,
    )
    commission_result = await session.execute(commission_stmt)
    total_commission_minor = int(commission_result.scalar_one() or 0)
    
    # Tenant settlement
    tenant_settlement_minor = total_revenue_minor - total_commission_minor
    
    return OverviewSummary(
        total_revenue_minor=total_revenue_minor,
        total_reservations=total_reservations,
        active_reservations=active_reservations,
        occupancy_rate=occupancy_rate,
        total_commission_minor=total_commission_minor,
        tenant_settlement_minor=max(tenant_settlement_minor, 0),
    )


@router.get("/trends")
async def get_reports_trends(
    date_from: Optional[datetime] = Query(None, alias="date_from"),
    date_to: Optional[datetime] = Query(None, alias="date_to"),
    granularity: str = Query("daily", description="daily, weekly, monthly"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> List[TrendDataPoint]:
    """Get trend data for revenue and reservations over time.
    
    Returns time-series data for charts.
    """
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required"
        )
    
    if not date_from:
        date_from = datetime.now(timezone.utc) - timedelta(days=30)
    if not date_to:
        date_to = datetime.now(timezone.utc)
    
    # Group by date based on granularity
    if granularity == "daily":
        reservation_date_expr = cast(Reservation.created_at, Date)
        payment_date_expr = cast(Payment.created_at, Date)
    elif granularity == "weekly":
        # Extract week start (Monday)
        reservation_date_expr = func.date_trunc("week", Reservation.created_at)
        payment_date_expr = func.date_trunc("week", Payment.created_at)
    elif granularity == "monthly":
        reservation_date_expr = func.date_trunc("month", Reservation.created_at)
        payment_date_expr = func.date_trunc("month", Payment.created_at)
    else:
        reservation_date_expr = cast(Reservation.created_at, Date)
        payment_date_expr = cast(Payment.created_at, Date)
    
    # Get reservation counts by date
    reservation_trends_stmt = select(
        reservation_date_expr.label("date"),
        func.count(Reservation.id).label("reservations")
    ).where(
        Reservation.tenant_id == tenant_id,
        Reservation.created_at >= date_from,
        Reservation.created_at <= date_to,
    ).group_by(
        reservation_date_expr
    ).order_by(
        reservation_date_expr
    )
    
    reservation_trends = await session.execute(reservation_trends_stmt)
    reservation_data = {row.date: row.reservations for row in reservation_trends}
    
    # Get revenue by date (from payments)
    revenue_trends_stmt = select(
        payment_date_expr.label("date"),
        func.coalesce(func.sum(Payment.amount_minor), 0).label("revenue_minor")
    ).where(
        Payment.tenant_id == tenant_id,
        Payment.status == PaymentStatus.PAID.value,
        Payment.created_at >= date_from,
        Payment.created_at <= date_to,
    ).group_by(
        payment_date_expr
    ).order_by(
        payment_date_expr
    )
    
    # Get commission separately from settlements
    commission_trends_stmt = select(
        payment_date_expr.label("date"),
        func.coalesce(func.sum(Settlement.kyradi_commission_minor), 0).label("commission_minor")
    ).select_from(
        Payment
    ).outerjoin(
        Settlement, Settlement.payment_id == Payment.id
    ).where(
        Payment.tenant_id == tenant_id,
        Payment.status == PaymentStatus.PAID.value,
        Payment.created_at >= date_from,
        Payment.created_at <= date_to,
    ).group_by(
        payment_date_expr
    ).order_by(
        payment_date_expr
    )
    
    revenue_trends = await session.execute(revenue_trends_stmt)
    revenue_data = {row.date: int(row.revenue_minor or 0) for row in revenue_trends}
    
    commission_trends = await session.execute(commission_trends_stmt)
    commission_data = {row.date: int(row.commission_minor or 0) for row in commission_trends}
    
    # Combine all dates
    all_dates = set(reservation_data.keys()) | set(revenue_data.keys())
    trends = []
    
    for date_val in sorted(all_dates):
        trends.append(TrendDataPoint(
            date=date_val.isoformat() if hasattr(date_val, "isoformat") else str(date_val),
            revenue_minor=revenue_data.get(date_val, 0),
            reservations=reservation_data.get(date_val, 0),
            commission_minor=commission_data.get(date_val, 0),
        ))
    
    return trends


@router.get("/revenues")
async def get_reports_revenues(
    date_from: Optional[datetime] = Query(None, alias="date_from"),
    date_to: Optional[datetime] = Query(None, alias="date_to"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> RevenueBreakdown:
    """Get detailed revenue breakdown with commission calculations."""
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required"
        )
    
    if not date_from:
        date_from = datetime.now(timezone.utc) - timedelta(days=30)
    if not date_to:
        date_to = datetime.now(timezone.utc)
    
    # Total revenue from paid payments
    revenue_stmt = select(
        func.coalesce(func.sum(Payment.amount_minor), 0)
    ).where(
        Payment.tenant_id == tenant_id,
        Payment.status == PaymentStatus.PAID.value,
        Payment.created_at >= date_from,
        Payment.created_at <= date_to,
    )
    total_revenue_minor = int((await session.execute(revenue_stmt)).scalar_one() or 0)
    
    # Commission from settlements
    commission_stmt = select(
        func.coalesce(func.sum(Settlement.kyradi_commission_minor), 0)
    ).where(
        Settlement.tenant_id == tenant_id,
        Settlement.created_at >= date_from,
        Settlement.created_at <= date_to,
    )
    commission_minor = int((await session.execute(commission_stmt)).scalar_one() or 0)
    
    # Tenant settlement
    tenant_settlement_minor = total_revenue_minor - commission_minor
    
    return RevenueBreakdown(
        total_revenue_minor=total_revenue_minor,
        tenant_settlement_minor=max(tenant_settlement_minor, 0),
        commission_minor=commission_minor,
        currency="TRY",
    )


@router.get("/hakedis")
async def get_reports_hakedis(
    date_from: Optional[datetime] = Query(None, alias="date_from"),
    date_to: Optional[datetime] = Query(None, alias="date_to"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
):
    """Get settlement (hakediş) data for the tenant."""
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required"
        )
    
    if not date_from:
        date_from = datetime.now(timezone.utc) - timedelta(days=30)
    if not date_to:
        date_to = datetime.now(timezone.utc)
    
    # Get settlements
    settlements_stmt = select(Settlement).where(
        Settlement.tenant_id == tenant_id,
        Settlement.created_at >= date_from,
        Settlement.created_at <= date_to,
    ).order_by(
        Settlement.created_at.desc()
    )
    
    settlements = (await session.execute(settlements_stmt)).scalars().all()
    
    return {
        "items": [
            {
                "id": s.id,
                "payment_id": s.payment_id,
                "total_amount_minor": s.total_amount_minor,
                "tenant_settlement_minor": s.tenant_settlement_minor,
                "kyradi_commission_minor": s.kyradi_commission_minor,
                "status": s.status,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in settlements
        ],
        "total_count": len(settlements),
        "total_settlement_minor": sum(s.tenant_settlement_minor for s in settlements),
        "total_commission_minor": sum(s.kyradi_commission_minor for s in settlements),
    }


@router.get("/storage-usage")
async def get_reports_storage_usage(
    date_from: Optional[datetime] = Query(None, alias="date_from"),
    date_to: Optional[datetime] = Query(None, alias="date_to"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> List[StorageUsage]:
    """Get storage usage metrics with occupancy rates."""
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required"
        )
    
    if not date_from:
        date_from = datetime.now(timezone.utc) - timedelta(days=30)
    if not date_to:
        date_to = datetime.now(timezone.utc)
    
    # Get all storages for tenant
    storages_stmt = (
        select(Storage)
        .options(selectinload(Storage.location))
        .join(Location, Location.id == Storage.location_id)
        .where(Storage.tenant_id == tenant_id)
    )
    
    storages = (await session.execute(storages_stmt)).scalars().all()
    
    storage_usage = []
    
    for storage in storages:
        # Count reservations for this storage
        reservation_count_stmt = select(func.count()).select_from(Reservation).where(
            Reservation.storage_id == storage.id,
            Reservation.created_at >= date_from,
            Reservation.created_at <= date_to,
        )
        reservation_count = int((await session.execute(reservation_count_stmt)).scalar_one() or 0)
        
        # Calculate revenue from reservations using this storage
        revenue_stmt = select(
            func.coalesce(func.sum(Payment.amount_minor), 0)
        ).select_from(
            Payment
        ).join(
            Reservation, 
            and_(
                Reservation.id == Payment.reservation_id,
                Reservation.tenant_id == tenant_id,
                Reservation.storage_id == storage.id
            )
        ).where(
            Payment.tenant_id == tenant_id,
            Payment.status == PaymentStatus.PAID.value,
            Payment.created_at >= date_from,
            Payment.created_at <= date_to,
        )
        revenue_minor = int((await session.execute(revenue_stmt)).scalar_one() or 0)
        
        # Occupancy rate (simplified: reservations / capacity)
        capacity = getattr(storage, "capacity", 1) or 1
        occupancy_rate = round(min(reservation_count / capacity * 100, 100), 2) if capacity > 0 else 0.0
        
        storage_usage.append(StorageUsage(
            storage_id=storage.id,
            storage_code=storage.code or "Unknown",
            location_name=storage.location.name if storage.location else "Unknown",
            reservations=reservation_count,
            occupancy_rate=occupancy_rate,
            total_revenue_minor=revenue_minor,
        ))
    
    # Sort by reservations descending
    storage_usage.sort(key=lambda x: x.reservations, reverse=True)
    
    return storage_usage


@router.get("/widget-analytics")
async def get_reports_widget_analytics(
    date_from: Optional[datetime] = Query(None, alias="date_from"),
    date_to: Optional[datetime] = Query(None, alias="date_to"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> WidgetAnalytics:
    """Get widget performance analytics.
    
    Returns:
    - Total widget reservations
    - Conversion rate (widget -> normal reservation)
    - Revenue from widget
    - Hourly distribution
    """
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required"
        )
    
    if not date_from:
        date_from = datetime.now(timezone.utc) - timedelta(days=30)
    if not date_to:
        date_to = datetime.now(timezone.utc)
    
    # Total widget reservations
    widget_reservations_stmt = select(func.count()).select_from(WidgetReservation).where(
        WidgetReservation.tenant_id == tenant_id,
        WidgetReservation.created_at >= date_from,
        WidgetReservation.created_at <= date_to,
    )
    total_widget_reservations = int((await session.execute(widget_reservations_stmt)).scalar_one() or 0)
    
    # Converted reservations (widget reservations that have been converted to normal reservations)
    # We check if there's a normal reservation with matching dates/guest info
    # This is a simplified check - in production you might want a conversion tracking table
    converted_count = 0
    if total_widget_reservations > 0:
        # Get widget reservations
        widget_res_stmt = select(WidgetReservation).where(
            WidgetReservation.tenant_id == tenant_id,
            WidgetReservation.created_at >= date_from,
            WidgetReservation.created_at <= date_to,
        )
        widget_reservations = (await session.execute(widget_res_stmt)).scalars().all()
        
        for widget_res in widget_reservations:
            # Check if there's a matching normal reservation
            # Match by guest name and dates
            match_stmt = select(func.count()).select_from(Reservation).where(
                Reservation.tenant_id == tenant_id,
                or_(
                    Reservation.full_name == widget_res.guest_name,
                    Reservation.full_name == widget_res.full_name,
                ),
                Reservation.start_at == widget_res.checkin_date if widget_res.checkin_date else True,
            )
            match_count = int((await session.execute(match_stmt)).scalar_one() or 0)
            if match_count > 0:
                converted_count += 1
    
    conversion_rate = (converted_count / total_widget_reservations * 100) if total_widget_reservations > 0 else 0.0
    
    # Revenue from widget (simplified: revenue from reservations that match widget reservation patterns)
    # In production, you'd track this via a conversion table
    revenue_from_widget_minor = 0
    if converted_count > 0:
        # Estimate: use average reservation value
        avg_revenue_stmt = select(
            func.coalesce(func.avg(Payment.amount_minor), 0)
        ).where(
            Payment.tenant_id == tenant_id,
            Payment.status == PaymentStatus.PAID.value,
            Payment.created_at >= date_from,
            Payment.created_at <= date_to,
        )
        avg_revenue = int((await session.execute(avg_revenue_stmt)).scalar_one() or 0)
        revenue_from_widget_minor = avg_revenue * converted_count
    
    # Hourly distribution
    hourly_dist_stmt = select(
        func.extract("hour", WidgetReservation.created_at).label("hour"),
        func.count(WidgetReservation.id).label("count")
    ).where(
        WidgetReservation.tenant_id == tenant_id,
        WidgetReservation.created_at >= date_from,
        WidgetReservation.created_at <= date_to,
    ).group_by(
        func.extract("hour", WidgetReservation.created_at)
    ).order_by(
        func.extract("hour", WidgetReservation.created_at)
    )
    
    hourly_dist = await session.execute(hourly_dist_stmt)
    hourly_distribution = [
        {"hour": int(row.hour), "count": int(row.count)}
        for row in hourly_dist
    ]
    
    avg_reservation_value = (
        revenue_from_widget_minor // converted_count
        if converted_count > 0
        else 0
    )
    
    return WidgetAnalytics(
        total_widget_reservations=total_widget_reservations,
        converted_reservations=converted_count,
        conversion_rate=round(conversion_rate, 2),
        revenue_from_widget_minor=revenue_from_widget_minor,
        avg_reservation_value_minor=avg_reservation_value,
        hourly_distribution=hourly_distribution,
    )
