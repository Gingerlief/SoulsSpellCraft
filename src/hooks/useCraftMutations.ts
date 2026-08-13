
import { useCallback, useState } from 'react';
import type { PendingConnection } from '../components/Craft/ConnectMenu';
import type { NodeAction } from '../components/Craft/NodeMenu';
import {
  addFloating,
  adoptFxrCopy,
  attachTo,
  editField,
  removeFloating,
  type CraftState,
} from '../lib/craft';
import { detachLink, detachNode } from '../lib/detach';
import { menuPosition } from '../lib/menu';
import type { DocNode, DocValue, SpellDocument } from '../spell-document';

export type MutationContext = {
  craft: CraftState | null;
  doc: SpellDocument | null;
  slotDoc: SpellDocument | null;
  library: SpellDocument | null;
  commit: (next: CraftState, select?: string, resolveWith?: SpellDocument) => void;
  docFor: (key: string) => SpellDocument | null;
  setLibrary: (doc: SpellDocument) => void;
  onFxrWritten: () => void;
};

export function useCraftMutations(ctx: MutationContext) {
  const { craft, doc, slotDoc, library, commit, docFor, setLibrary, onFxrWritten } = ctx;

  const [dropError, setDropError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingConnection | null>(null);

  const attempt = useCallback((op: () => void) => {
    setDropError(null);
    try {
      op();
    } catch (e) {
      setDropError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const edit = useCallback(
    (node: string, _original: DocValue, field: string, value: DocValue) => {
      const from = docFor(node);
      if (!from || !craft) return;
      attempt(() => {
        const next = editField(craft, from, node, field, value);
        commit(next.state, next.key);
      });
    },
    [craft, docFor, commit, attempt],
  );

  const dropNode = useCallback(
    (childKey: string, parentKey: string | null, at: { x: number; y: number }) => {
      if (!craft || !slotDoc || !library) return;
      setDropError(null);
      const child = library.nodes.find((n) => n.key === childKey);
      if (!child) {
        setDropError('could not identify what was dropped');
        return;
      }

      if (parentKey === null) {
        commit(addFloating(craft, childKey), childKey);
        return;
      }

      const parent =
        doc?.nodes.find((n) => n.key === parentKey) ??
        library.nodes.find((n) => n.key === parentKey);
      if (!parent) {
        setDropError('could not identify what it was dropped on');
        return;
      }
      setPending({ parent, childKey, childKind: child.kind, ...menuPosition(at) });
    },
    [craft, slotDoc, library, doc, commit],
  );

  const connect = useCallback(
    (sourceKey: string, targetKey: string, at: { x: number; y: number }) => {
      if (!craft || !doc) return;
      const parent = doc.nodes.find((n) => n.key === sourceKey);
      const child = doc.nodes.find((n) => n.key === targetKey);
      if (!parent || !child) return;
      setPending({ parent, childKey: child.key, childKind: child.kind, ...menuPosition(at) });
    },
    [craft, doc],
  );

  const resolveConnection = useCallback(
    (field: string) => {
      if (!pending || !craft || !slotDoc || !doc) return;
      setPending(null);
      attempt(() => {
        const attached = attachTo(
          craft,
          library ?? doc,
          slotDoc,
          pending.parent.key,
          field,
          pending.childKey,
        );
        commit(removeFloating(attached.state, pending.childKey), attached.key);
      });
    },
    [pending, craft, slotDoc, doc, library, commit, attempt],
  );

  const nodeAction = useCallback(
    (target: DocNode, action: Exclude<NodeAction, 'inspect'>) => {
      if (!craft || !slotDoc || !doc) return;
      attempt(() => {
        if (action === 'detach') {
          commit(addFloating(detachNode(craft, doc, library ?? doc, target.key), target.key));
        } else if (action === 'remove') {
          commit(removeFloating(craft, target.key));
        } else {
          const anchor = target.fields[0];
          if (!anchor) return;
          const next = editField(craft, doc, target.key, anchor.name, anchor.value);
          commit(next.state, next.key);
        }
      });
    },
    [craft, slotDoc, doc, library, commit, attempt],
  );

  const noteFxrCopy = useCallback(
    (sourceKey: string, newId: number) => {
      if (!craft || !doc) return;
      attempt(() => {
        const adopted = adoptFxrCopy(
          craft,
          doc,
          library ?? doc,
          slotDoc ?? doc,
          sourceKey,
          newId,
        );
        setLibrary(adopted.library);
        onFxrWritten();
        commit(adopted.state, adopted.key, adopted.library);
      });
    },
    [craft, doc, library, slotDoc, commit, setLibrary, onFxrWritten, attempt],
  );

  const cutLink = useCallback(
    (parentKey: string, field: string) => {
      if (!craft || !doc) return;
      attempt(() => commit(detachLink(craft, doc, library ?? doc, parentKey, field)));
    },
    [craft, doc, library, commit, attempt],
  );

  const repoint = useCallback(
    (parentKey: string, field: string, id: number) => {
      const from = docFor(parentKey);
      if (!craft || !from) return;
      attempt(() => {
        const next = editField(craft, from, parentKey, field, { type: 'int', value: id });
        commit(next.state, next.key);
      });
    },
    [craft, docFor, commit, attempt],
  );

  return {
    dropError,
    setDropError,
    pending,
    cancelConnection: useCallback(() => setPending(null), []),
    edit,
    dropNode,
    connect,
    resolveConnection,
    nodeAction,
    noteFxrCopy,
    cutLink,
    repoint,
  };
}
