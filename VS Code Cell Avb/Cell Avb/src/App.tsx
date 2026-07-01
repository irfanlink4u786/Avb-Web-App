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
  Lightbulb,
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
  UserCheck,
  Clock,
  CheckCircle2,
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
// EXPORT UTILITY FUNCTIONS (unchanged)
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

// ============================================================
// EXPORT BUTTON COMPONENT (unchanged)
// ============================================================

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
// COLUMN HELPER (unchanged)
// ============================================================

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
// OVERALL SUMMARY WRAPPER WITH EXPORT (unchanged)
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
            <p className="text-xs text-slate-400">{fullExportData.length} rows · All columns from A to GH</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButtonComponent data={fullExportData} filename="all_sites_full_data" label="Export Excel" format="excel" variant="primary" />
          <ExportButtonComponent data={fullExportData} filename="all_sites_full_data" label="CSV" format="csv" variant="secondary" />
        </div>
      </div>
      <OverallSummaryComponent sites={sites} />
    </div>
  );
}

// ============================================================
// MOCK DATA (unchanged)
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
  // Add more mock sites as needed
];

// ============================================================
// SHARED UI COMPONENTS (unchanged)
// ============================================================

function CaBadge({ value, threshold }: { value: number; threshold: number }) {
  const color = value >= threshold ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>{value.toFixed(2)}%</span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] || "#475569";
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: `${color}22`, color }}>
      {category}
    </span>
  );
}

function FilterSelect({ label, options, value, onChange }: {
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
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-800 ${
                value === "__all" ? "text-cyan-400" : "text-slate-300"
              }`}
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
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-800 truncate ${
                  value === opt ? "text-cyan-400" : "text-slate-300"
                }`}
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

// ============================================================
// DETAIL MODAL (unchanged)
// ============================================================

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

// ============================================================
// SITE TABLE (unchanged)
// ============================================================

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
// CATEGORY PAGE WITH DYNAMIC LAST 3 DAYS (unchanged)
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

  // Export all sites
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

  // --- Date helpers ---
  const formatDateKey = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, "0");
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

  // --- Worst 10 sites ---
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

  // --- Unstable sites ---
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

  // --- Stats ---
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
// SITE QUERY COMPONENT (unchanged)
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
// RCA SUMMARY (UPDATED TO 6 COLUMNS: Site ID, Month, Category, Issue, POC, Status)
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

      {/* Summary Cards */}
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

      {/* Filters */}
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

      {/* POC Workload */}
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

      {/* Table with 6 columns: Site ID, Month, Category, Issue, POC, Status */}
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
// MAIN APP
// ============================================================

const NAV_ITEMS = [
  { id: "overall", label: "Overall Summary", icon: LayoutDashboard },
  { id: "employees", label: "Employees", icon: Users },
  { id: "platinum-plus", label: "Platinum+", icon: Crown },
  { id: "pgs", label: "PGS Sites", icon: TrendingUp },
  { id: "sb", label: "SB Sites", icon: TrendingDown },
  { id: "nps", label: "NPS Sites", icon: Sparkles },
  { id: "dg", label: "DG Sites", icon: Zap },
  { id: "li-ion", label: "Li-ion BB", icon: Battery },
  { id: "below-base", label: "Below Base", icon: AlertTriangle },
  { id: "agm", label: "AGM BB", icon: BatteryWarning },
  { id: "rca", label: "RCA of Plat+", icon: ListChecks },
  { id: "hardware", label: "Hardware Issues", icon: Cpu },
  { id: "query", label: "Site Query", icon: Search },
  { id: "weather", label: "Weather Radar", icon: CloudRain },
];

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

