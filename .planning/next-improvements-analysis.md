# BetterCodeWiki: Comprehensive Product & Engineering Analysis

**Date:** 2026-02-20
**Codebase version:** commit `e4caae3` (main branch)

---

## Part 1: Current State Audit

### 1.1 Feature Inventory

| Feature | Status | Completeness | Notes |
|---------|--------|-------------|-------|
| Landing page with 3D hero | Shipped | 90% | Three.js KnowledgeCube + ParticleField. Respects `prefers-reduced-motion`. Mobile detection present. |
| Wiki generation (comprehensive/concise) | Shipped | 85% | XML-based structure determination, then sequential page generation via WebSocket with HTTP fallback. Caching works. |
| Multi-provider AI (Google, OpenAI, OpenRouter, Azure, Ollama, Bedrock, DashScope) | Shipped | 90% | Well-abstracted in backend. Frontend ConfigurationModal exposes provider/model selection. |
| RAG-powered Ask/Chat | Shipped | 80% | Conversation history, model selection per chat, WebSocket streaming. DeepResearch with multi-turn stages. |
| Mermaid diagrams | Shipped | 85% | Custom renderer with fullscreen expand, SVG pan-zoom, theme-aware styling. Structured DIAGRAM_DATA extraction from AI output. |
| Visual Explorer (React Flow) | Shipped | 70% | Merges diagram data from all pages, filters by architecture/dataflow/dependencies. Depth toggle. Needs more polish. |
| Slides mode | Shipped | 65% | AI-generated HTML slides from wiki data. Fullscreen, keyboard nav, export to HTML. But brittle HTML extraction from LLM output. |
| Workshop mode | Shipped | 65% | Generates hands-on tutorial from wiki data. Streaming, Markdown rendering. Auto-inserts TOC and progress indicators. |
| Export (Markdown, JSON, Notion, Confluence, HTML) | Shipped | 75% | Backend handles MD/JSON. Frontend ExportMenu adds Notion, Confluence, and HTML static site (JSZip). Notion/Confluence converters are client-side string transforms -- no API integration. |
| Command palette search (Cmd+K) | Shipped | 80% | Searches titles and content of generated pages. Clean UI with Framer Motion. |
| Reading mode | Shipped | 70% | Alt+R toggle. Increases font size and line height. Basic but functional. |
| Dependency graph | Shipped | 60% | Force-directed graph. Visible from wiki viewer but unclear how to invoke it. |
| MCP server | Shipped | 90% | Standalone, well-structured. 5 tools: list_projects, get_wiki_overview, get_wiki_page, search_wiki, ask_codebase. HTTP + stdio modes. |
| i18n | Shipped | 75% | 10 locales. Custom `t()` function. Some hardcoded English strings remain in slides/workshop pages. |
| Dark mode | Shipped | 85% | `next-themes` with selector strategy. Some components use hardcoded color values (`var(--card-bg)`, `var(--accent-primary)`) that may not match the design system tokens. |
| Processed Projects browser | Shipped | 70% | Grid/list toggle, search filter. But no sorting, no pagination, no metadata display (model used, page count). |
| Private repo support | Shipped | 80% | Personal access tokens for GitHub, GitLab, Bitbucket. No OAuth flow. |
| Docker deployment | Shipped | 80% | Single container with healthcheck. Memory limits configured. No horizontal scaling. |
| Authentication/auth code | Shipped | 60% | Optional auth code gate (`WIKI_AUTH_MODE`/`WIKI_AUTH_CODE`). Very basic -- single shared code, no user accounts. |

### 1.2 UI/UX Quality Assessment

**Strengths:**
- The landing page is visually striking. The 3D hero with KnowledgeCube and particle field creates a memorable first impression.
- The wiki viewer has a solid layout: sidebar with tree navigation, main content area with prose styling, table of contents panel.
- Design tokens are well-structured (using CSS custom properties like `--foreground`, `--border`, `--primary`).
- The ConfigurationModal provides a thoughtful pre-generation setup flow (language, provider, model, file filters).
- Keyboard shortcuts exist (Cmd+K search, Alt+R reading mode, Escape to close modals).

