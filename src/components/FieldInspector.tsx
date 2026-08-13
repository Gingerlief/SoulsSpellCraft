import { useMemo, useState } from 'react';
import type { DocNode, DocValue, SpellDocument } from '../spell-document';
import { edgesFor } from '../lib/layout';
import { isSoftLink, kindStyle } from '../lib/node-kinds';
import { editFor, type EditMap } from '../lib/edits';
import type { CraftState } from '../lib/craft';
import { FieldValue } from './FieldValue';
import { FxrFile } from './Fxr/FxrFile';

export function FieldInspector({
  doc,
  node,
  edits,
  onEdit,
  onRevert,
  onSelect,
  onClose,
  craft,
  onFxrCopied,
}: {
  doc: SpellDocument;
  node: DocNode;
  edits: EditMap;
  onEdit: (field: string, original: DocValue, value: DocValue) => void;
  onRevert: (field: string) => void;
  onSelect: (key: string) => void;
  onClose: () => void;
  craft: CraftState | null;
  onFxrCopied?: (sourceKey: string, newId: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [nonZeroOnly, setNonZeroOnly] = useState(false);

  const meta = node.paramType ? doc.fieldMeta[node.paramType] : undefined;
  const style = kindStyle(node.kind);
  const { incoming, outgoing } = useMemo(
    () => edgesFor(doc, node.key),
    [doc, node.key],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return node.fields.map((f) => {
      const fm = meta?.fields[f.name];
      const label = fm?.displayName?.trim() || null;
      const matches =
        !q ||
        f.name.toLowerCase().includes(q) ||
        (label?.toLowerCase().includes(q) ?? false) ||
        (fm?.description?.toLowerCase().includes(q) ?? false) ||
        formatValue(f.value).toLowerCase().includes(q);
      return { field: f, label, description: fm?.description ?? null, matches };
    });
  }, [node.fields, meta, query]);

  const visible = rows.filter(
    (r) => r.matches && (!nonZeroOnly || !isZeroish(r.field.value)),
  );
  const hiddenByFilter = rows.filter((r) => r.matches).length - visible.length;

  return (
    <aside className="inspector">
      <header className="inspector__head">
        <div>
          <span className="node__badge" style={{ background: style.color }}>
            {style.label}
          </span>
          <h2>{node.name ?? node.key}</h2>
          <p className="inspector__sub">
            <code>{node.key}</code>
            {node.paramType && <> · {node.paramType}</>}
          </p>
        </div>
        <button className="ghost" onClick={onClose} aria-label="Close inspector">
          ✕
        </button>
      </header>

      {node.castTypes.length > 0 && (
        <p className="inspector__casts">
          reached by{' '}
          {node.castTypes.map((c) => (
            <span key={c} className="tag">
              {c}
            </span>
          ))}{' '}
          cast
        </p>
      )}

      {node.status !== 'resolved' && (
        <p className="inspector__status">
          <strong>{node.status}</strong>
          {node.statusDetail && <> — {node.statusDetail}</>}
        </p>
      )}

      <section className="inspector__links">
        <h3>Connections</h3>
        {incoming.length === 0 && outgoing.length === 0 && (
          <p className="muted">No edges.</p>
        )}
        {incoming.map((e, i) => (
          <button
            key={`in-${i}`}
            className={`link ${isSoftLink(e.resolution) ? 'link--soft' : ''}`}
            onClick={() => onSelect(e.from)}
          >
            <span className="link__dir">◀ from</span>
            <span className="link__key">{e.from}</span>
            {/* Present only on the Magic row's own slot edges. See DocEdge.castType. */}
            {e.castType && <span className="link__cast">{e.castType}</span>}
            <span className="link__field">{e.field}</span>
          </button>
        ))}
        {outgoing.map((e, i) => (
          <button
            key={`out-${i}`}
            className={`link ${isSoftLink(e.resolution) ? 'link--soft' : ''}`}
            onClick={() => onSelect(e.to)}
          >
            <span className="link__dir">to ▶</span>
            <span className="link__key">{e.to}</span>
            <span className="link__field">{e.field}</span>
          </button>
        ))}
      </section>

      {/* An FXR is a file rather than a row, so it has no fields to list and this is what
          stands in their place. See FxrFile on why it hands off rather than editing. */}
      {node.kind === 'fxr' && <FxrFile node={node} craft={craft} onCopied={onFxrCopied} />}

      {node.fields.length > 0 && (
        <section className="inspector__fields">
          <div className="inspector__toolbar">
            <input
              type="search"
              placeholder={`Search ${node.fields.length} fields…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="toggle">
              <input
                type="checkbox"
                checked={nonZeroOnly}
                onChange={(e) => setNonZeroOnly(e.target.checked)}
              />
              non-zero only
            </label>
          </div>

          {!meta && node.paramType && (
            <p className="muted small">
              No field labels vendored for <code>{node.paramType}</code> — showing raw
              param names.
            </p>
          )}

          <table className="fields">
            <tbody>
              {visible.map(({ field, label, description }) => {
                const pending = editFor(edits, node.key, field.name);
                return (
                  <tr
                    key={field.name}
                    title={description ?? undefined}
                    className={pending ? 'fields__row--dirty' : undefined}
                  >
                    <td className="fields__name">
                      <span className="fields__raw">{field.name}</span>
                      {label && <span className="fields__label">{label}</span>}
                    </td>
                    <td className="fields__value">
                      <FieldValue
                        original={field.value}
                        current={pending?.value ?? field.value}
                        onCommit={(v) => onEdit(field.name, field.value, v)}
                        onRevert={() => onRevert(field.name)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {visible.length === 0 && <p className="muted">Nothing matches.</p>}
          {hiddenByFilter > 0 && (
            <p className="muted small">
              {hiddenByFilter} zero/empty field{hiddenByFilter === 1 ? '' : 's'} hidden by
              the filter.
            </p>
          )}
        </section>
      )}

      {node.fields.length === 0 && node.status === 'resolved' && (
        <p className="muted">
          This node has no param row — FXR nodes are files on disk, not table rows.
        </p>
      )}
    </aside>
  );
}

function formatValue(v: DocValue): string {
  switch (v.type) {
    case 'int':
      return String(v.value);
    case 'float':
    case 'double':
      return Number.isInteger(v.value) ? v.value.toFixed(1) : String(v.value);
    case 'str':
      return v.value === '' ? '""' : v.value;
    case 'bytes':
      return `0x${v.value}`;
    default:
      return JSON.stringify(v);
  }
}

function isZeroish(v: DocValue): boolean {
  switch (v.type) {
    case 'int':
    case 'float':
    case 'double':
      return v.value === 0 || v.value === -1;
    case 'str':
      return v.value.trim() === '';
    case 'bytes':
      return /^0*$/.test(v.value);
    default:
      return false;
  }
}
