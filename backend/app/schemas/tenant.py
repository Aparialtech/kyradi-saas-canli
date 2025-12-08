"""Tenant related request/response schemas."""

from typing import Optional

from pydantic import BaseModel, Field

from .base import IdentifiedModel


class TenantBase(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    plan: str = Field(default="standard", max_length=64)
    is_active: bool = True
    brand_color: Optional[str] = Field(default=None, max_length=16)
    logo_url: Optional[str] = Field(default=None, max_length=512)
    legal_name: Optional[str] = Field(default=None, max_length=255)


class TenantCreate(TenantBase):
    slug: str = Field(min_length=3, max_length=64)


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    plan: Optional[str] = Field(default=None, max_length=64)
    is_active: Optional[bool] = None
    brand_color: Optional[str] = Field(default=None, max_length=16)
    logo_url: Optional[str] = Field(default=None, max_length=512)
    legal_name: Optional[str] = Field(default=None, max_length=255)


class TenantRead(IdentifiedModel):
    slug: str
    name: str
    plan: str
    is_active: bool
    brand_color: Optional[str]
    logo_url: Optional[str]
    legal_name: Optional[str] = None


class TenantPlanLimits(BaseModel):
    max_locations: Optional[int] = None
    max_lockers: Optional[int] = None
    max_active_reservations: Optional[int] = None
    max_users: Optional[int] = None
    max_self_service_daily: Optional[int] = None
    max_reservations_total: Optional[int] = None
    max_report_exports_daily: Optional[int] = None
    max_storage_mb: Optional[int] = None


class TenantMetrics(BaseModel):
    locations: int
    lockers: int
    active_reservations: int
    total_reservations: int
    revenue_30d_minor: int
    users: int
    self_service_last24h: int
    report_exports_last24h: int
    storage_used_mb: int


class TenantDetail(BaseModel):
    tenant: TenantRead
    plan_limits: TenantPlanLimits
    metrics: TenantMetrics


class TenantPlanLimitsUpdate(BaseModel):
    plan: str = Field(min_length=1, max_length=64)
    max_locations: Optional[int] = Field(default=None, ge=0)
    max_lockers: Optional[int] = Field(default=None, ge=0)
    max_active_reservations: Optional[int] = Field(default=None, ge=0)
    max_users: Optional[int] = Field(default=None, ge=0)
    max_self_service_daily: Optional[int] = Field(default=None, ge=0)
    max_reservations_total: Optional[int] = Field(default=None, ge=0)
    max_report_exports_daily: Optional[int] = Field(default=None, ge=0)
    max_storage_mb: Optional[int] = Field(default=None, ge=0)