**Weaknesses:**
- The wiki viewer page (`[owner]/[repo]/page.tsx`) is a monolith -- over 2000 lines of code in a single component. This makes it brittle and hard to reason about.
- Style inconsistency: the wiki viewer uses `var(--card-bg)` and `var(--accent-primary)` (old design tokens), while the landing page uses the proper Tailwind/theme tokens (`bg-card`, `text-foreground`). The slides and workshop pages also use the old token pattern.
- Loading state during wiki generation is minimal -- just a spinner with text. For a process that can take 3-10 minutes for large repos, users get no progress indication (which page is being generated, how many remain).
- No skeleton loaders anywhere. Pages flash between empty and loaded states.
- The explorer page shows "No structured diagram data available" if the wiki was generated before the DIAGRAM_DATA feature was added, with no clear path to regeneration from that page.
- Navigation between wiki/slides/workshop/explore modes is not unified. Each mode is a separate route with its own header/nav. There is no shared navigation shell.

### 1.3 Backend Capabilities and Limitations

**Capabilities:**
- Multi-provider model abstraction with config-driven provider/model selection.
- RAG pipeline using adalflow + FAISS for semantic retrieval.
- WebSocket streaming for real-time content generation.
- File-based wiki cache (`~/.adalflow/wikicache/`) -- simple and effective for single-server deployment.
- Diagram data extraction from generated markdown content.
- Health check endpoint for container orchestration.

**Limitations:**
- **No database.** All state is in JSON files on disk. This prevents multi-instance deployment, user accounts, analytics, or any relational queries.
- **No rate limiting.** Any visitor can trigger expensive wiki generation (LLM calls, embedding creation, repo cloning). A single malicious user could rack up massive API bills.
- **No job queue.** Wiki generation is synchronous per WebSocket connection. If the connection drops, all progress is lost. No background processing, no retry, no resume.
- **No caching of intermediate results.** If page 7 of 12 fails, pages 1-6 must be regenerated. The cache is all-or-nothing (saved only when the frontend sends it back).
- **Repository cloning happens on every generation.** No caching of git clones. For large repos, this adds significant time.
- **CORS is wide open** (`allow_origins=["*"]`). Fine for local dev, problematic for production.
- **No request validation on WebSocket.** The `ChatCompletionRequest` is validated by Pydantic after receipt, but malformed messages could crash the handler.
- **Token limits are loosely enforced.** The `MAX_INPUT_TOKENS` constant in `rag.py` is 7500, but the actual enforcement is more of a warning than a hard limit.

### 1.4 User Journey Analysis

**Current journey (happy path):**
1. User lands on `/` -- sees 3D hero, repo input field
2. Enters a GitHub URL, clicks "Generate Wiki"
3. ConfigurationModal opens -- selects language, model, wiki type
4. Clicks "Generate" -- navigates to `/{owner}/{repo}?params...`
5. Wiki viewer checks cache, finds nothing, starts generation
6. Fetches repo structure via GitHub API (tree + README)
7. Sends structure to LLM to determine wiki sections/pages (1 LLM call)
8. Sequentially generates each page (8-12 LLM calls, one at a time)
9. First page appears quickly; user can start reading while rest generate
10. When all pages are done, wiki is cached on server

**Pain points in this journey:**
- **Step 2-3:** The default repo URL is hardcoded to `https://github.com/REDFOX1899/BetterCodeWiki` -- this should be empty or have a more helpful placeholder.
- **Step 5-8:** If the user navigates away and comes back, they get a cached version. But there is no indication of "freshness" -- when was this wiki generated? Is it outdated?
- **Step 8:** Sequential generation with `MAX_CONCURRENT = 1` means a 12-page wiki takes 12 serial LLM calls. This could be 5-15 minutes depending on model and repo size. No progress bar.
- **Error recovery:** If any step fails, the user sees a generic error. No "retry" button for individual pages. No partial cache saves.
- **Discoverability:** Users cannot discover wikis generated by others unless they visit `/wiki/projects`. There is no shareable URL pattern that works without query parameters.

---

## Part 2: Critical Gaps (Must Fix)

### 2.1 Performance Issues

**P0 -- Wiki generation is too slow for large repos**
- Sequential page generation (`MAX_CONCURRENT = 1`) is the primary bottleneck. Increasing concurrency to 2-3 would cut generation time significantly for most providers.
- No progress indicator beyond a text message. Users think the app is broken.
- **Fix:** Add a progress bar showing "Page 3 of 12: System Architecture". Allow 2-3 concurrent page generations. Save intermediate results to cache.

**P0 -- 3D landing page performance on low-end devices**
- Three.js canvas renders even on mobile. The `isMobile` check exists but still renders the Canvas, just at lower quality.
- The landing page ships ~500KB of Three.js code even if the user only wants to enter a URL.
- **Fix:** Lazy-load the 3D scene on user interaction or after initial paint. Show a static hero image for first paint. Use `loading="lazy"` pattern for the canvas.

