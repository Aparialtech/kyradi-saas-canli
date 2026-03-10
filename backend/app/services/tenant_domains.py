"""Tenant domain verification utilities."""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Optional

import dns.resolver

from app.models.enums import TenantDomainStatus


VERIFY_PREFIX = "_kyradi-verify"


def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)


def build_txt_record(domain: str, token: str) -> dict:
    name = f"{VERIFY_PREFIX}.{domain}".strip(".")
    value = f"kyradi={token}"
    return {"type": "TXT", "name": name, "value": value}


def normalize_domain(value: str) -> str:
    return value.strip().lower()


def lookup_txt_record(name: str, token: str, timeout: float = 3.0, retries: int = 2) -> bool:
    resolver = dns.resolver.Resolver()
    resolver.lifetime = timeout
    resolver.timeout = timeout
    for _ in range(max(retries, 1)):
        try:
            answers = resolver.resolve(name, "TXT")
            for record in answers:
                parts = [chunk.decode("utf-8") if isinstance(chunk, bytes) else str(chunk) for chunk in record.strings]
                joined = "".join(parts)
                if token in joined:
                    return True
        except Exception:
            continue
    return False


def verification_status(
    found: bool,
    failure_reason: Optional[str] = None,
) -> tuple[str, Optional[str]]:
    if found:
        return TenantDomainStatus.VERIFIED.value, None
    reason = failure_reason or "TXT kaydı bulunamadı. DNS yayılımı devam ediyor olabilir."
    return TenantDomainStatus.VERIFYING.value, reason


def now_utc() -> datetime:
    return datetime.utcnow()
