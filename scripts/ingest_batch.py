#!/usr/bin/env python3
"""
Batch wiki ingestion script for GitUnderstand.

Processes multiple repos from a JSON configuration file by calling
``scripts/ingest.py`` as a subprocess for each entry.  This keeps each
ingestion isolated — if one repo crashes the others continue.

Usage::

    python scripts/ingest_batch.py --repos scripts/repos.json
    python scripts/ingest_batch.py --repos scripts/repos.json --concurrency 2 --skip-existing
    python scripts/ingest_batch.py --repos scripts/repos.json --dry-run
    python scripts/ingest_batch.py --repos scripts/repos.json --only facebook/react,pallets/flask
"""

from __future__ import annotations

import argparse
import json
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

STATUS_SUCCESS = "success"
STATUS_FAILED = "failed"
STATUS_SKIPPED = "skipped"


@dataclass
class RepoEntry:
    """A single repo parsed from the repos JSON file."""

    owner: str
    repo: str
    platform: str = "github"
    tags: List[str] = field(default_factory=list)
    featured: bool = False

    @property
    def slug(self) -> str:
        return f"{self.owner}/{self.repo}"


@dataclass
class Result:
    """Outcome of processing a single repo."""

    repo: RepoEntry
    status: str  # STATUS_SUCCESS | STATUS_FAILED | STATUS_SKIPPED
    duration_s: float = 0.0
    message: str = ""


# ---------------------------------------------------------------------------
# Repo JSON loading & validation
# ---------------------------------------------------------------------------


