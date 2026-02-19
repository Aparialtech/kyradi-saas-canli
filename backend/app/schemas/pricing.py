"""Pricing schemas for API.

Hierarchical Pricing Scopes:
- GLOBAL: Applies to all tenants (fallback)
- TENANT: Applies to a specific tenant
- LOCATION: Applies to a specific location
- STORAGE: Applies to a specific storage (highest priority)
"""

import re
import html
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_serializer, model_validator, field_validator


# Scope type for pricing rules
PricingScopeType = Literal["GLOBAL", "TENANT", "LOCATION", "STORAGE"]

# Regex patterns for validation
ALPHANUMERIC_PATTERN = re.compile(r'^[a-zA-Z0-9\s\-_.,()öüçşığÖÜÇŞİĞ]+$')
CURRENCY_PATTERN = re.compile(r'^[A-Z]{3}$')
PRICING_TYPE_VALUES = {"daily", "hourly", "weekly", "monthly"}

# Dangerous patterns to block (XSS, prototype pollution, etc.)
DANGEROUS_PATTERNS = [
    r'<script',
    r'javascript:',
    r'on\w+\s*=',
    r'<svg',
    r'<iframe',
    r'<object',
    r'<embed',
    r'eval\s*\(',
    r'__proto__',
    r'_proto_',
    r'prototype',
    r'constructor',
    r'\{\s*["\'].*["\']:\s*\{',
]

def sanitize_string(value: Optional[str]) -> Optional[str]:
    """Sanitize string input to prevent XSS and injection attacks."""
    if value is None:
        return None
    
    # Check for dangerous patterns
    value_lower = value.lower()
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, value_lower, re.IGNORECASE):
            raise ValueError(f"Input contains forbidden characters or patterns")
    
    # HTML escape the string
    sanitized = html.escape(value.strip())
    
    return sanitized


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
    price_per_hour_minor: int = Field(default=1500, ge=0, le=100000000, description="Price per hour in kuruş")
    price_per_day_minor: int = Field(default=15000, ge=0, le=100000000, description="Price per day in kuruş")
    price_per_week_minor: int = Field(default=90000, ge=0, le=100000000, description="Price per week in kuruş")
    price_per_month_minor: int = Field(default=300000, ge=0, le=100000000, description="Price per month in kuruş")
    minimum_charge_minor: int = Field(default=1500, ge=0, le=100000000, description="Minimum charge in kuruş")
    currency: str = Field(default="TRY", max_length=3, pattern=r'^[A-Z]{3}$')
    is_active: bool = Field(default=True)
    priority: int = Field(default=0, ge=-100, le=100, description="Higher priority rules take precedence")
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize and validate name field."""
        if v is None:
            return None
        return sanitize_string(v)

    @field_validator('notes')
    @classmethod
    def validate_notes(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize and validate notes field."""
        if v is None:
            return None
        return sanitize_string(v)

    @field_validator('pricing_type')
    @classmethod
    def validate_pricing_type(cls, v: str) -> str:
        """Validate pricing_type is one of allowed values."""
        if v not in PRICING_TYPE_VALUES:
            raise ValueError(f"pricing_type must be one of: {', '.join(PRICING_TYPE_VALUES)}")
        return v

    @field_validator('location_id', 'storage_id')
    @classmethod
    def validate_ids(cls, v: Optional[str]) -> Optional[str]:
        """Validate ID fields contain only safe characters."""
        if v is None:
            return None
        # UUIDs should only contain hex characters and dashes
        if not re.match(r'^[a-fA-F0-9\-]+$', v):
            raise ValueError("Invalid ID format")
        return v

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
    price_per_hour_minor: Optional[int] = Field(default=None, ge=0, le=100000000)
    price_per_day_minor: Optional[int] = Field(default=None, ge=0, le=100000000)
    price_per_week_minor: Optional[int] = Field(default=None, ge=0, le=100000000)
    price_per_month_minor: Optional[int] = Field(default=None, ge=0, le=100000000)
    minimum_charge_minor: Optional[int] = Field(default=None, ge=0, le=100000000)
    currency: Optional[str] = Field(default=None, max_length=3, pattern=r'^[A-Z]{3}$')
    is_active: Optional[bool] = None
    priority: Optional[int] = Field(default=None, ge=-100, le=100)
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize and validate name field."""
        if v is None:
            return None
        return sanitize_string(v)

    @field_validator('notes')
    @classmethod
    def validate_notes(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize and validate notes field."""
        if v is None:
            return None
        return sanitize_string(v)

    @field_validator('pricing_type')
    @classmethod
    def validate_pricing_type(cls, v: Optional[str]) -> Optional[str]:
        """Validate pricing_type is one of allowed values."""
        if v is None:
            return None
        if v not in PRICING_TYPE_VALUES:
            raise ValueError(f"pricing_type must be one of: {', '.join(PRICING_TYPE_VALUES)}")
        return v

    @field_validator('location_id', 'storage_id')
    @classmethod
    def validate_ids(cls, v: Optional[str]) -> Optional[str]:
        """Validate ID fields contain only safe characters."""
        if v is None:
            return None
        if not re.match(r'^[a-fA-F0-9\-]+$', v):
            raise ValueError("Invalid ID format")
        return v


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

