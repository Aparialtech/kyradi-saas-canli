"""Availability resolver placeholder."""

from __future__ import annotations

from datetime import date


async def check_availability(
    tenant_id: str,
    checkin_date: date | None,
    checkout_date: date | None,
    locker_size: str | None = None,
) -> bool:
    """Stub for future availability checks."""
    # In future this can query tenant inventory or call external system.
    return True

