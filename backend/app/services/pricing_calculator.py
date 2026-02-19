"""Centralized pricing calculation service.

This module provides a single source of truth for all pricing calculations.
It should be used for:
- Widget reservation price estimates
- Payment amount calculation
- Invoice generation

HIERARCHICAL PRICING PRIORITY (highest to lowest):
1. STORAGE scope: storage_id matches
2. LOCATION scope: location_id matches
3. TENANT scope: only tenant_id matches, no location/storage specified
4. GLOBAL scope: tenant_id is None (fallback for all)
"""

import logging
from datetime import datetime
from math import ceil
from typing import Optional, NamedTuple

from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import PricingRule, Reservation
from ..models.pricing import PricingScope

logger = logging.getLogger(__name__)


class PriceCalculation(NamedTuple):
    """Result of a price calculation."""
    total_minor: int  # Total price in minor units (kuruş)
    duration_hours: float  # Duration in hours
    duration_days: int  # Duration in days
    hourly_rate_minor: int  # Hourly rate used
    daily_rate_minor: int  # Daily rate used
    pricing_type: str  # hourly or daily
    currency: str  # Currency code (e.g., TRY)
    baggage_count: int  # Number of items
    rule_id: Optional[str]  # Pricing rule ID used
    rule_scope: Optional[str] = None  # Scope of the rule used


