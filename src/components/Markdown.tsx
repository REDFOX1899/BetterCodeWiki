import React, { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useParams } from 'next/navigation';
import Mermaid from './Mermaid';
import { slugify } from './TableOfContents';
import type { DiagramData } from '../types/diagramData';

interface MarkdownProps {
  content: string;
  onDiagramNodeClick?: (nodeId: string, label: string, rect: DOMRect, diagramData?: DiagramData) => void;
}

const DIAGRAM_DATA_REGEX = /<!-- DIAGRAM_DATA_START -->\s*([\s\S]*?)\s*<!-- DIAGRAM_DATA_END -->/g;

/**
 * Extract structured diagram data blocks from content and return
 * the cleaned content plus parsed diagram data keyed by mermaid source.
 */
function extractDiagramData(content: string): { cleanContent: string; diagramDataMap: Map<string, DiagramData> } {
  const diagramDataMap = new Map<string, DiagramData>();
  const cleanContent = content.replace(DIAGRAM_DATA_REGEX, (_match, jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr) as DiagramData;
      if (data.mermaidSource) {
        diagramDataMap.set(data.mermaidSource, data);
      }
    } catch {
      // Invalid JSON — silently strip the markers
    }
    return '';
  });
  return { cleanContent, diagramDataMap };
}

/** Recursively extract plain text from React children. */
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (React.isValidElement(children) && children.props) {
    return extractText((children.props as { children?: React.ReactNode }).children);
  }
  return '';
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs"
      title="Copy code"
    >
      {copied ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
};

