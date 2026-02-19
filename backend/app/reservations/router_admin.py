"""Admin endpoints for widget configuration."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import require_admin_user
from app.models import User

from .models import WidgetConfig
from .schemas import WidgetConfigCreate, WidgetConfigRead, WidgetConfigUpdate

router = APIRouter(prefix="/admin/widget-configs", tags=["reservations"])


@router.get("", response_model=list[WidgetConfigRead])
async def list_configs(
    tenant_id: str | None = None,
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> list[WidgetConfigRead]:
    stmt = select(WidgetConfig)
    if tenant_id:
        stmt = stmt.where(WidgetConfig.tenant_id == tenant_id)
    configs = (await session.execute(stmt)).scalars().all()
    return [WidgetConfigRead.model_validate(cfg) for cfg in configs]


@router.post("", response_model=WidgetConfigRead, status_code=status.HTTP_201_CREATED)
async def create_config(
    payload: WidgetConfigCreate,
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> WidgetConfigRead:
    stmt = select(WidgetConfig).where(
        WidgetConfig.tenant_id == payload.tenant_id,
        WidgetConfig.widget_public_key == payload.widget_public_key,
    )
    if (await session.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Widget anahtarı kullanılıyor")
    config = WidgetConfig(
        tenant_id=payload.tenant_id,
        widget_public_key=payload.widget_public_key,
        widget_secret=payload.widget_secret,
        allowed_origins=list(payload.allowed_origins),
        locale=payload.locale,
        theme=payload.theme,
        kvkk_text=payload.kvkk_text,
        webhook_url=payload.webhook_url,
    )
    session.add(config)
    await session.commit()
    await session.refresh(config)
    return WidgetConfigRead.model_validate(config)


@router.put("/{config_id}", response_model=WidgetConfigRead)
async def update_config(
    config_id: int,
    payload: WidgetConfigUpdate,
    current_user: User = Depends(require_admin_user),
    session: AsyncSession = Depends(get_session),
) -> WidgetConfigRead:
    config = await session.get(WidgetConfig, config_id)
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Widget konfigürasyonu bulunamadı")

    if payload.allowed_origins is not None:
        config.allowed_origins = list(payload.allowed_origins)
    if payload.locale is not None:
        config.locale = payload.locale
    if payload.theme is not None:
        config.theme = payload.theme
    if payload.kvkk_text is not None:
        config.kvkk_text = payload.kvkk_text
    if payload.webhook_url is not None:
        config.webhook_url = payload.webhook_url

    await session.commit()
    await session.refresh(config)
    return WidgetConfigRead.model_validate(config)

