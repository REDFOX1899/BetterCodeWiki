import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getIconSvg } from '@/lib/techIcons';
import type { DiagramData, DiagramNode, DiagramEdge } from '@/types/diagramData';
import Markdown from './Markdown';
import {
  createDiagramExplainWebSocket,
  closeWebSocket,
  type DiagramExplainRequest,
} from '@/utils/websocketClient';

interface DiagramDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string | null;
  nodeLabel: string | null;
  diagramData: DiagramData | null;
  repoOwner: string;
  repoName: string;
  repoType: 'github' | 'gitlab' | 'bitbucket';
  repoUrl?: string;
  repoToken?: string;
  provider?: string;
  model?: string;
  language?: string;
}

function buildFileUrl(
  owner: string,
  repo: string,
  repoType: string,
  filePath: string,
  repoUrl?: string
): string {
  if (repoUrl) {
    try {
      const url = new URL(repoUrl);
      const hostname = url.hostname;
      if (hostname.includes('gitlab')) {
        return `${repoUrl}/-/blob/main/${filePath}`;
      }
      if (hostname.includes('bitbucket')) {
        return `${repoUrl}/src/main/${filePath}`;
      }
      // Default to GitHub-style
      return `${repoUrl}/blob/main/${filePath}`;
    } catch {
      // fall through
    }
  }
  // Fallback construction from owner/repo
  if (repoType === 'gitlab') {
    return `https://gitlab.com/${owner}/${repo}/-/blob/main/${filePath}`;
  }
  if (repoType === 'bitbucket') {
    return `https://bitbucket.org/${owner}/${repo}/src/main/${filePath}`;
  }
  return `https://github.com/${owner}/${repo}/blob/main/${filePath}`;
}

const DiagramDetailPanel: React.FC<DiagramDetailPanelProps> = ({
  isOpen,
  onClose,
  nodeId,
  nodeLabel,
  diagramData,
  repoOwner,
  repoName,
  repoType,
  repoUrl,
  repoToken,
  provider,
  model,
  language,
}) => {
  const [aiExplanation, setAiExplanation] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Look up node metadata from diagramData
  const nodeInfo: DiagramNode | null =
    diagramData && nodeId
      ? diagramData.nodes.find((n) => n.id === nodeId) || null
      : null;

  // Find connected edges
  const connectedEdges: DiagramEdge[] =
    diagramData && nodeId
      ? diagramData.edges.filter((e) => e.source === nodeId || e.target === nodeId)
      : [];

  // Build a set of connected node IDs and look up their labels
  const connectedNodes: { id: string; label: string; direction: 'to' | 'from'; edgeLabel?: string }[] =
    connectedEdges.map((edge) => {
      if (edge.source === nodeId) {
        const target = diagramData?.nodes.find((n) => n.id === edge.target);
        return { id: edge.target, label: target?.label || edge.target, direction: 'to', edgeLabel: edge.label };
      }
      const source = diagramData?.nodes.find((n) => n.id === edge.source);
      return { id: edge.source, label: source?.label || edge.source, direction: 'from', edgeLabel: edge.label };
    });

  // Get tech icon for the node
  const techIcon = nodeInfo?.technology ? getIconSvg(nodeInfo.technology) : null;

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
    }
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Reset AI explanation when node changes
  useEffect(() => {
    setAiExplanation('');
    setIsAiLoading(false);
    if (wsRef.current) {
      closeWebSocket(wsRef.current);
      wsRef.current = null;
    }
  }, [nodeId]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        closeWebSocket(wsRef.current);
        wsRef.current = null;
      }
    };
  }, []);

  const handleAskAi = useCallback(() => {
    if (!nodeId || isAiLoading) return;

    setAiExplanation('');
    setIsAiLoading(true);

    // Close any existing WebSocket
    if (wsRef.current) {
      closeWebSocket(wsRef.current);
    }

    const repoUrlStr = repoUrl || `https://github.com/${repoOwner}/${repoName}`;

    const request: DiagramExplainRequest = {
      repo_url: repoUrlStr,
      type: repoType,
      node_id: nodeId,
      node_label: nodeLabel || nodeId,
      node_technology: nodeInfo?.technology,
      node_files: nodeInfo?.files,
      node_description: nodeInfo?.description,
      diagram_context: diagramData?.mermaidSource,
      provider: provider,
      model: model,
      language: language,
      token: repoToken,
    };

    wsRef.current = createDiagramExplainWebSocket(
      request,
      (message: string) => {
        setAiExplanation((prev) => prev + message);
      },
      () => {
        setIsAiLoading(false);
      },
      () => {
        setIsAiLoading(false);
      }
    );
  }, [nodeId, nodeLabel, nodeInfo, diagramData, repoOwner, repoName, repoType, repoUrl, repoToken, provider, model, language, isAiLoading]);

  const displayLabel = nodeLabel || nodeInfo?.label || nodeId || '';

  return (
    <AnimatePresence>
      {isOpen && nodeId && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            className="fixed top-0 right-0 z-50 h-full w-full md:w-[380px] bg-card border-l border-border elevation-4 flex flex-col overflow-hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm truncate">
                <svg className="h-4 w-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <span className="truncate">Node Details</span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close panel"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Node identity */}
              <div className="flex items-start gap-3">
                {techIcon && (
                  <div
                    className="shrink-0 mt-0.5"
                    dangerouslySetInnerHTML={{
                      __html: techIcon.svg.replace(
                        '<svg ',
                        `<svg width="28" height="28" fill="#${techIcon.hex}" `
                      ),
                    }}
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-foreground break-words">
                    {displayLabel}
                  </h3>
                  {nodeInfo?.technology && (
                    <span className="inline-flex items-center mt-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {nodeInfo.technology}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {nodeInfo?.description && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Description
                  </h4>
                  <p className="text-sm text-foreground leading-relaxed">
                    {nodeInfo.description}
                  </p>
                </div>
              )}

              {/* Files */}
              {nodeInfo?.files && nodeInfo.files.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Files
                  </h4>
                  <ul className="space-y-1">
                    {nodeInfo.files.map((filePath) => (
                      <li key={filePath}>
                        <a
                          href={buildFileUrl(repoOwner, repoName, repoType, filePath, repoUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 hover:underline transition-colors py-0.5"
                        >
                          <svg className="h-3.5 w-3.5 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span className="truncate">{filePath}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Connections */}
              {connectedNodes.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Connections
                  </h4>
                  <ul className="space-y-1">
                    {connectedNodes.map((cn, i) => (
                      <li
                        key={`${cn.id}-${i}`}
                        className="flex items-center gap-2 text-sm text-foreground py-0.5"
                      >
                        <span className="text-muted-foreground text-xs w-4 shrink-0">
                          {cn.direction === 'to' ? '\u2192' : '\u2190'}
                        </span>
                        <span className="truncate">{cn.label}</span>
                        {cn.edgeLabel && (
                          <span className="text-xs text-muted-foreground truncate">
                            ({cn.edgeLabel})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ask AI button */}
              <div>
                <button
                  onClick={handleAskAi}
                  disabled={isAiLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {isAiLoading ? 'Generating...' : 'Ask AI about this component'}
                </button>
              </div>

              {/* AI Explanation */}
              {(aiExplanation || isAiLoading) && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    AI Explanation
                  </h4>
                  <div className="bg-muted/30 rounded-lg border border-border p-3 text-sm">
                    {aiExplanation ? (
                      <Markdown content={aiExplanation} />
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse" />
                        <div className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse delay-75" />
                        <div className="w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse delay-150" />
                        <span className="text-xs ml-1">Thinking...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DiagramDetailPanel;
