
import { useCallback, useState } from 'react';
import type { DocNode, SpellDocument } from '../spell-document';

export type MenuTarget =
  | { kind: 'node'; node: DocNode; x: number; y: number }
  | { kind: 'edge'; from: string; to: string; x: number; y: number };

export type NodeTarget = Extract<MenuTarget, { kind: 'node' }>;
export type EdgeTarget = Extract<MenuTarget, { kind: 'edge' }>;

export function useCanvasInteraction(doc: SpellDocument | null) {
  const [target, setTarget] = useState<MenuTarget | null>(null);

  const openNodeMenu = useCallback(
    (key: string, at: { x: number; y: number }) => {
      const found = doc?.nodes.find((n) => n.key === key);
      if (found) setTarget({ kind: 'node', node: found, ...at });
    },
    [doc],
  );

  const openEdgeMenu = useCallback(
    (from: string, to: string, at: { x: number; y: number }) =>
      setTarget({ kind: 'edge', from, to, ...at }),
    [],
  );

  const closeMenu = useCallback(() => setTarget(null), []);

  return { target, openNodeMenu, openEdgeMenu, closeMenu };
}
