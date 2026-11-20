'use strict';
const el=id=>document.getElementById(id);
const labels={library:'知识库',write:'公文起草',qa:'资料问答',talk:'谈话助手',proof:'核文校对',tables:'表格管理',bio:'干部信息提取分析',guide:'生活指南',vision:'图片问答'};
const prompts={qa:'问题（检索知识库中的资料）',talk:'谈话目的、背景或已有记录',proof:'粘贴需要校对的原文',bio:'粘贴需要核对的履历材料',guide:'生活目标、预算或想解决的问题',vision:'向图片提问'};
function make(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
async function api(action,args={}){
 const res=await fetch('./api',{method:'POST',headers:{'Content-Type':'application/json','X-Session':document.querySelector('meta[name=session]').content},body:JSON.stringify({...args,action})});
 const json=await res.json();if(!res.ok)throw Error(json.error||'请求失败');return json.result;
}
let busy=false;
async function work(message,fn,done="已完成"){
 if(busy)return;busy=true;el('status').textContent=message;
 const old=[...document.querySelectorAll('button,input,select,textarea')].filter(n=>!n.disabled);
 old.forEach(n=>n.disabled=true);
 try{await fn();el('status').textContent=done;}catch(e){el('status').textContent=e.message;}
 finally{old.forEach(n=>n.disabled=false);busy=false;if(active()!==view)render();}
}
function detail(title,text){const d=make('details');d.append(make('summary',title),make('pre',text));return d;}
function sources(id,rows){const box=el(id);box.replaceChildren();if(!rows.length){box.append(make('small','没有检索到相关资料。'));return;}
 rows.forEach((r,i)=>box.append(detail('S'+(i+1)+' · '+r.title+' · 第 '+(r.start+1)+' 字起',r.body)));}
async function dataURL(file){return await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(Error('读取文件失败'));r.readAsDataURL(file);});}
async function fileText(f){if(f.size>8*1024**2)throw Error('文件上限为 8 MB。');return api('import',{name:f.name,data:(await dataURL(f)).split(',')[1]});}
function saveFile(name,text,type){const u=URL.createObjectURL(new Blob([text],{type}));const a=make('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);}
const nav=document.querySelector('nav');
for(const [id,label] of Object.entries(labels)){const a=make('a',label);a.href='#'+id;nav.append(a);}
const active=()=>Object.hasOwn(labels,location.hash.slice(1))?location.hash.slice(1):'library';
let view='',evidence=[],picture='',sheetId=0,grid=[['',''],['','']],page=0;
function render(){
 if(busy)return;view=active();nav.querySelectorAll('a').forEach(a=>a.classList.toggle('active',a.hash==='#'+view));
 const panel=['library','write','tables'].includes(view)?view:'tool';
 for(const id of ['library','write','tables','tool'])el(id).hidden=id!==panel;
 if(panel==='tool'){el('toolTitle').textContent=labels[view];el('toolLabel').textContent=prompts[view];el('input').value=view==='vision'?'请用中文描述这张图片。':'';el('input').maxLength=['vision','qa','guide'].includes(view)?700:3000;el('imagePanel').hidden=view!=='vision';el('result').textContent='';el('toolSources').replaceChildren();}
}
window.addEventListener('hashchange',render);
async function refreshDocs(){
 const rows=await api('list'),oldStyle=el('style').value;
 el('style').replaceChildren(new Option('通用写作（可在知识库添加范文）',''));el('docs').replaceChildren();
 for(const row of rows){
   if(row.role==='范文')el('style').add(new Option(row.title,row.id));
   const d=make('details');d.append(make('summary',row.role+' · '+row.title+'（'+row.size+'字）'));
   d.ontoggle=async()=>{if(!d.open||d.childElementCount>1)return;try{const r=await api('doc',{id:row.id});d.append(make('pre',r.body));if(row.role==='范文'){const use=make('button','用这篇范文写新稿');use.onclick=()=>{el('style').value=row.id;location.hash='write';};d.append(use);}const b=make('button','删除此文','minor');b.onclick=()=>{if(confirm('删除《'+row.title+'》及其检索索引？'))work('正在删除…',async()=>{await api('deleteDoc',{id:row.id});await refreshDocs();});};d.append(b);}catch(e){el('status').textContent=e.message;}};
   el('docs').append(d);
 }
 if([...el('style').options].some(o=>o.value===oldStyle))el('style').value=oldStyle;
 if(!rows.length)el('docs').textContent='还没有材料。可分别存入事实资料和风格范文。';
}
el('pickStyle').onclick=()=>el('importStyle').click();
el('importStyle').onchange=event=>{
 const input=event.target,file=input.files[0];
 input.value='';
 if(!file)return;
 work('正在读取范文…',async()=>{
   if(!/\.(docx|txt|md)$/i.test(file.name))throw Error('请选择 .docx、.txt 或 .md 范文文件。');
   if(!file.size)throw Error('范文文件为空，请选择有正文的文章。');
   const body=await fileText(file);
   if(!body.trim())throw Error('未读到文章正文，请选择包含文字的范文。');
   if(body.trim().length>500000)throw Error('范文超过 50 万字，请选取需要仿写的章节。');
   const title=file.name.replace(/\.[^.]+$/,'').trim().slice(0,160)||'未命名范文';
   const id=await api('saveDoc',{title,body,role:'范文'});
   await refreshDocs();
   el('style').value=String(id);
 },'已选用《'+file.name+'》，可输入新文章主题。');
};
el('importDoc').onchange=e=>{const f=e.target.files[0];if(f)work('读取文档…',async()=>{el('body').value=await fileText(f);el('title').value=f.name.replace(/\.[^.]+$/,'');e.target.value='';});};
el('saveDoc').onclick=()=>work('存入知识库并分段…',async()=>{const role=el('role').value;const id=await api('saveDoc',{role,title:el('title').value,body:el('body').value});el('title').value='';el('body').value='';await refreshDocs();if(role==='范文')el('style').value=id;});
el('search').onclick=()=>work('检索中…',async()=>sources('hits',await api('search',{query:el('searchQuery').value,role:el('searchRole').value})));
el('compose').onclick=()=>{if(el('draft').value&&!confirm('用新生成的内容替换当前草稿？'))return;work('正在检索资料、分析范文并在本机起草…',async()=>{
 const r=await api('write',{topic:el('topic').value,style:el('style').value});evidence=r.sources;el('draft').value=r.draft;el('profile').replaceChildren();if(r.profile)el('profile').append(detail('本次采用的风格特征',r.profile));sources('sources',evidence);el('review').replaceChildren();if(r.warnings.length)el('review').append(make('h2','生成后待核'),make('pre',r.warnings.join('\n')));});};
el('check').onclick=()=>work('正在检查引用、相似句和事实依据…',async()=>{
 if(!el('draft').value.trim())throw Error('请先生成或粘贴草稿。');
 if(!evidence.length){evidence=await api('search',{query:(el('topic').value||el('draft').value).slice(0,650),role:'资料'});evidence=evidence.slice(0,4);sources('sources',evidence);}
 const r=await api('review',{draft:el('draft').value,style:el('style').value,sources:evidence.map(s=>s.id)});
 el('review').replaceChildren(make('h2','规则检查'),make('pre',r.issues.join('\n')||'未触发数字、来源编号或连续重合提示。'),make('h2','模型复核 · 请对照原文'),make('pre',r.report));});
el('draft').oninput=()=>el('review').replaceChildren();
el('exportDraft').onclick=()=>{if(el('draft').value)saveFile('文章草稿.txt',el('draft').value+'\n\n'+evidence.map((s,i)=>'S'+(i+1)+' '+s.title+'（第'+(s.start+1)+'字起）：'+s.body).join('\n'),'text/plain;charset=utf-8');};
el('image').onchange=e=>{const f=e.target.files[0];if(f)work('读取图片…',async()=>{if(f.size>16*1024**2||!['image/png','image/jpeg'].includes(f.type))throw Error('请选择 16 MB 以内的 PNG/JPEG。');picture=await dataURL(f);el('preview').src=picture;el('preview').hidden=false;});};
el('run').onclick=()=>work('正在本机处理…',async()=>{if(view==='vision'&&!picture)throw Error('请先选图。');const r=await api(view,{text:el('input').value,image:view==='vision'?picture:undefined});el('result').textContent=r.answer;el('toolSources').replaceChildren();if(r.sources)sources('toolSources',r.sources);});
function drawTable(){
 const cols=Math.max(1,...grid.map(r=>r.length)),size=30;
 page=Math.min(Math.max(0,page),Math.floor((grid.length-1)/size));
 const table=make('table');
 grid.slice(page*size,(page+1)*size).forEach((r,j)=>{
   const tr=make('tr');tr.append(make('th',page*size+j+1));
   for(let col=0;col<cols;col++){const td=make('td'),input=make('input');input.value=r[col]||'';input.setAttribute('aria-label','第'+(size*page+j+1)+'行第'+(col+1)+'列');input.oninput=()=>{while(r.length<=col)r.push('');r[col]=input.value;};td.append(input);tr.append(td);}
   const td=make('td'),del=make('button','删行','minor');del.onclick=()=>{grid.splice(page*size+j,1);if(!grid.length)grid=[['']];drawTable();};td.append(del);tr.append(td);table.append(tr);
 });el('grid').replaceChildren(table);el('page').textContent=(page+1)+' / '+Math.ceil(grid.length/size);
}
async function refreshSheets(){
 const sheets=await api('tables');el('sheets').replaceChildren(new Option('选择已保存的表格',''));
 for(const r of sheets)el('sheets').add(new Option(r.title,r.id));el('sheets').value=String(sheetId||'');
}
function blankTable(){sheetId=0;page=0;grid=[['',''],['','']];el('tableName').value='';el('sheets').value='';drawTable();}
el('newTable').onclick=blankTable;
el('sheets').onchange=()=>{const id=el('sheets').value;if(!id)return blankTable();work('读取表格…',async()=>{const r=await api('getTable',{id});sheetId=r.id;grid=r.grid;page=0;el('tableName').value=r.title;drawTable();});};
el('prev').onclick=()=>{page--;drawTable();};el('next').onclick=()=>{page++;drawTable();};
el('addRow').onclick=()=>{if(grid.length>=2000)return;grid.push(['']);page=Math.floor((grid.length-1)/30);drawTable();};
el('addCol').onclick=()=>{const w=Math.max(...grid.map(r=>r.length));if(w>=64)return;for(const r of grid)while(r.length<=w)r.push('');drawTable();};
el('saveTable').onclick=()=>work('保存表格…',async()=>{sheetId=await api('saveTable',{id:sheetId,title:el('tableName').value,grid});await refreshSheets();});
el('delTable').onclick=()=>{if(sheetId&&confirm('删除这个已保存的表格？'))work('删除表格…',async()=>{await api('deleteTable',{id:sheetId});blankTable();await refreshSheets();});};
el('importTable').onchange=e=>{const f=e.target.files[0];if(f)work('导入表格…',async()=>{const data=await api('parseTable',{text:await fileText(f),format:f.name.toLowerCase().endsWith('.tsv')?'tsv':'csv'});blankTable();el('tableName').value=f.name;grid=data;drawTable();e.target.value='';});};
el('exportTable').onclick=()=>saveFile((el('tableName').value||'表格')+'.csv','\uFEFF'+grid.map(r=>r.map(v=>'"'+v.replace(/"/g,'""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8');
render();drawTable();Promise.all([refreshDocs(),refreshSheets()]).catch(e=>el('status').textContent=e.message);
