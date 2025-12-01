"""Kyradi AI Module - Safe bridge to AI functionality.

This module provides a safe way to access AI functionality.
It NEVER crashes on import, even if AI dependencies are missing.

Usage:
    from app.ai import router, is_ai_available
    
    if is_ai_available():
        # AI is working
    else:
        # AI is not available
"""

import logging
import sys
from pathlib import Path
from typing import Optional

logger = logging.getLogger("kyradi.ai")

# Ensure backend root is in path
_ROOT_DIR = Path(__file__).resolve().parents[2]
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))

# Safe import of router - NEVER crash
router = None
_import_error: Optional[str] = None

try:
    from ai.router import router as _router
    router = _router
    logger.info("AI router loaded successfully")
except ImportError as e:
    _import_error = f"Import error: {e}"
    logger.warning(f"AI router import failed: {e}")
except Exception as e:
    _import_error = f"Unexpected error: {e}"
    logger.error(f"AI router load failed: {e}")


def is_ai_available() -> bool:
    """Check if AI module is available.
    
    Returns:
        True if AI router loaded successfully
    """
    return router is not None


def get_import_error() -> Optional[str]:
    """Get import error if any.
    
    Returns:
        Error message or None
    """
    return _import_error


# Re-export provider functions safely
try:
    from ai.providers import check_ai_available, get_chat_provider, get_ai_status
except ImportError:
    def check_ai_available():
        return False
    
    def get_chat_provider():
        return None
    
    def get_ai_status():
        return {"available": False, "error": "Providers not available"}


__all__ = [
    "router",
    "is_ai_available",
    "get_import_error",
    "check_ai_available",
    "get_chat_provider",
    "get_ai_status",
]
