
import { useState } from 'react';
import { kindStyle } from '../../lib/node-kinds';
import type { SpellDocument } from '../../spell-document';

export function EditorFooter({
  doc,
  nodeCount,
  edgeCount,
}: {
  doc: SpellDocument;
  nodeCount: number;
  edgeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const counts = doc.nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.kind] = (acc[n.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <footer className="statusbar">
      <div className="legend">
        {Object.entries(counts).map(([kind, n]) => {
          const st = kindStyle(kind);
          return (
            <span key={kind} className="legend__item" title={st.blurb}>
              <i style={{ background: st.color }} />
              {st.label} <b>{n}</b>
            </span>
          );
        })}
      </div>

      <div className="statusbar__right">
        <span className="muted">
          {nodeCount} nodes · {edgeCount} drawn edges · {doc.edges.length} references
        </span>
        {doc.diagnostics.length > 0 && (
          <button className="ghost warn" onClick={() => setOpen((v) => !v)}>
            {doc.diagnostics.length} diagnostic{doc.diagnostics.length === 1 ? '' : 's'}
          </button>
        )}
        <span className="muted" title={doc.source.regulationSha256 ?? 'unknown'}>
          reg {doc.source.regulationSha256?.slice(0, 8) ?? '—'}
        </span>
      </div>

      {open && (
        <ul className="diagnostics">
          {doc.diagnostics.map((d, i) => (
            <li key={i}>
              <b>{d.kind}</b>
              {d.node && (
                <>
                  {' '}
                  <code>{d.node}</code>
                </>
              )}{' '}
              — {d.detail}
            </li>
          ))}
        </ul>
      )}
    </footer>
  );
}
