"""Pricing calculation service."""

from datetime import datetime, timedelta
from typing import Optional
import logging

from sqlalchemy import select, or_, inspect
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import PricingRule

logger = logging.getLogger(__name__)


async def _table_exists(session: AsyncSession, table_name: str) -> bool:
    """Check if a table exists in the database."""
    try:
        # Use raw SQL to check table existence without triggering transaction issues
        from sqlalchemy import text
        result = await session.execute(
            text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = :table_name
                )
            """),
            {"table_name": table_name}
        )
        return result.scalar() is True
    except Exception:
        return False


async def get_active_pricing_rule(
    session: AsyncSession,
    tenant_id: str,
) -> Optional[PricingRule]:
    """Get the active pricing rule for a tenant.
    
    Priority order:
    1. Tenant-specific active rules (highest priority first)
    2. Global active rules (highest priority first)
    """
    # Check if table exists first to avoid transaction abort
    if not await _table_exists(session, "pricing_rules"):
        logger.debug("pricing_rules table does not exist, using default pricing")
        return None
    
    try:
        # First try tenant-specific rules
        stmt = select(PricingRule).where(
            PricingRule.tenant_id == tenant_id,
            PricingRule.is_active == True,
        ).order_by(PricingRule.priority.desc(), PricingRule.created_at.desc())
        
        result = await session.execute(stmt)
        tenant_rule = result.scalar_one_or_none()
        
        if tenant_rule:
            return tenant_rule
        
        # Fallback to global rules
        stmt = select(PricingRule).where(
            PricingRule.tenant_id.is_(None),
            PricingRule.is_active == True,
        ).order_by(PricingRule.priority.desc(), PricingRule.created_at.desc())
        
        result = await session.execute(stmt)
        global_rule = result.scalar_one_or_none()
        
        return global_rule
    except Exception as exc:
        # If any error occurs, log it and return None (will use default pricing)
        logger.warning(f"Error fetching pricing rule: {exc}", exc_info=True)
        try:
            await session.rollback()
        except Exception:
            pass  # Ignore rollback errors
        return None


async def calculate_reservation_price(
    session: AsyncSession,
    tenant_id: str,
    start_at: datetime,
    end_at: datetime,
) -> int:
    """Calculate reservation price based on pricing rules.
    
    Returns:
        Price in kuruş (minor units)
    """
    rule = await get_active_pricing_rule(session, tenant_id)
    
    if not rule:
        # Default pricing if no rule found
        duration_hours = max(int((end_at - start_at).total_seconds() // 3600) or 1, 1)
        return duration_hours * 1500  # 15 TL per hour
    
    duration = end_at - start_at
    duration_hours = duration.total_seconds() / 3600
    duration_days = duration.days
    duration_weeks = duration_days / 7
    duration_months = duration_days / 30
    
    # Calculate price based on pricing type
    if rule.pricing_type == "hourly":
        price = int(duration_hours * rule.price_per_hour_minor)
    elif rule.pricing_type == "daily":
        # Use daily rate, round up to full days
        days = max(1, int(duration_days) + (1 if duration.seconds > 0 else 0))
        price = days * rule.price_per_day_minor
    elif rule.pricing_type == "weekly":
        # Use weekly rate if duration >= 1 week, otherwise use daily
        if duration_weeks >= 1:
            weeks = max(1, int(duration_weeks) + (1 if (duration_days % 7) > 0 else 0))
            price = weeks * rule.price_per_week_minor
        else:
            days = max(1, int(duration_days) + (1 if duration.seconds > 0 else 0))
            price = days * rule.price_per_day_minor
    elif rule.pricing_type == "monthly":
        # Use monthly rate if duration >= 1 month, otherwise use daily
        if duration_months >= 1:
            months = max(1, int(duration_months) + (1 if (duration_days % 30) > 0 else 0))
            price = months * rule.price_per_month_minor
        else:
            days = max(1, int(duration_days) + (1 if duration.seconds > 0 else 0))
            price = days * rule.price_per_day_minor
    else:
        # Default to hourly
        price = int(duration_hours * rule.price_per_hour_minor)
    
    # Apply minimum charge
    price = max(price, rule.minimum_charge_minor)
    
    return price

