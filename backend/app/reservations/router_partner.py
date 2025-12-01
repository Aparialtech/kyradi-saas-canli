"""Partner-facing widget reservation endpoints."""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

import asyncpg
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select, text
from sqlalchemy.exc import ProgrammingError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import require_tenant_operator, require_tenant_staff
from app.models import User

from .models import WidgetConfig, WidgetReservation
from .schemas import WidgetConfigCreate, WidgetReservationList, WidgetReservationRead

reservations_router = APIRouter(prefix="/partners/widget-reservations", tags=["reservations"])
config_router = APIRouter(prefix="/partners/widget-config", tags=["reservations"])

logger = logging.getLogger(__name__)

DEFAULT_WIDGET_CONFIG = {
    "widget_public_key": "demo-public-key",
    "widget_secret": "demo-secret-key",
    "allowed_origins": ["*"],
    "locale": "tr-TR",
    "theme": "light",
    "kvkk_text": "Bu sadece demo ortamıdır.",
    "form_defaults": {},
    "notification_preferences": {},
    "webhook_url": "",
}


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


async def _widget_table_exists(session: AsyncSession) -> bool:
    try:
        result = await session.execute(text("SELECT to_regclass('public.widget_configs')"))
        return bool(result.scalar())
    except (asyncpg.exceptions.UndefinedTableError, ProgrammingError):
        return False


def _as_response(config: WidgetConfig | None, tenant_id: str) -> dict:
    if config is None:
        return {"tenant_id": tenant_id, **DEFAULT_WIDGET_CONFIG}
    return {
        "tenant_id": tenant_id,
        "widget_public_key": config.widget_public_key,
        "widget_secret": config.widget_secret,
        "allowed_origins": config.allowed_origins or [],
        "locale": config.locale or "tr-TR",
        "theme": config.theme or "light",
        "kvkk_text": config.kvkk_text or "",
        "form_defaults": config.form_defaults or {},
        "notification_preferences": config.notification_preferences or {},
        "webhook_url": config.webhook_url or "",
    }


@config_router.get("")
async def get_widget_config_for_partner(
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> dict:
    tenant_id = current_user.tenant_id
    try:
        if not await _widget_table_exists(session):
            return _as_response(None, tenant_id)
        stmt = select(WidgetConfig).where(WidgetConfig.tenant_id == tenant_id)
        config = (await session.execute(stmt)).scalar_one_or_none()
        return _as_response(config, tenant_id)
    except (asyncpg.exceptions.UndefinedTableError, ProgrammingError, SQLAlchemyError) as exc:
        if 'relation "widget_configs"' in str(exc):
            logger.warning("widget-config table missing, returning defaults")
            return _as_response(None, tenant_id)
        raise
    except Exception:
        logger.exception("widget-config: error for tenant_id=%s", tenant_id)
        return _as_response(None, tenant_id)


@config_router.post("", response_model=dict)
async def create_or_update_widget_config(
    payload: WidgetConfigCreate,
    current_user: User = Depends(require_tenant_staff),
    session: AsyncSession = Depends(get_session),
) -> dict:
    tenant_id = current_user.tenant_id
    try:
        if not await _widget_table_exists(session):
            return _as_response(None, tenant_id)
        stmt = select(WidgetConfig).where(WidgetConfig.tenant_id == tenant_id)
        config = (await session.execute(stmt)).scalar_one_or_none()
        if config is None:
            config = WidgetConfig(
                tenant_id=tenant_id,
                widget_public_key=payload.widget_public_key,
                widget_secret=payload.widget_secret,
                allowed_origins=list(payload.allowed_origins),
                locale=payload.locale,
                theme=payload.theme,
                kvkk_text=payload.kvkk_text,
                form_defaults=payload.form_defaults,
                notification_preferences=payload.notification_preferences,
                webhook_url=payload.webhook_url,
            )
            session.add(config)
        else:
            config.widget_public_key = payload.widget_public_key
            config.widget_secret = payload.widget_secret
            config.allowed_origins = list(payload.allowed_origins)
            config.locale = payload.locale
            config.theme = payload.theme
            config.kvkk_text = payload.kvkk_text
            config.form_defaults = payload.form_defaults
            config.notification_preferences = payload.notification_preferences
            config.webhook_url = payload.webhook_url
        await session.commit()
        await session.refresh(config)
        return _as_response(config, tenant_id)
    except (asyncpg.exceptions.UndefinedTableError, ProgrammingError, SQLAlchemyError) as exc:
        if 'relation "widget_configs"' in str(exc):
            logger.warning("widget-config table missing on create/update, returning defaults")
            return _as_response(None, tenant_id)
        raise
    except Exception:
        logger.exception("widget-config: error on create/update for tenant_id=%s", tenant_id)
        return _as_response(None, tenant_id)

