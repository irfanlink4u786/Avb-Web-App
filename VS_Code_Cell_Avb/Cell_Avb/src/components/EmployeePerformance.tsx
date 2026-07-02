import { useMemo, useState, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Lightbulb,
  AlertTriangle,
  Crown,
  Zap,
  Battery,
  Eye,
  FileSpreadsheet,
  Filter,
  X,
} from "lucide-react";
import { SiteData, PGS_GROUP, SB_GROUP, hasDG, hasLiIon, hasAGM, isBelowBase } from "../types";
import ExportButton from "./ExportButton";

interface EmployeePerformanceProps {
  sites: SiteData[];
}

interface CategoryStat {
  total: number;
  ca: number;
  critical: number;
}

interface EmployeeStats {
  name: string;
  level: string;
  totalSites: number;
  overallCa: number;
  platinumPlus: CategoryStat;
  pgs: CategoryStat;
  sb: CategoryStat;
  dg: CategoryStat;
  liIon: { total: number; ca: number };
  belowBase: { total: number; ca: number };
  agm: CategoryStat;
  worstCategory?: string;
  suggestions?: { text: string; category: string }[];
  sites: SiteData[];
}

const LEVELS = [
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

function calculateStats(
  employeeSites: SiteData[]
): Omit<EmployeeStats, "name" | "level" | "worstCategory" | "suggestions" | "sites"> {
  const total = employeeSites.length;
  const overallCa =
    total > 0 ? employeeSites.reduce((sum, s) => sum + s.currentAvb, 0) / total : 0;

  const platinumPlusSites = employeeSites.filter(
    (s) => s.revenueCategory === "Platinum +"
  );
  const pgsSites = employeeSites.filter((s) =>
    PGS_GROUP.includes(s.revenueCategory)
  );
  const sbSites = employeeSites.filter((s) =>
    SB_GROUP.includes(s.revenueCategory)
  );
  const dgSites = employeeSites.filter(hasDG);
  const liIonSites = employeeSites.filter(hasLiIon);
  const belowBaseSites = employeeSites.filter(isBelowBase);
  const agmSites = employeeSites.filter(hasAGM);

  return {
    totalSites: total,
    overallCa: parseFloat(overallCa.toFixed(2)),
    platinumPlus: calcCategory(platinumPlusSites, 98.5),
    pgs: calcCategory(pgsSites, 98.1),
    sb: calcCategory(sbSites, 95),
    dg: calcCategory(dgSites, 99),
    liIon: {
      total: liIonSites.length,
      ca: parseFloat(
        (
          liIonSites.length > 0
            ? liIonSites.reduce((sum, s) => sum + s.currentAvb, 0) /
                liIonSites.length
            : 0
        ).toFixed(2)
      ),
    },
    belowBase: {
      total: belowBaseSites.length,
      ca: parseFloat(
        (
          belowBaseSites.length > 0
            ? belowBaseSites.reduce((sum, s) => sum + s.currentAvb, 0) /
                belowBaseSites.length
            : 0
        ).toFixed(2)
      ),
    },
    agm: calcCategory(agmSites, 95),
  };
}

function generateSuggestions(
  stats: Omit<
    EmployeeStats,
    "name" | "level" | "worstCategory" | "suggestions" | "sites"
  >
): { worstCategory: string; suggestions: { text: string; category: string }[] } {
  const issues: {
    category: string;
    severity: number;
    suggestion: string;
  }[] = [];

  if (stats.platinumPlus.total > 0 && stats.platinumPlus.critical > 0) {
    const criticalPct =
      (stats.platinumPlus.critical / stats.platinumPlus.total) * 100;
    issues.push({
      category: "Platinum+",
      severity: criticalPct,
      suggestion: `${stats.platinumPlus.critical} Platinum+ sites (${criticalPct.toFixed(1)}%) are below 98.5% CA. Prioritize these high-revenue sites for immediate intervention.`,
    });
  }

  if (stats.pgs.total > 0 && stats.pgs.critical > 0) {
    const criticalPct =
      (stats.pgs.critical / stats.pgs.total) * 100;
    issues.push({
      category: "PGS",
      severity: criticalPct,
      suggestion: `${stats.pgs.critical} PGS sites (${criticalPct.toFixed(1)}%) are below 98.1% CA. Focus on Platinum, Gold, and Strategic sites to improve revenue impact.`,
    });
  }

  if (stats.dg.total > 0 && stats.dg.critical > 0) {
    const criticalPct = (stats.dg.critical / stats.dg.total) * 100;
    issues.push({
      category: "DG Sites",
      severity: criticalPct * 1.5,
      suggestion: `${stats.dg.critical} DG sites (${criticalPct.toFixed(1)}%) are below 99% CA. Review diesel generator maintenance and fuel logistics.`,
    });
  }

  if (stats.sb.total > 0 && stats.sb.critical > 0) {
    const criticalPct = (stats.sb.critical / stats.sb.total) * 100;
    issues.push({
      category: "SB Sites",
      severity: criticalPct * 0.8,
      suggestion: `${stats.sb.critical} SB sites (${criticalPct.toFixed(1)}%) are below 95% CA. Schedule preventive maintenance for Silver and Bronze tier sites.`,
    });
  }

  if (stats.belowBase.total > 0) {
    issues.push({
      category: "Below Base",
      severity: 60,
      suggestion: `${stats.belowBase.total} sites are flagged Below Base. Investigate power infrastructure and battery health at these locations.`,
    });
  }

  if (stats.agm.total > 0 && stats.agm.critical > 0) {
    const criticalPct = (stats.agm.critical / stats.agm.total) * 100;
    issues.push({
      category: "AGM BB",
      severity: criticalPct,
      suggestion: `${stats.agm.critical} AGM sites (${criticalPct.toFixed(1)}%) are below 95% CA. Plan AGM-to-Li-ion battery upgrades.`,
    });
  }

  issues.sort((a, b) => b.severity - a.severity);

  return {
    worstCategory: issues[0]?.category || "None",
    suggestions: issues.slice(0, 3).map((i) => ({
      text: i.suggestion,
      category: i.category,
    })),
  };
}

function StatCell({
  stat,
  threshold,
}: {
  stat: { total: number; ca: number; critical?: number };
  threshold: number;
}) {
  const caColor =
    stat.total === 0
      ? "text-slate-600"
      : stat.ca >= threshold
      ? "text-emerald-400"
      : "text-red-400";

  return (
    <td className="px-3 py-2.5 text-center whitespace-nowrap">
      {stat.total > 0 ? (
        <div>
          <div className={`text-sm font-semibold ${caColor}`}>{stat.ca}%</div>
          <div className="text-[10px] text-slate-500">
            {stat.total} sites
            {stat.critical !== undefined && stat.critical > 0 && (
              <span className="text-red-400 ml-1">• {stat.critical} crit</span>
            )}
          </div>
        </div>
      ) : (
        <span className="text-slate-600">—</span>
      )}
    </td>
  );
}

export default function EmployeePerformance({ sites }: EmployeePerformanceProps) {
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<
    "zongLead" | "msGtl" | "clusterOwner"
  >("zongLead");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [showWorstSites, setShowWorstSites] = useState(false);

  const activeSites = useMemo(() => sites.filter((s) => s.currentAvb > 0), [sites]);

  const employeeStats: EmployeeStats[] = useMemo(() => {
    const grouped: Record<string, SiteData[]> = {};
    for (const site of activeSites) {
      const name = (site[selectedLevel] || "Unassigned").trim();
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(site);
    }

    return Object.entries(grouped)
      .map(([name, employeeSites]) => {
        const base = calculateStats(employeeSites);
        const { worstCategory, suggestions } = generateSuggestions(base);
        return {
          name,
          level: selectedLevel,
          ...base,
          worstCategory,
          suggestions,
          sites: employeeSites,
        };
      })
      .sort((a, b) => b.totalSites - a.totalSites);
  }, [activeSites, selectedLevel]);

  const employeeNames = useMemo(() => {
    return employeeStats.map((emp) => emp.name).sort();
  }, [employeeStats]);

  const filteredStats = useMemo(() => {
    if (selectedEmployee === "all") {
      return employeeStats;
    }
    return employeeStats.filter((emp) => emp.name === selectedEmployee);
  }, [employeeStats, selectedEmployee]);

  const worstSites = useMemo(() => {
    let allSites: SiteData[] = [];
    if (selectedEmployee === "all") {
      employeeStats.forEach((emp) => {
        allSites = [...allSites, ...emp.sites];
      });
    } else {
      const emp = employeeStats.find((e) => e.name === selectedEmployee);
      if (emp) {
        allSites = emp.sites;
      }
    }
    return [...allSites]
      .sort((a, b) => a.currentAvb - b.currentAvb)
      .slice(0, 20);
  }, [employeeStats, selectedEmployee]);

  const exportWorstSites = () => {
    const data = worstSites.map((site) => ({
      "Site ID": site.siteName,
      Category: site.revenueCategory,
      "Current CA%": site.currentAvb.toFixed(2),
      "Monthly CA%": site.monthlyAvb?.toFixed(2) || "-",
      "Sub-Region": site.subRegion,
      Grid: site.grid,
      DG: site.dgInstalled,
      "Li-ion": site.liIonInstalled,
      "BB Status": site.bbStatus || "-",
      Terrain: site.terrain,
      Technology: site.technology,
      "Cluster Owner": site.clusterOwner || "-",
      "MS GTL": site.msGtl || "-",
      "Zone Lead": site.zongLead || "-",
    }));

    const csv = [
      Object.keys(data[0] || {}).join(","),
      ...data.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worst_20_sites_${selectedEmployee}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportData = employeeStats.map((e) => ({
    Name: e.name,
    Level: e.level,
    "Total Sites": e.totalSites,
    "Overall CA%": e.overallCa,
    "Platinum+ Total": e.platinumPlus.total,
    "Platinum+ Critical": e.platinumPlus.critical,
    "PGS Critical": e.pgs.critical,
    "SB Critical": e.sb.critical,
    "DG Critical": e.dg.critical,
    "DG Total": e.dg.total,
    "Below Base": e.belowBase.total,
    "Worst Category": e.worstCategory,
  }));

  const exportEmployeeSites = (emp: EmployeeStats) => {
    const data = emp.sites.map((site) => ({
      "Site ID": site.siteName,
      Category: site.revenueCategory,
      "Current CA%": site.currentAvb.toFixed(2),
      "Monthly CA%": site.monthlyAvb?.toFixed(2) || "-",
      "Sub-Region": site.subRegion,
      Grid: site.grid,
      DG: site.dgInstalled,
      "Li-ion": site.liIonInstalled,
      "BB Status": site.bbStatus || "-",
      Terrain: site.terrain,
      Technology: site.technology,
      "Cluster Owner": site.clusterOwner || "-",
      "MS GTL": site.msGtl || "-",
      "Zone Lead": site.zongLead || "-",
    }));

    const csv = [
      Object.keys(data[0] || {}).join(","),
      ...data.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${emp.name.replace(/\s+/g, "_")}_sites.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Level selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {LEVELS.map((lvl) => {
            const Icon = lvl.icon;
            const isActive = selectedLevel === lvl.id;
            return (
              <button
                key={lvl.id}
                onClick={() => setSelectedLevel(lvl.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {lvl.label}
              </button>
            );
          })}
        </div>
        <ExportButton
          data={exportData}
          filename="employee-performance"
          sheetName={selectedLevel}
          label="Export Stats"
        />
      </div>

      {/* Employee Filter and Worst Sites Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">Filter:</span>
          </div>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 focus:border-cyan-500 outline-none min-w-[200px]"
          >
            <option value="all">All Employees ({employeeStats.length})</option>
            {employeeNames.map((name) => (
              <option key={name} value={name}>
                {name} ({employeeStats.find((e) => e.name === name)?.totalSites || 0} sites)
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
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWorstSites(!showWorstSites)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showWorstSites
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            {showWorstSites ? "Hide Worst 20" : "Show Worst 20 Sites"}
          </button>
          {showWorstSites && (
            <button
              onClick={exportWorstSites}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
            >
              <FileSpreadsheet className="w-3 h-3" /> Export
            </button>
          )}
        </div>
      </div>

      {/* Summary banner */}
      <div className="rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-4">
        <p className="text-sm text-slate-300">
          <span className="text-white font-semibold">{filteredStats.length}</span>{" "}
          {LEVELS.find((l) => l.id === selectedLevel)?.label}s managing{" "}
          <span className="text-white font-semibold">
            {filteredStats.reduce((sum, emp) => sum + emp.totalSites, 0)}
          </span> active sites.
          {selectedEmployee !== "all" && (
            <span className="ml-2 text-cyan-400">
              Filtered: {selectedEmployee}
            </span>
          )}
        </p>
      </div>

      {/* Worst 20 Sites View */}
      <AnimatePresence>
        {showWorstSites && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h4 className="text-lg font-semibold text-white">
                    Worst 20 Sites by CA%
                  </h4>
                  <span className="text-xs text-slate-500">
                    ({selectedEmployee === "all" ? "All Employees" : selectedEmployee})
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Sorted by CA% (Lowest to Highest)
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-red-500/30">
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">#</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">Site ID</th>
                      <th className="text-center py-2 px-3 text-slate-400 font-medium">CA%</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">Category</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">Sub-Region</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">Grid</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">DG</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">Li-ion</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">Cluster Owner</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">MS GTL</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">Zone Lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {worstSites.map((site, index) => (
                      <tr
                        key={site.siteName}
                        className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-2 px-3 text-slate-500">{index + 1}</td>
                        <td className="py-2 px-3 text-cyan-300 font-mono">{site.siteName}</td>
                        <td className={`py-2 px-3 text-center font-semibold ${
                          site.currentAvb < 95 ? "text-red-400" : "text-amber-400"
                        }`}>
                          {site.currentAvb.toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 text-slate-300">{site.revenueCategory}</td>
                        <td className="py-2 px-3 text-slate-300">{site.subRegion}</td>
                        <td className="py-2 px-3 text-slate-300">{site.grid}</td>
                        <td className="py-2 px-3 text-slate-400">{site.dgInstalled}</td>
                        <td className="py-2 px-3 text-slate-400">{site.liIonInstalled}</td>
                        <td className="py-2 px-3 text-slate-300">{site.clusterOwner || "-"}</td>
                        <td className="py-2 px-3 text-slate-300">{site.msGtl || "-"}</td>
                        <td className="py-2 px-3 text-slate-300">{site.zongLead || "-"}</td>
                      </tr>
                    ))}
                    {worstSites.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-500">
                          No sites available for the selected filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Performance table */}
      <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-left">
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sticky left-0 bg-slate-900/50">
                  Name
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  Sites
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  Overall CA
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  Platinum+
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  PGS
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  SB
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  DG
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  Li-ion
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  Below Base
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  AGM
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  Worst
                </th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.map((emp) => {
                const isExpanded = expandedEmployee === emp.name;
                const overallColor =
                  emp.overallCa >= 98
                    ? "text-emerald-400"
                    : emp.overallCa >= 95
                    ? "text-amber-400"
                    : "text-red-400";
                return (
                  <Fragment key={emp.name}>
                    <tr className="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-3 py-2.5 sticky left-0 bg-slate-800">
                        <div className="font-medium text-slate-100">{emp.name}</div>
                        <div className="text-[10px] text-slate-500">{emp.totalSites} sites</div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-300 font-semibold">
                        {emp.totalSites}
                      </td>
                      <td className={`px-3 py-2.5 text-center font-semibold ${overallColor}`}>
                        {emp.overallCa}%
                      </td>
                      <StatCell stat={emp.platinumPlus} threshold={98.5} />
                      <StatCell stat={emp.pgs} threshold={98.1} />
                      <StatCell stat={emp.sb} threshold={95} />
                      <StatCell stat={emp.dg} threshold={99} />
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {emp.liIon.total > 0 ? (
                          <div>
                            <div className="text-sm font-semibold text-emerald-400">
                              {emp.liIon.ca}%
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {emp.liIon.total} sites
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {emp.belowBase.total > 0 ? (
                          <div>
                            <div className="text-sm font-semibold text-amber-400">
                              {emp.belowBase.ca}%
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {emp.belowBase.total} sites
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <StatCell stat={emp.agm} threshold={95} />
                      <td className="px-3 py-2.5 text-center">
                        {emp.worstCategory && emp.worstCategory !== "None" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            {emp.worstCategory}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() =>
                              setExpandedEmployee(isExpanded ? null : emp.name)
                            }
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                            {isExpanded ? "Hide" : "View"}
                          </button>
                          <button
                            onClick={() => exportEmployeeSites(emp)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                          >
                            <FileSpreadsheet className="w-3 h-3" /> Export
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Detail Row with Flip In/Out Animation */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="bg-slate-900/40"
                        >
                          <td colSpan={12} className="px-6 py-4">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* Suggestions */}
                                <div className="lg:col-span-2 space-y-3">
                                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                                    Performance Suggestions
                                  </h4>
                                  {emp.suggestions && emp.suggestions.length > 0 ? (
                                    emp.suggestions.map((s, i) => (
                                      <div
                                        key={i}
                                        className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/60 border border-slate-700"
                                      >
                                        <TrendingDown className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">
                                            {s.category}
                                          </span>
                                          <p className="text-xs text-slate-300 mt-0.5">
                                            {s.text}
                                          </p>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                      <span className="text-xs text-emerald-400">
                                        ✓ All categories performing within thresholds.
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Category breakdown */}
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Category Breakdown
                                  </h4>
                                  {[
                                    { label: "Platinum+", stat: emp.platinumPlus, threshold: 98.5 },
                                    { label: "PGS", stat: emp.pgs, threshold: 98.1 },
                                    { label: "SB", stat: emp.sb, threshold: 95 },
                                    { label: "DG", stat: emp.dg, threshold: 99 },
                                    { label: "AGM", stat: emp.agm, threshold: 95 },
                                  ].map((c) => (
                                    <div
                                      key={c.label}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <span className="text-slate-400">{c.label}</span>
                                      <span className="flex items-center gap-2">
                                        <span
                                          className={`font-medium ${
                                            c.stat.total === 0
                                              ? "text-slate-600"
                                              : c.stat.ca >= c.threshold
                                              ? "text-emerald-400"
                                              : "text-red-400"
                                          }`}
                                        >
                                          {c.stat.total > 0 ? `${c.stat.ca}%` : "—"}
                                        </span>
                                        {c.stat.critical !== undefined &&
                                          c.stat.critical > 0 && (
                                            <span className="text-red-400 text-[10px]">
                                              {c.stat.critical} crit
                                            </span>
                                          )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Site list - expanded view with all sites */}
                              <div className="mt-4">
                                <h5 className="text-xs font-semibold text-slate-400 mb-2">
                                  All Sites ({emp.sites.length})
                                </h5>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-slate-700">
                                        <th className="text-left py-1.5 px-2 text-slate-500">Site ID</th>
                                        <th className="text-left py-1.5 px-2 text-slate-500">Category</th>
                                        <th className="text-center py-1.5 px-2 text-slate-500">CA%</th>
                                        <th className="text-left py-1.5 px-2 text-slate-500">Sub-Region</th>
                                        <th className="text-left py-1.5 px-2 text-slate-500">DG</th>
                                        <th className="text-left py-1.5 px-2 text-slate-500">Li-ion</th>
                                        <th className="text-left py-1.5 px-2 text-slate-500">BB Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {emp.sites
                                        .sort((a, b) => a.currentAvb - b.currentAvb)
                                        .map((site) => (
                                          <tr
                                            key={site.siteName}
                                            className="border-b border-slate-700/50 hover:bg-slate-800/50"
                                          >
                                            <td className="py-1.5 px-2 text-cyan-300 font-mono">
                                              {site.siteName}
                                            </td>
                                            <td className="py-1.5 px-2 text-slate-300">
                                              {site.revenueCategory}
                                            </td>
                                            <td
                                              className={`py-1.5 px-2 text-center font-semibold ${
                                                site.currentAvb < 95
                                                  ? "text-red-400"
                                                  : "text-emerald-400"
                                              }`}
                                            >
                                              {site.currentAvb.toFixed(2)}%
                                            </td>
                                            <td className="py-1.5 px-2 text-slate-300">
                                              {site.subRegion}
                                            </td>
                                            <td className="py-1.5 px-2 text-slate-400">
                                              {site.dgInstalled}
                                            </td>
                                            <td className="py-1.5 px-2 text-slate-400">
                                              {site.liIonInstalled}
                                            </td>
                                            <td className="py-1.5 px-2 text-slate-400">
                                              {site.bbStatus || "-"}
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
              {filteredStats.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-12 text-center text-slate-500">
                    No employee data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
