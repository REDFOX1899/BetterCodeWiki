# Leveraging Structured Diagram Data for AI Agent Intelligence

**Author:** Claude Opus 4.6 (AI Systems Architecture Analysis)
**Date:** 2026-02-20
**Status:** Research Document / Design Proposal

---

## Part 1: Current State Analysis

### 1.1 What Diagram Data Currently Exists

BetterCodeWiki generates structured diagram data as a byproduct of wiki generation. The AI model (Gemini, OpenAI, etc.) produces both a Mermaid diagram and a parallel JSON structure embedded in HTML comment markers within wiki page content. This JSON is extracted post-generation by `api/diagram_extract.py` and stored in the wiki cache alongside each page.

**Schema (from `api/diagram_schema.py` and `src/types/diagramData.ts`):**

```typescript
interface DiagramNode {
  id: string;           // Matches Mermaid node IDs (e.g., "A", "B")
  label: string;        // Human-readable name (e.g., "API Server")
  technology?: string;  // Lowercase slug (e.g., "fastapi", "react", "postgresql")
  files: string[];      // Associated source file paths from the repository
  description?: string; // Brief text description of what this component does
  depth: number;        // Hierarchy level: 0 = overview, 1 = detailed, 2+ = full
}

interface DiagramEdge {
  source: string;       // Source node ID
  target: string;       // Target node ID
  label?: string;       // Relationship description (e.g., "HTTP requests")
  type: 'dependency' | 'data_flow' | 'api_call';
}

interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  mermaidSource: string;              // The raw Mermaid code
  diagramType: 'flowchart' | 'sequence' | 'class' | 'er';
}
```

**Key properties of this data:**

- **Multi-depth hierarchy**: Nodes have a `depth` field (0, 1, 2+) that enables progressive disclosure -- agents can start with a high-level overview (depth 0) and drill down only where needed.
- **File associations**: Every node carries a `files[]` array mapping architectural components to specific source files. This is the critical bridge between abstract architecture and concrete code.
- **Typed edges**: Three edge types (`dependency`, `data_flow`, `api_call`) encode fundamentally different relationships. An agent can distinguish "this module depends on that library" from "data flows from the API to the database" from "the frontend makes API calls to the backend."
- **Technology annotations**: The `technology` field provides quick categorization without reading code (a node labeled "Cache Layer" with `technology: "redis"` tells an agent volumes).
- **Per-page scoping**: Diagrams are stored per wiki page, meaning there can be multiple diagrams per repository covering different aspects (architecture overview, data pipeline, auth flow, etc.).

**How the data is stored in the wiki cache:**

Each wiki cache file (e.g., `~/.adalflow/wikicache/deepwiki_cache_github_owner_repo_en.json`) contains:
```json
{
  "wiki_structure": { "title": "...", "pages": [...], "sections": [...] },
  "generated_pages": {
    "page-id": {
      "id": "page-id",
      "title": "Core Architecture",
      "content": "... markdown with Mermaid ...",
      "filePaths": ["src/app.tsx", "api/main.py"],
      "importance": "high",
      "relatedPages": ["page-data-flow", "page-auth"],
      "diagramData": [
        { "nodes": [...], "edges": [...], "mermaidSource": "...", "diagramType": "flowchart" }
      ]
    }
  },
  "provider": "google",
  "model": "gemini-2.5-flash"
}
```

### 1.2 What the MCP Server Currently Exposes

The MCP server (`api/mcp/server.py`) provides five tools and two resources:

| Tool | What it returns | Diagram awareness |
|------|----------------|-------------------|
| `list_projects` | List of cached repos (owner, repo, type, language) | None |
| `get_wiki_overview` | Wiki title, description, page listing with IDs/titles/importance/filePaths | None -- does not mention diagram data |
| `get_wiki_page` | Full page content (markdown), filePaths, relatedPages | **Indirect** -- the `content` field contains Mermaid source, and the `diagramData` field exists in the cache but is NOT returned |
| `search_wiki` | Text-matched pages with snippets | None |
| `ask_codebase` | Top-3 relevant page contents for a question | None |

**Critical observation:** The MCP server currently returns zero structured diagram data to agents. The `get_wiki_page` tool returns `content`, `filePaths`, `importance`, and `relatedPages` -- but explicitly omits the `diagramData` array. An agent calling `get_wiki_page` gets the raw Mermaid source embedded in markdown (which it could parse, but at significant token cost and with no structured semantics), but never gets the parsed node/edge graph.

### 1.3 Gaps Between What Exists and What Agents Need

**Gap 1: Diagram data is invisible to MCP clients.**
The richest structured data in BetterCodeWiki -- the node/edge graph with file mappings, technologies, depths, and typed relationships -- is generated, extracted, and stored, but never surfaced through the MCP protocol. The frontend Explorer page uses it extensively; agents cannot access it at all.

**Gap 2: No graph traversal capabilities.**
Even if diagram data were exposed, agents would receive a flat list of nodes and edges. They would need to build their own graph in-context to answer questions like "what depends on this component?" or "what is the data flow path from A to C?" This burns tokens and is error-prone.

