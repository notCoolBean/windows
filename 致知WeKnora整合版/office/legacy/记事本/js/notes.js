/* ============================================================
   notes.js — 随记/笔记管理
   ============================================================ */

        function _normalizeNoteCategories(nc) {
            if (!nc || !nc.length) return [{ id: 0, name: '默认' }];
            if (typeof nc[0] === 'string') { return nc.map(function(s, i) { return { id: i, name: s }; }); }
            return nc;
        }
         _noteCategories = _normalizeNoteCategories(DataLayer.get('noteCategories')).map(function(c) { return { id: c.id, name: c.name, locked: !!c.locked, lockPassword: c.lockPassword || '' }; });
         var _noteUnlockedCategories = {};
        var _noteLockTargetId = null;
        var _noteLockMode = '';
        function openNoteLockModal(id, mode) {
            var cat = (_noteCatEditCopy || []).filter(function(c) { return c.id === id; })[0] || _noteCatIdToObj(id);
            if (!cat) return;
            _noteLockTargetId = id;
            _noteLockMode = mode;
            document.getElementById('noteLockTitle').textContent = mode === 'verify' ? '输入类别锁定密码' : (mode === 'change' ? '修改类别锁定密码' : '设置类别锁定密码');
            document.getElementById('noteLockVerifyField').style.display = mode === 'verify' ? 'flex' : 'none';
            document.getElementById('noteLockOldField').style.display = mode === 'change' ? 'flex' : 'none';
            document.getElementById('noteLockPasswordField').style.display = mode === 'verify' ? 'none' : 'flex';
            document.getElementById('noteLockPasswordConfirm').parentNode.style.display = mode === 'verify' ? 'none' : 'flex';
            document.getElementById('noteLockVerifyPassword').value = '';
            document.getElementById('noteLockOldPassword').value = '';
            document.getElementById('noteLockPassword').value = '';
            document.getElementById('noteLockPasswordConfirm').value = '';
            document.getElementById('noteLockModal').classList.add('show');
            setTimeout(function() { document.getElementById(mode === 'verify' ? 'noteLockVerifyPassword' : mode === 'change' ? 'noteLockOldPassword' : 'noteLockPassword').focus(); }, 0);
        }
        function closeNoteLockModal() { document.getElementById('noteLockModal').classList.remove('show'); _noteLockTargetId = null; _noteLockMode = ''; }
        function confirmNoteCategoryLock() {
            var id = _noteLockTargetId, mode = _noteLockMode;
            var cat = (_noteCatEditCopy || []).filter(function(c) { return c.id === id; })[0] || _noteCatIdToObj(id);
            if (!cat) return;
            if (mode === 'verify') {
                if (document.getElementById('noteLockVerifyPassword').value !== cat.lockPassword) { alert('密码错误'); return; }
                _noteUnlockedCategories[id] = true;
                closeNoteLockModal();
                refreshNoteCategorySelect();
                renderNotes();
                return;
            }
            if (mode === 'change' && document.getElementById('noteLockOldPassword').value !== cat.lockPassword) { alert('旧密码错误'); return; }
            var p = document.getElementById('noteLockPassword').value;
            if (p !== document.getElementById('noteLockPasswordConfirm').value) { alert('两次输入的密码不一致'); return; }
            if (p === '') { alert('锁定密码不能为空'); return; }
            if (mode === 'change' && p === '') { cat.locked = false; cat.lockPassword = ''; delete _noteUnlockedCategories[id]; }
            else { cat.locked = true; cat.lockPassword = p; }
            closeNoteLockModal();
            if (_noteCatEditCopy) window._noteCategoryRenderRows();
            else { _saveNoteCategories(); refreshNoteCategorySelect(); renderNotes(); }
        }
        function _noteCatIdToObj(id) { for (var i = 0; i < _noteCategories.length; i++) { if (_noteCategories[i].id === id) return _noteCategories[i]; } return null; }
        function _noteCatNameToId(name) { for (var i = 0; i < _noteCategories.length; i++) { if (_noteCategories[i].name === name) return _noteCategories[i].id; } return _noteCategories[0].id; }
        _noteCurrentCategory = (function() {
            var stored = DataLayer.getRaw('noteCurrentCategory');
            if (stored === 'all') return 'all';
            var n = parseInt(stored, 10);
            if (!isNaN(n) && _noteCatIdToObj(n)) return n;
            if (typeof stored === 'string' && stored) return _noteCatNameToId(stored);
            return _noteCategories[0].id;
        })();
        var _noteSearchKw = '';
        var _noteSortOrder = 'desc';
        notes = DataLayer.get('notes') || [];
        (function() {
            var migrated = false;
            for (var i = 0; i < notes.length; i++) {
                var c = notes[i].category;
                if (typeof c === 'string') { notes[i].category = _noteCatNameToId(c); migrated = true; }
                else if (typeof c !== 'number') { notes[i].category = _noteCategories[0].id; migrated = true; }
                else if (!_noteCatIdToObj(c)) { notes[i].category = _noteCategories[0].id; migrated = true; }
            }
            if (migrated) { try { DataLayer.set('notes', notes) } catch (e) {} }
        })();
        if (_noteCurrentCategory !== 'all' && !_noteCatIdToObj(_noteCurrentCategory)) { _noteCurrentCategory = _noteCategories[0].id; }

        function _saveNotes() { try { DataLayer.set('notes', notes) } catch (e) {} }
        function _saveNoteCategories() { try { DataLayer.set('noteCategories', _noteCategories) } catch (e) {} }
        function _saveNoteCurrentCategory() { try { DataLayer.setRaw('noteCurrentCategory', String(_noteCurrentCategory)); } catch (e) {} }

        function _nowNoteTimeStr() {
            var d = new Date();
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        }

        function switchReminderTab(tab) {
            _reminderTab = tab;
            _saveReminderTab();
            document.getElementById('reminderTabBtnList').classList.toggle('active', tab === 'list');
            document.getElementById('reminderTabBtnNote').classList.toggle('active', tab === 'note');
            document.getElementById('reminderPaneList').classList.toggle('active', tab === 'list');
            document.getElementById('reminderPaneNote').classList.toggle('active', tab === 'note');
            document.getElementById('noteCategorySelectWrap').style.display = (tab === 'note') ? 'flex' : 'none';
            var si = document.getElementById('reminderSearchInput');
            if (tab === 'list') {
                renderReminders();
            } else {
                renderNotes();
            }
        }

        function onReminderSearchInput() {
            var kw = (document.getElementById('reminderSearchInput').value || '').trim().toLowerCase();
            _noteSearchKw = kw;
            if (_reminderTab === 'list') {
                renderReminders();
            } else {
                renderNotes();
            }
        }

        function refreshNoteCategorySelect() {
            var sel = document.getElementById('noteCategorySelect');
            sel.innerHTML = '';
            for (var i = 0; i < _noteCategories.length; i++) {
                var opt = document.createElement('option');
                opt.value = _noteCategories[i].id;
                opt.textContent = _noteCategories[i].name + (_noteCategories[i].locked ? ' 🔒' : '');
                sel.appendChild(opt);
            }
            var optAll = document.createElement('option');
            optAll.value = 'all';
            optAll.textContent = '—— 全部';
            sel.appendChild(optAll);
            sel.value = String(_noteCurrentCategory);
        }

        function switchNoteCategory(val) {
            var nextCategory = 'all';
            if (val !== 'all') {
                var n = parseInt(val, 10);
                nextCategory = isNaN(n) ? _noteCategories[0].id : n;
                var cat = _noteCatIdToObj(nextCategory);
                if (cat && cat.locked && !_noteUnlockedCategories[cat.id]) {
                    openNoteLockModal(cat.id, 'verify');
                    var sel = document.getElementById('noteCategorySelect');
                    if (sel) sel.value = String(_noteCurrentCategory);
                    return;
                }
            }
            _noteCurrentCategory = nextCategory;
            _saveNoteCurrentCategory();
            renderNotes();
        }

        function setNoteSortOrder(order) {
            _noteSortOrder = order;
            var ascBtn = document.getElementById('noteSortAscBtn');
            var descBtn = document.getElementById('noteSortDescBtn');
            if (ascBtn) ascBtn.classList.toggle('active', order === 'asc');
            if (descBtn) descBtn.classList.toggle('active', order === 'desc');
            renderNotes();
        }
        function openNoteImportPicker() {
            var input = document.getElementById('noteImportInput');
            if (input) { input.value = ''; input.click(); }
        }
        function toggleNoteExportMenu(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            var menu = document.getElementById('noteExportMenu');
            if (menu) menu.classList.toggle('show');
        }
        function closeNoteExportMenu() {
            var menu = document.getElementById('noteExportMenu');
            if (menu) menu.classList.remove('show');
        }
        function _noteExportStamp() {
            var d = new Date();
            return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
        }
        function _noteExportRows() {
            var rows = notes.filter(function(n) {
                var c = (typeof n.category === 'number') ? n.category : _noteCategories[0].id;
                var cat = _noteCatIdToObj(c);
                if (cat && cat.locked && _noteCurrentCategory === 'all') return false;
                if (cat && cat.locked && _noteCurrentCategory === c && !_noteUnlockedCategories[c]) return false;
                if (_noteCurrentCategory !== 'all' && c !== _noteCurrentCategory) return false;
                if (_noteSearchKw && (String(n.content || '').toLowerCase().indexOf(_noteSearchKw) === -1 && String(n.source || '').toLowerCase().indexOf(_noteSearchKw) === -1)) return false;
                return true;
            });
            return rows.sort(function(a, b) {
                var ta = a.time || '', tb = b.time || '';
                if (ta === tb) return 0;
                return _noteSortOrder === 'asc' ? (ta < tb ? -1 : 1) : (ta < tb ? 1 : -1);
            });
        }
        function _noteExportCategory(id) { var c = _noteCatIdToObj(id); return c ? c.name : '默认'; }
        function _noteExportData() {
            return { format: '随记', version: 1, notes: _noteExportRows().map(function(n) {
                return { time: n.time || '', content: n.content || '', source: n.source || '', category: _noteExportCategory(n.category) };
            }) };
        }
        function _noteDownload(blob, name) {
            var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
            showToast('已导出：' + name);
        }
        function _noteExportFile(blob, name, mime, ext) {
            if (window.showSaveFilePicker) {
                (async function() {
                    try {
                        var opts = { suggestedName: name, types: [{ description: ext.toUpperCase() + ' 文件', accept: {} }] };
                        opts.types[0].accept[mime] = [ext];
                        var h = await window.showSaveFilePicker(opts);
                        var w = await h.createWritable({ keepExistingData: false }); await w.write(blob); await w.close();
                        showToast('已导出：' + name);
                    } catch (e) { if (!e || e.name !== 'AbortError') _noteDownload(blob, name); }
                })();
            } else _noteDownload(blob, name);
        }
        function _noteExportHtmlText() {
            var rows = _noteExportRows(), html = '';
            var now = new Date();
            var dateText = '（' + now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日）';
            html += '<p class="officialTitle">随记</p><p class="officialDate">' + dateText + '</p><p class="officialBlankLine">&nbsp;</p>';
            for (var i = 0; i < rows.length; i++) {
                var n = rows[i];
                if (i) html += '<div class="noteExportDivider">————————————————————————————————————</div>';
                html += '<div class="noteExportRecord"><p class="noteExportMeta">【' + escapeHtml(_noteExportCategory(n.category)) + '】' + escapeHtml(n.source || '') + '<span class="noteExportTime">' + escapeHtml(n.time || '') + '</span></p>';
                var noteParas = String(n.content || '').split(/\r?\n/);
                for (var npi = 0; npi < noteParas.length; npi++) html += '<p class="noteExportContent">' + (noteParas[npi] ? escapeHtml(noteParas[npi]) : '&nbsp;') + '</p>';
                html += '</div>';
            }
            return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>随记</title><style>@page{size:A4;margin:2.54cm 3.18cm 2.54cm 3.18cm}@media print{.officialHeader{position:fixed;top:-1.6cm;left:0;right:0;text-align:center;font:10.5pt SimSun,宋体,serif}.officialFooter{position:fixed;bottom:-1.6cm;left:0;right:0;text-align:center;font:10.5pt SimSun,宋体,serif}.officialFooter:after{content:"— " counter(page) " —"}}body{font-family:SimSun,宋体,serif;margin:0;line-height:1.8;color:#000}.officialHeader{display:none}.officialFooter{display:none}.officialTitle{font-family:FZXiaoBiaoSong,"方正小标宋简体",serif;font-size:22pt;text-align:center;margin:0 0 18pt;font-weight:normal}.officialDate{font-family:KaiTi_GB2312,"楷体_GB2312",KaiTi,"楷体",serif;font-size:16pt;text-align:center;margin:0}.officialBlankLine{font-size:16pt;line-height:1.8;margin:0}.noteExportRecord{margin:0 0 10pt}.noteExportMeta{font-family:SimHei,"黑体",sans-serif;font-size:16pt;font-weight:normal;margin:0;text-indent:0}.noteExportTime{font-family:KaiTi_GB2312,"楷体_GB2312",KaiTi,"楷体",serif;color:#888;font-size:14pt;margin-left:8pt}.noteExportContent{font-family:FangSong_GB2312,"仿宋_GB2312",FangSong,"仿宋",serif;font-size:16pt;text-indent:2em;margin:0;white-space:normal}.noteExportDivider{text-align:center;white-space:nowrap;color:#888;margin:5pt auto;width:100%}</style></head><body><div class="officialHeader">随记</div><div class="officialFooter"></div>' + html + '<scr' + 'ipt type="application/json" id="notesExportData">' + JSON.stringify(_noteExportData()).replace(/</g, '\\u003c') + '<\/scr' + 'ipt></body></html>';
        }
        function exportNotesHtml() { _noteExportFile(new Blob([_noteExportHtmlText()], { type: 'text/html;charset=utf-8' }), _noteExportStamp() + ' 随记.html', 'text/html', '.html'); }
        function exportNotesJs() { _noteExportFile(new Blob(['var savedData = ' + JSON.stringify(_noteExportData(), null, 2) + ';'], { type: 'application/javascript' }), _noteExportStamp() + ' 随记.js', 'application/javascript', '.js'); }
        function _noteExportParagraphsForDocx() {
            var rows = _noteExportRows(), paras = [];
            paras.push({ align: 'center', indent: '0', lineHeight: '1.8', runs: [{ text: '随记', font: '方正小标宋简体', size: 40, bold: false }] });
            var d = new Date();
            paras.push({ align: 'center', indent: '0', lineHeight: '1.8', runs: [{ text: '（' + d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日）', font: '楷体_GB2312', size: 32, bold: false }] });
            paras.push({ align: 'center', indent: '0', lineHeight: '1.8', runs: [] });
            for (var i = 0; i < rows.length; i++) {
                var n = rows[i];
                if (i) paras.push({ align: 'center', indent: '0', lineHeight: '1.8', runs: [{ text: '————————————————————————————————————', font: '宋体', size: 24, bold: false }] });
                paras.push({ align: 'left', indent: '0', lineHeight: '1.8', runs: [
                    { text: '【' + _noteExportCategory(n.category) + '】' + (n.source || ''), font: '黑体', size: 32, bold: false },
                    { text: n.time ? ' ' + n.time : '', font: '楷体_GB2312', size: 28, bold: false }
                ] });
                var contentParas = String(n.content || '').split(/\r?\n/);
                for (var cpi = 0; cpi < contentParas.length; cpi++) {
                    paras.push({ align: 'left', indent: '2em', lineHeight: '1.8', runs: contentParas[cpi] ? [{ text: contentParas[cpi], font: '仿宋_GB2312', size: 32, bold: false }] : [] });
                }
            }
            return paras;
        }
        async function exportNotesDocx() {
            try {
                var tpl = getDocTemplate();
                if (!tpl) { showToast('未找到文档模板'); return; }
                var xml = tpl.replace('__DOC_BODY__', buildDocBodyXml(_noteExportParagraphsForDocx()));
                await _notepadExportBlobWithPicker(new Blob([xml], { type: 'application/msword' }), _noteExportStamp() + ' 随记.docx', 'application/msword', '.docx');
            } catch (e) { showToast('导出失败: ' + e.message); }
        }
        function _noteImportCategory(name) {
            name = String(name || '默认').trim() || '默认';
            for (var i = 0; i < _noteCategories.length; i++) if (_noteCategories[i].name === name) return _noteCategories[i].id;
            var max = -1; for (var j = 0; j < _noteCategories.length; j++) max = Math.max(max, _noteCategories[j].id);
            _noteCategories.push({ id: max + 1, name: name, locked: false, lockPassword: '' }); return max + 1;
        }
        function _noteParseImport(text, fileName) {
            var data = null;
            if (/\.js$/i.test(fileName) || /savedData\s*=/.test(text)) {
                var eq = text.indexOf('='), end = text.lastIndexOf(';');
                try { data = JSON.parse(text.slice(eq + 1, end > eq ? end : text.length).trim()); } catch (e) {}
            }
            if (!data) {
                try {
                    var doc = new DOMParser().parseFromString(text, 'text/html'), json = doc.getElementById('notesExportData');
                    if (json) data = JSON.parse(json.textContent || '{}');
                    if (!data) { data = { notes: [] }; doc.querySelectorAll('.noteExportRecord').forEach(function(el) { data.notes.push({ content: (el.querySelector('.noteExportContent') || {}).innerText || '', source: (el.querySelector('.noteExportSource') || {}).innerText || '', time: (el.querySelector('.noteExportTime') || {}).innerText || '', category: '默认' }); }); }
                } catch (e2) {}
            }
            if (data && data.notes) return data.notes;
            if (data && data.savedData && data.savedData.notes) return data.savedData.notes;
            return [];
        }
        function importNotesFromFile(input) {
            var file = input && input.files && input.files[0]; if (!file) return;
            var reader = new FileReader();
            reader.onload = function() {
                var arr = _noteParseImport(String(reader.result || ''), file.name), count = 0;
                // 去重：检查是否已存在相同内容和时间的随记
                for (var i = 0; i < arr.length; i++) {
                    var n = arr[i] || {}, content = String(n.content || '').trim();
                    if (!content) continue;
                    var noteTime = String(n.time || _nowNoteTimeStr());
                    // 检查是否已存在相同内容和时间的随记
                    var isDuplicate = false;
                    for (var j = 0; j < notes.length; j++) {
                        if (notes[j].content === content && notes[j].time === noteTime) {
                            isDuplicate = true;
                            break;
                        }
                    }
                    if (isDuplicate) continue;
                    notes.push({ id: Date.now() + i, time: noteTime, content: content, source: String(n.source || ''), category: _noteImportCategory(typeof n.category === 'string' ? n.category : '默认') });
                    count++;
                }
                _saveNoteCategories(); _saveNotes(); refreshNoteCategorySelect(); renderNotes(); updateFooterTimestamp();
                if (count > 0) {
                    showToast('已追加导入' + count + '条随记');
                } else {
                    showToast('没有新的随记需要导入（可能已存在）');
                }
                input.value = ''; // 清空文件选择，允许重复选择同一文件
            };
            reader.readAsText(file, 'utf-8');
        }

        var _noteCatEditCopy = null;
        var _noteCatCtxIdx = -1;
        function hideNoteCategoryItemMenu() {
            var menu = document.getElementById('noteCategoryItemMenu');
            if (menu) menu.classList.remove('show');
            _noteCatCtxIdx = -1;
        }
        var _noteCatDragSrc = -1;
        function openNoteCategoryModal() {
            var listEl = document.getElementById('noteCategoryList');
            _noteCatEditCopy = _noteCategories.map(function(c) { return { id: c.id, name: c.name, locked: !!c.locked, lockPassword: c.lockPassword || '' }; });
            var _renderCatRows = function() {
                listEl.innerHTML = '';
                for (var i = 0; i < _noteCatEditCopy.length; i++) {
                    (function(idx) {
                        var row = document.createElement('div');
                        row.className = 'noteCategoryRow';
                        row.dataset.idx = String(idx);
                        var handle = document.createElement('button');
                        handle.className = 'ncDragHandle';
                        handle.textContent = '⋮⋮';
                        handle.title = '拖动排序';
                        handle.draggable = true;
                        var upBtn = document.createElement('button');
                        upBtn.className = 'ncMoveBtn ncUpBtn';
                        upBtn.textContent = '↑';
                        upBtn.title = '上移';
                        upBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); if (idx > 0) { var item = _noteCatEditCopy.splice(idx, 1)[0]; _noteCatEditCopy.splice(idx - 1, 0, item); _renderCatRows(); } };
                        var downBtn = document.createElement('button');
                        downBtn.className = 'ncMoveBtn ncDownBtn';
                        downBtn.textContent = '↓';
                        downBtn.title = '下移';
                        downBtn.onclick = function(e) { e.preventDefault(); e.stopPropagation(); if (idx < _noteCatEditCopy.length - 1) { var item = _noteCatEditCopy.splice(idx, 1)[0]; _noteCatEditCopy.splice(idx + 1, 0, item); _renderCatRows(); } };
                        var lockBtn = document.createElement('button');
                        lockBtn.className = 'ncLockBtn' + (_noteCatEditCopy[idx].locked ? ' locked' : '');
                        lockBtn.textContent = _noteCatEditCopy[idx].locked ? '🔒' : '🔓';
                        lockBtn.title = _noteCatEditCopy[idx].locked ? '修改或解除锁定' : '锁定类别';
                        lockBtn.onclick = function(e) {
                            e.preventDefault(); e.stopPropagation();
                            var cat = _noteCatEditCopy[idx];
                            if (cat.locked) {
                                openNoteLockModal(cat.id, 'change');
                            } else {
                                openNoteLockModal(cat.id, 'set');
                            }
                        };
                        var inp = document.createElement('input');
                        inp.type = 'text';
                        inp.value = _noteCatEditCopy[idx].name;
                        inp.placeholder = '类别名称';
                        inp.oninput = function() { _noteCatEditCopy[idx].name = this.value; };
                        var del = document.createElement('button');
                        del.className = 'ncDelBtn';
                        del.textContent = '×';
                        del.title = '删除该类别';
                        del.onclick = function() {
                            if (_noteCatEditCopy.length <= 1) { showToast('至少保留一个类别'); return; }
                            _noteCatEditCopy.splice(idx, 1);
                            _renderCatRows();
                        };
                        row.appendChild(handle);
                        row.appendChild(upBtn);
                        row.appendChild(inp);
                        row.appendChild(lockBtn);
                        row.appendChild(downBtn);
                        row.appendChild(del);
                        row.addEventListener('dragstart', function(e) {
                            _noteCatDragSrc = idx;
                            row.classList.add('dragging');
                            try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); } catch (err) {}
                        });
                        row.addEventListener('dragend', function() {
                            row.classList.remove('dragging');
                            var allRows = listEl.querySelectorAll('.noteCategoryRow');
                            for (var j = 0; j < allRows.length; j++) { allRows[j].classList.remove('drop-above', 'drop-below'); }
                        });
                        row.addEventListener('dragover', function(e) {
                            if (_noteCatDragSrc < 0) return;
                            e.preventDefault();
                            try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
                            var rect = row.getBoundingClientRect();
                            var above = (e.clientY - rect.top) < rect.height / 2;
                            var allRows = listEl.querySelectorAll('.noteCategoryRow');
                            for (var j = 0; j < allRows.length; j++) { allRows[j].classList.remove('drop-above', 'drop-below'); }
                            row.classList.add(above ? 'drop-above' : 'drop-below');
                        });
                        row.addEventListener('dragleave', function() {
                            row.classList.remove('drop-above', 'drop-below');
                        });
                        row.addEventListener('drop', function(e) {
                            e.preventDefault();
                            var allRows = listEl.querySelectorAll('.noteCategoryRow');
                            for (var j = 0; j < allRows.length; j++) { allRows[j].classList.remove('drop-above', 'drop-below'); }
                            if (_noteCatDragSrc < 0 || _noteCatDragSrc === idx) return;
                            var rect = row.getBoundingClientRect();
                            var above = (e.clientY - rect.top) < rect.height / 2;
                            var targetIdx = above ? idx : idx + 1;
                            var moved = _noteCatEditCopy.splice(_noteCatDragSrc, 1)[0];
                            if (_noteCatDragSrc < targetIdx) targetIdx--;
                            _noteCatEditCopy.splice(targetIdx, 0, moved);
                            _noteCatDragSrc = -1;
                            _renderCatRows();
                        });
                        row.addEventListener('contextmenu', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            _noteCatCtxIdx = idx;
                            var menu = document.getElementById('noteCategoryItemMenu');
                            if (!menu) return;
                            menu.classList.add('show');
                            menu.style.left = '0px';
                            menu.style.top = '0px';
                            var rw = menu.offsetWidth, rh = menu.offsetHeight;
                            var left = e.clientX, top = e.clientY;
                            if (left + rw > window.innerWidth - 8) left = window.innerWidth - rw - 8;
                            if (top + rh > window.innerHeight - 8) top = window.innerHeight - rh - 8;
                            if (left < 4) left = 4;
                            if (top < 4) top = 4;
                            menu.style.left = left + 'px';
                            menu.style.top = top + 'px';
                        });
                        listEl.appendChild(row);
                    })(i);
                }
            };
            _renderCatRows();
            window._noteCategoryRenderRows = _renderCatRows;
            document.getElementById('noteCategoryModal').classList.add('show');
            (function bindNoteCategoryMenu() {
                var menu = document.getElementById('noteCategoryItemMenu');
                if (!menu) return;
                menu.addEventListener('click', function(e) {
                    var it = e.target.closest('.paCtxItem');
                    if (!it) return;
                    var act = it.getAttribute('data-action');
                    if (_noteCatCtxIdx < 0 || !_noteCatEditCopy) { hideNoteCategoryItemMenu(); return; }
                    var rows = _noteCatEditCopy;
                    if (act === 'up' && _noteCatCtxIdx > 0) {
                        var item = rows.splice(_noteCatCtxIdx, 1)[0];
                        rows.splice(_noteCatCtxIdx - 1, 0, item);
                        _renderCatRows();
                    } else if (act === 'down' && _noteCatCtxIdx < rows.length - 1) {
                        var item2 = rows.splice(_noteCatCtxIdx, 1)[0];
                        rows.splice(_noteCatCtxIdx + 1, 0, item2);
                        _renderCatRows();
                    }
                    hideNoteCategoryItemMenu();
                });
                menu.addEventListener('contextmenu', function(e) { e.preventDefault(); });
         document.addEventListener('mousedown', function(e) {
             document.querySelectorAll('.pageViewSubMenu, .pageViewSubStatusPicker, .pageViewEntryStatusSelect, .pageViewSubStatusSelect').forEach(function(menu) {
                 if (!menu.contains(e.target)) menu.remove();
             });
         }, true);
         document.addEventListener('contextmenu', function(e) {
             document.querySelectorAll('.pageViewSubMenu, .pageViewSubStatusPicker, .pageViewEntryStatusSelect, .pageViewSubStatusSelect').forEach(function(menu) {
                 if (!menu.contains(e.target)) menu.remove();
             });
         }, true);
         document.addEventListener('click', function(e) {
                    if (!e.target.closest('#noteCategoryItemMenu')) hideNoteCategoryItemMenu();
          });
         document.addEventListener('click', function(e) {
             if (!e.target.closest('.pageViewSubMenu')) document.querySelectorAll('.pageViewSubMenu').forEach(function(menu) { menu.remove(); });
             if (!e.target.closest('.pageViewSubStatusPicker')) document.querySelectorAll('.pageViewEntryStatusSelect, .pageViewSubStatusSelect, .pageViewSubStatusPicker').forEach(function(menu) { menu.remove(); });
             if (!e.target.closest('#rowContextMenu')) hideRowContextMenu();
             if (!e.target.closest('#headerContextMenu')) hideHeaderContextMenu();
         }, true);
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') hideNoteCategoryItemMenu();
                });
            })();
        }

        function addNoteCategoryRow() {
            if (!_noteCatEditCopy) return;
            var maxId = -1;
            for (var i = 0; i < _noteCatEditCopy.length; i++) { if (_noteCatEditCopy[i].id > maxId) maxId = _noteCatEditCopy[i].id; }
            _noteCatEditCopy.push({ id: maxId + 1, name: '新类别' });
            if (typeof window._noteCategoryRenderRows === 'function') window._noteCategoryRenderRows();
            var rows = document.querySelectorAll('#noteCategoryList .noteCategoryRow');
            if (rows.length > 0) { var last = rows[rows.length - 1]; var inp = last.querySelector('input'); if (inp) { inp.focus(); inp.select(); } }
        }

        function closeNoteCategoryModal() {
            _noteCatEditCopy = null;
            hideNoteCategoryItemMenu();
            document.getElementById('noteCategoryModal').classList.remove('show');
        }

        function saveNoteCategories() {
            var cleaned = [];
            var seenNames = {};
            for (var i = 0; i < _noteCatEditCopy.length; i++) {
                var name = (_noteCatEditCopy[i].name || '').trim();
                if (name && !seenNames[name]) { seenNames[name] = true; cleaned.push({ id: _noteCatEditCopy[i].id, name: name, locked: !!_noteCatEditCopy[i].locked, lockPassword: _noteCatEditCopy[i].lockPassword || '' }); }
            }
            if (cleaned.length === 0) cleaned = [{ id: 0, name: '默认' }];
            _noteCategories = cleaned;
            var firstId = _noteCategories[0].id;
            if (_noteCurrentCategory !== 'all') { if (!_noteCatIdToObj(_noteCurrentCategory)) _noteCurrentCategory = firstId; }
            for (var j = 0; j < notes.length; j++) {
                if (!_noteCatIdToObj(notes[j].category)) notes[j].category = firstId;
            }
            _saveNoteCategories();
            _saveNoteCurrentCategory();
            _saveNotes();
            _noteCatEditCopy = null;
            refreshNoteCategorySelect();
            renderNotes();
            closeNoteCategoryModal();
            showToast('类别已保存');
        }

        function renderNotes() {
            var listEl = document.getElementById('noteList');
            var kw = _noteSearchKw;
            var filtered = [];
            for (var i = 0; i < notes.length; i++) {
                var n = notes[i];
                var c = (typeof n.category === 'number') ? n.category : _noteCategories[0].id;
                var cat = _noteCatIdToObj(c);
                if (cat && cat.locked && _noteCurrentCategory === 'all') continue;
                if (cat && cat.locked && _noteCurrentCategory === c && !_noteUnlockedCategories[c]) continue;
                if (_noteCurrentCategory !== 'all' && c !== _noteCurrentCategory) continue;
                if (kw) {
                    if ((n.content || '').toLowerCase().indexOf(kw) === -1 && (n.source || '').toLowerCase().indexOf(kw) === -1) continue;
                }
                filtered.push(n);
            }
            filtered.sort(function(a, b) {
                var ta = a.time || ''; var tb = b.time || '';
                if (ta === tb) return 0;
                if (_noteSortOrder === 'asc') return ta < tb ? -1 : 1;
                return ta < tb ? 1 : -1;
            });
            if (filtered.length === 0) {
                listEl.innerHTML = '<div class="noteEmpty">' + (kw ? '未找到匹配的随记' : '暂无随记，点击下方按钮添加') + '</div>';
                return;
            }
            var html = '';
            for (var i = 0; i < filtered.length; i++) {
                var n = filtered[i];
                var content = n.content || '';
                var time = n.time || '';
                var source = n.source || '';
                var paras = content.split(/\r?\n/);
                var contentHtml = '';
                for (var pi = 0; pi < paras.length; pi++) {
                    var pHtml = paras[pi] ? highlightReminderText(paras[pi], kw) : '<br>';
                    contentHtml += '<p>' + pHtml + '</p>';
                }
                var timeHtml = escapeHtml(time);
                var sourceHtml = source ? highlightReminderText(source, kw) : '';
                var sourceLen = (n.source || '').length;
                html += '<div class="noteItem" data-id="' + n.id + '">';
                if (cat && cat.locked) html += '<div style="font-size:11px;color:#9a7300;text-align:right;padding:2px 8px 0;">🔒 已锁定类别</div>';
                html += '<div class="noteContent" data-raw="' + escapeHtml(content) + '">' + contentHtml + '</div>';
                if (sourceHtml && sourceLen <= 16) {
                    html += '<div class="noteTime compact"><span class="noteSource">' + sourceHtml + '</span><span class="noteTimeText">' + timeHtml + '</span></div>';
                } else if (sourceHtml) {
                    html += '<div class="noteTime"><span class="noteSource">' + sourceHtml + '</span></div>';
                    html += '<div class="noteTime"><span class="noteTimeText">' + timeHtml + '</span></div>';
                } else {
                    html += '<div class="noteTime"><span class="noteTimeText">' + timeHtml + '</span></div>';
                }
                html += '</div>';
            }
            listEl.innerHTML = html;
        }

        function _refreshNoteEditCategorySelect(selectedId) {
            var sel = document.getElementById('noteEditCategorySelect');
            sel.innerHTML = '';
            for (var i = 0; i < _noteCategories.length; i++) {
                var opt = document.createElement('option');
                opt.value = _noteCategories[i].id;
                opt.textContent = _noteCategories[i].name;
                sel.appendChild(opt);
            }
            sel.value = String(selectedId);
        }
        function _setNoteEditorContent(text) {
            var el = document.getElementById('noteEditContentInput');
            if (!el) return;
            if (!text) { el.innerHTML = '<p><br></p>'; return; }
            var parts = text.split(/\r?\n/);
            var html = '';
            for (var i = 0; i < parts.length; i++) {
                html += '<p>' + (parts[i] ? escapeHtml(parts[i]) : '<br>') + '</p>';
            }
            el.innerHTML = html;
        }
        function _getNoteEditorContent() {
            var el = document.getElementById('noteEditContentInput');
            if (!el) return '';
            return (el.innerText || '').replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '');
        }

        function openAddNoteModal() {
            var modal = document.getElementById('noteEditModal');
            document.getElementById('noteEditTitle').textContent = '添加随记';
            document.getElementById('noteEditTimeInput').value = _nowNoteTimeStr();
            var addCat = (_noteCurrentCategory === 'all') ? _noteCategories[0].id : _noteCurrentCategory;
            _refreshNoteEditCategorySelect(addCat);
            _setNoteEditorContent('');
            document.getElementById('noteEditSourceInput').value = '';
            modal.classList.add('show');
            modal._editId = null;
            document.getElementById('noteEditDeleteBtn').style.display = 'none';
            setTimeout(function() { document.getElementById('noteEditContentInput').focus(); }, 50);
        }

        function openEditNoteModal(id) {
            var n = null;
            for (var i = 0; i < notes.length; i++) { if (notes[i].id === id) { n = notes[i]; break; } }
            if (!n) return;
            var modal = document.getElementById('noteEditModal');
            document.getElementById('noteEditTitle').textContent = '编辑随记';
            document.getElementById('noteEditTimeInput').value = n.time || '';
            var editCat = (typeof n.category === 'number' && _noteCatIdToObj(n.category)) ? n.category : _noteCategories[0].id;
            _refreshNoteEditCategorySelect(editCat);
            _setNoteEditorContent(n.content || '');
            document.getElementById('noteEditSourceInput').value = n.source || '';
            modal.classList.add('show');
            modal._editId = id;
            document.getElementById('noteEditDeleteBtn').style.display = '';
            setTimeout(function() { document.getElementById('noteEditContentInput').focus(); }, 50);
        }

        function closeNoteEditModal() {
            document.getElementById('noteEditModal').classList.remove('show');
        }

        function saveNoteFromModal() {
            var time = (document.getElementById('noteEditTimeInput').value || '').trim();
            var content = _getNoteEditorContent();
            var source = (document.getElementById('noteEditSourceInput').value || '').trim();
            var catId = parseInt(document.getElementById('noteEditCategorySelect').value, 10);
            if (isNaN(catId)) catId = _noteCategories[0].id;
            var modal = document.getElementById('noteEditModal');
            if (!content.trim()) { showToast('请输入内容'); return; }
            if (!time) { time = _nowNoteTimeStr(); }
            if (modal._editId) {
                for (var i = 0; i < notes.length; i++) {
                    if (notes[i].id === modal._editId) {
                        notes[i].time = time;
                        notes[i].content = content;
                        notes[i].category = catId;
                        notes[i].source = source;
                        break;
                    }
                }
                _saveNotes();
                closeNoteEditModal();
                renderNotes();
                showToast('已保存');
            } else {
                notes.push({
                    id: Date.now(),
                    time: time,
                    content: content,
                    category: catId,
                    source: source
                });
                _saveNotes();
                closeNoteEditModal();
                renderNotes();
                showToast('已添加');
            }
        }

        function deleteNote(id) {
            notes = notes.filter(function(n) { return n.id !== id; });
            _saveNotes();
            closeNoteEditModal();
            renderNotes();
            showToast('已删除');
        }

        function closeNotifyModal() {
            var m = document.getElementById('reminderNotifyModal');
            if (m) m.classList.remove('show');
        }

        document.getElementById('cancelReminderBtn').addEventListener('click', hideAddReminderModal);
        document.getElementById('saveReminderBtn').addEventListener('click', saveReminderFromModal);
        document.getElementById('closeNotifyBtn').addEventListener('click', closeNotifyModal);
        
        document.getElementById('addReminderModal').addEventListener('click', function(e) {
            if (e.target === this) hideAddReminderModal();
        });
        
        document.getElementById('reminderList').addEventListener('dblclick', function(e) {
            var item = e.target.closest('.reminderItem');
            if (!item) return;
            var id = parseInt(item.getAttribute('data-id'), 10);
            if (!id) return;
            showReminderEdit(id);
        });

        document.getElementById('noteList').addEventListener('dblclick', function(e) {
            var item = e.target.closest('.noteItem');
            if (!item) return;
            var id = parseInt(item.getAttribute('data-id'), 10);
            if (!id) return;
            openEditNoteModal(id);
        });
        document.getElementById('noteEditSaveBtn').addEventListener('click', saveNoteFromModal);
        document.getElementById('noteEditCancelBtn').addEventListener('click', closeNoteEditModal);
        document.getElementById('noteEditDeleteBtn').addEventListener('click', function() {
            var modal = document.getElementById('noteEditModal');
            if (modal._editId) { if (confirm('确定删除该随记？')) deleteNote(modal._editId); }
        });
        (function() {
            var ed = document.getElementById('noteEditContentInput');
            if (!ed) return;
            ed.addEventListener('focus', function() { try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {} });
            ed.addEventListener('paste', function(e) {
                e.preventDefault();
                var text = (e.clipboardData || window.clipboardData).getData('text');
                try { document.execCommand('insertText', false, text); } catch (err) {}
            });
        })();
        refreshNoteCategorySelect();

