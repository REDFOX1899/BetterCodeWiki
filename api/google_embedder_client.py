"""Google AI Embeddings ModelClient integration."""

import os
import logging
import random
import time
from typing import Dict, Any, Optional, List, Sequence

from adalflow.core.model_client import ModelClient
from adalflow.core.types import ModelType, EmbedderOutput

try:
    import google.generativeai as genai
    from google.generativeai.types.text_types import EmbeddingDict, BatchEmbeddingDict
except ImportError:
    raise ImportError("google-generativeai is required. Install it with 'pip install google-generativeai'")

log = logging.getLogger(__name__)


class GoogleEmbedderClient(ModelClient):
    __doc__ = r"""A component wrapper for Google AI Embeddings API client.

    This client provides access to Google's embedding models through the Google AI API.
    It supports text embeddings for various tasks including semantic similarity,
    retrieval, and classification.

    Args:
        api_key (Optional[str]): Google AI API key. Defaults to None.
            If not provided, will use the GOOGLE_API_KEY environment variable.
        env_api_key_name (str): Environment variable name for the API key.
            Defaults to "GOOGLE_API_KEY".

    Example:
        ```python
        from api.google_embedder_client import GoogleEmbedderClient
        import adalflow as adal

        client = GoogleEmbedderClient()
        embedder = adal.Embedder(
            model_client=client,
            model_kwargs={
                "model": "text-embedding-004",
                "task_type": "SEMANTIC_SIMILARITY"
            }
        )
        ```

    References:
        - Google AI Embeddings: https://ai.google.dev/gemini-api/docs/embeddings
        - Available models: text-embedding-004, embedding-001
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        env_api_key_name: str = "GOOGLE_API_KEY",
        inter_batch_delay: float = 0.2,
    ):
        """Initialize Google AI Embeddings client.

        Args:
            api_key: Google AI API key. If not provided, uses environment variable.
            env_api_key_name: Name of environment variable containing API key.
            inter_batch_delay: Seconds to sleep after each successful embedding
                API call to avoid burst-hitting rate limits (default: 0.2s).
                Set to 0 to disable.
        """
        super().__init__()
        self._api_key = api_key
        self._env_api_key_name = env_api_key_name
        self._inter_batch_delay = inter_batch_delay
        self._initialize_client()

    def _initialize_client(self):
        """Initialize the Google AI client with API key."""
        api_key = self._api_key or os.getenv(self._env_api_key_name)
        if not api_key:
            raise ValueError(
                f"Environment variable {self._env_api_key_name} must be set"
            )
        genai.configure(api_key=api_key)

    def parse_embedding_response(self, response) -> EmbedderOutput:
        """Parse Google AI embedding response to EmbedderOutput format.
        
        Args:
            response: Google AI embedding response (EmbeddingDict or BatchEmbeddingDict)
            
        Returns:
            EmbedderOutput with parsed embeddings
        """
        try:
            from adalflow.core.types import Embedding
            
            embedding_data = []

            def _extract_embedding_value(obj):
                if obj is None:
                    return None
                if isinstance(obj, dict):
                    if "embedding" in obj:
                        return obj.get("embedding")
                    if "embeddings" in obj:
                        return obj.get("embeddings")
                if hasattr(obj, "embedding"):
                    return getattr(obj, "embedding")
                if hasattr(obj, "embeddings"):
                    return getattr(obj, "embeddings")
                for method_name in ("model_dump", "to_dict", "dict"):
                    if hasattr(obj, method_name):
                        try:
                            dumped = getattr(obj, method_name)()
                            if isinstance(dumped, dict):
                                if "embedding" in dumped:
                                    return dumped.get("embedding")
                                if "embeddings" in dumped:
                                    return dumped.get("embeddings")
                        except Exception:
                            pass
                return None
            
            embedding_value = _extract_embedding_value(response)
            if embedding_value is None:
                log.warning("Unexpected embedding response type/structure: %s", type(response))
                embedding_data = []
            elif isinstance(embedding_value, list) and len(embedding_value) > 0:
                if isinstance(embedding_value[0], (int, float)):
                    embedding_data = [Embedding(embedding=embedding_value, index=0)]
                elif isinstance(embedding_value[0], list):
                    embedding_data = [
                        Embedding(embedding=emb_list, index=i)
                        for i, emb_list in enumerate(embedding_value)
                        if isinstance(emb_list, list) and len(emb_list) > 0
                    ]
                else:
                    extracted = []
                    for item in embedding_value:
                        item_emb = _extract_embedding_value(item)
                        if isinstance(item_emb, list) and len(item_emb) > 0:
                            extracted.append(item_emb)
                    embedding_data = [
                        Embedding(embedding=emb_list, index=i)
                        for i, emb_list in enumerate(extracted)
                    ]
            else:
                log.warning("Empty or invalid embedding data parsed from response")
                embedding_data = []

            if embedding_data:
                first_dim = len(embedding_data[0].embedding) if embedding_data[0].embedding is not None else 0
                log.info("Parsed %s embedding(s) (dim=%s)", len(embedding_data), first_dim)
            
            return EmbedderOutput(
                data=embedding_data,
                error=None,
                raw_response=response
            )
        except Exception as e:
            log.error(f"Error parsing Google AI embedding response: {e}")
            return EmbedderOutput(
                data=[],
                error=str(e),
                raw_response=response
            )

    def convert_inputs_to_api_kwargs(
        self,
        input: Optional[Any] = None,
        model_kwargs: Dict = {},
        model_type: ModelType = ModelType.UNDEFINED,
    ) -> Dict:
        """Convert inputs to Google AI API format.
        
        Args:
            input: Text input(s) to embed
            model_kwargs: Model parameters including model name and task_type
            model_type: Should be ModelType.EMBEDDER for this client
            
        Returns:
            Dict: API kwargs for Google AI embedding call
        """
        if model_type != ModelType.EMBEDDER:
            raise ValueError(f"GoogleEmbedderClient only supports EMBEDDER model type, got {model_type}")
        
        log.info(f"DEBUG: convert_inputs_to_api_kwargs input len: {len(input) if hasattr(input, '__len__') else 'NA'}, type: {type(input)}")
        
        # Ensure input is a list
        if isinstance(input, str):
            content = [input]
        elif isinstance(input, Sequence):
            content = list(input)
        else:
            raise TypeError("input must be a string or sequence of strings")
        
        final_model_kwargs = model_kwargs.copy()
        
        # Handle single vs batch embedding
        if len(content) == 1:
            final_model_kwargs["content"] = content[0]
        else:
            final_model_kwargs["contents"] = content
            
        # Set default task type if not provided
        if "task_type" not in final_model_kwargs:
            final_model_kwargs["task_type"] = "SEMANTIC_SIMILARITY"
            
        # Set default model if not provided
        if "model" not in final_model_kwargs:
            final_model_kwargs["model"] = "text-embedding-004"
            
        return final_model_kwargs

    # Retry configuration for rate-limit and transient errors
    _MAX_RETRIES = 5
    _BASE_DELAY = 1.0       # seconds
    _MAX_DELAY = 16.0       # seconds (cap for exponential backoff)
    _JITTER_MAX = 1.0       # max random jitter in seconds

    @staticmethod
    def _is_retryable(exc: Exception) -> bool:
        """Return True if the exception indicates a retryable error (429 / 503)."""
        exc_str = str(exc).lower()
        # google.api_core.exceptions.ResourceExhausted (429)
        if "resourceexhausted" in type(exc).__name__.lower():
            return True
        # google.api_core.exceptions.ServiceUnavailable (503)
        if "serviceunavailable" in type(exc).__name__.lower():
            return True
        # Catch by HTTP status code mentions in the message
        if "429" in exc_str or "resource exhausted" in exc_str:
            return True
        if "503" in exc_str or "service unavailable" in exc_str:
            return True
        # google.generativeai may raise a generic exception wrapping these
        if hasattr(exc, "code"):
            code = getattr(exc, "code", None)
            if code in (429, 503):
                return True
        if hasattr(exc, "status_code"):
            status = getattr(exc, "status_code", None)
            if status in (429, 503):
                return True
        return False

    def call(self, api_kwargs: Dict = {}, model_type: ModelType = ModelType.UNDEFINED):
        """Call Google AI embedding API with retry + exponential backoff.

        Retries on 429 (ResourceExhausted) and 503 (ServiceUnavailable) errors
        with exponential backoff: 1s, 2s, 4s, 8s, 16s plus random jitter.

        Args:
            api_kwargs: API parameters
            model_type: Should be ModelType.EMBEDDER

        Returns:
            Google AI embedding response
        """
        if model_type != ModelType.EMBEDDER:
            raise ValueError(f"GoogleEmbedderClient only supports EMBEDDER model type")

        # DEBUG LOGGING (Simplified)
        log.info(f"DEBUG: GoogleEmbedderClient.call received api_kwargs keys: {list(api_kwargs.keys())}")

        safe_log_kwargs = {k: v for k, v in api_kwargs.items() if k not in {"content", "contents"}}
        if "content" in api_kwargs:
            safe_log_kwargs["content_chars"] = len(str(api_kwargs.get("content", "")))
        if "contents" in api_kwargs:
            try:
                contents = api_kwargs.get("contents")
                safe_log_kwargs["contents_count"] = len(contents) if hasattr(contents, "__len__") else None
            except Exception:
                safe_log_kwargs["contents_count"] = None
        log.info("Google AI Embeddings call kwargs (sanitized): %s", safe_log_kwargs)

        last_exception: Optional[Exception] = None

        for attempt in range(self._MAX_RETRIES + 1):
            try:
                # CRITICAL FIX: Do not modify api_kwargs in place as it breaks retries!
                call_kwargs = api_kwargs.copy()

                if "content" in call_kwargs:
                    # Single embedding
                    response = genai.embed_content(**call_kwargs)
                elif "contents" in call_kwargs:
                    # Batch embedding - Google AI supports batch natively
                    contents = call_kwargs.pop("contents")
                    # pass as 'content' argument which handles both single and batch
                    response = genai.embed_content(content=contents, **call_kwargs)
                else:
                    raise ValueError(
                        f"Either 'content' or 'contents' must be provided. "
                        f"Got kwargs: {list(api_kwargs.keys())}"
                    )

                # Inter-batch cooldown to avoid burst-hitting rate limits
                if self._inter_batch_delay > 0:
                    time.sleep(self._inter_batch_delay)

                return response

            except Exception as e:
                last_exception = e

                if not self._is_retryable(e) or attempt >= self._MAX_RETRIES:
                    log.error(
                        "Google AI Embeddings API call failed (attempt %d/%d, non-retryable or max retries): %s",
                        attempt + 1, self._MAX_RETRIES + 1, e,
                    )
                    raise

                # Exponential backoff with jitter
                delay = min(self._BASE_DELAY * (2 ** attempt), self._MAX_DELAY)
                jitter = random.uniform(0, self._JITTER_MAX)
                sleep_time = delay + jitter

                log.warning(
                    "Google AI Embeddings API returned retryable error (attempt %d/%d): %s. "
                    "Retrying in %.1fs ...",
                    attempt + 1, self._MAX_RETRIES + 1, e, sleep_time,
                )
                time.sleep(sleep_time)

        # Should not be reached, but just in case
        if last_exception:
            raise last_exception

    async def acall(self, api_kwargs: Dict = {}, model_type: ModelType = ModelType.UNDEFINED):
        """Async call to Google AI embedding API.
        
        Note: Google AI Python client doesn't have async support yet,
        so this falls back to synchronous call.
        """
        # Google AI client doesn't have async support yet
        return self.call(api_kwargs, model_type)