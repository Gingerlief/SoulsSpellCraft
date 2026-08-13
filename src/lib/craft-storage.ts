
import type { CraftClone, CraftState, RootEdit } from './craft';
import type { DocValue, SpellDocument } from '../spell-document';

const PREFIX = 'SoulsSpellCraft:craft:';

/**
 * The spelling this repo used before the name was settled.
 *
 * Saves written under it are moved across on the next read. Without that, renaming the prefix
 * would empty the "Unfinished" list while the saves sat in storage untouched — a rename
 * silently eating work in progress.
 */
const LEGACY_PREFIX = 'SoulsSpellsCraft:craft:';

export const CRAFT_SAVE_VERSION = 1;

export type SerialisedCraftState = {
  targetId: number;
  clones: Array<Omit<CraftClone, 'overrides'> & { overrides: Array<[string, DocValue]> }>;
  rootEdits: Array<[string, RootEdit]>;
  floating: string[];
};

export type CraftText = { name: string; info: string; caption: string };

export type SavedCraft = {
  version: number;
  savedAt: string;
  regulationSha256: string | null;
  targetId: number;
  donors: number[];
  text: CraftText;
  state: SerialisedCraftState;
};

export function serialiseCraft(state: CraftState): SerialisedCraftState {
  return {
    targetId: state.targetId,
    clones: state.clones.map((c) => ({ ...c, overrides: [...c.overrides] })),
    rootEdits: [...state.rootEdits],
    floating: [...state.floating],
  };
}

export function deserialiseCraft(state: SerialisedCraftState): CraftState {
  return {
    targetId: state.targetId,
    clones: state.clones.map((c) => ({ ...c, overrides: new Map(c.overrides) })),
    rootEdits: new Map(state.rootEdits),
    floating: [...state.floating],
  };
}

export function staleness(saved: SavedCraft, slotDoc: SpellDocument): string | null {
  const now = slotDoc.source.regulationSha256;
  if (!saved.regulationSha256 || !now) {
    return 'this export carries no regulation hash, so the save cannot be checked against it';
  }
  if (saved.regulationSha256 !== now) {
    return (
      'the regulation has changed since this craft was saved, so its edits would be ' +
      'refused as stale. Start it again against the current export.'
    );
  }
  return null;
}


function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveCraft(craft: {
  targetId: number;
  state: CraftState;
  donors: readonly number[];
  text: CraftText;
  regulationSha256: string | null;
}): void {
  const saved: SavedCraft = {
    version: CRAFT_SAVE_VERSION,
    savedAt: new Date().toISOString(),
    regulationSha256: craft.regulationSha256,
    targetId: craft.targetId,
    donors: [...craft.donors],
    text: craft.text,
    state: serialiseCraft(craft.state),
  };
  try {
    store()?.setItem(PREFIX + craft.targetId, JSON.stringify(saved));
  } catch (e) {
    console.warn('could not save this craft; it will not survive a reload', e);
  }
}

export function loadSaved(targetId: number): SavedCraft | null {
  const raw = store()?.getItem(PREFIX + targetId);
  if (!raw) return null;
  return parseSaved(raw);
}

export function listSaved(): SavedCraft[] {
  const s = store();
  if (!s) return [];
  migrateLegacy(s);
  const found: SavedCraft[] = [];
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    const saved = parseSaved(s.getItem(key));
    if (saved) found.push(saved);
  }
  return found.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function discardSaved(targetId: number): void {
  store()?.removeItem(PREFIX + targetId);
}

/**
 * Moves saves written under {@link LEGACY_PREFIX} to the current one.
 *
 * A move rather than a copy, which is what makes it safe to leave in place permanently: once
 * the old keys are gone this is a no-op, and a save that was discarded cannot come back.
 *
 * Keys are collected before anything is written. Removing entries during the scan reindexes
 * `key(i)` underneath the loop, which silently skips every other entry.
 *
 * A save already at the new key wins. That one is what this build has been writing, so it is
 * the newer of the two by construction.
 *
 * Only `listSaved` calls this, because it is the only path that enumerates: `loadSaved` and
 * `discardSaved` address a known `targetId` and are reached from the list.
 */
function migrateLegacy(s: Storage): void {
  const legacy: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i);
    if (key?.startsWith(LEGACY_PREFIX)) legacy.push(key);
  }
  for (const key of legacy) {
    const raw = s.getItem(key);
    try {
      const target = PREFIX + key.slice(LEGACY_PREFIX.length);
      if (raw !== null && parseSaved(raw) && s.getItem(target) === null) s.setItem(target, raw);
      s.removeItem(key);
    } catch {
      // A full quota must not stop the list from rendering. The old key simply stays, and the
      // next read tries again.
    }
  }
}

function parseSaved(raw: string | null | undefined): SavedCraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedCraft;
    if (parsed?.version !== CRAFT_SAVE_VERSION) return null;
    if (typeof parsed.targetId !== 'number' || !parsed.state) return null;
    return parsed;
  } catch {
    return null;
  }
}
