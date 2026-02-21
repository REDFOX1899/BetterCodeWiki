/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import Ask from '@/components/Ask';
import Markdown from '@/components/Markdown';
import ModelSelectionModal from '@/components/ModelSelectionModal';
import SearchCommand from '@/components/SearchCommand';
import TableOfContents from '@/components/TableOfContents';
import ThemeToggle from '@/components/theme-toggle';
import RepoMetadata from '@/components/RepoMetadata';
import WikiTreeView from '@/components/WikiTreeView';
import ExportMenu from '@/components/ExportMenu';
import { useLanguage } from '@/contexts/LanguageContext';
import { RepoInfo } from '@/types/repoinfo';
import getRepoUrl from '@/utils/getRepoUrl';
import { extractUrlDomain, extractUrlPath } from '@/utils/urlDecoder';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaBitbucket, FaBook, FaBookOpen, FaComments, FaDownload, FaExclamationTriangle, FaFileExport, FaFolder, FaGithub, FaGitlab, FaHome, FaProjectDiagram, FaSearch, FaSync, FaTimes } from 'react-icons/fa';
import DependencyGraph from '@/components/DependencyGraph';
import DiagramDetailPanel from '@/components/DiagramDetailPanel';
import { WikiSection, WikiPage, WikiStructure } from '@/types/wiki';
import { addTokensToRequestBody } from '@/utils/addTokens';

// Add CSS styles for wiki with Japanese aesthetic
const wikiStyles = `
  /* Global Prose Overrides for Vercel/Linear Aesthetic */
  
  .prose {
    max-width: none;
    color: var(--foreground);
    line-height: 1.75;
  }

  /* Headings */
  .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
    color: var(--foreground);
    font-weight: 600;
    margin-top: 2em;
    margin-bottom: 1em;
    line-height: 1.25;
  }
  
  .prose h1 { font-size: 2.25rem; letter-spacing: -0.025em; }
  .prose h2 { font-size: 1.5rem; letter-spacing: -0.025em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
  .prose h3 { font-size: 1.25rem; }

  /* Links */
  .prose a {
    color: var(--primary);
    text-decoration: none;
    font-weight: 500;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
  }
  
  .prose a:hover {
    border-bottom-color: var(--primary);
  }

  /* Inline Code */
  .prose :not(pre) > code {
    background-color: var(--muted);
    color: var(--foreground);
    padding: 0.2em 0.4em;
    border-radius: 0.25rem;
    font-size: 0.875em;
    font-family: var(--font-mono);
    font-weight: 500;
    border: 1px solid var(--border);
  }
  
  /* Code Blocks (VS Code Style - Dark in both modes) */
  .prose pre {
    background-color: #1e1e1e !important;
    color: #e4e4e7 !important; /* Zinc-200 */
    border-radius: 0.5rem;
    padding: 1.25rem;
    overflow-x: auto;
    border: 1px solid var(--border);
    margin: 1.5em 0;
  }
  
  .prose pre code {
    background-color: transparent !important;
    color: inherit !important;
    padding: 0;
    border: none;
    font-size: 0.875em;
    font-family: var(--font-mono);
  }

  /* Blockquotes */
  .prose blockquote {
    border-left: 4px solid var(--primary);
    padding-left: 1rem;
    font-style: italic;
    color: var(--muted-foreground);
    background: var(--muted);
    padding: 1rem;
    border-radius: 0 0.5rem 0.5rem 0;
  }

  /* Tables */
  .prose table {
    width: 100%;
    border-collapse: collapse;
    margin: 2em 0;
    font-size: 0.875em;
  }
  
  .prose th {
    text-align: left;
    padding: 0.75rem;
    border-bottom: 1px solid var(--border);
    background-color: var(--muted);
    font-weight: 600;
  }
  
  .prose td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  /* Lists */
  .prose ul > li::marker { color: var(--muted-foreground); }
  .prose ol > li::marker { color: var(--muted-foreground); }
  
  /* Images */
  .prose img {
    border-radius: 0.5rem;
    border: 1px solid var(--border);
  }
  
  /* Details/Summary */
  .prose details {
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.5rem;
    background-color: var(--card);
  }
  
  .prose summary {
    cursor: pointer;
    font-weight: 500;
    padding: 0.5rem;
  }

  /* Reading Mode Styles */
  .reading-mode .prose {
    font-size: 1.125rem;
    line-height: 1.9;
  }

  .reading-mode .prose p {
    margin-bottom: 1.5em;
  }

  .reading-mode .prose h1,
  .reading-mode .prose h2,
  .reading-mode .prose h3,
  .reading-mode .prose h4,
  .reading-mode .prose h5,
  .reading-mode .prose h6 {
    margin-top: 2.5em;
  }
`;

// Helper function to generate cache key for localStorage
const getCacheKey = (owner: string, repo: string, repoType: string, language: string, isComprehensive: boolean = true): string => {
  return `deepwiki_cache_${repoType}_${owner}_${repo}_${language}_${isComprehensive ? 'comprehensive' : 'concise'}`;
};
// ... (rest of imports/helpers remain same until component return)

// ...




const createGithubHeaders = (githubToken: string): HeadersInit => {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json'
  };

  if (githubToken) {
    headers['Authorization'] = `Bearer ${githubToken}`;
  }

  return headers;
};

const createGitlabHeaders = (gitlabToken: string): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (gitlabToken) {
    headers['PRIVATE-TOKEN'] = gitlabToken;
  }

  return headers;
};

const createBitbucketHeaders = (bitbucketToken: string): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (bitbucketToken) {
    headers['Authorization'] = `Bearer ${bitbucketToken}`;
  }

  return headers;
};


