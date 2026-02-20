# BetterCodeWiki: Phase 3+ Development Plan

**Date:** February 2026
**Status:** Strategic Development Roadmap
**Scope:** Phases 3 through 6 (Months 1-18)
**Audience:** Founding team, engineering leads, investors
**Builds on:** PRODUCT_STRATEGY.md (Phases 1-2 complete), LANDING_PAGE_PLAN.md, COMPETITOR_LANDING_ANALYSIS.md

---

## 1. Executive Summary

BetterCodeWiki has completed its foundational phases: a redesigned UI with 3D landing page, Ask AI, dependency graphs, global search, multi-format export, and reading mode. The product is a compelling single-player web application. **The next 18 months must transform it from a web tool into a platform -- one that lives inside developers' workflows, enables team collaboration, and builds network effects that create an uncatchable lead.**

The thesis for Phase 3+ is:

> **The winner in AI code understanding will be the tool that becomes ambient -- always present in the IDE, always current with the code, always improving from team knowledge. BetterCodeWiki must go from "a place you visit" to "a layer that surrounds your code."**

The plan is structured in four phases:

| Phase | Timeline | Theme | Key Outcome |
|-------|----------|-------|-------------|
| Phase 3 | Months 1-3 | IDE & Real-Time | VS Code extension + GitHub App + live docs |
| Phase 4 | Months 3-6 | Collaboration & Teams | Multi-user workspaces, real-time editing, integrations |
| Phase 5 | Months 6-12 | Platform & Ecosystem | Plugin marketplace, API platform, enterprise |
| Phase 6 | Months 12-18 | Market Domination | Network effects, verticals, international, acquisitions |

**Revenue target:** $0 -> $50K MRR (Month 6) -> $250K MRR (Month 12) -> $1M+ MRR (Month 18)

**Core conviction:** GitHub Copilot proved developers will pay $20/month for AI that saves time in the IDE. Cursor proved they will pay $20/month for a better AI-IDE experience. BetterCodeWiki will prove they will pay $19-29/month for AI that eliminates the 60% of developer time spent *reading and understanding* code.

---

## 2. Market Intelligence

### 2.1 Developer Tools Market (2025-2026)

**Market size and growth:**
- The global developer tools market reached approximately $22-24 billion in 2025, growing at 18-22% CAGR.
- AI-powered developer tools specifically are growing at 25-40% CAGR, the fastest-growing sub-segment.
- Code understanding and documentation tools represent an estimated $500M-$1B sub-segment, projected to reach $2-3B by 2028.

**Key market shifts observed in 2025:**
1. **AI moved from "assistant" to "agent."** GitHub Copilot Workspace, Cursor Composer, Claude Code, and Devin showed that AI is moving from suggesting code snippets to executing multi-step development tasks autonomously. Documentation generation fits naturally into this agent paradigm.
2. **IDE-first became mandatory.** The success of Cursor (which reached $100M+ ARR by late 2025) and the growth of Continue.dev (20K+ GitHub stars, 500K+ VS Code installs) proved that developer tools must live in the IDE. Web-only tools are increasingly seen as friction.
3. **RAG for code matured.** Retrieval-augmented generation for codebases -- using vector embeddings of code files for context-aware AI responses -- moved from experimental to production-ready. BetterCodeWiki's existing FAISS-based RAG system (in `api/rag.py`) is a strong foundation, but competitors are adopting more sophisticated chunking strategies (AST-aware, semantic), re-ranking models, and hybrid search.
4. **Multi-modal AI became real.** Claude 3.5, GPT-4o, and Gemini 1.5/2.0 can now process images, diagrams, and code simultaneously. This unlocks analyzing architecture diagrams, Figma designs, and whiteboard photos alongside code -- a feature no competitor offers yet.
5. **Enterprise AI governance emerged.** Large organizations now require audit trails for AI interactions, data residency controls, and model selection policies. BetterCodeWiki's multi-provider architecture and self-hosting option are perfectly positioned for this.

### 2.2 IDE Extension Landscape

**How successful IDE extensions work:**

| Extension | Architecture | Key Pattern | Stars/Installs |
|-----------|-------------|-------------|----------------|
| **GitHub Copilot** | Cloud-only; thin VS Code client sends context to GitHub servers; inline completions via ghost text | Language Server Protocol (LSP) for deep editor integration; sidebar chat panel for Q&A | 15M+ installs |
| **Cursor** | Forked VS Code entirely; custom AI pipeline replaces built-in features; Composer for multi-file edits | Full IDE fork gives maximum control but limits distribution to Cursor users only | 2M+ users |
| **Continue.dev** | Open-source VS Code/JetBrains extension; connects to any LLM provider; sidebar chat + inline edits | Extension-only approach (no fork); modular provider system; local model support via Ollama | 20K+ stars, 500K+ installs |
| **Cody (Sourcegraph)** | VS Code extension + web app; uses Sourcegraph's code graph for context; chat + autocomplete + commands | Combines code search index with LLM; "codebase-aware" context through pre-indexed code graph | 10K+ stars |
| **Mintlify Doc Writer** | VS Code extension that generates docstrings for functions; lightweight, single-purpose | Simple, focused value prop; generates JSDoc/docstring on command; no sidebar, no chat | 500K+ installs |

**Critical lesson:** The most successful extensions combine (a) a sidebar panel for exploration/chat, (b) inline editor integration (hover tooltips, code actions), and (c) a connection to a cloud backend that provides the heavy computation. BetterCodeWiki should follow Continue.dev's open architecture rather than Cursor's fork approach.

### 2.3 AI Capabilities for Code Understanding (State of the Art)

**What is now possible that was not possible 12 months ago:**

1. **1M+ token context windows.** Gemini 1.5 Pro (2M tokens) and Claude 3.5 (200K tokens, with retrieval) can now ingest entire medium-sized codebases in a single prompt. This changes the architecture: instead of chunking + RAG for small repos, we can do full-context analysis. RAG remains essential for large repos (>500 files) but the threshold has moved dramatically.

2. **AST-aware code embeddings.** Research from Microsoft (CodeBERT, GraphCodeBERT) and open-source projects (Voyage AI's code embeddings, Jina's code models) show that embeddings that understand code structure (not just text) improve retrieval accuracy by 15-30% for code Q&A. BetterCodeWiki's current embedding approach (in `api/data_pipeline.py`) uses general-purpose text embeddings -- upgrading to code-specific embeddings is a significant quality improvement.

3. **Agentic documentation generation.** Instead of single-pass "generate docs for this file," agent frameworks (LangGraph, CrewAI, AutoGen) enable multi-step flows: (a) analyze repo structure, (b) identify architectural patterns, (c) generate docs for each module, (d) cross-reference and validate, (e) generate diagrams. BetterCodeWiki's websocket-based wiki generation (in `api/websocket_wiki.py`) already does a version of this; the opportunity is to make it more sophisticated.

4. **Real-time incremental analysis.** Instead of regenerating entire wikis, diff-based analysis can update only the sections affected by a code change. This requires: git diff parsing, file-to-wiki-section mapping, and incremental regeneration. No competitor does this well yet.

5. **Multi-modal code analysis.** AI can now analyze:
   - Screenshots of UIs and map them to component code
   - Architecture diagrams (hand-drawn or digital) and validate them against actual code structure
   - Figma designs and generate component documentation
   - Database schema diagrams and map them to ORM code
   This is completely uncharted territory for documentation tools.

### 2.4 Competitive Landscape Update

| Competitor | Strengths | Weaknesses | Threat Level |
|-----------|-----------|------------|--------------|
| **Google CodeWiki** | Google brand, free, Gemini integration | Closed source, Gemini-only, no IDE extension, no community, "Google Graveyard" risk | High (brand) / Medium (product) |
| **Swimm** | Team-focused, keeps docs in code, IDE extension exists | Closed source, no AI generation (manual docs), limited to inline comments, $30/seat | Medium |
| **ReadMe** | Beautiful API docs, developer hub, custom domains | Focused on API docs only (not codebase understanding), no AI generation, expensive ($99+/mo) | Low |
| **Mintlify** | Fast doc generation, CLI-based, nice templates | Documentation site builder (not codebase wiki), manual content, no AI code analysis | Low |
| **GitBook** | Established, team collaboration, good UX | General-purpose docs (not code-specific), no AI analysis, slow to adopt AI | Low-Medium |
| **Notion AI** | Massive user base, AI features, team collaboration | Not code-specific, no repo integration, no diagrams, general-purpose | Low |
| **Sourcegraph Cody** | Deep code search, code graph, IDE extension | Pivoting away from enterprise search; uncertain product direction; complex setup | Medium |
| **GitHub Copilot Chat** | GitHub integration, massive distribution, free for OSS | Not documentation-focused, no wiki generation, no diagrams, no export | High (adjacent threat) |

**Key insight:** No competitor combines all of: AI-generated wiki + IDE extension + real-time sync + multi-provider AI + self-hosting + open source. BetterCodeWiki can be first to market with this complete package.

### 2.5 Developer Collaboration Tools Market

The collaboration layer is where the highest willingness-to-pay resides:

- **Linear** ($8-12/seat/month) proved developers want collaboration tools that feel as good as consumer apps
- **Notion** ($8-18/seat/month) proved that collaborative knowledge bases command premium pricing
- **Figma** ($12-75/seat/month) proved that real-time collaborative editing creates massive switching costs
- **Slack** ($7.25-12.50/seat/month) proved that team communication tools become essential infrastructure

**Pattern:** Tools that start as single-player (free) and add collaboration (paid) achieve 3-5x higher ARPU than tools that stay single-player. BetterCodeWiki must follow this trajectory.

### 2.6 Growth Strategies for Developer Tools (2025-2026)

**What works for product-led growth in dev tools:**

