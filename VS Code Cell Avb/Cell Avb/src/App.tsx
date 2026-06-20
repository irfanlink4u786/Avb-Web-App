import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import HardwareIssues from "./components/HardwareIssues";
import SiteQuery from "./components/SiteQuery";
import ExportButton from "./components/ExportButton";
import WeatherRadar from "./components/WeatherRadar";
import RainAlertWidget from "./components/RainAlertWidget";
import { fetchGoogleSheet, type SheetPayload } from "./services/googleSheets";
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
import OverallSummary from "./components/OverallSummary";
import EmployeePerformance from "./components/EmployeePerformance";

/* ============================================================
   SHARED UI: BADGES, FILTER SELECT
   ============================================================ */
function CaBadge({ value, threshold }: { value: number; threshold: number }) {
  const color = value >= threshold ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {value.toFixed(2)}%
    </span>
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
              onClick={() => { onChange("__all"); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-800 ${value === "__all" ? "text-cyan-400" : "text-slate-300"}`}
            >
              All
            </button>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
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

/* ============================================================
   DETAIL MODAL
   ============================================================ */
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

/* ============================================================
   SITE TABLE (searchable, filterable, paginated)
   ============================================================ */
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
      if (val !== "__all" && val)
        r = r.filter((row) => (row[key as keyof SiteData] ?? "").toString().trim() === val);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) => Object.values(row).some((v) => v?.toString().toLowerCase().includes(q)));
    }
    return r;
  }, [rows, filters, search]);

  useEffect(() => { setPage(0); }, [filters, search, rows.length]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const filterConfigs = [
    { key: "revenueCategory", label: "Category", options: uniqueVals(rows, "revenueCategory") },
    { key: "terrain", label: "Terrain", options: uniqueVals(rows, "terrain") },
    { key: "subRegion", label: "Sub-Region", options: uniqueVals(rows, "subRegion") },
    { key: "sharingStatus", label: "Sharing", options: uniqueVals(rows, "sharingStatus") },
    { key: "dgInstalled", label: "DG", options: uniqueVals(rows, "dgInstalled") },
  ];

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            Site Inventory
            <span className="text-slate-500 font-normal text-sm">({filtered.length} of {rows.length})</span>
          </h3>
        </div>
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
              onClick={() => { setFilters({}); setSearch(""); }}
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
                <th key={h} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">{h}</th>
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
                <td className="px-3 py-2.5"><CategoryBadge category={row.revenueCategory} /></td>
                <td className="px-3 py-2.5">
                  {row.currentAvb > 0 ? <CaBadge value={row.currentAvb} threshold={95} /> : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{row.terrain}</td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{row.technology}</td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{row.subRegion}</td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{row.sharingStatus}</td>
                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{row.dgInstalled}</td>
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
              <tr><td colSpan={10} className="px-3 py-12 text-center text-slate-500">No sites match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-slate-700">
          <p className="text-xs text-slate-500">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 rounded-lg bg-slate-700 disabled:opacity-40 hover:bg-slate-600 text-sm transition-colors">Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg bg-slate-700 disabled:opacity-40 hover:bg-slate-600 text-sm transition-colors">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   OVERALL SUMMARY PAGE
   ============================================================ */
interface Rec {
  icon: string;
  priority: "HIGH" | "MEDIUM";
  text: string;
  impact: string;
}

function KpiCard({
  icon, iconBg, iconColor, value, label,
}: {
  icon: React.ReactNode; iconBg: string; iconColor: string; value: string | number; label: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
      </div>
    </div>
  );
}

function RecCard({ rec }: { rec: Rec }) {
  const priorityColor = rec.priority === "HIGH" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5";
  const priorityBadge = rec.priority === "HIGH" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400";
  return (
    <div className={`border ${priorityColor} rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{rec.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priorityBadge}`}>{rec.priority}</span>
          </div>
          <p className="text-sm text-slate-300">{rec.text}</p>
          <p className="text-xs text-cyan-400 mt-1.5 font-medium">→ {rec.impact}</p>
        </div>
      </div>
    </div>
  );
}

function generateRegionRecs(regionSites: SiteData[], regionName: string): Rec[] {
  const recs: Rec[] = [];
  const active = regionSites.filter((s) => s.currentAvb > 0);

  const agmSites = active.filter((s) => hasAGM(s));
  const agmCa = agmSites.length > 0 ? agmSites.reduce((s, r) => s + r.currentAvb, 0) / agmSites.length : 0;

  const dgSites = active.filter((s) => hasDG(s));
  const dgCa = dgSites.length > 0 ? dgSites.reduce((s, r) => s + r.currentAvb, 0) / dgSites.length : 0;

  const liIonSites = active.filter((s) => s.liIonInstalled?.toUpperCase() === "YES");
  const liIonCa = liIonSites.length > 0 ? liIonSites.reduce((s, r) => s + r.currentAvb, 0) / liIonSites.length : 0;

  const belowBaseSites = active.filter((s) => isBelowBase(s));
  const belowBaseCa = belowBaseSites.length > 0 ? belowBaseSites.reduce((s, r) => s + r.currentAvb, 0) / belowBaseSites.length : 0;

  const platPlusSites = active.filter((s) => s.revenueCategory === "Platinum +");
  const platPlusCa = platPlusSites.length > 0 ? platPlusSites.reduce((s, r) => s + r.currentAvb, 0) / platPlusSites.length : 0;

  if (agmSites.length > 0 && agmCa < 95) {
    recs.push({
      icon: "⚠️", priority: "HIGH",
      text: `AGM BB Performance Degraded (${agmCa.toFixed(2)}%): ${agmSites.length} sites with AGM batteries showing degraded AVB. Recommend immediate battery replacement program to improve overall ${regionName} AVB.`,
      impact: `Potential improvement: +${(95 - agmCa).toFixed(2)}% for ${agmSites.length} sites`,
    });
  }

  const dgCritical = dgSites.filter((s) => s.currentAvb < 99);
  if (dgCritical.length > 0 && dgCa < 99) {
    recs.push({
      icon: "🔧", priority: "MEDIUM",
      text: `DG Site Underperformance (${dgCa.toFixed(2)}%): ${dgCritical.length} DG-equipped sites below 99% threshold. Review DG maintenance schedules and fuel availability.`,
      impact: `Focus on ${dgCritical.length} critical DG sites`,
    });
  }

  if (liIonSites.length > 0 && liIonCa < 98) {
    recs.push({
      icon: "🔋", priority: "MEDIUM",
      text: `Li-ion Backup Issues (${liIonCa.toFixed(2)}%): ${liIonSites.length} Li-ion sites not meeting 2-hour backup target. Verify battery health and charging systems.`,
      impact: `${liIonSites.filter((s) => s.currentAvb < 98).length} sites need attention`,
    });
  }

  if (belowBaseSites.length > 0) {
    recs.push({
      icon: "📉", priority: "HIGH",
      text: `Below Base Sites (${belowBaseCa.toFixed(2)}%): ${belowBaseSites.length} sites not meeting base values. Investigate root causes and implement corrective actions immediately.`,
      impact: `Critical: ${belowBaseSites.length} sites require intervention`,
    });
  }

  const platPlusCritical = platPlusSites.filter((s) => s.currentAvb < 98);
  if (platPlusSites.length > 0 && platPlusCa < 98) {
    recs.push({
      icon: "💎", priority: "HIGH",
      text: `Platinum+ Sites Below Target (${platPlusCa.toFixed(2)}%): ${platPlusCritical.length} premium sites below 98%. Prioritize these high-revenue sites for immediate action.`,
      impact: `Revenue impact: ${platPlusCritical.length} premium sites`,
    });
  }

  return recs;
}

function OverallSummary({ sites }: { sites: SiteData[] }) {
  const stats = useMemo(() => {
    const active = sites.filter((s) => s.currentAvb > 0);
    const dismantled = sites.length - active.length;
    const overallCa = active.length > 0 ? active.reduce((s, r) => s + r.currentAvb, 0) / active.length : 0;

    const c1Sites = active.filter((s) => s.subRegion === "C-1");
    const c6Sites = active.filter((s) => s.subRegion === "C-6");
    const c1Ca = c1Sites.length > 0 ? c1Sites.reduce((s, r) => s + r.currentAvb, 0) / c1Sites.length : 0;
    const c6Ca = c6Sites.length > 0 ? c6Sites.reduce((s, r) => s + r.currentAvb, 0) / c6Sites.length : 0;

    const categories = Array.from(new Set(sites.map((s) => s.revenueCategory).filter(Boolean)));
    const categoryData = categories.map((cat) => {
      const catSites = active.filter((s) => s.revenueCategory === cat);
      const avgCa = catSites.length > 0 ? catSites.reduce((s, r) => s + r.currentAvb, 0) / catSites.length : 0;
      const c1Subset = catSites.filter((s) => s.subRegion === "C-1");
      const c6Subset = catSites.filter((s) => s.subRegion === "C-6");
      const threshold = CATEGORY_THRESHOLDS[cat] ?? 95;
      return {
        category: cat,
        count: catSites.length,
        avgCa: parseFloat(avgCa.toFixed(2)),
        c1Count: c1Subset.length,
        c1Avg: parseFloat((c1Subset.length > 0 ? c1Subset.reduce((s, r) => s + r.currentAvb, 0) / c1Subset.length : 0).toFixed(2)),
        c6Count: c6Subset.length,
        c6Avg: parseFloat((c6Subset.length > 0 ? c6Subset.reduce((s, r) => s + r.currentAvb, 0) / c6Subset.length : 0).toFixed(2)),
        critical: catSites.filter((s) => s.currentAvb < threshold).length,
        threshold,
        group: PGS_GROUP.includes(cat) ? "PGS" : "SB",
      };
    }).sort((a, b) => b.count - a.count);

    const pgsCritical = active.filter((s) => PGS_GROUP.includes(s.revenueCategory)).filter((s) => s.currentAvb < (CATEGORY_THRESHOLDS[s.revenueCategory] ?? 98.1)).sort((a, b) => a.currentAvb - b.currentAvb);
    const sbCritical = active.filter((s) => !PGS_GROUP.includes(s.revenueCategory)).filter((s) => s.currentAvb < 95).sort((a, b) => a.currentAvb - b.currentAvb);

    const gridMap = new Map<string, SiteData[]>();
    active.forEach((s) => { const g = s.grid || "Unknown"; if (!gridMap.has(g)) gridMap.set(g, []); gridMap.get(g)!.push(s); });
    const gridStats = Array.from(gridMap.entries()).map(([grid, gs]) => ({
      grid,
      count: gs.length,
      avgCa: parseFloat((gs.reduce((s, r) => s + r.currentAvb, 0) / gs.length).toFixed(2)),
      critical: gs.filter((s) => { const t = PGS_GROUP.includes(s.revenueCategory) ? CATEGORY_THRESHOLDS[s.revenueCategory] ?? 98.1 : 95; return s.currentAvb < t; }).length,
    })).sort((a, b) => a.avgCa - b.avgCa);

    const worst10 = active.sort((a, b) => a.currentAvb - b.currentAvb).slice(0, 10);

    return {
      totalSites: sites.length, activeCount: active.length, dismantled,
      overallCa, c1Sites: c1Sites.length, c1Ca, c6Sites: c6Sites.length, c6Ca,
      categoryData, criticalPgs: pgsCritical.length, criticalSb: sbCritical.length,
      gridStats, worst10,
    };
  }, [sites]);

  const c1Recs = useMemo(() => generateRegionRecs(sites.filter((s) => s.subRegion === "C-1"), "C-1"), [sites]);
  const c6Recs = useMemo(() => generateRegionRecs(sites.filter((s) => s.subRegion === "C-6"), "C-6"), [sites]);

  const kpiExport = [
    { Metric: "Total Sites", Value: stats.totalSites, Details: `Active: ${stats.activeCount}, Dismantled: ${stats.dismantled}` },
    { Metric: "Overall CA", Value: `${stats.overallCa.toFixed(2)}%`, Details: "Average Cell Availability" },
    { Metric: "C-1 AVB", Value: `${stats.c1Ca.toFixed(2)}%`, Details: `${stats.c1Sites} active sites` },
    { Metric: "C-6 AVB", Value: `${stats.c6Ca.toFixed(2)}%`, Details: `${stats.c6Sites} active sites` },
    { Metric: "Total Critical", Value: stats.criticalPgs + stats.criticalSb, Details: `PGS: ${stats.criticalPgs}, SB: ${stats.criticalSb}` },
  ];

  const categoryExport = stats.categoryData.map((c) => ({
    Category: c.category, "Total Sites": c.count, "Avg CA": `${c.avgCa.toFixed(2)}%`,
    "C-1 Sites": c.c1Count, "C-1 Avg CA": `${c.c1Avg.toFixed(2)}%`,
    "C-6 Sites": c.c6Count, "C-6 Avg CA": `${c.c6Avg.toFixed(2)}%`,
    Group: c.group, Threshold: `${c.threshold}%`, "Critical Sites": c.critical,
  }));

  const gridExport = stats.gridStats.map((g) => ({
    Grid: g.grid, "Total Sites": g.count, "Avg CA": `${g.avgCa.toFixed(2)}%`,
    "Critical Sites": g.critical, Status: g.avgCa >= 98 ? "Healthy" : "Critical",
  }));

  const worst10Export = stats.worst10.map((s, i) => ({
    Rank: i + 1, "Site ID": s.siteName, Grid: s.grid, Region: s.subRegion,
    Category: s.revenueCategory, "Current CA": `${s.currentAvb.toFixed(2)}%`,
    "Monthly CA": s.monthlyAvb ? `${s.monthlyAvb.toFixed(2)}%` : "-",
    Group: PGS_GROUP.includes(s.revenueCategory) ? "PGS" : "SB",
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1600px] mx-auto space-y-6">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Overall Summary</h2>
            <p className="text-slate-400">Comprehensive overview of {stats.totalSites} sites across C-1 and C-6 regions</p>
          </div>
          <ExportButton data={kpiExport} filename="overall_summary_kpis" sheetName="KPIs" label="Export KPIs" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={<Radio className="w-5 h-5" />} iconBg="bg-blue-500/20" iconColor="text-blue-400" value={stats.totalSites} label="Total Sites" />
        <KpiCard icon={<Activity className="w-5 h-5" />} iconBg="bg-emerald-500/20" iconColor="text-emerald-400" value={`${stats.overallCa.toFixed(2)}%`} label="Overall CA" />
        <KpiCard icon={<TrendingUp className="w-5 h-5" />} iconBg="bg-cyan-500/20" iconColor="text-cyan-400" value={`${stats.c1Ca.toFixed(2)}%`} label={`C-1 AVB (${stats.c1Sites} sites)`} />
        <KpiCard icon={<TrendingUp className="w-5 h-5" />} iconBg="bg-indigo-500/20" iconColor="text-indigo-400" value={`${stats.c6Ca.toFixed(2)}%`} label={`C-6 AVB (${stats.c6Sites} sites)`} />
        <KpiCard icon={<AlertTriangle className="w-5 h-5" />} iconBg="bg-red-500/20" iconColor="text-red-400" value={stats.criticalPgs + stats.criticalSb} label={`Total Critical (PGS: ${stats.criticalPgs}, SB: ${stats.criticalSb})`} />
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <Lightbulb className="w-6 h-6 text-amber-400" />
          <h3 className="text-xl font-bold text-white">AI-Powered Improvement Recommendations</h3>
        </div>
        <p className="text-sm text-slate-400 mb-5">Data-driven insights to enhance cell availability</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-indigo-500/30 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-indigo-300 mb-4 flex items-center gap-2"><MapPin className="w-5 h-5" />C-1 Region Recommendations</h4>
            <div className="space-y-3">
              {c1Recs.length > 0 ? c1Recs.map((rec, i) => <RecCard key={i} rec={rec} />) : (
                <div className="text-green-400 flex items-center gap-2"><span className="text-2xl">✅</span><span>C-1 region is performing optimally. No critical issues detected.</span></div>
              )}
            </div>
          </div>
          <div className="bg-slate-800/50 border border-indigo-500/30 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-indigo-300 mb-4 flex items-center gap-2"><MapPin className="w-5 h-5" />C-6 Region Recommendations</h4>
            <div className="space-y-3">
              {c6Recs.length > 0 ? c6Recs.map((rec, i) => <RecCard key={i} rec={rec} />) : (
                <div className="text-green-400 flex items-center gap-2"><span className="text-2xl">✅</span><span>C-6 region is performing optimally. No critical issues detected.</span></div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Revenue Category Detailed Breakdown</h3>
          <ExportButton data={categoryExport} filename="revenue_category_breakdown" sheetName="Categories" label="Export" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Category", "Total", "Avg CA", "C-1 Sites", "C-1 CA", "C-6 Sites", "C-6 CA", "Group", "Threshold", "Critical"].map((h) => (
                  <th key={h} className="text-center py-3 px-2 text-slate-400 font-medium first:text-left first:px-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.categoryData.map((c) => (
                <tr key={c.category} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-3 px-3 text-slate-200 font-medium">{c.category}</td>
                  <td className="py-3 px-2 text-center text-slate-300">{c.count}</td>
                  <td className={`py-3 px-2 text-center font-semibold ${c.avgCa >= c.threshold ? "text-emerald-400" : "text-red-400"}`}>{c.avgCa.toFixed(2)}%</td>
                  <td className="py-3 px-2 text-center text-slate-400">{c.c1Count}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{c.c1Count > 0 ? `${c.c1Avg.toFixed(2)}%` : "-"}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{c.c6Count}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{c.c6Count > 0 ? `${c.c6Avg.toFixed(2)}%` : "-"}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${c.group === "PGS" ? "bg-cyan-500/15 text-cyan-400" : "bg-slate-500/15 text-slate-400"}`}>{c.group}</span>
                  </td>
                  <td className="py-3 px-2 text-center text-slate-500">{c.threshold}%</td>
                  <td className="py-3 px-2 text-center">{c.critical > 0 ? <span className="text-red-400 font-semibold">{c.critical}</span> : <span className="text-slate-600">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Grid Performance Analysis</h3>
          <ExportButton data={gridExport} filename="grid_performance" sheetName="Grids" label="Export" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Grid</th>
                <th className="text-center py-3 px-3 text-slate-400 font-medium">Sites</th>
                <th className="text-center py-3 px-3 text-slate-400 font-medium">Avg CA %</th>
                <th className="text-center py-3 px-3 text-slate-400 font-medium">Critical</th>
                <th className="text-center py-3 px-3 text-slate-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.gridStats.map((g) => (
                <tr key={g.grid} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-3 px-3 text-slate-200 font-medium">{g.grid}</td>
                  <td className="py-3 px-3 text-center text-slate-300">{g.count}</td>
                  <td className={`py-3 px-3 text-center font-semibold ${g.avgCa >= 98 ? "text-emerald-400" : "text-red-400"}`}>{g.avgCa.toFixed(2)}%</td>
                  <td className="py-3 px-3 text-center">{g.critical > 0 ? <span className="text-red-400">{g.critical}</span> : <span className="text-slate-600">0</span>}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${g.avgCa >= 98 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{g.avgCa >= 98 ? "Healthy" : "Critical"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Worst 10 Sites by CA (Excluding Dismantled)</h3>
          <ExportButton data={worst10Export} filename="worst_10_sites" sheetName="Worst 10" label="Export" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-center py-3 px-2 text-slate-400 font-medium">Rank</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Site ID</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Grid</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Region</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Category</th>
                <th className="text-center py-3 px-3 text-slate-400 font-medium">Current CA</th>
                <th className="text-center py-3 px-3 text-slate-400 font-medium">Monthly CA</th>
                <th className="text-center py-3 px-3 text-slate-400 font-medium">Group</th>
              </tr>
            </thead>
            <tbody>
              {stats.worst10.map((s, i) => (
                <tr key={s.siteName + i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-3 px-2 text-center text-slate-500">{i + 1}</td>
                  <td className="py-3 px-3 text-cyan-300 font-mono">{s.siteName}</td>
                  <td className="py-3 px-3 text-slate-300">{s.grid}</td>
                  <td className="py-3 px-3 text-slate-400">{s.subRegion}</td>
                  <td className="py-3 px-3 text-slate-300">{s.revenueCategory}</td>
                  <td className={`py-3 px-3 text-center font-bold ${s.currentAvb < 95 ? "text-red-400" : "text-amber-400"}`}>{s.currentAvb.toFixed(2)}%</td>
                  <td className="py-3 px-3 text-center text-slate-400">{s.monthlyAvb ? `${s.monthlyAvb.toFixed(2)}%` : "-"}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${PGS_GROUP.includes(s.revenueCategory) ? "bg-cyan-500/15 text-cyan-400" : "bg-slate-500/15 text-slate-400"}`}>{PGS_GROUP.includes(s.revenueCategory) ? "PGS" : "SB"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   CATEGORY PAGE (Platinum+, PGS, SB, NPS, DG, Li-ion, Below Base, AGM)
   ============================================================ */
function CategoryPage({
  sites, title, description, threshold, color = "#06b6d4", filterFn,
}: {
  sites: SiteData[]; title: string; description: string; threshold: number; color?: string; filterFn: (site: SiteData) => boolean;
}) {
  const [expandedGrid, setExpandedGrid] = useState<string | null>(null);

  const filteredSites = useMemo(() => sites.filter(filterFn), [sites, filterFn]);

  const stats = useMemo(() => {
    const activeSites = filteredSites.filter((s) => s.currentAvb > 0);
    const total = filteredSites.length;
    const avgCa = activeSites.length > 0 ? activeSites.reduce((sum, s) => sum + s.currentAvb, 0) / activeSites.length : 0;
    const critical = activeSites.filter((s) => s.currentAvb < threshold).length;
    const healthy = activeSites.length - critical;

    const gridMap = new Map<string, SiteData[]>();
    filteredSites.forEach((site) => { const grid = site.grid || "Unknown"; if (!gridMap.has(grid)) gridMap.set(grid, []); gridMap.get(grid)!.push(site); });
    const gridStats = Array.from(gridMap.entries()).map(([grid, gridSites]) => {
      const active = gridSites.filter((s) => s.currentAvb > 0);
      return {
        grid, count: gridSites.length, activeCount: active.length,
        avgCa: active.length > 0 ? active.reduce((sum, s) => sum + s.currentAvb, 0) / active.length : 0,
        critical: active.filter((s) => s.currentAvb < threshold).length,
        sites: gridSites,
      };
    }).sort((a, b) => a.avgCa - b.avgCa);

    const worstGrid = gridStats.length > 0 ? gridStats[0] : null;
    const bestGrid = gridStats.length > 0 ? gridStats[gridStats.length - 1] : null;
    const worstSites = [...activeSites].sort((a, b) => a.currentAvb - b.currentAvb).slice(0, 10);

    return { total, avgCa, critical, healthy, gridStats, worstGrid, bestGrid, worstSites };
  }, [filteredSites, threshold]);

  const gridExport = stats.gridStats.map((g) => ({
    Grid: g.grid, "Total Sites": g.count, "Active Sites": g.activeCount,
    "Avg CA": `${g.avgCa.toFixed(2)}%`, "Critical Sites": g.critical,
    Status: g.avgCa >= threshold ? "Healthy" : "Critical",
  }));

  const worstExport = stats.worstSites.map((s, i) => ({
    Rank: i + 1, "Site ID": s.siteName, Grid: s.grid, Region: s.subRegion,
    Category: s.revenueCategory, "Current CA": `${s.currentAvb.toFixed(2)}%`,
    "Monthly CA": s.monthlyAvb ? `${s.monthlyAvb.toFixed(2)}%` : "-",
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1600px] mx-auto space-y-6">
      <div className="rounded-xl border p-6" style={{ background: `linear-gradient(to right, ${color}15, transparent)`, borderColor: `${color}40` }}>
        <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center"><MapPin className="w-5 h-5 text-blue-400" /></div>
            <div><div className="text-2xl font-bold text-white">{stats.total}</div><div className="text-xs text-slate-400">Total Sites</div></div>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-emerald-400" /></div>
            <div><div className="text-2xl font-bold text-white">{stats.avgCa.toFixed(2)}%</div><div className="text-xs text-slate-400">Average CA</div></div>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
            <div><div className="text-2xl font-bold text-white">{stats.critical}</div><div className="text-xs text-slate-400">Critical (CA &lt; {threshold}%)</div></div>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center"><Award className="w-5 h-5 text-green-400" /></div>
            <div><div className="text-2xl font-bold text-white">{stats.healthy}</div><div className="text-xs text-slate-400">Healthy Sites</div></div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Grid Performance Analysis</h3>
          <ExportButton data={gridExport} filename={`${title.toLowerCase().replace(/\s+/g, "_")}_grid_performance`} sheetName="Grid Performance" label="Export" />
        </div>
        {stats.worstGrid && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-red-400" /><span className="text-xs text-slate-400 uppercase tracking-wide">Worst Grid</span></div>
              <div className="text-lg font-bold text-white">{stats.worstGrid.grid}</div>
              <div className="text-sm text-red-400">{stats.worstGrid.avgCa.toFixed(2)}% avg CA · {stats.worstGrid.critical} critical</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-400" /><span className="text-xs text-slate-400 uppercase tracking-wide">Best Grid</span></div>
              <div className="text-lg font-bold text-white">{stats.bestGrid!.grid}</div>
              <div className="text-sm text-emerald-400">{stats.bestGrid!.avgCa.toFixed(2)}% avg CA · {stats.bestGrid!.critical} critical</div>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Grid", "Sites", "Active", "Avg CA %", "Critical", "Status", ""].map((h, i) => (
                  <th key={h} className={`${i === 0 ? "text-left px-3" : "text-center px-3"} py-3 text-slate-400 font-medium`}>{h}</th>
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
                      <td className={`py-3 px-3 text-center font-semibold ${g.avgCa >= threshold ? "text-emerald-400" : "text-red-400"}`}>{g.avgCa.toFixed(2)}%</td>
                      <td className="py-3 px-3 text-center">{g.critical > 0 ? <span className="text-red-400">{g.critical}</span> : <span className="text-slate-600">0</span>}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${g.avgCa >= threshold ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{g.avgCa >= threshold ? "Healthy" : "Critical"}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button onClick={() => setExpandedGrid(isExpanded ? null : g.grid)} className="text-slate-400 hover:text-white">
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
                                    <th key={h} className={`${i === 0 ? "text-left" : i === 2 ? "text-center" : "text-left"} py-2 px-2 text-slate-500`}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {g.sites.map((s) => (
                                  <tr key={s.siteName} className="border-b border-slate-800">
                                    <td className="py-1.5 px-2 text-cyan-300 font-mono">{s.siteName}</td>
                                    <td className="py-1.5 px-2 text-slate-300">{s.revenueCategory}</td>
                                    <td className={`py-1.5 px-2 text-center font-medium ${s.currentAvb < threshold ? "text-red-400" : "text-emerald-400"}`}>{s.currentAvb > 0 ? `${s.currentAvb.toFixed(2)}%` : "-"}</td>
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

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Worst 10 Sites by CA</h3>
          <ExportButton data={worstExport} filename={`${title.toLowerCase().replace(/\s+/g, "_")}_worst_10`} sheetName="Worst 10" label="Export" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Rank", "Site ID", "Grid", "Region", "Category", "Current CA", "Monthly CA"].map((h, i) => (
                  <th key={h} className={`${i === 0 ? "text-center px-2" : i === 1 || i === 2 || i === 3 || i === 4 ? "text-left px-3" : "text-center px-3"} py-3 text-slate-400 font-medium`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.worstSites.map((s, i) => (
                <tr key={s.siteName + i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-3 px-2 text-center text-slate-500">{i + 1}</td>
                  <td className="py-3 px-3 text-cyan-300 font-mono">{s.siteName}</td>
                  <td className="py-3 px-3 text-slate-300">{s.grid}</td>
                  <td className="py-3 px-3 text-slate-400">{s.subRegion}</td>
                  <td className="py-3 px-3"><CategoryBadge category={s.revenueCategory} /></td>
                  <td className={`py-3 px-3 text-center font-bold ${s.currentAvb < threshold ? "text-red-400" : "text-amber-400"}`}>{s.currentAvb.toFixed(2)}%</td>
                  <td className="py-3 px-3 text-center text-slate-400">{s.monthlyAvb ? `${s.monthlyAvb.toFixed(2)}%` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   EMPLOYEE PERFORMANCE
   ============================================================ */
interface CategoryStat { total: number; ca: number; critical: number; }
interface EmployeeStats {
  name: string; level: string; totalSites: number; overallCa: number;
  platinumPlus: CategoryStat; pgs: CategoryStat; sb: CategoryStat; dg: CategoryStat;
  liIon: { total: number; ca: number }; belowBase: { total: number; ca: number }; agm: CategoryStat;
  worstCategory?: string; suggestions?: { text: string; category: string }[]; sites: SiteData[];
}

const EMPLOYEE_LEVELS = [
  { id: "zongLead" as const, label: "Zone Lead", icon: Crown },
  { id: "msGtl" as const, label: "MS GTL", icon: Zap },
  { id: "clusterOwner" as const, label: "Cluster Owner", icon: Battery },
];

function calcCategory(catSites: SiteData[], threshold: number): CategoryStat {
  const total = catSites.length;
  const ca = total > 0 ? catSites.reduce((sum, s) => sum + s.currentAvb, 0) / total : 0;
  const critical = catSites.filter((s) => s.currentAvb < threshold).length;
  return { total, ca: parseFloat(ca.toFixed(2)), critical };
}

function calcEmployeeStats(employeeSites: SiteData[]): Omit<EmployeeStats, "name" | "level" | "worstCategory" | "suggestions" | "sites"> {
  const total = employeeSites.length;
  const overallCa = total > 0 ? employeeSites.reduce((sum, s) => sum + s.currentAvb, 0) / total : 0;
  return {
    totalSites: total,
    overallCa: parseFloat(overallCa.toFixed(2)),
    platinumPlus: calcCategory(employeeSites.filter((s) => s.revenueCategory === "Platinum +"), 98.5),
    pgs: calcCategory(employeeSites.filter((s) => PGS_GROUP.includes(s.revenueCategory)), 98.1),
    sb: calcCategory(employeeSites.filter((s) => SB_GROUP.includes(s.revenueCategory)), 95),
    dg: calcCategory(employeeSites.filter((s) => hasDG(s)), 98.5),
    liIon: {
      total: employeeSites.filter((s) => s.liIonInstalled?.toLowerCase() === "yes").length,
      ca: parseFloat((() => {
        const ls = employeeSites.filter((s) => s.liIonInstalled?.toLowerCase() === "yes");
        return ls.length > 0 ? ls.reduce((sum, s) => sum + s.currentAvb, 0) / ls.length : 0;
      })().toFixed(2)),
    },
    belowBase: {
      total: employeeSites.filter((s) => isBelowBase(s)).length,
      ca: parseFloat((() => {
        const bs = employeeSites.filter((s) => isBelowBase(s));
        return bs.length > 0 ? bs.reduce((sum, s) => sum + s.currentAvb, 0) / bs.length : 0;
      })().toFixed(2)),
    },
    agm: calcCategory(employeeSites.filter((s) => hasAGM(s)), 95),
  };
}

function generateEmpSuggestions(stats: Omit<EmployeeStats, "name" | "level" | "worstCategory" | "suggestions" | "sites">): { worstCategory: string; suggestions: { text: string; category: string }[] } {
  const issues: { category: string; severity: number; suggestion: string }[] = [];
  if (stats.platinumPlus.total > 0 && stats.platinumPlus.critical > 0) {
    const p = (stats.platinumPlus.critical / stats.platinumPlus.total) * 100;
    issues.push({ category: "Platinum+", severity: p, suggestion: `${stats.platinumPlus.critical} Platinum+ sites (${p.toFixed(1)}%) are below 98.5% CA. Prioritize these high-revenue sites for immediate intervention.` });
  }
  if (stats.pgs.total > 0 && stats.pgs.critical > 0) {
    const p = (stats.pgs.critical / stats.pgs.total) * 100;
    issues.push({ category: "PGS", severity: p, suggestion: `${stats.pgs.critical} PGS sites (${p.toFixed(1)}%) are below 98.1% CA. Focus on Platinum, Gold, and Strategic sites to improve revenue impact.` });
  }
  if (stats.dg.total > 0 && stats.dg.critical > 0) {
    const p = (stats.dg.critical / stats.dg.total) * 100;
    issues.push({ category: "DG Sites", severity: p * 1.5, suggestion: `${stats.dg.critical} DG sites (${p.toFixed(1)}%) are below 98.5% CA. Review diesel generator maintenance and fuel logistics.` });
  }
  if (stats.sb.total > 0 && stats.sb.critical > 0) {
    const p = (stats.sb.critical / stats.sb.total) * 100;
    issues.push({ category: "SB Sites", severity: p * 0.8, suggestion: `${stats.sb.critical} SB sites (${p.toFixed(1)}%) are below 95% CA. Schedule preventive maintenance for Silver and Bronze tier sites.` });
  }
  if (stats.belowBase.total > 0) {
    issues.push({ category: "Below Base", severity: 60, suggestion: `${stats.belowBase.total} sites are flagged Below Base. Investigate power infrastructure and battery health at these locations.` });
  }
  if (stats.agm.total > 0 && stats.agm.critical > 0) {
    const p = (stats.agm.critical / stats.agm.total) * 100;
    issues.push({ category: "AGM BB", severity: p, suggestion: `${stats.agm.critical} AGM sites (${p.toFixed(1)}%) are below 95% CA. Plan AGM-to-Li-ion battery upgrades.` });
  }
  issues.sort((a, b) => b.severity - a.severity);
  return { worstCategory: issues[0]?.category || "None", suggestions: issues.slice(0, 3).map((i) => ({ text: i.suggestion, category: i.category })) };
}

function StatCell({ stat, threshold }: { stat: { total: number; ca: number; critical?: number }; threshold: number }) {
  const caColor = stat.total === 0 ? "text-slate-600" : stat.ca >= threshold ? "text-emerald-400" : "text-red-400";
  return (
    <td className="px-3 py-2.5 text-center whitespace-nowrap">
      {stat.total > 0 ? (
        <div>
          <div className={`text-sm font-semibold ${caColor}`}>{stat.ca}%</div>
          <div className="text-[10px] text-slate-500">{stat.total} sites{stat.critical !== undefined && stat.critical > 0 && <span className="text-red-400 ml-1">• {stat.critical} crit</span>}</div>
        </div>
      ) : (<span className="text-slate-600">—</span>)}
    </td>
  );
}

function EmployeePerformance({ sites }: { sites: SiteData[] }) {
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<"zongLead" | "msGtl" | "clusterOwner">("zongLead");

  const activeSites = useMemo(() => sites.filter((s) => s.currentAvb > 0), [sites]);

  const employeeStats: EmployeeStats[] = useMemo(() => {
    const grouped: Record<string, SiteData[]> = {};
    for (const site of activeSites) {
      const name = (site[selectedLevel] || "Unassigned").trim();
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(site);
    }
    return Object.entries(grouped).map(([name, employeeSites]) => {
      const base = calcEmployeeStats(employeeSites);
      const { worstCategory, suggestions } = generateEmpSuggestions(base);
      return { name, level: selectedLevel, ...base, worstCategory, suggestions, sites: employeeSites };
    }).sort((a, b) => b.totalSites - a.totalSites);
  }, [activeSites, selectedLevel]);

  const employeeExportData = employeeStats.map((e) => ({
    Name: e.name, Level: e.level, "Total Sites": e.totalSites, "Overall CA%": e.overallCa,
    "Platinum+ Total": e.platinumPlus.total, "Platinum+ Critical": e.platinumPlus.critical,
    "PGS Critical": e.pgs.critical, "SB Critical": e.sb.critical, "DG Critical": e.dg.critical,
    "Below Base": e.belowBase.total, "Worst Category": e.worstCategory,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {EMPLOYEE_LEVELS.map((lvl) => {
            const Icon = lvl.icon;
            const isActive = selectedLevel === lvl.id;
            return (
              <button key={lvl.id} onClick={() => setSelectedLevel(lvl.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"}`}>
                <Icon className="w-4 h-4" />{lvl.label}
              </button>
            );
          })}
        </div>
        <ExportButton data={employeeExportData} filename="employee-performance" sheetName={selectedLevel} label="Export Stats" />
      </div>

      <div className="rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-4">
        <p className="text-sm text-slate-300">
          <span className="text-white font-semibold">{employeeStats.length}</span> {EMPLOYEE_LEVELS.find((l) => l.id === selectedLevel)?.label}s managing <span className="text-white font-semibold">{activeSites.length}</span> active sites. Click a row to see detailed breakdown and AI suggestions.
        </p>
      </div>

      <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-left">
                {["Name", "Sites", "Overall CA", "Platinum+", "PGS", "SB", "DG", "Li-ion", "Below Base", "AGM", "Worst", ""].map((h, i) => (
                  <th key={h} className={`px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${i === 0 ? "text-left sticky left-0 bg-slate-900/50" : i === 11 ? "w-8" : "text-center"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employeeStats.map((emp) => {
                const isExpanded = expandedEmployee === emp.name;
                const overallColor = emp.overallCa >= 98 ? "text-emerald-400" : emp.overallCa >= 95 ? "text-amber-400" : "text-red-400";
                return (
                  <Fragment key={emp.name}>
                    <tr onClick={() => setExpandedEmployee(isExpanded ? null : emp.name)} className="border-t border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors">
                      <td className="px-3 py-2.5 sticky left-0 bg-slate-800">
                        <div className="font-medium text-slate-100">{emp.name}</div>
                        <div className="text-[10px] text-slate-500">{emp.totalSites} sites</div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-300 font-semibold">{emp.totalSites}</td>
                      <td className={`px-3 py-2.5 text-center font-semibold ${overallColor}`}>{emp.overallCa}%</td>
                      <StatCell stat={emp.platinumPlus} threshold={98.5} />
                      <StatCell stat={emp.pgs} threshold={98.1} />
                      <StatCell stat={emp.sb} threshold={95} />
                      <StatCell stat={emp.dg} threshold={98.5} />
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {emp.liIon.total > 0 ? (<div><div className="text-sm font-semibold text-emerald-400">{emp.liIon.ca}%</div><div className="text-[10px] text-slate-500">{emp.liIon.total} sites</div></div>) : (<span className="text-slate-600">—</span>)}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {emp.belowBase.total > 0 ? (<div><div className="text-sm font-semibold text-amber-400">{emp.belowBase.ca}%</div><div className="text-[10px] text-slate-500">{emp.belowBase.total} sites</div></div>) : (<span className="text-slate-600">—</span>)}
                      </td>
                      <StatCell stat={emp.agm} threshold={95} />
                      <td className="px-3 py-2.5 text-center">
                        {emp.worstCategory && emp.worstCategory !== "None" ? (<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400"><AlertTriangle className="w-3 h-3" />{emp.worstCategory}</span>) : (<span className="text-slate-600">—</span>)}
                      </td>
                      <td className="px-3 py-2.5 text-center">{isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-900/40">
                        <td colSpan={12} className="px-6 py-4">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2 space-y-3">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-amber-400" />Performance Suggestions</h4>
                              {emp.suggestions && emp.suggestions.length > 0 ? emp.suggestions.map((s, i) => (
                                <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700">
                                  <TrendingDown className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                  <div><span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">{s.category}</span><p className="text-xs text-slate-300 mt-0.5">{s.text}</p></div>
                                </div>
                              )) : (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"><span className="text-xs text-emerald-400">✓ All categories performing within thresholds. No action needed.</span></div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Category Breakdown</h4>
                              {[
                                { label: "Platinum+", stat: emp.platinumPlus, threshold: 98.5 },
                                { label: "PGS", stat: emp.pgs, threshold: 98.1 },
                                { label: "SB", stat: emp.sb, threshold: 95 },
                                { label: "DG", stat: emp.dg, threshold: 98.5 },
                                { label: "AGM", stat: emp.agm, threshold: 95 },
                              ].map((c) => (
                                <div key={c.label} className="flex items-center justify-between text-xs">
                                  <span className="text-slate-400">{c.label}</span>
                                  <span className="flex items-center gap-2">
                                    <span className={`font-medium ${c.stat.total === 0 ? "text-slate-600" : c.stat.ca >= c.threshold ? "text-emerald-400" : "text-red-400"}`}>{c.stat.total > 0 ? `${c.stat.ca}%` : "—"}</span>
                                    {c.stat.critical !== undefined && c.stat.critical > 0 && <span className="text-red-400 text-[10px]">{c.stat.critical} crit</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mt-4">
                            <ExportButton data={emp.sites.map((s) => ({ "Site ID": s.siteName, Category: s.revenueCategory, "Sub-Region": s.subRegion, "CA%": s.currentAvb, DG: s.dgInstalled, "Li-ion": s.liIonInstalled, "BB Status": s.bbStatus || "" }))} filename={`${emp.name.replace(/\s+/g, "_")}-sites`} label={`Export ${emp.totalSites} Sites`} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {employeeStats.length === 0 && (<tr><td colSpan={12} className="px-3 py-12 text-center text-slate-500">No employee data available.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */
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
  { id: "hardware", label: "Hardware Issues", icon: Cpu },
  { id: "query", label: "Site Query", icon: Search },
  { id: "weather", label: "Weather Radar", icon: CloudRain },
];

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-cyan-400" />
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">Connecting to Google Sheets</h2>
        <p className="text-slate-400 text-sm mt-1">Fetching live site data…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6 px-6">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center"><AlertCircle className="w-8 h-8 text-red-400" /></div>
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold text-white">Couldn't load the sheet</h2>
        <p className="text-slate-400 text-sm mt-2 break-words">{message}</p>
      </div>
      <button onClick={onRetry} className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition-colors"><RefreshCw className="w-4 h-4" /> Try again</button>
    </div>
  );
}

function SectionBanner({ icon, title, subtitle, gradient }: { icon: React.ReactNode; title: string; subtitle: string; gradient: string }) {
  return (
    <div className={`rounded-xl bg-gradient-to-r ${gradient} border p-5`}>
      <div className="flex items-center gap-3">
        {icon}
        <div><h3 className="text-white font-bold text-lg">{title}</h3><p className="text-slate-300 text-sm">{subtitle}</p></div>
      </div>
    </div>
  );
}

import { Fragment } from "react";

export default function App() {
  const [rawData, setRawData] = useState<SheetPayload | null>(null);
  const [hardwareData, setHardwareData] = useState<SheetPayload | null>(null);
  const [appState, setAppState] = useState<"loading" | "dashboard" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState("overall");
  const [selectedRow, setSelectedRow] = useState<SiteData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadSheetData = async () => {
    setAppState("loading");
    setErrorMsg("");
    try {
      const [data, hwData] = await Promise.all([
        fetchGoogleSheet("1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk"),
        fetchGoogleSheet("1Bu4lneVsXvoHdiiJtJvzKSVq0MrTHQOqvH38w7MlNPk", "Hardware issues"),
      ]);
      setRawData(data);
      setHardwareData(hwData);
      setAppState("dashboard");
    } catch (error) {
      console.error(error);
      setErrorMsg(error instanceof Error ? error.message : "Unknown error");
      setAppState("error");
    }
  };

  useEffect(() => { loadSheetData(); }, []);

  const sites: SiteData[] = useMemo(() => (rawData ? rawData.rows.map(normalizeRow) : []), [rawData]);

  const platinumPlusRows = useMemo(() => sites.filter((s) => s.revenueCategory === "Platinum +"), [sites]);
  const pgsRows = useMemo(() => sites.filter((s) => PGS_GROUP.includes(s.revenueCategory)), [sites]);
  const sbRows = useMemo(() => sites.filter((s) => SB_GROUP.includes(s.revenueCategory)), [sites]);
  const npsRows = useMemo(() => sites.filter((s) => isNPSSite(s)), [sites]);
  const dgRows = useMemo(() => sites.filter((s) => hasDG(s)), [sites]);
  const liIonRows = useMemo(() => sites.filter((s) => s.liIonInstalled?.toUpperCase() === "YES"), [sites]);
  const belowBaseRows = useMemo(() => sites.filter((s) => isBelowBase(s)), [sites]);
  const agmRows = useMemo(() => sites.filter((s) => hasAGM(s)), [sites]);

  if (appState === "loading") return <LoadingScreen />;
  if (appState === "error") return <ErrorScreen message={errorMsg} onRetry={loadSheetData} />;

  const activeLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? "";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      <RainAlertWidget />
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-64 bg-slate-950 border-r border-slate-800 flex flex-col transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20"><Radio className="w-5 h-5 text-white" /></div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">C1 &amp; C6 Cell Avb Analysis</h1>
              <p className="text-[10px] text-slate-500">Google Sheets Connected</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"}`}>
                <Icon className="w-4 h-4 shrink-0" />{item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-xs text-slate-500">
            <Database className="w-3.5 h-3.5" />{rawData?.totalRows ?? 0} sites · {rawData?.headers.length ?? 0} cols
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white"><Menu className="w-5 h-5" /></button>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white truncate">{activeLabel}</h2>
                <p className="text-[11px] text-slate-500 truncate">{rawData?.sheetTitle} · Updated {new Date(rawData?.fetchedAt ?? "").toLocaleString()}</p>
              </div>
            </div>
            <button onClick={loadSheetData} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors shrink-0"><RefreshCw className="w-4 h-4" /> Refresh</button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <ErrorBoundary key={activeTab}>
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-6">
              {activeTab === "overall" && <OverallSummary sites={sites} />}

              {activeTab === "employees" && (
                <>
                  <SectionBanner icon={<Users className="w-6 h-6 text-indigo-400" />} title="Employee Performance Analysis" subtitle={`${sites.filter((s) => s.currentAvb > 0).length} active sites across Zone Leads, MS GTL, and Cluster Owners`} gradient="from-indigo-500/10 to-purple-500/10 border-indigo-500/20" />
                  <EmployeePerformance sites={sites} />
                </>
              )}

              {activeTab === "platinum-plus" && <CategoryPage sites={sites} title="Platinum+ Sites" description={`${platinumPlusRows.length} sites in the Platinum+ category`} threshold={98.5} filterFn={(s) => s.revenueCategory === "Platinum +"} />}

              {activeTab === "pgs" && <CategoryPage sites={sites} title="PGS Sites" description={`${pgsRows.length} high-priority revenue sites (Platinum, Gold, Strategic)`} threshold={98.1} filterFn={(s) => PGS_GROUP.includes(s.revenueCategory)} />}

              {activeTab === "sb" && <CategoryPage sites={sites} title="SB Sites" description={`${sbRows.length} standard-tier revenue sites (Silver, Bronze)`} threshold={95} filterFn={(s) => SB_GROUP.includes(s.revenueCategory)} />}

              {activeTab === "nps" && <CategoryPage sites={sites} title="NPS Sites (New Physical Sites)" description={`${npsRows.length} NPS Y26 sites`} threshold={95} filterFn={(s) => isNPSSite(s)} />}

              {activeTab === "dg" && <CategoryPage sites={sites} title="DG Sites (Diesel Generator Backup)" description={`${dgRows.length} sites with diesel generators`} threshold={99} filterFn={(s) => hasDG(s)} />}

              {activeTab === "li-ion" && <CategoryPage sites={sites} title="Li-ion Battery Backup Sites" description={`${liIonRows.length} sites with Li-ion batteries installed`} threshold={98} filterFn={(s) => s.liIonInstalled?.toUpperCase() === "YES"} />}

              {activeTab === "below-base" && <CategoryPage sites={sites} title="Below Base Sites" description={`${belowBaseRows.length} sites flagged below base threshold`} threshold={95} filterFn={(s) => isBelowBase(s)} />}

              {activeTab === "agm" && <CategoryPage sites={sites} title="AGM Battery Backup Sites" description={`${agmRows.length} sites with AGM battery banks`} threshold={95} filterFn={(s) => hasAGM(s)} />}

              {activeTab === "hardware" && hardwareData && <HardwareIssues data={hardwareData} />}

              {activeTab === "query" && <SiteQuery sites={sites} />}

              {activeTab === "weather" && <WeatherRadar />}
            </motion.div>
          </AnimatePresence>
          </ErrorBoundary>

          <footer className="text-center text-xs text-slate-600 py-4">
            Live data from Google Sheets · {rawData?.totalRows} records · {rawData?.headers.length} columns · C1 &amp; C6 Cell Avb Analysis
          </footer>
        </main>
      </div>

      <AnimatePresence>
        {selectedRow && <DetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
      </AnimatePresence>
    </div>
  );
}
