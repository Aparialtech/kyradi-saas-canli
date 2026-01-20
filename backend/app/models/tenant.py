"""Tenant and user related ORM models."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, IdentifiedMixin, TimestampMixin
from .enums import UserRole, DomainStatus


class Tenant(IdentifiedMixin, TimestampMixin, Base):
    """Represents a customer organization using the platform."""

    __tablename__ = "tenants"

    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[str] = mapped_column(String(64), default="standard", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    brand_color: Mapped[Optional[str]] = mapped_column(String(16), default=None)
    logo_url: Mapped[Optional[str]] = mapped_column(String(512), default=None)
    legal_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSON, default=None)
    default_hourly_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=1500, comment="Default hourly rate in minor currency units (e.g., 1500 = 15.00 TRY)")
    # Custom domain support for white-label (e.g., rezervasyon.otelim.com)
    custom_domain: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)
    domain_status: Mapped[str] = mapped_column(
        String(20), 
        default=DomainStatus.UNVERIFIED.value, 
        nullable=False,
        comment="Custom domain verification status: unverified, pending, verified, failed"
    )
    
    @property
    def safe_legal_name(self) -> Optional[str]:
        """Safe accessor for legal_name with fallback to metadata or name."""
        if hasattr(self, 'legal_name') and self.legal_name:
            return self.legal_name
        if self.metadata_ and isinstance(self.metadata_, dict):
            return self.metadata_.get("legal_name") or self.name
        return self.name

    locations: Mapped[List["Location"]] = relationship(
        "Location",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    storages: Mapped[List["Storage"]] = relationship(
        "Storage",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    
    # Backward compatibility alias (property to avoid SQLAlchemy warning)
    @property
    def lockers(self) -> List["Storage"]:
        return self.storages
    reservations: Mapped[List["Reservation"]] = relationship(
        "Reservation",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    payments: Mapped[List["Payment"]] = relationship(
        "Payment",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    settlements: Mapped[List["Settlement"]] = relationship(
        "Settlement",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    staff: Mapped[List["Staff"]] = relationship(
        "Staff",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    plan_limit: Mapped[Optional["TenantPlanLimit"]] = relationship(
        "TenantPlanLimit",
        back_populates="tenant",
        cascade="all, delete-orphan",
        uselist=False,
        single_parent=True,
    )
    pricing_rules: Mapped[List["PricingRule"]] = relationship(
        "PricingRule",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    payment_schedule: Mapped[Optional["PaymentSchedule"]] = relationship(
        "PaymentSchedule",
        back_populates="tenant",
        cascade="all, delete-orphan",
        uselist=False,
        single_parent=True,
    )
    payment_transfers: Mapped[List["PaymentTransfer"]] = relationship(
        "PaymentTransfer",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )


class User(IdentifiedMixin, TimestampMixin, Base):
    """Panel kullanıcıları."""

    __tablename__ = "users"

    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # password_encrypted: Temporarily commented out until DDL is applied
    # Will be uncommented after migration runs successfully
    # password_encrypted: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Encrypted password for admin viewing (WARNING: Security risk!)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default=UserRole.TENANT_ADMIN.value)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=None)
    require_phone_verification_on_next_login: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # For SMS verification
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Full name of the user
    birth_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # Doğum tarihi
    tc_identity_number: Mapped[Optional[str]] = mapped_column(String(11), nullable=True)  # TC Kimlik No
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # İl
    district: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # İlçe
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Adres
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # Cinsiyet: male, female, other

    tenant: Mapped[Optional[Tenant]] = relationship("Tenant", back_populates="users")
    reservations: Mapped[List["Reservation"]] = relationship(
        "Reservation",
        back_populates="created_by_user",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="actor",
    )
    password_reset_tokens: Mapped[List["PasswordResetToken"]] = relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    phone_verifications: Mapped[List["PhoneLoginVerification"]] = relationship(
        "PhoneLoginVerification",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    staff_assignment: Mapped[Optional["Staff"]] = relationship(
        "Staff",
        back_populates="user",
        uselist=False,
    )


class TenantPlanLimit(IdentifiedMixin, TimestampMixin, Base):
    """Stores per-tenant plan limit overrides."""

    __tablename__ = "tenant_plan_limits"

    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    max_locations: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_lockers: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_active_reservations: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_users: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_self_service_daily: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_reservations_total: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_report_exports_daily: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_storage_mb: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="plan_limit")
