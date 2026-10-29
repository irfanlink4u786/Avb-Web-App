import { useMemo, useState } from "react";

import { motion } from "framer-motion";

import {

  Radio,

  Activity,

  TrendingUp,

  TrendingDown,

  AlertTriangle,

  

  MapPin,

  Crown,

  Zap,
  Battery,

  

  

  

  ChevronDown,

  ChevronUp,

  

  FileSpreadsheet,

} from "lucide-react";

import {

  type SiteData,

  PGS_GROUP,

  SB_GROUP,

  CATEGORY_THRESHOLDS,

  hasDG,

  

  

  

} from "../types";

import ExportButton from "./ExportButton";



// ============================================================

// INTERFACES

// ============================================================







interface CategoryKPI {

  label: string;

  icon: React.ReactNode;

  iconBg: string;

  iconColor: string;

  count: number;

  avgCa: number;

  threshold: number;

  critical: number;

}



interface RegionCategoryKPIs {

  region: string;

  totalSites: number;

  kpis: CategoryKPI[];

}



interface CategoryDetail {

  category: string;

  group: string;

  threshold: number;

  sites: SiteData[];

  avgCa: number;

  criticalCount: number;

}



interface GridDetail {

  grid: string;

  sites: SiteData[];

  count: number;

  avgCa: number;

  critical: number;

  threshold: number;

}



// ============================================================

// KPI CARD COMPONENT

// ============================================================



function KpiCard({ 

  icon, 

  iconBg, 

  iconColor, 

  value, 

  label, 

  subValue,

  trend 

}: {

  icon: React.ReactNode; 

  iconBg: string; 

  iconColor: string; 

  value: string | number; 

  label: string;

  subValue?: string;

  trend?: "up" | "down" | "neutral";

}) {

  return (

    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-600 transition-colors">

      <div className="flex items-center gap-3 mb-2">

        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>

          <span className={iconColor}>{icon}</span>

        </div>

        <div className="flex-1">

          <div className="flex items-center justify-between">

            <div className="text-2xl font-bold text-slate-950">{value}</div>

            {trend && (

              <span className={`text-xs ${trend === "up" ? "text-emerald-700" : trend === "down" ? "text-red-600" : "text-slate-600"}`}>

                {trend === "up" ? "↑" : trend === "down" ? "↓" : "—"}

              </span>

            )}

          </div>

          <div className="text-xs text-slate-600">{label}</div>

          {subValue && <div className="text-[10px] text-slate-600 mt-0.5">{subValue}</div>}

        </div>

      </div>

    </div>

  );

}



// ============================================================

// CATEGORY KPI CARD

// ============================================================



function CategoryKpiCard({ kpi }: { kpi: CategoryKPI }) {

  const isHealthy = kpi.avgCa >= kpi.threshold;

  return (

    <div className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-600 transition-colors">

      <div className="flex items-center gap-2 mb-2">

        <div className={`w-8 h-8 rounded-lg ${kpi.iconBg} flex items-center justify-center`}>

          <span className={kpi.iconColor}>{kpi.icon}</span>

        </div>

        <div className="flex-1">

          <div className="text-xs font-medium text-slate-600">{kpi.label}</div>

          <div className="text-lg font-bold text-slate-950">{kpi.avgCa.toFixed(2)}%</div>

        </div>

        <div className="text-right">

          <div className="text-sm font-semibold text-slate-700">{kpi.count}</div>

          <div className="text-[10px] text-slate-600">sites</div>

        </div>

      </div>

      <div className="flex items-center justify-between text-xs">

        <span className="text-slate-600">Threshold: {kpi.threshold}%</span>

        <span className={kpi.critical > 0 ? "text-red-600" : "text-emerald-700"}>

          {kpi.critical > 0 ? `${kpi.critical} critical` : "✓ All healthy"}

        </span>

      </div>

      <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">

        <div 

          className={`h-full rounded-full transition-all ${isHealthy ? "bg-emerald-500" : "bg-red-500"}`}

          style={{ width: `${Math.min(kpi.avgCa, 100)}%` }}

        />

      </div>

    </div>

  );

}



// ============================================================

// REGION CATEGORY SECTION

// ============================================================