const Markdown: React.FC<MarkdownProps> = ({ content, onDiagramNodeClick }) => {
  // Get owner/repo from route params for explorer URL
  const params = useParams();
  const owner = typeof params?.owner === 'string' ? params.owner : '';
  const repo = typeof params?.repo === 'string' ? params.repo : '';
  const explorerUrl = owner && repo ? `/${owner}/${repo}/explore` : undefined;

  // Extract and strip diagram data markers from content
  const { cleanContent, diagramDataMap } = useMemo(() => extractDiagramData(content), [content]);

  // Define markdown components
  const MarkdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
    p({ children, ...props }: { children?: React.ReactNode }) {
      return <p className="mb-4 text-base leading-7 text-foreground" {...props}>{children}</p>;
    },
    h1({ children, ...props }: { children?: React.ReactNode }) {
      const id = slugify(extractText(children));
      return <h1 id={id} className="text-2xl font-bold mt-8 mb-4 text-foreground tracking-tight" {...props}>{children}</h1>;
    },
    h2({ children, ...props }: { children?: React.ReactNode }) {
      const id = slugify(extractText(children));
      // Special styling for ReAct headings
      if (children && typeof children === 'string') {
        const text = children.toString();
        if (text.includes('Thought') || text.includes('Action') || text.includes('Observation') || text.includes('Answer')) {
          return (
            <h2
              id={id}
              className={`text-lg font-bold mt-6 mb-3 px-3 py-2 rounded-lg ${
                text.includes('Thought') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300' :
                text.includes('Action') ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' :
                text.includes('Observation') ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300' :
                text.includes('Answer') ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300' :
                'text-foreground'
              }`}
              {...props}
            >
              {children}
            </h2>
          );
        }
      }
      return <h2 id={id} className="text-xl font-bold mt-8 mb-3 text-foreground tracking-tight" {...props}>{children}</h2>;
    },
    h3({ children, ...props }: { children?: React.ReactNode }) {
      const id = slugify(extractText(children));
      return <h3 id={id} className="text-lg font-semibold mt-6 mb-2 text-foreground" {...props}>{children}</h3>;
    },
    h4({ children, ...props }: { children?: React.ReactNode }) {
      return <h4 className="text-base font-semibold mt-5 mb-2 text-foreground" {...props}>{children}</h4>;
    },
    ul({ children, ...props }: { children?: React.ReactNode }) {
      return <ul className="list-disc pl-6 mb-4 text-base text-foreground space-y-1.5" {...props}>{children}</ul>;
    },
    ol({ children, ...props }: { children?: React.ReactNode }) {
      return <ol className="list-decimal pl-6 mb-4 text-base text-foreground space-y-1.5" {...props}>{children}</ol>;
    },
    li({ children, ...props }: { children?: React.ReactNode }) {
      return <li className="mb-1 text-base leading-7 text-foreground" {...props}>{children}</li>;
    },
    a({ children, href, ...props }: { children?: React.ReactNode; href?: string }) {
      return (
        <a
          href={href}
          className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    blockquote({ children, ...props }: { children?: React.ReactNode }) {
      return (
        <blockquote
          className="border-l-4 border-primary/30 pl-4 py-1 text-muted-foreground italic my-4 text-base bg-muted/30 rounded-r-lg"
          {...props}
        >
          {children}
        </blockquote>
      );
    },
    table({ children, ...props }: { children?: React.ReactNode }) {
      return (
        <div className="overflow-x-auto my-6 rounded-lg border border-border">
          <table className="min-w-full text-sm border-collapse" {...props}>
            {children}
          </table>
        </div>
      );
    },
    thead({ children, ...props }: { children?: React.ReactNode }) {
      return <thead className="bg-muted/50" {...props}>{children}</thead>;
    },
    tbody({ children, ...props }: { children?: React.ReactNode }) {
      return <tbody className="divide-y divide-border" {...props}>{children}</tbody>;
    },
    tr({ children, ...props }: { children?: React.ReactNode }) {
      return <tr className="hover:bg-muted/30 transition-colors" {...props}>{children}</tr>;
    },
    th({ children, ...props }: { children?: React.ReactNode }) {
      return (
        <th
          className="px-4 py-3 text-left font-medium text-foreground text-sm"
          {...props}
        >
          {children}
        </th>
      );
    },
    td({ children, ...props }: { children?: React.ReactNode }) {
      return <td className="px-4 py-3 border-t border-border text-sm" {...props}>{children}</td>;
    },
    code(props: {
      inline?: boolean;
      className?: string;
      children?: React.ReactNode;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any; // Using any here as it's required for ReactMarkdown components
    }) {
      const { inline, className, children, ...otherProps } = props;
      const match = /language-(\w+)/.exec(className || '');
      const codeContent = children ? String(children).replace(/\n$/, '') : '';

      // Handle Mermaid diagrams
      if (!inline && match && match[1] === 'mermaid') {
        // Look up structured diagram data for this mermaid source
        const matchedData = diagramDataMap.get(codeContent) || undefined;
        // Create a wrapper that includes diagramData in the callback
        const handleNodeClick = onDiagramNodeClick
          ? (nodeId: string, label: string, rect: DOMRect) => {
              onDiagramNodeClick(nodeId, label, rect, matchedData);
            }
          : undefined;
        return (
          <div className="my-8 bg-muted/30 rounded-lg overflow-hidden elevation-2">
            <Mermaid
              chart={codeContent}
              className="w-full max-w-full"
              zoomingEnabled={true}
              diagramData={matchedData}
              onNodeClick={handleNodeClick}
              explorerUrl={matchedData ? explorerUrl : undefined}
            />
          </div>
        );
      }

      // Handle code blocks
      if (!inline && match) {
        return (
          <div className="my-6 rounded-lg overflow-hidden text-sm elevation-2">
            <div className="bg-[#1e1e1e] dark:bg-[#0d1117] text-gray-300 px-5 py-2.5 text-sm flex justify-between items-center border-b border-white/10">
              <span className="font-mono text-xs uppercase tracking-wider text-gray-400">{match[1]}</span>
              <CopyButton text={codeContent} />
            </div>
            <SyntaxHighlighter
              language={match[1]}
              style={tomorrow}
              className="!text-sm"
              customStyle={{ margin: 0, borderRadius: '0 0 0.5rem 0.5rem', padding: '1.25rem' }}
              showLineNumbers={true}
              wrapLines={true}
              wrapLongLines={true}
              {...otherProps}
            >
              {codeContent}
            </SyntaxHighlighter>
          </div>
        );
      }

      // Handle inline code - neutral color instead of pink
      return (
        <code
          className={`${className} font-mono bg-[var(--inline-code-bg)] text-[var(--inline-code-fg)] px-1.5 py-0.5 rounded-md text-[0.875em] border border-border/50`}
          {...otherProps}
        >
          {children}
        </code>
      );
    },
  };

  return (
    <div className="prose prose-base dark:prose-invert max-w-none px-2 py-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={MarkdownComponents}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
};

export default Markdown;