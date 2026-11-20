/* ============================================================
   notepad-io.js — 笔记版块：保存下拉 + 导出
   原实现位于 01 的 work-log.js，此处按需精简重写。
   依赖：store.js、format-standard.js、shell.js、notepad.js
   ============================================================ */

var notepadDirHandle = null;
var notepadFolderEntries = [];
var notepadSelectedFolder = null;
var notepadSelectedDirHandle = null;
var notepadSaveSelectedFolder = null;
var notepadSaveSelectedDirHandle = null;
var notepadImportFileMap = {};
var notepadScannedHandleMap = {};

/* ---------- 保存下拉 ---------- */
function toggleNotepadSaveDropdown(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var editor = document.getElementById('notepadEditor');
    var sel = window.getSelection();
    if (editor && sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
        try { window._notepadSavedRange = sel.getRangeAt(0); } catch (err) {}
    }
    var menu = document.getElementById('notepadSaveDropdownMenu');
    var jsMenu = document.getElementById('notepadSaveJsMenu');
    var htmlMenu = document.getElementById('notepadSaveHtmlMenu');
    var docxMenu = document.getElementById('notepadSaveDocxMenu');
    if (!menu) return;
    var show = !menu.classList.contains('show');
    menu.classList.toggle('show', show);
    if (!show) {
        if (jsMenu) jsMenu.style.display = 'none';
        if (htmlMenu) htmlMenu.style.display = 'none';
        if (docxMenu) docxMenu.style.display = 'none';
    }
}

function closeNotepadSaveDropdown() {
    var ids = ['notepadSaveDropdownMenu', 'notepadSaveJsMenu', 'notepadSaveHtmlMenu', 'notepadSaveDocxMenu'];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (!el) continue;
        el.classList.remove('show');
        el.style.display = 'none';
    }
}