async def get_applicable_pricing_rule(
    session: AsyncSession,
    tenant_id: str,
    location_id: Optional[str] = None,
    storage_id: Optional[str] = None,
) -> Optional[PricingRule]:
    """Find the most applicable pricing rule using hierarchical scope.
    
    Priority order (highest to lowest):
    1. STORAGE scope: Exact storage match
    2. LOCATION scope: Exact location match
    3. TENANT scope: Tenant-level default
    4. GLOBAL scope: System-wide fallback
    
    Within the same scope level, higher priority value wins.
    """
    
    # 1. Try STORAGE scope first (highest priority)
    if storage_id:
        stmt = (
            select(PricingRule)
            .where(
                PricingRule.is_active == True,
                PricingRule.scope == PricingScope.STORAGE,
                PricingRule.storage_id == storage_id,
            )
            .order_by(PricingRule.priority.desc(), PricingRule.created_at.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        rule = result.scalar_one_or_none()
        if rule:
            logger.debug(f"Found STORAGE-level pricing rule: {rule.id}")
            return rule
    
    # 2. Try LOCATION scope
    if location_id:
        stmt = (
            select(PricingRule)
            .where(
                PricingRule.is_active == True,
                PricingRule.scope == PricingScope.LOCATION,
                PricingRule.location_id == location_id,
            )
            .order_by(PricingRule.priority.desc(), PricingRule.created_at.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        rule = result.scalar_one_or_none()
        if rule:
            logger.debug(f"Found LOCATION-level pricing rule: {rule.id}")
            return rule
    
    # 3. Try TENANT scope
    stmt = (
        select(PricingRule)
        .where(
            PricingRule.is_active == True,
            PricingRule.scope == PricingScope.TENANT,
            PricingRule.tenant_id == tenant_id,
        )
        .order_by(PricingRule.priority.desc(), PricingRule.created_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    rule = result.scalar_one_or_none()
    if rule:
        logger.debug(f"Found TENANT-level pricing rule: {rule.id}")
        return rule
    
    # 4. Fallback to GLOBAL scope
    stmt = (
        select(PricingRule)
        .where(
            PricingRule.is_active == True,
            PricingRule.scope == PricingScope.GLOBAL,
            PricingRule.tenant_id.is_(None),
        )
        .order_by(PricingRule.priority.desc(), PricingRule.created_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    rule = result.scalar_one_or_none()
    if rule:
        logger.debug(f"Found GLOBAL-level pricing rule: {rule.id}")
        return rule
    
    # 5. Legacy fallback: Try old tenant-specific rules without scope field
    stmt = (
        select(PricingRule)
        .where(
            PricingRule.is_active == True,
            or_(
                PricingRule.tenant_id == tenant_id,
                PricingRule.tenant_id.is_(None),
            ),
        )
        .order_by(
            (PricingRule.tenant_id == tenant_id).desc(),
            PricingRule.priority.desc(),
            PricingRule.created_at.desc(),
        )
        .limit(1)
    )
    result = await session.execute(stmt)
    rule = result.scalar_one_or_none()
    if rule:
        logger.debug(f"Found legacy pricing rule: {rule.id}")
    
    return rule


def calculate_duration(
    start_datetime: datetime,
    end_datetime: datetime,
) -> tuple[float, int]:
    """Calculate duration in hours and days.
    
    Returns:
        Tuple of (hours, days) where:
        - hours is the exact duration in hours (can be fractional)
        - days is the number of full/partial days (ceiling)
    """
    duration = end_datetime - start_datetime
    hours = duration.total_seconds() / 3600
    
    # For days, we use ceiling - even partial days count as full days
    days = max(1, ceil(hours / 24))
    
    return hours, days


async def calculate_reservation_price(
    session: AsyncSession,
    tenant_id: str,
    start_datetime: datetime,
    end_datetime: datetime,
    baggage_count: int = 1,
    location_id: Optional[str] = None,
    storage_id: Optional[str] = None,
    pricing_rule: Optional[PricingRule] = None,
) -> PriceCalculation:
    """Calculate the price for a reservation.
    
    This is the SINGLE source of truth for all pricing calculations.
    Uses hierarchical pricing: STORAGE > LOCATION > TENANT > GLOBAL
    
    Args:
        session: Database session
        tenant_id: Tenant ID
        start_datetime: Reservation start
        end_datetime: Reservation end
        baggage_count: Number of luggage items
        location_id: Optional location for location-specific pricing
        storage_id: Optional storage for storage-specific pricing
        pricing_rule: Optional pre-fetched pricing rule
        
    Returns:
        PriceCalculation with all pricing details
        
    Raises:
        No exception - returns default pricing if no rule found
    """
    # Get pricing rule if not provided
    if pricing_rule is None:
        pricing_rule = await get_applicable_pricing_rule(
            session, tenant_id, location_id, storage_id
        )
    
    # Default pricing if no rule found
    if pricing_rule is None:
        logger.warning(f"No pricing rule found for tenant {tenant_id}, using defaults")
        hourly_rate = 1500  # 15 TL
        daily_rate = 15000  # 150 TL
        pricing_type = "daily"
        currency = "TRY"
        rule_id = None
        rule_scope = None
        minimum_charge = 1500
    else:
        hourly_rate = pricing_rule.price_per_hour_minor
        daily_rate = pricing_rule.price_per_day_minor
        pricing_type = pricing_rule.pricing_type
        currency = pricing_rule.currency
        rule_id = pricing_rule.id
        rule_scope = getattr(pricing_rule, 'scope', 'TENANT')  # Default for legacy rules
        minimum_charge = pricing_rule.minimum_charge_minor
    
    # Calculate duration
    hours, days = calculate_duration(start_datetime, end_datetime)
    
    # Calculate base price based on pricing type
    if pricing_type == "hourly":
        # For hourly pricing, use ceiling of hours
        billable_hours = max(1, ceil(hours))
        base_price = billable_hours * hourly_rate
    else:
        # For daily pricing, use number of days
        base_price = days * daily_rate
    
    # Apply minimum charge
    base_price = max(base_price, minimum_charge)
    
    # Multiply by baggage count
    total_price = base_price * max(1, baggage_count)
    
    logger.debug(
        f"Price calculated: {total_price} {currency} for {hours:.1f}h / {days}d, "
        f"{baggage_count} items, type={pricing_type}, scope={rule_scope}"
    )
    
    return PriceCalculation(
        total_minor=total_price,
        duration_hours=hours,
        duration_days=days,
        hourly_rate_minor=hourly_rate,
        daily_rate_minor=daily_rate,
        pricing_type=pricing_type,
        currency=currency,
        baggage_count=baggage_count,
        rule_id=rule_id,
        rule_scope=rule_scope,
    )


async def calculate_price_for_reservation(
    session: AsyncSession,
    reservation: Reservation,
) -> PriceCalculation:
    """Calculate price for an existing reservation object.
    
    Convenience wrapper around calculate_reservation_price.
    Uses hierarchical pricing: STORAGE > LOCATION > TENANT > GLOBAL
    """
    start_dt = reservation.start_datetime or reservation.start_at
    end_dt = reservation.end_datetime or reservation.end_at
    
    if not start_dt or not end_dt:
        # Fallback: use checkin/checkout dates if datetime not available
        from datetime import time
        start_dt = datetime.combine(reservation.checkin_date, time(14, 0)) if reservation.checkin_date else datetime.now()
        end_dt = datetime.combine(reservation.checkout_date, time(12, 0)) if reservation.checkout_date else start_dt
    
    baggage_count = getattr(reservation, "baggage_count", 1) or getattr(reservation, "luggage_count", 1) or 1
    storage_id = getattr(reservation, "storage_id", None)
    location_id = getattr(reservation, "location_id", None)
    if not location_id and getattr(reservation, "storage", None) is not None:
        location_id = getattr(reservation.storage, "location_id", None)

    return await calculate_reservation_price(
        session=session,
        tenant_id=reservation.tenant_id,
        start_datetime=start_dt,
        end_datetime=end_dt,
        baggage_count=baggage_count,
        location_id=location_id,
        storage_id=storage_id,
    )
