import { useCallback, useEffect, useState } from "react";
import {
  buildCraftPatch,
  cloneReach,
  parseNodeKey,
  rootKey,
  type CloneReach,
  type CraftClone,
  type CraftState,
} from "../../lib/craft";
import {
  discardSaved,
  listSaved,
  type CraftText,
  type SavedCraft,
} from "../../lib/craft-storage";
import {
  createDummy,
  fetchDummies,
  fetchSpell,
  type ApplyResult,
} from "../../lib/engine";
import type { SpellDocument } from "../../spell-document";

export type { CraftText };

export function CraftPanel({
  doc,
  craft,
  slotDoc,
  text,
  onStart,
  onStop,
  onSlotDoc,
  onText,
  onGenerate,
  stage,
  onResume,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  generating,
  result,
  dropError,
}: {
  doc: SpellDocument | null;
  craft: CraftState | null;
  slotDoc: SpellDocument | null;
  text: CraftText;
  onStart: (targetId: number, slotDoc: SpellDocument) => void;
  onStop: () => void;
  onSlotDoc: (doc: SpellDocument) => void;
  onText: (text: CraftText) => void;
  onGenerate: () => void;
  stage: "applying" | "packing" | null;
  onResume: (saved: SavedCraft) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  generating: boolean;
  result: ApplyResult | null;
  dropError: string | null;
}) {
  const [slots, setSlots] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saves, setSaves] = useState<SavedCraft[]>(listSaved);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void fetchDummies().then(setSlots);
  }, []);

  useEffect(() => {
    if (!craft) setSaves(listSaved());
  }, [craft]);

  const forget = useCallback((targetId: number) => {
    discardSaved(targetId);
    setSaves(listSaved());
  }, []);

  const start = useCallback(
    async (targetId: number) => {
      setError(null);
      try {
        const loaded = await fetchSpell(targetId);
        onSlotDoc(loaded);
        onStart(targetId, loaded);
      } catch {
        setError(
          `Slot ${targetId} exists in the regulation but has not been exported, so its ` +
            `current field values are unknown. In the engine repo:\n` +
            `    bin/xtask.exe spell export ${targetId}`,
        );
      }
    },
    [onStart, onSlotDoc],
  );

  const addSlot = useCallback(async () => {
    setAdding(true);
    setError(null);
    try {
      const result = await createDummy();
      if (!result.ok) {
        setError(result.output);
        return;
      }
      setSlots(result.slots);
      if (!result.reexported) {
        setError(
          `The slot was allocated, but re-exporting failed, so it cannot be opened yet. ` +
            `Run:\n    bin/xtask.exe spell export --all`,
        );
      }
    } finally {
      setAdding(false);
    }
  }, []);

  if (slots === null)
    return <div className="craft craft--loading">Looking for free slots…</div>;

  if (!craft) {
    return (
      <div className="craft">
        <h2 className="craft__title">Craft a new spell</h2>
        {slots.length === 0 ? (
          <p className="craft__hint">
            No pre-allocated slots yet. Add one to start crafting.
          </p>
        ) : (
          <>
            <p className="craft__hint">Pick a free slot to build into.</p>
            <div className="craft__slots">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="craft__slot"
                  onClick={() => void start(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          className="craft__add"
          onClick={() => void addSlot()}
          disabled={adding}
          title="Allocate an empty spell slot in the regulation"
        >
          {adding ? "Allocating…" : "+ Add slot"}
        </button>
        {saves.length > 0 && (
          <SavedCrafts
            saves={saves}
            slots={slots}
            onResume={onResume}
            onForget={forget}
          />
        )}
        {error && <pre className="craft__error">{error}</pre>}
        {dropError && <pre className="craft__error">{dropError}</pre>}
      </div>
    );
  }

  const reach = cloneReach(craft);

  return (
    <div className="craft">
      <h2 className="craft__title">
        Slot {craft.targetId}
        <span className="craft__steps">
          <button
            type="button"
            className="craft__step"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            type="button"
            className="craft__step"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            ↷
          </button>
        </span>
        <button type="button" className="craft__stop" onClick={onStop}>
          discard
        </button>
      </h2>

      <label className="craft__row">
        <span>Name</span>
        <input
          value={text.name}
          onChange={(e) => onText({ ...text, name: e.target.value })}
        />
      </label>
      <label className="craft__row">
        <span>Summary</span>
        <input
          value={text.info}
          onChange={(e) => onText({ ...text, info: e.target.value })}
        />
      </label>
      <label className="craft__row">
        <span>Description</span>
        <textarea
          rows={2}
          value={text.caption}
          onChange={(e) => onText({ ...text, caption: e.target.value })}
        />
      </label>

      <p className="craft__hint">
        Drag a node from the parts bin onto the canvas to bring it in, then draw
        a line between two nodes to connect them — the field is chosen when you
        connect.
      </p>

      {dropError && <pre className="craft__error">{dropError}</pre>}

      <CraftSummary craft={craft} slotDoc={slotDoc} reach={reach} />

      <button
        type="button"
        className="craft__generate"
        disabled={
          generating || (reach.written.size === 0 && craft.rootEdits.size === 0)
        }
        onClick={onGenerate}
      >
        {stage === "packing"
          ? "Packing effects…"
          : generating
            ? "Generating…"
            : "Generate"}
      </button>

      {result && (
        <pre className={`craft__result ${result.ok ? "is-ok" : "is-error"}`}>
          {result.output}
        </pre>
      )}
      {doc === null && (
        <p className="craft__hint">Open a spell to attach nodes from it.</p>
      )}
    </div>
  );
}

function SavedCrafts({
  saves,
  slots,
  onResume,
  onForget,
}: {
  saves: SavedCraft[];
  slots: number[];
  onResume: (saved: SavedCraft) => void;
  onForget: (targetId: number) => void;
}) {
  return (
    <div className="craft__saves">
      <h3>Unfinished</h3>
      <ul>
        {saves.map((s) => {
          const free = slots.includes(s.targetId);
          return (
            <li key={s.targetId}>
              <span className="craft__save-name">
                {s.text.name || `Slot ${s.targetId}`}
                <span className="muted"> · {s.state.clones.length} copies</span>
              </span>
              {free ? (
                <button
                  type="button"
                  className="craft__slot"
                  onClick={() => onResume(s)}
                >
                  resume
                </button>
              ) : (
                <span className="craft__hint">
                  slot {s.targetId} is no longer free
                </span>
              )}
              <button
                type="button"
                className="craft__stop"
                onClick={() => onForget(s.targetId)}
              >
                discard
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CraftSummary({
  craft,
  slotDoc,
  reach,
}: {
  craft: CraftState;
  slotDoc: SpellDocument | null;
  reach: CloneReach;
}) {
  const patch = slotDoc ? buildCraftPatch(craft, slotDoc) : null;
  const group = (keys: ReadonlySet<string>) =>
    craft.clones.filter((c) => keys.has(c.key));
  const written = group(reach.written);
  const parked = group(reach.parked);
  const unreachable = group(reach.unreachable);

  const row = (c: CraftClone) => (
    <li key={c.key}>
      <code>{c.table}</code> {c.id} — copy of {c.source}
      {c.overrides.size > 0 && <> ({[...c.overrides.keys()].join(", ")})</>}
    </li>
  );

  return (
    <div className="craft__summary">
      <h3>
        {written.length} new row{written.length === 1 ? "" : "s"},{" "}
        {craft.rootEdits.size} edit
        {craft.rootEdits.size === 1 ? "" : "s"}
      </h3>
      <ul>
        {written.map(row)}
        {[...craft.rootEdits].map(([f, e]) => (
          <li key={f}>
            <code>{rootKey(craft)}</code>.{f} ={" "}
            {e.value.type === "int" ? e.value.value : String(e.value.value)}
          </li>
        ))}
      </ul>

      {parked.length > 0 && (
        <>
          <h3 className="craft__summary-aside">Waiting on a connection</h3>
          <ul className="craft__summary-aside">{parked.map(row)}</ul>
        </>
      )}

      {unreachable.length > 0 && (
        <>
          <h3 className="craft__summary-aside">
            Nothing points at these — not written
          </h3>
          <ul className="craft__summary-aside">{unreachable.map(row)}</ul>
        </>
      )}

      {patch === null && (
        <p className="craft__hint">
          Slot document not loaded — the patch cannot be built without its base
          hash.
        </p>
      )}
      {craft.clones.some(
        (c) => parseNodeKey(c.source).id === craft.targetId,
      ) && (
        <p className="craft__hint">
          The slot's own row is edited, never duplicated.
        </p>
      )}
    </div>
  );
}
