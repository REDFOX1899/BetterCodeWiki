'use client';

import { useCallback, useEffect } from 'react';
import { WikiStructure, WikiPage, WikiSection } from '@/types/wiki';
import { RepoInfo } from '@/types/repoinfo';
import { extractUrlPath, extractUrlDomain } from '@/utils/urlDecoder';
import { createGithubHeaders, createGitlabHeaders, createBitbucketHeaders } from '@/utils/repoHeaders';

interface UseWikiCacheParams {
  effectiveRepoInfo: RepoInfo;
  setEffectiveRepoInfo: (info: RepoInfo) => void;
  language: string;
  isComprehensiveView: boolean;
  currentToken: string;
  // Loading state
  setIsLoading: (v: boolean) => void;
  setLoadingMessage: (v: string | undefined) => void;
  setEmbeddingError: (v: boolean) => void;
  // Wiki state setters
  setWikiStructure: (s: WikiStructure | undefined) => void;
  setGeneratedPages: (p: Record<string, WikiPage>) => void;
  setCurrentPageId: (id: string | undefined) => void;
  setGeneratedAt: (v: string | null) => void;
  setCachedCommitSha: (v: string | null) => void;
  setFreshnessStatus: (v: 'checking' | 'up-to-date' | 'outdated' | 'unknown' | null) => void;
  // Model state setters
  setSelectedModelState: (v: string) => void;
  setSelectedProviderState: (v: string) => void;
  selectedProviderState: string;
  selectedModelState: string;
  // Template
  selectedTemplate: string;
  setSelectedTemplate: (v: string) => void;
  // Messages
  messages: Record<string, Record<string, string> | undefined>;
  // Wiki generation state (for save condition)
  isLoading: boolean;
  error: string | null;
  wikiStructure: WikiStructure | undefined;
  generatedPages: Record<string, WikiPage>;
  // Freshness
  cachedCommitSha: string | null;
  freshnessStatus: 'checking' | 'up-to-date' | 'outdated' | 'unknown' | null;
  // Fetch fallback
  fetchRepositoryStructure: () => Promise<void>;
  // Shared refs (created in the parent component)
  cacheLoadedSuccessfully: React.MutableRefObject<boolean>;
  effectRan: React.MutableRefObject<boolean>;
}

