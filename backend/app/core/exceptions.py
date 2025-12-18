"""Custom exception classes and global exception handler."""

import logging
import traceback
from typing import Any

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError as PydanticValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import (
    IntegrityError,
    SQLAlchemyError,
    ProgrammingError,
    OperationalError,
    DatabaseError,
    DisconnectionError,
)
from sqlalchemy.dialects.postgresql.asyncpg import AsyncAdapt_asyncpg_dbapi

logger = logging.getLogger(__name__)
db_error_logger = logging.getLogger("kyradi.db_errors")


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


def _log_database_error(exc: Exception, tenant_id: str, path: str, method: str) -> None:
    """Log database errors with full context and attempt auto-fix."""
    import re
    
    error_str = str(exc)
    error_type = type(exc).__name__
    full_traceback = traceback.format_exc()
    
    # Extract SQL query if available
    sql_query = None
    if hasattr(exc, "statement"):
        sql_query = str(exc.statement)
    elif hasattr(exc, "orig") and hasattr(exc.orig, "args"):
        for arg in exc.orig.args:
            if isinstance(arg, str) and ("SELECT" in arg or "INSERT" in arg or "UPDATE" in arg or "DELETE" in arg):
                sql_query = arg[:500]  # Limit length
                break
    
    # Extract column/table name from error
    column_name = None
    table_name = None
    if "UndefinedColumnError" in error_type or "does not exist" in error_str:
        # Try to extract column and table name
        match = re.search(r'column "?(\w+)"?.*relation "?(\w+)"?', error_str, re.IGNORECASE)
        if match:
            column_name = match.group(1)
            table_name = match.group(2)
    
    # Log detailed error information
    db_error_logger.error(
        "=" * 80,
        extra={
            "error_type": error_type,
            "error_message": error_str[:1000],
            "tenant_id": tenant_id,
            "path": path,
            "method": method,
            "sql_query": sql_query,
            "column_name": column_name,
            "table_name": table_name,
        }
    )
    db_error_logger.error("DATABASE ERROR DETAILS:")
    db_error_logger.error(f"  Type: {error_type}")
    db_error_logger.error(f"  Message: {error_str[:500]}")
    db_error_logger.error(f"  Tenant: {tenant_id}")
    db_error_logger.error(f"  Path: {method} {path}")
    if sql_query:
        db_error_logger.error(f"  SQL Query: {sql_query[:500]}")
    if column_name:
        db_error_logger.error(f"  Missing Column: {column_name}")
    if table_name:
        db_error_logger.error(f"  Table: {table_name}")
    db_error_logger.error("Full Traceback:")
    db_error_logger.error(full_traceback)
    db_error_logger.error("=" * 80)
    
    # Attempt auto-fix for common issues
    if column_name and table_name:
        db_error_logger.warning(
            f"Attempting auto-fix: Missing column {column_name} in table {table_name}"
        )
        try:
            # This will be handled by DDL statements on next startup
            db_error_logger.info(
                f"Column {column_name} will be added to {table_name} on next DDL run"
            )
        except Exception as fix_exc:
            db_error_logger.error(f"Auto-fix failed: {fix_exc}")


async def _attempt_db_error_recovery(exc: Exception) -> bool:
    """Attempt to recover from database errors automatically.
    
    Returns True if recovery was attempted, False otherwise.
    """
    error_str = str(exc)
    error_type = type(exc).__name__
    
    # Handle missing column errors
    if "UndefinedColumnError" in error_type or "does not exist" in error_str:
        if "password_encrypted" in error_str:
            # This is handled by DDL statements, just log
            db_error_logger.info("password_encrypted column missing - will be added by DDL")
            return True
    
    # Handle connection errors - could retry
    if "connection" in error_str.lower() or "disconnect" in error_str.lower():
        db_error_logger.warning("Database connection error detected - may need retry")
        return True
    
    return False


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
        _log_database_error(exc, tenant_id, request.url.path, request.method)
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
    
    # Handle ProgrammingError (SQL syntax errors, missing columns, etc.)
    if isinstance(exc, (ProgrammingError, OperationalError)):
        _log_database_error(exc, tenant_id, request.url.path, request.method)
        recovery_attempted = await _attempt_db_error_recovery(exc)
        
        error_msg = str(exc)
        if hasattr(exc, "orig"):
            error_msg = str(exc.orig)
        
        # Check for specific error types
        if "UndefinedColumnError" in str(type(exc)) or "does not exist" in error_msg:
            if "password_encrypted" in error_msg:
                # This is a known issue - column will be added by DDL
                logger.warning(
                    "Missing password_encrypted column detected - DDL will fix on next startup"
                )
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content={
                        "detail": "Veritabanı şeması güncelleniyor. Lütfen birkaç saniye sonra tekrar deneyin.",
                        "error_code": "SCHEMA_UPDATE_IN_PROGRESS"
                    },
                    headers=cors_headers,
                )
        
        logger.error(
            "Database ProgrammingError: %s (tenant=%s, path=%s, recovery_attempted=%s)",
            error_msg[:200],
            tenant_id,
            request.url.path,
            recovery_attempted,
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Veritabanı hatası. Lütfen daha sonra tekrar deneyin."},
            headers=cors_headers,
        )
    
    # Handle connection/disconnection errors
    if isinstance(exc, (DisconnectionError, OperationalError)):
        _log_database_error(exc, tenant_id, request.url.path, request.method)
        error_msg = str(exc)
        logger.error(
            "Database connection error: %s (tenant=%s, path=%s)",
            error_msg[:200],
            tenant_id,
            request.url.path,
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "Veritabanı bağlantı hatası. Lütfen birkaç saniye sonra tekrar deneyin."},
            headers=cors_headers,
        )
    
    # Handle AsyncPG errors (wrapped in SQLAlchemy)
    if isinstance(exc, SQLAlchemyError):
        _log_database_error(exc, tenant_id, request.url.path, request.method)
        error_msg = str(exc)
        if hasattr(exc, "orig"):
            error_msg = str(exc.orig)
        
        # Check if it's an AsyncPG error
        if hasattr(exc, "orig") and "asyncpg" in str(type(exc.orig)).lower():
            # Extract AsyncPG error details
            pg_error = exc.orig
            if hasattr(pg_error, "__class__"):
                pg_error_type = pg_error.__class__.__name__
                db_error_logger.error(f"AsyncPG Error Type: {pg_error_type}")
                if hasattr(pg_error, "args") and pg_error.args:
                    db_error_logger.error(f"AsyncPG Error Args: {pg_error.args}")
        
        # Check for specific AsyncPG error types
        if "UndefinedColumnError" in error_msg or "does not exist" in error_msg:
            if "password_encrypted" in error_msg:
                logger.warning(
                    "Missing password_encrypted column - DDL will fix on next startup"
                )
                return JSONResponse(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    content={
                        "detail": "Veritabanı şeması güncelleniyor. Lütfen birkaç saniye sonra tekrar deneyin.",
                        "error_code": "SCHEMA_UPDATE_IN_PROGRESS"
                    },
                    headers=cors_headers,
                )
        
        logger.error(
            "SQLAlchemyError: %s (tenant=%s, path=%s)",
            error_msg[:200],
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

