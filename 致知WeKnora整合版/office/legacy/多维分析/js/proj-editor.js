/* js/proj-editor.js — 第65轮：项目编辑窗的记事本工具栏 / 右键菜单 / 标题栏保存
   工具栏按钮：文字/段落/层级/目录/格式/跳转/缩放/粘入/复制/清空；
   标题栏左侧项目名 + 右侧「保存」；正文日期链接统一深蓝（见 record.js REC_LINK_COLOR）。 */
(function () {
  'use strict';

  var DA_LEVELS = [
    ['索引标题', 'h1'], ['文章标题', 'title'], ['作者/日期', 'center'],
    ['主送单位', 'recipient'], ['一级标题', 'h1'], ['二级标题', 'h2'],
    ['三级标题', 'h3'], ['正文', 'body'], ['注释', 'remark'],
    ['密级/附件', 'secret'], ['附件', 'attach']
  ];
  var DA_EXTRA = {
    recipient: 'margin:0;line-height:1.8;font-family:仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif;font-size:16px;text-align:left;text-indent:0;',
    attach: 'margin:0;line-height:1.8;font-family:仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif;font-size:16px;text-align:left;text-indent:0;'
  };
  var DA_FONTS = [['黑体', '黑体,SimHei,sans-serif'], ['楷体', '楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif'],
    ['仿宋', '仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif'], ['小标宋', '方正小标宋简体,FZXiaoBiaoSong,SimSun,serif']];
  var DA_SIZES = [12, 14, 16, 20, 22];

  var CSS = [
    '.rec-proj-win > .rec-proj-win-head { justify-content:flex-start !important; padding-left:26px; padding-right:8px; color:#fff !important; }',
    '.rec-proj-win-head .rec-proj-win-dot { box-shadow:0 0 0 2px rgba(255,255,255,.75); }',
    '.rp-head-actions { margin-left:auto; flex:0 0 auto; display:flex; align-items:center; gap:6px; }',
    '.rp-head-btn { flex:0 0 auto; font:12px/1.6 "SimHei","黑体",sans-serif; color:#fff;',
    '  background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.55); border-radius:5px; padding:2px 12px; cursor:pointer; }',
    '.rp-head-btn:hover { background:rgba(255,255,255,.32); }',
    '.rec-proj-win > .rec-proj-toolbar { flex:0 0 auto !important; display:flex; flex-wrap:wrap; gap:3px; padding:4px 6px; background:#fff;',
    '  border-bottom:1px solid #eef1f5; }',
    '.rp-btn { flex:0 0 auto; font:12px "SimHei","黑体",sans-serif; color:#37474f; background:#f4f7fb;',
    '  border:1px solid #d7e2ee; border-radius:5px; padding:2px 7px; cursor:pointer; line-height:1.5; }',
    '.rp-btn:hover { background:#e8f1fb; border-color:#9cc4e8; }',
    '.rp-btn.on { background:#dcecff; border-color:#7fb6ee; }',
    '.rp-menu { position:fixed; z-index:10060; background:#fff; border:1px solid #cfd8e3; border-radius:8px;',
    '  box-shadow:0 10px 28px rgba(15,40,80,.22); padding:4px; min-width:158px; max-height:60vh; overflow:auto;',
    '  font:13px "SimSun","宋体",serif; }',
    '.rp-mi { padding:5px 12px; border-radius:5px; cursor:pointer; white-space:nowrap; color:#2c3e50; }',
    '.rp-mi:hover { background:#e8f1fb; }',
    '.rp-grp { font:11px "SimHei","黑体",sans-serif; color:#90a4ae; padding:5px 12px 2px; }',
    '.rp-sep { height:1px; background:#eef1f5; margin:4px 6px; }',
    '.rec-proj-win-body p { border-bottom:1px solid var(--line,#e3e8ef); padding-bottom:6px; margin:0 0 5px; }',
    '.rec-proj-win-body p:last-child { border-bottom-color:transparent; }',
    '.rec-proj-win-body .rec-tl-link { color:#0D47A1 !important; text-decoration:underline !important;',
    '  text-decoration-color:#0D47A1 !important; text-underline-offset:2px; }',
    '.rec-proj-win-body .rec-tl-link.flash { background:rgba(13,71,161,.18) !important; border-radius:2px; }',
    '.rec-proj-win { position:relative; }',
    '.rp-zoom { position:absolute; right:14px; bottom:14px; z-index:6; display:flex; align-items:center; gap:2px;',
    '  background:rgba(255,255,255,.92); border:1px solid #d7e2ee; border-radius:16px; padding:2px 4px;',
    '  box-shadow:0 2px 10px rgba(15,40,80,.14); opacity:.62; transition:opacity .15s; }',
    '.rp-zoom:hover { opacity:1; }',
    '.rp-zoom-btn { width:24px; height:24px; line-height:1; border:none; background:transparent; cursor:pointer;',
    '  border-radius:50%; color:#3a4a5c; font:15px/1 "SimSun","宋体",serif; }',
    '.rp-zoom-btn:hover { background:#e6f0fb; color:#0D47A1; }',
    '.rp-zoom-val { min-width:42px; text-align:center; font:12px/1.6 "SimHei","黑体",sans-serif; color:#5b6b7c; cursor:pointer; user-select:none; }',
    '.rp-zoom-val:hover { color:#0D47A1; }'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('daProjStyle')) return;
    var s = document.createElement('style');
    s.id = 'daProjStyle';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------- 基础定位 ----------
  function cardOf(el) {
    if (!el) return null;
    return el.closest ? el.closest('.rec-proj-win') : null;
  }
  function bodyOf(el) {
    var c = cardOf(el);
    return c ? c.querySelector('.rec-proj-win-body') : null;
  }
  function nameOf(el) {
    var c = cardOf(el);
    return c ? (c.getAttribute('data-proj') || '') : '';
  }
  function colorOf(name) {
    try { return recProjColor(name); } catch (e) { return '#0D47A1'; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
  }

  // ---------- 工具栏 / 标题栏保存 ----------
  // 第68轮：工具栏只留文字/段落/层级/格式/跳转（目录、缩放、粘入、复制、清空见标题栏）
  function toolbarHtml() {
    var labels = [['文字', 'text'], ['段落', 'para'], ['层级', 'level'], ['格式', 'format'], ['跳转', 'jump']];
    return labels.map(function (it) {
      return '<button class="rp-btn" onclick="daProjCmd(this,\'' + it[1] + '\')">' + it[0] + ' ▾</button>';
    }).join('');
  }
  // 标题栏右侧：粘入 / 复制 / 清空 / 导出 / 保存（整体右对齐）
  function headActionsHtml() {
    return '<div class="rp-head-actions">' +
      '<button class="rp-head-btn" type="button" onclick="daProjCmd(this,\'paste\')" title="粘入正文">粘入</button>' +
      '<button class="rp-head-btn" type="button" onclick="daProjCmd(this,\'copy\')" title="复制全文">复制</button>' +
      '<button class="rp-head-btn" type="button" onclick="daProjCmd(this,\'clear\')" title="清空正文">清空</button>' +
      '<button class="rp-head-btn" type="button" onclick="daProjExport(this)" title="导出本篇为 Word 文档">导出</button>' +
      '<button class="rp-head-btn" type="button" onclick="daProjSave(this)" title="保存到主题文件">保存</button>' +
      '</div>';
  }
  function mount(root) {
    if (!root || !root.querySelectorAll) return;
    var host = root.classList && root.classList.contains('rec-proj-win') ? [root] : root.querySelectorAll('.rec-proj-win');
    Array.prototype.forEach.call(host, function (card) {
      var bar = card.querySelector('.rec-proj-toolbar');
      if (bar && !bar.__daFilled) { bar.innerHTML = toolbarHtml(); bar.__daFilled = true; }
      // 底栏已取消；粘入/复制/清空/导出/保存全部挂到标题栏右侧
      var foot = card.querySelector('.rec-proj-foot');
      if (foot && foot.parentNode) foot.parentNode.removeChild(foot);
      var head = card.querySelector('.rec-proj-win-head');
      if (head && !head.querySelector('.rp-head-actions')) {
        var wrap = document.createElement('div');
        wrap.innerHTML = headActionsHtml();
        head.appendChild(wrap.firstChild);
      }
      if (!card.querySelector('.rp-zoom')) {
        var z = document.createElement('div');
        z.className = 'rp-zoom';
        z.innerHTML = '<button class="rp-zoom-btn" type="button" title="缩小正文" data-z="-1">−</button>' +
          '<span class="rp-zoom-val" title="点击恢复 100%">' + zoomPct() + '</span>' +
          '<button class="rp-zoom-btn" type="button" title="放大正文" data-z="1">＋</button>';
        z.addEventListener('click', function (ev) {
          var b = ev.target.closest ? ev.target.closest('.rp-zoom-btn') : null;
          if (b) { ev.preventDefault(); applyZoom(parseInt(b.getAttribute('data-z'), 10) || 0); return; }
          if (ev.target.classList && ev.target.classList.contains('rp-zoom-val')) { ev.preventDefault(); applyZoom(0); }
        });
        card.appendChild(z);
      }
      var body = card.querySelector('.rec-proj-win-body');
      if (body && !body.__daCtxBound2) {
        body.__daCtxBound2 = true;
        body.addEventListener('contextmenu', function (e) { daProjContextMenu(e, body); });
        body.addEventListener('keydown', function (e) {
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
            e.preventDefault();
            if (typeof recProjectAutoRecognize === 'function') recProjectAutoRecognize();
          }
        });
      }
    });
  }

  // ---------- 菜单 ----------
  var menuEl = null;
  function closeMenu() {
    if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
    menuEl = null;
  }
  function showMenu(x, y, items) {
    closeMenu();
    var m = document.createElement('div');
    m.className = 'rp-menu';
    // 第68轮：只有一层分组的菜单不再显示那行注释（如「段落」「层级」），菜单里只剩可点的项
    var grpNames = {};
    items.forEach(function (it) { if (it && it.grp) grpNames[it.grp] = 1; });
    var hideGrp = Object.keys(grpNames).length <= 1;
    items.forEach(function (it) {
      if (it === '-') {
        var sep = document.createElement('div'); sep.className = 'rp-sep'; m.appendChild(sep); return;
      }
      if (it.grp) {
        if (hideGrp) return;
        var g = document.createElement('div'); g.className = 'rp-grp'; g.textContent = it.grp; m.appendChild(g); return;
      }
      var d = document.createElement('div');
      d.className = 'rp-mi';
      d.textContent = it.t;
      d.__act = it;
      m.appendChild(d);
    });
    document.body.appendChild(m);
    var w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(x, window.innerWidth - w - 6)) + 'px';
    m.style.top = Math.max(4, Math.min(y, window.innerHeight - h - 6)) + 'px';
    m.onclick = function (e) {
      var t = e.target;
      while (t && t !== m && !t.__act) t = t.parentNode;
      if (!t || t === m || !t.__act) return;
      var act = t.__act;
      closeMenu();
      if (act.run) act.run();
    };
    menuEl = m;
    setTimeout(function () {
      document.addEventListener('mousedown', function hide(ev) {
        if (menuEl && !menuEl.contains(ev.target)) { closeMenu(); }
        document.removeEventListener('mousedown', hide);
      });
    }, 0);
    return m;
  }

  // ---------- 块解析 / 段落化 ----------
  function collectBlocks(box) {
    var out = [], buf = '';
    function flush() {
      if (buf.replace(/[\s\u3000]/g, '')) out.push({ html: buf, style: '', level: '' });
      buf = '';
    }
    Array.prototype.forEach.call(box.childNodes, function (n) {
      if (n.nodeType === 1 && n.tagName === 'BR') { flush(); return; }
      if (n.nodeType === 1 && /^(P|DIV|H1|H2|H3)$/.test(n.tagName)) {
        flush();
        out.push({ html: n.innerHTML, style: n.getAttribute('style') || '', level: n.getAttribute('data-level') || '' });
        return;
      }
      if (n.nodeType === 1) { buf += n.outerHTML; return; }
      buf += esc(n.textContent || '');
    });
    flush();
    return out;
  }

  function paraStyle(kind) {
    var key = 'body';
    for (var i = 0; i < DA_LEVELS.length; i++) if (DA_LEVELS[i][0] === kind) key = DA_LEVELS[i][1];
    if (DA_EXTRA[key]) return DA_EXTRA[key];
    try { if (REC_FMT[key]) return REC_FMT[key]; } catch (e) {}
    return '';
  }

  // 把正文统一成 <p> 段落：已有 <p> 保留原样式，零散文字按「正文」补齐
  function ensureParas(box) {
    if (!box) return false;
    var blocks = collectBlocks(box);
    if (!blocks.length) return false;
    var need = blocks.some(function (b) { return !b.style; });
    if (!need) return true;
    box.innerHTML = blocks.map(function (b) {
      var st = b.style || paraStyle('正文');
      return '<p style="' + st + '"' + (b.level ? ' data-level="' + esc(b.level) + '"' : '') + '>' + b.html + '</p>';
    }).join('');
    return true;
  }

  // 选区覆盖的段落；无选区取光标所在段；再退到第一段
  function targetParas(box) {
    var ps = Array.prototype.slice.call(box.querySelectorAll('p'));
    if (!ps.length) return [];
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return [ps[0]];
    var r = sel.getRangeAt(0);
    if (!box.contains(r.commonAncestorContainer)) return [ps[0]];
    var hit = ps.filter(function (p) { return r.intersectsNode(p); });
    if (hit.length) return hit;
    var node = r.startContainer;
    var p = node.nodeType === 1 ? node.closest('p') : (node.parentNode && node.parentNode.closest('p'));
    return p ? [p] : [ps[0]];
  }

  // 在选区两端插标记，段落化重建后仍能找到原段落（修复「必须选中整段才生效」）
  function insertSelMarks(box) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var r = sel.getRangeAt(0);
    if (!box.contains(r.commonAncestorContainer)) return null;
    var s = document.createElement('span');
    s.setAttribute('data-da-sel', 's');
    var e = document.createElement('span');
    e.setAttribute('data-da-sel', 'e');
    var rs = r.cloneRange(); rs.collapse(true); rs.insertNode(s);
    var re = r.cloneRange(); re.collapse(false); re.insertNode(e);
    return true;
  }
  function findMarkedParas(box) {
    var s = box.querySelector('[data-da-sel="s"]');
    var e = box.querySelector('[data-da-sel="e"]');
    var ps = Array.prototype.slice.call(box.querySelectorAll('p'));
    var out = [];
    ps.forEach(function (p) { if ((s && p.contains(s)) || (e && p.contains(e))) out.push(p); });
    if (out.length) {
      var i0 = ps.indexOf(out[0]);
      var i1 = ps.indexOf(out[out.length - 1]);
      out = ps.slice(i0, i1 + 1);
    }
    [s, e].forEach(function (m) { if (m && m.parentNode) m.parentNode.removeChild(m); });
    return out;
  }
  // 段落化 + 定位目标段落（先打标记，再重建，最后按标记取段落）
  function prepare(box) {
    var marked = insertSelMarks(box);
    ensureParas(box);
    var ps = marked ? findMarkedParas(box) : [];
    if (!ps.length) ps = targetParas(box);
    return ps;
  }

  // 层级强制：清掉段内行内样式（注释底色、加粗等），让段落样式说了算；日期链接只清 style，保留 data-ei
  function stripInline(p) {
    Array.prototype.forEach.call(p.querySelectorAll('a.rec-tl-link'), function (a) { a.removeAttribute('style'); });
    Array.prototype.forEach.call(p.querySelectorAll('span,font,b,strong,em,i,u,s,strike'), function (el) {
      var tx = document.createTextNode(el.textContent || '');
      if (el.parentNode) el.parentNode.replaceChild(tx, el);
    });
  }

  // ---------- 改动落地 ----------
  function sync(box) {
    var win = cardOf(box);
    var name = win ? (win.getAttribute('data-proj') || '') : '';
    if (!name) return;
    try {
      recProjectTexts[name] = box.innerText || '';
      recProjectHtmls[name] = box.innerHTML;
    } catch (e) {}
    saveCard(win);
  }
  function saveCard(card) {
    var box = card ? card.querySelector('.rec-proj-win-body') : null;
    var name = card ? (card.getAttribute('data-proj') || '') : '';
    if (box && name) {
      try {
        recProjectTexts[name] = box.innerText || '';
        recProjectHtmls[name] = box.innerHTML;
      } catch (e) {}
    }
    try { saveRecordData(); } catch (e) {}
    try { recRenderTlColumn(); } catch (e) {}
    if (typeof showToast === 'function') showToast('已保存');
  }
  function flash(box) {
    box.style.transition = 'box-shadow .2s';
    box.style.boxShadow = 'inset 0 0 0 2px ' + colorOf(nameOf(box));
    setTimeout(function () { box.style.boxShadow = ''; }, 260);
  }

  // ---------- 缩放（参照成果卡 preview-zoom-search：CSS zoom，0.6–2 步进 10%） ----------
  function zoomPct() {
    var v = (typeof recProjZoom === 'number') ? recProjZoom : 1;
    return Math.round(v * 100) + '%';
  }
  function syncZoomLabels() {
    var txt = zoomPct();
    Array.prototype.forEach.call(document.querySelectorAll('.rp-zoom-val'), function (n) { n.textContent = txt; });
    var head = document.getElementById('recProjZoomVal');
    if (head) head.textContent = txt;
  }
  function applyZoom(delta) {
    var box = document.getElementById('recProjectInput');
    if (delta === 0) {
      // 点百分比 = 复位 100%（recProjectZoom 只做增量，这里直接落值）
      try { recProjZoom = 1; } catch (e) {}
      if (box) box.style.zoom = 1;
    } else if (typeof recProjectZoom === 'function') {
      recProjectZoom(delta);
    } else if (box) {
      var cur = parseFloat(box.style.zoom || '1') || 1;
      var next = Math.round(Math.min(2, Math.max(0.6, cur + delta * 0.1)) * 100) / 100;
      box.style.zoom = next;
    }
    syncZoomLabels();
  }

  // ---------- 编辑命令 ----------
  function applyLevels(box, kind) {
    var ps = prepare(box);
    if (!ps.length) return;
    var st = paraStyle(kind);
    ps.forEach(function (p) {
      stripInline(p);
      p.setAttribute('style', st);
      p.setAttribute('data-level', kind);
    });
    sync(box); flash(box);
  }
  function applyFont(box, fam) {
    prepare(box).forEach(function (p) { p.style.fontFamily = fam; });
    sync(box);
  }
  function applySize(box, px) {
    prepare(box).forEach(function (p) { p.style.fontSize = px + 'px'; });
    sync(box);
  }
  function applyAlign(box, v) {
    prepare(box).forEach(function (p) { p.style.textAlign = v; });
    sync(box);
  }
  function applyStyle(box, v) {
    prepare(box).forEach(function (p) {
      if (v === 'bold') p.style.fontWeight = '700';
      else if (v === 'italic') p.style.fontStyle = 'italic';
      else if (v === 'underline') p.style.textDecoration = 'underline';
      else if (v === 'strike') p.style.textDecoration = 'line-through';
      else { p.style.fontWeight = ''; p.style.fontStyle = ''; p.style.textDecoration = ''; }
    });
    sync(box);
  }
  function applyIndent(box, on) {
    prepare(box).forEach(function (p) { p.style.textIndent = on ? '2em' : '0'; });
    sync(box);
  }
  function clearBlank(box) {
    if (!ensureParas(box)) return;
    var n = 0;
    Array.prototype.slice.call(box.querySelectorAll('p')).forEach(function (p) {
      if (!(p.textContent || '').replace(/[\s\u3000\u00a0]/g, '')) { p.parentNode.removeChild(p); n++; }
    });
    sync(box);
    if (typeof showToast === 'function') showToast(n ? '已清除 ' + n + ' 个空行' : '没有空行');
  }
  function clearSpaces(box) {
    if (!ensureParas(box)) return;
    var walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (t) {
      if (t.parentNode && t.parentNode.closest && t.parentNode.closest('a.rec-tl-link')) return;
      var v = t.nodeValue.replace(/[\s\u3000]/g, '');
      if (v !== t.nodeValue) t.nodeValue = v;
    });
    sync(box);
    if (typeof showToast === 'function') showToast('已清除空格');
  }
  function resetFormat(box) {
    var name = nameOf(box);
    if (!name) return;
    try {
      var res = recFormatProjectPublish(box.innerText || '', name);
      box.innerHTML = res.html;
      recProjectTexts[name] = res.text;
      recProjectHtmls[name] = res.html;
      saveRecordData();
      recRenderTlColumn();
      if (typeof showToast === 'function') showToast(res.count ? '已按公文格式重置（识别到 ' + res.count + ' 条事件）' : '已按公文格式重置');
    } catch (e) {}
  }

  // ---------- 目录 / 跳转 ----------
  // 目录条目：按 sortKey 由远至近，ei 为时间轴索引（对应 a.rec-tl-link[data-ei]）
  function outlineItems(name) {
    var arr = [];
    try {
      var r = recProjectEventsOf(name);
      var ti = r.built.timelineIndex;
      r.events.forEach(function (ev, docIdx) { arr.push({ ev: ev, ei: ti[docIdx] }); });
    } catch (e) { return []; }
    arr.sort(function (a, b) {
      var ka = String(a.ev.sortKey || ''), kb = String(b.ev.sortKey || '');
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return a.ei - b.ei;
    });
    return arr;
  }
  function scrollToLink(box, link) {
    if (!link) return;
    link.scrollIntoView({ block: 'center', behavior: 'smooth' });
    link.classList.add('flash');
    setTimeout(function () { link.classList.remove('flash'); }, 900);
  }
  function openOutline(btn) {
    var box = bodyOf(btn);
    var name = nameOf(box);
    if (!box || !name) return;
    var evs = outlineItems(name);
    var rect = btn.getBoundingClientRect();
    if (!evs.length) {
      showMenu(rect.left, rect.bottom + 4, [{ grp: '本项目暂无日期事件' }, { t: '先点「自动识别」', run: function () { recProjectAutoRecognize(); } }]);
      return;
    }
    var items = [{ grp: '目录（' + name + '，共 ' + evs.length + ' 条）' }];
    evs.forEach(function (it) {
      var label = (it.ev.time || '') + '  ' + String(it.ev.name || '').slice(0, 18);
      items.push({
        t: label, run: function () {
          var link = box.querySelector('a.rec-tl-link[data-ei="' + it.ei + '"]') || box.querySelectorAll('a.rec-tl-link')[it.ei];
          if (link) scrollToLink(box, link);
          else if (typeof showToast === 'function') showToast('该事件在正文中没有可定位的日期');
        }
      });
    });
    showMenu(rect.left, rect.bottom + 4, items);
  }
  function jump(box, where) {
    if (!box) return;
    var links = Array.prototype.slice.call(box.querySelectorAll('a.rec-tl-link'));
    if (!links.length) { if (typeof showToast === 'function') showToast('正文中没有日期链接'); return; }
    if (where === 'start') { box.scrollTop = 0; return; }
    if (where === 'end') { box.scrollTop = box.scrollHeight; return; }
    var boxRect = box.getBoundingClientRect();
    var idx = -1;
    if (where === 'next') {
      idx = links.findIndex(function (a) { return a.getBoundingClientRect().top > boxRect.top + 12; });
      if (idx < 0) idx = 0;
    } else {
      for (var i = links.length - 1; i >= 0; i--) {
        if (links[i].getBoundingClientRect().top < boxRect.top + 12) { idx = i; break; }
      }
      if (idx < 0) idx = links.length - 1;
    }
    scrollToLink(box, links[idx]);
  }
  function zoom(box, d) {
    applyZoom(d);
    if (typeof showToast === 'function') showToast('正文缩放 ' + zoomPct());
  }

  // ---------- 粘贴 / 复制 / 清空 ----------
  function paste(box, mode) {
    var done = function (text) {
      if (!text) return;
      if (mode === 'overwrite') box.textContent = text;
      else box.innerHTML = (box.innerHTML || '') + (box.innerHTML ? '<br>' : '') + esc(text).replace(/\n/g, '<br>');
      sync(box);
      if (typeof showToast === 'function') showToast(mode === 'overwrite' ? '已粘入（覆盖）' : '已粘入（追加）');
    };
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(done).catch(function () {
        if (typeof showToast === 'function') showToast('无法读取剪贴板，请直接把内容粘贴到正文');
      });
    } else if (typeof showToast === 'function') {
      showToast('当前环境不支持读取剪贴板，请直接粘贴到正文');
    }
  }
  function copy(box) {
    var text = box.innerText || '';
    var ok = function () { if (typeof showToast === 'function') showToast('已复制 ' + text.length + ' 字'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }
  function clearBox(box) {
    var name = nameOf(box);
    if (!name) return;
    if (!confirm('清空「' + name + '」的全部内容？')) return;
    box.innerHTML = '';
    try { recProjectTexts[name] = ''; recProjectHtmls[name] = ''; saveRecordData(); recRenderTlColumn(); } catch (e) {}
    if (typeof showToast === 'function') showToast('已清空');
  }

  // ---------- 导出 Word（样式同「纵向排列 → 导出文档」） ----------
  function pxSize(pxStr, fallback) {
    var v = parseFloat(pxStr);
    return (isFinite(v) && v > 0) ? v : fallback;
  }
  function docFontOf(cssFam) {
    var f = String(cssFam || '').toLowerCase();
    if (f.indexOf('小标宋') >= 0 || f.indexOf('xiaobiaosong') >= 0) return '方正小标宋简体';
    if (f.indexOf('黑体') >= 0 || f.indexOf('simhei') >= 0) return '黑体';
    if (f.indexOf('楷体') >= 0 || f.indexOf('kaiti') >= 0) return '楷体_GB2312';
    if (f.indexOf('仿宋') >= 0 || f.indexOf('fangsong') >= 0) return '仿宋_GB2312';
    return '仿宋_GB2312';
  }
  function docAlignOf(cssAlign) {
    var v = String(cssAlign || '').toLowerCase();
    if (v === 'center') return 'center';
    if (v === 'right' || v === 'end') return 'right';
    if (v === 'left' || v === 'start') return 'left';
    return 'both';
  }
  function paraXmlOf(p) {
    var cs = window.getComputedStyle ? window.getComputedStyle(p) : null;
    var fam = docFontOf((cs && cs.fontFamily) || p.style.fontFamily);
    var px = pxSize((cs && cs.fontSize) || p.style.fontSize, 16);
    var sz = Math.max(16, Math.round(px * 2));   // 16px → 32（三号），与事件脉络导出同一比例
    var bold = parseInt((cs && cs.fontWeight) || p.style.fontWeight, 10) >= 600 ||
      p.style.fontWeight === 'bold';
    var align = docAlignOf((cs && cs.textAlign) || p.style.textAlign);
    var indentPx = parseFloat((cs && cs.textIndent) || '') || 0;
    var indent = indentPx > 0 ? '<w:ind w:first-line="640" w:first-line-chars="200"/>' : '';
    var text = p.innerText || p.textContent || '';
    return tlBuildParaXml([{ text: text }], align, indent, fam, sz, bold);
  }
  function exportDoc(card) {
    var box = card ? card.querySelector('.rec-proj-win-body') : null;
    var name = card ? (card.getAttribute('data-proj') || '') : '';
    if (!box) return;
    if (typeof tlBuildParaXml !== 'function') { if (typeof showToast === 'function') showToast('导出模板未就绪'); return; }
    var tpl = document.getElementById('docxTemplate');
    if (!tpl) { if (typeof showToast === 'function') showToast('文档模板未找到'); return; }
    ensureParas(box);
    var ps = Array.prototype.slice.call(box.querySelectorAll('p'));
    var bodyXml = '';
    ps.forEach(function (p) {
      var txt = (p.innerText || p.textContent || '').replace(/\u00a0/g, ' ');
      if (!txt.trim()) { bodyXml += tlBuildParaXml([{ text: '' }], 'both', '', '仿宋_GB2312', 32, false); return; }
      bodyXml += paraXmlOf(p);
    });
    if (!bodyXml) { if (typeof showToast === 'function') showToast('没有可导出的内容'); return; }
    var xml = tpl.textContent.replace('__DOC_BODY__', bodyXml);
    var now = new Date();
    var ts = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') +
      '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    var safe = String(name || '项目').replace(/[\\/:*?"<>|]/g, '_');
    var fileName = ts + ' ' + safe + '.doc';
    var blob = new Blob([xml], { type: 'application/msword' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    if (typeof showToast === 'function') showToast('已导出：' + fileName);
  }

  // ---------- 菜单表 ----------
  function textMenu(box) {
    var items = [{ grp: '字体' }];
    DA_FONTS.forEach(function (f) { items.push({ t: f[0], run: function () { applyFont(box, f[1]); } }); });
    items.push({ grp: '字号' });
    DA_SIZES.forEach(function (s) { items.push({ t: s + 'px', run: function () { applySize(box, s); } }); });
    items.push({ grp: '对齐' });
    [['左对齐', 'left'], ['居中', 'center'], ['两端对齐', 'justify'], ['右对齐', 'right']].forEach(function (a) {
      items.push({ t: a[0], run: function () { applyAlign(box, a[1]); } });
    });
    items.push({ grp: '样式' });
    [['加粗', 'bold'], ['斜体', 'italic'], ['下划线', 'underline'], ['删除线', 'strike'], ['正常', 'normal']].forEach(function (s) {
      items.push({ t: s[0], run: function () { applyStyle(box, s[1]); } });
    });
    return items;
  }
  function paraMenu(box) {
    return [
      { grp: '段落' },
      { t: '首行缩进', run: function () { applyIndent(box, true); } },
      { t: '取消缩进', run: function () { applyIndent(box, false); } },
      '-',
      { t: '清除空行', run: function () { clearBlank(box); } },
      { t: '清除空格', run: function () { clearSpaces(box); } }
    ];
  }
  function levelMenu(box) {
    var items = [{ grp: '层级（作用于当前段落）' }];
    DA_LEVELS.forEach(function (l) { items.push({ t: l[0], run: function () { applyLevels(box, l[0]); } }); });
    return items;
  }

  // ---------- 命令入口 ----------
  function cmd(btn, key) {
    var box = bodyOf(btn);
    if (!box) return;
    var rect = btn.getBoundingClientRect();
    var x = rect.left, y = rect.bottom + 4;
    if (key === 'text') return showMenu(x, y, textMenu(box));
    if (key === 'para') return showMenu(x, y, paraMenu(box));
    if (key === 'level') return showMenu(x, y, levelMenu(box));
    if (key === 'dir') return openOutline(btn);
    if (key === 'format') {
      return showMenu(x, y, [{ grp: '格式' },
        { t: '重置格式（本篇）', run: function () { resetFormat(box); } },
        '-',
        { t: '自动识别（有选区只排选区）  Ctrl+Shift+E', run: function () { recProjectAutoRecognize(); } }]);
    }
    if (key === 'jump') {
      return showMenu(x, y, [{ grp: '跳转' },
        { t: '开始', run: function () { jump(box, 'start'); } },
        { t: '上一条事件', run: function () { jump(box, 'prev'); } },
        { t: '下一条事件', run: function () { jump(box, 'next'); } },
        { t: '末尾', run: function () { jump(box, 'end'); } }]);
    }
    if (key === 'paste') {
      return showMenu(x, y, [{ grp: '粘入' },
        { t: '粘入（覆盖全文）', run: function () { paste(box, 'overwrite'); } },
        { t: '粘入（追加到末尾）', run: function () { paste(box, 'append'); } }]);
    }
    if (key === 'copy') return copy(box);
    if (key === 'clear') return clearBox(box);
  }

  // ---------- 右键菜单 ----------
  function contextMenu(e, box) {
    var t = e.target;
    if (t && t.closest && (t.closest('a.rec-tl-link') || t.closest('.rec-tl-nodate'))) return; // 交给附件菜单
    e.preventDefault();
    var items = [
      { t: '自动识别（有选区只排选区）  Ctrl+Shift+E', run: function () { recProjectAutoRecognize(); } },
      '-',
      { t: '层级设置 ▸', run: function () { showMenu(e.clientX + 20, e.clientY, levelMenu(box)); } },
      { t: '文字格式 ▸', run: function () { showMenu(e.clientX + 20, e.clientY, textMenu(box)); } },
      { t: '段落设置 ▸', run: function () { showMenu(e.clientX + 20, e.clientY, paraMenu(box)); } },
      { t: '重置格式（本篇）', run: function () { resetFormat(box); } },
      '-',
      { t: '粘入（覆盖）', run: function () { paste(box, 'overwrite'); } },
      { t: '粘入（追加）', run: function () { paste(box, 'append'); } },
      { t: '复制全文', run: function () { copy(box); } },
      { t: '清空内容', run: function () { clearBox(box); } }
    ];
    showMenu(e.clientX, e.clientY, items);
  }

  injectStyle();

  window.daProjMount = mount;
  window.daProjCmd = cmd;
  window.daProjContextMenu = contextMenu;
  window.daProjLevel = applyLevels;
  window.daProjResetFormat = resetFormat;
  window.daProjExport = function (btn) { exportDoc(cardOf(btn)); };
  window.daProjSave = function (btn) { saveCard(cardOf(btn)); };
  window.daProjCloseMenu = closeMenu;
  window.daProjEnsureParas = ensureParas;
  window.daProjZoom = applyZoom;
})();