1. **"Badge in README" distribution** (Shields.io model) -- a "Docs powered by BetterCodeWiki" badge in GitHub READMEs creates viral awareness. Every README view is an impression.
2. **Public wiki directory as SEO engine** -- hosting AI-generated docs for popular OSS projects creates a searchable index. When developers Google "how does React's reconciler work," BetterCodeWiki's wiki page should rank.
3. **GitHub Action / App for frictionless adoption** -- install once, get auto-generated docs on every push. No ongoing effort required from the team.
4. **IDE extension as daily touchpoint** -- web apps get visited occasionally; IDE extensions are used every day. Daily active usage drives conversion.
5. **"Invite your team" as upgrade trigger** -- the single most effective PLG conversion moment is when a user wants to share their wiki with colleagues.
6. **Developer content marketing** -- blog posts like "Understanding the React codebase with BetterCodeWiki" or "How Kubernetes networking actually works" drive organic traffic and demonstrate value.

**Freemium conversion benchmarks for dev tools:**
- Free -> Paid conversion: 2-5% is typical; best-in-class (Cursor, Vercel) achieve 5-10%
- Monthly churn for paid: 3-7% for Pro; <2% for Team/Enterprise
- Time to conversion: median 14-30 days from first use
- Expansion revenue: 20-40% of revenue growth from existing customers upgrading tiers

---

## 3. Phase 3: IDE & Real-Time (Months 1-3)

### 3.1 VS Code Extension

**Product vision:** A sidebar panel in VS Code that shows the BetterCodeWiki documentation for whatever code the developer is currently reading or editing. The wiki follows the developer's cursor.

#### 3.1.1 Extension Architecture

```
VS Code Extension (TypeScript)
├── extension.ts            # Activation, command registration
├── providers/
│   ├── SidebarProvider.ts  # WebView panel showing wiki content
│   ├── HoverProvider.ts    # Tooltip wiki summaries on hover
│   ├── CodeLensProvider.ts # Inline "View Docs" links above functions
│   └── TreeDataProvider.ts # Wiki structure in Explorer sidebar
├── services/
│   ├── ApiClient.ts        # HTTP/WS client to BetterCodeWiki backend
│   ├── ContextTracker.ts   # Tracks active file, function, symbol
│   ├── CacheManager.ts     # Local SQLite cache for wiki content
│   └── AuthManager.ts      # Token/API key management
├── webview/
│   ├── WikiPanel.tsx        # React app rendered in WebView
│   ├── AskPanel.tsx         # Ask AI interface in sidebar
│   └── DiagramPanel.tsx     # Mermaid diagram viewer
└── package.json             # Extension manifest, contributes, activation events
```

**Key technical decisions:**

1. **WebView-based sidebar** (not native VS Code UI). This allows us to reuse BetterCodeWiki's existing React components (Markdown renderer, Mermaid diagrams, Ask AI) inside the extension. The tradeoff is slightly more memory usage vs. significant code reuse.

2. **Context tracking via VS Code API.** The extension listens to `vscode.window.onDidChangeActiveTextEditor` and `vscode.window.onDidChangeTextEditorSelection` to detect which file and function the developer is looking at. It then fetches the corresponding wiki page from the BetterCodeWiki backend.

3. **Tiered connection model:**
   - **Cloud mode:** Extension connects to BetterCodeWiki's hosted API (for Pro/Team users)
   - **Local mode:** Extension connects to a locally-running BetterCodeWiki instance (for self-hosted/free users)
   - **Offline mode:** Extension uses cached wiki content when no connection is available

4. **Incremental wiki generation.** The extension does not require the entire wiki to be pre-generated. When a developer opens a file that has no wiki page, the extension can generate it on-demand (single-file analysis) and cache the result.

#### 3.1.2 Feature Specification

| Feature | Free Tier | Pro Tier | Description |
|---------|-----------|----------|-------------|
| **Wiki sidebar panel** | View-only (cached) | Full interactive | Shows wiki content for current file/function |
| **Hover documentation** | -- | Yes | Hover over any symbol for a wiki tooltip |
| **CodeLens links** | -- | Yes | "View Docs" / "Ask AI" links above functions |
| **Ask AI in sidebar** | 5 questions/day | Unlimited | Chat with AI about the current code context |
| **Diagram viewer** | -- | Yes | View Mermaid diagrams inline in the sidebar |
| **Wiki tree in Explorer** | Yes | Yes | Full wiki structure in VS Code's Explorer panel |
| **Generate wiki** | 1 repo | Unlimited | Trigger wiki generation from the extension |
| **Offline cache** | -- | Yes | Browse wiki content without internet connection |

#### 3.1.3 Implementation Plan

**Sprint 1 (Weeks 1-2): Foundation**
- Set up VS Code extension project with TypeScript + WebView
- Implement `extension.ts` with activation on workspace open
- Build `ApiClient.ts` with authentication (API key) and HTTP/WS support
- Build `ContextTracker.ts` to detect active file and cursor position
- Create basic `SidebarProvider.ts` with a static "Hello World" WebView

**Sprint 2 (Weeks 3-4): Wiki Panel**
- Build `WikiPanel.tsx` React app for WebView (port existing Markdown renderer)
- Implement file-to-wiki-page mapping (match file paths to wiki page `filePaths` field)
- Add `TreeDataProvider.ts` to show wiki structure in Explorer
- Implement `CacheManager.ts` with SQLite for offline wiki storage
- Wire up context tracking -> API fetch -> sidebar update pipeline

**Sprint 3 (Weeks 5-6): Intelligence Features**
- Build `HoverProvider.ts` for wiki tooltips on symbol hover
- Build `CodeLensProvider.ts` for inline "View Docs" links
- Port Ask AI component to `AskPanel.tsx` in the sidebar
- Implement on-demand single-file wiki generation
- Add settings UI (API key, server URL, offline mode toggle)

**Sprint 4 (Weeks 7-8): Polish & Launch**
- Performance optimization (lazy loading, debounced context tracking)
- Cross-platform testing (macOS, Windows, Linux)
- Write extension README and marketplace page
- Record demo video and screenshots
- Publish to VS Code Marketplace
- Announce on Twitter/X, Hacker News, Reddit r/vscode, r/programming

**Estimated effort:** 2 engineers, 8 weeks
**Dependencies:** Backend API must support single-file wiki generation endpoint (new)

#### 3.1.4 API Changes Required

New backend endpoints needed for IDE extension support:

```python
# New endpoint: Generate wiki for a single file
POST /api/wiki/file
{
  "repo_url": "https://github.com/owner/repo",
  "file_path": "src/auth/login.ts",
  "provider": "openai",
  "model": "gpt-4o",
  "token": "ghp_xxx"  # optional, for private repos
}
# Returns: { "page_id": "...", "title": "...", "content": "...", "filePaths": [...] }

# New endpoint: Get wiki page by file path
GET /api/wiki/page?repo_url=...&file_path=src/auth/login.ts
# Returns: Cached wiki page content if available, 404 if not generated

# New endpoint: Get wiki structure for a repo
GET /api/wiki/structure?repo_url=...
# Returns: WikiStructure JSON (sections, pages, relationships)

# New endpoint: Symbol-level documentation
POST /api/wiki/symbol
{
  "repo_url": "https://github.com/owner/repo",
  "file_path": "src/auth/login.ts",
  "symbol_name": "authenticateUser",
  "symbol_type": "function",
  "line_number": 42
}
# Returns: { "summary": "...", "parameters": [...], "related_pages": [...] }
```

### 3.2 Real-Time Documentation Sync

**Product vision:** When code changes (push, PR merge, branch update), the wiki automatically updates. Developers see "living documentation" that is always current.

#### 3.2.1 Architecture

```
Code Change Event Flow:

  [Git Push] ──> [GitHub Webhook] ──> [BetterCodeWiki Webhook Receiver]
                                              │
                                              ▼
                                    [Diff Analyzer]
                                    "What files changed?"
                                              │
                                              ▼
                                    [Impact Mapper]
                                    "Which wiki pages are affected?"
                                    (file_path -> wiki_page mapping)
                                              │
                                              ▼
                                    [Incremental Generator]
                                    "Regenerate only affected pages"
                                              │
                                  ┌───────────┴───────────┐
                                  ▼                       ▼
                          [Update Wiki Cache]    [Notify Subscribers]
                          (overwrite pages)      (WebSocket push to
                                                  web app + IDE ext)
```

#### 3.2.2 Webhook Receiver Specification

```python
# New file: api/webhooks.py

@app.post("/webhooks/github")
async def github_webhook(request: Request):
    """Handle GitHub push/PR webhooks for auto-documentation."""

    payload = await request.json()
    event_type = request.headers.get("X-GitHub-Event")

    if event_type == "push":
        # Extract changed files from push payload
        changed_files = extract_changed_files(payload)
        repo_url = payload["repository"]["html_url"]

        # Find affected wiki pages
        affected_pages = map_files_to_wiki_pages(repo_url, changed_files)

        if affected_pages:
            # Queue incremental regeneration
            await queue_regeneration(
                repo_url=repo_url,
                page_ids=affected_pages,
                trigger="push",
                commit_sha=payload["after"]
            )

    elif event_type == "pull_request" and payload["action"] == "closed" and payload["pull_request"]["merged"]:
        # PR merged -- regenerate affected pages
        changed_files = await get_pr_changed_files(payload)
        # ... same flow as push

    return {"status": "queued"}

@app.post("/webhooks/gitlab")
async def gitlab_webhook(request: Request):
    """Handle GitLab push webhooks."""
    # Similar implementation for GitLab

@app.post("/webhooks/bitbucket")
async def bitbucket_webhook(request: Request):
    """Handle Bitbucket push webhooks."""
    # Similar implementation for Bitbucket
```

#### 3.2.3 Incremental Regeneration Engine

**The key technical challenge:** mapping file changes to wiki page updates without regenerating the entire wiki.

**Solution: File-to-Page Index**

When a wiki is first generated, build an index mapping each source file to the wiki pages that reference it (using the existing `filePaths` field in `WikiPage`):

```python
# file_page_index example:
{
    "src/auth/login.ts": ["page_auth_overview", "page_login_flow"],
    "src/auth/jwt.ts": ["page_auth_overview", "page_jwt_tokens"],
    "src/api/routes.ts": ["page_api_reference", "page_routing"],
    # ...
}
```

When files change, look up the index, and regenerate only those pages. The regeneration prompt includes the git diff as additional context:

