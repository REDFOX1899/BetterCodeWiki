'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/gsap';

interface FooterCTAProps {
  onWaitlistClick: () => void;
}

export default function FooterCTA({ onWaitlistClick }: FooterCTAProps) {
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

      // CTA buttons: slide-up with slight bounce easing
      gsap.from('.fct-cta', {
        scrollTrigger: {
          trigger: '.fct-cta',
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
            Ready to understand your codebase?
          </h2>
          <p className="text-body-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Explore AI-generated wikis for popular open-source projects, or join the waitlist to generate wikis for your own repos.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="fct-cta flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onWaitlistClick}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground text-label-lg hover:bg-primary/90 transition-all elevation-1 hover:elevation-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Join the Waitlist
          </button>
          <Link
            href="/wiki/projects"
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg border border-border bg-card text-foreground text-label-lg hover:border-primary/50 hover:bg-card/80 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Explore Library
          </Link>
        </div>
      </div>
    </section>
  );
}
