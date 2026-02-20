import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
// We'll use dynamic import for svg-pan-zoom

// Calming color palettes for diagrams — enhanced with multi-color node palette
const LIGHT_THEME = {
  darkMode: false,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  // Primary nodes — soft blue
  primaryColor: '#dbeafe',
  primaryTextColor: '#1e293b',
  primaryBorderColor: '#3b82f6',
  // Lines & arrows — strong slate for clear visibility
  lineColor: '#475569',
  // Secondary — soft green for visual grouping
  secondaryColor: '#f0fdf4',
  secondaryTextColor: '#1e293b',
  secondaryBorderColor: '#22c55e',
  // Tertiary — warm amber for variety
  tertiaryColor: '#fef3c7',
  tertiaryTextColor: '#1e293b',
  tertiaryBorderColor: '#f59e0b',
  // Background & text
  background: '#ffffff',
  mainBkg: '#dbeafe',
  nodeBorder: '#3b82f6',
  clusterBkg: '#f8fafc',
  clusterBorder: '#cbd5e1',
  titleColor: '#1e293b',
  edgeLabelBackground: '#ffffff',
  // Note styling — warm amber, clearly distinct
  noteBkgColor: '#fef3c7',
  noteTextColor: '#92400e',
  noteBorderColor: '#f59e0b',
  // Sequence diagram
  actorBkg: '#dbeafe',
  actorBorder: '#3b82f6',
  actorTextColor: '#1e293b',
  actorLineColor: '#475569',
  signalColor: '#475569',
  signalTextColor: '#1e293b',
  labelBoxBkgColor: '#f8fafc',
  labelBoxBorderColor: '#cbd5e1',
  labelTextColor: '#1e293b',
  loopTextColor: '#475569',
  activationBorderColor: '#3b82f6',
  activationBkgColor: '#dbeafe',
  sequenceNumberColor: '#ffffff',
};

const DARK_THEME = {
  darkMode: true,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  // Primary nodes — deep blue with bright border
  primaryColor: '#1e3a5f',
  primaryTextColor: '#f1f5f9',
  primaryBorderColor: '#60a5fa',
  // Lines & arrows — clearly visible slate
  lineColor: '#94a3b8',
  // Secondary — deep green for visual grouping
  secondaryColor: '#14532d',
  secondaryTextColor: '#f1f5f9',
  secondaryBorderColor: '#4ade80',
  // Tertiary — deep amber for variety
  tertiaryColor: '#451a03',
  tertiaryTextColor: '#f1f5f9',
  tertiaryBorderColor: '#fbbf24',
  // Background & text
  background: '#0a0f1a',
  mainBkg: '#1e3a5f',
  nodeBorder: '#60a5fa',
  clusterBkg: '#0f172a',
  clusterBorder: '#334155',
  titleColor: '#f1f5f9',
  edgeLabelBackground: '#0f172a',
  // Note styling — warm amber, clearly distinct
  noteBkgColor: '#451a03',
  noteTextColor: '#fbbf24',
  noteBorderColor: '#fbbf24',
  // Sequence diagram
  actorBkg: '#1e3a5f',
  actorBorder: '#60a5fa',
  actorTextColor: '#f1f5f9',
  actorLineColor: '#94a3b8',
  signalColor: '#94a3b8',
  signalTextColor: '#f1f5f9',
  labelBoxBkgColor: '#0f172a',
  labelBoxBorderColor: '#334155',
  labelTextColor: '#f1f5f9',
  loopTextColor: '#94a3b8',
  activationBorderColor: '#60a5fa',
  activationBkgColor: '#1e3a5f',
  sequenceNumberColor: '#f1f5f9',
};

function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

