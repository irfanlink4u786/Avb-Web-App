import React, { useEffect, useMemo, useState } from "react";

type FuelGrid = { grid: string; fueled_dgs: number; fuel_filled_liters: number; average_liters_per_dg: number | null; monthly_target_liters: number; target_utilization_pct: number | null; balance_liters: number };
export default function GridFuelMonthly({ month }: { month: string }) {
  const [rows, setRows] = useState<FuelGrid[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const date = useMemo(() => ({ october: 10, november: 11, september: 9, august: 8, july: 7 }[month.toLowerCase()] || 11), [month]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const env = (import.meta as any).env || {};
        const base = String(env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
        const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || "");
        const raw = sessionStorage.getItem("cell_avb_supabase_session");
        const token = raw ? JSON.parse(raw)?.access_token : null;
        if (!base || !key || !token) throw new Error("Sign in to load fuel performance.");
        const params = new URLSearchParams({ select: "grid,fueled_dgs,fuel_filled_liters,average_liters_per_dg,monthly_target_liters,target_utilization_pct,balance_liters", fuel_year: "eq.2026", fuel_month: "eq." + date, order: "grid.asc" });
        const response = await fetch(base + "/rest/v1/cell_avb_grid_fuel_monthly?" + params, { headers: { apikey: key, Authorization: "Bearer " + token }, signal: controller.signal });
        if (!response.ok) throw new Error("Supabase fuel summary: HTTP " + response.status + " " + (await response.text()).slice(0,200));
        const data = await response.json();
        if (!controller.signal.aborted) setRows(data.filter((r: FuelGrid) => /^C(?:1|6)\d{3}$/.test(r.grid)));
      } catch (e: any) { if (!controller.signal.aborted) setError(e?.message || "Unable to load fuel summary"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    load();
    return () => controller.abort();
  }, [date]);
  const totals = rows.reduce((a,r) => ({ sites: a.sites + Number(r.fueled_dgs), fuel: a.fuel + Number(r.fuel_filled_liters), target: a.target + Number(r.monthly_target_liters) }), { sites: 0, fuel: 0, target: 0 });
  return <section className="rounded-xl border border-slate-200 bg-white p-5 mt-5 text-slate-900">
    <h3 className="text-lg font-extrabold">Monthly DG Fuel Target — {date === 11 ? "November" : date === 10 ? "October" : "Selected Month"} 2026</h3>
    <p className="text-sm text-slate-600 mb-3">170 L per unique fueled DG · Includes mobile DG site IDs · Full-month benchmark</p>
    {loading ? <p>Loading grid fuel performance…</p> : error ? <p className="text-red-600">{error}</p> : <>
      <div className="flex flex-wrap gap-5 font-semibold mb-4"><span>Fueled DGs: {totals.sites}</span><span>Filled: {totals.fuel.toFixed(2)} L</span><span>Target: {totals.target.toFixed(2)} L</span><span>Used: {totals.target ? (100*totals.fuel/totals.target).toFixed(2) : "0.00"}%</span></div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100"><tr>{["Grid","Fueled DGs","Fuel Filled (L)","Average/DG (L)","Monthly Target (L)","Target Used (%)","Balance (L)"].map(x=><th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.grid} className="border-t border-slate-200"><td className="p-2 font-bold">{r.grid}</td><td className="p-2">{r.fueled_dgs}</td><td className="p-2">{Number(r.fuel_filled_liters).toFixed(2)}</td><td className="p-2">{r.average_liters_per_dg == null ? "—" : Number(r.average_liters_per_dg).toFixed(2)}</td><td className="p-2">{Number(r.monthly_target_liters).toFixed(2)}</td><td className="p-2">{r.target_utilization_pct == null ? "—" : Number(r.target_utilization_pct).toFixed(2)+"%"}</td><td className="p-2">{Number(r.balance_liters).toFixed(2)}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
