'use client';

import { useCallback, useState } from 'react';
import { WikiStructure, WikiPage } from '@/types/wiki';
import { RepoInfo } from '@/types/repoinfo';
import getRepoUrl from '@/utils/getRepoUrl';

interface UseWikiExportParams {
  wikiStructure: WikiStructure | undefined;
  generatedPages: Record<string, WikiPage>;
  effectiveRepoInfo: RepoInfo;
}

interface UseWikiExportReturn {
  isExporting: boolean;
  exportError: string | null;
  exportWiki: (format: 'markdown' | 'json') => Promise<void>;
}

export function useWikiExport({
  wikiStructure,
  generatedPages,
  effectiveRepoInfo,
}: UseWikiExportParams): UseWikiExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportWiki = useCallback(async (format: 'markdown' | 'json') => {
    if (!wikiStructure || Object.keys(generatedPages).length === 0) {
      setExportError('No wiki content to export');
      return;
    }

    try {
      setIsExporting(true);
      setExportError(null);

      const pagesToExport = wikiStructure.pages.map(page => {
        const content = generatedPages[page.id]?.content || 'Content not generated';
        return { ...page, content };
      });

      const repoUrl = getRepoUrl(effectiveRepoInfo);

      const response = await fetch(`/export/wiki`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${effectiveRepoInfo.repo}_wiki.${format === 'markdown' ? 'md' : 'json'}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }

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
    }
  }, [wikiStructure, generatedPages, effectiveRepoInfo]);

  return { isExporting, exportError, exportWiki };
}
