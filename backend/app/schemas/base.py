"""Shared Pydantic model configuration."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base class enabling `from_orm` style conversions."""

    model_config = ConfigDict(from_attributes=True)


class TimestampedModel(ORMModel):
    """Expose creation timestamp."""

    created_at: datetime


class IdentifiedModel(TimestampedModel):
    """Expose identifier fields."""

    id: str
