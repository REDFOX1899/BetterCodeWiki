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
                results.append(validated.model_dump())
            except json.JSONDecodeError as exc:
                logger.warning("Skipping diagram data block with invalid JSON: %s", exc)
            except Exception as exc:
                logger.warning("Skipping diagram data block that failed validation: %s", exc)
    except Exception as exc:
        logger.warning("Unexpected error extracting diagram data: %s", exc)
    return results
