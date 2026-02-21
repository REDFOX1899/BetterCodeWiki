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
/*  Category border colors for nodes                                   */
/* ------------------------------------------------------------------ */

export const EXPLORER_CATEGORY_COLORS: Record<ExplorerCategory, { light: string; dark: string }> = {
  frontend:  { light: '#3b82f6', dark: '#60a5fa' },
  backend:   { light: '#8b5cf6', dark: '#a78bfa' },
  database:  { light: '#10b981', dark: '#34d399' },
  cache:     { light: '#f59e0b', dark: '#fbbf24' },
  queue:     { light: '#ec4899', dark: '#f472b6' },
  external:  { light: '#6b7280', dark: '#9ca3af' },
  general:   { light: '#6b7280', dark: '#9ca3af' },
};

/* ------------------------------------------------------------------ */
/*  Edge type colors                                                   */
/* ------------------------------------------------------------------ */

const EDGE_TYPE_STYLES: Record<string, { stroke: string; animated: boolean }> = {
  api_call:   { stroke: '#3b82f6', animated: false },
  data_flow:  { stroke: '#10b981', animated: true },
  dependency: { stroke: '#9ca3af', animated: false },
};

/* ------------------------------------------------------------------ */
/*  Conversion options                                                 */
/* ------------------------------------------------------------------ */

interface ConvertOptions {
  maxDepth?: number; // Filter nodes by depth (0=overview, 1=detailed, 2=full)
}

/* ------------------------------------------------------------------ */
/*  Main conversion function                                           */
/* ------------------------------------------------------------------ */

export function diagramDataToReactFlow(
  data: DiagramData,
  options?: ConvertOptions,
): { nodes: Node[]; edges: Edge[] } {
  const maxDepth = options?.maxDepth ?? 2;

  // 1. Filter nodes by depth
  const filteredNodes = data.nodes.filter((n) => n.depth <= maxDepth);
  const nodeIds = new Set(filteredNodes.map((n) => n.id));

  // 2. Create React Flow nodes (positions will be set by dagre)
  const rfNodes: Node[] = filteredNodes.map((n) => ({
    id: n.id,
    type: 'explorer',
    position: { x: 0, y: 0 },
    data: {
      label: n.label,
      technology: n.technology ?? null,
      files: n.files,
      description: n.description ?? null,
      depth: n.depth,
      category: inferExplorerCategory(n),
    },
  }));

  // 3. Create React Flow edges (only for nodes that survived filtering)
  const rfEdges: Edge[] = data.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e, idx) => {
      const style = EDGE_TYPE_STYLES[e.type] ?? EDGE_TYPE_STYLES.dependency;
      return {
        id: `e-${e.source}-${e.target}-${idx}`,
        source: e.source,
        target: e.target,
        type: 'explorer',
        label: e.label ?? undefined,
        animated: style.animated,
        style: { stroke: style.stroke, strokeWidth: 1.5 },
        data: { edgeType: e.type },
      };
    });

  // 4. Run dagre layout
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 50 });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 220;
  const nodeHeight = 80;

  for (const n of rfNodes) {
    g.setNode(n.id, { width: nodeWidth, height: nodeHeight });
  }

  for (const e of rfEdges) {
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  // 5. Map dagre positions back to React Flow nodes
  for (const n of rfNodes) {
    const dagreNode = g.node(n.id);
    if (dagreNode) {
      n.position = {
        x: dagreNode.x - nodeWidth / 2,
        y: dagreNode.y - nodeHeight / 2,
      };
    }
  }

  return { nodes: rfNodes, edges: rfEdges };
}
