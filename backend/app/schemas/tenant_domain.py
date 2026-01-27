"""Schemas for tenant domain management."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .base import ORMModel


class TenantDomainBase(BaseModel):
    domain: str = Field(..., examples=["panel.oteliniz.com"])
    domain_type: str = Field(..., examples=["CUSTOM_DOMAIN"])
    is_primary: bool = False


class TenantDomainCreate(TenantDomainBase):
    pass


class TenantDomainUpdate(BaseModel):
    domain: Optional[str] = None
    domain_type: Optional[str] = None
    status: Optional[str] = None
    is_primary: Optional[bool] = None


class TenantDomainRead(ORMModel, TenantDomainBase):
    id: str
    status: str
    verification_method: str
    verification_token: Optional[str] = None
    verification_record_name: Optional[str] = None
    verification_record_value: Optional[str] = None
    last_checked_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TenantDomainVerificationStart(BaseModel):
    status: str
    verification_token: str
    verification_record_name: str
    verification_record_value: str


class TenantDomainVerificationCheck(BaseModel):
    status: str
    verified: bool
    failure_reason: Optional[str] = None
    last_checked_at: Optional[datetime] = None
