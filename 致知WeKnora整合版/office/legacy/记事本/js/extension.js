/* ============================================================
   extension.js — 扩展屏模块
   ============================================================ */

(function() {
    var isExtensionScreen = location.hash === '#extension-screen';
    var extensionWindow = null;
    var extensionTimer = null;
    var _extContentDirty = true;
    var _extDebounceTimer = null;
    var _extLastSentSig = '';
    var _extObserver = null;
    function _extScheduleSend(delayMs) {
        clearTimeout(_extDebounceTimer);
        _extDebounceTimer = setTimeout(function() {
            _extDebounceTimer = null;
            sendExtensionContent();
        }, delayMs || 300);
    }
    function _extMarkDirty() {
        _extContentDirty = true;
        _extScheduleSend(300);
    }
    function _payloadSig(p) {
        var tabs = [];
        for (var i = 0; i < 5; i++) tabs.push((p.notes && p.notes[i]) || '');
        var nos = (p.noteOutlines || []).map(function(a) { return (a || []).map(function(x) { return x.text + x.level; }).join('|'); }).join('#');
        var eo = (p.editorOutline || []).map(function(x) { return x.text + x.level; }).join('|');
        var lm = p.logModes || {};
        return p.editor + '\x01' + (p.editorTextMode ? '1' : '0') + '\x01' + eo + '\x01' + tabs.join('\x02') + '\x01' + nos + '\x01' + (lm.report || '') + '\x01' + (lm.page || '') + '\x01' + (lm.track || '') + '\x01' + p.logType + '\x01' + p.logMode + '\x01' + p.logRange + '\x01' + (p.logSearch || '');
    }
    function extensionPayload() {
        var body = document.getElementById('paBody');
        var overlay = document.getElementById('paPreviewOverlay');
        var previewEditor = document.getElementById('paPreviewEditor');
        var editorHtml = '';
        var editorTextMode = false;
        try {
            if (typeof window.paExtensionGetEditor === 'function') {
                var ed = window.paExtensionGetEditor();
                editorHtml = ed.html || '';
                editorTextMode = !!ed.textMode;
            } else {
                var overlayShown = !!(overlay && overlay.classList && overlay.classList.contains('show'));
                var previewHtml = previewEditor ? previewEditor.innerHTML : '';
                if (overlayShown) {
                    editorTextMode = true;
                    editorHtml = previewHtml;
                } else if (body) {
                    editorHtml = body.innerHTML;
                }
            }
        } catch (e) {
            try { editorHtml = body ? body.innerHTML : (previewEditor ? previewEditor.innerHTML : ''); } catch (e2) { editorHtml = ''; }
        }
        var logEl = document.getElementById('trackContent');
        var logModes = { report: logEl ? logEl.innerHTML : '', page: '', track: '' };
        try {
            var savedTrackMode = currentTrackMode;
            var modeContainers = {};
            ['report', 'page', 'track'].forEach(function(mode) {
                var modeContainer = document.createElement('div');
                modeContainer.style.cssText = 'position:absolute;left:-100000px;top:-100000px;width:1px;height:1px;overflow:hidden;';
                document.body.appendChild(modeContainer);
                modeContainers[mode] = modeContainer;
                S.currentTrackMode = mode;
                if (mode === 'report') renderReportTable(modeContainer);
                else if (mode === 'page') renderPageView(modeContainer);
                else renderMultiTrackTimeline(modeContainer);
                logModes[mode] = modeContainer.innerHTML;
            });
            S.currentTrackMode = savedTrackMode;
            Object.keys(modeContainers).forEach(function(mode) { modeContainers[mode].remove(); });
        } catch (e) {
            try { S.currentTrackMode = savedTrackMode; } catch (e2) {}
        }
        var notes = [];
        try {
            if (typeof notepadEditorData !== 'undefined' && notepadEditorData) {
                notes = notepadEditorData.map(function(x) { return x && x.html || ''; });
            }
            if (typeof notepadVisible !== 'undefined' && notepadVisible && !(typeof _notepadDirBrowseMode !== 'undefined' && _notepadDirBrowseMode)) {
                var liveEditor = document.getElementById('notepadEditor');
                var curTab = (typeof currentNotepadTab !== 'undefined') ? currentNotepadTab : 0;
                if (liveEditor && curTab >= 0 && curTab < notes.length) {
                    var liveHtml = liveEditor.innerHTML;
                    if (liveHtml != null) notes[curTab] = liveHtml;
                }
            }
        } catch (e) { }
        var titles = [];
        try {
            if (typeof notepadTitles !== 'undefined' && notepadTitles) titles = notepadTitles.slice();
            if (typeof notepadVisible !== 'undefined' && notepadVisible) {
                var titleEl = document.getElementById('notepadTitle');
                var curTab2 = (typeof currentNotepadTab !== 'undefined') ? currentNotepadTab : 0;
                if (titleEl && curTab2 >= 0 && curTab2 < titles.length) titles[curTab2] = titleEl.value;
            }
        } catch (e) { titles = []; }
        var logRange = '';
        try { var td = document.getElementById('timeRangeDisplay'); logRange = td ? td.textContent : ''; } catch (e) { logRange = ''; }
        var editorOutline = [];
        try { if (window.paExtensionBuildNoteOutline && editorHtml) editorOutline = window.paExtensionBuildNoteOutline(editorHtml); } catch (e) { editorOutline = []; }
        var noteOutlines = [];
        try {
            if (typeof window.paExtensionBuildNoteOutline === 'function' && notes && notes.length) {
                for (var ni = 0; ni < notes.length; ni++) noteOutlines.push(window.paExtensionBuildNoteOutline(notes[ni]));
            }
        } catch (e) { noteOutlines = []; }
        return { editor: editorHtml, editorTextMode: editorTextMode, editorOutline: editorOutline, notes: notes, noteOutlines: noteOutlines, titles: titles, log: logEl ? logEl.innerHTML : '', logModes: logModes, logType: (typeof timeRangeType !== 'undefined' ? timeRangeType : 'day'), logMode: (typeof currentTrackMode !== 'undefined' ? currentTrackMode : 'report'), logRange: logRange, logSearch: (typeof searchKeyword !== 'undefined' ? searchKeyword : '') };
    }
    function sendExtensionContent() {
        if (!extensionWindow || extensionWindow.closed) {
            clearInterval(extensionTimer); extensionTimer = null;
            if (_extObserver) { _extObserver.disconnect(); _extObserver = null; }
            return;
        }
        if (!_extContentDirty) {
            var sig = _extLastSentSig;
            if (sig) return;
        }
        try {
            var payload = extensionPayload();
            var sig = _payloadSig(payload);
            if (sig === _extLastSentSig && !_extContentDirty) return;
            extensionWindow.postMessage({ type: 'notepad-extension-content', payload: payload }, '*');
            _extLastSentSig = sig;
            _extContentDirty = false;
        } catch (e) {}
    }
    window.openExtensionScreen = function() {
        if (extensionWindow && !extensionWindow.closed) { extensionWindow.focus(); sendExtensionContent(); return; }
        var url = location.href.split('#')[0] + '#extension-screen';
        var feats = 'popup=yes,width=1100,height=800,left=' + Math.max(0, Math.round((screen.availWidth - 1100) / 2)) + ',top=' + Math.max(0, Math.round((screen.availHeight - 800) / 2)) + ',resizable=yes,scrollbars=no,location=no,toolbar=no,menubar=no,status=no,titlebar=yes,directories=no,personalbar=no';
        var w = null;
        try { w = window.open(url, 'notepadExtensionScreen', feats); } catch (e) { w = null; }
        if (!w) { if (typeof showToast === 'function') showToast('浏览器阻止了新窗口，请允许弹出窗口'); return; }
        extensionWindow = w;
        clearInterval(extensionTimer);
        _extContentDirty = true;
        _extLastSentSig = '';
        _extScheduleSend(300);
        extensionTimer = setInterval(function() {
            if (!extensionWindow || extensionWindow.closed) { clearInterval(extensionTimer); extensionTimer = null; return; }
            if (_extContentDirty) sendExtensionContent();
        }, 3000);
        if (!_extObserver) {
            try {
                _extObserver = new MutationObserver(function() { _extMarkDirty(); });
                _extObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
            } catch (e) { _extObserver = null; }
        }
    };
    if (!isExtensionScreen) {
        function addExtensionButton() {
            // 版记已不再放「扩展屏」按钮（openExtensionScreen 仍可通过 #extension-screen 使用）
            var bar = document.querySelector('#mainFooter .paFooterLeftBar');
            if (bar) {
                var old = bar.querySelector('.paExtensionBtn');
                if (old && old.parentNode) old.parentNode.removeChild(old);
            }
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addExtensionButton); else setTimeout(addExtensionButton, 0);
        window.addEventListener('message', function(e) {
            if (!e.data) return;
            if (e.data.type === 'notepad-extension-ready') { sendExtensionContent(); return; }
            if (e.data.type === 'notepad-extension-action') {
                var act = e.data.action;
                try {
                    if (act === 'prev' && typeof prevTimeRange === 'function') prevTimeRange();
                    else if (act === 'next' && typeof nextTimeRange === 'function') nextTimeRange();
                     else if (act === 'setType' && typeof changeTimeRangeType === 'function') changeTimeRangeType(e.data.value);
                     else if (act === 'setMode') { /* Extension screen modes are local and do not affect the main screen. */ }
                     else if (act === 'setSearch' && typeof searchTable === 'function') {
                         searchTable(e.data.value || '');
                         _extMarkDirty();
                         return;
                     }
                 } catch (err) {}
                _extMarkDirty();
            }
        });
        return;
    }
    function initExtensionScreen() {
        var root = document.createElement('div');
        root.id = 'extensionScreenRoot';
        root.innerHTML = '<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#f5f7fa;color:#333;font-family:SimSun,宋体,serif}body{display:flex;flex-direction:column}#extensionScreenRoot{display:flex;flex-direction:column;width:100%;height:100%;min-height:0}.extensionScreenHead{height:58px;display:flex;align-items:center;padding:8px 14px;background:#0d2b4e;gap:8px}.extensionScreenTab{height:40px;padding:0 28px;border:1px solid rgba(255,255,255,.5);border-radius:5px;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;font:17px SimHei,黑体,sans-serif}.extensionScreenTab.active{background:#2980b9}.extensionScreenSub{height:42px;display:flex;align-items:center;gap:6px;padding:5px 10px;background:#fff;border-bottom:1px solid #d9e1ea;min-width:0;overflow-x:auto;overflow-y:hidden;white-space:nowrap}.extensionScreenSub button,.extensionScreenSub select{height:30px;padding:0 12px;border:1px solid #c8d2df;border-radius:4px;background:#fff;color:#40566e;cursor:pointer;font:13px SimHei,黑体,sans-serif}.extensionScreenSub button.active{background:#e3f2fd;border-color:#64b5f6;color:#1565c0}.extensionScreenTools{margin-left:auto;display:flex;gap:7px}.extensionScreenTool{width:32px;height:32px;padding:0;border:1px solid rgba(255,255,255,.45);border-radius:4px;background:rgba(255,255,255,.12);cursor:pointer}.extensionScreenTool img{width:20px;height:20px}.extensionScreenBody{flex:1 1 auto;overflow:hidden;padding:12px;display:flex}.extensionScreenPane{display:none;width:100%;height:100%;min-width:0;min-height:0;background:#fff;border:1px solid #d9e1ea;border-radius:7px;padding:16px;overflow:auto}.extensionScreenPane.active{display:block;flex:1 1 auto;height:auto;min-height:0}.extensionNoteBtns{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.extensionNoteBtn{padding:5px 14px;border:1px solid #c8d2df;border-radius:4px;background:#fff;color:#40566e;cursor:pointer;font:13px SimHei,黑体,sans-serif}.extensionNoteBtn.active{background:#667eea;color:#fff;border-color:#5a6fd1}.extensionNoteView{min-height:0}.extensionEditorLayout{display:flex;gap:10px;align-items:flex-start}.extensionOutline{width:240px;flex:0 0 240px;align-self:stretch;border-right:1px solid #d9e1ea;padding-right:10px;position:sticky;top:0;max-height:calc(100vh - 120px);overflow:auto}.extensionOutlineItem{padding:6px 8px;border-bottom:1px solid #edf0f4;cursor:pointer;font-size:14px}.extensionOutlineItem:hover{background:#eef4ff;color:#1565c0}.extensionEditorView{flex:1 1 auto;min-width:0;padding:4px 10px;font-size:16px;line-height:1.8}.extensionEditorView.paTextMode{display:block;padding:20px 28px;background:#fafafa;font-family:\'FangSong_GB2312\',\'仿宋_GB2312\',\'FangSong\',\'仿宋\',serif;font-size:16px;line-height:1.8;color:#333}.extensionEditorView.paTextMode p{margin:0}.extensionEditorView img{max-width:100%;height:auto}.extensionLogView{min-height:0}@media print{.extensionScreenHead{display:none}}.extensionLogView img{max-width:100%;height:auto}.extensionLogType{height:30px;padding:0 8px;border:1px solid #c8d2df;border-radius:4px;background:#fff;color:#40566e;cursor:pointer;font:13px SimHei,黑体,sans-serif}.extensionLogRangeNav{width:30px;height:30px;padding:0;border:1px solid #c8d2df;border-radius:4px;background:#fff;color:#40566e;cursor:pointer;font:15px SimHei,黑体,sans-serif}.extensionRestoreHandle{display:none;position:fixed;top:0;right:0;z-index:99;height:22px;padding:0 12px;border:none;border-radius:0 0 0 6px;background:rgba(13,43,78,.55);color:#fff;cursor:pointer;font:13px SimHei,黑体,sans-serif;opacity:.35;transition:opacity .15s}.extensionRestoreHandle:hover{opacity:1}body.extCompact .extensionScreenHead{display:none}body.extCompact .extensionRestoreHandle{display:block}body.extCompact .extensionScreenBody{padding:0}.extensionLogRange{display:inline-block;min-width:220px;text-align:center;color:#4fc3f7;font:13px SimHei,黑体,sans-serif;white-space:nowrap;font-weight:bold}.extensionLogModeGroup{display:inline-flex;gap:4px;margin-left:8px}.extensionLogModeBtn{height:30px;padding:0 12px;border:1px solid #c8d2df;border-radius:4px;background:#fff;color:#40566e;cursor:pointer;font:13px SimHei,黑体,sans-serif}.extensionLogModeBtn.active{background:#e3f2fd;border-color:#64b5f6;color:#1565c0}#extensionScreenLog .pageViewWeekNav{position:sticky;top:0;z-index:6}.extensionCtxMenu{display:none;position:fixed;z-index:200;min-width:130px;padding:4px 0;background:#fff;border:1px solid #ccc;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.2);font:14px SimHei,黑体,sans-serif}.extensionCtxMenu.open{display:block}.extensionCtxItem{padding:8px 16px;cursor:pointer;color:#333;white-space:nowrap}.extensionCtxItem:hover{background:#e3f2fd;color:#1565c0}.extensionCtxSep{height:1px;background:#eee;margin:4px 0}.extensionSearchBox{display:none;position:fixed;right:24px;bottom:24px;z-index:210;padding:10px 12px;background:#fff;border:1px solid #b7d0f5;border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.2);font:13px SimHei,黑体,sans-serif}.extensionSearchBox.open{display:flex;align-items:center;gap:6px}.extensionSearchBox input{height:30px;width:220px;padding:0 8px;border:1px solid #c8d2df;border-radius:4px;font:13px SimHei,黑体,sans-serif}.extensionSearchBtn{height:30px;padding:0 10px;border:1px solid #c8d2df;border-radius:4px;background:#fff;color:#40566e;cursor:pointer;font:13px SimHei,黑体,sans-serif}.extensionSearchBtn:hover{background:#e3f2fd;border-color:#64b5f6;color:#1565c0}.extensionSearchCount{color:#1565c0;min-width:52px;text-align:center}.extensionOutlineTabs{display:flex;border-bottom:1px solid #ddd;margin-bottom:10px}.extensionOutlineTab{padding:6px 16px;border:none;background:none;cursor:pointer;font:13px SimHei,黑体,sans-serif;color:#666;border-bottom:2px solid transparent}.extensionOutlineTab.active{color:#1565c0;border-bottom-color:#1565c0;font-weight:bold}.extensionOutlinePane{display:none}.extensionOutlinePane.show{display:block}.extensionOutlineEmpty{padding:20px 10px;color:#999;font:13px SimHei,黑体,sans-serif;text-align:center}.extensionLayout{display:flex;gap:12px;align-items:flex-start;height:100%;min-height:0}.extensionSidebar{width:260px;flex:0 0 260px;position:sticky;top:0;max-height:100%;overflow:auto;border-right:1px solid #e5e9ef;padding-right:10px}.extensionSidebar.hidden{display:none}.extensionOutlineItem{padding:7px 10px;cursor:pointer;font-size:15px;color:#333;border-bottom:1px solid #f0f0f0}.extensionOutlineItem:hover{background:#f5f7fa;color:#667eea}.extensionOutlineItem.lv1{padding-left:10px}.extensionOutlineItem.lv2{padding-left:26px}.extensionOutlineItem.lv3{padding-left:42px}.extensionNoteList .extensionOutlineItem{cursor:pointer}.extensionPaneScroll{flex:1 1 auto;min-width:0;overflow:visible}.extensionNoteView{min-height:0}.extensionEmptyTip{padding:40px 20px;color:#c0392b;font:15px SimHei,黑体,sans-serif;text-align:center;line-height:2}.extensionSearchHit{background:#fff59d;border-radius:2px}.extensionSearchHitActive{background:#ff9800;color:#fff;border-radius:2px}</style><div class="extensionScreenHead"><button class="extensionScreenTab active" data-ext-tab="note">笔记</button><button class="extensionScreenTab" data-ext-tab="log">日志</button><div class="extensionScreenTools"><button class="extensionScreenTool" data-ext-action="zoom-in" title="放大"><img src="data/enlarge.ico"></button><button class="extensionScreenTool" data-ext-action="zoom-out" title="缩小"><img src="data/reduce.ico"></button><button class="extensionScreenTool" data-ext-action="fullscreen" title="全屏"><img src="data/fullscreen.ico"></button></div></div><div class="extensionScreenSub" id="extensionScreenSub"></div><div class="extensionScreenBody"><section class="extensionScreenPane active" id="extensionScreenNote"></section><section class="extensionScreenPane" id="extensionScreenLog"></section></div><button class="extensionRestoreHandle" data-ext-action="compact" title="展开工具栏">▾ 展开工具栏</button><div class="extensionCtxMenu" id="extensionCtxMenu"><div class="extensionCtxItem" data-ctx="outline">显示提纲</div><div class="extensionCtxItem" data-ctx="compact">收起工具栏</div><div class="extensionCtxSep"></div><div class="extensionCtxItem" data-ctx="zoom-in">放大</div><div class="extensionCtxItem" data-ctx="zoom-out">缩小</div><div class="extensionCtxItem" data-ctx="search">查询</div></div><div class="extensionSearchBox" id="extensionSearchBox"><input type="text" id="extensionSearchInput" placeholder="输入关键字检索"><button class="extensionSearchBtn" data-search="prev">上一个</button><button class="extensionSearchBtn" data-search="next">下一个</button><button class="extensionSearchBtn" data-search="close">关闭</button><span class="extensionSearchCount" id="extensionSearchCount"></span></div>';
         var extensionLogStyle = document.createElement('style');
         extensionLogStyle.textContent = '.extensionScreenSub .timeRangeSelect{padding:3px 6px;border:1px solid rgba(255,255,255,.4);border-radius:4px;background:rgba(255,255,255,.2);color:#fff;font-size:14px}.extensionScreenSub .timeRangeSelect option{background:#2c3e50;color:#fff}.extensionScreenSub .timeRangeNavBtn{width:24px;height:24px;padding:0;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.2);border-radius:4px;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center}.extensionScreenSub .timeRangeNavBtn:hover{background:rgba(255,255,255,.3)}.extensionScreenSub .timeRangeDisplay{font-size:14px;color:#fff;min-width:140px;text-align:center;font-weight:bold}.extensionLogSearchInput{display:none;width:260px;height:30px;padding:0 10px;border:1px solid rgba(255,255,255,.4);border-radius:4px;background:rgba(44,62,80,1);color:#fff;outline:none;font:14px SimSun,宋体,serif}.extensionLogSearchInput::placeholder{color:rgba(255,255,255,.7)}.extensionLogModeGroup{display:flex;align-items:center;gap:8px;margin-left:28px}.extensionLogModeIcon{width:20px;height:20px;cursor:pointer;opacity:.35;transition:opacity .15s}.extensionLogModeIcon.active{opacity:1}.extensionScreenPane .pageViewWeekNav{position:sticky!important;top:-16px!important;z-index:20;background:rgba(255,255,255,.98)}.extensionScreenPane .pageViewSubItem{cursor:default!important}';
         root.appendChild(extensionLogStyle);
         document.body.innerHTML = ''; document.body.appendChild(root);
          var state = { tab:'note', note:0, zoom:1, contentFullscreen:false, compact:false, showOutline:false, outlineTab:'outline', searchIndex:0, logSearchOpen:false, logMode:'report', _lastSig:'', payload:{editor:'',editorTextMode:false,editorOutline:[],notes:[],noteOutlines:[],titles:[],log:'',logModes:{},logType:'day',logMode:'report',logRange:'',logSearch:''} };
         var sub = root.querySelector('#extensionScreenSub');
         var head = root.querySelector('.extensionScreenHead');
         var logTab = root.querySelector('.extensionScreenTab[data-ext-tab="log"]');
         var tools = root.querySelector('.extensionScreenTools');
         var body = root.querySelector('.extensionScreenBody');
         var noteHeadBtns = document.createElement('div');
         noteHeadBtns.className = 'extensionNoteBtns extensionNoteHeadBtns';
         noteHeadBtns.style.display = 'none';
         noteHeadBtns.style.margin = '0';
         noteHeadBtns.style.flex = '0 0 auto';
         if (head && logTab) head.insertBefore(noteHeadBtns, logTab.nextSibling);
         if (head && sub && tools) {
             head.insertBefore(sub, tools);
             sub.style.height = '40px';
             sub.style.padding = '0';
             sub.style.border = 'none';
             sub.style.background = 'transparent';
             sub.style.flex = '0 0 auto';
             sub.style.minWidth = '0';
             tools.style.marginLeft = 'auto';
         }
         if (body) { body.style.paddingBottom = '0'; }
          function showPane(id) { root.querySelectorAll('.extensionScreenPane').forEach(function(p) { p.classList.toggle('active', p.id === id); }); }
          function sendAction(action, value) { try { if (window.opener && !window.opener.closed) window.opener.postMessage({ type: 'notepad-extension-action', action: action, value: value }, '*'); } catch (e) {} }
          function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
          function outlineItemsHtml(items) {
              if (!items || !items.length) return '<div class="extensionOutlineEmpty">（暂无提纲）</div>';
              return items.map(function(it) {
                  var lv = it.level || 1;
                  var cls = 'extensionOutlineItem lv' + (lv > 3 ? 3 : lv);
                  var style = 'font-family:' + (it.fontFamily || '') + ';' + (it.bold ? 'font-weight:bold;' : '');
                  return '<div class="' + cls + '" data-outline-text="' + escHtml(it.text) + '" style="' + style + '">' + escHtml(it.text) + '</div>';
              }).join('');
          }
          function bindOutlineClicks(container, viewEl) {
              container.querySelectorAll('.extensionOutlineItem').forEach(function(el) {
                  el.onclick = function() {
                      var txt = el.getAttribute('data-outline-text') || '';
                      var ps = viewEl ? viewEl.querySelectorAll('p') : [];
                      for (var i = 0; i < ps.length; i++) {
                          if ((ps[i].textContent || '').replace(/^\s+|\s+$/g, '').indexOf(txt) === 0) { ps[i].scrollIntoView({ block: 'center' }); break; }
                      }
                  };
              });
          }
          function noteOutlineHtml() {
              var notes = state.payload.notes || [];
              var titles = state.payload.titles || [];
              var outlines = state.payload.noteOutlines || [];
              var listHtml = '';
              for (var i = 0; i < 5; i++) {
                  var t = (titles[i] || '').replace(/^\s+|\s+$/g, '') || ('窗口' + (i + 1));
                  listHtml += '<div class="extensionOutlineItem extensionNoteListItem' + (state.note === i ? ' active' : '') + '" data-note-list="' + i + '">' + escHtml(t) + '</div>';
              }
              var olHtml = outlineItemsHtml(outlines[state.note]);
              return '<div class="extensionOutlineTabs">'
                  + '<button class="extensionOutlineTab active" data-otab="list">笔记列表</button>'
                  + '<button class="extensionOutlineTab" data-otab="outline">笔记提纲</button>'
                  + '</div>'
                  + '<div class="extensionOutlinePane extensionNoteList show" data-opane="list">' + listHtml + '</div>'
                  + '<div class="extensionOutlinePane" data-opane="outline">' + olHtml + '</div>';
          }
          function renderNote() {
              noteHeadBtns.style.display = 'flex';
              noteHeadBtns.innerHTML = [1,2,3,4,5].map(function(n) { return '<button class="extensionNoteBtn' + (state.note === n - 1 ? ' active' : '') + '" data-note="' + (n - 1) + '">窗口' + n + '</button>'; }).join('');
              noteHeadBtns.querySelectorAll('[data-note]').forEach(function(b) { b.onclick = function() { state.note = parseInt(b.getAttribute('data-note'), 10); state.outlineTab = 'outline'; state._lastSig = ''; render(true); }; });
              var pane = root.querySelector('#extensionScreenNote');
              var content = (state.payload.notes && state.payload.notes[state.note]) || '';
              pane.innerHTML = '<div class="extensionLayout">'
                  + (state.showOutline ? '<div class="extensionSidebar" id="extensionNoteSidebar">' + noteOutlineHtml() + '</div>' : '')
                  + '<div class="extensionPaneScroll"><div class="extensionNoteView">' + content + '</div></div>'
                  + '</div>';
              var sidebar = pane.querySelector('#extensionNoteSidebar');
              if (sidebar) {
                  sidebar.querySelectorAll('.extensionOutlineTab').forEach(function(b) {
                      b.onclick = function() {
                          var tab = b.getAttribute('data-otab');
                          sidebar.querySelectorAll('.extensionOutlineTab').forEach(function(x) { x.classList.toggle('active', x === b); });
                          sidebar.querySelectorAll('.extensionOutlinePane').forEach(function(pn) { pn.classList.toggle('show', pn.getAttribute('data-opane') === tab); });
                      };
                  });
                  sidebar.querySelectorAll('[data-note-list]').forEach(function(it) {
                      it.onclick = function() { state.note = parseInt(it.getAttribute('data-note-list'), 10); state.outlineTab = 'outline'; state._lastSig = ''; render(true); };
                  });
                  bindOutlineClicks(sidebar.querySelector('[data-opane="outline"]'), pane.querySelector('.extensionNoteView'));
              }
          }
          function renderEditor() {
              noteHeadBtns.style.display = 'none';
              sub.innerHTML = '';
              var pane = root.querySelector('#extensionScreenEditor');
              var textMode = !!state.payload.editorTextMode;
              var content = state.payload.editor || '';
              if (!content || !content.replace(/<[^>]*>/g, '').trim()) {
                  pane.innerHTML = '<div class="extensionEmptyTip">编辑器暂无内容<br>请在主程序“编辑器”模块选择内容后再查看</div>';
                  return;
              }
              pane.innerHTML = '<div class="extensionLayout">'
                  + (state.showOutline ? '<div class="extensionSidebar" id="extensionEditorSidebar">' + outlineItemsHtml(state.payload.editorOutline) + '</div>' : '')
                  + '<div class="extensionPaneScroll"><div class="extensionEditorView' + (textMode ? ' paTextMode' : '') + '">' + content + '</div></div>'
                  + '</div>';
              var sidebar = pane.querySelector('#extensionEditorSidebar');
              if (sidebar) bindOutlineClicks(sidebar, pane.querySelector('.extensionEditorView'));
          }
         function renderLog() {
             noteHeadBtns.style.display = 'none';
             var typeOptions = [['day','日志'],['week','周工作'],['month','月工作'],['quarter','季度工作'],['halfyear','半年工作'],['year','年度工作'],['custom','自定义']];
              var typeSel = '<select class="timeRangeSelect" data-log-type>' + typeOptions.map(function(o) { return '<option value="' + o[0] + '"' + (state.payload.logType === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
             var range = state.payload.logRange || '';
              sub.innerHTML = typeSel
                  + '<button class="timeRangeNavBtn" data-log-action="prev" title="上一时间段">&lt;</button>'
                  + '<span class="timeRangeDisplay extensionLogRange">' + range + '</span>'
                  + '<button class="timeRangeNavBtn" data-log-action="next" title="下一时间段">&gt;</button>'
                  + '<button class="timeRangeNavBtn" data-log-search-toggle="1" title="搜索">🔍</button>'
                  + '<input class="extensionLogSearchInput" data-log-search-input type="text" placeholder="关键字搜索（多个关键字用空格隔开）">'
                  + '<span class="extensionLogModeGroup">'
                  + '<img class="extensionLogModeIcon" src="data/table.ico" data-log-mode="report" title="表格视图" alt="表格视图">'
                  + '<img class="extensionLogModeIcon" src="data/page.ico" data-log-mode="page" title="页面视图" alt="页面视图">'
                  + '<img class="extensionLogModeIcon" src="data/much.ico" data-log-mode="track" title="多维态势图" alt="多维态势图">'
                  + '</span>';
              var pane = root.querySelector('#extensionScreenLog');
              var logModes = state.payload.logModes || {};
              var modeHtml = logModes[state.logMode] != null ? logModes[state.logMode] : (state.payload.log || '');
              pane.innerHTML = '<div class="extensionLogView">' + modeHtml + '</div>';
              if (!pane._subItemContextMenuBlocked) {
                  pane.addEventListener('contextmenu', function(e) {
                      if (e.target.closest && e.target.closest('.pageViewSubItem')) {
                          e.preventDefault();
                          e.stopPropagation();
                      }
                  }, true);
                  pane._subItemContextMenuBlocked = true;
              }
             sub.querySelectorAll('[data-log-type]').forEach(function(s) { s.onchange = function() { sendAction('setType', s.value); }; });
              sub.querySelectorAll('[data-log-action]').forEach(function(b) { b.onclick = function() { sendAction(b.getAttribute('data-log-action')); }; });
              var searchToggle = sub.querySelector('[data-log-search-toggle]');
              var searchInput = sub.querySelector('[data-log-search-input]');
              if (searchInput) {
                  searchInput.value = state.logSearchValue != null ? state.logSearchValue : (state.payload.logSearch || '');
                  searchInput.style.display = state.logSearchOpen ? 'block' : 'none';
                  searchInput.oninput = function() {
                      state.logSearchValue = searchInput.value;
                      state.payload.logSearch = searchInput.value;
                      clearTimeout(state.logSearchTimer);
                      state.logSearchTimer = setTimeout(function() { sendAction('setSearch', state.logSearchValue); }, 450);
                  };
                  searchInput.onkeydown = function(e) { if (e.key === 'Escape') { state.logSearchOpen = false; state.logSearchValue = ''; searchInput.value = ''; state.payload.logSearch = ''; sendAction('setSearch', ''); render(true); } };
              }
              if (searchToggle) searchToggle.onclick = function() {
                  state.logSearchOpen = !state.logSearchOpen;
                  if (!state.logSearchOpen && searchInput) { state.logSearchValue = ''; searchInput.value = ''; state.payload.logSearch = ''; sendAction('setSearch', ''); }
                  render(true);
                  if (state.logSearchOpen) { var input = sub.querySelector('[data-log-search-input]'); if (input) setTimeout(function() { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 0); }
              };
              sub.querySelectorAll('[data-log-mode]').forEach(function(b) { b.onclick = function() { state.logMode = b.getAttribute('data-log-mode'); state._lastSig = ''; render(true); }; });
              sub.querySelectorAll('[data-log-mode]').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-log-mode') === state.logMode); });
         }
           function activePane() { return root.querySelector('.extensionScreenPane.active'); }
           function captureScroll() { var el = activePane(); return el ? el.scrollTop : 0; }
           function restoreScroll(top) { var el = activePane(); if (el && top) el.scrollTop = top; }
           function payloadSignature() {
               var tabs = [];
               for (var i = 0; i < 5; i++) tabs.push((state.payload.notes && state.payload.notes[i]) || '');
               var no = state.payload.noteOutlines || [];
               var nos = no.map(function(a) { return (a || []).map(function(x) { return x.text + x.level; }).join('|'); }).join('#');
               var eo = (state.payload.editorOutline || []).map(function(x) { return x.text + x.level; }).join('|');
                var lm = state.payload.logModes || {};
                return state.payload.editor + '\u0001' + (state.payload.editorTextMode ? '1' : '0') + '\u0001' + eo + '\u0001' + tabs.join('\u0002') + '\u0001' + nos + '\u0001' + (lm.report || '') + '\u0001' + (lm.page || '') + '\u0001' + (lm.track || '') + '\u0001' + state.payload.logType + '\u0001' + state.logMode + '\u0001' + state.payload.logRange + '\u0001' + (state.payload.logSearch || '');
           }
            function render(force) {
                var sig = payloadSignature();
                if (!force && sig === state._lastSig) return;
                if (!force && document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-log-search-input') === '' && state.tab === 'log' && state.logSearchOpen && state.logSearchValue !== (state.payload.logSearch || '')) return;
                state._lastSig = sig;
                var activeSearchInput = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-log-search-input') === '';
                var keep = captureScroll();
                var keepLogSearchFocus = activeSearchInput;
                if (state.tab === 'note') { showPane('extensionScreenNote'); renderNote(); } else { showPane('extensionScreenLog'); renderLog(); }
                root.querySelectorAll('.extensionScreenTab').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-ext-tab') === state.tab); });
                restoreScroll(keep);
                if (keepLogSearchFocus && state.tab === 'log' && state.logSearchOpen) {
                    var input = root.querySelector('[data-log-search-input]');
                    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
                }
            }
           root.querySelectorAll('.extensionScreenTab').forEach(function(b) { b.onclick = function() { state.tab = b.getAttribute('data-ext-tab'); state._lastSig = ''; closeCtxMenu(); render(true); }; });

           var ctxMenu = root.querySelector('#extensionCtxMenu');
           function openCtxMenu(x, y) {
               if (!ctxMenu) return;
               ctxMenu.classList.add('open');
               var w = ctxMenu.offsetWidth, h = ctxMenu.offsetHeight;
               var px = x, py = y;
               if (px + w > window.innerWidth - 6) px = window.innerWidth - w - 6;
               if (py + h > window.innerHeight - 6) py = window.innerHeight - h - 6;
               ctxMenu.style.left = Math.max(6, px) + 'px';
               ctxMenu.style.top = Math.max(6, py) + 'px';
               var outlineItem = ctxMenu.querySelector('[data-ctx="outline"]');
               if (outlineItem) outlineItem.textContent = state.showOutline ? '隐藏提纲' : '显示提纲';
               var compactItem = ctxMenu.querySelector('[data-ctx="compact"]');
               if (compactItem) compactItem.textContent = state.compact ? '打开工具栏' : '收起工具栏';
           }
           function closeCtxMenu() { if (ctxMenu) ctxMenu.classList.remove('open'); }
           root.querySelectorAll('.extensionScreenPane').forEach(function(p) {
               p.addEventListener('contextmenu', function(e) { e.preventDefault(); openCtxMenu(e.clientX, e.clientY); });
           });
           document.addEventListener('mousedown', function(e) { if (ctxMenu && ctxMenu.classList.contains('open') && !e.target.closest('.extensionCtxMenu')) closeCtxMenu(); });
           document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeCtxMenu(); });
           if (ctxMenu) {
               ctxMenu.querySelectorAll('[data-ctx]').forEach(function(item) {
                   item.onclick = function() {
                       var act = item.getAttribute('data-ctx');
                       if (act === 'outline') { state.showOutline = !state.showOutline; state._lastSig = ''; render(true); }
                       else if (act === 'compact') { setCompactMode(!state.compact); }
                       else if (act === 'zoom-in') { state.zoom = Math.min(2, state.zoom + .1); applyZoom(); }
                       else if (act === 'zoom-out') { state.zoom = Math.max(.6, state.zoom - .1); applyZoom(); }
                       else if (act === 'search') { openSearch(); }
                       closeCtxMenu();
                   };
               });
           }
           function applyZoom() { root.querySelectorAll('.extensionScreenPane').forEach(function(x) { x.style.zoom = state.zoom; }); }

           var searchBox = root.querySelector('#extensionSearchBox');
           var searchInput = root.querySelector('#extensionSearchInput');
           var searchCount = root.querySelector('#extensionSearchCount');
           function openSearch() {
               if (!searchBox) return;
               searchBox.classList.add('open');
               if (searchInput) { searchInput.focus(); if (searchInput.value) runSearch(); }
           }
           function closeSearch() { if (searchBox) searchBox.classList.remove('open'); clearSearchHighlight(); }
           function clearSearchHighlight() {
               root.querySelectorAll('.extensionSearchHit, .extensionSearchHitActive').forEach(function(el) {
                   var parent = el.parentNode; if (!parent) return;
                   while (el.firstChild) parent.insertBefore(el.firstChild, el);
                   parent.removeChild(el); parent.normalize();
               });
           }
           function runSearch() {
               var q = searchInput ? searchInput.value.trim() : '';
               clearSearchHighlight();
               state.searchIndex = 0;
               if (!q) { if (searchCount) searchCount.textContent = ''; return; }
               var pane = activePane();
               var scope = pane ? pane.querySelector('.extensionPaneScroll') : null;
               if (!scope) return;
               var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null, false);
               var nodes = [];
               while (walker.nextNode()) {
                   var n = walker.currentNode;
                   if (n.parentNode && n.parentNode.classList && n.parentNode.classList.contains('extensionSearchHit')) continue;
                   if ((n.nodeValue || '').toLowerCase().indexOf(q.toLowerCase()) !== -1) nodes.push(n);
               }
               var hits = [];
               nodes.forEach(function(n) {
                   var text = n.nodeValue, lower = text.toLowerCase(), ql = q.toLowerCase();
                   var frag = document.createDocumentFragment(), idx = 0, pos;
                   while ((pos = lower.indexOf(ql, idx)) !== -1) {
                       if (pos > idx) frag.appendChild(document.createTextNode(text.substring(idx, pos)));
                       var mark = document.createElement('span');
                       mark.className = 'extensionSearchHit';
                       mark.textContent = text.substring(pos, pos + q.length);
                       frag.appendChild(mark); hits.push(mark);
                       idx = pos + q.length;
                   }
                   if (idx < text.length) frag.appendChild(document.createTextNode(text.substring(idx)));
                   n.parentNode.replaceChild(frag, n);
               });
               if (searchCount) searchCount.textContent = hits.length ? ('1/' + hits.length) : '0';
               if (hits.length) highlightHit(hits, 0);
           }
           function highlightHit(hits, i) {
               root.querySelectorAll('.extensionSearchHitActive').forEach(function(el) { el.classList.remove('extensionSearchHitActive'); });
               if (!hits.length) return;
               state.searchIndex = (i + hits.length) % hits.length;
               var el = hits[state.searchIndex];
               el.classList.add('extensionSearchHitActive');
               el.scrollIntoView({ block: 'center' });
               if (searchCount) searchCount.textContent = (state.searchIndex + 1) + '/' + hits.length;
           }
           if (searchBox) {
               if (searchInput) searchInput.addEventListener('input', runSearch);
               if (searchInput) searchInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') { jumpSearch(e.shiftKey ? -1 : 1); } });
               searchBox.querySelectorAll('[data-search]').forEach(function(b) {
                   b.onclick = function() {
                       var a = b.getAttribute('data-search');
                       if (a === 'close') closeSearch();
                       else jumpSearch(a === 'prev' ? -1 : 1);
                   };
               });
           }
           function jumpSearch(dir) {
               var hits = Array.prototype.slice.call(root.querySelectorAll('.extensionSearchHit'));
               if (!hits.length) return;
               highlightHit(hits, state.searchIndex + dir);
           }

         function setContentFullscreen(on) {
             state.contentFullscreen = !!on;
             if (state.contentFullscreen && state.compact) setCompactMode(false);
             var btn = root.querySelector('[data-ext-action="fullscreen"]');
             if (head) head.style.display = state.contentFullscreen ? 'none' : 'flex';
             if (body) body.style.padding = state.contentFullscreen ? '0' : '12px';
             if (btn) btn.setAttribute('title', state.contentFullscreen ? '退出全屏' : '全屏');
         }
         function setCompactMode(on) {
             state.compact = !!on;
             document.body.classList.toggle('extCompact', state.compact);
             if (state.compact && typeof state.contentFullscreen !== 'undefined' && state.contentFullscreen) {
                 setContentFullscreen(false);
             }
         }
         function requestBrowserFullscreen() {
             try {
                 if (!document.fullscreenElement) {
                     var el = document.documentElement;
                     var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
                     if (req) { var p = req.call(el); if (p && p.catch) p.catch(function() {}); }
                 } else {
                     var ex = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
                     if (ex) { var q = ex.call(document); if (q && q.catch) q.catch(function() {}); }
                 }
             } catch (e) {}
         }
         root.querySelectorAll('[data-ext-action]').forEach(function(b) { b.onclick = function() { var act = b.getAttribute('data-ext-action'); if (act === 'zoom-in') state.zoom = Math.min(2, state.zoom + .1); if (act === 'zoom-out') state.zoom = Math.max(.6, state.zoom - .1); if (act === 'fullscreen') { setContentFullscreen(!state.contentFullscreen); requestBrowserFullscreen(); } if (act === 'compact') { setCompactMode(!state.compact); } root.querySelectorAll('.extensionScreenPane').forEach(function(x) { x.style.zoom = state.zoom; }); }; });
         document.addEventListener('fullscreenchange', function() { setContentFullscreen(!!document.fullscreenElement); });
         document.addEventListener('webkitfullscreenchange', function() { setContentFullscreen(!!document.fullscreenElement); });
         document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && state.contentFullscreen) setContentFullscreen(false); });
          window.addEventListener('message', function(e) { if (e.data && e.data.type === 'notepad-extension-content') { var localMode = state.logMode; state.payload = e.data.payload || state.payload; state.logMode = localMode; render(false); } });
         if (window.opener) window.opener.postMessage({ type:'notepad-extension-ready' }, '*');
         render(true);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initExtensionScreen); else setTimeout(initExtensionScreen, 0);
})();
