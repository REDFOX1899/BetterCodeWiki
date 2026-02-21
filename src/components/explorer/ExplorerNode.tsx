'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { getIconSvg } from '@/lib/techIcons';
import { EXPLORER_CATEGORY_COLORS, type ExplorerCategory } from '@/lib/diagramToReactFlow';

interface ExplorerNodeData {
  label: string;
  technology: string | null;
  files: string[];
  description: string | null;
  depth: number;
  category: ExplorerCategory;
  [key: string]: unknown;
}

function ExplorerNodeComponent({ data, selected }: NodeProps) {
  const { label, technology, category } = data as unknown as ExplorerNodeData;

  const borderColor = EXPLORER_CATEGORY_COLORS[category] ?? EXPLORER_CATEGORY_COLORS.general;
  const icon = technology ? getIconSvg(technology) : null;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-400 dark:!bg-gray-500 !border-none" />
      <div
        className={`
          w-[200px] px-3 py-2.5 rounded-lg bg-white dark:bg-zinc-900
          border border-gray-200 dark:border-zinc-700
          transition-shadow duration-150
          ${selected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'}
        `}
        style={{ borderLeftWidth: 3, borderLeftColor: `var(--explorer-border, ${borderColor.light})` }}
      >
        {/* Inject CSS custom prop for dark mode */}
        <style>{`
          .dark [data-explorer-cat="${category}"] { --explorer-border: ${borderColor.dark}; }
          :not(.dark) [data-explorer-cat="${category}"] { --explorer-border: ${borderColor.light}; }
        `}</style>
        <div data-explorer-cat={category} style={{ display: 'contents' }} />

        <div className="flex items-start gap-2">
          {icon && (
            <div
              className="shrink-0 mt-0.5"
              dangerouslySetInnerHTML={{
                __html: icon.svg.replace(
                  '<svg ',
                  `<svg width="18" height="18" fill="#${icon.hex}" `,
                ),
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {label}
            </div>
            {technology && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {technology}
              </div>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-400 dark:!bg-gray-500 !border-none" />
    </>
  );
}

export default memo(ExplorerNodeComponent);
