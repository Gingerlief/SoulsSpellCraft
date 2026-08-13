
import { useCallback, useEffect, useState } from 'react';
import { FxrColorEditor } from './FxrColorEditor';
import { FxrScaleEditor } from './FxrScaleEditor';
import { applyEdits, derivedFxrId, hasFxrEdits, NO_FXR_EDITS, type FxrEdits } from '../../lib/fxr-edit';
import { fetchFxrBytes, writeFxrBytes } from '../../lib/engine';

const ID_ATTEMPTS = 32;

export function FxrEditor({
  sourceId,
  targetId,
  onCopied,
}: {
  sourceId: number;
  targetId: number;
  onCopied: (newId: number, path: string) => void;
}) {
  const [original, setOriginal] = useState<ArrayBuffer | null>(null);
  const [edits, setEdits] = useState<FxrEdits>(NO_FXR_EDITS);
  const [scaleWorks, setScaleWorks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: number; path: string } | null>(null);

  useEffect(() => {
    let live = true;
    setOriginal(null);
    setEdits(NO_FXR_EDITS);
    setError(null);
    setSaved(null);
    void fetchFxrBytes(sourceId).then(async (bytes) => {
      if (!live) return;
      setOriginal(bytes);
      if (!bytes) return;
      try {
        const plain = await applyEdits(bytes, NO_FXR_EDITS);
        const scaled = await applyEdits(bytes, { color: null, scale: 4 });
        if (live) setScaleWorks(plain.byteLength !== scaled.byteLength || !sameBytes(plain, scaled));
      } catch {
        if (live) setScaleWorks(true);
      }
    });
    return () => {
      live = false;
    };
  }, [sourceId]);

  const save = useCallback(async () => {
    if (!original) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await applyEdits(original, edits);
      for (let index = 0; index < ID_ATTEMPTS; index++) {
        const id = derivedFxrId(targetId, index);
        const result = await writeFxrBytes(id, bytes);
        if (result.ok) {
          setSaved({ id, path: result.path });
          onCopied(id, result.path);
          return;
        }
        if (!result.taken) {
          setError(result.detail);
          return;
        }
      }
      setError(`every id from ${derivedFxrId(targetId, 0)} onwards is taken`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [original, edits, targetId, onCopied]);

  if (original === null) {
    return <p className="craft__hint">Reading the effect…</p>;
  }

  return (
    <div className="fxr__editor">
      <FxrColorEditor
        color={edits.color}
        disabled={busy}
        onChange={(color) => setEdits((e) => ({ ...e, color }))}
      />
      <FxrScaleEditor
        scale={edits.scale}
        disabled={busy}
        effective={scaleWorks}
        onChange={(scale) => setEdits((e) => ({ ...e, scale }))}
      />

      <button
        type="button"
        className="craft__generate"
        disabled={busy || !hasFxrEdits(edits)}
        onClick={() => void save()}
      >
        {busy ? 'Writing…' : 'Save as a copy'}
      </button>

      {saved && (
        <p className="craft__hint">
          Written as <code>{saved.id}</code>, and whatever pointed at {sourceId} now points at
          it. Generate will pack the effect binder as well as applying the rows — a new sfx id
          is not reliably picked up as a loose file, so the game does not see this until the
          binder is rebuilt. That adds about two minutes.
        </p>
      )}
      {error && <pre className="craft__error">{error}</pre>}
    </div>
  );
}

function sameBytes(a: ArrayBuffer, b: ArrayBuffer): boolean {
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}
