export type { SheetPayload } from '../types';
import type { SheetPayload } from '../types';

const DEFAULT_SHEET_ID = '1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk';
const API_KEY = String(import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '').trim();
const CACHE_MS = 5 * 60 * 1000;
const MAX_ACTIVE = 3;
type TabMeta = { properties?: { title?: string; gridProperties?: { columnCount?: number } } };
type SpreadsheetMetadata = { properties?: { title?: string }; sheets?: TabMeta[] };
type CacheEntry<T> = { value: T; until: number };
const resultCache = new Map<string, CacheEntry<SheetPayload>>();
const metadataCache = new Map<string, CacheEntry<SpreadsheetMetadata>>();
const inflight = new Map<string, Promise<SheetPayload>>();
const metadataInflight = new Map<string, Promise<SpreadsheetMetadata>>();
let active = 0;
const waiting: Array<() => void> = [];

async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_ACTIVE) await new Promise<void>(resolve => waiting.push(resolve));
  active++;
  try { return await task(); }
  finally { active--; waiting.shift()?.(); }
}

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Google Sheets HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`);
    return await response.json() as T;
  } finally { clearTimeout(timer); }
}

function columnToLetter(n: number): string {
  let result = '';
  while (n > 0) { n--; result = String.fromCharCode(65 + (n % 26)) + result; n = Math.floor(n / 26); }
  return result;
}

async function getMetadata(sheetId: string, forceRefresh = false): Promise<SpreadsheetMetadata> {
  const cached = metadataCache.get(sheetId);
  if (!forceRefresh && cached && cached.until > Date.now()) return cached.value;
  const existing = metadataInflight.get(sheetId);
  if (existing) return existing;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=properties(title),sheets(properties(title,gridProperties(columnCount)))&key=${encodeURIComponent(API_KEY)}`;
  const promise = limited(() => getJson<SpreadsheetMetadata>(url));
  metadataInflight.set(sheetId, promise);
  try {
    const value = await promise;
    metadataCache.set(sheetId, { value, until: Date.now() + CACHE_MS });
    return value;
  } finally { metadataInflight.delete(sheetId); }
}

export function clearGoogleSheetCache(): void { resultCache.clear(); metadataCache.clear(); }

export async function fetchGoogleSheet(sheetId: string = DEFAULT_SHEET_ID, tab?: string, options: { forceRefresh?: boolean } = {}): Promise<SheetPayload> {
  if (!API_KEY || /^(PASTE|YOUR|REPLACE)/i.test(API_KEY)) throw new Error('VITE_GOOGLE_SHEETS_API_KEY is missing. Create .env.local in the project root with a real Google Cloud API key, not a spreadsheet ID, then restart Vite.');
  if (API_KEY === DEFAULT_SHEET_ID || !API_KEY.startsWith('AIza')) throw new Error('VITE_GOOGLE_SHEETS_API_KEY is not a valid Google API key. The 1Bu4... value is a spreadsheet ID. Use a Google Cloud API key (usually starts with AIza).');
  const forceRefresh = options.forceRefresh === true;
  const key = `${sheetId}::${tab ?? '__first__'}`;
  const cached = resultCache.get(key);
  if (!forceRefresh && cached && cached.until > Date.now()) return cached.value;
  const pending = inflight.get(key);
  if (pending) return pending;
  const task = (async (): Promise<SheetPayload> => {
    const meta = await getMetadata(sheetId, forceRefresh);
    const sheets = meta.sheets ?? [];
    const target = tab ? sheets.find(s => s.properties?.title === tab) : sheets[0];
    if (!target) throw new Error(`Google Sheets tab not found: ${tab ?? 'first'}`);
    const tabTitle = target.properties?.title ?? 'Sheet1';
    const colCount = Math.max(1, target.properties?.gridProperties?.columnCount ?? 26);
    const range = `'${tabTitle.replace(/'/g, "''")}'!A1:${columnToLetter(colCount)}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE&key=${encodeURIComponent(API_KEY)}`;
    const data = await limited(() => getJson<{ values?: unknown[][] }>(url));
    const allRows = data.values ?? [];
    const rawHeaders = (allRows[0] ?? []).map(v => String(v ?? '').trim());
    const counts: Record<string, number> = {};
    const headers = rawHeaders.map((header, index) => {
      if (!header) return `__col_${index}`;
      counts[header] = (counts[header] ?? 0) + 1;
      return counts[header] > 1 ? `${header}__${index}` : header;
    });
    const rows = allRows.slice(1).filter(row => row.some(v => String(v ?? '').trim() !== '')).map(row => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => { record[header] = String(row[index] ?? '').trim(); });
      return record;
    });
    const result: SheetPayload = { sheetTitle: meta.properties?.title ?? 'Sheet', tabTitle, headers, rows, totalRows: rows.length, fetchedAt: new Date().toISOString() };
    resultCache.set(key, { value: result, until: Date.now() + CACHE_MS });
    console.info(`[Sheets] ${tabTitle}: ${rows.length} rows`);
    return result;
  })();
  inflight.set(key, task);
  try { return await task; }
  finally { inflight.delete(key); }
}