export default function RepoWikiPage() {
  // Get route parameters and search params
  const params = useParams();
  const searchParams = useSearchParams();

  // Extract owner and repo from route params
  const owner = params.owner as string;
  const repo = params.repo as string;

  // Read token from sessionStorage (secure) with URL param fallback (legacy)
  const token = (() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('bcw_access_token');
      if (stored) return stored;
    }
    return searchParams.get('token') || '';
  })();
  const localPath = searchParams.get('local_path') ? decodeURIComponent(searchParams.get('local_path') || '') : undefined;
  const repoUrl = searchParams.get('repo_url') ? decodeURIComponent(searchParams.get('repo_url') || '') : undefined;
  const providerParam = searchParams.get('provider') || '';
  const modelParam = searchParams.get('model') || '';
  const isCustomModelParam = searchParams.get('is_custom_model') === 'true';
  const customModelParam = searchParams.get('custom_model') || '';
  const language = searchParams.get('language') || 'en';
  const repoHost = (() => {
    if (!repoUrl) return '';
    try {
      return new URL(repoUrl).hostname.toLowerCase();
    } catch (e) {
      console.warn(`Invalid repoUrl provided: ${repoUrl}`);
      return '';
    }
  })();
  const repoType = repoHost?.includes('bitbucket')
    ? 'bitbucket'
    : repoHost?.includes('gitlab')
      ? 'gitlab'
      : repoHost?.includes('github')
        ? 'github'
        : searchParams.get('type') || 'github';

  // Import language context for translations
  const { messages } = useLanguage();

  // Initialize repo info
  const repoInfo = useMemo<RepoInfo>(() => ({
    owner,
    repo,
    type: repoType,
    token: token || null,
    localPath: localPath || null,
    repoUrl: repoUrl || null
  }), [owner, repo, repoType, localPath, repoUrl, token]);

  // State variables
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>(
    messages.loading?.initializing || 'Initializing wiki generation...'
  );
  const [error, setError] = useState<string | null>(null);
  const [wikiStructure, setWikiStructure] = useState<WikiStructure | undefined>();
  const [currentPageId, setCurrentPageId] = useState<string | undefined>();
  const [generatedPages, setGeneratedPages] = useState<Record<string, WikiPage>>({});
  const [pagesInProgress, setPagesInProgress] = useState(new Set<string>());
  const [generationPhase, setGenerationPhase] = useState<'idle' | 'fetching' | 'planning' | 'generating' | 'done'>('idle');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [originalMarkdown, setOriginalMarkdown] = useState<Record<string, string>>({});
  const [requestInProgress, setRequestInProgress] = useState(false);
  const [currentToken, setCurrentToken] = useState(token); // Track current effective token
  const [effectiveRepoInfo, setEffectiveRepoInfo] = useState(repoInfo); // Track effective repo info with cached data
  const [embeddingError, setEmbeddingError] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  // Model selection state variables
  const [selectedProviderState, setSelectedProviderState] = useState(providerParam);
  const [selectedModelState, setSelectedModelState] = useState(modelParam);
  const [isCustomSelectedModelState, setIsCustomSelectedModelState] = useState(isCustomModelParam);
  const [customSelectedModelState, setCustomSelectedModelState] = useState(customModelParam);
  const [showModelOptions, setShowModelOptions] = useState(false); // Controls whether to show model options
  const excludedDirs = searchParams.get('excluded_dirs') || '';
  const excludedFiles = searchParams.get('excluded_files') || '';
  const [modelExcludedDirs, setModelExcludedDirs] = useState(excludedDirs);
  const [modelExcludedFiles, setModelExcludedFiles] = useState(excludedFiles);
  const includedDirs = searchParams.get('included_dirs') || '';
  const includedFiles = searchParams.get('included_files') || '';
  const [modelIncludedDirs, setModelIncludedDirs] = useState(includedDirs);
  const [modelIncludedFiles, setModelIncludedFiles] = useState(includedFiles);


  // Wiki type state - default to comprehensive view
  const isComprehensiveParam = searchParams.get('comprehensive') !== 'false';
  const [isComprehensiveView, setIsComprehensiveView] = useState(isComprehensiveParam);
  // Using useRef for activeContentRequests to maintain a single instance across renders
  // This map tracks which pages are currently being processed to prevent duplicate requests
  // Note: In a multi-threaded environment, additional synchronization would be needed,
  // but in React's single-threaded model, this is safe as long as we set the flag before any async operations
  const activeContentRequests = useRef(new Map<string, boolean>()).current;
  const [structureRequestInProgress, setStructureRequestInProgress] = useState(false);
  // Create a flag to track if data was loaded from cache to prevent immediate re-save
  const cacheLoadedSuccessfully = useRef(false);

  // Create a flag to ensure the effect only runs once
  const effectRan = React.useRef(false);

  // Reading mode state
  const [isReadingMode, setIsReadingMode] = useState(false);

  // State for Ask modal
  const [isAskModalOpen, setIsAskModalOpen] = useState(false);
  const askComponentRef = useRef<{ clearConversation: () => void } | null>(null);

  // State for Search Command palette
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // State for Dependency Graph
  const [showGraph, setShowGraph] = useState(false);
  const wikiContentRef = useRef<HTMLDivElement | null>(null);

  // State for Diagram Detail Panel (Click-to-Explain)
  const [isDiagramPanelOpen, setIsDiagramPanelOpen] = useState(false);
  const [selectedDiagramNode, setSelectedDiagramNode] = useState<{
    nodeId: string;
    label: string;
    diagramData: import('@/types/diagramData').DiagramData | null;
  } | null>(null);

  // Authentication state
  const [authRequired, setAuthRequired] = useState<boolean>(false);
  const [authCode, setAuthCode] = useState<string>('');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Default branch state
  const [defaultBranch, setDefaultBranch] = useState<string>('main');

  // Helper function to generate proper repository file URLs
  const generateFileUrl = useCallback((filePath: string): string => {
    if (effectiveRepoInfo.type === 'local') {
      // For local repositories, we can't generate web URLs
      return filePath;
    }

    const repoUrl = effectiveRepoInfo.repoUrl;
    if (!repoUrl) {
      return filePath;
    }

    try {
      const url = new URL(repoUrl);
      const hostname = url.hostname;

      if (hostname === 'github.com' || hostname.includes('github')) {
        // GitHub URL format: https://github.com/owner/repo/blob/branch/path
        return `${repoUrl}/blob/${defaultBranch}/${filePath}`;
      } else if (hostname === 'gitlab.com' || hostname.includes('gitlab')) {
        // GitLab URL format: https://gitlab.com/owner/repo/-/blob/branch/path
        return `${repoUrl}/-/blob/${defaultBranch}/${filePath}`;
      } else if (hostname === 'bitbucket.org' || hostname.includes('bitbucket')) {
        // Bitbucket URL format: https://bitbucket.org/owner/repo/src/branch/path
        return `${repoUrl}/src/${defaultBranch}/${filePath}`;
      }
    } catch (error) {
      console.warn('Error generating file URL:', error);
    }

    // Fallback to just the file path
    return filePath;
  }, [effectiveRepoInfo, defaultBranch]);

  // Memoize repo info to avoid triggering updates in callbacks

  // Add useEffect to handle scroll reset
  useEffect(() => {
    // Scroll to top when currentPageId changes
    const wikiContent = document.getElementById('wiki-content');
    if (wikiContent) {
      wikiContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPageId]);

  // close the modal when escape is pressed
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAskModalOpen(false);
      }
    };

    if (isAskModalOpen) {
      window.addEventListener('keydown', handleEsc);
    }

    // Cleanup on unmount or when modal closes
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isAskModalOpen]);

  // Cmd+K / Ctrl+K to open search command palette
  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  // Alt+R to toggle reading mode, Escape to exit reading mode
  useEffect(() => {
    const handleReadingModeShortcut = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        setIsReadingMode((prev) => !prev);
      }
      if (e.key === 'Escape' && isReadingMode) {
        setIsReadingMode(false);
      }
    };
    window.addEventListener('keydown', handleReadingModeShortcut);
    return () => window.removeEventListener('keydown', handleReadingModeShortcut);
  }, [isReadingMode]);

  // Fetch authentication status on component mount
  useEffect(() => {
    const fetchAuthStatus = async () => {
      try {
        setIsAuthLoading(true);
        const response = await fetch('/api/auth/status');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAuthRequired(data.auth_required);
      } catch (err) {
        console.error("Failed to fetch auth status:", err);
        // Assuming auth is required if fetch fails to avoid blocking UI for safety
        setAuthRequired(true);
      } finally {
        setIsAuthLoading(false);
      }
    };

    fetchAuthStatus();
  }, []);

  // Generate content for a wiki page
  const generatePageContent = useCallback(async (page: WikiPage, owner: string, repo: string) => {
    return new Promise<void>(async (resolve) => {
      try {
        // Skip if content already exists
        if (generatedPages[page.id]?.content) {
          resolve();
          return;
        }

        // Skip if this page is already being processed
        // Use a synchronized pattern to avoid race conditions
        if (activeContentRequests.get(page.id)) {
          console.log(`Page ${page.id} (${page.title}) is already being processed, skipping duplicate call`);
          resolve();
          return;
        }

        // Mark this page as being processed immediately to prevent race conditions
        // This ensures that if multiple calls happen nearly simultaneously, only one proceeds
        activeContentRequests.set(page.id, true);

        // Validate repo info
        if (!owner || !repo) {
          throw new Error('Invalid repository information. Owner and repo name are required.');
        }

        // Mark page as in progress
        setPagesInProgress(prev => new Set(prev).add(page.id));
        // Don't set loading message for individual pages during queue processing

        const filePaths = page.filePaths;

        // Store the initially generated content BEFORE rendering/potential modification
        setGeneratedPages(prev => ({
          ...prev,
          [page.id]: { ...page, content: 'Loading...' } // Placeholder
        }));
        setOriginalMarkdown(prev => ({ ...prev, [page.id]: '' })); // Clear previous original

        // Make API call to generate page content
        console.log(`Starting content generation for page: ${page.title}`);

        // Get repository URL
        const repoUrl = getRepoUrl(effectiveRepoInfo);

        // Create the prompt content - simplified to avoid message dialogs
        const promptContent =
          `You are an expert technical writer and software architect.
Your task is to generate a comprehensive and accurate technical wiki page in Markdown format about a specific feature, system, or module within a given software project.

You will be given:
1. The "[WIKI_PAGE_TOPIC]" for the page you need to create.
2. A list of "[RELEVANT_SOURCE_FILES]" from the project that you MUST use as the sole basis for the content. You have access to the full content of these files. You MUST use AT LEAST 5 relevant source files for comprehensive coverage - if fewer are provided, search for additional related files in the codebase.

CRITICAL STARTING INSTRUCTION:
The very first thing on the page MUST be a \`<details>\` block listing ALL the \`[RELEVANT_SOURCE_FILES]\` you used to generate the content. There MUST be AT LEAST 5 source files listed - if fewer were provided, you MUST find additional related files to include.
Format it exactly like this:
<details>
<summary>Relevant source files</summary>

Remember, do not provide any acknowledgements, disclaimers, apologies, or any other preface before the \`<details>\` block. JUST START with the \`<details>\` block.
The following files were used as context for generating this wiki page:

${filePaths.map(path => `- [${path}](${generateFileUrl(path)})`).join('\n')}
<!-- Add additional relevant files if fewer than 5 were provided -->
</details>

Immediately after the \`<details>\` block, the main title of the page should be a H1 Markdown heading: \`# ${page.title}\`.

Based ONLY on the content of the \`[RELEVANT_SOURCE_FILES]\`:

1.  **Introduction:** Start with a concise introduction (1-2 paragraphs) explaining the purpose, scope, and high-level overview of "${page.title}" within the context of the overall project. If relevant, and if information is available in the provided files, link to other potential wiki pages using the format \`[Link Text](#page-anchor-or-id)\`.

2.  **Detailed Sections:** Break down "${page.title}" into logical sections using H2 (\`##\`) and H3 (\`###\`) Markdown headings. For each section:
    *   Explain the architecture, components, data flow, or logic relevant to the section's focus, as evidenced in the source files.
    *   Identify key functions, classes, data structures, API endpoints, or configuration elements pertinent to that section.

3.  **Mermaid Diagrams:**
    *   EXTENSIVELY use Mermaid diagrams (e.g., \`flowchart TD\`, \`sequenceDiagram\`, \`classDiagram\`, \`erDiagram\`, \`graph TD\`) to visually represent architectures, flows, relationships, and schemas found in the source files.
    *   Ensure diagrams are accurate and directly derived from information in the \`[RELEVANT_SOURCE_FILES]\`.
    *   Provide a brief explanation before or after each diagram to give context.
    *   CRITICAL: All diagrams MUST follow strict vertical orientation:
       - Use "graph TD" (top-down) directive for flow diagrams
       - NEVER use "graph LR" (left-right)
       - Maximum node width should be 3-4 words
       - For sequence diagrams:
         - Start with "sequenceDiagram" directive on its own line
         - Define ALL participants at the beginning using "participant" keyword
         - Optionally specify participant types: actor, boundary, control, entity, database, collections, queue
         - Use descriptive but concise participant names, or use aliases: "participant A as Alice"
         - Use the correct Mermaid arrow syntax (8 types available):
           - -> solid line without arrow (rarely used)
           - --> dotted line without arrow (rarely used)
           - ->> solid line with arrowhead (most common for requests/calls)
           - -->> dotted line with arrowhead (most common for responses/returns)
           - ->x solid line with X at end (failed/error message)
           - -->x dotted line with X at end (failed/error response)
           - -) solid line with open arrow (async message, fire-and-forget)
           - --) dotted line with open arrow (async response)
           - Examples: A->>B: Request, B-->>A: Response, A->xB: Error, A-)B: Async event
         - Use +/- suffix for activation boxes: A->>+B: Start (activates B), B-->>-A: End (deactivates B)
         - Group related participants using "box": box GroupName ... end
         - Use structural elements for complex flows:
           - loop LoopText ... end (for iterations)
           - alt ConditionText ... else ... end (for conditionals)
           - opt OptionalText ... end (for optional flows)
           - par ParallelText ... and ... end (for parallel actions)
           - critical CriticalText ... option ... end (for critical regions)
           - break BreakText ... end (for breaking flows/exceptions)
         - Add notes for clarification: "Note over A,B: Description", "Note right of A: Detail"
         - Use autonumber directive to add sequence numbers to messages
         - NEVER use flowchart-style labels like A--|label|-->B. Always use a colon for labels: A->>B: My Label

    *   **Structured Diagram Data:** When you generate a Mermaid diagram, you MUST ALSO produce a structured JSON block IMMEDIATELY BEFORE the corresponding Mermaid code fence. Wrap the JSON in HTML comment markers exactly like this:
        \`\`\`
        <!-- DIAGRAM_DATA_START -->
        {
          "nodes": [
            {"id": "A", "label": "Frontend App", "technology": "React", "files": ["src/App.tsx"], "description": "Main SPA entry point", "depth": 0},
            {"id": "B", "label": "API Server", "technology": "Express", "files": ["server/index.js"], "description": "REST API backend", "depth": 0}
          ],
          "edges": [
            {"source": "A", "target": "B", "label": "HTTP requests", "type": "api_call"}
          ],
          "mermaidSource": "graph TD\\n    A[Frontend App] --> B[API Server]",
          "diagramType": "flowchart"
        }
        <!-- DIAGRAM_DATA_END -->
        \`\`\`
        Rules: "nodes[].id" must match the Mermaid node IDs. "edges[].type" must be "dependency", "data_flow", or "api_call". "diagramType" must be "flowchart", "sequence", "class", or "er". "mermaidSource" must contain the exact Mermaid source. If a diagram has no meaningful structured metadata, you may omit the JSON block.

4.  **Tables:**
    *   Use Markdown tables to summarize information such as:
        *   Key features or components and their descriptions.
        *   API endpoint parameters, types, and descriptions.
        *   Configuration options, their types, and default values.
        *   Data model fields, types, constraints, and descriptions.

5.  **Code Snippets (ENTIRELY OPTIONAL):**
    *   Include short, relevant code snippets (e.g., Python, Java, JavaScript, SQL, JSON, YAML) directly from the \`[RELEVANT_SOURCE_FILES]\` to illustrate key implementation details, data structures, or configurations.
    *   Ensure snippets are well-formatted within Markdown code blocks with appropriate language identifiers.

6.  **Source Citations (EXTREMELY IMPORTANT):**
    *   For EVERY piece of significant information, explanation, diagram, table entry, or code snippet, you MUST cite the specific source file(s) and relevant line numbers from which the information was derived.
    *   Place citations at the end of the paragraph, under the diagram/table, or after the code snippet.
    *   Use the exact format: \`Sources: [filename.ext:start_line-end_line]()\` for a range, or \`Sources: [filename.ext:line_number]()\` for a single line. Multiple files can be cited: \`Sources: [file1.ext:1-10](), [file2.ext:5](), [dir/file3.ext]()\` (if the whole file is relevant and line numbers are not applicable or too broad).
    *   If an entire section is overwhelmingly based on one or two files, you can cite them under the section heading in addition to more specific citations within the section.
    *   IMPORTANT: You MUST cite AT LEAST 5 different source files throughout the wiki page to ensure comprehensive coverage.

7.  **Technical Accuracy:** All information must be derived SOLELY from the \`[RELEVANT_SOURCE_FILES]\`. Do not infer, invent, or use external knowledge about similar systems or common practices unless it's directly supported by the provided code. If information is not present in the provided files, do not include it or explicitly state its absence if crucial to the topic.

8.  **Clarity and Conciseness:** Use clear, professional, and concise technical language suitable for other developers working on or learning about the project. Avoid unnecessary jargon, but use correct technical terms where appropriate.

9.  **Conclusion/Summary:** End with a brief summary paragraph if appropriate for "${page.title}", reiterating the key aspects covered and their significance within the project.

IMPORTANT: Generate the content in ${language === 'en' ? 'English' :
            language === 'ja' ? 'Japanese (日本語)' :
              language === 'zh' ? 'Mandarin Chinese (中文)' :
                language === 'zh-tw' ? 'Traditional Chinese (繁體中文)' :
                  language === 'es' ? 'Spanish (Español)' :
                    language === 'kr' ? 'Korean (한국어)' :
                      language === 'vi' ? 'Vietnamese (Tiếng Việt)' :
                        language === "pt-br" ? "Brazilian Portuguese (Português Brasileiro)" :
                          language === "fr" ? "Français (French)" :
                            language === "ru" ? "Русский (Russian)" :
                              'English'} language.

Remember:
- Ground every claim in the provided source files.
- Prioritize accuracy and direct representation of the code's functionality and structure.
- Structure the document logically for easy understanding by other developers.
`;

        // Prepare request body
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestBody: Record<string, any> = {
          repo_url: repoUrl,
          type: effectiveRepoInfo.type,
          messages: [{
            role: 'user',
            content: promptContent
          }]
        };

        // Add tokens if available
        addTokensToRequestBody(requestBody, currentToken, effectiveRepoInfo.type, selectedProviderState, selectedModelState, isCustomSelectedModelState, customSelectedModelState, language, modelExcludedDirs, modelExcludedFiles, modelIncludedDirs, modelIncludedFiles);

        // Use WebSocket for communication
        let content = '';

        try {
          // Create WebSocket URL from the server base URL
          const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:8001';
          const wsBaseUrl = serverBaseUrl.replace(/^http/, 'ws') ? serverBaseUrl.replace(/^https/, 'wss') : serverBaseUrl.replace(/^http/, 'ws');
          const wsUrl = `${wsBaseUrl}/ws/chat`;

          // Create a new WebSocket connection
          const ws = new WebSocket(wsUrl);

          // Create a promise that resolves when the WebSocket connection is complete
          await new Promise<void>((resolve, reject) => {
            // Set up event handlers
            ws.onopen = () => {
              console.log(`WebSocket connection established for page: ${page.title}`);
              // Send the request as JSON
              ws.send(JSON.stringify(requestBody));
              resolve();
            };

            ws.onerror = (error) => {
              console.error('WebSocket error:', error);
              reject(new Error('WebSocket connection failed'));
            };

            // If the connection doesn't open within 5 seconds, fall back to HTTP
            const timeout = setTimeout(() => {
              reject(new Error('WebSocket connection timeout'));
            }, 5000);

            // Clear the timeout if the connection opens successfully
            ws.onopen = () => {
              clearTimeout(timeout);
              console.log(`WebSocket connection established for page: ${page.title}`);
              // Send the request as JSON
              ws.send(JSON.stringify(requestBody));
              resolve();
            };
          });

          // Create a promise that resolves when the WebSocket response is complete
          await new Promise<void>((resolve, reject) => {
            // Handle incoming messages
            ws.onmessage = (event) => {
              content += event.data;
            };

            // Handle WebSocket close
            ws.onclose = () => {
              console.log(`WebSocket connection closed for page: ${page.title}`);
              resolve();
            };

            // Handle WebSocket errors
            ws.onerror = (error) => {
              console.error('WebSocket error during message reception:', error);
              reject(new Error('WebSocket error during message reception'));
            };
          });
        } catch (wsError) {
          console.error('WebSocket error, falling back to HTTP:', wsError);

          // Fall back to HTTP if WebSocket fails
          const response = await fetch(`/api/chat/stream`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'No error details available');
            console.error(`API error (${response.status}): ${errorText}`);
            throw new Error(`Error generating page content: ${response.status} - ${response.statusText}`);
          }

          // Process the response
          content = '';
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (!reader) {
            throw new Error('Failed to get response reader');
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              content += decoder.decode(value, { stream: true });
            }
            // Ensure final decoding
            content += decoder.decode();
          } catch (readError) {
            console.error('Error reading stream:', readError);
            throw new Error('Error processing response stream');
          }
        }

        // Clean up markdown delimiters
        content = content.replace(/^```markdown\s*/i, '').replace(/```\s*$/i, '');

        console.log(`Received content for ${page.title}, length: ${content.length} characters`);

        // Store the FINAL generated content
        const updatedPage = { ...page, content };
        setGeneratedPages(prev => ({ ...prev, [page.id]: updatedPage }));
        // Store this as the original for potential mermaid retries
        setOriginalMarkdown(prev => ({ ...prev, [page.id]: content }));

        resolve();
      } catch (err) {
        console.error(`Error generating content for page ${page.id}:`, err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        // Update page state to show error
        setGeneratedPages(prev => ({
          ...prev,
          [page.id]: { ...page, content: `Error generating content: ${errorMessage}` }
        }));
        setError(`Failed to generate content for ${page.title}.`);
        resolve(); // Resolve even on error to unblock queue
      } finally {
        // Clear the processing flag for this page
        // This must happen in the finally block to ensure the flag is cleared
        // even if an error occurs during processing
        activeContentRequests.delete(page.id);

        // Mark page as done
        setPagesInProgress(prev => {
          const next = new Set(prev);
          next.delete(page.id);
          return next;
        });
        setLoadingMessage(undefined); // Clear specific loading message
      }
    });
  }, [generatedPages, currentToken, effectiveRepoInfo, selectedProviderState, selectedModelState, isCustomSelectedModelState, customSelectedModelState, modelExcludedDirs, modelExcludedFiles, language, activeContentRequests, generateFileUrl]);

  // Determine the wiki structure from repository data
  const determineWikiStructure = useCallback(async (fileTree: string, readme: string, owner: string, repo: string) => {
    if (!owner || !repo) {
      setError('Invalid repository information. Owner and repo name are required.');
      setIsLoading(false);
      setEmbeddingError(false); // Reset embedding error state
      return;
    }

    // Skip if structure request is already in progress
    if (structureRequestInProgress) {
      console.log('Wiki structure determination already in progress, skipping duplicate call');
      return;
    }

    try {
      setStructureRequestInProgress(true);
      setGenerationPhase('planning');
      setLoadingMessage(messages.loading?.determiningStructure || 'Determining wiki structure...');

      // Get repository URL
      const repoUrl = getRepoUrl(effectiveRepoInfo);

      // Prepare request body
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestBody: Record<string, any> = {
        repo_url: repoUrl,
        type: effectiveRepoInfo.type,
        messages: [{
          role: 'user',
          content: `Analyze this GitHub repository ${owner}/${repo} and create a wiki structure for it.

1. The complete file tree of the project:
<file_tree>
${fileTree}
</file_tree>

2. The README file of the project:
<readme>
${readme}
</readme>

I want to create a wiki for this repository. Determine the most logical structure for a wiki based on the repository's content.

IMPORTANT: The wiki content will be generated in ${language === 'en' ? 'English' :
              language === 'ja' ? 'Japanese (日本語)' :
                language === 'zh' ? 'Mandarin Chinese (中文)' :
                  language === 'zh-tw' ? 'Traditional Chinese (繁體中文)' :
                    language === 'es' ? 'Spanish (Español)' :
                      language === 'kr' ? 'Korean (한国語)' :
                        language === 'vi' ? 'Vietnamese (Tiếng Việt)' :
                          language === "pt-br" ? "Brazilian Portuguese (Português Brasileiro)" :
                            language === "fr" ? "Français (French)" :
                              language === "ru" ? "Русский (Russian)" :
                                'English'} language.

When designing the wiki structure, include pages that would benefit from visual diagrams, such as:
- Architecture overviews
- Data flow descriptions
- Component relationships
- Process workflows
- State machines
- Class hierarchies

${isComprehensiveView ? `
Create a structured wiki with the following main sections:
- Overview (general information about the project)
- System Architecture (how the system is designed)
- Core Features (key functionality)
- Data Management/Flow: If applicable, how data is stored, processed, accessed, and managed (e.g., database schema, data pipelines, state management).
- Frontend Components (UI elements, if applicable.)
- Backend Systems (server-side components)
- Model Integration (AI model connections)
- Deployment/Infrastructure (how to deploy, what's the infrastructure like)
- Extensibility and Customization: If the project architecture supports it, explain how to extend or customize its functionality (e.g., plugins, theming, custom modules, hooks).

Each section should contain relevant pages. For example, the "Frontend Components" section might include pages for "Home Page", "Repository Wiki Page", "Ask Component", etc.

Return your analysis in the following XML format:

<wiki_structure>
  <title>[Overall title for the wiki]</title>
  <description>[Brief description of the repository]</description>
  <sections>
    <section id="section-1">
      <title>[Section title]</title>
      <pages>
        <page_ref>page-1</page_ref>
        <page_ref>page-2</page_ref>
      </pages>
      <subsections>
        <section_ref>section-2</section_ref>
      </subsections>
    </section>
    <!-- More sections as needed -->
  </sections>
  <pages>
    <page id="page-1">
      <title>[Page title]</title>
      <description>[Brief description of what this page will cover]</description>
      <importance>high|medium|low</importance>
      <relevant_files>
        <file_path>[Path to a relevant file]</file_path>
        <!-- More file paths as needed -->
      </relevant_files>
      <related_pages>
        <related>page-2</related>
        <!-- More related page IDs as needed -->
      </related_pages>
      <parent_section>section-1</parent_section>
    </page>
    <!-- More pages as needed -->
  </pages>
</wiki_structure>
` : `
Return your analysis in the following XML format:

<wiki_structure>
  <title>[Overall title for the wiki]</title>
  <description>[Brief description of the repository]</description>
  <pages>
    <page id="page-1">
      <title>[Page title]</title>
      <description>[Brief description of what this page will cover]</description>
      <importance>high|medium|low</importance>
      <relevant_files>
        <file_path>[Path to a relevant file]</file_path>
        <!-- More file paths as needed -->
      </relevant_files>
      <related_pages>
        <related>page-2</related>
        <!-- More related page IDs as needed -->
      </related_pages>
    </page>
    <!-- More pages as needed -->
  </pages>
</wiki_structure>
`}

IMPORTANT FORMATTING INSTRUCTIONS:
- Return ONLY the valid XML structure specified above
- DO NOT wrap the XML in markdown code blocks (no \`\`\` or \`\`\`xml)
- DO NOT include any explanation text before or after the XML
- Ensure the XML is properly formatted and valid
- Start directly with <wiki_structure> and end with </wiki_structure>

IMPORTANT:
1. Create ${isComprehensiveView ? '8-12' : '4-6'} pages that would make a ${isComprehensiveView ? 'comprehensive' : 'concise'} wiki for this repository
2. Each page should focus on a specific aspect of the codebase (e.g., architecture, key features, setup)
3. The relevant_files should be actual files from the repository that would be used to generate that page
4. Return ONLY valid XML with the structure specified above, with no markdown code block delimiters`
        }]
      };

      // Add tokens if available
      addTokensToRequestBody(requestBody, currentToken, effectiveRepoInfo.type, selectedProviderState, selectedModelState, isCustomSelectedModelState, customSelectedModelState, language, modelExcludedDirs, modelExcludedFiles, modelIncludedDirs, modelIncludedFiles);

      // Use WebSocket for communication
      let responseText = '';

      try {
        // Create WebSocket URL from the server base URL
        const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:8001';
        const wsBaseUrl = serverBaseUrl.replace(/^http/, 'ws') ? serverBaseUrl.replace(/^https/, 'wss') : serverBaseUrl.replace(/^http/, 'ws');
        const wsUrl = `${wsBaseUrl}/ws/chat`;

        // Create a new WebSocket connection
        const ws = new WebSocket(wsUrl);

        // Create a promise that resolves when the WebSocket connection is complete
        await new Promise<void>((resolve, reject) => {
          // Set up event handlers
          ws.onopen = () => {
            console.log('WebSocket connection established for wiki structure');
            // Send the request as JSON
            ws.send(JSON.stringify(requestBody));
            resolve();
          };

          ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            reject(new Error('WebSocket connection failed'));
          };

          // If the connection doesn't open within 5 seconds, fall back to HTTP
          const timeout = setTimeout(() => {
            reject(new Error('WebSocket connection timeout'));
          }, 5000);

          // Clear the timeout if the connection opens successfully
          ws.onopen = () => {
            clearTimeout(timeout);
            console.log('WebSocket connection established for wiki structure');
            // Send the request as JSON
            ws.send(JSON.stringify(requestBody));
            resolve();
          };
        });

        // Create a promise that resolves when the WebSocket response is complete
        await new Promise<void>((resolve, reject) => {
          // Handle incoming messages
          ws.onmessage = (event) => {
            responseText += event.data;
          };

          // Handle WebSocket close
          ws.onclose = () => {
            console.log('WebSocket connection closed for wiki structure');
            resolve();
          };

          // Handle WebSocket errors
          ws.onerror = (error) => {
            console.error('WebSocket error during message reception:', error);
            reject(new Error('WebSocket error during message reception'));
          };
        });
      } catch (wsError) {
        console.error('WebSocket error, falling back to HTTP:', wsError);

        // Fall back to HTTP if WebSocket fails
        const response = await fetch(`/api/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`Error determining wiki structure: ${response.status}`);
        }

        // Process the response
        responseText = '';
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Failed to get response reader');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          responseText += decoder.decode(value, { stream: true });
        }
      }

      if (responseText.includes('Error preparing retriever: Environment variable OPENAI_API_KEY must be set')) {
        setEmbeddingError(true);
        throw new Error('OPENAI_API_KEY environment variable is not set. Please configure your OpenAI API key.');
      }

      if (responseText.includes('Ollama model') && responseText.includes('not found')) {
        setEmbeddingError(true);
        throw new Error('The specified Ollama embedding model was not found. Please ensure the model is installed locally or select a different embedding model in the configuration.');
      }

      // Clean up markdown delimiters
      responseText = responseText.replace(/^```(?:xml)?\s*/i, '').replace(/```\s*$/i, '');

      // Extract wiki structure from response
      const xmlMatch = responseText.match(/<wiki_structure>[\s\S]*?<\/wiki_structure>/m);
      if (!xmlMatch) {
        throw new Error('No valid XML found in response');
      }

      let xmlText = xmlMatch[0];
      xmlText = xmlText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      // Try parsing with DOMParser
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        // Log the first few elements to see what was parsed
        const elements = xmlDoc.querySelectorAll('*');
        if (elements.length > 0) {
          console.log('First 5 element names:',
            Array.from(elements).slice(0, 5).map(el => el.nodeName).join(', '));
        }

        // We'll continue anyway since the XML might still be usable
      }

      // Extract wiki structure
      let title = '';
      let description = '';
      let pages: WikiPage[] = [];

      // Try using DOM parsing first
      const titleEl = xmlDoc.querySelector('title');
      const descriptionEl = xmlDoc.querySelector('description');
      const pagesEls = xmlDoc.querySelectorAll('page');

      title = titleEl ? titleEl.textContent || '' : '';
      description = descriptionEl ? descriptionEl.textContent || '' : '';

      // Parse pages using DOM
      pages = [];

      if (parseError && (!pagesEls || pagesEls.length === 0)) {
        console.warn('DOM parsing failed, trying regex fallback');
      }

      pagesEls.forEach(pageEl => {
        const id = pageEl.getAttribute('id') || `page-${pages.length + 1}`;
        const titleEl = pageEl.querySelector('title');
        const importanceEl = pageEl.querySelector('importance');
        const filePathEls = pageEl.querySelectorAll('file_path');
        const relatedEls = pageEl.querySelectorAll('related');

        const title = titleEl ? titleEl.textContent || '' : '';
        const importance = importanceEl ?
          (importanceEl.textContent === 'high' ? 'high' :
            importanceEl.textContent === 'medium' ? 'medium' : 'low') : 'medium';

        const filePaths: string[] = [];
        filePathEls.forEach(el => {
          if (el.textContent) filePaths.push(el.textContent);
        });

        const relatedPages: string[] = [];
        relatedEls.forEach(el => {
          if (el.textContent) relatedPages.push(el.textContent);
        });

        pages.push({
          id,
          title,
          content: '', // Will be generated later
          filePaths,
          importance,
          relatedPages
        });
      });

      // Extract sections if they exist in the XML
      const sections: WikiSection[] = [];
      const rootSections: string[] = [];

      // Try to parse sections if we're in comprehensive view
      if (isComprehensiveView) {
        const sectionsEls = xmlDoc.querySelectorAll('section');

        if (sectionsEls && sectionsEls.length > 0) {
          // Process sections
          sectionsEls.forEach(sectionEl => {
            const id = sectionEl.getAttribute('id') || `section-${sections.length + 1}`;
            const titleEl = sectionEl.querySelector('title');
            const pageRefEls = sectionEl.querySelectorAll('page_ref');
            const sectionRefEls = sectionEl.querySelectorAll('section_ref');

            const title = titleEl ? titleEl.textContent || '' : '';
            const pages: string[] = [];
            const subsections: string[] = [];

            pageRefEls.forEach(el => {
              if (el.textContent) pages.push(el.textContent);
            });

            sectionRefEls.forEach(el => {
              if (el.textContent) subsections.push(el.textContent);
            });

            sections.push({
              id,
              title,
              pages,
              subsections: subsections.length > 0 ? subsections : undefined
            });

            // Check if this is a root section (not referenced by any other section)
            let isReferenced = false;
            sectionsEls.forEach(otherSection => {
              const otherSectionRefs = otherSection.querySelectorAll('section_ref');
              otherSectionRefs.forEach(ref => {
                if (ref.textContent === id) {
                  isReferenced = true;
                }
              });
            });

            if (!isReferenced) {
              rootSections.push(id);
            }
          });
        }
      }

      // Create wiki structure
      const wikiStructure: WikiStructure = {
        id: 'wiki',
        title,
        description,
        pages,
        sections,
        rootSections
      };

      setWikiStructure(wikiStructure);
      setCurrentPageId(pages.length > 0 ? pages[0].id : undefined);

      // Start generating content for all pages with controlled concurrency
      if (pages.length > 0) {
        // Mark all pages as in progress
        const initialInProgress = new Set(pages.map(p => p.id));
        setPagesInProgress(initialInProgress);

        setGenerationPhase('generating');
        console.log(`Starting generation for ${pages.length} pages with controlled concurrency`);

        // Maximum concurrent requests
        const MAX_CONCURRENT = 3;

        // Create a queue of pages
        const queue = [...pages];
        let activeRequests = 0;

        // Function to process next items in queue
        const processQueue = () => {
          // Process as many items as we can up to our concurrency limit
          while (queue.length > 0 && activeRequests < MAX_CONCURRENT) {
            const page = queue.shift();
            if (page) {
              activeRequests++;
              console.log(`Starting page ${page.title} (${activeRequests} active, ${queue.length} remaining)`);

              // Start generating content for this page
              generatePageContent(page, owner, repo)
                .finally(() => {
                  // When done (success or error), decrement active count and process more
                  activeRequests--;
                  console.log(`Finished page ${page.title} (${activeRequests} active, ${queue.length} remaining)`);

                  // Check if all work is done (queue empty and no active requests)
                  if (queue.length === 0 && activeRequests === 0) {
                    console.log("All page generation tasks completed.");
                    setGenerationPhase('done');
                    setIsLoading(false);
                    setLoadingMessage(undefined);
                  } else {
                    // Only process more if there are items remaining and we're under capacity
                    if (queue.length > 0 && activeRequests < MAX_CONCURRENT) {
                      processQueue();
                    }
                  }
                });
            }
          }

          // Additional check: If the queue started empty or becomes empty and no requests were started/active
          if (queue.length === 0 && activeRequests === 0 && pages.length > 0 && pagesInProgress.size === 0) {
            // This handles the case where the queue might finish before the finally blocks fully update activeRequests
            // or if the initial queue was processed very quickly
            console.log("Queue empty and no active requests after loop, ensuring loading is false.");
            setIsLoading(false);
            setLoadingMessage(undefined);
          } else if (pages.length === 0) {
            // Handle case where there were no pages to begin with
            setIsLoading(false);
            setLoadingMessage(undefined);
          }
        };

        // Start processing the queue
        processQueue();
      } else {
        // Set loading to false if there were no pages found
        setIsLoading(false);
        setLoadingMessage(undefined);
      }

    } catch (error) {
      console.error('Error determining wiki structure:', error);
      setIsLoading(false);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      setLoadingMessage(undefined);
    } finally {
      setStructureRequestInProgress(false);
    }
  }, [generatePageContent, currentToken, effectiveRepoInfo, pagesInProgress.size, structureRequestInProgress, selectedProviderState, selectedModelState, isCustomSelectedModelState, customSelectedModelState, modelExcludedDirs, modelExcludedFiles, language, messages.loading, isComprehensiveView]);

  // Fetch repository structure using GitHub or GitLab API
  const fetchRepositoryStructure = useCallback(async () => {
    // If a request is already in progress, don't start another one
    if (requestInProgress) {
      console.log('Repository fetch already in progress, skipping duplicate call');
      return;
    }

    // Reset previous state
    setWikiStructure(undefined);
    setCurrentPageId(undefined);
    setGeneratedPages({});
    setPagesInProgress(new Set());
    setError(null);
    setEmbeddingError(false); // Reset embedding error state

    try {
      // Set the request in progress flag
      setRequestInProgress(true);

      // Update loading state
      setIsLoading(true);
      setGenerationPhase('fetching');
      setLoadingMessage(messages.loading?.fetchingStructure || 'Fetching repository structure...');

      let fileTreeData = '';
      let readmeContent = '';

      if (effectiveRepoInfo.type === 'local' && effectiveRepoInfo.localPath) {
        try {
          const response = await fetch(`/local_repo/structure?path=${encodeURIComponent(effectiveRepoInfo.localPath)}`);

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Local repository API error (${response.status}): ${errorData}`);
          }

          const data = await response.json();
          fileTreeData = data.file_tree;
          readmeContent = data.readme;
          // For local repos, we can't determine the actual branch, so use 'main' as default
          setDefaultBranch('main');
        } catch (err) {
          throw err;
        }
      } else if (effectiveRepoInfo.type === 'github') {
        // GitHub API approach
        // Try to get the tree data for common branch names
        let treeData = null;
        let apiErrorDetails = '';

        // Determine the GitHub API base URL based on the repository URL
        const getGithubApiUrl = (repoUrl: string | null): string => {
          if (!repoUrl) {
            return 'https://api.github.com'; // Default to public GitHub
          }

          try {
            const url = new URL(repoUrl);
            const hostname = url.hostname;

            // If it's the public GitHub, use the standard API URL
            if (hostname === 'github.com') {
              return 'https://api.github.com';
            }

            // For GitHub Enterprise, use the enterprise API URL format
            // GitHub Enterprise API URL format: https://github.company.com/api/v3
            return `${url.protocol}//${hostname}/api/v3`;
          } catch {
            return 'https://api.github.com'; // Fallback to public GitHub if URL parsing fails
          }
        };

        const githubApiBaseUrl = getGithubApiUrl(effectiveRepoInfo.repoUrl);
        // First, try to get the default branch from the repository info
        let defaultBranchLocal = null;
        try {
          const repoInfoResponse = await fetch(`${githubApiBaseUrl}/repos/${owner}/${repo}`, {
            headers: createGithubHeaders(currentToken)
          });

          if (repoInfoResponse.ok) {
            const repoData = await repoInfoResponse.json();
            defaultBranchLocal = repoData.default_branch;
            console.log(`Found default branch: ${defaultBranchLocal}`);
            // Store the default branch in state
            setDefaultBranch(defaultBranchLocal || 'main');
          }
        } catch (err) {
          console.warn('Could not fetch repository info for default branch:', err);
        }

        // Create list of branches to try, prioritizing the actual default branch
        const branchesToTry = defaultBranchLocal
          ? [defaultBranchLocal, 'main', 'master'].filter((branch, index, arr) => arr.indexOf(branch) === index)
          : ['main', 'master'];

        for (const branch of branchesToTry) {
          const apiUrl = `${githubApiBaseUrl}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
          const headers = createGithubHeaders(currentToken);

          console.log(`Fetching repository structure from branch: ${branch}`);
          try {
            const response = await fetch(apiUrl, {
              headers
            });

            if (response.ok) {
              treeData = await response.json();
              console.log('Successfully fetched repository structure');
              break;
            } else {
              const errorData = await response.text();
              apiErrorDetails = `Status: ${response.status}, Response: ${errorData}`;
              console.error(`Error fetching repository structure: ${apiErrorDetails}`);
            }
          } catch (err) {
            console.error(`Network error fetching branch ${branch}:`, err);
          }
        }

        if (!treeData || !treeData.tree) {
          if (apiErrorDetails) {
            throw new Error(`Could not fetch repository structure. API Error: ${apiErrorDetails}`);
          } else {
            throw new Error('Could not fetch repository structure. Repository might not exist, be empty or private.');
          }
        }

        // Convert tree data to a string representation
        fileTreeData = treeData.tree
          .filter((item: { type: string; path: string }) => item.type === 'blob')
          .map((item: { type: string; path: string }) => item.path)
          .join('\n');

        // Try to fetch README.md content
        try {
          const headers = createGithubHeaders(currentToken);

          const readmeResponse = await fetch(`${githubApiBaseUrl}/repos/${owner}/${repo}/readme`, {
            headers
          });

          if (readmeResponse.ok) {
            const readmeData = await readmeResponse.json();
            readmeContent = atob(readmeData.content);
          } else {
            console.warn(`Could not fetch README.md, status: ${readmeResponse.status}`);
          }
        } catch (err) {
          console.warn('Could not fetch README.md, continuing with empty README', err);
        }
      }
      else if (effectiveRepoInfo.type === 'gitlab') {
        // GitLab API approach
        const projectPath = extractUrlPath(effectiveRepoInfo.repoUrl ?? '')?.replace(/\.git$/, '') || `${owner}/${repo}`;
        const projectDomain = extractUrlDomain(effectiveRepoInfo.repoUrl ?? "https://gitlab.com");
        const encodedProjectPath = encodeURIComponent(projectPath);

        const headers = createGitlabHeaders(currentToken);

        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const filesData: any[] = [];

        try {
          // Step 1: Get project info to determine default branch
          let projectInfoUrl: string;
          let defaultBranchLocal = 'main'; // fallback
          try {
            const validatedUrl = new URL(projectDomain ?? ''); // Validate domain
            projectInfoUrl = `${validatedUrl.origin}/api/v4/projects/${encodedProjectPath}`;
          } catch (err) {
            throw new Error(`Invalid project domain URL: ${projectDomain}`);
          }
          const projectInfoRes = await fetch(projectInfoUrl, { headers });

          if (!projectInfoRes.ok) {
            const errorData = await projectInfoRes.text();
            throw new Error(`GitLab project info error: Status ${projectInfoRes.status}, Response: ${errorData}`);
          }

          const projectInfo = await projectInfoRes.json();
          defaultBranchLocal = projectInfo.default_branch || 'main';
          console.log(`Found GitLab default branch: ${defaultBranchLocal}`);
          // Store the default branch in state
          setDefaultBranch(defaultBranchLocal);

          // Step 2: Paginate to fetch full file tree
          let page = 1;
          let morePages = true;

          while (morePages) {
            const apiUrl = `${projectInfoUrl}/repository/tree?recursive=true&per_page=100&page=${page}`;
            const response = await fetch(apiUrl, { headers });

            if (!response.ok) {
              const errorData = await response.text();
              throw new Error(`Error fetching GitLab repository structure (page ${page}): ${errorData}`);
            }

            const pageData = await response.json();
            filesData.push(...pageData);

            const nextPage = response.headers.get('x-next-page');
            morePages = !!nextPage;
            page = nextPage ? parseInt(nextPage, 10) : page + 1;
          }

          if (!Array.isArray(filesData) || filesData.length === 0) {
            throw new Error('Could not fetch repository structure. Repository might be empty or inaccessible.');
          }

          // Step 3: Format file paths
          fileTreeData = filesData
            .filter((item: { type: string; path: string }) => item.type === 'blob')
            .map((item: { type: string; path: string }) => item.path)
            .join('\n');

          // Step 4: Try to fetch README.md content
          const readmeUrl = `${projectInfoUrl}/repository/files/README.md/raw`;
          try {
            const readmeResponse = await fetch(readmeUrl, { headers });
            if (readmeResponse.ok) {
              readmeContent = await readmeResponse.text();
              console.log('Successfully fetched GitLab README.md');
            } else {
              console.warn(`Could not fetch GitLab README.md status: ${readmeResponse.status}`);
            }
          } catch (err) {
            console.warn(`Error fetching GitLab README.md:`, err);
          }
        } catch (err) {
          console.error("Error during GitLab repository tree retrieval:", err);
          throw err;
        }
      }
      else if (effectiveRepoInfo.type === 'bitbucket') {
        // Bitbucket API approach
        const repoPath = extractUrlPath(effectiveRepoInfo.repoUrl ?? '') ?? `${owner}/${repo}`;
        const encodedRepoPath = encodeURIComponent(repoPath);

        // Try to get the file tree for common branch names
        let filesData = null;
        let apiErrorDetails = '';
        let defaultBranchLocal = '';
        const headers = createBitbucketHeaders(currentToken);

        // First get project info to determine default branch
        const projectInfoUrl = `https://api.bitbucket.org/2.0/repositories/${encodedRepoPath}`;
        try {
          const response = await fetch(projectInfoUrl, { headers });

          const responseText = await response.text();

          if (response.ok) {
            const projectData = JSON.parse(responseText);
            defaultBranchLocal = projectData.mainbranch.name;
            // Store the default branch in state
            setDefaultBranch(defaultBranchLocal);

            const apiUrl = `https://api.bitbucket.org/2.0/repositories/${encodedRepoPath}/src/${defaultBranchLocal}/?recursive=true&per_page=100`;
            try {
              const response = await fetch(apiUrl, {
                headers
              });

              const structureResponseText = await response.text();

              if (response.ok) {
                filesData = JSON.parse(structureResponseText);
              } else {
                const errorData = structureResponseText;
                apiErrorDetails = `Status: ${response.status}, Response: ${errorData}`;
              }
            } catch (err) {
              console.error(`Network error fetching Bitbucket branch ${defaultBranchLocal}:`, err);
            }
          } else {
            const errorData = responseText;
            apiErrorDetails = `Status: ${response.status}, Response: ${errorData}`;
          }
        } catch (err) {
          console.error("Network error fetching Bitbucket project info:", err);
        }

        if (!filesData || !Array.isArray(filesData.values) || filesData.values.length === 0) {
          if (apiErrorDetails) {
            throw new Error(`Could not fetch repository structure. Bitbucket API Error: ${apiErrorDetails}`);
          } else {
            throw new Error('Could not fetch repository structure. Repository might not exist, be empty or private.');
          }
        }

        // Convert files data to a string representation
        fileTreeData = filesData.values
          .filter((item: { type: string; path: string }) => item.type === 'commit_file')
          .map((item: { type: string; path: string }) => item.path)
          .join('\n');

        // Try to fetch README.md content
        try {
          const headers = createBitbucketHeaders(currentToken);

          const readmeResponse = await fetch(`https://api.bitbucket.org/2.0/repositories/${encodedRepoPath}/src/${defaultBranchLocal}/README.md`, {
            headers
          });

          if (readmeResponse.ok) {
            readmeContent = await readmeResponse.text();
          } else {
            console.warn(`Could not fetch Bitbucket README.md, status: ${readmeResponse.status}`);
          }
        } catch (err) {
          console.warn('Could not fetch Bitbucket README.md, continuing with empty README', err);
        }
      }

      // Now determine the wiki structure
      await determineWikiStructure(fileTreeData, readmeContent, owner, repo);

    } catch (error) {
      console.error('Error fetching repository structure:', error);
      setIsLoading(false);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      setLoadingMessage(undefined);
    } finally {
      // Reset the request in progress flag
      setRequestInProgress(false);
    }
  }, [owner, repo, determineWikiStructure, currentToken, effectiveRepoInfo, requestInProgress, messages.loading]);

  // Function to export wiki content
  const exportWiki = useCallback(async (format: 'markdown' | 'json') => {
    if (!wikiStructure || Object.keys(generatedPages).length === 0) {
      setExportError('No wiki content to export');
      return;
    }

    try {
      setIsExporting(true);
      setExportError(null);
      setLoadingMessage(`${language === 'ja' ? 'Wikiを' : 'Exporting wiki as '} ${format} ${language === 'ja' ? 'としてエクスポート中...' : '...'}`);

      // Prepare the pages for export
      const pagesToExport = wikiStructure.pages.map(page => {
        // Use the generated content if available, otherwise use an empty string
        const content = generatedPages[page.id]?.content || 'Content not generated';
        return {
          ...page,
          content
        };
      });

      // Get repository URL
      const repoUrl = getRepoUrl(effectiveRepoInfo);

      // Make API call to export wiki
      const response = await fetch(`/export/wiki`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo_url: repoUrl,
          type: effectiveRepoInfo.type,
          pages: pagesToExport,
          format
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details available');
        throw new Error(`Error exporting wiki: ${response.status} - ${errorText}`);
      }

      // Get the filename from the Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${effectiveRepoInfo.repo}_wiki.${format === 'markdown' ? 'md' : 'json'}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }

      // Convert the response to a blob and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      console.error('Error exporting wiki:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error during export';
      setExportError(errorMessage);
    } finally {
      setIsExporting(false);
      setLoadingMessage(undefined);
    }
  }, [wikiStructure, generatedPages, effectiveRepoInfo, language]);

  // No longer needed as we use the modal directly

  const confirmRefresh = useCallback(async (newToken?: string) => {
    setShowModelOptions(false);
    setLoadingMessage(messages.loading?.clearingCache || 'Clearing server cache...');
    setIsLoading(true); // Show loading indicator immediately

    try {
      const params = new URLSearchParams({
        owner: effectiveRepoInfo.owner,
        repo: effectiveRepoInfo.repo,
        repo_type: effectiveRepoInfo.type,
        language: language,
        provider: selectedProviderState,
        model: selectedModelState,
        is_custom_model: isCustomSelectedModelState.toString(),
        custom_model: customSelectedModelState,
        comprehensive: isComprehensiveView.toString(),
        authorization_code: authCode,
      });

      // Add file filters configuration
      if (modelExcludedDirs) {
        params.append('excluded_dirs', modelExcludedDirs);
      }
      if (modelExcludedFiles) {
        params.append('excluded_files', modelExcludedFiles);
      }

      if (authRequired && !authCode) {
        setIsLoading(false);
        console.error("Authorization code is required");
        setError('Authorization code is required');
        return;
      }

      const response = await fetch(`/api/wiki_cache?${params.toString()}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (response.ok) {
        console.log('Server-side wiki cache cleared successfully.');
        // Optionally, show a success message for cache clearing if desired
        // setLoadingMessage('Cache cleared. Refreshing wiki...');
      } else {
        const errorText = await response.text();
        console.warn(`Failed to clear server-side wiki cache (status: ${response.status}): ${errorText}. Proceeding with refresh anyway.`);
        // Optionally, inform the user about the cache clear failure but that refresh will still attempt
        // setError(\`Cache clear failed: ${errorText}. Trying to refresh...\`);
        if (response.status == 401) {
          setIsLoading(false);
          setLoadingMessage(undefined);
          setError('Failed to validate the authorization code');
          console.error('Failed to validate the authorization code')
          return;
        }
      }
    } catch (err) {
      console.warn('Error calling DELETE /api/wiki_cache:', err);
      setIsLoading(false);
      setEmbeddingError(false); // Reset embedding error state
      // Optionally, inform the user about the cache clear error
      // setError(\`Error clearing cache: ${err instanceof Error ? err.message : String(err)}. Trying to refresh...\`);
      throw err;
    }

    // Update token if provided
    if (newToken) {
      // Update current token state
      setCurrentToken(newToken);
      // Update the URL parameters to include the new token
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('token', newToken);
      window.history.replaceState({}, '', currentUrl.toString());
    }

    // Proceed with the rest of the refresh logic
    console.log('Refreshing wiki. Server cache will be overwritten upon new generation if not cleared.');

    // Clear the localStorage cache (if any remnants or if it was used before this change)
    const localStorageCacheKey = getCacheKey(effectiveRepoInfo.owner, effectiveRepoInfo.repo, effectiveRepoInfo.type, language, isComprehensiveView);
    localStorage.removeItem(localStorageCacheKey);

    // Reset cache loaded flag
    cacheLoadedSuccessfully.current = false;
    effectRan.current = false; // Allow the main data loading useEffect to run again

    // Reset all state
    setWikiStructure(undefined);
    setCurrentPageId(undefined);
    setGeneratedPages({});
    setPagesInProgress(new Set());
    setError(null);
    setEmbeddingError(false); // Reset embedding error state
    setIsLoading(true); // Set loading state for refresh
    setLoadingMessage(messages.loading?.initializing || 'Initializing wiki generation...');

    // Clear any in-progress requests for page content
    activeContentRequests.clear();
    // Reset flags related to request processing if they are component-wide
    setStructureRequestInProgress(false); // Assuming this flag should be reset
    setRequestInProgress(false); // Assuming this flag should be reset

    // Explicitly trigger the data loading process again by re-invoking what the main useEffect does.
    // This will first attempt to load from (now hopefully non-existent or soon-to-be-overwritten) server cache,
    // then proceed to fetchRepositoryStructure if needed.
    // To ensure fetchRepositoryStructure is called if cache is somehow still there or to force a full refresh:
    // One option is to directly call fetchRepositoryStructure() if force refresh means bypassing cache check.
    // For now, we rely on the standard loadData flow initiated by resetting effectRan and dependencies.
    // This will re-trigger the main data loading useEffect.
    // No direct call to fetchRepositoryStructure here, let the useEffect handle it based on effectRan.current = false.
  }, [effectiveRepoInfo, language, messages.loading, activeContentRequests, selectedProviderState, selectedModelState, isCustomSelectedModelState, customSelectedModelState, modelExcludedDirs, modelExcludedFiles, isComprehensiveView, authCode, authRequired]);

  // Start wiki generation when component mounts
  useEffect(() => {
    if (effectRan.current === false) {
      effectRan.current = true; // Set to true immediately to prevent re-entry due to StrictMode

      const loadData = async () => {
        // Try loading from server-side cache first
        setLoadingMessage(messages.loading?.fetchingCache || 'Checking for cached wiki...');
        try {
          const params = new URLSearchParams({
            owner: effectiveRepoInfo.owner,
            repo: effectiveRepoInfo.repo,
            repo_type: effectiveRepoInfo.type,
            language: language,
            comprehensive: isComprehensiveView.toString(),
          });
          const response = await fetch(`/api/wiki_cache?${params.toString()}`);

          if (response.ok) {
            const cachedData = await response.json(); // Returns null if no cache
            if (cachedData && cachedData.wiki_structure && cachedData.generated_pages && Object.keys(cachedData.generated_pages).length > 0) {
              console.log('Using server-cached wiki data');
              if (cachedData.model) {
                setSelectedModelState(cachedData.model);
              }
              if (cachedData.provider) {
                setSelectedProviderState(cachedData.provider);
              }

              // Update repoInfo
              if (cachedData.repo) {
                setEffectiveRepoInfo(cachedData.repo);
              } else if (cachedData.repo_url && !effectiveRepoInfo.repoUrl) {
                const updatedRepoInfo = { ...effectiveRepoInfo, repoUrl: cachedData.repo_url };
                setEffectiveRepoInfo(updatedRepoInfo); // Update effective repo info state
                console.log('Using cached repo_url:', cachedData.repo_url);
              }

              // Ensure the cached structure has sections and rootSections
              const cachedStructure = {
                ...cachedData.wiki_structure,
                sections: cachedData.wiki_structure.sections || [],
                rootSections: cachedData.wiki_structure.rootSections || []
              };

              // If sections or rootSections are missing, create intelligent ones based on page titles
              if (!cachedStructure.sections.length || !cachedStructure.rootSections.length) {
                const pages = cachedStructure.pages;
                const sections: WikiSection[] = [];
                const rootSections: string[] = [];

                // Group pages by common prefixes or categories
                const pageClusters = new Map<string, WikiPage[]>();

                // Define common categories that might appear in page titles
                const categories = [
                  { id: 'overview', title: 'Overview', keywords: ['overview', 'introduction', 'about'] },
                  { id: 'architecture', title: 'Architecture', keywords: ['architecture', 'structure', 'design', 'system'] },
                  { id: 'features', title: 'Core Features', keywords: ['feature', 'functionality', 'core'] },
                  { id: 'components', title: 'Components', keywords: ['component', 'module', 'widget'] },
                  { id: 'api', title: 'API', keywords: ['api', 'endpoint', 'service', 'server'] },
                  { id: 'data', title: 'Data Flow', keywords: ['data', 'flow', 'pipeline', 'storage'] },
                  { id: 'models', title: 'Models', keywords: ['model', 'ai', 'ml', 'integration'] },
                  { id: 'ui', title: 'User Interface', keywords: ['ui', 'interface', 'frontend', 'page'] },
                  { id: 'setup', title: 'Setup & Configuration', keywords: ['setup', 'config', 'installation', 'deploy'] }
                ];

                // Initialize clusters with empty arrays
                categories.forEach(category => {
                  pageClusters.set(category.id, []);
                });

                // Add an "Other" category for pages that don't match any category
                pageClusters.set('other', []);

                // Assign pages to categories based on title keywords
                pages.forEach((page: WikiPage) => {
                  const title = page.title.toLowerCase();
                  let assigned = false;

                  // Try to find a matching category
                  for (const category of categories) {
                    if (category.keywords.some(keyword => title.includes(keyword))) {
                      pageClusters.get(category.id)?.push(page);
                      assigned = true;
                      break;
                    }
                  }

                  // If no category matched, put in "Other"
                  if (!assigned) {
                    pageClusters.get('other')?.push(page);
                  }
                });

                // Create sections for non-empty categories
                for (const [categoryId, categoryPages] of pageClusters.entries()) {
                  if (categoryPages.length > 0) {
                    const category = categories.find(c => c.id === categoryId) ||
                      { id: categoryId, title: categoryId === 'other' ? 'Other' : categoryId.charAt(0).toUpperCase() + categoryId.slice(1) };

                    const sectionId = `section-${categoryId}`;
                    sections.push({
                      id: sectionId,
                      title: category.title,
                      pages: categoryPages.map((p: WikiPage) => p.id)
                    });
                    rootSections.push(sectionId);

                    // Update page parentId
                    categoryPages.forEach((page: WikiPage) => {
                      page.parentId = sectionId;
                    });
                  }
                }

                // If we still have no sections (unlikely), fall back to importance-based grouping
                if (sections.length === 0) {
                  const highImportancePages = pages.filter((p: WikiPage) => p.importance === 'high').map((p: WikiPage) => p.id);
                  const mediumImportancePages = pages.filter((p: WikiPage) => p.importance === 'medium').map((p: WikiPage) => p.id);
                  const lowImportancePages = pages.filter((p: WikiPage) => p.importance === 'low').map((p: WikiPage) => p.id);

                  if (highImportancePages.length > 0) {
                    sections.push({
                      id: 'section-high',
                      title: 'Core Components',
                      pages: highImportancePages
                    });
                    rootSections.push('section-high');
                  }

                  if (mediumImportancePages.length > 0) {
                    sections.push({
                      id: 'section-medium',
                      title: 'Key Features',
                      pages: mediumImportancePages
                    });
                    rootSections.push('section-medium');
                  }

                  if (lowImportancePages.length > 0) {
                    sections.push({
                      id: 'section-low',
                      title: 'Additional Information',
                      pages: lowImportancePages
                    });
                    rootSections.push('section-low');
                  }
                }

                cachedStructure.sections = sections;
                cachedStructure.rootSections = rootSections;
              }

              setWikiStructure(cachedStructure);
              setGeneratedPages(cachedData.generated_pages);
              setCurrentPageId(cachedStructure.pages.length > 0 ? cachedStructure.pages[0].id : undefined);
              if (cachedData.generated_at) {
                setGeneratedAt(cachedData.generated_at);
              }
              setIsLoading(false);
              setEmbeddingError(false);
              setLoadingMessage(undefined);
              cacheLoadedSuccessfully.current = true;
              return; // Exit if cache is successfully loaded
            } else {
              console.log('No valid wiki data in server cache or cache is empty.');
            }
          } else {
            // Log error but proceed to fetch structure, as cache is optional
            console.error('Error fetching wiki cache from server:', response.status, await response.text());
          }
        } catch (error) {
          console.error('Error loading from server cache:', error);
          // Proceed to fetch structure if cache loading fails
        }

        // If we reached here, either there was no cache, it was invalid, or an error occurred
        // Proceed to fetch repository structure
        fetchRepositoryStructure();
      };

      loadData();

    } else {
      console.log('Skipping duplicate repository fetch/cache check');
    }

    // Clean up function for this effect is not strictly necessary for loadData,
    // but keeping the main unmount cleanup in the other useEffect
  }, [effectiveRepoInfo, effectiveRepoInfo.owner, effectiveRepoInfo.repo, effectiveRepoInfo.type, language, fetchRepositoryStructure, messages.loading?.fetchingCache, isComprehensiveView]);

  // Save wiki to server-side cache when generation is complete
  useEffect(() => {
    const saveCache = async () => {
      if (!isLoading &&
        !error &&
        wikiStructure &&
        Object.keys(generatedPages).length > 0 &&
        Object.keys(generatedPages).length >= wikiStructure.pages.length &&
        !cacheLoadedSuccessfully.current) {

        const allPagesHaveContent = wikiStructure.pages.every(page =>
          generatedPages[page.id] && generatedPages[page.id].content && generatedPages[page.id].content !== 'Loading...');

        if (allPagesHaveContent) {
          console.log('Attempting to save wiki data to server cache via Next.js proxy');

          try {
            // Make sure wikiStructure has sections and rootSections
            const structureToCache = {
              ...wikiStructure,
              sections: wikiStructure.sections || [],
              rootSections: wikiStructure.rootSections || []
            };
            const dataToCache = {
              repo: effectiveRepoInfo,
              language: language,
              comprehensive: isComprehensiveView,
              wiki_structure: structureToCache,
              generated_pages: generatedPages,
              provider: selectedProviderState,
              model: selectedModelState,
              generated_at: new Date().toISOString(),
            };
            const response = await fetch(`/api/wiki_cache`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(dataToCache),
            });

            if (response.ok) {
              console.log('Wiki data successfully saved to server cache');
            } else {
              console.error('Error saving wiki data to server cache:', response.status, await response.text());
            }
          } catch (error) {
            console.error('Error saving to server cache:', error);
          }
        }
      }
    };

    saveCache();
  }, [isLoading, error, wikiStructure, generatedPages, effectiveRepoInfo.owner, effectiveRepoInfo.repo, effectiveRepoInfo.type, effectiveRepoInfo.repoUrl, repoUrl, language, isComprehensiveView]);

  const handlePageSelect = (pageId: string) => {
    if (currentPageId != pageId) {
      setCurrentPageId(pageId)
    }
  };

  // Handler for diagram node clicks — opens the detail panel
  const handleDiagramNodeClick = useCallback((nodeId: string, label: string, _rect: DOMRect, diagramData?: import('@/types/diagramData').DiagramData) => {
    setSelectedDiagramNode({ nodeId, label, diagramData: diagramData ?? null });
    setIsDiagramPanelOpen(true);
  }, []);

  const [isModelSelectionModalOpen, setIsModelSelectionModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <style>{wikiStyles}</style>

      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-[95%] xl:max-w-[1600px] mx-auto flex h-16 items-center">
          {isReadingMode ? (
            <>
              {/* Reading mode: simplified header */}
              <div className="mr-4 flex items-center">
                <button
                  onClick={() => setIsReadingMode(false)}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Exit reading mode"
                >
                  <FaArrowLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Exit Reading Mode</span>
                </button>
              </div>
              <div className="flex-1 text-center">
                <span className="text-sm font-medium text-foreground truncate">
                  {currentPageId && generatedPages[currentPageId]
                    ? generatedPages[currentPageId].title
                    : wikiStructure?.title || ''}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <ThemeToggle />
              </div>
            </>
          ) : (
            <>
              {/* Normal header */}
              <div className="mr-4 flex flex-1 items-center gap-4">
                <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <FaHome className="h-4 w-4" />
                  <span>{messages.repoPage?.home || 'Home'}</span>
                </Link>
                <span className="text-muted-foreground/30">/</span>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {effectiveRepoInfo.type === 'github' ? <FaGithub /> : effectiveRepoInfo.type === 'gitlab' ? <FaGitlab /> : <FaBitbucket />}
                  <span>{effectiveRepoInfo.owner}</span>
                  <span className="text-muted-foreground/50">/</span>
                  <span>{effectiveRepoInfo.repo}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Search button */}
                {!isLoading && wikiStructure && (
                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    aria-label="Search pages"
                  >
                    <FaSearch className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Search</span>
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ml-1">
                      <span>&#8984;</span>K
                    </kbd>
                  </button>
                )}
                {/* Graph button */}
                {!isLoading && wikiStructure && (
                  <button
                    onClick={() => setShowGraph(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    aria-label="View page relationships graph"
                    title="View page relationships"
                  >
                    <FaProjectDiagram className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Graph</span>
                  </button>
                )}
                {/* Visual Explorer button */}
                {!isLoading && wikiStructure && (
                  <Link
                    href={`/${owner}/${repo}/explore${repoType !== 'github' ? `?type=${repoType}` : ''}${language !== 'en' ? `${repoType !== 'github' ? '&' : '?'}language=${language}` : ''}`}
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    title="Interactive Visual Explorer"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                    <span className="hidden sm:inline">Explore</span>
                  </Link>
                )}
                {/* Reading mode toggle button */}
                {!isLoading && wikiStructure && (
                  <button
                    onClick={() => setIsReadingMode(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    aria-label="Reading mode"
                    title="Reading mode (Alt+R)"
                  >
                    <FaBook className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Read</span>
                  </button>
                )}
                <ThemeToggle />
              </div>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-[95%] xl:max-w-[1600px] mx-auto w-full py-6">
        {isLoading ? (
          <>
            {/* Skeleton UI mimicking the final wiki layout */}
            <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-8rem)]">
              {/* Sidebar skeleton */}
              <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col border border-border bg-card rounded-xl elevation-2 overflow-hidden">
                {/* Title area skeleton */}
                <div className="p-4 border-b border-border bg-muted/10">
                  <div className="h-5 bg-muted/60 rounded-lg animate-pulse" style={{ width: '70%' }}></div>
                  <div className="h-3 bg-muted/40 rounded-lg animate-pulse mt-2" style={{ width: '90%' }}></div>
                  <div className="h-3 bg-muted/40 rounded-lg animate-pulse mt-1" style={{ width: '60%' }}></div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="h-5 w-20 bg-muted/50 rounded-full animate-pulse"></div>
                  </div>
                </div>
                {/* Tree items skeleton */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  <div className="h-4 bg-muted/60 rounded-lg animate-pulse" style={{ width: '85%' }}></div>
                  <div className="h-4 bg-muted/50 rounded-lg animate-pulse ml-3" style={{ width: '70%' }}></div>
                  <div className="h-4 bg-muted/50 rounded-lg animate-pulse ml-3" style={{ width: '60%' }}></div>
                  <div className="h-4 bg-muted/40 rounded-lg animate-pulse ml-6" style={{ width: '55%' }}></div>
                  <div className="h-4 bg-muted/60 rounded-lg animate-pulse mt-1" style={{ width: '75%' }}></div>
                  <div className="h-4 bg-muted/50 rounded-lg animate-pulse ml-3" style={{ width: '65%' }}></div>
                  <div className="h-4 bg-muted/40 rounded-lg animate-pulse ml-3" style={{ width: '50%' }}></div>
                  <div className="h-4 bg-muted/60 rounded-lg animate-pulse mt-1" style={{ width: '80%' }}></div>
                </div>
              </aside>

              {/* Content skeleton */}
              <div className="flex-1 border border-border bg-card rounded-xl elevation-2 overflow-hidden p-8 lg:p-12">
                {/* Title skeleton */}
                <div className="h-8 bg-muted/60 rounded-lg animate-pulse" style={{ width: '75%' }}></div>
                {/* Badge skeleton */}
                <div className="h-5 w-20 bg-muted/40 rounded-full animate-pulse mt-4"></div>
                {/* Paragraph skeletons */}
                <div className="mt-8 space-y-3">
                  <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '100%' }}></div>
                  <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '83%' }}></div>
                  <div className="h-4 bg-muted/40 rounded-lg animate-pulse" style={{ width: '80%' }}></div>
                  <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '100%' }}></div>
                  <div className="h-4 bg-muted/40 rounded-lg animate-pulse" style={{ width: '75%' }}></div>
                </div>
                {/* Code block skeleton */}
                <div className="h-32 bg-muted/30 rounded-lg animate-pulse mt-8 border border-border/50"></div>
                {/* More paragraph skeletons */}
                <div className="mt-8 space-y-3">
                  <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '90%' }}></div>
                  <div className="h-4 bg-muted/40 rounded-lg animate-pulse" style={{ width: '70%' }}></div>
                  <div className="h-4 bg-muted/50 rounded-lg animate-pulse" style={{ width: '85%' }}></div>
                  <div className="h-4 bg-muted/40 rounded-lg animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>

            {/* Floating progress card */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 bg-card border border-border rounded-xl elevation-3 p-4 max-w-md w-full">
              {/* Phase steps indicator */}
              <div className="flex items-center justify-between mb-4 px-2">
                {([
                  { key: 'fetching', label: 'Fetch' },
                  { key: 'planning', label: 'Plan' },
                  { key: 'generating', label: 'Generate' },
                ] as const).map((step, i) => {
                  const phases = ['idle', 'fetching', 'planning', 'generating', 'done'] as const;
                  const currentIdx = phases.indexOf(generationPhase);
                  const stepIdx = phases.indexOf(step.key);
                  const isActive = generationPhase === step.key;
                  const isDone = currentIdx > stepIdx;
                  return (
                    <React.Fragment key={step.key}>
                      {i > 0 && <div className={`flex-1 h-px mx-2 ${isDone ? 'bg-primary' : 'bg-border'}`} />}
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${isDone ? 'bg-primary text-primary-foreground' : isActive ? 'bg-primary/20 text-primary ring-2 ring-primary' : 'bg-muted text-muted-foreground'}`}>
                          {isDone ? '✓' : i + 1}
                        </div>
                        <span className={`text-[10px] font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              <p className="text-sm font-medium text-foreground text-center mb-1">
                {loadingMessage || messages.common?.loading || 'Loading...'}
              </p>

              {/* Progress bar for page generation */}
              {wikiStructure && (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground mb-2 mt-3">
                    <span>Progress</span>
                    <span>{Math.round(100 * (wikiStructure.pages.length - pagesInProgress.size) / wikiStructure.pages.length)}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary overflow-hidden rounded-full">
                    <div
                      className="h-full bg-primary transition-all duration-500 ease-in-out"
                      style={{
                        width: `${Math.max(5, 100 * (wikiStructure.pages.length - pagesInProgress.size) / wikiStructure.pages.length)}%`
                      }}
                    />
                  </div>

                  <p className="text-xs text-muted-foreground text-center mt-3">
                    {language === 'ja'
                      ? `${wikiStructure.pages.length}ページ中${wikiStructure.pages.length - pagesInProgress.size}ページ完了`
                      : `${wikiStructure.pages.length - pagesInProgress.size} of ${wikiStructure.pages.length} pages generated`}
                  </p>

                  {/* Show list of in-progress pages */}
                  {pagesInProgress.size > 0 && (
                    <div className="mt-3 text-xs bg-muted/50 p-3 rounded-lg border border-border">
                      <p className="text-muted-foreground font-medium mb-2">
                        {messages.repoPage?.currentlyProcessing || 'Processing:'}
                      </p>
                      <ul className="space-y-1">
                        {Array.from(pagesInProgress).slice(0, 3).map(pageId => {
                          const page = wikiStructure.pages.find(p => p.id === pageId);
                          return page ? <li key={pageId} className="truncate flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>{page.title}</li> : null;
                        })}
                        {pagesInProgress.size > 3 && (
                          <li className="text-muted-foreground pl-3.5">
                            + {pagesInProgress.size - 3} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </>

        ) : error ? (
          <div className="max-w-2xl mx-auto mt-12 p-6 border border-destructive/20 bg-destructive/5 rounded-xl text-center">
            <div className="inline-flex items-center justify-center p-3 bg-destructive/10 rounded-full mb-4">
              <FaExclamationTriangle className="text-xl text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{messages.repoPage?.errorTitle || 'Generation Failed'}</h3>
            <p className="text-muted-foreground mb-6">{error}</p>

            <Link
              href="/"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              <FaHome className="mr-2 h-4 w-4" />
              {messages.repoPage?.backToHome || 'Back to Home'}
            </Link>
          </div>
        ) : wikiStructure ? (
          <div className={`flex flex-col lg:flex-row h-[calc(100vh-8rem)] transition-all duration-300 ease-out ${isReadingMode ? 'gap-0' : 'gap-8'}`}>
            {/* Wiki Navigation Sidebar */}
            <aside className={`flex-col border-border bg-card rounded-xl elevation-2 transition-all duration-300 ease-out ${isReadingMode ? 'w-0 lg:w-0 xl:w-0 opacity-0 overflow-hidden border-0 p-0 m-0 hidden' : 'w-full lg:w-72 xl:w-80 flex-shrink-0 flex border opacity-100 overflow-hidden'}`}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="p-4 border-b border-border bg-muted/10"
              >
                <h3 className="font-semibold text-foreground truncate" title={wikiStructure.title}>{wikiStructure.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{wikiStructure.description}</p>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <div className="inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-border bg-secondary text-secondary-foreground hover:bg-secondary/80">
                    {isComprehensiveView ? 'Comprehensive' : 'Concise'}
                  </div>
                  {generatedAt && (
                    <div className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-muted-foreground border border-border" title={`Generated ${new Date(generatedAt).toLocaleString()}`}>
                      {(() => {
                        const diff = Date.now() - new Date(generatedAt).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 1) return 'Just now';
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ago`;
                        const days = Math.floor(hrs / 24);
                        return `${days}d ago`;
                      })()}
                    </div>
                  )}
                  <button
                    onClick={() => setIsModelSelectionModalOpen(true)}
                    disabled={isLoading}
                    className="ml-auto p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                    title={messages.repoPage?.refreshWiki || 'Refresh'}
                  >
                    <FaSync className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </motion.div>

              {effectiveRepoInfo && effectiveRepoInfo.type !== 'local' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
                >
                  <RepoMetadata repoInfo={effectiveRepoInfo} />
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
                className="flex-1 overflow-y-auto p-2"
              >
                <WikiTreeView
                  wikiStructure={wikiStructure}
                  currentPageId={currentPageId}
                  onPageSelect={handlePageSelect}
                  messages={messages.repoPage}
                />
              </motion.div>

              {/* Export Actions */}
              {Object.keys(generatedPages).length > 0 && (
                <ExportMenu
                  wikiStructure={wikiStructure}
                  generatedPages={generatedPages}
                  repoInfo={{ owner: effectiveRepoInfo.owner, repo: effectiveRepoInfo.repo }}
                />
              )}
            </aside>

            {/* Wiki Content Area */}
            <div id="wiki-content" ref={wikiContentRef} className={`flex-1 min-w-0 border border-border bg-card rounded-xl elevation-2 overflow-y-auto transition-all duration-300 ease-out ${isReadingMode ? 'py-12 px-8 lg:px-16 reading-mode' : 'p-8 lg:p-12'}`}>
              {currentPageId && generatedPages[currentPageId] ? (
                <div className={`flex mx-auto gap-0 xl:gap-8 ${isReadingMode ? 'max-w-3xl' : 'max-w-6xl'}`}>
                  <motion.article
                    key={currentPageId}
                    className={`flex-1 min-w-0 ${isReadingMode ? '' : 'max-w-3xl'}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <div className="mb-6 pb-6 border-b border-border">
                      <h1 className="text-display-sm text-foreground break-words">
                        {generatedPages[currentPageId].title}
                      </h1>
                      {generatedPages[currentPageId].importance && (
                        <div className="mt-4 flex gap-2">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${generatedPages[currentPageId].importance === 'high' ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80' :
                              generatedPages[currentPageId].importance === 'medium' ? 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80' :
                                'border-transparent bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}>
                            {generatedPages[currentPageId].importance.charAt(0).toUpperCase() + generatedPages[currentPageId].importance.slice(1)} Priority
                          </span>
                        </div>
                      )}
                    </div>

                    {generatedPages[currentPageId].content.startsWith('Error generating content:') ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="inline-flex items-center justify-center p-3 bg-destructive/10 rounded-full mb-4">
                          <FaExclamationTriangle className="text-xl text-destructive" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{generatedPages[currentPageId].content}</p>
                        <button
                          onClick={() => {
                            const page = wikiStructure?.pages.find(p => p.id === currentPageId);
                            if (page) {
                              setPagesInProgress(prev => new Set(prev).add(currentPageId));
                              generatePageContent(page, owner, repo);
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          <FaSync className="h-3 w-3" />
                          Retry
                        </button>
                      </div>
                    ) : (
                      <div className="prose prose-zinc dark:prose-invert max-w-none">
                        <Markdown
                          content={generatedPages[currentPageId].content}
                          onDiagramNodeClick={handleDiagramNodeClick}
                        />
                      </div>
                    )}

                    {generatedPages[currentPageId].relatedPages.length > 0 && (
                      <div className="mt-12 pt-6 border-t border-border">
                        <h4 className="text-sm font-semibold text-foreground mb-4">
                          {messages.repoPage?.relatedPages || 'Related Pages'}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {generatedPages[currentPageId].relatedPages.map(relatedId => {
                            const relatedPage = wikiStructure.pages.find(p => p.id === relatedId);
                            return relatedPage ? (
                              <button
                                key={relatedId}
                                className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                                onClick={() => handlePageSelect(relatedId)}
                              >
                                {relatedPage.title}
                              </button>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </motion.article>

                  {/* Floating Table of Contents */}
                  <aside className="hidden xl:block w-56 shrink-0">
                    <div className="sticky top-0 pt-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
                      <TableOfContents
                        content={generatedPages[currentPageId].content}
                        scrollContainer={wikiContentRef.current}
                      />
                    </div>
                  </aside>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <div className="p-4 bg-muted/30 rounded-full mb-4">
                    <FaBookOpen className="text-3xl opacity-50" />
                  </div>
                  <p className="text-lg font-medium text-foreground">Select a page</p>
                  <p className="text-sm">Choose a page from the sidebar to view its content</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>

      <footer className="w-full border-t border-border mt-auto bg-background">
        <div className="max-w-[95%] xl:max-w-[1600px] mx-auto py-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>{messages.footer?.copyright || 'BetterCodeWiki'}</p>
        </div>
      </footer>

      {/* Floating Chat Button (toggle) */}
      {!isLoading && wikiStructure && (
        <button
          onClick={() => setIsAskModalOpen(prev => !prev)}
          className={`fixed bottom-8 right-8 h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${isAskModalOpen ? 'bg-primary/90 text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
          aria-label={isAskModalOpen ? 'Close Ask AI' : (messages.ask?.title || 'Ask AI')}
        >
          {isAskModalOpen ? <FaTimes className="h-5 w-5" /> : <FaComments className="h-5 w-5" />}
        </button>
      )}

      {/* Ask Drawer */}
      <div className={`fixed inset-0 z-30 ${isAskModalOpen ? '' : 'pointer-events-none'}`}>
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity duration-300 ${isAskModalOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsAskModalOpen(false)}
        />
        {/* Drawer panel */}
        <motion.div
          className="absolute top-0 right-0 h-full w-full sm:w-[440px] bg-card border-l border-border elevation-4 flex flex-col"
          initial={{ x: "100%" }}
          animate={{ x: isAskModalOpen ? 0 : "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
        >
          {/* Drawer header */}
          <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h2 className="text-title-md font-semibold text-foreground">Ask AI</h2>
            </div>
            <div className="flex items-center gap-1">
              {/* Clear conversation button */}
              <button
                onClick={() => askComponentRef.current?.clearConversation()}
                className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              {/* Close button */}
              <button
                onClick={() => setIsAskModalOpen(false)}
                className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close drawer"
              >
                <FaTimes className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto">
            {effectiveRepoInfo && (
              <Ask
                repoInfo={effectiveRepoInfo}
                provider={selectedProviderState}
                model={selectedModelState}
                isCustomModel={isCustomSelectedModelState}
                customModel={customSelectedModelState}
                language={language}
                onRef={(ref) => (askComponentRef.current = ref)}
              />
            )}
          </div>
        </motion.div>
      </div>

      <ModelSelectionModal
        isOpen={isModelSelectionModalOpen}
        onClose={() => setIsModelSelectionModalOpen(false)}
        provider={selectedProviderState}
        setProvider={setSelectedProviderState}
        model={selectedModelState}
        setModel={setSelectedModelState}
        isCustomModel={isCustomSelectedModelState}
        setIsCustomModel={setIsCustomSelectedModelState}
        customModel={customSelectedModelState}
        setCustomModel={setCustomSelectedModelState}
        isComprehensiveView={isComprehensiveView}
        setIsComprehensiveView={setIsComprehensiveView}
        showFileFilters={true}
        excludedDirs={modelExcludedDirs}
        setExcludedDirs={setModelExcludedDirs}
        excludedFiles={modelExcludedFiles}
        setExcludedFiles={setModelExcludedFiles}
        includedDirs={modelIncludedDirs}
        setIncludedDirs={setModelIncludedDirs}
        includedFiles={modelIncludedFiles}
        setIncludedFiles={setModelIncludedFiles}
        onApply={confirmRefresh}
        showWikiType={true}
        showTokenInput={effectiveRepoInfo.type !== 'local' && !currentToken}
        repositoryType={effectiveRepoInfo.type as 'github' | 'gitlab' | 'bitbucket'}
        authRequired={authRequired}
        authCode={authCode}
        setAuthCode={setAuthCode}
        isAuthLoading={isAuthLoading}
      />

      {/* Search Command Palette */}
      <SearchCommand
        generatedPages={generatedPages}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectPage={handlePageSelect}
      />

      {/* Diagram Detail Panel (Click-to-Explain) */}
      <DiagramDetailPanel
        isOpen={isDiagramPanelOpen}
        onClose={() => { setIsDiagramPanelOpen(false); setSelectedDiagramNode(null); }}
        nodeId={selectedDiagramNode?.nodeId ?? null}
        nodeLabel={selectedDiagramNode?.label ?? null}
        diagramData={selectedDiagramNode?.diagramData ?? null}
        repoOwner={owner}
        repoName={repo}
        repoType={repoType as 'github' | 'gitlab' | 'bitbucket'}
        repoUrl={effectiveRepoInfo.repoUrl || undefined}
        repoToken={currentToken || undefined}
        provider={selectedProviderState}
        model={selectedModelState}
        language={language}
      />

      {/* Dependency Graph */}
      <DependencyGraph
        pages={generatedPages}
        currentPageId={currentPageId || null}
        onSelectPage={handlePageSelect}
        isOpen={showGraph}
        onClose={() => setShowGraph(false)}
      />
    </div>
  );
}
