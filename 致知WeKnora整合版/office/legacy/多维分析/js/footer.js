/* ============================================================
   底部设置长条：单击切换 设置 / 操作说明
   设置   = 当前主题名称 + 「保存」 + 检索 + 时间轴排列设置（默认视图）
   操作说明 = 提示文字 / 悬停图标时显示该图标的名称与录入时间
   录入时间来源：编辑超链接时填写并写入缓存（item.time / timeMap）
   ============================================================ */
(function () {
  const el = document.getElementById('hintToggle');
  if (!el) return;
  const KEY = 'duowei-analysis-setbar-state-v1';     /* 'settings' | 'hint' */
  const hintView = document.getElementById('hintView');
  const hintTrack = document.getElementById('hintTrack');
  const hintTools = document.getElementById('hintTools');
  const BASE_HINT =
    '<b>数据管理</b>点选数据文件，双击读取主题 &nbsp;|&nbsp; ' +
    '<b>项目编辑</b>子项列表 / 内容 / 时间轴三栏联动，时间轴可切换纵向排列与横向分布 &nbsp;|&nbsp; ' +
    '<b>人物关系</b>维护人员与关系，拖动节点调整关系图布局 &nbsp;|&nbsp; 单击<b>logo</b>进入全屏模式';
  const RUN_HTML = '<span class="hint-run">' + BASE_HINT + '</span>';
  let state = 'settings';
  try { const v = localStorage.getItem(KEY); if (v === 'settings' || v === 'hint') state = v; } catch (e) {}
  let currentIdx = -1;                             /* 当前悬停图标下标，切换工具后用于恢复信息 */
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* 取该图标的录入时间：优先记录内的 time，其次全局 timeMap */
  function getRecTime(item, path, cb) {
    if (item && item.time) { cb(item.time); return; }
    try {
      const map = JSON.parse(localStorage.getItem('zhizhi-office-time-v1') || '{}') || {};
      const rec = map[String(path).trim().replace(/^["'\u201c\u201d\u2018\u2019]+|["'\u201c\u201d\u2018\u2019]+$/g, '').trim()];
      if (rec && rec.time) { cb(rec.time); return; }
    } catch (e) {}
    cb(null);
  }
  function itemAt(idx) {
    return (((typeof slots !== 'undefined' && slots && slots[idx])) ||
            (window.__getSlots && window.__getSlots()[idx])) || null;
  }
  /* 显示某图标的“类型 + 录入时间”；无则显示默认提示 */
  function showInfo(idx) {
    const item = idx >= 0 ? itemAt(idx) : null;
    if (!item || !item.path) { showDefault(); return; }
    const label = (typeof window.__typeLabelOf === 'function') ? window.__typeLabelOf(item.path) : '未知路径';
    getRecTime(item, item.path, function (t) {
      hintTrack.classList.remove('scrolling');
      hintTrack.innerHTML = '<span class="hint-run">' +
        '<b>类型</b>&nbsp;' + esc(label) +
        ' &nbsp;&nbsp; <b>录入时间</b>&nbsp;' + (t ? esc(t) : '未记录') + '</span>';
    });
  }
  /* 默认操作提示：内容超出视口时，双份内容水平无缝轮播（灯箱效果） */
  function showDefault() {
    hintTrack.classList.remove('scrolling');
    hintTrack.innerHTML = RUN_HTML;
    requestAnimationFrame(function () {
      const viewW = hintView ? hintView.clientWidth : 0;
      const runEl = hintTrack.querySelector('.hint-run');
      const oneW = runEl ? runEl.scrollWidth : hintTrack.scrollWidth;
      if (oneW > viewW + 2) {
        hintTrack.innerHTML = RUN_HTML + RUN_HTML;   /* 两份，便于 -50% 无缝循环 */
        hintTrack.classList.add('scrolling');
      }
    });
    currentIdx = -1;
  }
  const setbarTheme = document.getElementById('setbarThemeName');
  const setbarSaveBtn = document.getElementById('setbarSaveBtn');
  const setbarThemeLabel = document.getElementById('setbarThemeLabel');
  const setbarDualProj = document.getElementById('setbarDualProj');
  const setbarDualRel = document.getElementById('setbarDualRel');
  /* 「保存」按钮统一文案，按当前页面分派到项目主题 / 人物主题 */
  if (setbarSaveBtn) {
    setbarSaveBtn.textContent = '保存';
    setbarSaveBtn.dataset.kind = 'project';
    setbarSaveBtn.onclick = function (ev) {
      if (ev) { ev.stopPropagation(); }
      const kind = setbarSaveBtn.dataset.kind === 'relation' ? 'relation' : 'project';
      if (kind === 'relation') {
        if (typeof window.relSaveThemeJs === 'function') window.relSaveThemeJs();
      } else if (typeof window.recSaveThemeJs === 'function') {
        window.recSaveThemeJs();
      }
    };
  }
  /* 刷新「设置」视图里的当前主题名称（由 record.js 载入/保存主题后调用）
     数据管理：底部左右两侧分别显示项目主题与人物主题
     人物关系页显示关系主题名称，保存按钮保存人物主题 */
  window.__ftRefreshTheme = function () {
    let kind = 'datamanage';
    try { if (typeof recActiveKind !== 'undefined' && recActiveKind) kind = recActiveKind; } catch (e) {}
    let projName = '';
    try { projName = (typeof recThemeName !== 'undefined' && recThemeName) ? recThemeName : ''; } catch (e) {}
    const relName = (typeof window.relThemeName === 'string' && window.relThemeName) ? window.relThemeName : '';
    const relTip = document.getElementById('setbarRelTip');
    if (relTip) relTip.classList.toggle('show', kind === 'relation');
    if (kind === 'datamanage') {
      el.classList.add('setbar-dual-mode');
      if (setbarDualProj) {
        setbarDualProj.textContent = projName ? ('当前项目主题　' + projName) : '未选择项目主题';
        setbarDualProj.classList.toggle('on', !!projName);
      }
      if (setbarDualRel) {
        setbarDualRel.textContent = relName ? ('当前人物主题　' + relName) : '未选择人物主题';
        setbarDualRel.classList.toggle('on', !!relName);
      }
      return;
    }
    el.classList.remove('setbar-dual-mode');
    if (!setbarTheme) return;
    if (kind === 'relation') {
      setbarTheme.textContent = relName || '未选择';
      setbarTheme.title = '单击重命名关系主题';
      setbarTheme.classList.toggle('empty', !relName);
      setbarTheme.dataset.kind = 'relation';
      if (setbarThemeLabel) setbarThemeLabel.textContent = '主题：';
      if (setbarSaveBtn) {
        setbarSaveBtn.dataset.kind = 'relation';
        setbarSaveBtn.title = '保存当前人物关系主题到「数据/人物关系」；本地服务不可用时先存缓存，再选择文件覆盖保存';
      }
      return;
    }
    setbarTheme.textContent = projName || '未选择';
    setbarTheme.title = projName || '';
    setbarTheme.classList.toggle('empty', !projName);
    setbarTheme.dataset.kind = 'project';
    if (setbarThemeLabel) setbarThemeLabel.textContent = '主题：';
    if (setbarSaveBtn) {
      setbarSaveBtn.dataset.kind = 'project';
      setbarSaveBtn.title = '保存当前主题（含附件）到「数据/项目信息」；本地服务不可用时先存缓存，再选择文件覆盖保存';
    }
  };
  if (setbarTheme) setbarTheme.addEventListener('click', function (e) {
    if (setbarTheme.dataset.kind !== 'relation') return;
    e.stopPropagation();
    const cur = (typeof window.relThemeName === 'string' && window.relThemeName) ? window.relThemeName : '';
    const nm = window.prompt('请输入人物关系主题名称', cur || '人物关系主题');
    if (nm === null) return;
    const v = String(nm).trim();
    if (!v) return;
    if (typeof window.relRenameTheme === 'function') window.relRenameTheme(v);
    window.__ftRefreshTheme();
  });
  window.__ftRefreshTheme();
  function apply(next) {
    state = next === 'hint' ? 'hint' : 'settings';
    el.classList.remove('setbar-settings', 'setbar-hint', 'collapsed', 'tools');
    el.classList.add('setbar-' + state);
    if (state === 'hint') {
      showDefault();
      window.__ftRefreshTheme();
    } else {
      window.__ftRefreshTheme();
    }
    try { localStorage.setItem(KEY, state); } catch (e) {}
  }
  apply(state);
  function cycle() {
    apply(state === 'settings' ? 'hint' : 'settings');
  }
  /* 供运行层收起底部提示，避免与子程序画面重叠 */
  window.__setHintCollapsed = function (v) {
    if (v) { el.classList.add('force-hide'); }
    else { el.classList.remove('force-hide'); }
  };
  /* 光标滑过图标：显示该文件的类型与录入时间（数据来自编辑窗保存的缓存） */
  document.addEventListener('mouseover', function (e) {
    if (state !== 'hint') return;
    if (!hintTrack) return;
    const slot = e.target && e.target.closest ? e.target.closest('.slot.filled') : null;
    if (slot) { currentIdx = parseInt(slot.dataset.index, 10); showInfo(currentIdx); return; }
    if (!e.relatedTarget || !(e.relatedTarget.closest && e.relatedTarget.closest('.slot.filled'))) {
      if (currentIdx !== -1) showDefault();
    }
  });
  el.addEventListener('click', function (e) {
    const t = e.target;
    if (t && t.closest && t.closest('.setbar-save, .setbar-search, .setbar-mode, input, label, select')) return;
    cycle();
  });
  el.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      const t = e.target;
      if (t && t.closest && t.closest('.setbar-save, .setbar-search, .setbar-mode, input, label, select')) return;
      e.preventDefault();
      cycle();
    }
  });
  window.addEventListener('resize', function () { if (state === 'hint' && currentIdx === -1) showDefault(); });

  /* ---------- 快捷工具弹窗 ---------- */
  const toolOverlay = document.getElementById('toolOverlay');
  const toolFrame = document.getElementById('toolFrame');
  const toolTitle = document.getElementById('toolTitle');
  const toolExtra = document.getElementById('toolExtra');
  const toolLogo = document.getElementById('toolLogo');
  function escTool(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function setToolExtra(html) { if (toolExtra) toolExtra.innerHTML = html || ''; }
  const TOOLS = {
    sysrun: { url: 'soft/系统工具.html', name: '系统工具', en: 'SYSTEM TOOLKIT', logo: '图标/系统设置.png' },
    calc: { url: 'soft/计算器.html', name: '计算器', en: 'CALCULATOR', logo: '图标/计算器.png' },
    unit: { url: 'soft/单位换算.html', name: '单位换算', en: 'CONVERTER', logo: '图标/单位换算.png' },
    date: { url: 'soft/日期计算.html', name: '日期计算', en: 'CALENDAR', logo: '图标/日期计算.png' },
    clock: { url: 'soft/世界时钟.html', name: '世界时钟', en: 'WORLD CLOCK', logo: '图标/世界时钟.png' },
    dict: { url: 'soft/汉英词典.html', name: '汉英词典', en: 'DICTIONARY', logo: '图标/汉英词典.png' }
  };
  function openTool(key) {
    const t = TOOLS[key];
    if (!t || !toolOverlay || !toolFrame) return;
    if (toolTitle) {
      if (t.noTitle) { toolTitle.innerHTML = ''; toolTitle.style.display = 'none'; }
      else { toolTitle.style.display = ''; toolTitle.innerHTML = escTool(String(t.name)) + (t.en ? ' <em>' + escTool(t.en) + '</em>' : ''); }
    }
    if (toolLogo) {
      if (t.logo) { toolLogo.src = t.logo; toolLogo.style.display = 'block'; }
      else { toolLogo.removeAttribute('src'); toolLogo.style.display = 'none'; }
    }
    setToolExtra('');
    toolFrame.src = t.url;
    toolOverlay.classList.add('show');
    toolOverlay.setAttribute('aria-hidden', 'false');
  }
  function closeTool() {
    if (!toolOverlay) return;
    toolOverlay.classList.remove('show');
    toolOverlay.setAttribute('aria-hidden', 'true');
    if (toolFrame) toolFrame.removeAttribute('src');
    if (toolLogo) { toolLogo.removeAttribute('src'); toolLogo.style.display = 'none'; }
    setToolExtra('');
  }
  if (hintTools) hintTools.addEventListener('click', function (e) {
    const b = e.target.closest ? e.target.closest('.tool-btn') : null;
    if (b) { e.stopPropagation(); openTool(b.dataset.tool); }
  });

  /* 「系统工具」仅在受支持的系统显示（麒麟 / Windows）：
     同一套功能、同一套脚本名，在两种系统下体验一致。
     优先用安装脚本写入的 js/platform.js 标记；缺失时退回浏览器/服务探测。 */
  (function detectOS() {
    const btn = hintTools && hintTools.querySelector('.tool-btn[data-tool="sysrun"]');
    if (!btn) return;
    const show = function () { btn.style.display = ''; };
    /* 1) 安装脚本写入的平台标记（麒麟） */
    if (window.ZZ_PLATFORM && window.ZZ_PLATFORM.kylin === true) { show(); return; }
    /* 2) 浏览器 UA（麒麟 或 Windows） */
    try {
      const ua = navigator.userAgent || '';
      if (/kylin|ukylin|麒麟/i.test(ua) || /Windows/i.test(ua)) { show(); return; }
    } catch (e) {}
    /* 3) 回退：向桥接服务询问操作系统（麒麟 / Windows 均可） */
    try {
      const API = (window.ZZ_BRIDGE && window.ZZ_BRIDGE.url) || localStorage.getItem('zz-bridge-url') || 'http://127.0.0.1:8737';
      fetch(API + '/api/ping').then(function (r) { return r.json(); }).then(function (d) {
        const pf = String((d && d.platform) || '');
        if (d && d.ok && (pf === 'windows' || /kylin|麒麟/i.test(String(d.os || '')))) show();
      }).catch(function () {});
    } catch (e) {}
  })();
  /* 子工具上报标题栏内容（如日期计算/系统工具的分页标签）；点击即通知子页面切换 */
  window.addEventListener('message', function (e) {
    const d = e.data;
    if (!d || d.type !== 'zz-tool-meta' || !d.tool || !d.tabs) return;
    if (!toolExtra) return;
    toolExtra.innerHTML = '';
    var activeId = d.active || null;
    d.tabs.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      /* 子页可上报当前激活项 d.active 以保留选中高亮；未上报（如日期计算）时保留首个高亮 */
      var isActive = activeId ? (t[0] === activeId) : (toolExtra.children.length === 0);
      b.className = 'tool-tab' + (isActive ? ' active' : ''); b.textContent = t[1];
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(toolExtra.children, function (c) { c.classList.toggle('active', c === b); });
        /* 优先用 postMessage 通知子页切换（file:// 下跨窗口属性访问会被安全策略拦截）；
           同时保留直接调用作为兼容回退 */
        try { if (toolFrame && toolFrame.contentWindow) toolFrame.contentWindow.postMessage({ type: 'zz-tool-tab', tool: d.tool, tab: t[0] }, '*'); } catch (err) {}
        try {
          const w = toolFrame && toolFrame.contentWindow;
          if (w) {
            if (typeof w.__setToolTab === 'function') w.__setToolTab(t[0]);
            else if (typeof w.__setDateTab === 'function') w.__setDateTab(t[0]);
          }
        } catch (err) {}
      });
      toolExtra.appendChild(b);
    });
  });
  if (toolOverlay) toolOverlay.addEventListener('click', function (e) { if (e.target === toolOverlay) closeTool(); });
  const toolCloseBtn = document.getElementById('toolClose');
  if (toolCloseBtn) toolCloseBtn.addEventListener('click', closeTool);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toolOverlay && toolOverlay.classList.contains('show')) closeTool();
  });
})();
