
import {
  parseSpellDocument,
  parseSpellIndex,
  type SpellDocument,
  type SpellIndex,
  type SpellIndexEntry,
} from '../spell-document';

const INDEX_FILE = 'index.json';
const DB_NAME = 'SoulsSpellCraft';
const STORE = 'handles';
const HANDLE_KEY = 'export-dir';

export type SpellSource = {
  name: string;
  index: SpellIndex;
  load: (entry: SpellIndexEntry) => Promise<SpellDocument>;
};

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickDirectory(): Promise<SpellSource> {
  const handle = await window.showDirectoryPicker({ mode: 'read' });
  const source = await open(handle);
  await remember(handle).catch((e) => {
    console.warn('could not remember this folder; it will need re-picking after a reload', e);
  });
  return source;
}

export async function restoreDirectory(): Promise<SpellSource | null> {
  const handle = await recall();
  if (!handle) return null;
  if ((await handle.queryPermission({ mode: 'read' })) !== 'granted') return null;
  return open(handle).catch(() => null);
}

export async function needsReconnect(): Promise<boolean> {
  const handle = await recall();
  if (!handle) return false;
  return (await handle.queryPermission({ mode: 'read' })) !== 'granted';
}

export async function reconnectDirectory(): Promise<SpellSource | null> {
  const handle = await recall();
  if (!handle) return null;
  if ((await handle.requestPermission({ mode: 'read' })) !== 'granted') return null;
  return open(handle);
}

export async function forgetDirectory(): Promise<void> {
  await idb((store) => store.delete(HANDLE_KEY));
}

async function open(handle: FileSystemDirectoryHandle): Promise<SpellSource> {
  let text: string;
  try {
    text = await (await (await handle.getFileHandle(INDEX_FILE)).getFile()).text();
  } catch {
    throw new Error(
      `no ${INDEX_FILE} in "${handle.name}". Point at a directory written by ` +
        `\`xtask spell export --all\`.`,
    );
  }
  const index = parseSpellIndex(text);

  return {
    name: handle.name,
    index,
    async load(entry) {
      const file = await (await handle.getFileHandle(entry.file)).getFile();
      return parseSpellDocument(await file.text());
    },
  };
}


async function remember(handle: FileSystemDirectoryHandle): Promise<void> {
  await idb((store) => store.put(handle, HANDLE_KEY));
}

async function recall(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await idb((store) => store.get(HANDLE_KEY))) ?? null;
  } catch {
    return null;
  }
}

function idb<T>(op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
    req.onsuccess = () => {
      const db = req.result;
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE, 'readwrite');
        const request = op(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (e) {
        db.close();
        reject(e);
        return;
      }
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      tx.oncomplete = () => db.close();
    };
  });
}


export function searchSpells(
  spells: SpellIndexEntry[],
  query: string,
  filters: { onlyWithIssues?: boolean } = {},
): SpellIndexEntry[] {
  const q = query.trim().toLowerCase();
  return spells.filter((s) => {
    if (filters.onlyWithIssues && s.diagnosticCount === 0 && s.unresolvedNodeCount === 0) {
      return false;
    }
    if (!q) return true;
    return (
      String(s.magicId).includes(q) ||
      (s.name?.toLowerCase().includes(q) ?? false) ||
      s.classifications.some((c) => c.toLowerCase().includes(q))
    );
  });
}
