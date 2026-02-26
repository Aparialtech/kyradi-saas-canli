"""ORM models for widget reservations."""

from __future__ import annotations

from datetime import datetime, date
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WidgetConfig(Base):
    """Per-tenant widget configuration."""

    __tablename__ = "widget_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    widget_public_key: Mapped[str] = mapped_column(String(128), nullable=False)
    widget_secret: Mapped[str] = mapped_column(String(128), nullable=False)
    allowed_origins: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False)
    locale: Mapped[str] = mapped_column(String(16), default="tr-TR", nullable=False)
    theme: Mapped[str] = mapped_column(String(16), default="light", nullable=False)
    kvkk_text: Mapped[Optional[str]] = mapped_column(Text, default=None)
    form_defaults: Mapped[Optional[dict]] = mapped_column(JSON, default=None)
    notification_preferences: Mapped[Optional[dict]] = mapped_column(JSON, default=None)
    webhook_url: Mapped[Optional[str]] = mapped_column(String(512), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    reservations: Mapped[list["WidgetReservation"]] = relationship(
        "WidgetReservation",
        back_populates="config",
        cascade="all, delete-orphan",
    )


class WidgetReservation(Base):
    """Reservations generated via embedded widget."""

    __tablename__ = "widget_reservations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    config_id: Mapped[int] = mapped_column(ForeignKey("widget_configs.id", ondelete="CASCADE"), nullable=False)
    external_ref: Mapped[Optional[str]] = mapped_column(String(64), default=None)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="widget", nullable=False)
    checkin_date: Mapped[Optional[date]] = mapped_column(Date, default=None)
    checkout_date: Mapped[Optional[date]] = mapped_column(Date, default=None)
    start_datetime: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=None)
    end_datetime: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), default=None)
    baggage_count: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    locker_size: Mapped[Optional[str]] = mapped_column(String(16), default=None)
    guest_name: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    guest_email: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    guest_phone: Mapped[Optional[str]] = mapped_column(String(64), default=None)
    phone_number: Mapped[Optional[str]] = mapped_column(String(64), default=None)
    tc_identity_number: Mapped[Optional[str]] = mapped_column(String(11), default=None, comment="TC Kimlik No - Sensitive data, mask in logs")
    passport_number: Mapped[Optional[str]] = mapped_column(String(20), default=None)
    hotel_room_number: Mapped[Optional[str]] = mapped_column(String(20), default=None)
    luggage_count: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    luggage_type: Mapped[Optional[str]] = mapped_column(String(64), default=None, comment="Luggage type: Cabin, Medium, Large, Backpack, Other")
    luggage_description: Mapped[Optional[str]] = mapped_column(Text, default=None, comment="Luggage content description/summary (max 500 chars)")
    notes: Mapped[Optional[str]] = mapped_column(Text, default=None)
    # Pricing fields - calculated in widget and passed to backend for consistency
    amount_minor: Mapped[Optional[int]] = mapped_column(Integer, default=None, comment="Pre-calculated amount in minor units (kuruş) from pricing API")
    pricing_rule_id: Mapped[Optional[str]] = mapped_column(String(36), default=None, comment="ID of the pricing rule used for calculation")
    pricing_type: Mapped[Optional[str]] = mapped_column(String(32), default=None, comment="Pricing type: daily, hourly, weekly, monthly")
    currency: Mapped[str] = mapped_column(String(3), default="TRY", nullable=False, comment="Currency code")
    kvkk_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    kvkk_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    terms_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    disclosure_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, comment="Disclosure text consent (required)")
    origin: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    config: Mapped["WidgetConfig"] = relationship("WidgetConfig", back_populates="reservations")


class WebhookDelivery(Base):
    """Track webhook attempts."""

    __tablename__ = "webhook_deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_url: Mapped[str] = mapped_column(String(512), nullable=False)
    request_body: Mapped[dict] = mapped_column(JSON, nullable=False)
    signature: Mapped[Optional[str]] = mapped_column(String(256), default=None)
    status_code: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    error: Mapped[Optional[str]] = mapped_column(Text, default=None)
    delivered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
