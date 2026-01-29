"""Admin diagnostics endpoints (read-only)."""

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...dependencies import require_admin_user
from ...models import User

router = APIRouter()


@router.get("/db")
async def db_diagnostics(
    tenant_id: str | None = Query(default=None),
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Return basic DB table existence + counts (read-only)."""
    tables = ["locations", "storages", "lockers", "reservations", "tickets"]
    result: dict[str, Any] = {"tenant_id": tenant_id, "tables": {}}

    for table in tables:
        reg = await session.execute(text("SELECT to_regclass(:name)"), {"name": f"public.{table}"})
        exists = reg.scalar() is not None
        info: dict[str, Any] = {"exists": exists}

        if exists:
            if tenant_id:
                count_stmt = text(f"SELECT COUNT(*) FROM {table} WHERE tenant_id = :tenant_id")
                count = (await session.execute(count_stmt, {"tenant_id": tenant_id})).scalar()
            else:
                count_stmt = text(f"SELECT COUNT(*) FROM {table}")
                count = (await session.execute(count_stmt)).scalar()
            info["count"] = int(count or 0)

        result["tables"][table] = info

    return result
