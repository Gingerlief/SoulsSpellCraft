
import { useCallback, useEffect, useState } from 'react';
import {
  applyPatch,
  fetchSpell,
  probeEngine,
  type ApplyResult,
  type EngineStatus,
} from '../lib/engine';
import type { SpellDocument, SpellIndexEntry, SpellPatch } from '../spell-document';

export type SpellEngine = ReturnType<typeof useSpellEngine>;

export function useSpellEngine({
  onLoad,
  onError,
}: {
  onLoad: (doc: SpellDocument) => void;
  onError: (message: string | null) => void;
}) {
  const [status, setStatus] = useState<EngineStatus>({ kind: 'absent' });
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [appliedTo, setAppliedTo] = useState<string | null>(null);

  useEffect(() => {
    void probeEngine().then(setStatus);
  }, []);

  const apply = useCallback(async (patch: SpellPatch, about: string): Promise<ApplyResult> => {
    setApplying(true);
    setApplied(null);
    setAppliedTo(about);
    try {
      const result = await applyPatch(patch);
      setApplied(result);
      return result;
    } catch (e) {
      const result = {
        ok: false,
        stale: false,
        output: e instanceof Error ? e.message : String(e),
      };
      setApplied(result);
      return result;
    } finally {
      setApplying(false);
    }
  }, []);

  const pickSpell = useCallback(
    async (entry: SpellIndexEntry) => {
      try {
        onLoad(await fetchSpell(entry.magicId));
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    },
    [onLoad, onError],
  );

  return {
    status,
    ready: status.kind === 'ready',
    spells: status.kind === 'ready' ? status.index.spells : null,
    applying,
    applied,
    appliedTo,
    apply,
    pickSpell,
    dismissApplied: useCallback(() => setApplied(null), []),
  };
}
