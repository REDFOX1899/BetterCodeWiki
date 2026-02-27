'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  children?: React.ReactNode;
}

export default function Hero3D({ children }: Hero3DProps) {
  const mousePositionRef = useRef({ x: 0, y: 0 });
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
    // Normalize mouse position to -1 to 1 — written to ref to avoid React re-renders
    mousePositionRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
    mousePositionRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }, [prefersReducedMotion]);

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
            <KnowledgeCube mouseRef={mousePositionRef} />
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

      {/* Content Overlay — render children if provided */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 md:py-28 text-center">
        {children}
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
