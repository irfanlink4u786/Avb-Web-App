import React, { useEffect, useMemo, useState } from 'react';

type DGRow = {
 site_id:string; sub_region:string|null; grid:string|null; co_name:string|null;
 ms_gtl:string|null; zone_lead:string|null; hub_category:string|null;
 dependent_sites:number|null; dg_status:string|null; dg_rating:string|null;
 mode:string|null; total_running_hours:number|null; auto_hours:number|null;
 manual_hours:number|null; auto_count:number|null; manual_count:number|null;
 no_run_count:number|null; run_without_pa:number|null; june_fuel:number|null;
 final_status:string|null; updated_at:string;
 last_cp_failure:string|null; last_dg_running:string|null; last_check:string|null; last_status:string|null;
 second_last_cp_failure:string|null; second_last_dg_running:string|null; second_last_check:string|null; second_last_status:string|null;
 third_last_cp_failure:string|null; third_last_dg_running:string|null; third_last_check:string|null; third_last_status:string|null;
};
function classify(r:DGRow) {
 const category=(r.hub_category||'').toLowerCase();
 const allowed=category.includes('ptn')||category.includes('critical hub');
 const known=allowed||category.includes('major hub')||category.includes('minor hub')||category.includes('single');
 const mode=(r.mode||'').toLowerCase().trim();
 if(!known||!mode)return 'Review';
 if(mode==='auto'&&!allowed)return 'Violation';
 if(mode==='auto'||mode==='manual')return 'Compliant';
 return 'Review';
}
function csvEscape(v:unknown){const s=String(v??'');return '"'+s.replace(/"/g,'""')+'"';}
function downloadCSV(rows:DGRow[]){
 const fields:(keyof DGRow)[]=['site_id','sub_region','grid','co_name','ms_gtl','hub_category','mode','auto_hours','manual_hours','auto_count','manual_count','june_fuel','last_cp_failure','last_dg_running','last_check','last_status','second_last_cp_failure','second_last_dg_running','second_last_check','second_last_status','third_last_cp_failure','third_last_dg_running','third_last_check','third_last_status','final_status'];
 const data=[ [...fields,'compliance'].join(','),...rows.map(r=>[...fields.map(k=>csvEscape(r[k])),csvEscape(classify(r))].join(','))].join('\n');
 const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='DG_Auto_Manual_Compliance.csv';a.click();URL.revokeObjectURL(url);
}
function fmtHours(value:number|null){return value==null?'—':Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtInteger(value:number|null){return value==null?'—':Number(value).toLocaleString('en-US',{maximumFractionDigits:0});}
function fmtCheck(value:string|null){if(value==null||value.trim()===''||value.trim()==='—')return '—';const n=Number(value);return Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):value;}
function timePK(value:string|null){
 if(!value)return '—';
 const d=new Date(value);return Number.isNaN(d.getTime())?String(value):new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Karachi',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
}
function IncidentEvidence({row}:{row:DGRow}){
 const incidents=[
  {name:'Last',cp:row.last_cp_failure,dg:row.last_dg_running,check:row.last_check,status:row.last_status},
  {name:'2nd Last',cp:row.second_last_cp_failure,dg:row.second_last_dg_running,check:row.second_last_check,status:row.second_last_status},
  {name:'3rd Last',cp:row.third_last_cp_failure,dg:row.third_last_dg_running,check:row.third_last_check,status:row.third_last_status},
 ];
 return <div style={{overflowX:'auto',marginTop:12}}><h4 style={{margin:'8px 0',fontSize:15}}>Last 3 DG Running Incidents — Mode Evidence</h4><table style={{borderCollapse:'collapse',width:'100%',minWidth:800}}><thead><tr>{['Incident','CP Failure (PKT)','DG Running (PKT)','Check (CSV)','Status (CSV)'].map(x=><th key={x} style={{padding:9,borderBottom:'1px solid #cbd5e1',textAlign:'left'}}>{x}</th>)}</tr></thead><tbody>{incidents.map(i=><tr key={i.name}>{[i.name,timePK(i.cp),timePK(i.dg),fmtCheck(i.check),i.status||'—'].map((v,j)=><td key={j} style={{padding:9,borderBottom:'1px solid #e2e8f0'}}>{v}</td>)}</tr>)}</tbody></table><p style={{marginTop:10}}><strong>Final Status (CSV):</strong> {row.final_status||'—'} | <strong>Total DG Manual RH:</strong> {fmtHours(row.manual_hours)} | <strong>Current Status:</strong> {row.mode||'—'}</p><p style={{fontSize:12,color:'#475569'}}>Check and status values are displayed exactly as provided in the CSV. Incident timestamps are displayed in Pakistan time (PKT).</p></div>;
}
export default function DGModeMonitoring(){
 const [rows,setRows]=useState<DGRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const [grid,setGrid]=useState('All');
 const [co,setCO]=useState('All');
 const [status,setStatus]=useState('All');
 const [expanded,setExpanded]=useState('');
 async function refresh(){
  setLoading(true);setError('');
  try {
   const env = (import.meta as any).env || {};
   const base = String(env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
   const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '');
   if (!base || !key) throw new Error('Supabase environment configuration missing');
   const saved = sessionStorage.getItem('cell_avb_supabase_session');
   const session = saved ? JSON.parse(saved) : null;
   if (!session?.access_token) throw new Error('Please sign in to view DG data');
   let token = String(session.access_token);
   if (Number(session.expires_at || 0) * 1000 < Date.now() + 60000) {
    if (!session.refresh_token) throw new Error('Session expired; please sign in again');
    const response = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
    if (!response.ok) throw new Error('Session refresh failed; please sign in again');
    const next = await response.json();
    next.expires_at = Math.floor(Date.now()/1000) + Number(next.expires_in || 3600);
    sessionStorage.setItem('cell_avb_supabase_session',JSON.stringify(next));
    token = next.access_token;
   }
   const all:DGRow[]=[];
   for (let offset=0; offset<10000; offset+=1000) {
    const url = `${base}/rest/v1/dg_mode_monitoring?select=*&order=site_id.asc&limit=1000&offset=${offset}`;
    const response = await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${token}`,Accept:'application/json'}});
    if (!response.ok) throw new Error(`DG data HTTP ${response.status}: ${(await response.text()).slice(0,240)}`);
    const page = await response.json() as DGRow[];
    all.push(...page);
    if (page.length < 1000) break;
   }
   setRows(all);
  } catch(e) {setError(e instanceof Error?e.message:String(e));}
  finally {setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 const grids=useMemo(()=>[...new Set(rows.map(r=>r.grid).filter(Boolean) as string[])].sort(),[rows]);
 const cos=useMemo(()=>[...new Set(rows.filter(r=>grid==='All'||r.grid===grid).map(r=>r.co_name).filter(Boolean) as string[])].sort(),[rows,grid]);
 const filtered=useMemo(()=>rows.filter(r=>
  (grid==='All'||r.grid===grid)&&(co==='All'||r.co_name===co)&&
  (status==='All'||classify(r)===status)&&
  (!search||[r.site_id,r.grid,r.co_name,r.ms_gtl,r.hub_category].some(x=>String(x||'').toLowerCase().includes(search.toLowerCase())))
 ),[rows,grid,co,status,search]);
 const violations=filtered.filter(r=>classify(r)==='Violation');
 const auto=filtered.filter(r=>r.mode?.toLowerCase()==='auto');
 const manual=filtered.filter(r=>r.mode?.toLowerCase()==='manual');
 const hours=violations.reduce((n,r)=>n+Number(r.auto_hours||0),0);
 const byCO=Object.values(filtered.reduce<Record<string,{name:string;sites:number;violations:number;hours:number}>>((acc,r)=>{
  const key=r.co_name||'Unassigned';const x=acc[key]??(acc[key]={name:key,sites:0,violations:0,hours:0});x.sites++;
  if(classify(r)==='Violation'){x.violations++;x.hours+=Number(r.auto_hours||0);}return acc;
 },{})).sort((a,b)=>b.hours-a.hours||b.violations-a.violations);
 const card=(label:string,value:string|number)=> <div style={{background:'#f1f5f9',borderRadius:12,padding:14}}><div style={{fontSize:12,color:'#475569'}}>{label}</div><strong style={{fontSize:24,color:'#0f172a'}}>{value}</strong></div>;
 return <section style={{color:'#0f172a',background:'#fff',padding:18,borderRadius:16}}>
  <header style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}><div><h2 style={{fontWeight:800,fontSize:22}}>DG Auto / Manual Compliance</h2><p>PTN / Critical Hub: Auto permitted. Major / Minor / Single: Manual mandatory.</p></div><button onClick={()=>void refresh()}>Refresh</button></header>
  {error&&<p role="alert" style={{color:'#b91c1c'}}>Supabase error: {error}</p>}
  {loading?<p>Loading DG records...</p>:<>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,margin:'16px 0'}}>
    {card('DG Sites',filtered.length)}{card('Auto Mode',auto.length)}{card('Manual Mode',manual.length)}{card('Unauthorized Auto',violations.length)}{card('Historical Auto Hours — Flagged Sites',hours.toFixed(1))}{card('Review Required',filtered.filter(r=>classify(r)==='Review').length)}
   </div>
   <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:15}}>
    <input aria-label="Search site, CO or GTL" placeholder="Site ID / CO / GTL" value={search} onChange={e=>setSearch(e.target.value)}/>
    <select aria-label="Grid" value={grid} onChange={e=>{setGrid(e.target.value);setCO('All')}}><option>All</option>{grids.map(x=><option key={x}>{x}</option>)}</select>
    <select aria-label="Cluster owner" value={co} onChange={e=>setCO(e.target.value)}><option>All</option>{cos.map(x=><option key={x}>{x}</option>)}</select>
    <select aria-label="Compliance" value={status} onChange={e=>setStatus(e.target.value)}>{['All','Violation','Compliant','Review'].map(x=><option key={x}>{x}</option>)}</select>
    <button onClick={()=>downloadCSV(filtered)}>Export CSV</button>
   </div>
   <h3 style={{fontWeight:800,margin:'16px 0 8px'}}>CO-wise Auto Violation Ranking</h3>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['CO Name','DG Sites','Violations','Historical Auto Hours (flagged sites)','Query'].map(x=><th key={x} style={{padding:9,textAlign:'left',borderBottom:'1px solid #cbd5e1'}}>{x}</th>)}</tr></thead><tbody>{byCO.map(r=><tr key={r.name}><td style={{padding:8}}>{r.name}</td><td>{r.sites}</td><td>{r.violations}</td><td>{r.hours.toFixed(1)}</td><td><button onClick={()=>{setCO(r.name);setExpanded('')}}>View sites</button></td></tr>)}</tbody></table></div>
   <h3 style={{fontWeight:800,margin:'20px 0 8px'}}>Site-wise DG Operating Mode</h3>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:1050}}><thead><tr>{['Site','Category','Grid','CO Name','GTL','Mode','Auto RH','Manual RH','Auto Count','Compliance','Details'].map(x=><th key={x} style={{padding:9,textAlign:'left',borderBottom:'1px solid #cbd5e1'}}>{x}</th>)}</tr></thead><tbody>{filtered.map(r=><React.Fragment key={r.site_id}><tr style={{background:classify(r)==='Violation'?'#fff1f2':'transparent'}}><td>{r.site_id}</td><td>{r.hub_category||'—'}</td><td>{r.grid||'—'}</td><td>{r.co_name||'—'}</td><td>{r.ms_gtl||'—'}</td><td>{r.mode||'—'}</td><td>{fmtHours(r.auto_hours)}</td><td>{fmtHours(r.manual_hours)}</td><td>{fmtInteger(r.auto_count)}</td><td><strong style={{color:classify(r)==='Violation'?'#be123c':'#334155'}}>{classify(r)}</strong></td><td><button onClick={()=>setExpanded(expanded===r.site_id?'':r.site_id)}>View</button></td></tr>{expanded===r.site_id&&<tr><td colSpan={11} style={{padding:12,background:'#f8fafc'}}>CO: {r.co_name||'—'} | DG Rating: {r.dg_rating||'—'} | DG Run Without PA: {fmtInteger(r.run_without_pa)} | June Fuel: {fmtHours(r.june_fuel)} L | CSV Flag: {r.final_status||'—'} | Last updated: {r.updated_at||'—'}<p style={{fontSize:12}}>Historical Auto hours are not necessarily unauthorized hours; verify event timestamps before calculating fuel savings.</p><IncidentEvidence row={r}/></td></tr>}</React.Fragment>)}</tbody></table></div>
   {filtered.length===0&&<p>No matching DG records. Confirm CSV import and filters.</p>}
  </>}
 </section>;
}
