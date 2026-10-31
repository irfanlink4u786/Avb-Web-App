import type { SheetPayload } from "../types";

/**
 * Authoritative current-month CA from Central BB Analytics.
 * Google Sheets remains the source of fuel/electricity/3 Basics/site metadata.
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (publishable/anon ONLY).
 * Supabase policies must authorize this read. Never use service_role in Vite.
 */
// Same-origin Vercel API: sensitive Supabase credentials live only on Vercel server.
const DAY_FIELDS = Array.from({ length: 31 }, (_, i) => `${i + 1}-Oct`);
type CaRecord = Record<string, unknown>;
export type CaSnapshot = { bySite: Map<string, CaRecord>; latestDate: string; total: number };
const parseCa = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const n = Number(String(raw).replace(/%/g, "").trim());
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};
const siteKey = (value: unknown): string => String(value ?? "").trim().replace(/^0+(?=\d)/, "");
export async function fetchSupabaseOctoberCA(): Promise<CaSnapshot> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`/api/ca?date=${Date.now()}`, {
      method: "GET",
      credentials: "same-origin",
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error("CA endpoint denied access; check Vercel API deployment and server configuration.");
    }
    if (!response.ok) throw new Error(`CA API HTTP ${response.status}: ${(await response.text()).slice(0, 220)}`);
    const body = await response.json() as { rows?: CaRecord[]; latestDate?: string };
    if (!Array.isArray(body.rows) || body.rows.length === 0) throw new Error("CA API returned no C1/C6 sites; check Vercel server logs and Supabase access");
    const bySite = new Map<string, CaRecord>();
    for (const record of body.rows) {
      const id = siteKey(record["SITE_ID"]);
      if (id) bySite.set(id, record);
    }
    const check4004=bySite.get('4004');
    console.info('[CA Sync] API check Site 4004',{exists:!!check4004,day30:check4004?.['30-Oct'],mtd:check4004?.["OCT'26 Cell A"],latestDate:body.latestDate,rows:bySite.size});
    return { bySite, total: bySite.size, latestDate: body.latestDate || "" };
  } finally { clearTimeout(timer); }
}

export function mergeSheetWithSupabaseCA(sheet: SheetPayload, ca: CaSnapshot): {
  sheet: SheetPayload;
  caCoverage: { matched: number; sheetSites: number; excluded: number };
} {
  let matched = 0;
  let excluded = 0;
  const rows = sheet.rows.map(raw => {
    const copy: Record<string, string> = { ...raw };
    const id = siteKey(raw["Site ID"] || raw["SITE_ID"] || raw["SiteID"] || raw["Site"] || raw["SID"]);
    const record = ca.bySite.get(id);
    // Remove stale daily CA and current CA from Sheets, preserve all non-CA metrics.
    for (const key of Object.keys(copy)) {
      if (/^\d{1,2}-Oct-(?:26|2026)$/i.test(key)) delete copy[key];
    }
    for (const key of ["Current Month", "Current Month CA", "Current CA", "Current CA%", "Monthly AVB", "Monthly CA", "Cell AVB"]) {
      if (key in copy) copy[key] = "";
    }
    if (!record) { excluded += 1; return copy; }
    matched += 1;
    const monthly = parseCa(record["OCT'26 Cell A"]);
    const monthlyText = monthly === null ? "" : String(monthly);
    copy["Current Month"] = monthlyText;
    copy["Current Month CA"] = monthlyText;
    for (const day of DAY_FIELDS) {
      const v = parseCa(record[day]);
      if (v !== null) copy[`${day}-26`] = String(v);
    }
    return copy;
  });
  return {sheet: {...sheet, rows, fetchedAt: new Date().toISOString()},
    caCoverage: {matched, sheetSites: rows.length, excluded}};
}
