"""Revenue, commission and settlement models."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, IdentifiedMixin, TimestampMixin


class Settlement(IdentifiedMixin, TimestampMixin, Base):
    """Hakediş kayıtları - her ödeme işlemi için otel hakedişi ve Kyradi komisyonu."""

    __tablename__ = "settlements"

    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    reservation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Financial amounts (in minor units, e.g., kuruş for TRY)
    total_amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    tenant_settlement_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    kyradi_commission_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="TRY", nullable=False)
    
    # Status
    status: Mapped[str] = mapped_column(
        String(32),
        default="pending",
        nullable=False,
        index=True,
    )  # pending, settled, cancelled
    
    # Settlement date
    settled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=None)
    
    # Commission rate used (as percentage, e.g., 5.0 for 5%)
    commission_rate: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="settlements")
    payment: Mapped["Payment"] = relationship("Payment", back_populates="settlement")
    reservation: Mapped["Reservation"] = relationship("Reservation")

    @property
    def total_amount(self) -> float:
        """Return total amount in major currency units."""
        return self.total_amount_minor / 100.0

    @property
    def tenant_settlement(self) -> float:
        """Return tenant settlement amount in major currency units."""
        return self.tenant_settlement_minor / 100.0

    @property
    def kyradi_commission(self) -> float:
        """Return Kyradi commission in major currency units."""
        return self.kyradi_commission_minor / 100.0

