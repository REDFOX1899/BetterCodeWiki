import { type Node, type Edge } from '@xyflow/react';
import dagre from 'dagre';
import type { DiagramData, DiagramNode } from '@/types/diagramData';

/* ------------------------------------------------------------------ */
/*  Category inference for explorer nodes                              */
/* ------------------------------------------------------------------ */

export type ExplorerCategory =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'cache'
  | 'external'
  | 'queue'
  | 'general';

const CATEGORY_PATTERNS: [RegExp, ExplorerCategory][] = [
  [/\b(react|vue|angular|svelte|next|nuxt|frontend|ui|css|html|browser|client|component|widget|page|view)\b/i, 'frontend'],
  [/\b(api|server|backend|controller|service|handler|middleware|gateway|rest|graphql|grpc|express|fastapi|django|flask|spring)\b/i, 'backend'],
  [/\b(database|db|postgres|mysql|sqlite|mongo|dynamo|sql|table|schema|migration|prisma|orm|supabase|firestore)\b/i, 'database'],
  [/\b(redis|cache|memcache|cdn|varnish)\b/i, 'cache'],
  [/\b(queue|kafka|rabbit|rabbitmq|sqs|pubsub|event|stream|worker|job|celery)\b/i, 'queue'],
  [/\b(external|third.?party|webhook|oauth|stripe|twilio|s3|aws|gcp|azure|cloud|smtp|email)\b/i, 'external'],
];

export function inferExplorerCategory(node: DiagramNode): ExplorerCategory {
  const text = `${node.label} ${node.technology ?? ''} ${node.description ?? ''}`;
  for (const [re, cat] of CATEGORY_PATTERNS) {
    if (re.test(text)) return cat;
  }
  return 'general';
}

/* ------------------------------------------------------------------ */
/*  Category colors for nodes                                          */
/* ------------------------------------------------------------------ */

export const EXPLORER_CATEGORY_COLORS: Record<ExplorerCategory, { light: string; dark: string; bg: string; darkBg: string }> = {
  frontend:  { light: '#3b82f6', dark: '#60a5fa', bg: '#eff6ff', darkBg: 'rgba(59, 130, 246, 0.12)' },
  backend:   { light: '#8b5cf6', dark: '#a78bfa', bg: '#f5f3ff', darkBg: 'rgba(139, 92, 246, 0.12)' },
  database:  { light: '#10b981', dark: '#34d399', bg: '#ecfdf5', darkBg: 'rgba(16, 185, 129, 0.12)' },
  cache:     { light: '#f59e0b', dark: '#fbbf24', bg: '#fffbeb', darkBg: 'rgba(245, 158, 11, 0.12)' },
  queue:     { light: '#ec4899', dark: '#f472b6', bg: '#fdf2f8', darkBg: 'rgba(236, 72, 153, 0.12)' },
  external:  { light: '#6b7280', dark: '#9ca3af', bg: '#f9fafb', darkBg: 'rgba(107, 114, 128, 0.12)' },
  general:   { light: '#6b7280', dark: '#9ca3af', bg: '#f9fafb', darkBg: 'rgba(107, 114, 128, 0.12)' },
};

export const CATEGORY_LABELS: Record<ExplorerCategory, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Database',
  cache: 'Cache',
  queue: 'Queue',
  external: 'External',
  general: 'Module',
};

/* ------------------------------------------------------------------ */
/*  Edge type styles                                                   */
/* ------------------------------------------------------------------ */

export const EDGE_TYPE_STYLES: Record<string, { stroke: string; darkStroke: string; strokeDasharray?: string; animated: boolean }> = {
  api_call:   { stroke: '#3b82f6', darkStroke: '#60a5fa', animated: false },
  data_flow:  { stroke: '#10b981', darkStroke: '#34d399', animated: true },
  dependency: { stroke: '#9ca3af', darkStroke: '#d1d5db', strokeDasharray: '5 3', animated: false },
};

/* ------------------------------------------------------------------ */
/*  View types and layout directions                                   */
/* ------------------------------------------------------------------ */

export type ExplorerView = 'architecture' | 'dataflow' | 'dependencies';

const VIEW_LAYOUT: Record<ExplorerView, { rankdir: string; ranksep: number; nodesep: number }> = {
  architecture:  { rankdir: 'TB', ranksep: 120, nodesep: 70 },
  dataflow:      { rankdir: 'LR', ranksep: 150, nodesep: 70 },
  dependencies:  { rankdir: 'TB', ranksep: 110, nodesep: 60 },
};

/* ------------------------------------------------------------------ */
/*  Conversion options                                                 */
/* ------------------------------------------------------------------ */

interface ConvertOptions {
  maxDepth?: number;
  view?: ExplorerView;
  isDark?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Main conversion function                                           */
/* ------------------------------------------------------------------ */

export function diagramDataToReactFlow(
  data: DiagramData,
  options?: ConvertOptions,
): { nodes: Node[]; edges: Edge[] } {
  const maxDepth = options?.maxDepth ?? Infinity;
  const view = options?.view ?? 'architecture';
  const isDark = options?.isDark ?? false;
  const layout = VIEW_LAYOUT[view];

  // 1. Filter nodes by depth
  const filteredNodes = data.nodes.filter((n) => n.depth <= maxDepth);
  const nodeIds = new Set(filteredNodes.map((n) => n.id));

  // 2. Create React Flow nodes (positions will be set by dagre)
  const rfNodes: Node[] = filteredNodes.map((n) => {
    const category = inferExplorerCategory(n);
    return {
      id: n.id,
      type: 'explorer',
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        technology: n.technology ?? null,
        files: n.files,
        description: n.description ?? null,
        depth: n.depth,
        category,
        isDark,
      },
    };
  });

  // 3. Create React Flow edges (only for nodes that survived filtering)
  const rfEdges: Edge[] = data.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e, idx) => {
      const style = EDGE_TYPE_STYLES[e.type] ?? EDGE_TYPE_STYLES.dependency;
      const strokeColor = isDark ? style.darkStroke : style.stroke;
      return {
        id: `e-${e.source}-${e.target}-${idx}`,
        source: e.source,
        target: e.target,
        type: 'explorer',
        animated: style.animated,
        style: {
          stroke: strokeColor,
          strokeWidth: 1.5,
          ...(style.strokeDasharray ? { strokeDasharray: style.strokeDasharray } : {}),
        },
        data: { edgeType: e.type, label: e.label ?? undefined, isDark },
      };
    });

  // 4. Run dagre layout
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: layout.rankdir, ranksep: layout.ranksep, nodesep: layout.nodesep });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 240;
  const nodeHeight = 76;

  for (const n of rfNodes) {
    g.setNode(n.id, { width: nodeWidth, height: nodeHeight });
  }

  for (const e of rfEdges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  // 5. Map dagre positions back to React Flow nodes
  // Determine handle positions based on layout direction
  const isHorizontal = layout.rankdir === 'LR';
  for (const n of rfNodes) {
    const dagreNode = g.node(n.id);
    if (dagreNode) {
      n.position = {
        x: dagreNode.x - nodeWidth / 2,
        y: dagreNode.y - nodeHeight / 2,
      };
    }
    // Pass layout direction to node data for handle positioning
    (n.data as Record<string, unknown>).isHorizontal = isHorizontal;
  }

  return { nodes: rfNodes, edges: rfEdges };
}
