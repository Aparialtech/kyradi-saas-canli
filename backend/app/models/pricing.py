"""Pricing models for storage reservations.

Hierarchical Pricing Model:
- GLOBAL: tenant_id=None, location_id=None, storage_id=None (fallback for all)
- TENANT: tenant_id=X, location_id=None, storage_id=None (tenant default)
- LOCATION: tenant_id=X, location_id=Y, storage_id=None (location-specific)
- STORAGE: tenant_id=X, storage_id=Z (storage-specific, highest priority)
"""

from typing import Optional
from sqlalchemy import String, Integer, Float, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, IdentifiedMixin, TimestampMixin


# Pricing scope constants
class PricingScope:
    GLOBAL = "GLOBAL"
    TENANT = "TENANT"
    LOCATION = "LOCATION"
    STORAGE = "STORAGE"


class PricingRule(IdentifiedMixin, TimestampMixin, Base):
    """Fiyatlandırma kuralları - hiyerarşik kapsam destekli.
    
    Priority order (highest to lowest):
    1. STORAGE scope (storage_id set)
    2. LOCATION scope (location_id set)
    3. TENANT scope (only tenant_id set)
    4. GLOBAL scope (tenant_id = None)
    """
    
    __tablename__ = "pricing_rules"
    
    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,  # None = global pricing
        index=True,
    )
    
    # Hierarchical scope: GLOBAL, TENANT, LOCATION, STORAGE
    scope: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="TENANT",
        index=True,
    )
    
    # Location-specific pricing (for LOCATION scope)
    location_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    
    # Storage-specific pricing (for STORAGE scope)
    storage_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("storages.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    
    # Human-readable name for this rule
    name: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    
    # Pricing type: hourly, daily, weekly, monthly
    pricing_type: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="daily",  # daily, hourly, weekly, monthly
    )
    
    # Base prices in kuruş (minor units)
    price_per_hour_minor: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1500,  # 15 TL per hour
    )
    
    price_per_day_minor: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=15000,  # 150 TL per day
    )
    
    price_per_week_minor: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=90000,  # 900 TL per week
    )
    
    price_per_month_minor: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=300000,  # 3000 TL per month
    )
    
    # Minimum charge (e.g., minimum 1 hour or 1 day)
    minimum_charge_minor: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1500,  # Minimum 15 TL
    )
    
    # Currency
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="TRY",
    )
    
    # Is this rule active?
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    
    # Priority (higher = more important, used when multiple rules exist at same scope level)
    priority: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    
    # Notes/description
    notes: Mapped[Optional[str]] = mapped_column(String(500), default=None)
    
    # Relationships
    tenant: Mapped[Optional["Tenant"]] = relationship("Tenant", back_populates="pricing_rules")
    location: Mapped[Optional["Location"]] = relationship("Location", back_populates="pricing_rules")
    storage: Mapped[Optional["Storage"]] = relationship("Storage", back_populates="pricing_rules")

