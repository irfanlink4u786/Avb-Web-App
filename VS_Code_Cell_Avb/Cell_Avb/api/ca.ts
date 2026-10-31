import type { VercelRequest, VercelResponse } from '@vercel/node';
const PROJECT_URL = 'https://yogjbkwurzjcuokcnhif.supabase.co';
const TABLE = 'ca_tracker_oct2026';
type Row = Record<string, unknown>;
const DAY_FIELDS = Array.from({ length: 31 }, (_, i) => `${i + 1}-Oct`);
const SELECT_FIELDS = ['SITE_ID', 'Sub-Region', 'Grid', 'BB Type', "OCT'26 Cell A", ...DAY_FIELDS];
const siteKey = (value: unknown) => String(value ?? '').trim().replace(/^0+(?=\d)/, '');
const normalize = (value: unknown) => String(value ?? '').replace(/[\s_-]/g, '').toUpperCase();
const isC1C6 = (row: Row) => ['CENTRAL1', 'CENTRAL6', 'C1', 'C6'].includes(normalize(row['Sub-Region'])) || /^C[16]\d/.test(normalize(row.Grid));
const isEligible = (row: Row) => !/dismantled|locked/i.test(String(row['BB Type'] ?? ''));
const parseCa = (value: unknown) => {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(String(value).replace('%', '').trim());
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!key) return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing from Vercel environment' });
  const isSecret = key.startsWith('sb_secret_');
  const isLegacy = /^eyJ[^.]+\.[^.]+\.[^.]+$/.test(key);
  if (!isSecret && !isLegacy) return res.status(503).json({ error: 'Invalid Supabase server key format' });
  const headers: Record<string, string> = { apikey: key, Accept: 'application/json' };
  if (isLegacy) headers.Authorization = `Bearer ${key}`;
  try {
    const allRows: Row[] = [];
    const select = SELECT_FIELDS.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
    const base = new URL(`${PROJECT_URL}/rest/v1/${TABLE}`);
    base.searchParams.set('select', select);
    base.searchParams.set('order', '"SITE_ID".asc');
    for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
      const url = new URL(base.toString());
      url.searchParams.set('limit', '1000');
      url.searchParams.set('offset', String(pageNumber * 1000));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      let page: Row[];
      try {
        const response = await fetch(url.toString(), { headers, signal: controller.signal, cache: 'no-store' });
        if (!response.ok) {
          const details = (await response.text()).slice(0, 300);
          console.error('[CA] Supabase response', response.status, details);
          return res.status(502).json({ error: 'CA database fetch failed', upstreamStatus: response.status, reason: response.status === 401 ? 'Supabase key rejected' : response.status === 400 ? 'Invalid table query or column' : 'Supabase request failed' });
        }
        const body: unknown = await response.json();
        if (!Array.isArray(body)) throw new Error('Supabase returned non-array data');
        page = body as Row[];
      } finally { clearTimeout(timer); }
      for (const row of page) if (isC1C6(row) && isEligible(row)) allRows.push(row);
      if (page.length < 1000) break;
      if (pageNumber === 19) throw new Error('Supabase pagination limit reached');
    }
    const bySite = new Map<string, Row>();
    for (const row of allRows) {
      const id = siteKey(row.SITE_ID);
      if (id) bySite.set(id, row);
    }
    if (!bySite.size) return res.status(502).json({ error: 'No eligible C1/C6 CA records returned' });
    const rows = [...bySite.values()];
    let latestDay = 0;
    for (const row of rows) for (let day = 31; day > latestDay; day--) {
      if (parseCa(row[`${day}-Oct`]) !== null) { latestDay = day; break; }
    }
    return res.status(200).json({ source: 'Supabase', table: TABLE, total: rows.length, latestDate: latestDay ? `${String(latestDay).padStart(2, '0')}-Oct-26` : '', rows });
  } catch (error) {
    console.error('[CA] API error', error);
    return res.status(502).json({ error: 'CA API request failed', reason: error instanceof Error && error.name === 'AbortError' ? 'Supabase request timed out' : 'Unexpected server error' });
  }
}
