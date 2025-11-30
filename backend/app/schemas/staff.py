"""Staff (eleman) management schemas."""

from typing import List, Optional

from pydantic import BaseModel, Field

from .base import IdentifiedModel


class StaffCreate(BaseModel):
    """Create staff assignment."""
    user_id: str = Field(..., description="User ID to assign as staff")
    storage_ids: Optional[List[str]] = Field(default=None, description="List of storage IDs to assign")
    location_ids: Optional[List[str]] = Field(default=None, description="List of location IDs (all storages in those locations)")


class StaffUpdate(BaseModel):
    """Update staff assignment."""
    storage_ids: Optional[List[str]] = None
    location_ids: Optional[List[str]] = None


class StaffRead(IdentifiedModel):
    """Staff read schema."""
    tenant_id: str
    user_id: str
    assigned_storage_ids: List[str]
    assigned_location_ids: Optional[List[str]]

