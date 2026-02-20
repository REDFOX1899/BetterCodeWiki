# Audio & Podcast Generation — Implementation Plan

> Generate audio narrations of wiki pages so developers can listen during commutes, onboarding, or code review prep.

---

## Cost Analysis: Why Edge TTS First, Google Cloud TTS as Upgrade

### Pricing Comparison

| Provider | Quality | Cost per 1M chars | Free Tier | API Key Needed |
|---|---|---|---|---|
| **Edge TTS** | Neural (good) | **$0 (free)** | Unlimited* | No |
| Google Standard | Basic | $4/1M chars | 4M chars/month | Yes |
| Google WaveNet | High | $16/1M chars | 1M chars/month | Yes |
| Google Neural2 | High | $16/1M chars | — | Yes |
| Google Journey | Conversational | ~$30/1M chars | — | Yes |
| OpenAI tts-1 | High | $15/1M chars | — | Yes |
| OpenAI tts-1-hd | Very high | $30/1M chars | — | Yes |

*Edge TTS has no official rate limits but could throttle if abused.

### Real Cost for Our Wiki Data

Measured from our 6 cached wikis:

| Wiki | Pages | Total Chars | Edge TTS Cost | Google WaveNet Cost |
|---|---|---|---|---|
| small-test-repo | 4 | 22K | $0 | $0.35 |
| vigilant-sanderson | 5 | 86K | $0 | $1.38 |
| deepwiki-open | 5 | 66K | $0 | $1.06 |
| claude-code | 10 | 1.8M* | $0 | $28.80* |
| gemini-cli | 13 | 1M* | $0 | $16.00* |

*These have abnormally large pages (1.5M chars in one page = data dump, not readable docs). After markdown-to-script conversion with truncation of code blocks, real narration content would be ~10-30K chars per page.

**Realistic cost per typical wiki (5-10 pages, ~100K narration chars):**
- Edge TTS: **$0**
- Google WaveNet: **$1.60** (free if under 1M chars/month)
- OpenAI tts-1: **$1.50**

### Decision: Edge TTS as default, Google/OpenAI as premium options

Edge TTS is free, neural-quality, and needs zero configuration. It's the right default. Users who want higher quality can switch to Google Cloud TTS or OpenAI via the existing model selection pattern.

---

## Architecture

### Zero Risk to Existing Code

Same pattern as the MCP server — new files only, no modifications to existing endpoints.

```
New files:
  api/audio/
  ├── __init__.py
  ├── tts_engine.py        # TTS provider abstraction (Edge/Google/OpenAI)
  ├── script_converter.py  # Markdown wiki → spoken narration script
  └── cache.py             # Audio file caching (~/.adalflow/audio/)

  src/components/
  └── AudioPlayer.tsx      # Frontend player component

Modified files:
  api/api.py               # Add 3 new endpoints (at bottom of file)
  src/app/[owner]/[repo]/page.tsx  # Add AudioPlayer next to ExportMenu
  api/pyproject.toml       # Add edge-tts dependency
```

### Data Flow

```
Wiki Page (markdown)
  → script_converter.py strips code blocks, Mermaid diagrams,
    tables, links → produces clean narration text
  → tts_engine.py chunks text (max 3000 chars per TTS call),
    synthesizes each chunk, concatenates MP3 segments
  → cache.py saves to ~/.adalflow/audio/{owner}_{repo}_{page_id}_{lang}.mp3
  → API serves cached file or streams generation progress
  → AudioPlayer.tsx plays the MP3 with controls
```

---

## Backend Implementation

### 1. script_converter.py — Markdown to Narration Script

Strips elements that don't make sense when spoken:

