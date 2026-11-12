import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

type Raw = Record<string, unknown>;
type Issue = {key:string; label:string; action:string; value:string};
type Site = {id:string; region:string; grid:string; group:string; vendor:string; connectivity:string; raw:Raw; issues:Issue[]};
const TABLE='cell_avb_c1c6_rms_analysis';
const txt=(x:unknown)=>x===null||x===undefined?'':String(x).trim();
const missing=(x:unknown)=>!txt(x)||txt(x)==='-';
const number=(x:unknown):number|null=>missing(x)||!Number.isFinite(Number(x))?null:Number(x);
const positive=(x:unknown)=>{const n=number(x);return n!==null&&n>0};
const normalized=(x:unknown)=>txt(x).toLowerCase().replace(/[^a-z0-9]/g,'');
const indicator=(x:unknown)=>positive(x)||/^(yes|true|fault|faulty|eol li-ion|smr short|overload|phase missing|missing)$/i.test(txt(x));
const issue=(key:string,label:string,action:string,value:unknown):Issue=>({key,label,action,value:txt(value)});
function assess(r:Raw):Issue[]{
 const a:Issue[]=[];
 const add=(test:boolean,key:string,label:string,action:string,v:unknown)=>{if(test)a.push(issue(key,label,action,v))};
 add(!missing(r['Phase Missing due to SMR'])&&/smr|missing/i.test(txt(r['Phase Missing due to SMR'])),'phase_smr','Phase Missing — SMR Shortage','Install/restore required SMR modules',r['Phase Missing due to SMR']);
 add(!missing(r['Actual Phase Missing'])&&/phase missing/i.test(txt(r['Actual Phase Missing'])),'phase_actual','Actual Phase Missing','Check incoming AC phases and restore supply',r['Actual Phase Missing']);
 add(positive(r['Extra SMR']),'donor','Extra SMR — Donor Candidate','Validate spare capacity and assess SMR redistribution',r['Extra SMR']);
 add(positive(r['SMR Deficiency'])||/smr short/i.test(txt(r['SMR required'])),'smr_short','SMR Shortage','Arrange and install required SMR modules',!missing(r['SMR Deficiency'])?r['SMR Deficiency']:r['SMR required']);
 add(indicator(r['EOL Li-ion']),'eol','EOL Li-ion','Replace end-of-life Li-ion battery',r['EOL Li-ion']);
 add(positive(r['SOH <60']),'soh','SOH Below 60%','Urgent battery health validation and replacement',r['SOH <60']);
 const llvd=number(r['LLVD-1']);add(llvd!==null&&llvd<47,'llvd','LLVD-1 Below 47 V','Correct LLVD-1 rectifier setting to approved value',r['LLVD-1']);
 const blvd=number(r['BLVD']);add(blvd!==null&&blvd<46,'blvd','BLVD Below 46 V','Correct BLVD setting to approved value',r['BLVD']);
 const charging=number(r['Charging Coefficient']);add(charging!==null&&charging>0.5,'charging','Charging Coefficient >0.5','Correct charging coefficient to approved value',r['Charging Coefficient']);
 add(positive(r['ZTE 50AH']),'zte50','ZTE 50Ah Li-ion','Verify 50Ah module EOL status and arrange replacement',r['ZTE 50AH']);
 add(positive(r['Huawei 50AH']),'huawei50','Huawei 50Ah Li-ion','Verify 50Ah module EOL status and arrange replacement',r['Huawei 50AH']);
 add(indicator(r['Sys Overload']),'overload','System Overload','Verify total load, SMR output and load distribution',r['Sys Overload']);
 const c=normalized(r['RMS connected']);add(c==='disconnected','disconnected','RMS Disconnected','Restore RMS connectivity and verify telemetry',r['RMS connected']);
 return a;
}
async function fetchAll(client:SupabaseClient,table:string,order:string):Promise<Raw[]>{
 const result:Raw[]=[];
 for(let start=0;start<100000;start+=1000){
  const {data,error}=await client.from(table).select('*').order(order,{ascending:true}).range(start,start+999);
  if(error)throw new Error(error.message);
  result.push(...(data||[]) as Raw[]);
  if(!data||data.length<1000)break;
 }
 return result;
}
function csv(name:string,headers:string[],rows:unknown[][]){
 const body=[headers,...rows].map(row=>row.map(x=>'"'+txt(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
const card:React.CSSProperties={background:'#fff',border:'1px solid #d8e8e2',borderRadius:14,padding:15,minWidth:0};
const button:React.CSSProperties={border:'1px solid #b9dccb',background:'#eaf8f0',borderRadius:8,padding:'9px 12px',color:'#086943',cursor:'pointer',fontWeight:700};
type Tab='issues'|'phase'|'smr'|'rectifier'|'eol'|'soh'|'all';
const tabItems:{id:Tab;name:string}[]=[{id:'issues',name:'RMS Discrepancies'},{id:'phase',name:'Missing Phase'},{id:'smr',name:'SMR Shortage vs Donor'},{id:'rectifier',name:'Rectifier Wrong Settings'},{id:'eol',name:'EOL Li-ion'},{id:'soh',name:'SOH <60%'},{id:'all',name:'All RMS Sites'}];
const relevant=(s:Site,t:Tab)=>t==='issues'?s.issues.some(i=>i.key!=='donor'):t==='phase'?s.issues.some(i=>i.key==='phase_actual'||i.key==='phase_smr'):t==='smr'?s.issues.some(i=>i.key==='smr_short'||i.key==='donor'):t==='rectifier'?s.issues.some(i=>['llvd','blvd','charging'].includes(i.key)):t==='eol'?s.issues.some(i=>i.key==='eol'):t==='soh'?s.issues.some(i=>i.key==='soh'):true;
const isShort=(s:Site)=>s.issues.some(i=>i.key==='smr_short');
const isDonor=(s:Site)=>s.issues.some(i=>i.key==='donor');
const need=(s:Site)=>Math.max(0,number(s.raw['SMR Deficiency'])??(isShort(s)?1:0));
const available=(s:Site)=>Math.max(0,number(s.raw['Extra SMR'])??0);
function donorPlan(sites:Site[]){
 const donors=sites.filter(isDonor).map(s=>({site:s,left:available(s)}));
 const shortages=sites.filter(isShort).sort((a,b)=>need(b)-need(a));
 const output:{to:Site;from:Site;qty:number;scope:string}[]=[];
 for(const target of shortages){let remaining=need(target);if(!remaining)continue;
  const candidates=donors.filter(d=>d.left>0&&d.site.id!==target.id&&d.site.region===target.region).sort((a,b)=>Number(b.site.grid===target.grid)-Number(a.site.grid===target.grid)||b.left-a.left);
  for(const d of candidates){if(!remaining)break;const qty=Math.min(remaining,d.left);output.push({to:target,from:d.site,qty,scope:d.site.grid===target.grid?'Same grid':'Same sub-region'});d.left-=qty;remaining-=qty;}
 }
 return output;
}
// Category-specific evidence columns. Full master data remains in the site View modal.
const categoryColumns:Record<Tab,string[]>={
 issues:['Sub-Region','Grid','SiteClassification','BB Type','Li-ion capacity','RMS Vendor','RMS connected','Actual Phase Missing','Phase Missing due to SMR','SMR Deficiency','Extra SMR','LLVD-1','BLVD','Charging Coefficient','EOL Li-ion','SOH <60','ZTE 50AH','Huawei 50AH','Sys Overload'],
 phase:['Sub-Region','Grid','SiteClassification','RMS Vendor','RMS connected','Actual Phase Missing','Phase Missing due to SMR','SMR Deficiency','SMR required','Extra SMR'],
 smr:['Sub-Region','Grid','SiteClassification','RMS Vendor','RMS connected','SMR Deficiency','SMR required','Extra SMR','Sys Overload'],
 rectifier:['Sub-Region','Grid','SiteClassification','BB Type','Li-ion capacity','RMS Vendor','RMS connected','LLVD-1','BLVD','Charging Coefficient'],
 eol:['Sub-Region','Grid','SiteClassification','BB Type','Li-ion capacity','RMS Vendor','EOL Li-ion','ZTE 50AH','Huawei 50AH','SOH <60'],
 soh:['Sub-Region','Grid','SiteClassification','BB Type','Li-ion capacity','RMS Vendor','SOH <60','EOL Li-ion','ZTE 50AH','Huawei 50AH'],
 all:[]
};
const pretty=(v:unknown)=>missing(v)?'—':txt(v);
const styleButton:React.CSSProperties={...button,fontSize:12,whiteSpace:'nowrap'};
export default function RmsMasterAnalysis({client}:{client:SupabaseClient}){
 const [sites,setSites]=useState<Site[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [regionView,setRegionView]=useState('All'),[tab,setTab]=useState<Tab>('issues'),[sub,setSub]=useState('All'),[grid,setGrid]=useState('All'),[group,setGroup]=useState('All'),[vendor,setVendor]=useState('All'),[search,setSearch]=useState(''),[page,setPage]=useState(0),[detail,setDetail]=useState<Site|null>(null),[onlyIssues,setOnlyIssues]=useState(false);
 useEffect(()=>{let live=true;(async()=>{setLoading(true);setError('');try{
  const rms=await fetchAll(client,TABLE,'SITE_ID');
  const result=rms.map(r=>{const id=txt(r['SITE_ID']);return {id,region:txt(r['Sub-Region']),grid:txt(r['Grid']),group:txt(r['Group']),vendor:txt(r['RMS Vendor']),connectivity:txt(r['RMS connected']),raw:r,issues:assess(r)}}).filter(s=>s.id&&/^(?:central[- ]?[16]|c[- ]?[16])$/i.test(s.region));
  if(live)setSites(result);
 }catch(e){if(live)setError(e instanceof Error?e.message:String(e))}finally{if(live)setLoading(false)}})();return()=>{live=false}},[client]);
 const regions=useMemo(()=>Array.from(new Set(sites.map(s=>s.region))).filter(Boolean).sort(),[sites]);
 const grids=useMemo(()=>Array.from(new Set(sites.filter(s=>sub==='All'||s.region===sub).map(s=>s.grid))).filter(Boolean).sort(),[sites,sub]);
 const groups=useMemo(()=>Array.from(new Set(sites.map(s=>s.group))).filter(Boolean).sort(),[sites]);
 const vendors=useMemo(()=>Array.from(new Set(sites.map(s=>s.vendor))).filter(Boolean).sort(),[sites]);
 const scoped=useMemo(()=>sites.filter(s=>(sub==='All'||s.region===sub)&&(grid==='All'||s.grid===grid)&&(group==='All'||s.group===group)&&(vendor==='All'||s.vendor===vendor)&&(!search||s.id.includes(search.trim()))),[sites,sub,grid,group,vendor,search]);
 const rows=useMemo(()=>scoped.filter(s=>relevant(s,tab)&&(!onlyIssues||s.issues.length>0)).sort((a,b)=>b.issues.length-a.issues.length||a.id.localeCompare(b.id,undefined,{numeric:true})),[scoped,tab,onlyIssues]);
 const regionSummary=useMemo(()=>{
  const counts=new Map<string,number>();
  for(const site of rows){
   const name=site.region||'Unassigned';
   counts.set(name,(counts.get(name)||0)+1);
  }
  return [...counts.entries()].sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}));
 },[rows]);
 const displayRows=useMemo(()=>regionView==='All'?rows:rows.filter(s=>(s.region||'Unassigned')===regionView),[rows,regionView]);
 const matches=useMemo(()=>donorPlan(scoped),[scoped]);
 const actionByRegion=useMemo(()=>{
  const names=Array.from(new Set(scoped.map(s=>s.region||'Unassigned'))).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const stats=(items:Site[])=>({
   sites:items.length,
   discrepancies:items.filter(s=>s.issues.some(i=>i.key!=='donor')).length,
   phase:items.filter(s=>relevant(s,'phase')).length,
   smr:items.filter(isShort).length,
   rectifier:items.filter(s=>relevant(s,'rectifier')).length,
   eol:items.filter(s=>relevant(s,'eol')).length,
   soh:items.filter(s=>relevant(s,'soh')).length,
   fifty:items.filter(s=>s.issues.some(i=>i.key==='zte50'||i.key==='huawei50')).length,
   disconnected:items.filter(s=>s.issues.some(i=>i.key==='disconnected')).length,
  });
  return {regions:names.map(name=>({name,...stats(scoped.filter(s=>(s.region||'Unassigned')===name))})),total:stats(scoped)};
 },[scoped]);

 const matched=new Map<string,{site:Site;qty:number}[]>();for(const m of matches){const x=matched.get(m.to.id)||[];x.push({site:m.from,qty:m.qty});matched.set(m.to.id,x)}
 const columns=useMemo(()=>Object.keys(sites[0]?.raw||{}).filter(k=>k!=='SITE_ID'),[sites]);
 const evidenceColumns=useMemo(()=>tab==='all'?columns:categoryColumns[tab].filter(k=>columns.includes(k)),[tab,columns]);
 const evidenceExtras=tab==='smr'?['Issue','Donor Match','Recommended Action']:tab==='all'?['Discrepancy Count','Donor Match','Recommended Action']:['Issue','Recommended Action'];
 const evidenceExtraValues=(s:Site):(string | number)[]=>{
  const issueNames=s.issues.filter(i=>tab==='issues'?i.key!=='donor':tab==='phase'?['phase_actual','phase_smr'].includes(i.key):tab==='rectifier'?['llvd','blvd','charging'].includes(i.key):tab==='eol'?i.key==='eol':tab==='soh'?i.key==='soh':tab==='smr'?['smr_short','donor'].includes(i.key):true).map(i=>i.label).join(' | ')||'—';
  return tab==='smr'?[issueNames,isShort(s)?plan(s):'—',action(s)]:tab==='all'?[s.issues.filter(i=>i.key!=='donor').length,isShort(s)?plan(s):'—',action(s)]:[issueNames,action(s)];
 };
 const action=(s:Site)=>{const a=s.issues.filter(i=>i.key!=='donor').map(i=>i.action);if(isDonor(s))a.push('SMR donor candidate: confirm actual spare capacity before release');return a.length?a.join(' | '):'No RMS discrepancy identified from available fields'};
 const plan=(s:Site)=>matched.get(s.id)?.map(m=>`${m.site.id} (${m.site.grid}, ${m.qty} SMR)`).join('; ')||'No same-sub-region donor allocation identified';
 const exportRows=()=>csv(`RMS_${tab}_All_Central.csv`,['SITE_ID',...evidenceColumns,...evidenceExtras],displayRows.map(s=>[s.id,...evidenceColumns.map(k=>s.raw[k]),...evidenceExtraValues(s)]));
 const exportClosure=()=>csv(`RMS_Closure_${tab}.csv`,['Site ID','Sub-Region','Grid','Issue','Actual Evidence','Recommended Action','Potential Donor','RMS Owner','Target Date','Status','Closure Evidence'],rows.flatMap(s=>s.issues.filter(i=>i.key!=='donor').map(i=>[s.id,s.region,s.grid,i.label,i.value,i.action,i.key==='smr_short'?plan(s):'','','','Open',''])));
 const select=(v:string,options:string[],onChange:(v:string)=>void)=><select value={v} onChange={e=>{onChange(e.target.value);setRegionView('All');setPage(0)}} style={{padding:'9px 10px',border:'1px solid #c9dfd5',borderRadius:8,maxWidth:'100%',background:'#fff'}}>{options.map(o=><option key={o}>{o}</option>)}</select>;
 if(loading)return <div style={card}>Loading all Central RMS master records…</div>;
 if(error)return <div style={{...card,color:'#a33'}}>RMS loading error: {error}</div>;
 const kpis=[['All Central RMS Sites',scoped.length],['RMS Discrepancy Sites',scoped.filter(s=>s.issues.some(i=>i.key!=='donor')).length],['Missing Phase',scoped.filter(s=>relevant(s,'phase')).length],['SMR Shortage',scoped.filter(isShort).length],['Same-Region SMR Transfers',matches.reduce((n,m)=>n+m.qty,0)],['Wrong Rectifier Settings',scoped.filter(s=>relevant(s,'rectifier')).length],['EOL Li-ion',scoped.filter(s=>relevant(s,'eol')).length],['SOH <60%',scoped.filter(s=>relevant(s,'soh')).length]] as const;
 const showActionSites=(region:string,category:Tab)=>{
  setSub(region);setGrid('All');setTab(category);setOnlyIssues(false);setRegionView('All');setPage(0);
 };
 const pages=Math.max(1,Math.ceil(displayRows.length/40));const safePage=Math.min(page,pages-1);const visible=displayRows.slice(safePage*40,(safePage+1)*40);
 return <section style={{fontFamily:'Inter,Arial,sans-serif',color:'#163c32',background:'#f3f9f6',borderRadius:14,padding:'clamp(10px,2vw,20px)',minWidth:0,maxWidth:'100%',width:'100%',boxSizing:'border-box'}}>
 <style>{`
 .rms-hero{display:grid;grid-template-columns:minmax(300px,.85fr) minmax(0,1.15fr);align-items:stretch;min-height:245px;background:linear-gradient(115deg,#063b34 0%,#075c4a 51%,#eef7f2 51.1%,#ffffff 100%);border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(10,66,49,.13);margin-bottom:19px;border:1px solid #c5e4d7}
 .rms-hero-copy{padding:clamp(20px,3vw,35px);display:flex;flex-direction:column;justify-content:center;color:white;min-width:0}
 .rms-hero-kicker{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#b5e5d1;font-weight:800;margin-bottom:12px}
 .rms-hero-title{font-size:clamp(25px,2.6vw,40px);line-height:1.1;font-weight:850;letter-spacing:-.8px;margin:0 0 12px;color:white}
 .rms-hero-sub{font-size:13px;line-height:1.65;color:#e0f4e9;max-width:480px;margin:0}
 .rms-hero-art{background:#fff;display:flex;flex-direction:column;align-items:stretch;justify-content:center;padding:13px 16px;min-width:0}
 .rms-hero-art img{display:block;width:100%;height:185px;object-fit:contain;object-position:center}
 .rms-hero-art span{font-size:11px;color:#5e796d;text-align:center;line-height:1.5}
 .rms-metric-grid>div{transition:transform .15s ease,box-shadow .15s ease}
 .rms-metric-grid>div:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(15,91,64,.11)}
 @media(max-width:850px){.rms-hero{grid-template-columns:1fr;background:#063b34}.rms-hero-art{min-height:195px}.rms-hero-art img{height:160px}}
 @media(max-width:500px){.rms-hero-copy{padding:20px}.rms-hero-art img{height:125px}.rms-hero-art{padding:12px}}
 `}</style>
 <div className="rms-hero">
   <div className="rms-hero-copy">
     <div className="rms-hero-kicker">Power Resiliency Phase 2 · All Central</div>
     <h2 className="rms-hero-title">RMS Power Health<br/>Analysis</h2>
     <p className="rms-hero-sub">From RMS alarms to field action. Investigate AC phases, SMR capacity, battery health and rectifier settings across the Central network.</p>
     <div style={{marginTop:17,display:'flex',gap:9,flexWrap:'wrap'}}><span style={{border:'1px solid #73bd9f',background:'rgba(255,255,255,.11)',borderRadius:30,padding:'6px 11px',fontSize:12}}>4,305 master records</span><span style={{border:'1px solid #73bd9f',background:'rgba(255,255,255,.11)',borderRadius:30,padding:'6px 11px',fontSize:12}}>Site-wise actions</span></div>
   </div>
   <div className="rms-hero-art"><svg viewBox="0 0 900 300" role="img" aria-label="RMS power flow: AC grid to distribution board to rectifier and SMR, supplying telecom DC load and Li-ion battery backup" style={{width:'100%',height:'100%',maxHeight:290,display:'block',background:'linear-gradient(180deg,#f5fbff,#e8f7f0)'}}>
<defs><marker id="rms-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#12834d"/></marker></defs>
{[['AC Grid',110],['Distribution DB',325],['Rectifier / SMR',550],['DC Load / RRU',785]].map(([label,x])=><g key={String(label)}><rect x={Number(x)-76} y="73" width="152" height="117" rx="12" fill="#fff" stroke="#a6d3c1" strokeWidth="3"/><rect x={Number(x)-55} y="92" width="110" height="55" rx="7" fill="#dceef1" stroke="#477b85" strokeWidth="2"/><text x={Number(x)} y="127" textAnchor="middle" fontSize="24" fill="#11694f" fontWeight="bold">{label==='AC Grid'?'⚡':label==='Distribution DB'?'AC':label==='Rectifier / SMR'?'SMR':'-48V'}</text><text x={Number(x)} y="217" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#123e35">{label}</text></g>)}
{[186,401,626].map(x=><path key={x} d={`M ${x} 131 H ${x+81}`} stroke="#12834d" strokeWidth="7" fill="none" markerEnd="url(#rms-arrow)"/>)}
<path d="M550 190 V248 H655" stroke="#12834d" strokeWidth="6" fill="none" markerEnd="url(#rms-arrow)"/>
<rect x="666" y="228" width="184" height="54" rx="12" fill="#e3f4e9" stroke="#12834d" strokeWidth="3"/>
<text x="758" y="249" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#075d3d">Li-ion Battery</text><text x="758" y="269" textAnchor="middle" fontSize="14" fill="#075d3d">Backup / Charging</text>
<text x="450" y="37" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#075d3d">RMS Power Monitoring &amp; Resilience</text>
</svg><span>RMS power chain · AC input → Rectifier / SMR → DC load + Battery backup</span></div>
 </div>
 <p style={{margin:'0 0 13px',color:'#57776d',fontSize:12}}>Source: {TABLE} · All Central sub-regions · CA from October tracker · Missing or “-” values excluded from faults · Site-level RMS evidence and recommended action</p>
 <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:13}}>{select(sub,['All',...regions],v=>{setSub(v);setGrid('All')})}{select(grid,['All',...grids],setGrid)}{select(group,['All',...groups],setGroup)}{select(vendor,['All',...vendors],setVendor)}<input placeholder="Search Site ID" value={search} onChange={e=>{setSearch(e.target.value);setRegionView('All');setPage(0)}} style={{padding:9,border:'1px solid #c9dfd5',borderRadius:8,maxWidth:160}}/><button style={styleButton} onClick={exportRows}>Export Category Evidence CSV</button><button style={styleButton} onClick={exportClosure}>Export Closure Tracker</button></div>
 <div className="rms-metric-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,165px),1fr))',gap:9,marginBottom:16}}>{kpis.map(([label,n])=><div key={label} style={{...card,border:'1px solid #cfe7d9',borderTop:'3px solid #0b9462',background:'#fff',boxShadow:'0 3px 12px rgba(20,74,49,.045)'}}><div style={{fontSize:12,color:'#657c72'}}>{label}</div><strong style={{fontSize:23,color:'#076444'}}>{n.toLocaleString()}</strong></div>)}</div>
 <div style={{...card,marginBottom:16}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,marginBottom:10}}>
   <div><strong style={{fontSize:16}}>Sub-region RMS action items — field rectification</strong><div style={{fontSize:12,color:'#57776d',marginTop:3}}>Site counts requiring RMS follow-up. A site can have multiple issues, so action columns must not be added together. Click a count to view relevant sites.</div></div>
   <button style={styleButton} onClick={()=>csv('RMS_SubRegion_Action_Items.csv',['Sub-region','RMS sites','Discrepancy sites','Missing phase','SMR shortage','Wrong rectifier settings','EOL Li-ion','SOH below 60%','50Ah module sites','RMS disconnected'],[...actionByRegion.regions.map(r=>[r.name,r.sites,r.discrepancies,r.phase,r.smr,r.rectifier,r.eol,r.soh,r.fifty,r.disconnected]),['TOTAL',...(['sites','discrepancies','phase','smr','rectifier','eol','soh','fifty','disconnected'] as const).map(k=>actionByRegion.total[k])]])}>Export Sub-region Summary CSV</button>
  </div>
  <div style={{overflowX:'auto',border:'1px solid #d7e9df',borderRadius:9}}>
   <table style={{width:'100%',minWidth:920,borderCollapse:'collapse',fontSize:12,textAlign:'center'}}>
    <thead><tr>{['Sub-region','RMS sites','Discrepancies','Missing phase','SMR shortage','Wrong settings','EOL Li-ion','SOH <60%','50Ah sites','RMS disconnected'].map(h=><th key={h} style={{background:'#e2f2e9',padding:'11px 9px',textAlign:h==='Sub-region'?'left':'center',borderBottom:'1px solid #cde3d7',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
    <tbody>{actionByRegion.regions.map(r=><tr key={r.name}>
     <td style={{padding:'10px 9px',textAlign:'left',fontWeight:700,borderBottom:'1px solid #e7eeea'}}>{r.name}</td>
     {([['sites','all'],['discrepancies','issues'],['phase','phase'],['smr','smr'],['rectifier','rectifier'],['eol','eol'],['soh','soh'],['fifty','issues'],['disconnected','issues']] as const).map(([key,category])=><td key={key} style={{padding:'7px 8px',borderBottom:'1px solid #e7eeea'}}><button title={`View ${r.name} ${key} sites`} disabled={r[key]===0} onClick={()=>showActionSites(r.name,category)} style={{border:0,background:'transparent',fontWeight:700,color:r[key]?'#087b53':'#9baea5',cursor:r[key]?'pointer':'default',textDecoration:r[key]?'underline':'none',padding:5}}>{r[key].toLocaleString()}</button></td>)}
    </tr>)}<tr style={{background:'#f0f8f3',fontWeight:800}}><td style={{padding:'11px 9px',textAlign:'left'}}>TOTAL</td>{(['sites','discrepancies','phase','smr','rectifier','eol','soh','fifty','disconnected'] as const).map(k=><td key={k} style={{padding:'11px 8px'}}>{actionByRegion.total[k].toLocaleString()}</td>)}</tr></tbody>
   </table>
  </div>
 </div>
 <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:15}}>{tabItems.map(t=><button key={t.id} onClick={()=>{setTab(t.id);setPage(0);setRegionView('All');setOnlyIssues(false)}} style={{...styleButton,background:tab===t.id?'#0b7950':'#fff',color:tab===t.id?'#fff':'#086943',borderColor:tab===t.id?'#0b7950':'#c8e1d3'}}>{t.name}</button>)}</div>
 <div style={{...card,marginBottom:12}}><strong>{tabItems.find(t=>t.id===tab)?.name}</strong><span style={{fontSize:12,color:'#57776d',marginLeft:10}}>{rows.length.toLocaleString()} sites · Only category-relevant columns shown below. Click View for all RMS master fields.</span>
 {tab==='issues'&&<p style={{fontSize:12,marginBottom:0}}>RMS discrepancy sites only, derived from RMS master fields. No Cell Availability data is used.</p>}
 {tab==='smr'&&<p style={{fontSize:12,marginBottom:0}}>Potential donor allocations are matched <strong>within the same Central sub-region</strong>, prioritizing the same grid. Quantities are indicative; validate SMR model, rating, available capacity, operational load, and approval before transfer. Donor opportunities are not defects.</p>}
 {tab==='rectifier'&&<p style={{fontSize:12,marginBottom:0}}>Flag LLVD-1 below 47V, BLVD below 46V, or Charging Coefficient above 0.5. Blank or “-” is unavailable data, not a wrong setting.</p>}
 </div>
 {tab==='smr'&&<div style={{...card,marginBottom:12}}><strong>Same-region donor matching · Proposed transfers ({matches.length})</strong><div style={{maxHeight:220,overflow:'auto',marginTop:8}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Shortage Site','Region','Grid','Donor Site','Donor Grid','SMRs','Match'].map(k=><th key={k} style={{padding:7,textAlign:'left',background:'#e8f4ed'}}>{k}</th>)}</tr></thead><tbody>{matches.map((m,i)=><tr key={`${m.to.id}-${m.from.id}-${i}`}>{[m.to.id,m.to.region,m.to.grid,m.from.id,m.from.grid,m.qty,m.scope].map((v,j)=><td key={j} style={{padding:7,borderBottom:'1px solid #e4ebe6'}}>{v}</td>)}</tr>)}</tbody></table></div></div>}
 <div style={{...card,marginBottom:14}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:10}}>
   <div><strong>Sub-region case summary — {tabItems.find(t=>t.id===tab)?.name}</strong><div style={{fontSize:12,color:'#57776d',marginTop:3}}>Counts follow the selected category and existing filters. Select View to see all matching sites below.</div></div>
   <button style={styleButton} onClick={()=>{setRegionView('All');setPage(0)}}>View All {rows.length.toLocaleString()} Sites</button>
  </div>
  <div style={{overflowX:'auto',border:'1px solid #d8e8e2',borderRadius:9}}>
   <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
    <thead><tr>{['Sub-region','Number of cases','View sites'].map(h=><th key={h} style={{background:'#e2f2e9',padding:'10px 12px',textAlign:'left',borderBottom:'1px solid #d1e6d9'}}>{h}</th>)}</tr></thead>
    <tbody>{regionSummary.map(([name,count])=><tr key={name} style={{background:regionView===name?'#edf8f1':'#fff'}}>
      <td style={{padding:'9px 12px',borderBottom:'1px solid #e7eeea'}}>{name}</td>
      <td style={{padding:'9px 12px',borderBottom:'1px solid #e7eeea',fontWeight:700}}>{count.toLocaleString()}</td>
      <td style={{padding:'7px 12px',borderBottom:'1px solid #e7eeea'}}><button style={{...styleButton,background:regionView===name?'#087b53':'#eaf8f0',color:regionView===name?'#fff':'#086943'}} onClick={()=>{setRegionView(name);setPage(0)}}>View</button></td>
     </tr>)}
     <tr style={{background:'#f2f8f5',fontWeight:800}}><td style={{padding:'10px 12px'}}>Total</td><td style={{padding:'10px 12px'}}>{rows.length.toLocaleString()}</td><td style={{padding:'8px 12px'}}><button style={styleButton} onClick={()=>{setRegionView('All');setPage(0)}}>View All</button></td></tr>
    </tbody>
   </table>
  </div>
 </div>
 <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8,marginBottom:9}}><strong>Site-wise RMS Evidence ({displayRows.length.toLocaleString()})</strong>{regionView!=='All'&&<span style={{fontSize:12,color:'#087b53',fontWeight:700}}>Sub-region: {regionView}</span>}<label style={{fontSize:12}}><input type="checkbox" checked={onlyIssues} onChange={e=>{setOnlyIssues(e.target.checked);setRegionView('All');setPage(0)}}/> Only sites with discrepancies</label><span style={{fontSize:12,color:'#667'}}>Page {safePage+1} / {pages}</span><button style={styleButton} disabled={safePage===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Previous</button><button style={styleButton} disabled={safePage+1>=pages} onClick={()=>setPage(p=>Math.min(p+1,pages-1))}>Next</button></div>
 <div style={{width:'100%',maxWidth:'100%',overflowX:'auto',border:'1px solid #d4e6dd',borderRadius:10,background:'#fff'}}><table style={{borderCollapse:'collapse',fontSize:11,whiteSpace:'nowrap',width:'max-content',minWidth:'100%'}}><thead><tr>{['SITE_ID',...evidenceColumns,...evidenceExtras,'Details'].map(h=><th key={h} style={{padding:8,position:'sticky',top:0,background:'#e2f2e9',textAlign:'left',borderBottom:'1px solid #cce0d5',maxWidth:280}}>{h}</th>)}</tr></thead><tbody>{visible.map(s=><tr key={s.id}>{[s.id,...evidenceColumns.map(k=>pretty(s.raw[k])),...evidenceExtraValues(s)].map((v,i)=><td key={i} title={String(v)} style={{padding:8,borderBottom:'1px solid #e9efeb',maxWidth:i>=evidenceColumns.length+1?320:160,overflow:'hidden',textOverflow:'ellipsis'}}>{v}</td>)}<td style={{padding:6,borderBottom:'1px solid #e9efeb'}}><button style={styleButton} onClick={()=>setDetail(s)}>View</button></td></tr>)}</tbody></table></div>
 {detail&&<div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,background:'rgba(8,27,20,.66)',zIndex:10000,display:'grid',placeItems:'center',padding:14}}><div style={{background:'#fff',borderRadius:15,padding:20,width:'min(100%,1100px)',maxHeight:'90vh',overflowY:'auto'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><h3>Site {detail.id} · Complete RMS Assessment</h3><button style={styleButton} onClick={()=>setDetail(null)}>Close ×</button></div><p>{detail.region} · {detail.grid} · {detail.group} · {detail.vendor}</p><h4>Discrepancies</h4>{detail.issues.length?detail.issues.map(i=><p key={i.key} style={{fontSize:13}}><strong>{i.label}</strong> — {i.value||'Flagged'} — {i.action}</p>):<p>No confirmed discrepancy from available RMS fields.</p>}{isShort(detail)&&<p><strong>Same-sub-region SMR donor options:</strong> {plan(detail)}</p>}<h4>All RMS Master Columns</h4><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:7}}>{Object.entries(detail.raw).map(([k,v])=><div key={k} style={{background:'#f2f8f5',padding:9,borderRadius:7,fontSize:12}}><strong>{k}</strong><div>{pretty(v)}</div></div>)}</div><h4>Recommended Action</h4><p style={{background:'#e9f6ed',padding:12,borderRadius:8}}>{action(detail)}</p></div></div>}
 </section>;
}