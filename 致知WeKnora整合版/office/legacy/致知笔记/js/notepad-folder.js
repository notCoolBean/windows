/* ============================================================
   notepad-folder.js — 笔记版块：文件夹导入（弹窗 / 列表 / 批量导入）
   ============================================================ */

function _npOpenModalSetFolderBar(text) {
    var bar = document.getElementById('notepadOpenModalFolderBar');
    var span = document.getElementById('notepadOpenModalFolderText');
    if (bar) bar.style.display = 'flex';
    if (span) span.textContent = text || '';
}

function showNotepadOpenModal() {
    var modal = document.getElementById('notepadOpenModal');
    var body = document.getElementById('notepadOpenModalBody');
    var empty = document.getElementById('notepadOpenModalEmpty');
    if (!modal) return;
    if (body) body.innerHTML = '';
    if (empty) empty.style.display = 'none';
    modal.classList.add('show');
    var sel = document.getElementById('notepadOpenSubfolderSelect');
    if (sel) { sel.style.display = 'none'; sel.innerHTML = ''; }

    if (notepadImportFileMap && Object.keys(notepadImportFileMap).length) {
        _npOpenModalSetFolderBar('已选择文件夹');
        refreshNotepadOpenList();
        return;
    }
    _npOpenModalSetFolderBar(notepadDirHandle ? notepadDirHandle.name : '（未选择文件夹）');
    var restore = (typeof tryRestoreNotebookRoot === 'function') ? tryRestoreNotebookRoot() : Promise.resolve(null);
    restore.then(function (h) {
        if (h && !notepadDirHandle) {
            notepadDirHandle = h;
            notepadSelectedDirHandle = h;
            _npOpenModalSetFolderBar(h.name);
            refreshNotepadOpenList();
        } else if (!notepadDirHandle && body) {
            body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">请点击「更改目录」选择笔记文件夹，或点「打开其他文件」导入单个文件</td></tr>';
        } else if (notepadDirHandle) {
            refreshNotepadOpenList();
        }
    }).catch(function () {
        if (body && !notepadDirHandle) {
            body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">请点击「更改目录」选择笔记文件夹</td></tr>';
        }
    });
}

function closeNotepadOpenModal() {
    var modal = document.getElementById('notepadOpenModal');
    if (modal) modal.classList.remove('show');
}

async function selectNotepadRootDir() {
    var folderInput = document.getElementById('notepadImportFolderInput');
    if (!window.showDirectoryPicker) {
        if (folderInput) folderInput.click();
        return;
    }
    var handle = null;
    try {
        handle = (typeof pickNotebookRoot === 'function')
            ? await pickNotebookRoot()
            : await window.showDirectoryPicker({ id: 'notebook-root', mode: 'readwrite' });
    } catch (e) {
        if (folderInput) folderInput.click();
        return;
    }
    if (!handle) { if (folderInput) folderInput.click(); return; }
    notepadDirHandle = handle;
    notepadSelectedDirHandle = handle;
    notepadFolderEntries = [];
    notepadScannedHandleMap = {};
    try {
        for await (var entry of handle.values()) {
            if (entry.kind === 'directory') notepadFolderEntries.push(entry.name);
        }
    } catch (e) {}
    notepadFolderEntries.sort();
    _npOpenModalSetFolderBar(handle.name);
    refreshNotepadOpenList();
}

function changeNotepadOpenRootFolder() {
    idbPut('notebookRootHandle', null);
    notepadDirHandle = null;
    notepadSelectedDirHandle = null;
    notepadFolderEntries = [];
    notepadScannedHandleMap = {};
    notepadImportFileMap = {};
    showNotepadOpenModal();
}

