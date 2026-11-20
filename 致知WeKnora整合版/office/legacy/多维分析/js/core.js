/* ============================================================
   core.js — 多维分析 外壳基础工具函数
   （从 03--表格管理 抽取记录模块所需的最小依赖：轻提示、
     文本转义、单元格高亮、时间戳、文件读取、菜单箭头显隐）
   ============================================================ */

// ---------------- 轻提示浮窗 ----------------
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2200);
}

// ---------------- 文本工具 ----------------
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function cellText(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\r\n/g, '\n');
}

// 单元格文本 → 高亮 HTML（命中关键字包 <span class="cell-hl">）
function hlCellText(v, subs) {
  const s = cellText(v);
  if (!s) return '';
  if (!subs || !subs.length) return escapeHtml(s);
  const lower = s.toLowerCase();
  const ranges = [];
  subs.forEach(function(k){
    const kl = k.toLowerCase();
    let pos = 0;
    while ((pos = lower.indexOf(kl, pos)) >= 0) {
      ranges.push([pos, pos + kl.length]);
      pos += kl.length ? kl.length : 1;
    }
  });
  ranges.sort(function(a, b){ return a[0] - b[0] || a[1] - b[1]; });
  const merged = [];
  ranges.forEach(function(r){
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) { if (r[1] > last[1]) last[1] = r[1]; }
    else merged.push(r.slice());
  });
  let html = '', idx = 0;
  merged.forEach(function(r){
    html += escapeHtml(s.slice(idx, r[0]));
    html += '<span class="cell-hl">' + escapeHtml(s.slice(r[0], r[1])) + '</span>';
    idx = r[1];
  });
  html += escapeHtml(s.slice(idx));
  return html;
}

// ---------------- 时间 ----------------
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function timestampNow() {
  const d = new Date();
  return d.getFullYear() + pad2(d.getMonth()+1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes());
}
// 解析日期字符串为 {y,m,d}（y 可为 null 表示缺省年份）
function parseDateParts(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) return { y: +m[1], m: +m[2], d: 1 };
  m = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = s.match(/^(\d{4})年(\d{1,2})月?$/);
  if (m) return { y: +m[1], m: +m[2], d: 1 };
  m = s.match(/^(\d{1,2})月(\d{1,2})日?$/);
  if (m) return { y: null, m: +m[1], d: m[2] !== undefined ? +m[2] : null };
  m = s.match(/^(\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) { let y = +m[1]; if (y < 100) y += y < 50 ? 2000 : 1900; return { y: y, m: +m[2], d: +m[3] }; }
  return null;
}

// ---------------- 检索式解析（空格=或，- =且） ----------------
function parseSearchQuery(q) {
  q = (q || '').trim();
  if (!q) return [];
  return q.split(/\s+/).filter(Boolean).map(function(t){ return t.split('-').filter(Boolean); });
}

// ---------------- 文件读取（自动识别 UTF-8 / UTF-16 / GBK） ----------------
function readFileAsText(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const buf = e.target.result;
      const bytes = new Uint8Array(buf);
      let text;
      if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) text = new TextDecoder('utf-16le').decode(buf);
      else if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) text = new TextDecoder('utf-16be').decode(buf);
      else if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) text = new TextDecoder('utf-8').decode(bytes.subarray(3));
      else {
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
        } catch(err) {
          try { text = new TextDecoder('gbk').decode(buf); }
          catch(err2) { text = new TextDecoder('utf-8').decode(buf); }
        }
      }
      resolve(text);
    };
    reader.onerror = function() { reject(reader.error); };
    reader.readAsArrayBuffer(file);
  });
}

// ---------------- 菜单箭头显隐（三级区有内容才显示箭头） ----------------
function updateMenuArrows() {
  const t3 = document.getElementById('opTier3');
  const arrowOp = document.getElementById('arrowOp');
  const hasT3 = t3 && !t3.classList.contains('hidden') && t3.innerHTML.trim() !== '';
  if (arrowOp) arrowOp.style.display = hasT3 ? '' : 'none';
  const rt3 = document.getElementById('recTier3');
  const arrowRec = document.getElementById('arrowRec');
  const hasRT3 = rt3 && !rt3.classList.contains('hidden') && rt3.innerHTML.trim() !== '';
  if (arrowRec) arrowRec.style.display = hasRT3 ? '' : 'none';
}
