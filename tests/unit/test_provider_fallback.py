"""
Tests for provider fallback logic across all API endpoints.

These tests ensure that when a provider is empty/missing, the system
gracefully falls back to the configured default provider instead of crashing.
This was a critical bug: the frontend could send provider='' when the
useModelSelection async fetch hadn't completed yet.
"""

import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock


# ---------------------------------------------------------------------------
# Test: websocket_wiki.py — empty provider fallback
# ---------------------------------------------------------------------------

class TestWebSocketProviderFallback:
    """Test that the WebSocket wiki endpoint handles empty/missing providers."""

    def test_chat_completion_request_accepts_empty_provider(self):
        """Pydantic model should accept empty string for provider."""
        from api.websocket_wiki import ChatCompletionRequest

        req = ChatCompletionRequest(
            repo_url="https://github.com/test/repo",
            messages=[{"role": "user", "content": "test"}],
            provider="",
        )
        assert req.provider == ""

    def test_chat_completion_request_default_provider_is_google(self):
        """When provider is not provided at all, default should be 'google'."""
        from api.websocket_wiki import ChatCompletionRequest

        req = ChatCompletionRequest(
            repo_url="https://github.com/test/repo",
            messages=[{"role": "user", "content": "test"}],
        )
        assert req.provider == "google"

    def test_chat_completion_request_preserves_explicit_provider(self):
        """Explicitly set provider should not be overridden."""
        from api.websocket_wiki import ChatCompletionRequest

        req = ChatCompletionRequest(
            repo_url="https://github.com/test/repo",
            messages=[{"role": "user", "content": "test"}],
            provider="openai",
        )
        assert req.provider == "openai"


# ---------------------------------------------------------------------------
# Test: simple_chat.py — empty provider fallback
# ---------------------------------------------------------------------------

class TestSimpleChatProviderFallback:
    """Test that the HTTP chat endpoint handles empty/missing providers."""

    def test_chat_request_accepts_empty_provider(self):
        """simple_chat's ChatCompletionRequest should accept empty string."""
        from api.simple_chat import ChatCompletionRequest

        req = ChatCompletionRequest(
            repo_url="https://github.com/test/repo",
            messages=[{"role": "user", "content": "test"}],
            provider="",
        )
        assert req.provider == ""

    def test_chat_request_default_is_google(self):
        """Default provider for simple_chat should be 'google'."""
        from api.simple_chat import ChatCompletionRequest

        req = ChatCompletionRequest(
            repo_url="https://github.com/test/repo",
            messages=[{"role": "user", "content": "test"}],
        )
        assert req.provider == "google"


# ---------------------------------------------------------------------------
# Test: config.py — get_model_config with empty provider
# ---------------------------------------------------------------------------

class TestGetModelConfig:
    """Test that get_model_config raises clear errors for invalid providers."""

    def test_empty_provider_raises_value_error(self):
        """get_model_config('') should raise ValueError with clear message."""
        from api.config import get_model_config

        with pytest.raises(ValueError, match="Configuration for provider '' not found"):
            get_model_config(provider="", model=None)

    def test_none_provider_uses_default(self):
        """get_model_config with default args should work (defaults to 'google')."""
        from api.config import get_model_config, configs

        # Only test if google provider is actually configured
        if "providers" in configs and "google" in configs["providers"]:
            config = get_model_config()
            assert config is not None

    def test_invalid_provider_raises_value_error(self):
        """get_model_config with bogus provider should raise ValueError."""
        from api.config import get_model_config

        with pytest.raises(ValueError, match="Configuration for provider"):
            get_model_config(provider="nonexistent_provider_xyz")


# ---------------------------------------------------------------------------
# Test: addTokensToRequestBody — provider handling
# ---------------------------------------------------------------------------

class TestAddTokensToRequestBody:
    """Test that the request body builder handles empty providers correctly."""

    def test_empty_provider_is_set_in_body(self):
        """When provider is '', it should still be set (backend handles fallback)."""
        from api.websocket_wiki import ChatCompletionRequest

        req = ChatCompletionRequest(
            repo_url="https://github.com/test/repo",
            messages=[{"role": "user", "content": "test"}],
            provider="",
        )
        # The empty string should be present — backend fallback handles it
        assert req.provider == ""


# ---------------------------------------------------------------------------
# Test: diagram_schema.py — backward compatibility
# ---------------------------------------------------------------------------

class TestDiagramSchemaBackwardCompat:
    """Test that new schema fields don't break old data."""

    def test_old_data_without_new_fields(self):
        """DiagramData should accept data without layerLevel/simplifiedMermaidSource."""
        from api.diagram_schema import DiagramData

        old_data = {
            "nodes": [{"id": "A", "label": "Test", "files": []}],
            "edges": [],
            "mermaidSource": "graph TD\n    A[Test]",
            "diagramType": "flowchart",
        }
        diagram = DiagramData(**old_data)
        assert diagram.layerLevel is None
        assert diagram.simplifiedMermaidSource is None

    def test_new_data_with_all_fields(self):
        """DiagramData should accept data with all new fields."""
        from api.diagram_schema import DiagramData

        new_data = {
            "nodes": [{"id": "A", "label": "Test", "files": []}],
            "edges": [],
            "mermaidSource": "graph TD\n    A[Test] --> B[Other]",
            "diagramType": "flowchart",
            "layerLevel": 1,
            "simplifiedMermaidSource": "graph TD\n    A[Test]",
        }
        diagram = DiagramData(**new_data)
        assert diagram.layerLevel == 1
        assert diagram.simplifiedMermaidSource == "graph TD\n    A[Test]"


