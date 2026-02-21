"""
Robust parser for wiki structure responses from LLMs.

Supports three parsing strategies applied in order:
  1. XML parsing (primary -- matches the prompt format)
  2. JSON parsing (fallback -- some models return JSON instead of XML)
  3. Regex extraction (last resort -- pulls structure from malformed output)

Each strategy produces the same normalized dict:
  {
    "title": str,
    "description": str,
    "pages": [
      {
        "id": str,
        "title": str,
        "filePaths": [str],
        "importance": "high" | "medium" | "low",
        "relatedPages": [str],
        "content": ""
      }
    ],
    "sections": [
      {
        "id": str,
        "title": str,
        "pages": [str],         # page IDs
        "subsections": [str]    # section IDs
      }
    ],
    "rootSections": [str]
  }
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional
from xml.dom.minidom import parseString
from xml.etree import ElementTree as ET

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_wiki_structure(raw_text: str) -> Dict[str, Any]:
    """
    Parse a wiki structure from raw LLM output.

    Tries XML first, then JSON, then regex extraction.

    Args:
        raw_text: The raw text response from the LLM.

    Returns:
        A normalized dict representing the wiki structure.

    Raises:
        ValueError: If none of the parsing strategies succeed.
    """
    # Strip markdown code fences that models sometimes wrap around output
    cleaned = _strip_code_fences(raw_text)

    errors: List[str] = []

    # Strategy 1: XML parsing
    try:
        result = _parse_xml(cleaned)
        if result and result.get("pages"):
            logger.info("Wiki structure parsed successfully via XML strategy")
            return result
    except Exception as exc:
        errors.append(f"XML: {exc}")
        logger.debug(f"XML parsing failed: {exc}")

    # Strategy 2: JSON parsing
    try:
        result = _parse_json(cleaned)
        if result and result.get("pages"):
            logger.info("Wiki structure parsed successfully via JSON strategy")
            return result
    except Exception as exc:
        errors.append(f"JSON: {exc}")
        logger.debug(f"JSON parsing failed: {exc}")

    # Strategy 3: Regex extraction
    try:
        result = _parse_regex(cleaned)
        if result and result.get("pages"):
            logger.info("Wiki structure parsed successfully via regex strategy")
            return result
    except Exception as exc:
        errors.append(f"Regex: {exc}")
        logger.debug(f"Regex parsing failed: {exc}")

    raise ValueError(
        f"All wiki structure parsing strategies failed. Errors: {'; '.join(errors)}"
    )


def convert_json_to_xml(structure: Dict[str, Any]) -> str:
    """
    Convert a normalized wiki structure dict into the XML format expected
    by the frontend DOMParser.

    This is useful when the LLM returns JSON -- the backend can convert it
    to XML before sending it to the frontend so existing frontend code
    continues to work without modification.

    Args:
        structure: A normalized wiki structure dict.

    Returns:
        An XML string in the <wiki_structure>...</wiki_structure> format.
    """
    lines: List[str] = []
    lines.append("<wiki_structure>")
    lines.append(f"  <title>{_xml_escape(structure.get('title', ''))}</title>")
    lines.append(f"  <description>{_xml_escape(structure.get('description', ''))}</description>")

    # Sections (if present)
    sections = structure.get("sections", [])
    if sections:
        lines.append("  <sections>")
        for section in sections:
            sid = _xml_escape(section.get("id", ""))
            lines.append(f'    <section id="{sid}">')
            lines.append(f"      <title>{_xml_escape(section.get('title', ''))}</title>")
            page_refs = section.get("pages", [])
            if page_refs:
                lines.append("      <pages>")
                for ref in page_refs:
                    lines.append(f"        <page_ref>{_xml_escape(ref)}</page_ref>")
                lines.append("      </pages>")
            sub_refs = section.get("subsections", [])
            if sub_refs:
                lines.append("      <subsections>")
                for ref in sub_refs:
                    lines.append(f"        <section_ref>{_xml_escape(ref)}</section_ref>")
                lines.append("      </subsections>")
            lines.append("    </section>")
        lines.append("  </sections>")

    # Pages
    pages = structure.get("pages", [])
    lines.append("  <pages>")
    for page in pages:
        pid = _xml_escape(page.get("id", ""))
        lines.append(f'    <page id="{pid}">')
        lines.append(f"      <title>{_xml_escape(page.get('title', ''))}</title>")
        lines.append(f"      <description>{_xml_escape(page.get('description', ''))}</description>")
        importance = page.get("importance", "medium")
        if importance not in ("high", "medium", "low"):
            importance = "medium"
        lines.append(f"      <importance>{importance}</importance>")
        file_paths = page.get("filePaths", []) or page.get("relevant_files", []) or page.get("file_paths", [])
        if file_paths:
            lines.append("      <relevant_files>")
            for fp in file_paths:
                lines.append(f"        <file_path>{_xml_escape(fp)}</file_path>")
            lines.append("      </relevant_files>")
        related = page.get("relatedPages", []) or page.get("related_pages", [])
        if related:
            lines.append("      <related_pages>")
            for rp in related:
                lines.append(f"        <related>{_xml_escape(rp)}</related>")
            lines.append("      </related_pages>")
        parent = page.get("parent_section", "")
        if parent:
            lines.append(f"      <parent_section>{_xml_escape(parent)}</parent_section>")
        lines.append("    </page>")
    lines.append("  </pages>")
    lines.append("</wiki_structure>")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Strategy 1: XML parsing
# ---------------------------------------------------------------------------

def _parse_xml(text: str) -> Optional[Dict[str, Any]]:
    """Parse wiki structure from XML in the response text."""
    # Try to extract the <wiki_structure>...</wiki_structure> block
    match = re.search(r"<wiki_structure>[\s\S]*?</wiki_structure>", text)
    if not match:
        raise ValueError("No <wiki_structure> XML block found in response")

    xml_text = match.group(0)

    # Clean control characters
    xml_text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", xml_text)

    # Fix unescaped ampersands (common LLM mistake)
    xml_text = re.sub(r"&(?!amp;|lt;|gt;|apos;|quot;|#)", "&amp;", xml_text)

    root = ET.fromstring(xml_text)

    title = _et_text(root, "title")
    description = _et_text(root, "description")

    # Parse pages
    pages: List[Dict[str, Any]] = []
    for page_el in root.iter("page"):
        page_id = page_el.get("id", f"page-{len(pages) + 1}")
        page_title = _et_text(page_el, "title")
        page_desc = _et_text(page_el, "description")
        importance = _et_text(page_el, "importance") or "medium"
        if importance not in ("high", "medium", "low"):
            importance = "medium"

        file_paths = [fp.text.strip() for fp in page_el.iter("file_path") if fp.text]
        related_pages = [rp.text.strip() for rp in page_el.iter("related") if rp.text]
        parent_section = _et_text(page_el, "parent_section")

        pages.append({
            "id": page_id,
            "title": page_title,
            "description": page_desc,
            "filePaths": file_paths,
            "importance": importance,
            "relatedPages": related_pages,
            "content": "",
            "parent_section": parent_section,
        })

    # Parse sections
    sections: List[Dict[str, Any]] = []
    for section_el in root.iter("section"):
        section_id = section_el.get("id", f"section-{len(sections) + 1}")
        section_title = _et_text(section_el, "title")
        page_refs = [pr.text.strip() for pr in section_el.iter("page_ref") if pr.text]
        section_refs = [sr.text.strip() for sr in section_el.iter("section_ref") if sr.text]
        sections.append({
            "id": section_id,
            "title": section_title,
            "pages": page_refs,
            "subsections": section_refs,
        })

    # Determine root sections
    referenced_sections = set()
    for s in sections:
        for sub in s.get("subsections", []):
            referenced_sections.add(sub)
    root_sections = [s["id"] for s in sections if s["id"] not in referenced_sections]

    return {
        "title": title,
        "description": description,
        "pages": pages,
        "sections": sections,
        "rootSections": root_sections,
    }


# ---------------------------------------------------------------------------
# Strategy 2: JSON parsing
# ---------------------------------------------------------------------------

def _parse_json(text: str) -> Optional[Dict[str, Any]]:
    """Parse wiki structure from JSON in the response text."""
    # Try to find a JSON object in the text
    json_obj = _extract_json_object(text)
    if json_obj is None:
        raise ValueError("No JSON object found in response")

    return _normalize_json_structure(json_obj)


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    """
    Try to extract a JSON object from text. Handles:
      - Pure JSON
      - JSON wrapped in markdown code fences
      - JSON embedded in other text
    """
    # Strip code fences
    cleaned = _strip_code_fences(text)

    # Try to parse the whole text as JSON
    try:
        obj = json.loads(cleaned)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass

    # Try to find JSON block with { ... } braces
    # Look for the outermost { ... } that contains wiki-like keys
    brace_depth = 0
    start_idx = None
    for i, ch in enumerate(cleaned):
        if ch == "{":
            if brace_depth == 0:
                start_idx = i
            brace_depth += 1
        elif ch == "}":
            brace_depth -= 1
            if brace_depth == 0 and start_idx is not None:
                candidate = cleaned[start_idx : i + 1]
                try:
                    obj = json.loads(candidate)
                    if isinstance(obj, dict) and _looks_like_wiki_structure(obj):
                        return obj
                except json.JSONDecodeError:
                    start_idx = None
                    continue

    return None


def _looks_like_wiki_structure(obj: Dict[str, Any]) -> bool:
    """Check if a JSON object looks like a wiki structure."""
    # Must have pages (or a wiki_structure wrapper)
    if "pages" in obj:
        return True
    if "wiki_structure" in obj:
        return True
    # Check for common top-level keys
    if "title" in obj and ("pages" in obj or "sections" in obj):
        return True
    return False


def _normalize_json_structure(obj: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize a JSON object into the standard wiki structure format.

    Handles various JSON schemas the LLM might produce:
      - { "wiki_structure": { ... } }  (wrapped)
      - { "title": ..., "pages": [...], "sections": [...] }  (flat)
      - { "pages": [...] }  (minimal)
    """
    # Unwrap if nested under a key
    if "wiki_structure" in obj and isinstance(obj["wiki_structure"], dict):
        obj = obj["wiki_structure"]

    title = obj.get("title", "")
    description = obj.get("description", "")

    # Parse pages
    raw_pages = obj.get("pages", [])
    pages: List[Dict[str, Any]] = []
    for i, raw_page in enumerate(raw_pages):
        if isinstance(raw_page, dict):
            page = _normalize_page(raw_page, i)
            pages.append(page)

    # Parse sections
    raw_sections = obj.get("sections", [])
    sections: List[Dict[str, Any]] = []
    for i, raw_section in enumerate(raw_sections):
        if isinstance(raw_section, dict):
            section = _normalize_section(raw_section, i)
            sections.append(section)

    # Root sections
    root_sections = obj.get("rootSections", obj.get("root_sections", []))
    if not root_sections and sections:
        # Calculate root sections: those not referenced as subsections
        referenced = set()
        for s in sections:
            for sub in s.get("subsections", []):
                referenced.add(sub)
        root_sections = [s["id"] for s in sections if s["id"] not in referenced]

    return {
        "title": title,
        "description": description,
        "pages": pages,
        "sections": sections,
        "rootSections": root_sections,
    }


