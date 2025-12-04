"""Pricing management endpoints."""

from datetime import datetime
from typing import List, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_admin, require_tenant_operator
from ...models import PricingRule, User
from ...schemas.pricing import PricingRuleCreate, PricingRuleRead, PricingRuleUpdate
from ...services.pricing_calculator import calculate_reservation_price

router = APIRouter(prefix="/pricing", tags=["pricing"])
logger = logging.getLogger(__name__)


class PriceEstimateRequest(BaseModel):
    """Request for price estimate."""
    start_datetime: datetime
    end_datetime: datetime
    baggage_count: int = 1
    location_id: Optional[str] = None


class PriceEstimateResponse(BaseModel):
    """Price estimate response."""
    total_minor: int
    total_formatted: str
    duration_hours: float
    duration_days: int
    hourly_rate_minor: int
    daily_rate_minor: int
    pricing_type: str
    currency: str
    baggage_count: int


@router.post("/estimate", response_model=PriceEstimateResponse)
async def estimate_price(
    payload: PriceEstimateRequest,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> PriceEstimateResponse:
    """Calculate price estimate for a reservation.
    
    This endpoint uses the centralized pricing calculator to ensure
    consistent pricing across the application.
    """
    if payload.end_datetime <= payload.start_datetime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End datetime must be after start datetime",
        )
    
    calculation = await calculate_reservation_price(
        session=session,
        tenant_id=current_user.tenant_id,
        start_datetime=payload.start_datetime,
        end_datetime=payload.end_datetime,
        baggage_count=payload.baggage_count,
        location_id=payload.location_id,
    )
    
    # Format total for display
    total_major = calculation.total_minor / 100
    if calculation.currency == "TRY":
        total_formatted = f"₺{total_major:,.2f}"
    else:
        total_formatted = f"{total_major:,.2f} {calculation.currency}"
    
    return PriceEstimateResponse(
        total_minor=calculation.total_minor,
        total_formatted=total_formatted,
        duration_hours=calculation.duration_hours,
        duration_days=calculation.duration_days,
        hourly_rate_minor=calculation.hourly_rate_minor,
        daily_rate_minor=calculation.daily_rate_minor,
        pricing_type=calculation.pricing_type,
        currency=calculation.currency,
        baggage_count=calculation.baggage_count,
    )


@router.get("", response_model=List[PricingRuleRead])
async def list_pricing_rules(
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> List[PricingRuleRead]:
    """List all pricing rules for the current tenant."""
    stmt = select(PricingRule).where(
        or_(
            PricingRule.tenant_id == current_user.tenant_id,
            PricingRule.tenant_id.is_(None),  # Global rules
        )
    ).order_by(PricingRule.priority.desc(), PricingRule.created_at.desc())
    
    result = await session.execute(stmt)
    rules = result.scalars().all()
    
    return [PricingRuleRead.model_validate(rule) for rule in rules]


@router.post("", response_model=PricingRuleRead, status_code=status.HTTP_201_CREATED)
async def create_pricing_rule(
    payload: PricingRuleCreate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> PricingRuleRead:
    """Create a new pricing rule for the current tenant."""
    rule = PricingRule(
        tenant_id=current_user.tenant_id,
        pricing_type=payload.pricing_type,
        price_per_hour_minor=payload.price_per_hour_minor,
        price_per_day_minor=payload.price_per_day_minor,
        price_per_week_minor=payload.price_per_week_minor,
        price_per_month_minor=payload.price_per_month_minor,
        minimum_charge_minor=payload.minimum_charge_minor,
        currency=payload.currency,
        is_active=payload.is_active,
        priority=payload.priority,
        notes=payload.notes,
    )
    
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    
    logger.info(f"Created pricing rule {rule.id} for tenant {current_user.tenant_id}")
    
    return PricingRuleRead.model_validate(rule)


@router.get("/{rule_id}", response_model=PricingRuleRead)
async def get_pricing_rule(
    rule_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> PricingRuleRead:
    """Get a specific pricing rule."""
    rule = await session.get(PricingRule, rule_id)
    
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing rule not found",
        )
    
    # Check tenant access (allow global rules or tenant-specific rules)
    if rule.tenant_id is not None and rule.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    
    return PricingRuleRead.model_validate(rule)


@router.patch("/{rule_id}", response_model=PricingRuleRead)
async def update_pricing_rule(
    rule_id: str,
    payload: PricingRuleUpdate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> PricingRuleRead:
    """Update a pricing rule."""
    rule = await session.get(PricingRule, rule_id)
    
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing rule not found",
        )
    
    # Check tenant access
    if rule.tenant_id is not None and rule.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    
    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    
    await session.commit()
    await session.refresh(rule)
    
    logger.info(f"Updated pricing rule {rule.id}")
    
    return PricingRuleRead.model_validate(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pricing_rule(
    rule_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Delete a pricing rule."""
    rule = await session.get(PricingRule, rule_id)
    
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing rule not found",
        )
    
    # Check tenant access
    if rule.tenant_id is not None and rule.tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    
    await session.delete(rule)
    await session.commit()
    
    logger.info(f"Deleted pricing rule {rule_id}")