**Gap 3: No file-to-node reverse mapping.**
An agent working on a specific file (e.g., `src/components/Auth.tsx`) has no way to ask "what architectural component does this file belong to?" and "what other components does it connect to?" The mapping exists (node.files), but there is no tool to query it in reverse.

**Gap 4: No cross-diagram merging.**
The frontend Explorer page merges diagrams from all pages into a unified graph (see `explore/page.tsx` lines 122-178). The MCP server has no equivalent -- an agent would need to fetch every page, extract diagrams, and merge them itself.

**Gap 5: No architecture summary at controlled depth.**
The depth system (0=overview, 1=detailed, 2=full) is used in the frontend to let users zoom in/out. Agents have no way to request "give me just the depth-0 overview of the architecture" vs. "give me everything."

**Gap 6: No impact/blast radius analysis.**
Given the edge data, it is possible to compute which nodes are affected by a change to a given node or file. This would be enormously valuable for agents planning refactors, but no such computation exists.

---

## Part 2: Concrete Use Cases

### 2.1 Context-Efficient Code Navigation

**Problem:** An agent working on a 500-file repository currently has two strategies: (a) read files one at a time, hoping to stumble on the right ones, or (b) read everything, blowing through context limits. Neither is efficient.

**Workflow with diagram data:**
1. Agent calls `get_architecture_map(owner, repo, depth=0)` to get a 10-15 node overview of the system.
2. Agent identifies the relevant area (e.g., "I need to modify the auth system").
3. Agent calls `get_node_context(owner, repo, node_id="auth-service")` and gets back:
   - The node's description, technology, and associated files
   - All edges to/from this node (what it depends on, what calls it)
   - Connected nodes with their labels and files
4. Agent now knows exactly which 3-8 files to read, and understands the architectural context of those files without reading anything else.

**Token savings:** Instead of reading 50-100 files to understand the auth system (~200K tokens), the agent reads structured data (~2K tokens) and then reads only the 5 relevant files (~10K tokens). A 10-20x reduction.

**MCP calls needed:**
```
get_architecture_map(owner="acme", repo="platform", depth=0)
  -> returns compact graph: 12 nodes, 18 edges, all with file lists
get_node_context(owner="acme", repo="platform", node_id="auth-service")
  -> returns: node details + 4 connected nodes + 6 files
```

### 2.2 Impact Analysis (Blast Radius)

**Problem:** Before making a change, an agent needs to understand what else might break. Currently this requires reading import statements across the codebase or hoping the agent's training data includes enough pattern knowledge.

**Workflow with diagram data:**
1. Agent is about to modify `api/auth.py`.
2. Agent calls `get_blast_radius(owner, repo, file_path="api/auth.py")`.
3. Tool returns:
   - The node this file belongs to ("Auth Service")
   - All directly connected nodes via all edge types
   - All transitively connected nodes (2-hop) via dependency and api_call edges
   - The specific files in each affected node
4. Agent can now proactively check those files for compatibility before making the change.

**Example response:**
```json
{
  "source_node": { "id": "auth", "label": "Auth Service", "files": ["api/auth.py", "api/tokens.py"] },
  "direct_impact": [
    { "node": { "id": "api-gateway", "label": "API Gateway" }, "edge_type": "api_call", "files": ["api/gateway.py"] },
    { "node": { "id": "user-service", "label": "User Service" }, "edge_type": "dependency", "files": ["api/users.py"] }
  ],
  "transitive_impact": [
    { "node": { "id": "frontend", "label": "Frontend App" }, "path": ["auth -> api-gateway -> frontend"], "files": ["src/api/client.ts"] }
  ],
  "total_files_affected": ["api/gateway.py", "api/users.py", "src/api/client.ts"]
}
```

### 2.3 Architecture-Aware Code Generation

**Problem:** When an agent generates new code (a new endpoint, a new component, a new service), it often creates something that is structurally inconsistent with the existing architecture -- wrong patterns, wrong directory, wrong naming conventions.

**Workflow with diagram data:**
1. User asks: "Add a notification service that sends emails when users sign up."
2. Agent calls `get_architecture_map(owner, repo, depth=1)` to understand the system.
3. Agent identifies: there is already a "User Service" node, an "Email Provider" node (external), and understands the data flow pattern.
4. Agent calls `get_node_context(owner, repo, node_id="user-service")` to see how the user service is structured (files, technology, patterns).
5. Agent calls `get_node_context(owner, repo, node_id="email-provider")` to see how external services are integrated.
6. Agent generates code that follows the existing patterns: same directory structure, same naming, same dependency injection approach, properly wired into the existing data flow.

**The key insight:** Diagram data tells the agent not just *what* exists but *how things relate*. The edge types (dependency, data_flow, api_call) encode architectural patterns. If all backend services connect via `api_call` edges, the agent knows to create an API endpoint, not a direct function import.

### 2.4 Dependency-Aware Refactoring

**Problem:** Refactoring a module requires knowing every consumer. Import-based analysis is language-specific and fragile. Diagram data provides a language-agnostic, semantically meaningful dependency graph.

