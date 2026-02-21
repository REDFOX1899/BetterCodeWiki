'use client';

import React from 'react';

interface DepthToggleProps {
  depth: number; // 0, 1, or 2
  onDepthChange: (depth: number) => void;
  maxAvailableDepth: number;
}

const DEPTH_LEVELS = [
  { value: 0, label: 'Overview' },
  { value: 1, label: 'Detailed' },
  { value: 2, label: 'Full' },
] as const;

const DepthToggle: React.FC<DepthToggleProps> = ({
  depth,
  onDepthChange,
  maxAvailableDepth,
}) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Depth:</span>
      <div className="inline-flex rounded-lg border border-border overflow-hidden">
        {DEPTH_LEVELS.map((level, idx) => {
          const isActive = depth === level.value;
          const isDisabled = level.value > maxAvailableDepth;
          const isFirst = idx === 0;
          const isLast = idx === DEPTH_LEVELS.length - 1;

          return (
            <button
              key={level.value}
              onClick={() => onDepthChange(level.value)}
              disabled={isDisabled}
              className={`
                px-3 py-1.5 text-xs font-medium transition-colors
                ${!isFirst ? 'border-l border-border' : ''}
                ${isFirst ? 'rounded-l-md' : ''}
                ${isLast ? 'rounded-r-md' : ''}
                ${isActive
                  ? 'bg-blue-500 text-white'
                  : isDisabled
                    ? 'bg-muted/30 text-muted-foreground/40 cursor-not-allowed'
                    : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted'}
              `}
            >
              {level.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DepthToggle;
