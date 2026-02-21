'use client';

import React, { memo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

function ExplorerEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  animated,
  data,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const edgeData = data as Record<string, unknown> | undefined;
  const label = edgeData?.label as string | undefined;
  const dimmed = (edgeData?.dimmed as boolean) ?? false;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const strokeColor = (style as React.CSSProperties)?.stroke ?? '#9ca3af';
  const baseOpacity = dimmed ? 0.15 : 1;
  const edgeStyle: React.CSSProperties = {
    ...style,
    strokeWidth: hovered ? 2.5 : (style as React.CSSProperties)?.strokeWidth ?? 1.5,
    opacity: hovered ? 1 : baseOpacity,
    transition: 'opacity 0.2s ease, stroke-width 0.15s ease',
  };

  return (
    <>
      {/* Invisible wider path for easier hover targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        className={animated ? 'react-flow__edge-path animated' : ''}
      />
      {/* Arrow marker at target end */}
      <defs>
        <marker
          id={`arrow-${id}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={strokeColor} opacity={baseOpacity} />
        </marker>
      </defs>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        markerEnd={`url(#arrow-${id})`}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className={`absolute text-[10px] font-medium px-1.5 py-0.5 rounded border pointer-events-none transition-all duration-150 ${
              hovered
                ? 'opacity-100 text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-600 shadow-md'
                : dimmed
                  ? 'opacity-20 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-zinc-900 border-gray-100 dark:border-zinc-800'
                  : 'opacity-80 text-gray-600 dark:text-gray-300 bg-white/90 dark:bg-zinc-800/90 border-gray-200 dark:border-zinc-600 shadow-sm'
            }`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              zIndex: hovered ? 1000 : 1,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(ExplorerEdgeComponent);
