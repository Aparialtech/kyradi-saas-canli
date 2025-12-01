"""Factory for LLM providers - OpenAI Only.

Bu modül sadece OpenAI provider'ı destekler.
Ollama kaldırıldı, tüm AI istekleri OpenAI üzerinden yapılır.
"""

from __future__ import annotations

import os
import logging
from functools import lru_cache

from app.core.config import settings

from .base import ChatProviderBase
from .openai_provider import OpenAIChatProvider

logger = logging.getLogger("kyradi.ai")

ProviderType = ChatProviderBase


def _validate_openai_key() -> str:
    """Validate and return OpenAI API key.
    
    Raises:
        RuntimeError: If OPENAI_API_KEY is not set
    """
    api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "AI servisi yapılandırılmamış: OPENAI_API_KEY eksik. "
            "Lütfen environment variable olarak OPENAI_API_KEY ayarlayın."
        )
    return api_key


@lru_cache(maxsize=1)
def _build_provider() -> ProviderType:
    """Build and cache the OpenAI provider.
    
    Returns:
        OpenAIChatProvider instance
        
    Raises:
        RuntimeError: If OPENAI_API_KEY is not configured
    """
    api_key = _validate_openai_key()
    
    # Model: gpt-4.1-mini (veya config'den)
    model = settings.ai_model or "gpt-4.1-mini"
    
    logger.info(f"Initializing OpenAI provider with model: {model}")
    
    return OpenAIChatProvider(
        api_key=api_key,
        model=model,
        timeout=60.0,  # 60 saniye timeout
    )


def get_chat_provider() -> ProviderType:
    """Return a cached OpenAI provider instance.
    
    Returns:
        OpenAIChatProvider instance
        
    Raises:
        RuntimeError: If OPENAI_API_KEY is not configured
    """
    return _build_provider()


def reset_provider_cache() -> None:
    """Reset provider cache (primarily for tests)."""
    _build_provider.cache_clear()


def check_ai_available() -> tuple[bool, str]:
    """Check if AI service is available.
    
    Returns:
        Tuple of (is_available, message)
    """
    try:
        api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
        if not api_key:
            return False, "OPENAI_API_KEY eksik"
        return True, "AI servisi hazır"
    except Exception as e:
        return False, str(e)
