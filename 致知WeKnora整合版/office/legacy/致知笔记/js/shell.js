/* ============================================================
   shell.js — 外壳桥接层
   A 段：为 notepad.js 补齐被移除模块的全局依赖
   B 段（文件末尾追加）：笔记导入 / 导出 / 保存下拉
   ============================================================ */

/* ---------- 1. 状态占位（原 notes.js / reminder.js / calendar-view.js） ---------- */
var notes = (typeof window.notes !== 'undefined' && window.notes) ? window.notes : [];
var _noteCategories = typeof S !== 'undefined' ? S._noteCategories : [{ id: 0, name: '默认' }];
var _noteCurrentCategory = typeof S !== 'undefined' ? S._noteCurrentCategory : 0;
window.notes = notes;
window._noteCategories = _noteCategories;
window._noteCurrentCategory = _noteCurrentCategory;

/* ---------- 2. 日志 / 日历 / 备忘 渲染空实现 ----------
   本程序只保留「笔记」「编辑器」两个版块，日志类界面不加载，
   但两个模块在清空数据、切换日历等边缘路径上仍会调用这些函数。 */
function renderTrackContent() { /* 日志表格视图：本程序不提供 */ }
function renderCalendar() { /* 日历：本程序不提供 */ }
function renderReminders() { /* 备忘：本程序不提供 */ }
function renderNotes() { /* 随记：本程序不提供 */ }
function refreshNoteCategorySelect() { /* 随记类别：本程序不提供 */ }
window.renderTrackContent = renderTrackContent;
window.renderCalendar = renderCalendar;
window.renderReminders = renderReminders;
window.renderNotes = renderNotes;
window.refreshNoteCategorySelect = refreshNoteCategorySelect;
window._renderTrackContent = renderTrackContent;

/* ---------- 2b. 下拉菜单关闭（原 problem-analysis.js） ----------
   编辑器模块已删除，该函数随之消失，但 notepad.js 的 notepadToggleDropdown
   每次切换都先调它、工具栏生成函数也调它，缺了会抛 ReferenceError 导致
   下拉菜单点不开。这里补一个只操作文稿工具条的等价实现。 */
function paCloseDropdowns() {
    var menus = document.querySelectorAll('#notepadPanel .paDropdownMenu.show');
    for (var i = 0; i < menus.length; i++) menus[i].classList.remove('show');
    var btns = document.querySelectorAll('#notepadPanel .paDropdownBtn.open');
    for (var j = 0; j < btns.length; j++) btns[j].classList.remove('open');
}
window.paCloseDropdowns = paCloseDropdowns;

/* ---------- 2c. 下拉菜单点别处自动关闭 ----------
   原来只有「点同一个展开按钮」和「点菜单项」两条路径会关，
   点页面其他任何地方（包括右键、另一个下拉按钮、编辑区）都不会关。
   用捕获阶段监听，mousedown / contextmenu 两种情形都覆盖。 */
(function () {
    function closeIfOutside(e) {
        var menus = document.querySelectorAll('#notepadPanel .paDropdownMenu.show');
        if (!menus.length) return;
        var t = e.target;
        /* 点在已展开的菜单里 → 交给菜单项自己的 onclick（它们会调 paCloseDropdowns） */
        for (var i = 0; i < menus.length; i++) {
            if (menus[i].contains(t)) return;
        }
        /* 点在下拉按钮上 → 由 notepadToggleDropdown 自己处理（它要实现「再点一次收起」） */
        if (t.closest && t.closest('#notepadPanel .paDropdownBtn')) return;
        /* 点在某个菜单的子菜单里也不关 */
        if (t.closest && t.closest('.paCtxSubmenu')) return;
        paCloseDropdowns();
    }
    document.addEventListener('mousedown', closeIfOutside, true);
    document.addEventListener('contextmenu', closeIfOutside, true);
    /* 窗口滚动 / 改大小时菜单会错位，一并收起 */
    window.addEventListener('resize', paCloseDropdowns);
    document.addEventListener('scroll', function (e) {
        if (e.target && e.target.closest && e.target.closest('.paDropdownMenu')) return;
        paCloseDropdowns();
    }, true);
})();

/* ---------- 3. 通用工具（原 work-log.js） ---------- */
function isKylinOS() {
    try {
        var ua = (navigator.userAgent || '') + ' ' + (navigator.platform || '') + ' ' + (navigator.appVersion || '');
        return /kylin|麒麟|uos|uniontech/i.test(ua);
    } catch (e) { return false; }
}

function fmt(d) {
    if (!d) return '';
    if (typeof d === 'number' || typeof d === 'string') d = new Date(d);
    if (!(d instanceof Date) || isNaN(d.getTime())) return '';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

/* 去除 JS 注释（保留字符串内容），用于解析带注释的 savedData 文件 */
function _stripJsCommentsSafe(src) {
    var out = '';
    var inStr = false, quote = '', inLine = false, inBlock = false;
    for (var i = 0; i < src.length; i++) {
        var c = src.charAt(i), n = src.charAt(i + 1);
        if (inLine) { if (c === '\n') { inLine = false; out += c; } continue; }
        if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
        if (inStr) {
            out += c;
            if (c === '\\') { out += (n || ''); i++; continue; }
            if (c === quote) inStr = false;
            continue;
        }
        if (c === '"' || c === "'") { inStr = true; quote = c; out += c; continue; }
        if (c === '/' && n === '/') { inLine = true; i++; continue; }
        if (c === '/' && n === '*') { inBlock = true; i++; continue; }
        out += c;
    }
    return out;
}

/* Excel 另存的 .js 可能整行被引号包裹且双引号转义为 "" */
function csvUnescapeSaveAsText(raw) {
    var lines = String(raw == null ? '' : raw).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        if (i === 0) lines[i] = lines[i].replace(/^\uFEFF/, '');
        var ln = lines[i];
        if (ln.length >= 2 && ln.charAt(0) === '"' && ln.charAt(ln.length - 1) === '"') {
            lines[i] = ln.substring(1, ln.length - 1).replace(/""/g, '"');
        }
    }
    return lines.join('\n');
}

