"""Payment schedule and transfer models for Kyradi-Hotel money transfers."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from decimal import Decimal
import enum

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Numeric, Text, Enum as SQLEnum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, IdentifiedMixin, TimestampMixin


class PaymentPeriod(str, enum.Enum):
    """Payment period types."""
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"  # Every 2 weeks
    MONTHLY = "monthly"
    CUSTOM = "custom"  # Custom number of days


class TransferStatus(str, enum.Enum):
    """Transfer status types."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PaymentSchedule(IdentifiedMixin, TimestampMixin, Base):
    """Payment schedule configuration for tenants."""

    __tablename__ = "payment_schedules"

    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    
    # Schedule settings
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    period_type: Mapped[str] = mapped_column(
        String(20),
        default=PaymentPeriod.WEEKLY.value,
        nullable=False,
    )
    custom_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # For CUSTOM period
    
    # Financial settings
    min_transfer_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        default=Decimal("100.00"),
        nullable=False,
    )
    commission_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 4),
        default=Decimal("0.05"),  # 5% default commission
        nullable=False,
    )
    
    # Bank account info
    bank_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bank_account_holder: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    bank_iban: Mapped[Optional[str]] = mapped_column(String(34), nullable=True)
    bank_swift: Mapped[Optional[str]] = mapped_column(String(11), nullable=True)
    
    # Timing
    next_payment_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_payment_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Partner control
    partner_can_request: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Notes
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="payment_schedule")
    transfers: Mapped[list["PaymentTransfer"]] = relationship("PaymentTransfer", back_populates="schedule", lazy="dynamic")

    def calculate_next_payment_date(self, from_date: Optional[datetime] = None) -> datetime:
        """Calculate the next payment date based on period type."""
        base_date = from_date or datetime.now(timezone.utc)
        
        if self.period_type == PaymentPeriod.DAILY.value:
            return base_date + timedelta(days=1)
        elif self.period_type == PaymentPeriod.WEEKLY.value:
            return base_date + timedelta(weeks=1)
        elif self.period_type == PaymentPeriod.BIWEEKLY.value:
            return base_date + timedelta(weeks=2)
        elif self.period_type == PaymentPeriod.MONTHLY.value:
            return base_date + timedelta(days=30)
        elif self.period_type == PaymentPeriod.CUSTOM.value and self.custom_days:
            return base_date + timedelta(days=self.custom_days)
        else:
            return base_date + timedelta(weeks=1)  # Default to weekly


class PaymentTransfer(IdentifiedMixin, TimestampMixin, Base):
    """Individual payment transfers to tenants."""

    __tablename__ = "payment_transfers"

    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    schedule_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("payment_schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    
    # Amount details
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)  # gross - commission
    
    # Status
    status: Mapped[str] = mapped_column(
        String(20),
        default=TransferStatus.PENDING.value,
        nullable=False,
        index=True,
    )
    
    # Transfer details
    transfer_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reference_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Bank reference
    
    # Period covered
    period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Bank details snapshot (at time of transfer)
    bank_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bank_account_holder: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    bank_iban: Mapped[Optional[str]] = mapped_column(String(34), nullable=True)
    
    # Processing info
    processed_by_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Notes and errors
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Request type
    is_manual_request: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requested_by_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    requested_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="payment_transfers")
    schedule: Mapped[Optional["PaymentSchedule"]] = relationship("PaymentSchedule", back_populates="transfers")
    processed_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[processed_by_id])
    requested_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[requested_by_id])
