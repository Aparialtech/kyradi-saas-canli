"""Ollama Local AI Provider - Fallback when OpenAI is not available.

This provider connects to a local Ollama instance for AI capabilities
when cloud providers are not configured or unavailable.
"""

import os
import logging
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger("kyradi.ai.ollama")

# Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "60"))


class OllamaAIProvider:
    """Ollama local AI provider for offline/fallback usage."""
    
    provider_name = "ollama"
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        """Initialize Ollama provider.
        
        Args:
            base_url: Ollama server URL (default: http://localhost:11434)
            model: Model to use (default: llama3.2)
            timeout: Request timeout in seconds (default: 60)
        """
        self.base_url = (base_url or OLLAMA_BASE_URL).rstrip("/")
        self.model = model or OLLAMA_MODEL
        self.timeout = timeout or OLLAMA_TIMEOUT
        self.enabled = False
        self._error: Optional[str] = None
        self._client = httpx.AsyncClient(timeout=self.timeout)
        
        # Will be checked on first use
        self._availability_checked = False
    
    async def _check_availability(self) -> bool:
        """Check if Ollama server is available."""
        if self._availability_checked:
            return self.enabled
        
        try:
            response = await self._client.get(f"{self.base_url}/api/tags")
            if response.status_code == 200:
                self.enabled = True
                logger.info(f"Ollama provider enabled: {self.base_url}, model={self.model}")
            else:
                self._error = f"Ollama server returned status {response.status_code}"
                logger.warning(self._error)
        except httpx.ConnectError:
            self._error = f"Ollama server not reachable at {self.base_url}"
            logger.info(self._error)
        except Exception as e:
            self._error = f"Ollama check failed: {e}"
            logger.warning(self._error)
        
        self._availability_checked = True
        return self.enabled
    
    def is_available(self) -> bool:
        """Check if this provider is available."""
        return self.enabled
    
    def get_status(self) -> Dict[str, Any]:
        """Get detailed status of this provider."""
        return {
            "available": self.enabled,
            "provider": "ollama",
            "model": self.model,
            "base_url": self.base_url,
            "error": self._error,
        }
    
    async def chat(self, prompt: str, context: Optional[str] = None) -> Dict[str, Any]:
        """Send chat request to Ollama.
        
        Args:
            prompt: User's prompt
            context: Optional context to include
            
        Returns:
            Dict with answer or error
        """
        # Check availability on first use
        if not self._availability_checked:
            await self._check_availability()
        
        if not self.enabled:
            return {
                "answer": "",
                "success": False,
                "error": self._error or "Ollama not available",
            }
        
        try:
            # Build the full prompt with context
            full_prompt = prompt
            if context:
                full_prompt = f"Bağlam:\n{context}\n\nSoru:\n{prompt}"
            
            payload = {
                "model": self.model,
                "prompt": full_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "num_predict": 1000,
                }
            }
            
            response = await self._client.post(
                f"{self.base_url}/api/generate",
                json=payload,
            )
            
            if response.status_code != 200:
                return {
                    "answer": "",
                    "success": False,
                    "error": f"Ollama error: {response.status_code}",
                }
            
            data = response.json()
            answer = data.get("response", "").strip()
            
            return {
                "answer": answer,
                "success": True,
                "model": self.model,
                "provider": "ollama",
            }
            
        except httpx.TimeoutException:
            logger.warning("Ollama request timed out")
            return {
                "answer": "",
                "success": False,
                "error": "Request timed out",
            }
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            return {
                "answer": "",
                "success": False,
                "error": f"Ollama error: {str(e)}",
            }
    
    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()

