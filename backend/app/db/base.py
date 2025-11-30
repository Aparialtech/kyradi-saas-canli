"""Declarative base class and common mixins."""

from datetime import datetime
from typing import Any, Dict
from uuid import uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def generate_uuid() -> str:
    """Return a UUID4 string for primary keys."""
    return str(uuid4())


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

    type_annotation_map: Dict[Any, Any] = {}


class TimestampMixin:
    """Mixin providing created_at timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        nullable=False,
    )


class IdentifiedMixin:
    """Mixin providing a string UUID primary key."""

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=generate_uuid,
    )
