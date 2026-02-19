"""Utility helpers for storage units."""

import random
import re
import string

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Storage


def _normalize_prefix(value: str | None) -> str:
    if not value:
        return "LOC"
    filtered = re.sub(r"[^A-Z0-9]", "", value.upper())
    return filtered[:3] or "LOC"


async def generate_storage_code(
    session: AsyncSession,
    tenant_id: str,
    location_name: str | None,
) -> str:
    """Generate a unique storage code for a tenant."""
    prefix = _normalize_prefix(location_name)
    for _ in range(10):
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        candidate = f"{prefix}-STR-{suffix}"
        exists = await session.scalar(
            select(func.count()).select_from(Storage).where(
                Storage.tenant_id == tenant_id,
                Storage.code == candidate,
            )
        )
        if not exists:
            return candidate
    # Fallback to UUID-like string if collisions persist
    unique_suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    return f"{prefix}-STR-{unique_suffix}"