**P1 -- No debounce on repo input**
- `handleRepositoryInputChange` calls `loadConfigFromCache` on every keystroke. For users pasting URLs, this is fine. For typing, it triggers localStorage reads on every character.
- **Fix:** Debounce the config lookup by 300ms.

### 2.2 Error Handling Gaps

**P0 -- WebSocket connection failures are silent**
- The WebSocket fallback to HTTP exists but errors are only logged to console. Users see no indication that their connection mode changed.
- If both WebSocket and HTTP fail, the error message is generic: "Error generating content."
- **Fix:** Show a toast notification when falling back to HTTP. Show specific, actionable error messages.

**P0 -- No retry mechanism for failed page generation**
- If a page fails (LLM timeout, rate limit, malformed response), it stays as "Error generating content" forever.
- **Fix:** Add a "Retry" button per page. Implement exponential backoff for LLM API calls.

**P1 -- XML parsing of wiki structure is fragile**
- The LLM is asked to return XML. If the response contains malformed XML (common with some models), `DOMParser` fails.
- The regex fallback exists but is limited.
- **Fix:** Use a more robust parser. Consider switching to JSON output format with a JSON schema. Most modern LLMs handle structured JSON output better than XML.

### 2.3 Missing Loading States

**P0 -- No generation progress indicator**
- During the 5-15 minute wiki generation, users see only "Initializing wiki generation..." or "Determining wiki structure..."
- **Fix:** Show a multi-step progress indicator: (1) Fetching repo structure, (2) Planning wiki layout, (3) Generating page X of Y, (4) Finalizing.

**P1 -- No skeleton loaders for page content**
- When switching between wiki pages, there is a flash of "Loading..." text.
- **Fix:** Use skeleton loaders that match the prose layout.

### 2.4 Authentication & Rate Limiting

**P0 -- No rate limiting on LLM endpoints**
- Any visitor can trigger unlimited wiki generations, each costing real money in API calls.
- **Fix:** Implement per-IP rate limiting (e.g., 3 wiki generations per hour for unauthenticated users). Add server-side rate limiting middleware.

**P1 -- No user accounts**
- All wiki generation is anonymous. No way to track who generated what, limit usage, or provide a personalized experience.
- **Fix (short-term):** Add optional GitHub OAuth for identity. Store user ID with cached wikis.
- **Fix (long-term):** Full user account system with usage quotas.

### 2.5 Mobile Responsiveness

**P1 -- Wiki viewer sidebar is not mobile-friendly**
- The sidebar tree view takes fixed width. On mobile screens, it likely overlaps or is hidden.
- **Fix:** Implement a drawer/sheet pattern for the sidebar on mobile. Use `md:` breakpoint consistently.

**P1 -- Configuration modal may overflow on small screens**
- The ConfigurationModal has many fields and may not scroll properly on mobile.
- **Fix:** Make the modal a full-screen sheet on mobile with proper scroll handling.

### 2.6 SEO and Discoverability

**P0 -- Entire app is client-rendered ('use client' everywhere)**
- The landing page, wiki viewer, and all routes are client-side rendered. Search engines cannot index any wiki content.
- No `<meta>` tags, no Open Graph tags, no structured data.
- **Fix (Phase 1):** Add metadata generation for wiki pages using Next.js `generateMetadata`. Even with client rendering, the route structure helps.
- **Fix (Phase 2):** Make the landing page and project browser server-rendered. Wiki pages can remain client-rendered since they require dynamic data.

**P1 -- URLs contain sensitive data in query params**
- The wiki URL includes `?token=...&provider=...&model=...`. Access tokens in URLs are a security risk (they appear in server logs, browser history, and referrer headers).
- **Fix:** Move tokens to HTTP-only cookies or session storage. Pass provider/model as path segments or hash params.

---

## Part 3: High-Impact Features to Add

### 3.1 Generation Progress Dashboard (User Value: 10/10)
**What:** A real-time progress view during wiki generation showing: current step, pages completed/total, estimated time remaining, and the ability to read already-generated pages while the rest finish.
**Why:** The current blank loading screen is the #1 reason users will abandon the product. Making the wait transparent and useful transforms a liability into a feature.
**Complexity:** M (frontend changes + backend progress events)
**Files:** `src/app/[owner]/[repo]/page.tsx`, `api/websocket_wiki.py`, new `src/components/GenerationProgress.tsx`

