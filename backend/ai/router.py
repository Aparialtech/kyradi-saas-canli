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

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from ai.schemas import AIErrorResponse, AIProviderError

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
    user_id: Optional[str] = Field(default=None)  # User ID for context
    user_role: Optional[str] = Field(default=None)  # User role (tenant_admin, staff, etc.)
    panel_type: Optional[str] = Field(default=None)  # Panel type (partner, admin)
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
    
    Returns structured error responses with error codes for proper frontend handling.
    """
    start_time = time.perf_counter()
    request_id = f"req_{int(time.time() * 1000)}"
    
    # Get prompt from any of the fields
    prompt = payload.text
    
    if not prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt is required"
        )
    
    try:
        provider = get_chat_provider()
        if provider is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=AIErrorResponse(
                    code="AI_DISABLED",
                    message="AI servisi şu anda yapılandırılmamış. Lütfen yöneticinizle iletişime geçin.",
                ).model_dump(),
            )
        
        result = await provider.chat(prompt)
        latency_ms = (time.perf_counter() - start_time) * 1000
        
        if not result.get("success", False):
            logger.warning(f"AI chat failed: {result.get('error')}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=AIErrorResponse(
                    code="AI_ERROR",
                    message=result.get("error", "AI request failed"),
                ).model_dump(),
            )
        
        return ChatResponse(
            answer=result.get("answer", ""),
            success=True,
            model=result.get("model"),
            request_id=request_id,
            latency_ms=round(latency_ms, 2),
        )
        
    except AIProviderError as e:
        # Handle structured AI errors
        error_response = e.to_response()
        
        if e.code == "RATE_LIMIT":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=error_response.model_dump(),
            )
        elif e.code == "AUTH_ERROR":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_response.model_dump(),
            )
        elif e.code == "AI_DISABLED":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=error_response.model_dump(),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_response.model_dump(),
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"AI chat error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=AIErrorResponse(
                code="UNKNOWN",
                message=f"AI service error: {str(e)}",
            ).model_dump(),
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
        
        # Build user context for better responses
        user_context = []
        if payload.panel_type:
            user_context.append(f"Kullanıcı şu anda {payload.panel_type} panelinde.")
        if payload.user_role:
            role_names = {
                "tenant_admin": "Otel Yöneticisi",
                "hotel_manager": "Otel Müdürü",
                "staff": "Personel",
                "accounting": "Muhasebe",
                "storage_operator": "Depo Görevlisi",
                "super_admin": "Süper Admin",
                "support": "Destek",
            }
            role_name = role_names.get(payload.user_role, payload.user_role)
            user_context.append(f"Kullanıcının rolü: {role_name}")
        
        # Add context to prompt if available
        enhanced_prompt = prompt
        if user_context:
            context_text = "\n".join(user_context)
            enhanced_prompt = f"{context_text}\n\nKullanıcı sorusu: {prompt}"
        
        result = await provider.chat(enhanced_prompt)
        latency_ms = (time.perf_counter() - start_time) * 1000
        
        return ChatResponse(
            answer=result.get("answer", ""),
            success=result.get("success", False),
            error=result.get("error"),
            model=result.get("model"),
            request_id=request_id,
            latency_ms=round(latency_ms, 2),
        )
        
    except AIProviderError as e:
        # Return error in response body (not HTTP exception)
        error_response = e.to_response()
        latency_ms = (time.perf_counter() - start_time) * 1000
        logger.warning(f"AI assistant error: {e.code} - {e.message}")
        return ChatResponse(
            answer="",
            success=False,
            error=error_response.message,
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