def _normalize_page(raw: Dict[str, Any], index: int) -> Dict[str, Any]:
    """Normalize a single page dict from JSON, handling various key naming conventions."""
    page_id = raw.get("id", f"page-{index + 1}")

    # Title
    title = raw.get("title", "")

    # Description
    description = raw.get("description", "")

    # Importance
    importance = raw.get("importance", "medium")
    if importance not in ("high", "medium", "low"):
        importance = "medium"

    # File paths -- handle multiple naming conventions
    file_paths = (
        raw.get("filePaths")
        or raw.get("file_paths")
        or raw.get("relevant_files")
        or raw.get("relevantFiles")
        or []
    )
    # Handle nested relevant_files with file_path keys
    if isinstance(file_paths, dict):
        file_paths = file_paths.get("file_path", [])
    if isinstance(file_paths, str):
        file_paths = [file_paths]
    # Ensure all entries are strings
    file_paths = [str(fp) for fp in file_paths if fp]

    # Related pages -- handle multiple naming conventions
    related_pages = (
        raw.get("relatedPages")
        or raw.get("related_pages")
        or raw.get("relatedPages")
        or []
    )
    if isinstance(related_pages, dict):
        related_pages = related_pages.get("related", [])
    if isinstance(related_pages, str):
        related_pages = [related_pages]
    related_pages = [str(rp) for rp in related_pages if rp]

    # Parent section
    parent_section = raw.get("parent_section", raw.get("parentSection", ""))

    return {
        "id": page_id,
        "title": title,
        "description": description,
        "filePaths": file_paths,
        "importance": importance,
        "relatedPages": related_pages,
        "content": "",
        "parent_section": parent_section,
    }


