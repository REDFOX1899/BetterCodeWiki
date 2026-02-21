// CSS styles for wiki prose content with Vercel/Linear aesthetic
export const wikiStyles = `
  /* Global Prose Overrides for Vercel/Linear Aesthetic */

  .prose {
    max-width: none;
    color: var(--foreground);
    line-height: 1.75;
  }

  /* Headings */
  .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
    color: var(--foreground);
    font-weight: 600;
    margin-top: 2em;
    margin-bottom: 1em;
    line-height: 1.25;
  }

  .prose h1 { font-size: 2.25rem; letter-spacing: -0.025em; }
  .prose h2 { font-size: 1.5rem; letter-spacing: -0.025em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
  .prose h3 { font-size: 1.25rem; }

  /* Links */
  .prose a {
    color: var(--primary);
    text-decoration: none;
    font-weight: 500;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
  }

  .prose a:hover {
    border-bottom-color: var(--primary);
  }

  /* Inline Code */
  .prose :not(pre) > code {
    background-color: var(--muted);
    color: var(--foreground);
    padding: 0.2em 0.4em;
    border-radius: 0.25rem;
    font-size: 0.875em;
    font-family: var(--font-mono);
    font-weight: 500;
    border: 1px solid var(--border);
  }

  /* Code Blocks (VS Code Style - Dark in both modes) */
  .prose pre {
    background-color: #1e1e1e !important;
    color: #e4e4e7 !important;
    border-radius: 0.5rem;
    padding: 1.25rem;
    overflow-x: auto;
    border: 1px solid var(--border);
    margin: 1.5em 0;
  }

  .prose pre code {
    background-color: transparent !important;
    color: inherit !important;
    padding: 0;
    border: none;
    font-size: 0.875em;
    font-family: var(--font-mono);
  }

  /* Blockquotes */
  .prose blockquote {
    border-left: 4px solid var(--primary);
    padding-left: 1rem;
    font-style: italic;
    color: var(--muted-foreground);
    background: var(--muted);
    padding: 1rem;
    border-radius: 0 0.5rem 0.5rem 0;
  }

  /* Tables */
  .prose table {
    width: 100%;
    border-collapse: collapse;
    margin: 2em 0;
    font-size: 0.875em;
  }

  .prose th {
    text-align: left;
    padding: 0.75rem;
    border-bottom: 1px solid var(--border);
    background-color: var(--muted);
    font-weight: 600;
  }

  .prose td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  /* Lists */
  .prose ul > li::marker { color: var(--muted-foreground); }
  .prose ol > li::marker { color: var(--muted-foreground); }

  /* Images */
  .prose img {
    border-radius: 0.5rem;
    border: 1px solid var(--border);
  }

  /* Details/Summary */
  .prose details {
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.5rem;
    background-color: var(--card);
  }

  .prose summary {
    cursor: pointer;
    font-weight: 500;
    padding: 0.5rem;
  }

  /* Reading Mode Styles */
  .reading-mode .prose {
    font-size: 1.125rem;
    line-height: 1.9;
  }

  .reading-mode .prose p {
    margin-bottom: 1.5em;
  }

  .reading-mode .prose h1,
  .reading-mode .prose h2,
  .reading-mode .prose h3,
  .reading-mode .prose h4,
  .reading-mode .prose h5,
  .reading-mode .prose h6 {
    margin-top: 2.5em;
  }
`;
