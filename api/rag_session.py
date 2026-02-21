"""RAG Session Manager --- caches RAG instances for reuse across page generations."""

import time
import threading
import logging
from typing import Optional, Dict, Tuple, Any

logger = logging.getLogger(__name__)


class RAGSessionManager:
    """Caches RAG instances keyed by repo URL to avoid rebuilding FAISS index per page."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._sessions: Dict[str, Tuple[Any, float]] = {}
                    cls._instance._ttl = 3600  # 1 hour TTL
                    cls._instance._max_sessions = 10
        return cls._instance

    def get_session_key(self, repo_url: str, embedder_type: str = "default") -> str:
        """Generate a cache key for a RAG session."""
        return f"{repo_url}:{embedder_type}"

    def get(self, key: str):
        """Get a cached RAG instance if it exists and hasn't expired."""
        with self._lock:
            if key in self._sessions:
                rag, last_access = self._sessions[key]
                if time.time() - last_access < self._ttl:
                    self._sessions[key] = (rag, time.time())
                    logger.info(f"RAG session cache hit for {key}")
                    return rag
                else:
                    # Expired
                    del self._sessions[key]
                    logger.info(f"RAG session expired for {key}")
        return None

    def put(self, key: str, rag_instance):
        """Cache a RAG instance."""
        with self._lock:
            # Evict oldest if at capacity
            if len(self._sessions) >= self._max_sessions and key not in self._sessions:
                oldest_key = min(self._sessions, key=lambda k: self._sessions[k][1])
                del self._sessions[oldest_key]
                logger.info(f"Evicted oldest RAG session: {oldest_key}")

            self._sessions[key] = (rag_instance, time.time())
            logger.info(f"Cached RAG session for {key}")

    def invalidate(self, key: str):
        """Remove a cached session."""
        with self._lock:
            self._sessions.pop(key, None)

    def clear(self):
        """Clear all cached sessions."""
        with self._lock:
            self._sessions.clear()


# Module-level singleton
rag_session_manager = RAGSessionManager()
