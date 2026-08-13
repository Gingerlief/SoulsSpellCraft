
import { useCallback, useEffect, useState } from 'react';
import {
  isSupported as directoryPickerSupported,
  needsReconnect,
  pickDirectory,
  reconnectDirectory,
  restoreDirectory,
  type SpellSource,
} from '../lib/directory';
import type { SpellDocument, SpellIndexEntry } from '../spell-document';

export type DirectorySource = ReturnType<typeof useDirectorySource>;

export function useDirectorySource({
  onLoad,
  onError,
}: {
  onLoad: (doc: SpellDocument) => void;
  onError: (message: string | null) => void;
}) {
  const [source, setSource] = useState<SpellSource | null>(null);
  const [showPicker, setShowPicker] = useState(true);
  const [reconnect, setReconnect] = useState(false);
  const canPick = directoryPickerSupported();

  useEffect(() => {
    if (!canPick) return;
    void (async () => {
      const restored = await restoreDirectory();
      if (restored) setSource(restored);
      else setReconnect(await needsReconnect());
    })();
  }, [canPick]);

  const open = useCallback(async () => {
    try {
      setSource(await pickDirectory());
      setShowPicker(true);
      setReconnect(false);
      onError(null);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      onError(e instanceof Error ? e.message : String(e));
    }
  }, [onError]);

  const doReconnect = useCallback(async () => {
    const restored = await reconnectDirectory();
    if (restored) {
      setSource(restored);
      setReconnect(false);
    }
  }, []);

  const pickSpell = useCallback(
    async (entry: SpellIndexEntry) => {
      if (!source) return;
      try {
        onLoad(await source.load(entry));
      } catch (e) {
        onError(`${entry.file}: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [source, onLoad, onError],
  );

  return {
    source,
    canPick,
    needsReconnect: reconnect,
    showPicker,
    setShowPicker,
    open,
    reconnect: doReconnect,
    pickSpell,
  };
}
