"""Reporting schemas."""

from typing import List, Optional

from pydantic import BaseModel
from datetime import datetime

from .tenant import TenantPlanLimits


class LimitWarning(BaseModel):
    type: str
    message: str
    remaining: Optional[int] = None


class MonthlyRevenue(BaseModel):
    month: str
    amount_minor: int


class MonthlyReservations(BaseModel):
    month: str
    count: int


class PartnerSummary(BaseModel):
    active_reservations: int
    locker_occupancy_pct: float
    today_revenue_minor: int
    total_reservations: int
    report_exports_today: int
    storage_used_mb: int
    plan_limits: TenantPlanLimits
    warnings: List[LimitWarning] = []
    report_exports_reset_at: datetime
    report_exports_remaining: Optional[int] = None
    self_service_remaining: Optional[int] = None
    total_revenue: int = 0
    cancelled_reservations: int = 0
    monthly_revenue: List[MonthlyRevenue] = []
    monthly_reservations: List[MonthlyReservations] = []


class AdminTenantSummary(BaseModel):
    tenant_id: str
    tenant_name: Optional[str] = None
    tenant_slug: Optional[str] = None
    today_revenue_minor: int
    active_reservations: int
    total_revenue_30d_minor: int = 0
    total_commission_30d_minor: int = 0


class AdminDailyRevenue(BaseModel):
    date: str  # ISO date string
    revenue_minor: int
    commission_minor: int
    transaction_count: int


class AdminTopTenant(BaseModel):
    tenant_id: str
    tenant_name: str
    revenue_minor: int
    commission_minor: int


class SystemHealth(BaseModel):
    email_service_status: str  # "ok", "error", "unknown"
    email_service_last_error: Optional[str] = None
    sms_service_status: str
    sms_service_last_error: Optional[str] = None
    payment_provider_status: str
    payment_provider_last_success: Optional[datetime] = None


class AdminSummary(BaseModel):
    # Global KPIs
    total_tenants: int
    active_tenants: int
    total_users: int
    total_storages: int
    reservations_24h: int
    reservations_7d: int
    total_revenue_minor: int
    total_commission_minor: int
    
    # Tenant summaries
    tenants: List[AdminTenantSummary]
    
    # Charts data
    daily_revenue_30d: List[AdminDailyRevenue] = []
    top_tenants: List[AdminTopTenant] = []
    
    # Health indicators
    system_health: SystemHealth


class QuotaUsage(BaseModel):
    """Quota usage information for a specific resource type."""
    current: int
    limit: Optional[int] = None
    percentage: float  # 0-100
    can_create: bool


class PartnerQuotaInfo(BaseModel):
    """Partner quota information from tenant metadata."""
    locations: QuotaUsage
    storages: QuotaUsage
    users: QuotaUsage
    reservations: QuotaUsage
