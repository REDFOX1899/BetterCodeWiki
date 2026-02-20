'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ComparisonRow {
  feature: string;
  us: boolean;
  them: boolean;
}

const rows: ComparisonRow[] = [
  { feature: 'Fully open source (MIT)', us: true, them: false },
  { feature: 'Self-hostable', us: true, them: false },
  { feature: 'Bring your own AI model', us: true, them: false },
  { feature: 'GitHub, GitLab & Bitbucket', us: true, them: false },
  { feature: 'Auto-generated architecture diagrams', us: true, them: false },
  { feature: 'Interactive AI chat about code', us: true, them: true },
  { feature: 'Private repository support', us: true, them: true },
  { feature: 'No data leaves your infra', us: true, them: false },
];

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-success"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-muted-foreground/40"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function ComparisonTable() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-display-sm text-foreground mb-4">Built Different</h2>
          <p className="text-body-lg text-muted-foreground max-w-xl mx-auto">
            See how BetterCodeWiki compares to closed-source alternatives.
          </p>
        </motion.div>

        {/* Comparison Table */}
        <motion.div
          className="rounded-xl border border-border overflow-hidden"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_140px_140px] md:grid-cols-[1fr_160px_160px] bg-muted/50">
            <div className="px-6 py-4 text-label-lg text-muted-foreground">
              Feature
            </div>
            <div className="px-6 py-4 text-label-lg text-primary text-center">
              BetterCodeWiki
            </div>
            <div className="px-6 py-4 text-label-lg text-muted-foreground text-center">
              Closed-Source Tools
            </div>
          </div>

          {/* Table Rows */}
          {rows.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-[1fr_140px_140px] md:grid-cols-[1fr_160px_160px] ${
                i % 2 === 0 ? 'bg-card' : 'bg-card/50'
              } ${i < rows.length - 1 ? 'border-b border-border/50' : ''}`}
            >
              <div className="px-6 py-4 text-body-md text-foreground flex items-center">
                {row.feature}
              </div>
              <div className="px-6 py-4 flex items-center justify-center">
                {row.us ? <CheckIcon /> : <XIcon />}
              </div>
              <div className="px-6 py-4 flex items-center justify-center">
                {row.them ? <CheckIcon /> : <XIcon />}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
