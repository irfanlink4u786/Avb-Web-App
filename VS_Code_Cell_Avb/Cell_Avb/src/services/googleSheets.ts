// Optimized Google Sheets service: metadata cache, bounded concurrency, and request reuse.
export type { SheetPayload } from "../types";
import type { SheetPayload } from "../types";

const DEFAULT_SHEET_ID = "1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk";
// Set VITE_GOOGLE_SHEETS_API_KEY in your .env file.
const API_KEY = (import.meta.env.VITE_GOOGLE_SHEETS_API_KEY as string | undefined) || 'AIzaSyCmwalE0E1hsB-sxfLYB82ZuuSYYoTz1x8';
const CACHE_MS = 5 * 60 * 1000;
const DB_NAME = "cell-avb-sheet-cache-v1";
const STORE_NAME = "sheets";
const MAX_PERSIST_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE = 3;
let active = 0;
const waiting: Array<() => void> = [];
const resultCache = new Map<string, { until: number; value: SheetPayload }>();
const inflight = new Map<string, Promise<SheetPayload>>();
const metadataCache = new Map<string, { until: number; value: SpreadsheetMetadata }>();
const metadataInflight = new Map<string, Promise<SpreadsheetMetadata>>();

type TabMeta = { properties?: { title?: string; gridProperties?: { columnCount?: number } } };
type SpreadsheetMetadata = { properties?: { title?: string }; sheets?: TabMeta[] };

async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_ACTIVE) await new Promise<void>(resolve => waiting.push(resolve));
  active++;
  try { return await task(); }
  finally { active--; waiting.shift()?.(); }
}

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Google Sheets HTTP ${response.status}: ${body.slice(0, 250)}`);
    }
    return await response.json() as T;
  } finally { clearTimeout(timer); }
}

function columnToLetter(n: number): string {
  let result = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) {
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  }
  return result;
}

async function getMetadata(sheetId: string): Promise<SpreadsheetMetadata> {
  const cached = metadataCache.get(sheetId);
  if (cached && cached.until > Date.now()) return cached.value;
  const existing = metadataInflight.get(sheetId);
  if (existing) return existing;
  const promise = limited(() => getJson<SpreadsheetMetadata>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=properties(title),sheets(properties(title,gridProperties(columnCount)))&key=${encodeURIComponent(API_KEY!)}`
  ));
  metadataInflight.set(sheetId, promise);
  try {
    const value = await promise;
    metadataCache.set(sheetId, { value, until: Date.now() + CACHE_MS });
    return value;
  } finally { metadataInflight.delete(sheetId); }
}

type StoredSheet = { key: string; savedAt: number; value: SheetPayload };
let dbPromise: Promise<IDBDatabase | null> | null = null;
function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) dbPromise = new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}
async function readPersistent(key: string): Promise<StoredSheet | null> {
  const db = await openCacheDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function savePersistent(key: string, value: SheetPayload): Promise<void> {
  const db = await openCacheDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ key, value, savedAt: Date.now() } as StoredSheet);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    } catch { resolve(); }
  });
}

export function clearGoogleSheetCache(): void {
  resultCache.clear();
  metadataCache.clear();
}

export async function fetchGoogleSheet(
  sheetId: string = DEFAULT_SHEET_ID,
  tab?: string,
  options: { forceRefresh?: boolean } = {}
): Promise<SheetPayload> {
  if (!API_KEY) throw new Error("Missing VITE_GOOGLE_SHEETS_API_KEY");
  const key = `${sheetId}::${tab ?? "__first__"}`;
  const cached = resultCache.get(key);
  if (!options.forceRefresh && cached && cached.until > Date.now()) return cached.value;
  const pending = inflight.get(key);
  if (!options.forceRefresh && !pending) {
    const stored = await readPersistent(key);
    if (stored && Date.now() - stored.savedAt < MAX_PERSIST_AGE) {
      resultCache.set(key, { value: stored.value, until: Date.now() + CACHE_MS });
      return stored.value;
    }
  }
  if (pending) return pending;

  const task = (async (): Promise<SheetPayload> => {
    const meta = await getMetadata(sheetId);
    const sheets = meta.sheets ?? [];
    const target = tab
      ? sheets.find(s => s.properties?.title === tab)
      : sheets[0];
    if (!target) throw new Error(`Google Sheets tab not found: ${tab ?? "first sheet"}`);
    const tabTitle = target.properties?.title ?? "Sheet1";
    const colCount = Math.max(1, target.properties?.gridProperties?.columnCount ?? 26);
    // Open-ended rows avoid downloading a large grid of empty rows.
    // Column count is the actual grid width, without the previous extra 20 columns.
    const escapedTitle = `'${tabTitle.replace(/'/g, "''")}'`;
    const range = `${escapedTitle}!A1:${columnToLetter(colCount)}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE&key=${encodeURIComponent(API_KEY)}`;
    const data = await limited(() => getJson<{ values?: unknown[][] }>(url));
    const allRows = data.values ?? [];
    const rawHeaders = (allRows[0] ?? []).map(v => String(v ?? "").trim());
    const counts: Record<string, number> = {};
    const headers = rawHeaders.map((h, i) => {
      if (!h) return `__col_${i}`;
      counts[h] = (counts[h] ?? 0) + 1;
      return counts[h] > 1 ? `${h}__${i}` : h;
    });
    const rows = allRows.slice(1)
      .filter(row => row.some(v => String(v ?? "").trim() !== ""))
      .map(row => {
        const result: Record<string, string> = {};
        headers.forEach((h, i) => { result[h] = String(row[i] ?? "").trim(); });
        return result;
      });
    const result: SheetPayload = {
      sheetTitle: meta.properties?.title ?? "Sheet",
      tabTitle,
      headers,
      rows,
      totalRows: rows.length,
      fetchedAt: new Date().toISOString(),
    };
    resultCache.set(key, { value: result, until: Date.now() + CACHE_MS });
    void savePersistent(key, result);
    console.info(`[Sheets] ${tabTitle}: ${rows.length} rows, ${headers.length} columns`);
    return result;
  })();
  inflight.set(key, task);
  try { return await task; }
  finally { inflight.delete(key); }
}
