'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WikiStructure, WikiPage, WikiSection } from '@/types/wiki';
import { RepoInfo } from '@/types/repoinfo';
import getRepoUrl from '@/utils/getRepoUrl';
import { addTokensToRequestBody } from '@/utils/addTokens';

interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  prompt_guidance: string;
  structure_hint: string;
  page_count: string;
  focus_areas: string[];
}

interface UseWikiGenerationParams {
  effectiveRepoInfo: RepoInfo;
  currentToken: string;
  language: string;
  // Model selection
  selectedProviderState: string;
  selectedModelState: string;
  isCustomSelectedModelState: boolean;
  customSelectedModelState: string;
  modelExcludedDirs: string;
  modelExcludedFiles: string;
  modelIncludedDirs: string;
  modelIncludedFiles: string;
  isComprehensiveView: boolean;
  selectedTemplate: string;
  // State setters
  setIsLoading: (v: boolean) => void;
  setLoadingMessage: (v: string | undefined) => void;
  setError: (v: string | null) => void;
  setEmbeddingError: (v: boolean) => void;
  // Generate file URL helper
  generateFileUrl: (filePath: string) => string;
  // Messages
  messages: Record<string, Record<string, string> | undefined>;
}

interface UseWikiGenerationReturn {
  wikiStructure: WikiStructure | undefined;
  setWikiStructure: (s: WikiStructure | undefined) => void;
  currentPageId: string | undefined;
  setCurrentPageId: (id: string | undefined) => void;
  generatedPages: Record<string, WikiPage>;
  setGeneratedPages: React.Dispatch<React.SetStateAction<Record<string, WikiPage>>>;
  pagesInProgress: Set<string>;
  setPagesInProgress: React.Dispatch<React.SetStateAction<Set<string>>>;
  generationPhase: 'idle' | 'fetching' | 'planning' | 'generating' | 'done';
  setGenerationPhase: (v: 'idle' | 'fetching' | 'planning' | 'generating' | 'done') => void;
  originalMarkdown: Record<string, string>;
  structureRequestInProgress: boolean;
  setStructureRequestInProgress: (v: boolean) => void;
  activeContentRequests: Map<string, boolean>;
  generatePageContent: (page: WikiPage, owner: string, repo: string) => Promise<void>;
  determineWikiStructure: (fileTree: string, readme: string, owner: string, repo: string) => Promise<void>;
  regeneratePage: (pageId: string, owner: string, repo: string, repoType: string, repoUrl?: string) => Promise<void>;
  isRegenerating: string | null;
}

