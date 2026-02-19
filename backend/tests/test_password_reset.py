"""Tests for password reset functionality."""

import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PasswordResetToken, User
from app.core.security import get_password_hash


@pytest.mark.asyncio
async def test_password_reset_token_creation(session: AsyncSession):
    """Test creating a password reset token."""
    # Create a test user
    user = User(
        id="test-user-123",
        email="test@example.com",
        password_hash=get_password_hash("oldpassword"),
        role="tenant_admin",
        tenant_id="test-tenant-123",
    )
    session.add(user)
    await session.commit()
    
    # Create token
    token = PasswordResetToken.create_token(user.id, expires_in_minutes=30)
    session.add(token)
    await session.commit()
    
    assert token.user_id == user.id
    assert token.token is not None
    assert len(token.token) > 0
    assert token.is_used is False
    assert token.is_valid() is True
    assert token.expires_at > datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_password_reset_token_expiration(session: AsyncSession):
    """Test token expiration."""
    user = User(
        id="test-user-456",
        email="test2@example.com",
        password_hash=get_password_hash("password"),
        role="tenant_admin",
        tenant_id="test-tenant-123",
    )
    session.add(user)
    await session.commit()
    
    # Create expired token
    token = PasswordResetToken(
        id="test-token-456",
        user_id=user.id,
        token="expired-token",
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        is_used=False,
    )
    session.add(token)
    await session.commit()
    
    assert token.is_valid() is False


@pytest.mark.asyncio
async def test_password_reset_token_used(session: AsyncSession):
    """Test token marked as used."""
    user = User(
        id="test-user-789",
        email="test3@example.com",
        password_hash=get_password_hash("password"),
        role="tenant_admin",
        tenant_id="test-tenant-123",
    )
    session.add(user)
    await session.commit()
    
    token = PasswordResetToken(
        id="test-token-789",
        user_id=user.id,
        token="used-token",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        is_used=True,
    )
    session.add(token)
    await session.commit()
    
    assert token.is_valid() is False