```python
"""Convert wiki page markdown into a clean narration script."""

import re

def markdown_to_script(title: str, content: str) -> str:
    """Convert markdown wiki page content to a spoken narration script.

    Strips code blocks, Mermaid diagrams, tables, raw HTML, image refs,
    and reformats the remaining text for natural speech.
    """
    text = content

    # Remove Mermaid diagrams
    text = re.sub(r'```mermaid[\s\S]*?```', '', text)

    # Remove code blocks (replace with brief mention)
    def replace_code_block(match):
        lang = match.group(1) or "code"
        return f"(A {lang} code example is shown in the documentation.) "
    text = re.sub(r'```(\w*)\n[\s\S]*?```', replace_code_block, text)

    # Remove inline code backticks but keep the text
    text = re.sub(r'`([^`]+)`', r'\1', text)

    # Remove images
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)

    # Convert links to just the text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)

    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)

    # Remove table formatting (keep cell content)
    text = re.sub(r'\|', ' ', text)
    text = re.sub(r'[-:]{3,}', '', text)

    # Convert headers to spoken transitions
    text = re.sub(r'^#{1,6}\s+(.+)$', r'\n\1.\n', text, flags=re.MULTILINE)

    # Remove bullet points / list markers
    text = re.sub(r'^[\s]*[-*+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[\s]*\d+\.\s+', '', text, flags=re.MULTILINE)

    # Remove bold/italic markers
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)

    # Collapse multiple newlines
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Collapse multiple spaces
    text = re.sub(r'  +', ' ', text)

    # Add title intro
    script = f"{title}.\n\n{text.strip()}"

    # Limit to reasonable narration length (~30K chars max, ~20 min of speech)
    MAX_SCRIPT_CHARS = 30000
    if len(script) > MAX_SCRIPT_CHARS:
        script = script[:MAX_SCRIPT_CHARS]
        # Cut at last sentence boundary
        last_period = script.rfind('. ')
        if last_period > MAX_SCRIPT_CHARS * 0.8:
            script = script[:last_period + 1]
        script += "\n\nThis concludes the narration for this page. See the full documentation for more details."

    return script
```

**Key design decisions:**
- Code blocks are replaced with "(A code example is shown in the documentation)" — not skipped silently
- Headers become natural spoken transitions with a period (pause)
- Links become just their text
- 30K char cap = ~20 minutes of audio max per page (prevents the 1.5M char outliers from burning money/time)

### 2. tts_engine.py — Provider Abstraction

```python
"""TTS provider abstraction. Adapter pattern matching existing LLM clients."""

import asyncio
import io
import os
import struct
from abc import ABC, abstractmethod

class TTSEngine(ABC):
    """Base class for TTS providers."""

    @abstractmethod
    async def synthesize(self, text: str, voice: str) -> bytes:
        """Convert text to audio bytes (MP3 format)."""
        ...

    @abstractmethod
    def list_voices(self) -> list[dict]:
        """Return available voices."""
        ...


class EdgeTTSEngine(TTSEngine):
    """Free TTS using Microsoft Edge's neural voices."""

    VOICES = {
        "en-US-AndrewMultilingualNeural": "Andrew (male, natural)",
        "en-US-AvaMultilingualNeural": "Ava (female, natural)",
        "en-US-BrianMultilingualNeural": "Brian (male, conversational)",
        "en-US-EmmaMultilingualNeural": "Emma (female, conversational)",
    }
    DEFAULT_VOICE = "en-US-AndrewMultilingualNeural"

    async def synthesize(self, text: str, voice: str = None) -> bytes:
        import edge_tts
        voice = voice or self.DEFAULT_VOICE
        communicate = edge_tts.Communicate(text, voice)
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
        return b"".join(audio_chunks)

    def list_voices(self) -> list[dict]:
        return [{"id": k, "name": v} for k, v in self.VOICES.items()]


class GoogleTTSEngine(TTSEngine):
    """Google Cloud TTS (WaveNet/Neural2 voices)."""

    VOICES = {
        "en-US-Neural2-D": "Neural2 D (male)",
        "en-US-Neural2-C": "Neural2 C (female)",
        "en-US-Wavenet-D": "WaveNet D (male)",
        "en-US-Wavenet-F": "WaveNet F (female)",
    }
    DEFAULT_VOICE = "en-US-Neural2-D"

    async def synthesize(self, text: str, voice: str = None) -> bytes:
        from google.cloud import texttospeech
        voice = voice or self.DEFAULT_VOICE
        client = texttospeech.TextToSpeechClient()
        synthesis_input = texttospeech.SynthesisInput(text=text)
        voice_params = texttospeech.VoiceSelectionParams(
            language_code="en-US",
            name=voice,
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=1.0,
        )
        response = await asyncio.to_thread(
            client.synthesize_speech,
            input=synthesis_input,
            voice=voice_params,
            audio_config=audio_config,
        )
        return response.audio_content

    def list_voices(self) -> list[dict]:
        return [{"id": k, "name": v} for k, v in self.VOICES.items()]


