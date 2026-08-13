
import type { SpellDocument } from '../../spell-document';

export function SpellHeading({ doc }: { doc: SpellDocument }) {
  const s = doc.spell;
  return (
    <div className="heading">
      <h1>{s.name ?? `Magic ${s.magicId}`}</h1>
      <div className="heading__meta">
        <span>
          id <code>{s.magicId}</code>
        </span>
        {s.iconId !== null && (
          <span>
            icon <code>{s.iconId}</code>
          </span>
        )}
        {s.classifications.map((c) => (
          <span key={c} className="tag">
            {c}
          </span>
        ))}
        <span className="muted">{s.generatedRowCount} rows to craft</span>
      </div>
    </div>
  );
}
