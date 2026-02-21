'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { X, LayoutGrid, List } from 'lucide-react';

// Interface should match the structure from the API
interface ProcessedProject {
  id: string;
  owner: string;
  repo: string;
  name: string;
  repo_type: string;
  submittedAt: number;
  language: string;
}

interface ProcessedProjectsProps {
  showHeader?: boolean;
  maxItems?: number;
  className?: string;
  messages?: Record<string, Record<string, string>>; // Translation messages with proper typing
}

export default function ProcessedProjects({
  showHeader = true,
  maxItems,
  className = "",
  messages
}: ProcessedProjectsProps) {
  const [projects, setProjects] = useState<ProcessedProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // Default messages fallback
  const defaultMessages = {
    title: 'Processed Wiki Projects',
    searchPlaceholder: 'Search projects by name, owner, or repository...',
    noProjects: 'No projects found in the server cache. The cache might be empty or the server encountered an issue.',
    noSearchResults: 'No projects match your search criteria.',
    processedOn: 'Processed on:',
    loadingProjects: 'Loading projects...',
    errorLoading: 'Error loading projects:',
    backToHome: 'Back to Home'
  };

  const t = (key: string) => {
    if (messages?.projects?.[key]) {
      return messages.projects[key];
    }
    return defaultMessages[key as keyof typeof defaultMessages] || key;
  };

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/wiki/projects');
        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setProjects(data as ProcessedProject[]);
      } catch (e: unknown) {
        console.error("Failed to load projects from API:", e);
        const message = e instanceof Error ? e.message : "An unknown error occurred.";
        setError(message);
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return maxItems ? projects.slice(0, maxItems) : projects;
    }

    const query = searchQuery.toLowerCase();
    const filtered = projects.filter(project =>
      project.name.toLowerCase().includes(query) ||
      project.owner.toLowerCase().includes(query) ||
      project.repo.toLowerCase().includes(query) ||
      project.repo_type.toLowerCase().includes(query)
    );

    return maxItems ? filtered.slice(0, maxItems) : filtered;
  }, [projects, searchQuery, maxItems]);

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handleDelete = async (project: ProcessedProject) => {
    if (!confirm(`Are you sure you want to delete project ${project.name}?`)) {
      return;
    }
    try {
      const response = await fetch('/api/wiki/projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: project.owner,
          repo: project.repo,
          repo_type: project.repo_type,
          language: project.language,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorBody.error || response.statusText);
      }
      setProjects(prev => prev.filter(p => p.id !== project.id));
    } catch (e: unknown) {
      console.error('Failed to delete project:', e);
      alert(`Failed to delete project: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  return (
    <div className={`${className} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      {showHeader && (
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t('backToHome')}
            </Link>
          </div>
        </header>
      )}

      {/* Search Bar and View Toggle */}
      <div className="mb-8 flex flex-col sm:flex-row gap-4">
        {/* Search Bar */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full px-4 py-2.5 pl-10 border border-input rounded-md bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="absolute left-3 top-3 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </div>
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-muted/50 border border-border rounded-md p-1">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 rounded-sm transition-all ${viewMode === 'card'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
              }`}
            title="Card View"
          >
            <LayoutGrid size={16} className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-sm transition-all ${viewMode === 'list'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
              }`}
            title="List View"
          >
            <List size={16} className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">{t('loadingProjects')}</p>}
      {error && <p className="text-destructive text-sm font-medium">{t('errorLoading')} {error}</p>}

      {!isLoading && !error && filteredProjects.length > 0 && (
        <div className={viewMode === 'card' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-2'}>
          {filteredProjects.map((project) => (
            viewMode === 'card' ? (
              <div key={project.id} className="group relative p-5 border border-border rounded-xl bg-card text-card-foreground shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(project);
                  }}
                  className="absolute top-4 right-4 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="Delete project"
                >
                  <X size={16} className="h-4 w-4" />
                </button>
                <Link
                  href={`/${project.owner}/${project.repo}?type=${project.repo_type}&language=${project.language}`}
                  className="block h-full flex flex-col"
                >
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-muted-foreground font-mono mt-1 truncate">
                      {project.owner}/{project.repo}
                    </p>
                  </div>

                  <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                    <div className="flex gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                        {project.repo_type}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                        {project.language}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(project.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </Link>
              </div>
            ) : (
              <div key={project.id} className="group relative p-3 border border-border rounded-lg bg-card hover:bg-muted/30 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0 pr-8">
                  <Link
                    href={`/${project.owner}/${project.repo}?type=${project.repo_type}&language=${project.language}`}
                    className="flex items-center gap-4 flex-1 min-w-0"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {project.owner}/{project.repo}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                        {project.repo_type}
                      </span>
                      <span className="text-xs text-muted-foreground w-20 text-right">
                        {new Date(project.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(project)}
                  className="text-muted-foreground/50 hover:text-destructive p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete project"
                >
                  <X size={16} className="h-4 w-4" />
                </button>
              </div>
            )
          ))}
        </div>
      )}

      {!isLoading && !error && projects.length > 0 && filteredProjects.length === 0 && searchQuery && (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">{t('noSearchResults')}</p>
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-lg bg-muted/10">
          <p className="text-muted-foreground">{t('noProjects')}</p>
        </div>
      )}
    </div>
  );
}
