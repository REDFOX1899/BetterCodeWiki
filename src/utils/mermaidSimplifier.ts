import type { DiagramData } from '@/types/diagramData';

/**
 * Simplify a mermaid diagram source for the "Simple" view mode.
 *
 * When DiagramData is available (structured nodes/edges with depth info),
 * we rebuild a simplified flowchart showing only top-level nodes (depth 0-1).
 *
 * When only raw mermaid source is available, we apply heuristic simplification:
 * - For flowcharts: keep first N nodes, remove subgraph internals
 * - For sequence diagrams: keep main actors and primary messages
 * - For class diagrams: show class names without members
 *
 * Always returns valid mermaid source — falls back to original on error.
 */

const MAX_SIMPLE_NODES = 8;

/**
 * Build a simplified mermaid flowchart from structured DiagramData.
 * Keeps only nodes with depth <= 1 and edges between them.
 */
function simplifyFromDiagramData(data: DiagramData): string {
  const topNodes = data.nodes.filter(n => n.depth <= 1);
  if (topNodes.length === 0) return data.mermaidSource;

  const topNodeIds = new Set(topNodes.map(n => n.id));
  const topEdges = data.edges.filter(
    e => topNodeIds.has(e.source) && topNodeIds.has(e.target)
  );

  // Build a flowchart
  const lines: string[] = ['flowchart TD'];

  for (const node of topNodes) {
    // Shorten labels: take first ~40 chars
    const shortLabel = node.label.length > 40
      ? node.label.slice(0, 37) + '...'
      : node.label;
    // Sanitize ID for mermaid (remove special chars)
    const safeId = node.id.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push(`    ${safeId}["${shortLabel}"]`);
  }

  for (const edge of topEdges) {
    const safeSource = edge.source.replace(/[^a-zA-Z0-9_]/g, '_');
    const safeTarget = edge.target.replace(/[^a-zA-Z0-9_]/g, '_');
    if (edge.label) {
      const shortEdgeLabel = edge.label.length > 30
        ? edge.label.slice(0, 27) + '...'
        : edge.label;
      lines.push(`    ${safeSource} -->|"${shortEdgeLabel}"| ${safeTarget}`);
    } else {
      lines.push(`    ${safeSource} --> ${safeTarget}`);
    }
  }

  return lines.join('\n');
}

/**
 * Detect the diagram type from raw mermaid source.
 */
function detectDiagramType(source: string): string {
  const firstLine = source.trim().split('\n')[0].trim().toLowerCase();
  if (firstLine.startsWith('sequencediagram') || firstLine.startsWith('sequence')) return 'sequence';
  if (firstLine.startsWith('classdiagram') || firstLine.startsWith('class')) return 'class';
  if (firstLine.startsWith('erdiagram') || firstLine.startsWith('er')) return 'er';
  if (firstLine.startsWith('statediagram') || firstLine.startsWith('state')) return 'state';
  if (firstLine.startsWith('gantt')) return 'gantt';
  if (firstLine.startsWith('pie')) return 'pie';
  if (firstLine.startsWith('gitgraph') || firstLine.startsWith('git')) return 'git';
  return 'flowchart';
}

/**
 * Simplify a raw flowchart by extracting top-level node definitions and edges,
 * skipping subgraph internals.
 */
