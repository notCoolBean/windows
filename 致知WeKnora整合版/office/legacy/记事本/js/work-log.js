/* ============================================================
   work-log.js — 工作日志模块
   ============================================================ */

var editingPendingInsert = false;

        function updateTrackDate() { var lunar = solar2lunar(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()); var weekDay = weekDays[selectedDate.getDay()]; var dateStr = selectedDate.getFullYear() + '年' + (selectedDate.getMonth() + 1) + '月' + selectedDate.getDate() + '日  周' + weekDay; if (lunar) dateStr += '  ' + lunar.monthStr + lunar.dayStr; document.getElementById('timeRangeDisplay').textContent = dateStr; }
        
        function renderTrackContent() {
            var container = document.getElementById('trackContent');
            if (!currentTrackMode) return;
            var oldScrollTop = container ? container.scrollTop : 0;
            var oldScrollLeft = container ? container.scrollLeft : 0;
            var pageScroller = container ? container.querySelector('.pageViewContainer') : null;
            var oldPageScrollTop = pageScroller ? pageScroller.scrollTop : 0;
            var oldPageScrollLeft = pageScroller ? pageScroller.scrollLeft : 0;
             if (currentTrackMode === 'contacts') {
                 renderContactsView(container);
                 return;
             } else if (currentTrackMode === 'report') {
                 renderReportTable(container);
            } else if (currentTrackMode === 'track') {
                renderMultiTrackTimeline(container);
            } else if (currentTrackMode === 'page') {
                renderPageView(container);
            }
             if (container) {
                 if (currentTrackMode !== 'contacts') container.classList.remove('contactsMode');
                container.scrollTop = oldScrollTop;
                container.scrollLeft = oldScrollLeft;
                pageScroller = container.querySelector('.pageViewContainer');
                if (pageScroller) {
                    pageScroller.scrollTop = oldPageScrollTop;
                    pageScroller.scrollLeft = oldPageScrollLeft;
                }
            }
            var _wkPanel = document.getElementById('weekLogDetailPanel');
            if (_wkPanel && _wkPanel.classList.contains('show') && _weekLogDetailContext) {
                if (_weekLogDetailContext.type === 'unlinked') {
                    if (!_collectUnlinkedWeekLogs().length) closeWeekLogDetailPanel();
                    else renderWeekLogDetailPanel();
                } else if (_weekLogDetailContext.type === 'sub' && !_findLogsBySubItemId(_weekLogDetailContext.id).length) {
                    closeWeekLogDetailPanel();
                } else {
                    renderWeekLogDetailPanel();
                }
            }
            _saveReportToCache();
        }
        
        function initTimeRange() {
            var today = new Date();
            var day = today.getDay();
            var diff = day === 0 ? -6 : 1 - day;
            S.timeRangeStart = new Date(today);
            timeRangeStart.setDate(today.getDate() + diff);
            S.timeRangeEnd = new Date(timeRangeStart);
            timeRangeEnd.setDate(timeRangeStart.getDate() + 6);
            S.timeRangeType = 'week';
            document.getElementById('timeRangeSelect').value = 'week';
            updateTimeRangeDisplay();
        }
        
        function changeTimeRangeType(type) {
            if (type === 'custom') {
                document.getElementById('customDateModal').classList.add('show');
                var today = new Date();
                document.getElementById('customStartDate').value = (today.getMonth() + 1) + '月' + today.getDate() + '日（周' + weekDays[today.getDay()] + '）';
                document.getElementById('customEndDate').value = (today.getMonth() + 1) + '月' + today.getDate() + '日（周' + weekDays[today.getDay()] + '）';
                S.customPickerTarget = 'start';
                S.datePickerYear = today.getFullYear();
                S.datePickerMonth = today.getMonth();
                document.getElementById('timeRangeSelect').value = timeRangeType;
                return;
            }
            S.timeRangeType = type;
            var today = new Date();
            if (type === 'day') {
                S.timeRangeStart = new Date(today);
                S.timeRangeEnd = new Date(today);
            } else if (type === 'week') {
                var day = today.getDay();
                var diff = day === 0 ? -6 : 1 - day;
                S.timeRangeStart = new Date(today);
                timeRangeStart.setDate(today.getDate() + diff);
                S.timeRangeEnd = new Date(timeRangeStart);
                timeRangeEnd.setDate(timeRangeStart.getDate() + 6);
            } else if (type === 'month') {
                S.timeRangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
                S.timeRangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            } else if (type === 'quarter') {
                var quarter = Math.floor(today.getMonth() / 3);
                S.timeRangeStart = new Date(today.getFullYear(), quarter * 3, 1);
                S.timeRangeEnd = new Date(today.getFullYear(), quarter * 3 + 3, 0);
            } else if (type === 'halfyear') {
                var half = today.getMonth() < 6 ? 0 : 1;
                S.timeRangeStart = new Date(today.getFullYear(), half * 6, 1);
                S.timeRangeEnd = new Date(today.getFullYear(), half * 6 + 6, 0);
            } else if (type === 'year') {
                S.timeRangeStart = new Date(today.getFullYear(), 0, 1);
                S.timeRangeEnd = new Date(today.getFullYear(), 11, 31);
            }
            
            S._showAllRecords = false;
            _clearStagedLogKeys();
            updateTimeRangeDisplay();
            renderTrackContent();
        }
        (function() {
            var sel = document.getElementById('timeRangeSelect');
            if (sel) {
                sel.addEventListener('change', function() {
                    changeTimeRangeType(this.value);
                });
            }
        })();

        // 切换到指定日期的天视图
        function selectDayView(year, month, day) {
            S.timeRangeType = 'day';
            S.timeRangeStart = new Date(year, month, day);
            S.timeRangeEnd = new Date(year, month, day);
            S._showAllRecords = false;
            _clearStagedLogKeys();
            document.getElementById('timeRangeSelect').value = 'day';
            updateTimeRangeDisplay();
            renderTrackContent();
        }
        
        function prevTimeRange() {
            if (timeRangeType === 'custom') { showToast('自定义模式请选择新的起止日期'); return; }
            if (timeRangeType === 'day') {
                timeRangeStart.setDate(timeRangeStart.getDate() - 1);
                timeRangeEnd.setDate(timeRangeEnd.getDate() - 1);
            } else if (timeRangeType === 'week') {
                timeRangeStart.setDate(timeRangeStart.getDate() - 7);
                timeRangeEnd.setDate(timeRangeEnd.getDate() - 7);
            } else if (timeRangeType === 'month') {
                timeRangeStart.setMonth(timeRangeStart.getMonth() - 1);
                S.timeRangeEnd = new Date(timeRangeStart.getFullYear(), timeRangeStart.getMonth() + 1, 0);
            } else if (timeRangeType === 'quarter') {
                timeRangeStart.setMonth(timeRangeStart.getMonth() - 3);
                S.timeRangeEnd = new Date(timeRangeStart.getFullYear(), timeRangeStart.getMonth() + 3, 0);
            } else if (timeRangeType === 'halfyear') {
                timeRangeStart.setMonth(timeRangeStart.getMonth() - 6);
                S.timeRangeEnd = new Date(timeRangeStart.getFullYear(), timeRangeStart.getMonth() + 6, 0);
            } else if (timeRangeType === 'year') {
                timeRangeStart.setFullYear(timeRangeStart.getFullYear() - 1);
                S.timeRangeEnd = new Date(timeRangeStart.getFullYear(), 11, 31);
            }
            S._showAllRecords = false;
            _clearStagedLogKeys();
            updateTimeRangeDisplay();
            renderTrackContent();
        }
        
        function nextTimeRange() {
            if (timeRangeType === 'custom') { showToast('自定义模式请选择新的起止日期'); return; }
            if (timeRangeType === 'day') {
                timeRangeStart.setDate(timeRangeStart.getDate() + 1);
                timeRangeEnd.setDate(timeRangeEnd.getDate() + 1);
            } else if (timeRangeType === 'week') {
                timeRangeStart.setDate(timeRangeStart.getDate() + 7);
                timeRangeEnd.setDate(timeRangeEnd.getDate() + 7);
            } else if (timeRangeType === 'month') {
                timeRangeStart.setMonth(timeRangeStart.getMonth() + 1);
                S.timeRangeEnd = new Date(timeRangeStart.getFullYear(), timeRangeStart.getMonth() + 1, 0);
            } else if (timeRangeType === 'quarter') {
                timeRangeStart.setMonth(timeRangeStart.getMonth() + 3);
                S.timeRangeEnd = new Date(timeRangeStart.getFullYear(), timeRangeStart.getMonth() + 3, 0);
            } else if (timeRangeType === 'halfyear') {
                timeRangeStart.setMonth(timeRangeStart.getMonth() + 6);
                S.timeRangeEnd = new Date(timeRangeStart.getFullYear(), timeRangeStart.getMonth() + 6, 0);
            } else if (timeRangeType === 'year') {
                timeRangeStart.setFullYear(timeRangeStart.getFullYear() + 1);
                S.timeRangeEnd = new Date(timeRangeStart.getFullYear(), 11, 31);
            }
            _showAllRecords = false;
            _clearStagedLogKeys();
            updateTimeRangeDisplay();
            renderTrackContent();
        }
        
        function updateTimeRangeDisplay() {
            var display = document.getElementById('timeRangeDisplay');
            if (!display) return;
            
            if (timeRangeType === 'day') {
                var lunar = solar2lunar(timeRangeStart.getFullYear(), timeRangeStart.getMonth(), timeRangeStart.getDate());
                var weekDay = weekDays[timeRangeStart.getDay()];
                var str = timeRangeStart.getFullYear() + '年' + (timeRangeStart.getMonth() + 1) + '月' + timeRangeStart.getDate() + '日 周' + weekDay;
                if (lunar) str += ' ' + lunar.monthStr + lunar.dayStr;
                display.textContent = str;
            } else {
                var sy = timeRangeStart.getFullYear(), ey = timeRangeEnd.getFullYear();
                var sMd = (timeRangeStart.getMonth() + 1) + '月' + timeRangeStart.getDate() + '日（周' + weekDays[timeRangeStart.getDay()] + '）';
                var eMd = (timeRangeEnd.getMonth() + 1) + '月' + timeRangeEnd.getDate() + '日（周' + weekDays[timeRangeEnd.getDay()] + '）';
                var startStr, endStr;
                if (sy !== ey) {
                    // 跨年度：两端都带年份
                    startStr = sy + '年' + sMd;
                    endStr = ey + '年' + eMd;
                } else if (timeRangeType === 'year' || sy !== new Date().getFullYear()) {
                    // 同年但为年度模式或非当年：起始端前缀年份
                    startStr = sy + '年' + sMd;
                    endStr = eMd;
                } else {
                    startStr = sMd;
                    endStr = eMd;
                }
                display.textContent = startStr + ' — ' + endStr;
            }
        }
        
        function getDateKeysForRange() {
            var keys = [];
            var current = new Date(timeRangeStart);
            while (current <= timeRangeEnd) {
                keys.push(getDateKeyFor(current.getFullYear(), current.getMonth(), current.getDate()));
                var newDate = new Date(current);
                newDate.setDate(current.getDate() + 1);
                current = newDate;
            }
            return keys;
        }
        
        function _yearFromKey(dateKey) {
            if (!dateKey) return null;
            var m = String(dateKey).match(/^(\d{4})-/);
            return m ? parseInt(m[1], 10) : null;
        }
        function isItemInTimeRange(startTimeStr, endTimeStr, yearHint) {
            if (!startTimeStr) return false;
            var startDate = parseTimeStrToDate(startTimeStr, yearHint);
            var endDate = getEffectiveWorkEndDate(startTimeStr, endTimeStr, yearHint) || startDate;
            if (!startDate || !endDate) return false;
            var sY = startDate.getFullYear(), sM = startDate.getMonth(), sD = startDate.getDate();
            var eY = endDate.getFullYear(), eM = endDate.getMonth(), eD = endDate.getDate();
            var rsY = timeRangeStart.getFullYear(), rsM = timeRangeStart.getMonth(), rsD = timeRangeStart.getDate();
            var reY = timeRangeEnd.getFullYear(), reM = timeRangeEnd.getMonth(), reD = timeRangeEnd.getDate();
            var itemStartNum = sY * 365 + sM * 31 + sD;
            var itemEndNum = eY * 365 + eM * 31 + eD;
            var rangeStartNum = rsY * 365 + rsM * 31 + rsD;
            var rangeEndNum = reY * 365 + reM * 31 + reD;
            return itemStartNum <= rangeEndNum && itemEndNum >= rangeStartNum;
        }
        function dateRangeContains(startTimeStr, endTimeStr, targetDate, yearHint) {
            if (!startTimeStr) return false;
            var startDate = parseTimeStrToDate(startTimeStr, yearHint);
            var endDate = getEffectiveWorkEndDate(startTimeStr, endTimeStr, yearHint) || startDate;
            if (!startDate || !endDate) return false;
            
            var targetYear = targetDate.getFullYear();
            var targetMonth = targetDate.getMonth();
            var targetDay = targetDate.getDate();
            
            var startYear = startDate.getFullYear();
            var startMonth = startDate.getMonth();
            var startDay = startDate.getDate();
            
            var endYear = endDate.getFullYear();
            var endMonth = endDate.getMonth();
            var endDay = endDate.getDate();
            
            var targetTotalDays = targetYear * 365 + targetMonth * 31 + targetDay;
            var startTotalDays = startYear * 365 + startMonth * 31 + startDay;
            var endTotalDays = endYear * 365 + endMonth * 31 + endDay;
            
            return targetTotalDays >= startTotalDays && targetTotalDays <= endTotalDays;
        }
        
        function parseTimeStrToDate(timeStr, yearHint) {
            if (!timeStr) return null;
            if (timeStr === '——') {
                var now = new Date();
                return new Date(now.getFullYear(), now.getMonth(), now.getDate());
            }
            var match = timeStr.match(/(\d+)月(\d+)日/);
            if (match) {
                var month = parseInt(match[1]) - 1;
                var day = parseInt(match[2]);
                // yearHint 优先（来自 dateKey，权威）；否则用 timeRangeStart 年份 + ±1 兜底
                if (yearHint) {
                    return new Date(yearHint, month, day);
                }
                var baseYear = timeRangeStart.getFullYear();
                var date = new Date(baseYear, month, day);
                // 跨年度修正：时间串不含年份，先按起始年构造，
                // 若落在时段外则尝试 ±1 年（如 12月底~1月初 的周边界）
                if (date < timeRangeStart) {
                    var d2 = new Date(baseYear + 1, month, day);
                    if (d2 <= timeRangeEnd) date = d2;
                } else if (date > timeRangeEnd) {
                    var d3 = new Date(baseYear - 1, month, day);
                    if (d3 >= timeRangeStart) date = d3;
                }
                return date;
            }
            return null;
        }
        
        function updateCategoryList() {
            S.categoryList = [];
            for (var key in reportData) {
                var items = reportData[key];
                for (var i = 0; i < items.length; i++) {
                    if (items[i].category && categoryList.indexOf(items[i].category) === -1) {
                        categoryList.push(items[i].category);
                    }
                }
            }
            categoryList.sort(function(a, b) { return a.localeCompare(b, 'zh-CN'); });
        }
        
        function sortData(col, dir) {
            S.currentSortCol = col;
            S.currentSortDir = dir;
            renderTrackContent();
        }
        
        function searchTable(keyword) {
            S.searchKeyword = keyword.trim().toLowerCase();
            renderTrackContent();
        }
        
        function getSearchKeywordList() {
            if (!searchKeyword) return [];
            var parts = searchKeyword.split(/\s+/);
            var out = [];
            for (var i = 0; i < parts.length; i++) {
                var p = parts[i].trim();
                if (p) out.push(p);
            }
            return out;
        }
        function rowMatchesSearch(row) {
            var kws = getSearchKeywordList();
            if (kws.length === 0) return true;
            var category = (row.category || '').toLowerCase();
            var content = (row.content || '').toLowerCase();
            var remark = (row.remark || '').toLowerCase();
            var attachText = '';
            if (row.attachments && row.attachments.length) {
                for (var ai = 0; ai < row.attachments.length; ai++) {
                    var att = row.attachments[ai];
                    if (att && typeof att === 'object') attachText += ' ' + (att.name || '') + ' ' + (att.path || '');
                    else if (att) attachText += ' ' + String(att);
                }
            }
            attachText = attachText.toLowerCase();
            for (var i = 0; i < kws.length; i++) {
                var k = kws[i];
                if (category.indexOf(k) !== -1) return true;
                if (content.indexOf(k) !== -1) return true;
                if (remark.indexOf(k) !== -1) return true;
                if (attachText.indexOf(k) !== -1) return true;
            }
            return false;
        }
        
        function highlightText(text, keyword) {
            if (!keyword || !text) return escapeHtml(text);
            var kws = getSearchKeywordList();
            var escapedText = escapeHtml(text);
            if (kws.length === 0) return escapedText;
            var hlClasses = ['logSearchHL0','logSearchHL1','logSearchHL2','logSearchHL3','logSearchHL4'];
            var allMatches = [];
            for (var ki = 0; ki < kws.length; ki++) {
                var kw = kws[ki];
                if (!kw) continue;
                var escaped = escapeHtml(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (!escaped) continue;
                var re = new RegExp(escaped, 'gi');
                var m;
                while ((m = re.exec(escapedText)) !== null) {
                    allMatches.push({ start: m.index, end: m.index + m[0].length, cls: hlClasses[ki % hlClasses.length] });
                    if (m.index === re.lastIndex) re.lastIndex++;
                }
            }
            if (allMatches.length === 0) return escapedText;
            allMatches.sort(function(a, b) {
                if (a.start !== b.start) return a.start - b.start;
                return b.end - a.end;
            });
            var result = '';
            var lastEnd = 0;
            for (var mi = 0; mi < allMatches.length; mi++) {
                var match = allMatches[mi];
                if (match.start < lastEnd) continue;
                result += escapedText.substring(lastEnd, match.start);
                result += '<span class="' + match.cls + '">' + escapedText.substring(match.start, match.end) + '</span>';
                lastEnd = match.end;
            }
            result += escapedText.substring(lastEnd);
            return result;
        }

        function onWorkLogImportClick() {
            if (!_workLogImportInput) {
                _workLogImportInput = document.createElement('input');
                _workLogImportInput.type = 'file';
                _workLogImportInput.accept = '.js,.json,.txt';
                _workLogImportInput.style.display = 'none';
                document.body.appendChild(_workLogImportInput);
                _workLogImportInput.addEventListener('change', onWorkLogImportFile);
            }
            _workLogImportInput.value = '';
            _workLogImportInput.click();
        }
        var _workLogImportInput = null;
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
        function csvUnescapeSaveAsText(raw) {
            var lines = raw.split(/\r?\n/);
            for (var i = 0; i < lines.length; i++) {
                if (i === 0) lines[i] = lines[i].replace(/^\uFEFF/, '');
                var ln = lines[i];
                if (ln.length >= 2 && ln.charAt(0) === '"' && ln.charAt(ln.length - 1) === '"') {
                    lines[i] = ln.substring(1, ln.length - 1).replace(/""/g, '"');
                }
            }
            return lines.join('\n');
        }
        function onWorkLogImportFile(e) {
            var f = e.target.files && e.target.files[0];
            if (!f) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var raw = ev.target.result || '';
                    raw = csvUnescapeSaveAsText(raw);
                    var parsed = null;
                    try { parsed = JSON.parse(raw); } catch (e1) {
                        var noComments = _stripJsCommentsSafe(raw);
                        var assign = noComments.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
                        if (assign) parsed = JSON.parse(assign[1]);
                        else {
                            var anyObj = noComments.match(/\{[\s\S]*\}/);
                            if (anyObj) parsed = JSON.parse(anyObj[0]);
                        }
                    }
                    if (!parsed) { showToast('解析失败：未找到有效数据'); return; }
                    var rd = parsed.reportData || parsed;
                    if (typeof rd !== 'object') { showToast('文件中无 reportData'); return; }
                    var insertedCount = 0;
                    for (var k in rd) {
                        if (!rd.hasOwnProperty(k)) continue;
                        var arr = rd[k];
                        if (!Array.isArray(arr)) continue;
                        if (!reportData[k]) reportData[k] = [];
                        // prepend imported entries to keep them on top
                        for (var i = arr.length - 1; i >= 0; i--) {
                            reportData[k].unshift(arr[i]);
                            insertedCount++;
                        }
                    }
                    updateCategoryList();
                    try { _migrateAllSubTimestamps(); } catch (_me) {}
                    try { _migrateAllSubItemIds(); } catch (_me2) {}
                    renderTrackContent();
                    showToast('已导入 ' + insertedCount + ' 条记录');
                } catch (err) { showToast('导入失败：' + err.message); }
            };
            reader.onerror = function() { showToast('读取文件失败'); };
            reader.readAsText(f);
        }

        function onWorkLogExportToggle() {
            S.workLogExportMode = !workLogExportMode;
            renderTrackContent();
        }
        function cancelWorkLogExport() {
            S.workLogExportMode = false;
            renderTrackContent();
        }
        function onWorkLogToggleAll(checked) {
            var checks = document.querySelectorAll('.workLogExportCheck');
            for (var i = 0; i < checks.length; i++) checks[i].checked = !!checked;
        }
        function formatTimeRangeLabel() {
            function fmt(d) { return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
            var s = timeRangeStart, e = timeRangeEnd;
            if (!s) s = new Date();
            if (!e) e = new Date();
            if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate()) {
                return fmt(s);
            }
            return fmt(s) + '至' + fmt(e);
        }
        function confirmWorkLogExport() {
            var checks = document.querySelectorAll('.workLogExportCheck');
            var selectedRows = [];
            for (var i = 0; i < checks.length; i++) {
                if (checks[i].checked) {
                    selectedRows.push(parseInt(checks[i].getAttribute('data-row'), 10));
                }
            }
            if (!selectedRows.length) { showToast('请至少勾选一条记录'); return; }
            var filtered = getFilteredData();
            var exportRD = {};
            for (var j = 0; j < selectedRows.length; j++) {
                var idx = selectedRows[j];
                var row = filtered[idx];
                if (!row) continue;
                var dk = row._dateKey;
                var oi = row._origIndex;
                var src = (reportData[dk] && reportData[dk][oi]) ? reportData[dk][oi] : null;
                if (!src) continue;
                if (!exportRD[dk]) exportRD[dk] = [];
                var copy = JSON.parse(JSON.stringify(src));
                delete copy._dateKey; delete copy._origIndex; delete copy._pendingInsert; delete copy._insertAfterIndex;
                exportRD[dk].push(copy);
            }
            var data = { reportData: exportRD };
            var content = 'var savedData = ' + JSON.stringify(data, null, 2) + ';';
            var blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
            var now = new Date();
            var ts = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
            var label = formatTimeRangeLabel();
            var fileName = ts + ' 导出日志（' + label + '）.js';
            fileName = fileName.replace(/[\\\/:*?"<>|]/g, '_');
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            S.workLogExportMode = false;
            renderTrackContent();
            showToast('已导出 ' + selectedRows.length + ' 条记录');
        }

        function getWorkLogTemplateXml() {
            var el = document.getElementById('workLogTemplate');
            return el ? el.textContent : '';
        }
        function getWorkLogTitleByTimeRange() {
            var now = new Date();
            var nowMs = now.getTime();
            var endRef = timeRangeEnd ? new Date(timeRangeEnd.getFullYear(), timeRangeEnd.getMonth(), timeRangeEnd.getDate(), 23, 59, 59, 999) : now;
            if (endRef.getTime() > nowMs) return '××工作安排';
            return '××工作完成情况';
        }
        function formatTimeRangeShort() {
            var s = timeRangeStart, e = timeRangeEnd;
            if (!s) s = new Date();
            if (!e) e = new Date();
            var sy = s.getFullYear(), sm = s.getMonth() + 1, sd = s.getDate();
            var ey = e.getFullYear(), em = e.getMonth() + 1, ed = e.getDate();
            if (sy === ey && sm === em && sd === ed) {
                return sy + '年' + sm + '月' + sd + '日';
            }
            if (sy === ey && sm === em) {
                return sy + '年' + sm + '月' + sd + '日至' + ed + '日';
            }
            if (sy === ey) {
                return sy + '年' + sm + '月' + sd + '日至' + em + '月' + ed + '日';
            }
            return sy + '年' + sm + '月' + sd + '日至' + ey + '年' + em + '月' + ed + '日';
        }
        function escapeXmlForWord(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }
        function buildWorkLogRowXml(seq, category, content) {
            var seqText = escapeXmlForWord(seq);
            var catText = escapeXmlForWord(category);
            var contentText = escapeXmlForWord(content);
            var rowXml = '';
            rowXml += '<w:tr><w:tblPrEx><w:tblBorders><w:top w:val="single" w:sz="12" wx:bdrwidth="30" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="12" wx:bdrwidth="30" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="12" wx:bdrwidth="30" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="12" wx:bdrwidth="30" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" wx:bdrwidth="10" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" wx:bdrwidth="10" w:space="0" w:color="auto"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPrEx><w:trPr><w:trHeight w:val="970" w:h-rule="atLeast"/><w:jc w:val="center"/></w:trPr>';
            // 序号 cell
            rowXml += '<w:tc><w:tcPr><w:tcW w:w="1060" w:type="dxa"/><w:tcBorders><w:tl2br w:val="nil"/><w:tr2bl w:val="nil"/></w:tcBorders><w:shd w:val="clear" w:color="000000" w:fill="FFFFFF"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:keepNext w:val="off"/><w:keepLines w:val="off"/><w:pageBreakBefore w:val="off"/><w:widowControl/><w:kinsoku/><w:wordWrap/><w:overflowPunct/><w:topLinePunct w:val="off"/><w:autoSpaceDE/><w:autoSpaceDN/><w:adjustRightInd/><w:snapToGrid/><w:spacing w:line="360" w:line-rule="exact"/><w:jc w:val="center"/><w:textAlignment w:val="auto"/><w:rPr><w:rFonts w:ascii="楷体_GB2312" w:h-ansi="楷体_GB2312" w:fareast="楷体_GB2312" w:cs="楷体_GB2312" w:hint="default"/><w:sz w:val="32"/><w:sz-cs w:val="32"/><w:highlight w:val="none"/><w:lang w:val="EN-US" w:fareast="ZH-CN"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="楷体_GB2312" w:h-ansi="楷体_GB2312" w:fareast="楷体_GB2312" w:cs="楷体_GB2312" w:hint="fareast"/><w:sz w:val="32"/><w:sz-cs w:val="32"/><w:highlight w:val="none"/><w:lang w:val="EN-US" w:fareast="ZH-CN"/></w:rPr><w:t>' + seqText + '</w:t></w:r></w:p></w:tc>';
            // 内容 cell: 事项名称（楷体）+。具体内容（仿宋）
            rowXml += '<w:tc><w:tcPr><w:tcW w:w="8264" w:type="dxa"/><w:tcBorders><w:tl2br w:val="nil"/><w:tr2bl w:val="nil"/></w:tcBorders><w:shd w:val="clear" w:color="000000" w:fill="FFFFFF"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:keepNext w:val="off"/><w:keepLines w:val="off"/><w:pageBreakBefore w:val="off"/><w:widowControl/><w:kinsoku/><w:wordWrap/><w:overflowPunct/><w:topLinePunct w:val="off"/><w:autoSpaceDE/><w:autoSpaceDN/><w:adjustRightInd/><w:snapToGrid/><w:spacing w:line="240" w:line-rule="auto"/><w:jc w:val="left"/><w:textAlignment w:val="auto"/><w:rPr><w:rFonts w:ascii="楷体_GB2312" w:h-ansi="楷体_GB2312" w:fareast="楷体_GB2312" w:cs="楷体_GB2312" w:hint="default"/><w:sz w:val="32"/><w:sz-cs w:val="32"/><w:highlight w:val="none"/><w:lang w:val="EN-US" w:fareast="ZH-CN"/></w:rPr></w:pPr>';
            if (catText) {
                rowXml += '<w:r><w:rPr><w:rFonts w:ascii="楷体_GB2312" w:h-ansi="楷体_GB2312" w:fareast="楷体_GB2312" w:cs="楷体_GB2312" w:hint="fareast"/><w:sz w:val="32"/><w:sz-cs w:val="32"/><w:highlight w:val="none"/><w:lang w:val="EN-US" w:fareast="ZH-CN"/></w:rPr><w:t>' + catText + '</w:t></w:r>';
            }
            if (contentText) {
                var connector = catText ? '。' : '';
                rowXml += '<w:r><w:rPr><w:rFonts w:ascii="仿宋_GB2312" w:h-ansi="仿宋_GB2312" w:fareast="仿宋_GB2312" w:cs="仿宋_GB2312" w:hint="fareast"/><w:sz w:val="32"/><w:sz-cs w:val="32"/><w:highlight w:val="none"/><w:lang w:val="EN-US" w:fareast="ZH-CN"/></w:rPr><w:t>' + escapeXmlForWord(connector) + contentText + '</w:t></w:r>';
            }
            rowXml += '</w:p></w:tc></w:tr>';
            return rowXml;
        }
        function confirmWorkLogExportDoc() {
            var checks = document.querySelectorAll('.workLogExportCheck');
            var selectedRows = [];
            for (var i = 0; i < checks.length; i++) {
                if (checks[i].checked) selectedRows.push(parseInt(checks[i].getAttribute('data-row'), 10));
            }
            if (!selectedRows.length) { showToast('请至少勾选一条记录'); return; }
            var filtered = getFilteredData();
            var rowsXml = '';
            var seq = 0;
            for (var j = 0; j < selectedRows.length; j++) {
                var idx = selectedRows[j];
                var row = filtered[idx];
                if (!row) continue;
                seq++;
                var category = (row.category || '').replace(/[\r\n]+/g, '');
                var contentTxt = (row.content || '').replace(/[\r\n]+/g, '');
                rowsXml += buildWorkLogRowXml(seq, category, contentTxt);
            }
            var tpl = getWorkLogTemplateXml();
            if (!tpl) { showToast('未找到数据模板'); return; }
            var title = getWorkLogTitleByTimeRange();
            var rangeShort = formatTimeRangeShort();
            var xml = tpl
                .replace('__TITLE__', escapeXmlForWord(title))
                .replace('__TIMERANGE__', escapeXmlForWord(rangeShort))
                .replace('__ROWS__', rowsXml);
            var blob = new Blob([xml], { type: 'application/msword' });
            var now = new Date();
            var ts = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
            var fileName = (ts + ' ' + title + '（' + rangeShort + '）.docx').replace(/[\\\/:*?"<>|]/g, '_');
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            S.workLogExportMode = false;
            renderTrackContent();
            showToast('已导出文档：' + fileName);
        }

        function formatLogTimeDisplay(startTime, endTime) {
            startTime = startTime || '';
            endTime = endTime || '';
            var startDateMatch = startTime.match(/(\d+)月(\d+)日/);
            var startWeekMatch = startTime.match(/周([一二三四五六日])/);
            var endDateMatch = endTime.match(/(\d+)月(\d+)日/);
            var endWeekMatch = endTime.match(/周([一二三四五六日])/);
            if (!startDateMatch || !startWeekMatch) return startTime;
            var startLabel = startDateMatch[1] + '月' + startDateMatch[2] + '日';
            var startWeekLabel = '周' + startWeekMatch[1];
            if (startTime === endTime || !endTime) return startLabel + '\n' + startWeekLabel;
            if (endTime === '——') return startLabel + '-—\n' + startWeekLabel + '-—';
            if (endDateMatch && endWeekMatch) {
                var endDateLabel = (endDateMatch[1] === startDateMatch[1] ? endDateMatch[2] : endDateMatch[1] + '月' + endDateMatch[2]) + '日';
                var startRangeLabel = endDateMatch[1] === startDateMatch[1] ? startDateMatch[1] + '月' + startDateMatch[2] : startLabel;
                return startRangeLabel + '-' + endDateLabel + '\n' + startWeekLabel + '-周' + endWeekMatch[1];
            }
            return startLabel + '\n' + startWeekLabel;
        }

        function isWeekWorkItem(item) {
            var category = item && item.category ? String(item.category) : '';
            return category.indexOf('周') !== -1 && category.indexOf('工作') !== -1;
        }

        function formatLogTimePageDisplay(startTime, endTime) {
            startTime = startTime || '';
            endTime = endTime || '';
            var startDateMatch = startTime.match(/(\d+)月(\d+)日/);
            var startWeekMatch = startTime.match(/周([一二三四五六日])/);
            var endDateMatch = endTime.match(/(\d+)月(\d+)日/);
            var endWeekMatch = endTime.match(/周([一二三四五六日])/);
            if (!startDateMatch || !startWeekMatch) return startTime;
            var startLabel = startDateMatch[1] + '月' + startDateMatch[2] + '日';
            var startWeekLabel = '周' + startWeekMatch[1];
            if (startTime === endTime || !endTime) return startLabel + '（' + startWeekLabel + '）';
            if (endTime === '——') return startLabel + '（' + startWeekLabel + '）至—';
            if (endDateMatch && endWeekMatch) {
                var endDateLabel = (endDateMatch[1] === startDateMatch[1] ? endDateMatch[2] : endDateMatch[1] + '月' + endDateMatch[2]) + '日';
                return startLabel + '（' + startWeekLabel + '）至' + endDateLabel + '（周' + endWeekMatch[1] + '）';
            }
            return startLabel + '（' + startWeekLabel + '）';
        }

        function formatLogTimePageStartDisplay(startTime) {
            startTime = startTime || '';
            var dateMatch = startTime.match(/(\d+月\d+日)/);
            var weekMatch = startTime.match(/周([一二三四五六日])/);
            if (dateMatch && weekMatch) return dateMatch[1] + '（周' + weekMatch[1] + '）';
            return dateMatch ? dateMatch[1] : startTime;
        }

         function formatLogTimePageEntryDisplay(startTime, endTime) {
            startTime = startTime || '';
             endTime = endTime || '';
             if (/周/.test(startTime) && /工作/.test(startTime)) return '';
            var startDateMatch = startTime.match(/(\d+月\d+日)/);
            var startWeekMatch = startTime.match(/周([一二三四五六日])/);
            var endDateMatch = endTime.match(/(\d+月\d+日)/);
            var endWeekMatch = endTime.match(/周([一二三四五六日])/);
            if (!startDateMatch || !startWeekMatch) return startTime;
            var startLabel = startDateMatch[1] + '（周' + startWeekMatch[1] + '）';
            if (startTime === endTime || !endTime) return startLabel;
            if (endTime === '——') return startLabel + ' 至 ——';
            if (endDateMatch && endWeekMatch) {
                return startLabel + ' 至 ' + endDateMatch[1] + '（周' + endWeekMatch[1] + '）';
            }
            return startLabel;
        }

        function pageViewStatusClass(status) {
             return { '■': 'status-filled', '□': 'status-empty', '√': 'status-check', '…': 'status-dot', '×': 'status-cross' }[status || ''] || 'status-none';
        }

        function pageViewEntryStatusClass(status) {
            return 'status-' + (status || 'normal');
        }

        function pageViewEntryStatusSymbol(status) {
            return { urgent: '■', normal: '□', done: '√', memo: '…', cancel: '×' }[status || 'normal'] || '□';
        }

        function pageViewWeekDateStart(date) {
            var d = new Date(date);
            d.setHours(0, 0, 0, 0);
            var day = d.getDay();
            d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
            return d;
        }

        // 目标周是否尚未到来（周一零点晚于今天零点）
        function _isFutureWeekStart(date) {
            if (!date) return false;
            var start = pageViewWeekDateStart(date);
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            return start.getTime() > today.getTime();
        }

        // 迁移/复制到未来周时，已完成(√)或已取消(×)的状态回落为 □
        function _futureWeekMark(mark, targetDate) {
            if (!_isFutureWeekStart(targetDate)) return mark;
            if (mark === '√' || mark === '×') return '□';
            return mark;
        }

        function pageViewWeekNavHtml() {
            if (timeRangeType !== 'week') return '';
            var monday = pageViewWeekDateStart(timeRangeStart);
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var html = '<div class="pageViewWeekNav" onclick="event.stopPropagation();">';
            for (var groupOffset = -1; groupOffset <= 1; groupOffset++) {
                var groupClass = groupOffset === 0 ? '' : ' adjacent';
                html += '<div class="pageViewWeekGroup' + groupClass + '">';
                for (var i = 0; i < 7; i++) {
                    var d = new Date(monday);
                    d.setDate(monday.getDate() + groupOffset * 7 + i);
                    var isToday = d.getTime() === today.getTime();
                    var dateKey = getDateKeyFor(d.getFullYear(), d.getMonth(), d.getDate());
                    var label = isToday ? '今' : (d.getDate() + '\n' + ['一','二','三','四','五','六','日'][i]);
                    var lunar = solar2lunar(d.getFullYear(), d.getMonth(), d.getDate());
                    var lunarText = lunar ? lunar.monthStr + lunar.dayStr : '';
                    var cls = 'pageViewWeekBtn' + (i >= 5 ? ' weekend' : '') + (isToday ? ' today' : '') + (pageViewFilterDateKey === dateKey ? ' filter-selected' : '');
                    html += '<button class="' + cls + '" title="' + d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日（周' + weekDays[d.getDay()] + '）  ' + lunarText + '" data-week-date="' + dateKey + '" onclick="pageViewWeekButtonClick(event,this)">' + label + '</button>';
                }
                html += '</div>';
            }
            return html + '</div>';
        }

        function pageViewWeekButtonClick(e, button) {
            e.stopPropagation();
            if (!button.closest('.pageViewWeekGroup') || button.closest('.pageViewWeekGroup').classList.contains('adjacent')) return;
            var dateKey = button.getAttribute('data-week-date') || '';
            if (pageViewFilterDateKey === dateKey) {
                S.pageViewFilterDateKey = '';
                renderTrackContent();
                return;
            }
            S.pageViewFilterDateKey = dateKey;
            renderTrackContent();
        }

        function pageViewFilterDate(dateKey) {
            var m = (dateKey || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            return m ? new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])) : null;
        }

        function pageViewSubItemDateRange(line, rowDateKey, previousDate) {
            var m = (line || '').match(/^\s*(?:\d+[\.。、]\s*)?(?:(\d+)月)?(\d+)日(?:\s*(?:至|到|-|—)\s*(?:(\d+)月)?(\d+)日)?/);
            if (m) {
                var keyDate = pageViewFilterDate(rowDateKey);
                var year = keyDate ? keyDate.getFullYear() : timeRangeStart.getFullYear();
                var baseMonth = keyDate ? keyDate.getMonth() : timeRangeStart.getMonth();
                var day = parseInt(m[2]);
                var month = m[1] ? parseInt(m[1]) - 1 : baseMonth;
                if (!m[1] && previousDate && new Date(year, month, day) < previousDate) month++;
                else if (!m[1] && !previousDate && keyDate && day < keyDate.getDate()) month++;
                var start = new Date(year, month, day);
                var end = start;
                if (m[4]) {
                    var endMonth = m[3] ? parseInt(m[3]) - 1 : month;
                    if (!m[3] && parseInt(m[4]) < day) endMonth++;
                    end = new Date(year, endMonth, parseInt(m[4]));
                }
                if (end < start) end = new Date(year, month + 1, end.getDate());
                return { start: start, end: end };
            }
            var w = (line || '').match(/^\s*(?:\d+[\.。、]\s*)?(?:周|星期)([一二三四五六日])/);
            if (w) {
                var monday = pageViewWeekDateStart(timeRangeStart);
                var weekIndex = ['一','二','三','四','五','六','日'].indexOf(w[1]);
                if (weekIndex >= 0) {
                    monday.setDate(monday.getDate() + weekIndex);
                    return { start: monday, end: monday };
                }
            }
            return { start: null, end: null };
        }

        function pageViewSubItemDate(line, rowDateKey, previousDate) {
            return pageViewSubItemDateRange(line, rowDateKey, previousDate).start;
        }

        function pageViewFilterItemByDate(item, dateKey) {
            if (!pageViewFilterDateKey || !item) return item;
            var parsed = parseSubItemContent(item.content || '');
            var target = pageViewFilterDate(pageViewFilterDateKey);
            if (!target) return item;
            target.setHours(0, 0, 0, 0);
            var marked = [];
            for (var i = 0; i < (parsed.items || []).length; i++) {
                var sub = parsed.items[i];
                var previousDate = i > 0 ? pageViewSubItemDate(parsed.items[i - 1].text, dateKey) : null;
                var d = pageViewSubItemDate(sub.text, dateKey, previousDate);
                if (d) {
                    d.setHours(0, 0, 0, 0);
                    marked.push({ item: sub, match: d.getTime() === target.getTime() });
                }
            }
            if (marked.length > 0) {
                var matchedLines = [];
                for (var j = 0; j < marked.length; j++) {
                    if (marked[j].match) matchedLines.push(parsed.lines[marked[j].item.lineIdx]);
                }
                if (!matchedLines.length) return null;
                var copy = Object.assign({}, item);
                copy.content = matchedLines.join('\n');
                copy._pageViewFilterRank = 0;
                return copy;
            }
            if (dateRangeContains(item.startTime, item.endTime, target, _yearFromKey(dateKey))) {
                var start = parseTimeStrToDate(item.startTime, _yearFromKey(dateKey));
                var end = parseTimeStrToDate(item.endTime, _yearFromKey(dateKey));
                var targetTime = target.getTime();
                var startsOrEndsToday = (start && start.getTime() === targetTime) || (end && end.getTime() === targetTime);
                var copyFallback = Object.assign({}, item);
                copyFallback._pageViewFilterRank = startsOrEndsToday ? 1 : 2;
                return copyFallback;
            }
            return null;
        }

        function getEffectiveWorkEndDate(startTimeStr, endTimeStr, yearHint) {
            var startDate = parseTimeStrToDate(startTimeStr, yearHint);
            if (!startDate) return null;
            if (endTimeStr === '——' || !endTimeStr) {
                var endDate = new Date(startDate);
                var day = endDate.getDay();
                endDate.setDate(endDate.getDate() + (day === 0 ? 0 : 7 - day));
                endDate.setHours(0, 0, 0, 0);
                return endDate;
            }
            return parseTimeStrToDate(endTimeStr, yearHint);
        }

        function pageViewEditSubItem(dateKey, origIndex, subIndex) {
            var item = reportData[dateKey] && reportData[dateKey][origIndex];
            if (!item) return;
            var parsed = parseSubItemContent(item.content || '');
            var target = parsed.items && parsed.items[subIndex];
            if (!target) return;
            var current = (target.text || '').replace(/^\s*\d+[\.。、]\s*/, '').replace(/[■□√…×]\s*$/, '').replace(/^\s+|\s+$/g, '');
            if (typeof window.paShowTagDialog !== 'function') return;
             var currentMark = (target.text.match(/[■□√…×]\s*$/) || [''])[0].trim();
             var currentTimestamp = Array.isArray(item.subTimestamps) ? (item.subTimestamps[subIndex] || '') : (target.timestamp || '');
             window.paShowTagDialog(current, function(input) {
                if (input === null) return;
                var clean = (input || '').replace(/[\r\n]+/g, ' ').replace(/^\s+|\s+$/g, '');
                if (!clean) return;
                var prefix = (target.text.match(/^\s*\d+[\.。、]\s*/) || [''])[0];
                  var mark = (target.text.match(/[■□√…×]\s*$/) || [''])[0];
                parsed.lines[target.lineIdx] = prefix + clean + mark;
                item.content = parsed.lines.join('\n');
                pageViewSortDatedSubItems(item);
                 _saveReportToCache();
                 renderTrackContent();
                 updateFooterTimestamp();
                 var weekModeEl = document.querySelector('input[name="paTagDialogWeekMode"]:checked');
                 var weekDirectionEl = document.getElementById('paTagDialogWeekDirection');
                 if (weekModeEl && weekDirectionEl) pageViewAdjustSubItemWeek(dateKey, origIndex, subIndex, weekDirectionEl.value === 'prev' ? -1 : 1, weekModeEl.value === 'move' ? 'move' : 'copy');
               }, { title: '编辑当前分项', okText: '保  存', singleLine: true, subItemEdit: true, subItemStatus: currentMark, subItemTimestamp: currentTimestamp, nextWeek: { dateKey: dateKey, origIndex: origIndex, subIndex: subIndex } });
         }

        function pageViewSortDatedSubItems(item) {
            var parsed = parseSubItemContent(item.content || '');
            var ids = Array.isArray(item.subItemIds) ? item.subItemIds : null;
            var dated = [];
            for (var i = 0; i < parsed.items.length; i++) {
                var d = pageViewSubItemDate(parsed.items[i].text, item._dateKey || '');
                if (d) dated.push({ index: i, lineIdx: parsed.items[i].lineIdx, date: d, text: parsed.lines[parsed.items[i].lineIdx], id: ids ? ids[i] : null });
            }
            if (dated.length < 2) return;
            // 目标槽位：日期分项在 items 中的位置（升序），其行号也随之升序。
            var positions = dated.map(function(x) { return x.index; }).sort(function(a, b) { return a - b; });
            var sorted = dated.slice().sort(function(a, b) { return a.date - b.date || a.index - b.index; });
            for (var k = 0; k < positions.length; k++) {
                var slot = positions[k];
                parsed.lines[parsed.items[slot].lineIdx] = sorted[k].text;
                if (ids) ids[slot] = sorted[k].id;
            }
            item.content = parsed.lines.join('\n');
        }

         function normalizePageViewSubItemName(text) {
             return (text || '')
                 .replace(/^\s*\d+[\.。、]\s*/, '')
                 .replace(/^\s*[\(\（]\d+[\)\）]\s*/, '')
                 .replace(/[■□√…×]\s*$/, '')
                 .replace(/[。；;，,、：:！？!?]+$/g, '')
                  .replace(/^\s+|\s+$/g, '');
         }
         function _replaceSubItemSequence(text, number) {
             var source = String(text || '');
             var match = source.match(/^(\s*)\d+([.．。、])(\s*)/);
             if (!match) return String(number) + '.' + source;
             return match[1] + number + match[2] + match[3] + source.slice(match[0].length);
         }

         // ===== 周工作分项ID与日志绑定 =====
         function _weekWorkNowId() {
             return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
         }
         // 为某个周工作日志项的分项数组补齐稳定ID，尽量复用已有数据（按旧的方式对齐或按名称匹配）。
         function _migrateItemSubItemIds(item) {
             if (!item || typeof item !== 'object') return;
             var parsed = parseSubItemContent(item.content || '');
             var count = (parsed.items || []).length;
             if (!Array.isArray(item.subItemIds)) item.subItemIds = [];
             if (item.subItemIds.length === count) return;
             var old = item.subItemIds.slice();
             var next = [];
             for (var j = 0; j < count; j++) next.push(old[j] || '');
             // 旧数组更长（曾删除过分项）：把溢出部分按名称优先回填到空槽，尽量保持绑定。
             if (old.length > count) {
                 var blanks = [];
                 for (var b = 0; b < next.length; b++) if (!next[b]) blanks.push(b);
                 var leftover = old.slice(count);
                 for (var l = 0; l < leftover.length && blanks.length; l++) {
                     if (leftover[l]) next[blanks.shift()] = leftover[l];
                 }
             }
             for (var z = 0; z < next.length; z++) if (!next[z]) next[z] = _weekWorkNowId();
             item.subItemIds = next;
         }
         // 保证所有周工作项都有 subItemIds，并同步新增/删除导致的数量差。
         function _migrateAllSubItemIds() {
             for (var k in reportData) {
                 if (!reportData.hasOwnProperty(k)) continue;
                 var arr = reportData[k];
                 if (!Array.isArray(arr)) continue;
                 for (var i = 0; i < arr.length; i++) {
                     var item = arr[i];
                     if (item && isWeekWorkItem(item)) _migrateItemSubItemIds(item);
                 }
             }
         }
         // 在增删分项后同步 subItemIds 长度：newCount 对应分项数量；删除时用 removedIndex 定位。
         function _syncSubItemIds(item, newCount, removedIndex) {
             if (!item || typeof item !== 'object') return;
             if (!Array.isArray(item.subItemIds)) item.subItemIds = [];
             if (typeof removedIndex === 'number' && removedIndex >= 0 && removedIndex < item.subItemIds.length) {
                 item.subItemIds.splice(removedIndex, 1);
             }
             while (item.subItemIds.length < newCount) item.subItemIds.push(_weekWorkNowId());
             while (item.subItemIds.length > newCount) item.subItemIds.pop();
         }
         // 读取/确保某分项的ID。
         function _subItemIdAt(item, subIndex) {
             if (!item || !isWeekWorkItem(item)) return '';
             var parsed = parseSubItemContent(item.content || '');
             var count = (parsed.items || []).length;
             if (!Array.isArray(item.subItemIds)) item.subItemIds = [];
             var changed = false;
             while (item.subItemIds.length < count) { item.subItemIds.push(_weekWorkNowId()); changed = true; }
             if (item.subItemIds.length > count) { item.subItemIds.length = count; changed = true; }
             if (!item.subItemIds[subIndex]) { item.subItemIds[subIndex] = _weekWorkNowId(); changed = true; }
             if (changed) _saveReportToCache();
             return item.subItemIds[subIndex] || '';
         }
         // 遍历全部日志，找出绑定了 subItemId 的日志记录。
         function _findLogsBySubItemId(subItemId) {
             var hits = [];
             if (!subItemId) return hits;
             for (var key in reportData) {
                 if (!reportData.hasOwnProperty(key)) continue;
                 var arr = reportData[key];
                 if (!Array.isArray(arr)) continue;
                 for (var i = 0; i < arr.length; i++) {
                     if (arr[i] && arr[i].weekWorkSubId === subItemId) hits.push({ dateKey: key, origIndex: i, item: arr[i] });
                 }
             }
             return hits;
         }
         // 某周工作项的所有已用ID集合。
         function _usedSubItemIdsInItem(item) {
             var used = {};
             if (!item || !Array.isArray(item.subItemIds)) return used;
             for (var i = 0; i < item.subItemIds.length; i++) { if (item.subItemIds[i]) used[item.subItemIds[i]] = true; }
             return used;
         }
         // 收集当前时间段内的周工作分项（用于下拉选择器）。返回 {id,label,text}。
         function _collectWeekLinkOptions() {
             var options = [];
             var targetDate = timeRangeType === 'day' ? timeRangeStart : null;
             var seen = {};
             for (var key in reportData) {
                 if (!reportData.hasOwnProperty(key)) continue;
                 var arr = reportData[key];
                 if (!Array.isArray(arr)) continue;
                 var yh = _yearFromKey(key);
                 for (var i = 0; i < arr.length; i++) {
                     var item = arr[i];
                     if (!item || !isWeekWorkItem(item)) continue;
                     var inRange = _showAllRecords || (targetDate
                         ? dateRangeContains(item.startTime, item.endTime, targetDate, yh)
                         : isItemInTimeRange(item.startTime, item.endTime, yh));
                     if (!inRange) continue;
                     var parsed = parseSubItemContent(item.content || '');
                     var ids = Array.isArray(item.subItemIds) ? item.subItemIds : [];
                     for (var s = 0; s < (parsed.items || []).length; s++) {
                         var id = ids[s] || _subItemIdAt(item, s);
                         if (!id || seen[id]) continue;
                         seen[id] = true;
                         var text = normalizePageViewSubItemName(parsed.items[s].text);
                         options.push({ id: id, text: text, label: (item.category || '周工作') + '：' + text });
                     }
                 }
             }
             return options;
         }

         function pageViewAddSubItemToLog(dateKey, origIndex, subIndex) {
            var source = reportData[dateKey] && reportData[dateKey][origIndex];
            if (!source) return;
            var parsed = parseSubItemContent(source.content || '');
            var target = parsed.items && parsed.items[subIndex];
            if (!target) return;
             var subText = normalizePageViewSubItemName(target.text);
            var subItemId = _subItemIdAt(source, subIndex);
            // 优先按分项ID查找已绑定日志；兼容旧数据再按名称查找。
            var bound = _findLogsBySubItemId(subItemId);
            if (bound.length) {
                openEditModalByKey(bound[0].dateKey, bound[0].origIndex);
                return;
            }
            var subTextNorm = _normalizeSubItemNameForLogMatch(subText);
            var currentWeekStart = pageViewWeekDateStart(timeRangeStart);
            var mondayText = (currentWeekStart.getMonth() + 1) + '月' + currentWeekStart.getDate() + '日（周' + weekDays[currentWeekStart.getDay()] + '）';
            var targetKey = getDateKeyFor(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), currentWeekStart.getDate());
            var existing = null, existingKey = targetKey, existingIndex = -1;
            for (var ek in reportData) {
                var ea = reportData[ek] || [];
                for (var ei = 0; ei < ea.length; ei++) {
                     if (_normalizeSubItemNameForLogMatch(ea[ei].category) === subTextNorm && dateRangeContains(ea[ei].startTime, ea[ei].endTime, currentWeekStart, _yearFromKey(ek))) { existing = ea[ei]; existingKey = ek; existingIndex = ei; break; }
                }
                if (existing) break;
            }
            if (existing) {
                existing.weekWorkSubId = subItemId;
                _saveReportToCache();
                openEditModalByKey(existingKey, existingIndex);
                return;
            }
            if (!reportData[targetKey]) reportData[targetKey] = [];
            var newItem = { category: subText, startTime: mondayText, endTime: '——', endAuto: true, time: mondayText + '———', content: '', remark: '', status: 'normal', attachments: [], weekWorkSubId: subItemId, _pendingInsert: true };
            reportData[targetKey].push(newItem);
            updateCategoryList();
            S.editingDateKey = targetKey;
            S.editingRowIndex = reportData[targetKey].length - 1;
            editingPendingInsert = true;
            // 必须重置插入位置，否则会沿用上一次“在行后插入”的位置，保存时多生成一条记录
            editingInsertAfterIndex = -1;
            document.getElementById('editCategory').value = subText;
            document.getElementById('editStartTime').value = mondayText;
            document.getElementById('editEndTime').value = mondayText;
            document.getElementById('editContent').value = '';
            document.getElementById('editRemark').value = '';
            document.getElementById('editStatus').value = 'normal';
            var auto = document.getElementById('editEndAuto');
            if (auto) auto.checked = true;
            toggleEndTimeAuto(true);
            initCategoryInput();
            _setupEditWeekLink(subItemId);
             document.getElementById('editModal').classList.add('show');
         }

         // 打开日志编辑窗口时初始化“周工作：”选择器。
         function _setupEditWeekLink(subItemId) {
             var row = document.getElementById('editWeekLinkRow');
             var sel = document.getElementById('editWeekLinkSelect');
             if (!row || !sel) return;
             var options = _collectWeekLinkOptions();
             sel.innerHTML = '';
             var emptyOpt = document.createElement('option');
             emptyOpt.value = '';
             emptyOpt.textContent = '';
             sel.appendChild(emptyOpt);
             var found = false;
             for (var i = 0; i < options.length; i++) {
                 var opt = document.createElement('option');
                 opt.value = options[i].id;
                 opt.textContent = options[i].label;
                 sel.appendChild(opt);
                 if (subItemId && options[i].id === subItemId) found = true;
             }
             if (subItemId && !found) {
                 var cur = _findWeekSubItemLabel(subItemId);
                 var opt2 = document.createElement('option');
                 opt2.value = subItemId;
                 opt2.textContent = cur || ('未在当前时间段的分项');
                 sel.appendChild(opt2);
             }
             sel.value = subItemId || '';
             row.style.display = '';
         }
         function _findWeekSubItemInfo(subItemId) {
             if (!subItemId) return null;
             for (var key in reportData) {
                 var arr = reportData[key];
                 if (!Array.isArray(arr)) continue;
                 for (var i = 0; i < arr.length; i++) {
                     var item = arr[i];
                     if (!item || !isWeekWorkItem(item) || !Array.isArray(item.subItemIds)) continue;
                     var idx = item.subItemIds.indexOf(subItemId);
                     if (idx === -1) continue;
                     var parsed = parseSubItemContent(item.content || '');
                     var it = parsed.items && parsed.items[idx];
                     if (!it) continue;
                     return { category: item.category || '周工作', name: normalizePageViewSubItemName(it.text) };
                 }
             }
             return null;
         }
         function _findWeekSubItemLabel(subItemId) {
             var info = _findWeekSubItemInfo(subItemId);
             return info ? (info.category + '：' + info.name) : '';
         }
         function _findWeekSubItemName(subItemId) {
             var info = _findWeekSubItemInfo(subItemId);
             return info ? info.name : '';
         }
         function onWeekLinkSelectChange() {
             // 切换周工作分项时立即更新当前编辑日志的绑定ID（保存时再落库）。
             if (editingDateKey === null || editingRowIndex === null) return;
             var item = reportData[editingDateKey] && reportData[editingDateKey][editingRowIndex];
             if (!item) return;
             var sel = document.getElementById('editWeekLinkSelect');
             var val = sel ? (sel.value || '') : '';
             if (val) item.weekWorkSubId = val;
             else delete item.weekWorkSubId;
         }

         function pageViewAddSubItem(dateKey, origIndex, subIndex) {
             var item = reportData[dateKey] && reportData[dateKey][origIndex];
             if (!item) return;
             var parsed = parseSubItemContent(item.content || '');
             var target = parsed.items && parsed.items[subIndex];
             if (!target || typeof window.paShowTagDialog !== 'function') return;
             window.paShowTagDialog('', function(input) {
                 if (input === null) return;
                 var clean = (input || '').replace(/[\r\n]+/g, ' ').replace(/^\s+|\s+$/g, '');
                 if (!clean) return;
                 var targetLine = parsed.lines[target.lineIdx] || '';
                 var prefixMatch = targetLine.match(/^(\s*)\d+([\.。、])/);
                 var prefix = prefixMatch ? prefixMatch[1] + '0' + prefixMatch[2] : '';
                 parsed.lines.splice(target.lineIdx + 1, 0, prefix + clean);
                 var reparsed = parseSubItemContent(parsed.lines.join('\n'));
                 for (var i = 0; i < reparsed.items.length; i++) {
                     var line = reparsed.lines[reparsed.items[i].lineIdx] || '';
                     reparsed.lines[reparsed.items[i].lineIdx] = line.replace(/^(\s*)\d+([\.。、])/, '$1' + (i + 1) + '$2');
                 }
                 item.content = reparsed.lines.join('\n');
                 if (isWeekWorkItem(item)) {
                     _subItemIdAt(item, subIndex);
                     item.subItemIds.splice(subIndex + 1, 0, _weekWorkNowId());
                 }
                 _saveReportToCache();
                 renderTrackContent();
                 updateFooterTimestamp();
             }, { title: '新增分项：', okText: '保存', singleLine: true });
         }

         function pageViewAdjustSubItemWeek(dateKey, origIndex, subIndex, weekOffset, mode) {
             var source = reportData[dateKey] && reportData[dateKey][origIndex];
             if (!source) return;
             var sourceParsed = parseSubItemContent(source.content || '');
             var sourceItem = sourceParsed.items && sourceParsed.items[subIndex];
             if (!sourceItem) return;
             var text = normalizePageViewSubItemName(sourceItem.text);
             var mark = (sourceItem.text.match(/[■□√…×]\s*$/) || [''])[0].trim();
             var sourceTs = Array.isArray(source.subTimestamps) ? (source.subTimestamps[subIndex] || '') : (sourceItem.timestamp || '');
             var sourceSubId = _subItemIdAt(source, subIndex);
             var sourceStart = pageViewWeekDateStart(parseTimeStrToDate(source.startTime, _yearFromKey(dateKey)) || new Date());
             var targetStart = new Date(sourceStart);
             targetStart.setDate(targetStart.getDate() + (weekOffset < 0 ? -7 : 7));
             targetStart.setHours(0, 0, 0, 0);
             var targetEnd = new Date(targetStart);
             targetEnd.setDate(targetEnd.getDate() + 6);
             targetEnd.setHours(23, 59, 59, 999);
             // 目标周尚未到来时（未来），√/× 状态一律回落为 □，并清空该分项时间戳。
             if (_isFutureWeekStart(targetStart) && (mark === '√' || mark === '×')) {
                 mark = '□';
                 sourceTs = '';
             }
             var targetCategory = isWeekWorkItem(source) ? '周工作' : source.category;
             var target = null, targetKey = getDateKeyFor(targetStart.getFullYear(), targetStart.getMonth(), targetStart.getDate());
             for (var key in reportData) {
                 var arr = reportData[key] || [];
                 for (var i = 0; i < arr.length; i++) {
                     var candidate = arr[i];
                     if (candidate.category !== targetCategory) continue;
                     var candidateStart = parseTimeStrToDate(candidate.startTime, _yearFromKey(key));
                     var candidateEnd = getEffectiveWorkEndDate(candidate.startTime, candidate.endTime, _yearFromKey(key)) || candidateStart;
                     if (candidateStart && candidateEnd && candidateStart <= targetEnd && candidateEnd >= targetStart) { target = candidate; targetKey = key; break; }
                 }
                 if (target) break;
             }
             if (!target) {
                 var startText = (targetStart.getMonth() + 1) + '月' + targetStart.getDate() + '日（周' + weekDays[targetStart.getDay()] + '）';
                 var endText = (targetEnd.getMonth() + 1) + '月' + targetEnd.getDate() + '日（周' + weekDays[targetEnd.getDay()] + '）';
                 if (!reportData[targetKey]) reportData[targetKey] = [];
                 target = { category: targetCategory, startTime: startText, endTime: isWeekWorkItem(source) ? endText : '——', endAuto: !isWeekWorkItem(source), time: startText + '—' + (isWeekWorkItem(source) ? endText : '——'), content: '', remark: '', status: 'normal', attachments: [] };
                 reportData[targetKey].push(target);
             }
             var targetParsed = parseSubItemContent(target.content || '');
             for (var ti = 0; ti < targetParsed.items.length; ti++) {
                 if (normalizePageViewSubItemName(targetParsed.items[ti].text) === text) {
                     showToast((weekOffset < 0 ? '上周' : '下周') + '已有该项工作，不能重复添加');
                     return;
                 }
             }
             var _newSubCount = targetParsed.items.length + 1;
             targetParsed.lines.push(_replaceSubItemSequence(sourceItem.text, targetParsed.items.length + 1).replace(/[■□√…×]\s*$/, '') + (mark || ''));
             target.content = targetParsed.lines.join('\n');
             if (sourceTs || Array.isArray(target.subTimestamps)) {
                 if (!Array.isArray(target.subTimestamps)) target.subTimestamps = [];
                 while (target.subTimestamps.length < _newSubCount - 1) target.subTimestamps.push('');
                 target.subTimestamps.push(sourceTs || '');
             }
             // 迁移时把稳定ID一并带走；复制时目标周使用新ID，避免两处分项共用同一绑定。
             if (mode === 'move' && sourceSubId) {
                 if (!Array.isArray(target.subItemIds)) target.subItemIds = [];
                 target.subItemIds.push(sourceSubId);
             } else {
                 if (!Array.isArray(target.subItemIds)) target.subItemIds = [];
                 target.subItemIds.push(_weekWorkNowId());
             }
               if (mode === 'move') {
                   sourceParsed.lines.splice(sourceItem.lineIdx, 1);
                   source.content = sourceParsed.lines.join('\n').replace(/^\n+|\n+$/g, '');
                   if (Array.isArray(source.subTimestamps)) source.subTimestamps.splice(subIndex, 1);
                   if (Array.isArray(source.subItemIds)) source.subItemIds.splice(subIndex, 1);
                   source.content = renumberMovedSubItems(source.content);
                   if (!String(source.content || '').trim() && confirm('迁移后当前日志内容已为空，是否删除该日志记录？')) {
                      reportData[dateKey].splice(origIndex, 1);
                      delete _stagedLogKeys[dateKey + '::' + origIndex];
                  }
              }
             _saveReportToCache();
             renderTrackContent();
             updateFooterTimestamp();
             showToast((mode === 'move' ? '已迁移到' : '已复制到') + (weekOffset < 0 ? '上周' : '下周'));
         }

        function movePageViewSubItemToNextWeek(dateKey, origIndex, subIndex) {
            var source = reportData[dateKey] && reportData[dateKey][origIndex];
            if (!source || !source.category) return;
            var parsed = parseSubItemContent(source.content || '');
            var target = parsed.items && parsed.items[subIndex];
            if (!target) return;
            var text = (target.text || '').replace(/^\s*\d+[\.。、]\s*/, '').replace(/[■□√…×]\s*$/, '').replace(/^\s+|\s+$/g, '');
            var mark = (target.text.match(/[■□√…×]\s*$/) || [''])[0].trim();
            var visibleWeekStart = timeRangeType === 'week'
                ? pageViewWeekDateStart(timeRangeStart)
                : pageViewWeekDateStart(new Date());
            visibleWeekStart.setHours(0, 0, 0, 0);
            var nextStart = new Date(visibleWeekStart); nextStart.setDate(nextStart.getDate() + 7); nextStart.setHours(0, 0, 0, 0);
            var nextEnd = new Date(nextStart); nextEnd.setDate(nextEnd.getDate() + 6); nextEnd.setHours(23, 59, 59, 999);
            var nextKey = getDateKeyFor(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate());
            var isWeekWork = isWeekWorkItem(source);
            // 目标周在未来时，√/× 回落为 □。
            mark = _futureWeekMark(mark, nextStart);
            var targetCategory = isWeekWork ? '周工作' : source.category;
            var targetWeek = null, targetWeekKey = nextKey;
            for (var key in reportData) {
                var arr = reportData[key] || [];
                for (var i = 0; i < arr.length; i++) {
                    var item = arr[i];
                    if (item.category === targetCategory) {
                        var itemStart = parseTimeStrToDate(item.startTime, _yearFromKey(key));
                        var itemEnd = getEffectiveWorkEndDate(item.startTime, item.endTime, _yearFromKey(key)) || itemStart;
                        if (itemStart && itemEnd && itemStart <= nextEnd && itemEnd >= nextStart) { targetWeek = item; targetWeekKey = key; break; }
                    }
                }
                if (targetWeek) break;
            }
            if (!targetWeek) {
                var startText = (nextStart.getMonth() + 1) + '月' + nextStart.getDate() + '日（周' + weekDays[nextStart.getDay()] + '）';
                var endText = (nextEnd.getMonth() + 1) + '月' + nextEnd.getDate() + '日（周' + weekDays[nextEnd.getDay()] + '）';
                if (!reportData[targetWeekKey]) reportData[targetWeekKey] = [];
                targetWeek = { category: targetCategory, startTime: startText, endTime: isWeekWork ? endText : '——', endAuto: !isWeekWork, time: startText + '—' + (isWeekWork ? endText : '——'), content: '', remark: '', status: 'normal', attachments: [] };
                reportData[targetWeekKey].push(targetWeek);
            }
            var movedSubId = isWeekWork ? _subItemIdAt(source, subIndex) : '';
            parsed.lines.splice(target.lineIdx, 1);
            source.content = parsed.lines.join('\n').replace(/^\n+|\n+$/g, '');
            if (isWeekWork && Array.isArray(source.subItemIds)) source.subItemIds.splice(subIndex, 1);
            var targetParsed = parseSubItemContent(targetWeek.content || '');
            targetParsed.lines.push((targetParsed.items.length + 1) + '.' + text + (mark || ''));
            targetWeek.content = targetParsed.lines.join('\n');
            if (isWeekWork) {
                if (!Array.isArray(targetWeek.subItemIds)) targetWeek.subItemIds = [];
                targetWeek.subItemIds.push(movedSubId || _weekWorkNowId());
            }
            _saveReportToCache();
            var dlg = document.getElementById('paTagDialog');
            if (dlg) dlg.classList.remove('show');
            renderTrackContent();
            updateFooterTimestamp();
            showToast('已将分项调整到下周');
        }

        function updatePageViewWeekNavHighlight(entry) {
            var nav = document.querySelector('.pageViewWeekNav');
            if (!nav || !entry) return;
            var sd = parseTimeStrToDate(entry.startTime, _yearFromKey(entry._dateKey));
            var ed = parseTimeStrToDate(entry.endTime, _yearFromKey(entry._dateKey));
            if (!sd) return;
            if (!ed) ed = sd;
            sd.setHours(0, 0, 0, 0);
            ed.setHours(0, 0, 0, 0);
            var buttons = nav.querySelectorAll('.pageViewWeekBtn');
            for (var i = 0; i < buttons.length; i++) {
                var dateKey = buttons[i].getAttribute('data-week-date') || '';
                var dateParts = dateKey.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
                var d = dateParts ? new Date(parseInt(dateParts[1]), parseInt(dateParts[2]) - 1, parseInt(dateParts[3])) : null;
                var active = d && d >= sd && d <= ed;
                buttons[i].classList.toggle('active', !!active);
                buttons[i].classList.toggle('muted', !active);
                buttons[i].classList.remove('filter-selected');
            }
        }

        function clearPageViewWeekNavHighlight() {
            var nav = document.querySelector('.pageViewWeekNav');
            if (!nav) return;
            var buttons = nav.querySelectorAll('.pageViewWeekBtn');
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].classList.remove('active');
                buttons[i].classList.remove('muted');
                buttons[i].classList.remove('filter-selected');
            }
        }

        // 计算固定定位浮层的位置：优先向下展开，空间不足时向上翻，保证不超出屏幕。
        // 返回已经按主界面缩放（zoom）换算好的 left/top。
        function _npPlaceFloating(el, rect, opts) {
            opts = opts || {};
            var zoom = parseFloat(DataLayer.getRaw('mainZoom') || '1');
            if (!isFinite(zoom) || zoom <= 0) zoom = 1;
            var vw = window.innerWidth, vh = window.innerHeight;
            var w = el.offsetWidth || opts.width || 120;
            var h = el.offsetHeight || opts.height || 100;
            var margin = 6;
            if (h > vh - 8) {
                el.style.maxHeight = Math.round((vh - 8) / zoom) + 'px';
                el.style.overflowY = 'auto';
                h = vh - 8;
            }
            var left = (opts.align === 'left') ? rect.left : rect.right + margin;
            if (left + w > vw - 4) left = rect.right - w;
            if (opts.align !== 'left' && left + w > vw - 4) left = rect.left - w - margin;
            if (left < 4) left = 4;
            if (left + w > vw - 4) left = Math.max(4, vw - w - 4);
            var spaceBelow = vh - rect.bottom;
            var spaceAbove = rect.top;
            var top, flipped = false;
            if (h + 4 > spaceBelow && spaceAbove > spaceBelow) {
                top = rect.top - h - margin;
                flipped = true;
            } else {
                top = rect.bottom + margin;
            }
            if (top < 4) top = 4;
            if (top + h > vh - 4) top = Math.max(4, vh - h - 4);
            el.style.left = Math.round(left / zoom) + 'px';
            el.style.top = Math.round(top / zoom) + 'px';
            el.style.zoom = zoom;
            el.style.transformOrigin = flipped ? 'bottom left' : 'top left';
            return { left: left, top: top, flipped: flipped };
        }

        var _npEntryStatusOptions = [
            { value: 'urgent', label: '■ 加急办理' },
            { value: 'normal', label: '□ 正常办理' },
            { value: 'done', label: '√ 已办结' },
            { value: 'memo', label: '… 备忘' },
            { value: 'cancel', label: '× 已取消' }
        ];

        function showPageViewEntryStatusMenu(e, dateKey, origIndex) {
            var old = document.querySelector('.pageViewEntryStatusSelect');
            if (old) old.remove();
            var item = reportData[dateKey] && reportData[dateKey][origIndex];
            if (!item) return;
            var cur = item.status || 'normal';
            var box = document.createElement('div');
            box.className = 'pageViewEntryStatusSelect';
            var html = '';
            for (var i = 0; i < _npEntryStatusOptions.length; i++) {
                var o = _npEntryStatusOptions[i];
                html += '<div class="pageViewEntryStatusOption' + (o.value === cur ? ' current' : '') +
                    '" data-value="' + o.value + '">' + o.label + '</div>';
            }
            box.innerHTML = html;
            box.style.visibility = 'hidden';
            document.body.appendChild(box);
            _npPlaceFloating(box, e.currentTarget.getBoundingClientRect(), { width: 132, height: box.offsetHeight || 132 });
            box.style.visibility = '';
            box.addEventListener('click', function(ev) {
                ev.stopPropagation();
                var opt = ev.target.closest('.pageViewEntryStatusOption');
                if (!opt) return;
                item.status = opt.getAttribute('data-value') || 'normal';
                _saveReportToCache();
                renderTrackContent();
                updateFooterTimestamp();
                box.remove();
            });
            // 点击/滚动到浮层外部即关闭
            setTimeout(function() {
                document.addEventListener('mousedown', _npEntryStatusOutside, true);
                window.addEventListener('scroll', _npEntryStatusOutside, true);
            }, 0);
            function _npEntryStatusOutside(ev) {
                if (ev.type === 'mousedown' && box.contains(ev.target)) return;
                box.remove();
                document.removeEventListener('mousedown', _npEntryStatusOutside, true);
                window.removeEventListener('scroll', _npEntryStatusOutside, true);
            }
            e.stopPropagation();
        }

        function pageViewSubItemHtml(line, row, rowDateKey, rowOrigIndex, subIndex, entry) {
            var mark = row.mark || '';
             var statusClass = pageViewStatusClass(mark);
             var markHtml = '<span class="pageViewSubStatus ' + statusClass + '" title="点击修改分项状态" onclick="event.stopPropagation();showPageViewSubStatusMenu(event,this,' + subIndex + ',\'' + escapeHtml(rowDateKey || '').replace(/'/g, '&#39;') + '\',' + rowOrigIndex + ')">' + (mark ? escapeHtml(mark) : ' ') + '</span>';
            var text = mark ? line.substring(0, line.length - mark.length).replace(/\s+$/, '') : line;
            var rowKey = escapeHtml(rowDateKey || '').replace(/'/g, '&#39;');
            var subIndexText = subIndex;
            if (!entry) entry = reportData[rowDateKey] && reportData[rowDateKey][rowOrigIndex];
            // 单日筛选时内容被裁剪，分项索引与原始记录不再对应，避免错误绑定。
            var isWeekWork = entry && isWeekWorkItem(entry) && typeof entry._pageViewFilterRank === 'undefined';
            var subId = '';
            if (isWeekWork) subId = _subItemIdAt(entry, subIndex);
            var subIdAttr = subId ? ' data-sub-id="' + escapeHtml(subId).replace(/"/g, '&quot;') + '"' : '';
            var subIdEsc = escapeHtml(subId).replace(/'/g, '&#39;');
            var linkClick = '';
            var subLinkHtml = '';
            if (isWeekWork && subId) {
                var _linkedLogs = _findLogsBySubItemId(subId);
                if (_linkedLogs.length) {
                    subLinkHtml = '<span class="pageViewSubLink" data-sub-id="' + escapeHtml(subId).replace(/"/g, '&quot;') + '" title="查看关联的普通工作日志（' + _linkedLogs.length + '条）" onclick="event.stopPropagation();pageViewSubItemClick(\'' + subIdEsc + '\')"><img class="paSubLinkIcon" src="data/link.ico" alt=""><span class="paSubLinkCount">' + _linkedLogs.length + '</span></span>';
                }
            }
             return '<div class="pageViewContentLine pageViewSubItem ' + statusClass + '" draggable="true" data-sub-index="' + subIndexText + '"' + subIdAttr + ' ' + linkClick + 'ondragstart="pageViewSubDragStart(event,this)" ondragover="pageViewSubDragOver(event,this)" ondragleave="pageViewSubDragLeave(this)" ondrop="pageViewSubDrop(event,this,\'' + rowKey + '\',' + rowOrigIndex + ')" ondragend="pageViewSubDragEnd()" ondblclick="event.stopPropagation();pageViewSubItemDblClick(\'' + rowKey + '\',' + rowOrigIndex + ',' + subIndexText + ')" oncontextmenu="event.preventDefault();event.stopPropagation();pageViewShowSubMenu(event,\'' + rowKey + '\',' + rowOrigIndex + ',' + subIndexText + ')">' + highlightText(text, searchKeyword) + markHtml + subLinkHtml + '</div>';
        }
        // 单击分项：延迟打开关联日志，双击/状态操作时不打开
        var _weekSubClickTimer = null;
        var _weekSubDblGuard = false;
        function pageViewSubItemClick(subId) {
            if (!subId) return;
            if (_weekSubDblGuard) return;
            if (document.querySelector('.pageViewSubStatusPicker') || document.querySelector('#paTagDialog.show') || document.querySelector('#editModal.show')) return;
            if (_weekSubClickTimer) clearTimeout(_weekSubClickTimer);
            _weekSubClickTimer = setTimeout(function() {
                _weekSubClickTimer = null;
                if (_weekSubDblGuard) return;
                if (document.querySelector('.pageViewSubStatusPicker') || document.querySelector('#editModal.show')) return;
                showWeekSubItemLogDetail(subId);
            }, 230);
        }
        function pageViewSubItemDblClick(dateKey, origIndex, subIndex) {
            if (_weekSubClickTimer) { clearTimeout(_weekSubClickTimer); _weekSubClickTimer = null; }
            _weekSubDblGuard = true;
            setTimeout(function() { _weekSubDblGuard = false; }, 400);
            pageViewEditSubItem(dateKey, origIndex, subIndex);
        }

        var pageViewSubDragState = null;
        function pageViewSubDragStart(e, el) {
            pageViewSubDragState = { el: el, index: parseInt(el.getAttribute('data-sub-index'), 10) };
            el.classList.add('pageViewSubDragging');
            try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'sub'); } catch (err) {}
        }
        function pageViewSubDragOver(e, el) {
            if (!pageViewSubDragState || pageViewSubDragState.el === el) return;
            e.preventDefault();
            el.classList.remove('pageViewSubDropBefore', 'pageViewSubDropAfter');
            el.classList.add(e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2 ? 'pageViewSubDropBefore' : 'pageViewSubDropAfter');
        }
        function pageViewSubDragLeave(el) { el.classList.remove('pageViewSubDropBefore', 'pageViewSubDropAfter'); }
        function pageViewSubDragEnd() {
            document.querySelectorAll('.pageViewSubItem').forEach(function(el) { el.classList.remove('pageViewSubDragging', 'pageViewSubDropBefore', 'pageViewSubDropAfter'); });
            pageViewSubDragState = null;
        }
        function pageViewSubDrop(e, el, dateKey, origIndex) {
            e.preventDefault();
            if (!pageViewSubDragState || pageViewSubDragState.el === el) { pageViewSubDragEnd(); return; }
            var targetIndex = parseInt(el.getAttribute('data-sub-index'), 10);
            var before = e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2;
            var item = reportData[dateKey] && reportData[dateKey][origIndex];
            if (!item) { pageViewSubDragEnd(); return; }
            var parsed = parseSubItemContent(item.content || '');
            var from = parsed.items[pageViewSubDragState.index];
            var to = parsed.items[targetIndex];
            if (!from || !to) { pageViewSubDragEnd(); return; }
             // 记录拖动前各分项的稳定ID，保证移动顺序后绑定关系不变。
             var idsBefore = Array.isArray(item.subItemIds) ? item.subItemIds.slice() : null;
             var moved = parsed.lines.splice(from.lineIdx, 1)[0];
             var insertAt = parsed.lines.indexOf(parsed.lines[to.lineIdx > from.lineIdx ? to.lineIdx - 1 : to.lineIdx]);
             if (before) insertAt = Math.max(0, insertAt); else insertAt = insertAt + 1;
             parsed.lines.splice(insertAt, 0, moved);
             item.content = parsed.lines.join('\n');
             var reparsed = parseSubItemContent(item.content);
             var prefixCount = 1;
             for (var i = 0; i < reparsed.items.length; i++) {
                 var line = reparsed.lines[reparsed.items[i].lineIdx];
                 reparsed.lines[reparsed.items[i].lineIdx] = line.replace(/^\s*\d+[\.。、]/, prefixCount + '.');
                 prefixCount++;
             }
             item.content = reparsed.lines.join('\n');
             if (idsBefore && idsBefore.length === reparsed.items.length) {
                 var fromI = pageViewSubDragState.index;
                 var toI = targetIndex;
                 var movedId = idsBefore.splice(fromI, 1)[0];
                 var insertItemAt = before ? toI : toI + 1;
                 if (fromI < insertItemAt) insertItemAt--;
                 if (insertItemAt < 0) insertItemAt = 0;
                 if (insertItemAt > idsBefore.length) insertItemAt = idsBefore.length;
                 idsBefore.splice(insertItemAt, 0, movedId);
                 item.subItemIds = idsBefore;
             }
             _saveReportToCache();
            pageViewSubDragEnd();
            renderTrackContent();
            updateFooterTimestamp();
        }

         function pageViewShowSubMenu(e, dateKey, origIndex, subIndex) {
             var old = document.querySelector('.pageViewSubMenu');
             if (old) old.remove();
             document.querySelectorAll('.pageViewSubStatusPicker, #rowContextMenu.show, #headerContextMenu.show, #subStatusItemMenu.show').forEach(function(other) {
                 if (other.id === 'rowContextMenu') hideRowContextMenu();
                 else if (other.id === 'headerContextMenu') hideHeaderContextMenu();
                 else if (other.id === 'subStatusItemMenu') hideSubStatusItemMenu();
                 else other.remove();
             });
             var menu = document.createElement('div');
            menu.className = 'pageViewSubMenu';
            var item = reportData[dateKey] && reportData[dateKey][origIndex];
            var isWeekWork = item && item.category && item.category.indexOf('周') !== -1 && item.category.indexOf('工作') !== -1;
             menu.innerHTML = '<div class="pageViewSubMenuItem" data-action="edit">编辑分项</div><div class="pageViewSubMenuItem" data-action="add-sub">新增分项</div><div class="pageViewSubMenuItem" data-action="delete-sub">删除分项</div>' + (isWeekWork ? '<div class="pageViewSubMenuItem" data-action="add-log">添加为日志</div>' : '');
             menu.style.left = '0px';
             menu.style.top = '0px';
              document.body.appendChild(menu);
             var margin = 6, mw = menu.offsetWidth, mh = menu.offsetHeight;
             var left = e.clientX, top = e.clientY;
             if (left + mw > window.innerWidth - margin) left = e.clientX - mw;
             if (top + mh > window.innerHeight - margin) top = e.clientY - mh;
             if (left < margin) left = margin;
             if (top < margin) top = margin;
             menu.style.left = left + 'px';
             menu.style.top = top + 'px';
             menu.addEventListener('mouseleave', function() { if (menu.parentNode) menu.remove(); });
            menu.addEventListener('click', function(ev) {
                var action = ev.target.getAttribute('data-action');
                menu.remove();
                 if (action === 'edit') pageViewEditSubItem(dateKey, origIndex, subIndex);
                 if (action === 'add-sub') pageViewAddSubItem(dateKey, origIndex, subIndex);
                 if (action === 'delete-sub') pageViewDeleteSubItem(dateKey, origIndex, subIndex);
                 if (action === 'add-log') pageViewAddSubItemToLog(dateKey, origIndex, subIndex);
            });
            setTimeout(function() { document.addEventListener('click', function closeMenu(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu); } }); }, 0);
         }

         function pageViewDeleteSubItem(dateKey, origIndex, subIndex) {
             var item = reportData[dateKey] && reportData[dateKey][origIndex];
             if (!item) return;
             var parsed = parseSubItemContent(item.content || '');
             var target = parsed.items && parsed.items[subIndex];
             if (!target) return;
             var name = normalizePageViewSubItemName(target.text);
             if (!confirm('确定删除分项“' + name + '”吗？')) return;
             parsed.lines.splice(target.lineIdx, 1);
             item.content = parsed.lines.join('\n').replace(/^\n+|\n+$/g, '');
             var reparsed = parseSubItemContent(item.content);
             for (var i = 0; i < reparsed.items.length; i++) {
                 var line = reparsed.lines[reparsed.items[i].lineIdx] || '';
                 reparsed.lines[reparsed.items[i].lineIdx] = line.replace(/^(\s*)\d+([\.。、])/, '$1' + (i + 1) + '$2');
             }
             item.content = reparsed.lines.join('\n');
             if (Array.isArray(item.subTimestamps)) item.subTimestamps.splice(subIndex, 1);
             if (Array.isArray(item.subItemIds)) item.subItemIds.splice(subIndex, 1);
             _saveReportToCache();
             renderTrackContent();
             updateFooterTimestamp();
         }

         function showPageViewSubStatusMenu(e, el, subIndex, dateKey, origIndex) {
             var old = document.querySelector('.pageViewSubStatusPicker');
             if (old) old.remove();
             document.querySelectorAll('.pageViewSubMenu, #rowContextMenu.show, #headerContextMenu.show, #subStatusItemMenu.show').forEach(function(other) {
                 if (other.id === 'rowContextMenu') hideRowContextMenu();
                 else if (other.id === 'headerContextMenu') hideHeaderContextMenu();
                 else if (other.id === 'subStatusItemMenu') hideSubStatusItemMenu();
                 else other.remove();
             });
            var picker = document.createElement('div');
            picker.className = 'pageViewSubStatusPicker';
             var currentMark = (el.textContent || '').replace(/[\s\u3000\u00a0]/g, '').trim();
            var currentLabel = { '√': '√ 已办结', '■': '■ 加急办理', '□': '□ 正常办理', '×': '× 已取消', '…': '… 备忘' }[currentMark] || '无状态';
            picker.innerHTML = '<div class="pageViewSubStatusCurrent">' + currentLabel + '</div><div class="pageViewSubStatusOptions">' +
                '<div class="pageViewSubStatusOption" data-value="">无状态</div>' +
                '<div class="pageViewSubStatusOption" data-value="√">√ 已办结</div>' +
                '<div class="pageViewSubStatusOption" data-value="■">■ 加急办理</div>' +
                '<div class="pageViewSubStatusOption" data-value="□">□ 正常办理</div>' +
                '<div class="pageViewSubStatusOption" data-value="×">× 已取消</div>' +
                '<div class="pageViewSubStatusOption" data-value="…">… 备忘</div></div>';
             picker.style.visibility = 'hidden';
             document.body.appendChild(picker);
             // 先展开再量尺寸：折叠状态高度只有 34px，按折叠高度定位会让展开后的菜单溢出屏幕底部
             picker.classList.add('open');
             var _rect = el.getBoundingClientRect();
             var _placed = _npPlaceFloating(picker, _rect, { width: picker.offsetWidth || 120, height: picker.offsetHeight || 200 });
             picker.style.visibility = '';
             picker.addEventListener('mouseleave', function() { if (picker.parentNode) picker.remove(); });
            picker.addEventListener('click', function(ev) {
                var option = ev.target.closest('.pageViewSubStatusOption');
                if (!option) return;
                ev.stopPropagation();
                var newValue = option.getAttribute('data-value') || '';
                var item = reportData[dateKey] && reportData[dateKey][origIndex];
                if (!item) { picker.remove(); return; }
                var parsed = parseSubItemContent(item.content || '');
                var target = parsed.items && parsed.items[subIndex];
                if (target) {
                     var line = parsed.lines[target.lineIdx] || '';
                     line = line.replace(/[■□√…×]\s*$/, '').replace(/\s+$/, '');
                     if (newValue) line += newValue;
                     parsed.lines[target.lineIdx] = line;
                     item.content = parsed.lines.join('\n');
                     if (!Array.isArray(item.subTimestamps)) item.subTimestamps = [];
                     if (newValue === '√') {
                         var oldTs = item.subTimestamps[subIndex] || target.timestamp || '';
                         var oldParsedTs = _parseTimestampStr(oldTs);
                         item.subTimestamps[subIndex] = oldParsedTs && oldParsedTs.start ? _formatTimestampStr(oldParsedTs.start, new Date()) : _nowTimestampStr();
                     } else if (item.subTimestamps[subIndex] && currentMark === '√') {
                         item.subTimestamps[subIndex] = '';
                     }
                    var parsedAfter = parseSubItemContent(item.content || '');
                    var subRows = parsedAfter.items || [];
                     _finishParentItemFromSubItems(item, subRows);
                    _saveReportToCache();
                    renderTrackContent();
                    updateFooterTimestamp();
                }
                picker.remove();
            });
            e.preventDefault();
            e.stopPropagation();
        }

        function renderReportTable(container) {
            var allData = [];
            var addedIds = new Set();
            
            var targetDate = timeRangeType === 'day' ? timeRangeStart : null;
            var yhAll = null;
            for (var key in reportData) {
                var data = reportData[key];
                var yh = _yearFromKey(key);
            for (var j = 0; j < data.length; j++) {
                var item = data[j];
                if (!item || (!item.category && !item.content)) continue;
                var inRange = _showAllRecords || (targetDate
                    ? dateRangeContains(item.startTime, item.endTime, targetDate, yh)
                    : isItemInTimeRange(item.startTime, item.endTime, yh));
                    if (inRange) {
                        var itemKey = key + '_' + j;
                        if (!addedIds.has(itemKey)) {
                            item._dateKey = key;
                            item._origIndex = j;
                            item._staged = false;
                            allData.push(item);
                            addedIds.add(itemKey);
                        }
                    }
                }
            }
            
            if (!_showAllRecords && !currentSortCol) {
                S.currentSortCol = 'status';
                S.currentSortDir = 'asc';
            }
            
            if (currentSortCol) {
                allData.sort(function(a, b) {
                    if (timeRangeType === 'week') {
                        var wkA = isWeekWorkItem(a) ? 0 : 1;
                        var wkB = isWeekWorkItem(b) ? 0 : 1;
                        if (wkA !== wkB) return wkA - wkB;
                    }
                    var va = '', vb = '';
                    if (currentSortCol === 'category') { va = a.category || ''; vb = b.category || ''; }
                    else if (currentSortCol === 'startTime') {
                        var da = parseTimeStrToDate(a.startTime, _yearFromKey(a._dateKey));
                        var db = parseTimeStrToDate(b.startTime, _yearFromKey(b._dateKey));
                        var ta = da ? da.getTime() : 0;
                        var tb = db ? db.getTime() : 0;
                        return currentSortDir === 'asc' ? ta - tb : tb - ta;
                    }
                    else if (currentSortCol === 'status') { 
                        va = statusOrder[a.status] !== undefined ? statusOrder[a.status] : 1; 
                        vb = statusOrder[b.status] !== undefined ? statusOrder[b.status] : 1; 
                        return currentSortDir === 'asc' ? va - vb : vb - va; 
                    }
                    var cmp = va.localeCompare(vb, 'zh-CN');
                    return currentSortDir === 'asc' ? cmp : -cmp;
                });
            }
            
            if (!_showAllRecords) {
                var stagedList = [];
                for (var sk in _stagedLogKeys) {
                    var parts = sk.split('::');
                    var sDateKey = parts[0];
                    var sOrigIndex = parseInt(parts[1]);
                    var sItem = reportData[sDateKey] && reportData[sDateKey][sOrigIndex];
                    if (!sItem) { delete _stagedLogKeys[sk]; continue; }
                    // 暂存区同样不显示内容为空的普通日志
                    if (_logRecordEmpty(sItem)) { delete _stagedLogKeys[sk]; continue; }
                    var sItemKey = sDateKey + '_' + sOrigIndex;
                    if (addedIds.has(sItemKey)) continue;
                    if (_isItemInCurrentRange(sItem, sDateKey)) continue;
                    sItem._dateKey = sDateKey;
                    sItem._origIndex = sOrigIndex;
                    sItem._staged = true;
                    stagedList.push(sItem);
                    addedIds.add(sItemKey);
                }
                if (stagedList.length > 0) {
                    allData = allData.concat(stagedList);
                }
            }
            
            var filteredData = allData;
            if (searchKeyword) {
                filteredData = allData.filter(function(row) {
                    if (row._staged) return true;
                    return rowMatchesSearch(row);
                });
            }
            
            var html = '<div class="reportTableWrapper" oncontextmenu="showReportBlankContextMenu(event)">';
            html += '<table class="reportTable"><thead><tr>';
            var headers = ['序号', '时间', '事项', '内容', '状态', '附件'];
            for (var i = 0; i < headers.length; i++) {
                html += '<th style="width:' + colWidths[i] + 'px" oncontextmenu="showHeaderContextMenu(event)">';
                if (workLogExportMode && i === 0) {
                    html += '<div class="thSortWrap"><input type="checkbox" id="workLogExportSelectAll" onclick="onWorkLogToggleAll(this.checked)"><span style="margin-left:6px;">' + headers[i] + '</span></div>';
                } else if (i === 2) {
                    var col = 'category';
                    var ascActive = currentSortCol === col && currentSortDir === 'asc' ? ' active' : '';
                    var descActive = currentSortCol === col && currentSortDir === 'desc' ? ' active' : '';
                    html += '<div class="thSortWrap"><span class="thSortBtn' + ascActive + '" onclick="sortData(\'' + col + '\',\'asc\')">▲</span>' + headers[i] + '<span class="thSortBtn' + descActive + '" onclick="sortData(\'' + col + '\',\'desc\')">▼</span></div>';
                } else if (i === 1) {
                    var col = 'startTime';
                    var ascActive = currentSortCol === col && currentSortDir === 'asc' ? ' active' : '';
                    var descActive = currentSortCol === col && currentSortDir === 'desc' ? ' active' : '';
                    html += '<div class="thSortWrap"><span class="thSortBtn' + ascActive + '" onclick="sortData(\'' + col + '\',\'asc\')">▲</span>' + headers[i] + '<span class="thSortBtn' + descActive + '" onclick="sortData(\'' + col + '\',\'desc\')">▼</span></div>';
                } else if (i === 3) {
                    html += '<div class="thHeaderRow"><span class="thHeaderText">' + headers[i] + '</span><span class="thHeaderBtns"><button class="thHeaderBtn" onclick="onWorkLogImportClick(); event.stopPropagation();">导入</button><button class="thHeaderBtn" onclick="onWorkLogExportToggle(); event.stopPropagation();">' + (workLogExportMode ? '取消' : '导出') + '</button></span></div>';
                } else if (i === 4) {
                    var col = 'status';
                    var ascActive = currentSortCol === col && currentSortDir === 'asc' ? ' active' : '';
                    var descActive = currentSortCol === col && currentSortDir === 'desc' ? ' active' : '';
                    html += '<div class="thSortWrap"><span class="thSortBtn' + ascActive + '" onclick="sortData(\'' + col + '\',\'asc\')">▲</span>' + headers[i] + '<span class="thSortBtn' + descActive + '" onclick="sortData(\'' + col + '\',\'desc\')">▼</span></div>';
                } else {
                    html += headers[i];
                }
                html += '<div class="resizeHandle" data-col="' + i + '"></div></th>';
            }
            html += '</tr></thead><tbody id="reportBody">';
            
            for (var i = 0; i < filteredData.length; i++) {
                var row = filteredData[i];
                var rowDateKey = row._dateKey;
                var rowOrigIndex = row._origIndex;
                var statusClass = 'status-' + (row.status || 'normal');
                if (row._staged) statusClass += ' staged-row';
                var isZhouGongZuo = row.category && row.category.indexOf('周') !== -1 && row.category.indexOf('工作') !== -1;
                if (isZhouGongZuo) statusClass += ' zhouGongZuoRow';
                var rowStyle = rowDateColor ? ' style="color:' + rowDateColor + ';"' : '';
                html += '<tr draggable="true" data-row="' + i + '" data-datekey="' + rowDateKey + '" data-origindex="' + rowOrigIndex + '" class="' + statusClass + '"' + rowStyle + ' oncontextmenu="showRowContextMenu(event, ' + i + ')">';
                if (workLogExportMode) {
                    html += '<td class="rowNum"><div style="display:flex;align-items:center;justify-content:center;gap:4px;"><input type="checkbox" class="workLogExportCheck" data-row="' + i + '" onclick="event.stopPropagation();"><span>' + (i + 1) + '</span></div></td>';
                } else {
                    html += '<td class="rowNum">' + (i + 1) + '</td>';
                }
                
                var startTime = row.startTime || '';
                var endTime = row.endTime || '';
                var rowDateColor = '';
                if (row.status === 'urgent' || row.status === 'normal') {
                    var sd = parseTimeStrToDate(startTime, _yearFromKey(row._dateKey));
                    if (sd) {
                        var today = new Date();
                        today.setHours(0,0,0,0);
                        if (timeRangeType === 'day') {
                            if (+sd === +today) rowDateColor = '#3F51B5';
                            else if (sd < today) rowDateColor = '#000000';
                            else rowDateColor = '#8E44AD';
                        } else if (timeRangeType === 'week') {
                            var dayOfWeek = today.getDay();
                            var monday = new Date(today);
                            monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                            var sunday = new Date(monday);
                            sunday.setDate(monday.getDate() + 6);
                            if (sd >= monday && sd <= sunday) rowDateColor = '#3F51B5';
                            else if (sd > today) rowDateColor = '#8E44AD';
                            else rowDateColor = '#1a5276';
                        } else {
                            if (sd > today) rowDateColor = '#8E44AD';
                            else rowDateColor = '#1a5276';
                        }
                    }
                }
                var displayTime = formatLogTimeDisplay(startTime, endTime);
                html += '<td class="timeCell" style="text-align:center;white-space:pre-line;" ondblclick="openEditModalByData(' + i + ')">' + highlightText(displayTime, searchKeyword);
                if (startTime && endTime && startTime !== endTime) {
                    if (endTime === '——') {
                        html += '<span class="timeFull">' + startTime + '—' + endTime + '</span>';
                    } else {
                        var endMatch = endTime.match(/(\d+月\d+日)/);
                        if (endMatch) {
                            html += '<span class="timeFull">' + startTime + '—' + endTime + '</span>';
                        }
                    }
                }
                html += '</td>';
                
                html += '<td ondblclick="openEditModalByData(' + i + ')" style="cursor:pointer;">' + highlightText(row.category || '', searchKeyword) + '</td>';
                
                var contentText = row.content || '';
                var remarkText = row.remark || '';
                var needExpandContent = contentText.length > 80 || contentText.split('\n').length > 4;
                
                html += '<td class="expandCell" ondblclick="openEditModalByData(' + i + ')" style="cursor:pointer;" title="' + (remarkText ? escapeHtml(remarkText) : '') + '">';
                html += '<div class="cellContent" id="content_' + i + '">' + highlightText(contentText, searchKeyword).replace(/\n/g, '<br>') + '</div>';
                if (needExpandContent) html += '<span class="expandBtn" onclick="event.stopPropagation(); toggleExpand(\'content_' + i + '\')">…</span>';
                html += '</td>';
                
                html += '<td class="statusCell"><span class="statusSymbol" onclick="event.stopPropagation(); toggleStatusDropdown(' + i + ')">' + getStatusSymbol(row.status) + '</span>';
                html += '<div class="statusDropdown" id="statusDropdown_' + i + '">';
                html += '<div class="statusDropdownItem" onclick="event.stopPropagation(); changeStatus(' + i + ', \'urgent\')">■ 加急办理</div>';
                html += '<div class="statusDropdownItem" onclick="event.stopPropagation(); changeStatus(' + i + ', \'normal\')">□ 正常办理</div>';
                html += '<div class="statusDropdownItem" onclick="event.stopPropagation(); changeStatus(' + i + ', \'done\')">√ 已办结</div>';
                html += '<div class="statusDropdownItem" onclick="event.stopPropagation(); changeStatus(' + i + ', \'memo\')">… 备忘</div>';
                html += '<div class="statusDropdownItem" onclick="event.stopPropagation(); changeStatus(' + i + ', \'cancel\')">× 已取消</div>';
                html += '</div></td>';
                
                var attachmentStr = '';
                if (row.attachments && row.attachments.length > 0) attachmentStr = row.attachments.length + '个';
                html += '<td class="attachCell" onclick="event.stopPropagation(); showAttachDetail(' + i + ')">' + attachmentStr + '</td>';
                html += '</tr>';
            }
            html += '</tbody></table>';
            if (workLogExportMode) {
                html += '<div class="reportTableExportBar"><button class="tableToolbarBtn" onclick="confirmWorkLogExport()">导出数据</button><button class="tableToolbarBtn export-doc" onclick="confirmWorkLogExportDoc()">导出文档</button><button class="tableToolbarBtn delete" onclick="cancelWorkLogExport()">取消</button></div>';
            }
            html += '</div>';
            container.innerHTML = html;
            initColumnResize();
            initRowDrag();
        }
        function toggleStatusDropdown(index) {
            var dropdown = document.getElementById('statusDropdown_' + index);
            var allDropdowns = document.querySelectorAll('.statusDropdown');
            for (var i = 0; i < allDropdowns.length; i++) { if (allDropdowns[i] !== dropdown) allDropdowns[i].classList.remove('show'); }
            dropdown.classList.toggle('show');
        }
        
        function changeStatus(index, status) {
            var row = document.querySelector('tr[data-row="' + index + '"]');
            if (!row) return;
            var dateKey = row.dataset.datekey;
            var origIndex = parseInt(row.dataset.origindex);
            if (reportData[dateKey] && reportData[dateKey][origIndex]) {
                reportData[dateKey][origIndex].status = status;
                if ((status === 'done' || status === 'memo' || status === 'cancel') && (reportData[dateKey][origIndex].endAuto === true || reportData[dateKey][origIndex].endTime === '——')) {
                    reportData[dateKey][origIndex].endTime = _formatTodayModalDateStr();
                    reportData[dateKey][origIndex].endAuto = false;
                    reportData[dateKey][origIndex].time = (reportData[dateKey][origIndex].startTime || '') + '—' + reportData[dateKey][origIndex].endTime;
                    renderTrackContent();
                }
            }
            var symbol = row.querySelector('.statusSymbol');
            if (symbol) symbol.textContent = getStatusSymbol(status);
            row.className = row.className.replace(/status-\S+/g, '').trim() + ' status-' + status;
            var dropdown = document.getElementById('statusDropdown_' + index);
            if (dropdown) dropdown.classList.remove('show');
        }
        function getStatusSymbol(status) { return { 'urgent': '■', 'normal': '□', 'done': '√', 'memo': '…', 'cancel': '×' }[status] || '□'; }
        
        function initColumnResize() { var handles = document.querySelectorAll('.resizeHandle'); for (var i = 0; i < handles.length; i++) { handles[i].addEventListener('mousedown', function(e) { S.resizingCol = parseInt(this.dataset.col); S.startX = e.clientX; S.startWidth = colWidths[resizingCol]; e.preventDefault(); }); } document.addEventListener('mousemove', function(e) { if (resizingCol === null) return; var diff = e.clientX - startX; var newWidth = Math.max(30, startWidth + diff); colWidths[resizingCol] = newWidth; var th = document.querySelectorAll('.reportTable th')[resizingCol]; if (th) th.style.width = newWidth + 'px'; }); document.addEventListener('mouseup', function() { S.resizingCol = null; }); }
        
        function initRowDrag() { 
            var tbody = document.getElementById('reportBody'); 
            if (!tbody) return; 
            var rows = tbody.querySelectorAll('tr'); 
            var dragRow = null; 
            for (var i = 0; i < rows.length; i++) { 
                rows[i].addEventListener('dragstart', function(e) { dragRow = this; this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }); 
                rows[i].addEventListener('dragend', function(e) { this.classList.remove('dragging'); var allRows = tbody.querySelectorAll('tr'); for (var j = 0; j < allRows.length; j++) allRows[j].classList.remove('drag-over'); }); 
                rows[i].addEventListener('dragover', function(e) { e.preventDefault(); if (this !== dragRow) this.classList.add('drag-over'); }); 
                rows[i].addEventListener('dragleave', function(e) { this.classList.remove('drag-over'); }); 
                rows[i].addEventListener('drop', (function(row) { return function(e) { 
                    e.preventDefault(); 
                    row.classList.remove('drag-over'); 
                    if (dragRow && dragRow !== row) { 
                        var fromDateKey = dragRow.dataset.datekey;
                        var fromOrigIndex = parseInt(dragRow.dataset.origindex);
                        var toDateKey = row.dataset.datekey;
                        var toOrigIndex = parseInt(row.dataset.origindex);
                        
                        var fromItem = reportData[fromDateKey].splice(fromOrigIndex, 1)[0];
                        reportData[toDateKey].splice(toOrigIndex, 0, fromItem);
                        
                        renderTrackContent();
                    } 
                }; })(rows[i])); 
            } 
        }
        
        function addReportRow() {
            var key = getDateKeyFor(timeRangeStart.getFullYear(), timeRangeStart.getMonth(), timeRangeStart.getDate());
            if (!reportData[key]) reportData[key] = [];
            var defaultDate = (timeRangeStart.getMonth() + 1) + '月' + timeRangeStart.getDate() + '日（周' + weekDays[timeRangeStart.getDay()] + '）';
            reportData[key].push({ category: '', startTime: defaultDate, endTime: defaultDate, time: defaultDate, content: '', remark: '', status: 'normal', attachments: [], _pendingInsert: true });
            var newIndex = reportData[key].length - 1;
            S.editingRowIndex = newIndex;
            S.editingDateKey = key;
            editingPendingInsert = true;
            editingInsertAfterIndex = -1;
            openEditModalByKey(key, newIndex);
            renderTrackContent();
        }

        // 工具栏"+"按钮：在当前视图日期新增一条
        function toolbarAddEntry() {
            // 确保处于工作日志模式
            if (!S.currentTrackMode) {
                switchTrackMode('report');
            }
            // 如果当前是天视图，用 timeRangeStart；否则用今天（如果在范围内）
            var target;
            if (S.timeRangeType === 'day') {
                target = S.timeRangeStart;
            } else {
                var now = new Date();
                var nowNum = now.getFullYear() * 10000 + now.getMonth() * 100 + now.getDate();
                var startNum = S.timeRangeStart.getFullYear() * 10000 + S.timeRangeStart.getMonth() * 100 + S.timeRangeStart.getDate();
                var endNum = S.timeRangeEnd.getFullYear() * 10000 + S.timeRangeEnd.getMonth() * 100 + S.timeRangeEnd.getDate();
                if (nowNum >= startNum && nowNum <= endNum) {
                    target = now;
                } else {
                    target = S.timeRangeStart;
                }
            }
            var key = getDateKeyFor(target.getFullYear(), target.getMonth(), target.getDate());
            if (!reportData[key]) reportData[key] = [];
            var defaultDate = (target.getMonth() + 1) + '月' + target.getDate() + '日（周' + weekDays[target.getDay()] + '）';
            reportData[key].push({ category: '', startTime: defaultDate, endTime: defaultDate, time: defaultDate, content: '', remark: '', status: 'normal', attachments: [], _pendingInsert: true });
            var newIndex = reportData[key].length - 1;
            S.editingRowIndex = newIndex;
            S.editingDateKey = key;
            editingPendingInsert = true;
            editingInsertAfterIndex = -1;
            openEditModalByKey(key, newIndex);
            renderTrackContent();
        }

        // 从日历格子"+"直接添加指定日期的条目
        function addEntryForDate(year, month, day) {
            // 确保处于工作日志模式
            if (!S.currentTrackMode || S.currentTrackMode === 'contacts') {
                switchTrackMode('report');
            }
            // 先切换到该日期的天视图
            selectDayView(year, month, day);
            // 然后打开新增编辑框
            var key = getDateKeyFor(year, month, day);
            if (!reportData[key]) reportData[key] = [];
            var defaultDate = (month + 1) + '月' + day + '日（周' + weekDays[new Date(year, month, day).getDay()] + '）';
            reportData[key].push({ category: '', startTime: defaultDate, endTime: defaultDate, time: defaultDate, content: '', remark: '', status: 'normal', attachments: [], _pendingInsert: true });
            var newIndex = reportData[key].length - 1;
            S.editingRowIndex = newIndex;
            S.editingDateKey = key;
            editingPendingInsert = true;
            editingInsertAfterIndex = -1;
            openEditModalByKey(key, newIndex);
            renderTrackContent();
        }

        function openEditModalByData(index) {
            var row = document.querySelector('tr[data-row="' + index + '"]');
            if (!row) return;
            var dateKey = row.dataset.datekey;
            var origIndex = parseInt(row.dataset.origindex);
            openEditModalByKey(dateKey, origIndex);
        }
        
        function openEditModalByKey(dateKey, index) {
            var data = reportData[dateKey];
            if (!data || !data[index]) return;
            
            S.editingRowIndex = index;
            S.editingDateKey = dateKey;
            var row = data[index];
            
            document.getElementById('editCategory').value = row.category || '';
            document.getElementById('editStartTime').value = row.startTime || '';
            var isAuto = (row.endTime === '——' || row.endAuto === true);
            var endAutoChk = document.getElementById('editEndAuto');
            if (endAutoChk) {
                endAutoChk.checked = isAuto;
            }
            toggleEndTimeAuto(isAuto);
            if (!isAuto) {
                document.getElementById('editEndTime').value = row.endTime || '';
            }
            document.getElementById('editContent').value = row.content || '';
            document.getElementById('editRemark').value = row.remark || '';
            document.getElementById('editStatus').value = row.status || 'normal';
            
            S.currentAttachments = row.attachments ? row.attachments.slice() : [];
            renderAttachmentList();
            _resetAttachInputs();
            _setupEditWeekLink(row.weekWorkSubId || '');
            
            initCategoryInput();
            applyEditModalFontSize(editModalFontSize);
            _updateEditWeekNav();
            closeWeekPopups();
            document.getElementById('editModal').classList.add('show');
        }
        
        function closeEditModal() {
            closeWeekPopups();
            // 关闭弹窗时无条件清掉所有“待插入”占位，避免取消后残留空记录
            if (editingDateKey && reportData[editingDateKey]) {
                var arr = reportData[editingDateKey];
                for (var i = arr.length - 1; i >= 0; i--) {
                    if (arr[i] && arr[i]._pendingInsert) arr.splice(i, 1);
                }
                if (arr.length === 0) delete reportData[editingDateKey];
            }
            document.getElementById('editModal').classList.remove('show');
            S.editingRowIndex = null;
            S.editingDateKey = null;
            editingPendingInsert = false;
            editingInsertAfterIndex = -1;
        }
        
        function initCategoryInput() {
            var input = document.getElementById('editCategory');
            var dropdown = document.getElementById('categoryDropdown');
            if (!input || !dropdown) return;
            
            input.removeEventListener('focus', showCategoryDropdown);
            input.removeEventListener('input', filterCategoryDropdown);
            input.removeEventListener('blur', hideCategoryDropdownDelay);
            input.removeEventListener('input', _updateRemarkFieldLabel);
            
            input.addEventListener('focus', showCategoryDropdown);
            input.addEventListener('input', filterCategoryDropdown);
            input.addEventListener('blur', hideCategoryDropdownDelay);
            input.addEventListener('input', _updateRemarkFieldLabel);
            _updateRemarkFieldLabel();
        }
        
        function showCategoryDropdown() {
            var dropdown = document.getElementById('categoryDropdown');
            var input = document.getElementById('editCategory');
            if (!dropdown || !input) return;
            
            dropdown.innerHTML = '';
            var val = input.value.toLowerCase();
            for (var i = 0; i < categoryList.length; i++) {
                if (val === '' || categoryList[i].toLowerCase().indexOf(val) !== -1) {
                    var opt = document.createElement('div');
                    opt.className = 'categoryDropdownItem';
                    opt.textContent = categoryList[i];
                    (function(cat) {
                        opt.addEventListener('mousedown', function(e) {
                            e.preventDefault();
                            input.value = cat;
                            dropdown.classList.remove('show');
                        });
                    })(categoryList[i]);
                    dropdown.appendChild(opt);
                }
            }
            if (dropdown.childNodes.length > 0) {
                dropdown.classList.add('show');
            } else {
                dropdown.classList.remove('show');
            }
        }
        
        function filterCategoryDropdown() {
            showCategoryDropdown();
        }
        
        function hideCategoryDropdownDelay() {
            setTimeout(function() {
                var dropdown = document.getElementById('categoryDropdown');
                if (dropdown) dropdown.classList.remove('show');
            }, 200);
        }
        
        // 判断一条日志是否“只有事项、没有正文”：正文、附件都为空，备注仅为自动填充的“周工作：”标签
        function _logBodyEmpty(item) {
            if (!item) return true;
            var content = String(item.content || '').replace(/[\s\u3000\u00a0\u200b]+/g, '');
            if (content) return false;
            if (item.attachments && item.attachments.length) return false;
            var remark = String(item.remark || '').replace(/[\s\u3000\u00a0\u200b]+/g, '');
            if (remark && !/^[\s]*周工作[：:]/.test(remark)) return false;
            return true;
        }
        // 该记录是否应被视为“可保存/可显示”的有效日志（周工作与正在编辑的占位不参与空值清理）
        function _logRecordEmpty(item) {
            if (!item) return true;
            if (item._pendingInsert) return false;
            if (isWeekWorkItem(item)) return false;
            return _logBodyEmpty(item);
        }
        // 清掉 content 为空的普通日志，返回删除条数
        function _purgeEmptyLogRecords() {
            var removed = 0;
            for (var k in reportData) {
                if (!reportData.hasOwnProperty(k)) continue;
                var arr = reportData[k];
                if (!Array.isArray(arr)) continue;
                for (var i = arr.length - 1; i >= 0; i--) {
                    if (!_logRecordEmpty(arr[i])) continue;
                    var key = _stagedKey(k, i);
                    if (_stagedLogKeys[key]) delete _stagedLogKeys[key];
                    arr.splice(i, 1);
                    removed++;
                }
                if (arr.length === 0) delete reportData[k];
            }
            return removed;
        }
        window._logBodyEmpty = _logBodyEmpty;
        window._logRecordEmpty = _logRecordEmpty;
        window._purgeEmptyLogRecords = _purgeEmptyLogRecords;

        function saveEditModal() {
            if (editingRowIndex === null || editingDateKey === null) { console.warn('[saveEditModal] aborted: editingRowIndex=' + editingRowIndex + ', editingDateKey=' + editingDateKey); showToast('编辑状态异常，请关闭弹窗后重新操作'); closeEditModal(); return; }
            if (!reportData[editingDateKey]) { console.warn('[saveEditModal] aborted: reportData[' + editingDateKey + '] not found'); showToast('该日期的数据不存在，请重新操作'); closeEditModal(); return; }
            
            var startTime = document.getElementById('editStartTime').value;
            var endAutoChk = document.getElementById('editEndAuto');
            var isEndAuto = endAutoChk ? endAutoChk.checked : false;
            var statusVal = document.getElementById('editStatus').value;
            var yh = _yearFromKey(editingDateKey);
            var resolveAuto = isEndAuto && (statusVal === 'done' || statusVal === 'memo' || statusVal === 'cancel');
            var endTime;
            if (isEndAuto && !resolveAuto) {
                endTime = '——';
            } else {
                if (resolveAuto) {
                    endTime = _formatTodayModalDateStr();
                } else {
                    endTime = document.getElementById('editEndTime').value;
                }
            }
            if (!isEndAuto || resolveAuto) {
                var sDate = _parseModalDateStr(startTime, yh);
                var eDate = _parseModalDateStr(endTime, yh);
                if (sDate && eDate && eDate.getTime() < sDate.getTime()) {
                    showToast('结束时间不能早于开始时间');
                    return;
                }
            }
            var category = document.getElementById('editCategory').value;
            var content = document.getElementById('editContent').value;
            var remarkVal = document.getElementById('editRemark').value;

            // 内容为空的记录一律禁止保存：先清掉本次占位，再提示
            var contentEmpty = !String(content || '').replace(/[\s\u3000\u00a0\u200b]+/g, '');
            var hasAttach = currentAttachments && currentAttachments.length > 0;
            var remarkMeaningful = !!String(remarkVal || '').replace(/[\s\u3000\u00a0\u200b]+/g, '') && !/^\s*周工作[：:]/.test(String(remarkVal || ''));
            if (contentEmpty && !hasAttach && !remarkMeaningful) {
                if (editingPendingInsert) {
                    for (var di = reportData[editingDateKey].length - 1; di >= 0; di--) {
                        if (reportData[editingDateKey][di]._pendingInsert) reportData[editingDateKey].splice(di, 1);
                    }
                }
                editingPendingInsert = false;
                editingInsertAfterIndex = -1;
                closeEditModal();
                _purgeEmptyLogRecords();
                S._showAllRecords = false;
                if (!_deferLogRefresh) renderTrackContent();
                else if (currentTrackMode === 'page') { S._deferLogRefresh = false; renderTrackContent(); }
                updateFooterTimestamp();
                try { alert('日志内容不能为空，请填写内容后再保存。'); } catch (e) { }
                return;
            }

            if (!category && !content) {
                if (editingPendingInsert) {
                    for (var di = reportData[editingDateKey].length - 1; di >= 0; di--) {
                        if (reportData[editingDateKey][di]._pendingInsert) reportData[editingDateKey].splice(di, 1);
                    }
                } else {
                    if (reportData[editingDateKey] && reportData[editingDateKey][editingRowIndex]) {
                        var delStagedKey = _stagedKey(editingDateKey, editingRowIndex);
                        if (_stagedLogKeys[delStagedKey]) delete _stagedLogKeys[delStagedKey];
                        reportData[editingDateKey].splice(editingRowIndex, 1);
                    }
                }
                editingPendingInsert = false;
                editingInsertAfterIndex = -1;
             closeEditModal();
             S._showAllRecords = false;
                updateCategoryList();
             if (!_deferLogRefresh) renderTrackContent();
             else if (currentTrackMode === 'page') { S._deferLogRefresh = false; renderTrackContent(); }
                showToast('事项和内容均为空，该记录已删除');
                return;
            }
            
            if (category && categoryList.indexOf(category) === -1) {
                categoryList.push(category);
                categoryList.sort(function(a, b) { return a.localeCompare(b, 'zh-CN'); });
            }
            
            var savedItem = {
                category: category,
                startTime: startTime,
                endTime: endTime,
                endAuto: (isEndAuto && !resolveAuto) ? true : false,
                time: startTime + '—' + endTime,
                content: _applyEntryStatusToSubItems(document.getElementById('editContent').value, statusVal, !!editingPendingInsert),
                remark: document.getElementById('editRemark').value,
                status: statusVal,
                attachments: currentAttachments
            };
            var weekLinkSel = document.getElementById('editWeekLinkSelect');
            if (weekLinkSel && weekLinkSel.value) savedItem.weekWorkSubId = weekLinkSel.value;
            
            if (editingPendingInsert) {
                var filteredData = getFilteredData();
                if (editingInsertAfterIndex === -1) {
                    var _filled = false;
                    for (var pi = 0; pi < reportData[editingDateKey].length; pi++) {
                        if (reportData[editingDateKey][pi]._pendingInsert) {
                            for (var pk in savedItem) {
                                reportData[editingDateKey][pi][pk] = savedItem[pk];
                            }
                            delete reportData[editingDateKey][pi]._pendingInsert;
                            savedItem = reportData[editingDateKey][pi];
                            S.editingRowIndex = pi;
                            _filled = true;
                            break;
                        }
                    }
                    // 兜底：占位已不存在（被意外清理）时直接追加，保证这次保存不丢
                    if (!_filled) {
                        reportData[editingDateKey].push(savedItem);
                        S.editingRowIndex = reportData[editingDateKey].length - 1;
                    }
                } else {
                    var insertPos = 0;
                    if (filteredData[editingInsertAfterIndex]) {
                        var afterItem = filteredData[editingInsertAfterIndex];
                        var afterDateKey = afterItem._dateKey;
                        var afterOrigIndex = afterItem._origIndex;
                        if (reportData[afterDateKey]) {
                            insertPos = afterOrigIndex + 1;
                            if (afterDateKey === editingDateKey) {
                                reportData[editingDateKey].splice(insertPos, 0, savedItem);
                                S.editingRowIndex = insertPos;
                            } else {
                                if (!reportData[editingDateKey]) reportData[editingDateKey] = [];
                                reportData[editingDateKey].push(savedItem);
                                S.editingRowIndex = reportData[editingDateKey].length - 1;
                            }
                        } else {
                            if (!reportData[editingDateKey]) reportData[editingDateKey] = [];
                            reportData[editingDateKey].push(savedItem);
                            S.editingRowIndex = reportData[editingDateKey].length - 1;
                        }
                    } else {
                        reportData[editingDateKey].push(savedItem);
                        S.editingRowIndex = reportData[editingDateKey].length - 1;
                    }
                }
                editingPendingInsert = false;
                editingInsertAfterIndex = -1;
            } else {
                var oldStagedKey = _stagedKey(editingDateKey, editingRowIndex);
                if (_stagedLogKeys[oldStagedKey]) delete _stagedLogKeys[oldStagedKey];
                reportData[editingDateKey][editingRowIndex] = savedItem;
            }
            
            var _savedDateKey = editingDateKey;
            closeEditModal();
            S._showAllRecords = false;
            // 保存成功后顺手清理历史遗留的空内容记录，避免它们再次出现在列表里
            _purgeEmptyLogRecords();
            var _savedIndex = reportData[_savedDateKey] ? reportData[_savedDateKey].indexOf(savedItem) : -1;
            if (_savedIndex >= 0) _syncStagedForSavedItem(_savedDateKey, _savedIndex, savedItem);
            if (!_deferLogRefresh) renderTrackContent();
            else if (currentTrackMode === 'page') { S._deferLogRefresh = false; renderTrackContent(); }
            updateFooterTimestamp();
            showToast('保存成功');
        }
        
        function _syncStagedForSavedItem(dateKey, origIndex, item) {
            if (!dateKey || origIndex === null || origIndex === undefined || !item) return;
            var key = _stagedKey(dateKey, origIndex);
            var inRange = _isItemInCurrentRange(item, dateKey);
            if (inRange) {
                if (_stagedLogKeys[key]) delete _stagedLogKeys[key];
            } else {
                _stagedLogKeys[key] = true;
            }
        }
        
        function _updateEditWeekNav() {
            var catEl = document.getElementById('editCategory');
            var cat = catEl ? (catEl.value || '') : '';
            var isWeekWork = (cat.indexOf('周') !== -1 && cat.indexOf('工作') !== -1);
            var show = (timeRangeType === 'week') || isWeekWork;
            var weekBtn = document.getElementById('editWeekWorkBtn');
            if (weekBtn) weekBtn.style.display = show ? 'block' : 'none';
            if (!show) closeWeekPopups();
        }
        function _getWeekDateStr(date) {
            return (date.getMonth() + 1) + '月' + date.getDate() + '日';
        }
        function _findWeekWorkRecord(startDate, endDate) {
            for (var key in reportData) {
                var data = reportData[key];
                if (!Array.isArray(data)) continue;
                var yh = _yearFromKey(key);
                for (var j = 0; j < data.length; j++) {
                    var item = data[j];
                    if (!item || !item.category) continue;
                    if (item.category.indexOf('周') === -1 || item.category.indexOf('工作') === -1) continue;
                    var sd = parseTimeStrToDate(item.startTime, yh);
                    if (!sd) continue;
                    var d0 = new Date(sd); d0.setHours(0, 0, 0, 0);
                    var s0 = new Date(startDate); s0.setHours(0, 0, 0, 0);
                    var e0 = new Date(endDate); e0.setHours(0, 0, 0, 0);
                    if (d0 >= s0 && d0 <= e0) return { item: item, dateKey: key, origIndex: j };
                }
            }
            return null;
        }
        function _positionWeekPopup() {
             var box = document.querySelector('#editModal .editModalBox');
             if (!box) return;
             var popup = document.getElementById('editWeekPopup');
             if (!popup) return;
             var popW = popup.offsetWidth || Math.round(window.innerWidth * 0.30);
             var gap = 2;
             popup.style.display = 'flex';
             if (!box.dataset.editBaseWidth) box.dataset.editBaseWidth = box.getBoundingClientRect().width + 'px';
             box.style.width = box.dataset.editBaseWidth;
             box.style.maxWidth = box.dataset.editBaseWidth;
             box.style.transform = '';
             var rect = box.getBoundingClientRect();
             var combinedWidth = popW + gap + rect.width;
             var combinedLeft = Math.max(4, Math.round((window.innerWidth - combinedWidth) / 2));
             var boxLeft = combinedLeft + popW + gap;
             popup.style.top = rect.top + 'px';
             popup.style.height = rect.height + 'px';
             popup.style.left = combinedLeft + 'px';
             box.style.transform = 'translateX(' + (boxLeft - rect.left) + 'px)';
        }
        function _currentEditWeekBase() {
            var d = null;
            try {
                if (editingDateKey && editingRowIndex !== null && editingRowIndex !== undefined && reportData[editingDateKey] && reportData[editingDateKey][editingRowIndex]) {
                    var st = reportData[editingDateKey][editingRowIndex].startTime;
                    if (st && st !== '——') {
                        var yh = _yearFromKey(editingDateKey);
                        d = parseTimeStrToDate(st, yh);
                    }
                }
            } catch (e) {}
            if (!d) d = new Date(timeRangeStart);
            var day = d.getDay();
            var diff = day === 0 ? -6 : 1 - day;
            var mon = new Date(d);
            mon.setDate(d.getDate() + diff);
            var sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            return { start: mon, end: sun };
        }
        function showWeekWorkPopup(dir) {
            var base = _currentEditWeekBase();
            var offset = dir === 'prev' ? -7 : (dir === 'next' ? 7 : 0);
            var targetStart = new Date(base.start);
            targetStart.setDate(targetStart.getDate() + offset);
            var targetEnd = new Date(base.end);
            targetEnd.setDate(targetEnd.getDate() + offset);
            var found = _findWeekWorkRecord(targetStart, targetEnd);
            var body = document.getElementById('editWeekBody');
            var tabs = document.querySelectorAll('.editWeekTab');
            for (var ti = 0; ti < tabs.length; ti++) tabs[ti].classList.toggle('active', tabs[ti].getAttribute('data-week-tab') === dir);
            if (body) {
                body.style.fontSize = editModalFontSize + 'px';
                if (found) {
                    var item = found.item;
                     var weekTitle = dir === 'prev' ? '上一周工作' : (dir === 'next' ? '下一周工作' : '本周工作');
                     var titleEl = document.getElementById('editWeekPopupTitle');
                     if (titleEl) titleEl.textContent = weekTitle;
                     var h = '<div class="editWeekTime">时间：' + escapeHtml((item.startTime || '') + '—' + (item.endTime || '')) + '</div>';
                     h += '<div class="editWeekStatus">状态：' + getStatusText(item.status) + '</div>';
                     if (item.content) h += '<div class="editWeekContent">' + escapeHtml(item.content).replace(/\n/g, '<br>') + '</div>';
                     var _weekSum = _weeklySummaryText(item.remark);
                     if (_weekSum) h += '<div style="color:#3d4d63;margin-top:6px;">总结：' + escapeHtml(_weekSum).replace(/\n/g, '<br>') + '</div>';
                     body.innerHTML = h;
                 } else {
                     var emptyTitle = dir === 'prev' ? '上一周工作' : (dir === 'next' ? '下一周工作' : '本周工作');
                     var emptyTitleEl = document.getElementById('editWeekPopupTitle');
                     if (emptyTitleEl) emptyTitleEl.textContent = emptyTitle;
                     body.innerHTML = '<div style="color:#999;text-align:center;padding-top:30px;">未找到该周的周工作记录</div>';
                }
            }
            _positionWeekPopup();
        }
        function closeWeekPopup(dir) {
            closeWeekPopups();
        }
         function closeWeekPopups() {
             var popup = document.getElementById('editWeekPopup');
             var box = document.querySelector('#editModal .editModalBox');
             if (popup) popup.style.display = 'none';
             if (box) { box.style.transform = ''; box.style.width = ''; box.style.maxWidth = ''; delete box.dataset.editBaseWidth; }
         }
        function toggleWeekWorkPopup() {
            var popup = document.getElementById('editWeekPopup');
            if (!popup) return;
            if (popup.style.display === 'flex') closeWeekPopups();
            else showWeekWorkPopup('current');
        }
        window.addEventListener('resize', function() {
            var popup = document.getElementById('editWeekPopup');
            if (popup && popup.style.display === 'flex') _positionWeekPopup();
        });
        (function bindEditCatNavInput() {
            var input = document.getElementById('editCategory');
            if (!input) return;
            input.addEventListener('input', function() {
                if (document.getElementById('editModal').classList.contains('show')) {
                    _updateEditWeekNav();
                }
            });
        })();
        
        function toggleEndTimeAuto(checked) {
            var endInput = document.getElementById('editEndTime');
            var startInput = document.getElementById('editStartTime');
            if (!endInput) return;
            if (checked) {
                endInput.value = '——';
                endInput.style.color = '#999';
                endInput.onclick = null;
            } else {
                endInput.style.color = '';
                endInput.value = startInput ? startInput.value : '';
                endInput.setAttribute('onclick', "openDatePicker('end')");
            }
        }
        function _parseModalDateStr(dateStr, yearHint) {
            if (!dateStr || dateStr === '——') return null;
            var m = dateStr.match(/(\d+)月(\d+)日/);
            if (!m) return null;
            var yr = yearHint || (new Date()).getFullYear();
            return new Date(yr, parseInt(m[1]) - 1, parseInt(m[2]));
        }
        function _formatTodayModalDateStr() {
            var now = new Date();
            return (now.getMonth() + 1) + '月' + now.getDate() + '日（周' + weekDays[now.getDay()] + '）';
        }
        function handleEditStatusChange() {
            var status = document.getElementById('editStatus');
            var auto = document.getElementById('editEndAuto');
            var end = document.getElementById('editEndTime');
            if (!status || !auto || !end) return;
            if (status.value === 'done' && auto.checked) {
                auto.checked = false;
                end.style.color = '';
                end.setAttribute('onclick', "openDatePicker('end')");
                end.value = _formatTodayModalDateStr();
            }
        }
        function openDatePicker(target) { S.datePickerTarget = target; var inputId = target === 'start' ? 'editStartTime' : 'editEndTime'; var currentValue = document.getElementById(inputId).value; var match = currentValue.match(/(\d+)月(\d+)日/); if (match) { S.datePickerMonth = parseInt(match[1]) - 1; S.datePickerYear = selectedDate.getFullYear(); } else { S.datePickerYear = selectedDate.getFullYear(); S.datePickerMonth = selectedDate.getMonth(); } renderDatePicker(); document.getElementById('datePickerModal').classList.add('show'); }
        function openDatePickerForCustom(target) { S.customPickerTarget = target; S.customPickerMode = true; S.datePickerTarget = target; var currentValue = document.getElementById(target === 'start' ? 'customStartDate' : 'customEndDate').value; var match = currentValue.match(/(\d+)月(\d+)日/); if (match) { S.datePickerMonth = parseInt(match[1]) - 1; S.datePickerYear = timeRangeStart.getFullYear(); } else { S.datePickerYear = timeRangeStart.getFullYear(); S.datePickerMonth = timeRangeStart.getMonth(); } renderDatePicker(); document.getElementById('datePickerModal').classList.add('show'); }
        function closeDatePicker() { document.getElementById('datePickerModal').classList.remove('show'); S.datePickerTarget = null; S.customPickerTarget = null; S.customPickerMode = false; }
        function datePickerChangeMonth(delta) { S.datePickerMonth += delta; if (datePickerMonth < 0) { S.datePickerMonth = 11; S.datePickerYear--; } else if (datePickerMonth > 11) { S.datePickerMonth = 0; S.datePickerYear++; } renderDatePicker(); }
        
        function renderDatePicker() { var title = document.getElementById('datePickerTitle'); title.textContent = datePickerYear + '年' + (datePickerMonth + 1) + '月'; var daysContainer = document.getElementById('datePickerDays'); daysContainer.innerHTML = ''; var firstDay = new Date(datePickerYear, datePickerMonth, 1).getDay(); var daysInMonth = solarDays(datePickerYear, datePickerMonth); var daysInPrevMonth = datePickerMonth === 0 ? solarDays(datePickerYear - 1, 11) : solarDays(datePickerYear, datePickerMonth - 1); var today = new Date(); var todayStr = today.getFullYear() + '-' + today.getMonth() + '-' + today.getDate(); var dayCount = 1; var nextMonthDay = 1; var startOffset = firstDay === 0 ? 6 : firstDay - 1; for (var i = 0; i < 42; i++) { var cell = document.createElement('div'); cell.className = 'datePickerDay'; var year, month, day, isOtherMonth = false; if (i < startOffset) { day = daysInPrevMonth - startOffset + i + 1; year = datePickerMonth === 0 ? datePickerYear - 1 : datePickerYear; month = datePickerMonth === 0 ? 11 : datePickerMonth - 1; isOtherMonth = true; } else if (dayCount <= daysInMonth) { day = dayCount++; year = datePickerYear; month = datePickerMonth; } else { day = nextMonthDay++; year = datePickerMonth === 11 ? datePickerYear + 1 : datePickerYear; month = datePickerMonth === 11 ? 0 : datePickerMonth + 1; isOtherMonth = true; } var isToday = year + '-' + month + '-' + day === todayStr; var actualDayOfWeek = new Date(year, month, day).getDay(); var isWeekend = actualDayOfWeek === 0 || actualDayOfWeek === 6; if (isOtherMonth) cell.classList.add('otherMonth'); if (isToday) cell.classList.add('today'); if (isWeekend) cell.classList.add('weekend'); var lunar = solar2lunar(year, month, day); var dayNum = document.createElement('div'); dayNum.textContent = day; var lunarDay = document.createElement('div'); lunarDay.className = 'dpLunar'; if (lunar) lunarDay.textContent = lunar.dayStr; cell.appendChild(dayNum); cell.appendChild(lunarDay); (function(y, m, d) { cell.ondblclick = function() { selectDatePickerDate(y, m, d); }; })(year, month, day); daysContainer.appendChild(cell); } }
        
        function selectDatePickerDate(year, month, day) { var dateStr = (month + 1) + '月' + day + '日（周' + weekDays[new Date(year, month, day).getDay()] + '）'; if (customPickerMode) { if (customPickerTarget === 'start') { document.getElementById('customStartDate').value = dateStr; } else { document.getElementById('customEndDate').value = dateStr; } closeDatePicker(); return; } if (datePickerTarget === 'start') { document.getElementById('editStartTime').value = dateStr; var endAutoC = document.getElementById('editEndAuto'); if (!endAutoC || !endAutoC.checked) { document.getElementById('editEndTime').value = dateStr; } } else { var ea2 = document.getElementById('editEndAuto'); if (ea2 && ea2.checked) { ea2.checked = false; toggleEndTimeAuto(false); } document.getElementById('editEndTime').value = dateStr; } closeDatePicker(); }
        
        function getMonday(d) { var date = new Date(d); var day = date.getDay(); var diff = date.getDate() - day + (day === 0 ? -6 : 1); date.setDate(diff); return date; }
        function getSunday(d) { var mon = getMonday(d); var sun = new Date(mon); sun.setDate(mon.getDate() + 6); return sun; }
        function fmtDate(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日（周' + weekDays[d.getDay()] + '）'; }
        function parseCustomDateStr(s) {
            var m = s.match(/(\d+)月(\d+)日/);
            if (!m) return null;
            return { month: parseInt(m[1]), day: parseInt(m[2]) };
        }
        function updateCustomDateDayCount() {
            var el = document.getElementById('customDateDayCount');
            if (!el) return;
            var startVal = document.getElementById('customStartDate').value;
            var endVal = document.getElementById('customEndDate').value;
            var sm = parseCustomDateStr(startVal);
            var em = parseCustomDateStr(endVal);
            if (!sm || !em) { el.textContent = ''; return; }
            var baseYear = timeRangeStart ? timeRangeStart.getFullYear() : new Date().getFullYear();
            var ey = baseYear;
            if (em.month < sm.month || (em.month === sm.month && em.day < sm.day)) ey++;
            var startD = new Date(baseYear, sm.month - 1, sm.day);
            var endD = new Date(ey, em.month - 1, em.day);
            var diff = Math.round((endD - startD) / 86400000) + 1;
            if (diff < 1) diff = 1;
            el.textContent = baseYear + '年' + sm.month + '月' + sm.day + '日——' + em.month + '月' + em.day + '日（共' + diff + '天）';
        }
        function openCustomDateFromDisplay() {
            document.getElementById('customDateModal').classList.add('show');
            document.getElementById('customStartDate').value = fmtDate(timeRangeStart);
            document.getElementById('customEndDate').value = fmtDate(timeRangeEnd);
            updateCustomDateDayCount();
            S.customPickerTarget = 'start';
            S.datePickerYear = timeRangeStart.getFullYear();
            S.datePickerMonth = timeRangeStart.getMonth();
            document.getElementById('timeRangeSelect').value = 'custom';
        }
        function setCustomDatePreset(preset) {
            var today = new Date();
            var start, end;
            if (preset === 'todayTomorrow') {
                start = new Date(today);
                end = new Date(today); end.setDate(end.getDate() + 1);
            } else if (preset === 'near3Days') {
                start = new Date(today); start.setDate(start.getDate() - 1);
                end = new Date(today); end.setDate(end.getDate() + 1);
            } else if (preset === 'weekRemain') {
                start = new Date(today);
                end = getSunday(today);
            } else if (preset === 'lastWeek') {
                var thisMon = getMonday(today);
                start = new Date(thisMon); start.setDate(thisMon.getDate() - 7);
                end = getSunday(today);
            } else if (preset === 'thisNextWeek') {
                start = getMonday(today);
                var nextMon = new Date(start); nextMon.setDate(start.getDate() + 7);
                end = getSunday(nextMon);
            } else if (preset === 'threeWeeks') {
                start = getMonday(today); start.setDate(start.getDate() - 7);
                var nextSun = getSunday(today); nextSun.setDate(nextSun.getDate() + 14);
                end = nextSun;
            } else if (preset === 'lastMonth') {
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            } else if (preset === 'thisNextMonth') {
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
            }
            if (start && end) {
                document.getElementById('customStartDate').value = fmtDate(start);
                document.getElementById('customEndDate').value = fmtDate(end);
                updateCustomDateDayCount();
            }
        }
        function closeCustomDateModal() {
            document.getElementById('customDateModal').classList.remove('show');
            document.getElementById('timeRangeSelect').value = timeRangeType;
        }
        
        function confirmCustomDate() {
            var startText = document.getElementById('customStartDate').value;
            var endText = document.getElementById('customEndDate').value;
            if (!startText || !endText) { showToast('请选择起止日期'); return; }
            var startMatch = startText.match(/(\d+)月(\d+)日/);
            var endMatch = endText.match(/(\d+)月(\d+)日/);
            if (!startMatch || !endMatch) { showToast('日期格式错误'); return; }
            S.timeRangeType = 'custom';
            S.timeRangeStart = new Date(timeRangeStart.getFullYear(), parseInt(startMatch[1]) - 1, parseInt(startMatch[2]));
            S.timeRangeEnd = new Date(timeRangeEnd.getFullYear(), parseInt(endMatch[1]) - 1, parseInt(endMatch[2]));
            if (timeRangeEnd < timeRangeStart) { showToast('结束日期不能早于开始日期'); S.timeRangeType = 'day'; document.getElementById('timeRangeSelect').value = 'day'; return; }
            document.getElementById('timeRangeSelect').value = 'custom';
            document.getElementById('customDateModal').classList.remove('show');
            S._showAllRecords = false;
            _clearStagedLogKeys();
            updateTimeRangeDisplay();
            renderTrackContent();
        }
        
        function handleAttachAction() {
            _addAttachmentFromInputs();
        }

        // 读取附件输入框并加入当前附件列表（返回是否成功）
        function _addAttachmentFromInputs() {
            var nameInput = document.getElementById('attachNameInput');
            var pathInput = document.getElementById('attachPathInput');
            var rawName = (nameInput && nameInput.value.trim()) || '';
            var rawPath = (pathInput && pathInput.value.trim()) || '';
            if (!rawPath && !rawName) { showToast('请输入名称或路径'); return false; }
            _appendAttachment(rawPath, rawName);
            _resetAttachInputs();
            return true;
        }

        function _appendAttachment(rawPath, rawName) {
            var path = String(rawPath || '').replace(/^["']+|["']+$/g, '').trim();
            var name = String(rawName || '').replace(/^["']+|["']+$/g, '').trim();
            if (!name) {
                name = extractNameFromPath(path || rawName);
            }
            if (!path) path = name;
            var isFolder = isFolderPath(path || rawName);
            var attType = 'file';
            if (isFolder) {
                attType = 'folder';
            } else {
                var ext = getFileExtension(path || rawName);
                switch (ext) {
                    case 'csv': attType = 'csv'; break;
                    case 'doc': case 'docx': case 'wps': attType = 'docx'; break;
                    case 'xls': case 'xlsx': case 'xlsm': case 'xlt': case 'xltx': case 'xltm': attType = 'excel'; break;
                    case 'zip': case 'rar': case '7z': case 'tar': case 'gz': case 'bz2': attType = 'winrar'; break;
                    case 'txt': attType = 'txt'; break;
                    case 'jpg': case 'jpeg': case 'bmp': case 'png': case 'gif': case 'webp': case 'svg': attType = 'picture'; break;
                    case 'psd': attType = 'psd'; break;
                    case 'pdf': attType = 'pdf'; break;
                    case 'mp4': case 'avi': case 'mkv': case 'mov': case 'wmv': case 'flv': case 'webm': case 'mpg': case 'mpeg': attType = 'movie'; break;
                    case 'mp3': case 'wav': case 'flac': case 'aac': case 'ogg': case 'wma': case 'm4a': attType = 'music'; break;
                    case 'js': case 'json': attType = 'json'; break;
                    case 'html': case 'htm': attType = 'html'; break;
                    default: attType = 'file'; break;
                }
            }
            var attObj = { name: name, type: attType, path: path };
            if (_editingAttachIndex >= 0 && _editingAttachIndex < currentAttachments.length) {
                currentAttachments[_editingAttachIndex] = attObj;
                _editingAttachIndex = -1;
            } else {
                for (var i = 0; i < currentAttachments.length; i++) {
                    if (currentAttachments[i] && currentAttachments[i].path === path) {
                        renderAttachmentList();
                        return attObj;
                    }
                }
                currentAttachments.push(attObj);
            }
            renderAttachmentList();
            return attObj;
        }

        // 通过办公助手桥接服务（8737）选择本机文件/文件夹，支持一次多选
        function attachPick(mode, multiple) {
            if (typeof window.ZzPick === 'undefined') {
                showToast('选择器未加载，请手动填写路径');
                return;
            }
            var opts = {
                mode: mode === 'dir' ? 'dir' : 'file',
                multiple: !!multiple,
                title: multiple ? '选择文件（可多选）' : (mode === 'dir' ? '选择文件夹' : '选择文件'),
                start: (document.getElementById('attachPathInput') || {}).value || ''
            };
            window.ZzPick.pick(opts.mode, opts).then(function(res) {
                if (!res) return;
                if (res.cancelled) return;
                if (!res.ok) {
                    showToast('选择失败：' + (res.error || '未连接办公助手服务'));
                    return;
                }
                var paths = (res.paths && res.paths.length) ? res.paths : (res.path ? [res.path] : []);
                if (!paths.length) return;
                for (var i = 0; i < paths.length; i++) {
                    _appendAttachment(paths[i], '');
                }
                if (paths.length > 1) showToast('已添加 ' + paths.length + ' 个附件');
                _resetAttachInputs();
            });
        }

        function _bridgeBase() {
            if (window.ZZ_BRIDGE && window.ZZ_BRIDGE.url) return window.ZZ_BRIDGE.url;
            try {
                var saved = localStorage.getItem('zz-bridge-url');
                if (saved) return saved;
            } catch (e) {}
            return 'http://127.0.0.1:8737';
        }

        // 调用办公助手在本机打开路径（麒麟 xdg-open / Windows 默认程序）
        function _bridgeOpenPath(path) {
            return fetch(_bridgeBase() + '/api/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path })
            }).then(function(r) { return r.json(); });
        }

        
        function _resetAttachInputs() {
            S._editingAttachIndex = -1;
            var nameInput = document.getElementById('attachNameInput');
            var pathInput = document.getElementById('attachPathInput');
            var btn = document.getElementById('attachActionBtn');
            if (nameInput) nameInput.value = '';
            if (pathInput) pathInput.value = '';
            if (btn) { btn.textContent = '+ 添加'; btn.style.background = '#27ae60'; }
        }
        
        function _onAttachPathInput() {
            var pathInput = document.getElementById('attachPathInput');
            var nameInput = document.getElementById('attachNameInput');
            if (!pathInput || !nameInput) return;
            var v = pathInput.value.trim();
            if (v.startsWith('"') && v.endsWith('"') && v.length > 1) {
                pathInput.value = v.slice(1, -1);
                v = pathInput.value.trim();
            }
            if (!nameInput.value.trim() && v) {
                nameInput.value = extractNameFromPath(v);
            }
        }
        
        function editAttachment(index) {
            var att = currentAttachments[index];
            if (!att) return;
            S._editingAttachIndex = index;
            var nameInput = document.getElementById('attachNameInput');
            var pathInput = document.getElementById('attachPathInput');
            var btn = document.getElementById('attachActionBtn');
            if (nameInput) nameInput.value = att.name || '';
            if (pathInput) pathInput.value = att.path || '';
            if (btn) { btn.textContent = '保存'; btn.style.background = '#c0392b'; }
            if (nameInput) nameInput.focus();
        }
        
        function extractNameFromPath(p) {
            if (!p) return '';
            p = p.replace(/^["']+|["']+$/g, '').trim();
            if (!p) return '';
            var isWin = p.indexOf('\\') >= 0 || /^[a-zA-Z]:\\/.test(p);
            if (isWin) {
                var parts = p.split('\\');
                return parts[parts.length - 1] || p;
            } else {
                var parts = p.split('/');
                return parts[parts.length - 1] || p;
            }
        }
        
        function isFolderPath(p) {
            if (!p) return false;
            p = p.replace(/^["']+|["']+$/g, '').trim();
            if (!p) return false;
            if (p.charAt(p.length - 1) === '/' || p.charAt(p.length - 1) === '\\') return true;
            if (/^[a-zA-Z]:[\\\/]$/.test(p)) return true;
            if (/[\\\/]/.test(p)) {
                var lastSep = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
                var lastDot = p.lastIndexOf('.');
                if (lastDot < 0 || lastDot < lastSep) return true;
            }
            return false;
        }
        
        function renderAttachmentList() {
            var container = document.getElementById('attachmentList');
            if (!container) return;
            if (currentAttachments.length === 0) { container.innerHTML = ''; return; }
            var html = '';
            for (var i = 0; i < currentAttachments.length; i++) {
                var att = currentAttachments[i];
                var iconHtml = getAttachIconHtml(att.path, att.name);
                html += '<span class="attachmentItem" title="' + escapeHtml(att.path) + '">' +
                    iconHtml +
                    '<a class="attachmentLink" href="javascript:void(0)" onclick="event.stopPropagation();openAttachment(' + JSON.stringify(att.path || '').replace(/"/g, '&quot;') + ')" title="点击打开：' + escapeHtml(att.path) + '">' + escapeHtml(att.name) + '</a>' +
                    '<a class="attachmentEdit" onclick="event.stopPropagation();editAttachment(' + i + ')" title="修改名称或路径">改</a>' +
                    '<a class="attachmentDel" onclick="event.stopPropagation();removeAttachment(' + i + ')" title="移除该附件">×</a></span>';
            }
            container.innerHTML = html;
        }
        
        function removeAttachment(index) { currentAttachments.splice(index, 1); renderAttachmentList(); }
        
        function showAttachDetail(index) {
            var row = document.querySelector('tr[data-row="' + index + '"]');
            if (!row) return;
            var dateKey = row.dataset.datekey;
            var origIndex = parseInt(row.dataset.origindex);
            var data = reportData[dateKey];
            if (!data || !data[origIndex] || !data[origIndex].attachments || data[origIndex].attachments.length === 0) return;
            
            S.currentDetailAttachments = data[origIndex].attachments;
            var container = document.getElementById('attachDetailList');
            container.innerHTML = '';
            
            for (var i = 0; i < currentDetailAttachments.length; i++) {
                var att = currentDetailAttachments[i];
                var iconHtml = getAttachIconHtml(att.path, att.name);
                var item = document.createElement('div');
                item.className = 'attachDetailItem';
                item.innerHTML = '<span class="attIcon">' + iconHtml + '</span>' +
                    '<span class="attName">' + escapeHtml(att.name) + '</span>' +
                    '<span class="attPath" title="' + escapeHtml(att.path) + '">' + escapeHtml(att.path) + '</span>';
                
                (function(idx) {
                    item.addEventListener('click', function(e) {
                        e.preventDefault();
                        openAttachment(currentDetailAttachments[idx].path);
                    });
                    item.addEventListener('contextmenu', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        showContextMenu(e, currentDetailAttachments[idx].path);
                    });
                })(i);
                
                container.appendChild(item);
            }
            document.getElementById('attachDetailModal').classList.add('show');
        }
        
        function closeAttachDetail() { document.getElementById('attachDetailModal').classList.remove('show'); }
        
        function getFileExtension(filename) {
            var parts = filename.split('.');
            if (parts.length > 1) {
                return parts[parts.length - 1].toLowerCase();
            }
            return '';
        }
        
        function getAttachIconHtml(path, name) {
            var raw = path || name || '';
            var ext = getFileExtension(raw);
            if (isFolderPath(raw)) {
                return '<img src="data/type/folder.ico" style="width:14px;height:14px;vertical-align:middle;margin-right:3px;">';
            }
            var iconFile = 'file.ico';
            switch (ext) {
                case 'csv': iconFile = 'csv.ico'; break;
                case 'doc': case 'docx': case 'wps': iconFile = 'docx.ico'; break;
                case 'xls': case 'xlsx': case 'xlsm': case 'xlt': case 'xltx': case 'xltm': iconFile = 'excel.ico'; break;
                case 'zip': case 'rar': case '7z': case 'tar': case 'gz': case 'bz2': iconFile = 'winrar.ico'; break;
                case 'txt': iconFile = 'txt.ico'; break;
                case 'jpg': case 'jpeg': case 'bmp': case 'png': case 'gif': case 'webp': case 'svg': iconFile = 'picture.ico'; break;
                case 'psd': iconFile = 'psd.ico'; break;
                case 'pdf': iconFile = 'pdf.ico'; break;
                case 'mp4': case 'avi': case 'mkv': case 'mov': case 'wmv': case 'flv': case 'webm': case 'mpg': case 'mpeg': iconFile = 'movie.ico'; break;
                case 'mp3': case 'wav': case 'flac': case 'aac': case 'ogg': case 'wma': case 'm4a': iconFile = 'music.ico'; break;
                case 'js': case 'json': iconFile = 'json.ico'; break;
                case 'html': case 'htm': iconFile = 'html.ico'; break;
                default: iconFile = 'file.ico'; break;
            }
            return '<img src="data/type/' + iconFile + '" style="width:14px;height:14px;vertical-align:middle;margin-right:3px;">';
        }
        
        function openAttachment(path) {
            if (!path) { showToast('无有效路径'); return; }
            var rawPath = String(path).replace(/^["']+|["']+$/g, '').trim();
            // 优先请求办公助手用系统默认程序打开（麒麟 xdg-open / Windows 关联程序）
            _bridgeOpenPath(rawPath).then(function(res) {
                if (res && res.ok) {
                    showToast('已用系统程序打开');
                    return;
                }
                _openAttachmentFallback(rawPath, res && res.error);
            }).catch(function() {
                _openAttachmentFallback(rawPath, '');
            });
        }

        function _openAttachmentFallback(rawPath, errMsg) {
            var normalizedPath = rawPath.replace(/\\/g, '/');
            var ext = getFileExtension(normalizedPath);
            var isViewable = browserViewableExts.indexOf(ext) !== -1;
            var isHttp = /^https?:\/\//i.test(rawPath);
            if (isHttp) { window.open(rawPath, '_blank'); return; }
            if (isViewable && normalizedPath.charAt(0) === '/') {
                // 本机绝对路径：浏览器打不开，交给用户复制
                _copyAttachPath(rawPath, errMsg);
                return;
            }
            if (isViewable && /^[a-zA-Z]:[\\\/]/.test(rawPath)) {
                _copyAttachPath(rawPath, errMsg);
                return;
            }
            if (isViewable) {
                window.open(normalizedPath, '_blank');
                return;
            }
            _copyAttachPath(rawPath, errMsg);
        }

        function _copyAttachPath(rawPath, errMsg) {
            navigator.clipboard.writeText(rawPath).then(function() {
                showToast(errMsg ? ('未能调用系统程序（' + errMsg + '），路径已复制') : '办公助手未运行，路径已复制到剪贴板');
            }).catch(function() {
                showToast(errMsg ? ('打开失败：' + errMsg) : '打开失败：请先启动办公助手服务');
            });
        }
        
        function showContextMenu(event, path) {
            event.preventDefault();
            event.stopPropagation();
            S.contextMenuTarget = path;
            var menu = document.getElementById('contextMenu');
            menu.style.left = event.clientX + 'px';
            menu.style.top = event.clientY + 'px';
            menu.classList.add('show');
        }
        
        function hideContextMenu() {
            document.getElementById('contextMenu').classList.remove('show');
            S.contextMenuTarget = null;
        }
        
        document.getElementById('ctxCopyPath').addEventListener('click', function() {
            if (contextMenuTarget) {
                navigator.clipboard.writeText(contextMenuTarget).then(function() {
                    showToast('已复制地址到剪贴板！');
                }).catch(function() {
                    showToast('复制失败');
                });
            }
            hideContextMenu();
        });
        
        document.getElementById('ctxOpenLocation').addEventListener('click', function() {
            if (contextMenuTarget) {
                var folderPath = contextMenuTarget;
                var lastSlash = Math.max(folderPath.lastIndexOf('/'), folderPath.lastIndexOf('\\'));
                if (lastSlash > 0) {
                    folderPath = folderPath.substring(0, lastSlash);
                }
                window.open(folderPath, '_blank');
            }
            hideContextMenu();
        });
        
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.contextMenu')) {
                hideContextMenu();
            }
        });
        
        function deleteReportRow() {
            var keys = getDateKeysForRange();
            var lastKey = keys[keys.length - 1];
            var data = reportData[lastKey] || [];
            if (data.length === 0) {
                showToast('没有可删除的行');
                return;
            }
            data.pop();
            reportData[lastKey] = data;
            renderTrackContent();
            showToast('已删除最后一行');
        }
        
        function renderMultiTrack(container) { 
            renderMultiTrackTimeline(container);
        }
        
        function renderMultiTrackTimeline(container) {
            var lightBgColors = ['#ffcdd2', '#b8f3f9', '#e9b9f5', '#d1f7d3', '#f5d9b6', '#b9ccf3', '#f6f7ab'];
            var darkBgColors = ['#8a3838', '#0097a7', '#8e24aa', '#43a047', '#e1840f', '#3f77ea', '#a3a45d'];
            var weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
            
            var totalDays = Math.ceil((timeRangeEnd - timeRangeStart) / (1000 * 60 * 60 * 24)) + 1;
            var containerWidth = container.clientWidth || 800;
            var labelWidth = 80;
            var trailingGap = 0;
            var dayWidth = Math.max(40, Math.floor((containerWidth - labelWidth) / 7));
            var longRange = totalDays > 7;
            
            var days = [];
            var current = new Date(timeRangeStart);
            while (current <= timeRangeEnd) {
                days.push({
                    date: new Date(current),
                    dayOfWeek: current.getDay(),
                    key: getDateKeyFor(current.getFullYear(), current.getMonth(), current.getDate())
                });
                current.setDate(current.getDate() + 1);
            }
            if (timeRangeType === 'week' && timelineShowSubItems) {
                var subAxisStart = new Date(timeRangeStart);
                var subAxisEnd = new Date(timeRangeEnd);
                for (var sak in reportData) {
                    var sa = reportData[sak] || [];
                    for (var sai = 0; sai < sa.length; sai++) {
                        var sParsed = parseSubItemContent(sa[sai].content || '');
                        var prevSubDate = null;
                        for (var ssi = 0; ssi < (sParsed.items || []).length; ssi++) {
                            var sRange = pageViewSubItemDateRange(sParsed.items[ssi].text, sak, prevSubDate);
                            if (sRange.start) {
                                if (sRange.start < subAxisStart) subAxisStart = new Date(sRange.start);
                                if (sRange.end > subAxisEnd) subAxisEnd = new Date(sRange.end);
                                prevSubDate = new Date(sRange.start);
                            }
                        }
                    }
                }
                current = new Date(subAxisStart);
                var existingDayKeys = {};
                for (var edi = 0; edi < days.length; edi++) existingDayKeys[days[edi].key] = true;
                while (current <= subAxisEnd) {
                    var currentKey = getDateKeyFor(current.getFullYear(), current.getMonth(), current.getDate());
                    if (existingDayKeys[currentKey]) { current.setDate(current.getDate() + 1); continue; }
                    days.push({ date: new Date(current), dayOfWeek: current.getDay(), key: getDateKeyFor(current.getFullYear(), current.getMonth(), current.getDate()) });
                    current.setDate(current.getDate() + 1);
                }
                days.sort(function(a, b) { return a.date - b.date; });
            }
            
            var categories = [];
            var allCategories = [];
            for (var k in reportData) {
                var items = reportData[k];
                for (var j = 0; j < items.length; j++) {
                    if (items[j].category && allCategories.indexOf(items[j].category) === -1) {
                        allCategories.push(items[j].category);
                    }
                }
            }
            allCategories.sort(function(a, b) { return a.localeCompare(b, 'zh-CN'); });
            
            function categoryHasEventInRange(cat) {
                for (var k in reportData) {
                    var items = reportData[k];
                    var yh = _yearFromKey(k);
                    for (var j = 0; j < items.length; j++) {
                        if (items[j].category !== cat) continue;
                        if (searchKeyword && !rowMatchesSearch(items[j])) continue;
                        var sd = parseTimeStrToDate(items[j].startTime, yh);
                        var ed = getEffectiveWorkEndDate(items[j].startTime, items[j].endTime, yh);
                        if (!sd) continue;
                        if (!ed) ed = sd;
                        for (var d = 0; d < days.length; d++) {
                            var dd = new Date(days[d].date.getFullYear(), days[d].date.getMonth(), days[d].date.getDate());
                            if (dd >= sd && dd <= ed) return true;
                        }
                    }
                }
                return false;
            }
            for (var ci = 0; ci < allCategories.length; ci++) {
                if (categoryHasEventInRange(allCategories[ci])) categories.push(allCategories[ci]);
            }
            
            var displayDays = days;
            var rangeDayWidth = dayWidth;
            if (longRange && days.length > 7) {
                displayDays = [];
                var emptyStart = null;
                var emptyEnd = null;
                for (var di = 0; di < days.length; di++) {
                    var hasEventDay = false;
                    for (var rk in reportData) {
                        var ritems = reportData[rk] || [];
                        for (var rj = 0; rj < ritems.length; rj++) {
                            var rsd = parseTimeStrToDate(ritems[rj].startTime, _yearFromKey(rk));
                            var red = getEffectiveWorkEndDate(ritems[rj].startTime, ritems[rj].endTime, _yearFromKey(rk)) || rsd;
                            if (rsd && days[di].date.getTime() === rsd.getTime()) { hasEventDay = true; break; }
                            if (red && days[di].date.getTime() === red.getTime()) { hasEventDay = true; break; }
                        }
                        if (hasEventDay) break;
                    }
                    if (hasEventDay) {
                         if (emptyStart) {
                             var emptyMonthEnd = new Date(emptyStart.getFullYear(), emptyStart.getMonth() + 1, 0);
                             var emptyIsMonth = emptyStart.getDate() === 1 && emptyEnd.getTime() === emptyMonthEnd.getTime();
                             displayDays.push({ date: emptyStart, endDate: emptyEnd, isEllipsis: !emptyIsMonth && emptyStart.getTime() !== emptyEnd.getTime(), isMonth: emptyIsMonth, dayOfWeek: emptyStart.getDay() });
                             emptyStart = emptyEnd = null;
                         }
                        displayDays.push(days[di]);
                    } else if (!emptyStart) { emptyStart = days[di].date; emptyEnd = days[di].date; }
                    else { emptyEnd = days[di].date; }
                }
                if (emptyStart) {
                    var tailMonthEnd = new Date(emptyStart.getFullYear(), emptyStart.getMonth() + 1, 0);
                    var tailIsMonth = emptyStart.getDate() === 1 && emptyEnd.getTime() === tailMonthEnd.getTime();
                    displayDays.push({ date: emptyStart, endDate: emptyEnd, isEllipsis: !tailIsMonth && emptyStart.getTime() !== emptyEnd.getTime(), isMonth: tailIsMonth, dayOfWeek: emptyStart.getDay() });
                }
                rangeDayWidth = Math.max(60, Math.floor((containerWidth - labelWidth) / Math.max(1, displayDays.length)));
            }
            if (longRange && false) {
                var monthStartKey = days[0] && (days[0].date.getFullYear() * 12 + days[0].date.getMonth());
                var monthEndKey = days.length && (days[days.length - 1].date.getFullYear() * 12 + days[days.length - 1].date.getMonth());
                if (monthStartKey !== undefined && monthEndKey !== undefined && monthStartKey !== monthEndKey) {
                    displayDays = [];
                    var monthCursor = new Date(days[0].date.getFullYear(), days[0].date.getMonth(), 1);
                    var monthStop = new Date(days[days.length - 1].date.getFullYear(), days[days.length - 1].date.getMonth(), 1);
                    while (monthCursor <= monthStop) {
                        var monthEndDate = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
                        displayDays.push({ date: new Date(monthCursor), endDate: monthEndDate, dayOfWeek: monthCursor.getDay(), isMonth: true });
                        monthCursor.setMonth(monthCursor.getMonth() + 1);
                    }
                    rangeDayWidth = Math.max(60, Math.floor((containerWidth - labelWidth) / displayDays.length));
                }
            }
            var filteredMode = trackFilterState && trackFilterState.enabled;
            if (filteredMode) {
                var filterCats = [];
                for (var fi = 0; fi < trackFilterState.categories.length; fi++) {
                    if (trackFilterState.categories[fi].checked) filterCats.push(trackFilterState.categories[fi].category);
                }
                categories = filterCats.slice();
            }
            
            var categoryColorMap = {};
            for (var i = 0; i < allCategories.length; i++) {
                categoryColorMap[allCategories[i]] = {
                    light: lightBgColors[i % lightBgColors.length],
                    dark: darkBgColors[i % darkBgColors.length],
                    index: i % lightBgColors.length
                };
            }
            
            var totalWidth = labelWidth + days.length * dayWidth + trailingGap;
            
            var html = '<div class="multiTrackTimeline' + (longRange ? ' longRange' : '') + '" style="width:100%;height:100%;display:flex;flex-direction:column;">';
            
            html += '<div class="timelineHeader">';
            html += '<div class="timelineHeaderLabel" style="width:' + labelWidth + 'px;text-decoration:underline;text-underline-offset:2px;cursor:pointer;" onclick="showTrackFilterModal()">事 项</div>';
            html += '<div class="timelineTimeAxisWrapper" id="timelineTimeAxisWrapper">';
            html += '<div class="timelineTimeAxis" id="timelineTimeAxis" style="display:flex;">';
            
            for (var i = 0; i < displayDays.length; i++) {
                var d = displayDays[i];
                var dayOfWeek = d.dayOfWeek;
                var isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                var dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                var dayName = weekDayNames[dayIndex];
                var displayText = d.isEllipsis ? '…' : (longRange ? (d.isMonth ? '<span class="timelineMonthNum">' + (d.date.getMonth() + 1) + '</span><span class="timelineMonthUnit">月</span>' : d.date.getDate() + '日') : ((d.date.getMonth() + 1) + '月' + d.date.getDate() + '日（' + dayName + '）'));
                if (d.isEllipsis) {
                    var ellEnd = d.endDate || d.date;
                    var ellTitle = d.date.getFullYear() + '年' + (d.date.getMonth() + 1) + '月' + d.date.getDate() + '日至' + (ellEnd.getMonth() + 1) + '月' + ellEnd.getDate() + '日';
                }
                
                html += '<div class="timelineDayMark' + (isWeekend ? ' weekend' : '') + '" style="width:' + rangeDayWidth + 'px;flex-shrink:0;text-align:center;line-height:1.2;" ';
                html += 'title="' + (d.isEllipsis ? ellTitle : d.date.getFullYear() + '年' + (d.date.getMonth() + 1) + '月' + d.date.getDate() + '日（周' + weekDays[d.date.getDay()] + '）') + '">';
                html += displayText;
                html += '</div>';
            }
            html += '<div class="timelineDayMark" style="width:' + trailingGap + 'px;min-width:' + trailingGap + 'px;flex-shrink:0;border-right:none;background:transparent;"></div>';
            html += '</div></div></div>';
            
            html += '<div class="timelineBody">';
            html += '<div class="timelineLabelsColumn" id="timelineLabelsColumn" style="width:' + labelWidth + 'px">';
            html += '<div class="timelineLabelsInner" id="timelineLabelsInner">';
            for (var i = 0; i < categories.length; i++) {
                var cat = categories[i];
                var colorIdx = categoryColorMap[cat] ? categoryColorMap[cat].index : (i % lightBgColors.length);
                html += '<div class="timelineLabel labelBg' + colorIdx + '"><div class="timelineLabelWrap">' + cat + '</div></div>';
            }
            if (categories.length === 0) {
                html += '<div class="timelineLabel" style="background:#999">其他</div>';
            }
            html += '</div>';
            html += '</div>';
            html += '<div class="timelineTracksWrapper" id="timelineTracksWrapper">';
            html += '<div class="timelineTracksInner" style="width:' + (displayDays.length * rangeDayWidth + trailingGap) + 'px;">';
            
            for (var i = 0; i < categories.length; i++) {
                var cat = categories[i];
                var colorIdx = categoryColorMap[cat] ? categoryColorMap[cat].index : (i % lightBgColors.length);
                html += '<div class="timelineTrack" style="width:100%;position:relative;background:transparent;" data-category="' + cat + '" data-color-idx="' + colorIdx + '">';
                
                var catEvents = [];
                for (var key in reportData) {
                    var items = reportData[key];
                    for (var j = 0; j < items.length; j++) {
                        if (items[j].category === cat) {
                            if (searchKeyword && !rowMatchesSearch(items[j])) continue;
                            catEvents.push({
                                item: items[j],
                                dateKey: key
                            });
                        }
                    }
                }
                
                for (var e = 0; e < catEvents.length; e++) {
                    var evt = catEvents[e].item;
                        var startDate = parseTimeStrToDate(evt.startTime, _yearFromKey(catEvents[e].dateKey));
                    var endDate = getEffectiveWorkEndDate(evt.startTime, evt.endTime, _yearFromKey(catEvents[e].dateKey));
                    if (!startDate) continue;
                    if (!endDate) endDate = startDate;
                    
                    var startIdx = -1;
                    var endIdx = -1;
                    
                    for (var d = 0; d < displayDays.length; d++) {
                        var dayDate = new Date(displayDays[d].date.getFullYear(), displayDays[d].date.getMonth(), displayDays[d].date.getDate());
                        var dayEnd = displayDays[d].endDate ? new Date(displayDays[d].endDate) : dayDate;
                        dayEnd.setHours(0, 0, 0, 0);
                        if (dayEnd >= startDate && dayDate <= endDate) {
                            if (startIdx === -1) startIdx = d;
                            endIdx = d;
                        }
                    }
                    
                    if (startIdx !== -1 && endIdx !== -1) {
                        var left = startIdx * rangeDayWidth + 2;
                        var width = (endIdx - startIdx + 1) * rangeDayWidth - 4;
                        var hasRemark = evt.remark && evt.remark.trim() !== '';
                        var bgColor = lightBgColors[colorIdx];
                        var minEventWidth = Math.max(120, rangeDayWidth);
                        if (width < minEventWidth) width = minEventWidth;
                        
                        var eventSubItems = timeRangeType === 'week' ? (parseSubItemContent(evt.content || '').items || []) : [];
                        var hasDatedSubItems = false;
                        for (var dsi = 0; dsi < eventSubItems.length; dsi++) {
                            if (pageViewSubItemDate(eventSubItems[dsi].text, catEvents[e].dateKey)) { hasDatedSubItems = true; break; }
                        }
                        html += '<div class="timelineEvent' + (hasRemark ? ' hasRemark' : '') + '" style="left:' + left + 'px;width:' + width + 'px;background:' + bgColor + ';opacity:' + (timelineShowSubItems && hasDatedSubItems ? '0.2' : '1') + '" ';
                        html += 'data-category="' + cat + '" ';
                        html += 'data-content="' + escapeHtml(evt.content || '').replace(/"/g, '&quot;') + '" ';
                        html += 'data-remark="' + escapeHtml(evt.remark || '').replace(/"/g, '&quot;') + '" ';
                        html += 'data-start="' + (evt.startTime || '') + '" ';
                        html += 'data-end="' + (evt.endTime || '') + '" ';
                        html += 'data-datekey="' + (catEvents[e].dateKey || '') + '" ';
                        html += 'data-origindex="' + (reportData[catEvents[e].dateKey] ? reportData[catEvents[e].dateKey].indexOf(evt) : -1) + '" ';
                        html += 'data-start-idx="' + startIdx + '" ';
                        html += 'data-end-idx="' + endIdx + '" ';
                        html += '>';
                        
                        var displayText = evt.content || '';
                        if (displayText.length > 80) displayText = displayText.substring(0, 80) + '…';
                        html += escapeHtml(displayText);
                        html += '</div>';
                        if (timelineShowSubItems && timeRangeType === 'week') {
                            var subItems = eventSubItems;
                            for (var si = 0; si < subItems.length; si++) {
                                var previousSubDate = si > 0 ? pageViewSubItemDate(subItems[si - 1].text, catEvents[e].dateKey) : null;
                                var subRange = pageViewSubItemDateRange(subItems[si].text, catEvents[e].dateKey, previousSubDate);
                                var subDate = subRange.start;
                                if (!subDate) continue;
                                var subEndDate = subRange.end || subDate;
                                var subIdx = -1;
                                var subEndIdx = -1;
                                for (var sdi = 0; sdi < displayDays.length; sdi++) {
                                    var subDay = new Date(displayDays[sdi].date.getFullYear(), displayDays[sdi].date.getMonth(), displayDays[sdi].date.getDate());
                                    var subDayEnd = displayDays[sdi].endDate ? new Date(displayDays[sdi].endDate) : subDay;
                                    subDayEnd.setHours(0, 0, 0, 0);
                                    subDate.setHours(0, 0, 0, 0);
                                    subEndDate.setHours(0, 0, 0, 0);
                                    if (subDayEnd >= subDate && subDay <= subEndDate) {
                                        if (subIdx < 0) subIdx = sdi;
                                        subEndIdx = sdi;
                                    }
                                }
                                if (subIdx < 0) continue;
                                var subText = (subItems[si].text || '').replace(/^\s*\d+[\.。、]\s*/, '').replace(/[■□√…×]\s*$/, '').replace(/^\s+|\s+$/g, '');
                                var subMark = (subItems[si].text.match(/[■□√…×]\s*$/) || [''])[0].trim();
                                var subWidth = (subEndIdx - subIdx + 1) * rangeDayWidth - 4;
                                html += '<div class="timelineSubEvent" style="left:' + (subIdx * rangeDayWidth + 2) + 'px;width:' + Math.max(40, subWidth) + 'px;background:' + bgColor + '" title="' + escapeHtml(subText) + '">' + escapeHtml(subText) + '</div>';
                            }
                        }
                    }
                }
                
                html += '</div>';
            }
            if (categories.length === 0) {
                html += '<div class="timelineTrack" style="width:' + (days.length * dayWidth + trailingGap) + 'px;display:flex;align-items:center;justify-content:center;color:#999;font-size:13px;">暂无数据</div>';
            }
            html += '</div></div></div></div>';
            if (timeRangeType === 'week') html += '<div class="timelineSubToggleBar"><label class="timelineSubToggle' + (timelineShowSubItems ? ' active' : '') + '"><input type="checkbox"' + (timelineShowSubItems ? ' checked' : '') + ' onchange="toggleTimelineSubItems(this.checked)">分项</label></div>';
            
            container.innerHTML = html;
            
            var events = container.querySelectorAll('.timelineEvent');
            for (var i = 0; i < events.length; i++) {
                events[i].addEventListener('mouseenter', showTimelineTooltipYellow);
                events[i].addEventListener('mouseleave', hideTimelineTooltip);
                events[i].addEventListener('dblclick', function(e) {
                    e.stopPropagation();
                    var cat = this.getAttribute('data-category');
                    var start = this.getAttribute('data-start');
                    var end = this.getAttribute('data-end');
                    var content = this.getAttribute('data-content');
                    var remark = this.getAttribute('data-remark');
                    openTimelineEventEditModal(cat, start, end, content, remark, this);
                });
                initEventDrag(events[i], displayDays, rangeDayWidth);
            }
            
            addYellowTooltip(container);
            
            var containerEl = container.querySelector('.multiTrackTimeline');
            
            var tracksWrapper = document.getElementById('timelineTracksWrapper');
            var timeAxisWrapper = document.getElementById('timelineTimeAxisWrapper');
            var labelsColumn = document.getElementById('timelineLabelsColumn');
            var labelsInner = document.getElementById('timelineLabelsInner');
            
            if (tracksWrapper && timeAxisWrapper) {
                tracksWrapper.addEventListener('scroll', function() {
                    timeAxisWrapper.scrollLeft = tracksWrapper.scrollLeft;
                });
            }
            
            if (tracksWrapper && labelsInner) {
                tracksWrapper.addEventListener('scroll', function() {
                    labelsInner.style.transform = 'translateY(-' + tracksWrapper.scrollTop + 'px)';
                });
            }
            
            if (containerEl) {
                containerEl.addEventListener('wheel', function(e) {
                    if (e.shiftKey) return;
                    e.preventDefault();
                    if (tracksWrapper) {
                        tracksWrapper.scrollLeft += e.deltaY;
                    }
                }, { passive: false });
            }
        }
        
        // ===== 周工作分项日志详情面板 =====
        var _weekLogDetailContext = null;
        function _weekLogMatchesCurrentRange(item, key) {
            var yh = _yearFromKey(key);
            if (_showAllRecords) return true;
            if (timeRangeType === 'day') return dateRangeContains(item.startTime, item.endTime, timeRangeStart, yh);
            return isItemInTimeRange(item.startTime, item.endTime, yh);
        }
        function _collectUnlinkedWeekLogs() {
            var out = [];
            for (var key in reportData) {
                if (!reportData.hasOwnProperty(key)) continue;
                var arr = reportData[key];
                if (!Array.isArray(arr)) continue;
                for (var i = 0; i < arr.length; i++) {
                    var item = arr[i];
                    if (!item || (!item.category && !item.content)) continue;
                    if (isWeekWorkItem(item)) continue;
                    if (item.weekWorkSubId) continue;
                    if (!_weekLogMatchesCurrentRange(item, key)) continue;
                    out.push({ dateKey: key, origIndex: i, item: item });
                }
            }
            return out;
        }
        function renderWeekLogDetailPanel() {
            var panel = document.getElementById('weekLogDetailPanel');
            var body = document.getElementById('weekLogDetailBody');
            var title = document.getElementById('weekLogDetailTitle');
            if (!panel || !body || !_weekLogDetailContext) return;
            var items = [];
            if (_weekLogDetailContext.type === 'sub') {
                var hits = _findLogsBySubItemId(_weekLogDetailContext.id);
                for (var i = 0; i < hits.length; i++) items.push(hits[i]);
                if (title) title.textContent = _weekLogDetailContext.label || '日志详情';
            } else {
                items = _collectUnlinkedWeekLogs();
                if (title) title.textContent = '未关联周工作的日志';
            }
            if (!items.length) {
                body.innerHTML = '<div class="pageViewEmpty">暂无日志内容</div>';
                return;
            }
            var html = '<div class="pageViewSheet weekLogDetailSheet">';
            var groups = {};
            var order = [];
            for (var g = 0; g < items.length; g++) {
                var it = items[g].item;
                it._dateKey = items[g].dateKey;
                it._origIndex = items[g].origIndex;
                var dk = items[g].dateKey || '';
                if (!groups[dk]) { groups[dk] = []; order.push(dk); }
                groups[dk].push(it);
            }
            for (var oi = 0; oi < order.length; oi++) {
                var grp = groups[order[oi]];
                html += '<div class="pageViewDateGroup">';
                html += '<div class="pageViewDate">' + escapeHtml(formatLogTimePageStartDisplay(grp[0].startTime || '')) + '</div>';
                for (var e = 0; e < grp.length; e++) {
                    html += buildPageViewEntryHtml(grp[e], grp.length, e, {});
                }
                html += '</div>';
            }
            html += '</div>';
            body.innerHTML = html;
            _weekSummaryDecorate(body);
        }
        function showWeekSubItemLogDetail(subId) {
            if (!subId) return;
            // 再次点击同一徽标时关闭窗口，便于切换
            if (_weekLogDetailContext && _weekLogDetailContext.type === 'sub' && _weekLogDetailContext.id === subId) {
                var samePanel = document.getElementById('weekLogDetailPanel');
                if (samePanel && samePanel.classList.contains('show')) { closeWeekLogDetailPanel(); return; }
            }
            // 该周工作分项没有对应日志时不弹出窗口；若窗口正打开则收起。
            var hits = _findLogsBySubItemId(subId);
            if (!hits.length) {
                var openedPanel = document.getElementById('weekLogDetailPanel');
                if (openedPanel && openedPanel.classList.contains('show')) closeWeekLogDetailPanel();
                return;
            }
            var name = _findWeekSubItemName(subId);
            _weekLogDetailContext = { type: 'sub', id: subId, label: name || '日志详情' };
            var panel = document.getElementById('weekLogDetailPanel');
            if (panel) panel.classList.add('show');
            renderWeekLogDetailPanel();
        }
        function showWeekUnlinkedLogsDetail() {
            if (!_collectUnlinkedWeekLogs().length) return;
            _weekLogDetailContext = { type: 'unlinked' };
            var panel = document.getElementById('weekLogDetailPanel');
            if (panel) panel.classList.add('show');
            renderWeekLogDetailPanel();
        }
        function closeWeekLogDetailPanel() {
            var panel = document.getElementById('weekLogDetailPanel');
            if (panel) panel.classList.remove('show');
            _weekLogDetailContext = null;
        }
        // 左边框拖动调整日志面板宽度。面板 HTML 位于脚本之后，需在 DOM 就绪后再初始化。
        var _weekLogDetailResizing = false;
        function initWeekLogDetailResize() {
            var panel = document.getElementById('weekLogDetailPanel');
            var resizer = document.getElementById('weekLogDetailResizer');
            if (!panel || !resizer || resizer.dataset.resizeBound) return;
            resizer.dataset.resizeBound = '1';
            var dragging = false, startX = 0, startW = 0;
            function onMove(e) {
                if (!dragging) return;
                e.preventDefault();
                var cx = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
                var w = startW + (startX - cx);
                var maxW = Math.round(window.innerWidth * 0.92);
                if (w < 280) w = 280;
                if (w > maxW) w = maxW;
                panel.style.width = w + 'px';
            }
            function onUp() {
                if (!dragging) return;
                dragging = false;
                resizer.classList.remove('dragging');
                document.body.style.userSelect = '';
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                window.removeEventListener('touchmove', onMove);
                window.removeEventListener('touchend', onUp);
                // 拖动结束时鼠标可能在面板之外，浏览器随后会派发一次 click 落到外部
                // 元素上，从而误触发“点击外部关闭”。这里在捕获阶段吞掉紧随其后的
                // 那一次 click，保证拖动不改变面板开关状态。
                var swallow = function(ev) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    window.removeEventListener('click', swallow, true);
                    _weekLogDetailResizing = false;
                };
                window.addEventListener('click', swallow, true);
                setTimeout(function() {
                    window.removeEventListener('click', swallow, true);
                    _weekLogDetailResizing = false;
                }, 300);
                try { DataLayer.setRaw('weekLogDetailPanelWidth', String(panel.offsetWidth)); } catch (err) {}
            }
            function onDown(e) {
                if (e.button !== undefined && e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                dragging = true;
                _weekLogDetailResizing = true;
                resizer.classList.add('dragging');
                document.body.style.userSelect = 'none';
                startX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
                startW = panel.offsetWidth;
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
                window.addEventListener('touchmove', onMove, { passive: false });
                window.addEventListener('touchend', onUp);
            }
            resizer.addEventListener('mousedown', onDown);
            resizer.addEventListener('touchstart', onDown, { passive: false });
            resizer.addEventListener('click', function(e) { e.stopPropagation(); });
            try {
                var saved = parseFloat(DataLayer.getRaw('weekLogDetailPanelWidth'));
                if (isFinite(saved) && saved >= 280) panel.style.width = Math.min(saved, Math.round(window.innerWidth * 0.92)) + 'px';
            } catch (err) {}
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initWeekLogDetailResize);
        else setTimeout(initWeekLogDetailResize, 0);
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                var panel = document.getElementById('weekLogDetailPanel');
                if (panel && panel.classList.contains('show')) closeWeekLogDetailPanel();
            }
        });
        // 点击周工作分项以外的任意位置关闭详情面板；分项自身的点击已 stopPropagation，
        // 因此只是更新面板内容而不会触发此处的关闭。
        // 弹层/对话框（编辑工作记录、编辑分项、状态下拉、右键菜单等）挂载在面板之外，
        // 点击或编辑它们时不应关闭日志面板，故一并排除。
        var _weekDetailKeepOpenSelector = '#weekLogDetailPanel, #weekLogDetailResizer, .pageViewSubItem, .pageViewUnlinkedRow, .pageViewEntryStatusSelect, .pageViewSubStatusSelect, .pageViewSubStatusPicker, .pageViewSubMenu, #rowContextMenu, #headerContextMenu, #subStatusItemMenu, .editModal, .editWeekPopup, #paTagDialog, .datePickerModal, .customDateModal, .attachDetailModal, .toast, #tsStartDate, #tsStartTime, #tsEndDate, #tsEndTime';
        // 用 mousedown 判定外部点击：拖动左边框结束时鼠标可能在面板外，但只产生 click，
        // 不会产生新的 mousedown，因此拖动不会误关闭面板。
        document.addEventListener('mousedown', function(e) {
            var panel = document.getElementById('weekLogDetailPanel');
            if (!panel || !panel.classList.contains('show')) return;
            if (_weekLogDetailResizing) return;
            var t = e.target;
            if (t && t.closest && t.closest(_weekDetailKeepOpenSelector)) return;
            closeWeekLogDetailPanel();
        }, false);

        // ===== 周工作“总结”（底层仍存于 remark 字段，兼容旧数据） =====
        // 编辑框里“备注/总结”标签随事项是否为周工作切换
        function _updateRemarkFieldLabel() {
            var catEl = document.getElementById('editCategory');
            var label = document.getElementById('editRemarkLabel');
            var ta = document.getElementById('editRemark');
            if (!catEl || !label || !ta) return;
            var isWeek = isWeekWorkItem({ category: catEl.value || '' });
            label.textContent = isWeek ? '总结：' : '备注：';
            ta.setAttribute('placeholder', isWeek ? '输入本周工作总结（可自动分标题）' : '输入备注');
        }
        window._updateRemarkFieldLabel = _updateRemarkFieldLabel;

        function _weeklySummaryText(raw) {
            var txt = String(raw == null ? '' : raw).replace(/\r\n/g, '\n');
            txt = txt.replace(/^\s*周工作[：:][ \t]*/, '');
            return txt.replace(/^\n+|\n+$/g, '');
        }

        function _weekSummaryClassifyLine(text) {
            var t = String(text || '').replace(/^[\s\u3000]+/, '');
            if (!t) return '';
            if (/^[一二三四五六七八九十]+\s*[、.．]/.test(t)) return 'wsum-l1';
            if (/^\d+\s*[、.．]/.test(t)) return 'wsum-l2';
            return '';
        }

        // 把一段纯文本按层级渲染成页面视图里的 HTML（与编辑窗口一致：二级标题句号后同行转正文）
        function _weekSummaryDisplayHtml(text, keyword) {
            var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
            var out = '';
            for (var i = 0; i < lines.length; i++) {
                var t = lines[i];
                if (!t) { out += '<div class="wsum-p wsum-blank"></div>'; continue; }
                var cls = _weekSummaryClassifyLine(t);
                var inner;
                if (cls === 'wsum-l2') {
                    var sp = _weekSummarySplitLead(t);
                    inner = '<span class="wsum-l2-lead">' + (keyword ? highlightText(sp.lead, keyword) : escapeHtml(sp.lead)) + '</span>' +
                        (keyword ? highlightText(sp.rest, keyword) : escapeHtml(sp.rest));
                } else {
                    inner = keyword ? highlightText(t, keyword) : escapeHtml(t);
                }
                out += '<div class="wsum-p' + (cls ? ' ' + cls : '') + '">' + inner + '</div>';
            }
            return out;
        }

        // 渲染后标记：总结正文被截断（超过约 3 行）时显示省略提示
        function _weekSummaryDecorate(root) {
            if (!root || !root.querySelectorAll) return;
            var bodies = root.querySelectorAll('.pageViewSummaryBody');
            for (var i = 0; i < bodies.length; i++) {
                var b = bodies[i];
                var box = b.closest('.pageViewSummary');
                if (!box) continue;
                var clamped = b.scrollHeight > b.clientHeight + 2;
                box.classList.toggle('clamped', clamped);
            }
        }
        window._weekSummaryDecorate = _weekSummaryDecorate;

        // 二级标题（1. 2. 3.）只把“第一句”当标题，句号后的内容自动转为正文
        function _weekSummarySplitLead(text) {
            var s = String(text || '');
            for (var i = 0; i < s.length; i++) {
                var ch = s.charAt(i);
                if (ch === '。' || ch === '！' || ch === '；') {
                    if (i < s.length - 1) return { lead: s.substring(0, i + 1), rest: s.substring(i + 1) };
                    return { lead: s, rest: '' };
                }
            }
            return { lead: s, rest: '' };
        }

        // 把一句纯文本渲染成“层级 + 句号后正文”的段落 HTML（编辑窗与页面视图共用）
        function _weekSummaryRenderParagraphHtml(text, cls) {
            var t = String(text == null ? '' : text);
            if (!t) return '<br>';
            if (cls === 'wsum-l2') {
                var sp = _weekSummarySplitLead(t);
                if (sp.rest) {
                    return '<span class="wsum-l2-lead">' + escapeHtml(sp.lead) + '</span>' + escapeHtml(sp.rest);
                }
            }
            return escapeHtml(t);
        }

        // 计算光标在段落纯文本中的偏移。⚠ 光标可能锚定在元素节点上（contenteditable 在段尾/段首
        // 常把 Selection 落在 <p> 或 <span> 上），此时必须把「起点之前的所有可见文本」全部累加，
        // 而不能一遇到 startContainer 就直接结束——否则段尾回车会算出 offset=0，把整段复制进新段。
        function _weekSummaryCaretOffset(root, range) {
            var sc = range.startContainer;
            var so = range.startOffset;
            if (sc === root) {
                // 锚定在段落本身：累加前 so 个子节点的文本
                var acc0 = 0;
                for (var ci = 0; ci < so && ci < root.childNodes.length; ci++) {
                    acc0 += (root.childNodes[ci].textContent || '').length;
                }
                return acc0;
            }
            if (sc.nodeType !== 3) {
                // 锚定在元素节点内部：累加该节点前 so 个子节点的文本，再加上它之前所有兄弟的文本
                var acc = 0;
                for (var k = 0; k < so && k < sc.childNodes.length; k++) {
                    acc += (sc.childNodes[k].textContent || '').length;
                }
                var node = sc;
                while (node && node !== root) {
                    var prev = node.previousSibling;
                    while (prev) {
                        acc += (prev.textContent || '').length;
                        prev = prev.previousSibling;
                    }
                    node = node.parentNode;
                }
                return acc;
            }
            var offset = 0, done = false;
            (function walk(n) {
                if (done) return;
                if (n === sc) {
                    offset += so;
                    done = true;
                    return;
                }
                if (n.nodeType === 3) {
                    offset += n.nodeValue.length;
                    return;
                }
                for (var i = 0; i < n.childNodes.length; i++) {
                    walk(n.childNodes[i]);
                    if (done) return;
                }
            })(root);
            return offset;
        }

        function _weekSummarySetCaretOffset(root, offset) {
            var remain = offset, found = false;
            var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
            var node = walker.nextNode();
            var target = null, targetOffset = 0;
            while (node) {
                var len = node.nodeValue.length;
                if (remain <= len) { target = node; targetOffset = remain; found = true; break; }
                remain -= len;
                node = walker.nextNode();
            }
            if (!found) {
                target = root;
                targetOffset = root.childNodes.length;
            }
            var range = document.createRange();
            try {
                if (target.nodeType === 3) range.setStart(target, Math.min(targetOffset, target.nodeValue.length));
                else range.setStart(target, Math.min(targetOffset, target.childNodes.length));
                range.collapse(true);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            } catch (e) {}
        }

        var _weekSummaryPopover = null;
        var _weekSummaryClickTimer = null;
        function closeWeekSummaryPopover() {
            if (_weekSummaryPopover) {
                try { if (_weekSummaryPopover._wsumDragCleanup) _weekSummaryPopover._wsumDragCleanup(); } catch (e) {}
                if (_weekSummaryPopover.parentNode) _weekSummaryPopover.parentNode.removeChild(_weekSummaryPopover);
            }
            _weekSummaryPopover = null;
        }
        function _weekSummaryCancelClick() {
            if (_weekSummaryClickTimer) { clearTimeout(_weekSummaryClickTimer); _weekSummaryClickTimer = null; }
        }
        window._weekSummaryCancelClick = _weekSummaryCancelClick;

        // 单击总结区域：被 3 行截断时才弹浮窗显示全文（双击时取消单击动作）
        function handleWeekSummaryClick(e, el) {
            if (e) e.stopPropagation();
            _weekSummaryCancelClick();
            _weekSummaryClickTimer = setTimeout(function() {
                _weekSummaryClickTimer = null;
                _weekSummaryDoClick(el);
            }, 220);
        }
        function _weekSummaryDoClick(el) {
            closeWeekSummaryPopover();
            if (!el) return;
            var dateKey = el.getAttribute('data-datekey') || '';
            var origIndex = parseInt(el.getAttribute('data-origindex'), 10);
            var item = reportData[dateKey] && reportData[dateKey][origIndex];
            if (!item) return;
            var full = _weeklySummaryText(item.remark);
            // 总结为空时仍允许打开（里面有「编辑」可直接录入）；内容未超 3 行也可打开查看

            var pop = document.createElement('div');
            pop.className = 'weekSummaryPopover';
            var head = document.createElement('div');
            head.className = 'wsumPopHead';
            head.innerHTML = '<span class="wsumPopTitle">查看全文</span>' +
                '<span class="wsumPopActions">' +
                    '<span class="wsumPopEdit" title="打开总结编辑窗口">编辑</span>' +
                    '<span class="wsumPopClose" title="关闭">×</span>' +
                '</span>';
            var bodyEl = document.createElement('div');
            bodyEl.className = 'wsumPopBody';
            bodyEl.innerHTML = full ? _weekSummaryDisplayHtml(full, '') : '<div class="wsumPopEmpty">（本周总结为空，点右上角「编辑」录入）</div>';
            pop.appendChild(head);
            pop.appendChild(bodyEl);
            document.body.appendChild(pop);

            var rect = el.getBoundingClientRect();
            var zoom = parseFloat(DataLayer.getRaw('mainZoom') || '1');
            if (!isFinite(zoom) || zoom <= 0) zoom = 1;
            var w = pop.offsetWidth, h = pop.offsetHeight;
            var left = rect.left;
            if (left + w > window.innerWidth - 6) left = window.innerWidth - w - 6;
            if (left < 6) left = 6;
            var top = rect.bottom + 4;
            if (top + h > window.innerHeight - 6) top = Math.max(6, rect.top - h - 4);
            pop.style.left = Math.round(left / zoom) + 'px';
            pop.style.top = Math.round(top / zoom) + 'px';
            pop.style.zoom = zoom;
            _weekSummaryPopover = pop;

            head.querySelector('.wsumPopClose').addEventListener('click', function(ev) {
                ev.stopPropagation();
                closeWeekSummaryPopover();
            });
            head.querySelector('.wsumPopEdit').addEventListener('click', function(ev) {
                ev.stopPropagation();
                var dk = dateKey, oi = origIndex;
                closeWeekSummaryPopover();
                openWeekSummaryEditor(dk, oi);
            });
            // 拖动标题栏移动查看窗口（位置记在元素上，避免触发关闭判定）
            (function() {
                var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
                head.addEventListener('mousedown', function(ev) {
                    if (ev.target.closest('.wsumPopClose') || ev.target.closest('.wsumPopEdit')) return;
                    dragging = true;
                    sx = ev.clientX; sy = ev.clientY;
                    ox = parseFloat(pop.style.left) || 0;
                    oy = parseFloat(pop.style.top) || 0;
                    ev.preventDefault();
                    ev.stopPropagation();
                });
                var onMove = function(ev) {
                    if (!dragging) return;
                    var z = parseFloat(pop.style.zoom) || 1;
                    var nx = ox + (ev.clientX - sx) / z;
                    var ny = oy + (ev.clientY - sy) / z;
                    var maxL = window.innerWidth / z - 60;
                    var maxT = window.innerHeight / z - 30;
                    pop.style.left = Math.round(Math.max(-pop.offsetWidth + 80, Math.min(nx, maxL))) + 'px';
                    pop.style.top = Math.round(Math.max(0, Math.min(ny, maxT))) + 'px';
                };
                var onUp = function() { dragging = false; };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
                pop._wsumDragCleanup = function() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
            })();
            setTimeout(function() {
                document.addEventListener('mousedown', function _popOutside(ev) {
                    if (_weekSummaryPopover && !_weekSummaryPopover.contains(ev.target)) {
                        closeWeekSummaryPopover();
                        document.removeEventListener('mousedown', _popOutside, true);
                    }
                }, true);
            }, 0);
        }
        window.handleWeekSummaryClick = handleWeekSummaryClick;

        // 把总结纯文本按笔记模块的标准格式渲染成段落 HTML
        // 该周日期区间：同月缩写「10月16日至22日」，同年跨月带月份，跨年完整写
        function _wsumWeekRangeText(dateKey) {
            var d = null;
            try {
                var mt = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (mt) d = new Date(parseInt(mt[1], 10), parseInt(mt[2], 10) - 1, parseInt(mt[3], 10));
            } catch (e) { d = null; }
            if (!d || isNaN(d.getTime())) d = new Date();
            var wd = d.getDay();
            var start = new Date(d.getTime() - (wd === 0 ? 6 : wd - 1) * 86400000);
            var end = new Date(start.getTime() + 6 * 86400000);
            var sy = start.getFullYear(), sm = start.getMonth() + 1, sd = start.getDate();
            var ey = end.getFullYear(), em = end.getMonth() + 1, ed = end.getDate();
            if (sy === ey && sm === em) return sy + '年' + sm + '月' + sd + '日至' + ed + '日';
            if (sy === ey) return sy + '年' + sm + '月' + sd + '日至' + em + '月' + ed + '日';
            return sy + '年' + sm + '月' + sd + '日至' + ey + '年' + em + '月' + ed + '日';
        }

        // 把总结 HTML 拆成 docx 段落（标题/日期/各级段落/括号注释）
        function _wsumDocxParagraphs(editor) {
            var paras = [];
            var rows = [];
            if (editor) {
                var nodes = editor.children || [];
                for (var i = 0; i < nodes.length; i++) {
                    var n = nodes[i];
                    if (n.nodeType !== 1) continue;
                    if (n.classList && n.classList.contains('np-article-separator')) continue;
                    rows.push({ lv: n.getAttribute('data-level') || 'level-body', el: n });
                }
            }
            for (var r = 0; r < rows.length; r++) {
                var row = rows[r];
                var runs = [];
                var lv = row.lv;
                var el = row.el;
                var kids = el.childNodes || [];
                for (var k = 0; k < kids.length; k++) {
                    var kn = kids[k];
                    if (kn.nodeType !== 1) continue;
                    var txt = kn.textContent || '';
                    if (!txt) continue;
                    var style = (kn.getAttribute('style') || '');
                    var isRemark = /楷体/i.test(style) && /14px/i.test(style);
                    var isBody = /仿宋/i.test(style);
                    if (isRemark) runs.push({ text: txt, font: '楷体_GB2312', size: 28, bold: false });
                    else if (isBody) runs.push({ text: txt, font: '仿宋_GB2312', size: 32, bold: /bold/i.test(style) });
                    else if (/黑体/i.test(style)) runs.push({ text: txt, font: '黑体', size: 32, bold: /bold/i.test(style) });
                    else if (/楷体/i.test(style)) runs.push({ text: txt, font: '楷体_GB2312', size: 32, bold: /bold/i.test(style) });
                    else runs.push({ text: txt, font: '仿宋_GB2312', size: 32, bold: false });
                }
                if (!runs.length) {
                    var plain = (el.textContent || '').replace(/\u00a0/g, ' ');
                    if (plain) {
                        var font = lv === 'level-1' ? '黑体' : (lv === 'level-2' ? '楷体_GB2312' : '仿宋_GB2312');
                        runs.push({ text: plain, font: font, size: 32, bold: false });
                    }
                }
                var align = 'left';
                var indent = (lv === 'level-1' || lv === 'level-2') ? '2em' : '2em';
                paras.push({ align: align, indent: indent, lineHeight: '1.8', runs: runs });
            }
            return paras;
        }

        async function exportWeekSummaryDocx(dateKey, origIndex) {
            try {
                var item = reportData[dateKey] && reportData[dateKey][origIndex];
                if (!item) { showToast('未找到该条周工作总结'); return; }
                var text = _weeklySummaryText(item.remark);
                if (!text || !text.replace(/[\s\u3000]/g, '')) { showToast('本周工作总结为空，无法导出'); return; }
                if (typeof getDocTemplate !== 'function' || typeof buildDocBodyXml !== 'function') {
                    showToast('导出组件未就绪'); return;
                }
                var tpl = getDocTemplate();
                if (!tpl) { showToast('未找到文档模板'); return; }

                // 不打开编辑窗口：优先用保存的富文本 HTML，否则按纯文本渲染到游离容器
                var holder = document.createElement('div');
                if (item.remarkHtml && String(item.remarkHtml).replace(/<[^>]*>/g, '').trim()) {
                    holder.innerHTML = item.remarkHtml;
                } else {
                    holder.innerHTML = _wsumFormatToHtml(text);
                }
                var paras = [];
                paras.push({ align: 'center', indent: '0', lineHeight: '1.8', runs: [{ text: '周工作梳理总结', font: '方正小标宋简体', size: 40, bold: false }] });
                paras.push({ align: 'center', indent: '0', lineHeight: '1.8', runs: [{ text: '（' + _wsumWeekRangeText(dateKey) + '）', font: '楷体_GB2312', size: 32, bold: false }] });
                paras.push({ align: 'center', indent: '0', lineHeight: '1.8', runs: [] });
                var body = _wsumDocxParagraphs(holder);
                for (var bi = 0; bi < body.length; bi++) paras.push(body[bi]);

                var xml = tpl.replace('__DOC_BODY__', buildDocBodyXml(paras));
                var now = new Date();
                var ts = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
                var fileName = (ts + ' 周工作梳理总结（' + _wsumWeekRangeText(dateKey) + '）.docx').replace(/[\\\/:*?"<>|]/g, '_');
                await _notepadExportBlobWithPicker(new Blob([xml], { type: 'application/msword' }), fileName, 'application/msword', '.docx');
                showToast('已导出文档：周工作梳理总结');
            } catch (e) {
                showToast('导出失败：' + (e && e.message ? e.message : e));
            }
        }
        window.exportWeekSummaryDocx = exportWeekSummaryDocx;

        function _wsumFormatToHtml(text) {
            var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
            var out = '';
            for (var i = 0; i < lines.length; i++) {
                var t = lines[i];
                if (!t) { out += '<p><br></p>'; continue; }
                var cls = _weekSummaryClassifyLine(t);
                var lv = cls === 'wsum-l1' ? 'level-1' : (cls === 'wsum-l2' ? 'level-2' : 'level-body');
                out += _wsumParagraphHtml(t, lv);
            }
            return out || '<p><br></p>';
        }

        // 段落内联 HTML（完全照笔记规则）：
        //   正文 → 整段交给 _formatBodyWithRemarks，括号注释自动转注释格式
        //   标题 → 首句作标题，其后转正文；若整段只有一句且以句末标点结尾，补一个空正文 span 承接后续输入
        function _wsumInnerHtml(text, lv) {
            var esc = (typeof escapeHtml === 'function') ? escapeHtml : function(s) {
                return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            };
            var bodyInline = '';
            try {
                if (window.FORMAT_STANDARD && FORMAT_STANDARD.inlineStyle) bodyInline = FORMAT_STANDARD.inlineStyle('level-body');
            } catch (e) { bodyInline = ''; }
            if (lv === 'level-body') {
                if (typeof _formatBodyWithRemarks === 'function') return _formatBodyWithRemarks(text);
                return '<span style="' + bodyInline + '">' + esc(text) + '</span>';
            }
            var inline = '';
            try {
                if (window.FORMAT_STANDARD && FORMAT_STANDARD.inlineStyle) inline = FORMAT_STANDARD.inlineStyle(lv);
            } catch (e) { inline = ''; }
            var split = (typeof extractFirstSentence === 'function') ? extractFirstSentence(text) : { sentence: text, rest: '' };
            var html = '<span style="' + inline + '">' + esc(split.sentence) + '</span>';
            if (split.rest) {
                if (typeof _plainBodySpan === 'function') html += _plainBodySpan(split.rest);
                else html += '<span style="' + bodyInline + '">' + esc(split.rest) + '</span>';
            } else if (/[。！；]$/.test(split.sentence)) {
                html += '<span data-wsum-body="1" style="' + bodyInline + '"></span>';
            }
            return html;
        }

        function _wsumParagraphHtml(text, lv) {
            var style = '';
            try {
                if (window.FORMAT_STANDARD && FORMAT_STANDARD.fullStyle) style = FORMAT_STANDARD.fullStyle(lv);
            } catch (e) { style = ''; }
            var attr = style ? ' style="' + style + '"' : '';
            var outline = (lv === 'level-1') ? ' data-outline-level="2"' : '';
            return '<p' + attr + outline + ' data-level="' + lv + '">' + _wsumInnerHtml(text, lv) + '</p>';
        }

        // ===== 周工作总结编辑窗口（复用笔记模块整窗：工具栏 + 编辑区） =====
        var _weekSummaryEditorState = null;

        // 总结窗口专用的轻量分层：只按行首序号升级，绝不把已有标题降级
        function _wsumClassifyText(t) {
            var s = String(t || '').replace(/^[\s\u3000]+/, '');
            if (!s) return '';
            if (/^[一二三四五六七八九十]+\s*[、.．]/.test(s)) return 'level-1';
            if (/^\d+\s*[、.．]/.test(s)) return 'level-2';
            if (/^[（(][一二三四五六七八九十\d]+[）)]/.test(s)) return 'level-3';
            return '';
        }

        function _wsumApplyLevel(p, lv, keepCaret) {
            if (!p || !p.setAttribute) return;
            var caret = -1;
            if (keepCaret) {
                var sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    var r = sel.getRangeAt(0);
                    if (p.contains(r.startContainer)) caret = _weekSummaryCaretOffset(p, r);
                }
            }
            var text = (p.innerText || p.textContent || '').replace(/\u00a0/g, ' ').replace(/\r?\n+/g, ' ');
            var style = '', inline = '';
            try {
                if (window.FORMAT_STANDARD) {
                    if (FORMAT_STANDARD.fullStyle) style = FORMAT_STANDARD.fullStyle(lv);
                    if (FORMAT_STANDARD.inlineStyle) inline = FORMAT_STANDARD.inlineStyle(lv);
                }
            } catch (e) {}
            p.setAttribute('data-level', lv);
            if (style) p.setAttribute('style', style); else p.removeAttribute('style');
            if (lv === 'level-1') p.setAttribute('data-outline-level', '2');
            else p.removeAttribute('data-outline-level');
            p.innerHTML = _wsumInnerHtml(text, lv);
            if (caret >= 0) _weekSummarySetCaretOffset(p, caret);
        }

        function _wsumCaretParagraph(editor) {
            var sel = window.getSelection();
            if (!sel || !sel.rangeCount) return null;
            var node = sel.anchorNode;
            if (!node) return null;
            if (node.nodeType === 3) node = node.parentNode;
            while (node && node !== editor && node.tagName !== 'P' && node.tagName !== 'DIV') node = node.parentNode;
            if (!node || node === editor) return null;
            return node;
        }

        function _wsumLiveClassify(editor) {
            var p = _wsumCaretParagraph(editor);
            if (!p) return;
            var text = (p.textContent || '').replace(/\u00a0/g, ' ');
            var cur = p.getAttribute('data-level') || '';
            if (!text.replace(/[\s\u3000]/g, '')) {
                if (cur && cur !== 'level-body') _wsumApplyLevel(p, 'level-body', true);
                return;
            }
            var want = _wsumClassifyText(text);
            if (!want) return;
            if (cur === want) return;
            if (cur && cur !== 'level-body') return;
            _wsumApplyLevel(p, want, true);
        }

        // 段落内联重排：按当前层级重新生成 HTML（首句标题 + 其余正文、括号转注释），保持光标
        function _wsumRestyleParagraph(p) {
            if (!p || !p.setAttribute) return;
            var lv = p.getAttribute('data-level') || 'level-body';
            var caret = -1;
            var sel = window.getSelection();
            if (sel && sel.rangeCount) {
                var r = sel.getRangeAt(0);
                if (p.contains(r.startContainer)) caret = _weekSummaryCaretOffset(p, r);
            }
            var text = (p.innerText || p.textContent || '').replace(/\u00a0/g, ' ').replace(/\r?\n+/g, ' ');
            var html = _wsumInnerHtml(text, lv);
            if (p.innerHTML === html) return;
            p.innerHTML = html;
            if (caret >= 0) _weekSummarySetCaretOffset(p, caret);
        }

        // 回车拆分：自己拆段，光标位置之后的内容整体搬到新段；新段一律视为正文（level-body），
        // 用户键入后再由 _wsumLiveClassify 按行首序号升层级。
        function _wsumSplitParagraph(editor) {
            var p = _wsumCaretParagraph(editor);
            if (!p) return false;
            var sel = window.getSelection();
            if (!sel || !sel.rangeCount) return false;
            var range = sel.getRangeAt(0);
            if (!p.contains(range.startContainer)) return false;
            var full = (p.textContent || '').replace(/\u00a0/g, ' ');
            var offset = _weekSummaryCaretOffset(p, range);
            if (offset < 0) offset = 0;
            if (offset > full.length) offset = full.length;
            var before = full.substring(0, offset);
            var after = full.substring(offset);
            var lv = p.getAttribute('data-level') || 'level-body';

            var np = document.createElement('p');
            np.innerHTML = '<br>';
            p.parentNode.insertBefore(np, p.nextSibling);

            // 原段只保留光标前的内容：_wsumApplyLevel 会重新读取 p 的文本，所以必须先把 DOM 剪裁到 before
            p.innerHTML = _wsumInnerHtml(before, before ? lv : 'level-body');
            _wsumApplyLevel(p, before ? lv : 'level-body', false);

            // 光标后的内容进入新段，固定按正文渲染；没有后续内容时新段也必须是正文空段
            np.setAttribute('data-level', 'level-body');
            var style = '';
            try {
                if (window.FORMAT_STANDARD && FORMAT_STANDARD.fullStyle) style = FORMAT_STANDARD.fullStyle('level-body');
            } catch (e) { style = ''; }
            if (style) np.setAttribute('style', style); else np.removeAttribute('style');
            np.removeAttribute('data-outline-level');
            np.innerHTML = after ? _wsumInnerHtml(after, 'level-body') : '<br>';

            // 光标落到新段开头
            var r = document.createRange();
            var walker = document.createTreeWalker(np, NodeFilter.SHOW_TEXT, null, false);
            var firstText = walker.nextNode();
            if (firstText) {
                r.setStart(firstText, 0);
            } else {
                r.setStart(np, 0);
            }
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            return true;
        }

        // 编辑窗里的预览浮层：第1部分总结（带格式）+ 蓝色渐变分界 + 第2部分周工作明细
        // 总结为空时整段（含分界线）都不输出
        function _wsumBuildWeekPreviewHtml(dateKey, origIndex) {
            var item = reportData[dateKey] && reportData[dateKey][origIndex];
            if (!item) return '';
            var html = '<div class="wsumPrevSummary">';
            var sumText = _weeklySummaryText(item.remark);
            var savedHtml = String(item.remarkHtml || '');
            var savedText = savedHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\u00a0/g, ' ').trim();
            var hasSum = !!(savedText || (sumText && sumText.replace(/[\s\u3000]/g, '')));
            if (hasSum) {
                html += '<div class="wsumPrevSumBody">' +
                    (savedHtml && savedText ? savedHtml : _wsumFormatToHtml(sumText)) +
                    '</div>';
                html += '<div class="wsumPrevDivider"></div>';
            }
            html += '<div class="wsumPrevDetail">' + _wsumWeekDetailHtml(dateKey, origIndex) + '</div>';
            html += '</div>';
            return html;
        }

        // 第2部分：本条周工作的具体信息（时间、状态、内容、所属周期）
        function _wsumWeekDetailHtml(dateKey, origIndex) {
            var item = reportData[dateKey] && reportData[dateKey][origIndex];
            if (!item) return '';
            var timeText = formatLogTimePageEntryDisplay(item.startTime || '', item.endTime || '');
            var statusText = getStatusText(item.status);
            var out = '';
            out += '<div class="wsumPrevMeta">' +
                '<span class="wsumPrevTag">周工作</span>' +
                '<span class="wsumPrevTime">' + escapeHtml(timeText || '') + '</span>' +
                '<span class="wsumPrevStatus status-' + escapeHtml(item.status || 'normal') + '">' + escapeHtml(statusText || '') + '</span>' +
                '</div>';
            out += '<div class="wsumPrevRange">所属周期：' + escapeHtml(_wsumWeekRangeText(dateKey)) + '</div>';
            var content = String(item.content || '').replace(/\r\n/g, '\n');
            if (content) {
                var lines = content.split('\n');
                out += '<div class="wsumPrevContent">';
                for (var i = 0; i < lines.length; i++) {
                    if (!lines[i]) continue;
                    out += '<div class="wsumPrevLine">' + escapeHtml(lines[i]) + '</div>';
                }
                out += '</div>';
            } else {
                out += '<div class="wsumPrevContent wsumPrevEmpty">（本周没有填写具体工作内容）</div>';
            }
            return out;
        }
        window._wsumBuildWeekPreviewHtml = _wsumBuildWeekPreviewHtml;

        // 把笔记面板整体搬进总结窗口，关闭时原样搬回并还原内容
        function _wsumEmbedNotepad(host) {
            var panel = document.getElementById('notepadPanel');
            if (!panel || !host) return null;
            var ed = document.getElementById('notepadEditor');
            var info = {
                panel: panel,
                parent: panel.parentNode,
                next: panel.nextSibling,
                cssText: panel.style.cssText,
                cls: panel.className,
                editor: ed,
                editorHtml: ed ? ed.innerHTML : '',
                editorCls: ed ? ed.className : '',
                editorFontSize: ed ? ed.style.fontSize : '',
                editorScroll: ed ? ed.scrollTop : 0,
                autoFormat: !!S._autoFormatEnabled
            };
            panel.classList.add('wsumEmbedded', 'show');
            panel.style.cssText = '';
            host.appendChild(panel);
            window._wsumEditorActive = true;
            try { document.body.classList.add('wsum-editing'); } catch (e) {}
            return info;
        }

        function _wsumRestoreNotepad(info) {
            window._wsumEditorActive = false;
            try { document.body.classList.remove('wsum-editing'); } catch (e) {}
            if (!info) return;
            var panel = info.panel;
            try {
                if (info.parent) {
                    if (info.next && info.next.parentNode === info.parent) info.parent.insertBefore(panel, info.next);
                    else info.parent.appendChild(panel);
                }
                panel.classList.remove('wsumEmbedded');
                panel.className = info.cls;
                panel.style.cssText = info.cssText;
            } catch (e) {}
            if (info.editor) {
                try {
                    info.editor.className = info.editorCls || 'notepadEditor bg0';
                    info.editor.style.fontSize = info.editorFontSize || '';
                    info.editor.innerHTML = info.editorHtml || '';
                    info.editor.scrollTop = info.editorScroll || 0;
                } catch (e) {}
            }
            try { if (typeof _setNotepadAutoFormatEnabled === 'function') _setNotepadAutoFormatEnabled(info.autoFormat, true); } catch (e) {}
            try { if (typeof _npEditorResetUndoHistory === 'function') _npEditorResetUndoHistory(); } catch (e) {}
        }

        // 从复用编辑器收集纯文本（按段落一行，忽略文章分隔条）
        function _wsumCollectText(editor) {
            if (!editor) return '';
            var out = [];
            var nodes = editor.children || [];
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (n.nodeType !== 1) continue;
                if (n.classList && n.classList.contains('np-article-separator')) continue;
                var t = (n.innerText || n.textContent || '').replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n');
                t = t.replace(/[\r\n]+/g, '');
                out.push(t);
            }
            while (out.length && !out[out.length - 1]) out.pop();
            while (out.length && !out[0]) out.shift();
            return out.join('\n');
        }

        function _weekSummaryEditorParagraphs(root) {
            var out = [];
            for (var i = 0; i < root.children.length; i++) {
                var node = root.children[i];
                if (node.nodeType === 1) out.push(node);
            }
            return out;
        }

        function _weekSummaryApplyLineClass(p) {
            if (!p || !p.getAttribute) return;
            var cls = _weekSummaryClassifyLine(p.textContent || '');
            p.classList.remove('wsum-l1', 'wsum-l2');
            if (cls) p.classList.add(cls);
            p.setAttribute('data-wsum-level', cls === 'wsum-l1' ? '1' : (cls === 'wsum-l2' ? '2' : '0'));
        }

        // 按当前文字重建段落内部 HTML（二级标题句号后转正文），并尽量保持光标位置
        function _weekSummaryRefreshParagraph(p, keepCaret) {
            if (!p || !p.getAttribute) return;
            var manual = p.getAttribute('data-wsum-manual') === '1';
            var cls;
            if (manual) {
                var lv = p.getAttribute('data-wsum-level') || '0';
                cls = lv === '1' ? 'wsum-l1' : (lv === '2' ? 'wsum-l2' : '');
            } else {
                cls = _weekSummaryClassifyLine(p.textContent || '');
            }
            var wasL1 = p.classList.contains('wsum-l1');
            var wasL2 = p.classList.contains('wsum-l2');
            p.classList.remove('wsum-l1', 'wsum-l2');
            if (cls) p.classList.add(cls);
            if (!manual) p.setAttribute('data-wsum-level', cls === 'wsum-l1' ? '1' : (cls === 'wsum-l2' ? '2' : '0'));
            if (wasL1 === (cls === 'wsum-l1') && wasL2 === (cls === 'wsum-l2') && p.getAttribute('data-wsum-rendered') === '1') {
                return;
            }
            var plain = (p.textContent || '').replace(/\u00a0/g, ' ');
            var caret = -1;
            if (keepCaret) {
                var sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    var r = sel.getRangeAt(0);
                    if (p.contains(r.startContainer)) caret = _weekSummaryCaretOffset(p, r);
                }
            }
            var next = _weekSummaryRenderParagraphHtml(plain, cls);
            if (p.innerHTML !== next) p.innerHTML = next;
            p.setAttribute('data-wsum-rendered', '1');
            if (caret >= 0) _weekSummarySetCaretOffset(p, caret);
        }

        function _weekSummaryNormalizeAll(root) {
            var ps = _weekSummaryEditorParagraphs(root);
            if (!ps.length) {
                var p0 = document.createElement('p');
                p0.setAttribute('data-wsum-p', '1');
                p0.innerHTML = '<br>';
                root.appendChild(p0);
                ps = [p0];
            }
            for (var i = 0; i < ps.length; i++) {
                if (!ps[i].hasAttribute('data-wsum-p')) ps[i].setAttribute('data-wsum-p', '1');
                _weekSummaryRefreshParagraph(ps[i], false);
            }
        }

        function _weekSummaryCaretParagraph(root) {
            var sel = window.getSelection();
            if (!sel || !sel.rangeCount) return null;
            var node = sel.anchorNode;
            if (!node) return null;
            if (node.nodeType === 3) node = node.parentNode;
            while (node && node !== root) {
                if (node.parentNode === root) return node;
                node = node.parentNode;
            }
            return null;
        }

        function _weekSummaryEditorText(root) {
            var ps = _weekSummaryEditorParagraphs(root);
            var lines = [];
            for (var i = 0; i < ps.length; i++) {
                var t = (ps[i].innerText || ps[i].textContent || '').replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n');
                lines.push(t.replace(/\n+$/, ''));
            }
            return lines.join('\n').replace(/^\n+|\n+$/g, '');
        }

        // 选中内容右键设置层级
        function _weekSummaryShowLevelMenu(e, root) {
            e.preventDefault();
            e.stopPropagation();
            var old = document.querySelector('.wsumLevelMenu');
            if (old) old.remove();
            var sel = window.getSelection();
            var hasSel = sel && !sel.isCollapsed && sel.rangeCount > 0;
            if (!hasSel) return;
            var menu = document.createElement('div');
            menu.className = 'wsumLevelMenu';
            var items = [
                { key: '1', label: '一级标题（一、二、三…）' },
                { key: '2', label: '二级标题（1. 2. 3.…）' },
                { key: '0', label: '正文（首行缩进）' },
                { key: 'auto', label: '恢复自动识别' }
            ];
            for (var i = 0; i < items.length; i++) {
                var d = document.createElement('div');
                d.className = 'wsumLevelItem';
                d.setAttribute('data-level', items[i].key);
                d.textContent = items[i].label;
                menu.appendChild(d);
            }
            document.body.appendChild(menu);
            var zoom = parseFloat(DataLayer.getRaw('mainZoom') || '1');
            if (!isFinite(zoom) || zoom <= 0) zoom = 1;
            var left = e.clientX, top = e.clientY;
            if (left + menu.offsetWidth > window.innerWidth - 4) left = window.innerWidth - menu.offsetWidth - 4;
            if (top + menu.offsetHeight > window.innerHeight - 4) top = window.innerHeight - menu.offsetHeight - 4;
            menu.style.left = Math.round(Math.max(4, left) / zoom) + 'px';
            menu.style.top = Math.round(Math.max(4, top) / zoom) + 'px';
            menu.style.zoom = zoom;

            menu.addEventListener('mousedown', function(ev) { ev.preventDefault(); ev.stopPropagation(); });
            menu.addEventListener('click', function(ev) {
                var it = ev.target.closest('.wsumLevelItem');
                if (!it) return;
                var lv = it.getAttribute('data-level');
                var range = sel.getRangeAt(0);
                var ps = _weekSummaryEditorParagraphs(root);
                for (var i = 0; i < ps.length; i++) {
                    var p = ps[i];
                    if (!range.intersectsNode(p)) continue;
                    if (lv === 'auto') {
                        p.removeAttribute('data-wsum-manual');
                        p.removeAttribute('data-wsum-rendered');
                        _weekSummaryRefreshParagraph(p, false);
                        continue;
                    }
                    p.classList.remove('wsum-l1', 'wsum-l2');
                    if (lv === '1') p.classList.add('wsum-l1');
                    else if (lv === '2') p.classList.add('wsum-l2');
                    p.setAttribute('data-wsum-level', lv);
                    p.setAttribute('data-wsum-manual', '1');
                    p.setAttribute('data-wsum-rendered', '1');
                    var plain = (p.innerText || p.textContent || '').replace(/\u00a0/g, ' ').replace(/\r?\n+/g, ' ');
                    p.innerHTML = lv === '2' ? _weekSummaryRenderParagraphHtml(plain, 'wsum-l2') : escapeHtml(plain);
                }
                menu.remove();
            });
            setTimeout(function() {
                document.addEventListener('mousedown', function _lmClose(ev) {
                    if (!menu.contains(ev.target)) {
                        menu.remove();
                        document.removeEventListener('mousedown', _lmClose, true);
                    }
                }, true);
            }, 0);
        }

        function closeWeekSummaryEditor(save) {
            var st = _weekSummaryEditorState;
            if (!st) return;
            if (save) {
                var text = _wsumCollectText(st.editor);
                var item = reportData[st.dateKey] && reportData[st.dateKey][st.origIndex];
                if (item) {
                    item.remark = text;
                    // 连格式一起保存：下次打开直接用这份 HTML 还原，不再重新自动格式
                    try {
                        item.remarkHtml = (st.editor && st.editor.innerHTML) ? st.editor.innerHTML : '';
                    } catch (e) { item.remarkHtml = ''; }
                    _saveReportToCache();
                    renderTrackContent();
                    updateFooterTimestamp();
                    showToast(text ? '总结已保存' : '总结已清空');
                }
            }
            _wsumRestoreNotepad(st.npInfo);
            if (st.el && st.el.parentNode) st.el.parentNode.removeChild(st.el);
            if (st.menu && st.menu.parentNode) st.menu.parentNode.removeChild(st.menu);
            if (st.cleanup) {
                for (var i = 0; i < st.cleanup.length; i++) {
                    try { st.cleanup[i](); } catch (e) {}
                }
            }
            try { _wsumCloseWeekPane(); } catch (e) {}
            _weekSummaryEditorState = null;
        }
        window.closeWeekSummaryEditor = closeWeekSummaryEditor;

        // ===== 周总结编辑窗左侧「周工作」并排小窗（只读预览，可任意前后翻周） =====
        var _wsumWeekState = null;

        function _wsumWeekMonday(d) {
            var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            var day = x.getDay();
            var diff = day === 0 ? -6 : 1 - day;
            x.setDate(x.getDate() + diff);
            return x;
        }

        function _wsumWeekRangeLabel(monday) {
            var sun = new Date(monday);
            sun.setDate(monday.getDate() + 6);
            return monday.getFullYear() + '年' + (monday.getMonth() + 1) + '月' + monday.getDate() + '日至' +
                (sun.getFullYear() !== monday.getFullYear() ? sun.getFullYear() + '年' : '') +
                (sun.getMonth() + 1) + '月' + sun.getDate() + '日';
        }

        // 找出某周（周一~周日）内所有周工作记录，按开始时间排序
        function _wsumFindWeekItems(monday) {
            var sun = new Date(monday);
            sun.setDate(monday.getDate() + 6);
            sun.setHours(23, 59, 59, 999);
            var start0 = new Date(monday); start0.setHours(0, 0, 0, 0);
            var out = [];
            for (var key in reportData) {
                var arr = reportData[key];
                if (!Array.isArray(arr)) continue;
                var yh = _yearFromKey(key);
                for (var j = 0; j < arr.length; j++) {
                    var it = arr[j];
                    if (!it || !it.category) continue;
                    if (it.category.indexOf('周') === -1 || it.category.indexOf('工作') === -1) continue;
                    var d = parseTimeStrToDate(it.startTime, yh);
                    if (!d) continue;
                    if (d >= start0 && d <= sun) out.push({ item: it, dateKey: key, origIndex: j, date: d });
                }
            }
            out.sort(function(a, b) { return a.date - b.date; });
            return out;
        }

        function _wsumCloseWeekPane() {
            if (_wsumWeekState) {
                var _pe = _wsumWeekState.el;
                if (_pe) {
                    try { if (_pe._wsumResizeCleanup) _pe._wsumResizeCleanup(); } catch (e) {}
                    if (_pe.parentNode) _pe.parentNode.removeChild(_pe);
                }
                _wsumWeekState = null;
            }
            var box = _weekSummaryEditorState && _weekSummaryEditorState.el;
            if (box) {
                var btn = box.querySelector('.wsumBtn.weekwork');
                if (btn) btn.classList.remove('active');
            }
            _wsumLayoutWeekPane();
        }

        function _wsumRenderWeekPane() {
            var st = _wsumWeekState;
            if (!st || !st.el) return;
            var monday = st.monday;
            var list = _wsumFindWeekItems(monday);
            st.titleEl.textContent = _wsumWeekRangeLabel(monday) + '（' + (st.offsetWeeks < 0 ? '上周' : '下周') + '）';
            if (!list.length) {
                st.bodyEl.innerHTML = '<div class="wsumWeekEmpty">该周没有周工作记录</div>';
                return;
            }
            var html = '';
            for (var i = 0; i < list.length; i++) {
                html += _wsumBuildWeekPreviewHtml(list[i].dateKey, list[i].origIndex);
                if (i < list.length - 1) html += '<div class="wsumWeekItemGap"></div>';
            }
            st.bodyEl.innerHTML = html;
            st.bodyEl.scrollTop = 0;
        }

        // 只在上周(-1)与下周(+1)之间切换，箭头方向即目标周
        function _wsumShiftWeek(dir) {
            var st = _wsumWeekState;
            if (!st) return;
            st.offsetWeeks = dir < 0 ? -1 : 1;
            var m = new Date(st.baseMonday);
            m.setDate(m.getDate() + st.offsetWeeks * 7);
            st.monday = m;
            _wsumRenderWeekPane();
        }
        window._wsumShiftWeek = _wsumShiftWeek;

        // 按时间收集所有周工作条目，供「其他周」前后切换
        function _wsumCollectWeekEntries() {
            var out = [];
            for (var key in reportData) {
                var arr = reportData[key];
                if (!Array.isArray(arr)) continue;
                var yh = _yearFromKey(key);
                for (var j = 0; j < arr.length; j++) {
                    var it = arr[j];
                    if (!it || !it.category) continue;
                    if (it.category.indexOf('周') === -1 || it.category.indexOf('工作') === -1) continue;
                    var d = parseTimeStrToDate(it.startTime, yh);
                    out.push({ item: it, dateKey: key, origIndex: j, category: it.category, date: d ? d.getTime() : 0 });
                }
            }
            out.sort(function(a, b) { return a.date - b.date; });
            return out;
        }
        window._wsumCollectWeekEntries = _wsumCollectWeekEntries;

        // 预览窗贴到主窗左侧：高度与主窗一致（文字大小一致），
        // 宽度默认为主窗的一半，可由用户拖动边框自行调节。
        // 左侧放不下时先把主窗右移；主窗已贴右仍放不下则改为贴主窗右侧。
        function _wsumLayoutWeekPane() {
            var st = _wsumWeekState;
            var box = _weekSummaryEditorState && _weekSummaryEditorState.el;
            if (!st || !st.el || !box) return;
            var zoom = parseFloat(box.style.zoom) || parseFloat(DataLayer.getRaw('mainZoom') || '1') || 1;
            var viewW = window.innerWidth / zoom;
            var viewH = window.innerHeight / zoom;
            var bw = box.offsetWidth, bh = box.offsetHeight;
            var bx = parseFloat(box.style.left) || 0, by = parseFloat(box.style.top) || 0;
            var paneW = st.userWidth || Math.round(bw / 2);
            st.paneWidth = paneW;
            st.el.style.width = paneW + 'px';
            st.el.style.height = bh + 'px';
            st.el.style.zoom = zoom;
            var gap = 12;
            var needLeft = paneW + gap;
            if (bx < needLeft) {
                var shiftable = Math.min(needLeft - bx, Math.max(0, viewW - (bx + bw)));
                bx += shiftable;
                box.style.left = Math.round(bx) + 'px';
            }
            var leftCss = bx - needLeft;
            if (leftCss < 0) {
                leftCss = bx + bw + gap;
                var maxLeft = viewW - paneW - 4;
                if (leftCss > maxLeft) leftCss = Math.max(4, maxLeft);
            }
            var topCss = by;
            if (topCss + bh > viewH - 4) topCss = Math.max(4, viewH - bh - 4);
            if (topCss < 4) topCss = 4;
            st.el.style.left = Math.round(leftCss) + 'px';
            st.el.style.top = Math.round(topCss) + 'px';
        }

        function _wsumToggleWeekPane() {
            if (_wsumWeekState) { _wsumCloseWeekPane(); return; }
            var st0 = _weekSummaryEditorState;
            if (!st0) return;
            _wsumOpenWeekPane(st0.dateKey, st0.origIndex);
        }

        // 创建「上周 / 下周」预览窗：打开即上周，箭头可切到下周（只在两周之间）
        function _wsumOpenWeekPane(dateKey, origIndex) {
            var box = _weekSummaryEditorState && _weekSummaryEditorState.el;
            if (!box) return;
            if (_wsumWeekState) {
                if (_wsumWeekState.el && _wsumWeekState.el.parentNode) _wsumWeekState.el.parentNode.removeChild(_wsumWeekState.el);
                _wsumWeekState = null;
            }
            var item = reportData[dateKey] && reportData[dateKey][origIndex];
            var baseDate = new Date();
            if (item) {
                var d = parseTimeStrToDate(item.startTime, _yearFromKey(dateKey));
                if (d) baseDate = d;
            }
            var baseMonday = _wsumWeekMonday(baseDate);
            var el = document.createElement('div');
            el.className = 'wsumWeekPane';
            el.innerHTML =
                '<div class="wsumWeekHead">' +
                    '<span class="wsumWeekTitle"></span>' +
                    '<span class="wsumWeekArrow" data-dir="-1" title="上周">‹</span>' +
                    '<span class="wsumWeekArrow" data-dir="1" title="下周">›</span>' +
                    '<span class="wsumWeekClose" title="关闭">×</span>' +
                '</div>' +
                '<div class="wsumWeekBody"></div>' +
                '<div class="wsumWeekResizer" title="拖动调整宽度"></div>';
            document.body.appendChild(el);
            var mon = new Date(baseMonday);
            mon.setDate(mon.getDate() - 7);
            _wsumWeekState = {
                el: el,
                baseMonday: baseMonday,
                offsetWeeks: -1,
                monday: mon,
                userWidth: 0,
                paneWidth: 0,
                titleEl: el.querySelector('.wsumWeekTitle'),
                bodyEl: el.querySelector('.wsumWeekBody')
            };
            el.querySelectorAll('.wsumWeekArrow').forEach(function(a) {
                a.addEventListener('click', function() { _wsumShiftWeek(parseInt(a.getAttribute('data-dir'), 10) || 1); });
            });
            el.querySelector('.wsumWeekClose').addEventListener('click', function() { _wsumCloseWeekPane(); });
            var btn = box.querySelector('.wsumBtn.weekwork');
            if (btn) btn.classList.add('active');

            // 拖动右边框调节宽度
            (function() {
                var rz = el.querySelector('.wsumWeekResizer');
                var resizing = false, sx = 0, ow = 0;
                rz.addEventListener('mousedown', function(ev) {
                    resizing = true;
                    sx = ev.clientX;
                    ow = el.offsetWidth;
                    ev.preventDefault();
                    ev.stopPropagation();
                });
                var onMove = function(ev) {
                    if (!resizing) return;
                    var z = parseFloat(el.style.zoom) || 1;
                    var nw = Math.round(Math.max(220, Math.min(ow + (ev.clientX - sx) / z, window.innerWidth / z - 20)));
                    _wsumWeekState.userWidth = nw;
                    el.style.width = nw + 'px';
                    _wsumWeekState.paneWidth = nw;
                };
                var onUp = function() {
                    if (!resizing) return;
                    resizing = false;
                    // 松手后重新贴边（宽度变了，左侧空间可能不够）
                    _wsumLayoutWeekPane();
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
                el._wsumResizeCleanup = function() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
            })();

            _wsumRenderWeekPane();
            _wsumLayoutWeekPane();
        }
        window._wsumOpenWeekPane = _wsumOpenWeekPane;
        window._wsumToggleWeekPane = _wsumToggleWeekPane;
        window._wsumCloseWeekPane = _wsumCloseWeekPane;
        window._wsumLayoutWeekPane = _wsumLayoutWeekPane;

        function openWeekSummaryEditor(dateKey, origIndex) {
            var item = reportData[dateKey] && reportData[dateKey][origIndex];
            if (!item) return;
            closeWeekSummaryPopover();
            if (_weekSummaryEditorState && _weekSummaryEditorState.dateKey === dateKey && _weekSummaryEditorState.origIndex === origIndex) {
                // 再次双击同一条：把窗口提到最前
                _weekSummaryEditorState.el.style.zIndex = '10460';
                return;
            }
            closeWeekSummaryEditor(false);

            var headerText = (item.category || '周工作') + ' · 总结';
            var box = document.createElement('div');
            box.className = 'weekSummaryEditor';
            box.innerHTML =
                '<div class="wsumHead"><span class="wsumTitle"></span>' +
                    '<span class="wsumHeadBtn wsumCloseBtn" title="关闭（不保存）">×</span></div>' +
                '<div class="wsumBody"></div>' +
                '<div class="wsumFoot"><div class="wsumFootBtns">' +
                    '<button type="button" class="wsumBtn weekwork" title="查看上周 / 下周的周工作">上周</button>' +
                    '<button type="button" class="wsumBtn save">保存</button>' +
                    '<button type="button" class="wsumBtn cancel">关闭</button>' +
                '</div></div>' +
                '<div class="wsumResizer" title="拖动调整大小"></div>';
            box.querySelector('.wsumTitle').textContent = headerText;
            document.body.appendChild(box);

            var body = box.querySelector('.wsumBody');
            var npInfo = _wsumEmbedNotepad(body);
            var editor = document.getElementById('notepadEditor');
            var text = _weeklySummaryText(item.remark);
            if (editor) {
                editor.className = 'notepadEditor bg0 notebook-style';
                editor.style.fontSize = '';
                // 有保存过的富文本就原样还原（保留格式，不再重新自动格式）；否则按纯文本自动分层
                var savedHtml = String(item.remarkHtml || '');
                var savedText = savedHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\u00a0/g, ' ').trim();
                if (savedHtml && savedText) {
                    editor.innerHTML = savedHtml;
                } else {
                    editor.innerHTML = _wsumFormatToHtml(text);
                }
                try { if (typeof _refreshNotepadArticleSeparators === 'function') _refreshNotepadArticleSeparators(editor); } catch (e) {}
                try { if (typeof _npEditorResetUndoHistory === 'function') _npEditorResetUndoHistory(); } catch (e) {}
                // 关闭笔记的实时自动格式，改用总结窗口自己的“只升级不降级”分层，避免段首插入文字后标题被打回正文
                try { if (typeof _setNotepadAutoFormatEnabled === 'function') _setNotepadAutoFormatEnabled(false, true); } catch (e) {}
            }
            editor = editor || box.querySelector('.wsumBody');

            // 初始位置：放在被双击区域右侧，空间不足则左侧/居中；不覆盖整页（无遮罩）
            var rect = null;
            var entries = document.querySelectorAll('.pageViewSummary[data-datekey="' + dateKey + '"][data-origindex="' + origIndex + '"]');
            if (entries.length) rect = entries[0].getBoundingClientRect();
            var zoom = parseFloat(DataLayer.getRaw('mainZoom') || '1');
            if (!isFinite(zoom) || zoom <= 0) zoom = 1;
            var w = box.offsetWidth, h = box.offsetHeight;
            var left, top;
            if (rect) {
                left = rect.right + 12;
                if (left + w > window.innerWidth - 8) left = rect.left - w - 12;
                if (left < 8) left = Math.max(8, Math.round((window.innerWidth - w) / 2));
                top = rect.top - 10;
            } else {
                left = Math.max(8, Math.round((window.innerWidth - w) / 2));
                top = 80;
            }
            if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8);
            if (top < 8) top = 8;
            box.style.left = Math.round(left / zoom) + 'px';
            box.style.top = Math.round(top / zoom) + 'px';
            box.style.zoom = zoom;

            _weekSummaryEditorState = { el: box, editor: editor, npInfo: npInfo, dateKey: dateKey, origIndex: origIndex, cleanup: [] };

            // 拖动标题栏移动窗口
            (function() {
                var head = box.querySelector('.wsumHead');
                var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
                head.addEventListener('mousedown', function(ev) {
                    if (ev.target.closest('.wsumHeadBtn')) return;
                    dragging = true;
                    sx = ev.clientX; sy = ev.clientY;
                    ox = parseFloat(box.style.left) || 0;
                    oy = parseFloat(box.style.top) || 0;
                    ev.preventDefault();
                });
                var onMove = function(ev) {
                    if (!dragging) return;
                    var z = parseFloat(box.style.zoom) || 1;
                    var nx = ox + (ev.clientX - sx) / z;
                    var ny = oy + (ev.clientY - sy) / z;
                    box.style.left = Math.round(Math.max(-box.offsetWidth + 80, Math.min(nx, window.innerWidth / z - 60))) + 'px';
                    box.style.top = Math.round(Math.max(0, Math.min(ny, window.innerHeight / z - 30))) + 'px';
                    if (_wsumWeekState) _wsumLayoutWeekPane();
                };
                var onUp = function() { dragging = false; };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
                _weekSummaryEditorState.cleanup.push(function() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                });
            })();

            // 右下角缩放
            (function() {
                var rz = box.querySelector('.wsumResizer');
                var resizing = false, sx = 0, sy = 0, ow = 0, oh = 0;
                rz.addEventListener('mousedown', function(ev) {
                    resizing = true;
                    sx = ev.clientX; sy = ev.clientY;
                    ow = box.offsetWidth; oh = box.offsetHeight;
                    ev.preventDefault(); ev.stopPropagation();
                });
                var onMove = function(ev) {
                    if (!resizing) return;
                    var z = parseFloat(box.style.zoom) || 1;
                    box.style.width = Math.round(Math.max(380, ow + (ev.clientX - sx) / z)) + 'px';
                    box.style.height = Math.round(Math.max(260, oh + (ev.clientY - sy) / z)) + 'px';
                    if (_wsumWeekState) _wsumLayoutWeekPane();
                };
                var onUp = function() { resizing = false; };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
                _weekSummaryEditorState.cleanup.push(function() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                });
            })();

            // 回车直接换行并拆成新段（新段为正文）；输入时按行首序号升级；Esc 关闭
            // Shift+Enter 也走同一逻辑，避免浏览器插入无样式的 <br> 打乱段落格式
            var onKeyDown = function(ev) {
                if (ev.key === 'Escape') {
                    ev.preventDefault();
            closeWeekSummaryEditor(false);

                    return;
                }
                if (ev.key === 'Enter' && !ev.ctrlKey && !ev.altKey) {
                    if (ev.isComposing) return;
                    if (!editor) return;
                    if (_wsumSplitParagraph(editor)) {
                        ev.preventDefault();
                        ev.stopPropagation();
                    }
                }
            };
            box.addEventListener('keydown', onKeyDown, true);
            _weekSummaryEditorState.cleanup.push(function() { box.removeEventListener('keydown', onKeyDown, true); });

            var onInput = function(ev) {
                if (!editor || ev.isComposing) return;
                _wsumLiveClassify(editor);
                var data = ev.data || '';
                if (/[。！；）)]/.test(data)) _wsumRestyleParagraph(_wsumCaretParagraph(editor));
            };
            box.addEventListener('input', onInput);
            _weekSummaryEditorState.cleanup.push(function() { box.removeEventListener('input', onInput); });

            box.querySelector('.wsumCloseBtn').addEventListener('click', function() { closeWeekSummaryEditor(false); });
            box.querySelector('.wsumBtn.cancel').addEventListener('click', function() { closeWeekSummaryEditor(false); });
            box.querySelector('.wsumBtn.save').addEventListener('click', function() { closeWeekSummaryEditor(true); });
            box.querySelector('.wsumBtn.weekwork').addEventListener('click', function() { _wsumToggleWeekPane(); });

            setTimeout(function() {
                if (!editor) return;
                try { editor.focus(); } catch (e) {}
                var first = editor.querySelector('p');
                if (first) {
                    var r = document.createRange();
                    r.selectNodeContents(first);
                    r.collapse(false);
                    var s = window.getSelection();
                    s.removeAllRanges();
                    s.addRange(r);
                }
            }, 60);
        }
        window.openWeekSummaryEditor = openWeekSummaryEditor;

        // 复用页面视图的日志条目样式与交互，供主列表和右侧详情面板共用。
        function buildPageViewEntryHtml(entry, groupLen, badgeIndex, opts) {
            opts = opts || {};
            var isZhouGongZuo = entry.category && entry.category.indexOf('周') !== -1 && entry.category.indexOf('工作') !== -1;
            var dkEsc = escapeHtml(entry._dateKey || '').replace(/'/g, '&#39;');
            var oi = (entry._origIndex != null ? entry._origIndex : badgeIndex);
            var entryHtml = '';
            entryHtml += '<div class="pageViewEntry' + (isZhouGongZuo ? ' zhouGongZuoEntry' : '') + '" data-datekey="' + escapeHtml(entry._dateKey || '').replace(/"/g, '&quot;') + '" data-origindex="' + oi + '" onclick="event.stopPropagation();updatePageViewWeekNavHighlight(reportData[\'' + dkEsc + '\'][' + oi + '])" ondblclick="openEditModalByKey(\'' + escapeHtml(entry._dateKey || '') + '\',' + oi + ')" oncontextmenu="showPageViewEntryContextMenu(event,this)" style="cursor:pointer;">';
            if (entry.category) {
                var entryDateText = formatLogTimePageEntryDisplay(entry.startTime || '', entry.endTime || '');
                var entryStatusClass = 'status-' + (entry.status || 'normal');
                var badgeText = groupLen > 1 ? (badgeIndex + 1) : '';
                entryHtml += '<div class="pageViewTitle"><span class="pageViewEntryBadge ' + entryStatusClass + '">' + badgeText + '</span>' + highlightText(entry.category, searchKeyword) + '<span class="pageViewEntryDate">&nbsp;&nbsp;' + escapeHtml(entryDateText) + '</span><span class="pageViewEntryStatus ' + pageViewEntryStatusClass(entry.status) + '" title="修改事项状态" onclick="showPageViewEntryStatusMenu(event,\'' + dkEsc + '\',' + entry._origIndex + ')">' + pageViewEntryStatusSymbol(entry.status) + '</span></div>';
            }
            if (entry.content) {
                var contentLines = entry.content.split('\n');
                var subItems = parseSubItemContent(entry.content).items || [];
                for (var cli = 0; cli < contentLines.length; cli++) {
                    if (!contentLines[cli]) continue;
                    var subItem = null;
                    for (var subi = 0; subi < subItems.length; subi++) {
                        if (subItems[subi].lineIdx === cli) { subItem = subItems[subi]; break; }
                    }
                    if (subItem) {
                        var subHtml = pageViewSubItemHtml(contentLines[cli], subItem, entry._dateKey, entry._origIndex, subi, entry);
                        entryHtml += subHtml;
                    } else {
                        entryHtml += '<div class="pageViewContentLine">' + highlightText(contentLines[cli], searchKeyword) + '</div>';
                    }
                }
            }
            if (opts.showUnlinkedRow && isZhouGongZuo && opts.hasUnlinkedWeekLogs && !pageViewFilterDateKey) {
                entryHtml += '<div class="pageViewUnlinkedRow" title="查看未关联周工作分项的日志详情" onclick="event.stopPropagation();showWeekUnlinkedLogsDetail()"><span class="pageViewUnlinkedDot">…</span></div>';
            }
            // 周工作：“备注”即“总结”，单独成行；“总结”右侧一条实线，下面按编辑窗格式显示正文
            if (isZhouGongZuo && !pageViewFilterDateKey) {
                var _sumRaw = String(entry.remark || '').replace(/\r\n/g, '\n');
                if (/^\s*周工作[：:]\s*$/.test(_sumRaw)) _sumRaw = '';
                var _sumText = _sumRaw.replace(/^\n+|\n+$/g, '');
                entryHtml += '<div class="pageViewSummary" data-datekey="' + escapeHtml(entry._dateKey || '').replace(/"/g, '&quot;') + '" data-origindex="' + oi + '" title="单击查看全文，双击打开总结编辑窗口" onclick="event.stopPropagation();handleWeekSummaryClick(event,this)" ondblclick="event.stopPropagation();_weekSummaryCancelClick();openWeekSummaryEditor(\'' + dkEsc + '\',' + oi + ')">' +
                    '<div class="pageViewSummaryHead"><span class="pageViewSummaryLabel">总结</span>' +
                        '<button type="button" class="pageViewSummaryExport" title="把本周工作总结导出为 docx 文档" onclick="event.stopPropagation();event.preventDefault();exportWeekSummaryDocx(\'' + dkEsc + '\',' + oi + ')">导出文档</button></div>' +
                    (_sumText
                        ? '<div class="pageViewSummaryBody">' + _weekSummaryDisplayHtml(_sumText, searchKeyword) + '</div>'
                        : '<div class="pageViewSummaryEmpty">总结…</div>') +
                    '<span class="pageViewSummaryMore">…</span>' +
                    '</div>';
            }
            if (entry.remark && !pageViewFilterDateKey && !isZhouGongZuo) entryHtml += '<div class="pageViewRemark">' + highlightText(entry.remark, searchKeyword) + '</div>';
            if (entry.attachments && entry.attachments.length > 0) {
                entryHtml += '<div class="pageViewAttach">附件：';
                for (var ai = 0; ai < entry.attachments.length; ai++) {
                    var att = entry.attachments[ai];
                    var attPath = '', attName = '';
                    if (att && typeof att === 'object') {
                        attPath = att.path || '';
                        attName = att.name || '附件' + (ai + 1);
                    } else if (att) {
                        attPath = String(att);
                        attName = String(att);
                    }
                    if (attPath || attName) {
                        var attIcon = getAttachIconHtml(attPath, attName);
                        entryHtml += '<a class="pageViewAttachItem" href="javascript:void(0)" data-path="' + escapeHtml(attPath).replace(/"/g, '&quot;') + '" data-name="' + escapeHtml(attName).replace(/"/g, '&quot;') + '" onclick="openAttachmentFromEl(this)" title="点击打开：' + escapeHtml(attPath).replace(/"/g, '&quot;') + '">' + attIcon + highlightText(attName, searchKeyword) + '</a>';
                    }
                    if (ai < entry.attachments.length - 1) entryHtml += '；';
                }
                entryHtml += '</div>';
            }
            if (entry.attachments && entry.attachments.length > 0) {
                entryHtml = entryHtml.replace('class="pageViewAttach"', 'class="pageViewAttach pageViewLastLine"');
            } else if (isZhouGongZuo && !pageViewFilterDateKey) {
                entryHtml = entryHtml.replace('class="pageViewSummary"', 'class="pageViewSummary pageViewLastLine"');
            } else if (entry.remark && !pageViewFilterDateKey) {
                entryHtml = entryHtml.replace('class="pageViewRemark"', 'class="pageViewRemark pageViewLastLine"');
            } else if (entry.content) {
                var lastLinePos = entryHtml.lastIndexOf('class="pageViewContentLine');
                if (lastLinePos >= 0) {
                    var lastClassEnd = entryHtml.indexOf('"', lastLinePos + 7);
                    if (lastClassEnd >= 0) entryHtml = entryHtml.substring(0, lastClassEnd) + ' pageViewLastLine' + entryHtml.substring(lastClassEnd);
                }
            } else if (entry.category) {
                entryHtml = entryHtml.replace('class="pageViewTitle"', 'class="pageViewTitle pageViewLastLine"');
            }
            entryHtml += '</div>';
            return entryHtml;
        }

        function renderPageView(container) {
            var allData = [];
            var addedIds = new Set();
            var targetDate = timeRangeType === 'day' ? timeRangeStart : null;
            for (var key in reportData) {
                var data = reportData[key];
                var yh = _yearFromKey(key);
                for (var j = 0; j < data.length; j++) {
                    var item = data[j];
                    if (!item || (!item.category && !item.content)) continue;
                    // 内容为空的普通日志不允许出现在列表中（正在编辑的占位除外）
                    if (_logRecordEmpty(item)) continue;
                    var inRange = _showAllRecords || (targetDate
                        ? dateRangeContains(item.startTime, item.endTime, targetDate, yh)
                        : isItemInTimeRange(item.startTime, item.endTime, yh));
                    if (inRange) {
                        var itemKey = key + '_' + j;
                        if (!addedIds.has(itemKey)) {
                            item._dateKey = key;
                            item._origIndex = j;
                            item._staged = false;
                            allData.push(item);
                            addedIds.add(itemKey);
                        }
                    }
                }
            }
            if (!_showAllRecords) {
                for (var sk in _stagedLogKeys) {
                    var parts = sk.split('::');
                    var sDateKey = parts[0];
                    var sOrigIndex = parseInt(parts[1]);
                    var sItem = reportData[sDateKey] && reportData[sDateKey][sOrigIndex];
                    if (sItem && _logRecordEmpty(sItem)) { delete _stagedLogKeys[sk]; continue; }
                    if (sItem && !addedIds.has(sk)) {
                        sItem._dateKey = sDateKey;
                        sItem._origIndex = sOrigIndex;
                        sItem._staged = true;
                        allData.push(sItem);
                    }
                }
            }
            if (pageViewFilterDateKey) {
                var filteredByDate = [];
                for (var fi = 0; fi < allData.length; fi++) {
                    var filteredItem = pageViewFilterItemByDate(allData[fi], allData[fi]._dateKey);
                    if (filteredItem) filteredByDate.push(filteredItem);
                }
                allData = filteredByDate;
                allData.sort(function(a, b) {
                    var rankA = typeof a._pageViewFilterRank === 'number' ? a._pageViewFilterRank : 2;
                    var rankB = typeof b._pageViewFilterRank === 'number' ? b._pageViewFilterRank : 2;
                    if (rankA !== rankB) return rankA - rankB;
                    return (a._origIndex || 0) - (b._origIndex || 0);
                });
            }
            if (searchKeyword) allData = allData.filter(function(row) { return rowMatchesSearch(row); });
             var hasUnlinkedWeekLogs = (timeRangeType === 'week') && _collectUnlinkedWeekLogs().length > 0;
             var html = '<div class="pageViewContainer" onclick="clearPageViewWeekNavHighlight()">' + pageViewWeekNavHtml() + '<div class="pageViewSheet">';
            if (allData.length === 0) {
                html += '<div class="pageViewEmpty"><div class="pageViewEmptyAdd" onclick="toolbarAddEntry()" title="为当前时段新增一条日志">＋ 新增日志</div><div class="pageViewEmptyText">当前时段无日志</div></div>';
            } else {
                var dateGroups = {};
                for (var i = 0; i < allData.length; i++) {
                    var row = allData[i];
                    var dk = (timeRangeType === 'week' && isWeekWorkItem(row)) ? '__week_work__' : (row._dateKey || '');
                    if (!dateGroups[dk]) dateGroups[dk] = [];
                    dateGroups[dk].push(row);
                }
                var sortedKeys = Object.keys(dateGroups).sort(function(a, b) {
                    if (a === '__week_work__') return pageViewFilterDateKey ? 1 : -1;
                    if (b === '__week_work__') return pageViewFilterDateKey ? -1 : 1;
                    // 解析日期键为 Date 对象进行 chronological 排序
                    var dateA = new Date(a + 'T00:00:00');
                    var dateB = new Date(b + 'T00:00:00');
                    return dateA - dateB;
                });
                for (var gi = 0; gi < sortedKeys.length; gi++) {
                    var group = dateGroups[sortedKeys[gi]];
                    var firstRow = group[0];
                    var dateText = sortedKeys[gi] === '__week_work__' ? '本周工作' : formatLogTimePageStartDisplay(firstRow.startTime || '');
                     html += '<div class="pageViewDateGroup">';
                     html += '<div class="pageViewDate">' + escapeHtml(dateText) + '</div>';
                    for (var ei = 0; ei < group.length; ei++) {
                        html += buildPageViewEntryHtml(group[ei], group.length, ei, { showUnlinkedRow: true, hasUnlinkedWeekLogs: hasUnlinkedWeekLogs });
                    }
                    html += '</div>';
                }
            }
            html += '</div></div>';
            container.innerHTML = html;
            _weekSummaryDecorate(container);
        }
        // 页面视图里的附件链接：单击直接打开，右键仍可复制路径
        function openAttachmentFromEl(el) {
            var path = (el && el.getAttribute('data-path')) || '';
            if (!path) { showToast('无有效信息可复制'); return; }
            openAttachment(path);
        }

        function copyAttachPath(el) {
            var path = el.getAttribute('data-path') || '';
            var name = el.getAttribute('data-name') || '附件';
            if (!path) { showToast('无有效信息可复制'); return; }
            navigator.clipboard.writeText(path).then(function() {
                showToast('已将"' + name + '"信息复制到剪贴板');
            }).catch(function() {
                showToast('复制失败');
            });
        }
        function getTrackFilterCategories() {
            var cats = [];
            for (var k in reportData) {
                var arr = reportData[k];
                var yh = _yearFromKey(k);
                for (var j = 0; j < arr.length; j++) {
                    var cat = arr[j].category || '';
                    if (!cat) continue;
                    var sd = parseTimeStrToDate(arr[j].startTime, yh);
                    var ed = parseTimeStrToDate(arr[j].endTime, yh);
                    if (!sd) continue;
                    if (!ed) ed = sd;
                    var inRange = false;
                    var cur = new Date(timeRangeStart);
                    while (cur <= timeRangeEnd) {
                        var d = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate());
                        if (d >= sd && d <= ed) { inRange = true; break; }
                        cur.setDate(cur.getDate() + 1);
                    }
                    if (inRange && cats.indexOf(cat) === -1) cats.push(cat);
                }
            }
            cats.sort(function(a, b) { return a.localeCompare(b, 'zh-CN'); });
            return cats;
        }
        var _trackFilterDragSrc = -1;
        function buildTrackFilterBody() {
            var body = document.getElementById('trackFilterBody');
            if (!body) return;
            if (!trackFilterState || !trackFilterState.categories || trackFilterState.categories.length === 0) {
                body.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">当前时间区间内没有事项</div>';
                return;
            }
            body.innerHTML = '';
            for (var i = 0; i < trackFilterState.categories.length; i++) {
                (function(idx) {
                    var it = trackFilterState.categories[idx];
                    var div = document.createElement('div');
                    div.className = 'trackFilterItem';
                    div.draggable = true;
                    var cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'tfiCheck';
                    cb.checked = it.checked;
                    cb.addEventListener('change', function() {
                        trackFilterState.categories[idx].checked = cb.checked;
                    });
                    div.appendChild(cb);
                    var catSpan = document.createElement('span');
                    catSpan.className = 'tfiCat';
                    catSpan.textContent = it.category;
                    div.appendChild(catSpan);
                    div.addEventListener('dragstart', function(e) {
                        _trackFilterDragSrc = idx;
                        div.classList.add('dragging');
                        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); } catch(err) {}
                    });
                    div.addEventListener('dragend', function() {
                        div.classList.remove('dragging');
                        var all = body.querySelectorAll('.trackFilterItem');
                        for (var di = 0; di < all.length; di++) all[di].classList.remove('drop-above', 'drop-below');
                    });
                    div.addEventListener('dragover', function(e) {
                        if (_trackFilterDragSrc < 0) return;
                        e.preventDefault();
                        try { e.dataTransfer.dropEffect = 'move'; } catch(err) {}
                        var all = body.querySelectorAll('.trackFilterItem');
                        for (var di = 0; di < all.length; di++) all[di].classList.remove('drop-above', 'drop-below');
                        var rect = div.getBoundingClientRect();
                        var above = (e.clientY - rect.top) < rect.height / 2;
                        div.classList.add(above ? 'drop-above' : 'drop-below');
                    });
                    div.addEventListener('dragleave', function() {
                        div.classList.remove('drop-above', 'drop-below');
                    });
                    div.addEventListener('drop', function(e) {
                        e.preventDefault();
                        var all = body.querySelectorAll('.trackFilterItem');
                        for (var di = 0; di < all.length; di++) all[di].classList.remove('drop-above', 'drop-below');
                        if (_trackFilterDragSrc < 0 || _trackFilterDragSrc === idx) return;
                        var rect = div.getBoundingClientRect();
                        var above = (e.clientY - rect.top) < rect.height / 2;
                        var targetIdx = above ? idx : idx + 1;
                        var moved = trackFilterState.categories.splice(_trackFilterDragSrc, 1)[0];
                        if (_trackFilterDragSrc < targetIdx) targetIdx--;
                        trackFilterState.categories.splice(targetIdx, 0, moved);
                        _trackFilterDragSrc = -1;
                        buildTrackFilterBody();
                    });
                    body.appendChild(div);
                })(i);
            }
        }
        function showTrackFilterModal() {
            if (!trackFilterState) {
                var cats = getTrackFilterCategories();
                S.trackFilterState = { enabled: false, categories: [] };
                for (var ci = 0; ci < cats.length; ci++) {
                    trackFilterState.categories.push({ category: cats[ci], checked: true });
                }
            }
            buildTrackFilterBody();
            document.getElementById('trackFilterModal').classList.add('show');
        }
        function closeTrackFilterModal() {
            document.getElementById('trackFilterModal').classList.remove('show');
        }
        function confirmTrackFilter() {
            var anyChecked = false;
            for (var i = 0; i < trackFilterState.categories.length; i++) {
                if (trackFilterState.categories[i].checked) { anyChecked = true; break; }
            }
            trackFilterState.enabled = anyChecked;
            closeTrackFilterModal();
            renderTrackContent();
        }
        
        function addYellowTooltip(container) {
            var oldTooltip = document.getElementById('timelineTooltipYellow');
            if (oldTooltip) oldTooltip.remove();
            var tooltip = document.createElement('div');
            tooltip.className = 'timelineTooltipYellow';
            tooltip.id = 'timelineTooltipYellow';
            document.body.appendChild(tooltip);
        }
        function autoRenumberEditContent() {
            var textarea = document.getElementById('editContent');
            if (!textarea) return;
            var lines = textarea.value.replace(/\r\n/g, '\n').split('\n');
            var numberRe = /^(\s*)(?:(\d+)([.．。、])|([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]))(\s*)/;
            var first = null;
            for (var i = 0; i < lines.length; i++) {
                var m = lines[i].match(numberRe);
                if (m) { first = m; break; }
            }
            if (!first) { showToast('内容中未发现以数字序号开头的分项'); return; }
            var circled = !!first[4];
            var sep = first[3] || '';
            var leading = first[1] || '';
            var circledNums = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
            var count = 0;
            for (var j = 0; j < lines.length; j++) {
                var match = lines[j].match(numberRe);
                if (!match) continue;
                count++;
                var prefix = circled ? (leading + (circledNums[count - 1] || String(count))) : (leading + count + sep);
                lines[j] = prefix + lines[j].substring(match[0].length);
            }
            textarea.value = lines.join('\n');
            showToast('已自动调整序号');
        }
        
        function showTimelineTooltipYellow(e) {
            var remark = this.getAttribute('data-remark');
            if (!remark || remark.trim() === '') return;
            
            var tooltip = document.getElementById('timelineTooltipYellow');
            if (!tooltip) return;
            
            var rect = this.getBoundingClientRect();
            var gap = 6;
            tooltip.textContent = remark;
            tooltip.classList.remove('above', 'below');
            tooltip.style.left = '0px';
            tooltip.style.top = '0px';
            tooltip.style.transform = 'none';
            tooltip.classList.add('show');
            var left = rect.left + rect.width / 2;
            var top;
            var belowTop = rect.bottom + gap;
            var aboveTop = rect.top - gap;
            if (belowTop + tooltip.offsetHeight <= window.innerHeight) {
                top = belowTop;
                tooltip.classList.add('below');
                tooltip.style.transform = 'translateX(-50%)';
            } else {
                top = aboveTop;
                tooltip.classList.add('above');
                tooltip.style.transform = 'translate(-50%, -100%)';
            }
            var half = tooltip.offsetWidth / 2;
            left = Math.max(half + 4, Math.min(window.innerWidth - half - 4, left));
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
        }
        
        var dragState = null;
        
        function initEventDrag(eventEl, days, dayWidth) {
            eventEl.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;
                e.preventDefault();
                
                dragState = {
                    element: this,
                    startX: e.clientX,
                    originalLeft: parseFloat(this.style.left),
                    days: days,
                    dayWidth: dayWidth,
                    dateKey: this.getAttribute('data-datekey'),
                    origIndex: parseInt(this.getAttribute('data-origindex')),
                    startIdx: parseInt(this.getAttribute('data-start-idx')),
                    endIdx: parseInt(this.getAttribute('data-end-idx'))
                };
                
                this.classList.add('dragging');
                document.addEventListener('mousemove', onEventDrag);
                document.addEventListener('mouseup', onEventDragEnd);
            });
        }
        
        function onEventDrag(e) {
            if (!dragState) return;
            
            var deltaX = e.clientX - dragState.startX;
            var newLeft = dragState.originalLeft + deltaX;
            dragState.element.style.left = newLeft + 'px';
        }
        
        function onEventDragEnd(e) {
            if (!dragState) return;
            
            document.removeEventListener('mousemove', onEventDrag);
            document.removeEventListener('mouseup', onEventDragEnd);
            
            dragState.element.classList.remove('dragging');
            
            var deltaX = e.clientX - dragState.startX;
            if (Math.abs(deltaX) < 10) {
                dragState = null;
                return;
            }
            
            var currentLeft = parseFloat(dragState.element.style.left);
            var newStartIdx = Math.round(currentLeft / dragState.dayWidth);
            if (newStartIdx < 0) newStartIdx = 0;
            if (newStartIdx >= dragState.days.length) newStartIdx = dragState.days.length - 1;
            
            var duration = dragState.endIdx - dragState.startIdx;
            var newEndIdx = newStartIdx + duration;
            if (newEndIdx >= dragState.days.length) newEndIdx = dragState.days.length - 1;
            
            var newStartDate = dragState.days[newStartIdx].date;
            var newEndDate = dragState.days[newEndIdx].date;
            
            var newStartTimeStr = (newStartDate.getMonth() + 1) + '月' + newStartDate.getDate() + '日（周' + weekDays[newStartDate.getDay()] + '）';
            var newEndTimeStr = (newEndDate.getMonth() + 1) + '月' + newEndDate.getDate() + '日（周' + weekDays[newEndDate.getDay()] + '）';
            
            if (reportData[dragState.dateKey] && reportData[dragState.dateKey][dragState.origIndex]) {
                reportData[dragState.dateKey][dragState.origIndex].startTime = newStartTimeStr;
                reportData[dragState.dateKey][dragState.origIndex].endTime = newEndTimeStr;
                reportData[dragState.dateKey][dragState.origIndex].time = newStartTimeStr + '—' + newEndTimeStr;
                
                renderTrackContent();
                showToast('已更新时间');
            }
            
            dragState = null;
        }
        
        function hideTimelineTooltip() {
            var tooltip = document.getElementById('timelineTooltipYellow');
            if (tooltip) tooltip.classList.remove('show');
        }
        
        function openTimelineEventEditModal(category, startTime, endTime, content, remark, eventElement) {
            var dateKey = eventElement.getAttribute('data-datekey');
            var origIndex = parseInt(eventElement.getAttribute('data-origindex'));
            
            if (!dateKey || origIndex < 0) {
                showEventDetailModal(content, remark, category, startTime, endTime);
                return;
            }
            
            var targetItem = reportData[dateKey] && reportData[dateKey][origIndex];
            if (!targetItem) {
                showEventDetailModal(content, remark, category, startTime, endTime);
                return;
            }
            
            S.editingRowIndex = origIndex;
            S.editingDateKey = dateKey;
            
            document.getElementById('editCategory').value = targetItem.category || '';
            document.getElementById('editStartTime').value = targetItem.startTime || '';
            document.getElementById('editEndTime').value = targetItem.endTime || '';
            document.getElementById('editContent').value = targetItem.content || '';
            document.getElementById('editRemark').value = targetItem.remark || '';
            document.getElementById('editStatus').value = targetItem.status || 'normal';
            
            S.currentAttachments = targetItem.attachments ? targetItem.attachments.slice() : [];
            renderAttachmentList();
            
            initCategoryInput();
            applyEditModalFontSize(editModalFontSize);
            _updateEditWeekNav();
            closeWeekPopups();
            document.getElementById('editModal').classList.add('show');
        }
        
        function showEventDetailModal(content, remark, category, start, end) {
            var existingModal = document.querySelector('.eventDetailModal');
            if (existingModal) existingModal.remove();
            
            var modal = document.createElement('div');
            modal.className = 'eventDetailModal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
            
            var box = document.createElement('div');
            box.style.cssText = 'background:white;padding:25px;border-radius:12px;min-width:350px;max-width:500px;box-shadow:0 10px 40px rgba(0,0,0,0.3);';
            
            var title = document.createElement('h3');
            title.style.cssText = 'margin-bottom:15px;color:#2c3e50;font-size:18px;';
            title.textContent = category;
            
            var timeP = document.createElement('p');
            timeP.style.cssText = 'margin-bottom:12px;font-size:14px;color:#333;';
            var timeStr = start || '';
            if (end && start && end !== start) timeStr = start + ' — ' + end;
            timeP.innerHTML = '<strong>时间：</strong>' + timeStr;
            
            var contentP = document.createElement('p');
            contentP.style.cssText = 'margin-bottom:12px;font-size:14px;color:#333;';
            contentP.innerHTML = '<strong>内容：</strong>' + content;
            
            var remarkP = document.createElement('p');
            remarkP.style.cssText = 'margin-bottom:15px;font-size:14px;color:#666;';
            remarkP.innerHTML = '<strong>备注：</strong>' + (remark || '无');
            
            var closeBtn = document.createElement('button');
            closeBtn.textContent = '关闭';
            closeBtn.style.cssText = 'padding:8px 20px;background:#2c3e50;color:white;border:none;border-radius:6px;cursor:pointer;';
            closeBtn.onclick = function() { modal.remove(); };
            
            box.appendChild(title);
            box.appendChild(timeP);
            box.appendChild(contentP);
            box.appendChild(remarkP);
            box.appendChild(closeBtn);
            modal.appendChild(box);
            document.body.appendChild(modal);
            
            modal.addEventListener('click', function(e) {
                if (e.target === modal) modal.remove();
            });
        }
        
        var selectedFilePath = '';
        var selectedFileName = '';
        var scannedFiles = [];
        var workLogDirHandle = null;
        var scanFolderName = '';
        var cachedFileMap = {};
        var _pendingRestoreDirHandle = null;
        function showFileSelectorModal() {
            selectedFilePath = '';
            selectedFileName = '';
            document.getElementById('fileSelectorEmpty').style.display = 'none';
            document.getElementById('fileSelectorModal').classList.add('show');
            // 打开「数据文件」时，若上次文件夹还在但本会话尚未授权，直接在这里（用户点击手势内）恢复，
            // 不再要求用户二次点「一键恢复」。
            _autoRestoreDataDirOnOpen();
            var firstBtn = document.getElementById('firstFolderBtn');
            if (workLogDirHandle) {
                _applyFileSelectorPath();
                document.getElementById('fileSelectorPath').style.display = 'flex';
                firstBtn.style.display = 'none';
                reloadFileListFromCache();
                return;
            }
            if (notebookRootHandle && !workLogDirHandle) {
                (async function() {
                    try {
                        var dh = null;
                        // 优先复用上次选择的「工作日志」子目录，没有才新建（避免新建出空目录覆盖旧路径显示）
                        try { dh = await notebookRootHandle.getDirectoryHandle('工作日志'); } catch (e0) {}
                        if (!dh) dh = await notebookRootHandle.getDirectoryHandle('工作日志', { create: true });
                        workLogDirHandle = dh;
                        if (typeof window.setSaveDataDirHandle === 'function') { try { window.setSaveDataDirHandle(dh); } catch(e) {} }
                        scanFolderName = dh.name || '工作日志';
                        try { await idbPut('workLogDirHandle', dh); } catch(e) {}
                        try { await idbPut('saveDataDirHandle', dh); } catch(e) {}
                        try { await idbPut('dataDirName', scanFolderName); } catch(e) {}
                        try { DataLayer.setRaw('dataDirName', scanFolderName); } catch(e) {}
                        _applyFileSelectorPath();
                        document.getElementById('fileSelectorPath').style.display = 'flex';
                        firstBtn.style.display = 'none';
                        await reloadFileListFromCache();
                    } catch(e) {
                        firstBtn.style.display = 'none';
                        scanWorkLogFiles();
                    }
                })();
                return;
            }
            if (!workLogDirHandle && Object.keys(cachedFileMap).length === 0) {
                if (_fileSelectorFirstOpen) {
                    firstBtn.style.display = 'inline';
                    var fsBody = document.getElementById('fileSelectorBody');
                    fsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">首次使用请点击标题后的"选择数据文件夹"按钮</td></tr>';
                    document.getElementById('fileSelectorPath').style.display = 'none';
                    _showRestoreBarIfNeeded();
                    return;
                } else {
                    firstBtn.style.display = 'none';
                    _showRestoreBarIfNeeded();
                    scanWorkLogFiles();
                    return;
                }
            }
            firstBtn.style.display = 'none';
            if (workLogDirHandle || Object.keys(cachedFileMap).length > 0) {
                if (scannedFiles.length === 0 && Object.keys(cachedFileMap).length > 0) {
                    scannedFiles = Object.keys(cachedFileMap).sort().reverse();
                }
                // 如果有文件夹句柄，始终显示路径栏
                if (workLogDirHandle) {
                    _applyFileSelectorPath();
                    document.getElementById('fileSelectorPath').style.display = 'flex';
                }
                if (scannedFiles.length > 0) {
                    populateFileList(scannedFiles);
                } else if (workLogDirHandle) {
                    reloadFileListFromCache();
                } else {
                    var fsBody = document.getElementById('fileSelectorBody');
                    fsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">首次使用请选择数据文件夹</td></tr>';
                    document.getElementById('fileSelectorPath').style.display = 'none';
                }
            }
        }
        function showFileSelectorModalAndScan() {
            document.getElementById('fileSelectorModal').classList.add('show');
            var firstBtn = document.getElementById('firstFolderBtn');
            if (!workLogDirHandle && _pendingRestoreDirHandle) {
                var lastName = scanFolderName || _pendingRestoreDirHandle.name || '';
                var pathRow0 = document.getElementById('fileSelectorPath');
                var pathEl0 = document.getElementById('fileSelectorPathText');
                if (pathEl0) { pathEl0.textContent = './' + lastName; pathEl0.title = './' + lastName; }
                if (pathRow0) pathRow0.style.display = 'flex';
                firstBtn.style.display = 'none';
                var fsBody0 = document.getElementById('fileSelectorBody');
                if (fsBody0) fsBody0.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#999;">上次文件夹：' + (lastName || '（未知）') + '<br>点下方“一键恢复”即可继续，无需重新选择</td></tr>';
                _showRestoreBarIfNeeded();
                return;
            }
            if (workLogDirHandle) {
                _applyFileSelectorPath();
                document.getElementById('fileSelectorPath').style.display = 'flex';
                firstBtn.style.display = 'none';
                reloadFileListFromCache();
            } else if (notebookRootHandle && !workLogDirHandle) {
                (async function() {
                    try {
                        var dh = await notebookRootHandle.getDirectoryHandle('工作日志', { create: true });
                        workLogDirHandle = dh;
                        if (typeof window.setSaveDataDirHandle === 'function') { try { window.setSaveDataDirHandle(dh); } catch(e) {} }
                        scanFolderName = '工作日志';
                        _applyFileSelectorPath();
                        document.getElementById('fileSelectorPath').style.display = 'flex';
                        firstBtn.style.display = 'none';
                        await reloadFileListFromCache();
                    } catch(e) {
                        firstBtn.style.display = 'none';
                        scanWorkLogFiles();
                    }
                })();
            } else if (!workLogDirHandle && Object.keys(cachedFileMap).length === 0 && _fileSelectorFirstOpen) {
                firstBtn.style.display = 'inline';
                var fsBody = document.getElementById('fileSelectorBody');
                fsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">首次使用请点击标题后的"选择数据文件夹"按钮</td></tr>';
                document.getElementById('fileSelectorPath').style.display = 'none';
                _showRestoreBarIfNeeded();
            } else {
                firstBtn.style.display = 'none';
                scanWorkLogFiles();
            }
        }
        function closeFileSelectorModal() {
            document.getElementById('fileSelectorModal').classList.remove('show');
        }
        async function reloadFileListFromCache() {
            var fsBody = document.getElementById('fileSelectorBody');
            var fsEmpty = document.getElementById('fileSelectorEmpty');
            fsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">正在读取文件列表...</td></tr>';
            try {
                scannedFiles = [];
                for await (var entry of workLogDirHandle.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.js')) {
                        scannedFiles.push(entry.name);
                    }
                }
                scannedFiles.sort().reverse();
                populateFileList(scannedFiles);
            } catch(e) {
                workLogDirHandle = null;
                scanFolderName = '';
                document.getElementById('fileSelectorPath').style.display = 'none';
                fsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">读取失败，请重新选择文件夹</td></tr>';
            }
        }
        function scanWorkLogFiles() {
            _fileSelectorFirstOpen = false;
            document.getElementById('firstFolderBtn').style.display = 'none';
            var fsBody = document.getElementById('fileSelectorBody');
            fsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">正在扫描...</td></tr>';
            if (window.showDirectoryPicker) {
                (async function() {
                    try {
                        var dirHandle = await window.showDirectoryPicker({id: 'worklog-dir', mode: 'readwrite'});
                        workLogDirHandle = dirHandle;
                        // 持久化保存文件夹句柄，下次打开自动恢复
                        try { await idbPut('workLogDirHandle', dirHandle); } catch(e) {}
                        // 同一个文件夹也用于数据持久化写入：一并记录句柄与其名字，重启后显示路径
                        try { await idbPut('saveDataDirHandle', dirHandle); } catch(e) {}
                        try { await idbPut('dataDirName', dirHandle.name); } catch(e) {}
                        if (typeof window.setSaveDataDirHandle === 'function') {
                            try { window.setSaveDataDirHandle(dirHandle); } catch(e) {}
                        }
                        scanFolderName = dirHandle.name;
                        try { DataLayer.setRaw('dataDirName', dirHandle.name); } catch(e) {}
                        _applyFileSelectorPath();
                        document.getElementById('fileSelectorPath').style.display = 'flex';
                        var _rb = document.getElementById('dataDirRestoreBar');
                        if (_rb) _rb.style.display = 'none';
                        await reloadFileListFromCache();
                    } catch(e) {
                        document.getElementById('fileSelectorPath').style.display = 'none';
                        fsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">选择已取消</td></tr>';
                    }
                })();
            } else {
                document.getElementById('scanFolderInput').click();
            }
        }
        function changeWorkLogFolder() {
            notebookRootHandle = null;
            workLogDirHandle = null;
            _pendingRestoreDirHandle = null;
            scanFolderName = '';
            idbPut('notebookRootHandle', null);
            idbPut('workLogDirHandle', null);
            idbPut('saveDataDirHandle', null);
            idbPut('dataDirName', null);
            try { DataLayer.setRaw('dataDirName', ''); } catch(e) {}
            scanWorkLogFiles();
        }

        // 把已恢复的(或刚选择的)数据文件夹接管为当前数据源：扫描文件、静默加载上次文件、更新路径显示
        async function _adoptDataDir(dirHandle) {
            if (!dirHandle) return false;
            workLogDirHandle = dirHandle;
            _pendingRestoreDirHandle = null;
            scanFolderName = dirHandle.name || '';
            try { await idbPut('workLogDirHandle', dirHandle); } catch(e) {}
            try { await idbPut('saveDataDirHandle', dirHandle); } catch(e) {}
            try { await idbPut('dataDirName', scanFolderName); } catch(e) {}
            try { DataLayer.setRaw('dataDirName', scanFolderName); } catch(e) {}
            if (typeof window.setSaveDataDirHandle === 'function') {
                try { window.setSaveDataDirHandle(dirHandle); } catch(e) {}
            }
            var pathEl = document.getElementById('fileSelectorPathText');
            if (pathEl) pathEl.textContent = scanFolderName;
            var pathRow = document.getElementById('fileSelectorPath');
            if (pathRow) pathRow.style.display = 'flex';
            var bar = document.getElementById('dataDirRestoreBar');
            if (bar) bar.style.display = 'none';
            try {
                scannedFiles = [];
                for await (var entry of dirHandle.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.js')) scannedFiles.push(entry.name);
                }
                scannedFiles.sort().reverse();
                if (document.getElementById('fileSelectorModal').classList.contains('show')) {
                    populateFileList(scannedFiles);
                }
                var lastFile = DataLayer.getRaw('lastLoadedFile');
                var fileToLoad = lastFile && scannedFiles.indexOf(lastFile) !== -1 ? lastFile : scannedFiles[0];
                if (fileToLoad) {
                    S.currentDataFileName = fileToLoad;
                    updateLastLoadedFile(fileToLoad);
                    var fh = await dirHandle.getFileHandle(fileToLoad);
                    var file = await fh.getFile();
                    var text = await file.text();
                    loadRemoteDataFileSkipNotes(text, fileToLoad);
                    renderTrackContent();
                }
            } catch(e) {
                console.warn('[work-log] _adoptDataDir 读取失败:', e);
            }
            return true;
        }

        // 打开「数据文件」时自动恢复上次文件夹：必须在用户点击手势内直接 requestPermission，
        // 否则浏览器会一直停在 prompt，用户每次都得再点一次「一键恢复」。
        function _autoRestoreDataDirOnOpen() {
            if (workLogDirHandle) return;
            var h = _pendingRestoreDirHandle;
            if (!h && !workLogDirHandle) {
                // 兜底：从 IndexedDB 取上次句柄后再恢复（会再进一次本函数）
                idbGet('workLogDirHandle').then(function(dh) { return dh || idbGet('saveDataDirHandle'); }).then(function(dh) {
                    if (dh && !workLogDirHandle) { _pendingRestoreDirHandle = dh; _autoRestoreDataDirOnOpen(); }
                    else if (!workLogDirHandle) { _showRestoreBarIfNeeded(); }
                }).catch(function() { _showRestoreBarIfNeeded(); });
                return;
            }
            if (!h) { _showRestoreBarIfNeeded(); return; }
            var lastName = scanFolderName || h.name || '';
            if (lastName) {
                var pathEl = document.getElementById('fileSelectorPathText');
                if (pathEl) { pathEl.textContent = './' + lastName; pathEl.title = './' + lastName; }
                var pathRow = document.getElementById('fileSelectorPath');
                if (pathRow) pathRow.style.display = 'flex';
            }
            var body = document.getElementById('fileSelectorBody');
            if (body) body.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#999;">正在恢复上次文件夹...</td></tr>';
            var req;
            try {
                req = h.requestPermission ? h.requestPermission({ mode: 'readwrite' }) : Promise.resolve('granted');
            } catch (e) {
                req = Promise.reject(e);
            }
            Promise.resolve(req).then(function(state) {
                if (state === 'granted') return _adoptDataDir(h);
                _showRestoreBarIfNeeded();
            }).catch(function() {
                _showRestoreBarIfNeeded();
            });
        }
        window._autoRestoreDataDirOnOpen = _autoRestoreDataDirOnOpen;

        // 用户点「一键恢复」：必须在用户手势内调用，浏览器才允许重新授权
        async function restoreDataDir() {
            try {
                var h = await idbGet('workLogDirHandle');
                if (!h) h = await idbGet('saveDataDirHandle');
                if (!h) { showToast('没有已保存的数据文件夹记录，请重新选择'); return; }
                var ok = await verifyPermission(h, true);
                if (!ok) { showToast('授权被拒绝，请用「更改文件夹」重新选择'); return; }
                await _adoptDataDir(h);
                showToast('已恢复数据文件夹：' + (scanFolderName || ''));
            } catch(e) {
                showToast('恢复失败：' + (e && e.message ? e.message : e));
            }
        }
        window.restoreDataDir = restoreDataDir;

        // 打开选择窗口时：若已有保存的文件夹但当前没恢复，就显示「上次路径 + 一键恢复」提示条
        async function _showRestoreBarIfNeeded() {
            var bar = document.getElementById('dataDirRestoreBar');
            if (!bar) return;
            if (workLogDirHandle) { bar.style.display = 'none'; return; }
            var h = null;
            try { h = await idbGet('workLogDirHandle'); } catch(e) {}
            if (!h) { try { h = await idbGet('saveDataDirHandle'); } catch(e) {} }
            if (!h) { bar.style.display = 'none'; return; }
            var name = '';
            try { name = await idbGet('dataDirName'); } catch(e) {}
            if (!name) { try { name = DataLayer.getRaw('dataDirName'); } catch(e) {} }
            if (!name) { try { name = h.name || ''; } catch(e) {} }
            var nameEl = document.getElementById('dataDirRestoreName');
            if (nameEl) nameEl.textContent = name || '（未知）';
            bar.style.display = 'flex';
        }
        window._showRestoreBarIfNeeded = _showRestoreBarIfNeeded;
        // ===== 数据文件窗口：路径显示 / 时间标签缓存 / 选中态 / 保存到选中文件 =====

        // 把文件夹名转成「省略家目录」的显示路径，如 ./桌面/辅助工具/电子记事本/日志
        function _dataDirDisplayPath() {
            var name = scanFolderName || (workLogDirHandle && workLogDirHandle.name) || '';
            if (!name) return '';
            return './' + name;
        }
        window._dataDirDisplayPath = _dataDirDisplayPath;

        function _applyFileSelectorPath() {
            var el = document.getElementById('fileSelectorPathText');
            var row = document.getElementById('fileSelectorPath');
            if (!el) return;
            var txt = _dataDirDisplayPath();
            if (txt) {
                el.textContent = txt;
                el.title = txt;
                if (row) row.style.display = 'flex';
            }
        }
        window._applyFileSelectorPath = _applyFileSelectorPath;

        var _dataFileSpanCache = {};

        // 读取单个 js 文件的起止日期（形如 20251014--20261104）
        function _calcFileDateSpan(content) {
            var span = { start: '', end: '' };
            try {
                var m = String(content || '').match(/var\s+(\w+)\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
                var dataStr = m ? m[2] : String(content || '');
                var data = JSON.parse(dataStr);
                var rep = data && data.reportData;
                if (!rep) return span;
                var keys = Object.keys(rep).sort();
                var minT = 0, maxT = 0;
                for (var i = 0; i < keys.length; i++) {
                    var k = keys[i];
                    var km = String(k).match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    if (!km) continue;
                    var arr = rep[k];
                    if (!Array.isArray(arr) || !arr.length) continue;
                    var yh = parseInt(km[1], 10);
                    for (var j = 0; j < arr.length; j++) {
                        var it = arr[j];
                        if (!it) continue;
                        var ds = [];
                        var d1 = parseTimeStrToDate(it.startTime || '', yh);
                        var d2 = parseTimeStrToDate(it.endTime || '', yh);
                        if (!d1 && d2) d1 = d2;
                        if (!d2 && d1) d2 = d1;
                        if (d1) ds.push(d1.getTime());
                        if (d2) ds.push(d2.getTime());
                        for (var q = 0; q < ds.length; q++) {
                            if (!minT || ds[q] < minT) minT = ds[q];
                            if (!maxT || ds[q] > maxT) maxT = ds[q];
                        }
                    }
                }
                if (minT) span.start = _fmtYmd(new Date(minT));
                if (maxT) span.end = _fmtYmd(new Date(maxT));
            } catch (e) {}
            return span;
        }
        function _fmtYmd(d) {
            return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
        }

        function _getFileSpanTagHtml(fname) {
            var c = _dataFileSpanCache[fname];
            if (c && c.start) {
                return '<span class="fileSpanTag">' + escapeHtml(c.start) + '--' + escapeHtml(c.end) + '</span>';
            }
            return '<span class="fileSpanTag fileSpanPending">读取中…</span>';
        }
        window._getFileSpanTagHtml = _getFileSpanTagHtml;

        // 异步读取一批文件的日期区间并写入缓存（只读一次，之后一直用缓存）
        function _fillFileSpanCache(files) {
            var todo = [];
            for (var i = 0; i < files.length; i++) {
                if (!_dataFileSpanCache[files[i]]) todo.push(files[i]);
            }
            if (!todo.length) return Promise.resolve();
            return (async function() {
                var changed = false;
                for (var i = 0; i < todo.length; i++) {
                    var fname = todo[i];
                    try {
                        var content = '';
                        if (cachedFileMap[fname]) {
                            content = await cachedFileMap[fname].text();
                        } else if (workLogDirHandle) {
                            var fh = await workLogDirHandle.getFileHandle(fname);
                            var f = await fh.getFile();
                            content = await f.text();
                        } else {
                            continue;
                        }
                        var span = _calcFileDateSpan(content);
                        _dataFileSpanCache[fname] = span;
                        changed = true;
                        var cell = document.querySelector('.fileSpanCell[data-fname="' + CSS.escape(fname) + '"]');
                        if (cell) cell.innerHTML = _getFileSpanTagHtml(fname);
                    } catch (e) {
                        _dataFileSpanCache[fname] = { start: '', end: '' };
                        changed = true;
                    }
                }
                if (changed) {
                    try { DataLayer.set('dataFileSpanCache', _dataFileSpanCache); } catch (e) {}
                }
            })();
        }
        window._fillFileSpanCache = _fillFileSpanCache;

        function _loadFileSpanCache() {
            try {
                var c = DataLayer.get('dataFileSpanCache');
                if (c && typeof c === 'object') _dataFileSpanCache = c;
            } catch (e) {}
        }
        window._loadFileSpanCache = _loadFileSpanCache;

        // 标记「当前正在使用的数据文件」所在行
        function _markCurrentDataFileRow() {
            var body = document.getElementById('fileSelectorBody');
            if (!body) return;
            var cur = S.currentDataFileName || DataLayer.getRaw('lastLoadedFile') || '';
            var rows = body.querySelectorAll('tr');
            for (var i = 0; i < rows.length; i++) {
                var tr = rows[i];
                var radio = tr.querySelector('input[type="radio"]');
                var isCur = !!(cur && radio && radio.value === cur);
                tr.classList.toggle('currentDataFile', isCur);
                if (isCur) {
                    var rb = tr.querySelector('input[type="radio"]');
                    if (rb) rb.checked = true;
                    for (var j = 0; j < rows.length; j++) if (rows[j] !== tr) rows[j].classList.remove('selected');
                    tr.classList.add('selected');
                }
            }
        }
        window._markCurrentDataFileRow = _markCurrentDataFileRow;

        // 把当前缓存数据保存到列表里选中的那个 js 文件
        async function saveCurrentDataToSelectedFile() {
            var selected = document.querySelector('#fileSelectorBody input[type="radio"]:checked');
            if (!selected) { showToast('请先在列表中选择要保存到的文件'); return; }
            var fileName = selected.value;
            var dirHandle = workLogDirHandle || saveDataDirHandle;
            if (!dirHandle || !dirHandle.getFileHandle) { showToast('未找到数据文件夹，请先选择'); return; }
            try {
                saveCurrentEditor();
                cleanEmptyReportData();
                var editorBoard = (typeof window.paGetItems === 'function') ? window.paGetItems() : null;
                var data = { reminders: reminders, notes: notes, noteCategories: _noteCategories, noteCurrentCategory: _noteCurrentCategory, reportData: reportData, notepad: { data: notepadData, titles: notepadTitles, labels: notepadLabels, editorData: notepadEditorData, fontSizes: notepadFontSizes, notebookStyles: notepadNotebookStyles, zoomLevels: notepadZoomLevels }, editorBoard: editorBoard };
                var content = 'var savedData = ' + JSON.stringify(data, null, 2) + ';';
                var blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
                var fh = await dirHandle.getFileHandle(fileName, { create: true });
                var w = await fh.createWritable({ keepExistingData: false });
                await w.write({ type: 'write', data: blob });
                await w.close();
                updateFooterTimestamp();
                try { if (typeof _saveReportToCache === 'function') _saveReportToCache(); } catch (e) {}
                try { if (typeof saveToPersistentFile === 'function') saveToPersistentFile(); } catch (e) {}
                // 时间范围可能已变化，重算这一条
                delete _dataFileSpanCache[fileName];
                _fillFileSpanCache([fileName]);
                showToast('已保存到 ' + fileName);
            } catch (e) {
                showToast('保存失败：' + (e && e.message ? e.message : e));
            }
        }
        window.saveCurrentDataToSelectedFile = saveCurrentDataToSelectedFile;

        // 保存图标菜单：保存数据 = 保存到当前数据文件；另存为 = 以当前时间新建 js
        function saveDataToCurrentFile() {
            var fileName = S.currentDataFileName || DataLayer.getRaw('lastLoadedFile') || '';
            var dirHandle = workLogDirHandle || saveDataDirHandle;
            if (!fileName || !dirHandle) {
                showToast('未指定数据文件，请先在「数据文件」窗口选择');
                showFileSelectorModal();
                return;
            }
            var body = document.getElementById('fileSelectorBody');
            if (body) {
                var rows = body.querySelectorAll('tr');
                for (var i = 0; i < rows.length; i++) {
                    var radio = rows[i].querySelector('input[type="radio"]');
                    if (radio && radio.value === fileName) {
                        rows[i].classList.add('selected');
                        radio.checked = true;
                    }
                }
            }
            saveCurrentDataToSelectedFile();
        }
        window.saveDataToCurrentFile = saveDataToCurrentFile;

        function saveDataAsNewFile() {
            showSaveDataModal();
        }
        window.saveDataAsNewFile = saveDataAsNewFile;

        function populateFileList(files) {
            var fsBody = document.getElementById('fileSelectorBody');
            var fsEmpty = document.getElementById('fileSelectorEmpty');
            _applyFileSelectorPath();
            if (files.length === 0) {
                fsBody.innerHTML = '';
                fsEmpty.style.display = 'block';
                // 第一次打开且没有任何数据文件：直接自动加载演示模板，不再让用户点按钮
                _tryAutoLoadDemoTemplate();
                return;
            }
            fsEmpty.style.display = 'none';
            fsBody.innerHTML = '';
            for (var i = 0; i < files.length; i++) {
                renderFileRow(files[i], i);
            }
            _markCurrentDataFileRow();
            _fillFileSpanCache(files);
        }

        // 无任何数据文件时自动载入演示模板（只在本会话第一次打开时执行一次）
        var _demoTemplateAutoLoaded = false;
        function _tryAutoLoadDemoTemplate() {
            if (_demoTemplateAutoLoaded) return;
            if (workLogDirHandle || Object.keys(cachedFileMap).length > 0) return;
            if (S.reportData && Object.keys(S.reportData).length > 0) return;
            _demoTemplateAutoLoaded = true;
            try {
                var data = _buildLogDemoTemplateData({});
                applyLoadedData(data, '日志模板.js');
                showToast('未找到数据文件，已自动加载演示模板');
            } catch (e) {
                console.warn('[template] 自动加载演示模板失败:', e);
            }
        }
        window._tryAutoLoadDemoTemplate = _tryAutoLoadDemoTemplate;
        document.getElementById('scanFolderInput').addEventListener('change', function(e) {
            var files = e.target.files;
            if (!files || files.length === 0) {
                var fsBody = document.getElementById('fileSelectorBody');
                fsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">未选择文件</td></tr>';
                return;
            }
            var folderName = '';
            if (files[0].webkitRelativePath) {
                folderName = files[0].webkitRelativePath.split('/')[0];
                scanFolderName = folderName;
                document.getElementById('fileSelectorPathText').textContent = folderName;
                document.getElementById('fileSelectorPath').style.display = 'flex';
            } else {
                document.getElementById('fileSelectorPathText').textContent = '📁 (路径未知)';
                document.getElementById('fileSelectorPath').style.display = 'flex';
            }
            cachedFileMap = {};
            scannedFiles = [];
            var seen = new Set();
            for (var i = 0; i < files.length; i++) {
                var fname = files[i].name;
                if (fname.toLowerCase().endsWith('.js') && !seen.has(fname)) {
                    seen.add(fname);
                    scannedFiles.push(fname);
                    cachedFileMap[fname] = files[i];
                }
            }
            scannedFiles.sort().reverse();
            populateFileList(scannedFiles);
            e.target.value = '';
        });
        function renderFileRow(fname, idx) {
            var fsBody = document.getElementById('fileSelectorBody');
            var tr = document.createElement('tr');
            var safeName = String(fname).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            tr.innerHTML = '<td>' + (idx + 1) + '</td>' +
                '<td style="text-align:left;padding-left:15px;">' + safeName + '</td>' +
                '<td class="fileSpanCell" data-fname="' + safeName + '">' + _getFileSpanTagHtml(fname) + '</td>' +
                '<td><input type="radio" name="fileRadio" value="' + safeName + '"></td>';
            tr.addEventListener('click', function(e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                var radio = tr.querySelector('input[type="radio"]');
                radio.checked = true;
                var allRows = fsBody.querySelectorAll('tr');
                for (var j = 0; j < allRows.length; j++) allRows[j].classList.remove('selected');
                tr.classList.add('selected');
            });
            fsBody.appendChild(tr);
        }
        function confirmFileSelect() {
            var selected = document.querySelector('#fileSelectorBody input[type="radio"]:checked');
            if (!selected) {
                if (!workLogDirHandle && Object.keys(cachedFileMap).length === 0) {
                    scanWorkLogFiles();
                    showToast('请先选择数据文件夹，再勾选文件后点击确定');
                } else {
                    showToast('请选择一个文件');
                }
                return;
            }
            var fileName = selected.value;
            closeFileSelectorModal();
            loadRemoteDataFile(fileName);
        }
        function getWorkLogPath() {
            var scripts = document.getElementsByTagName('script');
            var currentSrc = '';
            for (var si = 0; si < scripts.length; si++) {
                if (scripts[si].src && (scripts[si].src.indexOf('致知记事本') !== -1 || scripts[si].src.indexOf('电子记事本') !== -1 || scripts[si].src.indexOf('慧办助手') !== -1)) {
                    currentSrc = scripts[si].src;
                    break;
                }
            }
            if (!currentSrc) {
                currentSrc = window.location.href;
            }
            if (currentSrc.indexOf('file:///') === 0) {
                currentSrc = currentSrc.substring(8);
            }
            var lastSlash = Math.max(currentSrc.lastIndexOf('/'), currentSrc.lastIndexOf('\\'));
            var baseDir = currentSrc.substring(0, lastSlash + 1);
            return baseDir + '工作日志/';
        }
        function loadRemoteDataFile(fileName) {
            S.currentDataFileName = fileName;
            updateLastLoadedFile(fileName);
            if (cachedFileMap[fileName]) {
                var reader = new FileReader();
                reader.onload = function(e) { loadDataContent(e.target.result, fileName); };
                reader.onerror = function() { showToast('读取失败'); };
                reader.readAsText(cachedFileMap[fileName], 'UTF-8');
            } else if (workLogDirHandle) {
                (async function() {
                    try {
                        var fileHandle = await workLogDirHandle.getFileHandle(fileName);
                        var file = await fileHandle.getFile();
                        var reader = new FileReader();
                        reader.onload = function(e) { loadDataContent(e.target.result, fileName); };
                        reader.onerror = function() { showToast('读取失败'); };
                        reader.readAsText(file, 'UTF-8');
                    } catch(e) {
                        showToast('读取失败: ' + e.message);
                    }
                })();
            } else {
                showToast('未找到文件数据源');
            }
        }
        function loadDataContent(content, fileName) {
            try {
                var jsonMatch = content.match(/var\s+savedData\s*=\s*(\{[\s\S]*\});?\s*$/);
                var dataStr = jsonMatch ? jsonMatch[1] : content.replace(/^var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
                var data = JSON.parse(dataStr);
                if ((fileName && /日志模板\.js$/i.test(fileName)) || data.templateType === 'log-demo') data = _buildLogDemoTemplateData(data);
                applyLoadedData(data, fileName);
            } catch (err) {
                showToast('打开失败：' + err.message);
            }
        }
        // 自动加载时使用：只加载报告数据，不覆盖笔记（保留 localStorage 中的最新笔记）
        function loadRemoteDataFileSkipNotes(content, fileName) {
            try {
                var jsonMatch = content.match(/var\s+savedData\s*=\s*(\{[\s\S]*\});?\s*$/);
                var dataStr = jsonMatch ? jsonMatch[1] : content.replace(/^var\s+\w+\s*=\s*/, '').replace(/;\s*$/, '');
                var data = JSON.parse(dataStr);
                if ((fileName && /日志模板\.js$/i.test(fileName)) || data.templateType === 'log-demo') data = _buildLogDemoTemplateData(data);
                applyLoadedDataSkipNotes(data, fileName);
            } catch (err) {
                showToast('打开失败：' + err.message);
            }
        }
        function _buildLogDemoTemplateData(data) {
            data = data || {};
            var today = new Date();
            today.setHours(0,0,0,0);
            var day = today.getDay();
            var monday = new Date(today);
            monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
            function addDays(n) { var d = new Date(monday); d.setDate(monday.getDate() + n); return d; }
            function key(d) { return getDateKeyFor(d.getFullYear(), d.getMonth(), d.getDate()); }
            function ds(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日（周' + weekDays[d.getDay()] + '）'; }
             function item(cat, s, e, content, remark, status) {
                 var sd = addDays(s), ed = addDays(e);
                 return { category: cat, startTime: ds(sd), endTime: ds(ed), time: s === e ? ds(sd) : ds(sd) + '—' + ds(ed), content: content, remark: remark || '', status: status || 'normal', attachments: [] };
             }
             var rd = {};
             function push(offset, obj) { var k = key(addDays(offset)); if (!rd[k]) rd[k] = []; rd[k].push(obj); }
              function shortDay(offset) { var d = addDays(offset); return d.getMonth() === monday.getMonth() ? d.getDate() + '日' : (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
              function dailyLog(offset, category, task, remark, status) { return item(category, offset, offset, shortDay(offset) + '，' + task, remark, status); }
              var lastWeek = item('上周工作', -7, -1, '上周完成项目收尾、材料校对和用户反馈整理：\n1.收集各业务组工作情况，形成周工作清单；√\n2.完成材料初稿和附件目录校对；√\n3.整理问题清单，安排本周验证任务。…', '上周连续工作示例；点击上方日期小按钮可筛显当日工作。', 'done');
             lastWeek.subTimestamps = ['', '', ''];
             push(-7, lastWeek);
             push(-6, dailyLog(-6, '反馈整理', '汇总用户对日志页面视图、周工作和随记导出的意见。', '上周具体日志。', 'done'));
             push(-4, dailyLog(-4, '材料校对', '校对推广材料中的标题、日期、附件列表和页码格式。', '', 'done'));
              var focus = item('本周重点工作', 0, 4, '本周重点工作：\n1.梳理本月程序开发进展，上报综合组汇总；□\n2.拟制中期开发项目预算；…\n3.完成通讯录和日志模块联调；■\n4.开展麒麟系统实机验证。√', '本周重点工作含步骤性分项，可展示右键分项编辑、状态和时间戳。', 'normal');
              focus.subTimestamps = ['', '', '', ''];
              push(0, focus);
              var reportStart = addDays(0), reportTue = addDays(1), reportWed = addDays(2), reportThu = addDays(3), reportFri = addDays(4);
              function reportDate(d) { return d.getDate() + '日'; }
              push(0, item('报送月工作报告', 0, 4, '1.' + reportDate(reportStart) + '，各业务组结合周例会，安排部署任务，指定专人梳理情况。\n2.' + reportDate(reportTue) + '，各业务组负责人审定本组月工作情况材料，送综合组汇总。\n3.' + reportDate(reportWed) + '至' + reportDate(reportThu) + '，综合组起草月情况报告，拟制呈批件报组长批准。\n4.' + reportDate(reportFri) + '，组长签批后，综合组项公司行政部发送情况报告。\n5.综合组与公司行政部加强沟通，及时将相关要求报告组长。', '普通工作示例：含日期分项和不含日期分项的写法。', 'normal'));
              push(0, dailyLog(0, '周例会', '召开本周工作例会，梳理重点任务，明确责任分工和完成时限。', '本周具体日志。', 'done'));
             push(1, dailyLog(1, '需求沟通', '与试用用户沟通记事本、随记和工作日志使用场景，收集界面优化建议。', '', 'done'));
             push(2, dailyLog(2, '数据整理', '整理演示数据，补充附件字段、备注字段和不同办理状态样例。', '用于展示点击日期小按钮筛选当日工作。', 'normal'));
             push(3, dailyLog(3, '问题修复', '修复自动格式、索引标题和高亮跳转相关问题，完成回归检查。', '', 'urgent'));
             push(4, dailyLog(4, '成果汇总', '汇总本周推广演示材料，形成页面模式展示用工作完成情况。', '', 'memo'));
              var nextWeek = item('下周工作', 7, 13, '下周安排通讯录功能完善、日志模板更新和用户培训准备：\n1.完善通讯录CSV、JS和MHTML导入；□\n2.测试多通讯录表头和列宽保存；□\n3.开展用户试用并汇总意见；…\n4.完成下周工作复盘。', '下周连续工作示例。', 'normal');
             nextWeek.subTimestamps = ['', '', '', ''];
             push(7, nextWeek);
             push(8, dailyLog(8, '通讯录测试', '测试多通讯录切换、表头设置、列宽拖动和范围检索。', '', 'normal'));
             push(10, dailyLog(10, '模板完善', '补充日志模板，检查上周、本周、下周工作及日期筛选效果。', '', 'normal'));
             push(12, dailyLog(12, '培训准备', '整理操作说明，准备日志页面视图和通讯录功能演示。', '', 'memo'));
             data.reportData = rd;
             data.templateType = 'log-demo';
            return data;
        }
        function applyLoadedData(data, fileName) {
            if (data.reminders) S.reminders = data.reminders;
            if (data.notes) { notes = data.notes; _saveNotes(); }
            if (data.noteCategories) { _noteCategories = _normalizeNoteCategories(data.noteCategories); _saveNoteCategories(); }
            for (var _ni = 0; _ni < notes.length; _ni++) {
                var _nc = notes[_ni].category;
                if (typeof _nc === 'string') notes[_ni].category = _noteCatNameToId(_nc);
                else if (typeof _nc !== 'number' || !_noteCatIdToObj(_nc)) notes[_ni].category = _noteCategories[0].id;
            }
            _saveNotes();
            if (data.noteCurrentCategory) {
                var _ncc = data.noteCurrentCategory;
                if (_ncc === 'all') _noteCurrentCategory = 'all';
                else if (!isNaN(parseInt(_ncc, 10)) && _noteCatIdToObj(parseInt(_ncc, 10))) _noteCurrentCategory = parseInt(_ncc, 10);
                else if (typeof _ncc === 'string') _noteCurrentCategory = _noteCatNameToId(_ncc);
                _saveNoteCurrentCategory();
            }
            refreshNoteCategorySelect();
            if (data.reportData) S.reportData = data.reportData;
            try { _migrateAllSubTimestamps(); } catch (_me) {}
            try { _migrateAllSubItemIds(); } catch (_me2) {}
            if (data.notepad) {
                if (data.notepad.data) S.notepadData = data.notepad.data;
                if (data.notepad.labels) S.notepadLabels = data.notepad.labels;
                // 空页不覆盖本地缓存（旧数据文件常见：只存了部分页面）
                S.notepadTitles = (typeof window._npMergeNotepadTitles === 'function')
                    ? window._npMergeNotepadTitles(data.notepad.titles, S.notepadTitles)
                    : (data.notepad.titles || S.notepadTitles);
                S.notepadEditorData = (typeof window._npMergeNotepadEditorData === 'function')
                    ? window._npMergeNotepadEditorData(data.notepad.editorData, S.notepadEditorData, data.notepad.data)
                    : (data.notepad.editorData || S.notepadEditorData);
                if (data.notepad.fontSizes) S.notepadFontSizes = data.notepad.fontSizes;
                if (Array.isArray(data.notepad.notebookStyles) && data.notepad.notebookStyles.length === 5) S.notepadNotebookStyles = data.notepad.notebookStyles.map(function(v){ return !!v; });
                if (data.notepad.zoomLevels) notepadZoomLevels = data.notepad.zoomLevels;
                updateNotepadTabs();
                syncEditorFromData();
                _saveNotepadToCache();
            }
            if (data.editorBoard && Array.isArray(data.editorBoard) && typeof window.paSetItems === 'function') {
                window.paSetItems(data.editorBoard);
            }
            updateCategoryList();
            // 模板数据跨越多周，切换到自定义范围以展示全部数据
            var isTemplate = fileName && /日志模板\.js$/i.test(fileName);
            if (isTemplate) {
                var today2 = new Date();
                var rangeStart = getMonday(today2); rangeStart.setDate(rangeStart.getDate() - 7);
                var rangeEnd = getSunday(today2); rangeEnd.setDate(rangeEnd.getDate() + 7);
                S.timeRangeType = 'custom';
                S.timeRangeStart = rangeStart;
                S.timeRangeEnd = rangeEnd;
                document.getElementById('timeRangeSelect').value = 'custom';
                try {
                    document.getElementById('customStartDate').value = fmtDate(rangeStart);
                    document.getElementById('customEndDate').value = fmtDate(rangeEnd);
                } catch(e) {}
            } else {
                // 非模板文件：保持周工作视图
                var today = new Date();
                var day = today.getDay();
                var diff = day === 0 ? -6 : 1 - day;
                var weekStart = new Date(today);
                weekStart.setDate(today.getDate() + diff);
                var weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                S.timeRangeType = 'week';
                S.timeRangeStart = weekStart;
                S.timeRangeEnd = weekEnd;
                document.getElementById('timeRangeSelect').value = 'week';
            }
            S.currentYear = new Date().getFullYear();
            S.currentMonth = new Date().getMonth();
            S.selectedDate = new Date();
            updateTimeRangeDisplay();
            renderCalendar();
            renderReminders();
            renderNotes();
            renderTrackContent();
            showToast('打开成功: ' + fileName);
        }
        // 自动加载时使用：跳过笔记覆盖，保留 localStorage 中的最新笔记
        function applyLoadedDataSkipNotes(data, fileName) {
            if (data.reminders) S.reminders = data.reminders;
            // 跳过笔记覆盖：notes = data.notes; _saveNotes();
            // 跳过笔记分类覆盖：_noteCategories = ...
            // 跳过笔记当前分类覆盖
            if (data.reportData) S.reportData = data.reportData;
            try { _migrateAllSubTimestamps(); } catch (_me) {}
            try { _migrateAllSubItemIds(); } catch (_me2) {}
            if (data.notepad) {
                if (data.notepad.data) S.notepadData = data.notepad.data;
                if (data.notepad.labels) S.notepadLabels = data.notepad.labels;
                // 自动加载（启动时）同样逐页合并：空页保留 localStorage 中的最新内容
                S.notepadTitles = (typeof window._npMergeNotepadTitles === 'function')
                    ? window._npMergeNotepadTitles(data.notepad.titles, S.notepadTitles)
                    : (data.notepad.titles || S.notepadTitles);
                S.notepadEditorData = (typeof window._npMergeNotepadEditorData === 'function')
                    ? window._npMergeNotepadEditorData(data.notepad.editorData, S.notepadEditorData, data.notepad.data)
                    : (data.notepad.editorData || S.notepadEditorData);
                if (data.notepad.fontSizes) S.notepadFontSizes = data.notepad.fontSizes;
                if (Array.isArray(data.notepad.notebookStyles) && data.notepad.notebookStyles.length === 5) S.notepadNotebookStyles = data.notepad.notebookStyles.map(function(v){ return !!v; });
                if (data.notepad.zoomLevels) notepadZoomLevels = data.notepad.zoomLevels;
                updateNotepadTabs();
                syncEditorFromData();
                _saveNotepadToCache();
            }
            if (data.editorBoard && Array.isArray(data.editorBoard) && typeof window.paSetItems === 'function') {
                window.paSetItems(data.editorBoard);
            }
            updateCategoryList();
            // 非模板文件：保持周工作视图
            var today = new Date();
            var day = today.getDay();
            var diff = day === 0 ? -6 : 1 - day;
            var weekStart = new Date(today);
            weekStart.setDate(today.getDate() + diff);
            var weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            S.timeRangeType = 'week';
            S.timeRangeStart = weekStart;
            S.timeRangeEnd = weekEnd;
            document.getElementById('timeRangeSelect').value = 'week';
            S.currentYear = new Date().getFullYear();
            S.currentMonth = new Date().getMonth();
            S.selectedDate = new Date();
            updateTimeRangeDisplay();
            renderCalendar();
            renderReminders();
            renderNotes();
            renderTrackContent();
        }
        function openData() {
            selectedFilePath = '';
            selectedFileName = '';
            document.getElementById('fileSelectorModal').classList.add('show');
            scanWorkLogFiles();
        }

        function loadBuiltinTemplate() {
            try {
                closeFileSelectorModal();
                var data = _buildLogDemoTemplateData({});
                applyLoadedData(data, '日志模板.js');
            } catch (e) {
                console.warn('[template] 加载演示模板失败:', e);
                showToast('加载演示模板失败: ' + e.message);
            }
        }
        
        function loadDataFile(event) {
            var file = event.target.files[0];
            if (!file) return;
            S.currentDataFileName = file.name;
            updateLastLoadedFile(file.name);
            var reader = new FileReader();
            reader.onload = function(e) { loadDataContent(e.target.result, file.name); };
            reader.onerror = function() { showToast('文件读取失败'); };
            reader.readAsText(file, 'UTF-8');
            event.target.value = '';
        }
        
        function saveData() {
            saveCurrentEditor();
            cleanEmptyReportData();
            var editorBoard = (typeof window.paGetItems === 'function') ? window.paGetItems() : null;
            var data = { reminders: reminders, notes: notes, noteCategories: _noteCategories, noteCurrentCategory: _noteCurrentCategory, reportData: reportData, notepad: { data: notepadData, titles: notepadTitles, labels: notepadLabels, editorData: notepadEditorData, fontSizes: notepadFontSizes, notebookStyles: notepadNotebookStyles, zoomLevels: notepadZoomLevels }, editorBoard: editorBoard };
            var content = 'var savedData = ' + JSON.stringify(data, null, 2) + ';';
            saveDataBlob = new Blob([content], { type: 'application/javascript' });
            showSaveDataModal();
        }
        var saveDataBlob = null;
        var saveDataDirHandle = null;
        function previewExternalFile(event) {
            var file = event.target.files[0];
            if (!file) return;
            var url = URL.createObjectURL(file);
            var body = document.getElementById('previewModalBody');
            var title = document.getElementById('previewModalTitle');
            title.textContent = file.name;
            body.innerHTML = '';
            if (file.type.startsWith('image/')) {
                var img = document.createElement('img');
                img.src = url;
                img.style.maxWidth = '100%';
                img.style.maxHeight = '100%';
                img.style.objectFit = 'contain';
                body.appendChild(img);
            } else if (file.type === 'application/pdf') {
                var embed = document.createElement('embed');
                embed.src = url;
                embed.style.width = '100%';
                embed.style.height = '100%';
                body.appendChild(embed);
            } else {
                showToast('不支持预览该文件类型');
                URL.revokeObjectURL(url);
                return;
            }
            document.getElementById('previewModal').classList.add('show');
            event.target.value = '';
        }
        function closePreviewModal() {
            document.getElementById('previewModal').classList.remove('show');
            var body = document.getElementById('previewModalBody');
            var embeds = body.querySelectorAll('embed');
            embeds.forEach(function(e) {
                try { URL.revokeObjectURL(e.src); } catch(ex) {}
            });
            var imgs = body.querySelectorAll('img');
            imgs.forEach(function(i) {
                try { URL.revokeObjectURL(i.src); } catch(ex) {}
            });
            body.innerHTML = '';
        }
        function isKylinOS() {
            try {
                var ua = (navigator.userAgent || '') + ' ' + (navigator.platform || '') + ' ' + (navigator.appVersion || '');
                return /kylin|麒麟|uos|uniontech/i.test(ua);
            } catch (e) { return false; }
        }
        function applySaveDataModalKylinUI() {
            var overwriteBtn = document.getElementById('saveDataOverwriteBtn');
            var asNewBtn = document.getElementById('saveDataAsNewBtn');
            if (!overwriteBtn || !asNewBtn) return;
            if (isKylinOS()) {
                overwriteBtn.style.display = 'none';
                asNewBtn.textContent = '保存';
            } else {
                overwriteBtn.style.display = '';
                asNewBtn.textContent = '另存';
            }
        }
        function toggleSaveDropdown(e) {
            e.stopPropagation();
            var menu = document.getElementById('saveDropdownMenu');
            menu.classList.toggle('show');
        }
        function closeSaveDropdown() {
            document.getElementById('saveDropdownMenu').classList.remove('show');
        }
        function saveDataAsLogJs() {
            saveCurrentEditor();
            cleanEmptyReportData();
            var editorBoard = (typeof window.paGetItems === 'function') ? window.paGetItems() : null;
            var data = { reminders: reminders, notes: notes, noteCategories: _noteCategories, noteCurrentCategory: _noteCurrentCategory, reportData: reportData, notepad: { data: notepadData, titles: notepadTitles, labels: notepadLabels, editorData: notepadEditorData, fontSizes: notepadFontSizes, notebookStyles: notepadNotebookStyles, zoomLevels: notepadZoomLevels }, editorBoard: editorBoard };
            var content = 'var savedData = ' + JSON.stringify(data, null, 2) + ';';
            saveDataBlob = new Blob([content], { type: 'application/javascript' });
            if (!confirm('将把日志、备忘、便签保存为.js文件，是否继续？')) return;
            var now = new Date();
            var fileName = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + ' 日志.js';
            var dirHandle = saveDataDirHandle || workLogDirHandle;
            if (dirHandle && dirHandle.getFileHandle) {
                (async function() {
                    try {
                        var fileHandle = await dirHandle.getFileHandle(fileName, {create: true});
                        var writable = await fileHandle.createWritable({keepExistingData: false});
                        await writable.write({type: 'write', data: saveDataBlob});
                        await writable.close();
                        updateFooterTimestamp();
                        try { if (typeof saveToPersistentFile === 'function') saveToPersistentFile(); } catch (e) { console.warn('[save] 持久化写入失败:', e); }
                        showToast('保存成功: ' + fileName);
                    } catch(e) {
                        kylinFallbackDownloadForLogJs(fileName);
                    }
                })();
                return;
            }
            if (window.showSaveFilePicker) {
                (async function() {
                    try {
                        var opts = {
                            suggestedName: fileName,
                            types: [{description: '数据', accept: {'application/javascript': ['.js']}}]
                        };
                        if (dirHandle) opts.startIn = dirHandle;
                        var fileHandle = await window.showSaveFilePicker(opts);
                        var writable = await fileHandle.createWritable({keepExistingData: false});
                        await writable.write({type: 'write', data: saveDataBlob});
                        await writable.close();
                        updateFooterTimestamp();
                        try { if (typeof saveToPersistentFile === 'function') saveToPersistentFile(); } catch (e) { console.warn('[save] 持久化写入失败:', e); }
                        showToast('保存成功: ' + fileName);
                    } catch(e) {
                        kylinFallbackDownloadForLogJs(fileName);
                    }
                })();
                return;
            }
            kylinFallbackDownloadForLogJs(fileName);
        }
        function kylinFallbackDownloadForLogJs(fileName) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(saveDataBlob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            updateFooterTimestamp();
            try { if (typeof saveToPersistentFile === 'function') saveToPersistentFile(); } catch (e) { console.warn('[save] 持久化写入失败:', e); }
            var folderHint = scanFolderName || (saveDataDirHandle && saveDataDirHandle.name) || (workLogDirHandle && workLogDirHandle.name) || '数据';
            showToast('已下载 ' + fileName + '（请移至"' + folderHint + '"文件夹）');
        }
        document.addEventListener('click', function(e) {
            var wrap = document.getElementById('saveDropdownWrap');
            if (wrap && !wrap.contains(e.target)) closeSaveDropdown();
        });
        function saveAllToCache() {
            _autoSaveIfDirty();
            saveCurrentEditor();
            if (_writeNoteMode && !_materialMode) _clearWriteNoteArticleDirty();
            _saveNotepadToCache();
            _saveReportToCache();
            try { DataLayer.set('reminders', reminders) } catch (e) {}
            _saveNotes(); _saveNoteCategories(); _saveNoteCurrentCategory();
            _saveReminderTab(); _saveReminderFullscreen();
            if (typeof window.paGetItems === 'function') {
                try { DataLayer.set('problemAnalysisItems', window.paGetItems()) } catch (e) {}
            }
            // 同时写入 appdata.js 持久化文件
            try { if (typeof saveToPersistentFile === 'function') saveToPersistentFile(); } catch (e) { console.warn('[save] 持久化保存失败:', e); }
            updateFooterTimestamp();
            showToast('缓存已保存');
        }
        // 静默周期自动缓存：与 saveAllToCache 写入相同模块，但不弹提示、不递增更新次数
        function saveAllToCacheSilent() {
            if (_writeNoteMode && !_materialMode) { try { _clearWriteNoteArticleDirty(); } catch (e) {} }
            try { saveCurrentEditor(); } catch (e) { console.warn('[autoCache] 保存编辑器失败:', e); }
            try { _saveNotepadToCache(); } catch (e) { console.warn('[autoCache] 保存笔记缓存失败:', e); }
            try { _saveReportToCache(); } catch (e) { console.warn('[autoCache] 保存日志缓存失败:', e); }
            try { DataLayer.set('reminders', reminders); } catch (e) { console.warn('[autoCache] 保存备忘失败:', e); }
            try { _saveNotes(); _saveNoteCategories(); _saveNoteCurrentCategory(); } catch (e) { console.warn('[autoCache] 保存随笔失败:', e); }
            try { _saveReminderTab(); _saveReminderFullscreen(); } catch (e) {}
            if (typeof window.paGetItems === 'function') {
                try { DataLayer.set('problemAnalysisItems', window.paGetItems()); } catch (e) { console.warn('[autoCache] 保存编辑器失败:', e); }
            }
            try { if (typeof saveToPersistentFile === 'function') saveToPersistentFile(); } catch (e) { console.warn('[autoCache] 持久化保存失败:', e); }
        }
        (function startAutoCacheTimer() {
            var AUTO_CACHE_INTERVAL_MS = 60000;
            if (window._autoCacheTimer) { clearInterval(window._autoCacheTimer); }
            window._autoCacheTimer = setInterval(function() {
                try { saveAllToCacheSilent(); } catch (e) { console.warn('[autoCache] 周期保存失败:', e); }
            }, AUTO_CACHE_INTERVAL_MS);
        })();
        function showSaveDataModal() {
            saveCurrentEditor();
            cleanEmptyReportData();
            var editorBoard = (typeof window.paGetItems === 'function') ? window.paGetItems() : null;
            var data = { reminders: reminders, notes: notes, noteCategories: _noteCategories, noteCurrentCategory: _noteCurrentCategory, reportData: reportData, notepad: { data: notepadData, titles: notepadTitles, labels: notepadLabels, editorData: notepadEditorData, fontSizes: notepadFontSizes, notebookStyles: notepadNotebookStyles, zoomLevels: notepadZoomLevels }, editorBoard: editorBoard };
            var content = 'var savedData = ' + JSON.stringify(data, null, 2) + ';';
            saveDataBlob = new Blob([content], { type: 'application/javascript' });
            document.getElementById('saveDataModalBody').innerHTML = '';
            document.getElementById('saveDataModalEmpty').style.display = 'none';
            document.getElementById('saveDataModal').classList.add('show');
            applySaveDataModalKylinUI();
            var dirHandle = workLogDirHandle;
            if (!dirHandle && Object.keys(cachedFileMap).length > 0) {
                var files = Object.keys(cachedFileMap).sort().reverse();
                populateSaveDataList(files);
                if (scanFolderName) {
                    document.getElementById('saveDataModalPathText').textContent = scanFolderName;
                    document.getElementById('saveDataModalPath').style.display = 'flex';
                }
                return;
            }
            if (!dirHandle) {
                if (window.showDirectoryPicker) {
                    (async function() {
                        try {
                            var dh = await window.showDirectoryPicker({id: 'worklog-save-dir', mode: 'readwrite'});
                            saveDataDirHandle = dh;
                            // 同时用于数据持久化写入
                            if (typeof window.setSaveDataDirHandle === 'function') {
                                try { window.setSaveDataDirHandle(dh); } catch(e) {}
                            }
                            document.getElementById('saveDataModalPathText').textContent = dh.name;
                            document.getElementById('saveDataModalPath').style.display = 'flex';
                            await refreshSaveDataList();
                        } catch(e) {
                            document.getElementById('saveDataModalPath').style.display = 'none';
                            document.getElementById('saveDataModalBody').innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">选择已取消</td></tr>';
                        }
                    })();
                }
            } else {
                saveDataDirHandle = dirHandle;
                document.getElementById('saveDataModalPathText').textContent = scanFolderName || dirHandle.name;
                document.getElementById('saveDataModalPath').style.display = 'flex';
                refreshSaveDataList();
            }
        }
        async function refreshSaveDataList() {
            var body = document.getElementById('saveDataModalBody');
            body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">正在读取...</td></tr>';
            var files = [];
            try {
                for await (var entry of saveDataDirHandle.values()) {
                    if (entry.kind === 'file' && entry.name.endsWith('.js')) {
                        files.push(entry.name);
                    }
                }
            } catch(e) {
                body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">读取失败</td></tr>';
                return;
            }
            files.sort().reverse();
            populateSaveDataList(files);
        }
        function populateSaveDataList(files) {
            var body = document.getElementById('saveDataModalBody');
            var empty = document.getElementById('saveDataModalEmpty');
            if (files.length === 0) {
                body.innerHTML = '';
                empty.style.display = 'block';
                return;
            }
            empty.style.display = 'none';
            body.innerHTML = '';
            for (var i = 0; i < files.length; i++) {
                (function(fname, idx) {
                    var tr = document.createElement('tr');
                    tr.innerHTML = '<td>' + (idx + 1) + '</td><td style="text-align:left;padding-left:15px;">' + fname + '</td><td><input type="radio" name="saveDataRadio" value="' + fname + '"></td>';
                    tr.addEventListener('click', function(e) {
                        if (e.target.tagName === 'INPUT') return;
                        var radio = tr.querySelector('input[type="radio"]');
                        if (radio) radio.checked = true;
                        var allRows = body.querySelectorAll('tr');
                        for (var j = 0; j < allRows.length; j++) allRows[j].classList.remove('selected');
                        tr.classList.add('selected');
                    });
                    body.appendChild(tr);
                })(files[i], i);
            }
        }
        function closeSaveDataModal() {
            document.getElementById('saveDataModal').classList.remove('show');
        }
        async function confirmSaveDataOverwrite() {
            var selected = document.querySelector('#saveDataModalBody input[type="radio"]:checked');
            if (!selected) { showToast('请选择一个文件覆盖'); return; }
            var fileName = selected.value;
            try {
                var fileHandle = await saveDataDirHandle.getFileHandle(fileName);
                var writable = await fileHandle.createWritable({keepExistingData: false});
                await writable.write({type: 'write', data: saveDataBlob});
                await writable.close();
                closeSaveDataModal();
                updateFooterTimestamp();
                showToast('覆盖保存成功: ' + fileName);
            } catch(e) {
                showToast('保存失败: ' + e.message);
            }
        }
        function confirmSaveDataAsNew() {
            var now = new Date();
            var fileName = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + ' 数据.js';
            var dirHandle = saveDataDirHandle || workLogDirHandle;
            if (dirHandle && dirHandle.getFileHandle) {
                (async function() {
                    try {
                        var fileHandle = await dirHandle.getFileHandle(fileName, {create: true});
                        var writable = await fileHandle.createWritable({keepExistingData: false});
                        await writable.write({type: 'write', data: saveDataBlob});
                        await writable.close();
                        closeSaveDataModal();
                        updateFooterTimestamp();
                        showToast('保存成功: ' + fileName);
                    } catch(e) {
                        kylinFallbackDownload(fileName);
                    }
                })();
                return;
            }
            if (window.showSaveFilePicker) {
                (async function() {
                    try {
                        var opts = {
                            suggestedName: fileName,
                            types: [{description: '数据', accept: {'application/javascript': ['.js']}}]
                        };
                        if (dirHandle) opts.startIn = dirHandle;
                        var fileHandle = await window.showSaveFilePicker(opts);
                        var writable = await fileHandle.createWritable({keepExistingData: false});
                        await writable.write({type: 'write', data: saveDataBlob});
                        await writable.close();
                        closeSaveDataModal();
                        updateFooterTimestamp();
                        showToast('保存成功: ' + fileName);
                    } catch(e) {
                        kylinFallbackDownload(fileName);
                    }
                })();
                return;
            }
            kylinFallbackDownload(fileName);
        }
        function kylinFallbackDownload(fileName) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(saveDataBlob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            closeSaveDataModal();
            updateFooterTimestamp();
            var folderHint = scanFolderName || (saveDataDirHandle && saveDataDirHandle.name) || (workLogDirHandle && workLogDirHandle.name) || '数据';
            showToast('已下载 ' + fileName + '（请移至"' + folderHint + '"文件夹）');
        }
        
        var notepadDirHandle = null;
        var openedNotepadFiles = {};
        var currentNotepadFileInfo = null;
        var notepadSelectedFolder = null;
        var notepadSelectedDirHandle = null;
        var notepadSaveSelectedFolder = null;
        var notepadSaveSelectedDirHandle = null;
        var notepadFolderEntries = [];
        var notepadImportFileMap = {};
        var notepadScannedHandleMap = {};
        function updateNotepadFileLabel() {
            var label = document.getElementById('notepadOpenFileLabel');
            if (!label) return;
            if (currentNotepadFileInfo) {
                label.textContent = currentNotepadFileInfo.folderName + '/' + currentNotepadFileInfo.fileName;
                label.title = label.textContent;
            } else {
                label.textContent = '';
                label.title = '';
            }
        }
        function changeNotepadOpenRootFolder() {
            notebookRootHandle = null;
            notepadDirHandle = null;
            notepadSelectedFolder = null;
            notepadSaveSelectedFolder = null;
            notepadFolderEntries = [];
            notepadScannedHandleMap = {};
            notepadImportFileMap = {};
            idbPut('notebookRootHandle', null);
            showNotepadOpenModal();
        }
        function showNotepadOpenModal() {
            document.getElementById('notepadOpenModalBody').innerHTML = '';
            document.getElementById('notepadOpenModalEmpty').style.display = 'none';
            document.getElementById('notepadOpenModal').classList.add('show');
            var selectDirBtn = document.getElementById('notepadOpenSelectDirBtn');
            var folderText = document.getElementById('notepadOpenModalFolderText');
            var folderBar = document.getElementById('notepadOpenModalFolderBar');
            if (!notepadDirHandle && notebookRootHandle) {
                (async function() {
                    try {
                        notepadDirHandle = notebookRootHandle;
                        notepadFolderEntries = [];
                        try {
                            for await (var entry of notebookRootHandle.values()) {
                                if (entry.kind === 'directory') notepadFolderEntries.push(entry.name);
                            }
                        } catch(e) {}
                        notepadFolderEntries.sort();
                        notepadSelectedFolder = notepadFolderEntries.length ? notepadFolderEntries[0] : null;
                        notepadSaveSelectedFolder = notepadSelectedFolder;
                        if (notepadSelectedFolder) {
                            try {
                                for await (var entry of notebookRootHandle.values()) {
                                    if (entry.kind === 'directory' && entry.name === notepadSelectedFolder) {
                                        notepadSelectedDirHandle = entry;
                                        notepadSaveSelectedDirHandle = entry;
                                        break;
                                    }
                                }
                            } catch(e) {}
                        }
                        folderBar.style.display = 'flex';
                        folderText.textContent = notebookRootHandle.name;
                        populateNotepadSubfolderSelects();
                    } catch(e) {
                        selectDirBtn.style.display = '';
                        selectDirBtn.textContent = '选择笔记文件夹';
                        selectDirBtn.onclick = selectNotepadRootDir;
                        folderBar.style.display = 'flex';
                        folderText.textContent = '';
                    }
                })();
                return;
            }
            if (notepadDirHandle || Object.keys(notepadImportFileMap).length > 0) {
                folderBar.style.display = 'flex';
                if (notepadDirHandle) {
                    folderText.textContent = notepadDirHandle.name;
                    populateNotepadSubfolderSelects();
                } else {
                    folderText.textContent = '已选择文件夹';
                    document.getElementById('notepadOpenSubfolderSelect').style.display = 'none';
                    refreshNotepadOpenList();
                }
            } else {
                selectDirBtn.style.display = '';
                selectDirBtn.textContent = '选择笔记文件夹';
                selectDirBtn.onclick = selectNotepadRootDir;
                folderBar.style.display = 'flex';
                folderText.textContent = '';
                document.getElementById('notepadOpenModalBody').innerHTML = '';
            }
        }
function selectNotepadRootDir() {
            if (window.showDirectoryPicker) {
                (async function() {
                    try {
                        var rootHandle = await pickNotebookRoot();
                        if (!rootHandle) return;
                        notebookRootHandle = rootHandle;
                        try {
                            notepadDirHandle = rootHandle;
                    notepadScannedHandleMap = {};
                            notepadFolderEntries = [];
                            try {
                                for await (var entry of rootHandle.values()) {
                                    if (entry.kind === 'directory') notepadFolderEntries.push(entry.name);
                                }
                            } catch(e) {}
                            notepadFolderEntries.sort();
                            notepadSelectedFolder = notepadFolderEntries.length ? notepadFolderEntries[0] : null;
                            notepadSaveSelectedFolder = notepadSelectedFolder;
                            if (notepadSelectedFolder) {
                                try {
                                    for await (var entry of rootHandle.values()) {
                                        if (entry.kind === 'directory' && entry.name === notepadSelectedFolder) {
                                            notepadSelectedDirHandle = entry;
                                            notepadSaveSelectedDirHandle = entry;
                                            break;
                                        }
                                    }
                                } catch(e) {}
                            }
                            var folderText = document.getElementById('notepadOpenModalFolderText');
                            if (folderText) folderText.textContent = rootHandle.name;
                            document.getElementById('notepadOpenModalEmpty').style.display = 'none';
                            populateNotepadSubfolderSelects();
                            if (!notepadSelectedDirHandle) notepadSelectedDirHandle = notepadDirHandle;
                            refreshNotepadOpenList();
                        } catch(e) {
                            showToast('无法读取文件夹: ' + e.message);
                        }
                    } catch(e) {
                        document.getElementById('notepadImportFolderInput').click();
                    }
                })();
            } else {
                document.getElementById('notepadImportFolderInput').click();
            }
        }
        function populateNotepadSubfolderSelects() {
            var openSelect = document.getElementById('notepadOpenSubfolderSelect');
            var saveSelect = document.getElementById('notepadSaveSubfolderSelect');
            var entries = notepadFolderEntries || [];
            [openSelect, saveSelect].forEach(function(sel) {
                if (!sel) return;
                sel.innerHTML = '';
                if (entries.length) {
                    sel.style.display = '';
                    for (var i = 0; i < entries.length; i++) {
                        var opt = document.createElement('option');
                        opt.value = entries[i];
                        opt.textContent = entries[i];
                        sel.appendChild(opt);
                    }
                } else {
                    sel.style.display = 'none';
                }
            });
            if (openSelect && entries.length) {
                openSelect.onchange = function() {
                    notepadSelectedFolder = openSelect.value;
                    notepadSelectedDirHandle = null;
                    (async function() {
                        try {
                            for await (var entry of notepadDirHandle.values()) {
                                if (entry.kind === 'directory' && entry.name === notepadSelectedFolder) {
                                    notepadSelectedDirHandle = entry;
                                    break;
                                }
                            }
                        } catch(e) {}
                        refreshNotepadOpenList();
                    })();
                };
                if (!notepadSelectedFolder) {
                    openSelect.selectedIndex = 0;
                    openSelect.onchange();
                } else {
                    openSelect.value = notepadSelectedFolder;
                    openSelect.onchange();
                }
            } else if (openSelect && !entries.length && notepadDirHandle) {
                notepadSelectedDirHandle = notepadDirHandle;
                refreshNotepadOpenList();
            }
            if (saveSelect && entries.length) {
                saveSelect.onchange = function() {
                    notepadSaveSelectedFolder = saveSelect.value;
                    notepadSaveSelectedDirHandle = null;
                    (async function() {
                        try {
                            for await (var entry of notepadDirHandle.values()) {
                                if (entry.kind === 'directory' && entry.name === notepadSaveSelectedFolder) {
                                    notepadSaveSelectedDirHandle = entry;
                                    break;
                                }
                            }
                        } catch(e) {}
                        if (typeof refreshNotepadSaveList === 'function') refreshNotepadSaveList();
                    })();
                };
                if (!notepadSaveSelectedFolder) {
                    saveSelect.selectedIndex = 0;
                    saveSelect.onchange();
                } else {
                    saveSelect.value = notepadSaveSelectedFolder;
                    saveSelect.onchange();
                }
            }
        }
        // 尝试从 IndexedDB 恢复笔记文件夹句柄
        async function _tryRestoreNotepadDirHandles() {
            try {
                var savedRoot = await idbGet('notebookRootHandle');
                if (!savedRoot) return false;
                var ok = await verifyPermission(savedRoot, true);
                if (!ok) return false;
                notebookRootHandle = savedRoot;
                notepadDirHandle = savedRoot;
                notepadFolderEntries = [];
                try {
                    for await (var entry of savedRoot.values()) {
                        if (entry.kind === 'directory') notepadFolderEntries.push(entry.name);
                    }
                } catch(e) {}
                notepadFolderEntries.sort();
                notepadSelectedFolder = notepadFolderEntries.length ? notepadFolderEntries[0] : null;
                notepadSaveSelectedFolder = notepadSelectedFolder;
                if (notepadSelectedFolder) {
                    try {
                        for await (var entry of savedRoot.values()) {
                            if (entry.kind === 'directory' && entry.name === notepadSelectedFolder) {
                                notepadSelectedDirHandle = entry;
                                notepadSaveSelectedDirHandle = entry;
                                break;
                            }
                        }
                    } catch(e) {}
                }
                return true;
            } catch(e) { return false; }
        }
        async function refreshNotepadOpenList() {
            var body = document.getElementById('notepadOpenModalBody');
            var empty = document.getElementById('notepadOpenModalEmpty');
            body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">正在读取...</td></tr>';
            var files = [];
            var importMode = false;
            if (notepadImportFileMap && Object.keys(notepadImportFileMap).length > 0) {
                importMode = true;
                var seen = {};
                for (var fname in notepadImportFileMap) {
                    var ext = fname.toLowerCase().replace(/.*\./, '');
                    if (ext === 'html' || ext === 'htm' || ext === 'mht' || ext === 'js') {
                        if (!seen[fname]) {
                            seen[fname] = true;
                            files.push({name: fname, handle: notepadImportFileMap[fname], ext: ext});
                        }
                    }
                }
                files.sort(function(a, b) { return a.name.localeCompare(b.name); });
            } else if (notepadSelectedDirHandle || notepadDirHandle) {
                var dirH = notepadSelectedDirHandle || notepadDirHandle;
                var permOk = await verifyPermission(dirH, true);
                if (!permOk) {
                    // 尝试从 IndexedDB 恢复
                    var restored = await _tryRestoreNotepadDirHandles();
                    if (restored) {
                        dirH = notepadSelectedDirHandle || notepadDirHandle;
                        permOk = true;
                    }
                }
                if (!permOk) {
                    body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">文件夹权限已失效，请重新选择文件夹</td></tr>';
                    empty.style.display = 'none';
                    return;
                }
                try {
                    for await (var entry of dirH.values()) {
                        if (entry.kind === 'file') {
                            var ext = entry.name.toLowerCase().replace(/.*\./, '');
                            if (ext === 'html' || ext === 'htm' || ext === 'mht' || ext === 'js') {
                                files.push({name: entry.name, handle: entry, ext: ext});
                            }
                        }
                    }
                } catch(e) {
                    body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">读取失败</td></tr>';
                    return;
                }
            } else {
                body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">请先选择文件夹</td></tr>';
                empty.style.display = 'none';
                return;
            }
            notepadScannedHandleMap = {};
            for (var i = 0; i < files.length; i++) {
                if (typeof files[i].handle.getFile === 'function') {
                    notepadScannedHandleMap[files[i].name] = files[i].handle;
                }
            }
            if (files.length === 0) {
                body.innerHTML = '';
                empty.style.display = 'block';
                return;
            }
            empty.style.display = 'none';
            body.innerHTML = '';
            for (var i = 0; i < files.length; i++) {
                (function(fn, fExt, idx) {
                    var tr = document.createElement('tr');
                    tr.innerHTML = '<td>' + (idx + 1) + '</td><td style="text-align:left;padding-left:15px;">' + fn + '</td><td><input type="checkbox" value="' + fn.replace(/"/g,'&quot;') + '"></td>';
                    tr.addEventListener('click', function(e) {
                        // 只有点击行（不是复选框）时才切换复选框状态
                        if (e.target.tagName !== 'INPUT') {
                            var cb = tr.querySelector('input[type="checkbox"]');
                            if (cb) {
                                cb.checked = !cb.checked;
                                if (cb.checked) {
                                    tr.classList.add('selected');
                                } else {
                                    tr.classList.remove('selected');
                                }
                            }
                        } else {
                            // 直接点击复选框时，更新行的样式
                            var cb = e.target;
                            if (cb.checked) {
                                tr.classList.add('selected');
                            } else {
                                tr.classList.remove('selected');
                            }
                        }
                    });
                    body.appendChild(tr);
                })(files[i].name, files[i].ext || '', i);
            }
        }
        async function refreshNotepadSaveList() {
            var body = document.getElementById('notepadSaveModalBody');
            var empty = document.getElementById('notepadSaveModalEmpty');
            if (!body) return;
            body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">正在读取...</td></tr>';
            var files = [];
            var dirHandle = notepadSaveSelectedDirHandle || notepadDirHandle;
            if (dirHandle) {
                var permOk = await verifyPermission(dirHandle, true);
                if (!permOk) {
                    var restored = await _tryRestoreNotepadDirHandles();
                    if (restored) {
                        dirHandle = notepadSaveSelectedDirHandle || notepadDirHandle;
                        permOk = true;
                    }
                }
                if (!permOk) {
                    body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">文件夹权限已失效，请重新选择文件夹</td></tr>';
                    if (empty) empty.style.display = 'none';
                    return;
                }
                try {
                    for await (var entry of dirHandle.values()) {
                        if (entry.kind === 'file') {
                            var ext = entry.name.toLowerCase().replace(/.*\./, '');
                            if (ext === 'html' || ext === 'htm') {
                                files.push({name: entry.name, handle: entry, ext: ext});
                            }
                        }
                    }
                } catch(e) {
                    body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">读取失败</td></tr>';
                    return;
                }
            } else {
                body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">请先选择文件夹</td></tr>';
                if (empty) empty.style.display = 'none';
                return;
            }
            if (files.length === 0) {
                body.innerHTML = '';
                if (empty) empty.style.display = 'block';
                return;
            }
            if (empty) empty.style.display = 'none';
            body.innerHTML = '';
            for (var i = 0; i < files.length; i++) {
                (function(fn, idx) {
                    var tr = document.createElement('tr');
                    tr.innerHTML = '<td>' + (idx + 1) + '</td><td style="text-align:left;padding-left:15px;">' + fn + '</td><td><button onclick="selectNotepadSaveFile(\'' + fn.replace(/'/g,"\\'") + '\')" style="padding:2px 8px;font-size:11px;border:1px solid #ccc;border-radius:3px;background:#f5f5f5;cursor:pointer;">选择</button></td>';
                    body.appendChild(tr);
                })(files[i].name, i);
            }
        }
        function closeNotepadOpenModal() {
            document.getElementById('notepadOpenModal').classList.remove('show');
        }
        function onNotepadImportFolderSelected(event) {
            var files = event.target.files;
            if (!files || files.length === 0) {
                showToast('未选择文件夹');
                return;
            }
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
            if (Object.keys(notepadImportFileMap).length === 0) {
                showToast('该文件夹下未找到 .html .htm .mht .js 文件');
                return;
            }
            notepadDirHandle = null;
            notepadSelectedDirHandle = null;
            notepadFolderEntries = [];
            var folderText = document.getElementById('notepadOpenModalFolderText');
            if (folderText) folderText.textContent = '已选择文件夹';
            document.getElementById('notepadOpenSubfolderSelect').style.display = 'none';
            document.getElementById('notepadOpenModalEmpty').style.display = 'none';
            refreshNotepadOpenList();
            event.target.value = '';
        }
        async function confirmNotepadOpen() {
            var checkboxes = document.querySelectorAll('#notepadOpenModalBody input[type="checkbox"]:checked');
            if (checkboxes.length === 0) { showToast('请至少选择一个文件'); return; }
            var selectedFiles = [];
            for (var i = 0; i < checkboxes.length; i++) {
                selectedFiles.push(checkboxes[i].value);
            }
            var importedCount = 0;
            var tabIdx = currentNotepadTab;
            for (var fi = 0; fi < selectedFiles.length; fi++) {
                var fileName = selectedFiles[fi];
                var ext = fileName.toLowerCase().replace(/.*\./, '');
                var fileObj = null;
                if (notepadImportFileMap[fileName]) {
                    fileObj = notepadImportFileMap[fileName];
                } else if (notepadScannedHandleMap[fileName]) {
                    try {
                        fileObj = await notepadScannedHandleMap[fileName].getFile();
                    } catch(e) {
                        var readHandle = notepadSelectedDirHandle || notepadDirHandle;
                        try {
                            var fh = await readHandle.getFileHandle(fileName);
                            fileObj = await fh.getFile();
                        } catch(e2) { showToast('无法读取文件: ' + fileName); continue; }
                    }
                } else if (notepadSelectedDirHandle || notepadDirHandle) {
                    var readHandle = notepadSelectedDirHandle || notepadDirHandle;
                    try {
                        var fh = await readHandle.getFileHandle(fileName);
                        fileObj = await fh.getFile();
                    } catch(e) { showToast('无法读取文件: ' + fileName); continue; }
                }
                if (!fileObj) { showToast('无法读取文件: ' + fileName); continue; }
                if (ext === 'js') {
                    var content = await new Promise(function(resolve, reject) {
                        var reader = new FileReader();
                        reader.onload = function(e) { resolve(e.target.result); };
                        reader.onerror = function() { reject(reader.error); };
                        reader.readAsText(fileObj, 'UTF-8');
                    });
                    var jsData = parseNotepadJsData(content);
                    if (!jsData) { showToast('JS文件格式错误: ' + fileName); continue; }
                    var isMultiPage = _isMultiPageJsData(jsData);
                    if (isMultiPage) {
                        var confirmed = await showNotepadJsConfirmDialog();
                        if (!confirmed) continue;
                        saveCurrentEditor();
                        closeNotepadOpenModal();
                        _applyNotepadJsData(jsData);
                        // 刷新当前标签页的显示
                        if (typeof syncEditorFromData === 'function') syncEditorFromData();
                        if (typeof updateNotepadTabStyle === 'function') updateNotepadTabStyle();
                        showToast('多页面数据导入成功');
                        break;
                    } else {
                        if (!jsData.notepad || !jsData.notepad.editorData) { showToast('JS 文件格式错误：缺少 notepad 数据'); continue; }
                        if (tabIdx >= 5) tabIdx = 0;
                        var pIdx = 0;
                        for (var pi = 0; pi < 5; pi++) {
                            if (jsData.notepad.editorData[pi] && jsData.notepad.editorData[pi].html && jsData.notepad.editorData[pi].html.trim()) { pIdx = pi; break; }
                        }
                        var pData = jsData.notepad.editorData[pIdx] || {html:'',bold:false};
                        var pTitle = jsData.notepad.titles[pIdx] || fileName.replace(/\.js$/i, '');
                        saveCurrentEditor();
                        notepadTitles[tabIdx] = pTitle;
                        notepadEditorData[tabIdx].html = pData.html || '';
                        notepadEditorData[tabIdx].bold = pData.bold || false;
                        if (tabIdx === currentNotepadTab) {
                            document.getElementById('notepadTitle').value = pTitle;
                            document.getElementById('notepadEditor').innerHTML = notepadEditorData[tabIdx].html;
                        }
                        tabIdx++;
                    }
                } else {
                    var htmlContent = await _notepadReadFileAsSmartText(fileObj);
                    var editorHtml;
                    if (ext === 'mht') {
                        editorHtml = extractEditorHtmlFromContent(htmlContent, ext);
                    } else {
                        editorHtml = _notepadCleanHtmlForEditor(htmlContent);
                    }
                    var title = fileName.replace(/\.(html|htm|mht)$/i, '');
                    if (tabIdx >= 5) tabIdx = 0;
                    saveCurrentEditor();
                    notepadTitles[tabIdx] = title;
                    notepadEditorData[tabIdx].html = editorHtml;
                    if (tabIdx === currentNotepadTab) {
                        document.getElementById('notepadTitle').value = title;
                        document.getElementById('notepadEditor').innerHTML = editorHtml;
                    }
                    tabIdx++;
                }
                importedCount++;
            }
            closeNotepadOpenModal();
            if (importedCount > 0) {
                // 刷新当前标签页的显示
                if (typeof syncEditorFromData === 'function') syncEditorFromData();
                if (typeof updateNotepadTabStyle === 'function') updateNotepadTabStyle();
                showToast('导入完成: ' + importedCount + '个文件');
            }
        }
        
        function changeNotepadFolder() {
            notebookRootHandle = null;
            notepadDirHandle = null;
            notepadSaveSelectedFolder = null;
            notepadSaveSelectedDirHandle = null;
            notepadFolderEntries = [];
            idbPut('notebookRootHandle', null);
            toggleNotepadSaveDropdown(new Event('click'));
        }
        function parseNotepadJsData(content) {
            try {
                var match = content.match(/var\s+savedData\s*=\s*(\{[\s\S]*?\});/);
                if (!match) return null;
                return JSON.parse(match[1]);
            } catch(e) { return null; }
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
            if (data.notepad.data) S.notepadData = data.notepad.data;
            if (data.notepad.labels) S.notepadLabels = data.notepad.labels;
            // 导入多页数据也逐页合并：文件里为空的页面保留当前内容，避免导入后出现整页空白
            S.notepadTitles = (typeof window._npMergeNotepadTitles === 'function')
                ? window._npMergeNotepadTitles(data.notepad.titles, S.notepadTitles)
                : (data.notepad.titles || S.notepadTitles);
            S.notepadEditorData = (typeof window._npMergeNotepadEditorData === 'function')
                ? window._npMergeNotepadEditorData(data.notepad.editorData, S.notepadEditorData, data.notepad.data)
                : (data.notepad.editorData || S.notepadEditorData);
            if (data.notepad.fontSizes) S.notepadFontSizes = data.notepad.fontSizes;
            if (Array.isArray(data.notepad.notebookStyles) && data.notepad.notebookStyles.length === 5) S.notepadNotebookStyles = data.notepad.notebookStyles.map(function(v){ return !!v; });
            if (data.notepad.zoomLevels) notepadZoomLevels = data.notepad.zoomLevels;
            updateNotepadTabs();
            syncEditorFromData();
            _saveNotepadToCache();
        }
        function showNotepadJsConfirmDialog() {
            return new Promise(function(resolve) {
                var overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);z-index:10100;display:flex;align-items:center;justify-content:center;';
                var box = document.createElement('div');
                box.style.cssText = 'background:#fff;border-radius:8px;padding:20px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.2);';
                var h = document.createElement('div');
                h.style.cssText = 'font-size:16px;font-weight:bold;margin-bottom:12px;font-family:SimHei,黑体,sans-serif;color:#c0392b;';
                h.textContent = '即将导入多页面数据';
                box.appendChild(h);
                var msg = document.createElement('div');
                msg.style.cssText = 'font-size:14px;margin-bottom:16px;line-height:1.6;';
                msg.textContent = '即将导入多页面数据，导入内容会覆盖现有5个页面数据，是否继续？';
                box.appendChild(msg);
                var btnRow = document.createElement('div');
                btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
                var cancelBtn = document.createElement('button');
                cancelBtn.textContent = '取消';
                cancelBtn.style.cssText = 'padding:6px 16px;border:1px solid #ccc;border-radius:4px;cursor:pointer;font-size:13px;background:#fff;';
                cancelBtn.onclick = function() { document.body.removeChild(overlay); resolve(false); };
                var confirmBtn = document.createElement('button');
                confirmBtn.textContent = '确定导入';
                confirmBtn.style.cssText = 'padding:6px 16px;border:1px solid #c0392b;background:#c0392b;color:#fff;border-radius:4px;cursor:pointer;font-size:13px;';
                confirmBtn.onclick = function() { document.body.removeChild(overlay); resolve(true); };
                btnRow.appendChild(cancelBtn);
                btnRow.appendChild(confirmBtn);
                box.appendChild(btnRow);
                overlay.appendChild(box);
                document.body.appendChild(overlay);
            });
        }
        function extractEditorHtmlFromContent(content, ext) {
            if (ext === 'mht') {
                var htmlMatch = content.match(/Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]*)/i);
                if (htmlMatch) return htmlMatch[1].trim();
                return content;
            }
            var parser = new DOMParser();
            var doc = parser.parseFromString(content, 'text/html');
            var bodyContent = doc.body;
            var h1 = bodyContent.querySelector('h1');
            if (h1) h1.remove();
            return bodyContent.innerHTML || '';
        }
        function _notepadLatin1ToString(buf) {
            var u8 = (buf && buf.BYTES_PER_ELEMENT) ? buf : new Uint8Array(buf);
            var s = '';
            var chunk = 0x8000;
            for (var i = 0; i < u8.length; i += chunk) {
                s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
            }
            return s;
        }
        function _notepadReadFileAsSmartText(file) {
            return new Promise(function(resolve, reject) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        var buf = e.target.result;
                        var head = _notepadLatin1ToString(buf.slice(0, 4096));
                        var m = head.match(/charset\s*=\s*["']?\s*([A-Za-z0-9_\-]+)/i);
                        var declared = m ? m[1].toLowerCase() : '';
                        var enc = 'utf-8';
                        if (/^(gb2312|gbk|gb18030|gb_?2312[\-0-9]*|cp936|chinese|x-gbk|csgb2312|iso-?ir-?58|csiso58gb231280)$/.test(declared)) {
                            enc = declared === 'gb18030' ? 'gb18030' : 'gbk';
                        } else if (/^big5$/.test(declared)) {
                            enc = 'big5';
                        } else if (/^utf-?8/.test(declared)) {
                            enc = 'utf-8';
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
                reader.onerror = function() { reject(reader.error); };
                reader.readAsArrayBuffer(file);
            });
        }
        function _notepadCleanHtmlForEditor(html) {
            var frag = html.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i);
            var src = frag ? frag[1] : html;
            var parser = new DOMParser();
            var doc = parser.parseFromString(src, 'text/html');
            var tagsToRemove = ['style', 'script', 'link', 'meta', 'title'];
            for (var t = 0; t < tagsToRemove.length; t++) {
                var els = doc.getElementsByTagName(tagsToRemove[t]);
                while (els.length) els[0].parentNode.removeChild(els[0]);
            }
            if (doc.body) {
                var HTML_NS = 'http://www.w3.org/1999/xhtml';
                var all = doc.body.getElementsByTagName('*');
                for (var i = all.length - 1; i >= 0; i--) {
                    var el = all[i];
                    if (el.namespaceURI && el.namespaceURI !== HTML_NS) {
                        var parent = el.parentNode;
                        while (el.firstChild) parent.insertBefore(el.firstChild, el);
                        parent.removeChild(el);
                    }
                }
                var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT);
                var comments = [];
                while (walker.nextNode()) comments.push(walker.currentNode);
                for (var c = 0; c < comments.length; c++) {
                    if (comments[c].parentNode) comments[c].parentNode.removeChild(comments[c]);
                }
                return doc.body.innerHTML;
            }
            return src;
        }
        function changeNotepadOpenFolder() {
            notepadDirHandle = null;
            notepadSelectedFolder = null;
            notepadSaveSelectedFolder = null;
            notepadFolderEntries = [];
            notepadScannedHandleMap = {};
            _notepadOpenFirstOpen = false;
            showNotepadOpenModal();
        }
        function _notepadSaveTitle() {
            var title = '';
            try { title = (document.getElementById('notepadTitle') || {}).value || ''; } catch(e) {}
            title = title.trim();
            if (!title || title === '…' || title === '请输入标题') title = notepadTitles[currentNotepadTab] || '';
            if (!title || title === '…') title = '笔记';
            return title;
        }
        function _notepadExportTimestamp() {
            var now = new Date();
            return now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
        }
        function toggleNotepadSaveDropdown(e) {
            e.preventDefault();
            e.stopPropagation();
            closeSaveDropdown();
            var editor = document.getElementById('notepadEditor');
            var ssel = window.getSelection();
            if (ssel.rangeCount > 0 && editor && editor.contains(ssel.anchorNode)) {
                _notepadSavedRange = ssel.getRangeAt(0);
            }
             var menu = document.getElementById('notepadSaveDropdownMenu');
             var jsMenu = document.getElementById('notepadSaveJsMenu');
             var htmlMenu = document.getElementById('notepadSaveHtmlMenu');
             var docxMenu = document.getElementById('notepadSaveDocxMenu');
            if (!menu) return;
            var show = !menu.classList.contains('show');
            menu.classList.toggle('show', show);
             if (!show) { if (jsMenu) jsMenu.style.display = 'none'; if (htmlMenu) htmlMenu.style.display = 'none'; if (docxMenu) docxMenu.style.display = 'none'; }
        }
        function closeNotepadSaveDropdown() {
             var menu = document.getElementById('notepadSaveDropdownMenu');
             var jsMenu = document.getElementById('notepadSaveJsMenu');
             var htmlMenu = document.getElementById('notepadSaveHtmlMenu');
             var docxMenu = document.getElementById('notepadSaveDocxMenu');
             if (menu) menu.classList.remove('show');
             if (jsMenu) jsMenu.style.display = 'none';
             if (htmlMenu) htmlMenu.style.display = 'none';
             if (docxMenu) docxMenu.style.display = 'none';
        }
        function toggleNotepadSaveJsMenu(e) {
            e.preventDefault();
            e.stopPropagation();
             var menu = document.getElementById('notepadSaveJsMenu');
             var htmlMenu = document.getElementById('notepadSaveHtmlMenu');
             var docxMenu = document.getElementById('notepadSaveDocxMenu');
             if (!menu) return;
             if (htmlMenu) htmlMenu.style.display = 'none';
             if (docxMenu) docxMenu.style.display = 'none';
            menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
        }
        function toggleNotepadExportHtmlMenu(e) {
            e.preventDefault();
            e.stopPropagation();
            var menu = document.getElementById('notepadSaveHtmlMenu');
            var jsMenu = document.getElementById('notepadSaveJsMenu');
            var docxMenu = document.getElementById('notepadSaveDocxMenu');
            if (!menu) return;
            if (jsMenu) jsMenu.style.display = 'none';
            if (docxMenu) docxMenu.style.display = 'none';
            menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
        }
        function toggleNotepadExportDocxMenu(e) {
            e.preventDefault();
            e.stopPropagation();
             var menu = document.getElementById('notepadSaveDocxMenu');
             var jsMenu = document.getElementById('notepadSaveJsMenu');
             var htmlMenu = document.getElementById('notepadSaveHtmlMenu');
             if (!menu) return;
             if (jsMenu) jsMenu.style.display = 'none';
             if (htmlMenu) htmlMenu.style.display = 'none';
            menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
        }
        document.addEventListener('click', function(e) {
            var wrap = document.getElementById('saveDropdownWrap');
            if (wrap && !wrap.contains(e.target)) closeSaveDropdown();
            var nwrap = document.getElementById('notepadSaveDropdownWrap');
            if (nwrap && !nwrap.contains(e.target)) closeNotepadSaveDropdown();
        });
        function saveNotepadToCache() {
            saveCurrentEditor();
            _saveNotepadToCache();
            updateFooterTimestamp();
            showToast('缓存已保存');
        }
        function buildNotepadHtmlContentFromHtml(html, title) {
            return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + escapeHtml(title) + '</title><style>body{font-family:SimSun,宋体,serif;padding:20px;line-height:1.8;}[data-level="title"],.notepadArticleTitle{font-family:FZXiaoBiaoSong,"方正小标宋简体",serif !important;font-weight:normal !important;}</style></head><body><div>' + _notepadNormalizeExportTitleFonts(html || '') + '</div></body></html>';
        }
        function _notepadNormalizeExportTitleFonts(html) {
            var wrap = document.createElement('div');
            wrap.innerHTML = html || '';
            var paras = wrap.querySelectorAll('p[data-level="title"], p[data-outline-level="1"]');
            for (var i = 0; i < paras.length; i++) {
                var p = paras[i];
                var isArticleTitle = p.getAttribute('data-level') === 'title' || /方正小标宋|FZXiaoBiaoSong/i.test((p.style.fontFamily || '') + ' ' + (p.innerHTML || ''));
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
        function _notepadCurrentWindowHtml() {
            saveCurrentEditor();
            var editor = document.getElementById('notepadEditor');
            return editor ? (editor.innerHTML || '') : '';
        }
        function _notepadCurrentWindowJsData() {
            saveCurrentEditor();
            var titles = ['…','…','…','…','…'];
            var labels = ['','','','',''];
            var editorData = [{html:'',bold:false},{html:'',bold:false},{html:'',bold:false},{html:'',bold:false},{html:'',bold:false}];
            var fontSizes = [14,14,14,14,14];
            var notebookStyles = [false,false,false,false,false];
            var zoomLevels = [1,1,1,1,1];
            titles[currentNotepadTab] = notepadTitles[currentNotepadTab] || _notepadSaveTitle();
            labels[currentNotepadTab] = notepadLabels[currentNotepadTab] || '';
            editorData[currentNotepadTab] = notepadEditorData[currentNotepadTab] || {html:'', bold:false};
            fontSizes[currentNotepadTab] = notepadFontSizes[currentNotepadTab] || 14;
            notebookStyles[currentNotepadTab] = !!notepadNotebookStyles[currentNotepadTab];
            zoomLevels[currentNotepadTab] = notepadZoomLevels[currentNotepadTab] || 1;
            var data = { notepad: { data: notepadData, titles: titles, labels: labels, editorData: editorData, fontSizes: fontSizes, notebookStyles: notebookStyles, zoomLevels: zoomLevels } };
            return 'var savedData = ' + JSON.stringify(data, null, 2) + ';';
        }
        function _notepadAllWindowsJsData() {
            saveCurrentEditor();
            var data = { notepad: { data: notepadData, titles: notepadTitles, labels: notepadLabels, editorData: notepadEditorData, fontSizes: notepadFontSizes, notebookStyles: notepadNotebookStyles, zoomLevels: notepadZoomLevels, isMultiPage: true } };
            return 'var savedData = ' + JSON.stringify(data, null, 2) + ';';
        }
         function _notepadCurrentArticleHtml() {
             var editor = document.getElementById('notepadEditor');
             if (!editor) return { html: '', title: '', hasIndex: false };
             _notepadRestoreSelection();
             var sel = window.getSelection();
            if (!sel.rangeCount || !editor.contains(sel.anchorNode)) return { html: '', title: '', hasIndex: false };
            var node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
            while (node && node !== editor && node.tagName !== 'P') node = node.parentNode;
            if (!node || node === editor) return { html: '', title: '', hasIndex: false };
            var ps = editor.querySelectorAll('p');
            var startIdx = -1;
            for (var i = 0; i < ps.length; i++) {
                if (ps[i] === node) { startIdx = i; break; }
            }
            if (startIdx < 0) return { html: '', title: '', hasIndex: false };
            function cleanTitleText(p) { return (p.textContent || '').replace(/^[▸▾▶▷▼]+\s*/, '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); }
            function isArticleTitle(p) {
                if (!p) return false;
                if (p.getAttribute('data-level') === 'title') return true;
                 var st = p.style || {}, ff = (st.fontFamily || '') + ' ' + (p.innerHTML || '');
                 if (st.textAlign === 'center' && /方正小标宋|FZXiaoBiaoSong/i.test(ff) && /20px|20pt/.test(st.fontSize || ff)) return true;
                 var spans = p.querySelectorAll ? p.querySelectorAll('span') : [];
                 for (var si = 0; si < spans.length; si++) {
                     var ss = spans[si].style || {};
                     var sff = (ss.fontFamily || '') + ' ' + (spans[si].innerHTML || '');
                     if (/方正小标宋|FZXiaoBiaoSong/i.test(sff) && /20px|20pt/.test(ss.fontSize || sff)) return true;
                 }
                 return false;
            }
            function isAttachmentMarker(p) {
                var lv = p.getAttribute('data-level') || '', tx = cleanTitleText(p);
                return lv === 'secret' || lv === 'attachment' || /^×密|^x密|^★|^附件(?:\s*[：:]?\s*(?:\d+|[一二三四五六七八九十]+))?$/.test(tx) || /^附件[：:]/.test(tx);
            }
            var indexStart = -1;
            for (var j = startIdx; j >= 0; j--) { if (ps[j].getAttribute('data-outline-level') === '1') { indexStart = j; break; } }
             var articleStart = indexStart;
             if (articleStart < 0) {
                 for (var f = startIdx; f >= 0; f--) {
                     if (isArticleTitle(ps[f])) { articleStart = f; break; }
                 }
             }
             if (articleStart < 0) return { html: '', title: '', hasIndex: false };
             if (indexStart < 0) while (articleStart > 0 && isAttachmentMarker(ps[articleStart - 1])) articleStart--;
             var articleEnd = ps.length, attachmentPart = false;
              var seenOwnTitle = indexStart < 0;
              var titleAlreadyAtStart = indexStart < 0 && isArticleTitle(ps[articleStart]);
              var headerRegion = indexStart >= 0;
              for (var k = articleStart + 1; k < ps.length; k++) {
                  var kLevel = ps[k].getAttribute('data-level') || '';
                  if (isAttachmentMarker(ps[k])) attachmentPart = true;
                  if (ps[k].getAttribute('data-outline-level') === '1') { articleEnd = k; break; }
                  if (isArticleTitle(ps[k]) && !attachmentPart) {
                      if (headerRegion && !seenOwnTitle && !titleAlreadyAtStart && !isAttachmentMarker(ps[k])) {
                          seenOwnTitle = true; continue;
                      }
                      articleEnd = k; break;
                  }
                  if (headerRegion && (kLevel === 'date' || kLevel === 'author' || kLevel === 'recipient')) headerRegion = false;
              }
            var titleParts = [];
             for (var t = articleStart; t < articleEnd; t++) {
                      if (isArticleTitle(ps[t])) titleParts.push(cleanTitleText(ps[t]));
             }
               var title = '';
               for (var titleScan = articleStart; titleScan < articleEnd; titleScan++) {
                   if (isArticleTitle(ps[titleScan]) && !isAttachmentMarker(ps[titleScan])) { title = cleanTitleText(ps[titleScan]); break; }
               }
              var html = '';
              var exportStart = indexStart >= 0 ? articleStart + 1 : articleStart;
              for (var a = exportStart; a < articleEnd; a++) {
                 if (ps[a].getAttribute('data-outline-level') === '1' && a !== articleStart) continue;
                 html += ps[a].outerHTML;
             }
             return { html: html, title: title, hasIndex: indexStart >= 0 };
        }
        async function _notepadExportBlobWithPicker(blob, fileName, mime, ext) {
            if (window.showSaveFilePicker) {
                try {
                    var opts = { suggestedName: fileName, types: [{ description: ext.toUpperCase() + ' 文件', accept: {} }] };
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
            return true;
        }
        async function confirmNotepadExportJsCurrent() {
            try {
                var title = _notepadSaveTitle();
                var fileName = _notepadExportTimestamp() + ' ' + title + '.js';
                var content = _notepadCurrentWindowJsData();
                await _notepadExportBlobWithPicker(new Blob([content], { type: 'application/javascript;charset=utf-8' }), sanitizeDocFileName(fileName), 'application/javascript', '.js');
            } catch (e) { showToast('导出失败: ' + e.message); }
        }
        async function confirmNotepadExportJsAll() {
            try {
                var title = _notepadSaveTitle();
                var fileName = _notepadExportTimestamp() + ' ' + title + '.js';
                var content = _notepadAllWindowsJsData();
                await _notepadExportBlobWithPicker(new Blob([content], { type: 'application/javascript;charset=utf-8' }), sanitizeDocFileName(fileName), 'application/javascript', '.js');
            } catch (e) { showToast('导出失败: ' + e.message); }
        }
        async function confirmNotepadExportHtml() {
            try {
                var title = _notepadSaveTitle();
                var fileName = sanitizeDocFileName(_notepadExportTimestamp() + ' ' + title + '.html');
                var html = buildNotepadHtmlContentFromHtml(_notepadCurrentWindowHtml(), title);
                await _notepadExportBlobWithPicker(new Blob([html], { type: 'text/html;charset=utf-8' }), fileName, 'text/html', '.html');
            } catch (e) { showToast('导出失败: ' + e.message); }
        }
        function _notepadCollectArticlesForHtml() {
            saveCurrentEditor();
            var editor = document.getElementById('notepadEditor');
            if (!editor) return [];
            var ps = editor.querySelectorAll('p');
            var articles = [], curr = null;
            var hasOutline = false;
            for (var oi = 0; oi < ps.length; oi++) if (ps[oi].getAttribute('data-outline-level') === '1') { hasOutline = true; break; }
            for (var i = 0; i < ps.length; i++) {
                var isArticleStart = ps[i].getAttribute('data-outline-level') === '1';
                if (!hasOutline && ps[i].getAttribute('data-level') === 'title') isArticleStart = true;
                if (isArticleStart) {
                    if (curr) articles.push(curr);
                    curr = { index: ps[i], title: (ps[i].textContent || '').replace(/[\r\n]+/g, ' ').trim(), nodes: [ps[i]] };
                } else if (curr) {
                    if (ps[i].getAttribute('data-level') === 'title' && !curr.articleTitle) curr.articleTitle = (ps[i].textContent || '').replace(/[\r\n]+/g, ' ').trim();
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
                    var base = sanitizeDocFileName(fileTitle).replace(/\.html?$/i, '') || ('文章' + (i + 1));
                    var fileName = base + '.html', suffix = 2;
                    while (used[fileName]) fileName = base + '_' + suffix++ + '.html';
                    used[fileName] = true;
                    var fragment = '';
                    for (var j = 0; j < art.nodes.length; j++) fragment += art.nodes[j].outerHTML;
                    var doc = buildNotepadHtmlContentFromHtml(fragment, fileTitle);
                    if (dir) {
                        var fh = await dir.getFileHandle(fileName, { create: true });
                        var w = await fh.createWritable({ keepExistingData: false });
                        await w.write(new Blob([doc], { type: 'text/html;charset=utf-8' })); await w.close();
                    } else {
                        var blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
                        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        await new Promise(function(resolve) { setTimeout(resolve, 80); });
                    }
                }
                updateFooterTimestamp();
                showToast('已分割导出' + articles.length + '篇HTML');
            } catch (e) { showToast('分割导出失败: ' + e.message); }
        }
        async function confirmNotepadExportDocxCurrent() {
             try {
                 _notepadRestoreSelection();
                 var info = _notepadCurrentArticleHtml();
                 if (!info.hasIndex) { showToast('请先创建索引标题后再导出DOCX'); return; }
                 if (!info.title) { showToast('未识别到文章标题，无法导出DOCX'); return; }
                 if (!info.html) {
                    var tpl = getDocTemplate();
                    if (!tpl) { showToast('未找到文档模板'); return; }
                    var editor = document.getElementById('notepadEditor');
                    if (!editor) { showToast('未找到编辑框'); return; }
                    var paragraphs = collectParagraphs(editor);
                    if (!paragraphs.length) { showToast('当前笔记内容为空，无法导出'); return; }
                    var xml = tpl.replace('__DOC_BODY__', buildDocBodyXml(paragraphs));
                     var title = info.title;
                    var fileName = sanitizeDocFileName(_notepadExportTimestamp() + ' ' + title + '.docx');
                    await _notepadExportBlobWithPicker(new Blob([xml], { type: 'application/msword' }), fileName, 'application/msword', '.docx');
                    return;
                }
                var tpl = getDocTemplate();
                if (!tpl) { showToast('未找到文档模板'); return; }
                var tmp = document.createElement('div');
                tmp.innerHTML = info.html;
                var paragraphs = collectParagraphs(tmp);
                if (!paragraphs.length) { showToast('当前文章内容为空'); return; }
                var xml = tpl.replace('__DOC_BODY__', buildDocBodyXml(paragraphs));
                var fileName = sanitizeDocFileName(_notepadExportTimestamp() + ' ' + info.title + '.docx');
                await _notepadExportBlobWithPicker(new Blob([xml], { type: 'application/msword' }), fileName, 'application/msword', '.docx');
            } catch (e) { showToast('导出失败: ' + e.message); }
        }
        function _notepadShowArticleExportDialog() {
            var editor = document.getElementById('notepadEditor');
            if (!editor) { showToast('未找到编辑框'); return; }
            var ps = editor.querySelectorAll('p');
            var articles = [];
            var curr = null;
            for (var i = 0; i < ps.length; i++) {
                if (ps[i].getAttribute('data-outline-level') === '1') {
                    if (curr) articles.push(curr);
                    var idxText = (ps[i].textContent || '').replace(/[\r\n]+/g, ' ').trim();
                    curr = { start: i, title: idxText, ps: [ps[i]] };
                    for (var t = i + 1; t < ps.length; t++) {
                        if (ps[t].getAttribute('data-outline-level') === '1') break;
                        if (ps[t].getAttribute('data-level') === 'title') curr.title = (ps[t].textContent || '').replace(/[\r\n]+/g, ' ').trim();
                        curr.ps.push(ps[t]);
                    }
                }
            }
            if (curr) articles.push(curr);
            if (!articles.length) { showToast('未找到文章'); return; }
            var ov = document.createElement('div');
            ov.id = 'notepadArticleExportOverlay';
            ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.3);z-index:9999;display:flex;align-items:center;justify-content:center;';
            var box = document.createElement('div');
            box.style.cssText = 'background:#fff;border-radius:8px;padding:20px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.2);';
            var h = document.createElement('div');
            h.style.cssText = 'font-size:16px;font-weight:bold;margin-bottom:12px;font-family:SimHei,黑体,sans-serif;';
            h.textContent = '选择要导出的文章';
            box.appendChild(h);
            var list = document.createElement('div');
            var checks = [];
            for (var j = 0; j < articles.length; j++) {
                var item = document.createElement('label');
                item.style.cssText = 'display:flex;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:14px;font-family:FangSong,仿宋,serif;';
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = true;
                cb.style.marginRight = '8px';
                var span = document.createElement('span');
                span.textContent = articles[j].title || ('文章' + (j + 1));
                item.appendChild(cb);
                item.appendChild(span);
                list.appendChild(item);
                checks.push({ cb: cb, article: articles[j] });
            }
            box.appendChild(list);
            var btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;';
            var exportAllBtn = document.createElement('button');
            exportAllBtn.textContent = '全部导出';
            exportAllBtn.style.cssText = 'padding:6px 16px;border:1px solid #c0392b;background:#c0392b;color:#fff;border-radius:4px;cursor:pointer;font-size:13px;';
            exportAllBtn.onclick = function() { document.body.removeChild(ov); confirmNotepadExportDocxAll(); };
            var exportSelBtn = document.createElement('button');
            exportSelBtn.textContent = '导出选中';
            exportSelBtn.style.cssText = 'padding:6px 16px;border:1px solid #2980b9;background:#2980b9;color:#fff;border-radius:4px;cursor:pointer;font-size:13px;';
            exportSelBtn.onclick = function() {
                var selected = [];
                for (var ci = 0; ci < checks.length; ci++) { if (checks[ci].cb.checked) selected.push(checks[ci].article); }
                if (!selected.length) { showToast('请至少选择一篇文章'); return; }
                document.body.removeChild(ov);
                _notepadExportArticlesAsDocx(selected);
            };
            var cancelBtn = document.createElement('button');
            cancelBtn.textContent = '取消';
            cancelBtn.style.cssText = 'padding:6px 16px;border:1px solid #ccc;background:#fff;color:#333;border-radius:4px;cursor:pointer;font-size:13px;';
            cancelBtn.onclick = function() { document.body.removeChild(ov); };
            btnRow.appendChild(exportSelBtn);
            btnRow.appendChild(exportAllBtn);
            btnRow.appendChild(cancelBtn);
            box.appendChild(btnRow);
            ov.appendChild(box);
            document.body.appendChild(ov);
        }
        function _notepadExportArticlesAsDocx(articles) {
            var tpl = getDocTemplate();
            if (!tpl) { showToast('未找到文档模板'); return; }
            var allHtml = '';
            var title = '';
            for (var i = 0; i < articles.length; i++) {
                 for (var j = 0; j < articles[i].ps.length; j++) {
                     if (articles.length > 1 && articles[i].ps[j].getAttribute('data-outline-level') === '1') continue;
                     allHtml += articles[i].ps[j].outerHTML;
                 }
                if (!title) title = articles[i].title;
            }
             if (!allHtml && articles.length === 1) {
                 for (var onlyJ = 0; onlyJ < articles[0].ps.length; onlyJ++) allHtml += articles[0].ps[onlyJ].outerHTML;
             }
            var tmp = document.createElement('div');
            tmp.innerHTML = allHtml;
            var paragraphs = collectParagraphs(tmp);
            if (!paragraphs.length) { showToast('所选文章内容为空'); return; }
            var xml = tpl.replace('__DOC_BODY__', buildDocBodyXml(paragraphs));
            var fileName = sanitizeDocFileName(_notepadExportTimestamp() + ' ' + title + '.docx');
            _notepadExportBlobWithPicker(new Blob([xml], { type: 'application/msword' }), fileName, 'application/msword', '.docx');
        }
        async function confirmNotepadExportDocxAll() {
            try {
                var title = _notepadSaveTitle();
                var tpl = getDocTemplate();
                if (!tpl) { showToast('未找到文档模板'); return; }
                var editor = document.getElementById('notepadEditor');
                if (!editor) { showToast('未找到编辑框'); return; }
                var paragraphs = collectParagraphs(editor);
                if (!paragraphs.length) { showToast('当前笔记内容为空，无法导出'); return; }
                var xml = tpl.replace('__DOC_BODY__', buildDocBodyXml(paragraphs));
                var fileName = sanitizeDocFileName(_notepadExportTimestamp() + ' ' + title + '.docx');
                await _notepadExportBlobWithPicker(new Blob([xml], { type: 'application/msword' }), fileName, 'application/msword', '.docx');
            } catch (e) { showToast('导出失败: ' + e.message); }
        }
        function closeNotepadSaveModal() {
            var menu = document.getElementById('notepadSaveDropdownMenu');
            var jsMenu = document.getElementById('notepadSaveJsMenu');
            var htmlMenu = document.getElementById('notepadSaveHtmlMenu');
            var docxMenu = document.getElementById('notepadSaveDocxMenu');
            if (menu) menu.classList.remove('show');
            if (jsMenu) jsMenu.style.display = 'none';
            if (htmlMenu) htmlMenu.style.display = 'none';
            if (docxMenu) docxMenu.style.display = 'none';
        }
        function saveNotepadCurrentFile() {
            saveNotepadToCache();
        }
        function onNotepadOpenSelectOtherFile() {
            document.getElementById('notepadOpenFileInput').click();
        }
        function onNotepadOpenFileSelected(event) {
            var file = event.target.files[0];
            if (!file) return;
            var ext = file.name.toLowerCase().replace(/.*\./, '');
            if (ext === 'js') {
                var reader = new FileReader();
                reader.onload = function(e) {
                    var jsData = parseNotepadJsData(e.target.result);
                    if (!jsData) { showToast('JS文件格式错误: ' + file.name); event.target.value = ''; return; }
                    var isMultiPage = _isMultiPageJsData(jsData);
                    if (isMultiPage) {
                        showNotepadJsConfirmDialog().then(function(confirmed) {
                            if (!confirmed) { event.target.value = ''; return; }
                            _applyNotepadJsData(jsData);
                            closeNotepadOpenModal();
                            showToast('多页面数据导入成功');
                            event.target.value = '';
                        });
                    } else {
                        if (!jsData.notepad || !jsData.notepad.editorData) { showToast('JS 文件格式错误：缺少 notepad 数据'); event.target.value = ''; return; }
                        var pIdx = 0;
                        for (var pi = 0; pi < 5; pi++) {
                            if (jsData.notepad.editorData[pi] && jsData.notepad.editorData[pi].html && jsData.notepad.editorData[pi].html.trim()) { pIdx = pi; break; }
                        }
                        var pData = jsData.notepad.editorData[pIdx] || {html:'',bold:false};
                        var pTitle = jsData.notepad.titles[pIdx] || file.name.replace(/\.js$/i, '');
                        saveCurrentEditor();
                        notepadTitles[currentNotepadTab] = pTitle;
                        notepadEditorData[currentNotepadTab].html = pData.html || '';
                        notepadEditorData[currentNotepadTab].bold = pData.bold || false;
                        document.getElementById('notepadTitle').value = pTitle;
                        document.getElementById('notepadEditor').innerHTML = notepadEditorData[currentNotepadTab].html;
                        closeNotepadOpenModal();
                        showToast('导入成功: ' + file.name);
                        event.target.value = '';
                    }
                };
                reader.onerror = function() { showToast('文件读取失败'); event.target.value = ''; };
                reader.readAsText(file, 'UTF-8');
                return;
            }
            _notepadReadFileAsSmartText(file).then(function(content) {
                var editorHtml;
                if (ext === 'mht') {
                    editorHtml = extractEditorHtmlFromContent(content, ext);
                } else {
                    editorHtml = _notepadCleanHtmlForEditor(content);
                }
                var title = file.name.replace(/\.(html|htm|mht)$/i, '');
                saveCurrentEditor();
                notepadTitles[currentNotepadTab] = title;
                notepadEditorData[currentNotepadTab].html = editorHtml;
                document.getElementById('notepadTitle').value = title;
                document.getElementById('notepadEditor').innerHTML = editorHtml;
                closeNotepadOpenModal();
                showToast('导入成功: ' + file.name);
                event.target.value = '';
            }).catch(function() {
                showToast('文件读取失败');
                event.target.value = '';
            });
        }
        async function refreshNotepadFileInList(fname) {
            showToast('已刷新: ' + fname);
        }

        async function refreshFileList() {
            var body = document.getElementById('fileSelectorBody');
            var empty = document.getElementById('fileSelectorEmpty');
            if (workLogDirHandle) {
                // 先验证权限是否仍然有效
                var ok = await verifyPermission(workLogDirHandle, true);
                if (!ok) {
                    // 权限过期，尝试从 IndexedDB 恢复
                    try {
                        var savedHandle = await idbGet('workLogDirHandle');
                        if (savedHandle) {
                            ok = await verifyPermission(savedHandle, true);
                            if (ok) {
                                workLogDirHandle = savedHandle;
                                scanFolderName = savedHandle.name;
                                _applyFileSelectorPath();
                                document.getElementById('fileSelectorPath').style.display = 'flex';
                            }
                        }
                    } catch(e) {}
                }
                if (ok) {
                    reloadFileListFromCache();
                } else {
                    body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">文件夹权限已失效，请点击"更改文件夹"重新选择</td></tr>';
                    empty.style.display = 'none';
                }
            } else if (Object.keys(cachedFileMap).length > 0) {
                scannedFiles = Object.keys(cachedFileMap).sort().reverse();
                populateFileList(scannedFiles);
            } else {
                body.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:#999;">请先选择文件夹</td></tr>';
                empty.style.display = 'none';
            }
        }
        

        // Enhanced read-only extension screen
         var _extensionScreenWindow = null;
         var _extensionScreenTimer = null;
         function _extensionScreenPayload() {
             saveCurrentEditor();
             var editor = document.getElementById('notepadEditor');
             var board = typeof window.paGetItems === 'function' ? window.paGetItems() : [];
             return { editor: editor ? editor.innerHTML : '', notes: notepadEditorData.map(function(x) { return x && x.html || ''; }), titles: notepadTitles.slice(), board: board || [], log: document.getElementById('trackContent') ? document.getElementById('trackContent').innerHTML : '' };
         }
         function _sendExtensionScreenContent() {
             if (!_extensionScreenWindow || _extensionScreenWindow.closed) { clearInterval(_extensionScreenTimer); _extensionScreenTimer = null; return; }
             try { _extensionScreenWindow.postMessage({ type: 'notepad-extension-content', payload: _extensionScreenPayload() }, '*'); } catch (e) {}
         }
         function openExtensionScreen() {
             if (_extensionScreenWindow && !_extensionScreenWindow.closed) { _extensionScreenWindow.focus(); _sendExtensionScreenContent(); return; }
             var w = window.open('', 'notepadExtensionScreen', 'width=1100,height=800,resizable=yes,scrollbars=yes');
             if (!w) { showToast('浏览器阻止了新窗口，请允许弹出窗口'); return; }
             _extensionScreenWindow = w;
             var base = location.href.replace(/[^\\/]+$/, '');
             w.document.open();
             w.document.write('<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>电子记事本 - 扩展屏</title><style>*{box-sizing:border-box}body{margin:0;height:100vh;overflow:hidden;background:#f5f7fa;color:#333;font-family:SimSun,宋体,serif}.extHead{height:58px;display:flex;align-items:center;padding:8px 14px;background:#0d2b4e;gap:8px}.extTab{height:40px;padding:0 28px;border:1px solid rgba(255,255,255,.5);border-radius:5px;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;font:17px SimHei,黑体,sans-serif}.extTab.active{background:#2980b9}.extSub{height:42px;display:flex;align-items:center;gap:6px;padding:5px 10px;background:#fff;border-bottom:1px solid #d9e1ea}.extSub button,.extSub select{height:30px;padding:0 12px;border:1px solid #c8d2df;border-radius:4px;background:#fff;color:#40566e;cursor:pointer;font:13px SimHei,黑体,sans-serif}.extSub button.active{background:#e3f2fd;border-color:#64b5f6;color:#1565c0}.extTools{margin-left:auto;display:flex;gap:7px}.extTool{width:32px;height:32px;padding:0;border:1px solid rgba(255,255,255,.45);border-radius:4px;background:rgba(255,255,255,.12);cursor:pointer}.extTool img{width:20px;height:20px}.extBody{height:calc(100vh - 100px);overflow:hidden;padding:12px;display:flex;gap:10px}.extPane{display:none;min-width:0;min-height:0;flex:1;background:#fff;border:1px solid #d9e1ea;border-radius:7px;padding:16px;overflow:auto}.extPane.active{display:block}.extNoteList{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}.extNoteBtn{padding:5px 14px;border:1px solid #c8d2df;border-radius:4px;background:#fff;color:#40566e;cursor:pointer;font:13px SimHei,黑体,sans-serif}.extNoteBtn.active{background:#667eea;color:#fff;border-color:#5a6fd1}.extNoteView{line-height:1.8;overflow:auto}.extEditorLayout{display:flex;gap:10px;height:100%}.extOutline{width:240px;flex:0 0 240px;overflow:auto;border-right:1px solid #d9e1ea;padding-right:10px}.extOutlineItem{padding:6px 8px;border-bottom:1px solid #edf0f4;cursor:pointer;font-size:14px}.extOutlineItem:hover{background:#eef4ff;color:#1565c0}.extEditorView{flex:1;min-width:0;overflow:auto;padding:4px 10px;font-size:16px;line-height:1.8}.extEditorView img{max-width:100%;height:auto}.extLogView{height:100%;overflow:auto}.extLogView img{max-width:100%;height:auto}.extLogControls{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}.extLogControls select{height:30px;padding:0 10px;border:1px solid #c8d2df;border-radius:4px;font:13px SimHei,黑体,sans-serif}.extLogControls button{height:30px;padding:0 12px;border:1px solid #c8d2df;border-radius:4px;background:#fff;color:#40566e;cursor:pointer;font:13px SimHei,黑体,sans-serif}.extLogControls button.active{background:#e3f2fd;color:#1565c0}.readonly{user-select:text}</style></head><body><div class="extHead"><button class="extTab active" data-tab="note">笔记</button><button class="extTab" data-tab="editor">编辑器</button><button class="extTab" data-tab="log">日志</button><div class="extTools"><button class="extTool" data-act="in"><img src="' + base + 'data/enlarge.ico"></button><button class="extTool" data-act="out"><img src="' + base + 'data/reduce.ico"></button><button class="extTool" data-act="full"><img src="' + base + 'data/fullscreen.ico"></button></div></div><div class="extSub" id="extSub"></div><div class="extBody"><div class="extPane active" id="extNote"></div><div class="extPane" id="extEditor"></div><div class="extPane" id="extLog"></div></div><scr' + 'ipt>(function(){var state={tab:"note",note:0,z:1,payload:{notes:[],titles:[],editor:"",board:[],log:""}};var tabs=document.querySelectorAll(".extTab"),sub=document.getElementById("extSub");function pane(id){document.querySelectorAll(".extPane").forEach(function(x){x.classList.remove("active")});document.getElementById(id).classList.add("active")}function renderNote(){sub.innerHTML="";var row=document.createElement("div");row.className="extNoteList";for(var i=0;i<5;i++){var b=document.createElement("button");b.className="extNoteBtn"+(state.note===i?" active":"");b.textContent="窗口"+(i+1);b.onclick=function(){state.note=parseInt(this.textContent.replace(/\\D/g,""),10)-1;renderNote()};row.appendChild(b)}sub.appendChild(row);var v=document.getElementById("extNote");v.innerHTML="<div class=\"extNoteView readonly\">"+(state.payload.notes[state.note]||"")+"</div>"}function renderEditor(){sub.innerHTML="<button class=\"extSubEditorBtn active\">提纲</button>";var v=document.getElementById("extEditor");v.innerHTML="<div class=\"extEditorLayout\"><div class=\"extOutline\"></div><div class=\"extEditorView readonly\">"+(state.payload.editor||"")+"</div></div>";var ol=v.querySelector(".extOutline"), ev=v.querySelector(".extEditorView"), ps=ev.querySelectorAll("p");(state.payload.board||[]).forEach(function(it){var b=document.createElement("div");b.className="extOutlineItem";b.textContent=it.text||"";b.onclick=function(){var t=it.text||"";for(var i=0;i<ps.length;i++)if((ps[i].textContent||"").indexOf(t)!==-1){ps[i].scrollIntoView({block:"center"});break}};ol.appendChild(b)});if(!ol.children.length)ps.forEach(function(p){if((p.getAttribute("data-outline-level")||p.getAttribute("data-level"))){var b=document.createElement("div");b.className="extOutlineItem";b.textContent=p.textContent||"";b.onclick=function(){p.scrollIntoView({block:"center"})};ol.appendChild(b)}})}function renderLog(){sub.innerHTML="<div class=\"extLogControls\"><select><option>日志</option><option>周工作</option><option>月工作</option><option>季度工作</option><option>年度工作</option></select><button>‹</button><button>›</button><button class=\"active\">表格</button><button>页面</button><button>态势</button></div>";var v=document.getElementById("extLog");v.innerHTML="<div class=\"extLogView readonly\">"+(state.payload.log||"")+"</div>"}function render(){if(state.tab==="note"){pane("extNote");renderNote()}else if(state.tab==="editor"){pane("extEditor");renderEditor()}else{pane("extLog");renderLog()}}tabs.forEach(function(b){b.onclick=function(){state.tab=b.dataset.tab;tabs.forEach(function(x){x.classList.toggle("active",x===b)});render()}});document.querySelectorAll(".extTool").forEach(function(b){b.onclick=function(){if(b.dataset.act==="in")state.z=Math.min(2,state.z+.1);if(b.dataset.act==="out")state.z=Math.max(.6,state.z-.1);if(b.dataset.act==="full"){if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen()}document.querySelectorAll(".extPane,.extSub").forEach(function(x){x.style.zoom=state.z})}});window.addEventListener("message",function(e){if(!e.data)return;if(e.data.type==="notepad-extension-content"){state.payload=e.data.payload||state.payload;render()}});if(window.opener)window.opener.postMessage({type:"notepad-extension-ready"},"*");render()})()</scr' + 'ipt></body></html>');
              w.document.close();
              try {
                  var extHead = w.document.querySelector('.extHead'), extTabs = extHead && extHead.querySelectorAll('.extTab'), extSub = w.document.getElementById('extSub'), extTools = w.document.querySelector('.extTools');
                  if (extHead) { extHead.style.height = '58px'; extHead.style.flexWrap = 'nowrap'; extHead.style.alignItems = 'center'; }
                  if (extTabs && extTabs.length) { for (var ei = 0; ei < extTabs.length; ei++) extTabs[ei].style.order = '1'; }
                  if (extSub) { extSub.style.order = '3'; extSub.style.flex = '1 1 auto'; extSub.style.minWidth = '220px'; extSub.style.width = 'auto'; extSub.style.height = '42px'; }
                  if (extTools) { extTools.style.order = '4'; extTools.style.marginLeft = '0'; extTools.style.flex = '0 0 auto'; }
                  var extBody = w.document.querySelector('.extBody'); if (extBody) extBody.style.height = 'calc(100vh - 58px)';
                  var noteView = w.document.querySelector('.extNoteView'); if (noteView) noteView.style.height = 'calc(100% - 46px)';
                  var editorView = w.document.querySelector('.extEditorView'); if (editorView) editorView.style.height = '100%';
              } catch (e) {}
             _sendExtensionScreenContent();
             clearInterval(_extensionScreenTimer);
             _extensionScreenTimer = setInterval(_sendExtensionScreenContent, 700);
         }

          function showPageViewEntryContextMenu(e, el) {
             e.preventDefault();
             e.stopPropagation();
             document.querySelectorAll('.pageViewSubMenu, .pageViewSubStatusPicker, #headerContextMenu.show, #subStatusItemMenu.show').forEach(function(other) {
                 if (other.id === 'headerContextMenu') hideHeaderContextMenu();
                 else if (other.id === 'subStatusItemMenu') hideSubStatusItemMenu();
                 else other.remove();
             });
            var menu = document.getElementById('rowContextMenu');
            menu.dataset.rowIndex = '';
            menu.dataset.dateKey = el.getAttribute('data-datekey') || '';
            menu.dataset.origIndex = el.getAttribute('data-origindex') || '';
            menu.dataset.pageEntry = '1';
            S._pageViewCtxEntry = { dateKey: menu.dataset.dateKey, origIndex: parseInt(menu.dataset.origIndex, 10) };
             document.getElementById('ctxViewDetail').style.display = 'block';
             document.getElementById('ctxDeleteRow').style.display = 'block';
             var exportSubItemsItem = document.getElementById('ctxExportSubItems');
             if (exportSubItemsItem) exportSubItemsItem.style.display = 'block';
             menu.style.left = '0px';
             menu.style.top = '0px';
             menu.classList.add('show');
             var margin = 6, mw = menu.offsetWidth, mh = menu.offsetHeight;
             var left = e.clientX, top = e.clientY;
             if (left + mw > window.innerWidth - margin) left = e.clientX - mw;
             if (top + mh > window.innerHeight - margin) top = e.clientY - mh;
             if (left < margin) left = margin;
             if (top < margin) top = margin;
             menu.style.left = left + 'px';
             menu.style.top = top + 'px';
        }
         function showRowContextMenu(e, rowIndex) {
             e.preventDefault();
             e.stopPropagation();
             document.querySelectorAll('.pageViewSubMenu, .pageViewSubStatusPicker, #headerContextMenu.show, #subStatusItemMenu.show').forEach(function(other) {
                 if (other.id === 'headerContextMenu') hideHeaderContextMenu();
                 else if (other.id === 'subStatusItemMenu') hideSubStatusItemMenu();
                 else other.remove();
             });
            
            var menu = document.getElementById('rowContextMenu');
            var viewDetailItem = document.getElementById('ctxViewDetail');
            var addItem = document.getElementById('ctxAddRow');
            var deleteItem = document.getElementById('ctxDeleteRow');
            
            var allRows = document.querySelectorAll('#reportBody tr');
            for (var ri = 0; ri < allRows.length; ri++) allRows[ri].classList.remove('context-hover');
            if (allRows[rowIndex]) allRows[rowIndex].classList.add('context-hover');
            
            var filteredData = getFilteredData();
            
            if (filteredData.length === 0) {
                viewDetailItem.style.display = 'none';
                deleteItem.style.display = 'none';
            } else {
                viewDetailItem.style.display = 'block';
                deleteItem.style.display = 'block';
            }
            
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            menu.classList.add('show');
            menu.dataset.rowIndex = rowIndex;
            menu.dataset.dateKey = '';
            menu.dataset.origIndex = '';
            menu.dataset.pageEntry = '';
            S._pageViewCtxEntry = null;
            var exportSubItemsItem = document.getElementById('ctxExportSubItems');
            if (exportSubItemsItem) exportSubItemsItem.style.display = 'none';
        }
        
        function hideRowContextMenu() {
            var menu = document.getElementById('rowContextMenu');
            menu.classList.remove('show');
            menu.dataset.pageEntry = '';
            S._pageViewCtxEntry = null;
            var allRows = document.querySelectorAll('#reportBody tr');
            for (var ri = 0; ri < allRows.length; ri++) allRows[ri].classList.remove('context-hover');
        }
        
        function getFilteredData() {
            var allData = [];
            var addedIds = new Set();
            
            for (var key in reportData) {
                var data = reportData[key];
                var yh = _yearFromKey(key);
            for (var j = 0; j < data.length; j++) {
                var item = data[j];
                if (!item || (!item.category && !item.content)) continue;
                // 内容为空的普通日志不进入列表（正在编辑的占位除外）
                if (_logRecordEmpty(item)) continue;
                var inRange = (timeRangeType === 'day')
                    ? dateRangeContains(item.startTime, item.endTime, timeRangeStart, yh)
                    : isItemInTimeRange(item.startTime, item.endTime, yh);
                    if (inRange) {
                        var itemKey = key + '_' + j;
                        if (!addedIds.has(itemKey)) {
                            item._dateKey = key;
                            item._origIndex = j;
                            allData.push(item);
                            addedIds.add(itemKey);
                        }
                    }
                }
            }
            
            if (currentSortCol) {
                allData.sort(function(a, b) {
                    if (timeRangeType === 'week') {
                        var wkA = isWeekWorkItem(a) ? 0 : 1;
                        var wkB = isWeekWorkItem(b) ? 0 : 1;
                        if (wkA !== wkB) return wkA - wkB;
                    }
                    var va = '', vb = '';
                    if (currentSortCol === 'category') { va = a.category || ''; vb = b.category || ''; }
                    else if (currentSortCol === 'startTime') { va = a.startTime || ''; vb = b.startTime || ''; }
                    else if (currentSortCol === 'status') { 
                        va = statusOrder[a.status] !== undefined ? statusOrder[a.status] : 1; 
                        vb = statusOrder[b.status] !== undefined ? statusOrder[b.status] : 1; 
                        return currentSortDir === 'asc' ? va - vb : vb - va; 
                    }
                    var cmp = va.localeCompare(vb, 'zh-CN');
                    return currentSortDir === 'asc' ? cmp : -cmp;
                });
            }
            
            if (searchKeyword) {
                allData = allData.filter(function(row) {
                    return rowMatchesSearch(row);
                });
            }
            
            return allData;
        }
        
        function showViewDetailModal() {
            var menu = document.getElementById('rowContextMenu');
            var dateKey = menu.dataset.dateKey || '';
            var origIndex = parseInt(menu.dataset.origIndex, 10);
            var rowIndex = parseInt(menu.dataset.rowIndex, 10);
            var row = null;
            if (dateKey && isFinite(origIndex) && reportData[dateKey] && reportData[dateKey][origIndex]) row = reportData[dateKey][origIndex];
            else {
                var filteredData = getFilteredData();
                row = filteredData[rowIndex];
            }
            if (!row) return;
            
            var modal = document.createElement('div');
            modal.className = 'editModal show';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10600;display:flex;align-items:center;justify-content:center;';
            
            var box = document.createElement('div');
            box.className = 'editModalBox';
            box.style.cssText = 'width:780px;max-width:95vw;min-width:0;';
            
            var attachmentSummary = '';
            if (row.attachments && row.attachments.length > 0) {
                var names = [];
                for (var ai = 0; ai < row.attachments.length; ai++) {
                    var att = row.attachments[ai];
                    if (att && typeof att === 'object') names.push(att.name || att.path || '附件' + (ai + 1));
                    else if (att) names.push(String(att));
                }
                attachmentSummary = row.attachments.length + ' 个：' + escapeHtml(names.join('、'));
            }
            var content = '<div class="editModalTitle">查看详情</div>';
            content += '<div class="editModalRow" style="display:flex;flex-direction:column;gap:0;width:95%;margin:0 auto;">';
            var rowBase = 'display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #cfcfcf;';
            var rowLastBase = 'display:flex;align-items:center;gap:14px;padding:12px 0;';
            var rowMultiBase = 'display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #cfcfcf;';
            var labelBase = 'width:60px;flex-shrink:0;color:#555;align-self:center;';
            var valuePadL = 'padding-left:14px;flex:1;';
            content += '<div style="' + rowBase + '"><label style="' + labelBase + '">时间：</label><span style="' + valuePadL + '">' + escapeHtml((row.startTime || '') + ' — ' + (row.endTime || '')) + '</span></div>';
            content += '<div style="' + rowBase + '"><label style="' + labelBase + '">事项：</label><span style="' + valuePadL + '">' + escapeHtml(row.category || '') + '</span></div>';
            content += '<div style="' + rowMultiBase + '"><label style="' + labelBase + '">内容：</label><span style="white-space:pre-wrap;' + valuePadL + '">' + escapeHtml(row.content || '') + '</span></div>';
            content += '<div style="' + rowMultiBase + '"><label style="' + labelBase + '">备注：</label><span style="white-space:pre-wrap;' + valuePadL + '">' + escapeHtml(row.remark || '') + '</span></div>';
            content += '<div style="' + rowBase + '"><label style="' + labelBase + '">附件：</label><span style="' + valuePadL + '">' + (attachmentSummary || '<span style="color:#999;">无</span>') + '</span></div>';
            content += '<div style="' + rowLastBase + '"><label style="' + labelBase + '">状态：</label><span style="' + valuePadL + '">' + getStatusText(row.status) + '</span></div>';
            content += '</div>';
            content += '<div class="editModalBtns"><button class="editModalBtn cancel" onclick="this.closest(\'.editModal\').remove()">关闭</button></div>';
            
            box.innerHTML = content;
            modal.appendChild(box);
            document.body.appendChild(modal);
            
            modal.addEventListener('click', function(e) {
                if (e.target === modal) modal.remove();
            });
        }
        
        function getStatusText(status) {
            var map = { 'urgent': '■ 加急办理', 'normal': '□ 正常办理', 'done': '√ 已办结', 'memo': '… 备忘', 'cancel': '× 已取消' };
            return map[status] || '□ 正常办理';
        }
        
        function addRowAfter() {
            var menu = document.getElementById('rowContextMenu');
            var rowIndex = parseInt(menu.dataset.rowIndex) || 0;
            var filteredData = getFilteredData();
            var targetKey = timeRangeType === 'day' ? getDateKeyFor(timeRangeStart.getFullYear(), timeRangeStart.getMonth(), timeRangeStart.getDate()) : (filteredData[rowIndex] ? filteredData[rowIndex]._dateKey : getDateKeyFor(timeRangeStart.getFullYear(), timeRangeStart.getMonth(), timeRangeStart.getDate()));
            if (!reportData[targetKey]) reportData[targetKey] = [];
            var defaultDate = (timeRangeStart.getMonth() + 1) + '月' + timeRangeStart.getDate() + '日（周' + weekDays[timeRangeStart.getDay()] + '）';
            var defaultItem = { category: '', startTime: defaultDate, endTime: defaultDate, time: defaultDate, content: '', remark: '', status: 'normal', attachments: [], _pendingInsert: true };
            if (filteredData[rowIndex]) {
                var afterDateKey = filteredData[rowIndex]._dateKey;
                var afterOrigIndex = filteredData[rowIndex]._origIndex;
                if (afterDateKey === targetKey) {
                    reportData[targetKey].splice(afterOrigIndex + 1, 0, defaultItem);
                    editingInsertAfterIndex = rowIndex;
                } else {
                    reportData[targetKey].push(defaultItem);
                    editingInsertAfterIndex = -1;
                }
            } else {
                reportData[targetKey].push(defaultItem);
                editingInsertAfterIndex = -1;
            }
            updateCategoryList();
            for (var k in reportData) {
                for (var j = 0; j < reportData[k].length; j++) {
                    var idx = reportData[k].indexOf(defaultItem);
                    if (idx !== -1) {
                        S.editingRowIndex = idx;
                        S.editingDateKey = k;
                        break;
                    }
                }
                if (editingRowIndex !== null) break;
            }
            editingPendingInsert = true;
            document.getElementById('editCategory').value = '';
            document.getElementById('editStartTime').value = defaultDate;
            document.getElementById('editEndTime').value = defaultDate;
            document.getElementById('editContent').value = '';
            document.getElementById('editRemark').value = '';
            document.getElementById('editStatus').value = 'normal';
            S.currentAttachments = [];
            renderAttachmentList();
            _resetAttachInputs();
            _setupEditWeekLink('');
            initCategoryInput();
            applyEditModalFontSize(editModalFontSize);
            _updateEditWeekNav();
            closeWeekPopups();
            document.getElementById('editModal').classList.add('show');
            hideRowContextMenu();
        }
        
        function deleteCurrentRow() {
            var menu = document.getElementById('rowContextMenu');
            var pageDateKey = menu.dataset.dateKey || '';
            var pageOrigIndex = parseInt(menu.dataset.origIndex, 10);
            if (pageDateKey && isFinite(pageOrigIndex)) {
                var pageItem = reportData[pageDateKey] && reportData[pageDateKey][pageOrigIndex];
                if (!pageItem) { hideRowContextMenu(); return; }
                var pageTitle = pageItem.category || pageItem.content || '该条日志';
                if (!confirm('确定要删除“' + pageTitle + '”这条日志吗？删除后无法恢复！')) return;
                reportData[pageDateKey].splice(pageOrigIndex, 1);
                for (var psk in _stagedLogKeys) {
                    if (psk.split('::')[0] === pageDateKey) delete _stagedLogKeys[psk];
                }
                updateCategoryList();
                hideRowContextMenu();
                renderTrackContent();
                updateFooterTimestamp();
                showToast('已删除');
                return;
            }
            var rowIndex = parseInt(menu.dataset.rowIndex);
            var filteredData = getFilteredData();
            var row = filteredData[rowIndex];
            if (!row) return;
            var trs = document.querySelectorAll('#reportBody tr');
            if (trs[rowIndex]) trs[rowIndex].classList.add('context-deleting');
            if (!confirm('确定要删除第 ' + (rowIndex + 1) + ' 行的数据吗？删除后无法恢复！')) { if (trs[rowIndex]) trs[rowIndex].classList.remove('context-deleting'); return; }
            var dateKey = row._dateKey;
            var origIndex = row._origIndex;
            if (reportData[dateKey] && reportData[dateKey][origIndex]) {
                reportData[dateKey].splice(origIndex, 1);
            }
            for (var sk in _stagedLogKeys) {
                var skParts = sk.split('::');
                if (skParts[0] === dateKey) delete _stagedLogKeys[sk];
            }
            updateCategoryList();
            renderTrackContent();
            hideRowContextMenu();
            showToast('已删除');
        }
        
        document.getElementById('ctxViewDetail').addEventListener('click', function() {
            hideRowContextMenu();
            showViewDetailModal();
        });
        
        document.getElementById('ctxAddRow').addEventListener('click', function() {
            addRowAfter();
        });

        document.getElementById('ctxDuplicateRow').addEventListener('click', function() {
            duplicateCurrentRow();
        });

        function duplicateCurrentRow() {
            var menu = document.getElementById('rowContextMenu');
            var rowIndex = parseInt(menu.dataset.rowIndex);
            var filteredData = getFilteredData();
            var row = filteredData[rowIndex];
            if (!row) { hideRowContextMenu(); return; }
            var dateKey = row._dateKey;
            var origIndex = row._origIndex;
            if (!reportData[dateKey] || !reportData[dateKey][origIndex]) { hideRowContextMenu(); return; }
            var srcCopy = JSON.parse(JSON.stringify(reportData[dateKey][origIndex]));
            delete srcCopy._dateKey;
            delete srcCopy._origIndex;
            delete srcCopy._pendingInsert;
            delete srcCopy._insertAfterIndex;
            reportData[dateKey].splice(origIndex + 1, 0, srcCopy);
            for (var sk in _stagedLogKeys) {
                var skParts = sk.split('::');
                if (skParts[0] === dateKey) delete _stagedLogKeys[sk];
            }
            updateCategoryList();
            renderTrackContent();
            hideRowContextMenu();
            showToast('已复制一条');
        }

        document.getElementById('ctxDeleteRow').addEventListener('click', function() {
            deleteCurrentRow();
        });

        document.getElementById('ctxSubItemStatus').addEventListener('click', function() {
            showSubItemStatusModal();
        });

        document.getElementById('ctxExportSubItems').addEventListener('click', function() {
            exportPageViewEntrySubItems();
        });

        // 页面视图事项右键“导出表格”：等价于分项编辑窗口的“导出文档”，
        // 直接按该条日志的分项内容生成 Word 表格。
        function exportPageViewEntrySubItems() {
            var ctx = _pageViewCtxEntry;
            hideRowContextMenu();
            if (!ctx || !ctx.dateKey || !isFinite(ctx.origIndex)) { showToast('未找到要导出的日志'); return; }
            var list = reportData[ctx.dateKey];
            var row = list && list[ctx.origIndex];
            if (!row) { showToast('未找到要导出的日志'); return; }
            var parsed = parseSubItemContent(row.content || '');
            if (!parsed.items || parsed.items.length === 0) {
                showToast('内容中未发现以数字序号开头的分项');
                return;
            }
            var rows = [];
            for (var i = 0; i < parsed.items.length; i++) {
                var it = parsed.items[i];
                var disp = it.markPos >= 0 ? it.text.substring(0, it.markPos) : it.text;
                disp = disp.replace(/【[^】]*】\s*$/, '').replace(/\s+$/, '');
                rows.push({ displayText: disp, status: it.mark || '', timestamp: it.timestamp || '' });
            }
            exportSubItemRowsDoc(rows);
        }


        function _normalizeSubItemNameForLogMatch(name) {
            var s = (name || '').replace(/\s+/g, '');
            s = s.replace(/^[（(]?\s*\d+\s*[）).、:：]\s*/, '');
            s = s.replace(/[√■□×…]+$/g, '');
            s = s.replace(/[。；;、，,．.]+$/g, '');
            return s;
        }

        var subItemStatusContext = null;
        var subItemStatusMarks = ['■', '□', '√', '…', '×'];
        var subStatusOptions = [
            { value: '', label: '无状态' },
            { value: '√', label: '√ 已办结' },
            { value: '■', label: '■ 加急办理' },
            { value: '□', label: '□ 正常办理' },
            { value: '×', label: '× 已取消' },
            { value: '…', label: '… 备忘' }
        ];
        function statusToClass(s) {
            if (s === '√') return 'status-check';
            if (s === '■') return 'status-filled';
            if (s === '□') return 'status-empty';
            if (s === '×') return 'status-cross';
            if (s === '…') return 'status-dot';
            return '';
        }

        function parseSubItemContent(content) {
            content = (content || '').replace(/\r\n/g, '\n');
            var lines = content.split('\n');
            var numberReg = /^\s*(?:\d+[\.。、]|[\(\（]\d+[\)\）]|[\u2460-\u2473]|[\u24EB-\u24F4]|[\u3248-\u324F])\s*/;
            var items = [];
            for (var i = 0; i < lines.length; i++) {
                if (numberReg.test(lines[i])) {
                    items.push({lineIdx: i, text: lines[i], mark: '', markPos: -1, timestamp: ''});
                }
            }
            for (var j = 0; j < items.length; j++) {
                var line = items[j].text;
                var m = line.match(/([■□√…×])\s*$/);
                if (m) {
                    items[j].mark = m[1];
                    items[j].markPos = line.length - m[0].length;
                }
                var tsMatch = line.match(/【([^】]*)】/);
                if (tsMatch) {
                    items[j].timestamp = tsMatch[1];
                }
            }
            return { lines: lines, items: items };
        }
        // 保存日志时按主状态同步分项状态：
        // done：新建日志清空分项状态（显示空格）；已有日志把 □/■ 改为 √，其余保持；
        // memo / cancel：所有分项统一改为 … / ×。
        function _applyEntryStatusToSubItems(content, statusVal, isNewLog) {
            if (!content) return content;
            if (statusVal !== 'done' && statusVal !== 'memo' && statusVal !== 'cancel') return content;
            var parsed = parseSubItemContent(content);
            if (!parsed.items || !parsed.items.length) return content;
            var lines = parsed.lines;
            for (var i = 0; i < parsed.items.length; i++) {
                var it = parsed.items[i];
                var line = lines[it.lineIdx] || '';
                var base = line.replace(/[■□√…×]\s*$/, '').replace(/\s+$/, '');
                var nextMark = it.mark || '';
                if (statusVal === 'done') {
                    if (isNewLog) nextMark = '';
                    else if (it.mark === '□' || it.mark === '■') nextMark = '√';
                } else if (statusVal === 'memo') {
                    nextMark = '…';
                } else if (statusVal === 'cancel') {
                    nextMark = '×';
                }
                lines[it.lineIdx] = base + nextMark;
            }
            return lines.join('\n');
        }
        // 把旧版本内嵌在 content 文本里的 【时间戳】 迁移到独立的 subTimestamps 数组字段，
        // 并从 content 中剥离时间戳。仅匹配形如 yyyyMMdd[ HH:mm][-yyyyMMdd[ HH:mm]] 的时间戳，
        // 避免误伤工作日志中可能出现的其它 【】 括注。多次调用幂等；无时间戳数据不报错。
        var _subTsInnerRe = /^\d{8}(?:\s+\d{1,2}:\d{2})?(?:\s*-\s*\d{8}(?:\s+\d{1,2}:\d{2})?)?$/;
        function _migrateItemSubTimestamps(item) {
            if (!item || typeof item !== 'object') return;
            if (!Array.isArray(item.subTimestamps)) item.subTimestamps = [];
            var content = item.content;
            if (!content || content.indexOf('【') === -1) return;
            var parsed = parseSubItemContent(content);
            if (!parsed.items || parsed.items.length === 0) return;
            var lines = content.replace(/\r\n/g, '\n').split('\n');
            var newTs = [];
            var changed = false;
            for (var i = 0; i < parsed.items.length; i++) {
                var it = parsed.items[i];
                var tsMatch = it.text.match(/【([^】]*)】/);
                if (tsMatch && _subTsInnerRe.test(tsMatch[1].replace(/^\s+|\s+$/g, ''))) {
                    newTs.push(tsMatch[1].replace(/^\s+|\s+$/g, ''));
                    if (typeof lines[it.lineIdx] === 'string') {
                        lines[it.lineIdx] = lines[it.lineIdx].replace(/【[^】]*】/g, '');
                    }
                    changed = true;
                } else {
                    newTs.push(item.subTimestamps[i] || '');
                }
            }
            if (changed) {
                item.content = lines.join('\n');
                item.subTimestamps = newTs;
            }
        }
        function _migrateAllSubTimestamps() {
            for (var k in reportData) {
                if (!reportData.hasOwnProperty(k)) continue;
                var arr = reportData[k];
                if (!Array.isArray(arr)) continue;
                for (var i = 0; i < arr.length; i++) _migrateItemSubTimestamps(arr[i]);
            }
        }
        // 启动时执行数据迁移（从 store.js 移至此处，确保函数已定义）
        try { _migrateAllSubItemIds(); } catch (e_mig1) { console.warn('[work-log] _migrateAllSubItemIds failed:', e_mig1); }
        try { _migrateAllSubTimestamps(); } catch (e_mig2) { console.warn('[work-log] _migrateAllSubTimestamps failed:', e_mig2); }
        function _formatTimestampStr(date, endDate) {
            function pad(n) { return n < 10 ? '0' + n : '' + n; }
            var s = String(date.getFullYear()) + pad(date.getMonth() + 1) + pad(date.getDate());
            var hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
            if (hasTime) s += ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
            if (endDate) {
                var sameDay = endDate.getFullYear() === date.getFullYear() && endDate.getMonth() === date.getMonth() && endDate.getDate() === date.getDate();
                if (sameDay) {
                    var eHasTime = endDate.getHours() !== 0 || endDate.getMinutes() !== 0;
                    if (eHasTime && (endDate.getHours() !== date.getHours() || endDate.getMinutes() !== date.getMinutes())) {
                        s += ' - ' + pad(endDate.getHours()) + ':' + pad(endDate.getMinutes());
                    }
                } else {
                    var eStr = String(endDate.getFullYear()) + pad(endDate.getMonth() + 1) + pad(endDate.getDate());
                    var eHasTime2 = endDate.getHours() !== 0 || endDate.getMinutes() !== 0;
                    if (eHasTime2) eStr += ' ' + pad(endDate.getHours()) + ':' + pad(endDate.getMinutes());
                    s += ' - ' + eStr;
                }
            }
            return s;
        }
        function _nowTimestampStr() {
            return _formatTimestampStr(new Date());
        }
        function _shouldAutoFinishFromSubItems(rows) {
            if (!rows || !rows.length) return false;
            // 仅当每个分项都有明确状态，且都不为 □（含无状态）或 ■ 时，整条日志才自动视为完成。
            return rows.every(function(row) {
                var mark = row && (row.mark || row.status || '');
                return !!mark && mark !== '□' && mark !== '■';
            });
        }
        function _finishParentItemFromSubItems(item, rows) {
            if (!item || !_shouldAutoFinishFromSubItems(rows)) return false;
            item.status = 'done';
            if (item.endAuto === true || item.endTime === '——' || !item.endTime) {
                item.endTime = _formatTodayModalDateStr();
                item.endAuto = false;
                item.time = (item.startTime || '') + '—' + item.endTime;
            }
            return true;
        }
        function _parseTimestampStr(ts) {
            var re = /(\d{4})(\d{2})(\d{2})(?:\s+(\d{1,2}):(\d{2}))?(?:\s*-\s*(\d{4})(\d{2})(\d{2})(?:\s+(\d{1,2}):(\d{2}))?)?/;
            var m = ts.match(re);
            if (!m) return null;
            var d1 = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), m[4] ? parseInt(m[4]) : 0, m[5] ? parseInt(m[5]) : 0);
            var d2 = null;
            if (m[6]) d2 = new Date(parseInt(m[6]), parseInt(m[7]) - 1, parseInt(m[8]), m[9] ? parseInt(m[9]) : 0, m[10] ? parseInt(m[10]) : 0);
            return { start: d1, end: d2 };
        }

        function buildSubStatusBody() {
            var body = document.getElementById('subItemStatusBody');
            if (!body || !subItemStatusContext) return;
            body.innerHTML = '';
            var rows = subItemStatusContext.rows;
            var dragSrc = -1;
            for (var i = 0; i < rows.length; i++) {
                (function(idx) {
                    var r = rows[idx];
                    var rowEl = document.createElement('div');
                    rowEl.className = 'subStatusRow';
                    rowEl.dataset.idx = String(idx);

                    var itemEl = document.createElement('div');
                    itemEl.className = 'subStatusItem ' + statusToClass(r.status);
                    itemEl.addEventListener('click', function() { subStatusMenuTargetIdx = idx; });
                    var textSpan = document.createElement('span');
                    textSpan.textContent = r.displayText;
                    itemEl.appendChild(textSpan);
                    if (r.timestamp) {
                        var tsBtn = document.createElement('span');
                        tsBtn.className = 'subStatusTsBtn';
                        tsBtn.textContent = r.timestamp;
                        tsBtn.title = '点击编辑时间戳';
                        (function(tsIdx) {
                            tsBtn.addEventListener('click', function(e) {
                                e.stopPropagation();
                                e.preventDefault();
                                openSubItemTsEditor(tsIdx);
                            });
                        })(idx);
                        itemEl.appendChild(document.createTextNode(' '));
                        itemEl.appendChild(tsBtn);
                    }
                    itemEl.setAttribute('draggable', 'true');
                    itemEl.addEventListener('dragstart', function(e) {
                        dragSrc = idx;
                        itemEl.classList.add('dragging');
                        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); } catch (err) {}
                    });
                    itemEl.addEventListener('dragend', function() {
                        itemEl.classList.remove('dragging');
                        clearSubStatusDragOver();
                    });
                    itemEl.addEventListener('dragover', function(e) {
                        if (dragSrc < 0) return;
                        e.preventDefault();
                        try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
                        var rect = itemEl.getBoundingClientRect();
                        var above = (e.clientY - rect.top) < rect.height / 2;
                        clearSubStatusDragOver();
                        itemEl.classList.add(above ? 'drop-above' : 'drop-below');
                    });
                    itemEl.addEventListener('dragleave', function() {
                        itemEl.classList.remove('drop-above');
                        itemEl.classList.remove('drop-below');
                    });
                    itemEl.addEventListener('drop', function(e) {
                        e.preventDefault();
                        clearSubStatusDragOver();
                        if (dragSrc < 0 || dragSrc === idx) return;
                        var rect = itemEl.getBoundingClientRect();
                        var above = (e.clientY - rect.top) < rect.height / 2;
                        var targetIdx = above ? idx : idx + 1;
                        var moved = subItemStatusContext.rows.splice(dragSrc, 1)[0];
                        if (dragSrc < targetIdx) targetIdx--;
                        subItemStatusContext.rows.splice(targetIdx, 0, moved);
                        renumberSubStatusRows();
                        dragSrc = -1;
                        buildSubStatusBody();
                    });
                    itemEl.addEventListener('contextmenu', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        showSubStatusItemMenu(e.clientX, e.clientY, idx);
                    });
                    rowEl.appendChild(itemEl);

                    var stEl = document.createElement('div');
                    stEl.className = 'subStatusStatus ' + statusToClass(r.status);
                    var sel = document.createElement('select');
                    sel.className = 'subStatusSelect';
                    for (var oi = 0; oi < subStatusOptions.length; oi++) {
                        var op = document.createElement('option');
                        op.value = subStatusOptions[oi].value;
                        op.textContent = subStatusOptions[oi].label;
                        sel.appendChild(op);
                    }
                    sel.value = r.status || '';
                    sel.addEventListener('change', function() {
                        var newVal = sel.value || '';
                        var oldVal = subItemStatusContext.rows[idx].status || '';
                        var hadTs = !!subItemStatusContext.rows[idx].timestamp;
                        subItemStatusContext.rows[idx].status = newVal;
                        if (newVal && newVal !== oldVal) {
                            if (newVal === '√') {
                                if (hadTs) {
                                    var prev = _parseTimestampStr(subItemStatusContext.rows[idx].timestamp);
                                    var now = new Date();
                                    if (prev && prev.start) {
                                        subItemStatusContext.rows[idx].timestamp = _formatTimestampStr(prev.start, now);
                                    } else {
                                        subItemStatusContext.rows[idx].timestamp = _nowTimestampStr();
                                    }
                                } else {
                                    subItemStatusContext.rows[idx].timestamp = _nowTimestampStr();
                                }
                            } else if (!hadTs) {
                                subItemStatusContext.rows[idx].timestamp = _nowTimestampStr();
                            }
                        }
                        buildSubStatusBody();
                    });
                    stEl.appendChild(sel);
                    rowEl.appendChild(stEl);

                    body.appendChild(rowEl);
                })(i);
            }
            applySubItemStatusFontSize(subItemStatusFontSize);
        }
        function clearSubStatusDragOver() {
            var els = document.querySelectorAll('#subItemStatusBody .subStatusItem');
            for (var i = 0; i < els.length; i++) {
                els[i].classList.remove('drop-above');
                els[i].classList.remove('drop-below');
            }
        }
        var subStatusMenuTargetIdx = -1;
        function showSubStatusItemMenu(x, y, idx) {
            var menu = document.getElementById('subStatusItemMenu');
            if (!menu) return;
            subStatusMenuTargetIdx = idx;
            var delTsItem = document.getElementById('subStatusDelTsItem');
            if (delTsItem) {
                var hasTs = subItemStatusContext && subItemStatusContext.rows && subItemStatusContext.rows[idx] && !!subItemStatusContext.rows[idx].timestamp;
                delTsItem.style.display = hasTs ? '' : 'none';
            }
            menu.classList.add('show');
            menu.style.left = '0px';
            menu.style.top = '0px';
            var rw = menu.offsetWidth, rh = menu.offsetHeight;
            var left = x, top = y;
            if (left + rw > window.innerWidth - 8) left = window.innerWidth - rw - 8;
            if (top + rh > window.innerHeight - 8) top = window.innerHeight - rh - 8;
            if (left < 4) left = 4;
            if (top < 4) top = 4;
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';
        }
        function hideSubStatusItemMenu() {
            var menu = document.getElementById('subStatusItemMenu');
            if (menu) menu.classList.remove('show');
            subStatusMenuTargetIdx = -1;
        }
        (function bindSubStatusMenu() {
            var menu = document.getElementById('subStatusItemMenu');
            if (!menu) return;
            menu.addEventListener('click', function(e) {
                var it = e.target.closest('.paCtxItem');
                if (!it) return;
                var act = it.getAttribute('data-action');
                handleSubStatusItemAction(act);
            });
            menu.addEventListener('contextmenu', function(e) { e.preventDefault(); });
            document.addEventListener('click', function(e) {
                if (!e.target.closest('#subStatusItemMenu')) hideSubStatusItemMenu();
            });
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') hideSubStatusItemMenu();
            });
        })();
        function stripSubItemPrefix(text) {
            return (text || '').replace(/^\s*((?:\d+)|(?:[一二三四五六七八九十]+))[\.。、]\s*/, '')
                                .replace(/^\s*[\(\（]((?:\d+)|(?:[一二三四五六七八九十]+))[\)\）]\s*/, '');
        }
        function handleSubStatusItemAction(action) {
            if (subStatusMenuTargetIdx < 0 || !subItemStatusContext) { hideSubStatusItemMenu(); return; }
            var idx = subStatusMenuTargetIdx;
            hideSubStatusItemMenu();
            var rows = subItemStatusContext.rows;
            if (action === 'edit') {
                var current = rows[idx] ? rows[idx].displayText || '' : '';
                var pure = stripSubItemPrefix(current);
                if (typeof window.paShowTagDialog !== 'function') { showToast('编辑对话框不可用'); return; }
                window.paShowTagDialog(pure, function(input) {
                    if (input === null) return;
                    var clean = (input || '').replace(/[\r\n]+/g, ' ').replace(/^\s+|\s+$/g, '');
                    rows[idx].displayText = clean;
                    renumberSubStatusRows();
                    buildSubStatusBody();
                }, { title: '请输入事项内容：', okText: '确定', singleLine: true });
                return;
            }
            if (action === 'add') {
                if (typeof window.paShowTagDialog !== 'function') { showToast('编辑对话框不可用'); return; }
                window.paShowTagDialog('', function(input) {
                    if (input === null) return;
                    var clean = (input || '').replace(/[\r\n]+/g, ' ').replace(/^\s+|\s+$/g, '');
                    if (!clean) return;
                    rows.splice(idx + 1, 0, { displayText: clean, status: '', timestamp: '', subId: subItemStatusContext.isWeekWork ? _weekWorkNowId() : '' });
                    renumberSubStatusRows();
                    buildSubStatusBody();
                }, { title: '请输入事项内容：', okText: '新增', singleLine: true });
                return;
            }
            if (action === 'add-log') {
                if (subItemStatusContext.dateKey !== undefined && subItemStatusContext.origIndex !== undefined) {
                    pageViewAddSubItemToLog(subItemStatusContext.dateKey, subItemStatusContext.origIndex, idx);
                }
                return;
            }
            if (action === 'delete-ts') {
                if (rows[idx]) rows[idx].timestamp = '';
                buildSubStatusBody();
                return;
            }
        }
        function addSubItemToLog(idx) {
            if (idx === undefined || idx === null || !subItemStatusContext) { hideSubStatusItemMenu(); return; }
            var rows = subItemStatusContext.rows;
            var itemText = rows[idx] ? (rows[idx].displayText || '') : '';
            var pure = stripSubItemPrefix(itemText);
            var targetKey = getDateKeyFor(timeRangeStart.getFullYear(), timeRangeStart.getMonth(), timeRangeStart.getDate());
            if (!reportData[targetKey]) reportData[targetKey] = [];
            var defaultDate = (timeRangeStart.getMonth() + 1) + '月' + timeRangeStart.getDate() + '日（周' + weekDays[timeRangeStart.getDay()] + '）';
            var pureWithTag = '周工作：' + pure;
            var defaultItem = { category: '周工作', startTime: defaultDate, endTime: '——', time: defaultDate, content: '', remark: pureWithTag, status: 'normal', attachments: [], _pendingInsert: true };
            reportData[targetKey].push(defaultItem);
            updateCategoryList();
            S.editingRowIndex = reportData[targetKey].length - 1;
            S.editingDateKey = targetKey;
            editingPendingInsert = true;
            editingInsertAfterIndex = -1;
            S._deferLogRefresh = true;
            document.getElementById('editCategory').value = '周工作';
            document.getElementById('editStartTime').value = defaultDate;
            var endAutoChk = document.getElementById('editEndAuto');
            if (endAutoChk) endAutoChk.checked = true;
            toggleEndTimeAuto(true);
            document.getElementById('editContent').value = '';
            document.getElementById('editRemark').value = pureWithTag;
            document.getElementById('editStatus').value = 'normal';
            S.currentAttachments = [];
            renderAttachmentList();
            _resetAttachInputs();
            initCategoryInput();
            applyEditModalFontSize(editModalFontSize);
            var subModal = document.getElementById('subItemStatusModal');
            if (subModal) subModal.style.zIndex = '10400';
            _updateEditWeekNav();
            closeWeekPopups();
            document.getElementById('editModal').classList.add('show');
        }
        function renumberSubStatusRows() {
            if (!subItemStatusContext) return;
            var rows = subItemStatusContext.rows;
            // detect dominant prefix style based on first row
            if (!rows.length) return;
            var first = rows[0].displayText;
            var styleMatch = first.match(/^(\s*)(\d+)([\.。、])/);
            var stylePat;
            if (styleMatch && /\d+/.test(styleMatch[2])) {
                stylePat = { type: 'arabic', sep: styleMatch[3], leading: styleMatch[1] };
            } else if (styleMatch) {
                stylePat = { type: 'cn', sep: styleMatch[3], leading: styleMatch[1] };
            } else {
                // try parenthesised
                var pm = first.match(/^(\s*)([\(\（])((?:\d+)|(?:[一二三四五六七八九十]+))([\)\）])/);
                if (pm) {
                    stylePat = { type: pm[3] && /\d+/.test(pm[3]) ? 'arabic-paren' : 'cn-paren', open: pm[2], close: pm[4], leading: pm[1] };
                } else {
                    return; // unknown, skip
                }
            }
            var CN = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];
            for (var i = 0; i < rows.length; i++) {
                var t = rows[i].displayText;
                var stripped = t.replace(/^\s*\d+[\.。、]\s*/, '')
                                .replace(/^\s*[\(\（]\d+[\)\）]\s*/, '');
                var prefix;
                if (stylePat.type === 'arabic') prefix = (stylePat.leading || '') + (i + 1) + stylePat.sep;
                else if (stylePat.type === 'cn') prefix = (stylePat.leading || '') + (CN[i] || (i + 1)) + stylePat.sep;
                else if (stylePat.type === 'arabic-paren') prefix = (stylePat.leading || '') + stylePat.open + (i + 1) + stylePat.close;
                else if (stylePat.type === 'cn-paren') prefix = (stylePat.leading || '') + stylePat.open + (CN[i] || (i + 1)) + stylePat.close;
                else prefix = '';
                rows[i].displayText = prefix + stripped;
            }
        }

        function showSubItemStatusModal() {
            var menu = document.getElementById('rowContextMenu');
            var dateKey = menu.dataset.dateKey || '';
            var origIndex = parseInt(menu.dataset.origIndex, 10);
            var rowIndex = parseInt(menu.dataset.rowIndex, 10);
            hideRowContextMenu();
            var row = null;
            if (dateKey && isFinite(origIndex) && reportData[dateKey] && reportData[dateKey][origIndex]) {
                row = reportData[dateKey][origIndex];
                row._dateKey = dateKey;
                row._origIndex = origIndex;
            } else {
                var filteredData = getFilteredData();
                row = filteredData[rowIndex];
            }
            if (!row) { showToast('未找到数据行'); return; }
            var parsed = parseSubItemContent(row.content || '');
            if (!parsed.items || parsed.items.length === 0) {
                showToast('内容中未发现以数字序号开头的分项');
                return;
            }
            var subTs = Array.isArray(row.subTimestamps) ? row.subTimestamps : [];
            var isWeekWork = row.category && row.category.indexOf('周') !== -1 && row.category.indexOf('工作') !== -1;
            var rows = [];
            for (var i = 0; i < parsed.items.length; i++) {
                var it = parsed.items[i];
                var disp = it.markPos >= 0 ? it.text.substring(0, it.markPos) : it.text;
                disp = disp.replace(/【[^】]*】\s*$/, '').replace(/\s+$/, '');
                var ts = (subTs.length > i && subTs[i]) ? subTs[i] : (it.timestamp || '');
                var subId = isWeekWork ? _subItemIdAt(row, i) : '';
                rows.push({ displayText: disp, status: it.mark || '', timestamp: ts, subId: subId });
            }
            subItemStatusContext = {
                dateKey: row._dateKey,
                origIndex: row._origIndex,
                originalContent: row.content || '',
                isWeekWork: isWeekWork,
                parsed: parsed,
                rows: rows
            };
            var weekAction = document.getElementById('subItemWeekAction');
            if (weekAction) {
                weekAction.style.display = timeRangeType === 'week' && row.category && row.category.indexOf('周') !== -1 && row.category.indexOf('工作') !== -1 ? 'flex' : 'none';
                var moveCheck = document.getElementById('subItemWeekMove');
                var copyCheck = document.getElementById('subItemWeekCopy');
                if (moveCheck) moveCheck.checked = false;
                if (copyCheck) copyCheck.checked = true;
                var direction = document.getElementById('subItemWeekDirection');
                if (direction) direction.value = 'next';
            }
            buildSubStatusBody();
            document.getElementById('subItemStatusModal').classList.add('show');
            if (subItemStatusFontSize !== 16) applySubItemStatusFontSize(subItemStatusFontSize);
        }

        function closeSubItemStatusModal() {
            document.getElementById('subItemStatusModal').classList.remove('show');
            document.getElementById('subItemStatusModal').style.zIndex = '';
            subItemStatusContext = null;
            if (_deferLogRefresh) {
                S._deferLogRefresh = false;
                renderTrackContent();
            }
        }

        function setSubItemWeekMode(mode) {
            var moveCheck = document.getElementById('subItemWeekMove');
            var copyCheck = document.getElementById('subItemWeekCopy');
            if (mode === 'move') {
                if (moveCheck) moveCheck.checked = true;
                if (copyCheck) copyCheck.checked = false;
            } else {
                if (moveCheck) moveCheck.checked = false;
                if (copyCheck) copyCheck.checked = true;
            }
        }

        function applySubItemWeekAction() {
            var moveCheck = document.getElementById('subItemWeekMove');
            var direction = document.getElementById('subItemWeekDirection');
            adjustSubItemToWeek(moveCheck && moveCheck.checked ? 'move' : 'copy', direction && direction.value === 'prev' ? -1 : 1);
        }

        function adjustSubItemToWeek(mode, weekOffset) {
            if (!subItemStatusContext) return;
            var ctx = subItemStatusContext;
            var source = reportData[ctx.dateKey] && reportData[ctx.dateKey][ctx.origIndex];
            var idx = subStatusMenuTargetIdx;
            if (!source || !ctx.rows[idx]) { showToast('请先在分项列表中右键选择要操作的分项'); return; }
            var row = ctx.rows[idx];
            var sourceParsed = parseSubItemContent(source.content || '');
            var sourceItem = sourceParsed.items[idx];
            if (!sourceItem) return;
            var text = (row.displayText || '').replace(/^\s*\d+[\.。、]\s*/, '').replace(/[■□√…×]\s*$/, '').replace(/^\s+|\s+$/g, '');
            var start = pageViewWeekDateStart(parseTimeStrToDate(source.startTime, _yearFromKey(ctx.dateKey)) || new Date());
            start.setDate(start.getDate() + (weekOffset < 0 ? -7 : 7));
            // 目标周在未来时，√/× 回落为 □。
            var movedMark = _futureWeekMark(row.status || '', start);
            var movedTs = movedMark === (row.status || '') ? (row.timestamp || '') : '';
            var nextEnd = new Date(start); nextEnd.setDate(start.getDate() + 6);
            var nextKey = getDateKeyFor(start.getFullYear(), start.getMonth(), start.getDate());
            var target = null, targetKey = nextKey;
            for (var key in reportData) {
                var arr = reportData[key] || [];
                for (var j = 0; j < arr.length; j++) {
                    if (arr[j].category === '周工作' && dateRangeContains(arr[j].startTime, arr[j].endTime, start, _yearFromKey(key))) { target = arr[j]; targetKey = key; break; }
                }
                if (target) break;
            }
            var startText = (start.getMonth() + 1) + '月' + start.getDate() + '日（周' + weekDays[start.getDay()] + '）';
            var endText = (nextEnd.getMonth() + 1) + '月' + nextEnd.getDate() + '日（周' + weekDays[nextEnd.getDay()] + '）';
            if (!target) {
                if (!reportData[targetKey]) reportData[targetKey] = [];
                target = { category: '周工作', startTime: startText, endTime: endText, time: startText + '—' + endText, content: '', remark: '', status: 'normal', attachments: [] };
                reportData[targetKey].push(target);
            }
            var targetParsed = parseSubItemContent(target.content || '');
            for (var ti = 0; ti < targetParsed.items.length; ti++) {
                if (normalizePageViewSubItemName(targetParsed.items[ti].text) === normalizePageViewSubItemName(text)) {
                    showToast((weekOffset < 0 ? '上周' : '下周') + '已有该项工作，不能重复添加');
                    return;
                }
            }
             var _targetCount = targetParsed.items.length + 1;
             targetParsed.lines.push(_replaceSubItemSequence(sourceItem.text, targetParsed.items.length + 1).replace(/[■□√…×]\s*$/, '') + (movedMark || ''));
             target.content = targetParsed.lines.join('\n');
             if (movedTs || Array.isArray(target.subTimestamps)) {
                 if (!Array.isArray(target.subTimestamps)) target.subTimestamps = [];
                 while (target.subTimestamps.length < _targetCount - 1) target.subTimestamps.push('');
                 target.subTimestamps.push(movedTs || '');
             }
             if (ctx.isWeekWork) {
                 if (!Array.isArray(target.subItemIds)) target.subItemIds = [];
                 target.subItemIds.push(mode === 'move' ? (row.subId || _weekWorkNowId()) : _weekWorkNowId());
             }
              if (mode === 'move') {
                  sourceParsed.lines.splice(sourceItem.lineIdx, 1);
                  source.content = sourceParsed.lines.join('\n').replace(/^\n+|\n+$/g, '');
                  if (Array.isArray(source.subTimestamps)) source.subTimestamps.splice(idx, 1);
                  if (ctx.isWeekWork && Array.isArray(source.subItemIds)) source.subItemIds.splice(idx, 1);
                  source.content = renumberMovedSubItems(source.content);
                  if (!String(source.content || '').trim() && confirm('迁移后当前日志内容已为空，是否删除该日志记录？')) {
                      reportData[ctx.dateKey].splice(ctx.origIndex, 1);
                      delete _stagedLogKeys[ctx.dateKey + '::' + ctx.origIndex];
                  }
              }
             _saveReportToCache();
            closeSubItemStatusModal();
            renderTrackContent();
            updateFooterTimestamp();
            showToast((mode === 'move' ? '已迁移到' : '已复制到') + (weekOffset < 0 ? '上周' : '下周'));
        }

        function renumberMovedSubItems(content) {
            var parsed = parseSubItemContent(content || '');
            if (!parsed.items.length) return content || '';
            var first = parsed.items[0].text;
             var m = first.match(/^(\s*)(\d+)([.．。、])(\s*)/);
             var circled = first.match(/^(\s*)([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])/);
             var leading = m ? m[1] : (circled ? circled[1] : '');
             var sep = m ? m[3] : '';
             var afterSep = m ? m[4] : '';
            var circledNums = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
            for (var i = 0; i < parsed.items.length; i++) {
                var item = parsed.items[i];
                var line = parsed.lines[item.lineIdx];
                 var prefix = circled ? leading + (circledNums[i] || String(i + 1)) : leading + (i + 1) + sep + afterSep;
                parsed.lines[item.lineIdx] = line.replace(/^\s*(?:\d+[.．。、]|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*/, prefix);
            }
            return parsed.lines.join('\n');
        }

        var _subItemTsEditIdx = -1;
        function _pad2(n) { return n < 10 ? '0' + n : '' + n; }
        function _dateToInput(d) { return d.getFullYear() + '-' + _pad2(d.getMonth() + 1) + '-' + _pad2(d.getDate()); }
        function _timeToInput(d) { return _pad2(d.getHours()) + ':' + _pad2(d.getMinutes()); }
        function openSubItemTsEditor(idx) {
            if (!subItemStatusContext) return;
            _subItemTsEditIdx = idx;
            _tsLastBtn.start = null; _tsLastBtn.end = null;
            _tsSetActive('start', null);
            _tsSetActive('end', null);
            var ts = subItemStatusContext.rows[idx] ? (subItemStatusContext.rows[idx].timestamp || '') : '';
            var sd = document.getElementById('tsStartDate');
            var st = document.getElementById('tsStartTime');
            var ed = document.getElementById('tsEndDate');
            var et = document.getElementById('tsEndTime');
            if (ts) {
                var p = _parseTimestampStr(ts);
                if (p && p.start) {
                    sd.value = _dateToInput(p.start);
                    var hasTime = p.start.getHours() !== 0 || p.start.getMinutes() !== 0;
                    st.value = hasTime ? _timeToInput(p.start) : '';
                    if (p.end) {
                        ed.value = _dateToInput(p.end);
                        var eHasTime = p.end.getHours() !== 0 || p.end.getMinutes() !== 0;
                        et.value = eHasTime ? _timeToInput(p.end) : '';
                    } else { ed.value = ''; et.value = ''; }
                } else { sd.value=''; st.value=''; ed.value=''; et.value=''; }
            } else {
                var now = new Date();
                sd.value = _dateToInput(now);
                st.value = _timeToInput(now);
                ed.value = ''; et.value = '';
            }
            document.getElementById('subItemTsModal').classList.add('show');
        }
        function closeSubItemTsEditor() {
            document.getElementById('subItemTsModal').classList.remove('show');
            _subItemTsEditIdx = -1;
        }
        function confirmSubItemTsEditor() {
            if (_subItemTsEditIdx < 0 || !subItemStatusContext) { closeSubItemTsEditor(); return; }
            var sd = document.getElementById('tsStartDate').value;
            var st = document.getElementById('tsStartTime').value;
            var ed = document.getElementById('tsEndDate').value;
            var et = document.getElementById('tsEndTime').value;
            if (!sd) { showToast('请选择起始日期'); return; }
            var parts = sd.split('-');
            var d1 = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (st) { var tp = st.split(':'); d1.setHours(parseInt(tp[0]), parseInt(tp[1])); }
            var d2 = null;
            if (ed) {
                var ep = ed.split('-');
                d2 = new Date(parseInt(ep[0]), parseInt(ep[1]) - 1, parseInt(ep[2]));
                if (et) { var etp = et.split(':'); d2.setHours(parseInt(etp[0]), parseInt(etp[1])); }
            }
            subItemStatusContext.rows[_subItemTsEditIdx].timestamp = _formatTimestampStr(d1, d2);
            closeSubItemTsEditor();
            buildSubStatusBody();
        }

        var _tsQuickTimes = {
            start: { am: '08:00', pm: '14:00', eve: '20:00' },
            end:   { am: '12:00', pm: '17:00', eve: '22:00' }
        };
        var _tsQuickKeys = {
            start: { am: 'tsQuickAmStart', pm: 'tsQuickPmStart', eve: 'tsQuickEveStart' },
            end:   { am: 'tsQuickAmEnd',   pm: 'tsQuickPmEnd',   eve: 'tsQuickEveEnd' }
        };
        var _tsLastBtn = { start: null, end: null };
        function _loadTsQuickTimes() {
            try {
                var v;
                v = DataLayer.getRaw(_tsQuickKeys.start.am); if (v) _tsQuickTimes.start.am = v;
                v = DataLayer.getRaw(_tsQuickKeys.start.pm); if (v) _tsQuickTimes.start.pm = v;
                v = DataLayer.getRaw(_tsQuickKeys.start.eve); if (v) _tsQuickTimes.start.eve = v;
                v = DataLayer.getRaw(_tsQuickKeys.end.am); if (v) _tsQuickTimes.end.am = v;
                v = DataLayer.getRaw(_tsQuickKeys.end.pm); if (v) _tsQuickTimes.end.pm = v;
                v = DataLayer.getRaw(_tsQuickKeys.end.eve); if (v) _tsQuickTimes.end.eve = v;
            } catch (e) {}
        }
        function _saveTsQuickTime(target, which, val) {
            _tsQuickTimes[target][which] = val;
            try { DataLayer.setRaw(_tsQuickKeys[target][which], val); } catch (e) {}
        }
        function _tsSetActive(target, which) {
            var row = document.querySelector('#subItemTsModal .tsBtnRow[data-target="' + target + '"]');
            if (!row) return;
            var btns = row.querySelectorAll('.tsQuickBtn');
            for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
            if (which && which !== 'clear') {
                var btn = row.querySelector('.tsQuickBtn[data-which="' + which + '"]');
                if (btn) btn.classList.add('active');
            }
        }
        function _tsQuickTime(target, which) {
            var input = document.getElementById(target === 'start' ? 'tsStartTime' : 'tsEndTime');
            if (!input) return;
            if (which === 'clear') {
                input.value = '';
                _tsLastBtn[target] = null;
                _tsSetActive(target, null);
                return;
            }
            input.value = _tsQuickTimes[target][which];
            _tsLastBtn[target] = which;
            _tsSetActive(target, which);
        }
        function _tsOnTimeInput(target) {
            var last = _tsLastBtn[target];
            if (!last) return;
            var input = document.getElementById(target === 'start' ? 'tsStartTime' : 'tsEndTime');
            if (input && input.value && input.value !== _tsQuickTimes[target][last]) {
                _saveTsQuickTime(target, last, input.value);
            }
            _tsLastBtn[target] = null;
        }
        function _tsDateNextStr(dStr) {
            if (!dStr) return '';
            var p = dStr.split('-');
            var d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
            d.setDate(d.getDate() + 1);
            return _dateToInput(d);
        }
        function _tsQuickDate(kind) {
            var sd = document.getElementById('tsStartDate');
            var ed = document.getElementById('tsEndDate');
            if (!sd || !ed) return;
            if (kind === 'same') {
                ed.value = sd.value;
            } else if (kind === 'next') {
                ed.value = _tsDateNextStr(sd.value);
            } else if (kind === 'plus') {
                if (!ed.value || ed.value === sd.value) ed.value = _tsDateNextStr(sd.value);
                else ed.value = _tsDateNextStr(ed.value);
            }
        }
        _loadTsQuickTimes();
        (function bindTsTimeInputs() {
            var st = document.getElementById('tsStartTime');
            var et = document.getElementById('tsEndTime');
            if (st) st.addEventListener('change', function() { _tsOnTimeInput('start'); });
            if (et) et.addEventListener('change', function() { _tsOnTimeInput('end'); });
        })();

        function sortSubItemStatus() {
            if (!subItemStatusContext) return;
            var orderMap = { '■': 0, '□': 1, '': 2, '√': 3, '…': 4, '×': 5 };
            var indexed = subItemStatusContext.rows.map(function(r, i) { return { row: r, idx: i }; });
            indexed.sort(function(a, b) {
                var oa = orderMap[a.row.status]; if (oa === undefined) oa = 2;
                var ob = orderMap[b.row.status]; if (ob === undefined) ob = 2;
                if (oa !== ob) return oa - ob;
                return a.idx - b.idx;
            });
            subItemStatusContext.rows = indexed.map(function(x) { return x.row; });
            renumberSubStatusRows();
            buildSubStatusBody();
        }

        function confirmSubItemStatus() {
            if (!subItemStatusContext) { closeSubItemStatusModal(); return; }
            var ctx = subItemStatusContext;
            var rows = ctx.rows || [];
            var origLines = ctx.parsed.lines || [];
            var origItems = ctx.parsed.items || [];
            // Compose fresh numbered block from current rows (status appended inline;
            // timestamps are stored separately in subTimestamps, not embedded in content).
            var newRowLines = rows.map(function(r) {
                var base = (r.displayText || '').replace(/\s+$/, '');
                var line = base;
                if (r.status) line += r.status;
                return line;
            });
            var newSubTs = rows.map(function(r) { return r.timestamp || ''; });
            var resultLines;
            if (origItems.length === 0) {
                // Original content had no numbered lines — append the new rows after existing content
                resultLines = origLines.slice();
                if (resultLines.length > 0 && resultLines[resultLines.length - 1].trim() !== '') {
                    // ensure separation
                }
                resultLines = resultLines.concat(newRowLines);
            } else {
                var firstNumberedIdx = origItems[0].lineIdx;
                var lastNumberedIdx = origItems[origItems.length - 1].lineIdx;
                var before = origLines.slice(0, firstNumberedIdx);
                var after = origLines.slice(lastNumberedIdx + 1);
                resultLines = before.concat(newRowLines).concat(after);
            }
            var newContent = resultLines.join('\n');
            if (reportData[ctx.dateKey] && reportData[ctx.dateKey][ctx.origIndex]) {
                var targetItem = reportData[ctx.dateKey][ctx.origIndex];
                targetItem.content = newContent;
                targetItem.subTimestamps = newSubTs;
                if (ctx.isWeekWork) {
                    var ids = [];
                    for (var ri = 0; ri < rows.length; ri++) {
                        ids.push(rows[ri].subId || _weekWorkNowId());
                    }
                    targetItem.subItemIds = ids;
                }
                  _finishParentItemFromSubItems(targetItem, rows);
            }
            closeSubItemStatusModal();
            renderTrackContent();
            showToast('已更新分项状态');
        }

        function getSubItemTemplateXml() {
            var el = document.getElementById('subItemStatusTemplate');
            return el ? el.textContent : '';
        }
        function splitSubItemRemark(text) {
            var t = (text || '').replace(/\s+$/, '');
            if (!t) return { name: '', remark: '' };
            var endChar = t.charAt(t.length - 1);
            if (endChar !== '）' && endChar !== ')') return { name: t, remark: '' };
            var openChar = endChar === '）' ? '（' : '(';
            var depth = 0;
            var openIdx = -1;
            for (var i = t.length - 1; i >= 0; i--) {
                var ch = t.charAt(i);
                if (ch === ')' || ch === '）') depth++;
                else if (ch === '(' || ch === '（') {
                    depth--;
                    if (depth === 0) { openIdx = i; break; }
                }
            }
            if (openIdx < 0) return { name: t, remark: '' };
            var name = t.substring(0, openIdx).replace(/\s+$/, '');
            var inner = t.substring(openIdx + 1, t.length - 1).replace(/^\s+|\s+$/g, '');
            return { name: name, remark: inner };
        }
        function buildSubItemRowXml(seq, name, remark) {
            var seqText = escapeXmlForWord(seq);
            var nameText = escapeXmlForWord(name);
            var remarkText = escapeXmlForWord(remark);
            var rowXml = '';
            rowXml += '<w:tr><w:tblPrEx><w:tblBorders><w:top w:val="single" w:sz="12" wx:bdrwidth="30" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="12" wx:bdrwidth="30" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="12" wx:bdrwidth="30" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="12" wx:bdrwidth="30" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" wx:bdrwidth="10" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" wx:bdrwidth="10" w:space="0" w:color="auto"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPrEx><w:trPr><w:trHeight w:val="970" w:h-rule="atLeast"/><w:jc w:val="center"/></w:trPr>';
            rowXml += '<w:tc><w:tcPr><w:tcW w:w="1060" w:type="dxa"/><w:tcBorders><w:tl2br w:val="nil"/><w:tr2bl w:val="nil"/></w:tcBorders><w:shd w:val="clear" w:color="000000" w:fill="FFFFFF"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:line="360" w:line-rule="exact"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="楷体_GB2312" w:h-ansi="楷体_GB2312" w:fareast="楷体_GB2312" w:cs="楷体_GB2312" w:hint="default"/><w:sz w:val="32"/><w:sz-cs w:val="32"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="楷体_GB2312" w:h-ansi="楷体_GB2312" w:fareast="楷体_GB2312" w:cs="楷体_GB2312" w:hint="fareast"/><w:sz w:val="32"/><w:sz-cs w:val="32"/></w:rPr><w:t>' + seqText + '</w:t></w:r></w:p></w:tc>';
            rowXml += '<w:tc><w:tcPr><w:tcW w:w="6264" w:type="dxa"/><w:tcBorders><w:tl2br w:val="nil"/><w:tr2bl w:val="nil"/></w:tcBorders><w:shd w:val="clear" w:color="000000" w:fill="FFFFFF"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:line="360" w:line-rule="exact"/><w:jc w:val="left"/><w:rPr><w:rFonts w:ascii="仿宋_GB2312" w:h-ansi="仿宋_GB2312" w:fareast="仿宋_GB2312" w:cs="仿宋_GB2312" w:hint="default"/><w:sz w:val="32"/><w:sz-cs w:val="32"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="仿宋_GB2312" w:h-ansi="仿宋_GB2312" w:fareast="仿宋_GB2312" w:cs="仿宋_GB2312" w:hint="fareast"/><w:sz w:val="32"/><w:sz-cs w:val="32"/></w:rPr><w:t>' + nameText + '</w:t></w:r></w:p></w:tc>';
            rowXml += '<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:tcBorders><w:tl2br w:val="nil"/><w:tr2bl w:val="nil"/></w:tcBorders><w:shd w:val="clear" w:color="000000" w:fill="FFFFFF"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:line="360" w:line-rule="exact"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="楷体_GB2312" w:h-ansi="楷体_GB2312" w:fareast="楷体_GB2312" w:cs="楷体_GB2312" w:hint="default"/><w:sz w:val="28"/><w:sz-cs w:val="28"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="楷体_GB2312" w:h-ansi="楷体_GB2312" w:fareast="楷体_GB2312" w:cs="楷体_GB2312" w:hint="fareast"/><w:sz w:val="28"/><w:sz-cs w:val="28"/></w:rPr><w:t>' + remarkText + '</w:t></w:r></w:p></w:tc>';
            rowXml += '</w:tr>';
            return rowXml;
        }
         function exportSubItemStatusDoc() {
             if (!subItemStatusContext) { showToast('当前没有分项数据'); return; }
             var rows = subItemStatusContext.rows || [];
             if (!rows.length) { showToast('没有可导出的分项'); return; }
             exportSubItemRowsDoc(rows);
         }

         function exportSubItemRowsDoc(rows) {
             if (!rows || !rows.length) { showToast('没有可导出的分项'); return; }
             var rowsXml = '';
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                var rawText = (r.displayText || '').replace(/[\r\n]+/g, '');
                // strip leading sequence prefix from displayText (e.g. "1." / "（一）") to get clean item content for split
                var stripped = rawText.replace(/^\s*((?:\d+)|(?:[一二三四五六七八九十]+))[\.。、]\s*/, '')
                                       .replace(/^\s*[\(\（]((?:\d+)|(?:[一二三四五六七八九十]+))[\)\）]\s*/, '');
                var split = splitSubItemRemark(stripped);
                rowsXml += buildSubItemRowXml(i + 1, split.name, split.remark);
            }
            var tpl = getSubItemTemplateXml();
            if (!tpl) { showToast('未找到分项状态模板'); return; }
            var title = getWorkLogTitleByTimeRange();
            var rangeShort = formatTimeRangeShort();
            var xml = tpl
                .replace('__TITLE__', escapeXmlForWord(title))
                .replace('__TIMERANGE__', escapeXmlForWord(rangeShort))
                .replace('__ROWS__', rowsXml);
            var blob = new Blob([xml], { type: 'application/msword' });
            var now = new Date();
            var ts = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
            var fileName = (ts + ' ' + title + '（' + rangeShort + '）.docx').replace(/[\\\/:*?"<>|]/g, '_');
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            showToast('已导出文档：' + fileName);
        }

             document.addEventListener('click', function(e) {
                 document.querySelectorAll('.pageViewSubMenu').forEach(function(menu) {
                     if (!menu.contains(e.target)) menu.remove();
                 });
                 document.querySelectorAll('.pageViewEntryStatusSelect, .pageViewSubStatusSelect, .pageViewSubStatusPicker').forEach(function(menu) {
                     if (!menu.contains(e.target)) menu.remove();
                 });
                 if (!e.target.closest('#rowContextMenu')) {
                hideRowContextMenu();
            }
            if (!e.target.closest('#headerContextMenu')) {
                hideHeaderContextMenu();
            }
             if (!e.target.classList.contains('statusSymbol')) {
                 var allDropdowns = document.querySelectorAll('.statusDropdown');
                 for (var i = 0; i < allDropdowns.length; i++) allDropdowns[i].classList.remove('show');
             }
             if (!e.target.closest('.pageViewSubMenu')) {
                 document.querySelectorAll('.pageViewSubMenu').forEach(function(menu) { menu.remove(); });
             }
             if (!e.target.closest('.pageViewEntryStatusSelect')) {
                 if (!e.target.closest('.pageViewSubStatusPicker')) document.querySelectorAll('.pageViewEntryStatusSelect, .pageViewSubStatusSelect, .pageViewSubStatusPicker').forEach(function(select) { select.remove(); });
             }
         });
        
        function showHeaderContextMenu(e) {
            e.preventDefault();
            e.stopPropagation();
            var menu = document.getElementById('headerContextMenu');
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            menu.classList.add('show');
        }
        function showReportBlankContextMenu(e) {
            if (e.target && e.target.closest && (e.target.closest('th') || e.target.closest('tr'))) return;
            showHeaderContextMenu(e);
        }
        
        function hideHeaderContextMenu() {
            var menu = document.getElementById('headerContextMenu');
            menu.classList.remove('show');
        }
        
        function insertRowAtBeginning() {
            hideHeaderContextMenu();
            var targetKey = getDateKeyFor(timeRangeStart.getFullYear(), timeRangeStart.getMonth(), timeRangeStart.getDate());
            if (!reportData[targetKey]) reportData[targetKey] = [];
            
            var defaultDate = (timeRangeStart.getMonth() + 1) + '月' + timeRangeStart.getDate() + '日（周' + weekDays[timeRangeStart.getDay()] + '）';
            var newItem = {
                category: '',
                startTime: defaultDate,
                endTime: defaultDate,
                time: defaultDate,
                content: '',
                remark: '',
                status: 'normal',
                attachments: [],
                _dateKey: targetKey,
                _origIndex: reportData[targetKey].length,
                _pendingInsert: true,
                _insertAfterIndex: -1
            };
            
            reportData[targetKey].push(newItem);
            updateCategoryList();
            
            S.editingRowIndex = reportData[targetKey].length - 1;
            S.editingDateKey = targetKey;
            editingPendingInsert = true;
            editingInsertAfterIndex = -1;
            
            document.getElementById('editCategory').value = '';
            document.getElementById('editStartTime').value = defaultDate;
            document.getElementById('editEndTime').value = defaultDate;
            document.getElementById('editContent').value = '';
            document.getElementById('editRemark').value = '';
            document.getElementById('editStatus').value = 'normal';
            
            S.currentAttachments = [];
            renderAttachmentList();
            _resetAttachInputs();
            _setupEditWeekLink('');
            
            initCategoryInput();
            applyEditModalFontSize(editModalFontSize);
            _updateEditWeekNav();
            closeWeekPopups();
            document.getElementById('editModal').classList.add('show');
        }
        
        document.getElementById('ctxHeaderAddRow').addEventListener('click', insertRowAtBeginning);
        
        renderCalendar();
        var _purgedCount = purgeExpiredReminders();
        renderReminders(true);
        if (_purgedCount > 0) { try { showToast('已自动清除 ' + _purgedCount + ' 条过期备忘'); } catch (e) {} }
        renderNotes();
        _applyReminderFullscreen(_reminderFullscreen);
        if (_reminderTab === 'note') { switchReminderTab('note'); }
        initTimeRange();
        S.currentTrackMode = 'page';
        var initialPageBtn = document.getElementById('pageBtn');
        var initialReportBtn = document.getElementById('reportBtn');
        var initialTrackBtn = document.getElementById('trackBtn');
        if (initialPageBtn) initialPageBtn.style.opacity = '1';
        if (initialReportBtn) initialReportBtn.style.opacity = '0.35';
        if (initialTrackBtn) initialTrackBtn.style.opacity = '0.35';
        // 顶部显示应与时间范围选择器一致（周工作显示周区间），不要用选中单日覆盖
        updateTimeRangeDisplay();
        updateCategoryList();
        renderTrackContent();
        initCopyButton();
        setTimeout(function() { updateNotepadTabStyle(); }, 50);
        setTimeout(function() { try { tryRestoreDocDirHandle(); } catch(e) {} }, 600);
        setTimeout(async function() {
            try {
                console.log('[work-log] IndexedDB恢复流程开始');
                var root = await tryRestoreNotebookRoot();
                console.log('[work-log] tryRestoreNotebookRoot 返回:', !!root);
                if (root) {
                    await autoResolveDirsFromRoot();
                    console.log('[work-log] autoResolveDirsFromRoot 完成, workLogDirHandle:', !!workLogDirHandle);
                }
                // 如果没有通过根目录自动解析出工作日志文件夹，尝试从 IndexedDB 恢复
                if (!workLogDirHandle) {
                    console.log('[work-log] workLogDirHandle 为空，尝试从 IndexedDB 恢复');
                    try {
                        var savedDirHandle = await idbGet('workLogDirHandle');
                        if (!savedDirHandle) { try { savedDirHandle = await idbGet('saveDataDirHandle'); } catch(e) {} }
                        console.log('[work-log] idbGet 数据文件夹句柄:', !!savedDirHandle);
                        if (savedDirHandle) {
                            // 启动时没有用户手势：queryPermission 可能是 granted（同会话/已持久授权），
                            // 也可能需要手势。这里只做静默判断，不在无手势时强调 requestPermission。
                            var permState = 'prompt';
                            try {
                                if (savedDirHandle.queryPermission) {
                                    permState = await savedDirHandle.queryPermission({ mode: 'readwrite' });
                                } else { permState = 'granted'; }
                            } catch(e) { permState = 'prompt'; }
                            console.log('[work-log] 数据文件夹权限状态:', permState);
                            if (permState === 'granted') {
                                await _adoptDataDir(savedDirHandle);
                                console.log('[work-log] 已自动恢复数据文件夹:', savedDirHandle.name);
                            } else {
                                // 需要一次用户手势：记住句柄与名字，用户下次打开「数据文件」时在点击手势内直接恢复
                                _pendingRestoreDirHandle = savedDirHandle;
                                scanFolderName = savedDirHandle.name || '';
                                try { DataLayer.setRaw('dataDirName', scanFolderName); } catch(e) {}
                                console.log('[work-log] 数据文件夹需重新授权，已准备一键恢复入口');
                            }
                        }
                    } catch(e) { console.error('[work-log] IndexedDB恢复失败:', e); }
                }
                // 已授权的情况 _adoptDataDir 内部已完成扫描与加载，这里不再重复
                if (!workLogDirHandle) {
                    // 没有恢复文件夹：localStorage 有数据就不弹窗，等用户手动打开选择窗（会显示一键恢复条）
                    var hasExistingData = S.reportData && Object.keys(S.reportData).length > 0;
                    if (!hasExistingData) {
                        showFileSelectorModalAndScan();
                    }
                    if (!root && !hasExistingData) {
                        showToast('请选择记事本根目录');
                        var picked = await pickNotebookRoot();
                        if (picked) {
                            await autoResolveDirsFromRoot();
                            showFileSelectorModalAndScan();
                        }
                    }
                }
            } catch(e) {}
        }, 300);
        
        var savedFontSize = DataLayer.getRaw('notepadFontSize');
        if (savedFontSize) document.getElementById('notepadTextarea').style.fontSize = savedFontSize + 'px';
        
        var _fileSelectorFirstOpen = true;
        try { _loadFileSpanCache(); } catch (e) {}
        function onFirstFolderBtnClick() {
            _fileSelectorFirstOpen = false;
            document.getElementById('firstFolderBtn').style.display = 'none';
            scanWorkLogFiles();
        }
        function updateLastLoadedFile(fileName) {
            DataLayer.setRaw('lastLoadedFile', fileName);
            var el = document.getElementById('footerDataFileName');
            if (el) el.textContent = fileName ? '当前数据：' + fileName : '';
        }
        // Deferred call: store.js may have saved a pending file name before this function existed
        if (typeof currentDataFileName === 'string' && currentDataFileName) { updateLastLoadedFile(currentDataFileName); }

        function toggleFloatingSearch() {
            var input = document.getElementById('searchInput');
            var btn = document.getElementById('searchToggleBtn');
            if (!input || !btn) return;
            var visible = input.style.display !== 'none';
            if (visible) {
                input.style.display = 'none';
                input.value = '';
                S.searchKeyword = '';
                renderTrackContent();
            } else {
                input.style.display = 'block';
                positionFloatingSearch();
                setTimeout(function() { input.focus(); }, 0);
            }
        }
        function positionFloatingSearch() {
            var input = document.getElementById('searchInput');
            var btn = document.getElementById('searchToggleBtn');
            if (!input || !btn) return;
            var rect = btn.getBoundingClientRect();
            var w = 360;
            var inputH = input.offsetHeight || 32;
            var top = Math.round(rect.top + rect.height / 2 - inputH / 2);
            var left = Math.round(rect.left - 5 - w);
            if (left < 10) {
                w = Math.max(120, rect.left - 5 - 10);
                left = 10;
            }
            input.style.top = top + 'px';
            input.style.left = left + 'px';
            input.style.right = 'auto';
            input.style.width = w + 'px';
        }
        window.addEventListener('resize', function() {
            var input = document.getElementById('searchInput');
            if (input && input.style.display !== 'none') positionFloatingSearch();
            updateNotepadSearchWidth();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                var input = document.getElementById('searchInput');
                if (input && input.style.display !== 'none') {
                    toggleFloatingSearch();
                }
            }
        });

// ---- Window exports for HTML inline handlers ----
    window.updateTrackDate = updateTrackDate;
    window.renderTrackContent = renderTrackContent;
    window.initTimeRange = initTimeRange;
    window.changeTimeRangeType = changeTimeRangeType;
    window.selectDayView = selectDayView;
    window.prevTimeRange = prevTimeRange;
    window.nextTimeRange = nextTimeRange;
    window.updateTimeRangeDisplay = updateTimeRangeDisplay;
    window.getDateKeysForRange = getDateKeysForRange;
    window._yearFromKey = _yearFromKey;
    window.isItemInTimeRange = isItemInTimeRange;
    window.dateRangeContains = dateRangeContains;
    window.parseTimeStrToDate = parseTimeStrToDate;
    window.updateCategoryList = updateCategoryList;
    window.sortData = sortData;
    window.searchTable = searchTable;
    window.getSearchKeywordList = getSearchKeywordList;
    window.rowMatchesSearch = rowMatchesSearch;
    window.highlightText = highlightText;
    window.onWorkLogImportClick = onWorkLogImportClick;
    window._stripJsCommentsSafe = _stripJsCommentsSafe;
    window.csvUnescapeSaveAsText = csvUnescapeSaveAsText;
    window.onWorkLogImportFile = onWorkLogImportFile;
    window.onWorkLogExportToggle = onWorkLogExportToggle;
    window.cancelWorkLogExport = cancelWorkLogExport;
    window.onWorkLogToggleAll = onWorkLogToggleAll;
    window.formatTimeRangeLabel = formatTimeRangeLabel;
    window.confirmWorkLogExport = confirmWorkLogExport;
    window.getWorkLogTemplateXml = getWorkLogTemplateXml;
    window.getWorkLogTitleByTimeRange = getWorkLogTitleByTimeRange;
    window.formatTimeRangeShort = formatTimeRangeShort;
    window.escapeXmlForWord = escapeXmlForWord;
    window.buildWorkLogRowXml = buildWorkLogRowXml;
    window.confirmWorkLogExportDoc = confirmWorkLogExportDoc;
    window.formatLogTimeDisplay = formatLogTimeDisplay;
    window.isWeekWorkItem = isWeekWorkItem;
    window.formatLogTimePageDisplay = formatLogTimePageDisplay;
    window.formatLogTimePageStartDisplay = formatLogTimePageStartDisplay;
    window.formatLogTimePageEntryDisplay = formatLogTimePageEntryDisplay;
    window.pageViewStatusClass = pageViewStatusClass;
    window.pageViewEntryStatusClass = pageViewEntryStatusClass;
    window.pageViewEntryStatusSymbol = pageViewEntryStatusSymbol;
    window.pageViewWeekDateStart = pageViewWeekDateStart;
    window.pageViewWeekNavHtml = pageViewWeekNavHtml;
    window.pageViewWeekButtonClick = pageViewWeekButtonClick;
    window.pageViewFilterDate = pageViewFilterDate;
    window.pageViewSubItemDateRange = pageViewSubItemDateRange;
    window.pageViewSubItemDate = pageViewSubItemDate;
    window.pageViewFilterItemByDate = pageViewFilterItemByDate;
    window.getEffectiveWorkEndDate = getEffectiveWorkEndDate;
    window.pageViewEditSubItem = pageViewEditSubItem;
    window.pageViewSortDatedSubItems = pageViewSortDatedSubItems;
    window.normalizePageViewSubItemName = normalizePageViewSubItemName;
    window._replaceSubItemSequence = _replaceSubItemSequence;
    window._weekWorkNowId = _weekWorkNowId;
    window._migrateItemSubItemIds = _migrateItemSubItemIds;
    window._migrateAllSubItemIds = _migrateAllSubItemIds;
    window._syncSubItemIds = _syncSubItemIds;
    window._subItemIdAt = _subItemIdAt;
    window._findLogsBySubItemId = _findLogsBySubItemId;
    window._usedSubItemIdsInItem = _usedSubItemIdsInItem;
    window._collectWeekLinkOptions = _collectWeekLinkOptions;
    window.pageViewAddSubItemToLog = pageViewAddSubItemToLog;
    window._setupEditWeekLink = _setupEditWeekLink;
    window._findWeekSubItemInfo = _findWeekSubItemInfo;
    window._findWeekSubItemLabel = _findWeekSubItemLabel;
    window._findWeekSubItemName = _findWeekSubItemName;
    window.onWeekLinkSelectChange = onWeekLinkSelectChange;
    window.pageViewAddSubItem = pageViewAddSubItem;
    window.pageViewAdjustSubItemWeek = pageViewAdjustSubItemWeek;
    window.movePageViewSubItemToNextWeek = movePageViewSubItemToNextWeek;
    window.updatePageViewWeekNavHighlight = updatePageViewWeekNavHighlight;
    window.clearPageViewWeekNavHighlight = clearPageViewWeekNavHighlight;
    window.showPageViewEntryStatusMenu = showPageViewEntryStatusMenu;
    window.pageViewSubItemHtml = pageViewSubItemHtml;
    window.pageViewSubItemClick = pageViewSubItemClick;
    window.pageViewSubItemDblClick = pageViewSubItemDblClick;
    window.pageViewSubDragStart = pageViewSubDragStart;
    window.pageViewSubDragOver = pageViewSubDragOver;
    window.pageViewSubDragLeave = pageViewSubDragLeave;
    window.pageViewSubDragEnd = pageViewSubDragEnd;
    window.pageViewSubDrop = pageViewSubDrop;
    window.pageViewShowSubMenu = pageViewShowSubMenu;
    window.pageViewDeleteSubItem = pageViewDeleteSubItem;
    window.showPageViewSubStatusMenu = showPageViewSubStatusMenu;
    window.renderReportTable = renderReportTable;
    window.toggleStatusDropdown = toggleStatusDropdown;
    window.changeStatus = changeStatus;
    window.getStatusSymbol = getStatusSymbol;
    window.initColumnResize = initColumnResize;
    window.initRowDrag = initRowDrag;
    window.addReportRow = addReportRow;
    window.toolbarAddEntry = toolbarAddEntry;
    window.addEntryForDate = addEntryForDate;
    window.openEditModalByData = openEditModalByData;
    window.openEditModalByKey = openEditModalByKey;
    window.closeEditModal = closeEditModal;
    window.initCategoryInput = initCategoryInput;
    window.showCategoryDropdown = showCategoryDropdown;
    window.filterCategoryDropdown = filterCategoryDropdown;
    window.hideCategoryDropdownDelay = hideCategoryDropdownDelay;
    window.saveEditModal = saveEditModal;
    window._syncStagedForSavedItem = _syncStagedForSavedItem;
    window._updateEditWeekNav = _updateEditWeekNav;
    window._getWeekDateStr = _getWeekDateStr;
    window._findWeekWorkRecord = _findWeekWorkRecord;
    window._positionWeekPopup = _positionWeekPopup;
    window._currentEditWeekBase = _currentEditWeekBase;
    window.showWeekWorkPopup = showWeekWorkPopup;
    window.closeWeekPopup = closeWeekPopup;
    window.closeWeekPopups = closeWeekPopups;
    window.toggleWeekWorkPopup = toggleWeekWorkPopup;
    window.toggleEndTimeAuto = toggleEndTimeAuto;
    window._parseModalDateStr = _parseModalDateStr;
    window._formatTodayModalDateStr = _formatTodayModalDateStr;
    window.handleEditStatusChange = handleEditStatusChange;
    window.openDatePicker = openDatePicker;
    window.openDatePickerForCustom = openDatePickerForCustom;
    window.closeDatePicker = closeDatePicker;
    window.datePickerChangeMonth = datePickerChangeMonth;
    window.renderDatePicker = renderDatePicker;
    window.selectDatePickerDate = selectDatePickerDate;
    window.getMonday = getMonday;
    window.getSunday = getSunday;
    window.fmtDate = fmtDate;
    window.parseCustomDateStr = parseCustomDateStr;
    window.updateCustomDateDayCount = updateCustomDateDayCount;
    window.openCustomDateFromDisplay = openCustomDateFromDisplay;
    window.setCustomDatePreset = setCustomDatePreset;
    window.closeCustomDateModal = closeCustomDateModal;
    window.confirmCustomDate = confirmCustomDate;
        window.handleAttachAction = handleAttachAction;
        window.attachPick = attachPick;
        window.openAttachmentFromEl = openAttachmentFromEl;
    window._resetAttachInputs = _resetAttachInputs;
    window._onAttachPathInput = _onAttachPathInput;
    window.editAttachment = editAttachment;
    window.extractNameFromPath = extractNameFromPath;
    window.isFolderPath = isFolderPath;
    window.renderAttachmentList = renderAttachmentList;
    window.removeAttachment = removeAttachment;
    window.showAttachDetail = showAttachDetail;
    window.closeAttachDetail = closeAttachDetail;
    window.getFileExtension = getFileExtension;
    window.getAttachIconHtml = getAttachIconHtml;
    window.openAttachment = openAttachment;
    window.showContextMenu = showContextMenu;
    window.hideContextMenu = hideContextMenu;
    window.deleteReportRow = deleteReportRow;
    window.renderMultiTrack = renderMultiTrack;
    window.renderMultiTrackTimeline = renderMultiTrackTimeline;
    window._weekLogMatchesCurrentRange = _weekLogMatchesCurrentRange;
    window._collectUnlinkedWeekLogs = _collectUnlinkedWeekLogs;
    window.renderWeekLogDetailPanel = renderWeekLogDetailPanel;
    window.showWeekSubItemLogDetail = showWeekSubItemLogDetail;
    window.showWeekUnlinkedLogsDetail = showWeekUnlinkedLogsDetail;
    window.closeWeekLogDetailPanel = closeWeekLogDetailPanel;
    window.initWeekLogDetailResize = initWeekLogDetailResize;
    window.buildPageViewEntryHtml = buildPageViewEntryHtml;
    window.renderPageView = renderPageView;
    window.copyAttachPath = copyAttachPath;
    window.getTrackFilterCategories = getTrackFilterCategories;
    window.buildTrackFilterBody = buildTrackFilterBody;
    window.showTrackFilterModal = showTrackFilterModal;
    window.closeTrackFilterModal = closeTrackFilterModal;
    window.confirmTrackFilter = confirmTrackFilter;
    window.addYellowTooltip = addYellowTooltip;
    window.autoRenumberEditContent = autoRenumberEditContent;
    window.showTimelineTooltipYellow = showTimelineTooltipYellow;
    window.initEventDrag = initEventDrag;
    window.onEventDrag = onEventDrag;
    window.onEventDragEnd = onEventDragEnd;
    window.hideTimelineTooltip = hideTimelineTooltip;
    window.openTimelineEventEditModal = openTimelineEventEditModal;
    window.showEventDetailModal = showEventDetailModal;
    window.showFileSelectorModal = showFileSelectorModal;
    window.showFileSelectorModalAndScan = showFileSelectorModalAndScan;
    window.closeFileSelectorModal = closeFileSelectorModal;
    window.scanWorkLogFiles = scanWorkLogFiles;
    window.changeWorkLogFolder = changeWorkLogFolder;
    window.populateFileList = populateFileList;
    window.renderFileRow = renderFileRow;
    window.confirmFileSelect = confirmFileSelect;
    window.getWorkLogPath = getWorkLogPath;
    window.loadRemoteDataFile = loadRemoteDataFile;
    window.loadDataContent = loadDataContent;
    window._buildLogDemoTemplateData = _buildLogDemoTemplateData;
    window.applyLoadedData = applyLoadedData;
    window.openData = openData;
    window.loadBuiltinTemplate = loadBuiltinTemplate;
    window.loadDataFile = loadDataFile;
    window.saveData = saveData;
    window.previewExternalFile = previewExternalFile;
    window.closePreviewModal = closePreviewModal;
    window.isKylinOS = isKylinOS;
    window.applySaveDataModalKylinUI = applySaveDataModalKylinUI;
    window.toggleSaveDropdown = toggleSaveDropdown;
    window.closeSaveDropdown = closeSaveDropdown;
    window.saveDataAsLogJs = saveDataAsLogJs;
    window.kylinFallbackDownloadForLogJs = kylinFallbackDownloadForLogJs;
    window.saveAllToCache = saveAllToCache;
    window.saveAllToCacheSilent = saveAllToCacheSilent;
    window.showSaveDataModal = showSaveDataModal;
    window.populateSaveDataList = populateSaveDataList;
    window.closeSaveDataModal = closeSaveDataModal;
    window.confirmSaveDataAsNew = confirmSaveDataAsNew;
    window.kylinFallbackDownload = kylinFallbackDownload;
    window.updateNotepadFileLabel = updateNotepadFileLabel;
    window.saveNotepadCurrentFile = saveNotepadCurrentFile;
    window.changeNotepadOpenRootFolder = changeNotepadOpenRootFolder;
    window.showNotepadOpenModal = showNotepadOpenModal;
    window.selectNotepadRootDir = selectNotepadRootDir;
    window.populateNotepadSubfolderSelects = populateNotepadSubfolderSelects;
    window.closeNotepadOpenModal = closeNotepadOpenModal;
    window.onNotepadImportFolderSelected = onNotepadImportFolderSelected;
    window.changeNotepadFolder = changeNotepadFolder;
    window.parseNotepadJsData = parseNotepadJsData;
    window._isMultiPageJsData = _isMultiPageJsData;
    window._applyNotepadJsData = _applyNotepadJsData;
    window.showNotepadJsConfirmDialog = showNotepadJsConfirmDialog;
    window.extractEditorHtmlFromContent = extractEditorHtmlFromContent;
    window._notepadLatin1ToString = _notepadLatin1ToString;
    window._notepadReadFileAsSmartText = _notepadReadFileAsSmartText;
    window._notepadCleanHtmlForEditor = _notepadCleanHtmlForEditor;
    window.changeNotepadOpenFolder = changeNotepadOpenFolder;
    window._notepadSaveTitle = _notepadSaveTitle;
    window._notepadExportTimestamp = _notepadExportTimestamp;
    window.toggleNotepadSaveDropdown = toggleNotepadSaveDropdown;
    window.closeNotepadSaveDropdown = closeNotepadSaveDropdown;
    window.toggleNotepadSaveJsMenu = toggleNotepadSaveJsMenu;
    window.toggleNotepadExportHtmlMenu = toggleNotepadExportHtmlMenu;
    window.toggleNotepadExportDocxMenu = toggleNotepadExportDocxMenu;
    window.confirmNotepadExportJsCurrent = confirmNotepadExportJsCurrent;
    window.confirmNotepadExportJsAll = confirmNotepadExportJsAll;
    window.confirmNotepadExportHtml = confirmNotepadExportHtml;
    window.confirmNotepadExportHtmlSplit = confirmNotepadExportHtmlSplit;
    window.confirmNotepadExportDocxCurrent = confirmNotepadExportDocxCurrent;
    window.confirmNotepadExportDocxAll = confirmNotepadExportDocxAll;
    window.saveNotepadToCache = saveNotepadToCache;
    window.buildNotepadHtmlContentFromHtml = buildNotepadHtmlContentFromHtml;
    window._notepadNormalizeExportTitleFonts = _notepadNormalizeExportTitleFonts;
    window._notepadCurrentWindowHtml = _notepadCurrentWindowHtml;
    window._notepadCurrentWindowJsData = _notepadCurrentWindowJsData;
    window._notepadAllWindowsJsData = _notepadAllWindowsJsData;
    window._notepadCurrentArticleHtml = _notepadCurrentArticleHtml;
    window._notepadCollectArticlesForHtml = _notepadCollectArticlesForHtml;
    window._notepadShowArticleExportDialog = _notepadShowArticleExportDialog;
    window._notepadExportArticlesAsDocx = _notepadExportArticlesAsDocx;
    window.closeNotepadSaveModal = closeNotepadSaveModal;
    window.onNotepadOpenSelectOtherFile = onNotepadOpenSelectOtherFile;
    window.onNotepadOpenFileSelected = onNotepadOpenFileSelected;
    window.refreshFileList = refreshFileList;
    window._extensionScreenPayload = _extensionScreenPayload;
    window._sendExtensionScreenContent = _sendExtensionScreenContent;
    window.openExtensionScreen = openExtensionScreen;
    window.showPageViewEntryContextMenu = showPageViewEntryContextMenu;
    window.showRowContextMenu = showRowContextMenu;
    window.hideRowContextMenu = hideRowContextMenu;
    window.getFilteredData = getFilteredData;
    window.showViewDetailModal = showViewDetailModal;
    window.getStatusText = getStatusText;
    window.addRowAfter = addRowAfter;
    window.deleteCurrentRow = deleteCurrentRow;
    window.duplicateCurrentRow = duplicateCurrentRow;
    window.exportPageViewEntrySubItems = exportPageViewEntrySubItems;
    window._normalizeSubItemNameForLogMatch = _normalizeSubItemNameForLogMatch;
    window.statusToClass = statusToClass;
    window.parseSubItemContent = parseSubItemContent;
    window._migrateItemSubTimestamps = _migrateItemSubTimestamps;
    window._migrateAllSubTimestamps = _migrateAllSubTimestamps;
    window._formatTimestampStr = _formatTimestampStr;
    window._nowTimestampStr = _nowTimestampStr;
    window._shouldAutoFinishFromSubItems = _shouldAutoFinishFromSubItems;
    window._finishParentItemFromSubItems = _finishParentItemFromSubItems;
    window._parseTimestampStr = _parseTimestampStr;
    window.buildSubStatusBody = buildSubStatusBody;
    window.clearSubStatusDragOver = clearSubStatusDragOver;
    window.showSubStatusItemMenu = showSubStatusItemMenu;
    window.hideSubStatusItemMenu = hideSubStatusItemMenu;
    window.stripSubItemPrefix = stripSubItemPrefix;
    window.handleSubStatusItemAction = handleSubStatusItemAction;
    window.addSubItemToLog = addSubItemToLog;
    window.renumberSubStatusRows = renumberSubStatusRows;
    window.showSubItemStatusModal = showSubItemStatusModal;
    window.closeSubItemStatusModal = closeSubItemStatusModal;
    window.setSubItemWeekMode = setSubItemWeekMode;
    window.applySubItemWeekAction = applySubItemWeekAction;
    window.adjustSubItemToWeek = adjustSubItemToWeek;
    window.renumberMovedSubItems = renumberMovedSubItems;
    window._pad2 = _pad2;
    window._dateToInput = _dateToInput;
    window._timeToInput = _timeToInput;
    window.openSubItemTsEditor = openSubItemTsEditor;
    window.closeSubItemTsEditor = closeSubItemTsEditor;
    window.confirmSubItemTsEditor = confirmSubItemTsEditor;
    window._loadTsQuickTimes = _loadTsQuickTimes;
    window._saveTsQuickTime = _saveTsQuickTime;
    window._tsSetActive = _tsSetActive;
    window._tsQuickTime = _tsQuickTime;
    window._tsOnTimeInput = _tsOnTimeInput;
    window._tsDateNextStr = _tsDateNextStr;
    window._tsQuickDate = _tsQuickDate;
    window.sortSubItemStatus = sortSubItemStatus;
    window.confirmSubItemStatus = confirmSubItemStatus;
    window.getSubItemTemplateXml = getSubItemTemplateXml;
    window.splitSubItemRemark = splitSubItemRemark;
    window.buildSubItemRowXml = buildSubItemRowXml;
    window.exportSubItemStatusDoc = exportSubItemStatusDoc;
    window.exportSubItemRowsDoc = exportSubItemRowsDoc;
    window.showHeaderContextMenu = showHeaderContextMenu;
    window.showReportBlankContextMenu = showReportBlankContextMenu;
    window.hideHeaderContextMenu = hideHeaderContextMenu;
    window.insertRowAtBeginning = insertRowAtBeginning;
    window.onFirstFolderBtnClick = onFirstFolderBtnClick;
    window.updateLastLoadedFile = updateLastLoadedFile;
    window.toggleFloatingSearch = toggleFloatingSearch;
    window.positionFloatingSearch = positionFloatingSearch;
