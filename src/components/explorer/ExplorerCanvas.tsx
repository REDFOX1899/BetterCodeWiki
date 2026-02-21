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
import { diagramDataToReactFlow } from '@/lib/diagramToReactFlow';
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
  onNodeClick: (nodeId: string) => void;
  selectedNodeId: string | null;
}

/* ------------------------------------------------------------------ */
/*  Inner canvas (needs ReactFlowProvider as ancestor)                 */
/* ------------------------------------------------------------------ */

function CanvasInner({ diagramData, maxDepth, onNodeClick, selectedNodeId }: ExplorerCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const { fitView } = useReactFlow();

  // Recompute layout when data or depth changes
  useEffect(() => {
    if (!diagramData) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: rfNodes, edges: rfEdges } = diagramDataToReactFlow(diagramData, { maxDepth });
    setNodes(rfNodes);
    setEdges(rfEdges);

    // fitView after layout in next frame
    requestAnimationFrame(() => {
      fitView({ padding: 0.15, duration: 300 });
    });
  }, [diagramData, maxDepth, setNodes, setEdges, fitView]);

  // Apply selected state
  const styledNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
      })),
    [nodes, selectedNodeId],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick(node.id);
    },
    [onNodeClick],
  );

  return (
    <ReactFlow
      nodes={styledNodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      proOptions={{ hideAttribution: false }}
      minZoom={0.1}
      maxZoom={2}
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
        nodeColor={(n) => {
          if (n.id === selectedNodeId) return '#3b82f6';
          return '#9ca3af';
        }}
        maskColor="rgba(0,0,0,0.08)"
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
