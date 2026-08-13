import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpellIndexEntry } from '../../spell-document';
import { searchSpells } from '../../lib/directory';

export function SpellDropdown({
  spells,
  selected,
  onPick,
}: {
  spells: SpellIndexEntry[];
  selected: number | null;
  onPick: (entry: SpellIndexEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyWithIssues, setOnlyWithIssues] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);

  const results = useMemo(
    () => searchSpells(spells, query, { onlyWithIssues }),
    [spells, query, onlyWithIssues],
  );
  const current = spells.find((s) => s.magicId === selected);

  return (
    <div className="dropdown" ref={root}>
      <button
        className="dropdown__button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="dropdown__label">
          {current ? (current.name ?? `Magic ${current.magicId}`) : 'Choose a spell…'}
        </span>
        <span className="dropdown__caret">▾</span>
      </button>

      {open && (
        <div className="dropdown__panel" role="listbox">
          <div className="dropdown__tools">
            <input
              ref={search}
              type="search"
              placeholder={`Search ${spells.length} spells…`}
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

          <ul className="dropdown__list">
            {results.map((s) => (
              <li key={s.magicId}>
                <button
                  role="option"
                  aria-selected={s.magicId === selected}
                  className={`picker__item ${s.magicId === selected ? 'picker__item--on' : ''}`}
                  onClick={() => {
                    onPick(s);
                    setOpen(false);
                  }}
                >
                  <span className="picker__name">{s.name ?? `Magic ${s.magicId}`}</span>
                  <span className="picker__id">{s.magicId}</span>
                  <span className="picker__stats">
                    {s.nodeCount} nodes · {s.generatedRowCount} rows
                    {s.unresolvedNodeCount > 0 && (
                      <span className="picker__warn"> · {s.unresolvedNodeCount} unresolved</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {results.length === 0 && <p className="muted picker__empty">Nothing matches.</p>}
        </div>
      )}
    </div>
  );
}
