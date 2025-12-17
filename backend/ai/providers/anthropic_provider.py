"""Anthropic Claude provider."""

from __future__ import annotations

from typing import Any, Sequence

import httpx
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from .base import ChatMessage, ChatProviderBase, LLMProviderError, ProviderResponse, ProviderUsage


class AnthropicChatProvider(ChatProviderBase):
    """Adapter for the Anthropic Messages API."""

    provider_name = "anthropic"

    def __init__(self, api_key: str, model: str, *, base_url: str | None = None) -> None:
        if not api_key:
            raise ValueError("Anthropic API key missing")
        super().__init__(model=model)
        self.api_key = api_key
        self.base_url = (base_url or "https://api.anthropic.com").rstrip("/")

    async def chat(
        self,
        messages: Sequence[ChatMessage],
        stream: bool = False,
        **kwargs: Any,
    ) -> ProviderResponse:
        system_prompt, formatted_messages = self._prepare_messages(messages)
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": formatted_messages,
            "max_tokens": kwargs.get("max_tokens", 1024),
            "temperature": kwargs.get("temperature", 0.2),
        }
        if system_prompt:
            payload["system"] = system_prompt
        if stream:
            payload["stream"] = True

        try:
            data = await self._request("/v1/messages", payload)
        except httpx.TimeoutException as exc:  # pragma: no cover - handled at router level
            raise LLMProviderError("Anthropic timeout", status_code=504, is_timeout=True) from exc
        except httpx.HTTPStatusError as exc:
            raise LLMProviderError(
                f"Anthropic error: {exc.response.text}",
                status_code=exc.response.status_code,
            ) from exc
        except httpx.RequestError as exc:
            raise LLMProviderError(f"Anthropic transport error: {exc!s}") from exc

        content_blocks = data.get("content") or []
        text = "".join(block.get("text", "") for block in content_blocks).strip()
        usage_data = data.get("usage") or {}
        usage = ProviderUsage(
            input_tokens=usage_data.get("input_tokens", 0),
            output_tokens=usage_data.get("output_tokens", 0),
        )
        return ProviderResponse(text=text, usage=usage, raw=data)

    async def _request(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
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
                    response = await client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                    return response.json()
        raise LLMProviderError("Anthropic request failed")

    @staticmethod
    def _prepare_messages(messages: Sequence[ChatMessage]) -> tuple[str | None, list[dict[str, Any]]]:
        system_prompts: list[str] = []
        formatted: list[dict[str, Any]] = []
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            if isinstance(content, list):
                content_text = "\n".join(str(part) for part in content)
            else:
                content_text = str(content)
            if role == "system":
                system_prompts.append(content_text)
                continue
            if role not in {"user", "assistant"}:
                role = "user"
            formatted.append(
                {
                    "role": role,
                    "content": [{"type": "text", "text": content_text}],
                }
            )
        system_value = "\n".join(system_prompts) if system_prompts else None
        return system_value, formatted
