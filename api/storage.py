"""
Wiki cache storage abstraction layer.

Provides a unified interface for reading/writing wiki cache data with two
backend implementations:

- **LocalStorage** (default): Reads/writes JSON files under
  ``~/.adalflow/wikicache/`` — identical to the original inline logic in
  ``api/api.py``.
- **GCSStorage**: Reads/writes to a Google Cloud Storage bucket. Intended
  for production (Cloud Run / GKE) deployments.

Selection is driven by the ``WIKI_STORAGE_TYPE`` environment variable:
    - ``"local"`` (default) -> LocalStorage
    - ``"gcs"``             -> GCSStorage

The ``GCS_BUCKET`` env var names the bucket for ``GCSStorage`` (defaults to
``"gitunderstand-wikicache"``).

Usage::

    from api.storage import get_storage

    storage = get_storage()
    data = await storage.get_wiki_cache("owner", "repo", "github", "en")
"""

from __future__ import annotations

import abc
import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_ADALFLOW_ROOT = os.path.expanduser(os.path.join("~", ".adalflow"))
_LOCAL_CACHE_DIR = os.path.join(_ADALFLOW_ROOT, "wikicache")
_INDEX_FILENAME = "_index.json"
_CACHE_PREFIX = "deepwiki_cache_"


def _cache_filename(owner: str, repo: str, repo_type: str, language: str) -> str:
    """Return the canonical cache filename for a wiki project."""
    return f"{_CACHE_PREFIX}{repo_type}_{owner}_{repo}_{language}.json"


def _parse_cache_filename(filename: str) -> Optional[Dict[str, str]]:
    """Extract owner/repo/repo_type/language from a cache filename.

    Returns ``None`` if the filename does not match the expected pattern.
    """
    if not filename.startswith(_CACHE_PREFIX) or not filename.endswith(".json"):
        return None
    stem = filename[len(_CACHE_PREFIX):-len(".json")]
    parts = stem.split("_")
    if len(parts) < 4:
        return None
    repo_type = parts[0]
    owner = parts[1]
    language = parts[-1]
    repo = "_".join(parts[2:-1])
    return {
        "owner": owner,
        "repo": repo,
        "repo_type": repo_type,
        "language": language,
    }


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class WikiStorageBackend(abc.ABC):
    """Abstract interface for wiki cache storage."""

    @abc.abstractmethod
    async def get_wiki_cache(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
    ) -> Optional[Dict[str, Any]]:
        """Return cached wiki data as a dict, or ``None`` if not found."""

    @abc.abstractmethod
    async def save_wiki_cache(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
        data: Dict[str, Any],
    ) -> bool:
        """Persist *data* as the wiki cache. Returns ``True`` on success."""

    @abc.abstractmethod
    async def delete_wiki_cache(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
    ) -> bool:
        """Delete a wiki cache entry. Returns ``True`` if it existed."""

    @abc.abstractmethod
    async def list_cached_projects(self) -> List[Dict[str, Any]]:
        """Return a list of metadata dicts for every cached project.

        Each dict contains at least:
        ``owner``, ``repo``, ``repo_type``, ``language``, ``submittedAt``.
        """

    @abc.abstractmethod
    async def get_export_data(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
        fmt: str,
    ) -> Optional[str]:
        """Return export content (markdown or json string) or ``None``."""


# ---------------------------------------------------------------------------
# LocalStorage
# ---------------------------------------------------------------------------

