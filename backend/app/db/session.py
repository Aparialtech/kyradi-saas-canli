"""Database session management."""

import logging
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.exc import SQLAlchemyError, DisconnectionError

from ..core.config import settings

logger = logging.getLogger(__name__)
db_logger = logging.getLogger("kyradi.db_session")

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    future=True,
    echo=False,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_size=10,
    max_overflow=20,
)

AsyncSessionMaker = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a scoped async session for request lifetime with error handling."""
    session = None
    try:
        async with AsyncSessionMaker() as session:
            try:
                yield session
            except (SQLAlchemyError, DisconnectionError) as exc:
                db_logger.error(
                    f"Database error in session: {type(exc).__name__}: {exc}",
                    exc_info=True
                )
                try:
                    await session.rollback()
                    db_logger.info("Session rolled back due to database error")
                except Exception as rollback_exc:
                    db_logger.error(f"Failed to rollback session: {rollback_exc}")
                raise
            except Exception as exc:
                db_logger.error(
                    f"Unexpected error in session: {type(exc).__name__}: {exc}",
                    exc_info=True
                )
                try:
                    await session.rollback()
                    db_logger.info("Session rolled back due to unexpected error")
                except Exception as rollback_exc:
                    db_logger.error(f"Failed to rollback session: {rollback_exc}")
                raise
    except DisconnectionError as exc:
        db_logger.error(f"Database connection lost: {exc}")
        # Try to reconnect
        try:
            await engine.dispose()
            db_logger.info("Engine disposed, will reconnect on next request")
        except Exception as dispose_exc:
            db_logger.error(f"Failed to dispose engine: {dispose_exc}")
        raise
    except Exception as exc:
        db_logger.error(f"Failed to create session: {type(exc).__name__}: {exc}")
        raise
