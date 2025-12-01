"""OpenAI Chat Provider - Safe implementation that never crashes on import.

This module wraps OpenAI in try/except to prevent backend crashes.
If OpenAI is not available, the provider operates in disabled mode.
"""

import os
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("kyradi.ai.openai")

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
    - Returns safe error responses instead of raising exceptions
    """
    
    provider_name = "openai"
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        """Initialize OpenAI provider.
        
        Args:
            api_key: OpenAI API key (can be None)
            model: Model to use (default: gpt-4o-mini)
        """
        self.model = model
        self.api_key = api_key
        self.client = None
        self.enabled = False
        self._error: Optional[str] = None
        
        # Only enable if library is available AND api_key is provided
        if not OPENAI_AVAILABLE:
            self._error = "OpenAI library not installed"
            logger.warning("OpenAI provider disabled: library not installed")
        elif not api_key:
            self._error = "OPENAI_API_KEY not configured"
            logger.warning("OpenAI provider disabled: API key not configured")
        else:
            try:
                self.client = AsyncOpenAI(api_key=api_key, timeout=60.0)
                self.enabled = True
                logger.info(f"OpenAI provider enabled: model={model}")
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
            Dict with answer or error
        """
        if not self.enabled:
            return {
                "answer": "",
                "success": False,
                "error": self._error or "AI service disabled",
            }
        
        try:
            completion = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.7,
            )
            
            answer = completion.choices[0].message.content if completion.choices else ""
            
            return {
                "answer": answer,
                "success": True,
                "model": self.model,
                "usage": {
                    "input_tokens": completion.usage.prompt_tokens if completion.usage else 0,
                    "output_tokens": completion.usage.completion_tokens if completion.usage else 0,
                }
            }
            
        except AuthenticationError as e:
            logger.error(f"OpenAI authentication error: {e}")
            return {
                "answer": "",
                "success": False,
                "error": "Invalid API key",
            }
        except RateLimitError as e:
            logger.warning(f"OpenAI rate limit: {e}")
            return {
                "answer": "",
                "success": False,
                "error": "Rate limit exceeded, please try again later",
            }
        except APITimeoutError as e:
            logger.error(f"OpenAI timeout: {e}")
            return {
                "answer": "",
                "success": False,
                "error": "Request timed out",
            }
        except APIError as e:
            logger.error(f"OpenAI API error: {e}")
            return {
                "answer": "",
                "success": False,
                "error": f"API error: {str(e)}",
            }
        except Exception as e:
            logger.exception(f"Unexpected OpenAI error: {e}")
            return {
                "answer": "",
                "success": False,
                "error": f"Unexpected error: {str(e)}",
            }
