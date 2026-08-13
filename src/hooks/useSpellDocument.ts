
import { useCallback, useMemo, useState } from 'react';
import { useEdgesState, useNodesState, type Edge } from '@xyflow/react';
import { buildFlow, type SpellFlowNode } from '../lib/layout';
import { parseSpellDocument, type SpellDocument } from '../spell-document';

const EXAMPLE = '4000.json';

export type SpellDocumentState = ReturnType<typeof useSpellDocument>;

export function useSpellDocument() {
  const [doc, setDoc] = useState<SpellDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<SpellFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const show = useCallback(
    (parsed: SpellDocument) => {
      const flow = buildFlow(parsed);
      setDoc(parsed);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setSelected(null);
      setError(null);
    },
    [setNodes, setEdges],
  );

  const loadText = useCallback(
    (text: string, label: string) => {
      try {
        show(parseSpellDocument(text));
      } catch (e) {
        setError(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [show],
  );

  const loadFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      loadText(await file.text(), file.name);
    },
    [loadText],
  );

  const loadExample = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}spells/${EXAMPLE}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      loadText(await res.text(), EXAMPLE);
    } catch (e) {
      setError(`${EXAMPLE}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [loadText]);

  const selectedNode = useMemo(
    () => doc?.nodes.find((n) => n.key === selected) ?? null,
    [doc, selected],
  );

  return {
    doc,
    nodes,
    edges,
    error,
    selected,
    selectedNode,
    setSelected,
    setError,
    onNodesChange,
    onEdgesChange,
    show,
    loadText,
    loadFiles,
    loadExample,
  };
}