function initializeMermaid(dark: boolean) {
  const vars = dark ? DARK_THEME : LIGHT_THEME;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    suppressErrorRendering: true,
    logLevel: 'error',
    maxTextSize: 100000,
    htmlLabels: true,
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
      nodeSpacing: 50,
      rankSpacing: 50,
      padding: 15,
    },
    themeVariables: vars,
    themeCSS: `
      /* ============================================================
         Flow animation keyframes — makes arrow direction obvious
         ============================================================ */
      @keyframes mermaid-flow {
        from { stroke-dashoffset: 24; }
        to { stroke-dashoffset: 0; }
      }

      /* ============================================================
         Global text — readable, high-contrast, semi-bold
         ============================================================ */
      text, .label, span {
        font-family: system-ui, -apple-system, sans-serif !important;
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        color: ${dark ? '#f1f5f9' : '#1e293b'} !important;
      }

      /* Node text — larger, bolder for readability */
      .node text, .nodeLabel, .node .label {
        font-size: 14px !important;
        font-weight: 600 !important;
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        color: ${dark ? '#f1f5f9' : '#1e293b'} !important;
      }

      /* ============================================================
         Multi-color node palette — visual hierarchy via color
         ============================================================ */

      /* Primary nodes (default) — blue */
      .node rect, .node circle, .node ellipse, .node polygon, .node path {
        fill: ${dark ? '#1e3a5f' : '#dbeafe'} !important;
        stroke: ${dark ? '#60a5fa' : '#3b82f6'} !important;
        stroke-width: 2px !important;
        rx: 8;
        ry: 8;
      }
      .node.default > rect, .node.default > circle, .node.default > polygon {
        fill: ${dark ? '#1e3a5f' : '#dbeafe'} !important;
        stroke: ${dark ? '#60a5fa' : '#3b82f6'} !important;
      }

      /* Secondary nodes (2nd group) — green */
      .node:nth-child(4n+2) > rect,
      .node:nth-child(4n+2) > circle,
      .node:nth-child(4n+2) > polygon,
      .node:nth-child(4n+2) > ellipse {
        fill: ${dark ? '#14532d' : '#f0fdf4'} !important;
        stroke: ${dark ? '#4ade80' : '#22c55e'} !important;
      }

      /* Tertiary nodes (3rd group) — amber */
      .node:nth-child(4n+3) > rect,
      .node:nth-child(4n+3) > circle,
      .node:nth-child(4n+3) > polygon,
      .node:nth-child(4n+3) > ellipse {
        fill: ${dark ? '#451a03' : '#fef3c7'} !important;
        stroke: ${dark ? '#fbbf24' : '#f59e0b'} !important;
      }

      /* Quaternary nodes (4th group) — fuchsia */
      .node:nth-child(4n+4) > rect,
      .node:nth-child(4n+4) > circle,
      .node:nth-child(4n+4) > polygon,
      .node:nth-child(4n+4) > ellipse {
        fill: ${dark ? '#4a044e' : '#fae8ff'} !important;
        stroke: ${dark ? '#e879f9' : '#d946ef'} !important;
      }

      /* Decision / diamond nodes — rose */
      .node polygon.label-container,
      .node.rhombus > polygon,
      .node .decision {
        fill: ${dark ? '#4c0519' : '#fff1f2'} !important;
        stroke: ${dark ? '#fb7185' : '#f43f5e'} !important;
      }

      /* Node padding — prevent cramped text */
      .node foreignObject {
        overflow: visible;
      }
      .nodeLabel {
        padding: 8px 12px !important;
      }

      /* ============================================================
         Bolder arrows with flow animation
         ============================================================ */
      .edgePath .path, .flowchart-link {
        stroke: ${dark ? '#94a3b8' : '#475569'} !important;
        stroke-width: 2.5px !important;
        stroke-dasharray: 8 4 !important;
        animation: mermaid-flow 2s linear infinite !important;
      }

      /* Larger, more visible arrowheads */
      marker {
        overflow: visible !important;
      }
      marker path {
        fill: ${dark ? '#94a3b8' : '#475569'} !important;
        stroke: ${dark ? '#94a3b8' : '#475569'} !important;
        stroke-width: 1px !important;
      }
      .arrowheadPath {
        fill: ${dark ? '#94a3b8' : '#475569'} !important;
        stroke: ${dark ? '#94a3b8' : '#475569'} !important;
      }
      marker[id*="arrowhead"],
      marker[id*="crosshead"],
      marker[id*="point"] {
        transform: scale(1.2) !important;
      }

      /* ============================================================
         Edge labels — pill background so text doesn't overlap edges
         ============================================================ */
      .edgeLabel {
        background-color: ${dark ? '#0f172a' : '#ffffff'} !important;
        color: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-size: 13px !important;
        font-weight: 500 !important;
      }
      .edgeLabel rect {
        fill: ${dark ? '#0f172a' : '#ffffff'} !important;
        opacity: 0.92 !important;
        rx: 6 !important;
        ry: 6 !important;
        stroke: ${dark ? '#334155' : '#e2e8f0'} !important;
        stroke-width: 1px !important;
      }
      .edgeLabel span, .edgeLabel p {
        background-color: ${dark ? '#0f172a' : '#ffffff'} !important;
        color: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
      }

      /* ============================================================
         Cluster / subgraph backgrounds — subtle tint, clearly bounded
         ============================================================ */
      .cluster rect {
        fill: ${dark ? '#0f172a' : '#f8fafc'} !important;
        stroke: ${dark ? '#334155' : '#cbd5e1'} !important;
        stroke-width: 1.5px !important;
        rx: 8 !important;
        ry: 8 !important;
      }
      .cluster text, .cluster span {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-weight: 600 !important;
      }

      /* ============================================================
         Sequence diagram — enhanced actors, lifelines, messages
         ============================================================ */

      /* Actor boxes — taller, rounded, filled */
      .actor {
        fill: ${dark ? '#1e3a5f' : '#dbeafe'} !important;
        stroke: ${dark ? '#60a5fa' : '#3b82f6'} !important;
        stroke-width: 2px !important;
        rx: 8 !important;
        ry: 8 !important;
      }

      /* Actor text — bold, larger */
      text.actor > tspan {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-weight: 700 !important;
        font-size: 14px !important;
      }

      /* Lifelines — dashed, clearly visible */
      .actor-line {
        stroke: ${dark ? '#94a3b8' : '#475569'} !important;
        stroke-dasharray: 5,5 !important;
        stroke-width: 1.5px !important;
      }

      /* Message lines — 2px width, clear arrowheads */
      .messageLine0, .messageLine1 {
        stroke: ${dark ? '#94a3b8' : '#475569'} !important;
        stroke-width: 2px !important;
      }

      /* Message text — slightly larger, positioned clearly */
      .messageText {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        stroke: none !important;
        font-size: 13px !important;
        font-weight: 500 !important;
      }

      /* Activation bars — distinct fill color */
      .activation0, .activation1, .activation2 {
        fill: ${dark ? '#2d4a6f' : '#bfdbfe'} !important;
        stroke: ${dark ? '#60a5fa' : '#3b82f6'} !important;
        stroke-width: 1.5px !important;
      }

      /* Notes — warm amber background, clearly distinct from actors */
      .note {
        fill: ${dark ? '#451a03' : '#fef3c7'} !important;
        stroke: ${dark ? '#fbbf24' : '#f59e0b'} !important;
        stroke-width: 1.5px !important;
        rx: 6 !important;
        ry: 6 !important;
      }
      .noteText {
        fill: ${dark ? '#fbbf24' : '#92400e'} !important;
        font-size: 12px !important;
      }

      /* Loop boxes in sequence diagrams */
      .loopText, .loopText > tspan {
        fill: ${dark ? '#94a3b8' : '#475569'} !important;
        font-weight: 600 !important;
      }
      .loopLine {
        stroke: ${dark ? '#334155' : '#cbd5e1'} !important;
        stroke-width: 1.5px !important;
      }

      /* ============================================================
         Flowchart-specific enhancements
         ============================================================ */

      /* Node shapes — rounded rectangles for softer appearance */
      .flowchart-link {
        stroke-linecap: round !important;
      }

      /* Start/end nodes — distinct pill shape, stronger color */
      .node.start > rect, .node.stop > rect,
      .start-node > rect, .end-node > rect {
        fill: ${dark ? '#1e3a5f' : '#3b82f6'} !important;
        stroke: ${dark ? '#60a5fa' : '#2563eb'} !important;
        rx: 20 !important;
        ry: 20 !important;
      }
      .node.start text, .node.stop text,
      .start-node text, .end-node text {
        fill: #ffffff !important;
      }

      /* ============================================================
         Class diagram — header section styling
         ============================================================ */
      g.classGroup rect {
        fill: ${dark ? '#1e3a5f' : '#dbeafe'} !important;
        stroke: ${dark ? '#60a5fa' : '#3b82f6'} !important;
        stroke-width: 2px !important;
        rx: 6 !important;
        ry: 6 !important;
      }
      g.classGroup text, g.classGroup text tspan {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-size: 13px !important;
      }
      g.classGroup line {
        stroke: ${dark ? '#60a5fa' : '#3b82f6'} !important;
        stroke-width: 1.5px !important;
      }
      /* Class title (header) */
      g.classGroup .classTitle {
        font-weight: 700 !important;
        font-size: 15px !important;
      }

      /* Class diagram relationships */
      .relation {
        stroke: ${dark ? '#94a3b8' : '#475569'} !important;
        stroke-width: 2px !important;
      }
      .cardinality text, .relationship text {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-size: 12px !important;
        font-weight: 600 !important;
      }

      /* ============================================================
         State diagram — rounded nodes, clear transitions
         ============================================================ */
      g.stateGroup rect {
        fill: ${dark ? '#1e3a5f' : '#dbeafe'} !important;
        stroke: ${dark ? '#60a5fa' : '#3b82f6'} !important;
        stroke-width: 2px !important;
        rx: 10 !important;
        ry: 10 !important;
      }
      g.stateGroup text {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-size: 13px !important;
        font-weight: 600 !important;
      }
      /* State transitions */
      .transition {
        stroke: ${dark ? '#94a3b8' : '#475569'} !important;
        stroke-width: 2px !important;
      }
      /* Start/end state markers */
      .start-state-icon circle,
      .end-state-outer circle {
        fill: ${dark ? '#60a5fa' : '#3b82f6'} !important;
        stroke: ${dark ? '#60a5fa' : '#3b82f6'} !important;
      }
      .end-state-inner circle {
        fill: ${dark ? '#0f172a' : '#ffffff'} !important;
      }

      /* ============================================================
         ER diagram — entity boxes with relationship labels
         ============================================================ */
      .entityBox {
        fill: ${dark ? '#1e3a5f' : '#dbeafe'} !important;
        stroke: ${dark ? '#60a5fa' : '#3b82f6'} !important;
        stroke-width: 2px !important;
        rx: 6 !important;
        ry: 6 !important;
      }
      .entityLabel {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-size: 14px !important;
        font-weight: 600 !important;
      }
      .relationshipLine {
        stroke: ${dark ? '#94a3b8' : '#475569'} !important;
        stroke-width: 2px !important;
      }
      .relationshipLabel {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-size: 12px !important;
        font-weight: 600 !important;
      }
      /* ER attribute labels */
      .attributeBoxOdd, .attributeBoxEven {
        fill: ${dark ? '#14532d' : '#f0fdf4'} !important;
        stroke: ${dark ? '#4ade80' : '#22c55e'} !important;
      }

      /* ============================================================
         Pie chart
         ============================================================ */
      .pieTitleText {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-weight: 600 !important;
      }
      .slice {
        stroke: ${dark ? '#0a0f1a' : '#ffffff'} !important;
        stroke-width: 2px !important;
      }

      /* ============================================================
         Gantt chart
         ============================================================ */
      .taskText, .taskTextOutsideRight, .taskTextOutsideLeft {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-weight: 500 !important;
      }
      .sectionTitle {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-weight: 600 !important;
      }
      .grid .tick line {
        stroke: ${dark ? '#334155' : '#e2e8f0'} !important;
      }
      .grid path {
        stroke: ${dark ? '#334155' : '#e2e8f0'} !important;
      }

      /* ============================================================
         Git graph
         ============================================================ */
      .commit-label {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-weight: 500 !important;
      }
      .branch-label {
        fill: ${dark ? '#f1f5f9' : '#1e293b'} !important;
        font-weight: 600 !important;
      }
    `,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 14,
  });
}

