"""Dummy AI Provider - Used when OpenAI is not available.

This provider returns safe fallback responses when:
- OpenAI library is not installed
- OPENAI_API_KEY is not configured
- Any other AI initialization error occurs
"""

from typing import Any, Dict


class DummyAIProvider:
    """Fallback AI provider that returns safe offline responses."""
    
    provider_name = "dummy"
    model = "none"
    enabled = False
    
    async def chat(self, prompt: str) -> Dict[str, Any]:
        """Return a fallback response indicating AI is unavailable.
        
        Args:
            prompt: The user's prompt (ignored)
            
        Returns:
            Dict with answer indicating AI is offline
        """
        return {
            "answer": "AI service unavailable",
            "success": False,
            "error": "AI service is not configured or unavailable",
        }
    
    def is_available(self) -> bool:
        """Check if this provider is available."""
        return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of this provider."""
        return {
            "available": False,
            "provider": "dummy",
            "model": "none",
            "reason": "AI service not configured",
        }

