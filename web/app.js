'use strict';
const $ = id => document.getElementById(id);
const pages = [
 ['rd','▤','Quản lý dự án'],
 ['rd-report','▥','Báo cáo Automation'],
 ['reports','◫','Báo cáo tuần']
];
let page='rd',exportData=null;
function read(key,fallback){try{return JSON.parse(localStorage.getItem('qc.'+key))??fallback;}catch{return fallback;}}
function save(key,value){localStorage.setItem('qc.'+key,JSON.stringify(value));}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusTone=s=>['Đạt','Đã test','Đã duyệt demo','Online'].includes(s)?'ok':['Không đạt','Failed','Blocker','Từ chối','Offline'].includes(s)?'bad':['Chờ duyệt','Đang chạy','Chưa test','Chờ retest'].includes(s)?'warn':'blue';
const pill=s=>'<span class="pill '+statusTone(s)+'">'+esc(s)+'</span>';
const btn=(label,action,primary=false)=>'<button type="button" data-action="'+esc(action)+'"'+(primary?' class="primary"':'')+'>'+esc(label)+'</button>';
const link=(label,action)=>'<button type="button" class="text" data-action="'+esc(action)+'">'+esc(label)+'</button>';
function table(headers,rows){
 return rows.length?'<div class="scroll"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p class="empty">Không tìm thấy dự án phù hợp.</p>';
}
const panel=(title,content,tools='')=>'<section class="panel"><div class="panelhead"><h2>'+esc(title)+'</h2>'+tools+'</div>'+content+'</section>';
const options=(values,selected='')=>values.map(value=>{const [id,label]=Array.isArray(value)?value:[value,value];return '<option value="'+esc(id)+'"'+(id===selected?' selected':'')+'>'+esc(label)+'</option>';}).join('');
function setExport(headers,rows){exportData={headers,rows};}
const exports=()=>btn('↓ Xuất Markdown','export:md')+btn('↓ Xuất Excel','export:excel');
const views={rd:rdProjects,'rd-report':rdReport,reports};
const subtitles={
 rd:'Theo dõi dự án, QC phụ trách, môi trường và tài liệu kiểm thử.',
 'rd-report':'Theo dõi coverage và mức đạt mục tiêu từng dự án.',
 reports:'Báo cáo kết quả từng tuần, thay đổi so với tuần trước và việc tiếp theo.'
};
function render(){
 const section=pages.find(r=>r[0]===page);
 $('nav').innerHTML=pages.map(([id,icon,title])=>'<button data-action="go:'+id+'" class="'+(id===page?'active':'')+'" '+(id===page?'aria-current="page"':'')+'><span>'+icon+'</span>'+title+'</button>').join('');
 $('crumb').textContent=section[2];
 const context='Nguồn: '+(rdData.syncedAt?'Ma trận Automation và Tổng hợp dự án':'Tổng hợp dự án')+' · '+rdData.date+' · '+(rdData.local?'Bản nhập trên trình duyệt':rdData.syncedAt?'Đã đồng bộ từ Google Sheets':'Bản chụp từ Google Sheets');
 const body=views[page]();
 $('app').innerHTML='<div class="title"><div><h1>'+section[2]+'</h1><p>'+subtitles[page]+'</p></div><div class="actions">'+exports()+'</div></div><div class="notice">'+esc(context)+'</div>'+body;
}
let toastTimer;
function notice(message){
 $('toast').textContent=message;$('toast').style.display='block';
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',4000);
}
const stamp=()=>new Date().toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
function modal(title,content){
 const dialog=$('dialog');
 dialog.innerHTML='<h2>'+esc(title)+'</h2><div class="dialogbody">'+content+'<div class="actions">'+btn('Đóng','close')+'</div></div>';
 if(!dialog.open)dialog.showModal();
}
function download(filename,mime,content){
 const url=URL.createObjectURL(new Blob([content],{type:mime}));
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportPage(format){
 if(!exportData?.rows.length){notice('Không có dòng nào để xuất.');return;}
 const {headers,rows}=exportData;
 const provenance=(rdData.syncedAt?'Ma trận Automation và Tổng hợp dự án':'Tổng hợp dự án')+' · '+rdData.date;
 if(format==='md'){
 if(exportData.markdown){download('bao-cao-tuan.md','text/markdown;charset=utf-8',exportData.markdown);return;}
 const mdrow=row=>'| '+row.map(x=>String(x??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ')).join(' | ')+' |';
 download('qc-'+page+'.md','text/markdown;charset=utf-8','# '+pages.find(r=>r[0]===page)[2]+'\n\nNguồn: '+provenance+'\n\n'+[mdrow(headers),mdrow(headers.map(()=> '---')),...rows.map(mdrow)].join('\n'));
 }else{
 const xmlrow=row=>'<Row>'+row.map(x=>'<Cell><Data ss:Type="'+(typeof x==='number'?'Number':'String')+'">'+esc(x)+'</Data></Cell>').join('')+'</Row>';
 download('qc-'+page+'.xml','application/vnd.ms-excel','<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="QC Workbench"><Table>'+xmlrow(headers)+rows.map(xmlrow).join('')+'</Table></Worksheet></Workbook>');
 }
}
document.addEventListener('click',event=>{
 const control=event.target.closest('[data-action]');
 if(!control)return;
 const [action,arg]=control.dataset.action.split(':');
 switch(action){
 case 'go':page=arg;render();break;
 case 'rd-detail':rdDetail(Number(arg));break;
 case 'rd-import':rdImport();break;
 case 'rd-reset':localStorage.removeItem('qc.rd-data');rdData=rdShared;rdOwner='';rdQuery='';$('dialog').close();render();break;
 case 'close':$('dialog').close();break;
 case 'export':exportPage(arg);break;
 }
});
document.addEventListener('change',event=>{
 if(event.target.id==='rd-owner'){rdOwner=event.target.value;render();}
 if(event.target.id==='rd-week'){rdWeek=event.target.value;render();}
});
document.addEventListener('input',event=>{
 if(event.target.id!=='rd-search')return;
 rdQuery=event.target.value;
 const pos=event.target.selectionStart;
 render();$('rd-search').focus();$('rd-search').setSelectionRange(pos,pos);
});
const rdSource='https://docs.google.com/spreadsheets/d/1f1vOMxt6fHW-auk2xxiq5ruejH6PXK_gWs1jexW7wyc/edit?gid=218355462#gid=218355462';
const rdKeys=['name','owner','environment','system','testcase','psd','docs','api',null,'role','access','priority','target','total','auto','manualOnly','inProgress','coverage','manualPercent','gap','week1','week2','week3','week4','autoBug','manualBug','autoBlocked','manualBlocked','flaky','evidence','next','assessment'];
const rdKnown = value => !!value && !/^[-–—]+$/.test(value);
const rdDisplay=value=>rdKnown(value)?value:'Chưa cập nhật';
const rdNumber=value=>/^\d{1,3}(?:\.\d{3})+$/.test(value)?Number(value.replaceAll('.','')):/^\d+$/.test(value)?Number(value):null;
const rdFormat=value=>value.toLocaleString('vi-VN');
let rdShared=rdSeed;
let rdData=rdSeed,rdQuery='',rdOwner='',rdWeek='';
function rdNormalize(dataset){
 const normalized=label=>String(label??'').trim().toLocaleLowerCase('vi');
 const cols=rdSeed.headers.map(label=>dataset.headers.findIndex(h=>normalized(h)===normalized(label)));
 const groups=new Map();
 dataset.rows.forEach(row=>{
 const item=Object.fromEntries(rdKeys.flatMap((key,i)=>key?[[key,String(row[cols[i]]??'').trim()]]:[]));
 if(!item.name)return;
 const key=normalized(item.name);
 if(!groups.has(key))groups.set(key,[]);
 groups.get(key).push(item);
 });
 return Array.from(groups.values(),(items,index)=>{
 const tracked=items.filter(x=>rdKnown(x.total)||rdKnown(x.auto));
 const baseline=tracked.find(x=>rdKnown(x.total)&&rdKnown(x.auto))??tracked[0]??items[0];
 const conflict=tracked.some(x=>['total','auto'].some(k=>rdKnown(x[k])&&rdKnown(baseline[k])&&rdNumber(x[k])!==rdNumber(baseline[k])));
 const owners=[...new Set(items.flatMap(x=>x.owner.split(/[,\n]/).map(o=>o.trim()).filter(rdKnown)))];
 return {index,items,baseline,owners,conflict};
 });
}
function rdFiltered(){
 const updated=p=>p.items.some(row=>rdNumber(row.auto)!==null||['coverage','week1','week2','week3','week4'].some(key=>rdKnown(row[key])));
 return rdNormalize(rdData)
  .filter(p=>(!rdOwner||p.owners.includes(rdOwner))&&p.baseline.name.toLocaleLowerCase('vi').includes(rdQuery.trim().toLocaleLowerCase('vi')))
  .sort((a,b)=>Number(updated(b))-Number(updated(a))||a.index-b.index);
}
function rdFilters(report){
 const owners=[...new Set(rdNormalize(rdData).flatMap(p=>p.owners))].sort((a,b)=>a.localeCompare(b,'vi'));
 return '<div class="filters"><input id="rd-search" aria-label="Tìm dự án" placeholder="Tìm tên dự án" value="'+esc(rdQuery)+'"><select id="rd-owner" aria-label="QC phụ trách">'+options([['','Tất cả QC'],...owners],rdOwner)+'</select>'+(report?'<select id="rd-week" aria-label="Tuần báo cáo">'+options([['','Tất cả tuần'],...[1,2,3,4].map(n=>['week'+n,'Tuần '+n])],rdWeek)+'</select>':'')+'</div>';
}
const rdMetrics=(rows)=>'<div class="metrics">'+rows.map(([label,value,note])=>'<div class="card"><label>'+esc(label)+'</label><strong>'+esc(value)+'</strong><small>'+esc(note)+'</small></div>').join('')+'</div>';
const rdGoal={min:80,max:90};
const rdGoalLabel=rdGoal.min+'–'+rdGoal.max+'%';
function rdCoverageMismatch(project){
 const {total,auto,coverage}=project.baseline;
 const n=rdNumber(total),count=rdNumber(auto);
 const ratio=/^\d+(?:[,.]\d+)?%$/.test(coverage)?Number(coverage.slice(0,-1).replace(',','.')):null;
 return n>0&&count!==null&&ratio!==null&&Math.abs(count*100/n-ratio)>0.06;
}
function rdAssessment(project){
 if(rdCoverageMismatch(project))return 'Cần đối soát coverage';
 const coverage=project.baseline.coverage;
 const ratio=/^\d+(?:[,.]\d+)?%$/.test(coverage)?Number(coverage.slice(0,-1).replace(',','.')):null;
 if(ratio===null)return 'Chưa cập nhật';
 if(ratio>100)return 'Cần đối soát coverage';
 if(ratio<rdGoal.min)return 'Chưa đạt mục tiêu';
 if(ratio>rdGoal.max)return 'Vượt mục tiêu';
 return 'Đạt mục tiêu';
}
function rdVal(p,key){
 if(key==='automationGoal')return rdGoalLabel;
 if(p.conflict)return 'Cần đối soát';
 if(key==='assessment')return rdAssessment(p);
 if(key==='gap'){
  if(rdCoverageMismatch(p))return 'Cần đối soát';
  const total=rdNumber(p.baseline.total),auto=rdNumber(p.baseline.auto);
  return total>0&&auto!==null&&auto<=total?Math.max(0,Math.ceil(total*rdGoal.min/100)-auto):'Chưa cập nhật';
 }
 return rdDisplay(p.baseline[key]);
}
function rdAutomation(project){
 if(project.conflict)return pill('Cần đối soát');
 const {total,auto,coverage}=project.baseline;
 const ratio=/^\d+(?:[,.]\d+)?%$/.test(coverage)?Number(coverage.slice(0,-1).replace(',','.')):null;
 const progress=ratio!==null&&ratio<=100?'<span class="bar" aria-hidden="true"><i style="width:'+ratio+'%"></i></span>'+esc(coverage):pill('Chưa cập nhật');
 const count=rdKnown(auto)&&rdKnown(total)?'<small>'+esc(auto+' / '+total)+' testcase</small>':rdKnown(auto)?'<small>'+esc(auto)+' testcase đã automation</small>':rdKnown(total)?'<small>Baseline: '+esc(total)+' testcase</small>':'';
 return ratio===null&&!count?pill('Chưa cập nhật'):progress+count;
}
function rdProjects(){
 const projects=rdFiltered();
 const headers=['Dự án','QC phụ trách','Môi trường','Mức ưu tiên','Baseline','Đã automation','Coverage','Đánh giá','Mục tiêu automation'];
 const raw=projects.map(p=>[p.baseline.name,rdDisplay(p.owners.join(', ')),rdDisplay([...new Set(p.items.map(x=>x.environment).filter(rdKnown))].join(', ')),rdDisplay(p.baseline.priority),...['total','auto','coverage','assessment','automationGoal'].map(k=>rdVal(p,k))]);
 setExport(headers,raw);
 const columns=['Dự án','QC phụ trách','Môi trường','Automation','Mức ưu tiên','Đánh giá'];
 return rdFilters(false)+panel('Danh sách dự án',table(columns,raw.map((r,i)=>{
  const project=projects[i];
  const tone=/^(Đạt|Vượt)/.test(r[7])?'ok':r[7].startsWith('Chưa đạt')?'bad':r[7]==='Chưa cập nhật'?'blue':'warn';
  return [link(r[0],'rd-detail:'+project.index),esc(r[1]),esc(r[2]),rdAutomation(project),esc(r[3]),'<span class="pill '+tone+'">'+esc(r[7])+'</span><small>'+ ('Mục tiêu: '+esc(r[8]))+'</small>'];
 })),pill(projects.length+' dự án'));
}
function rdProgressMetrics(projects){
 const measured=projects.filter(p=>!p.conflict&&!rdCoverageMismatch(p)&&rdNumber(p.baseline.total)>0&&rdNumber(p.baseline.auto)!==null&&rdNumber(p.baseline.auto)<=rdNumber(p.baseline.total));
 const sum=key=>measured.reduce((total,p)=>total+rdNumber(p.baseline[key]),0);
 const total=sum('total'),auto=sum('auto');
 return rdMetrics([['Dự án có đủ số liệu',measured.length+' / '+projects.length,'Baseline dương và số auto hợp lệ'],['Testcase baseline',total?rdFormat(total):'—','Chỉ tính dự án có baseline và coverage khớp'],['Case đã automation',total?rdFormat(auto):'—','Case đủ điều kiện theo sheet'],['Coverage tổng hợp',total?(100*auto/total).toLocaleString('vi-VN',{maximumFractionDigits:2})+'%':'—','Tổng case auto chia tổng baseline']]);
}
function rdReport(){
 const projects=rdFiltered();
 const fields=['autoBug','manualBug','autoBlocked','manualBlocked','flaky','assessment','next'];
 const headers=['Dự án','QC phụ trách','Baseline','Đã automation','Coverage hiện tại','Mục tiêu tuần 4 (theo Sheet)','Mục tiêu automation','Case còn thiếu tới 80%','Bug Auto','Bug Manual','Bug chặn Auto','Bug chặn Manual','Tỷ lệ không ổn định','Đánh giá','Việc tiếp theo'];
 const raw=projects.map(p=>[p.baseline.name,rdDisplay(p.owners.join(', ')),...['total','auto','coverage','target','automationGoal','gap',...fields].map(k=>rdVal(p,k))]);
 setExport(headers,raw);
 const entries=projects.map(project=>({project,status:rdVal(project,'assessment')}));
 const followUp=entries.filter(entry=>entry.status==='Chưa đạt mục tiêu');
 const reached=entries.filter(entry=>/^(Đạt|Vượt)/.test(entry.status));
 const pending=entries.filter(entry=>!followUp.includes(entry)&&!reached.includes(entry));
 const columns=['Dự án','QC phụ trách','Automation','Còn thiếu tới 80%','Đánh giá','Việc tiếp theo'];
 const section=(title,items)=>items.length?panel(title,table(columns,items.map(({project,status})=>[
  link(project.baseline.name,'rd-detail:'+project.index),
  esc(rdDisplay(project.owners.join(', '))),rdAutomation(project),
  esc(rdVal(project,'gap')),
  '<span class="pill '+(/^(Đạt|Vượt)/.test(status)?'ok':status==='Chưa đạt mục tiêu'?'bad':'warn')+'">'+esc(status)+'</span>',
  esc(rdVal(project,'next'))
 ])),pill(items.length+' dự án')):'';
 return rdFilters(false)+rdProgressMetrics(projects)+
  '<div class="notice">Mục tiêu '+rdGoalLabel+' · '+followUp.length+' dưới mục tiêu · '+reached.length+' đạt hoặc vượt · '+pending.length+' cần cập nhật hoặc đối soát</div>'+
  section('Dưới mục tiêu',followUp)+section('Đạt hoặc vượt mục tiêu',reached)+
  section('Cần cập nhật hoặc đối soát',pending)+
  (entries.length?'':panel('Tiến độ Automation theo dự án',table(columns,[])));

}
function rdLinks(value){
 const links=String(value??'').match(/https?:\/\/[^\s<>"']+/gi)??[];
 return links.flatMap((raw,i)=>{
 try{
 const url=new URL(raw);
 if(url.username||url.password)return [];
 return ['<a href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer">'+esc(url.hostname)+(links.length>1?' · '+(i+1):'')+' ↗</a>'];
 }catch{return [];}
 }).join('<br>')||'Chưa có link';
}
function rdDetail(index){
 const p=rdNormalize(rdData)[index];if(!p)return;
 const rows=[['Baseline',rdVal(p,'total')],['Đã automation đủ điều kiện',rdVal(p,'auto')],['Manual Only',rdVal(p,'manualOnly')],['Đang chuyển đổi / chưa làm',rdVal(p,'inProgress')],['Tỷ lệ còn manual',rdVal(p,'manualPercent')],['Mục tiêu tuần 4 (theo Sheet)',rdVal(p,'target')],['Mục tiêu automation',rdVal(p,'automationGoal')],['Case còn thiếu tới 80%',rdVal(p,'gap')],['Việc tiếp theo',rdVal(p,'next')]];
 modal(p.baseline.name,'<p>QC phụ trách · '+esc(rdDisplay(p.owners.join(', ')))+'</p>'+table(['Chỉ số','Giá trị'],rows.map(r=>r.map(esc)))+
 '<h3 class="rd-section">Môi trường và tài liệu</h3>'+p.items.map(x=>'<div class="rd-env"><b>'+esc(rdDisplay(x.environment))+'</b><p>Vai trò: '+esc(rdDisplay(x.role))+' · Điều kiện truy cập: '+esc(rdDisplay(x.access))+'</p>'+table(['Tài liệu','Liên kết'],[['Hệ thống','system'],['Testcase','testcase'],['PSD','psd'],['Tài liệu liên quan','docs'],['Swagger / API','api'],['Report / evidence','evidence']].map(([label,key])=>[label,rdLinks(x[key])]))+'</div>').join(''));
}
function rdCsv(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
 const c=text[i];
 if(c==='"'){
 if(quoted&&text[i+1]==='"'){field+='"';i++;}
 else if(quoted||!field)quoted=!quoted;
 else field+=c;
 }else if(!quoted&&c===','){row.push(field);field='';}
 else if(!quoted&&(c==='\r'||c==='\n')){
 if(c==='\r'&&text[i+1]==='\n')i++;
 row.push(field);rows.push(row);row=[];field='';
 }else field+=c;
 }
 if(quoted)throw new Error('CSV có ô chưa đóng dấu ngoặc kép.');
 if(field||row.length){row.push(field);rows.push(row);}
 return rows;
}
function rdImport(){
 modal('Nhập danh sách dự án từ Google Sheets','<p>Mở tab Tong_hop_du_an, tải xuống dưới dạng CSV rồi chọn tệp. Bản nhập thay dữ liệu hiển thị trên trình duyệt này.</p><label>Tệp CSV<input id="rd-file" type="file" accept=".csv,text/csv"></label><p id="rd-import-msg" role="status"></p><div class="actions">'+btn('Dùng lại bản từ Google Sheets','rd-reset')+'</div>');
 $('rd-file').onchange=async event=>{
 const file=event.currentTarget.files[0]; if(!file)return;
 try{
 if(file.size>4e6)throw new Error('Tệp vượt giới hạn 4 MB.');
 const rows=rdCsv((await file.text()).replace(/^\uFEFF/,''));
 const idx=rows.findIndex(r=>['Dự án','Tổng case baseline (N)','Case đã auto đủ điều kiện (A)'].every(label=>r.some(c=>c.trim().toLowerCase()===label.toLowerCase())));
 if(idx<0)throw new Error('Thiếu tiêu đề của tab Tong_hop_du_an.');
 const positions=rdSeed.headers.map((h,i)=>rdKeys[i]?rows[idx].findIndex(x=>x.trim().toLowerCase()===h.trim().toLowerCase()):-1);
 const dataset={headers:rdSeed.headers,date:stamp(),local:true,rows:rows.slice(idx+1).map(r=>positions.map(j=>r[j]??''))};
 if(!rdNormalize(dataset).length)throw new Error('Tệp chưa có dòng dự án.');
 save('rd-data',dataset);rdData=dataset;rdOwner='';rdQuery='';$('dialog').close();render();notice('Đã nhập dữ liệu dự án.');
 }catch(error){const msg=$('rd-import-msg');if(msg)msg.textContent=error.message;}
 };
}
// Historical baseline supplied in the confirmed week 1 report; never infer old case counts.
const weeklyBaseline1={
 becawork:{coverage:95.7,auto:265,total:277},
 becafsm:{coverage:15.2,auto:137},
 becavms:{coverage:40},becaros:{coverage:97.5},
 ptsc:{coverage:92.6},smartpole:{coverage:44}
};
function weeklyBaseline(project){
 const name=project.baseline.name.toLocaleLowerCase('vi').replace(/[^a-z0-9]/g,'');
 const key=name.startsWith('ptsc')?'ptsc':name.startsWith('smartpole')?'smartpole':name;
 return weeklyBaseline1[key];
}
function weeklyProvisional(project,key){
 return key==='week2'&&!/^\d+(?:[,.]\d+)?%$/.test(project.baseline.week2)&&!project.conflict&&!rdCoverageMismatch(project)&&/^\d+(?:[,.]\d+)?%$/.test(project.baseline.coverage);
}
function weeklyCoverage(project,key){
 if(key==='week1'&&weeklyBaseline(project))return weeklyBaseline(project).coverage;
 if(project.conflict)return null;
 const value=weeklyProvisional(project,key)?project.baseline.coverage:project.baseline[key];
 if(!/^\d+(?:[,.]\d+)?%$/.test(value))return null;
 const ratio=Number(value.slice(0,-1).replace(',','.'));
 return ratio<=100?ratio:null;
}
function weeklyStatus(ratio){
 if(ratio===null)return 'Chưa cập nhật';
 if(ratio<rdGoal.min)return 'Chưa đạt';
 if(ratio>rdGoal.max)return 'Vượt mục tiêu';
 return 'Đạt mục tiêu';
}
function weeklyDelta(current,previous){
 if(current===null||previous===null)return 'Chưa đủ dữ liệu';
 const delta=Math.round((current-previous)*100)/100;
 return (delta>0?'+':'')+rdFormat(delta)+' đpt';
}
function weeklyNarrative(project,key){
 const n=Number(key.slice(-1)),current=weeklyCoverage(project,key);
 const previous=n>1?weeklyCoverage(project,'week'+(n-1)):null;
 const pct=value=>rdFormat(value)+'%';
 let progress;
 if(project.conflict)progress='Số liệu dự án cần đối soát trước khi chốt tiến độ.';
 else if(current===null)progress='Chưa chốt coverage tuần '+n+'; chưa đủ dữ liệu để kết luận kết quả trong tuần.';
 else if(n===1)progress='Tuần 1 ghi nhận coverage '+pct(current)+', làm mốc theo dõi cho các tuần tiếp theo.';
 else if(previous===null)progress='Tuần '+n+' ghi nhận coverage '+pct(current)+'; tuần '+(n-1)+' chưa có số liệu nên chưa xác định được mức thay đổi.';
 else {
  const delta=Math.round((current-previous)*100)/100;
  progress='Coverage '+(delta>0?'tăng từ ':delta<0?'giảm từ ':'giữ ở ')+pct(previous)+(delta?' lên '+pct(current)+' ('+weeklyDelta(current,previous)+')':'')+'.';
 }
 const history=weeklyBaseline(project);
 if(n===1&&history?.auto)progress+=' Báo cáo tuần 1: '+rdFormat(history.auto)+(history.total?'/'+rdFormat(history.total):'')+' testcase automation.';
 if(n===2&&history?.auto){
  progress+=' Tuần 1 ghi nhận '+rdFormat(history.auto)+(history.total?'/'+rdFormat(history.total):'')+' testcase automation.';
  if(history.total&&rdNumber(project.baseline.total)!==history.total)progress+=' Phạm vi baseline đã thay đổi; chênh lệch số case không phản ánh riêng khối lượng làm mới trong tuần.';
 }
 if(weeklyProvisional(project,key))progress+=' Số tuần 2 tạm lấy từ lũy kế mới nhất, chờ chốt Coverage tuần 2.';
 if(current!==null&&!project.conflict){
  const milestone=[20,40,60,80][n-1];
  progress+=' '+(current>=milestone?'Đã đạt':'Chưa đạt')+' mốc theo dõi tuần '+n+' là '+milestone+'%.';
 }
 const b=project.baseline,total=rdNumber(b.total),auto=rdNumber(b.auto);
 let cumulative='';
 if(!project.conflict&&total>0&&auto!==null){
  cumulative='Lũy kế hiện tại: '+rdFormat(auto)+'/'+rdFormat(total)+' testcase automation';
  if(auto<=total)cumulative+=', còn '+rdFormat(total-auto)+' testcase chưa automation';
  cumulative+='; tỷ lệ trên Sheet: '+rdDisplay(b.coverage)+'.';
  if(rdCoverageMismatch(project))cumulative+=' Tỷ lệ chưa khớp số case, cần đối soát.';
 }
 const tasks=[];
 if(project.conflict||rdCoverageMismatch(project))tasks.push('Đối soát số case và công thức tỷ lệ');
 if(current===null||weeklyProvisional(project,key))tasks.push('Chốt Coverage tuần '+n);
 if(n>1&&previous===null)tasks.push('Bổ sung Coverage tuần '+(n-1)+' để so sánh');
 if(current!==null&&current<80)tasks.push('Tiếp tục triển khai hướng tới mốc 80%');
 if(rdKnown(b.next))tasks.push(b.next);
 return {progress,cumulative,next:tasks.join('; ')||'Chưa cập nhật kế hoạch tiếp theo'};
}
function reports(){
 const projects=rdFiltered(),keys=['week1','week2','week3','week4'];
 const focus=rdWeek||'week2';
 const n=Number(focus.slice(-1)),prev=n>1?'week'+(n-1):null;
 const pct=v=>rdFormat(v)+'%';
 const measured=projects.filter(p=>weeklyCoverage(p,focus)!==null);
 const compared=measured.filter(p=>prev&&weeklyCoverage(p,prev)!==null);
 const increased=compared.filter(p=>weeklyCoverage(p,focus)>weeklyCoverage(p,prev));
 const decreased=compared.filter(p=>weeklyCoverage(p,focus)<weeklyCoverage(p,prev));
 const missing=projects.filter(p=>weeklyCoverage(p,focus)===null||weeklyProvisional(p,focus));
 const milestone=[20,40,60,80][n-1];
 const filters='<div class="filters"><label>Kỳ báo cáo <select id="rd-week" aria-label="Tuần báo cáo">'+options(keys.map((k,i)=>[k,'Tuần '+(i+1)]),focus)+'</select></label><input id="rd-search" aria-label="Tìm dự án" placeholder="Tìm tên dự án" value="'+esc(rdQuery)+'"></div>';
 const blocks=[],lines=['# Báo cáo tiến độ triển khai Automation Test tuần '+n,'','Nguồn dữ liệu: '+rdData.date,''];
 const section=(title,items)=>{
  if(!items.length)return;
  lines.push('## '+title,'',...items.map(x=>'- '+x),'');
  blocks.push('<h3>'+esc(title)+'</h3><ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>');
 };
 const describe=p=>p.baseline.name+': '+weeklyNarrative(p,focus).progress;
 const main=measured.filter(p=>/^(becawork|becafsm)$/i.test(p.baseline.name));
 const others=measured.filter(p=>!main.includes(p));
 section('1. Kết quả trong tuần',main.map(describe).concat(others.map(describe)));
 if(!measured.length){
  const message='Tuần '+n+' chưa có coverage được chốt. Chưa thể xác nhận khối lượng hoàn thành hoặc mức tăng so với tuần trước.';
  lines.push(message,'');blocks.push('<p class="notice">'+esc(message)+'</p>');
 }
 const cumulative=projects.filter(p=>!p.conflict&&rdNumber(p.baseline.total)>0&&rdNumber(p.baseline.auto)!==null);
 cumulative.sort((a,b)=>Number(/^(becawork|becafsm)$/i.test(b.baseline.name))-Number(/^(becawork|becafsm)$/i.test(a.baseline.name)));
 section('2. Số liệu lũy kế mới nhất',cumulative.map(p=>{
  const b=p.baseline,total=rdNumber(b.total),auto=rdNumber(b.auto);
  let text=b.name+': '+rdFormat(auto)+'/'+rdFormat(total)+' testcase automation ('+rdDisplay(b.coverage)+')';
  if(auto<=total)text+=', còn '+rdFormat(total-auto)+' testcase chưa automation';
  if(rdCoverageMismatch(p))text+='. Cần đối soát vì tỷ lệ chưa khớp số case';
  else if(auto<=total)text+=auto/total>=.8?'. Đã đạt mốc 80%':'. Cần thêm '+rdFormat(Math.max(0,Math.ceil(total*.8)-auto))+' testcase để đạt 80%';
  return text+'.';
 }));
 const tasks=[];
 const mismatches=projects.filter(p=>p.conflict||rdCoverageMismatch(p));
 if(mismatches.length)tasks.push('Đối soát số case và tỷ lệ: '+mismatches.map(p=>p.baseline.name).join(', ')+'.');
 if(missing.length)tasks.push('Chốt Coverage tuần '+n+' cho '+missing.length+' dự án: '+missing.map(p=>p.baseline.name).join(', ')+'.');
 const noPrevious=measured.filter(p=>prev&&weeklyCoverage(p,prev)===null);
 if(noPrevious.length)tasks.push('Bổ sung Coverage tuần '+(n-1)+' để so sánh: '+noPrevious.map(p=>p.baseline.name).join(', ')+'.');
 const below=cumulative.filter(p=>!rdCoverageMismatch(p)&&rdNumber(p.baseline.auto)/rdNumber(p.baseline.total)<.8);
 if(below.length)tasks.push('Tiếp tục automation hướng tới mốc 80%: '+below.map(p=>p.baseline.name).join(', ')+'.');
 projects.filter(p=>rdKnown(p.baseline.next)).forEach(p=>tasks.push(p.baseline.name+': '+p.baseline.next));
 section('3. Việc tiếp theo',tasks);
 lines.push('Lưu ý: Số case lũy kế không phải khối lượng hoàn thành riêng trong tuần.');
 setExport(['Dự án','Tuần trước','Tuần '+n,'Thay đổi','Kết quả trong tuần','Việc tiếp theo'],projects.map(p=>[
  p.baseline.name,prev&&weeklyCoverage(p,prev)!==null?pct(weeklyCoverage(p,prev)):'Chưa có số liệu',weeklyCoverage(p,focus)!==null?pct(weeklyCoverage(p,focus))+(weeklyProvisional(p,focus)?' (tạm tính)':''):'Chưa chốt',prev?weeklyDelta(weeklyCoverage(p,focus),weeklyCoverage(p,prev)):'Mốc ban đầu',weeklyNarrative(p,focus).progress,weeklyNarrative(p,focus).next
 ]));
 exportData.markdown=lines.join('\n');
 const summary=rdMetrics([
  ['Có số liệu so sánh',compared.length+' dự án','Gồm số tạm tính tuần 2 nếu chưa chốt'],
  ['Có tiến triển',increased.length+' dự án','Coverage tăng so với tuần trước'],
  ['Coverage giảm',decreased.length+' dự án','Cần kiểm tra tiến độ hoặc phạm vi'],
  ['Chưa chốt tuần',missing.length+' dự án','Chưa đủ số liệu xác nhận kết quả']
 ]);
 const detail=measured.length?'<details class="weekly-report"><summary>Xem bảng đối chiếu tuần '+n+' ('+measured.length+' dự án)</summary>'+table(['Dự án',prev?'Tuần '+(n-1):'Mốc ban đầu','Tuần '+n,'Thay đổi','Mốc tuần '+n],measured.map(p=>{
  const current=weeklyCoverage(p,focus),previous=prev?weeklyCoverage(p,prev):null;
  return [link(p.baseline.name,'rd-detail:'+p.index),esc(previous===null?'Chưa có số liệu':pct(previous)),esc(pct(current)),esc(prev?weeklyDelta(current,previous):'Mốc ban đầu'),esc((current>=milestone?'Đạt':'Chưa đạt')+' '+milestone+'%')];
 }))+'</details>':'';
 return filters+summary+panel('Báo cáo tiến độ Automation Test · Tuần '+n,
  '<article class="weekly-report"><p>Cập nhật '+esc(rdData.date)+' · Mốc tuần '+n+': '+milestone+'% · Mục tiêu cuối kỳ: 80–90%</p><p class="notice">Tuần 1 lấy từ báo cáo đã cung cấp. Tuần 2 dùng Coverage tuần 2 trên Sheet; nếu chưa chốt, dùng lũy kế hiện tại và ghi rõ tạm tính. Các kỳ khác chỉ dùng số liệu đã ghi theo tuần.</p>'+blocks.join('')+'<p class="compact">Số case lũy kế là tình hình hiện tại. Khi baseline thay đổi, không coi chênh lệch số case hoặc coverage là năng suất tuần trên cùng phạm vi.</p></article>')+detail;
}

render();
async function loadSharedSnapshot(){
 try{
  const response=await fetch('/api/rd-snapshot',{cache:'no-store'});
  if(!response.ok)return;
  const snapshot=await response.json();
  if(!snapshot.syncedAt||!rdNormalize(snapshot).length)return;
  if(snapshot.syncedAt===rdShared.syncedAt)return;
  rdShared=snapshot;
  rdData=snapshot;render();
 }catch{
  // Keep displaying the last available snapshot if refresh fails.
 }
}
loadSharedSnapshot();
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible')loadSharedSnapshot();
});

setInterval(loadSharedSnapshot, 60000);
