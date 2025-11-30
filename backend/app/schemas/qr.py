"""QR verification schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class QRVerifyRequest(BaseModel):
    code: str = Field(min_length=4, max_length=128)


class QRVerifyResponse(BaseModel):
    valid: bool
    reservation_id: Optional[str] = None
    locker_id: Optional[str] = None
    status: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    baggage_count: Optional[int] = None
    baggage_type: Optional[str] = None
    weight_kg: Optional[float] = None
    notes: Optional[str] = None
    evidence_url: Optional[str] = None
    handover_by: Optional[str] = None
    handover_at: Optional[datetime] = None
    returned_by: Optional[str] = None
    returned_at: Optional[datetime] = None
