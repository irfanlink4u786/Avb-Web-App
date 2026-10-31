import type { SheetPayload } from '../types';

type Row = Record<string, unknown>;
export type CaMonth = 'october' | 'november';
export type CaSnapshot = { bySite: Map<string, Row>; latestDate: string; total: number; month: CaMonth };
const URL_BASE = (import.meta.env.VITE_SUPABASE_URL || 'https://yogjbkwurzjcuokcnhif.supabase.co').replace(/\/$/, '');
const KEY = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const TABLES: Record<CaMonth, string> = {
  october: import.meta.env.VITE_SUPABASE_OCT_TABLE || 'ca_tracker_oct2026',
  november: import.meta.env.VITE_SUPABASE_NOV_TABLE || 'ca_tracker_nov2026',
};
const CONFIG: Record<CaMonth, { abbr: string; year: string; days: number }> = {
  october: { abbr: 'Oct', year: '26', days: 31 },
  november: { abbr: 'Nov', year: '26', days: 30 },
};
const siteKey = (v: unknown) => String(v ?? '').trim().replace(/\.0+$/, '').replace(/^0+(?=\d)/, '');
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const valid = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const raw = String(v).trim();
  const n = Number(raw.replace(/[% ,]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
};
const get = (r: Row, ...names: string[]): unknown => {
  const wanted = new Set(names.map(normalize));
  const key = Object.keys(r).find(k => wanted.has(normalize(k)));
  return key === undefined ? undefined : r[key];
};
const dayValue = (r: Row, day: number, m: CaMonth): number | null => {
  const { abbr, year } = CONFIG[m];
  return valid(get(r, `${day}-${abbr}`, `${day}-${abbr}-${year}`, `${String(day).padStart(2,'0')}-${abbr}-${year}`, `${day}-${abbr}-20${year}`));
};
const techValue = (r: Row, tech: '2G' | '3G' | '4G' | '5G', m: CaMonth): number | null => {
  const { abbr, year } = CONFIG[m];
  const aliases = tech === '2G' ? ['TCH', '2G'] : tech === '3G' ? ['Cell_U', '3G'] : tech === '4G' ? ['Cell_EU', '4G', 'LTE'] : ['5G', 'NR'];
  const labels = aliases.flatMap(a => [`${abbr}'${year} ${a}`, `${abbr}-${year} ${a}`, `${a} ${abbr}'${year}`, `${a} CA`, a]);
  return valid(get(r, ...labels));
};
async function readRows(month: CaMonth): Promise<Row[]> {
  if (!KEY || /^(PASTE|YOUR|REPLACE)/i.test(KEY)) throw new Error('Set VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
  const table = TABLES[month];
  const rows: Row[] = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const qs = new URLSearchParams({ select: '*', limit: '1000', offset: String(offset) });
    const response = await fetch(`${URL_BASE}/rest/v1/${encodeURIComponent(table)}?${qs}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' }, cache: 'no-store',
    });
    if (!response.ok) throw new Error(`${table}: Supabase HTTP ${response.status}: ${(await response.text()).slice(0, 220)}`);
    const page: unknown = await response.json();
    if (!Array.isArray(page)) throw new Error(`${table}: expected an array of site records`);
    rows.push(...page as Row[]);
    if (page.length < 1000) break;
  }
  return rows;
}
export async function fetchSupabaseMonthCA(month: CaMonth): Promise<CaSnapshot> {
  const rows = await readRows(month);
  const bySite = new Map<string, Row>();
  for (const r of rows) {
    const id = siteKey(get(r, 'SITE_ID', 'Site ID', 'SiteID', 'Site'));
    if (id) bySite.set(id, r);
  }
  let latest = 0;
  for (const r of bySite.values()) {
    for (let d = CONFIG[month].days; d > latest; d--) {
      if (dayValue(r, d, month) !== null) { latest = d; break; }
    }
  }
  return { bySite, total: bySite.size, month,
    latestDate: latest ? `${String(latest).padStart(2, '0')}-${CONFIG[month].abbr}-${CONFIG[month].year}` : '' };
}
export const fetchSupabaseOctoberCA = () => fetchSupabaseMonthCA('october');
export function mergeSheetWithSupabaseCA(sheet: SheetPayload, ca: CaSnapshot): {
  sheet: SheetPayload; caCoverage: { matched: number; sheetSites: number; excluded: number }
} {
  const { abbr, year, days } = CONFIG[ca.month];
  let matched = 0;
  const rows = sheet.rows.map(raw => {
    const copy: Record<string, string> = { ...raw };
    const id = siteKey(get(raw, 'Site ID', 'SITE_ID', 'SiteID', 'Site', 'SID'));
    const r = ca.bySite.get(id);
    // Clear only the target month's daily columns, never other Google Sheet fields.
    // This prevents stale daily values from appearing if Supabase later removes a day.
    for (const key of Object.keys(copy)) {
      if (new RegExp(`^\\d{1,2}-${abbr}-(?:${year}|20${year})$`, 'i').test(key)) delete copy[key];
    }
    if (!r) {
      copy['Current Month'] = '';
      copy['Current Month CA'] = '';
      return copy;
    }
    matched++;
    const values: number[] = [];
    for (let d = 1; d <= days; d++) {
      const v = dayValue(r, d, ca.month);
      if (v === null) continue;
      copy[`${d}-${abbr}-${year}`] = String(v);
      values.push(v);
    }
    // Only valid daily readings contribute. 0% is valid; missing is excluded.
    const monthly = values.length ? (values.reduce((a,b) => a+b, 0) / values.length).toFixed(4) : '';
    copy['Current Month'] = monthly;
    copy['Current Month CA'] = monthly;
    copy['CA Reporting Days'] = String(values.length);
    // Technology values: Supabase month-level technology CA when provided.
    // Do not fabricate technology CA from total Cell AVB.
    for (const [tech, field] of [['2G','TCH'], ['3G','Cell_U'], ['4G','Cell_EU'], ['5G','5G CA']] as const) {
      const value = techValue(r, tech, ca.month);
      if (value !== null) copy[field] = String(value);
    }
    return copy;
  });
  return { sheet: { ...sheet, rows, headers: Array.from(new Set([...sheet.headers, 'Current Month', 'Current Month CA', 'CA Reporting Days', ...Array.from({length:days},(_,i)=>`${i+1}-${abbr}-${year}`)])) },
    caCoverage: { matched, sheetSites: rows.length, excluded: rows.length - matched } };
}