def load_repos(path: Path) -> List[RepoEntry]:
    """Load and validate the repos JSON file.

    Each entry must have at least ``owner`` and ``repo`` keys.  Missing
    optional fields receive sensible defaults.
    """
    if not path.exists():
        print(f"Error: repos file not found: {path}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(path, "r", encoding="utf-8") as fh:
            raw: List[Dict[str, Any]] = json.load(fh)
    except json.JSONDecodeError as exc:
        print(f"Error: invalid JSON in {path}: {exc}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(raw, list):
        print(f"Error: repos file must contain a JSON array", file=sys.stderr)
        sys.exit(1)

    entries: List[RepoEntry] = []
    for idx, item in enumerate(raw):
        if not isinstance(item, dict):
            print(f"Warning: skipping non-object entry at index {idx}", file=sys.stderr)
            continue
        owner = item.get("owner")
        repo = item.get("repo")
        if not owner or not repo:
            print(
                f"Warning: skipping entry at index {idx} — missing 'owner' or 'repo'",
                file=sys.stderr,
            )
            continue
        entries.append(
            RepoEntry(
                owner=str(owner),
                repo=str(repo),
                platform=str(item.get("platform", "github")),
                tags=item.get("tags", []),
                featured=bool(item.get("featured", False)),
            )
        )

    if not entries:
        print("Error: no valid repo entries found in the repos file", file=sys.stderr)
        sys.exit(1)

    return entries


# ---------------------------------------------------------------------------
# Cache existence check
# ---------------------------------------------------------------------------


def wiki_exists(
    api_url: str,
    owner: str,
    repo: str,
    platform: str,
    language: str,
) -> bool:
    """Return True if a cached wiki already exists for this repo."""
    url = f"{api_url.rstrip('/')}/api/wiki_cache"
    params = {
        "owner": owner,
        "repo": repo,
        "repo_type": platform,
        "language": language,
    }
    try:
        resp = httpx.get(url, params=params, timeout=15.0)
        # The endpoint returns 200 with JSON data when a cache exists,
        # and 200 with null/None body when it does not.
        if resp.status_code == 200 and resp.content and resp.content != b"null":
            return True
    except httpx.HTTPError:
        # Network error — assume not cached (will attempt generation)
        pass
    return False


# ---------------------------------------------------------------------------
# Single repo ingestion via subprocess
# ---------------------------------------------------------------------------


def ingest_repo(
    entry: RepoEntry,
    *,
    api_url: str,
    language: str,
    provider: str,
    model: Optional[str],
) -> subprocess.CompletedProcess:
    """Run ``scripts/ingest.py`` for a single repo entry."""
    cmd: List[str] = [
        sys.executable,
        "scripts/ingest.py",
        "--repo",
        entry.slug,
        "--language",
        language,
        "--provider",
        provider,
        "--api-url",
        api_url,
    ]
    if model:
        cmd.extend(["--model", model])
    if entry.tags:
        cmd.extend(["--tags", ",".join(entry.tags)])
    if entry.featured:
        cmd.append("--featured")

    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )


# ---------------------------------------------------------------------------
# Summary table
# ---------------------------------------------------------------------------

_STATUS_ICONS = {
    STATUS_SUCCESS: "OK",
    STATUS_FAILED: "FAIL",
    STATUS_SKIPPED: "SKIP",
}


def print_summary(results: List[Result]) -> None:
    """Print a formatted summary table of all results."""
    if not results:
        print("\nNo repos were processed.")
        return

    # Column widths
    repo_width = max(len(r.repo.slug) for r in results)
    repo_width = max(repo_width, len("Repository"))
    status_width = 8
    dur_width = 10

    header = (
        f"{'Repository':<{repo_width}}  "
        f"{'Status':<{status_width}}  "
        f"{'Duration':<{dur_width}}  "
        f"Message"
    )
    separator = "-" * len(header)

    print(f"\n{separator}")
    print("  BATCH INGESTION SUMMARY")
    print(separator)
    print(header)
    print(separator)

    counts = {STATUS_SUCCESS: 0, STATUS_FAILED: 0, STATUS_SKIPPED: 0}
    total_duration = 0.0

    for r in results:
        counts[r.status] = counts.get(r.status, 0) + 1
        total_duration += r.duration_s
        dur_str = f"{r.duration_s:.1f}s" if r.duration_s > 0 else "-"
        status_str = _STATUS_ICONS.get(r.status, r.status)
        msg = r.message[:60] if r.message else ""
        print(
            f"{r.repo.slug:<{repo_width}}  "
            f"{status_str:<{status_width}}  "
            f"{dur_str:<{dur_width}}  "
            f"{msg}"
        )

    print(separator)
    print(
        f"Total: {len(results)} repos  |  "
        f"{counts[STATUS_SUCCESS]} succeeded  |  "
        f"{counts[STATUS_FAILED]} failed  |  "
        f"{counts[STATUS_SKIPPED]} skipped  |  "
        f"{total_duration:.1f}s elapsed"
    )
    print(separator)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# Global to allow SIGINT handler to print partial results
_partial_results: List[Result] = []
_interrupted = False


def _sigint_handler(sig, frame):
    """Handle Ctrl-C gracefully by printing partial results."""
    global _interrupted
    _interrupted = True
    print("\n\nInterrupted! Printing partial results...", file=sys.stderr)
    print_summary(_partial_results)
    sys.exit(130)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Batch wiki ingestion for GitUnderstand",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python scripts/ingest_batch.py --repos scripts/repos.json\n"
            "  python scripts/ingest_batch.py --repos scripts/repos.json --dry-run\n"
            "  python scripts/ingest_batch.py --repos scripts/repos.json --skip-existing --concurrency 2\n"
            "  python scripts/ingest_batch.py --repos scripts/repos.json --only facebook/react,pallets/flask\n"
        ),
    )
    parser.add_argument(
        "--repos",
        required=True,
        type=Path,
        help="Path to JSON file with repo list",
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:8001",
        help="Backend API URL (default: http://localhost:8001)",
    )
    parser.add_argument(
        "--language",
        default="en",
        help="Wiki language (default: en)",
    )
    parser.add_argument(
        "--provider",
        default="google",
        help="AI provider (default: google)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="AI model override (optional)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=1,
        help="Number of parallel ingestions (default: 1, sequential)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be done without actually generating",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip repos that already have a cached wiki",
    )
    parser.add_argument(
        "--only",
        default=None,
        help="Comma-separated list of owner/repo to process (filters the repos file)",
    )
    return parser