class OpenAITTSEngine(TTSEngine):
    """OpenAI TTS (tts-1 / tts-1-hd)."""

    VOICES = {
        "alloy": "Alloy (neutral)",
        "echo": "Echo (male)",
        "fable": "Fable (male, British)",
        "onyx": "Onyx (male, deep)",
        "nova": "Nova (female)",
        "shimmer": "Shimmer (female, warm)",
    }
    DEFAULT_VOICE = "nova"

    def __init__(self, model: str = "tts-1"):
        self.model = model

    async def synthesize(self, text: str, voice: str = None) -> bytes:
        from openai import OpenAI
        voice = voice or self.DEFAULT_VOICE
        client = OpenAI()
        response = await asyncio.to_thread(
            client.audio.speech.create,
            model=self.model,
            voice=voice,
            input=text,
            response_format="mp3",
        )
        return response.content

    def list_voices(self) -> list[dict]:
        return [{"id": k, "name": v} for k, v in self.VOICES.items()]


# ── Chunked synthesis (handles TTS API character limits) ──

MAX_CHUNK_CHARS = 3000  # Safe limit for all providers

def chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    """Split text into chunks at sentence boundaries."""
    chunks = []
    while len(text) > max_chars:
        # Find the last sentence boundary within the limit
        boundary = text.rfind('. ', 0, max_chars)
        if boundary < max_chars * 0.5:
            # No good sentence boundary, split at last space
            boundary = text.rfind(' ', 0, max_chars)
        if boundary < 0:
            boundary = max_chars
        chunks.append(text[:boundary + 1].strip())
        text = text[boundary + 1:].strip()
    if text:
        chunks.append(text)
    return chunks


async def synthesize_long_text(
    engine: TTSEngine, text: str, voice: str = None
) -> bytes:
    """Synthesize text of any length by chunking and concatenating."""
    chunks = chunk_text(text)
    audio_parts = []
    for chunk in chunks:
        if chunk.strip():
            audio = await engine.synthesize(chunk, voice)
            audio_parts.append(audio)
    return b"".join(audio_parts)


def get_engine(provider: str = "edge", model: str = None) -> TTSEngine:
    """Factory function for TTS engines."""
    if provider == "edge":
        return EdgeTTSEngine()
    elif provider == "google":
        return GoogleTTSEngine()
    elif provider == "openai":
        return OpenAITTSEngine(model=model or "tts-1")
    else:
        raise ValueError(f"Unknown TTS provider: {provider}")
```

### 3. cache.py — Audio File Caching

```python
"""Audio file caching in ~/.adalflow/audio/."""

import hashlib
import os
import time

AUDIO_CACHE_DIR = os.path.expanduser("~/.adalflow/audio")
os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)


def get_cache_key(
    owner: str, repo: str, page_id: str,
    provider: str, voice: str, language: str = "en"
) -> str:
    """Generate a deterministic cache filename."""
    return f"{owner}_{repo}_{page_id}_{provider}_{voice}_{language}.mp3"


def get_cache_path(cache_key: str) -> str:
    return os.path.join(AUDIO_CACHE_DIR, cache_key)


def is_cached(cache_key: str) -> bool:
    path = get_cache_path(cache_key)
    return os.path.exists(path) and os.path.getsize(path) > 0


def read_cached(cache_key: str) -> bytes | None:
    path = get_cache_path(cache_key)
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return f.read()


def write_cache(cache_key: str, audio_data: bytes) -> str:
    path = get_cache_path(cache_key)
    with open(path, "wb") as f:
        f.write(audio_data)
    return path


def get_cache_info(owner: str, repo: str) -> list[dict]:
    """List all cached audio files for a repo."""
    prefix = f"{owner}_{repo}_"
    entries = []
    for fname in os.listdir(AUDIO_CACHE_DIR):
        if fname.startswith(prefix) and fname.endswith(".mp3"):
            path = os.path.join(AUDIO_CACHE_DIR, fname)
            parts = fname.replace(".mp3", "").split("_")
            entries.append({
                "filename": fname,
                "size_bytes": os.path.getsize(path),
                "created_at": int(os.path.getmtime(path) * 1000),
            })
    return entries
