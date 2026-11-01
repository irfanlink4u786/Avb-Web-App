import { Fragment, useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import type { SiteData, SheetPayload } from "./types";
import { SectionBanner, ExportButtonComponent } from "./SharedDashboardUI";
import { empNormalizeDailyDateKey, empDateKeyToTime, empGetDailyAvb, empFormatDailyDateHeader, empCaTextClass } from "./EmployeePerformance";

// ============================================================
//  3 BASICS KPIs — OCTOBER 2026
//  Joins "3 Basics KPIs" with Sheet1 by SID and shows current CA + latest 3 days.
// ============================================================
const THREE_BASIC_KPIS = [
  "Below Base",
  "Down Cells",
  "Zero Traffic",
  "High Fluctuation Sites",
  "VSWR",
  "High Temp",
  "Phase Missing Cases",
] as const;

export function ThreeBasicsKpiPage({
  kpiData,
  sites,
  lastUpdatedDate,
}: {
  kpiData: SheetPayload | null;
  sites: SiteData[];
  lastUpdatedDate?: string;
}) {
  const [expandedGrid, setExpandedGrid] = useState<string | null>(null);
  const [kpiFilter, setKpiFilter] = useState<string>("All");
  const [revenueFilter, setRevenueFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [coFilter, setCoFilter] = useState<string>("All");
  const [gtlFilter, setGtlFilter] = useState<string>("All");
  const [zoneLeadFilter, setZoneLeadFilter] = useState<string>("All");
  const [search, setSearch] = useState("");

  const norm = (v: any) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const get = (row: Record<string, any>, names: string[]) => {
    const keys = Object.keys(row ?? {});
    for (const name of names) {
      const exact = keys.find(k => norm(k) === norm(name));
      if (exact) return row[exact];
    }
    return "";
  };

  const siteMap = useMemo(() => {
    const m = new Map<string, SiteData>();
    sites.forEach(site => m.set(String(site.siteName ?? "").trim(), site));
    return m;
  }, [sites]);

  const latest3Dates = useMemo(() => {
    const available = new Set<string>();
    const cutoff = empNormalizeDailyDateKey(lastUpdatedDate || "");
    const cutoffTime = cutoff ? empDateKeyToTime(cutoff) : Number.POSITIVE_INFINITY;
    const cutoffParts = cutoff?.split("-") ?? [];
    sites.forEach(site => {
      Object.entries(site.dailyData ?? {}).forEach(([raw, rawValue]) => {
        const key = empNormalizeDailyDateKey(raw);
        const value = Number(rawValue);
        if (!key || !Number.isFinite(value) || value <= 0) return;
        if (empDateKeyToTime(key) > cutoffTime) return;
        if (cutoff) {
          const [, month, year] = key.split("-");
          if (month !== cutoffParts[1] || year !== cutoffParts[2]) return;
        }
        available.add(key);
      });
    });
    return Array.from(available)
      .sort((a,b) => empDateKeyToTime(a) - empDateKeyToTime(b))
      .slice(-3);
  }, [sites, lastUpdatedDate]);

  const rows = useMemo(() => (kpiData?.rows ?? []).map((raw: Record<string, any>, idx: number) => {
    const sid = String(get(raw, ["SID","Site ID","SiteID","Site"]) ?? "").trim();
    const site = siteMap.get(sid);
    const rawKpi = String(get(raw, ["KPI","3 Basic KPI","3 Basics KPI"]) ?? "").trim();
    const kpiAliases: Record<string, string> = {
      [norm("Fluctuated Sites")]: "High Fluctuation Sites",
      [norm("High TempAlm")]: "High Temp",
    };
    const canonicalKpi = kpiAliases[norm(rawKpi)] || THREE_BASIC_KPIS.find(k => norm(k) === norm(rawKpi)) || rawKpi || "Unspecified";
    const subRegion = String(get(raw, ["SubRegion","Sub-Region","Sub Region"]) || site?.subRegion || "").trim();
    const grid = String(get(raw, ["Grid"]) || site?.grid || "").trim();
    return {
      key: `${sid}-${canonicalKpi}-${idx}`,
      sid,
      site,
      subRegion,
      grid,
      revenue: String(get(raw, ["Revenue","Revenue Category","Category"]) || site?.revenueCategory || "").trim(),
      kpi: canonicalKpi,
      co: String(get(raw, ["CO","Cluster Owner"]) || site?.clusterOwner || "").trim(),
      gtl: String(get(raw, ["GTL","MS GTL","MPL GTL"]) || site?.msGtl || "").trim(),
      cmpak: String(get(raw, ["CMPAK","CMPAK GTL","Zone Lead","Zong Lead"]) || site?.zongLead || "").trim(),
      status: String(get(raw, ["Open/Close","Open Close","Status"]) || "Open").trim(),
      category: String(get(raw, ["Category","Issue Category"]) || "").trim(),
      rca: String(get(raw, ["RCA","Root Cause"]) || "").trim(),
      action: String(get(raw, ["Action","Action Required","Plan"]) || "").trim(),
      currentCa: Number(site?.currentAvb || 0),
    };
  }).filter(r => r.sid), [kpiData, siteMap]);

  const regionKey = (r: any) => {
    const sr = String(r.subRegion || "").toUpperCase().replace(/\s+/g,"");
    const g = String(r.grid || "").toUpperCase();
    if (sr.includes("CENTRAL-1") || sr === "C-1" || sr === "C1" || g.startsWith("C1")) return "C-1";
    if (sr.includes("CENTRAL-6") || sr === "C-6" || sr === "C6" || g.startsWith("C6")) return "C-6";
    return r.subRegion || "Other";
  };

  const statusIsOpen = (v: string) => !/clos|resolv|done/i.test(v);

  const revenueLabel = (value: string) => {
    const n = norm(value);
    if (n === "platinum" && /\+/.test(value)) return "Plat+";
    if (n === "platinumplus") return "Plat+";
    if (n === "platinum") return "Plat";
    return value;
  };

  const revenueOptions = useMemo(() => {
    const preferred = ["platinumplus", "platinum", "gold", "silver", "bronze"];
    const values = Array.from(new Set(rows.map(r => r.revenue).filter(Boolean)));
    return values.sort((a, b) => {
      const key = (v: string) => /\+/.test(v) && norm(v) === "platinum" ? "platinumplus" : norm(v);
      const ai = preferred.indexOf(key(a));
      const bi = preferred.indexOf(key(b));
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [rows]);

  const ownerFilteredRows = useMemo(() => rows.filter(r =>
    (revenueFilter === "All" || norm(r.revenue) === norm(revenueFilter)) &&
    (coFilter === "All" || r.co === coFilter) &&
    (gtlFilter === "All" || r.gtl === gtlFilter) &&
    (zoneLeadFilter === "All" || r.cmpak === zoneLeadFilter)
  ), [rows, revenueFilter, coFilter, gtlFilter, zoneLeadFilter]);

  const regionSummary = useMemo(() => ["C-1","C-6"].map(region => {
    const rr = ownerFilteredRows.filter(r => regionKey(r) === region);
    const counts: Record<string, number> = {};
    THREE_BASIC_KPIS.forEach(k => counts[k] = rr.filter(r => r.kpi === k).length);
    return {
      region,
      total: rr.length,
      open: rr.filter(r => statusIsOpen(r.status)).length,
      closed: rr.filter(r => !statusIsOpen(r.status)).length,
      counts,
    };
  }), [ownerFilteredRows]);

  const gridSummary = useMemo(() => {
    const map = new Map<string, any>();
    ownerFilteredRows.forEach(r => {
      const grid = r.grid || "Unassigned";
      if (!map.has(grid)) {
        const counts: Record<string, number> = {};
        THREE_BASIC_KPIS.forEach(k => counts[k] = 0);
        map.set(grid, { grid, region: regionKey(r), total: 0, open: 0, closed: 0, counts });
      }
      const x = map.get(grid);
      x.total += 1;
      if (statusIsOpen(r.status)) x.open += 1; else x.closed += 1;
      if (x.counts[r.kpi] !== undefined) x.counts[r.kpi] += 1;
    });
    return Array.from(map.values()).sort((a,b) => b.open - a.open || b.total - a.total || a.grid.localeCompare(b.grid));
  }, [ownerFilteredRows]);

  // Ownership dropdowns cascade from Revenue Category -> CO -> GTL -> Zone Lead.
  const coOptions = useMemo(() => Array.from(new Set(
    rows.filter(r => revenueFilter === "All" || norm(r.revenue) === norm(revenueFilter))
      .map(r => r.co).filter(Boolean)
  )).sort(), [rows, revenueFilter]);

  const gtlOptions = useMemo(() => Array.from(new Set(
    rows.filter(r =>
      (revenueFilter === "All" || norm(r.revenue) === norm(revenueFilter)) &&
      (coFilter === "All" || r.co === coFilter)
    ).map(r => r.gtl).filter(Boolean)
  )).sort(), [rows, revenueFilter, coFilter]);

  const zoneLeadOptions = useMemo(() => Array.from(new Set(
    rows.filter(r =>
      (revenueFilter === "All" || norm(r.revenue) === norm(revenueFilter)) &&
      (coFilter === "All" || r.co === coFilter) &&
      (gtlFilter === "All" || r.gtl === gtlFilter)
    ).map(r => r.cmpak).filter(Boolean)
  )).sort(), [rows, revenueFilter, coFilter, gtlFilter]);

  useEffect(() => {
    if (coFilter !== "All" && !coOptions.includes(coFilter)) setCoFilter("All");
  }, [revenueFilter, coOptions, coFilter]);

  useEffect(() => {
    if (gtlFilter !== "All" && !gtlOptions.includes(gtlFilter)) setGtlFilter("All");
  }, [revenueFilter, coFilter, gtlOptions, gtlFilter]);

  useEffect(() => {
    if (zoneLeadFilter !== "All" && !zoneLeadOptions.includes(zoneLeadFilter)) setZoneLeadFilter("All");
  }, [revenueFilter, coFilter, gtlFilter, zoneLeadOptions, zoneLeadFilter]);

  const visibleRows = useMemo(() => rows.filter(r => {
    if (expandedGrid && r.grid !== expandedGrid) return false;
    if (kpiFilter !== "All" && r.kpi !== kpiFilter) return false;
    if (revenueFilter !== "All" && norm(r.revenue) !== norm(revenueFilter)) return false;
    if (statusFilter === "Open" && !statusIsOpen(r.status)) return false;
    if (statusFilter === "Closed" && statusIsOpen(r.status)) return false;
    if (coFilter !== "All" && r.co !== coFilter) return false;
    if (gtlFilter !== "All" && r.gtl !== gtlFilter) return false;
    if (zoneLeadFilter !== "All" && r.cmpak !== zoneLeadFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && ![r.sid,r.grid,r.subRegion,r.revenue,r.kpi,r.co,r.gtl,r.cmpak,r.category,r.rca,r.action]
      .some(v => String(v ?? "").toLowerCase().includes(q))) return false;
    return true;
  }), [rows, expandedGrid, kpiFilter, revenueFilter, statusFilter, coFilter, gtlFilter, zoneLeadFilter, search]);

  const PAGE_SIZE_3B = 75;
  const [tablePage, setTablePage] = useState(0);
  useEffect(() => { setTablePage(0); }, [expandedGrid, kpiFilter, revenueFilter, statusFilter, coFilter, gtlFilter, zoneLeadFilter, search]);
  const pagedVisibleRows = useMemo(() => visibleRows.slice(tablePage * PAGE_SIZE_3B, (tablePage + 1) * PAGE_SIZE_3B), [visibleRows, tablePage]);
  const exportRows = visibleRows.map(r => {
    const out: Record<string, any> = {
      SID: r.sid, SubRegion: r.subRegion, Revenue: r.revenue, Grid: r.grid, KPI: r.kpi,
      "Current Month CA": r.currentCa > 0 ? `${r.currentCa.toFixed(2)}%` : "-",
      CO: r.co, GTL: r.gtl, CMPAK: r.cmpak, Status: r.status,
      Category: r.category, RCA: r.rca, Action: r.action,
    };
    latest3Dates.forEach(d => {
      const v = r.site ? empGetDailyAvb(r.site, d) : 0;
      out[`${empFormatDailyDateHeader(d)} AVB`] = v > 0 ? `${v.toFixed(2)}%` : "-";
    });
    return out;
  });

  if (!kpiData) return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-8 text-center font-bold text-amber-900">
      3 Basics KPIs data has not loaded. Please use Sync Data (Manual) to refresh this dataset from Supabase.
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionBanner
        icon={<Activity className="w-6 h-6 text-blue-600" />}
        title="3 Basics KPIs — October 2026"
        subtitle={`${rows.length} KPI cases · Joined with Sheet1 Cell AVB by SID · Current month + latest 3 days`}
        gradient="from-blue-500/10 to-cyan-500/10"
      />

      {/* Revenue Category — top-level 3 Basics filter */}
      <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">Revenue Category</div>
            <div className="text-xs font-semibold text-slate-600">Filter all 3 Basics KPI cards, sub-region, grid and site detail.</div>
          </div>
          <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
            {revenueFilter === "All" ? "All Revenue Categories" : revenueLabel(revenueFilter)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["All", ...revenueOptions].map(category => (
            <button key={category} type="button" onClick={() => { setRevenueFilter(category); setExpandedGrid(null); }}
              className={`rounded-lg border px-4 py-2 text-sm font-black transition ${revenueFilter === category ? "border-emerald-600 bg-[#006B3C] text-white shadow-sm" : "border-slate-300 bg-white text-slate-800 hover:bg-emerald-50"}`}>
              {category === "All" ? "All Categories" : revenueLabel(category)}
            </button>
          ))}
        </div>
      </div>

      {/* CO / GTL / Zone Lead ownership filters — selection updates KPI cards + grid view */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">CO</label>
            <select value={coFilter} onChange={e => { setCoFilter(e.target.value); setExpandedGrid(null); }}
              className="min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900">
              <option value="All">All COs</option>
              {coOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">GTL</label>
            <select value={gtlFilter} onChange={e => { setGtlFilter(e.target.value); setExpandedGrid(null); }}
              className="min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900">
              <option value="All">All GTLs</option>
              {gtlOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">Zone Lead</label>
            <select value={zoneLeadFilter} onChange={e => { setZoneLeadFilter(e.target.value); setExpandedGrid(null); }}
              className="min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900">
              <option value="All">All Zone Leads</option>
              {zoneLeadOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <button onClick={() => { setCoFilter("All"); setGtlFilter("All"); setZoneLeadFilter("All"); setKpiFilter("All"); setRevenueFilter("All"); setStatusFilter("All"); setSearch(""); setExpandedGrid(null); }}
            className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-100">
            Clear Filters
          </button>
          <div className="ml-auto rounded-lg bg-blue-50 px-4 py-2 text-xs font-bold text-blue-900">
            Showing KPIs for: {revenueFilter === "All" ? "All Revenue" : revenueLabel(revenueFilter)} · {coFilter === "All" ? "All COs" : coFilter} · {gtlFilter === "All" ? "All GTLs" : gtlFilter} · {zoneLeadFilter === "All" ? "All Zone Leads" : zoneLeadFilter}
          </div>
        </div>
      </div>

      {/* KPI visibility cards */}
      <div className="basics-kpi-color-grid grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {THREE_BASIC_KPIS.map(k => {
          const total = ownerFilteredRows.filter(r => r.kpi === k).length;
          const open = ownerFilteredRows.filter(r => r.kpi === k && statusIsOpen(r.status)).length;
          return <button key={k} onClick={() => setKpiFilter(kpiFilter === k ? "All" : k)}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${kpiFilter===k?"border-blue-500 bg-blue-50 ring-2 ring-blue-200":"border-slate-200 bg-white hover:bg-slate-50"}`}>
            <div className="text-[11px] font-black text-slate-600">{k}</div>
            <div className="mt-1 text-2xl font-black text-slate-950">{total}</div>
            <div className="text-[11px] font-bold text-red-600">{open} Open</div>
          </button>;
        })}
      </div>

      {/* Sub-region summary first, as requested */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-black text-slate-950">Sub-Region Wise 3 Basics Summary</h3>
          <p className="text-xs text-slate-500">C-1 vs C-6 · KPI-wise case visibility</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead><tr>
              <th className="px-3 py-3 text-left">Sub-Region</th>
              {THREE_BASIC_KPIS.map(k => <th key={k} className="px-3 py-3 text-center whitespace-nowrap">{k}</th>)}
              <th className="px-3 py-3 text-center">Open</th><th className="px-3 py-3 text-center">Closed</th><th className="px-3 py-3 text-center">Total</th>
            </tr></thead>
            <tbody>{regionSummary.map(r => <tr key={r.region}>
              <td className="px-3 py-3 font-black">{r.region}</td>
              {THREE_BASIC_KPIS.map(k => <td key={k} className="px-3 py-3 text-center font-bold">{r.counts[k]}</td>)}
              <td className="px-3 py-3 text-center font-black text-red-600">{r.open}</td>
              <td className="px-3 py-3 text-center font-black text-emerald-700">{r.closed}</td>
              <td className="px-3 py-3 text-center font-black">{r.total}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>

      {/* Grid summary with View drill-down */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="font-black text-slate-950">Grid Wise KPI Summary</h3>
          <p className="text-xs text-slate-500">Worst/open grids first · use View for complete site-level details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1300px] w-full text-sm">
            <thead><tr>
              <th className="px-3 py-3 text-left">Grid</th><th className="px-3 py-3 text-center">Region</th>
              {THREE_BASIC_KPIS.map(k => <th key={k} className="px-3 py-3 text-center whitespace-nowrap">{k}</th>)}
              <th className="px-3 py-3 text-center">Open</th><th className="px-3 py-3 text-center">Total</th><th className="px-3 py-3 text-center">View</th>
            </tr></thead>
            <tbody>{gridSummary.map(g => <Fragment key={g.grid}>
              <tr>
                <td className="px-3 py-3 font-black">{g.grid}</td><td className="px-3 py-3 text-center font-bold">{g.region}</td>
                {THREE_BASIC_KPIS.map(k => <td key={k} className="px-3 py-3 text-center font-bold">{g.counts[k]}</td>)}
                <td className="px-3 py-3 text-center font-black text-red-600">{g.open}</td>
                <td className="px-3 py-3 text-center font-black">{g.total}</td>
                <td className="px-3 py-3 text-center"><button onClick={() => setExpandedGrid(expandedGrid===g.grid?null:g.grid)}
                  className="rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-black text-blue-800">{expandedGrid===g.grid?"Hide":"View"}</button></td>
              </tr>
              {expandedGrid===g.grid && <tr><td colSpan={12} className="bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div><div className="font-black text-slate-950">{g.grid} · Site KPI Detail</div>
                    <div className="text-xs text-slate-500">Latest AVB: {latest3Dates.map(empFormatDailyDateHeader).join(" | ") || "-"}</div></div>
                  <div className="flex flex-wrap gap-2">
                    <select value={kpiFilter} onChange={e=>setKpiFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900">
                      <option>All</option>{THREE_BASIC_KPIS.map(k=><option key={k}>{k}</option>)}
                    </select>
                    <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900">
                      <option>All</option><option>Open</option><option>Closed</option>
                    </select>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search site / owner / RCA"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"/>
                    <ExportButtonComponent data={exportRows} filename={`3_Basics_${g.grid}`} label="Export" format="excel" variant="success"/>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="grid-performance-detail-table min-w-[1900px] w-full text-sm">
                    <thead><tr>
                      {["SID","SubRegion","Revenue","Grid","KPI","Current Month CA",...latest3Dates.map(d=>`${empFormatDailyDateHeader(d)} AVB`),"CO","GTL","CMPAK","Open/Close","Category","RCA","Action"].map(h=>
                        <th key={h} className="px-3 py-3 text-left text-xs font-black whitespace-nowrap">{h}</th>)}
                    </tr></thead>
                    <tbody>{pagedVisibleRows.map(r => <tr key={r.key}>
                      <td className="px-3 py-3 font-black text-blue-700">{r.sid}</td><td className="px-3 py-3">{r.subRegion||"-"}</td>
                      <td className="px-3 py-3">{r.revenue||"-"}</td><td className="px-3 py-3 font-bold">{r.grid||"-"}</td>
                      <td className="px-3 py-3 font-black">{r.kpi}</td>
                      <td className={`px-3 py-3 text-center font-black ${empCaTextClass(r.currentCa)}`}>{r.currentCa>0?`${r.currentCa.toFixed(2)}%`:"-"}</td>
                      {latest3Dates.map(d=>{const v=r.site?empGetDailyAvb(r.site,d):0;return <td key={d} className={`px-3 py-3 text-center font-black ${empCaTextClass(v)}`}>{v>0?`${v.toFixed(2)}%`:"-"}</td>})}
                      <td className="px-3 py-3">{r.co||"-"}</td><td className="px-3 py-3">{r.gtl||"-"}</td><td className="px-3 py-3">{r.cmpak||"-"}</td>
                      <td className={`px-3 py-3 font-black ${statusIsOpen(r.status)?"text-red-600":"text-emerald-700"}`}>{r.status}</td>
                      <td className="px-3 py-3">{r.category||"-"}</td><td className="px-3 py-3 max-w-[360px] whitespace-normal">{r.rca||"-"}</td>
                      <td className="px-3 py-3 max-w-[360px] whitespace-normal">{r.action||"-"}</td>
                    </tr>)}
                    {visibleRows.length===0 && <tr><td colSpan={15+latest3Dates.length} className="px-4 py-10 text-center text-slate-500">No matching KPI cases.</td></tr>}
                    </tbody>
                  </table>{visibleRows.length > PAGE_SIZE_3B && <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-slate-700">
    <span>Page {tablePage + 1} / {Math.ceil(visibleRows.length / PAGE_SIZE_3B)} · {visibleRows.length} records</span>
    <div className="flex gap-2"><button type="button" disabled={tablePage === 0} onClick={() => setTablePage(p => Math.max(0, p - 1))} className="rounded bg-slate-200 px-3 py-1 disabled:opacity-40">Previous</button>
    <button type="button" disabled={(tablePage + 1) * PAGE_SIZE_3B >= visibleRows.length} onClick={() => setTablePage(p => p + 1)} className="rounded bg-slate-200 px-3 py-1 disabled:opacity-40">Next</button></div>
  </div>}
                </div>
              </td></tr>}
            </Fragment>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

