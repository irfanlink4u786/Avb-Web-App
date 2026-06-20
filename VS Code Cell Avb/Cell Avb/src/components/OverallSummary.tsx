import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Radio,
  Activity,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  MapPin,
} from "lucide-react";
import { type SiteData, PGS_GROUP, CATEGORY_THRESHOLDS, hasDG, hasLiIon, hasAGM, isBelowBase } from "../types";
import ExportButton from "./ExportButton";

interface Rec {
  icon: string;
  priority: "HIGH" | "MEDIUM";
  text: string;
  impact: string;
}

/* ============ KPI Card (exact match to original) ============ */
function KpiCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
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

/* ============ AI Recommendation Card ============ */
function RecCard({ rec }: { rec: Rec }) {
  const priorityColor =
    rec.priority === "HIGH"
      ? "border-red-500/30 bg-red-500/5"
      : "border-amber-500/30 bg-amber-500/5";
  const priorityBadge =
    rec.priority === "HIGH"
      ? "bg-red-500/20 text-red-400"
      : "bg-amber-500/20 text-amber-400";
  return (
    <div className={`border ${priorityColor} rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{rec.icon}</span>
        <div className="flex-1 min-w-0">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priorityBadge}`}>
            {rec.priority}
          </span>
          <p className="text-sm text-slate-300 mt-1.5">{rec.text}</p>
          <p className="text-xs text-cyan-400 mt-1.5 font-medium">→ {rec.impact}</p>
        </div>
      </div>
    </div>
  );
}

/* ============ Region Recommendations Generator ============ */
function generateRegionRecs(regionSites: SiteData[], regionName: string): Rec[] {
  const recs: Rec[] = [];
  const active = regionSites.filter((s) => s.currentAvb > 0);

  // AGM sites
  const agmSites = active.filter(hasAGM);
  const agmCa =
    agmSites.length > 0
      ? agmSites.reduce((s, r) => s + r.currentAvb, 0) / agmSites.length
      : 0;

  // DG sites — only Operational/Non-Operational, NOT "Non DG"
  const dgSites = active.filter(hasDG);
  const dgCa =
    dgSites.length > 0
      ? dgSites.reduce((s, r) => s + r.currentAvb, 0) / dgSites.length
      : 0;

  // Li-ion sites
  const liIonSites = active.filter(hasLiIon);
  const liIonCa =
    liIonSites.length > 0
      ? liIonSites.reduce((s, r) => s + r.currentAvb, 0) / liIonSites.length
      : 0;

  // Below Base sites
  const belowBaseSites = active.filter(isBelowBase);
  const belowBaseCa =
    belowBaseSites.length > 0
      ? belowBaseSites.reduce((s, r) => s + r.currentAvb, 0) / belowBaseSites.length
      : 0;

  // Platinum+ sites
  const platPlusSites = active.filter((s) => s.revenueCategory === "Platinum +");
  const platPlusCa =
    platPlusSites.length > 0
      ? platPlusSites.reduce((s, r) => s + r.currentAvb, 0) / platPlusSites.length
      : 0;

  if (agmSites.length > 0 && agmCa < 95) {
    recs.push({
      icon: "⚠️",
      priority: "HIGH",
      text: `AGM BB Performance Degraded (${agmCa.toFixed(2)}%): ${agmSites.length} sites with AGM batteries showing degraded AVB. Recommend immediate battery replacement program to improve overall ${regionName} AVB.`,
      impact: `Potential improvement: +${(95 - agmCa).toFixed(2)}% for ${agmSites.length} sites`,
    });
  }

  // Only flag DG underperformance if there ARE actual DG sites
  const dgCritical = dgSites.filter((s) => s.currentAvb < 99);
  if (dgSites.length > 0 && dgCritical.length > 0 && dgCa < 99) {
    recs.push({
      icon: "🔧",
      priority: "MEDIUM",
      text: `DG Site Underperformance (${dgCa.toFixed(2)}%): ${dgCritical.length} of ${dgSites.length} DG-equipped sites below 99% threshold. Review DG maintenance schedules and fuel availability.`,
      impact: `Focus on ${dgCritical.length} critical DG sites`,
    });
  }

  if (liIonSites.length > 0 && liIonCa < 98) {
    recs.push({
      icon: "🔋",
      priority: "MEDIUM",
      text: `Li-ion Backup Issues (${liIonCa.toFixed(2)}%): ${liIonSites.length} Li-ion sites not meeting target. Verify battery health and charging systems.`,
      impact: `${liIonSites.filter((s) => s.currentAvb < 98).length} sites need attention`,
    });
  }

  if (belowBaseSites.length > 0) {
    recs.push({
      icon: "📉",
      priority: "HIGH",
      text: `Below Base Sites (${belowBaseCa.toFixed(2)}%): ${belowBaseSites.length} sites not meeting base values. Investigate root causes and implement corrective actions immediately.`,
      impact: `Critical: ${belowBaseSites.length} sites require intervention`,
    });
  }

  const platPlusCritical = platPlusSites.filter((s) => s.currentAvb < 98);
  if (platPlusSites.length > 0 && platPlusCa < 98) {
    recs.push({
      icon: "💎",
      priority: "HIGH",
      text: `Platinum+ Sites Below Target (${platPlusCa.toFixed(2)}%): ${platPlusCritical.length} premium sites below 98%. Prioritize these high-revenue sites for immediate action.`,
      impact: `Revenue impact: ${platPlusCritical.length} premium sites`,
    });
  }

  return recs;
}