```
You previously generated this documentation for the auth module:
[previous content]

The following files have changed since then:
[git diff for src/auth/login.ts]

Please update the documentation to reflect these changes.
Keep unchanged sections as-is. Highlight what changed.
```

**Freshness indicators on the frontend:**

```tsx
// New component: FreshnessIndicator.tsx
interface FreshnessProps {
  lastVerified: Date;    // When the page was last checked against code
  lastUpdated: Date;     // When the page content last changed
  commitSha: string;     // The commit this page is synced to
  totalCommitsBehind: number; // How many commits since last sync
}

function FreshnessIndicator({ lastVerified, totalCommitsBehind }: FreshnessProps) {
  if (totalCommitsBehind === 0) {
    return <Badge variant="green">Up to date</Badge>
  } else if (totalCommitsBehind < 5) {
    return <Badge variant="yellow">{totalCommitsBehind} commits behind</Badge>
  } else {
    return <Badge variant="red">May be outdated ({totalCommitsBehind} commits behind)</Badge>
  }
}
```

**Estimated effort:** 1 backend engineer, 4 weeks
**Dependencies:** GitHub/GitLab/Bitbucket webhook documentation; existing wiki cache system

### 3.3 GitHub App for Auto-Doc-on-Push

**Product vision:** Install BetterCodeWiki as a GitHub App on your repository. Every push automatically generates or updates documentation. Zero ongoing effort.

#### 3.3.1 GitHub App Specification

| Field | Value |
|-------|-------|
| **App name** | BetterCodeWiki |
| **Description** | Automatically generates and maintains AI-powered documentation for your repository |
| **Permissions** | `contents: read`, `pull_requests: read`, `metadata: read` |
| **Webhook events** | `push`, `pull_request` (opened, synchronized, closed) |
| **Setup URL** | `https://app.bettercodewiki.com/github/install` |
| **Callback URL** | `https://app.bettercodewiki.com/api/github/callback` |

#### 3.3.2 Features

1. **Auto-generate wiki on first install.** When a user installs the GitHub App on a repository, trigger a full wiki generation.
2. **Incremental updates on push.** Every push to the default branch triggers the incremental regeneration engine (Section 3.2.3).
3. **PR documentation preview.** When a PR is opened, generate a comment showing what documentation would change if the PR is merged. Example:

```markdown
## BetterCodeWiki Documentation Preview

This PR would update the following documentation pages:

| Page | Change Type | Details |
|------|-------------|---------|
| Auth Module Overview | Updated | New OAuth2 flow added |
| API Reference | Updated | 2 new endpoints documented |
| Getting Started | No change | -- |

[View full documentation preview](https://app.bettercodewiki.com/preview/owner/repo/pr/42)
```

4. **Status checks.** Add a GitHub status check that shows whether documentation is up-to-date. Can be configured as required (block merge if docs are stale).

5. **Badge for README.** Provide a dynamic badge:
```markdown
[![Docs](https://app.bettercodewiki.com/badge/owner/repo)](https://app.bettercodewiki.com/owner/repo)
```

#### 3.3.3 Implementation Plan

**Week 1-2:** Register GitHub App, implement OAuth flow, set up webhook receiver
**Week 3:** Implement push webhook -> incremental regeneration pipeline
**Week 4:** Implement PR comment preview feature
**Week 5:** Build badge endpoint, status check integration
**Week 6:** Testing, documentation, launch

**Estimated effort:** 1 full-stack engineer, 6 weeks

### 3.4 Phase 3 Milestones and Success Metrics

| Milestone | Target Date | Success Metric |
|-----------|-------------|----------------|
| VS Code extension v0.1 (sidebar + tree) | Month 1, Week 4 | Internal dogfooding |
| VS Code extension v1.0 (hover + ask + cache) | Month 2, Week 4 | Published to Marketplace |
| GitHub App v1.0 (auto-doc-on-push) | Month 2, Week 2 | Available on GitHub Marketplace |
| Incremental regeneration engine | Month 2, Week 4 | <30s update time for single-file change |
| VS Code extension: 1,000 installs | Month 3 | Marketplace analytics |
| GitHub App: 100 installations | Month 3 | GitHub App dashboard |
| Real-time sync latency | Month 3 | <60s from push to updated wiki |

---

## 4. Phase 4: Collaboration & Teams (Months 3-6)

### 4.1 Team Workspaces

**Product vision:** Organizations can create a workspace where all their repositories' wikis are unified. Team members see a shared view with permissions, annotations, and activity feeds.

#### 4.1.1 Data Model

```sql
-- Core workspace tables (PostgreSQL)

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    owner_id UUID REFERENCES users(id),
    plan VARCHAR(50) DEFAULT 'free',  -- free, pro, team, enterprise
    created_at TIMESTAMP DEFAULT NOW(),
    settings JSONB DEFAULT '{}'
);

CREATE TABLE workspace_members (
    workspace_id UUID REFERENCES workspaces(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'viewer',  -- owner, admin, editor, viewer
    invited_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE workspace_repos (
    workspace_id UUID REFERENCES workspaces(id),
    repo_url VARCHAR(500) NOT NULL,
    repo_type VARCHAR(50),  -- github, gitlab, bitbucket, local
    display_name VARCHAR(255),
    auto_sync BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMP,
    wiki_structure JSONB,
    PRIMARY KEY (workspace_id, repo_url)
);

CREATE TABLE annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    wiki_page_id VARCHAR(255) NOT NULL,
    repo_url VARCHAR(500) NOT NULL,
    author_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'comment',  -- comment, correction, context, question
    target_selector JSONB,  -- { "type": "text", "start": 142, "end": 198 } or { "type": "heading", "id": "h2-auth" }
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE annotation_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annotation_id UUID REFERENCES annotations(id),
    author_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,  -- wiki_generated, page_updated, annotation_added, member_invited
    target_type VARCHAR(50),  -- wiki_page, repo, annotation, member
    target_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.1.2 Workspace UI

```
+------------------------------------------------------------------+
| BetterCodeWiki - Acme Corp Workspace            [Settings] [Team] |
+------------------------------------------------------------------+
|                                                                    |
|  Repositories (4)                     Activity Feed                |
|  +---------------------------+        +-------------------------+  |
|  | [*] acme/backend          |        | Sarah updated Auth docs |  |
|  |     23 pages, synced 2m   |        | 5 minutes ago           |  |
|  |     ago                   |        |                         |  |
|  | [*] acme/frontend         |        | Mike added annotation   |  |
|  |     18 pages, synced 1h   |        | on API Routes           |  |
|  |     ago                   |        | 1 hour ago              |  |
|  | [*] acme/mobile-app       |        |                         |  |
|  |     12 pages, synced 3h   |        | Auto-sync: 3 pages      |  |
|  |     ago                   |        | updated in backend      |  |
|  | [ ] acme/infra (paused)   |        | 2 hours ago             |  |
|  +---------------------------+        +-------------------------+  |
|                                                                    |
|  Quick Stats                                                       |
|  Total pages: 53 | Annotations: 127 | Team members: 8             |
|  Freshness: 94% up-to-date | Avg. generation quality: 4.2/5       |
|                                                                    |
+------------------------------------------------------------------+
```

#### 4.1.3 Role-Based Access Control (RBAC)

| Permission | Owner | Admin | Editor | Viewer |
|-----------|:-----:|:-----:|:------:|:------:|
| Manage workspace settings | Yes | Yes | -- | -- |
| Invite/remove members | Yes | Yes | -- | -- |
| Add/remove repositories | Yes | Yes | Yes | -- |
| Trigger wiki regeneration | Yes | Yes | Yes | -- |
| Add annotations/comments | Yes | Yes | Yes | -- |
| View wiki content | Yes | Yes | Yes | Yes |
| Export wiki | Yes | Yes | Yes | Yes |
| Delete workspace | Yes | -- | -- | -- |
| Manage billing | Yes | -- | -- | -- |

### 4.2 Real-Time Collaborative Editing

**Product vision:** Multiple team members can view and annotate the same wiki page simultaneously. Annotations, corrections, and AI-generated content merge seamlessly.

#### 4.2.1 Technical Approach

**CRDT-based real-time sync** using Yjs (MIT-licensed collaborative editing framework):

```
Architecture:

  [User A: Browser]  ──WebSocket──>  [Yjs Server (Hocuspocus)]  <──WebSocket──  [User B: Browser]
         │                                    │                                         │
         ▼                                    ▼                                         ▼
  [Yjs Document]                     [Persistence Layer]                        [Yjs Document]
  (local state)                      (PostgreSQL + S3)                          (local state)
```

**Why Yjs over Operational Transform (OT):**
- CRDT (Conflict-free Replicated Data Types) handles offline edits gracefully -- essential for IDE extension offline mode
- Yjs is the industry standard (used by Notion, Figma, Linear, Hocuspocus)
- MIT licensed and actively maintained
- Supports awareness (cursor positions, selection) for presence indicators
- Sub-50ms merge latency for typical edits

#### 4.2.2 Collaborative Features

1. **Presence indicators.** See who else is viewing the same wiki page. Show avatar + cursor position for users making annotations.

2. **Inline annotations.** Select any text in a wiki page and add a comment. Comments appear as highlighted regions with a thread in a sidebar panel.

3. **AI content + human corrections merge.** When AI regenerates a page, human annotations are preserved and repositioned using text anchoring (fuzzy matching of annotation target text).

4. **Suggestion mode.** Team members can propose edits to AI-generated content (similar to Google Docs' "Suggest" mode). Suggestions are reviewed and accepted/rejected by editors.

5. **Version history.** Full history of all changes to a wiki page, with diff view. Powered by Yjs's built-in versioning.

#### 4.2.3 Implementation Dependencies

| Dependency | Package | Purpose |
|-----------|---------|---------|
| `yjs` | Real-time CRDT | Collaborative document state |
| `@hocuspocus/server` | WebSocket server | Multi-user sync relay |
| `@hocuspocus/extension-database` | Persistence | Store Yjs documents in PostgreSQL |
| `y-prosemirror` or `y-tiptap` | Rich text binding | Connect Yjs to a rich text editor for annotations |

**Estimated effort:** 2 engineers, 8 weeks

### 4.3 Review Workflows for Documentation

**Product vision:** Documentation changes (whether AI-generated or human-written) go through a review process before being published, ensuring quality and accuracy.

#### 4.3.1 Workflow

```
[Code push triggers regeneration]
         │
         ▼
