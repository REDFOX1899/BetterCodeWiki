'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { DiagramData } from '@/types/diagramData';
import {
  diagramDataToReactFlow,
  EXPLORER_CATEGORY_COLORS,
  inferExplorerCategory,
  type ExplorerView,
} from '@/lib/diagramToReactFlow';
import ExplorerNode from './ExplorerNode';
import ExplorerEdge from './ExplorerEdge';

/* ------------------------------------------------------------------ */
/*  Custom node / edge type registration                               */
/* ------------------------------------------------------------------ */

const nodeTypes = { explorer: ExplorerNode };
const edgeTypes = { explorer: ExplorerEdge };

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ExplorerCanvasProps {
  diagramData: DiagramData | null;
  maxDepth: number;
  view: ExplorerView;
  onNodeClick: (nodeId: string) => void;
  selectedNodeId: string | null;
  /** Increment this to trigger a zoom-to-fit */
  fitViewTrigger?: number;
}

/* ------------------------------------------------------------------ */
/*  Inner canvas (needs ReactFlowProvider as ancestor)                 */
/* ------------------------------------------------------------------ */

function CanvasInner({ diagramData, maxDepth, view, onNodeClick, selectedNodeId, fitViewTrigger }: ExplorerCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const { fitView } = useReactFlow();

  // Detect dark mode for theme-aware node/edge colors
  const [isDark, setIsDark] = React.useState(false);
  React.useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Recompute layout when data, depth, view, or theme changes
  useEffect(() => {
    if (!diagramData) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: rfNodes, edges: rfEdges } = diagramDataToReactFlow(diagramData, { maxDepth, view, isDark });
    setNodes(rfNodes);
    setEdges(rfEdges);

    // fitView after layout in next frame
    requestAnimationFrame(() => {
      fitView({ padding: 0.15, duration: 400 });
    });
  }, [diagramData, maxDepth, view, isDark, setNodes, setEdges, fitView]);

  // Respond to external fit-view trigger
  useEffect(() => {
    if (fitViewTrigger && fitViewTrigger > 0) {
      fitView({ padding: 0.15, duration: 400 });
    }
  }, [fitViewTrigger, fitView]);

  // Build connected-node set for highlighting
  const connectedIds = useMemo(() => {
    if (!selectedNodeId) return null;
    const ids = new Set<string>([selectedNodeId]);
    for (const e of edges) {
      if (e.source === selectedNodeId) ids.add(e.target);
      if (e.target === selectedNodeId) ids.add(e.source);
    }
    return ids;
  }, [selectedNodeId, edges]);

  // Apply selected + dimming state to nodes
  const styledNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
        data: {
          ...n.data,
          dimmed: connectedIds ? !connectedIds.has(n.id) : false,
        },
      })),
    [nodes, selectedNodeId, connectedIds],
  );

  // Apply dimming state to edges
  const styledEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        data: {
          ...e.data,
          dimmed: connectedIds
            ? !(connectedIds.has(e.source) && connectedIds.has(e.target))
            : false,
        },
      })),
    [edges, connectedIds],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.id);
    },
    [onNodeClick],
  );

  // Build a category-to-color lookup from the actual diagram data for the minimap
  const minimapNodeColor = useCallback(
    (n: Node) => {
      if (n.id === selectedNodeId) return '#3b82f6';
      if (diagramData) {
        const diagramNode = diagramData.nodes.find((dn) => dn.id === n.id);
        if (diagramNode) {
          const cat = inferExplorerCategory(diagramNode);
          return EXPLORER_CATEGORY_COLORS[cat]?.light ?? '#9ca3af';
        }
      }
      return '#9ca3af';
    },
    [selectedNodeId, diagramData],
  );

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={styledEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      proOptions={{ hideAttribution: false }}
      minZoom={0.05}
      maxZoom={2.5}
      className="bg-gray-50 dark:bg-zinc-950"
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-gray-50 dark:!bg-zinc-950" />
      <Controls
        position="bottom-left"
        className="!bg-white dark:!bg-zinc-900 !border-gray-200 dark:!border-zinc-700 !shadow-sm [&>button]:!bg-white dark:[&>button]:!bg-zinc-900 [&>button]:!border-gray-200 dark:[&>button]:!border-zinc-700 [&>button]:!text-gray-600 dark:[&>button]:!text-gray-300"
      />
      <MiniMap
        position="bottom-right"
        className="!bg-white dark:!bg-zinc-900 !border-gray-200 dark:!border-zinc-700 !shadow-sm"
        nodeColor={minimapNodeColor}
        maskColor="rgba(0,0,0,0.08)"
        pannable
        zoomable
      />
    </ReactFlow>
  );
}

/* ------------------------------------------------------------------ */
/*  Public wrapper with ReactFlowProvider                              */
/* ------------------------------------------------------------------ */

export default function ExplorerCanvas(props: ExplorerCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