### 3.2 Shareable Wiki URLs (User Value: 9/10)
**What:** Clean URLs like `bettercodewiki.com/github/facebook/react` that serve cached wikis without query parameters. Add Open Graph meta tags so links preview nicely on Slack/Twitter/Discord.
**Why:** The single most important growth mechanism is people sharing wiki links. Current URLs with query params are ugly and contain sensitive data.
**Complexity:** M (URL restructuring + server-side metadata)
**Files:** `src/app/[owner]/[repo]/page.tsx`, `next.config.ts`, new `src/app/[owner]/[repo]/layout.tsx`

### 3.3 Wiki Freshness & Regeneration (User Value: 8/10)
**What:** Show when a wiki was last generated. Compare against the repo's latest commit. Offer one-click regeneration of stale wikis. Allow regenerating individual pages.
**Why:** Wikis become outdated quickly. Users need to trust the content is current. Individual page regeneration saves time when only one section changed.
**Complexity:** M (cache metadata + GitHub API commit check + per-page regeneration)
**Files:** `api/api.py` (add timestamp/commit SHA to cache), `src/app/[owner]/[repo]/page.tsx`

### 3.4 Full-Text Search Across All Wikis (User Value: 8/10)
**What:** A global search that finds content across all cached wikis. Think of it as a documentation search engine.
**Why:** Once you have dozens of cached wikis, finding specific patterns, architectures, or implementations across projects becomes incredibly valuable.
**Complexity:** L (requires a search index -- could start with simple in-memory search, scale to something like MeiliSearch)
**Files:** New `api/search.py`, new `src/app/search/page.tsx`, `api/api.py`

### 3.5 GitHub OAuth + User Accounts (User Value: 8/10)
**What:** "Sign in with GitHub" button. Lets users access private repos without manually copying tokens. Associates wikis with user accounts. Enables usage tracking and quotas.
**Why:** Private repos are where the real value is. Making auth frictionless is essential for enterprise adoption. Also enables rate limiting per user.
**Complexity:** L (OAuth flow + user session management + database)
**Files:** New `api/auth/` module, new `src/components/AuthProvider.tsx`, `api/api.py`

### 3.6 CI/CD Integration -- Auto-Regenerate on Push (User Value: 7/10)
**What:** A GitHub webhook or GitHub Action that automatically regenerates a wiki when code is pushed to the main branch.
**Why:** Keeps wikis perpetually fresh without manual intervention. The "set it and forget it" dream.
**Complexity:** L (webhook receiver + background job system + GitHub App or Action)
**Files:** New `api/webhooks.py`, new `github-action/` directory

### 3.7 Wiki Diff View (User Value: 7/10)
**What:** When a wiki is regenerated, show a diff of what changed. Highlight new sections, modified explanations, and removed content.
**Why:** Understanding what changed in the documentation when code changes is incredibly useful for code review and onboarding.
**Complexity:** L (requires versioning of wiki content + diff algorithm)
**Files:** New `src/components/WikiDiff.tsx`, cache versioning in `api/api.py`

### 3.8 Custom Wiki Templates / Prompt Customization (User Value: 7/10)
**What:** Let users customize what gets generated. Choose from templates (API Documentation, Architecture Guide, Onboarding Guide, Security Audit) or write custom prompts.
**Why:** Different users need different documentation. A DevOps engineer wants deployment docs; a new hire wants an onboarding guide; a security reviewer wants a threat model.
**Complexity:** M (template system + prompt customization UI)
**Files:** `api/prompts.py`, new `src/components/TemplateSelector.tsx`, `src/app/[owner]/[repo]/page.tsx`

### 3.9 API Documentation Extraction (User Value: 7/10)
**What:** Auto-detect REST/GraphQL APIs in the codebase and generate structured API documentation with request/response examples, parameter tables, and endpoint graphs.
**Why:** API documentation is the most commonly needed and most commonly outdated form of documentation. Auto-generating it from source code is enormously valuable.
**Complexity:** L (requires parsing OpenAPI specs, route decorators, GraphQL schemas)
**Files:** New `api/extractors/api_docs.py`, new wiki template

### 3.10 Embed Widget (User Value: 6/10)
**What:** An embeddable `<iframe>` or web component that renders a single wiki page. Can be embedded in README files, internal dashboards, or other documentation sites.
**Why:** Extends the reach of generated documentation beyond the BetterCodeWiki site.
**Complexity:** S (new route that renders a single page in embed mode)
**Files:** New `src/app/embed/[owner]/[repo]/[pageId]/page.tsx`

### 3.11 Comparison View (User Value: 5/10)
**What:** Side-by-side comparison of architecture between two repos, two branches, or two points in time.
**Why:** Useful for migration planning, architecture reviews, and understanding how a project evolved.
**Complexity:** XL (requires multi-wiki loading, alignment algorithm, diff UI)
**Files:** New `src/app/compare/page.tsx`, significant new backend logic

