# BetterCodeWiki UI Overhaul -- Implementation Plan

**Created**: 2026-02-20
**Objective**: Transform BetterCodeWiki from a functional product with a "demo-tier" 3D hero into an enterprise-grade experience that clearly surpasses Google Code Wiki in visual polish, scroll experience, and developer delight.

**Guiding Principle**: Keep the current page structure (Hero -> Quick Start -> Diagrams -> How It Works -> Features -> Comparison -> Community -> Footer CTA -> Footer). Make every section dramatically better. Ensure animation CONTINUES throughout the entire scroll, not just in the hero.

---

## Table of Contents

1. [New Packages & Assets](#new-packages--assets)
2. [New Files to Create](#new-files-to-create)
3. [Wave 1: Make the Scroll Alive](#wave-1-make-the-scroll-alive)
4. [Wave 2: Upgrade the Hero](#wave-2-upgrade-the-hero)
5. [Wave 3: Enterprise Polish](#wave-3-enterprise-polish)
6. [Wave 4: Micro-interactions & Details](#wave-4-micro-interactions--details)
7. [Wave 5: Wiki Viewer Upgrades](#wave-5-wiki-viewer-upgrades)
8. [Appendix: File-Level Change Map](#appendix-file-level-change-map)

---

## New Packages & Assets

### Packages to Install

| Package | Purpose | Install Command |
|---------|---------|-----------------|
| `@gsap/react` | Official GSAP React integration (useGSAP hook) | `yarn add @gsap/react` |
| `lenis` | Smooth scrolling library (used by Linear, Vercel) | `yarn add lenis` |
| `@react-three/postprocessing` | Bloom, depth-of-field for 3D scene | `yarn add @react-three/postprocessing` |

Note: `gsap` (v3.14.2) is already installed but completely unused. The GSAP ScrollTrigger plugin is bundled with the main GSAP package and does not require a separate install -- just `gsap/ScrollTrigger`.

### Packages Already Installed (Leverage More)

- `gsap` -- ScrollTrigger, ScrollSmoother, timeline animations
- `framer-motion` -- keep for component-level animations, page transitions
- `@react-three/fiber` + `@react-three/drei` -- upgrade the 3D scene
- `three` -- custom shaders, instanced meshes

### Assets to Create

| Asset | Purpose | Location |
|-------|---------|----------|
| Custom logo SVG | Replace FaWikipediaW icon | `public/logo.svg` |
| Favicon set | 16x16, 32x32, apple-touch-icon | `public/favicon.ico`, `public/favicon-32x32.png`, `public/apple-touch-icon.png` |
| OG image | 1200x630 social share card | `public/og-image.png` |
| Site manifest | PWA metadata | `public/site.webmanifest` |

---

## New Files to Create

| File | Purpose |
|------|---------|
| `src/lib/gsap.ts` | GSAP registration & shared ScrollTrigger setup |
| `src/lib/smooth-scroll.ts` | Lenis smooth-scroll initialization |
| `src/components/landing/ScrollAnimationProvider.tsx` | Wrapper component that initializes GSAP + Lenis for the landing page |
| `src/components/landing/SectionDivider.tsx` | Animated gradient/wave divider between landing sections |
| `src/components/landing/EnterpriseSection.tsx` | New "Enterprise Ready" messaging section |
| `src/components/landing/CodeConstellation.tsx` | New 3D hero replacement (interconnected node graph) |
| `src/components/landing/FloatingElements.tsx` | Scroll-linked 3D elements that persist between sections |
| `src/components/ui/ConfirmDialog.tsx` | Custom confirmation modal replacing `window.confirm()` |
| `src/components/ui/Skeleton.tsx` | Reusable skeleton loading component |
| `src/components/wiki/GenerationProgress.tsx` | Wiki generation progress indicator |
| `src/components/wiki/AskDrawer.tsx` | Slide-in drawer wrapper for the Ask component |
| `src/hooks/useGitHubStats.ts` | Hook to fetch live GitHub stars/forks/contributors |
| `src/hooks/useScrollProgress.ts` | Hook wrapping GSAP ScrollTrigger for scroll progress |
| `public/logo.svg` | Custom brand logo |
| `public/favicon.ico` | Custom favicon |
| `public/og-image.png` | Social share image |

---

## Wave 1: Make the Scroll Alive

**Goal**: Eliminate the "dead scroll" problem. After the hero, every section should have scroll-linked behavior -- parallax, staggered reveals, progress-driven animations, and persistent 3D elements.

---

### 1.1 Initialize GSAP ScrollTrigger + Lenis Smooth Scroll

**What**: Create a central GSAP initialization module and a Lenis smooth-scroll provider that wraps the landing page.

**Where**:
- NEW `src/lib/gsap.ts`
- NEW `src/lib/smooth-scroll.ts`
- NEW `src/components/landing/ScrollAnimationProvider.tsx`
- MODIFY `src/app/page.tsx` (wrap content in ScrollAnimationProvider)

**How**:

`src/lib/gsap.ts`:
```typescript
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register once at the module level
gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
```

`src/lib/smooth-scroll.ts`:
```typescript
import Lenis from 'lenis';

export function createSmoothScroll(): Lenis {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    smoothWheel: true,
  });
  return lenis;
}
```

`ScrollAnimationProvider.tsx` initializes Lenis, connects it to GSAP's ticker so ScrollTrigger works with smooth scroll, and provides a context for child components to access scroll progress. Wrap the landing page `<div>` content in `<ScrollAnimationProvider>` inside `page.tsx`.

**Why**: GSAP ScrollTrigger is the industry standard for scroll-linked animation (used by Apple, Stripe, Linear). Lenis provides the butter-smooth scrolling that makes scroll animations feel premium. Together they solve the #1 critique: dead scroll.

**Complexity**: Medium

**Dependencies**: None -- this is the foundation everything else builds on.

---

### 1.2 Convert All `whileInView={{ once: true }}` to GSAP ScrollTrigger Animations

**What**: Replace every Framer Motion `whileInView` with GSAP ScrollTrigger animations that can scrub, repeat, and respond to scroll position -- not just fire once.

**Where**:
- `src/components/landing/HowItWorks.tsx`
- `src/components/landing/FeatureCards.tsx`
- `src/components/landing/ComparisonTable.tsx`
- `src/components/landing/CommunitySection.tsx`
- `src/components/landing/FooterCTA.tsx`

**How**: In each component, use `useGSAP()` from `@gsap/react` with `ScrollTrigger`:

For **HowItWorks.tsx**:
- Section header: fade-in + slight y-translate on scroll, with `scrub: 1` so it moves with scroll position.
- Step cards: staggered reveal (`stagger: 0.2`) triggered at `top: 80%` of viewport. The connecting dashed line animates its `strokeDashoffset` from full to zero as user scrolls through the section (scrub-linked).
- Number badges: scale from 0 to 1 as their card enters viewport.

For **FeatureCards.tsx**:
- Cards enter from alternating sides (left cards from left, right cards from right) with `scrub: 0.5`.
- Each card icon has a gentle continuous rotation or pulse that plays while card is in viewport (ScrollTrigger `toggleActions: "play pause resume pause"`).

For **ComparisonTable.tsx**:
- Rows animate in one-by-one from left, with the check/X icons popping in after a slight delay.
- The entire table has a subtle parallax (moves at 0.95x scroll speed) creating depth.

For **CommunitySection.tsx**:
- Counter animation remains (already good), but tie it to ScrollTrigger instead of `useInView` for consistency.
- Stat numbers have a subtle continuous scale pulse while in viewport.

For **FooterCTA.tsx**:
- The radial gradient background subtly shifts/pulses on scroll.
- Form slides up with slight bounce easing.

Pattern for each component:
```typescript
import { useGSAP } from '@gsap/react';
import { gsap, ScrollTrigger } from '@/lib/gsap';

export default function SomeSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    const cards = gsap.utils.toArray('.feature-card');
    cards.forEach((card, i) => {
      gsap.from(card as Element, {
        y: 60,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card as Element,
          start: 'top 85%',
          end: 'top 50%',
          scrub: 0.5,
        },
      });
    });
  }, { scope: sectionRef });

  return <section ref={sectionRef}>...</section>;
}
```

**Why**: `once: true` means each section animates exactly once and then becomes static forever. ScrollTrigger with scrub means animations are tied to scroll position -- they MOVE as you scroll, creating a living, breathing page.

**Complexity**: Medium (each component needs individual attention but the pattern is consistent)

**Dependencies**: 1.1 (GSAP + Lenis setup)

---

### 1.3 Add Parallax Depth Layers Between Sections

**What**: Add floating decorative elements (gradient orbs, subtle grid patterns, thin lines) between each major section that move at different scroll speeds, creating depth.

**Where**:
- NEW `src/components/landing/SectionDivider.tsx`
- MODIFY `src/app/page.tsx` (insert SectionDividers between each section)

**How**: Create a `SectionDivider` component with configurable variants:

```typescript
// Variants: 'gradient-orb' | 'grid-fade' | 'wave-line' | 'dots'
interface SectionDividerProps {
  variant: 'gradient-orb' | 'grid-fade' | 'wave-line' | 'dots';
  direction?: 'left' | 'right' | 'center';
}
```

Each variant renders an absolutely-positioned decorative element. Use GSAP ScrollTrigger to move these at 0.3x-0.7x the scroll speed (parallax). The gradient orbs are CSS radial gradients with blur, not actual images.

Insert between sections in `page.tsx`:
```tsx
<HowItWorks />
<SectionDivider variant="gradient-orb" direction="right" />
<FeatureCards />
<SectionDivider variant="wave-line" direction="left" />
<ComparisonTable />
```

**Why**: Parallax layers between sections create the illusion of depth. This is the single most effective technique for making a page feel "alive" during scroll. Apple.com, Linear.app, and Stripe.com all use this pattern extensively.

**Complexity**: Medium

**Dependencies**: 1.1

---

### 1.4 Persistent Floating 3D Elements That Transform on Scroll

**What**: Small 3D elements (code brackets, documentation icons, connection nodes) that float in the background and TRANSFORM as the user scrolls through different sections, not just in the hero.

**Where**:
- NEW `src/components/landing/FloatingElements.tsx`
- MODIFY `src/app/page.tsx` (add as fixed-position background layer)

**How**: Use a single `<Canvas>` with `position: fixed` that covers the entire page. Render 5-8 small 3D objects (simple geometries: torus, octahedron, small cubes) at various positions. Use GSAP ScrollTrigger to:

1. **Track overall scroll progress** (0 at top, 1 at bottom of page).
2. **Interpolate object positions, rotations, and scales** based on scroll progress.
3. **Change object colors/opacity** per section -- e.g., blue in hero, green in features, purple in community.

The Canvas uses `frameloop="demand"` to only render when scroll updates occur (performance optimization). Objects are rendered with `InstancedMesh` for efficiency.

Key technique: Pass scroll progress into Three.js via a shared ref that GSAP updates:
```typescript
const scrollProgressRef = useRef(0);

useGSAP(() => {
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      scrollProgressRef.current = self.progress;
      // Invalidate the Three.js frame
      invalidate();
    },
  });
});
```

On mobile, replace with CSS-animated SVG elements (2D parallax) to avoid GPU overhead.

**Why**: This solves the critique that "3D elements exist only in the hero." Persistent floating elements create visual continuity and a sense of craftsmanship throughout the entire page. Vercel's dashboard uses a similar technique with floating gradient shapes.

**Complexity**: High

**Dependencies**: 1.1, 1.2

---

### 1.5 Section Title Reveal Animations

**What**: All section headings (`<h2>`) get a character-by-character or word-by-word reveal animation that plays as you scroll into them.

**Where**:
- `src/components/landing/HowItWorks.tsx`
- `src/components/landing/FeatureCards.tsx`
- `src/components/landing/ComparisonTable.tsx`
- `src/components/landing/CommunitySection.tsx`
- `src/components/landing/FooterCTA.tsx`

**How**: Create a reusable `AnimatedHeading` component (or inline in each section). Use GSAP `SplitText`-like approach (manually split text into `<span>` elements wrapping each word). Animate each word with stagger:

```typescript
gsap.from('.word-span', {
  y: 40,
  opacity: 0,
  stagger: 0.05,
  duration: 0.6,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: headingRef.current,
    start: 'top 80%',
  },
});
```

**Why**: Character/word reveals are a hallmark of premium web design (Apple, Stripe, Linear all use them). They create anticipation and draw attention to section transitions.

**Complexity**: Low-Medium

**Dependencies**: 1.1

---

## Wave 2: Upgrade the Hero

**Goal**: Replace the tutorial-grade icosahedron with a visually stunning, meaningful 3D visualization that communicates "code intelligence."

---

### 2.1 Replace Icosahedron with Interactive Code Constellation

**What**: Replace `KnowledgeCube.tsx` (the icosahedron) with a dynamic node graph that represents interconnected code modules. Nodes are small spheres connected by glowing lines. The graph slowly rotates and responds to mouse movement. Nodes pulse with different colors representing different code domains.

**Where**:
- NEW `src/components/landing/CodeConstellation.tsx` (replaces KnowledgeCube)
- MODIFY `src/components/landing/Hero3D.tsx` (swap KnowledgeCube for CodeConstellation)

**How**:

1. **Generate node positions**: Create 30-50 nodes positioned in a roughly spherical arrangement using fibonacci sphere distribution (more organic than pure random).
2. **Create connections**: Each node connects to 2-4 nearest neighbors via `Line` components from `@react-three/drei`.
3. **Rendering**: Each node is a small sphere (`SphereGeometry args={[0.06, 16, 16]}`) with `MeshStandardMaterial` with `emissive` color. Connections use `Line` with `lineWidth={1}` and varying opacity.
4. **Animation**: The entire graph slowly rotates on Y axis. Nodes have subtle `Float` effect. On mouse move, the graph tilts (same parallax technique as current KnowledgeCube).
5. **Pulse effect**: Random nodes periodically "pulse" (scale up and glow brighter), creating a sense of activity -- like data flowing through a codebase.
6. **Color coding**: Nodes are 3-4 colors (blue, cyan, purple, green) representing different "code domains."
7. **Light mode fix**: Use `MeshStandardMaterial` with explicit emissive values instead of `MeshTransmissionMaterial`, which is nearly invisible in light mode. This ensures the visualization looks great in both themes.

Implementation skeleton:
```typescript
function CodeConstellation({ mouse }: { mouse: { x: number; y: number } }) {
  const groupRef = useRef<THREE.Group>(null);
  const { nodes, edges } = useMemo(() => generateGraph(40), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.08;
    // Mouse parallax
    const maxTilt = THREE.MathUtils.degToRad(12);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x, -mouse.y * maxTilt, 0.04
    );
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node) => (
        <mesh key={node.id} position={node.position}>
          <sphereGeometry args={[node.size, 16, 16]} />
          <meshStandardMaterial
            color={node.color}
            emissive={node.color}
            emissiveIntensity={0.6}
          />
        </mesh>
      ))}
      {edges.map((edge, i) => (
        <Line key={i} points={[edge.from, edge.to]}
          color="#3b82f6" lineWidth={0.8} transparent opacity={0.3} />
      ))}
    </group>
  );
}
```

**Why**: A node graph directly communicates "code intelligence and interconnections," which is the product's core value prop. An icosahedron communicates nothing specific. The node graph also provides more visual richness and more surface area for light interaction, solving the light-mode visibility issue.

**Complexity**: High

**Dependencies**: None (can be developed independently)

---

### 2.2 Upgrade Particle Field

**What**: Replace the barely-visible 200-particle field with a purposeful "data stream" effect -- particles that flow along curved paths, suggesting data being processed.

**Where**:
- MODIFY `src/components/landing/ParticleField.tsx`

**How**:

1. Increase count to 500 particles but make them very small.
2. Instead of random spherical distribution, distribute along 3-5 curved "flow lines" (bezier curves).
3. Each particle moves along its curve over time, creating streams of data.
4. Particles are brighter (opacity 0.5-0.8) and vary in size (0.01 to 0.04).
5. Use `PointMaterial` with additive blending for a glow effect.
6. Color gradient along the flow: blue -> cyan -> white.

```typescript
// Compute positions along bezier curves
useFrame((state, delta) => {
  // Move each particle along its assigned curve
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = (progress[i] + delta * speeds[i]) % 1;
    const pos = getPointOnCurve(curves[assignments[i]], t);
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
    progress[i] = t;
  }
  pointsRef.current.geometry.attributes.position.needsUpdate = true;
});
```

**Why**: The current particle field adds GPU cost but no visual payoff (0.3 opacity, 200 dots). Flowing particles suggest "processing" and "intelligence" -- exactly what the product does. They also create movement that draws the eye.

**Complexity**: Medium

**Dependencies**: None

---

### 2.3 Add Post-Processing Effects to Hero Canvas

**What**: Add subtle bloom and depth-of-field effects to the hero's Three.js canvas to make it feel cinematic.

**Where**:
- MODIFY `src/components/landing/Hero3D.tsx`

**How**: Use `@react-three/postprocessing`:

```typescript
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';

// Inside Canvas:
<EffectComposer>
  <Bloom
    luminanceThreshold={0.6}
    luminanceSmoothing={0.9}
    intensity={0.5}
  />
</EffectComposer>
```

Keep effects subtle. Bloom makes the node constellation glow. Skip DepthOfField on mobile.

**Why**: Post-processing is what separates "Three.js demo" from "production 3D." Even subtle bloom makes the scene feel dramatically more polished.

**Complexity**: Low

**Dependencies**: 2.1 (the constellation looks best with bloom)

---

### 2.4 Fix Mobile Hero Fallback

**What**: Replace the barely-visible SVG hexagon (10% opacity) with an animated CSS gradient mesh + floating SVG code icons.

**Where**:
- MODIFY `src/components/landing/Hero3D.tsx` (the `isMobile` branch at lines 79-103)

**How**:

1. Replace the static SVG with an animated CSS mesh gradient background using multiple overlapping radial gradients with `@keyframes` animation (position shift over 8-10 seconds, looping).
2. Layer 5-6 small SVG icons (code brackets, document icons, connection lines) with CSS `animation` for gentle floating movement.
3. Use `prefers-reduced-motion` to disable animations when needed.

```tsx
{/* Mobile fallback */}
<div className="absolute inset-0 z-0">
  {/* Animated gradient mesh */}
  <div className="absolute inset-0 animate-gradient-shift opacity-30"
    style={{
      background: `
        radial-gradient(ellipse at 20% 30%, hsl(221 83% 53% / 0.15), transparent 50%),
        radial-gradient(ellipse at 80% 70%, hsl(199 89% 48% / 0.15), transparent 50%),
        radial-gradient(ellipse at 50% 50%, hsl(280 80% 60% / 0.1), transparent 60%)
      `,
    }}
  />
  {/* Floating code icons */}
  <FloatingIcon icon="brackets" className="absolute top-1/4 left-1/6 animate-float-slow" />
  <FloatingIcon icon="document" className="absolute top-1/3 right-1/5 animate-float-medium" />
  {/* ... more icons */}
</div>
```

Add the keyframes to `globals.css`:
```css
@keyframes gradient-shift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(2%, -2%) scale(1.02); }
  66% { transform: translate(-1%, 1%) scale(0.98); }
}

@keyframes float-slow {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-12px) rotate(3deg); }
}
```

**Why**: Mobile users are over 50% of traffic. The current mobile hero is effectively a blank page with faint lines. An animated gradient mesh with floating icons creates visual interest at zero Three.js cost.

**Complexity**: Low-Medium

**Dependencies**: None

---

### 2.5 Pause Three.js Canvas When Off-Screen

**What**: Stop the Three.js render loop when the hero section is scrolled out of view.

**Where**:
- MODIFY `src/components/landing/Hero3D.tsx`

**How**: Use `IntersectionObserver` to detect when the hero section leaves the viewport. Control the Canvas `frameloop` prop:

```typescript
const [isVisible, setIsVisible] = useState(true);
const sectionRef = useRef<HTMLElement>(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => setIsVisible(entry.isIntersecting),
    { threshold: 0 }
  );
  if (sectionRef.current) observer.observe(sectionRef.current);
  return () => observer.disconnect();
}, []);

// In Canvas:
<Canvas frameloop={isVisible ? 'always' : 'never'} ...>
```

**Why**: The current Three.js canvas runs continuously even when the user has scrolled past it. This wastes GPU cycles and battery. This is a pure performance win with zero visual impact.

**Complexity**: Low

**Dependencies**: None

---

## Wave 3: Enterprise Polish

**Goal**: Fix credibility issues, add enterprise messaging, and make the product feel trustworthy to decision-makers.

---

### 3.1 Create Custom Brand Logo

**What**: Replace `FaWikipediaW` (legally questionable, visually confusing) with a custom SVG logo that represents "code + documentation."

**Where**:
- NEW `public/logo.svg`
- MODIFY `src/app/page.tsx` (lines 430-432, navbar logo)
- MODIFY `src/app/page.tsx` (lines 526-527, processed projects section)
- MODIFY `src/app/layout.tsx` (add favicon links to `<head>`)

**How**: Design a logo concept: overlapping code brackets `<>` forming a book/wiki shape. Create as an SVG with `currentColor` support for theme adaptability.

Replace all `<FaWikipediaW>` occurrences with:
```tsx
import Image from 'next/image';
// or inline SVG for theme-awareness:
<svg viewBox="0 0 24 24" className="w-5 h-5 text-primary-foreground" fill="currentColor">
  {/* Custom logo path */}
</svg>
```

Also create favicon set from the logo and add to `layout.tsx`:
```tsx
export const metadata: Metadata = {
  title: "BetterCodeWiki | AI-Powered Code Documentation",
  description: "...",
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    images: ['/og-image.png'],
  },
};
```

**Why**: Using Wikipedia's logo is legally risky (trademarked) and confuses users about the product's identity. A custom logo is fundamental to brand credibility, especially for enterprise buyers.

**Complexity**: Medium (design work, but code changes are simple)

**Dependencies**: None

---

### 3.2 Fetch Live GitHub Stats for Community Section

**What**: Replace hardcoded `stars={0} contributors={0} forks={0}` with live data fetched from GitHub API.

**Where**:
- NEW `src/hooks/useGitHubStats.ts`
- MODIFY `src/app/page.tsx` (line 616, CommunitySection usage)
- MODIFY `src/components/landing/CommunitySection.tsx` (make props optional, accept hook data)

**How**:

`src/hooks/useGitHubStats.ts`:
```typescript
import { useState, useEffect } from 'react';

interface GitHubStats {
  stars: number;
  forks: number;
  contributors: number;
}

export function useGitHubStats(owner: string, repo: string): {
  stats: GitHubStats;
  isLoading: boolean;
} {
  const [stats, setStats] = useState<GitHubStats>({ stars: 0, forks: 0, contributors: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch repo data (stars + forks)
        const repoRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}`,
          { next: { revalidate: 3600 } } // Cache for 1 hour
        );
        if (repoRes.ok) {
          const repoData = await repoRes.json();
          // Fetch contributors count
          const contribRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=1&anon=true`,
          );
          const contribCount = contribRes.ok
            ? parseInt(contribRes.headers.get('Link')?.match(/page=(\d+)>; rel="last"/)?.[1] || '1')
            : 0;

          setStats({
            stars: repoData.stargazers_count || 0,
            forks: repoData.forks_count || 0,
            contributors: contribCount,
          });
        }
      } catch (err) {
        console.error('Failed to fetch GitHub stats:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, [owner, repo]);

  return { stats, isLoading };
}
```

In `page.tsx`:
```typescript
const { stats: githubStats } = useGitHubStats('REDFOX1899', 'BetterCodeWiki');
// ...
<CommunitySection
  stars={githubStats.stars}
  contributors={githubStats.contributors}
  forks={githubStats.forks}
/>
```

**Why**: Animated counters counting to zero is worse than showing nothing. Real numbers (even small ones) build trust. As the project grows, these numbers automatically update.

**Complexity**: Low

**Dependencies**: None

---

### 3.3 Honest Comparison Table with Accurate Competitor Data

**What**: Rewrite the comparison table to be factually accurate and focus on BetterCodeWiki's REAL differentiators.

**Where**:
- MODIFY `src/components/landing/ComparisonTable.tsx` (rewrite the `rows` array, update column header)

**How**: Replace the current dishonest data with accurate comparisons. Change the column header from "Closed-Source Tools" to "Google Code Wiki" (or "Proprietary Alternatives") since that is the actual competitor.

New comparison data:
```typescript
interface ComparisonRow {
  feature: string;
  us: boolean | 'partial';
  them: boolean | 'partial';
  note?: string; // Optional note for context
}

const rows: ComparisonRow[] = [
  { feature: 'Fully open source (MIT)', us: true, them: false },
  { feature: 'Self-hostable / air-gapped', us: true, them: false },
  { feature: 'Bring your own AI model', us: true, them: false,
    note: 'OpenAI, Gemini, OpenRouter, Ollama' },
  { feature: 'Multi-platform (GitHub, GitLab, Bitbucket)', us: true, them: false,
    note: 'Google Code Wiki is GitHub-only' },
  { feature: 'Interactive architecture diagrams', us: true, them: true },
  { feature: 'AI chat about code', us: true, them: true },
  { feature: 'Private repository support', us: true, them: true },
  { feature: 'No data leaves your infrastructure', us: true, them: false },
  { feature: 'Export (Markdown, HTML, Confluence, ZIP)', us: true, them: false },
  { feature: 'MCP server for AI agents', us: true, them: false },
  { feature: 'Auto-sync with repo changes', us: false, them: true,
    note: 'Coming soon' },
  { feature: 'Deep links to source code', us: false, them: true,
    note: 'Planned' },
];
```

Add a `partial` state (rendered as a half-filled circle or "Partial" text) for features that are partially supported. Add a `note` column or tooltip for context.

Update the visual design:
- Add a subtle highlight/glow on the "BetterCodeWiki" column.
- Rows where BetterCodeWiki wins get a very faint green-tinted background.
- Use a "Coming Soon" badge for features in development instead of an X mark.

**Why**: An obviously dishonest comparison table destroys credibility instantly. Enterprise buyers DO their research. An honest table that highlights real strengths (open source, self-host, multi-model, multi-platform) is far more compelling than one that pretends the competitor has no features.

**Complexity**: Low-Medium

**Dependencies**: None

---

### 3.4 New Enterprise Benefits Section

**What**: Add a dedicated section (between Features and Comparison) showcasing enterprise-specific value props: self-hosting, SOC2 compliance readiness, SSO integration, data sovereignty, audit trail, air-gapped deployment.

**Where**:
- NEW `src/components/landing/EnterpriseSection.tsx`
- MODIFY `src/app/page.tsx` (insert after FeatureCards, before ComparisonTable)

**How**: Design as a full-width section with a dark (or inverted) background to visually break the page rhythm. Use a 3-column layout:

```tsx
const enterpriseFeatures = [
  {
    icon: <ShieldIcon />,
    title: 'Data Sovereignty',
    description: 'Self-host on your infrastructure. Your code never leaves your network. GDPR, HIPAA, SOC2 ready.',
  },
  {
    icon: <ServerIcon />,
    title: 'Air-Gapped Deployment',
    description: 'Run entirely offline with Ollama. Perfect for classified or restricted environments.',
  },
  {
    icon: <KeyIcon />,
    title: 'Bring Your Own Keys',
    description: 'Use your existing API keys for OpenAI, Google, or any OpenRouter-compatible model.',
  },
  {
    icon: <GitBranchIcon />,
    title: 'Multi-Platform Support',
    description: 'GitHub, GitLab, Bitbucket, and local repositories. One tool for every codebase.',
  },
  {
    icon: <PlugIcon />,
    title: 'MCP Server Integration',
    description: 'Connect directly with Claude Code, Cursor, or any MCP-compatible AI agent.',
  },
  {
    icon: <CodeIcon />,
    title: 'MIT Licensed',
    description: 'No vendor lock-in. Fork it, modify it, audit every line. Full transparency.',
  },
];
```

Animate with GSAP ScrollTrigger (staggered card entrance from bottom). Use the inverted background trick:

```tsx
<section className="py-24 px-6 bg-foreground text-background">
  {/* Content with inverted theme */}
</section>
```

Or use a gradient background with dark card design for visual distinction.

**Why**: Enterprise buyers need to see explicit messaging about security, compliance, and deployment flexibility. This is BetterCodeWiki's KILLER advantage over Google (which is cloud-only, Google-locked). Not showcasing it is leaving the biggest differentiator on the table.

**Complexity**: Medium

**Dependencies**: 1.1 (for scroll animations)

---

### 3.5 Fix Twitter Link in Footer

**What**: The Twitter/X link in the footer currently points to the GitHub repo instead of a Twitter account.

**Where**:
- MODIFY `src/app/page.tsx` (lines 635-636)

**How**: Either:
1. Replace with actual Twitter/X URL if one exists.
2. Replace the Twitter icon with a Discord icon (if there is a Discord community).
3. Remove the Twitter link entirely if no social account exists.

```tsx
// Option 1: Real Twitter link
<a href="https://x.com/BetterCodeWiki" target="_blank" rel="noopener noreferrer" ...>

// Option 2: Remove if no account exists
// Simply delete lines 635-637

// Option 3: Replace with Discord
import { FaDiscord } from 'react-icons/fa';
<a href="https://discord.gg/bettercodewiki" target="_blank" rel="noopener noreferrer" ...>
  <FaDiscord className="text-lg" />
</a>
```

**Why**: A social link that goes to the wrong destination is a red flag for any user who clicks it. Easy fix, high trust impact.

**Complexity**: Low

**Dependencies**: None

---

### 3.6 Create OG Image and Social Meta Tags

**What**: Create a proper Open Graph image and comprehensive meta tags for social sharing.

**Where**:
- NEW `public/og-image.png` (1200x630)
- MODIFY `src/app/layout.tsx` (enhance metadata export)

**How**: Create an OG image (can be done with Figma, Canva, or programmatically with `@vercel/og`). The image should show the product name, tagline, and a preview of the wiki interface.

Update layout.tsx metadata:
```typescript
export const metadata: Metadata = {
  title: 'BetterCodeWiki | AI-Powered Code Documentation',
  description: 'Generate beautiful, interactive wikis for any repository. Open source, self-hostable, multi-model AI.',
  keywords: ['code documentation', 'wiki', 'AI', 'open source', 'GitHub', 'GitLab'],
  authors: [{ name: 'BetterCodeWiki' }],
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'BetterCodeWiki | AI-Powered Code Documentation',
    description: 'Generate beautiful, interactive wikis for any repository. Open source, self-hostable, multi-model AI.',
    url: 'https://bettercodewiki.com',
    siteName: 'BetterCodeWiki',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'BetterCodeWiki - Understand Any Codebase in Minutes',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BetterCodeWiki | AI-Powered Code Documentation',
    description: 'Generate beautiful, interactive wikis for any repository.',
    images: ['/og-image.png'],
  },
};
```

**Why**: When someone shares BetterCodeWiki on Slack, Twitter, or LinkedIn, the current share card shows a generic Next.js preview. A proper OG image and meta tags make shares look professional and drive click-throughs.

**Complexity**: Low

**Dependencies**: 3.1 (logo should be created first to use in OG image)

---

## Wave 4: Micro-interactions & Details

**Goal**: Add the small touches that separate a good product from a great one.

---

### 4.1 Button Press Feedback (whileTap)

**What**: Add tactile press feedback to all interactive buttons across the landing page.

**Where**:
- `src/components/landing/Hero3D.tsx` (Generate Wiki button)
- `src/components/landing/FooterCTA.tsx` (Generate Wiki button)
- `src/components/landing/CommunitySection.tsx` (Star, Docs, Discussion buttons)
- `src/app/page.tsx` (Quick Start buttons -- already have `whileHover` but no `whileTap`)

**How**: Add `whileTap={{ scale: 0.97 }}` to all `motion.button` and convert static `<button>` / `<a>` elements to `motion.button` / `motion.a` where appropriate.

For non-motion buttons (native `<button>` or `<a>`), add CSS:
```css
button:active, a:active {
  transform: scale(0.97);
  transition: transform 0.1s ease;
}
```

Or better, wrap CTA buttons in motion:
```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
  // ... rest of props
>
```

**Why**: Button press feedback is a fundamental UX expectation. Without it, buttons feel "floaty" and unresponsive. This is a tiny change with disproportionate impact on perceived quality.

**Complexity**: Low

**Dependencies**: None

---

### 4.2 Theme Toggle Transition Fix

**What**: Fix the brief moment during theme toggle where neither the sun nor moon icon is visible.

**Where**:
- MODIFY `src/components/theme-toggle.tsx`

**How**: The current implementation uses `opacity` and `scale` transitions but has a timing gap. The fix:

1. Use `useTheme()` from `next-themes` with a mounted state check to avoid hydration mismatch.
2. Use a single transition group instead of two independent divs:

```tsx
'use client';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Render placeholder with same dimensions to prevent layout shift
    return (
      <button className="... h-9 w-9" disabled>
        <div className="w-4 h-4" />
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="..."
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <div className="relative w-4 h-4">
        <div
          className="absolute inset-0 transition-all duration-300"
          style={{
            transform: isDark ? 'rotate(90deg) scale(0)' : 'rotate(0) scale(1)',
            opacity: isDark ? 0 : 1,
          }}
        >
          {/* Sun SVG */}
        </div>
        <div
          className="absolute inset-0 transition-all duration-300"
          style={{
            transform: isDark ? 'rotate(0) scale(1)' : 'rotate(-90deg) scale(0)',
            opacity: isDark ? 1 : 0,
          }}
        >
          {/* Moon SVG */}
        </div>
      </div>
    </button>
  );
}
```

The key fix is ensuring the `mounted` state prevents any flicker on initial render, and using `style` props instead of template-literal classNames for smoother transitions.

**Why**: A flickering theme toggle is one of the first things a developer notices. It signals "unfinished." Clean theme transitions signal "polished."

**Complexity**: Low

**Dependencies**: None

---

### 4.3 Custom Confirmation Dialog (Replace window.confirm)

**What**: Replace all `window.confirm()` calls with a custom animated modal component.

**Where**:
- NEW `src/components/ui/ConfirmDialog.tsx`
- Search for all `window.confirm` usages and replace

**How**: Create a reusable ConfirmDialog component:

```tsx
interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
}

export default function ConfirmDialog({ ... }: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onCancel}
          />
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 ..."
          >
            {/* Dialog content */}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Why**: `window.confirm()` breaks the visual language of the application and cannot be styled. A custom dialog maintains the design system and feels professional.

**Complexity**: Low-Medium

**Dependencies**: None

---

### 4.4 Remove Console.logs in Production

**What**: Remove debug `console.log` statements from production code.

**Where**:
- `src/components/WikiTreeView.tsx` (line 341: `console.log('WikiTreeView: Rendering tree view with sections:', ...)` and line 342)
- `src/components/Ask.tsx` (line 925: `console.log('Model selection applied:', ...)`)
- `src/app/page.tsx` (line 329: `console.log('Form submission already in progress...')`)
- Search for any other `console.log` statements

**How**: Simply delete the `console.log` lines. For truly necessary debug logging, wrap in a conditional:

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info:', data);
}
```

**Why**: Console.logs in production are a code smell that enterprises notice during security audits. They can also leak sensitive information.

**Complexity**: Low

**Dependencies**: None

---

### 4.5 Mermaid Diagram Entrance Animations

**What**: Add entrance animations to Mermaid diagrams on the landing page so they draw in as you scroll to them.

**Where**:
- MODIFY `src/app/page.tsx` (the diagram section, lines 583-603)
- Optionally MODIFY `src/components/Mermaid.tsx` (add animation support)

**How**: Wrap each Mermaid diagram container in a GSAP ScrollTrigger animation:

1. The diagram container starts with `opacity: 0` and `clipPath: inset(100% 0 0 0)` (hidden from bottom).
2. On scroll, animate to `opacity: 1` and `clipPath: inset(0 0 0 0)` -- creating a "reveal from bottom" wipe effect.
3. Add a subtle scale transition from 0.95 to 1.

```typescript
useGSAP(() => {
  gsap.from('.diagram-container', {
    clipPath: 'inset(100% 0 0 0)',
    opacity: 0,
    scale: 0.95,
    duration: 0.8,
    ease: 'power3.out',
    stagger: 0.2,
    scrollTrigger: {
      trigger: '.diagrams-section',
      start: 'top 75%',
    },
  });
});
```

**Why**: The diagrams are a key selling point of BetterCodeWiki. Currently they just "exist" statically. An entrance animation draws attention and creates a moment of delight.

**Complexity**: Low

**Dependencies**: 1.1 (GSAP setup)

---

### 4.6 Add Animated Section Dividers

**What**: Add subtle animated dividers between major landing page sections (gradient lines, wave patterns, or flowing dots).

**Where**:
- NEW `src/components/landing/SectionDivider.tsx` (from 1.3 -- extend with more variants)
- MODIFY `src/app/page.tsx`

**How**: This builds on item 1.3. Add CSS-only animated dividers as a simpler alternative:

```tsx
function SectionDivider({ variant = 'gradient' }: { variant?: 'gradient' | 'dots' | 'wave' }) {
  if (variant === 'gradient') {
    return (
      <div className="relative h-px w-full max-w-4xl mx-auto overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-shimmer" />
      </div>
    );
  }
  // ... other variants
}
```

Add `@keyframes shimmer` to globals.css:
```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

**Why**: Section dividers create visual breathing room and guide the eye down the page. Animated ones reinforce the "alive" feeling established by Wave 1.

**Complexity**: Low

**Dependencies**: None (CSS-only version)

---

### 4.7 Skeleton Loading States

**What**: Add skeleton loading placeholders for content that loads asynchronously (processed projects, GitHub stats).

**Where**:
- NEW `src/components/ui/Skeleton.tsx`
- MODIFY `src/app/page.tsx` (processed projects section, lines 520-543)
- MODIFY `src/components/landing/CommunitySection.tsx` (stats loading state)

**How**: Create a reusable Skeleton component:

```tsx
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/60',
        className
      )}
    />
  );
}

// Usage for project cards:
function ProjectCardSkeleton() {
  return (
    <div className="border border-border rounded-xl p-6 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
```

**Why**: Loading states prevent layout shifts and communicate to users that content is being fetched. Without them, sections either show nothing or jump when content appears.

**Complexity**: Low

**Dependencies**: None

---

## Wave 5: Wiki Viewer Upgrades

**Goal**: Improve the wiki generation and viewing experience -- the actual product interface.

---

### 5.1 Wiki Generation Progress Indicator

**What**: Add a visual progress indicator during wiki generation showing which pages are being generated, how many are complete, and estimated time remaining.

**Where**:
- NEW `src/components/wiki/GenerationProgress.tsx`
- MODIFY `src/app/[owner]/[repo]/page.tsx` (integrate progress component during generation)

**How**: The wiki generation happens via WebSocket. The backend sends page-level updates. Create a progress component that:

1. Shows a progress bar with fraction complete (e.g., "3 of 12 pages generated").
2. Lists recently completed pages with checkmarks.
3. Shows the current page being generated with a spinner.
4. Estimates remaining time based on average page generation time.

```tsx
interface GenerationProgressProps {
  totalPages: number;
  completedPages: string[];
  currentPage: string | null;
  startTime: number;
}

export default function GenerationProgress({
  totalPages,
  completedPages,
  currentPage,
  startTime,
}: GenerationProgressProps) {
  const progress = completedPages.length / Math.max(totalPages, 1);
  const elapsed = (Date.now() - startTime) / 1000;
  const avgTimePerPage = elapsed / Math.max(completedPages.length, 1);
  const remaining = Math.max(0, (totalPages - completedPages.length) * avgTimePerPage);

  return (
    <div className="max-w-lg mx-auto p-8 space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{completedPages.length} of {totalPages} pages</span>
          <span>~{Math.ceil(remaining / 60)}m remaining</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Current page */}
      {currentPage && (
        <div className="flex items-center gap-3 text-sm">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-foreground">Generating: {currentPage}</span>
        </div>
      )}

      {/* Recent completions */}
      <div className="space-y-2">
        {completedPages.slice(-3).map((page) => (
          <div key={page} className="flex items-center gap-3 text-sm text-muted-foreground">
            <CheckIcon className="w-4 h-4 text-success" />
            <span>{page}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

This requires parsing the WebSocket messages to extract page-level progress. If the backend does not currently send per-page updates, this will need a backend change (create an issue for that).

**Why**: Multi-minute wiki generation with no progress feedback is anxiety-inducing. Users do not know if it is working, how long it will take, or if something has gone wrong. A progress indicator transforms a frustrating wait into an engaging experience.

**Complexity**: Medium-High (depends on backend WebSocket message format)

**Dependencies**: Understanding of WebSocket message protocol in `[owner]/[repo]/page.tsx`

---

### 5.2 Ask AI Slide-in Drawer Animation

**What**: Convert the Ask AI component from a plain div that appears inline to a slide-in drawer from the right side of the screen.

**Where**:
- NEW `src/components/wiki/AskDrawer.tsx` (wrapper)
- MODIFY `src/app/[owner]/[repo]/page.tsx` (replace inline Ask usage with AskDrawer)

**How**: Create a drawer component using Framer Motion's `AnimatePresence`:

```tsx
import { AnimatePresence, motion } from 'framer-motion';
import Ask from '@/components/Ask';

interface AskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  repoInfo: RepoInfo;
  // ... other Ask props
}

export default function AskDrawer({ isOpen, onClose, ...askProps }: AskDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-background border-l border-border z-50 shadow-2xl overflow-y-auto"
          >
            {/* Close button */}
            <div className="sticky top-0 bg-background/80 backdrop-blur-md border-b border-border p-4 flex justify-between items-center">
              <h2 className="text-title-md font-semibold">Ask AI</h2>
              <button onClick={onClose} className="...">
                <XIcon />
              </button>
            </div>
            <Ask {...askProps} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Why**: A slide-in drawer is the standard pattern for auxiliary panels in document viewers (Notion, Linear, Google Docs). It keeps the wiki content visible while providing a focused AI interaction space. The current inline div disrupts the reading flow.

**Complexity**: Medium

**Dependencies**: None

---

### 5.3 Wiki Page Transition Animations

**What**: Add smooth transition animations when navigating between wiki pages (cross-fade or slide).

**Where**:
- MODIFY `src/app/[owner]/[repo]/page.tsx` (content area where page content is rendered)

**How**: Wrap the main content area in Framer Motion's `AnimatePresence` with a key based on the current page ID:

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={currentPageId}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2, ease: 'easeInOut' }}
    className="prose dark:prose-invert max-w-none"
  >
    <Markdown content={currentPage.content} />
  </motion.div>
</AnimatePresence>
```

**Why**: Instant content replacement (the current behavior) feels jarring. A 200ms fade-slide transition makes page navigation feel smooth and intentional, matching the quality of tools like Notion and GitBook.

**Complexity**: Low

**Dependencies**: None

---

### 5.4 Force Simulation Performance Fix

**What**: Move the DependencyGraph force simulation off the render path.

**Where**:
- MODIFY `src/components/DependencyGraph.tsx` (the `computeLayout` function)

**How**: The current implementation runs 100 iterations of force simulation synchronously during render. Move this to a Web Worker or use `requestAnimationFrame` with iterative convergence:

Option A (simpler): Memoize the layout computation and run it in a `useEffect` with `requestIdleCallback`:
```typescript
const [layoutReady, setLayoutReady] = useState(false);
const nodesRef = useRef<GraphNode[]>([]);

useEffect(() => {
  // Run force simulation in chunks using requestIdleCallback
  let iteration = 0;
  const maxIterations = 100;

  function runChunk(deadline: IdleDeadline) {
    while (iteration < maxIterations && deadline.timeRemaining() > 1) {
      simulateStep(nodesRef.current, edges);
      iteration++;
    }
    if (iteration < maxIterations) {
      requestIdleCallback(runChunk);
    } else {
      setLayoutReady(true);
    }
  }

  requestIdleCallback(runChunk);
}, [pages]);
```

Option B (better): Use a Web Worker for the force simulation.

**Why**: Running 100 synchronous simulation iterations blocks the main thread during render, causing jank when the dependency graph is opened. Breaking it into idle-time chunks keeps the UI responsive.

**Complexity**: Medium

**Dependencies**: None

---

### 5.5 Sidebar Loading State Improvements

**What**: Add skeleton loading state for the wiki tree sidebar while content is being generated.

**Where**:
- MODIFY `src/components/WikiTreeView.tsx`

**How**: When the wiki structure is loading (no sections yet), show a skeleton tree:

```tsx
if (!wikiStructure || wikiStructure.sections.length === 0) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          {i % 2 === 0 && (
            <div className="pl-4 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Why**: A blank sidebar during generation gives no feedback. Skeletons communicate that content is coming and show the expected structure.

**Complexity**: Low

**Dependencies**: 4.7 (Skeleton component)

---

## Appendix: File-Level Change Map

This is a complete list of every file that will be created or modified, organized alphabetically.

### Files to CREATE:

| File | Wave | Description |
|------|------|-------------|
| `public/apple-touch-icon.png` | 3 | Apple touch icon |
| `public/favicon-32x32.png` | 3 | 32px favicon |
| `public/favicon.ico` | 3 | Standard favicon |
| `public/logo.svg` | 3 | Custom brand logo SVG |
| `public/og-image.png` | 3 | Open Graph social image |
| `public/site.webmanifest` | 3 | PWA manifest |
| `src/components/landing/CodeConstellation.tsx` | 2 | 3D node graph hero replacement |
| `src/components/landing/EnterpriseSection.tsx` | 3 | Enterprise benefits section |
| `src/components/landing/FloatingElements.tsx` | 1 | Scroll-persistent floating 3D objects |
| `src/components/landing/ScrollAnimationProvider.tsx` | 1 | GSAP + Lenis wrapper |
| `src/components/landing/SectionDivider.tsx` | 1 | Animated section dividers |
| `src/components/ui/ConfirmDialog.tsx` | 4 | Custom confirmation modal |
| `src/components/ui/Skeleton.tsx` | 4 | Reusable skeleton loading |
| `src/components/wiki/AskDrawer.tsx` | 5 | Slide-in drawer for Ask AI |
| `src/components/wiki/GenerationProgress.tsx` | 5 | Wiki generation progress bar |
| `src/hooks/useGitHubStats.ts` | 3 | Live GitHub stats fetcher |
| `src/hooks/useScrollProgress.ts` | 1 | GSAP ScrollTrigger progress hook |
| `src/lib/gsap.ts` | 1 | GSAP initialization module |
| `src/lib/smooth-scroll.ts` | 1 | Lenis smooth scroll setup |

### Files to MODIFY:

| File | Wave(s) | Changes |
|------|---------|---------|
| `package.json` | 1 | Add `@gsap/react`, `lenis`, `@react-three/postprocessing` |
| `src/app/globals.css` | 2, 4 | Add keyframes for mobile hero, shimmer, float animations |
| `src/app/layout.tsx` | 3 | Enhanced metadata (favicon, OG image, social tags) |
| `src/app/page.tsx` | 1, 3, 4 | Wrap in ScrollAnimationProvider, insert SectionDividers and EnterpriseSection, fix Twitter link, replace FaWikipediaW, use live GitHub stats, remove console.log |
| `src/app/[owner]/[repo]/page.tsx` | 5 | Add GenerationProgress, AskDrawer, page transition animations |
| `src/components/Ask.tsx` | 4 | Remove console.log (line 925) |
| `src/components/DependencyGraph.tsx` | 5 | Move force simulation off render path |
| `src/components/landing/CommunitySection.tsx` | 1, 3 | GSAP ScrollTrigger animations, accept loading state |
| `src/components/landing/ComparisonTable.tsx` | 1, 3 | GSAP animations, honest comparison data with notes |
| `src/components/landing/FeatureCards.tsx` | 1 | GSAP ScrollTrigger animations |
| `src/components/landing/FooterCTA.tsx` | 1 | GSAP ScrollTrigger animations |
| `src/components/landing/Hero3D.tsx` | 2 | Swap KnowledgeCube for CodeConstellation, add postprocessing, fix mobile fallback, add off-screen pause |
| `src/components/landing/HowItWorks.tsx` | 1 | GSAP ScrollTrigger animations, animated connecting line |
| `src/components/landing/KnowledgeCube.tsx` | 2 | DEPRECATED -- replaced by CodeConstellation.tsx |
| `src/components/landing/ParticleField.tsx` | 2 | Upgrade to flowing data streams |
| `src/components/theme-toggle.tsx` | 4 | Fix transition flicker, add mounted check |
| `src/components/WikiTreeView.tsx` | 4 | Remove console.logs (lines 341-342), add skeleton state |

---

## Implementation Priority & Estimated Timeline

| Wave | Theme | Estimated Effort | Key Deliverables |
|------|-------|-----------------|------------------|
| **Wave 1** | Make the Scroll Alive | 3-5 days | GSAP + Lenis setup, all sections animated, parallax layers, floating 3D |
| **Wave 2** | Upgrade the Hero | 2-3 days | CodeConstellation, particle streams, postprocessing, mobile fallback |
| **Wave 3** | Enterprise Polish | 2-3 days | Logo, live stats, honest comparison, enterprise section, meta tags |
| **Wave 4** | Micro-interactions | 1-2 days | Button feedback, theme toggle fix, confirm dialog, console cleanup, diagrams |
| **Wave 5** | Wiki Viewer | 2-3 days | Progress indicator, Ask drawer, page transitions, performance fixes |

**Total estimated effort**: 10-16 days for a single developer, or 5-8 days with two developers working in parallel (Waves 1+2 can partially overlap with Wave 3, Wave 4 is independent).

---

## Key Principles to Follow During Implementation

1. **Performance budget**: Landing page Lighthouse score must stay above 90. Test after each wave.
2. **Progressive enhancement**: All content must be visible and functional without JavaScript animations. Animations are enhancement, not requirement.
3. **Reduced motion**: Always respect `prefers-reduced-motion`. Disable GSAP animations, Three.js, and complex transitions when this media query matches.
4. **Mobile first**: Every animation must have a mobile fallback. Do not add Three.js to mobile. CSS animations only on phones.
5. **Bundle size**: Monitor bundle size after adding new packages. Lenis is ~6KB gzipped, @gsap/react is ~2KB, @react-three/postprocessing is tree-shakeable.
6. **Theme awareness**: Every new component must work in both light and dark modes. Test both after every change.
7. **Incremental delivery**: Each wave can be merged independently. Do not wait for all waves to be complete before merging Wave 1.