[AI generates updated content]
         │
         ▼
[Draft created in workspace]
  - Shows diff from previous version
  - Highlights AI-generated vs. human-written sections
  - Tags affected team members (based on file ownership / CODEOWNERS)
         │
         ▼
[Review phase]
  - Reviewers can approve, request changes, or comment
  - AI-generated content can be edited before publishing
  - Minimum 1 approval required (configurable)
         │
         ▼
[Published to live wiki]
  - Previous version archived
  - Changelog entry generated automatically
  - Notification sent to workspace
```

#### 4.3.2 Integration with CODEOWNERS

If the repository has a `CODEOWNERS` file, BetterCodeWiki can automatically assign documentation reviewers based on code ownership:

```
# CODEOWNERS
src/auth/    @sarah @mike
src/api/     @john @sarah
src/frontend/ @emma

# When src/auth/login.ts changes and the Auth Module wiki page is regenerated,
# Sarah and Mike are automatically requested to review the documentation update.
```

### 4.4 Slack, Discord, and Teams Integration

**Product vision:** Documentation updates, review requests, and annotation notifications are delivered to the team's existing communication channels.

#### 4.4.1 Notification Types

| Event | Default Channel | Message Format |
|-------|----------------|----------------|
| Wiki generated for new repo | #documentation | "Wiki generated for `acme/backend` -- 23 pages, 12 diagrams. [View Wiki]" |
| Pages updated (auto-sync) | #documentation | "3 pages updated in `acme/backend` wiki after push by @sarah. [View Changes]" |
| Annotation added | #doc-reviews | "@mike left a comment on Auth Module: 'The JWT expiry should be 24h, not 1h.' [View]" |
| Review requested | DM to reviewer | "Documentation review requested: Auth Module updated. 2 sections changed. [Review]" |
| Stale documentation alert | #documentation | "Warning: API Reference for `acme/backend` is 15 commits behind. [Regenerate]" |

#### 4.4.2 Slack App Specification

- **OAuth scopes:** `chat:write`, `incoming-webhook`, `commands`
- **Slash commands:**
  - `/wiki [repo-url]` -- Generate a link to the wiki for a repo
  - `/wiki-ask [repo-url] [question]` -- Ask a question about a codebase, get an inline answer
  - `/wiki-status [repo-url]` -- Check documentation freshness
- **Interactive messages:** Buttons for "View Wiki," "Approve Review," "Regenerate"

**Estimated effort:** 1 engineer, 3 weeks per platform (Slack, Discord, Teams)

### 4.5 Phase 4 Milestones and Success Metrics

| Milestone | Target Date | Success Metric |
|-----------|-------------|----------------|
| Workspace creation + member invite flow | Month 3, Week 4 | Internal testing |
| Annotations system (inline comments) | Month 4, Week 2 | Usable on production |
| Real-time collaborative viewing | Month 4, Week 4 | <100ms presence updates |
| Review workflow v1 | Month 5, Week 2 | End-to-end flow working |
| Slack integration v1 | Month 5, Week 4 | Published to Slack App Directory |
| 50 team workspaces created | Month 6 | Analytics dashboard |
| Team tier conversion rate | Month 6 | >3% of free users who invite teammates convert |
| Average annotations per workspace | Month 6 | >10 annotations per active workspace |

---

## 5. Phase 5: Platform & Ecosystem (Months 6-12)

### 5.1 Plugin Marketplace

**Product vision:** Third-party developers can build plugins that extend BetterCodeWiki's capabilities -- custom analyzers, documentation templates, visualization types, export formats, and integrations.

#### 5.1.1 Plugin SDK

```typescript
// @bettercodewiki/plugin-sdk

interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;

  // Lifecycle hooks
  onInstall?: (context: PluginContext) => Promise<void>;
  onUninstall?: (context: PluginContext) => Promise<void>;

  // Extension points
  analyzers?: Analyzer[];        // Custom code analysis
  templates?: Template[];        // Documentation templates
  visualizations?: Visualization[]; // Custom diagram types
  exportFormats?: ExportFormat[];  // Custom export formats
  integrations?: Integration[];   // Third-party service connectors
}

interface Analyzer {
  id: string;
  name: string;
  filePatterns: string[];  // Glob patterns for files this analyzer handles
  analyze: (files: SourceFile[], context: AnalysisContext) => Promise<AnalysisResult>;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;  // "api-docs", "architecture", "onboarding", "runbook"
  generate: (wikiStructure: WikiStructure, context: TemplateContext) => Promise<string>;
}

// Example: A Terraform analyzer plugin
const terraformPlugin: Plugin = {
  id: "terraform-analyzer",
  name: "Terraform Infrastructure Docs",
  version: "1.0.0",
  description: "Generates infrastructure documentation from Terraform files",
  author: "community",
  analyzers: [{
    id: "terraform",
    name: "Terraform Analyzer",
    filePatterns: ["**/*.tf", "**/*.tfvars"],
    analyze: async (files, context) => {
      // Parse Terraform HCL, extract resources, modules, variables
      // Generate infrastructure documentation with resource dependency graph
      return {
        pages: [
          { title: "Infrastructure Overview", content: "..." },
          { title: "Resource Dependencies", content: "...", diagram: "..." }
        ]
      };
    }
  }]
};
```

#### 5.1.2 Initial Plugin Ideas (First-Party)

| Plugin | Category | Description |
|--------|----------|-------------|
| **OpenAPI/Swagger Docs** | Analyzer | Parses OpenAPI specs and generates rich API documentation with request/response examples |
| **Database Schema Docs** | Analyzer | Reads migration files, Prisma/TypeORM schemas, and generates ERD + table documentation |
| **Terraform/Pulumi Infra Docs** | Analyzer | Generates infrastructure documentation from IaC files |
| **Storybook Component Docs** | Analyzer | Reads Storybook stories and generates component documentation with visual examples |
| **Confluence Export** | Export | Exports wiki to Confluence pages (already partially built in ExportMenu.tsx, make it a plugin) |
| **Docusaurus Export** | Export | Generates a full Docusaurus site from wiki content |
| **Architecture Decision Records** | Template | Generates ADR documents from git history and code changes |
| **Runbook Generator** | Template | Generates operational runbooks from CI/CD configs and deployment scripts |

#### 5.1.3 Marketplace Infrastructure

```
Plugin Marketplace Architecture:

[Plugin Developer] ──> [Plugin Registry (npm-like)]
                              │
                              ▼
                        [Review Queue]
                        (automated security scan +
                         manual review for featured)
                              │
                              ▼
                        [Marketplace UI]
                        (browse, search, install)
                              │
                              ▼
                        [Plugin Runtime]
                        (sandboxed execution in
                         BetterCodeWiki backend)
```

**Security model:** Plugins run in a sandboxed environment (WebAssembly or containerized) with limited permissions. Plugins cannot access the network, filesystem, or other plugins unless explicitly granted.

**Revenue model:** Free plugins listed for free. Premium plugins can charge, with BetterCodeWiki taking a 15-20% platform fee (similar to Shopify App Store, Figma Community).

### 5.2 API Platform

**Product vision:** A fully documented REST + WebSocket API that allows any application to generate, query, and manage BetterCodeWiki documentation programmatically.

#### 5.2.1 API Specification (New Endpoints)

```yaml
# OpenAPI 3.0 specification (summary)

paths:
  # Wiki Generation
  /api/v1/wikis:
    post:
      summary: Generate a wiki for a repository
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                repo_url: { type: string }
                provider: { type: string }
                model: { type: string }
                options:
                  type: object
                  properties:
                    wiki_type: { type: string, enum: [comprehensive, quick, api-only] }
                    language: { type: string }
                    excluded_dirs: { type: array, items: { type: string } }
      responses:
        202:
          description: Wiki generation queued
          content:
            application/json:
              schema:
                type: object
                properties:
                  wiki_id: { type: string }
                  status_url: { type: string }

  /api/v1/wikis/{wiki_id}:
    get:
      summary: Get wiki status and content

  /api/v1/wikis/{wiki_id}/pages:
    get:
      summary: List all pages in a wiki

  /api/v1/wikis/{wiki_id}/pages/{page_id}:
    get:
      summary: Get a specific wiki page

  # Search
  /api/v1/search:
    get:
      summary: Search across all wikis in a workspace
      parameters:
        - name: q
          in: query
          type: string
        - name: workspace_id
          in: query
          type: string

  # Ask AI
  /api/v1/ask:
    post:
      summary: Ask a question about a repository
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                repo_url: { type: string }
                question: { type: string }
                context: { type: object }  # optional: file path, page ID

  # Webhooks (outgoing)
  /api/v1/webhooks:
    post:
      summary: Register a webhook for wiki events
    get:
      summary: List registered webhooks

  # Workspace Management
  /api/v1/workspaces:
    get:
      summary: List workspaces
    post:
      summary: Create a workspace
