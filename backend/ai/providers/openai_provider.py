"""OpenAI Chat Provider - Safe implementation that never crashes on import.

This module wraps OpenAI in try/except to prevent backend crashes.
If OpenAI is not available, the provider operates in disabled mode.
"""

import os
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("kyradi.ai.openai")

# Import settings safely
try:
    from app.core.config import settings
except ImportError:
    # Fallback if settings not available (shouldn't happen in normal operation)
    logger.warning("Could not import settings, OpenAI provider will use defaults")
    settings = None

# Import error classes
try:
    from ai.schemas import AIProviderError
except ImportError:
    # Fallback error class if schemas not available
    class AIProviderError(Exception):
        def __init__(self, code: str, message: str, retry_after_seconds: Optional[int] = None):
            self.code = code
            self.message = message
            self.retry_after_seconds = retry_after_seconds
            super().__init__(message)

# Safe import of OpenAI - NEVER crash on import
OPENAI_AVAILABLE = False
AsyncOpenAI = None
AuthenticationError = Exception
RateLimitError = Exception
APIError = Exception
APITimeoutError = Exception

try:
    from openai import (
        AsyncOpenAI as _AsyncOpenAI,
        AuthenticationError as _AuthenticationError,
        RateLimitError as _RateLimitError,
        APIError as _APIError,
        APITimeoutError as _APITimeoutError,
    )
    AsyncOpenAI = _AsyncOpenAI
    AuthenticationError = _AuthenticationError
    RateLimitError = _RateLimitError
    APIError = _APIError
    APITimeoutError = _APITimeoutError
    OPENAI_AVAILABLE = True
    logger.info("OpenAI library loaded successfully")
except ImportError as e:
    logger.warning(f"OpenAI library not installed: {e}")
except Exception as e:
    logger.warning(f"OpenAI import failed: {e}")


class OpenAIChatProvider:
    """OpenAI Chat Provider with safe initialization.
    
    This provider:
    - Never crashes on initialization
    - Works in disabled mode if OpenAI is not available
    - Raises structured AIProviderError exceptions for proper error handling
    - Uses settings from app.core.config for API key and model
    """
    
    provider_name = "openai"
    
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, org_id: Optional[str] = None):
        """Initialize OpenAI provider.
        
        Args:
            api_key: OpenAI API key (defaults to settings.openai_api_key if None)
            model: Model to use (defaults to settings.ai_model if None)
            org_id: OpenAI organization ID (defaults to settings.openai_org_id if None)
        """
        # Use settings if not provided
        if settings is not None:
            self.api_key = api_key or settings.openai_api_key
            self.model = model or settings.ai_model
            self.org_id = org_id or settings.openai_org_id
        else:
            # Fallback if settings not available
            self.api_key = api_key
            self.model = model or "gpt-4o-mini"
            self.org_id = org_id
        self.client = None
        self.enabled = False
        self._error: Optional[str] = None
        
        # Only enable if library is available AND api_key is provided
        if not OPENAI_AVAILABLE:
            self._error = "OpenAI library not installed"
            logger.warning("OpenAI provider disabled: library not installed")
        elif not self.api_key:
            self._error = "OPENAI_API_KEY not configured"
            logger.warning("OpenAI provider disabled: API key not configured. Set OPENAI_API_KEY env variable.")
        else:
            try:
                self.client = AsyncOpenAI(
                    api_key=self.api_key,
                    organization=self.org_id,
                    timeout=60.0,
                )
                self.enabled = True
                logger.info(f"OpenAI provider enabled: model={self.model}, org_id={self.org_id or 'none'}")
            except Exception as e:
                self._error = f"Failed to initialize OpenAI client: {e}"
                logger.error(self._error)
    
    def is_available(self) -> bool:
        """Check if this provider is available for use."""
        return self.enabled
    
    def get_status(self) -> Dict[str, Any]:
        """Get detailed status of this provider."""
        return {
            "available": self.enabled,
            "provider": "openai",
            "model": self.model,
            "library_installed": OPENAI_AVAILABLE,
            "api_key_configured": bool(self.api_key),
            "error": self._error,
        }
    
    async def chat(self, prompt: str) -> Dict[str, Any]:
        """Send chat request to OpenAI.
        
        Args:
            prompt: User's prompt
            
        Returns:
            Dict with answer or error (backward compatible format)
            
        Raises:
            AIProviderError: For all AI-related errors with structured error codes
        """
        if not self.enabled:
            raise AIProviderError(
                code="AI_DISABLED",
                message="AI servisi şu anda yapılandırılmamış. Lütfen yöneticinizle iletişime geçin.",
            )
        
        # Import system prompt
        try:
            from ai.prompts import SYSTEM_PROMPT
        except ImportError:
            logger.warning("Could not import SYSTEM_PROMPT, using default")
            SYSTEM_PROMPT = "Sen Kyradi AI Asistanısın. Kyradi platformu hakkında yardımcı ol."
        
        try:
            completion = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.7,  # Daha doğal konuşma için artırıldı
            )
            
            answer = completion.choices[0].message.content if completion.choices else ""
            if not answer:
                raise AIProviderError(
                    code="EMPTY_RESPONSE",
                    message="AI servisi boş yanıt döndü. Lütfen tekrar deneyin.",
                )
            
            return {
                "answer": answer,
                "success": True,
                "model": self.model,
                "usage": {
                    "input_tokens": completion.usage.prompt_tokens if completion.usage else 0,
                    "output_tokens": completion.usage.completion_tokens if completion.usage else 0,
                }
            }
            
        except RateLimitError as e:
            logger.warning(f"OpenAI rate limit: {e}")
            raise AIProviderError(
                code="RATE_LIMIT",
                message="OpenAI API rate limit aşıldı. Lütfen birkaç saniye sonra tekrar deneyin.",
                retry_after_seconds=10,
            ) from e
        except AuthenticationError as e:
            logger.error(f"OpenAI authentication error: {e}")
            raise AIProviderError(
                code="AUTH_ERROR",
                message="OpenAI API anahtarı geçersiz veya yetkisiz görünüyor. Lütfen API anahtarını kontrol edin.",
            ) from e
        except APITimeoutError as e:
            logger.error(f"OpenAI timeout: {e}")
            raise AIProviderError(
                code="TIMEOUT",
                message="AI servisine bağlanırken zaman aşımı oluştu. Lütfen tekrar deneyin.",
            ) from e
        except APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise AIProviderError(
                code="API_ERROR",
                message="AI servisi şu anda bir hata veriyor. Bir süre sonra tekrar deneyin.",
            ) from e
        except AIProviderError:
            # Re-raise our custom errors
            raise
        except Exception as e:
            logger.exception(f"Unexpected OpenAI error: {e}")
            raise AIProviderError(
                code="UNKNOWN",
                message="AI asistanı şu anda beklenmeyen bir hata aldı.",
            ) from e
