import {createArticleEditor, fromGeneratedText, wordDocument} from './editor.js';
const el = id => document.getElementById(id);
const headers = {'Content-Type':'application/json','X-Session':document.querySelector('meta[name=session]').content};
let selected = null, mode = 'file', loading = false, controller = null;
let modelReady = false;
const editor = createArticleEditor(el('draft'), el('formatBar'), () => {
  el('paperState').textContent = '已编辑';
  update();
});
function plainText() { return editor.getText({blockSeparator:'\n\n'}); }
let exporting = false;
function status(text, error=false) {
  el('status').textContent=text; el('status').classList.toggle('error',error);
}
async function post(action, fields={}, signal) {
  const response=await fetch('/api',{method:'POST',headers,body:JSON.stringify({...fields,action}),signal});
  if (!response.ok) throw Error((await response.json()).error || '本机服务暂时无法响应。');
  return response;
}
function update() {
  const busy=loading||Boolean(controller);
  for(const id of ['fileTab','pasteTab','drop','file','history','sample','topic']) el(id).disabled=busy;
  el('generate').hidden=Boolean(controller); el('stop').hidden=!controller;
  el('chooseModel').disabled=busy;
  el('generate').disabled=!modelReady || busy || !(mode==='file'?selected:el('sample').value.trim()) || !el('topic').value.trim();
  el('fileTab').setAttribute('aria-pressed',mode==='file'); el('pasteTab').setAttribute('aria-pressed',mode==='paste');
  el('filePanel').hidden=mode!=='file'; el('pastePanel').hidden=mode!=='paste';
  const generating=Boolean(controller);
  el('draft').hidden=el('formatBar').hidden=generating;
  el('stream').hidden=!generating;
  const text=generating ? el('stream').textContent : plainText();
  el('count').textContent=Array.from(text.replace(/\s/g,'')).length+' 字';
  el('copy').disabled=el('export').disabled=!text.trim()||generating;
  el('exportWord').disabled=el('export').disabled||exporting;
}
function showModel(model) {
  modelReady=model.ready;
  el('chooseModel').textContent=model.ready?'更换模型':'导入模型';
  el('modelState').textContent=model.ready?model.name+' · 已就绪':'首次使用，请选择本机的 GGUF 语言模型。';
}
el('chooseModel').onclick=()=>el('modelFile').click();
el('modelFile').onchange=async event=>{
  const file=event.target.files[0];
  event.target.value='';
  if(!file || loading || controller)return;
  const previous=el('modelState').textContent;
  loading=true;update();status('');
  try{
    if(!file.name.toLowerCase().endsWith('.gguf') || await file.slice(0,4).text()!=='GGUF')
      throw Error('请选择完整的 GGUF 语言模型。');
    const result=await new Promise((resolve,reject)=>{
      const request=new XMLHttpRequest();
      request.open('POST','/model');
      request.setRequestHeader('X-Session',headers['X-Session']);
      request.setRequestHeader('X-Model-Name',encodeURIComponent(file.name));
      request.responseType='json';
      request.upload.onprogress=e=>{
        if(e.lengthComputable)el('modelState').textContent='正在复制模型 '+Math.floor(100*e.loaded/e.total)+'%';
      };
      request.upload.onload=()=>{el('modelState').textContent='正在验证模型能否在本机生成文字…';};
      request.onload=()=>request.status===200 && request.response?.ready?resolve(request.response):
        reject(Error(request.response?.error || '模型导入失败。'));
      request.onerror=()=>reject(Error('本地导入中断，请检查磁盘空间后重试。'));
      el('modelState').textContent='正在复制模型…';
      request.send(file);
    });
    showModel(result);status('模型已保存到本机。');
  }catch(error){el('modelState').textContent=previous;status(error.message,true);}
  finally{loading=false;update();}
};
function setSample(doc) {
  selected=doc;
  el('fileTitle').textContent=doc.title; el('fileMeta').textContent=Array.from(doc.body).length+' 字 · 点击更换';
  el('history').value=doc.id; el('sourceText').textContent=doc.body;
  el('preview').hidden=false; el('preview').open=false;
}
function addOption(row) {
  const option=new Option(row.title,String(row.id));
  el('history').add(option,1); el('historyLabel').hidden=false;
}
async function upload(file) {
  if(!file||loading||controller)return;
  loading=true;update();status('正在本机读取范文…');
  try {
    if(!/\.(docx|md|txt)$/i.test(file.name))throw Error('请选择 DOCX、TXT 或 Markdown 范文。');
    if(!file.size||file.size>8*1024**2)throw Error('请选择有正文、大小不超过 8 MB 的文件。');
    const encoded=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result.split(',')[1]);
      reader.onerror=()=>reject(Error('文件读取失败，请重新选择。'));reader.readAsDataURL(file);
    });
    const doc=await (await post('import',{name:file.name,data:encoded})).json();
    if(![...el('history').options].some(o=>o.value===String(doc.id)))addOption(doc);
    setSample(doc);status('范文已就绪。');
  } catch(error){status(error.message,true);}
  finally{loading=false;update();}
}
el('drop').onclick=()=>el('file').click();
el('file').onchange=e=>{const f=e.target.files[0];e.target.value='';upload(f);};
for(const ev of ['dragover','dragleave','drop'])el('drop').addEventListener(ev,e=>{
  e.preventDefault();el('drop').classList.toggle('drag',ev==='dragover');
  if(ev==='drop')upload(e.dataTransfer.files[0]);
});
for(const [id,value] of [['fileTab','file'],['pasteTab','paste']])el(id).onclick=()=>{
  mode=value;status('');update();if(mode==='paste')el('sample').focus();
};
el('history').onchange=async()=>{
  if(!el('history').value){el('history').value=selected?.id||'';return;}
  loading=true;update();
  try{const id=el('history').value;setSample({id,...await (await post('sample',{id})).json()});status('已选用范文。');}
  catch(error){el('history').value=selected?.id||'';status(error.message,true);}
  finally{loading=false;update();}
};
for(const id of ['sample','topic'])el(id).oninput=()=>{status('');update();};
el('stop').onclick=()=>controller?.abort();