```

#### 5.2.2 API Use Cases

1. **CI/CD integration:** Generate documentation as part of the build pipeline. If docs fail to generate, fail the build.
2. **Custom dashboards:** Build internal dashboards that show documentation coverage and freshness across all repos.
3. **Chatbot integration:** Build a Slack/Discord bot that answers code questions using BetterCodeWiki's API.
4. **Content pipeline:** Export wiki content to feed into internal knowledge bases, training materials, or customer-facing docs.
5. **Automated testing:** Write tests that verify documentation accuracy against code (e.g., "does the API docs page list all endpoints in routes.ts?").

#### 5.2.3 API Pricing

| Tier | Rate Limit | Price |
|------|-----------|-------|
| Free | 100 requests/day | $0 |
| Pro | 5,000 requests/day | Included in Pro ($19/mo) |
| Team | 25,000 requests/day | Included in Team ($29/seat/mo) |
| Enterprise | Unlimited | Included in Enterprise ($59/seat/mo) |
| API-only (no UI) | Custom | $49/mo base + $0.01/request over 10K |

### 5.3 Custom AI Model Support

**Product vision:** Enterprise customers can use their own fine-tuned models for documentation generation, or choose from a curated list of specialized code models.

#### 5.3.1 Model Registry

Extend the existing multi-provider system (OpenAI, Google, OpenRouter, Ollama, Bedrock, etc.) with:

1. **Custom endpoint support.** Any OpenAI-compatible API endpoint (vLLM, TGI, llama.cpp server). This is a simple extension of the existing `api/openai_client.py`:

```python
# In api/config.py, add:
CUSTOM_ENDPOINTS = os.getenv("CUSTOM_MODEL_ENDPOINTS", "").split(",")
# Format: "name:url:api_key" e.g., "internal-llama:http://internal:8080/v1:sk-xxx"
```

2. **Model recommendation engine.** Based on repository characteristics (language, size, framework), recommend the best model:
   - Small Python repos (<100 files): GPT-4o-mini (fast, cheap, good enough)
   - Large Java enterprise repos (>1000 files): Claude 3.5 Sonnet (best at long context)
   - Repos with heavy math/algorithms: Gemini 1.5 Pro (strong at technical reasoning)
   - Air-gapped environments: Ollama with CodeLlama or DeepSeek Coder

3. **Fine-tuning pipeline (Enterprise).** Provide a service that fine-tunes an open model (Llama 3, Mistral, DeepSeek) on a customer's specific codebase and documentation style. The fine-tuned model generates docs that match the organization's voice and terminology.

### 5.4 Enterprise Features

#### 5.4.1 SSO (SAML/OIDC)

**Implementation:** Use an SSO middleware library (e.g., `passport-saml` for Node.js, or a managed service like WorkOS/Auth0 Enterprise).

| Provider | Protocol | Priority |
|----------|----------|----------|
| Okta | SAML 2.0 + OIDC | P0 |
| Azure AD | OIDC + SAML | P0 |
| Google Workspace | OIDC | P1 |
| OneLogin | SAML | P2 |
| PingIdentity | SAML | P2 |

**Enterprise SSO is the single most important gating feature.** Without SSO, enterprise procurement cannot approve the tool. Budget: 3-4 weeks of engineering, or $5K-15K/year for a managed SSO service (WorkOS, Clerk Enterprise).

#### 5.4.2 Audit Logs

Every significant action is logged to an append-only audit trail:

```json
{
  "timestamp": "2026-06-15T14:23:00Z",
  "actor": { "id": "user_123", "email": "sarah@acme.com", "ip": "10.0.1.42" },
  "action": "wiki.page.regenerated",
  "target": { "type": "wiki_page", "id": "page_auth_overview", "repo": "acme/backend" },
  "metadata": {
    "provider": "openai",
    "model": "gpt-4o",
    "trigger": "auto_sync",
    "commit_sha": "abc123"
  },
  "workspace_id": "ws_acme"
}
```

Audit logs are:
- Stored for 1 year minimum (configurable up to 7 years for compliance)
- Exportable as CSV/JSON
- Searchable by actor, action, target, and time range
- Available via API for integration with SIEM tools (Splunk, Datadog, etc.)

#### 5.4.3 Compliance

| Certification | Timeline | Effort | Cost |
|--------------|----------|--------|------|
| SOC 2 Type I | Month 8 | 4-6 weeks prep | $20-50K (auditor) |
| SOC 2 Type II | Month 12 | 3-month observation period | $30-80K |
| GDPR compliance | Month 7 | 2-3 weeks | Internal |
| HIPAA (healthcare) | Month 14 | 6-8 weeks | $50-100K |
| FedRAMP (government) | Month 18+ | 12-18 months | $250K+ |

### 5.5 Phase 5 Milestones and Success Metrics

| Milestone | Target Date | Success Metric |
|-----------|-------------|----------------|
| Plugin SDK v1.0 published | Month 7 | npm package available |
| 5 first-party plugins | Month 8 | Published and documented |
| API v1 with documentation | Month 7 | OpenAPI spec published |
| SSO integration (Okta + Azure AD) | Month 8 | First enterprise pilot |
| Audit logs system | Month 8 | Queryable via API |
| SOC 2 Type I certification | Month 9 | Audit report available |
| Plugin marketplace UI | Month 10 | Browsable, installable |
| 10 enterprise customers | Month 12 | Signed contracts |
| $100K MRR | Month 12 | Billing system |
| API: 100 integrations built | Month 12 | API key registrations |

---

## 6. Phase 6: Market Domination (Months 12-18)

### 6.1 Network Effects Strategy

**The "Wikipedia of Code" vision** from PRODUCT_STRATEGY.md is the single most powerful network effect opportunity. Here is the concrete implementation plan:

#### 6.1.1 Public Wiki Directory

1. **Auto-generate wikis for the top 10,000 GitHub repositories** (by stars). This creates a massive, searchable index of code documentation.

2. **SEO optimization.** Each wiki page is a static, indexable page with proper meta tags, schema.org markup, and canonical URLs. When a developer searches "how does React fiber reconciler work," BetterCodeWiki should appear on page 1.

3. **Community curation layer.** Allow anyone with a GitHub account to:
   - Upvote/downvote AI-generated explanations
   - Add corrections and context
   - Submit alternative explanations
   - Flag inaccurate content

4. **Maintainer verification.** Repository maintainers can claim their wiki and add a "Verified by Maintainer" badge. Verified wikis rank higher in search.

**Network effect loop:**
```
More public wikis -> More Google traffic -> More developers discover BCW
-> More developers use BCW for their own repos -> More content generated
-> More wikis become community-curated -> Higher quality -> More traffic
```

#### 6.1.2 Cross-Repository Intelligence

As BetterCodeWiki indexes more repositories, it can provide unique insights:

1. **"Used by" links.** "This library is used by 347 indexed repositories. Here is how they typically configure it."
2. **Pattern detection.** "87% of Express.js applications in our index use this middleware pattern for authentication."
3. **Migration guides.** "23 repositories recently migrated from Webpack to Vite. Here is the common migration pattern."
4. **Dependency documentation.** "Your project uses `jsonwebtoken@9.0.0`. Here is how it works based on our wiki of the jsonwebtoken repo."

This **cross-repository intelligence is a data moat** that no competitor can replicate without indexing the same breadth of repositories.

### 6.2 International Expansion

**Current state:** BetterCodeWiki already supports multi-language wiki generation (via `next-intl` and the `LanguageContext`). The foundation is in place.

**Expansion plan:**

| Priority | Language | Market Size | Strategy |
|----------|----------|-------------|----------|
| P0 | Japanese | 1.8M developers | Japan has the highest per-seat willingness to pay outside the US. Partner with Japanese developer communities (Qiita, Zenn). |
| P0 | Chinese (Simplified) | 10M+ developers | Largest developer population outside the US. Must navigate regulatory requirements. Partner with Gitee (Chinese GitHub). |
| P1 | Korean | 800K developers | Strong developer community, high adoption of paid dev tools. |
| P1 | German | 1.5M developers | Strong enterprise market. GDPR compliance is a selling point. |
| P1 | Portuguese (Brazilian) | 1.5M developers | Fast-growing developer market in Latin America. |
| P2 | Spanish | 2M+ developers | Large market across Spain and Latin America. |
| P2 | French | 1M developers | Enterprise market, especially in francophone Africa. |

**Localization scope:**
- UI language (already supported via `next-intl`)
- Wiki generation in target language (already supported via model prompts)
- Landing page and marketing copy
- Documentation and support
- Local payment methods (especially important for Japan and China)

### 6.3 Vertical-Specific Solutions

**The insight:** Different industries have radically different documentation needs. Vertical solutions command 2-3x premium pricing.

#### 6.3.1 BetterCodeWiki for FinTech

- **Regulatory documentation.** Auto-generate compliance documentation mapping code to regulatory requirements (PCI-DSS, SOX, MiFID II).
- **Audit trail integration.** Every code change and documentation update is linked to compliance requirements.
- **Risk scoring.** Identify code sections that handle financial data and ensure they are thoroughly documented.
- **Pricing:** $99/seat/month (3x base enterprise)

#### 6.3.2 BetterCodeWiki for Healthcare

- **HIPAA compliance mapping.** Identify code that handles PHI (Protected Health Information) and generate compliance documentation.
- **Data flow documentation.** Auto-generate data flow diagrams showing how patient data moves through the system.
- **HL7/FHIR documentation.** Specialized analyzers for healthcare interoperability standards.
- **Pricing:** $99/seat/month

#### 6.3.3 BetterCodeWiki for Government/Defense

- **FedRAMP-authorized deployment.** Self-hosted in GovCloud or on-premises.
- **Classification-aware documentation.** Support for CUI (Controlled Unclassified Information) marking.
- **Air-gapped operation.** Full functionality with local models (Ollama), no internet required.
- **SBOM (Software Bill of Materials) generation.** Auto-generate from dependency analysis.
- **Pricing:** $149/seat/month (contract-based)

### 6.4 Acquisition Strategy for Complementary Tools

**Potential acquisition targets (if funded):**

| Target | What They Have | Why Acquire | Estimated Range |
|--------|---------------|-------------|-----------------|
| **Small OSS doc tool** (e.g., Mintlify competitor) | User base, templates, content pipeline | Acqui-hire + user base + technology | $1-5M |
| **Code visualization startup** | Advanced graph visualization, possibly patented algorithms | Technology that would take 12+ months to build | $2-10M |
| **Developer analytics tool** | Usage data, developer behavior insights | Data moat + analytics features for enterprise | $5-15M |
| **Browser extension for GitHub** | Distribution (Chrome Web Store presence), user base | Instant distribution channel for BetterCodeWiki's GitHub overlay | $500K-3M |

**Build vs. Buy criteria:**
- Build if: Core to the product vision, unique to our architecture, <3 months to build
- Buy if: Would take >6 months to build, target has significant user base, technology is non-trivial to replicate

### 6.5 Phase 6 Milestones and Success Metrics

| Milestone | Target Date | Success Metric |
|-----------|-------------|----------------|
| Public wiki directory: 10,000 repos | Month 13 | Auto-generated and indexed |
| SEO traffic: 100K monthly visitors | Month 15 | Google Analytics |
| Cross-repo intelligence v1 | Month 14 | "Used by" and pattern features live |
| Japanese localization + launch | Month 13 | First Japanese enterprise customer |
| Chinese market entry | Month 15 | Gitee integration + localization |
| FinTech vertical v1 | Month 15 | First 3 FinTech customers |
| Community contributions: 1,000 edits/month | Month 18 | Platform analytics |
| $1M+ MRR | Month 18 | Billing system |
| 50+ enterprise customers | Month 18 | CRM |

---

## 7. Technical Architecture

### 7.1 High-Level System Design (Full Platform)

```
                                    LOAD BALANCER (Cloudflare / AWS ALB)
                                              │
                    ┌─────────────────────────┼────────────────────────────┐
                    │                         │                            │
                    ▼                         ▼                            ▼
           [Next.js Frontend]         [FastAPI Backend]            [Hocuspocus Server]
           (Vercel / K8s)             (K8s / ECS)                  (Collaboration)
           - Landing page             - Wiki generation             - Real-time sync
           - Wiki viewer              - Chat/Ask AI                 - Presence
           - Workspace UI             - Search                      - Annotations
           - Team management          - Webhook processing          - CRDT merge
                    │                         │                            │
                    │                    ┌────┴─────┐                      │
                    │                    │          │                      │
                    │                    ▼          ▼                      │
                    │             [Task Queue]  [AI Providers]             │
                    │             (Celery/Bull)  - OpenAI                  │
                    │             - Wiki gen      - Google Gemini          │
                    │             - Incremental   - Anthropic Claude       │
                    │             - Webhooks       - OpenRouter             │
                    │             - Notifications  - Ollama (local)        │
                    │                    │          - Azure OpenAI          │
                    │                    │          - AWS Bedrock           │
                    │                    │                                  │
                    └────────┬───────────┴──────────────────────┬──────────┘
                             │                                  │
                             ▼                                  ▼
                    [PostgreSQL]                          [Redis]
                    - Users, workspaces                   - Cache
                    - Wiki structure + pages              - Sessions
                    - Annotations                         - Rate limiting
                    - Audit logs                          - Pub/sub
                    - Plugin registry                     - Task queue
                             │
                             ▼
                    [Object Storage (S3/R2)]
                    - Wiki content (large pages)
                    - Generated diagrams
                    - Plugin packages
                    - Export files

                    [Vector Database (FAISS -> Pinecone/Qdrant)]
                    - Code embeddings for RAG
                    - Cross-repo search index