function onNotepadImportFolderSelected(event) {
    var files = event.target.files;
    if (!files || !files.length) { showToast('未选择文件夹'); return; }
    notepadImportFileMap = {};
    notepadScannedHandleMap = {};
    var seen = {};
    for (var i = 0; i < files.length; i++) {
        var fname = files[i].name;
        var ext = fname.toLowerCase().replace(/.*\./, '');
        if ((ext === 'html' || ext === 'htm' || ext === 'mht' || ext === 'js') && !seen[fname]) {
            seen[fname] = true;
            notepadImportFileMap[fname] = files[i];
        }
    }
    if (!Object.keys(notepadImportFileMap).length) {
        showToast('该文件夹下未找到 .html .htm .mht .js 文件');
        event.target.value = '';
        return;
    }
    notepadDirHandle = null;
    notepadSelectedDirHandle = null;
    notepadFolderEntries = [];
    var sel = document.getElementById('notepadOpenSubfolderSelect');
    if (sel) sel.style.display = 'none';
    _npOpenModalSetFolderBar('已选择文件夹');
    refreshNotepadOpenList();
    event.target.value = '';
}

function refreshNotepadOpenList() {
    var body = document.getElementById('notepadOpenModalBody');
    var empty = document.getElementById('notepadOpenModalEmpty');
    if (!body) return;
    var files = [];
    var importMode = notepadImportFileMap && Object.keys(notepadImportFileMap).length > 0;
    if (importMode) {
        for (var fname in notepadImportFileMap) {
            if (!Object.prototype.hasOwnProperty.call(notepadImportFileMap, fname)) continue;
            files.push({ name: fname, handle: notepadImportFileMap[fname] });
        }
        files.sort(function (a, b) { return a.name.localeCompare(b.name); });
    } else if (notepadSelectedDirHandle || notepadDirHandle) {
        body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">正在读取…</td></tr>';
        var dirH = notepadSelectedDirHandle || notepadDirHandle;
        readDirThenRender(dirH);
        return;
    } else {
        body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">请先选择文件夹</td></tr>';
        if (empty) empty.style.display = 'none';
        return;
    }
    renderOpenList(files);
}

async function readDirThenRender(dirH) {
    var body = document.getElementById('notepadOpenModalBody');
    var empty = document.getElementById('notepadOpenModalEmpty');
    var ok = true;
    try { ok = await verifyPermission(dirH, true); } catch (e) { ok = false; }
    if (!ok) {
        body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">文件夹权限已失效，请点「更改目录」重新选择</td></tr>';
        if (empty) empty.style.display = 'none';
        return;
    }
    var files = [];
    try {
        for await (var entry of dirH.values()) {
            if (entry.kind !== 'file') continue;
            var ext = entry.name.toLowerCase().replace(/.*\./, '');
            if (ext === 'html' || ext === 'htm' || ext === 'mht' || ext === 'js') {
                files.push({ name: entry.name, handle: entry });
            }
        }
    } catch (e) {
        body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">读取失败</td></tr>';
        return;
    }
    files.sort(function (a, b) { return a.name.localeCompare(b.name); });
    renderOpenList(files);
}

