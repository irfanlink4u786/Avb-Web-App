// Core data types and group constants — matching the AVB dashboard
// Google Sheet column headers verified against live data

export interface SiteData {
  siteName: string;
  subRegion: string;
  revenueCategory: string;
  grid: string;
  currentAvb: number;
  monthlyAvb: number;
  latitude?: string;
  longitude?: string;
  dgStatus: string;          // "Non DG" | "Operational" | "Non-Operational"
  dgRating?: string;
  liIonInstalled: string;
  liIonCapacity?: number;
  agmBb: string;
  bbStatus?: string;
  belowBase: string;
  msGtl: string;
  zongLead: string;
  clusterOwner: string;
  npsSiteDomain: string;     // Column GD: "NPS Site-Domain"
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
  dailyData?: Record<string, number>;
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

// Thresholds per category (matching original dashboard)
export const CATEGORY_THRESHOLDS: Record<string, number> = {
  "Platinum +": 98.5,
  Platinum: 98.1,
  Gold: 98.1,
  Strategic: 98.1,
  Silver: 95,
  Bronze: 95,
};

/* ---- Helper predicates (used everywhere) ---- */

/** True if this site actually has a DG installed (not "Non DG") */
export function hasDG(site: SiteData): boolean {
  const s = (site.dgStatus ?? "").trim().toLowerCase();
  return s !== "" && s !== "non dg" && s !== "-";
}

/** True if DG is operational */
export function isDgOperational(site: SiteData): boolean {
  const s = (site.dgStatus ?? "").trim().toLowerCase();
  return s === "operational";
}

/** True if Li-ion is installed */
export function hasLiIon(site: SiteData): boolean {
  return (site.liIonInstalled ?? "").trim().toUpperCase() === "YES";
}

/** True if site is flagged below base */
export function isBelowBase(site: SiteData): boolean {
  const v = (site.belowBase ?? "").trim();
  return v !== "" && v.toLowerCase() !== "no" && v.toLowerCase() !== "false" && v !== "-";
}

/** True if site has AGM battery */
export function hasAGM(site: SiteData): boolean {
  const v = (site.agmBb ?? "").trim().toLowerCase();
  return v.includes("agm") || v === "yes";
}

/** True if NPS site */
export function isNPSSite(site: SiteData): boolean {
  const v = (site.npsSiteDomain ?? "").trim();
  return v !== "" && v !== "-" && v.toLowerCase() !== "no";
}

/* ---- Column mapping: Google Sheet header → SiteData field ---- */
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
};

// Convert raw sheet row (keyed by header) into normalized SiteData
export function normalizeRow(raw: Record<string, string>): SiteData {
  const out: Partial<SiteData> = {};
  const dailyData: Record<string, number> = {};

  for (const [header, value] of Object.entries(raw)) {
    // Direct mapped columns
    if (COLUMN_MAP[header]) {
      const field = COLUMN_MAP[header];
      if (
        field === "currentAvb" ||
        field === "monthlyAvb" ||
        field === "liIonCapacity" ||
        field === "dependentSites" ||
        field === "target"
      ) {
        (out as Record<string, unknown>)[field] = parseFloatSafe(value);
      } else {
        (out as Record<string, unknown>)[field] = value;
      }
      continue;
    }
    // Daily availability columns — date strings like "1-Jun-26"
    if (/^\d{1,2}-[A-Z][a-z]{2}-\d{2,4}$/.test(header)) {
      const v = parseFloatSafe(value);
      if (v > 0) dailyData[header] = v;
    }
  }

  out.siteName = out.siteName || raw["Site ID"] || "";
  out.currentAvb = out.currentAvb ?? 0;
  out.monthlyAvb = out.monthlyAvb ?? out.currentAvb ?? 0;
  out.dailyData = Object.keys(dailyData).length > 0 ? dailyData : undefined;

  return out as SiteData;
}

function parseFloatSafe(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.toString().replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
