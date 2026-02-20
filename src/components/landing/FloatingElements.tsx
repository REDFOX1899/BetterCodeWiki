'use client';

import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from '@/lib/gsap';

const ELEMENTS = [
  { shape: 'circle', size: 6, x: '15%', startY: '20%', color: 'primary', delay: 0 },
  { shape: 'square', size: 4, x: '85%', startY: '35%', color: 'blue-500', delay: 0.5 },
  { shape: 'triangle', size: 8, x: '75%', startY: '55%', color: 'cyan-400', delay: 1 },
  { shape: 'circle', size: 3, x: '25%', startY: '65%', color: 'primary', delay: 1.5 },
  { shape: 'square', size: 5, x: '90%', startY: '80%', color: 'blue-500', delay: 0.8 },
  { shape: 'circle', size: 4, x: '10%', startY: '90%', color: 'cyan-400', delay: 0.3 },
];

export default function FloatingElements() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    const elements = containerRef.current.querySelectorAll('.floating-el');
    elements.forEach((el, i) => {
      // Parallax: each element moves at a different rate
      gsap.to(el, {
        y: -(100 + i * 50),
        rotation: 360 * (i % 2 === 0 ? 1 : -1),
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5,
        },
      });

      // Gentle floating animation (continuous)
      gsap.to(el, {
        y: '+=15',
        duration: 3 + i * 0.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[1] overflow-hidden" aria-hidden="true">
      {ELEMENTS.map((el, i) => (
        <div
          key={i}
          className={`floating-el absolute opacity-[0.06] dark:opacity-[0.04]`}
          style={{ left: el.x, top: el.startY }}
        >
          {el.shape === 'circle' && (
            <div className={`w-${el.size} h-${el.size} rounded-full border border-current text-${el.color}`}
              style={{ width: `${el.size * 4}px`, height: `${el.size * 4}px` }} />
          )}
          {el.shape === 'square' && (
            <div className={`border border-current text-${el.color} rotate-45`}
              style={{ width: `${el.size * 4}px`, height: `${el.size * 4}px` }} />
          )}
          {el.shape === 'triangle' && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"
              className={`text-${el.color}`}
              style={{ width: `${el.size * 4}px`, height: `${el.size * 4}px` }}>
              <path d="M12 2L22 20H2L12 2Z" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
