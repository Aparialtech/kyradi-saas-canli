"""Revenue and settlement endpoints."""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_accounting
from ...models import Settlement, User, Payment, Reservation, Location
from ...schemas.revenue import SettlementRead, RevenueSummary
from ...services.revenue import get_daily_revenue, get_tenant_revenue_summary, get_revenue_by_payment_mode

router = APIRouter(prefix="/revenue", tags=["revenue"])
logger = logging.getLogger(__name__)


class SettlementListResponse(BaseModel):
    """Response with settlements and totals."""
    items: List[SettlementRead]
    total_count: int
    total_income: int  # Minor units
    total_commission: int  # Minor units
    total_payout: int  # Minor units
    currency: str = "TRY"


class PaymentModeRevenue(BaseModel):
    """Revenue breakdown by payment mode."""
    mode: str
    label: str
    total_revenue_minor: int
    tenant_settlement_minor: int
    kyradi_commission_minor: int
    transaction_count: int


@router.get("/summary", response_model=RevenueSummary)
async def get_revenue_summary(
    date_from: Optional[datetime] = Query(default=None, alias="from"),
    date_to: Optional[datetime] = Query(default=None, alias="to"),
    current_user: User = Depends(require_accounting),
    session: AsyncSession = Depends(get_session),
) -> RevenueSummary:
    """Get revenue summary for the tenant."""
    summary = await get_tenant_revenue_summary(
        session,
        tenant_id=current_user.tenant_id,
        date_from=date_from,
        date_to=date_to,
    )
    return RevenueSummary(**summary)


@router.get("/daily", response_model=RevenueSummary)
async def get_daily_revenue_endpoint(
    date: Optional[datetime] = Query(default=None),
    current_user: User = Depends(require_accounting),
    session: AsyncSession = Depends(get_session),
) -> RevenueSummary:
    """Get daily revenue for today or specified date."""
    daily = await get_daily_revenue(
        session,
        tenant_id=current_user.tenant_id,
        date=date,
    )
    return RevenueSummary(**daily)


@router.get("/by-payment-mode", response_model=List[PaymentModeRevenue])
async def get_revenue_by_payment_mode_endpoint(
    date_from: Optional[datetime] = Query(default=None, alias="from"),
    date_to: Optional[datetime] = Query(default=None, alias="to"),
    current_user: User = Depends(require_accounting),
    session: AsyncSession = Depends(get_session),
) -> List[PaymentModeRevenue]:
    """Get revenue breakdown by payment mode (POS, CASH, GATEWAY)."""
    data = await get_revenue_by_payment_mode(
        session,
        tenant_id=current_user.tenant_id,
        date_from=date_from,
        date_to=date_to,
    )
    return [PaymentModeRevenue(**item) for item in data]


@router.get("/settlements", response_model=SettlementListResponse)
async def list_settlements(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    date_from: Optional[datetime] = Query(default=None, alias="from"),
    date_to: Optional[datetime] = Query(default=None, alias="to"),
    location_id: Optional[str] = Query(default=None),
    storage_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(require_accounting),
    session: AsyncSession = Depends(get_session),
) -> SettlementListResponse:
    """List settlements for the tenant with totals."""
    from ...models import Storage
    
    stmt = select(Settlement).where(Settlement.tenant_id == current_user.tenant_id)
    
    if status_filter:
        stmt = stmt.where(Settlement.status == status_filter)
    if date_from:
        stmt = stmt.where(Settlement.created_at >= date_from)
    if date_to:
        stmt = stmt.where(Settlement.created_at <= date_to)
    
    # Filter by location or storage via payment -> reservation -> storage -> location
    if location_id or storage_id:
        from sqlalchemy import and_
        # Build subquery with proper JOINs to avoid cartesian product
        # Use explicit select_from to make JOIN conditions clear
        payment_subquery = select(Payment.id)
        
        # Build the FROM clause explicitly with JOINs
        if location_id:
            # Need to join Storage to access location_id
            payment_subquery = payment_subquery.select_from(
                Payment.join(Reservation, Payment.reservation_id == Reservation.id)
                       .join(Storage, Reservation.storage_id == Storage.id)
            ).where(
                Payment.tenant_id == current_user.tenant_id,
                Reservation.tenant_id == current_user.tenant_id,
                Storage.location_id == location_id,
            )
        elif storage_id:
            # Only need Reservation for storage_id filter
            payment_subquery = payment_subquery.select_from(
                Payment.join(Reservation, Payment.reservation_id == Reservation.id)
            ).where(
                Payment.tenant_id == current_user.tenant_id,
                Reservation.tenant_id == current_user.tenant_id,
                Reservation.storage_id == storage_id,
            )
        else:
            # Just join Payment and Reservation
            payment_subquery = payment_subquery.select_from(
                Payment.join(Reservation, Payment.reservation_id == Reservation.id)
            ).where(
                Payment.tenant_id == current_user.tenant_id,
                Reservation.tenant_id == current_user.tenant_id,
            )
        
        stmt = stmt.where(Settlement.payment_id.in_(payment_subquery))
    
    # Search by payment_id or settlement id
    if search:
        stmt = stmt.where(
            Settlement.payment_id.ilike(f"%{search}%") |
            Settlement.id.ilike(f"%{search}%")
        )
    
    stmt = stmt.order_by(Settlement.created_at.desc())
    
    result = await session.execute(stmt)
    settlements = result.scalars().all()
    
    # Calculate totals
    total_income = sum(s.total_amount_minor for s in settlements)
    total_commission = sum(s.kyradi_commission_minor for s in settlements)
    total_payout = sum(s.tenant_settlement_minor for s in settlements)
    
    logger.info(
        f"Listed {len(settlements)} settlements for tenant {current_user.tenant_id}, "
        f"total_income={total_income}, total_commission={total_commission}, total_payout={total_payout}"
    )
    
    return SettlementListResponse(
        items=[SettlementRead.model_validate(s) for s in settlements],
        total_count=len(settlements),
        total_income=total_income,
        total_commission=total_commission,
        total_payout=total_payout,
        currency="TRY",
    )


@router.get("/settlements/legacy", response_model=List[SettlementRead])
async def list_settlements_legacy(
    status: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None, alias="from"),
    date_to: Optional[datetime] = Query(default=None, alias="to"),
    current_user: User = Depends(require_accounting),
    session: AsyncSession = Depends(get_session),
) -> List[SettlementRead]:
    """List settlements for the tenant (legacy format without totals)."""
    stmt = select(Settlement).where(Settlement.tenant_id == current_user.tenant_id)
    
    if status:
        stmt = stmt.where(Settlement.status == status)
    if date_from:
        stmt = stmt.where(Settlement.settled_at >= date_from)
    if date_to:
        stmt = stmt.where(Settlement.settled_at <= date_to)
    
    stmt = stmt.order_by(Settlement.created_at.desc())
    
    result = await session.execute(stmt)
    settlements = result.scalars().all()
    
    return [SettlementRead.model_validate(settlement) for settlement in settlements]

