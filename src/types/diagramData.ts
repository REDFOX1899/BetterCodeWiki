export interface DiagramNode {
  id: string;
  label: string;
  technology?: string;
  files: string[];
  description?: string;
  depth: number;
}

export interface DiagramEdge {
  source: string;
  target: string;
  label?: string;
  type: 'dependency' | 'data_flow' | 'api_call';
}

export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  mermaidSource: string;
  diagramType: 'flowchart' | 'sequence' | 'class' | 'er';
}
