"""AI Providers Factory - Safe initialization that never crashes.

This module provides AI providers with graceful fallback to DummyAIProvider
when OpenAI is not available or not configured.

Usage:
    from ai.providers import get_chat_provider, check_ai_available
    
    provider = get_chat_provider()
    if check_ai_available():
        result = await provider.chat("Hello")
    else:
        # Handle AI unavailable
        pass
"""

import os
import logging
from typing import Any, Dict, Union

logger = logging.getLogger("kyradi.ai.providers")

# Import dummy provider (always available)
from .dummy_provider import DummyAIProvider

# Import OpenAI provider (may fail, that's OK)
try:
    from .openai_provider import OpenAIChatProvider, OPENAI_AVAILABLE
except ImportError:
    OpenAIChatProvider = None
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI provider module not available")
except Exception as e:
    OpenAIChatProvider = None
    OPENAI_AVAILABLE = False
    logger.warning(f"Failed to import OpenAI provider: {e}")


# Cached provider instance
_provider_instance = None


def get_chat_provider() -> Union[OpenAIChatProvider, DummyAIProvider]:
    """Get the AI chat provider instance.
    
    Returns OpenAIChatProvider if available and configured,
    otherwise returns DummyAIProvider.
    
    This function NEVER raises an exception.
    
    Returns:
        AI provider instance (OpenAI or Dummy)
    """
    global _provider_instance
    
    if _provider_instance is not None:
        return _provider_instance
    
    api_key = os.getenv("OPENAI_API_KEY")
    
    # Try to create OpenAI provider
    if OpenAIChatProvider is not None:
        try:
            provider = OpenAIChatProvider(api_key=api_key)
            if provider.enabled:
                _provider_instance = provider
                logger.info("Using OpenAI provider")
                return provider
        except Exception as e:
            logger.warning(f"Failed to create OpenAI provider: {e}")
    
    # Fallback to dummy provider
    _provider_instance = DummyAIProvider()
    logger.info("Using Dummy AI provider (OpenAI not available)")
    return _provider_instance


def check_ai_available() -> bool:
    """Check if AI service is available.
    
    This function NEVER raises an exception.
    
    Returns:
        True if AI is available, False otherwise
    """
    try:
        provider = get_chat_provider()
        return provider.__class__.__name__ != "DummyAIProvider" and getattr(provider, 'enabled', False)
    except Exception:
        return False


def get_ai_status() -> Dict[str, Any]:
    """Get detailed AI service status.
    
    This function NEVER raises an exception.
    
    Returns:
        Dict with availability info
    """
    try:
        provider = get_chat_provider()
        if hasattr(provider, 'get_status'):
            return provider.get_status()
        return {
            "available": check_ai_available(),
            "provider": getattr(provider, 'provider_name', 'unknown'),
            "model": getattr(provider, 'model', 'unknown'),
        }
    except Exception as e:
        return {
            "available": False,
            "provider": "none",
            "model": "none",
            "error": str(e),
        }


def reset_provider_cache() -> None:
    """Reset the provider cache (for testing)."""
    global _provider_instance
    _provider_instance = None


# For backward compatibility
from .base import ChatProviderBase, LLMProviderError, ProviderResponse, ProviderUsage

__all__ = [
    "get_chat_provider",
    "check_ai_available",
    "get_ai_status",
    "reset_provider_cache",
    "DummyAIProvider",
    "OpenAIChatProvider",
    "ChatProviderBase",
    "LLMProviderError",
    "ProviderResponse",
    "ProviderUsage",
]