**Workflow with diagram data:**
1. Agent is asked to "split the monolithic API into separate user and auth services."
2. Agent calls `get_node_context(owner, repo, node_id="api-server")` and sees:
   - 8 incoming `api_call` edges (from frontend, mobile app, admin panel, etc.)
   - 3 outgoing `dependency` edges (to database, cache, email)
   - 12 associated files
3. Agent calls `trace_data_flow(owner, repo, from_node="frontend", to_node="database")` and sees the full path: frontend -> api-server -> database, with the specific files at each hop.
4. Agent can now plan the refactor: which edges need to be rerouted, which files need new imports, which API contracts change.

**MCP calls:**
```
get_node_context(owner="acme", repo="platform", node_id="api-server")
trace_data_flow(owner="acme", repo="platform", from_node="frontend", to_node="database")
get_nodes_by_file(owner="acme", repo="platform", file_path="api/routes/users.py")
```

### 2.5 Onboarding Acceleration

**Problem:** When a new agent session starts (or an agent is asked about an unfamiliar repo), it has zero context. Current approach: read README, then incrementally explore. This is slow and incomplete.

**Workflow with diagram data:**
1. At session start, agent calls `get_architecture_map(owner, repo, depth=0)`.
2. In one response (~1-2K tokens), the agent now knows:
   - The system has 10 major components
   - It is a frontend (React) + backend (FastAPI) + database (PostgreSQL) + cache (Redis) + queue (RabbitMQ) architecture
   - Data flows from frontend through API gateway to three microservices
   - There are two external integrations (Stripe, SendGrid)
3. Agent can immediately answer questions like "what tech stack does this use?" or "how does the frontend communicate with the backend?" without reading any source files.
4. For deeper questions, the agent can drill into specific nodes.

**This is the single highest-impact use case.** It transforms agent behavior from "fumbling in the dark" to "starting with a map."

### 2.6 Cross-Service Debugging

**Problem:** In distributed systems, bugs often manifest in one service but originate in another. An agent debugging a frontend error needs to trace the data flow backwards through the API to the source.

**Workflow with diagram data:**
1. Agent sees error in `src/components/Dashboard.tsx` -- data is malformed.
2. Agent calls `get_nodes_by_file(owner, repo, file_path="src/components/Dashboard.tsx")` and learns this file belongs to the "Dashboard" node.
3. Agent calls `trace_data_flow(owner, repo, to_node="dashboard")` and gets the full upstream path:
   - Database -> Analytics Service -> API Gateway -> Dashboard
4. Agent now knows to check the Analytics Service and its data transformation logic, rather than just the frontend rendering code.
5. Agent reads only the files in the Analytics Service node -- 3 files instead of searching the entire backend.

---

## Part 3: New MCP Tools to Build

### 3.1 `get_architecture_map` -- The Foundation Tool

**Purpose:** Return the merged, depth-filtered architecture graph for a repository. This is the agent equivalent of opening the Visual Explorer page.

```python
@mcp.tool()
def get_architecture_map(
    owner: str,
    repo: str,
    depth: int = 0,
    view: str = "architecture",  # "architecture" | "dataflow" | "dependencies"
    repo_type: str = "github",
    language: str = "en",
) -> dict:
    """Get the structured architecture graph for a repository.

    Returns a merged graph of all diagram data across wiki pages, filtered
    by depth level and view type. This is the most efficient way for an
    agent to understand a codebase's architecture.

    Depth levels:
      0 = High-level overview (major components only, typically 5-15 nodes)
      1 = Detailed view (sub-components visible, typically 15-40 nodes)
      2+ = Full view (all nodes, can be 50+ nodes)

    View types:
      "architecture" = All edges (complete picture)
      "dataflow" = Only data_flow edges (how data moves through the system)
      "dependencies" = Only dependency and api_call edges (what depends on what)

    Args:
        owner: Repository owner
        repo: Repository name
        depth: Maximum depth level to include (default 0 for overview)
        view: Edge filter type (default "architecture" for all edges)
        repo_type: Platform type
        language: Wiki language code

    Returns:
        {
            "nodes": [
                {
                    "id": "api-server",
                    "label": "API Server",
                    "technology": "fastapi",
                    "files": ["api/main.py", "api/routes/"],
                    "description": "REST API backend",
                    "depth": 0,
                    "category": "backend"
                },
                ...
            ],
            "edges": [
                {
                    "source": "frontend",
                    "target": "api-server",
                    "label": "HTTP requests",
                    "type": "api_call"
                },
                ...
            ],
            "stats": {
                "total_nodes": 12,
                "total_edges": 18,
                "total_files": 45,
                "categories": {"frontend": 3, "backend": 4, "database": 2, "external": 3}
            }
        }
    """
```

**Implementation notes:** This tool mirrors the merging logic already present in `src/app/[owner]/[repo]/explore/page.tsx` (lines 122-178) and the category inference in `src/lib/diagramToReactFlow.ts`. The Python implementation would:
1. Load the wiki cache
2. Iterate all `generated_pages`, collecting all `diagramData` arrays
3. Merge nodes (dedup by ID) and edges (dedup by source+target+type)
4. Filter nodes by depth, filter edges by view type
5. Prune orphan nodes in filtered views
6. Compute category using the same regex patterns from `diagramToReactFlow.ts`

