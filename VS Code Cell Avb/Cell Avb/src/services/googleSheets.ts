/**
 * Google Sheets data service.
 *
 * fetchGoogleSheet(sheetId, tab) returns a normalized payload from the
 * serverless /api/sheet route, which proxies the Google Sheets v4 API
 * (keeping the API key server-side).
 */

export interface SheetPayload {
  sheetTitle: string;
  tabTitle: string;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  fetchedAt: string;
}

const DEFAULT_SHEET_ID = "1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk";

export async function fetchGoogleSheet(
  sheetId: string = DEFAULT_SHEET_ID,
  tab?: string
): Promise<SheetPayload> {
  const params = new URLSearchParams({ id: sheetId });
  if (tab) params.set("tab", tab);

  const res = await fetch(`/api/sheet?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.detail || body.error || "";
    } catch {
      /* ignore */
    }
    throw new Error(
      `Failed to load Google Sheet (${res.status}). ${detail}`.trim()
    );
  }

  return res.json();
}
