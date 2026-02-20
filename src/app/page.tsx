'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { FaWikipediaW, FaGithub, FaTwitter } from 'react-icons/fa';
import ThemeToggle from '@/components/theme-toggle';
import Mermaid from '../components/Mermaid';
import ConfigurationModal from '@/components/ConfigurationModal';
import ProcessedProjects from '@/components/ProcessedProjects';
import { extractUrlPath, extractUrlDomain } from '@/utils/urlDecoder';
import { useProcessedProjects } from '@/hooks/useProcessedProjects';

import { useLanguage } from '@/contexts/LanguageContext';

// Landing page sections
import HowItWorks from '@/components/landing/HowItWorks';
import FeatureCards from '@/components/landing/FeatureCards';
import ComparisonTable from '@/components/landing/ComparisonTable';
import CommunitySection from '@/components/landing/CommunitySection';
import FooterCTA from '@/components/landing/FooterCTA';
import SectionDivider from '@/components/landing/SectionDivider';
import ScrollAnimationProvider from '@/components/landing/ScrollAnimationProvider';
import FloatingElements from '@/components/landing/FloatingElements';

// Dynamically import Hero3D to avoid SSR issues with Three.js
const Hero3D = dynamic(() => import('@/components/landing/Hero3D'), { ssr: false });

// Define the demo mermaid charts outside the component
const DEMO_FLOW_CHART = `graph TD
  A[Code Repository] --> B[BetterCodeWiki]
  B --> C[Architecture Diagrams]
  B --> D[Component Relationships]
  B --> E[Data Flow]
  B --> F[Process Workflows]

  style A fill:#f9d3a9,stroke:#d86c1f
  style B fill:#d4a9f9,stroke:#6c1fd8
  style C fill:#a9f9d3,stroke:#1fd86c
  style D fill:#a9d3f9,stroke:#1f6cd8
  style E fill:#f9a9d3,stroke:#d81f6c
  style F fill:#d3f9a9,stroke:#6cd81f`;

const DEMO_SEQUENCE_CHART = `sequenceDiagram
  participant User
  participant BetterCodeWiki
  participant GitHub

  User->>BetterCodeWiki: Enter repository URL
  BetterCodeWiki->>GitHub: Request repository data
  GitHub-->>BetterCodeWiki: Return repository data
  BetterCodeWiki->>BetterCodeWiki: Process and analyze code
  BetterCodeWiki-->>User: Display wiki with diagrams

  %% Add a note to make text more visible
  Note over User,GitHub: BetterCodeWiki supports sequence diagrams for visualizing interactions`;

