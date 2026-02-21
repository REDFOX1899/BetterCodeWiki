'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, FileOutput, FileText, Code, Globe, FileArchive, Check, Copy } from 'lucide-react';
import { WikiPage, WikiStructure } from '@/types/wiki';

interface ExportMenuProps {
  wikiStructure: WikiStructure;
  generatedPages: Record<string, WikiPage>;
  repoInfo: { owner: string; repo: string };
  currentPageId?: string | null;
}

// ---- Utility: slugify ----

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// ---- Utility: trigger file download ----

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ---- Markdown to Confluence converter ----

function markdownToConfluence(md: string): string {
  let result = md;

  // Code blocks (must be done before inline code)
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const langAttr = lang ? `language=${lang}` : '';
    return `{code${langAttr ? ':' + langAttr : ''}}\n${code.trimEnd()}\n{code}`;
  });

  // Inline code
  result = result.replace(/`([^`]+)`/g, '{{$1}}');

  // Headings (h1 through h6)
  result = result.replace(/^######\s+(.+)$/gm, 'h6. $1');
  result = result.replace(/^#####\s+(.+)$/gm, 'h5. $1');
  result = result.replace(/^####\s+(.+)$/gm, 'h4. $1');
  result = result.replace(/^###\s+(.+)$/gm, 'h3. $1');
  result = result.replace(/^##\s+(.+)$/gm, 'h2. $1');
  result = result.replace(/^#\s+(.+)$/gm, 'h1. $1');

  // Bold: **text** -> *text*
  result = result.replace(/\*\*(.+?)\*\*/g, '*$1*');

  // Italic: *text* -> _text_ (but not ** which we already handled)
  // We need to be careful here - only match single * not preceded/followed by *
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');

  // Links: [text](url) -> [text|url]
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$1|$2]');

  // Images: ![alt](url) -> !url!
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '!$2!');

  // Horizontal rules
  result = result.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '----');

  // Blockquotes -> {quote} blocks
  const lines = result.split('\n');
  const processed: string[] = [];
  let inQuote = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('> ')) {
      if (!inQuote) {
        processed.push('{quote}');
        inQuote = true;
      }
      processed.push(line.substring(2));
    } else if (line === '>') {
      if (!inQuote) {
        processed.push('{quote}');
        inQuote = true;
      }
      processed.push('');
    } else {
      if (inQuote) {
        processed.push('{quote}');
        inQuote = false;
      }
      processed.push(line);
    }
  }
  if (inQuote) {
    processed.push('{quote}');
  }

  result = processed.join('\n');

  // Tables: convert markdown tables to Confluence format
  // Markdown: | header1 | header2 |  with  |---|---| separator
  // Confluence: ||header1||header2||  and  |cell1|cell2|
  const tableLines = result.split('\n');
  const tableProcessed: string[] = [];

  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i].trim();

    // Check if this is a table separator line (|---|---|)
    if (/^\|[\s-:|]+\|$/.test(line)) {
      // Skip separator lines
      continue;
    }

    // Check if this is a table header line (follows by a separator)
    if (/^\|.+\|$/.test(line) && i + 1 < tableLines.length && /^\|[\s-:|]+\|$/.test(tableLines[i + 1].trim())) {
      // This is a header row - convert to Confluence header format
      const cells = line.split('|').filter(c => c !== '');
      const confluenceLine = cells.map(c => `||${c.trim()}`).join('') + '||';
      tableProcessed.push(confluenceLine);
    } else if (/^\|.+\|$/.test(line)) {
      // Regular table row
      tableProcessed.push(line);
    } else {
      tableProcessed.push(tableLines[i]);
    }
  }

  return tableProcessed.join('\n');
}

// ---- Markdown export ----

function exportMarkdown(
  wikiStructure: WikiStructure,
  generatedPages: Record<string, WikiPage>,
  repoInfo: { owner: string; repo: string }
) {
  let markdown = `# ${repoInfo.owner}/${repoInfo.repo} Wiki\n\n`;
  markdown += `${wikiStructure.description || ''}\n\n---\n\n`;

  for (const page of wikiStructure.pages) {
    const content = generatedPages[page.id]?.content || 'Content not generated';
    markdown += `## ${page.title}\n\n${content}\n\n---\n\n`;
  }

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `${repoInfo.repo}_wiki.md`);
}

