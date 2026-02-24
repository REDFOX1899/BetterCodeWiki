# BetterCodeWiki - UX Research Findings & Implementation Guide

## Executive Summary

A comprehensive UX audit of BetterCodeWiki has identified **15 issues** preventing new users from finding the app intuitive. The good news: **the platform is well-architected**—the issues are UX-related (discoverability, progressive disclosure), not fundamental design flaws.

**Root Cause**: Features and content presented all at once without guidance or progressive disclosure.

**Solution**: Add onboarding, make features discoverable, implement progressive disclosure.

**Estimated Implementation Time**: 13 hours across 3 phases

---

## Quick Reference: Issues by Severity

### 🔴 Critical Issues (Block User Adoption) - 5 Issues

| # | Issue | Impact | Effort | File |
|---|-------|--------|--------|------|
| 1 | Diagram complexity without simplify toggle | Users overwhelmed on first diagrams | 1hr | `src/components/Mermaid.tsx` |
| 2 | Blank wiki page on first load | Users confused, don't know where to start | 1hr | `src/app/[owner]/[repo]/page.tsx` |
| 3 | Navigation features hidden (Search, Graph, TOC) | Users miss powerful features | 1.5hrs | Multiple files |
| 4 | Configuration modal overwhelming | Too many options at once | 2hrs | `src/components/ConfigurationModal.tsx` |
| 5 | Diagram click-to-explain undiscovered | Feature exists but users don't know | 0.5hr | `src/components/Mermaid.tsx` |

### 🟠 Major Issues (Hurt Usability) - 5 Issues
- Issue #6: Search completely hidden
- Issue #7: Table of Contents missing on small screens
- Issue #8: Sidebar text truncation without tooltips
- Issue #9: No visual hierarchy between features
- Issue #10: Mobile layout cramped

### 🟡 Moderate Issues (Polish) - 5 Issues
- Issue #11: Freshness indicator too subtle
- Issue #12: Error messages lack guidance
- Issue #13: Loading states generic
- Issue #14: No first-time user onboarding
- Issue #15: No diagram color legend

---

## Detailed Issue Breakdown

### Issue #1: Diagram Complexity Without Progressive Disclosure

**The Problem**:
Users see overwhelming 20+ node diagrams with 4-color palette and no way to simplify.

**Why It Happens**:
- Mermaid.tsx renders all nodes with full detail by default
- No UI toggle for simplified vs detailed view
- AI generation prompt creates comprehensive diagrams

**The Fix**:
1. Add `[Simplify/Details]` toggle button next to expand button
2. When simplified: hide non-critical nodes, use single color
3. When detailed: show everything with color palette

**File & Lines**: `src/components/Mermaid.tsx` lines 1228-1238

**Code Example**:
```tsx
<button
  onClick={() => setSimplifyMode(!simplifyMode)}
  className="..."
  title={simplifyMode ? "Show details" : "Simplify"}
>
  {simplifyMode ? "Details" : "Simple"}
</button>
```

**User Impact**: Immediate relief when seeing first diagram

---

### Issue #2: Blank Wiki Page on First Load

**The Problem**:
New user arrives at wiki → sees "Select a page" placeholder → has no idea what to do

**Current Code**:
```tsx
<div className="flex flex-col items-center justify-center h-full text-muted-foreground">
  <div className="p-4 bg-muted/30 rounded-full mb-4">
    <BookOpen size={30} className="opacity-50" />
  </div>
  <p className="text-lg font-medium text-foreground">Select a page</p>
  <p className="text-sm">Choose a page from the sidebar to view its content</p>
</div>
```

**The Fix**:
1. Auto-select first "introduction" or "overview" page on load
2. Show onboarding cards suggesting next reading
3. Display "pro tip" about search feature

**File & Lines**: `src/app/[owner]/[repo]/page.tsx` lines 322-332 (handlePageSelect)

**User Impact**: Page immediately displays content with guidance

---

### Issue #3: Navigation Features Are Hidden

**The Problem**:
- Search only discoverable via Cmd+K (no visible button)
- Graph button is tiny and easy to miss
- Table of Contents only visible on XL screens (1280px+)

**The Fix**:
```
Toolbar Changes:
- Add visible [🔍 Search] button with ⌘K hint
- Make [Graph] button more prominent
- Add [≡ On Page] TOC toggle for smaller screens
```

**Files**:
- `src/app/[owner]/[repo]/page.tsx` lines 364-396
- `src/components/TableOfContents.tsx` line 716

**User Impact**: Users discover features naturally without memorizing shortcuts

---

### Issue #4: Configuration Modal Overwhelming

**The Problem**:
User sees 15+ options at once: language, template, provider, model, auth code, file filters, etc.

