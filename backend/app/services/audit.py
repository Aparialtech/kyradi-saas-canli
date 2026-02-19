"""Audit logging helper."""

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AuditLog


async def record_audit(
    session: AsyncSession,
    *,
    tenant_id: Optional[str],
    actor_user_id: Optional[str],
    action: str,
    entity: Optional[str] = None,
    entity_id: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
) -> None:
    """Persist an audit log entry."""
    log = AuditLog(
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        meta_json=meta,
    )
    session.add(log)