export default function Home() {
  const router = useRouter();
  const { language, setLanguage, messages, supportedLanguages } = useLanguage();
  const { projects, isLoading: projectsLoading } = useProcessedProjects();

  // Create a simple translation function
  const t = (key: string, params: Record<string, string | number> = {}): string => {
    // Split the key by dots to access nested properties
    const keys = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = messages;

    // Navigate through the nested properties
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Return the key if the translation is not found
        return key;
      }
    }

    // If the value is a string, replace parameters
    if (typeof value === 'string') {
      return Object.entries(params).reduce((acc: string, [paramKey, paramValue]) => {
        return acc.replace(`{${paramKey}}`, String(paramValue));
      }, value);
    }

    // Return the key if the value is not a string
    return key;
  };

  const [repositoryInput, setRepositoryInput] = useState('https://github.com/REDFOX1899/BetterCodeWiki');

  const REPO_CONFIG_CACHE_KEY = 'deepwikiRepoConfigCache';

  const loadConfigFromCache = (repoUrl: string) => {
    if (!repoUrl) return;
    try {
      const cachedConfigs = localStorage.getItem(REPO_CONFIG_CACHE_KEY);
      if (cachedConfigs) {
        const configs = JSON.parse(cachedConfigs);
        const config = configs[repoUrl.trim()];
        if (config) {
          setSelectedLanguage(config.selectedLanguage || language);
          setIsComprehensiveView(config.isComprehensiveView === undefined ? true : config.isComprehensiveView);
          setProvider(config.provider || '');
          setModel(config.model || '');
          setIsCustomModel(config.isCustomModel || false);
          setCustomModel(config.customModel || '');
          setSelectedPlatform(config.selectedPlatform || 'github');
          setExcludedDirs(config.excludedDirs || '');
          setExcludedFiles(config.excludedFiles || '');
          setIncludedDirs(config.includedDirs || '');
          setIncludedFiles(config.includedFiles || '');
        }
      }
    } catch (error) {
      console.error('Error loading config from localStorage:', error);
    }
  };

  const handleRepositoryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRepoUrl = e.target.value;
    setRepositoryInput(newRepoUrl);
    if (newRepoUrl.trim() === "") {
      // Optionally reset fields if input is cleared
    } else {
      loadConfigFromCache(newRepoUrl);
    }
  };

  useEffect(() => {
    if (repositoryInput) {
      loadConfigFromCache(repositoryInput);
    }
  }, []);

  // Provider-based model selection state
  const [provider, setProvider] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [customModel, setCustomModel] = useState<string>('');

  // Wiki type state - default to comprehensive view
  const [isComprehensiveView, setIsComprehensiveView] = useState<boolean>(true);

  const [excludedDirs, setExcludedDirs] = useState('');
  const [excludedFiles, setExcludedFiles] = useState('');
  const [includedDirs, setIncludedDirs] = useState('');
  const [includedFiles, setIncludedFiles] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'github' | 'gitlab' | 'bitbucket'>('github');
  const [accessToken, setAccessToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(language);

  // Authentication state
  const [authRequired, setAuthRequired] = useState<boolean>(false);
  const [authCode, setAuthCode] = useState<string>('');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Scroll-aware nav state
  const [isScrolled, setIsScrolled] = useState(false);

  // Sync the language context with the selectedLanguage state
  useEffect(() => {
    setLanguage(selectedLanguage);
  }, [selectedLanguage, setLanguage]);

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

  // Scroll listener for nav transparency
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Parse repository URL/input and extract owner and repo
  const parseRepositoryInput = (input: string): {
    owner: string,
    repo: string,
    type: string,
    fullPath?: string,
    localPath?: string
  } | null => {
    input = input.trim();

    let owner = '', repo = '', type = 'github', fullPath;
    let localPath: string | undefined;

    // Handle Windows absolute paths (e.g., C:\path\to\folder)
    const windowsPathRegex = /^[a-zA-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/;
    const customGitRegex = /^(?:https?:\/\/)?([^\/]+)\/(.+?)\/([^\/]+)(?:\.git)?\/?$/;

    if (windowsPathRegex.test(input)) {
      type = 'local';
      localPath = input;
      repo = input.split('\\').pop() || 'local-repo';
      owner = 'local';
    }
    // Handle Unix/Linux absolute paths (e.g., /path/to/folder)
    else if (input.startsWith('/')) {
      type = 'local';
      localPath = input;
      repo = input.split('/').filter(Boolean).pop() || 'local-repo';
      owner = 'local';
    }
    else if (customGitRegex.test(input)) {
      // Detect repository type based on domain
      const domain = extractUrlDomain(input);
      if (domain?.includes('github.com')) {
        type = 'github';
      } else if (domain?.includes('gitlab.com') || domain?.includes('gitlab.')) {
        type = 'gitlab';
      } else if (domain?.includes('bitbucket.org') || domain?.includes('bitbucket.')) {
        type = 'bitbucket';
      } else {
        type = 'web'; // fallback for other git hosting services
      }

      fullPath = extractUrlPath(input)?.replace(/\.git$/, '');
      const parts = fullPath?.split('/') ?? [];
      if (parts.length >= 2) {
        repo = parts[parts.length - 1] || '';
        owner = parts[parts.length - 2] || '';
      }
    }
    // Unsupported URL formats
    else {
      console.error('Unsupported URL format:', input);
      return null;
    }

    if (!owner || !repo) {
      return null;
    }

    // Clean values
    owner = owner.trim();
    repo = repo.trim();

    // Remove .git suffix if present
    if (repo.endsWith('.git')) {
      repo = repo.slice(0, -4);
    }

    return { owner, repo, type, fullPath, localPath };
  };

  // State for configuration modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse repository input to validate
    const parsedRepo = parseRepositoryInput(repositoryInput);

    if (!parsedRepo) {
      setError('Invalid repository format. Use "owner/repo", GitHub/GitLab/BitBucket URL, or a local folder path like "/path/to/folder" or "C:\\path\\to\\folder".');
      return;
    }

    // If valid, open the configuration modal
    setError(null);
    setIsConfigModalOpen(true);
  };

  const validateAuthCode = async () => {
    try {
      if (authRequired) {
        if (!authCode) {
          return false;
        }
        const response = await fetch('/api/auth/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 'code': authCode })
        });
        if (!response.ok) {
          return false;
        }
        const data = await response.json();
        return data.success || false;
      }
    } catch {
      return false;
    }
    return true;
  };

  const handleGenerateWiki = async () => {

    // Check authorization code
    const validation = await validateAuthCode();
    if (!validation) {
      setError(`Failed to validate the authorization code`);
      console.error(`Failed to validate the authorization code`);
      setIsConfigModalOpen(false);
      return;
    }

    // Prevent multiple submissions
    if (isSubmitting) {
      console.log('Form submission already in progress, ignoring duplicate click');
      return;
    }

    try {
      const currentRepoUrl = repositoryInput.trim();
      if (currentRepoUrl) {
        const existingConfigs = JSON.parse(localStorage.getItem(REPO_CONFIG_CACHE_KEY) || '{}');
        const configToSave = {
          selectedLanguage,
          isComprehensiveView,
          provider,
          model,
          isCustomModel,
          customModel,
          selectedPlatform,
          excludedDirs,
          excludedFiles,
          includedDirs,
          includedFiles,
        };
        existingConfigs[currentRepoUrl] = configToSave;
        localStorage.setItem(REPO_CONFIG_CACHE_KEY, JSON.stringify(existingConfigs));
      }
    } catch (error) {
      console.error('Error saving config to localStorage:', error);
    }

    setIsSubmitting(true);

    // Parse repository input
    const parsedRepo = parseRepositoryInput(repositoryInput);

    if (!parsedRepo) {
      setError('Invalid repository format. Use "owner/repo", GitHub/GitLab/BitBucket URL, or a local folder path like "/path/to/folder" or "C:\\path\\to\\folder".');
      setIsSubmitting(false);
      return;
    }

    const { owner, repo, type, localPath } = parsedRepo;

    // Store tokens in query params if they exist
    const params = new URLSearchParams();
    if (accessToken) {
      params.append('token', accessToken);
    }
    // Always include the type parameter
    params.append('type', (type == 'local' ? type : selectedPlatform) || 'github');
    // Add local path if it exists
    if (localPath) {
      params.append('local_path', encodeURIComponent(localPath));
    } else {
      params.append('repo_url', encodeURIComponent(repositoryInput));
    }
    // Add model parameters
    params.append('provider', provider);
    params.append('model', model);
    if (isCustomModel && customModel) {
      params.append('custom_model', customModel);
    }
    // Add file filters configuration
    if (excludedDirs) {
      params.append('excluded_dirs', excludedDirs);
    }
    if (excludedFiles) {
      params.append('excluded_files', excludedFiles);
    }
    if (includedDirs) {
      params.append('included_dirs', includedDirs);
    }
    if (includedFiles) {
      params.append('included_files', includedFiles);
    }

    // Add language parameter
    params.append('language', selectedLanguage);

    // Add comprehensive parameter
    params.append('comprehensive', isComprehensiveView.toString());

    const queryString = params.toString() ? `?${params.toString()}` : '';

    // Navigate to the dynamic route
    router.push(`/${owner}/${repo}${queryString}`);

    // The isSubmitting state will be reset when the component unmounts during navigation
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ===== Floating Decorative Elements (fixed background layer) ===== */}
      <FloatingElements />

      {/* ===== Scroll-Aware Navigation Bar ===== */}
      <nav
        className={`sticky top-0 z-50 h-16 transition-all duration-300 ${
          isScrolled
            ? 'bg-background/80 backdrop-blur-md border-b border-border'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          {/* Left: Logo + App Name */}
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl elevation-1">
              <FaWikipediaW className="text-lg text-primary-foreground" />
            </div>
            <span className="text-title-md text-foreground" style={{ fontFamily: 'var(--font-display), var(--font-sans), sans-serif' }}>
              {t('common.appName')}
            </span>
          </div>

          {/* Center: Wiki Projects Link */}
          <div className="hidden md:flex items-center">
            <Link
              href="/wiki/projects"
              className="text-label-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('nav.wikiProjects')}
            </Link>
          </div>

          {/* Right: Theme Toggle + GitHub Link */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="https://github.com/REDFOX1899/BetterCodeWiki"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="GitHub Repository"
            >
              <FaGithub className="text-lg" />
            </a>
          </div>
        </div>
      </nav>

      <ScrollAnimationProvider>
        {/* ===== Hero Section with 3D ===== */}
        <Hero3D
          value={repositoryInput}
          onChange={handleRepositoryInputChange}
          onSubmit={handleFormSubmit}
          isSubmitting={isSubmitting}
        />

        {/* Error display for form validation */}
        {error && (
          <div className="max-w-2xl mx-auto px-6 -mt-8 mb-8">
            <div className="text-destructive text-body-sm font-medium text-left bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              {error}
            </div>
          </div>
        )}

        {/* ===== Configuration Modal ===== */}
        <ConfigurationModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          repositoryInput={repositoryInput}
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
          supportedLanguages={supportedLanguages}
          isComprehensiveView={isComprehensiveView}
          setIsComprehensiveView={setIsComprehensiveView}
          provider={provider}
          setProvider={setProvider}
          model={model}
          setModel={setModel}
          isCustomModel={isCustomModel}
          setIsCustomModel={setIsCustomModel}
          customModel={customModel}
          setCustomModel={setCustomModel}
          selectedPlatform={selectedPlatform}
          setSelectedPlatform={setSelectedPlatform}
          accessToken={accessToken}
          setAccessToken={setAccessToken}
          excludedDirs={excludedDirs}
          setExcludedDirs={setExcludedDirs}
          excludedFiles={excludedFiles}
          setExcludedFiles={setExcludedFiles}
          includedDirs={includedDirs}
          setIncludedDirs={setIncludedDirs}
          includedFiles={includedFiles}
          setIncludedFiles={setIncludedFiles}
          onSubmit={handleGenerateWiki}
          isSubmitting={isSubmitting}
          authRequired={authRequired}
          authCode={authCode}
          setAuthCode={setAuthCode}
          isAuthLoading={isAuthLoading}
        />

        {/* ===== Processed Projects (if they exist) ===== */}
        {!projectsLoading && projects.length > 0 && (
          <section className="max-w-6xl mx-auto w-full px-6 py-12">
            <div className="w-full space-y-8">
              <div className="flex flex-col sm:flex-row items-center justify-between pb-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <FaWikipediaW className="text-xl text-primary" />
                  </div>
                  <div>
                    <h2 className="text-headline-md text-foreground">{t('projects.existingProjects')}</h2>
                    <p className="text-muted-foreground text-body-sm">{t('projects.browseExisting')}</p>
                  </div>
                </div>
              </div>

              <ProcessedProjects
                showHeader={false}
                maxItems={9}
                messages={messages}
                className="w-full"
              />
            </div>
          </section>
        )}

        {/* ===== Quick Start & Diagram Section ===== */}
        <section className="max-w-6xl mx-auto w-full px-6 py-12">
          <div className="space-y-16">
            {/* Quick Start Cards */}
            <div className="bg-card rounded-xl border border-border p-8 elevation-1">
              <h3 className="text-title-lg text-foreground mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t('home.quickStart')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  'https://github.com/REDFOX1899/BetterCodeWiki',
                  'https://gitlab.com/gitlab-org/gitlab',
                  'REDFOX1899/BetterCodeWiki',
                  'https://bitbucket.org/atlassian/atlaskit'
                ].map((url, index) => (
                  <motion.button
                    key={url}
                    type="button"
                    onClick={() => {
                      setRepositoryInput(url);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-4 py-3 bg-muted/50 rounded-lg border border-border/50 text-body-sm font-mono text-muted-foreground overflow-x-auto whitespace-nowrap hover:border-primary/50 hover:bg-primary/5 hover:text-foreground transition-all cursor-pointer text-left"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  >
                    {url}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Interaction Diagrams */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-headline-sm text-foreground">{t('home.advancedVisualization')}</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-xl border border-border p-5 elevation-1">
                  <h4 className="text-label-lg text-muted-foreground mb-4">{t('home.flowDiagram')}</h4>
                  <div className="overflow-hidden rounded-lg bg-background/50 border border-border/50">
                    <Mermaid chart={DEMO_FLOW_CHART} />
                  </div>
                </div>
                <div className="bg-card rounded-xl border border-border p-5 elevation-1">
                  <h4 className="text-label-lg text-muted-foreground mb-4">{t('home.sequenceDiagram')}</h4>
                  <div className="overflow-hidden rounded-lg bg-background/50 border border-border/50">
                    <Mermaid chart={DEMO_SEQUENCE_CHART} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SectionDivider variant="gradient-orb" direction="right" />

        {/* ===== How It Works ===== */}
        <HowItWorks />

        <SectionDivider variant="grid-fade" />

        {/* ===== Feature Cards ===== */}
        <FeatureCards />

        <SectionDivider variant="gradient-orb" direction="left" />

        {/* ===== Comparison Table ===== */}
        <ComparisonTable />

        <SectionDivider variant="dots" direction="center" />

        {/* ===== Community / Open Source ===== */}
        <CommunitySection stars={0} contributors={0} forks={0} />

        {/* ===== Footer CTA ===== */}
        <FooterCTA
          value={repositoryInput}
          onChange={handleRepositoryInputChange}
          onSubmit={handleFormSubmit}
          isSubmitting={isSubmitting}
        />

        {/* ===== Footer ===== */}
        <footer className="max-w-6xl mx-auto py-8 border-t border-border w-full px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>{t('footer.copyright')}</p>
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-5">
                <a href="https://github.com/REDFOX1899/BetterCodeWiki" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  <FaGithub className="text-lg" />
                </a>
                <a href="https://github.com/REDFOX1899/BetterCodeWiki" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  <FaTwitter className="text-lg" />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </ScrollAnimationProvider>
    </div>
  );
}
