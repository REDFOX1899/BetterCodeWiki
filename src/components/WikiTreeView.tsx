'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { FaChevronRight, FaChevronDown } from 'react-icons/fa';

// Import interfaces from the page component
interface WikiPage {
  id: string;
  title: string;
  content: string;
  filePaths: string[];
  importance: 'high' | 'medium' | 'low';
  relatedPages: string[];
  parentId?: string;
  isSection?: boolean;
  children?: string[];
}

interface WikiSection {
  id: string;
  title: string;
  pages: string[];
  subsections?: string[];
}

interface WikiStructure {
  id: string;
  title: string;
  description: string;
  pages: WikiPage[];
  sections: WikiSection[];
  rootSections: string[];
}

interface WikiTreeViewProps {
  wikiStructure: WikiStructure;
  currentPageId: string | undefined;
  onPageSelect: (pageId: string) => void;
  messages?: {
    pages?: string;
    [key: string]: string | undefined;
  };
}

/* ------------------------------------------------------------------ */
/*  Small inline SVG icons                                             */
/* ------------------------------------------------------------------ */
const SearchIcon = () => (
  <svg
    className="w-3.5 h-3.5 text-muted-foreground"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
      clipRule="evenodd"
    />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Debounce hook                                                      */
/* ------------------------------------------------------------------ */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
const WikiTreeView: React.FC<WikiTreeViewProps> = ({
  wikiStructure,
  currentPageId,
  onPageSelect,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(wikiStructure.rootSections)
  );

  /* ---- search / filter state ---- */
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 200);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Build a set of page ids that match the search query */
  const matchingPageIds = useMemo<Set<string>>(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return new Set<string>();
    return new Set(
      wikiStructure.pages
        .filter(p => p.title.toLowerCase().includes(q))
        .map(p => p.id)
    );
  }, [debouncedQuery, wikiStructure.pages]);

  const isFiltering = debouncedQuery.trim().length > 0;

  /* Determine which sections contain at least one matching page (recursively) */
  const sectionsWithMatches = useMemo<Set<string>>(() => {
    if (!isFiltering) return new Set<string>();

    const result = new Set<string>();

    const check = (sectionId: string): boolean => {
      const section = wikiStructure.sections.find(s => s.id === sectionId);
      if (!section) return false;

      const hasDirectMatch = section.pages.some(pid => matchingPageIds.has(pid));
      const hasChildMatch = section.subsections?.some(sub => check(sub)) ?? false;
      if (hasDirectMatch || hasChildMatch) {
        result.add(sectionId);
        return true;
      }
      return false;
    };

    wikiStructure.rootSections.forEach(sid => check(sid));
    return result;
  }, [isFiltering, matchingPageIds, wikiStructure.sections, wikiStructure.rootSections]);

  /* Auto-expand sections that contain matches while filtering */
  useEffect(() => {
    if (isFiltering && sectionsWithMatches.size > 0) {
      setExpandedSections(prev => {
        const next = new Set(prev);
        sectionsWithMatches.forEach(id => next.add(id));
        return next;
      });
    }
  }, [isFiltering, sectionsWithMatches]);

  /* ---- helpers ---- */
  const toggleSection = useCallback((sectionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  /** Count pages in a section (including subsections, recursively) */
  const countPages = useCallback(
    (sectionId: string): number => {
      const section = wikiStructure.sections.find(s => s.id === sectionId);
      if (!section) return 0;
      const directCount = section.pages.length;
      const childCount = section.subsections?.reduce(
        (sum, subId) => sum + countPages(subId),
        0
      ) ?? 0;
      return directCount + childCount;
    },
    [wikiStructure.sections]
  );

  /* ---- page button renderer ---- */
  const renderPage = (page: WikiPage) => {
    const isActive = currentPageId === page.id;

    return (
      <button
        key={page.id}
        className={`
          group relative w-full text-left py-1.5 pr-3 pl-3 rounded-r-md text-sm
          transition-all duration-150 ease-in-out
          ${isActive
            ? 'border-l-2 border-primary bg-primary/8 text-primary font-medium'
            : 'border-l-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }
        `}
        onClick={() => onPageSelect(page.id)}
      >
        <div className="flex items-center gap-2">
          {/* Importance indicator */}
          {page.importance === 'high' && (
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isActive ? 'bg-primary' : 'bg-primary/70'
              }`}
            />
          )}
          {page.importance === 'medium' && (
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted-foreground/40" />
          )}
          {/* Low importance: no dot at all */}
          <span className="truncate">{page.title}</span>
        </div>
      </button>
    );
  };

  /* ---- section renderer ---- */
  const renderSection = (sectionId: string, level = 0) => {
    const section = wikiStructure.sections.find(s => s.id === sectionId);
    if (!section) return null;

    /* If filtering, skip sections that have no matching pages */
    if (isFiltering && !sectionsWithMatches.has(sectionId)) return null;

    const isExpanded = expandedSections.has(sectionId);
    const pageCount = countPages(sectionId);

    /* Pages to render (may be filtered) */
    const visiblePages = section.pages
      .map(pid => wikiStructure.pages.find(p => p.id === pid))
      .filter((p): p is WikiPage => {
        if (!p) return false;
        if (isFiltering) return matchingPageIds.has(p.id);
        return true;
      });

    return (
      <div key={sectionId} className="mb-1">
        {/* Section header button */}
        <button
          className={`
            flex items-center w-full text-left px-2 py-1.5 rounded-md
            text-title-sm text-foreground
            transition-all duration-150 ease-in-out
            hover:bg-muted/50
            ${level === 0 ? 'bg-muted/30' : ''}
            ${isExpanded ? 'border-l-2 border-primary' : 'border-l-2 border-transparent'}
          `}
          onClick={(e) => toggleSection(sectionId, e)}
        >
          <span className="mr-2 text-muted-foreground transition-transform duration-150">
            {isExpanded ? (
              <FaChevronDown className="text-[10px]" />
            ) : (
              <FaChevronRight className="text-[10px]" />
            )}
          </span>
          <span className="truncate flex-1">{section.title}</span>
          {/* Page count badge */}
          <span className="ml-2 flex-shrink-0 text-[11px] font-medium text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded-full leading-none">
            {pageCount}
          </span>
        </button>

        {/* Expanded content with smooth transition */}
        <div
          className={`
            overflow-hidden transition-all duration-200 ease-in-out
            ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
          `}
        >
          <div
            className={`
              mt-0.5 space-y-0.5
              ${level === 0 ? 'ml-3' : 'ml-3 pl-2 border-l border-border'}
            `}
          >
            {/* Render pages in this section */}
            {visiblePages.map(page => renderPage(page))}

            {/* Render subsections recursively */}
            {section.subsections?.map(subsectionId =>
              renderSection(subsectionId, level + 1)
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Flat list fallback (no sections)                                 */
  /* ---------------------------------------------------------------- */
  if (
    !wikiStructure.sections ||
    wikiStructure.sections.length === 0 ||
    !wikiStructure.rootSections ||
    wikiStructure.rootSections.length === 0
  ) {
    console.log(
      'WikiTreeView: Falling back to flat list view due to missing or empty sections/rootSections'
    );

    const filteredFlatPages = wikiStructure.pages.filter(page => {
      if (!isFiltering) return true;
      return page.title.toLowerCase().includes(debouncedQuery.trim().toLowerCase());
    });

    return (
      <div className="space-y-2">
        {/* Search input */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
            <SearchIcon />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter pages..."
            className="
              w-full rounded-md border border-border bg-background
              py-1.5 pl-8 pr-3 text-sm text-foreground
              placeholder:text-muted-foreground/60
              focus:outline-none focus:ring-1 focus:ring-ring
              transition-colors duration-150
            "
          />
        </div>

        {filteredFlatPages.length === 0 && isFiltering && (
          <p className="px-3 py-2 text-sm text-muted-foreground/70">No results found.</p>
        )}

        <ul className="space-y-0.5">
          {filteredFlatPages.map(page => (
            <li key={page.id}>
              {renderPage(page)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Tree view (with sections)                                        */
  /* ---------------------------------------------------------------- */

  // Log information about the sections for debugging
  console.log('WikiTreeView: Rendering tree view with sections:', wikiStructure.sections);
  console.log('WikiTreeView: Root sections:', wikiStructure.rootSections);

  const hasNoResults = isFiltering && sectionsWithMatches.size === 0;

  return (
    <div className="space-y-1">
      {/* Search input */}
      <div className="relative mb-2">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
          <SearchIcon />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Filter pages..."
          className="
            w-full rounded-md border border-border bg-background
            py-1.5 pl-8 pr-3 text-sm text-foreground
            placeholder:text-muted-foreground/60
            focus:outline-none focus:ring-1 focus:ring-ring
            transition-colors duration-150
          "
        />
      </div>

      {/* No results message */}
      {hasNoResults && (
        <p className="px-3 py-2 text-sm text-muted-foreground/70">No results found.</p>
      )}

      {/* Sections */}
      {wikiStructure.rootSections.map(sectionId => {
        const section = wikiStructure.sections.find(s => s.id === sectionId);
        if (!section) {
          console.warn(`WikiTreeView: Could not find section with id ${sectionId}`);
          return null;
        }
        return renderSection(sectionId);
      })}
    </div>
  );
};

export default WikiTreeView;
