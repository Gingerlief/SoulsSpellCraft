
import { useCallback, useState } from 'react';
import {
  craftPreview,
  isFloating,
  isOwned,
  mergeDocuments,
  newCraft,
  rootKey,
  type CraftState,
} from '../lib/craft';
import { discardSaved, type CraftText } from '../lib/craft-storage';
import { canDetach } from '../lib/detach';
import { fetchSpell, type ApplyResult } from '../lib/engine';
import {
  NO_HISTORY,
  record,
  redo as redoHistory,
  undo as undoHistory,
  type History,
} from '../lib/history';
import type { CraftRole } from '../lib/layout';
import { useCraftGenerate } from './useCraftGenerate';
import { useCraftMutations } from './useCraftMutations';
import { useCraftStorage, type ResumedCraft } from './useCraftStorage';
import type { SpellDocument } from '../spell-document';

const NO_TEXT: CraftText = { name: '', info: '', caption: '' };

export type Craft = ReturnType<typeof useCraft>;

export function useCraft({
  doc,
  show,
  setSelected,
  closeMenus,
}: {
  doc: SpellDocument | null;
  show: (doc: SpellDocument) => void;
  setSelected: (key: string | null) => void;
  closeMenus: () => void;
}) {
  const [craft, setCraft] = useState<CraftState | null>(null);
  const [history, setHistory] = useState<History<CraftState>>(NO_HISTORY);
  const [slotDoc, setSlotDoc] = useState<SpellDocument | null>(null);
  const [text, setText] = useState<CraftText>(NO_TEXT);
  const [wroteFxr, setWroteFxr] = useState(false);
  const [donor, setDonor] = useState<SpellDocument | null>(null);
  const [library, setLibrary] = useState<SpellDocument | null>(null);
  const [donors, setDonors] = useState<number[]>([]);
  const [result, setResult] = useState<ApplyResult | null>(null);

  const apply = useCallback(
    (next: CraftState, select?: string, resolveWith?: SpellDocument) => {
      setCraft(next);
      if (select !== undefined) setSelected(select);
      const resolvable = resolveWith ?? library ?? doc;
      if (slotDoc && resolvable) show(craftPreview(next, slotDoc, resolvable));
    },
    [slotDoc, library, doc, show, setSelected],
  );

  const commit = useCallback(
    (next: CraftState, select?: string, resolveWith?: SpellDocument) => {
      if (craft && next !== craft) setHistory((h) => record(h, craft));
      apply(next, select, resolveWith);
    },
    [craft, apply],
  );

  const docFor = useCallback(
    (key: string): SpellDocument | null =>
      craft && key === rootKey(craft) ? (slotDoc ?? doc) : doc,
    [craft, slotDoc, doc],
  );

  const mutations = useCraftMutations({
    craft,
    doc,
    slotDoc,
    library,
    commit,
    docFor,
    setLibrary,
    onFxrWritten: useCallback(() => setWroteFxr(true), []),
  });
  const { setDropError, cancelConnection } = mutations;

  const undo = useCallback(() => {
    if (!craft) return;
    const stepped = undoHistory(history, craft);
    if (!stepped) return;
    setHistory(stepped.history);
    apply(stepped.value);
    closeMenus();
  }, [craft, history, apply, closeMenus]);

  const redo = useCallback(() => {
    if (!craft) return;
    const stepped = redoHistory(history, craft);
    if (!stepped) return;
    setHistory(stepped.history);
    apply(stepped.value);
    closeMenus();
  }, [craft, history, apply, closeMenus]);

  const start = useCallback(
    (targetId: number, loadedSlotDoc: SpellDocument) => {
      setCraft(newCraft(targetId));
      setWroteFxr(false);
      setHistory(NO_HISTORY);
      setResult(null);
      setLibrary((prev) => (prev ? mergeDocuments(prev, loadedSlotDoc) : loadedSlotDoc));
      setDonors([]);
      show(loadedSlotDoc);
    },
    [show],
  );

  const stop = useCallback(() => {
    if (craft) discardSaved(craft.targetId);
    setCraft(null);
    setHistory(NO_HISTORY);
    setWroteFxr(false);
    setSlotDoc(null);
    setLibrary(null);
    setDonor(null);
    setDonors([]);
    setResult(null);
    cancelConnection();
    setText(NO_TEXT);
  }, [craft, cancelConnection]);

  const onResumed = useCallback((r: ResumedCraft) => {
    setSlotDoc(r.slotDoc);
    setLibrary(r.library);
    setDonors(r.donors);
    setDonor(r.donor);
    setText(r.text);
    setHistory(NO_HISTORY);
    setResult(null);
    setCraft(r.state);
  }, []);

  const { resume } = useCraftStorage({
    craft,
    slotDoc,
    donors,
    text,
    onResumed,
    onError: setDropError,
    show,
  });

  const engine = useCraftGenerate({ craft, slotDoc, text, wroteFxr, stop, show, setResult });

  const pickDonor = useCallback(
    async (magicId: number) => {
      try {
        const loaded = await fetchSpell(magicId);
        setDonor(loaded);
        setLibrary((prev) => (prev ? mergeDocuments(prev, loaded) : loaded));
        setDonors((prev) => (prev.includes(magicId) ? prev : [...prev, magicId]));
        setDropError(null);
      } catch (e) {
        setDropError(e instanceof Error ? e.message : String(e));
      }
    },
    [setDropError],
  );

  const roleOf = useCallback(
    (key: string): CraftRole | undefined =>
      !craft
        ? undefined
        : isOwned(craft, key)
          ? 'owned'
          : isFloating(craft, key)
            ? 'floating'
            : 'referenced',
    [craft],
  );

  const statusOf = useCallback(
    (key: string) => ({
      owned: craft ? isOwned(craft, key) : false,
      detachable: craft && doc ? canDetach(craft, doc, key) : false,
      floating: craft ? isFloating(craft, key) : false,
    }),
    [craft, doc],
  );

  return {
    craft,
    slotDoc,
    setSlotDoc,
    text,
    setText,
    donor,
    setDonor,
    library,
    result,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo,
    redo,
    start,
    stop,
    resume,
    pickDonor,
    roleOf,
    statusOf,
    ...mutations,
    ...engine,
  };
}
