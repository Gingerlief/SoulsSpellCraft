
import { SpellDropdown } from '../Spell/SpellDropdown';
import { SpellHeading } from '../Spell/SpellHeading';
import type { SpellDocument, SpellIndexEntry } from '../../spell-document';

export type PatchBarState = {
  count: number;
  rows: number;
  applying: boolean;
  canApply: boolean;
  onSave: () => void;
  onDownload: () => void;
  onDiscard: () => void;
};

export type SourceBarState = {
  canPick: boolean;
  hasSource: boolean;
  showPicker: boolean;
  onOpen: () => void;
  onTogglePicker: () => void;
};

export function EditorHeader({
  doc,
  spells,
  onPickSpell,
  patch,
  source,
  onOpenDocument,
  onLoadExample,
}: {
  doc: SpellDocument | null;
  spells: SpellIndexEntry[] | null;
  onPickSpell: (entry: SpellIndexEntry) => void;
  patch: PatchBarState;
  source: SourceBarState;
  onOpenDocument: () => void;
  onLoadExample: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar__title">
        <strong>SoulsSpellCraft</strong>
        <span className="muted"> · spell graph viewer</span>
      </div>

      {spells && (
        <SpellDropdown
          spells={spells}
          selected={doc?.spell.magicId ?? null}
          onPick={onPickSpell}
        />
      )}

      {doc && <SpellHeading doc={doc} />}

      {doc && patch.count > 0 && (
        <div className="patchbar">
          <span className="patchbar__count">
            {patch.count} edit{patch.count === 1 ? '' : 's'} in {patch.rows} row
            {patch.rows === 1 ? '' : 's'}
          </span>
          {patch.canApply ? (
            <button onClick={patch.onSave} disabled={patch.applying}>
              {patch.applying ? 'Patching regulation…' : 'Save to regulation.bin'}
            </button>
          ) : (
            <button onClick={patch.onDownload}>Save patch…</button>
          )}
          <button
            className="ghost"
            onClick={patch.onDiscard}
            disabled={patch.applying}
            title="Discard every pending edit"
          >
            Discard
          </button>
        </div>
      )}

      <div className="topbar__actions">
        {source.canPick && <button onClick={source.onOpen}>Open export folder…</button>}
        {source.hasSource && (
          <button className="ghost" onClick={source.onTogglePicker}>
            {source.showPicker ? 'Hide' : 'Show'} spells
          </button>
        )}
        <button className="ghost" onClick={onOpenDocument}>
          Open document…
        </button>
        <button className="ghost" onClick={onLoadExample}>
          Load example
        </button>
      </div>
    </header>
  );
}
