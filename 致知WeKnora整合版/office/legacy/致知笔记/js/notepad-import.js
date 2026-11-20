/* ============================================================
   notepad-import.js — 笔记版块：分割导出 / DOCX 导出 / 文件导入
   ============================================================ */

/* ---------- 分割导出 ---------- */
function _notepadCollectArticlesForHtml() {
    if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    var editor = document.getElementById('notepadEditor');
    if (!editor) return [];
    var ps = editor.querySelectorAll('p');
    var articles = [], curr = null, hasOutline = false;
    for (var oi = 0; oi < ps.length; oi++) {
        if (ps[oi].getAttribute('data-outline-level') === '1') { hasOutline = true; break; }
    }
    for (var i = 0; i < ps.length; i++) {
        var isStart = ps[i].getAttribute('data-outline-level') === '1';
        if (!hasOutline && ps[i].getAttribute('data-level') === 'title') isStart = true;
        if (isStart) {
            if (curr) articles.push(curr);
            curr = {
                title: (ps[i].textContent || '').replace(/[\r\n]+/g, ' ').trim(),
                nodes: [ps[i]]
            };
        } else if (curr) {
            if (ps[i].getAttribute('data-level') === 'title' && !curr.articleTitle) {
                curr.articleTitle = (ps[i].textContent || '').replace(/[\r\n]+/g, ' ').trim();
            }
            curr.nodes.push(ps[i]);
        }
    }
    if (curr) articles.push(curr);
    return articles;
}

async function confirmNotepadExportHtmlSplit() {
    try {
        var articles = _notepadCollectArticlesForHtml();
        if (!articles.length) { showToast('未找到可分割导出的文章'); return; }
        var dir = null;
        if (window.showDirectoryPicker) {
            try { dir = await window.showDirectoryPicker({ id: 'notepad-html-split-dir', mode: 'readwrite' }); }
            catch (e) { if (e && e.name === 'AbortError') return; }
        }
        var used = {};
        for (var i = 0; i < articles.length; i++) {
            var art = articles[i];
            var fileTitle = art.title || art.articleTitle || ('文章' + (i + 1));
            var base = _npSafeName(fileTitle).replace(/\.html?$/i, '') || ('文章' + (i + 1));
            var fileName = base + '.html', suffix = 2;
            while (used[fileName]) { fileName = base + '_' + (suffix++) + '.html'; }
            used[fileName] = true;
            var fragment = '';
            for (var j = 0; j < art.nodes.length; j++) fragment += art.nodes[j].outerHTML;
            var doc = buildNotepadHtmlContentFromHtml(fragment, fileTitle);
            if (dir) {
                var fh = await dir.getFileHandle(fileName, { create: true });
                var w = await fh.createWritable({ keepExistingData: false });
                await w.write(new Blob([doc], { type: 'text/html;charset=utf-8' }));
                await w.close();
            } else {
                await _notepadExportBlobWithPicker(new Blob([doc], { type: 'text/html;charset=utf-8' }), fileName, 'text/html', '.html');
                await new Promise(function (r) { setTimeout(r, 80); });
            }
        }
        showToast('已分割导出 ' + articles.length + ' 篇 HTML');
    } catch (e) { showToast('分割导出失败：' + e.message); }
}

/* ---------- DOCX 导出 ---------- */
/* 段落是否在编辑区里可见（单篇显示时非当前篇带 display:none / data-dir-hidden） */
function _npParaVisible(p) {
    if (!p) return false;
    if (p.style && p.style.display === 'none') return false;
    if (p.getAttribute('data-dir-hidden') === 'true') return false;
    if (p.hasAttribute('hidden')) return false;
    return true;
}

/* 当前窗口正在显示的「这一篇」的首个索引标题下标；
   单篇视图以可见段落为准（光标丢了也不会跑偏），全文视图为 -1。 */
function _npVisibleArticleIndexStart(ps) {
    var firstVisible = -1;
    for (var i = 0; i < ps.length; i++) {
        if (!_npParaVisible(ps[i])) continue;
        if (ps[i].getAttribute('data-outline-level') === '1') return i;
        if (firstVisible < 0 && (ps[i].textContent || '').trim()) firstVisible = i;
    }
    if (firstVisible >= 0) {
        for (var j = firstVisible; j >= 0; j--) {
            if (ps[j].getAttribute('data-outline-level') === '1') return j;
        }
    }
    return -1;
}

