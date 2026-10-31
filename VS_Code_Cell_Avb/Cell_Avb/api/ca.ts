import type { VercelRequest, VercelResponse } from "@vercel/node";

// Never place a Supabase service-role key into VITE_* or frontend files.
const PROJECT_URL = "https://yogjbkwurzjcuokcnhif.supabase.co";
const TABLE = "ca_tracker_oct2026";
const SELECT_FIELDS = ["SITE_ID", "Sub-Region", "Grid", "OCT'26 Cell A", "BB Type", ...Array.from({length:31},(_,i)=>`${i+1}-Oct`)];

function isC1C6(r: Record<string, unknown>): boolean {
  const sub=String(r["Sub-Region"]??"").replace(/[\s-]/g,"").toUpperCase();
  const grid=String(r.Grid??"").toUpperCase();
  return sub==="CENTRAL1"||sub==="CENTRAL6"||sub==="C1"||sub==="C6"||/^C[16]\d/.test(grid);
}
function numeric(v: unknown): number | null {
  if(v===null||v===undefined||String(v).trim()==="")return null;
  const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=100?n:null;
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if(req.method!=="GET") return res.status(405).json({error:"Method not allowed"});
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret) return res.status(503).json({error:"Supabase server credential not configured"});
  try {
    const rows:Record<string,unknown>[]=[];
    const select=SELECT_FIELDS.map(x=>`"${x.replace(/"/g,'""')}"`).join(",");
    const url=new URL(`${PROJECT_URL}/rest/v1/${TABLE}`);
    url.searchParams.set("select",select);
    url.searchParams.set("order",'"SITE_ID".asc');
    url.searchParams.set('"Sub-Region"','in.("Central-1","Central-6")');
    for(let offset=0;offset<10000;offset+=1000){
      url.searchParams.set("limit","1000");
      url.searchParams.set("offset",String(offset));
      const controller=new AbortController();
      const time=setTimeout(()=>controller.abort(),12000);
      let page:Record<string,unknown>[];
      try{
        const r=await fetch(url.toString(),{headers:{apikey:secret,Authorization:`Bearer ${secret}`},signal:controller.signal,cache:"no-store"});
        if(!r.ok){ console.error("Supabase CA upstream",r.status,await r.text());return res.status(502).json({error:"CA database fetch failed"}); }
        page=await r.json() as Record<string,unknown>[];
      }finally{clearTimeout(time);}
      rows.push(...page.filter(r=>isC1C6(r)&&!/dismantled|locked/i.test(String(r["BB Type"]??""))).map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>k==="SITE_ID"||k==="OCT'26 Cell A"||/^\d{1,2}-Oct$/.test(k)))));
      if(page.length<1000)break;
    }
    if(!rows.length)return res.status(502).json({error:"No CA records found for C1/C6"});
    const check4004=rows.find(r=>String(r['SITE_ID']).trim()==='4004');
    if(!check4004)console.error('CA API: expected Site 4004 missing; verify filter/project/table');
    console.info('CA API verified site 4004:',{day30:check4004?.['30-Oct'],mtd:check4004?.["OCT'26 Cell A"],rows:rows.length});
    let last=0;
    for(const r of rows)for(let d=31;d>last;d--)if(numeric(r[`${d}-Oct`])!==null){last=d;break;}
    return res.status(200).json({rows,latestDate:last?`${String(last).padStart(2,"0")}-Oct-26`:""});
  }catch(e){ console.error("CA API failed",e);return res.status(502).json({error:"CA API request failed"}); }
}
