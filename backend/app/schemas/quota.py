"""Quota-related schemas for partner quota information."""

from typing import Optional

from pydantic import BaseModel


class PartnerQuotaLimits(BaseModel):
    """Quota limits for partner resources."""
    max_locations: Optional[int] = None
    max_storages: Optional[int] = None
    max_users: Optional[int] = None
    max_reservations: Optional[int] = None
    commission_rate: Optional[float] = None  # %


class PartnerQuotaUsage(BaseModel):
    """Current usage counts for partner resources."""
    locations_count: int
    storages_count: int
    users_count: int
    reservations_count: int


class PartnerQuotaInfo(BaseModel):
    """Complete quota information including limits and usage."""
    limits: PartnerQuotaLimits
    usage: PartnerQuotaUsage

