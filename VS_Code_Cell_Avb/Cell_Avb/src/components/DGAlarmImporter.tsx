import * as XLSX from "xlsx";
import React, { useEffect, useState } from "react";

type AlarmRow = { site_id:string; grid:string; alarm_kind:"DG"|"CPF"|"RIF"; occurred_at:string; cleared_at:string|null; fingerprint:string };
function csvFields(line:string):string[] {
  const fields:string[]=[]; let value="",quoted=false;
  for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){fields.push(value.trim());value="";}else value+=ch;}
  fields.push(value.trim());return fields;
}
function localDate(value:string):string|null {
 const raw=String(value??"").trim();
 if(!raw)return null;
 const m=raw.match(/^(\d{1,4})[-/](\d{1,2})[-/](\d{1,4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
 if(!m)return null;
 let yyyy:number,mm:number,dd:number;
 if(m[1].length===4){yyyy=Number(m[1]);mm=Number(m[2]);dd=Number(m[3]);}
 else{dd=Number(m[1]);mm=Number(m[2]);yyyy=Number(m[3]);}
 const hh=Number(m[4]),mi=Number(m[5]),ss=Number(m[6]||0);
 const d=new Date(yyyy,mm-1,dd,hh,mi,ss);
 if(d.getFullYear()!==yyyy||d.getMonth()!==mm-1||d.getDate()!==dd||hh>23||mi>59||ss>59)return null;
 return [yyyy,String(mm).padStart(2,"0"),String(dd).padStart(2,"0")].join("-")+"T"+[hh,mi,ss].map(x=>String(x).padStart(2,"0")).join(":");
}
function kind(title:string):"DG"|"CPF"|"RIF"|null {
  const t=title.toLowerCase().replace(/\s+/g," ").trim();
  if(t==="dg in operation")return "DG";
  if(t==="commercial power failure")return "CPF";
  if(t==="rectifier input failure")return "RIF";
  return null;
}
export default function DGAlarmImporter(){
 const [eassBusy,setEassBusy]=useState(false),[eassStatus,setEassStatus]=useState("Select a Final Power Duration Report (.xlsx or .csv).");
 async function uploadEass(file:File){
  setEassBusy(true);setEassStatus("Reading daily EASS report...");
  try{
   const env=(import.meta as any).env||{};
   const base=String(env.VITE_SUPABASE_URL||"").replace(/\/$/,"");
   const key=String(env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY||"");
   const raw=sessionStorage.getItem("cell_avb_supabase_session");
   const session=raw?JSON.parse(raw):null;
   if(!base||!key||!session?.access_token)throw Error("Sign in to Supabase before uploading.");
   const headers={apikey:key,Authorization:"Bearer "+session.access_token};
   const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});
   const rows=XLSX.utils.sheet_to_json<(string|number|Date|null)[]>(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null,raw:true});
   if(rows.length<2)throw Error("Empty report.");
   const normalize=(v:unknown)=>String(v??"").toLowerCase().replace(/[^a-z0-9]/g,"");
   const cols=(rows[0]||[]).map(normalize);
   const pos=(...names:string[])=>cols.findIndex(x=>names.map(normalize).includes(x));
   const idx={date:pos("Statistics date"),site:pos("Site name","Site ID"),region:pos("Region"),sub:pos("SubRegion"),grid:pos("Grid"),cp:pos("CP"),dg:pos("DG"),battery:pos("Battery"),noPower:pos("No_Power(2G)"),down3:pos("3g site down"),down4:pos("4g site down"),complete:pos("Complete site down"),ls:pos("Load Shedding"),total:pos("Total"),installed:pos("Generator Installed")};
   if([idx.date,idx.site,idx.grid,idx.dg,idx.ls,idx.total].some(x=>x<0))throw Error("Required columns: Statistics date, Site name, Grid, DG, Load Shedding, Total.");
   const date=(v:unknown):string|null=>{
    if(v instanceof Date&&!isNaN(v.getTime()))return [v.getFullYear(),String(v.getMonth()+1).padStart(2,"0"),String(v.getDate()).padStart(2,"0")].join("-");
    if(typeof v==="number"){const d=XLSX.SSF.parse_date_code(v);return d?[d.y,String(d.m).padStart(2,"0"),String(d.d).padStart(2,"0")].join("-"):null;}
    const m=String(v??"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[0]:null;
   };
   const num=(v:unknown)=>{if(v===null||v===undefined||String(v).trim()==="")return null;const n=Number(v);return Number.isFinite(n)?n:null;};
   const masterResponse=await fetch(base+"/rest/v1/dg_mode_monitoring?select=site_id,grid,dg_status&limit=2000",{headers});
   if(!masterResponse.ok)throw Error("DG master lookup failed: HTTP "+masterResponse.status);
   const dgMaster=new Map<string,string>();
   for(const item of await masterResponse.json() as {site_id:string;grid:string;dg_status:string}[]){
     if(/^C(1|6)\d{3}$/.test(String(item.grid||""))&&String(item.dg_status||"").toLowerCase()==="operational")
       dgMaster.set(String(item.site_id).trim(),String(item.grid));
   }
   if(!dgMaster.size)throw Error("No operational C1/C6 DG sites found in DG master.");
   const values=new Map<string,Record<string,unknown>>();let excluded=0,nonDg=0,invalid=0;
   for(const row of rows.slice(1)){
    const site=String(row[idx.site]??"").trim().replace(/\.0$/,"");
    const grid=String(row[idx.grid]??"").trim().toUpperCase().replace(/[\s_-]/g,"");
    const day=date(row[idx.date]);
    if(!site)continue;
    if(!/^C(1|6)\d{3}$/.test(grid)){excluded++;continue;}
    if(dgMaster.get(site)!==grid){nonDg++;continue;}
    if(!day||num(row[idx.total])===null||num(row[idx.dg])===null||num(row[idx.ls])===null){invalid++;continue;}
    values.set(site+"|"+day,{site_id:site,statistics_date:day,region:String(row[idx.region]??""),sub_region:String(row[idx.sub]??""),grid,
      cp_hours:num(row[idx.cp]),dg_hours:num(row[idx.dg]),battery_hours:num(row[idx.battery]),no_power_2g:num(row[idx.noPower]),
      site_down_3g:num(row[idx.down3]),site_down_4g:num(row[idx.down4]),complete_site_down:num(row[idx.complete]),
      load_shedding_hours:num(row[idx.ls]),total_hours:num(row[idx.total]),generator_installed:String(row[idx.installed]??"")});
   }
   const data=[...values.values()];if(!data.length)throw Error("No valid C1/C6 records. Check date, grid and required hour columns.");
   for(let i=0;i<data.length;i+=250){
    const response=await fetch(base+"/rest/v1/cell_avb_dg_eass_daily?on_conflict=site_id,statistics_date",{
      method:"POST",headers:{...headers,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(data.slice(i,i+250))});
    if(!response.ok)throw Error("EASS upload HTTP "+response.status+": "+(await response.text()).slice(0,250));
    setEassStatus("Uploaded "+Math.min(i+250,data.length).toLocaleString()+" / "+data.length.toLocaleString()+" daily records...");
   }
   setEassStatus("Upload complete: "+data.length.toLocaleString()+" C1/C6 daily site records; "+excluded+" other-region rows excluded; "+nonDg+" non-DG sites excluded; "+invalid+" invalid rows. EASS OK: Total 22–26h. DG > Load Shedding: NOK.");
   await refreshPowerDurationDate();
  }catch(e){setEassStatus("Upload stopped: "+String(e));}finally{setEassBusy(false);}
 }
 const [uploadUnlocked,setUploadUnlocked]=useState(false);
 const [uploadPin,setUploadPin]=useState("");
 const [uploadPinError,setUploadPinError]=useState("");
 const unlockUploads=(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();
  if(uploadPin==="!@%^ifi"){setUploadUnlocked(true);setUploadPin("");setUploadPinError("");}
  else{setUploadPinError("Incorrect upload password.");setUploadPin("");}
 };
 const [bmBusy,setBmBusy]=useState(false);const [bmStatus,setBmStatus]=useState("Upload site-wise DG fuel consumption benchmarks (.xlsx or .csv).");
 const [busy,setBusy]=useState(false);const [status,setStatus]=useState("Select the original FM system alarm Excel or CSV export.");const [progress,setProgress]=useState(0);
 const [latestPowerDurationDate,setLatestPowerDurationDate]=useState<string|null>(null);
 const [powerDurationDateLoading,setPowerDurationDateLoading]=useState(true);
 const [powerDurationDateError,setPowerDurationDateError]=useState(false);
 async function refreshPowerDurationDate(){
  setPowerDurationDateLoading(true);
  try{
   const env=(import.meta as any).env||{};
   const base=String(env.VITE_SUPABASE_URL||"").replace(/\/$/,"");
   const key=String(env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY||"");
   const raw=sessionStorage.getItem("cell_avb_supabase_session");
   const session=raw?JSON.parse(raw):null;
   if(!base||!key||!session?.access_token)throw Error("Not signed in");
   const response=await fetch(base+"/rest/v1/cell_avb_dg_eass_daily?select=statistics_date&order=statistics_date.desc&limit=1",{headers:{apikey:key,Authorization:"Bearer "+session.access_token},cache:"no-store"});
   if(!response.ok)throw Error("HTTP "+response.status);
   const records=await response.json() as {statistics_date:string}[];
   setLatestPowerDurationDate(records[0]?.statistics_date??null);
   setPowerDurationDateError(false);
  }catch{setPowerDurationDateError(true);}
  finally{setPowerDurationDateLoading(false);}
 }
 useEffect(()=>{void refreshPowerDurationDate();},[]);
 const [latestAlarmEvent,setLatestAlarmEvent]=useState<string|null>(null);
 const [latestAlarmLoading,setLatestAlarmLoading]=useState(true);
 const [latestAlarmError,setLatestAlarmError]=useState(false);
 async function refreshLatestAlarmEvent(){
  setLatestAlarmLoading(true);
  try{
   const env=(import.meta as any).env||{};
   const base=String(env.VITE_SUPABASE_URL||"").replace(/\/$/,"");
   const key=String(env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY||"");
   const raw=sessionStorage.getItem("cell_avb_supabase_session");
   const session=raw?JSON.parse(raw):null;
   if(!base||!key||!session?.access_token)throw Error("Not signed in");
   const response=await fetch(base+"/rest/v1/cell_avb_dg_alarm_events?select=occurred_at&order=occurred_at.desc&limit=1",{headers:{apikey:key,Authorization:"Bearer "+session.access_token},cache:"no-store"});
   if(!response.ok)throw Error("HTTP "+response.status);
   const records=await response.json() as {occurred_at:string}[];
   setLatestAlarmEvent(records[0]?.occurred_at??null);
   setLatestAlarmError(false);
  }catch{
   setLatestAlarmError(true);
  }finally{setLatestAlarmLoading(false);}
 }
 useEffect(()=>{void refreshLatestAlarmEvent();},[]);
 const latestAlarmDisplay=latestAlarmEvent?latestAlarmEvent.replace("T"," ").replace(/(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/,"").slice(0,19):null;

 async function uploadBM(file:File){
  setBmBusy(true);setBmStatus("Reading benchmark file...");
  try{
   const env=(import.meta as any).env||{};
   const base=String(env.VITE_SUPABASE_URL||"").replace(/\/$/,"");
   const key=String(env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY||"");
   const raw=sessionStorage.getItem("cell_avb_supabase_session");
   const session=raw?JSON.parse(raw):null;
   if(!base||!key||!session?.access_token)throw Error("Sign in to Supabase before uploading.");
   const headers={apikey:key,Authorization:"Bearer "+session.access_token};
   const master=await fetch(base+"/rest/v1/dg_mode_monitoring?select=site_id,grid&limit=1000",{headers});
   if(!master.ok)throw Error("DG master access failed: "+master.status);
   const sites=new Set<string>((await master.json()).filter((x:{site_id:string;grid:string})=>/^(C1|C6)/.test(String(x.grid))).map((x:{site_id:string})=>String(x.site_id).trim()));
   const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});
   const sheet=wb.Sheets[wb.SheetNames[0]];
   const data=XLSX.utils.sheet_to_json<(string|number|null)[]>(sheet,{header:1,defval:null});
   if(!data.length)throw Error("Empty benchmark sheet.");
   const cols=(data[0]||[]).map(x=>String(x??"").trim().toUpperCase().replace(/\s+/g," "));
   const idIndex=cols.findIndex(x=>["NAME","SITE","SITE ID","SITE_ID"].includes(x));
   const rateIndex=cols.findIndex(x=>["FUEL CONSUMPTION","DG L/H","DG LITERS PER HOUR","BENCHMARK","L/H"].includes(x));
   if(idIndex<0||rateIndex<0)throw Error("Required headers: NAME and FUEL CONSUMPTION.");
   const values=new Map<string,number>();const conflict=new Set<string>();let excluded=0,invalid=0,duplicates=0;
   for(const row of data.slice(1)){
    const site=String(row[idIndex]??"").trim().replace(/\.0$/,"");
    if(!site)continue;
    if(!sites.has(site)){excluded++;continue;}
    const rate=Number(row[rateIndex]);
    if(!Number.isFinite(rate)||rate<=0){invalid++;continue;}
    if(values.has(site)){duplicates++;if(Math.abs(values.get(site)!-rate)>0.0001)conflict.add(site);}
    else values.set(site,rate);
   }
   for(const site of conflict)values.delete(site);
   const entries=[...values].map(([site_id,dg_liters_per_hour])=>({site_id,dg_liters_per_hour,updated_at:new Date().toISOString()}));
   if(!entries.length)throw Error("No valid C1/C6 DG benchmarks found.");
   let sent=0;
   for(let i=0;i<entries.length;i+=100){
    const res=await fetch(base+"/rest/v1/cell_avb_fuel_responsibility?on_conflict=site_id",{
     method:"POST",headers:{...headers,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(entries.slice(i,i+100))
    });
    if(!res.ok)throw Error("Benchmark upload failed: HTTP "+res.status+" "+(await res.text()).slice(0,250));
    sent+=Math.min(100,entries.length-i);setBmStatus("Uploaded "+sent+" / "+entries.length+" benchmarks...");
   }
   setBmStatus("BM upload complete: "+sent+" unique C1/C6 DG sites; "+excluded+" outside DG master; "+invalid+" invalid rates; "+duplicates+" repeated rows; "+conflict.size+" conflicting sites excluded. Refresh Fuel Reconciliation to recalculate.");
  }catch(e){setBmStatus("BM upload stopped: "+String(e));}
  finally{setBmBusy(false);}
 }
 async function upload(file:File){
  setBusy(true);setProgress(0);
  try{
   const env=(import.meta as any).env||{};
   const base=String(env.VITE_SUPABASE_URL||"").replace(/\/$/,"");
   const key=String(env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY||"");
   const raw=sessionStorage.getItem("cell_avb_supabase_session");
   const session=raw?JSON.parse(raw):null;
   if(!base||!key||!session?.access_token)throw new Error("Sign in to Supabase before uploading.");
   const headers={apikey:key,Authorization:"Bearer "+session.access_token};
   const master=await fetch(base+"/rest/v1/dg_mode_monitoring?select=site_id,grid&limit=1000",{headers});
   if(!master.ok)throw new Error("DG master access failed: "+master.status);
   const sites=new Map<string,string>();
   for(const x of await master.json())if(/^(C1|C6)/.test(String(x.grid||"")))sites.set(String(x.site_id).trim(),String(x.grid));
   if(!sites.size)throw new Error("No C1/C6 DG sites found in DG master.");
   setStatus("Reading "+file.name+" and filtering against "+sites.size+" DG master sites...");
   const workbook=XLSX.read(await file.arrayBuffer(),{type:"array",raw:true});
   const sheet=workbook.Sheets[workbook.SheetNames[0]];
   const rows=XLSX.utils.sheet_to_json<(string|number|null)[]>(sheet,{header:1,defval:null,raw:false});
   const header=(rows[0]||[]).map(x=>String(x??"").replace(/^\uFEFF/,"").trim().toLowerCase().replace(/\s+/g," "));
   const positions=["site","alarm title","occur time","clear time"].map(x=>header.indexOf(x));
   if(positions.some(x=>x<0))throw new Error("Required columns: Site, Alarm title, Occur Time, Clear Time. Detected: "+header.slice(0,12).join(", "));
   const seen=new Map<string,number>();const selected:AlarmRow[]=[];let excluded=0,invalid=0,duplicates=0,siteMiss=0,titleMiss=0;
   const examples:string[]=[];
   for(const cells of rows.slice(1)){
    const site=String(cells[positions[0]]??"").trim().replace(/\.0$/,"");
    if(!site)continue;
    const grid=sites.get(site);const alarm=kind(String(cells[positions[1]]??""));
    if(!grid){siteMiss++;excluded++;continue;}
    if(!alarm){titleMiss++;excluded++;continue;}
    const occurred=localDate(String(cells[positions[2]]??""));
    const clearText=String(cells[positions[3]]??"").trim();
    const cleared=clearText?localDate(clearText):null;
    if(!occurred||(clearText&&!cleared)||(cleared&&cleared<occurred)){
      invalid++;if(examples.length<3)examples.push(site+" "+String(cells[positions[2]]??"")+" / "+clearText);continue;
    }
    const fingerprint=[site,alarm,occurred,cleared||""].join("|");
    const occurrenceKey=[site,alarm,occurred].join("|");
    const existingIndex=seen.get(occurrenceKey);
    if(existingIndex!==undefined){
      duplicates++;
      const existing=selected[existingIndex];
      if(cleared && (!existing.cleared_at || cleared>existing.cleared_at)){
        selected[existingIndex]={site_id:site,grid,alarm_kind:alarm,occurred_at:occurred,cleared_at:cleared,fingerprint};
      }
      continue;
    }
    seen.set(occurrenceKey,selected.length);
    selected.push({site_id:site,grid,alarm_kind:alarm,occurred_at:occurred,cleared_at:cleared,fingerprint});
   }
   if(!selected.length)throw new Error("No valid C1/C6 DG-site alarms. Total rows: "+(rows.length-1)+", unmatched sites: "+siteMiss+", unrelated alarms: "+titleMiss+", invalid timestamps: "+invalid+". Timestamp examples: "+examples.join("; ")+".");

   let inserted=0;
   for(let i=0;i<selected.length;i+=300){
    const batch=selected.slice(i,i+300);
    const res=await fetch(base+"/rest/v1/cell_avb_dg_alarm_events?on_conflict=site_id,alarm_kind,occurred_at",{
      method:"POST",headers:{...headers,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(batch)
    });
    if(!res.ok)throw new Error("Upload failed at row "+i+": HTTP "+res.status+" "+(await res.text()).slice(0,250));
    inserted+=batch.length;setProgress(Math.round(inserted/selected.length*100));
    setStatus("Processed "+inserted.toLocaleString()+" / "+selected.length.toLocaleString()+" filtered alarms...");
   }
   setStatus("Upload complete. "+selected.length.toLocaleString()+" eligible unique rows submitted; "+excluded.toLocaleString()+" irrelevant rows excluded; "+invalid+" invalid timestamps; "+duplicates+" file duplicates. Existing occurrences updated rather than duplicated; latest available clear time retained.");
   await refreshLatestAlarmEvent();
  }catch(e){setStatus("Upload stopped: "+(e instanceof Error?e.message:String(e)));}
  finally{setBusy(false);}
 }
 return <div className="space-y-4">
 {!uploadUnlocked ? <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
  <h3 className="text-lg font-bold text-emerald-950">Upload Authorization</h3>
  <p className="mt-1 text-sm text-slate-600">Enter the upload password to unlock DG Alarm, Power Duration and DG Benchmark Excel/CSV imports.</p>
  <form onSubmit={unlockUploads} className="mt-4 flex flex-wrap items-center gap-3">
   <input type="password" autoComplete="off" aria-label="Upload password" placeholder="Upload password" value={uploadPin} onChange={e=>{setUploadPin(e.target.value);setUploadPinError("");}} className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
   <button type="submit" className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800">Unlock Uploads</button>
  </form>
  {uploadPinError&&<p className="mt-2 text-sm font-semibold text-red-700" role="alert">{uploadPinError}</p>}
  <p className="mt-3 text-xs text-amber-700">Frontend-only password gate; existing Supabase permissions still apply.</p>
 </section> : <>
 <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
  <span className="text-sm font-semibold text-emerald-900">Uploads unlocked · Excel and CSV accepted</span>
  <button type="button" onClick={()=>setUploadUnlocked(false)} className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm font-semibold text-emerald-900">Lock Uploads</button>
 </div>
<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <h3 className="text-lg font-bold text-emerald-950">FM Alarm Query — CP, RIF and DG Alarms History</h3>
  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
   <div className="flex-1">
    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Last Alarm Event · Supabase</p>
    <p className="mt-1 text-xl font-black tabular-nums text-emerald-950">{latestAlarmLoading?"Checking latest event…":latestAlarmError?"Unable to load latest event":latestAlarmDisplay?latestAlarmDisplay+" (Pakistan time)":"No alarms uploaded yet"}</p>
    <p className="mt-1 text-xs text-emerald-800">Latest recorded occurrence time (not upload time). Upload subsequent alarms from this point; overlapping records are merged.</p>
   </div>
   <button type="button" onClick={()=>void refreshLatestAlarmEvent()} disabled={latestAlarmLoading} className="rounded-lg border border-emerald-600 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">Refresh Date</button>
  </div>
  <p className="mt-1 text-sm text-slate-600">Upload the original FM system Excel or CSV directly. Only Site, Alarm title, Occur Time and Clear Time are retained for C1/C6 DG master sites; unrelated alarms and columns are excluded.</p>
  <label className={`mt-5 inline-flex cursor-pointer items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-emerald-900/20 transition hover:from-emerald-800 hover:to-teal-700 hover:shadow-xl focus-within:ring-4 focus-within:ring-emerald-200 ${busy?"pointer-events-none opacity-60":""}`}>
   <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M4 16v4h16v-4"/></svg>
   <span>{busy?"Uploading alarms…":"Upload FM Alarm History"}</span>
   <input className="sr-only" type="file" accept=".xlsx,.xls,.csv,text/csv" disabled={busy} aria-label="Upload FM alarm history Excel or CSV" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value="";}}/>
  </label>
  <p className="mt-2 text-xs font-medium text-slate-500">Excel (.xlsx, .xls) or CSV · Duplicate occurrences are merged automatically</p>
  {busy&&<div className="mt-3 h-2 rounded bg-slate-200"><div className="h-2 rounded bg-blue-600" style={{width:progress+"%"}}/></div>}
  <p className="mt-3 text-sm text-slate-700" role="status">{status}</p>
 </section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold text-slate-900">Power Duration Report Upload</h3><div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><div className="flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Last Power Duration Date · Supabase</p><p className="mt-1 text-xl font-black tabular-nums text-emerald-950">{powerDurationDateLoading?"Checking latest date…":powerDurationDateError?"Unable to load latest date":latestPowerDurationDate?latestPowerDurationDate.split("-").reverse().join("-"):"No Power Duration data uploaded yet"}</p><p className="mt-1 text-xs text-emerald-800">Latest statistics date in the saved EASS report. Upload subsequent days; overlapping site/date records are updated.</p></div><button type="button" onClick={()=>void refreshPowerDurationDate()} disabled={powerDurationDateLoading} className="rounded-lg border border-emerald-600 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">Refresh Date</button></div><p className="mt-1 text-sm text-slate-600">Upload Final Power Duration Report (.xlsx/.xls/.csv). Only operational DG sites in the C1/C6 DG master are accepted; non-DG sites are excluded. EASS Status: Total 22–26 hours = OK, otherwise NOK. DG &gt; Load Shedding = NOK. Re-uploading the same site/date updates its record.</p><label className={`mt-5 inline-flex cursor-pointer items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-emerald-900/20 transition hover:from-emerald-800 hover:to-teal-700 hover:shadow-xl focus-within:ring-4 focus-within:ring-emerald-200 ${eassBusy?"pointer-events-none opacity-60":""}`}><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M4 16v4h16v-4"/></svg><span>{eassBusy?"Uploading…":"Upload Power Duration Report"}</span><input className="sr-only" type="file" accept=".xlsx,.xls,.csv" disabled={eassBusy} aria-label="Upload Power Duration Report Excel or CSV" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadEass(f);e.target.value="";}}/></label><p className="mt-3 text-sm text-slate-700" role="status">{eassStatus}</p></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-semibold text-slate-900">DG Benchmark (BM) Upload</h3><p className="mt-1 text-sm text-slate-600">Upload the site-wise fuel consumption benchmark in litres/hour. Supports Excel or CSV with NAME and FUEL CONSUMPTION columns. Only C1/C6 DG master sites are accepted. Conflicting duplicate site rates are excluded.</p><label className={`mt-5 inline-flex cursor-pointer items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-emerald-900/20 transition hover:from-emerald-800 hover:to-teal-700 hover:shadow-xl focus-within:ring-4 focus-within:ring-emerald-200 ${bmBusy?"pointer-events-none opacity-60":""}`}><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5"/><path d="M4 16v4h16v-4"/></svg><span>{bmBusy?"Uploading…":"Upload DG Benchmark"}</span><input className="sr-only" type="file" accept=".xlsx,.xls,.csv" disabled={bmBusy} aria-label="Upload DG Benchmark Excel or CSV" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadBM(f);e.target.value="";}}/></label><p className="mt-3 text-sm text-slate-700" role="status">{bmStatus}</p></section></>}</div>;
}