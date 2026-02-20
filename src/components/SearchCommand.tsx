'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types (mirrored from page.tsx) ──────────────────────────────────
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

interface SearchResult {
  pageId: string;
  title: string;
  snippet: string;
  matchType: 'title' | 'content';
}

interface SearchCommandProps {
  generatedPages: Record<string, WikiPage>;
  isOpen: boolean;
  onClose: () => void;
  onSelectPage: (pageId: string) => void;
}

// ── Inline SVG Icons ────────────────────────────────────────────────
const SearchIcon = () => (
  <svg
    className="w-5 h-5 text-muted-foreground shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
    />
  </svg>
);

const DocumentIcon = () => (
  <svg
    className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
    />
  </svg>
);

const EmptyIcon = () => (
  <svg
    className="w-10 h-10 text-muted-foreground/40"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
    />
  </svg>
);

// ── Helpers ─────────────────────────────────────────────────────────

/** Strip markdown syntax for a cleaner preview. */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')       // fenced code blocks
    .replace(/`[^`]+`/g, ' ')              // inline code
    .replace(/#+\s/g, '')                   // headings
    .replace(/[*_~]{1,3}/g, '')             // bold/italic/strikethrough
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/<[^>]+>/g, '')                // html tags
    .replace(/\|/g, ' ')                    // table pipes
    .replace(/[-=]{3,}/g, '')               // hr
    .replace(/\n+/g, ' ')                   // newlines
    .replace(/\s+/g, ' ')                   // collapse whitespace
    .trim();
}

/**
 * Build a content snippet (~100 chars) around the first occurrence of
 * `query` inside `content`, with the match wrapped in <mark>.
 */
function buildSnippet(content: string, query: string): string {
  const plain = stripMarkdown(content);
  if (!query) return plain.slice(0, 100) + (plain.length > 100 ? '...' : '');

  const lower = plain.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());

  if (idx === -1) {
    return plain.slice(0, 100) + (plain.length > 100 ? '...' : '');
  }

  const start = Math.max(0, idx - 40);
  const end = Math.min(plain.length, idx + query.length + 60);
  const slice = (start > 0 ? '...' : '') + plain.slice(start, end) + (end < plain.length ? '...' : '');

  return slice;
}

/** Highlight `query` occurrences in `text` by returning React nodes. */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    // Compare case-insensitively to decide if this part is a match
    const isMatch = part.toLowerCase() === query.toLowerCase();
    return isMatch ? (
      <mark key={i} className="bg-primary/20 text-foreground font-semibold rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

// ── Component ───────────────────────────────────────────────────────

const SearchCommand: React.FC<SearchCommandProps> = ({
  generatedPages,
  isOpen,
  onClose,
  onSelectPage,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setActiveIndex(0);
      // Focus the input after a short delay to allow the animation
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Debounce the search query (150ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setActiveIndex(0);
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Build the search results
  const results: SearchResult[] = useMemo(() => {
    const pages = Object.values(generatedPages);

    // Empty query: show top-level pages as suggestions (up to 20)
    if (!debouncedQuery.trim()) {
      return pages
        .filter((p) => p.content && p.content !== 'Loading...')
        .slice(0, 20)
        .map((p) => ({
          pageId: p.id,
          title: p.title,
          snippet: buildSnippet(p.content, ''),
          matchType: 'title' as const,
        }));
    }

    const q = debouncedQuery.toLowerCase().trim();
    const matched: SearchResult[] = [];

    for (const page of pages) {
      if (matched.length >= 20) break;

      // Skip pages still loading
      if (!page.content || page.content === 'Loading...') continue;

      const titleMatch = page.title.toLowerCase().includes(q);
      const contentLower = stripMarkdown(page.content).toLowerCase();
      const contentMatch = contentLower.includes(q);

      if (titleMatch || contentMatch) {
        matched.push({
          pageId: page.id,
          title: page.title,
          snippet: buildSnippet(page.content, debouncedQuery),
          matchType: titleMatch ? 'title' : 'content',
        });
      }
    }

    // Sort: title matches first, then content matches
    matched.sort((a, b) => {
      if (a.matchType === 'title' && b.matchType !== 'title') return -1;
      if (a.matchType !== 'title' && b.matchType === 'title') return 1;
      return 0;
    });

    return matched;
  }, [generatedPages, debouncedQuery]);

  // Select a result
  const selectResult = useCallback(
    (result: SearchResult) => {
      onSelectPage(result.pageId);
      onClose();
    },
    [onSelectPage, onClose]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[activeIndex]) {
            selectResult(results[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, activeIndex, selectResult, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Search pages"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Modal container */}
          <motion.div
            className="relative max-w-2xl w-full mx-4 mt-[20vh] rounded-xl elevation-4 bg-card border border-border overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 border-b border-border">
              <SearchIcon />
              <input
                ref={inputRef}
                type="text"
                className="flex-1 h-14 text-base bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                placeholder="Search pages..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">&#8984;</span>K
              </kbd>
            </div>

            {/* Results list */}
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
              {results.length > 0 ? (
                <ul className="py-2" role="listbox">
                  {results.map((result, index) => {
                    const isActive = index === activeIndex;
                    return (
                      <motion.li
                        key={result.pageId}
                        layout
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors duration-100 ${
                          isActive
                            ? 'bg-primary/10 border-l-2 border-primary'
                            : 'border-l-2 border-transparent hover:bg-muted/50'
                        }`}
                        onClick={() => selectResult(result)}
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <DocumentIcon />
                        <div className="min-w-0 flex-1">
                          <div className="text-title-sm font-medium text-foreground truncate">
                            {highlightMatch(result.title, debouncedQuery)}
                          </div>
                          <div className="text-body-sm text-muted-foreground mt-0.5 line-clamp-1">
                            {highlightMatch(result.snippet, debouncedQuery)}
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              ) : debouncedQuery.trim() ? (
                /* No results state */
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <EmptyIcon />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No pages match your search
                  </p>
                </div>
              ) : (
                /* No pages loaded at all */
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <EmptyIcon />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No pages available
                  </p>
                </div>
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/30 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex items-center rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium">&uarr;</kbd>
                <kbd className="inline-flex items-center rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium">&darr;</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex items-center rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium">&#9166;</kbd>
                Open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex items-center rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium">Esc</kbd>
                Close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchCommand;
