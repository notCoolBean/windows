/* ============================================================
   reminder.js — 提醒/备忘管理
   ============================================================ */

        function highlightReminderText(text, keyword) {
            if (!keyword || !text) return escapeHtml(text);
            var t = escapeHtml(text);
            var k = escapeHtml(keyword);
            var idx = t.toLowerCase().indexOf(k.toLowerCase());
            if (idx === -1) return t;
            var re = new RegExp('(' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            return t.replace(re, '<span class="reminderHighlight">$1</span>');
        }
        function renderReminders(doScroll) {
            var reminderList = document.getElementById('reminderList');
            var selectedKey = getDateKey();
            var kw = (document.getElementById('reminderSearchInput').value || '').trim().toLowerCase();
            
            var filtered = reminders.slice();
            if (kw) {
                filtered = filtered.filter(function(r) {
                    return (r.title || '').toLowerCase().indexOf(kw) !== -1 || (r.note || '').toLowerCase().indexOf(kw) !== -1;
                });
            }
            filtered.sort(function(a, b) { return (a.date || '') < (b.date || '') ? 1 : (a.date || '') > (b.date || '') ? -1 : 0; });
            
            if (filtered.length === 0) {
                reminderList.innerHTML = '<div class="emptyState"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg><p>暂无备忘</p></div>';
                return;
            }
            
            var html = '';
            for (var i = 0; i < filtered.length; i++) {
                var reminder = filtered[i];
                var isSelected = reminder.date === selectedKey;
                var dateText = escapeHtml(reminder.date || '');
                var titleHtml = highlightReminderText(reminder.title || '', kw);
                var noteHtml = highlightReminderText(reminder.note || '', kw);
                html += '<div class="reminderItem' + (isSelected ? ' selected' : '') + '" data-id="' + reminder.id + '">';
                html += '<div class="reminderDate">' + dateText + '</div>';
                html += '<div class="reminderContent" data-raw="' + escapeHtml(reminder.title || '') + '">' + titleHtml + '</div>';
                html += '<div class="reminderNote" data-raw="' + escapeHtml(reminder.note || '') + '">' + noteHtml + '</div>';
                html += '</div>';
            }
            reminderList.innerHTML = html;
            
            if (doScroll && !kw) {
                var scrollId = null;
                for (var si = 0; si < filtered.length; si++) { if (filtered[si].date === selectedKey) { scrollId = filtered[si].id; break; } }
                if (!scrollId) { for (var si = 0; si < filtered.length; si++) { if (filtered[si].date > selectedKey) { scrollId = filtered[si].id; break; } } }
                if (scrollId) { var stEl = reminderList.querySelector('[data-id="' + scrollId + '"]'); if (stEl) stEl.scrollIntoView({ block: 'start' }); }
            }
            
            if (kw) {
                var items = reminderList.querySelectorAll('.reminderItem');
                for (var ii = 0; ii < items.length; ii++) {
                    var contentEl = items[ii].querySelector('.reminderContent');
                    var noteEl = items[ii].querySelector('.reminderNote');
                    if (contentEl && contentEl.scrollHeight > contentEl.clientHeight) {
                        var rawTitle = (contentEl.getAttribute('data-raw') || '').toLowerCase();
                        if (rawTitle.indexOf(kw) !== -1) {
                            var ep = document.createElement('span');
                            ep.className = 'reminderHighlight reminderEllipsis';
                            ep.textContent = '…';
                            contentEl.appendChild(ep);
                        }
                    }
                    if (noteEl && noteEl.scrollHeight > noteEl.clientHeight) {
                        var rawNote = (noteEl.getAttribute('data-raw') || '').toLowerCase();
                        if (rawNote.indexOf(kw) !== -1) {
                            var epn = document.createElement('span');
                            epn.className = 'reminderHighlight reminderEllipsis';
                            epn.textContent = '…';
                            noteEl.appendChild(epn);
                        }
                    }
                }
            }
        }
        
        function showReminderDetail(id) {
            var r = null;
            for (var ri = 0; ri < reminders.length; ri++) { if (reminders[ri].id === id) { r = reminders[ri]; break; } }
            if (!r) return;
            var modal = document.createElement('div');
            modal.className = 'editModal show';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
            var box = document.createElement('div');
            box.className = 'editModalBox';
            box.style.cssText = 'width:600px;max-width:95vw;';
            var content = '<div class="editModalTitle">备忘详情</div>';
            content += '<div class="editModalRow" style="display:flex;flex-direction:column;gap:0;width:95%;margin:0 auto;">';
            var lb = 'width:60px;flex-shrink:0;color:#555;align-self:center;';
            var vl = 'padding-left:14px;flex:1;';
            content += '<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #cfcfcf;"><label style="' + lb + '">日期：</label><span style="' + vl + '">' + escapeHtml(r.date || '') + '</span></div>';
            content += '<div style="display:flex;align-items:flex-start;gap:14px;padding:12px 0;border-bottom:1px solid #cfcfcf;"><label style="' + lb + '">内容：</label><span style="white-space:pre-wrap;' + vl + '">' + escapeHtml(r.title || '') + '</span></div>';
            content += '<div style="display:flex;align-items:flex-start;gap:14px;padding:12px 0;"><label style="' + lb + '">备注：</label><span style="white-space:pre-wrap;' + vl + '">' + escapeHtml(r.note || '') + '</span></div>';
            content += '</div>';
            content += '<div class="editModalBtns"><button class="editModalBtn cancel" onclick="this.closest(\'.editModal\').remove()">关闭</button></div>';
            box.innerHTML = content;
            modal.appendChild(box);
            document.body.appendChild(modal);
            modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
        }
        function toggleReminderFullscreen() {
            _applyReminderFullscreen(!_reminderFullscreen);
        }
        function showReminderEdit(id) {
            var r = null;
            for (var ri = 0; ri < reminders.length; ri++) { if (reminders[ri].id === id) { r = reminders[ri]; break; } }
            if (!r) return;
            document.getElementById('reminderDateInput').value = r.date || '';
            document.getElementById('reminderTitleInput').value = r.title || '';
            document.getElementById('reminderNoteInput').value = r.note || '';
            _setExpireModeUI(r.expireMode || '');
            var modal = document.getElementById('addReminderModal');
            modal.classList.add('show');
            modal._editId = id;
            modal._addDate = r.date;
            var titleEl = modal.querySelector('.modalTitle');
            if (titleEl) titleEl.textContent = '编辑备忘';
            document.getElementById('saveReminderBtn').textContent = '保存';
            document.getElementById('saveReminderBtn').style.background = '#c0392b';
            document.getElementById('saveReminderBtn').style.borderColor = '#c0392b';
            document.getElementById('addReminderBtn').style.display = '';
            document.getElementById('deleteReminderBtn').style.display = '';
            document.getElementById('deleteReminderBtn').onclick = function() {
                if (!confirm('确定删除该备忘？')) return;
                S.reminders = S.reminders.filter(function(x) { return x.id !== id; });
                DataLayer.set('reminders', S.reminders)
                hideAddReminderModal();
                renderReminders();
                renderCalendar();
                showToast('已删除');
            };
            document.getElementById('addReminderBtn').onclick = function() {
                showAddReminderModal(r.date);
            };
        }
        function showAddReminderModal(dateKey) {
            var modal = document.getElementById('addReminderModal');
            modal.classList.add('show');
            delete modal._editId;
            modal._addDate = dateKey;
            document.getElementById('reminderDateInput').value = dateKey || getDateKey();
            document.getElementById('reminderTitleInput').value = '';
            document.getElementById('reminderNoteInput').value = '';
            _setExpireModeUI('');
            var titleEl = modal.querySelector('.modalTitle');
            if (titleEl) titleEl.textContent = '新增备忘';
            document.getElementById('saveReminderBtn').textContent = '保存';
            document.getElementById('saveReminderBtn').style.background = '#27ae60';
            document.getElementById('saveReminderBtn').style.borderColor = '#27ae60';
            document.getElementById('addReminderBtn').style.display = 'none';
            document.getElementById('deleteReminderBtn').style.display = 'none';
        }
        
        function hideAddReminderModal() {
            document.getElementById('addReminderModal').classList.remove('show');
        }
        
        function toggleReminderExpire() {
            var chk = document.getElementById('reminderExpireCheck');
            var sel = document.getElementById('reminderExpireSelect');
            sel.style.display = chk.checked ? '' : 'none';
            if (chk.checked && !sel.value) sel.value = 'nextDay';
        }
        function _readExpireMode() {
            var chk = document.getElementById('reminderExpireCheck');
            if (!chk || !chk.checked) return '';
            var sel = document.getElementById('reminderExpireSelect');
            return sel ? (sel.value || 'nextDay') : 'nextDay';
        }
        function _setExpireModeUI(mode) {
            var chk = document.getElementById('reminderExpireCheck');
            var sel = document.getElementById('reminderExpireSelect');
            if (!chk || !sel) return;
            if (mode) { chk.checked = true; sel.value = mode; sel.style.display = ''; }
            else { chk.checked = false; sel.value = 'nextDay'; sel.style.display = 'none'; }
        }
        function _isReminderExpired(r) {
            if (!r.expireMode || !r.date) return false;
            var m = r.date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (!m) return false;
            var rd = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
            if (isNaN(rd.getTime())) return false;
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var expireDate = new Date(rd);
            if (r.expireMode === 'nextDay') expireDate.setDate(rd.getDate() + 1);
            else if (r.expireMode === 'week') expireDate.setDate(rd.getDate() + 7);
            else if (r.expireMode === 'month') expireDate.setMonth(rd.getMonth() + 1);
            return today >= expireDate;
        }
        function purgeExpiredReminders() {
            var before = reminders.length;
            var kept = [];
            var removed = 0;
            for (var i = 0; i < reminders.length; i++) {
                if (_isReminderExpired(reminders[i])) { removed++; }
                else { kept.push(reminders[i]); }
            }
            if (removed > 0) {
                S.reminders = kept;
                try { DataLayer.set('reminders', S.reminders) } catch (e) {}
            }
            return removed;
        }
        
        function saveReminderFromModal() {
            var title = document.getElementById('reminderTitleInput').value;
            var date = document.getElementById('reminderDateInput').value;
            var note = document.getElementById('reminderNoteInput').value;
            var expireMode = _readExpireMode();
            var modal = document.getElementById('addReminderModal');
            
            if (!title || !date) {
                showToast('请填写内容和日期');
                return;
            }
            
            if (modal._editId) {
                for (var ri = 0; ri < reminders.length; ri++) {
                    if (reminders[ri].id === modal._editId) {
                        reminders[ri].title = title;
                        reminders[ri].date = date;
                        reminders[ri].note = note;
                        reminders[ri].expireMode = expireMode;
                        break;
                    }
                }
                delete modal._editId;
                DataLayer.set('reminders', reminders)
                hideAddReminderModal();
                renderReminders();
                renderCalendar();
                showToast('保存成功');
            } else {
                reminders.push({
                    id: Date.now(),
                    title: title,
                    date: date,
                    time: '',
                    note: note,
                    notified: false,
                    expireMode: expireMode
                });
                DataLayer.set('reminders', reminders)
                document.getElementById('reminderTitleInput').value = '';
                document.getElementById('reminderNoteInput').value = '';
                renderReminders();
                renderCalendar();
                showToast('已添加，可继续新增');
            }
        }
        
        function deleteReminder(id) {
            S.reminders = S.reminders.filter(function(r) { return r.id !== id; });
            DataLayer.set('reminders', S.reminders)
            renderReminders();
            renderCalendar();
            showToast('已删除');
        }

        var _rTab = DataLayer.getRaw('reminderTab') || 'list';
        var _rFullscreen = DataLayer.getRaw('reminderFullscreen') === '1';
        function _saveReminderTab() { try { DataLayer.setRaw('reminderTab', _rTab); } catch (e) {} }
        function _saveReminderFullscreen() { try { DataLayer.setRaw('reminderFullscreen', _rFullscreen ? '1' : '0'); } catch (e) {} }
        function _applyReminderFullscreen(on) {
            var cs = document.getElementById('calendarSection');
            var btn = document.getElementById('reminderFullscreenBtn');
            var rs = document.getElementById('reminderSection');
            var main = document.getElementById('mainContent');
            var left = document.getElementById('leftPanel');
            if (!cs || !btn) return;
             if (on) {
                 cs.style.display = 'none';
                 if (rs) rs.classList.add('reminderFullscreen');
                btn.classList.add('active');
                btn.title = '退出全屏';
                if (rs) rs.style.marginTop = '15px';
                if (main && left) left.style.width = Math.max(360, Math.round(main.getBoundingClientRect().width * 0.3)) + 'px';
             } else {
                 cs.style.display = '';
                 if (rs) rs.classList.remove('reminderFullscreen');
                btn.classList.remove('active');
                btn.title = '全屏';
                if (rs) rs.style.marginTop = '';
                if (left) left.style.width = '360px';
                try { DataLayer.remove('mainSplitLeftWidth'); } catch(e) {}
            }
            _reminderFullscreen = on;
            _saveReminderFullscreen();
        }

        function onReminderSearchInput() {
            renderReminders();
        }

// ---- 挂载到 window ----
window.highlightReminderText = highlightReminderText;
window.renderReminders = renderReminders;
window.showReminderDetail = showReminderDetail;
window.showReminderEdit = showReminderEdit;
window.showAddReminderModal = showAddReminderModal;
window.hideAddReminderModal = hideAddReminderModal;
window.saveReminderFromModal = saveReminderFromModal;
window.deleteReminder = deleteReminder;
window.purgeExpiredReminders = purgeExpiredReminders;
window.onReminderSearchInput = onReminderSearchInput;
window.toggleReminderExpire = toggleReminderExpire;
window.toggleReminderFullscreen = toggleReminderFullscreen;
window._applyReminderFullscreen = _applyReminderFullscreen;
Object.defineProperty(window, '_reminderFullscreen', { get: function() { return _rFullscreen; }, set: function(v) { _rFullscreen = v; }, configurable: true, enumerable: true });
Object.defineProperty(window, '_reminderTab', { get: function() { return _rTab; }, set: function(v) { _rTab = v; }, configurable: true, enumerable: true });
