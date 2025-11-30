"""Storage request/response schemas."""

from typing import Optional

from pydantic import BaseModel, Field

from ..models.enums import StorageStatus
from .base import IdentifiedModel


class StorageCreate(BaseModel):
    location_id: str
    code: Optional[str] = Field(default=None, min_length=1, max_length=64)
    status: StorageStatus = StorageStatus.IDLE
    capacity: Optional[int] = Field(default=1, ge=1, description="Storage capacity in abstract units")


class StorageUpdate(BaseModel):
    location_id: Optional[str] = None
    code: Optional[str] = Field(default=None, min_length=1, max_length=64)
    status: Optional[StorageStatus] = None
    capacity: Optional[int] = Field(default=None, ge=1)


class StorageRead(IdentifiedModel):
    location_id: str
    code: str
    status: StorageStatus
    capacity: int


# Backward compatibility aliases
LockerCreate = StorageCreate
LockerUpdate = StorageUpdate
LockerRead = StorageRead
