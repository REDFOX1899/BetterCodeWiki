"""Context Budget Manager --- manages token allocation for LLM context assembly."""

import logging
from typing import List, Dict, Optional, Any, Callable

logger = logging.getLogger(__name__)

# Known context window sizes by provider and model
CONTEXT_WINDOWS = {
    "google": {
        "gemini-2.5-flash": 1_048_576,
        "gemini-2.5-flash-lite": 1_048_576,
        "gemini-2.5-pro": 1_048_576,
        "gemini-2.0-flash": 1_048_576,
        "gemini-1.5-pro": 2_097_152,
        "gemini-1.5-flash": 1_048_576,
    },
    "openai": {
        "gpt-4o": 128_000,
        "gpt-4o-mini": 128_000,
        "gpt-4.1": 1_000_000,
        "gpt-4.1-mini": 1_000_000,
        "o3-mini": 200_000,
    },
    "openrouter": {},  # varies by model
    "ollama": {},  # varies by model, default 32K
    "bedrock": {},
    "azure": {},
    "dashscope": {},
}

DEFAULT_CONTEXT_WINDOW = 128_000
DEFAULT_OUTPUT_RESERVE = 8_192


class ContextBudgetManager:
    """Manages token budget for LLM context assembly."""

    def get_context_window(self, provider: str, model: str) -> int:
        """Get the context window size for a provider/model combo."""
        provider_windows = CONTEXT_WINDOWS.get(provider, {})
        # Try exact match first
        if model in provider_windows:
            return provider_windows[model]
        # Try prefix match (e.g., "gemini-2.5-flash-preview" matches "gemini-2.5-flash")
        for known_model, window in provider_windows.items():
            if model.startswith(known_model):
                return window
        return DEFAULT_CONTEXT_WINDOW

    def get_context_budget(self, provider: str, model: str,
                           prompt_tokens: int,
                           output_reserve: int = DEFAULT_OUTPUT_RESERVE) -> int:
        """Calculate available tokens for RAG context."""
        window = self.get_context_window(provider, model)
        budget = window - prompt_tokens - output_reserve
        logger.info(f"Context budget: window={window}, prompt={prompt_tokens}, "
                    f"reserve={output_reserve}, available={budget}")
        return max(budget, 0)

    def get_dynamic_top_k(self, provider: str, model: str,
                          avg_chunk_tokens: int = 600) -> int:
        """Calculate how many chunks to retrieve based on context window."""
        window = self.get_context_window(provider, model)
        # Use at most 30% of context window for retrieved chunks
        chunk_budget = int(window * 0.3)
        top_k = max(20, min(200, chunk_budget // avg_chunk_tokens))
        logger.info(f"Dynamic top_k for {provider}/{model}: {top_k}")
        return top_k

    def assemble_context(self, documents: List[Dict],
                         budget_tokens: int,
                         count_tokens_fn: Callable[[str], int]) -> str:
        """Greedily pack documents into the token budget, highest relevance first.

        Args:
            documents: List of dicts with 'content' and optionally 'score', 'file_path'
            budget_tokens: Maximum tokens for context
            count_tokens_fn: Function that counts tokens in a string

        Returns:
            Assembled context string fitting within budget
        """
        # Sort by relevance score (highest first)
        sorted_docs = sorted(documents, key=lambda d: d.get('score', 0), reverse=True)

        assembled = []
        used_tokens = 0

        for doc in sorted_docs:
            content = doc.get('content', '')
            doc_tokens = count_tokens_fn(content)

            if used_tokens + doc_tokens > budget_tokens:
                # Try to fit a truncated version
                remaining = budget_tokens - used_tokens
                if remaining > 100:  # Only include if meaningful content fits
                    # Rough truncation by ratio
                    ratio = remaining / doc_tokens
                    truncated = content[:int(len(content) * ratio)]
                    assembled.append(truncated + "\n... [truncated]")
                break

            file_path = doc.get('file_path', 'unknown')
            assembled.append(f"--- {file_path} ---\n{content}")
            used_tokens += doc_tokens

        logger.info(f"Assembled context: {len(assembled)} docs, ~{used_tokens} tokens "
                    f"(budget: {budget_tokens})")
        return "\n\n".join(assembled)


# Module-level singleton
context_budget_manager = ContextBudgetManager()
