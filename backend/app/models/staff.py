"""Staff (eleman) management models."""

from typing import List, Optional

from sqlalchemy import ForeignKey, String, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, IdentifiedMixin, TimestampMixin

# Association table for staff-storage assignments
staff_storage_association = Table(
    "staff_storage_assignments",
    Base.metadata,
    Column("staff_id", String(36), ForeignKey("staff.id", ondelete="CASCADE"), primary_key=True),
    Column("storage_id", String(36), ForeignKey("storages.id", ondelete="CASCADE"), primary_key=True),
)


class Staff(IdentifiedMixin, TimestampMixin, Base):
    """Eleman (staff) modeli - otel/depo atamaları ile."""

    __tablename__ = "staff"

    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    
    # Staff can be assigned to specific storages
    # Using lazy="selectin" to avoid MissingGreenlet errors in async context
    assigned_storages: Mapped[List["Storage"]] = relationship(
        "Storage",
        secondary=staff_storage_association,
        back_populates="assigned_staff",
        lazy="selectin",
    )
    
    # Staff can be assigned to specific locations (all storages in that location)
    assigned_location_ids: Mapped[Optional[str]] = mapped_column(
        String(512),
        default=None,
        comment="Comma-separated location IDs",
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="staff")
    user: Mapped["User"] = relationship("User", back_populates="staff_assignment")

