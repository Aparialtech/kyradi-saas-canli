"""Pricing schemas for API."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_serializer


class PricingRuleCreate(BaseModel):
    """Schema for creating a pricing rule."""
    
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


class PricingRuleUpdate(BaseModel):
    """Schema for updating a pricing rule."""
    
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
    
    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime) -> str:
        return value.isoformat() if value else ""
    
    class Config:
        from_attributes = True

