import type { VercelRequest, VercelResponse } from "@vercel/node";

// Server-only. Never put privileged Supabase keys in VITE_* variables.
const PROJECT_URL = "https://yogjbkwurzjcuokcnhif.supabase.co";
const TABLE = "ca_tracker_oct2026";
const SELECT_FIELDS = [
  "SITE_ID", "Sub-Region", "Grid", "OCT'26 Cell A", "BB Type",
  ...Array.from({ length: 31 }, (_, i) => `${i + 1}-Oct`),
];

type Row = Record<string, unknown>;

function isC1C6(row: Row): boolean {
  const sub = String(row["Sub-Region"] ?? "").replace(/[\s-]/g, "").toUpperCase();
  const grid = String(row.Grid ?? "").toUpperCase();
  return sub === "CENTRAL1" || sub === "CENTRAL6" || sub === "C1" || sub === "C6" || /^C[16]\d/.test(grid);
}

function numeric(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

function keyType(key: string): "new-secret" | "legacy-jwt" | "invalid-format" {
  if (key.startsWith("sb_secret_")) return "new-secret";
  if (/^eyJ[^.]+\.[^.]+\.[^.]+$/.test(key)) return "legacy-jwt";
  return "invalid-format";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const secret = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!secret) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" });

  const format = keyType(secret);
  if (format === "invalid-format") {
    console.error("CA API credential has unexpected format; check the project-specific server secret.");
    return res.status(503).json({ error: "Supabase credential format invalid" });
  }

  // Opaque sb_secret_* values are NOT JWTs and must never be used as a Bearer token.
  // Legacy service_role JWTs can be supplied as apikey and Authorization Bearer.
  const headers: Record<string, string> = { apikey: secret, Accept: "application/json" };
  if (format === "legacy-jwt") headers.Authorization = `Bearer ${secret}`;

  try {
    const allRows: Row[] = [];
    const select = SELECT_FIELDS.map(col => `"${col.replace(/"/g, '""')}"`).join(",");
    const url = new URL(`${PROJECT_URL}/rest/v1/${TABLE}`);
    url.searchParams.set("select", select);
    url.searchParams.set("order", '"SITE_ID".asc');
    url.searchParams.set('"Sub-Region"', 'in.("Central-1","Central-6")');

    for (let offset = 0; offset < 10000; offset += 1000) {
      url.searchParams.set("limit", "1000");
      url.searchParams.set("offset", String(offset));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let page: Row[];
      try {
        const response = await fetch(url.toString(), {
          headers,
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          const body = await response.text();
          console.error("Supabase CA upstream error", { status: response.status, keyType: format, body: body.slice(0, 500) });
          // Never reflect raw upstream errors or key material in the public response.
          return res.status(502).json({
            error: "CA database fetch failed",
            upstreamStatus: response.status,
            reason: response.status === 401 ? "Supabase rejected the configured API key" : "Supabase query failed",
          });
        }
        const parsed: unknown = await response.json();
        if (!Array.isArray(parsed)) throw new Error("Unexpected Supabase response shape");
        page = parsed as Row[];
      } finally {
        clearTimeout(timeout);
      }

      allRows.push(...page.filter(row =>
        isC1C6(row) && !/dismantled|locked/i.test(String(row["BB Type"] ?? ""))
      ).map(row => Object.fromEntries(Object.entries(row).filter(([col]) =>
        col === "SITE_ID" || col === "OCT'26 Cell A" || /^\d{1,2}-Oct$/.test(col)
      ))));
      if (page.length < 1000) break;
    }

    if (!allRows.length) return res.status(502).json({ error: "No CA records found for C1/C6" });

    const check4004 = allRows.find(row => String(row.SITE_ID ?? "").trim() === "4004");
    console.info("CA API diagnostic", {
      count: allRows.length,
      site4004Found: Boolean(check4004),
      site4004Day30: check4004?.["30-Oct"],
      site4004MTD: check4004?.["OCT'26 Cell A"],
    });

    let lastDay = 0;
    for (const row of allRows) {
      for (let day = 31; day > lastDay; day--) {
        if (numeric(row[`${day}-Oct`]) !== null) {
          lastDay = day;
          break;
        }
      }
    }

    return res.status(200).json({
      rows: allRows,
      latestDate: lastDay ? `${String(lastDay).padStart(2, "0")}-Oct-26` : "",
    });
  } catch (error) {
    console.error("CA API request failed", error);
    return res.status(502).json({ error: "CA API request failed" });
  }
}