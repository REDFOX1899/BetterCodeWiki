# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

BetterCodeWiki auto-generates interactive wikis for GitHub/GitLab/Bitbucket repos. It's a fork of DeepWiki-Open with an overhauled UI, 3D landing page, enhanced diagrams, MCP server, and multi-provider AI support.

## Commands

### Frontend (Next.js 15 + React 19)
```bash
yarn install          # install deps (yarn 1.x — enforced via packageManager)
yarn dev              # dev server on :3000 (turbopack)
yarn build            # production build
yarn lint             # eslint (next/core-web-vitals + next/typescript)
```

### Backend (Python — FastAPI)
```bash
python -m pip install poetry==2.0.1 && poetry install -C api
python -m api.main    # API server on :8001
```

### Tests (pytest)
```bash
pytest test/                         # all tests (testpaths = test/)
pytest test/test_extract_repo_name.py  # single test file
pytest -m unit                       # by marker: unit, integration, slow, network
```
There's also a `tests/` directory with api/unit/integration subdirs — these are run via `python tests/run_tests.py` or by pointing pytest at them directly.

### Docker
```bash
docker-compose up     # runs everything (frontend :3000, API :8001, MCP :8008)
```

### MCP Server (standalone)
```bash
python api/mcp/server.py           # stdio mode (Claude Desktop/Code)
python api/mcp/server.py --http    # HTTP mode on :8008
mcp dev api/mcp/server.py          # browser-based inspector
```

## Architecture

### Two-process system
- **Frontend**: Next.js app in `src/`. Proxies API calls to the backend via `next.config.ts` rewrites (routes like `/api/wiki_cache/*`, `/export/wiki/*`, `/api/auth/*`).
- **Backend**: FastAPI app in `api/api.py`, entry point `api/main.py`. Handles repo cloning, embedding, wiki generation, RAG chat, and export.

### Wiki generation flow
1. User submits a repo URL on the landing page (`src/app/page.tsx`)
2. Frontend navigates to `src/app/[owner]/[repo]/page.tsx` — the main wiki viewer
3. Backend clones the repo, creates embeddings via adalflow + FAISS, generates wiki pages using the configured AI provider
4. Wiki data is cached in `~/.adalflow/wikicache/` and served back as JSON

### Real-time communication
- **WebSocket** (`/ws/chat`): Used for Ask/chat and DeepResearch features. Client in `src/utils/websocketClient.ts`, server handler in `api/websocket_wiki.py`.
- Wiki generation itself streams via the same WebSocket infrastructure.

### AI provider abstraction
The backend supports multiple providers through client wrappers in `api/`:
- `api/config.py` — loads API keys from env, reads JSON configs from `api/config/`
- Each provider has its own client: `openai_client.py`, `openrouter_client.py`, `azureai_client.py`, `bedrock_client.py`, `dashscope_client.py`
- Google Gemini uses adalflow's `GoogleGenAIClient` directly
- Ollama uses adalflow's `OllamaClient` with patches in `ollama_patch.py`
- Embeddings: configurable via `DEEPWIKI_EMBEDDER_TYPE` env var; implementation in `api/tools/embedder.py`

### RAG pipeline
`api/rag.py` implements retrieval-augmented generation using adalflow. Prompts live in `api/prompts.py`. The data pipeline (`api/data_pipeline.py`) handles repo file processing and token counting.

### Frontend routing
- `/` — Landing page with 3D hero (Three.js via `@react-three/fiber`, dynamically imported to avoid SSR)
- `/[owner]/[repo]` — Wiki viewer (main app surface)
- `/[owner]/[repo]/slides` — Presentation mode
- `/[owner]/[repo]/workshop` — Workshop mode
- `/wiki/projects` — Cached project browser

### Key frontend patterns
- **Theming**: `next-themes` with `darkMode: 'selector'` in Tailwind. Theme toggle in `src/components/theme-toggle.tsx`.
- **i18n**: `src/contexts/LanguageContext.tsx` wraps the app. Translations in `src/messages/{locale}.json` (en, ja, zh, es, kr, vi, pt-br, ru, fr, zh-tw). Manual `t()` function in page components, not next-intl's `useTranslations`.
- **Animations**: GSAP + Framer Motion. GSAP registered in `src/lib/gsap.ts`. Smooth scroll via Lenis (`src/lib/smooth-scroll.ts`).
- **Mermaid diagrams**: Custom renderer in `src/components/Mermaid.tsx` with fullscreen expand, SVG pan-zoom, and theme-aware styling.
- **Path alias**: `@/*` maps to `./src/*`

### MCP server
`api/mcp/server.py` is fully standalone — no imports from the main codebase. Reads cached wikis from `~/.adalflow/wikicache/`. Provides 5 tools: `list_projects`, `get_wiki_overview`, `get_wiki_page`, `search_wiki`, `ask_codebase`.

## Environment

Required env vars depend on which AI provider you use. At minimum set `GOOGLE_API_KEY` or `OPENAI_API_KEY` in `.env` at project root. See README for the full table. The backend defaults to `http://localhost:8001`; override with `SERVER_BASE_URL`.
