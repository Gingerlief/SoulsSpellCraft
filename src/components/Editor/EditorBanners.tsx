
import type { ApplyResult } from '../../lib/engine';

export function EditorBanners({
  error,
  applying,
  applied,
  appliedTo,
  onDismissApplied,
}: {
  error: string | null;
  applying: boolean;
  applied: ApplyResult | null;
  appliedTo: string | null;
  onDismissApplied: () => void;
}) {
  return (
    <>
      {error && <p className="banner banner--error">{error}</p>}

      {applying && (
        <p className="banner banner--busy">
          Re-encoding regulation.bin{appliedTo ? ` for ${appliedTo}` : ''} — this takes a
          couple of minutes at the compression level the source declares. The source
          regulation is not touched.
        </p>
      )}

      {applied && !applying && (
        <div className={`banner ${applied.ok ? 'banner--ok' : 'banner--error'}`}>
          <button className="banner__close" onClick={onDismissApplied}>
            ✕
          </button>
          <strong>
            {applied.ok
              ? 'regulation.bin written'
              : applied.stale
                ? 'Patch refused — the base moved'
                : 'Apply failed'}
            {/* The subject, because this banner survives opening another spell. Without it
                a success message reads as being about whatever is on screen now. */}
            {appliedTo && <span className="muted"> · {appliedTo}</span>}
          </strong>
          <pre className="banner__output">{applied.output}</pre>
          {applied.ok && (
            <span className="muted small">
              Launch with: me3 launch --auto-detect -p launch/launch_er_patched.me3
            </span>
          )}
        </div>
      )}
    </>
  );
}