function simplifyFlowchart(source: string): string {
  const lines = source.split('\n');
  const header = lines[0]; // e.g. "flowchart TD" or "graph LR"

  // Collect node definitions and edges outside of subgraphs
  const nodeDefPattern = /^\s*([a-zA-Z0-9_]+)\s*[\[({]/;
  const edgePattern = /^\s*([a-zA-Z0-9_]+)\s*(-->|--\>|-.->|==>|--)/;
  const subgraphStart = /^\s*subgraph\b/i;
  const subgraphEnd = /^\s*end\b/i;

  let subgraphDepth = 0;
  const topNodes = new Set<string>();
  const topEdges: string[] = [];
  const nodeLabels = new Map<string, string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (subgraphStart.test(trimmed)) {
      subgraphDepth++;
      continue;
    }
    if (subgraphEnd.test(trimmed)) {
      if (subgraphDepth > 0) subgraphDepth--;
      continue;
    }

    // Only process top-level lines
    if (subgraphDepth > 0) continue;

    // Node definition
    const nodeDef = nodeDefPattern.exec(trimmed);
    if (nodeDef) {
      const nodeId = nodeDef[1];
      topNodes.add(nodeId);

      // Extract label from brackets
      const labelMatch = trimmed.match(/[\[({]["']?([^"'\])}]+)["']?[\])}]/);
      if (labelMatch) {
        const label = labelMatch[1].length > 40
          ? labelMatch[1].slice(0, 37) + '...'
          : labelMatch[1];
        nodeLabels.set(nodeId, label);
      }
    }

    // Edge
    const edgeMatch = edgePattern.exec(trimmed);
    if (edgeMatch) {
      topEdges.push(trimmed);
      topNodes.add(edgeMatch[1]);
      // Extract target from after the arrow
      const afterArrow = trimmed.replace(/^\s*[a-zA-Z0-9_]+\s*(?:-->|--\>|-.->|==>|--\s)/, '');
      const targetMatch = afterArrow.match(/\|[^|]*\|\s*([a-zA-Z0-9_]+)|^\s*([a-zA-Z0-9_]+)/);
      if (targetMatch) {
        topNodes.add(targetMatch[1] || targetMatch[2]);
      }
    }
  }

  // If we have too many nodes, truncate
  const nodeArr = Array.from(topNodes).slice(0, MAX_SIMPLE_NODES);
  const nodeSet = new Set(nodeArr);

  const result: string[] = [header];

  // Add node definitions with labels
  for (const nodeId of nodeArr) {
    const label = nodeLabels.get(nodeId);
    if (label) {
      result.push(`    ${nodeId}["${label}"]`);
    }
  }

  // Add edges that reference only kept nodes
  for (const edge of topEdges) {
    const sourceMatch = edge.match(/^\s*([a-zA-Z0-9_]+)/);
    if (sourceMatch && nodeSet.has(sourceMatch[1])) {
      result.push(`    ${edge.trim()}`);
    }
  }

  return result.length > 1 ? result.join('\n') : source;
}

/**
 * Simplify a sequence diagram by keeping only main actors and the first N messages.
 */
function simplifySequence(source: string): string {
  const lines = source.split('\n');
  const result: string[] = [lines[0]]; // header

  const actorPattern = /^\s*(participant|actor)\b/i;
  const messagePattern = /^\s*\S+\s*(->>|-->>|->|-->)\s*\S+/;

  let messageCount = 0;
  const maxMessages = 8;

  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Always keep actor/participant declarations
    if (actorPattern.test(trimmed)) {
      result.push(`    ${trimmed}`);
      continue;
    }

    // Keep messages up to limit
    if (messagePattern.test(trimmed) && messageCount < maxMessages) {
      // Shorten message labels
      const shortened = trimmed.replace(/:\s*(.{40,})$/, (_, msg) => `: ${msg.slice(0, 37)}...`);
      result.push(`    ${shortened}`);
      messageCount++;
      continue;
    }

    // Skip loops, notes, etc. in simple mode
  }

  if (messageCount > 0 && messageCount >= maxMessages) {
    result.push(`    Note over ${result[1]?.trim().split(/\s+/).pop() || 'A'}: ... and more interactions`);
  }

  return result.length > 1 ? result.join('\n') : source;
}

/**
 * Simplify a class diagram by removing method/property details.
 * Keep only class names and relationships.
 */
function simplifyClass(source: string): string {
  const lines = source.split('\n');
  const result: string[] = [lines[0]]; // header

  const classDefStart = /^\s*class\s+(\w+)\s*\{/;
  const relationPattern = /^\s*\w+\s*(--|<\||o--|>\||\.\.|\*--)/;
  let insideClass = false;

  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (classDefStart.test(trimmed)) {
      // Output just the class name
      const match = classDefStart.exec(trimmed);
      if (match) {
        result.push(`    class ${match[1]}`);
      }
      insideClass = true;
      continue;
    }

    if (insideClass) {
      if (trimmed === '}') {
        insideClass = false;
      }
      continue; // Skip class body
    }

    // Keep relationship lines
    if (relationPattern.test(trimmed)) {
      result.push(`    ${trimmed}`);
    }
  }

  return result.length > 1 ? result.join('\n') : source;
}

/**
 * Main simplification function.
 * Produces a simplified version of the mermaid source for "Simple" view.
 *
 * @param mermaidSource - The raw mermaid source string
 * @param diagramData - Optional structured diagram data with node depths
 * @returns Simplified mermaid source string
 */
export function simplifyMermaid(
  mermaidSource: string,
  diagramData?: DiagramData
): string {
  try {
    // If structured data is available with depth info, use it
    if (diagramData && diagramData.nodes.length > 0) {
      const hasDepthInfo = diagramData.nodes.some(n => n.depth > 0);
      if (hasDepthInfo) {
        return simplifyFromDiagramData(diagramData);
      }
      // If all nodes are depth 0, only simplify if there are too many
      if (diagramData.nodes.length > MAX_SIMPLE_NODES) {
        return simplifyFromDiagramData({
          ...diagramData,
          nodes: diagramData.nodes.slice(0, MAX_SIMPLE_NODES),
        });
      }
    }

    // Fall back to heuristic parsing of raw source
    const type = detectDiagramType(mermaidSource);

    switch (type) {
      case 'flowchart':
        return simplifyFlowchart(mermaidSource);
      case 'sequence':
        return simplifySequence(mermaidSource);
      case 'class':
        return simplifyClass(mermaidSource);
      default:
        // For ER, state, gantt, pie, git graphs - return original
        // (these diagram types are usually already fairly compact)
        return mermaidSource;
    }
  } catch {
    // Any parsing error: return original source unchanged
    return mermaidSource;
  }
}

/**
 * Build a focused sub-diagram showing a specific node and its immediate connections.
 * Used when user clicks "Expand this component" in Simple view.
 */
export function buildSubDiagram(
  nodeId: string,
  diagramData: DiagramData
): string | null {
  const node = diagramData.nodes.find(n => n.id === nodeId);
  if (!node) return null;

  // Find all edges connected to this node
  const connectedEdges = diagramData.edges.filter(
    e => e.source === nodeId || e.target === nodeId
  );
  if (connectedEdges.length === 0) return null;

  // Collect connected node IDs
  const connectedNodeIds = new Set<string>();
  connectedNodeIds.add(nodeId);
  for (const edge of connectedEdges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  // Build sub-diagram
  const lines: string[] = ['flowchart TD'];
  const nodesInDiagram = diagramData.nodes.filter(n => connectedNodeIds.has(n.id));

  for (const n of nodesInDiagram) {
    const safeId = n.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const label = n.label.length > 50 ? n.label.slice(0, 47) + '...' : n.label;
    // Highlight the focus node with a different shape
    if (n.id === nodeId) {
      lines.push(`    ${safeId}(["${label}"])`);
    } else {
      lines.push(`    ${safeId}["${label}"]`);
    }
  }

  for (const edge of connectedEdges) {
    const safeSource = edge.source.replace(/[^a-zA-Z0-9_]/g, '_');
    const safeTarget = edge.target.replace(/[^a-zA-Z0-9_]/g, '_');
    if (edge.label) {
      lines.push(`    ${safeSource} -->|"${edge.label}"| ${safeTarget}`);
    } else {
      lines.push(`    ${safeSource} --> ${safeTarget}`);
    }
  }

  return lines.join('\n');
}