function _notepadCurrentArticleHtml() {
    var editor = document.getElementById('notepadEditor');
    if (!editor) return { html: '', title: '', hasIndex: false };
    /* 先把 live 编辑区写回归属页签，避免上次打开下拉菜单存下的
       window._notepadSavedRange 被 _notepadRestoreSelection() 恢复——
       那会把光标拉回上一篇的隐藏段落，单篇视图下据此导出的就是别的文章。
       这里写完缓存后清掉选区存档，后面不再恢复。 */
    try { if (typeof window.saveCurrentEditor === 'function') window.saveCurrentEditor(); } catch (e) {}
    window._notepadSavedRange = null;
    var sel = window.getSelection();
    var node = null;
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
        node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
        while (node && node !== editor && node.tagName !== 'P') node = node.parentNode;
        if (!node || node === editor) node = null;
    }
    /* 指向隐藏段段的光标同样不可信 */
    if (node && !_npParaVisible(node)) node = null;
    var ps = editor.querySelectorAll('p');
    var startIdx = -1;
    var visStart = (typeof window.npIsSingleArticleView === 'function' && window.npIsSingleArticleView())
        ? _npVisibleArticleIndexStart(ps) : -1;
    /* 单篇视图：以当前显示的这一篇为准（光标可能还停在上一次选中的隐藏段） */
    if (visStart >= 0) {
        startIdx = visStart;
    } else if (node) {
        for (var i = 0; i < ps.length; i++) { if (ps[i] === node) { startIdx = i; break; } }
    }
    if (startIdx < 0) return { html: '', title: '', hasIndex: false };
    var indexStart = -1;
    for (var j = startIdx; j >= 0; j--) {
        if (ps[j].getAttribute('data-outline-level') === '1') { indexStart = j; break; }
    }
    if (visStart >= 0) indexStart = visStart;
    var articleStart = indexStart;
    if (articleStart < 0) {
        for (var f = startIdx; f >= 0; f--) {
            if (ps[f].getAttribute('data-level') === 'title') { articleStart = f; break; }
        }
    }
    if (articleStart < 0) return { html: '', title: '', hasIndex: false };
    var articleEnd = ps.length;
    for (var k = articleStart + 1; k < ps.length; k++) {
        if (ps[k].getAttribute('data-outline-level') === '1') { articleEnd = k; break; }
    }
    var title = '';
    for (var t = articleStart; t < articleEnd; t++) {
        if (ps[t].getAttribute('data-level') === 'title') {
            title = (ps[t].textContent || '').replace(/[\r\n]+/g, ' ').trim();
            break;
        }
    }
    var indexTitle = '';
    if (indexStart >= 0) {
        indexTitle = (ps[indexStart].textContent || '').replace(/\s+/g, ' ').trim();
    }
    var html = '';
    var fullHtml = '';
    var exportStart = indexStart >= 0 ? articleStart + 1 : articleStart;
    for (var a = articleStart; a < articleEnd; a++) {
        if (ps[a].getAttribute('data-outline-level') === '1' && a !== articleStart) continue;
        fullHtml += ps[a].outerHTML;
        if (a >= exportStart) html += ps[a].outerHTML;
    }
    return { html: html, fullHtml: fullHtml, title: title, indexTitle: indexTitle, hasIndex: indexStart >= 0 };
}

async function confirmNotepadExportDocxCurrent() {
    try {
        var info = _notepadCurrentArticleHtml();
        var tpl = (typeof getDocTemplate === 'function') ? getDocTemplate() : '';
        if (!tpl) { showToast('未找到文档模板'); return; }
        var sourceHtml = info.html, title = info.title;
        if (!info.hasIndex || !title) {
            /* 回落整窗时同样剥掉索引标题，导出内容从索引标题下一行开始 */
            sourceHtml = (typeof _notepadExportableWindowHtml === 'function')
                ? _notepadExportableWindowHtml() : _notepadCurrentWindowHtml();
            title = _notepadSaveTitle();
        }
        var tmp = document.createElement('div');
        tmp.innerHTML = sourceHtml;
        var ps = (typeof collectParagraphs === 'function') ? collectParagraphs(tmp) : [];
        if (!ps.length) { showToast('当前文章内容为空'); return; }
        var xml = tpl.replace('__DOC_BODY__', buildDocBodyXml(ps));
        var name = _npSafeName(_npExportIndexTitle() + '.docx');
        await _notepadExportBlobWithPicker(new Blob([xml], { type: 'application/msword' }), name, 'application/msword', '.docx');
        if (typeof updateFooterTimestamp === 'function') updateFooterTimestamp();
        showToast('已导出：' + name);
    } catch (e) { showToast('导出失败：' + e.message); }
}

