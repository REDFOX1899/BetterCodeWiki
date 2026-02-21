'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { DiagramData } from '@/types/diagramData';
import type { ExplorerView } from '@/lib/diagramToReactFlow';
import DiagramDetailPanel from '@/components/DiagramDetailPanel';

// Lazy-load the canvas to avoid SSR issues with React Flow
const ExplorerCanvas = dynamic(
  () => import('@/components/explorer/ExplorerCanvas'),
  { ssr: false },
);

/* ------------------------------------------------------------------ */
/*  Wiki page shape (matches the cache format)                         */
/* ------------------------------------------------------------------ */

interface CachedWikiPage {
  id: string;
  title: string;
  content: string;
  filePaths: string[];
  importance: 'high' | 'medium' | 'low';
  relatedPages: string[];
  diagramData?: DiagramData[] | null;
  parentId?: string;
  isSection?: boolean;
  children?: string[];
}

/* ------------------------------------------------------------------ */
/*  Views                                                              */
/* ------------------------------------------------------------------ */

const VIEW_CONFIG: { key: ExplorerView; label: string; icon: React.ReactNode; emptyTitle: string; emptyDesc: string }[] = [
  {
    key: 'architecture',
    label: 'Architecture',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    emptyTitle: 'No architecture data',
    emptyDesc: 'This wiki does not have structured component data yet. Regenerate the wiki to see the system architecture.',
  },
  {
    key: 'dataflow',
    label: 'Data Flow',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M4 12h16M12 4l8 8-8 8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    emptyTitle: 'No data flow edges',
    emptyDesc: 'No data flow relationships were found. This view shows how data moves between components (inputs, processing, outputs).',
  },
  {
    key: 'dependencies',
    label: 'Dependencies',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="6" cy="6" r="3" />
        <circle cx="18" cy="18" r="3" />
        <path d="M8.6 8.6L15.4 15.4" strokeLinecap="round" />
        <circle cx="18" cy="6" r="3" />
        <path d="M8.6 7L15.4 7" strokeLinecap="round" />
      </svg>
    ),
    emptyTitle: 'No dependency edges',
    emptyDesc: 'No dependency or API call relationships were found. This view shows which modules import or call other modules.',
  },
];

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function ExplorePage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const owner = params.owner as string;
  const repo = params.repo as string;
  const repoType = (searchParams.get('type') || 'github') as 'github' | 'gitlab' | 'bitbucket';
  const language = searchParams.get('language') || 'en';

  // State from URL or defaults
  const [selectedView, setSelectedView] = useState<ExplorerView>(
    (searchParams.get('view') as ExplorerView) || 'architecture',
  );
  const [selectedDepth, setSelectedDepth] = useState<number>(
    Number(searchParams.get('depth') ?? 1),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    searchParams.get('node') || null,
  );

  // Data state
  const [allDiagrams, setAllDiagrams] = useState<DiagramData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [fitViewTrigger, setFitViewTrigger] = useState(0);

  // Fetch wiki cache on mount
  useEffect(() => {
    async function fetchWikiData() {
      try {
        setIsLoading(true);
        const cacheParams = new URLSearchParams({
          owner,
          repo,
          repo_type: repoType,
          language,
        });
        const response = await fetch(`/api/wiki_cache?${cacheParams.toString()}`);
        if (!response.ok) {
          setError('Failed to fetch wiki data.');
          setIsLoading(false);
          return;
        }

        const cachedData = await response.json();
        if (!cachedData || !cachedData.generated_pages) {
          setError('No wiki data found. Generate a wiki first.');
          setIsLoading(false);
          return;
        }

        // Extract all DiagramData from pages
        const diagrams: DiagramData[] = [];
        const pages = cachedData.generated_pages as Record<string, CachedWikiPage>;
        for (const page of Object.values(pages)) {
          if (page.diagramData && Array.isArray(page.diagramData)) {
            diagrams.push(...page.diagramData);
          }
        }

        setAllDiagrams(diagrams);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading explorer data:', err);
        setError('Error loading wiki data.');
        setIsLoading(false);
      }
    }

    fetchWikiData();
  }, [owner, repo, repoType, language]);

  // Merge all diagram data for the selected view into one DiagramData
  const mergedDiagram = useMemo<DiagramData | null>(() => {
    if (allDiagrams.length === 0) return null;

    const mergedNodes = new Map<string, DiagramData['nodes'][0]>();
    const allEdges: DiagramData['edges'] = [];
    const edgeKeys = new Set<string>();

    for (const diagram of allDiagrams) {
      for (const node of diagram.nodes) {
        if (!mergedNodes.has(node.id)) {
          mergedNodes.set(node.id, node);
        }
      }
      for (const edge of diagram.edges) {
        const key = `${edge.source}->${edge.target}:${edge.type}`;
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          allEdges.push(edge);
        }
      }
    }

    // Filter edges based on selected view
    let filteredEdges: DiagramData['edges'];
    switch (selectedView) {
      case 'dataflow':
        filteredEdges = allEdges.filter((e) => e.type === 'data_flow');
        break;
      case 'dependencies':
        filteredEdges = allEdges.filter((e) => e.type === 'dependency' || e.type === 'api_call');
        break;
      default: // architecture -- show everything
        filteredEdges = allEdges;
        break;
    }

    // For filtered views, prune orphan nodes (keep connected + depth-0 for context)
    let finalNodes: DiagramData['nodes'][0][];
    if (selectedView !== 'architecture') {
      const connectedIds = new Set<string>();
      for (const edge of filteredEdges) {
        connectedIds.add(edge.source);
        connectedIds.add(edge.target);
      }
      finalNodes = Array.from(mergedNodes.values()).filter(
        (n) => connectedIds.has(n.id) || n.depth === 0,
      );
    } else {
      finalNodes = Array.from(mergedNodes.values());
    }

    return {
      nodes: finalNodes,
      edges: filteredEdges,
      mermaidSource: allDiagrams[0]?.mermaidSource ?? '',
      diagramType: allDiagrams[0]?.diagramType ?? 'flowchart',
    };
  }, [allDiagrams, selectedView]);

  // Look up the selected node info for the detail panel
  const selectedNodeInfo = useMemo(() => {
    if (!selectedNodeId || !mergedDiagram) return null;
    return mergedDiagram.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, mergedDiagram]);

  // Check if the current view has meaningful data
  const viewHasData = mergedDiagram && (mergedDiagram.edges.length > 0 || selectedView === 'architecture');
  const currentViewConfig = VIEW_CONFIG.find((v) => v.key === selectedView)!;

  // Handlers
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setIsPanelOpen(true);
    },
    [],
  );

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedNodeId(null);
  }, []);

  const handleViewChange = useCallback((view: ExplorerView) => {
    setSelectedView(view);
    setSelectedNodeId(null);
    setIsPanelOpen(false);
  }, []);

  const handleDepthChange = useCallback((depth: number) => {
    setSelectedDepth(depth);
  }, []);

  const handleZoomToFit = useCallback(() => {
    setFitViewTrigger((c) => c + 1);
  }, []);

  // No diagram data state
  const hasNoDiagramData = !isLoading && !error && allDiagrams.length === 0;

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-zinc-950">
      {/* ---- Toolbar ---- */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        {/* View tabs */}
        <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5">
          {VIEW_CONFIG.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => handleViewChange(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                selectedView === key
                  ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Right side: depth + zoom-to-fit */}
        <div className="flex items-center gap-3">
          {/* Depth toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 rounded-lg p-0.5">
            {[
              { depth: 1, label: 'Overview' },
              { depth: 3, label: 'Detailed' },
              { depth: Infinity, label: 'Full' },
            ].map(({ depth, label }) => (
              <button
                key={depth}
                onClick={() => handleDepthChange(depth)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  selectedDepth === depth
                    ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Zoom to fit */}
          <button
            onClick={handleZoomToFit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            title="Zoom to fit"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span className="hidden md:inline">Fit</span>
          </button>
        </div>
      </div>

      {/* ---- Main content ---- */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading explorer data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-6">
                <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
              </div>
            </div>
          ) : hasNoDiagramData ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-6">
                <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  No structured diagram data available
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This wiki doesn&apos;t have structured diagram data yet. Regenerate the wiki to enable the Visual Explorer.
                </p>
              </div>
            </div>
          ) : !viewHasData && selectedView !== 'architecture' ? (
            /* Per-view empty state for filtered views with no matching edges */
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-6">
                <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {currentViewConfig.emptyTitle}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {currentViewConfig.emptyDesc}
                </p>
              </div>
            </div>
          ) : (
            <ExplorerCanvas
              diagramData={mergedDiagram}
              maxDepth={selectedDepth}
              view={selectedView}
              onNodeClick={handleNodeClick}
              selectedNodeId={selectedNodeId}
              fitViewTrigger={fitViewTrigger}
            />
          )}
        </div>

        {/* Detail panel (reuse DiagramDetailPanel) */}
        <DiagramDetailPanel
          isOpen={isPanelOpen}
          onClose={handleClosePanel}
          nodeId={selectedNodeId}
          nodeLabel={selectedNodeInfo?.label ?? null}
          diagramData={mergedDiagram}
          repoOwner={owner}
          repoName={repo}
          repoType={repoType}
        />
      </div>
    </div>
  );
}
