
export function FxrScaleEditor({
  scale,
  onChange,
  disabled,
  effective,
}: {
  scale: number;
  onChange: (scale: number) => void;
  disabled: boolean;
  effective: boolean;
}) {
  return (
    <>
      <label className="fxr__control">
        <span>Scale</span>
        <input
          type="number"
          min="0.01"
          step="0.05"
          value={scale}
          disabled={disabled}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next) && next > 0) onChange(next);
          }}
        />
        <span className="fxr__control-value">×{scale}</span>
        {scale !== 1 && (
          <button type="button" className="craft__stop" onClick={() => onChange(1)}>
            reset
          </button>
        )}
      </label>
      {!effective && scale !== 1 && (
        <p className="craft__hint">
          This effect has no scaling properties, so the size will not change. Emitters that
          exist mainly to point at another effect are usually like this — try scaling the one
          they point at.
        </p>
      )}
    </>
  );
}
