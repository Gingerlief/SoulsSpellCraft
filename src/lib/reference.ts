
import type { DocValue, LinkFields, SpellDocument } from '../spell-document';

export const GROUP_FOR_KIND: Record<string, keyof LinkFields> = {
  atk: 'atk',
  bullet: 'bullet',
  spEffect: 'spEffect',
  spEffectVfx: 'spEffectVfx',
  fxr: 'sfx',
};

export function groupForKind(kind: string): keyof LinkFields | undefined {
  return GROUP_FOR_KIND[kind];
}

const KINDS_FOR_GROUP = new Map<string, string[]>();
for (const [kind, group] of Object.entries(GROUP_FOR_KIND)) {
  KINDS_FOR_GROUP.set(group, [...(KINDS_FOR_GROUP.get(group) ?? []), kind]);
}

export type ReferenceFields = ReadonlyMap<string, ReadonlySet<string>>;

export function referenceFields(doc: SpellDocument): ReferenceFields {
  const out = new Map<string, Set<string>>();
  const add = (paramType: string, field: string, kind: string) => {
    const key = `${paramType} ${field}`;
    const kinds = out.get(key) ?? new Set<string>();
    kinds.add(kind);
    out.set(key, kinds);
  };

  for (const [paramType, groups] of Object.entries(doc.linkFields)) {
    for (const [group, fields] of Object.entries(groups)) {
      for (const kind of KINDS_FOR_GROUP.get(group) ?? []) {
        for (const field of fields) add(paramType, field, kind);
      }
    }
  }

  const byKey = new Map(doc.nodes.map((n) => [n.key, n]));
  for (const edge of doc.edges) {
    if (edge.resolution === 'idConvention') continue;
    const from = byKey.get(edge.from);
    const to = byKey.get(edge.to);
    if (!from?.paramType || !to) continue;
    add(from.paramType, edge.field, to.kind);
  }

  return out;
}

export const FALLBACK_EMPTY = -1;

export function emptyValueFor(
  library: SpellDocument,
  paramType: string,
  field: string,
): DocValue {
  const counts = new Map<number, number>();
  for (const node of library.nodes) {
    if (node.paramType !== paramType) continue;
    const value = node.fields.find((f) => f.name === field)?.value;
    if (!value || value.type !== 'int' || value.value > 0) continue;
    counts.set(value.value, (counts.get(value.value) ?? 0) + 1);
  }

  let best = FALLBACK_EMPTY;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return { type: 'int', value: best };
}

export function targetsFor(
  library: SpellDocument,
  paramType: string,
  field: string,
): SpellDocument['nodes'] {
  const kinds = referenceFields(library).get(`${paramType} ${field}`);
  if (!kinds) return [];
  return library.nodes.filter((n) => kinds.has(n.kind));
}

export function isPointing(value: DocValue | undefined): boolean {
  return value !== undefined && value.type === 'int' && value.value > 0;
}
