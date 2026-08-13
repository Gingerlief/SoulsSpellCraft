import { useEffect, useRef, useState } from 'react';
import type { DocValue } from '../spell-document';
import { isEditable, parseLike, toInputText } from '../lib/edits';

export function FieldValue({
  original,
  current,
  onCommit,
  onRevert,
}: {
  original: DocValue;
  current: DocValue;
  onCommit: (value: DocValue) => void;
  onRevert: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const dirty = current !== original;

  if (!isEditable(original)) {
    return (
      <span className="value value--locked" title="Byte fields cannot be edited">
        {display(current)}
      </span>
    );
  }

  if (!editing) {
    return (
      <span className="value-cell">
        <button
          className={`value ${dirty ? 'value--dirty' : ''}`}
          onClick={() => {
            setText(toInputText(current));
            setError(null);
            setEditing(true);
          }}
          title={dirty ? `was ${display(original)} — click to edit` : 'click to edit'}
        >
          {display(current)}
        </button>
        {dirty && (
          <button className="value__revert" onClick={onRevert} title="Revert to original">
            ↩
          </button>
        )}
      </span>
    );
  }

  const commit = () => {
    const parsed = parseLike(original, text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onCommit(parsed.value);
    setEditing(false);
    setError(null);
  };

  return (
    <span className="value-cell">
      <input
        ref={input}
        className={`value__input ${error ? 'value__input--bad' : ''}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setEditing(false);
            setError(null);
          }
        }}
        onBlur={commit}
        aria-label="field value"
      />
      {error && <span className="value__error">{error}</span>}
    </span>
  );
}

function display(v: DocValue): string {
  switch (v.type) {
    case 'int':
      return String(v.value);
    case 'float':
    case 'double':
      return Number.isInteger(v.value) ? v.value.toFixed(1) : String(v.value);
    case 'str':
      return v.value === '' ? '""' : v.value;
    case 'bytes':
      return `0x${v.value}`;
  }
}