### 3.12 Notifications -- Wiki Outdated Alerts (User Value: 5/10)
**What:** Email or in-app notification when a wiki is significantly outdated (e.g., 50+ commits since generation).
**Why:** Keeps documentation relevant without manual checking.
**Complexity:** L (requires user accounts + notification infrastructure + commit tracking)
**Files:** New notification service, user preferences

---

## Part 4: UX Improvements

### 4.1 Navigation Flow

**Current problem:** Each mode (wiki, slides, workshop, explore) is a separate island with its own header. Navigating between them requires browser back/forward or constructing URLs manually.

**Recommendation:** Create a shared navigation shell for the `[owner]/[repo]` routes with a tab bar:
```
[Wiki] [Explorer] [Slides] [Workshop] [Ask]
```
This shell should preserve query parameters and provide a consistent experience.

**Files to change:** Create `src/app/[owner]/[repo]/layout.tsx` with shared navigation. Refactor each page to work within this layout.

### 4.2 Information Architecture

**Current problem:** The wiki sidebar shows a flat or shallowly-nested list of pages. For comprehensive wikis with 12+ pages organized into sections, this can be overwhelming.

**Recommendations:**
- Add collapsible sections in the sidebar tree view (already partially implemented in `WikiTreeView.tsx`).
- Add breadcrumbs in the content area showing the current section > page hierarchy.
- Add "Previous / Next" navigation at the bottom of each page for linear reading.
- Show page importance visually (e.g., star icon for high-importance pages).

### 4.3 Accessibility

**Issues found:**
- The 3D canvas has no `aria-label` and is not keyboard-navigable. Users relying on screen readers get no content from the hero section.
- Color contrast has not been audited. The `text-muted-foreground` on `bg-background` may not meet WCAG AA in some theme configurations.
- The search command palette traps focus correctly (good), but the slides page lacks focus management.
- No skip-to-content link on any page.
- The `dangerouslySetInnerHTML` in slides renders arbitrary HTML without sanitization. This is an XSS risk and an accessibility nightmare (no semantic structure guaranteed).

**Recommendations:**
- Add `aria-hidden="true"` to the 3D canvas and provide a text-based fallback.
- Add a skip-to-content link.
- Audit all color combinations with a contrast checker.
- Sanitize HTML in slides mode using DOMPurify.
- Add `role="main"`, `role="navigation"`, and landmark roles.

### 4.4 Dark Mode Completeness

**Issues:**
- The wiki viewer uses inline styles with `var(--card-bg)` and `var(--accent-primary)` which are remnants from a previous design system. These do not align with the Tailwind theme tokens used on the landing page.
- The slides page hardcodes `#0d1117` (GitHub dark) backgrounds. In light mode, this would look jarring if the user switches themes.
- Code blocks force dark backgrounds (`#1e1e1e !important`) in both light and dark mode. This is intentional for VS Code aesthetics but may surprise users.

**Recommendation:** Migrate all remaining `var(--card-bg)`, `var(--accent-primary)`, etc. to Tailwind's theme-aware classes (`bg-card`, `text-primary`, etc.). Keep code blocks dark-on-dark as a deliberate choice but document it.

### 4.5 Animations Assessment

**What adds value:**
- The scroll-aware nav opacity transition is smooth and professional.
- Framer Motion on quick-start cards provides subtle feedback.
- The 3D knowledge cube is a memorable brand element.

**What might distract:**
- `FloatingElements` (background decorative elements) may cause layout shift or performance issues on slower devices.
- The GSAP + Lenis smooth scroll combination adds weight. The `ScrollAnimationProvider` wraps the entire landing page -- verify it does not interfere with native scroll behavior on touch devices.

---

## Part 5: Technical Debt & Infrastructure

### 5.1 Code Quality Issues

**Critical: Monolith page component**
- `src/app/[owner]/[repo]/page.tsx` is 2000+ lines and manages wiki structure determination, page content generation, GitHub/GitLab/Bitbucket API calls, caching, state management, export, authentication, and rendering -- all in a single component.
- **Recommendation:** Extract into:
  - `useWikiGeneration()` -- custom hook for generation logic
  - `useRepoStructure()` -- custom hook for fetching repo tree
  - `useWikiCache()` -- custom hook for cache management
  - `WikiContent.tsx` -- content rendering component
  - `WikiSidebar.tsx` -- sidebar component (partially exists as `WikiTreeView`)
  - `WikiHeader.tsx` -- header/toolbar component

