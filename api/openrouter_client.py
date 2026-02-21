"""OpenRouter ModelClient integration."""

from typing import Dict, Sequence, Optional, Any, List
import logging
import json
import aiohttp
import requests
from requests.exceptions import RequestException, Timeout

from adalflow.core.model_client import ModelClient
from adalflow.core.types import (
    CompletionUsage,
    ModelType,
    GeneratorOutput,
)

log = logging.getLogger(__name__)

class OpenRouterClient(ModelClient):
    __doc__ = r"""A component wrapper for the OpenRouter API client.

    OpenRouter provides a unified API that gives access to hundreds of AI models through a single endpoint.
    The API is compatible with OpenAI's API format with a few small differences.

    Visit https://openrouter.ai/docs for more details.

    Example:
        ```python
        from api.openrouter_client import OpenRouterClient

        client = OpenRouterClient()
        generator = adal.Generator(
            model_client=client,
            model_kwargs={"model": "openai/gpt-4o"}
        )
        ```
    """

    def __init__(self, *args, **kwargs) -> None:
        """Initialize the OpenRouter client."""
        super().__init__(*args, **kwargs)
        self.sync_client = self.init_sync_client()
        self.async_client = None  # Initialize async client only when needed

    def init_sync_client(self):
        """Initialize the synchronous OpenRouter client."""
        from api.config import OPENROUTER_API_KEY
        api_key = OPENROUTER_API_KEY
        if not api_key:
            log.warning("OPENROUTER_API_KEY not configured")

        # OpenRouter doesn't have a dedicated client library, so we'll use requests directly
        return {
            "api_key": api_key,
            "base_url": "https://openrouter.ai/api/v1"
        }

    def init_async_client(self):
        """Initialize the asynchronous OpenRouter client."""
        from api.config import OPENROUTER_API_KEY
        api_key = OPENROUTER_API_KEY
        if not api_key:
            log.warning("OPENROUTER_API_KEY not configured")

        # For async, we'll use aiohttp
        return {
            "api_key": api_key,
            "base_url": "https://openrouter.ai/api/v1"
        }

    def convert_inputs_to_api_kwargs(
        self, input: Any, model_kwargs: Dict = None, model_type: ModelType = None
    ) -> Dict:
        """Convert AdalFlow inputs to OpenRouter API format."""
        model_kwargs = model_kwargs or {}

        if model_type == ModelType.LLM:
            # Handle LLM generation
            messages = []

            # Convert input to messages format if it's a string
            if isinstance(input, str):
                messages = [{"role": "user", "content": input}]
            elif isinstance(input, list) and all(isinstance(msg, dict) for msg in input):
                messages = input
            else:
                raise ValueError(f"Unsupported input format for OpenRouter: {type(input)}")

            # For debugging
            log.info(f"Messages for OpenRouter: {messages}")

            api_kwargs = {
                "messages": messages,
                **model_kwargs
            }

            # Ensure model is specified
            if "model" not in api_kwargs:
                api_kwargs["model"] = "openai/gpt-3.5-turbo"

            return api_kwargs

        elif model_type == ModelType.EMBEDDING:
            # OpenRouter doesn't support embeddings directly
            # We could potentially use a specific model through OpenRouter for embeddings
            # but for now, we'll raise an error
            raise NotImplementedError("OpenRouter client does not support embeddings yet")

        else:
            raise ValueError(f"Unsupported model type: {model_type}")

    async def acall(self, api_kwargs: Dict = None, model_type: ModelType = None) -> Any:
        """Make an asynchronous call to the OpenRouter API."""
        if not self.async_client:
            self.async_client = self.init_async_client()

        # Check if API key is set
        if not self.async_client.get("api_key"):
            error_msg = "OPENROUTER_API_KEY not configured. Please set this environment variable to use OpenRouter."
            log.error(error_msg)
            # Instead of raising an exception, return a generator that yields the error message
            # This allows the error to be displayed to the user in the streaming response
            async def error_generator():
                yield error_msg
            return error_generator()

        api_kwargs = api_kwargs or {}

        if model_type == ModelType.LLM:
            # Prepare headers
            headers = {
                "Authorization": f"Bearer {self.async_client['api_key']}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/AsyncFuncAI/deepwiki-open",  # Optional
                "X-Title": "DeepWiki"  # Optional
            }

            # Always use non-streaming mode for OpenRouter
            api_kwargs["stream"] = False

            # Make the API call
            try:
                log.info(f"Making async OpenRouter API call to {self.async_client['base_url']}/chat/completions")
                log.info(f"Request headers: {headers}")
                log.info(f"Request body: {api_kwargs}")

                async with aiohttp.ClientSession() as session:
                    try:
                        async with session.post(
                            f"{self.async_client['base_url']}/chat/completions",
                            headers=headers,
                            json=api_kwargs,
                            timeout=60
                        ) as response:
                            if response.status != 200:
                                error_text = await response.text()
                                log.error(f"OpenRouter API error ({response.status}): {error_text}")

                                # Return a generator that yields the error message
                                async def error_response_generator():
                                    yield f"OpenRouter API error ({response.status}): {error_text}"
                                return error_response_generator()

                            # Get the full response
                            data = await response.json()
                            log.info(f"Received response from OpenRouter: {data}")

                            # Create a generator that yields the content
                            async def content_generator():
                                if "choices" in data and len(data["choices"]) > 0:
                                    choice = data["choices"][0]
                                    if "message" in choice and "content" in choice["message"]:
                                        content = choice["message"]["content"]
                                        log.info("Successfully retrieved response")

                                        # Check if content looks like a wiki_structure response
                                        # (XML or JSON). Use the robust parser to normalize
                                        # it and re-emit clean XML for the frontend.
                                        if "<wiki_structure>" in content or (
                                            '"pages"' in content and '"title"' in content
                                        ):
                                            try:
                                                from api.wiki_structure_parser import (
                                                    parse_wiki_structure,
                                                    convert_json_to_xml,
                                                )

                                                structure = parse_wiki_structure(content)
                                                clean_xml = convert_json_to_xml(structure)
                                                log.info(
                                                    f"Parsed and normalized wiki structure: {clean_xml[:100]}..."
                                                )
                                                yield clean_xml
                                            except Exception as parse_error:
                                                log.warning(
                                                    f"Wiki structure parsing failed ({parse_error}), "
                                                    "yielding original content"
                                                )
                                                yield content
                                        else:
                                            # Not a wiki structure response, yield as-is
                                            yield content
                                    else:
                                        log.error(f"Unexpected response format: {data}")
                                        yield "Error: Unexpected response format from OpenRouter API"
                                else:
                                    log.error(f"No choices in response: {data}")
                                    yield "Error: No response content from OpenRouter API"

                            return content_generator()
                    except aiohttp.ClientError as e:
                        e_client = e
                        log.error(f"Connection error with OpenRouter API: {str(e_client)}")

                        # Return a generator that yields the error message
                        async def connection_error_generator():
                            yield f"Connection error with OpenRouter API: {str(e_client)}. Please check your internet connection and that the OpenRouter API is accessible."
                        return connection_error_generator()

            except RequestException as e:
                e_req = e
                log.error(f"Error calling OpenRouter API asynchronously: {str(e_req)}")

                # Return a generator that yields the error message
                async def request_error_generator():
                    yield f"Error calling OpenRouter API: {str(e_req)}"
                return request_error_generator()

            except Exception as e:
                e_unexp = e
                log.error(f"Unexpected error calling OpenRouter API asynchronously: {str(e_unexp)}")

                # Return a generator that yields the error message
                async def unexpected_error_generator():
                    yield f"Unexpected error calling OpenRouter API: {str(e_unexp)}"
                return unexpected_error_generator()

        else:
            error_msg = f"Unsupported model type: {model_type}"
            log.error(error_msg)

            # Return a generator that yields the error message
            async def model_type_error_generator():
                yield error_msg
            return model_type_error_generator()

    def _process_completion_response(self, data: Dict) -> GeneratorOutput:
        """Process a non-streaming completion response from OpenRouter."""
        try:
            # Extract the completion text from the response
            if not data.get("choices"):
                raise ValueError(f"No choices in OpenRouter response: {data}")

            choice = data["choices"][0]

            if "message" in choice:
                content = choice["message"].get("content", "")
            elif "text" in choice:
                content = choice.get("text", "")
            else:
                raise ValueError(f"Unexpected response format from OpenRouter: {choice}")

            # Extract usage information if available
            usage = None
            if "usage" in data:
                usage = CompletionUsage(
                    prompt_tokens=data["usage"].get("prompt_tokens", 0),
                    completion_tokens=data["usage"].get("completion_tokens", 0),
                    total_tokens=data["usage"].get("total_tokens", 0)
                )

            # Create and return the GeneratorOutput
            return GeneratorOutput(
                data=content,
                usage=usage,
                raw_response=data
            )

        except Exception as e_proc:
            log.error(f"Error processing OpenRouter completion response: {str(e_proc)}")
            raise

    def _process_streaming_response(self, response):
        """Process a streaming response from OpenRouter."""
        try:
            log.info("Starting to process streaming response from OpenRouter")
            buffer = ""

            for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
                try:
                    # Add chunk to buffer
                    buffer += chunk

                    # Process complete lines in the buffer
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        line = line.strip()

                        if not line:
                            continue

                        log.debug(f"Processing line: {line}")

                        # Skip SSE comments (lines starting with :)
                        if line.startswith(':'):
                            log.debug(f"Skipping SSE comment: {line}")
                            continue

                        if line.startswith("data: "):
                            data = line[6:]  # Remove "data: " prefix

                            # Check for stream end
                            if data == "[DONE]":
                                log.info("Received [DONE] marker")
                                break

                            try:
                                data_obj = json.loads(data)
                                log.debug(f"Parsed JSON data: {data_obj}")

                                # Extract content from delta
                                if "choices" in data_obj and len(data_obj["choices"]) > 0:
                                    choice = data_obj["choices"][0]

                                    if "delta" in choice and "content" in choice["delta"] and choice["delta"]["content"]:
                                        content = choice["delta"]["content"]
                                        log.debug(f"Yielding delta content: {content}")
                                        yield content
                                    elif "text" in choice:
                                        log.debug(f"Yielding text content: {choice['text']}")
                                        yield choice["text"]
                                    else:
                                        log.debug(f"No content found in choice: {choice}")
                                else:
                                    log.debug(f"No choices found in data: {data_obj}")

                            except json.JSONDecodeError:
                                log.warning(f"Failed to parse SSE data: {data}")
                                continue
                except Exception as e_chunk:
                    log.error(f"Error processing streaming chunk: {str(e_chunk)}")
                    yield f"Error processing response chunk: {str(e_chunk)}"
        except Exception as e_stream:
            log.error(f"Error in streaming response: {str(e_stream)}")
            yield f"Error in streaming response: {str(e_stream)}"

    async def _process_async_streaming_response(self, response):
        """Process an asynchronous streaming response from OpenRouter."""
        buffer = ""
        try:
            log.info("Starting to process async streaming response from OpenRouter")
            async for chunk in response.content:
                try:
                    # Convert bytes to string and add to buffer
                    if isinstance(chunk, bytes):
                        chunk_str = chunk.decode('utf-8')
                    else:
                        chunk_str = str(chunk)

                    buffer += chunk_str

                    # Process complete lines in the buffer
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        line = line.strip()

                        if not line:
                            continue

                        log.debug(f"Processing line: {line}")

                        # Skip SSE comments (lines starting with :)
                        if line.startswith(':'):
                            log.debug(f"Skipping SSE comment: {line}")
                            continue

                        if line.startswith("data: "):
                            data = line[6:]  # Remove "data: " prefix

                            # Check for stream end
                            if data == "[DONE]":
                                log.info("Received [DONE] marker")
                                break

                            try:
                                data_obj = json.loads(data)
                                log.debug(f"Parsed JSON data: {data_obj}")

                                # Extract content from delta
                                if "choices" in data_obj and len(data_obj["choices"]) > 0:
                                    choice = data_obj["choices"][0]

                                    if "delta" in choice and "content" in choice["delta"] and choice["delta"]["content"]:
                                        content = choice["delta"]["content"]
                                        log.debug(f"Yielding delta content: {content}")
                                        yield content
                                    elif "text" in choice:
                                        log.debug(f"Yielding text content: {choice['text']}")
                                        yield choice["text"]
                                    else:
                                        log.debug(f"No content found in choice: {choice}")
                                else:
                                    log.debug(f"No choices found in data: {data_obj}")

                            except json.JSONDecodeError:
                                log.warning(f"Failed to parse SSE data: {data}")
                                continue
                except Exception as e_chunk:
                    log.error(f"Error processing streaming chunk: {str(e_chunk)}")
                    yield f"Error processing response chunk: {str(e_chunk)}"
        except Exception as e_stream:
            log.error(f"Error in async streaming response: {str(e_stream)}")
            yield f"Error in streaming response: {str(e_stream)}"
