'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import ThemeToggle from '@/components/theme-toggle';
import AuthButtons from '@/components/AuthButtons';
import WaitlistModal from '@/components/WaitlistModal';
import Mermaid from '../components/Mermaid';
import { useLanguage } from '@/contexts/LanguageContext';

// Landing page sections
import HowItWorks from '@/components/landing/HowItWorks';
import FeatureCards from '@/components/landing/FeatureCards';
import ComparisonTable from '@/components/landing/ComparisonTable';
import CommunitySection from '@/components/landing/CommunitySection';
import FooterCTA from '@/components/landing/FooterCTA';
import SectionDivider from '@/components/landing/SectionDivider';
import ScrollAnimationProvider from '@/components/landing/ScrollAnimationProvider';
import FloatingElements from '@/components/landing/FloatingElements';

// Dynamically import Hero3D to avoid SSR issues with Three.js
const Hero3D = dynamic(() => import('@/components/landing/Hero3D'), { ssr: false });

// Curated library of pre-generated wikis
const CURATED_REPOS = [
  { owner: 'facebook', repo: 'react', description: 'A JavaScript library for building user interfaces', platform: 'github' },
  { owner: 'vercel', repo: 'next.js', description: 'The React Framework for the Web', platform: 'github' },
  { owner: 'microsoft', repo: 'TypeScript', description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output', platform: 'github' },
  { owner: 'denoland', repo: 'deno', description: 'A modern runtime for JavaScript and TypeScript', platform: 'github' },
  { owner: 'tailwindlabs', repo: 'tailwindcss', description: 'A utility-first CSS framework for rapid UI development', platform: 'github' },
  { owner: 'pytorch', repo: 'pytorch', description: 'Tensors and dynamic neural networks in Python', platform: 'github' },
];

// Define the demo mermaid charts outside the component
const DEMO_FLOW_CHART = `graph TD
  A[Code Repository] --> B[GitUnderstand]
  B --> C[Architecture Diagrams]
  B --> D[Component Relationships]
  B --> E[Data Flow]
  B --> F[Process Workflows]

  style A fill:#f9d3a9,stroke:#d86c1f
  style B fill:#d4a9f9,stroke:#6c1fd8
  style C fill:#a9f9d3,stroke:#1fd86c
  style D fill:#a9d3f9,stroke:#1f6cd8
  style E fill:#f9a9d3,stroke:#d81f6c
  style F fill:#d3f9a9,stroke:#6cd81f`;

const DEMO_SEQUENCE_CHART = `sequenceDiagram
  participant User
  participant GitUnderstand
  participant GitHub

  User->>GitUnderstand: Browse wiki library
  GitUnderstand->>GitHub: Request repository data
  GitHub-->>GitUnderstand: Return repository data
  GitUnderstand->>GitUnderstand: Process and analyze code
  GitUnderstand-->>User: Display wiki with diagrams

  %% Add a note to make text more visible
  Note over User,GitHub: GitUnderstand supports sequence diagrams for visualizing interactions`;

export default function Home() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { language, setLanguage, messages, supportedLanguages } = useLanguage();

  // Create a simple translation function
  const t = (key: string, params: Record<string, string | number> = {}): string => {
    // Split the key by dots to access nested properties
    const keys = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = messages;

    // Navigate through the nested properties
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Return the key if the translation is not found
        return key;
      }
    }

    // If the value is a string, replace parameters
    if (typeof value === 'string') {
      return Object.entries(params).reduce((acc: string, [paramKey, paramValue]) => {
        return acc.replace(`{${paramKey}}`, String(paramValue));
      }, value);
    }

    // Return the key if the value is not a string
    return key;
  };

  // Scroll-aware nav state
  const [isScrolled, setIsScrolled] = useState(false);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  // Scroll listener for nav transparency
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleWaitlistClick = () => {
    setIsWaitlistOpen(true);
  };

  return (
    <div id="main-content" className="min-h-screen bg-background text-foreground">
      {/* ===== Floating Decorative Elements (fixed background layer) ===== */}
      <FloatingElements />

      {/* ===== Scroll-Aware Navigation Bar ===== */}
      <nav
        className={`sticky top-0 z-50 h-16 transition-all duration-300 ${
          isScrolled
            ? 'bg-background/80 backdrop-blur-md border-b border-border'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          {/* Left: Logo + App Name */}
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl elevation-1">
              <BookOpen size={18} className="text-primary-foreground" />
            </div>
            <span className="text-title-md text-foreground" style={{ fontFamily: 'var(--font-display), var(--font-sans), sans-serif' }}>
              GitUnderstand
            </span>
          </div>

          {/* Center: Explore Library Link */}
          <div className="hidden md:flex items-center">
            <Link
              href="/wiki/projects"
              className="text-label-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              Explore Library
            </Link>
          </div>

          {/* Right: Auth + Theme Toggle */}
          <div className="flex items-center gap-3">
            <AuthButtons onWaitlistClick={handleWaitlistClick} />
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <ScrollAnimationProvider>
        {/* ===== Hero Section with 3D ===== */}
        <Hero3D>
          {/* Headline */}
          <motion.h1
            className="text-display-md md:text-display-lg bg-gradient-to-r from-primary via-blue-500 to-cyan-400 bg-clip-text text-transparent mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            Understand Any Codebase in Seconds
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-body-lg text-muted-foreground max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          >
            AI-generated wikis with interactive diagrams, architecture maps, and intelligent code explanations
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          >
            <Link
              href="/wiki/projects"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground text-label-lg hover:bg-primary/90 transition-all elevation-1 hover:elevation-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Explore Library
            </Link>
            <button
              onClick={handleWaitlistClick}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg border border-border bg-card/80 backdrop-blur-sm text-foreground text-label-lg hover:border-primary/50 hover:bg-card/60 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Join Waitlist
            </button>
          </motion.div>

          {/* Social Proof Badges */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/80 backdrop-blur-sm text-label-md text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI-Powered
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/80 backdrop-blur-sm text-label-md text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              Interactive Diagrams
            </span>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/80 backdrop-blur-sm text-label-md text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              GitHub, GitLab & Bitbucket
            </span>
          </motion.div>
        </Hero3D>

        {/* ===== Curated Library Grid ===== */}
        <section className="max-w-6xl mx-auto w-full px-6 py-12">
          <div className="space-y-16">
            {/* Curated Wiki Cards */}
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <BookOpen size={20} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-headline-md text-foreground">Popular Wikis</h2>
                    <p className="text-muted-foreground text-body-sm">Explore AI-generated documentation for top open-source projects</p>
                  </div>
                </div>
                <Link
                  href="/wiki/projects"
                  className="hidden sm:inline-flex items-center gap-1 text-label-md text-primary hover:text-primary/80 transition-colors"
                >
                  View all
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {CURATED_REPOS.map((item, index) => (
                  <motion.div
                    key={`${item.owner}/${item.repo}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
                  >
                    <Link
                      href={`/${item.platform}/${item.owner}/${item.repo}`}
                      className="group block bg-card rounded-xl border border-border p-5 hover:border-primary/50 hover:bg-card/80 transition-all elevation-1 hover:elevation-2 h-full"
                    >
                      <div className="flex items-start gap-3">
                        {/* Owner avatar placeholder */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground overflow-hidden">
                          <img
                            src={`https://github.com/${item.owner}.png?size=40`}
                            alt={item.owner}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to initials if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              if (target.parentElement) {
                                target.parentElement.textContent = item.owner.charAt(0).toUpperCase();
                              }
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-label-sm text-muted-foreground truncate">{item.owner}</span>
                            <span className="text-muted-foreground/40">/</span>
                            <span className="text-label-lg text-foreground font-semibold truncate group-hover:text-primary transition-colors">{item.repo}</span>
                          </div>
                          <p className="text-body-sm text-muted-foreground line-clamp-2">{item.description}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-label-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                        View Wiki
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Interaction Diagrams */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-headline-sm text-foreground">{t('home.advancedVisualization')}</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card rounded-xl border border-border p-5 elevation-1">
                  <h4 className="text-label-lg text-muted-foreground mb-4">{t('home.flowDiagram')}</h4>
                  <div className="overflow-hidden rounded-lg bg-background/50 border border-border/50">
                    <Mermaid chart={DEMO_FLOW_CHART} />
                  </div>
                </div>
                <div className="bg-card rounded-xl border border-border p-5 elevation-1">
                  <h4 className="text-label-lg text-muted-foreground mb-4">{t('home.sequenceDiagram')}</h4>
                  <div className="overflow-hidden rounded-lg bg-background/50 border border-border/50">
                    <Mermaid chart={DEMO_SEQUENCE_CHART} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SectionDivider variant="gradient-orb" direction="right" />

        {/* ===== How It Works ===== */}
        <HowItWorks />

        <SectionDivider variant="grid-fade" />

        {/* ===== Feature Cards ===== */}
        <FeatureCards />

        <SectionDivider variant="gradient-orb" direction="left" />

        {/* ===== Comparison Table ===== */}
        <ComparisonTable />

        <SectionDivider variant="dots" direction="center" />

        {/* ===== Community / Open Source ===== */}
        <CommunitySection stars={0} contributors={0} forks={0} />

        {/* ===== Footer CTA ===== */}
        <FooterCTA onWaitlistClick={handleWaitlistClick} />

        {/* ===== Footer ===== */}
        <footer className="max-w-6xl mx-auto py-8 border-t border-border w-full px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} GitUnderstand. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link
                href="/wiki/projects"
                className="hover:text-foreground transition-colors text-label-md"
              >
                Explore Library
              </Link>
            </div>
          </div>
        </footer>
      </ScrollAnimationProvider>

      {/* Waitlist Modal */}
      <WaitlistModal isOpen={isWaitlistOpen} onClose={() => setIsWaitlistOpen(false)} />
    </div>
  );
}
