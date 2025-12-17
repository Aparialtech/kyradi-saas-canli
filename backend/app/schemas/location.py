"""Location related schemas."""

from typing import Optional

from pydantic import BaseModel, Field

from .base import IdentifiedModel


class LocationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    address: Optional[str] = Field(default=None, max_length=512)
    phone_number: Optional[str] = Field(default=None, max_length=32)
    working_hours: Optional[dict] = Field(default=None, description="Working hours as JSON, e.g. {'monday': {'open': '09:00', 'close': '18:00'}}")
    lat: Optional[float] = None
    lon: Optional[float] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    address: Optional[str] = Field(default=None, max_length=512)
    phone_number: Optional[str] = Field(default=None, max_length=32)
    working_hours: Optional[dict] = Field(default=None, description="Working hours as JSON")
    lat: Optional[float] = None
    lon: Optional[float] = None


class LocationRead(IdentifiedModel):
    name: str
    address: Optional[str]
    phone_number: Optional[str]
    working_hours: Optional[dict]
    lat: Optional[float]
    lon: Optional[float]
