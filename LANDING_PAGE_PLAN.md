# BetterCodeWiki: 3D Animated Landing Page Plan

**Created:** 2026-02-20
**Based on:** Competitor analysis of Google CodeWiki + existing codebase audit
**Tech Stack:** Next.js 15 + React 19 + Tailwind CSS 4 + Three.js (via React Three Fiber) + Framer Motion + GSAP

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [3D Animation Concepts](#2-3d-animation-concepts)
3. [Marketing Copy Plan](#3-marketing-copy-plan)
4. [Page Layout (Section by Section)](#4-page-layout-section-by-section)
5. [Technical Implementation Plan](#5-technical-implementation-plan)
6. [Component Breakdown](#6-component-breakdown)
7. [Performance & Accessibility](#7-performance--accessibility)
8. [Implementation Timeline](#8-implementation-timeline)

---

## 1. Executive Summary

### The Opportunity
Google CodeWiki has **no marketing landing page** -- it is a bare Angular SPA shell with minimal CSS animations (border-glow trails only). It relies entirely on the Google brand name rather than persuasive design. This gives us an enormous opening to create the most visually impressive code documentation tool landing page in the market.

### The Goal
Build a scroll-driven, 3D-animated landing page that:
- Instantly communicates what BetterCodeWiki does (< 3 seconds)
- Creates a "wow" moment with a 3D hero animation
- Guides users through a narrative scroll experience
- Converts visitors with an interactive try-it-now demo
- Reinforces credibility with open-source proof and community stats

### Design Philosophy
- **Vercel/Linear-inspired** -- clean, dark-first, with surgical use of animation
- **3D as storytelling** -- not decorative, but functional (each animation communicates a concept)
- **Progressive enhancement** -- works beautifully without 3D, even more impressive with it

---

## 2. 3D Animation Concepts

### 2.1 Hero 3D Element: The Knowledge Cube

A floating, slowly rotating **icosahedron** (20-faced polyhedron) made of translucent panels, each face displaying a different aspect of code understanding.

#### Visual Description
```
                    ___________
                   /          /\
                  /  CODE    /  \
                 /          / DI \
                /_________ /AGRAM\
                \          \     /
                 \  WIKI    \ A /
                  \          \/R/
                   \__________/C/
                    \         /H/
                     \  DOC  / /
                      \     /./
                       \___//
```

#### Behavior
- **On load:** Fades in from slight scale-down (0.85 -> 1.0) with a 1.2s spring animation
- **Idle state:** Slow continuous rotation on Y-axis (0.003 rad/frame) and slight X wobble (0.001 rad/frame)
- **Mouse interaction:** The cube tilts toward the cursor position (parallax). Maximum tilt: 15 degrees. Uses lerp for smooth follow (factor 0.05)
- **Face content:** Each visible face shows a frosted-glass panel with one of:
  - `{ }` code bracket icon
  - Tree diagram icon (wiki structure)
  - Flow chart icon (Mermaid diagrams)
  - Brain/AI icon (intelligence)
  - Globe icon (multi-platform)
  - Lock-open icon (open source)
- **Edge glow:** All edges emit a soft blue glow (our primary color `hsl(221, 83%, 53%)`) using `<Edges>` from `@react-three/drei` with emissive material
- **Particle system:** 200-300 small particles orbit the cube in elliptical paths, using `<Points>` from drei. Particles are 1-2px, white with 30% opacity, creating a "data flowing" effect

#### R3F Implementation Pattern
```tsx
// Using @react-three/fiber and @react-three/drei
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Edges, MeshTransmissionMaterial, Points, PointMaterial, Environment } from '@react-three/drei'

function KnowledgeCube({ mouse }) {
  const meshRef = useRef()
  useFrame((state, delta) => {
    // Slow idle rotation
    meshRef.current.rotation.y += 0.003
    meshRef.current.rotation.x += 0.001
    // Mouse parallax with lerp
    meshRef.current.rotation.x = THREE.MathUtils.lerp(
      meshRef.current.rotation.x,
      mouse.y * 0.3,
      0.05
    )
  })

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <icosahedronGeometry args={[2, 1]} />
      <MeshTransmissionMaterial
        backside
        samples={4}
        thickness={0.5}
        chromaticAberration={0.2}
        anisotropy={0.3}
        distortion={0.1}
        color="#4a90d9"
        roughness={0.3}
      />
      <Edges color="#3b82f6" lineWidth={2} />
    </Float>
  )
}
```

### 2.2 Scroll-Triggered Animations

#### Section Transition: Cube Unfolds into Features
As the user scrolls past the hero section (scroll progress 0% -> 30%), the cube:
1. Stops rotating (rotation eases to zero)
2. Each face detaches and flies outward to become individual feature cards
3. The faces settle into a 2x2 grid layout below
4. Each card retains a slight 3D perspective tilt on hover

**GSAP ScrollTrigger pattern:**
```tsx
gsap.to(cubeRef.current.rotation, {
  y: 0,
  x: 0,
  scrollTrigger: {
    trigger: '#features-section',
    start: 'top bottom',
    end: 'top center',
    scrub: 1,
  }
})
```

#### Code Build-Up Animation
In the "How It Works" section, a code block appears to type itself character by character:
```
Step 1: You paste a repo URL
         |
         v
    ┌─────────────────────────────────┐
    │ https://github.com/you/repo     │  <- types in character by character
    └─────────────────────────────────┘

Step 2: AI analyzes your codebase
         |
         v
    ┌─────────────────────────────────┐
    │ Scanning 847 files...           │  <- counter animates up
    │ ████████████░░░░░░ 67%          │  <- progress bar fills
    │ Found 23 modules, 156 functions │  <- fades in
    └─────────────────────────────────┘

Step 3: A complete wiki materializes
         |
         v
    ┌─────────────────────────────────┐
    │ 📖 Architecture Overview        │  <- slides in from left
    │ 📖 API Reference               │  <- slides in (staggered)
    │ 📖 Data Flow Diagrams          │  <- slides in (staggered)
    │ 📖 Component Relationships     │  <- slides in (staggered)
    └─────────────────────────────────┘
```

#### Architecture Diagram Assembly
A Mermaid-style diagram that builds itself piece by piece as the user scrolls:
1. First, nodes appear one by one (fade + scale up from center)
2. Then, edges draw themselves between nodes (SVG stroke-dashoffset animation)
3. Finally, labels fade in on the edges
4. Total animation spans ~2 seconds of scroll distance

### 2.3 Interactive Demo Section: The Portal Effect

The demo section has a glowing 3D border effect -- like looking through a portal into the tool:

```
    ╔══════════════════════════════════════════╗
    ║  ░░░░░ GLOW BORDER (animated) ░░░░░░░  ║
    ║  ┌────────────────────────────────────┐  ║
    ║  │  Paste any repository URL:         │  ║
    ║  │  ┌──────────────────────────────┐  │  ║
    ║  │  │ https://github.com/...       │  │  ║
    ║  │  └──────────────────────────────┘  │  ║
    ║  │              [Generate]             │  ║
    ║  │                                    │  ║
    ║  │  Preview:                          │  ║
    ║  │  ┌──────────────────────────────┐  │  ║
    ║  │  │  Wiki tree + content preview │  │  ║
    ║  │  │  (live from our API)         │  │  ║
    ║  │  └──────────────────────────────┘  │  ║
    ║  └────────────────────────────────────┘  ║
    ║  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║
    ╚══════════════════════════════════════════╝
```

The glow border uses a CSS conic-gradient animation (similar to but more dramatic than Google CodeWiki's `offset-path` trail):
```css
.portal-border {
  background: conic-gradient(from var(--angle), transparent 0%, #3b82f6 10%, transparent 20%);
  animation: rotate-border 4s linear infinite;
}
@keyframes rotate-border {
  from { --angle: 0deg; }
  to { --angle: 360deg; }
}
```

### 2.4 Background Particle Field

A full-page background canvas (behind all content) with a subtle particle field:
- 500 tiny particles (1px) with very low opacity (0.15)
- Particles drift slowly downward (0.2px/frame)
- Mouse proximity causes particles within 150px to gently push away (repulsion)
- Creates a "living" atmosphere without being distracting
- Rendered on a separate `<canvas>` with `position: fixed; z-index: 0`

---

## 3. Marketing Copy Plan

### 3.1 Hero Section Copy

**Headline (Primary):**
> **Understand Any Codebase in Minutes**

**Subtitle:**
> Drop in a repository URL. Get a complete, AI-generated wiki with architecture diagrams, component maps, and searchable documentation -- powered by the AI model of your choice.

**CTA Button:** `Generate Wiki -- It's Free`
**Secondary CTA (text link):** `View on GitHub`

**Rationale:** The headline focuses on the user's goal (understanding code), not our technology. The subtitle packs three key differentiators: ease of use (drop in a URL), comprehensiveness (complete wiki), and flexibility (AI model of your choice). The CTA removes friction (free) and the secondary CTA builds trust (open source).

### 3.2 Social Proof Bar (Below Hero)

```
[GitHub icon] Open Source  |  [Star icon] {dynamic} Stars  |  [Code icon] 10+ Languages  |  [Shield icon] GitHub, GitLab & Bitbucket  |  [Server icon] Self-Hostable
```

These are pill-shaped badges, similar to what the current page has but with the addition of:
- **Dynamic GitHub star count** (fetched at build time via GitHub API)
- **"Self-Hostable"** badge (key differentiator vs. Google)

### 3.3 "How It Works" Section Copy

**Section Headline:** `Three Steps. Zero Configuration.`

| Step | Title | Description |
|------|-------|-------------|
| 1 | **Paste Your Repo** | Enter any GitHub, GitLab, or Bitbucket URL. Private repos? Just add your token. Local folders work too. |
| 2 | **AI Does the Heavy Lifting** | Our multi-model AI engine analyzes your code structure, dependencies, data flows, and architecture patterns. |
| 3 | **Explore Your Wiki** | Browse a complete documentation wiki with interactive Mermaid diagrams, searchable pages, and an AI chat assistant. |

### 3.4 Feature Section Headlines

| Feature | Headline | One-liner |
|---------|----------|-----------|
| Multi-AI | **Your Model, Your Rules** | Choose from Google Gemini, OpenAI GPT, OpenRouter, or run locally with Ollama. No vendor lock-in. |
| Diagrams | **See the Architecture** | Auto-generated Mermaid diagrams: flow charts, sequence diagrams, dependency graphs, and component maps. |
| Multi-Platform | **Every Repository, Everywhere** | GitHub, GitLab, Bitbucket, or a folder on your machine. Public or private. We handle it all. |
| Open Source | **Fully Open. Fully Yours.** | MIT licensed. Self-host on your infrastructure. Audit every line of code. No data leaves your network. |

### 3.5 Comparison Section Copy

**Section Headline:** `Built Different`

| Capability | Us | Closed-Source Tools |
|-----------|-----|---------------------|
| AI Provider Choice | Choose any (Google, OpenAI, OpenRouter, Ollama) | Single provider, no choice |
| Self-Hosting | Full self-hosting support | Cloud-only, your code goes to their servers |
| Source Code | 100% open source (MIT) | Proprietary, black box |
| Platform Support | GitHub + GitLab + Bitbucket + Local | Usually GitHub only |
| Interactive Diagrams | Mermaid flow, sequence, dependency, component | Basic or none |
| Ask AI About Code | Built-in chat with deep research mode | Limited or paid add-on |
| Languages | 10+ wiki output languages | English only or limited |
| Cost | Free (bring your own API key) | Subscription pricing |

**Note:** We do NOT name competitors. "Closed-Source Tools" is the column header.

### 3.6 Open Source / Community Section

**Section Headline:** `Built by the Community, for the Community`

**Body:** BetterCodeWiki is open source and always will be. We believe code documentation should be accessible to every developer, every team, everywhere.

**Stats to display (dynamic):**
- GitHub Stars count
- Contributors count
- Forks count
- Languages supported (10+)

**CTA:** `Star Us on GitHub` | `Read the Docs` | `Join the Discussion`

### 3.7 Final CTA Section

**Headline:** `Ready to Understand Your Code?`
**Subtitle:** `Paste a repository URL and generate your wiki in under 60 seconds.`

This section contains the same hero search input (repo URL + Generate button), creating a **bookend effect** -- the page starts and ends with the same action, capturing users who have scrolled the entire page and are now convinced.

---

## 4. Page Layout (Section by Section)

### Section 0: Navigation Bar

```
┌──────────────────────────────────────────────────────────────┐
│  [Logo] DeepWiki-Open     Wiki Projects     [Theme] [GitHub] │
└──────────────────────────────────────────────────────────────┘
```

- **Position:** `sticky top-0 z-50`
- **Behavior:** Transparent background when at top of page. After 50px scroll, transitions to `bg-background/80 backdrop-blur-md` with bottom border. This is controlled by a scroll listener + CSS transition.
- **Height:** 64px (same as current)
- **Content:** Logo + App name (left), Wiki Projects link (center), Theme toggle + GitHub icon link (right)

### Section 1: Hero (viewport height)

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                                                                      │
│                        [3D KNOWLEDGE CUBE]                           │
│                       (floating, rotating)                           │
│                                                                      │
│              Understand Any Codebase in Minutes                      │
│                                                                      │
│     Drop in a repository URL. Get a complete, AI-generated wiki      │
│     with architecture diagrams, component maps, and searchable       │
│     documentation -- powered by the AI model of your choice.         │
│                                                                      │
│     ┌──────────────────────────────────────────────────────────┐     │
│     │ 🔍 https://github.com/owner/repo              [Generate]│     │
│     └──────────────────────────────────────────────────────────┘     │
│                                                                      │
│     [Open Source]  [X Stars]  [10+ Languages]  [Self-Hostable]       │
│                                                                      │
│                          ↓ Scroll to explore                         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Background:** Radial gradient from `primary/5` at top to `background` (keep existing pattern, but extend to full viewport height)
- **3D Cube:** Positioned in the top-center area, takes roughly 300px height
- **Layout:** Flexbox column, centered, `min-h-screen`
- **Scroll indicator:** Subtle animated chevron at bottom (`animate-bounce` on opacity)

### Section 2: Trusted By / Social Proof Bar

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  "Loved by developers who are tired of reading raw source code"      │
│                                                                      │
│  [GitHub Stars Badge]  [License: MIT]  [Contributors: XX]            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Background:** Subtle border top/bottom, `bg-muted/30`
- **Height:** Compact -- ~120px
- **Animation:** Badges fade in sequentially (stagger 0.1s) on scroll into view

### Section 3: How It Works

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                 Three Steps. Zero Configuration.                     │
│                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │     01       │    │     02       │    │     03       │             │
│  │  ┌───────┐   │    │  ┌───────┐   │    │  ┌───────┐   │            │
│  │  │ PASTE │   │    │  │ AI    │   │    │  │EXPLORE│   │            │
│  │  │ REPO  │   │    │  │ANALYZE│   │    │  │ WIKI  │   │            │
│  │  └───────┘   │    │  └───────┘   │    │  └───────┘   │            │
│  │              │    │              │    │              │             │
│  │  Enter any   │    │  Multi-model │    │  Browse docs │            │
│  │  repo URL    │    │  AI engine   │    │  + diagrams  │            │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                                                      │
│            ·····──────>·····──────>·····                             │
│                (animated connecting line)                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Layout:** 3-column grid on desktop, vertical stack on mobile
- **Animation:** Each step card slides in from bottom with stagger. The connecting dotted line draws itself (SVG `stroke-dashoffset` animation). Each step's icon area has a subtle 3D perspective tilt on hover.
- **The code typing animation** (described in Section 2.2) plays within step 1's card when it enters viewport

### Section 4: Features (4 cards)

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌───────────────────────┐    ┌───────────────────────┐              │
│  │  Your Model,          │    │  See the              │              │
│  │  Your Rules           │    │  Architecture         │              │
│  │                       │    │                       │              │
│  │  [Icon: AI Models]    │    │  [Icon: Diagram]      │              │
│  │                       │    │                       │              │
│  │  Choose from Google   │    │  Auto-generated       │              │
│  │  Gemini, OpenAI GPT,  │    │  Mermaid diagrams:    │              │
│  │  OpenRouter, or run   │    │  flow charts,         │              │
│  │  locally with Ollama. │    │  sequence diagrams,   │              │
│  │  No vendor lock-in.   │    │  dependency graphs.   │              │
│  └───────────────────────┘    └───────────────────────┘              │
│                                                                      │
│  ┌───────────────────────┐    ┌───────────────────────┐              │
│  │  Every Repository,    │    │  Fully Open.          │              │
│  │  Everywhere           │    │  Fully Yours.         │              │
│  │                       │    │                       │              │
│  │  [Icon: Platforms]    │    │  [Icon: Open Source]   │              │
│  │                       │    │                       │              │
│  │  GitHub, GitLab,      │    │  MIT licensed.        │              │
│  │  Bitbucket, or local. │    │  Self-host. Audit     │              │
│  │  Public or private.   │    │  every line of code.  │              │
│  └───────────────────────┘    └───────────────────────┘              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Layout:** 2x2 grid on desktop, single column on mobile
- **Card style:** `bg-card rounded-xl border border-border p-8 elevation-1` (matches existing design system)
- **Animation:** Cards slide in with 3D perspective transforms -- each card appears to "flip in" from a slight Y-rotation (rotateY from -5deg to 0deg) combined with opacity and translateY
- **Hover:** Cards lift slightly (`translateY(-4px)`) and shadow increases (`elevation-2`), plus a subtle border color shift to `primary/50` -- matching the existing `card-hover` utility

### Section 5: Live Demo

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                    Try It Right Now                                   │
│           No sign-up. No API key needed for public repos.            │
│                                                                      │
│  ╔═══════════════════════════════════════════════════════════════╗    │
│  ║  ░░░░░░░░░ ANIMATED GLOWING BORDER ░░░░░░░░░░░░░░░░░░░░░░  ║    │
│  ║                                                               ║    │
│  ║   Enter a public repository:                                  ║    │
│  ║   ┌─────────────────────────────────────────┬──────────┐     ║    │
│  ║   │ https://github.com/AsyncFuncAI/deepwiki │ Generate │     ║    │
│  ║   └─────────────────────────────────────────┴──────────┘     ║    │
│  ║                                                               ║    │
│  ║   Quick examples:                                             ║    │
│  ║   [facebook/react]  [vuejs/vue]  [denoland/deno]             ║    │
│  ║                                                               ║    │
│  ║   ┌────────────────────────────────────────────────────┐     ║    │
│  ║   │              WIKI PREVIEW AREA                     │     ║    │
│  ║   │                                                    │     ║    │
│  ║   │   [Tree sidebar]  |  [Content preview]             │     ║    │
│  ║   │                   |                                │     ║    │
│  ║   │                   |  # Architecture Overview       │     ║    │
│  ║   │                   |  The repository is structured  │     ║    │
│  ║   │                   |  as a monorepo with...         │     ║    │
│  ║   │                   |                                │     ║    │
│  ║   └────────────────────────────────────────────────────┘     ║    │
│  ║                                                               ║    │
│  ╚═══════════════════════════════════════════════════════════════╝    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Portal border:** Uses CSS `@property` for animated `conic-gradient` rotation (as described in Section 2.3)
- **Preview area:** Shows a simplified version of the actual wiki output (tree + content)
- **Quick examples:** Clickable pill buttons that auto-fill the input
- **On generate:** Shows a loading animation, then renders a real (but simplified) wiki preview from our API
- **Fallback:** If the API is unavailable, show a static screenshot/mockup with a "Deploy your own instance" CTA

### Section 6: Comparison Table

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                         Built Different                               │
│                                                                      │
│  ┌──────────────────┬──────────────┬──────────────────────┐          │
│  │ Capability        │ DeepWiki-Open│ Closed-Source Tools  │          │
│  ├──────────────────┼──────────────┼──────────────────────┤          │
│  │ AI Provider       │ [check] Any  │ [x] Single vendor   │          │
│  │ Self-Hosting      │ [check] Yes  │ [x] Cloud only      │          │
│  │ Source Code       │ [check] MIT  │ [x] Proprietary     │          │
│  │ Platforms         │ [check] All  │ [x] GitHub only     │          │
│  │ Diagrams          │ [check] Rich │ [x] Basic/none      │          │
│  │ Ask AI            │ [check] Yes  │ [x] Limited/paid    │          │
│  │ Languages         │ [check] 10+  │ [x] English only    │          │
│  │ Cost              │ [check] Free │ [x] Subscription    │          │
│  └──────────────────┴──────────────┴──────────────────────┘          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Animation:** Table rows slide in from the left with stagger (0.05s between rows)
- **Check marks:** Green with a subtle scale-pop animation as they appear
- **X marks:** Red/muted, static
- **Mobile:** Transforms into a card-based layout (one card per capability)

### Section 7: Open Source Community

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│        Built by the Community, for the Community                     │
│                                                                      │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│    │  ★ XXX  │  │  👥 XX  │  │  🍴 XX  │  │ 🌍 10+  │             │
│    │  Stars  │  │ Contrib.│  │  Forks  │  │  Langs  │              │
│    └─────────┘  └─────────┘  └─────────┘  └─────────┘              │
│                                                                      │
│    [Star Us on GitHub]  [Read the Docs]  [Join Discussion]           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Stats:** Numbers animate upward (count-up) when scrolled into view
- **Background:** Subtle gradient or pattern to differentiate from other sections
- **CTAs:** Three buttons in a row, primary + secondary + ghost variants

### Section 8: Final CTA

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│              Ready to Understand Your Code?                          │
│                                                                      │
│     Paste a repository URL and generate your wiki in under           │
│     60 seconds.                                                      │
│                                                                      │
│     ┌──────────────────────────────────────────────────────────┐     │
│     │ 🔍 https://github.com/owner/repo              [Generate]│     │
│     └──────────────────────────────────────────────────────────┘     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Background:** Same radial gradient as hero but inverted (gradient from bottom)
- **The search input is the SAME component** as the hero -- reused via shared component
- **Animation:** Section fades in on scroll

### Section 9: Footer

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  DeepWiki - AI-powered documentation    [GitHub] [Twitter] [Coffee]  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- Keep the existing footer design (it's clean and sufficient)
- Add a small "Built with Next.js, React, and Three.js" attribution if desired

---

## 5. Technical Implementation Plan

### 5.1 New Package Dependencies

```bash
# 3D rendering
yarn add three @react-three/fiber @react-three/drei

# Scroll-triggered animations
yarn add gsap @gsap/react

# Type definitions
yarn add -D @types/three
```

**Package Justification:**
| Package | Size (gzip) | Purpose |
|---------|-------------|---------|
| `three` | ~150KB | Core 3D engine |
| `@react-three/fiber` | ~40KB | React renderer for Three.js |
| `@react-three/drei` | ~60KB (tree-shakable) | Pre-built R3F components (Float, Edges, etc.) |
| `gsap` | ~25KB | Scroll-triggered animations via ScrollTrigger |
| `@gsap/react` | ~2KB | React hooks for GSAP |

**Total additional JS:** ~277KB gzipped (loaded lazily, only on landing page)

**Note:** `framer-motion` is already installed (v12.34.3) and will be used for simpler animations (fade-in, stagger). GSAP is specifically for scroll-linked animations that need `ScrollTrigger`.

### 5.2 Integration with Existing Setup

**Existing stack compatibility:**
- **Next.js 15.3.1** -- Full support for `'use client'` components, dynamic imports
- **React 19** -- Compatible with all R3F and GSAP packages
- **Tailwind CSS 4** -- All new components will use existing design tokens and utility classes
- **Framer Motion 12.34** -- Already used in `page.tsx` for fade animations; will continue to be used for non-scroll animations
- **Theme system (next-themes)** -- 3D scene will respect dark/light mode via CSS variables

**Key integration patterns:**
```tsx
// Lazy load Three.js only on the landing page
const Hero3D = dynamic(() => import('@/components/landing/Hero3D'), {
  ssr: false, // Three.js cannot render on server
  loading: () => <HeroFallback /> // Static gradient placeholder
})
```

### 5.3 File Structure

```
src/
├── app/
│   ├── page.tsx                    # MODIFIED: Becomes the new landing page shell
│   └── ...
├── components/
│   ├── landing/                    # NEW: All landing page components
│   │   ├── Hero3D.tsx              # 3D cube + Canvas wrapper
│   │   ├── KnowledgeCube.tsx       # The actual 3D geometry + animations
│   │   ├── ParticleField.tsx       # Background particle system
│   │   ├── HeroSection.tsx         # Hero layout (headline, search, badges)
│   │   ├── HowItWorks.tsx          # 3-step animated flow
│   │   ├── FeatureShowcase.tsx     # 4 feature cards with 3D hover
│   │   ├── InteractiveDemo.tsx     # Live demo section with portal border
│   │   ├── ComparisonTable.tsx     # Feature comparison matrix
│   │   ├── CommunitySection.tsx    # Open source stats + CTAs
│   │   ├── FinalCTA.tsx            # Bottom CTA with search input
│   │   ├── RepoSearchInput.tsx     # Shared search input component
│   │   ├── ScrollProgress.tsx      # Scroll progress indicator (optional)
│   │   └── AnimatedCounter.tsx     # Number count-up animation utility
│   └── ...existing components
```

---

## 6. Component Breakdown

### 6.1 `Hero3D.tsx` -- The Main 3D Hero Component

**Responsibilities:**
- Wraps `<Canvas>` from R3F
- Sets up camera, lighting, and environment
- Tracks mouse position and passes to KnowledgeCube
- Handles the `prefers-reduced-motion` media query (disables rotation if true)
- Sets up `Suspense` with a fallback gradient

**Key implementation details:**
```tsx
'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense, useRef, useState, useEffect } from 'react'
import { Environment, Preload } from '@react-three/drei'
import KnowledgeCube from './KnowledgeCube'
import ParticleField from './ParticleField'

export default function Hero3D() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    mq.addEventListener('change', (e) => setReducedMotion(e.matches))
  }, [])

  return (
    <div
      className="w-full h-[400px] md:h-[500px]"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setMouse({
          x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
          y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
        })
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 2]}  // Limit pixel ratio for performance
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <KnowledgeCube mouse={mouse} reducedMotion={reducedMotion} />
          <ParticleField count={300} />
          <Environment preset="city" />
          <Preload all />
        </Suspense>
      </Canvas>
    </div>
  )
}
```

### 6.2 `KnowledgeCube.tsx` -- The 3D Geometry

**Responsibilities:**
- Renders the icosahedron with transmission material
- Handles idle rotation + mouse parallax
- Renders edge glow
- Contains the floating animation

**Key R3F patterns used:**
- `useFrame` for per-frame animation
- `Float` from drei for gentle bobbing
- `Edges` from drei for wireframe glow
- `MeshTransmissionMaterial` for the glass-like appearance
- `THREE.MathUtils.lerp` for smooth mouse following

### 6.3 `FeatureShowcase.tsx` -- Scroll-Triggered Feature Cards

**Responsibilities:**
- 4 feature cards in a 2x2 grid
- Each card has an icon, headline, and description
- Cards animate in with 3D perspective transforms on scroll
- Hover interaction: lift + shadow increase

**Animation pattern (Framer Motion + scroll):**
```tsx
import { motion, useInView } from 'framer-motion'

function FeatureCard({ icon, title, description, index }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40, rotateY: -5 }}
      animate={isInView ? { opacity: 1, y: 0, rotateY: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-card rounded-xl border border-border p-8 elevation-1 hover:border-primary/50 hover:elevation-2 transition-shadow"
      style={{ perspective: 1000 }}
    >
      {/* icon, title, description */}
    </motion.div>
  )
}
```

### 6.4 `InteractiveDemo.tsx` -- Live Demo Section

**Responsibilities:**
- Renders the portal-bordered demo area
- Contains a repo URL input and generate button
- Quick example pill buttons
- Preview area that shows a simplified wiki output
- Falls back to a static mockup if API is unavailable

**Key decision:** This component reuses the existing `parseRepositoryInput` logic from `page.tsx`. We should extract that function into a shared utility (`src/utils/repoParser.ts`) so both the main app and the demo can use it.

### 6.5 `ComparisonTable.tsx` -- Feature Matrix

**Responsibilities:**
- Renders the comparison table (us vs. closed-source tools)
- Responsive: table on desktop, cards on mobile
- Animated check marks with scale-pop
- Rows stagger in on scroll

### 6.6 `AnimatedCounter.tsx` -- Number Count-Up Utility

**Responsibilities:**
- Takes a target number and animates from 0 to target
- Triggers when scrolled into view
- Uses `requestAnimationFrame` for smooth counting
- Supports formatting (e.g., "1.2k" for 1200)

```tsx
function AnimatedCounter({ target, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (!isInView) return
    let start = 0
    const startTime = performance.now()

    function animate(currentTime) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [isInView, target, duration])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}
```

### 6.7 `RepoSearchInput.tsx` -- Shared Search Component

**Responsibilities:**
- Extracts the hero search input into a reusable component
- Used in both HeroSection and FinalCTA
- Props: `onSubmit`, `defaultValue`, `size` (large for hero, normal for final CTA)
- Includes the glowing border trail animation (adapted from Google CodeWiki's approach)

---

## 7. Performance & Accessibility

### 7.1 Performance Strategy

| Concern | Solution |
|---------|----------|
| Three.js bundle size (~150KB) | `dynamic(() => import(...), { ssr: false })` -- only loaded on client, only on landing page |
| 3D rendering on low-end devices | Detect GPU capability via `renderer.capabilities`. If `maxTextureSize < 4096`, skip 3D and show fallback |
| Mobile performance | Reduce particle count to 100 (from 300), lower `dpr` to `[1, 1.5]`, disable transmission material (use basic `MeshStandardMaterial`) |
| Scroll animations | GSAP ScrollTrigger uses `will-change: transform` and GPU-accelerated properties only. No layout-triggering animations |
| Initial page load | Hero content (headline, subtitle, search) renders immediately via SSR. 3D loads async in the background |
| Image optimization | All images via Next.js `<Image>` with `priority` for above-fold, lazy for below |
| Font loading | Already using `next/font/google` with `display: swap` -- no changes needed |

### 7.2 Mobile Strategy

```
Desktop (>1024px):  Full 3D cube + particles + all scroll animations
Tablet (768-1024):  3D cube (simplified material) + particles (fewer) + scroll animations
Mobile (<768px):    Static gradient hero (no 3D) + Framer Motion fade-ins only
```

**Mobile fallback for Hero3D:**
```tsx
function HeroFallback() {
  return (
    <div className="w-full h-[300px] flex items-center justify-center">
      <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-primary/20 to-cyan-500/20 border border-primary/30 animate-pulse" />
    </div>
  )
}
```

### 7.3 Accessibility

| Requirement | Implementation |
|-------------|---------------|
| `prefers-reduced-motion` | All animations check this media query. If true: no rotation, no particles, no scroll animations. Content still visible via instant render |
| Screen reader content | 3D canvas has `role="img"` and `aria-label="Animated 3D visualization of code transforming into documentation"` |
| Keyboard navigation | All interactive elements (buttons, inputs, links) are focusable and have visible focus rings (already in design system via `focus-visible:ring-2`) |
| Color contrast | All text meets WCAG AA. The comparison table's green/red checkmarks also have text labels ("Supported" / "Not available") for screen readers |
| Alt text | Any decorative images have `alt=""` and `aria-hidden="true"` |
| Skip navigation | Add a skip-to-content link (`<a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>`) |
| Content hierarchy | Proper heading levels (h1 in hero, h2 for sections, h3 for subsections) |

### 7.4 SEO Considerations

- Landing page renders headline, subtitle, and feature text via SSR (not client-only)
- 3D canvas is purely decorative and does not contain text content
- All section content is in the DOM (not rendered by canvas)
- Meta tags already defined in `layout.tsx` -- update to match new marketing copy
- Add structured data (JSON-LD) for SoftwareApplication schema

---

## 8. Implementation Timeline

### Phase 1: Foundation (Days 1-2)
- [ ] Install dependencies (`three`, `@react-three/fiber`, `@react-three/drei`, `gsap`, `@gsap/react`)
- [ ] Create `src/components/landing/` directory
- [ ] Extract `parseRepositoryInput` to `src/utils/repoParser.ts`
- [ ] Build `RepoSearchInput.tsx` (shared component)
- [ ] Build `Hero3D.tsx` and `KnowledgeCube.tsx` with basic rotation
- [ ] Set up lazy loading and mobile detection

### Phase 2: Hero & Navigation (Days 3-4)
- [ ] Build `HeroSection.tsx` with new copy
- [ ] Implement transparent-to-solid navbar transition
- [ ] Add mouse parallax to KnowledgeCube
- [ ] Add particle system (`ParticleField.tsx`)
- [ ] Build `AnimatedCounter.tsx` utility
- [ ] Style social proof badges with dynamic GitHub stars

### Phase 3: Content Sections (Days 5-7)
- [ ] Build `HowItWorks.tsx` with 3-step flow + connecting line animation
- [ ] Build `FeatureShowcase.tsx` with 3D perspective card entrances
- [ ] Build `ComparisonTable.tsx` with row stagger animation
- [ ] Build `CommunitySection.tsx` with count-up stats
- [ ] Build `FinalCTA.tsx` with bookend search input

### Phase 4: Interactive Demo (Days 8-9)
- [ ] Build `InteractiveDemo.tsx` shell with portal border effect
- [ ] Wire up to existing API for live wiki preview
- [ ] Add quick example buttons
- [ ] Build fallback static mockup
- [ ] Test with real repositories

### Phase 5: Polish & Integration (Days 10-12)
- [ ] Assemble all sections in `page.tsx`
- [ ] Implement scroll-linked cube-to-features transition (GSAP ScrollTrigger)
- [ ] Add `prefers-reduced-motion` support to all components
- [ ] Mobile testing and responsive fixes
- [ ] Performance profiling (Lighthouse, Web Vitals)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] SEO: Update meta tags, add JSON-LD structured data
- [ ] Accessibility audit (keyboard nav, screen reader, contrast)

### Phase 6: Launch (Day 13)
- [ ] Final review
- [ ] Deploy to staging
- [ ] A/B test against current landing page (if infrastructure exists)
- [ ] Ship to production

---

## Appendix A: Color Palette Reference

These are the existing CSS variables from `globals.css` that all new components should use:

```
Light Mode:
  --primary:    hsl(221 83% 53%)   -- #3b82f6 (blue)
  --foreground: hsl(222 47% 11%)   -- near-black
  --muted-fg:   hsl(215 16% 47%)   -- gray
  --background: hsl(0 0% 100%)     -- white
  --border:     hsl(214 32% 91%)   -- light gray
  --card:       hsl(0 0% 100%)     -- white

Dark Mode:
  --primary:    hsl(217 91% 60%)   -- #4a90d9 (lighter blue)
  --foreground: hsl(210 20% 98%)   -- near-white
  --muted-fg:   hsl(215 20% 65%)   -- light gray
  --background: hsl(224 71% 4%)    -- deep navy
  --border:     hsl(217 33% 17%)   -- dark gray
  --card:       hsl(224 50% 7%)    -- dark navy
```

**3D Scene Colors:**
- Cube material: `#4a90d9` (primary in dark mode context, since the 3D scene is always dark-themed)
- Edge glow: `#3b82f6` (primary blue)
- Particles: `#ffffff` at 15-30% opacity
- Ambient light: 0.4 intensity (warm neutral)
- Directional light: 0.8 intensity (cool white, from top-right)

---

## Appendix B: Existing page.tsx Refactoring Notes

The current `src/app/page.tsx` (660 lines) combines:
1. Landing page UI (hero, search, badges, quick start, diagrams)
2. Repository parsing logic
3. Configuration state management
4. Auth state management
5. Navigation logic

**Refactoring plan:**
1. Extract `parseRepositoryInput` to `src/utils/repoParser.ts`
2. Extract configuration state management to a custom hook: `src/hooks/useRepoConfig.ts`
3. Extract auth logic to a custom hook: `src/hooks/useAuth.ts`
4. The new `page.tsx` becomes a thin shell that imports landing page sections and the `ConfigurationModal`
5. All existing functionality is preserved; only the visual layout changes

**Critical: The `ConfigurationModal` component and its props stay exactly as-is.** The modal flow (paste URL -> click Generate -> configure in modal -> navigate) remains unchanged. Only the surrounding landing page chrome changes.

---

## Appendix C: Dependency on Existing Components

The landing page reuses these existing components:
- `ConfigurationModal` -- Modal for wiki generation options (no changes needed)
- `Mermaid` -- For rendering diagram examples in the "How It Works" section (already exists)
- `ProcessedProjects` -- For showing existing wikis (keep as-is, displayed conditionally)
- `ThemeToggle` -- In the navbar (no changes needed)

The landing page does NOT touch:
- `src/app/[owner]/[repo]/page.tsx` -- The wiki viewing page
- `src/app/wiki/projects/page.tsx` -- The projects listing page
- Any API routes
- Any backend logic
