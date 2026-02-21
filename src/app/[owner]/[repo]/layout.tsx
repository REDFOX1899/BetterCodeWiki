'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, usePathname } from 'next/navigation';
import { Github, Gitlab, Home } from 'lucide-react';

// Bitbucket icon (lucide-react does not include one)
const BitbucketIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.89H.778zM14.52 15.53H9.522L8.17 8.466h7.561l-1.211 7.064z"/>
  </svg>
);
import ThemeToggle from '@/components/theme-toggle';

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: 'wiki', label: 'Wiki', suffix: '' },
  { key: 'explore', label: 'Explorer', suffix: '/explore' },
] as const;

/* ------------------------------------------------------------------ */
/*  Platform icon helper                                               */
/* ------------------------------------------------------------------ */

function PlatformIcon({ type }: { type: string }) {
  switch (type) {
    case 'gitlab':
      return <Gitlab size={14} className="h-3.5 w-3.5" />;
    case 'bitbucket':
      return <BitbucketIcon className="h-3.5 w-3.5" />;
    default:
      return <Github size={14} className="h-3.5 w-3.5" />;
  }
}

/* ------------------------------------------------------------------ */
/*  Layout                                                             */
/* ------------------------------------------------------------------ */

export default function RepoLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const owner = params.owner as string;
  const repo = params.repo as string;
  const repoType = searchParams.get('type') || 'github';

  // Build query string to preserve across tab navigation
  const queryString = searchParams.toString();
  const qs = queryString ? `?${queryString}` : '';

  // Determine active tab from pathname (handles both /owner/repo and /github/owner/repo patterns)
  const activeTab = (() => {
    if (pathname.endsWith('/explore')) return 'explore';
    return 'wiki';
  })();

  // Use the current pathname base for links (preserves clean URL if present)
  const basePath = pathname.replace(/\/explore$/, '');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Shared top navigation bar */}
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-[95%] xl:max-w-[1600px] mx-auto flex h-12 items-center justify-between px-2">
          {/* Left: Home + repo breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <Home size={14} className="h-3.5 w-3.5" />
            </Link>
            <span className="text-muted-foreground/30 shrink-0">/</span>
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground min-w-0">
              <PlatformIcon type={repoType} />
              <span className="truncate">{owner}/{repo}</span>
            </div>
          </div>

          {/* Center: Tab navigation */}
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5 gap-0.5">
            {TABS.map(({ key, label, suffix }) => {
              const isActive = activeTab === key;
              return (
                <Link
                  key={key}
                  href={`${basePath}${suffix}${qs}`}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Right: Theme toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Page content */}
      {children}
    </div>
  );
}
