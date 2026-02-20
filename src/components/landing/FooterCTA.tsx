'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/gsap';

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
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Header and subtitle: GSAP fade-up
      const headerTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.fct-header',
          start: 'top 85%',
          once: true,
        },
      });
      headerTl.from('.fct-header h2', {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
      });
      headerTl.from(
        '.fct-header p',
        {
          opacity: 0,
          y: 20,
          duration: 0.5,
          ease: 'power2.out',
        },
        '-=0.3'
      );

      // Form: slide-up with slight bounce easing
      gsap.from('.fct-form', {
        scrollTrigger: {
          trigger: '.fct-form',
          start: 'top 85%',
          once: true,
        },
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: 'back.out(1.2)',
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="py-24 px-6 relative overflow-hidden">
      {/* Gradient background accent with subtle animation */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none animate-gradient-drift" />

      <div className="relative max-w-3xl mx-auto text-center">
        {/* Header + Subtitle wrapper */}
        <div className="fct-header">
          <h2 className="text-display-sm text-foreground mb-4">
            Ready to Understand Your Code?
          </h2>
          <p className="text-body-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Paste a repository URL and generate your wiki in under 60 seconds.
          </p>
        </div>

        {/* Search Form (same pattern as hero) */}
        <form onSubmit={onSubmit} className="fct-form max-w-2xl mx-auto">
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
        </form>
      </div>
    </section>
  );
}
