
import { useCallback, useState } from 'react';
import { buildCraftPatch, type CraftState } from '../lib/craft';
import { applyCraft, fetchSpell, repackFxr, type ApplyResult } from '../lib/engine';
import type { CraftText } from '../lib/craft-storage';
import type { SpellDocument } from '../spell-document';

export type GenerateStage = 'applying' | 'packing' | null;

export function useCraftGenerate({
  craft,
  slotDoc,
  text,
  wroteFxr,
  stop,
  show,
  setResult,
}: {
  craft: CraftState | null;
  slotDoc: SpellDocument | null;
  text: CraftText;
  wroteFxr: boolean;
  stop: () => void;
  show: (doc: SpellDocument) => void;
  setResult: (result: ApplyResult | null) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState<GenerateStage>(null);

  const generate = useCallback(async () => {
    if (!craft || !slotDoc) return;
    setGenerating(true);
    setStage('applying');
    setResult(null);
    try {
      const patch = buildCraftPatch(craft, slotDoc, {
        name: text.name || undefined,
        info: text.info || undefined,
        caption: text.caption || undefined,
      });
      const applied = await applyCraft(patch);

      if (applied.ok && wroteFxr) {
        setStage('packing');
        const packed = await repackFxr();
        if (!packed.ok) {
          setResult({
            ok: false,
            stale: false,
            output:
              `The craft was applied, but packing the effect binder failed, so any effect ` +
              `this craft created will not load in game. Run \`xtask fxr repack\` in the ` +
              `engine repo.\n\n${packed.output}`,
          });
          return;
        }
      }

      setResult(applied);
      if (applied.ok) {
        const target = craft.targetId;
        stop();
        try {
          show(await fetchSpell(target));
        } catch {
        }
      }
    } catch (e) {
      setResult({ ok: false, stale: false, output: e instanceof Error ? e.message : String(e) });
    } finally {
      setGenerating(false);
      setStage(null);
    }
  }, [craft, slotDoc, text, wroteFxr, stop, show, setResult]);

  return { generating, stage, generate };
}
