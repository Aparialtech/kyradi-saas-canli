"""Audit log schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from .base import IdentifiedModel


class AuditLogRead(IdentifiedModel):
    tenant_id: Optional[str]
    actor_user_id: Optional[str]
    action: str
    entity: Optional[str]
    entity_id: Optional[str]
    meta_json: Optional[dict]
    created_at: datetime


class AuditLogList(BaseModel):
    items: list[AuditLogRead]
    total: int
    page: int
    page_size: int
