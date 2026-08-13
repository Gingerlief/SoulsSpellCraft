
import { referenceFields } from './reference';
import {
  CRAFT_PATCH_SCHEMA_VERSION,
  type CraftPatch,
  type CraftRow,
  type DocEdge,
  type DocNode,
  type DocValue,
  type FieldEdit,
  type SpellDocument,
} from '../spell-document';

export type CraftClone = {
  source: string;
  key: string;
  id: number;
  table: string;
  overrides: ReadonlyMap<string, DocValue>;
};

export type RootEdit = {
  value: DocValue;
  original: DocValue;
};

export type CraftState = {
  targetId: number;
  clones: readonly CraftClone[];
  rootEdits: ReadonlyMap<string, RootEdit>;
  floating: readonly string[];
};

export function newCraft(targetId: number): CraftState {
  return { targetId, clones: [], rootEdits: new Map(), floating: [] };
}

export function addFloating(state: CraftState, key: string): CraftState {
  if (state.floating.includes(key)) return state;
  return { ...state, floating: [...state.floating, key] };
}

export function removeFloating(state: CraftState, key: string): CraftState {
  return { ...state, floating: state.floating.filter((k) => k !== key) };
}

export function rootKey(state: CraftState): string {
  return `Magic:${state.targetId}`;
}

export function mergeDocuments(base: SpellDocument, add: SpellDocument): SpellDocument {
  const nodes = new Map(base.nodes.map((n) => [n.key, n]));
  for (const n of add.nodes) if (!nodes.has(n.key)) nodes.set(n.key, n);

  const seen = new Set(base.edges.map((e) => `${e.from}|${e.to}|${e.field}`));
  const edges = [...base.edges];
  for (const e of add.edges) {
    const id = `${e.from}|${e.to}|${e.field}`;
    if (seen.has(id)) continue;
    seen.add(id);
    edges.push(e);
  }

  return {
    ...base,
    nodes: [...nodes.values()],
    edges,
    fieldMeta: { ...add.fieldMeta, ...base.fieldMeta },
    linkFields: { ...add.linkFields, ...base.linkFields },
  };
}

export function parseNodeKey(key: string): { kind: string; id: number } {
  const at = key.lastIndexOf(':');
  if (at < 0) throw new Error(`not a node key: ${key}`);
  const id = Number(key.slice(at + 1));
  if (!Number.isSafeInteger(id)) throw new Error(`not a node key: ${key}`);
  return { kind: key.slice(0, at), id };
}

export function derivedId(targetId: number, index: number): number {
  return targetId * 100_000 + index;
}

function nodeByKey(doc: SpellDocument, key: string): DocNode | undefined {
  return doc.nodes.find((n) => n.key === key);
}

function fieldValue(node: DocNode, field: string): DocValue | undefined {
  return node.fields.find((f) => f.name === field)?.value;
}

function cloneOf(state: CraftState, sourceKey: string): CraftClone | undefined {
  return state.clones.find((c) => c.source === sourceKey);
}

function cloneByKey(state: CraftState, key: string): CraftClone | undefined {
  return state.clones.find((c) => c.key === key);
}

export function goodsKey(state: CraftState): string {
  return `Goods:${state.targetId}`;
}

export function isOwned(state: CraftState, key: string): boolean {
  return (
    key === rootKey(state) || key === goodsKey(state) || cloneByKey(state, key) !== undefined
  );
}

function replaceClone(
  state: CraftState,
  key: string,
  update: (c: CraftClone) => CraftClone,
): CraftState {
  return {
    ...state,
    clones: state.clones.map((c) => (c.key === key ? update(c) : c)),
  };
}

function withOverride(clone: CraftClone, field: string, value: DocValue): CraftClone {
  const overrides = new Map(clone.overrides);
  overrides.set(field, value);
  return { ...clone, overrides };
}

