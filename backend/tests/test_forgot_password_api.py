import asyncio

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PasswordResetToken, User
from app.api.routes import auth as auth_routes


def test_forgot_password_unknown_email_no_otp(
    client: AsyncClient,
    session: AsyncSession,
    event_loop: asyncio.AbstractEventLoop,
) -> None:
    response = event_loop.run_until_complete(
        client.post(
            "/auth/forgot-password",
            json={"email": "unknown@example.com"},
        )
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Bu e-posta adresi kayıtlı değil."

    token_count = event_loop.run_until_complete(
        session.scalar(select(func.count()).select_from(PasswordResetToken))
    )
    assert int(token_count or 0) == 0


def test_forgot_password_known_email_normalized_creates_otp(
    client: AsyncClient,
    session: AsyncSession,
    event_loop: asyncio.AbstractEventLoop,
    monkeypatch,
) -> None:
    sent = {"count": 0}

    async def _mock_send_password_reset_code(to_email: str, code: str, locale: str = "tr-TR") -> bool:
        sent["count"] += 1
        return True

    monkeypatch.setattr(auth_routes.email_service, "send_password_reset_code", _mock_send_password_reset_code)

    response = event_loop.run_until_complete(
        client.post(
            "/auth/forgot-password",
            json={"email": "  ADMIN@DEMO.COM  "},
        )
    )

    assert response.status_code == 200
    assert "Doğrulama kodu" in response.json()["message"] or "Eğer e-posta" in response.json()["message"]
    assert sent["count"] == 1

    user_id = event_loop.run_until_complete(
        session.scalar(select(User.id).where(User.email == "admin@demo.com"))
    )
    token_count = event_loop.run_until_complete(
        session.scalar(
            select(func.count())
            .select_from(PasswordResetToken)
            .where(PasswordResetToken.user_id == user_id)
        )
    )
    assert int(token_count or 0) >= 1
