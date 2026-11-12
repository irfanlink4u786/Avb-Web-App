import {useEffect,useMemo,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
type Master={site_id:string;sub_region:string|null;grid:string|null;bb_type:string|null;capacity_ah:number|null;capacity_configuration:string|null;bb_installation_date:string|null};
type Recent={site_id:string;pa_occur:string;wsd_min:number;toc_hours:number;sub_region:string|null;grid:string|null};
type IncidentEvidence={id:number;site_id:string;pa_title:string|null;pa_occur:string|null;pa_clear:string|null;sd_title:string|null;sd_occur:string|null;validated_backup_min:number|null;toc_hours:number|null;validation_status:string;incident_key:string};
type RawEvidence={id:number;alarm_title:string|null;alarm_kind:string|null;occurred_at:string|null;cleared_at:string|null;source_file:string|null};
const showTime=(v:string|null|undefined)=>{if(!v)return '—';const match=String(v).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);return match?`${match[1]} ${match[2]}`:String(v);};
type Change={site_id:string;old_bb_type:string|null;old_capacity_ah:number|null;new_bb_type:string;new_capacity_ah:number|null;effective_date:string;remarks:string};
const button:React.CSSProperties={border:'1px solid #b6d6c9',borderRadius:9,padding:'9px 13px',background:'white',color:'#086b50',fontWeight:600,cursor:'pointer'};
const td:React.CSSProperties={padding:'9px',borderBottom:'1px solid #e2ebe7',textAlign:'left'};
function download(rows:Record<string,unknown>[],name:string){const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Battery');XLSX.writeFile(wb,name);}
async function allRows<T>(client:SupabaseClient,table:string):Promise<T[]>{const rows:T[]=[];for(let i=0;i<20000;i+=1000){const {data,error}=await client.from(table).select('*').range(i,i+999);if(error)throw error;rows.push(...data as T[]);if(!data||data.length<1000)break;}return rows;}
export default function BatteryRmsUpdates({client,mode}:{client:SupabaseClient;mode:'master'|'recent'}){
 const [evidence,setEvidence]=useState<{incident:Recent;details:IncidentEvidence|null;previous:IncidentEvidence|null;raw:RawEvidence[];error:string;loading:boolean}|null>(null),[master,setMaster]=useState<Master[]>([]),[recent,setRecent]=useState<Recent[]>([]),[selectedRegion,setSelectedRegion]=useState<string|null>(null),[sub,setSub]=useState('All'),[pending,setPending]=useState<Change[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[requestCount,setRequestCount]=useState(0);
 useEffect(()=>{let cancelled=false;Promise.all([allRows<Master>(client,'cell_avb_c1c6_bb_capacity'),allRows<Recent>(client,'cell_avb_c1c6_bb_recent_wsd'),client.from('bb_master_change_requests').select('id',{count:'exact',head:true})]).then(([a,b,c])=>{if(cancelled)return;setMaster(a);setRecent(b);setRequestCount(c.count??0);}).catch(e=>{if(!cancelled)setMessage(String(e.message||e));});return()=>{cancelled=true;};},[client]);
 const subs=useMemo(()=>[...new Set(master.map(x=>x.sub_region).filter(Boolean))].sort() as string[],[master]);
 const shown=master.filter(x=>(sub==='All'||x.sub_region===sub));
 const map=useMemo(()=>new Map(master.map(x=>[x.site_id,x])),[master]);
 async function viewEvidence(row:Recent){setEvidence({incident:row,details:null,previous:null,raw:[],error:'',loading:true});try{
 const {data:incidents,error:incidentError}=await client.from('bb_incidents').select('id,site_id,pa_title,pa_occur,pa_clear,sd_title,sd_occur,validated_backup_min,toc_hours,validation_status,incident_key').eq('site_id',row.site_id).eq('pa_occur',row.pa_occur).limit(5);
 if(incidentError)throw incidentError;
 const details=(incidents||[]).find(x=>x.sd_occur!==null)??incidents?.[0]??null;
 const {data:previousRows,error:previousError}=await client.from('bb_incidents').select('id,site_id,pa_title,pa_occur,pa_clear,sd_title,sd_occur,validated_backup_min,toc_hours,validation_status,incident_key').eq('site_id',row.site_id).lt('pa_occur',row.pa_occur).not('pa_clear','is',null).order('pa_occur',{ascending:false}).limit(1);if(previousError)throw previousError;const previous=previousRows?.[0]??null;
 const begin=new Date(new Date(row.pa_occur).getTime()-60*60*1000).toISOString();
 const end=new Date(new Date(row.pa_occur).getTime()+24*60*60*1000).toISOString();
 const {data:raw,error:rawError}=await client.from('bb_raw_alarms').select('id,alarm_title,alarm_kind,occurred_at,cleared_at,source_file').eq('site_id',row.site_id).gte('occurred_at',begin).lte('occurred_at',end).order('occurred_at',{ascending:true}).limit(300);
 setEvidence({incident:row,details,previous,raw:raw||[],error:rawError?'Raw alarm lookup: '+rawError.message:'',loading:false});
 }catch(err){setEvidence({incident:row,details:null,previous:null,raw:[],error:String(err),loading:false});}}
 async function readFile(file:File){setMessage('');setPending([]);try{
 const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:''});const changes:Change[]=[];const seen=new Set<string>();const errors:string[]=[];
 for(const [i,r] of rows.entries()){const id=String(r['Site ID']??'').trim().replace(/\.0$/,'');if(!id)continue;const old=map.get(id);if(!old){errors.push('Row '+(i+2)+': unknown site '+id);continue;}if(sub!=='All'&&old.sub_region!==sub){errors.push('Row '+(i+2)+': site outside selected sub-region');continue;}if(seen.has(id)){errors.push('Duplicate site '+id);continue;}seen.add(id);
 const type=String(r['Revised BB Type']??'').trim()||((String(r['Existing BB Type']??'').trim()!==String(old.bb_type??'').trim())?String(r['Existing BB Type']??'').trim():'');const revisedCap=String(r['Revised Capacity (Ah)']??'').trim();const editedExistingCap=String(r['Existing Capacity (Ah)']??'').trim();const capRaw=revisedCap||(editedExistingCap!==''&&Number(editedExistingCap)!==old.capacity_ah?editedExistingCap:'');if(!type&&!capRaw)continue;const cap=capRaw===''?old.capacity_ah:Number(capRaw);if(cap!==null&&(!Number.isFinite(cap)||cap<0)){errors.push('Invalid capacity at '+id);continue;}const newType=type||old.bb_type||'Unknown';if(newType===(old.bb_type||'Unknown')&&cap===old.capacity_ah)continue;
 const rawDate=r['Effective Date'];const date=rawDate instanceof Date?rawDate.toISOString().slice(0,10):String(rawDate||'').trim()?String(rawDate).slice(0,10):new Date().toISOString().slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){errors.push('Effective Date required (YYYY-MM-DD) for '+id);continue;}
 changes.push({site_id:id,old_bb_type:old.bb_type,old_capacity_ah:old.capacity_ah,new_bb_type:newType,new_capacity_ah:cap,effective_date:date,remarks:String(r['Remarks']??'')});
 }setPending(changes);setMessage(changes.length+' changed sites ready for submission. '+(errors.length?errors.slice(0,8).join('; '):'No validation errors.'));if(errors.length)setPending([]);
 }catch(e){setMessage('File error: '+String(e));}}
 async function submit(){if(!pending.length)return;setBusy(true);const {error}=await client.from('bb_master_change_requests').insert(pending);setBusy(false);if(error){setMessage('Submission failed: '+error.message);return;}setMessage(pending.length+' requests submitted for review. Battery master has NOT been changed.');setRequestCount(v=>v+pending.length);setPending([]);}
 return <section style={{background:'#fff',border:'1px solid #d5e8de',borderRadius:14,padding:16,marginTop:16}}>
 <h3>{mode==='master'?'RMS · Battery Master Update':'Last 5 Days · WSD Degradation'}</h3>

 {mode==='master'?<><p>Export your sub-region inventory, enter revised values (or edit existing values), and upload the same Excel file. Effective Date defaults to today when blank. Changes are staged for review; the live master is preserved.</p>
 <label>Sub-region <select style={button} value={sub} onChange={e=>setSub(e.target.value)}><option>All</option>{subs.map(x=><option key={x}>{x}</option>)}</select></label> <button style={button} onClick={()=>download(shown.map(x=>({'Site ID':x.site_id,'Sub-region':x.sub_region,'Grid':x.grid,'Existing BB Type':x.bb_type,'Existing Capacity (Ah)':x.capacity_ah,'Configuration':x.capacity_configuration,'Installation Date':x.bb_installation_date,'Revised BB Type':'','Revised Capacity (Ah)':'','Effective Date':'','Remarks':''})), 'BB_Master_Update_'+sub+'.xlsx')}>Export BB Master Excel ({shown.length})</button>
 <label style={{display:'inline-block',marginLeft:10}}>Upload edited Excel <input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const f=e.target.files?.[0];if(f)void readFile(f);e.target.value='';}}/></label>
 <p>Pending requests recorded: {requestCount}. New valid changes in preview: {pending.length}.</p>
 {pending.length>0&&<><div style={{overflowX:'auto',maxHeight:250}}><table style={{borderCollapse:'collapse',width:'100%'}}><thead><tr>{['Site','Old BB','New BB','Old Ah','New Ah','Effective date'].map(x=><th style={td} key={x}>{x}</th>)}</tr></thead><tbody>{pending.slice(0,100).map(x=><tr key={x.site_id}>{[x.site_id,x.old_bb_type,x.new_bb_type,x.old_capacity_ah,x.new_capacity_ah,x.effective_date].map((v,i)=><td key={i} style={td}>{v??'—'}</td>)}</tr>)}</tbody></table></div><button style={button} disabled={busy} onClick={()=>void submit()}>{busy?'Submitting…':'Submit '+pending.length+' Changes for Review'}</button></>}
 </>:<><p>Latest five available FM alarm dates · validated WSD below 120 minutes · TOC above 4 hours. No comparison with previous WSD is required. Missing evidence is excluded, not counted as zero.</p>
 {(()=>{const regions=[...new Set(recent.map(x=>x.sub_region||'Unassigned'))].sort();const selected=selectedRegion===null?recent:recent.filter(x=>(x.sub_region||'Unassigned')===selectedRegion);const unique=(a:Recent[])=>new Set(a.map(x=>x.site_id)).size;const format=(v:string)=>showTime(v);const exportRows=(a:Recent[])=>a.map(x=>({'Site ID':x.site_id,'Sub-region':x.sub_region||'Unassigned','Grid':x.grid||'—','Incident':format(x.pa_occur),'WSD (min)':Number(x.wsd_min).toFixed(2),'TOC (h)':Number(x.toc_hours).toFixed(2)}));return <>
 <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:14}}><strong>{unique(recent)} low-backup sites · {recent.length} incidents</strong><button style={button} onClick={()=>download(exportRows(selected),'Low_WSD_Last_5_Available_FM_Days.xlsx')}>Export Excel</button>{selectedRegion!==null&&<button style={button} onClick={()=>setSelectedRegion(null)}>Show all sub-regions</button>}</div>
 <h4>Sub-region summary</h4>
 <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Sub-region','Low WSD sites','Incidents','Minimum WSD (min)','View'].map(h=><th key={h} style={td}>{h}</th>)}</tr></thead><tbody>{regions.map(region=>{const a=recent.filter(x=>(x.sub_region||'Unassigned')===region);return <tr key={region}><td style={td}>{region}</td><td style={td}>{unique(a)}</td><td style={td}>{a.length}</td><td style={td}>{Math.min(...a.map(x=>Number(x.wsd_min))).toFixed(2)}</td><td style={td}><button style={button} onClick={()=>setSelectedRegion(region)}>View all records</button></td></tr>})}</tbody></table></div>
 <h4>{selectedRegion===null?'All sub-regions':selectedRegion} · Low WSD incident records</h4>
 {selected.length===0?<p>No qualifying validated WSD incidents in the latest five available FM dates.</p>:<div style={{overflowX:'auto',maxHeight:480}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Site ID','Sub-region','Grid','Incident date & time','WSD (min)','TOC (h)','Evidence'].map(h=><th key={h} style={td}>{h}</th>)}</tr></thead><tbody>{selected.slice().sort((a,b)=>b.pa_occur.localeCompare(a.pa_occur)).map((x,i)=><tr key={x.site_id+'-'+x.pa_occur+'-'+i}>{[x.site_id,x.sub_region||'Unassigned',x.grid||'—',format(x.pa_occur),Number(x.wsd_min).toFixed(2),Number(x.toc_hours).toFixed(2)].map((v,j)=><td key={j} style={td}>{v}</td>)}<td style={td}><button style={button} onClick={()=>void viewEvidence(x)}>View Evidence</button></td></tr>)}</tbody></table></div>}
 </>})()}
 </>}
 {evidence&&<div role="dialog" aria-modal="true" aria-label={'FM incident evidence for site '+evidence.incident.site_id} style={{position:'fixed',inset:0,background:'rgba(0,32,28,.65)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setEvidence(null)}><div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:14,padding:22,width:'min(1050px,100%)',maxHeight:'90vh',overflowY:'auto'}}>
 <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><h3>Site {evidence.incident.site_id} · FM alarm evidence</h3><button style={button} onClick={()=>setEvidence(null)}>Close</button></div>
 {evidence.loading?<p>Loading recorded FM evidence…</p>:<>
 <p><strong>Assessment:</strong> WSD {Number(evidence.incident.wsd_min).toFixed(2)} min (below 120) · Recorded TOC {Number(evidence.incident.toc_hours).toFixed(2)} h (above 4)</p>
 <h4>1. TOC calculation · Previous and current power incidents</h4>
 {evidence.details?<><table style={{width:'100%',borderCollapse:'collapse'}}><tbody>{([
 ['Previous power alarm',evidence.previous?.pa_title||'Not available'],
 ['Previous power alarm occurred',showTime(evidence.previous?.pa_occur)],
 ['Previous power alarm cleared',showTime(evidence.previous?.pa_clear)],
 ['Current power alarm',evidence.details.pa_title||'Power alarm'],
 ['Current power alarm occurred',showTime(evidence.details.pa_occur)],
 ['Calculated TOC',evidence.previous?.pa_clear&&evidence.details.pa_occur?((new Date(evidence.details.pa_occur).getTime()-new Date(evidence.previous.pa_clear).getTime())/3600000).toFixed(2)+' h (current CP occurred − previous CP cleared)':'Not verifiable — previous clear timestamp unavailable'],
 ['Recorded TOC',evidence.details.toc_hours===null?'—':Number(evidence.details.toc_hours).toFixed(2)+' h'],
 ['TOC reconciliation',evidence.previous?.pa_clear&&evidence.details.pa_occur&&evidence.details.toc_hours!==null?(Math.abs((new Date(evidence.details.pa_occur).getTime()-new Date(evidence.previous.pa_clear).getTime())/3600000-Number(evidence.details.toc_hours))<=0.03?'MATCH · within rounding tolerance':'MISMATCH · recorded TOC differs from alarm interval'):'Not verifiable']
 ] as [string,string][]).map(([k,v])=><tr key={k}><th style={td}>{k}</th><td style={td}>{v}</td></tr>)}</tbody></table>
 <h4>2. WSD calculation · Current power failure to Site Down</h4>
 <table style={{width:'100%',borderCollapse:'collapse'}}><tbody>{([
 ['Power / CP alarm',evidence.details.pa_title||'Power alarm'],
 ['Power / CP occurred',showTime(evidence.details.pa_occur)],
 ['Power / CP cleared',showTime(evidence.details.pa_clear)],
 ['Site Down alarm',evidence.details.sd_title||'Site Down'],
 ['Site Down occurred',showTime(evidence.details.sd_occur)],
 ['Calculated WSD',evidence.details.pa_occur&&evidence.details.sd_occur?((new Date(evidence.details.sd_occur).getTime()-new Date(evidence.details.pa_occur).getTime())/60000).toFixed(2)+' min (SD occurred − CP occurred)':'Not verifiable'],
 ['Validated WSD',evidence.details.validated_backup_min===null?'—':Number(evidence.details.validated_backup_min).toFixed(2)+' min'],
 ['Validation status',evidence.details.validation_status],
 ['Incident key',evidence.details.incident_key]
 ] as [string,string][]).map(([k,v])=><tr key={k}><th style={td}>{k}</th><td style={td}>{v}</td></tr>)}</tbody></table>
 <p style={{fontSize:12,color:'#526b66'}}>TOC is independently calculated from the previous recorded CP clear and current CP occur timestamps when available. A mismatch is flagged rather than silently changing the recorded TOC. WSD uses original timestamp precision even though the display omits seconds.</p></>:<p>No matching validated incident row was returned.</p>}
 <h4>Original FM alarm records · bb_raw_alarms</h4>
 {evidence.raw.length?<div style={{overflowX:'auto',maxHeight:300}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Alarm type','Alarm title','Occurred','Cleared','Source file'].map(h=><th key={h} style={td}>{h}</th>)}</tr></thead><tbody>{evidence.raw.map(a=><tr key={a.id}>{[a.alarm_kind||'—',a.alarm_title||'—',showTime(a.occurred_at),showTime(a.cleared_at),a.source_file||'—'].map((v,i)=><td key={i} style={td}>{v}</td>)}</tr>)}</tbody></table></div>:<p>No original raw FM alarms are available within 1 hour before to 24 hours after this incident. The validated incident above is available, but original raw-alarm corroboration is unavailable for this time window.</p>}
 {evidence.error&&<p role="alert" style={{color:'#b91c1c'}}>{evidence.error}</p>}
 </>}
 </div></div>}
 {message&&<p role="status" style={{color:'#8b4d10'}}>{message}</p>}
 </section>;
}