// ---- JSON export ----

function exportJSON(
  wikiStructure: WikiStructure,
  generatedPages: Record<string, WikiPage>,
  repoInfo: { owner: string; repo: string }
) {
  const data = {
    repo: `${repoInfo.owner}/${repoInfo.repo}`,
    structure: wikiStructure,
    pages: Object.fromEntries(
      wikiStructure.pages.map(page => [
        page.id,
        {
          ...page,
          content: generatedPages[page.id]?.content || 'Content not generated',
        },
      ])
    ),
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `${repoInfo.repo}_wiki.json`);
}

// ---- Notion export (.zip) ----

async function exportNotion(
  wikiStructure: WikiStructure,
  generatedPages: Record<string, WikiPage>,
  repoInfo: { owner: string; repo: string }
) {
  // Dynamically import JSZip
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Build table of contents
  let indexMd = `# ${repoInfo.owner}/${repoInfo.repo} Wiki\n\n`;
  indexMd += `${wikiStructure.description || ''}\n\n`;
  indexMd += `## Table of Contents\n\n`;

  for (const page of wikiStructure.pages) {
    const slug = slugify(page.title);
    indexMd += `- [${page.title}](./${slug}.md)\n`;
  }

  zip.file('_index.md', indexMd);

  // Add each page as a separate file
  for (const page of wikiStructure.pages) {
    const slug = slugify(page.title);
    let content = generatedPages[page.id]?.content || 'Content not generated';

    // Convert blockquotes to Notion callout format
    content = content.replace(
      /^(>\s*.*)$/gm,
      (line: string) => {
        const text = line.replace(/^>\s*/, '');
        // If the line already starts with an emoji or bold note indicator, keep it
        if (/^[^\w\s]/.test(text) || /^\*\*/.test(text)) {
          return `> ${text}`;
        }
        return `> \u2139\uFE0F **Note**\n> ${text}`;
      }
    );

    // Convert <details> tags to Notion toggle format
    content = content.replace(
      /<details>\s*<summary>(.*?)<\/summary>([\s\S]*?)<\/details>/gi,
      (_match: string, summary: string, body: string) => {
        const trimmedBody = body.trim();
        return `> **${summary}**\n>\n> ${trimmedBody.split('\n').join('\n> ')}`;
      }
    );

    const pageContent = `# ${page.title}\n\n${content}\n`;
    zip.file(`${slug}.md`, pageContent);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `${repoInfo.repo}_wiki_notion.zip`);
}

// ---- Confluence export ----