function _npToggleSubMenu(id, others) {
    var menu = document.getElementById(id);
    if (!menu) return;
    for (var i = 0; i < others.length; i++) {
        var o = document.getElementById(others[i]);
        if (o) o.style.display = 'none';
    }
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

function toggleNotepadSaveJsMenu(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    _npToggleSubMenu('notepadSaveJsMenu', ['notepadSaveHtmlMenu', 'notepadSaveDocxMenu']);
}

function toggleNotepadExportHtmlMenu(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    _npToggleSubMenu('notepadSaveHtmlMenu', ['notepadSaveJsMenu', 'notepadSaveDocxMenu']);
}

function toggleNotepadExportDocxMenu(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    _npToggleSubMenu('notepadSaveDocxMenu', ['notepadSaveJsMenu', 'notepadSaveHtmlMenu']);
}

document.addEventListener('click', function (e) {
    var wrap = document.getElementById('notepadSaveDropdownWrap');
    if (wrap && !wrap.contains(e.target)) closeNotepadSaveDropdown();
});

function saveNotepadToCache() {
    if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
    if (typeof updateFooterTimestamp === 'function') updateFooterTimestamp();
    showToast('笔记已保存到本机缓存');
}

/* ---------- 导出辅助 ---------- */
function _notepadSaveTitle() {
    var title = '';
    try { title = (document.getElementById('notepadTitle') || {}).value || ''; } catch (e) {}
    title = String(title).trim();
    if (!title || title === '…' || title === '请输入标题') {
        title = (typeof notepadTitles !== 'undefined' && notepadTitles[currentNotepadTab]) || '';
    }
    if (!title || title === '…') title = '笔记';
    return title;
}

function _notepadExportTimestamp() {
    var now = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return '' + now.getFullYear() + p(now.getMonth() + 1) + p(now.getDate()) +
        '-' + p(now.getHours()) + p(now.getMinutes());
}

function _npSafeName(name) {
    if (typeof sanitizeDocFileName === 'function') return sanitizeDocFileName(name);
    return String(name || '').replace(/[\\/:*?"<>|]/g, '_');
}

/* 导出文件默认名：当前文章所属的「索引标题」（标题列表那一行）。
   光标先落在文章内时向前找最近的 data-outline-level="1"；找不到光标段落时
   退到当前单篇视图里第一条可见索引标题；都没有则回退文章标题。 */
function _npExportIndexTitle() {
    var fallback = _notepadSaveTitle();
    var ed = document.getElementById('notepadEditor');
    if (!ed) return fallback;
    var ps = ed.querySelectorAll('p');
    var cur = null;
    try {
        var sel = window.getSelection();
        if (sel && sel.rangeCount && ed.contains(sel.anchorNode)) {
            cur = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
            while (cur && cur !== ed && cur.tagName !== 'P') cur = cur.parentNode;
            if (cur === ed) cur = null;
        }
    } catch (e) { cur = null; }
    var start = -1;
    for (var i = 0; i < ps.length; i++) {
        if (cur && ps[i] === cur) { start = i; break; }
    }
    if (start < 0) {
        for (var v = 0; v < ps.length; v++) {
            if (ps[v].style.display === 'none' || ps[v].getAttribute('data-dir-hidden') === 'true') continue;
            if (ps[v].getAttribute('data-outline-level') === '1') { start = v; break; }
        }
    }
    var vis = -1;
    if (typeof window.npIsSingleArticleView === 'function' && window.npIsSingleArticleView() &&
        typeof _npVisibleArticleIndexStart === 'function') {
        vis = _npVisibleArticleIndexStart(ps);
    }
    /* 单篇视图以「当前显示的这一篇」为准；光标还停在上一篇（隐藏段）也不跑偏 */
    if (vis >= 0) start = vis;
    if (start >= 0) {
        for (var j = start; j >= 0; j--) {
            if (ps[j].getAttribute('data-outline-level') !== '1') continue;
            var t = String(ps[j].textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
            if (t) return t;
        }
    }
    return fallback;
}

function _notepadCurrentWindowHtml() {
    if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    var editor = document.getElementById('notepadEditor');
    return editor ? (editor.innerHTML || '') : '';
}

/* 导出用：整窗 HTML，但剥掉「索引标题」段落（data-outline-level="1"）。
   索引标题是给中部标题列表看的内部锚点，不属正文，导出 docx/html 时从它的下一行开始。 */
function _notepadExportableWindowHtml() {
    if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    var editor = document.getElementById('notepadEditor');
    if (!editor) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = editor.innerHTML || '';
    var ps = tmp.querySelectorAll('p');
    for (var i = 0; i < ps.length; i++) {
        if (ps[i].getAttribute('data-outline-level') === '1') {
            var p = ps[i].parentNode;
            if (p) p.removeChild(ps[i]);
        }
    }
    return tmp.innerHTML;
}

function _npEmpty5(v) {
    return [v, v, v, v, v];
}

function _notepadCurrentWindowJsData() {
    if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    var titles = _npEmpty5('…');
    var labels = _npEmpty5('');
    var editorData = [
        { html: '', bold: false }, { html: '', bold: false }, { html: '', bold: false },
        { html: '', bold: false }, { html: '', bold: false }
    ];
    var fontSizes = _npEmpty5(14);
    var notebookStyles = _npEmpty5(false);
    var zoomLevels = _npEmpty5(1);
    for (var i = 0; i < 5; i++) {
        if (typeof notepadTitles !== 'undefined' && notepadTitles[i]) titles[i] = notepadTitles[i];
        if (typeof notepadLabels !== 'undefined' && notepadLabels[i]) labels[i] = notepadLabels[i];
        if (typeof notepadEditorData !== 'undefined' && notepadEditorData[i]) editorData[i] = notepadEditorData[i];
        if (typeof notepadFontSizes !== 'undefined' && notepadFontSizes[i]) fontSizes[i] = notepadFontSizes[i];
        if (typeof notepadNotebookStyles !== 'undefined' && notepadNotebookStyles[i]) notebookStyles[i] = true;
    }
    if (typeof window.notepadZoomLevels !== 'undefined' && Array.isArray(window.notepadZoomLevels)) {
        zoomLevels = window.notepadZoomLevels;
    }
    var data = {
        notepad: {
            data: (typeof notepadData !== 'undefined') ? notepadData : _npEmpty5(''),
            titles: titles,
            labels: labels,
            editorData: editorData,
            fontSizes: fontSizes,
            notebookStyles: notebookStyles,
            zoomLevels: zoomLevels
        }
    };
    return 'var savedData = ' + JSON.stringify(data, null, 2) + ';';
}

function _notepadAllWindowsJsData() {
    if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    var data = {
        notepad: {
            data: (typeof notepadData !== 'undefined') ? notepadData : _npEmpty5(''),
            titles: notepadTitles,
            labels: notepadLabels,
            editorData: notepadEditorData,
            fontSizes: notepadFontSizes,
            notebookStyles: notepadNotebookStyles,
            zoomLevels: (typeof window.notepadZoomLevels !== 'undefined' ? window.notepadZoomLevels : _npEmpty5(1)),
            isMultiPage: true
        }
    };
    return 'var savedData = ' + JSON.stringify(data, null, 2) + ';';
}

/* 导出当前视图为单文件笔记 JS：只取 live 编辑区当前显示的内容，
   不再从 notepadEditorData / 缓存里拼 5 个窗口，避免把别的笔记带出来。 */
/* 整窗正文快照：直接在「保存前」的 live 编辑区副本上摘掉单篇视图留下的
   display:none / data-dir-hidden，不依赖 saveCurrentEditor() 之后的 DOM 状态
   （保存会触发标题栏重绘，重绘可能又把编辑区切回单篇视图）。 */
function _npWholeWindowHtmlSnapshot() {
    var editor = document.getElementById('notepadEditor');
    if (!editor) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = editor.innerHTML || '';
    var hid = tmp.querySelectorAll('[data-dir-hidden="true"], [style*="display:none"], [style*="display: none"]');
    for (var i = 0; i < hid.length; i++) {
        hid[i].removeAttribute('data-dir-hidden');
        hid[i].style.display = '';
    }
    return tmp.innerHTML;
}

function _notepadCurrentViewJsData() {
    /* 先判定「这次要导哪一篇」再保存：顺序反了的话，
       saveCurrentEditor() 引起的重绘可能把编辑区重新切成单篇，
       整窗导出就会莫名其妙只剩光标所在的那一篇。
       这里按编辑区实际隐藏情况判断，不看 _articleOnly 等记账变量
       （记账和 DOM 偶尔不同步，会令整窗导出只剩一篇）。 */
    var single = false;
    try {
        var _ed = document.getElementById('notepadEditor');
        if (_ed) {
            var _ps = _ed.querySelectorAll('p');
            var _hid = 0, _shown = 0;
            for (var _i = 0; _i < _ps.length; _i++) {
                if (!(_ps[_i].textContent || '').trim()) continue;
                if (_ps[_i].style.display === 'none' || _ps[_i].getAttribute('data-dir-hidden') === 'true') _hid++;
                else _shown++;
            }
            single = _hid > 0 && _shown > 0;
        }
    } catch (e) { single = false; }
    var wantArticle = !!window._npExportArticleOnly;
    window._npExportArticleOnly = false;
    var html = '', title = '';
    if (single || wantArticle) {
        if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
        if (typeof _notepadCurrentArticleHtml === 'function') {
            var info = _notepadCurrentArticleHtml();
            if (info && (info.hasIndex || info.html)) {
                html = info.fullHtml || info.html || '';
                title = info.indexTitle || info.title || '';
            }
        }
    }
    if (!html) {
        html = _npWholeWindowHtmlSnapshot();
        title = _npExportIndexTitle() || _notepadSaveTitle();
    }
    if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    if (!title) title = _npExportIndexTitle() || _notepadSaveTitle();
    var idx = (typeof currentNotepadTab === 'number') ? currentNotepadTab : 0;
    var fontSize = (typeof notepadFontSizes !== 'undefined' && notepadFontSizes[idx]) || 14;
    var notebookStyle = !!(typeof notepadNotebookStyles !== 'undefined' && notepadNotebookStyles[idx]);
    var zoom = 1;
    try {
        if (window.notepadZoomLevels && window.notepadZoomLevels[idx]) zoom = window.notepadZoomLevels[idx];
    } catch (e) {}
    var data = {
        file: { version: 1, title: title, updatedAt: new Date().toISOString() },
        notepad: {
            titles: [title],
            labels: ['1'],
            data: [''],
            editorData: [{ html: html, bold: false }],
            fontSizes: [fontSize],
            notebookStyles: [notebookStyle],
            zoomLevels: [zoom],
            singleFile: true
        }
    };
    return 'var savedData = ' + JSON.stringify(data, null, 2) + ';';
}

function _notepadNormalizeExportTitleFonts(html) {
    var wrap = document.createElement('div');
    wrap.innerHTML = html || '';
    var paras = wrap.querySelectorAll('p[data-level="title"], p[data-outline-level="1"]');
    for (var i = 0; i < paras.length; i++) {
        var p = paras[i];
        var isArticleTitle = p.getAttribute('data-level') === 'title' ||
            /方正小标宋|FZXiaoBiaoSong/i.test((p.style.fontFamily || '') + ' ' + (p.innerHTML || ''));
        if (!isArticleTitle) continue;
        p.classList.add('notepadArticleTitle');
        p.style.setProperty('font-family', 'FZXiaoBiaoSong,"方正小标宋简体",serif', 'important');
        p.style.setProperty('font-weight', 'normal', 'important');
        var spans = p.querySelectorAll('span');
        for (var j = 0; j < spans.length; j++) {
            spans[j].style.setProperty('font-family', 'FZXiaoBiaoSong,"方正小标宋简体",serif', 'important');
            spans[j].style.setProperty('font-weight', 'normal', 'important');
        }
    }
    return wrap.innerHTML;
}

function buildNotepadHtmlContentFromHtml(html, title) {
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + escapeHtml(title) + '</title>' +
        '<style>body{font-family:SimSun,宋体,serif;padding:20px;line-height:1.8;}' +
        '[data-level="title"],.notepadArticleTitle{font-family:FZXiaoBiaoSong,"方正小标宋简体",serif !important;font-weight:normal !important;}' +
        '</style></head><body><div>' + _notepadNormalizeExportTitleFonts(html || '') + '</div></body></html>';
}

async function _notepadExportBlobWithPicker(blob, fileName, mime, ext) {
    if (window.showSaveFilePicker) {
        try {
            var opts = { suggestedName: fileName, types: [{ description: String(ext).toUpperCase() + ' 文件', accept: {} }] };
            opts.types[0].accept[mime] = [ext];
            var handle = await window.showSaveFilePicker(opts);
            var writable = await handle.createWritable({ keepExistingData: false });
            await writable.write(blob);
            await writable.close();
            return true;
        } catch (e) {
            if (e && e.name === 'AbortError') return false;
        }
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    return true;
}

async function confirmNotepadExportJsCurrent() {
    try {
        var content = _notepadCurrentViewJsData();
        var name = _npSafeName(_npExportIndexTitle() + '.js');
        await _notepadExportBlobWithPicker(new Blob([content], { type: 'application/javascript;charset=utf-8' }), name, 'application/javascript', '.js');
        if (typeof updateFooterTimestamp === 'function') updateFooterTimestamp();
        showToast('已导出：' + name);
    } catch (e) { showToast('导出失败：' + e.message); }
}

async function confirmNotepadExportJsAll() {
    try {
        var content = _notepadAllWindowsJsData();
        var name = _npSafeName(_notepadExportTimestamp() + ' ' + _notepadSaveTitle() + '.js');
        await _notepadExportBlobWithPicker(new Blob([content], { type: 'application/javascript;charset=utf-8' }), name, 'application/javascript', '.js');
        if (typeof updateFooterTimestamp === 'function') updateFooterTimestamp();
        showToast('已导出：' + name);
    } catch (e) { showToast('导出失败：' + e.message); }
}

/* 导出当前显示的那一篇文章为 html（复用当前文章切片，而不是整个窗口） */
async function confirmNotepadExportHtmlCurrent() {
    try {
        var info = (typeof _notepadCurrentArticleHtml === 'function') ? _notepadCurrentArticleHtml() : { html: '', title: '' };
        var sourceHtml = info.html;
        var title = info.title;
        if (!sourceHtml || !title) {
            sourceHtml = _notepadExportableWindowHtml();
            title = _notepadSaveTitle();
        }
        var name = _npSafeName(_npExportIndexTitle() + '.html');
        var html = buildNotepadHtmlContentFromHtml(sourceHtml, title);
        await _notepadExportBlobWithPicker(new Blob([html], { type: 'text/html;charset=utf-8' }), name, 'text/html', '.html');
        if (typeof updateFooterTimestamp === 'function') updateFooterTimestamp();
        showToast('已导出：' + name);
    } catch (e) { showToast('导出失败：' + e.message); }
}

async function confirmNotepadExportHtml() {
    try {
        var title = _notepadSaveTitle();
        var name = _npSafeName(_notepadExportTimestamp() + ' ' + title + '.html');
        var html = buildNotepadHtmlContentFromHtml(_notepadExportableWindowHtml(), title);
        await _notepadExportBlobWithPicker(new Blob([html], { type: 'text/html;charset=utf-8' }), name, 'text/html', '.html');
        showToast('已导出：' + name);
    } catch (e) { showToast('导出失败：' + e.message); }
}