```

### 7.2 Migration Path from Current Architecture

**Current state (from codebase analysis):**
- Frontend: Next.js 15 + React 19 (deployed separately)
- Backend: FastAPI (Python) with WebSocket support (`api/api.py`, `api/websocket_wiki.py`)
- AI: Multi-provider via separate client files (`openai_client.py`, `bedrock_client.py`, etc.)
- RAG: FAISS + adalflow (`api/rag.py`, `api/data_pipeline.py`)
- Storage: File-based wiki cache (JSON files on disk)
- No database, no user accounts, no authentication

**Migration steps:**

| Step | Current | Target | Effort | Phase |
|------|---------|--------|--------|-------|
| 1 | File-based wiki cache | PostgreSQL + S3 | 2 weeks | 3 |
| 2 | No auth | JWT + OAuth (GitHub, Google) | 3 weeks | 3 |
| 3 | No user accounts | User table + workspace model | 2 weeks | 3 |
| 4 | Single-process backend | Task queue (Celery) for generation | 2 weeks | 3 |
| 5 | FAISS (local) | FAISS + Qdrant (for cross-repo) | 3 weeks | 5 |
| 6 | No real-time collab | Hocuspocus + Yjs | 4 weeks | 4 |
| 7 | Single-server deployment | Kubernetes + Terraform | 3 weeks | 5 |

### 7.3 VS Code Extension Architecture (Detailed)

```
VS Code Extension
├── src/
│   ├── extension.ts
│   │   ├── activate()
│   │   │   ├── Register SidebarProvider (WebView)
│   │   │   ├── Register HoverProvider
│   │   │   ├── Register CodeLensProvider
│   │   │   ├── Register TreeDataProvider
│   │   │   ├── Register Commands (generate, ask, refresh)
│   │   │   └── Start ContextTracker
│   │   └── deactivate()
│   │
│   ├── providers/
│   │   ├── SidebarProvider.ts
│   │   │   └── Creates a WebView panel
│   │   │       └── Loads React app from webview/dist/
│   │   │       └── Communicates via postMessage API
│   │   │
│   │   ├── HoverProvider.ts
│   │   │   └── Implements vscode.HoverProvider
│   │   │   └── On hover: look up symbol in wiki cache
│   │   │   └── Return MarkdownString with summary
│   │   │
│   │   ├── CodeLensProvider.ts
│   │   │   └── Implements vscode.CodeLensProvider
│   │   │   └── Adds "View Docs" lens above functions/classes
│   │   │   └── Click -> opens sidebar to relevant wiki section
│   │   │
│   │   └── TreeDataProvider.ts
│   │       └── Implements vscode.TreeDataProvider
│   │       └── Shows wiki structure in Explorer panel
│   │       └── Click -> opens sidebar to selected page
│   │
│   ├── services/
│   │   ├── ApiClient.ts
│   │   │   └── HTTP client for BetterCodeWiki API
│   │   │   └── WebSocket client for real-time updates
│   │   │   └── Handles auth (API key from settings)
│   │   │
│   │   ├── ContextTracker.ts
│   │   │   └── Listens to editor events
│   │   │   └── Determines current file, function, symbol
│   │   │   └── Debounced (300ms) to avoid excessive API calls
│   │   │   └── Emits events for sidebar to consume
│   │   │
│   │   └── CacheManager.ts
│   │       └── SQLite database in extension storage
│   │       └── Caches wiki pages, structure, embeddings
│   │       └── TTL-based invalidation (configurable, default 1hr)
│   │       └── Offline mode: serve from cache when disconnected
│   │
│   └── webview/
│       ├── src/
│       │   ├── App.tsx           # Main WebView app
│       │   ├── WikiPanel.tsx     # Wiki content renderer
│       │   ├── AskPanel.tsx      # Ask AI interface
│       │   ├── DiagramPanel.tsx  # Mermaid diagram viewer
│       │   └── components/       # Shared components
│       │       ├── Markdown.tsx  # Ported from web app
│       │       └── Mermaid.tsx   # Ported from web app
│       └── vite.config.ts       # Build config for WebView
│
├── package.json                  # Extension manifest
│   └── contributes:
│       ├── viewsContainers      # Sidebar panel registration
│       ├── views                 # Tree views
│       ├── commands              # bettercodewiki.generate, .ask, .refresh
│       ├── configuration         # Settings (API key, server URL, etc.)
│       ├── menus                 # Right-click context menu items
│       └── keybindings           # Ctrl+Shift+W: toggle sidebar
│
└── .vscodeignore                 # Files to exclude from .vsix package
```

### 7.4 Database Schema (Complete)

```sql
-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url VARCHAR(500),
    auth_provider VARCHAR(50),  -- github, google, email
    auth_provider_id VARCHAR(255),
    api_key VARCHAR(255) UNIQUE,  -- For API/extension access
    plan VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

-- (workspace tables from Section 4.1.1)

-- Wiki Storage
CREATE TABLE wikis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    repo_url VARCHAR(500) NOT NULL,
    repo_type VARCHAR(50),
    structure JSONB NOT NULL,  -- WikiStructure
    provider VARCHAR(50),
    model VARCHAR(100),
    language VARCHAR(10) DEFAULT 'en',
    status VARCHAR(50) DEFAULT 'generating',  -- generating, ready, error, stale
    last_synced_commit VARCHAR(40),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(workspace_id, repo_url)
);

CREATE TABLE wiki_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wiki_id UUID REFERENCES wikis(id) ON DELETE CASCADE,
    page_id VARCHAR(255) NOT NULL,  -- Original page ID from generation
    title VARCHAR(500),
    content TEXT,
    file_paths TEXT[],  -- Source files this page covers
    importance VARCHAR(20),
    related_pages TEXT[],
    version INTEGER DEFAULT 1,
    last_verified_commit VARCHAR(40),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(wiki_id, page_id)
);