function exportConfluence(
  wikiStructure: WikiStructure,
  generatedPages: Record<string, WikiPage>,
  repoInfo: { owner: string; repo: string }
) {
  let output = `h1. ${repoInfo.owner}/${repoInfo.repo} Wiki\n\n`;
  output += `${wikiStructure.description || ''}\n\n----\n\n`;

  for (const page of wikiStructure.pages) {
    const content = generatedPages[page.id]?.content || 'Content not generated';
    const converted = markdownToConfluence(content);
    output += `h1. ${page.title}\n\n${converted}\n\n----\n\n`;
  }

  const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${repoInfo.repo}_wiki_confluence.txt`);
}

// ---- HTML export ----

function exportHTML(
  wikiStructure: WikiStructure,
  generatedPages: Record<string, WikiPage>,
  repoInfo: { owner: string; repo: string }
) {
  // Build the sidebar TOC
  const tocItems = wikiStructure.pages
    .map(page => {
      const anchor = slugify(page.title);
      return `<li><a href="#${anchor}">${escapeHtml(page.title)}</a></li>`;
    })
    .join('\n          ');

  // Build the main content
  const sections = wikiStructure.pages
    .map(page => {
      const anchor = slugify(page.title);
      const content = generatedPages[page.id]?.content || 'Content not generated';
      const htmlContent = markdownToBasicHtml(content);
      return `
      <section id="${anchor}" class="page-section">
        <h2>${escapeHtml(page.title)}</h2>
        ${htmlContent}
      </section>
      <hr />`;
    })
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(repoInfo.owner)}/${escapeHtml(repoInfo.repo)} Wiki</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1a202c;
      background: #ffffff;
      line-height: 1.7;
      display: flex;
      min-height: 100vh;
    }

    nav.sidebar {
      position: fixed;
      top: 0;
      left: 0;
      width: 260px;
      height: 100vh;
      overflow-y: auto;
      background: #f7f8fa;
      border-right: 1px solid #e2e8f0;
      padding: 24px 16px;
    }

    nav.sidebar h1 {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #718096;
      margin-bottom: 16px;
    }

    nav.sidebar ul {
      list-style: none;
      padding: 0;
    }

    nav.sidebar li {
      margin-bottom: 4px;
    }

    nav.sidebar a {
      display: block;
      padding: 6px 12px;
      border-radius: 6px;
      color: #2d3748;
      text-decoration: none;
      font-size: 14px;
      transition: background 0.15s;
    }

    nav.sidebar a:hover {
      background: #edf2f7;
      color: #1a202c;
    }

    main {
      margin-left: 260px;
      flex: 1;
      max-width: 800px;
      padding: 48px 40px;
    }

    main > h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 8px;
      color: #1a202c;
    }

    main > p.description {
      color: #718096;
      font-size: 1.05rem;
      margin-bottom: 32px;
    }

    .page-section {
      margin-bottom: 16px;
    }

    .page-section h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      color: #1a202c;
    }

    .page-section h3 {
      font-size: 1.2rem;
      font-weight: 600;
      margin-top: 24px;
      margin-bottom: 12px;
    }

    .page-section h4 {
      font-size: 1.05rem;
      font-weight: 600;
      margin-top: 20px;
      margin-bottom: 8px;
    }

    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 32px 0;
    }

    p {
      margin-bottom: 1em;
    }

    a {
      color: #3182ce;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    strong {
      font-weight: 600;
    }

    em {
      font-style: italic;
    }

    code {
      background: #f0f0f3;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.875em;
    }

    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 16px 20px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 16px 0;
      line-height: 1.5;
    }

    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
      font-size: 0.875em;
    }

    blockquote {
      border-left: 4px solid #3182ce;
      padding: 12px 16px;
      margin: 16px 0;
      background: #f7fafc;
      border-radius: 0 6px 6px 0;
      color: #4a5568;
    }

    blockquote p {
      margin-bottom: 0;
    }

    ul, ol {
      margin: 12px 0;
      padding-left: 24px;
    }

    li {
      margin-bottom: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 0.9em;
    }

    th {
      text-align: left;
      padding: 10px 12px;
      background: #f7f8fa;
      border-bottom: 2px solid #e2e8f0;
      font-weight: 600;
    }

    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
    }

    @media print {
      nav.sidebar {
        display: none;
      }

      main {
        margin-left: 0;
        max-width: 100%;
        padding: 20px;
      }

      pre {
        white-space: pre-wrap;
        word-break: break-word;
      }

      .page-section {
        page-break-inside: avoid;
      }

      h2 {
        page-break-after: avoid;
      }
    }
  </style>
</head>
<body>
  <nav class="sidebar">
    <h1>Table of Contents</h1>
    <ul>
      ${tocItems}
    </ul>
  </nav>
  <main>
    <h1>${escapeHtml(repoInfo.owner)}/${escapeHtml(repoInfo.repo)} Wiki</h1>
    <p class="description">${escapeHtml(wikiStructure.description || '')}</p>
    ${sections}
  </main>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${repoInfo.repo}_wiki.html`);
}

