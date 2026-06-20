import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Radio,
  Cpu,
  Activity,
  Fuel,
  Battery,
  MapPin,
  TrendingDown,
} from "lucide-react";
import { type SheetPayload } from "../services/googleSheets";
import ExportButton from "./ExportButton";

interface HardwareIssuesProps {
  data: SheetPayload;
}

type Row = Record<string, string>;

function num(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.toString().replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function countBy(rows: Row[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = (r[key] ?? "-").trim() || "-";
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/* ============ KPI Card ============ */
function KpiCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  sub,
  delay,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
  sub?: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-slate-800 border border-slate-700 rounded-xl p-5"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-xs text-slate-400">{label}</div>
          {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
        </div>
      </div>
    </motion.div>
  );
}

/* ============ Bar Chart ============ */
function BarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map((e) => e[1]), 1);
  const palette = ["#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#10b981", "#3b82f6", "#ec4899"];

  return (
    <div className="space-y-2.5">
      {entries.map(([label, count], i) => {
        const pct = (count / max) * 100;
        const color = palette[i % palette.length];
        return (
          <div key={label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300 font-medium truncate pr-2">{label}</span>
              <span className="text-slate-500 tabular-nums whitespace-nowrap">{count}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-700/60 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: color }}
              />
            </div>
          </div>
        );
      })}
      {entries.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">No data</p>}
    </div>
  );
}

/* ============ Map Placeholder ============ */
function SitesMap({ rows }: { rows: Row[] }) {
  // Group by grid for a simple visual representation
  const gridCounts = useMemo(() => countBy(rows, "Grid"), [rows]);
  const grids = Object.entries(gridCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...grids.map((g) => g[1]), 1);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-cyan-400" />
        Hardware Issues Map
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {grids.map(([grid, count]) => {
          const intensity = count / maxCount;
          const bg = intensity > 0.66 ? "bg-red-500/20 border-red-500/40" : intensity > 0.33 ? "bg-amber-500/20 border-amber-500/40" : "bg-slate-700/40 border-slate-600";
          const textColor = intensity > 0.66 ? "text-red-400" : intensity > 0.33 ? "text-amber-400" : "text-slate-300";
          return (
            <div key={grid} className={`border ${bg} rounded-lg p-3 text-center`}>
              <div className={`text-lg font-bold ${textColor}`}>{count}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">{grid}</div>
            </div>
          );
        })}
        {grids.length === 0 && (
          <div className="col-span-full text-center text-slate-500 py-8">No location data available</div>
        )}
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500/40 border border-red-500/40" /> High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500/40 border border-amber-500/40" /> Medium
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-600 border border-slate-600" /> Low
        </span>
      </div>
    </div>
  );
}

