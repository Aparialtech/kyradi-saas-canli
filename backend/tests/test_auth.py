import asyncio

from httpx import AsyncClient


def test_login_demo_admin(client: AsyncClient, event_loop: asyncio.AbstractEventLoop) -> None:
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
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
