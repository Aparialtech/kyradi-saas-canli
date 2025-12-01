"""Base classes and helpers for LLM provider adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

ChatMessage = Mapping[str, Any]


class LLMProviderError(Exception):
    """Normalized error raised by providers."""

    def __init__(self, message: str, *, status_code: int = 502, is_timeout: bool = False) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.is_timeout = is_timeout


@dataclass(slots=True)
class ProviderUsage:
    """Token usage information."""

    input_tokens: int = 0
    output_tokens: int = 0


@dataclass(slots=True)
class ProviderResponse:
    """Normalized provider response."""

    text: str
    usage: ProviderUsage
    raw: Any


class ChatProviderBase(ABC):
    """Abstract chat completion provider."""

    provider_name = "base"

    def __init__(self, model: str, timeout: float = 40.0) -> None:
        """Initialize provider with model and timeout.
        
        Args:
            model: Model identifier
            timeout: Request timeout in seconds (default 40s for reliability)
        """
        self.model = model
        self.timeout = timeout

    @abstractmethod
    async def chat(
        self,
        messages: Sequence[ChatMessage],
        stream: bool = False,
        **kwargs: Any,
    ) -> ProviderResponse:
        """Return the provider response for the given messages."""
        raise NotImplementedError
