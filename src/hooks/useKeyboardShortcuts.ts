'use client';

import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  isReadingMode: boolean;
  setIsReadingMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  isAskModalOpen: boolean;
  setIsAskModalOpen: (value: boolean) => void;
  setIsSearchOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  currentPageId?: string;
}

export function useKeyboardShortcuts({
  isReadingMode,
  setIsReadingMode,
  isAskModalOpen,
  setIsAskModalOpen,
  setIsSearchOpen,
  currentPageId,
}: UseKeyboardShortcutsOptions): void {
  // Scroll to top when page changes
  useEffect(() => {
    const wikiContent = document.getElementById('wiki-content');
    if (wikiContent) {
      wikiContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPageId]);

  // Escape closes Ask modal
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAskModalOpen(false);
      }
    };

    if (isAskModalOpen) {
      window.addEventListener('keydown', handleEsc);
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isAskModalOpen, setIsAskModalOpen]);

  // Cmd+K / Ctrl+K toggles search
  useEffect(() => {
    const handleSearchShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev: boolean) => !prev);
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, [setIsSearchOpen]);

  // Alt+R toggles reading mode, Escape exits
  useEffect(() => {
    const handleReadingModeShortcut = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        setIsReadingMode((prev: boolean) => !prev);
      }
      if (e.key === 'Escape' && isReadingMode) {
        setIsReadingMode(false);
      }
    };
    window.addEventListener('keydown', handleReadingModeShortcut);
    return () => window.removeEventListener('keydown', handleReadingModeShortcut);
  }, [isReadingMode, setIsReadingMode]);
}
