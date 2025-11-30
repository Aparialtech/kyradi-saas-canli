"""Tests for AI ingest and chat endpoints."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from ai.providers.base import LLMProviderError, ProviderResponse, ProviderUsage
from ai.rate_limit import rate_limiter
from app.models import Tenant, User


@pytest.fixture
def auth_header(client: AsyncClient, event_loop: asyncio.AbstractEventLoop) -> dict[str, str]:
    response = event_loop.run_until_complete(
        client.post(
            "/auth/login",
            json={
                "email": "admin@demo.com",
                "password": "Kyradi!2025",
                "tenant_slug": "demo-hotel",
            },
        )
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def demo_tenant_id(db_session, event_loop: asyncio.AbstractEventLoop) -> str:
    async def _fetch() -> str:
        result = await db_session.execute(select(Tenant).where(Tenant.slug == "demo-hotel"))
        return result.scalar_one().id

    return event_loop.run_until_complete(_fetch())


@pytest.fixture
def demo_user_id(db_session, event_loop: asyncio.AbstractEventLoop) -> str:
    async def _fetch() -> str:
        result = await db_session.execute(select(User).where(User.email == "admin@demo.com"))
        return result.scalar_one().id

    return event_loop.run_until_complete(_fetch())


def test_ingest_plain_text_success(
    client: AsyncClient,
    event_loop: asyncio.AbstractEventLoop,
    auth_header: dict[str, str],
    demo_tenant_id: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_embeddings(texts: list[str], model: str | None = None) -> list[list[float]]:
        return [[float(idx + 1)] * 5 for idx, _ in enumerate(texts)]

    monkeypatch.setattr("ai.router.embed_texts", fake_embeddings)
    response = event_loop.run_until_complete(
        client.post(
            "/ai/ingest",
            headers=auth_header,
            json={
                "tenant_id": demo_tenant_id,
                "title": "Depo Prosedürü",
                "text": "Birinci paragraf.\n\nİkinci paragraf ayrıntıları.",
                "mime": "text/plain",
            },
        )
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["count"] > 0


def test_chat_without_rag(
    client: AsyncClient,
    event_loop: asyncio.AbstractEventLoop,
    demo_tenant_id: str,
    demo_user_id: str,
    auth_header: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class DummyProvider:
        provider_name = "dummy"
        model = "dummy-model"

        async def chat(self, messages, stream=False, **kwargs) -> ProviderResponse:
            return ProviderResponse(
                text="Hazırız, teslim noktası 3. katta.",
                usage=ProviderUsage(input_tokens=10, output_tokens=5),
                raw={},
            )

    monkeypatch.setattr("ai.router.get_chat_provider", lambda: DummyProvider())

    response = event_loop.run_until_complete(
        client.post(
            "/ai/chat",
            headers=auth_header,
            json={
                "tenant_id": demo_tenant_id,
                "user_id": demo_user_id,
                "message": "Teslim noktası nerede?",
                "use_rag": False,
            },
        )
    )
    assert response.status_code == 200
    data = response.json()
    assert data["answer"].startswith("Hazırız")
    assert data["sources"] == []
    assert data["usage"]["input_tokens"] == 10


def test_chat_with_rag_sources(
    client: AsyncClient,
    event_loop: asyncio.AbstractEventLoop,
    demo_tenant_id: str,
    demo_user_id: str,
    auth_header: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class DummyProvider:
        provider_name = "dummy"
        model = "dummy-model"

        async def chat(self, messages, stream=False, **kwargs) -> ProviderResponse:
            return ProviderResponse(
                text="Kilidi kiosk üzerinden açabilirsiniz.",
                usage=ProviderUsage(input_tokens=22, output_tokens=9),
                raw={},
            )

    async def fake_semantic_search(*args: Any, **kwargs: Any) -> list[dict[str, str]]:
        return [
            {"title": "Teslim Prosedürü", "snippet": "Kilidi kiosk ekranından açın.", "content": "..."}
        ]

    monkeypatch.setattr("ai.router.get_chat_provider", lambda: DummyProvider())
    monkeypatch.setattr("ai.router.semantic_search", fake_semantic_search)

    response = event_loop.run_until_complete(
        client.post(
            "/ai/chat",
            headers=auth_header,
            json={
                "tenant_id": demo_tenant_id,
                "user_id": demo_user_id,
                "message": "Kilidi nasıl açarım?",
                "use_rag": True,
                "top_k": 3,
            },
        )
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["sources"]) == 1
    assert "kiosk" in data["sources"][0]["snippet"].lower()


def test_chat_requires_auth(client: AsyncClient, event_loop: asyncio.AbstractEventLoop, demo_tenant_id: str) -> None:
    response = event_loop.run_until_complete(
        client.post(
            "/ai/chat",
            json={
                "tenant_id": demo_tenant_id,
                "user_id": "user-1",
                "message": "Selam",
            },
        )
    )
    assert response.status_code == 401


def test_chat_wrong_tenant_forbidden(
    client: AsyncClient,
    event_loop: asyncio.AbstractEventLoop,
    auth_header: dict[str, str],
    demo_user_id: str,
) -> None:
    response = event_loop.run_until_complete(
        client.post(
            "/ai/chat",
            headers=auth_header,
            json={
                "tenant_id": "some-other-tenant",
                "user_id": demo_user_id,
                "message": "Test",
            },
        )
    )
    assert response.status_code == 403


def test_chat_rate_limit(
    client: AsyncClient,
    event_loop: asyncio.AbstractEventLoop,
    auth_header: dict[str, str],
    demo_tenant_id: str,
    demo_user_id: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class DummyProvider:
        provider_name = "dummy"
        model = "dummy-model"

        async def chat(self, messages, stream=False, **kwargs) -> ProviderResponse:
            return ProviderResponse(
                text="Randevu oluşturuldu.",
                usage=ProviderUsage(input_tokens=5, output_tokens=5),
                raw={},
            )

    rate_limiter.reset()
    rate_limiter.limit = 1
    monkeypatch.setattr("ai.router.get_chat_provider", lambda: DummyProvider())
    first = event_loop.run_until_complete(
        client.post(
            "/ai/chat",
            headers=auth_header,
            json={
                "tenant_id": demo_tenant_id,
                "user_id": demo_user_id,
                "message": "İlk istek",
            },
        )
    )
    assert first.status_code == 200
    second = event_loop.run_until_complete(
        client.post(
            "/ai/chat",
            headers=auth_header,
            json={
                "tenant_id": demo_tenant_id,
                "user_id": demo_user_id,
                "message": "İkinci istek",
            },
        )
    )
    assert second.status_code == 429
    rate_limiter.limit = 30


def test_provider_timeout_results_in_504(
    client: AsyncClient,
    event_loop: asyncio.AbstractEventLoop,
    auth_header: dict[str, str],
    demo_tenant_id: str,
    demo_user_id: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class TimeoutProvider:
        provider_name = "dummy"
        model = "dummy"

        async def chat(self, messages, stream=False, **kwargs):
            raise LLMProviderError("timeout", status_code=504, is_timeout=True)

    monkeypatch.setattr("ai.router.get_chat_provider", lambda: TimeoutProvider())
    response = event_loop.run_until_complete(
        client.post(
            "/ai/chat",
            headers=auth_header,
            json={
                "tenant_id": demo_tenant_id,
                "user_id": demo_user_id,
                "message": "Selam",
            },
        )
    )
    assert response.status_code == 504
    detail = response.json()["detail"]
    assert "request_id" in detail