def _normalize_section(raw: Dict[str, Any], index: int) -> Dict[str, Any]:
    """Normalize a single section dict from JSON."""
    section_id = raw.get("id", f"section-{index + 1}")
    title = raw.get("title", "")

    # Pages can be page_refs or pages
    page_refs = raw.get("pages", raw.get("page_refs", []))
    if isinstance(page_refs, str):
        page_refs = [page_refs]
    page_refs = [str(pr) for pr in page_refs if pr]

    # Subsections
    subsections = raw.get("subsections", raw.get("section_refs", []))
    if isinstance(subsections, str):
        subsections = [subsections]
    subsections = [str(sr) for sr in subsections if sr]

    return {
        "id": section_id,
        "title": title,
        "pages": page_refs,
        "subsections": subsections,
    }


# ---------------------------------------------------------------------------
# Strategy 3: Regex extraction (last resort)
# ---------------------------------------------------------------------------

def _parse_regex(text: str) -> Optional[Dict[str, Any]]:
    """
    Extract wiki structure using regex patterns.
    This is the fallback when both XML and JSON parsing fail.
    """
    # Try to find wiki_structure block first
    block_match = re.search(r"<wiki_structure>(.*?)</wiki_structure>", text, re.DOTALL)
    if not block_match:
        # Maybe the whole text is the structure content
        block_content = text
    else:
        block_content = block_match.group(1)

    # Extract title
    title_match = re.search(r"<title>(.*?)</title>", block_content, re.DOTALL)
    title = title_match.group(1).strip() if title_match else ""

    # Extract description
    desc_match = re.search(r"<description>(.*?)</description>", block_content, re.DOTALL)
    description = desc_match.group(1).strip() if desc_match else ""

    # Extract pages
    pages: List[Dict[str, Any]] = []
    page_pattern = re.compile(r'<page\s+id="([^"]*)">(.*?)</page>', re.DOTALL)
    for page_match in page_pattern.finditer(block_content):
        page_id = page_match.group(1)
        page_content = page_match.group(2)

        page_title_match = re.search(r"<title>(.*?)</title>", page_content, re.DOTALL)
        page_title = page_title_match.group(1).strip() if page_title_match else ""

        page_desc_match = re.search(r"<description>(.*?)</description>", page_content, re.DOTALL)
        page_desc = page_desc_match.group(1).strip() if page_desc_match else ""

        importance_match = re.search(r"<importance>(.*?)</importance>", page_content, re.DOTALL)
        importance = importance_match.group(1).strip() if importance_match else "medium"
        if importance not in ("high", "medium", "low"):
            importance = "medium"

        file_paths = re.findall(r"<file_path>(.*?)</file_path>", page_content, re.DOTALL)
        file_paths = [fp.strip() for fp in file_paths]

        related_pages = re.findall(r"<related>(.*?)</related>", page_content, re.DOTALL)
        related_pages = [rp.strip() for rp in related_pages]

        parent_match = re.search(r"<parent_section>(.*?)</parent_section>", page_content, re.DOTALL)
        parent_section = parent_match.group(1).strip() if parent_match else ""

        pages.append({
            "id": page_id,
            "title": page_title,
            "description": page_desc,
            "filePaths": file_paths,
            "importance": importance,
            "relatedPages": related_pages,
            "content": "",
            "parent_section": parent_section,
        })

    # Extract sections
    sections: List[Dict[str, Any]] = []
    section_pattern = re.compile(r'<section\s+id="([^"]*)">(.*?)</section>', re.DOTALL)
    for section_match in section_pattern.finditer(block_content):
        section_id = section_match.group(1)
        section_content = section_match.group(2)

        section_title_match = re.search(r"<title>(.*?)</title>", section_content, re.DOTALL)
        section_title = section_title_match.group(1).strip() if section_title_match else ""

        page_refs = re.findall(r"<page_ref>(.*?)</page_ref>", section_content, re.DOTALL)
        page_refs = [pr.strip() for pr in page_refs]

        section_refs = re.findall(r"<section_ref>(.*?)</section_ref>", section_content, re.DOTALL)
        section_refs = [sr.strip() for sr in section_refs]

        sections.append({
            "id": section_id,
            "title": section_title,
            "pages": page_refs,
            "subsections": section_refs,
        })

    if not pages:
        raise ValueError("Regex extraction found no pages")

    # Root sections
    referenced = set()
    for s in sections:
        for sub in s.get("subsections", []):
            referenced.add(sub)
    root_sections = [s["id"] for s in sections if s["id"] not in referenced]

    return {
        "title": title,
        "description": description,
        "pages": pages,
        "sections": sections,
        "rootSections": root_sections,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences from the text."""
    text = text.strip()
    # Remove opening code fence (```json, ```xml, ```, etc.)
    text = re.sub(r"^```(?:json|xml|javascript|typescript)?\s*\n?", "", text)
    # Remove closing code fence
    text = re.sub(r"\n?```\s*$", "", text)
    return text


def _xml_escape(text: str) -> str:
    """Escape special XML characters."""
    if not text:
        return ""
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    text = text.replace('"', "&quot;")
    text = text.replace("'", "&apos;")
    return text


def _et_text(element: ET.Element, tag: str) -> str:
    """Get text content from a child element, or empty string if not found."""
    child = element.find(tag)
    if child is not None and child.text:
        return child.text.strip()
    return ""
