"""Schemas for admin user management."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from ..models.enums import UserRole
from .base import IdentifiedModel


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Minimum 8 karakter parola.")
    role: UserRole = UserRole.STAFF
    tenant_id: Optional[str] = Field(default=None, description="Tenant bağlamı; super_admin için boş bırakılabilir.")
    phone_number: Optional[str] = Field(default=None, max_length=32)
    require_phone_verification_on_next_login: bool = Field(default=False)
    is_active: bool = Field(default=True)


class AdminUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8)
    role: Optional[UserRole] = None
    tenant_id: Optional[str] = None
    phone_number: Optional[str] = Field(default=None, max_length=32)
    require_phone_verification_on_next_login: Optional[bool] = None
    is_active: Optional[bool] = None


class AdminUserRead(IdentifiedModel):
    email: EmailStr
    tenant_id: Optional[str]
    role: UserRole
    phone_number: Optional[str] = None
    is_active: bool
    require_phone_verification_on_next_login: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime


