import React, { useState, useMemo, useEffect, Fragment } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, ChevronUp, Fuel, LayoutDashboard, Search, TrendingDown, RefreshCw, FileSpreadsheet } from "lucide-react";
import { ComposedChart, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import type { SheetPayload } from "./types";

// Fuel-only dashboard, extracted from App.tsx. Shared visual theme is loaded by App.tsx.

function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert("No data to export");
    return;
  }
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    ),
  ];
  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportToExcel(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert("No data to export");
    return;
  }
  const headers = Object.keys(data[0]);
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:x="urn:schemas-microsoft-com:office:excel" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Sheet1</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              (row) => `
            <tr>
              ${headers.map((h) => `<td>${row[h] ?? ""}</td>`).join("")}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


function ExportButtonComponent({
  data,
  filename,
  label = "Export",
  format = "excel",
  variant = "primary",
}: {
  data: any[];
  filename: string;
  label?: string;
  format?: "excel" | "csv";
  variant?: "primary" | "secondary" | "danger" | "success";
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    if (!data || data.length === 0) {
      alert("No data available to export");
      return;
    }
    setIsExporting(true);
    try {
      if (format === "csv") {
        exportToCSV(data, filename);
      } else {
        exportToExcel(data, filename);
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const variantStyles = {
    primary: "bg-cyan-500 hover:bg-cyan-400 text-slate-950",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200",
    danger: "bg-red-500 hover:bg-red-400 text-white",
    success: "bg-emerald-500 hover:bg-emerald-400 text-white",
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || !data || data.length === 0}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
        variantStyles[variant]
      } ${isExporting || !data || data.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {isExporting ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <FileSpreadsheet className="w-4 h-4" />
          {label}
        </>
      )}
    </button>
  );
}


// ============================================================
//  FUEL HISTORY — YEAR-ON-YEAR / WORST SITES / DAILY MONITORING
// ============================================================

type FuelSubTab = "summary" | "yoy" | "currentMonth" | "deviation";
type FuelView = "overall" | "C-1" | "C-6";

type FuelRow = {
  siteId: string;
  grid: string;
  month: string;
  refuelingTime: string;
  beforeQty: number;
  filledQty: number;
  year: number;
  date: Date | null;
};

const FUEL_MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Google Fuel History uses both "Sep" and "Sept". Normalize before ALL calculations.
function fuelMonthLabel(raw: any): string {
  const token = String(raw ?? "").trim().split("-")[0].trim().toLowerCase();
  if (!token) return "";
  const i = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].findIndex(m => token.startsWith(m));
  return i >= 0 ? FUEL_MONTH_ORDER[i] : "";
}

function fuelNumber(value: any): number {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function fuelRegion(grid: string): "C-1" | "C-6" | "Other" {
  const g = String(grid ?? "").trim().toUpperCase().replace(/[\s_-]/g, "");
  if (/^C1\d{3}$/.test(g)) return "C-1";
  if (/^C6\d{3}$/.test(g)) return "C-6";
  return "Other";
}

function fuelDate(value: any): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // Google Sheets can provide DD/MM/YYYY HH:mm:ss, a comma before time,
  // 12-hour AM/PM timestamps, ISO timestamps, or numeric spreadsheet serials.
  if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return Number.isFinite(d.getTime()) ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()) : null;
  }
  const cleaned = raw.replace(/,\s*(?=\d{1,2}:\d{2})/, " ").replace(/\s+/g, " ").trim();
  const dayFirst = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?)?$/i);
  const isoLocal = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?\s*(AM|PM)?)?$/i);
  const m = dayFirst || isoLocal;
  if (m) {
    const year = Number(dayFirst ? m[3] : m[1]);
    const month = Number(dayFirst ? m[2] : m[2]) - 1;
    const day = Number(dayFirst ? m[1] : m[3]);
    let hour = Number(m[4] ?? 0);
    const minute = Number(m[5] ?? 0);
    const second = Number(m[6] ?? 0);
    const meridiem = (m[7] || "").toUpperCase();
    if (meridiem) {
      if (hour < 1 || hour > 12) return null;
      hour = (hour % 12) + (meridiem === "PM" ? 12 : 0);
    }
    const d = new Date(year, month, day, hour, minute, second);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day &&
      d.getHours() === hour && d.getMinutes() === minute && d.getSeconds() === second ? d : null;
  }
  // ISO 8601 timestamps with an explicit timezone offset or Z.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(cleaned) && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(cleaned)) {
    const d = new Date(cleaned);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function parseFuelRows(data: SheetPayload | null): FuelRow[] {
  if (!data?.rows?.length) return [];
  return data.rows.map((row: Record<string, any>) => {
    const siteId = String(row["Site ID Name"] ?? row["Site ID"] ?? row["Site"] ?? "").trim();
    const grid = String(row["Grid"] ?? "").trim();
    const rawMonth = String(row["Month"] ?? row["Month_1"] ?? row["Month 2"] ?? "").trim();
    const month = fuelMonthLabel(rawMonth) || fuelMonthLabel(row["Month_1"]) || fuelMonthLabel(row["Month 2"]);
    const refuelingTime = String(row["Refueling Time"] ?? row["Refilling Time"] ?? "").trim();
    const yearFromCol = fuelNumber(row["Year"]);
    const yearFromMonth = rawMonth.match(/-(\d{2,4})$/);
    const year = yearFromCol || (yearFromMonth ? Number(yearFromMonth[1].length === 2 ? `20${yearFromMonth[1]}` : yearFromMonth[1]) : 0);
    return {
      siteId,
      grid,
      month,
      refuelingTime,
      beforeQty: fuelNumber(row["Before Filling Fuel Quantity"]),
      filledQty: fuelNumber(row["Fuel Quantity Filled"]),
      year,
      date: fuelDate(refuelingTime),
    };
  }).filter(r => r.filledQty >= 0 && r.year > 0);
}

// Ticket-to-ticket Fueler vs EASS reconciliation (live "Deviation Fuel" sheet).
type FuelDeviationTicket = {
  reconDate: string; lfd: string; fuelToRecon: number | null; beforeFuel: number | null;
  fueler: number | null; hours: number | null; eass: number | null;
  deviation: number | null; status: "Positive" | "Negative" | "Normal" | "Missing";
};
type FuelDeviationSite = {
  siteId: string; grid: string; region: string; revenue: string; hubType: string;
  owner: string; gtl: string; lead: string; rating: string; benchmark: number | null;
  tickets: FuelDeviationTicket[]; positiveLitres: number; negativeLitres: number;
  positiveCount: number; netDeviation: number; latestStatus: FuelDeviationTicket["status"];
};
const deviationNumeric = (value: unknown): number | null => {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw || raw === "-" || raw.toLowerCase() === "n/a") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};
const deviationStatus = (value: number | null): FuelDeviationTicket["status"] =>
  value === null ? "Missing" : value > 10 ? "Positive" : value < -20 ? "Negative" : "Normal";

function parseDeviationSites(payload: SheetPayload | null): FuelDeviationSite[] {
  if (!payload?.rows?.length) return [];
  return payload.rows.map((row: Record<string, any>) => {
    const values = Object.values(row);
    // Sheets containing repeated header labels may be returned as indexed or suffixed keys.
    // When all 72 source columns survive, use the stable Google Sheet column positions.
    const complete = values.length >= 72;
    const get = (index: number, ...names: string[]) => {
      if (complete) return values[index];
      for (const name of names) if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];
      return undefined;
    };
    const groups = [
      [34,35,36,37,38,39,40,41],
      [43,44,45,46,47,48,49,50],
      [52,53,54,55,56,57,58,59],
      [61,62,63,64,65,66,67,68],
    ];
    const tickets: FuelDeviationTicket[] = groups.map((idx, i) => {
      const suffix = i === 0 ? "" : `_${i}`;
      const alt = i === 0 ? "" : `_${i+1}`;
      const read = (offset: number, key: string) => get(idx[offset], `${key}${suffix}`, `${key}${alt}`, `${key} ${i+1}`);
      const fueler = deviationNumeric(read(4, "Fuel Consumed as per Fueler"));
      const eass = deviationNumeric(read(6, "Fuel consumed as per EASS"));
      const rawDev = deviationNumeric(read(7, "Deviaiton"));
      const dev = rawDev ?? (fueler !== null && eass !== null ? fueler - eass : null);
      return {
        reconDate: String(read(0, "Fuel Recon Date") ?? "-").trim(),
        lfd: String(read(1, i === 0 ? "LFD" : `${i+1}${i===1?"nd":i===2?"rd":"th"} LFD`) ?? "-").trim(),
        fuelToRecon: deviationNumeric(read(2, "Fuel to Recon")),
        beforeFuel: deviationNumeric(read(3, "Before Fuel")),
        fueler, hours: deviationNumeric(read(5, "EASS DG running")), eass,
        deviation: dev, status: deviationStatus(dev),
      };
    });
    const siteId = String(get(0, "SITE ID", "Site ID") ?? "").trim();
    const grid = String(get(26, "Grid") ?? "").trim().toUpperCase();
    const positive = tickets.filter(t => t.status === "Positive");
    const negative = tickets.filter(t => t.status === "Negative");
    return {
      siteId, grid,
      hubType: String(get(24, "HUB/Single", "Hub/Single") ?? "").trim(),
      region: String(get(6, "Sub-Region") ?? "").trim(),
      revenue: String(get(1, "Revenue Category") ?? "").trim(),
      owner: String(get(15, "Cluster Owner") ?? "").trim(),
      gtl: String(get(16, "MS GTL") ?? "").trim(),
      lead: String(get(17, "Zone Lead") ?? "").trim(),
      rating: String(get(13, "DG Rating") ?? "").trim(),
      benchmark: deviationNumeric(get(27, "BM")), tickets,
      positiveLitres: positive.reduce((sum,t) => sum + (t.deviation ?? 0),0),
      negativeLitres: negative.reduce((sum,t) => sum + (t.deviation ?? 0),0),
      positiveCount: positive.length,
      netDeviation: tickets.reduce((sum,t) => sum + (t.deviation ?? 0),0),
      latestStatus: tickets[0].status,
    };
  }).filter(s => s.siteId && s.grid);
}

function FuelDeviationPage({ payload, region, onRegionChange }: { payload: SheetPayload | null; region: FuelView; onRegionChange: (next: FuelView) => void }) {
  const sites = useMemo(() => parseDeviationSites(payload), [payload]);
  const [grid, setGrid] = useState("__all");
  const [category, setCategory] = useState("__all");
  const [owner, setOwner] = useState("__all");
  const [query, setQuery] = useState("");
  const [siteQuery, setSiteQuery] = useState("");
  const [deviationMode, setDeviationMode] = useState<"positive" | "negative">("positive");
  const [worstLimit, setWorstLimit] = useState(20);
  const [expandedGrid, setExpandedGrid] = useState<string | null>(null);
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);
  const [ticketView, setTicketView] = useState<"all" | "latest">("all");
  const fmt = (n: number) => n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const scoped = useMemo(() => sites.filter(s => region === "overall" || fuelRegion(s.grid) === region),[sites,region]);
  const gridList = useMemo(() => [...new Set(scoped.map(s => s.grid))].sort(), [scoped]);
  const categories = useMemo(() => [...new Set(scoped.map(s => s.revenue))].filter(Boolean).sort(),[scoped]);
  const owners = useMemo(() => [...new Set(scoped.map(s => s.owner))].filter(Boolean).sort(),[scoped]);
  const base = useMemo(() => scoped.filter(s => (grid === "__all" || s.grid === grid) && (category === "__all" || s.revenue === category) && (owner === "__all" || s.owner === owner) && (!query || [s.siteId,s.grid,s.owner,s.gtl,s.lead].some(v=>v.toLowerCase().includes(query.toLowerCase())))),[scoped,grid,category,owner,query]);
  const positiveOf = (s: FuelDeviationSite) => ticketView === "latest" ? (s.tickets[0].status === "Positive" ? s.tickets[0].deviation ?? 0 : 0) : s.positiveLitres;
  const grossPositive = base.reduce((sum,s)=>sum+s.positiveLitres,0);
  const latestPositive = base.reduce((sum,s) => sum + (s.tickets[0].status === "Positive" ? s.tickets[0].deviation ?? 0 : 0),0);
  const latestPositiveSites = base.filter(s => s.latestStatus === "Positive").length;
  const historicalPositiveSites = base.filter(s => s.positiveCount > 0).length;
  const recurring = base.filter(s => s.positiveCount >= 2).length;
  const worst = [...base].filter(s=>s.positiveLitres>0).sort((a,b)=>b.positiveLitres-a.positiveLitres).slice(0,worstLimit);
  const grids = gridList.map(g => {
    const rows = base.filter(s=>s.grid===g);
    return {grid:g, sites:rows.length, positiveSites:rows.filter(s=>s.positiveCount>0).length,
      latestSites:rows.filter(s=>s.latestStatus==="Positive").length,
      positiveLitres:rows.reduce((sum,s)=>sum+s.positiveLitres,0),
      chartLitres:rows.reduce((sum,s)=>sum+positiveOf(s),0),
      latestLitres:rows.reduce((sum,s)=>sum+(s.latestStatus==="Positive" ? s.tickets[0].deviation ?? 0:0),0)};
  }).filter(g=>g.sites).sort((a,b)=>b.positiveLitres-a.positiveLitres);
  // Regional management snapshot uses the same filtered grid calculations as Grid Summary.
  const regionalOverview = (["C-1", "C-6"] as const).map(r => {
    const regionGrids = grids.filter(g => fuelRegion(g.grid) === r);
    const worstGrid = regionGrids[0]; // grids are already sorted by gross positive liters
    return {
      region: r,
      sites: regionGrids.reduce((n,g)=>n+g.sites,0),
      gross: regionGrids.reduce((n,g)=>n+g.positiveLitres,0),
      latest: regionGrids.reduce((n,g)=>n+g.latestLitres,0),
      affected: regionGrids.reduce((n,g)=>n+g.positiveSites,0),
      worstGrid,
    };
  });
  // Advisory-only audit triage. Historical deviation is not a fuel-level measurement.
  // Never automatically stop an approved refill or essential DG supply on this basis.
  const fuelAuditRecommendations = useMemo(() => base.map(s => {
    const valid = s.tickets.filter(t => t.deviation !== null);
    const latest = s.tickets[0];
    const priorPositive = s.tickets.slice(1).filter(t => t.status === "Positive").length;
    const latestPositive = latest.status === "Positive";
    const recurringPositive = s.positiveCount >= 2;
    const elevated = latestPositive && recurringPositive;
    const historical = !latestPositive && priorPositive >= 2;
    const priority = elevated ? 0 : latestPositive ? 1 : historical ? 2 : 3;
    const recommendation = elevated ? "Verify before next routine refill" : latestPositive ? "Check latest ticket before refill" : historical ? "Monitor; review earlier tickets" : "Routine refueling policy";
    const reason = elevated ? `Latest +ive ticket; ${s.positiveCount}/4 tickets positive` : latestPositive ? "Latest ticket exceeds +10 L" : historical ? `${priorPositive} earlier positive tickets; latest not positive` : "No current positive-deviation trigger";
    return {site:s, validCount:valid.length, priority, recommendation, reason};
  }).sort((a,b)=>a.priority-b.priority || b.site.positiveLitres-a.site.positiveLitres),[base]);
  const hubCategories = ["PTN Node", "Critical Hub (10 ++)", "Major Hub(5~10)", "Minor Hub (1~4)", "Single"];
  const normalizeHub = (raw: string) => {
    const name = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (name.includes("ptn")) return "PTN Node";
    if (name.includes("critical")) return "Critical Hub (10 ++)";
    if (name.includes("major")) return "Major Hub(5~10)";
    if (name.includes("minor")) return "Minor Hub (1~4)";
    if (name.includes("single")) return "Single";
    return "Unclassified";
  };
  const hubSummary = [...hubCategories, "Unclassified"].map(hub => {
    const rows = base.filter(s => normalizeHub(s.hubType) === hub);
    return {hub, sites:rows.length, affected:rows.filter(s=>s.positiveCount>0).length,
      latestSites:rows.filter(s=>s.latestStatus==="Positive").length,
      recurring:rows.filter(s=>s.positiveCount>=2).length,
      gross:rows.reduce((sum,s)=>sum+s.positiveLitres,0),
      latest:rows.reduce((sum,s)=>sum+(s.latestStatus==="Positive"?(s.tickets[0].deviation??0):0),0),
      lowPriority: hub !== "PTN Node" && hub !== "Critical Hub (10 ++)",
    };
  }).filter(r=>r.sites>0).sort((a,b)=>b.gross-a.gross);
  const worstHub = hubSummary[0];
  const [hubFocus,setHubFocus] = useState("__all");
  const auditByHub = fuelAuditRecommendations.filter(r=>hubFocus==="__all" || normalizeHub(r.site.hubType)===hubFocus);
  const verificationCount = fuelAuditRecommendations.filter(r=>r.priority <= 1).length;
  const [auditShowAll,setAuditShowAll] = useState(false);
  const exportRows = base.map(s=>({"Site ID":s.siteId,Grid:s.grid,"Revenue Category":s.revenue,"Cluster Owner":s.owner,"MS GTL":s.gtl,"Zone Lead":s.lead,"DG Rating":s.rating,"HUB/Single":s.hubType,"BM":s.benchmark,
    ...Object.fromEntries(s.tickets.flatMap((t,i)=>[[`Ticket ${i+1} LFD`,t.lfd],[`Ticket ${i+1} Recon Date`,t.reconDate],[`Ticket ${i+1} Fueler L`,t.fueler],[`Ticket ${i+1} EASS L`,t.eass],[`Ticket ${i+1} Deviation L`,t.deviation],[`Ticket ${i+1} Status`,t.status]])),
    "Gross Positive L":s.positiveLitres,"Gross Negative L":s.negativeLitres,"Net Deviation L":s.netDeviation,"Positive Ticket Count":s.positiveCount,"Latest Status":s.latestStatus}));
  // Site query always searches the full live Deviation Fuel payload, regardless of page filters.
  const siteQueryMatches = useMemo(() => {
    const id = siteQuery.trim().toLowerCase();
    return id ? sites.filter(s => s.siteId.toLowerCase() === id) : [];
  }, [sites, siteQuery]);
  const siteQueryExport = useMemo(() => siteQueryMatches.flatMap(s => s.tickets.map((t,i) => ({
    "Site ID":s.siteId, "Grid":s.grid, "Sub-Region":s.region, "Revenue Category":s.revenue,
    "Cluster Owner":s.owner, "MS GTL":s.gtl, "Zone Lead":s.lead, "DG Rating":s.rating,
    "Hub Category":s.hubType, "Benchmark":s.benchmark ?? "", "Ticket":i+1,
    "Fuel Recon Date":t.reconDate, "Last Fueling Date":t.lfd,
    "Fuel to Reconcile (L)":t.fuelToRecon ?? "", "Before Fuel (L)":t.beforeFuel ?? "",
    "Fueler Consumption (L)":t.fueler ?? "", "EASS DG Running (Hrs)":t.hours ?? "",
    "EASS Consumption (L)":t.eass ?? "", "Deviation (L)":t.deviation ?? "", "Status":t.status,
  }))), [siteQueryMatches]);
  const selectClass = "h-11 w-full min-w-0 rounded-xl border border-emerald-200 bg-white/90 px-3 text-[14px] font-semibold text-slate-800 shadow-sm outline-none transition-all duration-200 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-200";
  const headClass = "sticky top-0 z-10 whitespace-nowrap bg-[#075B39] px-4 py-3 text-left text-[13px] font-bold tracking-[0.01em] text-white";
  const numberHead = headClass + " text-right";
  const cellClass = "whitespace-nowrap px-4 py-3 text-[14px] font-medium text-slate-800";
  const numClass = cellClass + " text-right tabular-nums";
  const statusBadge = (status: FuelDeviationTicket["status"]) => <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${status==="Positive"?"bg-red-50 text-red-700":status==="Negative"?"bg-slate-100 text-slate-700":status==="Normal"?"bg-emerald-50 text-emerald-700":"bg-slate-100 text-slate-500"}`}>{status==="Missing"?"N/A":status}</span>;
  const renderSiteTable = (rows: FuelDeviationSite[], showGrid: boolean) => <div className="max-w-full overflow-x-auto rounded-md border border-slate-200"><table className="w-full min-w-[1250px] border-separate border-spacing-0 text-[13px]"><thead><tr>
    <th className={headClass}>Site ID</th>{showGrid&&<th className={headClass}>Grid</th>}<th className={headClass}>Revenue</th><th className={headClass}>CO</th>
    <th className={headClass}>Latest Fuel Date</th><th className={numberHead}>Latest (L)</th><th className={numberHead}>2nd (L)</th><th className={numberHead}>3rd (L)</th><th className={numberHead}>4th (L)</th><th className={numberHead}>Gross +ive (L)</th><th className={numberHead}>+ive Tickets</th><th className={headClass}>Latest Remarks</th>
  </tr></thead><tbody>{rows.map(s=><tr key={`${s.grid}-${s.siteId}`} className="border-b border-slate-100 even:bg-[#f8faf9] hover:bg-emerald-50/80 transition-colors">
    <td className={cellClass+" font-bold text-slate-900"}>{s.siteId}</td>{showGrid&&<td className={cellClass}>{s.grid}</td>}<td className={cellClass}>{s.revenue||"—"}</td><td className={cellClass}>{s.owner||"—"}</td>
    <td className={cellClass+" font-medium"}>{s.tickets[0].reconDate && s.tickets[0].reconDate!=="-" ? s.tickets[0].reconDate : "—"}</td>
    {s.tickets.map((t,i)=><td key={i} className={`${numClass} ${t.status==="Positive"?"font-bold text-red-700":""}`}><div>{t.deviation===null?"—":fmt(t.deviation)}</div><div className="mt-0.5 text-[11px] font-normal text-slate-500" title={`Fuel reconciliation date · LFD: ${t.lfd}`}>{t.reconDate && t.reconDate!=="-" ? t.reconDate : "No date"}</div></td>)}
    <td className={numClass+" font-bold text-red-700"}>{fmt(s.positiveLitres)}</td><td className={numClass+" font-semibold"}>{s.positiveCount}</td><td className={cellClass}>{statusBadge(s.latestStatus)}</td>
  </tr>)}</tbody></table>{!rows.length&&<div className="p-4 text-sm text-slate-500">No sites match the selected filters.</div>}</div>;
  if (!payload) return <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">Deviation Fuel tab could not be loaded. Confirm the tab is named <b>Deviation Fuel</b> in the October Google Sheet.</div>;
  if (!sites.length) return <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">No valid site records found in Deviation Fuel. Verify SITE ID, Grid and ticket columns.</div>;
  // Negative deviation is presented as a positive magnitude for ranking, while
  // individual ticket values retain their original negative sign.
  const negativeMagnitude = (s: FuelDeviationSite) => Math.abs(s.negativeLitres);
  const latestNegative = (s: FuelDeviationSite) => s.tickets[0]?.status === "Negative" ? Math.abs(s.tickets[0].deviation ?? 0) : 0;
  const negativeCount = (s: FuelDeviationSite) => s.tickets.filter(t => t.status === "Negative").length;
  const negativeGross = base.reduce((n,s) => n + negativeMagnitude(s), 0);
  const negativeLatestGross = base.reduce((n,s) => n + latestNegative(s), 0);
  const negativeAffected = base.filter(s => negativeCount(s)>0).length;
  const negativeRecurring = base.filter(s => negativeCount(s)>=2).length;
  const negativeGrids = gridList.map(g => {
    const group = base.filter(s=>s.grid===g);
    return {grid:g,sites:group.length,affected:group.filter(s=>negativeCount(s)>0).length,
      latestSites:group.filter(s=>s.latestStatus==="Negative").length,
      gross:group.reduce((n,s)=>n+negativeMagnitude(s),0),
      latest:group.reduce((n,s)=>n+latestNegative(s),0),
      chartLitres:group.reduce((n,s)=>n+(ticketView==="latest"?latestNegative(s):negativeMagnitude(s)),0)};
  }).filter(g=>g.sites).sort((a,b)=>b.gross-a.gross);
  const negativeWorst = [...base].filter(s=>negativeMagnitude(s)>0).sort((a,b)=>negativeMagnitude(b)-negativeMagnitude(a)).slice(0,worstLimit);
  // Recurring-site exports use the same >+10 L / <-20 L exception rules as the KPI cards.
  // Include only sites with at least two qualifying tickets, independent of latest status.
  const recurringSiteExport = (mode: "positive" | "negative") => {
    const isNegative = mode === "negative";
    return base.filter(s => isNegative ? negativeCount(s) >= 2 : s.positiveCount >= 2)
      .sort((a,b) => isNegative ? negativeMagnitude(b)-negativeMagnitude(a) : b.positiveLitres-a.positiveLitres)
      .map(s => ({
        "Site ID":s.siteId,"Grid":s.grid,"Sub-Region":s.region,"Revenue Category":s.revenue,
        "Cluster Owner":s.owner,"MS GTL":s.gtl,"Zone Lead":s.lead,
        "DG Rating":s.rating,"Hub Category":s.hubType,"BM":s.benchmark,
        "Recurring Tickets":isNegative ? negativeCount(s) : s.positiveCount,
        "Gross Positive (L)":s.positiveLitres,
        "Gross Negative Magnitude (L)":negativeMagnitude(s),
        "Net Deviation (L)":s.netDeviation,"Latest Ticket Status":s.latestStatus,
        ...Object.fromEntries(s.tickets.flatMap((t,i) => [
          [`Ticket ${i+1} Recon Date`,t.reconDate],[`Ticket ${i+1} LFD`,t.lfd],
          [`Ticket ${i+1} Fueler (L)`,t.fueler],[`Ticket ${i+1} DG Hours`,t.hours],
          [`Ticket ${i+1} EASS (L)`,t.eass],[`Ticket ${i+1} Deviation (L)`,t.deviation],
          [`Ticket ${i+1} Status`,t.status]
        ]))
      }));
  };
  const negativeExport = base.map(s=>({"Site ID":s.siteId,Grid:s.grid,"Revenue Category":s.revenue,"Cluster Owner":s.owner,"MS GTL":s.gtl,"Zone Lead":s.lead,
    "Latest Ticket Deviation L":s.tickets[0]?.deviation ?? "", "Latest Ticket Status":s.latestStatus,
    "Negative Tickets":negativeCount(s),"Gross Negative L (signed)":s.negativeLitres,"Gross Negative Magnitude L":negativeMagnitude(s),
    ...Object.fromEntries(s.tickets.flatMap((t,i)=>[[`Ticket ${i+1} Date`,t.reconDate],[`Ticket ${i+1} Deviation L`,t.deviation ?? ""],[`Ticket ${i+1} Status`,t.status]]))}));
  const modeSwitcher = <div className="flex flex-wrap gap-2 rounded-xl border border-blue-200 bg-blue-50 p-2">
    <button type="button" onClick={()=>{setDeviationMode("positive");setExpandedGrid(null);}} className={`rounded-lg px-5 py-2.5 text-sm font-extrabold ${deviationMode==="positive"?"bg-blue-800 text-white shadow":"bg-white text-blue-900"}`}>Positive Variance</button>
    <button type="button" onClick={()=>{setDeviationMode("negative");setExpandedGrid(null);}} className={`rounded-lg px-5 py-2.5 text-sm font-extrabold ${deviationMode==="negative"?"bg-blue-800 text-white shadow":"bg-white text-blue-900"}`}>Negative Variance</button>
  </div>;
  const negativeTable = (list: FuelDeviationSite[], showGrid=true) => <div className="max-w-full overflow-x-auto rounded-lg border border-slate-300"><table className="w-full min-w-[1150px] border-collapse text-sm"><thead><tr>
    {(["Site ID",...(showGrid?["Grid"]:[]),"Revenue","CO","Latest Date","Latest (L)","2nd (L)","3rd (L)","4th (L)","Gross Negative (L)","Negative Tickets","Latest Status"] as string[]).map(h=><th key={h} className="border border-blue-700 bg-blue-900 px-3 py-3 text-center align-middle font-bold text-white">{h}</th>)}
    </tr></thead><tbody>{list.map(s=><tr key={`${s.grid}-${s.siteId}`} className="border-b border-slate-100 even:bg-blue-50/40">
      <td className="border border-slate-300 px-3 py-3 text-center align-middle font-bold text-blue-900">{s.siteId}</td>{showGrid&&<td className="border border-slate-300 px-3 py-3 text-center align-middle">{s.grid}</td>}<td className="border border-slate-300 px-3 py-3 text-center align-middle">{s.revenue||"—"}</td><td className="border border-slate-300 px-3 py-3 text-center align-middle">{s.owner||"—"}</td>
      <td className="border border-slate-300 px-3 py-3 text-center align-middle">{s.tickets[0]?.reconDate||"—"}</td>{s.tickets.map((t,i)=><td key={i} className={`border border-slate-300 px-3 py-3 text-center align-middle font-semibold tabular-nums ${t.status==="Negative"?"text-amber-800":"text-slate-700"}`}>{t.deviation===null?"—":fmt(t.deviation)}</td>)}
      <td className="border border-slate-300 px-3 py-3 text-center align-middle text-center font-extrabold text-amber-800">{fmt(negativeMagnitude(s))}</td><td className="border border-slate-300 px-3 py-3 text-center align-middle text-center font-bold">{negativeCount(s)}</td><td className="border border-slate-300 px-3 py-3 text-center align-middle">{statusBadge(s.latestStatus)}</td>
    </tr>)}</tbody></table>{!list.length&&<p className="p-4 text-sm text-slate-500">No negative-deviation sites found.</p>}</div>;
  // CO accountability: calculate exceptions from all four tickets without netting opposite signs.
  // The table is shared by Positive and Negative Variance views.
  const coGroups = [...new Set(base.map(s => s.owner.trim() || "Unassigned"))].map(name => {
    const group = base.filter(s => (s.owner.trim() || "Unassigned") === name);
    const negative = deviationMode === "negative";
    const amount = (s: FuelDeviationSite) => negative ? negativeMagnitude(s) : s.positiveLitres;
    const latest = (s: FuelDeviationSite) => negative ? latestNegative(s) : (s.latestStatus === "Positive" ? (s.tickets[0]?.deviation ?? 0) : 0);
    const count = (s: FuelDeviationSite) => negative ? negativeCount(s) : s.positiveCount;
    return {name, group, sites:group.length, affected:group.filter(s=>count(s)>0).length,
      latestSites:group.filter(s=>latest(s)>0).length, recurring:group.filter(s=>count(s)>=2).length,
      gross:group.reduce((n,s)=>n+amount(s),0), latest:group.reduce((n,s)=>n+latest(s),0)};
  }).filter(c=>c.affected>0).sort((a,b)=>b.gross-a.gross);
  const coExport = coGroups.map(c=>({"Cluster Owner":c.name,"Total Sites":c.sites,"Affected Sites":c.affected,
    "Gross Deviation (L)":c.gross,"Latest Deviation (L)":c.latest,"Latest Affected Sites":c.latestSites,"Recurring Sites":c.recurring}));
  const coSummaryView = <section className="min-w-0 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 px-5 py-4">
      <div><h3 className="text-base font-extrabold text-blue-950">Cluster Owner Performance · Worst First</h3>
      <p className="mt-1 text-xs text-slate-600">{deviationMode === "negative" ? "Negative below −20 L · absolute litres" : "Positive above +10 L"} · Click View Sites for CO-wise investigation</p></div>
      <ExportButtonComponent data={coExport} filename={`Fuel_${deviationMode}_CO_Performance`} label="Export CO Summary" format="excel" variant="success"/>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[930px] border-collapse text-sm">
      <thead><tr>{["Rank","Cluster Owner","Sites","Affected Sites","Gross Deviation (L)","Latest Deviation (L)","Latest Sites","Recurring Sites","Action"].map(h=><th key={h} className="border border-blue-700 bg-blue-900 px-3 py-3 text-center align-middle font-bold text-white">{h}</th>)}</tr></thead>
      <tbody>{coGroups.map((c,i)=><React.Fragment key={c.name}>
        <tr className="even:bg-blue-50/40 hover:bg-blue-50">
          <td className="border border-slate-300 px-3 py-3 text-center font-bold">{i+1}</td>
          <td className="border border-slate-300 px-3 py-3 text-center font-bold text-blue-900">{c.name}</td>
          <td className="border border-slate-300 px-3 py-3 text-center">{c.sites}</td>
          <td className="border border-slate-300 px-3 py-3 text-center">{c.affected}</td>
          <td className={`border border-slate-300 px-3 py-3 text-center font-extrabold ${deviationMode === "negative" ? "text-amber-800" : "text-red-700"}`}>{fmt(c.gross)}</td>
          <td className="border border-slate-300 px-3 py-3 text-center font-bold">{fmt(c.latest)}</td>
          <td className="border border-slate-300 px-3 py-3 text-center">{c.latestSites}</td>
          <td className="border border-slate-300 px-3 py-3 text-center">{c.recurring}</td>
          <td className="border border-slate-300 px-3 py-3 text-center"><button type="button" onClick={()=>setExpandedOwner(expandedOwner===c.name?null:c.name)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900 hover:bg-blue-100">{expandedOwner===c.name?"Hide Sites ↑":"View Sites ↓"}</button></td>
        </tr>
        {expandedOwner===c.name&&<tr><td colSpan={9} className="border border-slate-300 bg-blue-50 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-blue-950">{c.name} · {c.affected} affected sites · Worst first</strong>
            <ExportButtonComponent data={c.group.map(s=>({"Site ID":s.siteId,"Grid":s.grid,"CO":s.owner,"Latest Deviation (L)":s.tickets[0]?.deviation??"","Gross Positive (L)":s.positiveLitres,"Gross Negative Magnitude (L)":negativeMagnitude(s),"Positive Tickets":s.positiveCount,"Negative Tickets":negativeCount(s)}))} filename={`Fuel_${deviationMode}_CO_${c.name.replace(/[^a-z0-9]/gi,"_")}`} label="Export Sites" format="excel" variant="success"/></div>
          {deviationMode==="negative" ? negativeTable(c.group.filter(s=>negativeMagnitude(s)>0).sort((a,b)=>negativeMagnitude(b)-negativeMagnitude(a)),true)
            : renderSiteTable(c.group.filter(s=>s.positiveLitres>0).sort((a,b)=>b.positiveLitres-a.positiveLitres),true)}
        </td></tr>}
      </React.Fragment>)}</tbody>
    </table>{!coGroups.length&&<p className="p-4 text-sm text-slate-500">No cluster owners with deviations under the selected filters.</p>}</div>
  </section>;
  if (deviationMode === "negative") return <div className="fuel-deviation-premium min-w-0 space-y-4 p-2 text-slate-900 sm:p-4">
    {modeSwitcher}
    <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-extrabold text-blue-950">Negative Fuel Variance <span className="text-sm font-medium text-slate-500">· Fueler vs EASS</span></h2><p className="mt-1 text-xs text-slate-600">Negative exception: deviation below −20 L · Worst ranked by absolute negative litres, without offsetting positives</p></div>
        <div className="flex gap-1 rounded-lg border border-blue-200 bg-blue-50 p-1">{(["overall","C-1","C-6"] as FuelView[]).map(v=><button key={v} onClick={()=>{onRegionChange(v);setGrid("__all");setExpandedGrid(null);}} className={`rounded-md px-3 py-2 text-sm font-bold ${region===v?"bg-blue-800 text-white":"text-blue-900"}`}>{v==="overall"?"Overall":v}</button>)}</div></div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4 lg:grid-cols-5">
        <select aria-label="Ticket period" value={ticketView} onChange={e=>setTicketView(e.target.value as "all"|"latest")} className={selectClass}><option value="all">Last 4 Tickets</option><option value="latest">Latest Ticket</option></select>
        <select aria-label="Grid" value={gridList.includes(grid)?grid:"__all"} onChange={e=>{setGrid(e.target.value);setExpandedGrid(null);}} className={selectClass}><option value="__all">All Grids</option>{gridList.map(g=><option key={g}>{g}</option>)}</select>
        <select aria-label="Revenue" value={category} onChange={e=>setCategory(e.target.value)} className={selectClass}><option value="__all">All Revenue Categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select>
        <select aria-label="Cluster Owner" value={owner} onChange={e=>setOwner(e.target.value)} className={selectClass}><option value="__all">All Cluster Owners</option>{owners.map(o=><option key={o}>{o}</option>)}</select>
        <input aria-label="Search sites" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search site / CO" className={selectClass}/>
      </div>
    </section>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ["Gross Negative Deviation",`${fmt(negativeGross)} L`,"Absolute magnitude · 4 tickets"],
      ["Latest Ticket Negative",`${fmt(negativeLatestGross)} L`,"Latest negative exceptions"],
      ["Affected Sites",String(negativeAffected),`Of ${base.length} selected sites`],
      ["Recurring Sites",String(negativeRecurring),"Negative in 2+ tickets"]
    ].map(([label,value,sub])=><div key={label} className="rounded-xl border border-blue-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-600">{label}</p><p className="mt-2 text-2xl font-black tabular-nums text-amber-800">{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p>{label==="Recurring Sites"&&<div className="mt-3"><ExportButtonComponent data={recurringSiteExport("negative")} filename="Fuel_Negative_Recurring_Sites" label="Export Recurring Sites" format="excel" variant="success"/></div>}</div>)}</section>
    {region==="overall"&&<section className="grid grid-cols-1 gap-3 md:grid-cols-2">{(["C-1","C-6"] as const).map(r=>{const x=negativeGrids.filter(g=>fuelRegion(g.grid)===r);return <div key={r} className="rounded-xl border border-blue-200 bg-white p-4"><div className="flex items-center justify-between"><h3 className="font-extrabold text-blue-900">Central-{r.slice(-1)}</h3><button className="text-sm font-bold text-blue-800 underline" onClick={()=>onRegionChange(r)}>View {r}</button></div><p className="mt-2 text-xl font-extrabold text-amber-800">{fmt(x.reduce((n,g)=>n+g.gross,0))} L</p><p className="text-sm text-slate-600">Worst grid: {x[0]?.grid??"—"} · {x.reduce((n,g)=>n+g.affected,0)} affected sites</p></div>})}</section>}
    {coSummaryView}
    <section className="rounded-xl border border-blue-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4"><h3 className="font-extrabold text-blue-950">Grid Summary · Worst Negative First</h3><ExportButtonComponent data={negativeGrids} filename="Fuel_Negative_Grid_Summary" label="Export Grids" format="excel" variant="success"/></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] border-collapse text-sm"><thead><tr>{["Grid","Sites","Negative Sites","Gross Negative (L)","Latest Negative (L)","Latest Sites","Action"].map(h=><th key={h} className="border border-blue-700 bg-blue-900 px-3 py-3 text-center align-middle font-bold text-white">{h}</th>)}</tr></thead><tbody>{negativeGrids.map(g=><React.Fragment key={g.grid}><tr className="border-b border-slate-100 even:bg-blue-50/40"><td className="border border-slate-300 px-3 py-3 text-center align-middle font-bold">{g.grid}</td><td className="border border-slate-300 px-3 py-3 text-center align-middle">{g.sites}</td><td className="border border-slate-300 px-3 py-3 text-center align-middle">{g.affected}</td><td className="border border-slate-300 px-3 py-3 text-center align-middle font-extrabold text-amber-800">{fmt(g.gross)}</td><td className="border border-slate-300 px-3 py-3 text-center align-middle">{fmt(g.latest)}</td><td className="border border-slate-300 px-3 py-3 text-center align-middle">{g.latestSites}</td><td className="border border-slate-300 px-3 py-3 text-center align-middle"><button onClick={()=>setExpandedGrid(expandedGrid===g.grid?null:g.grid)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-bold text-blue-900">{expandedGrid===g.grid?"Hide Sites ↑":"View Sites ↓"}</button></td></tr>{expandedGrid===g.grid&&<tr><td colSpan={7} className="bg-blue-50 p-3"><div className="mb-2 flex justify-end"><ExportButtonComponent data={negativeExport.filter(x=>x.Grid===g.grid)} filename={`Fuel_Negative_${g.grid}`} label="Export Sites" format="excel" variant="success"/></div>{negativeTable([...base].filter(s=>s.grid===g.grid).sort((a,b)=>negativeMagnitude(b)-negativeMagnitude(a)),false)}</td></tr>}</React.Fragment>)}</tbody></table></div></section>
    <section className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm"><h3 className="mb-2 font-extrabold text-blue-950">Grid-wise Negative Fuel Deviation</h3><div className="h-[220px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={[...negativeGrids].sort((a,b)=>b.chartLitres-a.chartLitres)} margin={{top:22,right:8,left:0,bottom:4}}><CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="grid" tick={{fontSize:12}}/><YAxis tick={{fontSize:11}}/><Tooltip formatter={(v:any)=>`${fmt(Number(v))} L`}/><Bar dataKey="chartLitres" name="Negative Magnitude (L)" fill="#d97706" maxBarSize={56} radius={[4,4,0,0]}><LabelList dataKey="chartLitres" position="top" formatter={(v:any)=>Number(v)>0?Math.round(Number(v)).toLocaleString():""}/></Bar></BarChart></ResponsiveContainer></div></section>
    <section className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="font-extrabold text-blue-950">Worst Sites · Negative Fuel Deviation</h3><div className="flex gap-2"><select aria-label="Worst sites count" value={worstLimit} onChange={e=>setWorstLimit(Number(e.target.value))} className={selectClass}>{[10,20,50,100].map(n=><option key={n} value={n}>Top {n}</option>)}</select><ExportButtonComponent data={negativeExport} filename="Fuel_Negative_Worst_Sites" label="Export" format="excel" variant="success"/></div></div>{negativeTable(negativeWorst)}</section>
    <section className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm"><h3 className="font-extrabold text-blue-950">Site Query · Four-Ticket Reconciliation</h3><p className="mb-3 text-xs text-slate-500">Exact Site ID · Searches all Deviation Fuel records independently of region and grid filters</p><div className="flex flex-wrap gap-2"><input aria-label="Site ID query" type="search" value={siteQuery} onChange={e=>setSiteQuery(e.target.value)} placeholder="Enter Site ID" className="rounded-lg border border-blue-200 px-4 py-3 font-semibold text-slate-900"/><ExportButtonComponent data={siteQueryExport} filename={`Fuel_Deviation_Site_${siteQuery.trim()||"Query"}`} label="Export 4 Tickets" format="csv" variant="secondary"/></div>{siteQuery.trim()&&(!siteQueryMatches.length?<p className="mt-3 text-sm text-amber-800">No site found in Deviation Fuel sheet.</p>:siteQueryMatches.map(s=><div key={`${s.grid}-${s.siteId}`} className="mt-4"><p className="mb-2 font-bold text-blue-950">Site {s.siteId} · {s.grid} · {s.owner} · {s.gtl} · {s.rating}</p><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead><tr>{["Ticket","Recon Date","LFD","Fuel to Recon","Before Fuel","Fueler (L)","DG Hours","EASS (L)","Deviation (L)","Status"].map(h=><th key={h} className="bg-blue-900 px-3 py-3 text-left text-white">{h}</th>)}</tr></thead><tbody>{s.tickets.map((t,i)=><tr key={i} className="border-b"><td className="px-3 py-2">{i===0?"Latest":`Ticket ${i+1}`}</td><td className="px-3 py-2">{t.reconDate}</td><td className="px-3 py-2">{t.lfd}</td>{[t.fuelToRecon,t.beforeFuel,t.fueler,t.hours,t.eass,t.deviation].map((v,j)=><td key={j} className="px-3 py-2 tabular-nums">{v===null?"—":fmt(v)}</td>)}<td className="px-3 py-2">{statusBadge(t.status)}</td></tr>)}</tbody></table></div></div>))}</section>
    <p className="text-xs text-slate-500">Negative threshold &lt; −20 L. Totals and rankings show absolute negative litres; ticket details preserve signed values. Positive tickets are not offset against negative exceptions.</p>
  </div>;

  return <div className="fuel-deviation-premium min-w-0 space-y-4 bg-transparent p-2 text-slate-900 sm:p-4">
    {modeSwitcher}
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><h2 className="text-[25px] font-black tracking-tight text-emerald-900">Fuel Deviation <span className="font-medium text-slate-400">|</span> <span className="text-slate-900">Fueler vs EASS</span></h2><p className="text-[13px] font-medium text-slate-600">Ticket-to-ticket fuel reconciliation · Positive threshold &gt;10 L</p></div>
        <div className="inline-flex shrink-0 rounded-md border border-emerald-200 bg-emerald-50 p-0.5">{(["overall","C-1","C-6"] as FuelView[]).map(v=><button key={v} onClick={()=>{onRegionChange(v);setGrid("__all");setExpandedGrid(null);}} className={`rounded px-3 py-1.5 text-[13px] font-semibold transition ${region===v?"bg-[#075B39] text-white shadow-sm":"text-emerald-900 hover:bg-white"}`}>{v==="overall"?"Overall":v}</button>)}</div>
      </div>
      <div className="mt-4 grid grid-cols-2 items-center gap-2 border-t border-slate-100 pt-3 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1.25fr_1.5fr_1.25fr_auto]">
        <label className="sr-only" htmlFor="fuel-dev-period">Period</label><select id="fuel-dev-period" aria-label="Ticket period" value={ticketView} onChange={e=>setTicketView(e.target.value as "all"|"latest")} className={selectClass}><option value="all">Last 4 Tickets</option><option value="latest">Latest Ticket</option></select>
        <select aria-label="Grid" value={gridList.includes(grid)?grid:"__all"} onChange={e=>{setGrid(e.target.value);setExpandedGrid(null);}} className={selectClass}><option value="__all">All Grids</option>{gridList.map(g=><option key={g} value={g}>{g}</option>)}</select>
        <select aria-label="Revenue category" value={category} onChange={e=>setCategory(e.target.value)} className={selectClass}><option value="__all">All Revenue Categories</option>{categories.map(x=><option key={x} value={x}>{x}</option>)}</select>
        <select aria-label="Cluster owner" value={owner} onChange={e=>setOwner(e.target.value)} className={selectClass}><option value="__all">All Cluster Owners</option>{owners.map(x=><option key={x} value={x}>{x}</option>)}</select>
        <input aria-label="Search site" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search site / CO" className={selectClass}/>
        <span className="whitespace-nowrap text-right text-xs font-semibold text-slate-500">{base.length} of {scoped.length} sites</span>
      </div>
    </section>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        {label:"Gross Positive Deviation",value:`${fmt(grossPositive)} L`,sub:"Last 4 tickets · positive only",risk:true},
        {label:"Latest Ticket Positive",value:`${fmt(latestPositive)} L`,sub:`${latestPositiveSites} sites on latest ticket`,risk:true},
        {label:"Affected Sites",value:String(historicalPositiveSites),sub:`Of ${base.length} selected sites`,risk:false},
        {label:"Recurring Sites",value:String(recurring),sub:"Positive in 2+ tickets",risk:false},
      ].map(k=><div key={k.label} className={`flex min-h-[114px] flex-col justify-between rounded-xl border border-slate-200 border-l-4 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${k.risk?"border-l-red-500":"border-l-[#07804d]"}`}><div className="text-[13px] font-semibold text-slate-600">{k.label}</div><div className={`mt-1 text-[clamp(23px,2.3vw,32px)] font-extrabold leading-tight tracking-tight tabular-nums ${k.risk?"text-red-700":"text-slate-900"}`}>{k.value}</div><div className="mt-1 text-[11px] text-slate-500">{k.sub}</div>{k.label==="Recurring Sites"&&<div className="mt-3"><ExportButtonComponent data={recurringSiteExport("positive")} filename="Fuel_Positive_Recurring_Sites" label="Export Recurring Sites" format="excel" variant="success"/></div>}</div>)}
    </section>
    {region === "overall" && <section className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label="C-1 and C-6 regional fuel deviation summary">
      {regionalOverview.map(r=><div key={r.region} className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-extrabold text-[#075B39]">{r.region === "C-1" ? "Central-1" : "Central-6"} <span className="font-medium text-slate-500">· {r.sites} sites</span></h3><button onClick={()=>{onRegionChange(r.region);setGrid("__all");setExpandedGrid(null);}} className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-[#075B39] hover:bg-emerald-100">View {r.region} →</button></div>
        <div className="grid grid-cols-3 gap-3 border-b border-slate-100 pb-3">
          <div><p className="text-[11px] font-semibold text-slate-500">Gross +ive</p><p className="text-[22px] font-extrabold tabular-nums text-red-700">{fmt(r.gross)} <span className="text-xs">L</span></p></div>
          <div><p className="text-[11px] font-semibold text-slate-500">Latest +ive</p><p className="text-[22px] font-extrabold tabular-nums text-red-700">{fmt(r.latest)} <span className="text-xs">L</span></p></div>
          <div><p className="text-[11px] font-semibold text-slate-500">Affected sites</p><p className="text-[22px] font-extrabold tabular-nums text-slate-900">{r.affected}</p></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div className="text-[13px] text-slate-600">Worst grid: <span className="font-extrabold text-slate-900">{r.worstGrid?.grid ?? "—"}</span> <span className="font-bold text-red-700">{r.worstGrid ? `${fmt(r.worstGrid.positiveLitres)} L` : ""}</span></div>{r.worstGrid&&<button onClick={()=>{onRegionChange(r.region);setGrid(r.worstGrid.grid);setExpandedGrid(r.worstGrid.grid);}} className="rounded-md border border-slate-200 px-3 py-1 text-xs font-bold text-[#075B39] hover:bg-emerald-50">Investigate grid ↓</button>}</div>
      </div>)}
    </section>}
    <section className="flex min-w-0 flex-col gap-4">
      {coSummaryView}
      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h3 className="text-base font-bold text-slate-900">Grid Summary <span className="font-normal text-slate-500">· Worst first</span></h3><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] text-slate-500">Select View Sites to investigate</span><ExportButtonComponent data={grids.map(g=>({Grid:g.grid,Sites:g.sites,"Positive Sites":g.positiveSites,"Gross Positive L":g.positiveLitres,"Latest Positive L":g.latestLitres,"Latest Positive Sites":g.latestSites}))} filename={`Fuel_Deviation_Grid_Summary_${region}`} label="Export Grids" format="excel" variant="success"/></div></div>
        <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[750px] border-separate border-spacing-0"><thead><tr><th className={headClass}>Grid</th><th className={numberHead}>Sites</th><th className={numberHead}>+ive Sites</th><th className={numberHead}>Gross +ive (L)</th><th className={numberHead}>Latest +ive (L)</th><th className={numberHead}>Latest +ive Sites</th><th className={headClass}>Action</th></tr></thead><tbody>{grids.map(g=><React.Fragment key={g.grid}><tr className="border-b border-slate-100 even:bg-[#f8faf9] hover:bg-emerald-50/80 transition-colors"><td className={cellClass+" font-bold text-[#075B39]"}>{g.grid}</td><td className={numClass}>{g.sites}</td><td className={numClass}>{g.positiveSites}</td><td className={numClass+" font-bold text-red-700"}>{fmt(g.positiveLitres)}</td><td className={numClass+" font-semibold text-red-700"}>{fmt(g.latestLitres)}</td><td className={numClass}>{g.latestSites}</td><td className={cellClass}><button aria-expanded={expandedGrid===g.grid} onClick={()=>setExpandedGrid(expandedGrid===g.grid?null:g.grid)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-[#075B39] transition hover:bg-emerald-100">{expandedGrid===g.grid?"Hide Sites ↑":"View Sites ↓"}</button></td></tr>
          {expandedGrid===g.grid&&<tr><td colSpan={7} className="bg-slate-50 p-3"><div className="mb-2 flex items-center justify-between gap-2"><div className="text-sm font-bold text-slate-800">{g.grid} · All Sites ({g.sites})</div><div className="flex items-center gap-2"><ExportButtonComponent data={exportRows.filter(row=>row.Grid===g.grid)} filename={`Fuel_Deviation_${g.grid}_Sites`} label="Export Sites" format="excel" variant="success"/><button onClick={()=>setExpandedGrid(null)} className="text-xs font-semibold text-[#075B39]">Close ×</button></div></div><div className="max-h-[430px] overflow-auto rounded-lg bg-white">{renderSiteTable([...base].filter(s=>s.grid===g.grid).sort((a,b)=>b.positiveLitres-a.positiveLitres),false)}</div></td></tr>}
        </React.Fragment>)}</tbody></table>{!grids.length&&<p className="p-4 text-sm text-slate-500">No grid records match these filters.</p>}</div>
      </div>
      <section className="min-w-0 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-[#f1f8f4] px-5 py-3">
          <div><h3 className="text-[15px] font-extrabold text-[#075B39]">AI-assisted Refueling Control · Audit Recommendations</h3><p className="mt-0.5 text-xs text-slate-600">Prioritize sites for fuel verification using existing ticket-to-ticket deviations</p></div>
          <div className="flex items-center gap-2"><span className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-red-700 ring-1 ring-red-100">{verificationCount} sites to verify</span><button onClick={()=>setAuditShowAll(v=>!v)} className="rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-[#075B39]">{auditShowAll?"Show priority sites":"Show all sites"}</button></div>
        </div>
        <div className="border-b border-amber-100 bg-amber-50 px-5 py-2 text-[12px] leading-5 text-amber-900"><strong>Decision support only:</strong> Positive variance is not proof of excess fuel in the tank. Do not automatically stop DG refueling. Before delaying any refill, verify current tank level, last delivery, DG running, expected consumption, forecast power outages and minimum safe reserve. Critical/PTN sites must retain uninterrupted backup.</div>
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-bold text-slate-900">Deviation by Site Dependency Category</h4><p className="text-[11px] text-slate-500">Highest gross positive liters first · PTN/Critical backup protected · Other DGs lower refueling priority subject to safe reserve</p></div><div className="text-xs font-semibold text-red-700">Highest deviation: {worstHub ? `${worstHub.hub} · ${fmt(worstHub.gross)} L` : "—"}</div></div>
          <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[760px] border-collapse text-[13px]"><thead><tr><th className={headClass}>Category</th><th className={numberHead}>Sites</th><th className={numberHead}>+ive Sites</th><th className={numberHead}>Gross +ive (L)</th><th className={numberHead}>Latest +ive (L)</th><th className={numberHead}>Latest Sites</th><th className={numberHead}>Recurring</th><th className={headClass}>Fuel Priority</th><th className={headClass}>Action</th></tr></thead><tbody>{hubSummary.map(r=><tr key={r.hub} className="border-t border-slate-100 even:bg-slate-50 hover:bg-emerald-50/60"><td className={cellClass+" font-bold"}>{r.hub}</td><td className={numClass}>{r.sites}</td><td className={numClass}>{r.affected}</td><td className={numClass+" font-bold text-red-700"}>{fmt(r.gross)}</td><td className={numClass+" font-semibold text-red-700"}>{fmt(r.latest)}</td><td className={numClass}>{r.latestSites}</td><td className={numClass}>{r.recurring}</td><td className={cellClass}><span className={r.lowPriority?"rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700":"rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800"}>{r.lowPriority?"Lower · Verify reserve":"Protected · Priority supply"}</span></td><td className={cellClass}><button onClick={()=>setHubFocus(hubFocus===r.hub?"__all":r.hub)} className="rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50">{hubFocus===r.hub?"Show All":"View Sites"}</button></td></tr>)}</tbody></table></div>
          {hubFocus!=="__all"&&<div className="mt-2 text-xs font-semibold text-emerald-800">Showing {hubFocus} sites below · <button className="underline" onClick={()=>setHubFocus("__all")}>Clear category</button></div>}
        </div>
        <div className="max-h-[335px] overflow-auto"><table className="w-full min-w-[850px] border-separate border-spacing-0 text-[13px]"><thead><tr><th className={headClass}>Site</th><th className={headClass}>Grid</th><th className={headClass}>Category</th><th className={headClass}>Fuel Priority</th><th className={headClass}>Audit Priority</th><th className={numberHead}>Latest Dev. (L)</th><th className={numberHead}>+ive Tickets</th><th className={numberHead}>Gross +ive (L)</th><th className={headClass}>Recommendation</th><th className={headClass}>Reason</th></tr></thead><tbody>{auditByHub.filter(r=>auditShowAll || r.priority<=2).slice(0,auditShowAll?base.length:30).map(r=><tr key={`${r.site.grid}-${r.site.siteId}`} className="border-b border-slate-100 even:bg-slate-50 hover:bg-emerald-50/60"><td className={cellClass+" font-bold"}>{r.site.siteId}</td><td className={cellClass}>{r.site.grid}</td><td className={cellClass}>{normalizeHub(r.site.hubType)}</td><td className={cellClass+" font-semibold"}>{["PTN Node","Critical Hub (10 ++)"].includes(normalizeHub(r.site.hubType))?"Protected":"Lower priority"}</td><td className={cellClass}><span className={`rounded-md px-2 py-1 text-xs font-bold ${r.priority===0?"bg-red-50 text-red-700":r.priority===1?"bg-amber-50 text-amber-800":r.priority===2?"bg-slate-100 text-slate-700":"bg-emerald-50 text-emerald-700"}`}>{r.priority===0?"High · Recurring":r.priority===1?"Check Latest":r.priority===2?"History Review":"Routine"}</span></td><td className={numClass}>{r.site.tickets[0].deviation===null?"—":fmt(r.site.tickets[0].deviation)}</td><td className={numClass}>{r.site.positiveCount}</td><td className={numClass+" font-semibold text-red-700"}>{fmt(r.site.positiveLitres)}</td><td className={cellClass+" font-semibold"}>{r.recommendation}</td><td className={cellClass}>{r.reason}</td></tr>)}</tbody></table>{!auditByHub.some(r=>r.priority<=2)&&!auditShowAll&&<p className="p-4 text-sm text-slate-500">No positive-variance sites require additional historical review under the selected filters.</p>}</div>
        <div className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-500">Rule-based AI-assisted triage; no automatic fuel stop orders. Recommendations use the same &gt;+10 L ticket classification already defined in the sheet.</div>
      </section>
      <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-900">Grid-wise Positive Fuel Deviation</h3><span className="text-[11px] text-slate-500">{ticketView==="all"?"Last 4 tickets":"Latest ticket"} · Liters</span></div>
        <div className="mt-2 h-[215px] min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={[...grids].sort((a,b)=>b.chartLitres-a.chartLitres)} margin={{top:24,right:8,left:0,bottom:3}}><CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="grid" interval={0} tick={{fontSize:12,fill:"#334155"}} axisLine={{stroke:"#cbd5e1"}} tickLine={false}/><YAxis width={42} tick={{fontSize:11,fill:"#64748b"}} axisLine={false} tickLine={false}/><Tooltip formatter={(v:any)=>`${fmt(Number(v))} L`}/><Bar dataKey="chartLitres" name="Positive Deviation" fill="#dc3545" maxBarSize={56} radius={[3,3,0,0]}><LabelList dataKey="chartLitres" position="top" formatter={(v:any)=>Number(v)>0?Math.round(Number(v)).toLocaleString():""} style={{fontSize:11,fontWeight:600,fill:"#334155"}}/></Bar></BarChart></ResponsiveContainer></div>
      </div>
    </section>
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4"><div><h3 className="text-base font-bold text-slate-900">Worst Sites · Positive Fuel Deviation</h3><p className="text-[11px] text-slate-500">Highest gross positive liters first · Latest ticket shown first</p></div><div className="flex items-center gap-2"><select aria-label="Worst sites count" value={worstLimit} onChange={e=>setWorstLimit(Number(e.target.value))} className={selectClass}>{[10,20,50,100].map(n=><option key={n} value={n}>Top {n}</option>)}</select><ExportButtonComponent data={exportRows} filename="Fuel_Deviation_Sites" label="Export" format="excel" variant="success"/></div></div><div className="p-3">{renderSiteTable(worst,true)}</div></section>
    <section className="min-w-0 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm" aria-label="Fuel deviation site query">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-5 py-4">
        <div><h3 className="text-lg font-extrabold text-blue-950">Site Query · Four-Ticket Fuel Reconciliation</h3><p className="mt-1 text-xs font-medium text-slate-600">Search by exact Site ID · Live Deviation Fuel sheet · Independent of all dashboard filters</p></div>
        <ExportButtonComponent data={siteQueryExport} filename={`Fuel_Deviation_Site_${siteQuery.trim() || "Query"}`} label="Export 4 Tickets CSV" format="csv" variant="secondary"/>
      </div>
      <div className="p-5">
        <div className="relative max-w-lg"><Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-600"/><input type="search" aria-label="Site ID for four-ticket deviation query" value={siteQuery} onChange={e=>setSiteQuery(e.target.value)} placeholder="Enter Site ID (e.g. 4130)" className="w-full rounded-lg border border-blue-200 bg-white py-3 pl-11 pr-4 text-base font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"/></div>
        {!siteQuery.trim() && <p className="mt-4 text-sm text-slate-500">Enter a Site ID to view all four fuel reconciliation tickets and their deviation details.</p>}
        {siteQuery.trim() && !siteQueryMatches.length && <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">No site found for ID “{siteQuery.trim()}” in the Deviation Fuel sheet. Check the Site ID.</p>}
        {siteQueryMatches.map((s,matchIndex) => {
          const negativeTickets = s.tickets.filter(t=>t.status==="Negative").length;
          const validTickets = s.tickets.filter(t=>t.deviation!==null).length;
          return <div key={`${s.grid}-${s.siteId}-${matchIndex}`} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
              {[["Site ID",s.siteId],["Grid",s.grid],["Sub-Region",s.region],["Revenue Category",s.revenue],["Cluster Owner",s.owner],["GTL",s.gtl],["Zone Lead",s.lead],["DG Rating",s.rating],["Hub Category",s.hubType],["Benchmark",s.benchmark===null?"—":String(s.benchmark)]].map(([label,value])=><div key={label}><div className="text-xs font-semibold text-slate-500">{label}</div><div className="mt-1 break-words font-bold text-slate-900">{value||"—"}</div></div>)}
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[["Gross Positive",`${fmt(s.positiveLitres)} L`,"text-red-700"],["Gross Negative",`${fmt(s.negativeLitres)} L`,"text-amber-700"],["Net Deviation",`${fmt(s.netDeviation)} L`,"text-slate-900"],["Positive / Negative",`${s.positiveCount} / ${negativeTickets}`,"text-slate-900"],["Latest Ticket",s.latestStatus,"text-blue-900"]].map(([label,value,color])=><div key={label} className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs font-semibold text-slate-500">{label}</div><div className={`mt-1 text-xl font-extrabold tabular-nums ${color}`}>{value}</div></div>)}
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[1260px] border-collapse text-sm"><thead><tr>{["Ticket","Recon Date","Last Fueling Date","Fuel to Recon (L)","Before Fuel (L)","Fueler Consumption (L)","EASS DG Hours","EASS Consumption (L)","Deviation (L)","Status"].map(h=><th key={h} className={headClass}>{h}</th>)}</tr></thead><tbody>{s.tickets.map((t,i)=><tr key={i} className="border-t border-slate-100 even:bg-slate-50"><td className={cellClass+" font-bold"}>{i===0?"Latest":`Ticket ${i+1}`}</td><td className={cellClass}>{t.reconDate||"—"}</td><td className={cellClass}>{t.lfd||"—"}</td>{[t.fuelToRecon,t.beforeFuel,t.fueler,t.hours,t.eass].map((v,j)=><td key={j} className={numClass}>{v===null?"—":fmt(v)}</td>)}<td className={`${numClass} font-extrabold ${t.status==="Positive"?"text-red-700":t.status==="Negative"?"text-amber-700":t.status==="Normal"?"text-emerald-700":"text-slate-500"}`}>{t.deviation===null?"—":fmt(t.deviation)}</td><td className={cellClass}>{statusBadge(t.status)}</td></tr>)}</tbody></table></div>
            <p className="text-xs text-slate-500">{validTickets} of 4 tickets contain deviation values. Positive &gt; +10 L · Negative &lt; −20 L · Normal otherwise. Missing data is shown as —.</p>
          </div>;
        })}
      </div>
    </section>
    <p className="px-1 text-[11px] text-slate-500">Positive &gt; +10 L · Negative &lt; −20 L · Missing tickets excluded. Gross positive deviation does not offset negative values; deviations are reconciliation exceptions, not confirmed fuel losses.</p>
  </div>;
}

export default function FuelDashboard({ data, deviationData, onBack }: { data: SheetPayload | null; deviationData: SheetPayload | null; onBack: () => void }) {
  const [tab, setTab] = useState<FuelSubTab>("summary");
  const [view, setView] = useState<FuelView>("overall");
  const [gridFilter, setGridFilter] = useState("__all");
  const [fuelMonthFilter, setFuelMonthFilter] = useState("__all");
  const [siteSearch, setSiteSearch] = useState("");
  const [gridTableView, setGridTableView] = useState<"all" | "saving" | "increase">("all");
  const [allSitesGrid, setAllSitesGrid] = useState("__all");
  const [allSitesSearch, setAllSitesSearch] = useState("");
  const [drillGrid, setDrillGrid] = useState<string | null>(null);
  const [monthDrillGrid, setMonthDrillGrid] = useState<string | null>(null);
  const [categoryDrillGrid, setCategoryDrillGrid] = useState<string | null>(null);

  const rows = useMemo(() => parseFuelRows(data), [data]);
  const siteRows = useMemo(() => rows.filter(r => !r.siteId.toLowerCase().startsWith("mobile dg")), [rows]);

  const years = useMemo(() => Array.from(new Set(rows.map(r => r.year).filter(Boolean))).sort(), [rows]);
  const currentYear = years.includes(2026) ? 2026 : (years[years.length - 1] || 2026);
  const previousYear = years.includes(currentYear - 1) ? currentYear - 1 : (years[years.length - 2] || 2025);

  const latestMonthIndex = useMemo(() => {
    const indexes = rows.filter(r => r.year === currentYear).map(r => {
      const label = fuelMonthLabel(r.month);
      return FUEL_MONTH_ORDER.indexOf(label);
    }).filter(i => i >= 0);
    return indexes.length ? Math.max(...indexes) : 8;
  }, [rows, currentYear]);

  const comparableMonths = fuelMonthFilter === "__all" ? FUEL_MONTH_ORDER.slice(0, latestMonthIndex + 1) : [fuelMonthFilter];
  const lastTwoMonths = comparableMonths.slice(-2);

  const inView = (r: FuelRow) => view === "overall" || fuelRegion(r.grid) === view;
  const inGrid = (r: FuelRow) => gridFilter === "__all" || r.grid === gridFilter;
  const scoped = useMemo(() => rows.filter(r => inView(r) && inGrid(r)), [rows, view, gridFilter]);
  const scopedSites = useMemo(() => siteRows.filter(r => inView(r) && inGrid(r)), [siteRows, view, gridFilter]);

  const grids = useMemo(() => Array.from(new Set(rows.filter(inView).map(r => r.grid).filter(g => g && g !== "MDV"))).sort(), [rows, view]);

  useEffect(() => {
    if (gridFilter !== "__all" && !grids.includes(gridFilter)) setGridFilter("__all");
  }, [view, grids, gridFilter]);
  useEffect(() => {
    if (allSitesGrid !== "__all" && !grids.includes(allSitesGrid)) setAllSitesGrid("__all");
  }, [view, grids, allSitesGrid]);

  const isComparable = (r: FuelRow) => comparableMonths.includes(fuelMonthLabel(r.month));
  const totalFor = (source: FuelRow[], year: number) => source.filter(r => r.year === year && isComparable(r)).reduce((s, r) => s + r.filledQty, 0);

  // Reconciliation: every record is assigned to C-1, C-6 or Unmapped / Other.
  // MTD comparisons use the latest recorded date in the current-year month.
  const latestFuelDate = useMemo(() => rows.filter(r => r.year === currentYear && r.date && fuelMonthLabel(r.month) === FUEL_MONTH_ORDER[latestMonthIndex]).reduce<Date | null>((latest,r) => !latest || (r.date && r.date > latest) ? r.date : latest, null), [rows,currentYear,latestMonthIndex]);
  const sameDay = latestFuelDate?.getDate() ?? 31;
  const currentMonthKey = FUEL_MONTH_ORDER[latestMonthIndex];
  const sameDateTotals = useMemo(() => {
    const eligible = scoped.filter(r => comparableMonths.includes(fuelMonthLabel(r.month)) && (fuelMonthLabel(r.month) !== currentMonthKey || (r.date && r.date.getDate() <= sameDay)));
    return {
      previous: eligible.filter(r => r.year === previousYear).reduce((a,r)=>a+r.filledQty,0),
      current: eligible.filter(r => r.year === currentYear).reduce((a,r)=>a+r.filledQty,0),
    };
  }, [scoped, comparableMonths.join("|"), currentMonthKey, sameDay, previousYear,currentYear]);
  const sameDateSaving = sameDateTotals.previous - sameDateTotals.current;
  const sameDatePct = sameDateTotals.previous ? sameDateSaving / sameDateTotals.previous * 100 : 0;
  const previousMonthKey = FUEL_MONTH_ORDER[Math.max(0, latestMonthIndex - 1)];
  const momCurrent = scoped.filter(r => r.year === currentYear && fuelMonthLabel(r.month) === currentMonthKey && r.date && r.date.getDate() <= sameDay).reduce((a,r)=>a+r.filledQty,0);
  const momPrevious = scoped.filter(r => r.year === currentYear && fuelMonthLabel(r.month) === previousMonthKey && r.date && r.date.getDate() <= sameDay).reduce((a,r)=>a+r.filledQty,0);
  const prevTotal = totalFor(scoped, previousYear);
  const currTotal = totalFor(scoped, currentYear);
  const saving = prevTotal - currTotal;
  const savingPct = prevTotal ? (saving / prevTotal) * 100 : 0;
  // Reconcile displayed totals with the raw Google Sheet records.
  const reconciliation = useMemo(() => {
    const raw = (data?.rows ?? []) as Record<string, any>[];
    const result = { previous: 0, current: 0, excluded: 0, excludedLitres: 0, missingGridLitres: 0 };
    raw.forEach(row => {
      const yr = fuelNumber(row["Year"]);
      const month = fuelMonthLabel(row["Month"]) || fuelMonthLabel(row["Month_1"]) || fuelMonthLabel(row["Month 2"]);
      const qty = fuelNumber(row["Fuel Quantity Filled"]);
      if (yr !== previousYear && yr !== currentYear) return;
      if (!month || !comparableMonths.includes(month)) { result.excluded++; result.excludedLitres += qty; return; }
      if (yr === previousYear) result.previous += qty;
      if (yr === currentYear) result.current += qty;
      if (!String(row["Grid"] ?? "").trim()) result.missingGridLitres += qty;
    });
    return result;
  }, [data, previousYear, currentYear, comparableMonths.join("|")]);
  const reconciliationMismatch = view === "overall" && gridFilter === "__all" && (Math.abs(prevTotal-reconciliation.previous)>0.01 || Math.abs(currTotal-reconciliation.current)>0.01);


  const monthData = useMemo(() => comparableMonths.map(month => {
    const p = scoped.filter(r => r.year === previousYear && fuelMonthLabel(r.month) === month).reduce((s,r) => s + r.filledQty,0);
    const c = scoped.filter(r => r.year === currentYear && fuelMonthLabel(r.month) === month).reduce((s,r) => s + r.filledQty,0);
    return { month, previous: p, current: c, saving: p - c };
  }), [scoped, previousYear, currentYear, comparableMonths.join("|")]);

  const groupSummary = (source: FuelRow[], keyFn: (r: FuelRow) => string) => {
    const map = new Map<string, { key: string; previous: number; current: number }>();
    source.filter(isComparable).forEach(r => {
      const key = keyFn(r);
      if (!key) return;
      if (!map.has(key)) map.set(key, { key, previous: 0, current: 0 });
      const x = map.get(key)!;
      if (r.year === previousYear) x.previous += r.filledQty;
      if (r.year === currentYear) x.current += r.filledQty;
    });
    return Array.from(map.values()).map(x => ({
      ...x,
      saving: x.previous - x.current,
      savingPct: x.previous ? ((x.previous - x.current) / x.previous) * 100 : 0,
    }));
  };

  const regionSummary = useMemo(() => {
    const eligible = scoped.filter(r => comparableMonths.includes(fuelMonthLabel(r.month)) &&
      (fuelMonthLabel(r.month) !== currentMonthKey || (r.date && r.date.getDate() <= sameDay)));
    return groupSummary(eligible, r => fuelRegion(r.grid) === "Other" ? "Unmapped / Other" : fuelRegion(r.grid));
  }, [scoped, previousYear, currentYear, comparableMonths.join("|"), currentMonthKey, sameDay]);
  const gridSummary = useMemo(() => groupSummary(rows.filter(r => r.grid !== "MDV"), r => r.grid).sort((a,b) => a.key.localeCompare(b.key)), [rows, previousYear, currentYear, comparableMonths.join("|")]);
  const scopedGridSummary = useMemo(() => gridSummary.filter(x => view === "overall" || fuelRegion(x.key) === view), [gridSummary, view]);
  const visibleGridSummary = useMemo(() => scopedGridSummary.filter(x => {
    if (gridTableView === "saving") return x.saving > 0;
    if (gridTableView === "increase") return x.saving < 0;
    return true;
  }), [scopedGridSummary, gridTableView]);

  const siteSummary = useMemo(() => {
    const map = new Map<string, { siteId:string; grid:string; previous:number; current:number; lastTwo:number }>();
    scopedSites.forEach(r => {
      const key = `${r.siteId}|${r.grid}`;
      if (!map.has(key)) map.set(key,{siteId:r.siteId,grid:r.grid,previous:0,current:0,lastTwo:0});
      const x=map.get(key)!;
      if (r.year === previousYear && isComparable(r)) x.previous += r.filledQty;
      if (r.year === currentYear && isComparable(r)) x.current += r.filledQty;
      if (r.year === currentYear && lastTwoMonths.includes(fuelMonthLabel(r.month))) x.lastTwo += r.filledQty;
    });
    return Array.from(map.values()).map(x => ({
      ...x,
      variance: x.current - x.previous,
      saving: x.previous - x.current,
      yoyPct: x.previous ? ((x.current - x.previous) / x.previous) * 100 : 0,
    }));
  }, [scopedSites, previousYear, currentYear, comparableMonths.join("|"), lastTwoMonths.join("|")]);

  const allGridSites = useMemo(() => {
    const base = siteSummary.filter(x => allSitesGrid === "__all" || x.grid === allSitesGrid);
    return base
      .filter(x => !allSitesSearch.trim() || `${x.siteId} ${x.grid}`.toLowerCase().includes(allSitesSearch.trim().toLowerCase()))
      .sort((a,b) => b.current - a.current);
  }, [siteSummary, allSitesGrid, allSitesSearch]);

  const allGridSitesExport = useMemo(() => allGridSites.map((x,i) => ({
    Rank: i + 1,
    "Site ID": x.siteId,
    Grid: x.grid,
    [`${previousYear} Fuel (L)`]: Math.round(x.previous),
    [`${currentYear} Fuel (L)`]: Math.round(x.current),
    "Saving / (Increase) L": Math.round(x.saving),
    "Saving %": x.previous ? `${((x.saving/x.previous)*100).toFixed(2)}%` : "0.00%",
    "Last 2 Months (L)": Math.round(x.lastTwo),
    Status: x.saving > 0 ? "Saving" : x.saving < 0 ? "Increase" : "Flat",
  })), [allGridSites, previousYear, currentYear]);

  const gridDrillSummary = useMemo(() => {
    return scopedGridSummary.map(g => {
      const sites = siteSummary.filter(x => x.grid === g.key);
      return {
        ...g,
        siteCount: sites.length,
        lastTwo: sites.reduce((a,x)=>a+x.lastTwo,0),
      };
    }).sort((a,b) => a.key.localeCompare(b.key));
  }, [scopedGridSummary, siteSummary]);

  const drilledSites = useMemo(() => {
    if (!drillGrid) return [];
    return siteSummary
      .filter(x => x.grid === drillGrid)
      .filter(x => !allSitesSearch.trim() || x.siteId.toLowerCase().includes(allSitesSearch.trim().toLowerCase()))
      .sort((a,b) => b.current - a.current);
  }, [siteSummary, drillGrid, allSitesSearch]);


  const worstYtd = useMemo(() => [...siteSummary].sort((a,b) => b.current - a.current).slice(0,20), [siteSummary]);
  const worstLastTwo = useMemo(() => [...siteSummary].sort((a,b) => b.lastTwo - a.lastTwo).slice(0,20), [siteSummary]);
  const persistent = useMemo(() => {
    const prevTop = new Set([...siteSummary].sort((a,b) => b.previous - a.previous).slice(0,20).map(x => x.siteId));
    return [...siteSummary].filter(x => prevTop.has(x.siteId)).sort((a,b) => b.current - a.current).slice(0,20);
  }, [siteSummary]);

  // Current month fuel summary — latest available month in current year
  const currentMonthName = FUEL_MONTH_ORDER[latestMonthIndex] || "Sep";
  const currentMonthLabel = `${currentMonthName}-${String(currentYear).slice(-2)}`;

  const currentMonthRows = useMemo(() => rows.filter(r =>
    r.year === currentYear &&
    fuelMonthLabel(r.month) === currentMonthName &&
    (view === "overall" || fuelRegion(r.grid) === view) &&
    (gridFilter === "__all" || r.grid === gridFilter)
  ), [rows, currentYear, currentMonthName, view, gridFilter]);

  const currentMonthSiteRows = useMemo(() =>
    currentMonthRows.filter(r => !r.siteId.toLowerCase().startsWith("mobile dg")),
    [currentMonthRows]
  );

  const currentMonthUnknownDateRows = currentMonthRows.filter(r => !r.date && r.filledQty > 0);
  const currentMonthDates = useMemo(() => {
    const days = new Set<number>();
    currentMonthRows.forEach(r => { if (r.date) days.add(r.date.getDate()); });
    return Array.from(days).sort((a,b) => a-b);
  }, [currentMonthRows]);

  const currentMonthGridMatrix = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    currentMonthRows.filter(r => r.grid && r.grid !== "MDV").forEach(r => {
      if (!map.has(r.grid)) map.set(r.grid, {});
      const obj = map.get(r.grid)!;
      const key = r.date ? String(r.date.getDate()) : "Unknown";
      obj[key] = (obj[key] || 0) + r.filledQty;
    });
    return Array.from(map.entries()).map(([grid, days]) => ({
      grid, days, total: Object.values(days).reduce((a,b) => a + Number(b), 0)
    })).sort((a,b) => a.grid.localeCompare(b.grid));
  }, [currentMonthRows]);

  const currentMonthDaySummary = useMemo(() => currentMonthDates.map(day => {
    const dayRows = currentMonthRows.filter(r => r.date?.getDate() === day);
    return {
      day,
      date: `${String(day).padStart(2,"0")}-${currentMonthName}-${String(currentYear).slice(-2)}`,
      fuel: dayRows.reduce((a,r) => a + r.filledQty, 0),
      fills: dayRows.filter(r => r.filledQty > 0).length,
      sites: new Set(dayRows.filter(r => !r.siteId.toLowerCase().startsWith("mobile dg")).map(r => r.siteId)).size,
    };
  }), [currentMonthRows, currentMonthDates, currentMonthName, currentYear]);

  const currentMonthTotal = currentMonthRows.reduce((a,r) => a + r.filledQty, 0);
  const currentMonthSites = new Set(currentMonthSiteRows.map(r => r.siteId)).size;
  const currentMonthFills = currentMonthRows.filter(r => r.filledQty > 0).length;
  const currentMonthAvgDay = currentMonthDates.length ? currentMonthTotal / currentMonthDates.length : 0;

  // October fuel control: regional budget and per-DG planning benchmark are distinct.
  // DG category inventory is sourced from Deviation Fuel (reconciliation-covered sites),
  // not inferred from refueling events, which omit DGs that received no fuel.
  const octoberFuelBudget = 28000;
  const perDgMonthlyTarget = 190;
  const dgInventory = useMemo(() => {
    const unique = new Map<string, FuelDeviationSite>();
    parseDeviationSites(deviationData).forEach(site => {
      if (!site.grid || !site.siteId) return;
      if (view !== "overall" && fuelRegion(site.grid) !== view) return;
      if (gridFilter !== "__all" && site.grid !== gridFilter) return;
      unique.set(`${site.grid}:${site.siteId}`, site);
    });
    return Array.from(unique.values());
  }, [deviationData, view, gridFilter]);
  const dgCategory = (raw: string) => {
    const v = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (v.includes("ptn")) return "PTN Node";
    if (v.includes("critical")) return "Critical Hub";
    if (v.includes("major")) return "Major Hub";
    if (v.includes("minor")) return "Minor Hub";
    if (v.includes("single")) return "Single";
    return "Other";
  };
  const currentMonthDgGridSummary = useMemo(() => {
    const byGrid = new Map<string, {grid:string; ids:Set<string>; ptn:number; critical:number; single:number; minor:number; major:number; other:number}>();
    dgInventory.forEach(site => {
      const g = byGrid.get(site.grid) || {grid:site.grid,ids:new Set<string>(),ptn:0,critical:0,single:0,minor:0,major:0,other:0};
      if (g.ids.has(site.siteId)) return;
      g.ids.add(site.siteId);
      const type = dgCategory(site.hubType);
      if (type === "PTN Node") g.ptn++;
      else if (type === "Critical Hub") g.critical++;
      else if (type === "Single") g.single++;
      else if (type === "Minor Hub") g.minor++;
      else if (type === "Major Hub") g.major++;
      else g.other++;
      byGrid.set(site.grid,g);
    });
    const fuel = new Map(currentMonthGridMatrix.map(r=>[r.grid,r.total]));
    return Array.from(byGrid.values()).map(g=>{
      const totalDGs = g.ids.size;
      const fueled = fuel.get(g.grid) || 0;
      return {...g,totalDGs,fueled,target:totalDGs*perDgMonthlyTarget,perDG:totalDGs?fueled/totalDGs:0};
    }).sort((a,b)=>a.grid.localeCompare(b.grid));
  }, [dgInventory,currentMonthGridMatrix]);
  const currentMonthDgExport = currentMonthDgGridSummary.map(g=>({
    Grid:g.grid,"Total DGs (Recon Sheet)":g.totalDGs,"PTN Node":g.ptn,
    "Critical Hub (10++)":g.critical,Single:g.single,"Minor Hub (1-4)":g.minor,
    "Major Hub (5-10)":g.major,"Other / Unclassified":g.other,
    "Monthly Fuel Filled (L)":g.fueled,"Fuel / DG (L)":Number(g.perDG.toFixed(2)),
    "Benchmark / DG (L)":perDgMonthlyTarget,"DG Benchmark Total (L)":g.target,
    "Difference vs DG Benchmark (L)":Number((g.fueled-g.target).toFixed(2)),
  }));
  // Attribute ACTUAL monthly refueling litres by matching Fuel History site IDs to
  // Deviation Fuel HUB/Single. Unmatched records remain visible, not silently assigned.
  const currentMonthCategoryFuel = useMemo(() => {
    const bySite = new Map(dgInventory.map(s => [s.siteId.trim().toLowerCase(), dgCategory(s.hubType)]));
    const categories = ["PTN Node", "Critical Hub", "Single", "Minor Hub", "Major Hub", "Other", "Unmatched / Mobile DG"];
    const gridNames = [...new Set([...currentMonthDgGridSummary.map(g=>g.grid), ...currentMonthRows.map(r=>r.grid).filter(Boolean)])].sort();
    const matrix = gridNames.map(grid => {
      const values: Record<string,number> = Object.fromEntries(categories.map(c=>[c,0]));
      currentMonthRows.filter(r=>r.grid===grid).forEach(r=>{
        const category = bySite.get(r.siteId.trim().toLowerCase()) || "Unmatched / Mobile DG";
        values[category] += r.filledQty;
      });
      const total = categories.reduce((sum,c)=>sum+values[c],0);
      const dominant = [...categories].sort((a,b)=>values[b]-values[a])[0];
      return {grid,values,total,dominant};
    });
    const totals: Record<string,number> = Object.fromEntries(categories.map(c=>[c,0]));
    matrix.forEach(row=>categories.forEach(c=>{totals[c]+=row.values[c]}));
    return {categories,matrix,totals};
  }, [dgInventory,currentMonthDgGridSummary,currentMonthRows]);
  const currentMonthCategoryExport = currentMonthCategoryFuel.matrix.map(r=>({Grid:r.grid,...Object.fromEntries(currentMonthCategoryFuel.categories.map(c=>[`${c} Fuel (L)`,Number(r.values[c].toFixed(2))])),"Total Fuel (L)":Number(r.total.toFixed(2)),"Highest Fuel Category":r.dominant}));
  // Category grid drill-down: show all recon inventory sites, plus unmatched fuel-history sites.
  const categoryGridSites = useMemo(() => {
    if (!categoryDrillGrid) return [];
    const inventory = dgInventory.filter(s => s.grid === categoryDrillGrid);
    const siteMap = new Map<string, {siteId:string; category:string; total:number; fills:number; lastDate:string; source:string}>();
    inventory.forEach(s => siteMap.set(s.siteId.trim().toLowerCase(), {siteId:s.siteId,category:dgCategory(s.hubType),total:0,fills:0,lastDate:"",source:"DG inventory"}));
    currentMonthRows.filter(r => r.grid === categoryDrillGrid).forEach(r => {
      const key = r.siteId.trim().toLowerCase();
      const item = siteMap.get(key) || {siteId:r.siteId,category:"Unmatched / Mobile DG",total:0,fills:0,lastDate:"",source:"Fuel History only"};
      item.total += r.filledQty;
      if (r.filledQty > 0) item.fills++;
      if (r.date) {
        const dateText = r.date.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
        const dateKey = r.date.getTime();
        const prior = (item as any)._lastTimestamp || 0;
        if (dateKey > prior) {item.lastDate=dateText;(item as any)._lastTimestamp=dateKey;}
      }
      siteMap.set(key,item);
    });
    return Array.from(siteMap.values()).sort((a,b)=>b.total-a.total || a.siteId.localeCompare(b.siteId));
  }, [categoryDrillGrid,dgInventory,currentMonthRows]);
  const categoryGridExport = useMemo(() => categoryGridSites.map((s,i)=>({
    Rank:i+1, Grid:categoryDrillGrid || "", "Site ID":s.siteId, "DG Category":s.category,
    "Fuel Poured (L)":Number(s.total.toFixed(2)), "Fill Events":s.fills,
    "Latest Fuel Date":s.lastDate || "—", "Inventory Status":s.source,
    "Monthly Target / DG (L)":perDgMonthlyTarget,
    "Over 190 L":s.total>perDgMonthlyTarget?"YES":"NO"
  })),[categoryGridSites,categoryDrillGrid]);
  const octoberBudgetRemaining = octoberFuelBudget - currentMonthTotal;

  const currentMonthMatrixExport = useMemo(() => currentMonthGridMatrix.map(row => {
    const obj: Record<string, any> = { Grid: row.grid };
    currentMonthDates.forEach(day => { obj[`${day}-${currentMonthName}`] = Math.round(row.days[String(day)] || 0); });
    obj["Total L"] = Math.round(row.total);
    return obj;
  }), [currentMonthGridMatrix, currentMonthDates, currentMonthName]);

  const currentMonthDrillSites = useMemo(() => {
    if (!monthDrillGrid) return [];
    const gridRows = currentMonthSiteRows.filter(r => r.grid === monthDrillGrid);
    const map = new Map<string, {siteId:string; days:Record<string,number>; total:number; fills:number}>();
    gridRows.forEach(r => {
      if (!r.date) return;
      const x = map.get(r.siteId) || {siteId:r.siteId,days:{},total:0,fills:0};
      const day = String(r.date.getDate());
      x.days[day] = (x.days[day] || 0) + r.filledQty;
      x.total += r.filledQty;
      if (r.filledQty > 0) x.fills += 1;
      map.set(r.siteId,x);
    });
    return Array.from(map.values()).sort((a,b)=>b.total-a.total);
  }, [currentMonthSiteRows, monthDrillGrid]);

  const currentMonthDrillTotal = currentMonthDrillSites.reduce((a,x)=>a+x.total,0);

  const currentMonthDrillExport = useMemo(() => currentMonthDrillSites.map((row,i) => {
    const out:any = {
      Rank:i+1,
      "Site ID":row.siteId,
      Grid:monthDrillGrid || "",
    };
    currentMonthDates.forEach(day => { out[`${day}-${currentMonthName}`] = Math.round(row.days[String(day)] || 0); });
    out[`${currentMonthName} Total L`] = Math.round(row.total);
    out["Fill Events"] = row.fills;
    out["Avg / Fill L"] = row.fills ? Math.round(row.total/row.fills) : 0;
    out["Grid Contribution %"] = currentMonthDrillTotal ? `${((row.total/currentMonthDrillTotal)*100).toFixed(1)}%` : "0.0%";
    return out;
  }), [currentMonthDrillSites,currentMonthDates,currentMonthName,monthDrillGrid,currentMonthDrillTotal]);

  const exportSummary = visibleGridSummary.map(x => ({
    Grid:x.key, [`${previousYear} Fuel (L)`]:Math.round(x.previous), [`${currentYear} Fuel (L)`]:Math.round(x.current),
    "Saving / (Increase) L":Math.round(x.saving), "Saving %":`${x.savingPct.toFixed(2)}%`,
  }));
  const exportWorst = worstYtd.map((x,i) => ({
    Rank:i+1,"Site ID":x.siteId,Grid:x.grid,[`${previousYear} Fuel (L)`]:Math.round(x.previous),
    [`${currentYear} Fuel (L)`]:Math.round(x.current),"YoY Increase / (Reduction)":Math.round(x.variance),
    "Last 2 Months (L)":Math.round(x.lastTwo)
  }));

  const tableClass = "w-full text-[15px]";
  const th = "px-4 py-3.5 text-left text-[12px] font-black uppercase tracking-wide text-white whitespace-nowrap";
  const td = "px-4 py-3 text-[14px] font-medium text-slate-800 whitespace-nowrap";

  if (!data) return <div className="min-h-screen bg-slate-100 p-8"><button onClick={onBack} className="mb-5 rounded-lg bg-slate-800 px-4 py-2 text-white">← Home</button><div className="rounded-xl border border-amber-300 bg-amber-50 p-10 text-center font-bold text-amber-900">Fuel History tab is not available. Confirm the Google Sheet tab name is exactly <b>Fuel History</b>.</div></div>;

  return (
    <div className="fuel-premium min-h-screen bg-[#073B2A] text-slate-100 flex">

      <style>{`
        .fuel-premium .fuel-dashboard-main { position:relative; }
        .fuel-premium .fuel-dashboard-main::before { content:""; position:fixed; pointer-events:none; z-index:0; inset:0 0 0 16rem; opacity:.28;
          background-image:radial-gradient(circle at 1px 1px,rgba(37,99,235,.16) 1px,transparent 0),linear-gradient(125deg,rgba(59,130,246,.13),rgba(14,165,233,.09) 55%,rgba(99,102,241,.065));
          background-size:19px 19px,100% 100%; }
        .fuel-premium .fuel-dashboard-main > * {position:relative;z-index:1;}
        .fuel-premium .fuel-dashboard-main .bg-white,
        .fuel-premium .fuel-deviation-premium .bg-white { background-color:#fff !important; }
        .fuel-premium .fuel-dashboard-main > div.rounded-xl.bg-white,
        .fuel-premium .fuel-dashboard-main > section.rounded-xl.bg-white,
        .fuel-premium .fuel-dashboard-main > div.grid > div.rounded-xl.bg-white,
        .fuel-premium .fuel-dashboard-main > div.grid > div > div.rounded-xl.bg-white,
        .fuel-premium .fuel-deviation-premium > section.rounded-xl,
        .fuel-premium .fuel-deviation-premium > div.rounded-xl { 
          background-image:linear-gradient(138deg,#ffffff 0%,#eff6ff 65%,#dbeafe 100%) !important;
          border-color:#bfdbfe !important; border-radius:16px !important;
          box-shadow:0 3px 14px rgba(15,75,55,.075),0 1px 3px rgba(15,23,42,.035) !important;
        }
        .fuel-premium .fuel-deviation-premium > section.grid > div,
        .fuel-premium .fuel-deviation-premium > section.grid > div.rounded-xl {
          background-image:linear-gradient(125deg,#ffffff 0%,#dbeafe 100%) !important;
          border-radius:16px !important; border-color:#bfdbfe !important;
          box-shadow:0 3px 12px rgba(6,95,70,.07) !important;
        }
        .fuel-premium .fuel-deviation-premium > section.grid > div:nth-child(1),
        .fuel-premium .fuel-deviation-premium > section.grid > div:nth-child(2) {
          background-image:linear-gradient(125deg,#fff 0%,#fff0ef 100%) !important;
          border-color:#fecaca !important;
        }
        .fuel-premium .fuel-dashboard-main h2,
        .fuel-premium .fuel-dashboard-main h3 {letter-spacing:-.018em;}
        .fuel-premium .fuel-dashboard-main h3 {font-size:16px;font-weight:800;color:#0f3d31;}
        .fuel-premium .fuel-dashboard-main p.text-xs,
        .fuel-premium .fuel-dashboard-main .text-\[11px\] {color:#536579;}
        .fuel-premium .fuel-dashboard-main table {font-size:14px;}
        .fuel-premium .fuel-dashboard-main table thead {background:#065f46;color:#fff;}
        .fuel-premium .fuel-dashboard-main table tbody tr {transition:background-color .18s ease;}
        .fuel-premium .fuel-dashboard-main table tbody tr:hover {background:#e7f6ef !important;}
        .fuel-premium .fuel-dashboard-main button,
        .fuel-premium .fuel-dashboard-main select {transition:all .2s ease;}
        .fuel-premium .fuel-dashboard-main button:focus-visible,
        .fuel-premium .fuel-dashboard-main select:focus-visible,
        .fuel-premium .fuel-dashboard-main input:focus-visible {outline:2px solid #06b6d4;outline-offset:2px;}
        @media(max-width:1023px){.fuel-premium .fuel-dashboard-main::before{inset:0;}}
      `}</style>
      {/* Fuel left navigation — same interaction pattern as Sep AVB dashboard */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-emerald-900/60 bg-gradient-to-b from-[#064E3B] via-[#075E36] to-[#043927] lg:flex">
        <div className="border-b border-emerald-300/15 p-5">
          <button onClick={onBack} className="mb-4 flex items-center gap-2 text-xs font-bold text-emerald-100/70 hover:text-white">← Home</button>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><Fuel className="h-6 w-6 text-emerald-400" /></div>
            <div><h1 className="font-black text-white">Fuel Management</h1><p className="text-[11px] text-slate-500">{previousYear} vs {currentYear} · Jan–{comparableMonths[comparableMonths.length-1]}</p></div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {([
            ["summary","Overall Summary",LayoutDashboard],
            ["yoy","YoY & Worst Sites",TrendingDown],
            ["currentMonth",`Current Month · ${currentMonthLabel}`,CalendarDays],
            ["deviation","Fuel Deviation",AlertTriangle],
          ] as const).map(([id,label,Icon]) => <button key={id} onClick={()=>setTab(id as FuelSubTab)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${tab===id?"bg-white text-[#075E36] shadow-lg shadow-black/10":"text-emerald-50/75 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4 w-4"/><span>{label}</span></button>)}
        </nav>
        <div className="border-t border-slate-800 p-4 text-[11px] text-emerald-100/60">Fuel History · Live Google Sheet</div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-64 bg-gradient-to-br from-[#dbeafe] via-[#eaf4ff] to-[#bfdbfe] text-slate-900">
        <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div>
              <div className="flex items-center gap-2 lg:hidden"><button onClick={onBack} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white">← Home</button><Fuel className="h-5 w-5 text-emerald-600"/></div>
              <h2 className="mt-1 text-xl font-black text-slate-950">{tab==="summary"?"Overall Fuel Summary":tab==="yoy"?"YoY & Worst Sites":tab==="deviation"?"Fuel Deviation":`${currentMonthLabel} Fuel Summary`}</h2>
              <p className="text-xs text-slate-500">Fuel History · {previousYear} vs {currentYear} · comparable through {comparableMonths[comparableMonths.length-1]}</p>
            </div>
            {tab!=="deviation" && <div className="flex flex-wrap gap-2">
              {(["overall","C-1","C-6"] as FuelView[]).map(v => <button key={v} onClick={()=>setView(v)} className={`rounded-lg px-4 py-2 text-sm font-black ${view===v?"bg-[#006B3C] text-white":"bg-slate-200 text-slate-700"}`}>{v==="overall"?"Overall":v}</button>)}
              <select aria-label="Fuel month" value={fuelMonthFilter} onChange={e=>setFuelMonthFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold"><option value="__all">YTD (Jan–{FUEL_MONTH_ORDER[latestMonthIndex]})</option>{FUEL_MONTH_ORDER.slice(0,latestMonthIndex+1).map(m=><option key={m} value={m}>{m} · YoY</option>)}</select>
              <select value={gridFilter} onChange={e=>setGridFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold"><option value="__all">All Grids</option>{grids.map(g=><option key={g}>{g}</option>)}</select>
            </div>}
          </div>
          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden sm:px-6">
            {[["summary","Summary"],["yoy","YoY / Worst Sites"],["currentMonth",currentMonthLabel],["deviation","Deviation"]].map(([id,label])=><button key={id} onClick={()=>setTab(id as FuelSubTab)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black ${tab===id?"bg-emerald-600 text-white":"bg-slate-100 text-slate-700"}`}>{label}</button>)}
          </div>
        </header>

        <main className="space-y-5 p-4 sm:p-6 fuel-dashboard-main">
        {tab==="deviation" && <FuelDeviationPage payload={deviationData} region={view} onRegionChange={setView} />}
        {tab==="summary" && <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <b>Calculation basis:</b> {fuelMonthFilter === "__all" ? `Jan–${currentMonthKey}` : fuelMonthFilter} Y25 vs Y26. Current month is incomplete; full-period difference is provisional. Same-date YoY below compares both years through day {sameDay} of {currentMonthKey}. Sep/Sept are normalized. Unmapped records remain visible for reconciliation.
          </div>
          {reconciliationMismatch && <div className="rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-950"><b>Fuel data reconciliation warning:</b> Source rows total {Math.round(reconciliation.previous).toLocaleString()} L ({previousYear}) and {Math.round(reconciliation.current).toLocaleString()} L ({currentYear}); dashboard aggregation totals {Math.round(prevTotal).toLocaleString()} L and {Math.round(currTotal).toLocaleString()} L. Difference: {Math.round(reconciliation.current-currTotal).toLocaleString()} L in {currentYear}. Check month and year mappings before using savings for management reporting.</div>}
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">Source reconciliation · {previousYear}: <b>{Math.round(reconciliation.previous).toLocaleString()} L</b> · {currentYear}: <b>{Math.round(reconciliation.current).toLocaleString()} L</b> · Records with invalid month: {reconciliation.excluded} ({Math.round(reconciliation.excludedLitres).toLocaleString()} L) · Missing grid: {Math.round(reconciliation.missingGridLitres).toLocaleString()} L. These values are calculated from the live sheet, not hardcoded.</div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[[`${previousYear} Same-Date`,sameDateTotals.previous],[`${currentYear} Same-Date`,sameDateTotals.current],["Apple-to-Apple Saving",sameDateSaving],["Saving %",sameDatePct]].map(([label,value],i)=><div key={String(label)} className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm"><div className="text-xs font-black uppercase text-slate-600">{label}</div><div className={`mt-1 text-2xl font-black ${i>1 ? (Number(value)>=0?"text-emerald-700":"text-red-600") : "text-slate-950"}`}>{i===3?`${Number(value).toFixed(2)}%`:`${Math.round(Number(value)).toLocaleString()} L`}</div><div className="text-[11px] text-slate-500">Through {sameDay} {currentMonthKey} · same date both years</div></div>)}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800"><b>MoM · {previousMonthKey} vs {currentMonthKey} {currentYear}, days 1–{sameDay}:</b> {Math.round(momPrevious).toLocaleString()} L vs {Math.round(momCurrent).toLocaleString()} L · Change {(momCurrent-momPrevious>=0?"+":"")}{Math.round(momCurrent-momPrevious).toLocaleString()} L. {fuelMonthFilter !== "__all" ? "MoM is independent of the selected YoY month filter." : ""}</div>

          {currentMonthUnknownDateRows.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{currentMonthUnknownDateRows.length} fuel fill records have unrecognized refueling timestamps. Their liters remain included in grid totals and the matrix under Date N/A; dated daily figures exclude these records. Check the Refueling Time column format.</div>}

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-black">Monthly YoY Fuel</h3><p className="text-xs text-slate-500">Comparable months only</p></div><ExportButtonComponent data={monthData} filename="Fuel_Monthly_YoY" label="Export" format="excel" variant="success"/></div><div className="h-[330px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={monthData} margin={{top:20,right:20,left:10,bottom:5}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis/><Tooltip formatter={(v:any)=>`${Number(v).toLocaleString()} L`}/><Legend/><Bar dataKey="previous" name={`${previousYear}`} fill="#94a3b8"><LabelList dataKey="previous" position="top" formatter={(v:any)=>Math.round(Number(v)/1000)+"K"}/></Bar><Bar dataKey="current" name={`${currentYear}`} fill="#059669"><LabelList dataKey="current" position="top" formatter={(v:any)=>Math.round(Number(v)/1000)+"K"}/></Bar></ComposedChart></ResponsiveContainer></div></div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black">Sub-Region Control · Apple-to-Apple YoY</h3><p className="text-xs text-slate-500">Same comparison period as top saving cards · through {sameDay} {currentMonthKey}</p><div className="mt-4 overflow-x-auto"><table className={tableClass}><thead className="bg-emerald-900 text-white"><tr>{["Sub-Region",previousYear,currentYear,"Saving L","Saving %"].map(h=><th key={String(h)} className={th}>{h}</th>)}</tr></thead><tbody>{regionSummary.map(x=><tr key={x.key} className="border-b border-slate-200"><td className={td+" font-black"}>{x.key}</td><td className={td}>{Math.round(x.previous).toLocaleString()}</td><td className={td}>{Math.round(x.current).toLocaleString()}</td><td className={`${td} font-black ${x.saving>=0?"text-emerald-700":"text-red-600"}`}>{Math.round(x.saving).toLocaleString()}</td><td className={`${td} font-black ${x.savingPct>=0?"text-emerald-700":"text-red-600"}`}>{x.savingPct.toFixed(2)}%</td></tr>)}</tbody></table></div></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h3 className="font-black">Grid-wise Fuel Control</h3><p className="text-xs text-slate-500">Positive saving = lower fuel than last year</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1"><span className="px-2 text-[11px] font-black uppercase text-slate-500">View</span>{(["all","saving","increase"] as const).map(v => <button key={v} onClick={()=>setGridTableView(v)} className={`rounded-md px-3 py-1.5 text-xs font-black transition ${gridTableView===v ? (v==="increase"?"bg-red-600 text-white":v==="saving"?"bg-emerald-600 text-white":"bg-slate-800 text-white") : "bg-white text-slate-600 hover:bg-slate-200"}`}>{v==="all"?"All":v==="saving"?"Saving":"Increase"}</button>)}</div><ExportButtonComponent data={exportSummary} filename={`Fuel_Grid_Summary_${view}_${gridTableView}`} label="Export Grid View" format="excel" variant="success"/></div></div><div className="overflow-x-auto"><table className={tableClass}><thead className="bg-emerald-900 text-white"><tr>{["Grid",`${previousYear} L`,`${currentYear} L`,"Saving / (Increase)","Saving %","Status"].map(h=><th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{visibleGridSummary.map(x=><tr key={x.key} className="border-b border-slate-200 even:bg-slate-50"><td className={td+" font-black"}>{x.key}</td><td className={td}>{Math.round(x.previous).toLocaleString()}</td><td className={td}>{Math.round(x.current).toLocaleString()}</td><td className={`${td} font-black ${x.saving>=0?"text-emerald-700":"text-red-600"}`}>{x.saving>=0?"+":""}{Math.round(x.saving).toLocaleString()}</td><td className={`${td} font-black ${x.savingPct>=0?"text-emerald-700":"text-red-600"}`}>{x.savingPct.toFixed(2)}%</td><td className={td}>{x.saving>0?"Saving":x.saving<0?"Increase":"Flat"}</td></tr>)}</tbody></table></div></div>

          {/* GRID-FIRST ALL SITES DRILL-DOWN */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <div>
                <h3 className="font-black">Grid-wise All Sites View</h3>
                <p className="text-xs text-slate-500">Grid ID first · use View in the last column to open all sites of that grid</p>
              </div>
              <ExportButtonComponent
                data={drillGrid
                  ? drilledSites.map((x,i)=>({Rank:i+1,"Site ID":x.siteId,Grid:x.grid,[`${previousYear} Fuel (L)`]:Math.round(x.previous),[`${currentYear} Fuel (L)`]:Math.round(x.current),"Saving / (Increase) L":Math.round(x.saving),"Saving %":x.previous?`${((x.saving/x.previous)*100).toFixed(2)}%`:"0.00%","Last 2M L":Math.round(x.lastTwo),Status:x.saving>0?"Saving":x.saving<0?"Increase":"Flat"}))
                  : gridDrillSummary.map(x=>({Grid:x.key,Sites:x.siteCount,[`${previousYear} Fuel (L)`]:Math.round(x.previous),[`${currentYear} Fuel (L)`]:Math.round(x.current),"Saving / (Increase) L":Math.round(x.saving),"Saving %":`${x.savingPct.toFixed(2)}%`,"Last 2M L":Math.round(x.lastTwo)}))
                }
                filename={drillGrid?`Fuel_Sites_${drillGrid}`:`Fuel_All_Grid_Summary_${view}`}
                label={drillGrid?`Export ${drillGrid} Sites`:"Export Grid Summary"}
                format="excel"
                variant="success"
              />
            </div>

            {!drillGrid ? (
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead className="bg-emerald-900 text-white">
                    <tr>{["Grid ID","Sites",`${previousYear} L`,`${currentYear} L`,"Saving / (Increase)","Saving %","Last 2M L","Status","View"].map(h=><th key={h} className={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {gridDrillSummary.map(x => <tr key={x.key} className="border-b border-slate-200 even:bg-slate-50">
                      <td className={td+" text-base font-black text-[#006B3C]"}>{x.key}</td>
                      <td className={td+" font-black"}>{x.siteCount}</td>
                      <td className={td}>{Math.round(x.previous).toLocaleString()}</td>
                      <td className={td+" font-black"}>{Math.round(x.current).toLocaleString()}</td>
                      <td className={`${td} font-black ${x.saving>=0?"text-emerald-700":"text-red-600"}`}>{x.saving>=0?"+":""}{Math.round(x.saving).toLocaleString()}</td>
                      <td className={`${td} font-black ${x.savingPct>=0?"text-emerald-700":"text-red-600"}`}>{x.savingPct.toFixed(2)}%</td>
                      <td className={td+" font-black"}>{Math.round(x.lastTwo).toLocaleString()}</td>
                      <td className={td}><span className={`rounded-full px-2 py-1 text-[11px] font-black ${x.saving>0?"bg-emerald-100 text-emerald-700":x.saving<0?"bg-red-100 text-red-700":"bg-slate-100 text-slate-600"}`}>{x.saving>0?"Saving":x.saving<0?"Increase":"Flat"}</span></td>
                      <td className={td}>
                        <button onClick={()=>{setDrillGrid(x.key);setAllSitesSearch("");}} className="rounded-lg bg-[#006B3C] px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-800">View Sites →</button>
                      </td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <button onClick={()=>{setDrillGrid(null);setAllSitesSearch("");}} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-emerald-800">← All Grids</button>
                    <div><div className="text-[10px] font-black uppercase text-emerald-700">Selected Grid</div><div className="text-2xl font-black text-[#006B3C]">{drillGrid}</div></div>
                    <div className="rounded-lg bg-white px-3 py-2"><div className="text-[10px] font-black uppercase text-slate-500">Sites</div><div className="font-black">{drilledSites.length}</div></div>
                  </div>
                  <input value={allSitesSearch} onChange={e=>setAllSitesSearch(e.target.value)} placeholder={`Search site in ${drillGrid}`} className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"/>
                </div>
                <div className="max-h-[540px] overflow-auto">
                  <table className={tableClass}>
                    <thead className="sticky top-0 z-10 bg-[#006B3C]">
                      <tr>{["#","Site ID","Grid",`${previousYear} L`,`${currentYear} L`,"Saving / (Increase)","Saving %","Last 2M L","Status"].map(h=><th key={h} className={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {drilledSites.map((x,i)=>{
                        const pct=x.previous?(x.saving/x.previous)*100:0;
                        return <tr key={`${x.grid}-${x.siteId}`} className="border-b border-slate-200 even:bg-slate-50">
                          <td className={td}>{i+1}</td>
                          <td className={td+" font-black text-blue-700"}>{x.siteId}</td>
                          <td className={td+" font-black"}>{x.grid}</td>
                          <td className={td}>{Math.round(x.previous).toLocaleString()}</td>
                          <td className={td+" font-black"}>{Math.round(x.current).toLocaleString()}</td>
                          <td className={`${td} font-black ${x.saving>=0?"text-emerald-700":"text-red-600"}`}>{x.saving>=0?"+":""}{Math.round(x.saving).toLocaleString()}</td>
                          <td className={`${td} font-black ${pct>=0?"text-emerald-700":"text-red-600"}`}>{pct.toFixed(2)}%</td>
                          <td className={td+" font-black"}>{Math.round(x.lastTwo).toLocaleString()}</td>
                          <td className={td}><span className={`rounded-full px-2 py-1 text-[11px] font-black ${x.saving>0?"bg-emerald-100 text-emerald-700":x.saving<0?"bg-red-100 text-red-700":"bg-slate-100 text-slate-600"}`}>{x.saving>0?"Saving":x.saving<0?"Increase":"Flat"}</span></td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>}

        {tab==="yoy" && <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black">YoY & Worst Sites</h3><p className="text-xs text-slate-500">YTD high fuel, last two months ({lastTwoMonths.join(" + ")}), and persistent high consumers</p></div><ExportButtonComponent data={exportWorst} filename={`Fuel_Worst_Sites_${view}`} label="Export Worst Sites" format="excel" variant="danger"/></div><div className="mt-4"><input value={siteSearch} onChange={e=>setSiteSearch(e.target.value)} placeholder="Search Site ID / Grid" className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"/></div></div>
          {[["2026 YTD Highest Fuel",worstYtd,"current"],[`Last Two Months · ${lastTwoMonths.join(" + ")}`,worstLastTwo,"lastTwo"],["Persistent High Fuel · Top-20 overlap",persistent,"current"]].map(([title,list,metric]:any)=><div key={title} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"><div className="border-b border-slate-200 p-4 font-black">{title}</div><div className="overflow-x-auto"><table className={tableClass}><thead className="bg-emerald-900 text-white"><tr>{["#","Site ID","Grid",`${previousYear} L`,`${currentYear} L`,"YoY Increase/(Reduction)",`Last 2M L`].map(h=><th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{(list as any[]).filter(x=>!siteSearch.trim()||`${x.siteId} ${x.grid}`.toLowerCase().includes(siteSearch.toLowerCase())).map((x,i)=><tr key={`${title}-${x.siteId}`} className="border-b border-slate-200 even:bg-slate-50"><td className={td}>{i+1}</td><td className={td+" font-black text-blue-700"}>{x.siteId}</td><td className={td}>{x.grid}</td><td className={td}>{Math.round(x.previous).toLocaleString()}</td><td className={td+" font-black"}>{Math.round(x.current).toLocaleString()}</td><td className={`${td} font-black ${x.variance>0?"text-red-600":"text-emerald-700"}`}>{x.variance>0?"+":""}{Math.round(x.variance).toLocaleString()}</td><td className={td+" font-black"}>{Math.round(x.lastTwo).toLocaleString()}</td></tr>)}</tbody></table></div></div>)}
        </>}

        {tab==="currentMonth" && <>
          {currentMonthName === "Oct" && <>
            <section className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-base font-black text-[#075B39]">October Fuel Budget & DG Control</h3><p className="text-xs text-slate-500">28,000 L monthly budget · 190 L per DG planning benchmark</p></div><span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">{view === "overall" && gridFilter === "__all" ? "Overall budget" : "Filtered consumption · overall budget unchanged"}</span></div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["October Budget", `${octoberFuelBudget.toLocaleString()} L`, "Approved overall target"],
                  ["Fuel Filled MTD", `${Math.round(currentMonthTotal).toLocaleString()} L`, "Selected region/grid"],
                  ["Budget Balance", `${Math.round(octoberBudgetRemaining).toLocaleString()} L`, "Budget less displayed MTD fuel"],
                  ["DG Benchmark", `${perDgMonthlyTarget} L / DG`, `${dgInventory.length} DGs in recon inventory`],
                ].map(([label,value,sub],i)=><div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-[11px] font-bold uppercase text-slate-600">{label}</div><div className={`mt-1 text-2xl font-black ${i===2&&octoberBudgetRemaining<0?"text-red-700":"text-[#075B39]"}`}>{value}</div><div className="mt-1 text-[11px] text-slate-500">{sub}</div></div>)}
              </div>
              <p className="mt-3 text-xs text-slate-600">Budget balance is the remaining <b>fuel allocation</b>, not physical diesel stock in tanks. When C-1, C-6 or a grid is selected, displayed fuel is filtered but the 28,000 L budget remains the overall target (no unapproved regional split assumed). The 190 L/DG benchmark is separate from the 28,000 L budget.</p>
            </section>
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div><h3 className="text-base font-black text-[#075B39]">Grid-wise DG Category & Fuel / DG</h3><p className="text-xs text-slate-500">Actual fuel poured (liters) by DG category · monthly benchmark 190 L per DG · highest category in each grid highlighted</p></div>
                <ExportButtonComponent data={currentMonthCategoryFuel.matrix.map(r=>{const dg=currentMonthDgGridSummary.find(g=>g.grid===r.grid);return {Grid:r.grid,"Total DGs":dg?.totalDGs||0,...Object.fromEntries(currentMonthCategoryFuel.categories.map(c=>[`${c} (L)`,Number(r.values[c].toFixed(2))])),"Total Fuel (L)":Number(r.total.toFixed(2)),"Fuel / DG (L)":dg?.totalDGs?Number((r.total/dg.totalDGs).toFixed(2)):null,"Target / DG (L)":perDgMonthlyTarget,"Target Breached":dg?.totalDGs&&r.total/dg.totalDGs>perDgMonthlyTarget?"YES":"NO"}})} filename={`Fuel_${currentMonthLabel}_DG_Category_Litres_${view}`} label="Export DG Summary" format="excel" variant="success"/>
              </div>
              <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-[13px]">
                <thead className="bg-emerald-900 text-white"><tr><th className="whitespace-nowrap px-3 py-3 text-left">Grid</th><th className="whitespace-nowrap px-3 py-3 text-right">Total DGs</th>{currentMonthCategoryFuel.categories.map(c=><th key={c} className="whitespace-nowrap px-3 py-3 text-right">{c} (L)</th>)}<th className="whitespace-nowrap px-3 py-3 text-right">Total Fuel (L)</th><th className="whitespace-nowrap px-3 py-3 text-right">Fuel / DG (L)</th><th className="px-3 py-3 text-center">Action</th></tr></thead>
                <tbody>{currentMonthCategoryFuel.matrix.map(r=>{const dg=currentMonthDgGridSummary.find(g=>g.grid===r.grid);const count=dg?.totalDGs||0;const perDG=count?r.total/count:0;const expanded=categoryDrillGrid===r.grid;return <React.Fragment key={r.grid}><tr className={`border-b border-slate-100 even:bg-slate-50 hover:bg-emerald-50 ${expanded?"bg-emerald-50":""}`}><td className="px-3 py-2.5 font-bold text-[#075B39]">{r.grid}</td><td className="px-3 py-2.5 text-right tabular-nums">{count||"—"}</td>{currentMonthCategoryFuel.categories.map(c=><td key={c} className={`px-3 py-2.5 text-right tabular-nums ${r.dominant===c&&r.values[c]>0?"bg-emerald-50 font-bold text-emerald-900":""}`}>{Math.round(r.values[c]).toLocaleString()}</td>)}<td className="px-3 py-2.5 text-right font-bold tabular-nums">{Math.round(r.total).toLocaleString()}</td><td className={`px-3 py-2.5 text-right font-extrabold tabular-nums ${count&&perDG>perDgMonthlyTarget?"bg-red-100 text-red-700":"text-emerald-800"}`}>{count?perDG.toFixed(1):"N/A"}{count&&perDG>perDgMonthlyTarget?" ⚠":""}</td><td className="px-3 py-2 text-center"><button type="button" onClick={()=>setCategoryDrillGrid(expanded?null:r.grid)} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100">{expanded?"Hide Sites":"View Sites"}{expanded?<ChevronUp className="h-3.5 w-3.5"/>:<ChevronDown className="h-3.5 w-3.5"/>}</button></td></tr>
                {expanded&&<tr><td colSpan={currentMonthCategoryFuel.categories.length+5} className="bg-emerald-50 p-3"><div className="overflow-hidden rounded-lg border border-emerald-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5"><div><h4 className="text-sm font-extrabold text-slate-900">{r.grid} · All DG Sites ({categoryGridSites.length})</h4><p className="text-xs text-slate-500">Highest fuel poured first · includes zero-fuel inventory sites and unmatched refueling records</p></div><div className="flex items-center gap-2"><ExportButtonComponent data={categoryGridExport} filename={`Fuel_${currentMonthLabel}_${r.grid}_DG_Sites`} label="Export Sites CSV" format="csv" variant="success"/><button type="button" onClick={()=>setCategoryDrillGrid(null)} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">Close ×</button></div></div><div className="max-h-[430px] overflow-auto"><table className="w-full min-w-[850px] text-[13px]"><thead className="sticky top-0 z-10 bg-[#075B39] text-white"><tr>{["Site ID","DG Category","Fuel Poured (L)","Fill Events","Latest Fuel Date","Inventory Status","190 L/DG"].map((h,i)=><th key={h} className={`px-3 py-2.5 ${i===0||i===1||i===5?"text-left":"text-right"}`}>{h}</th>)}</tr></thead><tbody>{categoryGridSites.map(site=><tr key={site.siteId} className="border-b border-slate-100 even:bg-slate-50 hover:bg-emerald-50"><td className="px-3 py-2 font-bold text-[#075B39]">{site.siteId}</td><td className="px-3 py-2">{site.category}</td><td className={`px-3 py-2 text-right font-bold tabular-nums ${site.total>perDgMonthlyTarget?"text-red-700":""}`}>{site.total.toLocaleString(undefined,{maximumFractionDigits:2})}</td><td className="px-3 py-2 text-right">{site.fills}</td><td className="px-3 py-2 text-right">{site.lastDate||"—"}</td><td className="px-3 py-2 text-xs">{site.source}</td><td className={`px-3 py-2 text-right font-bold ${site.total>perDgMonthlyTarget?"text-red-700":"text-slate-500"}`}>{site.total>perDgMonthlyTarget?"Above target":"—"}</td></tr>)}</tbody></table></div><div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-600">{categoryGridSites.length} sites · {Math.round(categoryGridSites.reduce((sum,s)=>sum+s.total,0)).toLocaleString()} L poured · 190 L is a full-month benchmark.</div></div></td></tr>}</React.Fragment>})}
                <tr className="bg-emerald-100 font-black text-emerald-950"><td className="px-3 py-3">Total</td><td className="px-3 py-3 text-right">{currentMonthDgGridSummary.reduce((sum,g)=>sum+g.totalDGs,0)}</td>{currentMonthCategoryFuel.categories.map(c=><td key={c} className="px-3 py-3 text-right">{Math.round(currentMonthCategoryFuel.totals[c]).toLocaleString()}</td>)}<td className="px-3 py-3 text-right">{Math.round(currentMonthCategoryFuel.matrix.reduce((sum,r)=>sum+r.total,0)).toLocaleString()}</td><td className="px-3 py-3 text-right">{currentMonthDgGridSummary.reduce((sum,g)=>sum+g.totalDGs,0)?(currentMonthCategoryFuel.matrix.reduce((sum,r)=>sum+r.total,0)/currentMonthDgGridSummary.reduce((sum,g)=>sum+g.totalDGs,0)).toFixed(1):"N/A"}</td><td className="px-3 py-3 text-center">—</td></tr></tbody>
              </table></div>
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Fuel / DG = total grid fuel poured ÷ total DGs in the reconciliation inventory. Values above 190 L/DG are highlighted red. DG counts come from Deviation Fuel; actual fill liters from Fuel History. Unmatched fuel remains separate to preserve reconciliation. The 190 L target is a monthly benchmark; an in-progress month is not a full-month comparison.</p>
            </section>
          </>}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50 p-5 shadow-md"><div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">{currentMonthLabel} Fuel</div><div className="mt-2 text-3xl font-black tracking-tight text-[#006B3C]">{Math.round(currentMonthTotal).toLocaleString()} <span className="text-lg">L</span></div></div>
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-md"><div className="text-[11px] font-black uppercase tracking-wider text-blue-700">Sites Fueled</div><div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{currentMonthSites}</div></div>
            <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-amber-50 p-5 shadow-md"><div className="text-[11px] font-black uppercase tracking-wider text-amber-700">Fuel Fill Events</div><div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{currentMonthFills}</div></div>
            <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50 p-5 shadow-md"><div className="text-[11px] font-black uppercase tracking-wider text-violet-700">Average / Active Day</div><div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{Math.round(currentMonthAvgDay).toLocaleString()} <span className="text-lg">L</span></div></div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
              <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-5"><h3 className="text-base font-black text-slate-950">{currentMonthLabel} · Grid-wise Summary</h3><p className="text-xs text-slate-500">Total fuel filled by grid during current month</p></div>
              <div className="max-h-[390px] overflow-auto">
                <table className={tableClass}><thead className="sticky top-0 bg-[#006B3C]"><tr><th className={th}>Grid</th><th className={th}>Fuel (L)</th><th className={th}>Share</th></tr></thead>
                  <tbody>{[...currentMonthGridMatrix].sort((a,b)=>b.total-a.total).map(x=><tr key={x.grid} className="border-b border-slate-200 even:bg-slate-50"><td className={td+" font-black text-[#006B3C]"}>{x.grid}</td><td className={td+" font-black"}>{Math.round(x.total).toLocaleString()}</td><td className={td}>{currentMonthTotal?((x.total/currentMonthTotal)*100).toFixed(1):"0.0"}%</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
              <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white p-5"><h3 className="text-base font-black text-slate-950">{currentMonthLabel} · Day-wise Summary</h3><p className="text-xs text-slate-500">Daily fuel, fill events and unique sites</p></div>
              <div className="max-h-[390px] overflow-auto">
                <table className={tableClass}><thead className="sticky top-0 bg-[#006B3C]"><tr>{["Date","Fuel L","Fill Events","Sites"].map(h=><th key={h} className={th}>{h}</th>)}</tr></thead>
                  <tbody>{currentMonthDaySummary.map(x=><tr key={x.day} className="border-b border-slate-200 even:bg-slate-50"><td className={td+" font-black"}>{x.date}</td><td className={td+" font-black"}>{Math.round(x.fuel).toLocaleString()}</td><td className={td}>{x.fills}</td><td className={td}>{x.sites}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-white shadow-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-gradient-to-r from-[#ecfdf5] via-white to-[#f0fdfa] p-5">
              <div><h3 className="text-lg font-black text-slate-950">{currentMonthLabel} · Grid × Date Fuel Matrix</h3><p className="text-xs text-slate-500">Grid IDs in rows · calendar dates in columns · values are Fuel Quantity Filled (L)</p></div>
              <ExportButtonComponent data={currentMonthMatrixExport} filename={`Fuel_${currentMonthLabel}_Grid_Day_Matrix_${view}`} label="Export Matrix" format="excel" variant="success"/>
            </div>
            <div className="max-h-[570px] overflow-auto">
              <table className="min-w-max w-full text-[13px]">
                <thead className="sticky top-0 z-20 bg-[#006B3C] text-white">
                  <tr>
                    <th className="sticky left-0 z-30 bg-[#005c36] px-4 py-4 text-left text-[13px] font-black uppercase tracking-wide">Grid ID</th>
                    {currentMonthUnknownDateRows.length > 0 && <th className="min-w-[110px] px-2 py-4 text-center font-black" title="Fuel records with unrecognized refueling dates">Date N/A</th>}
                    {currentMonthDates.map(day=><th key={day} className="min-w-[72px] border-l border-white/10 px-2 py-4 text-center text-[13px] font-black">{day}</th>)}
                    <th className="sticky right-0 z-30 bg-[#004f30] px-4 py-4 text-center text-[13px] font-black uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMonthGridMatrix.map(row=><React.Fragment key={row.grid}><tr className="border-b border-slate-200 even:bg-slate-50">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2.5 font-black text-[#006B3C]"><button type="button" onClick={()=>setMonthDrillGrid(monthDrillGrid===row.grid?null:row.grid)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[14px] font-black text-[#006B3C] hover:bg-emerald-100 hover:text-emerald-900" title={`View all fueled sites in ${row.grid}`}>{row.grid}<ChevronDown className="h-3.5 w-3.5"/></button></td>
                    {currentMonthUnknownDateRows.length > 0 && <td className="bg-amber-50 px-2 py-3 text-center font-bold text-amber-800">{row.days.Unknown ? Math.round(row.days.Unknown).toLocaleString() : "-"}</td>}
                    {currentMonthDates.map(day=>{const v=row.days[String(day)]||0;const heat=v>=500?"bg-rose-50 text-rose-800":v>=300?"bg-amber-50 text-amber-800":v>=150?"bg-emerald-50 text-emerald-800":v>0?"text-slate-900":"text-slate-300";return <td key={day} className={`border-l border-slate-100 px-2 py-3.5 text-center text-[13px] font-bold ${heat}`}>{v>0?Math.round(v).toLocaleString():"-"}</td>})}
                    <td className="sticky right-0 z-10 bg-emerald-100 px-4 py-3.5 text-center text-[14px] font-black text-emerald-900">{Math.round(row.total).toLocaleString()}</td>
                  </tr>
          {monthDrillGrid===row.grid && (
            <tr><td colSpan={currentMonthDates.length+2+(currentMonthUnknownDateRows.length>0?1:0)} className="bg-emerald-50 p-3"><div className="rounded-xl border-2 border-emerald-300 bg-white shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={()=>setMonthDrillGrid(null)} className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-emerald-800">× Close</button>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wide text-emerald-700">{currentMonthName}-{String(currentYear).slice(-2)} Site Drill-down</div>
                    <h3 className="text-xl font-black text-slate-950">{monthDrillGrid} · Which Sites Consumed More Fuel?</h3>
                    <p className="text-xs text-slate-600">{currentMonthDrillSites.length} fueled sites · ranked highest current-month consumption first · daily liters shown by date</p>
                  </div>
                </div>
                <ExportButtonComponent data={currentMonthDrillExport} filename={`Fuel_${currentMonthLabel}_${monthDrillGrid}_Site_Daily`} label={`Export ${monthDrillGrid} Sites`} format="excel" variant="success"/>
              </div>

              <div className="grid grid-cols-2 gap-3 border-b border-slate-200 p-4 sm:grid-cols-4">
                <div><div className="text-[10px] font-black uppercase text-slate-500">Grid Fuel</div><div className="text-2xl font-black text-[#006B3C]">{Math.round(currentMonthDrillTotal).toLocaleString()} L</div></div>
                <div><div className="text-[10px] font-black uppercase text-slate-500">Fueled Sites</div><div className="text-xl font-black">{currentMonthDrillSites.length}</div></div>
                <div><div className="text-[10px] font-black uppercase text-slate-500">Highest Fuel Site</div><div className="text-2xl font-black text-red-600">{currentMonthDrillSites[0]?.siteId || "-"}</div></div>
                <div><div className="text-[10px] font-black uppercase text-slate-500">Highest Site Fuel</div><div className="text-2xl font-black text-red-600">{Math.round(currentMonthDrillSites[0]?.total || 0).toLocaleString()} L</div></div>
              </div>

              <div className="max-h-[600px] overflow-auto">
                <table className="min-w-max w-full text-[13px]">
                  <thead className="sticky top-0 z-20 bg-[#006B3C] text-white">
                    <tr>
                      <th className="sticky left-0 z-30 bg-[#006B3C] px-3 py-3 text-left font-black">Site ID</th>
                      {currentMonthDates.map(day=><th key={day} className="min-w-[60px] px-2 py-3 text-center font-black">{day}</th>)}
                      <th className="bg-[#005A33] px-3 py-3 text-center font-black">{currentMonthName} Total</th>
                      <th className="bg-[#005A33] px-3 py-3 text-center font-black">Fills</th>
                      <th className="bg-[#005A33] px-3 py-3 text-center font-black">Avg/Fill</th>
                      <th className="sticky right-0 z-30 bg-[#004C2B] px-3 py-3 text-center font-black">Grid %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentMonthDrillSites.map((row,i)=>{
                      const contribution=currentMonthDrillTotal?(row.total/currentMonthDrillTotal)*100:0;
                      return <tr key={row.siteId} className={`border-b border-slate-200 ${i<3?"bg-red-50":"even:bg-slate-50"}`}>
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-2.5 font-black text-blue-700">{row.siteId}{i<3?<span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-700">TOP {i+1}</span>:null}</td>
                        {currentMonthUnknownDateRows.length > 0 && <td className="bg-amber-50 px-2 py-3 text-center font-bold text-amber-800">{row.days.Unknown ? Math.round(row.days.Unknown).toLocaleString() : "-"}</td>}
                    {currentMonthDates.map(day=>{const v=row.days[String(day)]||0;return <td key={day} className={`px-2 py-2.5 text-center font-bold ${v>0?"text-slate-950":"text-slate-300"}`}>{v>0?Math.round(v).toLocaleString():"-"}</td>})}
                        <td className="bg-emerald-50 px-3 py-2.5 text-center font-black text-emerald-900">{Math.round(row.total).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-center font-black">{row.fills}</td>
                        <td className="px-3 py-2.5 text-center font-black">{row.fills?Math.round(row.total/row.fills).toLocaleString():"-"}</td>
                        <td className="sticky right-0 z-10 bg-emerald-50 px-3 py-2.5 text-center font-black text-emerald-900">{contribution.toFixed(1)}%</td>
                      </tr>
                    })}
                    <tr className="sticky bottom-0 z-20 bg-slate-900 text-white">
                      <td className="sticky left-0 bg-slate-900 px-3 py-3 font-black">Grid Daily Total</td>
                      {currentMonthDates.map(day=>{const v=currentMonthDrillSites.reduce((a,r)=>a+(r.days[String(day)]||0),0);return <td key={day} className="px-2 py-3 text-center font-black">{v?Math.round(v).toLocaleString():"-"}</td>})}
                      <td className="bg-emerald-700 px-3 py-3 text-center font-black">{Math.round(currentMonthDrillTotal).toLocaleString()}</td>
                      <td className="px-3 py-3 text-center font-black">{currentMonthDrillSites.reduce((a,r)=>a+r.fills,0)}</td>
                      <td className="px-3 py-3 text-center font-black">-</td>
                      <td className="sticky right-0 bg-emerald-700 px-3 py-3 text-center font-black">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div></td></tr>
          )}
                  </React.Fragment>)}
                  <tr className="sticky bottom-0 z-20 bg-[#12372a] text-white">
                    <td className="sticky left-0 bg-[#12372a] px-4 py-4 text-[13px] font-black uppercase">Daily Total</td>
                    {currentMonthDates.map(day=>{const v=currentMonthGridMatrix.reduce((a,r)=>a+(r.days[String(day)]||0),0);return <td key={day} className="border-l border-white/10 px-2 py-4 text-center text-[13px] font-black">{Math.round(v).toLocaleString()}</td>})}
                    <td className="sticky right-0 bg-emerald-700 px-3 py-3 text-center font-black">{Math.round(currentMonthTotal).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>


        </>}

        </main>
      </div>
    </div>
  );
}