/* ---------- 4. 缩放 / 全屏 ---------- */
function changeMainZoom(delta) {
    var z = 1;
    try { z = parseFloat(DataLayer.getRaw('mainZoom')) || 1; } catch (e) {}
    z = Math.max(0.6, Math.min(1.8, Math.round((z + delta) * 100) / 100));
    try { DataLayer.setRaw('mainZoom', z); } catch (e) {}
    applyMainZoom();
}

function applyMainZoom() {
    var z = 1;
    try { z = parseFloat(DataLayer.getRaw('mainZoom')) || 1; } catch (e) {}
    var mc = document.getElementById('mainContent');
    if (mc) {
        mc.style.zoom = z;
        mc.style.width = (100 / z) + '%';
        mc.style.height = (100 / z) + '%';
    }
    if (typeof autoFitNotepadHeight === 'function') autoFitNotepadHeight();
}

function toggleBrowserFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () {});
    }
}

window.isKylinOS = isKylinOS;
window.fmt = fmt;
window._stripJsCommentsSafe = _stripJsCommentsSafe;
window.csvUnescapeSaveAsText = csvUnescapeSaveAsText;
window.changeMainZoom = changeMainZoom;
window.applyMainZoom = applyMainZoom;
window.toggleBrowserFullscreen = toggleBrowserFullscreen;

/* ---------- 5. 笔记面板左边界锚定 ---------- */
function anchorToLeft() {
    var panel = document.getElementById('notepadPanel');
    var rp = document.getElementById('rightPanel');
    if (!panel) return;
    if (panel.dataset.npUserMoved === '1' && panel.style.left) return;
    if (rp && rp.offsetParent !== null) {
        var r = rp.getBoundingClientRect();
        var z = 1;
        try { z = parseFloat(DataLayer.getRaw('mainZoom')) || 1; } catch (e) {}
        panel.style.left = (r.left / z) + 'px';
    }
}
window.anchorToLeft = anchorToLeft;

/* ---------- 6. 载入 savedData 文件（笔记「打开 js」路径使用） ---------- */
function loadDataContent(content, fileName) {
    try {
        var text = csvUnescapeSaveAsText(String(content || ''));
        var data = null;
        var m = text.match(/var\s+savedData\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
        if (m) {
            data = JSON.parse(m[1]);
        } else {
            var cleaned = _stripJsCommentsSafe(text);
            var m2 = cleaned.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
            if (m2) data = JSON.parse(m2[1]);
        }
        if (!data) { showToast('打开失败：未找到有效数据'); return; }
        if (data.notepad) {
            var np = data.notepad;
            if (np.labels) S.notepadLabels = np.labels;
            if (typeof window._npMergeNotepadTitles === 'function') {
                S.notepadTitles = window._npMergeNotepadTitles(np.titles, S.notepadTitles);
            } else if (np.titles) {
                S.notepadTitles = np.titles;
            }
            if (typeof window._npMergeNotepadEditorData === 'function') {
                S.notepadEditorData = window._npMergeNotepadEditorData(np.editorData, S.notepadEditorData, np.data);
            } else if (np.editorData) {
                S.notepadEditorData = np.editorData;
            }
            if (np.fontSizes) S.notepadFontSizes = np.fontSizes;
            if (Array.isArray(np.notebookStyles) && np.notebookStyles.length === 5) {
                S.notepadNotebookStyles = np.notebookStyles.map(function (v) { return !!v; });
            }
            if (np.zoomLevels && typeof window.notepadZoomLevels !== 'undefined') {
                window.notepadZoomLevels = np.zoomLevels;
            }
        }
        if (data.reportData) S.reportData = data.reportData;
        if (data.reminders) S.reminders = data.reminders;
        if (data.notes) { window.notes = data.notes; S.notes = data.notes; }
        if (typeof updateNotepadTabs === 'function') updateNotepadTabs();
        if (typeof syncEditorFromData === 'function') syncEditorFromData();
        if (typeof applyNotepadZoom === 'function') applyNotepadZoom();
        if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
        var label = document.getElementById('notepadOpenFileLabel');
        if (label) { label.textContent = fileName || ''; label.title = fileName || ''; }
        showToast('已载入：' + (fileName || '数据文件'));
    } catch (err) {
        showToast('打开失败：' + err.message);
    }
}
window.loadDataContent = loadDataContent;

/* ---------- 7. 底栏时间戳 ---------- */
if (typeof updateFooterTimestamp !== 'function') {
    window.updateFooterTimestamp = function () {
        var el = document.getElementById('footerTimestamp');
        if (!el) return;
        var now = new Date();
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        el.textContent = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
            '-' + pad(now.getHours()) + pad(now.getMinutes()) + ' 已保存';
    };
}

/* ---------- 8. 保存按钮的兼容入口 ---------- */
/* 工具栏「保存 ▾ → 保存到缓存」在本项目里没有对应实现，补一个：
   文件夹模式下默认保存到当前 .js 文件，否则只写浏览器缓存。 */
window.saveNotepadToCache = function () {
    if (typeof window.npLibActive === 'function' && window.npLibActive() &&
        typeof window.npLibSave === 'function' && window.npLibOpenPath && window.npLibOpenPath()) {
        window.npLibSave();
        return;
    }
    if (typeof window._saveNotepadToCache === 'function') window._saveNotepadToCache();
    if (typeof showToast === 'function') showToast('已保存到缓存');
};