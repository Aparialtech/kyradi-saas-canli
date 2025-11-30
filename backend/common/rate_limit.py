"""Simple rate limit helpers."""

from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from dataclasses import dataclass
from time import monotonic
from typing import Deque, DefaultDict


class RateLimitError(Exception):
    """Raised when an identity exceeds the configured limit."""


@dataclass(slots=True)
class RateLimitResult:
    key: str
    remaining: int


class RateLimiter:
    """In-memory sliding window rate limiter."""

    def __init__(self, limit_per_minute: int) -> None:
        self.limit = max(0, limit_per_minute)
        self.window = 60
        self._hits: DefaultDict[str, Deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, identity: str) -> RateLimitResult:
        if self.limit == 0:
            return RateLimitResult(identity, remaining=0)

        cutoff = monotonic() - self.window
        async with self._lock:
            bucket = self._hits[identity]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self.limit:
                raise RateLimitError("Çok fazla istek gönderildi")
            bucket.append(monotonic())
            return RateLimitResult(identity, remaining=self.limit - len(bucket))

    def reset(self) -> None:
        self._hits.clear()
