"""Ollama local LLM provider."""

from __future__ import annotations

from typing import Any, Sequence

import httpx
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from .base import ChatMessage, ChatProviderBase, LLMProviderError, ProviderResponse, ProviderUsage


class OllamaChatProvider(ChatProviderBase):
    """Adapter for the Ollama REST API."""

    provider_name = "ollama"

    def __init__(self, base_url: str, model: str, timeout: float = 120.0) -> None:
        super().__init__(model=model, timeout=timeout)
        self.base_url = (base_url or "http://localhost:11434").rstrip("/")

    async def chat(
        self,
        messages: Sequence[ChatMessage],
        stream: bool = False,
        **kwargs: Any,
    ) -> ProviderResponse:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": list(messages),
            "stream": False if not stream else True,
            "options": {"temperature": kwargs.get("temperature", 0.2)},
        }

        try:
            data = await self._request("/api/chat", payload)
        except httpx.TimeoutException as exc:  # pragma: no cover - surfaced via router
            raise LLMProviderError("Ollama timeout", status_code=504, is_timeout=True) from exc
        except httpx.HTTPStatusError as exc:
            raise LLMProviderError(
                f"Ollama error: {exc.response.text}",
                status_code=exc.response.status_code,
            ) from exc
        except httpx.RequestError as exc:
            raise LLMProviderError(f"Ollama transport error: {exc!s}") from exc

        message_payload = data.get("message") or {}
        text = message_payload.get("content", "").strip()
        usage = ProviderUsage(
            input_tokens=data.get("prompt_eval_count", 0),
            output_tokens=data.get("eval_count", 0),
        )
        return ProviderResponse(text=text, usage=usage, raw=data)

    async def _request(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        retryer = AsyncRetrying(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=1, max=5),
            retry=retry_if_exception_type(httpx.RequestError),
            reraise=True,
        )
        async for attempt in retryer:
            with attempt:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(url, json=payload)
                    response.raise_for_status()
                    return response.json()
        raise LLMProviderError("Ollama request failed")
