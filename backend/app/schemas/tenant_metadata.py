"""Tenant metadata schemas for quotas, financial settings, and feature flags."""

from typing import Optional
from pydantic import BaseModel, Field


class TenantQuotaSettings(BaseModel):
    """Quota limits for tenant resources."""
    max_location_count: Optional[int] = Field(default=None, ge=0, description="Maximum number of locations")
    max_storage_count: Optional[int] = Field(default=None, ge=0, description="Maximum number of storages")
    max_user_count: Optional[int] = Field(default=None, ge=0, description="Maximum number of users")
    max_reservation_count: Optional[int] = Field(default=None, ge=0, description="Maximum number of reservations")


class TenantFinancialSettings(BaseModel):
    """Financial settings for tenant."""
    commission_rate: Optional[float] = Field(default=5.0, ge=0.0, le=100.0, description="Commission rate percentage (0-100)")


class TenantFeatureFlags(BaseModel):
    """Feature flags for tenant capabilities."""
    ai_enabled: bool = Field(default=True, description="AI Assistant feature enabled")
    advanced_reports_enabled: bool = Field(default=True, description="Advanced reporting features enabled")
    payment_gateway_enabled: bool = Field(default=True, description="Payment gateway integration enabled")


class TenantMetadataUpdate(BaseModel):
    """Update tenant metadata (quotas, financial, features)."""
    quotas: Optional[TenantQuotaSettings] = None
    financial: Optional[TenantFinancialSettings] = None
    features: Optional[TenantFeatureFlags] = None


class TenantMetadataRead(BaseModel):
    """Read tenant metadata."""
    quotas: TenantQuotaSettings
    financial: TenantFinancialSettings
    features: TenantFeatureFlags

