
import {
  editField,
  parseNodeKey,
  rootKey,
  type CraftState,
  type RootEdit,
} from './craft';
import { emptyValueFor } from './reference';
import type { DocValue, SpellDocument } from '../spell-document';

export type Referrer =
  | { holder: 'root'; field: string }
  | { holder: 'slot'; field: string }
  | { holder: 'clone'; parentKey: string; field: string }
  | { holder: 'source'; parentKey: string; field: string };

export function referrersOf(state: CraftState, doc: SpellDocument, key: string): Referrer[] {
  const { id } = parseNodeKey(key);
  const points = (v: DocValue) => v.type === 'int' && v.value === id;
  const found: Referrer[] = [];

  for (const [field, edit] of state.rootEdits) {
    if (points(edit.value)) found.push({ holder: 'root', field });
  }
  for (const clone of state.clones) {
    for (const [field, value] of clone.overrides) {
      if (points(value)) found.push({ holder: 'clone', parentKey: clone.key, field });
    }
  }

  for (const edge of doc.edges) {
    if (edge.to !== key) continue;
    if (edge.resolution === 'idConvention') continue;

    if (edge.from === rootKey(state)) {
      if (!found.some((r) => r.holder === 'root' && r.field === edge.field)) {
        found.push({ holder: 'slot', field: edge.field });
      }
      continue;
    }

    const already = found.some(
      (r) =>
        (r.holder === 'clone' || r.holder === 'source') &&
        r.parentKey === edge.from &&
        r.field === edge.field,
    );
    if (already) continue;
    found.push({ holder: 'source', parentKey: edge.from, field: edge.field });
  }

  return found;
}

export function canDetach(state: CraftState, doc: SpellDocument, key: string): boolean {
  if (key === rootKey(state)) return false;
  return referrersOf(state, doc, key).length > 0;
}

export function detachNode(
  state: CraftState,
  doc: SpellDocument,
  library: SpellDocument,
  key: string,
): CraftState {
  let next = state;
  for (const referrer of referrersOf(state, doc, key)) {
    next = clearReferrer(next, doc, library, referrer);
  }
  return next;
}

export function detachLink(
  state: CraftState,
  doc: SpellDocument,
  library: SpellDocument,
  parentKey: string,
  field: string,
): CraftState {
  return clearReferrer(state, doc, library, referrerFor(state, parentKey, field));
}

function referrerFor(state: CraftState, parentKey: string, field: string): Referrer {
  if (parentKey === rootKey(state)) {
    return state.rootEdits.has(field) ? { holder: 'root', field } : { holder: 'slot', field };
  }
  const clone = state.clones.find((c) => c.key === parentKey);
  if (clone?.overrides.has(field)) return { holder: 'clone', parentKey, field };
  return { holder: 'source', parentKey, field };
}

function clearReferrer(
  state: CraftState,
  doc: SpellDocument,
  library: SpellDocument,
  referrer: Referrer,
): CraftState {
  if (referrer.holder === 'root') return clearRootEdit(state, library, referrer.field);
  if (referrer.holder === 'slot') return clearSlotField(state, library, referrer.field);

  const empty = emptyValueFor(
    library,
    paramTypeOf(state, doc, library, referrer.parentKey),
    referrer.field,
  );
  return editField(state, doc, referrer.parentKey, referrer.field, empty).state;
}

function paramTypeOf(
  state: CraftState,
  doc: SpellDocument,
  library: SpellDocument,
  key: string,
): string {
  const source = state.clones.find((c) => c.key === key)?.source;
  for (const candidate of [source, key]) {
    if (!candidate) continue;
    for (const where of [library, doc]) {
      const found = where.nodes.find((n) => n.key === candidate);
      if (found?.paramType) return found.paramType;
    }
  }
  throw new Error(
    `${key} is not a param row, so it has no reference field to clear — ` +
      `FXR nodes are files on disk rather than rows`,
  );
}

function clearRootEdit(state: CraftState, library: SpellDocument, field: string): CraftState {
  const edit = state.rootEdits.get(field);
  if (!edit) return state;

  const rootEdits = new Map(state.rootEdits);
  if (samePointer(edit.original, edit.value)) {
    const empty = emptyValueFor(library, 'MAGIC_PARAM_ST', field);
    const cleared: RootEdit = { ...edit, value: empty };
    rootEdits.set(field, cleared);
  } else {
    rootEdits.delete(field);
  }
  return { ...state, rootEdits };
}

function clearSlotField(
  state: CraftState,
  library: SpellDocument,
  field: string,
): CraftState {
  const slotRow = library.nodes.find((n) => n.key === rootKey(state));
  const original = slotRow?.fields.find((f) => f.name === field)?.value;
  if (!original) {
    throw new Error(
      `the slot's own ${rootKey(state)} row is not loaded, so ${field} cannot be cleared ` +
        `without guessing what it currently holds`,
    );
  }
  const empty = emptyValueFor(library, slotRow!.paramType ?? 'MAGIC_PARAM_ST', field);
  const rootEdits = new Map(state.rootEdits);
  rootEdits.set(field, { value: empty, original });
  return { ...state, rootEdits };
}

function samePointer(a: DocValue, b: DocValue): boolean {
  return a.type === 'int' && b.type === 'int' && a.value === b.value;
}
