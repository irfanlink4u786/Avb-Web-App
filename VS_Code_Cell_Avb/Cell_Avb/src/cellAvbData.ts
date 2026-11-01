import type { SheetPayload } from "./types";

// ============================================================
//  CELL AVB SUPABASE DATA LAYER (C-1 / C-6 ONLY)
//  Supabase is the only external data source.
// ============================================================
const CELL_MASTER_TABLE = "cell_avb_c1_c6_site_master";
const CELL_CA_TABLE = "ca_tracker_oct2026";

/**
 * October CA and technology availability come exclusively from Supabase.
 * The 27-field C-1/C-6 master is the site population; supporting Google
 * All available data comes from Supabase.
 *
 * Access: the site master requires an authenticated Supabase session.
 * Never put a service-role key in a browser application.
 */
export async function fetchCellAvbFromSupabase(): Promise<SheetPayload> {
  const env = (import.meta as any).env || {};
  const base = String(env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || "");
  if (!base || !key) throw new Error("Missing Supabase URL or publishable key in Vite configuration");

  // Dashboard login must be a real Supabase Auth session, not a local UI flag.
  const sessionRaw = sessionStorage.getItem("cell_avb_supabase_session");
  const session = sessionRaw ? JSON.parse(sessionRaw) : null;
  if (!session?.access_token) throw new Error("Supabase authentication required. Please sign in using your Supabase Auth email and password.");
  let token = String(session.access_token);
  if (Number(session.expires_at || 0) * 1000 < Date.now() + 60000) {
    if (!session.refresh_token) throw new Error("Supabase session expired. Please sign in again.");
    const refreshed = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    if (!refreshed.ok) { sessionStorage.removeItem("cell_avb_supabase_session"); throw new Error("Supabase session expired. Please sign in again."); }
    const next = await refreshed.json();
    next.expires_at = Math.floor(Date.now() / 1000) + Number(next.expires_in || 3600);
    sessionStorage.setItem("cell_avb_supabase_session", JSON.stringify(next));
    token = next.access_token;
  }
  const headers = { apikey: key, Authorization: `Bearer ${token}`, Accept: "application/json" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  const fetchPages = async (table: string, columns: string, filter = "", maxRows = 8000) => {
    const pageSize = 1000;
    const offsets = Array.from({ length: Math.ceil(maxRows / pageSize) }, (_, i) => i * pageSize);
    const load = async (offset: number) => {
      const url = `${base}/rest/v1/${table}?select=${encodeURIComponent(columns)}${filter}&limit=${pageSize}&offset=${offset}`;
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) throw new Error(`Supabase ${table}: HTTP ${response.status}: ${(await response.text()).slice(0, 240)}`);
      return await response.json() as Record<string, any>[];
    };
    // Parallel pages: master has ~1,866 records; October CA has ~1,888 for C1/C6.
    // Do not sequentially wait for every page before starting the next.
    const pages = await Promise.all(offsets.map(load));
    return pages.flat();
  };

  try {
    const masterPromise = fetchPages(CELL_MASTER_TABLE, "*", "", 2000);
    const dayNames = Array.from({ length: 31 }, (_, i) => `${i + 1}-Oct`);
    const caFields = ["SITE_ID", "OCT'26 Cell A", "OCT'26 LS", "OCT'26 TCH", "OCT'26 Utran", "OCT'26 Eutran", "OCT'26 NR Cell", ...dayNames];
    const columns = caFields.map(name => `"${name.replace(/"/g, '\\"')}"`).join(",");
    const caPromise = fetchPages(CELL_CA_TABLE, columns, `&${encodeURIComponent("Sub-Region")}=in.(Central-1,Central-6)`, 3000);
    const [master, caRows] = await Promise.all([masterPromise, caPromise]);
    if (!master.length) {
      throw new Error("C-1/C-6 Site Master returned no records. Sign in with an authorized Supabase account; the table has 1,866 imported sites and its RLS does not permit anonymous access.");
    }
    if (!caRows.length) throw new Error("No CA records found for Central-1 and Central-6. Check the Supabase CA table and sub-region values.");
    const byId = new Map(caRows.map(r => [String(r.SITE_ID ?? "").trim().replace(/\.0+$/, ""), r]));
    const matchedCount = master.filter(site => byId.has(String(site["Site ID"] ?? "").trim().replace(/\.0+$/, ""))).length;
    if (!matchedCount) throw new Error("Site Master and CA tracker have no matching Site IDs; cannot display zero-valued KPIs as valid data.");
    console.info(`[Cell AVB] Supabase matched ${matchedCount}/${master.length} Site Master records with ${caRows.length} CA tracker records`);

    const result = master.map(site => {
      const id = String(site["Site ID"] ?? "").trim().replace(/\.0+$/, "");
      const ca = byId.get(id) || {};
      const monthly = ca["OCT'26 Cell A"] ?? "";
      const merged: Record<string, any> = {
        ...site,
        "Site ID": id,
        "Current Month": monthly,
        "Oct'26 Cell A": monthly,
        "OCT'26 Cell A": monthly,
        "OCT'26 LS": ca["OCT'26 LS"] ?? "",
        "OCT'26 TCH": ca["OCT'26 TCH"] ?? "",
        "OCT'26 Utran": ca["OCT'26 Utran"] ?? "",
        "OCT'26 Eutran": ca["OCT'26 Eutran"] ?? "",
        "OCT'26 NR Cell": ca["OCT'26 NR Cell"] ?? "",
        "TCH": ca["OCT'26 TCH"] ?? "",
        "Cell_U": ca["OCT'26 Utran"] ?? "",
        "Cell_EU": ca["OCT'26 Eutran"] ?? "",
        "NR Cell": ca["OCT'26 NR Cell"] ?? "",
      };
      for (let i = 1; i <= 31; i++) {
        const value = ca[`${i}-Oct`] ?? "";
        merged[`${i}-Oct`] = value;
        merged[`${i}-Oct-26`] = value;
        merged[`${String(i).padStart(2, "0")}-Oct-26`] = value;
      }
      return merged;
    });
    const headersOut = Array.from(new Set(result.flatMap(row => Object.keys(row))));
    return { headers: headersOut, rows: result } as SheetPayload;
  } finally {
    clearTimeout(timer);
  }
}

