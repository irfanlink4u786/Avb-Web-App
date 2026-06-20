import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Radio,
  MapPin,
  Fuel,
  Battery,
  Share2,
  Building2,
  Network,
  AlertTriangle,
  TrendingUp,
  Database,
  X,
} from "lucide-react";
import { type SiteData, CATEGORY_COLORS, isDgSite } from "../types";
import ExportButton from "./ExportButton";

interface SiteQueryProps {
  sites: SiteData[];
}

/* ============ Site Info Card ============ */
function SiteInfoCard({ site }: { site: SiteData }) {
  const fields: { label: string; value: string | number | undefined; icon?: React.ReactNode }[] = [
    { label: "Site ID", value: site.siteName, icon: <Radio className="w-3.5 h-3.5" /> },
    { label: "Revenue Category", value: site.revenueCategory, icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { label: "Group", value: site.revenueCategory ? (["Platinum", "Platinum +", "Gold", "Strategic"].includes(site.revenueCategory) ? "PGS" : "SB") : undefined },
    { label: "Site Terrain", value: site.terrain, icon: <MapPin className="w-3.5 h-3.5" /> },
    { label: "SG", value: site.grid },
    { label: "Technology", value: site.technology, icon: <Network className="w-3.5 h-3.5" /> },
    { label: "Sub-Region", value: site.subRegion, icon: <MapPin className="w-3.5 h-3.5" /> },
    { label: "Sharing Status", value: site.sharingStatus, icon: <Share2 className="w-3.5 h-3.5" /> },
    { label: "OMO Name", value: site.sharingStatus },
    { label: "OMO ID", value: site.sharingStatus },
    { label: "OMO Power Status", value: site.sharingStatus },
    { label: "Indoor / Outdoor", value: site.indoorOutdoor, icon: <Building2 className="w-3.5 h-3.5" /> },
    { label: "DG Status", value: site.dgInstalled, icon: <Fuel className="w-3.5 h-3.5" /> },
    { label: "DG Rating", value: site.dgRating },
    { label: "GF/RT", value: site.grid },
    { label: "Cluster Owner", value: site.clusterOwner },
    { label: "MS GTL", value: site.msGtl },
    { label: "Zone Lead", value: site.zongLead },
    { label: "Li-ion Installed", value: site.liIonInstalled, icon: <Battery className="w-3.5 h-3.5" /> },
    { label: "Li-ion Capacity", value: site.liIonCapacity ? `${site.liIonCapacity} Ah` : undefined },
    { label: "AGM/LION", value: site.agmBb },
    { label: "BB Status", value: site.bbStatus },
    { label: "Li Addition Date", value: site.belowBase },
    { label: "Li-Swap Date", value: site.belowBase },
    { label: "HUB/Single", value: site.hubSingle },
    { label: "No of dependent sites", value: site.dependentSites },
    { label: "Grid", value: site.grid },
  ];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-4 h-4 text-cyan-400" />
        <h3 className="text-white font-semibold text-sm">Site Information (Columns A–AA)</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {fields.map((f) => (
          <div key={f.label} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/50">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
              {f.icon}
              {f.label}
            </div>
            <div className="text-sm text-slate-100 font-medium truncate">
              {f.value || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ AVB vs LS Chart ============ */
function AvbLsChart({ site }: { site: SiteData }) {
  const avbData = site.dailyAvb || {};
  const lsData = site.dailyLs || {};

  const dates = useMemo(() => {
    const allDates = new Set([...Object.keys(avbData), ...Object.keys(lsData)]);
    return Array.from(allDates).sort((a, b) => {
      const [da, ma, ya] = a.split("-");
      const [db, mb, yb] = b.split("-");
      const dateA = new Date(`${ya.length === 2 ? "20" + ya : ya}-${ma}-${da}`);
      const dateB = new Date(`${yb.length === 2 ? "20" + yb : yb}-${mb}-${db}`);
      return dateA.getTime() - dateB.getTime();
    });
  }, [avbData, lsData]);

  if (dates.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-2">Daily AVB vs Load Shedding Trend</h3>
        <p className="text-slate-500 text-sm py-8 text-center">No daily data available for this site.</p>
      </div>
    );
  }

  const maxAvb = 100;
  const maxLs = Math.max(...dates.map((d) => lsData[d] || 0), 1);

  // Chart dimensions
  const chartWidth = Math.max(dates.length * 36, 600);
  const chartHeight = 320;
  const padding = { top: 30, right: 50, bottom: 60, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const barWidth = Math.max((innerWidth / dates.length) * 0.6, 4);
  const barGap = innerWidth / dates.length;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-white font-semibold text-sm">Daily AVB vs Load Shedding Trend</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-cyan-500" />
            <span className="text-slate-400">AVB % (Bar)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-400" />
            <span className="text-slate-400">Load Shedding hrs (Line)</span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight} className="min-w-full">
          {/* Y-axis grid lines (AVB %) */}
          {[0, 25, 50, 75, 100].map((val) => {
            const y = padding.top + innerHeight - (val / maxAvb) * innerHeight;
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text x={padding.left - 8} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end">
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Right Y-axis labels (LS hours) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + innerHeight - ratio * innerHeight;
            const lsVal = (ratio * maxLs).toFixed(1);
            return (
              <text
                key={ratio}
                x={chartWidth - padding.right + 8}
                y={y + 4}
                fill="#f59e0b"
                fontSize="10"
                textAnchor="start"
              >
                {lsVal}h
              </text>
            );
          })}

          {/* AVB Bars */}
          {dates.map((date, i) => {
            const avb = avbData[date] || 0;
            const barH = (avb / maxAvb) * innerHeight;
            const x = padding.left + i * barGap + (barGap - barWidth) / 2;
            const y = padding.top + innerHeight - barH;
            const color = avb >= 98 ? "#06b6d4" : avb >= 95 ? "#f59e0b" : "#ef4444";
            return (
              <g key={`bar-${date}`}>
                <rect x={x} y={y} width={barWidth} height={barH} fill={color} rx="2" opacity="0.85" />
                {avb > 0 && avb < 95 && (
                  <text x={x + barWidth / 2} y={y - 4} fill="#ef4444" fontSize="9" textAnchor="middle" fontWeight="bold">
                    {avb.toFixed(0)}
                  </text>
                )}
              </g>
            );
          })}

          {/* LS Line */}
          <polyline
            points={dates
              .map((date, i) => {
                const ls = lsData[date] || 0;
                const x = padding.left + i * barGap + barGap / 2;
                const y = padding.top + innerHeight - (ls / maxLs) * innerHeight;
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* LS Points */}
          {dates.map((date, i) => {
            const ls = lsData[date] || 0;
            if (ls === 0) return null;
            const x = padding.left + i * barGap + barGap / 2;
            const y = padding.top + innerHeight - (ls / maxLs) * innerHeight;
            return <circle key={`ls-${date}`} cx={x} cy={y} r="3" fill="#f59e0b" stroke="#0f172a" strokeWidth="1" />;
          })}

          {/* X-axis labels (dates) */}
          {dates.map((date, i) => {
            const x = padding.left + i * barGap + barGap / 2;
            const dayLabel = date.split("-")[0];
            // Show every other label to avoid crowding
            if (dates.length > 15 && i % 2 !== 0) return null;
            return (
              <text
                key={`x-${date}`}
                x={x}
                y={chartHeight - padding.bottom + 16}
                fill="#64748b"
                fontSize="9"
                textAnchor="middle"
                transform={`rotate(-45, ${x}, ${chartHeight - padding.bottom + 16})`}
              >
                {dayLabel}
              </text>
            );
          })}

          {/* Axis titles */}
          <text x={padding.left - 35} y={padding.top - 10} fill="#06b6d4" fontSize="10" fontWeight="bold">
            AVB %
          </text>
          <text x={chartWidth - padding.right + 5} y={padding.top - 10} fill="#f59e0b" fontSize="10" fontWeight="bold">
            LS hrs
          </text>
        </svg>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Avg AVB</p>
          <p className="text-lg font-bold text-cyan-400">
            {dates.length > 0
              ? (dates.reduce((s, d) => s + (avbData[d] || 0), 0) / dates.filter((d) => avbData[d]).length).toFixed(2)
              : "0"}%
          </p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Min AVB</p>
          <p className="text-lg font-bold text-red-400">
            {dates.length > 0 ? Math.min(...dates.map((d) => avbData[d] || 100)).toFixed(2) : "0"}%
          </p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">LS Average (hrs)</p>
          <p className="text-lg font-bold text-amber-400">
            {(site.lsAverage || 0).toFixed(2)}h
          </p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Daily Avg LS</p>
          <p className="text-lg font-bold text-amber-400">
            {Object.keys(lsData).length > 0
              ? (Object.values(lsData).reduce((s, v) => s + v, 0) / Object.keys(lsData).length).toFixed(2)
              : "0.00"}h
          </p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">LS &gt; 3hr Incidents</p>
          <p className="text-lg font-bold text-red-400">
            {Object.values(lsData).filter((v) => v > 3).length}
          </p>
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Days Below 95%</p>
          <p className="text-lg font-bold text-red-400">
            {dates.filter((d) => (avbData[d] || 100) < 95).length}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============ Main SiteQuery Component ============ */
export default function SiteQuery({ sites }: SiteQueryProps) {
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
        s.clusterOwner?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [search, sites]);

  const handleSelect = (site: SiteData) => {
    setSelectedSite(site);
    setSearch(site.siteName);
  };

  const dailyExport = useMemo(() => {
    if (!selectedSite) return [];
    const avb = selectedSite.dailyAvb || {};
    const ls = selectedSite.dailyLs || {};
    const dates = Array.from(new Set([...Object.keys(avb), ...Object.keys(ls)])).sort();
    return dates.map((d) => ({
      Date: d,
      "AVB %": avb[d] ?? "",
      "Load Shedding (hrs)": ls[d] ?? "",
    }));
  }, [selectedSite]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1400px] mx-auto space-y-6"
    >
      {/* Search Section */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <Search className="w-6 h-6 text-cyan-400" />
          <div>
            <h3 className="text-white font-bold text-lg">Site Query</h3>
            <p className="text-slate-300 text-sm">
              Search for a site to view daily AVB vs Load Shedding trend
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
            placeholder="Search by Site ID, Grid, Sub-Region, or Cluster Owner…"
            className="w-full pl-9 pr-10 py-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-500 outline-none text-sm text-slate-100 placeholder:text-slate-600"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedSite(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {search.trim() && !selectedSite && (
          <div className="mt-2 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
            {searchResults.length > 0 ? (
              searchResults.map((site) => (
                <button
                  key={site.siteName}
                  onClick={() => handleSelect(site)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800 border-b border-slate-700/50 text-left"
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
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{
                      background: `${CATEGORY_COLORS[site.revenueCategory] || "#475569"}22`,
                      color: CATEGORY_COLORS[site.revenueCategory] || "#94a3b8",
                    }}
                  >
                    {site.currentAvb > 0 ? `${site.currentAvb.toFixed(1)}%` : "—"}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-slate-500 text-sm">No sites found.</p>
            )}
          </div>
        )}
      </div>

      {/* Selected Site Detail */}
      {selectedSite && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Site Info */}
          <SiteInfoCard site={selectedSite} />

          {/* AVB vs LS Chart */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-white font-bold text-lg">
              Site {selectedSite.siteName} — Daily Trend
            </h3>
            <ExportButton
              data={dailyExport}
              filename={`site_${selectedSite.siteName}_daily`}
              sheetName="Daily Data"
              label="Export Daily Data"
            />
          </div>
          <AvbLsChart site={selectedSite} />
        </motion.div>
      )}

      {!selectedSite && !search.trim() && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">
            Start typing a Site ID, Grid, Sub-Region, or Cluster Owner to search
          </p>
        </div>
      )}
    </motion.div>
  );
}
