"""Payment related schemas."""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from ..models.enums import PaymentStatus
from .base import IdentifiedModel


class PaymentIntentCreate(BaseModel):
    reservation_id: str
    provider: str = Field(min_length=2, max_length=32)


class PaymentRead(IdentifiedModel):
    reservation_id: Optional[str] = None
    storage_id: Optional[str] = None
    provider: str
    mode: str
    provider_intent_id: Optional[str]
    status: PaymentStatus
    amount_minor: int
    currency: str
    transaction_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    meta: Optional[Dict[str, Any]] = None


class ReservationPaymentInfo(BaseModel):
    """Lightweight payment info for reservation/payment status checks."""

    payment_id: Optional[str] = None
    reservation_id: Optional[str] = None
    status: PaymentStatus | str
    amount_minor: int
    currency: str
    provider: Optional[str] = None
    mode: Optional[str] = None
    provider_intent_id: Optional[str] = None
    transaction_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    checkout_url: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


class PaymentWebhookPayload(BaseModel):
    """Generic payload wrapper for webhook requests."""

    provider: str
    data: Dict[str, Any]
