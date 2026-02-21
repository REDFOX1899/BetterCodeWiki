'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getIconSvg } from '@/lib/techIcons';
import type { DiagramData, DiagramNode, DiagramEdge } from '@/types/diagramData';
import Markdown from '../Markdown';
import {
  createDiagramExplainWebSocket,
  closeWebSocket,
  type DiagramExplainRequest,
} from '@/utils/websocketClient';

interface ExplorerDetailPanelProps {
  selectedNodeId: string | null;
  diagramData: DiagramData | null;
  repoOwner: string;
  repoName: string;
  repoType: string;
  repoToken?: string;
}

function buildFileUrl(
  owner: string,
  repo: string,
  repoType: string,
  filePath: string
): string {
  if (repoType === 'gitlab') {
    return `https://gitlab.com/${owner}/${repo}/-/blob/main/${filePath}`;
  }
  if (repoType === 'bitbucket') {
    return `https://bitbucket.org/${owner}/${repo}/src/main/${filePath}`;
  }
  return `https://github.com/${owner}/${repo}/blob/main/${filePath}`;
}

const ExplorerDetailPanel: React.FC<ExplorerDetailPanelProps> = ({
  selectedNodeId,
  diagramData,
  repoOwner,
  repoName,
  repoType,
  repoToken,
}) => {
  const [aiExplanation, setAiExplanation] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Look up node metadata from diagramData
  const nodeInfo: DiagramNode | null =
    diagramData && selectedNodeId
      ? diagramData.nodes.find((n) => n.id === selectedNodeId) || null
      : null;

  // Find connected edges
  const connectedEdges: DiagramEdge[] =
    diagramData && selectedNodeId
      ? diagramData.edges.filter(
          (e) => e.source === selectedNodeId || e.target === selectedNodeId
        )
      : [];

  // Build connected node list with direction info
  const connectedNodes: {
    id: string;
    label: string;
    direction: 'to' | 'from';
    edgeLabel?: string;
  }[] = connectedEdges.map((edge) => {
    if (edge.source === selectedNodeId) {
      const target = diagramData?.nodes.find((n) => n.id === edge.target);
      return {
        id: edge.target,
        label: target?.label || edge.target,
        direction: 'to',
        edgeLabel: edge.label,
      };
    }
    const source = diagramData?.nodes.find((n) => n.id === edge.source);
    return {
      id: edge.source,
      label: source?.label || edge.source,
      direction: 'from',
      edgeLabel: edge.label,
    };
  });

  // Get tech icon for the node
  const techIcon = nodeInfo?.technology
    ? getIconSvg(nodeInfo.technology)
    : null;

  // Reset AI explanation when node changes
  useEffect(() => {
    setAiExplanation('');
    setIsAiLoading(false);
    if (wsRef.current) {
      closeWebSocket(wsRef.current);
      wsRef.current = null;
    }
  }, [selectedNodeId]);

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
    if (!selectedNodeId || isAiLoading) return;

    setAiExplanation('');
    setIsAiLoading(true);

    if (wsRef.current) {
      closeWebSocket(wsRef.current);
    }

    const repoUrl = `https://github.com/${repoOwner}/${repoName}`;

    const request: DiagramExplainRequest = {
      repo_url: repoUrl,
      type: repoType,
      node_id: selectedNodeId,
      node_label: nodeInfo?.label || selectedNodeId,
      node_technology: nodeInfo?.technology,
      node_files: nodeInfo?.files,
      node_description: nodeInfo?.description,
      diagram_context: diagramData?.mermaidSource,
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
  }, [
    selectedNodeId,
    nodeInfo,
    diagramData,
    repoOwner,
    repoName,
    repoType,
    repoToken,
    isAiLoading,
  ]);

  const displayLabel = nodeInfo?.label || selectedNodeId || '';

  return (
    <div className="w-[380px] border-l border-border h-full overflow-y-auto bg-background shrink-0 hidden lg:block">
      {!selectedNodeId ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-6">
          <svg
            className="h-12 w-12 mb-3 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4m0 12v4m-7.07-2.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" />
          </svg>
          <p className="text-sm font-medium">Click a node to explore</p>
          <p className="text-xs mt-1 text-center">
            Select any component on the canvas to see its details and connections
          </p>
        </div>
      ) : (
        /* Node detail content */
        <div className="px-5 py-5 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm pb-3 border-b border-border">
            <svg
              className="h-4 w-4 text-primary shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span className="truncate">Node Details</span>
          </div>

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
                      href={buildFileUrl(
                        repoOwner,
                        repoName,
                        repoType,
                        filePath
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 hover:underline transition-colors py-0.5"
                    >
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
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
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
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
      )}
    </div>
  );
};

export default ExplorerDetailPanel;
