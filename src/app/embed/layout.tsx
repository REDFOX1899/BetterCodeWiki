import React from 'react';

/**
 * Minimal layout for embed routes — no navigation, no sidebar, no chrome.
 * The root layout (app/layout.tsx) still wraps this with ThemeProvider
 * and LanguageProvider, so theming and i18n work out of the box.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