export function attach(
  state: CraftState,
  slotDoc: SpellDocument,
  field: string,
  childKey: string,
): CraftState {
  const root = nodeByKey(slotDoc, rootKey(state));
  if (!root) throw new Error(`slot document has no ${rootKey(state)}`);
  const original = fieldValue(root, field);
  if (!original) throw new Error(`${rootKey(state)} has no field ${field}`);

  const { id } = parseNodeKey(childKey);
  const rootEdits = new Map(state.rootEdits);
  rootEdits.set(field, { value: { type: 'int', value: id }, original });
  return { ...state, rootEdits };
}

export function attachTo(
  state: CraftState,
  doc: SpellDocument,
  slotDoc: SpellDocument,
  parentKey: string,
  field: string,
  childKey: string,
): { state: CraftState; key: string } {
  if (parentKey === rootKey(state)) {
    return { state: attach(state, slotDoc, field, childKey), key: parentKey };
  }
  const { id } = parseNodeKey(childKey);
  return editField(state, doc, parentKey, field, { type: 'int', value: id });
}

export function isFloating(state: CraftState, key: string): boolean {
  return state.floating.includes(key) && !isAttached(state, key);
}

export function isAttached(state: CraftState, key: string): boolean {
  const { id } = parseNodeKey(key);
  const points = (v: DocValue) => v.type === 'int' && v.value === id;
  if ([...state.rootEdits.values()].some((e) => points(e.value))) return true;
  return state.clones.some((c) => [...c.overrides.values()].some(points));
}

export function fieldsLinking(
  doc: SpellDocument,
  parentKind: string,
  childKind: string,
): string[] {
  const kindOf = new Map(doc.nodes.map((n) => [n.key, n.kind]));
  const seen: string[] = [];
  for (const e of doc.edges) {
    if (e.resolution === 'idConvention') continue;
    if (kindOf.get(e.from) !== parentKind || kindOf.get(e.to) !== childKind) continue;
    if (!seen.includes(e.field)) seen.push(e.field);
  }
  return seen;
}

export function dropTarget(
  doc: SpellDocument,
  parentKind: string,
  childKind: string,
): { ok: true; fields: string[] } | { ok: false; reason: string } {
  const fields = fieldsLinking(doc, parentKind, childKind);
  if (fields.length === 0) {
    return {
      ok: false,
      reason: `nothing in this document references a ${childKind} from a ${parentKind}`,
    };
  }
  return { ok: true, fields };
}

function referrerOf(
  state: CraftState,
  doc: SpellDocument,
  key: string,
):
  | { kind: 'root'; field: string }
  | { kind: 'clone'; cloneKey: string; field: string }
  | undefined {
  const { id } = parseNodeKey(key);

  for (const [field, edit] of state.rootEdits) {
    if (edit.value.type === 'int' && edit.value.value === id) {
      return { kind: 'root', field };
    }
  }
  for (const clone of state.clones) {
    for (const [field, value] of clone.overrides) {
      if (value.type === 'int' && value.value === id) {
        return { kind: 'clone', cloneKey: clone.key, field };
      }
    }
  }
  const edge = doc.edges.find((e) => e.to === key && e.resolution !== 'idConvention');
  if (!edge) return undefined;
  return { kind: 'clone', cloneKey: edge.from, field: edge.field };
}

function ensureOwned(
  state: CraftState,
  doc: SpellDocument,
  key: string,
): { state: CraftState; key: string } {
  if (key === rootKey(state)) return { state, key };
  const existing = cloneByKey(state, key);
  if (existing) return { state, key };
  const already = cloneOf(state, key);
  if (already) return { state, key: already.key };

  const node = nodeByKey(doc, key);
  if (!node) throw new Error(`no node ${key} in this document`);
  if (!node.table) {
    throw new Error(
      `${key} is not a param row (it has no table) and cannot be duplicated. ` +
        `FXR nodes are files on disk rather than rows.`,
    );
  }

  const index = state.clones.length;
  const id = derivedId(state.targetId, index);
  const { kind } = parseNodeKey(key);
  const clone: CraftClone = {
    source: key,
    key: `${kind}:${id}`,
    id,
    table: node.table,
    overrides: new Map(),
  };

  const referrer = referrerOf(state, doc, key);
  let next: CraftState = { ...state, clones: [...state.clones, clone] };

  if (referrer?.kind === 'root') {
    const rootEdits = new Map(next.rootEdits);
    const prior = rootEdits.get(referrer.field);
    if (prior) {
      rootEdits.set(referrer.field, { ...prior, value: { type: 'int', value: id } });
    }
    next = { ...next, rootEdits };
  } else if (referrer?.kind === 'clone') {
    const owned = ensureOwned(next, doc, referrer.cloneKey);
    next = replaceClone(owned.state, owned.key, (c) =>
      withOverride(c, referrer.field, { type: 'int', value: id }),
    );
  }

  return { state: next, key: clone.key };
}

