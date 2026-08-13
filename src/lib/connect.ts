
import { groupForKind } from './reference';
import type { DocNode, LinkFields, SpellDocument } from '../spell-document';

export const GROUP_LABELS: { key: keyof LinkFields; label: string }[] = [
  { key: 'atk', label: 'Attack' },
  { key: 'bullet', label: 'Bullet' },
  { key: 'spEffect', label: 'Special effect' },
  { key: 'spEffectVfx', label: 'Effect VFX' },
  { key: 'sfx', label: 'Visual (FXR)' },
  { key: 'uncategorized', label: 'Other references' },
];

export type ConnectOption = {
  field: string;
  group: keyof LinkFields;
  current: number | null;
  enabled: boolean;
  matches: boolean;
  note?: string;
};

function intField(node: DocNode, field: string): number | null {
  const v = node.fields.find((f) => f.name === field)?.value;
  return v && v.type === 'int' ? v.value : null;
}

export function connectOptions(
  doc: SpellDocument,
  parent: DocNode,
  childKind: string,
): ConnectOption[] {
  const catalogue = parent.paramType ? doc.linkFields[parent.paramType] : undefined;
  if (!catalogue) return [];

  const wanted = groupForKind(childKind);
  const options: ConnectOption[] = [];

  for (const { key } of GROUP_LABELS) {
    for (const field of catalogue[key]) {
      const matches = key === wanted;
      const barred = key === 'uncategorized';
      options.push({
        field,
        group: key,
        current: intField(parent, field),
        enabled: !barred,
        matches,
        note: barred
          ? 'references something this editor does not model as a node'
          : matches
            ? undefined
            : `normally takes a ${key} reference, not a ${childKind}`,
      });
    }
  }
  return options;
}

export function matchingOptions(
  doc: SpellDocument,
  parent: DocNode,
  childKind: string,
): ConnectOption[] {
  return connectOptions(doc, parent, childKind).filter((o) => o.matches && o.enabled);
}

export function suggestedField(
  doc: SpellDocument,
  parent: DocNode,
  childKind: string,
): string | null {
  const options = matchingOptions(doc, parent, childKind);
  if (options.length === 0) return null;
  const free = options.find((o) => o.current === null || o.current <= 0);
  return (free ?? options[0]).field;
}
