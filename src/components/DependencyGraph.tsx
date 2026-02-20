'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaTimes } from 'react-icons/fa';

interface DependencyGraphProps {
  pages: Record<string, { title: string; importance?: string; relatedPages?: string[] }>;
  currentPageId: string | null;
  onSelectPage: (pageId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface GraphNode {
  id: string;
  title: string;
  importance: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

// Truncate text to maxLen characters
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

// Deterministic pseudo-random based on string hash (for consistent initial layout)
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getNodeRadius(nodeId: string, currentPageId: string | null, importance: string): number {
  if (nodeId === currentPageId) return 24;
  if (importance === 'high') return 18;
  return 14;
}

// Run force-directed layout simulation
function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  iterations: number = 100
): GraphNode[] {
  if (nodes.length === 0) return nodes;

  const result = nodes.map(n => ({ ...n }));

  const cx = width / 2;
  const cy = height / 2;
  const repulsionStrength = 8000;
  const attractionStrength = 0.005;
  const centerGravity = 0.01;
  const idealEdgeLength = 120;
  const damping = 0.9;

  for (let iter = 0; iter < iterations; iter++) {
    // Decrease damping over time for convergence
    const currentDamping = damping * (1 - iter / iterations * 0.5);

    // Repulsion between all pairs
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dx = result[j].x - result[i].x;
        const dy = result[j].y - result[i].y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) dist = 1;

        const force = repulsionStrength / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        result[i].vx -= fx;
        result[i].vy -= fy;
        result[j].vx += fx;
        result[j].vy += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const source = result.find(n => n.id === edge.source);
      const target = result.find(n => n.id === edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) dist = 1;

      const displacement = dist - idealEdgeLength;
      const force = displacement * attractionStrength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // Center gravity
    for (const node of result) {
      node.vx += (cx - node.x) * centerGravity;
      node.vy += (cy - node.y) * centerGravity;
    }

    // Apply velocity with damping
    for (const node of result) {
      node.vx *= currentDamping;
      node.vy *= currentDamping;

      // Limit max velocity
      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > 10) {
        node.vx = (node.vx / speed) * 10;
        node.vy = (node.vy / speed) * 10;
      }

      node.x += node.vx;
      node.y += node.vy;

      // Keep within bounds with padding
      const padding = 60;
      node.x = Math.max(padding, Math.min(width - padding, node.x));
      node.y = Math.max(padding, Math.min(height - padding, node.y));
    }
  }

  return result;
}

// Arrange nodes in a grid when there are no edges
function computeGridLayout(nodes: GraphNode[], width: number, height: number): GraphNode[] {
  if (nodes.length === 0) return nodes;
  const result = nodes.map(n => ({ ...n }));
  const cols = Math.ceil(Math.sqrt(result.length));
  const rows = Math.ceil(result.length / cols);
  const cellW = width / (cols + 1);
  const cellH = height / (rows + 1);

  for (let i = 0; i < result.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    result[i].x = cellW * (col + 1);
    result[i].y = cellH * (row + 1);
    result[i].vx = 0;
    result[i].vy = 0;
  }
  return result;
}

