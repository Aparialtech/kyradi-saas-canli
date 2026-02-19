"""Partner audit log endpoints."""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_tenant_operator
from ...models import AuditLog, User
from ...schemas import AuditLogRead

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=List[AuditLogRead])
async def list_tenant_audit_logs(
    action: Optional[str] = Query(default=None, description="Filtrelenecek action anahtarı"),
    entity: Optional[str] = Query(default=None, description="Varlık adı (reservations, users, vb.)"),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> List[AuditLogRead]:
    """List audit logs scoped to the current tenant."""
    stmt: Select[tuple[AuditLog]] = (
        select(AuditLog)
        .where(AuditLog.tenant_id == current_user.tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(200)
    )
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity:
        stmt = stmt.where(AuditLog.entity == entity)

    result = await session.execute(stmt)
    logs = result.scalars().all()
    return [AuditLogRead.model_validate(log) for log in logs]