async function confirmNotepadExportDocxAll() {
    try {
        var tpl = (typeof getDocTemplate === 'function') ? getDocTemplate() : '';
        if (!tpl) { showToast('未找到文档模板'); return; }
        var editor = document.getElementById('notepadEditor');
        if (!editor) { showToast('未找到编辑框'); return; }
        var ps = collectParagraphs(editor);
        if (!ps.length) { showToast('当前笔记内容为空，无法导出'); return; }
        var xml = tpl.replace('__DOC_BODY__', buildDocBodyXml(ps));
        var name = _npSafeName(_notepadExportTimestamp() + ' ' + _notepadSaveTitle() + '.docx');
        await _notepadExportBlobWithPicker(new Blob([xml], { type: 'application/msword' }), name, 'application/msword', '.docx');
        if (typeof updateFooterTimestamp === 'function') updateFooterTimestamp();
        showToast('已导出：' + name);
    } catch (e) { showToast('导出失败：' + e.message); }
}

/* ---------- 导入：解析 ---------- */
function parseNotepadJsData(content) {
    try {
        var m = String(content || '').match(/var\s+savedData\s*=\s*(\{[\s\S]*?\});/);
        if (!m) return null;
        return JSON.parse(m[1]);
    } catch (e) { return null; }
}

function _isMultiPageJsData(jsData) {
    if (!jsData || !jsData.notepad) return false;
    if (jsData.notepad.isMultiPage === true) return true;
    var titles = jsData.notepad.titles;
    if (!titles || titles.length !== 5) return false;
    var realCount = 0;
    var editorData = jsData.notepad.editorData;
    for (var i = 0; i < 5; i++) {
        if (titles[i] !== '…') realCount++;
        if (editorData && editorData[i] && editorData[i].html && editorData[i].html.trim()) realCount++;
    }
    return realCount >= 5;
}

function _applyNotepadJsData(data) {
    if (!data || !data.notepad) return;
    var np = data.notepad;
    if (np.data) S.notepadData = np.data;
    if (np.labels) S.notepadLabels = np.labels;
    S.notepadTitles = (typeof window._npMergeNotepadTitles === 'function')
        ? window._npMergeNotepadTitles(np.titles, S.notepadTitles)
        : (np.titles || S.notepadTitles);
    S.notepadEditorData = (typeof window._npMergeNotepadEditorData === 'function')
        ? window._npMergeNotepadEditorData(np.editorData, S.notepadEditorData, np.data)
        : (np.editorData || S.notepadEditorData);
    if (np.fontSizes) S.notepadFontSizes = np.fontSizes;
    if (Array.isArray(np.notebookStyles) && np.notebookStyles.length === 5) {
        S.notepadNotebookStyles = np.notebookStyles.map(function (v) { return !!v; });
    }
    if (np.zoomLevels && typeof window.notepadZoomLevels !== 'undefined') {
        window.notepadZoomLevels = np.zoomLevels;
    }
    if (typeof updateNotepadTabs === 'function') updateNotepadTabs();
    if (typeof syncEditorFromData === 'function') syncEditorFromData();
    if (typeof applyNotepadZoom === 'function') applyNotepadZoom();
    if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
}

function showNotepadJsConfirmDialog() {
    return new Promise(function (resolve) {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);z-index:10100;display:flex;align-items:center;justify-content:center;';
        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:8px;padding:20px;max-width:500px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.2);';
        var h = document.createElement('div');
        h.style.cssText = 'font-size:16px;font-weight:bold;margin-bottom:12px;font-family:SimHei,黑体,sans-serif;color:#c0392b;';
        h.textContent = '即将导入多页面数据';
        var msg = document.createElement('div');
        msg.style.cssText = 'font-size:14px;margin-bottom:16px;line-height:1.6;';
        msg.textContent = '导入内容会覆盖现有 5 个页面数据，是否继续？';
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
        var cancel = document.createElement('button');
        cancel.textContent = '取消';
        cancel.style.cssText = 'padding:6px 16px;border:1px solid #ccc;border-radius:4px;cursor:pointer;font-size:13px;background:#fff;';
        cancel.onclick = function () { document.body.removeChild(overlay); resolve(false); };
        var ok = document.createElement('button');
        ok.textContent = '确定导入';
        ok.style.cssText = 'padding:6px 16px;border:1px solid #c0392b;background:#c0392b;color:#fff;border-radius:4px;cursor:pointer;font-size:13px;';
        ok.onclick = function () { document.body.removeChild(overlay); resolve(true); };
        row.appendChild(cancel);
        row.appendChild(ok);
        box.appendChild(h);
        box.appendChild(msg);
        box.appendChild(row);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    });
}