export function editField(
  state: CraftState,
  doc: SpellDocument,
  key: string,
  field: string,
  value: DocValue,
): { state: CraftState; key: string } {
  if (key === rootKey(state)) {
    const root = nodeByKey(doc, key);
    const original = root ? fieldValue(root, field) : undefined;
    if (!original) throw new Error(`${key} has no field ${field}`);
    const rootEdits = new Map(state.rootEdits);
    rootEdits.set(field, { value, original });
    return { state: { ...state, rootEdits }, key };
  }

  if (key === goodsKey(state)) {
    throw new Error(
      `${key} is the slot's own inventory row and cannot be edited field-by-field yet. ` +
        `Its name, summary and description are set in the craft panel, which writes them ` +
        `to the item text rather than to this row.`,
    );
  }

  const owned = ensureOwned(state, doc, key);
  const next = replaceClone(owned.state, owned.key, (c) => withOverride(c, field, value));
  return { state: next, key: owned.key };
}

export type CloneReach = {
  written: ReadonlySet<string>;
  parked: ReadonlySet<string>;
  unreachable: ReadonlySet<string>;
};

function floatingKeys(state: CraftState): string[] {
  return state.floating.map(
    (key) => cloneByKey(state, key)?.key ?? cloneOf(state, key)?.key ?? key,
  );
}

function outgoing(state: CraftState, key: string): DocValue[] {
  if (key === rootKey(state)) return [...state.rootEdits.values()].map((e) => e.value);
  return [...(cloneByKey(state, key)?.overrides.values() ?? [])];
}

function walkClones(state: CraftState, seeds: readonly string[]): Set<string> {
  const byId = new Map(state.clones.map((c) => [c.id, c]));
  const reached = new Set<string>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const key = queue.shift()!;
    for (const value of outgoing(state, key)) {
      if (value.type !== 'int') continue;
      const clone = byId.get(value.value);
      if (!clone || reached.has(clone.key)) continue;
      reached.add(clone.key);
      queue.push(clone.key);
    }
  }
  return reached;
}

export function cloneReach(state: CraftState): CloneReach {
  const written = walkClones(state, [rootKey(state)]);

  const parkedSeeds = floatingKeys(state).filter((k) => cloneByKey(state, k) !== undefined);
  const parked = new Set<string>();
  for (const key of parkedSeeds) if (!written.has(key)) parked.add(key);
  for (const key of walkClones(state, parkedSeeds)) if (!written.has(key)) parked.add(key);

  const unreachable = new Set(
    state.clones.map((c) => c.key).filter((k) => !written.has(k) && !parked.has(k)),
  );
  return { written, parked, unreachable };
}

export function buildCraftPatch(
  state: CraftState,
  slotDoc: SpellDocument,
  text: { name?: string; info?: string; caption?: string } = {},
  note: string | null = null,
): CraftPatch {
  const written = cloneReach(state).written;
  const rows: CraftRow[] = state.clones
    .filter((c) => written.has(c.key))
    .map((c) => ({
      table: c.table,
      cloneFrom: parseNodeKey(c.source).id,
      id: c.id,
      overrides: Object.fromEntries([...c.overrides].sort(([a], [b]) => a.localeCompare(b))),
    }));

  const edits: FieldEdit[] = [...state.rootEdits]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([field, e]) => ({
      node: rootKey(state),
      field,
      value: e.value,
      expected: e.original,
    }));

  return {
    schemaVersion: CRAFT_PATCH_SCHEMA_VERSION,
    base: slotDoc.source,
    targetId: state.targetId,
    note,
    name: text.name ?? null,
    info: text.info ?? null,
    caption: text.caption ?? null,
    rows,
    edits,
  };
}

