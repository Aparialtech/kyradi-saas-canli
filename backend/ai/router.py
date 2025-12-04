"""Kyradi AI Router - Safe endpoints that never crash the backend.

All endpoints handle AI unavailability gracefully by returning
appropriate HTTP responses instead of crashing.

Endpoints:
- GET  /ai/health  - Always works, returns AI status
- POST /ai/chat    - Returns 503 if AI unavailable
- POST /ai/assistant - Returns error JSON if AI unavailable
"""

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("kyradi.ai")

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


# =============================================================================
# SAFE PROVIDER IMPORT
# =============================================================================

# Import providers safely - NEVER crash
try:
    from .providers import get_chat_provider, check_ai_available, get_ai_status
except ImportError as e:
    logger.error(f"Failed to import AI providers: {e}")
    
    # Fallback functions
    def get_chat_provider():
        return None
    
    def check_ai_available():
        return False
    
    def get_ai_status():
        return {"available": False, "error": "Provider module not available"}


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class ChatRequest(BaseModel):
    """Chat request model."""
    prompt: Optional[str] = Field(default=None, max_length=4000)
    message: Optional[str] = Field(default=None, max_length=4000)  # Alias for prompt
    question: Optional[str] = Field(default=None, max_length=4000)  # Another alias
    tenant_id: Optional[str] = Field(default=None)  # For context
    locale: Optional[str] = Field(default="tr-TR")
    
    @property
    def text(self) -> str:
        """Get the actual text from any of the fields."""
        return self.prompt or self.message or self.question or ""


class ChatResponse(BaseModel):
    """Chat response model."""
    answer: str
    success: bool = True
    error: Optional[str] = None
    model: Optional[str] = None
    request_id: Optional[str] = None
    latency_ms: Optional[float] = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    available: bool
    provider: str
    model: str
    timestamp: str
    error: Optional[str] = None


# =============================================================================
# HEALTH ENDPOINT - Always works
# =============================================================================

@router.get("/health", response_model=HealthResponse)
async def ai_health() -> HealthResponse:
    """Check AI service health.
    
    This endpoint ALWAYS works, even if AI is not available.
    Returns the current status of the AI service.
    """
    try:
        status_info = get_ai_status()
        return HealthResponse(
            status="ok" if status_info.get("available") else "unavailable",
            available=status_info.get("available", False),
            provider=status_info.get("provider", "none"),
            model=status_info.get("model", "none"),
            timestamp=datetime.now(timezone.utc).isoformat(),
            error=status_info.get("error"),
        )
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return HealthResponse(
            status="error",
            available=False,
            provider="none",
            model="none",
            timestamp=datetime.now(timezone.utc).isoformat(),
            error=str(e),
        )


# =============================================================================
# CHAT ENDPOINT
# =============================================================================

@router.post("/chat", response_model=ChatResponse)
async def ai_chat(payload: ChatRequest) -> ChatResponse:
    """AI Chat endpoint.
    
    Returns 503 if AI is not available.
    """
    start_time = time.perf_counter()
    request_id = f"req_{int(time.time() * 1000)}"
    
    # Get prompt from any of the fields
    prompt = payload.text
    
    if not prompt.strip():
        raise HTTPException(
            status_code=400,
            detail="Prompt is required"
        )
    
    # Check AI availability
    if not check_ai_available():
        logger.warning("AI chat request received but AI is unavailable")
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable: AI provider not configured"
        )
    
    try:
        provider = get_chat_provider()
        if provider is None:
            raise HTTPException(
                status_code=503,
                detail="AI service unavailable: provider not initialized"
            )
        
        result = await provider.chat(prompt)
        latency_ms = (time.perf_counter() - start_time) * 1000
        
        if not result.get("success", False):
            logger.warning(f"AI chat failed: {result.get('error')}")
            raise HTTPException(
                status_code=503,
                detail=result.get("error", "AI request failed")
            )
        
        return ChatResponse(
            answer=result.get("answer", ""),
            success=True,
            model=result.get("model"),
            request_id=request_id,
            latency_ms=round(latency_ms, 2),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"AI chat error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"AI service error: {str(e)}"
        )


# =============================================================================
# ASSISTANT ENDPOINT (Alternative, returns JSON instead of 503)
# =============================================================================

@router.post("/assistant", response_model=ChatResponse)
async def ai_assistant(payload: ChatRequest) -> ChatResponse:
    """AI Assistant endpoint.
    
    Unlike /chat, this endpoint returns error in JSON body instead of HTTP 503.
    This is useful for frontends that prefer to handle errors in response body.
    
    When AI is not available, uses Dummy provider that returns helpful messages.
    """
    start_time = time.perf_counter()
    request_id = f"req_{int(time.time() * 1000)}"
    
    # Get prompt from any of the fields
    prompt = payload.text
    
    if not prompt.strip():
        return ChatResponse(
            answer="",
            success=False,
            error="Mesaj boş olamaz",
            request_id=request_id,
        )
    
    try:
        provider = get_chat_provider()
        if provider is None:
            return ChatResponse(
                answer="",
                success=False,
                error="AI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
                request_id=request_id,
            )
        
        result = await provider.chat(prompt)
        latency_ms = (time.perf_counter() - start_time) * 1000
        
        return ChatResponse(
            answer=result.get("answer", ""),
            success=result.get("success", False),
            error=result.get("error"),
            model=result.get("model"),
            request_id=request_id,
            latency_ms=round(latency_ms, 2),
        )
        
    except Exception as e:
        logger.exception(f"AI assistant error: {e}")
        latency_ms = (time.perf_counter() - start_time) * 1000
        return ChatResponse(
            answer="",
            success=False,
            error=f"Bir hata oluştu: {str(e)}",
            request_id=request_id,
            latency_ms=round(latency_ms, 2),
        )