// ---- 挂载到 window ----
window.renderNotes = renderNotes;
window.openAddNoteModal = openAddNoteModal;
window.openEditNoteModal = openEditNoteModal;
window.closeNoteEditModal = closeNoteEditModal;
window.saveNoteFromModal = saveNoteFromModal;
window.deleteNote = deleteNote;
window.switchNoteCategory = switchNoteCategory;
window.setNoteSortOrder = setNoteSortOrder;
window.openNoteCategoryModal = openNoteCategoryModal;
window.closeNoteCategoryModal = closeNoteCategoryModal;
window.saveNoteCategories = saveNoteCategories;
window.addNoteCategoryRow = addNoteCategoryRow;
window.hideNoteCategoryItemMenu = hideNoteCategoryItemMenu;
window.exportNotesHtml = exportNotesHtml;
window.exportNotesJs = exportNotesJs;
window.exportNotesDocx = exportNotesDocx;
window.importNotesFromFile = importNotesFromFile;
window.openNoteLockModal = openNoteLockModal;
window.closeNoteLockModal = closeNoteLockModal;
window.confirmNoteCategoryLock = confirmNoteCategoryLock;
window.refreshNoteCategorySelect = refreshNoteCategorySelect;
window.closeNotifyModal = closeNotifyModal;
window.openNoteImportPicker = openNoteImportPicker;
window.toggleNoteExportMenu = toggleNoteExportMenu;
window.closeNoteExportMenu = closeNoteExportMenu;
window.switchReminderTab = switchReminderTab;
window._normalizeNoteCategories = _normalizeNoteCategories;
window._noteCatNameToId = _noteCatNameToId;
window._noteCatIdToObj = _noteCatIdToObj;
window._saveNotes = _saveNotes;
window._saveNoteCategories = _saveNoteCategories;
window._saveNoteCurrentCategory = _saveNoteCurrentCategory;
