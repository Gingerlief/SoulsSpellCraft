
export function EmptyState({
  canPickDirectory,
  needsReconnect: reconnect,
  onOpenFolder,
  onReconnect,
  onPick,
  onExample,
}: {
  canPickDirectory: boolean;
  needsReconnect: boolean;
  onOpenFolder: () => void;
  onReconnect: () => void;
  onPick: () => void;
  onExample: () => void;
}) {
  return (
    <div className="empty">
      <h2>Open an export folder</h2>
      <p>
        Run <code>bin/xtask.exe spell export --all</code>, then open that folder here to
        browse all 317 spells. Only the index is loaded up front; documents are read on click.
      </p>
      <p className="muted small">
        Documents are self-contained — every field label, edge meaning and spell name travels
        inside the file. This viewer never opens <code>regulation.bin</code>.
      </p>
      <div className="empty__actions">
        {reconnect ? (
          <button onClick={onReconnect}>Reconnect last folder</button>
        ) : (
          canPickDirectory && <button onClick={onOpenFolder}>Open export folder…</button>
        )}
        <button className="ghost" onClick={onPick}>
          Open one document…
        </button>
        <button className="ghost" onClick={onExample}>
          Load example
        </button>
      </div>
      {!canPickDirectory && (
        <p className="muted small">
          This browser has no File System Access API, so folder browsing is unavailable —
          drag a document in, or use Chrome or Edge.
        </p>
      )}
    </div>
  );
}