/* ---------- 导入：文件读取 ---------- */
function extractEditorHtmlFromContent(content, ext) {
    if (ext === 'mht') {
        var m = String(content || '').match(/Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]*)/i);
        return m ? m[1].trim() : content;
    }
    var doc = new DOMParser().parseFromString(String(content || ''), 'text/html');
    var h1 = doc.body.querySelector('h1');
    if (h1) h1.remove();
    return doc.body.innerHTML || '';
}

function _notepadLatin1ToString(buf) {
    var u8 = (buf && buf.BYTES_PER_ELEMENT) ? buf : new Uint8Array(buf);
    var out = '', chunk = 0x8000;
    for (var i = 0; i < u8.length; i += chunk) {
        out += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return out;
}

function _notepadReadFileAsSmartText(file) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var buf = e.target.result;
                var head = _notepadLatin1ToString(buf.slice(0, 4096));
                var m = head.match(/charset\s*=\s*["']?\s*([A-Za-z0-9_\-]+)/i);
                var declared = m ? m[1].toLowerCase() : '';
                var enc = 'utf-8';
                if (/^(gb2312|gbk|gb18030|gb_?2312[\-0-9]*|cp936|chinese|x-gbk|csgb2312)$/.test(declared)) {
                    enc = declared === 'gb18030' ? 'gb18030' : 'gbk';
                } else if (/^big5$/.test(declared)) {
                    enc = 'big5';
                }
                var text = null;
                try { text = new TextDecoder(enc, { fatal: true }).decode(buf); }
                catch (err) {
                    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
                    catch (err2) { text = new TextDecoder('gbk').decode(buf); }
                }
                resolve(text);
            } catch (err) { reject(err); }
        };
        reader.onerror = function () { reject(reader.error); };
        reader.readAsArrayBuffer(file);
    });
}

function _notepadCleanHtmlForEditor(html) {
    var frag = String(html || '').match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i);
    var src = frag ? frag[1] : html;
    var doc = new DOMParser().parseFromString(src, 'text/html');
    var remove = ['style', 'script', 'link', 'meta', 'title'];
    for (var t = 0; t < remove.length; t++) {
        var els = doc.getElementsByTagName(remove[t]);
        while (els.length) els[0].parentNode.removeChild(els[0]);
    }
    var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
    var comments = [];
    while (walker.nextNode()) comments.push(walker.currentNode);
    for (var c = 0; c < comments.length; c++) {
        if (comments[c].parentNode) comments[c].parentNode.removeChild(comments[c]);
    }
    return doc.body.innerHTML;
}

/* ---------- 导入：单个文件（标题行「导入」按钮，会先清空编辑区） ---------- */

/* 按扩展名取文件字节，再交给 NpfDocView 渲染成 HTML（doc/docx 走同一套解析） */
function _npImportRenderDocument(file, ext) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var bytes = e.target.result;
            var dv = window.NpfDocView;
            try {
                if (ext === 'docx' || ext === 'doc') {
                    if (!dv) { resolve(''); return; }
                    if (ext === 'docx') {
                        Promise.resolve(dv.renderDocx(bytes)).then(function (res) {
                            resolve((res && res.html) ? res.html : '');
                        }).catch(function () { resolve(''); });
                        return;
                    }
                    var rich = null;
                    try { rich = (window.NpfDoc && window.NpfDoc.richBlocks) ? window.NpfDoc.richBlocks(bytes) : null; } catch (e2) { rich = null; }
                    var resDoc = null;
                    if (rich && dv.renderDocFormat) {
                        try { resDoc = dv.renderDocFormat(rich); } catch (e3) { resDoc = null; }
                    }
                    if (resDoc && resDoc.html) { resolve(resDoc.html); return; }
                    var txt = (window.NpfDoc && window.NpfDoc.plainText) ? window.NpfDoc.plainText(bytes) : '';
                    resolve(txt ? '<p>' + String(txt).split(/\r?\n/).map(function (t) {
                        return escapeHtml(t) || '<br>';
                    }).join('</p><p>') + '</p>' : '');
                    return;
                }
                if (ext === 'mht' || ext === 'mhtml') {
                    resolve(dv && dv.renderMht ? (dv.renderMht(bytes) || '') : '');
                    return;
                }
                resolve(dv && dv.renderHtml ? (dv.renderHtml(bytes) || '') : '');
            } catch (err) { reject(err); }
        };
        reader.onerror = function () { reject(reader.error); };
        reader.readAsArrayBuffer(file);
    });
}

