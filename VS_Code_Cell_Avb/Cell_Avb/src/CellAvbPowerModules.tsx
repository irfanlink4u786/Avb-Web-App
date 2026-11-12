import {useEffect,useState} from 'react';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import CellAvbBatteryAssessment from './CellAvbBatteryAssessment';
import CellAvbRmsAnalysis from './CellAvbRmsAnalysis';
import BatteryRmsUpdates from './CellAvbBatteryRmsUpdates';

export default function CellAvbPowerModules({mode}:{mode:'battery'|'rms'|'wsd-recent'}) {
  const [client,setClient]=useState<SupabaseClient|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try {
        const env=import.meta.env;
        const url=String(env.VITE_SUPABASE_URL||'');
        const key=String(env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY||'');
        const raw=sessionStorage.getItem('cell_avb_supabase_session');
        const session=raw?JSON.parse(raw):null;
        if(!url||!key||!session?.access_token||!session?.refresh_token) throw new Error('Sign in again to access Battery Backup and RMS.');
        const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:true}});
        const {error:authError}=await db.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
        if(authError)throw authError;
        if(alive)setClient(db);
      } catch(e){if(alive)setError(e instanceof Error?e.message:String(e))}
    })();
    return()=>{alive=false};
  },[]);
  if(error)return <div className="rounded-xl bg-red-50 p-6 text-red-800">{error}</div>;
  if(!client)return <div className="rounded-xl bg-white p-6 text-slate-600">Loading secure C-1 / C-6 module…</div>;
  return mode==='battery'?<CellAvbBatteryAssessment client={client}/>:mode==='wsd-recent'?<BatteryRmsUpdates client={client} mode="recent"/>:<CellAvbRmsAnalysis client={client}/>;
}