```

### 4. New API Endpoints (added to api/api.py)

Three new endpoints, appended to the bottom of `api/api.py`:

```python
# ── Audio Generation Endpoints ──

@app.post("/api/audio/generate")
async def generate_audio(
    owner: str = Query(...),
    repo: str = Query(...),
    page_id: str = Query(...),
    repo_type: str = Query("github"),
    language: str = Query("en"),
    tts_provider: str = Query("edge"),   # edge | google | openai
    voice: str = Query(None),            # provider-specific voice ID
):
    """Generate audio narration for a wiki page. Returns MP3.

    Uses cached audio if available. Otherwise generates, caches, and returns.
    """
    # 1. Load wiki page from cache
    wiki_cache = await read_wiki_cache(owner, repo, repo_type, language)
    if not wiki_cache:
        raise HTTPException(404, f"No wiki cache for {owner}/{repo}")

    page = wiki_cache.generated_pages.get(page_id)
    if not page:
        raise HTTPException(404, f"Page '{page_id}' not found")

    # 2. Check audio cache
    engine = get_engine(tts_provider)
    voice = voice or engine.DEFAULT_VOICE
    cache_key = get_cache_key(owner, repo, page_id, tts_provider, voice, language)

    cached_audio = read_cached(cache_key)
    if cached_audio:
        return Response(content=cached_audio, media_type="audio/mpeg",
                       headers={"X-Audio-Cached": "true"})

    # 3. Convert markdown to narration script
    script = markdown_to_script(page.title, page.content)

    # 4. Synthesize audio
    audio_data = await synthesize_long_text(engine, script, voice)

    # 5. Cache and return
    write_cache(cache_key, audio_data)
    return Response(content=audio_data, media_type="audio/mpeg",
                   headers={"X-Audio-Cached": "false"})


@app.get("/api/audio/status")
async def audio_status(
    owner: str = Query(...),
    repo: str = Query(...),
    repo_type: str = Query("github"),
    language: str = Query("en"),
):
    """Check which pages have cached audio for a repo."""
    wiki_cache = await read_wiki_cache(owner, repo, repo_type, language)
    if not wiki_cache:
        raise HTTPException(404, f"No wiki cache for {owner}/{repo}")

    page_status = {}
    for page_id, page in wiki_cache.generated_pages.items():
        # Check if any provider has cached audio
        has_audio = any(
            is_cached(get_cache_key(owner, repo, page_id, p, v, language))
            for p, v in [
                ("edge", EdgeTTSEngine.DEFAULT_VOICE),
                ("google", GoogleTTSEngine.DEFAULT_VOICE),
                ("openai", OpenAITTSEngine.DEFAULT_VOICE),
            ]
        )
        page_status[page_id] = {
            "title": page.title,
            "has_audio": has_audio,
        }

    return page_status


@app.get("/api/audio/voices")
async def list_voices(tts_provider: str = Query("edge")):
    """List available voices for a TTS provider."""
    engine = get_engine(tts_provider)
    return {"provider": tts_provider, "voices": engine.list_voices()}
