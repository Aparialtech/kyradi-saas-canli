"""Custom exception classes and global exception handler."""

import logging
from typing import Any

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError as PydanticValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

logger = logging.getLogger(__name__)


class KyradiException(Exception):
    """Base exception for Kyradi application."""
    
    def __init__(self, message: str, status_code: int = 500, detail: dict[str, Any] | None = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail or {}
        super().__init__(self.message)


class NotFoundError(KyradiException):
    """Resource not found."""
    
    def __init__(self, resource: str, resource_id: str | None = None):
        message = f"{resource} bulunamadı"
        if resource_id:
            message += f" (ID: {resource_id})"
        super().__init__(message, status_code=404)


class UnauthorizedError(KyradiException):
    """Unauthorized access."""
    
    def __init__(self, message: str = "Yetkisiz erişim"):
        super().__init__(message, status_code=401)


class ForbiddenError(KyradiException):
    """Forbidden access."""
    
    def __init__(self, message: str = "Bu işlem için yetkiniz yok"):
        super().__init__(message, status_code=403)


class ValidationError(KyradiException):
    """Validation error."""
    
    def __init__(self, message: str, errors: dict[str, Any] | None = None):
        super().__init__(message, status_code=400, detail={"errors": errors})


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global exception handler for FastAPI.
    
    IMPORTANT: Always returns JSONResponse with CORS headers to ensure
    frontend can read error messages even when backend errors occur.
    """
    from app.core.config import settings
    
    # Extract tenant_id from headers if available
    tenant_id = request.headers.get("X-Tenant-ID", "unknown")
    
    # Get origin from request headers for CORS
    origin = request.headers.get("origin")
    
    # Build CORS headers
    cors_headers: dict[str, str] = {}
    if origin and origin in settings.cors_origins:
        cors_headers["Access-Control-Allow-Origin"] = origin
        cors_headers["Access-Control-Allow-Credentials"] = "true"
        cors_headers["Access-Control-Allow-Methods"] = "*"
        cors_headers["Access-Control-Allow-Headers"] = "*"
    
    # Handle custom exceptions
    if isinstance(exc, KyradiException):
        logger.warning(
            "KyradiException: %s (tenant=%s, path=%s)",
            exc.message,
            tenant_id,
            request.url.path,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.message,
                "errors": exc.detail,
            },
            headers=cors_headers,
        )
    
    # Handle WidgetTokenError from common.security
    exc_class_name = type(exc).__name__
    if exc_class_name == "WidgetTokenError":
        logger.warning(
            "WidgetTokenError: %s (tenant=%s, path=%s)",
            str(exc),
            tenant_id,
            request.url.path,
        )
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": str(exc)},
            headers=cors_headers,
        )
    
    # Handle FastAPI/Starlette exceptions
    if isinstance(exc, StarletteHTTPException):
        # Only log at warning level for client errors (4xx)
        if exc.status_code >= 500:
            logger.error(
                "HTTPException %d: %s (tenant=%s, path=%s)",
                exc.status_code,
                exc.detail,
                tenant_id,
                request.url.path,
            )
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=cors_headers,
        )
    
    # Handle Pydantic validation errors
    if isinstance(exc, (RequestValidationError, PydanticValidationError)):
        logger.warning(
            "ValidationError: %s (tenant=%s, path=%s)",
            str(exc)[:200],
            tenant_id,
            request.url.path,
        )
        errors = exc.errors() if hasattr(exc, "errors") else []
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Geçersiz istek verisi",
                "errors": errors,
            },
            headers=cors_headers,
        )
    
    # Handle SQLAlchemy IntegrityError (unique constraint violations, etc.)
    if isinstance(exc, IntegrityError):
        error_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
        logger.warning(
            "IntegrityError: %s (tenant=%s, path=%s)",
            error_msg[:200],
            tenant_id,
            request.url.path,
        )
        # Return a user-friendly message
        if "unique" in error_msg.lower() or "duplicate" in error_msg.lower():
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={"detail": "Bu kayıt zaten mevcut."},
                headers=cors_headers,
            )
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Veritabanı kısıtlaması hatası."},
            headers=cors_headers,
        )
    
    # Handle other SQLAlchemy errors
    if isinstance(exc, SQLAlchemyError):
        logger.error(
            "SQLAlchemyError: %s (tenant=%s, path=%s)",
            str(exc)[:200],
            tenant_id,
            request.url.path,
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Veritabanı hatası. Lütfen daha sonra tekrar deneyin."},
            headers=cors_headers,
        )
    
    # Log unexpected exceptions with full traceback (only once)
    logger.error(
        "Unhandled exception: %s: %s (tenant=%s, path=%s, method=%s)",
        type(exc).__name__,
        str(exc)[:500],
        tenant_id,
        request.url.path,
        request.method,
        exc_info=True,
    )
    
    # Handle unexpected exceptions
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
        },
        headers=cors_headers,
    )

