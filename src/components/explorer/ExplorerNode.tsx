'use client';

import React, { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { getIconSvg } from '@/lib/techIcons';
import {
  EXPLORER_CATEGORY_COLORS,
  CATEGORY_LABELS,
  type ExplorerCategory,
} from '@/lib/diagramToReactFlow';

interface ExplorerNodeData {
  label: string;
  technology: string | null;
  files: string[];
  description: string | null;
  depth: number;
  category: ExplorerCategory;
  isHorizontal?: boolean;
  isDark?: boolean;
  dimmed?: boolean;
  [key: string]: unknown;
}

function ExplorerNodeComponent({ data, selected }: NodeProps) {
  const { label, technology, files, description, category, isHorizontal, isDark, dimmed } = data as unknown as ExplorerNodeData;
  const [showTooltip, setShowTooltip] = useState(false);

  const colors = EXPLORER_CATEGORY_COLORS[category] ?? EXPLORER_CATEGORY_COLORS.general;
  const categoryLabel = CATEGORY_LABELS[category] ?? 'Module';
  const icon = technology ? getIconSvg(technology) : null;
  const fileCount = files?.length ?? 0;

  const targetPos = isHorizontal ? Position.Left : Position.Top;
  const sourcePos = isHorizontal ? Position.Right : Position.Bottom;

  const bgColor = isDark ? colors.darkBg : colors.bg;
  const borderAccent = isDark ? colors.dark : colors.light;
  const badgeColor = isDark ? colors.dark : colors.light;

  return (
    <>
      <Handle type="target" position={targetPos} className="!w-2 !h-2 !bg-gray-400 dark:!bg-gray-500 !border-none" />
      <div
        className={`
          w-[220px] px-3 py-2.5 rounded-lg
          border transition-all duration-200
          ${selected
            ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 border-blue-300 dark:border-blue-600'
            : 'border-gray-200 dark:border-zinc-700 hover:shadow-md'}
        `}
        style={{
          borderLeftWidth: 3,
          borderLeftColor: borderAccent,
          backgroundColor: bgColor,
          opacity: dimmed ? 0.3 : 1,
          transition: 'opacity 0.2s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
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
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
              {label}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{
                  color: badgeColor,
                  backgroundColor: isDark ? `${colors.dark}20` : `${colors.light}18`,
                  border: `1px solid ${isDark ? `${colors.dark}40` : `${colors.light}30`}`,
                }}
              >
                {categoryLabel}
              </span>
              {technology && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                  {technology}
                </span>
              )}
              {fileCount > 0 && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto tabular-nums">
                  {fileCount} {fileCount === 1 ? 'file' : 'files'}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Description tooltip on hover */}
        {description && showTooltip && !dimmed && (
          <div
            className="absolute left-0 right-0 -bottom-1 translate-y-full z-50 px-2.5 py-2 rounded-md text-[11px] leading-relaxed text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 shadow-lg max-w-[260px]"
          >
            {description.length > 120 ? `${description.slice(0, 120)}...` : description}
          </div>
        )}
      </div>
      <Handle type="source" position={sourcePos} className="!w-2 !h-2 !bg-gray-400 dark:!bg-gray-500 !border-none" />
    </>
  );
}

export default memo(ExplorerNodeComponent);
