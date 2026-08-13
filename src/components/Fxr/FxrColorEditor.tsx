
export function FxrColorEditor({
  color,
  onChange,
  disabled,
}: {
  color: string | null;
  onChange: (color: string | null) => void;
  disabled: boolean;
}) {
  return (
    <label className="fxr__control">
      <span>color</span>
      <input
        type="color"
        value={color ?? '#ffffff'}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="fxr__control-value">
        {color ?? <span className="muted">unchanged</span>}
      </span>
      {color !== null && (
        <button type="button" className="craft__stop" onClick={() => onChange(null)}>
          clear
        </button>
      )}
    </label>
  );
}
