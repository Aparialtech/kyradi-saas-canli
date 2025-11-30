import asyncio
from collections.abc import Iterator

import pytest  # noqa: E402
from httpx import AsyncClient  # noqa: E402

from app.db.session import AsyncSessionMaker  # noqa: E402
from app.db.utils import init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def event_loop() -> Iterator[asyncio.AbstractEventLoop]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
def setup_database(event_loop: asyncio.AbstractEventLoop) -> Iterator[None]:
    try:
        event_loop.run_until_complete(init_db())
    except Exception as exc:  # pragma: no cover - infrastructure dependent
        pytest.skip(f"Database unavailable for tests: {exc}")
    else:
        yield


@pytest.fixture
def client(event_loop: asyncio.AbstractEventLoop) -> Iterator[AsyncClient]:
    async def _open() -> AsyncClient:
        client_instance = AsyncClient(app=app, base_url="http://test")
        await client_instance.__aenter__()
        return client_instance

    http_client = event_loop.run_until_complete(_open())
    try:
        yield http_client
    finally:
        event_loop.run_until_complete(http_client.__aexit__(None, None, None))


@pytest.fixture
def db_session(event_loop: asyncio.AbstractEventLoop) -> Iterator[AsyncSessionMaker]:
    async def _open():
        session_cm = AsyncSessionMaker()
        session = await session_cm.__aenter__()
        return session, session_cm

    session, session_cm = event_loop.run_until_complete(_open())
    try:
        yield session
    finally:
        event_loop.run_until_complete(session_cm.__aexit__(None, None, None))
