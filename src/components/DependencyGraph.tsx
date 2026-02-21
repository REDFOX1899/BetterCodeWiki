'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Maximize, Network, GitBranch, CircleDot } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
  category: NodeCategory;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** number of edges connected */
  degree: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

type LayoutMode = 'force' | 'hierarchical' | 'radial';

type NodeCategory = 'component' | 'page' | 'api' | 'utility' | 'config' | 'model' | 'hook' | 'test' | 'general';

/* ------------------------------------------------------------------ */
/*  Category inference from page title / id                           */
/* ------------------------------------------------------------------ */

const CATEGORY_PATTERNS: [RegExp, NodeCategory][] = [
  [/\bcomponent/i, 'component'],
  [/\bui\b/i, 'component'],
  [/\bwidget/i, 'component'],
  [/\bview\b/i, 'component'],
  [/\bpage\b/i, 'page'],
  [/\broute/i, 'page'],
  [/\blayout/i, 'page'],
  [/\bnavigat/i, 'page'],
  [/\bapi\b/i, 'api'],
  [/\bendpoint/i, 'api'],
  [/\brest\b/i, 'api'],
  [/\bgraphql/i, 'api'],
  [/\bserver/i, 'api'],
  [/\bcontroller/i, 'api'],
  [/\butil/i, 'utility'],
  [/\bhelper/i, 'utility'],
  [/\blib\b/i, 'utility'],
  [/\btool/i, 'utility'],
  [/\bformat/i, 'utility'],
  [/\bparse/i, 'utility'],
  [/\bconfig/i, 'config'],
  [/\bsetting/i, 'config'],
  [/\benv/i, 'config'],
  [/\bsetup/i, 'config'],
  [/\binit/i, 'config'],
  [/\bmodel/i, 'model'],
  [/\bschema/i, 'model'],
  [/\btype/i, 'model'],
  [/\binterface/i, 'model'],
  [/\bdatabase/i, 'model'],
  [/\bdata\b/i, 'model'],
  [/\bstore/i, 'model'],
  [/\bstate/i, 'model'],
  [/\bhook/i, 'hook'],
  [/\buse[A-Z]/i, 'hook'],
  [/\btest/i, 'test'],
  [/\bspec\b/i, 'test'],
];

function inferCategory(title: string, id: string): NodeCategory {
  const text = `${title} ${id}`;
  for (const [re, cat] of CATEGORY_PATTERNS) {
    if (re.test(text)) return cat;
  }
  return 'general';
}

/* ------------------------------------------------------------------ */
/*  Category colours & labels — work well in both light & dark mode   */
/* ------------------------------------------------------------------ */

interface CategoryTheme {
  label: string;
  light: { bg: string; border: string; text: string };
  dark: { bg: string; border: string; text: string };
}

