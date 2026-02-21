'use client';

import React from 'react';
import Link from 'next/link';

export type ExplorerView = 'architecture' | 'dataflow' | 'dependencies';

interface ExplorerToolbarProps {
  owner: string;
  repo: string;
  repoType: string;
  activeView: ExplorerView;
  onViewChange: (view: ExplorerView) => void;
}

const VIEW_TABS: { key: ExplorerView; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  {
    key: 'architecture',
    label: 'Architecture',
    shortLabel: 'Arch',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: 'dataflow',
    label: 'Data Flow',
    shortLabel: 'Flow',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M4 12h16M12 4l8 8-8 8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'dependencies',
    label: 'Dependencies',
    shortLabel: 'Deps',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="6" cy="6" r="3" />
        <circle cx="18" cy="18" r="3" />
        <path d="M8.6 8.6L15.4 15.4" strokeLinecap="round" />
        <circle cx="18" cy="6" r="3" />
        <path d="M8.6 7L15.4 7" strokeLinecap="round" />
      </svg>
    ),
  },
];

const ExplorerToolbar: React.FC<ExplorerToolbarProps> = ({
  owner,
  repo,
  activeView,
  onViewChange,
}) => {
  return (
    <div className="h-14 border-b border-border bg-background flex items-center justify-between px-4 shrink-0">
      {/* Left: Back to Wiki */}
      <Link
        href={`/${owner}/${repo}`}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="hidden sm:inline">Back to Wiki</span>
      </Link>

      {/* Center: Repo name */}
      <div className="text-sm font-semibold text-foreground truncate mx-4">
        {owner}/{repo}
      </div>

      {/* Right: View tabs */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        {VIEW_TABS.map((tab) => {
          const isActive = activeView === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onViewChange(tab.key)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${isActive
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'}
              `}
            >
              <span className="md:hidden">{tab.icon}</span>
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden sr-only">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ExplorerToolbar;
