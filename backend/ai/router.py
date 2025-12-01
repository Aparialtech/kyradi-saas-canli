"""FastAPI router for Kyradi AI Assistant.

Endpoints:
- GET  /ai/health    - Health check
- POST /ai/assistant - Kyradi asistan (auth yok)
- POST /ai/chat      - RAG destekli chat (auth gerekli)
- POST /ai/ingest    - Doküman yükleme (auth gerekli)
"""

from __future__ import annotations

import hashlib
import logging
import os
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Optional, Sequence

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.dependencies import get_current_active_user
from app.models import User

from .observability import AIObservation, generate_request_id, log_ai_interaction
from .prompts import SYSTEM_PROMPT
from .providers import get_chat_provider, check_ai_available
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

class AssistantRequest(BaseModel):
    """Request for Kyradi AI Assistant."""
    question: str = Field(..., min_length=1, max_length=4000, alias="message", description="User's question")
    tenant_id: Optional[str] = Field(default=None, description="Optional tenant ID")
    locale: str = Field(default="tr-TR", max_length=16)
    
    class Config:
        populate_by_name = True  # Allow both 'question' and 'message'


class AssistantResponse(BaseModel):
    """Response from Kyradi AI Assistant."""
    answer: str
    request_id: str
    model: str
    latency_ms: float
    success: bool = True
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    provider: str
    model: str
    ai_enabled: bool
    timestamp: str
    message: Optional[str] = None


class ChatRequest(BaseModel):
    """Full chat request with RAG support."""
    tenant_id: str
    user_id: str
    message: str = Field(..., min_length=1)
    locale: str = Field(default="tr-TR", max_length=16)
    use_rag: bool = True
    top_k: int = Field(default=6, ge=1, le=12)
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


class IngestRequest(BaseModel):
    tenant_id: str = Field(..., description="Tenant scope")
    title: str | None = Field(default=None, max_length=255)
    text: str = Field(..., min_length=1)
    url: str | None = Field(default=None, max_length=1024)
    mime: str = Field(default="text/plain", pattern=r"^text/(plain|html)$")


class IngestResponse(BaseModel):
    ok: bool
    count: int


# =============================================================================
# HEALTH CHECK ENDPOINT
# =============================================================================

@router.get("/health", response_model=HealthResponse)
async def ai_health_check() -> HealthResponse:
    """Check AI service health.
    
    Returns:
        Health status with provider info
    """
    is_available, message = check_ai_available()
    
    if not is_available:
        return HealthResponse(
            status="error",
            provider="openai",
            model=settings.ai_model or "gpt-4.1-mini",
            ai_enabled=False,
            timestamp=datetime.now(timezone.utc).isoformat(),
            message=message,
        )
    
    try:
        provider = get_chat_provider()
        return HealthResponse(
            status="ok",
            provider=provider.provider_name,
            model=provider.model,
            ai_enabled=True,
            timestamp=datetime.now(timezone.utc).isoformat(),
            message="AI servisi hazır",
        )
    except Exception as exc:
        logger.error(f"AI health check failed: {exc}")
        return HealthResponse(
            status="error",
            provider="openai",
            model=settings.ai_model or "gpt-4.1-mini",
            ai_enabled=False,
            timestamp=datetime.now(timezone.utc).isoformat(),
            message=str(exc),
        )


# =============================================================================
# ASSISTANT ENDPOINT (NO AUTH REQUIRED)
# =============================================================================

