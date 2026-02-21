'use client';

import React, { memo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
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
  const label = (data as Record<string, unknown> | undefined)?.label as string | undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const edgeStyle = hovered
    ? { ...style, strokeWidth: 2.5 }
    : style;

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
      {label && hovered && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-[10px] font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-800 px-2 py-1 rounded-md border border-gray-200 dark:border-zinc-600 shadow-lg"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              zIndex: 1000,
              pointerEvents: 'none',
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
