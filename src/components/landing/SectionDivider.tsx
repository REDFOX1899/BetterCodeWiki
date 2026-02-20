'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/gsap';

interface SectionDividerProps {
  variant: 'gradient-orb' | 'grid-fade' | 'dots';
  direction?: 'left' | 'right' | 'center';
  className?: string;
}

export default function SectionDivider({ variant, direction = 'center', className = '' }: SectionDividerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!ref.current) return;
    const el = ref.current.querySelector('.parallax-element');
    if (!el) return;

    gsap.to(el, {
      y: -80,
      scrollTrigger: {
        trigger: ref.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
    });
  }, { scope: ref });

  const positionClass = direction === 'left' ? 'left-[10%]' : direction === 'right' ? 'right-[10%]' : 'left-1/2 -translate-x-1/2';

  return (
    <div ref={ref} className={`relative h-32 overflow-hidden pointer-events-none ${className}`}>
      {variant === 'gradient-orb' && (
        <div className={`parallax-element absolute ${positionClass} top-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full blur-[100px] opacity-20 bg-gradient-to-r from-primary/40 via-blue-500/30 to-cyan-400/20`} />
      )}
      {variant === 'grid-fade' && (
        <div className={`parallax-element absolute inset-0 opacity-[0.03]`}
          style={{
            backgroundImage: `linear-gradient(var(--primary) 1px, transparent 1px), linear-gradient(90deg, var(--primary) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          }}
        />
      )}
      {variant === 'dots' && (
        <div className={`parallax-element absolute ${positionClass} top-1/2 -translate-y-1/2 flex gap-3`}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/20"
              style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}
