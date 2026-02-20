# Diagram Vision Research: Next-Generation Visual Code Understanding

**BetterCodeWiki -- Product Research & Creative Strategy Document**
**Date:** February 2026
**Author:** Product Research Team
**Status:** Strategic Research -- Ready for Executive Review

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Competitor Analysis](#2-competitor-analysis)
3. [Next-Gen Diagram Features to Build](#3-next-gen-diagram-features-to-build)
4. [Dedicated Diagram Page vs Integrated Approach](#4-dedicated-diagram-page-vs-integrated-approach)
5. [Technical Implementation Research](#5-technical-implementation-research)
6. [Proposed Roadmap](#6-proposed-roadmap)
7. [What Will Make This Go Viral](#7-what-will-make-this-go-viral)

---

## 1. Current State Analysis

### 1.1 How Diagrams Work Today

BetterCodeWiki currently renders diagrams exclusively through **Mermaid.js v11.4.1** via a custom React component at `src/components/Mermaid.tsx` (823 lines). The rendering pipeline works as follows:

1. **AI Generation**: When generating wiki pages, the LLM is prompted to "EXTENSIVELY use Mermaid diagrams (e.g., `flowchart TD`, `sequenceDiagram`, `classDiagram`, `erDiagram`, `graph TD`)" -- this is hardcoded in the wiki generation prompt in `src/app/[owner]/[repo]/page.tsx` (line 599-633).

2. **Markdown Parsing**: The `src/components/Markdown.tsx` component detects code blocks with language `mermaid` and routes them to the `<Mermaid>` component instead of the syntax highlighter (line 172-181).

3. **SVG Rendering**: Mermaid.js renders the diagram text into SVG using `mermaid.render()`. The SVG is injected via `dangerouslySetInnerHTML`.

4. **Theme Support**: Dual theme support (light/dark) is implemented with comprehensive CSS variable mapping -- approximately 450 lines of theme configuration covering every Mermaid element type.

5. **Pan/Zoom**: The optional `svg-pan-zoom` library (v3.6.2) is dynamically imported for zoomable diagrams.

6. **Fullscreen Modal**: Click-to-expand opens a modal with manual zoom controls (50%-200% range).

### 1.2 Diagram Types Currently Generated

The AI prompt explicitly requests these Mermaid diagram types:

| Diagram Type | Directive | Current Usage |
|---|---|---|
| Flow diagrams | `flowchart TD` / `graph TD` | Primary -- used for architecture overviews, process flows |
| Sequence diagrams | `sequenceDiagram` | Common -- used for request/response flows, API interactions |
| Class diagrams | `classDiagram` | Moderate -- used for OOP class hierarchies |
| ER diagrams | `erDiagram` | Moderate -- used for database schemas |
| State diagrams | `stateDiagram` | Rare -- styling exists but not heavily prompted |
| Pie charts | `pie` | Rare -- styling exists |
| Gantt charts | `gantt` | Rare -- styling exists |
| Git graphs | `gitGraph` | Rare -- styling exists |

The prompt enforces **vertical (top-down) orientation** for flow diagrams (`graph TD`) and explicitly forbids `graph LR` (left-right). Sequence diagrams have detailed syntax guidance including all 8 arrow types, activation boxes, grouping, and structural elements (loop, alt, opt, par, critical, break).

### 1.3 Existing Non-Mermaid Visualization: DependencyGraph

A custom force-directed graph component exists at `src/components/DependencyGraph.tsx`. This is a hand-built SVG visualization (not using any graph library) that:

- Renders wiki page relationships as an interactive node-edge graph
- Implements its own force-directed layout algorithm (repulsion, attraction, center gravity, damping)
- Supports pan and zoom via manual SVG viewBox manipulation
- Color-codes nodes by importance (high/medium/low) and highlights the current page
- Has a 200-node limit
- Opens as a modal overlay triggered from a "Graph" button in the header

This demonstrates the team already has experience building custom interactive visualizations beyond Mermaid.

### 1.4 Existing Technical Foundation

The project already includes several libraries that are highly relevant to diagram innovation:

| Library | Version | Current Use | Diagram Potential |
|---|---|---|---|
| `@react-three/fiber` | 9.5.0 | Landing page 3D hero (KnowledgeCube, ParticleField) | 3D diagram exploration |
| `@react-three/drei` | 10.7.7 | Landing page helpers | 3D diagram utilities |
| `three` | 0.183.1 | Three.js core | 3D rendering engine |
| `gsap` | 3.14.2 | Landing page scroll animations | Scroll-triggered diagram reveals |
| `@gsap/react` | 2.1.2 | GSAP React integration | ScrollTrigger for diagrams |
| `framer-motion` | 12.34.3 | Page transitions, UI animations | Diagram transition animations |
| `lenis` | 1.3.17 | Smooth scrolling | Scroll-synced diagram exploration |
| `svg-pan-zoom` | 3.6.2 | Mermaid zoom | Already in use |

**Key insight**: The team has already invested in Three.js/R3F, GSAP, and Framer Motion. These are exactly the libraries needed for next-generation diagram features. The foundation is already laid.

### 1.5 Current Limitations

1. **Static rendering**: Diagrams are rendered once as static SVG. No animation beyond a CSS `stroke-dashoffset` flow animation on arrows.
2. **No interactivity**: Cannot click nodes to get more information, drill down, or filter.
3. **No progressive disclosure**: The entire diagram renders at once. Large diagrams for complex codebases become unreadable.
4. **Text-only labels**: Nodes contain only text. No icons, logos, or visual indicators of technology type.
5. **No connection to source code**: Diagram nodes cannot link back to actual files or code sections.
6. **No diff awareness**: Diagrams do not show how architecture changed over time.
7. **Single representation**: Each concept gets one diagram. No ability to switch between views (high-level vs. detailed, data flow vs. dependency, etc.).
8. **Layout limitations**: Mermaid's built-in layout engine (dagre) produces acceptable but not beautiful layouts. No manual layout adjustment.
9. **No semantic understanding**: Diagrams do not distinguish between types of connections (HTTP calls vs. database queries vs. event bus vs. imports).
10. **Mobile experience**: Diagrams are often too complex to read on mobile devices. No responsive simplification.

---

## 2. Competitor Analysis

### 2.1 Google CodeWiki

Google Code Wiki (launched late 2025, public preview) is the most direct competitor. Key features:

**What they do well:**
- **Always-current diagrams**: Diagrams auto-refresh as code changes -- they are never stale
- **Architecture + Class + Sequence**: Same Mermaid-style diagram types but generated by Gemini
- **Interactive navigation**: Jump from high-level explanations directly to exact code files, classes, and functions
- **Integrated AI chat**: Each wiki page has a conversational AI assistant
- **Gemini CLI extension**: Coming soon for private/internal repositories

**What their diagrams look like (based on shared screenshots):**
- Color-coded components with clear visual hierarchy
- Tech stack logos embedded in architecture diagrams (React, Node.js, PostgreSQL icons visible in nodes)
- Animated transitions between views
- Illustrative style -- more polished than raw Mermaid output
- Distinct visual treatment for different component types (frontend, backend, database, external service)

**Their weaknesses (our opportunities):**
- Diagrams still appear largely static once rendered
- No 3D exploration
- No commit-to-commit visual diffs
- No scroll-based progressive reveal
- No AI interaction directly on diagram nodes
- Limited to their own AI model (Gemini) -- no model choice
- No self-hosting option
- Focused on public repos initially

**Sources:** [Google Developers Blog](https://developers.googleblog.com/en/introducing-code-wiki-accelerating-your-code-understanding/), [Analytics Vidhya](https://www.analyticsvidhya.com/blog/2025/12/google-code-wiki/), [DevOps.com](https://devops.com/google-code-wiki-aims-to-solve-documentations-oldest-problem/)

### 2.2 Sourcegraph

Sourcegraph focuses on **code intelligence at scale** -- searching across millions of lines across repos. Their AI platform can generate dependency graphs in minutes. However, Sourcegraph is primarily a search and navigation tool, not a documentation platform. Their visualizations are functional rather than beautiful -- graph views serve as navigation aids, not learning tools.

**Lesson**: Scale matters. Our diagrams need to work for monorepos with thousands of files.

### 2.3 CodeSee

CodeSee offers **automated cross-repo visualization** with auto-generated and auto-updated code maps. Their approach:
- Visual code reviews showing dependency impact
- AI-powered answers for codebase questions
- Maps that update automatically as code changes

**Lesson**: The "auto-update" story is compelling. Diagrams should feel alive, not frozen.

**Source:** [CodeSee](https://www.codesee.io/)

### 2.4 Dependency Cruiser & Madge

These are **dependency-specific** tools that generate graph visualizations from import/require statements. They produce DOT/Graphviz output. Useful for understanding module relationships but limited to dependency trees -- no architectural understanding, no data flow, no sequence diagrams.

**Lesson**: Dependency graphs are a specific, high-value diagram type we should generate better than these tools.

### 2.5 Figma / Miro Approach to Interactivity

Figma and Miro represent the gold standard for interactive canvas experiences:
- Infinite canvas with smooth pan/zoom
- Real-time collaboration (multiple cursors)
- Rich node content (images, text, links, embeds)
- Connectors with different styles
- Frames for grouping
- Presentation mode (step through frames)

**Lesson**: The infinite canvas paradigm is intuitive for developers. Our Visual Explorer should feel like Figma, not like a static image viewer.

### 2.6 D2 Language (Terrastruct) vs Mermaid

D2 is a modern diagram scripting language (open-sourced November 2022) that is a significant upgrade over Mermaid in several ways:

| Feature | Mermaid | D2 |
|---|---|---|
| Aesthetics | Functional, basic | "Prettier and more approachable" |
| Layout engines | dagre only | dagre, ELK, TALA (commercial) |
| Icons/images | Not supported | First-class icon support |
| Tooltips | Not supported | Native tooltip support |
| Animations | CSS hacks only | Planned native support |
| Near-constant shapes | Limited shape vocabulary | Rich shape library |
| SQL table rendering | erDiagram (limited) | Native SQL table shapes |
| Container nesting | subgraphs (limited) | Unlimited nesting depth |
| Glob connections | Not supported | `*` syntax for connecting many nodes |
| Styling | Global CSS only | Per-element styling with themes |
| Interactive studio | Mermaid Live Editor | D2 Studio with GUI + text sync |
| Browser rendering | Native JS | WebAssembly (WASM) |
| File size | ~2MB | ~5MB (WASM), more with ELK |

**Key D2 advantages for our use case:**
- **Icon support**: D2 can embed icons/images directly in nodes -- perfect for tech stack logos
- **Better layouts**: ELK layout engine handles complex graphs significantly better than dagre
- **Nested containers**: Better representation of microservices, modules, layers
- **TALA layout**: Their commercial layout engine produces near-manual-quality layouts

**D2 challenges:**
- Rendering via WebAssembly is heavier than Mermaid's native JS
- Smaller ecosystem and community
- LLMs are less familiar with D2 syntax than Mermaid (training data issue)
- Commercial TALA layout requires licensing

**Recommendation**: Consider D2 as a **secondary rendering engine** for specific diagram types where its advantages shine (architecture diagrams with icons, complex nested systems), while keeping Mermaid for simpler diagrams where LLM familiarity matters.

**Sources:** [Terrastruct](https://terrastruct.com/), [Mermaid vs D2 Comparison](https://aaronjbecker.com/posts/mermaid-vs-d2-comparing-text-to-diagram-tools/), [Text-to-Diagram Comparison](https://text-to-diagram.com/)

### 2.7 Excalidraw

Excalidraw is a virtual whiteboard with a distinctive **hand-drawn aesthetic**. Key aspects:
- Open source, available as `@excalidraw/excalidraw` npm package
- Hand-drawn look makes diagrams feel informal and approachable
- Programmatic API for generating diagrams from code
- Excellent collaboration features
- Active community with a library of reusable components

**Relevance**: Excalidraw's aesthetic could be offered as an alternative rendering style -- "whiteboard mode" for diagrams. The hand-drawn look can make technical diagrams feel less intimidating.

**Source:** [Excalidraw GitHub](https://github.com/excalidraw/excalidraw)

### 2.8 tldraw

tldraw is an **infinite canvas SDK** for React, SDK-first rather than application-first:
- Rich programmatic API for building custom canvas experiences
- $12M in funding (Series A, April 2025)
- React-native integration
- Custom shapes and tools possible
- Better suited as a foundation for building our own Visual Explorer than Excalidraw

**Relevance**: tldraw could serve as the canvas layer for our dedicated Visual Explorer page, providing pan/zoom/selection infrastructure while we build custom diagram rendering on top.

**Source:** [tldraw SDK](https://tldraw.dev/)

### 2.9 Swark -- AI Architecture Diagrams

Swark is a newer tool (2025) that generates architecture diagrams from code using LLMs via VS Code Language Model API. It outputs Mermaid.js diagrams. Notable because it demonstrates that **LLMs can produce architecture diagrams automatically from code analysis** -- which is exactly what we do, but we can do it better with richer output formats.

**Source:** [Swark GitHub](https://github.com/swark-io/swark)

---

## 3. Next-Gen Diagram Features to Build

### 3a. Interactive Scroll-to-Expand Diagrams

**Concept**: As the user scrolls through a wiki page, diagrams progressively reveal their complexity. Start with a simple 3-node overview, then expand into subsystems, then into individual components.

**Technical approach:**

```
Phase 1 (visible on page load):
  [Frontend] --> [Backend] --> [Database]

Phase 2 (scroll 200px):
  [React App] --> [API Gateway] --> [PostgreSQL]
  [React App] --> [CDN]          [Redis Cache]

Phase 3 (scroll 400px):
  Full architecture with all services, queues, caches,
  external APIs, monitoring, etc.
```

**Implementation plan:**

1. **AI generates layered diagram data**: Instead of a single Mermaid string, the AI outputs a JSON structure with `layers`:
   ```json
   {
     "layers": [
       { "depth": 0, "nodes": ["Frontend", "Backend", "Database"], "edges": [...] },
       { "depth": 1, "nodes": ["React", "Next.js", "API Gateway", "Auth Service", ...], "edges": [...] },
       { "depth": 2, "nodes": [...full detail...], "edges": [...] }
     ]
   }
   ```

2. **GSAP ScrollTrigger** (already in dependencies) tracks scroll position and maps it to the active layer depth.

3. **Framer Motion** (already in dependencies) animates nodes entering/exiting with spring physics:
   - New nodes scale up from 0 with a staggered delay
   - Edges draw themselves using SVG `pathLength` animation
   - Removed nodes fade out and shrink

4. **Breadcrumb navigation**: A sticky breadcrumb shows the current zoom level: `System > Backend > Auth Service > JWT Handler`. Clicking any level snaps the diagram to that depth.

5. **Click to drill down**: Clicking any node that has children triggers expansion of that subtree specifically, with the rest of the diagram dimming.

**User experience**: Reading the wiki page feels like the diagram is "growing" alongside the explanation. By the time you finish reading a section, the relevant part of the diagram has expanded to match.

**Estimated effort**: 3-4 weeks for a senior frontend engineer. AI prompt changes + new `ScrollDiagram` component + GSAP integration.

### 3b. 3D Diagram Exploration

**Concept**: Render architecture diagrams in 3D space, allowing users to fly through the codebase like navigating a virtual city.

**Research: Prior Art**

- **CodeCity** (University of Lugano): Represents classes as buildings, packages as districts. A-Frame/Three.js implementations exist. Research shows it helps with identifying code smells and understanding large-scale structure. A 2022 study compared on-screen vs VR versions.
- **Software Galaxies**: GitHub user anvaka created `pm` -- a tool showing npm/Go/etc. package ecosystems as 3D star fields where related packages cluster together. Visually stunning.
- **Gource**: Renders repository history as an animated tree with contributors appearing/disappearing. Uses OpenGL. Produces hypnotic videos that developers share widely.
- **JSCity**: Open-source CodeCity implementation for JavaScript, rendering on the web.

**What we could build:**

1. **Architecture Cityscape**: Modules as city blocks, services as buildings (height = complexity, color = tech stack). Users navigate by flying through the city.
   - Frontend district: React components as colorful low-rise buildings
   - Backend district: API services as tall office towers
   - Database district: Data stores as warehouses
   - External services: Distant buildings connected by highways (API calls)

2. **Dependency Galaxy**: Files as stars, imports as gravitational connections. Clusters form naturally. Camera flies through the galaxy.

3. **Layer Cake View**: Frontend, middleware, backend, database as stacked translucent planes. Data flows visualized as particle streams between layers.

**Technical feasibility:**

React Three Fiber (`@react-three/fiber` v9.5.0) and drei (`@react-three/drei` v10.7.7) are **already in the project dependencies** and actively used for the landing page Hero3D component. The team has demonstrated Three.js competency with the `KnowledgeCube` and `ParticleField` components.

Key Three.js considerations:
- **Performance**: R3F's virtualization renders only visible objects. For 100,000+ elements, use `InstancedMesh`.
- **Force-directed 3D graphs**: `r3f-forcegraph` by vasturiano provides a production-ready React Three Fiber component for 3D force-directed graphs with custom node rendering.
- **Interaction**: drei provides `OrbitControls`, `FlyControls`, raycasting (click detection), and HTML overlay panels.
- **Labels**: drei's `Html` component renders React components in 3D space, allowing rich tooltip/info panels attached to 3D nodes.

**Honest assessment -- is 3D useful or a gimmick?**

**Arguments for 3D:**
- The "galaxy/city" metaphor gives an immediate gestalt sense of codebase scale and structure
- Spatial memory helps developers remember where things are
- Z-axis provides a third dimension for encoding information (time, complexity, ownership)
- Incredibly shareable -- Gource videos regularly go viral on Twitter/X
- Novel enough to generate press coverage and word-of-mouth

**Arguments against 3D:**
- Navigation in 3D is harder than 2D -- users get lost, occluded nodes are hidden
- Text labels in 3D are hard to read (perspective distortion, overlapping)
- Not accessible (screen readers, keyboard navigation)
- Heavy performance cost -- mobile devices struggle
- The "wow factor" wears off; daily use often reverts to 2D for practical tasks
- Academic research on CodeCity showed mixed results on actual comprehension improvement

**Verdict**: Build 3D as a **showcase/exploration mode** -- the thing that makes people share screenshots and try the product. But invest most effort in 2D interactive diagrams for daily use. Think of 3D as the "trailer" and 2D as the "movie."

**Estimated effort**: 4-6 weeks for a 3D exploration MVP (leveraging existing R3F setup). The force-directed graph is the quick win; the full city metaphor is a multi-month project.

### 3c. Animated Diagrams

**Concept**: Diagrams that move, showing how data flows through systems, how architectures are built up, and how they change over time.

**Four types of animation to build:**

#### 3c-i. Data Flow Animation
Show how a request travels through the system:

- User clicks "Login" button
- Arrow animates from Browser to API Gateway
- API Gateway lights up, arrow animates to Auth Service
- Auth Service lights up, arrow animates to Database
- Database lights up, response arrow animates back
- Each step has a 500ms delay, with a tooltip showing what happens

**Implementation**: SVG `stroke-dashoffset` animation (already partially implemented in Mermaid.tsx line 123-126) combined with Framer Motion's `motion.path` for precise control over `pathLength` animation. Each edge gets an `animate` variant triggered sequentially.

#### 3c-ii. Build-Up Animation
The architecture constructs itself step by step:

- Step 1: Core database appears
- Step 2: Backend services connect to database
- Step 3: API gateway appears, connects to services
- Step 4: Frontend appears, connects to gateway
- Step 5: External services (CDN, auth provider, monitoring) appear
- Step 6: Cross-cutting concerns (logging, caching) fade in

**Implementation**: AI generates the diagram with a `buildOrder` property on each node. Framer Motion's `staggerChildren` and `delayChildren` handle the sequencing. A playback control (play/pause/step/speed) overlays the diagram.

#### 3c-iii. View Transition Animation
Smooth animated transitions between different views of the same system:

- High-level (3 boxes) morphs into detailed view (30 boxes) with nodes splitting and edges reorganizing
- Data flow view morphs into dependency view (same nodes, different edges highlighted)
- Frontend-focused view morphs into backend-focused view (camera pan with opacity changes)

**Implementation**: This requires maintaining a stable node identity across views. React Flow (xyflow) is specifically designed for this -- its built-in animation system handles node position transitions. Alternative: Framer Motion's `layoutId` for shared layout animations between diagram states.

#### 3c-iv. Temporal Evolution Animation
Show how the architecture changed across commits:

- Render the architecture at commit A
- Animate the transition to commit B: new nodes grow in (green glow), removed nodes shrink out (red glow), modified nodes pulse (yellow glow)
- Scrub through a timeline slider to see the architecture at any point in history

**Implementation**: Requires comparing wiki generations across commits (store historical diagram data). The diff algorithm identifies added/removed/moved nodes. GSAP timeline controls the playback.

**Estimated effort**: Data flow animation (2 weeks), build-up animation (1 week), view transitions (3 weeks), temporal evolution (6 weeks -- requires backend infrastructure for historical data).

### 3d. Tech Stack Logo Integration

**Concept**: Replace plain text labels in architecture diagrams with recognizable tech stack logos. When a developer sees the PostgreSQL elephant, the React atom, or the Docker whale, recognition is instant -- no reading required.

**Logo sources (npm packages):**

| Library | Icon Count | License | Format | React Support |
|---|---|---|---|---|
| `simple-icons` | 3,300+ | CC0 1.0 | SVG | Via `react-simple-icons` |
| `devicon` | 800+ | MIT | SVG, Font | Via `devicon-react-svg` |
| `developer-icons` | 400+ | MIT | SVG | Native React components |
| `skill-icons` | 300+ | MIT | SVG | GitHub-hosted |

**Implementation plan:**

1. **Detection layer**: AI identifies technologies from `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, Dockerfiles, CI configs, etc. Map each to a canonical name: `"@react-three/fiber"` -> `"react"`, `"express"` -> `"express"`, `"prisma"` -> `"prisma"`.

2. **Icon registry**: Build a mapping from canonical tech names to SVG icon data. Use `simple-icons` as the primary source (3,300+ brands), with `devicon` as fallback for development-specific icons.

3. **Rendering options:**
   - **In Mermaid**: Use HTML labels (`htmlLabels: true` is already enabled) to embed `<img>` tags with data URIs of SVG icons inside node labels
   - **In React Flow/custom diagrams**: Render icon components directly as part of custom node components
   - **In D2**: Use D2's native icon support (`icon: ./react.svg`)

4. **Visual design**: Each node gets:
   - A 24x24 icon in the top-left corner
   - Technology name as subtitle text
   - Component name as title text
   - Color-coded border matching the technology's brand color (extracted from `simple-icons` metadata)

**Example rendering:**
```
+--[React logo]------------------+
|  UserDashboard                 |
|  React + TypeScript            |
|  src/components/Dashboard.tsx  |
+--(blue border)------------------+
```

**Estimated effort**: 2 weeks. Icon registry + detection logic + Mermaid HTML label integration + fallback for unknown technologies.

### 3e. Commit-to-Commit Visual Diffs

**Concept**: Git blame, but visual. See how the architecture diagram changed between any two points in time. Who added the Redis cache? When did the microservice split happen? Which team expanded the API surface?

**Design:**

```
+--[Timeline Slider]-------------------------------------------+
|  Jan 2025  |  Mar 2025  |  Jun 2025  |  Sep 2025  |  Now    |
+--[=========>|]-----------------------------------------------|

+--[Diagram]---------------------------------------------------+
|                                                               |
|  [API Gateway]---->[Auth Service] (unchanged, gray)           |
|       |                                                       |
|       +---->[Payment Service] (NEW - green glow, +3 commits)  |
|       |          by @sarah, @mike                             |
|       +---->[Notification Svc] (MODIFIED - yellow, +12 LOC)   |
|                                                               |
+---------------------------------------------------------------+
```

**Implementation layers:**

1. **Historical diagram storage**: When a wiki is generated/regenerated, store the diagram data (nodes, edges, metadata) with a timestamp and commit hash. Use a lightweight versioning scheme.

2. **Diff algorithm**: Compare two diagram snapshots:
   - **Added nodes**: Present in new, absent in old (green highlight)
   - **Removed nodes**: Present in old, absent in new (red highlight with dashed border)
   - **Modified nodes**: Same identity but different connections or metadata (yellow highlight)
   - **Moved nodes**: Same identity, different position in hierarchy (blue highlight with motion trail)

3. **Attribution**: For each change, identify the commits and authors responsible by correlating file changes with affected diagram nodes.

4. **Timeline UI**: A horizontal slider with tick marks at significant architectural changes (not every commit -- only commits that change the diagram). Dragging the slider animates the diagram between states.

5. **Playback mode**: "Play" button auto-advances through architectural history. Speed control (1x, 2x, 4x). Pause at significant moments.

**Technical considerations:**
- Requires generating diagrams at multiple historical points (expensive -- consider caching)
- Node identity matching across time is non-trivial (files get renamed, modules get reorganized)
- Could use git log + file change analysis as a lightweight alternative to full regeneration

**Estimated effort**: 6-8 weeks. This is a major feature requiring backend infrastructure, diffing logic, and rich frontend visualization.

### 3f. AI-Powered Diagram Interaction

**Concept**: The diagram becomes a conversation interface. Click any node, edge, or cluster to ask the AI about it. The AI responds with context-aware explanations, generates focused sub-diagrams on demand, and answers "why" questions about architectural decisions.

**Interaction patterns:**

1. **Click node -> Explain panel**
   - Click on "Auth Service" node
   - Side panel opens with AI-generated explanation:
     - What this component does
     - Key files: `src/auth/service.ts`, `src/auth/jwt.ts`
     - Dependencies: PostgreSQL (users table), Redis (session cache)
     - API endpoints it exposes
     - Recent changes (last 5 commits affecting it)

2. **Click edge -> Explain connection**
   - Click on the arrow between "API Gateway" and "Auth Service"
   - AI explains: "The API Gateway forwards authentication requests to the Auth Service via HTTP POST to `/auth/verify`. The request includes a JWT token in the Authorization header. The Auth Service validates the token against the user database and returns a 200 with user context or a 401."
   - Shows relevant code snippets from both sides of the connection

3. **Right-click -> "Why does this connect to that?"**
   - Context menu with AI-powered queries:
     - "Why does this connection exist?"
     - "What data flows through this connection?"
     - "What happens if this connection fails?"
     - "Show me the code for this connection"

4. **Ask for new diagrams**
   - Type in the diagram panel: "Show me only the payment flow"
   - AI generates a focused diagram showing only the nodes and edges involved in payment processing
   - "Show me this from the database perspective" -- same nodes, but reorganized with database at center
   - "Compare this with how Stripe does it" -- AI generates a side-by-side comparison (using its general knowledge)

5. **AI-guided exploration**
   - AI suggests: "This component has high coupling (8 connections). Want me to show potential refactoring?"
   - AI suggests: "This path has no error handling visible. Want me to check the code?"
   - AI highlights: "These 3 services all depend on the same config file. That might be a single point of failure."

**Implementation:**

- Each diagram node/edge stores metadata (file paths, function names, connection types)
- Click events on SVG/React Flow nodes trigger a context panel
- The context panel sends a focused prompt to the LLM with the selected component's metadata + relevant source files
- Responses stream in (using the existing Ask component's streaming infrastructure)
- New diagrams generated on-demand are rendered in-place or in a split view

**Estimated effort**: 4-5 weeks. Leverages existing AI chat infrastructure (the Ask component at `src/components/Ask.tsx`) with added diagram context.

---

## 4. Dedicated Diagram Page vs Integrated Approach

### Option A: New Dedicated "/diagrams" Route

**Description**: A completely separate page at `/{owner}/{repo}/diagrams` (or `/visual-explorer`) focused entirely on visual, interactive diagram-based exploration. Text is minimal -- the diagram IS the documentation.

**Proposed layout:**
```
+--[Header: repo info, navigation]-------------------------------+
|                                                                 |
|  +--[Diagram Type Tabs]---------------------------------------+ |
|  | Architecture | Data Flow | Dependencies | Sequences | 3D  | |
|  +------------------------------------------------------------+ |
|                                                                 |
|  +--[Main Canvas (80% width)]--+--[Detail Panel (20%)]-------+ |
|  |                              |                              | |
|  |   Interactive diagram        |  Selected node details       | |
|  |   with full pan/zoom/click   |  AI explanations             | |
|  |                              |  Related source files        | |
|  |                              |  Connection details          | |
|  |                              |                              | |
|  +------------------------------+------------------------------+ |
|                                                                 |
|  +--[Timeline Slider]----------------------------------------+ |
|  |  Commit history visualization                              | |
|  +------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Pros:**
- Freedom to build a radically different UX optimized for visual learning
- No constraints from the existing wiki page layout
- Can use React Flow / tldraw as the canvas (which would conflict with Markdown rendering in wiki pages)
- Can justify a larger initial load (dedicated page = user expects richer experience)
- Clear marketing message: "Visual Explorer" as a distinct product feature
- Easier to A/B test independently

**Cons:**
- Separate page means users must navigate away from the wiki to see diagrams
- Content duplication -- diagrams and text explain the same things
- More code to maintain
- May fragment the user experience
- Users who prefer text lose contextual diagrams

### Option B: Enhanced Diagrams Integrated Into Wiki Pages

**Description**: Upgrade the existing Mermaid rendering in-place. Make every diagram in every wiki page interactive, animated, and clickable.

**Pros:**
- Diagrams appear exactly where they are relevant (next to the text explaining them)
- No navigation required -- diagrams enhance the reading experience
- Leverages existing content generation pipeline
- Easier to implement incrementally
- Better for SEO (rich content on the same page)

**Cons:**
- Constrained by the Markdown rendering context
- Hard to implement advanced features (React Flow requires its own React root, conflicts with `dangerouslySetInnerHTML`)
- Page becomes heavy if every diagram is fully interactive
- Cannot easily do multi-diagram views (comparing architecture vs. data flow side by side)
- Difficult to add timeline slider or 3D mode within a wiki page

### Option C: Both (Recommended)

**Description**: Keep enhanced Mermaid diagrams in wiki pages AND add a new Visual Explorer page. The wiki diagrams serve as contextual illustrations (Phase 1 improvements), while the Visual Explorer is the premium, differentiated experience (Phases 2-4).

**How they connect:**
- Each Mermaid diagram in the wiki has a small "Open in Visual Explorer" button
- Clicking it navigates to the Visual Explorer, pre-focused on that diagram's context
- The Visual Explorer can also be accessed independently from the repo header
- Both share the same underlying diagram data (generated once, rendered differently)

**Architecture:**
```
AI generates wiki content
    |
    +-> Markdown with Mermaid code blocks (existing flow)
    |     |
    |     +-> Enhanced Mermaid.tsx renders with click/zoom/animate
    |
    +-> Structured diagram data (NEW: JSON format)
          |
          +-> Visual Explorer page renders with React Flow / custom renderer
          +-> 3D Explorer renders with R3F
          +-> Timeline view renders with GSAP
```

**Pros:**
- Best of both worlds
- Diagrams serve two purposes: contextual (in wiki) and exploratory (in Visual Explorer)
- Can prioritize wiki diagram improvements first (faster time to market)
- Visual Explorer can be developed in parallel without disrupting existing functionality
- The "Open in Visual Explorer" button is a natural upsell moment

**Cons:**
- Most engineering effort overall
- Need to maintain two rendering pipelines
- Must keep them in sync

**Recommendation**: **Option C** -- start with quick wins in the wiki (3a, 3c-i, 3c-ii, 3d), then build the Visual Explorer as the flagship differentiation feature.

---

## 5. Technical Implementation Research

### 5.1 Rendering Libraries Comparison

| Library | Best For | React? | Performance (1000+ nodes) | Interactive? | Layout Engines |
|---|---|---|---|---|---|
| **React Flow (xyflow)** | Node-based UIs, workflow diagrams | Native React | Excellent (virtualization) | Excellent | dagre, ELK, custom |
| **Cytoscape.js** | Graph analysis, network visualization | Via wrapper | Good (WebGL mode) | Good | dagre, ELK, CoSE, many more |
| **D3.js** | Custom visualizations, full control | Manual integration | Excellent (manual optimization) | Full control | Force, tree, radial, custom |
| **Three.js / R3F** | 3D exploration, immersive experiences | Via R3F | GPU-accelerated | Excellent | Custom (physics-based) |
| **tldraw SDK** | Infinite canvas, whiteboard-like | Native React | Good | Excellent | Manual / custom |
| **Mermaid.js** | Quick diagram rendering from text | Via component | Poor for large diagrams | Limited (view only) | dagre |
| **D2 (WASM)** | Beautiful static diagrams | Via WASM bridge | Moderate | Limited | dagre, ELK, TALA |
| **ELK.js** | Layout computation only | Library | Fast | N/A (layout only) | Layered, stress, force, radial |

**Recommended stack for Visual Explorer:**

```
+--[Rendering Layer]-----+
|  React Flow (xyflow)   |  -- Primary 2D canvas for interactive diagrams
|  @react-three/fiber    |  -- 3D exploration mode (already installed)
+-------------------------+

+--[Layout Layer]---------+
|  ELK.js               |  -- Primary layout engine for complex graphs
|  dagre                 |  -- Fallback for simpler trees/DAGs
+-------------------------+

+--[Animation Layer]------+
|  Framer Motion         |  -- Node/edge animations (already installed)
|  GSAP ScrollTrigger    |  -- Scroll-synced animations (already installed)
+-------------------------+

+--[Data Layer]-----------+
|  Structured JSON       |  -- AI generates typed diagram data
|  Mermaid (fallback)    |  -- For inline wiki diagrams (existing)
+-------------------------+
```

### 5.2 AI Prompt Engineering for Structured Diagram Data

Currently, the AI is prompted to output Mermaid text blocks. For next-gen features, we need **structured JSON** that can drive multiple renderers.

**Proposed AI output format:**

```json
{
  "diagramType": "architecture",
  "title": "System Architecture Overview",
  "layers": [
    {
      "depth": 0,
      "label": "High-Level Overview",
      "nodes": [
        {
          "id": "frontend",
          "label": "Frontend",
          "type": "service",
          "tech": ["react", "next.js", "typescript"],
          "files": ["src/app/", "src/components/"],
          "importance": "high",
          "description": "Next.js application serving the wiki UI",
          "metrics": { "files": 47, "loc": 12000 }
        },
        {
          "id": "backend",
          "label": "Backend API",
          "type": "service",
          "tech": ["python", "fastapi"],
          "files": ["api/"],
          "importance": "high",
          "description": "FastAPI server handling wiki generation"
        },
        {
          "id": "database",
          "label": "Database",
          "type": "database",
          "tech": ["postgresql"],
          "files": ["migrations/"],
          "importance": "high"
        }
      ],
      "edges": [
        {
          "source": "frontend",
          "target": "backend",
          "type": "http",
          "label": "REST API calls",
          "protocol": "HTTPS",
          "bidirectional": false
        },
        {
          "source": "backend",
          "target": "database",
          "type": "database",
          "label": "SQL queries",
          "bidirectional": false
        }
      ]
    },
    {
      "depth": 1,
      "label": "Detailed View",
      "nodes": [
        {
          "id": "frontend.wiki-page",
          "label": "Wiki Page",
          "parent": "frontend",
          "tech": ["react"],
          "files": ["src/app/[owner]/[repo]/page.tsx"]
        }
      ],
      "edges": []
    }
  ],
  "dataFlows": [
    {
      "name": "Wiki Generation Flow",
      "steps": [
        { "node": "frontend", "action": "User enters repo URL" },
        { "node": "backend", "action": "Fetches repository files via Git API" },
        { "node": "database", "action": "Stores wiki structure" },
        { "node": "backend", "action": "Generates wiki pages via LLM" },
        { "node": "frontend", "action": "Renders wiki with Markdown + Mermaid" }
      ]
    }
  ],
  "mermaidFallback": "graph TD\n  Frontend-->Backend\n  Backend-->Database"
}
```

**Key design decisions:**
- **`mermaidFallback`**: Always include a Mermaid string so the existing rendering pipeline works as a fallback
- **`layers`**: Enable progressive disclosure / scroll-to-expand
- **`tech` arrays**: Enable automatic tech stack logo detection
- **`files` arrays**: Enable click-to-source-code navigation
- **`type` on edges**: Enable semantic styling (HTTP = solid blue, database = dashed green, event = dotted orange)
- **`dataFlows`**: Separate concern -- enables the animated data flow feature without cluttering the architecture diagram

### 5.3 Performance Considerations for Large Codebases

Large codebases (10,000+ files, 100+ services) will produce complex diagrams. Key performance strategies:

1. **Virtualization (React Flow)**: Only render nodes visible in the viewport. React Flow does this automatically -- its "virtualization feature renders only what is visible, improving performance in large projects."

2. **Level-of-Detail (LOD)**: At low zoom, render nodes as simple colored circles with no labels. At medium zoom, show labels. At high zoom, show full detail with icons and metrics. Three.js LOD is built into R3F.

3. **Web Workers for layout**: ELK.js layout computation for 1,000+ nodes should run in a Web Worker to avoid blocking the main thread. ELK's WASM version is designed for this.

4. **Incremental rendering**: Render the first layer immediately, compute deeper layers in the background. Show a subtle loading indicator on collapsed clusters.

5. **Canvas rendering fallback**: For extremely large graphs (10,000+ nodes), switch from SVG to Canvas/WebGL rendering. Cytoscape.js supports a WebGL renderer for this scale.

6. **Diagram simplification**: AI should generate a "simplified" version alongside the full version. If the full diagram exceeds a threshold (e.g., 200 nodes), show the simplified version by default with an "Expand full diagram" option.

### 5.4 Mobile Considerations

Mobile diagram viewing is inherently challenging. Strategies:

1. **Responsive simplification**: On mobile viewports (<768px), automatically show only the highest-level layer (depth 0). Pinch to zoom reveals deeper layers.

2. **Touch gestures**: Pinch-to-zoom (native via React Flow), two-finger pan, long-press for node details (instead of hover).

3. **Portrait-optimized layout**: Re-layout diagrams in vertical orientation on mobile (even if they are horizontal on desktop). Force `graph TD` layout.

4. **Sheet-based detail panel**: Instead of a side panel, use a bottom sheet (like Google Maps) for node details when tapped.

5. **Reduced animations**: Detect `prefers-reduced-motion` (already done in Hero3D) and skip scroll animations, use instant transitions.

6. **3D mode**: Disable 3D exploration on mobile entirely. Show a static screenshot with "View in 3D on desktop" prompt.

---

## 6. Proposed Roadmap

### Phase 1: Quick Wins (Weeks 1-4)

**Theme: Make existing diagrams 10x better without changing the architecture**

| Feature | Effort | Impact | Description |
|---|---|---|---|
| **Tech stack logos in Mermaid** | 2 weeks | HIGH | Embed SVG icons in Mermaid HTML labels using `simple-icons` + `devicon`. Instant visual upgrade. |
| **Click-to-expand Mermaid nodes** | 1 week | HIGH | Clicking a Mermaid node opens a detail panel with file links and AI explanation. |
| **Build-up animation** | 1 week | MEDIUM | New diagrams animate in node-by-node using Framer Motion. Controlled via play/pause. |
| **Better error handling** | 0.5 weeks | LOW | When Mermaid fails, attempt to auto-fix common syntax errors before showing error state. |

**Deliverables:**
- Upgraded `Mermaid.tsx` with logo support and click handling
- New `DiagramDetailPanel.tsx` component
- AI prompt updates to include tech stack metadata in Mermaid labels

### Phase 2: New Diagram Types (Weeks 5-10)

**Theme: Go beyond what Mermaid can do**

| Feature | Effort | Impact | Description |
|---|---|---|---|
| **Interactive dependency graph upgrade** | 2 weeks | HIGH | Replace custom force-directed graph with React Flow + ELK layout. Add filtering, search, grouping. |
| **Data flow animation diagrams** | 2 weeks | HIGH | Animated request flow showing how data moves through the system. Step-by-step with play/pause. |
| **Structured diagram data format** | 2 weeks | HIGH | AI generates JSON diagram data alongside Mermaid. New rendering pipeline for structured data. |

**Deliverables:**
- New `InteractiveDiagram.tsx` built on React Flow
- New `DataFlowAnimation.tsx` component
- Updated AI prompts for structured diagram output
- New API endpoint for structured diagram data

### Phase 3: Visual Explorer Page (Weeks 11-18)

**Theme: The flagship differentiation feature**

| Feature | Effort | Impact | Description |
|---|---|---|---|
| **Visual Explorer route** | 2 weeks | HIGH | New `/{owner}/{repo}/explore` route with React Flow canvas + detail panel + diagram type tabs. |
| **Scroll-to-expand diagrams** | 3 weeks | HIGH | GSAP ScrollTrigger drives progressive diagram expansion in wiki pages. |
| **AI diagram interaction** | 3 weeks | HIGH | Click any node/edge in Visual Explorer to get AI-powered explanations and focused sub-diagrams. |

**Deliverables:**
- New `/explore` route and page component
- `VisualExplorer.tsx` -- main canvas component
- `DiagramAIChat.tsx` -- contextual AI panel
- `ScrollDiagram.tsx` -- scroll-synced progressive diagrams for wiki pages
- "Open in Visual Explorer" buttons on wiki Mermaid diagrams

### Phase 4: Advanced Features (Weeks 19-30)

**Theme: Wow factor and deep differentiation**

| Feature | Effort | Impact | Description |
|---|---|---|---|
| **3D exploration mode** | 4 weeks | MEDIUM | Toggle 3D view in Visual Explorer. Architecture as navigable 3D city/galaxy. |
| **Commit-to-commit visual diffs** | 6 weeks | HIGH | Timeline slider showing architectural evolution. Diff highlighting. Author attribution. |
| **View transition animations** | 2 weeks | MEDIUM | Smooth animated transitions between diagram types in Visual Explorer. |
| **D2 rendering engine** | 2 weeks | LOW | Optional D2 backend for premium diagram quality. |

**Deliverables:**
- `Explorer3D.tsx` -- Three.js/R3F 3D exploration component
- `DiagramTimeline.tsx` -- commit history timeline with visual diffs
- Historical diagram storage in backend
- D2 WASM integration for architecture diagrams

### Phase 5: Polish & Viral Features (Weeks 31-36)

| Feature | Effort | Impact | Description |
|---|---|---|---|
| **Share/embed diagrams** | 2 weeks | HIGH | Generate shareable links and embeddable iframes for any diagram view. |
| **Export as image/video** | 2 weeks | MEDIUM | Export diagram as PNG, SVG, or animated MP4/GIF. |
| **Diagram themes** | 1 week | LOW | Multiple visual themes: dark, light, blueprint, whiteboard (Excalidraw-style), neon. |
| **Multiplayer exploration** | 3 weeks | MEDIUM | Real-time collaborative diagram exploration (see other users' cursors). |

---

## 7. What Will Make This Go Viral

### 7.1 The "Screenshot Moment"

The thing developers will screenshot and share on Twitter/X needs to be **instantly impressive in a static image** while hinting at deeper interactivity. Based on what goes viral in developer communities:

**Candidate 1: "Architecture at a Glance" with Tech Logos**
A beautiful architecture diagram where every node has a recognizable tech logo (React atom, PostgreSQL elephant, Redis diamond, Docker whale). Color-coded by layer. Clean layout. This is the Google CodeWiki screenshot that excites people -- we need to do it better.

Why it works: Developers immediately recognize their own tech stack. They think "I want this for MY project." They share it saying "Just generated this for our codebase in 30 seconds."

**Candidate 2: "3D Code City"**
A screenshot of a codebase rendered as a 3D city with buildings of different heights and colors, lit with dramatic lighting. Think: SimCity but for code.

Why it works: Novel, beautiful, and immediately understandable metaphor. The "wow" factor drives shares. Similar to how Gource videos regularly get 100K+ views.

**Candidate 3: "Architecture Evolution GIF"**
An animated GIF showing a project's architecture evolving over 2 years: starting with a monolith, splitting into services, adding databases, growing the frontend.

Why it works: Tells a story. Developers love seeing the history of their projects. The time-lapse format is inherently shareable (like those city-building time-lapses).

**Candidate 4: "Click to Explain" Demo Video**
A 15-second screen recording: user clicks a diagram node, AI instantly explains the component with relevant code snippets, then generates a focused sub-diagram.

Why it works: Demonstrates the interactive AI experience that text alone cannot convey. Developers immediately see the value: "I could use this for onboarding."

**Recommendation**: Optimize for **Candidate 1** first (tech logo diagrams -- quickest to build, most screenshot-worthy), then build toward **Candidate 3** (evolution GIF -- most unique, hardest for competitors to copy).

### 7.2 What Makes This 10x Better Than Reading Docs

1. **Instant context**: A well-designed architecture diagram communicates in 3 seconds what takes 3 minutes to read in prose. The human visual system processes spatial relationships 60,000x faster than text.

2. **Progressive depth**: Start with the bird's eye view, drill into exactly the part you care about. Traditional docs force linear reading.

3. **Active exploration vs. passive reading**: Clicking, zooming, and navigating engages spatial memory. Studies show people remember spatial layouts better than text sequences.

4. **Multi-modal understanding**: Seeing the diagram AND reading the text AND having AI explain specific parts -- three complementary channels vs. text-only.

5. **Contextual AI**: Instead of asking "how does auth work?" in a general chat, clicking the Auth Service node and asking "explain this" provides much more focused, accurate answers because the AI has the exact context.

### 7.3 How This Helps Developers Chat Better With AI About Their Codebase

The diagram becomes a **shared visual vocabulary** between the developer and the AI:

- **Before**: Developer types "How does the payment service communicate with the order service?" AI might hallucinate the architecture.
- **After**: Developer clicks the edge between Payment and Order nodes. AI sees the exact files, protocols, and data structures involved. Response is grounded in the actual code.

The diagram also helps developers **ask better questions**:
- Seeing the full architecture, a developer notices a node they do not recognize and asks about it
- Seeing a complex cluster of connections, they ask "Is this too coupled?"
- Seeing a data flow animation pause at a particular service, they ask "What error handling happens here?"

The visual medium transforms the AI chat from "I hope the AI understands what I mean" to "We are both looking at the same picture."

### 7.4 How Diagrams Give the "Overall Picture" That Text Cannot

Text documentation is inherently **sequential** -- one concept at a time, one paragraph at a time. This creates a fundamental problem: readers cannot see how everything connects until they have read everything.

Diagrams solve this by providing:

1. **Simultaneous relationships**: All connections are visible at once. You can see that Service A talks to Service B AND Service C AND the database simultaneously -- in text, these are described one at a time.

2. **Spatial clustering**: Related components naturally group together visually. The "frontend cluster" and "backend cluster" are immediately apparent without explicit section headers.

3. **Proportional importance**: Node size, color intensity, and connection density convey importance without saying "this is important." The eye is naturally drawn to the most connected, most prominent nodes.

4. **Absence detection**: In a diagram, missing connections are visible. "Why doesn't the frontend talk directly to the database?" is obvious from a diagram but invisible in text.

5. **Pattern recognition**: Repetitive architectural patterns (e.g., every service has a cache) are instantly visible in a diagram. In text, you might not notice the pattern across 5 different section descriptions.

### 7.5 The Viral Distribution Strategy

1. **GitHub badge/action**: "Visualize this repo with BetterCodeWiki" badge for README files. One click generates the visual wiki.

2. **Twitter/X card**: When sharing a BetterCodeWiki link, the Open Graph preview shows the architecture diagram with tech logos. Looks stunning in feeds.

3. **"Visualize any repo" input**: On the landing page, paste any GitHub URL and see an architecture preview in <30 seconds. No signup required.

4. **Export as OG image**: Every diagram has a "Share" button that generates a tweet-ready image with the repo name and BetterCodeWiki branding.

5. **Leaderboard / Gallery**: "Most beautiful architectures" gallery showing community-generated diagrams. Developers share their projects' diagrams for upvotes.

6. **VS Code extension**: Generate architecture diagrams from within the editor. Developers discover the web platform through the extension.

---

## Appendix A: Library Reference

| Library | npm Package | Use Case in Our Stack |
|---|---|---|
| React Flow | `@xyflow/react` | Primary 2D interactive diagram canvas |
| ELK.js | `elkjs` | Advanced graph layout computation |
| dagre | `dagre` | Simple tree/DAG layout (Mermaid default) |
| Cytoscape.js | `cytoscape` | Alternative for large-scale graph analysis |
| Three.js | `three` (already installed) | 3D rendering engine |
| React Three Fiber | `@react-three/fiber` (already installed) | React renderer for Three.js |
| drei | `@react-three/drei` (already installed) | R3F utilities (controls, text, HTML overlays) |
| r3f-forcegraph | `r3f-forcegraph` | 3D force-directed graph in R3F |
| GSAP | `gsap` (already installed) | Scroll-triggered animations, timelines |
| ScrollTrigger | `gsap/ScrollTrigger` (already installed) | Scroll-synced diagram expansion |
| Framer Motion | `framer-motion` (already installed) | Node/edge enter/exit animations, layout transitions |
| Lenis | `lenis` (already installed) | Smooth scrolling for scroll-synced diagrams |
| simple-icons | `simple-icons` | 3,300+ brand SVG icons (tech stack logos) |
| devicon | `devicon` | 800+ development tool icons |
| developer-icons | `developer-icons` | 400+ tech icons as React components |
| D2 | `d2` (CLI) / WASM | Alternative diagram rendering with icon support |
| Mermaid | `mermaid` (already installed) | Existing diagram rendering (keep as baseline) |
| tldraw | `@tldraw/tldraw` | Infinite canvas SDK (alternative to React Flow) |
| Excalidraw | `@excalidraw/excalidraw` | Hand-drawn diagram style option |
| svg-pan-zoom | `svg-pan-zoom` (already installed) | Pan/zoom for SVG diagrams |

## Appendix B: Competitive Feature Matrix

| Feature | BetterCodeWiki (Current) | BetterCodeWiki (Proposed) | Google CodeWiki | CodeSee | Sourcegraph |
|---|---|---|---|---|---|
| Auto-generated diagrams | Yes (Mermaid) | Yes (Multi-renderer) | Yes | Yes | Partial |
| Tech stack logos | No | Yes | Yes | No | No |
| Interactive click-to-explain | No | Yes | No | No | No |
| Animated data flows | No | Yes | No | No | No |
| 3D exploration | No | Yes | No | No | No |
| Commit-to-commit diffs | No | Yes | No | Yes (code maps) | No |
| Scroll-to-expand | No | Yes | No | No | No |
| AI diagram interaction | No | Yes | Limited (chat) | Limited | Yes (Cody) |
| Visual Explorer page | No | Yes | No | Yes | No |
| Shareable diagram images | No | Yes | No | No | No |
| Self-hostable | Yes | Yes | No (Gemini CLI coming) | No | Yes |
| Multiple AI models | Yes | Yes | No (Gemini only) | No | No (Cody only) |
| Multi-language wikis | Yes | Yes | No | No | No |

## Appendix C: Research Sources

- [Google Developers Blog -- Introducing Code Wiki](https://developers.googleblog.com/en/introducing-code-wiki-accelerating-your-code-understanding/)
- [Analytics Vidhya -- Google Code Wiki](https://www.analyticsvidhya.com/blog/2025/12/google-code-wiki/)
- [DevOps.com -- Google Code Wiki](https://devops.com/google-code-wiki-aims-to-solve-documentations-oldest-problem/)
- [Terrastruct -- D2 Language](https://terrastruct.com/)
- [Mermaid vs D2 Comparison](https://aaronjbecker.com/posts/mermaid-vs-d2-comparing-text-to-diagram-tools/)
- [Text-to-Diagram Tool Comparison 2025](https://text-to-diagram.com/)
- [React Flow (xyflow)](https://reactflow.dev/)
- [Cytoscape.js](https://js.cytoscape.org/)
- [CodeCity -- 3D Visualization](https://wettel.github.io/codecity.html)
- [Gource -- Software Version Control Visualization](https://gource.io/)
- [git-story -- Animated Git History](https://www.freecodecamp.org/news/animate-your-git-repo-with-git-story/)
- [Excalidraw](https://github.com/excalidraw/excalidraw)
- [tldraw SDK](https://tldraw.dev/)
- [simple-icons (3,300+ brand icons)](https://simpleicons.org/)
- [devicon (800+ dev tool icons)](https://devicon.dev/)
- [developer-icons](https://github.com/xandemon/developer-icons)
- [Swark -- AI Architecture Diagrams](https://github.com/swark-io/swark)
- [CodeSee](https://www.codesee.io/)
- [Sourcegraph](https://sourcegraph.com/)
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [Framer Motion (Motion)](https://motion.dev)
- [r3f-forcegraph](https://github.com/vasturiano/r3f-forcegraph)
- [ELK.js Layout](https://github.com/cytoscape/cytoscape.js-elk)
- [The CTO Club -- Best Code Visualization Tools 2026](https://thectoclub.com/tools/best-code-visualization-tools/)

---

*This document is a living research artifact. Features and timelines should be validated with engineering feasibility assessments and user research before commitment.*
