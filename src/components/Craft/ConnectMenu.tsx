
import { useDismiss } from '../../hooks/useDismiss';
import { connectOptions, GROUP_LABELS, suggestedField } from '../../lib/connect';
import { kindStyle } from '../../lib/node-kinds';
import type { DocNode, SpellDocument } from '../../spell-document';

export type PendingConnection = {
  parent: DocNode;
  childKey: string;
  childKind: string;
  x: number;
  y: number;
};

export function ConnectMenu({
  doc,
  pending,
  onPick,
  onCancel,
}: {
  doc: SpellDocument;
  pending: PendingConnection;
  onPick: (field: string) => void;
  onCancel: () => void;
}) {
  const ref = useDismiss<HTMLDivElement>(onCancel);
  const options = connectOptions(doc, pending.parent, pending.childKind);
  const suggested = suggestedField(doc, pending.parent, pending.childKind);

  const childStyle = kindStyle(pending.childKind);
  const parentStyle = kindStyle(pending.parent.kind);

  return (
    <div
      ref={ref}
      className="connect"
      style={{ left: pending.x, top: pending.y }}
      role="menu"
      aria-label="Choose the field for this connection"
    >
      <header className="connect__head">
        <span style={{ color: parentStyle.color }}>{pending.parent.key}</span>
        <span className="muted"> ← </span>
        <span style={{ color: childStyle.color }}>{pending.childKey}</span>
      </header>

      {options.length === 0 && (
        <p className="connect__empty">
          {pending.parent.paramType
            ? `${pending.parent.kind} rows have no catalogued reference fields.`
            : `${pending.parent.key} is a file rather than a param row, so it references nothing.`}
        </p>
      )}

      <div className="connect__groups">
        {GROUP_LABELS.map(({ key, label }) => {
          const inGroup = options.filter((o) => o.group === key);
          if (inGroup.length === 0) return null;
          const anyEnabled = inGroup.some((o) => o.enabled);
          return (
            <section key={key} className={`connect__group ${anyEnabled ? '' : 'is-disabled'}`}>
              <h4>{label}</h4>
              <ul>
                {inGroup.map((o) => (
                  <li key={o.field}>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!o.enabled}
                      title={o.note}
                      className={[
                        o.field === suggested ? 'is-suggested' : '',
                        o.enabled && !o.matches ? 'is-mismatch' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => onPick(o.field)}
                    >
                      <code>{o.field}</code>
                      {o.current !== null && o.current > 0 && (
                        <span className="connect__current" title="currently points at">
                          → {o.current}
                        </span>
                      )}
                      {/* "free" only when the slot really is empty. `suggestedField` falls
                          back to the first option when every slot is taken, and labelling
                          that one free would contradict the value shown right beside it. */}
                      {o.field === suggested && (
                        <span className="connect__hint">
                          {o.current === null || o.current <= 0 ? 'free' : 'replaces'}
                        </span>
                      )}
                      {o.enabled && !o.matches && (
                        <span className="connect__warn" title={o.note}>
                          wrong kind
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
