"""OpenAI chat completion provider using official OpenAI SDK.

Bu provider AsyncOpenAI client kullanır ve tüm AI isteklerini OpenAI'ya yönlendirir.
Model: gpt-4.1-mini (default)
"""

from __future__ import annotations

import os
import logging
from typing import Any, Sequence

from openai import AsyncOpenAI, AuthenticationError, RateLimitError, APIError, APITimeoutError

from .base import ChatMessage, ChatProviderBase, LLMProviderError, ProviderResponse, ProviderUsage

logger = logging.getLogger("kyradi.ai.openai")


class OpenAIChatProvider(ChatProviderBase):
    """OpenAI Chat Completions provider using official SDK.
    
    Features:
    - AsyncOpenAI client for async operations
    - Proper error handling (AuthenticationError, RateLimitError, etc.)
    - Timeout handling (60s default)
    - Structured logging
    """

    provider_name = "openai"

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4.1-mini",
        *,
        base_url: str | None = None,
        timeout: float = 60.0,
    ) -> None:
        """Initialize OpenAI provider.
        
        Args:
            api_key: OpenAI API key
            model: Model to use (default: gpt-4.1-mini)
            base_url: Optional custom base URL
            timeout: Request timeout in seconds (default: 60s)
            
        Raises:
            ValueError: If api_key is empty
        """
        if not api_key:
            raise ValueError("OpenAI API key is required")
        
        super().__init__(model=model, timeout=timeout)
        
        # Initialize AsyncOpenAI client
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
        )
        
        logger.info(f"OpenAI provider initialized: model={model}, timeout={timeout}s")

    async def chat(
        self,
        messages: Sequence[ChatMessage],
        stream: bool = False,
        **kwargs: Any,
    ) -> ProviderResponse:
        """Send chat completion request to OpenAI.
        
        Args:
            messages: List of chat messages [{"role": "...", "content": "..."}]
            stream: Whether to stream (disabled for reliability)
            **kwargs: Additional parameters (max_tokens, temperature, etc.)
            
        Returns:
            ProviderResponse with text, usage, and raw response
            
        Raises:
            LLMProviderError: On API errors
        """
        logger.debug(
            f"OpenAI chat request: model={self.model}, "
            f"messages={len(messages)}, stream={stream}"
        )
        
        try:
            # Build parameters
            params = {
                "model": self.model,
                "messages": [dict(m) for m in messages],
                "max_tokens": kwargs.get("max_tokens", 1000),
                "temperature": kwargs.get("temperature", 0.7),
            }
            
            # Make API call
            response = await self.client.chat.completions.create(**params)
            
            # Extract response
            choice = response.choices[0] if response.choices else None
            if not choice:
                raise LLMProviderError(
                    "OpenAI yanıtı boş (choices yok)",
                    status_code=502,
                )
            
            text = choice.message.content or ""
            text = text.strip()
            
            # Extract usage
            usage = ProviderUsage(
                input_tokens=response.usage.prompt_tokens if response.usage else 0,
                output_tokens=response.usage.completion_tokens if response.usage else 0,
            )
            
            logger.info(
                f"OpenAI response: tokens_in={usage.input_tokens}, "
                f"tokens_out={usage.output_tokens}, text_length={len(text)}"
            )
            
            return ProviderResponse(
                text=text,
                usage=usage,
                raw=response.model_dump() if hasattr(response, 'model_dump') else {},
            )
            
        except AuthenticationError as exc:
            logger.error(f"OpenAI authentication error: {exc}")
            raise LLMProviderError(
                "AI servisi yapılandırılmamış: OPENAI_API_KEY eksik veya hatalı.",
                status_code=401,
            ) from exc
            
        except RateLimitError as exc:
            logger.warning(f"OpenAI rate limit: {exc}")
            raise LLMProviderError(
                "OpenAI kullanım limiti doldu. Birkaç saniye sonra tekrar deneyin.",
                status_code=429,
            ) from exc
            
        except APITimeoutError as exc:
            logger.error(f"OpenAI timeout: {exc}")
            raise LLMProviderError(
                f"OpenAI isteği {self.timeout} saniye sonra zaman aşımına uğradı.",
                status_code=504,
                is_timeout=True,
            ) from exc
            
        except APIError as exc:
            logger.error(f"OpenAI API error: {exc}")
            status_code = getattr(exc, 'status_code', 502) or 502
            raise LLMProviderError(
                f"OpenAI hatası: {str(exc)}",
                status_code=status_code,
            ) from exc
            
        except Exception as exc:
            logger.exception(f"Unexpected OpenAI error: {exc}")
            raise LLMProviderError(
                f"AI servisi şu anda kullanılamıyor: {str(exc)}",
                status_code=500,
            ) from exc
