"""Custom exception classes and global exception handler."""

import logging
from typing import Any

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

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
    """Global exception handler for FastAPI."""
    # Log the exception
    logger.error(
        f"Unhandled exception: {type(exc).__name__}",
        exc_info=exc,
        extra={
            "path": request.url.path,
            "method": request.method,
            "client": request.client.host if request.client else None,
        },
    )
    
    # Handle custom exceptions
    if isinstance(exc, KyradiException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.message,
                "errors": exc.detail,
            },
        )
    
    # Handle FastAPI/Starlette exceptions
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
    
    if isinstance(exc, RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Geçersiz istek verisi",
                "errors": exc.errors(),
            },
        )
    
    # Handle unexpected exceptions
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
        },
    )

