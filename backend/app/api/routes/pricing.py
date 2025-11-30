"""Pricing management endpoints."""

from typing import List
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_admin
from ...models import PricingRule, User
from ...schemas.pricing import PricingRuleCreate, PricingRuleRead, PricingRuleUpdate

router = APIRouter(prefix="/pricing", tags=["pricing"])
logger = logging.getLogger(__name__)


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