const CATEGORY_THEMES: Record<NodeCategory, CategoryTheme> = {
  component: {
    label: 'Component',
    light: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    dark:  { bg: '#1e3a5f', border: '#60a5fa', text: '#bfdbfe' },
  },
  page: {
    label: 'Page / Route',
    light: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
    dark:  { bg: '#4a1942', border: '#f472b6', text: '#fbcfe8' },
  },
  api: {
    label: 'API / Server',
    light: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
    dark:  { bg: '#064e3b', border: '#34d399', text: '#a7f3d0' },
  },
  utility: {
    label: 'Utility',
    light: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    dark:  { bg: '#451a03', border: '#fbbf24', text: '#fde68a' },
  },
  config: {
    label: 'Config',
    light: { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
    dark:  { bg: '#282556', border: '#818cf8', text: '#c7d2fe' },
  },
  model: {
    label: 'Data / Model',
    light: { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
    dark:  { bg: '#2e1065', border: '#a78bfa', text: '#ddd6fe' },
  },
  hook: {
    label: 'Hook / State',
    light: { bg: '#ccfbf1', border: '#14b8a6', text: '#115e59' },
    dark:  { bg: '#134e4a', border: '#2dd4bf', text: '#99f6e4' },
  },
  test: {
    label: 'Test',
    light: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
    dark:  { bg: '#450a0a', border: '#f87171', text: '#fecaca' },
  },
  general: {
    label: 'General',
    light: { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' },
    dark:  { bg: '#27272a', border: '#71717a', text: '#d4d4d8' },
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

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

/* ------------------------------------------------------------------ */
/*  Node dimensions                                                   */
/* ------------------------------------------------------------------ */

const NODE_RECT_W = 180;
const NODE_RECT_H = 44;
const NODE_RADIUS = 8; // border radius

function getNodeWidth(node: GraphNode, currentPageId: string | null): number {
  if (node.id === currentPageId) return NODE_RECT_W + 20;
  if (node.importance === 'high') return NODE_RECT_W + 10;
  return NODE_RECT_W;
}

function getNodeHeight(node: GraphNode, currentPageId: string | null): number {
  if (node.id === currentPageId) return NODE_RECT_H + 6;
  if (node.importance === 'high') return NODE_RECT_H + 2;
  return NODE_RECT_H;
}

/* ------------------------------------------------------------------ */
/*  Layout algorithms                                                 */
/* ------------------------------------------------------------------ */

function computeForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  iterations = 120,
): GraphNode[] {
  if (nodes.length === 0) return nodes;

  const result = nodes.map(n => ({ ...n }));
  const cx = width / 2;
  const cy = height / 2;
  const repulsionStrength = 25000;
  const attractionStrength = 0.004;
  const centerGravity = 0.008;
  const idealEdgeLength = 220;
  const damping = 0.92;

  // Build adjacency for quick lookup
  const adj = new Map<string, Set<string>>();
  for (const n of result) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  for (let iter = 0; iter < iterations; iter++) {
    const currentDamping = damping * (1 - iter / iterations * 0.5);

    // Repulsion between all pairs
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        let dx = result[j].x - result[i].x;
        let dy = result[j].y - result[i].y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) { dx = 1; dy = 1; dist = Math.SQRT2; }

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

      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > 12) {
        node.vx = (node.vx / speed) * 12;
        node.vy = (node.vy / speed) * 12;
      }

      node.x += node.vx;
      node.y += node.vy;

      const px = 120;
      const py = 60;
      node.x = Math.max(px, Math.min(width - px, node.x));
      node.y = Math.max(py, Math.min(height - py, node.y));
    }
  }

  return result;
}

function computeHierarchicalLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): GraphNode[] {
  if (nodes.length === 0) return nodes;
  const result = nodes.map(n => ({ ...n, vx: 0, vy: 0 }));

  // BFS from highest-degree nodes to assign levels
  const adj = new Map<string, Set<string>>();
  for (const n of result) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  // Sort by degree descending, start from highest
  const sorted = [...result].sort((a, b) => b.degree - a.degree);
  const level = new Map<string, number>();
  const visited = new Set<string>();
  const queue: string[] = [];

  // Start BFS from top-degree node
  if (sorted.length > 0) {
    const root = sorted[0].id;
    level.set(root, 0);
    visited.add(root);
    queue.push(root);
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currLevel = level.get(curr)!;
    for (const neighbor of adj.get(curr) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        level.set(neighbor, currLevel + 1);
        queue.push(neighbor);
      }
    }
  }

  // Assign level 0 to unvisited nodes (disconnected)
  for (const n of result) {
    if (!level.has(n.id)) level.set(n.id, 0);
  }

  // Group by level
  const levels = new Map<number, GraphNode[]>();
  for (const n of result) {
    const l = level.get(n.id) || 0;
    if (!levels.has(l)) levels.set(l, []);
    levels.get(l)!.push(n);
  }

  const numLevels = Math.max(...levels.keys()) + 1;
  const levelHeight = Math.max(100, (height - 120) / Math.max(numLevels, 1));

  for (const [l, nodesInLevel] of levels) {
    const levelWidth = width / (nodesInLevel.length + 1);
    for (let i = 0; i < nodesInLevel.length; i++) {
      nodesInLevel[i].x = levelWidth * (i + 1);
      nodesInLevel[i].y = 60 + l * levelHeight;
    }
  }

  return result;
}

function computeRadialLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): GraphNode[] {
  if (nodes.length === 0) return nodes;
  const result = nodes.map(n => ({ ...n, vx: 0, vy: 0 }));

  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) / 2 - 120;

  // BFS from highest-degree node
  const adj = new Map<string, Set<string>>();
  for (const n of result) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  const sorted = [...result].sort((a, b) => b.degree - a.degree);
  const ring = new Map<string, number>();
  const visited = new Set<string>();
  const queue: string[] = [];

  if (sorted.length > 0) {
    const root = sorted[0].id;
    ring.set(root, 0);
    visited.add(root);
    queue.push(root);
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currRing = ring.get(curr)!;
    for (const neighbor of adj.get(curr) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        ring.set(neighbor, currRing + 1);
        queue.push(neighbor);
      }
    }
  }

  for (const n of result) {
    if (!ring.has(n.id)) ring.set(n.id, 0);
  }

  // Group by ring
  const rings = new Map<number, GraphNode[]>();
  for (const n of result) {
    const r = ring.get(n.id) || 0;
    if (!rings.has(r)) rings.set(r, []);
    rings.get(r)!.push(n);
  }

  const numRings = Math.max(...rings.keys()) + 1;

  for (const [r, nodesInRing] of rings) {
    if (r === 0) {
      // Center node
      for (const n of nodesInRing) {
        n.x = cx;
        n.y = cy;
      }
    } else {
      const radius = (r / Math.max(numRings - 1, 1)) * maxRadius;
      const angleStep = (2 * Math.PI) / nodesInRing.length;
      for (let i = 0; i < nodesInRing.length; i++) {
        const angle = angleStep * i - Math.PI / 2;
        nodesInRing[i].x = cx + radius * Math.cos(angle);
        nodesInRing[i].y = cy + radius * Math.sin(angle);
      }
    }
  }

  return result;
}

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

/* ------------------------------------------------------------------ */
/*  Curved edge path helper                                           */
/* ------------------------------------------------------------------ */

function edgePath(sx: number, sy: number, tx: number, ty: number): string {
  const dx = tx - sx;
  const dy = ty - sy;
  // Slight curve via a control point offset perpendicular to the line
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return `M ${sx} ${sy} L ${tx} ${ty}`;
  const curvature = Math.min(30, len * 0.08);
  // perpendicular offset
  const nx = -dy / len * curvature;
  const ny = dx / len * curvature;
  return `M ${sx} ${sy} Q ${mx + nx} ${my + ny} ${tx} ${ty}`;
}

/* ------------------------------------------------------------------ */
/*  Dark mode detection hook                                          */
/* ------------------------------------------------------------------ */

