"""OpenAI chat completion provider."""

from __future__ import annotations

from typing import Any, Sequence

import httpx
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from .base import ChatMessage, ChatProviderBase, LLMProviderError, ProviderResponse, ProviderUsage


class OpenAIChatProvider(ChatProviderBase):
    """Adapter for the OpenAI Chat Completions API."""

    provider_name = "openai"

    def __init__(self, api_key: str, model: str, *, base_url: str | None = None) -> None:
        if not api_key:
            raise ValueError("OpenAI API key missing")
        super().__init__(model=model)
        self.api_key = api_key
        self.base_url = (base_url or "https://api.openai.com").rstrip("/")

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
        }
        payload.update(kwargs)

        try:
            data = await self._request("/v1/chat/completions", payload, stream=payload["stream"])
        except httpx.TimeoutException as exc:  # pragma: no cover - exercised via router
            raise LLMProviderError("OpenAI timeout", status_code=504, is_timeout=True) from exc
        except httpx.HTTPStatusError as exc:
            raise LLMProviderError(f"OpenAI error: {exc.response.text}", status_code=exc.response.status_code) from exc
        except httpx.RequestError as exc:
            raise LLMProviderError(f"OpenAI transport error: {exc!s}") from exc

        if payload["stream"]:
            # Streaming aggregation: OpenAI returns event stream; we currently disable streaming responses
            payload["stream"] = False

        choices = data.get("choices", [])
        if not choices:
            raise LLMProviderError("OpenAI response missing choices")
        text = choices[0].get("message", {}).get("content", "").strip()
        usage_data = data.get("usage") or {}
        usage = ProviderUsage(
            input_tokens=usage_data.get("prompt_tokens", 0),
            output_tokens=usage_data.get("completion_tokens", 0),
        )
        return ProviderResponse(text=text, usage=usage, raw=data)

    async def _request(self, path: str, payload: dict[str, Any], *, stream: bool = False) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
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
                    if stream:
                        async with client.stream("POST", url, headers=headers, json=payload) as response:
                            response.raise_for_status()
                            chunks = []
                            async for chunk in response.aiter_text():
                                if chunk.strip().startswith("data:"):
                                    chunks.append(chunk.replace("data:", "").strip())
                            # Collapse SSE messages into a synthetic response
                            return {
                                "choices": [
                                    {
                                        "message": {
                                            "content": "".join(chunks),
                                        }
                                    }
                                ],
                                "usage": {},
                            }
                    response = await client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                    return response.json()

        raise LLMProviderError("OpenAI request did not complete")
