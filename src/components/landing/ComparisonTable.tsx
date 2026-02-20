'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/gsap';

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
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Section header: fade-in
      const headerTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.ct-header',
          start: 'top 85%',
          once: true,
        },
      });
      headerTl.from('.ct-header h2', {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
      });
      headerTl.from(
        '.ct-header p',
        {
          opacity: 0,
          y: 20,
          duration: 0.5,
          ease: 'power2.out',
        },
        '-=0.3'
      );

      // Table wrapper: slides up
      gsap.from('.ct-table', {
        scrollTrigger: {
          trigger: '.ct-table',
          start: 'top 85%',
          once: true,
        },
        opacity: 0,
        y: 24,
        duration: 0.5,
        ease: 'power2.out',
      });

      // Rows: animate in one by one with stagger
      gsap.from('.ct-row', {
        scrollTrigger: {
          trigger: '.ct-table',
          start: 'top 80%',
          once: true,
        },
        opacity: 0,
        x: -20,
        duration: 0.4,
        stagger: 0.08,
        ease: 'power2.out',
      });

      // Check/X icons: pop in after row appears
      gsap.from('.ct-icon', {
        scrollTrigger: {
          trigger: '.ct-table',
          start: 'top 80%',
          once: true,
        },
        scale: 0,
        duration: 0.3,
        stagger: 0.08,
        delay: 0.1,
        ease: 'back.out(1.7)',
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Section Header */}
        <div className="ct-header text-center mb-16">
          <h2 className="text-display-sm text-foreground mb-4">Built Different</h2>
          <p className="text-body-lg text-muted-foreground max-w-xl mx-auto">
            See how BetterCodeWiki compares to closed-source alternatives.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="ct-table rounded-xl border border-border overflow-hidden">
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
              className={`ct-row grid grid-cols-[1fr_140px_140px] md:grid-cols-[1fr_160px_160px] ${
                i % 2 === 0 ? 'bg-card' : 'bg-card/50'
              } ${i < rows.length - 1 ? 'border-b border-border/50' : ''}`}
            >
              <div className="px-6 py-4 text-body-md text-foreground flex items-center">
                {row.feature}
              </div>
              <div className="px-6 py-4 flex items-center justify-center">
                <span className="ct-icon inline-flex">
                  {row.us ? <CheckIcon /> : <XIcon />}
                </span>
              </div>
              <div className="px-6 py-4 flex items-center justify-center">
                <span className="ct-icon inline-flex">
                  {row.them ? <CheckIcon /> : <XIcon />}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
