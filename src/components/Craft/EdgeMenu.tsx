
import { useMemo, useState } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import { kindStyle } from '../../lib/node-kinds';
import { targetsFor } from '../../lib/reference';
import type { DocNode, SpellDocument } from '../../spell-document';

export function EdgeMenu({
  doc,
  library,
  from,
  to,
  x,
  y,
  onCut,
  onRepoint,
  onClose,
}: {
  doc: SpellDocument;
  library: SpellDocument;
  from: string;
  to: string;
  x: number;
  y: number;
  onCut: (field: string) => void;
  onRepoint: (field: string, id: number) => void;
  onClose: () => void;
}) {
  const ref = useDismiss<HTMLDivElement>(onClose);
  const [changing, setChanging] = useState<string | null>(null);

  const parent = doc.nodes.find((n) => n.key === from);
  const fields = useMemo(() => {
    const seen: string[] = [];
    for (const e of doc.edges) {
      if (e.from !== from || e.to !== to || e.resolution === 'idConvention') continue;
      if (!seen.includes(e.field)) seen.push(e.field);
    }
    return seen;
  }, [doc, from, to]);

  const valueOf = (field: string) => {
    const v = parent?.fields.find((f) => f.name === field)?.value;
    return v?.type === 'int' ? v.value : null;
  };

  return (
    <div ref={ref} className="nodemenu edgemenu" style={{ left: x, top: y }} role="menu">
      <header className="nodemenu__head">
        <span style={{ color: kindStyle(parent?.kind ?? '').color }}>{from}</span>
        <span className="muted"> → </span>
        <span style={{ color: kindStyle(doc.nodes.find((n) => n.key === to)?.kind ?? '').color }}>
          {to}
        </span>
      </header>

      {changing === null ? (
        <ul>
          {fields.map((field) => (
            <li key={field} className="edgemenu__field">
              <div className="edgemenu__name">
                <code>{field}</code>
                {valueOf(field) !== null && (
                  <span className="connect__current">→ {valueOf(field)}</span>
                )}
              </div>
              <div className="edgemenu__actions">
                <button type="button" role="menuitem" onClick={() => onCut(field)}>
                  Remove
                </button>
                <button type="button" role="menuitem" onClick={() => setChanging(field)}>
                  Point at…
                </button>
              </div>
            </li>
          ))}
          {fields.length === 0 && (
            <li className="craft__hint">
              This link is not held by a field — nothing here to change.
            </li>
          )}
        </ul>
      ) : (
        <RepointPicker
          library={library}
          paramType={parent?.paramType ?? null}
          field={changing}
          current={valueOf(changing)}
          onPick={(id) => onRepoint(changing, id)}
          onBack={() => setChanging(null)}
        />
      )}
    </div>
  );
}

function RepointPicker({
  library,
  paramType,
  field,
  current,
  onPick,
  onBack,
}: {
  library: SpellDocument;
  paramType: string | null;
  field: string;
  current: number | null;
  onPick: (id: number) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState('');

  const candidates: DocNode[] = useMemo(() => {
    if (!paramType) return [];
    return targetsFor(library, paramType, field);
  }, [library, paramType, field]);

  const shown = candidates.filter(
    (n) =>
      n.id !== current &&
      (query === '' || `${n.key} ${n.name ?? ''}`.toLowerCase().includes(query.toLowerCase())),
  );

  const typed = /^\d+$/.test(query.trim()) ? Number(query.trim()) : null;

  return (
    <div className="edgemenu__picker">
      <div className="edgemenu__pickhead">
        <button type="button" className="ghost" onClick={onBack}>
          ←
        </button>
        <code>{field}</code>
      </div>
      <input
        autoFocus
        className="donor__search"
        placeholder="Filter, or type an id…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && typed !== null) onPick(typed);
        }}
      />
      <ul>
        {typed !== null && (
          <li>
            <button type="button" role="menuitem" onClick={() => onPick(typed)}>
              <code>{typed}</code>
              <span className="connect__hint">use this id</span>
            </button>
          </li>
        )}
        {shown.slice(0, 40).map((n) => (
          <li key={n.key}>
            <button type="button" role="menuitem" onClick={() => onPick(n.id)}>
              <code>{n.key}</code>
              {n.name && <span className="donor__name">{n.name}</span>}
            </button>
          </li>
        ))}
        {shown.length === 0 && typed === null && (
          <li className="craft__hint">
            {candidates.length === 0
              ? 'Nothing loaded that this field accepts — type an id instead.'
              : 'No match. Type an id to use it anyway.'}
          </li>
        )}
      </ul>
    </div>
  );
}
