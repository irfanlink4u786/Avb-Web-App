import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Zap, Search, Download, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fetchGoogleSheet } from './services/googleSheets';

/** Standalone electricity page. ABS Month is the only month used for reporting. */
const TARGET = 3420;
const fmt = (n:number) => Math.round(n).toLocaleString('en-US');
const norm = (s:unknown) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const lookup = (r:Record<string,any>, aliases:string[], index:number) => {
  const keys=Object.keys(r);
  for(const a of aliases){const key=keys.find(k=>norm(k)===norm(a));if(key!==undefined)return r[key];}
  return r[String(index)] ?? r[index] ?? (keys.every(k=>/^\d+$/.test(k)) ? r[keys[index]] : undefined);
};
const num=(v:unknown)=>{const n=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(n)?n:NaN;};
const absMonth=(v:unknown):string|null=>{
  if(v==null||String(v).trim()==='')return null;
  const s=String(v).trim();
  const valid=(y:number,m:number)=>y>=2020&&y<=2100&&m>=1&&m<=12?`${y}-${String(m).padStart(2,'0')}`:null;
  // Google Sheets may send Excel serials, JS dates, or strings such as Sep-26 / 26-Sep-26.
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return valid(v.getFullYear(),v.getMonth()+1);
  if(typeof v==='number'||/^\d{5}(?:\.\d+)?$/.test(s)){
    const d=new Date(Date.UTC(1899,11,30)+Number(v)*86400000);
    return Number.isNaN(d.getTime())?null:valid(d.getUTCFullYear(),d.getUTCMonth()+1);
  }
  const numeric=s.match(/^(20\d{2})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if(numeric)return valid(Number(numeric[1]),Number(numeric[2]));
  const names=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const named=s.match(/^(?:(\d{1,2})[-/\s])?([A-Za-z]{3,9})[-/\s,]+(\d{2,4})$/);
  if(named){
    const m=names.indexOf(named[2].slice(0,3).toLowerCase())+1;
    const n=Number(named[3]);
    const year=n<100?2000+n:n;
    return valid(year,m);
  }
  // Also accept month/year such as 09/26 and 09/2026.
  const slash=s.match(/^(\d{1,2})[/-](\d{2,4})$/);
  if(slash){const n=Number(slash[2]);return valid(n<100?2000+n:n,Number(slash[1]));}
  const d=new Date(s);
  return Number.isNaN(d.getTime())?null:valid(d.getFullYear(),d.getMonth()+1);
};
const monthLabel=(m:string)=>new Date(`${m}-01T00:00:00`).toLocaleDateString('en-US',{month:'short',year:'numeric'});
interface UnitRow {site:string; month:string; billedMonth:string; severity:string; region:string; subregion:string; grid:string; units:number}
const parseRows=(raw:any[]):UnitRow[]=>raw.flatMap((r:any)=>{
  const site=String(lookup(r,['Name','Site ID','Site','SiteID'],0)??'').trim().replace(/\.0$/,'');
  const month=absMonth(lookup(r,['ABS Month','ABSMonth'],1));
  const units=num(lookup(r,['Total Units','Units','Unit Consumption'],7));
  if(!site||!month||!Number.isFinite(units)||units<0||!/^\d{3,7}$/.test(site))return [];
  return [{site,month,billedMonth:absMonth(lookup(r,['Billed Month'],2))??'',severity:String(lookup(r,['Site Severity','Classification'],3)??''),region:String(lookup(r,['Region'],4)??''),subregion:String(lookup(r,['SubRegion','Sub Region','Sub-Region'],5)??'').trim(),grid:String(lookup(r,['Grid'],6)??'').trim(),units}];
});
const csv=(records:Record<string,any>[],name:string)=>{
  if(!records.length)return;
  const cols=Object.keys(records[0]);
  const quote=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;
  const body=[cols.map(quote).join(','),...records.map(r=>cols.map(k=>quote(r[k])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();URL.revokeObjectURL(url);
};
const sum=(arr:UnitRow[])=>arr.reduce((a,r)=>a+r.units,0);
const unique=(arr:UnitRow[])=>new Set(arr.map(r=>r.site)).size;
const group=(rows:UnitRow[],field:'grid'|'subregion')=>{
  const m=new Map<string,UnitRow[]>();
  rows.forEach(r=>{const k=r[field]||'Unassigned';m.set(k,[...(m.get(k)||[]),r]);});
  return [...m].map(([name,rs])=>{
    const bySite=new Map<string,number>();rs.forEach(r=>bySite.set(r.site,(bySite.get(r.site)||0)+r.units));
    const count=bySite.size,units=sum(rs),billing=[...bySite.values()].filter(n=>n>0).length;
    return {name,rows:rs,sites:count,billing,zero:count-billing,units,average:count?units/count:0,positiveAverage:billing?units/billing:0,target:count*TARGET,variance:units-count*TARGET};
  }).sort((a,b)=>b.average-a.average);
};
export interface ElectricityDashboardProps {
  onBack?:()=>void;
  /** Pass already loaded Google Sheet payload to avoid a second request. */
  data?: {rows?:Record<string,any>[]} | Record<string,any>[];
  /** Google spreadsheet ID containing the ABS tab. Required when data is not passed. */
  sheetId?:string;
  /** Exact worksheet tab name, default ABS. */
  sheetName?:string;
}
export default function ElectricityDashboard({onBack,data,sheetId,sheetName='ABS'}:ElectricityDashboardProps){
  const [payload,setPayload]=useState<any>(data??null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [month,setMonth]=useState('');
  const [region,setRegion]=useState('All');
  const [grid,setGrid]=useState('All');
  const [search,setSearch]=useState('');
  const [view,setView]=useState<'grids'|'sites'|'billing'|'history'>('grids');
  const [expanded,setExpanded]=useState('');
  const [expandedSite,setExpandedSite]=useState('');
  const [limit,setLimit]=useState(25);
  const reload=async()=>{
    if(!sheetId){setError('Provide the Google spreadsheet ID through the sheetId prop, or pass the ABS worksheet data through data.');return;}
    setLoading(true);setError('');
    try{const res=await fetchGoogleSheet(sheetId,sheetName);if(!res?.rows?.length)throw new Error(`Worksheet "${sheetName}" returned no rows.`);
      if(!parseRows(res.rows).length)throw new Error(`Worksheet "${sheetName}" has no valid ABS consumption records. Confirm the tab name and columns A–H.`);
      setPayload(res);
    }catch(e:any){setError(e?.message||'Unable to load electricity worksheet.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{if(data){setPayload(data);setError('');}else reload();},[data,sheetId,sheetName]);
  const all=useMemo(()=>parseRows(Array.isArray(payload)?payload:payload?.rows??[]),[payload]);
  const months=useMemo(()=>[...new Set(all.map(r=>r.month))].sort().reverse(),[all]);
  const selectedMonth=months.includes(month)?month:(months[0]||'');
  const monthRows=useMemo(()=>all.filter(r=>r.month===selectedMonth),[all,selectedMonth]);
  const regions=useMemo(()=>[...new Set(monthRows.map(r=>r.subregion).filter(Boolean))].sort(),[monthRows]);
  const regionalRows=useMemo(()=>monthRows.filter(r=>region==='All'||r.subregion===region),[monthRows,region]);
  const grids=useMemo(()=>group(regionalRows,'grid'),[regionalRows]);
  const visibleRows=useMemo(()=>regionalRows.filter(r=>grid==='All'||r.grid===grid),[regionalRows,grid]);
  const siteRecords=useMemo(()=>{
    const m=new Map<string,{site:string,grid:string,subregion:string,severity:string,units:number,records:number}>();
    visibleRows.forEach(r=>{const k=r.site,old=m.get(k);m.set(k,{site:k,grid:r.grid,subregion:r.subregion,severity:r.severity,units:(old?.units||0)+r.units,records:(old?.records||0)+1});});
    return [...m.values()].filter(r=>r.site.includes(search)||r.grid.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.units-a.units);
  },[visibleRows,search]);
  const summary=useMemo(()=>{const s=group(visibleRows,'subregion');const sites=unique(visibleRows),units=sum(visibleRows),billing=siteRecords.filter(r=>r.units>0).length;return {sites,units,billing,zero:sites-billing,avg:sites?units/sites:0,variance:units-sites*TARGET,sub:s};},[visibleRows,siteRecords]);
  const trends=useMemo(()=>months.slice().reverse().map(m=>{const rs=all.filter(r=>r.month===m&&(region==='All'||r.subregion===region)&&(grid==='All'||r.grid===grid));return {month:monthLabel(m),average:unique(rs)?Math.round(sum(rs)/unique(rs)):0,units:sum(rs)};}),[all,months,region,grid]);
  const siteHistory=useMemo(()=>all.filter(r=>r.site===expanded).sort((a,b)=>a.month.localeCompare(b.month)),[all,expanded]);
  const button=(key:typeof view,label:string)=><button key={key} onClick={()=>setView(key)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${view===key?'bg-emerald-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>;
  const head='px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 bg-slate-100 whitespace-nowrap';
  const td='px-3 py-3 text-sm text-slate-700 border-t border-slate-100 whitespace-nowrap';
  return <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-7 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3">{onBack&&<button onClick={onBack} className="p-2 rounded-lg bg-white border border-slate-200" aria-label="Back"><ArrowLeft size={19}/></button>}<div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl"><Zap size={24}/></div><div><h1 className="text-2xl font-extrabold">Electricity Unit Consumption</h1><p className="text-sm text-slate-500">ABS Month reference · Target {fmt(TARGET)} units/site/month · Zong 5G</p></div></div><button onClick={reload} disabled={loading||!sheetId} className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"><RefreshCw size={15} className={loading?'animate-spin':''}/>Refresh ABS</button></div>
    {error&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="inline mr-2" size={17}/>{error}</div>}
    <div className="flex flex-wrap gap-3 bg-white border border-slate-200 rounded-xl p-4">
      <label className="text-xs font-bold text-slate-500">ABS MONTH<select className="block mt-1 min-w-36 border rounded-lg p-2 text-sm text-slate-800 bg-white" value={selectedMonth} onChange={e=>{setMonth(e.target.value);setGrid('All');}}>{months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-500">SUB-REGION<select className="block mt-1 min-w-36 border rounded-lg p-2 text-sm text-slate-800 bg-white" value={region} onChange={e=>{setRegion(e.target.value);setGrid('All');}}><option>All</option>{regions.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-500">GRID<select className="block mt-1 min-w-36 border rounded-lg p-2 text-sm text-slate-800 bg-white" value={grid} onChange={e=>setGrid(e.target.value)}><option>All</option>{grids.map(g=><option key={g.name}>{g.name}</option>)}</select></label>
      <div className="self-end text-xs text-slate-500">Billed Month is retained for reconciliation only, never used for reporting period.</div>
    </div>
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">{[
      ['Total Units',fmt(summary.units),'kWh consumed'],['Average / Site',fmt(summary.avg),`${summary.avg-TARGET>=0?'+':''}${fmt(summary.avg-TARGET)} vs target`],['Site Count',fmt(summary.sites),'Distinct site IDs'],['Billing Sites',fmt(summary.billing),'Positive units'],['Zero-Unit Sites',fmt(summary.zero),'Review billing status']
    ].map(([label,value,sub],i)=><div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"><p className="text-xs text-slate-500 font-semibold">{label}</p><p className={`mt-2 text-2xl font-black ${i===1&&summary.avg>TARGET?'text-rose-600':i===4&&summary.zero?'text-amber-600':'text-slate-900'}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></div>)}</div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className="bg-white rounded-xl border p-4"><h2 className="font-bold mb-3">Sub-region · Target vs Achievement</h2><div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Sub-region','Sites','Units','Target units','Avg/site','Variance/site','Status'].map(x=><th key={x} className={head}>{x}</th>)}</tr></thead><tbody>{group(monthRows,'subregion').map(g=><tr key={g.name}><td className={td}>{g.name}</td><td className={td}>{fmt(g.sites)}</td><td className={td}>{fmt(g.units)}</td><td className={td}>{fmt(g.target)}</td><td className={td}>{fmt(g.average)}</td><td className={td}>{g.average>TARGET?'+':''}{fmt(g.average-TARGET)}</td><td className={td}><span className={g.average>TARGET?'text-rose-600 font-bold':'text-emerald-600 font-bold'}>{g.average>TARGET?'Above target':'On target'}</span></td></tr>)}</tbody></table></div></section>
      <section className="bg-white rounded-xl border p-4"><h2 className="font-bold mb-2">Monthly Average · ABS Month</h2><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={trends} margin={{top:8,right:12,left:0,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" fontSize={11}/><YAxis fontSize={11}/><Tooltip formatter={(v:any)=>fmt(Number(v))}/><ReferenceLine y={TARGET} stroke="#dc2626" strokeDasharray="5 4" label={{value:'Target 3,420',position:'insideTopRight',fontSize:11}}/><Bar dataKey="average" fill="#059669" name="Avg units/site" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></section>
    </div>
    <section className="bg-white border rounded-xl overflow-hidden"><div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b"><div><h2 className="text-lg font-extrabold">Electricity Performance · Drill-down</h2><p className="text-xs text-slate-500">Worst sites ranked by units; site history shows all ABS months.</p></div><div className="flex flex-wrap gap-2">{button('grids','Grid Summary')}{button('sites','Worst Sites')}{button('billing','Billing / Zero Units')}{button('history','Site History')}</div></div>
    <div className="p-4 flex flex-wrap items-center justify-between gap-2"><div className="relative"><Search size={16} className="absolute top-3 left-3 text-slate-400"/><input className="border rounded-lg pl-9 pr-3 py-2 text-sm" placeholder="Search site or grid" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="flex gap-2"><select value={limit} onChange={e=>setLimit(Number(e.target.value))} className="border rounded-lg px-2 text-sm bg-white">{[10,25,50,100,5000].map(n=><option key={n} value={n}>{n===5000?'All':`Top ${n}`}</option>)}</select><button className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm" onClick={()=>csv(view==='grids'?grids.map(g=>({Grid:g.name,Sites:g.sites,'Billing Sites':g.billing,'Zero Units':g.zero,'Total Units':g.units,'Target Units':g.target,'Average Per Site':g.average,'Variance Per Site':g.average-TARGET})):siteRecords.map(s=>({'Site ID':s.site,Grid:s.grid,'Sub Region':s.subregion,'Site Severity':s.severity,'ABS Month':selectedMonth,'Total Units':s.units,'Excess Units':Math.max(0,s.units-TARGET)})),`electricity_${view}_${selectedMonth}`)}><Download size={15}/>CSV</button></div></div>
    <div className="overflow-x-auto"><table className="w-full"><thead><tr>{(view==='grids'?['Grid','Sites','Billing','Zero','Total Units','Target Units','Avg/Site','Variance/Site','Status','View']:['Site ID','Grid','Sub-region','Site Type','Total Units','Excess Units','Status','History']).map(h=><th key={h} className={head}>{h}</th>)}</tr></thead><tbody>
      {view==='grids'?grids.filter(g=>g.name.toLowerCase().includes(search.toLowerCase())).slice(0,limit).map(g=><React.Fragment key={g.name}><tr className="hover:bg-slate-50"><td className={`${td} font-bold`}>{g.name}</td><td className={td}>{fmt(g.sites)}</td><td className={td}>{fmt(g.billing)}</td><td className={td}>{fmt(g.zero)}</td><td className={td}>{fmt(g.units)}</td><td className={td}>{fmt(g.target)}</td><td className={td}>{fmt(g.average)}</td><td className={`${td} ${g.average>TARGET?'text-rose-600':'text-emerald-700'}`}>{g.average>TARGET?'+':''}{fmt(g.average-TARGET)}</td><td className={td}>{g.average>TARGET?'Over target':'On target'}</td><td className={td}><button className="text-emerald-700 font-semibold flex items-center gap-1" onClick={()=>setExpanded(expanded===g.name?'':g.name)}>Sites {expanded===g.name?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button></td></tr>{expanded===g.name&&<tr><td colSpan={10} className="bg-emerald-50 p-4"><div className="flex justify-between items-center mb-3"><div><h3 className="font-extrabold text-slate-950">{g.name} · Complete Site Consumption</h3><p className="text-xs text-slate-600">All sites · ABS {monthLabel(selectedMonth)} · Target {fmt(TARGET)} units/site</p></div><button className="bg-emerald-700 text-white rounded-lg px-3 py-2 text-xs font-bold" onClick={()=>csv([...new Map(g.rows.map(r=>[r.site,r])).values()].map(r=>{const units=g.rows.filter(x=>x.site===r.site).reduce((a,x)=>a+x.units,0);return {'Site ID':r.site,'Sub-region':r.subregion,Grid:r.grid,Classification:r.severity,'ABS Month':monthLabel(selectedMonth),'Billed Month':r.billedMonth?monthLabel(r.billedMonth):'',Units:units,Target:TARGET,Variance:units-TARGET,Status:units===0?'Zero units':units>TARGET?'Above target':'On target'};}),`electricity_${g.name}_${selectedMonth}`)}>Export Sites CSV</button></div><div className="overflow-x-auto max-h-[560px] overflow-y-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-[1250px] w-full text-sm"><thead className="sticky top-0 z-10 bg-slate-900"><tr>{['Site ID','Sub-region','Grid','Classification','ABS Month','Billed Month','Units','Target','Variance','Status','History'].map(h=><th key={h} className="px-3 py-3 text-left text-xs font-black !text-white whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{[...new Map(g.rows.map(r=>[r.site,r])).values()].map(r=>({...r,siteUnits:g.rows.filter(x=>x.site===r.site).reduce((a,x)=>a+x.units,0)})).sort((a,b)=>b.siteUnits-a.siteUnits).map(r=><React.Fragment key={r.site}><tr className="border-b border-slate-100 even:bg-slate-50 hover:bg-emerald-50"><td className="px-3 py-2 font-bold text-blue-700">{r.site}</td><td className={td}>{r.subregion}</td><td className={td}>{r.grid}</td><td className={td}>{r.severity||'—'}</td><td className={td}>{monthLabel(r.month)}</td><td className={td}>{r.billedMonth?monthLabel(r.billedMonth):'—'}</td><td className={`${td} font-bold`}>{fmt(r.siteUnits)}</td><td className={td}>{fmt(TARGET)}</td><td className={`${td} font-bold ${r.siteUnits>TARGET?'text-rose-700':'text-emerald-700'}`}>{r.siteUnits>TARGET?'+':''}{fmt(r.siteUnits-TARGET)}</td><td className={td}>{r.siteUnits===0?'Zero units':r.siteUnits>TARGET?'Above target':'On target'}</td><td className={td}><button className="font-bold text-emerald-700" onClick={()=>setExpandedSite(expandedSite===r.site?"":r.site)}>View months</button></td></tr>{expandedSite===r.site&&<tr><td colSpan={11} className="p-3 bg-emerald-50"><table className="w-full text-sm"><thead><tr>{['ABS Month','Billed Month','Units','Target','Variance','Status'].map(h=><th key={h} className={head}>{h}</th>)}</tr></thead><tbody>{all.filter(x=>x.site===r.site).sort((a,b)=>a.month.localeCompare(b.month)).map((h,i)=><tr key={i}><td className={td}>{monthLabel(h.month)}</td><td className={td}>{h.billedMonth?monthLabel(h.billedMonth):'—'}</td><td className={td}>{fmt(h.units)}</td><td className={td}>{fmt(TARGET)}</td><td className={td}>{fmt(h.units-TARGET)}</td><td className={td}>{h.units===0?'Zero units':h.units>TARGET?'Above target':'On target'}</td></tr>)}</tbody></table></td></tr>}</React.Fragment>)}</tbody></table></div></td></tr>}</React.Fragment>):siteRecords.filter(s=>view==='billing'?s.units===0:view==='sites'?s.units>TARGET:true).slice(0,limit).map(s=><React.Fragment key={s.site}><tr className="hover:bg-slate-50"><td className={`${td} font-bold`}>{s.site}</td><td className={td}>{s.grid}</td><td className={td}>{s.subregion}</td><td className={td}>{s.severity}</td><td className={td}>{fmt(s.units)}</td><td className={`${td} ${s.units>TARGET?'text-rose-600 font-semibold':''}`}>{fmt(Math.max(0,s.units-TARGET))}</td><td className={td}>{s.units===0?'Zero billing':s.units>TARGET?'Above target':'On target'}</td><td className={td}><button className="text-emerald-700 font-semibold" onClick={()=>setExpanded(expanded===s.site?'':s.site)}>View months</button></td></tr>{expanded===s.site&&<tr><td colSpan={8} className="p-4 bg-emerald-50"><div className="font-bold mb-2">Site {s.site} · ABS Month history</div><div className="overflow-x-auto rounded-lg border bg-white"><table className="min-w-[850px] w-full text-sm"><thead><tr>{['ABS Month','Billed Month','Site ID','Grid','Classification','Units','Target','Variance','Status'].map(h=><th key={h} className={head}>{h}</th>)}</tr></thead><tbody>{siteHistory.map((h,i)=><tr key={i}><td className={td}>{monthLabel(h.month)}</td><td className={td}>{h.billedMonth?monthLabel(h.billedMonth):'—'}</td><td className={td}>{h.site}</td><td className={td}>{h.grid}</td><td className={td}>{h.severity}</td><td className={td}>{fmt(h.units)}</td><td className={td}>{fmt(TARGET)}</td><td className={td}>{fmt(h.units-TARGET)}</td><td className={td}>{h.units===0?'Zero units':h.units>TARGET?'Above target':'On target'}</td></tr>)}</tbody></table></div></td></tr>}</React.Fragment>)}
    </tbody></table>{!all.length&&!loading&&<div className="p-8 text-center text-slate-500">No valid ABS consumption rows loaded. Check the Google worksheet and permissions.</div>}</div>
    <div className="border-t bg-slate-50 px-4 py-3 text-xs text-slate-500">Method: each unique site is counted once per ABS Month. Total units are summed by site. Target = 3,420 × distinct sites. Zero-unit sites are included in the official average and displayed separately for billing audit. High-load PTN/hub sites require load-based review.</div></section>
  </div>;
}