**Moderate: Duplicated code across page components**
- The `addTokensToRequestBody` helper function is copy-pasted into `page.tsx`, `slides/page.tsx`, and `workshop/page.tsx`.
- The WebSocket connection pattern (open, send, accumulate, close with timeout and HTTP fallback) is duplicated 6+ times.
- Interface definitions (`WikiPage`, `WikiSection`, `WikiStructure`) are redefined in at least 5 files.
- **Recommendation:** Create shared utilities: `src/utils/addTokens.ts`, `src/utils/websocketRequest.ts`, `src/types/wiki.ts`.

**Moderate: `eslint-disable` directives**
- 15 `eslint-disable` comments across 8 files, mostly suppressing `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars`.
- **Recommendation:** Address the underlying type issues rather than suppressing warnings.

**Minor: Inconsistent naming**
- Backend cache files use `deepwiki_cache_` prefix (legacy from DeepWiki-Open). The app is now "BetterCodeWiki" but internal identifiers still reference "deepwiki".
- The Docker compose service is named `deepwiki`.
- The health check response says `"service": "deepwiki-api"`.
- **Recommendation:** Gradually rename to `bettercodewiki` in a dedicated cleanup commit.

### 5.2 Testing Gaps

**Current state:**
- `test/` directory: 1 test file (`test_extract_repo_name.py`).
- `tests/` directory: API tests, unit tests for embedders, one integration test, one unexplained test (`test_vigilant_sanderson.py`).
- **No frontend tests at all.** No unit tests, no component tests, no E2E tests.

**Critical gaps:**
- No tests for wiki generation flow (structure determination, page generation, caching).
- No tests for the WebSocket handler.
- No tests for export functionality.
- No tests for the MCP server tools.
- No frontend component tests.

**Recommendation:**
1. Add pytest tests for `api/api.py` endpoints (cache CRUD, export, health).
2. Add pytest tests for `api/websocket_wiki.py` (mock LLM responses).
3. Add pytest tests for `api/mcp/server.py` (all 5 tools).
4. Add Vitest or Jest tests for frontend utilities (`urlDecoder.ts`, `getRepoUrl.ts`).
5. Add Playwright E2E tests for the core flow (enter URL -> generate -> view wiki).

### 5.3 Deployment and Scaling

**Current:** Single Docker container running both frontend and backend. No load balancer. File-based cache.

**Scaling limitations:**
- Cannot run multiple instances (file-based cache is not shared).
- No CDN for static assets.
- No Redis or equivalent for session state.
- WebSocket connections are server-specific (no sticky sessions or pub/sub).

**Recommendations for scale:**
1. **Phase 1:** Add Redis for cache storage instead of files. This enables multi-instance deployment.
2. **Phase 2:** Separate frontend and backend into distinct containers. Put the frontend behind a CDN (Vercel, Cloudflare Pages).
3. **Phase 3:** Add a job queue (Celery + Redis, or BullMQ) for wiki generation. WebSockets push progress updates; generation happens asynchronously.
4. **Phase 4:** Add PostgreSQL for user accounts, wiki metadata, analytics.

### 5.4 Monitoring and Observability

**Current state:** File-based logging (`api/logs/application.log`). Health check endpoint. No metrics, no tracing, no alerting.

**Recommendations:**
1. Add structured logging (JSON format) for easier parsing.
2. Add OpenTelemetry tracing for LLM calls (track latency, token usage, costs per generation).
3. Add Prometheus metrics: generation count, generation duration, cache hit rate, error rate by provider.
4. Add error tracking (Sentry or equivalent).
5. Track LLM costs per wiki generation and expose them in the admin dashboard.

---

## Part 6: Growth & Adoption Strategy

### 6.1 Getting the First 1000 Users

**Channels:**
1. **Product Hunt launch** -- The 3D landing page and visual output are demo-friendly. Create a compelling video showing the before (reading raw code) and after (navigating a beautiful wiki).
2. **Hacker News / Reddit (r/programming, r/webdev)** -- Post with the angle: "We auto-generate interactive documentation for any GitHub repo."
3. **Dev Twitter/X** -- Generate wikis for trending open-source projects (Bun, Deno, Next.js) and share the results. Tag the maintainers. This creates viral organic content.
4. **GitHub topic indexing** -- Add BetterCodeWiki as a topic on GitHub. Create an awesome-list entry.
5. **Discord/Slack communities** -- Developer communities where people ask "how does X work?" Share wiki links as answers.

