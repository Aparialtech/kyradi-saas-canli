"""AI Providers Factory - Safe initialization that never crashes.

This module provides AI providers with graceful fallback chain:
OpenAI → Ollama → DummyAIProvider

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
from typing import Any, Dict, Union, Optional

logger = logging.getLogger("kyradi.ai.providers")

# Import dummy provider (always available)
from .dummy_provider import DummyAIProvider

# Import OpenAI provider (may fail, that's OK)
OpenAIChatProvider = None
OPENAI_AVAILABLE = False
try:
    from .openai_provider import OpenAIChatProvider as _OpenAIChatProvider, OPENAI_AVAILABLE as _OPENAI_AVAILABLE
    OpenAIChatProvider = _OpenAIChatProvider
    OPENAI_AVAILABLE = _OPENAI_AVAILABLE
except ImportError:
    logger.warning("OpenAI provider module not available")
except Exception as e:
    logger.warning(f"Failed to import OpenAI provider: {e}")

# Import Ollama provider (may fail, that's OK)
OllamaAIProvider = None
try:
    from .ollama_provider import OllamaAIProvider as _OllamaAIProvider
    OllamaAIProvider = _OllamaAIProvider
except ImportError:
    logger.warning("Ollama provider module not available")
except Exception as e:
    logger.warning(f"Failed to import Ollama provider: {e}")


# Cached provider instance
_provider_instance = None
_provider_chain: list = []


def _build_provider_chain() -> list:
    """Build the provider fallback chain."""
    from app.core.config import settings
    
    chain = []
    
    # 1. OpenAI (primary)
    # Use settings instead of direct env access
    api_key = settings.openai_api_key
    if OpenAIChatProvider is not None and api_key:
        try:
            provider = OpenAIChatProvider(
                api_key=api_key,
                model=settings.ai_model,
                org_id=settings.openai_org_id,
            )
            if provider.enabled:
                chain.append(("openai", provider))
                logger.info(f"OpenAI provider added to chain (model: {settings.ai_model})")
            else:
                logger.warning(f"OpenAI provider disabled: {getattr(provider, '_error', 'unknown error')}")
        except Exception as e:
            logger.warning(f"Failed to create OpenAI provider: {e}")
    elif OpenAIChatProvider is not None:
        logger.warning("OpenAI provider available but OPENAI_API_KEY not configured. Set OPENAI_API_KEY env variable to enable AI chat.")
    
    # 2. Ollama (secondary/local fallback)
    if OllamaAIProvider is not None:
        try:
            provider = OllamaAIProvider()
            chain.append(("ollama", provider))
            logger.info("Ollama provider added to chain (will check availability on first use)")
        except Exception as e:
            logger.warning(f"Failed to create Ollama provider: {e}")
    
    # 3. Dummy (always available fallback)
    chain.append(("dummy", DummyAIProvider()))
    
    return chain


def get_chat_provider() -> Union[Any, DummyAIProvider]:
    """Get the AI chat provider instance.
    
    Returns the first available provider from the chain:
    OpenAI → Ollama → Dummy
    
    This function NEVER raises an exception.
    Dummy provider is ALWAYS available and provides helpful offline responses.
    
    Returns:
        AI provider instance
    """
    global _provider_instance, _provider_chain
    
    if _provider_instance is not None:
        return _provider_instance
    
    if not _provider_chain:
        _provider_chain = _build_provider_chain()
    
    # Return the first provider that's enabled
    for name, provider in _provider_chain:
        if name == "openai" and getattr(provider, 'enabled', False):
            _provider_instance = provider
            logger.info(f"Using OpenAI provider (model: {getattr(provider, 'model', 'unknown')})")
            return provider
        
        # For Ollama, check availability
        if name == "ollama":
            if getattr(provider, 'enabled', False):
                _provider_instance = provider
                logger.info("Using Ollama provider")
                return provider
            # Skip Ollama if not enabled, fall through to Dummy
            continue
        
        if name == "dummy":
            _provider_instance = provider
            logger.info("Using Dummy AI provider (offline helper mode)")
            return provider
    
    # Fallback to dummy - always works
    _provider_instance = DummyAIProvider()
    logger.info("Using Dummy AI provider (fallback)")
    return _provider_instance


async def get_best_available_provider() -> tuple[str, Any]:
    """Async version that checks Ollama availability.
    
    Returns:
        Tuple of (provider_name, provider_instance)
    """
    global _provider_chain
    
    if not _provider_chain:
        _provider_chain = _build_provider_chain()
    
    for name, provider in _provider_chain:
        if name == "openai" and getattr(provider, 'enabled', False):
            return name, provider
        
        if name == "ollama":
            # Check Ollama availability
            if hasattr(provider, '_check_availability'):
                await provider._check_availability()
            if getattr(provider, 'enabled', False):
                return name, provider
        
        if name == "dummy":
            return name, provider
    
    return "dummy", DummyAIProvider()


def check_ai_available() -> bool:
    """Check if AI service is available.
    
    This function NEVER raises an exception.
    Always returns True because Dummy provider provides helpful offline responses.
    
    Returns:
        True - AI is always available (Dummy provides offline help)
    """
    try:
        provider = get_chat_provider()
        # All providers including Dummy are considered "available"
        # because Dummy provides helpful offline responses
        return getattr(provider, 'enabled', True)
    except Exception:
        return True  # Even on error, Dummy will be used


def get_ai_status() -> Dict[str, Any]:
    """Get detailed AI service status.
    
    This function NEVER raises an exception.
    
    Returns:
        Dict with availability info
    """
    try:
        provider = get_chat_provider()
        if hasattr(provider, 'get_status'):
            status = provider.get_status()
        else:
            status = {
                "available": check_ai_available(),
                "provider": getattr(provider, 'provider_name', 'unknown'),
                "model": getattr(provider, 'model', 'unknown'),
            }
        
        # Add fallback chain info
        status["fallback_chain"] = [name for name, _ in _provider_chain] if _provider_chain else ["unknown"]
        return status
    except Exception as e:
        return {
            "available": False,
            "provider": "none",
            "model": "none",
            "error": str(e),
            "fallback_chain": [],
        }


def reset_provider_cache() -> None:
    """Reset the provider cache (for testing)."""
    global _provider_instance, _provider_chain
    _provider_instance = None
    _provider_chain = []


# For backward compatibility
from .base import ChatProviderBase, LLMProviderError, ProviderResponse, ProviderUsage

__all__ = [
    "get_chat_provider",
    "get_best_available_provider",
    "check_ai_available",
    "get_ai_status",
    "reset_provider_cache",
    "DummyAIProvider",
    "OpenAIChatProvider",
    "OllamaAIProvider",
    "ChatProviderBase",
    "LLMProviderError",
    "ProviderResponse",
    "ProviderUsage",
]
