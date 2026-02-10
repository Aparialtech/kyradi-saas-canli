"""SuperApp integration helpers.

This module is intentionally small and production-safe: it avoids schema changes,
does not refactor existing flows, and never logs secrets.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger("kyradi.integrations.superapp")


SIGNATURE_HEADER = "x-kyradi-signature"


def compute_signature(secret: str, raw_body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()


def verify_signature(secret: str, raw_body: bytes, header_value: Optional[str]) -> bool:
    if not header_value:
        return False
    expected = compute_signature(secret, raw_body)
    return hmac.compare_digest(expected, header_value)


def dumps_canonical(payload: Any) -> bytes:
    # Stable JSON -> stable signature. Keep UTF-8 and no whitespace.
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def extract_external_reservation_id(notes: Optional[str]) -> Optional[str]:
    """Extract externalReservationId stored in Reservation.notes."""
    if not notes:
        return None
    prefix = "SUPERAPP_EXTERNAL_RES_ID:"
    for line in notes.splitlines():
        if line.startswith(prefix):
            return line[len(prefix) :].strip() or None
    return None


async def post_status_update(
    *,
    payload: dict[str, Any],
    timeout_ms: int,
    retry_count: int,
) -> None:
    if not settings.superapp_base_url or not settings.superapp_integration_secret:
        logger.info("SuperApp notify skipped (SUPERAPP_BASE_URL or SUPERAPP_INTEGRATION_SECRET not set).")
        return

    raw = dumps_canonical(payload)
    sig = compute_signature(settings.superapp_integration_secret, raw)
    url = f"{str(settings.superapp_base_url).rstrip('/')}/integrations/saas/status-update"

    last_exc: Optional[Exception] = None
    for attempt in range(retry_count + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout_ms / 1000.0) as client:
                resp = await client.post(
                    url,
                    content=raw,
                    headers={
                        "content-type": "application/json",
                        SIGNATURE_HEADER: sig,
                    },
                )
            if 200 <= resp.status_code < 300:
                return
            logger.warning(
                "SUPERAPP_NOTIFY_FAIL status=%s attempt=%s body=%s",
                resp.status_code,
                attempt + 1,
                (resp.text[:500] if resp.text else ""),
            )
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            logger.warning("SUPERAPP_NOTIFY_FAIL exc=%s attempt=%s", type(exc).__name__, attempt + 1)

    if last_exc:
        raise last_exc

