"""Helper to extract structured diagram data from wiki page content."""

import json
import logging
import re
from typing import Dict, List, Optional

from api.diagram_schema import DiagramData

logger = logging.getLogger(__name__)

# Markers used by the AI to wrap structured diagram JSON
_START_MARKER = "<!-- DIAGRAM_DATA_START -->"
_END_MARKER = "<!-- DIAGRAM_DATA_END -->"

_PATTERN = re.compile(
    re.escape(_START_MARKER) + r"\s*(.*?)\s*" + re.escape(_END_MARKER),
    re.DOTALL,
)

# Lightweight regex to find node IDs with shape declarations in Mermaid source.
# Matches patterns like A[Label], B(Label), C{Label}, D((Label)), etc.
_MERMAID_NODE_RE = re.compile(r'\b(\w+)\s*[\[\(\{<]')

# Mermaid keywords to exclude from node counting.
_MERMAID_KEYWORDS = frozenset({
    'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'erDiagram',
    'TD', 'TB', 'LR', 'RL', 'BT', 'subgraph', 'end', 'style', 'class',
    'click', 'linkStyle', 'classDef',
})


def _count_mermaid_nodes(mermaid_src: str) -> int:
    """Return a rough count of unique node declarations in a Mermaid source string."""
    matches = _MERMAID_NODE_RE.findall(mermaid_src)
    return len({m for m in matches if m not in _MERMAID_KEYWORDS})


def _validate_simplified(simplified: str, full: str) -> bool:
    """Check that the simplified diagram has fewer (or equal) nodes than the full one."""
    simplified_count = _count_mermaid_nodes(simplified)
    full_count = _count_mermaid_nodes(full)
    if simplified_count > full_count:
        logger.warning(
            "Simplified diagram has more nodes (%d) than the full diagram (%d); discarding",
            simplified_count, full_count,
        )
        return False
    return True


def extract_diagram_data(content: str) -> List[Dict]:
    """Extract all structured diagram JSON blocks from wiki page content.

    Scans *content* for ``<!-- DIAGRAM_DATA_START -->`` /
    ``<!-- DIAGRAM_DATA_END -->`` markers, parses the JSON between them,
    and validates each block against the :class:`DiagramData` schema.

    Invalid blocks (malformed JSON, schema violations) are logged and
    skipped — they never raise.

    Returns a list of validated diagram-data dicts (may be empty).
    """
    results: List[Dict] = []
    try:
        matches = _PATTERN.findall(content)
        for raw_json in matches:
            try:
                data = json.loads(raw_json)
                validated = DiagramData(**data)
                dumped = validated.model_dump()

                # Validate simplified diagram if present
                if dumped.get("simplifiedMermaidSource") and dumped.get("mermaidSource"):
                    if not _validate_simplified(dumped["simplifiedMermaidSource"], dumped["mermaidSource"]):
                        dumped["simplifiedMermaidSource"] = None

                results.append(dumped)
            except json.JSONDecodeError as exc:
                logger.warning("Skipping diagram data block with invalid JSON: %s", exc)
            except Exception as exc:
                logger.warning("Skipping diagram data block that failed validation: %s", exc)
    except Exception as exc:
        logger.warning("Unexpected error extracting diagram data: %s", exc)
    return results
