"""Partner-facing widget reservation endpoints."""

from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import require_tenant_operator, require_tenant_staff
from app.models import User

from .models import WidgetConfig, WidgetReservation
from .schemas import WidgetConfigRead, WidgetReservationList, WidgetReservationRead

reservations_router = APIRouter(prefix="/partners/widget-reservations", tags=["reservations"])
config_router = APIRouter(prefix="/partners/widget-config", tags=["reservations"])


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
    stmt = select(WidgetConfig).where(WidgetConfig.tenant_id == current_user.tenant_id)
    config = (await session.execute(stmt)).scalar_one_or_none()
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget konfigürasyonu bulunamadı")
    return WidgetConfigRead.model_validate(config)
