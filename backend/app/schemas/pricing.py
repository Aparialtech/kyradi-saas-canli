"""Pricing schemas for API.

Hierarchical Pricing Scopes:
- GLOBAL: Applies to all tenants (fallback)
- TENANT: Applies to a specific tenant
- LOCATION: Applies to a specific location
- STORAGE: Applies to a specific storage (highest priority)
"""

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_serializer, model_validator


# Scope type for pricing rules
PricingScopeType = Literal["GLOBAL", "TENANT", "LOCATION", "STORAGE"]


class PricingRuleCreate(BaseModel):
    """Schema for creating a pricing rule."""
    
    # Hierarchical scope
    scope: PricingScopeType = Field(
        default="TENANT", 
        description="Pricing scope: GLOBAL, TENANT, LOCATION, or STORAGE"
    )
    location_id: Optional[str] = Field(
        default=None, 
        description="Location ID (required for LOCATION scope)"
    )
    storage_id: Optional[str] = Field(
        default=None, 
        description="Storage ID (required for STORAGE scope)"
    )
    name: Optional[str] = Field(
        default=None, 
        max_length=100,
        description="Human-readable name for this rule"
    )
    
    # Pricing configuration
    pricing_type: str = Field(default="daily", description="daily, hourly, weekly, monthly")
    price_per_hour_minor: int = Field(default=1500, description="Price per hour in kuruş")
    price_per_day_minor: int = Field(default=15000, description="Price per day in kuruş")
    price_per_week_minor: int = Field(default=90000, description="Price per week in kuruş")
    price_per_month_minor: int = Field(default=300000, description="Price per month in kuruş")
    minimum_charge_minor: int = Field(default=1500, description="Minimum charge in kuruş")
    currency: str = Field(default="TRY", max_length=3)
    is_active: bool = Field(default=True)
    priority: int = Field(default=0, description="Higher priority rules take precedence")
    notes: Optional[str] = Field(default=None, max_length=500)

    @model_validator(mode='after')
    def validate_scope_requirements(self):
        """Validate that required fields are set based on scope."""
        if self.scope == "LOCATION" and not self.location_id:
            raise ValueError("location_id is required for LOCATION scope")
        if self.scope == "STORAGE" and not self.storage_id:
            raise ValueError("storage_id is required for STORAGE scope")
        return self


class PricingRuleUpdate(BaseModel):
    """Schema for updating a pricing rule."""
    
    scope: Optional[PricingScopeType] = None
    location_id: Optional[str] = None
    storage_id: Optional[str] = None
    name: Optional[str] = Field(default=None, max_length=100)
    pricing_type: Optional[str] = None
    price_per_hour_minor: Optional[int] = None
    price_per_day_minor: Optional[int] = None
    price_per_week_minor: Optional[int] = None
    price_per_month_minor: Optional[int] = None
    minimum_charge_minor: Optional[int] = None
    currency: Optional[str] = Field(default=None, max_length=3)
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class PricingRuleRead(BaseModel):
    """Schema for reading a pricing rule."""
    
    id: str
    tenant_id: Optional[str]
    scope: str
    location_id: Optional[str]
    storage_id: Optional[str]
    name: Optional[str]
    pricing_type: str
    price_per_hour_minor: int
    price_per_day_minor: int
    price_per_week_minor: int
    price_per_month_minor: int
    minimum_charge_minor: int
    currency: str
    is_active: bool
    priority: int
    notes: Optional[str]
    created_at: datetime
    
    # Optional resolved names for UI display
    location_name: Optional[str] = None
    storage_code: Optional[str] = None
    
    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime) -> str:
        return value.isoformat() if value else ""
    
    class Config:
        from_attributes = True