@router.post("/assistant", response_model=AssistantResponse)
async def kyradi_assistant(
    payload: AssistantRequest,
    request: Request,
) -> AssistantResponse:
    """Kyradi AI Assistant endpoint.
    
    This endpoint:
    - Does NOT require authentication
    - Uses comprehensive Kyradi system prompt
    - Only answers Kyradi-related questions
    - Has proper error handling
    
    Args:
        payload: AssistantRequest with question
        request: FastAPI request object
        
    Returns:
        AssistantResponse with answer
    """
    request_id = generate_request_id()
    start_time = time.perf_counter()
    model_name = settings.ai_model or "gpt-4.1-mini"
    
    # Log incoming request
    client_ip = request.client.host if request.client else "unknown"
    logger.info(
        f"Assistant request: request_id={request_id}, "
        f"question_length={len(payload.question)}, "
        f"client={client_ip}"
    )
    
    # Check if API key is configured
    api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("OPENAI_API_KEY not configured")
        return AssistantResponse(
            answer="",
            request_id=request_id,
            model=model_name,
            latency_ms=0,
            success=False,
            error="AI servisi yapılandırılmamış: OPENAI_API_KEY eksik.",
        )
    
    try:
        # Get provider
        provider = get_chat_provider()
        
        # Build messages
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": payload.question.strip()},
        ]
        
        # Call OpenAI
        response = await provider.chat(
            messages,
            max_tokens=1000,
            temperature=0.7,
        )
        
        latency_ms = (time.perf_counter() - start_time) * 1000
        answer = response.text.strip()
        
        # Log successful interaction
        log_ai_interaction(
            AIObservation(
                request_id=request_id,
                provider=provider.provider_name,
                model=provider.model,
                latency_ms=latency_ms,
                tokens_in=response.usage.input_tokens,
                tokens_out=response.usage.output_tokens,
                success=True,
                prompt=payload.question[:200],
                response=answer[:200],
                metadata={"tenant_id": payload.tenant_id, "locale": payload.locale},
            )
        )
        
        logger.info(
            f"Assistant response: request_id={request_id}, "
            f"latency_ms={latency_ms:.2f}, "
            f"tokens_in={response.usage.input_tokens}, "
            f"tokens_out={response.usage.output_tokens}"
        )
        
        return AssistantResponse(
            answer=answer,
            request_id=request_id,
            model=provider.model,
            latency_ms=round(latency_ms, 2),
            success=True,
        )
        
    except LLMProviderError as exc:
        latency_ms = (time.perf_counter() - start_time) * 1000
        logger.error(f"LLM provider error: request_id={request_id}, error={exc}")
        
        # Map error to user-friendly message
        error_msg = str(exc)
        if exc.status_code == 401:
            error_msg = "AI servisi yapılandırılmamış: OPENAI_API_KEY eksik veya hatalı."
        elif exc.status_code == 429:
            error_msg = "OpenAI kullanım limiti doldu. Birkaç saniye sonra tekrar deneyin."
        elif exc.is_timeout:
            error_msg = "AI isteği zaman aşımına uğradı. Lütfen tekrar deneyin."
        
        return AssistantResponse(
            answer="",
            request_id=request_id,
            model=model_name,
            latency_ms=round(latency_ms, 2),
            success=False,
            error=error_msg,
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
            model=model_name,
            latency_ms=round(latency_ms, 2),
            success=False,
            error=f"AI servisi şu anda kullanılamıyor: {str(exc)}",
        )


# =============================================================================
# CHAT ENDPOINT (AUTH REQUIRED, RAG SUPPORT)
# =============================================================================

@router.post("/chat", response_model=ChatResponse)
async def chat_completion(
    payload: ChatRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
) -> ChatResponse:
    """Chat endpoint with RAG support.
    
    Requires authentication.
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

    # Check API key
    api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI servisi yapılandırılmamış: OPENAI_API_KEY eksik.",
        )

    try:
        provider = get_chat_provider()
    except Exception as exc:
        logger.error(f"Failed to get AI provider: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    # RAG search
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
        except Exception as exc:
            logger.exception("RAG search failed: %s", exc)
            rag_notice = "Dayanaklar yüklenirken hata oluştu."

    # Build prompt
    sources_summary = _format_sources_for_prompt(rag_sources, rag_notice)
    user_prompt = f"Soru: {payload.message.strip()}\n\nDayanaklar:\n{sources_summary}"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    start = time.perf_counter()
    try:
        provider_response = await provider.chat(messages, max_tokens=1000)
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
                prompt=user_prompt[:200],
                response=None,
                metadata=payload.metadata or {},
                error=str(exc),
            )
        )
        
        if exc.status_code == 401:
            detail = "AI servisi yapılandırılmamış: OPENAI_API_KEY eksik veya hatalı."
        elif exc.status_code == 429:
            detail = "OpenAI kullanım limiti doldu. Birkaç saniye sonra tekrar deneyin."
        elif exc.is_timeout:
            detail = "AI isteği zaman aşımına uğradı."
        else:
            detail = str(exc)
        
        raise HTTPException(
            status_code=exc.status_code or 500,
            detail=detail,
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
            prompt=user_prompt[:200],
            response=answer_text[:200],
            metadata={**(payload.metadata or {}), "tenant_id": tenant_id},
        )
    )

    logger.info(
        f"Chat response: request_id={request_id}, latency_ms={latency_ms:.2f}, "
        f"tokens_in={usage.input_tokens}, tokens_out={usage.output_tokens}"
    )

    response_sources = [Source(title=src["title"], snippet=src["snippet"]) for src in rag_sources]
    if not response_sources and rag_notice:
        response_sources.append(Source(title="Dayanak kullanılamadı", snippet=rag_notice))

    return ChatResponse(
        answer=answer_text,
        sources=response_sources,
        usage=Usage(input_tokens=usage.input_tokens, output_tokens=usage.output_tokens),
        latency_ms=round(latency_ms, 2),
        request_id=request_id,
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
    """Ingest tenant documents and store embeddings."""
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
