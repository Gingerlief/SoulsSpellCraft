
import { useCallback, useEffect } from 'react';
import { craftPreview, mergeDocuments, type CraftState } from '../lib/craft';
import {
  deserialiseCraft,
  saveCraft,
  staleness,
  type CraftText,
  type SavedCraft,
} from '../lib/craft-storage';
import { fetchSpell } from '../lib/engine';
import type { SpellDocument } from '../spell-document';

export type ResumedCraft = {
  state: CraftState;
  slotDoc: SpellDocument;
  library: SpellDocument;
  donors: number[];
  donor: SpellDocument | null;
  text: CraftText;
};

export function useCraftStorage({
  craft,
  slotDoc,
  donors,
  text,
  onResumed,
  onError,
  show,
}: {
  craft: CraftState | null;
  slotDoc: SpellDocument | null;
  donors: number[];
  text: CraftText;
  onResumed: (resumed: ResumedCraft) => void;
  onError: (message: string | null) => void;
  show: (doc: SpellDocument) => void;
}) {
  useEffect(() => {
    if (!craft || !slotDoc) return;
    saveCraft({
      targetId: craft.targetId,
      state: craft,
      donors,
      text,
      regulationSha256: slotDoc.source.regulationSha256,
    });
  }, [craft, slotDoc, donors, text]);

  const resume = useCallback(
    async (saved: SavedCraft): Promise<boolean> => {
      onError(null);
      try {
        const loadedSlot = await fetchSpell(saved.targetId);
        const stale = staleness(saved, loadedSlot);
        if (stale) {
          onError(stale);
          return false;
        }

        let rebuilt = loadedSlot;
        let lastDonor: SpellDocument | null = null;
        for (const id of saved.donors) {
          try {
            lastDonor = await fetchSpell(id);
          } catch (e) {
            throw new Error(
              `spell ${id} is part of this craft but could not be loaded, so resuming would ` +
                `draw a graph missing rows the craft still writes: ` +
                `${e instanceof Error ? e.message : String(e)}`,
            );
          }
          rebuilt = mergeDocuments(rebuilt, lastDonor);
        }

        const state = deserialiseCraft(saved.state);
        onResumed({
          state,
          slotDoc: loadedSlot,
          library: rebuilt,
          donors: saved.donors,
          donor: lastDonor,
          text: saved.text,
        });
        show(craftPreview(state, loadedSlot, rebuilt));
        return true;
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [onResumed, onError, show],
  );

  return { resume };
}