**Activation tactics:**
- Pre-generate wikis for the top 100 GitHub repos. Let users browse immediately without waiting.
- Add a "Powered by BetterCodeWiki" footer to generated wikis with a link back.
- Make the `/wiki/projects` page public and SEO-indexable as a showcase.

### 6.2 Competitive Differentiation

**Why choose BetterCodeWiki over reading code on GitHub?**
1. **Visual diagrams** -- Mermaid architecture diagrams, data flow visualizations, and the visual explorer give understanding that raw code cannot.
2. **Multi-language wikis** -- Generate documentation in 10 languages. This is huge for non-English-speaking developers.
3. **Interactive Q&A** -- The Ask feature lets you have a conversation with the codebase, grounded in actual code.
4. **Workshop generation** -- Auto-generated onboarding tutorials are unique and immediately valuable for teams.
5. **MCP integration** -- AI agents can query the wiki in real-time, making it a living documentation layer.

**Competitors to watch:**
- GitHub Copilot Workspace (code understanding)
- Swimm (documentation for code)
- Mintlify (docs from code)
- ReadMe (API documentation)

### 6.3 Community Features

1. **Public wiki gallery** -- A browsable collection of wikis for popular open-source projects. Drives SEO and organic traffic.
2. **Wiki ratings / feedback** -- Let users rate wiki quality and suggest improvements. Feed this back to improve prompts.
3. **Collaborative annotations** -- Let users add notes, corrections, or "gotchas" to wiki pages. Think of it as a documentation layer over the AI-generated base.
4. **"Fork a wiki"** -- Take someone's public wiki and customize it (change model, add sections, adjust prompts).

### 6.4 Pricing Model Considerations

**Recommended model: Freemium with usage tiers**

| Tier | Price | Limits |
|------|-------|--------|
| Free | $0/mo | 3 wiki generations/month, public repos only, community models |
| Pro | $15/mo | 20 generations/month, private repos, all models, priority generation |
| Team | $40/user/mo | Unlimited generations, shared workspace, CI/CD integration, custom templates |
| Enterprise | Custom | Self-hosted option, SSO, audit logs, dedicated support |

**Revenue considerations:**
- LLM API costs are the primary COGS. A single comprehensive wiki generation can cost $0.50-$5.00 in API calls depending on the model and repo size.
- Offering BYO API key as a free tier option reduces costs while still acquiring users.
- The MCP server adds value for Pro/Team tiers as an AI agent integration layer.

---

## Part 7: Prioritized Roadmap

### Phase 1: Quick Wins (1-5 days each)

| # | Item | Impact | Effort | Notes |
|---|------|--------|--------|-------|
| 1.1 | **Generation progress indicator** | High | S | Show "Generating page X of Y: {title}" with a progress bar. Change only frontend. |
| 1.2 | **Increase page generation concurrency to 2-3** | High | S | Change `MAX_CONCURRENT = 1` to `3` in `page.tsx`. Test with multiple providers. |
| 1.3 | **Debounce repo input config lookup** | Low | S | Add 300ms debounce to `handleRepositoryInputChange`. |
| 1.4 | **Add per-page retry button** | High | S | When page generation fails, show a "Retry" button instead of static error text. |
| 1.5 | **Fix URL security -- remove tokens from query params** | High | S | Store access token in `sessionStorage` instead of URL. |
| 1.6 | **Extract shared types to `src/types/wiki.ts`** | Medium | S | Remove 5 duplicate interface definitions. |
| 1.7 | **Extract shared WebSocket utility** | Medium | M | Create `src/utils/websocketRequest.ts` with timeout, fallback, and error handling. |
| 1.8 | **Add metadata to cached wikis** | Medium | S | Store generation timestamp, commit SHA, provider/model in cache file. |
| 1.9 | **Clean up "deepwiki" naming** | Low | S | Rename references in Docker compose, health check, and user-facing strings. |
| 1.10 | **Add skip-to-content link and aria labels** | Medium | S | Basic accessibility improvement. |

### Phase 2: Core Polish (1-2 weeks)

