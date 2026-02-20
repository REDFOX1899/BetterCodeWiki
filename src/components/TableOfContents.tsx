'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';

/** Slugify a heading string for use as an HTML id. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface TocHeading {
  id: string;
  text: string;
  level: number; // 1, 2, or 3
}

interface TableOfContentsProps {
  /** Raw markdown content string to extract headings from. */
  content: string;
  /** The scrollable container element (e.g. #wiki-content). */
  scrollContainer: HTMLElement | null;
}

/** Parse markdown source to extract h1/h2/h3 headings. */
function extractHeadings(markdown: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const lines = markdown.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    // Track fenced code blocks so we skip headings inside them
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,3})\s+(.+)/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/[*_`~]/g, '').trim();
      if (text) {
        headings.push({
          id: slugify(text),
          text,
          level,
        });
      }
    }
  }

  return headings;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ content, scrollContainer }) => {
  const headings = React.useMemo(() => extractHeadings(content), [content]);
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      if (!scrollContainer) return;

      const target = scrollContainer.querySelector(`#${CSS.escape(id)}`);
      if (target) {
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - containerRect.top + scrollContainer.scrollTop - 24;

        scrollContainer.scrollTo({ top: offset, behavior: 'smooth' });
      }
    },
    [scrollContainer],
  );

  useEffect(() => {
    if (!scrollContainer || headings.length === 0) return;

    // Disconnect any previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const headingElements: Element[] = [];
    for (const h of headings) {
      const el = scrollContainer.querySelector(`#${CSS.escape(h.id)}`);
      if (el) headingElements.push(el);
    }

    if (headingElements.length === 0) return;

    const callback: IntersectionObserverCallback = (entries) => {
      // Find the topmost visible heading
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length > 0) {
        setActiveId(visible[0].target.id);
      }
    };

    observerRef.current = new IntersectionObserver(callback, {
      root: scrollContainer,
      rootMargin: '0px 0px -70% 0px',
      threshold: 0,
    });

    for (const el of headingElements) {
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [scrollContainer, headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="Table of contents">
      <p className="text-title-sm text-foreground mb-3">On this page</p>
      <ul className="border-l border-border space-y-1">
        {headings.map((heading) => {
          const isActive = activeId === heading.id;
          const indent =
            heading.level === 1 ? 'pl-3' : heading.level === 2 ? 'pl-5' : 'pl-7';

          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                onClick={(e) => handleClick(e, heading.id)}
                className={`block py-1 text-label-md transition-colors duration-150 ${indent} ${
                  isActive
                    ? 'text-primary font-medium border-l-2 border-primary -ml-px'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default TableOfContents;