class LocalStorage(WikiStorageBackend):
    """File-system storage under ``~/.adalflow/wikicache/``.

    This mirrors the existing behaviour found in ``api/api.py`` so that
    swapping in this abstraction is a no-op for local development.
    """

    def __init__(self, cache_dir: str = _LOCAL_CACHE_DIR) -> None:
        self._cache_dir = cache_dir
        os.makedirs(self._cache_dir, exist_ok=True)
        self._index_path = os.path.join(self._cache_dir, _INDEX_FILENAME)

    # -- helpers ----------------------------------------------------------

    def _path(self, owner: str, repo: str, repo_type: str, language: str) -> str:
        return os.path.join(
            self._cache_dir,
            _cache_filename(owner, repo, repo_type, language),
        )

    async def _read_json(self, path: str) -> Any:
        def _read():
            with open(path, "r", encoding="utf-8") as fh:
                return json.load(fh)
        return await asyncio.to_thread(_read)

    async def _write_json(self, path: str, data: Any, indent: int = 2) -> None:
        def _write():
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(data, fh, indent=indent, ensure_ascii=False)
        await asyncio.to_thread(_write)

    async def _update_index(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
        filename: str,
    ) -> None:
        """Keep the lightweight ``_index.json`` in sync after writes/deletes."""
        try:
            index: Dict[str, Any] = {}
            if os.path.exists(self._index_path):
                index = await self._read_json(self._index_path)

            file_path = os.path.join(self._cache_dir, filename)
            if os.path.exists(file_path):
                stats = await asyncio.to_thread(os.stat, file_path)
                index[filename] = {
                    "owner": owner,
                    "repo": repo,
                    "repo_type": repo_type,
                    "language": language,
                    "submittedAt": int(stats.st_mtime * 1000),
                }
            else:
                index.pop(filename, None)

            await self._write_json(self._index_path, index)
        except Exception as exc:
            logger.warning(f"Failed to update local projects index: {exc}")

    async def _rebuild_index(self) -> Dict[str, Any]:
        """Full directory scan fallback when ``_index.json`` is missing."""
        index: Dict[str, Any] = {}
        if not os.path.exists(self._cache_dir):
            return index
        filenames = await asyncio.to_thread(os.listdir, self._cache_dir)
        for filename in filenames:
            meta = _parse_cache_filename(filename)
            if meta is None:
                continue
            file_path = os.path.join(self._cache_dir, filename)
            try:
                stats = await asyncio.to_thread(os.stat, file_path)
                meta["submittedAt"] = int(stats.st_mtime * 1000)
                index[filename] = meta
            except Exception as exc:
                logger.error(f"Error stat-ing {file_path} during index rebuild: {exc}")
        # Persist rebuilt index
        try:
            await self._write_json(self._index_path, index)
        except Exception:
            pass
        return index

    # -- interface --------------------------------------------------------

    async def get_wiki_cache(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
    ) -> Optional[Dict[str, Any]]:
        cache_path = self._path(owner, repo, repo_type, language)
        if not os.path.exists(cache_path):
            return None
        try:
            return await self._read_json(cache_path)
        except Exception as exc:
            logger.error(f"Error reading local wiki cache {cache_path}: {exc}")
            return None

    async def save_wiki_cache(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
        data: Dict[str, Any],
    ) -> bool:
        cache_path = self._path(owner, repo, repo_type, language)
        logger.info(f"Saving wiki cache to local file: {cache_path}")
        try:
            await self._write_json(cache_path, data)
            logger.info(f"Wiki cache saved successfully: {cache_path}")
            filename = os.path.basename(cache_path)
            await self._update_index(owner, repo, repo_type, language, filename)
            return True
        except IOError as exc:
            logger.error(
                f"IOError saving wiki cache to {cache_path}: "
                f"{exc.strerror} (errno: {exc.errno})",
                exc_info=True,
            )
            return False
        except Exception as exc:
            logger.error(
                f"Unexpected error saving wiki cache to {cache_path}: {exc}",
                exc_info=True,
            )
            return False

    async def delete_wiki_cache(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
    ) -> bool:
        cache_path = self._path(owner, repo, repo_type, language)
        if not os.path.exists(cache_path):
            return False
        try:
            await asyncio.to_thread(os.remove, cache_path)
            logger.info(f"Deleted local wiki cache: {cache_path}")
            filename = os.path.basename(cache_path)
            await self._update_index(owner, repo, repo_type, language, filename)
            return True
        except Exception as exc:
            logger.error(f"Error deleting local wiki cache {cache_path}: {exc}")
            return False

    async def list_cached_projects(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self._cache_dir):
            return []

        index: Optional[Dict[str, Any]] = None
        if os.path.exists(self._index_path):
            try:
                index = await self._read_json(self._index_path)
            except Exception as exc:
                logger.warning(f"Could not read local projects index, rebuilding: {exc}")

        if index is None:
            logger.info("Local projects index missing — rebuilding from directory scan.")
            index = await self._rebuild_index()

        projects: List[Dict[str, Any]] = []
        for filename, meta in index.items():
            projects.append(
                {
                    "id": filename,
                    "owner": meta["owner"],
                    "repo": meta["repo"],
                    "name": f"{meta['owner']}/{meta['repo']}",
                    "repo_type": meta["repo_type"],
                    "submittedAt": meta["submittedAt"],
                    "language": meta["language"],
                }
            )
        projects.sort(key=lambda p: p["submittedAt"], reverse=True)
        return projects

    async def get_export_data(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
        fmt: str,
    ) -> Optional[str]:
        data = await self.get_wiki_cache(owner, repo, repo_type, language)
        if data is None:
            return None
        return _format_export(data, fmt)