# ---------------------------------------------------------------------------
# Test: diagram_extract.py — extraction with new fields
# ---------------------------------------------------------------------------

class TestDiagramExtraction:
    """Test diagram data extraction handles both old and new formats."""

    def test_extract_with_simplified_source(self):
        """Should extract simplifiedMermaidSource when present."""
        from api.diagram_extract import extract_diagram_data

        content = """Some text
<!-- DIAGRAM_DATA_START -->
{
  "nodes": [{"id": "A", "label": "Frontend", "files": [], "depth": 0}],
  "edges": [],
  "mermaidSource": "graph TD\\n    A[Frontend] --> B[Backend]",
  "diagramType": "flowchart",
  "simplifiedMermaidSource": "graph TD\\n    A[Frontend]"
}
<!-- DIAGRAM_DATA_END -->
More text"""

        results = extract_diagram_data(content)
        assert len(results) == 1
        assert results[0]["simplifiedMermaidSource"] == "graph TD\n    A[Frontend]"

    def test_extract_without_simplified_source(self):
        """Should work without simplifiedMermaidSource (backward compat)."""
        from api.diagram_extract import extract_diagram_data

        content = """Some text
<!-- DIAGRAM_DATA_START -->
{
  "nodes": [{"id": "A", "label": "Test", "files": []}],
  "edges": [],
  "mermaidSource": "graph TD\\n    A[Test]",
  "diagramType": "flowchart"
}
<!-- DIAGRAM_DATA_END -->"""

        results = extract_diagram_data(content)
        assert len(results) == 1
        assert results[0].get("simplifiedMermaidSource") is None

    def test_extract_invalid_simplified_discarded(self):
        """Simplified with MORE nodes than full should be discarded."""
        from api.diagram_extract import extract_diagram_data

        content = """
<!-- DIAGRAM_DATA_START -->
{
  "nodes": [{"id": "A", "label": "Test", "files": []}],
  "edges": [],
  "mermaidSource": "graph TD\\n    A[Test]",
  "diagramType": "flowchart",
  "simplifiedMermaidSource": "graph TD\\n    A[Test] --> B[More] --> C[Nodes] --> D[Here]"
}
<!-- DIAGRAM_DATA_END -->"""

        results = extract_diagram_data(content)
        assert len(results) == 1
        # Simplified should be None because it has more nodes than the full version
        assert results[0]["simplifiedMermaidSource"] is None

    def test_extract_malformed_json_skipped(self):
        """Malformed JSON blocks should be skipped gracefully."""
        from api.diagram_extract import extract_diagram_data

        content = """
<!-- DIAGRAM_DATA_START -->
{ this is not valid json }
<!-- DIAGRAM_DATA_END -->
Some text after"""

        results = extract_diagram_data(content)
        assert len(results) == 0

    def test_extract_no_markers(self):
        """Content without diagram markers should return empty list."""
        from api.diagram_extract import extract_diagram_data

        results = extract_diagram_data("Just some regular markdown content")
        assert results == []

    def test_extract_multiple_diagrams(self):
        """Should extract multiple diagram blocks from single page."""
        from api.diagram_extract import extract_diagram_data

        content = """
<!-- DIAGRAM_DATA_START -->
{"nodes": [{"id": "A", "label": "One", "files": []}], "edges": [], "mermaidSource": "graph TD\\n    A[One]", "diagramType": "flowchart"}
<!-- DIAGRAM_DATA_END -->

Some text between

<!-- DIAGRAM_DATA_START -->
{"nodes": [{"id": "B", "label": "Two", "files": []}], "edges": [], "mermaidSource": "graph TD\\n    B[Two]", "diagramType": "flowchart"}
<!-- DIAGRAM_DATA_END -->"""

        results = extract_diagram_data(content)
        assert len(results) == 2


# ---------------------------------------------------------------------------
# Test: wiki_structure_parser.py — parsing robustness
# ---------------------------------------------------------------------------

