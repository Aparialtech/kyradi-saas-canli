"""Reservation, payment and audit ORM models."""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base, IdentifiedMixin, TimestampMixin
from .enums import PaymentStatus, PaymentProvider, PaymentMode, ReservationStatus


class Reservation(IdentifiedMixin, TimestampMixin, Base):
    """Depo rezervasyonları."""

    __tablename__ = "reservations"

    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    storage_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("storages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    
    # Backward compatibility: locker_id maps to storage_id
    @property
    def locker_id(self) -> str:
        return self.storage_id
    
    @locker_id.setter
    def locker_id(self, value: str) -> None:
        self.storage_id = value
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), default=None)  # More explicit name field
    customer_phone: Mapped[Optional[str]] = mapped_column(String(32), default=None)
    phone_number: Mapped[Optional[str]] = mapped_column(String(32), default=None)  # Alias for customer_phone
    customer_email: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    # Sensitive: Turkish National ID - store securely, never log full value
    tc_identity_number: Mapped[Optional[str]] = mapped_column(String(11), default=None, comment="TC Kimlik No - Sensitive data, mask in logs")
    passport_number: Mapped[Optional[str]] = mapped_column(String(20), default=None)
    hotel_room_number: Mapped[Optional[str]] = mapped_column(String(20), default=None)
    kvkk_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    terms_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    # Hourly reservation fields
    start_datetime: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True, comment="Start datetime for hourly reservations (alias for start_at)")
    end_datetime: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True, comment="End datetime for hourly reservations (alias for end_at)")
    duration_hours: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True, comment="Duration in hours (computed from start_datetime and end_datetime)")
    hourly_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="Hourly rate in minor currency units (e.g., kuruş for TRY)")
    estimated_total_price: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="Estimated total price in minor currency units (duration_hours * hourly_rate)")
    status: Mapped[str] = mapped_column(
        String(32),
        default=ReservationStatus.RESERVED.value,  # New reservations start as RESERVED
        nullable=False,
        index=True,
    )
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="TRY", nullable=False)
    qr_code: Mapped[Optional[str]] = mapped_column(String(64), unique=True, default=None)
    baggage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    baggage_type: Mapped[Optional[str]] = mapped_column(String(64), default=None)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, default=None)
    notes: Mapped[Optional[str]] = mapped_column(Text, default=None)
    evidence_url: Mapped[Optional[str]] = mapped_column(String(512), default=None)
    created_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    handover_by: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    handover_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=None)
    returned_by: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    returned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=None)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="reservations")
    storage: Mapped["Storage"] = relationship("Storage", back_populates="reservations")
    
    # Backward compatibility alias (property to avoid SQLAlchemy warning)
    @property
    def locker(self) -> "Storage":
        return self.storage
    payment: Mapped[Optional["Payment"]] = relationship(
        "Payment",
        back_populates="reservation",
        uselist=False,
    )
    created_by_user: Mapped[Optional["User"]] = relationship("User", back_populates="reservations")


class Payment(IdentifiedMixin, TimestampMixin, Base):
    """Ödeme kayıtları."""

    __tablename__ = "payments"

    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reservation_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("reservations.id", ondelete="CASCADE"),
        nullable=True,  # Allow null for widget flow where payment is created before reservation
        unique=False,  # Remove unique constraint to allow multiple payments per reservation (refunds, etc.)
    )
    storage_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("storages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=PaymentProvider.MAGIC_PAY.value,
    )
    mode: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=PaymentMode.GATEWAY_DEMO.value,
    )
    provider_intent_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, default=None)
    status: Mapped[str] = mapped_column(
        String(32),
        default=PaymentStatus.PENDING.value,
        nullable=False,
        index=True,
    )
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="TRY", nullable=False)
    transaction_id: Mapped[Optional[str]] = mapped_column(String(128), default=None, index=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=None)
    meta: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSON, default=None)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="payments")
    reservation: Mapped[Optional["Reservation"]] = relationship("Reservation", back_populates="payment")
    storage: Mapped[Optional["Storage"]] = relationship("Storage", back_populates="payments")
    settlement: Mapped[Optional["Settlement"]] = relationship(
        "Settlement",
        back_populates="payment",
        uselist=False,
    )


class AuditLog(IdentifiedMixin, TimestampMixin, Base):
    """Sistem eylemleri için audit kayıtları."""

    __tablename__ = "audit_logs"

    tenant_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("tenants.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    entity: Mapped[Optional[str]] = mapped_column(String(64), default=None)
    entity_id: Mapped[Optional[str]] = mapped_column(String(36), default=None)
    meta_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, default=None)

    tenant: Mapped[Optional["Tenant"]] = relationship("Tenant", back_populates="audit_logs")
    actor: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")
