/* ============================================================
   app.js — 应用初始化模块
   包含：用户登录、退出登录、计时器/闹钟、页面缩放
   ============================================================ */

// ---- 登录界面海浪动画：外部模块 data/login-wave.js（依赖 data/p5.min.js），仅在登录页需要时加载 ----
window.notepadWaveEnsure = (function () {
    var overlay = document.getElementById('loginOverlay');
    function inject(src, next, onerror) {
        var s = document.createElement('script');
        s.src = src; s.onload = next;
        s.onerror = onerror || function () {};
        (document.head || document.documentElement).appendChild(s);
    }
    function startModule() {
        if (window.notepadWave) { if (window.notepadWave.start) window.notepadWave.start(); return; }
        inject('data/login-wave.js', function () {
            if (window.notepadWave && window.notepadWave.start) window.notepadWave.start();
        });
    }
    return function () {
        if (!overlay || overlay.classList.contains('hidden')) return;
        if (window.notepadWave) { if (window.notepadWave.start) window.notepadWave.start(); return; }
        if (typeof window.p5 !== 'undefined') { startModule(); return; }
        inject('data/p5.min.js', function () {
            if (typeof window.p5 === 'undefined') return;
            startModule();
        });
    };
})();
window.notepadWaveEnsure();

// ---- 用户登录（原始机制，使用 localStorage）----
(function initLocalLogin() {
    var overlay = document.getElementById('loginOverlay');
    if (location.hash === '#extension-screen') {
        if (overlay) { overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden', 'true'); }
        if (window.notepadWave && window.notepadWave.stop) window.notepadWave.stop();
        return;
    }
    var title = document.getElementById('loginTitle');
    var username = document.getElementById('loginUsername');
    var password = document.getElementById('loginPassword');
    var confirmField = document.getElementById('loginConfirmField');
    var passwordConfirm = document.getElementById('loginPasswordConfirm');
    var remember = document.getElementById('loginRemember');
    var submit = document.getElementById('loginSubmit');
    if (!overlay || !title || !username || !password || !confirmField || !passwordConfirm || !remember || !submit) return;
    var authKey = 'notepadLoginAccount';
    var rememberKey = 'notepadLoginRemember';
    var account = null;
    try { account = JSON.parse(localStorage.getItem(authKey) || 'null'); } catch (e) { account = null; }
    var setupMode = !account || typeof account.username !== 'string' || typeof account.password !== 'string';
    if (setupMode) {
        title.querySelector('span').textContent = '用户登录';
        confirmField.style.display = 'flex';
        password.autocomplete = 'new-password';
    } else {
        username.value = account.username;
        if (localStorage.getItem(rememberKey) === '1') {
            password.value = account.password;
            remember.checked = true;
        }
    }
    function finish() {
        // 先移除焦点，避免 aria-hidden 警告
        if (document.activeElement && overlay.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        if (window.notepadWave && window.notepadWave.stop) window.notepadWave.stop();
    }
    window.notepadLogout = function() {
        password.value = '';
        passwordConfirm.value = '';
        remember.checked = false;
        try { localStorage.setItem(rememberKey, '0'); } catch (e) {}
        username.value = account ? account.username : '';
        title.querySelector('span').textContent = '用户登录';
        confirmField.style.display = 'none';
        overlay.classList.remove('hidden');
        overlay.removeAttribute('aria-hidden');
        if (window.notepadWaveEnsure) { try { window.notepadWaveEnsure(); } catch (e) {} }
        else if (window.notepadWave && window.notepadWave.start) { try { window.notepadWave.start(); } catch (e) {} }
        setTimeout(function() { password.focus(); }, 0);
    };
    function submitLogin() {
        if (setupMode) {
            if (password.value !== passwordConfirm.value) { alert('两次输入的密码不一致'); passwordConfirm.focus(); return; }
            account = { username: username.value, password: password.value };
            try { localStorage.setItem(authKey, JSON.stringify(account)); } catch (e) {}
            try { localStorage.setItem(rememberKey, remember.checked ? '1' : '0'); } catch (e) {}
            finish();
            return;
        }
        if (username.value !== account.username || password.value !== account.password) { alert('用户名或密码错误'); password.focus(); return; }
        try { localStorage.setItem(rememberKey, remember.checked ? '1' : '0'); } catch (e) {}
        finish();
    }
    submit.addEventListener('click', submitLogin);
    [username, password, passwordConfirm].forEach(function(input) { input.addEventListener('keydown', function(e) { if (e.key === 'Enter') submitLogin(); }); });
    setTimeout(function() { (setupMode ? username : password).focus(); }, 0);
})();

// ---- 退出登录按钮 ----
    (function addLogoutButton() {
        function append() {
            var bar = document.querySelector('#mainFooter .paFooterLeftBar');
            if (!bar || bar.querySelector('.paLogoutBtn')) return;
            var btn = document.createElement('span');
            btn.className = 'paLogoutBtn';
            btn.textContent = '退出登录';
            btn.onclick = function() { if (typeof window.notepadLogout === 'function') window.notepadLogout(); };
            var fileLabel = bar.querySelector('.paDataFileLabel');
            if (fileLabel) bar.insertBefore(btn, fileLabel); else bar.appendChild(btn);
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', append); else setTimeout(append, 0);
    })();

// ---- 计时器 / 闹钟 / 页面缩放 ----
    (function() {
        var z = 1;
        var _timerState = { mode:'', totalSec:0, remainingSec:0, interval:null, startTS:0, endTS:0 };
        var _timerActive = false;
        var _alarms = [];
        var _alarmInterval = null;
        try { var s = parseFloat(DataLayer.getRaw('mainZoom')); if (isFinite(s) && s > 0) z = s; } catch (e) {}
        function apply() {
            var ids = ['mainContent', 'notepadPanel'];
            if (!isFinite(z) || z <= 0) z = 1;
            for (var i = 0; i < ids.length; i++) {
                var el = document.getElementById(ids[i]);
                if (el) el.style.zoom = z;
            }
            var availTop = 75;
            var availBottom = 15;
            var cssTop = (availTop / z);
            var cssBottom = (availBottom / z);
            function fitPanel(el, userMovedKey, anchorEdgeKey, anchorEdgePx) {
                if (!el) return;
                el.style.maxHeight = '';
                if (!el.dataset[userMovedKey]) {
                    el.style.height = '';
                    el.style.top = cssTop + 'px';
                    el.style.bottom = cssBottom + 'px';
                    if (anchorEdgeKey) {
                        el.style[anchorEdgeKey] = (anchorEdgePx / z) + 'px';
                    }
                } else {
                    // user has moved/resized: keep existing height, only constrain top
                    var topPx = parseFloat(el.style.top);
                    if (!isFinite(topPx)) topPx = cssTop;
                    if (topPx < cssTop) topPx = cssTop;
                    el.style.top = topPx + 'px';
                }
            }
            fitPanel(document.getElementById('notepadPanel'), 'npUserMoved', 'left', 15);
        }
        window.addEventListener('resize', function() { apply(); });
        function change(delta) {
            var d = parseFloat(delta);
            if (!isFinite(d)) d = 0;
            if (!isFinite(z) || z <= 0) z = 1;
            var nz = Math.round((z + d) * 100) / 100;
            if (nz < 0.5) nz = 0.5;
            if (nz > 2) nz = 2;
            z = nz;
            try { DataLayer.setRaw('mainZoom', String(z)); } catch (e) {}
            if (typeof window.syncPanelDefaultBoundsForZoom === 'function') window.syncPanelDefaultBoundsForZoom(z);
            apply();
            setTimeout(function() { window.dispatchEvent(new Event('resize')); }, 0);
            if (typeof window.showToast === 'function') window.showToast('显示比例：' + Math.round(z * 100) + '%');
        }
        function _preserveNotepadWidthOnFullscreen() {
            var panel = document.getElementById('notepadPanel');
            if (!panel || !panel.classList.contains('show')) return;
            var zNow = z || 1;
            var r = panel.getBoundingClientRect();
            panel.dataset.npFullscreenKeepWidth = String(r.width / zNow);
            panel.dataset.npFullscreenKeepLeft = String(r.left / zNow);
        }
        function _restoreNotepadWidthAfterFullscreen() {
            var panel = document.getElementById('notepadPanel');
            if (!panel || !panel.classList.contains('show')) return;
            var keepW = parseFloat(panel.dataset.npFullscreenKeepWidth || '');
            var keepL = parseFloat(panel.dataset.npFullscreenKeepLeft || '');
            if (_materialMode || _writeNoteMode) {
                // layout functions already set correct width/left, don't override
            } else {
                if (isFinite(keepW) && keepW > 0) panel.style.width = keepW + 'px';
                if (isFinite(keepL)) panel.style.left = keepL + 'px';
            }
            delete panel.dataset.npFullscreenKeepWidth;
            delete panel.dataset.npFullscreenKeepLeft;
        }
        function _syncFullscreenUi() {
            var isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
            var logo = document.getElementById('headerLogo');
            if (logo) {
                logo.title = isFs ? '退出全屏（点击 Logo）' : '全屏（点击 Logo）';
                logo.setAttribute('aria-label', logo.title);
            }
        }
        function toggleBrowserFullscreen() {
            _preserveNotepadWidthOnFullscreen();
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                var el = document.documentElement;
                if (el.requestFullscreen) el.requestFullscreen();
                else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }
            _syncFullscreenUi();
        }
        window.toggleBrowserFullscreen = toggleBrowserFullscreen;
        document.addEventListener('fullscreenchange', function() {
            _syncFullscreenUi();
            setTimeout(_restoreNotepadWidthAfterFullscreen, 0);
        });
        document.addEventListener('webkitfullscreenchange', function() {
            _syncFullscreenUi();
            setTimeout(_restoreNotepadWidthAfterFullscreen, 0);
        });
        window.changeMainZoom = change;
        window.applyMainZoom = apply;
        function initMainSplitDivider() {
            var main = document.getElementById('mainContent');
            var left = document.getElementById('leftPanel');
            var divider = document.getElementById('mainSplitDivider');
            if (!main || !left || !divider || divider._bound) return;
            divider._bound = true;
            divider.addEventListener('mousedown', function(e) {
                var cs = document.getElementById('calendarSection');
                if (cs && cs.style.display !== 'none') return;
                e.preventDefault();
                divider.classList.add('dragging');
                var rect = main.getBoundingClientRect();
                function onMove(ev) {
                    var minLeft = 360;
                    var minRight = 420;
                    var w = ev.clientX - rect.left;
                    var maxLeft = rect.width - minRight;
                    if (w < minLeft) w = minLeft;
                    if (w > maxLeft) w = maxLeft;
                    left.style.width = w + 'px';
                    try { DataLayer.setRaw('mainSplitLeftWidth', String(Math.round(w))); } catch(ex) {}
                }
                function onUp() {
                    divider.classList.remove('dragging');
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMainSplitDivider); else initMainSplitDivider();
        function _saveTimerToCache() {
            try {
                DataLayer.set('timerCache', {
                    mode: _timerState.mode,
                    startTS: _timerState.startTS,
                    endTS: _timerState.endTS,
                    totalSec: _timerState.totalSec,
                    alarms: _alarms.map(function(a) { return {hours:a.hours, minutes:a.minutes, triggered:a.triggered, totalSec:a.totalSec}; })
                })
            } catch (e) {}
        }
        function _clearTimerCache() {
            try { DataLayer.remove('timerCache'); } catch (e) {}
        }

        function updateTopClock() {
            var el = document.getElementById('topClock');
            if (!el) return;
            var nowD = new Date();
            var timeStr = String(nowD.getHours()).padStart(2,'0') + ':' + String(nowD.getMinutes()).padStart(2,'0') + ':' + String(nowD.getSeconds()).padStart(2,'0');
            var isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
            if (_timerActive && _timerState.mode === 'countdown') {
                var remaining = (_timerState.endTS - Date.now()) / 1000;
                if (remaining < 0) remaining = 0;
                var total = Math.ceil(remaining);
                var h = Math.floor(total / 3600);
                var m = Math.floor((total % 3600) / 60);
                var s = total % 60;
                var ds = '';
                if (h > 0) ds += h + '时';
                ds += m + '分' + s + '秒';
                el.textContent = ds;
                el.style.opacity = '1';
            } else if (_timerActive && _timerState.mode === 'stopwatch') {
                var elapsed = (Date.now() - _timerState.startTS) / 1000;
                var total = Math.round(elapsed);
                var h = Math.floor(total / 3600);
                var m = Math.floor((total % 3600) / 60);
                var es = h + '时' + m + '分';
                el.textContent = timeStr + '（' + es + '）';
                el.style.opacity = '1';
            } else {
                el.textContent = timeStr;
                el.style.opacity = isFS ? '1' : '0.3';
            }
            el.classList.add('show');
        }
        setInterval(updateTopClock, 1000);
        document.addEventListener('fullscreenchange', updateTopClock);
        document.addEventListener('webkitfullscreenchange', updateTopClock);
        setTimeout(updateTopClock, 100);

        function openTimerModal() {
            if (_timerActive) { stopTimer(); return; }
            document.getElementById('timerModal').classList.add('show');
            document.getElementById('timerStopwatchDisplay').textContent = '00:00:00';
            document.getElementById('timerCountdownDisplay').textContent = '00:00:00';
            var qbs = document.querySelectorAll('#timerCountdownTab .timerQuickBtn');
            for (var qi=0;qi<qbs.length;qi++) qbs[qi].classList.remove('active');
            document.getElementById('timerCustomHour').value = '0';
            document.getElementById('timerCustomMin').value = '0';
            renderAlarmList();
        }
        function switchTimerTab(tab) {
            var tabs = document.querySelectorAll('.timerTab');
            for (var ti=0;ti<tabs.length;ti++) tabs[ti].classList.toggle('active', tabs[ti].dataset.ttab === tab);
            document.getElementById('timerStopwatchTab').classList.toggle('show', tab==='stopwatch');
            document.getElementById('timerCountdownTab').classList.toggle('show', tab==='countdown');
            document.getElementById('timerAlarmTab').classList.toggle('show', tab==='alarm');
        }
        function selectCountdownPreset(btn) {
            var qbs = document.querySelectorAll('#timerCountdownTab .timerQuickBtn');
            for (var qi=0;qi<qbs.length;qi++) qbs[qi].classList.remove('active');
            btn.classList.add('active');
            document.getElementById('timerCustomHour').value = '0';
            document.getElementById('timerCustomMin').value = '0';
            var min = parseInt(btn.dataset.min) || 0;
            document.getElementById('timerCountdownDisplay').textContent = String(Math.floor(min/60)).padStart(2,'0') + ':' + String(min%60).padStart(2,'0') + ':00';
        }
        function applyCustomCountdown() {
            var h = parseInt(document.getElementById('timerCustomHour').value) || 0;
            var m = parseInt(document.getElementById('timerCustomMin').value) || 0;
            var totalMin = h * 60 + m;
            if (totalMin < 1) { showToast('请输入有效的时长'); return; }
            var qbs = document.querySelectorAll('#timerCountdownTab .timerQuickBtn');
            for (var qi=0;qi<qbs.length;qi++) qbs[qi].classList.remove('active');
            var totalSec = totalMin * 60;
            document.getElementById('timerCountdownDisplay').textContent = String(Math.floor(totalSec/3600)).padStart(2,'0') + ':' + String(Math.floor((totalSec%3600)/60)).padStart(2,'0') + ':' + String(totalSec%60).padStart(2,'0');
        }
        function clearTimerPresets() {
            var h = parseInt(document.getElementById('timerCustomHour').value) || 0;
            var m = parseInt(document.getElementById('timerCustomMin').value) || 0;
            if (h > 0 || m > 0) {
                var qbs = document.querySelectorAll('#timerCountdownTab .timerQuickBtn');
                for (var qi=0;qi<qbs.length;qi++) qbs[qi].classList.remove('active');
            }
        }
        function startStopwatch() {
            _timerState.mode = 'stopwatch';
            _timerState.startTS = Date.now();
            _timerState.endTS = 0;
            _timerState.totalSec = 0;
            document.getElementById('timerModal').classList.remove('show');
            _saveTimerToCache();
            beginTimerTick();
        }
        function startCountdown() {
            var totalMin = 0;
            var activeBtn = document.querySelector('#timerCountdownTab .timerQuickBtn.active');
            if (activeBtn) {
                totalMin = parseInt(activeBtn.dataset.min) || 0;
            } else {
                var h = parseInt(document.getElementById('timerCustomHour').value) || 0;
                var m = parseInt(document.getElementById('timerCustomMin').value) || 0;
                totalMin = h * 60 + m;
            }
            if (totalMin < 1) { showToast('请选择或输入倒计时时长'); return; }
            _timerState.mode = 'countdown';
            _timerState.startTS = 0;
            _timerState.totalSec = totalMin * 60;
            _timerState.endTS = Date.now() + totalMin * 60000;
            _timerState.remainingSec = totalMin * 60;
            document.getElementById('timerModal').classList.remove('show');
            _saveTimerToCache();
            beginTimerTick();
        }
        function beginTimerTick() {
            if (_timerActive) stopTimer();
            _timerActive = true;
            updateTopClock();
            if (_timerState.interval) clearInterval(_timerState.interval);
            _timerState.interval = setInterval(function() {
                if (_timerState.mode === 'stopwatch') {
                    updateTopClock();
                    _saveTimerToCache();
                } else if (_timerState.mode === 'countdown') {
                    var remaining = (_timerState.endTS - Date.now()) / 1000;
                    if (remaining <= 0) {
                        updateTopClock();
                        stopTimer();
                        _clearTimerCache();
                        showTimerNotifyModal('倒计时结束！');
                        return;
                    }
                    _timerState.remainingSec = remaining;
                    updateTopClock();
                    _saveTimerToCache();
                }
            }, 200);
        }
        function stopTimer() {
            _timerActive = false;
            if (_timerState.interval) { clearInterval(_timerState.interval); _timerState.interval = null; }
            _timerState.mode = '';
            _clearTimerCache();
            updateTopClock();
        }

        function addAlarm() {
            var h = parseInt(document.getElementById('alarmHour').value) || 0;
            var m = parseInt(document.getElementById('alarmMin').value) || 0;
            if (h < 0 || m < 0 || (h === 0 && m === 0)) { showToast('请输入有效的闹钟时间'); return; }
            _alarms.push({ hours: h, minutes: m, triggered: false, totalSec: h * 3600 + m * 60 });
            renderAlarmList();
            document.getElementById('alarmHour').value = '0';
            document.getElementById('alarmMin').value = '0';
        }
        function removeAlarm(idx) {
            _alarms.splice(idx, 1);
            renderAlarmList();
            _saveTimerToCache();
        }
        function renderAlarmList() {
            var el = document.getElementById('alarmList');
            if (!el) return;
            if (_alarms.length === 0) { el.innerHTML = '<div style="font-size:12px;color:#aaa;text-align:center;padding:8px;">暂无闹钟</div>'; return; }
            var html = '';
            for (var i = 0; i < _alarms.length; i++) {
                var a = _alarms[i];
                var label = a.triggered ? '（已响铃）' : (a.hours > 0 ? a.hours + '时' : '') + a.minutes + '分后提醒';
                html += '<div class="alarmItem"><span>' + (a.triggered ? '<span style="color:#999;text-decoration:line-through;">' + label + '</span>' : label) + '</span><span class="alarmDel" onclick="removeAlarm(' + i + ')">×</span></div>';
            }
            el.innerHTML = html;
        }
        function confirmAlarms() {
            if (_alarms.length === 0) { showToast('请至少添加一个闹钟'); return; }
            document.getElementById('timerModal').classList.remove('show');
            if (_alarmInterval) clearInterval(_alarmInterval);
            _alarmInterval = setInterval(checkAlarms, 1000);
            _saveTimerToCache();
            showToast('已设置 ' + _alarms.length + ' 个闹钟');
        }
        function checkAlarms() {
            if (!_alarms || _alarms.length === 0) return;
            var changed = false;
            for (var i = 0; i < _alarms.length; i++) {
                var a = _alarms[i];
                if (a.triggered) continue;
                a.totalSec--;
                if (a.totalSec <= 0) {
                    a.triggered = true;
                    a.totalSec = 0;
                    changed = true;
                    showTimerNotifyModal('闹钟时间到！');
                }
            }
            if (changed) _saveTimerToCache();
            var allDone = true;
            for (var j = 0; j < _alarms.length; j++) {
                if (!_alarms[j].triggered) { allDone = false; break; }
            }
            if (allDone && _alarmInterval) {
                clearInterval(_alarmInterval);
                _alarmInterval = null;
                _saveTimerToCache();
            }
        }
        function showTimerNotifyModal(msg) {
            var modal = document.getElementById('reminderNotifyModal');
            var text = document.getElementById('notifyText');
            var time = document.getElementById('notifyTime');
            if (modal && text && time) {
                text.innerHTML = '<div style="font-size:22px;text-align:center;padding:10px;">' + msg + '</div>';
                var now = new Date();
                time.textContent = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0') + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
                modal.classList.add('show');
                setTimeout(function() { modal.classList.remove('show'); }, 5000);
            }
        }

        window.openTimerModal = openTimerModal;
        window.switchTimerTab = switchTimerTab;
        window.selectCountdownPreset = selectCountdownPreset;
        window.applyCustomCountdown = applyCustomCountdown;
        window.startStopwatch = startStopwatch;
        window.startCountdown = startCountdown;
        window.clearTimerPresets = clearTimerPresets;
        window.addAlarm = addAlarm;
        window.removeAlarm = removeAlarm;
        window.confirmAlarms = confirmAlarms;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', apply);
        } else {
            setTimeout(apply, 0);
        }
    })();
