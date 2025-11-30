"""Factory for LLM providers."""

from __future__ import annotations

from functools import lru_cache

from app.core.config import settings

from .anthropic_provider import AnthropicChatProvider
from .base import ChatProviderBase
from .openai_provider import OpenAIChatProvider
from .ollama_provider import OllamaChatProvider

ProviderType = ChatProviderBase


@lru_cache(maxsize=1)
def _build_provider() -> ProviderType:
    provider_key = (settings.ai_provider or "openai").lower()
    model = settings.ai_model
    if provider_key == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY missing")
        return OpenAIChatProvider(api_key=settings.openai_api_key, model=model)
    if provider_key == "anthropic":
        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY missing")
        return AnthropicChatProvider(api_key=settings.anthropic_api_key, model=model)
    if provider_key == "ollama":
        return OllamaChatProvider(base_url=settings.ollama_base_url, model=model)
    raise ValueError(f"Unsupported provider: {settings.ai_provider}")


def get_chat_provider() -> ProviderType:
    """Return a cached provider instance."""
    return _build_provider()


def reset_provider_cache() -> None:
    """Reset provider cache (primarily for tests)."""
    _build_provider.cache_clear()
