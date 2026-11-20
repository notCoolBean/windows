/* ============================================================
   contacts.js — 通讯录管理
   ============================================================ */

        function switchTrackMode(mode) {
            var reportBtn = document.getElementById('reportBtn');
            var trackBtn = document.getElementById('trackBtn');
             var pageBtn = document.getElementById('pageBtn');
             var contactsBadge = document.getElementById('contactsViewBadge');
             var trackContent = document.getElementById('trackContent');
            if (S.currentTrackMode === mode) {
                S.currentTrackMode = null;
                if (reportBtn) reportBtn.style.opacity = '0.35';
                if (trackBtn) trackBtn.style.opacity = '0.35';
                 if (pageBtn) pageBtn.style.opacity = '0.35';
                 if (contactsBadge) contactsBadge.style.display = 'none';
                 if (trackContent) trackContent.style.display = 'none';
                var toolbarAddOff = document.getElementById('toolbarAddBtn');
                if (toolbarAddOff) toolbarAddOff.style.display = 'none';
                S.pageViewFilterDateKey = '';
                return;
            }
            S.currentTrackMode = mode;
            if (mode !== 'page') S.pageViewFilterDateKey = '';
            if (reportBtn) reportBtn.style.opacity = mode === 'report' ? '1' : '0.35';
            if (trackBtn) trackBtn.style.opacity = mode === 'track' ? '1' : '0.35';
            if (pageBtn) pageBtn.style.opacity = mode === 'page' ? '1' : '0.35';
             if (trackContent) trackContent.style.display = '';
             if (contactsBadge) contactsBadge.style.display = mode === 'contacts' ? '' : 'none';
             var toolbarAdd = document.getElementById('toolbarAddBtn');
             if (toolbarAdd) toolbarAdd.style.display = (mode === 'report' || mode === 'page' || mode === 'track') ? '' : 'none';
             renderTrackContent();
         }
        function toggleContactsView() {
            if (currentTrackMode === 'contacts') switchTrackMode('page');
            else switchTrackMode('contacts');
        }
        function closeContactsView() {
            switchTrackMode('page');
        }
        var _contactsSearchText = '';
        var _contactsState = (function() {
            try { return (DataLayer.get('notepadContacts')) || { current: 0, tables: [{ name: '默认通讯录', headers: ['姓名','单位/部门','职务','电话','备注'], rows: [] }] }; } catch (e) { return { current: 0, tables: [{ name: '默认通讯录', headers: ['姓名','单位/部门','职务','电话','备注'], rows: [] }] }; }
        })();
        function _saveContactsState() { try { DataLayer.set('notepadContacts', _contactsState) } catch (e) {} }
        function _contactsDefaultWidths(headers) { return (headers || []).map(function(name) { if (name === '序号') return 70; if (name === '姓名') return 100; return 150; }); }
        function _contactsCurrent() { if (!Array.isArray(_contactsState.tables)) _contactsState.tables = []; if (!_contactsState.tables.length) _contactsState.tables.push({ name: '默认通讯录', headers: ['姓名','单位/部门','职务','电话','备注'], rows: [] }); for (var i = 0; i < _contactsState.tables.length; i++) { if (!Array.isArray(_contactsState.tables[i].headers)) _contactsState.tables[i].headers = ['姓名','单位/部门','职务','电话','备注']; if (!Array.isArray(_contactsState.tables[i].rows)) _contactsState.tables[i].rows = []; if (!Array.isArray(_contactsState.tables[i].widths)) _contactsState.tables[i].widths = _contactsDefaultWidths(_contactsState.tables[i].headers); var defaults = _contactsDefaultWidths(_contactsState.tables[i].headers); for (var wi = 0; wi < defaults.length; wi++) if (!isFinite(parseFloat(_contactsState.tables[i].widths[wi])) || parseFloat(_contactsState.tables[i].widths[wi]) <= 0) _contactsState.tables[i].widths[wi] = defaults[wi]; } return _contactsState.tables[Math.max(0, Math.min(_contactsState.current || 0, _contactsState.tables.length - 1))]; }
        function _contactsHeaderCenter(name) { return name === '序号' || name === '姓名'; }
        function _contactsBuildTable(table, rowsOverride) {
            var displayRows = rowsOverride || table.rows;
            var h = '<table class="contactsTable"><colgroup>';
            for (var ci = 0; ci < table.headers.length; ci++) h += '<col style="width:' + (table.widths && table.widths[ci] ? table.widths[ci] + 'px' : 'auto') + '">';
            h += '</colgroup><thead><tr>';
            for (var i = 0; i < table.headers.length; i++) { var centered = _contactsHeaderCenter(table.headers[i]) ? ' contactsCenter' : ''; h += '<th class="' + centered.trim() + '" draggable="true" data-col-index="' + i + '">' + escapeHtml(table.headers[i]) + '<span class="contactsColResize"></span></th>'; }
            h += '</tr></thead><tbody>';
            if (!displayRows.length) h += '<tr><td colspan="' + table.headers.length + '"><div class="contactsEmpty">暂无通讯录内容</div></td></tr>';
            else for (var r = 0; r < displayRows.length; r++) {
                var origIdx = table.rows.indexOf(displayRows[r]);
                h += '<tr' + (origIdx >= 0 ? ' data-row-index="' + origIdx + '" ondblclick="contactsOpenEditRow(' + origIdx + ')"' : '') + '>';
                for (var c = 0; c < table.headers.length; c++) h += '<td class="' + (_contactsHeaderCenter(table.headers[c]) ? 'contactsCenter' : 'contactsLeft') + '">' + escapeHtml(displayRows[r][c] || '') + '</td>';
                h += '</tr>';
            }
            return h + '</tbody></table>';
        }
        var _contactsEditIndex = -1;
        function contactsOpenEditRow(rowIndex) {
            var table = _contactsCurrent();
            if (rowIndex < 0 || rowIndex >= table.rows.length) return;
            _contactsEditIndex = rowIndex;
            var title = document.getElementById('contactsEditTitle');
            var fields = document.getElementById('contactsEditFields');
            if (!fields) return;
            if (title) title.textContent = '编辑联系人';
            var html = '';
            for (var i = 0; i < table.headers.length; i++) {
                var name = table.headers[i] || ('字段' + (i + 1));
                var value = table.rows[rowIndex][i] || '';
                var inputId = 'contactsEditField' + i;
                var isLong = /备注|地址|说明/.test(name);
                if (isLong) html += '<div class="contactsEditField"><label>' + escapeHtml(name) + '</label><textarea id="' + inputId + '" data-col="' + i + '">' + escapeHtml(value) + '</textarea></div>';
                else html += '<div class="contactsEditField"><label>' + escapeHtml(name) + '</label><input type="text" id="' + inputId + '" data-col="' + i + '" value="' + escapeHtml(value).replace(/"/g, '&quot;') + '"></div>';
            }
            fields.innerHTML = html;
            var modal = document.getElementById('contactsEditModal');
            modal.classList.add('show');
            var first = fields.querySelector('input,textarea');
            if (first) first.focus();
        }
        function contactsEditSave() {
            var table = _contactsCurrent();
            if (_contactsEditIndex < 0 || _contactsEditIndex >= table.rows.length) { contactsEditCancel(); return; }
            var fields = document.getElementById('contactsEditFields');
            if (!fields) { contactsEditCancel(); return; }
            var inputs = fields.querySelectorAll('[data-col]');
            var row = table.rows[_contactsEditIndex].slice();
            for (var i = 0; i < inputs.length; i++) {
                var col = parseInt(inputs[i].getAttribute('data-col'), 10);
                if (isFinite(col)) row[col] = inputs[i].value;
            }
            table.rows[_contactsEditIndex] = row;
            _saveContactsState();
            contactsEditCancel();
            renderTrackContent();
            showToast('已保存');
        }
        function contactsEditCancel() {
            var modal = document.getElementById('contactsEditModal');
            if (modal) modal.classList.remove('show');
            _contactsEditIndex = -1;
        }
        function contactsEditDelete() {
            var table = _contactsCurrent();
            if (_contactsEditIndex < 0 || _contactsEditIndex >= table.rows.length) { contactsEditCancel(); return; }
            if (!confirm('确定删除该联系人吗？删除后无法恢复。')) return;
            table.rows.splice(_contactsEditIndex, 1);
            _saveContactsState();
            contactsEditCancel();
            renderTrackContent();
            showToast('已删除');
        }
        (function bindContactsEditModal() {
            function bind() {
                var modal = document.getElementById('contactsEditModal');
                if (!modal || modal.dataset.bound) return;
                modal.dataset.bound = '1';
                modal.addEventListener('click', function(e) {
                    if (e.target === modal) contactsEditCancel();
                });
                modal.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey && e.target && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); contactsEditSave(); }
                    if (e.key === 'Escape') contactsEditCancel();
                });
            }
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
            else setTimeout(bind, 0);
        })();
        function _contactsSearchSpec(text) {
            var raw = String(text || '').trim(), field = '';
            var m = raw.match(/^【([^】]+)】\s*/);
            if (m) { field = m[1].trim(); raw = raw.slice(m[0].length).trim(); }
            var groups = raw ? raw.split(/\s+/).filter(Boolean).map(function(group) { return group.split('-').map(function(v) { return v.trim().toLowerCase(); }).filter(Boolean); }) : [];
            return { field: field, groups: groups };
        }
        function _contactsFilteredRows(table) {
            var spec = _contactsSearchSpec(_contactsSearchText);
            if (!spec.groups.length) return table.rows;
            var fieldIndex = spec.field ? table.headers.indexOf(spec.field) : -1;
            return table.rows.filter(function(row) {
                var values = fieldIndex >= 0 ? [row[fieldIndex] || ''] : row;
                var text = values.join(' ').toLowerCase();
                return spec.groups.some(function(andParts) { return andParts.every(function(part) { return text.indexOf(part) !== -1; }); });
            });
        }
        function contactsApplySearch(value) {
            _contactsSearchText = value || '';
            var container = document.getElementById('trackContent');
            var table = _contactsCurrent();
            var wrap = container && container.querySelector('.contactsTableWrap');
            if (wrap) { wrap.innerHTML = _contactsBuildTable(table, _contactsFilteredRows(table)); contactsBindTableInteractions(wrap, table); }
        }
        function contactsSetSearchHeader(name) {
            var input = document.getElementById('contactsSearchInput');
            if (!input) return;
            var spec = _contactsSearchSpec(input.value);
            var text = spec.groups.map(function(group) { return group.join('-'); }).join(' ');
            input.value = '【' + name + '】' + (text ? text : '');
            _contactsSearchText = input.value;
            contactsApplySearch(input.value);
            input.focus();
            try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
        }
        function contactsBindTableInteractions(root, table) {
            var tableEl = root && root.querySelector('.contactsTable'); if (!tableEl) return;
            var headers = tableEl.querySelectorAll('th');
            for (var i = 0; i < headers.length; i++) (function(i) {
                var th = headers[i], resize = th.querySelector('.contactsColResize');
                th.addEventListener('click', function(e) { if (e.target === resize) return; contactsSetSearchHeader(th.textContent.replace(/\s+/g, ' ').trim()); });
                if (resize) resize.addEventListener('mousedown', function(e) { e.preventDefault(); e.stopPropagation(); var startX = e.clientX, startW = th.getBoundingClientRect().width; function move(ev) { var w = Math.max(70, Math.round(startW + ev.clientX - startX)); table.widths[i] = w; th.style.width = w + 'px'; tableEl.querySelectorAll('tbody tr').forEach(function(row) { if (row.children[i]) row.children[i].style.width = w + 'px'; }); } function up() { _saveContactsState(); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); } document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); });
                th.addEventListener('dragstart', function(e) { if (e.target === resize) { e.preventDefault(); return; } tableEl._dragCol = i; try { e.dataTransfer.setData('text/plain', String(i)); } catch (err) {} });
                th.addEventListener('dragover', function(e) { e.preventDefault(); });
                th.addEventListener('drop', function(e) { e.preventDefault(); var from = tableEl._dragCol, to = i; if (from === undefined || from === to) return; table.headers.splice(to, 0, table.headers.splice(from, 1)[0]); table.widths.splice(to, 0, table.widths.splice(from, 1)[0]); table.rows.forEach(function(row) { row.splice(to, 0, row.splice(from, 1)[0]); }); _saveContactsState(); renderTrackContent(); });
            })(i);
        }
        function _contactsTableOptions() { return _contactsState.tables.map(function(t, i) { return '<option value="' + i + '">' + escapeHtml(t.name) + '</option>'; }).join(''); }
        function _contactsRenderMode(container) {
            var table = _contactsCurrent();
            var html = '<div class="contactsView"><div class="contactsToolbar"><h2 class="contactsTitle">通讯录</h2><button class="contactsToolBtn" type="button" onclick="contactsOpenImportFile()">导入</button><button class="contactsToolBtn" type="button" onclick="contactsEnterPasteMode()">粘入</button><div class="contactsExportWrap"><button class="contactsToolBtn" type="button" onclick="this.nextElementSibling.classList.toggle(\'show\')">导出 ▾</button><div class="contactsExportMenu"><div class="contactsExportItem" onclick="contactsExportFile(\'csv\')">导出CSV</div><div class="contactsExportItem" onclick="contactsExportFile(\'js\')">导出js</div></div></div><select class="contactsTableSwitch" onchange="contactsSwitchTable(this.value)">' + _contactsTableOptions() + '</select><button class="contactsSettingsBtn" type="button" onclick="contactsOpenHeaderSettings()" title="设置通讯录表头">⚙</button><input class="contactsSearch" id="contactsSearchInput" type="search" value="' + escapeHtml(_contactsSearchText) + '" placeholder="检索联系人" title="检索通讯录"><button class="contactsToolBtn contactsCloseBtn" type="button" onclick="closeContactsView()" title="关闭通讯录">×</button></div><div class="contactsTableWrap">' + _contactsBuildTable(table, _contactsFilteredRows(table)) + '</div></div>';
            container.innerHTML = html;
            contactsBindTableInteractions(container, table);
            var select = container.querySelector('.contactsTableSwitch'); if (select) select.value = String(_contactsState.current || 0);
            var search = container.querySelector('#contactsSearchInput'); if (search) search.addEventListener('input', function() { contactsApplySearch(this.value); });
        }
        function contactsSwitchTable(index) { _contactsState.current = parseInt(index, 10) || 0; _contactsSearchText = ''; _saveContactsState(); renderTrackContent(); }
        function contactsOpenImportFile() { var input = document.getElementById('contactsFileInput'); if (!input) { input = document.createElement('input'); input.id = 'contactsFileInput'; input.type = 'file'; input.accept = '.csv,.js,.html,.htm,.mht,.mhtml'; input.style.display = 'none'; input.onchange = function() { contactsImportFile(input.files[0]); }; document.body.appendChild(input); } input.value = ''; input.click(); }
        function contactsExportCurrent() { contactsExportFile('csv'); }
        function _contactsExportStamp() { var d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); }
        function _contactsDownload(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000); showToast('已导出：' + name); }
        function contactsExportFile(kind) { var table = _contactsCurrent(), name = sanitizeDocFileName(_contactsExportStamp() + ' ' + (table.name || '通讯录')); if (kind === 'csv') { var lines = [table.headers]; for (var i = 0; i < table.rows.length; i++) lines.push(table.rows[i]); var csv = lines.map(function(row, ri) { return row.map(function(v) { var s = String(v == null ? '' : v); if (ri > 0 && /^\d{6,}$/.test(s)) return '="' + s + '"'; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','); }).join('\r\n'); _contactsDownload(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), name + '.csv'); } else { var data = { name: table.name, headers: table.headers, widths: table.widths || [], rows: table.rows }; _contactsDownload(new Blob(['var contactsData = ' + JSON.stringify(data, null, 2) + ';'], { type: 'application/javascript;charset=utf-8' }), name + '.js'); } }
        function _contactsDecodeQuotedPrintable(text) {
            return String(text || '').replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, function(_, hex) { return String.fromCharCode(parseInt(hex, 16)); });
        }
        function _contactsExtractMhtmlHtml(text) {
            var decoded = _contactsDecodeQuotedPrintable(text), start = decoded.search(/<html\b/i), end = decoded.search(/<\/html\s*>/i);
            if (start >= 0 && end >= start) return decoded.slice(start, end + decoded.slice(end).match(/<\/html\s*>/i)[0].length);
            return decoded;
        }
        function _contactsParseHtmlTable(text) {
            var doc = new DOMParser().parseFromString(text, 'text/html'), tables = doc.querySelectorAll('table');
            for (var ti = 0; ti < tables.length; ti++) {
                var trs = tables[ti].querySelectorAll('tr'), parsed = [];
                for (var ri = 0; ri < trs.length; ri++) {
                    var cells = trs[ri].querySelectorAll('th,td'), row = [];
                    for (var ci = 0; ci < cells.length; ci++) row.push((cells[ci].textContent || '').replace(/\s+/g, ' ').trim());
                    if (row.length) parsed.push(row);
                }
                if (parsed.length) return parsed;
            }
            return [];
        }
        function _contactsFindHeaderRow(rows) {
            for (var i = 0; i < rows.length; i++) {
                if (rows[i] && rows[i].length && String(rows[i][0] || '').replace(/^\s+|\s+$/g, '') === '序号') return i;
            }
            return 0;
        }
        function contactsImportFile(file) {
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function() {
                var buf = reader.result, text = '', name = file.name.replace(/\.(csv|js|html?|mhtml?)$/i, '').replace(/^\d{8}-\d{4}\s+/, '').trim() || '通讯录', data = null;
                try {
                    var bytes = new Uint8Array(buf);
                    if (bytes.length >= 3 && bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) bytes = bytes.slice(3);
                    text = new TextDecoder('utf-8').decode(bytes);
                    if (/\ufffd/.test(text) && typeof TextDecoder !== 'undefined') text = new TextDecoder('gb18030').decode(bytes);
                } catch (e) {
                    try { text = new TextDecoder('gb18030').decode(new Uint8Array(buf)); } catch (e2) { text = ''; }
                }
                if (/\.js$/i.test(file.name)) {
                    try { var eq = text.indexOf('='), end = text.lastIndexOf(';'); data = JSON.parse(text.slice(eq + 1, end > eq ? end : text.length).trim()); } catch (e3) {}
                }
                var table = null;
                if (data && data.headers && data.rows) table = { name: name, headers: data.headers, widths: data.widths || [], rows: data.rows };
                else if (/\.(html?|mhtml?)$/i.test(file.name)) {
                    var htmlRows = _contactsParseHtmlTable(/\.mhtml?$/i.test(file.name) ? _contactsExtractMhtmlHtml(text) : text);
                    if (htmlRows.length) { var headerIdx = _contactsFindHeaderRow(htmlRows); table = { name: name, headers: htmlRows[headerIdx], widths: [], rows: htmlRows.slice(headerIdx + 1) }; }
                }
                else {
                    var lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter(function(x) { return x.length; });
                    var rows = lines.map(function(line) { return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(function(v) { v = v.replace(/^"|"$/g, '').replace(/""/g, '"'); var textFormula = v.match(/^="(\d+)"$/); return textFormula ? textFormula[1] : v; }); });
                    if (rows.length) { var csvHeaderIdx = _contactsFindHeaderRow(rows); table = { name: name, headers: rows[csvHeaderIdx], widths: [], rows: rows.slice(csvHeaderIdx + 1) }; }
                }
                if (!table || !table.headers.length) { showToast('文件格式无法识别'); return; }
                var idx = -1;
                for (var i = 0; i < _contactsState.tables.length; i++) if (_contactsState.tables[i].name === name) idx = i;
                if (idx >= 0 && _contactsState.tables[idx].rows && _contactsState.tables[idx].rows.length) {
                    if (!confirm('通讯录“' + name + '”已有' + _contactsState.tables[idx].rows.length + '条数据，导入将覆盖现有表头和全部数据，是否继续？')) return;
                    _contactsState.tables[idx] = table;
                } else if (idx >= 0) _contactsState.tables[idx] = table;
                else { _contactsState.tables.push(table); idx = _contactsState.tables.length - 1; }
                _contactsState.current = idx; _saveContactsState(); renderTrackContent(); showToast('已导入通讯录：' + name);
            };
            reader.readAsArrayBuffer(file);
        }
        function contactsHeaderRowsHtml(headers) { return headers.map(function(h, i) { return '<div class="contactsHeaderRow" draggable="true" data-index="' + i + '"><span class="contactsDragHandle">⋮⋮</span><input class="contactsHeaderInput" value="' + escapeHtml(h) + '"><button class="contactsHeaderDelete" type="button" onclick="this.parentNode.remove()">×</button></div>'; }).join(''); }
        function contactsOpenHeaderSettings() {
            var table = _contactsCurrent(), modal = document.createElement('div'); modal.className = 'contactsModal';
            modal.innerHTML = '<div class="contactsModalBox"><div class="contactsModalTitle">通讯录设置</div><div class="contactsNameRow"><span>通讯录名称：</span><input class="contactsNameInput" id="contactsSettingsName" value="' + escapeHtml(table.name || '') + '"><span>序号：</span><select class="contactsIndexSelect" id="contactsSettingsIndex" onchange="contactsLoadSettingsTable(this.value)">' + _contactsState.tables.map(function(t, i) { return '<option value="' + i + '">' + (i + 1) + '</option>'; }).join('') + '</select></div><div class="contactsHeaderList" id="contactsSettingsHeaders">' + contactsHeaderRowsHtml(table.headers) + '</div><div style="display:flex;gap:8px;padding-top:8px;"><button class="contactsToolBtn" type="button" onclick="contactsAddHeaderRow(this)">+ 增加表头</button><button class="contactsToolBtn" type="button" onclick="contactsStartNewTable(this)">+ 新建通讯录</button></div><div class="contactsModalBtns"><button class="contactsToolBtn contactsDeleteBtn" type="button" onclick="contactsDeleteCurrentTable(this)">删除</button><button class="contactsToolBtn contactsSaveBtn" type="button" onclick="contactsSaveHeaderSettings(this)">保存</button><button class="contactsToolBtn" type="button" onclick="this.closest(\'.contactsModal\').remove()">取消</button></div></div>';
            document.body.appendChild(modal); modal.querySelector('#contactsSettingsIndex').value = String(_contactsState.current || 0); contactsBindHeaderDrag(modal.querySelector('.contactsHeaderList'));
        }
        function contactsLoadSettingsTable(index) { var modal = document.querySelector('.contactsModal'), i = parseInt(index, 10) || 0, table = _contactsState.tables[i]; if (!modal || !table) return; modal.dataset.newTable = '0'; modal.querySelector('#contactsSettingsName').value = table.name || ''; modal.querySelector('#contactsSettingsHeaders').innerHTML = contactsHeaderRowsHtml(table.headers || []); contactsBindHeaderDrag(modal.querySelector('#contactsSettingsHeaders')); }
        function contactsAddHeaderRow(btn) { var list = btn.closest('.contactsModalBox').querySelector('.contactsHeaderList'); var row = document.createElement('div'); row.className = 'contactsHeaderRow'; row.draggable = true; row.innerHTML = '<span class="contactsDragHandle">⋮⋮</span><input class="contactsHeaderInput" value="新字段"><button class="contactsHeaderDelete" type="button" onclick="this.parentNode.remove()">×</button>'; list.appendChild(row); contactsBindHeaderDrag(list); }
        function contactsStartNewTable(btn) { var modal = btn.closest('.contactsModal'); if (!modal) return; modal.dataset.newTable = '1'; modal.querySelector('#contactsSettingsName').value = ''; modal.querySelector('#contactsSettingsIndex').disabled = true; modal.querySelector('#contactsSettingsHeaders').innerHTML = ''; contactsBindHeaderDrag(modal.querySelector('#contactsSettingsHeaders')); }
        function contactsDeleteCurrentTable(btn) { var modal = btn.closest('.contactsModal'), select = modal && modal.querySelector('#contactsSettingsIndex'), idx = select ? parseInt(select.value, 10) : _contactsState.current; if (!isFinite(idx) || !_contactsState.tables[idx]) return; var name = _contactsState.tables[idx].name || '未命名通讯录'; if (!confirm('删除通讯录《' + name + '》，删除后无法恢复，是否继续？')) return; _contactsState.tables.splice(idx, 1); _contactsState.current = Math.max(0, Math.min(idx, _contactsState.tables.length - 1)); _saveContactsState(); modal.remove(); _contactsCurrent(); renderTrackContent(); }
        function contactsBindHeaderDrag(list) { if (!list) return; list.querySelectorAll('.contactsHeaderRow').forEach(function(row) { row.ondragstart = function() { list._drag = row; }; row.ondragover = function(e) { e.preventDefault(); }; row.ondrop = function(e) { e.preventDefault(); if (list._drag && list._drag !== row) list.insertBefore(list._drag, row); }; }); }
        function contactsSaveHeaderSettings(btn) { var modal = btn.closest('.contactsModal'), box = btn.closest('.contactsModalBox'), nameInput = box.querySelector('#contactsSettingsName'), name = (nameInput.value || '').trim(); if (!name) { showToast('请输入通讯录名称'); return; } var rows = box.querySelectorAll('.contactsHeaderInput'), headers = []; rows.forEach(function(x) { if (x.value.trim()) headers.push(x.value.trim()); }); if (!headers.length) { showToast('请至少保留一个表头'); return; } var isNew = modal.dataset.newTable === '1'; if (isNew) { _contactsState.tables.push({ name: name, headers: headers, rows: [] }); _contactsState.current = _contactsState.tables.length - 1; } else { var idx = parseInt(box.querySelector('#contactsSettingsIndex').value, 10) || 0, table = _contactsState.tables[idx]; table.name = name; table.headers = headers; table.rows = table.rows.map(function(row) { var r = row.slice(0, headers.length); while (r.length < headers.length) r.push(''); return r; }); _contactsState.current = idx; } _saveContactsState(); modal.remove(); renderTrackContent(); }
        function contactsEnterPasteMode() {
            var container = document.getElementById('trackContent'), table = _contactsCurrent();
            var pastePreview = { headers: table.headers.slice(), rows: [], widths: table.widths || [] };
            container.classList.add('contactsMode');
            container.innerHTML = '<div class="contactsView"><div class="contactsToolbar"><h2 class="contactsTitle">通讯录</h2><button class="contactsToolBtn" type="button" onclick="contactsExitPasteMode()">返回表格</button><select class="contactsTableSwitch" onchange="contactsSwitchTable(this.value)">' + _contactsTableOptions() + '</select></div><div class="contactsPasteArea"><div class="contactsPastePane"><textarea class="contactsPasteEditor" id="contactsPasteEditor" placeholder="请粘入或输入表格文本"></textarea><div class="contactsPasteBtns"><button class="contactsToolBtn" onclick="contactsPasteClipboard()">粘入</button><button class="contactsToolBtn" onclick="contactsParsePaste()">解析</button></div></div><div class="contactsPasteDivider"></div><div class="contactsPastePane contactsPasteRight"><div class="contactsTableWrap" id="contactsPasteTableWrap">' + _contactsBuildTable(pastePreview) + '</div><div class="contactsPasteImportBar"><span>导入通讯录：</span><select class="contactsTableSwitch" id="contactsPasteImportSelect">' + _contactsTableOptions() + '</select><button class="contactsToolBtn contactsPasteImportBtn" onclick="contactsImportRows(\'append\')">追加导入</button><button class="contactsToolBtn contactsPasteImportBtn" onclick="contactsImportRows(\'replace\')">覆盖导入</button></div></div></div></div>';
            var split = container.querySelector('.contactsPasteDivider'), left = container.querySelector('.contactsPastePane'), right = split && split.nextElementSibling; if (split) split.onmousedown = function(e) { var start = e.clientX, lw = left.getBoundingClientRect().width, rw = right.getBoundingClientRect().width; function move(ev) { var d = ev.clientX - start; left.style.flex = '0 0 ' + Math.max(180, lw + d) + 'px'; right.style.flex = '1 1 auto'; } function up() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); } document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); };
        }
        function contactsExitPasteMode() { renderTrackContent(); }
        function contactsPasteClipboard() { navigator.clipboard.readText().then(function(t) { var e = document.getElementById('contactsPasteEditor'); if (e) e.value += (e.value ? '\n' : '') + t; }).catch(function() { showToast('无法读取剪贴板'); }); }
        function contactsParsePaste() {
            var e = document.getElementById('contactsPasteEditor');
            if (!e) return;
            var table = _contactsCurrent();
            var raw = e.value.split(/\r?\n/).filter(function(x) { return x.trim(); });
            var rows = raw.map(function(line) { return contactsSplitInputLine(line); });
            if (rows.length && contactsLooksLikeHeader(rows[0], table.headers)) rows.shift();
            var hasSerial = table.headers[0] === '序号';
            var normalized = [];
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i].slice();
                if (hasSerial) {
                    if (contactsIsSerial(row[0])) row.shift();
                    row.unshift(String(i + 1));
                }
                row = row.map(function(v) { return String(v || '').replace(/^\s+|\s+$/g, ''); });
                while (row.length < table.headers.length) row.push('');
                if (row.length > table.headers.length) row = row.slice(0, table.headers.length);
                normalized.push(row);
            }
            var wrap = document.getElementById('contactsPasteTableWrap');
            var preview = { headers: table.headers.slice(), rows: normalized, widths: table.widths || [] };
            if (wrap) { wrap.innerHTML = _contactsBuildTable(preview); contactsBindTableInteractions(wrap, preview); }
            window._contactsPasteRows = normalized;
        }
        function contactsIsSerial(value) { return /^\s*\d{1,6}\s*[.,、．]?\s*$/.test(String(value || '')); }
        function contactsSplitInputLine(line) {
            var text = String(line || '').replace(/^\s+|\s+$/g, '');
            var serial = text.match(/^\s*(\d{1,6})\s*[.,、．]?\s*(.*)$/);
            if (serial && serial[2]) return [serial[1]].concat(contactsSplitFields(serial[2]));
            return contactsSplitFields(text);
        }
        function contactsSplitFields(text) {
            var value = String(text || '').trim();
            if (value.indexOf('\t') !== -1) return value.split('\t').map(function(v) { return v.trim(); });
            if (/[，,]/.test(value)) return value.split(/[，,]/).map(function(v) { return v.trim(); });
            if (/\s{2,}/.test(value)) return value.split(/\s{2,}/).map(function(v) { return v.trim(); });
            return value.split(/\s+/).map(function(v) { return v.trim(); });
        }
        function contactsLooksLikeHeader(row, headers) { if (!row || !row.length) return false; var score = 0; for (var i = 0; i < Math.min(row.length, headers.length); i++) { if (String(row[i]).trim() === String(headers[i]).trim()) score++; } return score >= Math.max(1, Math.min(2, headers.length)); }
        function contactsImportRows(mode) { var select = document.getElementById('contactsPasteImportSelect'), targetIndex = select ? parseInt(select.value, 10) : _contactsState.current; if (!isFinite(targetIndex)) targetIndex = _contactsState.current; var table = _contactsState.tables[targetIndex] || _contactsCurrent(), rows = window._contactsPasteRows || []; if (!rows.length) { contactsParsePaste(); rows = window._contactsPasteRows || []; } if (!rows.length) return; table.rows = mode === 'replace' ? rows : table.rows.concat(rows); _contactsState.current = targetIndex; _saveContactsState(); renderTrackContent(); }
        function renderContactsView(container) {
            if (!container) return;
            container.classList.add('contactsMode');
            _contactsRenderMode(container);
        }

// ---- 挂载到 window ----
window.switchTrackMode = switchTrackMode;
window.renderContactsView = renderContactsView;
window.contactsOpenEditRow = contactsOpenEditRow;
window.contactsEditSave = contactsEditSave;
window.contactsEditCancel = contactsEditCancel;
window.contactsEditDelete = contactsEditDelete;
window.contactsApplySearch = contactsApplySearch;
window.contactsSwitchTable = contactsSwitchTable;
window.contactsOpenImportFile = contactsOpenImportFile;
window.contactsExportFile = contactsExportFile;
window.contactsImportFile = contactsImportFile;
window.contactsOpenHeaderSettings = contactsOpenHeaderSettings;
window.contactsEnterPasteMode = contactsEnterPasteMode;
window.contactsExitPasteMode = contactsExitPasteMode;
window.contactsParsePaste = contactsParsePaste;
window.contactsImportRows = contactsImportRows;
window.toggleContactsView = toggleContactsView;
window.closeContactsView = closeContactsView;