function renderOpenList(files) {
    var body = document.getElementById('notepadOpenModalBody');
    var empty = document.getElementById('notepadOpenModalEmpty');
    if (!body) return;
    notepadScannedHandleMap = {};
    for (var i = 0; i < files.length; i++) {
        if (files[i].handle && typeof files[i].handle.getFile === 'function') {
            notepadScannedHandleMap[files[i].name] = files[i].handle;
        }
    }
    if (!files.length) {
        body.innerHTML = '';
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';
    body.innerHTML = '';
    for (var k = 0; k < files.length; k++) {
        (function (fname, idx) {
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (idx + 1) + '</td>' +
                '<td style="text-align:left;padding-left:15px;">' + escapeHtml(fname) + '</td>' +
                '<td><input type="checkbox" value="' + String(fname).replace(/"/g, '&quot;') + '"></td>';
            tr.addEventListener('click', function (e) {
                var cb = tr.querySelector('input[type="checkbox"]');
                if (!cb) return;
                if (e.target.tagName !== 'INPUT') cb.checked = !cb.checked;
                tr.classList.toggle('selected', cb.checked);
            });
            body.appendChild(tr);
        })(files[k].name, k);
    }
}

async function confirmNotepadOpen() {
    var checks = document.querySelectorAll('#notepadOpenModalBody input[type="checkbox"]:checked');
    if (!checks.length) { showToast('请至少选择一个文件'); return; }
    var selected = [];
    for (var i = 0; i < checks.length; i++) selected.push(checks[i].value);

    var imported = 0;
    var tabIdx = currentNotepadTab;
    for (var fi = 0; fi < selected.length; fi++) {
        var fileName = selected[fi];
        var ext = fileName.toLowerCase().replace(/.*\./, '');
        var fileObj = null;
        if (notepadImportFileMap && notepadImportFileMap[fileName]) {
            fileObj = notepadImportFileMap[fileName];
        } else if (notepadScannedHandleMap[fileName]) {
            try { fileObj = await notepadScannedHandleMap[fileName].getFile(); } catch (e) { fileObj = null; }
        }
        if (!fileObj) {
            var readH = notepadSelectedDirHandle || notepadDirHandle;
            if (readH) {
                try {
                    var fh = await readH.getFileHandle(fileName);
                    fileObj = await fh.getFile();
                } catch (e) { fileObj = null; }
            }
        }
        if (!fileObj) { showToast('无法读取文件：' + fileName); continue; }

        if (ext === 'js') {
            var content = await _notepadReadFileAsSmartText(fileObj);
            var jsData = parseNotepadJsData(content);
            if (!jsData) { showToast('JS 文件格式错误：' + fileName); continue; }
            if (_isMultiPageJsData(jsData)) {
                var confirmed = await showNotepadJsConfirmDialog();
                if (!confirmed) continue;
                if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
                closeNotepadOpenModal();
                _applyNotepadJsData(jsData);
                showToast('多页面数据导入成功');
                imported += 1;
                break;
            }
            if (!jsData.notepad || !jsData.notepad.editorData) { showToast('JS 文件格式错误：缺少 notepad 数据'); continue; }
            if (tabIdx >= 5) tabIdx = 0;
            var pIdx = 0;
            for (var pi = 0; pi < 5; pi++) {
                if (jsData.notepad.editorData[pi] && jsData.notepad.editorData[pi].html && jsData.notepad.editorData[pi].html.trim()) { pIdx = pi; break; }
            }
            var pData = jsData.notepad.editorData[pIdx] || { html: '', bold: false };
            var pTitle = (jsData.notepad.titles && jsData.notepad.titles[pIdx]) || fileName.replace(/\.js$/i, '');
            if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
            notepadTitles[tabIdx] = pTitle;
            notepadEditorData[tabIdx].html = pData.html || '';
            notepadEditorData[tabIdx].bold = pData.bold || false;
            if (tabIdx === currentNotepadTab) {
                var tEl = document.getElementById('notepadTitle');
                if (tEl) tEl.value = pTitle;
                var eEl = document.getElementById('notepadEditor');
                if (eEl) eEl.innerHTML = notepadEditorData[tabIdx].html;
            }
            tabIdx += 1;
        } else {
            var htmlContent = await _notepadReadFileAsSmartText(fileObj);
            var editorHtml = (ext === 'mht') ? extractEditorHtmlFromContent(htmlContent, ext) : _notepadCleanHtmlForEditor(htmlContent);
            var title = fileName.replace(/\.(html|htm|mht)$/i, '');
            if (tabIdx >= 5) tabIdx = 0;
            if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
            notepadTitles[tabIdx] = title;
            notepadEditorData[tabIdx].html = editorHtml;
            if (tabIdx === currentNotepadTab) {
                var tEl2 = document.getElementById('notepadTitle');
                if (tEl2) tEl2.value = title;
                var eEl2 = document.getElementById('notepadEditor');
                if (eEl2) eEl2.innerHTML = editorHtml;
            }
            tabIdx += 1;
        }
        imported += 1;
    }
    closeNotepadOpenModal();
    if (imported > 0) {
        if (typeof updateNotepadTabs === 'function') updateNotepadTabs();
        if (typeof updateNotepadTabStyle === 'function') updateNotepadTabStyle();
        if (typeof syncEditorFromData === 'function') syncEditorFromData();
        if (typeof applyNotepadZoom === 'function') applyNotepadZoom();
        if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
        showToast('导入完成：' + imported + ' 个文件');
    }
}