# ---------------------------------------------------------------------------
# GCSStorage
# ---------------------------------------------------------------------------

class GCSStorage(WikiStorageBackend):
    """Google Cloud Storage backend.

    Objects are stored under the bucket as flat keys mirroring the local
    filename convention::

        deepwiki_cache_{repo_type}_{owner}_{repo}_{language}.json

    An ``_index.json`` object is maintained in the same bucket for fast
    project listing, identical in structure to the local variant.
    """

    def __init__(
        self,
        bucket_name: str | None = None,
    ) -> None:
        self._bucket_name = bucket_name or os.environ.get(
            "GCS_BUCKET", "gitunderstand-wikicache"
        )
        # Lazy-init the client to avoid import errors when GCS is not installed
        self._client = None
        self._bucket = None

    def _ensure_client(self):
        """Lazily import and initialise the GCS client."""
        if self._client is not None:
            return
        try:
            from google.cloud import storage as gcs_storage
        except ImportError:
            raise RuntimeError(
                "google-cloud-storage is required for GCS wiki storage. "
                "Install it with: pip install google-cloud-storage"
            )
        self._client = gcs_storage.Client()
        self._bucket = self._client.bucket(self._bucket_name)
        logger.info(f"GCS storage initialised for bucket: {self._bucket_name}")

    # -- helpers ----------------------------------------------------------

    def _blob_name(self, owner: str, repo: str, repo_type: str, language: str) -> str:
        return _cache_filename(owner, repo, repo_type, language)

    async def _read_blob_json(self, blob_name: str) -> Optional[Dict[str, Any]]:
        """Download a blob and parse as JSON. Returns ``None`` if missing."""
        self._ensure_client()

        def _download():
            blob = self._bucket.blob(blob_name)
            if not blob.exists():
                return None
            content = blob.download_as_text(encoding="utf-8")
            return json.loads(content)

        return await asyncio.to_thread(_download)

    async def _write_blob_json(self, blob_name: str, data: Any) -> None:
        self._ensure_client()

        def _upload():
            blob = self._bucket.blob(blob_name)
            payload = json.dumps(data, indent=2, ensure_ascii=False)
            blob.upload_from_string(payload, content_type="application/json")

        await asyncio.to_thread(_upload)

    async def _delete_blob(self, blob_name: str) -> bool:
        """Delete a blob. Returns ``True`` if it existed and was deleted."""
        self._ensure_client()

        def _delete():
            blob = self._bucket.blob(blob_name)
            if not blob.exists():
                return False
            blob.delete()
            return True

        return await asyncio.to_thread(_delete)

    async def _update_index(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
        filename: str,
        deleted: bool = False,
    ) -> None:
        """Update the ``_index.json`` object in the bucket."""
        try:
            index = await self._read_blob_json(_INDEX_FILENAME) or {}
            if deleted:
                index.pop(filename, None)
            else:
                index[filename] = {
                    "owner": owner,
                    "repo": repo,
                    "repo_type": repo_type,
                    "language": language,
                    "submittedAt": int(datetime.utcnow().timestamp() * 1000),
                }
            await self._write_blob_json(_INDEX_FILENAME, index)
        except Exception as exc:
            logger.warning(f"Failed to update GCS projects index: {exc}")

    async def _rebuild_index(self) -> Dict[str, Any]:
        """List all blobs in the bucket and reconstruct the index."""
        self._ensure_client()

        def _list_blobs():
            return list(self._bucket.list_blobs(prefix=_CACHE_PREFIX))

        blobs = await asyncio.to_thread(_list_blobs)
        index: Dict[str, Any] = {}
        for blob in blobs:
            meta = _parse_cache_filename(blob.name)
            if meta is None:
                continue
            # Use blob update time as submission timestamp
            updated = blob.updated or blob.time_created
            ts = int(updated.timestamp() * 1000) if updated else 0
            meta["submittedAt"] = ts
            index[blob.name] = meta

        # Persist rebuilt index
        try:
            await self._write_blob_json(_INDEX_FILENAME, index)
        except Exception:
            pass
        return index

    # -- interface --------------------------------------------------------

    async def get_wiki_cache(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
    ) -> Optional[Dict[str, Any]]:
        blob_name = self._blob_name(owner, repo, repo_type, language)
        try:
            return await self._read_blob_json(blob_name)
        except Exception as exc:
            logger.error(f"Error reading GCS wiki cache {blob_name}: {exc}")
            return None

    async def save_wiki_cache(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
        data: Dict[str, Any],
    ) -> bool:
        blob_name = self._blob_name(owner, repo, repo_type, language)
        logger.info(f"Saving wiki cache to GCS: gs://{self._bucket_name}/{blob_name}")
        try:
            await self._write_blob_json(blob_name, data)
            logger.info(f"Wiki cache saved to GCS: {blob_name}")
            await self._update_index(owner, repo, repo_type, language, blob_name)
            return True
        except Exception as exc:
            logger.error(
                f"Error saving wiki cache to GCS {blob_name}: {exc}",
                exc_info=True,
            )
            return False

    async def delete_wiki_cache(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
    ) -> bool:
        blob_name = self._blob_name(owner, repo, repo_type, language)
        try:
            existed = await self._delete_blob(blob_name)
            if existed:
                logger.info(f"Deleted GCS wiki cache: {blob_name}")
                await self._update_index(
                    owner, repo, repo_type, language, blob_name, deleted=True
                )
            return existed
        except Exception as exc:
            logger.error(f"Error deleting GCS wiki cache {blob_name}: {exc}")
            return False

    async def list_cached_projects(self) -> List[Dict[str, Any]]:
        index: Optional[Dict[str, Any]] = None
        try:
            index = await self._read_blob_json(_INDEX_FILENAME)
        except Exception as exc:
            logger.warning(f"Could not read GCS projects index, rebuilding: {exc}")

        if index is None:
            logger.info("GCS projects index missing — rebuilding from blob listing.")
            index = await self._rebuild_index()

        projects: List[Dict[str, Any]] = []
        for filename, meta in index.items():
            projects.append(
                {
                    "id": filename,
                    "owner": meta["owner"],
                    "repo": meta["repo"],
                    "name": f"{meta['owner']}/{meta['repo']}",
                    "repo_type": meta["repo_type"],
                    "submittedAt": meta["submittedAt"],
                    "language": meta["language"],
                }
            )
        projects.sort(key=lambda p: p["submittedAt"], reverse=True)
        return projects

    async def get_export_data(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
        fmt: str,
    ) -> Optional[str]:
        data = await self.get_wiki_cache(owner, repo, repo_type, language)
        if data is None:
            return None
        return _format_export(data, fmt)