/* 把导入的 HTML 塞进编辑区：剥掉脚本 / 样式表 / 页面骨架，只留正文块。
   renderHtml 返回的是整页字符串，不能当片段直接塞进编辑区。 */
function _npImportCleanForEditor(html) {
    var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    var junk = doc.querySelectorAll('script,link,meta,title,style,base,noscript');
    for (var i = 0; i < junk.length; i++) { if (junk[i].parentNode) junk[i].parentNode.removeChild(junk[i]); }
    var root = doc.body || doc.documentElement;
    var text = (root.textContent || '').replace(/\s+|&nbsp;/gi, '');
    if (!text && !root.querySelector('img,table')) return '';
    return root.innerHTML || '';
}

function _npApplyImportedHtml(html, title) {
    var ed = document.getElementById('notepadEditor');
    if (!ed) { showToast('编辑区未就绪'); return; }
    if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    /* 导入是整篇替换：先清掉单篇显示 / 隐藏标记，再把新内容存回当前笔记 */
    if (typeof window._notepadDirRestoreHidden === 'function') {
        try { window._notepadDirRestoreHidden(); } catch (e) {}
    }
    if (typeof window.npShowWholeDocument === 'function') {
        try { window.npShowWholeDocument(); } catch (e) {}
    }
    var box = document.createElement('div');
    box.innerHTML = html;
    /* 不直接用 box.children[i].outerHTML：浏览器会把表格里游离的单元格等
       自动换行成 div，逐块拼会更稳；只保留段落级 / 块级元素。 */
    var out = '';
    var keep = /^(p|div|table|ul|ol|dl|blockquote|pre|h[1-6]|section|article)$/;
    var NESTED_P = /<(p|div|table|ul|ol|blockquote|pre|h[1-6])\b/i;
    for (var i = 0; i < box.children.length; i++) {
        var el = box.children[i];
        var tag = String(el.tagName || '').toLowerCase();
        var inner = el.innerHTML || '';
        if (keep.test(tag)) {
            if (tag === 'div' && NESTED_P.test(inner)) { out += inner; continue; }
            out += el.outerHTML;
            continue;
        }
        if (inner.trim()) out += '<p>' + inner + '</p>';
    }
    if (!out) out = '<p><br></p>';
    ed.innerHTML = out;
    if (title) {
        notepadTitles[currentNotepadTab] = title;
        var tEl = document.getElementById('notepadTitle');
        if (tEl) tEl.value = title;
    }
    ed.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    if (typeof npRenderDirList === 'function') {
        try { npRenderDirList(); } catch (e) {}
    }
    if (typeof window.npRefreshExportBtn === 'function') {
        try { window.npRefreshExportBtn(); } catch (e) {}
    }
    showToast('导入完成');
}

function npImportDocument() {
    var ed = document.getElementById('notepadEditor');
    var hasContent = !!(ed && (ed.textContent || '').replace(/\s+/g, '').length);
    var input = document.getElementById('npImportFileInput');
    if (!input) { showToast('导入控件未就绪'); return; }
    if (!hasContent) { input.click(); return; }
    var overlay = document.createElement('div');
    overlay.className = 'npImportConfirm';
    overlay.innerHTML = '<div class="npImportConfirmBox">' +
        '<div class="npImportConfirmText">编辑区已有内容，导入会先<b>清空</b>当前内容，且无法撤销。<br>是否继续？</div>' +
        '<div class="npImportConfirmBtns">' +
        '<button type="button" class="npImportOk">清空并导入</button>' +
        '<button type="button" class="npImportCancel">取消</button>' +
        '</div></div>';
    document.body.appendChild(overlay);
    var close = function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); };
    overlay.querySelector('.npImportOk').onclick = function () { close(); input.click(); };
    overlay.querySelector('.npImportCancel').onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };
}

