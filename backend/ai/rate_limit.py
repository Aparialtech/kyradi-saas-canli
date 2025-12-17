"""Simple per-identity rate limiting for AI endpoints."""

from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from dataclasses import dataclass
from time import monotonic
from typing import Deque, DefaultDict

from app.core.config import settings


class RateLimitError(Exception):
    """Raised when a caller exceeds the configured rate limit."""

    def __init__(self, message: str, *, limit: int) -> None:
        super().__init__(message)
        self.limit = limit


@dataclass
class RateLimitContext:
    """Details about a rate-limited identity."""

    key: str
    limit: int
    remaining: int


class RateLimiter:
    """In-memory fixed window rate limiter (per minute)."""

    def __init__(self, limit_per_minute: int, window_seconds: int = 60) -> None:
        self.limit = max(0, limit_per_minute)
        self.window_seconds = window_seconds
        self._hits: DefaultDict[str, Deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, identity: str) -> RateLimitContext:
        """Record a hit for the identity or raise when exceeding quota."""
        if self.limit == 0:
            # Unlimited mode (used for tests/dev).
            return RateLimitContext(identity, 0, 0)

        cutoff = monotonic() - self.window_seconds
        async with self._lock:
            bucket = self._hits[identity]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self.limit:
                remaining = 0
                raise RateLimitError(
                    f"Rate limit exceeded ({self.limit}/min)",
                    limit=self.limit,
                )

            bucket.append(monotonic())
            remaining = self.limit - len(bucket)
            return RateLimitContext(identity, self.limit, remaining)

    def reset(self) -> None:
        """Clear all counters (handy for tests)."""
        self._hits.clear()


rate_limiter = RateLimiter(settings.rate_limit_per_min)