// Initialize with current theme
initializeMermaid(isDarkMode());

interface MermaidProps {
  chart: string;
  className?: string;
  zoomingEnabled?: boolean;
}

// Full screen modal component for the diagram
const FullScreenModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ isOpen, onClose, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Handle click outside to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  // Reset zoom when modal opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className="bg-card border border-border rounded-lg shadow-lg max-w-5xl max-h-[90vh] w-full overflow-hidden flex flex-col"
      >
        {/* Modal header with controls */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <div className="font-semibold text-foreground">Diagram View</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                className="text-foreground hover:bg-accent hover:text-accent-foreground p-2 rounded-md border border-input transition-colors bg-background"
                aria-label="Zoom out"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <span className="text-sm text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                className="text-foreground hover:bg-accent hover:text-accent-foreground p-2 rounded-md border border-input transition-colors bg-background"
                aria-label="Zoom in"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <button
                onClick={() => setZoom(1)}
                className="text-foreground hover:bg-accent hover:text-accent-foreground p-2 rounded-md border border-input transition-colors bg-background"
                aria-label="Reset zoom"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                  <path d="M21 3v5h-5"></path>
                </svg>
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-accent p-2 rounded-md transition-colors"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Modal content with zoom */}
        <div className="overflow-auto p-6 flex-1 flex items-center justify-center bg-muted/20">
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              transition: 'transform 0.3s ease-out'
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const Mermaid: React.FC<MermaidProps> = ({ chart, className = '', zoomingEnabled = false }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [themeKey, setThemeKey] = useState(0); // forces re-render on theme change
  const mermaidRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).substring(2, 9)}`);

  // Watch for theme changes (next-themes adds/removes .dark on <html>)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const dark = isDarkMode();
      initializeMermaid(dark);
      // Generate a new unique ID for re-render (mermaid caches by ID)
      idRef.current = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
      setThemeKey(k => k + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Initialize pan-zoom functionality when SVG is rendered
  useEffect(() => {
    if (svg && zoomingEnabled && containerRef.current) {
      const initializePanZoom = async () => {
        const svgElement = containerRef.current?.querySelector("svg");
        if (svgElement) {
          // Remove any max-width constraints
          svgElement.style.maxWidth = "none";
          svgElement.style.width = "100%";
          svgElement.style.height = "100%";

          try {
            // Dynamically import svg-pan-zoom only when needed in the browser
            const svgPanZoom = (await import("svg-pan-zoom")).default;

            svgPanZoom(svgElement, {
              zoomEnabled: true,
              controlIconsEnabled: true,
              fit: true,
              center: true,
              minZoom: 0.1,
              maxZoom: 10,
              zoomScaleSensitivity: 0.3,
            });
          } catch (error) {
            console.error("Failed to load svg-pan-zoom:", error);
          }
        }
      };

      // Wait for the SVG to be rendered
      setTimeout(() => {
        void initializePanZoom();
      }, 100);
    }
  }, [svg, zoomingEnabled]);

  const renderChart = useCallback(async (isMountedRef: { current: boolean }) => {
    if (!chart || !isMountedRef.current) return;

    try {
      setError(null);
      setSvg('');

      const { svg: renderedSvg } = await mermaid.render(idRef.current, chart);

      if (!isMountedRef.current) return;

      setSvg(renderedSvg);
    } catch (err) {
      console.error('Mermaid rendering error:', err);

      const errorMessage = err instanceof Error ? err.message : String(err);

      if (isMountedRef.current) {
        setError(`Failed to render diagram: ${errorMessage}`);

        if (mermaidRef.current) {
          mermaidRef.current.innerHTML = `
            <div class="text-destructive text-xs mb-1 font-medium">Syntax error in diagram</div>
            <pre class="text-xs overflow-auto p-2 bg-muted rounded border border-border font-mono">${chart}</pre>
          `;
        }
      }
    }
  }, [chart]);

  useEffect(() => {
    const isMountedRef = { current: true };
    renderChart(isMountedRef);
    return () => { isMountedRef.current = false; };
  }, [chart, themeKey, renderChart]);

  const handleDiagramClick = () => {
    if (!error && svg) {
      setIsFullscreen(true);
    }
  };

  if (error) {
    return (
      <div className={`border border-destructive/30 rounded-md p-4 bg-destructive/5 ${className}`}>
        <div className="flex items-center mb-3">
          <div className="text-destructive text-sm font-medium flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Diagram Rendering Error
          </div>
        </div>
        <div ref={mermaidRef} className="text-xs overflow-auto"></div>
        <div className="mt-3 text-xs text-muted-foreground">
          There is a syntax error in the diagram, it cannot be rendered.
        </div>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={`flex justify-center items-center p-4 bg-muted/10 rounded-lg border border-border/50 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary/70 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-primary/70 rounded-full animate-pulse delay-75"></div>
          <div className="w-2 h-2 bg-primary/70 rounded-full animate-pulse delay-150"></div>
          <span className="text-muted-foreground text-xs ml-2 font-medium">Rendering diagram...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className={`w-full max-w-full ${zoomingEnabled ? "h-[600px] p-4" : ""}`}
      >
        <div
          className={`relative group ${zoomingEnabled ? "h-full rounded-lg border-2 border-border" : ""}`}
        >
          <div
            className={`flex justify-center overflow-auto text-center my-4 cursor-pointer hover:bg-muted/10 rounded-md transition-colors ${className} ${zoomingEnabled ? "h-full" : ""}`}
            dangerouslySetInnerHTML={{ __html: svg }}
            onClick={zoomingEnabled ? undefined : handleDiagramClick}
            title={zoomingEnabled ? undefined : "Click to view fullscreen"}
          />

          {!zoomingEnabled && (
            <div className="absolute top-2 right-2 bg-popover/80 backdrop-blur text-popover-foreground p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 text-xs shadow-md border border-border pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
              <span>Click to zoom</span>
            </div>
          )}
        </div>
      </div>

      {!zoomingEnabled && (
        <FullScreenModal
          isOpen={isFullscreen}
          onClose={() => setIsFullscreen(false)}
        >
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        </FullScreenModal>
      )}
    </>
  );
};

export default Mermaid;