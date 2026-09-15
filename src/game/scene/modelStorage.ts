// IndexedDB storage for optional GLB swaps (yacht, nv4, ghost).
// Keys share one object store; each model has its own blob URL cache.

const DB_NAME = 'codv';
const STORE = 'glb';
const DB_VERSION = 1;

export type ModelKey = 'yacht' | 'nv4' | 'ghost';

const cached: Partial<Record<ModelKey, string | null>> = {};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function revoke(key: ModelKey) {
  const u = cached[key];
  if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
  cached[key] = null;
}

export async function idbGetModel(key: ModelKey): Promise<Blob | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function idbSetModel(key: ModelKey, blob: Blob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  revoke(key);
}

export async function idbClearModel(key: ModelKey): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
  revoke(key);
}

export async function resolveModelUrl(key: ModelKey): Promise<string> {
  if (cached[key]) return cached[key]!;
  const blob = await idbGetModel(key);
  cached[key] = blob
    ? URL.createObjectURL(blob)
    : `${import.meta.env.BASE_URL}models/${key}.glb`;
  return cached[key]!;
}

export function invalidateModelCache(key: ModelKey): void {
  revoke(key);
}

export const idbGetYacht = () => idbGetModel('yacht');
export const idbSetYacht = (b: Blob) => idbSetModel('yacht', b);
export const idbClearYacht = () => idbClearModel('yacht');
export const resolveYachtUrl = () => resolveModelUrl('yacht');
export const invalidateYachtCache = () => invalidateModelCache('yacht');

export const idbGetNv4 = () => idbGetModel('nv4');
export const idbSetNv4 = (b: Blob) => idbSetModel('nv4', b);
export const idbClearNv4 = () => idbClearModel('nv4');
export const resolveNv4Url = () => resolveModelUrl('nv4');
export const invalidateNv4Cache = () => invalidateModelCache('nv4');

export const idbGetGhost = () => idbGetModel('ghost');
export const idbSetGhost = (b: Blob) => idbSetModel('ghost', b);
export const idbClearGhost = () => idbClearModel('ghost');
export const resolveGhostUrl = () => resolveModelUrl('ghost');
export const invalidateGhostCache = () => invalidateModelCache('ghost');