**The Fix**:
Split into two tabs:
- **Basic**: Language, Template, Recommended Model
- **Advanced**: File filters, Custom model, Auth code

**File**: `src/components/ConfigurationModal.tsx` (entire 26KB component)

**User Impact**: Beginners see only essential options; advanced users find what they need

---

### Issue #5: Diagram Click-to-Explain Feature Undiscovered

**The Problem**:
Clicking diagram nodes opens an AI explanation panel, but users don't know it's possible. No tooltip. No visual indicator.

**The Fix**:
1. Add tooltip on first diagram load: "💡 Click any node for explanation"
2. Add pulsing border animation to first node
3. Show sample explanation inline

**File**: `src/components/Mermaid.tsx` lines 1171-1206

**Code Example**:
```tsx
{showNodeHint && !hintDismissed && (
  <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
    <div className="bg-card border border-border rounded-lg p-4 pointer-events-auto">
      <p className="text-sm font-semibold">💡 Tip: Click any node for more details</p>
      <button onClick={() => setHintDismissed(true)}>Got it</button>
    </div>
  </div>
)}
```

**User Impact**: Users discover and use the explanation feature naturally

---

## Implementation Phases

### Phase 1: Quick Wins (3 hours) - Highest Impact
✅ Auto-select first page
✅ Add visible search button
✅ Add diagram simplify toggle
✅ Add node click tooltip
✅ Fix sidebar text truncation

**When to do**: Start here immediately

### Phase 2: Medium Effort (6 hours)
✅ Restructure ConfigurationModal (Basic/Advanced tabs)
✅ Make Table of Contents responsive (collapsible on MD screens)
✅ Add first-time user onboarding
✅ Improve error messages

**When to do**: After Phase 1 is validated

### Phase 3: Polish & Performance (4 hours)
✅ Mobile Ask AI drawer (bottom-sheet instead of side)
✅ Diagram color legend
✅ Loading states with progress
✅ Wiki freshness indicator prominence

**When to do**: Final refinements

---

## Key Files to Modify

| File | Lines | Purpose | Phase |
|------|-------|---------|-------|
| `src/app/[owner]/[repo]/page.tsx` | 322-732 | Auto-select, toolbar, layout | 1-2 |
| `src/components/Mermaid.tsx` | 1171-1240 | Simplify toggle, tooltip | 1 |
| `src/components/ConfigurationModal.tsx` | 1-800 | Tab interface | 2 |
| `src/components/WikiTreeView.tsx` | 200-360 | Search visibility | 1 |
| `src/components/TableOfContents.tsx` | 716 | Responsive breakpoints | 2 |

## Components to Create

1. `OnboardingTour.tsx` - First-time user guide (1.5hrs)
2. `DiagramLegend.tsx` - Color/shape legend (0.5hr)
3. Responsive Ask drawer (mobile bottom-sheet) (2hrs)

---

## Testing Checklist

After each implementation:
- [ ] Works on mobile (375px), tablet (768px), desktop (1280px+)
- [ ] Keyboard navigation still works (Cmd+K, Alt+R, etc.)
- [ ] No console errors
- [ ] Theme toggle works (light/dark mode)
- [ ] ARIA labels present (accessibility)
- [ ] LocalStorage state persists
- [ ] Smooth animations (60fps)
- [ ] Responsive images/diagrams

---

## Success Metrics

**Before Implementation**:
- New users report: "I don't know where to start"
- Diagram feature reports: "Too complex"
- Feature discovery: "How do I search?"

**After Implementation**:
- New users: Auto-selected page provides immediate context
- Diagrams: Toggle between simple/detailed based on needs
- Features: Visible buttons + helpful tooltips guide exploration

---

## Additional Resources

### In This Repository:
- `/UX_RESEARCH_FINDINGS.md` (this file)
- `/.claude/memory/README.md` - Research documentation index
- `/.claude/memory/ux-improvements-detailed.md` - Code examples & snippets
- `/.claude/memory/ux-mockup-descriptions.md` - Visual specifications

### Implementation Checklist:
Use this file as your checklist. Check off each issue as you implement:
- [ ] Issue #1: Diagram simplify toggle
- [ ] Issue #2: Auto-select first page
- [ ] Issue #3: Visible search + graph + TOC
- [ ] Issue #4: ConfigModal tabs
- [ ] Issue #5: Node click tooltip
- [ ] Issues #6-10: Major UX fixes
- [ ] Issues #11-15: Polish improvements

---

## Questions or Issues?

Refer to the detailed implementation guides in `/.claude/memory/` for:
- Exact line numbers and code locations
- Complete code examples
- Visual mockups and specifications
- Performance optimization suggestions

---

**Generated**: February 24, 2026
**Research Team**: ux-researcher, diagram-researcher, perf-researcher
**Status**: Ready for implementation phase