// ---- Basic markdown to HTML converter ----

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToBasicHtml(md: string): string {
  let html = md;

  // Code blocks first (before other transformations)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre><code>${escapeHtml(code.trimEnd())}</code></pre>`;
  });

  // Inline code (before escaping rest of html for these segments)
  // We need to protect inline code from further processing
  const inlineCodePlaceholders: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    const placeholder = `__INLINE_CODE_${inlineCodePlaceholders.length}__`;
    inlineCodePlaceholders.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // Protect pre blocks from further processing
  const preBlocks: string[] = [];
  html = html.replace(/<pre><code>[\s\S]*?<\/code><\/pre>/g, (match) => {
    const placeholder = `__PRE_BLOCK_${preBlocks.length}__`;
    preBlocks.push(match);
    return placeholder;
  });

  // Now escape remaining HTML (outside of code)
  // But we should not double-escape what is already in pre/code blocks
  // Split by placeholders, escape non-placeholder parts
  const parts = html.split(/(__PRE_BLOCK_\d+__|__INLINE_CODE_\d+__)/);
  html = parts
    .map(part => {
      if (part.startsWith('__PRE_BLOCK_') || part.startsWith('__INLINE_CODE_')) {
        return part;
      }
      return escapeHtml(part);
    })
    .join('');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^#\s+(.+)$/gm, '<h2>$1</h2>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images: ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Horizontal rules
  html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr />');

  // Blockquotes (group consecutive lines)
  const htmlLines = html.split('\n');
  const blockquoteProcessed: string[] = [];
  let inBq = false;
  for (const line of htmlLines) {
    if (line.startsWith('&gt; ')) {
      if (!inBq) {
        blockquoteProcessed.push('<blockquote>');
        inBq = true;
      }
      blockquoteProcessed.push(`<p>${line.substring(5)}</p>`);
    } else if (line === '&gt;') {
      if (!inBq) {
        blockquoteProcessed.push('<blockquote>');
        inBq = true;
      }
    } else {
      if (inBq) {
        blockquoteProcessed.push('</blockquote>');
        inBq = false;
      }
      blockquoteProcessed.push(line);
    }
  }
  if (inBq) blockquoteProcessed.push('</blockquote>');
  html = blockquoteProcessed.join('\n');

  // Tables
  html = convertMarkdownTablesToHtml(html);

  // Unordered lists
  html = html.replace(/^(\s*)-\s+(.+)$/gm, '<li>$2</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>\n${match}</ul>\n`);

  // Ordered lists
  html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, '<li>$2</li>');
  // Wrap consecutive <li> not already in <ul> into <ol>
  // (simplified - this works for basic cases)

  // Paragraphs: wrap remaining bare lines
  html = html.replace(/^(?!<[a-z/]|__PRE_BLOCK_|__INLINE_CODE_|\s*$)(.+)$/gm, '<p>$1</p>');

  // Restore placeholders
  for (let i = 0; i < preBlocks.length; i++) {
    html = html.replace(`__PRE_BLOCK_${i}__`, preBlocks[i]);
  }
  for (let i = 0; i < inlineCodePlaceholders.length; i++) {
    html = html.replace(`__INLINE_CODE_${i}__`, inlineCodePlaceholders[i]);
  }

  return html;
}

function convertMarkdownTablesToHtml(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Check if this looks like a table header row followed by a separator
    if (
      /^\|.+\|$/.test(line) &&
      i + 1 < lines.length &&
      /^\|[\s-:|]+\|$/.test(lines[i + 1].trim())
    ) {
      // Start a table
      result.push('<table>');

      // Header row
      const headers = line.split('|').filter(c => c !== '').map(c => c.trim());
      result.push('<thead><tr>');
      for (const h of headers) {
        result.push(`<th>${h}</th>`);
      }
      result.push('</tr></thead>');

      // Skip the separator line
      i += 2;

      // Body rows
      result.push('<tbody>');
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        const cells = lines[i].trim().split('|').filter(c => c !== '').map(c => c.trim());
        result.push('<tr>');
        for (const c of cells) {
          result.push(`<td>${c}</td>`);
        }
        result.push('</tr>');
        i++;
      }
      result.push('</tbody></table>');
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join('\n');
}