function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => {
      setDark(document.documentElement.getAttribute('data-theme') === 'dark' ||
              document.documentElement.classList.contains('dark'));
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

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
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; category: NodeCategory } | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force');
  const isDark = useIsDark();

  // Viewport dimensions for layout
  const LAYOUT_W = 1400;
  const LAYOUT_H = 900;

  // Pan & zoom state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: LAYOUT_W, h: LAYOUT_H });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const viewBoxOnPanStart = useRef({ x: 0, y: 0, w: LAYOUT_W, h: LAYOUT_H });

  /* ---- Build graph data ---- */
  const { nodes, edges, hasEdges } = useMemo(() => {
    const entries = Object.entries(pages);
    const limitedEntries = entries.slice(0, 200);
    const validIds = new Set(limitedEntries.map(([id]) => id));

    // Count degree
    const degreeMap = new Map<string, number>();
    for (const [id] of limitedEntries) degreeMap.set(id, 0);
    for (const [id, page] of limitedEntries) {
      if (page.relatedPages) {
        for (const related of page.relatedPages) {
          if (validIds.has(related)) {
            degreeMap.set(id, (degreeMap.get(id) || 0) + 1);
            degreeMap.set(related, (degreeMap.get(related) || 0) + 1);
          }
        }
      }
    }

    const rawNodes: GraphNode[] = limitedEntries.map(([id, page]) => {
      const seed = hashCode(id);
      return {
        id,
        title: page.title,
        importance: page.importance || 'medium',
        category: inferCategory(page.title, id),
        x: 100 + seededRandom(seed) * (LAYOUT_W - 200),
        y: 80 + seededRandom(seed + 1) * (LAYOUT_H - 160),
        vx: 0,
        vy: 0,
        degree: degreeMap.get(id) || 0,
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

  /* ---- Layout ---- */
  const layoutNodes = useMemo(() => {
    if (!hasEdges) return computeGridLayout(nodes, LAYOUT_W, LAYOUT_H);
    switch (layoutMode) {
      case 'hierarchical':
        return computeHierarchicalLayout(nodes, edges, LAYOUT_W, LAYOUT_H);
      case 'radial':
        return computeRadialLayout(nodes, edges, LAYOUT_W, LAYOUT_H);
      case 'force':
      default:
        return computeForceLayout(nodes, edges, LAYOUT_W, LAYOUT_H, 120);
    }
  }, [nodes, edges, hasEdges, layoutMode]);

  /* ---- Lookup maps ---- */
  const nodePositions = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const node of layoutNodes) map.set(node.id, node);
    return map;
  }, [layoutNodes]);

  const connectedTo = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const node of layoutNodes) map.set(node.id, new Set());
    for (const edge of edges) {
      map.get(edge.source)?.add(edge.target);
      map.get(edge.target)?.add(edge.source);
    }
    return map;
  }, [layoutNodes, edges]);

  /* ---- Determine which categories are actually present ---- */
  const presentCategories = useMemo(() => {
    const cats = new Set<NodeCategory>();
    for (const node of layoutNodes) cats.add(node.category);
    return cats;
  }, [layoutNodes]);

  /* ---- Reset on open ---- */
  useEffect(() => {
    if (isOpen) {
      setViewBox({ x: 0, y: 0, w: LAYOUT_W, h: LAYOUT_H });
      setHoveredNode(null);
      setSelectedNode(null);
      setTooltip(null);
    }
  }, [isOpen]);

  /* ---- Close on Escape ---- */
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  /* ---- Pan handlers ---- */
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const target = e.target as SVGElement;
    if (target.closest('.graph-node')) return; // don't pan when clicking node
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    viewBoxOnPanStart.current = { ...viewBox };
    e.preventDefault();
  }, [viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
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

  /* ---- Zoom ---- */
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(prev => {
      const newW = prev.w * zoomFactor;
      const newH = prev.h * zoomFactor;
      const newX = prev.x + (prev.w - newW) / 2;
      const newY = prev.y + (prev.h - newH) / 2;
      if (newW < 300 || newW > 6000) return prev;
      return { x: newX, y: newY, w: newW, h: newH };
    });
  }, []);

  const zoomIn = useCallback(() => {
    setViewBox(prev => {
      const factor = 0.8;
      const newW = prev.w * factor;
      const newH = prev.h * factor;
      if (newW < 300) return prev;
      return { x: prev.x + (prev.w - newW) / 2, y: prev.y + (prev.h - newH) / 2, w: newW, h: newH };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setViewBox(prev => {
      const factor = 1.25;
      const newW = prev.w * factor;
      const newH = prev.h * factor;
      if (newW > 6000) return prev;
      return { x: prev.x + (prev.w - newW) / 2, y: prev.y + (prev.h - newH) / 2, w: newW, h: newH };
    });
  }, []);

  const fitToView = useCallback(() => {
    setViewBox({ x: -50, y: -30, w: LAYOUT_W + 100, h: LAYOUT_H + 60 });
  }, []);

  /* ---- Focus on a node (center viewport on it) ---- */
  const focusNode = useCallback((nodeId: string) => {
    const node = nodePositions.get(nodeId);
    if (!node) return;
    setViewBox(prev => ({
      x: node.x - prev.w / 2,
      y: node.y - prev.h / 2,
      w: Math.min(prev.w, LAYOUT_W * 0.6),
      h: Math.min(prev.h, LAYOUT_H * 0.6),
    }));
  }, [nodePositions]);

  /* ---- Hover ---- */
  const handleNodeMouseEnter = useCallback((nodeId: string, e: React.MouseEvent) => {
    setHoveredNode(nodeId);
    const node = nodePositions.get(nodeId);
    if (node) setTooltip({ x: e.clientX, y: e.clientY, title: node.title, category: node.category });
  }, [nodePositions]);

  const handleNodeMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
    setTooltip(null);
  }, []);

  /* ---- Click node ---- */
  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedNode === nodeId) {
      // Double-click behavior: navigate to the page
      onSelectPage(nodeId);
      onClose();
    } else {
      setSelectedNode(nodeId);
      focusNode(nodeId);
    }
  }, [selectedNode, onSelectPage, onClose, focusNode]);

  /* ---- Deselect on background click ---- */
  const handleBgClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  /* ---- Active (highlighted) node: either hovered or selected ---- */
  const activeNode = hoveredNode || selectedNode;

  /* ---- Theme-aware colors ---- */
  const getTheme = useCallback((cat: NodeCategory) => {
    return isDark ? CATEGORY_THEMES[cat].dark : CATEGORY_THEMES[cat].light;
  }, [isDark]);

  /* ---- Node opacity for highlight ---- */
  const getNodeOpacity = useCallback((nodeId: string): number => {
    if (!activeNode) return 1;
    if (nodeId === activeNode) return 1;
    if (connectedTo.get(activeNode)?.has(nodeId)) return 1;
    return 0.15;
  }, [activeNode, connectedTo]);

  /* ---- Edge style ---- */
  const getEdgeOpacity = useCallback((edge: GraphEdge): { opacity: number; highlighted: boolean } => {
    const isActive = activeNode && (edge.source === activeNode || edge.target === activeNode);
    if (isActive) return { opacity: 0.9, highlighted: true };
    if (activeNode) return { opacity: 0.06, highlighted: false };
    return { opacity: 0.25, highlighted: false };
  }, [activeNode]);

  if (!isOpen) return null;

  const pageCount = Object.keys(pages).length;

  /* ---- Colours for the current theme ---- */
  const bgColor = isDark ? '#0a0e1a' : '#f8fafc';
  const gridColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
  const edgeDefaultColor = isDark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.3)';
  const edgeHighlightColor = isDark ? '#60a5fa' : '#3b82f6';

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop blur */}
      <div className="absolute inset-0 backdrop-blur-sm pointer-events-none" />

      {/* Modal container */}
      <div
        ref={containerRef}
        className="relative max-w-6xl w-full mx-4 mt-[3vh] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        style={{ maxHeight: '92vh' }}
      >
        {/* ---- Header / Toolbar ---- */}
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-border bg-muted/50"
        >
          {/* Left: title + stats */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="12" cy="18" r="3" />
                <line x1="8.5" y1="7.5" x2="10.5" y2="16" />
                <line x1="15.5" y1="7.5" x2="13.5" y2="16" />
                <line x1="9" y1="6" x2="15" y2="6" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Page Relationships
              </h2>
              <span className="text-xs text-muted-foreground">
                {layoutNodes.length} pages &middot; {edges.length} connections
              </span>
            </div>
          </div>

          {/* Center: layout switcher */}
          <div
            className="flex items-center rounded-lg p-0.5 gap-0.5 bg-muted/50"
          >
            {([
              { mode: 'force' as LayoutMode, icon: <Network size={12} className="w-3 h-3" />, label: 'Force' },
              { mode: 'hierarchical' as LayoutMode, icon: <GitBranch size={12} className="w-3 h-3" />, label: 'Tree' },
              { mode: 'radial' as LayoutMode, icon: <CircleDot size={12} className="w-3 h-3" />, label: 'Radial' },
            ]).map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setLayoutMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  layoutMode === mode
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Right: zoom controls + close */}
          <div className="flex items-center gap-1">
            <button
              onClick={zoomIn}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted"
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn size={14} className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={zoomOut}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted"
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut size={14} className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fitToView}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted"
              aria-label="Fit to view"
              title="Fit to view"
            >
              <Maximize size={14} className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-5 mx-1 bg-border/50" />

            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-muted"
              aria-label="Close graph"
            >
              <X size={14} className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ---- Graph area ---- */}
        <div className="flex-1 relative" style={{ minHeight: '500px' }}>
          {pageCount < 3 ? (
            <div
              className="flex items-center justify-center h-full min-h-[500px] text-sm text-muted-foreground"
            >
              Not enough pages to display a graph (need at least 3)
            </div>
          ) : (
            <>
              <svg
                ref={svgRef}
                className="w-full h-full"
                style={{ minHeight: '500px', cursor: isPanning.current ? 'grabbing' : 'grab' }}
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                preserveAspectRatio="xMidYMid meet"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                <defs>
                  {/* Arrow marker */}
                  <marker
                    id="arrow-default"
                    viewBox="0 0 10 8"
                    refX="10"
                    refY="4"
                    markerWidth="8"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 4 L 0 8 Z" fill={edgeDefaultColor} />
                  </marker>
                  <marker
                    id="arrow-highlight"
                    viewBox="0 0 10 8"
                    refX="10"
                    refY="4"
                    markerWidth="8"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 4 L 0 8 Z" fill={edgeHighlightColor} />
                  </marker>

                  {/* Glow filter for selected / current nodes */}
                  <filter id="node-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Subtle shadow for all nodes */}
                  <filter id="node-shadow" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)'} floodOpacity="1" />
                  </filter>
                </defs>

                {/* Background */}
                <rect
                  className="graph-bg"
                  x={viewBox.x - 2000}
                  y={viewBox.y - 2000}
                  width={viewBox.w + 4000}
                  height={viewBox.h + 4000}
                  fill={bgColor}
                  onClick={handleBgClick}
                />

                {/* Grid pattern */}
                {(() => {
                  const gridSpacing = 80;
                  const startX = Math.floor((viewBox.x - 100) / gridSpacing) * gridSpacing;
                  const startY = Math.floor((viewBox.y - 100) / gridSpacing) * gridSpacing;
                  const endX = viewBox.x + viewBox.w + 100;
                  const endY = viewBox.y + viewBox.h + 100;
                  const lines: React.ReactNode[] = [];
                  for (let x = startX; x <= endX; x += gridSpacing) {
                    lines.push(
                      <line key={`gx-${x}`} x1={x} y1={startY} x2={x} y2={endY} stroke={gridColor} strokeWidth="1" />
                    );
                  }
                  for (let y = startY; y <= endY; y += gridSpacing) {
                    lines.push(
                      <line key={`gy-${y}`} x1={startX} y1={y} x2={endX} y2={y} stroke={gridColor} strokeWidth="1" />
                    );
                  }
                  return <g>{lines}</g>;
                })()}

                {/* Edges */}
                <g>
                  {edges.map((edge, i) => {
                    const source = nodePositions.get(edge.source);
                    const target = nodePositions.get(edge.target);
                    if (!source || !target) return null;

                    const { opacity, highlighted } = getEdgeOpacity(edge);
                    const color = highlighted ? edgeHighlightColor : edgeDefaultColor;

                    return (
                      <path
                        key={`edge-${i}`}
                        d={edgePath(source.x, source.y, target.x, target.y)}
                        fill="none"
                        stroke={color}
                        strokeWidth={highlighted ? 2 : 1}
                        opacity={opacity}
                        markerEnd={highlighted ? 'url(#arrow-highlight)' : 'url(#arrow-default)'}
                        style={{ transition: 'opacity 0.2s ease, stroke 0.2s ease, stroke-width 0.2s ease' }}
                      />
                    );
                  })}
                </g>

                {/* Nodes */}
                <g>
                  {layoutNodes.map(node => {
                    const isCurrent = node.id === currentPageId;
                    const isSelected = node.id === selectedNode;
                    const isHighlighted = isCurrent || isSelected;
                    const opacity = getNodeOpacity(node.id);
                    const theme = getTheme(node.category);

                    const w = getNodeWidth(node, currentPageId);
                    const h = getNodeHeight(node, currentPageId);
                    const rx = NODE_RADIUS;

                    return (
                      <g
                        key={node.id}
                        className="graph-node"
                        style={{
                          cursor: 'pointer',
                          opacity,
                          transition: 'opacity 0.2s ease',
                        }}
                        onClick={(e) => handleNodeClick(node.id, e)}
                        onMouseEnter={(e) => handleNodeMouseEnter(node.id, e)}
                        onMouseMove={handleNodeMouseMove}
                        onMouseLeave={handleNodeMouseLeave}
                      >
                        {/* Highlight glow ring for current / selected */}
                        {isHighlighted && (
                          <rect
                            x={node.x - w / 2 - 4}
                            y={node.y - h / 2 - 4}
                            width={w + 8}
                            height={h + 8}
                            rx={rx + 4}
                            ry={rx + 4}
                            fill="none"
                            stroke={isCurrent ? (isDark ? '#60a5fa' : '#3b82f6') : theme.border}
                            strokeWidth="2"
                            opacity="0.4"
                            filter="url(#node-glow)"
                          />
                        )}

                        {/* Main rectangle */}
                        <rect
                          x={node.x - w / 2}
                          y={node.y - h / 2}
                          width={w}
                          height={h}
                          rx={rx}
                          ry={rx}
                          fill={theme.bg}
                          stroke={
                            node.id === hoveredNode
                              ? (isDark ? '#60a5fa' : '#3b82f6')
                              : isHighlighted
                                ? (isCurrent ? (isDark ? '#60a5fa' : '#3b82f6') : theme.border)
                                : theme.border
                          }
                          strokeWidth={isHighlighted ? 2 : node.id === hoveredNode ? 2 : 1.2}
                          filter="url(#node-shadow)"
                        />

                        {/* Category indicator stripe on the left */}
                        <rect
                          x={node.x - w / 2 + 1}
                          y={node.y - h / 2 + rx}
                          width={3}
                          height={h - rx * 2}
                          fill={theme.border}
                        />

                        {/* Node title text */}
                        <text
                          x={node.x + 2}
                          y={node.y - 2}
                          textAnchor="middle"
                          dominantBaseline="auto"
                          fill={theme.text}
                          style={{
                            fontSize: isCurrent ? '12px' : '11px',
                            fontWeight: 600,
                            pointerEvents: 'none',
                            userSelect: 'none',
                            letterSpacing: '0.01em',
                          }}
                        >
                          {truncate(node.title, 22)}
                        </text>

                        {/* Importance badge */}
                        <text
                          x={node.x + 2}
                          y={node.y + 13}
                          textAnchor="middle"
                          dominantBaseline="auto"
                          fill={theme.text}
                          style={{
                            fontSize: '9px',
                            fontWeight: 400,
                            opacity: 0.6,
                            pointerEvents: 'none',
                            userSelect: 'none',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {CATEGORY_THEMES[node.category].label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Tooltip */}
              {tooltip && (
                <div
                  className="fixed z-50 pointer-events-none"
                  style={{
                    left: tooltip.x + 14,
                    top: tooltip.y - 12,
                    maxWidth: '320px',
                  }}
                >
                  <div
                    className="px-3 py-2 rounded-lg text-xs bg-popover text-popover-foreground border border-border shadow-lg"
                  >
                    <div className="font-semibold mb-0.5" style={{ fontSize: '12px' }}>
                      {tooltip.title}
                    </div>
                    <div className="text-muted-foreground" style={{ fontSize: '10px' }}>
                      {CATEGORY_THEMES[tooltip.category].label} &middot; Click to focus, double-click to open
                    </div>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div
                className="absolute bottom-3 left-3 rounded-xl overflow-hidden bg-popover/90 border border-border/30 backdrop-blur-md shadow-sm"
              >
                <div
                  className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border/30 uppercase tracking-wide"
                  style={{ fontSize: '9px' }}
                >
                  Legend
                </div>
                <div className="px-3 py-2 flex flex-col gap-1.5">
                  {(Object.entries(CATEGORY_THEMES) as [NodeCategory, CategoryTheme][])
                    .filter(([cat]) => presentCategories.has(cat))
                    .map(([cat, theme]) => {
                      const t = isDark ? theme.dark : theme.light;
                      return (
                        <div key={cat} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{
                              backgroundColor: t.bg,
                              border: `1.5px solid ${t.border}`,
                            }}
                          />
                          <span
                            className="text-xs text-muted-foreground"
                            style={{ fontSize: '11px' }}
                          >
                            {theme.label}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Interaction hint */}
              <div
                className="absolute bottom-3 right-3 px-3 py-2 rounded-xl text-xs text-muted-foreground bg-popover/90 border border-border/30 backdrop-blur-md shadow-sm"
              >
                Scroll to zoom &middot; Drag to pan &middot; Click node to focus
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
