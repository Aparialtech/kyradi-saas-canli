import asyncio
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.reservations.router_public import rate_limiter
from app.reservations.models import WidgetConfig, WidgetReservation


@pytest.fixture(autouse=True)
def disable_captcha():
    original = settings.widget_hcaptcha_enabled
    settings.widget_hcaptcha_enabled = False
    yield
    settings.widget_hcaptcha_enabled = original


@pytest.fixture
def widget_config(db_session: AsyncSession, event_loop: asyncio.AbstractEventLoop) -> WidgetConfig:
    async def _create() -> WidgetConfig:
        config = WidgetConfig(
            tenant_id="tenant-test",
            widget_public_key="public-key",
            widget_secret="secret",
            allowed_origins=["https://widget.example.com"],
            kvkk_text="KVKK & GDPR consent.",
        )
        db_session.add(config)
        await db_session.commit()
        await db_session.refresh(config)
        return config

    return event_loop.run_until_complete(_create())


def test_init_rejects_unknown_origin(
    client: AsyncClient,
    widget_config: WidgetConfig,
    event_loop: asyncio.AbstractEventLoop,
) -> None:
    response = event_loop.run_until_complete(
        client.get(
            "/public/widget/init",
            params={"tenant_id": widget_config.tenant_id, "key": widget_config.widget_public_key},
            headers={"Origin": "https://evil.com"},
        )
    )
    assert response.status_code == 401 or response.status_code == 403


def test_init_returns_token(
    client: AsyncClient,
    widget_config: WidgetConfig,
    event_loop: asyncio.AbstractEventLoop,
) -> str:
    response = event_loop.run_until_complete(
        client.get(
            "/public/widget/init",
            params={"tenant_id": widget_config.tenant_id, "key": widget_config.widget_public_key},
            headers={"Origin": "https://widget.example.com"},
        )
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    assert token
    return token


def test_submit_creates_reservation(
    client: AsyncClient,
    widget_config: WidgetConfig,
    event_loop: asyncio.AbstractEventLoop,
    db_session: AsyncSession,
) -> None:
    rate_limiter.reset()
    response = event_loop.run_until_complete(
        client.get(
            "/public/widget/init",
            params={"tenant_id": widget_config.tenant_id, "key": widget_config.widget_public_key},
            headers={"Origin": "https://widget.example.com"},
        )
    )
    token = response.json()["access_token"]
    submit = event_loop.run_until_complete(
        client.post(
            "/public/widget/reservations",
            headers={
                "Authorization": f"Bearer {token}",
                "Origin": "https://widget.example.com",
            },
            json={
                "checkin_date": str(date(2025, 1, 1)),
                "checkout_date": str(date(2025, 1, 2)),
                "baggage_count": 2,
                "locker_size": "M",
                "kvkk_approved": True,
                "guest": {
                    "name": "Ali Veli",
                    "email": "ali@example.com",
                    "phone": "+905551112233",
                },
            },
        )
    )
    assert submit.status_code == 200
    data = submit.json()
    assert data["status"] == "pending"

    async def _fetch() -> WidgetReservation | None:
        stmt = (
            select(WidgetReservation)
            .where(WidgetReservation.tenant_id == widget_config.tenant_id)
            .order_by(WidgetReservation.id.desc())
        )
        result = await db_session.execute(stmt)
        return result.scalars().first()

    saved = event_loop.run_until_complete(_fetch())
    assert saved is not None
    assert saved.guest_email == "ali@example.com"