-- File-to-Page Index (for incremental regeneration)
CREATE TABLE file_page_index (
    wiki_id UUID REFERENCES wikis(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    page_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (wiki_id, file_path, page_id)
);

CREATE INDEX idx_file_page_index_file ON file_page_index(wiki_id, file_path);

-- Generation Queue
CREATE TABLE generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wiki_id UUID REFERENCES wikis(id),
    job_type VARCHAR(50),  -- full, incremental, single_file
    status VARCHAR(50) DEFAULT 'queued',  -- queued, processing, completed, failed
    page_ids TEXT[],  -- Pages to regenerate (null for full)
    trigger VARCHAR(50),  -- manual, push_webhook, pr_merge, schedule
    commit_sha VARCHAR(40),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Plugins
CREATE TABLE plugins (
    id VARCHAR(255) PRIMARY KEY,  -- npm-style: @author/plugin-name
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50),
    author_id UUID REFERENCES users(id),
    category VARCHAR(100),
    install_count INTEGER DEFAULT 0,
    package_url VARCHAR(500),  -- S3 URL for plugin package
    manifest JSONB,
    published_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace_plugins (
    workspace_id UUID REFERENCES workspaces(id),
    plugin_id VARCHAR(255) REFERENCES plugins(id),
    installed_at TIMESTAMP DEFAULT NOW(),
    config JSONB DEFAULT '{}',
    PRIMARY KEY (workspace_id, plugin_id)
);

-- API Keys and Webhooks
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    workspace_id UUID REFERENCES workspaces(id),
    key_hash VARCHAR(255) NOT NULL,  -- SHA256 hash of the API key
    name VARCHAR(255),
    scopes TEXT[],  -- read, write, admin
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE webhooks_outgoing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    url VARCHAR(500) NOT NULL,
    events TEXT[] NOT NULL,  -- wiki.generated, page.updated, annotation.created
    secret VARCHAR(255),  -- HMAC secret for signature verification
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Pricing Evolution

### 8.1 Phase 3 Pricing (Months 1-3)

Launch with a simple two-tier model to start generating revenue:

| Feature | Free | Pro ($19/month) |
|---------|------|-----------------|
| Public repos | Unlimited | Unlimited |
| Private repos | 3 | Unlimited |
| AI providers | All | All |
| Ask AI | 20/day | Unlimited |
| VS Code extension | View-only | Full |
| GitHub App | -- | Yes |
| Auto-sync on push | -- | Yes |
| Export | Markdown only | All formats |
| Support | Community | Email (48h) |

**Why start simple:** Two tiers reduce decision paralysis for early adopters. The free tier must demonstrate clear value; the Pro tier must feel like an obvious upgrade for anyone using BetterCodeWiki daily.

### 8.2 Phase 4 Pricing (Months 3-6)

Add Team tier when collaboration features ship:

| Feature | Free | Pro ($19/month) | Team ($29/seat/month) |
|---------|------|-----------------|----------------------|
| Everything in Free/Pro | Yes | Yes | Yes |
| Team workspace | -- | -- | Yes |
| Collaborative annotations | -- | -- | Yes |
| Real-time presence | -- | -- | Yes |
| Review workflows | -- | -- | Yes |
| Slack/Discord integration | -- | -- | Yes |
| Priority support | -- | -- | Email (24h) |
| Max team size | -- | -- | 50 |

### 8.3 Phase 5 Pricing (Months 6-12)

Add Enterprise tier when enterprise features ship:

| Feature | Team ($29/seat/month) | Enterprise ($59/seat/month) |
|---------|----------------------|-----------------------------|
| Everything in Team | Yes | Yes |
| SSO (SAML/OIDC) | -- | Yes |
| Audit logs | -- | Yes |
| RBAC | -- | Yes |
| Custom AI model support | -- | Yes |
| On-premises deployment | -- | Yes |
| SLA (99.9% uptime) | -- | Yes |
| Dedicated support (4h) | -- | Yes |
| SOC 2 compliance | -- | Yes |
| API (unlimited) | Standard | Unlimited + webhooks |
| Plugin marketplace access | Community | Community + premium |
| Max team size | 50 | Unlimited |

### 8.4 Phase 6 Pricing (Months 12-18)

Add vertical-specific pricing:

| Vertical | Base | Premium Features |
|----------|------|-----------------|
| Standard Enterprise | $59/seat/month | All enterprise features |
| FinTech | $99/seat/month | + Compliance mapping, risk scoring |
| Healthcare | $99/seat/month | + HIPAA compliance, PHI detection |
| Government | $149/seat/month | + FedRAMP, air-gapped, CUI marking |

### 8.5 Annual Discount Schedule

All tiers: 20% discount for annual billing.

| Tier | Monthly | Annual (per month) | Annual Total |
|------|---------|-------------------|--------------|
| Pro | $19 | $15.20 | $182.40 |
| Team | $29/seat | $23.20/seat | $278.40/seat |
| Enterprise | $59/seat | $47.20/seat | $566.40/seat |
| FinTech/Healthcare | $99/seat | $79.20/seat | $950.40/seat |
| Government | $149/seat | $119.20/seat | $1,430.40/seat |

---

## 9. Go-to-Market Timeline

### Quarter 1 (Months 1-3): "Go Where Developers Are"

| Week | Milestone | Channel | Expected Impact |
|------|-----------|---------|----------------|
| W1-2 | VS Code extension alpha (internal) | -- | Foundation |
| W3 | GitHub App beta (selected repos) | GitHub | 50 beta testers |
| W4 | VS Code extension beta (public) | VS Code Marketplace | 200 installs |
| W5-6 | "Understanding [Popular Repo] with BetterCodeWiki" blog series | Dev.to, Hashnode, HN | 5K visitors |
| W7-8 | VS Code extension v1.0 launch | HN, Reddit, Twitter/X, VS Code Marketplace | 1,000 installs |
| W9 | GitHub App v1.0 launch | Product Hunt, GitHub Marketplace | 100 installations |
| W10 | Stripe integration live, Pro tier available | In-product | First $1K MRR |
| W11-12 | Auto-doc-on-push shipping to all Pro users | Email to Pro users | 50% Pro retention |

**Q1 targets:** 1,000 VS Code installs, 100 GitHub App installs, 50 Pro subscribers ($950 MRR)

### Quarter 2 (Months 4-6): "Make It a Team Tool"

| Week | Milestone | Channel | Expected Impact |
|------|-----------|---------|----------------|
| W13-14 | Team workspaces beta | Invite-only | 20 beta teams |
| W15-16 | Annotations system launch | In-product | 10x engagement for team users |
| W17-18 | Slack integration launch | Slack App Directory | 50 workspace installs |
| W19-20 | Team tier launch ($29/seat) | Product Hunt (again), email | 30 Team subscriptions |
| W21-22 | Public wiki directory (top 1,000 repos) | SEO, social | 10K monthly visitors |
| W23-24 | Developer conference talks (2-3 conferences) | In-person | Brand awareness |

**Q2 targets:** 5,000 VS Code installs, 50 team workspaces, 200 paying customers ($15K MRR)

### Quarter 3 (Months 7-9): "Win Enterprise Trust"

| Week | Milestone | Channel | Expected Impact |
|------|-----------|---------|----------------|
| W25-28 | SSO + Audit logs + RBAC shipped | Direct outreach | Enterprise readiness |
| W29-30 | SOC 2 Type I audit completed | Security page | Enterprise gate cleared |
| W31-32 | Plugin SDK v1.0 + 5 first-party plugins | Developer blog, npm | Ecosystem kickoff |
| W33-34 | API v1 with documentation | Developer portal | 50 API integrations |
| W35-36 | First enterprise pilot program (3-5 companies) | Direct sales | $50-100K pipeline |

**Q3 targets:** 10K VS Code installs, 10 enterprise pilots, $50K MRR

### Quarter 4 (Months 10-12): "Scale Revenue"

| Week | Milestone | Channel | Expected Impact |
|------|-----------|---------|----------------|
| W37-40 | Enterprise tier launch ($59/seat) | Direct sales | First 5 enterprise deals |
| W41-42 | Plugin marketplace launch | Developer community | 10 third-party plugins |
| W43-44 | Public wiki directory (10,000 repos) | SEO | 50K monthly visitors |
| W45-48 | SOC 2 Type II observation period complete | Compliance | Enterprise gate cleared |

**Q4 targets:** 25K VS Code installs, 10 enterprise customers, 500 total paying customers ($100K MRR)

### Quarter 5-6 (Months 13-18): "Market Domination"

| Quarter | Key Milestones | Revenue Target |
|---------|---------------|----------------|
| Q5 | Japanese market launch, FinTech vertical, cross-repo intelligence | $200K MRR |
| Q6 | Chinese market entry, Healthcare vertical, FedRAMP prep, acquisitions | $500K-1M MRR |

---

## 10. Risk Matrix

### Phase 3 Risks (IDE & Real-Time)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| VS Code extension low adoption | Medium | High | Launch with compelling demo video; target Continue.dev and Copilot communities; ensure extension is genuinely useful in free tier |
| GitHub webhook reliability issues | Low | Medium | Implement webhook retry logic with exponential backoff; add manual "sync now" button as fallback |
| Incremental regeneration produces inconsistent docs | Medium | Medium | Fall back to full regeneration if incremental quality score is below threshold; A/B test incremental vs. full |
| API latency too high for IDE sidebar | Medium | High | Aggressive caching (SQLite in extension); pre-fetch wiki for all open files; lazy load diagrams |
| WebView performance in VS Code | Low | Medium | Optimize React bundle size; use virtual scrolling for long pages; profile and optimize render pipeline |

### Phase 4 Risks (Collaboration & Teams)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Low team adoption (single-player tool mentality) | High | Very High | Build viral invite mechanics; show clear ROI of team features; offer extended trial for teams |
| Real-time sync conflicts | Low | High | Use Yjs CRDT (conflict-free by design); extensive testing with simultaneous editors |
| Slack/Discord integration maintenance burden | Medium | Medium | Use official SDKs; build generic notification system that adapts to any platform |
| CODEOWNERS integration breaks on edge cases | Medium | Low | Make CODEOWNERS integration optional; fall back to manual reviewer assignment |
| Annotation anchoring breaks when AI regenerates content | High | Medium | Use fuzzy text matching for anchor repositioning; notify users when anchors move; allow manual re-anchoring |

### Phase 5 Risks (Platform & Ecosystem)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Plugin ecosystem does not attract developers | Medium | High | Build compelling first-party plugins to demonstrate value; offer bounties for community plugins; make SDK extremely easy to use |
| SSO implementation delays enterprise deals | Medium | Very High | Use managed SSO service (WorkOS) to ship faster; do not build from scratch |
| SOC 2 certification takes longer than expected | Medium | High | Start the process in Month 6 (before Phase 5 officially begins); hire a compliance consultant |
| API abuse (scraping, excessive generation) | Medium | Medium | Implement rate limiting (already have Redis planned); require API keys; monitor usage patterns |
| Custom model fine-tuning quality is poor | High | Medium | Set clear expectations; offer "model assessment" service; provide quality benchmarks; make fine-tuning optional, not required |

### Phase 6 Risks (Market Domination)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Google CodeWiki ships IDE extension and team features | High | Very High | Maintain speed advantage; compete on openness, privacy, and multi-provider; focus on segments Google neglects (GitLab/Bitbucket, self-hosted, regulated industries) |
| GitHub Copilot adds documentation features | High | High | Differentiate on depth (full wikis vs. inline docs); offer cross-platform support; emphasize living documentation |
| International expansion slows due to localization complexity | Medium | Medium | Start with Japanese (high value) and Chinese (high volume); use AI for translation; hire local community managers |
| Vertical solutions require deep domain expertise | High | Medium | Partner with domain experts rather than building in-house; hire advisors from FinTech/Healthcare |
| Public wiki directory attracts legal/copyright concerns | Low | High | Only process public repositories; respect robots.txt; provide opt-out mechanism for repository owners; consult with IP lawyer |
| Acquisition targets are overpriced or poorly integrated | Medium | Medium | Acqui-hire over technology acquisition; ensure cultural fit; start with small deals (<$3M) to build M&A muscle |

### Cross-Cutting Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI model costs exceed revenue | Medium | Very High | Implement tiered generation (cheaper models for free tier, premium for paid); cache aggressively; negotiate volume discounts with AI providers |
| Team burnout (small team, ambitious roadmap) | High | Very High | Hire aggressively in Q2; phase delivery realistically; cut scope if needed (better to ship 80% on time than 100% late) |
| Funding gap before enterprise revenue materializes | Medium | Very High | Bootstrap with Pro/Team revenue; seek seed funding ($1-3M) during Q2 to fund enterprise push; keep burn rate low |
| Security breach exposes customer code | Low | Critical | Security-first architecture (encryption at rest + in transit); regular penetration testing; bug bounty program; SOC 2 certification |

---

## 11. Immediate Next Steps: The First 5 Things to Build in Phase 3

### Priority 1: User Authentication System (Week 1-2)

**Why first:** Every subsequent feature (payments, workspaces, API keys, extension auth) depends on user accounts. This is the foundation.

**Specification:**
- OAuth 2.0 via GitHub (primary) and Google (secondary)
- JWT-based session management
- API key generation for programmatic access (VS Code extension, API)
- User profile storage (PostgreSQL)
- Session management (Redis)

**Technical implementation:**
```typescript
// New file: src/app/api/auth/github/route.ts
// GitHub OAuth flow:
// 1. Redirect to GitHub authorization URL
// 2. Handle callback with authorization code
// 3. Exchange code for access token
// 4. Fetch user profile from GitHub API
// 5. Create/update user in database
// 6. Issue JWT session token
// 7. Redirect to app with session cookie

// New middleware: src/middleware.ts
// Protect routes that require authentication
// Check JWT validity on every request to /api/* (except /api/auth/*)
```

**Database migration:** Create `users` table (see Section 7.4)
**Estimated effort:** 1 engineer, 2 weeks

### Priority 2: PostgreSQL Migration (Week 1-3)

**Why second:** The file-based wiki cache cannot support multi-user, multi-workspace, or incremental updates. PostgreSQL is required for all Phase 3+ features.

**Specification:**
- Migrate from JSON files on disk to PostgreSQL
- Create tables: `users`, `wikis`, `wiki_pages`, `file_page_index`, `generation_jobs`
- Implement data migration script for existing cached wikis
- Set up connection pooling (pg-pool)
- Add database health check endpoint

**Migration strategy:**
1. Deploy PostgreSQL alongside existing file cache
2. Write migration script that reads existing JSON caches and inserts into PostgreSQL
3. Update `api/api.py` to read/write from PostgreSQL instead of files
4. Keep file cache as fallback for 2 weeks, then remove

**Estimated effort:** 1 backend engineer, 3 weeks

### Priority 3: VS Code Extension Skeleton (Week 2-4)

**Why third:** The extension is the highest-impact differentiator. Starting the skeleton early allows parallel development while auth and database are being built.

**Specification (MVP):**
- Extension activates when a workspace contains a Git repository
- Sidebar panel shows "Connect to BetterCodeWiki" (authentication flow)
- Once connected, shows wiki tree structure for the current repo
- Clicking a tree item opens the wiki page in the sidebar (WebView with Markdown rendering)
- Basic context tracking: when the user switches files, highlight the relevant wiki section

**What is NOT in the MVP:**
- Hover documentation (Phase 3, Sprint 3)
- CodeLens (Phase 3, Sprint 3)
- Ask AI (Phase 3, Sprint 3)
- Offline cache (Phase 3, Sprint 4)

**Estimated effort:** 1 frontend engineer, 3 weeks

### Priority 4: Single-File Wiki Generation API (Week 3-5)

**Why fourth:** The VS Code extension needs to generate documentation for individual files on-demand, not just serve pre-generated full wikis. This is a new backend capability.

**Specification:**
- New endpoint: `POST /api/wiki/file` (see Section 3.1.4)
- Takes a repo URL + file path + provider/model
- Generates documentation for just that file (and its immediate dependencies)
- Returns structured wiki page content
- Caches the result in PostgreSQL for subsequent requests
- 5-15 second response time target

**Implementation approach:**
1. Extract the file content and its imports/dependencies
2. Build a focused prompt: "Generate documentation for this file in the context of these related files"
3. Use the existing AI client infrastructure (`openai_client.py`, etc.)
4. Cache the result with the file's git hash for invalidation

**Estimated effort:** 1 backend engineer, 2 weeks

### Priority 5: Stripe Integration (Week 4-6)

**Why fifth:** Revenue must start flowing as soon as possible. The Pro tier ($19/month) should be available when the VS Code extension launches.

**Specification:**
- Stripe Checkout for subscription creation
- Stripe Billing Portal for subscription management (upgrade, downgrade, cancel)
- Webhook handler for subscription events (created, updated, cancelled, payment failed)
- Plan enforcement: check user's plan before allowing premium features
- Usage tracking: count private repos, Ask AI questions, API calls per day

**Implementation:**
```typescript
// New file: src/app/api/billing/checkout/route.ts
// Creates a Stripe Checkout session for the selected plan

// New file: src/app/api/billing/webhook/route.ts
// Handles Stripe webhook events

// New file: src/app/api/billing/portal/route.ts
// Creates a Stripe Billing Portal session

// New component: src/components/PricingPage.tsx
// Displays pricing tiers with "Subscribe" buttons

// New middleware addition:
// Check user's plan and enforce limits (private repo count, daily question limit)
```

**Stripe products to create:**
- `bcw_pro_monthly` -- $19/month
- `bcw_pro_annual` -- $182.40/year ($15.20/month)

**Estimated effort:** 1 full-stack engineer, 2 weeks

---

## Appendix A: Technology Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | PostgreSQL | Best fit for relational data (users, workspaces, RBAC) + JSONB for wiki content; mature, well-supported |
| Cache | Redis | Session management, rate limiting, pub/sub for real-time; industry standard |
| Task Queue | Celery (Python) | Natural fit with existing FastAPI backend; supports scheduled tasks, retries, priorities |
| Real-time Collaboration | Yjs + Hocuspocus | CRDT-based (conflict-free), MIT licensed, used by Notion/Figma, excellent React bindings |
| Vector Database | Keep FAISS (Phase 3-4), migrate to Qdrant (Phase 5) | FAISS works for single-repo; Qdrant needed for cross-repo search at scale |
| Object Storage | AWS S3 or Cloudflare R2 | R2 preferred (no egress fees, S3-compatible API) |
| Hosting | Vercel (frontend) + AWS/Railway (backend) initially; Kubernetes at scale | Minimize infrastructure complexity early; K8s when >10 enterprise customers |
| SSO | WorkOS or Clerk Enterprise | Build vs. buy: SSO is complex and error-prone; managed service ships faster |
| Payments | Stripe | Industry standard for SaaS billing; excellent developer experience |
| VS Code Extension Framework | Standard VS Code Extension API + React (WebView) | Maximum control + code reuse from web app |
| Analytics | PostHog (self-hosted) | Open-source, self-hostable (important for privacy positioning), feature flags |

## Appendix B: Hiring Plan

| Role | Phase | Priority | Rationale |
|------|-------|----------|-----------|
| Senior Backend Engineer (Python/FastAPI) | 3 | P0 | Build auth, database migration, webhook system, API |
| Senior Frontend Engineer (React/TypeScript) | 3 | P0 | Build VS Code extension, workspace UI |
| DevOps/Infrastructure Engineer | 3-4 | P1 | Set up PostgreSQL, Redis, CI/CD, staging environments |
| Product Designer | 4 | P1 | Design collaboration UI, workspace experience, extension UX |
| Developer Advocate | 4 | P1 | Content marketing, conference talks, community management |
| Enterprise Sales Lead | 5 | P0 | Drive enterprise pipeline, manage pilots, close deals |
| Security Engineer | 5 | P1 | SOC 2 preparation, security audits, pen testing |
| Additional Backend Engineers (2) | 5-6 | P1 | Plugin system, API platform, vertical features |
| Additional Frontend Engineers (2) | 5-6 | P1 | Marketplace UI, enterprise admin dashboard |

**Team size trajectory:**
- Phase 3: 3-4 people (founders + 1-2 hires)
- Phase 4: 5-7 people
- Phase 5: 8-12 people
- Phase 6: 15-20 people

## Appendix C: Key Assumptions

1. **AI model costs will continue to decrease.** Current trend: 2-5x cost reduction per year for equivalent capability. This assumption underpins the free tier economics.
2. **Developer willingness to pay for AI tools will increase.** The success of Cursor ($100M+ ARR in <2 years) suggests this market is real and growing.
3. **GitHub will not build a comprehensive documentation tool.** GitHub's focus is on Copilot (code generation) and Actions (automation). Documentation remains a peripheral feature for them.
4. **Google CodeWiki will remain closed-source and Gemini-only.** Google's organizational incentives prevent them from supporting competing AI providers.
5. **Enterprise sales cycles are 3-6 months.** SOC 2 and SSO are hard gates. Pipeline must start 6 months before target revenue dates.
6. **The open-source community will contribute.** The existing contributor base and MIT license create favorable conditions for community growth, especially if the product gains traction.

---

*This plan should be reviewed monthly and adjusted based on actual metrics, market feedback, and resource availability. Phases are sequential in theme but may overlap in execution. The first 5 priorities in Section 11 are the critical path -- nothing else matters until these are shipping.*
