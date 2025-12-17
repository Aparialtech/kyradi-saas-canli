"""Observability helpers for AI requests."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import asdict, dataclass
from typing import Any, Mapping, MutableMapping
from uuid import uuid4

logger = logging.getLogger("kyradi.ai")

EMAIL_RE = re.compile(r"(?P<local>[A-Za-z0-9._%+-]+)@(?P<domain>[A-Za-z0-9.-]+\.[A-Za-z]{2,})")
PHONE_RE = re.compile(r"(\+?\d[\d\s\-]{7,}\d)")


def generate_request_id() -> str:
    """Return a unique identifier for tracing."""
    return str(uuid4())


def _mask_email(match: re.Match[str]) -> str:
    local = match.group("local")
    domain = match.group("domain")
    if len(local) <= 2:
        masked_local = "*" * len(local)
    else:
        masked_local = local[0] + "***" + local[-1]
    return f"{masked_local}@{domain}"


def _mask_phone(match: re.Match[str]) -> str:
    digits = re.sub(r"\D", "", match.group(0))
    if len(digits) <= 4:
        return "***"
    return f"{digits[:2]}***{digits[-2:]}"


def mask_pii(text: str | None) -> str | None:
    """Mask common PII patterns in the provided text."""
    if not text:
        return text
    masked = EMAIL_RE.sub(_mask_email, text)
    masked = PHONE_RE.sub(_mask_phone, masked)
    return masked


def _mask_mapping(metadata: Mapping[str, Any] | None) -> MutableMapping[str, Any] | None:
    if metadata is None:
        return None
    masked: dict[str, Any] = {}
    for key, value in metadata.items():
        if isinstance(value, str):
            masked[key] = mask_pii(value)
        else:
            masked[key] = value
    return masked


@dataclass(slots=True)
class AIObservation:
    """Structured record for AI request logging."""

    request_id: str
    provider: str
    model: str
    latency_ms: float
    tokens_in: int
    tokens_out: int
    success: bool
    prompt: str | None = None
    response: str | None = None
    metadata: Mapping[str, Any] | None = None
    error: str | None = None

    def to_json(self) -> str:
        payload = asdict(self)
        payload["prompt"] = mask_pii(self.prompt)
        payload["response"] = mask_pii(self.response)
        payload["metadata"] = _mask_mapping(self.metadata)
        return json.dumps(payload, ensure_ascii=False)


def log_ai_interaction(observation: AIObservation) -> None:
    """Emit a structured log line for tracing/metrics."""
    logger.info(observation.to_json())
