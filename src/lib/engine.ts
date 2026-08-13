
import {
  parseSpellDocument,
  parseSpellIndex,
  type CraftPatch,
  type SpellDocument,
  type SpellIndex,
  type SpellPatch,
} from '../spell-document';

export type EngineStatus =
  | { kind: 'ready'; index: SpellIndex }
  | { kind: 'no-export'; detail: string }
  | { kind: 'absent' };

export async function probeEngine(): Promise<EngineStatus> {
  let res: Response;
  try {
    res = await fetch('/api/index');
  } catch {
    return { kind: 'absent' };
  }
  if (res.status === 404) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    return body.detail ? { kind: 'no-export', detail: body.detail } : { kind: 'absent' };
  }
  if (!res.ok) return { kind: 'absent' };
  try {
    return { kind: 'ready', index: parseSpellIndex(await res.text()) };
  } catch {
    return { kind: 'absent' };
  }
}

export async function fetchSpell(magicId: number): Promise<SpellDocument> {
  const res = await fetch(`/api/spell/${magicId}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `could not load spell ${magicId}`);
  }
  return parseSpellDocument(await res.text());
}

export type FxrLocation = {
  id: number;
  fileName: string;
  path: string | null;
  found: boolean;
  dirs: string[];
};

export async function fetchFxrLocation(sfxId: number): Promise<FxrLocation | null> {
  try {
    const res = await fetch(`/api/fxr/${sfxId}`);
    if (!res.ok) return null;
    return (await res.json()) as FxrLocation;
  } catch {
    return null;
  }
}

export async function fetchFxrBytes(sfxId: number): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`/api/fxr/${sfxId}/bytes`);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export type FxrWriteResult =
  | { ok: true; path: string }
  | { ok: false; taken: true; detail: string }
  | { ok: false; taken: false; detail: string };

export async function writeFxrBytes(
  sfxId: number,
  bytes: ArrayBuffer,
): Promise<FxrWriteResult> {
  let res: Response;
  try {
    res = await fetch(`/api/fxr/${sfxId}/bytes`, { method: 'POST', body: bytes });
  } catch (e) {
    return { ok: false, taken: false, detail: e instanceof Error ? e.message : String(e) };
  }
  const body = (await res.json().catch(() => ({}))) as { path?: string; detail?: string; error?: string };
  if (res.ok) return { ok: true, path: body.path ?? '' };
  return {
    ok: false,
    taken: res.status === 409,
    detail: body.detail ?? body.error ?? `write failed (${res.status})`,
  };
}

export async function repackFxr(): Promise<ApplyResult> {
  return post('/api/fxr/repack', {});
}

export type ApplyResult = {
  ok: boolean;
  stale: boolean;
  output: string;
};

export async function applyPatch(patch: SpellPatch): Promise<ApplyResult> {
  return post('/api/apply', patch);
}

export async function applyCraft(patch: CraftPatch): Promise<ApplyResult> {
  return post('/api/craft', patch);
}

async function post(url: string, body: unknown): Promise<ApplyResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => ({}))) as { output?: string; error?: string };
  return {
    ok: res.ok,
    stale: res.status === 409,
    output: parsed.output ?? parsed.error ?? `apply failed (${res.status})`,
  };
}

export async function fetchDummies(): Promise<number[]> {
  let res: Response;
  try {
    res = await fetch('/api/dummies');
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const body = (await res.json().catch(() => ({}))) as { slots?: unknown };
  return Array.isArray(body.slots) ? body.slots.filter((s): s is number => typeof s === 'number') : [];
}

export type CreateDummyResult =
  | { ok: true; slots: number[]; output: string; reexported: boolean }
  | { ok: false; output: string };

export async function createDummy(): Promise<CreateDummyResult> {
  let res: Response;
  try {
    res = await fetch('/api/dummies', { method: 'POST' });
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) };
  }
  const body = (await res.json().catch(() => ({}))) as {
    slots?: unknown;
    output?: string;
    error?: string;
    reexported?: boolean;
  };
  if (!res.ok) {
    return {
      ok: false,
      output: body.output ?? body.error ?? `could not add a slot (${res.status})`,
    };
  }
  return {
    ok: true,
    slots: Array.isArray(body.slots)
      ? body.slots.filter((s): s is number => typeof s === 'number')
      : [],
    output: body.output ?? '',
    reexported: body.reexported !== false,
  };
}