### 3.2 `get_node_context` -- Deep Dive on a Single Component

**Purpose:** Given a node ID, return everything known about it: the node itself, all connected edges, all connected nodes (with their metadata), and all associated files.

```python
@mcp.tool()
def get_node_context(
    owner: str,
    repo: str,
    node_id: str,
    include_transitive: bool = False,
    repo_type: str = "github",
    language: str = "en",
) -> dict:
    """Get detailed context for a specific architecture node.

    Returns the node's metadata, all directly connected nodes and edges,
    and the complete list of files associated with this node and its
    immediate neighbors. Optionally includes transitive (2-hop) connections.

    This is the primary tool for understanding a specific component
    and its place in the architecture.

    Args:
        owner: Repository owner
        repo: Repository name
        node_id: The diagram node ID to look up
        include_transitive: If True, include 2-hop connections (default False)
        repo_type: Platform type
        language: Wiki language code

    Returns:
        {
            "node": {
                "id": "auth-service",
                "label": "Auth Service",
                "technology": "fastapi",
                "files": ["api/auth.py", "api/tokens.py"],
                "description": "Handles authentication and JWT token management",
                "depth": 1,
                "category": "backend"
            },
            "incoming_edges": [
                {
                    "from_node": {"id": "api-gateway", "label": "API Gateway", "technology": "nginx"},
                    "edge": {"label": "auth requests", "type": "api_call"}
                }
            ],
            "outgoing_edges": [
                {
                    "to_node": {"id": "user-db", "label": "User Database", "technology": "postgresql"},
                    "edge": {"label": "credential lookup", "type": "data_flow"}
                }
            ],
            "all_relevant_files": [
                "api/auth.py", "api/tokens.py",          // this node
                "api/gateway.py",                          // incoming neighbor
                "api/models/user.py", "migrations/001.sql" // outgoing neighbor
            ],
            "transitive_connections": [...]  // if include_transitive=True
        }
    """
```

### 3.3 `get_blast_radius` -- Impact Analysis

**Purpose:** Given a file path or node ID, compute the set of nodes and files that would be affected by a change.

```python
@mcp.tool()
def get_blast_radius(
    owner: str,
    repo: str,
    file_path: str = None,
    node_id: str = None,
    max_hops: int = 2,
    repo_type: str = "github",
    language: str = "en",
) -> dict:
    """Compute the impact radius of changing a file or component.

    Given a file path or node ID, traces all edges outward to find every
    component that could be affected by a change. Uses edge directionality:
    follows incoming dependency edges (things that depend on this) and
    outgoing data_flow edges (things this sends data to).

    Args:
        owner: Repository owner
        repo: Repository name
        file_path: Path to a source file (will be resolved to its node)
        node_id: Direct node ID (alternative to file_path)
        max_hops: Maximum edge traversal depth (default 2)
        repo_type: Platform type
        language: Wiki language code

    Returns:
        {
            "source": {"id": "auth-service", "label": "Auth Service", "files": [...]},
            "impact_by_hop": {
                "1": [
                    {
                        "node": {"id": "api-gateway", "label": "API Gateway"},
                        "edge_type": "api_call",
                        "direction": "depends_on_source",
                        "files": ["api/gateway.py"]
                    }
                ],
                "2": [
                    {
                        "node": {"id": "frontend", "label": "Frontend"},
                        "path": "auth-service <- api-gateway <- frontend",
                        "files": ["src/api/client.ts"]
                    }
                ]
            },
            "total_affected_nodes": 5,
            "total_affected_files": ["api/gateway.py", "src/api/client.ts", ...],
            "risk_assessment": "medium"  // based on number of affected nodes and edge types
        }
    """
```

**Implementation note on directionality:** The blast radius should follow edges "backwards" -- if node B has a `dependency` edge pointing to node A, and A changes, then B is affected. If node A has a `data_flow` edge to node C, and A's output format changes, then C is affected. The traversal logic:
- Follow incoming `dependency` edges (dependents are affected)
- Follow incoming `api_call` edges (callers are affected)
- Follow outgoing `data_flow` edges (downstream consumers are affected)

### 3.4 `trace_data_flow` -- Path Finding

**Purpose:** Find the data flow path between two components, showing every hop and the files involved.

```python
@mcp.tool()
def trace_data_flow(
    owner: str,
    repo: str,
    from_node: str = None,
    to_node: str = None,
    repo_type: str = "github",
    language: str = "en",
) -> dict:
    """Trace the data flow path between two components.

    Finds all paths (via BFS) between two nodes following data_flow and
    api_call edges. If only to_node is specified, shows all paths leading
    to that node. If only from_node is specified, shows all paths
    originating from that node.

    Useful for understanding how data moves through the system and for
    debugging issues where data is transformed incorrectly at some hop.

    Args:
        owner: Repository owner
        repo: Repository name
        from_node: Source node ID (optional -- omit to find all paths TO to_node)
        to_node: Destination node ID (optional -- omit to find all paths FROM from_node)
        repo_type: Platform type
        language: Wiki language code

    Returns:
        {
            "paths": [
                {
                    "hops": [
                        {"node_id": "frontend", "label": "Frontend", "files": ["src/api.ts"]},
                        {"node_id": "api-gw", "label": "API Gateway", "files": ["api/gw.py"],
                         "edge_label": "HTTP POST /users", "edge_type": "api_call"},
                        {"node_id": "user-svc", "label": "User Service", "files": ["api/users.py"],
                         "edge_label": "create user", "edge_type": "data_flow"},
                        {"node_id": "db", "label": "Database", "files": ["migrations/"],
                         "edge_label": "INSERT", "edge_type": "data_flow"}
                    ],
                    "total_hops": 3,
                    "all_files": ["src/api.ts", "api/gw.py", "api/users.py", "migrations/"]
                }
            ],
            "total_paths_found": 1
        }
    """
```

