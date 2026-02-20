# BetterCodeWiki — Current Capabilities & Technical Documentation

> Technical reference for what has been built, how it works, and the approaches used.
> Last updated: February 2026

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Frontend Stack](#frontend-stack)
3. [Backend Stack](#backend-stack)
4. [AI & LLM Integration](#ai--llm-integration)
5. [RAG Pipeline](#rag-pipeline)
6. [Feature Inventory](#feature-inventory)
7. [3D Landing Page & Animations](#3d-landing-page--animations)
8. [Internationalization](#internationalization)
9. [Infrastructure & Deployment](#infrastructure--deployment)
10. [Performance Optimizations](#performance-optimizations)

---

## Architecture Overview

BetterCodeWiki is a two-service system: a **Next.js 15 frontend** and a **FastAPI backend** running in a single Docker container. The frontend handles all user interaction — repository input, wiki navigation, search, export, chat — and communicates with the backend over HTTP REST endpoints and WebSocket connections.

```
┌─────────────────────────────────────────────────────┐
│                   Docker Container                   │
│                                                      │
│  ┌──────────────────┐     ┌───────────────────────┐ │
│  │  Next.js 15      │     │  FastAPI (Python 3.11) │ │
│  │  Port 3000       │────▶│  Port 8001             │ │
│  │                  │ REST│                         │ │
│  │  React 19        │  +  │  RAG Engine (adalflow) │ │
│  │  Three.js        │  WS │  FAISS Vector Index    │ │
│  │  Framer Motion   │     │  Multi-LLM Clients     │ │
│  └──────────────────┘     └───────────────────────┘ │
│                                                      │
│  Volume: ~/.adalflow (embeddings + repo cache)       │
└─────────────────────────────────────────────────────┘
```

**Data flow**: User submits a repository URL → backend clones the repo (shallow, `--depth=1`) → files are filtered, chunked, and embedded → embeddings are stored in a FAISS index → the frontend renders the generated wiki structure → user queries go through WebSocket → RAG retrieval feeds context to the LLM → streamed response is rendered as markdown.

---

## Frontend Stack

### Core Technologies

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15.3.1 | App Router, SSR, API routes, standalone output |
| React | 19 | Component rendering, hooks-based state |
| TypeScript | Full coverage | Type safety across all components |
| Tailwind CSS | v4 | Utility-first styling, dark mode support |
| Framer Motion | 12.34.3 | Page transitions, scroll animations, hover effects |
| Three.js | 0.183.1 | 3D landing page (Knowledge Cube, Particle Field) |
| @react-three/fiber | 9.5.0 | React renderer for Three.js |
| @react-three/drei | 10.7.7 | Three.js helpers (environment, orbit controls) |
| next-intl | 4.1.0 | i18n with 10 language support |
| mermaid | 11.4.1 | Architecture & flow diagrams |
| react-markdown | 10.1.0 | Markdown rendering with rehype-raw, remark-gfm |
| react-syntax-highlighter | 15.6.1 | Code block highlighting |
| svg-pan-zoom | 3.6.2 | Interactive diagram pan/zoom |
| next-themes | 0.4.6 | Light/dark theme switching with system detection |
| jszip + file-saver | 3.10.1 / 2.0.5 | ZIP export generation |

### Component Architecture

```
src/
├── app/
│   ├── page.tsx                         # Landing page (3D Hero + sections)
│   ├── layout.tsx                       # Root layout, fonts, metadata
│   ├── globals.css                      # Global styles + Tailwind
│   ├── [owner]/[repo]/
│   │   ├── page.tsx                     # Wiki viewer (main feature)
│   │   ├── slides/page.tsx              # Presentation/slides view
│   │   └── workshop/page.tsx            # Workshop mode
│   ├── wiki/projects/page.tsx           # Cached project browser
│   └── api/                             # Next.js proxy routes
│       ├── auth/                        # Auth status + validation
│       ├── chat/stream/                 # Chat streaming proxy
│       ├── models/config/               # Model configuration
│       └── wiki/projects/               # Project management
│
├── components/
│   ├── landing/
│   │   ├── Hero3D.tsx                   # Three.js canvas + animated hero
│   │   ├── KnowledgeCube.tsx            # 3D rotating cube with mouse tracking
│   │   ├── ParticleField.tsx            # Floating particle animation
│   │   ├── HowItWorks.tsx              # 3-step workflow section
│   │   ├── FeatureCards.tsx             # Feature showcase grid
│   │   ├── ComparisonTable.tsx          # vs closed-source tools
│   │   ├── CommunitySection.tsx         # GitHub stats + CTAs
│   │   └── FooterCTA.tsx               # Bottom call-to-action
│   │
│   ├── Ask.tsx                          # Chat/Q&A with deep research mode
│   ├── ConfigurationModal.tsx           # 3-step stepper for wiki config
│   ├── ModelSelectionModal.tsx          # AI model picker (provider + model)
│   ├── SearchCommand.tsx                # Global search command palette (Cmd+K)
│   ├── TableOfContents.tsx              # Floating TOC with scroll-spy
│   ├── ExportMenu.tsx                   # Export to 5 formats
│   ├── DependencyGraph.tsx              # Force-directed relationship graph
│   ├── WikiTreeView.tsx                 # Hierarchical page tree sidebar
│   ├── WikiTypeSelector.tsx             # Comprehensive vs Quick toggle
│   ├── Mermaid.tsx                      # Mermaid renderer with custom themes
│   ├── Markdown.tsx                     # Markdown renderer with code highlighting
│   ├── RepoMetadata.tsx                 # Repository info card
│   ├── ProcessedProjects.tsx            # Previously generated wikis grid
│   ├── UserSelector.tsx                 # Platform selector (GitHub/GitLab/Bitbucket)
│   ├── TokenInput.tsx                   # Private repo access token input
│   └── theme-toggle.tsx                 # Light/dark mode toggle
│
├── contexts/
│   └── LanguageContext.tsx              # Global language state provider
│
├── hooks/
│   └── useProcessedProjects.ts          # Project list management hook
│
├── types/
│   ├── repoinfo.tsx                     # Repository info type definitions
│   └── wiki/
│       ├── wikipage.tsx                 # Wiki page structure types
│       └── wikistructure.tsx            # Wiki hierarchy types
│
├── utils/
│   ├── websocketClient.ts              # WebSocket client for chat
│   ├── urlDecoder.tsx                   # URL parsing utilities
│   └── getRepoUrl.tsx                   # Repository URL generation
│
├── messages/                            # 10 locale files (en, ja, zh, etc.)
└── i18n.ts                              # next-intl configuration
```

### Key Design Decisions

- **App Router over Pages Router**: Uses Next.js App Router with `use client` boundaries for components that need browser APIs (Three.js, WebSocket, localStorage).
- **Dynamic imports for Three.js**: The 3D canvas is loaded with `next/dynamic` and `ssr: false` to avoid server-side rendering issues with WebGL.
- **Proxy API routes**: Next.js API routes (`src/app/api/`) proxy requests to the FastAPI backend, keeping the backend URL internal to the container.
- **State in hooks, not global store**: No Redux/Zustand — state lives in React hooks and context providers. The wiki page component manages its own state for page selection, search, export, etc.

---

## Backend Stack

### Core Technologies

| Technology | Purpose |
|---|---|
| FastAPI | Async HTTP + WebSocket server |
| Python 3.11 | Runtime |
| adalflow | RAG framework — document processing, embedding, retrieval |
| FAISS | Vector similarity search index |
| subprocess + git CLI | Repository cloning |
| requests | HTTP client for LLM API calls |

### Directory Structure

```
api/
├── main.py                    # Entry point
├── api.py                     # Route definitions + FastAPI app
├── websocket_wiki.py          # WebSocket handler for chat
├── config.py                  # Configuration management
├── data_pipeline.py           # Repo cloning + document processing
├── rag.py                     # RAG system (retriever + generator)
├── prompts.py                 # LLM prompt templates
├── simple_chat.py             # Simple chat endpoint
├── logging_config.py          # Log configuration
├── ollama_patch.py            # Ollama-specific patches
├── tools/
│   └── embedder.py            # Embedding model factory
├── LLM Clients:
│   ├── openai_client.py
│   ├── openrouter_client.py
│   ├── bedrock_client.py
│   ├── azureai_client.py
│   ├── dashscope_client.py
│   └── google_embedder_client.py
└── config/
    ├── generator.json          # LLM provider configs
    ├── embedder.json           # Embedding model configs
    ├── repo.json               # Default file filters
    └── lang.json               # Language settings
```

### API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/lang/config` | Language configuration |
| `GET` | `/auth/status` | Auth requirement check |
| `POST` | `/auth/validate` | Authorization code validation |
| `GET` | `/models/config` | Available providers and models |
| `GET` | `/api/processed_projects` | List cached wiki projects |
| `DELETE` | `/api/wiki_cache` | Clear project cache |
| `WS` | `/ws/chat` | WebSocket for streaming chat |

---

## AI & LLM Integration

### Supported Providers & Models

BetterCodeWiki uses an **adapter pattern** — each LLM provider has its own client implementation that conforms to a shared interface. The provider and model are selected per-request by the user.

#### Google Gemini (Default)
- `gemini-2.5-flash` (default), `gemini-2.5-flash-lite`, `gemini-2.5-pro`
- Custom model support enabled

#### OpenAI
- `gpt-5`, `gpt-5-nano`, `gpt-5-mini`, `gpt-4o`, `gpt-4.1`
- Reasoning models: `o1`, `o3`, `o4-mini`
- Custom model support enabled

#### OpenRouter (Multi-provider Aggregator)
- Routes to OpenAI, Deepseek (`deepseek-r1`), Anthropic Claude (`3.7-sonnet`, `3.5-sonnet`)
- Custom model support enabled

#### Ollama (Local/Self-hosted)
- `qwen3:1.7b` (default), `llama3:8b`, `qwen3:8b`
- Configurable context window sizes
- Custom model support enabled

#### AWS Bedrock
- Anthropic Claude (Sonnet, Haiku, Opus), Amazon Titan, Cohere Command R, AI21 J2

#### Azure OpenAI
- `gpt-4o`, `gpt-4`, `gpt-35-turbo`, `gpt-4-turbo`

#### Alibaba Dashscope
- `qwen-plus`, `qwen-turbo`, `deepseek-r1`

### Embedding Systems

| Provider | Model | Dimensions | Batch Size |
|---|---|---|---|
| OpenAI (default) | `text-embedding-3-small` | 256 | — |
| Google | `gemini-embedding-001` | — | 100 |
| Ollama | `nomic-embed-text` | — | — |
| AWS Bedrock | `amazon.titan-embed-text-v2:0` | 256 | 100 |

The embedding provider is selected via the `DEEPWIKI_EMBEDDER_TYPE` environment variable.

---

## RAG Pipeline

The retrieval-augmented generation pipeline is the core of wiki generation and the Ask feature. Here's the step-by-step flow:

### 1. Repository Ingestion
```
User Input (URL/path)
  → Platform detection (GitHub/GitLab/Bitbucket/local)
  → Shallow clone (git clone --depth=1)
  → Private repo support via access tokens
```

### 2. Document Processing
```
Cloned Repository
  → File filtering (exclude: node_modules, .git, builds, locks, binaries)
  → Custom include/exclude patterns (user-configured)
  → Text extraction from source files
```

### 3. Text Chunking
```
Raw Text
  → Split by word strategy
  → Chunk size: 350 tokens
  → Chunk overlap: 100 tokens
  → Max input: 7,500 tokens (safe limit below 8,192)
```

### 4. Embedding & Indexing
```
Text Chunks
  → Batch embedding (provider-specific batch sizes)
  → FAISS vector index creation
  → Persistent storage in ~/.adalflow
```

### 5. Retrieval
```
User Query
  → Query embedding
  → FAISS similarity search (top-K: 20 results)
  → Context assembly from retrieved chunks
```

### 6. Generation
```
Retrieved Context + User Query
  → RAG prompt template assembly
  → LLM API call (selected provider/model)
  → Streaming response via WebSocket
  → Markdown rendering on frontend
```

### Caching Strategy
- **Embedding cache**: Stored in `~/.adalflow` volume mount, persists across container restarts
- **Wiki structure cache**: JSON-based, accessible via `/api/processed_projects`
- **Configuration cache**: `localStorage` on the frontend for user preferences (language, model, filters)

---

## Feature Inventory

### Wiki Generation

| Feature | Description | Approach |
|---|---|---|
| **Comprehensive Wiki** | Detailed multi-page documentation with structured chapters | Full RAG pipeline with extended prompt templates |
| **Quick Wiki** | Condensed overview with fewer pages | Reduced page count, focused prompts |
| **Auto-structured Hierarchy** | Pages organized in logical tree structure | LLM determines optimal page grouping |
| **Related Pages** | Cross-references between wiki pages | Extracted from wiki structure metadata |
| **Related Files** | Source files associated with each page | Mapped during document processing |
| **Page Importance** | High/medium/low indicators per page | LLM-assigned based on code significance |

### Navigation & Search

| Feature | Description | Approach |
|---|---|---|
| **WikiTreeView** | Hierarchical sidebar with expand/collapse | Recursive tree component, state-managed expansion |
| **Global Search (Cmd+K)** | Command palette searching all wiki content | Full-text search across page titles and content, match highlighting |
| **Floating Table of Contents** | Sticky TOC with scroll-spy | Parses heading elements, IntersectionObserver for active tracking |
| **Breadcrumb Navigation** | Path-based navigation context | Derived from tree hierarchy |

### Visualization

| Feature | Description | Approach |
|---|---|---|
| **Mermaid Diagrams** | Auto-generated architecture diagrams | LLM produces Mermaid syntax, rendered with custom color themes |
| **Diagram Types** | Flowcharts, sequence, state, class diagrams | Mermaid v11.4.1 with multiple diagram type support |
| **Pan/Zoom** | Interactive diagram exploration | svg-pan-zoom library on rendered SVGs |
| **Custom Theme Engine** | Multi-color node palette, light/dark variants | Custom Mermaid theme configuration with 8+ node colors |
| **Dependency Graph** | Force-directed graph of page relationships | Canvas-based force simulation, importance-based node sizing |

### Chat & Research

| Feature | Description | Approach |
|---|---|---|
| **Ask (Q&A)** | Natural language questions about the repository | WebSocket streaming, RAG-enhanced context |
| **Deep Research** | Multi-iteration analysis for complex questions | Iterative LLM calls with plan → update → conclusion stages |
| **Research Navigation** | Browse through research stages | Stage-by-stage UI with back/forward navigation |
| **Model Switching** | Change AI model mid-conversation | ModelSelectionModal with provider/model picker |
| **Conversation Memory** | Context maintained across turns | Chat history passed to LLM with each query |

### Export

| Feature | Description |
|---|---|
| **Markdown** | GitHub-flavored markdown with full wiki structure |
| **JSON** | Complete wiki data as structured JSON |
| **Confluence** | Confluence Wiki markup format |
| **HTML** | Self-contained HTML with embedded styles |
| **ZIP** | Compressed archive of all documents |

### Configuration

| Feature | Description | Approach |
|---|---|---|
| **3-Step Stepper Modal** | Guided wiki configuration | Step 1: Wiki settings → Step 2: Model & filters → Step 3: Access & auth |
| **Model Provider Selection** | Choose AI provider and specific model | Dropdown with provider-grouped model lists |
| **File Filters** | Include/exclude directories and file patterns | Custom textarea inputs + sensible defaults |
| **Private Repo Support** | Access tokens for GitHub/GitLab/Bitbucket | In-memory token handling (never persisted) |
| **Authorization Code** | Optional auth gating for wiki generation | Server-side validation via `/auth/validate` |

### User Experience

| Feature | Description | Approach |
|---|---|---|
| **Dark/Light Theme** | Full theme support with system detection | next-themes with CSS variables, localStorage persistence |
| **Project History** | Browse previously generated wikis | Server-side cache + REST API, grid view with search |
| **Reading Mode** | Distraction-free wiki reading | UI toggle for simplified layout |
| **Responsive Design** | Mobile-first adaptive layouts | Tailwind breakpoints, mobile fallbacks for 3D |
| **Reduced Motion** | Accessibility for motion-sensitive users | `prefers-reduced-motion` media query checks |

---

## 3D Landing Page & Animations

### Three.js Implementation

The landing page features an immersive 3D experience built with Three.js via React Three Fiber:

**KnowledgeCube** (`src/components/landing/KnowledgeCube.tsx`):
- Rotating 3D geometry that responds to mouse position
- Smooth interpolation for natural movement
- Ambient and point light setup for depth

**ParticleField** (`src/components/landing/ParticleField.tsx`):
- Animated floating particles for atmosphere
- Performance-optimized with instanced rendering

**Hero3D** (`src/components/landing/Hero3D.tsx`):
- Three.js canvas with environment preset ("city")
- Gradient text effect (primary → blue → cyan)
- Animated search form with quick-start examples
- Social proof badges
- Scroll indicator

**Mobile Fallback**: On mobile devices or when `prefers-reduced-motion` is set, the 3D canvas is replaced with a static SVG hexagon. Detection happens client-side to avoid SSR hydration mismatches.

**Dynamic Import**: Three.js is loaded via `next/dynamic` with `ssr: false`:
```typescript
const Hero3D = dynamic(() => import('@/components/landing/Hero3D'), { ssr: false });
```

### Framer Motion Patterns

Animations are implemented with consistent patterns across the app:

**Scroll-triggered entrance**:
```typescript
<motion.div
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.5 }}
>
```

**Staggered children**:
```typescript
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5 }
  })
};
```

**Hover interactions**: `whileHover` for scale, shadow, and color changes on interactive elements.

### Landing Page Sections

1. **Hero3D**: 3D canvas + animated headline + search form
2. **HowItWorks**: 3-step workflow with numbered cards
3. **FeatureCards**: 2x2 feature grid with hover effects
4. **ComparisonTable**: BetterCodeWiki vs closed-source alternatives
5. **CommunitySection**: GitHub star count, contributor stats, animated counters
6. **FooterCTA**: Final call-to-action
7. **Demo Diagrams**: Interactive Mermaid flowchart + sequence diagram examples

---

## Internationalization

### Supported Languages

| Code | Language | File |
|---|---|---|
| `en` | English | `src/messages/en.json` |
| `ja` | Japanese (日本語) | `src/messages/ja.json` |
| `zh` | Simplified Chinese (中文) | `src/messages/zh.json` |
| `zh-tw` | Traditional Chinese (繁體中文) | `src/messages/zh-tw.json` |
| `es` | Spanish (Español) | `src/messages/es.json` |
| `kr` | Korean (한국어) | `src/messages/kr.json` |
| `vi` | Vietnamese (Tiếng Việt) | `src/messages/vi.json` |
| `pt-br` | Brazilian Portuguese | `src/messages/pt-br.json` |
| `fr` | French (Français) | `src/messages/fr.json` |
| `ru` | Russian (Русский) | `src/messages/ru.json` |

### Implementation

- **Library**: next-intl v4.1.0
- **Language detection**: Browser `Accept-Language` header with fallback to `en`
- **Persistence**: Selected language stored in `localStorage`
- **Switching**: Dynamic message loading without page reload
- **HTML sync**: `lang` attribute on `<html>` updates with language changes
- **Coverage**: All UI strings externalized — form labels, error messages, navigation, tooltips

### Translation Structure

Each locale file covers these namespaces:
- `common` — App name, generic actions (submit, cancel, close)
- `loading` — Processing states
- `home` — Landing page content
- `form` — Wiki configuration form labels and descriptions
- `footer` — Copyright text
- `ask` — Chat/Q&A interface
- `repoPage` — Wiki viewer page
- `nav` — Navigation items
- `projects` — Project list page

---

## Infrastructure & Deployment

### Docker Configuration

**Multi-stage build** (3 stages):

| Stage | Base Image | Purpose |
|---|---|---|
| 1 | `node:20-alpine` | Install npm dependencies, build Next.js |
| 2 | `python:3.11-slim` | Install Python dependencies via Poetry |
| 3 | Combined | Final image with both Node and Python runtimes |

**Resource limits**:
```yaml
deploy:
  resources:
    limits:
      memory: 6G
    reservations:
      memory: 2G
```

**Health check**:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 60s
  timeout: 10s
  retries: 3
  start_period: 30s
```

**Volume mounts**:
- `~/.adalflow:/root/.adalflow` — Embedding cache, repo data (persists across restarts)
- `./api/logs:/app/api/logs` — Application logs

**Ports**: 3000 (Next.js), 8001 (FastAPI)

### Environment Variables

```bash
# Required
GOOGLE_API_KEY=                    # Default LLM provider

# Optional LLM providers
OPENAI_API_KEY=
OPENROUTER_API_KEY=

# Embedding provider selection
DEEPWIKI_EMBEDDER_TYPE=google      # google | openai | ollama | bedrock

# Authentication (optional)
DEEPWIKI_AUTH_MODE=False
DEEPWIKI_AUTH_CODE=

# AWS Bedrock (if using)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# Azure OpenAI (if using)
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=

# Deployment
PORT=8001
NODE_ENV=production
SERVER_BASE_URL=http://localhost:8001
```

### Startup

A single `start.sh` script launches both services:
1. FastAPI starts on port 8001 (background process)
2. Next.js starts on port 3000 (foreground process)

### Development

- **Frontend**: `npm run dev` with Turbopack for fast HMR
- **Backend**: Python with watchfiles for auto-reload
- **Full stack**: `docker compose up --build`

---

## Performance Optimizations

### Frontend

| Optimization | Approach |
|---|---|
| **Code splitting** | Dynamic imports for Three.js, heavy components |
| **Tree shaking** | Webpack eliminates unused code paths |
| **Font loading** | Google Fonts with `display: swap` |
| **CSS purging** | Tailwind removes unused utility classes |
| **Image optimization** | Next.js `<Image>` with automatic format/size |
| **SSR boundaries** | `use client` only where needed (browser APIs) |
| **Standalone output** | Next.js standalone build for minimal production image |

### Backend

| Optimization | Approach |
|---|---|
| **Shallow clone** | `git clone --depth=1` — only latest commit |
| **Batch embedding** | Configurable batch sizes (100-500 documents) |
| **Token limiting** | 7,500 token max per chunk (safe below 8,192 limit) |
| **FAISS indexing** | Optimized vector similarity search |
| **Persistent cache** | Embeddings and wiki structures survive restarts |
| **Async I/O** | FastAPI async endpoints for concurrent request handling |

### Memory Management

| Setting | Value |
|---|---|
| Container memory limit | 6 GB |
| Container memory reservation | 2 GB |
| Node.js build heap | 4 GB (`NODE_OPTIONS=--max-old-space-size=4096`) |

---

## Credits

BetterCodeWiki is originally based on [DeepWiki-Open](https://github.com/AsyncFuncAI/deepwiki-open) by AsyncFuncAI (MIT License). It has been extended with a 3D landing page, enhanced Mermaid diagram theming, dependency graph visualization, global search, reading mode, multi-format export, Framer Motion animations, and additional UI/UX improvements.