export function useWikiGeneration(params: UseWikiGenerationParams): UseWikiGenerationReturn {
  const {
    effectiveRepoInfo,
    currentToken,
    language,
    selectedProviderState,
    selectedModelState,
    isCustomSelectedModelState,
    customSelectedModelState,
    modelExcludedDirs,
    modelExcludedFiles,
    modelIncludedDirs,
    modelIncludedFiles,
    isComprehensiveView,
    selectedTemplate,
    setIsLoading,
    setLoadingMessage,
    setError,
    setEmbeddingError,
    generateFileUrl,
    messages,
  } = params;

  const [wikiStructure, setWikiStructure] = useState<WikiStructure | undefined>();
  const [currentPageId, setCurrentPageId] = useState<string | undefined>();
  const [generatedPages, setGeneratedPages] = useState<Record<string, WikiPage>>({});
  const [pagesInProgress, setPagesInProgress] = useState(new Set<string>());
  const [generationPhase, setGenerationPhase] = useState<'idle' | 'fetching' | 'planning' | 'generating' | 'done'>('idle');
  const [originalMarkdown, setOriginalMarkdown] = useState<Record<string, string>>({});
  const [structureRequestInProgress, setStructureRequestInProgress] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);

  // Template configuration loaded from backend
  const templateConfigRef = useRef<TemplateConfig | null>(null);

  useEffect(() => {
    if (!selectedTemplate) return;
    let cancelled = false;
    const fetchTemplate = async () => {
      try {
        const res = await fetch('/api/wiki_templates');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.templates?.[selectedTemplate]) {
            templateConfigRef.current = data.templates[selectedTemplate];
          }
        }
      } catch (err) {
        console.warn('Failed to fetch template config:', err);
      }
    };
    fetchTemplate();
    return () => { cancelled = true; };
  }, [selectedTemplate]);

  const activeContentRequests = useRef(new Map<string, boolean>()).current;

  // Generate content for a wiki page
  const generatePageContent = useCallback(async (page: WikiPage, owner: string, repo: string) => {
    return new Promise<void>(async (resolve) => {
      try {
        if (generatedPages[page.id]?.content) {
          resolve();
          return;
        }

        if (activeContentRequests.get(page.id)) {
          console.log(`Page ${page.id} (${page.title}) is already being processed, skipping duplicate call`);
          resolve();
          return;
        }

        activeContentRequests.set(page.id, true);

        if (!owner || !repo) {
          throw new Error('Invalid repository information. Owner and repo name are required.');
        }

        setPagesInProgress(prev => new Set(prev).add(page.id));

        const filePaths = page.filePaths;

        setGeneratedPages(prev => ({
          ...prev,
          [page.id]: { ...page, content: 'Loading...' }
        }));
        setOriginalMarkdown(prev => ({ ...prev, [page.id]: '' }));

        console.log(`Starting content generation for page: ${page.title}`);

        const repoUrl = getRepoUrl(effectiveRepoInfo);

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

${templateConfigRef.current?.prompt_guidance ? `
TEMPLATE FOCUS:
${templateConfigRef.current.prompt_guidance}
` : ''}
Remember:
- Ground every claim in the provided source files.
- Prioritize accuracy and direct representation of the code's functionality and structure.
- Structure the document logically for easy understanding by other developers.
`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestBody: Record<string, any> = {
          repo_url: repoUrl,
          type: effectiveRepoInfo.type,
          messages: [{
            role: 'user',
            content: promptContent
          }]
        };

        addTokensToRequestBody(requestBody, currentToken, effectiveRepoInfo.type, selectedProviderState, selectedModelState, isCustomSelectedModelState, customSelectedModelState, language, modelExcludedDirs, modelExcludedFiles, modelIncludedDirs, modelIncludedFiles);

        let content = '';

        try {
          const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:8001';
          const wsBaseUrl = serverBaseUrl.replace(/^http/, 'ws') ? serverBaseUrl.replace(/^https/, 'wss') : serverBaseUrl.replace(/^http/, 'ws');
          const wsUrl = `${wsBaseUrl}/ws/chat`;

          const ws = new WebSocket(wsUrl);

          await new Promise<void>((resolve, reject) => {
            ws.onerror = (error) => {
              console.error('WebSocket error:', error);
              reject(new Error('WebSocket connection failed'));
            };

            const timeout = setTimeout(() => {
              reject(new Error('WebSocket connection timeout'));
            }, 5000);

            ws.onopen = () => {
              clearTimeout(timeout);
              console.log(`WebSocket connection established for page: ${page.title}`);
              ws.send(JSON.stringify(requestBody));
              resolve();
            };
          });

          await new Promise<void>((resolve, reject) => {
            ws.onmessage = (event) => {
              content += event.data;
            };
            ws.onclose = () => {
              console.log(`WebSocket connection closed for page: ${page.title}`);
              resolve();
            };
            ws.onerror = (error) => {
              console.error('WebSocket error during message reception:', error);
              reject(new Error('WebSocket error during message reception'));
            };
          });
        } catch (wsError) {
          console.error('WebSocket error, falling back to HTTP:', wsError);

          const response = await fetch(`/api/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'No error details available');
            console.error(`API error (${response.status}): ${errorText}`);
            throw new Error(`Error generating page content: ${response.status} - ${response.statusText}`);
          }

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
            content += decoder.decode();
          } catch (readError) {
            console.error('Error reading stream:', readError);
            throw new Error('Error processing response stream');
          }
        }

        content = content.replace(/^```markdown\s*/i, '').replace(/```\s*$/i, '');

        console.log(`Received content for ${page.title}, length: ${content.length} characters`);

        const updatedPage = { ...page, content };
        setGeneratedPages(prev => ({ ...prev, [page.id]: updatedPage }));
        setOriginalMarkdown(prev => ({ ...prev, [page.id]: content }));

        resolve();
      } catch (err) {
        console.error(`Error generating content for page ${page.id}:`, err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setGeneratedPages(prev => ({
          ...prev,
          [page.id]: { ...page, content: `Error generating content: ${errorMessage}` }
        }));
        setError(`Failed to generate content for ${page.title}.`);
        resolve();
      } finally {
        activeContentRequests.delete(page.id);
        setPagesInProgress(prev => {
          const next = new Set(prev);
          next.delete(page.id);
          return next;
        });
        setLoadingMessage(undefined);
      }
    });
  }, [generatedPages, currentToken, effectiveRepoInfo, selectedProviderState, selectedModelState, isCustomSelectedModelState, customSelectedModelState, modelExcludedDirs, modelExcludedFiles, language, activeContentRequests, generateFileUrl, modelIncludedDirs, modelIncludedFiles, setError, setLoadingMessage]);

  // Determine the wiki structure from repository data
  const determineWikiStructure = useCallback(async (fileTree: string, readme: string, owner: string, repo: string) => {
    if (!owner || !repo) {
      setError('Invalid repository information. Owner and repo name are required.');
      setIsLoading(false);
      setEmbeddingError(false);
      return;
    }

    if (structureRequestInProgress) {
      console.log('Wiki structure determination already in progress, skipping duplicate call');
      return;
    }

    try {
      setStructureRequestInProgress(true);
      setGenerationPhase('planning');
      setLoadingMessage(messages.loading?.determiningStructure || 'Determining wiki structure...');

      const repoUrl = getRepoUrl(effectiveRepoInfo);

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

${templateConfigRef.current?.prompt_guidance ? `
TEMPLATE FOCUS — ${templateConfigRef.current.name}:
${templateConfigRef.current.prompt_guidance}
` : ''}
${templateConfigRef.current?.structure_hint ? `
STRUCTURE GUIDANCE:
${templateConfigRef.current.structure_hint}
` : ''}
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
1. Create ${templateConfigRef.current?.page_count || (isComprehensiveView ? '8-12' : '4-6')} pages that would make a ${templateConfigRef.current?.name || (isComprehensiveView ? 'comprehensive' : 'concise')} wiki for this repository
2. Each page should focus on a specific aspect of the codebase (e.g., architecture, key features, setup)
3. The relevant_files should be actual files from the repository that would be used to generate that page
4. Return ONLY valid XML with the structure specified above, with no markdown code block delimiters`
        }]
      };

      addTokensToRequestBody(requestBody, currentToken, effectiveRepoInfo.type, selectedProviderState, selectedModelState, isCustomSelectedModelState, customSelectedModelState, language, modelExcludedDirs, modelExcludedFiles, modelIncludedDirs, modelIncludedFiles);

      let responseText = '';

      try {
        const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:8001';
        const wsBaseUrl = serverBaseUrl.replace(/^http/, 'ws') ? serverBaseUrl.replace(/^https/, 'wss') : serverBaseUrl.replace(/^http/, 'ws');
        const wsUrl = `${wsBaseUrl}/ws/chat`;

        const ws = new WebSocket(wsUrl);

        await new Promise<void>((resolve, reject) => {
          ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            reject(new Error('WebSocket connection failed'));
          };

          const timeout = setTimeout(() => {
            reject(new Error('WebSocket connection timeout'));
          }, 5000);

          ws.onopen = () => {
            clearTimeout(timeout);
            console.log('WebSocket connection established for wiki structure');
            ws.send(JSON.stringify(requestBody));
            resolve();
          };
        });

        await new Promise<void>((resolve, reject) => {
          ws.onmessage = (event) => {
            responseText += event.data;
          };
          ws.onclose = () => {
            console.log('WebSocket connection closed for wiki structure');
            resolve();
          };
          ws.onerror = (error) => {
            console.error('WebSocket error during message reception:', error);
            reject(new Error('WebSocket error during message reception'));
          };
        });
      } catch (wsError) {
        console.error('WebSocket error, falling back to HTTP:', wsError);

        const response = await fetch(`/api/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`Error determining wiki structure: ${response.status}`);
        }

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

      responseText = responseText.replace(/^```(?:xml|json)?\s*/i, '').replace(/```\s*$/i, '');

      // --- Helper: parse wiki structure from JSON ---
      const parseJsonStructure = (obj: Record<string, unknown>): {
        title: string;
        description: string;
        pages: WikiPage[];
        sections: WikiSection[];
        rootSections: string[];
      } | null => {
        try {
          const root = (typeof obj === 'object' && obj !== null && 'wiki_structure' in obj && typeof obj.wiki_structure === 'object')
            ? (obj.wiki_structure as Record<string, unknown>)
            : obj;

          const jTitle = (root.title as string) || '';
          const jDescription = (root.description as string) || '';
          const rawPages = Array.isArray(root.pages) ? root.pages : [];

          if (rawPages.length === 0) return null;

          const jPages: WikiPage[] = rawPages.map((rp: Record<string, unknown>, idx: number) => {
            const id = (rp.id as string) || `page-${idx + 1}`;
            const title = (rp.title as string) || '';
            const rawImportance = (rp.importance as string) || 'medium';
            const importance: 'high' | 'medium' | 'low' =
              rawImportance === 'high' ? 'high' :
              rawImportance === 'medium' ? 'medium' : 'low';

            let filePaths: string[] = [];
            const fpSource = rp.filePaths || rp.file_paths || rp.relevant_files || rp.relevantFiles;
            if (Array.isArray(fpSource)) {
              filePaths = fpSource.filter((f: unknown) => typeof f === 'string') as string[];
            }

            let relatedPages: string[] = [];
            const rpSource = rp.relatedPages || rp.related_pages;
            if (Array.isArray(rpSource)) {
              relatedPages = rpSource.filter((r: unknown) => typeof r === 'string') as string[];
            }

            return { id, title, content: '', filePaths, importance, relatedPages };
          });

          const rawSections = Array.isArray(root.sections) ? root.sections : [];
          const jSections: WikiSection[] = rawSections.map((rs: Record<string, unknown>, idx: number) => {
            const id = (rs.id as string) || `section-${idx + 1}`;
            const title = (rs.title as string) || '';
            const pageRefs = Array.isArray(rs.pages || rs.page_refs)
              ? ((rs.pages || rs.page_refs) as string[])
              : [];
            const subsections = Array.isArray(rs.subsections || rs.section_refs)
              ? ((rs.subsections || rs.section_refs) as string[])
              : [];
            return {
              id,
              title,
              pages: pageRefs,
              subsections: subsections.length > 0 ? subsections : undefined
            };
          });

          const jRootSections: string[] = (root.rootSections || root.root_sections) as string[] || [];
          if (jRootSections.length === 0 && jSections.length > 0) {
            const referenced = new Set<string>();
            jSections.forEach(s => (s.subsections || []).forEach(sub => referenced.add(sub)));
            jSections.forEach(s => { if (!referenced.has(s.id)) jRootSections.push(s.id); });
          }

          return { title: jTitle, description: jDescription, pages: jPages, sections: jSections, rootSections: jRootSections };
        } catch (e) {
          console.warn('JSON structure parsing helper failed:', e);
          return null;
        }
      };

      // --- Main parsing: try XML, then JSON, then backend fallback ---
      let title = '';
      let description = '';
      let pages: WikiPage[] = [];
      let sections: WikiSection[] = [];
      let rootSections: string[] = [];
      let parsingSucceeded = false;

      // Strategy 1: XML parsing
      const xmlMatch = responseText.match(/<wiki_structure>[\s\S]*?<\/wiki_structure>/m);
      if (xmlMatch) {
        let xmlText = xmlMatch[0];
        xmlText = xmlText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const parseError = xmlDoc.querySelector('parsererror');

        if (parseError) {
          const elements = xmlDoc.querySelectorAll('*');
          if (elements.length > 0) {
            console.log('First 5 element names:',
              Array.from(elements).slice(0, 5).map(el => el.nodeName).join(', '));
          }
        }

        const titleEl = xmlDoc.querySelector('title');
        const descriptionEl = xmlDoc.querySelector('description');
        const pagesEls = xmlDoc.querySelectorAll('page');

        if (!parseError || (pagesEls && pagesEls.length > 0)) {
          title = titleEl ? titleEl.textContent || '' : '';
          description = descriptionEl ? descriptionEl.textContent || '' : '';

          pagesEls.forEach(pageEl => {
            const id = pageEl.getAttribute('id') || `page-${pages.length + 1}`;
            const elTitle = pageEl.querySelector('title');
            const importanceEl = pageEl.querySelector('importance');
            const filePathEls = pageEl.querySelectorAll('file_path');
            const relatedEls = pageEl.querySelectorAll('related');

            const pageTitle = elTitle ? elTitle.textContent || '' : '';
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
              title: pageTitle,
              content: '',
              filePaths,
              importance,
              relatedPages
            });
          });

          if (isComprehensiveView) {
            const sectionsEls = xmlDoc.querySelectorAll('section');
            if (sectionsEls && sectionsEls.length > 0) {
              sectionsEls.forEach(sectionEl => {
                const id = sectionEl.getAttribute('id') || `section-${sections.length + 1}`;
                const elTitle = sectionEl.querySelector('title');
                const pageRefEls = sectionEl.querySelectorAll('page_ref');
                const sectionRefEls = sectionEl.querySelectorAll('section_ref');

                const sTitle = elTitle ? elTitle.textContent || '' : '';
                const sPages: string[] = [];
                const sSubsections: string[] = [];

                pageRefEls.forEach(el => {
                  if (el.textContent) sPages.push(el.textContent);
                });
                sectionRefEls.forEach(el => {
                  if (el.textContent) sSubsections.push(el.textContent);
                });

                sections.push({
                  id,
                  title: sTitle,
                  pages: sPages,
                  subsections: sSubsections.length > 0 ? sSubsections : undefined
                });

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

          if (pages.length > 0) {
            parsingSucceeded = true;
            console.log(`XML parsing succeeded: ${pages.length} pages extracted`);
          }
        }
      }

      // Strategy 2: JSON parsing fallback
      if (!parsingSucceeded) {
        console.log('XML parsing did not yield pages, trying JSON fallback');
        try {
          const jsonCandidate = responseText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

          let jsonObj: Record<string, unknown> | null = null;
          try {
            const parsed = JSON.parse(jsonCandidate);
            if (typeof parsed === 'object' && parsed !== null) {
              jsonObj = parsed;
            }
          } catch {
            const firstBrace = jsonCandidate.indexOf('{');
            if (firstBrace >= 0) {
              let depth = 0;
              for (let i = firstBrace; i < jsonCandidate.length; i++) {
                if (jsonCandidate[i] === '{') depth++;
                else if (jsonCandidate[i] === '}') depth--;
                if (depth === 0) {
                  const substr = jsonCandidate.substring(firstBrace, i + 1);
                  try {
                    const parsed = JSON.parse(substr);
                    if (typeof parsed === 'object' && parsed !== null &&
                        ('pages' in parsed || 'wiki_structure' in parsed)) {
                      jsonObj = parsed;
                    }
                  } catch { /* continue scanning */ }
                  break;
                }
              }
            }
          }

          if (jsonObj) {
            const jsonResult = parseJsonStructure(jsonObj);
            if (jsonResult && jsonResult.pages.length > 0) {
              title = jsonResult.title;
              description = jsonResult.description;
              pages = jsonResult.pages;
              sections = jsonResult.sections;
              rootSections = jsonResult.rootSections;
              parsingSucceeded = true;
              console.log(`JSON fallback succeeded: ${pages.length} pages extracted`);
            }
          }
        } catch (jsonError) {
          console.warn('JSON fallback parsing failed:', jsonError);
        }
      }

      // Strategy 3: Backend robust parser fallback
      if (!parsingSucceeded) {
        console.log('Client-side parsing failed, trying backend parser endpoint');
        try {
          const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:8001';
          const parseResponse = await fetch(`${serverBaseUrl}/api/parse_wiki_structure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw_text: responseText, output_format: 'json' })
          });

          if (parseResponse.ok) {
            const backendResult = await parseResponse.json();
            const normalized = parseJsonStructure(backendResult);
            if (normalized && normalized.pages.length > 0) {
              title = normalized.title;
              description = normalized.description;
              pages = normalized.pages;
              sections = normalized.sections;
              rootSections = normalized.rootSections;
              parsingSucceeded = true;
              console.log(`Backend parser fallback succeeded: ${pages.length} pages extracted`);
            }
          }
        } catch (backendError) {
          console.warn('Backend parser fallback failed:', backendError);
        }
      }

      if (!parsingSucceeded || pages.length === 0) {
        throw new Error('Failed to parse wiki structure from LLM response (tried XML, JSON, and backend fallback)');
      }

      const newWikiStructure: WikiStructure = {
        id: 'wiki',
        title,
        description,
        pages,
        sections,
        rootSections
      };

      setWikiStructure(newWikiStructure);
      setCurrentPageId(pages.length > 0 ? pages[0].id : undefined);

      // Start generating content for all pages with controlled concurrency
      if (pages.length > 0) {
        const initialInProgress = new Set(pages.map(p => p.id));
        setPagesInProgress(initialInProgress);

        setGenerationPhase('generating');
        console.log(`Starting generation for ${pages.length} pages with controlled concurrency`);

        const MAX_CONCURRENT = 3;
        const queue = [...pages];
        let activeRequests = 0;

        const processQueue = () => {
          while (queue.length > 0 && activeRequests < MAX_CONCURRENT) {
            const page = queue.shift();
            if (page) {
              activeRequests++;
              console.log(`Starting page ${page.title} (${activeRequests} active, ${queue.length} remaining)`);

              generatePageContent(page, owner, repo)
                .finally(() => {
                  activeRequests--;
                  console.log(`Finished page ${page.title} (${activeRequests} active, ${queue.length} remaining)`);

                  if (queue.length === 0 && activeRequests === 0) {
                    console.log("All page generation tasks completed.");
                    setGenerationPhase('done');
                    setIsLoading(false);
                    setLoadingMessage(undefined);
                  } else {
                    if (queue.length > 0 && activeRequests < MAX_CONCURRENT) {
                      processQueue();
                    }
                  }
                });
            }
          }

          if (queue.length === 0 && activeRequests === 0 && pages.length > 0 && pagesInProgress.size === 0) {
            console.log("Queue empty and no active requests after loop, ensuring loading is false.");
            setIsLoading(false);
            setLoadingMessage(undefined);
          } else if (pages.length === 0) {
            setIsLoading(false);
            setLoadingMessage(undefined);
          }
        };

        processQueue();
      } else {
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
  }, [generatePageContent, currentToken, effectiveRepoInfo, pagesInProgress.size, structureRequestInProgress, selectedProviderState, selectedModelState, isCustomSelectedModelState, customSelectedModelState, modelExcludedDirs, modelExcludedFiles, language, messages.loading, isComprehensiveView, setIsLoading, setLoadingMessage, setError, setEmbeddingError, modelIncludedDirs, modelIncludedFiles]);

  // Regenerate a single page via the backend endpoint
  const regeneratePage = useCallback(async (pageId: string, owner: string, repo: string, repoType: string, repoUrl?: string) => {
    if (isRegenerating) {
      console.log('A page regeneration is already in progress');
      return;
    }

    setIsRegenerating(pageId);

    try {
      const modelToUse = isCustomSelectedModelState ? customSelectedModelState : selectedModelState;

      const response = await fetch('/api/wiki/regenerate_page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo,
          repo_type: repoType,
          page_id: pageId,
          language,
          provider: selectedProviderState,
          model: modelToUse,
          custom_model: isCustomSelectedModelState ? customSelectedModelState : undefined,
          access_token: currentToken || undefined,
          repo_url: repoUrl || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(errorData.detail || `Failed to regenerate page (${response.status})`);
      }

      const data = await response.json();

      if (data.page) {
        setGeneratedPages(prev => ({
          ...prev,
          [pageId]: data.page,
        }));
      }
    } catch (err) {
      console.error('Error regenerating page:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate page');
    } finally {
      setIsRegenerating(null);
    }
  }, [isRegenerating, selectedProviderState, selectedModelState, isCustomSelectedModelState, customSelectedModelState, currentToken, language, setError]);

  return {
    wikiStructure,
    setWikiStructure,
    currentPageId,
    setCurrentPageId,
    generatedPages,
    setGeneratedPages,
    pagesInProgress,
    setPagesInProgress,
    generationPhase,
    setGenerationPhase,
    originalMarkdown,
    structureRequestInProgress,
    setStructureRequestInProgress,
    activeContentRequests,
    generatePageContent,
    determineWikiStructure,
    regeneratePage,
    isRegenerating,
  };
}
