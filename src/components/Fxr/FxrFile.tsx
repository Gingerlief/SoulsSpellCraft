
import { useEffect, useState } from 'react';
import { FxrEditor } from './FxrEditor';
import { fetchFxrLocation, type FxrLocation } from '../../lib/engine';
import type { CraftState } from '../../lib/craft';
import type { DocNode } from '../../spell-document';

const PLAYGROUND = 'https://fxr-playground.pages.dev/';

export function FxrFile({
  node,
  craft,
  onCopied,
}: {
  node: DocNode;
  craft: CraftState | null;
  onCopied?: (sourceKey: string, newId: number) => void;
}) {
  const [location, setLocation] = useState<FxrLocation | null | 'loading'>('loading');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setLocation('loading');
    setCopied(false);
    void fetchFxrLocation(node.id).then((l) => {
      if (live) setLocation(l);
    });
    return () => {
      live = false;
    };
  }, [node.id]);

  if (location === 'loading') {
    return (
      <section className="inspector__fxr">
        <h3>Effect file</h3>
        <p className="muted">Looking for it…</p>
      </section>
    );
  }

  if (location === null) {
    return (
      <section className="inspector__fxr">
        <h3>Effect file</h3>
        <p className="muted">
          Run <code>npm run dev</code> to resolve where this effect lives on disk.
        </p>
      </section>
    );
  }

  return (
    <section className="inspector__fxr">
      <h3>Effect file</h3>

      {location.found && location.path ? (
        <>
          <code className="fxr__path">{location.path}</code>
          <div className="fxr__actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(location.path!).then(() => setCopied(true));
              }}
            >
              {copied ? 'copied' : 'copy path'}
            </button>
            <a className="ghost" href={PLAYGROUND} target="_blank" rel="noreferrer noopener">
              open FXR Playground ↗
            </a>
          </div>
          {craft ? (
            <FxrEditor
              sourceId={node.id}
              targetId={craft.targetId}
              onCopied={(newId) => onCopied?.(node.key, newId)}
            />
          ) : (
            <p className="craft__hint">
              Start a craft to recolor or resize this effect — editing one copies it, and the
              copy's id comes from the slot being built into.
            </p>
          )}

          <p className="craft__hint">
            For anything past color and size, open the file above in
            <a href={PLAYGROUND} target="_blank" rel="noreferrer noopener">
              {' '}
              FXR Playground
            </a>
            , which understands the whole format.
          </p>
        </>
      ) : (
        <>
          <p className="inspector__status">
            <strong>{location.fileName}</strong> is in none of the unpacked effect
            directories.
          </p>
          <ul className="fxr__dirs">
            {location.dirs.map((d) => (
              <li key={d}>
                <code>{d}</code>
              </li>
            ))}
          </ul>
          {location.dirs.length === 0 && (
            <p className="craft__hint">
              No effect directories are configured at all. Unpack the sfx binders into
              <code>launch/patched/sfx/</code> in the engine repo, or set
              <code>SFX_DIRS</code>.
            </p>
          )}
        </>
      )}
    </section>
  );
}
