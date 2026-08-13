
export type FxrEdits = {
  color: string | null;
  scale: number;
};

export const NO_FXR_EDITS: FxrEdits = { color: null, scale: 1 };

export function hasFxrEdits(edits: FxrEdits): boolean {
  return edits.color !== null || edits.scale !== 1;
}

async function lib() {
  return import('@cccode/fxr');
}

export async function applyEdits(original: ArrayBuffer, edits: FxrEdits): Promise<ArrayBuffer> {
  const { FXR, Game, Recolor, hex } = await lib();
  const fxr = FXR.read(original);

  if (edits.color !== null) {
    const digits = edits.color.replace(/^#/, '');
    fxr.root.recolor(Recolor.replace(hex`${digits}`));
  }
  if (edits.scale !== 1) {
    fxr.root.scale(edits.scale);
  }

  return fxr.toArrayBuffer(Game.EldenRing);
}

export function derivedFxrId(targetId: number, index: number): number {
  return targetId * 100_000 + index;
}
