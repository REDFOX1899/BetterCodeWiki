'use client';

import React, { useEffect, useRef, useState } from 'react';
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
          <a
            href="https://github.com/REDFOX1899/BetterCodeWiki"
            target="_blank"
            rel="noopener noreferrer"
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
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
            Star on GitHub
          </a>
          <a
            href="https://github.com/REDFOX1899/BetterCodeWiki#readme"
            target="_blank"
            rel="noopener noreferrer"
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
            Read the Docs
          </a>
          <a
            href="https://github.com/REDFOX1899/BetterCodeWiki/discussions"
            target="_blank"
            rel="noopener noreferrer"
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
                d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
              />
            </svg>
            Join Discussion
          </a>
        </div>
      </div>
    </section>
  );
}
