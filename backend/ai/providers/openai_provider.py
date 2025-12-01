"""OpenAI chat completion provider with enhanced error handling and retry logic."""

from __future__ import annotations

import logging
from typing import Any, Sequence

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)

from .base import ChatMessage, ChatProviderBase, LLMProviderError, ProviderResponse, ProviderUsage

logger = logging.getLogger("kyradi.ai.openai")


class OpenAIChatProvider(ChatProviderBase):
    """Adapter for the OpenAI Chat Completions API.
    
    Features:
    - Automatic retry on transient errors (3 attempts)
    - Exponential backoff
    - Proper timeout handling (40s default)
    - Structured error responses
    - Rate limit handling
    """

    provider_name = "openai"

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        base_url: str | None = None,
        timeout: float = 40.0,  # Increased timeout for reliability
    ) -> None:
        if not api_key:
            raise ValueError("OpenAI API key missing")
        super().__init__(model=model, timeout=timeout)
        self.api_key = api_key
        self.base_url = (base_url or "https://api.openai.com").rstrip("/")

    async def chat(
        self,
        messages: Sequence[ChatMessage],
        stream: bool = False,
        **kwargs: Any,
    ) -> ProviderResponse:
        """Send chat completion request to OpenAI.
        
        Args:
            messages: List of chat messages
            stream: Whether to use streaming (currently disabled for reliability)
            **kwargs: Additional parameters for the API
            
        Returns:
            ProviderResponse with text, usage, and raw response
            
        Raises:
            LLMProviderError: On API errors, timeouts, or invalid responses
        """
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": list(messages),
            "stream": False,  # Always disable streaming for reliability
        }
        payload.update(kwargs)

        logger.debug(
            f"OpenAI request: model={self.model}, message_count={len(messages)}, "
            f"timeout={self.timeout}"
        )

        try:
            data = await self._request("/v1/chat/completions", payload)
        except httpx.TimeoutException as exc:
            logger.error(f"OpenAI timeout after {self.timeout}s: {exc}")
            raise LLMProviderError(
                f"OpenAI isteği {self.timeout} saniye sonra zaman aşımına uğradı",
                status_code=504,
                is_timeout=True,
            ) from exc
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            error_text = exc.response.text[:500]  # Truncate for logging
            logger.error(f"OpenAI HTTP error: status={status_code}, response={error_text}")
            
            # Handle specific error codes
            if status_code == 429:
                raise LLMProviderError(
                    "OpenAI rate limit aşıldı. Lütfen biraz bekleyip tekrar deneyin.",
                    status_code=429,
                ) from exc
            elif status_code == 401:
                raise LLMProviderError(
                    "OpenAI API key geçersiz",
                    status_code=401,
                ) from exc
            elif status_code == 503:
                raise LLMProviderError(
                    "OpenAI servisi şu anda kullanılamıyor",
                    status_code=503,
                ) from exc
            else:
                raise LLMProviderError(
                    f"OpenAI hatası: {error_text}",
                    status_code=status_code,
                ) from exc
        except httpx.RequestError as exc:
            logger.error(f"OpenAI transport error: {exc}")
            raise LLMProviderError(
                f"OpenAI bağlantı hatası: {str(exc)}",
                status_code=502,
            ) from exc

        # Parse response
        choices = data.get("choices", [])
        if not choices:
            logger.error(f"OpenAI response missing choices: {data}")
            raise LLMProviderError(
                "OpenAI yanıtı geçersiz (choices boş)",
                status_code=502,
            )
        
        text = choices[0].get("message", {}).get("content", "").strip()
        if not text:
            logger.warning(f"OpenAI returned empty content: {data}")
        
        usage_data = data.get("usage") or {}
        usage = ProviderUsage(
            input_tokens=usage_data.get("prompt_tokens", 0),
            output_tokens=usage_data.get("completion_tokens", 0),
        )
        
        logger.debug(
            f"OpenAI response: tokens_in={usage.input_tokens}, "
            f"tokens_out={usage.output_tokens}, text_length={len(text)}"
        )
        
        return ProviderResponse(text=text, usage=usage, raw=data)

    async def _request(
        self,
        path: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Make HTTP request to OpenAI API with retry logic.
        
        Args:
            path: API endpoint path
            payload: Request payload
            
        Returns:
            JSON response from API
            
        Raises:
            httpx.TimeoutException: On timeout
            httpx.HTTPStatusError: On HTTP errors
            httpx.RequestError: On transport errors
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        url = f"{self.base_url}{path}"
        
        # Retry configuration
        retryer = AsyncRetrying(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=1, max=10),
            retry=retry_if_exception_type((httpx.RequestError, httpx.TimeoutException)),
            before_sleep=before_sleep_log(logger, logging.WARNING),
            reraise=True,
        )

        async for attempt in retryer:
            with attempt:
                logger.debug(f"OpenAI request attempt {attempt.retry_state.attempt_number}")
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                    return response.json()

        # This should never be reached due to reraise=True
        raise LLMProviderError("OpenAI request did not complete after retries")
