/** Shared Supabase session renewal for fuel dashboards. Never persist service-role credentials. */
let pendingRefresh: Promise<string> | null = null;
export async function fuelAccessToken(base:string,key:string,force=false):Promise<string>{
 const raw=sessionStorage.getItem("cell_avb_supabase_session");
 const session=raw?JSON.parse(raw):null;
 if(!session?.access_token)throw new Error("Supabase session unavailable. Please sign in again.");
 const expires=Number(session.expires_at||0)*1000;
 if(!force && expires>Date.now()+60000)return String(session.access_token);
 if(pendingRefresh)return pendingRefresh;
 if(!session.refresh_token)throw new Error("Supabase session expired. Please sign in again.");
 pendingRefresh=(async()=>{
  const latestRaw=sessionStorage.getItem("cell_avb_supabase_session");
  const latest=latestRaw?JSON.parse(latestRaw):null;
  if(latest?.access_token!==session.access_token && Number(latest?.expires_at||0)*1000>Date.now()+60000)return String(latest.access_token);
  const res=await fetch(base+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:key,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});
  if(!res.ok)throw new Error("Supabase session expired. Please sign in again.");
  const next=await res.json();
  next.expires_at=Math.floor(Date.now()/1000)+Number(next.expires_in||3600);
  sessionStorage.setItem("cell_avb_supabase_session",JSON.stringify(next));
  return String(next.access_token);
 })().finally(()=>{pendingRefresh=null});
 return pendingRefresh;
}
export async function fuelAuthenticatedFetch(base:string,key:string,url:string):Promise<Response>{
 let token=await fuelAccessToken(base,key);
 const send=(t:string)=>fetch(url,{headers:{apikey:key,Authorization:"Bearer "+t}});
 let res=await send(token);
 if(res.status===401){token=await fuelAccessToken(base,key,true);res=await send(token)}
 return res;
}
