"""Location related schemas."""

from typing import Optional

from pydantic import BaseModel, Field

from .base import IdentifiedModel


class LocationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    address: Optional[str] = Field(default=None, max_length=512)
    lat: Optional[float] = None
    lon: Optional[float] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    address: Optional[str] = Field(default=None, max_length=512)
    lat: Optional[float] = None
    lon: Optional[float] = None


class LocationRead(IdentifiedModel):
    name: str
    address: Optional[str]
    lat: Optional[float]
    lon: Optional[float]
