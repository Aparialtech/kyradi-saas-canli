"""Revenue and settlement schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .base import IdentifiedModel


class SettlementRead(IdentifiedModel):
    """Settlement read schema."""
    tenant_id: str
    payment_id: str
    reservation_id: str
    total_amount_minor: int
    tenant_settlement_minor: int
    kyradi_commission_minor: int
    currency: str
    status: str
    settled_at: Optional[datetime]
    commission_rate: float
    created_at: datetime


class RevenueSummary(BaseModel):
    """Revenue summary schema."""
    total_revenue_minor: int
    tenant_settlement_minor: int
    kyradi_commission_minor: int
    transaction_count: int
    date: Optional[str] = None