### 3.5 `get_nodes_by_file` -- Reverse File Lookup

**Purpose:** Given a file path, find which architectural component(s) it belongs to and what that component connects to.

```python
@mcp.tool()
def get_nodes_by_file(
    owner: str,
    repo: str,
    file_path: str,
    repo_type: str = "github",
    language: str = "en",
) -> dict:
    """Find which architecture components a file belongs to.

    Searches all diagram nodes for ones whose files[] array matches the
    given file path (supports partial path matching). Returns the matching
    nodes and their immediate connections.

    This is the key tool for "spatial awareness" -- when an agent is
    editing a file, it can instantly understand where that file sits
    in the architecture.

    Args:
        owner: Repository owner
        repo: Repository name
        file_path: Path to a source file (partial match supported)
        repo_type: Platform type
        language: Wiki language code

    Returns:
        {
            "file": "api/auth.py",
            "belongs_to": [
                {
                    "node": {"id": "auth-svc", "label": "Auth Service", ...},
                    "connected_to": [
                        {"id": "api-gw", "label": "API Gateway", "edge_type": "api_call"},
                        {"id": "user-db", "label": "Database", "edge_type": "data_flow"}
                    ]
                }
            ],
            "architectural_context": "This file is part of the Auth Service (backend),
                which receives API calls from the API Gateway and reads/writes to the
                User Database. It is a depth-1 component in the backend category."
        }
    """
```

### 3.6 `get_architecture_summary` -- Text Summary for System Prompts

**Purpose:** Return a compact, natural-language summary of the architecture suitable for inclusion in an agent's system prompt or context window. This is distinct from `get_architecture_map` in that it returns prose, not structured data.

```python
@mcp.tool()
def get_architecture_summary(
    owner: str,
    repo: str,
    depth: int = 0,
    max_tokens: int = 500,
    repo_type: str = "github",
    language: str = "en",
) -> str:
    """Get a compact text summary of the repository architecture.

    Generates a concise natural-language description of the architecture
    from diagram data. Designed to fit in an agent's system prompt or
    context preamble. Much more token-efficient than reading wiki pages.

    Args:
        owner: Repository owner
        repo: Repository name
        depth: Detail level (0=overview, 1=detailed)
        max_tokens: Approximate token budget for the summary
        repo_type: Platform type
        language: Wiki language code

    Returns:
        A string like:

        "## Architecture: owner/repo

        **Stack:** React (frontend), FastAPI (backend), PostgreSQL (database),
        Redis (cache), RabbitMQ (queue)

        **Components (12 nodes):**
        - Frontend App (react) -> API Gateway via HTTP
        - API Gateway (nginx) -> Auth Service, User Service, Product Service
        - Auth Service (fastapi) -> User Database, Token Cache
        - User Service (fastapi) -> User Database, Email Provider
        - Product Service (fastapi) -> Product Database, Search Index
        - User Database (postgresql) | Product Database (postgresql)
        - Token Cache (redis) | Search Index (elasticsearch)
        - Email Provider (sendgrid) [external]

        **Key data flows:**
        - User signup: Frontend -> Gateway -> User Service -> Database + Email
        - Authentication: Frontend -> Gateway -> Auth Service -> Database + Cache
        - Product search: Frontend -> Gateway -> Product Service -> Search Index"
    """
```

### 3.7 `compare_architectures` -- Diff Between Versions (Future)

**Purpose:** If wiki caches are versioned (or if two repos are compared), return the structural diff between two architecture graphs.

```python
@mcp.tool()
def compare_architectures(
    owner: str,
    repo: str,
    # Could compare two language versions, or a "before" cache snapshot
    baseline_language: str = "en",
    current_language: str = "en",
    repo_type: str = "github",
) -> dict:
    """Compare two versions of an architecture graph.

    Returns added/removed/modified nodes and edges. Useful for understanding
    what changed between versions or for verifying that a planned refactor
    was implemented correctly.

    Returns:
        {
            "added_nodes": [...],
            "removed_nodes": [...],
            "modified_nodes": [...],  // same ID, different edges/files
            "added_edges": [...],
            "removed_edges": [...],
            "summary": "2 nodes added (NotificationService, EventBus),
                       1 node removed (MonolithAPI), 3 edges rerouted"
        }
    """
```

### 3.8 `find_similar_components` -- Pattern Matching