/* ============ Main Component ============ */
export default function OverallSummary({ sites }: { sites: SiteData[] }) {
  const stats = useMemo(() => {
    const active = sites.filter((s) => s.currentAvb > 0);
    const dismantled = sites.length - active.length;
    const overallCa =
      active.length > 0
        ? active.reduce((s, r) => s + r.currentAvb, 0) / active.length
        : 0;

    const c1Sites = active.filter((s) => s.subRegion === "C-1");
    const c6Sites = active.filter((s) => s.subRegion === "C-6");
    const c1Ca =
      c1Sites.length > 0
        ? c1Sites.reduce((s, r) => s + r.currentAvb, 0) / c1Sites.length
        : 0;
    const c6Ca =
      c6Sites.length > 0
        ? c6Sites.reduce((s, r) => s + r.currentAvb, 0) / c6Sites.length
        : 0;

    // Category data with C-1/C-6 breakdown
    const categories = Array.from(
      new Set(sites.map((s) => s.revenueCategory).filter(Boolean))
    );
    const categoryData = categories
      .map((cat) => {
        const catSites = active.filter((s) => s.revenueCategory === cat);
        const avgCa =
          catSites.length > 0
            ? catSites.reduce((s, r) => s + r.currentAvb, 0) / catSites.length
            : 0;
        const c1Subset = catSites.filter((s) => s.subRegion === "C-1");
        const c6Subset = catSites.filter((s) => s.subRegion === "C-6");
        const threshold = CATEGORY_THRESHOLDS[cat] ?? 95;
        const critical = catSites.filter((s) => s.currentAvb < threshold).length;
        const group = PGS_GROUP.includes(cat) ? "PGS" : "SB";
        return {
          category: cat,
          count: catSites.length,
          avgCa: parseFloat(avgCa.toFixed(2)),
          c1Count: c1Subset.length,
          c1Avg: parseFloat(
            c1Subset.length > 0
              ? (c1Subset.reduce((s, r) => s + r.currentAvb, 0) / c1Subset.length).toFixed(2)
              : "0"
          ),
          c6Count: c6Subset.length,
          c6Avg: parseFloat(
            c6Subset.length > 0
              ? (c6Subset.reduce((s, r) => s + r.currentAvb, 0) / c6Subset.length).toFixed(2)
              : "0"
          ),
          critical,
          threshold,
          group,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Critical sites by group
    const pgsCritical = active
      .filter((s) => PGS_GROUP.includes(s.revenueCategory))
      .filter((s) => s.currentAvb < (CATEGORY_THRESHOLDS[s.revenueCategory] ?? 98.1))
      .sort((a, b) => a.currentAvb - b.currentAvb);
    const sbCritical = active
      .filter((s) => !PGS_GROUP.includes(s.revenueCategory))
      .filter((s) => s.currentAvb < 95)
      .sort((a, b) => a.currentAvb - b.currentAvb);

    // Grid stats
    const gridMap = new Map<string, SiteData[]>();
    active.forEach((s) => {
      const g = s.grid || "Unknown";
      if (!gridMap.has(g)) gridMap.set(g, []);
      gridMap.get(g)!.push(s);
    });
    const gridStats = Array.from(gridMap.entries())
      .map(([grid, gs]) => ({
        grid,
        count: gs.length,
        avgCa: parseFloat(
          (gs.reduce((s, r) => s + r.currentAvb, 0) / gs.length).toFixed(2)
        ),
        critical: gs.filter((s) => {
          const t = PGS_GROUP.includes(s.revenueCategory)
            ? CATEGORY_THRESHOLDS[s.revenueCategory] ?? 98.1
            : 95;
          return s.currentAvb < t;
        }).length,
      }))
      .sort((a, b) => a.avgCa - b.avgCa);

    // Worst 10
    const worst10 = active
      .sort((a, b) => a.currentAvb - b.currentAvb)
      .slice(0, 10);

    return {
      totalSites: sites.length,
      activeCount: active.length,
      dismantled,
      overallCa,
      c1Sites: c1Sites.length,
      c1Ca,
      c6Sites: c6Sites.length,
      c6Ca,
      categoryData,
      criticalPgs: pgsCritical.length,
      criticalSb: sbCritical.length,
      criticalPgsSites: pgsCritical,
      criticalSbSites: sbCritical,
      gridStats,
      worst10,
    };
  }, [sites]);

  const c1Recs = useMemo(
    () => generateRegionRecs(sites.filter((s) => s.subRegion === "C-1"), "C-1"),
    [sites]
  );
  const c6Recs = useMemo(
    () => generateRegionRecs(sites.filter((s) => s.subRegion === "C-6"), "C-6"),
    [sites]
  );

  /* Export data */
  const kpiExport = [
    { Metric: "Total Sites", Value: stats.totalSites, Details: `Active: ${stats.activeCount}, Dismantled: ${stats.dismantled}` },
    { Metric: "Overall CA", Value: `${stats.overallCa.toFixed(2)}%`, Details: "Average Cell Availability" },
    { Metric: "C-1 AVB", Value: `${stats.c1Ca.toFixed(2)}%`, Details: `${stats.c1Sites} active sites` },
    { Metric: "C-6 AVB", Value: `${stats.c6Ca.toFixed(2)}%`, Details: `${stats.c6Sites} active sites` },
    { Metric: "Total Critical", Value: stats.criticalPgs + stats.criticalSb, Details: `PGS: ${stats.criticalPgs}, SB: ${stats.criticalSb}` },
  ];

  const categoryExport = stats.categoryData.map((c) => ({
    Category: c.category,
    "Total Sites": c.count,
    "Avg CA": `${c.avgCa}%`,
    "C-1 Sites": c.c1Count,
    "C-1 Avg CA": `${c.c1Avg}%`,
    "C-6 Sites": c.c6Count,
    "C-6 Avg CA": `${c.c6Avg}%`,
    Group: c.group,
    Threshold: `${c.threshold}%`,
    "Critical Sites": c.critical,
  }));

  const gridExport = stats.gridStats.map((g) => ({
    Grid: g.grid,
    "Total Sites": g.count,
    "Avg CA": `${g.avgCa}%`,
    "Critical Sites": g.critical,
    Status: g.avgCa >= 98 ? "Healthy" : "Critical",
  }));

  const worst10Export = stats.worst10.map((s, i) => ({
    Rank: i + 1,
    "Site ID": s.siteName,
    Grid: s.grid,
    Region: s.subRegion,
    Category: s.revenueCategory,
    "Current CA": `${s.currentAvb.toFixed(2)}%`,
    "Monthly CA": s.monthlyAvb ? `${s.monthlyAvb.toFixed(2)}%` : "-",
    Group: PGS_GROUP.includes(s.revenueCategory) ? "PGS" : "SB",
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1600px] mx-auto space-y-6"
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Overall Summary</h2>
            <p className="text-slate-400">
              Comprehensive overview of {stats.totalSites} sites across C-1 and C-6 regions
            </p>
          </div>
          <ExportButton data={kpiExport} filename="overall_summary_kpis" sheetName="KPIs" label="Export KPIs" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={<Radio className="w-5 h-5" />} iconBg="bg-blue-500/20" iconColor="text-blue-400" value={stats.totalSites} label="Total Sites" />
        <KpiCard icon={<Activity className="w-5 h-5" />} iconBg="bg-emerald-500/20" iconColor="text-emerald-400" value={`${stats.overallCa.toFixed(2)}%`} label="Overall CA" />
        <KpiCard icon={<TrendingUp className="w-5 h-5" />} iconBg="bg-cyan-500/20" iconColor="text-cyan-400" value={`${stats.c1Ca.toFixed(2)}%`} label={`C-1 AVB (${stats.c1Sites} sites)`} />
        <KpiCard icon={<TrendingUp className="w-5 h-5" />} iconBg="bg-indigo-500/20" iconColor="text-indigo-400" value={`${stats.c6Ca.toFixed(2)}%`} label={`C-6 AVB (${stats.c6Sites} sites)`} />
        <KpiCard icon={<AlertTriangle className="w-5 h-5" />} iconBg="bg-red-500/20" iconColor="text-red-400" value={stats.criticalPgs + stats.criticalSb} label={`Total Critical (PGS: ${stats.criticalPgs}, SB: ${stats.criticalSb})`} />
      </div>

      {/* AI-Powered Improvement Recommendations */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <Lightbulb className="w-6 h-6 text-amber-400" />
          <h3 className="text-xl font-bold text-white">AI-Powered Improvement Recommendations</h3>
        </div>
        <p className="text-sm text-slate-400 mb-5">Data-driven insights to enhance cell availability</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-indigo-500/30 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-indigo-300 mb-4 flex items-center gap-2"><MapPin className="w-5 h-5" /> C-1 Region Recommendations</h4>
            <div className="space-y-3">
              {c1Recs.length > 0 ? c1Recs.map((rec, i) => <RecCard key={i} rec={rec} />) :
                <div className="text-green-400 flex items-center gap-2"><span className="text-2xl">✅</span><span>C-1 region is performing optimally.</span></div>}
            </div>
          </div>

          <div className="bg-slate-800/50 border border-indigo-500/30 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-indigo-300 mb-4 flex items-center gap-2"><MapPin className="w-5 h-5" /> C-6 Region Recommendations</h4>
            <div className="space-y-3">
              {c6Recs.length > 0 ? c6Recs.map((rec, i) => <RecCard key={i} rec={rec} />) :
                <div className="text-green-400 flex items-center gap-2"><span className="text-2xl">✅</span><span>C-6 region is performing optimally.</span></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Category Detailed Breakdown */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Revenue Category Detailed Breakdown</h3>
          <ExportButton data={categoryExport} filename="revenue_category_breakdown" sheetName="Categories" label="Export" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700">
              <th className="text-left py-3 px-3 text-slate-400 font-medium">Category</th>
              <th className="text-center py-3 px-2 text-slate-400 font-medium">Total</th>
              <th className="text-center py-3 px-2 text-slate-400 font-medium">Avg CA</th>
              <th className="text-center py-3 px-2 text-slate-400 font-medium">C-1 Sites</th>
              <th className="text-center py-3 px-2 text-slate-400 font-medium">C-1 CA</th>
              <th className="text-center py-3 px-2 text-slate-400 font-medium">C-6 Sites</th>
              <th className="text-center py-3 px-2 text-slate-400 font-medium">C-6 CA</th>
              <th className="text-center py-3 px-2 text-slate-400 font-medium">Group</th>
              <th className="text-center py-3 px-2 text-slate-400 font-medium">Threshold</th>
              <th className="text-center py-3 px-2 text-slate-400 font-medium">Critical</th>
            </tr></thead>
            <tbody>
              {stats.categoryData.map((c) => (
                <tr key={c.category} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-3 px-3 text-slate-200 font-medium">{c.category}</td>
                  <td className="py-3 px-2 text-center text-slate-300">{c.count}</td>
                  <td className={`py-3 px-2 text-center font-semibold ${c.avgCa >= c.threshold ? "text-emerald-400" : "text-red-400"}`}>{c.avgCa}%</td>
                  <td className="py-3 px-2 text-center text-slate-400">{c.c1Count}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{c.c1Count > 0 ? `${c.c1Avg}%` : "-"}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{c.c6Count}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{c.c6Count > 0 ? `${c.c6Avg}%` : "-"}</td>
                  <td className="py-3 px-2 text-center"><span className={`text-xs px-2 py-0.5 rounded ${c.group === "PGS" ? "bg-cyan-500/15 text-cyan-400" : "bg-slate-500/15 text-slate-400"}`}>{c.group}</span></td>
                  <td className="py-3 px-2 text-center text-slate-500">{c.threshold}%</td>
                  <td className="py-3 px-2 text-center">{c.critical > 0 ? <span className="text-red-400 font-semibold">{c.critical}</span> : <span className="text-slate-600">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid Performance Analysis */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Grid Performance Analysis</h3>
          <ExportButton data={gridExport} filename="grid_performance" sheetName="Grids" label="Export" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700">
              <th className="text-left py-3 px-3 text-slate-400 font-medium">Grid</th>
              <th className="text-center py-3 px-3 text-slate-400 font-medium">Sites</th>
              <th className="text-center py-3 px-3 text-slate-400 font-medium">Avg CA %</th>
              <th className="text-center py-3 px-3 text-slate-400 font-medium">Critical</th>
              <th className="text-center py-3 px-3 text-slate-400 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {stats.gridStats.map((g) => (
                <tr key={g.grid} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-3 px-3 text-slate-200 font-medium">{g.grid}</td>
                  <td className="py-3 px-3 text-center text-slate-300">{g.count}</td>
                  <td className={`py-3 px-3 text-center font-semibold ${g.avgCa >= 98 ? "text-emerald-400" : "text-red-400"}`}>{g.avgCa}%</td>
                  <td className="py-3 px-3 text-center">{g.critical > 0 ? <span className="text-red-400">{g.critical}</span> : <span className="text-slate-600">0</span>}</td>
                  <td className="py-3 px-3 text-center"><span className={`text-xs px-2 py-0.5 rounded ${g.avgCa >= 98 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>{g.avgCa >= 98 ? "Healthy" : "Critical"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Worst 10 Sites */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Worst 10 Sites by CA (Excluding Dismantled)</h3>
          <ExportButton data={worst10Export} filename="worst_10_sites" sheetName="Worst 10" label="Export" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700">
              <th className="text-center py-3 px-2 text-slate-400 font-medium">Rank</th>
              <th className="text-left py-3 px-3 text-slate-400 font-medium">Site ID</th>
              <th className="text-left py-3 px-3 text-slate-400 font-medium">Grid</th>
              <th className="text-left py-3 px-3 text-slate-400 font-medium">Region</th>
              <th className="text-left py-3 px-3 text-slate-400 font-medium">Category</th>
              <th className="text-center py-3 px-3 text-slate-400 font-medium">Current CA</th>
              <th className="text-center py-3 px-3 text-slate-400 font-medium">Monthly CA</th>
              <th className="text-center py-3 px-3 text-slate-400 font-medium">Group</th>
            </tr></thead>
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
                  <td className="py-3 px-3 text-center"><span className={`text-xs px-2 py-0.5 rounded ${PGS_GROUP.includes(s.revenueCategory) ? "bg-cyan-500/15 text-cyan-400" : "bg-slate-500/15 text-slate-400"}`}>{PGS_GROUP.includes(s.revenueCategory) ? "PGS" : "SB"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
