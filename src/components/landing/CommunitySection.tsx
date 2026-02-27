'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useInView } from 'framer-motion';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/gsap';

interface CommunitySectionProps {
  stars: number;
  contributors: number;
  forks: number;
}

function AnimatedCounter({ target, label }: { target: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let startTime: number | null = null;
    const duration = 1500; // ms

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, target]);

  const formatNumber = (n: number): string => {
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1)}k`;
    }
    return n.toLocaleString();
  };

  return (
    <div ref={ref} className="flex flex-col items-center gap-1">
      <span className="text-display-sm text-foreground font-bold">
        {formatNumber(count)}
      </span>
      <span className="text-label-md text-muted-foreground">{label}</span>
    </div>
  );
}

export default function CommunitySection({
  stars,
  contributors,
  forks,
}: CommunitySectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Section header: GSAP fade-in
      const headerTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.cs-header',
          start: 'top 85%',
          once: true,
        },
      });
      headerTl.from('.cs-header h2', {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
      });
      headerTl.from(
        '.cs-header p',
        {
          opacity: 0,
          y: 20,
          duration: 0.5,
          ease: 'power2.out',
        },
        '-=0.3'
      );

      // Stat counters wrapper: staggered reveal
      gsap.from('.cs-stats', {
        scrollTrigger: {
          trigger: '.cs-stats',
          start: 'top 85%',
          once: true,
        },
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
      });

      // CTA buttons: staggered from y:20
      gsap.from('.cs-cta-btn', {
        scrollTrigger: {
          trigger: '.cs-cta',
          start: 'top 85%',
          once: true,
        },
        opacity: 0,
        y: 20,
        duration: 0.5,
        stagger: 0.1,
        ease: 'power2.out',
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        {/* Header */}
        <div className="cs-header mb-12">
          <h2 className="text-display-sm text-foreground mb-4">
            Built by the Community, for the Community
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-xl mx-auto">
            Join thousands of developers who are making code documentation
            effortless.
          </p>
        </div>

        {/* Stat Counters */}
        <div className="cs-stats flex flex-wrap items-center justify-center gap-12 md:gap-20 mb-12">
          <AnimatedCounter target={stars} label="GitHub Stars" />
          <AnimatedCounter target={contributors} label="Contributors" />
          <AnimatedCounter target={forks} label="Forks" />
        </div>

        {/* CTA Buttons */}
        <div className="cs-cta flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/wiki/projects"
            className="cs-cta-btn inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground text-label-lg hover:bg-primary/90 transition-colors elevation-1 hover:elevation-2"
          >
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Explore Library
          </Link>
          <a
            href="https://gitunderstand.com"
            className="cs-cta-btn inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border bg-card text-foreground text-label-lg hover:border-primary/50 hover:bg-card/80 transition-colors"
          >
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
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
            Learn More
          </a>
        </div>
      </div>
    </section>
  );
}