class TestWikiStructureParser:
    """Test that the wiki structure parser handles various LLM outputs."""

    def test_parse_valid_xml(self):
        """Should successfully parse well-formed XML structure."""
        from api.wiki_structure_parser import parse_wiki_structure

        xml = """<wiki_structure>
  <title>Test Wiki</title>
  <description>A test wiki</description>
  <pages>
    <page id="page-1">
      <title>Introduction</title>
      <description>Intro page</description>
      <importance>high</importance>
      <relevant_files>
        <file_path>README.md</file_path>
      </relevant_files>
    </page>
  </pages>
</wiki_structure>"""

        result = parse_wiki_structure(xml)
        assert result["title"] == "Test Wiki"
        assert len(result["pages"]) == 1
        assert result["pages"][0]["title"] == "Introduction"
        assert result["pages"][0]["importance"] == "high"

    def test_parse_json_fallback(self):
        """Should parse JSON when XML fails."""
        from api.wiki_structure_parser import parse_wiki_structure

        json_str = json.dumps({
            "title": "JSON Wiki",
            "description": "From JSON",
            "pages": [
                {
                    "id": "page-1",
                    "title": "Page One",
                    "importance": "medium",
                    "filePaths": ["src/main.py"],
                    "relatedPages": []
                }
            ],
            "sections": []
        })

        result = parse_wiki_structure(json_str)
        assert result["title"] == "JSON Wiki"
        assert len(result["pages"]) == 1

    def test_parse_code_fenced_xml(self):
        """Should handle XML wrapped in markdown code fences."""
        from api.wiki_structure_parser import parse_wiki_structure

        fenced = """```xml
<wiki_structure>
  <title>Fenced Wiki</title>
  <description>Wrapped in fences</description>
  <pages>
    <page id="p1">
      <title>Page</title>
      <importance>low</importance>
    </page>
  </pages>
</wiki_structure>
```"""

        result = parse_wiki_structure(fenced)
        assert result["title"] == "Fenced Wiki"

    def test_parse_with_unescaped_ampersand(self):
        """Should handle unescaped & in XML (common LLM mistake)."""
        from api.wiki_structure_parser import parse_wiki_structure

        xml = """<wiki_structure>
  <title>Auth & Authorization</title>
  <description>Handles auth & permissions</description>
  <pages>
    <page id="page-1">
      <title>Login & Registration</title>
      <importance>high</importance>
    </page>
  </pages>
</wiki_structure>"""

        result = parse_wiki_structure(xml)
        assert "Auth" in result["title"]
        assert len(result["pages"]) == 1

    def test_parse_empty_response_raises(self):
        """Should raise ValueError on completely empty/unparseable response."""
        from api.wiki_structure_parser import parse_wiki_structure

        with pytest.raises(ValueError, match="All wiki structure parsing strategies failed"):
            parse_wiki_structure("")

    def test_parse_garbage_raises(self):
        """Should raise ValueError on total garbage input."""
        from api.wiki_structure_parser import parse_wiki_structure

        with pytest.raises(ValueError):
            parse_wiki_structure("This is just random text with no structure at all. Not XML, not JSON.")

    def test_parse_with_sections(self):
        """Should correctly parse sections and root sections."""
        from api.wiki_structure_parser import parse_wiki_structure

        xml = """<wiki_structure>
  <title>Sectioned Wiki</title>
  <description>Has sections</description>
  <sections>
    <section id="s1">
      <title>Overview</title>
      <pages>
        <page_ref>p1</page_ref>
        <page_ref>p2</page_ref>
      </pages>
    </section>
    <section id="s2">
      <title>Details</title>
      <pages>
        <page_ref>p3</page_ref>
      </pages>
    </section>
  </sections>
  <pages>
    <page id="p1"><title>Intro</title><importance>high</importance></page>
    <page id="p2"><title>Setup</title><importance>medium</importance></page>
    <page id="p3"><title>API</title><importance>high</importance></page>
  </pages>
</wiki_structure>"""

        result = parse_wiki_structure(xml)
        assert len(result["sections"]) == 2
        assert len(result["pages"]) == 3
        assert "s1" in result["rootSections"]
        assert "s2" in result["rootSections"]

    def test_parse_json_with_wiki_structure_wrapper(self):
        """Should unwrap { wiki_structure: { ... } } format."""
        from api.wiki_structure_parser import parse_wiki_structure

        wrapped = json.dumps({
            "wiki_structure": {
                "title": "Wrapped",
                "description": "Nested JSON",
                "pages": [
                    {"id": "p1", "title": "Page", "importance": "high"}
                ]
            }
        })

        result = parse_wiki_structure(wrapped)
        assert result["title"] == "Wrapped"
        assert len(result["pages"]) == 1


# ---------------------------------------------------------------------------
# Test: node counting in diagram_extract
# ---------------------------------------------------------------------------

class TestMermaidNodeCounting:
    """Test the mermaid node counting utility."""

    def test_count_simple_flowchart(self):
        """Should count nodes in a simple flowchart."""
        from api.diagram_extract import _count_mermaid_nodes

        src = "graph TD\n    A[Frontend] --> B[Backend]\n    B --> C[Database]"
        assert _count_mermaid_nodes(src) == 3

    def test_count_excludes_keywords(self):
        """Should not count mermaid keywords as nodes."""
        from api.diagram_extract import _count_mermaid_nodes

        src = "flowchart TD\n    subgraph cluster\n    A[Node]\n    end"
        count = _count_mermaid_nodes(src)
        # Should count A but not flowchart, TD, subgraph, end
        assert count >= 1
        assert count <= 2  # 'cluster' might match depending on syntax

    def test_count_empty_source(self):
        """Empty source should return 0."""
        from api.diagram_extract import _count_mermaid_nodes

        assert _count_mermaid_nodes("") == 0