**Purpose:** Given a description of what the agent wants to build, find existing components with similar patterns.

```python
@mcp.tool()
def find_similar_components(
    owner: str,
    repo: str,
    description: str,
    technology: str = None,
    repo_type: str = "github",
    language: str = "en",
) -> list[dict]:
    """Find existing components similar to a described one.

    Searches diagram nodes by description, label, and technology to find
    components that match a pattern the agent wants to replicate. Useful
    for "build something like X" tasks.

    Args:
        description: What the agent wants to build (e.g., "a service that
                     processes background jobs")
        technology: Optional technology filter (e.g., "python", "redis")

    Returns:
        [
            {
                "node": {"id": "worker", "label": "Background Worker", ...},
                "similarity_reason": "Matches 'background jobs' pattern",
                "files": ["api/worker.py", "api/tasks/"],
                "connections": [...]
            }
        ]
    """
```

---

## Part 4: Protocol Ideas Beyond MCP

### 4.1 Codebase Map at Session Start

**Concept:** When an agent session begins (a developer opens Claude Code in a repo, or Cursor starts in a project), the agent automatically loads a compact architecture map as part of its initial context.

**How it would work:**
1. Agent checks if a BetterCodeWiki cache exists for the current repo (via `list_projects`).
2. If yes, agent calls `get_architecture_summary(depth=0)` and includes the result in its working memory.
3. This 300-500 token summary gives the agent immediate spatial awareness of the entire codebase.
4. As the user asks questions or makes requests, the agent can intelligently decide which part of the architecture to explore deeper, rather than doing blind file searches.

**Implementation approach:**
- Define a new MCP resource type: `wiki://{owner}/{repo}/map` that returns the architecture summary.
- Agents can subscribe to this resource at session start.
- Alternatively, the map could be served as a `.claude/codebase-map.md` file that agents are instructed to read (similar to CLAUDE.md).

**The `.codemap` file convention:**
A lightweight file (generated by BetterCodeWiki) placed in the repo root:
```
.codemap
```
This file contains the depth-0 architecture summary plus a list of key files per component. Agents that recognize this convention automatically gain architectural awareness. It would be:
- Generated by BetterCodeWiki as an export option
- Committed to the repo (like a lockfile)
- Automatically read by agents (like CLAUDE.md)
- ~500 tokens, so negligible context cost

### 4.2 Bidirectional Diagram Sync

**Concept:** When an agent makes structural changes to a codebase (adds a new service, creates a new API endpoint, changes a dependency), the diagram data should update automatically.

**Three approaches, ranked by feasibility:**

**Approach A: Agent-initiated update (most feasible)**
After making changes, the agent calls a new MCP tool:
```python
@mcp.tool()
def propose_diagram_update(
    owner: str,
    repo: str,
    changes: list[dict],  # e.g., [{"type": "add_node", "node": {...}}, {"type": "add_edge", ...}]
) -> dict:
    """Propose updates to the architecture diagram based on code changes."""
```
The update is stored as a "pending change" that a human reviews in the BetterCodeWiki UI. This avoids the risk of the agent corrupting the diagram.

**Approach B: Re-generation triggered by git hooks (medium feasibility)**
A git post-commit hook detects which files changed, maps them to diagram nodes via the file association, and triggers a targeted re-generation of affected wiki pages. The diagram data updates as a side effect of wiki re-generation.

**Approach C: Real-time AST-based sync (hard, high value)**
Parse the actual code to detect structural changes (new imports, new classes, new API routes) and update the diagram in real-time. This would require language-specific analyzers but would provide ground-truth accuracy.

### 4.3 Integration with LSP (Language Server Protocol)

**Concept:** LSP already provides real-time information about code structure (symbols, references, definitions). Diagram data could be cross-referenced with LSP data to provide even richer context.

**Concrete integration points:**

1. **Symbol-to-node mapping:** When an agent asks LSP for references to a function, the response could be annotated with which architectural component each reference belongs to. Instead of "this function is called in 15 files," the agent sees "this function is called by 3 components: API Gateway (5 files), Auth Service (4 files), and User Service (6 files)."

2. **Architectural breadcrumbs:** LSP's document symbols could be extended with architectural context. The agent sees not just `class AuthHandler` but `class AuthHandler [Auth Service -> API Gateway integration point]`.

3. **Diagram-aware go-to-definition:** When navigating to a definition that crosses an architectural boundary (e.g., from frontend code to a backend API endpoint), the agent is alerted: "This crosses a service boundary (api_call edge from Frontend to API Gateway)."

**Implementation:** This would likely be a proxy/middleware that wraps the existing LSP server and enriches its responses with diagram data from the MCP server.

### 4.4 Agent-to-Agent Communication via Shared Diagram State

