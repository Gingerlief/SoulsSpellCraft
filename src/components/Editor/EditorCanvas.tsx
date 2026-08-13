
import { useMemo, useRef, type ReactNode } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import { SpellNode } from './SpellNode';
import { DRAG_MIME } from '../Craft/DonorPanel';
import { kindStyle } from '../../lib/node-kinds';
import type { CraftRole, SpellFlowNode } from '../../lib/layout';

const nodeTypes = { spell: SpellNode };

export type Point = { x: number; y: number };

export function EditorCanvas({
  hasDocument,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  dirtyNodes,
  roleOf,
  acceptDrops,
  onDropNode,
  onConnectNodes,
  onSelect,
  onContextMenu,
  onEdgeContextMenu,
  empty,
}: {
  hasDocument: boolean;
  nodes: SpellFlowNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<SpellFlowNode>;
  onEdgesChange: OnEdgesChange<Edge>;
  dirtyNodes: ReadonlySet<string>;
  roleOf: (key: string) => CraftRole | undefined;
  acceptDrops: boolean;
  onDropNode: (childKey: string, parentKey: string | null, at: Point) => void;
  onConnectNodes: (sourceKey: string, targetKey: string, at: Point) => void;
  onSelect: (key: string | null) => void;
  onContextMenu: (key: string, at: Point) => void;
  onEdgeContextMenu: (from: string, to: string, at: Point) => void;
  empty: ReactNode;
}) {

  const lastPointer = useRef<Point>({ x: 0, y: 0 });

  const decorated = useMemo(
    () =>
      nodes.map((n) => {
        const dirty = dirtyNodes.has(n.id);
        const role = roleOf(n.id);
        return n.data.dirty === dirty && n.data.role === role
          ? n
          : { ...n, data: { ...n.data, dirty, role } };
      }),
    [nodes, dirtyNodes, roleOf],
  );

  return (
    <div
      className="canvas"
      onContextMenu={(e) => {

        e.preventDefault();
      }}
      onDragOver={(e) => {
        if (!acceptDrops || !e.dataTransfer.types.includes(DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'link';
      }}
      onDrop={(e) => {
        const childKey = e.dataTransfer.getData(DRAG_MIME);
        if (!childKey || !acceptDrops) return;
        e.preventDefault();
        e.stopPropagation();
        lastPointer.current = { x: e.clientX, y: e.clientY };
        const onNode = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
        onDropNode(childKey, onNode?.dataset.id ?? null, lastPointer.current);
      }}
    >
      {hasDocument ? (
        <ReactFlow
          nodes={decorated}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_: unknown, node: Node) => onSelect(node.id)}
          onNodeContextMenu={(e: React.MouseEvent, node: Node) => {
            e.preventDefault();
            onContextMenu(node.id, { x: e.clientX, y: e.clientY });
          }}
          onEdgeContextMenu={(e: React.MouseEvent, edge: Edge) => {
            e.preventDefault();
            onEdgeContextMenu(edge.source, edge.target, { x: e.clientX, y: e.clientY });
          }}
          onConnect={(c: Connection) => onConnectNodes(c.source, c.target, lastPointer.current)}
          onPaneClick={() => onSelect(null)}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
        >
          <Background color="#232830" gap={22} />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => kindStyle((n as SpellFlowNode).data?.doc.kind ?? '').color}
            maskColor="rgba(10,12,15,0.75)"
            style={{ background: '#0f1115' }}
          />
        </ReactFlow>
      ) : (
        empty
      )}
    </div>
  );
}
