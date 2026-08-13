
import { useMemo, useState } from 'react';
import { kindStyle } from '../../lib/node-kinds';
import type { DocNode, SpellDocument, SpellIndexEntry } from '../../spell-document';

export const DRAG_MIME = 'application/x-node';

const ROOT_KINDS = new Set(['magic', 'goods']);

export function DonorPanel({
  donor,
  spells,
  onPick,
  onClear,
}: {
  donor: SpellDocument | null;
  spells: SpellIndexEntry[];
  onPick: (magicId: number) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    if (!donor) return [];
    const byKind = new Map<string, DocNode[]>();
    for (const n of donor.nodes) {
      if (ROOT_KINDS.has(n.kind)) continue;
      if (query && !`${n.key} ${n.name ?? ''}`.toLowerCase().includes(query.toLowerCase())) {
        continue;
      }
      const list = byKind.get(n.kind) ?? [];
      list.push(n);
      byKind.set(n.kind, list);
    }
    return [...byKind.entries()];
  }, [donor, query]);

  if (!donor) {
    return (
      <div className="donor">
        <h2 className="donor__title">Parts</h2>
        <p className="craft__hint">Pick a spell to take nodes from.</p>
        <select
          className="donor__select"
          defaultValue=""
          onChange={(e) => e.target.value && onPick(Number(e.target.value))}
        >
          <option value="" disabled>
            Choose a spell…
          </option>
          {spells.map((s) => (
            <option key={s.magicId} value={s.magicId}>
              {s.name ?? s.magicId} ({s.magicId})
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="donor">
      <h2 className="donor__title">
        Parts — {donor.spell.name ?? donor.spell.magicId}
        <button type="button" className="craft__stop" onClick={onClear}>
          change
        </button>
      </h2>
      <input
        className="donor__search"
        placeholder="Filter nodes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="craft__hint">Drag a node onto the canvas, or onto a node already there.</p>

      <div className="donor__groups">
        {groups.map(([kind, nodes]) => {
          const style = kindStyle(kind);
          return (
            <section key={kind} className="donor__group">
              <h3 style={{ color: style.color }}>
                {style.label} <span className="muted">({nodes.length})</span>
              </h3>
              <ul>
                {nodes.map((n) => (
                  <li
                    key={n.key}
                    className="donor__node"
                    style={{ borderLeftColor: style.color }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_MIME, n.key);
                      e.dataTransfer.setData('text/plain', n.key);
                      e.dataTransfer.effectAllowed = 'link';
                    }}
                    title={n.table ?? 'not a param row'}
                  >
                    <code>{n.key}</code>
                    {n.name && <span className="donor__name">{n.name}</span>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {groups.length === 0 && <p className="craft__hint">No nodes match.</p>}
      </div>
    </div>
  );
}