**Concept:** In multi-agent systems (e.g., Devin's planning agent + coding agent + testing agent), the architecture diagram serves as a shared cognitive map.

**How it would work:**
1. The planning agent loads the architecture map and decides: "We need to modify the Auth Service and the API Gateway."
2. It annotates the diagram with work assignments: Auth Service -> coding-agent-1, API Gateway -> coding-agent-2.
3. Each coding agent loads its assigned subgraph and works within that scope, knowing exactly its boundaries and interfaces.
4. When coding-agent-1 finishes modifying the Auth Service, it marks its subgraph as "modified" with a summary of changes.
5. Coding-agent-2 sees this update and adjusts its API Gateway work to account for the Auth Service changes.
6. The testing agent uses the diagram to identify integration test points: every edge between modified nodes needs a test.

**Protocol design:**
```python
@mcp.tool()
def annotate_node(owner, repo, node_id, annotation):
    """Add a temporary annotation to a node (e.g., 'in-progress', 'modified', 'assigned-to: agent-2')"""

@mcp.tool()
def get_annotations(owner, repo):
    """Get all current annotations on the graph"""

@mcp.tool()
def claim_subgraph(owner, repo, node_ids):
    """Mark a set of nodes as being worked on by this agent"""
```

This transforms the architecture diagram from a static document into a live collaboration surface.

### 4.5 Diagram-Driven Test Generation

**Concept:** Edge types in the diagram directly imply what tests are needed:
- `api_call` edges imply integration tests (does the caller correctly invoke the callee?)
- `data_flow` edges imply data contract tests (does the data format match at each hop?)
- `dependency` edges imply unit test boundaries (mock the dependency, test the dependent)

An agent could call:
```python
@mcp.tool()
def suggest_test_strategy(owner, repo, node_id):
    """Based on a node's edges, suggest what tests are needed."""
```

And receive:
```json
{
  "unit_tests": {
    "mock_these": ["database", "cache"],
    "test_files": ["api/auth.py", "api/tokens.py"]
  },
  "integration_tests": {
    "test_edges": [
      {"from": "api-gateway", "to": "auth-service", "type": "api_call",
       "test_description": "Verify auth endpoints respond correctly to gateway requests"}
    ]
  },
  "data_contract_tests": {
    "verify_flows": [
      {"from": "auth-service", "to": "user-db", "type": "data_flow",
       "test_description": "Verify user model schema matches database schema"}
    ]
  }
}
```

---

## Part 5: Implementation Priorities

### Priority Matrix

| # | Tool/Feature | Impact | Effort | Priority |
|---|-------------|--------|--------|----------|
| 1 | `get_architecture_map` | **Critical** -- unlocks all other use cases | **Low** -- merging logic already exists in frontend | **P0 -- Build first** |
| 2 | `get_node_context` | **High** -- core navigation primitive | **Low** -- simple graph lookup | **P0 -- Build first** |
| 3 | `get_nodes_by_file` | **High** -- enables spatial awareness | **Low** -- reverse index on files array | **P0 -- Build first** |
| 4 | `get_architecture_summary` | **High** -- session bootstrap | **Medium** -- needs text generation from graph | **P1 -- Build second** |
| 5 | `get_blast_radius` | **High** -- safety for refactoring | **Medium** -- graph traversal with directionality | **P1 -- Build second** |
| 6 | `trace_data_flow` | **Medium** -- debugging use case | **Medium** -- BFS pathfinding | **P2 -- Build third** |
| 7 | `.codemap` file convention | **High** -- zero-setup agent intelligence | **Low** -- export existing data to file | **P1 -- Build second** |
| 8 | `find_similar_components` | **Medium** -- code generation aid | **Medium** -- fuzzy matching | **P2 -- Build third** |
| 9 | `suggest_test_strategy` | **Medium** -- testing aid | **Medium** -- edge-type based rules | **P3 -- Build later** |
| 10 | `compare_architectures` | **Low** (needs versioning first) | **High** -- needs cache versioning | **P3 -- Build later** |
| 11 | Bidirectional sync (Approach A) | **Medium** -- keeps diagrams fresh | **Medium** -- new API endpoint | **P3 -- Build later** |
| 12 | LSP integration | **High** but niche | **Very High** -- proxy/middleware | **P4 -- Research** |
| 13 | Agent-to-agent via shared state | **High** for multi-agent | **High** -- needs annotation layer | **P4 -- Research** |

### Recommended Implementation Roadmap

#### Wave 1: Foundation (1-2 weeks)

**Goal:** Make diagram data accessible to agents through MCP.

1. **Add `get_architecture_map` to `api/mcp/server.py`.**
   - Port the merging logic from `explore/page.tsx` to Python.
   - Port the category inference from `diagramToReactFlow.ts` to Python.
   - Support depth filtering and view filtering.
   - This single tool transforms agent capability.

2. **Add `get_node_context` to `api/mcp/server.py`.**
   - Load merged graph, find node by ID, collect edges, resolve connected nodes.
   - Include file lists for the node and all neighbors.

3. **Add `get_nodes_by_file` to `api/mcp/server.py`.**
   - Build a reverse index: file_path -> [node_ids].
   - Support partial path matching (agent may provide relative paths).

4. **Update `get_wiki_page` to include `diagramData`.**
   - Currently omitted. Add it to the return dict.
   - This is a one-line fix with immediate value.

**Estimated effort:** ~200-300 lines of Python. No new dependencies. No frontend changes. No infrastructure changes.

#### Wave 2: Intelligence Layer (2-3 weeks)

**Goal:** Enable proactive agent capabilities (impact analysis, summaries, bootstrapping).

5. **Add `get_architecture_summary`.**
   - Generate natural language from graph structure.
   - Template-based (no LLM needed): enumerate nodes by category, list key data flows.
   - Respect token budget parameter.

6. **Add `get_blast_radius`.**
   - BFS traversal with directional edge following.
   - Classify risk based on number of affected nodes and edge types.

7. **Implement `.codemap` export.**
   - New API endpoint or CLI command that generates a `.codemap` file from wiki cache.
   - The file follows a simple, readable format that any agent can parse.

#### Wave 3: Advanced Navigation (3-4 weeks)

8. **Add `trace_data_flow`.**
   - BFS pathfinding between nodes, filtering to data_flow and api_call edges.
   - Return all paths (not just shortest) up to a configurable max.

9. **Add `find_similar_components`.**
   - Text similarity matching on node labels, descriptions, and technologies.
   - Return ranked results with explanation of why they match.

10. **Add `suggest_test_strategy`.**
    - Rule-based analysis of edge types around a node.
    - Generate structured test recommendations.

#### Wave 4: Ecosystem (ongoing)

11. **Bidirectional sync (Approach A: agent-proposed updates).**
12. **Architecture diff/comparison tool.**
13. **Research: LSP integration prototype.**
14. **Research: Multi-agent shared state protocol.**

### Key Design Principles

1. **Token efficiency above all.** Every tool should be designed to return the minimum data needed. The depth parameter, view filters, and summary tools all exist to keep responses small. An agent should never need to process more than 2-3K tokens of diagram data to understand where it is.

2. **File paths are the bridge.** The single most valuable property of diagram nodes is `files[]`. This bridges the abstract world of architecture diagrams to the concrete world of source code that agents operate on. Every tool should prominently surface file paths.

3. **Typed edges encode semantics.** The distinction between `dependency`, `data_flow`, and `api_call` is not cosmetic. Each type implies different agent behavior: dependencies need mocking in tests, data flows need format validation, API calls need contract checking. Tools should preserve and leverage these types.

4. **Progressive disclosure by depth.** Agents should start at depth 0 and drill down on demand. The depth system prevents information overload while ensuring nothing is hidden. This matches how human developers navigate codebases: start with the big picture, zoom into the relevant area.

5. **Zero configuration for agents.** The MCP tools should work with the existing wiki cache format. No new data generation, no new AI calls, no new infrastructure. The data already exists; it just needs to be exposed through the right interfaces.

---

## Appendix A: Estimated Token Savings

| Scenario | Without diagram tools | With diagram tools | Savings |
|----------|----------------------|-------------------|---------|
| "What tech stack does this use?" | Read README + 5 config files (~8K tokens) | `get_architecture_summary` (~500 tokens) | 16x |
| "Add a notification service" | Read 20+ files to understand patterns (~60K tokens) | `get_architecture_map` + `get_node_context` x2 (~3K tokens) + read 4 pattern files (~8K tokens) | 5x |
| "What breaks if I change auth?" | Grep imports across codebase (~30K tokens) | `get_blast_radius` (~1K tokens) | 30x |
| "Debug data corruption in dashboard" | Read 15 files across services (~45K tokens) | `trace_data_flow` (~1K tokens) + read 3 key files (~6K tokens) | 6x |
| New agent session bootstrap | Read README + CLAUDE.md + browse dirs (~10K tokens) | `get_architecture_summary` (~500 tokens) | 20x |

## Appendix B: Example Agent Interaction

Here is a hypothetical agent session using the proposed tools:

```
User: "The dashboard is showing stale data. Can you figure out why?"

Agent thinking:
  1. I need to understand the data flow to the dashboard.
  -> calls get_nodes_by_file(file_path="src/components/Dashboard.tsx")
  <- returns: belongs to "Dashboard" node, connected to "API Gateway" (api_call) and "Analytics Cache" (data_flow)

  2. Let me trace how data gets to the dashboard.
  -> calls trace_data_flow(to_node="dashboard")
  <- returns path: Database -> Analytics Service -> Analytics Cache -> API Gateway -> Dashboard

  3. The path includes a cache layer. Let me check the cache component.
  -> calls get_node_context(node_id="analytics-cache")
  <- returns: technology=redis, files=["api/cache/analytics.py"], description="Caches analytics queries for 15 minutes"

  4. Now I know the likely issue: the cache TTL might be too high.
  -> reads file api/cache/analytics.py (1 file, ~200 lines)
  <- finds CACHE_TTL = 900 (15 minutes)

Agent: "The stale data issue is caused by the Analytics Cache (Redis) which sits
between the Analytics Service and the API Gateway. It has a 15-minute TTL
configured in api/cache/analytics.py (line 23: CACHE_TTL = 900). The data flow
is: Database -> Analytics Service -> Analytics Cache -> API Gateway -> Dashboard.
I recommend either reducing the TTL or adding a cache invalidation trigger when
the underlying data changes."

Total files read: 1
Total tokens used for navigation: ~2,500
Without diagram tools: would have needed to read 10-15 files to trace this path.
```
