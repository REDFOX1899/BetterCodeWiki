/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import Ask from '@/components/Ask';
import Markdown from '@/components/Markdown';
import ModelSelectionModal from '@/components/ModelSelectionModal';
import SearchCommand from '@/components/SearchCommand';
import TableOfContents from '@/components/TableOfContents';
import RepoMetadata from '@/components/RepoMetadata';
import WikiTreeView from '@/components/WikiTreeView';
import ExportMenu from '@/components/ExportMenu';
import { useLanguage } from '@/contexts/LanguageContext';
import { RepoInfo } from '@/types/repoinfo';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Book, BookOpen, List, MessageSquare, AlertTriangle, Home, Network, Search, RefreshCw, X } from 'lucide-react';
import DependencyGraph from '@/components/DependencyGraph';
import WikiSidebarSkeleton from '@/components/skeletons/WikiSidebarSkeleton';
import WikiContentSkeleton from '@/components/skeletons/WikiContentSkeleton';
import DiagramDetailPanel from '@/components/DiagramDetailPanel';
import { useAuthentication } from '@/hooks/useAuthentication';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useModelSelection } from '@/hooks/useModelSelection';
import { useWikiGeneration } from '@/hooks/useWikiGeneration';
import { useWikiCache } from '@/hooks/useWikiCache';
import { useRepoStructure } from '@/hooks/useRepoStructure';
import { useWikiExport } from '@/hooks/useWikiExport';
import { wikiStyles } from '@/styles/wikiStyles';

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
  const templateParam = searchParams.get('template') || 'comprehensive';
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [currentToken, setCurrentToken] = useState(token);
  const [effectiveRepoInfo, setEffectiveRepoInfo] = useState(repoInfo);
  const [embeddingError, setEmbeddingError] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [cachedCommitSha, setCachedCommitSha] = useState<string | null>(null);
  const [freshnessStatus, setFreshnessStatus] = useState<'checking' | 'up-to-date' | 'outdated' | 'unknown' | null>(null);

  // Wiki template state
  const [selectedTemplate, setSelectedTemplate] = useState<string>(templateParam);

  // Model selection (extracted hook)
  const modelSelection = useModelSelection({
    providerParam,
    modelParam,
    isCustomModelParam,
    customModelParam,
    excludedDirs: searchParams.get('excluded_dirs') || '',
    excludedFiles: searchParams.get('excluded_files') || '',
    includedDirs: searchParams.get('included_dirs') || '',
    includedFiles: searchParams.get('included_files') || '',
    isComprehensiveParam: searchParams.get('comprehensive') !== 'false',
  });
  const {
    selectedProviderState, setSelectedProviderState,
    selectedModelState, setSelectedModelState,
    isCustomSelectedModelState, setIsCustomSelectedModelState,
    customSelectedModelState, setCustomSelectedModelState,
    showModelOptions, setShowModelOptions,
    modelExcludedDirs, setModelExcludedDirs,
    modelExcludedFiles, setModelExcludedFiles,
    modelIncludedDirs, setModelIncludedDirs,
    modelIncludedFiles, setModelIncludedFiles,
    isComprehensiveView, setIsComprehensiveView,
  } = modelSelection;

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

  // State for floating TOC (non-XL screens)
  const [isFloatingTocOpen, setIsFloatingTocOpen] = useState(false);

  // State for Diagram Detail Panel (Click-to-Explain)
  const [isDiagramPanelOpen, setIsDiagramPanelOpen] = useState(false);
  const [selectedDiagramNode, setSelectedDiagramNode] = useState<{
    nodeId: string;
    label: string;
    diagramData: import('@/types/diagramData').DiagramData | null;
  } | null>(null);

  // Authentication (extracted hook)
  const { authRequired, authCode, setAuthCode, isAuthLoading } = useAuthentication();

  // Default branch state
  const [defaultBranch, setDefaultBranch] = useState<string>('main');

  // Shared refs for cache/refresh coordination
  const cacheLoadedSuccessfully = useRef(false);
  const effectRan = useRef(false);

  // Helper function to generate proper repository file URLs
  const generateFileUrl = useCallback((filePath: string): string => {
    if (effectiveRepoInfo.type === 'local') {
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
        return `${repoUrl}/blob/${defaultBranch}/${filePath}`;
      } else if (hostname === 'gitlab.com' || hostname.includes('gitlab')) {
        return `${repoUrl}/-/blob/${defaultBranch}/${filePath}`;
      } else if (hostname === 'bitbucket.org' || hostname.includes('bitbucket')) {
        return `${repoUrl}/src/${defaultBranch}/${filePath}`;
      }
    } catch (error) {
      console.warn('Error generating file URL:', error);
    }

    return filePath;
  }, [effectiveRepoInfo, defaultBranch]);

  // Keyboard shortcuts (extracted hook)
  useKeyboardShortcuts({
    isReadingMode,
    setIsReadingMode,
    isAskModalOpen,
    setIsAskModalOpen,
    setIsSearchOpen,
    currentPageId: undefined, // Will be set after generation hook
  });

  // Wiki generation (extracted hook)
  const {
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
  } = useWikiGeneration({
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
    setEmbeddingError: setEmbeddingError,
    generateFileUrl,
    messages,
  });

  // Repo structure fetching (extracted hook)
  const { requestInProgress, fetchRepositoryStructure, confirmRefresh } = useRepoStructure({
    owner,
    repo,
    effectiveRepoInfo,
    currentToken,
    language,
    isComprehensiveView,
    selectedProviderState,
    selectedModelState,
    isCustomSelectedModelState,
    customSelectedModelState,
    modelExcludedDirs,
    modelExcludedFiles,
    authRequired,
    authCode,
    setIsLoading,
    setLoadingMessage,
    setError,
    setEmbeddingError,
    setWikiStructure: setWikiStructure as (s: undefined) => void,
    setCurrentPageId: setCurrentPageId as (id: undefined) => void,
    setGeneratedPages: setGeneratedPages as (p: Record<string, import('@/types/wiki').WikiPage>) => void,
    setPagesInProgress: setPagesInProgress as (s: Set<string>) => void,
    setDefaultBranch,
    setShowModelOptions,
    setCurrentToken,
    setCachedCommitSha,
    setFreshnessStatus,
    setStructureRequestInProgress,
    setRequestInProgress: () => {}, // Internal to hook
    activeContentRequests,
    cacheLoadedSuccessfully,
    effectRan,
    determineWikiStructure,
    messages,
  });

  // Wiki cache (extracted hook) — loads from cache on mount, saves when generation completes
  useWikiCache({
    effectiveRepoInfo,
    setEffectiveRepoInfo,
    language,
    isComprehensiveView,
    currentToken,
    setIsLoading,
    setLoadingMessage,
    setEmbeddingError,
    setWikiStructure,
    setGeneratedPages: setGeneratedPages as (p: Record<string, import('@/types/wiki').WikiPage>) => void,
    setCurrentPageId,
    setGeneratedAt,
    setCachedCommitSha,
    setFreshnessStatus,
    setSelectedModelState,
    setSelectedProviderState,
    selectedProviderState,
    selectedModelState,
    selectedTemplate,
    setSelectedTemplate,
    messages,
    isLoading,
    error,
    wikiStructure,
    generatedPages,
    cachedCommitSha,
    freshnessStatus,
    fetchRepositoryStructure,
    cacheLoadedSuccessfully,
    effectRan,
  });

  // Wiki export (extracted hook)
  const { exportWiki } = useWikiExport({
    wikiStructure,
    generatedPages,
    effectiveRepoInfo,
  });

  const handlePageSelect = (pageId: string) => {
    if (currentPageId != pageId) {
      setCurrentPageId(pageId);
      setIsFloatingTocOpen(false);
    }
  };

  // Auto-select the first page when wiki loads without a selection
  useEffect(() => {
    if (wikiStructure && !currentPageId && wikiStructure.pages.length > 0) {
      setCurrentPageId(wikiStructure.pages[0].id);
    }
  }, [wikiStructure, currentPageId, setCurrentPageId]);

  // Handler for diagram node clicks — opens the detail panel
  const handleDiagramNodeClick = useCallback((nodeId: string, label: string, _rect: DOMRect, diagramData?: import('@/types/diagramData').DiagramData) => {
    setSelectedDiagramNode({ nodeId, label, diagramData: diagramData ?? null });
    setIsDiagramPanelOpen(true);
  }, []);

  const [isModelSelectionModalOpen, setIsModelSelectionModalOpen] = useState(false);

  // Onboarding tooltip state
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);

  useEffect(() => {
    if (!wikiStructure || isLoading) return;
    try {
      if (typeof window !== 'undefined' && !localStorage.getItem('bcw-onboarded')) {
        const timer = setTimeout(() => setOnboardingStep(0), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage not available
    }
  }, [wikiStructure, isLoading]);

  useEffect(() => {
    if (onboardingStep === null) return;
    const timer = setTimeout(() => {
      if (onboardingStep < 2) {
        setOnboardingStep(onboardingStep + 1);
      } else {
        setOnboardingStep(null);
        try { localStorage.setItem('bcw-onboarded', '1'); } catch { /* noop */ }
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [onboardingStep]);

  const dismissOnboarding = useCallback(() => {
    setOnboardingStep(null);
    try { localStorage.setItem('bcw-onboarded', '1'); } catch { /* noop */ }
  }, []);

  return (
    <div className="flex-1 bg-background flex flex-col font-sans">
      <style>{wikiStyles}</style>

      {/* Page-specific toolbar */}
      {(isReadingMode || (!isLoading && wikiStructure)) && (
        <div className="w-full border-b border-border bg-background/95 backdrop-blur">
          <div className="max-w-[95%] xl:max-w-[1600px] mx-auto flex h-10 items-center justify-between px-2">
            {isReadingMode ? (
              <>
                <button
                  onClick={() => setIsReadingMode(false)}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Exit reading mode"
                >
                  <ArrowLeft size={14} className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Exit Reading Mode</span>
                </button>
                <span className="text-sm font-medium text-foreground truncate">
                  {currentPageId && generatedPages[currentPageId]
                    ? generatedPages[currentPageId].title
                    : wikiStructure?.title || ''}
                </span>
                <div className="w-20" />
              </>
            ) : (
              <>
                <div />
                <div className="flex items-center gap-2">
                  {/* Search button */}
                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    aria-label="Search pages"
                  >
                    <Search size={12} className="h-3 w-3" />
                    <span className="hidden sm:inline">Search</span>
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ml-1">
                      {typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '\u2318' : 'Ctrl+'}K
                    </kbd>
                  </button>
                  {/* Graph button */}
                  <button
                    onClick={() => setShowGraph(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    aria-label="View page relationships graph"
                    title="View page relationships"
                  >
                    <Network size={12} className="h-3 w-3" />
                    <span className="hidden sm:inline">Graph</span>
                  </button>
                  {/* Reading mode toggle */}
                  <button
                    onClick={() => setIsReadingMode(true)}
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    aria-label="Reading mode"
                    title="Reading mode (Alt+R)"
                  >
                    <Book size={12} className="h-3 w-3" />
                    <span className="hidden sm:inline">Read</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[95%] xl:max-w-[1600px] mx-auto w-full py-6">
        {isLoading ? (
          <>
            {/* Skeleton UI mimicking the final wiki layout */}
            <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-8rem)]">
              <WikiSidebarSkeleton />
              <WikiContentSkeleton />
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
                          {isDone ? '\u2713' : i + 1}
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
                      ? `${wikiStructure.pages.length}\u30DA\u30FC\u30B8\u4E2D${wikiStructure.pages.length - pagesInProgress.size}\u30DA\u30FC\u30B8\u5B8C\u4E86`
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
              <AlertTriangle size={20} className="text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{messages.repoPage?.errorTitle || 'Generation Failed'}</h3>
            <p className="text-muted-foreground mb-6">{error}</p>

            <Link
              href="/"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              <Home size={16} className="mr-2 h-4 w-4" />
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
                  {freshnessStatus === 'checking' && (
                    <div className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-muted-foreground border border-border" title="Checking if wiki is up to date...">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse mr-1" />
                      Checking...
                    </div>
                  )}
                  {freshnessStatus === 'up-to-date' && (
                    <div className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700/50 bg-green-50 dark:bg-green-950/30" title="Wiki matches the latest commit on the default branch">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                      Up to date
                    </div>
                  )}
                  {freshnessStatus === 'outdated' && (
                    <button
                      onClick={() => setIsModelSelectionModalOpen(true)}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors cursor-pointer"
                      title="The repository has newer commits since this wiki was generated. Click to regenerate."
                    >
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />
                      May be outdated
                    </button>
                  )}
                  <button
                    onClick={() => setIsModelSelectionModalOpen(true)}
                    disabled={isLoading}
                    className="ml-auto p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                    title={messages.repoPage?.refreshWiki || 'Refresh'}
                  >
                    <RefreshCw size={14} className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
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

              {/* Sidebar search trigger */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
                className="px-4 pb-2"
              >
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="flex items-center gap-2 w-full rounded-md border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Search size={14} className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left truncate">Search pages...</span>
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                    {typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '\u2318' : 'Ctrl+'}K
                  </kbd>
                </button>
              </motion.div>

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
                  currentPageId={currentPageId}
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
                      <div className="flex items-start justify-between gap-4">
                        <h1 className="text-display-sm text-foreground break-words">
                          {generatedPages[currentPageId].title}
                        </h1>
                        {!isLoading && pagesInProgress.size === 0 && (
                          <button
                            onClick={() => regeneratePage(currentPageId, owner, repo, repoType, effectiveRepoInfo.repoUrl || undefined)}
                            disabled={isRegenerating !== null}
                            className="shrink-0 mt-1 inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Regenerate this page"
                          >
                            <RefreshCw size={12} className={`h-3 w-3 ${isRegenerating === currentPageId ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">{isRegenerating === currentPageId ? 'Regenerating...' : 'Regenerate'}</span>
                          </button>
                        )}
                      </div>
                      {(generatedPages[currentPageId].importance || (selectedTemplate && selectedTemplate !== 'comprehensive')) && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {generatedPages[currentPageId].importance && (
                            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${generatedPages[currentPageId].importance === 'high' ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80' :
                                generatedPages[currentPageId].importance === 'medium' ? 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80' :
                                  'border-transparent bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}>
                              {generatedPages[currentPageId].importance.charAt(0).toUpperCase() + generatedPages[currentPageId].importance.slice(1)} Priority
                            </span>
                          )}
                          {selectedTemplate && selectedTemplate !== 'comprehensive' && (
                            <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {selectedTemplate === 'architecture' ? 'Architecture Guide' :
                               selectedTemplate === 'api-docs' ? 'API Docs' :
                               selectedTemplate === 'onboarding' ? 'Onboarding Guide' :
                               selectedTemplate === 'security' ? 'Security Review' :
                               selectedTemplate}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {isRegenerating === currentPageId ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <RefreshCw size={24} className="h-6 w-6 text-primary animate-spin mb-4" />
                        <p className="text-sm font-medium text-foreground mb-1">Regenerating page...</p>
                        <p className="text-xs text-muted-foreground">This may take a moment</p>
                      </div>
                    ) : generatedPages[currentPageId].content.startsWith('Error generating content:') ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="inline-flex items-center justify-center p-3 bg-destructive/10 rounded-full mb-4">
                          <AlertTriangle size={20} className="text-destructive" />
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
                          <RefreshCw size={12} className="h-3 w-3" />
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

                  {/* Table of Contents -- full sidebar on XL screens */}
                  <aside className="hidden xl:block w-56 shrink-0">
                    <div className="sticky top-0 pt-2 max-h-[calc(100vh-12rem)] overflow-y-auto">
                      <TableOfContents
                        content={generatedPages[currentPageId].content}
                        scrollContainer={wikiContentRef.current}
                      />
                    </div>
                  </aside>

                  {/* Floating TOC button for non-XL screens */}
                  <div className="xl:hidden fixed bottom-24 right-8 z-40">
                    <button
                      onClick={() => setIsFloatingTocOpen(prev => !prev)}
                      className={`h-10 w-10 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                        isFloatingTocOpen
                          ? 'bg-primary/90 text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background'
                          : 'bg-card text-foreground border border-border hover:bg-accent'
                      }`}
                      aria-label={isFloatingTocOpen ? 'Close table of contents' : 'Table of contents'}
                      title="Table of contents"
                    >
                      {isFloatingTocOpen ? <X size={16} /> : <List size={16} />}
                    </button>

                    {/* TOC popover */}
                    {isFloatingTocOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-12 right-0 w-64 max-h-80 overflow-y-auto rounded-xl border border-border bg-card shadow-lg p-4"
                      >
                        <TableOfContents
                          content={generatedPages[currentPageId].content}
                          scrollContainer={wikiContentRef.current}
                        />
                      </motion.div>
                    )}
                  </div>
                </div>
              ) : currentPageId && pagesInProgress.has(currentPageId) ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <RefreshCw size={24} className="h-6 w-6 text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium text-foreground">Generating content...</p>
                  <p className="text-sm">
                    {wikiStructure?.pages.find(p => p.id === currentPageId)?.title || 'This page'} is being generated
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <div className="p-4 bg-muted/30 rounded-full mb-4">
                    <BookOpen size={30} className="opacity-50" />
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
          {isAskModalOpen ? <X size={20} className="h-5 w-5" /> : <MessageSquare size={20} className="h-5 w-5" />}
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
                <X size={16} className="h-4 w-4" />
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

      {/* Onboarding tooltips */}
      {onboardingStep !== null && (
        <div className="fixed inset-0 z-[60] pointer-events-none">
          {onboardingStep === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-auto absolute top-32 left-4 lg:left-[calc(1rem)] max-w-[220px] bg-primary text-primary-foreground rounded-lg px-4 py-3 shadow-lg text-sm"
            >
              <p className="font-medium mb-1">Browse wiki pages</p>
              <p className="text-xs opacity-90">Navigate sections and pages in the sidebar</p>
              <button onClick={dismissOnboarding} className="mt-2 text-xs underline opacity-75 hover:opacity-100">Dismiss</button>
              <div className="absolute -left-1.5 top-4 w-3 h-3 bg-primary rotate-45" />
            </motion.div>
          )}
          {onboardingStep === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-auto absolute top-2 right-1/2 translate-x-1/2 max-w-[220px] bg-primary text-primary-foreground rounded-lg px-4 py-3 shadow-lg text-sm"
            >
              <p className="font-medium mb-1">Search pages</p>
              <p className="text-xs opacity-90">Press {typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '\u2318' : 'Ctrl+'}K to quickly find any page</p>
              <button onClick={dismissOnboarding} className="mt-2 text-xs underline opacity-75 hover:opacity-100">Dismiss</button>
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-primary rotate-45" />
            </motion.div>
          )}
          {onboardingStep === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-auto absolute bottom-24 right-16 max-w-[220px] bg-primary text-primary-foreground rounded-lg px-4 py-3 shadow-lg text-sm"
            >
              <p className="font-medium mb-1">Ask AI anything</p>
              <p className="text-xs opacity-90">Click the chat button to ask questions about this codebase</p>
              <button onClick={dismissOnboarding} className="mt-2 text-xs underline opacity-75 hover:opacity-100">Dismiss</button>
              <div className="absolute -right-1.5 bottom-4 w-3 h-3 bg-primary rotate-45" />
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
