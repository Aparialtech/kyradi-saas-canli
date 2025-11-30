"""Partner-facing widget reservation endpoints."""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.db.session import get_session
from app.dependencies import require_tenant_operator, require_tenant_staff
from app.models import User

from .models import WidgetConfig, WidgetReservation
from .schemas import WidgetConfigRead, WidgetReservationList, WidgetReservationRead

reservations_router = APIRouter(prefix="/partners/widget-reservations", tags=["reservations"])
config_router = APIRouter(prefix="/partners/widget-config", tags=["reservations"])

logger = logging.getLogger(__name__)


@reservations_router.get("", response_model=WidgetReservationList)
async def list_widget_reservations(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    origin: Optional[str] = Query(default=None),
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> WidgetReservationList:
    filters = [WidgetReservation.tenant_id == current_user.tenant_id]
    if status_filter:
        filters.append(WidgetReservation.status == status_filter)
    if date_from:
        filters.append(WidgetReservation.checkin_date >= date_from)
    if date_to:
        filters.append(WidgetReservation.checkout_date <= date_to)
    if origin:
        filters.append(WidgetReservation.origin == origin)

    stmt = select(WidgetReservation).where(and_(*filters)).order_by(WidgetReservation.created_at.desc())
    reservations = (await session.execute(stmt)).scalars().all()
    return WidgetReservationList(
        items=[WidgetReservationRead.model_validate(res) for res in reservations]
    )


@reservations_router.get("/{reservation_id}", response_model=WidgetReservationRead)
async def get_widget_reservation(
    reservation_id: int,
    current_user: User = Depends(require_tenant_operator),
    session: AsyncSession = Depends(get_session),
) -> WidgetReservationRead:
    reservation = await _get_reservation(session, reservation_id, current_user.tenant_id)
    return WidgetReservationRead.model_validate(reservation)


@reservations_router.post("/{reservation_id}/confirm", response_model=WidgetReservationRead)
async def confirm_widget_reservation(
    reservation_id: int,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> WidgetReservationRead:
    reservation = await _get_reservation(session, reservation_id, current_user.tenant_id)
    if reservation.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="İptal edilmiş kayıt onaylanamaz")
    reservation.status = "confirmed"
    await session.commit()
    return WidgetReservationRead.model_validate(reservation)


@reservations_router.post("/{reservation_id}/cancel", response_model=WidgetReservationRead)
async def cancel_widget_reservation(
    reservation_id: int,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> WidgetReservationRead:
    reservation = await _get_reservation(session, reservation_id, current_user.tenant_id)
    reservation.status = "cancelled"
    await session.commit()
    return WidgetReservationRead.model_validate(reservation)


async def _get_reservation(session: AsyncSession, reservation_id: int, tenant_id: str) -> WidgetReservation:
    stmt = select(WidgetReservation).where(
        WidgetReservation.id == reservation_id,
        WidgetReservation.tenant_id == tenant_id,
    )
    reservation = (await session.execute(stmt)).scalar_one_or_none()
    if reservation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rezervasyon bulunamadı")
    return reservation


@config_router.get("", response_model=WidgetConfigRead)
async def get_widget_config_for_partner(
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> WidgetConfigRead:
    tenant_id = current_user.tenant_id
    try:
        stmt = select(WidgetConfig).where(WidgetConfig.tenant_id == tenant_id)
        config = (await session.execute(stmt)).scalar_one_or_none()
    except Exception as exc:  # noqa: BLE001
        logger.exception("widget-config: DB error for tenant_id=%s", tenant_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Widget konfigürasyonu yüklenemedi.",
        ) from exc

    if config is None:
        logger.warning(
            "widget-config: no config found for tenant_id=%s, returning defaults", tenant_id
        )
        return WidgetConfigRead(
            id=0,
            tenant_id=tenant_id,
            widget_public_key="demo-public-key",
            allowed_origins=[
                "https://kyradi-saas-canli-cqly0ovkl-aparialtechs-projects.vercel.app",
                "https://kyradi-saas-canli.vercel.app",
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ],
            locale="tr-TR",
            theme="light",
            kvkk_text="Demo KVKK metni",
            webhook_url=None,
            created_at=datetime.utcnow(),
        )

    return WidgetConfigRead.model_validate(config)
