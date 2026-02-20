'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Environment } from '@react-three/drei';
import KnowledgeCube from './KnowledgeCube';
import ParticleField from './ParticleField';

// Dynamically import Canvas to avoid SSR issues with Three.js
const Canvas = dynamic(
  () => import('@react-three/fiber').then((mod) => mod.Canvas),
  { ssr: false }
);

interface Hero3DProps {
  onSubmit: (e: React.FormEvent) => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSubmitting: boolean;
}

export default function Hero3D({ onSubmit, value, onChange, isSubmitting }: Hero3DProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Mobile detection
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Reduced motion detection
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      window.removeEventListener('resize', checkMobile);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion) return;
    // Normalize mouse position to -1 to 1
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    setMousePosition({ x, y });
  }, [prefersReducedMotion]);

  const animationProps = prefersReducedMotion
    ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } }
    : {};

  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background"
      onMouseMove={handleMouseMove}
    >
      {/* 3D Canvas Background */}
      {!isMobile && !prefersReducedMotion ? (
        <div className="absolute inset-0 z-0">
          <Canvas
            camera={{ position: [0, 0, 6], fov: 45 }}
            dpr={[1, 2]}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          >
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={0.8} />
            <KnowledgeCube mouse={mousePosition} />
            <ParticleField />
            <Environment preset="city" />
          </Canvas>
        </div>
      ) : (
        /* Static SVG/CSS fallback for mobile or reduced motion */
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <svg
            viewBox="0 0 400 400"
            className="w-64 h-64 md:w-80 md:h-80 opacity-10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polygon
              points="200,40 360,140 360,260 200,360 40,260 40,140"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-primary"
            />
            <polygon
              points="200,80 320,155 320,245 200,320 80,245 80,155"
              stroke="currentColor"
              strokeWidth="1"
              className="text-primary/50"
            />
            <line x1="200" y1="40" x2="200" y2="360" stroke="currentColor" strokeWidth="0.5" className="text-primary/30" />
            <line x1="40" y1="140" x2="360" y2="260" stroke="currentColor" strokeWidth="0.5" className="text-primary/30" />
            <line x1="360" y1="140" x2="40" y2="260" stroke="currentColor" strokeWidth="0.5" className="text-primary/30" />
          </svg>
        </div>
      )}

      {/* Content Overlay */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 md:py-28 text-center">
        {/* Headline */}
        <motion.h1
          className="text-display-md md:text-display-lg bg-gradient-to-r from-primary via-blue-500 to-cyan-400 bg-clip-text text-transparent mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          {...animationProps}
        >
          Understand Any Codebase in Minutes
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-body-lg text-muted-foreground max-w-2xl mx-auto mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          {...animationProps}
        >
          Paste any repository URL and let AI generate a fully navigable wiki with
          architecture diagrams, dependency maps, and searchable documentation.
        </motion.p>

        {/* Search Form */}
        <motion.form
          onSubmit={onSubmit}
          className="max-w-2xl mx-auto mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          {...animationProps}
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

        {/* Social Proof Badges */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
          {...animationProps}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/80 backdrop-blur-sm text-label-md text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Open Source
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/80 backdrop-blur-sm text-label-md text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Multi-Model AI
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/80 backdrop-blur-sm text-label-md text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            GitHub, GitLab & Bitbucket
          </span>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      )}
    </section>
  );
}
