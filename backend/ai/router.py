"""FastAPI router exposing AI ingestion, chat, and assistant endpoints.

Bu modül Kyradi AI Asistanı için tüm endpoint'leri sağlar.
- /ai/chat - Temel chat endpoint
- /ai/assistant - Basit assistant endpoint (auth opsiyonel)
- /ai/health - Health check
- /ai/ingest - Doküman yükleme
"""

from __future__ import annotations

import hashlib
import logging
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Optional, Sequence

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.dependencies import get_current_active_user
from app.models import User

from .observability import AIObservation, generate_request_id, log_ai_interaction
from .prompts import KYRADI_SYSTEM_PROMPT, SYSTEM_PROMPT_TR, ERROR_ANALYSIS_PROMPT
from .providers import get_chat_provider
from .providers.base import LLMProviderError
from .rag.chunker import chunk_text, strip_html
from .rag.embeddings import EmbeddingError, embed_texts
from .rag.store import DocumentRecord, semantic_search, upsert_documents
from .rate_limit import RateLimitError, rate_limiter

logger = logging.getLogger("kyradi.ai")

router = APIRouter(prefix="/ai", tags=["ai"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class IngestRequest(BaseModel):
    tenant_id: str = Field(..., description="Tenant scope")
    title: str | None = Field(default=None, max_length=255)
    text: str = Field(..., min_length=1)
    url: str | None = Field(default=None, max_length=1024)
    mime: str = Field(default="text/plain", pattern=r"^text/(plain|html)$")


class IngestResponse(BaseModel):
    ok: bool
    count: int


class ChatRequest(BaseModel):
    tenant_id: str
    user_id: str
    message: str = Field(..., min_length=1)
    locale: str = Field(default="tr-TR", max_length=16)
    use_rag: bool = True
    top_k: int = Field(default=6, ge=1, le=12)
    stream: bool = False
    metadata: dict[str, Any] | None = None


class AssistantRequest(BaseModel):
    """Simplified assistant request for public/unauthenticated access."""
    message: str = Field(..., min_length=1, max_length=4000, description="User's question")
    tenant_id: Optional[str] = Field(default=None, description="Optional tenant ID")
    locale: str = Field(default="tr-TR", max_length=16)
    use_technical_mode: bool = Field(default=True, description="Use technical Kyradi prompt")
    metadata: dict[str, Any] | None = None


class Source(BaseModel):
    title: str
    snippet: str


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    usage: Usage
    latency_ms: float
    request_id: str


class AssistantResponse(BaseModel):
    """Assistant response model."""
    answer: str
    request_id: str
    usage: Usage
    latency_ms: float
    model: str
    success: bool = True
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    provider: str
    model: str
    timestamp: str


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None
    request_id: Optional[str] = None


# =============================================================================
# HEALTH ENDPOINT
# =============================================================================

@router.get("/health", response_model=HealthResponse)
async def ai_health_check() -> HealthResponse:
    """Check AI service health and provider availability.
    
    Returns:
        Health status with provider info
    """
    try:
        provider = get_chat_provider()
        return HealthResponse(
            status="ok",
            provider=provider.provider_name,
            model=provider.model,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        logger.error(f"AI health check failed: {exc}")
        return HealthResponse(
            status="error",
            provider="unknown",
            model="unknown",
            timestamp=datetime.now(timezone.utc).isoformat(),
        )


# =============================================================================
# ASSISTANT ENDPOINT (Simplified, Auth Optional)
# =============================================================================

@router.post("/assistant", response_model=AssistantResponse)
async def assistant_chat(
    payload: AssistantRequest,
    request: Request,
) -> AssistantResponse:
    """Simplified assistant endpoint for Kyradi AI chat.
    
    This endpoint:
    - Does NOT require authentication (for demo/public access)
    - Uses the comprehensive Kyradi system prompt
    - Has built-in error handling and retry logic
    - Returns structured JSON response always
    
    Args:
        payload: AssistantRequest with message
        request: FastAPI request object
        
    Returns:
        AssistantResponse with answer or error
    """
    request_id = generate_request_id()
    start_time = time.perf_counter()
    
    # Log incoming request
    logger.info(
        f"Assistant request: request_id={request_id}, "
        f"message_length={len(payload.message)}, "
        f"locale={payload.locale}, "
        f"tenant_id={payload.tenant_id or 'none'}, "
        f"client={request.client.host if request.client else 'unknown'}"
    )
    
    try:
        # Get provider
        try:
            provider = get_chat_provider()
        except Exception as provider_exc:
            logger.error(f"Failed to get AI provider: {provider_exc}")
            return AssistantResponse(
                answer="",
                request_id=request_id,
                usage=Usage(),
                latency_ms=0,
                model="unknown",
                success=False,
                error=f"AI servisi şu anda kullanılamıyor: {str(provider_exc)}",
            )
        
        # Build messages with appropriate system prompt
        system_prompt = KYRADI_SYSTEM_PROMPT if payload.use_technical_mode else SYSTEM_PROMPT_TR
        
        messages: list[dict[str, str]] = [
            {"role": "system", "content": system_prompt.strip()},
            {"role": "user", "content": payload.message.strip()},
        ]
        
        # Call LLM provider with timeout and error handling
        try:
            provider_response = await provider.chat(
                messages,
                stream=False,  # Disable streaming for reliability
            )
        except LLMProviderError as llm_exc:
            latency_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"LLM provider error: request_id={request_id}, "
                f"error={llm_exc}, is_timeout={llm_exc.is_timeout}"
            )
            
            # Log failed interaction
            log_ai_interaction(
                AIObservation(
                    request_id=request_id,
                    provider=provider.provider_name,
                    model=provider.model,
                    latency_ms=latency_ms,
                    tokens_in=0,
                    tokens_out=0,
                    success=False,
                    prompt=payload.message,
                    response=None,
                    metadata=payload.metadata or {},
                    error=str(llm_exc),
                )
            )
            
            error_msg = "LLM isteği zaman aşımına uğradı" if llm_exc.is_timeout else str(llm_exc)
            return AssistantResponse(
                answer="",
                request_id=request_id,
                usage=Usage(),
                latency_ms=round(latency_ms, 2),
                model=provider.model,
                success=False,
                error=error_msg,
            )
        
        latency_ms = (time.perf_counter() - start_time) * 1000
        answer_text = provider_response.text.strip()
        usage = provider_response.usage
        
        # Log successful interaction
        log_ai_interaction(
            AIObservation(
                request_id=request_id,
                provider=provider.provider_name,
                model=provider.model,
                latency_ms=latency_ms,
                tokens_in=usage.input_tokens,
                tokens_out=usage.output_tokens,
                success=True,
                prompt=payload.message,
                response=answer_text[:500],  # Truncate for logging
                metadata={
                    **(payload.metadata or {}),
                    "tenant_id": payload.tenant_id,
                    "locale": payload.locale,
                },
            )
        )
        
        logger.info(
            f"Assistant response: request_id={request_id}, "
            f"latency_ms={latency_ms:.2f}, "
            f"tokens_in={usage.input_tokens}, tokens_out={usage.output_tokens}, "
            f"answer_length={len(answer_text)}"
        )
        
        return AssistantResponse(
            answer=answer_text,
            request_id=request_id,
            usage=Usage(input_tokens=usage.input_tokens, output_tokens=usage.output_tokens),
            latency_ms=round(latency_ms, 2),
            model=provider.model,
            success=True,
        )
        
    except Exception as exc:
        latency_ms = (time.perf_counter() - start_time) * 1000
        error_traceback = traceback.format_exc()
        logger.error(
            f"Assistant unexpected error: request_id={request_id}, "
            f"error={exc}, traceback={error_traceback}"
        )
        
        return AssistantResponse(
            answer="",
            request_id=request_id,
            usage=Usage(),
            latency_ms=round(latency_ms, 2),
            model="unknown",
            success=False,
            error=f"Beklenmeyen hata: {str(exc)}",
        )


# =============================================================================
# INGEST ENDPOINT
# =============================================================================

@router.post("/ingest", response_model=IngestResponse)
async def ingest_documents(
    payload: IngestRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> IngestResponse:
    """Ingest tenant documents and store embeddings in pgvector."""
    tenant_id = _ensure_tenant_access(payload.tenant_id, current_user)
    normalized_text = _normalize_text(payload.text, payload.mime)
    if not normalized_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Boş içerik gönderilemez")

    chunks = chunk_text(normalized_text, title=payload.title or payload.url)
    if not chunks:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="İçerik bölümlenemedi")

    try:
        embeddings = await embed_texts([chunk.content for chunk in chunks])
    except EmbeddingError as exc:
        logger.exception("Embedding failed during ingest: %s", exc)
        status_code = exc.status_code or status.HTTP_502_BAD_GATEWAY
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    docs: list[DocumentRecord] = []
    for chunk, embedding in zip(chunks, embeddings, strict=False):
        doc_id = _build_doc_id(tenant_id, payload.url or payload.title or "", chunk.content, chunk.order)
        doc: DocumentRecord = {
            "doc_id": doc_id,
            "title": chunk.title or payload.title or "Doküman",
            "content": chunk.content,
            "embedding": embedding,
            "meta": {
                "source_url": payload.url,
                "mime": payload.mime,
                "order": chunk.order,
                "ingested_at": datetime.now(timezone.utc).isoformat(),
            },
        }
        docs.append(doc)

    count = await upsert_documents(session, tenant_id, docs)
    return IngestResponse(ok=True, count=count)


# =============================================================================
# CHAT ENDPOINT (Full Featured, Requires Auth)
# =============================================================================

@router.post("/chat", response_model=ChatResponse)
async def chat_completion(
    payload: ChatRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> ChatResponse:
    """Return an AI-generated answer using optional RAG context.
    
    This endpoint requires authentication and supports RAG (Retrieval Augmented Generation).
    """
    tenant_id = _ensure_tenant_access(payload.tenant_id, current_user)
    request_id = generate_request_id()
    identity = f"{request.client.host or 'unknown'}:{payload.user_id}:{tenant_id}"

    logger.info(
        f"Chat request: request_id={request_id}, tenant_id={tenant_id}, "
        f"user_id={payload.user_id}, use_rag={payload.use_rag}"
    )

    try:
        await rate_limiter.check(identity)
    except RateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Hız sınırı aşıldı",
            headers={"Retry-After": "60"},
        ) from exc

    try:
        provider = get_chat_provider()
    except Exception as exc:
        logger.error(f"Failed to get AI provider: {exc}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"message": "AI servisi şu anda kullanılamıyor", "request_id": request_id},
        ) from exc

    rag_sources: list[dict[str, str]] = []
    rag_notice: str | None = None

    if payload.use_rag:
        try:
            rag_sources = await semantic_search(
                session,
                tenant_id,
                payload.message,
                top_k=payload.top_k,
            )
        except EmbeddingError as exc:
            logger.warning("RAG embedding failed (tenant=%s): %s", tenant_id, exc)
            rag_notice = str(exc)
            rag_sources = []
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("RAG search failed: %s", exc)
            rag_sources = []
            rag_notice = "Dayanaklar yüklenirken hata oluştu."

    sources_summary = _format_sources_for_prompt(rag_sources, rag_notice)
    user_prompt = f"Soru: {payload.message.strip()}\n\nDayanaklar:\n{sparse_newlines(sources_summary)}"
    messages: list[dict[str, str]] = [
        {"role": "system", "content": KYRADI_SYSTEM_PROMPT.strip()},
        {"role": "user", "content": user_prompt},
    ]

    start = time.perf_counter()
    try:
        provider_response = await provider.chat(
            messages,
            stream=payload.stream,
        )
    except LLMProviderError as exc:
        latency_ms = (time.perf_counter() - start) * 1000
        log_ai_interaction(
            AIObservation(
                request_id=request_id,
                provider=provider.provider_name,
                model=provider.model,
                latency_ms=latency_ms,
                tokens_in=0,
                tokens_out=0,
                success=False,
                prompt=user_prompt,
                response=None,
                metadata=payload.metadata or {},
                error=str(exc),
            )
        )
        status_code = status.HTTP_504_GATEWAY_TIMEOUT if exc.is_timeout else status.HTTP_502_BAD_GATEWAY
        detail = str(exc) or (
            "LLM isteği zaman aşımına uğradı" if exc.is_timeout else "LLM sağlayıcısı hata verdi"
        )
        raise HTTPException(
            status_code=status_code,
            detail={"message": detail, "request_id": request_id},
        ) from exc

    latency_ms = (time.perf_counter() - start) * 1000
    answer_text = provider_response.text.strip()
    usage = provider_response.usage

    log_ai_interaction(
        AIObservation(
            request_id=request_id,
            provider=provider.provider_name,
            model=provider.model,
            latency_ms=latency_ms,
            tokens_in=usage.input_tokens,
            tokens_out=usage.output_tokens,
            success=True,
            prompt=user_prompt,
            response=answer_text,
            metadata={**(payload.metadata or {}), "tenant_id": tenant_id},
        )
    )

    logger.info(
        f"Chat response: request_id={request_id}, latency_ms={latency_ms:.2f}, "
        f"tokens_in={usage.input_tokens}, tokens_out={usage.output_tokens}"
    )

    response_sources = [Source(title=src["title"], snippet=src["snippet"]) for src in rag_sources]
    if not response_sources and rag_notice:
        response_sources.append(
            Source(title="Dayanak kullanılamadı", snippet=rag_notice),
        )

    return ChatResponse(
        answer=answer_text,
        sources=response_sources,
        usage=Usage(input_tokens=usage.input_tokens, output_tokens=usage.output_tokens),
        latency_ms=round(latency_ms, 2),
        request_id=request_id,
    )


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _normalize_text(raw: str, mime: str) -> str:
    if mime == "text/html":
        return strip_html(raw)
    return raw.strip()


def _ensure_tenant_access(requested_tenant: str, current_user: User) -> str:
    if not requested_tenant:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant gerekli")
    if current_user.tenant_id and current_user.tenant_id != requested_tenant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant yetkisi yok")
    if not current_user.tenant_id and not requested_tenant:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant belirtilmeli")
    return requested_tenant


def _build_doc_id(tenant_id: str, source: str, content: str, order: int) -> str:
    payload = f"{tenant_id}:{source}:{order}:{content}".encode("utf-8")
    return hashlib.sha1(payload, usedforsecurity=False).hexdigest()


def _format_sources_for_prompt(
    sources: Sequence[dict[str, str]],
    notice: str | None = None,
) -> str:
    if not sources:
        if notice:
            return f"- Dayanak kullanılamadı: {notice}"
        return "- Dayanak bulunamadı."
    lines = []
    for idx, src in enumerate(sources, start=1):
        snippet = (src.get("snippet") or src.get("content") or "").replace("\n", " ").strip()
        lines.append(f"- ({idx}) {src.get('title', 'Doküman')}: {snippet[:320]}")
    return "\n".join(lines)


def sparse_newlines(text: str) -> str:
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())
