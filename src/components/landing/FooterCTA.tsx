'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface FooterCTAProps {
  onSubmit: (e: React.FormEvent) => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSubmitting: boolean;
}

export default function FooterCTA({
  onSubmit,
  value,
  onChange,
  isSubmitting,
}: FooterCTAProps) {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      {/* Gradient background accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />

      <div className="relative max-w-3xl mx-auto text-center">
        {/* Header */}
        <motion.h2
          className="text-display-sm text-foreground mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Ready to Understand Your Code?
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          className="text-body-lg text-muted-foreground mb-10 max-w-xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Paste a repository URL and generate your wiki in under 60 seconds.
        </motion.p>

        {/* Search Form (same pattern as hero) */}
        <motion.form
          onSubmit={onSubmit}
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="relative flex items-center">
            <div className="absolute left-4 text-muted-foreground pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={value}
              onChange={onChange}
              placeholder="https://github.com/owner/repo"
              className="w-full h-14 pl-12 pr-36 border border-input rounded-xl bg-card/80 backdrop-blur-sm text-body-lg ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:elevation-2 transition-all elevation-1"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="absolute right-2 inline-flex items-center justify-center whitespace-nowrap rounded-lg text-label-lg ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 elevation-1 hover:elevation-2"
            >
              {isSubmitting ? 'Generating...' : 'Generate Wiki'}
            </button>
          </div>
        </motion.form>
      </div>
    </section>
  );
}
