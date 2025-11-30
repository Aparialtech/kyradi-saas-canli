"""Pricing models for storage reservations."""

from typing import Optional
from sqlalchemy import String, Integer, Float, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, IdentifiedMixin, TimestampMixin


class PricingRule(IdentifiedMixin, TimestampMixin, Base):
    """Fiyatlandırma kuralları - tenant bazlı veya global."""
    
    __tablename__ = "pricing_rules"
    
    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,  # None = global pricing
        index=True,
    )
    
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
    
    # Priority (higher = more important, used when multiple rules exist)
    priority: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    
    # Notes/description
    notes: Mapped[Optional[str]] = mapped_column(String(500), default=None)
    
    tenant: Mapped[Optional["Tenant"]] = relationship("Tenant", back_populates="pricing_rules")

