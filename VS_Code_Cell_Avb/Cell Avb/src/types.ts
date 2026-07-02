// src/types.ts

export interface SiteData {
  siteName: string;
  subRegion: string;
  revenueCategory: string;
  grid: string;
  currentAvb: number;
  monthlyAvb: number;
  latitude?: string;
  longitude?: string;
  dgStatus: string;
  dgInstalled: string;
  dgRating?: string;
  liIonInstalled: string;
  liIonCapacity?: number;
  agmBb: string;
  bbStatus?: string;
  belowBase: string;
  msGtl: string;
  zongLead: string;
  clusterOwner: string;
  npsSiteDomain: string;
  technology?: string;
  terrain?: string;
  sharingStatus?: string;
  indoorOutdoor?: string;
  hubSingle?: string;
  dependentSites?: number;
  chronic?: string;
  dgChronic?: string;
  liIonChronic?: string;
  target?: number;
  city?: string;
  ca2G?: number;
  ca3G?: number;
  ca4G?: number;
  dailyData?: Record<string, number>;   // key = date string, e.g. "23-Jun-26"
  dailyLs?: Record<string, number>;
}

export interface SheetPayload {
  sheetTitle: string;
  tabTitle: string;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  fetchedAt: string;
}

export const PGS_GROUP = ["Platinum +", "Platinum", "Gold", "Strategic"];
export const SB_GROUP = ["Silver", "Bronze"];

export const CATEGORY_COLORS: Record<string, string> = {
  "Platinum +": "#8b5cf6",
  Platinum: "#6366f1",
  Gold: "#f59e0b",
  Strategic: "#3b82f6",
  Silver: "#94a3b8",
  Bronze: "#d97706",
};

export const CATEGORY_THRESHOLDS: Record<string, number> = {
  "Platinum +": 98.5,
  Platinum: 98.1,
  Gold: 98.1,
  Strategic: 98.1,
  Silver: 95,
  Bronze: 95,
};

export function hasDG(site: SiteData): boolean {
  return isDgOperational(site);
}
export function isDgOperational(site: SiteData): boolean {
  const s = (site.dgStatus ?? "").trim().toLowerCase();
  return s === "operational";
}
export function hasLiIon(site: SiteData): boolean {
  return (site.liIonInstalled ?? "").trim().toUpperCase() === "YES";
}
export function isBelowBase(site: SiteData): boolean {
  const v = (site.belowBase ?? "").trim();
  return v !== "" && v.toLowerCase() !== "no" && v.toLowerCase() !== "false" && v !== "-";
}
export function hasAGM(site: SiteData): boolean {
  const v = (site.agmBb ?? "").trim().toLowerCase();
  return v.includes("agm") || v === "yes";
}
export function isNPSSite(site: SiteData): boolean {
  const v = (site.npsSiteDomain ?? "").trim();
  return v !== "" && v !== "-" && v.toLowerCase() !== "no";
}

export const COLUMN_MAP: Record<string, keyof SiteData> = {
  "Site ID": "siteName",
  "Sub-Region": "subRegion",
  "Revenue Category": "revenueCategory",
  Grid: "grid",
  "Current Month": "currentAvb",
  "5 Month AVB": "monthlyAvb",
  Lat: "latitude",
  Long: "longitude",
  "DG Status": "dgStatus",
  "DG Rating": "dgRating",
  "Li-ion Installed (Yes / No)": "liIonInstalled",
  "Li-ion Capacity": "liIonCapacity",
  "AGM/LION": "agmBb",
  "BB Status": "bbStatus",
  "Below BASE": "belowBase",
  "MS GTL": "msGtl",
  "Zone Lead": "zongLead",
  "Cluster Owner": "clusterOwner",
  "No of dependent sites": "dependentSites",
  Technology: "technology",
  "Site Terrain": "terrain",
  "Sharing Status": "sharingStatus",
  "Indoor / Outdoor": "indoorOutdoor",
  "HUB/Single": "hubSingle",
  Chronic: "chronic",
  "DG Chronic": "dgChronic",
  "Li-ion Chronic": "liIonChronic",
  Target: "target",
  City: "city",
  "NPS Site-Domain": "npsSiteDomain",
  "TCH CA": "ca2G",
  "Cell_U CA": "ca3G",
  "Cell_EU CA": "ca4G",
};

export function normalizeRow(raw: Record<string, string>): SiteData {
  const out: Partial<SiteData> = {};
  const dailyData: Record<string, number> = {};
  const dailyLs: Record<string, number> = {};

  // 1. Map known columns
  for (const [header, value] of Object.entries(raw)) {
    if (COLUMN_MAP[header]) {
      const field = COLUMN_MAP[header];
      if (
        field === "currentAvb" || field === "monthlyAvb" ||
        field === "liIonCapacity" || field === "dependentSites" ||
        field === "target" || field === "ca2G" ||
        field === "ca3G" || field === "ca4G"
      ) {
        (out as Record<string, unknown>)[field] = parseFloatSafe(value);
      } else {
        (out as Record<string, unknown>)[field] = value;
      }
    }
  }

  // 2. Detect daily columns – assume they are date strings like "23-Jun-26"
  //    (We'll store them with the date string as key)
  const dateRegex = /^\d{1,2}-[A-Z][a-z]{2}-\d{2,4}$/;
  for (const [header, value] of Object.entries(raw)) {
    if (dateRegex.test(header)) {
      const v = parseFloatSafe(value);
      if (v > 0) {
        dailyData[header] = v;
      }
    }
  }

  // 3. (Optional) Parse LS daily columns if you have them – adjust as needed.

  out.siteName = out.siteName || raw["Site ID"] || "";
  out.currentAvb = out.currentAvb ?? 0;
  out.monthlyAvb = out.monthlyAvb ?? out.currentAvb ?? 0;
  out.dgInstalled = out.dgStatus ?? "";
  out.dailyData = Object.keys(dailyData).length > 0 ? dailyData : undefined;
  out.dailyLs = Object.keys(dailyLs).length > 0 ? dailyLs : undefined;

  return out as SiteData;
}

function parseFloatSafe(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.toString().replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}