export default function App() {
  const [rawData, setRawData] = useState<SheetPayload | null>(null);
  const [hardwareData, setHardwareData] = useState<SheetPayload | null>(null);
  const [rcaData, setRcaData] = useState<SheetPayload | null>(null);
  const [appState, setAppState] = useState<"loading" | "dashboard" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState("overall");
  const [selectedRow, setSelectedRow] = useState<SiteData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [useMockData, setUseMockData] = useState(false);

  const [lastUpdatedDate, setLastUpdatedDate] = useState<string>("");
  const [lastColumnIndex, setLastColumnIndex] = useState<number>(0);

  const loadSheetData = async () => {
    setAppState("loading");
    setErrorMsg("");
    try {
      const [data, hwData, dateData, rcaSheet] = await Promise.all([
        fetchGoogleSheet("1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk"),
        fetchGoogleSheet("1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk", "Hardware issues"),
        fetchGoogleSheet("1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk", "Updated Date"),
        fetchGoogleSheet("1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk", "RCA of Plat +"),
      ]);
      setRawData(data);
      setHardwareData(hwData);
      setRcaData(rcaSheet);
      if (dateData && dateData.rows && dateData.rows.length > 0) {
        const row = dateData.rows[0];
        const dateVal = row["Last Updated"] || row["Date"] || row["Last Date"] || "";
        const idxVal = parseInt(row["Column Index"] || row["Column"] || row["Index"] || "0");
        setLastUpdatedDate(dateVal);
        setLastColumnIndex(idxVal);
      }
      setUseMockData(false);
      setAppState("dashboard");
    } catch (error) {
      console.error("Error loading data from Google Sheets, using mock data:", error);
      setLastUpdatedDate("25-Jun-26");
      setLastColumnIndex(74);
      setUseMockData(true);
      setAppState("dashboard");
    }
  };

  useEffect(() => {
    loadSheetData();
  }, []);

  const sites: SiteData[] = useMemo(() => {
    if (useMockData) {
      return MOCK_SITES;
    }
    return rawData ? rawData.rows.map(normalizeRow) : [];
  }, [rawData, useMockData]);

  const hardwareIssuesData: SheetPayload | null = useMemo(() => {
    if (useMockData) {
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
    return hardwareData;
  }, [hardwareData, useMockData]);

  const platinumPlusRows = useMemo(() => sites.filter((s) => s.revenueCategory === "Platinum +"), [sites]);
  const pgsRows = useMemo(() => sites.filter((s) => PGS_GROUP.includes(s.revenueCategory)), [sites]);
  const sbRows = useMemo(() => sites.filter((s) => SB_GROUP.includes(s.revenueCategory)), [sites]);
  const npsRows = useMemo(() => sites.filter((s) => isNPSSite(s)), [sites]);
  const dgRows = useMemo(() => sites.filter((s) => hasDG(s)), [sites]);
  const liIonRows = useMemo(() => sites.filter((s) => hasLiIon(s)), [sites]);
  const belowBaseRows = useMemo(() => sites.filter((s) => isBelowBase(s)), [sites]);
  const agmRows = useMemo(() => sites.filter((s) => hasAGM(s)), [sites]);

  if (appState === "loading") return <LoadingScreen />;
  if (appState === "error") return <ErrorScreen message={errorMsg} onRetry={loadSheetData} />;

  const activeLabel = NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? "";

  const categoryProps = {
    lastUpdatedDate,
    lastColumnIndex,
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      <RainAlertWidget />

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-64 bg-slate-950 border-r border-slate-800 flex flex-col transition-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">C1 &amp; C6 Cell Avb Analysis</h1>
              <p className="text-[10px] text-slate-500">{useMockData ? "📊 Demo Mode" : "Google Sheets Connected"}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5" />
              {sites.length} sites
            </div>
            {useMockData && (
              <span className="text-amber-400 text-[10px] bg-amber-500/10 px-2 py-0.5 rounded">Demo Data</span>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{activeLabel}</h2>
                <p className="text-[11px] text-slate-500 truncate flex items-center gap-2 flex-wrap">
                  {lastUpdatedDate && (
                    <span className="text-cyan-400 font-medium">
                      Report Updated: {lastUpdatedDate}
                    </span>
                  )}
                  {!lastUpdatedDate && useMockData && (
                    <span className="text-cyan-400 font-medium">Report Updated: 25-Jun-26</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={loadSheetData}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors shrink-0"
            >
              <RefreshCw className="w-4 h-4" /> {useMockData ? "Try Live Data" : "Refresh"}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <ErrorBoundary key={activeTab}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {activeTab === "overall" && <OverallSummaryWithExport sites={sites} rawData={rawData} />}

                {activeTab === "employees" && (
                  <>
                    <SectionBanner
                      icon={<Users className="w-6 h-6 text-indigo-400" />}
                      title="Employee Performance Analysis"
                      subtitle={`${sites.filter((s) => s.currentAvb > 0).length} active sites across Zone Leads, MS GTL, and Cluster Owners`}
                      gradient="from-indigo-500/10 to-purple-500/10 border-indigo-500/20"
                    />
                    <EmployeePerformance sites={sites} />
                  </>
                )}

                {activeTab === "platinum-plus" && (
                  <CategoryPage
                    sites={sites}
                    title="Platinum+ Sites"
                    description={`${platinumPlusRows.length} sites in the Platinum+ category`}
                    threshold={98.5}
                    filterFn={(s) => s.revenueCategory === "Platinum +"}
                    {...categoryProps}
                  />
                )}

                {activeTab === "pgs" && (
                  <CategoryPage
                    sites={sites}
                    title="PGS Sites"
                    description={`${pgsRows.length} high-priority revenue sites (Platinum, Gold, Strategic)`}
                    threshold={98.1}
                    filterFn={(s) => PGS_GROUP.includes(s.revenueCategory)}
                    {...categoryProps}
                  />
                )}

                {activeTab === "sb" && (
                  <CategoryPage
                    sites={sites}
                    title="SB Sites"
                    description={`${sbRows.length} standard-tier revenue sites (Silver, Bronze)`}
                    threshold={95}
                    filterFn={(s) => SB_GROUP.includes(s.revenueCategory)}
                    {...categoryProps}
                  />
                )}

                {activeTab === "nps" && (
                  <CategoryPage
                    sites={sites}
                    title="NPS Sites (New Physical Sites)"
                    description={`${npsRows.length} NPS Y26 sites`}
                    threshold={95}
                    filterFn={(s) => isNPSSite(s)}
                    {...categoryProps}
                  />
                )}

                {activeTab === "dg" && (
                  <CategoryPage
                    sites={sites}
                    title="DG Sites (Diesel Generator Backup)"
                    description={`${dgRows.length} sites with diesel generators`}
                    threshold={99}
                    filterFn={(s) => hasDG(s)}
                    {...categoryProps}
                  />
                )}

                {activeTab === "li-ion" && (
                  <CategoryPage
                    sites={sites}
                    title="Li-ion Battery Backup Sites"
                    description={`${liIonRows.length} sites with Li-ion batteries installed`}
                    threshold={98}
                    filterFn={(s) => hasLiIon(s)}
                    {...categoryProps}
                  />
                )}

                {activeTab === "below-base" && (
                  <CategoryPage
                    sites={sites}
                    title="Below Base Sites"
                    description={`${belowBaseRows.length} sites flagged below base threshold`}
                    threshold={95}
                    filterFn={(s) => isBelowBase(s)}
                    {...categoryProps}
                  />
                )}

                {activeTab === "agm" && (
                  <CategoryPage
                    sites={sites}
                    title="AGM Battery Backup Sites"
                    description={`${agmRows.length} sites with AGM battery banks`}
                    threshold={95}
                    filterFn={(s) => hasAGM(s)}
                    {...categoryProps}
                  />
                )}

                {activeTab === "rca" && <RcaSummary rcaData={rcaData} />}

                {activeTab === "hardware" && hardwareIssuesData && <HardwareIssues data={hardwareIssuesData} />}
                {activeTab === "query" && <SiteQuery sites={sites} />}
                {activeTab === "weather" && <WeatherRadar />}
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>

          <footer className="text-center text-xs text-slate-600 py-4">
            {useMockData ? "📊 Demo Mode - Using sample data" : "Live data from Google Sheets"} · {sites.length} sites · C1
            &amp; C6 Cell Avb Analysis
          </footer>
        </main>
      </div>

      <AnimatePresence>
        {selectedRow && <DetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
      </AnimatePresence>
    </div>
  );
}
