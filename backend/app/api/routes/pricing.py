"""Pricing management endpoints.

Supports hierarchical pricing:
- GLOBAL: System-wide default
- TENANT: Tenant-specific default
- LOCATION: Location-specific pricing
- STORAGE: Storage-specific pricing (highest priority)
"""

from datetime import datetime
from typing import List, Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...db.session import get_session
from ...dependencies import require_tenant_admin, require_tenant_operator
from ...models import PricingRule, User, Location, Storage
from ...models.pricing import PricingScope
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
    storage_id: Optional[str] = None


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
    rule_id: Optional[str] = None
    rule_scope: Optional[str] = None


@router.post("/estimate", response_model=PriceEstimateResponse)
async def estimate_price(
    payload: PriceEstimateRequest,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> PriceEstimateResponse:
    """Calculate price estimate for a reservation.
    
    Uses hierarchical pricing: STORAGE > LOCATION > TENANT > GLOBAL
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
        storage_id=payload.storage_id,
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
        rule_id=calculation.rule_id,
        rule_scope=calculation.rule_scope,
    )


async def _enrich_rule_with_names(rule: PricingRule, session: AsyncSession) -> dict:
    """Add location_name and storage_code to rule for UI display."""
    data = {
        "id": rule.id,
        "tenant_id": rule.tenant_id,
        "scope": getattr(rule, 'scope', 'TENANT'),
        "location_id": getattr(rule, 'location_id', None),
        "storage_id": getattr(rule, 'storage_id', None),
        "name": getattr(rule, 'name', None),
        "pricing_type": rule.pricing_type,
        "price_per_hour_minor": rule.price_per_hour_minor,
        "price_per_day_minor": rule.price_per_day_minor,
        "price_per_week_minor": rule.price_per_week_minor,
        "price_per_month_minor": rule.price_per_month_minor,
        "minimum_charge_minor": rule.minimum_charge_minor,
        "currency": rule.currency,
        "is_active": rule.is_active,
        "priority": rule.priority,
        "notes": rule.notes,
        "created_at": rule.created_at,
        "location_name": None,
        "storage_code": None,
    }
    
    # Fetch location name if location_id is set
    if data["location_id"]:
        location = await session.get(Location, data["location_id"])
        if location:
            data["location_name"] = location.name
    
    # Fetch storage code if storage_id is set
    if data["storage_id"]:
        storage = await session.get(Storage, data["storage_id"])
        if storage:
            data["storage_code"] = storage.code
            # Also get location name from storage if not already set
            if not data["location_name"] and storage.location_id:
                location = await session.get(Location, storage.location_id)
                if location:
                    data["location_name"] = location.name
    
    return data


@router.get("", response_model=List[PricingRuleRead])
async def list_pricing_rules(
    scope: Optional[str] = Query(None, description="Filter by scope: GLOBAL, TENANT, LOCATION, STORAGE"),
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> List[PricingRuleRead]:
    """List all pricing rules for the current tenant.
    
    Returns rules with resolved location/storage names for UI display.
    """
    stmt = select(PricingRule).where(
        or_(
            PricingRule.tenant_id == current_user.tenant_id,
            PricingRule.tenant_id.is_(None),  # Global rules
        )
    )
    
    # Apply scope filter if provided
    if scope:
        stmt = stmt.where(PricingRule.scope == scope)
    
    stmt = stmt.order_by(PricingRule.priority.desc(), PricingRule.created_at.desc())
    
    result = await session.execute(stmt)
    rules = result.scalars().all()
    
    # Enrich with location/storage names
    enriched_rules = []
    for rule in rules:
        enriched = await _enrich_rule_with_names(rule, session)
        enriched_rules.append(PricingRuleRead.model_validate(enriched))
    
    return enriched_rules


@router.post("", response_model=PricingRuleRead, status_code=status.HTTP_201_CREATED)
async def create_pricing_rule(
    payload: PricingRuleCreate,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> PricingRuleRead:
    """Create a new pricing rule for the current tenant.
    
    Scope determines the specificity:
    - GLOBAL: Applies to all tenants (admin only)
    - TENANT: Applies to this tenant
    - LOCATION: Applies to a specific location
    - STORAGE: Applies to a specific storage
    """
    # Validate location_id for LOCATION scope
    if payload.scope == "LOCATION" and payload.location_id:
        location = await session.get(Location, payload.location_id)
        if not location or location.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid location_id or access denied",
            )
    
    # Validate storage_id for STORAGE scope
    if payload.scope == "STORAGE" and payload.storage_id:
        storage = await session.get(Storage, payload.storage_id)
        if not storage or storage.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid storage_id or access denied",
            )
    
    rule = PricingRule(
        tenant_id=current_user.tenant_id if payload.scope != "GLOBAL" else None,
        scope=payload.scope,
        location_id=payload.location_id if payload.scope == "LOCATION" else None,
        storage_id=payload.storage_id if payload.scope == "STORAGE" else None,
        name=payload.name,
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
    
    logger.info(f"Created pricing rule {rule.id} (scope={payload.scope}) for tenant {current_user.tenant_id}")
    
    # Return enriched response
    enriched = await _enrich_rule_with_names(rule, session)
    return PricingRuleRead.model_validate(enriched)


@router.get("/{rule_id}", response_model=PricingRuleRead)
async def get_pricing_rule(
    rule_id: str,
    current_user: User = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_session),
) -> PricingRuleRead:
    """Get a specific pricing rule with resolved names."""
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
    
    # Return enriched response with location/storage names
    enriched = await _enrich_rule_with_names(rule, session)
    return PricingRuleRead.model_validate(enriched)


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
    
    # Validate location_id if changing to LOCATION scope
    if payload.scope == "LOCATION" and payload.location_id:
        location = await session.get(Location, payload.location_id)
        if not location or location.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid location_id or access denied",
            )
    
    # Validate storage_id if changing to STORAGE scope
    if payload.scope == "STORAGE" and payload.storage_id:
        storage = await session.get(Storage, payload.storage_id)
        if not storage or storage.tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid storage_id or access denied",
            )
    
    # Update fields
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    
    await session.commit()
    await session.refresh(rule)
    
    logger.info(f"Updated pricing rule {rule.id}")
    
    # Return enriched response
    enriched = await _enrich_rule_with_names(rule, session)
    return PricingRuleRead.model_validate(enriched)


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

