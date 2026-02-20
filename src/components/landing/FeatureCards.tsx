'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap, ScrollTrigger } from '@/lib/gsap';

interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const features: Feature[] = [
  {
    title: 'Your Model, Your Rules',
    description:
      'Choose from Google Gemini, OpenAI, OpenRouter, or Ollama. Bring your own API key and stay in control.',
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
          d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
        />
      </svg>
    ),
  },
  {
    title: 'See the Architecture',
    description:
      'Auto-generated Mermaid diagrams visualize your code structure, data flow, and component relationships.',
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
          d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
        />
      </svg>
    ),
  },
  {
    title: 'Every Repository, Everywhere',
    description:
      'GitHub, GitLab, Bitbucket, or local folders. Public or private. We handle them all.',
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
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
        />
      </svg>
    ),
  },
  {
    title: 'Fully Open. Fully Yours.',
    description:
      'MIT licensed. Self-host it. Audit every line. No vendor lock-in, no data leaves your infrastructure.',
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
          d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    ),
  },
];

export default function FeatureCards() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Section header: fade-in
      const headerTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.fc-header',
          start: 'top 85%',
          once: true,
        },
      });
      headerTl.from('.fc-header h2', {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
      });
      headerTl.from(
        '.fc-header p',
        {
          opacity: 0,
          y: 20,
          duration: 0.5,
          ease: 'power2.out',
        },
        '-=0.3'
      );

      // Cards: alternating x positions (even from left, odd from right) with scrub: 0.5
      const cards = gsap.utils.toArray<HTMLElement>('.fc-card');
      cards.forEach((card, i) => {
        const fromX = i % 2 === 0 ? -40 : 40;
        gsap.from(card, {
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            end: 'top 60%',
            scrub: 0.5,
          },
          opacity: 0,
          x: fromX,
          ease: 'power2.out',
        });
      });

      // Card icons: continuous pulse while in viewport
      const icons = gsap.utils.toArray<HTMLElement>('.fc-card-icon');
      icons.forEach((icon) => {
        const pulseTween = gsap.to(icon, {
          scale: 1.1,
          duration: 0.8,
          ease: 'power1.inOut',
          repeat: -1,
          yoyo: true,
          paused: true,
        });

        ScrollTrigger.create({
          trigger: icon,
          start: 'top 90%',
          end: 'bottom 10%',
          toggleActions: 'play pause resume pause',
          onEnter: () => pulseTween.play(),
          onLeave: () => pulseTween.pause(),
          onEnterBack: () => pulseTween.resume(),
          onLeaveBack: () => pulseTween.pause(),
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="fc-header text-center mb-16">
          <h2 className="text-display-sm text-foreground mb-4">
            Built for How Developers Actually Work
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-xl mx-auto">
            Every feature is designed with real developer workflows in mind.
          </p>
        </div>

        {/* 2x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="fc-card border border-border bg-card/50 backdrop-blur-sm rounded-xl p-6 transition-colors hover:border-primary/50 hover:-translate-y-1 transition-transform duration-200"
            >
              {/* Icon */}
              <div className="fc-card-icon w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                {feature.icon}
              </div>

              {/* Title */}
              <h3 className="text-title-lg text-foreground mb-2">{feature.title}</h3>

              {/* Description */}
              <p className="text-body-md text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
