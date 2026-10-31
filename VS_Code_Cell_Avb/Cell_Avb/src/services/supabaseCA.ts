import type { SheetPayload } from '../types';

const PROJECT_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://yogjbkwurzjcuokcnhif.supabase.co').replace(/\/+$/, '');
const PUBLIC_KEY = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const HAS_KEY = Boolean(PUBLIC_KEY) && !/PASTE_|YOUR_|REPLACE_|_HERE/i.test(PUBLIC_KEY);
const TABLE = 'ca_tracker_oct2026';
const DAYS = Array.from({ length: 31 }, (_, i) => `${i + 1}-Oct`);
const FIELDS = ['SITE_ID', 'Sub-Region', 'Grid', 'BB Type', "OCT'26 Cell A", ...DAYS];
type Row = Record<string, unknown>;
export type CaSnapshot = { bySite: Map<string, Row>; latestDate: string; total: number };
const siteKey = (v: unknown) => String(v ?? '').trim().replace(/^0+(?=\d)/, '');
const normalize = (v: unknown) => String(v ?? '').toUpperCase().replace(/[\s_-]/g, '');
const validSite = (r: Row) => {
  const sub = normalize(r['Sub-Region']);
  const grid = normalize(r.Grid);
  return (['CENTRAL1', 'CENTRAL6', 'C1', 'C6'].includes(sub) || /^C[16]\d/.test(grid)) && !/dismantled|locked/i.test(String(r['BB Type'] ?? ''));
};
const numeric = (v: unknown) => v != null && String(v).trim() !== '' && Number.isFinite(Number(String(v).replace('%', '')));

async function fetchPage(url: string, headers: Record<string, string>): Promise<Row[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error(`Expected Supabase JSON but received ${contentType || 'unknown content type'}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error('Supabase returned JSON without a row array');
    return data as Row[];
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSupabaseOctoberCA(): Promise<CaSnapshot> {
  let rows: Row[] = [];
  if (HAS_KEY) {
    const select = FIELDS.map(f => `"${f.replace(/"/g, '""')}"`).join(',');
    const headers: Record<string, string> = { apikey: PUBLIC_KEY, Accept: 'application/json' };
    // Legacy JWT anon keys support bearer auth; publishable keys are passed as apikey.
    if (!PUBLIC_KEY.startsWith('sb_publishable_')) headers.Authorization = `Bearer ${PUBLIC_KEY}`;
    for (let offset = 0; offset < 20000; offset += 1000) {
      const query = new URLSearchParams({ select, order: '"SITE_ID".asc', limit: '1000', offset: String(offset) });
      const page = await fetchPage(`${PROJECT_URL}/rest/v1/${TABLE}?${query}`, headers);
      rows.push(...page);
      if (page.length < 1000) break;
      if (offset === 19000) throw new Error('Supabase pagination limit reached');
    }
  } else {
    // On Vercel the serverless endpoint can use the server-only service-role key.
    // Local Vite requires VITE_SUPABASE_PUBLISHABLE_KEY, unless /api/ca is proxied.
    const response = await fetch('/api/ca', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`CA API HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`);
    if (!(response.headers.get('content-type') || '').includes('application/json')) {
      throw new Error('The /api/ca endpoint returned HTML, not JSON. Configure VITE_SUPABASE_PUBLISHABLE_KEY in .env.local and restart Vite.');
    }
    const body: unknown = await response.json();
    if (Array.isArray(body)) rows = body as Row[];
    else if (body && typeof body === 'object' && Array.isArray((body as { rows?: unknown }).rows)) rows = (body as { rows: Row[] }).rows;
    else throw new Error('CA API JSON has no rows array');
  }
  const bySite = new Map<string, Row>();
  for (const row of rows) if (validSite(row)) {
    const id = siteKey(row.SITE_ID);
    if (id) bySite.set(id, row);
  }
  if (!bySite.size) throw new Error('Supabase returned zero eligible C1/C6 CA sites. Check table permissions and RLS.');
  let last = 0;
  for (const row of bySite.values()) for (let day = 31; day > last; day--) {
    if (numeric(row[`${day}-Oct`])) { last = day; break; }
  }
  return { bySite, total: bySite.size, latestDate: last ? `${String(last).padStart(2, '0')}-Oct-26` : '' };
}

export function mergeSheetWithSupabaseCA(sheet: SheetPayload, ca: CaSnapshot): {
  sheet: SheetPayload; caCoverage: { matched: number; sheetSites: number; excluded: number };
} {
  let matched = 0;
  const rows = sheet.rows.map(raw => {
    const copy: Record<string, string> = { ...raw };
    const id = siteKey(raw['Site ID'] || raw.SITE_ID || raw.SiteID || raw.Site || raw.SID);
    const record = ca.bySite.get(id);
    if (!record) return copy;
    matched++;
    const monthly = String(record["OCT'26 Cell A"] ?? '');
    copy['Current Month'] = monthly;
    copy['Current Month CA'] = monthly;
    for (let d = 1; d <= 31; d++) {
      const value = record[`${d}-Oct`];
      if (value != null && String(value).trim() !== '') copy[`${d}-Oct-26`] = String(value);
    }
    return copy;
  });
  return { sheet: { ...sheet, rows }, caCoverage: { matched, sheetSites: rows.length, excluded: rows.length - matched } };
}
