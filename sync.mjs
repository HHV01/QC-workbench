import {GoogleAuth} from 'google-auth-library';
export const ranges=["'Tong_hop_du_an'!B6:I1001","'Tong_hop_du_an'!K6:AG1001","'Ma_tran_Automation'!A3:U1002"];
const norm=v=>String(v??'').trim().toLocaleLowerCase().replace(/\s+/g,' ');
const pad=(r,n)=>Array.from({length:n},(_,i)=>String(r?.[i]??''));
export const publicColumns=new Set([0,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28]);
export function publicSnapshot(s){return {...s,rows:s.rows.map(r=>r.map((v,i)=>publicColumns.has(i)?v:''))};}
export function transform(projects,metrics,matrix){
 if(projects?.[0]?.[0]!=='Dự án'||metrics?.[0]?.length!==23||matrix?.[0]?.[9]!=='Tổng case (N)'||matrix?.[0]?.[10]!=='Case đã auto (A)')throw Error('Unexpected sheet headers');
 const index=new Map();
 for(const r of matrix.slice(2)){
  if(!/^\d+$/.test(String(r[0]).trim()))continue;
  for(const name of new Set([norm(r[2]),norm(r[4])]))if(name)index.set(name,[...(index.get(name)||[]),pad(r,21)]);
 }
 if(!index.size)throw Error('Empty automation matrix');
 const rows=[];
 for(let i=1;i<projects.length;i++){
  if(!norm(projects[i]?.[0]))continue;
  const p=pad(projects[i],8),m=pad(metrics[i],23),name=norm(p[0]);
  for(let j=3;j<8;j++)p[j]=p[j].replace(/(https?:\/\/)[^/\s@]+@/gi,'$1');
  let entries=index.get(name)||[];const product=entries.filter(r=>norm(r[2])===name);if(product.length)entries=product;
  if(entries.length>1)throw Error('Ambiguous matrix match');
  const e=entries[0]||pad([],21);
  for(const [a,b] of [[4,9],[5,10],[8,12],[9,13],[10,15],[11,16],[12,17],[13,18],[14,19]])m[a]=e[b];
  rows.push([...p,'',...m]);
 }
 if(!rows.length)throw Error('Empty project dataset');
 const h=pad(metrics[0],23);h[2]='Mức ưu tiên';
 return {headers:[...pad(projects[0],8),'Account truy cập',...h],rows};
}
export async function readSheets(){
 const credentials=process.env.GOOGLE_SERVICE_ACCOUNT_JSON?JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON):undefined;
 const auth=new GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']});
 const client=await auth.getClient();
 const id=process.env.GOOGLE_SHEET_ID||'1f1vOMxt6fHW-auk2xxiq5ruejH6PXK_gWs1jexW7wyc';
 const url=new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values:batchGet`);
 ranges.forEach(r=>url.searchParams.append('ranges',r));url.searchParams.set('valueRenderOption','FORMATTED_VALUE');
 const {data}=await client.request({url:url.href,timeout:30000});
 return transform(...data.valueRanges.map(r=>r.values||[]));
}
