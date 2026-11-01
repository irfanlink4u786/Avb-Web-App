import type { SheetPayload } from "./types";

// Local-first, user-scoped IndexedDB. Supabase is contacted only by explicit Sync Data.
const AVB_DB_NAME = "cell-avb-offline-v1";
const AVB_STORE = "snapshots";
type AvbSnapshot = { key: string; payload: SheetPayload; syncedAt: string };
const avbUserScope = (): string => {
  try { const s = JSON.parse(sessionStorage.getItem("cell_avb_supabase_session") || "null"); return String(s?.user?.id || "unknown"); }
  catch { return "unknown"; }
};
const avbCacheKey = (name: string): string => `${avbUserScope()}:${name}`;
function openAvbDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(AVB_DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(AVB_STORE)) req.result.createObjectStore(AVB_STORE, { keyPath: "key" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB unavailable"));
  });
}
export async function readAvbCache(name: string): Promise<AvbSnapshot | null> {
  const db = await openAvbDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AVB_STORE, "readonly");
    const req = tx.objectStore(AVB_STORE).get(avbCacheKey(name));
    req.onsuccess = () => resolve((req.result as AvbSnapshot | undefined) || null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
export async function saveAvbCaches(entries: Array<{ name: string; payload: SheetPayload }>): Promise<void> {
  const db = await openAvbDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AVB_STORE, "readwrite");
    const syncedAt = new Date().toISOString();
    for (const entry of entries) tx.objectStore(AVB_STORE).put({ key: avbCacheKey(entry.name), payload: entry.payload, syncedAt } as AvbSnapshot);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