el('generate').onclick=async()=>{
  if(el('generate').disabled || controller)return;
  const previous=!editor.isEmpty, previousState=el('paperState').textContent;
  if(previous&&!confirm('重新仿写将替换当前新稿。继续吗？'))return;
  controller=new AbortController();
  let finished=false;
  const stream=el('stream');
  stream.textContent='';editor.setEditable(false,false);el('paperState').textContent='准备起草';status('正在连接本地模型…');update();
  try{
    const reference=mode==='file'?{id:selected.id}:{sample:el('sample').value.trim()};
    const response=await post('generate',{...reference,topic:el('topic').value.trim()},controller.signal);
    const reader=response.body.getReader(), decoder=new TextDecoder();
    let pending='';
    function accept(line){
      if(!line.trim())return;
      const {type,value}=JSON.parse(line);
      if(type==='stage'){el('paperState').textContent=value;status(value+'…');}
      if(type==='text'){stream.append(document.createTextNode(value));stream.scrollTop=stream.scrollHeight;update();}
      if(type==='error')throw Error(value);
      if(type==='done'){finished=true;status(value);}
    }
    while(true){
      const {value,done}=await reader.read();pending+=decoder.decode(value,{stream:!done});
      const lines=pending.split('\n');pending=lines.pop();
      lines.forEach(accept);
      if(done){accept(pending);break;}
    }
    if(!finished||!stream.textContent.trim())throw Error('未收到完整新稿，请重试。');
    editor.commands.setContent(fromGeneratedText(stream.textContent),{emitUpdate:false});
    el('paperState').textContent='可编辑';el('draft').scrollTop=0;
  }catch(error){
    if(!previous && stream.textContent.trim())editor.commands.setContent(fromGeneratedText(stream.textContent),{emitUpdate:false});
    const stopped=controller.signal.aborted;
    const prefix=stopped?'已停止。':(error.message+' ');
    status(prefix+(previous?'已保留上次新稿。':stream.textContent?'已保留生成的部分。':''),!stopped);
    el('paperState').textContent=previous?previousState:(stream.textContent?'部分新稿':'等待起草');
  }finally{controller=null;editor.setEditable(true,false);stream.textContent='';update();}
};
el('copy').onclick=async()=>{
  try{
    if(navigator.clipboard?.write && window.ClipboardItem){
      const formats={'text/plain':new Blob([plainText()],{type:'text/plain'}),'text/html':new Blob([editor.getHTML()],{type:'text/html'})};
      await navigator.clipboard.write([new ClipboardItem(formats)]);
    }else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(plainText());
    else{editor.chain().focus().selectAll().run();if(!document.execCommand('copy'))throw Error();}
    status('已复制新稿。');
  }catch{editor.chain().focus().selectAll().run();status('已选中新稿，可按 ⌘C 或 Ctrl+C 复制。');}
};
function fileName(){
  return plainText().trim().split('\n')[0].slice(0,48).replace(/[<>:"/\\|?*\x00-\x1f]/g,'').trim().replace(/[. ]+$/,'')||'仿写新稿';
}
function download(blob,name){
  const url=URL.createObjectURL(blob), link=document.createElement('a');
  link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
el('export').onclick=()=>download(new Blob(['\uFEFF',plainText()],{type:'text/plain;charset=utf-8'}),fileName()+'.txt');
el('exportWord').onclick=async()=>{
  const name=fileName()+'.docx';
  exporting=true;update();
  try{download(await wordDocument(editor.getJSON()),name);}
  catch{status('Word 文档生成失败，请重试。',true);}
  finally{exporting=false;update();}
};
(async()=>{
  loading=true;update();
  try{showModel(await (await post('modelStatus')).json());}
  catch{el('modelState').textContent='未能读取本机模型，可重新导入。';}
  try{const rows=await (await post('history')).json();rows.reverse().forEach(addOption);el('history').value='';}
  catch{status('曾用范文暂时无法读取，仍可粘贴正文。',true);}
  finally{loading=false;update();}
})();
