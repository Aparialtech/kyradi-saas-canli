"""Pydantic schemas for widget reservations."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional, Sequence

from pydantic import BaseModel, EmailStr, Field, ConfigDict


class GuestInfo(BaseModel):
    name: str = Field(min_length=2, max_length=255, description="Full name")
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=255, description="Full name (alias)")
    email: EmailStr
    phone: str = Field(min_length=10, max_length=64, description="Phone number (min 10 digits)")
    phone_number: Optional[str] = Field(default=None, min_length=10, max_length=64, description="Phone number (alias)")
    tc_identity_number: Optional[str] = Field(default=None, min_length=11, max_length=11, description="Turkish National ID (TCKN) - 11 digits only")
    passport_number: Optional[str] = Field(default=None, max_length=20, description="Passport number for non-TR guests")


class ReservationSubmit(BaseModel):
    checkin_date: Optional[date] = Field(None, description="Check-in date (legacy, use start_datetime)")
    checkout_date: Optional[date] = Field(None, description="Check-out date (legacy, use end_datetime)")
    start_datetime: Optional[datetime] = Field(None, description="Start datetime for hourly reservations (required)")
    end_datetime: Optional[datetime] = Field(None, description="End datetime for hourly reservations (required)")
    baggage_count: Optional[int] = Field(default=1, ge=1, le=20, description="Number of luggage items (min 1)")
    luggage_count: Optional[int] = Field(default=None, ge=1, le=20, description="Number of luggage items (alias)")
    luggage_type: Optional[str] = Field(default=None, max_length=64, description="Luggage type: Cabin, Medium, Large, Backpack, Other")
    luggage_description: Optional[str] = Field(default=None, max_length=500, description="Luggage content description/summary")
    locker_size: Optional[str] = Field(default=None, max_length=16)
    hotel_room_number: Optional[str] = Field(default=None, max_length=20, description="Hotel room number")
    notes: Optional[str] = Field(default=None, max_length=2000, description="Additional notes")
    # Pricing fields - pre-calculated from /pricing/estimate API
    amount_minor: Optional[int] = Field(default=None, ge=0, description="Pre-calculated amount in minor currency (kuruş)")
    pricing_rule_id: Optional[str] = Field(default=None, max_length=36, description="ID of the pricing rule used")
    pricing_type: Optional[str] = Field(default=None, max_length=32, description="Pricing type: daily, hourly, weekly, monthly")
    currency: str = Field(default="TRY", max_length=3, description="Currency code")
    kvkk_approved: bool = Field(default=False, description="KVKK consent (backward compatibility)")
    kvkk_consent: bool = Field(default=False, description="KVKK consent checkbox (required)")
    terms_consent: bool = Field(default=False, description="Terms and conditions consent (required)")
    disclosure_consent: bool = Field(default=False, description="Disclosure text consent (required)")
    captcha_token: Optional[str] = None
    guest: GuestInfo
    payment_provider: Optional[str] = Field(default=None, description="Payment provider: paytr, iyzico, stripe")
    payment_intent_id: Optional[str] = Field(default=None, description="Payment intent ID if payment already initiated")


class ReservationPublicResponse(BaseModel):
    id: int
    status: str
    created_at: datetime
    payment_required: bool = False
    payment_url: Optional[str] = None
    payment_intent_id: Optional[str] = None


class ReservationListFilters(BaseModel):
    status: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    domain: Optional[str] = None


class WidgetInitResponse(BaseModel):
    access_token: str
    expires_in: int
    locale: str
    theme: str
    kvkk_text: Optional[str]


class WidgetReservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    tenant_id: str
    checkin_date: Optional[date] = None
    checkout_date: Optional[date] = None
    baggage_count: Optional[int] = None
    luggage_count: Optional[int] = None
    locker_size: Optional[str] = None
    guest_name: Optional[str] = None
    full_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    phone_number: Optional[str] = None
    tc_identity_number: Optional[str] = None
    passport_number: Optional[str] = None
    hotel_room_number: Optional[str] = None
    notes: Optional[str] = None
    luggage_type: Optional[str] = None
    luggage_description: Optional[str] = None
    kvkk_approved: Optional[bool] = None
    kvkk_consent: Optional[bool] = None
    terms_consent: Optional[bool] = None
    disclosure_consent: Optional[bool] = None
    origin: Optional[str] = None
    created_at: datetime


class WidgetReservationList(BaseModel):
    items: list[WidgetReservationRead]


class ManualReservationCreate(BaseModel):
    """Schema for creating a manual reservation from the partner panel."""
    guest_name: str = Field(min_length=2, max_length=255, description="Guest full name")
    guest_email: Optional[EmailStr] = Field(default=None, description="Guest email")
    guest_phone: str = Field(min_length=10, max_length=64, description="Guest phone number")
    tc_identity_number: Optional[str] = Field(default=None, min_length=11, max_length=11, description="Turkish National ID (TCKN)")
    passport_number: Optional[str] = Field(default=None, max_length=20, description="Passport number")
    hotel_room_number: Optional[str] = Field(default=None, max_length=20, description="Hotel room number")
    checkin_date: Optional[date] = Field(default=None, description="Check-in date")
    checkout_date: Optional[date] = Field(default=None, description="Check-out date")
    start_datetime: Optional[datetime] = Field(default=None, description="Start datetime for hourly reservations")
    end_datetime: Optional[datetime] = Field(default=None, description="End datetime for hourly reservations")
    baggage_count: int = Field(default=1, ge=1, le=20, description="Number of luggage items")
    luggage_type: Optional[str] = Field(default=None, max_length=64, description="Luggage type")
    luggage_description: Optional[str] = Field(default=None, max_length=500, description="Luggage description")
    locker_size: Optional[str] = Field(default=None, max_length=16)
    notes: Optional[str] = Field(default=None, max_length=2000, description="Additional notes")
    amount_minor: Optional[int] = Field(default=None, ge=0, description="Total amount in minor currency (kuruş)")
    payment_mode: Optional[str] = Field(default="CASH", description="Payment mode: CASH, POS, GATEWAY_DEMO, GATEWAY_LIVE")


class WidgetConfigBase(BaseModel):
    tenant_id: str
    widget_public_key: str
    allowed_origins: Sequence[str]
    locale: str = "tr-TR"
    theme: str = "light"
    kvkk_text: Optional[str] = None
    webhook_url: Optional[str] = None
    form_defaults: Optional[dict] = None
    notification_preferences: Optional[dict] = None


class WidgetConfigCreate(WidgetConfigBase):
    widget_secret: str = Field(min_length=16)


class WidgetConfigUpdate(BaseModel):
    allowed_origins: Optional[Sequence[str]] = None
    locale: Optional[str] = None
    theme: Optional[str] = None
    kvkk_text: Optional[str] = None
    webhook_url: Optional[str] = None


class WidgetConfigRead(WidgetConfigBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

