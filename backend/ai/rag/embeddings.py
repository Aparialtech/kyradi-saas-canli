"""Embedding helpers supporting OpenAI and Ollama providers."""

from __future__ import annotations

from typing import Sequence

import httpx
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings


class EmbeddingError(Exception):
    """Raised when embedding generation fails."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


async def embed_texts(
    texts: Sequence[str],
    *,
    model: str | None = None,
) -> list[list[float]]:
    """Return embeddings for the provided texts."""
    entries = [text for text in texts if text.strip()]
    if not entries:
        return []

    provider = (settings.embedding_provider or "openai").lower()
    target_model = model or settings.embedding_model
    if provider == "ollama":
        return await _embed_with_ollama(entries, target_model)
    return await _embed_with_openai(entries, target_model)


async def _embed_with_openai(texts: Sequence[str], model: str) -> list[list[float]]:
    if not settings.openai_api_key:
        raise EmbeddingError("OPENAI_API_KEY missing for embeddings")

    payload = {
        "model": model,
        "input": list(texts),
    }
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    retryer = AsyncRetrying(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        retry=retry_if_exception_type(httpx.RequestError),
        reraise=True,
    )
    url = "https://api.openai.com/v1/embeddings"

    async for attempt in retryer:
        with attempt:
            async with httpx.AsyncClient(timeout=30.0) as client:
                try:
                    response = await client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                except httpx.HTTPStatusError as exc:
                    message = _format_error(exc.response)
                    if exc.response.status_code == 429:
                        raise EmbeddingError(
                            "Embedding isteği limiti aştı, lütfen daha sonra deneyin.",
                            status_code=429,
                        ) from exc
                    raise EmbeddingError(message, status_code=exc.response.status_code) from exc
                data = response.json()
                vectors = [item["embedding"] for item in data.get("data", [])]
                if len(vectors) != len(texts):
                    raise EmbeddingError("Embedding count mismatch")
                return vectors

    raise EmbeddingError("Embedding request failed")


async def _embed_with_ollama(texts: Sequence[str], model: str) -> list[list[float]]:
    base_url = (settings.ollama_base_url or "http://localhost:11434").rstrip("/")
    if not model:
        raise EmbeddingError("OLLAMA embedding modeli tanımlanmadı")

    results: list[list[float]] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for text in texts:
            payload = {"model": model, "prompt": text}
            try:
                response = await client.post(f"{base_url}/api/embeddings", json=payload)
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                message = _format_error(exc.response)
                raise EmbeddingError(message, status_code=exc.response.status_code) from exc
            except httpx.RequestError as exc:
                raise EmbeddingError(f"Ollama embedding isteği başarısız: {exc!s}") from exc

            data = response.json()
            vector = data.get("embedding")
            if not vector:
                raise EmbeddingError("Ollama embedding cevabı boş döndü")
            results.append(vector)
    return results


def _format_error(response: httpx.Response) -> str:
    try:
        payload = response.json()
        detail = payload.get("error", {}).get("message")
        if detail:
            return detail
    except Exception:  # noqa: BLE001
        return response.text[:200]
    return f"Embedding provider error ({response.status_code})"
