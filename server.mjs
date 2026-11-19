import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readSheets,publicSnapshot} from './sync.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.DATA_DIR||path.join(root,'data');
const cache=path.join(dataDir,'snapshot.json');
const interval=12*60*60*1000;
let snapshot,lastError=null,inflight;
try{snapshot=JSON.parse(await readFile(cache,'utf8'));}catch{
 const seed=await readFile(path.join(root,'web/rd-data.js'),'utf8');snapshot=JSON.parse(seed.trim().slice(15,-1));
}
async function sync(){
 if(inflight)return inflight;
 inflight=(async()=>{
  try{
   const dataset=publicSnapshot(await readSheets());const now=new Date();
   const next={...dataset,syncedAt:now.toISOString(),date:new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(now)};
   await mkdir(dataDir,{recursive:true});await writeFile(cache+'.tmp',JSON.stringify(next));await rename(cache+'.tmp',cache);
   snapshot=next;lastError=null;console.log('Sheet sync successful:',next.rows.length,'projects');
  }catch{lastError='Google Sheets sync failed. Check service account, API and sharing.';console.error(lastError);}
 })().finally(()=>inflight=null);return inflight;
}
// Check once a minute; retry failures every five minutes. Successful reads are 12 hours apart.
let lastAttempt=0;
function tick(){if(Date.now()-Date.parse(snapshot.syncedAt||0)>=interval&&Date.now()-lastAttempt>=300000){lastAttempt=Date.now();void sync();}}
const files={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let body,type='application/json; charset=utf-8';
 if(pathname==='/healthz')body=JSON.stringify({status:'ok',sync:{syncedAt:snapshot.syncedAt||null,lastError,intervalHours:12,configured:Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||process.env.GOOGLE_APPLICATION_CREDENTIALS)}});
 else if(pathname==='/api/rd-snapshot')body=JSON.stringify(publicSnapshot(snapshot));
 else if(pathname==='/rd-data.js'){type='text/javascript; charset=utf-8';body='const rdSeed = '+JSON.stringify(publicSnapshot(snapshot))+';';}
 else if(files[pathname]){const [file,mime]=files[pathname];type=mime+'; charset=utf-8';body=await readFile(path.join(root,'web',file));}
 else{res.writeHead(404);res.end('Not found');return;}
 res.setHeader('Content-Type',type);res.end(req.method==='HEAD'?undefined:body);
});
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>{console.log('QC Workbench listening');tick();});
const timer=setInterval(tick,60000);
process.on('SIGTERM',()=>{clearInterval(timer);server.close();});
