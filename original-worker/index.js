const publicColumns=new Set([0,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28]);
function publicSnapshot(snapshot){
 return {...snapshot,rows:snapshot.rows.map(row=>row.map((value,i)=>publicColumns.has(i)?value:''))};
}
const key='rd-sheet-snapshot.json';
const datasetLimit=4000000;
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
function cleanDataset(input){
 if(!Array.isArray(input?.headers)||input.headers.length!==32||!Array.isArray(input.rows)||!input.rows.length||input.rows.length>1000)return null;
 if(input.headers.some(value=>typeof value!=='string'||value.length>200))return null;
 if(input.headers[0]!=='Dự án'||input.headers[2]!=='Môi trường'||input.headers[8]!=='Account truy cập')return null;
 if(input.rows.some(row=>!Array.isArray(row)||row.length!==32||row.some(value=>typeof value!=='string'||value.length>20000)))return null;
 const rows=input.rows.map(row=>row.map((value,i)=>i===8?'':value));
 if(!rows.some(row=>row[0].trim()))return null;
 return {headers:input.headers,rows};
}
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/rd-snapshot'){
   const credential=request.headers.get('X-RD-Sync-Token');
   const canSync=Boolean(env.RD_SYNC_TOKEN&&credential&&credential===env.RD_SYNC_TOKEN);
   if(request.method==='GET'){
    const stored=await env.BUCKET.get(key);
    if(!stored)return json({status:'not_initialized'},404);
    const snapshot=await stored.json();
    return json(canSync?snapshot:publicSnapshot(snapshot));
   }
   if(request.method!=='POST')return json({error:'method_not_allowed'},405);
   if(!canSync)return json({error:'forbidden'},403);
   if(request.headers.has('Origin')||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'browser_write_disallowed'},403);
   if(request.headers.get('Content-Type')!=='application/json')return json({error:'unsupported_content_type'},415);
   const body=await request.text();
   if(body.length>datasetLimit)return json({error:'too_large'},413);
   let dataset;
   try{dataset=cleanDataset(JSON.parse(body));}catch{return json({error:'invalid_json'},400);}
   if(!dataset)return json({error:'invalid_snapshot'},422);
   const stored=await env.BUCKET.get(key);
   if(stored){
    const previous=await stored.json();
    if(JSON.stringify([dataset.headers,dataset.rows])===JSON.stringify([previous.headers,previous.rows]))return json({status:'unchanged',syncedAt:previous.syncedAt,rows:previous.rows.length});
   }
   const syncedAt=new Date().toISOString();
   const date=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(syncedAt));
   await env.BUCKET.put(key,JSON.stringify({...dataset,syncedAt,date}));
   return json({status:'updated',syncedAt,rows:dataset.rows.length});
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405});
  if(path==='/rd-data.js')return new Response('const rdSeed = '+JSON.stringify(publicSnapshot(JSON.parse(assets[path].body.trim().slice(15,-1))))+';', {headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}});
  const asset=assets[path];
  return asset?new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type+'; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}):new Response('Không tìm thấy trang',{status:404});
 }
};