export function useWikiCache(params: UseWikiCacheParams): void {
  const {
    effectiveRepoInfo,
    setEffectiveRepoInfo,
    language,
    isComprehensiveView,
    currentToken,
    setIsLoading,
    setLoadingMessage,
    setEmbeddingError,
    setWikiStructure,
    setGeneratedPages,
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
    fetchRepositoryStructure,
    cacheLoadedSuccessfully,
    effectRan,
  } = params;

  // --- Helper: build sections from pages when cache has none ---
  const buildSectionsFromPages = useCallback((pages: WikiPage[]): { sections: WikiSection[]; rootSections: string[] } => {
    const sections: WikiSection[] = [];
    const rootSections: string[] = [];
    const pageClusters = new Map<string, WikiPage[]>();

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

    categories.forEach(category => pageClusters.set(category.id, []));
    pageClusters.set('other', []);

    pages.forEach((page: WikiPage) => {
      const title = page.title.toLowerCase();
      let assigned = false;
      for (const category of categories) {
        if (category.keywords.some(keyword => title.includes(keyword))) {
          pageClusters.get(category.id)?.push(page);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        pageClusters.get('other')?.push(page);
      }
    });

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

        categoryPages.forEach((page: WikiPage) => {
          page.parentId = sectionId;
        });
      }
    }

    // Fallback to importance-based grouping
    if (sections.length === 0) {
      const highImportancePages = pages.filter((p: WikiPage) => p.importance === 'high').map((p: WikiPage) => p.id);
      const mediumImportancePages = pages.filter((p: WikiPage) => p.importance === 'medium').map((p: WikiPage) => p.id);
      const lowImportancePages = pages.filter((p: WikiPage) => p.importance === 'low').map((p: WikiPage) => p.id);

      if (highImportancePages.length > 0) {
        sections.push({ id: 'section-high', title: 'Core Components', pages: highImportancePages });
        rootSections.push('section-high');
      }
      if (mediumImportancePages.length > 0) {
        sections.push({ id: 'section-medium', title: 'Key Features', pages: mediumImportancePages });
        rootSections.push('section-medium');
      }
      if (lowImportancePages.length > 0) {
        sections.push({ id: 'section-low', title: 'Additional Information', pages: lowImportancePages });
        rootSections.push('section-low');
      }
    }

    return { sections, rootSections };
  }, []);

  // Load from cache on mount
  useEffect(() => {
    if (effectRan.current === false) {
      effectRan.current = true;

      const loadData = async () => {
        setLoadingMessage(messages.loading?.fetchingCache || 'Checking for cached wiki...');
        try {
          const urlParams = new URLSearchParams({
            owner: effectiveRepoInfo.owner,
            repo: effectiveRepoInfo.repo,
            repo_type: effectiveRepoInfo.type,
            language: language,
            comprehensive: isComprehensiveView.toString(),
          });
          const response = await fetch(`/api/wiki_cache?${urlParams.toString()}`);

          if (response.ok) {
            const cachedData = await response.json();
            if (cachedData && cachedData.wiki_structure && cachedData.generated_pages && Object.keys(cachedData.generated_pages).length > 0) {
              console.log('Using server-cached wiki data');
              if (cachedData.model) {
                setSelectedModelState(cachedData.model);
              }
              if (cachedData.provider) {
                setSelectedProviderState(cachedData.provider);
              }
              if (cachedData.template) {
                setSelectedTemplate(cachedData.template);
              }

              if (cachedData.repo) {
                setEffectiveRepoInfo(cachedData.repo);
              } else if (cachedData.repo_url && !effectiveRepoInfo.repoUrl) {
                const updatedRepoInfo = { ...effectiveRepoInfo, repoUrl: cachedData.repo_url };
                setEffectiveRepoInfo(updatedRepoInfo);
                console.log('Using cached repo_url:', cachedData.repo_url);
              }

              const cachedStructure = {
                ...cachedData.wiki_structure,
                sections: cachedData.wiki_structure.sections || [],
                rootSections: cachedData.wiki_structure.rootSections || []
              };

              if (!cachedStructure.sections.length || !cachedStructure.rootSections.length) {
                const { sections, rootSections } = buildSectionsFromPages(cachedStructure.pages);
                cachedStructure.sections = sections;
                cachedStructure.rootSections = rootSections;
              }

              setWikiStructure(cachedStructure);
              setGeneratedPages(cachedData.generated_pages);
              setCurrentPageId(cachedStructure.pages.length > 0 ? cachedStructure.pages[0].id : undefined);
              if (cachedData.generated_at) {
                setGeneratedAt(cachedData.generated_at);
              }
              if (cachedData.commit_sha) {
                setCachedCommitSha(cachedData.commit_sha);
              }
              setIsLoading(false);
              setEmbeddingError(false);
              setLoadingMessage(undefined);
              cacheLoadedSuccessfully.current = true;
              return;
            } else {
              console.log('No valid wiki data in server cache or cache is empty.');
            }
          } else {
            console.error('Error fetching wiki cache from server:', response.status, await response.text());
          }
        } catch (cacheError) {
          console.error('Error loading from server cache:', cacheError);
        }

        fetchRepositoryStructure();
      };

      loadData();
    } else {
      console.log('Skipping duplicate repository fetch/cache check');
    }
  }, [effectiveRepoInfo, effectiveRepoInfo.owner, effectiveRepoInfo.repo, effectiveRepoInfo.type, language, fetchRepositoryStructure, messages.loading?.fetchingCache, isComprehensiveView, setIsLoading, setLoadingMessage, setEmbeddingError, setWikiStructure, setGeneratedPages, setCurrentPageId, setGeneratedAt, setCachedCommitSha, setSelectedModelState, setSelectedProviderState, setEffectiveRepoInfo, buildSectionsFromPages]);

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
            let commitSha: string | null = null;
            if (effectiveRepoInfo.type !== 'local') {
              try {
                if (effectiveRepoInfo.type === 'github') {
                  const ghApiBase = (() => {
                    if (!effectiveRepoInfo.repoUrl) return 'https://api.github.com';
                    try {
                      const u = new URL(effectiveRepoInfo.repoUrl);
                      return u.hostname === 'github.com' ? 'https://api.github.com' : `${u.protocol}//${u.hostname}/api/v3`;
                    } catch { return 'https://api.github.com'; }
                  })();
                  const commitRes = await fetch(`${ghApiBase}/repos/${effectiveRepoInfo.owner}/${effectiveRepoInfo.repo}/commits?per_page=1`, {
                    headers: createGithubHeaders(currentToken)
                  });
                  if (commitRes.ok) {
                    const commits = await commitRes.json();
                    if (Array.isArray(commits) && commits.length > 0) {
                      commitSha = commits[0].sha;
                    }
                  }
                } else if (effectiveRepoInfo.type === 'gitlab') {
                  const projectPath = extractUrlPath(effectiveRepoInfo.repoUrl ?? '')?.replace(/\.git$/, '') || `${effectiveRepoInfo.owner}/${effectiveRepoInfo.repo}`;
                  const projectDomain = extractUrlDomain(effectiveRepoInfo.repoUrl ?? 'https://gitlab.com');
                  const encodedPath = encodeURIComponent(projectPath);
                  const glBase = (() => { try { return new URL(projectDomain ?? '').origin; } catch { return 'https://gitlab.com'; } })();
                  const commitRes = await fetch(`${glBase}/api/v4/projects/${encodedPath}/repository/commits?per_page=1`, {
                    headers: createGitlabHeaders(currentToken)
                  });
                  if (commitRes.ok) {
                    const commits = await commitRes.json();
                    if (Array.isArray(commits) && commits.length > 0) {
                      commitSha = commits[0].id;
                    }
                  }
                } else if (effectiveRepoInfo.type === 'bitbucket') {
                  const repoPath = extractUrlPath(effectiveRepoInfo.repoUrl ?? '') ?? `${effectiveRepoInfo.owner}/${effectiveRepoInfo.repo}`;
                  const commitRes = await fetch(`https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(repoPath)}/commits?pagelen=1`, {
                    headers: createBitbucketHeaders(currentToken)
                  });
                  if (commitRes.ok) {
                    const data = await commitRes.json();
                    if (data.values && data.values.length > 0) {
                      commitSha = data.values[0].hash;
                    }
                  }
                }
              } catch (err) {
                console.warn('Could not fetch commit SHA for cache freshness:', err);
              }
            }
            if (commitSha) {
              setCachedCommitSha(commitSha);
              setFreshnessStatus('up-to-date');
            }

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
              template: selectedTemplate || 'comprehensive',
              generated_at: new Date().toISOString(),
              ...(commitSha ? { commit_sha: commitSha } : {}),
            };
            const response = await fetch(`/api/wiki_cache`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(dataToCache),
            });

            if (response.ok) {
              console.log('Wiki data successfully saved to server cache');
            } else {
              console.error('Error saving wiki data to server cache:', response.status, await response.text());
            }
          } catch (saveError) {
            console.error('Error saving to server cache:', saveError);
          }
        }
      }
    };

    saveCache();
  }, [isLoading, error, wikiStructure, generatedPages, effectiveRepoInfo.owner, effectiveRepoInfo.repo, effectiveRepoInfo.type, effectiveRepoInfo.repoUrl, language, isComprehensiveView, effectiveRepoInfo, currentToken, setCachedCommitSha, setFreshnessStatus, selectedProviderState, selectedModelState, selectedTemplate]);

  // Check wiki freshness against the repo's latest commit when loaded from cache
  useEffect(() => {
    if (!cachedCommitSha || !cacheLoadedSuccessfully.current || effectiveRepoInfo.type === 'local') return;
    let cancelled = false;

    const checkFreshness = async () => {
      setFreshnessStatus('checking');
      try {
        let latestSha: string | null = null;

        if (effectiveRepoInfo.type === 'github') {
          const ghApiBase = (() => {
            if (!effectiveRepoInfo.repoUrl) return 'https://api.github.com';
            try {
              const u = new URL(effectiveRepoInfo.repoUrl);
              return u.hostname === 'github.com' ? 'https://api.github.com' : `${u.protocol}//${u.hostname}/api/v3`;
            } catch { return 'https://api.github.com'; }
          })();
          const res = await fetch(`${ghApiBase}/repos/${effectiveRepoInfo.owner}/${effectiveRepoInfo.repo}/commits?per_page=1`, {
            headers: createGithubHeaders(currentToken)
          });
          if (res.ok) {
            const commits = await res.json();
            if (Array.isArray(commits) && commits.length > 0) latestSha = commits[0].sha;
          }
        } else if (effectiveRepoInfo.type === 'gitlab') {
          const projectPath = extractUrlPath(effectiveRepoInfo.repoUrl ?? '')?.replace(/\.git$/, '') || `${effectiveRepoInfo.owner}/${effectiveRepoInfo.repo}`;
          const projectDomain = extractUrlDomain(effectiveRepoInfo.repoUrl ?? 'https://gitlab.com');
          const encodedPath = encodeURIComponent(projectPath);
          const glBase = (() => { try { return new URL(projectDomain ?? '').origin; } catch { return 'https://gitlab.com'; } })();
          const res = await fetch(`${glBase}/api/v4/projects/${encodedPath}/repository/commits?per_page=1`, {
            headers: createGitlabHeaders(currentToken)
          });
          if (res.ok) {
            const commits = await res.json();
            if (Array.isArray(commits) && commits.length > 0) latestSha = commits[0].id;
          }
        } else if (effectiveRepoInfo.type === 'bitbucket') {
          const repoPath = extractUrlPath(effectiveRepoInfo.repoUrl ?? '') ?? `${effectiveRepoInfo.owner}/${effectiveRepoInfo.repo}`;
          const res = await fetch(`https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(repoPath)}/commits?pagelen=1`, {
            headers: createBitbucketHeaders(currentToken)
          });
          if (res.ok) {
            const data = await res.json();
            if (data.values && data.values.length > 0) latestSha = data.values[0].hash;
          }
        }

        if (cancelled) return;

        if (!latestSha) {
          setFreshnessStatus('unknown');
        } else if (latestSha === cachedCommitSha) {
          setFreshnessStatus('up-to-date');
        } else {
          setFreshnessStatus('outdated');
        }
      } catch (err) {
        console.warn('Freshness check failed:', err);
        if (!cancelled) setFreshnessStatus('unknown');
      }
    };

    checkFreshness();
    return () => { cancelled = true; };
  }, [cachedCommitSha, effectiveRepoInfo.type, effectiveRepoInfo.owner, effectiveRepoInfo.repo, effectiveRepoInfo.repoUrl, currentToken, setFreshnessStatus]);

}
