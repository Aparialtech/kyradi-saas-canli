"""Location and storage ORM models."""

from typing import List, Optional, TYPE_CHECKING

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, IdentifiedMixin, TimestampMixin
from .enums import StorageStatus

if TYPE_CHECKING:
    from .staff import staff_storage_association


class Location(IdentifiedMixin, TimestampMixin, Base):
    """Tenant lokasyon bilgileri."""

    __tablename__ = "locations"

    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(512), default=None)
    phone_number: Mapped[Optional[str]] = mapped_column(String(32), default=None)
    working_hours: Mapped[Optional[dict]] = mapped_column("working_hours", JSON, default=None)
    lat: Mapped[Optional[float]] = mapped_column(Float, default=None)
    lon: Mapped[Optional[float]] = mapped_column(Float, default=None)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="locations")
    storages: Mapped[List["Storage"]] = relationship(
        "Storage",
        back_populates="location",
        cascade="all, delete-orphan",
    )
    pricing_rules: Mapped[List["PricingRule"]] = relationship(
        "PricingRule",
        back_populates="location",
        cascade="all, delete-orphan",
    )
    
    # Backward compatibility alias (property to avoid SQLAlchemy warning)
    @property
    def lockers(self) -> List["Storage"]:
        return self.storages


class Storage(IdentifiedMixin, TimestampMixin, Base):
    """Bagaj depo birimlerini temsil eder."""

    __tablename__ = "storages"

    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[StorageStatus] = mapped_column(String(32), default=StorageStatus.IDLE.value, nullable=False)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=None)
    capacity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    working_hours: Mapped[Optional[dict]] = mapped_column(JSON, default=None)  # Müsaitlik saatleri

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="storages")
    location: Mapped[Location] = relationship("Location", back_populates="storages")
    reservations: Mapped[List["Reservation"]] = relationship(
        "Reservation",
        back_populates="storage",
    )
    assigned_staff: Mapped[List["Staff"]] = relationship(
        "Staff",
        secondary="staff_storage_assignments",  # Table name as string to avoid circular import
        back_populates="assigned_storages",
    )
    payments: Mapped[List["Payment"]] = relationship(
        "Payment",
        back_populates="storage",
    )
    pricing_rules: Mapped[List["PricingRule"]] = relationship(
        "PricingRule",
        back_populates="storage",
        cascade="all, delete-orphan",
    )


# Backward compatibility alias
Locker = Storage
