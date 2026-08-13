import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SpellFlowNode } from '../../lib/layout';
import { castBadge, isHealthy, kindStyle } from '../../lib/node-kinds';

const ROLE_BADGE: Record<string, { text: string; title: string }> = {
  owned: {
    text: 'new row',
    title: 'This craft creates this row. Edits go here and touch nothing else.',
  },
  floating: {
    text: 'unconnected',
    title: 'On the canvas but nothing points at it, so it is not part of the spell yet.',
  },
  referenced: {
    text: 'shared',
    title:
      'Referenced, not copied — this row belongs to another spell. Editing it will copy it first.',
  },
};

export function SpellNode({ data, selected }: NodeProps<SpellFlowNode>) {
  const { doc, fieldCount, inbound, outbound, dirty, role } = data;
  const style = kindStyle(doc.kind);
  const healthy = isHealthy(doc.status);
  const cast = castBadge(doc.castTypes);
  const roleBadge = role ? ROLE_BADGE[role] : undefined;

  return (
    <div
      className={`node ${selected ? 'node--selected' : ''} ${
        healthy ? '' : 'node--unresolved'
      } ${dirty ? 'node--dirty' : ''} ${role ? `node--${role}` : ''}`}
      style={{ borderColor: style.color }}
      title={healthy ? style.blurb : (doc.statusDetail ?? doc.status)}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node__head">
        <span className="node__badge" style={{ background: style.color }}>
          {style.label}
        </span>
        {!healthy && <span className="node__warn">{doc.status}</span>}
        {dirty && (
          <span className="node__edited" title="This row has pending edits">
            edited
          </span>
        )}
        {cast && (
          <span className="node__cast" title={cast.title}>
            {cast.text}
          </span>
        )}
        {roleBadge && (
          <span className={`node__role node__role--${role}`} title={roleBadge.title}>
            {roleBadge.text}
          </span>
        )}
      </div>
      <div className="node__id">{doc.id}</div>
      <div className="node__name">{doc.name ?? doc.paramType ?? '—'}</div>
      <div className="node__meta">
        {fieldCount > 0 && <span>{fieldCount} fields</span>}
        <span>
          {inbound}&nbsp;in / {outbound}&nbsp;out
        </span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
