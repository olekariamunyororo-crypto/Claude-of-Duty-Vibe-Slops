// Yacht resolution: IndexedDB upload → public/models/yacht.glb. Blob URLs are
// cached module-scope so useGLTF never re-parses per mount.
const DB_NAME = 'codv';
const STORE = 'glb';
let cached: string | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetYacht(): Promise<Blob | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get('yacht');
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

function revokeCached() {
  if (cached && cached.startsWith('blob:')) URL.revokeObjectURL(cached);
}

export async function idbSetYacht(blob: Blob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, 'yacht');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  revokeCached();
  cached = null;
}

export async function idbClearYacht(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete('yacht');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
  revokeCached();
  cached = null;
}

export async function resolveYachtUrl(): Promise<string> {
  if (cached) return cached;
  const blob = await idbGetYacht();
  cached = blob ? URL.createObjectURL(blob) : `${import.meta.env.BASE_URL}models/yacht.glb`;
  return cached;
}

export function invalidateYachtCache(): void {
  revokeCached();
  cached = null;
}