# ---------------------------------------------------------------------------
# Export helper (shared by both backends)
# ---------------------------------------------------------------------------

def _format_export(data: Dict[str, Any], fmt: str) -> str:
    """Convert cached wiki data into an export string.

    Parameters
    ----------
    data : dict
        Full wiki cache payload (as stored on disk / GCS).
    fmt : str
        ``"markdown"`` or ``"json"``.
    """
    pages = data.get("generated_pages", {})

    if fmt == "markdown":
        repo_info = data.get("repo") or {}
        repo_url = ""
        if isinstance(repo_info, dict):
            repo_url = repo_info.get("repoUrl", "")
        header = f"# Wiki Documentation for {repo_url}\n\n"
        header += f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

        toc = "## Table of Contents\n\n"
        body = ""
        page_list = list(pages.values())
        for page in page_list:
            title = page.get("title", page.get("id", ""))
            pid = page.get("id", "")
            toc += f"- [{title}](#{pid})\n"

        toc += "\n"

        for page in page_list:
            pid = page.get("id", "")
            title = page.get("title", "")
            content = page.get("content", "")
            body += f"<a id='{pid}'></a>\n\n## {title}\n\n{content}\n\n---\n\n"

        return header + toc + body

    # Default: JSON export
    page_list = list(pages.values())
    export_payload = {
        "metadata": {
            "repository": (data.get("repo") or {}).get("repoUrl", ""),
            "generated_at": datetime.now().isoformat(),
            "page_count": len(page_list),
        },
        "pages": page_list,
    }
    return json.dumps(export_payload, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_storage_instance: Optional[WikiStorageBackend] = None


def get_storage() -> WikiStorageBackend:
    """Return the configured storage backend singleton.

    The backend is selected via the ``WIKI_STORAGE_TYPE`` environment variable:

    - ``"local"`` (default) -> :class:`LocalStorage`
    - ``"gcs"``             -> :class:`GCSStorage`
    """
    global _storage_instance
    if _storage_instance is not None:
        return _storage_instance

    storage_type = os.environ.get("WIKI_STORAGE_TYPE", "local").lower().strip()

    if storage_type == "gcs":
        logger.info("Initialising GCS wiki storage backend")
        _storage_instance = GCSStorage()
    else:
        logger.info("Initialising local wiki storage backend")
        _storage_instance = LocalStorage()

    return _storage_instance
