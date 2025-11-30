"""Database session management."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from ..core.config import settings

engine: AsyncEngine = create_async_engine(settings.database_url, future=True, echo=False)

AsyncSessionMaker = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a scoped async session for request lifetime."""
    async with AsyncSessionMaker() as session:
        yield session
