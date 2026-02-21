'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { wikiStyles } from '@/styles/wikiStyles';
import { WikiPage, WikiStructure } from '@/types/wiki';

const Markdown = dynamic(() => import('@/components/Markdown'), { ssr: false });

export default function EmbedPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const owner = params.owner as string;
  const repo = params.repo as string;
  const pageId = params.pageId as string;

  const themeParam = searchParams.get('theme'); // 'dark' | 'light' | null (auto)
  const hideFooter = searchParams.get('hide-footer') === 'true';
  const language = searchParams.get('language') || 'en';
  const repoType = searchParams.get('type') || 'github';

  const [page, setPage] = useState<WikiPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Apply theme override via class on document root
  useEffect(() => {
    if (themeParam === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else if (themeParam === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    // If no theme param, let system/default handle it
  }, [themeParam]);

  const fetchPage = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const cacheParams = new URLSearchParams({
        owner,
        repo,
        repo_type: repoType,
        language,
      });

      const response = await fetch(`/api/wiki_cache?${cacheParams.toString()}`);

      if (!response.ok) {
        setError('Wiki not found. Generate the wiki first.');
        return;
      }

      const data = await response.json();
      const wikiStructure = data.wiki_structure as WikiStructure | undefined;
      const generatedPages = data.generated_pages as Record<string, WikiPage> | undefined;

      if (!wikiStructure || !generatedPages) {
        setError('Wiki data is incomplete.');
        return;
      }

      const targetPage = generatedPages[pageId];
      if (!targetPage) {
        setError(`Page "${pageId}" not found in this wiki.`);
        return;
      }

      setPage(targetPage);
    } catch (err) {
      console.error('Embed fetch error:', err);
      setError('Failed to load wiki page.');
    } finally {
      setIsLoading(false);
    }
  }, [owner, repo, repoType, language, pageId]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <style>{wikiStyles}</style>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="w-2 h-2 bg-primary/70 rounded-full animate-pulse" />
          <div className="w-2 h-2 bg-primary/70 rounded-full animate-pulse [animation-delay:75ms]" />
          <div className="w-2 h-2 bg-primary/70 rounded-full animate-pulse [animation-delay:150ms]" />
          <span className="ml-1">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <style>{wikiStyles}</style>
        <div className="text-center max-w-md">
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <a
            href={`/${owner}/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            View full wiki
          </a>
        </div>
      </div>
    );
  }

  if (!page) return null;

  const fullWikiUrl = `/${owner}/${repo}`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <style>{wikiStyles}</style>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto w-full">
        <div className="mb-4 pb-4 border-b border-border">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
            {page.title}
          </h1>
          {page.importance && (
            <div className="mt-2">
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                  page.importance === 'high'
                    ? 'border-transparent bg-primary text-primary-foreground'
                    : page.importance === 'medium'
                      ? 'border-transparent bg-secondary text-secondary-foreground'
                      : 'border-transparent bg-muted text-muted-foreground'
                }`}
              >
                {page.importance.charAt(0).toUpperCase() + page.importance.slice(1)} Priority
              </span>
            </div>
          )}
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <Markdown content={page.content} />
        </div>
      </div>

      {/* Footer */}
      {!hideFooter && (
        <footer className="border-t border-border px-4 py-3 text-center">
          <a
            href={fullWikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            Powered by BetterCodeWiki
          </a>
        </footer>
      )}
    </div>
  );
}
