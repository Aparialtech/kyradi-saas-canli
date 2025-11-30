"""Revenue and settlement endpoints."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_accounting
from ...models import Settlement, User
from ...schemas.revenue import SettlementRead, RevenueSummary
from ...services.revenue import get_daily_revenue, get_tenant_revenue_summary

router = APIRouter(prefix="/revenue", tags=["revenue"])


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


@router.get("/settlements", response_model=List[SettlementRead])
async def list_settlements(
    status: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None, alias="from"),
    date_to: Optional[datetime] = Query(default=None, alias="to"),
    current_user: User = Depends(require_accounting),
    session: AsyncSession = Depends(get_session),
) -> List[SettlementRead]:
    """List settlements for the tenant."""
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