function RegionCategorySection({ 

  regionData, 

  regionName 

}: { 

  regionData: RegionCategoryKPIs; 

  regionName: string;

}) {

  const [isExpanded, setIsExpanded] = useState(true);



  return (

    <div className="bg-white border border-slate-200 rounded-xl p-5">

      <button 

        onClick={() => setIsExpanded(!isExpanded)}

        className="w-full flex items-center justify-between mb-4 group"

      >

        <div className="flex items-center gap-3">

          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${

            regionName === "C-1" ? "bg-cyan-500/20" : "bg-indigo-500/20"

          }`}>

            <MapPin className={`w-4 h-4 ${regionName === "C-1" ? "text-cyan-700" : "text-indigo-400"}`} />

          </div>

          <h4 className="text-sm font-semibold text-slate-950">

            {regionName} Region

            <span className="text-xs font-normal text-slate-600 ml-2">

              ({regionData.totalSites} active sites)

            </span>

          </h4>

        </div>

        <div className="flex items-center gap-3">

          <span className="text-xs text-slate-600">

            Overall CA: {regionData.kpis.length > 0 ? 

              (regionData.kpis.reduce((sum, k) => sum + (k.avgCa * k.count), 0) / 

               regionData.kpis.reduce((sum, k) => sum + k.count, 0)).toFixed(2) : "0.00"}%

          </span>

          {isExpanded ? (

            <ChevronUp className="w-4 h-4 text-slate-600 group-hover:text-slate-950 transition-colors" />

          ) : (

            <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-slate-950 transition-colors" />

          )}

        </div>

      </button>



      {isExpanded && (

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

          {regionData.kpis.map((kpi) => (

            <CategoryKpiCard key={kpi.label} kpi={kpi} />

          ))}

        </div>

      )}

    </div>

  );

}



// ============================================================

// CATEGORY DETAIL ROW WITH INLINE DROPDOWN

// ============================================================



function CategoryDetailRow({ 

  category, 

  sites, 

  avgCa, 

  threshold, 

  criticalCount,

}: {

  category: string;

  sites: SiteData[];

  avgCa: number;

  threshold: number;

  criticalCount: number;

}) {

  const [isExpanded, setIsExpanded] = useState(false);

  const isHealthy = avgCa >= threshold;

  const criticalSites = sites.filter(s => s.currentAvb < threshold);

  const sortedSites = [...criticalSites].sort((a, b) => a.currentAvb - b.currentAvb);



  const exportCriticalSites = () => {

    const data = sortedSites.map((site) => ({

      "Site ID": site.siteName,

      "Category": site.revenueCategory,

      "Current CA%": site.currentAvb.toFixed(2),

      "Monthly CA%": site.monthlyAvb?.toFixed(2) || "-",

      "Sub-Region": site.subRegion,

      "Grid": site.grid,

      "DG": site.dgInstalled,

      "Li-ion": site.liIonInstalled,

      "BB Status": site.bbStatus || "-",

      "Terrain": site.terrain,

      "Technology": site.technology,

      "Cluster Owner": site.clusterOwner || "-",

      "MS GTL": site.msGtl || "-",

      "Zone Lead": site.zongLead || "-",

    }));



    const csv = [

      Object.keys(data[0] || {}).join(","),

      ...data.map(row => Object.values(row).join(","))

    ].join("\n");



    const blob = new Blob([csv], { type: "text/csv" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = `${category.replace(/\s+/g, "_")}_critical_sites.csv`;

    a.click();

    URL.revokeObjectURL(url);

  };



  return (

    <>

      <tr className="border-b border-slate-200 hover:bg-sky-50 transition-colors">

        <td className="py-3 px-3 text-slate-800 font-medium">{category}</td>

        <td className="py-3 px-3 text-center text-slate-700">{sites.length}</td>

        <td className={`py-3 px-3 text-center font-semibold ${isHealthy ? "text-emerald-700" : "text-red-600"}`}>

          {avgCa.toFixed(2)}%

        </td>

        <td className="py-3 px-3 text-center text-slate-600">{threshold}%</td>

        <td className="py-3 px-3 text-center">

          {criticalCount > 0 ? (

            <span className="text-red-600 font-semibold">{criticalCount}</span>

          ) : (

            <span className="text-slate-600">0</span>

          )}

        </td>

        <td className="py-3 px-3 text-center">

          {criticalCount > 0 && (

            <div className="flex items-center justify-center gap-2">

              <button

                onClick={() => setIsExpanded(!isExpanded)}

                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 transition-colors"

              >

                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}

                {isExpanded ? "Hide" : "View"}

              </button>

              <button

                onClick={exportCriticalSites}

                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 transition-colors"

              >

                <FileSpreadsheet className="w-3 h-3" /> Export

              </button>

            </div>

          )}

        </td>

      </tr>



      {isExpanded && criticalCount > 0 && (

        <tr>

          <td colSpan={6} className="px-0">

            <motion.div 

              initial={{ opacity: 0, height: 0 }}

              animate={{ opacity: 1, height: "auto" }}

              exit={{ opacity: 0, height: 0 }}

              transition={{ duration: 0.3 }}

              className="bg-slate-50 border-t border-slate-200"

            >

              <div className="p-4">

                <div className="flex items-center justify-between mb-3">

                  <h5 className="text-sm font-semibold text-slate-700">

                    Critical Sites - {category} ({sortedSites.length} sites)

                  </h5>

                  <span className="text-xs text-slate-600">

                    Sorted by CA% (Lowest to Highest)

                  </span>

                </div>



                <div className="overflow-x-auto">

                  <table className="w-full text-xs">

                    <thead>

                      <tr className="border-b border-slate-200">

                        <th className="text-left py-2 px-3 text-slate-600 font-medium">#</th>

                        <th className="text-left py-2 px-3 text-slate-600 font-medium">Site ID</th>

                        <th className="text-center py-2 px-3 text-slate-600 font-medium">CA%</th>

                        <th className="text-left py-2 px-3 text-slate-600 font-medium">Sub-Region</th>

                        <th className="text-left py-2 px-3 text-slate-600 font-medium">Grid</th>

                        <th className="text-left py-2 px-3 text-slate-600 font-medium">DG</th>

                        <th className="text-left py-2 px-3 text-slate-600 font-medium">Li-ion</th>

                        <th className="text-left py-2 px-3 text-slate-600 font-medium">BB Status</th>

                        <th className="text-left py-2 px-3 text-slate-600 font-medium">Cluster Owner</th>

                        <th className="text-left py-2 px-3 text-slate-600 font-medium">MS GTL</th>

                        <th className="text-left py-2 px-3 text-slate-600 font-medium">Zone Lead</th>

                      </tr>

                    </thead>

                    <tbody>

                      {sortedSites.map((site, index) => (

                        <tr 

                          key={site.siteName} 

                          className="border-b border-slate-200 hover:bg-sky-50 transition-colors"

                        >

                          <td className="py-2 px-3 text-slate-600">{index + 1}</td>

                          <td className="py-2 px-3 text-cyan-300 font-mono">{site.siteName}</td>

                          <td className={`py-2 px-3 text-center font-semibold ${

                            site.currentAvb < 95 ? "text-red-600" : "text-amber-700"

                          }`}>

                            {site.currentAvb.toFixed(2)}%

                          </td>

                          <td className="py-2 px-3 text-slate-700">{site.subRegion}</td>

                          <td className="py-2 px-3 text-slate-700">{site.grid}</td>

                          <td className="py-2 px-3 text-slate-600">{site.dgInstalled}</td>

                          <td className="py-2 px-3 text-slate-600">{site.liIonInstalled}</td>

                          <td className="py-2 px-3 text-slate-600">{site.bbStatus || "-"}</td>

                          <td className="py-2 px-3 text-slate-700">{site.clusterOwner || "-"}</td>

                          <td className="py-2 px-3 text-slate-700">{site.msGtl || "-"}</td>

                          <td className="py-2 px-3 text-slate-700">{site.zongLead || "-"}</td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              </div>

            </motion.div>

          </td>

        </tr>

      )}

    </>

  );

}



// ============================================================

// GRID DETAIL ROW WITH INLINE DROPDOWN

// ============================================================



function GridDetailRow({ grid, sites, avgCa }: { grid: string; sites: SiteData[]; avgCa: number }) {
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(() => [...sites].sort((a,b) => a.currentAvb-b.currentAvb), [sites]);
  const exportRows = rows.map(s => ({
    "Site ID": s.siteName, "Revenue Category": s.revenueCategory, "Sub-Region": s.subRegion,
    Grid: s.grid, "Current CA": `${s.currentAvb.toFixed(2)}%`,
    "Monthly CA": s.monthlyAvb == null ? "-" : `${s.monthlyAvb.toFixed(2)}%`,
    DG: s.dgInstalled, "Li-ion": s.liIonInstalled, "BB Status": s.bbStatus || "-",
    "Cluster Owner": s.clusterOwner || "-", "MPL GTL": s.msGtl || "-", "CMPAK GTL": s.zongLead || "-",
  }));
  return <>
    <tr className="border-b border-slate-200 hover:bg-sky-50">
      <td className="py-3 px-3 font-bold text-slate-900">{grid}</td>
      <td className="py-3 px-3 text-center font-semibold text-slate-800">{sites.length}</td>
      <td className={`py-3 px-3 text-center font-bold ${avgCa >= 98 ? "text-emerald-700" : "text-red-600"}`}>{avgCa.toFixed(2)}%</td>
      <td className="py-3 px-3 text-center"><div className="flex justify-center gap-2">
        <button type="button" onClick={() => setExpanded(!expanded)} className="rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-900">{expanded ? "Hide" : "View"}</button>
        <ExportButton data={exportRows} filename={`grid_${grid}_sites`} label="Export" />
      </div></td>
    </tr>
    {expanded && <tr><td colSpan={4} className="bg-slate-50 p-4"><div className="mb-2 font-bold text-slate-900">{grid} — All Sites ({rows.length})</div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-xs">
        <thead className="bg-slate-100"><tr>{["Site ID","Revenue Category","Sub-Region","Current CA","Monthly CA","DG","Li-ion","BB Status","Cluster Owner","MPL GTL","CMPAK GTL"].map(h=><th key={h} className="px-3 py-2 text-left text-slate-900">{h}</th>)}</tr></thead>
        <tbody>{rows.map(s=><tr key={s.siteName} className="border-b border-slate-200 text-slate-800">
          <td className="px-3 py-2 font-bold text-blue-800">{s.siteName}</td><td className="px-3 py-2">{s.revenueCategory}</td><td className="px-3 py-2">{s.subRegion}</td>
          <td className="px-3 py-2 font-bold">{s.currentAvb.toFixed(2)}%</td><td className="px-3 py-2">{s.monthlyAvb == null ? "-" : `${s.monthlyAvb.toFixed(2)}%`}</td>
          <td className="px-3 py-2">{s.dgInstalled}</td><td className="px-3 py-2">{s.liIonInstalled}</td><td className="px-3 py-2">{s.bbStatus || "-"}</td>
          <td className="px-3 py-2">{s.clusterOwner || "-"}</td><td className="px-3 py-2">{s.msGtl || "-"}</td><td className="px-3 py-2">{s.zongLead || "-"}</td>
        </tr>)}</tbody></table></div></td></tr>}
  </>;
}

export default function OverallSummary({ sites }: { sites: SiteData[] }) {

  const [viewMode, setViewMode] = useState<"overall" | "c1" | "c6">("overall");

  const [gridViewMode, setGridViewMode] = useState<"overall" | "c1" | "c6">("overall");



  const stats = useMemo(() => {

    const active = sites.filter((s) => s.currentAvb > 0);

    const dismantled = sites.length - active.length;

    const overallCa = active.length > 0 ? active.reduce((s, r) => s + r.currentAvb, 0) / active.length : 0;



    const c1Sites = active.filter((s) => s.subRegion === "C-1");

    const c6Sites = active.filter((s) => s.subRegion === "C-6");

    const c1Ca = c1Sites.length > 0 ? c1Sites.reduce((s, r) => s + r.currentAvb, 0) / c1Sites.length : 0;

    const c6Ca = c6Sites.length > 0 ? c6Sites.reduce((s, r) => s + r.currentAvb, 0) / c6Sites.length : 0;



    // Get category KPIs for a region

    const getCategoryKPIs = (regionSites: SiteData[]): CategoryKPI[] => {

      const categories = [

        {

          label: "Platinum+",

          icon: <Crown className="w-4 h-4" />,

          iconBg: "bg-amber-500/20",

          iconColor: "text-amber-700",

          filter: (s: SiteData) => s.revenueCategory === "Platinum +",

          threshold: 98.5,

        },

        {

          label: "PGS Sites",

          icon: <TrendingUp className="w-4 h-4" />,

          iconBg: "bg-cyan-500/20",

          iconColor: "text-cyan-700",

          filter: (s: SiteData) => PGS_GROUP.includes(s.revenueCategory),

          threshold: 98.1,

        },

        {

          label: "SB Sites",

          icon: <TrendingDown className="w-4 h-4" />,

          iconBg: "bg-slate-500/20",

          iconColor: "text-slate-600",

          filter: (s: SiteData) => SB_GROUP.includes(s.revenueCategory),

          threshold: 95,

        },

        {

          label: "DG Sites",

          icon: <Zap className="w-4 h-4" />,

          iconBg: "bg-orange-500/20",

          iconColor: "text-orange-400",

          filter: hasDG,

          threshold: 98.5,

        },

        {

          label: "Li-ion BB",

          icon: <Battery className="w-4 h-4" />,

          iconBg: "bg-emerald-500/20",

          iconColor: "text-emerald-700",

          filter: (s: SiteData) => s.liIonInstalled?.toUpperCase() === "YES",

          threshold: 98,

        },

      ];



      return categories.map((cat) => {

        const categorySites = regionSites.filter(cat.filter);

        const avgCa = categorySites.length > 0 

          ? categorySites.reduce((sum, s) => sum + s.currentAvb, 0) / categorySites.length 

          : 0;

        const critical = categorySites.filter((s) => s.currentAvb < cat.threshold).length;



        return {

          label: cat.label,

          icon: cat.icon,

          iconBg: cat.iconBg,

          iconColor: cat.iconColor,

          count: categorySites.length,

          avgCa: avgCa,

          threshold: cat.threshold,

          critical: critical,

        };

      });

    };



    // Get category details for the detailed breakdown

    const getCategoryDetails = (regionSites: SiteData[]): CategoryDetail[] => {

      const categories = Array.from(new Set(regionSites.map((s) => s.revenueCategory).filter(Boolean)));



      return categories.map((cat) => {

        const catSites = regionSites.filter((s) => s.revenueCategory === cat);

        const avgCa = catSites.length > 0 ? catSites.reduce((s, r) => s + r.currentAvb, 0) / catSites.length : 0;

        const threshold = CATEGORY_THRESHOLDS[cat] ?? 95;

        const criticalSites = catSites.filter((s) => s.currentAvb < threshold);



        return {

          category: cat,

          group: PGS_GROUP.includes(cat) ? "PGS" : "SB",

          threshold: threshold,

          sites: catSites,

          avgCa: avgCa,

          criticalCount: criticalSites.length,

        };

      }).sort((a, b) => a.avgCa - b.avgCa);

    };



    // Get grid details for the grid breakdown

    const getGridDetails = (regionSites: SiteData[]): GridDetail[] => {

      const gridMap = new Map<string, SiteData[]>();

      regionSites.forEach((s) => { 

        const g = s.grid || "Unknown"; 

        if (!gridMap.has(g)) gridMap.set(g, []); 

        gridMap.get(g)!.push(s); 

      });



      return Array.from(gridMap.entries()).map(([grid, gridSites]) => {

        const avgCa = gridSites.length > 0 

          ? gridSites.reduce((sum, s) => sum + s.currentAvb, 0) / gridSites.length 

          : 0;

        const threshold = 98; // Default threshold for grid health

        const critical = gridSites.filter((s) => {

          const t = PGS_GROUP.includes(s.revenueCategory) 

            ? CATEGORY_THRESHOLDS[s.revenueCategory] ?? 98.1 

            : 95;

          return s.currentAvb < t;

        }).length;



        return {

          grid,

          sites: gridSites,

          count: gridSites.length,

          avgCa: avgCa,

          critical: critical,

          threshold: threshold,

        };

      }).sort((a, b) => a.avgCa - b.avgCa);

    };



    const c1CategoryKPIs = getCategoryKPIs(c1Sites);

    const c6CategoryKPIs = getCategoryKPIs(c6Sites);



    let categoryDetails: CategoryDetail[] = [];

    if (viewMode === "overall") {

      categoryDetails = getCategoryDetails(active);

    } else if (viewMode === "c1") {

      categoryDetails = getCategoryDetails(c1Sites);

    } else if (viewMode === "c6") {

      categoryDetails = getCategoryDetails(c6Sites);

    }



    let gridDetails: GridDetail[] = [];

    if (gridViewMode === "overall") {

      gridDetails = getGridDetails(active);

    } else if (gridViewMode === "c1") {

      gridDetails = getGridDetails(c1Sites);

    } else if (gridViewMode === "c6") {

      gridDetails = getGridDetails(c6Sites);

    }



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



    const pgsCritical = active.filter((s) => PGS_GROUP.includes(s.revenueCategory))

      .filter((s) => s.currentAvb < (CATEGORY_THRESHOLDS[s.revenueCategory] ?? 98.1));

    const sbCritical = active.filter((s) => !PGS_GROUP.includes(s.revenueCategory))

      .filter((s) => s.currentAvb < 95);



    const worst10 = [...active].sort((a, b) => a.currentAvb - b.currentAvb).slice(0, 10);



    const c1Export = c1CategoryKPIs.map(k => ({

      Region: "C-1",

      Category: k.label,

      "Total Sites": k.count,

      "Avg CA": `${k.avgCa.toFixed(2)}%`,

      Threshold: `${k.threshold}%`,

      Critical: k.critical,

    }));



    const c6Export = c6CategoryKPIs.map(k => ({

      Region: "C-6",

      Category: k.label,

      "Total Sites": k.count,

      "Avg CA": `${k.avgCa.toFixed(2)}%`,

      Threshold: `${k.threshold}%`,

      Critical: k.critical,

    }));



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

      worst10,

      c1CategoryKPIs,

      c6CategoryKPIs,

      c1Export,

      c6Export,

      c1Total: c1Sites.length,

      c6Total: c6Sites.length,

      categoryDetails,

      gridDetails,

    };

  }, [sites, viewMode, gridViewMode]);




  const kpiExport = [

    { Metric: "Total Sites", Value: stats.totalSites, Details: `Active: ${stats.activeCount}, Dismantled: ${stats.dismantled}` },

    { Metric: "Overall CA", Value: `${stats.overallCa.toFixed(2)}%`, Details: "Average Cell Availability" },

    { Metric: "C-1 AVB", Value: `${stats.c1Ca.toFixed(2)}%`, Details: `${stats.c1Sites} active sites` },

    { Metric: "C-6 AVB", Value: `${stats.c6Ca.toFixed(2)}%`, Details: `${stats.c6Sites} active sites` },

    { Metric: "Total Critical", Value: stats.criticalPgs + stats.criticalSb, Details: `PGS: ${stats.criticalPgs}, SB: ${stats.criticalSb}` },

  ];









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



  const regionCategoryExport = [...stats.c1Export, ...stats.c6Export];



  const getViewExportData = () => {

    return stats.categoryDetails.map((detail) => ({

      Category: detail.category,

      Group: detail.group,

      "Total Sites": detail.sites.length,

      "Avg CA": detail.avgCa.toFixed(2),

      Threshold: `${detail.threshold}%`,

      "Critical Sites": detail.criticalCount,

      "Critical %": detail.sites.length > 0 ? ((detail.criticalCount / detail.sites.length) * 100).toFixed(1) : "0.0",

    }));

  };



  const getGridViewExportData = () => {

    return stats.gridDetails.map((detail) => ({

      Grid: detail.grid,

      "Total Sites": detail.count,

      "Avg CA": detail.avgCa.toFixed(2),

      "Critical Sites": detail.critical,

      "Status": detail.avgCa >= 98 ? "Healthy" : "Critical",

    }));

  };



  return (

    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1600px] mx-auto space-y-6">



      {/* HEADER */}

      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-slate-200 rounded-xl p-6">

        <div className="flex items-center justify-between flex-wrap gap-4">

          <div>

            <h2 className="text-2xl font-bold text-slate-950 mb-2">Overall Summary</h2>

            <p className="text-slate-600">Comprehensive overview of {stats.totalSites} sites across C-1 and C-6 regions</p>

          </div>

          <ExportButton data={kpiExport} filename="overall_summary_kpis" sheetName="KPIs" label="Export KPIs" />

        </div>

      </div>



      {/* KPI CARDS */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        <KpiCard 

          icon={<Radio className="w-5 h-5" />} 

          iconBg="bg-blue-500/20" 

          iconColor="text-blue-400" 

          value={stats.totalSites} 

          label="Total Sites"

          subValue={`${stats.activeCount} active`}

        />

        <KpiCard 

          icon={<Activity className="w-5 h-5" />} 

          iconBg="bg-emerald-500/20" 

          iconColor="text-emerald-700" 

          value={`${stats.overallCa.toFixed(2)}%`} 

          label="Overall CA"

          subValue={`${stats.activeCount} active sites`}

        />

        <KpiCard 

          icon={<TrendingUp className="w-5 h-5" />} 

          iconBg="bg-cyan-500/20" 

          iconColor="text-cyan-700" 

          value={`${stats.c1Ca.toFixed(2)}%`} 

          label="C-1 AVB"

          subValue={`${stats.c1Sites} sites`}

          trend={stats.c1Ca >= 98 ? "up" : "down"}

        />

        <KpiCard 

          icon={<TrendingUp className="w-5 h-5" />} 

          iconBg="bg-indigo-500/20" 

          iconColor="text-indigo-400" 

          value={`${stats.c6Ca.toFixed(2)}%`} 

          label="C-6 AVB"

          subValue={`${stats.c6Sites} sites`}

          trend={stats.c6Ca >= 98 ? "up" : "down"}

        />

        <KpiCard 

          icon={<AlertTriangle className="w-5 h-5" />} 

          iconBg="bg-red-500/20" 

          iconColor="text-red-600" 

          value={stats.criticalPgs + stats.criticalSb} 

          label="Total Critical"

          subValue={`PGS: ${stats.criticalPgs}, SB: ${stats.criticalSb}`}

        />

      </div>



      {/* CELL AVAILABILITY BY CATEGORY */}

      <div className="bg-white border border-slate-200 rounded-xl p-6">

        <div className="flex items-center justify-between mb-4">

          <h3 className="text-sm font-semibold text-slate-950 flex items-center gap-2">

            <Activity className="w-4 h-4 text-cyan-700" />

            Cell Availability by Category

          </h3>

          <div className="flex items-center gap-3">

            <span className="text-xs text-slate-600">C-1 & C-6 regions</span>

            <ExportButton 

              data={regionCategoryExport} 

              filename="region_category_availability" 

              sheetName="Region Categories" 

              label="Export All" 

            />

          </div>

        </div>



        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
            <div className="text-xs font-bold text-cyan-800">Overall Cell Availability</div>
            <div className="mt-1 text-3xl font-black text-slate-950">{stats.overallCa.toFixed(2)}%</div>
            <div className="text-xs text-slate-600">{stats.activeCount} active sites</div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs font-bold text-blue-800">C-1 Cell Availability</div>
            <div className="mt-1 text-2xl font-black text-slate-950">{stats.c1Ca.toFixed(2)}%</div>
            <div className="text-xs text-slate-600">{stats.c1Sites} sites</div>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <div className="text-xs font-bold text-violet-800">C-6 Cell Availability</div>
            <div className="mt-1 text-2xl font-black text-slate-950">{stats.c6Ca.toFixed(2)}%</div>
            <div className="text-xs text-slate-600">{stats.c6Sites} sites</div>
          </div>
        </div>

        <div className="space-y-4">

          <RegionCategorySection 

            regionData={{ 

              region: "C-1", 

              totalSites: stats.c1Total,

              kpis: stats.c1CategoryKPIs 

            }}

            regionName="C-1"

          />

          <RegionCategorySection 

            regionData={{ 

              region: "C-6", 

              totalSites: stats.c6Total,

              kpis: stats.c6CategoryKPIs 

            }}

            regionName="C-6"

          />

        </div>

      </div>




      {/* REVENUE CATEGORY DETAILED BREAKDOWN */}

      <div className="bg-white border border-slate-200 rounded-xl p-6">

        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">

          <h3 className="text-lg font-semibold text-slate-950">Revenue Category Detailed Breakdown</h3>

          <div className="flex items-center gap-3 flex-wrap">

            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">

              {["overall", "c1", "c6"].map((mode) => (

                <button

                  key={mode}

                  onClick={() => setViewMode(mode as "overall" | "c1" | "c6")}

                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${

                    viewMode === mode

                      ? "bg-cyan-500/20 text-cyan-700"

                      : "text-slate-600 hover:text-slate-800"

                  }`}

                >

                  {mode === "overall" ? "Overall" : mode === "c1" ? "C-1" : "C-6"}

                </button>

              ))}

            </div>

            <ExportButton 

              data={getViewExportData()} 

              filename={`category_breakdown_${viewMode}`} 

              sheetName={`${viewMode.toUpperCase()} Categories`} 

              label="Export View" 

            />

          </div>

        </div>



        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead>

              <tr className="border-b border-slate-200">

                <th className="text-left py-3 px-3 text-slate-600 font-medium">Category</th>

                <th className="text-center py-3 px-3 text-slate-600 font-medium">Total Sites</th>

                <th className="text-center py-3 px-3 text-slate-600 font-medium">Avg CA</th>

                <th className="text-center py-3 px-3 text-slate-600 font-medium">Threshold</th>

                <th className="text-center py-3 px-3 text-slate-600 font-medium">Critical Sites</th>

                <th className="text-center py-3 px-3 text-slate-600 font-medium">Actions</th>

              </tr>

            </thead>

            <tbody>

              {stats.categoryDetails.map((detail) => (

                <CategoryDetailRow

                  key={detail.category}

                  category={detail.category}

                  sites={detail.sites}

                  avgCa={detail.avgCa}

                  threshold={detail.threshold}

                  criticalCount={detail.criticalCount}

                />

              ))}

              {stats.categoryDetails.length === 0 && (

                <tr>

                  <td colSpan={6} className="py-8 text-center text-slate-600">

                    No data available for the selected view.

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>



      {/* GRID PERFORMANCE ANALYSIS - ENHANCED */}

      <div className="bg-white border border-slate-200 rounded-xl p-6">

        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">

          <h3 className="text-lg font-semibold text-slate-950">Grid Performance Analysis</h3>

          <div className="flex items-center gap-3 flex-wrap">

            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200">

              {["overall", "c1", "c6"].map((mode) => (

                <button

                  key={mode}

                  onClick={() => setGridViewMode(mode as "overall" | "c1" | "c6")}

                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${

                    gridViewMode === mode

                      ? "bg-cyan-500/20 text-cyan-700"

                      : "text-slate-600 hover:text-slate-800"

                  }`}

                >

                  {mode === "overall" ? "Overall" : mode === "c1" ? "C-1" : "C-6"}

                </button>

              ))}

            </div>

            <ExportButton 

              data={getGridViewExportData()} 

              filename={`grid_performance_${gridViewMode}`} 

              sheetName={`${gridViewMode.toUpperCase()} Grids`} 

              label="Export View" 

            />

          </div>

        </div>



        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead>

              <tr className="border-b border-slate-200">

                <th className="text-left py-3 px-3 text-slate-600 font-medium">Grid</th>

                <th className="text-center py-3 px-3 text-slate-600 font-medium">Total Sites</th>

                <th className="text-center py-3 px-3 text-slate-600 font-medium">Avg CA</th>
                <th className="text-center py-3 px-3 text-slate-600 font-medium">Actions</th>




              </tr>

            </thead>

            <tbody>

              {stats.gridDetails.map((detail) => (

                <GridDetailRow

                  key={detail.grid}

                  grid={detail.grid}

                  sites={detail.sites}

                  avgCa={detail.avgCa}

                />

              ))}

              {stats.gridDetails.length === 0 && (

                <tr>

                  <td colSpan={4} className="py-8 text-center text-slate-600">

                    No data available for the selected view.

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>



      {/* WORST 10 SITES */}

      <div className="bg-white border border-slate-200 rounded-xl p-6">

        <div className="flex items-center justify-between mb-4">

          <h3 className="text-lg font-semibold text-slate-950">Worst 10 Sites by CA (Excluding Dismantled)</h3>

          <ExportButton data={worst10Export} filename="worst_10_sites" sheetName="Worst 10" label="Export" />

        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            <thead>

              <tr className="border-b border-slate-200">

                <th className="text-center py-3 px-2 text-slate-600 font-medium">Rank</th>

                <th className="text-left py-3 px-3 text-slate-600 font-medium">Site ID</th>

                <th className="text-left py-3 px-3 text-slate-600 font-medium">Grid</th>

                <th className="text-left py-3 px-3 text-slate-600 font-medium">Region</th>

                <th className="text-left py-3 px-3 text-slate-600 font-medium">Category</th>

                <th className="text-center py-3 px-3 text-slate-600 font-medium">Current CA</th>

                <th className="text-center py-3 px-3 text-slate-600 font-medium">Monthly CA</th>

                <th className="text-center py-3 px-3 text-slate-600 font-medium">Group</th>

              </tr>

            </thead>

            <tbody>

              {stats.worst10.map((s, i) => (

                <tr key={s.siteName + i} className="border-b border-slate-200 hover:bg-sky-50">

                  <td className="py-3 px-2 text-center text-slate-600">{i + 1}</td>

                  <td className="py-3 px-3 text-cyan-300 font-mono">{s.siteName}</td>

                  <td className="py-3 px-3 text-slate-700">{s.grid}</td>

                  <td className="py-3 px-3 text-slate-600">{s.subRegion}</td>

                  <td className="py-3 px-3 text-slate-700">{s.revenueCategory}</td>

                  <td className={`py-3 px-3 text-center font-bold ${s.currentAvb < 95 ? "text-red-600" : "text-amber-700"}`}>

                    {s.currentAvb.toFixed(2)}%

                  </td>

                  <td className="py-3 px-3 text-center text-slate-600">

                    {s.monthlyAvb ? `${s.monthlyAvb.toFixed(2)}%` : "-"}

                  </td>

                  <td className="py-3 px-3 text-center">

                    <span className={`text-xs px-2 py-0.5 rounded ${

                      PGS_GROUP.includes(s.revenueCategory) ? "bg-cyan-500/15 text-cyan-700" : "bg-slate-500/15 text-slate-600"

                    }`}>

                      {PGS_GROUP.includes(s.revenueCategory) ? "PGS" : "SB"}

                    </span>

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