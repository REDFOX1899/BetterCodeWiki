"""
Top-level conftest for the tests/ directory.

Mocks unavailable third-party modules so that importing api.api and
api.mcp.server works in environments that don't have every backend
dependency installed (e.g. adalflow, backoff, mcp, boto3, etc.).

These mocks are inserted into sys.modules BEFORE any test module is
collected, so the top-level imports in api/ resolve without error.
"""

import sys
import types
from typing import Optional, Dict, Any
from unittest.mock import MagicMock


class _CatchAllModule(types.ModuleType):
    """
    A module that returns a MagicMock for any attribute access.

    This handles the common pattern:
        from some.deep.module import SomeClass

    Even if SomeClass was never explicitly registered, __getattr__
    will return a MagicMock that works as a class, function, or value.
    """
    def __init__(self, name: str, attrs: Optional[Dict[str, Any]] = None):
        super().__init__(name)
        self.__path__ = []  # Make it look like a package
        self.__package__ = name
        self.__all__ = []
        if attrs:
            for k, v in attrs.items():
                object.__setattr__(self, k, v)

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)
        # Return a MagicMock that also serves as a usable class/function
        mock = MagicMock()
        object.__setattr__(self, name, mock)
        return mock


def _make_module(dotted_name: str, attrs: Optional[Dict[str, Any]] = None) -> _CatchAllModule:
    """
    Create a catch-all mock module and register it plus all its
    parent packages in sys.modules.
    """
    parts = dotted_name.split(".")
    # Ensure all parent packages exist
    for i in range(1, len(parts)):
        parent = ".".join(parts[:i])
        if parent not in sys.modules:
            parent_mod = _CatchAllModule(parent)
            sys.modules[parent] = parent_mod

    if dotted_name not in sys.modules:
        mod = _CatchAllModule(dotted_name, attrs)
        sys.modules[dotted_name] = mod
    else:
        mod = sys.modules[dotted_name]
        if attrs:
            for k, v in attrs.items():
                setattr(mod, k, v)

    # Wire child into parent module's namespace
    if "." in dotted_name:
        parent_name = ".".join(parts[:-1])
        child_name = parts[-1]
        if parent_name in sys.modules:
            setattr(sys.modules[parent_name], child_name, mod)

    return mod


# ──────────────────────────────────────────────────────────────
# List of modules to mock. Each entry is (dotted_name, optional attrs).
# The catch-all __getattr__ handles any attribute not explicitly set.
# ──────────────────────────────────────────────────────────────

# -- adalflow (big dependency tree) --
_ADALFLOW_MODULES = [
    "adalflow",
    "adalflow.core",
    "adalflow.core.model_client",
    "adalflow.core.types",
    "adalflow.core.component",
    "adalflow.core.embedder",
    "adalflow.core.db",
    "adalflow.core.functional",
    "adalflow.utils",
    "adalflow.utils.lazy_import",
    "adalflow.components",
    "adalflow.components.model_client",
    "adalflow.components.model_client.ollama_client",
    "adalflow.components.model_client.utils",
    "adalflow.components.data_process",
    "adalflow.components.retriever",
    "adalflow.components.retriever.faiss_retriever",
]

# -- backoff --
def _passthrough_decorator(*args, **kwargs):
    """A decorator factory that returns the function unchanged."""
    def wrapper(fn):
        return fn
    if args and callable(args[0]):
        return args[0]
    return wrapper

# -- mcp --
def _tool_decorator(*args, **kwargs):
    """No-op @mcp.tool() decorator that preserves the original function."""
    def decorator(fn):
        return fn
    if args and callable(args[0]):
        return args[0]
    return decorator

def _resource_decorator(*args, **kwargs):
    """No-op @mcp.resource() decorator that preserves the original function."""
    def decorator(fn):
        return fn
    if args and callable(args[0]):
        return args[0]
    return decorator

_mock_fastmcp_cls = MagicMock()
_mock_fastmcp_instance = MagicMock()
_mock_fastmcp_instance.tool = _tool_decorator
_mock_fastmcp_instance.resource = _resource_decorator
_mock_fastmcp_instance.run = MagicMock()
_mock_fastmcp_instance.settings = MagicMock()
_mock_fastmcp_cls.return_value = _mock_fastmcp_instance

# ──────────────────────────────────────────────────────────────
# Register all mocked modules
# ──────────────────────────────────────────────────────────────

for mod_name in _ADALFLOW_MODULES:
    _make_module(mod_name)

# Set specific well-known attributes on adalflow root.
# DataClass and Component must be real classes (not MagicMock) because
# downstream code uses them as base classes with @dataclass, which
# inspects __mro__.
class _FakeDataClass:
    """Minimal stand-in for adalflow.DataClass."""
    __output_fields__ = []

class _FakeComponent:
    """Minimal stand-in for adalflow.Component."""
    def __init__(self, *args, **kwargs):
        pass

sys.modules["adalflow"].GoogleGenAIClient = MagicMock
sys.modules["adalflow"].OllamaClient = MagicMock
sys.modules["adalflow"].DataClass = _FakeDataClass
sys.modules["adalflow"].Component = _FakeComponent
sys.modules["adalflow.core"].DataClass = _FakeDataClass
sys.modules["adalflow.core"].Component = _FakeComponent
# adalflow.core.types needs List to be Python's list for type compatibility
sys.modules["adalflow.core.types"].List = list
sys.modules["adalflow.core.types"].Document = _FakeDataClass

_make_module("backoff", {
    "on_exception": _passthrough_decorator,
    "expo": MagicMock(),
    "constant": MagicMock(),
})

_make_module("boto3")
_make_module("botocore")
_make_module("botocore.config")
_make_module("botocore.exceptions")

_make_module("ollama")

_make_module("azure")
_make_module("azure.identity")
_make_module("azure.core")
_make_module("azure.core.credentials")

_make_module("openai")
_make_module("openai.types")
_make_module("openai.types.chat")
_make_module("openai.types.chat.chat_completion")

_make_module("dashscope")

_make_module("mcp")
_make_module("mcp.server")
_make_module("mcp.server.fastmcp", {"FastMCP": _mock_fastmcp_cls})

_make_module("tiktoken")
_make_module("langid")
_make_module("faiss")

_make_module("aiohttp", {
    "ClientResponse": MagicMock,
    "ClientSession": MagicMock,
    "ClientTimeout": MagicMock,
    "ClientError": type("ClientError", (Exception,), {}),
})

_make_module("websockets")

# ── Modules that may or may not be present ────────────────────

try:
    import numpy  # noqa: F401
except ImportError:
    _make_module("numpy")

try:
    import jinja2  # noqa: F401
except ImportError:
    _make_module("jinja2")