/* ============ Main Component ============ */
export default function HardwareIssues({ data }: HardwareIssuesProps) {
  const rows = data.rows;
  const headers = data.headers;

  const stats = useMemo(() => {
    const total = rows.length;
    const c1 = rows.filter((r) => r["Sub-Region"] === "C-1").length;
    const c6 = rows.filter((r) => r["Sub-Region"] === "C-6").length;
    const dgOps = rows.filter((r) => (r["DG Status"] ?? "").toLowerCase() === "operational").length;
    const liIon = rows.filter((r) => (r["Li-ion Installed (Yes / No)"] ?? "").toUpperCase() === "YES").length;
    const agm = rows.filter((r) => /agm/i.test(r["AGM/LION"] ?? "")).length;

    // Technology mismatch: sites with large differences between 2G/3G/4G
    const mismatch = rows.filter((r) => {
      const g2 = num(r["2G"]);
      const g3 = num(r["3G"]);
      const g4 = num(r["4G"]);
      const diff23 = num(r["2G-3G"]);
      const diff24 = num(r["2G-4G"]);
      const diff34 = num(r["3G-4G"]);
      return diff23 > 10 || diff24 > 10 || diff34 > 10;
    }).length;

    // Worst CA: average of 2G, 3G, 4G
    const withCa = rows.filter((r) => num(r["2G"]) > 0 || num(r["3G"]) > 0 || num(r["4G"]) > 0);

    return { total, c1, c6, dgOps, liIon, agm, mismatch, withCa };
  }, [rows]);

  // Grid performance
  const gridStats = useMemo(() => {
    const gridMap = new Map<string, Row[]>();
    rows.forEach((r) => {
      const g = (r["Grid"] || "Unknown").trim();
      if (!gridMap.has(g)) gridMap.set(g, []);
      gridMap.get(g)!.push(r);
    });
    return Array.from(gridMap.entries())
      .map(([grid, gs]) => {
        const avgCa =
          gs.length > 0
            ? gs.reduce((s, r) => {
                const vals = [num(r["2G"]), num(r["3G"]), num(r["4G"])].filter((v) => v > 0);
                const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                return s + avg;
              }, 0) / gs.length
            : 0;
        const critical = gs.filter((r) => {
          const vals = [num(r["2G"]), num(r["3G"]), num(r["4G"])].filter((v) => v > 0);
          const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          return avg < 95;
        }).length;
        return { grid, count: gs.length, avgCa: parseFloat(avgCa.toFixed(2)), critical };
      })
      .sort((a, b) => a.avgCa - b.avgCa);
  }, [rows]);

  // Worst 10 sites by average CA
  const worst10 = useMemo(() => {
    return rows
      .map((r) => {
        const vals = [num(r["2G"]), num(r["3G"]), num(r["4G"])].filter((v) => v > 0);
        const avgCa = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        return { row: r, avgCa: parseFloat(avgCa.toFixed(2)) };
      })
      .filter((s) => s.avgCa > 0)
      .sort((a, b) => a.avgCa - b.avgCa)
      .slice(0, 10);
  }, [rows]);

  const gridExport = gridStats.map((g) => ({
    Grid: g.grid,
    "Total Sites": g.count,
    "Avg CA": `${g.avgCa.toFixed(2)}%`,
    "Critical Sites": g.critical,
    Status: g.avgCa >= 95 ? "Healthy" : "Critical",
  }));

  const worst10Export = worst10.map((s, i) => ({
    Rank: i + 1,
    "Site ID": s.row["Site ID"],
    Grid: s.row["Grid"],
    Region: s.row["Sub-Region"],
    Category: s.row["Revenue Category"],
    "2G CA": s.row["2G"],
    "3G CA": s.row["3G"],
    "4G CA": s.row["4G"],
    "Avg CA": `${s.avgCa.toFixed(2)}%`,
    Technology: s.row["Technology"],
  }));

  const techData = useMemo(() => countBy(rows, "Technology"), [rows]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1600px] mx-auto space-y-6"
    >
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-500/10 to-rose-500/10 border border-red-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <Cpu className="w-6 h-6 text-red-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">Sites with Hardware Issues</h2>
            <p className="text-slate-400 text-sm">
              {stats.total} sites with hardware issues · {stats.mismatch} with technology mismatch ·
              Data from "Hardware issues" sheet
            </p>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5" />}
          iconBg="bg-red-500/20"
          iconColor="text-red-400"
          value={stats.total}
          label="Total Issue Sites"
          sub={`${stats.c1} in C-1, ${stats.c6} in C-6`}
          delay={0}
        />
        <KpiCard
          icon={<TrendingDown className="w-5 h-5" />}
          iconBg="bg-amber-500/20"
          iconColor="text-amber-400"
          value={stats.mismatch}
          label="Tech Mismatch"
          sub=">10% CA difference"
          delay={0.08}
        />
        <KpiCard
          icon={<Fuel className="w-5 h-5" />}
          iconBg="bg-orange-500/20"
          iconColor="text-orange-400"
          value={stats.dgOps}
          label="DG Operational"
          sub="Diesel generator sites"
          delay={0.16}
        />
        <KpiCard
          icon={<Battery className="w-5 h-5" />}
          iconBg="bg-emerald-500/20"
          iconColor="text-emerald-400"
          value={stats.liIon}
          label="Li-ion Installed"
          sub={`${stats.agm} AGM sites`}
          delay={0.24}
        />
        <KpiCard
          icon={<Activity className="w-5 h-5" />}
          iconBg="bg-cyan-500/20"
          iconColor="text-cyan-400"
          value={stats.withCa.length}
          label="Sites with CA Data"
          sub="2G/3G/4G availability"
          delay={0.32}
        />
      </div>

      {/* Grid Performance */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Grid Performance</h3>
          <ExportButton data={gridExport} filename="hardware_grid_performance" sheetName="Grid Performance" label="Export" />
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
              {gridStats.map((g) => (
                <tr key={g.grid} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-3 px-3 text-slate-200 font-medium">{g.grid}</td>
                  <td className="py-3 px-3 text-center text-slate-300">{g.count}</td>
                  <td className={`py-3 px-3 text-center font-semibold ${g.avgCa >= 95 ? "text-emerald-400" : "text-red-400"}`}>
                    {g.avgCa.toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-center">
                    {g.critical > 0 ? <span className="text-red-400">{g.critical}</span> : <span className="text-slate-600">0</span>}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${g.avgCa >= 95 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                      {g.avgCa >= 95 ? "Healthy" : "Critical"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Worst 10 Sites */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Worst 10 Sites by CA</h3>
          <ExportButton data={worst10Export} filename="hardware_worst_10" sheetName="Worst 10" label="Export" />
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
                <th className="text-center py-3 px-2 text-slate-400 font-medium">2G</th>
                <th className="text-center py-3 px-2 text-slate-400 font-medium">3G</th>
                <th className="text-center py-3 px-2 text-slate-400 font-medium">4G</th>
                <th className="text-center py-3 px-3 text-slate-400 font-medium">Avg CA</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Technology</th>
              </tr>
            </thead>
            <tbody>
              {worst10.map((s, i) => (
                <tr key={s.row["Site ID"] + i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-3 px-2 text-center text-slate-500">{i + 1}</td>
                  <td className="py-3 px-3 text-cyan-300 font-mono">{s.row["Site ID"]}</td>
                  <td className="py-3 px-3 text-slate-300">{s.row["Grid"]}</td>
                  <td className="py-3 px-3 text-slate-400">{s.row["Sub-Region"]}</td>
                  <td className="py-3 px-3 text-slate-300">{s.row["Revenue Category"]}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{s.row["2G"] || "-"}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{s.row["3G"] || "-"}</td>
                  <td className="py-3 px-2 text-center text-slate-400">{s.row["4G"] || "-"}</td>
                  <td className={`py-3 px-3 text-center font-bold ${s.avgCa < 95 ? "text-red-400" : "text-amber-400"}`}>
                    {s.avgCa.toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-xs">{s.row["Technology"]}</td>
                </tr>
              ))}
              {worst10.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">No CA data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Technology Distribution</h3>
          <BarChart data={techData} />
        </div>
      </div>

      {/* Map */}
      <SitesMap rows={rows} />

      {/* Full Data Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">All Hardware Issue Sites</h3>
          <ExportButton
            data={rows}
            filename="hardware_issues_all"
            sheetName="Hardware Issues"
            label={`Export ${rows.length} Sites`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {["Site ID", "Category", "Region", "Grid", "2G", "3G", "4G", "DG", "Li-ion", "Owner"].map((h) => (
                  <th key={h} className="text-left py-3 px-3 text-slate-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((row, i) => (
                <tr key={row["Site ID"] + i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="py-2.5 px-3 text-cyan-300 font-mono whitespace-nowrap">{row["Site ID"]}</td>
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{row["Revenue Category"]}</td>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{row["Sub-Region"]}</td>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{row["Grid"]}</td>
                  <td className="py-2.5 px-3 text-center text-slate-400">{row["2G"] || "-"}</td>
                  <td className="py-2.5 px-3 text-center text-slate-400">{row["3G"] || "-"}</td>
                  <td className="py-2.5 px-3 text-center text-slate-400">{row["4G"] || "-"}</td>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{row["DG Status"]}</td>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{row["Li-ion Installed (Yes / No)"]}</td>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{row["Cluster Owner"]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 50 && (
          <p className="text-center text-xs text-slate-500 mt-3">
            Showing first 50 of {rows.length} sites. Export for full data.
          </p>
        )}
      </div>
    </motion.div>
  );
}