function onNpImportFileSelected(event) {
    var input = event.target;
    var file = input.files && input.files[0];
    if (!file) return;
    var ext = file.name.toLowerCase().replace(/.*\./, '');
    var baseTitle = file.name.replace(/\.[^.]+$/, '');
    var finish = function (html) {
        input.value = '';
        if (!html) { showToast('没能从该文件解析出正文：' + file.name); return; }
        _npApplyImportedHtml(html, baseTitle);
    };
    if (ext === 'js') {
        var reader = new FileReader();
        reader.onload = function (e) {
            var jsData = parseNotepadJsData(e.target.result);
            if (!jsData || !jsData.notepad || !jsData.notepad.editorData) {
                input.value = '';
                showToast('JS 文件格式错误：' + file.name);
                return;
            }
            var html = '';
            var ed0 = jsData.notepad.editorData;
            for (var i = 0; i < ed0.length; i++) {
                if (ed0[i] && ed0[i].html && String(ed0[i].html).trim()) html += ed0[i].html;
            }
            var title = (jsData.notepad.titles && jsData.notepad.titles[0]) || baseTitle;
            finish(html ? _npImportCleanForEditor(html) || html : '');
        };
        reader.onerror = function () { input.value = ''; showToast('文件读取失败'); };
        reader.readAsText(file, 'UTF-8');
        return;
    }
    _npImportRenderDocument(file, ext).then(function (html) {
        finish(_npImportCleanForEditor(html));
    }).catch(function () {
        input.value = '';
        showToast('文件读取失败');
    });
}

window.npImportDocument = npImportDocument;
window.onNpImportFileSelected = onNpImportFileSelected;

/* ---------- 导入：单个文件 ---------- */
function onNotepadOpenFileSelected(event) {
    var file = event.target.files[0];
    if (!file) return;
    var ext = file.name.toLowerCase().replace(/.*\./, '');
    if (ext === 'js') {
        var reader = new FileReader();
        reader.onload = function (e) {
            var jsData = parseNotepadJsData(e.target.result);
            if (!jsData) { showToast('JS 文件格式错误：' + file.name); event.target.value = ''; return; }
            if (_isMultiPageJsData(jsData)) {
                showNotepadJsConfirmDialog().then(function (confirmed) {
                    if (!confirmed) { event.target.value = ''; return; }
                    _applyNotepadJsData(jsData);
                    closeNotepadOpenModal();
                    showToast('多页面数据导入成功');
                    event.target.value = '';
                });
            } else {
                if (!jsData.notepad || !jsData.notepad.editorData) {
                    showToast('JS 文件格式错误：缺少 notepad 数据');
                    event.target.value = '';
                    return;
                }
                var pIdx = 0;
                for (var pi = 0; pi < 5; pi++) {
                    if (jsData.notepad.editorData[pi] && jsData.notepad.editorData[pi].html && jsData.notepad.editorData[pi].html.trim()) { pIdx = pi; break; }
                }
                var pData = jsData.notepad.editorData[pIdx] || { html: '', bold: false };
                var pTitle = (jsData.notepad.titles && jsData.notepad.titles[pIdx]) || file.name.replace(/\.js$/i, '');
                if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
                notepadTitles[currentNotepadTab] = pTitle;
                notepadEditorData[currentNotepadTab].html = pData.html || '';
                notepadEditorData[currentNotepadTab].bold = pData.bold || false;
                document.getElementById('notepadTitle').value = pTitle;
                document.getElementById('notepadEditor').innerHTML = notepadEditorData[currentNotepadTab].html;
                closeNotepadOpenModal();
                showToast('导入成功：' + file.name);
                event.target.value = '';
            }
        };
        reader.onerror = function () { showToast('文件读取失败'); event.target.value = ''; };
        reader.readAsText(file, 'UTF-8');
        return;
    }
    _notepadReadFileAsSmartText(file).then(function (content) {
        var editorHtml = (ext === 'mht') ? extractEditorHtmlFromContent(content, ext) : _notepadCleanHtmlForEditor(content);
        var title = file.name.replace(/\.(html|htm|mht)$/i, '');
        if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
        notepadTitles[currentNotepadTab] = title;
        notepadEditorData[currentNotepadTab].html = editorHtml;
        document.getElementById('notepadTitle').value = title;
        document.getElementById('notepadEditor').innerHTML = editorHtml;
        closeNotepadOpenModal();
        showToast('导入成功：' + file.name);
        event.target.value = '';
    }).catch(function () {
        showToast('文件读取失败');
        event.target.value = '';
    });
}
