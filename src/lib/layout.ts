
import dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';
import { MarkerType, Position } from '@xyflow/react';
import type { DocEdge, DocNode, SpellDocument } from '../spell-document';
import { isSoftLink, kindStyle } from './node-kinds';

export type CraftRole = 'owned' | 'referenced' | 'floating';

export type SpellNodeData = {
  doc: DocNode;
  dirty?: boolean;
  role?: CraftRole;
  fieldCount: number;
  inbound: number;
  outbound: number;
};

export type SpellFlowNode = Node<SpellNodeData, 'spell'>;

const NODE_WIDTH = 210;
const NODE_HEIGHT = 78;

export function buildFlow(doc: SpellDocument): {
  nodes: SpellFlowNode[];
  edges: Edge[];
} {
  const degree = new Map<string, { in: number; out: number }>();
  const bump = (key: string, dir: 'in' | 'out') => {
    const d = degree.get(key) ?? { in: 0, out: 0 };
    d[dir] += 1;
    degree.set(key, d);
  };
  for (const e of doc.edges) {
    bump(e.from, 'out');
    bump(e.to, 'in');
  }

  const nodes: SpellFlowNode[] = doc.nodes.map((n) => ({
    id: n.key,
    type: 'spell',
    position: { x: 0, y: 0 },
    data: {
      doc: n,
      dirty: false,
      fieldCount: n.fields.length,
      inbound: degree.get(n.key)?.in ?? 0,
      outbound: degree.get(n.key)?.out ?? 0,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  const grouped = new Map<string, DocEdge[]>();
  for (const e of doc.edges) {
    const key = `${e.from}->${e.to}`;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(e);
    else grouped.set(key, [e]);
  }

  const present = new Set(doc.nodes.map((n) => n.key));
  const edges: Edge[] = [];
  for (const [key, group] of grouped) {
    const first = group[0];
    if (!present.has(first.from) || !present.has(first.to)) continue;

    const soft = isSoftLink(first.resolution);
    const color = kindStyle(
      doc.nodes.find((n) => n.key === first.to)?.kind ?? '',
    ).color;
    const fields = group.map((e) => e.field);
    const label =
      fields.length > 3
        ? `${fields.slice(0, 3).join(', ')} +${fields.length - 3}`
        : fields.join(', ');

    edges.push({
      id: key,
      source: first.from,
      target: first.to,
      label,
      animated: false,
      style: {
        stroke: color,
        strokeWidth: soft ? 1 : 1.6,
        strokeDasharray: soft ? '4 4' : undefined,
        opacity: soft ? 0.55 : 0.85,
      },
      labelStyle: { fill: '#c9ccd1', fontSize: 10 },
      labelBgStyle: { fill: '#14161a', fillOpacity: 0.85 },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 3,
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      data: { group },
    });
  }

  return { nodes: layout(nodes, edges), edges };
}

function layout(nodes: SpellFlowNode[], edges: Edge[]): SpellFlowNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 28, ranksep: 110, marginx: 40, marginy: 40 });

  for (const n of nodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 },
    };
  });
}

export function edgesFor(doc: SpellDocument, key: string) {
  return {
    incoming: doc.edges.filter((e) => e.to === key),
    outgoing: doc.edges.filter((e) => e.from === key),
  };
}
