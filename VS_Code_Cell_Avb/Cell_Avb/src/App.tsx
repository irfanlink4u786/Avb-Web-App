import React, { useState, useEffect, useMemo, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Crown,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Zap,
  Battery,
  AlertTriangle,
  BatteryWarning,
  Radio,
  RefreshCw,
  Database,
  AlertCircle,
  Menu,
  Activity,
  MapPin,
  ChevronDown,
  ChevronUp,
  Award,
  Search,
  X,
  Cpu,
  CloudRain,
  FileSpreadsheet,
  Network,
  Share2,
  Building2,
  Fuel,
  ListChecks,
  Clock,
  CheckCircle2,
  GitCompare,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  Area,
} from "recharts";
import ErrorBoundary from "./components/ErrorBoundary";
import OverallSummaryComponent from "./components/OverallSummary";
import HardwareIssues from "./components/HardwareIssues";
import ExportButton from "./components/ExportButton";
import WeatherRadar from "./components/WeatherRadar";
import RainAlertWidget from "./components/RainAlertWidget";
import EmployeePerformance from "./components/EmployeePerformance";
import { fetchGoogleSheet } from "./services/googleSheets";
import { type SheetPayload } from "./types";
import {
  type SiteData,
  PGS_GROUP,
  SB_GROUP,
  CATEGORY_COLORS,
  CATEGORY_THRESHOLDS,
  normalizeRow,
  hasDG,
  hasLiIon,
  hasAGM,
  isBelowBase,
  isNPSSite,
} from "./types";

// ============================================================
//  CONSTANTS
// ============================================================

const SHEET_IDS = {
  june: "1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk",
  july: "1aLTAisv5jjRuIkTVa6MjWZ-QFOSYn8FvMlJ09GWUpX0",
  august: "1ds17me8tjnsV-JoQnx6SThCSGM3AkULPsnqP3H0M30w",
  september: "1vyHPFzh28wf0a4b__Cv65bcuFh-pylnkGRcUuX1XpEA",
} as const;

// Month dashboard sidebar – Pre‑Vs‑Post and Hardware Issues are removed
const NAV_ITEMS = [
  { id: "overall", label: "Overall Summary", icon: LayoutDashboard },
  { id: "grid-performance", label: "Grid Performance", icon: Award },
  { id: "employees", label: "Employees", icon: Users },
  { id: "platinum-plus", label: "Platinum+", icon: Crown },
  { id: "pgs", label: "PGS Sites", icon: TrendingUp },
  { id: "sb", label: "SB Sites", icon: TrendingDown },
  { id: "nps", label: "NPS Sites", icon: Sparkles },
  { id: "5g", label: "5G Sites", icon: Radio },
  { id: "dg", label: "DG Sites", icon: Zap },
  { id: "li-ion", label: "Li-ion BB", icon: Battery },
  { id: "below-base", label: "Below Base", icon: AlertTriangle },
  { id: "agm", label: "AGM BB", icon: BatteryWarning },
  { id: "rca", label: "RCA of Plat+", icon: ListChecks },
  { id: "query", label: "Site Query", icon: Search },
  { id: "weather", label: "Weather Radar", icon: CloudRain },
] as const;

type Month = "june" | "july" | "august" | "september";
type AppState = "loading" | "dashboard" | "error";
type ViewMode = "home" | "month" | "prepost" | "hardware";
type PrePostSubView = "analysis" | "query";

// ============================================================
//  UTILITY FUNCTIONS
// ============================================================

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

function indexToColumn(index: number): string {
  let col = "";
  let num = index;
  while (num > 0) {
    const rem = (num - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    num = Math.floor((num - 1) / 26);
  }
  return col;
}

// ============================================================
//  MOCK DATA (fallback)
// ============================================================

const MOCK_SITES: SiteData[] = [
  {
    siteName: "SITE-001",
    subRegion: "C-1",
    revenueCategory: "Platinum",
    grid: "Grid-A",
    currentAvb: 97.2,
    monthlyAvb: 96.8,
    latitude: "24.8607",
    longitude: "67.0011",
    dgStatus: "Operational",
    dgInstalled: "Operational",
    dgRating: "100kVA",
    liIonInstalled: "YES",
    liIonCapacity: 200,
    agmBb: "No",
    bbStatus: "Good",
    belowBase: "No",
    msGtl: "Jane Smith",
    zongLead: "Mike Johnson",
    clusterOwner: "John Doe",
    npsSiteDomain: "",
    technology: "4G",
    terrain: "Urban",
    sharingStatus: "Shared",
    indoorOutdoor: "Outdoor",
    hubSingle: "Hub",
    dependentSites: 3,
    chronic: "No",
    dgChronic: "No",
    liIonChronic: "No",
    target: 98.5,
    city: "Karachi",
    ca2G: 98.1,
    ca3G: 97.5,
    ca4G: 96.8,
    dailyData: {
      "23-Jun-26": 97.2,
      "24-Jun-26": 96.8,
      "25-Jun-26": 97.0,
    },
    dailyLs: {
      "23-Jun-26": 2.5,
      "24-Jun-26": 1.8,
      "25-Jun-26": 0.5,
    },
  },
];

// ============================================================
//  SHARED UI COMPONENTS
// ============================================================

function CaBadge({ value, threshold }: { value: number; threshold: number }) {
  const color = value >= threshold ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400";
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>{value.toFixed(2)}%</span>;
}

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] || "#475569";
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: `${color}22`, color }}>
      {category}
    </span>
  );
}

function FilterSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-sm text-slate-200 transition-colors w-full justify-between min-w-[150px]"
      >
        <span className="text-slate-500">{label}:</span>
        <span className="font-medium truncate max-w-[120px]">{value === "__all" ? "All" : value}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg bg-slate-900 border border-slate-600 shadow-xl py-1">
            <button
              onClick={() => {
                onChange("__all");
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-800 ${value === "__all" ? "text-cyan-400" : "text-slate-300"}`}
            >
              All
            </button>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-800 truncate ${value === opt ? "text-cyan-400" : "text-slate-300"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
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

function DetailModal({ row, onClose }: { row: SiteData; onClose: () => void }) {
  const fields: { label: string; value: string | number | undefined; type?: "ca" | "category" }[] = [
    { label: "Site ID", value: row.siteName },
    { label: "Revenue Category", value: row.revenueCategory, type: "category" },
    { label: "Current CA%", value: row.currentAvb, type: "ca" },
    { label: "Monthly AVB", value: row.monthlyAvb, type: "ca" },
    { label: "TCH / 2G CA", value: row.ca2G, type: "ca" },
    { label: "Cell_U / 3G CA", value: row.ca3G, type: "ca" },
    { label: "Cell_EU / 4G CA", value: row.ca4G, type: "ca" },
    { label: "Sub-Region", value: row.subRegion },
    { label: "Site Terrain", value: row.terrain },
    { label: "Technology", value: row.technology },
    { label: "Grid", value: row.grid },
    { label: "Sharing Status", value: row.sharingStatus },
    { label: "Indoor / Outdoor", value: row.indoorOutdoor },
    { label: "DG Status", value: row.dgInstalled },
    { label: "DG Rating", value: row.dgRating },
    { label: "Li-ion Installed", value: row.liIonInstalled },
    { label: "Li-ion Capacity", value: row.liIonCapacity ? `${row.liIonCapacity} Ah` : "—" },
    { label: "AGM/LION", value: row.agmBb },
    { label: "BB Status", value: row.bbStatus },
    { label: "Below BASE", value: row.belowBase },
    { label: "HUB/Single", value: row.hubSingle },
    { label: "Dependent Sites", value: row.dependentSites },
    { label: "Cluster Owner", value: row.clusterOwner },
    { label: "MS GTL", value: row.msGtl },
    { label: "Zone Lead", value: row.zongLead },
    { label: "Chronic", value: row.chronic },
    { label: "DG Chronic", value: row.dgChronic },
    { label: "Li-ion Chronic", value: row.liIonChronic },
    { label: "Target", value: row.target ? `${row.target}%` : "—" },
    { label: "City", value: row.city },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-800 border border-slate-600 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Radio className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Site {row.siteName}</h3>
              <p className="text-slate-400 text-xs">{row.revenueCategory} · {row.terrain} · {row.subRegion}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.label} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
              <p className="text-slate-500 text-[11px] uppercase tracking-wide">{f.label}</p>
              <div className="text-slate-100 text-sm font-medium mt-0.5">
                {f.type === "ca" && typeof f.value === "number" && f.value > 0 ? (
                  <CaBadge value={f.value} threshold={95} />
                ) : f.type === "category" ? (
                  <CategoryBadge category={String(f.value)} />
                ) : (
                  <span className="break-words">{f.value || "—"}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function uniqueVals(rows: SiteData[], key: keyof SiteData): string[] {
  return Array.from(
    new Set(
      rows
        .map((r) => r[key])
        .filter((v): v is string | number => v != null && v.toString().trim() !== "")
        .map((v) => v.toString())
    )
  ).sort();
}

function SiteTable({ rows, onSelect }: { rows: SiteData[]; onSelect: (r: SiteData) => void }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const pageSize = 12;

  const filtered = useMemo(() => {
    let r = rows;
    for (const [key, val] of Object.entries(filters)) {
      if (val !== "__all" && val) {
        r = r.filter((row) => (row[key as keyof SiteData] ?? "").toString().trim() === val);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) => Object.values(row).some((v) => v?.toString().toLowerCase().includes(q)));
    }
    return r;
  }, [rows, filters, search]);

  useEffect(() => {
    setPage(0);
  }, [filters, search, rows.length]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const filterConfigs = [
    { key: "revenueCategory", label: "Category", options: uniqueVals(rows, "revenueCategory") },
    { key: "terrain", label: "Terrain", options: uniqueVals(rows, "terrain") },
    { key: "subRegion", label: "Sub-Region", options: uniqueVals(rows, "subRegion") },
    { key: "sharingStatus", label: "Sharing", options: uniqueVals(rows, "sharingStatus") },
    { key: "dgStatus", label: "DG", options: uniqueVals(rows, "dgStatus") },
  ];

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex flex-col gap-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          Site Inventory
          <span className="text-slate-500 font-normal text-sm">({filtered.length} of {rows.length})</span>
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Site ID, owner, OMO, cluster…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-500 outline-none text-sm text-slate-100 placeholder:text-slate-600"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filterConfigs.map((f) => (
            <FilterSelect
              key={f.key}
              label={f.label}
              options={f.options}
              value={filters[f.key] ?? "__all"}
              onChange={(v) => setFilters((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
          {(Object.values(filters).some((v) => v !== "__all") || search) && (
            <button
              onClick={() => {
                setFilters({});
                setSearch("");
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
            >
              <X className="w-4 h-4" /> Clear
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/50 text-left">
              {["Site ID", "Category", "CA%", "Terrain", "Tech", "Sub-Region", "Sharing", "DG", "Li-ion", "Owner"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <motion.tr
                key={row.siteName + i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.02, 0.2) }}
                onClick={() => onSelect(row)}
                className="border-t border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors"
              >
                <td className="px-3 py-2.5 font-mono text-cyan-300 whitespace-nowrap">{row.siteName}</td>
                <td className="px-3 py-2.5">
                  <CategoryBadge category={row.revenueCategory} />
                </td>
                <td className="px-3 py-2.5">
                  {row.currentAvb > 0 ? <CaBadge value={row.currentAvb} threshold={95} /> : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{row.terrain}</td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{row.technology}</td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{row.subRegion}</td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{row.sharingStatus}</td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{row.dgStatus}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {row.liIonInstalled?.toUpperCase() === "YES" ? (
                    <span className="text-emerald-400 text-xs">✓ {row.liIonCapacity ? `${row.liIonCapacity}Ah` : ""}</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{row.clusterOwner}</td>
              </motion.tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-slate-500">No sites match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-slate-700">
          <p className="text-xs text-slate-500">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg bg-slate-700 disabled:opacity-40 hover:bg-slate-600 text-sm transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg bg-slate-700 disabled:opacity-40 hover:bg-slate-600 text-sm transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  CATEGORY PAGE (unchanged)
// ============================================================

function CategoryPage({
  sites,
  title,
  description,
  threshold,
  color = "#06b6d4",
  filterFn,
  lastColumnIndex = 0,
  lastUpdatedDate = "",
}: {
  sites: SiteData[];
  title: string;
  description: string;
  threshold: number;
  color?: string;
  filterFn: (site: SiteData) => boolean;
  lastColumnIndex?: number;
  lastUpdatedDate?: string;
}) {
  const [expandedGrid, setExpandedGrid] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<"zongLead" | "msGtl" | "clusterOwner">("zongLead");

  const filteredSites = useMemo(() => sites.filter(filterFn), [sites, filterFn]);
  const activeSites = useMemo(() => filteredSites.filter((s) => s.currentAvb > 0), [filteredSites]);

  const categoryExportData = useMemo(() => {
    return filteredSites.map((s) => ({
      "Site ID": s.siteName,
      "Revenue Category": s.revenueCategory,
      "Sub-Region": s.subRegion,
      "Current CA%": s.currentAvb?.toFixed(2) || "-",
      "Monthly AVB": s.monthlyAvb?.toFixed(2) || "-",
      Grid: s.grid || "-",
      "DG Status": s.dgInstalled || "-",
      "DG Rating": s.dgRating || "-",
      "Li-ion Installed": s.liIonInstalled || "-",
      "Li-ion Capacity": s.liIonCapacity || "-",
      "AGM/LION": s.agmBb || "-",
      "BB Status": s.bbStatus || "-",
      "Below Base": s.belowBase || "-",
      "Cluster Owner": s.clusterOwner || "-",
      "MS GTL": s.msGtl || "-",
      "Zone Lead": s.zongLead || "-",
      Technology: s.technology || "-",
      Terrain: s.terrain || "-",
      City: s.city || "-",
    }));
  }, [filteredSites]);

  const employeeNames = useMemo(() => {
    const names = new Set<string>();
    activeSites.forEach((site) => {
      const name = (site[selectedLevel] || "Unassigned").trim();
      if (name !== "Unassigned") {
        names.add(name);
      }
    });
    return Array.from(names).sort();
  }, [activeSites, selectedLevel]);

  const employeeFilteredSites = useMemo(() => {
    if (selectedEmployee === "all") {
      return activeSites;
    }
    return activeSites.filter((site) => {
      const name = (site[selectedLevel] || "Unassigned").trim();
      return name === selectedEmployee;
    });
  }, [activeSites, selectedEmployee, selectedLevel]);

  const formatDateKey = (date: Date): string => {
    const day = String(date.getDate());
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const getDaySuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    const r = day % 10;
    if (r === 1) return "st";
    if (r === 2) return "nd";
    if (r === 3) return "rd";
    return "th";
  };

  const lastThreeDays = useMemo(() => {
    if (!lastUpdatedDate) return [];
    const parts = lastUpdatedDate.split("-");
    if (parts.length !== 3) return [];
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1];
    const year = parseInt(parts[2], 10) + 2000;
    const monthMap: Record<string, number> = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };
    const month = monthMap[monthStr];
    if (month === undefined) return [];
    const baseDate = new Date(year, month, day);
    if (isNaN(baseDate.getTime())) return [];

    const dates: Date[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      dates.push(d);
    }

    return dates.map((d) => {
      const dateKey = formatDateKey(d);
      const label = `${d.getDate()}${getDaySuffix(d.getDate())} ${d.toLocaleString("default", { month: "long" })}`;
      return { dateKey, label };
    });
  }, [lastUpdatedDate]);

  const worstSites = useMemo(() => {
    const sorted = [...employeeFilteredSites].sort((a, b) => a.currentAvb - b.currentAvb);
    const top10 = sorted.slice(0, 10);
    return top10.map((site) => {
      const data = site.dailyData || {};
      const values = lastThreeDays.map(({ dateKey }) => data[dateKey] || 0);
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.filter((v) => v > 0).length;
      const avg = count > 0 ? sum / count : 0;
      return { site, values, avg };
    });
  }, [employeeFilteredSites, lastThreeDays]);

  const worstExportData = useMemo(() => {
    return worstSites.map(({ site, values, avg }, i) => {
      const row: Record<string, any> = {
        Rank: i + 1,
        "Site ID": site.siteName,
        "Revenue Category": site.revenueCategory,
        "Sub-Region": site.subRegion,
        Grid: site.grid,
        "Cluster Owner": site.clusterOwner || "-",
        "MS GTL": site.msGtl || "-",
        "Zone Lead": site.zongLead || "-",
      };
      lastThreeDays.forEach(({ label }, idx) => {
        row[label] = values[idx]?.toFixed(2) || "-";
      });
      row["Last 3 Days Avg"] = avg.toFixed(2) + "%";
      row["Current CA%"] = site.currentAvb?.toFixed(2) || "-";
      return row;
    });
  }, [worstSites, lastThreeDays]);

  const gridUnstableSites = useMemo(() => {
    return filteredSites.filter((s) => s.currentAvb > 0 && s.currentAvb < 98);
  }, [filteredSites]);

  const unstableWithDays = useMemo(() => {
    const mapped = gridUnstableSites.map((site) => {
      const data = site.dailyData || {};
      const values = lastThreeDays.map(({ dateKey }) => data[dateKey] || 0);
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.filter((v) => v > 0).length;
      const avg = count > 0 ? sum / count : 0;
      return { site, values, avg };
    });
    return mapped.sort((a, b) => a.avg - b.avg);
  }, [gridUnstableSites, lastThreeDays]);

  const unstableExportData = useMemo(() => {
    return unstableWithDays.map(({ site, values, avg }) => {
      const row: Record<string, any> = {
        "Site ID": site.siteName,
        "Revenue Category": site.revenueCategory,
        "CO (Cluster Owner)": site.clusterOwner || "-",
        "MS GTL": site.msGtl || "-",
        "Zone Lead": site.zongLead || "-",
      };
      lastThreeDays.forEach(({ label }, idx) => {
        row[label] = values[idx]?.toFixed(2) || "-";
      });
      row["Last 3 Days Avg"] = avg.toFixed(2) + "%";
      return row;
    });
  }, [unstableWithDays, lastThreeDays]);

  const stats = useMemo(() => {
    const total = filteredSites.length;
    const avgCa =
      employeeFilteredSites.length > 0
        ? employeeFilteredSites.reduce((sum, s) => sum + s.currentAvb, 0) / employeeFilteredSites.length
        : 0;
    const critical = employeeFilteredSites.filter((s) => s.currentAvb < threshold).length;
    const healthy = employeeFilteredSites.length - critical;

    const gridMap = new Map<string, SiteData[]>();
    employeeFilteredSites.forEach((site) => {
      const grid = site.grid || "Unknown";
      if (!gridMap.has(grid)) gridMap.set(grid, []);
      gridMap.get(grid)!.push(site);
    });

    const gridStats = Array.from(gridMap.entries())
      .map(([grid, gridSites]) => {
        const active = gridSites.filter((s) => s.currentAvb > 0);
        return {
          grid,
          count: gridSites.length,
          activeCount: active.length,
          avgCa: active.length > 0 ? active.reduce((sum, s) => sum + s.currentAvb, 0) / active.length : 0,
          critical: active.filter((s) => s.currentAvb < threshold).length,
          sites: gridSites,
        };
      })
      .sort((a, b) => a.avgCa - b.avgCa);

    const worstGrid = gridStats.length > 0 ? gridStats[0] : null;
    const bestGrid = gridStats.length > 0 ? gridStats[gridStats.length - 1] : null;

    return {
      total,
      avgCa,
      critical,
      healthy,
      gridStats,
      worstGrid,
      bestGrid,
      totalActive: employeeFilteredSites.length,
    };
  }, [employeeFilteredSites, threshold, filteredSites.length]);

  const gridExport = stats.gridStats.map((g) => ({
    Grid: g.grid,
    "Total Sites": g.count,
    "Active Sites": g.activeCount,
    "Avg CA": `${g.avgCa.toFixed(2)}%`,
    "Critical Sites": g.critical,
    Status: g.avgCa >= threshold ? "Healthy" : "Critical",
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1600px] mx-auto space-y-6">
      <div
        className="rounded-xl border p-6 flex items-center justify-between flex-wrap gap-4"
        style={{ background: `linear-gradient(to right, ${color}15, transparent)`, borderColor: `${color}40` }}
      >
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
          <p className="text-slate-400 text-sm">{description}</p>
          <p className="text-xs text-slate-500 mt-1">{filteredSites.length} sites in this category</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButtonComponent
            data={categoryExportData}
            filename={`${title.toLowerCase().replace(/\s+/g, "_")}_all_sites`}
            label={`Export All ${filteredSites.length} Sites`}
            format="excel"
            variant="primary"
          />
          <ExportButtonComponent
            data={categoryExportData}
            filename={`${title.toLowerCase().replace(/\s+/g, "_")}_all_sites`}
            label="CSV"
            format="csv"
            variant="secondary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <MapPin className="w-5 h-5 text-blue-400" />, bg: "bg-blue-500/20", value: stats.total, label: "Total Sites" },
          {
            icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
            bg: "bg-emerald-500/20",
            value: `${stats.avgCa.toFixed(2)}%`,
            label: "Average CA",
          },
          {
            icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
            bg: "bg-red-500/20",
            value: stats.critical,
            label: `Critical (CA < ${threshold}%)`,
          },
          { icon: <Award className="w-5 h-5 text-green-400" />, bg: "bg-green-500/20", value: stats.healthy, label: "Healthy Sites" },
        ].map((k) => (
          <div key={k.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg ${k.bg} flex items-center justify-center`}>{k.icon}</div>
              <div>
                <div className="text-2xl font-bold text-white">{k.value}</div>
                <div className="text-xs text-slate-400">{k.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-medium">Filter by Employee:</span>
            </div>
            <div className="flex gap-1 bg-slate-900 rounded-lg p-1 border border-slate-700">
              {[
                { id: "zongLead" as const, label: "Zone Lead" },
                { id: "msGtl" as const, label: "MS GTL" },
                { id: "clusterOwner" as const, label: "Cluster Owner" },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setSelectedLevel(lvl.id)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    selectedLevel === lvl.id ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:border-cyan-500 outline-none min-w-[180px]"
            >
              <option value="all">All Employees ({employeeNames.length})</option>
              {employeeNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {selectedEmployee !== "all" && (
              <button
                onClick={() => setSelectedEmployee("all")}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div className="text-xs text-slate-500">
            Showing {stats.totalActive} sites
            {selectedEmployee !== "all" && <span className="text-cyan-400 ml-1">· Filtered: {selectedEmployee}</span>}
          </div>
        </div>
      </div>

      <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h4 className="text-lg font-semibold text-white">Worst 10 Sites by CA%</h4>
            <span className="text-xs text-slate-500">
              ({selectedEmployee === "all" ? "All Employees" : selectedEmployee})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Sorted by CA% (Lowest to Highest)</span>
            {worstSites.length > 0 && (
              <ExportButtonComponent
                data={worstExportData}
                filename={`${title.toLowerCase().replace(/\s+/g, "_")}_worst_10`}
                label="Export"
                format="excel"
                variant="danger"
              />
            )}
          </div>
        </div>
        {worstSites.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-500/30">
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">#</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Site ID</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Category</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Sub-Region</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Grid</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Cluster Owner</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">MS GTL</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Zone Lead</th>
                  {lastThreeDays.map(({ label }, idx) => (
                    <th key={idx} className="text-center py-2 px-3 text-slate-400 font-medium">{label}</th>
                  ))}
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">Last 3 Days Avg</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">Current CA%</th>
                </tr>
              </thead>
              <tbody>
                {worstSites.map(({ site, values, avg }, i) => (
                  <tr key={site.siteName} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                    <td className="py-2 px-2 text-center text-slate-500">{i + 1}</td>
                    <td className="py-2 px-3 text-cyan-300 font-mono">{site.siteName}</td>
                    <td className="py-2 px-3">
                      <CategoryBadge category={site.revenueCategory} />
                    </td>
                    <td className="py-2 px-3 text-slate-400">{site.subRegion}</td>
                    <td className="py-2 px-3 text-slate-300">{site.grid}</td>
                    <td className="py-2 px-3 text-slate-300">{site.clusterOwner || "-"}</td>
                    <td className="py-2 px-3 text-slate-300">{site.msGtl || "-"}</td>
                    <td className="py-2 px-3 text-slate-300">{site.zongLead || "-"}</td>
                    {values.map((val, idx) => (
                      <td key={idx} className="py-2 px-3 text-center text-slate-300">
                        {val?.toFixed(2) || "-"}
                      </td>
                    ))}
                    <td className={`py-2 px-3 text-center font-bold ${avg < 98 ? "text-red-400" : "text-amber-400"}`}>
                      {avg.toFixed(2)}%
                    </td>
                    <td className="py-2 px-3 text-center text-slate-300">
                      {site.currentAvb.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">No sites available for the selected filter.</div>
        )}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Grid Performance Analysis - Unstable Sites</h3>
            <p className="text-xs text-slate-400 mt-1">
              Showing {gridUnstableSites.length} sites with Last 3 Days Avg &lt; 98% · Sorted from lowest to highest
            </p>
          </div>
          {gridUnstableSites.length > 0 && (
            <ExportButtonComponent
              data={unstableExportData}
              filename={`${title.toLowerCase().replace(/\s+/g, "_")}_unstable_sites`}
              label={`Export ${gridUnstableSites.length} Sites`}
              format="excel"
              variant="danger"
            />
          )}
        </div>
        {gridUnstableSites.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Site ID</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Rev Category</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">CO (Cluster Owner)</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">MS GTL</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Zone Lead</th>
                  {lastThreeDays.map(({ label }, idx) => (
                    <th key={idx} className="text-center py-2 px-3 text-slate-400 font-medium">{label}</th>
                  ))}
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">Last 3 Days Avg</th>
                </tr>
              </thead>
              <tbody>
                {unstableWithDays.map(({ site, values, avg }) => (
                  <tr key={site.siteName} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="py-2 px-3 text-cyan-300 font-mono">{site.siteName}</td>
                    <td className="py-2 px-3">
                      <CategoryBadge category={site.revenueCategory} />
                    </td>
                    <td className="py-2 px-3 text-slate-300">{site.clusterOwner || "-"}</td>
                    <td className="py-2 px-3 text-slate-300">{site.msGtl || "-"}</td>
                    <td className="py-2 px-3 text-slate-300">{site.zongLead || "-"}</td>
                    {values.map((val, idx) => (
                      <td key={idx} className="py-2 px-3 text-center text-slate-300">
                        {val?.toFixed(2) || "-"}
                      </td>
                    ))}
                    <td className={`py-2 px-3 text-center font-bold ${avg < 98 ? "text-red-400" : "text-amber-400"}`}>
                      {avg.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>All sites are stable! No sites with Last 3 Days Avg &lt; 98%</p>
          </div>
        )}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Grid Performance Analysis - All Sites</h3>
          <ExportButton data={gridExport} filename={`${title.toLowerCase().replace(/\s+/g, "_")}_grid`} sheetName="Grid" label="Export" />
        </div>
        {stats.worstGrid && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wide">Worst Grid</span>
              </div>
              <div className="text-lg font-bold text-white">{stats.worstGrid.grid}</div>
              <div className="text-sm text-red-400">
                {stats.worstGrid.avgCa.toFixed(2)}% avg CA · {stats.worstGrid.critical} critical
              </div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wide">Best Grid</span>
              </div>
              <div className="text-lg font-bold text-white">{stats.bestGrid!.grid}</div>
              <div className="text-sm text-emerald-400">
                {stats.bestGrid!.avgCa.toFixed(2)}% avg CA · {stats.bestGrid!.critical} critical
              </div>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Grid", "Sites", "Active", "Avg CA %", "Critical", "Status", ""].map((h, i) => (
                  <th key={h} className={`${i === 0 ? "text-left px-3" : "text-center px-3"} py-3 text-slate-400 font-medium`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.gridStats.map((g) => {
                const isExpanded = expandedGrid === g.grid;
                return (
                  <Fragment key={g.grid}>
                    <tr className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-3 px-3 text-slate-200 font-medium">{g.grid}</td>
                      <td className="py-3 px-3 text-center text-slate-300">{g.count}</td>
                      <td className="py-3 px-3 text-center text-slate-400">{g.activeCount}</td>
                      <td className={`py-3 px-3 text-center font-semibold ${g.avgCa >= threshold ? "text-emerald-400" : "text-red-400"}`}>
                        {g.avgCa.toFixed(2)}%
                      </td>
                      <td className="py-3 px-3 text-center">
                        {g.critical > 0 ? <span className="text-red-400">{g.critical}</span> : <span className="text-slate-600">0</span>}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            g.avgCa >= threshold ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {g.avgCa >= threshold ? "Healthy" : "Critical"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setExpandedGrid(isExpanded ? null : g.grid)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-900/40">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-700">
                                  {["Site ID", "Category", "CA%", "DG", "Li-ion"].map((h, i) => (
                                    <th key={h} className={`${i === 0 ? "text-left" : i === 2 ? "text-center" : "text-left"} py-2 px-2 text-slate-500`}>
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {g.sites
                                  .slice()
                                  .sort((a, b) => a.currentAvb - b.currentAvb)
                                  .map((s) => (
                                    <tr key={s.siteName} className="border-b border-slate-800">
                                      <td className="py-1.5 px-2 text-cyan-300 font-mono">{s.siteName}</td>
                                      <td className="py-1.5 px-2 text-slate-300">{s.revenueCategory}</td>
                                      <td className={`py-1.5 px-2 text-center font-medium ${s.currentAvb < threshold ? "text-red-400" : "text-emerald-400"}`}>
                                        {s.currentAvb > 0 ? `${s.currentAvb.toFixed(2)}%` : "-"}
                                      </td>
                                      <td className="py-1.5 px-2 text-slate-400">{s.dgInstalled}</td>
                                      <td className="py-1.5 px-2 text-slate-400">{s.liIonInstalled}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
//  SITE QUERY (unchanged)
// ============================================================

function SiteQuery({ sites }: { sites: SiteData[] }) {
  const [search, setSearch] = useState("");
  const [selectedSite, setSelectedSite] = useState<SiteData | null>(null);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return sites
      .filter((s) =>
        s.siteName?.toLowerCase().includes(q) ||
        s.grid?.toLowerCase().includes(q) ||
        s.subRegion?.toLowerCase().includes(q) ||
        s.clusterOwner?.toLowerCase().includes(q) ||
        s.revenueCategory?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [search, sites]);

  const handleSelect = (site: SiteData) => {
    setSelectedSite(site);
    setSearch(site.siteName);
  };

  const clearSearch = () => {
    setSearch("");
    setSelectedSite(null);
  };

  const chartData = useMemo(() => {
    if (!selectedSite) return [];
    const avbData = selectedSite.dailyData || {};
    const lsData = selectedSite.dailyLs || {};
    const allDates = new Set([...Object.keys(avbData), ...Object.keys(lsData)]);
    const sortedDates = Array.from(allDates).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });
    return sortedDates.map((dateKey) => ({
      date: dateKey,
      ca: avbData[dateKey] || 0,
      ls: lsData[dateKey] || 0,
    })).filter(d => d.ca > 0 || d.ls > 0);
  }, [selectedSite]);

  const dailyExport = useMemo(() => {
    if (!selectedSite) return [];
    const avb = selectedSite.dailyData || {};
    const ls = selectedSite.dailyLs || {};
    const dates = Array.from(new Set([...Object.keys(avb), ...Object.keys(ls)])).sort();
    return dates.map((d) => ({
      Date: d,
      "AVB %": avb[d] !== undefined ? avb[d].toFixed(2) : "",
      "Load Shedding (hrs)": ls[d] !== undefined ? ls[d].toFixed(2) : "",
    }));
  }, [selectedSite]);

  function ComboChart({ data, title }: { data: any[]; title: string }) {
    if (!data || data.length === 0) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
          <div className="flex items-center justify-center h-64 text-slate-500">
            No daily data available for this site
          </div>
        </div>
      );
    }

    const validData = data.filter(d => d.ca > 0);
    const avgCA = validData.length > 0 ? validData.reduce((s, d) => s + d.ca, 0) / validData.length : 0;
    const minCA = validData.length > 0 ? Math.min(...validData.map(d => d.ca)) : 0;
    const maxCA = validData.length > 0 ? Math.max(...validData.map(d => d.ca)) : 0;
    const avgLS = data.reduce((s, d) => s + d.ls, 0) / data.length;
    const daysBelow95 = data.filter(d => d.ca < 95).length;
    const lsAbove3 = data.filter(d => d.ls > 3).length;

    const formatXAxis = (tick: string) => {
      const d = new Date(tick);
      if (isNaN(d.getTime())) return tick;
      const day = d.getDate();
      const month = d.toLocaleString('default', { month: 'short' });
      return `${day} ${month}`;
    };

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-white font-semibold text-sm">{title}</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-cyan-500" />
              <span className="text-slate-400">CA % (Bar)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-400" />
              <span className="text-slate-400">Load Shedding hrs (Line)</span>
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={10}
              tick={{ fill: '#64748b' }}
              tickFormatter={formatXAxis}
              interval={Math.floor(data.length / 15)}
            />
            <YAxis
              yAxisId="left"
              stroke="#06b6d4"
              fontSize={10}
              domain={[0, 100]}
              tick={{ fill: '#06b6d4' }}
              label={{ value: 'CA %', angle: -90, position: 'insideLeft', fill: '#06b6d4', fontSize: 10 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#f59e0b"
              fontSize={10}
              tick={{ fill: '#f59e0b' }}
              label={{ value: 'LS (hrs)', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              labelStyle={{ color: '#f1f5f9' }}
              itemStyle={{ color: '#94a3b8' }}
              formatter={(value: any, name: any) => {
                const nameStr = name as string;
                if (nameStr === 'CA %') return `${(value as number).toFixed(2)}%`;
                if (nameStr === 'Load Shedding') return `${(value as number).toFixed(1)}h`;
                return value;
              }}
              labelFormatter={(label) => {
                const d = new Date(label);
                return isNaN(d.getTime()) ? label : d.toLocaleDateString();
              }}
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="ca"
              name="CA %"
              fill="#06b6d4"
              radius={[4, 4, 0, 0]}
              barSize={24}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.ca >= 95 ? '#06b6d4' : entry.ca >= 90 ? '#f59e0b' : '#ef4444'}
                />
              ))}
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="ls"
              name="Load Shedding"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="ls"
              fill="#f59e0b"
              fillOpacity={0.1}
              stroke="none"
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4">
          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Avg CA</p>
            <p className={`text-sm font-bold ${avgCA >= 95 ? "text-emerald-400" : "text-red-400"}`}>
              {avgCA.toFixed(2)}%
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Min CA</p>
            <p className="text-sm font-bold text-red-400">{minCA.toFixed(2)}%</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Max CA</p>
            <p className="text-sm font-bold text-emerald-400">{maxCA.toFixed(2)}%</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Avg LS</p>
            <p className="text-sm font-bold text-amber-400">{avgLS.toFixed(2)}h</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Days Below 95%</p>
            <p className="text-sm font-bold text-red-400">{daysBelow95}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">LS &gt; 3hr</p>
            <p className="text-sm font-bold text-orange-400">{lsAbove3}</p>
          </div>
        </div>
      </div>
    );
  }

  function SiteInfoCard({ site }: { site: SiteData }) {
    const [expanded, setExpanded] = useState(false);
    const mainFields = [
      { label: "Site ID", value: site.siteName, icon: <Radio className="w-3.5 h-3.5" /> },
      { label: "Revenue Category", value: site.revenueCategory, icon: <TrendingUp className="w-3.5 h-3.5" /> },
      { label: "Group", value: PGS_GROUP.includes(site.revenueCategory) ? "PGS" : "SB" },
      { label: "Current CA", value: site.currentAvb > 0 ? `${site.currentAvb.toFixed(2)}%` : "—", icon: <Activity className="w-3.5 h-3.5" /> },
      { label: "Monthly AVB", value: site.monthlyAvb ? `${site.monthlyAvb.toFixed(2)}%` : "—" },
      { label: "Sub-Region", value: site.subRegion, icon: <MapPin className="w-3.5 h-3.5" /> },
      { label: "Grid", value: site.grid },
      { label: "Terrain", value: site.terrain, icon: <MapPin className="w-3.5 h-3.5" /> },
      { label: "Technology", value: site.technology, icon: <Network className="w-3.5 h-3.5" /> },
      { label: "Sharing Status", value: site.sharingStatus, icon: <Share2 className="w-3.5 h-3.5" /> },
      { label: "Indoor / Outdoor", value: site.indoorOutdoor, icon: <Building2 className="w-3.5 h-3.5" /> },
      { label: "DG Status", value: site.dgInstalled, icon: <Fuel className="w-3.5 h-3.5" /> },
      { label: "DG Rating", value: site.dgRating || "—" },
      { label: "Li-ion Installed", value: site.liIonInstalled, icon: <Battery className="w-3.5 h-3.5" /> },
      { label: "Li-ion Capacity", value: site.liIonCapacity ? `${site.liIonCapacity} Ah` : "—" },
    ];
    const expandedFields = [
      { label: "AGM/LION", value: site.agmBb || "—" },
      { label: "BB Status", value: site.bbStatus || "—" },
      { label: "Below Base", value: site.belowBase || "—" },
      { label: "HUB/Single", value: site.hubSingle || "—" },
      { label: "Dependent Sites", value: site.dependentSites || "—" },
      { label: "Cluster Owner", value: site.clusterOwner || "—", icon: <Users className="w-3.5 h-3.5" /> },
      { label: "MS GTL", value: site.msGtl || "—", icon: <Users className="w-3.5 h-3.5" /> },
      { label: "Zone Lead", value: site.zongLead || "—", icon: <Users className="w-3.5 h-3.5" /> },
      { label: "Chronic", value: site.chronic || "—" },
      { label: "DG Chronic", value: site.dgChronic || "—" },
      { label: "Li-ion Chronic", value: site.liIonChronic || "—" },
      { label: "Target", value: site.target ? `${site.target}%` : "—" },
      { label: "City", value: site.city || "—" },
      { label: "Latitude", value: site.latitude || "—" },
      { label: "Longitude", value: site.longitude || "—" },
    ];
    const isHealthy = site.currentAvb >= 95;
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h3 className="text-white font-semibold text-sm">Site Information</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded ${isHealthy ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
              {isHealthy ? "✓ Healthy" : "⚠ Critical"}
            </span>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Show Less" : "Show More"}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {mainFields.map((f) => (
            <div key={f.label} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
                {f.icon}{f.label}
              </div>
              <div className={`text-sm font-medium truncate ${
                f.label === "Current CA" && site.currentAvb > 0 
                  ? site.currentAvb >= 95 ? "text-emerald-400" : "text-red-400"
                  : "text-slate-100"
              }`}>
                {f.value || "—"}
              </div>
            </div>
          ))}
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-slate-700"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {expandedFields.map((f) => (
                  <div key={f.label} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
                      {f.icon}{f.label}
                    </div>
                    <div className="text-sm text-slate-100 font-medium truncate">{f.value || "—"}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1600px] mx-auto space-y-6">
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Search className="w-6 h-6 text-cyan-400" />
          <div>
            <h3 className="text-white font-bold text-lg">Site Query</h3>
            <p className="text-slate-300 text-sm">
              Search for a site to view detailed information, daily AVB vs Load Shedding trend, and location
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedSite(null);
            }}
            placeholder="Search by Site ID, Grid, Sub-Region, Cluster Owner, or Category…"
            className="w-full pl-9 pr-10 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-500 outline-none text-sm text-slate-100 placeholder:text-slate-600"
          />
          {search && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <AnimatePresence>
          {search.trim() && !selectedSite && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-2 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden max-h-72 overflow-y-auto"
            >
              {searchResults.map((site) => (
                <button
                  key={site.siteName}
                  onClick={() => handleSelect(site)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800 border-b border-slate-700/50 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-slate-100 font-mono text-sm">{site.siteName}</span>
                      <span className="text-slate-500 text-xs ml-2">
                        {site.revenueCategory} · {site.subRegion} · {site.grid}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{
                        background: `${CATEGORY_COLORS[site.revenueCategory] || "#475569"}22`,
                        color: CATEGORY_COLORS[site.revenueCategory] || "#94a3b8",
                      }}
                    >
                      {site.revenueCategory}
                    </span>
                    <span className={`text-sm font-bold ${site.currentAvb >= 95 ? "text-emerald-400" : "text-red-400"}`}>
                      {site.currentAvb > 0 ? `${site.currentAvb.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {selectedSite && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <SiteInfoCard site={selectedSite} />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-white font-bold text-lg">{selectedSite.siteName} — Daily Trend</h3>
            {dailyExport.length > 0 && (
              <ExportButton
                data={dailyExport}
                filename={`site_${selectedSite.siteName}_daily`}
                sheetName="Daily Data"
                label="Export Daily Data"
              />
            )}
          </div>
          <ComboChart data={chartData} title={`${selectedSite.siteName} - Daily CA & Load Shedding Trend`} />
        </motion.div>
      )}

      {!selectedSite && !search.trim() && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">
            Start typing a Site ID, Grid, Sub-Region, or Cluster Owner to search
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">Site ID</span>
            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">Grid</span>
            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">Sub-Region</span>
            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">Cluster Owner</span>
            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">Category</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================
//  RCA SUMMARY (unchanged)
// ============================================================

interface RcaRecord {
  siteId: string;
  month: string;
  rcaCategory: string;
  issue: string;
  actionPoc: string;
  status: string;
}

function RcaSummary({ rcaData }: { rcaData: SheetPayload | null }) {
  const [filterPoc, setFilterPoc] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const records: RcaRecord[] = useMemo(() => {
    if (!rcaData || !rcaData.rows) return [];
    return rcaData.rows.map((row: any) => ({
      siteId: row["Site ID"] || row["Site"] || "",
      month: row["Month"] || row["Current Month"] || row["Date"] || "",
      rcaCategory: row["RCA Category"] || row["Category"] || "",
      issue: row["Issue"] || row["Description"] || "",
      actionPoc: row["Action POC"] || row["POC"] || "",
      status: row["Status"] || "Open",
    }));
  }, [rcaData]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterPoc !== "all" && r.actionPoc !== filterPoc) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      return true;
    });
  }, [records, filterPoc, filterStatus]);

  const pocOptions = useMemo(() => {
    const set = new Set(records.map(r => r.actionPoc).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);

  const statusOptions = useMemo(() => {
    const set = new Set(records.map(r => r.status).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);

  const total = records.length;
  const openCount = records.filter(r => r.status.toLowerCase() === "open").length;
  const inProgressCount = records.filter(r => r.status.toLowerCase() === "in progress").length;
  const resolvedCount = records.filter(r => r.status.toLowerCase() === "resolved" || r.status.toLowerCase() === "closed").length;

  const pocWorkload = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach(r => {
      if (r.actionPoc) map[r.actionPoc] = (map[r.actionPoc] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const exportData = filtered.map(r => ({
    "Site ID": r.siteId,
    "Month": r.month,
    "RCA Category": r.rcaCategory,
    "Issue": r.issue,
    "Action POC": r.actionPoc,
    "Status": r.status,
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1600px] mx-auto space-y-6">
      <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">RCA of Platinum+</h2>
            <p className="text-slate-400 text-sm">Root cause analysis and action items for Platinum+ sites</p>
            <p className="text-xs text-slate-500 mt-1">{records.length} total action items</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButtonComponent
              data={exportData}
              filename="rca_platinum_plus"
              label="Export Filtered"
              format="excel"
              variant="primary"
            />
            <ExportButtonComponent
              data={exportData}
              filename="rca_platinum_plus"
              label="CSV"
              format="csv"
              variant="secondary"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <ListChecks className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{total}</div>
              <div className="text-xs text-slate-400">Total Actions</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{openCount}</div>
              <div className="text-xs text-slate-400">Open</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{inProgressCount}</div>
              <div className="text-xs text-slate-400">In Progress</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{resolvedCount}</div>
              <div className="text-xs text-slate-400">Resolved</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Filter by POC:</span>
            <select
              value={filterPoc}
              onChange={(e) => setFilterPoc(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:border-cyan-500 outline-none min-w-[150px]"
            >
              <option value="all">All POCs</option>
              {pocOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:border-cyan-500 outline-none min-w-[120px]"
            >
              <option value="all">All Status</option>
              {statusOptions.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
          {(filterPoc !== "all" || filterStatus !== "all") && (
            <button
              onClick={() => { setFilterPoc("all"); setFilterStatus("all"); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors"
            >
              <X className="w-4 h-4" /> Clear
            </button>
          )}
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Showing {filtered.length} of {records.length} actions
        </div>
      </div>

      {pocWorkload.length > 0 && (
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-white mb-3">POC Workload (Open + In Progress)</h4>
          <div className="flex flex-wrap gap-3">
            {pocWorkload.map(([name, count]) => (
              <div key={name} className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm">
                <span className="text-slate-300">{name}</span>
                <span className="ml-2 text-cyan-400 font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Action Items</h3>
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Site ID</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Month</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">RCA Category</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Issue</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Action POC</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="py-2 px-3 text-cyan-300 font-mono">{r.siteId || "-"}</td>
                    <td className="py-2 px-3 text-slate-300">{r.month || "-"}</td>
                    <td className="py-2 px-3 text-slate-300">{r.rcaCategory || "-"}</td>
                    <td className="py-2 px-3 text-slate-300">{r.issue || "-"}</td>
                    <td className="py-2 px-3 text-slate-300">{r.actionPoc || "-"}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        r.status.toLowerCase() === "open" ? "bg-red-500/20 text-red-400" :
                        r.status.toLowerCase() === "in progress" ? "bg-amber-500/20 text-amber-400" :
                        r.status.toLowerCase() === "resolved" || r.status.toLowerCase() === "closed" ? "bg-emerald-500/20 text-emerald-400" :
                        "bg-slate-500/20 text-slate-400"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No RCA records found</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}


// ============================================================
//  GRID PERFORMANCE SCORECARD
//  Platinum+ / PGS / SB from Sheet1 -> Group
//  DG from Sheet1 -> DG Status = Operational
//  Boundary grids C2006 and C2009 are intentionally excluded.
// ============================================================

type GridKpiKey = "platinum" | "pgs" | "sb" | "dg";

type GridKpiConfig = {
  key: GridKpiKey;
  label: string;
  group?: string;
  weightage: number;
  base: number;
  target: number;
  stretch: number;
  maxScore: number;
};

type LatestDayValue = {
  label: string;
  value: number;
};

type GridPerformanceSite = {
  siteId: string;
  grid: string;
  zoneLead: string;
  group: string;
  revenueCategory: string;
  dgStatus: string;
  currentMonth: number;
  clusterOwner: string;
  msGtl: string;
  latestDays: LatestDayValue[];
};

type GridKpiResult = {
  config: GridKpiConfig;
  average: number | null;
  score: number;
  sites: GridPerformanceSite[];
  validSiteCount: number;
  belowBaseCount: number;
  belowTargetCount: number;
  belowStretchCount: number;
};

type GridPerformanceRow = {
  grid: string;
  cmpakGtl: string;
  platinum: GridKpiResult;
  pgs: GridKpiResult;
  sb: GridKpiResult;
  dg: GridKpiResult;
  totalScore: number;
};

const GRID_KPI_CONFIG: GridKpiConfig[] = [
  { key: "platinum", label: "Platinum+", group: "Platinum +", weightage: 10, base: 97.75, target: 98.3, stretch: 98.7, maxScore: 12 },
  { key: "pgs", label: "PGS", group: "PGS", weightage: 10, base: 97.5, target: 98.1, stretch: 98.4, maxScore: 12 },
  { key: "sb", label: "SB", group: "SB", weightage: 5, base: 94.75, target: 95, stretch: 96.5, maxScore: 7 },
  { key: "dg", label: "DG", weightage: 10, base: 98, target: 98.5, stretch: 99.2, maxScore: 12 },
];

const EXCLUDED_GRID_PERFORMANCE = new Set(["C2006", "C2009"]);

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown): string {
  return normalizeText(value).toLowerCase().replace(/\s+/g, " ");
}

function parseGridCa(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/%/g, "").replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getRawValue(row: Record<string, any>, ...possibleHeaders: string[]): any {
  for (const header of possibleHeaders) {
    if (Object.prototype.hasOwnProperty.call(row, header)) return row[header];
  }

  const normalizedHeaders = Object.keys(row).reduce<Record<string, string>>((acc, key) => {
    acc[normalizeKey(key)] = key;
    return acc;
  }, {});

  for (const header of possibleHeaders) {
    const actual = normalizedHeaders[normalizeKey(header)];
    if (actual) return row[actual];
  }
  return "";
}

function parseSheetDateHeader(header: string): Date | null {
  const clean = header.trim();
  const match = clean.match(/^(\d{1,2})[-\s](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-\s](\d{2}|\d{4})$/i);
  if (!match) return null;
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const day = Number(match[1]);
  const month = months[match[2].toLowerCase()];
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function scoreGridKpi(value: number | null, config: GridKpiConfig): number {
  if (value === null || !Number.isFinite(value) || value < config.base) return 0;

  const halfWeightage = config.weightage / 2;

  if (value < config.target) {
    const progress = (value - config.base) / (config.target - config.base);
    return halfWeightage + halfWeightage * Math.max(0, Math.min(1, progress));
  }

  if (value < config.stretch) {
    const progress = (value - config.target) / (config.stretch - config.target);
    return config.weightage + 2 * Math.max(0, Math.min(1, progress));
  }

  return config.maxScore;
}

function averageCa(sites: GridPerformanceSite[]): number | null {
  const values = sites.map((site) => site.currentMonth).filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function GridScoreBadge({ score, max }: { score: number; max: number }) {
  const ratio = max > 0 ? score / max : 0;
  const cls =
    ratio >= 0.9
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : ratio >= 0.65
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-red-500/15 text-red-400 border-red-500/30";

  return <span className={`inline-flex min-w-[58px] justify-center rounded-md border px-2 py-1 text-xs font-bold ${cls}`}>{score.toFixed(2)}</span>;
}

function GridPerformanceScorecard({
  rawData,
  lastUpdatedDate,
}: {
  rawData?: SheetPayload | null;
  lastUpdatedDate: string;
}) {
  const [selectedGrid, setSelectedGrid] = useState<GridPerformanceRow | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<GridKpiKey | null>(null);
  const [expandedPlanGrid, setExpandedPlanGrid] = useState<string | null>(null);
  const [employeeLevel, setEmployeeLevel] = useState<"zoneLead" | "msGtl" | "clusterOwner">("zoneLead");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");

  // Use the exact same latest-3-days logic as the other monthly tabs.
  // Example: Report Updated = 25-Aug-26 => 23-Aug-26, 24-Aug-26, 25-Aug-26.
  const latestDateHeaders = useMemo(() => {
    if (!lastUpdatedDate) return [] as string[];

    const parts = lastUpdatedDate.split("-");
    if (parts.length !== 3) return [] as string[];

    const day = parseInt(parts[0], 10);
    const monthStr = parts[1];
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;

    const monthMap: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const month = monthMap[monthStr];
    if (month === undefined) return [] as string[];

    const baseDate = new Date(year, month, day);
    if (Number.isNaN(baseDate.getTime())) return [] as string[];

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatDateKey = (date: Date) =>
      `${date.getDate()}-${monthNames[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;

    const expectedHeaders: string[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      expectedHeaders.push(formatDateKey(d));
    }

    // Resolve against actual Google Sheet headers case-insensitively so the
    // displayed columns use the sheet's exact header text.
    const headerMap = new Map(
      (rawData?.headers || []).map((header: string) => [header.trim().toLowerCase(), header])
    );

    return expectedHeaders.map((header) => headerMap.get(header.toLowerCase()) || header);
  }, [rawData, lastUpdatedDate]);

  const sourceSites = useMemo<GridPerformanceSite[]>(() => {
    if (!rawData?.rows?.length) return [];

    return rawData.rows
      .map((row: Record<string, any>) => {
        const grid = normalizeText(getRawValue(row, "Grid"));
        const currentMonth = parseGridCa(getRawValue(row, "Current Month", "Current Month CA", "Monthly AVB", "Current CA%"));

        return {
          siteId: normalizeText(getRawValue(row, "Site ID", "SiteID", "Site Id")),
          grid,
          zoneLead: normalizeText(getRawValue(row, "Zone Lead", "Zong Lead", "CMPAK GTL")),
          group: normalizeText(getRawValue(row, "Group")),
          revenueCategory: normalizeText(getRawValue(row, "Revenue Category", "Category")),
          dgStatus: normalizeText(getRawValue(row, "DG Status", "DG Installed")),
          currentMonth,
          clusterOwner: normalizeText(getRawValue(row, "Cluster Owner", "CO")),
          msGtl: normalizeText(getRawValue(row, "MS GTL", "GTL")),
          latestDays: latestDateHeaders.map((header) => ({ label: header, value: parseGridCa(getRawValue(row, header)) })),
        };
      })
      .filter((site) => site.grid && !EXCLUDED_GRID_PERFORMANCE.has(site.grid.toUpperCase()));
  }, [rawData, latestDateHeaders]);

  const employeeNames = useMemo(() => {
    const names = new Set<string>();
    sourceSites.forEach((site) => {
      const value = normalizeText(site[employeeLevel]);
      if (value) names.add(value);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [sourceSites, employeeLevel]);

  useEffect(() => {
    setSelectedEmployee("all");
    setSelectedGrid(null);
    setSelectedKpi(null);
    setExpandedPlanGrid(null);
  }, [employeeLevel]);

  const filteredSourceSites = useMemo(() => {
    if (selectedEmployee === "all") return sourceSites;
    return sourceSites.filter((site) => normalizeText(site[employeeLevel]) === selectedEmployee);
  }, [sourceSites, employeeLevel, selectedEmployee]);

  const buildKpiResult = (sites: GridPerformanceSite[], config: GridKpiConfig): GridKpiResult => {
    const selectedSites = sites.filter((site) => {
      if (site.currentMonth <= 0) return false;
      if (config.key === "dg") return normalizeKey(site.dgStatus) === "operational";
      return normalizeKey(site.group) === normalizeKey(config.group || "");
    });

    const avg = averageCa(selectedSites);
    return {
      config,
      average: avg,
      score: scoreGridKpi(avg, config),
      sites: selectedSites,
      validSiteCount: selectedSites.length,
      belowBaseCount: selectedSites.filter((site) => site.currentMonth < config.base).length,
      belowTargetCount: selectedSites.filter((site) => site.currentMonth < config.target).length,
      belowStretchCount: selectedSites.filter((site) => site.currentMonth < config.stretch).length,
    };
  };

  const gridRows = useMemo<GridPerformanceRow[]>(() => {
    const gridMap = new Map<string, GridPerformanceSite[]>();

    filteredSourceSites.forEach((site) => {
      if (!gridMap.has(site.grid)) gridMap.set(site.grid, []);
      gridMap.get(site.grid)!.push(site);
    });

    return Array.from(gridMap.entries())
      .map(([grid, gridSites]) => {
        const zoneLead = gridSites.map((site) => site.zoneLead).find(Boolean) || "—";
        const results = GRID_KPI_CONFIG.reduce<Record<GridKpiKey, GridKpiResult>>((acc, config) => {
          acc[config.key] = buildKpiResult(gridSites, config);
          return acc;
        }, {} as Record<GridKpiKey, GridKpiResult>);

        return {
          grid,
          cmpakGtl: zoneLead,
          platinum: results.platinum,
          pgs: results.pgs,
          sb: results.sb,
          dg: results.dg,
          totalScore: results.platinum.score + results.pgs.score + results.sb.score + results.dg.score,
        };
      })
      .sort((a, b) => a.totalScore - b.totalScore || a.grid.localeCompare(b.grid));
  }, [filteredSourceSites]);

  const subRegionCards = useMemo(() => {
    return [
      { key: "C-1", prefix: "C1" },
      { key: "C-6", prefix: "C6" },
    ].map(({ key, prefix }) => {
      const sites = filteredSourceSites.filter((site) => site.grid.toUpperCase().startsWith(prefix));
      const results = GRID_KPI_CONFIG.reduce<Record<GridKpiKey, GridKpiResult>>((acc, config) => {
        acc[config.key] = buildKpiResult(sites, config);
        return acc;
      }, {} as Record<GridKpiKey, GridKpiResult>);
      return {
        key,
        ...results,
        totalScore: results.platinum.score + results.pgs.score + results.sb.score + results.dg.score,
      };
    });
  }, [filteredSourceSites]);

  const exportGroups = useMemo(() => {
    const makeRows = (config: GridKpiConfig, threshold: "base" | "target" | "stretch") => {
      const limit = config[threshold];
      return filteredSourceSites
        .filter((site) => {
          if (site.currentMonth <= 0) return false;
          const inCategory = config.key === "dg"
            ? normalizeKey(site.dgStatus) === "operational"
            : normalizeKey(site.group) === normalizeKey(config.group || "");
          return inCategory && site.currentMonth < limit;
        })
        .sort((a, b) => a.currentMonth - b.currentMonth)
        .map((site) => {
          const row: Record<string, any> = {
            "Site ID": site.siteId,
            Grid: site.grid,
            "CMPAK GTL": site.zoneLead || "-",
            Category: config.label,
            "Current Month": site.currentMonth.toFixed(2),
            [`${threshold[0].toUpperCase()}${threshold.slice(1)} Threshold`]: limit.toFixed(2),
            Gap: Math.max(0, limit - site.currentMonth).toFixed(2),
            Group: site.group || "-",
            "DG Status": site.dgStatus || "-",
            "Cluster Owner": site.clusterOwner || "-",
            "MS GTL": site.msGtl || "-",
          };
          site.latestDays.forEach((d) => { row[d.label] = d.value > 0 ? d.value.toFixed(2) : "-"; });
          return row;
        });
    };

    return GRID_KPI_CONFIG.map((config) => ({
      config,
      base: makeRows(config, "base"),
      target: makeRows(config, "target"),
      stretch: makeRows(config, "stretch"),
    }));
  }, [filteredSourceSites]);

  const selectedResult = selectedGrid && selectedKpi ? selectedGrid[selectedKpi] : null;

  const bestGrid = useMemo(() => {
    if (!gridRows.length) return null;
    return gridRows.reduce((best, row) => (row.totalScore > best.totalScore ? row : best), gridRows[0]);
  }, [gridRows]);

  const lowestGrid = gridRows.length ? gridRows[0] : null;

  const avgScore = useMemo(() => {
    if (!gridRows.length) return 0;
    return gridRows.reduce((sum, row) => sum + row.totalScore, 0) / gridRows.length;
  }, [gridRows]);

  const totalBelowStretch = useMemo(
    () => exportGroups.reduce((sum, group) => sum + group.stretch.length, 0),
    [exportGroups]
  );

  const openSites = (row: GridPerformanceRow, key: GridKpiKey) => {
    setSelectedGrid(row);
    setSelectedKpi(key);
  };

  const kpiCell = (row: GridPerformanceRow, result: GridKpiResult) => {
    const achievedStretch = result.average !== null && result.average >= result.config.stretch;
    return (
      <div className="flex items-center justify-center gap-2 whitespace-nowrap">
        <span className={`font-semibold ${result.average === null ? "text-slate-600" : achievedStretch ? "text-emerald-400" : "text-slate-200"}`}>
          {result.average === null ? "—" : result.average.toFixed(2)}
        </span>
        <button
          onClick={() => openSites(row, result.config.key)}
          disabled={result.sites.length === 0}
          className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] font-medium text-cyan-400 transition-colors hover:border-cyan-500 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          View {result.sites.length}
        </button>
      </div>
    );
  };

  const improvementItems = (row: GridPerformanceRow) =>
    ([row.platinum, row.pgs, row.sb, row.dg] as GridKpiResult[])
      .filter((result) => result.average === null || result.average < result.config.stretch)
      .map((result) => {
        const avgGap = result.average === null ? null : Math.max(0, result.config.stretch - result.average);
        const prioritySites = [...result.sites].filter((site) => site.currentMonth < result.config.stretch).sort((a, b) => a.currentMonth - b.currentMonth);
        return { result, avgGap, prioritySites };
      });

  if (!rawData?.rows?.length) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white">Grid Performance</h3>
        <p className="mt-2 text-sm text-slate-400">Grid Performance requires the Sheet1 raw data so Group and DG Status can be evaluated.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-transparent p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Grid Performance</h2>
            <p className="mt-1 text-sm text-slate-400">
              Monthly CA scorecard for Platinum+, PGS, SB and Operational DG sites. C2006 and C2009 are excluded as boundary grids.
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Maximum Score</div>
            <div className="text-xl font-bold text-cyan-400">43.00</div>
          </div>
        </div>
      </div>

      {/* Employee filter - same pattern as Employee Performance tab */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-slate-400">Employee Level:</span>
            {[
              { key: "zoneLead" as const, label: "Zone Lead" },
              { key: "msGtl" as const, label: "MS GTL" },
              { key: "clusterOwner" as const, label: "Cluster Owner" },
            ].map((level) => (
              <button
                key={level.key}
                onClick={() => setEmployeeLevel(level.key)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  employeeLevel === level.key
                    ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-400"
                    : "border-slate-600 bg-slate-900/50 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                {level.label}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-3 lg:max-w-xl">
            <Users className="h-4 w-4 shrink-0 text-slate-500" />
            <select
              value={selectedEmployee}
              onChange={(event) => {
                setSelectedEmployee(event.target.value);
                setSelectedGrid(null);
                setSelectedKpi(null);
                setExpandedPlanGrid(null);
              }}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none transition-colors focus:border-cyan-500"
            >
              <option value="all">All Employees ({employeeNames.length})</option>
              {employeeNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {selectedEmployee !== "all" && (
              <button
                onClick={() => setSelectedEmployee("all")}
                className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 pt-3 text-xs text-slate-400">
          <span>
            Showing <span className="font-semibold text-white">{filteredSourceSites.length}</span> sites
            {selectedEmployee !== "all" && (
              <> for <span className="font-semibold text-cyan-400">{selectedEmployee}</span></>
            )}
          </span>
          <span>Grid scores, C-1/C-6 cards, exception exports and View Sites all follow this filter.</span>
        </div>
      </div>

      {/* C-1 / C-6 overall score cards */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {subRegionCards.map((region) => (
          <div key={region.key} className="rounded-xl border border-slate-700 bg-slate-800 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Sub-Region Overall</div>
                <h3 className="text-xl font-bold text-white">{region.key} Grid KPI Score</h3>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-cyan-400">{region.totalScore.toFixed(2)}</div>
                <div className="text-xs text-slate-500">out of 43</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {([region.platinum, region.pgs, region.sb, region.dg] as GridKpiResult[]).map((result) => (
                <div key={result.config.key} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                  <div className="text-xs font-medium text-slate-400">{result.config.label}</div>
                  <div className="mt-1 text-lg font-bold text-white">{result.average === null ? "—" : `${result.average.toFixed(2)}%`}</div>
                  <div className="mt-1 text-xs text-cyan-400">Score {result.score.toFixed(2)} / {result.config.maxScore}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Category-wise exports irrespective of Grid */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Category-wise Performance Exceptions</h3>
          <p className="mt-1 text-xs text-slate-400">Export sites not achieving Base, Target or Stretch irrespective of Grid.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          {exportGroups.map(({ config, base, target, stretch }) => (
            <div key={config.key} className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-white">{config.label}</span>
                <span className="text-[10px] text-slate-500">Valid CA only</span>
              </div>
              <div className="space-y-2">
                <ExportButtonComponent data={base} filename={`${config.key}_below_base`} label={`Below Base (${base.length})`} format="excel" variant="danger" />
                <ExportButtonComponent data={target} filename={`${config.key}_below_target`} label={`Below Target (${target.length})`} format="excel" variant="secondary" />
                <ExportButtonComponent data={stretch} filename={`${config.key}_below_stretch`} label={`Below Stretch (${stretch.length})`} format="excel" variant="primary" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-[10px] uppercase text-slate-500">Worst Grid</div>
          <div className="mt-1 text-xl font-bold text-red-400">{lowestGrid?.grid || "—"}</div>
          <div className="text-xs text-slate-400">{lowestGrid ? `${lowestGrid.totalScore.toFixed(2)} / 43` : "No data"}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-[10px] uppercase text-slate-500">Best Grid</div>
          <div className="mt-1 text-xl font-bold text-emerald-400">{bestGrid?.grid || "—"}</div>
          <div className="text-xs text-slate-400">{bestGrid ? `${bestGrid.totalScore.toFixed(2)} / 43` : "No data"}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-[10px] uppercase text-slate-500">Average Grid Score</div>
          <div className="mt-1 text-xl font-bold text-cyan-400">{avgScore.toFixed(2)}</div>
          <div className="text-xs text-slate-400">Across {gridRows.length} grids</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <div className="text-[10px] uppercase text-slate-500">Sites Below Stretch</div>
          <div className="mt-1 text-xl font-bold text-amber-400">{totalBelowStretch}</div>
          <div className="text-xs text-slate-400">All four categories</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Grid Performance Scorecard</h3>
          <p className="text-xs text-slate-400">Worst performing Grid shown first · Score is based on monthly Grid average.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/40">
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">Grid</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">CMPAK GTL</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500">Platinum+</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500">Plat+ Score</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500">PGS</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500">PGS Score</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500">SB</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500">SB Score</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500">DG</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500">DG Score</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500">Total Score</th>
              </tr>
            </thead>
            <tbody>
              {gridRows.map((row) => (
                <tr key={row.grid} className="border-b border-slate-700/60 hover:bg-slate-700/20">
                  <td className="px-3 py-3 font-bold text-cyan-300">{row.grid}</td>
                  <td className="px-3 py-3 text-slate-300">{row.cmpakGtl}</td>
                  <td className="px-3 py-3 text-center">{kpiCell(row, row.platinum)}</td>
                  <td className="px-3 py-3 text-center"><GridScoreBadge score={row.platinum.score} max={12} /></td>
                  <td className="px-3 py-3 text-center">{kpiCell(row, row.pgs)}</td>
                  <td className="px-3 py-3 text-center"><GridScoreBadge score={row.pgs.score} max={12} /></td>
                  <td className="px-3 py-3 text-center">{kpiCell(row, row.sb)}</td>
                  <td className="px-3 py-3 text-center"><GridScoreBadge score={row.sb.score} max={7} /></td>
                  <td className="px-3 py-3 text-center">{kpiCell(row, row.dg)}</td>
                  <td className="px-3 py-3 text-center"><GridScoreBadge score={row.dg.score} max={12} /></td>
                  <td className="px-3 py-3 text-center"><GridScoreBadge score={row.totalScore} max={43} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h3 className="text-lg font-semibold text-white">Stretch Achievement Improvement Plan</h3>
        <p className="mt-1 text-xs text-slate-400">Focuses on categories where the Grid average has not yet achieved Stretch.</p>
        <div className="mt-4 space-y-3">
          {gridRows.map((row) => {
            const items = improvementItems(row);
            const open = expandedPlanGrid === row.grid;
            return (
              <div key={`plan-${row.grid}`} className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/40">
                <button onClick={() => setExpandedPlanGrid(open ? null : row.grid)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-800/60">
                  <div>
                    <span className="font-bold text-cyan-300">{row.grid}</span>
                    <span className="ml-3 text-xs text-slate-400">{items.length === 0 ? "All categories at Stretch" : `${items.length} categories require improvement`}</span>
                  </div>
                  {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {open && (
                  <div className="space-y-3 border-t border-slate-700 p-4">
                    {items.length === 0 ? (
                      <div className="text-sm text-emerald-400">All four categories have achieved Stretch.</div>
                    ) : items.map(({ result, avgGap, prioritySites }) => (
                      <div key={`${row.grid}-${result.config.key}`} className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{result.config.label}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              Grid Avg: <span className="font-semibold text-slate-200">{result.average === null ? "No valid CA" : `${result.average.toFixed(2)}%`}</span>
                              {result.average !== null && <> · Stretch: <span className="font-semibold text-emerald-400">{result.config.stretch.toFixed(2)}%</span> · Gap: <span className="font-semibold text-red-400">{avgGap?.toFixed(2)}%</span></>}
                            </div>
                          </div>
                          <button
                            onClick={() => openSites(row, result.config.key)}
                            disabled={result.sites.length === 0}
                            className="rounded-md bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-30"
                          >
                            View {result.sites.length} Sites
                          </button>
                        </div>

                        {result.sites.length === 0 ? (
                          <p className="mt-3 text-xs text-amber-400">No valid Monthly CA records are available for this KPI.</p>
                        ) : prioritySites.length === 0 ? (
                          <p className="mt-3 text-xs text-slate-400">Individual sites are at Stretch, but verify source data if the calculated Grid average is still below target.</p>
                        ) : (
                          <div className="mt-3 text-xs text-slate-300">
                            Priority: improve the lowest CA sites first. {prioritySites.length} site{prioritySites.length > 1 ? "s are" : " is"} below Stretch.
                            <span className="ml-1 text-red-400">
                              Worst: {prioritySites.slice(0, 5).map((site) => `${site.siteId} (${site.currentMonth.toFixed(2)}%)`).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedGrid && selectedResult && selectedKpi && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => {
              setSelectedGrid(null);
              setSelectedKpi(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 15 }}
              onClick={(event) => event.stopPropagation()}
              className="flex max-h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-4 border-b border-slate-700 p-5">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedGrid.grid} · {selectedResult.config.label} Sites</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Grid Avg {selectedResult.average === null ? "—" : `${selectedResult.average.toFixed(2)}%`} · Stretch {selectedResult.config.stretch.toFixed(2)}% · {selectedResult.sites.length} valid sites
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ExportButtonComponent
                    data={[...selectedResult.sites]
                      .sort((a, b) => a.currentMonth - b.currentMonth)
                      .map((site) => {
                        const gap = Math.max(0, selectedResult.config.stretch - site.currentMonth);
                        const status = site.currentMonth >= selectedResult.config.stretch
                          ? "Stretch Achieved"
                          : site.currentMonth >= selectedResult.config.target
                            ? "Target to Stretch"
                            : site.currentMonth >= selectedResult.config.base
                              ? "Base to Target"
                              : "Below Base";
                        const exportRow: Record<string, any> = {
                          "Site ID": site.siteId,
                          Grid: selectedGrid.grid,
                          "CMPAK GTL": selectedGrid.cmpakGtl,
                          Category: selectedResult.config.label,
                          "Current Month": site.currentMonth.toFixed(2),
                        };
                        site.latestDays.forEach((day) => {
                          exportRow[day.label] = day.value > 0 ? day.value.toFixed(2) : "";
                        });
                        exportRow["Gap to Stretch"] = gap.toFixed(2);
                        exportRow.Status = status;
                        exportRow.Group = site.group || "";
                        exportRow["Revenue Category"] = site.revenueCategory || "";
                        exportRow["DG Status"] = site.dgStatus || "";
                        exportRow["Cluster Owner"] = site.clusterOwner || "";
                        exportRow["MS GTL"] = site.msGtl || "";
                        return exportRow;
                      })}
                    filename={`${selectedGrid.grid}_${selectedResult.config.key}_all_sites`}
                    label={`Export All ${selectedResult.sites.length} Sites`}
                    format="excel"
                    variant="primary"
                  />
                  <button onClick={() => { setSelectedGrid(null); setSelectedKpi(null); }} className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="overflow-auto p-5">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left">
                      <th className="px-3 py-2 text-xs text-slate-500">Site ID</th>
                      <th className="px-3 py-2 text-xs text-slate-500">Current Month</th>
                      {latestDateHeaders.map((header) => <th key={header} className="px-3 py-2 text-center text-xs text-slate-500">{header}</th>)}
                      <th className="px-3 py-2 text-xs text-slate-500">Gap to Stretch</th>
                      <th className="px-3 py-2 text-xs text-slate-500">Status</th>
                      <th className="px-3 py-2 text-xs text-slate-500">Group</th>
                      <th className="px-3 py-2 text-xs text-slate-500">Revenue Category</th>
                      <th className="px-3 py-2 text-xs text-slate-500">DG Status</th>
                      <th className="px-3 py-2 text-xs text-slate-500">Cluster Owner</th>
                      <th className="px-3 py-2 text-xs text-slate-500">MS GTL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...selectedResult.sites]
                      .sort((a, b) => a.currentMonth - b.currentMonth)
                      .map((site) => {
                        const gap = Math.max(0, selectedResult.config.stretch - site.currentMonth);
                        const status = site.currentMonth >= selectedResult.config.stretch ? "Stretch Achieved" : site.currentMonth >= selectedResult.config.target ? "Target to Stretch" : site.currentMonth >= selectedResult.config.base ? "Base to Target" : "Below Base";
                        return (
                          <tr key={`${selectedKpi}-${site.siteId}`} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="px-3 py-2 font-mono font-semibold text-cyan-300">{site.siteId || "—"}</td>
                            <td className={`px-3 py-2 font-semibold ${site.currentMonth >= selectedResult.config.stretch ? "text-emerald-400" : "text-slate-200"}`}>{site.currentMonth.toFixed(2)}%</td>
                            {site.latestDays.map((day) => (
                              <td key={`${site.siteId}-${day.label}`} className={`px-3 py-2 text-center font-medium ${day.value > 0 && day.value < selectedResult.config.base ? "text-red-400" : day.value > 0 ? "text-slate-200" : "text-slate-600"}`}>
                                {day.value > 0 ? `${day.value.toFixed(2)}%` : "—"}
                              </td>
                            ))}
                            <td className={`px-3 py-2 ${gap > 0 ? "text-red-400" : "text-emerald-400"}`}>{gap.toFixed(2)}%</td>
                            <td className="px-3 py-2">
                              <span className={`rounded px-2 py-1 text-[10px] font-semibold ${status === "Stretch Achieved" ? "bg-emerald-500/15 text-emerald-400" : status === "Target to Stretch" ? "bg-cyan-500/15 text-cyan-400" : status === "Base to Target" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>{status}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-300">{site.group || "—"}</td>
                            <td className="px-3 py-2 text-slate-300">{site.revenueCategory || "—"}</td>
                            <td className="px-3 py-2 text-slate-300">{site.dgStatus || "—"}</td>
                            <td className="px-3 py-2 text-slate-300">{site.clusterOwner || "—"}</td>
                            <td className="px-3 py-2 text-slate-300">{site.msGtl || "—"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
//  OVERALL SUMMARY WITH EXPORT (unchanged)
// ============================================================

function OverallSummaryWithExport({ sites, rawData }: { sites: SiteData[]; rawData?: SheetPayload | null }) {
  const fullExportData = useMemo(() => {
    if (rawData && rawData.rows && rawData.rows.length > 0) {
      return rawData.rows.map((row: any) => {
        const exportRow: Record<string, any> = {};
        rawData.headers.forEach((header: string) => {
          exportRow[header] = row[header] ?? "";
        });
        return exportRow;
      });
    }
    return sites.map((site) => ({
      "Site ID": site.siteName,
      "Revenue Category": site.revenueCategory,
      "Sub-Region": site.subRegion,
      "Current CA%": site.currentAvb?.toFixed(2) || "-",
      "Monthly AVB": site.monthlyAvb?.toFixed(2) || "-",
      Grid: site.grid || "-",
      Terrain: site.terrain || "-",
      Technology: site.technology || "-",
      "Sharing Status": site.sharingStatus || "-",
      "Indoor/Outdoor": site.indoorOutdoor || "-",
      "DG Status": site.dgInstalled || "-",
      "DG Rating": site.dgRating || "-",
      "Li-ion Installed": site.liIonInstalled || "-",
      "Li-ion Capacity": site.liIonCapacity || "-",
      "AGM/LION": site.agmBb || "-",
      "BB Status": site.bbStatus || "-",
      "Below Base": site.belowBase || "-",
      "HUB/Single": site.hubSingle || "-",
      "Dependent Sites": site.dependentSites || "-",
      "Cluster Owner": site.clusterOwner || "-",
      "MS GTL": site.msGtl || "-",
      "Zone Lead": site.zongLead || "-",
      Chronic: site.chronic || "-",
      "DG Chronic": site.dgChronic || "-",
      "Li-ion Chronic": site.liIonChronic || "-",
      Target: site.target ? `${site.target}%` : "-",
      City: site.city || "-",
      "2G CA": site.ca2G?.toFixed(2) || "-",
      "3G CA": site.ca3G?.toFixed(2) || "-",
      "4G CA": site.ca4G?.toFixed(2) || "-",
    }));
  }, [sites, rawData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="text-white font-semibold">Export All Google Sheet Data</h3>
            <p className="text-xs text-slate-400">{fullExportData.length} rows · All columns</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButtonComponent data={fullExportData} filename="all_sites_full_data" label="Export Excel" format="excel" variant="primary" />
          <ExportButtonComponent data={fullExportData} filename="all_sites_full_data" label="CSV" format="csv" variant="secondary" />
        </div>
      </div>
      {/* Keep every existing Overall Summary component. Remove only its old AI section inside components/OverallSummary.tsx. */}
      <OverallSummaryComponent sites={sites} />

    </div>
  );
}

// ============================================================
//  LOADING / ERROR / BANNER
// ============================================================

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-cyan-400"
      />
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">Loading Dashboard</h2>
        <p className="text-slate-400 text-sm mt-1">Preparing your data…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6 px-6">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold text-white">Couldn't load the sheet</h2>
        <p className="text-slate-400 text-sm mt-2 break-words">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition-colors"
      >
        <RefreshCw className="w-4 h-4" /> Try again
      </button>
    </div>
  );
}

function SectionBanner({ icon, title, subtitle, gradient }: { icon: React.ReactNode; title: string; subtitle: string; gradient: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-r ${gradient} border p-5`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h3 className="text-white font-bold text-lg">{title}</h3>
          <p className="text-slate-300 text-sm">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Pre‑Vs‑Post Analysis Component (receives parsed sites)
// ============================================================

function PreVsPostAnalysis({
  sites,
  lastUpdatedDate,
}: {
  sites: SiteData[];
  lastUpdatedDate: string;
}) {
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<"zongLead" | "msGtl" | "clusterOwner">("zongLead");
  const [expandedStillGrids, setExpandedStillGrids] = useState<Set<string>>(new Set());
  const [expandedNewGrids, setExpandedNewGrids] = useState<Set<string>>(new Set());

  const employeeNames = useMemo(() => {
    const names = new Set<string>();
    sites.forEach((site) => {
      const name = (site[selectedLevel] || "Unassigned").trim();
      if (name !== "Unassigned") {
        names.add(name);
      }
    });
    return Array.from(names).sort();
  }, [sites, selectedLevel]);

  const employeeFilteredSites = useMemo(() => {
    if (selectedEmployee === "all") {
      return sites;
    }
    return sites.filter((site) => {
      const name = (site[selectedLevel] || "Unassigned").trim();
      return name === selectedEmployee;
    });
  }, [sites, selectedEmployee, selectedLevel]);

  const formatDateKey = (date: Date): string => {
    const day = String(date.getDate());
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const getDaySuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    const r = day % 10;
    if (r === 1) return "st";
    if (r === 2) return "nd";
    if (r === 3) return "rd";
    return "th";
  };

  const lastThreeDays = useMemo(() => {
    if (!lastUpdatedDate) return [];
    const parts = lastUpdatedDate.split("-");
    if (parts.length !== 3) return [];
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1];
    const year = parseInt(parts[2], 10) + 2000;
    const monthMap: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const month = monthMap[monthStr];
    if (month === undefined) return [];
    const baseDate = new Date(year, month, day);
    if (isNaN(baseDate.getTime())) return [];

    const dates: Date[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      dates.push(d);
    }

    return dates.map((d) => {
      const dateKey = formatDateKey(d);
      const label = `${d.getDate()}${getDaySuffix(d.getDate())} ${d.toLocaleString("default", { month: "long" })}`;
      return { dateKey, label };
    });
  }, [lastUpdatedDate]);

  const worstSites = useMemo(() => {
    const sorted = [...employeeFilteredSites].sort((a, b) => a.currentAvb - b.currentAvb);
    const top10 = sorted.slice(0, 10);
    return top10.map((site) => {
      const data = site.dailyData || {};
      const values = lastThreeDays.map(({ dateKey }) => data[dateKey] || 0);
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.filter((v) => v > 0).length;
      const avg = count > 0 ? sum / count : 0;
      return { site, values, avg };
    });
  }, [employeeFilteredSites, lastThreeDays]);

  const kpis = useMemo(() => {
    const total = employeeFilteredSites.length;
    const categoryCounts: Record<string, number> = {};
    employeeFilteredSites.forEach((s) => {
      const cat = s.category || "Unknown";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const sitesWithPrev = employeeFilteredSites.filter(s => s.previousMonth !== undefined && s.previousMonth > 0);
    const avgPrevMonth = sitesWithPrev.length > 0
      ? sitesWithPrev.reduce((sum, s) => sum + (s.previousMonth || 0), 0) / sitesWithPrev.length
      : 0;
    const avgCurrent = employeeFilteredSites.length > 0
      ? employeeFilteredSites.reduce((sum, s) => sum + s.currentAvb, 0) / employeeFilteredSites.length
      : 0;
    const unstablePrev = employeeFilteredSites.filter((s) => s.oldCase === "Unstable").length;
    const fixedNow = employeeFilteredSites.filter((s) => s.now === "Stable").length;
    const stillUnstable = employeeFilteredSites.filter((s) => s.now === "Still Unstable").length;
    const newUnstable = employeeFilteredSites.filter((s) => s.newCase === "New case").length;
    return { total, categoryCounts, avgPrevMonth, avgCurrent, unstablePrev, fixedNow, stillUnstable, newUnstable };
  }, [employeeFilteredSites]);

  const stillUnstableSites = useMemo(() => employeeFilteredSites.filter((s) => s.now === "Still Unstable"), [employeeFilteredSites]);
  const stillUnstableGridBreakdown = useMemo(() => {
    const map = new Map<string, SiteData[]>();
    stillUnstableSites.forEach((site) => {
      const grid = site.grid || "Unknown";
      if (!map.has(grid)) map.set(grid, []);
      map.get(grid)!.push(site);
    });
    return Array.from(map.entries()).map(([grid, sites]) => ({ grid, count: sites.length, sites })).sort((a, b) => b.count - a.count);
  }, [stillUnstableSites]);

  const newCaseSites = useMemo(() => employeeFilteredSites.filter((s) => s.newCase === "New case"), [employeeFilteredSites]);
  const newCaseGridBreakdown = useMemo(() => {
    const map = new Map<string, SiteData[]>();
    newCaseSites.forEach((site) => {
      const grid = site.grid || "Unknown";
      if (!map.has(grid)) map.set(grid, []);
      map.get(grid)!.push(site);
    });
    return Array.from(map.entries()).map(([grid, sites]) => ({ grid, count: sites.length, sites })).sort((a, b) => b.count - a.count);
  }, [newCaseSites]);

  const toggleStillGrid = (grid: string) => {
    setExpandedStillGrids((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(grid)) newSet.delete(grid);
      else newSet.add(grid);
      return newSet;
    });
  };

  const toggleNewGrid = (grid: string) => {
    setExpandedNewGrids((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(grid)) newSet.delete(grid);
      else newSet.add(grid);
      return newSet;
    });
  };

  const nowBadge = (value: string | undefined) => {
    const v = value || "";
    if (v === "Stable") return <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs">Stable</span>;
    if (v === "Still Unstable") return <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs">Still Unstable</span>;
    return <span className="bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded text-xs">{v || "-"}</span>;
  };

  const newCaseBadge = (value: string | undefined) => {
    const v = value || "";
    if (v === "New case") return <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs">New case</span>;
    return <span className="bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded text-xs">{v || "-"}</span>;
  };

  const worstExportData = useMemo(() => {
    return worstSites.map(({ site, values, avg }, i) => ({
      Rank: i + 1,
      "Site ID": site.siteName,
      Category: site.category || "Unknown",
      "Sub-Region": site.subRegion,
      Grid: site.grid,
      "Cluster Owner": site.clusterOwner || "-",
      "MS GTL": site.msGtl || "-",
      "Zone Lead": site.zongLead || "-",
      "Prev Month CA": site.previousMonth?.toFixed(2) || "-",
      "Old Case": site.oldCase || "-",
      Now: site.now || "-",
      "New Case": site.newCase || "-",
      ...Object.fromEntries(lastThreeDays.map(({ label }, idx) => [label, values[idx]?.toFixed(2) || "-"])),
      "Last 3 Days Avg": avg.toFixed(2) + "%",
      "Current CA%": site.currentAvb?.toFixed(2) || "-",
    }));
  }, [worstSites, lastThreeDays]);

  const allExportData = useMemo(() => {
    return employeeFilteredSites.map((site) => ({
      "Site ID": site.siteName,
      Category: site.category || "Unknown",
      "Sub-Region": site.subRegion,
      Grid: site.grid,
      "Cluster Owner": site.clusterOwner || "-",
      "MS GTL": site.msGtl || "-",
      "Zone Lead": site.zongLead || "-",
      "Prev Month CA": site.previousMonth?.toFixed(2) || "-",
      "Old Case": site.oldCase || "-",
      Now: site.now || "-",
      "New Case": site.newCase || "-",
      "Current CA%": site.currentAvb?.toFixed(2) || "-",
    }));
  }, [employeeFilteredSites]);

  const stillUnstableExport = useMemo(() => {
    return stillUnstableSites
      .slice()
      .sort((a, b) => a.currentAvb - b.currentAvb)
      .map((site) => {
        const row: Record<string, any> = {
          "Site ID": site.siteName,
          Grid: site.grid || "Unknown",
          "Sub-Region": site.subRegion,
          "Cluster Owner": site.clusterOwner || "-",
          "MS GTL": site.msGtl || "-",
          "Zone Lead": site.zongLead || "-",
          "Current CA%": site.currentAvb?.toFixed(2) || "-",
        };

        lastThreeDays.forEach(({ label, dateKey }) => {
          const value = site.dailyData?.[dateKey] || 0;
          row[label] = value > 0 ? value.toFixed(2) : "-";
        });

        row["Prev Month"] = site.previousMonth?.toFixed(2) || "-";
        row["Old Case"] = site.oldCase || "-";
        row["Now"] = site.now || "-";
        return row;
      });
  }, [stillUnstableSites, lastThreeDays]);

  const newCaseExport = useMemo(() => {
    return newCaseSites.map((site) => ({
      "Site ID": site.siteName,
      Grid: site.grid || "Unknown",
      "Sub-Region": site.subRegion,
      "Cluster Owner": site.clusterOwner || "-",
      "MS GTL": site.msGtl || "-",
      "Zone Lead": site.zongLead || "-",
      "Current CA%": site.currentAvb?.toFixed(2) || "-",
      "Prev Month": site.previousMonth?.toFixed(2) || "-",
      "Old Case": site.oldCase || "-",
    }));
  }, [newCaseSites]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Plat+ and DG Sites Pre Vs Post Analysis</h2>
            <p className="text-slate-400 text-sm">{employeeFilteredSites.length} sites in total</p>
            <p className="text-xs text-slate-500 mt-1">Comparing July (Pre) vs August (Post) performance</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButtonComponent data={allExportData} filename="pre_vs_post_all_sites" label="Export All" format="excel" variant="primary" />
            <ExportButtonComponent data={worstExportData} filename="pre_vs_post_worst_10" label="Export Worst 10" format="excel" variant="danger" />
            <ExportButtonComponent data={stillUnstableExport} filename="pre_vs_post_still_unstable" label="Export Still Unstable" format="excel" variant="secondary" />
            <ExportButtonComponent data={newCaseExport} filename="pre_vs_post_new_case" label="Export New Case" format="excel" variant="secondary" />
          </div>
        </div>
      </div>

      {/* Employee Filter */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 font-medium">Filter by Employee:</span>
            </div>
            <div className="flex gap-1 bg-slate-900 rounded-lg p-1 border border-slate-700">
              {[
                { id: "zongLead" as const, label: "Zone Lead" },
                { id: "msGtl" as const, label: "MS GTL" },
                { id: "clusterOwner" as const, label: "Cluster Owner" },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setSelectedLevel(lvl.id)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${selectedLevel === lvl.id ? "bg-purple-500/20 text-purple-400" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:border-purple-500 outline-none min-w-[180px]"
            >
              <option value="all">All Employees ({employeeNames.length})</option>
              {employeeNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {selectedEmployee !== "all" && (
              <button onClick={() => setSelectedEmployee("all")} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div className="text-xs text-slate-500">
            Showing {employeeFilteredSites.length} sites
            {selectedEmployee !== "all" && <span className="text-purple-400 ml-1">· Filtered: {selectedEmployee}</span>}
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(kpis.categoryCounts).map(([cat, count]) => (
          <div key={cat} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{cat}</span>
              <span className="text-2xl font-bold text-white">{count}</span>
            </div>
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        <KpiCard label="Total Sites" value={kpis.total} icon={<MapPin className="w-5 h-5 text-blue-400" />} color="blue" />
        <KpiCard label="Avg Pre Month CA" value={kpis.avgPrevMonth > 0 ? `${kpis.avgPrevMonth.toFixed(2)}%` : "—"} icon={<TrendingDown className="w-5 h-5 text-amber-400" />} color="amber" />
        <KpiCard label="Avg Current CA" value={kpis.avgCurrent > 0 ? `${kpis.avgCurrent.toFixed(2)}%` : "—"} icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} color="emerald" />
        <KpiCard label="Unstable Pre Month" value={kpis.unstablePrev} icon={<AlertTriangle className="w-5 h-5 text-red-400" />} color="red" />
        <KpiCard label="Fixed (Now Stable)" value={kpis.fixedNow} icon={<CheckCircle2 className="w-5 h-5 text-green-400" />} color="green" />
        <KpiCard label="Still Unstable" value={kpis.stillUnstable} icon={<AlertCircle className="w-5 h-5 text-orange-400" />} color="orange" />
        <KpiCard label="New Unstable" value={kpis.newUnstable} icon={<AlertCircle className="w-5 h-5 text-red-400" />} color="red" />
      </div>

      {/* Worst 10 */}
      <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h4 className="text-lg font-semibold text-white">Worst 10 Sites by Current CA%</h4>
            <span className="text-xs text-slate-500">({selectedEmployee === "all" ? "All Employees" : selectedEmployee})</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Sorted by CA% (Lowest to Highest)</span>
            {worstSites.length > 0 && <ExportButtonComponent data={worstExportData} filename="pre_vs_post_worst_10" label="Export" format="excel" variant="danger" />}
          </div>
        </div>
        {worstSites.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-500/30">
                  <th className="text-center py-2 px-2 text-slate-400 font-medium">#</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Site ID</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Category</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Sub-Region</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Grid</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Cluster Owner</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">MS GTL</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">Zone Lead</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">Prev Month</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">Old Case</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">Now</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">New Case</th>
                  {lastThreeDays.map(({ label }, idx) => <th key={idx} className="text-center py-2 px-3 text-slate-400 font-medium">{label}</th>)}
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">Last 3 Days Avg</th>
                  <th className="text-center py-2 px-3 text-slate-400 font-medium">Current CA%</th>
                </tr>
              </thead>
              <tbody>
                {worstSites.map(({ site, values, avg }, i) => (
                  <tr key={site.siteName} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                    <td className="py-2 px-2 text-center text-slate-500">{i + 1}</td>
                    <td className="py-2 px-3 text-cyan-300 font-mono">{site.siteName}</td>
                    <td className="py-2 px-3"><CategoryBadge category={site.category || "Unknown"} /></td>
                    <td className="py-2 px-3 text-slate-400">{site.subRegion}</td>
                    <td className="py-2 px-3 text-slate-300">{site.grid}</td>
                    <td className="py-2 px-3 text-slate-300">{site.clusterOwner || "-"}</td>
                    <td className="py-2 px-3 text-slate-300">{site.msGtl || "-"}</td>
                    <td className="py-2 px-3 text-slate-300">{site.zongLead || "-"}</td>
                    <td className="py-2 px-3 text-center text-slate-300">{site.previousMonth?.toFixed(2) || "-"}</td>
                    <td className="py-2 px-3 text-center"><span className={`text-xs px-2 py-0.5 rounded ${site.oldCase === "Stable" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{site.oldCase || "-"}</span></td>
                    <td className="py-2 px-3 text-center">{nowBadge(site.now)}</td>
                    <td className="py-2 px-3 text-center">{newCaseBadge(site.newCase)}</td>
                    {values.map((val, idx) => <td key={idx} className="py-2 px-3 text-center text-slate-300">{val?.toFixed(2) || "-"}</td>)}
                    <td className={`py-2 px-3 text-center font-bold ${avg < 98 ? "text-red-400" : "text-amber-400"}`}>{avg.toFixed(2)}%</td>
                    <td className="py-2 px-3 text-center text-slate-300">{site.currentAvb.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">No sites available for the selected filter.</div>
        )}
      </div>

      {/* Still Unstable by Grid */}
      <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <h4 className="text-lg font-semibold text-white">Still Unstable Sites by Grid</h4>
            <span className="text-xs text-slate-500">({stillUnstableSites.length} sites · {stillUnstableGridBreakdown.length} grids · Worst CA shown first)</span>
          </div>
          {stillUnstableSites.length > 0 && <ExportButtonComponent data={stillUnstableExport} filename="pre_vs_post_still_unstable" label="Export All" format="excel" variant="secondary" />}
        </div>
        {stillUnstableSites.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-amber-500/30"><th className="text-left py-2 px-3 text-slate-400 font-medium">Grid</th><th className="text-center py-2 px-3 text-slate-400 font-medium">Count</th><th className="text-center py-2 px-3 text-slate-400 font-medium">Actions</th></tr></thead>
              <tbody>
                {stillUnstableGridBreakdown.map(({ grid, count, sites: gridSites }) => {
                  const isExpanded = expandedStillGrids.has(grid);
                  return (
                    <Fragment key={grid}>
                      <tr className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-3 text-slate-200 font-medium">{grid}</td>
                        <td className="py-2 px-3 text-center text-slate-300">{count}</td>
                        <td className="py-2 px-3 text-center">
                          <button onClick={() => toggleStillGrid(grid)} className="inline-flex items-center gap-1 px-3 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs transition-colors">
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {isExpanded ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr><td colSpan={3} className="px-3 py-2 bg-slate-900/40">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-700">
                                  <th className="text-left py-1 px-2 text-slate-500">Site ID</th>
                                  <th className="text-left py-1 px-2 text-slate-500">Sub-Region</th>
                                  <th className="text-left py-1 px-2 text-slate-500">Cluster Owner</th>
                                  <th className="text-left py-1 px-2 text-slate-500">MS GTL</th>
                                  <th className="text-left py-1 px-2 text-slate-500">Zone Lead</th>
                                  <th className="text-center py-1 px-2 text-slate-500">Current CA%</th>
                                  {lastThreeDays.map(({ label }) => (
                                    <th key={label} className="text-center py-1 px-2 text-slate-500 whitespace-nowrap">
                                      {label}
                                    </th>
                                  ))}
                                  <th className="text-center py-1 px-2 text-slate-500">Prev Month</th>
                                  <th className="text-center py-1 px-2 text-slate-500">Old Case</th>
                                  <th className="text-center py-1 px-2 text-slate-500">Now</th>
                                </tr>
                              </thead>
                              <tbody>
                                {gridSites
                                  .slice()
                                  .sort((a, b) => a.currentAvb - b.currentAvb)
                                  .map((site) => (
                                    <tr key={site.siteName} className="border-b border-slate-800">
                                      <td className="py-1 px-2 text-cyan-300 font-mono">{site.siteName}</td>
                                      <td className="py-1 px-2 text-slate-300">{site.subRegion}</td>
                                      <td className="py-1 px-2 text-slate-300">{site.clusterOwner || "-"}</td>
                                      <td className="py-1 px-2 text-slate-300">{site.msGtl || "-"}</td>
                                      <td className="py-1 px-2 text-slate-300">{site.zongLead || "-"}</td>
                                      <td className="py-1 px-2 text-center text-red-400 font-bold">
                                        {site.currentAvb.toFixed(2)}%
                                      </td>
                                      {lastThreeDays.map(({ dateKey }) => {
                                        const value = site.dailyData?.[dateKey] || 0;
                                        return (
                                          <td
                                            key={dateKey}
                                            className={`py-1 px-2 text-center font-medium ${
                                              value > 0 && value < 98
                                                ? "text-red-400"
                                                : value >= 98
                                                  ? "text-emerald-400"
                                                  : "text-slate-600"
                                            }`}
                                          >
                                            {value > 0 ? `${value.toFixed(2)}%` : "-"}
                                          </td>
                                        );
                                      })}
                                      <td className="py-1 px-2 text-center text-slate-300">
                                        {site.previousMonth?.toFixed(2) || "-"}
                                      </td>
                                      <td className="py-1 px-2 text-center">
                                        <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                                          Unstable
                                        </span>
                                      </td>
                                      <td className="py-1 px-2 text-center">{nowBadge(site.now)}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500"><CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50 text-emerald-400" /><p>No still unstable sites! 🎉</p></div>
        )}
      </div>

      {/* New Case by Grid */}
      <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <h4 className="text-lg font-semibold text-white">New Case Sites by Grid</h4>
            <span className="text-xs text-slate-500">({newCaseSites.length} sites · {newCaseGridBreakdown.length} grids)</span>
          </div>
          {newCaseSites.length > 0 && <ExportButtonComponent data={newCaseExport} filename="pre_vs_post_new_case" label="Export All" format="excel" variant="secondary" />}
        </div>
        {newCaseSites.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-red-500/30"><th className="text-left py-2 px-3 text-slate-400 font-medium">Grid</th><th className="text-center py-2 px-3 text-slate-400 font-medium">Count</th><th className="text-center py-2 px-3 text-slate-400 font-medium">Actions</th></tr></thead>
              <tbody>
                {newCaseGridBreakdown.map(({ grid, count, sites: gridSites }) => {
                  const isExpanded = expandedNewGrids.has(grid);
                  return (
                    <Fragment key={grid}>
                      <tr className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-3 text-slate-200 font-medium">{grid}</td>
                        <td className="py-2 px-3 text-center text-slate-300">{count}</td>
                        <td className="py-2 px-3 text-center">
                          <button onClick={() => toggleNewGrid(grid)} className="inline-flex items-center gap-1 px-3 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-colors">
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {isExpanded ? "Hide" : "View"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr><td colSpan={3} className="px-3 py-2 bg-slate-900/40">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead><tr className="border-b border-slate-700"><th className="text-left py-1 px-2 text-slate-500">Site ID</th><th className="text-left py-1 px-2 text-slate-500">Sub-Region</th><th className="text-left py-1 px-2 text-slate-500">Cluster Owner</th><th className="text-left py-1 px-2 text-slate-500">MS GTL</th><th className="text-left py-1 px-2 text-slate-500">Zone Lead</th><th className="text-center py-1 px-2 text-slate-500">Current CA%</th><th className="text-center py-1 px-2 text-slate-500">Prev Month</th><th className="text-center py-1 px-2 text-slate-500">Old Case</th><th className="text-center py-1 px-2 text-slate-500">New Case</th></tr></thead>
                              <tbody>
                                {gridSites.map((site) => (
                                  <tr key={site.siteName} className="border-b border-slate-800">
                                    <td className="py-1 px-2 text-cyan-300 font-mono">{site.siteName}</td>
                                    <td className="py-1 px-2 text-slate-300">{site.subRegion}</td>
                                    <td className="py-1 px-2 text-slate-300">{site.clusterOwner || "-"}</td>
                                    <td className="py-1 px-2 text-slate-300">{site.msGtl || "-"}</td>
                                    <td className="py-1 px-2 text-slate-300">{site.zongLead || "-"}</td>
                                    <td className="py-1 px-2 text-center text-red-400 font-medium">{site.currentAvb.toFixed(2)}%</td>
                                    <td className="py-1 px-2 text-center text-slate-300">{site.previousMonth?.toFixed(2) || "-"}</td>
                                    <td className="py-1 px-2 text-center"><span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">{site.oldCase || "Stable"}</span></td>
                                    <td className="py-1 px-2 text-center">{newCaseBadge(site.newCase)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td></tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500"><CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50 text-emerald-400" /><p>No new cases found! 🎉</p></div>
        )}
      </div>
    </motion.div>
  );
}


// ============================================================
//  5G SITES PAGE
//  Uses the same full analysis as Platinum+ / PGS
// ============================================================

function FiveGPage({
  data,
  lastUpdatedDate,
  lastColumnIndex = 0,
}: {
  data: SheetPayload | null;
  lastUpdatedDate: string;
  lastColumnIndex?: number;
}) {
  const fiveGSites = useMemo<SiteData[]>(() => {
    if (!data || !data.rows) return [];
    return data.rows.map(normalizeRow);
  }, [data]);

  if (!data) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
        <Radio className="w-10 h-10 text-slate-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white">5G Data Not Available</h3>
        <p className="text-sm text-slate-400 mt-1">
          The 5G worksheet could not be loaded from the September 2026 workbook.
        </p>
      </div>
    );
  }

  return (
    <CategoryPage
      sites={fiveGSites}
      title="5G Sites"
      description={`${fiveGSites.length} sites available in the 5G worksheet`}
      threshold={98}
      color="#06b6d4"
      filterFn={() => true}
      lastUpdatedDate={lastUpdatedDate}
      lastColumnIndex={lastColumnIndex}
    />
  );
}

// ============================================================
//  KPI CARD HELPER
// ============================================================

function KpiCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-400",
    amber: "bg-amber-500/20 text-amber-400",
    emerald: "bg-emerald-500/20 text-emerald-400",
    red: "bg-red-500/20 text-red-400",
    green: "bg-green-500/20 text-green-400",
    orange: "bg-orange-500/20 text-orange-400",
  };
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${colorMap[color]} flex items-center justify-center`}>{icon}</div>
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}

function parseFloatSafe(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.toString().replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ============================================================
//  LOGIN SCREEN
// ============================================================

function LoginScreen({ onLogin }: { onLogin: (success: boolean) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (username.trim() === "" || password.trim() === "") {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      if (username === "c1nar" && password === "irfan123") {
        onLogin(true);
      } else {
        setError("Invalid username or password");
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0" style={{ backgroundImage: `url('/zong 5G.png')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className="absolute inset-0 z-1 bg-black/70" />
      <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="relative z-10 w-full max-w-md px-6">
        <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white">Welcome Back</h2>
            <p className="text-slate-400 text-sm mt-2">Sign in to access the C1 & C6 Dashboard</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" className="w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-700 focus:border-cyan-500 outline-none text-white placeholder:text-slate-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-700 focus:border-cyan-500 outline-none text-white placeholder:text-slate-500 transition-colors" />
            </div>
            {error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2.5 rounded-lg">{error}</motion.div>}
            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 text-white font-bold text-lg transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center justify-center">
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Sign In"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================
//  MAIN APP
// ============================================================

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  useEffect(() => {
    const auth = sessionStorage.getItem("c1_auth");
    if (auth === "true") setIsAuthenticated(true);
  }, []);

  const handleLogin = (success: boolean) => {
    if (success) {
      sessionStorage.setItem("c1_auth", "true");
      setIsAuthenticated(true);
    }
  };

  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [selectedMonth, setSelectedMonth] = useState<Month | null>(null);
  const [appState, setAppState] = useState<AppState>("dashboard");
  const [errorMsg, setErrorMsg] = useState("");

  const [monthData, setMonthData] = useState<SheetPayload | null>(null);
  const [monthHardware, setMonthHardware] = useState<SheetPayload | null>(null);
  const [monthRca, setMonthRca] = useState<SheetPayload | null>(null);
  const [month5G, setMonth5G] = useState<SheetPayload | null>(null);
  const [preVsPostData, setPreVsPostData] = useState<SheetPayload | null>(null);
  const [prePostSites, setPrePostSites] = useState<SiteData[]>([]);
  const [prePostLastUpdated, setPrePostLastUpdated] = useState("");
  const [monthLastUpdated, setMonthLastUpdated] = useState("");
  const [monthLastColumnIndex, setMonthLastColumnIndex] = useState(0);
  const [useMock, setUseMock] = useState(false);

  const [activeTab, setActiveTab] = useState<string>("overall");
  const [selectedRow, setSelectedRow] = useState<SiteData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prePostSidebarOpen, setPrePostSidebarOpen] = useState(false);
  const [prePostSubView, setPrePostSubView] = useState<PrePostSubView>("analysis");

  const parsePrePostRows = (rows: Record<string, string>[]): SiteData[] => {
    return rows.map((row) => {
      const dailyData: Record<string, number> = {};
      const dateRegex = /^\d{1,2}-[A-Z][a-z]{2}-\d{2,4}$/;
      for (const [key, value] of Object.entries(row)) {
        if (dateRegex.test(key)) {
          const num = parseFloatSafe(value);
          if (num > 0) dailyData[key] = num;
        }
      }
      return {
        siteName: row["Site ID"] || "",
        subRegion: row["Sub-Region"] || "",
        revenueCategory: row["Category"] || "",
        grid: row["Grid"] || "",
        currentAvb: parseFloatSafe(row["Current Month"]),
        monthlyAvb: parseFloatSafe(row["Current Month"]),
        dgStatus: "",
        dgInstalled: "",
        liIonInstalled: "",
        agmBb: "",
        belowBase: "",
        msGtl: row["MS GTL"] || "",
        zongLead: row["Zone Lead"] || "",
        clusterOwner: row["Cluster Owner"] || "",
        npsSiteDomain: "",
        technology: "",
        terrain: "",
        sharingStatus: "",
        indoorOutdoor: "",
        hubSingle: "",
        dependentSites: 0,
        chronic: "",
        dgChronic: "",
        liIonChronic: "",
        target: 0,
        city: "",
        ca2G: 0,
        ca3G: 0,
        ca4G: 0,
        dailyData,
        dailyLs: {},
        previousMonth: parseFloatSafe(row["Previous Month"]),
        oldCase: row["Old Case"]?.toString().trim() || "",
        now: row["Now"]?.toString().trim() || "",
        newCase: row["New case"]?.toString().trim() || "",
        category: row["Category"]?.toString().trim() || "",
      } as SiteData;
    });
  };

  const loadMonthData = async (month: Month) => {
    setAppState("loading");
    setErrorMsg("");
    const sheetId = SHEET_IDS[month];
    try {
      const [data, hwData, dateData, rcaSheet, fiveGSheet] = await Promise.all([
        fetchGoogleSheet(sheetId),
        fetchGoogleSheet(sheetId, "Hardware issues"),
        fetchGoogleSheet(sheetId, "Updated Date"),
        fetchGoogleSheet(sheetId, "RCA of Plat +"),
        (month === "august" || month === "september")
          ? fetchGoogleSheet(sheetId, "5G").catch((error) => {
              console.warn("5G sheet could not be loaded:", error);
              return null;
            })
          : Promise.resolve(null),
      ]);
      setMonthData(data);
      setMonthHardware(hwData);
      setMonthRca(rcaSheet);
      setMonth5G(fiveGSheet);
      if (dateData && dateData.rows && dateData.rows.length > 0) {
        const row = dateData.rows[0];
        setMonthLastUpdated(row["Last Updated"] || row["Date"] || row["Last Date"] || "");
        setMonthLastColumnIndex(parseInt(row["Column Index"] || row["Column"] || row["Index"] || "0"));
      }
      setUseMock(false);
      setSelectedMonth(month);
      setViewMode("month");
      setAppState("dashboard");
    } catch (error) {
      console.error(`Error loading ${month} data:`, error);
      setMonthData(null);
      setMonthHardware(null);
      setMonthRca(null);
      setMonth5G(null);
      setMonthLastUpdated(
        month === "june"
          ? "30-Jun-26"
          : month === "july"
            ? "31-Jul-26"
            : month === "august"
              ? "31-Aug-26"
              : "1-Sep-26"
      );
      setMonthLastColumnIndex(74);
      setUseMock(true);
      setSelectedMonth(month);
      setViewMode("month");
      setAppState("dashboard");
    }
  };


  const load5GPage = async () => {
    setAppState("loading");
    setErrorMsg("");

    try {
      const sheetId = SHEET_IDS.september;

      const [data, fiveGSheet, dateData] = await Promise.all([
        fetchGoogleSheet(sheetId),
        fetchGoogleSheet(sheetId, "5G"),
        fetchGoogleSheet(sheetId, "Updated Date"),
      ]);

      setMonthData(data);
      setMonth5G(fiveGSheet);
      setSelectedMonth("september");
      setUseMock(false);

      if (dateData && dateData.rows && dateData.rows.length > 0) {
        const row = dateData.rows[0];
        setMonthLastUpdated(
          row["Last Updated"] ||
          row["Date"] ||
          row["Last Date"] ||
          ""
        );
        setMonthLastColumnIndex(
          parseInt(
            row["Column Index"] ||
            row["Column"] ||
            row["Index"] ||
            "0"
          )
        );
      }

      setActiveTab("5g");
      setViewMode("month");
      setAppState("dashboard");
    } catch (error) {
      console.error("Error loading 5G data:", error);
      setErrorMsg("Failed to load 5G data. Please try again.");
      setAppState("error");
    }
  };

  const loadPreVsPost = async () => {
    setAppState("loading");
    setErrorMsg("");
    try {
      const sheetId = SHEET_IDS.august;
      const data = await fetchGoogleSheet(
        sheetId,
        "Plat+ and DG sites Pre vs Post"
      );
      if (data && data.rows) {
        const parsed = parsePrePostRows(data.rows);
        setPrePostSites(parsed);
        setPreVsPostData(data);
      }
      const dateData = await fetchGoogleSheet(sheetId, "Updated Date");
      let updated = "25-Jul-26";
      if (dateData && dateData.rows && dateData.rows.length > 0) {
        const row = dateData.rows[0];
        updated = row["Last Updated"] || row["Date"] || row["Last Date"] || "25-Jul-26";
      }
      setPrePostLastUpdated(updated);
      setViewMode("prepost");
      setAppState("dashboard");
    } catch (error) {
      console.error("Error loading Pre Vs Post:", error);
      setErrorMsg("Failed to load Pre Vs Post data. Please try again.");
      setAppState("error");
    }
  };

  const loadHardwareIssues = async () => {
    setAppState("loading");
    setErrorMsg("");
    try {
      const sheetId = SHEET_IDS.september;
      const data = await fetchGoogleSheet(sheetId, "Hardware issues");
      setMonthHardware(data);
      const dateData = await fetchGoogleSheet(sheetId, "Updated Date");
      if (dateData && dateData.rows && dateData.rows.length > 0) {
        const row = dateData.rows[0];
        setMonthLastUpdated(row["Last Updated"] || row["Date"] || row["Last Date"] || "1-Sep-26");
      } else {
        setMonthLastUpdated("1-Sep-26");
      }
      setViewMode("hardware");
      setAppState("dashboard");
    } catch (error) {
      console.error("Error loading Hardware Issues:", error);
      setErrorMsg("Failed to load Hardware Issues data. Please try again.");
      setAppState("error");
    }
  };

  const goHome = () => {
    setViewMode("home");
    setSelectedMonth(null);
    setActiveTab("overall");
    setMonthData(null);
    setMonthHardware(null);
    setMonthRca(null);
    setMonth5G(null);
    setPreVsPostData(null);
    setPrePostSites([]);
    setAppState("dashboard");
  };

  const sites: SiteData[] = useMemo(() => {
    if (useMock) return MOCK_SITES;
    return monthData ? monthData.rows.map(normalizeRow) : [];
  }, [monthData, useMock]);

  const hardwareData: SheetPayload | null = useMemo(() => {
    if (useMock) {
      return {
        sheetTitle: "Hardware issues",
        tabTitle: "Hardware issues",
        headers: ["Site ID", "Issue Type", "Status", "Priority", "Reported Date"],
        rows: MOCK_SITES.map((site) => ({
          "Site ID": site.siteName,
          "Issue Type": ["Battery Failure", "Generator Issue", "AC Failure"][Math.floor(Math.random() * 3)],
          "Status": ["Open", "In Progress", "Resolved"][Math.floor(Math.random() * 3)],
          "Priority": ["High", "Medium", "Low"][Math.floor(Math.random() * 3)],
          "Reported Date": new Date().toLocaleDateString(),
        })),
        totalRows: MOCK_SITES.length,
        fetchedAt: new Date().toISOString(),
      };
    }
    return monthHardware;
  }, [monthHardware, useMock]);

  const rcaData = monthRca;

  const platinumPlusRows = useMemo(() => sites.filter((s) => s.revenueCategory === "Platinum +"), [sites]);
  const pgsRows = useMemo(() => sites.filter((s) => PGS_GROUP.includes(s.revenueCategory)), [sites]);
  const sbRows = useMemo(() => sites.filter((s) => SB_GROUP.includes(s.revenueCategory)), [sites]);
  const npsRows = useMemo(() => sites.filter((s) => isNPSSite(s)), [sites]);
  const dgRows = useMemo(() => sites.filter((s) => hasDG(s)), [sites]);
  const liIonRows = useMemo(() => sites.filter((s) => hasLiIon(s)), [sites]);
  const belowBaseRows = useMemo(() => sites.filter((s) => isBelowBase(s)), [sites]);
  const agmRows = useMemo(() => sites.filter((s) => hasAGM(s)), [sites]);

  const activeLabel = NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? "";

  if (appState === "loading") return <LoadingScreen />;
  if (appState === "error") return <ErrorScreen message={errorMsg} onRetry={viewMode === "prepost" ? loadPreVsPost : viewMode === "hardware" ? loadHardwareIssues : () => loadMonthData(selectedMonth || "june")} />;
  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} />;

  // ----- HOME SCREEN (four buttons) -----
  if (viewMode === "home") {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0" style={{ backgroundImage: `url('/zong 5G.png')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 z-1 bg-black/60" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="relative z-10 max-w-5xl w-full px-6 text-center">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="inline-block mb-8 px-8 py-3 rounded-full bg-cyan-500/10 border border-cyan-400/30 backdrop-blur-sm">
            <span className="text-cyan-300 font-bold tracking-widest text-sm">📶 ZONG 5G</span>
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6 drop-shadow-lg">C1 & C6 <br /><span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Cell Avb Analysis</span></h1>
          <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.15 } } }} initial="hidden" animate="show" className="flex flex-wrap justify-center items-stretch gap-6 mt-8">
            <motion.button variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }} whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(6, 182, 212, 0.25)" }} whileTap={{ scale: 0.98 }} onClick={() => loadMonthData("june")} className="group relative flex-1 min-w-[180px] px-8 py-7 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-600/50 hover:border-cyan-400 transition-all duration-300 shadow-xl backdrop-blur-sm overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative text-center"><span className="block text-2xl font-bold text-white">June 2026</span><span className="text-slate-400 text-sm">Final data · 30 days</span></div>
            </motion.button>
            <motion.button variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }} whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(6, 182, 212, 0.25)" }} whileTap={{ scale: 0.98 }} onClick={() => loadMonthData("july")} className="group relative flex-1 min-w-[180px] px-8 py-7 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-600/50 hover:border-cyan-400 transition-all duration-300 shadow-xl backdrop-blur-sm overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative text-center"><span className="block text-2xl font-bold text-white">July 2026</span><span className="text-slate-400 text-sm">Final data · 31 days</span></div>
            </motion.button>
            <motion.button variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }} whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(6, 182, 212, 0.25)" }} whileTap={{ scale: 0.98 }} onClick={() => loadMonthData("august")} className="group relative flex-1 min-w-[180px] px-8 py-7 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-600/50 hover:border-cyan-400 transition-all duration-300 shadow-xl backdrop-blur-sm overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative text-center"><span className="block text-2xl font-bold text-white">August 2026</span><span className="text-slate-400 text-sm">Final data · 31 days</span></div>
            </motion.button>
            <motion.button variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }} whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(16, 185, 129, 0.35)" }} whileTap={{ scale: 0.98 }} onClick={() => loadMonthData("september")} className="group relative flex-1 min-w-[180px] px-8 py-7 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-400/30 hover:border-emerald-300 transition-all duration-300 shadow-xl hover:shadow-emerald-500/40 backdrop-blur-sm overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-green-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative text-center"><span className="block text-2xl font-bold text-white">September 2026</span><span className="text-slate-300 text-sm">Live updates · Progressive</span></div>
            </motion.button>
            <motion.button
              variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }}
              whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(14, 165, 233, 0.35)" }}
              whileTap={{ scale: 0.98 }}
              onClick={load5GPage}
              className="group relative flex-1 min-w-[180px] px-8 py-7 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 hover:border-cyan-300 transition-all duration-300 shadow-xl hover:shadow-cyan-500/40 backdrop-blur-sm overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-blue-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative text-center">
                <span className="block text-2xl font-bold text-white">5G Sites</span>
                <span className="text-slate-300 text-sm">September 2026 · KPI Dashboard</span>
              </div>
            </motion.button>

            <motion.button variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }} whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(168, 85, 247, 0.25)" }} whileTap={{ scale: 0.98 }} onClick={loadPreVsPost} className="group relative flex-1 min-w-[200px] px-8 py-7 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/30 hover:border-purple-300 transition-all duration-300 shadow-xl hover:shadow-purple-500/40 backdrop-blur-sm overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative text-center"><span className="block text-2xl font-bold text-white">Plat+ & DG Pre Vs Post</span><span className="text-slate-300 text-sm">July vs August comparison</span></div>
            </motion.button>
            <motion.button variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } }} whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(245, 158, 11, 0.25)" }} whileTap={{ scale: 0.98 }} onClick={loadHardwareIssues} className="group relative flex-1 min-w-[180px] px-8 py-7 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-400/30 hover:border-amber-300 transition-all duration-300 shadow-xl hover:shadow-amber-500/40 backdrop-blur-sm overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative text-center"><span className="block text-2xl font-bold text-white">Hardware Issues</span><span className="text-slate-300 text-sm">View hardware problems</span></div>
            </motion.button>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-12 text-slate-400 text-sm flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Real-time data from Google Sheets</span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ----- PRE‑VS‑POST FULL PAGE WITH SIDEBAR -----
 if (viewMode === "prepost") {
  const prePostNav = [
    { id: "analysis", label: "Plat+ & DG Pre Vs Post", icon: GitCompare },
    { id: "query", label: "Site Query", icon: Search },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      <RainAlertWidget />

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-64 bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-300 ${prePostSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <GitCompare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Plat+ and DG sites Pre vs Post</h1>
              <p className="text-[10px] text-slate-500">August 2026</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {prePostNav.map((item) => {
            const Icon = item.icon;
            const isActive = prePostSubView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setPrePostSubView(item.id as PrePostSubView);
                  setPrePostSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-purple-500/15 text-purple-400 border border-purple-500/30" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <button onClick={goHome} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors w-full">
            <span className="text-slate-400">←</span> Back to Home
          </button>
        </div>
      </aside>

      {/* Backdrop overlay */}
      {prePostSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setPrePostSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setPrePostSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
                <Menu className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-white">
                {prePostSubView === "analysis" ? "Plat+ and DG Sites Pre Vs Post Analysis" : "Site Query"}
              </h2>
            </div>
            <div className="text-xs text-slate-500">Data updated: {prePostLastUpdated || "23-Aug-26"}</div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          {prePostSubView === "analysis" ? (
            <PreVsPostAnalysis sites={prePostSites} lastUpdatedDate={prePostLastUpdated} />
          ) : (
            <SiteQuery sites={prePostSites} />
          )}
        </main>
      </div>
    </div>
  );
}

  // ----- HARDWARE ISSUES FULL PAGE -----
  if (viewMode === "hardware") {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <RainAlertWidget />
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={goHome} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors">
              <span className="text-slate-400">←</span> Back to Home
            </button>
            <div className="text-xs text-slate-500">Data updated: {monthLastUpdated || "1-Sep-26"}</div>
          </div>
          {hardwareData ? <HardwareIssues data={hardwareData} /> : <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-400">No hardware issues data available.</div>}
        </div>
      </div>
    );
  }

  // ----- MONTH DASHBOARD (with sidebar) -----
  const monthLabel =
    selectedMonth === "june"
      ? "June 2026"
      : selectedMonth === "july"
        ? "July 2026"
        : selectedMonth === "august"
          ? "August 2026"
          : "September 2026";
  const isLive = selectedMonth === "september";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      <RainAlertWidget />
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-64 bg-slate-950 border-r border-slate-800 flex flex-col transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">C1 &amp; C6 Cell Avb Analysis</h1>
              <p className="text-[10px] text-slate-500">{useMock ? "📊 Demo Mode" : "Google Sheets Connected"}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.filter((item) => item.id !== "5g" || selectedMonth === "august" || selectedMonth === "september").map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"}`}>
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900 text-xs text-slate-500">
            <div className="flex items-center gap-2"><Database className="w-3.5 h-3.5" />{sites.length} sites</div>
            {useMock && <span className="text-amber-400 text-[10px] bg-amber-500/10 px-2 py-0.5 rounded">Demo</span>}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white"><Menu className="w-5 h-5" /></button>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{activeLabel} — {monthLabel}{isLive && <span className="ml-2 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">LIVE</span>}</h2>
                <p className="text-[11px] text-slate-500 truncate flex items-center gap-2 flex-wrap">
                  {monthLastUpdated && <span className="text-cyan-400 font-medium">Report Updated: {monthLastUpdated}</span>}
                  {!monthLastUpdated && useMock && <span className="text-cyan-400 font-medium">Report Updated: {selectedMonth === "june" ? "30-Jun-26" : selectedMonth === "july" ? "31-Jul-26" : selectedMonth === "august" ? "31-Aug-26" : "1-Sep-26"}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={goHome} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors shrink-0"><span className="text-slate-400">←</span> Switch Month</button>
              <button onClick={() => loadMonthData(selectedMonth as Month)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors shrink-0"><RefreshCw className="w-4 h-4" /> Refresh</button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <ErrorBoundary key={activeTab + selectedMonth}>
            <AnimatePresence mode="wait">
              <motion.div key={activeTab + selectedMonth} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-6">
                {activeTab === "overall" && <OverallSummaryWithExport sites={sites} rawData={monthData} />}
                {activeTab === "grid-performance" && <GridPerformanceScorecard rawData={monthData} lastUpdatedDate={monthLastUpdated} />}
                {activeTab === "employees" && <><SectionBanner icon={<Users className="w-6 h-6 text-indigo-400" />} title="Employee Performance Analysis" subtitle={`${sites.filter((s) => s.currentAvb > 0).length} active sites`} gradient="from-indigo-500/10 to-purple-500/10 border-indigo-500/20" /><EmployeePerformance sites={sites} /></>}
                {activeTab === "platinum-plus" && <CategoryPage sites={sites} title="Platinum+ Sites" description={`${platinumPlusRows.length} sites in the Platinum+ category`} threshold={98.5} filterFn={(s) => s.revenueCategory === "Platinum +"} lastUpdatedDate={monthLastUpdated} lastColumnIndex={monthLastColumnIndex} />}
                {activeTab === "pgs" && <CategoryPage sites={sites} title="PGS Sites" description={`${pgsRows.length} high-priority revenue sites`} threshold={98.1} filterFn={(s) => PGS_GROUP.includes(s.revenueCategory)} lastUpdatedDate={monthLastUpdated} lastColumnIndex={monthLastColumnIndex} />}
                {activeTab === "sb" && <CategoryPage sites={sites} title="SB Sites" description={`${sbRows.length} standard-tier revenue sites`} threshold={95} filterFn={(s) => SB_GROUP.includes(s.revenueCategory)} lastUpdatedDate={monthLastUpdated} lastColumnIndex={monthLastColumnIndex} />}
                {activeTab === "nps" && <CategoryPage sites={sites} title="NPS Sites (New Physical Sites)" description={`${npsRows.length} NPS Y26 sites`} threshold={95} filterFn={(s) => isNPSSite(s)} lastUpdatedDate={monthLastUpdated} lastColumnIndex={monthLastColumnIndex} />}
                {activeTab === "5g" && <FiveGPage data={month5G} lastUpdatedDate={monthLastUpdated} lastColumnIndex={monthLastColumnIndex} />}
                {activeTab === "dg" && <CategoryPage sites={sites} title="DG Sites (Diesel Generator Backup)" description={`${dgRows.length} sites with diesel generators`} threshold={98.5} filterFn={(s) => hasDG(s)} lastUpdatedDate={monthLastUpdated} lastColumnIndex={monthLastColumnIndex} />}
                {activeTab === "li-ion" && <CategoryPage sites={sites} title="Li-ion Battery Backup Sites" description={`${liIonRows.length} sites with Li-ion batteries installed`} threshold={98} filterFn={(s) => hasLiIon(s)} lastUpdatedDate={monthLastUpdated} lastColumnIndex={monthLastColumnIndex} />}
                {activeTab === "below-base" && <CategoryPage sites={sites} title="Below Base Sites" description={`${belowBaseRows.length} sites flagged below base threshold`} threshold={95} filterFn={(s) => isBelowBase(s)} lastUpdatedDate={monthLastUpdated} lastColumnIndex={monthLastColumnIndex} />}
                {activeTab === "agm" && <CategoryPage sites={sites} title="AGM Battery Backup Sites" description={`${agmRows.length} sites with AGM battery banks`} threshold={95} filterFn={(s) => hasAGM(s)} lastUpdatedDate={monthLastUpdated} lastColumnIndex={monthLastColumnIndex} />}
                {activeTab === "rca" && <RcaSummary rcaData={rcaData} />}
                {activeTab === "hardware" && hardwareData && <HardwareIssues data={hardwareData} />}
                {activeTab === "query" && <SiteQuery sites={sites} />}
                {activeTab === "weather" && <WeatherRadar />}
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
          <footer className="text-center text-xs text-slate-600 py-4">
            {useMock ? "📊 Demo Mode - Using sample data" : `Live data from Google Sheets (${monthLabel})`} · {sites.length} sites · C1 & C6 Cell Avb Analysis
          </footer>
        </main>
      </div>
      <AnimatePresence>
        {selectedRow && <DetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
      </AnimatePresence>
    </div>
  );
}

