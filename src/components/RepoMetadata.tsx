'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, Github, Gitlab, Star, GitFork } from 'lucide-react';

// Bitbucket icon (lucide-react does not include one)
const BitbucketIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.89H.778zM14.52 15.53H9.522L8.17 8.466h7.561l-1.211 7.064z"/>
  </svg>
);

interface RepoMetadataProps {
  repoInfo: {
    owner: string;
    repo: string;
    type: string;
    token?: string | null;
  };
}

interface RepoMetadataData {
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  url: string;
}

function formatCount(n: number): string {
  if (n >= 1000000) {
    const val = n / 1000000;
    return val % 1 === 0 ? `${val}m` : `${val.toFixed(1)}m`;
  }
  if (n >= 1000) {
    const val = n / 1000;
    // Show one decimal place only if it's meaningful (e.g., 1.5k but not 1.0k)
    return val >= 10
      ? `${Math.round(val)}k`
      : val % 1 === 0
        ? `${val}k`
        : `${val.toFixed(1)}k`;
  }
  return String(n);
}

function getPlatformLabel(type: string): string {
  switch (type) {
    case 'github': return 'GitHub';
    case 'gitlab': return 'GitLab';
    case 'bitbucket': return 'Bitbucket';
    default: return 'Repository';
  }
}

function getPlatformIcon(type: string) {
  switch (type) {
    case 'github': return <Github size={12} className="h-3 w-3" />;
    case 'gitlab': return <Gitlab size={12} className="h-3 w-3" />;
    case 'bitbucket': return <BitbucketIcon className="h-3 w-3" />;
    default: return null;
  }
}

export default function RepoMetadata({ repoInfo }: RepoMetadataProps) {
  const [metadata, setMetadata] = useState<RepoMetadataData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetadata() {
      setIsLoading(true);
      setHasError(false);

      try {
        let url: string;
        const headers: Record<string, string> = {
          'Accept': 'application/json',
        };

        if (repoInfo.token) {
          if (repoInfo.type === 'github') {
            headers['Authorization'] = `Bearer ${repoInfo.token}`;
          } else if (repoInfo.type === 'gitlab') {
            headers['PRIVATE-TOKEN'] = repoInfo.token;
          } else if (repoInfo.type === 'bitbucket') {
            headers['Authorization'] = `Bearer ${repoInfo.token}`;
          }
        }

        switch (repoInfo.type) {
          case 'github':
            url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`;
            break;
          case 'gitlab':
            url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`)}`;
            break;
          case 'bitbucket':
            url = `https://api.bitbucket.org/2.0/repositories/${repoInfo.owner}/${repoInfo.repo}`;
            break;
          default:
            setIsLoading(false);
            setHasError(true);
            return;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (cancelled) return;

        let parsed: RepoMetadataData;

        switch (repoInfo.type) {
          case 'github':
            parsed = {
              description: data.description || null,
              stars: data.stargazers_count ?? 0,
              forks: data.forks_count ?? 0,
              language: data.language || null,
              url: data.html_url || `https://github.com/${repoInfo.owner}/${repoInfo.repo}`,
            };
            break;
          case 'gitlab':
            parsed = {
              description: data.description || null,
              stars: data.star_count ?? 0,
              forks: data.forks_count ?? 0,
              language: null, // GitLab doesn't return primary language from this endpoint
              url: data.web_url || `https://gitlab.com/${repoInfo.owner}/${repoInfo.repo}`,
            };
            break;
          case 'bitbucket':
            parsed = {
              description: data.description || null,
              stars: 0, // Bitbucket doesn't have stars
              forks: 0,
              language: data.language || null,
              url: data.links?.html?.href || `https://bitbucket.org/${repoInfo.owner}/${repoInfo.repo}`,
            };
            break;
          default:
            throw new Error('Unknown platform');
        }

        setMetadata(parsed);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    }

    if (repoInfo.owner && repoInfo.repo && repoInfo.type && repoInfo.type !== 'local') {
      fetchMetadata();
    } else {
      setIsLoading(false);
      setHasError(true);
    }

    return () => {
      cancelled = true;
    };
  }, [repoInfo.owner, repoInfo.repo, repoInfo.type, repoInfo.token]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="px-4 pb-3 border-b border-border">
        <div className="h-3 bg-muted/60 rounded animate-pulse mt-1" style={{ width: '90%' }} />
        <div className="h-3 bg-muted/40 rounded animate-pulse mt-1.5" style={{ width: '60%' }} />
      </div>
    );
  }

  // Don't render anything if there's an error or no metadata
  if (hasError || !metadata) {
    return null;
  }

  const platformLabel = getPlatformLabel(repoInfo.type);
  const platformIcon = getPlatformIcon(repoInfo.type);
  const hasStats = metadata.stars > 0 || metadata.forks > 0 || metadata.language;

  return (
    <div className="px-4 pb-3 border-b border-border">
      {/* Repository description */}
      {metadata.description && (
        <p className="text-body-sm text-muted-foreground mt-1 line-clamp-2">
          {metadata.description}
        </p>
      )}

      {/* Stats row */}
      {hasStats && (
        <div className="flex items-center gap-3 mt-2">
          {metadata.stars > 0 && (
            <span className="inline-flex items-center gap-1 text-label-md text-muted-foreground">
              <Star size={12} className="h-3 w-3 text-warning" />
              {formatCount(metadata.stars)}
            </span>
          )}
          {metadata.forks > 0 && (
            <span className="inline-flex items-center gap-1 text-label-md text-muted-foreground">
              <GitFork size={12} className="h-3 w-3" />
              {formatCount(metadata.forks)}
            </span>
          )}
          {metadata.language && (
            <span className="inline-flex items-center gap-1 text-label-md text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
              {metadata.language}
            </span>
          )}
        </div>
      )}

      {/* View on platform link */}
      <a
        href={metadata.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-label-md text-muted-foreground hover:text-foreground transition-colors mt-2"
      >
        {platformIcon}
        <span>View on {platformLabel}</span>
        <ExternalLink size={10} className="h-2.5 w-2.5" />
      </a>
    </div>
  );
}
