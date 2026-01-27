"""Tenant domain model for multi-domain support."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, IdentifiedMixin, TimestampMixin


class TenantDomain(IdentifiedMixin, TimestampMixin, Base):
    """Domain records associated with a tenant."""

    __tablename__ = "tenant_domains"

    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    domain: Mapped[str] = mapped_column(Text, nullable=False, index=True, unique=True)
    domain_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    verification_method: Mapped[str] = mapped_column(String(16), nullable=False, default="DNS_TXT")
    verification_token: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    verification_record_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    verification_record_value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    tenant = relationship("Tenant", back_populates="domains")
