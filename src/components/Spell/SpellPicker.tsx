import { useMemo, useState } from 'react';
import type { SpellIndexEntry } from '../../spell-document';
import { searchSpells, type SpellSource } from '../../lib/directory';

export function SpellPicker({
  source,
  selected,
  onPick,
  onClose,
}: {
  source: SpellSource;
  selected: number | null;
  onPick: (entry: SpellIndexEntry) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [onlyWithIssues, setOnlyWithIssues] = useState(false);

  const results = useMemo(
    () => searchSpells(source.index.spells, query, { onlyWithIssues }),
    [source.index.spells, query, onlyWithIssues],
  );

  return (
    <aside className="picker">
      <header className="picker__head">
        <div>
          <h2>{source.name}</h2>
          <p className="picker__sub">{source.index.spells.length} spells</p>
        </div>
        <button className="ghost" onClick={onClose} aria-label="Close spell list">
          ✕
        </button>
      </header>

      <div className="picker__toolbar">
        <input
          type="search"
          placeholder="Search by name or id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="toggle" title="Spells with diagnostics or unresolved nodes">
          <input
            type="checkbox"
            checked={onlyWithIssues}
            onChange={(e) => setOnlyWithIssues(e.target.checked)}
          />
          issues only
        </label>
      </div>

      <ul className="picker__list">
        {results.map((s) => (
          <li key={s.magicId}>
            <button
              className={`picker__item ${s.magicId === selected ? 'picker__item--on' : ''}`}
              onClick={() => onPick(s)}
            >
              <span className="picker__name">{s.name ?? `Magic ${s.magicId}`}</span>
              <span className="picker__id">{s.magicId}</span>
              <span className="picker__stats">
                {s.nodeCount} nodes · {s.generatedRowCount} rows
                {/* Surfaced because it is the difference between a spell this tool
                    fully understands and one where parts are unresolved. */}
                {s.unresolvedNodeCount > 0 && (
                  <span className="picker__warn"> · {s.unresolvedNodeCount} unresolved</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {results.length === 0 && <p className="muted picker__empty">Nothing matches.</p>}
    </aside>
  );
}
