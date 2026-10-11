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
type SiteType = 'Single'|'Minor Hub'|'Major Hub'|'Critical Hub'|'PTN Node'|'Other';
const siteType=(v:unknown):SiteType=>{const x=norm(v);if(x.startsWith('single'))return 'Single';if(x.startsWith('minorhub'))return 'Minor Hub';if(x.startsWith('majorhub'))return 'Major Hub';if(x.startsWith('criticalhub'))return 'Critical Hub';if(x.includes('ptnnode'))return 'PTN Node';return 'Other';};
interface UnitRow {co:string;gtl:string;zoneLead:string;site:string; month:string; billedMonth:string; severity:string; category:string; type:SiteType; region:string; subregion:string; grid:string; units:number}
const parseRows=(raw:any[]):UnitRow[]=>raw.flatMap((r:any)=>{
  const site=String(lookup(r,['Name','Site ID','Site','SiteID'],0)??'').trim().replace(/\.0$/,'');
  const month=absMonth(lookup(r,['ABS Month','ABSMonth'],1));
  const units=num(lookup(r,['Total Units','Units','Unit Consumption'],7));
  if(!site||!month||!Number.isFinite(units)||units<0||!/^\d{3,7}$/.test(site))return [];
  const category=String(lookup(r,['Category','Site Type','Dependency'],8)??'').trim();
  return [{co:String(lookup(r,['CO','Cluster Owner','ClusterOwner'],-1)??'').trim(),gtl:String(lookup(r,['GTL','Grid Team Lead','GridTeamLead'], -1)??'').trim(),zoneLead:String(lookup(r,['Zone Lead','ZoneLead','Zone_Lead'], -1)??'').trim(),site,month,category,type:siteType(category),billedMonth:absMonth(lookup(r,['Billed Month'],2))??'',severity:String(lookup(r,['Site Severity','Classification'],3)??''),region:String(lookup(r,['Region'],4)??''),subregion:String(lookup(r,['SubRegion','Sub Region','Sub-Region'],5)??'').trim(),grid:String(lookup(r,['Grid'],6)??'').trim(),units}];
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
const CATEGORY_ORDER:SiteType[]=['Single','Minor Hub','Major Hub','Critical Hub','PTN Node','Other'];
const categorySummary=(rows:UnitRow[])=>CATEGORY_ORDER.map(type=>{
  const rs=rows.filter(r=>r.type===type);
  const bySite=new Map<string,number>();
  rs.forEach(r=>bySite.set(r.site,(bySite.get(r.site)||0)+r.units));
  const sites=bySite.size, units=sum(rs), billing=[...bySite.values()].filter(x=>x>0).length;
  return {type,sites,units,billing,zero:sites-billing,target:sites*TARGET,average:sites?units/sites:0,variance:units-sites*TARGET,rows:rs};
}).filter(g=>g.sites>0);

// Deviation Reasons is an investigation register, not an ABS-month consumption source.
type DeviationRow = {site:string; subregion:string; grid:string; priority:string; category:string; payMode:string; sharing:string; disco:string; criteria:number; difference:number; direction:string; fault:string; action:string; status:string; breach3:string; breach6:string; units:string[]};
const devText=(r:Record<string,any>, names:string[],i:number)=>String(lookup(r,names,i)??'').trim();
const parseDeviation=(raw:Record<string,any>[]):DeviationRow[]=>raw.flatMap(r=>{
  const site=devText(r,['Site','Site ID','SiteID'],0).replace(/\.0$/,'');
  if(!/^\d{3,7}$/.test(site))return [];
  const unitNames=['Dec_Unit','Jan_Unit','Feb_Unit','March_Unit','Apr_Unit','May_Unit'];
  return [{site,subregion:devText(r,['Sub-Region','Sub Region','SubRegion'],1),grid:devText(r,['Grid'],2),priority:devText(r,['Priority'],3),category:devText(r,['Category'],4),payMode:devText(r,['Pay_Mode','Pay Mode'],5),sharing:devText(r,['Sharing_Status','Sharing Status'],6),disco:devText(r,['Disco'],7),criteria:num(lookup(r,['Criteria'],8)),difference:num(lookup(r,['Difference'],17)),direction:devText(r,['Incr/Decrease','Increase/Decrease'],18),fault:devText(r,['Detailed Remarks','Fault Reason','Fault Category'],19),action:devText(r,['Action Taken'],20),status:devText(r,['Current Status','Status'],21),breach3:devText(r,['Breach_3Times'],15),breach6:devText(r,['Breach_6Times'],16),units:unitNames.map((n,j)=>devText(r,[n],9+j))}];
});
// Guard against the Google Sheets service silently returning ABS / Sheet-1.
// A site ID alone is NOT evidence that the Deviation Reasons tab was loaded.
const isDeviationWorksheet=(raw:Record<string,any>[])=>{
  if(!raw.length)return false;
  const keys=Object.keys(raw[0]);
  const has=(name:string)=>keys.some(k=>norm(k)===norm(name));
  const headers=['Priority','Pay_Mode','Sharing_Status','Detailed Remarks','Action Taken','Current Status','Breach_3Times','Breach_6Times'];
  if(headers.filter(has).length>=3 && (has('Detailed Remarks')||has('Current Status')))return true;
  // Positional data is accepted only if D, T, U, V look like an investigation register.
  const sample=raw.slice(0,Math.min(raw.length,30));
  return sample.some(r=>{
    const site=devText(r,['Site'],0);
    const priority=devText(r,['Priority'],3);
    const reason=devText(r,['Detailed Remarks'],19);
    const action=devText(r,['Action Taken'],20);
    const status=devText(r,['Current Status'],21);
    return /^\d{3,7}(?:\.0)?$/.test(site)&&/^(P[1-9]|high|medium|low)$/i.test(priority)&&Boolean(reason||action||status);
  });
};
const parseSheetCsv=(source:string):Record<string,any>[]=>{
  const matrix:string[][]=[];let row:string[]=[],value='',quoted=false;
  for(let i=0;i<source.length;i++){
    const c=source[i];
    if(c==='"'){if(quoted&&source[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(value);value='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))matrix.push(row);row=[];value='';}
    else value+=c;
  }
  row.push(value);if(row.some(x=>x.trim()))matrix.push(row);
  if(matrix.length<2)return [];
  const headers=matrix[0].map(x=>x.replace(/^\uFEFF/,'').trim());
  return matrix.slice(1).map(cells=>Object.fromEntries(headers.map((h,i)=>[h||String(i),cells[i]??''])));
};
const fetchDeviationCsv=async(sheetId:string,sheetName:string)=>{
  const url=`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response=await fetch(url,{credentials:'omit'});
  if(!response.ok)throw new Error(`Google Sheets CSV request failed (HTTP ${response.status}).`);
  const content=await response.text();
  if(/^\s*<!doctype html|^\s*<html/i.test(content))throw new Error('Google Sheets returned an HTML sign-in page instead of CSV.');
  return parseSheetCsv(content);
};
const deviationFaultGroup=(text:string)=>{
  const t=norm(text);
  if(!t)return 'Reason not recorded';
  const cp=/\b(cp|commercial power|electricity|lesco|fesco|gepco|mepco|iesco)\b/i.test(text);
  const theft=/theft|stolen|illegal|unauthori[sz]ed|pilfer|hooking|bypass/i.test(text);
  const meter=/meter|\bem\b|metering|reading|kwh meter/i.test(text);
  if(theft && (cp || !/fuel|diesel|dg theft/i.test(text)))return 'CP Theft / Unauthorized Connection';
  if(meter && /fault|defect|damag|burn|stuck|stop|slow|fast|replac|not work|non.?functional|missing|not install|no meter/i.test(text))return 'CP Meter Faulty / Missing';
  if(meter)return 'CP Meter / Reading Issue';
  if(/average bill|wrong bill|excess bill|billing error|estimated bill|overbill/i.test(text))return 'Billing / Average Bill';
  if(/criteria|revision|threshold|load data/i.test(text))return 'Units Criteria Revision';
  if(/ac fault|air condition|cooling|ac load/i.test(text))return 'Air-conditioning / Cooling';
  if(/sharing|shared|tenant|third.party/i.test(text))return 'Shared / Third-party Load';
  if(/transformer|phase|voltage|power fault|supply fault/i.test(text))return 'Power Supply / Electrical Fault';
  if(/generator|\bdg\b/i.test(text))return 'Generator / Power Operation';
  return 'Other Documented Reasons';
};

const deviationStatus=(s:string)=>{const x=norm(s);return x.includes('clos')||x.includes('resolv')||x.includes('complet')?'Closed':x.includes('progress')||x.includes('ongoing')?'In Progress':x.includes('open')||x.includes('pend')?'Open/Pending':s||'Not Recorded';};
function DeviationReasonsTab({sheetId,sheetName='Deviation reasons'}:{sheetId?:string;sheetName?:string}){
  const [rows,setRows]=useState<DeviationRow[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [region,setRegion]=useState('All');
  const [grid,setGrid]=useState('All');
  const [priority,setPriority]=useState('All');
  const [status,setStatus]=useState('All');
  const [faultFilter,setFaultFilter]=useState('All');
  const [search,setSearch]=useState('');
  const [section,setSection]=useState<'subregion'|'grid'|'fault'|'gridfault'|'status'|'sites'>('subregion');
  const [drill,setDrill]=useState('');
  const [expanded,setExpanded]=useState('');
  const [limit,setLimit]=useState(50);
  const load=async()=>{
    if(!sheetId){setError('No Google Sheet ID provided. Supply sheetId to ElectricityDashboard.');return;}
    setLoading(true);setError('');
    try{
      let raw:Record<string,any>[]=[];
      let sheetError='';
      try{
        const res=await fetchGoogleSheet(sheetId,sheetName);
        const candidate=Array.isArray(res)?res:(res?.rows??[]);
        if(isDeviationWorksheet(candidate))raw=candidate;
        else sheetError=`The Google Sheets service returned a different worksheet (likely ABS / Sheet-1), not "${sheetName}".`;
      }catch(e:any){sheetError=e?.message||'Worksheet request failed.';}
      if(!raw.length){
        try{
          const candidate=await fetchDeviationCsv(sheetId,sheetName);
          if(isDeviationWorksheet(candidate))raw=candidate;
          else throw new Error(`The CSV endpoint did not return the expected Deviation Reasons columns.`);
        }catch(e:any){throw new Error(`${sheetError} Direct worksheet fallback failed: ${e?.message||'Unknown error'}. Check the exact worksheet name, sharing permissions, and Google Sheets service implementation.`);}
      }
      const parsed=parseDeviation(raw);
      if(!parsed.length)throw new Error(`No valid investigation records found in worksheet "${sheetName}".`);
      setRows(parsed);
    }catch(e:any){setError(e?.message||'Unable to fetch deviation reasons.');setRows([]);}
    finally{setLoading(false);}
  };
  useEffect(()=>{load();},[sheetId,sheetName]);
  const regions=[...new Set(rows.map(r=>r.subregion).filter(Boolean))].sort();
  const grids=[...new Set(rows.filter(r=>region==='All'||r.subregion===region).map(r=>r.grid).filter(Boolean))].sort();
  const priorities=[...new Set(rows.map(r=>r.priority).filter(Boolean))].sort();
  const statuses=[...new Set(rows.map(r=>deviationStatus(r.status)))].sort();
  const filtered=rows.filter(r=>(faultFilter==='All'||deviationFaultGroup(`${r.fault} ${r.action}`)===faultFilter)&&(region==='All'||r.subregion===region)&&(grid==='All'||r.grid===grid)&&(priority==='All'||r.priority===priority)&&(status==='All'||deviationStatus(r.status)===status)&&(!search||[r.site,r.grid,r.category,r.fault,r.action].some(v=>v.toLowerCase().includes(search.toLowerCase()))));
  const faultNames=[...new Set(rows.map(r=>deviationFaultGroup(`${r.fault} ${r.action}`)))].sort();
  const faultCards=[['CP Theft / Unauthorized Connection','CP Theft'],['CP Meter Faulty / Missing','CP Meter Faulty'],['CP Meter / Reading Issue','Meter / Reading'],['Billing / Average Bill','Billing Issues'],['Units Criteria Revision','Criteria Revision']];
  // Difference is the source-sheet deviation in units. Positive values represent increases;
  // negative values are reductions and must not cancel out excess-unit contributors.
  const positiveDifference=(r:DeviationRow)=>Number.isFinite(r.difference)?Math.max(0,r.difference):0;
  const differenceTotal=(items:DeviationRow[])=>items.reduce((sum,r)=>sum+positiveDifference(r),0);
  const allPositiveDifference=differenceTotal(rows);
  const faultUnitRanking=[...new Set(rows.map(r=>deviationFaultGroup(`${r.fault} ${r.action}`)))].map(name=>{
    const items=rows.filter(r=>deviationFaultGroup(`${r.fault} ${r.action}`)===name);
    return {name,items,units:differenceTotal(items),sites:new Set(items.map(r=>r.site)).size};
  }).sort((a,b)=>b.units-a.units);
  const closed=filtered.filter(r=>deviationStatus(r.status)==='Closed').length;
  const pending=filtered.filter(r=>deviationStatus(r.status)!=='Closed').length;
  const visited=filtered.filter(r=>r.fault||r.action).length;
  const groups=(key:(r:DeviationRow)=>string)=>{
    const map=new Map<string,DeviationRow[]>();filtered.forEach(r=>{const k=key(r)||'Not Recorded';map.set(k,[...(map.get(k)||[]),r]);});
    return [...map].map(([name,items])=>({name,items,sites:new Set(items.map(x=>x.site)).size,closed:items.filter(x=>deviationStatus(x.status)==='Closed').length,open:items.filter(x=>deviationStatus(x.status)!=='Closed').length,visited:items.filter(x=>x.fault||x.action).length,p1:items.filter(x=>norm(x.priority)==='p1').length,unitDifference:differenceTotal(items)})).sort((a,b)=>b.unitDifference-a.unitDifference);
  };
  const grouped=section==='subregion'?groups(r=>r.subregion):section==='grid'?groups(r=>r.grid):section==='gridfault'?groups(r=>`${r.grid||'Unassigned'} · ${deviationFaultGroup(`${r.fault} ${r.action}`)}`):section==='fault'?groups(r=>deviationFaultGroup(`${r.fault} ${r.action}`)):groups(r=>deviationStatus(r.status));
  const header='px-3 py-3 text-left text-xs font-bold uppercase bg-slate-100 text-slate-700 whitespace-nowrap';
  const cell='px-3 py-3 text-sm text-slate-700 border-t border-slate-100 align-top';
  const exportRows=(items:DeviationRow[],name:string)=>csv(items.map(r=>({'Site ID':r.site,'Sub-region':r.subregion,Grid:r.grid,Priority:r.priority,Category:r.category,'Pay Mode':r.payMode,'Sharing Status':r.sharing,Disco:r.disco,Criteria:r.criteria,'Dec Units':r.units[0],'Jan Units':r.units[1],'Feb Units':r.units[2],'March Units':r.units[3],'Apr Units':r.units[4],'May Units':r.units[5],'Breach 3 Times':r.breach3,'Breach 6 Times':r.breach6,Difference:r.difference,'Incr/Decrease':r.direction,'Detailed Remarks':r.fault,'Action Taken':r.action,'Current Status':r.status})),name);
  const detail=(items:DeviationRow[])=><div className="overflow-x-auto"><table className="w-full min-w-[1200px]"><thead><tr>{['Site','Sub-region','Grid','Priority','Category','Fault / Remarks','Action Taken','Current Status','Difference','View'].map(h=><th key={h} className={header}>{h}</th>)}</tr></thead><tbody>{items.slice(0,limit).map((r,i)=><React.Fragment key={`${r.site}-${i}`}><tr className="hover:bg-emerald-50"><td className={`${cell} font-bold`}>{r.site}</td><td className={cell}>{r.subregion}</td><td className={cell}>{r.grid}</td><td className={cell}>{r.priority}</td><td className={cell}>{r.category}</td><td className={`${cell} max-w-[300px] whitespace-normal`}>{r.fault||'—'}</td><td className={`${cell} max-w-[350px] whitespace-normal`}>{r.action||'—'}</td><td className={cell}><span className={deviationStatus(r.status)==='Closed'?'text-emerald-700 font-bold':'text-amber-700 font-bold'}>{r.status||'Not Recorded'}</span></td><td className={cell}>{Number.isFinite(r.difference)?fmt(r.difference):'—'}</td><td className={cell}><button className="text-emerald-700 font-bold" onClick={()=>setExpanded(expanded===`${r.site}-${i}`?'':`${r.site}-${i}`)}>{expanded===`${r.site}-${i}`?'Hide':'Details'}</button></td></tr>{expanded===`${r.site}-${i}`&&<tr><td colSpan={10} className="p-4 bg-emerald-50"><div className="grid md:grid-cols-2 gap-4 text-sm"><div><b>Detailed Remarks</b><p className="mt-1 whitespace-pre-wrap">{r.fault||'Not recorded'}</p></div><div><b>Action Taken</b><p className="mt-1 whitespace-pre-wrap">{r.action||'Not recorded'}</p></div></div><div className="mt-3 text-xs text-slate-700">Pay Mode: {r.payMode||'—'} · Sharing: {r.sharing||'—'} · DISCO: {r.disco||'—'} · Criteria: {Number.isFinite(r.criteria)?fmt(r.criteria):'—'} · Breach 3: {r.breach3||'—'} · Breach 6: {r.breach6||'—'} · Direction: {r.direction||'—'}</div><div className="mt-2 text-xs text-slate-700">Historical sheet units (Dec–May): {r.units.map((v,j)=>`${['Dec','Jan','Feb','Mar','Apr','May'][j]}: ${v||'—'}`).join(' | ')}</div></td></tr>}</React.Fragment>)}</tbody></table>{items.length>limit&&<p className="p-3 text-xs text-slate-500">Showing {limit} of {items.length} records. Increase Show Rows to see more.</p>}</div>;
  return <div className="p-4 space-y-4">
    <div className="flex flex-wrap justify-between gap-2"><div><h3 className="text-lg font-extrabold">Deviation Reasons · Investigation Control</h3><p className="text-xs text-slate-500">Validated Deviation Reasons worksheet only · Faults grouped by investigation remarks · ABS consumption KPIs remain unchanged</p></div><div className="flex gap-2"><button className="border rounded-lg px-3 py-2 text-sm" onClick={load} disabled={loading}>↻ {loading?'Loading…':'Refresh Reasons'}</button><button className="bg-emerald-700 text-white rounded-lg px-3 py-2 text-sm" onClick={()=>exportRows(filtered,'electricity_deviation_reasons')}>Export CSV</button></div></div>
    {error&&<div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-sm">{error} Worksheet configured: <b>{sheetName}</b>.</div>}
    <div className="flex flex-wrap gap-3">{[['Investigation Records',filtered.length],['Documented Findings / Actions',visited],['Closed',closed],['Not Closed',pending],['P1 Cases',filtered.filter(r=>norm(r.priority)==='p1').length]].map(([label,value])=><div key={String(label)} className="bg-slate-50 border rounded-xl p-3 min-w-[155px]"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-extrabold">{fmt(Number(value))}</p></div>)}</div>
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-extrabold text-slate-900">Unit Difference · Biggest Fault Contributors</h4><p className="text-xs text-slate-500">Source: Deviation Reasons → Difference · Positive increases only · Ranked by units, not number of sites</p></div><button className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white" onClick={()=>csv(faultUnitRanking.map((g,i)=>({Rank:i+1,'Fault Category':g.name,Sites:g.sites,'Positive Unit Difference':g.units,'Share of Excess %':allPositiveDifference?(100*g.units/allPositiveDifference).toFixed(1):'0.0','Average Units per Site':g.sites?Math.round(g.units/g.sites):0})), 'deviation_fault_unit_contributors')}>Export Contributors CSV</button></div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">{faultUnitRanking.slice(0,5).map((g,i)=><button key={g.name} onClick={()=>{setFaultFilter(g.name);setSection('gridfault');setDrill('');}} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:border-emerald-600"><div className="text-xs font-bold text-slate-700">{i+1}. {g.name}</div><div className="text-xl font-extrabold text-rose-700">{fmt(g.units)} <span className="text-xs font-normal">units</span></div><div className="text-xs text-slate-500">{g.sites} sites · {allPositiveDifference?(100*g.units/allPositiveDifference).toFixed(1):'0.0'}% of positive difference</div></button>)}</div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Rank','Fault Category','Sites','Positive Unit Difference','Share of Total','Avg Units / Site','View'].map(h=><th key={h} className={header}>{h}</th>)}</tr></thead><tbody>{faultUnitRanking.map((g,i)=><tr key={g.name}><td className={cell}>{i+1}</td><td className={`${cell} font-semibold`}>{g.name}</td><td className={cell}>{fmt(g.sites)}</td><td className={`${cell} font-bold text-rose-700`}>{fmt(g.units)}</td><td className={cell}>{allPositiveDifference?(100*g.units/allPositiveDifference).toFixed(1):'0.0'}%</td><td className={cell}>{g.sites?fmt(Math.round(g.units/g.sites)):'—'}</td><td className={cell}><button className="font-bold text-emerald-700" onClick={()=>{setFaultFilter(g.name);setSection('gridfault');setDrill('');}}>View Grid / Sites</button></td></tr>)}</tbody></table></div>
      <p className="text-xs text-slate-500">Note: Unit Difference reflects the investigation sheet's recorded difference; it is not independently verified metered savings. Negative differences are excluded from excess-unit rankings.</p>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2"><button onClick={()=>{setFaultFilter('All');setSection('gridfault');setDrill('');}} className={`rounded-xl border p-3 text-left ${faultFilter==='All'?'border-emerald-600 bg-emerald-50':'bg-white'}`}><div className="text-xs font-bold">All Faults</div><div className="text-xl font-extrabold">{fmt(rows.length)}</div></button>{faultCards.map(([key,label])=><button key={key} onClick={()=>{setFaultFilter(faultFilter===key?'All':key);setSection('gridfault');setDrill('');}} className={`rounded-xl border p-3 text-left ${faultFilter===key?'border-emerald-600 bg-emerald-50':'bg-white'}`}><div className="text-xs font-bold">{label}</div><div className="text-xl font-extrabold">{fmt(rows.filter(r=>deviationFaultGroup(`${r.fault} ${r.action}`)===key).length)}</div><div className="text-[10px] text-slate-500">Click to view grid-wise sites</div></button>)}</div>
    <div className="flex flex-wrap gap-2">{[['Sub-region',region,(v:string)=>{setRegion(v);setGrid('All');},['All',...regions]],['Grid',grid,setGrid,['All',...grids]],['Priority',priority,setPriority,['All',...priorities]],['Status',status,setStatus,['All',...statuses]],['Fault Category',faultFilter,setFaultFilter,['All',...faultNames]]].map(([label,value,set,options]:any)=><label key={label} className="text-xs font-bold text-slate-600">{label}<select className="block border rounded-lg px-3 py-2 mt-1 bg-white text-sm" value={value} onChange={e=>set(e.target.value)}>{options.map((x:string)=><option key={x}>{x}</option>)}</select></label>)}<label className="text-xs font-bold text-slate-600">Search<input className="block border rounded-lg px-3 py-2 mt-1 text-sm" placeholder="Site, reason, action" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="text-xs font-bold text-slate-600">Show Rows<select className="block border rounded-lg px-3 py-2 mt-1 bg-white text-sm" value={limit} onChange={e=>setLimit(Number(e.target.value))}>{[25,50,100,250,10000].map(x=><option key={x} value={x}>{x===10000?'All':x}</option>)}</select></label></div>
    <div className="flex flex-wrap gap-2">{([['subregion','Sub-region Summary'],['grid','Grid Summary'],['gridfault','Grid × Fault Summary'],['fault','Fault Reasons'],['status','Status / Visited'],['sites','All Site Investigations']] as const).map(([k,label])=><button key={k} onClick={()=>{setSection(k);setDrill('');setExpanded('');}} className={`px-3 py-2 text-sm rounded-lg font-bold ${section===k?'bg-emerald-600 text-white':'bg-slate-100 text-slate-700'}`}>{label}</button>)}</div>
    {section==='sites'?detail(filtered):<div className="overflow-x-auto"><table className="w-full"><thead><tr>{[section==='subregion'?'Sub-region':section==='grid'?'Grid':section==='gridfault'?'Grid · Fault Category':section==='fault'?'Fault Category':'Current Status','Records','Unique Sites','P1','Documented Findings / Actions','Positive Unit Difference','Closed','Not Closed','View'].map(h=><th key={h} className={header}>{h}</th>)}</tr></thead><tbody>{grouped.map(g=><React.Fragment key={g.name}><tr className="hover:bg-slate-50"><td className={`${cell} font-semibold max-w-[400px] whitespace-normal`}>{g.name}</td><td className={cell}>{fmt(g.items.length)}</td><td className={cell}>{fmt(g.sites)}</td><td className={cell}>{fmt(g.p1)}</td><td className={cell}>{fmt(g.visited)}</td><td className={`${cell} font-bold text-rose-700`}>{fmt(g.unitDifference)}</td><td className={cell}>{fmt(g.closed)}</td><td className={cell}>{fmt(g.open)}</td><td className={cell}><button className="text-emerald-700 font-bold" onClick={()=>setDrill(drill===g.name?'':g.name)}>{drill===g.name?'Hide Sites':'View Sites'}</button></td></tr>{drill===g.name&&<tr><td colSpan={9} className="p-3 bg-emerald-50"><div className="flex justify-between items-center mb-2"><b>{g.name} · {g.items.length} records</b><button className="bg-emerald-700 text-white rounded-lg px-3 py-2 text-xs" onClick={()=>exportRows(g.items,`electricity_deviation_${section}_${g.name.replace(/[^a-z0-9]/gi,'_')}`)}>Export Sites</button></div>{detail(g.items)}</td></tr>}</React.Fragment>)}</tbody></table></div>}
    {!rows.length&&!loading&&!error&&<p className="text-sm text-slate-500">No investigation records loaded.</p>}
  </div>;
}

export interface ElectricityDashboardProps {
  onBack?:()=>void;
  /** Pass already loaded Google Sheet payload to avoid a second request. */
  data?: {rows?:Record<string,any>[]} | Record<string,any>[];
  /** Google spreadsheet ID containing the ABS tab. Required when data is not passed. */
  sheetId?:string;
  /** Exact worksheet tab name, default ABS. */
  sheetName?:string;
  /** Worksheet containing electricity investigation / deviation reasons. */
  deviationSheetName?:string;
  /** Optional site ownership worksheet rows with Site ID, CO, GTL, Zone Lead. */
  ownerData?: {rows?:Record<string,any>[]} | Record<string,any>[];
  /** Cell AVB ownership worksheet (defaults to Sheet-1 in the same workbook). */
  ownerSheetName?:string;
}

/** Grid recovery is a planning scenario, not a claim of verified savings. */
function GridImprovementPlanner({rows,months,ownerOf}:{rows:UnitRow[];months:string[];ownerOf:(site:string)=>{co:string;gtl:string;zoneLead:string}}){
  const [planMonth,setPlanMonth]=useState('');
  const [planRegion,setPlanRegion]=useState('All');
  const [planGrid,setPlanGrid]=useState('All');
  const [recovery,setRecovery]=useState(100);
  const [showSites,setShowSites]=useState('');
  const [query,setQuery]=useState('');
  const activeMonth=months.includes(planMonth)?planMonth:(months[0]||'');
  const period=useMemo(()=>rows.filter(r=>r.month===activeMonth),[rows,activeMonth]);
  const regions=useMemo(()=>[...new Set(period.map(r=>r.subregion).filter(Boolean))].sort(),[period]);
  const availableGrids=useMemo(()=>[...new Set(period.filter(r=>planRegion==='All'||r.subregion===planRegion).map(r=>r.grid).filter(Boolean))].sort(),[period,planRegion]);
  const sites=useMemo(()=>{
    const m=new Map<string,{site:string;grid:string;region:string;type:SiteType;units:number}>();
    period.forEach(r=>{if(planRegion!=='All'&&r.subregion!==planRegion)return;if(planGrid!=='All'&&r.grid!==planGrid)return;
      const key=`${r.grid}::${r.site}`;const old=m.get(key);
      m.set(key,{site:r.site,grid:r.grid,region:r.subregion,type:r.type,units:(old?.units||0)+r.units});
    });
    return [...m.values()];
  },[period,planRegion,planGrid]);
  const eligible=(type:SiteType)=>type==='Single'||type==='Minor Hub'||type==='Major Hub';
  const siteOpportunity=(units:number,type:SiteType)=>eligible(type)?Math.max(0,units-TARGET):0;
  const gridPlans=useMemo(()=>{
    const m=new Map<string,typeof sites>();
    sites.forEach(r=>m.set(r.grid,[...(m.get(r.grid)||[]),r]));
    return [...m].map(([grid,rs])=>{
      const units=rs.reduce((n,r)=>n+r.units,0),target=rs.length*TARGET;
      const gap=Math.max(0,units-target);
      const opportunity=rs.reduce((n,r)=>n+siteOpportunity(r.units,r.type),0);
      const projectedReduction=opportunity*recovery/100;
      const projectedUnits=units-projectedReduction;
      return {grid,region:rs[0]?.region||'',sites:rs.length,units,target,gap,average:rs.length?units/rs.length:0,
        eligibleSites:rs.filter(r=>eligible(r.type)).length,highEligible:rs.filter(r=>siteOpportunity(r.units,r.type)>0).length,
        opportunity,required:Math.min(gap,opportunity),remaining:Math.max(0,projectedUnits-target),
        projectedReduction,projectedUnits,projectedAverage:rs.length?projectedUnits/rs.length:0,
        achievable:opportunity>=gap,records:rs};
    }).sort((a,b)=>b.gap-a.gap||b.opportunity-a.opportunity);
  },[sites,recovery]);
  const totals=useMemo(()=>({units:gridPlans.reduce((n,g)=>n+g.units,0),target:gridPlans.reduce((n,g)=>n+g.target,0),
    sites:gridPlans.reduce((n,g)=>n+g.sites,0),opportunity:gridPlans.reduce((n,g)=>n+g.opportunity,0),
    reduction:gridPlans.reduce((n,g)=>n+g.projectedReduction,0),
    atRisk:gridPlans.filter(g=>g.gap>0).length}),[gridPlans]);
  const siteDetails=(g:typeof gridPlans[number])=>g.records.filter(r=>eligible(r.type)&&siteOpportunity(r.units,r.type)>0&&(r.site.includes(query)||ownerOf(r.site).co.toLowerCase().includes(query.toLowerCase())||ownerOf(r.site).gtl.toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>siteOpportunity(b.units,b.type)-siteOpportunity(a.units,a.type));
  const download=()=>csv(gridPlans.map(g=>({Grid:g.grid,'Sub-region':g.region,Sites:g.sites,'Actual Units':g.units,'Target Units':g.target,'Grid Gap':g.gap,'Eligible Sites':g.eligibleSites,'Eligible High Sites':g.highEligible,'Maximum Eligible Opportunity':g.opportunity,'Scenario Reduction':Math.round(g.projectedReduction),'Projected Units':Math.round(g.projectedUnits),'Projected Avg/Site':Math.round(g.projectedAverage),'Remaining Gap':Math.round(g.remaining),'Can Meet Target At Full Recovery':g.achievable?'Yes':'No'})),`electricity_grid_improvement_${activeMonth}`);
  return <section className="electric-grid-plan bg-white border border-slate-200 rounded-xl overflow-hidden">
    <style>{`
      .electric-grid-plan { font-size: 16px; line-height: 1.55; }
      .electric-grid-plan h2 { font-size: 23px !important; }
      .electric-grid-plan h3 { font-size: 19px !important; }
      .electric-grid-plan p, .electric-grid-plan label, .electric-grid-plan select,
      .electric-grid-plan input, .electric-grid-plan button { font-size: 15px !important; line-height: 1.5; }
      .electric-grid-plan label { font-weight: 700; }
      .electric-grid-plan select, .electric-grid-plan input { min-height: 42px; }
      .electric-grid-plan table { font-size: 15px !important; line-height: 1.55; }
      .electric-grid-plan table th { font-size: 15px !important; padding: 13px 14px !important; white-space: nowrap; }
      .electric-grid-plan table td { font-size: 15px !important; padding: 13px 14px !important; vertical-align: top; }
      .electric-grid-plan table tbody tr { min-height: 46px; }
      .electric-grid-plan .grid-plan-kpi-title { font-size: 15px !important; }
      .electric-grid-plan .grid-plan-kpi-value { font-size: 26px !important; line-height: 1.3; }
      .electric-grid-plan .grid-plan-kpi-note { font-size: 14px !important; }
    `}</style>
    <div className="p-5 border-b flex flex-wrap justify-between items-center gap-3"><div><h2 className="text-xl font-black text-slate-900">Grid Target Improvement · Action Plan</h2><p className="text-sm text-slate-600">ABS Month · Target 3,420 units/site · Corrective actions only at Single, Minor Hub and Major Hub sites</p></div><button className="bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm font-bold" onClick={download}>Export Grid Action Plan CSV</button></div>
    <div className="p-4 flex flex-wrap items-end gap-3 bg-slate-50">
      <label className="text-xs font-bold text-slate-600">ABS MONTH<select className="block mt-1 border rounded-lg bg-white px-3 py-2 text-sm" value={activeMonth} onChange={e=>{setPlanMonth(e.target.value);setShowSites('')}}>{months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-600">SUB-REGION<select className="block mt-1 border rounded-lg bg-white px-3 py-2 text-sm" value={planRegion} onChange={e=>{setPlanRegion(e.target.value);setPlanGrid('All');setShowSites('')}}><option>All</option>{regions.map(r=><option key={r}>{r}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-600">GRID<select className="block mt-1 border rounded-lg bg-white px-3 py-2 text-sm" value={planGrid} onChange={e=>{setPlanGrid(e.target.value);setShowSites('')}}><option>All</option>{availableGrids.map(g=><option key={g}>{g}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-600">ASSUMED RECOVERY<select className="block mt-1 border rounded-lg bg-white px-3 py-2 text-sm" value={recovery} onChange={e=>setRecovery(Number(e.target.value))}>{[25,50,75,100].map(n=><option key={n} value={n}>{n}% of eligible excess</option>)}</select></label>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-4">{[
      ['Sites / Grids',`${fmt(totals.sites)} / ${gridPlans.length}`,'All site types counted in grid target'],
      ['Current Average',fmt(totals.sites?totals.units/totals.sites:0),'Target: 3,420 units/site'],
      ['Overall Target Gap',fmt(Math.max(0,totals.units-totals.target)),'Units above combined target'],
      ['Eligible Reduction Pool',fmt(totals.opportunity),'Single + Minor + Major only'],
      ['Scenario Average',fmt(totals.sites?(totals.units-totals.reduction)/totals.sites:0),`${recovery}% recovery scenario`]
    ].map(([title,value,note])=><div key={title} className="rounded-lg border border-blue-200 p-3 bg-blue-50"><div className="grid-plan-kpi-title text-xs text-slate-600 font-semibold">{title}</div><div className="grid-plan-kpi-value text-xl font-black mt-1">{value}</div><div className="grid-plan-kpi-note text-xs text-slate-500 mt-1">{note}</div></div>)}</div>
    <div className="px-4 pb-3 text-xs text-slate-600">The grid target includes <strong>all sites</strong>, including PTN and Critical Hubs. Only Single, Minor and Major sites enter the recovery pool. A grid with insufficient eligible excess cannot reach target through these sites alone. Scenario savings are estimates, not verified reductions.</div>
    <div className="overflow-x-auto px-4 pb-4"><table className="w-full min-w-[1400px] text-sm"><thead><tr>{['Grid','Region','Sites','Actual Units','Target Units','Gap to Target','Avg/Site','Eligible High Sites','Eligible Excess Pool','Required Reduction','Scenario Avg/Site','Remaining Gap','Action'].map(h=><th key={h} className="px-3 py-3 text-left bg-slate-100 text-xs font-bold text-slate-700 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{gridPlans.map(g=><React.Fragment key={g.grid}><tr className="border-t hover:bg-blue-50"><td className="px-3 py-3 font-extrabold">{g.grid}</td><td className="px-3 py-3">{g.region}</td><td className="px-3 py-3">{fmt(g.sites)}</td><td className="px-3 py-3">{fmt(g.units)}</td><td className="px-3 py-3">{fmt(g.target)}</td><td className={`px-3 py-3 font-bold ${g.gap?'text-rose-700':'text-emerald-700'}`}>{fmt(g.gap)}</td><td className="px-3 py-3">{fmt(g.average)}</td><td className="px-3 py-3">{g.highEligible}</td><td className="px-3 py-3">{fmt(g.opportunity)}</td><td className="px-3 py-3 font-bold">{fmt(g.required)}</td><td className={`px-3 py-3 font-bold ${g.projectedAverage>TARGET?'text-rose-700':'text-emerald-700'}`}>{fmt(g.projectedAverage)}</td><td className="px-3 py-3">{fmt(g.remaining)}</td><td className="px-3 py-3"><button className="text-emerald-700 font-bold" onClick={()=>setShowSites(showSites===g.grid?'':g.grid)}>{showSites===g.grid?'Hide sites':'View action sites'}</button></td></tr>
      {showSites===g.grid&&<tr><td colSpan={13} className="bg-emerald-50 p-4"><div className="flex flex-wrap justify-between gap-3 items-center mb-3"><div><h3 className="font-extrabold">{g.grid} · Priority Action Sites</h3><p className="text-xs text-slate-600">Sorted by excess units. Investigate and validate each proposed action before recognizing savings.</p></div><div className="flex gap-2"><input className="border rounded-lg px-3 py-2 text-sm" placeholder="Site / CO / GTL" value={query} onChange={e=>setQuery(e.target.value)}/><button className="bg-emerald-700 text-white rounded-lg px-3 py-2 text-xs font-bold" onClick={()=>csv(siteDetails(g).map((r,i)=>({Priority:i+1,'Site ID':r.site,Grid:r.grid,'Site Type':r.type,CO:ownerOf(r.site).co,GTL:ownerOf(r.site).gtl,'Zone Lead':ownerOf(r.site).zoneLead,'ABS Month':monthLabel(activeMonth),'Actual Units':r.units,'Site Target':TARGET,'Excess Units':siteOpportunity(r.units,r.type),'Scenario Reduction':Math.round(siteOpportunity(r.units,r.type)*recovery/100),'Suggested Investigation':r.units>TARGET?'Verify CP meter, theft, billing and connected load; inspect AC / rectifier / power equipment':'No action','Status':'Pending validation'})),`electricity_action_sites_${g.grid}_${activeMonth}`)}>Export Action Sites</button></div></div><div className="overflow-x-auto max-h-[500px] overflow-y-auto"><table className="min-w-[1100px] w-full bg-white text-xs"><thead><tr>{['Priority','Site','Type','CO','GTL','Zone Lead','Units','Excess','Scenario Reduction','Recommended Checks'].map(h=><th key={h} className="p-2 text-left bg-slate-200">{h}</th>)}</tr></thead><tbody>{siteDetails(g).map((r,i)=><tr key={r.site} className="border-t"><td className="p-2">{i+1}</td><td className="p-2 font-bold">{r.site}</td><td className="p-2">{r.type}</td><td className="p-2">{ownerOf(r.site).co||'—'}</td><td className="p-2">{ownerOf(r.site).gtl||'—'}</td><td className="p-2">{ownerOf(r.site).zoneLead||'—'}</td><td className="p-2">{fmt(r.units)}</td><td className="p-2 font-bold text-rose-700">{fmt(siteOpportunity(r.units,r.type))}</td><td className="p-2">{fmt(siteOpportunity(r.units,r.type)*recovery/100)}</td><td className="p-2">CP meter / theft / bill verification; AC and rectifier load audit</td></tr>)}</tbody></table></div>{!siteDetails(g).length&&<p className="p-3 text-amber-700">No above-target Single, Minor or Major sites match the current selection.</p>}</td></tr>}</React.Fragment>)}</tbody></table></div>
    <div className="px-4 py-3 bg-slate-50 border-t text-xs text-slate-600">Action sequence: (1) confirm ABS billing and meter reading, (2) prioritize CP theft and faulty meters, (3) audit AC, rectifier, battery charging and abnormal load, (4) rectify and validate against subsequent ABS months. PTN and Critical Hubs are excluded from corrective-action site lists. Do not reduce essential power or cooling to meet the KPI.</div>
  </section>;
}

export default function ElectricityDashboard({onBack,data,sheetId,sheetName='ABS',deviationSheetName='Deviation reasons',ownerData,ownerSheetName='Sheet-1'}:ElectricityDashboardProps){
  const [payload,setPayload]=useState<any>(data??null);
  const [avbOwners,setAvbOwners]=useState<Record<string,any>[]>([]);
  const [ownerError,setOwnerError]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [month,setMonth]=useState('');
  const [region,setRegion]=useState('All');
  const [grid,setGrid]=useState('All');
  const [search,setSearch]=useState('');
  const [view,setView]=useState<'grids'|'sites'|'billing'|'history'|'chronic'>('grids');
  const [mainPage,setMainPage]=useState<'consumption'|'deviation'|'overall'|'improvement'>('consumption');
  const [coFilter,setCoFilter]=useState('All');
  const [gtlFilter,setGtlFilter]=useState('All');
  const [zoneFilter,setZoneFilter]=useState('All');
  const [ownerRank,setOwnerRank]=useState<'CO'|'GTL'|'Zone Lead'>('CO');
  const [typeFilter,setTypeFilter]=useState('All');
  const [minimumMisses,setMinimumMisses]=useState(6);
  const [chronicFailureGroup,setChronicFailureGroup]=useState('atleast-6');
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
  // Ownership is joined by Site ID from Cell AVB Sheet-1, independently of the
  // currently selected ABS month. The main app need not load Cell AVB first.
  useEffect(()=>{
    if(ownerData){setAvbOwners([]);setOwnerError('');return;}
    if(!sheetId)return;
    let cancelled=false;
    setOwnerError('');
    fetchGoogleSheet(sheetId,ownerSheetName).then(result=>{
      if(cancelled)return;
      const rows=Array.isArray(result)?result:result?.rows??[];
      // Reject the common fallback to the ABS worksheet when a tab is absent.
      const matches=rows.slice(0,30).filter((r:any)=>{
        const site=String(lookup(r,['Site ID','SiteID','Name','Site'],0)??'').trim().replace(/\.0$/,'');
        return /^\d{3,7}$/.test(site)&&['Cluster Owner','MS GTL','Zone Lead'].some(k=>lookup(r,[k],-1)!==undefined);
      });
      if(!matches.length)throw new Error(`Worksheet "${ownerSheetName}" did not return Cell AVB ownership columns.`);
      setAvbOwners(rows);
    }).catch(e=>{if(!cancelled){setAvbOwners([]);setOwnerError(e?.message||'Cell AVB ownership lookup failed.');}});
    return ()=>{cancelled=true;};
  },[sheetId,ownerSheetName,ownerData]);
  const all=useMemo(()=>parseRows(Array.isArray(payload)?payload:payload?.rows??[]),[payload]);
  const ownership=useMemo(()=>{
    const map=new Map<string,{co:string;gtl:string;zoneLead:string}>();
    // ABS fields are the fallback; Sheet-1 is the authoritative ownership source.
    for(const r of all){map.set(r.site,{co:r.co,gtl:r.gtl,zoneLead:r.zoneLead});}
    const extra=ownerData?(Array.isArray(ownerData)?ownerData:ownerData?.rows??[]):avbOwners;
    for(const r of extra){
      const site=String(lookup(r,['Site ID','SiteID','Name','Site'],0)??'').trim().replace(/\.0$/,'');
      if(!/^\d{3,7}$/.test(site))continue;
      const old=map.get(site)||{co:'',gtl:'',zoneLead:''};
      map.set(site,{
        co:String(lookup(r,['Cluster Owner','CO'], -1)??'').trim()||old.co,
        gtl:String(lookup(r,['MS GTL','GTL','MPL GTL','Grid Team Lead'], -1)??'').trim()||old.gtl,
        zoneLead:String(lookup(r,['Zone Lead','Zong Lead','CMPAK GTL'], -1)??'').trim()||old.zoneLead,
      });
    }
    return map;
  },[all,ownerData,avbOwners]);
  const ownerOf=(site:string)=>ownership.get(site)||{co:'',gtl:'',zoneLead:''};
  const ownerOptions=(key:'co'|'gtl'|'zoneLead')=>[...new Set([...ownership.values()].map(o=>o[key]).filter(Boolean))].sort();
  const ownerMatch=(site:string)=>{const o=ownerOf(site);return (coFilter==='All'||o.co===coFilter)&&(gtlFilter==='All'||o.gtl===gtlFilter)&&(zoneFilter==='All'||o.zoneLead===zoneFilter);};
  const ownershipControls=<div className="flex flex-wrap items-end gap-3">{([['CO',coFilter,setCoFilter,'co'],['GTL',gtlFilter,setGtlFilter,'gtl'],['Zone Lead',zoneFilter,setZoneFilter,'zoneLead']] as const).map(([label,value,set,key])=><label key={label} className="text-xs font-bold text-slate-600">{label}<select className="block mt-1 border rounded-lg px-3 py-2 bg-white text-sm min-w-36" value={value} onChange={e=>set(e.target.value)}><option value="All">All</option>{ownerOptions(key).map(name=><option key={name} value={name}>{name}</option>)}</select></label>)}{!ownerOptions('co').length&&!ownerOptions('gtl').length&&!ownerOptions('zoneLead').length&&<span className="text-xs text-amber-700">{ownerError||'Ownership not found. Check Cell AVB Sheet-1 columns: Site ID, Cluster Owner, MS GTL, Zone Lead.'}</span>}</div>;
  const months=useMemo(()=>[...new Set(all.map(r=>r.month))].sort().reverse(),[all]);
  const selectedMonth=months.includes(month)?month:(months[0]||'');
  const monthRows=useMemo(()=>all.filter(r=>r.month===selectedMonth),[all,selectedMonth]);
  const regions=useMemo(()=>[...new Set(monthRows.map(r=>r.subregion).filter(Boolean))].sort(),[monthRows]);
  const regionalRows=useMemo(()=>monthRows.filter(r=>region==='All'||r.subregion===region),[monthRows,region]);
  const grids=useMemo(()=>group(regionalRows,'grid'),[regionalRows]);
  const visibleRows=useMemo(()=>regionalRows.filter(r=>grid==='All'||r.grid===grid),[regionalRows,grid]);
  const siteRecords=useMemo(()=>{
    const m=new Map<string,{site:string,grid:string,subregion:string,severity:string,units:number,records:number}>();
    visibleRows.forEach(r=>{const k=r.site,old=m.get(k);m.set(k,{site:k,grid:r.grid,subregion:r.subregion,severity:r.category||r.severity,units:(old?.units||0)+r.units,records:(old?.records||0)+1});});
    return [...m.values()].filter(r=>r.site.includes(search)||r.grid.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.units-a.units);
  },[visibleRows,search]);
  const summary=useMemo(()=>{const s=group(visibleRows,'subregion');const sites=unique(visibleRows),units=sum(visibleRows),billing=siteRecords.filter(r=>r.units>0).length;return {sites,units,billing,zero:sites-billing,avg:sites?units/sites:0,variance:units-sites*TARGET,sub:s};},[visibleRows,siteRecords]);
  const [regionalTopLimit,setRegionalTopLimit]=useState(10);
  const [regionalTopExpanded,setRegionalTopExpanded]=useState<Record<string,boolean>>({'Central-1':true,'Central-6':true});
  const regionalTopSites=useMemo(()=>{
    const groups=new Map<string,Map<string,{site:string,subregion:string,grid:string,type:string,units:number}>>();
    monthRows.forEach(r=>{
      if(region!=='All'&&r.subregion!==region)return;
      if(grid!=='All'&&r.grid!==grid)return;
      if(!groups.has(r.subregion))groups.set(r.subregion,new Map());
      const sites=groups.get(r.subregion)!;
      const old=sites.get(r.site);
      sites.set(r.site,{site:r.site,subregion:r.subregion,grid:r.grid,type:r.type||r.category||r.severity,units:(old?.units||0)+r.units});
    });
    return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([name,sites])=>({name,sites:[...sites.values()].sort((a,b)=>b.units-a.units||a.site.localeCompare(b.site))}));
  },[monthRows,region,grid]);
  const categoryTotals=useMemo(()=>categorySummary(visibleRows),[visibleRows]);
  const gridCategories=useMemo(()=>grids.flatMap(g=>categorySummary(g.rows).map(c=>({...c,grid:g.name}))),[grids]);
  const [categoryGrid,setCategoryGrid]=useState('All');
  const trends=useMemo(()=>months.slice().reverse().map(m=>{const rs=all.filter(r=>r.month===m&&(region==='All'||r.subregion===region)&&(grid==='All'||r.grid===grid));return {month:monthLabel(m),average:unique(rs)?Math.round(sum(rs)/unique(rs)):0,units:sum(rs)};}),[all,months,region,grid]);
  const siteHistory=useMemo(()=>all.filter(r=>r.site===(expandedSite||expanded)).sort((a,b)=>a.month.localeCompare(b.month)),[all,expanded,expandedSite]);
  const chronic=useMemo(()=>{
    const bySite=new Map<string,UnitRow[]>();
    all.filter(r=>(region==='All'||r.subregion===region)&&(grid==='All'||r.grid===grid)).forEach(r=>bySite.set(r.site,[...(bySite.get(r.site)||[]),r]));
    return [...bySite.entries()].filter(([site])=>ownerMatch(site)).flatMap(([site,rows])=>{
      const latest=rows.slice().sort((a,b)=>b.month.localeCompare(a.month))[0];
      if(!['Single','Minor Hub','Major Hub'].includes(latest.type))return [];
      const monthly=new Map<string,number>();rows.forEach(r=>monthly.set(r.month,(monthly.get(r.month)||0)+r.units));
      const monthsObserved=monthly.size;
      const missed=[...monthly.values()].filter(n=>n>TARGET).length;
      const total=[...monthly.values()].reduce((a,b)=>a+b,0);
      const excess=[...monthly.values()].reduce((a,b)=>a+Math.max(0,b-TARGET),0);
      return [{site,type:latest.type,grid:latest.grid,subregion:latest.subregion,missed,monthsObserved,total,average:total/monthsObserved,excess,monthly}];
    }).filter(r=>(chronicFailureGroup==='all'||(chronicFailureGroup.startsWith('atleast-')&&r.missed>=Number(chronicFailureGroup.slice(8)))||(chronicFailureGroup.startsWith('exact-')&&r.monthsObserved===9&&r.missed===Number(chronicFailureGroup.slice(6))))&&(typeFilter==='All'||r.type===typeFilter)&&(r.site.includes(search)||r.grid.toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>b.excess-a.excess||b.missed-a.missed);
  },[all,region,grid,chronicFailureGroup,typeFilter,search,ownership,coFilter,gtlFilter,zoneFilter]);
  // Consolidate by Site ID + ABS Month, avoiding duplicate billing rows counting as extra target failures.
  const annualSites=useMemo(()=>{
    const map=new Map<string,{site:string;grid:string;subregion:string;type:SiteType;monthly:Map<string,number>}>();
    all.forEach(r=>{
      if(region!=='All'&&r.subregion!==region)return;
      if(grid!=='All'&&r.grid!==grid)return;
      if(!ownerMatch(r.site))return;
      const old=map.get(r.site)||{site:r.site,grid:r.grid,subregion:r.subregion,type:r.type,monthly:new Map<string,number>()};
      old.monthly.set(r.month,(old.monthly.get(r.month)||0)+r.units);
      if(r.month >= ([...old.monthly.keys()].sort().slice(-1)[0]||'')){old.grid=r.grid;old.subregion=r.subregion;old.type=r.type;}
      map.set(r.site,old);
    });
    return [...map.values()].map(r=>{
      const vals=[...r.monthly.values()];
      const misses=vals.filter(n=>n>TARGET).length;
      const total=vals.reduce((a,b)=>a+b,0);
      const excess=vals.reduce((a,b)=>a+Math.max(0,b-TARGET),0);
      return {...r,misses,recorded:r.monthly.size,total,excess,average:r.monthly.size?total/r.monthly.size:0};
    }).sort((a,b)=>b.misses-a.misses||b.excess-a.excess||b.total-a.total);
  },[all,region,grid,ownership,coFilter,gtlFilter,zoneFilter]);
  const [annualType,setAnnualType]=useState('All');
  const [annualMisses,setAnnualMisses]=useState(0);
  const [annualFailureGroup,setAnnualFailureGroup]=useState<string>('all');
  const annualVisible=useMemo(()=>annualSites.filter(r=>(annualType==='All'||r.type===annualType)&&r.misses>=annualMisses&&(annualFailureGroup==='all'||(annualFailureGroup==='six'&&r.misses>=6)||(annualFailureGroup==='every'&&r.recorded>0&&r.misses===r.recorded)||(annualFailureGroup==='nine'&&r.recorded===9&&r.misses===9)||(annualFailureGroup.startsWith('exact-')&&r.recorded===9&&r.misses===Number(annualFailureGroup.slice(6))))&&(r.site.includes(search)||r.grid.toLowerCase().includes(search.toLowerCase()))),[annualSites,annualType,annualMisses,annualFailureGroup,search]);
  const rankingSites=mainPage==='overall'?annualVisible:chronic.map(r=>({...r,misses:r.missed,recorded:r.monthsObserved}));
  const ownerRanking=useMemo(()=>{
    const groups=new Map<string,{name:string;sites:number;failures:number;excess:number;units:number;allNine:number}>();
    for(const r of rankingSites){const o=ownerOf(r.site);const name=ownerRank==='CO'?o.co:ownerRank==='GTL'?o.gtl:o.zoneLead;if(!name)continue;
      const g=groups.get(name)||{name,sites:0,failures:0,excess:0,units:0,allNine:0};g.sites++;g.failures+=r.misses;g.excess+=r.excess;g.units+=r.total;if(r.recorded===9&&r.misses===9)g.allNine++;groups.set(name,g);
    }
    return [...groups.values()].sort((a,b)=>b.excess-a.excess||b.failures-a.failures);
  },[rankingSites,ownerRank,ownership]);
  const head='px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 bg-slate-100 whitespace-nowrap';
  const td='px-3 py-3 text-sm text-slate-700 border-t border-slate-100 whitespace-nowrap';
  const rankingPanel=<section className="border rounded-xl overflow-hidden bg-white mt-4"><div className="p-3 flex flex-wrap justify-between gap-2 items-center bg-slate-50"><div><h3 className="font-extrabold">Worst Ownership Performance · {ownerRank}</h3><p className="text-xs text-slate-500">Ranked by excess units · Reflects current site and failure filters</p></div><div className="flex gap-2"><select className="border rounded-lg p-2 text-sm" value={ownerRank} onChange={e=>setOwnerRank(e.target.value as any)}>{['CO','GTL','Zone Lead'].map(x=><option key={x}>{x}</option>)}</select><button className="bg-emerald-700 text-white rounded-lg px-3 py-2 text-xs" onClick={()=>csv(ownerRanking.map((g,i)=>({Rank:i+1,[ownerRank]:g.name,Sites:g.sites,'Failed Site-Months':g.failures,'9/9 Sites':g.allNine,'Total Units':g.units,'Excess Units':g.excess})),`electricity_worst_${ownerRank.replace(/ /g,'_')}`)}>Export Ranking CSV</button></div></div><div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Rank',ownerRank,'Sites','Failed Site-Months','9/9 Sites','Total Units','Excess Units'].map(x=><th key={x} className={head}>{x}</th>)}</tr></thead><tbody>{ownerRanking.map((g,i)=><tr key={g.name}><td className={td}>{i+1}</td><td className={td}>{g.name}</td><td className={td}>{fmt(g.sites)}</td><td className={td}>{fmt(g.failures)}</td><td className={td}>{fmt(g.allNine)}</td><td className={td}>{fmt(g.units)}</td><td className="px-3 py-2 font-bold text-rose-700">{fmt(g.excess)}</td></tr>)}</tbody></table>{!ownerRanking.length&&<p className="p-4 text-xs text-amber-700">No owner assignments available for the current selection. Add CO, GTL and Zone Lead in ABS or provide ownerData.</p>}</div></section>;
  const sidebarItems=[
    {id:'consumption',label:'Consumption Overview',icon:'◫'},
    {id:'overall',label:'All-Month Performance',icon:'▦'},
    {id:'grids',label:'Grid Summary',icon:'▤'},
    {id:'sites',label:'Worst Sites',icon:'⚠'},
    {id:'chronic',label:'Chronic History · Excl. PTN & Critical Hub',icon:'↗'},
    {id:'billing',label:'Billing / Zero Units',icon:'◌'},
    {id:'history',label:'Site History',icon:'▥'},
    {id:'deviation',label:'Deviation Investigations',icon:'☷'},
    {id:'improvement',label:'Grid Improvement Plan',icon:'↗'},
  ] as const;
  const [summaryOnly,setSummaryOnly]=useState(true);
  const currentNav=mainPage==='improvement'?'improvement':mainPage==='deviation'?'deviation':mainPage==='overall'?'overall':summaryOnly?'consumption':view;
  const navigate=(id:string)=>{
    setSearch('');setExpanded('');setExpandedSite('');
    if(id==='deviation'||id==='overall'||id==='improvement'){setMainPage(id);return;}
    setMainPage('consumption');setView(id==='consumption'?'grids':id as typeof view);
    if(id==='consumption')setSummaryOnly(true);
    else setSummaryOnly(false);
  };
  const button=(key:typeof view,label:string)=><button key={key} onClick={()=>setView(key)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${view===key?'bg-emerald-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>;
  return <div className="electricity-premium min-h-screen bg-[#e7f1ff] text-slate-900">
    <style>{`
      .electricity-premium { font-family:Inter,ui-sans-serif,system-ui,sans-serif; }
      .electricity-premium .electricity-header { background:#fff; border-bottom:1px solid #d4e3f6; box-shadow:0 2px 8px rgba(15,65,105,.06); }
      .electricity-premium .electricity-sidebar { background:linear-gradient(180deg,#07543c 0%,#03452f 60%,#023b2a 100%); border:0; border-radius:0; box-shadow:3px 0 14px rgba(4,55,41,.13); color:#d5f5e7; }
      .electricity-premium .electricity-sidebar nav button {color:#d6f4e6; font-weight:600;}
      .electricity-premium .electricity-sidebar nav button:hover {background:#136b4e; color:#fff;}
      .electricity-premium .electricity-sidebar nav button[aria-current="page"] {background:#fff; color:#06583e; box-shadow:0 2px 9px rgba(0,0,0,.1);}
      .electricity-premium .electricity-sidebar .electricity-side-heading {color:#fff;}
      .electricity-premium .electricity-sidebar .electricity-side-note {color:#c1ead8; border-color:#2a8265;}
      .electricity-premium .electricity-main {background:linear-gradient(140deg,#d8eafe 0%,#e7f1ff 40%,#dbeafe 100%); min-height:calc(100vh - 74px);}
      .electricity-premium .electricity-main > section,
      .electricity-premium .electricity-main > div > section,
      .electricity-premium .electricity-main > div > div.rounded-xl,
      .electricity-premium .electricity-main > div > div.grid > div,
      .electricity-premium .electricity-main > div > div.grid > section {border-color:#bfdbfe;box-shadow:0 3px 13px rgba(34,88,150,.07);}
      .electricity-premium .electricity-main .bg-white {background-color:#fff;}
      .electricity-premium .electricity-main .bg-slate-100 {background-color:#eef5fd;}
      .electricity-premium .electricity-main table thead th {background-color:#e8f1fb;color:#16446b;}
      .electricity-premium .electricity-main table tbody tr:hover {background-color:#eefbf6;}
      .electricity-premium .electricity-main button.bg-emerald-700,
      .electricity-premium .electricity-main button.bg-emerald-600 {background-color:#009b70;}
      @media(min-width:1024px){.electricity-premium .electricity-sidebar {position:sticky;top:0;height:calc(100vh - 74px);overflow-y:auto;}}
    `}</style>
    <div className="electricity-header flex flex-wrap items-center justify-between gap-3 px-5 py-4 sticky top-0 z-30"><div className="flex items-center gap-3">{onBack&&<button onClick={onBack} className="p-2 rounded-lg bg-white border border-slate-200" aria-label="Back"><ArrowLeft size={19}/></button>}<div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl"><Zap size={24}/></div><div><h1 className="text-2xl font-extrabold">Electricity Unit Consumption</h1><p className="text-sm text-slate-500">ABS Month reference · Target {fmt(TARGET)} units/site/month · Zong 5G</p></div></div><button onClick={reload} disabled={loading||!sheetId} className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"><RefreshCw size={15} className={loading?'animate-spin':''}/>Refresh ABS</button></div>
    <div className="flex flex-col lg:flex-row items-stretch gap-0">
      <aside className="electricity-sidebar w-full lg:w-64 lg:shrink-0 p-3">
        <div className="electricity-side-heading px-3 py-2 text-xs uppercase tracking-wider font-black">Electricity Navigation</div>
        <nav aria-label="Electricity pages" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-1">
          {sidebarItems.map(item=><button type="button" key={item.id} onClick={()=>navigate(item.id)} aria-current={currentNav===item.id?'page':undefined} className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition ${currentNav===item.id?'bg-white text-emerald-900 shadow-sm':'text-emerald-50 hover:bg-emerald-700'}`}><span aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>)}
        </nav>
        <p className="electricity-side-note px-3 pt-3 text-xs border-t mt-3">ABS Month reporting · Target 3,420 units/site</p>
      </aside>
      <main className="electricity-main w-full min-w-0 flex-1 space-y-5 p-4 lg:p-5">
    {mainPage==='improvement' ? <GridImprovementPlanner rows={all} months={months} ownerOf={ownerOf}/> : mainPage==='overall' ? <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">All-Month Electricity Performance · Worst Target Failures</h2><p className="text-xs text-slate-500">All available ABS months · Ranked by number of months above 3,420 units · Independent of selected ABS month</p></div><button className="bg-emerald-700 text-white rounded-lg px-3 py-2 text-sm font-semibold" onClick={()=>csv(annualVisible.map(r=>({'Site ID':r.site,'Sub-region':r.subregion,Grid:r.grid,'Site Type':r.type,CO:ownerOf(r.site).co,GTL:ownerOf(r.site).gtl,'Zone Lead':ownerOf(r.site).zoneLead,'Months Missed':r.misses,'Months Recorded':r.recorded,'Total Units':r.total,'Average Units':Math.round(r.average),'Excess Units':r.excess,...Object.fromEntries(months.slice().reverse().map(m=>[monthLabel(m),r.monthly.get(m)??'']))})), `electricity_${annualFailureGroup}_sites_${months[0]||'all'}`)}>Export Filtered Sites CSV</button></div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">{[
        {key:'all' as const,label:'Sites reviewed',value:annualSites.length,help:'All sites with at least one ABS month recorded'},
        {key:'six' as const,label:'Missed 6+ months',value:annualSites.filter(r=>r.misses>=6).length,help:'Target exceeded in at least 6 distinct ABS months (of the 9-month Jan–Sep period)'},
        {key:'every' as const,label:'Missed every recorded month',value:annualSites.filter(r=>r.recorded>0&&r.misses===r.recorded).length,help:'Every available month failed; includes sites with fewer than 9 recorded months'},
        {key:'nine' as const,label:'Missed all 9 months',value:annualSites.filter(r=>r.recorded===9&&r.misses===9).length,help:'All 9 months recorded and all 9 exceeded 3,420 units'},
      ].map(item=><button type="button" key={item.key} title={item.help} onClick={()=>{setAnnualFailureGroup(item.key);setAnnualMisses(0);}} className={`rounded-lg border p-3 text-left transition ${annualFailureGroup===item.key?'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600':'bg-slate-50 hover:border-emerald-300'}`}><div className="text-xs font-semibold text-slate-600">{item.label}</div><div className="text-xl font-black mt-1">{fmt(item.value)}</div><div className="text-xs text-slate-500 mt-2">{item.help}</div><div className="text-xs font-bold text-emerald-700 mt-2">View matching sites →</div></button>)}</div>
      <div className="px-4 pb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-600">Click any summary card to filter the complete site table. <strong>Missed / Recorded</strong> shows failed months / months with data, not necessarily 9/9.</p><button className="rounded-lg bg-emerald-700 text-white px-3 py-2 text-xs font-bold" onClick={()=>csv(annualVisible.map(r=>({'Site ID':r.site,'Sub-region':r.subregion,Grid:r.grid,'Site Type':r.type,CO:ownerOf(r.site).co,GTL:ownerOf(r.site).gtl,'Zone Lead':ownerOf(r.site).zoneLead,'Missed Months':r.misses,'Recorded Months':r.recorded,'Total Units':r.total,'Avg/Month':Math.round(r.average),'Excess Units':r.excess,...Object.fromEntries(months.slice().reverse().map(m=>[monthLabel(m),r.monthly.get(m)??'']))})),`electricity_${annualFailureGroup}_site_details`)}>Download {fmt(annualVisible.length)} matching sites (CSV)</button></div>
      <div className="px-4 pt-4 flex flex-wrap gap-3"><label className="text-sm font-semibold">Sub-region <select className="ml-2 border rounded-lg p-2 bg-white" value={region} onChange={e=>{setRegion(e.target.value);setGrid('All')}}><option>All</option>{[...new Set(all.map(r=>r.subregion).filter(Boolean))].sort().map(x=><option key={x}>{x}</option>)}</select></label><label className="text-sm font-semibold">Grid <select className="ml-2 border rounded-lg p-2 bg-white" value={grid} onChange={e=>setGrid(e.target.value)}><option>All</option>{[...new Set(all.filter(r=>region==='All'||r.subregion===region).map(r=>r.grid).filter(Boolean))].sort().map(x=><option key={x}>{x}</option>)}</select></label></div>
      <div className="px-4 pb-4 flex flex-wrap items-center gap-3"><label className="text-sm font-semibold">Site Type <select className="ml-2 border rounded-lg p-2 bg-white" value={annualType} onChange={e=>setAnnualType(e.target.value)}>{['All','Single','Minor Hub','Major Hub','Critical Hub','PTN Node','Other'].map(t=><option key={t}>{t}</option>)}</select></label><label className="text-sm font-semibold">Failure group <select className="ml-2 border rounded-lg p-2 bg-white" value={annualFailureGroup} onChange={e=>{setAnnualFailureGroup(e.target.value);setAnnualMisses(0);}}><option value="all">All sites</option>{Array.from({length:9},(_,i)=>9-i).map(n=><option key={n} value={`exact-${n}`}>{n}/9 failed months</option>)}</select></label><label className="text-sm font-semibold">Missed target <select className="ml-2 border rounded-lg p-2 bg-white" value={annualMisses} onChange={e=>setAnnualMisses(Number(e.target.value))}>{[0,1,3,5,6,7,8,9].map(n=><option key={n} value={n}>{n===0?'All sites':`${n}+ months`}</option>)}</select></label><label className="text-sm font-semibold">Search <input className="ml-2 border rounded-lg p-2" placeholder="Site ID / grid" value={search} onChange={e=>setSearch(e.target.value)}/></label><span className="text-sm text-slate-500">{fmt(annualVisible.length)} sites</span></div>
      <div className="px-4 pb-3">{ownershipControls}</div>
      {rankingPanel}
      <div className="overflow-auto max-h-[720px]"><table className="min-w-[1550px] w-full"><thead className="sticky top-0 z-10"><tr>{['Rank','Site ID','Sub-region','Grid','Site Type','CO','GTL','Zone Lead','Missed / Recorded','Total Units','Avg/Month','Excess Units',...months.slice().reverse().map(monthLabel)].map(h=><th key={h} className={head}>{h}</th>)}</tr></thead><tbody>{annualVisible.map((r,i)=><tr key={r.site} className="hover:bg-emerald-50"><td className={td}>{i+1}</td><td className={`${td} font-bold text-blue-700`}>{r.site}</td><td className={td}>{r.subregion}</td><td className={td}>{r.grid}</td><td className={td}>{r.type}</td><td className={td}>{ownerOf(r.site).co||'—'}</td><td className={td}>{ownerOf(r.site).gtl||'—'}</td><td className={td}>{ownerOf(r.site).zoneLead||'—'}</td><td className={`${td} font-extrabold ${r.misses>=6?'text-rose-700':''}`}>{r.misses}/{r.recorded}</td><td className={td}>{fmt(r.total)}</td><td className={td}>{fmt(r.average)}</td><td className={`${td} font-bold text-rose-700`}>{fmt(r.excess)}</td>{months.slice().reverse().map(m=>{const v=r.monthly.get(m);return <td key={m} className={`${td} ${v!==undefined&&v>TARGET?'bg-rose-50 text-rose-700 font-bold':''}`}>{v===undefined?'—':fmt(v)}</td>})}</tr>)}</tbody></table></div>
      <p className="p-4 text-xs text-slate-500 border-t">Exact N/9 filters require all nine ABS months recorded, with exactly N failed months. 6+ means 6 to 9 failed months. Every recorded month can include sites with incomplete history (e.g. 4/4); use 9 of 9 for complete-year failures. Download exports the currently filtered sites. Failure count = number of distinct ABS months with total site consumption above 3,420 units. Months without data are not counted as passes or failures. Excess units are summed only for months above target.</p>
    </section> : mainPage==='deviation' ? <section className="bg-white border border-slate-200 rounded-xl p-4 md:p-5"><DeviationReasonsTab sheetId={sheetId} sheetName={deviationSheetName}/></section> : <>
    {summaryOnly&&<React.Fragment>
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
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-extrabold">C-1 & C-6 · Top Electricity Consumption Sites</h2><p className="text-xs text-slate-500">Highest-consuming sites in {monthLabel(selectedMonth)} (ABS Month) · Target {fmt(TARGET)} units/site · Click a region to expand</p></div>
        <label className="text-sm font-semibold text-slate-600">Show top <select aria-label="Top consumption sites per region" value={regionalTopLimit} onChange={e=>setRegionalTopLimit(Number(e.target.value))} className="ml-2 border rounded-lg px-2 py-2 bg-white">{[5,10,20,25,50,100,5000].map(n=><option key={n} value={n}>{n===5000?'All':n}</option>)}</select></label>
      </div>
      {regionalTopSites.map(g=><div key={g.name} className="border-b last:border-b-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50">
          <button className="font-bold text-slate-900 flex items-center gap-2" onClick={()=>setRegionalTopExpanded(old=>({...old,[g.name]:!old[g.name]}))}>{g.name} · {fmt(g.sites.length)} sites {regionalTopExpanded[g.name]?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>
          <button className="bg-emerald-700 text-white rounded-lg px-3 py-2 text-xs font-bold" onClick={()=>csv(g.sites.map((r,i)=>({Rank:i+1,'Site ID':r.site,'Sub-region':r.subregion,Grid:r.grid,'Site Type':r.type,CO:ownerOf(r.site).co,GTL:ownerOf(r.site).gtl,'Zone Lead':ownerOf(r.site).zoneLead,'ABS Month':monthLabel(selectedMonth),Units:r.units,Target:TARGET,'Excess Units':Math.max(0,r.units-TARGET),Status:r.units>TARGET?'Above target':r.units===0?'Zero units':'On target'})),`electricity_top_sites_${g.name}_${selectedMonth}`)}>Export {g.name} CSV</button>
        </div>
        {regionalTopExpanded[g.name]&&<div className="overflow-x-auto"><table className="w-full min-w-[950px]"><thead><tr>{['Rank','Site ID','Grid','Site Type','ABS Month','Units','Target','Excess Units','Status'].map(h=><th key={h} className={head}>{h}</th>)}</tr></thead><tbody>{g.sites.slice(0,regionalTopLimit).map((r,i)=><tr key={r.site} className="hover:bg-emerald-50"><td className={td}>{i+1}</td><td className={`${td} font-bold text-blue-700`}>{r.site}</td><td className={td}>{r.grid}</td><td className={td}>{r.type}</td><td className={td}>{monthLabel(selectedMonth)}</td><td className={`${td} font-bold`}>{fmt(r.units)}</td><td className={td}>{fmt(TARGET)}</td><td className={`${td} font-bold ${r.units>TARGET?'text-rose-700':'text-emerald-700'}`}>{fmt(Math.max(0,r.units-TARGET))}</td><td className={td}>{r.units>TARGET?'Above target':r.units===0?'Zero units':'On target'}</td></tr>)}</tbody></table></div>}
      </div>)}
    </section>
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold text-lg">Site Type · Target vs Achievement</h2><p className="text-xs text-slate-500">ABS {monthLabel(selectedMonth)} · Five standardized dependency categories · 3,420 units/site target</p></div><button className="px-3 py-2 text-xs font-bold text-white bg-emerald-700 rounded-lg" onClick={()=>csv(categoryTotals.map(c=>({'Site Type':c.type,Sites:c.sites,'Billing Sites':c.billing,'Zero Units':c.zero,'Total Units':c.units,'Target Units':c.target,'Avg/Site':Math.round(c.average),'Variance/Site':Math.round(c.average-TARGET),Status:c.average>TARGET?'Above target':'On target'})),`electricity_site_types_${selectedMonth}`)}>Export Category CSV</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[950px]"><thead><tr>{['Site Type','Sites','Billing','Zero','Total Units','Target Units','Avg / Site','Variance / Site','Status'].map(h=><th key={h} className={head}>{h}</th>)}</tr></thead><tbody>{categoryTotals.map(c=><tr key={c.type} className="hover:bg-slate-50"><td className={`${td} font-bold`}>{c.type}</td><td className={td}>{fmt(c.sites)}</td><td className={td}>{fmt(c.billing)}</td><td className={td}>{fmt(c.zero)}</td><td className={td}>{fmt(c.units)}</td><td className={td}>{fmt(c.target)}</td><td className={td}>{fmt(c.average)}</td><td className={`${td} font-bold ${c.average>TARGET?'text-rose-700':'text-emerald-700'}`}>{c.average>TARGET?'+':''}{fmt(c.average-TARGET)}</td><td className={td}>{c.average>TARGET?'Above target':'On target'}</td></tr>)}</tbody></table></div>
    </section>
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold text-lg">Grid × Site Type · Consumption Summary</h2><p className="text-xs text-slate-500">Every grid broken down into Single, Minor Hub, Major Hub, Critical Hub and PTN Node</p></div><div className="flex flex-wrap gap-2 items-center"><select aria-label="Category grid" value={categoryGrid} onChange={e=>setCategoryGrid(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white"><option value="All">All grids</option>{grids.map(g=><option key={g.name} value={g.name}>{g.name}</option>)}</select><button className="px-3 py-2 text-xs font-bold text-white bg-emerald-700 rounded-lg" onClick={()=>csv(gridCategories.filter(c=>categoryGrid==='All'||c.grid===categoryGrid).map(c=>({Grid:c.grid,'Site Type':c.type,Sites:c.sites,'Billing Sites':c.billing,'Zero Units':c.zero,'Total Units':c.units,'Target Units':c.target,'Avg/Site':Math.round(c.average),'Variance/Site':Math.round(c.average-TARGET),Status:c.average>TARGET?'Above target':'On target'})),`electricity_grid_categories_${selectedMonth}`)}>Export Grid Categories CSV</button></div></div>
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto"><table className="w-full min-w-[1050px]"><thead className="sticky top-0 z-10"><tr>{['Grid','Site Type','Sites','Billing','Zero','Total Units','Target Units','Avg / Site','Variance / Site','Status'].map(h=><th key={h} className={head}>{h}</th>)}</tr></thead><tbody>{gridCategories.filter(c=>categoryGrid==='All'||c.grid===categoryGrid).map(c=><tr key={`${c.grid}-${c.type}`} className="hover:bg-emerald-50"><td className={`${td} font-bold`}>{c.grid}</td><td className={td}>{c.type}</td><td className={td}>{fmt(c.sites)}</td><td className={td}>{fmt(c.billing)}</td><td className={td}>{fmt(c.zero)}</td><td className={td}>{fmt(c.units)}</td><td className={td}>{fmt(c.target)}</td><td className={td}>{fmt(c.average)}</td><td className={`${td} font-bold ${c.average>TARGET?'text-rose-700':'text-emerald-700'}`}>{c.average>TARGET?'+':''}{fmt(c.average-TARGET)}</td><td className={td}>{c.average>TARGET?'Above target':'On target'}</td></tr>)}</tbody></table></div>
    </section>
    </React.Fragment>}
    {!summaryOnly&&    <section className="bg-white border rounded-xl overflow-hidden"><div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b"><div><h2 className="text-lg font-extrabold">Electricity Performance · Drill-down</h2><p className="text-xs text-slate-500">Worst sites ranked by units; site history shows all ABS months.</p></div></div>
    {view==='chronic'&&<div className="px-4 pt-4 flex flex-wrap gap-3 items-center"><label className="text-sm font-semibold">Site type <select className="ml-2 border rounded-lg px-3 py-2 bg-white" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>{['All','Single','Minor Hub','Major Hub'].map(t=><option key={t}>{t}</option>)}</select></label><label className="text-sm font-semibold">Failure group <select className="ml-2 border rounded-lg px-3 py-2 bg-white" value={chronicFailureGroup} onChange={e=>setChronicFailureGroup(e.target.value)}><option value="all">All low-dependency sites</option><option value="atleast-6">6+ failed months</option>{Array.from({length:9},(_,i)=>9-i).map(n=><option key={n} value={`exact-${n}`}>{n}/9 failed months</option>)}</select></label><span className="text-sm font-bold text-rose-700">{fmt(chronic.length)} chronic sites</span><span className="text-xs text-slate-500">Jan–Sep ABS months · excludes Critical Hub and PTN</span></div>}
    {view==='chronic'&&<div className="px-4 pt-3">{ownershipControls}{rankingPanel}</div>}
    {<div className="p-4 flex flex-wrap items-center justify-between gap-2"><div className="relative"><Search size={16} className="absolute top-3 left-3 text-slate-400"/><input className="border rounded-lg pl-9 pr-3 py-2 text-sm" placeholder="Search site or grid" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="flex gap-2"><select value={limit} onChange={e=>setLimit(Number(e.target.value))} className="border rounded-lg px-2 text-sm bg-white">{[10,25,50,100,5000].map(n=><option key={n} value={n}>{n===5000?'All':`Top ${n}`}</option>)}</select><button className="flex items-center gap-1 bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm" onClick={()=>csv(view==='chronic'?chronic.map(c=>({'Site ID':c.site,'Site Type':c.type,'Sub-region':c.subregion,Grid:c.grid,CO:ownerOf(c.site).co,GTL:ownerOf(c.site).gtl,'Zone Lead':ownerOf(c.site).zoneLead,'Months Above Target':c.missed,'Months Recorded':c.monthsObserved,'Total Units':c.total,'Average Per Month':Math.round(c.average),'Excess Units':c.excess,...Object.fromEntries([...c.monthly].sort().map(([m,u])=>[monthLabel(m),u]))})):view==='grids'?grids.map(g=>({Grid:g.name,Sites:g.sites,'Billing Sites':g.billing,'Zero Units':g.zero,'Total Units':g.units,'Target Units':g.target,'Average Per Site':g.average,'Variance Per Site':g.average-TARGET})):siteRecords.map(s=>({'Site ID':s.site,Grid:s.grid,'Sub Region':s.subregion,'Site Severity':s.severity,'ABS Month':selectedMonth,'Total Units':s.units,'Excess Units':Math.max(0,s.units-TARGET)})),`electricity_${view}_${selectedMonth}`)}><Download size={15}/>CSV</button></div></div>}
    {view==='chronic'&&<div className="overflow-x-auto px-4 pb-4"><table className="w-full min-w-[1150px]"><thead><tr>{['Site ID','Site Type','Sub-region','Grid','CO','GTL','Zone Lead','Missed / Recorded','Total Units','Avg / Month','Excess Units','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep'].map(h=><th key={h} className={head}>{h}</th>)}</tr></thead><tbody>{chronic.slice(0,limit).map(c=><tr key={c.site} className="hover:bg-rose-50"><td className={`${td} font-bold text-blue-700`}>{c.site}</td><td className={td}>{c.type}</td><td className={td}>{c.subregion}</td><td className={td}>{c.grid}</td><td className={td}>{ownerOf(c.site).co||'—'}</td><td className={td}>{ownerOf(c.site).gtl||'—'}</td><td className={td}>{ownerOf(c.site).zoneLead||'—'}</td><td className={`${td} font-bold text-rose-700`}>{c.missed}/{c.monthsObserved}</td><td className={td}>{fmt(c.total)}</td><td className={td}>{fmt(c.average)}</td><td className={`${td} font-bold text-rose-700`}>{fmt(c.excess)}</td>{Array.from({length:9},(_,i)=>{const key=`2026-${String(i+1).padStart(2,'0')}`;const v=c.monthly.get(key);return <td key={key} className={`${td} ${v!==undefined&&v>TARGET?'bg-rose-50 font-bold text-rose-700':'text-slate-600'}`}>{v===undefined?'—':fmt(v)}</td>})}</tr>)}</tbody></table></div>}
    {view!=='chronic'&&<div className="overflow-x-auto"><table className="w-full"><thead><tr>{(view==='grids'?['Grid','Sites','Billing','Zero','Total Units','Target Units','Avg/Site','Variance/Site','Status','View']:['Site ID','Grid','Sub-region','Site Type','Total Units','Excess Units','Status','History']).map(h=><th key={h} className={head}>{h}</th>)}</tr></thead><tbody>
      {view==='grids'?grids.filter(g=>g.name.toLowerCase().includes(search.toLowerCase())).slice(0,limit).map(g=><React.Fragment key={g.name}><tr className="hover:bg-slate-50"><td className={`${td} font-bold`}>{g.name}</td><td className={td}>{fmt(g.sites)}</td><td className={td}>{fmt(g.billing)}</td><td className={td}>{fmt(g.zero)}</td><td className={td}>{fmt(g.units)}</td><td className={td}>{fmt(g.target)}</td><td className={td}>{fmt(g.average)}</td><td className={`${td} ${g.average>TARGET?'text-rose-600':'text-emerald-700'}`}>{g.average>TARGET?'+':''}{fmt(g.average-TARGET)}</td><td className={td}>{g.average>TARGET?'Over target':'On target'}</td><td className={td}><button className="text-emerald-700 font-semibold flex items-center gap-1" onClick={()=>setExpanded(expanded===g.name?'':g.name)}>Sites {expanded===g.name?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</button></td></tr>{expanded===g.name&&<tr><td colSpan={10} className="bg-emerald-50 p-4"><div className="flex justify-between items-center mb-3"><div><h3 className="font-extrabold text-slate-950">{g.name} · Complete Site Consumption</h3><p className="text-xs text-slate-600">All sites · ABS {monthLabel(selectedMonth)} · Target {fmt(TARGET)} units/site</p></div><button className="bg-emerald-700 text-white rounded-lg px-3 py-2 text-xs font-bold" onClick={()=>csv([...new Map(g.rows.map(r=>[r.site,r])).values()].map(r=>{const units=g.rows.filter(x=>x.site===r.site).reduce((a,x)=>a+x.units,0);return {'Site ID':r.site,'Sub-region':r.subregion,Grid:r.grid,Classification:r.category||r.severity,'ABS Month':monthLabel(selectedMonth),'Billed Month':r.billedMonth?monthLabel(r.billedMonth):'',Units:units,Target:TARGET,Variance:units-TARGET,Status:units===0?'Zero units':units>TARGET?'Above target':'On target'};}),`electricity_${g.name}_${selectedMonth}`)}>Export Sites CSV</button></div><div className="overflow-x-auto max-h-[560px] overflow-y-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-[1250px] w-full text-sm"><thead className="sticky top-0 z-10 bg-slate-900"><tr>{['Site ID','Sub-region','Grid','Classification','ABS Month','Billed Month','Units','Target','Variance','Status','History'].map(h=><th key={h} className="px-3 py-3 text-left text-xs font-black !text-white whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{[...new Map(g.rows.map(r=>[r.site,r])).values()].map(r=>({...r,siteUnits:g.rows.filter(x=>x.site===r.site).reduce((a,x)=>a+x.units,0)})).sort((a,b)=>b.siteUnits-a.siteUnits).map(r=><React.Fragment key={r.site}><tr className="border-b border-slate-100 even:bg-slate-50 hover:bg-emerald-50"><td className="px-3 py-2 font-bold text-blue-700">{r.site}</td><td className={td}>{r.subregion}</td><td className={td}>{r.grid}</td><td className={td}>{r.category||r.severity||'—'}</td><td className={td}>{monthLabel(r.month)}</td><td className={td}>{r.billedMonth?monthLabel(r.billedMonth):'—'}</td><td className={`${td} font-bold`}>{fmt(r.siteUnits)}</td><td className={td}>{fmt(TARGET)}</td><td className={`${td} font-bold ${r.siteUnits>TARGET?'text-rose-700':'text-emerald-700'}`}>{r.siteUnits>TARGET?'+':''}{fmt(r.siteUnits-TARGET)}</td><td className={td}>{r.siteUnits===0?'Zero units':r.siteUnits>TARGET?'Above target':'On target'}</td><td className={td}><button className="font-bold text-emerald-700" onClick={()=>setExpandedSite(expandedSite===r.site?"":r.site)}>View months</button></td></tr>{expandedSite===r.site&&<tr><td colSpan={11} className="p-3 bg-emerald-50"><table className="w-full text-sm"><thead><tr>{['ABS Month','Billed Month','Units','Target','Variance','Status'].map(h=><th key={h} className={head}>{h}</th>)}</tr></thead><tbody>{all.filter(x=>x.site===r.site).sort((a,b)=>a.month.localeCompare(b.month)).map((h,i)=><tr key={i}><td className={td}>{monthLabel(h.month)}</td><td className={td}>{h.billedMonth?monthLabel(h.billedMonth):'—'}</td><td className={td}>{fmt(h.units)}</td><td className={td}>{fmt(TARGET)}</td><td className={td}>{fmt(h.units-TARGET)}</td><td className={td}>{h.units===0?'Zero units':h.units>TARGET?'Above target':'On target'}</td></tr>)}</tbody></table></td></tr>}</React.Fragment>)}</tbody></table></div></td></tr>}</React.Fragment>):siteRecords.filter(s=>view==='billing'?s.units===0:view==='sites'?s.units>TARGET:true).slice(0,limit).map(s=><React.Fragment key={s.site}><tr className="hover:bg-slate-50"><td className={`${td} font-bold`}>{s.site}</td><td className={td}>{s.grid}</td><td className={td}>{s.subregion}</td><td className={td}>{s.severity}</td><td className={td}>{fmt(s.units)}</td><td className={`${td} ${s.units>TARGET?'text-rose-600 font-semibold':''}`}>{fmt(Math.max(0,s.units-TARGET))}</td><td className={td}>{s.units===0?'Zero billing':s.units>TARGET?'Above target':'On target'}</td><td className={td}><button className="text-emerald-700 font-semibold" onClick={()=>setExpanded(expanded===s.site?'':s.site)}>View months</button></td></tr>{expanded===s.site&&<tr><td colSpan={8} className="p-4 bg-emerald-50"><div className="font-bold mb-2">Site {s.site} · ABS Month history</div><div className="overflow-x-auto rounded-lg border bg-white"><table className="min-w-[850px] w-full text-sm"><thead><tr>{['ABS Month','Billed Month','Site ID','Grid','Classification','Units','Target','Variance','Status'].map(h=><th key={h} className={head}>{h}</th>)}</tr></thead><tbody>{siteHistory.map((h,i)=><tr key={i}><td className={td}>{monthLabel(h.month)}</td><td className={td}>{h.billedMonth?monthLabel(h.billedMonth):'—'}</td><td className={td}>{h.site}</td><td className={td}>{h.grid}</td><td className={td}>{h.severity}</td><td className={td}>{fmt(h.units)}</td><td className={td}>{fmt(TARGET)}</td><td className={td}>{fmt(h.units-TARGET)}</td><td className={td}>{h.units===0?'Zero units':h.units>TARGET?'Above target':'On target'}</td></tr>)}</tbody></table></div></td></tr>}</React.Fragment>)}
    </tbody></table>{!all.length&&!loading&&<div className="p-8 text-center text-slate-500">No valid ABS consumption rows loaded. Check the Google worksheet and permissions.</div>}</div>}
    <div className="border-t bg-slate-50 px-4 py-3 text-xs text-slate-500">Method: each unique site is counted once per ABS Month. Total units are summed by site. Target = 3,420 × distinct sites. Zero-unit sites are included in the official average and displayed separately for billing audit. High-load PTN/hub sites require load-based review.</div></section>}
    </>}
      </main>
    </div>
  </div>;
}