def main() -> None:
    global _partial_results

    signal.signal(signal.SIGINT, _sigint_handler)

    parser = build_parser()
    args = parser.parse_args()

    # Load repos
    entries = load_repos(args.repos)

    # Filter by --only if provided
    if args.only:
        only_set = {s.strip() for s in args.only.split(",")}
        filtered = [e for e in entries if e.slug in only_set]
        if not filtered:
            print(
                f"Error: --only filter matched no repos. Available: "
                f"{', '.join(e.slug for e in entries)}",
                file=sys.stderr,
            )
            sys.exit(1)
        entries = filtered

    total = len(entries)

    # Dry-run mode: print the plan and exit
    if args.dry_run:
        print(f"DRY RUN — would process {total} repo(s):\n")
        for i, entry in enumerate(entries, 1):
            tags_str = ", ".join(entry.tags) if entry.tags else "(none)"
            featured_str = " [featured]" if entry.featured else ""
            print(f"  [{i}/{total}] {entry.slug} ({entry.platform})")
            print(f"          tags: {tags_str}{featured_str}")
            cmd_parts = [
                "python scripts/ingest.py",
                f"--repo {entry.slug}",
                f"--language {args.language}",
                f"--provider {args.provider}",
                f"--api-url {args.api_url}",
            ]
            if args.model:
                cmd_parts.append(f"--model {args.model}")
            if entry.tags:
                cmd_parts.append(f"--tags {','.join(entry.tags)}")
            if entry.featured:
                cmd_parts.append("--featured")
            print(f"          cmd:  {' '.join(cmd_parts)}")
            print()

        print(f"Settings: language={args.language}, provider={args.provider}, "
              f"model={args.model or '(default)'}, concurrency={args.concurrency}, "
              f"skip_existing={args.skip_existing}")
        return

    # Sequential processing (concurrency is reserved for future async support)
    if args.concurrency > 1:
        print(
            f"Note: concurrency={args.concurrency} requested. "
            f"Currently processing sequentially (async support is planned).",
            file=sys.stderr,
        )

    print(f"Starting batch ingestion of {total} repo(s)")
    print(f"  API:      {args.api_url}")
    print(f"  Language: {args.language}")
    print(f"  Provider: {args.provider}")
    if args.model:
        print(f"  Model:    {args.model}")
    if args.skip_existing:
        print(f"  Mode:     skip existing cached wikis")
    print()

    results: List[Result] = []
    _partial_results = results  # Allow SIGINT handler to access

    for i, entry in enumerate(entries, 1):
        print(f"[{i}/{total}] Processing {entry.slug}...")

        # Check for existing cache if --skip-existing
        if args.skip_existing:
            print(f"         Checking cache...", end="", flush=True)
            if wiki_exists(args.api_url, entry.owner, entry.repo, entry.platform, args.language):
                print(" cached, skipping.")
                results.append(
                    Result(
                        repo=entry,
                        status=STATUS_SKIPPED,
                        message="Wiki already cached",
                    )
                )
                continue
            print(" not cached, proceeding.")

        # Run ingest.py
        start = time.monotonic()
        try:
            proc = ingest_repo(
                entry,
                api_url=args.api_url,
                language=args.language,
                provider=args.provider,
                model=args.model,
            )
            elapsed = time.monotonic() - start

            if proc.returncode == 0:
                print(f"         Done in {elapsed:.1f}s")
                results.append(
                    Result(
                        repo=entry,
                        status=STATUS_SUCCESS,
                        duration_s=elapsed,
                    )
                )
            else:
                # Extract a short error message from stderr
                err_msg = (proc.stderr or "").strip().split("\n")[-1][:120] if proc.stderr else ""
                print(f"         FAILED (exit code {proc.returncode}) — {err_msg}")
                if proc.stderr:
                    print(f"         stderr (last 5 lines):")
                    for line in proc.stderr.strip().split("\n")[-5:]:
                        print(f"           {line}")
                results.append(
                    Result(
                        repo=entry,
                        status=STATUS_FAILED,
                        duration_s=elapsed,
                        message=err_msg or f"exit code {proc.returncode}",
                    )
                )

        except Exception as exc:
            elapsed = time.monotonic() - start
            print(f"         ERROR: {exc}")
            results.append(
                Result(
                    repo=entry,
                    status=STATUS_FAILED,
                    duration_s=elapsed,
                    message=str(exc)[:120],
                )
            )

    # Final summary
    print_summary(results)

    # Exit with non-zero if any repo failed
    if any(r.status == STATUS_FAILED for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
