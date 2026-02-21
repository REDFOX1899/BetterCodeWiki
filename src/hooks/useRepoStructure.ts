'use client';

import { useCallback, useState } from 'react';
import { WikiPage } from '@/types/wiki';
import { RepoInfo } from '@/types/repoinfo';
import { extractUrlPath, extractUrlDomain } from '@/utils/urlDecoder';
import { getCacheKey, createGithubHeaders, createGitlabHeaders, createBitbucketHeaders } from '@/utils/repoHeaders';

interface UseRepoStructureParams {
  owner: string;
  repo: string;
  effectiveRepoInfo: RepoInfo;
  currentToken: string;
  language: string;
  isComprehensiveView: boolean;
  // Model selection
  selectedProviderState: string;
  selectedModelState: string;
  isCustomSelectedModelState: boolean;
  customSelectedModelState: string;
  modelExcludedDirs: string;
  modelExcludedFiles: string;
  // Auth
  authRequired: boolean;
  authCode: string;
  // State setters
  setIsLoading: (v: boolean) => void;
  setLoadingMessage: (v: string | undefined) => void;
  setError: (v: string | null) => void;
  setEmbeddingError: (v: boolean) => void;
  setWikiStructure: (s: undefined) => void;
  setCurrentPageId: (id: undefined) => void;
  setGeneratedPages: (p: Record<string, WikiPage>) => void;
  setPagesInProgress: (s: Set<string>) => void;
  setDefaultBranch: (v: string) => void;
  setShowModelOptions: (v: boolean) => void;
  setCurrentToken: (v: string) => void;
  setCachedCommitSha: (v: string | null) => void;
  setFreshnessStatus: (v: 'checking' | 'up-to-date' | 'outdated' | 'unknown' | null) => void;
  setStructureRequestInProgress: (v: boolean) => void;
  setRequestInProgress: (v: boolean) => void;
  // Refs
  activeContentRequests: Map<string, boolean>;
  cacheLoadedSuccessfully: React.MutableRefObject<boolean>;
  effectRan: React.MutableRefObject<boolean>;
  // Dependent function
  determineWikiStructure: (fileTree: string, readme: string, owner: string, repo: string) => Promise<void>;
  // Messages
  messages: Record<string, Record<string, string> | undefined>;
}

interface UseRepoStructureReturn {
  requestInProgress: boolean;
  fetchRepositoryStructure: () => Promise<void>;
  confirmRefresh: (newToken?: string) => Promise<void>;
}

