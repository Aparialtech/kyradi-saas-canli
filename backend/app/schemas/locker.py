"""Storage request/response schemas."""

from typing import Optional, Dict, Any

from pydantic import BaseModel, Field

from ..models.enums import StorageStatus
from .base import IdentifiedModel


class DayHours(BaseModel):
    """Tek bir gün için çalışma saatleri."""
    open: str = Field(default="09:00", description="Açılış saati (HH:MM)")
    close: str = Field(default="18:00", description="Kapanış saati (HH:MM)")
    is_open: bool = Field(default=True, description="O gün açık mı")


class WorkingHours(BaseModel):
    """Haftalık çalışma saatleri."""
    monday: Optional[DayHours] = None
    tuesday: Optional[DayHours] = None
    wednesday: Optional[DayHours] = None
    thursday: Optional[DayHours] = None
    friday: Optional[DayHours] = None
    saturday: Optional[DayHours] = None
    sunday: Optional[DayHours] = None


class StorageCreate(BaseModel):
    location_id: str
    code: Optional[str] = Field(default=None, min_length=1, max_length=64)
    status: StorageStatus = StorageStatus.IDLE
    capacity: Optional[int] = Field(default=1, ge=1, description="Storage capacity in abstract units")
    working_hours: Optional[Dict[str, Any]] = Field(default=None, description="Haftalık çalışma saatleri")


class StorageUpdate(BaseModel):
    location_id: Optional[str] = None
    code: Optional[str] = Field(default=None, min_length=1, max_length=64)
    status: Optional[StorageStatus] = None
    capacity: Optional[int] = Field(default=None, ge=1)
    working_hours: Optional[Dict[str, Any]] = Field(default=None, description="Haftalık çalışma saatleri")


class StorageRead(IdentifiedModel):
    location_id: str
    code: str
    status: StorageStatus
    capacity: int
    working_hours: Optional[Dict[str, Any]] = None


# Backward compatibility aliases
LockerCreate = StorageCreate
LockerUpdate = StorageUpdate
LockerRead = StorageRead
