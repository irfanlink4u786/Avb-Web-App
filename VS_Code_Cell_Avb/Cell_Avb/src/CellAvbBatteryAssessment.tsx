import BatteryRmsUpdates from './CellAvbBatteryRmsUpdates';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {CSSProperties} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';

type Status='BACKUP_OK'|'BACKUP_LOW'|'NEEDS_INVESTIGATION'|'NEEDS_INVESTIGATION_DG'|'BACKUP_NOT_VERIFIED';
type Site={bb_type?:string|null;cp_evidence_status?:string;fm_recovered_count?:number;site_id:string;sub_region:string|null;grid:string|null;site_group:string|null;classification:string|null;capacity_ah:number|null;capacity_configuration:string|null;dg_status:string|null;bb_installation_date:string|null;october_ca_pct:number|null;low_ca_days:number|null;wsd_max_min:number|null;wosd_max_min:number|null;wsd_count:number|null;wosd_count:number|null;wsd_failure_count:number|null;wsd_ge120_count:number|null;wosd_ge120_count:number|null;chronic_high_capacity_low_ca:boolean;dashboard_status:Status;data_source:string};
type Incident={site_id:string;power_occur:string|null;power_clear:string|null;power_alarm_type:string|null;sd_occur:string|null;sd_title:string|null;backup_min:number|null;incident_type:string;merged_power_alarms:number|null};
type RawAlarm={id:string;alarm_kind:string|null;alarm_title:string|null;occurred_at:string|null;cleared_at:string|null;source_file:string|null};
type RawAssessment={raw:RawAlarm;category:string;reason:string;backup:number|null;matchedPower:string|null;qualifies:boolean};
type Reconcile={total:number;matched:number;unmatched:number;rawCount:number;rawUnmatched:number;rawThrough:string|null;details:Record<string,boolean>};
const formatDate=(v:string|null|undefined)=>v?String(v).replace('T',' ').replace(/(\.\d+)?(Z|[+-]\d\d:?\d\d)$/,''):'—';
const localMs=(v:string|null|undefined)=>v?Date.parse(String(v).replace(' ','T')+'+05:00'):NaN;
type Tab='Executive Summary'|'Sites Requiring Action'|'Site Investigation'|'Last 5 Days – WSD Degradation';
const tabs:Tab[]=['Executive Summary','Sites Requiring Action','Site Investigation','Last 5 Days – WSD Degradation'];
const panel:CSSProperties={background:'#fff',border:'1px solid #d5e8de',borderRadius:14,padding:16};
const btn:CSSProperties={background:'#fff',color:'#12654c',border:'1px solid #bddacc',borderRadius:9,padding:'9px 12px',cursor:'pointer',fontWeight:600};
const cell:CSSProperties={padding:'9px 10px',borderBottom:'1px solid #e6eee9',fontSize:12,textAlign:'left',whiteSpace:'nowrap'};
const nice=(s:Status)=>({BACKUP_OK:'Backup OK',BACKUP_LOW:'Backup Low',NEEDS_INVESTIGATION:'Mixed Evidence',NEEDS_INVESTIGATION_DG:'DG Review',BACKUP_NOT_VERIFIED:'EASS Not Reporting'}[s]);
const n=(v:number|null|undefined,d=1)=>v==null?'—':Number(v).toFixed(d);
async function getAll<T>(client:SupabaseClient,table:string,cols:string):Promise<T[]>{const out:T[]=[];for(let i=0;i<10000;i+=1000){const {data,error}=await client.from(table).select(cols).order('site_id',{ascending:true}).range(i,i+999);if(error)throw error;out.push(...(data||[]) as T[]);if(!data||data.length<1000)break;}return out;}
function csv(rows:Site[],mode:'combined'|'wsd'|'wosd'='combined'){const keys:(keyof Site)[]=['site_id','site_group','bb_type','sub_region','grid','capacity_ah','dg_status','october_ca_pct','low_ca_days','wsd_max_min','wosd_max_min','wsd_count','wosd_count','wsd_failure_count','dashboard_status','cp_evidence_status','fm_recovered_count','chronic_high_capacity_low_ca'];const s=[[...keys,'selected_mode','selected_backup_min','selected_assessment','priority'].join(','),...rows.map(r=>{const values=(mode==='wsd'?[r.wsd_max_min]:mode==='wosd'?[r.wosd_max_min]:[r.wsd_max_min,r.wosd_max_min]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0);const m=values.length?Math.max(...values):null;const st=m===null?'BACKUP_NOT_VERIFIED':m<120?'BACKUP_LOW':'BACKUP_OK';const ca=r.october_ca_pct;const pr=m!==null&&m<120&&ca!==null?(ca<95?'P0':ca<98?'P1':'P2'):'—';return [...keys.map(k=>r[k]),mode,m,st,pr].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',');})].join('\r\n');const u=URL.createObjectURL(new Blob(['\uFEFF'+s],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='Pure_LiIon_Field_Actions_Oct2026.csv';a.click();URL.revokeObjectURL(u);}
export default function EassCaBackupDiagnostics({client,activeSection}:{client:SupabaseClient;activeSection?:string}){
 const active=activeSection==null||activeSection.startsWith('eass-');
 const [sites,setSites]=useState<Site[]>([]),[loading,setLoading]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 const [tab,setTab]=useState<Tab>('Executive Summary'),[sub,setSub]=useState('All'),[grid,setGrid]=useState('All'),[search,setSearch]=useState(''),[page,setPage]=useState(1);
 const [bbTypeFilter,setBbTypeFilter]=useState('Li-ion BB');
 const [evidenceMode,setEvidenceMode]=useState<'combined'|'wsd'|'wosd'>('combined');
 const [drill,setDrill]=useState<{field:'sub_region'|'grid';value:string}|null>(null);
 const [allEvidence,setAllEvidence]=useState<Incident[]>([]),[reconcile,setReconcile]=useState<Reconcile|null>(null);
 const [siteCapacity,setSiteCapacity]=useState<number|null>(null);
 const [rawAssessments,setRawAssessments]=useState<RawAssessment[]>([]),[rawPage,setRawPage]=useState(1),[auditSearch,setAuditSearch]=useState(''),[rawKind,setRawKind]=useState('All');
 const [selected,setSelected]=useState<Site|null>(null),[incidentLoading,setIncidentLoading]=useState(false),[incidentError,setIncidentError]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   // October CA tracker BB Type AND Plat+/PGS classification are mandatory for main dashboard eligibility.
   // FM assessment records are evidence, not the population denominator.
   const [assessed,inventory]=await Promise.all([
    getAll<Site>(client,'cell_avb_c1c6_bb_assessment','*'),
    (async()=>{const rows:Record<string,unknown>[]=[];for(let i=0;i<20000;i+=1000){const {data,error}=await client.from('ca_tracker_oct2026').select('SITE_ID,"Sub-Region",Grid,SiteClassification,"BB Type","OCT\'26 Cell A"').order('SITE_ID',{ascending:true}).range(i,i+999);if(error)throw error;rows.push(...(data??[]));if(!data||data.length<1000)break;}return rows;})()
   ]);
   const normalizeId=(v:unknown)=>String(v??'').trim().replace(/\.0$/,'');
   const byId=new Map(assessed.map(r=>[normalizeId(r.site_id),r]));
   // Eligibility is determined by explicit October master BB Type AND revenue classification.
   // Missing Ah does not establish a different battery chemistry; never infer Li-ion from FM alarms.
   const revenueGroup=(value:unknown):'Plat+'|'PGS'|null=>{
    const v=String(value??'').toLowerCase().replace(/[^a-z0-9+]/g,'');
    if(['platinum+','platinumplus','plat+','platplus'].includes(v))return 'Plat+';
    if(['platinum','gold','strategic'].includes(v))return 'PGS';
    return null; // Silver, Bronze, SB, blank and unknown are excluded.
   };
   const isLiIon=(value:unknown)=>/^li[ -]?ion(?:\s*bb|\s*battery)?$/i.test(String(value??'').trim());
   const merged:Site[]=[];const seen=new Set<string>();
   for(const row of inventory){
    const id=normalizeId(row.SITE_ID);
    const group=revenueGroup(row.SiteClassification);
    if(!id||seen.has(id)||!group)continue;
    seen.add(id);
    const existing=isLiIon(row['BB Type'])?byId.get(id):undefined;
    if(existing){merged.push({...existing,site_group:group,classification:String(row.SiteClassification??''),bb_type:String(row['BB Type'])});continue;}
    const caText=String(row["OCT'26 Cell A"]??'').trim().replace('%','');
    const caValue=caText!==''&&Number.isFinite(Number(caText))?Number(caText):null;
    merged.push({site_id:id,sub_region:String(row['Sub-Region']??''),grid:String(row.Grid??''),site_group:group,classification:String(row.SiteClassification??''),bb_type:String(row['BB Type']),capacity_ah:null,capacity_configuration:null,dg_status:null,bb_installation_date:null,october_ca_pct:caValue,low_ca_days:null,wsd_max_min:null,wosd_max_min:null,wsd_count:null,wosd_count:null,wsd_failure_count:null,wsd_ge120_count:null,wosd_ge120_count:null,chronic_high_capacity_low_ca:false,dashboard_status:'BACKUP_NOT_VERIFIED',data_source:'CA inventory — FM assessment missing'});
   }
   // Render the validated C-1/C-6 assessment immediately. FM evidence reconciliation
   // can be slow (hundreds of thousands of alarms) and must not block the page.
   const initial=merged.filter(x=>/^(?:central[- ]?[16]|c[- ]?[16])$/i.test(String(x.sub_region||'').trim()));
   setSites(initial.map(x=>({...x})));
   setLoaded(true);
   setLoading(false);
   // Reconcile sites without measured WSD/WOSD against raw CP / rectifier-input alarms.
   // A single complete power window with NO site-down incident is valid WOSD evidence.
   // Incomplete CP windows or CP windows with SD cannot be interpreted as WOSD.
   const unmeasured=merged.filter(site=>isLiIon(site.bb_type)&&![site.wsd_max_min,site.wosd_max_min].some(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0));
   const evidenceBySite=new Map<string,Incident[]>();
   for(let j=0;j<unmeasured.length;j+=40){
    const ids=unmeasured.slice(j,j+40).map(s=>s.site_id);
    for(let offset=0;offset<100000;offset+=1000){
     const {data,error:fmError}=await client.from('fm_incidents_20261023_staging')
      .select('site_id,power_occur,power_clear,power_alarm_type,sd_occur,sd_title,backup_min,incident_type,merged_power_alarms')
      .in('site_id',ids).order('site_id',{ascending:true}).order('power_occur',{ascending:true})
      .range(offset,offset+999);
     if(fmError)throw fmError;
     for(const incident of (data??[]) as Incident[]){
      const id=normalizeId(incident.site_id);
      const previous=evidenceBySite.get(id)??[];previous.push(incident);evidenceBySite.set(id,previous);
     }
     if(!data||data.length<1000)break;
    }
   }
   for(const site of unmeasured){
    const raw=evidenceBySite.get(site.site_id)??[];
    let wosdMax:number|null=null;let wosdCount=0;
    for(const incident of raw){
     if(incident.sd_occur)continue;
     if(!incident.power_occur||!incident.power_clear)continue;
     // Staging table timestamps use YYYY-MM-DD HH:mm:ss in a single timezone.
     const start=Date.parse(incident.power_occur.replace(' ','T'));
     const end=Date.parse(incident.power_clear.replace(' ','T'));
     if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;
     const minutes=(end-start)/60000;
     if(minutes>500)continue; // Existing FM assessment's 500-minute incident cap.
     wosdMax=Math.max(wosdMax??0,minutes);wosdCount++;
    }
    site.fm_recovered_count=wosdCount;
    if(wosdMax!==null){
     site.wosd_max_min=wosdMax;
     site.wosd_count=wosdCount;
     site.cp_evidence_status='WOSD recovered from complete CP window';
     site.data_source='FM staging — calculated WOSD';
    }else{
     site.cp_evidence_status=raw.length===0?'EASS Not Reporting — no CP/RIF incident in Sep–Oct FM staging':'CP evidence present — backup not measurable';
    }
   }
   // Final classification uses measured maximum backup, never DG/mixed labels.
   // No WSD/WOSD maximum means unverified, not a confirmed low backup. A complete CP window without SD can recover WOSD.
   for(const site of merged){
    const values=[site.wsd_max_min,site.wosd_max_min].filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0);
    const measured=values.length?Math.max(...values):null;
    site.dashboard_status=measured===null?'BACKUP_NOT_VERIFIED':measured>=120?'BACKUP_OK':'BACKUP_LOW';
   }
   setSites(merged.filter(x=>/^(?:central[- ]?[16]|c[- ]?[16])$/i.test(String(x.sub_region||'').trim())).map(x=>({...x})));
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setLoading(false);}
 },[client]);
 useEffect(()=>{if(active&&!loaded&&!loading&&!error)void load();},[active,loaded,loading,error,load]);
 const bbTypes=useMemo(()=>[...new Set(sites.map(x=>x.bb_type?.trim()).filter((v):v is string=>Boolean(v)))].sort(),[sites]);
 const bbSites=useMemo(()=>sites.filter(x=>bbTypeFilter==='All'||(x.bb_type||'').trim()===bbTypeFilter),[sites,bbTypeFilter]);
 const subs=useMemo(()=>[...new Set(bbSites.map(x=>x.sub_region||'Unassigned'))].sort(),[bbSites]);
 const grids=useMemo(()=>[...new Set(bbSites.filter(x=>sub==='All'||(x.sub_region||'Unassigned')===sub).map(x=>x.grid||'Unassigned'))].sort(),[bbSites,sub]);
 const scope=useMemo(()=>bbSites.filter(x=>(sub==='All'||(x.sub_region||'Unassigned')===sub)&&(grid==='All'||(x.grid||'Unassigned')===grid)),[bbSites,sub,grid]);
 // All assessments and priority cards respond to the selected evidence mode.
 const backupMinutes=(x:Site):number|null=>{
  const values=(evidenceMode==='wsd'?[x.wsd_max_min]:evidenceMode==='wosd'?[x.wosd_max_min]:[x.wsd_max_min,x.wosd_max_min])
   .filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0);
  return values.length?Math.max(...values):null;
 };
 const status=(x:Site):Status=>{const v=backupMinutes(x);return v===null?'BACKUP_NOT_VERIFIED':v>=120?'BACKUP_OK':'BACKUP_LOW';};
 const lowBackup=(x:Site)=>status(x)==='BACKUP_LOW';
 const lowCA=(x:Site)=>x.october_ca_pct!==null&&x.october_ca_pct<98;
 const isP0=(x:Site)=>lowBackup(x)&&x.october_ca_pct!==null&&x.october_ca_pct<95;
 const isP1=(x:Site)=>lowBackup(x)&&x.october_ca_pct!==null&&x.october_ca_pct>=95&&x.october_ca_pct<98;
 const isP2=(x:Site)=>lowBackup(x)&&x.october_ca_pct!==null&&x.october_ca_pct>=98;
 const priority=(x:Site):'P0'|'P1'|'P2'|'—'=>isP0(x)?'P0':isP1(x)?'P1':isP2(x)?'P2':'—';
 const action=(x:Site)=>{const p=priority(x);return p==='P0'?'Critical: CA below 95% and backup below 120 minutes — urgent recovery':p==='P1'?'High: CA 95–98% and backup below 120 minutes — rectify':p==='P2'?'Preventive: CA at least 98%, backup below 120 minutes — rectify before outage':'Monitor evidence and backup';};
 const match=(x:Site)=>tab!=='Sites Requiring Action'||priority(x)!=='—';
 const priorityOrder:Record<string,number>={P0:0,P1:1,P2:2,'—':3};
 const filtered=scope.filter(x=>match(x)&&(!search||[x.site_id,x.sub_region,x.grid].some(y=>String(y||'').toLowerCase().includes(search.toLowerCase())))).sort((a,b)=>priorityOrder[priority(a)]-priorityOrder[priority(b)]||(a.october_ca_pct??101)-(b.october_ca_pct??101));
 const pages=Math.max(1,Math.ceil(filtered.length/30));
 const loadIncidents=useCallback(async(id:string)=>{
  setIncidentLoading(true);setIncidentError('');
  try{
   // Read every staging incident; the modal page is only a presentation slice.
   const all:Incident[]=[];
   for(let offset=0;offset<10000;offset+=1000){
    const {data,error}=await client.from('fm_incidents_20261023_staging')
     .select('site_id,power_occur,power_clear,power_alarm_type,sd_occur,sd_title,backup_min,incident_type,merged_power_alarms')
     .eq('site_id',id).order('power_occur',{ascending:false}).range(offset,offset+999);
    if(error)throw error;
    all.push(...(data||[]) as Incident[]);
    if(!data||data.length<1000)break;
   }
   const raw:RawAlarm[]=[];
   for(let offset=0;offset<10000;offset+=1000){
    const {data,error}=await client.from('bb_raw_alarms').select('id,alarm_kind,alarm_title,occurred_at,cleared_at,source_file')
     .eq('site_id',id).order('occurred_at',{ascending:false}).range(offset,offset+999);
    if(error)throw error;
    raw.push(...(data||[]) as RawAlarm[]);
    if(!data||data.length<1000)break;
   }
   // Raw timestamps are UTC; staging timestamps are Pakistan local time (UTC+05).
   // Match power alarms by occur AND clear, allowing 90 seconds of processing tolerance.
   const used=new Set<number>();const details:Record<string,boolean>={};
   for(const event of all){
    const start=localMs(event.power_occur),end=localMs(event.power_clear);
    const required=String(event.power_alarm_type||'').split('+').map(x=>x.trim().toUpperCase()).filter(Boolean);
    const found:number[]=[];
    for(const kind of required){
     const idx=raw.findIndex((r,i)=>!used.has(i)&&!found.includes(i)&&String(r.alarm_kind||'').toUpperCase()===kind&&
      Math.abs(Date.parse(String(r.occurred_at))-start)<=90000&&
      (!event.power_clear||Math.abs(Date.parse(String(r.cleared_at))-end)<=90000));
     if(idx>=0)found.push(idx);
    }
    // Site-down must also be present as an individual raw alarm when staging has SD.
    const sdIdx=event.sd_occur?raw.findIndex((r,i)=>!used.has(i)&&!found.includes(i)&&String(r.alarm_kind||'').toUpperCase()==='SD'&&Math.abs(Date.parse(String(r.occurred_at))-localMs(event.sd_occur))<=90000):-1;
    const ok=required.length>0&&found.length===required.length&&(!event.sd_occur||sdIdx>=0);
    details[String(event.power_occur)]=ok;
    if(ok){found.forEach(i=>used.add(i));if(sdIdx>=0)used.add(sdIdx);}
   }
   const matched=all.filter(e=>details[String(e.power_occur)]).length;
   // Classify EVERY imported raw alarm. Never turn an unmatched SD into a battery failure.
   // Raw timestamps have timezone offsets; staging timestamps are Pakistan local (+05:00).
   const powerEvents=all.filter(e=>e.power_occur).map(e=>({e,start:localMs(e.power_occur),end:localMs(e.power_clear)}));
   const rawAssessed:RawAssessment[]=raw.map(r=>{
    const kind=String(r.alarm_kind||'').toUpperCase();const t=Date.parse(String(r.occurred_at));
    const linked=powerEvents.find(v=>{
     if(kind==='SD')return Number.isFinite(t)&&Number.isFinite(v.start)&&Number.isFinite(v.end)&&t>=v.start&&t<=v.end;
     return Number.isFinite(t)&&Math.abs(t-v.start)<=90000;
    });
    if(kind==='SD'){
     if(linked){const minutes=(t-linked.start)/60000;const valid=Number.isFinite(minutes)&&minutes>=0&&minutes<=500;
      return {raw:r,category:valid?'WSD — linked SD':'SD in power window — review',reason:valid?'SD occurred during a CP/RIF window; WSD duration from power onset':'Power window timing invalid; investigate',backup:valid?minutes:null,matchedPower:linked.e.power_occur,qualifies:valid};}
     const post=powerEvents.find(v=>Number.isFinite(t)&&Number.isFinite(v.end)&&t>v.end&&t-v.end<=24*3600000);
     return {raw:r,category:post?'Post-power SD — RCA required':'Non-power SD — RCA required',reason:post?'SD occurred after power restoration; not a WSD event':'No active CP/RIF window. Possible MW/TXN, fiber, RAN or other cause; not confirmed',backup:null,matchedPower:post?.e.power_occur??null,qualifies:false};
    }
    if(['PA','CPF','CP','RIF'].includes(kind)){
     if(!linked)return {raw:r,category:'Unmatched power alarm — review',reason:'Raw CP/RIF has no corresponding FM staging incident; investigate processing/coverage',backup:null,matchedPower:null,qualifies:false};
     const event=linked.e;const v=Number(event.backup_min);const valid=Number.isFinite(v)&&v>=0&&v<=500&&['WSD','WOSD'].includes(String(event.incident_type).toUpperCase());
     return {raw:r,category:valid?`${event.incident_type} — power evidence`:'Power event — review',reason:valid?`${event.incident_type} observation; linked to FM incident`:'Matched power event without valid backup duration',backup:valid?v:null,matchedPower:event.power_occur,qualifies:valid};
    }
    return {raw:r,category:'Other alarm — excluded',reason:'Not a qualifying CP/RIF or SD alarm; retained for complete audit',backup:null,matchedPower:null,qualifies:false};
   });
   setRawAssessments(rawAssessed);setRawPage(1);setRawKind('All');
   setReconcile({total:all.length,matched,unmatched:all.length-matched,rawCount:raw.length,rawUnmatched:raw.length-used.size,rawThrough:raw[0]?.occurred_at||null,details});
   setAllEvidence(all);
  }catch(e){setIncidentError(e instanceof Error?e.message:String(e));}
  finally{setIncidentLoading(false);}
 },[client]);
 const open=(s:Site)=>{setSiteCapacity(s.capacity_ah);void client.from('bb_capacity_master').select('capacity_ah').eq('site_id',s.site_id).maybeSingle().then(({data})=>{if(data?.capacity_ah!=null)setSiteCapacity(Number(data.capacity_ah));});setRawAssessments([]);setSelected(s);setAllEvidence([]);setReconcile(null);void loadIncidents(s.site_id);};
 const openAnySite=()=>{const id=auditSearch.trim();if(!/^\d{3,8}$/.test(id)){setIncidentError('Enter a numeric Site ID');return;}const existing=sites.find(x=>x.site_id===id);const s:Site=existing??{site_id:id,sub_region:null,grid:null,site_group:'Outside Pure Li-ion scope / check master',classification:null,bb_type:null,capacity_ah:null,capacity_configuration:null,dg_status:null,bb_installation_date:null,october_ca_pct:null,low_ca_days:0,wsd_max_min:null,wosd_max_min:null,wsd_count:0,wosd_count:0,wsd_failure_count:0,wsd_ge120_count:0,wosd_ge120_count:0,chronic_high_capacity_low_ca:false,dashboard_status:'BACKUP_NOT_VERIFIED',data_source:'FM raw audit only'};open(s);};
 const summary=(field:'sub_region'|'grid')=><section style={panel}>
  <h3 style={{marginTop:0}}>{field==='grid'?'Grid':'Sub-region'} summary</h3>
  <div style={{overflowX:'auto'}}><table style={{borderCollapse:'collapse',width:'100%'}}>
   <thead><tr>{['Name','Sites','Backup OK','Suspected Low','EASS Not Reporting','CA <98%','High capacity / Low CA','View'].map(t=><th key={t} style={{...cell,background:'#e8f6ee'}}>{t}</th>)}</tr></thead>
   <tbody>{[...new Set(filtered.map(x=>x[field]||'Unassigned'))].sort().map(k=>{
    const r=filtered.filter(x=>(x[field]||'Unassigned')===k);
    const isOpen=drill?.field===field&&drill.value===k;
    return <tr key={k} style={{background:isOpen?'#e9f8ef':undefined}}>
     {[k,r.length,r.filter(x=>status(x)==='BACKUP_OK').length,r.filter(x=>status(x)==='BACKUP_LOW').length,r.filter(x=>status(x)==='BACKUP_NOT_VERIFIED').length,r.filter(x=>x.october_ca_pct!=null&&x.october_ca_pct<98).length,r.filter(x=>x.chronic_high_capacity_low_ca).length].map((v,i)=><td key={i} style={cell}>{v}</td>)}
     <td style={cell}><button style={{...btn,background:isOpen?'#087f63':'#e8f6ee',color:isOpen?'#fff':'#12654c'}} onClick={()=>{setDrill(isOpen?null:{field,value:k});setPage(1);}}>{isOpen?'Close':'View'}</button></td>
    </tr>;
   })}
   <tr style={{background:'#d9f2e5',fontWeight:800,borderTop:'2px solid #0b936d'}}>
    {['TOTAL',filtered.length,filtered.filter(x=>status(x)==='BACKUP_OK').length,filtered.filter(x=>status(x)==='BACKUP_LOW').length,filtered.filter(x=>status(x)==='BACKUP_NOT_VERIFIED').length,filtered.filter(x=>x.october_ca_pct!=null&&x.october_ca_pct<98).length,filtered.filter(x=>x.chronic_high_capacity_low_ca).length].map((v,i)=><td key={i} style={{...cell,fontWeight:800}}>{typeof v==='number'?v.toLocaleString('en-US'):v}</td>)}
    <td style={cell}>—</td>
   </tr></tbody>
  </table></div>
  {drill?.field===field&&<div style={{marginTop:14,borderTop:'2px solid #c8e7d8',paddingTop:12}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
    <h4 style={{margin:0}}>{field==='grid'?'Grid':'Sub-region'} {drill.value} — {filtered.filter(x=>(x[field]||'Unassigned')===drill.value).length} sites</h4>
    <div style={{display:'flex',gap:8}}><button style={btn} onClick={()=>csv(filtered.filter(x=>(x[field]||'Unassigned')===drill.value),evidenceMode)}>Export CSV</button><button style={btn} onClick={()=>setDrill(null)}>Close ×</button></div>
   </div>
   <div style={{overflowX:'auto',maxHeight:420,marginTop:10}}><table style={{width:'100%',borderCollapse:'collapse'}}>
    <thead><tr>{['Site ID','Revenue group','Sub-region','Grid','Capacity Ah','DG','Oct CA %','WSD max (min)','WOSD max (min)','Assessment','Evidence'].map(h=><th key={h} style={{...cell,background:'#e8f6ee',position:'sticky',top:0}}>{h}</th>)}</tr></thead>
    <tbody>{filtered.filter(x=>(x[field]||'Unassigned')===drill.value).map((x,i)=><tr key={x.site_id} style={{background:i%2?'#f7fbf8':'#fff'}}>
     {[x.site_id,x.site_group,x.sub_region,x.grid,x.capacity_ah,x.dg_status,n(x.october_ca_pct,2),n(x.wsd_max_min),n(x.wosd_max_min),nice(status(x))].map((v,j)=><td key={j} style={cell}>{j===0||j===1||j===3?formatDate(v==null?null:String(v)):v??'—'}</td>)}
     <td style={cell}><button style={btn} onClick={()=>open(x)}>View</button></td>
    </tr>)}</tbody>
   </table></div>
  </div>}
 </section>;
 const kpis:[string,number,Tab][]=[
  ['Sites · Selected BB Type',scope.length,'Executive Summary'],
  ['Backup OK',scope.filter(x=>status(x)==='BACKUP_OK').length,'Executive Summary'],
  ['Backup Low (<120 min)',scope.filter(lowBackup).length,'Sites Requiring Action'],
  ['EASS Not Reporting',scope.filter(x=>backupMinutes(x)===null).length,'Site Investigation'],
  ['CA below 98%',scope.filter(lowCA).length,'Sites Requiring Action'],
  ['P0 · CA <95% + Backup Low',scope.filter(isP0).length,'Sites Requiring Action']
 ];
 const priorityCards:[string,string,number][]=[
 ['P0','CA <95% + BB <120 min',scope.filter(isP0).length],
 ['P1','CA 95–98% + BB <120 min',scope.filter(isP1).length],
 ['P2','CA ≥98% + BB <120 min',scope.filter(isP2).length],
 ];
 return <div style={{display:active?'grid':'none',gap:14,color:'#173f34',fontFamily:'Inter,system-ui,sans-serif'}}>
 {(activeSection==='eass-master-update'||activeSection==='eass-wsd-recent')&&<BatteryRmsUpdates client={client} mode={activeSection==='eass-master-update'?'master':'recent'}/>}
 {activeSection!=='eass-master-update'&&activeSection!=='eass-wsd-recent'&&<>
 {error&&<div style={{...panel,color:'#b42318'}}>Load failed: {error} <button style={btn} onClick={()=>void load()}>Retry</button></div>}{loading&&<div style={panel}>Loading new assessment…</div>}
 <section style={{...panel,background:'#f7fdf9'}}><h3 style={{marginTop:0}}>Executive Summary · Battery Health ({bbTypeFilter})</h3><p style={{fontSize:12,color:"#55776b"}}>Assessment mode: {evidenceMode==="combined"?"Maximum of WSD and WOSD":evidenceMode==="wsd"?"WSD evidence only":"WOSD evidence only"}. Sites with no evidence in the selected mode remain unverified.</p>
 <div style={{...panel,display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}><label>BB Type <select style={btn} value={bbTypeFilter} onChange={e=>{setBbTypeFilter(e.target.value);setSub('All');setGrid('All');setPage(1);setDrill(null);}}><option value="All">All BB types</option>{bbTypes.map(x=><option key={x} value={x}>{x}</option>)}</select></label><label>Sub-region <select style={btn} value={sub} onChange={e=>{setSub(e.target.value);setGrid('All');setPage(1);}}><option>All</option>{subs.map(x=><option key={x}>{x}</option>)}</select></label><label>Grid <select style={btn} value={grid} onChange={e=>{setGrid(e.target.value);setPage(1);}}><option>All</option>{grids.map(x=><option key={x}>{x}</option>)}</select></label><label>Backup evidence <select style={btn} value={evidenceMode} onChange={e=>{setEvidenceMode(e.target.value as 'combined'|'wsd'|'wosd');setPage(1);setDrill(null);}}><option value="combined">Combined WSD / WOSD</option><option value="wsd">WSD only</option><option value="wosd">WOSD only</option></select></label><input style={btn} placeholder="Site ID / Grid" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/><button style={btn} onClick={()=>csv(filtered,evidenceMode)}>Export CSV ({filtered.length})</button><input style={btn} placeholder="Audit any Site ID (including SB)" value={auditSearch} onChange={e=>setAuditSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')openAnySite();}}/><button style={btn} onClick={openAnySite}>Open Raw FM Audit</button><button style={btn} onClick={()=>void load()} disabled={loading}>Refresh</button></div>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>{kpis.map(([label,value,target])=><button key={label} style={{...panel,borderTop:'4px solid #079b76',textAlign:'left',cursor:'pointer'}} onClick={()=>{setTab(target);setPage(1);}}><div style={{fontSize:12,color:'#57776b'}}>{label}</div><strong style={{fontSize:28}}>{value.toLocaleString()}</strong></button>)}</div>
 </section>
 <div style={{display:'flex',flexWrap:'wrap',gap:7}}>{tabs.map((t,i)=><button key={t} style={{...btn,background:tab===t?'#078767':'white',color:tab===t?'white':'#12654c'}} onClick={()=>{setTab(t);setPage(1);}}>{i+1}. {t}</button>)}</div>
 {tab==='Last 5 Days – WSD Degradation'&&<BatteryRmsUpdates client={client} mode="recent"/>}
 {tab==='Sites Requiring Action'&&<section style={panel}><h3 style={{marginTop:0}}>Priority Classification · Field Rectification</h3><p style={{fontSize:12,color:'#55776b'}}>P0 / P1 / P2 are mutually exclusive. Sites without CA are excluded from P0/P1/P2. DG and mixed labels do not override measured backup. Counts reflect the selected sub-region and grid.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:10}}>{priorityCards.map(([label,desc,count])=><div key={label} style={{...panel,borderTop:'4px solid '+(label==='P0'?'#c33d32':label==='P1'?'#e0a12c':label==='P2'?'#1981a8':'#849598')}}><strong>{label} · {desc}</strong><div style={{fontSize:28,fontWeight:800}}>{count.toLocaleString()}</div></div>)}</div><p style={{fontSize:12,color:'#55776b'}}>P0 + P1 + P2 = {(scope.filter(isP0).length+scope.filter(isP1).length+scope.filter(isP2).length).toLocaleString()} classified sites. Total low backup: {scope.filter(lowBackup).length.toLocaleString()}. Non-DG, repeated WSD failures and capacity ≥400Ah are secondary field factors.</p><button style={btn} onClick={()=>csv(filtered,evidenceMode)}>Export action sites ({filtered.length})</button></section>}
 <section style={panel}><h3 style={{margin:0}}>{tab} — {filtered.length.toLocaleString()} sites</h3><p style={{marginBottom:0,fontSize:13,color:'#55776b'}}>{tab==='Sites Requiring Action'?'P0: CA <95% + BB <120 min · P1: CA 95–98% + BB <120 min · P2: CA ≥98% + BB <120 min. Sites without CA are excluded from priorities. All categories are mutually exclusive. Non-DG, repeated WSD failures and ≥400Ah are highlighted for field prioritization.':tab==='Executive Summary'?'Pure Li-ion sites; FM evidence may be missing. Backup is the maximum of validated WSD/WOSD; EASS Not Reporting means no CP evidence in the current FM staging, not proven battery failure.':'Search any site, open View to inspect September–October FM incidents, and export the filtered site list.'}</p></section>
 {tab==='Executive Summary'&&<>{summary('sub_region')}{summary('grid')}</>}
 <section style={panel}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center'}}><h3 style={{marginTop:0}}>{tab==='Sites Requiring Action'?'Prioritized field action list':tab==='Executive Summary'?'Site-level backup health':'Site investigation / search'}</h3><button style={btn} onClick={()=>csv(filtered,evidenceMode)}>Export all {filtered.length} sites</button></div><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Priority','Site','Class','BB Type','Sub-region','Grid','Ah','DG','Oct CA %','Low CA days','WSD max','WOSD max','WSD failures','Assessment','CP evidence status','Recommended action','Evidence'].map(h=><th key={h} style={{...cell,background:'#e8f6ee'}}>{h}</th>)}</tr></thead><tbody>{filtered.slice((Math.min(page,pages)-1)*30,Math.min(page,pages)*30).map((x,i)=><tr key={x.site_id} style={{background:i%2?'#f7fbf8':'white'}}>{[priority(x),x.site_id,x.classification,x.bb_type,x.sub_region,x.grid,x.capacity_ah,x.dg_status,n(x.october_ca_pct,2),x.low_ca_days,n(x.wsd_max_min),n(x.wosd_max_min),x.wsd_failure_count,nice(status(x)),x.cp_evidence_status??'FM assessment',action(x)].map((v,j)=><td key={j} style={{...cell,color:j===0&&priority(x)==='P0'?'#c33d32':undefined,fontWeight:j===0?800:undefined}}>{j===0||j===1||j===3?formatDate(v==null?null:String(v)):v??'—'}</td>)}<td style={cell}><button style={btn} onClick={()=>open(x)}>View</button></td></tr>)}</tbody></table></div><div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:12,marginTop:12}}><button style={btn} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button>{Math.min(page,pages)} / {pages}<button style={btn} disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Next</button></div></section>
 {selected&&<div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,30,24,.65)',display:'grid',placeItems:'center',padding:15}}><section style={{...panel,width:'min(1150px,96vw)',maxHeight:'90vh',overflow:'auto'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h3>Site {selected.site_id} — New FM evidence</h3><button style={btn} onClick={()=>setSelected(null)}>Close ×</button></div><p>Group: {selected.site_group} · BB Type: {selected.bb_type||'Unknown'} · Li-ion capacity: {siteCapacity??'—'} Ah · DG: {selected.dg_status||'Unknown'} · October CA: {n(selected.october_ca_pct,2)}% · Status: {nice(status(selected))} · CP evidence: {selected.cp_evidence_status??'FM assessment'}</p>{incidentLoading&&<p>Loading evidence…</p>}{incidentError&&<p style={{color:'#b42318'}}>{incidentError}</p>}<section style={{...panel,margin:'12px 0',background:'#f8fbff',borderColor:'#cbdcf0'}}><h3 style={{marginTop:0}}>All Events &amp; Assessment</h3>
 {(()=>{const power=allEvidence.filter(e=>['WSD','WOSD'].includes(String(e.incident_type).toUpperCase()));const wsd=power.filter(e=>String(e.incident_type).toUpperCase()==='WSD');const wosd=power.filter(e=>String(e.incident_type).toUpperCase()==='WOSD');const valid=power.map(e=>Number(e.backup_min)).filter(v=>Number.isFinite(v)&&v>=0&&v<=500);const max=valid.length?Math.max(...valid):null;const sd=rawAssessments.filter(x=>String(x.raw.alarm_kind).toUpperCase()==='SD');const nonPower=sd.filter(x=>x.category.startsWith('Non-power')||x.category.startsWith('Post-power'));const cards:[string,string,string][]=[['Power events assessed',String(power.length),`Sep: ${power.filter(x=>String(x.power_occur).startsWith('2026-09')).length} · Oct: ${power.filter(x=>String(x.power_occur).startsWith('2026-10')).length}`],['WSD events',String(wsd.length),'Site down during power failure'],['WOSD events',String(wosd.length),'No site down during power window'],['Maximum observed backup',max==null?'Not verified':`${n(max,2)} min`,max==null?'No valid power duration':max>=120?'≥120-minute target':'<120-minute observation'],['Non-power / post-power SD',String(nonPower.length),'Not counted as battery failures'],['Power raw reconciliation',`${reconcile?.matched??0}/${reconcile?.total??0} matched`,'Power-event evidence and raw-source matching shown separately']];return <section style={{...panel,marginBottom:12,background:'#f5faf7'}}><h3 style={{margin:'0 0 10px'}}>FM Analysis Summary</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:9}}>{cards.map(([label,value,detail])=><div key={label} style={{padding:10,border:'1px solid #d5e8de',borderRadius:9,background:'white'}}><div style={{fontSize:12,color:'#47695f'}}>{label}</div><strong style={{fontSize:19}}>{value}</strong><div style={{fontSize:11,color:'#55776b'}}>{detail}</div></div>)}</div><p style={{margin:'10px 0 0',fontSize:12,color:'#365e51'}}>{power.length?`Assessment: ${wsd.length} WSD and ${wosd.length} WOSD power observations; ${nonPower.length} standalone/post-power SD alarms excluded from backup calculations. ${reconcile?.unmatched??0} staged power events not matched to uploaded individual raw alarms.`:`No qualifying WSD/WOSD evidence in the loaded staging data; ${nonPower.length} standalone/post-power SD alarms require separate RCA. Do not infer zero battery autonomy.`} {max!==null&&max<120?'A short WOSD observation is not by itself proof of maximum battery autonomy.':''}</p></section>;})()}
 <h4 style={{margin:'10px 0'}}>September & October — All FM events and assessments</h4>
 {(()=>{
  type AuditRow={key:string;site:string;occur:string;clear:string;title:string;kind:string;assessment:string;backup:number|null;matched:string;reason:string;source:string;month:string;sort:number};
  const rawRows:AuditRow[]=rawAssessments.map(x=>({key:`raw-${x.raw.id}`,site:selected.site_id,occur:x.raw.occurred_at?new Date(x.raw.occurred_at).toLocaleString('sv-SE',{timeZone:'Asia/Karachi'}):'—',clear:x.raw.cleared_at?new Date(x.raw.cleared_at).toLocaleString('sv-SE',{timeZone:'Asia/Karachi'}):'—',title:x.raw.alarm_title||'—',kind:String(x.raw.alarm_kind||'—'),assessment:x.category,backup:x.backup,matched:formatDate(x.matchedPower),reason:x.reason,source:'Individual raw alarm',month:x.raw.occurred_at?new Date(x.raw.occurred_at).toLocaleString('sv-SE',{timeZone:'Asia/Karachi'}).slice(0,7):'',sort:Date.parse(String(x.raw.occurred_at))||0}));
  const stagedRows:AuditRow[]=allEvidence.map((e,i)=>({key:`fm-${i}`,site:selected.site_id,occur:formatDate(e.power_occur),clear:formatDate(e.power_clear),title:e.power_alarm_type||'Power failure',kind:String(e.incident_type||'Power'),assessment:`${e.incident_type||'Power'} — ${Number.isFinite(Number(e.backup_min))?'observed':'review'}`,backup:e.backup_min==null?null:Number(e.backup_min),matched:reconcile?.details[String(e.power_occur)]?'Raw matched':'Raw not matched',reason:e.incident_type==='WOSD'?'Power restored without SD during power window; observed duration is not necessarily maximum battery autonomy':e.incident_type==='WSD'?'SD during power failure; measured backup until SD':'Power event requires review',source:'FM staging power event',month:String(e.power_occur||'').slice(0,7),sort:localMs(e.power_occur)||0}));
  const combined=[...rawRows,...stagedRows].filter(x=>x.month==='2026-09'||x.month==='2026-10').sort((a,b)=>b.sort-a.sort||a.key.localeCompare(b.key));
  const visible=combined.filter(x=>rawKind==='All'||(rawKind==='September'?x.month==='2026-09':rawKind==='October'?x.month==='2026-10':rawKind==='Power'?x.source==='FM staging power event'||['PA','CPF','CP','RIF'].includes(x.kind.toUpperCase()):rawKind==='SD'?x.kind.toUpperCase()==='SD':rawKind==='Non-power SD'?x.assessment.startsWith('Non-power'):x.assessment.toLowerCase().includes('review')||x.matched==='Raw not matched'));
  const headers=['Site ID','Month','Alarm occur (PKT)','Alarm clear (PKT)','Alarm title','Kind','Assessment','Backup (min)','Matched power / raw check','Reason / RCA','Evidence source'];
  const exportCsv=()=>{const csvText=[headers.join(','),...visible.map(x=>[x.site,x.month,x.occur,x.clear,x.title,x.kind,x.assessment,x.backup??'',x.matched,x.reason,x.source].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','))].join('\r\n');const u=URL.createObjectURL(new Blob(['\uFEFF'+csvText],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=`Site_${selected.site_id}_Sep_Oct_All_FM_Assessments.csv`;a.click();URL.revokeObjectURL(u);};
  return <><div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center',marginBottom:10}}><strong>All events: {combined.length} · September: {combined.filter(x=>x.month==='2026-09').length} · October: {combined.filter(x=>x.month==='2026-10').length}</strong><label>Show <select style={btn} value={rawKind} onChange={e=>{setRawKind(e.target.value);setRawPage(1);}}>{['All','September','October','Power','SD','Non-power SD','Review'].map(k=><option key={k}>{k}</option>)}</select></label><button style={btn} onClick={exportCsv}>Export all FM assessments CSV</button></div><div style={{overflow:'auto',maxHeight:470}}><table style={{borderCollapse:'collapse',width:'100%',minWidth:1250}}><thead><tr>{headers.map(h=><th key={h} style={{...cell,background:'#e5efff',position:'sticky',top:0,zIndex:1}}>{h}</th>)}</tr></thead><tbody>{visible.slice((rawPage-1)*100,rawPage*100).map(x=><tr key={x.key}>{[x.site,x.month,x.occur,x.clear,x.title,x.kind,x.assessment,n(x.backup,2),x.matched,x.reason,x.source].map((v,j)=><td key={j} style={{...cell,whiteSpace:j===9?'normal':'nowrap',minWidth:j===9?240:undefined}}>{v??'—'}</td>)}</tr>)}</tbody></table></div><div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:10,marginTop:8}}><span>{visible.length} events · Page {rawPage}/{Math.max(1,Math.ceil(visible.length/100))}</span><button style={btn} disabled={rawPage<=1} onClick={()=>setRawPage(p=>p-1)}>Previous</button><button style={btn} disabled={rawPage*100>=visible.length} onClick={()=>setRawPage(p=>p+1)}>Next</button></div>{combined.length===0&&!incidentLoading&&<p>No September or October FM records found for this site in the currently loaded sources. This is missing evidence, not zero battery backup.</p>}</>;
 })()}
 {reconcile&&<p style={{fontSize:12,color:'#55776b'}}>Raw reconciliation: {reconcile.matched}/{reconcile.total} FM incidents matched to individual raw power alarms (including SD when present); {reconcile.unmatched} not verified. Raw alarms: {reconcile.rawCount}; unmatched raw alarms: {reconcile.rawUnmatched}. Latest raw alarm: {formatDate(reconcile.rawThrough)} UTC. A missing match may indicate incomplete raw uploads, not necessarily a skipped FM event. Timestamp matching uses Pakistan UTC+05 and 90-second tolerance.</p>}
</section></section></div>}
 </>}
 </div>;
}
