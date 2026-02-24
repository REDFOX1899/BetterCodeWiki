from pydantic import BaseModel
from typing import List, Optional, Literal


class DiagramNode(BaseModel):
    id: str
    label: str
    technology: Optional[str] = None
    files: List[str] = []
    description: Optional[str] = None
    depth: int = 0


class DiagramEdge(BaseModel):
    source: str
    target: str
    label: Optional[str] = None
    type: Literal['dependency', 'data_flow', 'api_call'] = 'dependency'


class DiagramData(BaseModel):
    nodes: List[DiagramNode]
    edges: List[DiagramEdge]
    mermaidSource: str
    diagramType: Literal['flowchart', 'sequence', 'class', 'er'] = 'flowchart'
    layerLevel: Optional[int] = None  # 1 = simple overview, 2 = detailed
    simplifiedMermaidSource: Optional[str] = None  # Pre-generated simple version
