
import { useCallback, useMemo, useState } from 'react';
import type { ApplyResult } from '../lib/engine';
import {
  buildPatch,
  editedNodes,
  patchFileName,
  withEdit,
  withoutEdit,
  type EditMap,
} from '../lib/edits';
import type { DocValue, SpellDocument, SpellPatch } from '../spell-document';

export type SpellEdits = ReturnType<typeof useSpellEdits>;

export function useSpellEdits(
  doc: SpellDocument | null,
  apply: (patch: SpellPatch, about: string) => Promise<ApplyResult>,
) {
  const [edits, setEdits] = useState<EditMap>(new Map());

  const [lastDoc, setLastDoc] = useState(doc);
  if (doc !== lastDoc) {
    setLastDoc(doc);
    setEdits(new Map());
  }

  const edit = useCallback(
    (node: string, field: string, original: DocValue, value: DocValue) =>
      setEdits((prev) => withEdit(prev, node, field, original, value)),
    [],
  );

  const revert = useCallback(
    (node: string, field: string) => setEdits((prev) => withoutEdit(prev, node, field)),
    [],
  );

  const clear = useCallback(() => setEdits(new Map()), []);

  const dirtyNodes = useMemo(() => editedNodes(edits), [edits]);

  const download = useCallback(() => {
    if (!doc || edits.size === 0) return;
    const patch = buildPatch(doc, edits, `${doc.spell.name ?? doc.spell.magicId}`);
    const blob = new Blob([JSON.stringify(patch, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = patchFileName(doc);
    a.click();
    URL.revokeObjectURL(url);
  }, [doc, edits]);

  const save = useCallback(async () => {
    if (!doc || edits.size === 0) return;
    const result = await apply(
      buildPatch(doc, edits, doc.spell.name ?? null),
      doc.spell.name ?? `Magic ${doc.spell.magicId}`,
    );
    if (result.ok) setEdits(new Map());
  }, [doc, edits, apply]);

  return { edits, dirtyNodes, edit, revert, clear, download, save };
}