export function craftPreview(
  state: CraftState,
  slotDoc: SpellDocument,
  donor: SpellDocument | null,
): SpellDocument {
  const root = nodeByKey(slotDoc, rootKey(state));
  if (!root) return slotDoc;

  const rootNode: DocNode = {
    ...root,
    fields: root.fields.map((f) => {
      const edit = state.rootEdits.get(f.name);
      return edit ? { ...f, value: edit.value } : f;
    }),
  };

  const byKey = new Map<string, DocNode>([[rootNode.key, rootNode]]);
  for (const n of slotDoc.nodes) if (!byKey.has(n.key)) byKey.set(n.key, n);

  for (const c of state.clones) {
    const src = donor ? nodeByKey(donor, c.source) : undefined;
    if (!src) continue;
    byKey.set(c.key, {
      ...src,
      key: c.key,
      id: c.id,
      name: src.name ? `${src.name} (copy)` : null,
      fields: src.fields.map((f) => {
        const o = c.overrides.get(f.name);
        return o ? { ...f, value: o } : f;
      }),
    });
  }

  const refKinds = referenceFields(donor ?? slotDoc);
  const candidates = [...byKey.values(), ...(donor?.nodes ?? [])];

  const edges: DocEdge[] = [];
  const seen = new Set<string>();
  const queue: string[] = [rootNode.key, ...floatingKeys(state)];
  while (queue.length > 0) {
    const key = queue.shift()!;
    if (seen.has(key)) continue;
    seen.add(key);
    const node = byKey.get(key) ?? (donor ? nodeByKey(donor, key) : undefined);
    if (!node) continue;
    byKey.set(key, node);

    const owned = key === rootNode.key || cloneByKey(state, key) !== undefined;
    if (owned && node.paramType) {
      for (const f of node.fields) {
        if (f.value.type !== 'int' || f.value.value <= 0) continue;
        const target = f.value.value;
        const kinds = refKinds.get(`${node.paramType} ${f.name}`);
        if (!kinds) continue;
        const child = candidates.find((n) => n.id === target && kinds.has(n.kind));
        if (!child || child.key === key) continue;
        edges.push({
          from: key,
          to: child.key,
          field: f.name,
          resolution: 'declared',
          castType: null,
          refCategory: null,
          consumeType: null,
        });
        queue.push(child.key);
      }
    } else if (donor) {
      for (const e of donor.edges) {
        if (e.from !== key) continue;
        edges.push(e);
        queue.push(e.to);
      }
    }
  }

  return {
    ...slotDoc,
    nodes: [...byKey.values()].filter((n) => seen.has(n.key) || n.kind === 'goods'),
    edges,
  };
}

export function adoptFxrCopy(
  state: CraftState,
  doc: SpellDocument,
  library: SpellDocument,
  slotDoc: SpellDocument,
  sourceKey: string,
  newId: number,
): { state: CraftState; library: SpellDocument; key: string } {
  const source = library.nodes.find((n) => n.key === sourceKey);
  const copy: DocNode = {
    key: `Fxr:${newId}`,
    kind: 'fxr',
    id: newId,
    name: source?.name ? `${source.name} (copy)` : `copy of ${sourceKey}`,
    status: 'resolved',
    statusDetail: null,
    paramType: null,
    table: null,
    castTypes: source?.castTypes ?? [],
    fields: [],
  };
  const withCopy: SpellDocument = { ...library, nodes: [...library.nodes, copy] };

  let next = state;
  for (const edge of doc.edges) {
    if (edge.to !== sourceKey || edge.resolution === 'idConvention') continue;
    const from = edge.from === rootKey(state) ? slotDoc : withCopy;
    next = editField(next, from, edge.from, edge.field, { type: 'int', value: newId }).state;
  }

  return { state: next, library: withCopy, key: copy.key };
}

export function craftPatchFileName(state: CraftState): string {
  return `craft-${state.targetId}.json`;
}
