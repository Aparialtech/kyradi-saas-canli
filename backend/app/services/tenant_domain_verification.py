"""DNS TXT verification for tenant domains."""

from __future__ import annotations

import secrets
from datetime import datetime
from typing import Optional

import dns.resolver


VERIFY_PREFIX = "_kyradi-verify"


def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)


def build_txt_record(domain: str, token: str) -> tuple[str, str]:
    record_name = f"{VERIFY_PREFIX}.{domain}".strip(".")
    record_value = f"kyradi={token}"
    return record_name, record_value


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


def now_utc() -> datetime:
    return datetime.utcnow()
