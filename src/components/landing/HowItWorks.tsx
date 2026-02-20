'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/gsap';

interface Step {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Paste Your Repo',
    description:
      'Enter any GitHub, GitLab, or Bitbucket URL. Private repos? Just add your token.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'AI Does the Heavy Lifting',
    description:
      'Multi-model AI engine analyzes your code structure, dependencies, and architecture.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
        />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Explore Your Wiki',
    description:
      'Browse documentation with interactive diagrams, searchable pages, and AI chat.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
        />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Section header: timeline that fades in heading + subtitle with stagger
      const headerTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.hiw-header',
          start: 'top 85%',
          once: true,
        },
      });
      headerTl.from('.hiw-header h2', {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
      });
      headerTl.from(
        '.hiw-header p',
        {
          opacity: 0,
          y: 20,
          duration: 0.5,
          ease: 'power2.out',
        },
        '-=0.3'
      );

      // Step cards: staggered reveal from y:60
      gsap.from('.hiw-card', {
        scrollTrigger: {
          trigger: '.hiw-cards-grid',
          start: 'top 85%',
          once: true,
        },
        opacity: 0,
        y: 60,
        duration: 0.6,
        stagger: 0.15,
        ease: 'power2.out',
      });

      // Number badges: scale from 0.5 to 1 with bounce
      gsap.from('.hiw-badge', {
        scrollTrigger: {
          trigger: '.hiw-cards-grid',
          start: 'top 85%',
          once: true,
        },
        scale: 0.5,
        duration: 0.6,
        stagger: 0.15,
        ease: 'back.out(1.7)',
      });

      // Connecting dashed line: animate stroke-dashoffset with scrub
      const lineEl = document.querySelector(
        '.hiw-connecting-line line'
      ) as SVGLineElement | null;
      if (lineEl) {
        const lineLength = lineEl.getTotalLength?.()
          ? lineEl.getTotalLength()
          : 1000;
        gsap.set(lineEl, {
          strokeDasharray: lineLength,
          strokeDashoffset: lineLength,
        });
        gsap.to(lineEl, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: '.hiw-cards-grid',
            start: 'top 85%',
            end: 'bottom 50%',
            scrub: 1,
          },
        });
      }
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="hiw-header text-center mb-16">
          <h2 className="text-display-sm text-foreground mb-4">
            Three Steps. Zero Configuration.
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-xl mx-auto">
            From repository URL to full documentation in under a minute.
          </p>
        </div>

        {/* Steps Grid with Connecting Line */}
        <div className="relative">
          {/* Connecting line (visible on desktop) */}
          <div className="hidden md:block absolute top-24 left-[16.66%] right-[16.66%] h-px">
            <svg
              className="hiw-connecting-line w-full h-px overflow-visible"
              preserveAspectRatio="none"
            >
              <line
                x1="0"
                y1="0"
                x2="100%"
                y2="0"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="6 6"
                className="text-border"
              />
            </svg>
          </div>

          <div className="hiw-cards-grid grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div
                key={step.number}
                className="hiw-card relative flex flex-col items-center text-center p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm transition-colors hover:border-primary/30 hover:-translate-y-1 transition-transform duration-200"
              >
                {/* Number Badge */}
                <div className="hiw-badge w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-label-lg text-primary font-semibold mb-4">
                  {step.number}
                </div>

                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-primary mb-4">
                  {step.icon}
                </div>

                {/* Title */}
                <h3 className="text-title-lg text-foreground mb-2">{step.title}</h3>

                {/* Description */}
                <p className="text-body-md text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