| # | Item | Impact | Effort | Notes |
|---|------|--------|--------|-------|
| 2.1 | **Shared navigation layout for `[owner]/[repo]/*`** | High | M | Create a layout.tsx with tab navigation between Wiki/Explorer/Slides/Workshop/Ask. |
| 2.2 | **Refactor wiki viewer into composable hooks** | High | L | Extract `useWikiGeneration`, `useRepoStructure`, `useWikiCache` from the 2000-line monolith. |
| 2.3 | **Clean URL structure** | High | M | `/github/facebook/react` instead of `/facebook/react?type=github&...`. Preserve backward compat with redirects. |
| 2.4 | **Rate limiting middleware** | High | M | Add per-IP rate limiting on wiki generation endpoints. Use in-memory store (later Redis). |
| 2.5 | **Skeleton loaders** | Medium | S | Add skeleton components for wiki content, sidebar, and page transitions. |
| 2.6 | **Migrate remaining old design tokens** | Medium | M | Replace all `var(--card-bg)`, `var(--accent-primary)` with Tailwind theme classes in slides/workshop pages. |
| 2.7 | **Add basic frontend tests** | Medium | M | Vitest tests for utilities + Playwright smoke test for core flow. |
| 2.8 | **Add backend test coverage** | Medium | M | pytest tests for API endpoints, cache operations, and MCP tools. |
| 2.9 | **Wiki freshness indicator** | Medium | M | Show "Generated 3 days ago" badge. Compare against latest commit if available. |
| 2.10 | **Improve XML parsing robustness** | Medium | S | Add JSON output option for wiki structure. Fall back gracefully. |

### Phase 3: Differentiators (2-4 weeks each)

| # | Item | Impact | Effort | Notes |
|---|------|--------|--------|-------|
| 3.1 | **GitHub OAuth** | High | L | Sign in with GitHub. Auto-fill repos. Access private repos without manual tokens. |
| 3.2 | **Pre-generated wiki gallery** | High | L | Generate wikis for top 100 GitHub repos. Make them browsable and SEO-indexed. |
| 3.3 | **Custom wiki templates** | High | M | Template selector: "Architecture Guide", "API Documentation", "Onboarding Guide", "Security Review". |
| 3.4 | **Full-text search across all wikis** | High | L | Global search page with indexed content from all cached wikis. |
| 3.5 | **Per-page regeneration** | Medium | M | Regenerate a single page without regenerating the entire wiki. |
| 3.6 | **Background job queue for generation** | High | L | Decouple generation from WebSocket. Allow users to leave and come back. |
| 3.7 | **Embed widget** | Medium | S | `/embed/{owner}/{repo}/{pageId}` route for iframe embedding. |
| 3.8 | **SEO metadata for wiki pages** | Medium | M | Open Graph tags, structured data, server-rendered titles/descriptions. |
| 3.9 | **API documentation extraction** | High | XL | Auto-detect and document REST/GraphQL APIs from code. |
| 3.10 | **Collaborative annotations** | Medium | L | Users can add notes/corrections to wiki pages. Requires user accounts. |

### Phase 4: Scale (ongoing)

| # | Item | Impact | Effort | Notes |
|---|------|--------|--------|-------|
| 4.1 | **PostgreSQL for user data and metadata** | High | L | Replace file-based cache with database-backed storage. |
| 4.2 | **Redis for caching and sessions** | High | M | Enable multi-instance deployment. |
| 4.3 | **CDN deployment for frontend** | Medium | M | Deploy Next.js to Vercel or Cloudflare. Backend stays on separate infra. |
| 4.4 | **CI/CD webhook integration** | High | L | GitHub webhooks or GitHub Action for auto-regeneration on push. |
| 4.5 | **Wiki versioning and diff view** | High | XL | Store version history. Show diffs between generations. |
| 4.6 | **OpenTelemetry observability** | Medium | M | Tracing, metrics, and cost tracking for LLM calls. |
| 4.7 | **Self-hosted enterprise offering** | High | L | Helm chart, SSO integration, audit logging. |
| 4.8 | **Multi-tenant isolation** | Medium | L | Ensure user data, wikis, and API keys are properly isolated. |

---

## Summary

BetterCodeWiki has a solid foundation: the core wiki generation works, the UI design language is strong, multi-provider support is well-implemented, and features like the Visual Explorer and MCP server are genuine differentiators. The 3D landing page creates a premium first impression.

The most critical areas to address are:

1. **Generation experience** -- Users currently face a 5-15 minute wait with minimal feedback. Adding progress indicators, increased concurrency, and retry mechanisms will dramatically improve the experience.

2. **Code architecture** -- The 2000-line monolith wiki viewer component needs to be broken up before it becomes unmaintainable. Shared types and utilities should be extracted.

3. **Security and rate limiting** -- Open CORS, tokens in URLs, and no rate limiting are production blockers.

4. **Growth infrastructure** -- Clean URLs, SEO metadata, and a public wiki gallery are essential for organic growth.

The product has the potential to be the go-to tool for understanding codebases. The key is to focus on making the generation experience delightful (Phase 1-2) while building toward features that create network effects and lock-in (Phase 3-4).