// ---- Component ----

const ExportMenu: React.FC<ExportMenuProps> = ({ wikiStructure, generatedPages, repoInfo, currentPageId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleExport = useCallback(
    async (format: 'markdown' | 'json' | 'notion' | 'confluence' | 'html') => {
      setIsExporting(true);
      setIsOpen(false);

      try {
        switch (format) {
          case 'markdown':
            exportMarkdown(wikiStructure, generatedPages, repoInfo);
            break;
          case 'json':
            exportJSON(wikiStructure, generatedPages, repoInfo);
            break;
          case 'notion':
            await exportNotion(wikiStructure, generatedPages, repoInfo);
            break;
          case 'confluence':
            exportConfluence(wikiStructure, generatedPages, repoInfo);
            break;
          case 'html':
            exportHTML(wikiStructure, generatedPages, repoInfo);
            break;
        }
      } catch (err) {
        console.error('Export error:', err);
      } finally {
        setIsExporting(false);
      }
    },
    [wikiStructure, generatedPages, repoInfo]
  );

  const handleCopyEmbed = useCallback(() => {
    const targetPageId = currentPageId || wikiStructure.pages[0]?.id;
    if (!targetPageId) return;

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const embedUrl = `${origin}/embed/${repoInfo.owner}/${repoInfo.repo}/${targetPageId}`;
    const snippet = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0"></iframe>`;

    navigator.clipboard.writeText(snippet);
    setEmbedCopied(true);
    setIsOpen(false);
    setTimeout(() => setEmbedCopied(false), 2000);
  }, [currentPageId, wikiStructure.pages, repoInfo.owner, repoInfo.repo]);

  const exportOptions = [
    {
      format: 'markdown' as const,
      label: 'Markdown',
      ext: '.md',
      icon: <FileText size={16} className="h-4 w-4" />,
    },
    {
      format: 'json' as const,
      label: 'JSON',
      ext: '.json',
      icon: <Code size={16} className="h-4 w-4" />,
    },
    {
      format: 'notion' as const,
      label: 'Notion Export',
      ext: '.zip',
      icon: <FileArchive size={16} className="h-4 w-4" />,
    },
    {
      format: 'confluence' as const,
      label: 'Confluence',
      ext: '.txt',
      icon: <FileOutput size={16} className="h-4 w-4" />,
    },
    {
      format: 'html' as const,
      label: 'HTML',
      ext: '.html',
      icon: <Globe size={16} className="h-4 w-4" />,
    },
  ];

  return (
    <div className="p-3 border-t border-border bg-muted/10" ref={menuRef}>
      <div className="relative">
        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-56 bg-card border border-border rounded-xl shadow-lg py-2 z-20">
            {/* Embed copy option */}
            <button
              onClick={handleCopyEmbed}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="text-muted-foreground">
                {embedCopied ? <Check size={16} className="h-4 w-4 text-green-500" /> : <Copy size={16} className="h-4 w-4" />}
              </span>
              <span className="flex-1 text-left font-medium">
                {embedCopied ? 'Copied!' : 'Copy Embed Code'}
              </span>
              <span className="text-xs text-muted-foreground">iframe</span>
            </button>
            <div className="my-1 mx-3 border-t border-border" />
            {exportOptions.map((option) => (
              <button
                key={option.format}
                onClick={() => handleExport(option.format)}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <span className="text-muted-foreground">{option.icon}</span>
                <span className="flex-1 text-left font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.ext}</span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isExporting}
          className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
        >
          <Download size={12} className="mr-2 h-3 w-3" />
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
    </div>
  );
};

export default ExportMenu;
