"""Schemas for public self-service reservation views."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SelfServiceReservationRequest(BaseModel):
    code: str = Field(min_length=1, max_length=128)


class SelfServiceReservationResponse(BaseModel):
    reservation_id: Optional[str] = None
    tenant_slug: Optional[str] = None
    locker_code: Optional[str] = None
    location_name: Optional[str] = None
    status: str
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    customer_hint: Optional[str] = Field(
        default=None,
        description="Masked customer information to help identify the booking.",
    )
    customer_phone: Optional[str] = None
    baggage_count: Optional[int] = None
    baggage_type: Optional[str] = None
    notes: Optional[str] = None
    evidence_url: Optional[str] = None
    handover_by: Optional[str] = None
    handover_at: Optional[datetime] = None
    returned_by: Optional[str] = None
    returned_at: Optional[datetime] = None
    valid: bool = False


class SelfServiceReservationCreateRequest(BaseModel):
    tenant_slug: str = Field(min_length=1, max_length=64)
    locker_code: str = Field(min_length=1, max_length=64)
    start_at: datetime
    end_at: datetime
    customer_name: Optional[str] = Field(default=None, max_length=255)
    customer_phone: Optional[str] = Field(default=None, max_length=32)
    baggage_count: Optional[int] = Field(default=1, ge=0, le=20)
    baggage_type: Optional[str] = Field(default=None, max_length=64)
    weight_kg: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=2000)


class SelfServiceReservationCreateResponse(BaseModel):
    reservation_id: str
    qr_code: str
    status: str
    locker_code: str
    start_at: datetime
    end_at: datetime
