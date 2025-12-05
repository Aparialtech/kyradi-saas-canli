"""Reservation schemas."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..models.enums import ReservationStatus
from .base import IdentifiedModel


class ReservationCreate(BaseModel):
    storage_id: str = Field(..., description="Storage unit ID")
    
    # Backward compatibility: accept locker_id as alias
    class Config:
        populate_by_name = True
    
    @classmethod
    def model_validate(cls, obj, **kwargs):
        if isinstance(obj, dict) and "locker_id" in obj and "storage_id" not in obj:
            obj = obj.copy()
            obj["storage_id"] = obj.pop("locker_id")
        return super().model_validate(obj, **kwargs)
    start_at: datetime  # Backward compatibility
    end_at: datetime  # Backward compatibility
    start_datetime: Optional[datetime] = Field(default=None, description="Start datetime for hourly reservations (preferred over start_at)")
    end_datetime: Optional[datetime] = Field(default=None, description="End datetime for hourly reservations (preferred over end_at)")
    duration_hours: Optional[float] = Field(default=None, ge=0.01, description="Calculated duration in hours")
    hourly_rate: Optional[int] = Field(default=None, ge=0, description="Hourly rate in minor currency units")
    estimated_total_price: Optional[int] = Field(default=None, ge=0, description="Estimated total price in minor currency units")
    customer_name: Optional[str] = Field(default=None, max_length=255)
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=255, description="Full name of the customer")
    customer_phone: Optional[str] = Field(default=None, max_length=32)
    phone_number: Optional[str] = Field(default=None, min_length=10, max_length=32, description="Phone number (alias for customer_phone)")
    customer_email: Optional[str] = Field(default=None, max_length=255, description="Customer email address")
    tc_identity_number: Optional[str] = Field(default=None, min_length=11, max_length=11, description="Turkish National ID (TCKN) - 11 digits, sensitive data")
    passport_number: Optional[str] = Field(default=None, max_length=20, description="Passport number for non-TR guests")
    hotel_room_number: Optional[str] = Field(default=None, max_length=20, description="Hotel room number")
    kvkk_consent: Optional[bool] = Field(default=False, description="KVKK consent checkbox")
    terms_consent: Optional[bool] = Field(default=False, description="Terms and conditions consent checkbox")
    amount_minor: Optional[int] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default="TRY", min_length=3, max_length=3)
    baggage_count: Optional[int] = Field(default=1, ge=0, le=20)
    baggage_type: Optional[str] = Field(default=None, max_length=64)
    weight_kg: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = Field(default=None, max_length=2000)
    evidence_url: Optional[str] = Field(default=None, max_length=512)
    handover_by: Optional[str] = Field(default=None, max_length=255)
    handover_at: Optional[datetime] = None
    returned_by: Optional[str] = Field(default=None, max_length=255)
    returned_at: Optional[datetime] = None


class ReservationRead(IdentifiedModel):
    storage_id: str
    
    # Backward compatibility: provide locker_id as property
    @property
    def locker_id(self) -> str:
        return self.storage_id
    
    # Storage and location info (added in endpoints)
    storage_code: Optional[str] = None
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    
    customer_name: Optional[str]
    full_name: Optional[str]
    customer_phone: Optional[str]
    phone_number: Optional[str]
    customer_email: Optional[str]
    tc_identity_number: Optional[str]  # Never expose full value in logs - mask it
    passport_number: Optional[str]
    hotel_room_number: Optional[str]
    kvkk_consent: Optional[bool]
    terms_consent: Optional[bool]
    start_at: datetime  # Backward compatibility
    end_at: datetime  # Backward compatibility
    start_datetime: Optional[datetime]
    end_datetime: Optional[datetime]
    duration_hours: Optional[float]
    hourly_rate: Optional[int]
    estimated_total_price: Optional[int]
    status: ReservationStatus
    amount_minor: Optional[int]
    currency: str
    qr_code: Optional[str]
    baggage_count: int
    baggage_type: Optional[str]
    weight_kg: Optional[float]
    notes: Optional[str]
    evidence_url: Optional[str]
    handover_by: Optional[str]
    handover_at: Optional[datetime]
    returned_by: Optional[str]
    returned_at: Optional[datetime]
    payment: Optional[dict[str, Any]] = None  # Payment info added manually in endpoints


class ReservationHandoverRequest(BaseModel):
    handover_by: Optional[str] = Field(default=None, max_length=255)
    handover_at: Optional[datetime] = None
    evidence_url: Optional[str] = Field(default=None, max_length=512)
    notes: Optional[str] = Field(default=None, max_length=2000)


class ReservationReturnRequest(BaseModel):
    returned_by: Optional[str] = Field(default=None, max_length=255)
    returned_at: Optional[datetime] = None
    evidence_url: Optional[str] = Field(default=None, max_length=512)
    notes: Optional[str] = Field(default=None, max_length=2000)


class ReservationExtendRequest(BaseModel):
    new_end_at: datetime = Field(..., description="New reservation end timestamp")
    reason: Optional[str] = Field(default=None, description="Reason for extension")


class ReservationListFilter(BaseModel):
    status: Optional[ReservationStatus] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


class ReservationStatusResponse(BaseModel):
    id: str
    status: ReservationStatus