```

---

## Frontend Implementation

### AudioPlayer.tsx

A compact player that sits next to or below the wiki page title. Design priorities: minimal, non-intrusive, functional.

```
┌─────────────────────────────────────────────┐
│ 🔊  ▶ ━━━━━━━━━━━━━━━━━━━━━━ 3:24 / 12:15 │
│     0.5x  1x  1.5x  2x     ⬇ Download      │
└─────────────────────────────────────────────┘
```

**Component features:**
- Play/pause toggle
- Progress bar with seek
- Current time / total duration
- Speed control (0.75x, 1x, 1.25x, 1.5x, 2x)
- Download button
- Loading state with spinner during generation
- Error state if generation fails
- "Generate Audio" button if no cached audio exists

**Props interface:**
```typescript
interface AudioPlayerProps {
  owner: string;
  repo: string;
  pageId: string;
  pageTitle: string;
  repoType?: string;
  language?: string;
}
```

**Integration point in page.tsx:**
Place the AudioPlayer inside the article header, below the page title, next to the importance badge. This is around line ~2382-2390 in `src/app/[owner]/[repo]/page.tsx`.

---

## Implementation Order

### Step 1: Backend (api/audio/) — Day 1-2

1. Create `api/audio/__init__.py`
2. Create `api/audio/script_converter.py` — markdown → narration
3. Create `api/audio/tts_engine.py` — Edge TTS engine (start with just Edge)
4. Create `api/audio/cache.py` — MP3 file caching
5. Add `edge-tts` to `api/pyproject.toml`
6. Add 3 endpoints to `api/api.py`
7. Test: `curl "localhost:8001/api/audio/generate?owner=rtyley&repo=small-test-repo&page_id=<id>"` should return MP3

### Step 2: Frontend (AudioPlayer.tsx) — Day 3-4

1. Create `src/components/AudioPlayer.tsx`
2. Add AudioPlayer to wiki page view (`page.tsx`)
3. Add "Listen" button that triggers generation if no cache
4. Play cached audio immediately if available

### Step 3: Polish — Day 5

1. Add TTS provider selection (Edge/Google/OpenAI dropdown)
2. Add voice selection
3. Add speed control persistence (localStorage)
4. Error handling for all edge cases
5. Loading states

### Step 4: Docker & Volume — Day 5

1. Add `~/.adalflow/audio` to volume mount in docker-compose.yml
2. Test in Docker container
3. Ensure `edge-tts` works inside the container (needs network)

---

## What's NOT in Scope

| Feature | Why Deferred |
|---|---|
| **NotebookLM-style podcast (two voices conversing)** | Requires LLM to generate a conversation script first, then two TTS voices. Cool but complex — do it as v2 after single-voice narration works. |
| **Full wiki narration (all pages as one audio)** | Concatenating all pages is simple once single-page works. Add later as "Download Full Wiki Audio" button. |
| **Waveform visualization** | Nice but not necessary for v1. A simple progress bar is sufficient. |
| **Real-time streaming** | Edge TTS supports streaming, but caching the full MP3 is simpler and the result is reusable. |
| **LLM-enhanced script** | Using the LLM to rewrite markdown into a more natural narration script (expanding abbreviations, adding transitions). Good idea for v2 — for now, regex-based conversion is good enough. |

---

## Dependency Changes

### api/pyproject.toml — Add one line:

```toml
edge-tts = ">=7.0.0"
```

That's the only new dependency for the default (free) provider.

For Google Cloud TTS (optional): `google-cloud-texttospeech = ">=2.14.0"`
For OpenAI TTS: already installed (`openai` package).

### Docker volume — Add to docker-compose.yml:

```yaml
volumes:
  - ~/.adalflow:/root/.adalflow    # Already exists — includes audio/ subdir
```

No change needed — audio files go into `~/.adalflow/audio/` which is already inside the mounted volume.

---

## Cost Summary

| Scenario | Edge TTS | Google WaveNet | OpenAI tts-1 |
|---|---|---|---|
| 1 page (15K chars narration) | $0 | $0.24 | $0.23 |
| Full wiki (5 pages, ~75K chars) | $0 | $1.20 | $1.13 |
| 100 wikis/month (heavy usage) | $0 | $120 | $113 |
| 100 wikis/month under Google free tier | $0 | ~$0.80* | N/A |

*Google gives 1M free WaveNet chars/month. 100 wikis at 75K = 7.5M chars, so only 6.5M is billed.

**Bottom line: Edge TTS makes this feature essentially free to run.** Google/OpenAI are upgrade paths for users who want premium voices.

---

## Sources

- [Google Cloud TTS Pricing](https://cloud.google.com/text-to-speech/pricing)
- [Google Cloud TTS Overview](https://cloud.google.com/text-to-speech)
- [edge-tts on PyPI](https://pypi.org/project/edge-tts/)
- [edge-tts GitHub](https://github.com/rany2/edge-tts)
- [OpenAI TTS Pricing](https://platform.openai.com/docs/pricing)
- [OpenAI TTS API Pricing Calculator](https://costgoat.com/pricing/openai-tts)
- [Google Cloud TTS Review (VideoSDK)](https://www.videosdk.live/developer-hub/tts/google-text-to-speech-review)
- [Google Cloud TTS Long Audio Synthesis](https://cloud.google.com/python/docs/reference/texttospeech/latest/google.cloud.texttospeech_v1.services.text_to_speech_long_audio_synthesize.TextToSpeechLongAudioSynthesizeClient)