export default function DependencyGraph({
  pages,
  currentPageId,
  onSelectPage,
  isOpen,
  onClose,
}: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string } | null>(null);

  // Pan & zoom state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 900, h: 600 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const viewBoxOnPanStart = useRef({ x: 0, y: 0, w: 900, h: 600 });

  // Compute nodes and edges from pages
  const { nodes, edges, hasEdges } = useMemo(() => {
    const entries = Object.entries(pages);
    // Limit to 200 nodes
    const limitedEntries = entries.slice(0, 200);

    const validIds = new Set(limitedEntries.map(([id]) => id));

    const rawNodes: GraphNode[] = limitedEntries.map(([id, page]) => {
      const seed = hashCode(id);
      return {
        id,
        title: page.title,
        importance: page.importance || 'medium',
        x: 100 + seededRandom(seed) * 700,
        y: 100 + seededRandom(seed + 1) * 400,
        vx: 0,
        vy: 0,
      };
    });

    const edgeSet = new Set<string>();
    const rawEdges: GraphEdge[] = [];

    for (const [id, page] of limitedEntries) {
      if (page.relatedPages) {
        for (const related of page.relatedPages) {
          if (validIds.has(related)) {
            const key = [id, related].sort().join('::');
            if (!edgeSet.has(key)) {
              edgeSet.add(key);
              rawEdges.push({ source: id, target: related });
            }
          }
        }
      }
    }

    return { nodes: rawNodes, edges: rawEdges, hasEdges: rawEdges.length > 0 };
  }, [pages]);

  // Run layout
  const layoutNodes = useMemo(() => {
    const width = 900;
    const height = 600;
    if (!hasEdges) {
      return computeGridLayout(nodes, width, height);
    }
    return computeLayout(nodes, edges, width, height, 100);
  }, [nodes, edges, hasEdges]);

  // Build a quick lookup map for positions
  const nodePositions = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of layoutNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [layoutNodes]);

  // Determine connected nodes for hover highlight
  const connectedTo = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const node of layoutNodes) {
      map.set(node.id, new Set());
    }
    for (const edge of edges) {
      map.get(edge.source)?.add(edge.target);
      map.get(edge.target)?.add(edge.source);
    }
    return map;
  }, [layoutNodes, edges]);

  // Reset viewBox when modal opens
  useEffect(() => {
    if (isOpen) {
      setViewBox({ x: 0, y: 0, w: 900, h: 600 });
      setHoveredNode(null);
      setTooltip(null);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Only pan on middle click or left click on the SVG background
    if (e.button !== 0) return;
    const target = e.target as SVGElement;
    // Only start panning if clicking on the SVG background (not on a node)
    if (target.tagName !== 'svg' && target.tagName !== 'rect' && !target.classList.contains('graph-bg')) return;

    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    viewBoxOnPanStart.current = { ...viewBox };
    e.preventDefault();
  }, [viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;

    // Scale movement based on viewBox vs actual SVG size
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = viewBoxOnPanStart.current.w / rect.width;
    const scaleY = viewBoxOnPanStart.current.h / rect.height;

    setViewBox({
      ...viewBoxOnPanStart.current,
      x: viewBoxOnPanStart.current.x - dx * scaleX,
      y: viewBoxOnPanStart.current.y - dy * scaleY,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

    setViewBox(prev => {
      const newW = prev.w * zoomFactor;
      const newH = prev.h * zoomFactor;
      // Zoom toward center of current view
      const newX = prev.x + (prev.w - newW) / 2;
      const newY = prev.y + (prev.h - newH) / 2;

      // Clamp zoom
      if (newW < 200 || newW > 5000) return prev;

      return { x: newX, y: newY, w: newW, h: newH };
    });
  }, []);

  // Handle node hover with tooltip
  const handleNodeMouseEnter = useCallback((nodeId: string, e: React.MouseEvent) => {
    setHoveredNode(nodeId);
    const node = nodePositions.get(nodeId);
    if (node) {
      setTooltip({ x: e.clientX, y: e.clientY, title: node.title });
    }
  }, [nodePositions]);

  const handleNodeMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
    setTooltip(null);
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    onSelectPage(nodeId);
    onClose();
  }, [onSelectPage, onClose]);

  // Determine node fill color
  const getNodeFill = useCallback((nodeId: string, importance: string): string => {
    if (nodeId === currentPageId) return 'var(--primary)';
    if (importance === 'high') return 'color-mix(in srgb, var(--primary) 60%, transparent)';
    if (importance === 'medium') return 'var(--muted)';
    return 'color-mix(in srgb, var(--muted) 60%, transparent)';
  }, [currentPageId]);

  // Determine node stroke
  const getNodeStroke = useCallback((nodeId: string): string => {
    if (nodeId === currentPageId) return 'var(--primary)';
    if (nodeId === hoveredNode) return 'var(--primary)';
    return 'var(--border)';
  }, [currentPageId, hoveredNode]);

  // Determine edge style
  const getEdgeStyle = useCallback((edge: GraphEdge): { stroke: string; strokeWidth: number; opacity: number } => {
    const isCurrent = edge.source === currentPageId || edge.target === currentPageId;
    const isHovered = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode);

    if (isHovered) {
      return { stroke: 'var(--primary)', strokeWidth: 2, opacity: 0.8 };
    }
    if (isCurrent) {
      return { stroke: 'color-mix(in srgb, var(--primary) 50%, transparent)', strokeWidth: 1.5, opacity: 0.7 };
    }
    // When a node is hovered, dim unrelated edges
    if (hoveredNode) {
      return { stroke: 'var(--border)', strokeWidth: 1, opacity: 0.15 };
    }
    return { stroke: 'var(--border)', strokeWidth: 1, opacity: 0.4 };
  }, [currentPageId, hoveredNode]);

  // Determine node opacity for hover highlighting
  const getNodeOpacity = useCallback((nodeId: string): number => {
    if (!hoveredNode) return 1;
    if (nodeId === hoveredNode) return 1;
    if (connectedTo.get(hoveredNode)?.has(nodeId)) return 1;
    return 0.25;
  }, [hoveredNode, connectedTo]);

  if (!isOpen) return null;

  const pageCount = Object.keys(pages).length;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center"
      style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop blur layer */}
      <div className="absolute inset-0 backdrop-blur-sm pointer-events-none" />

      {/* Modal container */}
      <div
        ref={containerRef}
        className="relative max-w-5xl w-full mx-auto mt-[5vh] bg-card border border-border rounded-xl elevation-4 overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="12" cy="18" r="3" />
              <line x1="8.5" y1="7.5" x2="10.5" y2="16" />
              <line x1="15.5" y1="7.5" x2="13.5" y2="16" />
              <line x1="9" y1="6" x2="15" y2="6" />
            </svg>
            <h2 className="text-title-md text-foreground">Page Relationships</h2>
            <span className="text-body-sm text-muted-foreground">
              {layoutNodes.length} pages, {edges.length} connections
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close graph"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>

        {/* Graph area */}
        <div className="flex-1 relative" style={{ minHeight: '400px' }}>
          {pageCount < 3 ? (
            <div className="flex items-center justify-center h-full min-h-[400px] text-muted-foreground text-body-md">
              Not enough pages to display a graph
            </div>
          ) : (
            <>
              <svg
                ref={svgRef}
                className="w-full h-full"
                style={{ minHeight: '400px', cursor: isPanning.current ? 'grabbing' : 'grab' }}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                preserveAspectRatio="xMidYMid meet"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                <defs>
                  {/* Glow filter for the current page node */}
                  <filter id="glow-current" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Pulse animation for current page */}
                  <style>{`
                    @keyframes pulse-ring {
                      0% { opacity: 0.6; r: 28; }
                      50% { opacity: 0.2; r: 34; }
                      100% { opacity: 0.6; r: 28; }
                    }
                    .pulse-ring {
                      animation: pulse-ring 2s ease-in-out infinite;
                    }
                  `}</style>
                </defs>

                {/* Background rect for pan detection */}
                <rect
                  className="graph-bg"
                  x={viewBox.x - 1000}
                  y={viewBox.y - 1000}
                  width={viewBox.w + 2000}
                  height={viewBox.h + 2000}
                  fill="transparent"
                />

                {/* Edges */}
                {edges.map((edge, i) => {
                  const source = nodePositions.get(edge.source);
                  const target = nodePositions.get(edge.target);
                  if (!source || !target) return null;

                  const style = getEdgeStyle(edge);
                  return (
                    <line
                      key={`edge-${i}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={style.stroke}
                      strokeWidth={style.strokeWidth}
                      opacity={style.opacity}
                    />
                  );
                })}

                {/* Nodes */}
                {layoutNodes.map(node => {
                  const r = getNodeRadius(node.id, currentPageId, node.importance);
                  const isCurrent = node.id === currentPageId;
                  const opacity = getNodeOpacity(node.id);

                  return (
                    <g
                      key={node.id}
                      style={{ cursor: 'pointer', opacity }}
                      onClick={(e) => { e.stopPropagation(); handleNodeClick(node.id); }}
                      onMouseEnter={(e) => handleNodeMouseEnter(node.id, e)}
                      onMouseMove={handleNodeMouseMove}
                      onMouseLeave={handleNodeMouseLeave}
                    >
                      {/* Pulse ring for current page */}
                      {isCurrent && (
                        <circle
                          className="pulse-ring"
                          cx={node.x}
                          cy={node.y}
                          r={28}
                          fill="none"
                          stroke="var(--primary)"
                          strokeWidth="2"
                        />
                      )}

                      {/* Node circle */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={r}
                        fill={getNodeFill(node.id, node.importance)}
                        stroke={getNodeStroke(node.id)}
                        strokeWidth={isCurrent ? 2.5 : node.id === hoveredNode ? 2 : 1.5}
                        filter={isCurrent ? 'url(#glow-current)' : undefined}
                      />

                      {/* Label */}
                      <text
                        x={node.x}
                        y={node.y + r + 14}
                        textAnchor="middle"
                        className="text-label-sm"
                        fill="var(--foreground)"
                        style={{ fontSize: '11px', fontWeight: 500, pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {truncate(node.title, 20)}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip */}
              {tooltip && (
                <div
                  className="fixed z-50 px-2.5 py-1.5 rounded-md bg-popover border border-border elevation-3 text-body-sm text-popover-foreground pointer-events-none"
                  style={{
                    left: tooltip.x + 12,
                    top: tooltip.y - 8,
                    maxWidth: '280px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {tooltip.title}
                </div>
              )}

              {/* Legend */}
              <div className="absolute bottom-3 left-3 flex items-center gap-4 px-3 py-2 rounded-lg bg-card/90 border border-border text-body-sm text-muted-foreground backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 60%, transparent)' }} />
                  <span>High</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--muted) 60%, transparent)' }} />
                  <span>Low</span>
                </div>
              </div>

              {/* Zoom hint */}
              <div className="absolute bottom-3 right-3 px-3 py-2 rounded-lg bg-card/90 border border-border text-body-sm text-muted-foreground backdrop-blur-sm">
                Scroll to zoom, drag to pan
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
