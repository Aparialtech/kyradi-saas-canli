"""AI Error Schemas - Typed error responses for AI endpoints."""

from typing import Optional
from pydantic import BaseModel


class AIErrorResponse(BaseModel):
    """Structured error response for AI endpoints."""
    code: str
    message: str
    retry_after_seconds: Optional[int] = None


class AIProviderError(Exception):
    """Custom exception for AI provider errors with structured error codes."""
    
    def __init__(self, code: str, message: str, retry_after_seconds: Optional[int] = None):
        self.code = code
        self.message = message
        self.retry_after_seconds = retry_after_seconds
        super().__init__(message)
    
    def to_response(self) -> AIErrorResponse:
        """Convert to AIErrorResponse schema."""
        return AIErrorResponse(
            code=self.code,
            message=self.message,
            retry_after_seconds=self.retry_after_seconds,
        )

