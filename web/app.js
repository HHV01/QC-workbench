'use strict';
const FEATURE_WEEKLY_REPORT = false;
const $ = id => document.getElementById(id);
const pages = [
 ['rd','▤','Quản lý dự án'],
 ['rd-report','▥','Báo cáo Automation'],
 ...(FEATURE_WEEKLY_REPORT ? [['reports','◫','Báo cáo tuần']] : []),
];
let page='rd',exportData=null;
let rdData=rdSeed;
function read(key,fallback){try{return JSON.parse(localStorage.getItem('qc.'+key))??fallback;}catch{return fallback;}}
function save(key,value){localStorage.setItem('qc.'+key,JSON.stringify(value));}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusTone=s=>['Đạt','Đã test','Đã duyệt demo','Online'].includes(s)?'ok':['Không đạt','Failed','Blocker','Từ chối','Offline'].includes(s)?'bad':['Chờ duyệt','Đang chạy','Chưa test','Chờ retest'].includes(s)?'warn':'blue';
const pill=s=>'<span class="pill '+statusTone(s)+'">'+esc(s)+'</span>';
const btn=(label,action,primary=false)=>'<button type="button" data-action="'+esc(action)+'"'+(primary?' class="primary"':'')+'>'+esc(label)+'</button>';
const link=(label,action)=>'<button type="button" class="text" data-action="'+esc(action)+'">'+esc(label)+'</button>';
function table(headers,rows,className=''){
 const cls=className?' '+className:'';
 if(!rows.length) return '<p class="empty">Không tìm thấy dự án phù hợp.</p>';
 const body=rows.map(row=>{
  if(typeof row==='string') return row;
  if(row && typeof row==='object' && Array.isArray(row.cells)){
   const trCls=row.cls?' class="'+row.cls+'"':'';
   return '<tr'+trCls+'>'+row.cells.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>';
  }
  return '<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>';
 }).join('');
 return '<div class="scroll'+cls+'"><table class="'+className.trim()+'"><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}
const panel=(title,content,tools='')=>'<section class="panel"><div class="panelhead"><h2>'+esc(title)+'</h2>'+tools+'</div>'+content+'</section>';
const options=(values,selected='')=>values.map(value=>{const [id,label]=Array.isArray(value)?value:[value,value];const sel=id===selected?' selected':'';return '<option value="'+esc(id)+'"'+sel+'>'+esc(label)+'</option>';}).join('');
function setExport(headers,rows){exportData={headers,rows};}
const exports=()=>btn('↓ Xuất Markdown','export:md')+btn('↓ Xuất Excel','export:excel');
const views={rd:rdProjects,'rd-report':rdReport,reports};
const subtitles={
 rd:'Theo dõi dự án, QC phụ trách, môi trường và tài liệu kiểm thử.',
 'rd-report':'Theo dõi coverage và mức đạt mục tiêu từng dự án.',
 reports:'Báo cáo kết quả từng tuần, thay đổi so với tuần trước và việc tiếp theo.'
};
function render(){
 if(!FEATURE_WEEKLY_REPORT && page==='reports'){page='rd';try{history.replaceState(null,'',location.pathname);}catch{}}
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
function modal(title,content,width='620px'){
 const dialog=$('dialog');
 dialog.innerHTML='<h2>'+esc(title)+'</h2><div class="dialogbody">'+content+'<div class="actions">'+btn('Đóng','close')+'</div></div>'; dialog.style.width='min('+width+',94vw)';
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
const rdMetrics=(rows)=>'<div class="metrics">'+rows.map(([label,value,note])=>'<div class="card"><label>'+esc(label)+'</label><strong>'+esc(value)+'</strong><small>'+esc(note)+'</small></div>').join('')+'</div>';

/* ------------------------------ chữ số và định dạng ------------------------------ */
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
const isKnown=value=>{
 if(value===null||value===undefined) return false;
 if(typeof value==='number') return Number.isFinite(value);
 const text=String(value).replace(/\u00a0/g,' ').trim();
 if(!text) return false;
 return !/^(n\/?a|na|chưa có dữ liệu|chưa cập nhật|null|undefined|none|-|–|—|--)$/i.test(text);
};
const rdKnown=isKnown;
const rdDisplay=value=>value===null||value===undefined?'':(isKnown(value)?String(value).trim():'');
const rdNumber=value=>{
 if(value===null||value===undefined) return null;
 if(typeof value==='number') return Number.isFinite(value)?value:null;
 const text=String(value).replace(/\u00a0/g,' ').trim();
 if(!text||!isKnown(text)) return null;
 let normalized=text.replace(/%/g,'').trim();
 const dotGroups=(normalized.match(/\./g)||[]).length;
 const commas=(normalized.match(/,/g)||[]).length;
 if(dotGroups>1||(dotGroups===1&&/^\d{1,3}(\.\d{3})+$/.test(normalized))) normalized=normalized.split('.').join('');
 else if(commas===1) normalized=normalized.replace(',','.');
 const number=Number(normalized);
 return Number.isFinite(number)?number:null;
};
const rdFormat=value=>{
 const number=rdNumber(value);
 if(number===null) return '';
 return number.toLocaleString('vi-VN',{maximumFractionDigits:1});
};
const rdPercent=value=>{
 const number=rdNumber(value);
 if(number===null) return null;
 const ratio=(typeof value==='number'||String(value??'').includes('%'))?number:(number>0&&number<=1?number*100:number);
 return ratio;
};
const rdGoal={min:80,max:90};
const rdGoalLabel=rdGoal.min+'–'+rdGoal.max+'%';
function rdPercentValue(project){
 const source=project?.baseline ?? project;
 const ratio=source.autoPercent;
 if(ratio!==null&&ratio!==undefined) return ratio;
 const coverage=source.coverage;
 const value=coverage?coverage.week4??coverage.week3??coverage.week2??coverage.week1??coverage.week??coverage:null;
 const parsed=value===null||value===undefined?null:rdPercent(value);
 if(parsed!==null) return parsed;
 const total=rdNumber(source.total);
 const auto=rdNumber(source.auto);
 if(total!==null&&total>0&&auto!==null) return (auto*100)/total;
 return null;
}
function rdConflict(p){
 const project=p?.baseline ?? p;
 const total=rdNumber(project.total);
 const auto=rdNumber(project.auto);
 if(total===null||auto===null) return false;
 if(auto>total) return true;
 const ratio=rdPercentValue(p);
 if(ratio===null) return false;
 return Math.abs((auto*100)/total-ratio)>0.06;
}
function rdAssessmentKey(p){
 const value=rdPercentValue(p);
 if(value===null) return 'unknown';
 if(rdConflict(p)) return 'conflict';
 if(value>100) return 'conflict';
 if(value<rdGoal.min) return 'below';
 if(value>rdGoal.max) return 'above';
 return 'met';
}
function rdAssessment(p){
 const key=rdAssessmentKey(p);
 if(key==='conflict') return 'Cần đối soát coverage';
 if(key==='unknown') return 'Chưa có dữ liệu';
 if(key==='below') return 'Chưa đạt mục tiêu';
 if(key==='above') return 'Vượt mục tiêu';
 return 'Đạt mục tiêu';
}
function rdVal(p,key){
 const project=p?.baseline ?? p;
 if(key==='automationGoal') return rdGoalLabel;
 if(key==='assessment') return rdAssessment(p);
 if(key==='gap'){
  const total=rdNumber(project.total);
  const auto=rdNumber(project.auto);
  if(total===null||auto===null||total<=0) return 'Chưa có dữ liệu';
  const min=(project.target&&project.target.min)||rdGoal.min;
  return String(Math.max(0,Math.ceil((min*total)/100)-auto));
 }
 if(key==='total'){const n=rdNumber(project.total);return n===null?'Chưa có dữ liệu':rdFormat(n);}
 if(key==='auto'){const n=rdNumber(project.auto);return n===null?'Chưa có dữ liệu':rdFormat(n);}
 if(key==='coverage'){const v=rdPercentValue(p);return v===null?'Chưa có dữ liệu':rdFormat(v)+'%';}
 if(key==='target') return (project.target&&project.target.label)||rdGoalLabel;
 const value=project[key];
 if(value===null||value===undefined) return 'Chưa có dữ liệu';
 if(Array.isArray(value)) return value.join(', ');
 if(typeof value==='object'){
  const v=rdPercentValue({baseline:value});
  return v===null?'Chưa có dữ liệu':rdFormat(v)+'%';
 }
 return rdDisplay(value);
}
function rdAutomation(p){
 const project=p?.baseline ?? p;
 const total=rdNumber(project.total);
 const auto=rdNumber(project.auto);
 const ratio=rdPercentValue(p);
 const progress=ratio!==null&&ratio<=100?'<span class="bar" aria-hidden="true"><i style="width:'+ratio+'%"></i></span>'+esc(rdFormat(ratio)+'%'):pill('Chưa cập nhật');
 const count=(total!==null&&auto!==null)?'<small>'+esc(rdFormat(auto))+' / '+rdFormat(total)+' testcase</small>':auto!==null?'<small>'+esc(rdFormat(auto))+' testcase đã automation</small>':total!==null?'<small>Baseline: '+esc(rdFormat(total))+' testcase</small>':'';
 if(ratio===null&&!count)return pill('Chưa cập nhật');
 return progress+count;
}
function rdCoverageMismatch(p){
 const project=p?.baseline ?? p;
 const total=rdNumber(project.total);
 const auto=rdNumber(project.auto);
 const ratio=rdPercentValue(p);
 if(total===null||total<=0||auto===null||ratio===null) return false;
 return Math.abs((auto*100)/total-ratio)>0.06;
}
function rdProgressMetrics(projects){
 const measured=projects.filter(p=>!rdConflict(p)&&!rdCoverageMismatch(p)&&rdNumber(p.baseline.total)>0&&rdNumber(p.baseline.auto)!==null&&rdNumber(p.baseline.auto)<=rdNumber(p.baseline.total));
 const totalCases=measured.reduce((sum,p)=>sum+rdNumber(p.baseline.total),0);
 const autoCases=measured.reduce((sum,p)=>sum+rdNumber(p.baseline.auto),0);
 return rdMetrics([
  ['Dự án có đủ số liệu',measured.length+' / '+projects.length,'Baseline dương và số auto hợp lệ'],
  ['Testcase baseline',totalCases?rdFormat(totalCases):'—','Chỉ tính dự án có baseline và coverage khớp'],
  ['Case đã automation',totalCases?rdFormat(autoCases):'—','Case đủ điều kiện theo sheet'],
  ['Coverage tổng hợp',totalCases?(100*autoCases/totalCases).toLocaleString('vi-VN',{maximumFractionDigits:2})+'%':'—','Tổng case auto chia tổng baseline'],
 ]);
}

/* ------------------------------ dữ liệu dự án ------------------------------ */
function splitQcList(value){
 const values=Array.isArray(value)?value:(value===null||value===undefined?[]:String(value).split(/[,;\n]+|\s+\/\s+/));
 const seen=new Set();
 const people=[];
 for(const raw of values){
  const name=rdPersonName(String(raw??'').replace(/\u00a0/g,' ').trim());
  if(!name) continue;
  const key=fold(name);
  if(seen.has(key)) continue;
  seen.add(key);
  people.push(name);
 }
 return people;
}
function rdNormalize(dataset){
 const source=Array.isArray(dataset?.projects)?dataset.projects:[];
 const entries=[];
 source.forEach((project,index)=>{
  const entry={...project,baseline:project,entryIndex:index};
  entries.push(entry);
 });
 return entries;
}
function rdUpdated(entry){
 const project=entry?.baseline ?? entry;
 if(rdNumber(project.auto)!==null) return 1;
 const coverage=project.coverage;
 if(coverage&&['week1','week2','week3','week4'].some(key=>coverage[key]!==null&&coverage[key]!==undefined)) return 1;
 return 0;
}
function filterMatches(entry){
 const filters=rdFilters;
 const project=entry?.baseline ?? entry;
 if(filters.q){
  const haystack=fold([project.name??'',project.code??'',project.version??'',project.product??''].join(' '));
  if(!haystack.includes(fold(filters.q))) return false;
 }
 if(filters.category && fold(entry.category ?? '')!==fold(filters.category)) return false;
 if(filters.product && fold(entry.product ?? entry.name ?? '')!==fold(filters.product)) return false;
 if(filters.qcMain && !splitQcList(entry.qcMain).map(rdPersonName).some(person=>fold(person)===fold(filters.qcMain))) return false;
 if(filters.qcSub && !splitQcList(entry.qcSub).map(rdPersonName).some(person=>fold(person)===fold(filters.qcSub))) return false;
 if(filters.priority && fold(entry.priority ?? '')!==fold(filters.priority)) return false;
 if(filters.assessment && (entry.assessment?.code ?? rdAssessmentKey(entry))!==filters.assessment) return false;
 return true;
}
function sortProjects(entries){
 const groups=new Map();
 for(const e of entries){const g=e.groupId||e.id;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(e);}
 const groupKeys=[...groups.entries()].map(([g,items])=>{
  const best=items.reduce((acc,e)=>{
   const a=rdNumber(e.auto);const deployed=(a!==null&&a>0)?0:1;
   const priority=e.priority||'';const prioRank=priority.toLowerCase().includes('cao')?0:priority.toLowerCase().includes('trung')?1:priority.toLowerCase().includes('thấp')?2:3;
   const pct=rdPercentValue(e)??-1;const total=rdNumber(e.total)||0;
   const score=[deployed,prioRank,-pct,-total];
   if(!acc)return {e,score};
   for(let i=0;i<score.length;i++){if(score[i]<acc.score[i])return {e,score};if(score[i]>acc.score[i])return acc;}
   if(String(e.name||'')<String(acc.e.name||''))return {e,score};
   return acc;
  },null);
  const be=best.e;const a=rdNumber(be.auto);const deployed=(a!==null&&a>0)?0:1;
  const priority=be.priority||'';const prioRank=priority.toLowerCase().includes('cao')?0:priority.toLowerCase().includes('trung')?1:priority.toLowerCase().includes('thấp')?2:3;
  const pct=rdPercentValue(be)??-1;const total=rdNumber(be.total)||0;
  return {g,items,deployed,prioRank,pct,total,name:be.name||''};
 });
 groupKeys.sort((a,b)=>a.deployed-b.deployed||a.prioRank-b.prioRank||b.pct-a.pct||b.total-a.total||String(a.name).localeCompare(String(b.name),'vi'));
 const ordered=[];
 for(const gk of groupKeys){ordered.push(...[...gk.items].sort((a,b)=>a.entryIndex-b.entryIndex));}
 return ordered;
}
function groupProjectsByDeployment(entries){
 const deployed=entries.filter(p=>{const a=rdNumber(p.auto);return a!==null&&a>0;});
 const notDeployed=entries.filter(p=>{const a=rdNumber(p.auto);return a===null||a<=0;});
 return {deployed,notDeployed};
}
function rdFiltered(){
 const entries=rdNormalize(rdData).filter(entry=>filterMatches(entry));
 if(rdSort){
  return entries.sort((a,b)=>rdSortCompare(a,b,rdSort));
 }
 return sortProjects(entries);
}

function rdSortCompare(a,b,s){
 // s: {key,dir}
 const dir=s.dir==='asc'?1:-1;
 let va,vb;
 if(s.key==='auto'){va=rdNumber(a.auto);vb=rdNumber(b.auto);}
 else if(s.key==='total'){va=rdNumber(a.total);vb=rdNumber(b.total);}
 else if(s.key==='name'){return dir*(String(a.name||'').localeCompare(String(b.name||''),'vi'));}
 else if(s.key==='priority'){va=a.priority||'';vb=b.priority||'';return dir*String(va).localeCompare(String(vb),'vi');}
 else {va=rdNumber(a[s.key]);vb=rdNumber(b[s.key]);}
 if(va===null&&vb===null)return 0;if(va===null)return 1;if(vb===null)return -1;
 return dir*(va<vb?-1:va>vb?1:0);
}
function collectOptions(getter){
 const map=new Map();
 for(const entry of rdNormalize(rdData)){
  const raw=getter(entry);
  const list=Array.isArray(raw)?raw:[raw];
  for(const value of list){
   const text=value===null||value===undefined?'':String(value).trim();
   const key=text===''?'__none':fold(text);
   const label=text===''?'Chưa đặt':text;
   if(!map.has(key))map.set(key,{key,label});
  }
 }
 const items=[...map.values()].sort((a,b)=>a.label.localeCompare(b.label,'vi'));
 return items.map(item=>[item.key,item.label]);
}
function assessmentOptions(){
 return [['met','Đạt mục tiêu'],['below','Chưa đạt mục tiêu'],['above','Vượt mục tiêu'],['conflict','Cần đối soát'],['unknown','Chưa có dữ liệu']];
}
function rdFilterMarkup(report){
 const categories=collectOptions(entry=>entry.category);
 const products=collectOptions(entry=>entry.product ?? entry.name);
 const qcMains=collectOptions(entry=>splitQcList(entry.qcMain).map(rdPersonName));
 const qcSubs=collectOptions(entry=>splitQcList(entry.qcSub).map(rdPersonName));
 const priorities=collectOptions(entry=>entry.priority);
 const assessments=assessmentOptions();
 const active=Object.values(rdFilters).some(value=>value!=='')||rdWeek!==''||!!rdFilters.q;
 return '<div class="filters"><input id="rd-search" data-filter="q" aria-label="Tìm dự án" placeholder="Tìm tên dự án" value="'+esc(rdFilters.q)+'">'
  +'<select id="rd-category" data-filter="category" aria-label="Phân loại dự án">'+options([['','Tất cả phân loại'],...categories],rdFilters.category)+'</select>'
  +'<select id="rd-product" data-filter="product" aria-label="Sản phẩm">'+options([['','Tất cả sản phẩm'],...products],rdFilters.product)+'</select>'
  +'<select id="rd-qcMain" data-filter="qcMain" aria-label="QC chính">'+options([['','Tất cả QC chính'],...qcMains],rdFilters.qcMain)+'</select>'
  +'<select id="rd-qcSub" data-filter="qcSub" aria-label="QC phụ">'+options([['','Tất cả QC phụ'],...qcSubs],rdFilters.qcSub)+'</select>'
  +'<select id="rd-priority" data-filter="priority" aria-label="Mức độ ưu tiên">'+options([['','Tất cả ưu tiên'],...priorities],rdFilters.priority)+'</select>'
  +'<select id="rd-assessment" data-filter="assessment" aria-label="Đánh giá mục tiêu">'+options([['','Tất cả đánh giá'],...assessmentOptions()],rdFilters.assessment)+'</select>'
  +'<select id="rd-week" data-filter="week" aria-label="Tuần báo cáo">'+options([['','Tất cả tuần'],...[1,2,3,4].map(n=>['week'+n,'Tuần '+n])])+'</select>'
  +'<button type="button" data-action="clear-filters">Xóa bộ lọc</button>'+
  '</div>';
}
let rdFilters={q:'',category:'',product:'',qcMain:'',qcSub:'',priority:'',assessment:'',reportStatus:''};
let rdWeek='';
let rdSort=null;
let rdCollapsedGroups=new Set();
let rdReportPeriod='';
let rdReportsData={periods:{}};
let rdReportDrawer=null;

/* ------------------------------ trang Quản lý dự án ------------------------------ */
function rdProjects(){
 const allEntries=rdFiltered();
 const entries=allEntries.filter(p=>{const a=rdNumber(p.auto);return a!==null&&a>0;});
 const deployedCount=rdNormalize(rdData).filter(p=>{const a=rdNumber(p.auto);return a!==null&&a>0;}).length;
 const allCount=deployedCount;
 const headers=['Dự án','QC chính','QC phụ trách','Automation','Mức ưu tiên','Đánh giá'];
 const raw=entries.map(p=>[
  p.name,
  splitQcList(p.qcMain).join(', '),
  splitQcList(p.qcSub).join(', '),
  rdVal(p,'auto')+' / '+rdVal(p,'total'),
  rdDisplay(p.priority),
  rdVal(p,'assessment')+' · Mục tiêu: '+rdGoalLabel,
 ]);
 setExport(headers,raw);
 // KPI
 const totalCases=entries.reduce((s,p)=>s+(rdNumber(p.total)||0),0);
 const autoCases=entries.reduce((s,p)=>s+(rdNumber(p.auto)||0),0);
 const pctAll=totalCases>0?(100*autoCases/totalCases):0;
 const metCount=entries.filter(p=>rdPercentValue(p)!==null&&['Đạt mục tiêu','Vượt mục tiêu'].includes(rdAssessment(p))).length;
 const belowCount=entries.filter(p=>rdPercentValue(p)!==null&&rdAssessment(p)==='Chưa đạt mục tiêu').length;
 const kpiHtml='<div class="metrics kpi-row">'+
  '<div class="card kpi"><label>Số dự án đã triển khai</label><strong>'+entries.length+'</strong><small>Trên tổng '+allCount+' dự án</small></div>'+
  '<div class="card kpi"><label>Tổng testcase</label><strong>'+rdFormat(totalCases)+'</strong><small>Baseline đã có số liệu</small></div>'+
  '<div class="card kpi"><label>Case đã automation</label><strong>'+rdFormat(autoCases)+'</strong><small>'+rdFormat(autoCases)+' / '+rdFormat(totalCases)+'</small></div>'+
  '<div class="card kpi"><label>% Automation chung</label><strong>'+rdFormat(pctAll)+'%</strong><small><span class="bar"><i style="width:'+Math.min(100,pctAll)+'%"></i></span> mốc 80%</small></div>'+
  '<div class="card kpi kpi-wide"><label>Phân bố mục tiêu</label><strong>'+metCount+' đạt · '+belowCount+' chưa đạt</strong><small>Trên '+entries.length+' dự án có đủ số liệu</small></div>'+
 '</div>';
 const renderRow=p=>{
  const assessment=rdAssessment(p);
  const tone=assessment==='Đạt mục tiêu'||assessment==='Vượt mục tiêu'?'ok':assessment.startsWith('Chưa đạt')?'bad':assessment==='Chưa xác định'?'blue':'warn';
  const hasAssessment=rdPercentValue(p)!==null;
  const assessmentShort=hasAssessment?rdAssessmentShort(p):'';
  return [
   link(p.name,'rd-detail:'+p.id),
   rdQcCell(p.qcMain,false),
   rdQcCell(p.qcSub,false),
   rdAutomation(p),
   rdPriorityChip(p.priority),
   (hasAssessment?'<span class="pill '+tone+'">'+esc(assessmentShort)+'</span>':'')+'<small>Mục tiêu: '+esc(rdGoalLabel)+'</small>',
  ];
 };
 const rows=entries.map(p=>renderRow(p));
 const resetLink='<a href="#" data-action="rd-reset-sort" class="muted" style="font-size:12px">Đặt lại thứ tự mặc định</a>';
 const footer='<div class="resultline"><b>Hiển thị '+entries.length+' / '+allCount+' dự án</b> · '+resetLink+'</div><p class="muted compact" style="margin-top:8px">Xem các dự án chưa triển khai trong <a href="#" data-action="go:rd-report">Báo cáo Automation</a>.</p>';
 return rdFilterMarkup(false)+kpiHtml+footer+panel('Danh sách dự án',table(headers,rows,'project-table'));
}

/* ------------------------------ báo cáo Automation ------------------------------ */
function rdReportColumns(entries){
 const columns=[
  {key:'Dự án',label:'Dự án',get:p=>p.name,render:p=>'<span class="num" style="text-align:left;font-weight:600">'+esc(p.name)+'</span>',always:true},
  {key:'QC chính',label:'QC chính',get:p=>splitQcList(p.qcMain).join(', '),render:p=>rdQcCell(p.qcMain,false),has:p=>splitQcList(p.qcMain).length>0},
  {key:'QC phụ trách',label:'QC phụ trách',get:p=>splitQcList(p.qcSub).join(', '),render:p=>rdQcCell(p.qcSub,true),has:p=>splitQcList(p.qcSub).length>0},
  {key:'Mức độ ưu tiên',label:'Mức độ ưu tiên',get:p=>p.priority??'',render:p=>rdPriorityChip(p.priority),has:p=>!!p.priority},
  {key:'Tổng case (N)',label:'Tổng case (N)',get:p=>rdNumber(p.baseline.total)===null?'':rdFormat(p.baseline.total),render:p=>{const n=rdNumber(p.baseline.total);return n===null?'':'<span class="num">'+rdFormat(n)+'</span>';},has:p=>rdNumber(p.baseline.total)!==null},
  {key:'Case đã auto (A)',label:'Case đã auto (A)',get:p=>rdNumber(p.baseline.auto)===null?'':rdFormat(p.baseline.auto),render:p=>{const n=rdNumber(p.baseline.auto);return n===null?'':'<span class="num">'+rdFormat(n)+'</span>';},has:p=>rdNumber(p.baseline.auto)!==null},
  {key:'Coverage',label:'Coverage',get:p=>{const value=rdPercentValue(p);return value===null?'':rdFormat(value)+'%';},render:p=>rdProgressCell(p),has:p=>rdPercentValue(p)!==null},
  {key:'Case còn thiếu tới 80%',label:'Case còn thiếu tới 80%',get:p=>{const total=rdNumber(p.baseline.total),auto=rdNumber(p.baseline.auto);if(total===null||auto===null||total<=0)return'';return rdVal(p,'gap');},render:p=>{const total=rdNumber(p.baseline.total),auto=rdNumber(p.baseline.auto);if(total===null||auto===null||total<=0)return'';return '<span class="num">'+rdVal(p,'gap')+'</span>';},has:p=>rdNumber(p.baseline.total)!==null&&rdNumber(p.baseline.total)>0&&rdNumber(p.baseline.auto)!==null},
  {key:'Bug Auto',label:'Bug Auto',get:p=>rdNumber(p.baseline.bugAuto)===null?'':rdVal(p,'bugAuto'),render:p=>{const n=rdNumber(p.baseline.bugAuto);return n===null?'':'<span class="num">'+rdFormat(n)+'</span>';},has:p=>rdNumber(p.baseline.bugAuto)!==null},
  {key:'Bug Manual',label:'Bug Manual',get:p=>rdNumber(p.baseline.bugManual)===null?'':rdVal(p,'bugManual'),render:p=>{const n=rdNumber(p.baseline.bugManual);return n===null?'':'<span class="num">'+rdFormat(n)+'</span>';},has:p=>rdNumber(p.baseline.bugManual)!==null},
  {key:'Tỷ lệ không ổn định (%)',label:'Tỷ lệ không ổn định (%)',get:p=>rdNumber(p.flaky)===null?'':rdVal(p,'flaky'),render:p=>{const n=rdNumber(p.flaky);return n===null?'':'<span class="num">'+rdFormat(n)+'%</span>';},has:p=>rdNumber(p.flaky)!==null},
  {key:'Đánh giá',label:'Đánh giá',get:p=>rdPercentValue(p)===null?'':rdAssessment(p),render:p=>rdAssessmentBadge(p),always:true},
  {key:'Việc tiếp theo',label:'Việc tiếp theo',get:p=>p.next?rdVal(p,'next'):'',render:p=>p.next?'<span class="note-trunc" title="'+esc(p.next)+'">'+esc(p.next)+'</span>':'',has:p=>!!p.next},
 ];
 return columns.filter(column=>column.always||entries.some(entry=>column.has(entry)));
}
function rdReport(){
 const entries=rdFiltered();
 const columns=rdReportColumns(entries);
 const measured=entries.filter(p=>rdNumber(p.baseline.total)!==null&&rdNumber(p.baseline.auto)!==null);
 const followUp=entries.filter(p=>rdPercentValue(p)!==null&&rdAssessment(p)==='Chưa đạt mục tiêu');
 const reached=entries.filter(p=>rdPercentValue(p)!==null&&['Đạt mục tiêu','Vượt mục tiêu'].includes(rdAssessment(p)));
 const pending=entries.filter(p=>rdPercentValue(p)!==null&&!followUp.includes(p)&&!reached.includes(p));
 const notice='Mục tiêu '+rdGoalLabel+' · '+entries.length+' dự án trong bộ lọc · '+measured.length+' dự án có đủ số liệu';
 const {deployed,notDeployed}=groupProjectsByDeployment(entries);
 const sortWithin=g=>[...g].sort((a,b)=>{const pa=a.priority||'',pb=b.priority||'';const ra=pa.toLowerCase().includes('cao')?0:pa.toLowerCase().includes('trung')?1:pa.toLowerCase().includes('thấp')?2:3;const rb=pb.toLowerCase().includes('cao')?0:pb.toLowerCase().includes('trung')?1:pb.toLowerCase().includes('thấp')?2:3;if(ra!==rb)return ra-rb;const pa2=rdPercentValue(a)??-1,pb2=rdPercentValue(b)??-1;if(pb2!==pa2)return pb2-pa2;return String(a.name||'').localeCompare(String(b.name||''),'vi');});
 const orderedEntries=sortWithin(deployed).concat(sortWithin(notDeployed));
 setExport(columns.map(c=>c.label),orderedEntries.map(entry=>columns.map(c=>c.get(entry))));
 let body='';
 if(!entries.length){
  body='<div class="empty-state"><p>Không tìm thấy dự án phù hợp với bộ lọc.</p><button type="button" data-action="clear-filters">Xóa bộ lọc</button></div>';
 }else{
  const rows=[];
  const collapsed2=rdCollapsedGroups.has('__notdeployed__');
  rows.push('<tr class="group-row"><td colspan="'+columns.length+'"><b>Đã triển khai automation ('+deployed.length+')</b></td></tr>');
  let prevProduct=null;
  for(const e of sortWithin(deployed)){
   const isChild=prevProduct!==null && String(e.product||'')===String(prevProduct||'');
   const cells=columns.map(c=>c.render?c.render(e):esc(c.get(e)));
   rows.push(isChild?{cells,cls:'child-row'}:cells);
   prevProduct=e.product||'';
  }
  rows.push('<tr class="group-row"><td colspan="'+columns.length+'"><button type="button" class="group-toggle" data-action="rd-toggle-group:__notdeployed__">'+(collapsed2?'▸':'▾')+' <b>Chưa triển khai ('+notDeployed.length+')</b></button></td></tr>');
  if(!collapsed2){
   for(const e of sortWithin(notDeployed)){
    const cells=columns.map(c=>c.render?c.render(e):esc(c.get(e)));
    rows.push(cells);
   }
  }
  body=table(columns.map(c=>c.label),rows,'rd-report-table');
 }
 return rdFilterMarkup(true)+'<div class="resultline"><b>Hiển thị '+entries.length+' / '+rdNormalize(rdData).length+' dự án</b></div>'+rdProgressMetrics(entries)+
  '<div class="notice">'+esc(notice)+'</div>'+
  panel('Báo cáo Automation',body);
}

/* ------------------------------ báo cáo tuần ------------------------------ */
const weeklyBaseline1={
 becawork:{coverage:95.7,auto:265,total:277},
 becafsm:{coverage:15.2,auto:137},
 becavms:{coverage:40},becaros:{coverage:97.5},
 ptsc:{coverage:92.6},smartpole:{coverage:44}
};
function weeklyBaseline(project){
 const name=String(project.baseline.name).toLocaleLowerCase('vi').replace(/[^a-z0-9]/g,'');
 const key=name.startsWith('ptsc')?'ptsc':name.startsWith('smartpole')?'smartpole':name;
 return weeklyBaseline1[key];
}
function weekRawValue(project,key){
 const source=project?.baseline ?? project;
 const value=source[key] ?? source.coverage?.[key];
 return value===null||value===undefined?null:value;
}
function weeklyProvisional(project,key){
 const source=project?.baseline ?? project;
 if(key!=='week2') return false;
 const value=weekRawValue(project,key);
 if(/^\d+(?:[,.]\d+)?%$/.test(String(value??''))) return false;
 if(project.conflict) return false;
 if(rdCoverageMismatch(project)) return false;
 const fallback=source.coverage?.[key] ?? source.coverage;
 if(!/^\d+(?:[,.]\d+)?%$/.test(String(fallback ?? ''))) return false;
 return true;
}
function weeklyCoverage(project,key){
 const source=project?.baseline ?? project;
 if(key==='week1'&&weeklyBaseline(project))return weeklyBaseline(project).coverage;
 if(project.conflict)return null;
 const value=weeklyProvisional(project,key)?source.coverage:weekRawValue(project,key);
 const parsed=value===null?null:rdPercent(value);
 if(parsed===null) return null;
 return parsed<=100?parsed:null;
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
const REPORT_DAYS=[2,4,6];
function isReportDay(d){return REPORT_DAYS.includes(d.getDay());}
function fmtDate(d){const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day;}
function defaultReportPeriod(){const now=new Date();const d=new Date(now);d.setHours(0,0,0,0);if(isReportDay(d)&&now.getHours()<13)return fmtDate(d);for(let i=1;i<14;i++){const nd=new Date(d);nd.setDate(d.getDate()+i);if(isReportDay(nd))return fmtDate(nd);}return fmtDate(d);}
function stepReportPeriod(dateStr,delta){const d=new Date(dateStr+'T00:00:00');for(let i=0;i<14;i++){d.setDate(d.getDate()+delta);if(isReportDay(d))return fmtDate(d);}return fmtDate(d);}
function periodLabel(dateStr){const d=new Date(dateStr+'T00:00:00');return d.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});}
function periodDeadline(dateStr){return new Date(dateStr+'T13:00:00');}
function periodDataOf(period){if(!rdReportsData.periods)rdReportsData.periods={};if(!rdReportsData.periods[period])rdReportsData.periods[period]={entries:{}};if(!rdReportsData.periods[period].entries)rdReportsData.periods[period].entries={};return rdReportsData.periods[period];}
const RD_PERSON_MAP={'loan':'Nguyễn Thị Loan','ý':'Phạm Hồng Ý','y':'Phạm Hồng Ý'};
const rdAvatarPalette=['#4f6bd8','#2f8f7a','#b07a2a','#c0546e','#7a6ab0','#2a8a9a','#c46a3a','#5a7fa8'];
function rdPersonName(raw){const t=String(raw??'').trim();if(!t)return '';const key=t.toLowerCase();return RD_PERSON_MAP[key]||t;}
function rdAvatarColor(name){let h=0;for(const c of String(name??''))h=(h*31+c.charCodeAt(0))>>>0;return rdAvatarPalette[h%rdAvatarPalette.length];}
function rdAvatar(name){const n=rdPersonName(String(name??'').trim());if(!n)return '';const toks=n.split(/\s+/).filter(Boolean);const initials=(toks.length>=2?toks[0][0]+toks[toks.length-1][0]:toks[0].slice(0,2)).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'D').replace(/Đ/g,'D');return '<span class="av" style="background:'+rdAvatarColor(n)+'" title="'+esc(n)+'">'+esc(initials)+'</span>';}
function rdQcCell(people,stacked){const list=splitQcList(people);if(!list.length)return '';if(!stacked){return list.map(p=>'<span class="qc-person">'+rdAvatar(p)+'<span class="qc-name">'+esc(p)+'</span></span>').join('');}const avs=list.map((p,i)=>'<span style="margin-left:'+(i===0?0:-7)+'px;z-index:'+(list.length-i)+';position:relative;display:inline-block">'+rdAvatar(p)+'</span>').join('');return '<span class="qc-stack" title="'+esc(list.join(', '))+'">'+avs+'</span>';}
function rdProgressCell(p){const v=rdPercentValue(p);if(v===null)return '';const pct=Math.min(100,Math.max(0,v));const tone=v>=rdGoal.min?'met':v>=60?'near':'low';return '<div class="prog-cell"><span class="prog-track"><i class="prog-fill prog-'+tone+'" style="width:'+pct+'%"></i><span class="prog-mark"></span></span><span class="prog-val num">'+rdFormat(v)+'%</span></div>';}
function rdAssessmentBadge(p){const v=rdPercentValue(p);if(v===null)return '';const label=rdAssessment(p);const cls=label==='Đạt mục tiêu'||label==='Vượt mục tiêu'?'badge-ok':label==='Chưa đạt mục tiêu'?'badge-warn':'badge-info';return '<span class="badge '+cls+'">'+esc(label)+'</span>';}
function rdPriorityChip(value){const v=String(value??'').trim();if(!v)return '';const code=v.toLowerCase().includes('cao')?'high':v.toLowerCase().includes('thấp')?'low':'med';return '<span class="chip chip-'+code+'">'+esc(v)+'</span>';}
function rdEnvChip(value){const t=String(value??'').trim();if(!t||!isKnown(t))return '<span class="muted">--</span>';return '<span class="env-chip" title="Môi trường test">'+esc(t)+'</span>';}
function rdAssessmentShort(p){const key=rdAssessmentKey(p);if(key==='conflict')return 'Đối soát';if(key==='unknown')return '';if(key==='below')return 'Chưa đạt';if(key==='above')return 'Vượt';return 'Đạt';}
function reports(){
 if(!rdReportPeriod) rdReportPeriod=defaultReportPeriod();
 const period=rdReportPeriod;
 const periodInfo=periodDataOf(period);
 const entries=periodInfo.entries||{};
 const prevPeriod=stepReportPeriod(period,-1);
 const prevInfo=periodDataOf(prevPeriod);
 const prevEntries=prevInfo.entries||{};
 const now=new Date();
 const deadline=periodDeadline(period);
 const isPast = new Date(period+'T00:00:00') < new Date(new Date().toDateString());
 const isEditable = !isPast;
 const remainingMs = deadline - now;
 const projects=rdFiltered();
 const totalProjects=projects.length;
 const submittedProjects=projects.filter(p=>entries[p.id]&&entries[p.id].submittedAt);
 const missingProjects=projects.filter(p=>!(entries[p.id]&&entries[p.id].submittedAt));
 const lateProjects=projects.filter(p=>entries[p.id]&&entries[p.id].late);
 const supportProjects=projects.filter(p=>entries[p.id]&&entries[p.id].support);
 const navBar='<div class="period-nav"><button type="button" data-action="rd-prev-period">←</button><div class="period-info"><strong>'+esc(periodLabel(period))+'</strong><small>Hạn: trước 13:00</small></div><button type="button" data-action="rd-next-period">→</button>'+(remainingMs>0&&remainingMs<24*3600*1000?'<span class="countdown">Còn '+Math.ceil(remainingMs/60000)+' phút</span>':'')+'</div>';
 const statusCards='<div class="metrics">'+
  '<div class="card status-card" data-action="rd-filter-status:submitted" style="cursor:pointer"><label>Đã báo cáo</label><strong>'+submittedProjects.length+' / '+totalProjects+'</strong><small>Dự án đã nộp</small></div>'+
  '<div class="card status-card'+(missingProjects.length?' dim':'')+'" data-action="rd-filter-status:missing" style="cursor:pointer"><label>Chưa báo cáo</label><strong>'+missingProjects.length+'</strong><small>Dự án chưa nộp</small></div>'+
  '<div class="card status-card'+(lateProjects.length?'':' dim')+'" data-action="rd-filter-status:late" style="cursor:pointer"><label>Nộp trễ</label><strong>'+lateProjects.length+'</strong><small>Sau 13:00</small></div>'+
  '<div class="card status-card'+(supportProjects.length?'':' dim')+'" data-action="rd-filter-status:support" style="cursor:pointer"><label>Cần hỗ trợ</label><strong>'+supportProjects.length+'</strong><small>Vấn đề cần xử lý</small></div>'+
 '</div>';
 const supportBlock = supportProjects.length ? '<div class="support-block"><h3>Vấn đề cần hỗ trợ</h3><ul>'+supportProjects.map(p=>'<li><strong>'+esc(p.name)+'</strong>: '+esc(entries[p.id].support)+(entries[p.id].supportWho?' <em>('+esc(entries[p.id].supportWho)+')</em>':'')+'</li>').join('')+'</ul></div>' : '';
 const baseFilters=rdFilterMarkup(false);
 const statusSelect='<select id="rd-report-status" data-filter="reportStatus" aria-label="Trạng thái nộp">'+options([['','Tất cả trạng thái'],['submitted','Đã nộp'],['missing','Chưa nộp'],['late','Nộp trễ'],['support','Cần hỗ trợ']])+'</select>';
 const filters=baseFilters.replace(/<\/div>$/, statusSelect+'</div>');
 const statusFilter=rdFilters.reportStatus||'';
 let visibleProjects=projects;
 if(statusFilter==='submitted')visibleProjects=projects.filter(p=>entries[p.id]&&entries[p.id].submittedAt);
 else if(statusFilter==='missing')visibleProjects=projects.filter(p=>!(entries[p.id]&&entries[p.id].submittedAt));
 else if(statusFilter==='late')visibleProjects=projects.filter(p=>entries[p.id]&&entries[p.id].late);
 else if(statusFilter==='support')visibleProjects=projects.filter(p=>entries[p.id]&&entries[p.id].support);
 const rows=visibleProjects.map(p=>{
  const e=entries[p.id]||{};
  const prev=prevEntries[p.id]||{};
  const run=rdNumber(e.run), pass=rdNumber(e.pass), fail=rdNumber(e.fail);
  const total=rdNumber(p.total);
  const prevRun=rdNumber(prev.run);
  const delta = (run!==null && prevRun!==null) ? (run-prevRun) : null;
  const deltaStr = delta===null ? '' : (delta>0?'▲ +'+rdFormat(delta):delta<0?'▼ '+rdFormat(delta):'=');
  const deltaCls = delta===null?'':(delta>0?'delta-up':delta<0?'delta-down':'delta-flat');
  const submitted = !!e.submittedAt;
  const late = !!e.late;
  const badge = !submitted ? '<span class="badge badge-warn">Chưa nộp</span>' : late ? '<span class="badge badge-warn">Trễ</span>' : '<span class="badge badge-ok">Đã nộp</span>';
  const progress = (run!==null&&total!==null&&total>0) ? '<div class="prog-cell"><span class="prog-track"><i class="prog-fill prog-met" style="width:'+Math.min(100,run/total*100)+'%"></i></span><span class="prog-val num">'+rdFormat(run)+'/'+rdFormat(total)+'</span></div>' : '<span class="num">'+(run===null?'':rdFormat(run))+(total!==null?' / '+rdFormat(total):'')+'</span>';
  const supportMark = e.support ? ' <span class="support-mark" title="Cần hỗ trợ">⚠</span>' : '';
  return [
   rdAvatar(p.name)+' '+link(p.name,'rd-detail:'+p.id)+supportMark+'<br><small class="muted">'+esc(splitQcList(p.qcMain).join(', '))+(splitQcList(p.qcSub).length?' · '+esc(splitQcList(p.qcSub).join(', ')):'')+'</small>',
   progress,
   '<span class="num">'+(pass===null?'':rdFormat(pass))+'</span>',
   '<span class="num">'+(fail===null?'':rdFormat(fail))+'</span>',
   '<span class="num '+deltaCls+'">'+esc(deltaStr)+'</span>',
   badge,
   (isEditable?'<button type="button" class="btn-sm" data-action="rd-open-report:'+p.id+'">Cập nhật</button>':'<span class="muted">Chỉ xem</span>')
  ];
 });
 const tableHtml = rows.length ? table(['Dự án','Đã chạy / Tổng','Đạt','Lỗi','So với kỳ trước','Trạng thái','Cập nhật'],rows,'rd-report-table') : '<p class="empty">Không có dự án phù hợp.</p>';
 const exportRows = visibleProjects.map(p=>{
  const e=entries[p.id]||{};
  const prev=prevEntries[p.id]||{};
  const run=rdNumber(e.run),pass=rdNumber(e.pass),fail=rdNumber(e.fail);
  const total=rdNumber(p.total);
  const prevRun=rdNumber(prev.run);
  const delta=(run!==null&&prevRun!==null)?(run-prevRun):null;
  return [p.name, splitQcList(p.qcMain).join(', '), run===null?'':rdFormat(run), total===null?'':rdFormat(total), pass===null?'':rdFormat(pass), fail===null?'':rdFormat(fail), delta===null?'':(delta>0?'+'+delta:delta), e.difficulty||'', e.next||'', e.support||''];
 });
 setExport(['Dự án','QC chính','Đã chạy','Tổng','Đạt','Lỗi','Chênh lệch','Khó khăn','Bước tiếp theo','Cần hỗ trợ'],exportRows);
 const copyBtn='<button type="button" class="primary" data-action="rd-copy-report">Sao chép báo cáo</button>';
 const exportBtns='<button type="button" data-action="export:md">↓ Markdown</button><button type="button" data-action="export:excel">↓ Excel</button>';
 return '<div class="period-bar">'+navBar+'</div>'+statusCards+supportBlock+
  filters+
  '<div class="resultline"><b>Hiển thị '+visibleProjects.length+' / '+totalProjects+' dự án</b></div>'+
  panel('Danh sách báo cáo', tableHtml, copyBtn+' '+exportBtns);
}
function rdOpenReportDrawer(projectId){
 const p=rdNormalize(rdData).find(x=>x.id===projectId);
 if(!p) return;
 const period=rdReportPeriod;
 const periodInfo=periodDataOf(period);
 const e=periodInfo.entries[projectId]||{};
 const prevPeriod=stepReportPeriod(period,-1);
 const prevInfo=periodDataOf(prevPeriod);
 const prev=prevInfo.entries[projectId]||{};
 const total=rdNumber(p.total);
 const isPast = new Date(period+'T00:00:00') < new Date(new Date().toDateString());
 const form='<form id="rd-report-form" data-project="'+esc(projectId)+'">'+
  '<div class="rd-section"><strong>Số liệu chung (từ Google Sheet, chỉ đọc)</strong></div>'+
  '<div class="readonly-grid"><span>Tổng case:</span><strong>'+(total===null?'':rdFormat(total))+'</strong><span>Case đã auto:</span><strong>'+(rdNumber(p.auto)===null?'':rdFormat(p.auto))+'</strong><span>% Auto:</span><strong>'+(rdPercentValue(p)===null?'':rdFormat(rdPercentValue(p))+'%')+'</strong><span>QC chính:</span><strong>'+esc(splitQcList(p.qcMain).join(', '))+'</strong></div>'+
  (prev.submittedAt?'<div class="rd-section"><strong>Kỳ trước ('+esc(periodLabel(prevPeriod))+')</strong></div><div class="readonly-grid"><span>Đã chạy:</span><strong>'+(rdNumber(prev.run)===null?'':rdFormat(prev.run))+'</strong><span>Đạt:</span><strong>'+(rdNumber(prev.pass)===null?'':rdFormat(prev.pass))+'</strong><span>Lỗi:</span><strong>'+(rdNumber(prev.fail)===null?'':rdFormat(prev.fail))+'</strong></div>':'')+
  '<div class="rd-section"><strong>Kết quả thực thi</strong></div>'+
  '<label>Đã chạy <input name="run" type="number" min="0" value="'+(rdNumber(e.run)===null?'':e.run)+'"></label>'+
  '<label>Đạt <input name="pass" type="number" min="0" value="'+(rdNumber(e.pass)===null?'':e.pass)+'"></label>'+
  '<label>Lỗi <input name="fail" type="number" min="0" value="'+(rdNumber(e.fail)===null?'':e.fail)+'"></label>'+
  '<label>Khó khăn <textarea name="difficulty">'+esc(e.difficulty||'')+'</textarea></label>'+
  '<label>Bước tiếp theo <textarea name="next">'+esc(e.next||'')+'</textarea></label>'+
  '<label>Cần hỗ trợ <textarea name="support">'+esc(e.support||'')+'</textarea></label>'+
  '<label>Người/bộ phận cần hỗ trợ <input name="supportWho" value="'+esc(e.supportWho||'')+'"></label>'+
  '<div class="actions"><button type="button" data-action="close">Hủy</button><button type="button" class="primary" data-action="rd-save-report:'+esc(projectId)+'">Lưu</button></div>'+
 '</form>';
 modal(p.name, form);
 if(isPast){const f=document.getElementById('rd-report-form');if(f){f.querySelectorAll('input,textarea,button.primary').forEach(x=>x.disabled=true);}}
}
function rdCopyReport(){
 const period=rdReportPeriod;
 const periodInfo=periodDataOf(period);
 const entries=periodInfo.entries||{};
 const projects=rdFiltered();
 const lines=['Báo cáo automation test - '+periodLabel(period),''];
 for(const p of projects){
  const e=entries[p.id];
  if(!e||rdNumber(e.run)===null) continue;
  lines.push('['+p.name+'] (QC: '+splitQcList(p.qcMain).join(', ')+(splitQcList(p.qcSub).length?' / '+splitQcList(p.qcSub).join(', '):'')+')');
  const prevPeriod=stepReportPeriod(period,-1);
  const prev=periodDataOf(prevPeriod).entries[p.id]||{};
  const prevRun=rdNumber(prev.run);
  const run=rdNumber(e.run);
  if(prevRun!==null&&run!==null){const d=run-prevRun;lines.push('- Kết quả so với kỳ trước: '+(d>0?'tăng '+rdFormat(d):d<0?'giảm '+rdFormat(Math.abs(d)):'không đổi'));}
  lines.push('- Đã chạy / Tổng: '+rdFormat(run)+' / '+(rdNumber(p.total)===null?'':rdFormat(p.total)));
  const pass=rdNumber(e.pass),fail=rdNumber(e.fail);
  if(pass!==null||fail!==null)lines.push('- Đạt / Lỗi: '+(pass===null?'':rdFormat(pass))+' / '+(fail===null?'':rdFormat(fail)));
  if(e.difficulty)lines.push('- Khó khăn: '+e.difficulty);
  if(e.next)lines.push('- Bước tiếp theo: '+e.next);
  if(e.support)lines.push('- Cần hỗ trợ: '+e.support+(e.supportWho?' ('+e.supportWho+')':''));
  lines.push('');
 }
 const text=lines.join('\n');
 if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(()=>notice('Đã sao chép báo cáo')).catch(()=>notice('Không thể sao chép'));}
 else {const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);notice('Đã sao chép báo cáo');}
}
function tasksFor(projects){
 const tasks=[];
 const below=projects.filter(p=>p.hasData&&rdAssessment(p)==='Chưa đạt mục tiêu');
 if(below.length)tasks.push('Tiếp tục automation hướng tới mốc 80%: '+below.map(p=>p.baseline.name).join(', ')+'.');
 for(const project of projects){
  if(project.hasData&&rdKnown(project.baseline.next))tasks.push(project.baseline.name+': '+project.baseline.next);
 }
 if(!tasks.length)tasks.push('Chưa có việc tiếp theo được ghi trong bộ lọc hiện tại.');
 return tasks;
}
/* ------------------------------ chi tiết, link, export ------------------------------ */
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
function rdDetailVal(value){if(value===null||value===undefined)return '<span class="muted">--</span>';if(typeof value==='number'){if(!Number.isFinite(value))return '<span class="muted">--</span>';return rdFormat(value);}const t=String(value).trim();if(!t||!isKnown(t))return '<span class="muted">--</span>';return esc(t);}
function rdLinkList(value){const t=String(value??'').trim();if(!t||!isKnown(t))return '<span class="muted">--</span>';const urls=t.match(/https?:\/\/[^\s<>"']+/gi)??[];if(!urls.length)return esc(t);const items=urls.map((u,i)=>'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(new URL(u).hostname)+(urls.length>1?' #'+(i+1):'')+' ↗</a>');return '<div class="link-list">'+items.join('')+'</div>';}
function rdDetail(id){
 const entries=rdNormalize(rdData);
 const project=entries.find(e=>e.id===id);
 if(!project) return;
 const p=project;
 const siblings=entries.filter(e=>e.product===p.product&&e.id!==p.id);
 const total=rdNumber(p.total),auto=rdNumber(p.auto),manual=rdNumber(p.manual);
 const autoPct=rdPercentValue(p);
 const manualPct=rdNumber(p.manualPercent);
 const target=p.target&&p.target.label?p.target.label:rdGoalLabel;
 const gap= (total!==null&&auto!==null&&total>0)? Math.max(0,Math.ceil((p.target&&p.target.min? p.target.min : rdGoal.min)*total/100)-auto) : null;
 const assessment=rdPercentValue(p)===null?'--':rdAssessment(p);
 const assessmentBadge=rdPercentValue(p)===null?'<span class="muted">--</span>':rdAssessmentBadge(p);
 const section=(title,rows)=>'<div class="detail-card"><h3>'+esc(title)+'</h3><div class="detail-grid">'+rows.join('')+'</div></div>';
 const row=(label,value)=>'<div class="detail-row"><span class="detail-label">'+esc(label)+'</span><span class="detail-value">'+value+'</span></div>';
 const infoRows=[
  row('STT',rdDetailVal(p.stt)),
  row('Phân loại',rdDetailVal(p.category)),
  row('Sản phẩm',rdDetailVal(p.product)),
  row('Mã dự án',rdDetailVal(p.code)),
  row('Tên dự án',rdDetailVal(p.name)),
  row('Version triển khai',rdDetailVal(p.version)),
  row('Mức độ ưu tiên',p.priority?'<span class="chip chip-'+(String(p.priority).toLowerCase().includes('cao')?'high':String(p.priority).toLowerCase().includes('thấp')?'low':'med')+'">'+esc(p.priority)+'</span>':'<span class="muted">--</span>'),
 ];
 const peopleRows=[
  row('QC chính',splitQcList(p.qcMain).length?rdQcCell(p.qcMain,false):'<span class="muted">--</span>'),
  row('QC phụ trách',splitQcList(p.qcSub).length?rdQcCell(p.qcSub,true):'<span class="muted">--</span>'),
 ];
 const autoRows=[
  row('Tổng case (N)',rdDetailVal(total,true)),
  row('Case đã auto (A)',rdDetailVal(auto,true)),
  row('Case còn manual',rdDetailVal(manual===null&&(total!==null&&auto!==null)?total-auto:manual,true)),
  row('% Automation',autoPct===null?'<span class="muted">--</span>':(rdFormat(autoPct)+'%')),
  row('% Manual',manualPct===null?'<span class="muted">--</span>':(rdFormat(manualPct)+'%')),
  row('Mục tiêu',esc(target)),
  row('Case còn thiếu tới mục tiêu',gap===null?'<span class="muted">--</span>':rdFormat(gap)),
  row('Đánh giá mục tiêu',assessmentBadge),
  '<div class="detail-row detail-full"><span class="detail-label">Tiến độ</span><span class="detail-value">'+(autoPct===null?'<span class="muted">--</span>':rdProgressCell(p))+'</span></div>',
 ];
 const bugRows=[
  row('Bug Manual',rdDetailVal(p.bugManual,true)),
  row('Bug Automation',rdDetailVal(p.bugAuto,true)),
 ];
 const noteRows=[
  row('Ghi chú',p.note?esc(p.note):'<span class="muted">--</span>'),
  row('Việc tiếp theo',p.next?esc(p.next):'<span class="muted">--</span>'),
 ];
 const envText=isKnown(String(p.environment??'').trim())?esc(p.environment):'<span class="muted">--</span>';
 const envRows=[
  row('Môi trường test',envText),
  row('Link hệ thống',rdLinkList(p.systemLink)),
  row('File testcase',rdLinkList(p.testcaseLink)),
  row('Link PSD',rdLinkList(p.psdLink)),
  row('Tài liệu liên quan',rdLinkList(p.relatedDocs)),
  row('Swagger / API',rdLinkList(p.swaggerLink)),
 ];
 const siblingsHtml = siblings.length ? '<div class="detail-card"><h3>Các version khác của sản phẩm</h3><div class="version-list">'+siblings.map(s=>'<div class="version-item"><strong>'+esc(s.name)+'</strong> <small class="muted">'+esc(s.version||'')+'</small><div class="version-chips"><span class="chip chip-low">Tổng: '+(rdNumber(s.total)===null?'--':rdFormat(s.total))+'</span><span class="chip chip-low">Auto: '+(rdNumber(s.auto)===null?'--':rdFormat(s.auto))+'</span><span class="chip chip-low">%: '+(rdPercentValue(s)===null?'--':rdFormat(rdPercentValue(s))+'%')+'</span></div></div>').join('')+'</div></div>' : '';
 const headerHtml='<div class="detail-header"><div><h2>'+esc(p.name)+'</h2><p class="muted">'+esc(p.version||'')+' · '+esc(p.category||'')+'</p><div class="detail-chips">'+(p.priority?'<span class="chip chip-'+(String(p.priority).toLowerCase().includes('cao')?'high':String(p.priority).toLowerCase().includes('thấp')?'low':'med')+'">'+esc(p.priority)+'</span>':'')+' '+assessmentBadge+'</div></div><button type="button" data-action="close" class="primary">Quay lại</button></div>';
 const content=headerHtml+
  section('Thông tin chung',infoRows)+
  section('Nhân sự',peopleRows)+
  section('Automation',autoRows)+
  section('Bug trên Production',bugRows)+
  section('Ghi chú / Việc tiếp theo',noteRows)+
  section('Môi trường & tài liệu kiểm thử',envRows)+
  siblingsHtml+
  '<p class="muted compact" style="margin-top:12px">Cập nhật từ Google Sheets lúc '+esc(rdData.syncedAt?new Date(rdData.syncedAt).toLocaleString('vi-VN'):'')+'.</p>';
 modal(p.name,content,'760px');
}

/* ------------------------------ sự kiện ------------------------------ */
document.addEventListener('click',async event=>{
 const control=event.target.closest('[data-action]');
 if(!control)return;
 const [action,arg]=control.dataset.action.split(':');
 switch(action){
 case 'go':page=arg;render();break;
 case 'rd-detail':rdDetail(arg);break;
 case 'clear-filters':
  for(const key of Object.keys(rdFilters))rdFilters[key]='';
  render();
  break;
 case 'rd-toggle-group':
  if(rdCollapsedGroups.has(arg))rdCollapsedGroups.delete(arg);else rdCollapsedGroups.add(arg);
  render();
  break;
 case 'rd-reset-sort':
  rdSort=null;render();break;
 case 'rd-prev-period':rdReportPeriod=stepReportPeriod(rdReportPeriod,-1);render();break;
 case 'rd-next-period':rdReportPeriod=stepReportPeriod(rdReportPeriod,1);render();break;
 case 'rd-filter-status':rdFilters.reportStatus=arg;render();break;
 case 'rd-open-report':rdOpenReportDrawer(arg);break;
 case 'rd-save-report':{
  const form=document.getElementById('rd-report-form');
  if(!form)break;
  const projectId=form.dataset.project;
  const runVal=form.querySelector('[name="run"]').value.trim();
  const passVal=form.querySelector('[name="pass"]').value.trim();
  const failVal=form.querySelector('[name="fail"]').value.trim();
  const difficulty=form.querySelector('[name="difficulty"]').value.trim();
  const next=form.querySelector('[name="next"]').value.trim();
  const support=form.querySelector('[name="support"]').value.trim();
  const supportWho=form.querySelector('[name="supportWho"]').value.trim();
  const run=runVal===''?null:Number(runVal);
  const pass=passVal===''?null:Number(passVal);
  const fail=failVal===''?null:Number(failVal);
  if(run!==null && (!Number.isFinite(run)||run<0)){notice('Số đã chạy không hợp lệ');break;}
  if(pass!==null && (!Number.isFinite(pass)||pass<0)){notice('Số đạt không hợp lệ');break;}
  if(fail!==null && (!Number.isFinite(fail)||fail<0)){notice('Số lỗi không hợp lệ');break;}
  if(run!==null && pass!==null && fail!==null && pass+fail>run){notice('Đạt + Lỗi không được lớn hơn Đã chạy');break;}
  const p=rdNormalize(rdData).find(x=>x.id===projectId);
  const total=rdNumber(p? p.total : null);
  if(run!==null && total!==null && run>total){notice('Đã chạy không được lớn hơn Tổng case');break;}
  const entry={run,pass,fail,difficulty:difficulty||null,next:next||null,support:support||null,supportWho:supportWho||null,submittedAt:new Date().toISOString(),late:new Date()>periodDeadline(rdReportPeriod)};
  try{await saveReportEntry(rdReportPeriod,projectId,entry);notice('Đã lưu báo cáo');const d=$('dialog');if(d&&d.open)d.close();render();}catch(err){notice(err.message||'Lưu thất bại');}
  break;
 }
 case 'rd-copy-report':rdCopyReport();break;
 case 'close':$('dialog').close();break;
 case 'export':exportPage(arg);break;
 case 'rd-prev-period':rdReportPeriod=stepReportPeriod(rdReportPeriod,-1);render();break;
 case 'rd-next-period':rdReportPeriod=stepReportPeriod(rdReportPeriod,1);render();break;
 case 'rd-filter-status':rdFilters.reportStatus=arg;render();break;
 case 'rd-open-report':rdOpenReportDrawer(arg);break;
 case 'rd-save-report':{
  const form=document.getElementById('rd-report-form');
  if(!form)break;
  const projectId=form.dataset.project;
  const runVal=form.querySelector('[name="run"]').value.trim();
  const passVal=form.querySelector('[name="pass"]').value.trim();
  const failVal=form.querySelector('[name="fail"]').value.trim();
  const difficulty=form.querySelector('[name="difficulty"]').value.trim();
  const next=form.querySelector('[name="next"]').value.trim();
  const support=form.querySelector('[name="support"]').value.trim();
  const supportWho=form.querySelector('[name="supportWho"]').value.trim();
  const run=runVal===''?null:Number(runVal);
  const pass=passVal===''?null:Number(passVal);
  const fail=failVal===''?null:Number(failVal);
  if(run!==null && (!Number.isFinite(run)||run<0)){notice('Số đã chạy không hợp lệ');break;}
  if(pass!==null && (!Number.isFinite(pass)||pass<0)){notice('Số đạt không hợp lệ');break;}
  if(fail!==null && (!Number.isFinite(fail)||fail<0)){notice('Số lỗi không hợp lệ');break;}
  if(run!==null && pass!==null && fail!==null && pass+fail>run){notice('Đạt + Lỗi không được lớn hơn Đã chạy');break;}
  const p=rdNormalize(rdData).find(x=>x.id===projectId);
  const total=rdNumber(p? p.total : null);
  if(run!==null && total!==null && run>total){notice('Đã chạy không được lớn hơn Tổng case');break;}
  const entry={run,pass,fail,difficulty:difficulty||null,next:next||null,support:support||null,supportWho:supportWho||null,submittedAt:new Date().toISOString(),late:new Date()>periodDeadline(rdReportPeriod)};
  try{await saveReportEntry(rdReportPeriod,projectId,entry);notice('Đã lưu báo cáo');const d=$('dialog');if(d&&d.open)d.close();render();}catch(err){notice(err.message||'Lưu thất bại');}
  break;
 }
 case 'rd-copy-report':rdCopyReport();break;
 }
});
document.addEventListener('change',event=>{
 const control=event.target;
 if(control.id==='rd-week'){rdWeek=control.value;render();}
 else if(control.dataset?.filter){rdFilters[control.dataset.filter]=control.value;render();}
});
document.addEventListener('input',event=>{
 const control=event.target;
 if(control.dataset?.filter==='q'){
  rdFilters.q=control.value;
  const pos=event.target.selectionStart;
  render();
  const node=$('rd-search');
  if(node){node.focus();node.setSelectionRange(pos,pos);}
 }
});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'){loadSnapshot();if(FEATURE_WEEKLY_REPORT)loadReports();}
});
/* ------------------------------ tải dữ liệu ------------------------------ */
async function loadSnapshot(){
 const response=await fetch('/api/rd-snapshot',{cache:'no-store'});
 if(!response.ok)throw new Error('HTTP '+response.status);
 const snapshot=await response.json();
 if(snapshot.schemaVersion!==2||!Array.isArray(snapshot.projects)||!snapshot.projects.length)throw new Error('Dữ liệu trả về không đúng schema');
 const changed=snapshot.syncedAt!==rdData?.syncedAt;
 rdData=snapshot;
 if(changed)render();
}
async function loadReports(){
 try{
  const response=await fetch('/api/rd-reports',{cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();
  if(data&&data.periods)rdReportsData=data;
  if(!rdReportPeriod)rdReportPeriod=defaultReportPeriod();
  render();
 }catch{rdReportsData={periods:{}};if(!rdReportPeriod)rdReportPeriod=defaultReportPeriod();}
}
async function saveReportEntry(period,projectId,entry){
 const response=await fetch('/api/rd-reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({period,projectId,entry})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)throw new Error(result.message||'Lưu thất bại');
 if(!rdReportsData.periods)rdReportsData.periods={};
 if(!rdReportsData.periods[period])rdReportsData.periods[period]={entries:{}};
 if(!rdReportsData.periods[period].entries)rdReportsData.periods[period].entries={};
 rdReportsData.periods[period].entries[projectId]=entry;
}
async function manualRefresh(){
 const response=await fetch('/api/refresh',{method:'POST',cache:'no-store'});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)throw new Error(result.message||'Đồng bộ thất bại');
 await loadSnapshot();
 notice('Đã đồng bộ lại từ Google Sheets lúc '+new Date().toLocaleTimeString('vi-VN'));
}
render();
void loadSnapshot().catch(()=>{rdData=rdSeed;render();});
if(FEATURE_WEEKLY_REPORT) void loadReports().catch(()=>{});
setInterval(loadSnapshot,60000);
