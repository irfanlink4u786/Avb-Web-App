import React, { useState } from "react";

type AlarmRow = { site_id:string; grid:string; alarm_kind:"DG"|"CPF"|"RIF"; occurred_at:string; cleared_at:string|null; fingerprint:string };
function csvFields(line:string):string[] {
  const fields:string[]=[]; let value="",quoted=false;
  for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){fields.push(value.trim());value="";}else value+=ch;}
  fields.push(value.trim());return fields;
}
function localDate(value:string):string|null {
  const m=value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if(!m)return null;
  const [,dd,mm,yyyy,hh,mi,ss]=m;const d=new Date(Number(yyyy),Number(mm)-1,Number(dd),Number(hh),Number(mi),Number(ss||0));
  if(d.getFullYear()!==Number(yyyy)||d.getMonth()!==Number(mm)-1||d.getDate()!==Number(dd)||Number(hh)>23||Number(mi)>59)return null;
  return yyyy+"-"+mm.padStart(2,"0")+"-"+dd.padStart(2,"0")+"T"+hh.padStart(2,"0")+":"+mi+":"+(ss||"00").padStart(2,"0");
}
function kind(title:string):"DG"|"CPF"|"RIF"|null {
  const t=title.toLowerCase().replace(/\s+/g," ").trim();
  if(t==="dg in operation")return "DG";
  if(t==="commercial power failure")return "CPF";
  if(t==="rectifier input failure")return "RIF";
  return null;
}
export default function DGAlarmImporter(){
 const [busy,setBusy]=useState(false);const [status,setStatus]=useState("Select the raw five-column alarm CSV file.");const [progress,setProgress]=useState(0);
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
   const data=await file.text();const lines=data.split(/\r?\n/);
   const header=csvFields(lines[0]||"").map(x=>x.toLowerCase());
   const positions=["site","alarm title","date","occur time","clear time"].map(x=>header.indexOf(x));
   if(positions.some(x=>x<0))throw new Error("Required columns: Site, Alarm title, Date, Occur Time, Clear Time");
   const seen=new Set<string>();const selected:AlarmRow[]=[];let excluded=0,invalid=0,duplicates=0;
   for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;
    const cells=csvFields(lines[i]);const site=(cells[positions[0]]||"").trim();
    const grid=sites.get(site);const alarm=kind(cells[positions[1]]||"");
    if(!grid||!alarm){excluded++;continue;}
    const occurred=localDate(cells[positions[3]]||"");
    const cleared=(cells[positions[4]]||"").trim()?localDate(cells[positions[4]]):null;
    if(!occurred||((cells[positions[4]]||"").trim()&&!cleared)|| (cleared&&cleared<occurred)){invalid++;continue;}
    const fingerprint=[site,alarm,occurred,cleared||""].join("|");
    if(seen.has(fingerprint)){duplicates++;continue;}seen.add(fingerprint);
    selected.push({site_id:site,grid,alarm_kind:alarm,occurred_at:occurred,cleared_at:cleared,fingerprint});
   }
   if(!selected.length)throw new Error("No valid C1/C6 DG-site alarm rows found.");
   let inserted=0;
   for(let i=0;i<selected.length;i+=300){
    const batch=selected.slice(i,i+300);
    const res=await fetch(base+"/rest/v1/cell_avb_dg_alarm_events?on_conflict=fingerprint",{
      method:"POST",headers:{...headers,"Content-Type":"application/json",Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(batch)
    });
    if(!res.ok)throw new Error("Upload failed at row "+i+": HTTP "+res.status+" "+(await res.text()).slice(0,250));
    inserted+=batch.length;setProgress(Math.round(inserted/selected.length*100));
    setStatus("Processed "+inserted.toLocaleString()+" / "+selected.length.toLocaleString()+" filtered alarms...");
   }
   setStatus("Upload complete. "+selected.length.toLocaleString()+" eligible unique rows submitted; "+excluded.toLocaleString()+" irrelevant rows excluded; "+invalid+" invalid timestamps; "+duplicates+" file duplicates. Existing database duplicates skipped.");
  }catch(e){setStatus("Upload stopped: "+(e instanceof Error?e.message:String(e)));}
  finally{setBusy(false);}
 }
 return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <h3 className="text-lg font-semibold text-slate-900">DG Running & Power Alarm Upload</h3>
  <p className="mt-1 text-sm text-slate-600">Upload the original system CSV. Only C1/C6 DG master sites and DG in Operation, Commercial Power Failure and Rectifier Input Failure alarms are stored. Duplicate uploads are safe.</p>
  <input className="mt-4 block w-full text-sm" type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value="";}}/>
  {busy&&<div className="mt-3 h-2 rounded bg-slate-200"><div className="h-2 rounded bg-blue-600" style={{width:progress+"%"}}/></div>}
  <p className="mt-3 text-sm text-slate-700" role="status">{status}</p>
 </section>;
}
