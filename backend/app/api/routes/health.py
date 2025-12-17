"""Lightweight health-check endpoints for production monitoring."""

from __future__ import annotations

import logging
from typing import Any, Dict, Tuple

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session

router = APIRouter(prefix="/health", tags=["system"])
logger = logging.getLogger(__name__)


async def _check_db(session: AsyncSession) -> Tuple[str, str | None]:
    """Run a minimal DB connectivity check."""
    try:
        await session.execute(text("SELECT 1"))
        return "ok", None
    except Exception as exc:  # noqa: BLE001
        return "error", str(exc)


async def _check_table_exists(session: AsyncSession, table_name: str) -> Tuple[str, str | None]:
    """Check table existence via information_schema."""
    try:
        result = await session.execute(
            text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=:tname)"
            ),
            {"tname": table_name},
        )
        exists = bool(result.scalar())
        return ("ok", None) if exists else ("error", f"table '{table_name}' missing")
    except Exception as exc:  # noqa: BLE001
        return "error", str(exc)


async def _check_demo_tenant(session: AsyncSession) -> Tuple[str, str | None]:
    try:
        result = await session.execute(text("SELECT id FROM tenants WHERE slug='demo-hotel' LIMIT 1"))
        row = result.fetchone()
        return ("ok", None) if row else ("error", "demo tenant missing")
    except Exception as exc:  # noqa: BLE001
        return "error", str(exc)


async def _check_demo_widget_config(session: AsyncSession) -> Tuple[str, str | None]:
    try:
        result = await session.execute(
            text(
                """
                SELECT wc.id
                FROM widget_configs wc
                JOIN tenants t ON t.id = wc.tenant_id
                WHERE t.slug='demo-hotel'
                LIMIT 1
                """
            )
        )
        row = result.fetchone()
        return ("ok", None) if row else ("error", "demo widget config missing")
    except Exception as exc:  # noqa: BLE001
        return "error", str(exc)


async def _check_demo_location(session: AsyncSession) -> Tuple[str, str | None]:
    try:
        result = await session.execute(
            text(
                "SELECT id FROM locations WHERE tenant_id=(SELECT id FROM tenants WHERE slug='demo-hotel' LIMIT 1) LIMIT 1"
            )
        )
        row = result.fetchone()
        return ("ok", None) if row else ("error", "demo location missing")
    except Exception as exc:  # noqa: BLE001
        return "error", str(exc)


async def _check_demo_storage(session: AsyncSession) -> Tuple[str, str | None]:
    try:
        result = await session.execute(
            text(
                "SELECT id FROM storages WHERE tenant_id=(SELECT id FROM tenants WHERE slug='demo-hotel' LIMIT 1) LIMIT 1"
            )
        )
        row = result.fetchone()
        return ("ok", None) if row else ("error", "demo storage missing")
    except Exception as exc:  # noqa: BLE001
        return "error", str(exc)


@router.get("")
async def health_root(session: AsyncSession = Depends(get_session)) -> Dict[str, str]:
    """Simple readiness check that also verifies DB connectivity."""
    status, error = await _check_db(session)
    if status == "ok":
        return {"status": "ok"}
    return {"status": "error", "error": error or "unknown"}


@router.get("/db")
async def health_db(session: AsyncSession = Depends(get_session)) -> Dict[str, str]:
    """DB-only health check."""
    status, error = await _check_db(session)
    return {"status": status, **({"error": error} if error else {})}


@router.get("/full")
async def health_full(session: AsyncSession = Depends(get_session)) -> Dict[str, Any]:
    """Comprehensive health check covering DB and seeded demo resources."""
    checks: Dict[str, Dict[str, str]] = {}

    db_status, db_error = await _check_db(session)
    checks["db"] = {"status": db_status, **({"details": db_error} if db_error else {})}

    widget_tables: Dict[str, Dict[str, str]] = {}
    for table in ("widget_configs", "widget_reservations", "webhook_deliveries"):
        t_status, t_err = await _check_table_exists(session, table)
        widget_tables[table] = {"status": t_status, **({"details": t_err} if t_err else {})}
    widget_tables_status = "ok" if all(v["status"] == "ok" for v in widget_tables.values()) else "error"
    checks["widget_tables"] = {"status": widget_tables_status, "details": widget_tables}

    demo_checks = {
        "demo_tenant": await _check_demo_tenant(session),
        "demo_widget_config": await _check_demo_widget_config(session),
        "demo_location": await _check_demo_location(session),
        "demo_storage": await _check_demo_storage(session),
    }
    for key, (st, err) in demo_checks.items():
        checks[key] = {"status": st, **({"details": err} if err else {})}

    overall_status = "ok" if all(c["status"] == "ok" for c in checks.values()) else "error"

    return {
        "status": overall_status,
        "checks": checks,
    }
