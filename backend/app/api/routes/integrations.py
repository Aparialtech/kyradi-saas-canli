"""Integration endpoints (server-to-server).

Minimal additions only. No schema changes, no refactors.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.dependencies.auth import get_current_active_user
from app.models import Location, Reservation, Storage, Tenant, User
from app.models.enums import ReservationStatus, UserRole
from app.services.superapp_integration import (
    SIGNATURE_HEADER,
    extract_external_reservation_id,
    post_status_update,
    verify_signature,
)

logger = logging.getLogger("kyradi.api.integrations")

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


class IntegrationCustomer(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class IntegrationReservationCreatePayload(BaseModel):
    externalReservationId: str = Field(..., min_length=1)
    paid: bool = False
    # Tenant resolver middleware may set request.state.tenant_id based on host.
    # For server-to-server calls, SuperApp can send a tenant UUID or slug.
    tenantId: Optional[str] = None
    tenantSlug: Optional[str] = None
    locationId: Optional[str] = None
    storageId: Optional[str] = None
    lockerId: Optional[str] = None
    storageUnit: Optional[str] = None
    startAt: Optional[datetime] = None
    endAt: Optional[datetime] = None
    customer: Optional[IntegrationCustomer] = None
    notes: Optional[str] = None


class IntegrationAssignPayload(BaseModel):
    storageUnit: Optional[str] = None
    storageId: Optional[str] = None
    lockerId: Optional[str] = None
    operatorName: Optional[str] = None
    # Integration status values: assigned|dropped|completed
    status: Optional[str] = None
    note: Optional[str] = None


async def require_integration_signature(request: Request) -> bytes:
    if not settings.superapp_integration_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Integration not configured",
        )

    raw = await request.body()
    sig = request.headers.get(SIGNATURE_HEADER)
    if not sig:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="MISSING_SIGNATURE")
    if not verify_signature(settings.superapp_integration_secret, raw, sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_SIGNATURE")
    return raw


async def require_tenant_admin_token(current_user: User = Depends(get_current_active_user)) -> User:
    """Integration admin token must be tenant-scoped tenant_admin."""
    if current_user.role != UserRole.TENANT_ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    if not current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant context required")
    return current_user


async def _resolve_tenant_id(
    session: AsyncSession,
    request: Request,
    payload: IntegrationReservationCreatePayload,
) -> Optional[str]:
    tenant_id = getattr(request.state, "tenant_id", None)
    if tenant_id:
        return tenant_id

    # tenantId can be UUID (tenants.id) or slug for backward compatibility.
    if payload.tenantId:
        t = await session.get(Tenant, payload.tenantId)
        if t:
            return t.id
        resolved = (
            await session.execute(select(Tenant.id).where(Tenant.slug == payload.tenantId).limit(1))
        ).scalar_one_or_none()
        if resolved:
            return resolved

    if payload.tenantSlug:
        resolved = (
            await session.execute(select(Tenant.id).where(Tenant.slug == payload.tenantSlug).limit(1))
        ).scalar_one_or_none()
        if resolved:
            return resolved

    if payload.locationId:
        loc = await session.get(Location, payload.locationId)
        if loc:
            return loc.tenant_id

    return None


async def _resolve_storage_id(session: AsyncSession, tenant_id: str, payload: IntegrationReservationCreatePayload) -> str:
    storage_id = payload.storageId or payload.lockerId or payload.storageUnit
    if storage_id:
        storage = await session.get(Storage, storage_id)
        if storage and storage.tenant_id == tenant_id:
            return storage.id
        raise HTTPException(status_code=400, detail="Invalid storageId for tenant")

    # Prefer idle storages with capacity > 0. If a locationId is provided, try that
    # location first, then fall back to any location for the tenant.
    base_all = select(Storage.id).where(Storage.tenant_id == tenant_id)

    base_loc = None
    if payload.locationId:
        base_loc = base_all.where(Storage.location_id == payload.locationId)

    def preferred(stmt):
        return (
            stmt.where(Storage.status == "idle", Storage.capacity > 0)
            .order_by(Storage.created_at.asc())
            .limit(1)
        )

    if base_loc is not None:
        found = (await session.execute(preferred(base_loc))).scalar_one_or_none()
        if found:
            return found

    found = (await session.execute(preferred(base_all))).scalar_one_or_none()
    if found:
        return found

    total = await session.scalar(
        select(func.count()).select_from(Storage).where(Storage.tenant_id == tenant_id)
    )
    idle = await session.scalar(
        select(func.count()).select_from(Storage).where(
            Storage.tenant_id == tenant_id,
            Storage.status == "idle",
            Storage.capacity > 0,
        )
    )
    occupied = await session.scalar(
        select(func.count()).select_from(Storage).where(
            Storage.tenant_id == tenant_id,
            Storage.status == "occupied",
        )
    )
    faulty = await session.scalar(
        select(func.count()).select_from(Storage).where(
            Storage.tenant_id == tenant_id,
            Storage.status == "faulty",
        )
    )

    error_code = "NO_STORAGE_FOR_TENANT" if (total or 0) == 0 else "NO_IDLE_STORAGE_FOR_TENANT"
    logger.warning(
        "Integration %s tenant_id=%s total=%s idle=%s occupied=%s faulty=%s location_id=%s",
        error_code,
        tenant_id,
        total,
        idle,
        occupied,
        faulty,
        payload.locationId,
    )
    raise HTTPException(
        status_code=400,
        detail={
            "error_code": error_code,
            "tenant_id": tenant_id,
            "location_id": payload.locationId,
            "totalStorages": int(total or 0),
            "idleStorages": int(idle or 0),
            "occupiedStorages": int(occupied or 0),
            "faultyStorages": int(faulty or 0),
        },
    )


def _integration_notes(external_id: str, extra: Optional[str]) -> str:
    parts = [f"SUPERAPP_EXTERNAL_RES_ID:{external_id}"]
    if extra:
        parts.append(extra.strip())
    return "\n".join(parts)


@router.post("/reservations", status_code=status.HTTP_201_CREATED)
async def create_reservation_from_superapp(
    request: Request,
    payload: IntegrationReservationCreatePayload,
    _: bytes = Depends(require_integration_signature),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    tenant_id = await _resolve_tenant_id(session, request, payload)
    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "tenant_id_required",
                "hint": "Send one of: tenantId (uuid or slug), tenantSlug, locationId; or call via tenant host so request.state.tenant_id is set.",
                "received": {
                    "tenantId": bool(payload.tenantId),
                    "tenantSlug": bool(payload.tenantSlug),
                    "locationId": bool(payload.locationId),
                    "tenant_state": bool(getattr(request.state, "tenant_id", None)),
                },
            },
        )

    storage_id = await _resolve_storage_id(session, tenant_id, payload)

    now = datetime.now(timezone.utc)
    start_at = payload.startAt or now
    end_at = payload.endAt or (start_at + timedelta(hours=1))

    cust = payload.customer or IntegrationCustomer()
    res = Reservation(
        tenant_id=tenant_id,
        storage_id=storage_id,
        customer_name=cust.name,
        full_name=cust.name,
        customer_email=cust.email,
        customer_phone=cust.phone,
        phone_number=cust.phone,
        start_at=start_at,
        end_at=end_at,
        amount_minor=0,
        currency="TRY",
        baggage_count=1,
        notes=_integration_notes(payload.externalReservationId, payload.notes),
    )
    session.add(res)
    await session.commit()
    await session.refresh(res)

    logger.info("Integration reservation created id=%s tenant_id=%s", res.id, tenant_id)
    return {"id": res.id, "tenant_id": tenant_id, "storage_id": storage_id}


@router.put("/reservations/{reservation_id}/assign")
async def assign_reservation_and_notify(
    reservation_id: str,
    payload: IntegrationAssignPayload,
    background: BackgroundTasks,
    _: User = Depends(require_tenant_admin_token),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    res = await session.get(Reservation, reservation_id)
    if not res:
        raise HTTPException(status_code=404, detail="Reservation not found")

    storage_id = payload.storageId or payload.lockerId or payload.storageUnit
    if storage_id:
        storage = await session.get(Storage, storage_id)
        if not storage or storage.tenant_id != res.tenant_id:
            raise HTTPException(status_code=400, detail="Invalid storageId for reservation tenant")
        res.storage_id = storage.id

    if payload.operatorName:
        res.notes = (res.notes or "").rstrip() + f"\nSUPERAPP_OPERATOR:{payload.operatorName}"

    if payload.note:
        res.notes = (res.notes or "").rstrip() + f"\nSUPERAPP_NOTE:{payload.note}"

    # Map integration status values to internal ReservationStatus without schema changes.
    if payload.status:
        normalized = payload.status.strip().lower()
        if normalized not in {"assigned", "dropped", "completed"}:
            raise HTTPException(status_code=400, detail="Invalid status (allowed: assigned|dropped|completed)")
        if normalized == "dropped":
            res.status = ReservationStatus.ACTIVE.value
        elif normalized == "completed":
            res.status = ReservationStatus.COMPLETED.value
        # assigned -> keep RESERVED (default)

    await session.commit()
    await session.refresh(res)

    external_id = extract_external_reservation_id(res.notes)
    if not external_id:
        # SuperApp cannot match SaaS reservation UUIDs. Skip notify if we don't have the
        # external ID recorded in notes.
        logger.info("SUPERAPP_NOTIFY_SKIPPED_MISSING_EXTERNAL_ID reservation_id=%s", res.id)
    else:
        out = {
            # Primary lookup key for SuperApp.
            "externalReservationId": external_id,
            # Optional trace field (SuperApp must not use this for lookup).
            "saasReservationId": res.id,
            "status": payload.status or "assigned",
            "storageUnit": res.storage_id,
            "operator": {"name": payload.operatorName},
            "note": payload.note,
        }
        background.add_task(
            post_status_update,
            payload=out,
            timeout_ms=settings.integration_timeout_ms,
            retry_count=settings.integration_retry_count,
        )

    logger.info("Integration reservation assigned id=%s tenant_id=%s", res.id, res.tenant_id)
    return {"id": res.id, "tenant_id": res.tenant_id, "storage_id": res.storage_id}