export function useRepoStructure(params: UseRepoStructureParams): UseRepoStructureReturn {
  const {
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
    setWikiStructure,
    setCurrentPageId,
    setGeneratedPages,
    setPagesInProgress,
    setDefaultBranch,
    setShowModelOptions,
    setCurrentToken,
    setCachedCommitSha,
    setFreshnessStatus,
    setStructureRequestInProgress,
    setRequestInProgress: setRequestInProgressExternal,
    activeContentRequests,
    cacheLoadedSuccessfully,
    effectRan,
    determineWikiStructure,
    messages,
  } = params;

  const [requestInProgress, setRequestInProgress] = useState(false);

  const fetchRepositoryStructure = useCallback(async () => {
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
    setEmbeddingError(false);

    try {
      setRequestInProgress(true);
      setRequestInProgressExternal(true);

      setIsLoading(true);
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
          setDefaultBranch('main');
        } catch (err) {
          throw err;
        }
      } else if (effectiveRepoInfo.type === 'github') {
        let treeData = null;
        let apiErrorDetails = '';

        const getGithubApiUrl = (repoUrl: string | null): string => {
          if (!repoUrl) return 'https://api.github.com';
          try {
            const url = new URL(repoUrl);
            const hostname = url.hostname;
            if (hostname === 'github.com') return 'https://api.github.com';
            return `${url.protocol}//${hostname}/api/v3`;
          } catch {
            return 'https://api.github.com';
          }
        };

        const githubApiBaseUrl = getGithubApiUrl(effectiveRepoInfo.repoUrl);

        let defaultBranchLocal = null;
        try {
          const repoInfoResponse = await fetch(`${githubApiBaseUrl}/repos/${owner}/${repo}`, {
            headers: createGithubHeaders(currentToken)
          });
          if (repoInfoResponse.ok) {
            const repoData = await repoInfoResponse.json();
            defaultBranchLocal = repoData.default_branch;
            console.log(`Found default branch: ${defaultBranchLocal}`);
            setDefaultBranch(defaultBranchLocal || 'main');
          }
        } catch (err) {
          console.warn('Could not fetch repository info for default branch:', err);
        }

        const branchesToTry = defaultBranchLocal
          ? [defaultBranchLocal, 'main', 'master'].filter((branch, index, arr) => arr.indexOf(branch) === index)
          : ['main', 'master'];

        for (const branch of branchesToTry) {
          const apiUrl = `${githubApiBaseUrl}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
          const headers = createGithubHeaders(currentToken);
          console.log(`Fetching repository structure from branch: ${branch}`);
          try {
            const response = await fetch(apiUrl, { headers });
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

        fileTreeData = treeData.tree
          .filter((item: { type: string; path: string }) => item.type === 'blob')
          .map((item: { type: string; path: string }) => item.path)
          .join('\n');

        try {
          const headers = createGithubHeaders(currentToken);
          const readmeResponse = await fetch(`${githubApiBaseUrl}/repos/${owner}/${repo}/readme`, { headers });
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
        const projectPath = extractUrlPath(effectiveRepoInfo.repoUrl ?? '')?.replace(/\.git$/, '') || `${owner}/${repo}`;
        const projectDomain = extractUrlDomain(effectiveRepoInfo.repoUrl ?? "https://gitlab.com");
        const encodedProjectPath = encodeURIComponent(projectPath);
        const headers = createGitlabHeaders(currentToken);
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        const filesData: any[] = [];

        try {
          let projectInfoUrl: string;
          let defaultBranchLocal = 'main';
          try {
            const validatedUrl = new URL(projectDomain ?? '');
            projectInfoUrl = `${validatedUrl.origin}/api/v4/projects/${encodedProjectPath}`;
          } catch {
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
          setDefaultBranch(defaultBranchLocal);

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

          fileTreeData = filesData
            .filter((item: { type: string; path: string }) => item.type === 'blob')
            .map((item: { type: string; path: string }) => item.path)
            .join('\n');

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
        const repoPath = extractUrlPath(effectiveRepoInfo.repoUrl ?? '') ?? `${owner}/${repo}`;
        const encodedRepoPath = encodeURIComponent(repoPath);

        let filesData = null;
        let apiErrorDetails = '';
        let defaultBranchLocal = '';
        const headers = createBitbucketHeaders(currentToken);

        const projectInfoUrl = `https://api.bitbucket.org/2.0/repositories/${encodedRepoPath}`;
        try {
          const response = await fetch(projectInfoUrl, { headers });
          const responseText = await response.text();

          if (response.ok) {
            const projectData = JSON.parse(responseText);
            defaultBranchLocal = projectData.mainbranch.name;
            setDefaultBranch(defaultBranchLocal);

            const apiUrl = `https://api.bitbucket.org/2.0/repositories/${encodedRepoPath}/src/${defaultBranchLocal}/?recursive=true&per_page=100`;
            try {
              const response = await fetch(apiUrl, { headers });
              const structureResponseText = await response.text();
              if (response.ok) {
                filesData = JSON.parse(structureResponseText);
              } else {
                apiErrorDetails = `Status: ${response.status}, Response: ${structureResponseText}`;
              }
            } catch (err) {
              console.error(`Network error fetching Bitbucket branch ${defaultBranchLocal}:`, err);
            }
          } else {
            apiErrorDetails = `Status: ${response.status}, Response: ${responseText}`;
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

        fileTreeData = filesData.values
          .filter((item: { type: string; path: string }) => item.type === 'commit_file')
          .map((item: { type: string; path: string }) => item.path)
          .join('\n');

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

      await determineWikiStructure(fileTreeData, readmeContent, owner, repo);

    } catch (fetchError) {
      console.error('Error fetching repository structure:', fetchError);
      setIsLoading(false);
      setError(fetchError instanceof Error ? fetchError.message : 'An unknown error occurred');
      setLoadingMessage(undefined);
    } finally {
      setRequestInProgress(false);
      setRequestInProgressExternal(false);
    }
  }, [owner, repo, determineWikiStructure, currentToken, effectiveRepoInfo, requestInProgress, messages.loading, setIsLoading, setLoadingMessage, setError, setEmbeddingError, setWikiStructure, setCurrentPageId, setGeneratedPages, setPagesInProgress, setDefaultBranch, setRequestInProgressExternal]);

  const confirmRefresh = useCallback(async (newToken?: string) => {
    setShowModelOptions(false);
    setLoadingMessage(messages.loading?.clearingCache || 'Clearing server cache...');
    setIsLoading(true);

    try {
      const urlParams = new URLSearchParams({
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

      if (modelExcludedDirs) {
        urlParams.append('excluded_dirs', modelExcludedDirs);
      }
      if (modelExcludedFiles) {
        urlParams.append('excluded_files', modelExcludedFiles);
      }

      if (authRequired && !authCode) {
        setIsLoading(false);
        console.error("Authorization code is required");
        setError('Authorization code is required');
        return;
      }

      const response = await fetch(`/api/wiki_cache?${urlParams.toString()}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        console.log('Server-side wiki cache cleared successfully.');
      } else {
        const errorText = await response.text();
        console.warn(`Failed to clear server-side wiki cache (status: ${response.status}): ${errorText}. Proceeding with refresh anyway.`);
        if (response.status == 401) {
          setIsLoading(false);
          setLoadingMessage(undefined);
          setError('Failed to validate the authorization code');
          console.error('Failed to validate the authorization code');
          return;
        }
      }
    } catch (err) {
      console.warn('Error calling DELETE /api/wiki_cache:', err);
      setIsLoading(false);
      setEmbeddingError(false);
      throw err;
    }

    if (newToken) {
      setCurrentToken(newToken);
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('token', newToken);
      window.history.replaceState({}, '', currentUrl.toString());
    }

    console.log('Refreshing wiki. Server cache will be overwritten upon new generation if not cleared.');

    const localStorageCacheKey = getCacheKey(effectiveRepoInfo.owner, effectiveRepoInfo.repo, effectiveRepoInfo.type, language, isComprehensiveView);
    localStorage.removeItem(localStorageCacheKey);

    cacheLoadedSuccessfully.current = false;
    effectRan.current = false;

    setWikiStructure(undefined);
    setCurrentPageId(undefined);
    setGeneratedPages({});
    setPagesInProgress(new Set());
    setError(null);
    setEmbeddingError(false);
    setCachedCommitSha(null);
    setFreshnessStatus(null);
    setIsLoading(true);
    setLoadingMessage(messages.loading?.initializing || 'Initializing wiki generation...');

    activeContentRequests.clear();
    setStructureRequestInProgress(false);
    setRequestInProgress(false);
    setRequestInProgressExternal(false);
  }, [effectiveRepoInfo, language, messages.loading, activeContentRequests, selectedProviderState, selectedModelState, isCustomSelectedModelState, customSelectedModelState, modelExcludedDirs, modelExcludedFiles, isComprehensiveView, authCode, authRequired, setIsLoading, setLoadingMessage, setError, setEmbeddingError, setWikiStructure, setCurrentPageId, setGeneratedPages, setPagesInProgress, setShowModelOptions, setCurrentToken, setCachedCommitSha, setFreshnessStatus, setStructureRequestInProgress, setRequestInProgressExternal, cacheLoadedSuccessfully, effectRan]);

  return { requestInProgress, fetchRepositoryStructure, confirmRefresh };
}
