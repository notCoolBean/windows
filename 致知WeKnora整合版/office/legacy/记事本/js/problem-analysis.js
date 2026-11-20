/* ============================================================
   problem-analysis.js — 问题分析模块
   ============================================================ */

    (function() {
        var LEVEL_ORDER = { 'level-title': 0, 'level-date': 0.5, 'level-author': 0.6, 'level-recipient': 0.7, 'level-secret': 0.8, 'level-attachment': 0.9, 'level-1': 1, 'level-2': 2, 'level-3': 3, 'level-body': 4 };
        var HEADING_LEVELS = { 'level-title': true, 'level-1': true, 'level-2': true, 'level-3': true };
        var FORMAT_STANDARD = { };
        window.FORMAT_STANDARD = FORMAT_STANDARD;
        Object.assign(FORMAT_STANDARD, {
            lineHeight: '1.8', margin: '0',
            levels: {
                'level-title':    { fontFamily:'方正小标宋简体,FZXiaoBiaoSong,SimSun,serif', fontSize:'20px', fontWeight:'', textAlign:'center', textIndent:'0', bg:'' },
                'level-index':    { fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'0', bg:'' },
                'level-date':     { fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'16px', fontWeight:'', textAlign:'center', textIndent:'0', bg:'' },
                'level-author':   { fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'16px', fontWeight:'', textAlign:'center', textIndent:'0', bg:'' },
                'level-recipient':{ fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'0', bg:'' },
                    'level-secret':   { fontFamily:'黑体,SimHei,sans-serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'0', bg:'' },
                'level-attachment': { fontFamily:'仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'2em', bg:'' },
                'level-1':        { fontFamily:'黑体,SimHei,sans-serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'2em', bg:'' },
                'level-2':        { fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'2em', bg:'' },
                'level-3':        { fontFamily:'仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif', fontSize:'16px', fontWeight:'bold', textAlign:'left', textIndent:'2em', bg:'' },
                'level-body':     { fontFamily:'仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'2em', bg:'' },
                'level-remark':   { fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'14px', fontWeight:'', textAlign:'left', textIndent:'0', bg:'' },
                'level-regulation-chapter': { fontFamily:'黑体,SimHei,sans-serif', fontSize:'16px', fontWeight:'', textAlign:'center', textIndent:'0', bg:'' },
                'level-regulation-section': { fontFamily:'楷体_GB2312,楷体,KaiTi,serif', fontSize:'16px', fontWeight:'', textAlign:'center', textIndent:'0', bg:'' }
            },
            inlineStyle: function(lv) {
                var c = this.levels[lv] || this.levels['level-body'];
                var _generic = { serif:1, 'sans-serif':1, monospace:1, cursive:1, fantasy:1, 'system-ui':1 };
                var ff = c.fontFamily.split(',').map(function(f) { var t = f.trim(); return !_generic[t] && t.indexOf("'") === -1 && t.indexOf('"') === -1 ? "'" + t + "'" : t; }).join(',');
                var s = 'font-family:' + ff + ';font-size:' + c.fontSize + ';';
                if (c.fontWeight) s += 'font-weight:' + c.fontWeight + ';';
                else s += 'font-weight:normal;';
                return s;
            },
            paraStyle: function(lv) {
                var c = this.levels[lv] || this.levels['level-body'];
                var s = 'margin:' + this.margin + ';line-height:' + this.lineHeight + ';text-indent:' + c.textIndent + ';text-align:' + c.textAlign + ';';
                s += 'content-visibility:auto;contain:layout style;';
                return s;
            },
            fullStyle: function(lv) {
                return this.paraStyle(lv) + this.inlineStyle(lv);
            }
        });
        var defaultItems = [
            { level: 'level-1', text: '一、问题总览' },
            { level: 'level-2', text: '（一）问题一' },
            { level: 'level-3', text: '1.具体情况' },
            { level: 'level-body', text: '这里是一段正文描述，说明具体情况。' },
            { level: 'level-3', text: '2.影响评估' },
            { level: 'level-body', text: '影响范围和程度分析。' }
        ];
        var items = null;
        try {
            var raw = DataLayer.getRaw('problemAnalysisItems');
            if (raw) items = JSON.parse(raw);
        } catch (e) { items = null; }
        if (!items || !items.length) items = defaultItems.slice();
        var _paHideMarkedAllHidden = false;
        var _paSavedGuideHideState = null;
        (function initHideState() { try { var raw = DataLayer.getRaw('problemAnalysisHideState'); if (raw) { var st = JSON.parse(raw); if (st && typeof st.allHidden === 'boolean') _paHideMarkedAllHidden = st.allHidden; } } catch (e) {} })();
        var collapsedIdx = {};
        var selectedIdx = -1;
        var selectedRange = [];
        var undoStack = [];
        var undoLimit = 10;
        var undoIngnoreNext = false;
        var paMirrorCollapsedIdx = {};
        var paMirrorSelectedIdx = -1;
        var ctxTargetIdx = -1;
        var ctxIsOther = false;
        var _paCtxSavedRange = null;
        var ctxRef = null;              // 参考段右键目标 { hostIdx, refIdx }
        var paRefDragState = null;      // 参考段拖动状态 { hostIdx, refIdx }
        var paRefOpenIdx = -1;          // 主面板展开参考的宿主段落索引
        var paMirrorRefOpenIdx = -1;    // 镜像面板展开参考的宿主段落索引
        var paSelectedRef = null;       // 主面板选中的参考 { hostIdx, refIdx }
        var paMirrorSelectedRef = null; // 镜像面板选中的参考
        document.addEventListener('selectionchange', function() {
            try {
                var s = window.getSelection();
                if (!s || !s.rangeCount) return;
                var r = s.getRangeAt(0);
                if (r.collapsed) return;
                var a = s.anchorNode;
                if (!a) return;
                var el = a.nodeType === 1 ? a : a.parentNode;
                if (!el || !el.closest) return;
                var te = el.closest('.paItemText[contenteditable="true"]');
                if (te) _paCtxSavedRange = r.cloneRange();
            } catch(e) {}
        });
        var editingIdx = -1;
        var previewOn = false;
        var paMirrorVisible = false;
        var paMirrorViewMode = 0;
        var paFilterActive = false;
        var paMirrorFilterActive = false;
        var paMirrorZoomLevel = 1;
        var paMirrorMode = 0; // 0=镜像 1=目录 2=其他
        var paA4Mode = false;
        var paOtherItems = [{text:''}];
        var paOtherFileName = '';
        var paOtherZoomLevel = 1;
        var paOtherCollapsedIdx = {};
        var paOtherMirrorCollapsedIdx = {};
        var paOtherSelectedIdx = -1;
        var paOtherMirrorSelectedIdx = -1;
        var paOtherFilterActive = false;
        var paOtherMirrorFilterActive = false;
        var paTextEditable = true;
        var paOtherDragSrcIdx = -1;
        var paOtherMirrorViewMode = 0;
        var paFilterExpandedIdx = -1;
        var paDragSrcIdx = -1;
        var paCurrentFileName = '';
        var paOpenDirHandle = null;
        var copiedFormat = null;
        var paOpenCachedFiles = [];
        var paOpenCachedFileMap = {};
        var paSaveCachedFiles = [];
        var paSaveCachedFileMap = {};
        var paSaveDirHandle = null;
        function save() {
            try { DataLayer.set('problemAnalysisItems', items) } catch (e) {}
            saveHideState();
            updatePaWordCount();
        }
        function applyBgStyle(el, bg) {
            var map = {
                'red':    { bg: '#ef5350', border: '#c62828' },
                'yellow': { bg: '#fff176', border: '#f9a825' },
                'blue':   { bg: '#42a5f5', border: '#1565c0' },
                'green':  { bg: '#66bb6a', border: '#2e7d32' },
                'purple': { bg: '#ab47bc', border: '#6a1b9a' },
                'orange': { bg: '#ffa726', border: '#e65100' },
                'gray':   { bg: '#bdbdbd', border: '#616161' }
            };
            var c = map[bg];
            if (!c) return;
            el.style.background = c.bg;
            el.style.borderColor = c.border;
        }
        function applyMarksStyle(el, marks) {
            if (!marks) return;
            if (marks.bold === true) el.style.fontWeight = 'bold';
            else if (marks.bold === false) el.style.fontWeight = 'normal';
            if (marks.italic) el.style.fontStyle = 'italic';
            var deco = [];
            if (marks.underline) deco.push('underline');
            if (marks.strike) deco.push('line-through');
            if (deco.length) el.style.textDecoration = deco.join(' ');
            if (marks.color) {
                var cmap = { red: '#c0392b', blue: '#2980b9', black: '#000', gray: '#888' };
                if (cmap[marks.color]) el.style.color = cmap[marks.color];
            }
        }
        function paShowTagDialog(initialText, onResult, opts) {
            var dlg = document.getElementById('paTagDialog');
            var box = dlg ? dlg.querySelector('.paTagDialogBox') : null;
            var input = document.getElementById('paTagDialogInput');
             var ok = document.getElementById('paTagDialogOk');
             var weekAction = document.getElementById('paTagDialogWeekAction');
             var weekDirection = document.getElementById('paTagDialogWeekDirection');
             var cancel = document.getElementById('paTagDialogCancel');
             var closeBtn = document.getElementById('paTagDialogClose');
             var contentLabel = document.getElementById('paTagDialogContentLabel');
             var statusInfo = document.getElementById('paTagDialogStatusInfo');
             var adjustRow = document.getElementById('paTagDialogAdjustRow');
             var adjustToggle = document.getElementById('paTagDialogAdjustToggle');
             var weekHint = document.getElementById('paTagDialogWeekHint');
            var titleEl = dlg ? dlg.querySelector('.paTagDialogTitle') : null;
             if (!dlg || !input || !ok || !cancel) { alert('对话框组件未找到'); return; }
             opts = opts || {};
             dlg.classList.toggle('subItemEditMode', !!opts.subItemEdit);
             if (contentLabel) { contentLabel.style.display = opts.subItemEdit ? 'block' : 'none'; }
             if (statusInfo) {
                 var statusMark = opts.subItemStatus || '';
                 statusInfo.innerHTML = statusMark ? escapeHtml(statusMark) + (statusMark === '√' && opts.subItemTimestamp ? '<span class="subItemTimestamp">' + escapeHtml(opts.subItemTimestamp) + '</span>' : '') : '';
             }
             if (adjustRow) { adjustRow.style.display = opts.subItemEdit && opts.nextWeek ? 'flex' : 'none'; }
             if (adjustToggle) adjustToggle.textContent = '调整';
             if (weekAction) weekAction.style.display = 'none';
             if (weekHint) weekHint.textContent = '将当前分项复制到下周工作';
            var origTitle = titleEl ? titleEl.textContent : '';
             var origOkText = ok.textContent;
             var origWeekActionDisplay = weekAction ? weekAction.style.display : '';
             if (opts.title && titleEl) titleEl.textContent = opts.title;
             if (opts.okText) ok.textContent = opts.okText;
             if (box && titleEl && input && weekAction && ok.parentNode) {
                 box.appendChild(titleEl);
                 if (contentLabel) box.appendChild(contentLabel);
                 box.appendChild(input);
                  if (adjustRow) box.appendChild(adjustRow); else box.appendChild(weekAction);
                 box.appendChild(ok.parentNode);
                 box.style.paddingBottom = '18px';
                 weekAction.style.position = 'static';
                 weekAction.style.left = 'auto';
                 weekAction.style.right = 'auto';
                 weekAction.style.bottom = 'auto';
                 weekAction.style.order = 'initial';
                 ok.parentNode.style.order = 'initial';
             }
             if (weekAction) weekAction.style.display = opts.nextWeek ? 'flex' : 'none';
             if (opts.subItemEdit && weekAction) weekAction.style.display = 'none';
             if (weekDirection) weekDirection.value = 'next';
            input.innerText = initialText || '';
            if (opts.singleLine) input.style.minHeight = '30px'; else input.style.minHeight = '';
            dlg.style.left = Math.max(4, Math.round((window.innerWidth - 400) / 2)) + 'px';
            dlg.style.top = Math.max(4, Math.round((window.innerHeight - 260) / 2)) + 'px';
            dlg.classList.add('show');
            setTimeout(function() {
                input.focus();
                var range = document.createRange();
                range.selectNodeContents(input);
                range.collapse(false);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }, 30);
            var dragOffX = 0, dragOffY = 0;
            function onDragStart(e) {
                var ce = e.changedTouches ? e.changedTouches[0] : e;
                dragOffX = ce.clientX - dlg.offsetLeft;
                dragOffY = ce.clientY - dlg.offsetTop;
                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('mouseup', onDragEnd);
                document.addEventListener('touchmove', onDragMove, { passive: true });
                document.addEventListener('touchend', onDragEnd);
                e.preventDefault();
            }
            function onDragMove(e) {
                var ce = e.changedTouches ? e.changedTouches[0] : e;
                var l = ce.clientX - dragOffX;
                var t = ce.clientY - dragOffY;
                if (l < 4) l = 4; if (t < 4) t = 4;
                if (l + dlg.offsetWidth > window.innerWidth - 4) l = window.innerWidth - dlg.offsetWidth - 4;
                if (t + dlg.offsetHeight > window.innerHeight - 4) t = window.innerHeight - dlg.offsetHeight - 4;
                dlg.style.left = l + 'px';
                dlg.style.top = t + 'px';
            }
            function onDragEnd() {
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd);
                document.removeEventListener('touchmove', onDragMove);
                document.removeEventListener('touchend', onDragEnd);
            }
            if (titleEl) {
                titleEl.addEventListener('mousedown', onDragStart);
                titleEl.addEventListener('touchstart', onDragStart, { passive: true });
            }
             function close(result) {
                dlg.classList.remove('show');
                if (titleEl) {
                    titleEl.removeEventListener('mousedown', onDragStart);
                    titleEl.removeEventListener('touchstart', onDragStart);
                }
                if (titleEl) titleEl.textContent = origTitle;
                 ok.textContent = origOkText;
                 if (weekAction) weekAction.style.display = origWeekActionDisplay;
                 if (adjustRow) adjustRow.style.display = 'none';
                ok.removeEventListener('click', onOk);
                 cancel.removeEventListener('click', onCancel);
                 if (closeBtn) closeBtn.removeEventListener('click', onCancel);
                 if (adjustToggle) adjustToggle.removeEventListener('click', toggleAdjustMode);
                 if (weekAction) weekAction.querySelectorAll('input[name="paTagDialogWeekMode"]').forEach(function(input) { input.removeEventListener('change', updateWeekHint); });
                 if (weekDirection) weekDirection.removeEventListener('change', updateWeekHint);
                 dlg.classList.remove('subItemEditMode');
                 if (contentLabel) contentLabel.style.display = 'none';
                 if (statusInfo) statusInfo.innerHTML = '';
                input.removeEventListener('keydown', onKey);
                input.removeEventListener('paste', onPaste);
                 if (typeof onResult === 'function') onResult(result);
             }
             function toggleAdjustMode() {
                 if (!opts.subItemEdit || !weekAction) return;
                 var open = weekAction.style.display !== 'none';
                 if (open) {
                     weekAction.querySelectorAll('input[name="paTagDialogWeekMode"]').forEach(function(input) { input.checked = false; });
                     weekAction.style.display = 'none';
                     if (adjustToggle) adjustToggle.textContent = '调整';
                 } else {
                     weekAction.style.display = 'flex';
                     if (adjustToggle) adjustToggle.textContent = '取消';
                 }
             }
             function updateWeekHint() {
                 if (!weekHint) return;
                 var checked = weekAction && weekAction.querySelector('input[name="paTagDialogWeekMode"]:checked');
                 var actionText = checked && checked.value === 'move' ? '迁移' : '复制';
                 var weekText = weekDirection && weekDirection.value === 'prev' ? '上周' : '下周';
                 weekHint.textContent = actionText + '到' + weekText + '工作';
             }
            function getValue() {
                var v = input.innerText || '';
                if (opts.singleLine) v = v.replace(/[\r\n]+/g, ' ');
                return v;
            }
             function onOk() {
                 if (opts.subItemEdit && weekAction && weekAction.style.display !== 'none' && !weekAction.querySelector('input[name="paTagDialogWeekMode"]:checked')) {
                     alert('请先勾选迁移或复制');
                     return;
                 }
                 close(getValue());
             }
            function onCancel() { close(null); }
             function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
                if (opts.singleLine && e.key === 'Enter') {
                    e.preventDefault();
                    close(getValue());
             }
             if (opts.nextWeek && weekAction) {
                  weekAction.querySelectorAll('input[name="paTagDialogWeekMode"]').forEach(function(input) {
                      input.checked = false;
                  });
              }
             if (opts.subItemEdit && weekDirection) weekDirection.addEventListener('change', function onWeekDirectionChange() {
                 if (weekHint) weekHint.textContent = '将当前分项复制到' + (weekDirection.value === 'prev' ? '上周' : '下周') + '工作';
             });
            }
            function onPaste(e) {
                if (!opts.singleLine) return;
                e.preventDefault();
                var text = (e.clipboardData || window.clipboardData).getData('text') || '';
                text = text.replace(/[\r\n]+/g, ' ');
                document.execCommand('insertText', false, text);
            }
             ok.addEventListener('click', onOk);
             cancel.addEventListener('click', onCancel);
             if (closeBtn) closeBtn.addEventListener('click', onCancel);
             if (adjustToggle) adjustToggle.addEventListener('click', toggleAdjustMode);
             if (opts.subItemEdit && weekAction) weekAction.querySelectorAll('input[name="paTagDialogWeekMode"]').forEach(function(input) { input.addEventListener('change', updateWeekHint); });
             if (opts.subItemEdit && weekDirection) weekDirection.addEventListener('change', updateWeekHint);
            input.addEventListener('keydown', onKey);
            input.addEventListener('paste', onPaste);
        }
        function paShowTagTooltip(divEl, text) {
            var tip = document.getElementById('paTagTooltip');
            if (!tip || !divEl) return;
            tip.textContent = text;
            tip.classList.add('show');
            var editor = divEl.closest('#problemAnalysisPanel, #problemAnalysisMirror');
            var editorRect = editor ? editor.getBoundingClientRect() : divEl.getBoundingClientRect();
            var divRect = divEl.getBoundingClientRect();
            var gap = Math.round(editorRect.left);
            var maxW = gap > 50 ? gap : Math.max(140, Math.round(divRect.width / 2));
            tip.style.width = maxW + 'px';
            var aboveTop = divRect.top - tip.offsetHeight - 8;
            var belowTop = divRect.bottom + 4;
            var leftPos = editorRect.left - tip.offsetWidth - 10;
            if (leftPos < 4) leftPos = 4;
            var tipRight = leftPos + tip.offsetWidth;
            if (tipRight > divRect.left && aboveTop >= 4) {
                tip.style.left = leftPos + 'px';
                tip.style.top = aboveTop + 'px';
            } else if (tipRight > divRect.left) {
                tip.style.left = leftPos + 'px';
                var bt = belowTop;
                if (bt + tip.offsetHeight > window.innerHeight - 8) bt = window.innerHeight - 8 - tip.offsetHeight;
                if (bt < 4) bt = 4;
                tip.style.top = bt + 'px';
            } else {
                tip.style.left = leftPos + 'px';
                var topPos = divRect.top;
                if (topPos + tip.offsetHeight > window.innerHeight - 8) topPos = window.innerHeight - 8 - tip.offsetHeight;
                if (topPos < 4) topPos = 4;
                tip.style.top = topPos + 'px';
            }
        }
        function paHideTagTooltip() {
            var tip = document.getElementById('paTagTooltip');
            if (tip) tip.classList.remove('show');
        }
        var paTagTooltipDivEl = null;
        function paAttachTagTooltipMouseLeave() {
            if (paTagTooltipDivEl) {
                paTagTooltipDivEl.removeEventListener('mouseleave', paOnTagDivMouseLeave);
                paTagTooltipDivEl = null;
            }
        }
        function paOnTagDivMouseLeave() {
            paHideTagTooltip();
            paAttachTagTooltipMouseLeave();
        }
        function computeHiddenMap(collapsedMap, filterActive) {
            var hidden = {};
            var stack = [];
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (it.kind === 'divider') { stack = []; continue; }
                var order = LEVEL_ORDER[it.level];
                if (order === undefined) order = 4;
                while (stack.length > 0 && order <= stack[stack.length - 1].order) stack.pop();
                if (stack.length > 0) hidden[i] = true;
                if (filterActive && it.level === 'level-body') hidden[i] = true;
                if (collapsedMap[i] && HEADING_LEVELS[it.level]) stack.push({ order: order, idx: i });
            }
            return hidden;
        }
        function computeHidden() {
            return computeHiddenMap(collapsedIdx, paFilterActive);
        }
        function computeMirrorHidden() {
            return computeHiddenMap(paMirrorCollapsedIdx, paMirrorFilterActive);
        }
        function computeOtherMirrorHidden() {
            return computeHiddenMapFrom(paOtherMirrorCollapsedIdx, paOtherMirrorFilterActive, paOtherItems);
        }
        function computeHiddenMapFrom(collapsedMap, filterActive, sourceItems) {
            var hidden = {};
            var stack = [];
            for (var i = 0; i < sourceItems.length; i++) {
                var it = sourceItems[i];
                if (it.kind === 'divider') { stack = []; continue; }
                var order = LEVEL_ORDER[it.level];
                if (order === undefined) order = 4;
                while (stack.length > 0 && order <= stack[stack.length - 1].order) stack.pop();
                if (stack.length > 0) hidden[i] = true;
                if (filterActive && it.level === 'level-body') hidden[i] = true;
                if (collapsedMap[i] && HEADING_LEVELS[it.level]) stack.push({ order: order, idx: i });
            }
            return hidden;
        }
        function render() {
            var body = document.getElementById('paBody');
            if (!body) return;
            paHideTagTooltip();
            if (paViewMode === 0) {
                var overlay = document.getElementById('paPreviewOverlay');
                var editor = document.getElementById('paPreviewEditor');
                if (overlay && editor) {
                    body.className = '';
                    body.style.display = 'none';
                    _saveMergeState();
                    editor.innerHTML = buildPreviewHtml();
                    overlay.classList.add('show');
                    editor.contentEditable = 'true';
                    if (!editor._wordCountInit) {
                        editor._wordCountInit = true;
                        editor.addEventListener('input', updatePreviewWordCount);
                        editor.addEventListener('mouseup', updatePreviewWordCount);
                        editor.addEventListener('keyup', updatePreviewWordCount);
                    }
                    if (!editor._mirrorSyncInit) {
                        editor._mirrorSyncInit = true;
                        editor.addEventListener('input', function() {
                            if (paMirrorVisible && paMirrorMode === 0 && paMirrorViewMode === 1) {
                                var target = document.getElementById('paMirrorPreviewEditor');
                                if (target && target !== document.activeElement && !target._mirrorSyncing) {
                                    target._mirrorSyncing = true;
                                    target.innerHTML = this.innerHTML;
                                    target._mirrorSyncing = false;
                                }
                            }
                        });
                    }
                    updatePreviewWordCount();
                    if (paMirrorVisible && paMirrorMode === 1) {
                        paTextEditable = false;
                    } else {
                        paTextEditable = true;
                    }
                } else {
                    body.className = 'paTextMode';
                    body.innerHTML = buildPreviewHtml();
                }
            } else {
                body.className = '';
                body.style.display = '';
                var overlay = document.getElementById('paPreviewOverlay');
                if (overlay) overlay.classList.remove('show');
                body.innerHTML = '';
                var hidden = computeHidden();
                for (var i = 0; i < items.length; i++) {
                    if (hidden[i]) continue;
                    if (items[i].paHidden && !_paHideMarkedAllHidden) continue;
                    body.appendChild(buildItemEl(i));
                }
            }
            renderMirror();
            paRefreshRefs();
            if (paMirrorMode === 1) paRenderOutline();
            applyPaZoom();
            applyPaMirrorZoom();
            _updateHideBtnState();
        }
        function renderMirror() {
            var body = document.getElementById('paMirrorBody');
            if (!body) return;
            body.innerHTML = '';
            if (!paMirrorVisible) return;
            if (paMirrorMode === 1 || paMirrorMode === 2) return;
            var hidden = computeMirrorHidden();
            for (var i = 0; i < items.length; i++) {
                if (hidden[i]) continue;
                body.appendChild(buildMirrorItemEl(i));
            }
            syncMirrorPreviewFromItems();
        }
        function renderOtherMirror() {
            var body = document.getElementById('paMirrorBody');
            if (!body) return;
            body.innerHTML = '';
            if (!paMirrorVisible) return;
            var hidden = computeOtherMirrorHidden();
            for (var i = 0; i < paOtherItems.length; i++) {
                if (hidden[i]) continue;
                body.appendChild(buildOtherMirrorItemEl(i));
            }
            syncOtherMirrorPreviewFromItems();
        }
        function paRenderOutline() {
            var body = document.getElementById('paMirrorOutlineBody');
            if (!body) return;
            body.innerHTML = '';
            if (!paMirrorVisible) return;
            var mirrorBody = document.getElementById('paMirrorBody');
            if (mirrorBody) { mirrorBody.innerHTML = ''; mirrorBody.style.display = 'none'; }
            body.setAttribute('contenteditable', 'false');
            body.classList.add('paOutlineActive');
            var sel = selectedIdx;
            var itemsLocal = items;
            for (var idx = 0; idx < itemsLocal.length; idx++) {
                var it = itemsLocal[idx];
                if (it.kind === 'divider') continue;
                if (it.level !== 'level-1' && it.level !== 'level-2' && it.level !== 'level-3') continue;
                var div = document.createElement('div');
                div.className = 'paItem ' + it.level;
                if (idx === sel) div.classList.add('selected');
                div.style.cursor = 'pointer';
                div.style.marginLeft = ({'level-1':0,'level-2':12,'level-3':24})[it.level] || 0;
                var text = document.createElement('div');
                text.className = 'paItemText';
                var tmpDiv = document.createElement('div');
                tmpDiv.innerHTML = it.text || '';
                text.textContent = tmpDiv.textContent || '(无标题)';
                div.appendChild(text);
                (function(idx2) {
                    div.addEventListener('click', function() {
                        function _clearOutlineTarget(el) {
                            el.style.textDecoration = '';
                            el.style.borderBottom = '';
                            el.style.color = '';
                            el.classList.remove('paOutlineTarget');
                        }
                        function _setOutlineTarget(el, level) {
                            var levelStyles = {
                                'level-1': '2px solid #e74c3c',
                                'level-2': '2px solid #a5d6a7',
                                'level-3': '2px solid #f1c40f'
                            };
                            el.style.borderBottom = levelStyles[level] || '2px solid #a5d6a7';
                            el.style.color = '#000';
                            el.classList.add('paOutlineTarget');
                        }
                        collapsedIdx[idx2] = false;
                        selectedIdx = idx2;
                        if (paViewMode === 0) {
                            var overlay2 = document.getElementById('paPreviewOverlay');
                            var editor2 = document.getElementById('paPreviewEditor');
                            if (overlay2 && overlay2.classList.contains('show') && editor2) {
                                syncPreviewBackToItems(editor2, false);
                            }
                        }
                        render();
                        var headingText = items[idx2] ? items[idx2].text : '';
                        if (!headingText) return;
                        var d = document.createElement('div');
                        d.innerHTML = headingText;
                        var plainText = (d.textContent || '').trim().replace(/\s+/g, '');
                        if (!plainText) return;
                        var targetBody = document.getElementById('paBody');
                        if (!targetBody) return;
                        var prev = targetBody.querySelector('.paOutlineTarget');
                        if (prev) _clearOutlineTarget(prev);
                        if (paViewMode === 0) {
                            var pe = document.getElementById('paPreviewEditor');
                            if (pe) {
                                paTextEditable = false;
                                pe.blur();
                                var prev = pe.querySelector('.paOutlineTarget');
                                if (prev) _clearOutlineTarget(prev);
                                var allP = pe.querySelectorAll('p');
                                for (var si = 0; si < allP.length; si++) {
                                    var pText = allP[si].textContent.replace(/\s+/g, '');
                                    if (pText.indexOf(plainText) >= 0) {
                                        var spans = allP[si].querySelectorAll('span[data-level]');
                                        var titleSpan = null;
                                        for (var ti = 0; ti < spans.length; ti++) {
                                            var st = spans[ti].textContent.replace(/\s+/g, '');
                                            if (st.indexOf(plainText) >= 0 || plainText.indexOf(st) >= 0) {
                                                titleSpan = spans[ti]; break;
                                            }
                                        }
                                        if (!titleSpan) titleSpan = spans[0] || null;
                                        if (titleSpan) {
                                            titleSpan.style.textDecoration = 'underline';
                                            titleSpan.style.textUnderlineOffset = '3px';
                                            _setOutlineTarget(titleSpan, items[idx2] ? items[idx2].level : '');
                                        }
                                        allP[si].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        break;
                                    }
                                }
                            }
                        } else {
                            var prev = document.getElementById('paPreviewEditor');
                            if (prev) {
                                var prevTarget = prev.querySelector('.paOutlineTarget');
                                if (prevTarget) _clearOutlineTarget(prevTarget);
                            }
                            var itemDivs = targetBody.querySelectorAll('.paItem');
                            for (var si = 0; si < itemDivs.length; si++) {
                                var textEl = itemDivs[si].querySelector('.paItemText');
                                if (textEl && (textEl.textContent.indexOf(plainText) >= 0 || plainText.indexOf(textEl.textContent) >= 0)) {
                                    _setOutlineTarget(itemDivs[si], items[idx2] ? items[idx2].level : '');
                                    itemDivs[si].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    break;
                                }
                            }
                        }
                    });
                    div.addEventListener('contextmenu', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        document.getElementById('paOutlineCtxMenu').classList.add('show');
                        var ox = e.clientX, oy = e.clientY;
                        var om = document.getElementById('paOutlineCtxMenu');
                        om.style.left = '0px'; om.style.top = '0px';
                        var orw = om.offsetWidth, orh = om.offsetHeight;
                        if (ox + orw > window.innerWidth - 8) ox = window.innerWidth - orw - 8;
                        if (oy + orh > window.innerHeight - 8) oy = window.innerHeight - orh - 8;
                        if (ox < 4) ox = 4; if (oy < 4) oy = 4;
                        om.style.left = ox + 'px'; om.style.top = oy + 'px';
                        om._outlineIdx = idx2;
                    });
                })(idx);
                body.appendChild(div);
            }
        }
        document.addEventListener('click', function(ev) {
            var om = document.getElementById('paOutlineCtxMenu');
            if (om && om.classList.contains('show') && !ev.target.closest('#paOutlineCtxMenu')) {
                om.classList.remove('show');
                delete om._outlineIdx;
            }
        });
        document.getElementById('paOutlineCtxMenu').addEventListener('click', function(ev) {
            var item = ev.target.closest('.paCtxItem');
            if (!item) return;
            var action = item.getAttribute('data-outline-action');
            if (action === 'edit') {
                var idx = this._outlineIdx;
                this.classList.remove('show');
                if (idx === undefined || idx < 0 || idx >= items.length) return;
                var it = items[idx];
                if (!it || it.kind === 'divider') return;
                paShowTagDialog(it.text || '', function(val) {
                    if (val === null) return;
                    pushUndo();
                    it.text = val;
                    save();
                    render();
                    paRenderOutline();
                }, { title: '编辑提纲条目', singleLine: true, okText: '确定' });
            } else if (action === 'tech-stats') {
                var idx = this._outlineIdx;
                this.classList.remove('show');
                if (idx === undefined || idx < 0 || idx >= items.length) return;
                var it = items[idx];
                if (!it || it.kind === 'divider') return;
                var headingLevels = ['level-title','level-date','level-author','level-recipient','level-1','level-2','level-3'];
                if (headingLevels.indexOf(it.level) === -1) return;
                var stats = paCalcTechStats(idx, items);
                var popup = document.getElementById('paTechPopup');
                popup.textContent = '共' + stats.chars + '字，' + stats.lines + '行，' + stats.pages.toFixed(1) + '页';
                var om = document.getElementById('paOutlineCtxMenu');
                var mx = parseInt(om.style.left) || 0;
                var my = parseInt(om.style.top) || 0;
                popup.style.left = (mx + om.offsetWidth + 8) + 'px';
                popup.style.top = my + 'px';
                popup.classList.add('show');
                setTimeout(function() {
                    document.addEventListener('click', function paTechClose(e) {
                        if (!e.target.closest('#paTechPopup') && !e.target.closest('#paOutlineCtxMenu')) {
                            popup.classList.remove('show');
                            document.removeEventListener('click', paTechClose);
                        }
                    });
                }, 0);
            }
        });
        window.paMirrorOpen = function() {
            if (paMirrorMode === 2) {
                var input = document.createElement('input');
                input.type = 'file';
                input.accept = '.js,.json,.txt';
                input.addEventListener('change', function(e) {
                    var file = e.target.files[0];
                    if (!file) return;
                    var reader = new FileReader();
                    reader.onload = function(ev) {
                        try {
                            var data = JSON.parse(ev.target.result);
                            if (Array.isArray(data)) {
                                paOtherItems = data;
                                paOtherCollapsedIdx = {};
                                paOtherMirrorCollapsedIdx = {};
                                paOtherMirrorFilterActive = false;
                                paOtherMirrorSelectedIdx = -1;
                            } else {
                                paOtherItems = [{text: ev.target.result}];
                            }
                        } catch (err) {
                            paOtherItems = [{text: ev.target.result}];
                        }
                        paOtherFileName = file.name;
                        renderOtherMirror();
                    };
                    reader.readAsText(file);
                });
                input.click();
            } else if (paMirrorMode === 1) {
                paOpen();
            }
        };
        window.paMirrorSave = function() {
            if (paMirrorMode === 2) {
                var content = JSON.stringify(paOtherItems, null, 2);
                var title = paOtherFileName || 'untitled';
                var now = new Date();
                var ds = now.getFullYear() + ('0'+(now.getMonth()+1)).slice(-2) + ('0'+now.getDate()).slice(-2);
                var ts = ('0'+now.getHours()).slice(-2) + ('0'+now.getMinutes()).slice(-2);
                var defaultName = ds + '-' + ts + ' ' + title.replace(/\.\w+$/, '') + '.js';
                if (window.showSaveFilePicker) {
                    try {
                        var opts = { suggestedName: defaultName, types: [{ accept: {'text/javascript':['.js','.json','.txt']} }] };
                        window.showSaveFilePicker(opts).then(function(handle) {
                            handle.createWritable().then(function(writable) {
                                writable.write(content).then(function() { writable.close(); });
                            });
                        });
                    } catch (err) {}
                } else {
                    var a = document.createElement('a');
                    a.href = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(content);
                    a.download = defaultName;
                    a.click();
                }
            } else if (paMirrorMode === 1) {
                paSave();
            }
        };
        function paOtherSyncItems() {
            var editor = document.getElementById('paOtherEditor');
            if (!editor) return;
            var text = editor.textContent || '';
            var lines = text.split('\n').filter(function(l){return l.length > 0;});
            paOtherItems = lines.length ? lines.map(function(l){return {text:l};}) : [{text:''}];
        }
        window.paOtherPasteOverwrite = function() {
            var editor = document.getElementById('paOtherEditor');
            if (!editor) return;
            navigator.clipboard.readText().then(function(txt) {
                if (!txt) { showToast('剪贴板为空'); return; }
                if (!confirm('粘入将替换当前内容，是否继续？')) return;
                paOtherItems = [{text: txt}];
                editor.textContent = txt;
                showToast('已粘入');
            }).catch(function(){ showToast('无法读取剪贴板'); });
        };
        window.paOtherPasteAppend = function() {
            var editor = document.getElementById('paOtherEditor');
            if (!editor) return;
            navigator.clipboard.readText().then(function(txt) {
                if (!txt) { showToast('剪贴板为空'); return; }
                paOtherSyncItems();
                var existing = editor.textContent || '';
                editor.textContent = existing + (existing ? '\n' : '') + txt;
                showToast('已追加');
            }).catch(function(){ showToast('无法读取剪贴板'); });
        };
        window.paOtherClear = function() {
            if (!confirm('将清空当前编辑器内容，是否继续？')) return;
            var editor = document.getElementById('paOtherEditor');
            if (editor) { editor.textContent = ''; }
            paOtherItems = [{text:''}];
            paOtherFileName = '';
            showToast('已清空');
        };
        window.paOtherExtract = function() {
            var editor = document.getElementById('paOtherEditor');
            if (!editor) return;
            var text = editor.textContent || '';
            if (!text.trim()) { showToast('内容为空'); return; }
            var lines = text.split('\n').filter(function(l){return l.trim().length > 0;});
            var output = lines.join('\n');
            var ta = document.createElement('textarea');
            ta.value = output;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('已提取并复制');
        };
        window.paOtherCopy = function() {
            var editor = document.getElementById('paOtherEditor');
            if (!editor) return;
            var text = editor.textContent || '';
            if (!text.trim()) { showToast('内容为空'); return; }
            navigator.clipboard.writeText(text).then(function(){ showToast('已复制'); });
        };
        window.paOtherExport = function() {
            var editor = document.getElementById('paOtherEditor');
            if (!editor) return;
            var text = editor.textContent || '';
            if (!text.trim()) { showToast('内容为空'); return; }
            var blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = (paOtherFileName || 'other') + '.txt';
            a.click();
        };
        window.paOtherZoomIn = function() {
            var editor = document.getElementById('paOtherEditor');
            if (!editor) return;
            paOtherZoomLevel = Math.min(paOtherZoomLevel + 0.1, 2);
            editor.style.zoom = paOtherZoomLevel;
        };
        window.paOtherZoomOut = function() {
            var editor = document.getElementById('paOtherEditor');
            if (!editor) return;
            paOtherZoomLevel = Math.max(paOtherZoomLevel - 0.1, 0.5);
            editor.style.zoom = paOtherZoomLevel;
        };
        // ===== 参考段落 =====
        function paRefsOf(it) {
            if (!it || !Array.isArray(it.refs)) return [];
            return it.refs;
        }
        function _buildRefItemEl(hostIdx, refIdx, isMirror) {
            var host = items[hostIdx];
            var ref = host && Array.isArray(host.refs) ? host.refs[refIdx] : null;
            if (!ref) return null;
            var div = document.createElement('div');
            var lvl = ref.level || 'level-body';
            div.className = 'paRefItem ' + lvl;
            div.dataset.hostIdx = String(hostIdx);
            div.dataset.refIdx = String(refIdx);
            var selRef = isMirror ? paMirrorSelectedRef : paSelectedRef;
            if (selRef && selRef.hostIdx === hostIdx && selRef.refIdx === refIdx) div.classList.add('selected');
            if (ref.bg) applyBgStyle(div, ref.bg);
            var textWrap = document.createElement('div');
            textWrap.className = 'paRefItemText';
            var content = ref.text || '';
            if (lvl === 'level-body') content = paFormatParens(content);
            textWrap.innerHTML = content;
            applyMarksStyle(textWrap, ref.marks);
            if (ref.fontFamily) textWrap.style.fontFamily = ref.fontFamily;
            if (ref.fontSize) textWrap.style.fontSize = ref.fontSize;
            div.appendChild(textWrap);
            div.addEventListener('click', function(e) {
                e.stopPropagation();
                if (div.classList.contains('editing')) return;
                if (isMirror) paMirrorSelectedRef = { hostIdx: hostIdx, refIdx: refIdx };
                else paSelectedRef = { hostIdx: hostIdx, refIdx: refIdx };
                var group = div.parentNode;
                if (group) {
                    var sibs = group.querySelectorAll('.paRefItem');
                    for (var si = 0; si < sibs.length; si++) sibs[si].classList.remove('selected');
                }
                div.classList.add('selected');
            });
            div.addEventListener('dblclick', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (div.classList.contains('editing')) return;
                enterRefEdit(div, hostIdx, refIdx, isMirror);
            });
            div.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                ctxTargetIdx = hostIdx;
                ctxIsOther = isMirror;
                ctxRef = { hostIdx: hostIdx, refIdx: refIdx };
                if (isMirror) paMirrorSelectedRef = { hostIdx: hostIdx, refIdx: refIdx };
                else paSelectedRef = { hostIdx: hostIdx, refIdx: refIdx };
                showContextMenu(e.clientX, e.clientY, ref.level || 'level-body');
            });
            // ===== 参考段自身可拖动：组内排序或跨段落迁移 =====
            div.setAttribute('draggable', 'true');
            div.addEventListener('dragstart', function(e) {
                if (div.classList.contains('editing')) { e.preventDefault(); return; }
                paRefDragState = { hostIdx: hostIdx, refIdx: refIdx };
                div.classList.add('paRefDragging');
                try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'paref'); } catch (err) {}
            });
            div.addEventListener('dragend', function() {
                div.classList.remove('paRefDragging');
                clearRefDragOver();
                paRefDragState = null;
            });
            div.addEventListener('dragover', function(e) {
                if (!paRefDragState) return;
                e.preventDefault();
                e.stopPropagation();
                try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
                var rect = div.getBoundingClientRect();
                var above = (e.clientY - rect.top) < rect.height / 2;
                clearRefDragOver();
                div.classList.add(above ? 'paRefDropBefore' : 'paRefDropAfter');
            });
            div.addEventListener('dragleave', function() {
                div.classList.remove('paRefDropBefore', 'paRefDropAfter');
            });
            div.addEventListener('drop', function(e) {
                if (!paRefDragState) return;
                e.preventDefault();
                e.stopPropagation();
                var rect = div.getBoundingClientRect();
                var above = (e.clientY - rect.top) < rect.height / 2;
                moveRefTo(paRefDragState.hostIdx, paRefDragState.refIdx, hostIdx, refIdx, above);
                paRefDragState = null;
                clearRefDragOver();
            });
            return div;
        }
        function clearRefDragOver() {
            var els = document.querySelectorAll('.paRefItem');
            for (var i = 0; i < els.length; i++) {
                els[i].classList.remove('paRefDropBefore', 'paRefDropAfter', 'paRefDragging');
            }
        }
        // 把参考段从 (fromHost) 移动到 (toHost) 的目标参考段之前/之后；toRefIdx 为 -1 表示追加为最后一个。
        function moveRefTo(fromHost, fromRef, toHost, toRef, before) {
            if (fromHost < 0 || fromHost >= items.length) return;
            var srcHost = items[fromHost];
            if (!srcHost || !Array.isArray(srcHost.refs) || !srcHost.refs[fromRef]) return;
            if (toHost < 0 || toHost >= items.length) return;
            var dstHost = items[toHost];
            if (!dstHost || dstHost.kind === 'divider') return;
            pushUndo();
            var moved = srcHost.refs[fromRef];
            // 同宿主相邻位置无变化时直接返回
            var sameHost = (fromHost === toHost);
            srcHost.refs.splice(fromRef, 1);
            if (!srcHost.refs.length) delete srcHost.refs;
            if (!Array.isArray(dstHost.refs)) dstHost.refs = [];
            var insertAt;
            if (toRef < 0) {
                insertAt = dstHost.refs.length;
            } else {
                insertAt = toRef + (before ? 0 : 1);
                if (sameHost && fromRef < insertAt) insertAt--;
            }
            if (insertAt < 0) insertAt = 0;
            if (insertAt > dstHost.refs.length) insertAt = dstHost.refs.length;
            dstHost.refs.splice(insertAt, 0, moved);
            // 展开目标宿主以便看到结果
            if (!paMirrorVisible) paRefOpenIdx = toHost;
            save();
            render();
        }
        // 把参考段追加到某个宿主段落末尾（跨段落拖到普通段落上时使用）。
        function moveRefToHostEnd(fromHost, fromRef, toHost) {
            if (fromHost < 0 || fromHost >= items.length) return;
            var srcHost = items[fromHost];
            if (!srcHost || !Array.isArray(srcHost.refs) || !srcHost.refs[fromRef]) return;
            if (toHost < 0 || toHost >= items.length) return;
            var dstHost = items[toHost];
            if (!dstHost || dstHost.kind === 'divider') return;
            if (fromHost === toHost) return;
            pushUndo();
            var moved = srcHost.refs.splice(fromRef, 1)[0];
            if (!srcHost.refs.length) delete srcHost.refs;
            if (!Array.isArray(dstHost.refs)) dstHost.refs = [];
            dstHost.refs.push(moved);
            if (!paMirrorVisible) paRefOpenIdx = toHost;
            save();
            render();
        }
        // 在宿主段落下方插入参考段落（默认隐藏，展开时显示）。
        function paRefreshRefs() {
            var bodies = [
                { body: document.getElementById('paBody'), isMirror: false, openIdx: paRefOpenIdx },
                { body: document.getElementById('paMirrorBody'), isMirror: true, openIdx: paMirrorRefOpenIdx }
            ];
            for (var bi = 0; bi < bodies.length; bi++) {
                var body = bodies[bi].body;
                if (!body) continue;
                var openIdx = bodies[bi].openIdx;
                var divs = body.querySelectorAll('.paItem');
                for (var di = 0; di < divs.length; di++) {
                    var hostIdx = parseInt(divs[di].dataset.idx, 10);
                    var it = items[hostIdx];
                    var refs = paRefsOf(it);
                    // 同步宿主三角标记
                    divs[di].classList.toggle('hasRef', refs.length > 0);
                    divs[di].classList.toggle('expanded', refs.length > 0 && openIdx === hostIdx);
                    var existing = divs[di].nextElementSibling;
                    // 移除旧的参考组
                    while (existing && existing.classList && existing.classList.contains('paRefGroup')) {
                        var nxt = existing.nextElementSibling;
                        existing.parentNode.removeChild(existing);
                        existing = nxt;
                    }
                    if (!refs.length || openIdx !== hostIdx) continue;
                    var group = document.createElement('div');
                    group.className = 'paRefGroup';
                    for (var ri = 0; ri < refs.length; ri++) {
                        var refEl = _buildRefItemEl(hostIdx, ri, bodies[bi].isMirror);
                        if (refEl) group.appendChild(refEl);
                    }
                    divs[di].parentNode.insertBefore(group, divs[di].nextSibling);
                }
            }
        }
        function paToggleRefs(hostIdx, isMirror) {
            if (isMirror) paMirrorRefOpenIdx = (paMirrorRefOpenIdx === hostIdx) ? -1 : hostIdx;
            else paRefOpenIdx = (paRefOpenIdx === hostIdx) ? -1 : hostIdx;
            paRefreshRefs();
        }
        function paCloseRefs() {
            if (paRefOpenIdx === -1 && paMirrorRefOpenIdx === -1) return;
            paRefOpenIdx = -1;
            paMirrorRefOpenIdx = -1;
            paRefreshRefs();
        }
        function enterRefEdit(div, hostIdx, refIdx, isMirror) {
            var host = items[hostIdx];
            if (!host || !Array.isArray(host.refs) || !host.refs[refIdx]) return;
            div.classList.add('editing');
            var textWrap = div.querySelector('.paRefItemText');
            if (!textWrap) return;
            textWrap.setAttribute('contenteditable', 'true');
            textWrap.focus();
            var range = document.createRange();
            range.selectNodeContents(textWrap);
            range.collapse(false);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            var finished = false;
            function commit() {
                var txt = (textWrap.innerText || '').replace(/\r?\n$/, '');
                var html = textWrap.innerHTML;
                if (html !== txt && /<[a-zA-Z]/.test(html)) host.refs[refIdx].text = html;
                else host.refs[refIdx].text = txt;
            }
            function finish() {
                if (finished) return;
                finished = true;
                textWrap.removeEventListener('blur', finish);
                textWrap.removeEventListener('keydown', onKey);
                textWrap.removeAttribute('contenteditable');
                commit();
                // 清空内容的参考段直接删除
                if (!(host.refs[refIdx].text || '').replace(/\s/g, '')) host.refs.splice(refIdx, 1);
                save();
                render();
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commit();
                    var cur = host.refs[refIdx].text || '';
                    if (!cur.replace(/\s/g, '')) { finish(); return; }
                    // 在当前参考段之后插入一个新的空参考段并继续编辑
                    var newRef = { level: 'level-body', text: '' };
                    host.refs.splice(refIdx + 1, 0, newRef);
                    save();
                    render();
                    setTimeout(function() {
                        var body = document.getElementById('paBody');
                        var els = body ? body.querySelectorAll('.paRefItem[data-host-idx="' + hostIdx + '"][data-ref-idx="' + (refIdx + 1) + '"]') : [];
                        if (els && els[0]) enterRefEdit(els[0], hostIdx, refIdx + 1, false);
                    }, 0);
                }
            }
            textWrap.addEventListener('blur', finish);
            textWrap.addEventListener('keydown', onKey);
        }

        function buildItemEl(idx) {
            var it = items[idx];
            if (it.kind === 'divider') {
                var hr = document.createElement('div');
                hr.className = 'paItem paDivider';
                hr.dataset.idx = String(idx);
                hr.addEventListener('click', function() { paCloseRefs(); });
                hr.addEventListener('contextmenu', function(e) {
                    e.preventDefault(); e.stopPropagation();
                    ctxTargetIdx = idx; ctxIsOther = false;
                    showContextMenu(e.clientX, e.clientY, 'divider');
                });
                hr.addEventListener('dragover', function(e) {
                    if (paDragSrcIdx < 0) return;
                    e.preventDefault();
                    try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
                    var rect = hr.getBoundingClientRect();
                    var above = (e.clientY - rect.top) < rect.height / 2;
                    clearDragOver();
                    hr.classList.add(above ? 'drop-above' : 'drop-below');
                });
                hr.addEventListener('dragleave', function() {
                    hr.classList.remove('drop-above');
                    hr.classList.remove('drop-below');
                });
                hr.addEventListener('drop', function(e) {
                    e.preventDefault();
                    if (paDragSrcIdx < 0) { clearDragOver(); return; }
                    var rect = hr.getBoundingClientRect();
                    var above = (e.clientY - rect.top) < rect.height / 2;
                    var targetIdx = idx + (above ? 0 : 1);
                    performDragMove(paDragSrcIdx, targetIdx);
                    paDragSrcIdx = -1;
                    clearDragOver();
                });
                return hr;
            }
            var level = it.level || 'level-body';
            var div = document.createElement('div');
            div.className = 'paItem ' + level;
            div.dataset.idx = String(idx);
            if (selectedIdx === idx) div.classList.add('selected');
            if (it.noBreakAfter) div.classList.add('paMergeNext');
            if (it.noBreakBefore) div.classList.add('paMergePrev');
            if (it.bg) applyBgStyle(div, it.bg);
            if (it.paHidden) div.classList.add('paItemPaHidden');
            if (it.tag) {
                div.classList.add('has-tag');
                var tagIcon = document.createElement('img');
                tagIcon.src = 'data/mark.ico';
                tagIcon.className = 'paTagIcon';
                tagIcon.title = '点击查看标签';
                (function(tagText, iconEl, hostEl) {
                    iconEl.addEventListener('click', function(ev) {
                        if (hostEl.classList.contains('editing')) return;
                        ev.stopPropagation();
                        ev.preventDefault();
                        paShowTagTooltip(hostEl, tagText);
                        paAttachTagTooltipMouseLeave();
                        paTagTooltipDivEl = iconEl;
                        iconEl.addEventListener('mouseleave', paOnTagDivMouseLeave);
                    });
                })(it.tag, tagIcon, div);
                div.appendChild(tagIcon);
            }
            var _refs = paRefsOf(it);
            if (_refs.length) {
                div.classList.add('hasRef');
                var refIcon = document.createElement('span');
                refIcon.className = 'paRefIcon';
                refIcon.title = '点击展开/收起参考内容';
                (function(hostIdx, hostDiv) {
                    refIcon.addEventListener('click', function(ev) {
                        ev.stopPropagation();
                        ev.preventDefault();
                        paToggleRefs(hostIdx, !!(hostDiv.closest && hostDiv.closest('#paMirrorBody')));
                    });
                })(idx, div);
                div.appendChild(refIcon);
            }
            var textWrap = document.createElement('div');
            textWrap.className = 'paItemText';
            var content = it.text || '';
            if (level === 'level-body') content = paFormatParens(content);
            if (level === 'level-body' && /<br\s*\/?>/i.test(content)) {
                var _firstIndent = it.noBreakBefore ? '0' : '2em';
                var _restIndent = '2em';
                content = '<span style="display:block;text-indent:' + _firstIndent + ';">' + content.replace(/<br\s*\/?>/gi, '</span><span style="display:block;text-indent:' + _restIndent + ';">') + '</span>';
            }
            textWrap.innerHTML = content;
            applyMarksStyle(textWrap, it.marks);
            if (it.fontFamily) textWrap.style.fontFamily = it.fontFamily;
            if (it.fontSize) textWrap.style.fontSize = it.fontSize;
            if (it.highlight) {
                var hlMap = { yellow:'#fff176', blue:'#42a5f5', red:'#ef5350', green:'#66bb6a', purple:'#ab47bc' };
                textWrap.innerHTML = '<span style="background:' + (hlMap[it.highlight] || '#fff176') + '">' + textWrap.innerHTML + '</span>';
            }
            div.appendChild(textWrap);
            if (it.collapsed) {
                div.classList.add('collapsed');
                var expIcon = document.createElement('span');
                expIcon.className = 'paExpandIcon';
                expIcon.textContent = '…';
                expIcon.title = '展开';
                (function(itemIdx) {
                    expIcon.addEventListener('click', function(ev) {
                        ev.stopPropagation();
                        var src = ctxIsOther ? paOtherItems : items;
                        if (src[itemIdx]) { delete src[itemIdx].collapsed; save(); render(); }
                    });
                })(idx);
                div.appendChild(expIcon);
            }
            if (it.status) {
                var stEl = document.createElement('div');
                stEl.className = 'paItemStatus';
                stEl.textContent = it.status;
                div.appendChild(stEl);
            }
            if (HEADING_LEVELS[level]) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'paToggleBtn';
                btn.innerHTML = '';
                var icon = document.createElement('img');
                icon.src = collapsedIdx[idx] ? 'data/down.ico' : 'data/up.ico';
                icon.alt = collapsedIdx[idx] ? '展开' : '收起';
                btn.title = collapsedIdx[idx] ? '展开' : '收起';
                btn.appendChild(icon);
                btn.style.display = (selectedIdx === idx) ? 'flex' : 'none';
                btn.addEventListener('mousedown', function(e) { e.stopPropagation(); });
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var newState = !collapsedIdx[idx];
                    if (newState && paFilterActive) {
                        collapsedIdx = {};
                        collapsedIdx[idx] = false;
                    } else {
                        collapsedIdx[idx] = newState;
                        if (newState && !paMirrorVisible) {
                            var lvl = it.level;
                            for (var si = 0; si < items.length; si++) {
                                if (si !== idx && items[si] && items[si].level === lvl && HEADING_LEVELS[items[si].level] && !collapsedIdx[si]) {
                                    collapsedIdx[si] = true;
                    }
                    if (_lastSelectedDirIdx >= 0 && _lastSelectedDirIdx < dirTabEl.children.length) {
                        dirTabEl.children[_lastSelectedDirIdx].classList.add('notepadOutlineSelected');
                    }
                }
            }
            updatePaWordCount();
        }
                    render();
                });
                div.appendChild(btn);
            }
            div.addEventListener('click', function(e) {
                if (div.classList.contains('editing')) return;
                // 点击挂钩的段落展开/收起参考；点击其他段落自动收起参考
                if (paRefsOf(it).length) paToggleRefs(idx, false);
                else if (paRefOpenIdx !== -1) paCloseRefs();
                if (e.shiftKey && selectedIdx >= 0) {
                    var start = Math.min(selectedIdx, idx);
                    var end = Math.max(selectedIdx, idx);
                    selectedRange = [start, end];
                    setSelected(idx);
                } else {
                    selectedRange = [];
                    setSelected(idx);
                }
            });
            div.addEventListener('dblclick', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (div.classList.contains('editing')) return;
                enterEdit(div, idx);
            });
            div.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                ctxTargetIdx = idx; ctxIsOther = false;
                var _paEd = div.querySelector('.paItemText[contenteditable="true"]');
                var _paSel = window.getSelection();
                var _hasEditSel = false;
                if (_paEd && _paSel && _paSel.rangeCount && !_paSel.getRangeAt(0).collapsed && _paEd.contains(_paSel.anchorNode)) {
                    _paCtxSavedRange = _paSel.getRangeAt(0).cloneRange();
                    _hasEditSel = true;
                }
                var _csfParent = document.getElementById('paCtxClearSelFmtParent');
                if (_csfParent) _csfParent.style.display = _hasEditSel ? '' : 'none';
                setSelected(idx);
                showContextMenu(e.clientX, e.clientY, it.level || 'level-body');
            });
            div.setAttribute('draggable', 'true');
            div.addEventListener('dragstart', function(e) {
                if (div.classList.contains('editing')) { e.preventDefault(); return; }
                paDragSrcIdx = idx;
                div.classList.add('dragging');
                try {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                } catch (err) {}
            });
            div.addEventListener('dragend', function() {
                div.classList.remove('dragging');
                clearDragOver();
            });
            div.addEventListener('dragover', function(e) {
                if (paRefDragState) {
                    // 参考段拖到普通段落上：允许放置（追加到该段落）
                    e.preventDefault();
                    e.stopPropagation();
                    try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
                    div.classList.add('paRefHostDrop');
                    return;
                }
                if (paDragSrcIdx < 0) return;
                e.preventDefault();
                try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
                var rect = div.getBoundingClientRect();
                var above = (e.clientY - rect.top) < rect.height / 2;
                clearDragOver();
                div.classList.add(above ? 'drop-above' : 'drop-below');
            });
            div.addEventListener('dragleave', function() {
                div.classList.remove('drop-above');
                div.classList.remove('drop-below');
                div.classList.remove('paRefHostDrop');
            });
            div.addEventListener('drop', function(e) {
                if (paRefDragState) {
                    e.preventDefault();
                    e.stopPropagation();
                    div.classList.remove('paRefHostDrop');
                    var st = paRefDragState;
                    paRefDragState = null;
                    clearRefDragOver();
                    moveRefToHostEnd(st.hostIdx, st.refIdx, idx);
                    return;
                }
                e.preventDefault();
                if (paDragSrcIdx < 0) { clearDragOver(); return; }
                var rect = div.getBoundingClientRect();
                var above = (e.clientY - rect.top) < rect.height / 2;
                var targetIdx = idx + (above ? 0 : 1);
                performDragMove(paDragSrcIdx, targetIdx);
                paDragSrcIdx = -1;
                clearDragOver();
            });
            return div;
        }
        function buildMirrorItemEl(idx) {
            return _buildCommonItemEl(idx, false);
        }
        function buildOtherMirrorItemEl(idx) {
            return _buildCommonItemEl(idx, true);
        }
        function _buildCommonItemEl(idx, isOther) {
            var sourceItems = isOther ? paOtherItems : items;
            var collapsedMap = isOther ? paOtherMirrorCollapsedIdx : paMirrorCollapsedIdx;
            var selectedMap = isOther ? paOtherMirrorSelectedIdx : paMirrorSelectedIdx;
            var dragSrcVar = isOther ? 'paOtherDragSrcIdx' : 'paDragSrcIdx';
            var it = sourceItems[idx];
            if (it.kind === 'divider') {
                var hr = document.createElement('div');
                hr.className = 'paItem paDivider';
                hr.dataset.idx = String(idx);
                hr.addEventListener('click', function() { if (!isOther) paCloseRefs(); });
                hr.addEventListener('contextmenu', function(e) {
                    e.preventDefault(); e.stopPropagation();
                    ctxTargetIdx = idx; ctxIsOther = isOther;
                    (isOther ? paOtherMirrorSetSelected : paMirrorSetSelected)(idx);
                    showContextMenu(e.clientX, e.clientY, 'divider');
                });
                hr.addEventListener('dragover', function(e) {
                    if (window[dragSrcVar] < 0) return;
                    e.preventDefault();
                    try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
                    var rect = hr.getBoundingClientRect();
                    var above = (e.clientY - rect.top) < rect.height / 2;
                    clearDragOver();
                    hr.classList.add(above ? 'drop-above' : 'drop-below');
                });
                hr.addEventListener('dragleave', function() {
                    hr.classList.remove('drop-above');
                    hr.classList.remove('drop-below');
                });
                hr.addEventListener('drop', function(e) {
                    e.preventDefault();
                    if (window[dragSrcVar] < 0) { clearDragOver(); return; }
                    var rect = hr.getBoundingClientRect();
                    var above = (e.clientY - rect.top) < rect.height / 2;
                    (isOther ? performOtherDragMove : performDragMove)(window[dragSrcVar], idx + (above ? 0 : 1));
                    if (isOther) paOtherDragSrcIdx = -1; else paDragSrcIdx = -1;
                    clearDragOver();
                });
                return hr;
            }
            var level = it.level || 'level-body';
            var div = document.createElement('div');
            div.className = 'paItem ' + level;
            div.dataset.idx = String(idx);
            if (selectedMap === idx) div.classList.add('selected');
            if (it.noBreakAfter) div.classList.add('paMergeNext');
            if (it.noBreakBefore) div.classList.add('paMergePrev');
            if (it.bg) applyBgStyle(div, it.bg);
            if (it.paHidden) div.classList.add('paItemPaHidden');
            if (it.tag) {
                div.classList.add('has-tag');
                var tagIcon = document.createElement('img');
                tagIcon.src = 'data/mark.ico';
                tagIcon.className = 'paTagIcon';
                tagIcon.title = '点击查看标签';
                (function(tagText, iconEl, hostEl) {
                    iconEl.addEventListener('click', function(e) {
                        if (hostEl.classList.contains('editing')) return;
                        e.stopPropagation();
                        e.preventDefault();
                        paShowTagTooltip(hostEl, tagText);
                        paAttachTagTooltipMouseLeave();
                        paTagTooltipDivEl = iconEl;
                        iconEl.addEventListener('mouseleave', paOnTagDivMouseLeave);
                    });
                })(it.tag, tagIcon, div);
                div.appendChild(tagIcon);
            }
            var _refs = paRefsOf(it);
            if (_refs.length) {
                div.classList.add('hasRef');
                var refIcon = document.createElement('span');
                refIcon.className = 'paRefIcon';
                refIcon.title = '点击展开/收起参考内容';
                (function(hostIdx, hostDiv) {
                    refIcon.addEventListener('click', function(ev) {
                        ev.stopPropagation();
                        ev.preventDefault();
                        paToggleRefs(hostIdx, !!(hostDiv.closest && hostDiv.closest('#paMirrorBody')));
                    });
                })(idx, div);
                div.appendChild(refIcon);
            }
            var textWrap = document.createElement('div');
            textWrap.className = 'paItemText';
            var content = it.text || '';
            if (level === 'level-body') content = paFormatParens(content);
            if (level === 'level-body' && /<br\s*\/?>/i.test(content)) {
                var _firstIndent = it.noBreakBefore ? '0' : '2em';
                var _restIndent = '2em';
                content = '<span style="display:block;text-indent:' + _firstIndent + ';">' + content.replace(/<br\s*\/?>/gi, '</span><span style="display:block;text-indent:' + _restIndent + ';">') + '</span>';
            }
            textWrap.innerHTML = content;
            applyMarksStyle(textWrap, it.marks);
            if (it.fontFamily) textWrap.style.fontFamily = it.fontFamily;
            if (it.fontSize) textWrap.style.fontSize = it.fontSize;
            if (it.highlight) {
                var hlMap = { yellow:'#fff176', blue:'#42a5f5', red:'#ef5350', green:'#66bb6a', purple:'#ab47bc' };
                textWrap.innerHTML = '<span style="background:' + (hlMap[it.highlight] || '#fff176') + '">' + textWrap.innerHTML + '</span>';
            }
            div.appendChild(textWrap);
            if (it.collapsed) {
                div.classList.add('collapsed');
                var expIcon = document.createElement('span');
                expIcon.className = 'paExpandIcon';
                expIcon.textContent = '…';
                expIcon.title = '展开';
                (function(itemIdx) {
                    expIcon.addEventListener('click', function(ev) {
                        ev.stopPropagation();
                        var src = ctxIsOther ? paOtherItems : items;
                        if (src[itemIdx]) { delete src[itemIdx].collapsed; save(); render(); }
                    });
                })(idx);
                div.appendChild(expIcon);
            }
            if (it.status) {
                var stEl = document.createElement('div');
                stEl.className = 'paItemStatus';
                stEl.textContent = it.status;
                div.appendChild(stEl);
            }
            if (HEADING_LEVELS[level]) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'paToggleBtn';
                var icon = document.createElement('img');
                icon.src = collapsedMap[idx] ? 'data/down.ico' : 'data/up.ico';
                icon.alt = collapsedMap[idx] ? '展开' : '收起';
                btn.title = collapsedMap[idx] ? '展开' : '收起';
                btn.appendChild(icon);
                btn.style.display = (selectedMap === idx) ? 'flex' : 'none';
                btn.addEventListener('mousedown', function(e) { e.stopPropagation(); });
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    collapsedMap[idx] = !collapsedMap[idx];
                    (isOther ? renderOtherMirror : renderMirror)();
                });
                div.appendChild(btn);
            }
            div.addEventListener('click', function() {
                if (div.classList.contains('editing')) return;
                if (!isOther) {
                    if (paRefsOf(it).length) paToggleRefs(idx, true);
                    else if (paMirrorRefOpenIdx !== -1) paCloseRefs();
                }
                (isOther ? paOtherMirrorSetSelected : paMirrorSetSelected)(idx);
            });
            div.addEventListener('dblclick', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (div.classList.contains('editing')) return;
                (isOther ? enterOtherMirrorEdit : enterMirrorEdit)(div, idx);
            });
            div.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                ctxTargetIdx = idx; ctxIsOther = isOther;
                var _paEd = div.querySelector('.paItemText[contenteditable="true"]');
                var _paSel = window.getSelection();
                var _hasEditSel2 = false;
                if (_paEd && _paSel && _paSel.rangeCount && !_paSel.getRangeAt(0).collapsed && _paEd.contains(_paSel.anchorNode)) {
                    _paCtxSavedRange = _paSel.getRangeAt(0).cloneRange();
                    _hasEditSel2 = true;
                }
                var _csfParent2 = document.getElementById('paCtxClearSelFmtParent');
                if (_csfParent2) _csfParent2.style.display = _hasEditSel2 ? '' : 'none';
                (isOther ? paOtherMirrorSetSelected : paMirrorSetSelected)(idx);
                showContextMenu(e.clientX, e.clientY, it.level || 'level-body');
            });
            div.setAttribute('draggable', 'true');
            div.addEventListener('dragstart', function(e) {
                if (div.classList.contains('editing')) { e.preventDefault(); return; }
                if (isOther) paOtherDragSrcIdx = idx; else paDragSrcIdx = idx;
                div.classList.add('dragging');
                try {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                } catch (err) {}
            });
            div.addEventListener('dragend', function() {
                div.classList.remove('dragging');
                clearDragOver();
            });
            div.addEventListener('dragover', function(e) {
                if (paRefDragState && !isOther) {
                    e.preventDefault();
                    e.stopPropagation();
                    try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
                    div.classList.add('paRefHostDrop');
                    return;
                }
                var ds = isOther ? paOtherDragSrcIdx : paDragSrcIdx;
                if (ds < 0) return;
                e.preventDefault();
                try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
                var rect = div.getBoundingClientRect();
                var above = (e.clientY - rect.top) < rect.height / 2;
                clearDragOver();
                div.classList.add(above ? 'drop-above' : 'drop-below');
            });
            div.addEventListener('dragleave', function() {
                div.classList.remove('drop-above');
                div.classList.remove('drop-below');
                div.classList.remove('paRefHostDrop');
            });
            div.addEventListener('drop', function(e) {
                if (paRefDragState && !isOther) {
                    e.preventDefault();
                    e.stopPropagation();
                    div.classList.remove('paRefHostDrop');
                    var st = paRefDragState;
                    paRefDragState = null;
                    clearRefDragOver();
                    moveRefToHostEnd(st.hostIdx, st.refIdx, idx);
                    return;
                }
                e.preventDefault();
                var ds = isOther ? paOtherDragSrcIdx : paDragSrcIdx;
                if (ds < 0) { clearDragOver(); return; }
                var rect = div.getBoundingClientRect();
                var above = (e.clientY - rect.top) < rect.height / 2;
                (isOther ? performOtherDragMove : performDragMove)(ds, idx + (above ? 0 : 1));
                if (isOther) paOtherDragSrcIdx = -1; else paDragSrcIdx = -1;
                clearDragOver();
            });
            return div;
        }
        function clearDragOver() {
            var els = document.querySelectorAll('#paBody .paItem, #paMirrorBody .paItem');
            for (var i = 0; i < els.length; i++) {
                els[i].classList.remove('drop-above');
                els[i].classList.remove('drop-below');
            }
        }
        function computeSubtreeEnd(srcIdx) {
            var src = items[srcIdx];
            if (!src || src.kind === 'divider') return srcIdx + 1;
            var level = src.level || 'level-body';
            var srcOrder = LEVEL_ORDER[level];
            if (srcOrder === undefined) srcOrder = 4;
            // only headings carry a subtree of following items with larger order
            if (!HEADING_LEVELS[level]) return srcIdx + 1;
            var end = srcIdx + 1;
            while (end < items.length) {
                var it = items[end];
                if (!it) { end++; continue; }
                if (it.kind === 'divider') break;
                var o = LEVEL_ORDER[it.level];
                if (o === undefined) o = 4;
                if (o <= srcOrder) break;
                end++;
            }
            return end;
        }
        function _remapIdxAfterMove(idx, src, end, insert) {
            if (idx < 0) return -1;
            var offset = end - src;
            var blen = offset;
            if (idx < src) {
                if (insert <= idx) return idx + blen;
                return idx;
            }
            if (idx < end) {
                return insert + (idx - src);
            }
            var pos = idx - offset;
            if (insert <= pos) return pos + blen;
            return pos;
        }
        function performDragMove(srcIdx, targetIdx) {
            if (srcIdx < 0 || srcIdx >= items.length) return;
            var end = computeSubtreeEnd(srcIdx);
            if (targetIdx >= srcIdx && targetIdx <= end) return;
            var savedCollapsed = {};
            for (var _k in collapsedIdx) { if (collapsedIdx.hasOwnProperty(_k)) savedCollapsed[_k] = collapsedIdx[_k]; }
            var savedMirrorCollapsed = {};
            for (var _k in paMirrorCollapsedIdx) { if (paMirrorCollapsedIdx.hasOwnProperty(_k)) savedMirrorCollapsed[_k] = paMirrorCollapsedIdx[_k]; }
            var savedSel = selectedIdx;
            var savedMirrorSel = paMirrorSelectedIdx;
            var block = items.slice(srcIdx, end);
            items.splice(srcIdx, end - srcIdx);
            var insertIdx = targetIdx;
            if (targetIdx > end) insertIdx = targetIdx - (end - srcIdx);
            items.splice.apply(items, [insertIdx, 0].concat(block));
            collapsedIdx = {};
            for (var _k in savedCollapsed) { var _i = _remapIdxAfterMove(parseInt(_k, 10), srcIdx, end, insertIdx); if (_i >= 0) collapsedIdx[_i] = savedCollapsed[_k]; }
            paMirrorCollapsedIdx = {};
            for (var _k in savedMirrorCollapsed) { var _i = _remapIdxAfterMove(parseInt(_k, 10), srcIdx, end, insertIdx); if (_i >= 0) paMirrorCollapsedIdx[_i] = savedMirrorCollapsed[_k]; }
            selectedIdx = _remapIdxAfterMove(savedSel, srcIdx, end, insertIdx);
            paMirrorSelectedIdx = _remapIdxAfterMove(savedMirrorSel, srcIdx, end, insertIdx);
            save();
            render();
        }
        function performOtherDragMove(srcIdx, targetIdx) {
            if (srcIdx < 0 || srcIdx >= paOtherItems.length) return;
            var end = computeOtherSubtreeEnd(srcIdx);
            if (targetIdx >= srcIdx && targetIdx <= end) return;
            var savedCollapsed = {};
            for (var _k in paOtherCollapsedIdx) { if (paOtherCollapsedIdx.hasOwnProperty(_k)) savedCollapsed[_k] = paOtherCollapsedIdx[_k]; }
            var savedMirrorCollapsed = {};
            for (var _k in paOtherMirrorCollapsedIdx) { if (paOtherMirrorCollapsedIdx.hasOwnProperty(_k)) savedMirrorCollapsed[_k] = paOtherMirrorCollapsedIdx[_k]; }
            var savedSel = paOtherSelectedIdx;
            var savedMirrorSel = paOtherMirrorSelectedIdx;
            var block = paOtherItems.slice(srcIdx, end);
            paOtherItems.splice(srcIdx, end - srcIdx);
            var insertIdx = targetIdx;
            if (targetIdx > end) insertIdx = targetIdx - (end - srcIdx);
            paOtherItems.splice.apply(paOtherItems, [insertIdx, 0].concat(block));
            paOtherCollapsedIdx = {};
            for (var _k in savedCollapsed) { var _i = _remapIdxAfterMove(parseInt(_k, 10), srcIdx, end, insertIdx); if (_i >= 0) paOtherCollapsedIdx[_i] = savedCollapsed[_k]; }
            paOtherMirrorCollapsedIdx = {};
            for (var _k in savedMirrorCollapsed) { var _i = _remapIdxAfterMove(parseInt(_k, 10), srcIdx, end, insertIdx); if (_i >= 0) paOtherMirrorCollapsedIdx[_i] = savedMirrorCollapsed[_k]; }
            paOtherSelectedIdx = _remapIdxAfterMove(savedSel, srcIdx, end, insertIdx);
            paOtherMirrorSelectedIdx = _remapIdxAfterMove(savedMirrorSel, srcIdx, end, insertIdx);
            renderOtherMirror();
        }
        function computeOtherSubtreeEnd(srcIdx) {
            if (srcIdx >= paOtherItems.length) return srcIdx + 1;
            var src = paOtherItems[srcIdx];
            if (!src || src.kind === 'divider' || !HEADING_LEVELS[src.level]) return computeOtherSubtreePlainEnd(srcIdx);
            var srcOrder = LEVEL_ORDER[src.level] || 4;
            var end = srcIdx;
            for (var i = srcIdx + 1; i < paOtherItems.length; i++) {
                var it = paOtherItems[i];
                if (it.kind === 'divider') break;
                var o = LEVEL_ORDER[it.level];
                if (o === undefined) o = 4;
                if (o <= srcOrder) break;
                end = i;
            }
            return end + 1;
        }
        function computeOtherSubtreePlainEnd(srcIdx) {
            var end = srcIdx;
            for (var i = srcIdx + 1; i < paOtherItems.length; i++) {
                var it = paOtherItems[i];
                if (it.kind === 'divider') break;
                var order = LEVEL_ORDER[it.level];
                if (order === undefined) order = 4;
                if (order < 4) break;
                end = i;
            }
            return end + 1;
        }
        function _paCountText(text) {
            return (text || '').replace(/<[^>]*>/g, '').replace(/\s/g, '').length;
        }
        function updatePaWordCount() {
            var allItems = items || [];
            var totalChars = 0;
            for (var i = 0; i < allItems.length; i++) {
                if (allItems[i].kind === 'divider') continue;
                totalChars += _paCountText(allItems[i].text);
            }
            var sectionChars = 0;
            var label = '';
            if (selectedIdx >= 0 && selectedIdx < allItems.length && allItems[selectedIdx].kind !== 'divider') {
                var selLevel = allItems[selectedIdx].level;
                if (selLevel === 'level-body') {
                    sectionChars = _paCountText(allItems[selectedIdx].text);
                    label = '本段';
                } else {
                    var selOrder = LEVEL_ORDER[selLevel];
                    if (selOrder === undefined) selOrder = 4;
                    var startIdx = selectedIdx, endIdx = allItems.length;
                    for (var i = selectedIdx + 1; i < allItems.length; i++) {
                        if (allItems[i].kind === 'divider') { endIdx = i; break; }
                        var order = LEVEL_ORDER[allItems[i].level];
                        if (order !== undefined && order <= selOrder) { endIdx = i; break; }
                    }
                    for (var i = startIdx; i < endIdx; i++) {
                        if (allItems[i].kind === 'divider') continue;
                        sectionChars += _paCountText(allItems[i].text);
                    }
                    label = '本部分';
                }
            }
            var el = document.getElementById('paWordCount');
            if (el) {
                el.textContent = sectionChars > 0 ? label + sectionChars + '字、全文' + totalChars + '字' : '全文' + totalChars + '字';
            }
        }
        function updatePreviewWordCount() {
            var editor = document.getElementById('paPreviewEditor');
            if (!editor) return;
            var totalText = editor.textContent || '';
            var totalChars = totalText.replace(/\s/g, '').length;
            var sel = window.getSelection();
            var selText = (sel && sel.rangeCount > 0 && !sel.isCollapsed && editor.contains(sel.anchorNode) && editor.contains(sel.focusNode)) ? sel.toString() : '';
            var el = document.getElementById('paWordCount');
            if (!el) return;
            if (selText) {
                el.textContent = '选择部分' + selText.replace(/\s/g, '').length + '字、全文' + totalChars + '字';
            } else if (sel && sel.rangeCount > 0) {
                var node = sel.anchorNode;
                var p = node && node.nodeType === 3 ? node.parentNode : node;
            while (p && p !== editor && p.tagName !== 'P' && p.tagName !== 'DIV') p = p.parentNode;
                if (p && p !== editor) {
                    var pText = p.textContent || '';
                    var pChars = pText.replace(/\s/g, '').length;
                    el.textContent = '本段' + pChars + '字、全文' + totalChars + '字';
                } else {
                    el.textContent = '全文' + totalChars + '字';
                }
            } else {
                el.textContent = '全文' + totalChars + '字';
            }
        }
        function setSelected(idx) {
            if (selectedIdx === idx && selectedRange.length === 0) return;
            var body = document.getElementById('paBody');
            if (!body) return;
            var allDivs = body.querySelectorAll('.paItem');
            for (var k = 0; k < allDivs.length; k++) {
                var d = allDivs[k];
                d.classList.remove('selected', 'range-selected');
                var b = d.querySelector('.paToggleBtn');
                if (b) b.style.display = 'none';
            }
            selectedIdx = idx;
            _updateHideBtnState();
            if (idx < 0) return;
            for (var k2 = 0; k2 < allDivs.length; k2++) {
                var di = parseInt(allDivs[k2].dataset.idx, 10);
                if (selectedRange.length === 2 && di >= selectedRange[0] && di <= selectedRange[1]) {
                    allDivs[k2].classList.add('range-selected');
                }
                if (di === idx) {
                    allDivs[k2].classList.add('selected');
                    var tb = allDivs[k2].querySelector('.paToggleBtn');
                    if (tb) tb.style.display = 'flex';
                }
            }
            updatePaWordCount();
        }
        function paMirrorSetSelected(idx) {
            if (paMirrorMode === 2) { paOtherSelectedIdx = idx; renderOtherMirror(); return; }
            if (paMirrorSelectedIdx === idx) return;
            var body = document.getElementById('paMirrorBody');
            if (!body) return;
            var allDivs = body.querySelectorAll('.paItem');
            for (var k = 0; k < allDivs.length; k++) {
                var d = allDivs[k];
                d.classList.remove('selected');
                var b = d.querySelector('.paToggleBtn');
                if (b) b.style.display = 'none';
            }
            paMirrorSelectedIdx = idx;
            if (idx < 0) return;
            for (var k2 = 0; k2 < allDivs.length; k2++) {
                if (parseInt(allDivs[k2].dataset.idx, 10) === idx) {
                    allDivs[k2].classList.add('selected');
                    var tb = allDivs[k2].querySelector('.paToggleBtn');
                    if (tb) tb.style.display = 'flex';
                    break;
                }
            }
        }
        function paOtherMirrorSetSelected(idx) {
            if (paOtherMirrorSelectedIdx === idx) return;
            var body = document.getElementById('paMirrorBody');
            if (!body) return;
            var allDivs = body.querySelectorAll('.paItem');
            for (var k = 0; k < allDivs.length; k++) {
                var d = allDivs[k];
                d.classList.remove('selected');
                var b = d.querySelector('.paToggleBtn');
                if (b) b.style.display = 'none';
            }
            paOtherMirrorSelectedIdx = idx;
            if (idx < 0) return;
            for (var k2 = 0; k2 < allDivs.length; k2++) {
                if (parseInt(allDivs[k2].dataset.idx, 10) === idx) {
                    allDivs[k2].classList.add('selected');
                    var tb = allDivs[k2].querySelector('.paToggleBtn');
                    if (tb) tb.style.display = 'flex';
                    break;
                }
            }
        }
        function enterEdit(div, idx) {
            paHideTagTooltip();
            var mirrorEditing = document.querySelector('#paMirrorBody .paItemText[contenteditable="true"]');
            if (mirrorEditing) mirrorEditing.blur();
            editingIdx = idx;
            div.classList.add('editing');
            var textWrap = div.querySelector('.paItemText');
            var btn = div.querySelector('.paToggleBtn');
            if (btn) btn.style.display = 'none';
            if (!textWrap) return;
            textWrap.setAttribute('contenteditable', 'true');
            textWrap.focus();
            var range = document.createRange();
            range.selectNodeContents(textWrap);
            range.collapse(true);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            var finished = false;
            function finish() {
                if (finished) return;
                finished = true;
                textWrap.removeEventListener('blur', finish);
                textWrap.removeEventListener('keydown', onKey);
                var newText = (textWrap.innerText || '').replace(/\r?\n$/, '');
                var html = textWrap.innerHTML;
                if (html !== newText && /<[a-zA-Z]/.test(html)) { items[idx].text = html; }
                else { items[idx].text = newText; }
                save();
                div.classList.remove('editing');
                textWrap.removeAttribute('contenteditable');
                editingIdx = -1;
                render();
                setSelected(idx);
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'w' || e.key === 'W')) {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        var _ok = _paClearFormatInSelection(null);
                        if (_ok) { _paClearItemLevelStylesForEditing(); try { if (typeof showToast === 'function') showToast('已清除选取格式'); } catch(ee){} }
                        else { try { if (typeof showToast === 'function') showToast('请先选取要清除格式的文字'); } catch(ee){} }
                    } catch(err) { console.error('paItemText clear(W) error:', err); try { if (typeof showToast === 'function') showToast('清除出错: ' + err.message); } catch(ee){} }
                }
            }
            textWrap.addEventListener('blur', finish);
            textWrap.addEventListener('keydown', onKey);
        }
        function enterMirrorEdit(div, idx) {
            var mainEditing = document.querySelector('#paBody .paItemText[contenteditable="true"]');
            if (mainEditing) mainEditing.blur();
            editingIdx = idx;
            div.classList.add('editing');
            var textWrap = div.querySelector('.paItemText');
            var btn = div.querySelector('.paToggleBtn');
            if (btn) btn.style.display = 'none';
            if (!textWrap) return;
            textWrap.setAttribute('contenteditable', 'true');
            textWrap.focus();
            var range = document.createRange();
            range.selectNodeContents(textWrap);
            range.collapse(true);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            var finished = false;
            function finish() {
                if (finished) return;
                finished = true;
                textWrap.removeEventListener('blur', finish);
                textWrap.removeEventListener('keydown', onKey);
                var text1 = (textWrap.innerText || '').replace(/\r?\n$/, '');
                var html1 = textWrap.innerHTML;
                if (html1 !== text1 && /<[a-zA-Z]/.test(html1)) { items[idx].text = html1; }
                else { items[idx].text = text1; }
                save();
                div.classList.remove('editing');
                textWrap.removeAttribute('contenteditable');
                editingIdx = -1;
                render();
                paMirrorSetSelected(idx);
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'w' || e.key === 'W')) {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        var _ok = _paClearFormatInSelection(null);
                        if (_ok) { _paClearItemLevelStylesForEditing(); try { if (typeof showToast === 'function') showToast('已清除选取格式'); } catch(ee){} }
                        else { try { if (typeof showToast === 'function') showToast('请先选取要清除格式的文字'); } catch(ee){} }
                    } catch(err) { console.error('paItemText clear(W) error:', err); try { if (typeof showToast === 'function') showToast('清除出错: ' + err.message); } catch(ee){} }
                }
            }
            textWrap.addEventListener('blur', finish);
            textWrap.addEventListener('keydown', onKey);
        }
        function enterOtherMirrorEdit(div, idx) {
            var mainEditing = document.querySelector('#paBody .paItemText[contenteditable="true"]');
            if (mainEditing) mainEditing.blur();
            editingIdx = idx;
            div.classList.add('editing');
            var textWrap = div.querySelector('.paItemText');
            var btn = div.querySelector('.paToggleBtn');
            if (btn) btn.style.display = 'none';
            if (!textWrap) return;
            textWrap.setAttribute('contenteditable', 'true');
            textWrap.focus();
            var range = document.createRange();
            range.selectNodeContents(textWrap);
            range.collapse(true);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            var finished = false;
            function finish() {
                if (finished) return;
                finished = true;
                textWrap.removeEventListener('blur', finish);
                textWrap.removeEventListener('keydown', onKey);
                var t1 = (textWrap.innerText || '').replace(/\r?\n$/, '');
                var h1 = textWrap.innerHTML;
                if (h1 !== t1 && /<[a-zA-Z]/.test(h1)) { paOtherItems[idx].text = h1; }
                else { paOtherItems[idx].text = t1; }
                div.classList.remove('editing');
                textWrap.removeAttribute('contenteditable');
                editingIdx = -1;
                renderOtherMirror();
                paOtherMirrorSetSelected(idx);
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'w' || e.key === 'W')) {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        var _ok = _paClearFormatInSelection(null);
                        if (_ok) { _paClearItemLevelStylesForEditing(); try { if (typeof showToast === 'function') showToast('已清除选取格式'); } catch(ee){} }
                        else { try { if (typeof showToast === 'function') showToast('请先选取要清除格式的文字'); } catch(ee){} }
                    } catch(err) { console.error('paItemText clear(W) error:', err); try { if (typeof showToast === 'function') showToast('清除出错: ' + err.message); } catch(ee){} }
                }
            }
            textWrap.addEventListener('blur', finish);
            textWrap.addEventListener('keydown', onKey);
        }
        function _paClearFormatInSelection(savedRange) {
            var sel = window.getSelection();
            var range = null;
            if (savedRange && !savedRange.collapsed) {
                range = savedRange;
            } else if (sel.rangeCount) {
                range = sel.getRangeAt(0);
            }
            if (!range || range.collapsed) return false;
            var root = range.commonAncestorContainer;
            if (root.nodeType === 3) root = root.parentNode;
            var textEl = root && root.closest ? root.closest('.paItemText') : null;
            if (!textEl || textEl.getAttribute('contenteditable') !== 'true') return false;
            if (sel.rangeCount === 0 || sel.getRangeAt(0) !== range) {
                try { sel.removeAllRanges(); sel.addRange(range); } catch(ex) {}
            }
            if (!sel.rangeCount || sel.getRangeAt(0).collapsed) {
                try { sel.removeAllRanges(); sel.addRange(range); } catch(ex) {}
                if (!sel.rangeCount || sel.getRangeAt(0).collapsed) return false;
            }
            var paItemEl = textEl.closest('.paItem');
            var lv = 'level-body';
            if (paItemEl) {
                var cm = (paItemEl.className || '').match(/level-[a-z]+/);
                if (cm && FORMAT_STANDARD.levels[cm[0]]) lv = cm[0];
            }
            var bodyStyle = FORMAT_STANDARD.inlineStyle(lv);
            var remarkStyle = FORMAT_STANDARD.inlineStyle('level-remark');
            var frag = range.extractContents();
            var allEls = frag.querySelectorAll('*');
            for (var i = 0; i < allEls.length; i++) allEls[i].removeAttribute('style');
            var unwrapTags = frag.querySelectorAll('b,strong,i,em,u,ins,s,strike,del,font,mark,span');
            for (var j = unwrapTags.length - 1; j >= 0; j--) {
                var el = unwrapTags[j], pn = el.parentNode;
                if (!pn) continue;
                while (el.firstChild) pn.insertBefore(el.firstChild, el);
                pn.removeChild(el);
            }
            try { frag.normalize(); } catch(en) {}
            var reParen = /（([^）]{2,})）|\(([^)]{2,})\)/g;
            var doParens = (lv === 'level-body');
            var walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT, null, false);
            var textNodes = [];
            while (walker.nextNode()) {
                var tn = walker.currentNode;
                if ((tn.nodeValue || '').length > 0) textNodes.push(tn);
            }
            for (var k = 0; k < textNodes.length; k++) {
                var tn = textNodes[k], text = tn.nodeValue, parent = tn.parentNode;
                if (!parent) continue;
                if (!doParens || (text.indexOf('（') === -1 && text.indexOf('(') === -1)) {
                    var sbOnly = document.createElement('span');
                    sbOnly.style.cssText = bodyStyle;
                    sbOnly.textContent = text;
                    parent.replaceChild(sbOnly, tn);
                    continue;
                }
                reParen.lastIndex = 0;
                var m, last = 0, nodes = [];
                while ((m = reParen.exec(text)) !== null) {
                    if (m.index > last) {
                        var sb = document.createElement('span');
                        sb.style.cssText = bodyStyle;
                        sb.textContent = text.substring(last, m.index);
                        nodes.push(sb);
                    }
                    var part = document.createElement('span');
                    part.style.cssText = _notepadIsBodyParenException(m[0]) ? bodyStyle : remarkStyle;
                    part.textContent = m[0];
                    nodes.push(part);
                    last = m.index + m[0].length;
                }
                if (last < text.length) {
                    var sb2 = document.createElement('span');
                    sb2.style.cssText = bodyStyle;
                    sb2.textContent = text.substring(last);
                    nodes.push(sb2);
                }
                for (var ni = 0; ni < nodes.length; ni++) parent.insertBefore(nodes[ni], tn);
                parent.removeChild(tn);
            }
            var firstNode = frag.firstChild;
            var lastNode = frag.lastChild;
            range.insertNode(frag);
            var newRange = document.createRange();
            if (firstNode) {
                newRange.setStartBefore(firstNode);
                newRange.setEndAfter(lastNode);
            } else {
                newRange.selectNodeContents(textEl);
                newRange.collapse(true);
            }
            sel.removeAllRanges();
            sel.addRange(newRange);
            return true;
        }
        function _paClearItemLevelStylesForEditing() {
            try {
                var te = document.querySelector('.paItemText[contenteditable="true"]');
                if (!te) return false;
                var itemDiv = te.closest ? te.closest('.paItem') : null;
                if (!itemDiv) return false;
                var idx = parseInt(itemDiv.dataset.idx, 10);
                if (!isFinite(idx)) return false;
                var si = itemDiv.closest('#paOtherMirrorBody') ? paOtherItems : (itemDiv.closest('#paMirrorBody') ? paOtherItems : items);
                if (!si || !si[idx]) return false;
                var changed = false;
                if (si[idx].bg) { si[idx].bg = ''; te.style.background = ''; changed = true; }
                if (si[idx].highlight) { si[idx].highlight = ''; te.style.background = ''; changed = true; }
                if (si[idx].marks) { delete si[idx].marks; te.removeAttribute('data-marks'); te.style.fontWeight=''; te.style.fontStyle=''; te.style.textDecoration=''; te.style.color=''; changed = true; }
                if (changed) { try { si[idx].text = paNormalizeText(te.innerHTML); save(); } catch(se){} }
                return changed;
            } catch(e) { return false; }
        }
        function getCtxItems() { return ctxIsOther ? paOtherItems : items; }
        function getCtxCollapsedIdx() { return ctxIsOther ? paOtherCollapsedIdx : collapsedIdx; }
        function getCtxMirrorCollapsedIdx() { return ctxIsOther ? paOtherMirrorCollapsedIdx : paMirrorCollapsedIdx; }
        function getCtxSelectedIdx() { return ctxIsOther ? paOtherMirrorSelectedIdx : selectedIdx; }
        function getCtxFilterActive() { return ctxIsOther ? paOtherMirrorFilterActive : paFilterActive; }
        function setCtxSelectedIdx(v) { if (ctxIsOther) paOtherMirrorSelectedIdx = v; else selectedIdx = v; }
        function ctxSave() { if (!ctxIsOther) save(); }
        function ctxRender() { if (ctxIsOther) renderOtherMirror(); else render(); }
        function showContextMenu(x, y, currentLevel) {
            var menu = document.getElementById('paContextMenu');
            if (!menu) return;
            menu.classList.add('show');
            var allSubParents = menu.querySelectorAll('.paCtxHasSub');
            for (var sp = 0; sp < allSubParents.length; sp++) allSubParents[sp].style.display = '';
            var _csfShow = false;
            try {
                var _csfEd = document.querySelector('.paItemText[contenteditable="true"]');
                var _csfSel = window.getSelection();
                if (_csfEd && _csfSel && _csfSel.rangeCount && !_csfSel.getRangeAt(0).collapsed && _csfEd.contains(_csfSel.anchorNode)) _csfShow = true;
            } catch(e) {}
            var _csfParentItem = menu.querySelector('.paCtxHasSub[data-submenu="paselfmt"]');
            if (_csfParentItem) _csfParentItem.style.display = _csfShow ? '' : 'none';
            if (currentLevel !== 'level-body' && currentLevel !== 'level-2' && currentLevel !== 'level-3') {
                var splitParent = menu.querySelector('.paCtxHasSub[data-submenu="split"]');
                if (splitParent) splitParent.style.display = 'none';
            }
            var collapseItem = menu.querySelector('.paCtxItem[data-action="toggle-collapse"]');
            if (collapseItem) {
                if (ctxRef) {
                    collapseItem.style.display = 'none';
                } else if (currentLevel === 'level-body') {
                    collapseItem.style.display = '';
                    var ctxItem = ctxTargetIdx >= 0 ? getCtxItems()[ctxTargetIdx] : null;
                    collapseItem.textContent = (ctxItem && ctxItem.collapsed) ? '展开' : '收起';
                } else {
                    collapseItem.style.display = 'none';
                }
            }
            var techItem = menu.querySelector('.paCtxItem[data-action="tech-stats"]');
            if (techItem) {
                techItem.style.display = (currentLevel === 'divider') ? 'none' : '';
            }
            var menuItems = menu.querySelectorAll('.paCtxItem');
            for (var i = 0; i < menuItems.length; i++) {
                var act = menuItems[i].getAttribute('data-action');
                if (act && act === currentLevel) menuItems[i].style.color = '#1565c0';
                else if (act) menuItems[i].style.color = '';
            }
            // 参考子菜单：仅非参考段可“添加参考”，参考段可“删除参考”
            var refAddItem = menu.querySelector('.paCtxItem[data-action="ref-add"]');
            var refDelItem = menu.querySelector('.paCtxItem[data-action="ref-delete"]');
            if (refAddItem) refAddItem.style.display = ctxRef ? 'none' : '';
            if (refDelItem) refDelItem.style.display = ctxRef ? '' : 'none';
            var ctxItems = getCtxItems();
            var currentBg = (ctxTargetIdx >= 0 && ctxItems[ctxTargetIdx]) ? (ctxItems[ctxTargetIdx].bg || '') : '';
            var bgItems = menu.querySelectorAll('.paCtxBgItem');
            for (var bi = 0; bi < bgItems.length; bi++) {
                var bg = bgItems[bi].getAttribute('data-bg');
                if ((bg || '') === (currentBg || '')) bgItems[bi].style.color = '#1565c0';
                else bgItems[bi].style.color = '';
            }
            var currentFont = (ctxTargetIdx >= 0 && ctxItems[ctxTargetIdx]) ? (ctxItems[ctxTargetIdx].fontFamily || '') : '';
            var fontItems = menu.querySelectorAll('.paCtxFontItem');
            for (var fi = 0; fi < fontItems.length; fi++) {
                var fv = fontItems[fi].getAttribute('data-font') || '';
                if (fv === currentFont) fontItems[fi].style.color = '#1565c0';
                else fontItems[fi].style.color = '';
            }
            var currentHl = (ctxTargetIdx >= 0 && ctxItems[ctxTargetIdx]) ? (ctxItems[ctxTargetIdx].highlight || '') : '';
            var hlItems = menu.querySelectorAll('.paCtxHighlightItem');
            for (var hi = 0; hi < hlItems.length; hi++) {
                var hv = hlItems[hi].getAttribute('data-highlight') || '';
                if (hv === currentHl) hlItems[hi].style.color = '#1565c0';
                else hlItems[hi].style.color = '';
            }
            var r = menu.getBoundingClientRect();
            var left = x, top = y;
            menu.style.left = '0px';
            menu.style.top = '0px';
            var rw = menu.offsetWidth, rh = menu.offsetHeight;
            if (left + rw > window.innerWidth - 8) left = window.innerWidth - rw - 8;
            if (top + rh > window.innerHeight - 8) top = window.innerHeight - rh - 8;
            if (left < 4) left = 4;
            if (top < 4) top = 4;
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';
        }
        function hideContextMenu() {
            var menu = document.getElementById('paContextMenu');
            if (menu) menu.classList.remove('show');
            ctxTargetIdx = -1;
            ctxRef = null;
        }
        // 参考段右键时返回该参考对象，否则返回 null。
        function _ctxRefItem() {
            if (!ctxRef) return null;
            var arr = getCtxItems();
            var host = arr[ctxTargetIdx];
            if (!host || !Array.isArray(host.refs)) return null;
            return host.refs[ctxRef.refIdx] || null;
        }
        // 当前右键的格式作用对象：参考段右键返回参考对象，否则返回宿主段落对象。
        function _ctxTargetObj() {
            if (ctxRef) return _ctxRefItem();
            var arr = getCtxItems();
            return arr[ctxTargetIdx] || null;
        }
        function findHeadingRangeEnd(idx, srcItems) {
            srcItems = srcItems || items;
            var target = srcItems[idx];
            if (!target || !HEADING_LEVELS[target.level]) return idx;
            var targetOrder = LEVEL_ORDER[target.level];
            var end = idx;
            for (var i = idx + 1; i < srcItems.length; i++) {
                var it = srcItems[i];
                if (it.kind === 'divider') continue;
                var order = LEVEL_ORDER[it.level];
                if (order === undefined) order = 4;
                if (order <= targetOrder) break;
                end = i;
            }
            return end;
        }
        function paCalcTechStats(startIdx, srcItems) {
            var endIdx = findHeadingRangeEnd(startIdx, srcItems);
            var totalChars = 0, totalLines = 0;
            for (var ti = startIdx; ti <= endIdx; ti++) {
                var item = srcItems[ti];
                if (item.kind === 'divider') continue;
                var raw = item.text || '';
                var text;
                if (/<[a-zA-Z]/.test(raw)) {
                    var d = document.createElement('div');
                    d.innerHTML = raw;
                    text = d.textContent || '';
                } else {
                    text = raw;
                }
                totalChars += _wpsWordCount(text);
                totalLines += Math.ceil(text.replace(/\s+/g, '').length / 28);
            }
            var pages = Math.floor(totalLines / 22 * 10) / 10;
            return { chars: totalChars, lines: totalLines, pages: pages };
        }
        function _wpsWordCount(s) {
            var cjkRe = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
            var count = 0, i = 0;
            while (i < s.length) {
                if (cjkRe.test(s[i])) { count++; i++; }
                else {
                    var start = i;
                    while (i < s.length && !cjkRe.test(s[i])) i++;
                    if (s.substring(start, i).replace(/\s/g, '').length > 0) count++;
                }
            }
            return count;
        }
        function pushUndo() {
            try { undoStack.push(JSON.parse(JSON.stringify(items))); if (undoStack.length > undoLimit) undoStack.shift(); } catch(e) {}
        }
        function undo() {
            if (undoStack.length === 0) { showToast('没有可撤销的操作'); return; }
            items = undoStack.pop();
            collapsedIdx = {};
            selectedIdx = -1;
            selectedRange = [];
            ctxTargetIdx = -1;
            save();
            render();
            showToast('已撤销');
        }
        function handleContextAction(action) {
            var ctxItems = getCtxItems();
            if (ctxTargetIdx < 0 || ctxTargetIdx >= ctxItems.length) return;
            if (action !== 'paste-format' && action !== 'copy-format') { selectedRange = []; }
            if (action === 'add') {
                pushUndo();
                var target = ctxItems[ctxTargetIdx];
                var newItem, newIdx;
                var filterActive = getCtxFilterActive();
                if (target && HEADING_LEVELS[target.level] && filterActive) {
                    var insertAt = findHeadingRangeEnd(ctxTargetIdx, ctxItems) + 1;
                    newItem = { level: target.level, text: '' };
                    ctxItems.splice(insertAt, 0, newItem);
                    ctxRemapCollapsedAfterInsert(insertAt);
                    newIdx = insertAt;
                } else {
                    newItem = { level: 'level-body', text: '' };
                    ctxItems.splice(ctxTargetIdx + 1, 0, newItem);
                    ctxRemapCollapsedAfterInsert(ctxTargetIdx + 1);
                    newIdx = ctxTargetIdx + 1;
                }
                ctxSave();
                ctxRender();
                setCtxSelectedIdx(newIdx);
                var bodyId = ctxIsOther ? 'paMirrorBody' : 'paBody';
                var body = document.getElementById(bodyId);
                var divs = body.querySelectorAll('.paItem');
                for (var k = 0; k < divs.length; k++) {
                    if (parseInt(divs[k].dataset.idx, 10) === newIdx) {
                        (ctxIsOther ? enterOtherMirrorEdit : enterEdit)(divs[k], newIdx);
                        break;
                    }
                }
            } else if (action === 'divadd-1' || action === 'divadd-2' || action === 'divadd-3' || action === 'divadd-4' || action === 'divadd-5') {
                // 在参考段上新增：新增的仍是参考段，挂到同一宿主下
                if (ctxRef) {
                    var refHost = ctxItems[ctxTargetIdx];
                    if (!refHost || !Array.isArray(refHost.refs)) { hideContextMenu(); return; }
                    pushUndo();
                    var refAddCount = parseInt(action.charAt(action.length - 1), 10);
                    var newRefs = [];
                    for (var rbi = 0; rbi < refAddCount; rbi++) newRefs.push({ level: 'level-body', text: '' });
                    refHost.refs.splice.apply(refHost.refs, [ctxRef.refIdx + 1, 0].concat(newRefs));
                    if (!ctxIsOther) paRefOpenIdx = ctxTargetIdx; else paMirrorRefOpenIdx = ctxTargetIdx;
                    ctxSave();
                    ctxRender();
                    hideContextMenu();
                    return;
                }
                // 在普通段落上新增：先收起参考，再在其后正常插入普通段落
                paCloseRefs();
                pushUndo();
                var addCount = parseInt(action.charAt(action.length - 1), 10);
                var blankItems = [];
                for (var bi = 0; bi < addCount; bi++) blankItems.push({ level: 'level-body', text: '' });
                ctxItems.splice.apply(ctxItems, [ctxTargetIdx + 1, 0].concat(blankItems));
                ctxSave();
                ctxRender();
                hideContextMenu();
                return;
            } else if (action === 'split-break') {
                var curItem = ctxItems[ctxTargetIdx];
                if (!curItem) { hideContextMenu(); return; }
                var raw = (curItem.text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?p>/gi, '\n').replace(/<\/?div\s*[^>]*>/gi, '\n');
                var pieces = raw.split(/\n+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
                if (pieces.length <= 1) { hideContextMenu(); showToast('没有可拆分的内容'); return; }
                pushUndo();
                var newBlocks = [];
                for (var pi = 0; pi < pieces.length; pi++) {
                    var nb = { level: 'level-body', text: pieces[pi] };
                    if (curItem.bg) nb.bg = curItem.bg;
                    newBlocks.push(nb);
                }
                ctxItems.splice(ctxTargetIdx, 1);
                ctxItems.splice.apply(ctxItems, [ctxTargetIdx, 0].concat(newBlocks));
                if (ctxIsOther) { paOtherCollapsedIdx = {}; paOtherMirrorCollapsedIdx = {}; paOtherMirrorSelectedIdx = -1; paOtherSelectedIdx = -1; }
                else { collapsedIdx = {}; selectedIdx = -1; paMirrorCollapsedIdx = {}; paMirrorSelectedIdx = -1; }
                ctxSave();
                ctxRender();
            } else if (action === 'merge-prev') {
                var curItem = ctxItems[ctxTargetIdx];
                if (!curItem || ctxTargetIdx <= 0) { hideContextMenu(); return; }
                var prevItem = ctxItems[ctxTargetIdx - 1];
                if (prevItem.kind === 'divider') { hideContextMenu(); return; }
                pushUndo();
                if (curItem.noBreakBefore) {
                    delete curItem.noBreakBefore;
                    if (prevItem.noBreakAfter) delete prevItem.noBreakAfter;
                } else {
                    curItem.noBreakBefore = true;
                    prevItem.noBreakAfter = true;
                }
                ctxSave();
                ctxRender();
            } else if (action === 'merge-next') {
                var curItem = ctxItems[ctxTargetIdx];
                if (!curItem || ctxTargetIdx >= ctxItems.length - 1) { hideContextMenu(); return; }
                var nextItem = ctxItems[ctxTargetIdx + 1];
                if (nextItem.kind === 'divider') { hideContextMenu(); return; }
                pushUndo();
                if (curItem.noBreakAfter) {
                    delete curItem.noBreakAfter;
                    if (nextItem.noBreakBefore) delete nextItem.noBreakBefore;
                } else {
                    curItem.noBreakAfter = true;
                    nextItem.noBreakBefore = true;
                }
                ctxSave();
                ctxRender();
            } else if (action === 'clear-sel-fmt') {
                var _paOk = false, _paErr = null;
                try {
                    _paOk = _paClearFormatInSelection(_paCtxSavedRange || null);
                    if (_paOk) _paClearItemLevelStylesForEditing();
                } catch(err) { _paErr = err; console.error('clear-sel-fmt error:', err); }
                hideContextMenu();
                if (_paErr) { try { if (typeof showToast === 'function') showToast('清除出错: ' + _paErr.message); } catch(ee){} }
                else if (_paOk) { try { if (typeof showToast === 'function') showToast('已清除选取格式'); } catch(ee){} }
                else { try { if (typeof showToast === 'function') showToast('请先在编辑态选取要清除格式的文字'); } catch(ee){} }
            } else if (action === 'toggle-collapse') {
                var curItem = ctxItems[ctxTargetIdx];
                if (!curItem || curItem.kind === 'divider') { hideContextMenu(); return; }
                pushUndo();
                if (curItem.collapsed) {
                    delete curItem.collapsed;
                } else {
                    curItem.collapsed = true;
                }
                ctxSave();
                ctxRender();
            } else if (action === 'delete') {
                if (ctxRef) {
                    var refDel = _ctxRefItem();
                    if (!refDel) { hideContextMenu(); return; }
                    pushUndo();
                    var hostDel = ctxItems[ctxTargetIdx];
                    hostDel.refs.splice(ctxRef.refIdx, 1);
                    if (!hostDel.refs.length) delete hostDel.refs;
                    if (!ctxIsOther && paRefOpenIdx === ctxTargetIdx && !hostDel.refs) paRefOpenIdx = -1;
                    if (ctxIsOther && paMirrorRefOpenIdx === ctxTargetIdx && !hostDel.refs) paMirrorRefOpenIdx = -1;
                    ctxSave();
                    ctxRender();
                    return;
                }
                var delItem = ctxItems[ctxTargetIdx];
                if (delItem && delItem.kind !== 'divider' && HEADING_LEVELS[delItem.level] && (delItem.collapsed || getCtxCollapsedIdx()[ctxTargetIdx])) {
                    if (!confirm('确定删除该标题及其所属所有内容？')) { hideContextMenu(); return; }
                    pushUndo();
                    var endIdx = ctxTargetIdx + 1;
                    while (endIdx < ctxItems.length) {
                        var it = ctxItems[endIdx];
                        if (!it) { endIdx++; continue; }
                        if (it.kind === 'divider') break;
                        var o = LEVEL_ORDER[it.level];
                        if (o === undefined) o = 4;
                        if (o <= (LEVEL_ORDER[delItem.level] || 1)) break;
                        endIdx++;
                    }
                    if (delItem.noBreakBefore && ctxTargetIdx > 0 && ctxItems[ctxTargetIdx - 1]) delete ctxItems[ctxTargetIdx - 1].noBreakAfter;
                    var delCount = endIdx - ctxTargetIdx;
                    ctxItems.splice(ctxTargetIdx, delCount);
                    (function() {
                        var srcCol = ctxIsOther ? paOtherCollapsedIdx : collapsedIdx;
                        var srcMirCol = ctxIsOther ? paOtherMirrorCollapsedIdx : paMirrorCollapsedIdx;
                        var nc = {}, mc = {};
                        for (var k in srcCol) {
                            if (!srcCol.hasOwnProperty(k)) continue;
                            var ki = parseInt(k, 10);
                            if (ki >= ctxTargetIdx) { if (ki >= endIdx) nc[ki - delCount] = srcCol[k]; }
                            else nc[ki] = srcCol[k];
                        }
                        for (var mk in srcMirCol) {
                            if (!srcMirCol.hasOwnProperty(mk)) continue;
                            var mki = parseInt(mk, 10);
                            if (mki >= ctxTargetIdx) { if (mki >= endIdx) mc[mki - delCount] = srcMirCol[mk]; }
                            else mc[mki] = srcMirCol[mk];
                        }
                        if (ctxIsOther) { paOtherCollapsedIdx = nc; paOtherMirrorCollapsedIdx = mc; }
                        else { collapsedIdx = nc; paMirrorCollapsedIdx = mc; }
                    })();
                    if (ctxItems.length === 0) ctxItems.push({ level: 'level-body', text: '' });
                    setCtxSelectedIdx(-1);
                    if (!ctxIsOther) paMirrorSelectedIdx = -1;
                    ctxSave();
                    ctxRender();
                } else {
                    pushUndo();
                    if (delItem.noBreakBefore && ctxTargetIdx > 0 && ctxItems[ctxTargetIdx - 1]) delete ctxItems[ctxTargetIdx - 1].noBreakAfter;
                    if (delItem.noBreakAfter && ctxTargetIdx < ctxItems.length - 1 && ctxItems[ctxTargetIdx + 1]) delete ctxItems[ctxTargetIdx + 1].noBreakBefore;
                    ctxItems.splice(ctxTargetIdx, 1);
                    ctxRemapCollapsedAfterDelete(ctxTargetIdx);
                    if (ctxItems.length === 0) ctxItems.push({ level: 'level-body', text: '' });
                    setCtxSelectedIdx(-1);
                    if (!ctxIsOther) paMirrorSelectedIdx = -1;
                    ctxSave();
                    ctxRender();
                }
            } else if (action === 'tech-stats') {
                hideContextMenu();
                if (ctxTargetIdx < 0 || ctxTargetIdx >= ctxItems.length) return;
                var techItem = ctxItems[ctxTargetIdx];
                if (techItem.kind === 'divider') return;
                var stats = paCalcTechStats(ctxTargetIdx, ctxItems);
                var popup = document.getElementById('paTechPopup');
                popup.textContent = '共' + stats.chars + '字，' + stats.lines + '行，' + stats.pages.toFixed(1) + '页';
                var menu = document.getElementById('paContextMenu');
                var mx = parseInt(menu.style.left) || 0;
                var my = parseInt(menu.style.top) || 0;
                popup.style.left = (mx + menu.offsetWidth + 8) + 'px';
                popup.style.top = my + 'px';
                popup.classList.add('show');
                setTimeout(function() {
                    document.addEventListener('click', function paTechClose(e) {
                        if (!e.target.closest('#paTechPopup') && !e.target.closest('#paContextMenu')) {
                            popup.classList.remove('show');
                            document.removeEventListener('click', paTechClose);
                        }
                    });
                }, 0);
            } else if (action === 'copy-text' || action === 'copy-single') {
                var copyItem = ctxItems[ctxTargetIdx];
                if (copyItem && copyItem.text != null && typeof copyItem.text === 'string') {
                    navigator.clipboard.writeText(copyItem.text).then(function() {
                        showToast('已复制本段');
                    }).catch(function() {
                        var ta = document.createElement('textarea');
                        ta.value = copyItem.text;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        showToast('已复制本段');
                    });
                } else {
                    showToast('无可复制内容');
                }
            } else if (action === 'copy-section') {
                if (ctxItems[ctxTargetIdx].kind === 'divider') { hideContextMenu(); return; }
                var st = ctxTargetIdx;
                var en = ctxIsOther ? computeOtherSubtreeEnd(st) : computeSubtreeEnd(st);
                var h = '';
                for (var ei = st; ei < en; ei++) {
                    var x = ctxItems[ei];
                    if (!x || x.kind === 'divider') { h += '<p style="margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;">&nbsp;</p>'; continue; }
                    var lv = x.level || 'level-body', tx0 = x.text || '', tx = /<[a-zA-Z]/.test(tx0) ? tx0 : paEscapeHtml(tx0);
                    h += '<p style="' + FORMAT_STANDARD.fullStyle(lv) + '">' + tx + '</p>';
                }
                var pt = '';
                try { var t = document.createElement('div'); t.innerHTML = h; pt = t.innerText || ''; } catch (e) { pt = h.replace(/<[^>]+>/g, ''); }
                try {
                    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
                        var bHtml = new Blob([h], { type: 'text/html' }), bText = new Blob([pt], { type: 'text/plain' });
                        navigator.clipboard.write([new ClipboardItem({ 'text/html': bHtml, 'text/plain': bText })]).then(function() { showToast('已复制本部分到剪贴板'); });
                    } else { (function(tx){ try { var ta = document.createElement('textarea'); ta.value = tx; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('已复制本部分到剪贴板'); } catch(e2) { showToast('复制失败'); } })(pt); }
                } catch (e) { (function(tx){ try { var ta = document.createElement('textarea'); ta.value = tx; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('已复制本部分到剪贴板'); } catch(e2) { showToast('复制失败'); } })(pt); }
            } else if (action === 'copy-format') {
                var source = ctxItems[ctxTargetIdx];
                if (source && source.kind !== 'divider') {
                    copiedFormat = {};
                    if (source.level) copiedFormat.level = source.level;
                    if (source.bg) copiedFormat.bg = source.bg;
                    if (source.marks) copiedFormat.marks = JSON.parse(JSON.stringify(source.marks));
                    if (source.fontFamily) copiedFormat.fontFamily = source.fontFamily;
                    if (source.fontSize) copiedFormat.fontSize = source.fontSize;
                    if (source.noBreakBefore) copiedFormat.noBreakBefore = true;
                    if (source.noBreakAfter) copiedFormat.noBreakAfter = true;
                    showToast('已复制格式');
                } else {
                    showToast('无法复制格式');
                }
            } else if (action === 'paste-text') {
                navigator.clipboard.readText().then(function(clipText) {
                    if (!clipText) { showToast('剪贴板为空'); return; }
                    var target = ctxItems[ctxTargetIdx];
                    if (target && target.kind !== 'divider') {
                        pushUndo();
                        target.text = clipText;
                        ctxSave();
                        ctxRender();
                        setCtxSelectedIdx(ctxTargetIdx);
                        showToast('已粘贴文本');
                    } else {
                        showToast('当前位置无法粘贴');
                    }
                }).catch(function() {
                    showToast('无法读取剪贴板');
                });
            } else if (action === 'paste-format') {
                if (!copiedFormat) { showToast('请先复制格式'); return; }
                pushUndo();
                var targets = [];
                if (selectedRange.length === 2) {
                    var rs = Math.min(selectedRange[0], selectedRange[1]);
                    var re = Math.max(selectedRange[0], selectedRange[1]);
                    for (var ri = rs; ri <= re; ri++) {
                        if (ctxItems[ri] && ctxItems[ri].kind !== 'divider') targets.push({ item: ctxItems[ri], idx: ri });
                    }
                } else if (ctxTargetIdx >= 0 && ctxTargetIdx < ctxItems.length) {
                    if (ctxItems[ctxTargetIdx] && ctxItems[ctxTargetIdx].kind !== 'divider') targets.push({ item: ctxItems[ctxTargetIdx], idx: ctxTargetIdx });
                }
                if (targets.length === 0) { showToast('无法粘贴格式'); return; }
                for (var ti = 0; ti < targets.length; ti++) {
                    var tgt = targets[ti].item;
                    var tgtIdx = targets[ti].idx;
                    if (copiedFormat.level) tgt.level = copiedFormat.level;
                    else delete tgt.level;
                    if (copiedFormat.bg) tgt.bg = copiedFormat.bg;
                    else delete tgt.bg;
                    if (copiedFormat.marks) tgt.marks = JSON.parse(JSON.stringify(copiedFormat.marks));
                    else delete tgt.marks;
                    if (copiedFormat.fontFamily) tgt.fontFamily = copiedFormat.fontFamily; else delete tgt.fontFamily;
                    if (copiedFormat.fontSize) tgt.fontSize = copiedFormat.fontSize; else delete tgt.fontSize;
                    if (copiedFormat.noBreakBefore) {
                        tgt.noBreakBefore = true;
                        if (tgtIdx > 0 && ctxItems[tgtIdx - 1] && ctxItems[tgtIdx - 1].kind !== 'divider') ctxItems[tgtIdx - 1].noBreakAfter = true;
                    } else {
                        delete tgt.noBreakBefore;
                        if (tgtIdx > 0 && ctxItems[tgtIdx - 1]) delete ctxItems[tgtIdx - 1].noBreakAfter;
                    }
                    if (copiedFormat.noBreakAfter) {
                        tgt.noBreakAfter = true;
                        if (tgtIdx < ctxItems.length - 1 && ctxItems[tgtIdx + 1] && ctxItems[tgtIdx + 1].kind !== 'divider') ctxItems[tgtIdx + 1].noBreakBefore = true;
                    } else {
                        delete tgt.noBreakAfter;
                        if (tgtIdx < ctxItems.length - 1 && ctxItems[tgtIdx + 1]) delete ctxItems[tgtIdx + 1].noBreakBefore;
                    }
                }
                ctxSave();
                ctxRender();
                setCtxSelectedIdx(targets[targets.length - 1].idx);
                showToast('已粘贴格式' + (targets.length > 1 ? '（' + targets.length + '项）' : ''));
            } else if (action === 'ref-add') {
                if (ctxItems[ctxTargetIdx].kind === 'divider') { hideContextMenu(); return; }
                pushUndo();
                var hostItem = ctxItems[ctxTargetIdx];
                if (!Array.isArray(hostItem.refs)) hostItem.refs = [];
                hostItem.refs.push({ level: 'level-body', text: '' });
                var newRefIdx = hostItem.refs.length - 1;
                if (!ctxIsOther) paRefOpenIdx = ctxTargetIdx; else paMirrorRefOpenIdx = ctxTargetIdx;
                ctxSave();
                ctxRender();
                // 展开后立即进入新参考段的编辑态
                var hostIdxRef = ctxTargetIdx;
                setTimeout(function() {
                    var bodyEl = document.getElementById(ctxIsOther ? 'paMirrorBody' : 'paBody');
                    var els = bodyEl ? bodyEl.querySelectorAll('.paRefItem[data-host-idx="' + hostIdxRef + '"][data-ref-idx="' + newRefIdx + '"]') : [];
                    if (els && els[0]) enterRefEdit(els[0], hostIdxRef, newRefIdx, ctxIsOther);
                }, 0);
            } else if (action === 'ref-delete') {
                var refItem = _ctxRefItem();
                if (!refItem) { hideContextMenu(); return; }
                pushUndo();
                var hostForDel = ctxItems[ctxTargetIdx];
                hostForDel.refs.splice(ctxRef.refIdx, 1);
                if (!hostForDel.refs.length) delete hostForDel.refs;
                if (!ctxIsOther && paRefOpenIdx === ctxTargetIdx && !hostForDel.refs) paRefOpenIdx = -1;
                if (ctxIsOther && paMirrorRefOpenIdx === ctxTargetIdx && !hostForDel.refs) paMirrorRefOpenIdx = -1;
                ctxSave();
                ctxRender();
            } else if (action === 'tag-edit') {
                if (ctxRef) { hideContextMenu(); return; }
                if (ctxItems[ctxTargetIdx].kind === 'divider') { hideContextMenu(); return; }
                var current = ctxItems[ctxTargetIdx].tag || '';
                var idxRef = ctxTargetIdx;
                hideContextMenu();
                paShowTagDialog(current, function(input) {
                    if (input === null) return;
                    pushUndo();
                    input = input.replace(/[\s\u00a0]+$/g, '');
                    if (input) ctxItems[idxRef].tag = input;
                    else delete ctxItems[idxRef].tag;
                    ctxSave();
                    ctxRender();
                    setCtxSelectedIdx(idxRef);
                });
                return;
            } else if (action === 'tag-delete') {
                if (ctxRef) { hideContextMenu(); return; }
                if (ctxItems[ctxTargetIdx].kind === 'divider') { hideContextMenu(); return; }
                pushUndo();
                delete ctxItems[ctxTargetIdx].tag;
                ctxSave();
                ctxRender();
                setCtxSelectedIdx(ctxTargetIdx);
            } else if (action === 'level-1' || action === 'level-2' || action === 'level-3' || action === 'level-body' || action === 'level-title' || action === 'level-secret' || action === 'level-attachment' || action === 'level-date' || action === 'level-author' || action === 'level-recipient') {
                if (!ctxRef && ctxItems[ctxTargetIdx].kind === 'divider') { hideContextMenu(); return; }
                pushUndo();
                if (ctxRef) {
                    // 参考段：只改层级与格式，不参与正文合并/折叠
                    var refObj = _ctxRefItem();
                    if (!refObj) { hideContextMenu(); return; }
                    delete refObj.marks;
                    delete refObj.bg;
                    delete refObj.fontFamily;
                    if (refObj.text) {
                        var rd = document.createElement('div');
                        rd.innerHTML = refObj.text;
                        refObj.text = rd.textContent || rd.innerText || '';
                    }
                    refObj.level = action;
                    ctxSave();
                    ctxRender();
                    hideContextMenu();
                    return;
                }
                var levelChangedItem = ctxItems[ctxTargetIdx];
                if (levelChangedItem.noBreakBefore && ctxTargetIdx > 0 && ctxItems[ctxTargetIdx - 1]) delete ctxItems[ctxTargetIdx - 1].noBreakAfter;
                if (levelChangedItem.noBreakAfter && ctxTargetIdx < ctxItems.length - 1 && ctxItems[ctxTargetIdx + 1]) delete ctxItems[ctxTargetIdx + 1].noBreakBefore;
                delete levelChangedItem.noBreakBefore;
                delete levelChangedItem.noBreakAfter;
                delete levelChangedItem.marks;
                delete levelChangedItem.bg;
                delete levelChangedItem.fontFamily;
                if (levelChangedItem.text) {
                    var tmpDiv = document.createElement('div');
                    tmpDiv.innerHTML = levelChangedItem.text;
                    levelChangedItem.text = tmpDiv.textContent || tmpDiv.innerText || '';
                }
                ctxItems[ctxTargetIdx].level = action;
                delete ctxItems[ctxTargetIdx].kind;
                if (!HEADING_LEVELS[action]) { 
                    var ctxCol = getCtxCollapsedIdx();
                    var ctxMirCol = getCtxMirrorCollapsedIdx();
                    delete ctxCol[ctxTargetIdx]; delete ctxMirCol[ctxTargetIdx]; 
                }
                ctxSave();
                ctxRender();
                setCtxSelectedIdx(ctxTargetIdx);
            } else if (action === 'repeat-last') {
                if (!_paLastAction) { hideContextMenu(); return; }
                var menuEl = document.getElementById('paContextMenu');
                var items = menuEl.querySelectorAll('.paCtxItem:not(.paCtxHasSub)');
                for (var ri = 0; ri < items.length; ri++) {
                    if (items[ri].textContent.trim() === _paLastAction && (items[ri].classList.contains('paCtxMarkItem') || items[ri].classList.contains('paCtxBgItem'))) {
                        items[ri].click(); return;
                    }
                }
                hideContextMenu();
            } else if (action === 'undo') {
                undo();
            } else if (action === 'extract') {
                if (ctxItems[ctxTargetIdx].kind === 'divider') { hideContextMenu(); return; }
                var st = ctxTargetIdx;
                var en = ctxIsOther ? computeOtherSubtreeEnd(st) : computeSubtreeEnd(st);
                var h = '';
                for (var ei = st; ei < en; ei++) {
                    var x = ctxItems[ei];
                    if (!x || x.kind === 'divider') { h += '<p style="margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;">&nbsp;</p>'; continue; }
                    var lv = x.level || 'level-body', tx0 = x.text || '', tx = /<[a-zA-Z]/.test(tx0) ? tx0 : paEscapeHtml(tx0);
                    h += '<p style="' + FORMAT_STANDARD.fullStyle(lv) + '">' + tx + '</p>';
                }
                var pt = '';
                try { var t = document.createElement('div'); t.innerHTML = h; pt = t.innerText || ''; } catch (e) { pt = h.replace(/<[^>]+>/g, ''); }
                try {
                    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
                        var bHtml = new Blob([h], { type: 'text/html' }), bText = new Blob([pt], { type: 'text/plain' });
                        navigator.clipboard.write([new ClipboardItem({ 'text/html': bHtml, 'text/plain': bText })]).then(function() { showToast('已提取到剪贴板'); });
                    } else { (function(tx){ try { var ta = document.createElement('textarea'); ta.value = tx; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('已提取到剪贴板'); } catch(e2) { showToast('提取失败'); } })(pt); }
                } catch (e) { (function(tx){ try { var ta = document.createElement('textarea'); ta.value = tx; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('已提取到剪贴板'); } catch(e2) { showToast('提取失败'); } })(pt); }
            }
            hideContextMenu();
        }
        function ctxRemapCollapsedAfterInsert(insertIdx) {
            var srcCol = ctxIsOther ? paOtherCollapsedIdx : collapsedIdx;
            var srcMirCol = ctxIsOther ? paOtherMirrorCollapsedIdx : paMirrorCollapsedIdx;
            var nc = {};
            for (var k in srcCol) {
                if (!srcCol.hasOwnProperty(k)) continue;
                var ki = parseInt(k, 10);
                if (ki >= insertIdx) nc[ki + 1] = srcCol[k];
                else nc[ki] = srcCol[k];
            }
            if (ctxIsOther) paOtherCollapsedIdx = nc; else collapsedIdx = nc;
            var mc = {};
            for (var mk in srcMirCol) {
                if (!srcMirCol.hasOwnProperty(mk)) continue;
                var mi = parseInt(mk, 10);
                if (mi >= insertIdx) mc[mi + 1] = srcMirCol[mk];
                else mc[mi] = srcMirCol[mk];
            }
            if (ctxIsOther) paOtherMirrorCollapsedIdx = mc; else paMirrorCollapsedIdx = mc;
        }
        function ctxRemapCollapsedAfterDelete(deletedIdx) {
            var srcCol = ctxIsOther ? paOtherCollapsedIdx : collapsedIdx;
            var srcMirCol = ctxIsOther ? paOtherMirrorCollapsedIdx : paMirrorCollapsedIdx;
            var nc = {};
            for (var k in srcCol) {
                if (!srcCol.hasOwnProperty(k)) continue;
                var ki = parseInt(k, 10);
                if (ki === deletedIdx) continue;
                if (ki > deletedIdx) nc[ki - 1] = srcCol[k];
                else nc[ki] = srcCol[k];
            }
            if (ctxIsOther) paOtherCollapsedIdx = nc; else collapsedIdx = nc;
            var mc = {};
            for (var mk in srcMirCol) {
                if (!srcMirCol.hasOwnProperty(mk)) continue;
                var mi = parseInt(mk, 10);
                if (mi === deletedIdx) continue;
                if (mi > deletedIdx) mc[mi - 1] = srcMirCol[mk];
                else mc[mi] = srcMirCol[mk];
            }
            if (ctxIsOther) paOtherMirrorCollapsedIdx = mc; else paMirrorCollapsedIdx = mc;
        }
        var _paLastAction = null;
        function paGetSelectionInItem() {
            try {
                var sel = window.getSelection();
                if (!sel.rangeCount || sel.isCollapsed) return null;
                var r = sel.getRangeAt(0);
                var te = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentElement : r.commonAncestorContainer;
                if (te && te.closest) te = te.closest('.paItemText');
                if (!te) return null;
                return r;
            } catch(ex) { return null; }
        }
        function paUpdateLastAction(text) {
            _paLastAction = text;
            var el = document.getElementById('paCtxLastAction');
            if (el) { el.style.display = text ? '' : 'none'; el.textContent = '最近操作（' + (text || '') + '）'; }
        }
        var menuEl = document.getElementById('paContextMenu');
        if (menuEl) {
            menuEl.addEventListener('mousedown', function(e) { e.preventDefault(); });
            menuEl.addEventListener('click', function(e) {
                var it = e.target.closest('.paCtxItem');
                if (!it) return;
                if (it.classList.contains('paCtxHasSub')) return;
                if (it.classList.contains('paCtxBgItem')) {
                    var bg = it.getAttribute('data-bg') || '';
                    var ctxItems = getCtxItems();
                    if (ctxTargetIdx < 0 || ctxTargetIdx >= ctxItems.length) { hideContextMenu(); return; }
                    if (!ctxRef && ctxItems[ctxTargetIdx].kind === 'divider') { hideContextMenu(); return; }
                    var targetObj = _ctxTargetObj();
                    if (!targetObj) { hideContextMenu(); return; }
                    var _paCtxSelRange = ctxRef ? null : paGetSelectionInItem();
                    if (_paCtxSelRange) { applyMarkToSelection('bg', bg); hideContextMenu(); return; }
                    pushUndo();
                    if (bg) targetObj.bg = bg;
                    else delete targetObj.bg;
                    ctxSave();
                    ctxRender();
                    setCtxSelectedIdx(ctxTargetIdx);
                    hideContextMenu();
                    paUpdateLastAction(it.textContent.trim());
                    return;
                }
                if (it.classList.contains('paCtxHighlightItem')) {
                    var hl = it.getAttribute('data-highlight') || '';
                    var ctxItems = getCtxItems();
                    if (ctxTargetIdx < 0 || ctxTargetIdx >= ctxItems.length) { hideContextMenu(); return; }
                    if (!ctxRef && ctxItems[ctxTargetIdx].kind === 'divider') { hideContextMenu(); return; }
                    var targetObj = _ctxTargetObj();
                    if (!targetObj) { hideContextMenu(); return; }
                    var _paCtxSelRange = ctxRef ? null : paGetSelectionInItem();
                    if (_paCtxSelRange) { applyMarkToSelection('bg', hl); hideContextMenu(); return; }
                    pushUndo();
                    if (hl) targetObj.highlight = hl;
                    else delete targetObj.highlight;
                    ctxSave();
                    ctxRender();
                    setCtxSelectedIdx(ctxTargetIdx);
                    hideContextMenu();
                    paUpdateLastAction(it.textContent.trim());
                    return;
                }
                if (it.classList.contains('paCtxFontItem')) {
                    var font = it.getAttribute('data-font') || '';
                    var ctxItems = getCtxItems();
                    if (ctxTargetIdx < 0 || ctxTargetIdx >= ctxItems.length) { hideContextMenu(); return; }
                    if (!ctxRef && ctxItems[ctxTargetIdx].kind === 'divider') { hideContextMenu(); return; }
                    var targetObj = _ctxTargetObj();
                    if (!targetObj) { hideContextMenu(); return; }
                    pushUndo();
                    if (font) targetObj.fontFamily = font;
                    else delete targetObj.fontFamily;
                    ctxSave();
                    ctxRender();
                    setCtxSelectedIdx(ctxTargetIdx);
                    hideContextMenu();
                    paUpdateLastAction(it.textContent.trim());
                    return;
                }
                if (it.classList.contains('paCtxMarkItem')) {
                    var mark = it.getAttribute('data-mark') || '';
                    var ctxItems = getCtxItems();
                    if (ctxTargetIdx < 0 || ctxTargetIdx >= ctxItems.length) { hideContextMenu(); return; }
                    if (!ctxRef && ctxItems[ctxTargetIdx].kind === 'divider') { hideContextMenu(); return; }
                    var _paCtxSelRange = ctxRef ? null : paGetSelectionInItem();
                    if (mark !== 'clear' && _paCtxSelRange) { applyMarkToSelection('mark', mark); hideContextMenu(); return; }
                    pushUndo();
                    var target = _ctxTargetObj();
                    if (!target) { hideContextMenu(); return; }
                    if (mark === 'clear') {
                        delete target.marks;
                        delete target.bg;
                        delete target.highlight;
                        delete target.fontFamily;
                        if (target.text) {
                            var td = document.createElement('div');
                            td.innerHTML = target.text;
                            target.text = td.textContent || td.innerText || '';
                        }
                    } else {
                        if (!target.marks) target.marks = {};
                        if (mark === 'bold' || mark === 'underline' || mark === 'strike' || mark === 'italic') {
                            if (mark === 'bold') {
                                target.marks[mark] = target.marks[mark] === true ? false : true;
                            } else {
                                target.marks[mark] = !target.marks[mark];
                                if (!target.marks[mark]) delete target.marks[mark];
                            }
                        } else if (mark.indexOf('color-') === 0) {
                            var c = mark.substring(6);
                            if (target.marks.color === c) delete target.marks.color;
                            else target.marks.color = c;
                        }
                        var hasAny = false;
                        for (var mk in target.marks) { if (target.marks.hasOwnProperty(mk)) { hasAny = true; break; } }
                        if (!hasAny) delete target.marks;
                    }
                    ctxSave();
                    ctxRender();
                    setCtxSelectedIdx(ctxTargetIdx);
                    hideContextMenu();
                    paUpdateLastAction(it.textContent.trim());
                    return;
                }
                if (it.classList.contains('paCtxStatusItem')) {
                    var stx = it.getAttribute('data-status') || '';
                    var ctxItems = getCtxItems();
                    if (ctxTargetIdx < 0 || ctxTargetIdx >= ctxItems.length) { hideContextMenu(); return; }
                    if (ctxRef) { hideContextMenu(); return; }
                    if (ctxItems[ctxTargetIdx].kind === 'divider') { hideContextMenu(); return; }
                    if (stx === '__custom__') {
                        var customIdx = ctxTargetIdx;
                        hideContextMenu();
                        paShowTagDialog('', function(input) {
                            if (input === null) return;
                            input = input.replace(/[\s\u00a0]+$/g, '');
                            if (!input) return;
                            pushUndo();
                            var ci = getCtxItems();
                            if (customIdx >= 0 && customIdx < ci.length) {
                                ci[customIdx].status = input;
                                ctxSave();
                                ctxRender();
                                setCtxSelectedIdx(customIdx);
                            }
                        }, { title: '请输入自定义状态', okText: '确定', singleLine: true });
                        return;
                    }
                    pushUndo();
                    if (stx) ctxItems[ctxTargetIdx].status = stx;
                    else delete ctxItems[ctxTargetIdx].status;
                    ctxSave();
                    ctxRender();
                    setCtxSelectedIdx(ctxTargetIdx);
                    hideContextMenu();
                    return;
                }
                var act = it.getAttribute('data-action');
                if (!act) return;
                handleContextAction(act);
            });
            menuEl.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        }
        var _notepadCtxRange = null;
        var _npCtxArticlePara = null;
        var _npCtxTargetPara = null;
        var _notepadSymbolSavedRange = null;
        var _notepadSymbolActiveTab = 'custom';
        var _notepadSymbolEditMode = false;
        var _npCtxIdxPara = null;
        function _notepadDefaultCustomSymbols() { return ['〔〕','{}','“”','《》','【】','·','……','～',':','★','☆','￥']; }
        function _notepadUserCustomSymbols() {
            try { return (DataLayer.get('notepadCustomSymbols')) || []; } catch(e) {}
            return [];
        }
        function _notepadCustomSymbols() {
            var preset = _notepadDefaultCustomSymbols();
            var user = _notepadUserCustomSymbols();
            var arr = preset.slice();
            for (var i = 0; i < user.length; i++) { if (arr.indexOf(user[i]) === -1) arr.push(user[i]); }
            return arr;
        }
        function _saveNotepadCustomSymbols(arr) { try { DataLayer.set('notepadCustomSymbols', arr || []) } catch(e) {} }
        function _notepadSymbolSets() {
            return {
                custom: _notepadCustomSymbols(),
                circle: ['⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'],
                paren: ['⑴','⑵','⑶','⑷','⑸','⑹','⑺','⑻','⑼','⑽','⑾','⑿','⒀','⒁','⒂','⒃','⒄','⒅','⒆','⒇']
            };
        }
        function switchNotepadSymbolTab(tab) {
            _notepadSymbolActiveTab = tab || 'custom';
            if (_notepadSymbolActiveTab !== 'custom') _notepadSymbolEditMode = false;
            var tb = document.getElementById('notepadSymbolToolbar');
            if (tb) tb.classList.toggle('editing', _notepadSymbolEditMode && _notepadSymbolActiveTab === 'custom');
            var editBtn = document.getElementById('notepadSymbolEditBtn');
            if (editBtn) {
                editBtn.style.display = _notepadSymbolActiveTab === 'custom' ? '' : 'none';
                editBtn.classList.toggle('active', _notepadSymbolEditMode);
                editBtn.textContent = _notepadSymbolEditMode ? '完成' : '编辑';
            }
            var tabs = document.querySelectorAll('.npSymbolTab');
            for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].getAttribute('data-npsymtab') === _notepadSymbolActiveTab);
            _renderNotepadSymbolGrid();
        }
        function _renderNotepadSymbolGrid() {
            var grid = document.getElementById('notepadSymbolGrid');
            if (!grid) return;
            var sets = _notepadSymbolSets();
            var arr = sets[_notepadSymbolActiveTab] || sets.custom;
            grid.innerHTML = '';
            for (var i = 0; i < arr.length; i++) {
                var wrap = document.createElement('span');
                wrap.className = 'npSymbolItemWrap';
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'npSymbolItem';
                b.textContent = arr[i];
                b.setAttribute('data-symbol', arr[i]);
                wrap.appendChild(b);
                if (_notepadSymbolActiveTab === 'custom' && _notepadDefaultCustomSymbols().indexOf(arr[i]) === -1) {
                    var del = document.createElement('button');
                    del.type = 'button';
                    del.className = 'npSymbolDel';
                    del.textContent = '×';
                    del.setAttribute('data-symbol-del', arr[i]);
                    wrap.appendChild(del);
                }
                grid.appendChild(wrap);
            }
        }
        function showNotepadSymbolToolbar(x, y) {
            var tb = document.getElementById('notepadSymbolToolbar');
            if (!tb) return;
            bindNotepadSymbolToolbar();
            switchNotepadSymbolTab(_notepadSymbolActiveTab || 'custom');
            tb.style.zIndex = '2147483600';
            tb.classList.add('show');
            var w = tb.offsetWidth, h = tb.offsetHeight;
            var left = Math.min(Math.max(4, x), window.innerWidth - w - 8);
            var top = Math.min(Math.max(4, y), window.innerHeight - h - 8);
            tb.style.left = left + 'px';
            tb.style.top = top + 'px';
        }
        function insertNotepadSymbol(sym) {
            var editor = document.getElementById('notepadEditor');
            if (!editor || !sym) return;
            editor.focus();
            var sel = window.getSelection();
            if (_notepadSymbolSavedRange) { try { sel.removeAllRanges(); sel.addRange(_notepadSymbolSavedRange); } catch(e) {} }
            try { document.execCommand('insertText', false, sym); } catch(e) {}
            _markWriteNoteArticleDirty();
            document.getElementById('notepadSymbolToolbar').classList.remove('show');
        }
        function bindNotepadSymbolToolbar() {
            var tb = document.getElementById('notepadSymbolToolbar');
            if (!tb || tb._bound) return;
            tb._bound = true;
            tb.addEventListener('mousedown', function(e) {
                e.stopPropagation();
                if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.npSymbolGrid')) return;
                e.preventDefault();
                var r = tb.getBoundingClientRect();
                var sx = e.clientX, sy = e.clientY, sl = r.left, st = r.top;
                function onMove(ev) {
                    tb.style.left = Math.max(4, Math.min(window.innerWidth - tb.offsetWidth - 8, sl + ev.clientX - sx)) + 'px';
                    tb.style.top = Math.max(4, Math.min(window.innerHeight - tb.offsetHeight - 8, st + ev.clientY - sy)) + 'px';
                }
                function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            tb.addEventListener('click', function(e) {
                e.stopPropagation();
                if (e.target.closest('#notepadSymbolCloseBtn')) { tb.classList.remove('show'); return; }
                var tab = e.target.closest('.npSymbolTab');
                if (tab) { switchNotepadSymbolTab(tab.getAttribute('data-npsymtab')); return; }
                if (e.target.closest('#notepadSymbolEditBtn')) { toggleNotepadSymbolEdit(); return; }
                if (e.target.closest('#notepadSymbolAddBtn')) { addNotepadCustomSymbol(); return; }
                var del = e.target.closest('.npSymbolDel');
                if (del) { deleteNotepadCustomSymbol(del.getAttribute('data-symbol-del')); return; }
                var item = e.target.closest('.npSymbolItem');
                if (item) {
                    if (_notepadSymbolEditMode && _notepadSymbolActiveTab === 'custom') return;
                    insertNotepadSymbol(item.getAttribute('data-symbol') || item.textContent);
                }
            });
            var input = document.getElementById('notepadSymbolCustomInput');
            if (input) input.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); addNotepadCustomSymbol(); } });
        }
        function toggleNotepadSymbolEdit() {
            if (_notepadSymbolActiveTab !== 'custom') return;
            _notepadSymbolEditMode = !_notepadSymbolEditMode;
            switchNotepadSymbolTab('custom');
        }
        function deleteNotepadCustomSymbol(sym) {
            var arr = _notepadUserCustomSymbols();
            var idx = arr.indexOf(sym);
            if (idx >= 0) arr.splice(idx, 1);
            _saveNotepadCustomSymbols(arr);
            switchNotepadSymbolTab('custom');
        }
        function addNotepadCustomSymbol() {
            var input = document.getElementById('notepadSymbolCustomInput');
            var v = input ? input.value.trim() : '';
            if (!v) return;
            var arr = _notepadUserCustomSymbols();
            if (_notepadDefaultCustomSymbols().indexOf(v) === -1 && arr.indexOf(v) === -1) arr.push(v);
            _saveNotepadCustomSymbols(arr);
            if (input) input.value = '';
            switchNotepadSymbolTab('custom');
        }
        function _isArticleTitlePara(np) {
            if (np.getAttribute('data-outline-level') === '1') return true;
            var ff = (np.style.fontFamily || '').toLowerCase();
            var fs = np.style.fontSize;
            var ta = (np.style.textAlign || '').toLowerCase();
            if ((fs === '20px' || fs === '20pt') && ff.indexOf('小标宋') !== -1 && ta === 'center') return true;
            var span = np.querySelector('span');
            if (span) {
                var sff = (span.style.fontFamily || '').toLowerCase();
                var sfs = span.style.fontSize;
                if ((sfs === '20px' || sfs === '20pt') && sff.indexOf('小标宋') !== -1) return true;
            }
            return false;
        }
        function _npCtxIsArticleTitleOnlyPara(p) {
            if (!p || p.nodeType !== 1) return false;
            var txt = (p.textContent || '').replace(/^\s+|\s+$/g, '');
            if (!txt) return false;
            if (p.getAttribute('data-level') === 'title') return true;
            if (window._npManualLooksArticleTitle && window._npManualLooksArticleTitle(p, txt)) return true;
            return false;
        }
        function _doUpdateNotepadIndexTitle() {
            var editor = document.getElementById('notepadEditor');
            if (!editor || !_npCtxIdxPara) return;
            var idxPara = _npCtxIdxPara;
            var ps = editor.querySelectorAll('p');
            var startIdx = -1;
            for (var i = 0; i < ps.length; i++) { if (ps[i] === idxPara) { startIdx = i; break; } }
            if (startIdx < 0) { showToast('未找到索引段落'); return; }
            var titleParts = [];
            for (var j = startIdx + 1; j < ps.length; j++) {
                var np = ps[j];
                var nt = (np.textContent || '').replace(/^\s+|\s+$/g, '');
                if (!nt) continue;
                // 到下一条索引标题即停止（索引标题不会作为本篇文章的标题）
                if (np.getAttribute('data-outline-level') === '1') break;
                if (/^【[^】]+】/.test(nt)) break;
                if (_npCtxIsArticleTitleOnlyPara(np)) { titleParts.push(nt); }
                else { if (titleParts.length > 0) break; }
            }
            if (titleParts.length === 0) {
                if (idxPara.getAttribute('data-level') === 'title') {
                    showToast('该索引与文章标题为同一段，无需更新');
                } else {
                    showToast('未找到下方的文章标题');
                }
                return;
            }
            var articleTitle = titleParts.join('').replace(/[\r\n]+/g, '').replace(/\s+/g, ' ').trim();
            var fullText = idxPara.textContent || '';
            // 保留索引前面的“日期”部分（如 202610、2026年10月、【202610】等），只替换标题文字
            var datePrefix = fullText.match(/^\s*(?:【\s*\d[^】]*】\s*)?\d{4,8}(?:\s*[年.\-\/]\s*\d{1,2}(?:\s*[月.\-\/]\s*\d{1,2}\s*日?)?)?(?:\s*[、.．:：]?\s*)?/);
            var prefix = '';
            if (datePrefix && datePrefix[0] && /\d/.test(datePrefix[0])) {
                prefix = datePrefix[0];
            } else {
                var bm = fullText.match(/^\s*【[^】]*】\s*/);
                prefix = bm ? bm[0] : '';
            }
            if (prefix && !/\s$/.test(prefix) && !/[】、.．:：]$/.test(prefix)) prefix += '  ';
            var newHtml = prefix + articleTitle;
            idxPara.textContent = newHtml;
            saveCurrentEditor();
            updateFooterTimestamp();
            _refreshOutlineIfOpen();
            showToast('已更新为：' + newHtml);
        }
        window._npUpdateIndexTitleImpl = _doUpdateNotepadIndexTitle;
        var notepadEditorCtx = document.getElementById('notepadEditor');
        try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch(e) {}
        function paNormalizeText(html) {
            if (!/<[a-zA-Z]/.test(html)) {
                var d = document.createElement('div');
                d.innerHTML = html;
                return d.textContent || d.innerText || '';
            }
            return html;
        }
        function applyMarkToSelection(type, value) {
            var sel = window.getSelection();
            if (!sel.rangeCount) { _paCtxSelRange = null; return; }
            if (sel.isCollapsed) {
                _paCtxSelRange = null;
                var ac = sel.anchorNode;
                var anchorEl = ac && ac.nodeType === 3 ? ac.parentElement : ac;
                var inTextMode = anchorEl && anchorEl.closest && anchorEl.closest('#paPreviewEditor');
                var parentSpan = inTextMode && anchorEl ? anchorEl.closest('span[data-level]') : null;
                if (parentSpan) {
                    var dmarksStr = parentSpan.getAttribute('data-marks');
                    var m = dmarksStr ? JSON.parse(dmarksStr) : {};
                    if (type === 'mark') {
                        if (value === 'bold') {
                            m.bold = m.bold === true ? false : true;
                        } else if (value === 'underline' || value === 'strike' || value === 'italic') {
                            m[value] = !m[value];
                            if (!m[value]) delete m[value];
                        } else if (value.indexOf('color-') === 0) {
                            var c = value.substring(6);
                            if (m.color === c) delete m.color;
                            else m.color = c;
                        }
                    }
                    var style = parentSpan.getAttribute('style') || '';
                    if (m.bold === true && style.indexOf('font-weight:bold') === -1) parentSpan.style.fontWeight = 'bold';
                    else if (m.bold === false) parentSpan.style.fontWeight = '';
                    parentSpan.setAttribute('data-marks', JSON.stringify(m));
                    syncPreviewBackToItems(document.getElementById('paPreviewEditor'), false);
                    save();
                } else {
                    var itemText = anchorEl && anchorEl.closest ? anchorEl.closest('.paItemText') : null;
                    if (!itemText && anchorEl && anchorEl.closest) itemText = anchorEl.closest('[contenteditable="true"]');
                    if (itemText) {
                        var itemDiv = itemText.closest ? itemText.closest('.paItem') : null;
                        if (itemDiv) {
                            var idx = parseInt(itemDiv.dataset.idx, 10);
                            if (isFinite(idx)) {
                                var si = itemDiv.closest('#paOtherMirrorBody') ? paOtherItems : (itemDiv.closest('#paMirrorBody') ? paOtherItems : items);
                                if (si[idx] && si[idx].kind !== 'divider') {
                                    if (type === 'mark') {
                                        if (!si[idx].marks) si[idx].marks = {};
                                        if (value === 'bold') {
                                            si[idx].marks.bold = si[idx].marks.bold === true ? false : true;
                                        } else if (value === 'underline' || value === 'strike' || value === 'italic') {
                                            si[idx].marks[value] = !si[idx].marks[value];
                                            if (!si[idx].marks[value]) delete si[idx].marks[value];
                                        } else if (value.indexOf('color-') === 0) {
                                            var c = value.substring(6);
                                            if (si[idx].marks.color === c) delete si[idx].marks.color;
                                            else si[idx].marks.color = c;
                                        }
                                        var hasAny = false;
                                        for (var mk in si[idx].marks) { if (si[idx].marks.hasOwnProperty(mk)) { hasAny = true; break; } }
                                        if (!hasAny) delete si[idx].marks;
                                    } else if (type === 'bg') {
                                        si[idx].bg = si[idx].bg === value ? '' : value;
                                    }
                                    save();
                                    var tw = itemDiv.querySelector('.paItemText');
                                    if (tw) {
                                        if (type === 'mark') applyMarksStyle(tw, si[idx].marks);
                                        else if (type === 'bg') tw.style.background = si[idx].bg ? ({yellow:'#fff176',blue:'#42a5f5',red:'#ef5350',green:'#66bb6a',purple:'#ab47bc'}[si[idx].bg] || '') : '';
                                    }
                                }
                            }
                        }
                    }
                }
                return;
            }
            var range = sel.getRangeAt(0);
            var textEl = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer;
            var inTextMode = textEl && textEl.closest && textEl.closest('#paPreviewEditor');
            if (textEl && textEl.closest) textEl = textEl.closest('.paItemText');
            if (!textEl) {
                var editor = document.getElementById('paPreviewEditor');
                if (!editor || !editor.contains(range.commonAncestorContainer)) { _paCtxSelRange = null; return; }
                textEl = editor;
            }
            var span = document.createElement('span');
            if (type === 'mark') {
                if (value === 'bold') span.style.fontWeight = 'bold';
                else if (value === 'underline') span.style.textDecoration = 'underline';
                else if (value === 'strike') span.style.textDecoration = 'line-through';
                else if (value === 'italic') span.style.fontStyle = 'italic';
                else if (value.indexOf('color-') === 0) span.style.color = {red:'#c0392b',blue:'#2980b9',black:'#000',gray:'#888'}[value.substring(6)] || '';
            } else if (type === 'bg') {
                span.style.background = {yellow:'#fff176',blue:'#42a5f5',red:'#ef5350',green:'#66bb6a',purple:'#ab47bc'}[value] || '';
            }
            try {
                range.surroundContents(span);
            } catch(e) {
                var fragment = range.extractContents();
                span.appendChild(fragment);
                range.insertNode(span);
            }
            sel.removeAllRanges();
            sel.addRange(range);
            if (inTextMode) {
                syncPreviewBackToItems(document.getElementById('paPreviewEditor'), false);
            } else {
                var itemDiv = textEl.closest ? textEl.closest('.paItem') : null;
                if (itemDiv) {
                    var idx = parseInt(itemDiv.dataset.idx, 10);
                    if (isFinite(idx)) {
                        var si = itemDiv.closest('#paOtherMirrorBody') ? paOtherItems : (itemDiv.closest('#paMirrorBody') ? paOtherItems : items);
                        si[idx].text = paNormalizeText(textEl.innerHTML);
                        save();
                    }
                }
            }
            _paCtxSelRange = null;
        }
        (function() {
            var previewEditor = document.getElementById('paPreviewEditor');
            if (previewEditor) {
                previewEditor.addEventListener('contextmenu', function(e) {
                    var sel = window.getSelection();
                    if (sel.rangeCount > 0 && previewEditor.contains(sel.anchorNode) && !sel.getRangeAt(0).collapsed) {
                        _paCtxSelRange = sel.getRangeAt(0);
                    } else {
                        _paCtxSelRange = null;
                        return;
                    }
                    e.preventDefault();
                    var menu = document.getElementById('paContextMenu');
                    if (!menu) return;
                    ctxTargetIdx = -1;
                    menu.classList.add('show');
                    var rw = menu.offsetWidth, rh = menu.offsetHeight;
                    var left = e.clientX, top = e.clientY;
                    if (left + rw > window.innerWidth - 8) left = window.innerWidth - rw - 8;
                    if (top + rh > window.innerHeight - 8) top = window.innerHeight - rh - 8;
                    if (left < 4) left = 4;
                    if (top < 4) top = 4;
                    menu.style.left = left + 'px';
                    menu.style.top = top + 'px';
                });
            }
            var mirrorPreview = document.getElementById('paMirrorPreviewEditor');
            if (mirrorPreview) {
                mirrorPreview.addEventListener('contextmenu', function(e) {
                    var sel = window.getSelection();
                    if (sel.rangeCount > 0 && mirrorPreview.contains(sel.anchorNode) && !sel.getRangeAt(0).collapsed) {
                        _paCtxSelRange = sel.getRangeAt(0);
                    } else { _paCtxSelRange = null; return; }
                    e.preventDefault();
                    var menu = document.getElementById('paContextMenu');
                    if (!menu) return;
                    ctxTargetIdx = -1;
                    menu.classList.add('show');
                    var rw = menu.offsetWidth, rh = menu.offsetHeight;
                    var left = e.clientX, top = e.clientY;
                    if (left + rw > window.innerWidth - 8) left = window.innerWidth - rw - 8;
                    if (top + rh > window.innerHeight - 8) top = window.innerHeight - rh - 8;
                    if (left < 4) left = 4;
                    if (top < 4) top = 4;
                    menu.style.left = left + 'px';
                    menu.style.top = top + 'px';
                });
            }
        })();
var _npEditorUndoStack = [];
        var _npEditorRedoStack = [];
        var _npEditorUndoLimit = 40;
        var _npUndoSessionTimer = null;
        var _npUndoSessionPending = null;
        var _npRestoringUndo = false;
        var _npComposingNow = false;
        var _npNativeHistorySuppressed = false;
        var _npNativeHistoryTimer = null;
        var _npSkipNextLiveFormat = false;
        var _npPasteGuardUntil = 0;
        var _npDeleteMergePending = null;
        function _npFindCaretPara(editor) {
            if (!editor) return null;
            var sel = window.getSelection();
            if (!sel.rangeCount) return null;
            var node = sel.anchorNode;
            var p = node && node.nodeType === 3 ? node.parentNode : node;
            while (p && p !== editor && p.tagName !== 'P' && p.tagName !== 'DIV') p = p.parentNode;
            if (p && p !== editor && (p.tagName === 'P' || p.tagName === 'DIV')) return p;
            return null;
        }
        function _npCaretAtParaEnd(editor) {
            var p = _npFindCaretPara(editor);
            if (!p) return false;
            var sel = window.getSelection();
            if (!sel.rangeCount || !sel.isCollapsed) return false;
            var start = sel.anchorNode;
            var off = sel.anchorOffset;
            if (start === p) return off >= p.childNodes.length;
            var lastText = null;
            var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
            while (walker.nextNode()) {
                var t = walker.currentNode.textContent || '';
                if (t.length) lastText = walker.currentNode;
            }
            if (start.nodeType === 3) {
                if (start !== lastText) return false;
                return off >= (start.textContent || '').length;
            }
            if (start.nodeType === 1) {
                var inn = start.children ? start.children.length : 0;
                if (inn) {
                    var lastChild = start.lastChild;
                    if (lastChild && lastChild.nodeType === 3) return (off >= start.childNodes.length) && (lastText === lastChild);
                }
                return off >= start.childNodes.length;
            }
            return false;
        }
        function _npNormalizeFont(v) {
            return String(v || '').replace(/[\'"]/g, '').replace(/\s+/g, '').toLowerCase();
        }
        function _npParaHasForeignFormat(p) {
            if (!p || p.nodeType !== 1) return false;
            if (p.getAttribute('data-manual') === '1') return true;
            if (p.querySelector('[data-manual="1"]')) return true;
            var baseFamily = _npNormalizeFont(p.style.fontFamily);
            var baseSize = _npNormalizeFont(p.style.fontSize);
            var baseFs = parseFloat(p.style.fontSize) || 0;
            var all = p.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
                var el = all[i];
                if (el.getAttribute('data-manual') === '1') return true;
                var st = el.style || {};
                if (st.backgroundColor && st.backgroundColor !== 'transparent' && st.backgroundColor !== 'rgba(0, 0, 0, 0)') return true;
                if (st.background && st.background !== 'transparent' && st.background !== 'none') return true;
                var ff = _npNormalizeFont(st.fontFamily);
                if (ff && baseFamily && ff !== baseFamily) return true;
                var ffs = _npNormalizeFont(st.fontSize);
                var fs = parseFloat(st.fontSize) || 0;
                if (ffs && baseFs > 0 && fs > 0 && Math.abs(fs - baseFs) > 0.5) return true;
            }
            return false;
        }
        function _npCleanDeleteMerged(p) {
            if (!p || p.nodeType !== 1) return;
            var text = (p.textContent || '').replace(/\u200b/g, '');
            p.removeAttribute('data-manual');
            p.removeAttribute('data-autoformat-heading');
            p.removeAttribute('data-ai-heading-level');
            var subs = p.querySelectorAll('[data-manual="1"],[data-autoformat-heading],[data-ai-heading-level]');
            for (var i = 0; i < subs.length; i++) {
                subs[i].removeAttribute('data-manual');
                subs[i].removeAttribute('data-autoformat-heading');
                subs[i].removeAttribute('data-ai-heading-level');
                subs[i].removeAttribute('style');
            }
            var mergeMatch = text.match(/([一二三四五六七八九十]+是[^。！？；：\n]{1,80}[。！？；])/);
            if (mergeMatch && typeof _notepadMatchHK === 'function' && typeof _setParagraphFormat === 'function') {
                var markerAt = mergeMatch.index;
                var markerText = mergeMatch[1];
                var markerSeq = typeof _npFmt_detectSeqStyle === 'function' ? _npFmt_detectSeqStyle(markerText) : null;
                var parentLevel = 0;
                var prev = p.previousElementSibling;
                while (prev) {
                    var prevLevel = typeof _detectHeadingDisplayLevel === 'function' ? _detectHeadingDisplayLevel(prev) : null;
                    if (prevLevel !== null) { parentLevel = prevLevel; break; }
                    prev = prev.previousElementSibling;
                }
                var headingLevel = parentLevel <= 1 ? 2 : Math.min(3, parentLevel + 1);
                if (markerSeq && p.previousElementSibling) {
                    var same = p.previousElementSibling;
                    while (same) {
                        var sameText = (same.textContent || '').replace(/^\s+|\s+$/g, '');
                        if (_notepadMatchHK(sameText) === 'cn-verb') {
                            var sameSeq = _npFmt_detectSeqStyle(sameText);
                            var sameLevel = _detectHeadingDisplayLevel(same);
                            if (sameSeq && sameSeq.kind === markerSeq.kind && sameSeq.idx + 1 === markerSeq.idx && sameLevel !== null) headingLevel = sameLevel;
                            break;
                        }
                        same = same.previousElementSibling;
                    }
                }
                var before = text.substring(0, markerAt);
                var after = text.substring(markerAt + markerText.length);
                var headingStyle = FORMAT_STANDARD.inlineStyle('level-' + headingLevel);
                p.innerHTML = _formatBodyWithRemarks(before) + '<span style="' + headingStyle + '">' + escapeHtml(markerText) + '</span>' + _formatBodyWithRemarks(after);
                _setParagraphFormat(p, 'level-body');
                return;
            }
            p.innerHTML = escapeHtml(text);
            if (_autoFormatEnabled && typeof _applyLiveFormat === 'function') {
                try {
                    var r = document.createRange();
                    r.selectNodeContents(p);
                    r.collapse(false);
                    var s = window.getSelection();
                    s.removeAllRanges();
                    s.addRange(r);
                } catch(e) {}
                _applyLiveFormat();
            } else if (typeof _setParagraphFormat === 'function') {
                _setParagraphFormat(p, 'level-body');
            }
        }
        function _npCaretGlobalOffset(editor) {
            try {
                var sel = window.getSelection();
                if (!sel.rangeCount) return null;
                var range = sel.getRangeAt(0);
                if (!editor.contains(range.startContainer)) return null;
                var container = range.startContainer;
                var offset = range.startOffset;
                if (container === editor) return offset;
                var total = 0;
                var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
                while (walker.nextNode()) {
                    if (walker.currentNode === container) { total += offset; break; }
                    total += (walker.currentNode.textContent || '').length;
                }
                return total;
            } catch(e) { return null; }
        }
        function _npSetCaretGlobalOffset(editor, offset) {
            if (offset === null || offset === undefined || offset < 0 || !editor) return;
            var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
            var acc = 0, target = null, targetOff = 0, lastNode = null;
            while (walker.nextNode()) {
                var n = walker.currentNode;
                var len = (n.textContent || '').length;
                lastNode = n;
                if (acc + len >= offset) { target = n; targetOff = Math.min(offset - acc, len); break; }
                acc += len;
            }
            if (!target && lastNode) { target = lastNode; targetOff = lastNode.textContent.length; }
            if (!target) return;
            var r = document.createRange();
            r.setStart(target, targetOff);
            r.collapse(true);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
        }
        function _npEditorResetUndoHistory() {
            _npEditorUndoStack.length = 0;
            _npEditorRedoStack.length = 0;
            if (_npUndoSessionTimer) { clearTimeout(_npUndoSessionTimer); _npUndoSessionTimer = null; }
            _npUndoSessionPending = null;
        }
        // 格式/批量改写前强制压入一个撤销快照，保证操作后可 Ctrl+Z 还原原始内容
        function _npPushUndoSnapshot(html, offset, scrollTop) {
            if (!html) return false;
            var editor = document.getElementById('notepadEditor');
            var snap = {
                html: html,
                offset: (offset === null || offset === undefined) ? null : offset,
                scrollTop: scrollTop || 0
            };
            _npFinalizeUndoSession();
            _npEditorUndoStack.push(snap);
            if (_npEditorUndoStack.length > _npEditorUndoLimit) _npEditorUndoStack.shift();
            _npEditorRedoStack.length = 0;
            return true;
        }
        window._npPushUndoSnapshot = _npPushUndoSnapshot;
        // 格式操作被判定为丢字而回滚时，撤销栈中对应的快照已无意义，移除它
        function _npDropUndoSnapshot(html) {
            if (!_npEditorUndoStack.length) return false;
            var top = _npEditorUndoStack[_npEditorUndoStack.length - 1];
            if (html && top && top.html !== html) return false;
            _npEditorUndoStack.pop();
            return true;
        }
        window._npDropUndoSnapshot = _npDropUndoSnapshot;
        function _npEditorBeginSession(editor) {
            if (_npRestoringUndo || _npComposingNow) return;
            if (_npUndoSessionPending) {
                if (_npUndoSessionTimer) clearTimeout(_npUndoSessionTimer);
                _npUndoSessionTimer = setTimeout(_npFinalizeUndoSession, 900);
                return;
            }
            _npUndoSessionPending = { html: editor.innerHTML, offset: _npCaretGlobalOffset(editor), scrollTop: editor.scrollTop };
            _npEditorRedoStack.length = 0;
            if (_npUndoSessionTimer) clearTimeout(_npUndoSessionTimer);
            _npUndoSessionTimer = setTimeout(_npFinalizeUndoSession, 900);
        }
        function _npFinalizeUndoSession() {
            if (_npUndoSessionTimer) { clearTimeout(_npUndoSessionTimer); _npUndoSessionTimer = null; }
            if (!_npUndoSessionPending) return;
            var snap = _npUndoSessionPending;
            _npUndoSessionPending = null;
            _npEditorUndoStack.push(snap);
            if (_npEditorUndoStack.length > _npEditorUndoLimit) _npEditorUndoStack.shift();
        }
        function _npRestoreEditorScroll(editor, scrollTop) {
            if (scrollTop === null || scrollTop === undefined || !editor) return;
            var max = Math.max(0, editor.scrollHeight - editor.clientHeight);
            editor.scrollTop = Math.max(0, Math.min(scrollTop, max));
        }
        function _npJumpBackToSavedScroll(editor, scrollTop, savedMax) {
            if (!editor) return;
            function apply() {
                var max = Math.max(0, editor.scrollHeight - editor.clientHeight);
                var top = scrollTop;
                if (savedMax > 0 && max > 0) top = Math.round(scrollTop * max / savedMax);
                editor.scrollTop = Math.max(0, Math.min(top, max));
            }
            apply();
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function() { apply(); });
            setTimeout(function() { apply(); }, 60);
            setTimeout(function() { apply(); }, 300);
        }
        function _npEditorUndo() {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return false;
            _npFinalizeUndoSession();
            if (!_npEditorUndoStack.length) return false;
            var snap = _npEditorUndoStack.pop();
            var savedScrollTop = editor.scrollTop;
            var savedMax = Math.max(0, editor.scrollHeight - editor.clientHeight);
            _npEditorRedoStack.push({ html: editor.innerHTML, offset: _npCaretGlobalOffset(editor), scrollTop: savedScrollTop });
            if (_npEditorRedoStack.length > _npEditorUndoLimit) _npEditorRedoStack.shift();
            _npRestoringUndo = true;
            try {
                editor.innerHTML = snap.html;
                _refreshNotepadArticleSeparators(editor);
                if (_materialMode) _renderMaterialOutline();
                _materialMirrorSync();
                try { S._enterSplitInfo = null; } catch(e) {}
                _npSetCaretGlobalOffset(editor, snap.offset);
                _markWriteNoteArticleDirty();
            } finally { _npRestoringUndo = false; }
            _npJumpBackToSavedScroll(editor, savedScrollTop, savedMax);
            showToast('已撤销');
            return true;
        }
        function _npEditorRedo() {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return false;
            if (!_npEditorRedoStack.length) return false;
            var snap = _npEditorRedoStack.pop();
            var savedScrollTop = editor.scrollTop;
            var savedMax = Math.max(0, editor.scrollHeight - editor.clientHeight);
            _npEditorUndoStack.push({ html: editor.innerHTML, offset: _npCaretGlobalOffset(editor), scrollTop: savedScrollTop });
            if (_npEditorUndoStack.length > _npEditorUndoLimit) _npEditorUndoStack.shift();
            _npRestoringUndo = true;
            try {
                editor.innerHTML = snap.html;
                _refreshNotepadArticleSeparators(editor);
                if (_materialMode) _renderMaterialOutline();
                _materialMirrorSync();
                try { S._enterSplitInfo = null; } catch(e) {}
                _npSetCaretGlobalOffset(editor, snap.offset);
                _markWriteNoteArticleDirty();
            } finally { _npRestoringUndo = false; }
            _npJumpBackToSavedScroll(editor, savedScrollTop, savedMax);
            showToast('已重做');
            return true;
        }
if (notepadEditorCtx) {
            notepadEditorCtx.addEventListener('input', function(e) {
                _markWriteNoteArticleDirty();
                if (_npDeleteMergePending) {
                    var _mergeTarget = null;
                    if (typeof _npFindCaretPara === 'function') _mergeTarget = _npFindCaretPara(notepadEditorCtx);
                    _npDeleteMergePending = null;
                    if (_mergeTarget && typeof _npCleanDeleteMerged === 'function') _npCleanDeleteMerged(_mergeTarget);
                }
                if (_autoFormatEnabled && !e.isComposing) {
                    if (_npSkipNextLiveFormat || _npPasteGuardUntil > Date.now() || (e && (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop'))) {
                        _npSkipNextLiveFormat = false;
                    } else {
                    var sel = window.getSelection();
                    if (sel.rangeCount && e && e.inputType !== 'insertParagraph' && e.inputType !== 'insertLineBreak') {
                        var node = sel.anchorNode;
                        var p = node && node.nodeType === 3 ? node.parentNode : node;
                        while (p && p !== notepadEditorCtx && p.tagName !== 'P' && p.tagName !== 'DIV') p = p.parentNode;
                        if (p && (p.tagName === 'P' || p.tagName === 'DIV') && p.getAttribute('data-manual') === '1') {
                            var text = p.textContent || '';
                            if (text.endsWith('。') || text.endsWith('.')) {
                                var range = sel.getRangeAt(0);
                                if (range.endOffset === text.length && _notepadMatchHK(text.replace(/^\s+|\s+$/g, ''))) {
                                    // 手动层级标题末尾句号：记录原有层级，结束手动格式，由自动格式接管
                                    var existingLv = _detectHeadingDisplayLevel(p);
                                    p.removeAttribute('data-manual');
                                    var manuals = p.querySelectorAll('[data-manual="1"],[data-manual-span="1"]');
                                    for (var mi = 0; mi < manuals.length; mi++) { manuals[mi].removeAttribute('data-manual'); manuals[mi].removeAttribute('data-manual-span'); }
                                    if (existingLv !== null) p.setAttribute('data-autoformat-heading', existingLv);
                                }
                            }
                        }
                    }
                    _applyLiveFormat();
                    }
                }
                _refreshNotepadArticleSeparators(notepadEditorCtx);
                if (_materialMode) _renderMaterialOutline();
                _materialMirrorSync();
                var modal = document.getElementById('notepadOutlineModal');
                if (modal && modal.classList.contains('show')) {
                    if (_notepadDirBrowseMode && _notepadDirCurrentIdx >= 0) _notepadDirSaveCurrentArticle(true);
                    _scanNotepadDirectoryEntries();
                    var dirTab = document.getElementById('notepadOutlineDirTab');
                    if (dirTab && dirTab.classList.contains('show')) {
                        _renderDirTab();
                    } else {
                        _notepadOutlineRenderStruct();
                    }
                }
            });
            if (window.InputEvent && typeof InputEvent.prototype.getTargetRanges === 'function') {
                notepadEditorCtx.addEventListener('beforeinput', function(e) {
                    if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
                        if (_npNativeHistorySuppressed) { e.preventDefault(); }
                        return;
                    }
                    if (_npRestoringUndo || _npComposingNow) return;
                    if (e.inputType && (e.inputType.indexOf('insert') === 0 || e.inputType.indexOf('delete') === 0)) {
                        _npEditorBeginSession(notepadEditorCtx);
                    }
                });
            }
            notepadEditorCtx.addEventListener('paste', function(e) {
                // 不阻止默认粘贴（保留剪贴板原有段落/结构），仅标记本次跳过自动格式，
                // 避免自动格式立即改写/替换粘入内容；后续Delete合并时再清理格式并重设。
                _npSkipNextLiveFormat = true;
                _npPasteGuardUntil = Date.now() + 400;
                try { S._enterSplitInfo = null; } catch(e2) {}
                var _npPasteClear = function() { if (_npSkipNextLiveFormat) _npSkipNextLiveFormat = false; };
                setTimeout(_npPasteClear, 200);
            });
            var _mvEl = document.getElementById('materialMirrorView');
            if (_mvEl && typeof _materialMirrorRefresh === 'function') {
                _mvEl.addEventListener('click', function() { _materialMirrorRefresh(); });
            }
            if (typeof hideNotepadEditorZoomBar === 'function' && notepadEditorCtx) {
                notepadEditorCtx.addEventListener('focus', function() { hideNotepadEditorZoomBar(); });
                notepadEditorCtx.addEventListener('mousedown', function() { hideNotepadEditorZoomBar(); });
            }
            notepadEditorCtx.addEventListener('keydown', function(e) {
                if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                    if (_npEditorUndo()) {
                        e.preventDefault(); e.stopPropagation();
                        _npNativeHistorySuppressed = true;
                        if (_npNativeHistoryTimer) clearTimeout(_npNativeHistoryTimer);
                        _npNativeHistoryTimer = setTimeout(function() { _npNativeHistorySuppressed = false; _npNativeHistoryTimer = null; }, 200);
                    }
                    return;
                }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
                    if (_npEditorRedo()) {
                        e.preventDefault(); e.stopPropagation();
                        _npNativeHistorySuppressed = true;
                        if (_npNativeHistoryTimer) clearTimeout(_npNativeHistoryTimer);
                        _npNativeHistoryTimer = setTimeout(function() { _npNativeHistorySuppressed = false; _npNativeHistoryTimer = null; }, 200);
                    }
                    return;
                }
                if (_npRestoringUndo || _npComposingNow) return;
                if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'h' || e.key === 'H')) {
                    e.preventDefault(); e.stopPropagation();
                    if (typeof window.npOpenReplaceDialog === 'function') window.npOpenReplaceDialog(null);
                    return;
                }
                if (e.ctrlKey || e.metaKey || e.altKey) return;
                if (e.key === 'Delete' && typeof _npParaHasForeignFormat === 'function') {
                    var _npSelD = window.getSelection();
                    if (_npSelD.rangeCount && _npSelD.isCollapsed && notepadEditorCtx.contains(_npSelD.anchorNode)) {
                        var _npCurD = _npFindCaretPara(notepadEditorCtx);
                        if (_npCurD && typeof _npCaretAtParaEnd === 'function' && _npCaretAtParaEnd(notepadEditorCtx)) {
                            var _npNextD = _npCurD.nextElementSibling;
                            while (_npNextD && _npNextD.nodeType === 1 && (_npNextD.tagName !== 'P' && _npNextD.tagName !== 'DIV')) _npNextD = _npNextD.nextElementSibling;
                            if (_npNextD && _npParaHasForeignFormat(_npNextD)) {
                                _npDeleteMergePending = _npNextD;
                            }
                        }
                    }
                }
                if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter' || (e.key && e.key.length === 1)) {
                    _npEditorBeginSession(notepadEditorCtx);
                }
                if (e.key === 'Enter') {
                    var sel = window.getSelection();
                    if (sel.rangeCount) {
                        var node = sel.anchorNode;
                        var p = node && node.nodeType === 3 ? node.parentNode : node;
                        while (p && p !== notepadEditorCtx && p.tagName !== 'P' && p.tagName !== 'DIV') p = p.parentNode;
                        if (p && (p.tagName === 'P' || p.tagName === 'DIV')) {
                            S._enterSplitInfo = { text: p.textContent || '', offset: sel.anchorOffset };
                            // 如果当前段落是手动格式，按回车不清除当前段的手动标记，新段落自然不带手动标记
                            // 只需确保不复制data-manual到新段落（默认行为即如此）
                        } else { S._enterSplitInfo = null; }
                    }
                } else {
                    if (_enterSplitInfo) S._enterSplitInfo = null;
                }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'e' || e.key === 'E' || (!isKylinOS() && e.code === 'KeyE'))) {
                    e.preventDefault(); e.stopPropagation(); autoFormatDocSelected(true);
                }
            });
            notepadEditorCtx.addEventListener('compositionstart', function() {
                _npEditorBeginSession(notepadEditorCtx);
                _npComposingNow = true;
            });
            notepadEditorCtx.addEventListener('compositionend', function() {
                _npComposingNow = false;
                if (_npRestoringUndo) return;
                if (_npSkipNextLiveFormat || _npPasteGuardUntil > Date.now()) { _npSkipNextLiveFormat = false; return; }
                if (_autoFormatEnabled) _applyLiveFormat();
            });
            // 统一的行内格式应用（加粗/下划线/高亮），并记录为“可重复的格式”
            function _npApplyInlineFormat(cmd, value, label) {
                document.execCommand(cmd, false, value);
                try { _npMarkManualRange(window.getSelection().getRangeAt(0)); } catch(e) {}
                var _pfP = window.getSelection().anchorNode;
                if (_pfP && _pfP.nodeType === 3) _pfP = _pfP.parentNode;
                var _pfEd = document.getElementById('notepadEditor');
                while (_pfP && _pfP !== _pfEd && _pfP.tagName !== 'P' && _pfP.tagName !== 'DIV') _pfP = _pfP.parentNode;
                if (_pfP && _pfP !== _pfEd) _npMarkManualPara(_pfP);
                if (typeof window._npSetLastFormat === 'function') {
                    window._npSetLastFormat(label, function() { _npApplyInlineFormat(cmd, value, label); });
                }
                if (typeof _refreshOutlineIfOpen === 'function') _refreshOutlineIfOpen();
            }
            notepadEditorCtx.addEventListener('contextmenu', function(e) {
                var menu = document.getElementById('notepadCtxMenu');
                if (!menu) return;
                var sel = window.getSelection();
                // 优先保留编辑区内已有的非折叠选区（右键点在选区内时 caretRangeFromPoint 只会给出折叠光标，会把选区丢掉）
                var liveSelRange = (sel && sel.rangeCount > 0 && !sel.isCollapsed
                    && notepadEditorCtx.contains(sel.anchorNode) && notepadEditorCtx.contains(sel.focusNode))
                    ? sel.getRangeAt(0) : null;
                var cr = null;
                if (document.caretRangeFromPoint) cr = document.caretRangeFromPoint(e.clientX, e.clientY);
                else if (document.caretPositionFromPoint) { var cp = document.caretPositionFromPoint(e.clientX, e.clientY); if (cp) { cr = document.createRange(); cr.setStart(cp.offsetNode, cp.offset); cr.collapse(true); } }
                if (liveSelRange) {
                    _notepadCtxRange = liveSelRange;
                    _notepadSymbolSavedRange = liveSelRange.cloneRange();
                } else if (cr && notepadEditorCtx.contains(cr.startContainer)) {
                    _notepadCtxRange = cr;
                    _notepadSymbolSavedRange = cr.cloneRange();
                } else if (sel.rangeCount > 0 && notepadEditorCtx.contains(sel.anchorNode)) {
                    _notepadCtxRange = sel.getRangeAt(0);
                    _notepadSymbolSavedRange = _notepadCtxRange.cloneRange();
                } else {
                    _notepadCtxRange = null;
                    _notepadSymbolSavedRange = null;
                }
                var updateItem = menu.querySelector('[data-npaction="update-index"]');
                var colorItem = menu.querySelector('.paCtxHasSub[data-submenu="npcolor"]');
                var levelItem = menu.querySelector('.paCtxHasSub[data-submenu="nplevel"]');
                _npCtxTargetPara = null;
                if (e.target && e.target.closest) {
                    _npCtxTargetPara = e.target.closest('p');
                }
                if (!_npCtxTargetPara && _notepadCtxRange) {
                    _npCtxTargetPara = _notepadCtxRange.startContainer && _notepadCtxRange.startContainer.nodeType === 3
                        ? _notepadCtxRange.startContainer.parentElement : _notepadCtxRange.startContainer;
                    while (_npCtxTargetPara && _npCtxTargetPara !== notepadEditorCtx && _npCtxTargetPara.tagName !== 'P') _npCtxTargetPara = _npCtxTargetPara.parentElement;
                    if (_npCtxTargetPara === notepadEditorCtx) _npCtxTargetPara = null;
                }
                _npCtxArticlePara = _npCtxTargetPara && notepadEditorCtx.contains(_npCtxTargetPara) ? _npCtxTargetPara : null;
                var _ctxTxt = _npCtxTargetPara ? (_npCtxTargetPara.textContent || '').replace(/^\s+|\s+$/g, '') : '';
                if (_npCtxTargetPara && notepadEditorCtx.contains(_npCtxTargetPara) &&
                    (_npCtxTargetPara.getAttribute('data-outline-level') === '1' || /^【[^】]+】/.test(_ctxTxt))) {
                    _npCtxIdxPara = _npCtxTargetPara;
                    if (updateItem) updateItem.style.display = '';
                } else {
                    _npCtxIdxPara = null;
                    if (updateItem) updateItem.style.display = 'none';
                }
                var toggleCollapseItem = document.getElementById('notepadCtxToggleCollapse');
                if (toggleCollapseItem) {
                    if (_npCtxIdxPara) {
                        toggleCollapseItem.style.display = '';
                        toggleCollapseItem.textContent = _npCtxIdxPara.getAttribute('data-collapsed') === 'true' ? '展开' : '收起';
                    } else {
                        toggleCollapseItem.style.display = 'none';
                    }
                }
                var expandAllItem = document.getElementById('notepadCtxExpandAll');
                var collapseAllItem = document.getElementById('notepadCtxCollapseAll');
                if (expandAllItem) expandAllItem.style.display = _npCtxIdxPara ? '' : 'none';
                if (collapseAllItem) collapseAllItem.style.display = _npCtxIdxPara ? '' : 'none';
                var hasSelectionRange = _notepadCtxRange && !_notepadCtxRange.collapsed;
                if (colorItem) { colorItem.style.display = hasSelectionRange ? '' : 'none'; }
                if (levelItem) { levelItem.style.display = hasSelectionRange ? '' : 'none'; }
                var repeatItem = document.getElementById('notepadCtxRepeatFormat');
                if (repeatItem) {
                    var lastLabel = (typeof window._npGetLastFormatLabel === 'function') ? window._npGetLastFormatLabel() : '';
                    repeatItem.textContent = (lastLabel || '重复格式操作') + '（Ctrl+Shift+A）';
                    repeatItem.style.display = _notepadCtxRange ? '' : 'none';
                }
                var insertSymbolItem = document.getElementById('notepadCtxInsertSymbol');
                if (insertSymbolItem) insertSymbolItem.style.display = _notepadCtxRange ? '' : 'none';
                var replaceItem = document.getElementById('notepadCtxReplace');
                if (replaceItem) replaceItem.style.display = '';
                var showSettingsItem = document.getElementById('notepadCtxShowSettings');
                var exitWriteItem = document.getElementById('notepadCtxExitWrite');
                var autoFormatItem = document.getElementById('notepadCtxAutoFormat');
                var zoomItem = menu.querySelector('.paCtxHasSub[data-submenu="npzoom"]');
                var materialBgItem = menu.querySelector('.paCtxHasSub[data-submenu="npmaterialbg"]');
                var materialFullscreenItem = document.getElementById('notepadCtxMaterialFullscreen');

                var panel = document.getElementById('notepadPanel');
                var toolbarsHidden = panel && panel.classList.contains('toolbars-hidden');
                if (showSettingsItem) {
                    showSettingsItem.style.display = '';
                    showSettingsItem.textContent = toolbarsHidden ? '显示设置界面' : '隐藏设置界面';
                }
                if (exitWriteItem) {
                    exitWriteItem.style.display = _writeNoteMode ? '' : 'none';
                    exitWriteItem.textContent = _materialMode ? '退出写材料模式' : '退出记笔记模式';
                }
                if (autoFormatItem) {
                    autoFormatItem.style.display = '';
                    autoFormatItem.textContent = _autoFormatEnabled ? '取消自动格式' : '打开自动格式';
                }
                 var autoTitleItem = document.getElementById('notepadCtxAutoTitle');
                 if (autoTitleItem) autoTitleItem.style.display = (_writeNoteMode || _materialMode) ? '' : 'none';
                 var addIndexItem = document.getElementById('notepadCtxAddIndex');
                 if (addIndexItem) {
                     var _canAddIdx = !!(_npCtxTargetPara && notepadEditorCtx.contains(_npCtxTargetPara) &&
                         _npCtxTargetPara.getAttribute('data-outline-level') !== '1' &&
                         _npCtxIsArticleTitleOnlyPara(_npCtxTargetPara) && !!_notepadCtxRange);
                     addIndexItem.style.display = _canAddIdx ? '' : 'none';
                 }
                if (zoomItem) { zoomItem.style.display = ''; }
                if (materialBgItem) { materialBgItem.style.display = _materialMode ? '' : 'none'; }
                if (materialFullscreenItem) {
                    materialFullscreenItem.style.display = _materialMode ? '' : 'none';
                    materialFullscreenItem.textContent = _materialFullscreen ? '退出全屏' : '全屏';
                }
                if (!_notepadCtxRange && !_npCtxIdxPara && !toolbarsHidden && !_writeNoteMode && !_materialMode) { return; }
                e.preventDefault();
                menu.classList.add('show');
                menu.style.left = '0px';
                menu.style.top = '0px';
                var rw = menu.offsetWidth, rh = menu.offsetHeight;
                var left = e.clientX, top = e.clientY;
                if (left + rw > window.innerWidth - 8) left = window.innerWidth - rw - 8;
                if (top + rh > window.innerHeight - 8) {
                    top = e.clientY - rh;
                    if (top < 4) top = 4;
                } else {
                    if (top < 4) top = 4;
                }
                menu.style.left = left + 'px';
                menu.style.top = top + 'px';
            });
            var notepadCtxMenuEl = document.getElementById('notepadCtxMenu');
            if (notepadCtxMenuEl) {
                notepadCtxMenuEl.addEventListener('click', function(e) {
                    var it = e.target.closest('.paCtxItem');
                    if (!it || it.classList.contains('paCtxHasSub')) return;
                    var npAction = it.getAttribute('data-npaction');
                    if (npAction === 'update-index') {
                        updateNotepadIndexTitle();
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    if (npAction === 'toggle-collapse') {
                        var editor = document.getElementById('notepadEditor');
                        if (editor && _npCtxIdxPara) {
                            var collapsed = _npCtxIdxPara.getAttribute('data-collapsed') !== 'true';
                            _npCtxIdxPara.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
                            _toggleArticleCollapse(editor, _npCtxIdxPara, collapsed);
                            saveCurrentEditor();
                        }
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    if (npAction === 'expand-all') {
                        _notepadSetAllArticlesCollapsed(false);
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    if (npAction === 'collapse-all') {
                        _notepadSetAllArticlesCollapsed(true);
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    if (npAction === 'show-settings') {
                        toggleNotepadToolbars();
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    if (npAction === 'exit-write') {
                        setNotepadDisplayMode(_materialMode ? 'material' : 'write');
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    if (npAction === 'toggle-autoformat') {
                        _setNotepadAutoFormatEnabled(!_autoFormatEnabled, false);
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                     if (npAction === 'auto-recognize-titles') {
                         autoRecognizeHeadings();
                         document.getElementById('notepadCtxMenu').classList.remove('show');
                         _notepadCtxRange = null;
                         return;
                     }
                     if (npAction === 'add-index') {
                         if (_notepadCtxRange) {
                             try {
                                 var indexSel = window.getSelection();
                                 indexSel.removeAllRanges();
                                 indexSel.addRange(_notepadCtxRange);
                             } catch (indexEx) {}
                         }
                          addNotepadDirEntry();
                          document.getElementById('notepadCtxMenu').classList.remove('show');
                          _notepadCtxRange = null;
                          _npCtxArticlePara = null;
                          return;
                     }
                    if (npAction === 'material-fullscreen') {
                        toggleMaterialFullscreen();
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    if (npAction === 'replace') {
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        var rngForReplace = _notepadCtxRange;
                        if (typeof window.npOpenReplaceDialog === 'function') window.npOpenReplaceDialog(rngForReplace);
                        _notepadCtxRange = null;
                        return;
                    }
                    if (npAction === 'insert-symbol') {
                        var cm = document.getElementById('notepadCtxMenu');
                        var x = cm ? (parseInt(cm.style.left, 10) || 0) : 0;
                        var y = cm ? (parseInt(cm.style.top, 10) || 0) : 0;
                        if (cm) cm.classList.remove('show');
                        showNotepadSymbolToolbar(x, y);
                        return;
                    }
                    if (npAction === 'repeat-format') {
                        if (_notepadCtxRange) {
                            try {
                                var rsel = window.getSelection();
                                rsel.removeAllRanges();
                                rsel.addRange(_notepadCtxRange);
                                _notepadSavedRange = _notepadCtxRange;
                            } catch(rex) {}
                        }
                        if (typeof window._npRepeatLastFormat === 'function') window._npRepeatLastFormat();
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    var lv = it.getAttribute('data-nplevel');
                    if (lv) {
                        if (_notepadCtxRange) {
                            try {
                                var lsel = window.getSelection();
                                lsel.removeAllRanges();
                                lsel.addRange(_notepadCtxRange);
                                _notepadSavedRange = _notepadCtxRange;
                            } catch(lex) {}
                        }
                        applyNotepadLevel(lv);
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    var color = it.getAttribute('data-npcolor');
                    if (color) {
                        if (_notepadCtxRange) {
                            try {
                                var sel = window.getSelection();
                                sel.removeAllRanges();
                                sel.addRange(_notepadCtxRange);
                            } catch(ex) {}
                        }
                        var colorMap = { yellow: ['#fff176', '黄色'], blue: ['#42a5f5', '蓝色'], red: ['#ef5350', '红色'], green: ['#66bb6a', '绿色'], purple: ['#ab47bc', '紫色'] };
                        var cc = colorMap[color];
                        if (cc) _npApplyInlineFormat('hiliteColor', cc[0], cc[1] + '高亮');
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    var mbg = it.getAttribute('data-npmaterialbg');
                    if (mbg) {
                        _applyMaterialEditorBg(mbg);
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    var zoom = it.getAttribute('data-npzoom');
                    if (zoom) {
                        if (zoom === 'in') notepadZoomIn();
                        else if (zoom === 'out') notepadZoomOut();
                        document.getElementById('notepadCtxMenu').classList.remove('show');
                        _notepadCtxRange = null;
                        return;
                    }
                    document.getElementById('notepadCtxMenu').classList.remove('show');
                    _notepadCtxRange = null;
                });
                notepadCtxMenuEl.addEventListener('contextmenu', function(e) { e.preventDefault(); });
            }
            var notepadDirCtxMenuEl = document.getElementById('notepadDirCtxMenu');
            if (notepadDirCtxMenuEl) {
                notepadDirCtxMenuEl.addEventListener('click', function(e) {
                    var it = e.target.closest('.paCtxItem');
                    if (!it) return;
                    var act = it.getAttribute('data-npdiraction');
                    if (act === 'add-after') _notepadDirInsertAfter(_notepadDirCtxIndex);
                    else if (act === 'delete') _notepadDirDelete(_notepadDirCtxIndex);
                    else if (act === 'move-up') _notepadDirMove(_notepadDirCtxIndex, -1);
                    else if (act === 'move-down') _notepadDirMove(_notepadDirCtxIndex, 1);
                    notepadDirCtxMenuEl.classList.remove('show');
                    _notepadDirCtxIndex = -1;
                });
                notepadDirCtxMenuEl.addEventListener('contextmenu', function(e) { e.preventDefault(); });
            }
            (function() {
                var tabsWrap = document.querySelector('.notepadTabsRight');
                var tabMenu = document.getElementById('notepadTabCtxMenu');
                var tabCheck = document.getElementById('notepadNotebookStyleCheck');
                var tabCtxIndex = -1;
                if (tabsWrap && tabMenu && tabCheck) {
                    tabsWrap.addEventListener('contextmenu', function(e) {
                        var btn = e.target.closest('.notepadTabBtn');
                        if (!btn) return;
                        e.preventDefault();
                        e.stopPropagation();
                        tabCtxIndex = parseInt(btn.getAttribute('data-tab-index'), 10);
                        if (!isFinite(tabCtxIndex)) return;
                        tabCheck.checked = !!notepadNotebookStyles[tabCtxIndex];
                        tabMenu.classList.add('show');
                        tabMenu.style.left = '0px';
                        tabMenu.style.top = '0px';
                        var rw = tabMenu.offsetWidth, rh = tabMenu.offsetHeight;
                        var left = e.clientX, top = e.clientY;
                        if (left + rw > window.innerWidth - 8) left = window.innerWidth - rw - 8;
                        if (top + rh > window.innerHeight - 8) top = window.innerHeight - rh - 8;
                        if (left < 4) left = 4;
                        if (top < 4) top = 4;
                        tabMenu.style.left = left + 'px';
                        tabMenu.style.top = top + 'px';
                    });
                    tabCheck.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (tabCtxIndex < 0) return;
                        notepadNotebookStyles[tabCtxIndex] = tabCheck.checked;
                        if (tabCtxIndex === currentNotepadTab) _applyNotepadNotebookStyle();
                        _saveNotepadToCache();
                    });
                    tabMenu.addEventListener('contextmenu', function(e) { e.preventDefault(); });
                }
            })();
            (function() {
                var notepadEditorToggle = document.getElementById('notepadEditor');
                if (!notepadEditorToggle) return;
                notepadEditorToggle.addEventListener('click', function(e) {
                    var p = e.target.closest('[data-outline-level="1"]');
                    if (!p) return;
                    var rect = p.getBoundingClientRect();
                    if (e.clientX - rect.left > 28) return;
                    var collapsed = p.getAttribute('data-collapsed') === 'true';
                    collapsed = !collapsed;
                    p.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
                    if (typeof _toggleArticleCollapse === 'function') {
                        _toggleArticleCollapse(this, p, collapsed);
                    } else {
                        var ps = this.querySelectorAll('p');
                        var found = false;
                        for (var ci = 0; ci < ps.length; ci++) {
                            if (ps[ci] === p) { found = true; continue; }
                            if (!found) continue;
                            if (ps[ci].getAttribute('data-outline-level') === '1') break;
                            ps[ci].style.display = collapsed ? 'none' : '';
                        }
                    }
                    if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
                });
            })();
        }
        document.addEventListener('mousedown', function(e) {
            if (!e.target.closest('#paContextMenu')) { hideContextMenu(); }
            if (!e.target.closest('#notepadCtxMenu')) document.getElementById('notepadCtxMenu').classList.remove('show');
            if (!e.target.closest('#notepadSymbolToolbar')) document.getElementById('notepadSymbolToolbar').classList.remove('show');
            if (!e.target.closest('#notepadDirCtxMenu')) document.getElementById('notepadDirCtxMenu').classList.remove('show');
            if (!e.target.closest('#notepadTabCtxMenu')) document.getElementById('notepadTabCtxMenu').classList.remove('show');
        });
        document.addEventListener('click', function(e) {
            paHideTagTooltip();
            // 点击参考组/宿主段落以外的地方自动收起参考
            if (!e.target.closest('.paRefGroup') && !e.target.closest('.paItem') && !e.target.closest('#paContextMenu')) {
                paCloseRefs();
            }
            var panel = document.getElementById('problemAnalysisPanel');
            if (!panel || !panel.classList.contains('show')) return;
            if (panel.contains(e.target)) return;
            var btn = document.getElementById('problemAnalysisBtn');
            if (btn && btn.contains(e.target)) return;
            if (selectedIdx !== -1) setSelected(-1);
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                if (_writeNoteMode) {
                    var om = document.getElementById('notepadOutlineModal');
                    if (om && om.classList.contains('show')) { closeNotepadOutlineModal(); e.preventDefault(); e.stopPropagation(); return; }
                }
                var np = document.getElementById('notepadPanel');
                if (np && np.classList.contains('notepadFullscreen')) {
                    if (_notepadDisplayMode) { e.preventDefault(); e.stopPropagation(); setNotepadDisplayMode(_notepadDisplayMode); return; }
                    e.preventDefault(); e.stopPropagation(); return;
                }
                hideContextMenu();
                document.getElementById('notepadCtxMenu').classList.remove('show');
                var _ntcm = document.getElementById('notepadTabCtxMenu');
                if (_ntcm) _ntcm.classList.remove('show');
                _notepadCtxRange = null;
                var sd = document.getElementById('paShortcutDialog');
                if (sd) sd.classList.remove('show');
            }
            if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                var tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) { return; }
                e.preventDefault();
                undo();
            }
            if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
                var tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) { return; }
                e.preventDefault();
                if (_paLastAction) {
                    var menuEl = document.getElementById('paContextMenu');
                    var its = menuEl.querySelectorAll('.paCtxItem:not(.paCtxHasSub)');
                    for (var ri = 0; ri < its.length; ri++) {
                        if (its[ri].textContent.trim() === _paLastAction && (its[ri].classList.contains('paCtxMarkItem') || its[ri].classList.contains('paCtxBgItem'))) {
                            its[ri].click(); break;
                        }
                    }
                }
            }
            if ((e.target && e.target.closest && e.target.closest('#notepadEditor')) || (document.activeElement && document.activeElement.closest && document.activeElement.closest('#notepadEditor'))) {
                var _npHandled = false;
                if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); _npApplyInlineFormat('bold', null, '加粗'); _npHandled = true; }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); _npApplyInlineFormat('underline', null, '下划线'); _npHandled = true; }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === '1' || e.key === '!')) { e.preventDefault(); _npApplyInlineFormat('hiliteColor', '#fff176', '黄色高亮'); _npHandled = true; }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === '2' || e.key === '@')) { e.preventDefault(); _npApplyInlineFormat('hiliteColor', '#42a5f5', '蓝色高亮'); _npHandled = true; }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === '3' || e.key === '#')) { e.preventDefault(); _npApplyInlineFormat('hiliteColor', '#ef5350', '红色高亮'); _npHandled = true; }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === '4' || e.key === '$')) { e.preventDefault(); _npApplyInlineFormat('hiliteColor', '#66bb6a', '绿色高亮'); _npHandled = true; }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === '5' || e.key === '%')) { e.preventDefault(); _npApplyInlineFormat('hiliteColor', '#ab47bc', '紫色高亮'); _npHandled = true; }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); if (typeof window._npRepeatLastFormat === 'function') window._npRepeatLastFormat(); _npHandled = true; }
                if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'e' || e.key === 'E' || (!isKylinOS() && e.code === 'KeyE'))) { e.preventDefault(); e.stopPropagation(); autoFormatDocSelected(true); _npHandled = true; }
                if (_npHandled) {
                    var _npP = window.getSelection().anchorNode;
                    if (_npP && _npP.nodeType === 3) _npP = _npP.parentNode;
                    var _ed = document.getElementById('notepadEditor');
                    while (_npP && _npP !== _ed && _npP.tagName !== 'P' && _npP.tagName !== 'DIV') _npP = _npP.parentNode;
                    if (_npP && _npP !== _ed) _npMarkManualPara(_npP);
                    _refreshOutlineIfOpen();
                    if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'e' || e.key === 'E' || (!isKylinOS() && e.code === 'KeyE'))) e.stopPropagation();
                    return;
                }
            }
            if (e.ctrlKey && !e.altKey && !e.shiftKey && (e.key === 'b' || e.key === 'B')) {
                var tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
                if (e.target && e.target.isContentEditable && !e.target.closest('.paItemText') && !e.target.closest('#paPreviewEditor') && !e.target.closest('#paMirrorPreviewEditor')) { return; }
                e.preventDefault();
                applyMarkToSelection('mark', 'bold');
            }
            if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
                var tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
                if (e.target && e.target.isContentEditable && !e.target.closest('.paItemText') && !e.target.closest('#paPreviewEditor') && !e.target.closest('#paMirrorPreviewEditor')) { return; }
                e.preventDefault();
                applyMarkToSelection('mark', 'underline');
            }
            if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === '1' || e.key === '!')) {
                var tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
                if (e.target && e.target.isContentEditable && !e.target.closest('.paItemText') && !e.target.closest('#paPreviewEditor') && !e.target.closest('#paMirrorPreviewEditor')) { return; }
                e.preventDefault();
                applyMarkToSelection('bg', 'yellow');
            }
            if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === '2' || e.key === '@')) {
                var tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
                if (e.target && e.target.isContentEditable && !e.target.closest('.paItemText') && !e.target.closest('#paPreviewEditor') && !e.target.closest('#paMirrorPreviewEditor')) { return; }
                e.preventDefault();
                applyMarkToSelection('bg', 'blue');
            }
            if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === '3' || e.key === '#')) {
                var tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
                if (e.target && e.target.isContentEditable && !e.target.closest('.paItemText') && !e.target.closest('#paPreviewEditor') && !e.target.closest('#paMirrorPreviewEditor')) { return; }
                e.preventDefault();
                applyMarkToSelection('bg', 'red');
            }
            if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === '4' || e.key === '$')) {
                var tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
                if (e.target && e.target.isContentEditable && !e.target.closest('.paItemText') && !e.target.closest('#paPreviewEditor') && !e.target.closest('#paMirrorPreviewEditor')) { return; }
                e.preventDefault();
                applyMarkToSelection('bg', 'green');
            }
            if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === '5' || e.key === '%')) {
                var tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') { return; }
                if (e.target && e.target.isContentEditable && !e.target.closest('.paItemText') && !e.target.closest('#paPreviewEditor') && !e.target.closest('#paMirrorPreviewEditor')) { return; }
                e.preventDefault();
                applyMarkToSelection('bg', 'purple');
            }
            if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
                e.preventDefault();
                var _paLiveSel = window.getSelection();
                var _paLiveRange = (_paLiveSel && _paLiveSel.rangeCount && !_paLiveSel.getRangeAt(0).collapsed) ? _paLiveSel.getRangeAt(0) : (_paCtxSavedRange || null);
                var _eOk = false, _eErr = null;
                try {
                    _eOk = _paClearFormatInSelection(_paLiveRange);
                    if (_eOk) _paClearItemLevelStylesForEditing();
                } catch(err) { _eErr = err; console.error('clear-sel-fmt(E) error:', err); }
                if (_eErr) { try { if (typeof showToast === 'function') showToast('清除出错: ' + _eErr.message); } catch(ee){} hideContextMenu(); return; }
                if (_eOk) { hideContextMenu(); return; }
                if (ctxTargetIdx < 0) { ctxTargetIdx = getCtxSelectedIdx(); ctxIsOther = false; }
                if (ctxTargetIdx >= 0) {
                    var ctxItems = getCtxItems();
                    if (ctxTargetIdx >= 0 && ctxTargetIdx < ctxItems.length && ctxItems[ctxTargetIdx].kind !== 'divider') {
                        pushUndo();
                        delete ctxItems[ctxTargetIdx].marks;
                        delete ctxItems[ctxTargetIdx].bg;
                        delete ctxItems[ctxTargetIdx].highlight;
                        delete ctxItems[ctxTargetIdx].fontFamily;
                        delete ctxItems[ctxTargetIdx].fontSize;
                        var _lv = ctxItems[ctxTargetIdx].level || 'level-body';
                        var _fmt = FORMAT_STANDARD.levels[_lv];
                        if (_fmt) ctxItems[ctxTargetIdx].fontSize = _fmt.fontSize;
                        ctxItems[ctxTargetIdx].marks = { color: 'black' };
                        if (ctxItems[ctxTargetIdx].text) {
                            ctxItems[ctxTargetIdx].text = _paHtmlToPlainTextKeepBreaks(ctxItems[ctxTargetIdx].text);
                        }
                        ctxSave();
                        ctxRender();
                        setCtxSelectedIdx(ctxTargetIdx);
                    }
                }
                hideContextMenu();
            }
            if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                if (ctxTargetIdx < 0) { ctxTargetIdx = getCtxSelectedIdx(); ctxIsOther = false; }
                if (ctxTargetIdx >= 0) { handleContextAction('delete'); }
                hideContextMenu();
            }
            if (e.ctrlKey && !e.altKey && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
                var tag = e.target && e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) { return; }
                e.preventDefault();
                window.paToggleHideMark();
            }
            if (e.ctrlKey && e.altKey && (e.key === 'C' || e.key === 'c')) {
                e.preventDefault();
                if (ctxTargetIdx < 0) { ctxTargetIdx = getCtxSelectedIdx(); ctxIsOther = false; }
                if (ctxTargetIdx >= 0) { handleContextAction('copy-format'); }
                hideContextMenu();
            }
            if (e.ctrlKey && e.altKey && !e.shiftKey && (e.key === 's' || e.key === 'S' || (!isKylinOS() && e.code === 'KeyS'))) {
                e.preventDefault();
                saveCurrentEditor();
                _saveNotepadToCache();
                _saveReportToCache();
                try { DataLayer.set('reminders', reminders) } catch (e) {}
                if (typeof window.paGetItems === 'function') {
                    try { DataLayer.set('problemAnalysisItems', window.paGetItems()) } catch (e) {}
                }
                updateFooterTimestamp();
                showToast('缓存已保存');
            }
            if (e.ctrlKey && e.altKey && (e.key === 'V' || e.key === 'v')) {
                e.preventDefault();
                if (ctxTargetIdx < 0) { ctxTargetIdx = getCtxSelectedIdx(); ctxIsOther = false; }
                if (ctxTargetIdx >= 0) { handleContextAction('paste-format'); }
                hideContextMenu();
            }
        });
        window.paShowTagDialog = paShowTagDialog;
        window.paGetItems = function() {
            try { return JSON.parse(JSON.stringify(items || [])); } catch (e) { return []; }
        };
        window.paSetItems = function(arr) {
            if (!Array.isArray(arr)) return;
            items = arr.map(function(x) {
                if (!x || typeof x !== 'object') return { level: 'level-body', text: '' };
                if (x.kind === 'divider') return { kind: 'divider' };
                var n = { level: x.level || 'level-body', text: x.text || '' };
                if (x.bg) n.bg = x.bg;
                if (x.marks && typeof x.marks === 'object') n.marks = x.marks;
                if (x.tag) n.tag = x.tag;
                if (x.status) n.status = x.status;
                if (x.collapsed) n.collapsed = true;
                if (x.noBreakAfter) n.noBreakAfter = true;
                if (x.noBreakBefore) n.noBreakBefore = true;
                if (Array.isArray(x.refs) && x.refs.length) {
                    n.refs = x.refs.map(function(rr) {
                        if (!rr || typeof rr !== 'object') return { level: 'level-body', text: '' };
                        var nr = { level: rr.level || 'level-body', text: rr.text || '' };
                        if (rr.bg) nr.bg = rr.bg;
                        if (rr.marks && typeof rr.marks === 'object') nr.marks = rr.marks;
                        if (rr.fontFamily) nr.fontFamily = rr.fontFamily;
                        if (rr.fontSize) nr.fontSize = rr.fontSize;
                        return nr;
                    });
                }
                return n;
            });
            collapsedIdx = {};
            selectedIdx = -1;
            paMirrorCollapsedIdx = {};
            paMirrorSelectedIdx = -1;
            save();
            render();
        };
        var _paHiddenPopState = null;
        window.toggleProblemAnalysisPanel = function() {
            var panel = document.getElementById('problemAnalysisPanel');
            var mirror = document.getElementById('problemAnalysisMirror');
            var rightPanel = document.getElementById('rightPanel');
            if (!panel) { alert('面板未找到'); return; }
            var isEmbedded = rightPanel && rightPanel.classList.contains('has-editor');
            var isFixed = panel.classList.contains('paFixedMode');
            if (isEmbedded || isFixed) {
                if (paViewMode === 0) {
                    var overlay = document.getElementById('paPreviewOverlay');
                    if (overlay && overlay.classList.contains('show')) {
                        var editor = document.getElementById('paPreviewEditor');
                        if (editor) syncPreviewBackToItems(editor, false);
                    }
                }
                if (isFixed) {
                    if (paMirrorVisible && mirror) {
                        _paHiddenPopState = {
                            mode: paMirrorMode,
                            mirrorLeft: mirror.style.left,
                            mirrorTop: mirror.style.top,
                            mirrorWidth: mirror.style.width,
                            mirrorHeight: mirror.style.height,
                            mainLeft: panel.style.left,
                            mainTop: panel.style.top,
                            mainWidth: panel.style.width,
                            mainRight: panel.style.right,
                            mainHeight: panel.style.height
                        };
                    }
                    panel.classList.remove('paFixedMode');
                    panel.style.left = ''; panel.style.width = ''; panel.style.right = '';
                    panel.style.top = ''; panel.style.height = '';
                    if (rightPanel) rightPanel.appendChild(panel);
                }
                if (rightPanel) rightPanel.classList.remove('has-editor');
                if (mirror) mirror.classList.remove('show');
                var dv = document.getElementById('paMirrorDivider');
                if (dv) dv.style.display = 'none';
                if (rightPanel) rightPanel.style.marginLeft = '';
                hideContextMenu();
                if (paA4Mode) { paA4Mode = false; }
                paMirrorVisible = false;
                paMirrorMode = 0;
            } else {
                render();
                if (_paHiddenPopState && _paHiddenPopState.mode !== undefined) {
                    var st = _paHiddenPopState;
                    _paHiddenPopState = null;
                    paShowMirrorMode(st.mode);
                    var m2 = document.getElementById('problemAnalysisMirror');
                    panel.style.left = st.mainLeft;
                    panel.style.top = st.mainTop;
                    panel.style.width = st.mainWidth;
                    panel.style.right = st.mainRight;
                    panel.style.height = st.mainHeight;
                    if (m2) {
                        m2.style.left = st.mirrorLeft;
                        m2.style.top = st.mirrorTop;
                        m2.style.width = st.mirrorWidth;
                        m2.style.height = st.mirrorHeight;
                    }
                    _paRefitHeightsToLogArea();
                    _paPositionMirrorDivider();
                    return;
                }
                if (rightPanel && panel.parentNode !== rightPanel) {
                    rightPanel.appendChild(panel);
                }
                if (rightPanel) rightPanel.classList.add('has-editor');
                if (paMirrorVisible && mirror) { mirror.classList.add('show'); _paPositionMirrorDivider(); }
                if (typeof window.applyMainZoom === 'function') window.applyMainZoom();
            }
        };

        window.paMaximizePanel = function(which) {
            var panel = which === 'mirror' ? document.getElementById('problemAnalysisMirror') : document.getElementById('problemAnalysisPanel');
            if (!panel) return;
            if (which === 'mirror') {
                var r = _paLogAreaScreenRect();
                panel.style.top = r.top + 'px';
                panel.style.height = r.height + 'px';
                panel.style.left = panel.style.left || '15px';
                delete panel.dataset.paUserMoved;
            }
        };
        
        // ============ 粘入 / 预览 / 复制 / 导出 ============
        function classifyClipboardToItems(clipText, skipHeaders) {
            var text = (clipText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            var rawLines = text.split('\n');
            var lineItems = [];
            for (var i = 0; i < rawLines.length; i++) {
                var t = rawLines[i];
                if (t.replace(/\s/g, '').length === 0) {
                    if (lineItems.length > 0 && !lineItems[lineItems.length - 1].blank) {
                        lineItems.push({ blank: true });
                    }
                } else {
                    lineItems.push({ blank: false, text: t });
                }
            }
            while (lineItems.length && lineItems[0].blank) lineItems.shift();
            while (lineItems.length && lineItems[lineItems.length - 1].blank) lineItems.pop();
            function _splitAtHeadingBoundaries(t) {
                var parts = [];
                var remaining = t;
                var headingRe = /^([一二三四五六七八九十]+、|第[一二三四五六七八九十]+[，,]|[一二三四五六七八九十]+是|（[一二三四五六七八九十]+）|\([一二三四五六七八九十]+\)|\d+[.、．])/;
                var searchRe = /(?:^|[。！？])\s*([一二三四五六七八九十]+、|第[一二三四五六七八九十]+[，,]|[一二三四五六七八九十]+是|（[一二三四五六七八九十]+）|\([一二三四五六七八九十]+\)|\d+[.、．])/g;
                while (remaining.length > 0) {
                    var headingMatch = remaining.match(headingRe);
                    if (headingMatch) {
                        var senMatch = remaining.match(/^.+?[。！]/);
                        if (senMatch) {
                            parts.push(senMatch[0]);
                            remaining = remaining.substring(senMatch[0].length).trim();
                        } else {
                            parts.push(remaining);
                            break;
                        }
                    } else {
                        searchRe.lastIndex = 0;
                        var nextHeading = searchRe.exec(remaining);
                        if (nextHeading && nextHeading.index > 0) {
                            var before = remaining.substring(0, nextHeading.index + 1).trim();
                            if (before) parts.push(before);
                            remaining = remaining.substring(nextHeading.index + 1).trim();
                        } else {
                            var trimRem = remaining.trim();
                            if (trimRem) parts.push(trimRem);
                            break;
                        }
                    }
                }
                return parts;
            }
            var splitLineItems = [];
            for (var si = 0; si < lineItems.length; si++) {
                var se = lineItems[si];
                if (se.blank) { splitLineItems.push(se); continue; }
                var st = se.text.replace(/^\s+|\s+$/g, '');
                if (!st) continue;
                var subParts = _splitAtHeadingBoundaries(st);
                for (var pi = 0; pi < subParts.length; pi++) {
                    splitLineItems.push({ blank: false, text: subParts[pi], srcLine: si });
                }
            }
            lineItems = splitLineItems;
            var result = [];
            var startPartCount = 0;
            var afterStartPart = false;
            var startHasEntries = false;
            var nonEmptyIndex = -1;
            var dateRe = /(\d{4})\s*[\-\/.年]\s*\d{1,2}|(\d{1,2})\s*月\s*\d{1,2}\s*日|^\d{4}$|^\(?\d{4}\s*年/;
            function hasInlinePunct(s) {
                for (var ci = 0; ci < s.length; ci++) {
                    var ch = s.charAt(ci);
                    if (ch === '，' || ch === '、' || ch === '；' || ch === '。' || ch === '：' || ch === '！' || ch === '？' || ch === ',' || ch === ';' || ch === ':' || ch === '.') return true;
                }
                return false;
                }
                function matchHeadingType(s) {
                    if (s.match(/^([一二三四五六七八九十]+)、/) || s.match(/^(第[一二三四五六七八九十]+)[，,]/)) return 'cn-dun';
                    if (s.match(/^（[一二三四五六七八九十]+）/) || s.match(/^\([一二三四五六七八九十]+\)/)) return 'cn-paren';
                    if (s.match(/^[一二三四五六七八九十]+[是要看抓查学]/)) return 'cn-verb';
                    if (s.match(/^(\d+)[.、．]/) && '。．'.indexOf(s.charAt(s.length - 1)) !== -1) return 'num-dun';
                    return null;
                }
                var _detectedL1Pattern = null;
                var _detectedL2Pattern = null;
                var _detectedL3Pattern = null;
                for (var li = 0; li < lineItems.length; li++) {
                var entry = lineItems[li];
                if (entry.blank) { continue; }
                nonEmptyIndex++;
                var text = entry.text;
                var trimmed = text.replace(/^\s+|\s+$/g, '');
                if (!skipHeaders && !afterStartPart) {
                    var done = false;
                    if (nonEmptyIndex < 4 && trimmed.length <= 30 && !hasInlinePunct(trimmed)) {
                        if (startPartCount === 0) {
                            result.push({ level: 'level-title', text: trimmed, srcLine: entry.srcLine });
                            startPartCount++; startHasEntries = true; done = true;
                        } else if (dateRe.test(trimmed)) {
                            result.push({ level: 'level-date', text: trimmed, srcLine: entry.srcLine });
                            startPartCount++; startHasEntries = true; done = true;
                        } else if (startPartCount <= 2) {
                            result.push({ level: 'level-author', text: trimmed, srcLine: entry.srcLine });
                            startPartCount++; startHasEntries = true; done = true;
                        }
                    }
                    if (!done) {
                        afterStartPart = true;
                        if (startHasEntries) result.push({ kind: 'divider' });
                    } else {
                        continue;
                    }
                } else {
                    afterStartPart = true;
                }
                if (trimmed.match(/^[……‥]*[:：]/) || trimmed.match(/^\.\.\.[:：]/)) {
                    result.push({ level: 'level-recipient', text: trimmed, srcLine: entry.srcLine });
                    continue;
                }
                var hType = matchHeadingType(trimmed);
                if (hType) {
                    if (hType === 'num-dun') {
                        if (!_detectedL2Pattern) {
                            _detectedL2Pattern = hType;
                            _detectedL3Pattern = null;
                            result.push({ level: 'level-2', text: trimmed, srcLine: entry.srcLine });
                        } else if (hType === _detectedL2Pattern) {
                            _detectedL3Pattern = null;
                            result.push({ level: 'level-2', text: trimmed, srcLine: entry.srcLine });
                        } else if (!_detectedL3Pattern) {
                            _detectedL3Pattern = hType;
                            result.push({ level: 'level-3', text: trimmed, srcLine: entry.srcLine });
                        } else if (hType === _detectedL3Pattern) {
                            result.push({ level: 'level-3', text: trimmed, srcLine: entry.srcLine });
                        } else {
                            result.push({ level: 'level-body', text: trimmed, srcLine: entry.srcLine });
                        }
                    } else if (!_detectedL1Pattern) {
                        _detectedL1Pattern = hType;
                        _detectedL2Pattern = null;
                        _detectedL3Pattern = null;
                        result.push({ level: 'level-1', text: trimmed, srcLine: entry.srcLine });
                    } else if (hType === _detectedL1Pattern) {
                        _detectedL2Pattern = null;
                        _detectedL3Pattern = null;
                        result.push({ level: 'level-1', text: trimmed, srcLine: entry.srcLine });
                    } else if (!_detectedL2Pattern) {
                        _detectedL2Pattern = hType;
                        _detectedL3Pattern = null;
                        result.push({ level: 'level-2', text: trimmed, srcLine: entry.srcLine });
                    } else if (hType === _detectedL2Pattern) {
                        _detectedL3Pattern = null;
                        result.push({ level: 'level-2', text: trimmed, srcLine: entry.srcLine });
                    } else if (!_detectedL3Pattern) {
                        _detectedL3Pattern = hType;
                        result.push({ level: 'level-3', text: trimmed, srcLine: entry.srcLine });
                    } else if (hType === _detectedL3Pattern) {
                        result.push({ level: 'level-3', text: trimmed, srcLine: entry.srcLine });
                    } else {
                        result.push({ level: 'level-body', text: trimmed, srcLine: entry.srcLine });
                    }
                    continue;
                }
                result.push({ level: 'level-body', text: trimmed, srcLine: entry.srcLine });
            }
            if (startPartCount === 0 && result.length > 0 && !skipHeaders) {
                result.unshift({ kind: 'divider' });
                result.unshift({ level: 'level-date', text: '日期' });
                result.unshift({ level: 'level-title', text: '请输入标题' });
            }
            for (var mi = 0; mi < result.length; mi++) {
                if (result[mi].kind === 'divider') continue;
                var lv = result[mi].level;
                if (lv === 'level-title' || lv === 'level-date' || lv === 'level-author') continue;
                if (mi > 0 && result[mi - 1].kind !== 'divider' && result[mi - 1].srcLine === result[mi].srcLine) {
                    result[mi].noBreakBefore = true;
                }
                if (mi < result.length - 1 && result[mi + 1].kind !== 'divider' && result[mi + 1].srcLine === result[mi].srcLine) {
                    result[mi].noBreakAfter = true;
                }
            }
            if (result.length === 0) result.push({ level: 'level-body', text: '' });
            return result;
        }
        function paTryFocus() {
            try { window.focus(); } catch (e) {}
            try {
                var panel = document.getElementById('problemAnalysisPanel');
                if (panel) panel.focus && panel.focus();
            } catch (e) {}
        }
        function paPromptPaste(onText) {
            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10200;display:flex;align-items:center;justify-content:center;';
            var box = document.createElement('div');
            box.style.cssText = 'background:#fff;border-radius:8px;padding:18px 20px;min-width:360px;max-width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.3);font-family:"SimHei","黑体",sans-serif;';
            box.innerHTML = '<div style="font-size:14px;font-weight:bold;color:#2c3e50;margin-bottom:8px;">请粘贴内容</div><div style="font-size:12px;color:#666;margin-bottom:10px;">请在下方框中按 Ctrl+V（或 Shift+Insert）粘贴，确认后点击"应用"。</div><textarea style="width:100%;height:180px;padding:8px;border:1px solid #ccc;border-radius:4px;font-family:inherit;font-size:13px;outline:none;" placeholder="在此处按 Ctrl+V 粘贴"></textarea><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;"><button class="paCancelBtn" style="padding:6px 18px;border:1px solid #ccc;background:#f5f5f5;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;">取消</button><button class="paApplyBtn" style="padding:6px 18px;border:none;background:#667eea;color:#fff;border-radius:4px;cursor:pointer;font-family:inherit;font-size:12px;">应用</button></div>';
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            var ta = box.querySelector('textarea');
            setTimeout(function() { ta.focus(); }, 50);
            var cancel = box.querySelector('.paCancelBtn');
            var apply = box.querySelector('.paApplyBtn');
            cancel.addEventListener('click', function() { document.body.removeChild(overlay); });
            apply.addEventListener('click', function() {
                var txt = ta.value || '';
                document.body.removeChild(overlay);
                if (txt) onText(txt);
            });
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) document.body.removeChild(overlay);
            });
        }
        function paReadClipboardThen(apply) {
            paTryFocus();
            if (navigator.clipboard && navigator.clipboard.readText) {
                navigator.clipboard.readText().then(function(txt) {
                    apply(txt || '');
                }, function(err) {
                    paPromptPaste(apply);
                });
            } else {
                paPromptPaste(apply);
            }
        }
        window.paCloseDropdowns = function() {
            document.querySelectorAll('.paDropdownMenu.show').forEach(function(m){m.classList.remove('show');});
        };
        window.paTogglePasteDropdown = function(e) {
            e.stopPropagation();
            var wrap = e.currentTarget.parentNode;
            var menu = wrap.querySelector('.paDropdownMenu');
            if (!menu) return;
            var shown = menu.classList.contains('show');
            paCloseDropdowns();
            if (!shown) menu.classList.add('show');
        };
        window.paToggleFilterDropdown = function(e) {
            e.stopPropagation();
            var wrap = e.currentTarget.parentNode;
            var menu = wrap.querySelector('.paDropdownMenu');
            if (!menu) return;
            var shown = menu.classList.contains('show');
            paCloseDropdowns();
            if (!shown) menu.classList.add('show');
        };
        window.paToggleMirrorDropdown = function(e) {
            e.stopPropagation();
            var wrap = e.currentTarget.parentNode;
            var menu = wrap.querySelector('.paDropdownMenu');
            if (!menu) return;
            var shown = menu.classList.contains('show');
            paCloseDropdowns();
            if (!shown) menu.classList.add('show');
        };
        window.paToggleDisplayDropdown = function(e) {
            e.stopPropagation();
            var wrap = e.currentTarget.parentNode;
            var menu = wrap.querySelector('.paDropdownMenu');
            if (!menu) return;
            var shown = menu.classList.contains('show');
            paCloseDropdowns();
            if (!shown) menu.classList.add('show');
            var item = document.getElementById('paFullscreenItem');
            if (item) item.textContent = document.fullscreenElement ? '退出全屏' : '全屏显示';
        };
        window.paToggleFullscreen = function() {
            paCloseDropdowns();
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen().catch(function(err) {
                    alert('全屏失败: ' + err.message);
                });
            }
        };
        var _paFSState = null;
        (function initPaPlacement() {
            var mc = document.getElementById('mainContent');
            var pa = document.getElementById('problemAnalysisPanel');
            var pm = document.getElementById('problemAnalysisMirror');
            if (mc && pa) mc.appendChild(pa);
            if (mc && pm) mc.appendChild(pm);
        })();
        function _paLogAreaScreenRect() {
            var rp = document.getElementById('rightPanel');
            if (rp && rp.offsetParent !== null) {
                return _npScreenRect(rp);
            }
            var header = document.getElementById('mainHeader');
            var footer = document.getElementById('mainFooter');
            if (header && footer) {
                var hRect = header.getBoundingClientRect();
                var fRect = footer.getBoundingClientRect();
                return { top: hRect.bottom + 15, height: fRect.top - 30 - hRect.bottom };
            }
            return { top: 75, height: window.innerHeight - 90 };
        }
        function _paRefitHeightsToLogArea() {
            var panel = document.getElementById('problemAnalysisPanel');
            var mirror = document.getElementById('problemAnalysisMirror');
            if (!panel) return;
            var r = _paLogAreaScreenRect();
            if (mirror && mirror.classList.contains('show')) {
                mirror.style.top = r.top + 'px';
                mirror.style.height = r.height + 'px';
                mirror.style.bottom = '';
            }
            panel.style.top = r.top + 'px';
            panel.style.height = r.height + 'px';
            panel.style.bottom = 'auto';
            if (paMirrorVisible) _paPositionMirrorDivider();
        }
        window.paFitToLogArea = function() {
            var panel = document.getElementById('problemAnalysisPanel');
            if (!panel) return;
            _paRefitHeightsToLogArea();
            _paPositionMirrorDivider();
            showToast('已与日志区域对齐');
        };
        function _paFullscreenChanged() {
            var panel = document.getElementById('problemAnalysisPanel');
            var mirror = document.getElementById('problemAnalysisMirror');
            var rightPanel = document.getElementById('rightPanel');
            var isFS = document.fullscreenElement;
            if (isFS) {
                _paFSState = {
                    panelFixed: !!(panel && panel.classList.contains('paFixedMode')),
                    mirrorVisible: !!(mirror && mirror.classList.contains('show'))
                };
                if (panel) {
                    _paFSState.panelStyle = { top: panel.style.top, left: panel.style.left, right: panel.style.right, bottom: panel.style.bottom, height: panel.style.height, width: panel.style.width };
                }
                if (mirror) {
                    _paFSState.mirrorStyle = { top: mirror.style.top, left: mirror.style.left, right: mirror.style.right, bottom: mirror.style.bottom, height: mirror.style.height, width: mirror.style.width };
                }
                _paRefitHeightsToLogArea();
            } else {
                if (_paFSState) {
                    if (panel && _paFSState.panelStyle) {
                        for (var k in _paFSState.panelStyle) panel.style[k] = _paFSState.panelStyle[k];
                    }
                    if (mirror && _paFSState.mirrorStyle) {
                        for (var m in _paFSState.mirrorStyle) mirror.style[m] = _paFSState.mirrorStyle[m];
                    }
                    if (!_paFSState.panelFixed && panel && rightPanel) {
                        if (panel.parentNode !== rightPanel) rightPanel.appendChild(panel);
                        rightPanel.classList.add('has-editor');
                    }
                    if (paMirrorVisible) _paPositionMirrorDivider();
                }
                _paFSState = null;
            }
            var item = document.getElementById('paFullscreenItem');
            if (item) item.textContent = isFS ? '退出全屏' : '全屏显示';
        }
        document.addEventListener('fullscreenchange', _paFullscreenChanged);
        window.addEventListener('resize', function() {
            var panel = document.getElementById('problemAnalysisPanel');
            if (!panel || !panel.classList.contains('show')) return;
            if (document.fullscreenElement || paMirrorVisible) {
                _paRefitHeightsToLogArea();
            }
        });
        function _buildA4Html(sourceItems) {
            var a4FontSizes = {
                'level-title': '22pt',
                'level-date': '18pt',
                'level-author': '18pt',
                'level-recipient': '18pt',
                'level-secret': '18pt',
                'level-1': '15pt',
                'level-2': '18pt',
                'level-3': '15pt',
                'level-body': '15pt'
            };
            var CPL = {
                'level-title': 19,
                'level-date': 22,
                'level-author': 22,
                'level-recipient': 22,
                'level-secret': 22,
                'level-1': 28,
                'level-2': 23,
                'level-3': 28,
                'level-body': 28
            };
            var LINES_PER_PAGE = 22;
            function _a4FontFamily(level) {
                var lv = FORMAT_STANDARD.levels[level] || FORMAT_STANDARD.levels['level-body'];
                var ff = lv.fontFamily;
                var _generic = { serif:1, 'sans-serif':1, monospace:1, cursive:1, fantasy:1, 'system-ui':1 };
                return ff.split(',').map(function(f) { var t = f.trim(); return !_generic[t] && t.indexOf("'") === -1 && t.indexOf('"') === -1 ? "'" + t + "'" : t; }).join(',');
            }
            function _itemStyle(level, it) {
                var lv = FORMAT_STANDARD.levels[level] || FORMAT_STANDARD.levels['level-body'];
                var fs = a4FontSizes[level] || a4FontSizes['level-body'];
                var ff = _a4FontFamily(level);
                var s = 'font-family:' + ff + ';font-size:' + fs + ';line-height:28.6pt;margin:0;';
                if (level === 'level-title' || level === 'level-date' || level === 'level-author') {
                    s += 'text-align:center;text-indent:0;';
                } else {
                    s += 'text-align:left;text-indent:2em;';
                }
                if (it && it.marks && it.marks.bold === true) s += 'font-weight:bold;';
                else if (!(it && it.marks && it.marks.bold === false) && lv.fontWeight) s += 'font-weight:' + lv.fontWeight + ';';
                if (it && it.bg) {
                    var bgMap = { red:'#ffcdd2', yellow:'#fff3cd', blue:'#d4e6f1', green:'#d5f5e3', orange:'#fdebd0', gray:'#e0e0e0', purple:'#e8daef' };
                    if (bgMap[it.bg]) s += 'background:' + bgMap[it.bg] + ';';
                } else if (lv.bg) { s += 'background:' + lv.bg + ';'; }
                if (it && it.marks) {
                    if (it.marks.italic) s += 'font-style:italic;';
                    var deco = [];
                    if (it.marks.underline) deco.push('underline');
                    if (it.marks.strike) deco.push('line-through');
                    if (deco.length) s += 'text-decoration:' + deco.join(' ') + ';';
                    if (it.marks.color) {
                        var cmap = { red:'#c0392b', blue:'#2980b9', black:'#000', gray:'#888' };
                        if (cmap[it.marks.color]) s += 'color:' + cmap[it.marks.color] + ';';
                    }
                }
                return s;
            }
            function breakLines(txt, max, firstMax) {
                if (!txt) return [''];
                if (firstMax == null) firstMax = max;
                if (txt.length <= firstMax) return [txt];
                var lines = [];
                var cur = '';
                var curLen = 0;
                var curMax = firstMax;
                for (var bi = 0; bi < txt.length; bi++) {
                    var ch = txt[bi];
                    if (curLen >= curMax && curLen > 0) {
                        lines.push(cur);
                        cur = '';
                        curLen = 0;
                        curMax = max;
                    }
                    cur += ch;
                    curLen++;
                }
                if (cur) lines.push(cur);
                return lines;
            }
            function isBeginningLevel(lv) {
                return lv === 'level-title' || lv === 'level-date' || lv === 'level-author' || lv === 'level-secret';
            }
            var contentStart = 0;
            for (var ci = 0; ci < sourceItems.length; ci++) {
                var cit = sourceItems[ci];
                if (cit.kind === 'divider') continue;
                var clv = cit.level || 'level-body';
                if (!isBeginningLevel(clv)) { contentStart = ci; break; }
            }
            var pageEntries = [];
            function addEntry(html, lines) {
                pageEntries.push({ html: html, lines: lines });
            }
            for (var bi = 0; bi < contentStart; bi++) {
                var bit = sourceItems[bi];
                if (bit.kind === 'divider') continue;
                if (bit.paHidden && !_paHideMarkedAllHidden) continue;
                var btext = bit.text || '';
                if (/<[a-zA-Z]/.test(btext)) {
                    var d = document.createElement('div');
                    d.innerHTML = btext;
                    btext = d.textContent || '';
                }
                btext = btext.trim();
                if (!btext) continue;
                var bLevel = bit.level || 'level-body';
                var bStyle = _itemStyle(bLevel, bit);
                var cpl = CPL[bLevel] || 28;
                var hdIndent = (bLevel !== 'level-title' && bLevel !== 'level-date' && bLevel !== 'level-author');
                var hdFirstMax = hdIndent ? cpl - 2 : cpl;
                var hdLines = breakLines(btext, cpl, hdFirstMax);
                var hdIsMulti = hdLines.length > 1 && hdIndent;
                for (var li = 0; li < hdLines.length; li++) {
                    var hdLineStyle = (li > 0 && hdIndent) ? bStyle.replace('text-indent:2em;', 'text-indent:0;') : bStyle;
                    if (hdIsMulti && li < hdLines.length - 1) { hdLineStyle = hdLineStyle.replace('text-align:left;', 'text-align:justify;'); }
                    addEntry('<p style="' + hdLineStyle + '">' + paEscapeHtml(hdLines[li]) + '</p>', 1);
                }
            }
            if (contentStart > 0) {
                addEntry('<p style="line-height:28.6pt;margin:0;">&nbsp;</p>', 1);
            }
            for (var i = contentStart; i < sourceItems.length; i++) {
                var it = sourceItems[i];
                if (it.kind === 'divider') continue;
                if (it.paHidden && !_paHideMarkedAllHidden) continue;
                var text = it.text || '';
                if (/<[a-zA-Z]/.test(text)) {
                    var d = document.createElement('div');
                    d.innerHTML = text;
                    text = d.textContent || '';
                }
                text = text.trim();
                if (!text) continue;
                var level = it.level || 'level-body';
                var style = _itemStyle(level, it);
                var cpl = CPL[level] || 28;
                var hasIndent = (level !== 'level-title' && level !== 'level-date' && level !== 'level-author');
                var firstMax = hasIndent ? cpl - 2 : cpl;
                var lines = breakLines(text, cpl, firstMax);
                var isMulti = lines.length > 1 && hasIndent;
                for (var li = 0; li < lines.length; li++) {
                    var lineStyle = (li > 0 && hasIndent) ? style.replace('text-indent:2em;', 'text-indent:0;') : style;
                    if (isMulti && li < lines.length - 1) { lineStyle = lineStyle.replace('text-align:left;', 'text-align:justify;'); }
                    addEntry('<p style="' + lineStyle + '">' + paEscapeHtml(lines[li]) + '</p>', 1);
                }
            }
            var totalVisualLines = 0;
            for (var ei = 0; ei < pageEntries.length; ei++) totalVisualLines += pageEntries[ei].lines;
            var totalPages = Math.ceil(totalVisualLines / LINES_PER_PAGE);
            if (totalPages === 0) totalPages = 1;
            var html = '';
            var pageIdx = 1;
            var pageContent = '';
            var pageLineCount = 0;
            for (var ei = 0; ei < pageEntries.length; ei++) {
                var entry = pageEntries[ei];
                if (pageLineCount + entry.lines > LINES_PER_PAGE) {
                    html += '<div class="paA4Page"><div class="paA4Content">' + pageContent + '</div><div class="paA4PageNum">' + pageIdx + '/' + totalPages + '</div></div>';
                    if (pageIdx < totalPages) html += '<div class="paA4PageBreak"></div>';
                    pageContent = '';
                    pageLineCount = 0;
                    pageIdx++;
                }
                pageContent += entry.html;
                pageLineCount += entry.lines;
            }
            if (pageContent) {
                html += '<div class="paA4Page"><div class="paA4Content">' + pageContent + '</div><div class="paA4PageNum">' + pageIdx + '/' + totalPages + '</div></div>';
            }
            return html || '<div class="paA4Page"><div class="paA4Content"><p style="line-height:28.6pt;margin:0;text-align:center;color:#999;">（无内容）</p></div></div>';
        }
        window.paShowMirrorMode = function(mode) {
            var panel = document.getElementById('problemAnalysisMirror');
            var mainPanel = document.getElementById('problemAnalysisPanel');
            var rightPanel = document.getElementById('rightPanel');
            if (!panel || !mainPanel) return;
            if (!paMirrorVisible) { paMirrorVisible = true; panel.classList.add('show');
                paMirrorZoomLevel = paZoomLevel;
                applyPaMirrorZoom();
            }
            var cssSide = 15, cssGap = 5, cssMinW = 320;
            function moveMainToContainer() {
                var mc = document.getElementById('mainContent');
                if (rightPanel && mainPanel.parentNode === rightPanel && mc) {
                    mc.appendChild(mainPanel);
                }
                mainPanel.classList.add('paFixedMode');
            }
            function layoutSplit() {
                var r = _paLogAreaScreenRect();
                var mW, eW;
                if (mode === 0) { eW = (window.innerWidth - cssSide * 2 - cssGap) / 2; mW = eW; }
                else if (mode === 2) {
                    eW = mainPanel.getBoundingClientRect().width;
                    mW = window.innerWidth - cssSide * 2 - cssGap - eW;
                    if (mW < cssMinW) { mW = cssMinW; eW = window.innerWidth - cssSide * 2 - cssGap - mW; }
                }
                panel.style.top = r.top + 'px'; panel.style.height = r.height + 'px';
                panel.style.left = cssSide + 'px'; panel.style.width = mW + 'px';
                mainPanel.style.top = r.top + 'px'; mainPanel.style.height = r.height + 'px';
                mainPanel.style.left = ''; mainPanel.style.right = cssSide + 'px';
                mainPanel.style.width = eW + 'px';
            }
            if (mode === 0 || mode === 2) {
                moveMainToContainer();
                layoutSplit();
                paSwitchMirrorMode(mode);
                _paPositionMirrorDivider();
                return;
            }
            if (mode === 1) {
                var leftP = document.getElementById('leftPanel');
                var rightP = document.getElementById('rightPanel');
                var mirrorTop, mirrorHeight, mirrorLeft, mirrorWidth;
                if (rightP && rightP.offsetParent !== null) {
                    var rrRef = _npScreenRect(rightP);
                    mirrorTop = rrRef.top; mirrorHeight = rrRef.height;
                } else if (leftP) {
                    var lr = _npScreenRect(leftP);
                    mirrorTop = lr.top; mirrorHeight = lr.height;
                } else {
                    mirrorTop = 75; mirrorHeight = window.innerHeight - 90;
                }
                if (leftP) {
                    var lr = _npScreenRect(leftP);
                    mirrorLeft = lr.left; mirrorWidth = lr.width;
                } else {
                    mirrorLeft = cssSide; mirrorWidth = 360;
                }
                panel.style.top = mirrorTop + 'px'; panel.style.height = mirrorHeight + 'px';
                panel.style.left = mirrorLeft + 'px'; panel.style.width = mirrorWidth + 'px';
                if (rightPanel) rightPanel.style.marginLeft = '';
                moveMainToContainer();
                if (rightP) {
                    var rr = _npScreenRect(rightP);
                    mainPanel.style.top = rr.top + 'px'; mainPanel.style.height = rr.height + 'px';
                    mainPanel.style.left = ''; mainPanel.style.right = cssSide + 'px';
                    var mirrorRight = mirrorLeft + mirrorWidth;
                    mainPanel.style.width = (window.innerWidth - cssSide - (mirrorRight + 4)) + 'px';
                    if (parseFloat(mainPanel.style.width) < cssMinW) mainPanel.style.width = cssMinW + 'px';
                }
                paSwitchMirrorMode(mode);
                _paPositionMirrorDivider();
                return;
            }
            moveMainToContainer();
            layoutSplit();
            paSwitchMirrorMode(mode);
        };
        document.addEventListener('click', function() {
            paCloseDropdowns();
        });
        window.paPasteOverwrite = function() {
            if (paMirrorMode === 2) {
                var proceed = function(txt) {
                    if (!txt) { alert('剪贴板内容为空'); return; }
                    if (paOtherItems.length > 0) {
                        if (!confirm('粘入将替换当前编辑器内所有内容，是否继续？')) return;
                    }
                    paOtherItems = classifyClipboardToItems(txt);
                    paOtherCollapsedIdx = {};
                    paOtherMirrorCollapsedIdx = {};
                    paOtherMirrorFilterActive = false;
                    paOtherMirrorSelectedIdx = -1;
                    paOtherSelectedIdx = -1;
                    renderOtherMirror();
                };
                paReadClipboardThen(proceed);
                return;
            }
            var proceed = function(txt) {
                if (!txt) { alert('剪贴板内容为空'); return; }
                if (items.length > 0) {
                    if (!confirm('粘入将替换当前编辑器内所有内容，是否继续？')) return;
                }
                var newItems = classifyClipboardToItems(txt);
                items = newItems;
                collapsedIdx = {};
                selectedIdx = -1;
                paMirrorCollapsedIdx = {};
                paMirrorSelectedIdx = -1;
                save();
                render();
            };
            paReadClipboardThen(proceed);
        };
        window.paPasteAppend = function() {
            if (paMirrorMode === 2) {
                var proceed = function(txt) {
                    if (!txt) { alert('剪贴板内容为空'); return; }
                    paOtherItems = paOtherItems.concat(classifyClipboardToItems(txt, true));
                    renderOtherMirror();
                };
                paReadClipboardThen(proceed);
                return;
            }
            var proceed = function(txt) {
                if (!txt) { alert('剪贴板内容为空'); return; }
                var newItems = classifyClipboardToItems(txt, true);
                items = items.concat(newItems);
                save();
                render();
            };
            paReadClipboardThen(proceed);
        };
        var paZoomLevel = 1;
        function syncMirrorPreviewFromItems() {
            var overlay = document.getElementById('paMirrorPreviewOverlay');
            var editor = document.getElementById('paMirrorPreviewEditor');
            var body = document.getElementById('paMirrorBody');
            if (!overlay || !editor || !body) return;
            if (paMirrorViewMode === 1 && overlay.classList.contains('show') && editor.getAttribute('contenteditable') === 'true' && document.activeElement === editor) return;
            if (paMirrorMode !== 1 && paMirrorViewMode === 0) body.style.display = '';
            if (paMirrorViewMode === 1) editor.innerHTML = buildPreviewHtml();
            if (!editor._mirrorSyncInit) {
                editor._mirrorSyncInit = true;
                editor.addEventListener('input', function() {
                    if (paMirrorVisible && paMirrorMode === 0 && paViewMode === 0) {
                        var target = document.getElementById('paPreviewEditor');
                        if (target && target !== document.activeElement && !target._mirrorSyncing) {
                            target._mirrorSyncing = true;
                            target.innerHTML = this.innerHTML;
                            target._mirrorSyncing = false;
                        }
                    }
                });
            }
        }
        function syncOtherMirrorPreviewFromItems() {
            var overlay = document.getElementById('paMirrorPreviewOverlay');
            var editor = document.getElementById('paMirrorPreviewEditor');
            var body = document.getElementById('paMirrorBody');
            if (!overlay || !editor || !body) return;
            if (paOtherMirrorViewMode === 1 && overlay.classList.contains('show') && editor.getAttribute('contenteditable') === 'true' && document.activeElement === editor) return;
            if (paOtherMirrorViewMode === 0) body.style.display = '';
            if (paOtherMirrorViewMode === 1) editor.innerHTML = buildOtherPreviewHtml();
        }
        function applyPaMirrorZoom() {
            var body = document.getElementById('paMirrorBody');
            if (body) body.style.zoom = paMirrorZoomLevel;
            var outline = document.getElementById('paMirrorOutlineBody');
            if (outline) outline.style.zoom = paMirrorZoomLevel;
            var preview = document.getElementById('paMirrorPreviewEditor');
            if (preview) preview.style.zoom = paMirrorZoomLevel;
        }
        function paSwitchMirrorMode(mode) {
            var panel = document.getElementById('problemAnalysisMirror');
            panel.classList.remove('paMirrorOutlineMode');
            var oldMode = paMirrorMode;
            if (oldMode === 2) {
                var editor = document.getElementById('paOtherEditor');
                if (editor) {
                    var text = editor.textContent || '';
                    var lines = text.split('\n').filter(function(l){return l.length > 0;});
                    paOtherItems = lines.length ? lines.map(function(l){return {text:l};}) : [{text:''}];
                }
            }
            paMirrorMode = mode;
            var body = document.getElementById('paMirrorBody');
            var outline = document.getElementById('paMirrorOutlineBody');
            var other = document.getElementById('paMirrorOtherBody');
            var title = document.getElementById('paMirrorTitle');
            var openBtn = document.getElementById('paMirrorOpenBtn');
            var saveBtn = document.getElementById('paMirrorSaveBtn');
            var filter = document.getElementById('paMirrorLevelFilterBtn');
            var btns = document.getElementById('paMirrorBottomToolbar');
            var previewOverlay = document.getElementById('paMirrorPreviewOverlay');
            if (!body || !outline || !other || !title) return;
            body.style.display = 'none';
            outline.style.display = 'none';
            other.style.display = 'none';
            if (filter) filter.style.display = 'none';
            if (btns) btns.style.display = 'none';
            if (previewOverlay) previewOverlay.style.display = 'none';
            if (openBtn) openBtn.style.display = 'none';
            if (saveBtn) saveBtn.style.display = 'none';
            var oa = document.getElementById('paMirrorOutlineActions');
            if (oa) oa.style.display = 'none';
            if (mode === 0) {
                title.textContent = '编辑器（镜像）';
                body.style.display = 'flex';
                var tb = document.querySelector('#paMirrorDragHandle .paToolbar');
                if (tb) tb.style.display = '';
                if (filter) filter.style.display = '';
                if (btns) btns.style.display = 'flex';
                if (previewOverlay) previewOverlay.style.display = '';
                renderMirror();
            } else if (mode === 1) {
                title.textContent = '编辑器（提纲）';
                outline.style.display = 'flex';
                panel.classList.add('paMirrorOutlineMode');
                if (oa) oa.style.display = 'flex';
                var ob = document.querySelector('#paMirrorDragHandle .paToolbar');
                if (ob) ob.style.display = 'none';
                if (openBtn) openBtn.style.display = 'none';
                if (saveBtn) saveBtn.style.display = 'none';
                if (btns) btns.style.display = 'none';
                paApplyLevelFilter('all');
                paRenderOutline();
            } else if (mode === 2) {
                title.textContent = '编辑器（新建）';
                body.style.display = 'flex';
                var tb3 = document.querySelector('#paMirrorDragHandle .paToolbar');
                if (tb3) tb3.style.display = '';
                if (filter) filter.style.display = '';
                if (btns) btns.style.display = 'flex';
                if (openBtn) openBtn.style.display = 'inline-block';
                if (saveBtn) saveBtn.style.display = 'inline-block';
                if (previewOverlay) previewOverlay.style.display = '';
                renderOtherMirror();
            }
        }
        window.paCycleMirrorMode = function() {
            var panel = document.getElementById('problemAnalysisMirror');
            var mainPanel = document.getElementById('problemAnalysisPanel');
            if (!panel || !mainPanel) return;
            if (!paMirrorVisible) {
                paShowMirrorMode(0);
            } else {
                if (paMirrorMode === 2) {
                    paMirrorHide();
                } else {
                    paShowMirrorMode(paMirrorMode + 1);
                }
            }
        };
        window.paMirrorHide = function() {
            var panel = document.getElementById('problemAnalysisMirror');
            var mainPanel = document.getElementById('problemAnalysisPanel');
            var rightPanel = document.getElementById('rightPanel');
            if (panel) panel.classList.remove('show');
            if (mainPanel) {
                mainPanel.style.left = ''; mainPanel.style.width = ''; mainPanel.style.right = '';
                mainPanel.style.top = ''; mainPanel.style.height = '';
                mainPanel.classList.remove('paFixedMode');
                if (rightPanel && mainPanel.parentNode !== rightPanel) {
                    rightPanel.appendChild(mainPanel);
                }
                if (rightPanel) rightPanel.classList.add('has-editor');
            }
            var dv = document.getElementById('paMirrorDivider');
            if (dv) dv.style.display = 'none';
            var rp = document.getElementById('rightPanel');
            if (rp) rp.style.marginLeft = '';
            paMirrorVisible = false;
            paMirrorMode = 0;
        };
        function _paPositionMirrorDivider() {
            var mirror = document.getElementById('problemAnalysisMirror');
            var mainPanel = document.getElementById('problemAnalysisPanel');
            var divider = document.getElementById('paMirrorDivider');
            if (!mirror || !mainPanel || !divider) return;
            if (!mirror.classList.contains('show') && !mainPanel.classList.contains('paFixedMode') && !mainPanel.classList.contains('show')) {
                divider.style.display = 'none';
                return;
            }
            var mr = mirror.getBoundingClientRect();
            var mainR = mainPanel.getBoundingClientRect();
            if (mr.right <= 0 || mainR.left <= 0 || mr.top <= 0) { divider.style.display = 'none'; return; }
            divider.style.display = 'block';
            divider.style.top = Math.min(mr.top, mainR.top) + 'px';
            divider.style.height = Math.max(mr.bottom, mainR.bottom) - Math.min(mr.top, mainR.top) + 'px';
            divider.style.left = mr.right + 'px';
        }
        (function initPaMirrorDivider() {
            var divider = document.getElementById('paMirrorDivider');
            if (!divider || divider._bound) return;
            divider._bound = true;
            divider.addEventListener('mousedown', function(e) {
                var mirror = document.getElementById('problemAnalysisMirror');
                var mainPanel = document.getElementById('problemAnalysisPanel');
                if (!mirror || !mainPanel) return;
                var mr = mirror.getBoundingClientRect();
                var mainRect = mainPanel.getBoundingClientRect();
                var startX = e.clientX;
                var startMW = mr.width;
                var startEW = mainRect.width;
                var totalW = startMW + startEW;
                divider.classList.add('dragging');
                e.preventDefault();
                function onMove(ev) {
                    var dx = ev.clientX - startX;
                    var newMW = startMW + dx;
                    var newEW = totalW - newMW;
                    var minMW = 160, minEW = 320;
                    if (newMW < minMW) { newMW = minMW; newEW = totalW - minMW; }
                    if (newEW < minEW) { newEW = minEW; newMW = totalW - minEW; }
                    mirror.style.width = newMW + 'px';
                    if (mainPanel.classList.contains('paFixedMode')) {
                        mainPanel.style.width = newEW + 'px';
                        mainPanel.style.left = '';
                        mainPanel.style.right = '15px';
                    } else {
                        var rightPanel = document.getElementById('rightPanel');
                        if (rightPanel) {
                            var mr2 = mirror.getBoundingClientRect();
                            var rr = rightPanel.getBoundingClientRect();
                            rightPanel.style.marginLeft = (mr2.right + 4 - rr.left) + 'px';
                        }
                    }
                    _paPositionMirrorDivider();
                }
                function onUp() {
                    divider.classList.remove('dragging');
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        })();
        window.paScrollToStart = function() {
            var body = document.getElementById('paBody');
            if (!body) return;
            var first = body.querySelector('div');
            if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        window.paScrollToEnd = function() {
            var body = document.getElementById('paBody');
            if (!body) return;
            var all = body.querySelectorAll('div');
            if (all.length) all[all.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        window.paScrollToPrevSameLevel = function() {
            var idx = selectedIdx >= 0 ? selectedIdx : 0;
            if (idx < 0 || idx >= items.length) return;
            items[idx].collapsed = true;
            var curLevel = items[idx].level;
            var headingLevels = ['level-title','level-date','level-author','level-recipient','level-1','level-2','level-3'];
            var isHeading = headingLevels.indexOf(curLevel) !== -1;
            for (var pi = idx - 1; pi >= 0; pi--) {
                if (items[pi].kind === 'divider') continue;
                if (isHeading) {
                    if (items[pi].level === curLevel) {
                        delete items[pi].collapsed;
                        selectedIdx = pi; save(); render(); scrollToItem(pi); return;
                    }
                }
            }
            for (var pi2 = idx - 1; pi2 >= 0; pi2--) {
                if (items[pi2].kind === 'divider') continue;
                var lv = items[pi2].level;
                if (headingLevels.indexOf(lv) !== -1 && headingLevels.indexOf(lv) <= headingLevels.indexOf(curLevel)) {
                    delete items[pi2].collapsed;
                    selectedIdx = pi2; save(); render(); scrollToItem(pi2); return;
                }
            }
        };
        window.paScrollToNextSameLevel = function() {
            var idx = selectedIdx >= 0 ? selectedIdx : 0;
            if (idx < 0 || idx >= items.length) return;
            items[idx].collapsed = true;
            var curLevel = items[idx].level;
            var headingLevels = ['level-title','level-date','level-author','level-recipient','level-1','level-2','level-3'];
            var isHeading = headingLevels.indexOf(curLevel) !== -1;
            for (var ni = idx + 1; ni < items.length; ni++) {
                if (items[ni].kind === 'divider') continue;
                if (isHeading) {
                    if (items[ni].level === curLevel) {
                        delete items[ni].collapsed;
                        selectedIdx = ni; save(); render(); scrollToItem(ni); return;
                    }
                }
                var lv = items[ni].level;
                if (headingLevels.indexOf(lv) !== -1 && headingLevels.indexOf(lv) <= headingLevels.indexOf(curLevel)) {
                    delete items[ni].collapsed;
                    selectedIdx = ni; save(); render(); scrollToItem(ni); return;
                }
            }
        };
        function scrollToItem(idx) {
            var body = document.getElementById('paBody');
            if (!body) return;
            var divs = body.querySelectorAll('.paItem');
            for (var si = 0; si < divs.length; si++) {
                if (parseInt(divs[si].dataset.idx, 10) === idx) {
                    divs[si].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
            }
        }
        window.paZoomIn = function() {
            paZoomLevel = Math.min(paZoomLevel + 0.1, 2);
            applyPaZoom();
        };
        window.paZoomOut = function() {
            paZoomLevel = Math.max(paZoomLevel - 0.1, 0.5);
            applyPaZoom();
        };
        window.paMirrorScrollToStart = function() {
            var body = document.getElementById('paMirrorBody');
            if (!body) return;
            var first = body.querySelector('div');
            if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        window.paMirrorScrollToEnd = function() {
            var body = document.getElementById('paMirrorBody');
            if (!body) return;
            var all = body.querySelectorAll('div');
            if (all.length) all[all.length - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        window.paMirrorScrollToPrevSameLevel = function() {
            var srcItems = (paMirrorMode === 2) ? paOtherItems : items;
            var srcIdx = (paMirrorMode === 2) ? paOtherSelectedIdx : paMirrorSelectedIdx;
            if (srcIdx < 0) srcIdx = 0;
            if (srcIdx < 0 || srcIdx >= srcItems.length) return;
            srcItems[srcIdx].collapsed = true;
            var curLevel = srcItems[srcIdx].level;
            var headingLevels = ['level-title','level-date','level-author','level-recipient','level-1','level-2','level-3'];
            var isHeading = headingLevels.indexOf(curLevel) !== -1;
            for (var pi = srcIdx - 1; pi >= 0; pi--) {
                if (srcItems[pi].kind === 'divider') continue;
                if (isHeading && srcItems[pi].level === curLevel) {
                    delete srcItems[pi].collapsed;
                    if (paMirrorMode !== 2) save();
                    paMirrorSetSelected(pi); paMirrorScrollToItem(pi); return;
                }
            }
            for (var pi2 = srcIdx - 1; pi2 >= 0; pi2--) {
                if (srcItems[pi2].kind === 'divider') continue;
                var lv = srcItems[pi2].level;
                if (headingLevels.indexOf(lv) !== -1 && headingLevels.indexOf(lv) <= headingLevels.indexOf(curLevel)) {
                    delete srcItems[pi2].collapsed;
                    if (paMirrorMode !== 2) save();
                    paMirrorSetSelected(pi2); paMirrorScrollToItem(pi2); return;
                }
            }
        };
        window.paMirrorScrollToNextSameLevel = function() {
            var srcItems = (paMirrorMode === 2) ? paOtherItems : items;
            var srcIdx = (paMirrorMode === 2) ? paOtherSelectedIdx : paMirrorSelectedIdx;
            if (srcIdx < 0) srcIdx = 0;
            if (srcIdx < 0 || srcIdx >= srcItems.length) return;
            srcItems[srcIdx].collapsed = true;
            var curLevel = srcItems[srcIdx].level;
            var headingLevels = ['level-title','level-date','level-author','level-recipient','level-1','level-2','level-3'];
            var isHeading = headingLevels.indexOf(curLevel) !== -1;
            for (var ni = srcIdx + 1; ni < srcItems.length; ni++) {
                if (srcItems[ni].kind === 'divider') continue;
                if (isHeading && srcItems[ni].level === curLevel) {
                    delete srcItems[ni].collapsed;
                    if (paMirrorMode !== 2) save();
                    paMirrorSetSelected(ni); paMirrorScrollToItem(ni); return;
                }
                var lv = srcItems[ni].level;
                if (headingLevels.indexOf(lv) !== -1 && headingLevels.indexOf(lv) <= headingLevels.indexOf(curLevel)) {
                    delete srcItems[ni].collapsed;
                    if (paMirrorMode !== 2) save();
                    paMirrorSetSelected(ni); paMirrorScrollToItem(ni); return;
                }
            }
        };
        function paMirrorScrollToItem(idx) {
            var bodyId = (paMirrorMode === 2) ? 'paMirrorOtherBody' : 'paMirrorBody';
            var body = document.getElementById(bodyId);
            if (!body) return;
            var sel = (paMirrorMode === 2) ? '.paOtherItem' : '.paItem';
            var items = body.querySelectorAll(sel);
            for (var si = 0; si < items.length; si++) {
                if (parseInt(items[si].dataset.idx, 10) === idx) {
                    items[si].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
            }
        }
        window.paMirrorZoomIn = function() {
            paMirrorZoomLevel = Math.min(paMirrorZoomLevel + 0.1, 2);
            applyPaMirrorZoom();
        };
        window.paMirrorZoomOut = function() {
            paMirrorZoomLevel = Math.max(paMirrorZoomLevel - 0.1, 0.5);
            applyPaMirrorZoom();
        };
        function applyPaZoom() {
            var body = document.getElementById('paBody');
            if (body) body.style.zoom = paZoomLevel;
            var preview = document.getElementById('paPreviewEditor');
            if (preview) preview.style.zoom = paZoomLevel;
        }
        window.paOption = function() {
            showToast('option');
        };
        window.paClear = function() {
            if (paMirrorMode === 2) {
                if (!confirm('将清空当前编辑器内容，是否继续？')) return;
                var now = new Date();
                var dateStr = '（' + now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日）';
                paOtherItems = [
                    { level: 'level-title', text: '请输入标题' },
                    { level: 'level-date', text: dateStr },
                    { level: 'level-author', text: '作者' },
                    { kind: 'divider' },
                    { level: 'level-1', text: '一、……' },
                    { level: 'level-2', text: '一是……' },
                    { level: 'level-body', text: '……' }
                ];
                paOtherCollapsedIdx = {};
                paOtherMirrorCollapsedIdx = {};
                paOtherMirrorFilterActive = false;
                paOtherMirrorSelectedIdx = -1;
                paOtherSelectedIdx = -1;
                paOtherFileName = '';
                renderOtherMirror();
                return;
            }
            if (!confirm('将清空全部内容，是否继续？')) return;
            var now = new Date();
            var dateStr = '（' + now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日）';
            items = [
                { level: 'level-title', text: '请输入标题' },
                { level: 'level-date', text: dateStr },
                { level: 'level-author', text: '作者' },
                { kind: 'divider' },
                { level: 'level-1', text: '一、……' },
                { level: 'level-2', text: '一是……' },
                { level: 'level-body', text: '……' }
            ];
            collapsedIdx = {};
            selectedIdx = -1;
            paMirrorCollapsedIdx = {};
            paMirrorSelectedIdx = -1;
            save();
            render();
            var overlay = document.getElementById('paPreviewOverlay');
            if (overlay && overlay.classList.contains('show')) {
                overlay.classList.remove('show');
                var btn = document.getElementById('paPreviewBtn');
                if (btn) btn.classList.remove('active');
                previewOn = false;
            }
        };
        window.paMirrorCopy = function() {
            if (paMirrorMode === 2) {
                var itemsText = paOtherItems.map(function(it){ return it.text || ''; }).join('\n');
                if (!itemsText.trim()) { showToast('内容为空'); return; }
                navigator.clipboard.writeText(itemsText).then(function(){ showToast('已复制'); });
                return;
            }
            var editor = document.getElementById('paMirrorPreviewEditor');
            var overlay = document.getElementById('paMirrorPreviewOverlay');
            if (overlay && overlay.classList.contains('show') && editor) {
                var tmp = document.createElement('div');
                tmp.innerHTML = editor.innerHTML;
                var plain = tmp.innerText || '';
                if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
                    var ci = new ClipboardItem({ 'text/html': new Blob([editor.innerHTML], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) });
                    navigator.clipboard.write([ci]).then(function() { showToast('已复制到剪贴板'); }, function() { navigator.clipboard.writeText(plain); });
                    return;
                }
            }
            paCopy();
        };
        window.paMirrorExport = function() {
            if (paMirrorMode === 2) {
                var text = paOtherItems.map(function(it){ return it.text || ''; }).join('\n');
                if (!text.trim()) { showToast('内容为空'); return; }
                var blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = (paOtherFileName || 'other') + '.txt';
                a.click();
                return;
            }
            var overlay = document.getElementById('paMirrorPreviewOverlay');
            var mainOverlay = document.getElementById('paPreviewOverlay');
            var mainEditor = document.getElementById('paPreviewEditor');
            var mirrorEditor = document.getElementById('paMirrorPreviewEditor');
            if (overlay && overlay.classList.contains('show') && mirrorEditor && mainOverlay && mainEditor) {
                var oldHtml = mainEditor.innerHTML;
                var oldShow = mainOverlay.classList.contains('show');
                mainEditor.innerHTML = mirrorEditor.innerHTML;
                mainOverlay.classList.add('show');
                paExport().finally(function() {
                    mainEditor.innerHTML = oldHtml;
                    if (!oldShow) mainOverlay.classList.remove('show');
                });
                return;
            }
            paExport();
        };

        window.paSave = function() {
            if (paOpenDirHandle) {
                var now = new Date();
                var ts = now.getFullYear() + ('0'+(now.getMonth()+1)).slice(-2) + ('0'+now.getDate()).slice(-2) + '-' + ('0'+now.getHours()).slice(-2) + ('0'+now.getMinutes()).slice(-2);
                var title = '';
                for (var si = 0; si < items.length; si++) {
                    if (items[si] && items[si].level === 'level-title') {
                        title = (items[si].text || '').replace(/[\/\\?*:<>|"]/g, '_').replace(/\s+/g, '');
                        break;
                    }
                }
                var fileName = ts + (title ? ' ' + title : '') + (paItemsHaveImages() ? '.mht' : '.js');
                (async function() {
                    try {
                        var fileHandle = await paOpenDirHandle.getFileHandle(fileName, {create: true});
                        var writable = await fileHandle.createWritable({keepExistingData: false});
                        var hasImg = paItemsHaveImages();
                        var content;
                        if (paIsMhtFile(fileName)) content = paBuildMhtContent(fileName);
                        else {
                            var data = { version: 1, exportedAt: new Date().toISOString(), items: items };
                            content = 'var problemAnalysisData = ' + JSON.stringify(data, null, 2) + ';';
                        }
                        await writable.write({type: 'write', data: content});
                        await writable.close();
                        paCurrentFileName = fileName;
                        showToast(hasImg ? '内容含图片，已保存为 mht 载体：' + fileName : '已保存：' + fileName);
                    } catch(e) {
                        showToast('保存失败：' + e.message);
                    }
                })();
                return;
            }
            var modal = document.getElementById('paSaveModal');
            if (modal) modal.classList.add('show');
        };
        window.paOpen = function() {
            var modal = document.getElementById('paOpenModal');
            if (modal) modal.classList.add('show');
            // 如果已恢复文件夹，自动显示文件列表
            if (paOpenDirHandle && paOpenCachedFiles.length > 0) {
                paPopulateOpenFileList(paOpenCachedFiles);
            }
        };
        window.closePaOpenModal = function() {
            document.getElementById('paOpenModal').classList.remove('show');
        };
        window.closePaSaveModal = function() {
            document.getElementById('paSaveModal').classList.remove('show');
        };
        window.changePaOpenFolder = function() {
            if (typeof window.showDirectoryPicker === 'function') {
                window.showDirectoryPicker().then(async function(handle) {
                    paOpenDirHandle = handle;
                    // 持久化保存文件夹句柄，下次打开自动恢复
                    try { await idbPut('paOpenDirHandle', handle); } catch(e) {}
                    document.getElementById('paOpenModalPathText').textContent = handle.name;
                    document.getElementById('paOpenModalPath').style.display = 'flex';
                    paOpenCachedFileMap = {};
                    paOpenCachedFiles = [];
                    try {
                        var entries = [];
                        for await (var entry of handle.values()) {
                            entries.push(entry);
                        }
                        for (var i = 0; i < entries.length; i++) {
                            var entry = entries[i];
                            if (entry.kind === 'file' && entry.name.toLowerCase().match(/\.(js|mht|mhtml)$/)) {
                                paOpenCachedFiles.push(entry.name);
                                paOpenCachedFileMap[entry.name] = entry;
                            }
                        }
                        paOpenCachedFiles.sort().reverse();
                        paPopulateOpenFileList(paOpenCachedFiles);
                    } catch (e) {}
                }).catch(function() {});
            } else {
                var input = document.getElementById('paOpenFolderInput');
                if (input) input.click();
            }
        };
        window.changePaSaveFolder = function() {
            if (typeof window.showDirectoryPicker === 'function') {
                window.showDirectoryPicker().then(async function(handle) {
                    paSaveDirHandle = handle;
                    // 持久化保存文件夹句柄
                    try { await idbPut('paSaveDirHandle', handle); } catch(e) {}
                    document.getElementById('paSaveModalPathText').textContent = handle.name;
                    document.getElementById('paSaveModalPath').style.display = 'flex';
                    paSaveCachedFileMap = {};
                    paSaveCachedFiles = [];
                    try {
                        var entries = [];
                        for await (var entry of handle.values()) {
                            entries.push(entry);
                        }
                        for (var i = 0; i < entries.length; i++) {
                            var entry = entries[i];
                            if (entry.kind === 'file' && entry.name.toLowerCase().match(/\.(js|mht|mhtml)$/)) {
                                paSaveCachedFiles.push(entry.name);
                                paSaveCachedFileMap[entry.name] = entry;
                            }
                        }
                        paSaveCachedFiles.sort().reverse();
                        paPopulateSaveFileList(paSaveCachedFiles);
                    } catch (e) {}
                }).catch(function() {});
            } else {
                var input = document.getElementById('paSaveFolderInput');
                if (input) input.click();
            }
        };
        window.refreshPaOpenFileList = async function() {
            if (paOpenDirHandle) {
                var ok = await verifyPermission(paOpenDirHandle, true);
                if (!ok) {
                    // 尝试从 IndexedDB 恢复
                    try {
                        var saved = await idbGet('paOpenDirHandle');
                        if (saved) {
                            ok = await verifyPermission(saved, true);
                            if (ok) {
                                paOpenDirHandle = saved;
                                document.getElementById('paOpenModalPathText').textContent = saved.name;
                                document.getElementById('paOpenModalPath').style.display = 'flex';
                            }
                        }
                    } catch(e) {}
                }
                if (ok) {
                    paOpenCachedFileMap = {};
                    paOpenCachedFiles = [];
                    try {
                        var entries = [];
                        for await (var entry of paOpenDirHandle.values()) {
                            entries.push(entry);
                        }
                        for (var i = 0; i < entries.length; i++) {
                            var entry = entries[i];
                            if (entry.kind === 'file' && entry.name.toLowerCase().match(/\.(js|mht|mhtml)$/)) {
                                paOpenCachedFiles.push(entry.name);
                                paOpenCachedFileMap[entry.name] = entry;
                            }
                        }
                        paOpenCachedFiles.sort().reverse();
                        paPopulateOpenFileList(paOpenCachedFiles);
                    } catch(e) {
                        showToast('读取文件夹失败');
                    }
                    return;
                }
            }
            // 没有文件夹句柄或权限已失效，让用户选择
            changePaOpenFolder();
        };
        window.refreshPaSaveFileList = async function() {
            if (paSaveDirHandle) {
                var ok = await verifyPermission(paSaveDirHandle, true);
                if (ok) {
                    paSaveCachedFileMap = {};
                    paSaveCachedFiles = [];
                    try {
                        var entries = [];
                        for await (var entry of paSaveDirHandle.values()) {
                            entries.push(entry);
                        }
                        for (var i = 0; i < entries.length; i++) {
                            var entry = entries[i];
                            if (entry.kind === 'file' && entry.name.toLowerCase().match(/\.(js|mht|mhtml)$/)) {
                                paSaveCachedFiles.push(entry.name);
                                paSaveCachedFileMap[entry.name] = entry;
                            }
                        }
                        paSaveCachedFiles.sort().reverse();
                        paPopulateSaveFileList(paSaveCachedFiles);
                    } catch(e) {
                        showToast('读取文件夹失败');
                    }
                    return;
                }
            }
            // 没有文件夹句柄或权限已失效，让用户选择
            changePaSaveFolder();
        };
        function paPopulateOpenFileList(files) {
            var body = document.getElementById('paOpenFileBody');
            var empty = document.getElementById('paOpenFileEmpty');
            if (files.length === 0) {
                body.innerHTML = '';
                empty.style.display = 'block';
                return;
            }
            empty.style.display = 'none';
            body.innerHTML = '';
            for (var i = 0; i < files.length; i++) {
                paRenderOpenFileRow(files[i], i);
            }
        }
        function paRenderOpenFileRow(fname, idx) {
            var body = document.getElementById('paOpenFileBody');
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (idx + 1) + '</td><td style="text-align:left;padding-left:15px;">' + fname + '</td><td><input type="radio" name="paOpenRadio" value="' + fname.replace(/"/g,'&quot;') + '"></td>';
            tr.addEventListener('click', function(e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                var radio = tr.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
                var allRows = body.querySelectorAll('tr');
                for (var j = 0; j < allRows.length; j++) allRows[j].classList.remove('selected');
                tr.classList.add('selected');
            });
            body.appendChild(tr);
        }
        window.confirmPaOpen = function() {
            var selected = document.querySelector('#paOpenFileBody input[type="radio"]:checked');
            if (!selected) {
                showToast('请选择一个编辑器文件');
                return;
            }
            var fileName = selected.value;
            var fileObj = paOpenCachedFileMap[fileName];
            if (!fileObj) {
                showToast('文件数据不可用，请刷新列表');
                return;
            }
            function readAndLoadPaFile(file) {
                var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var raw = ev.target.result || '';
                    if (paIsMhtFile(fileName) || /multipart\/related/i.test(raw)) {
                        var mhtPayload = paExtractMhtPayload(raw);
                        if (mhtPayload) raw = mhtPayload;
                    }
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
                        if (!parsed) { alert('解析失败：未找到有效数据'); return; }
                        var arr = null;
                        if (Array.isArray(parsed)) arr = parsed;
                        else if (Array.isArray(parsed.items)) arr = parsed.items;
                        else if (Array.isArray(parsed.data)) arr = parsed.data;
                        if (!arr) { alert('解析失败：数据格式不正确'); return; }
                        items = arr.map(function(x) {
                            if (!x || typeof x !== 'object') return { level: 'level-body', text: '' };
                            if (x.kind === 'divider') return { kind: 'divider' };
                            var n = { level: x.level || 'level-body', text: x.text || '' };
                            if (x.bg) n.bg = x.bg;
                            if (x.marks && typeof x.marks === 'object') n.marks = x.marks;
                            if (x.tag) n.tag = x.tag;
                            if (x.status) n.status = x.status;
                            if (x.collapsed) n.collapsed = true;
                            if (x.noBreakAfter) n.noBreakAfter = true;
                            if (x.noBreakBefore) n.noBreakBefore = true;
                            if (Array.isArray(x.refs) && x.refs.length) {
                                n.refs = x.refs.map(function(rr) {
                                    if (!rr || typeof rr !== 'object') return { level: 'level-body', text: '' };
                                    var nr = { level: rr.level || 'level-body', text: rr.text || '' };
                                    if (rr.bg) nr.bg = rr.bg;
                                    if (rr.marks && typeof rr.marks === 'object') nr.marks = rr.marks;
                                    if (rr.fontFamily) nr.fontFamily = rr.fontFamily;
                                    if (rr.fontSize) nr.fontSize = rr.fontSize;
                                    return nr;
                                });
                            }
                            return n;
                        });
                        var hasTitle = arr.some(function(x){return x && x.level === 'level-title';});
                        var hasDate = arr.some(function(x){return x && x.level === 'level-date';});
                        var hasAuthor = arr.some(function(x){return x && x.level === 'level-author';});
                        if (!hasTitle) items.unshift({ level: 'level-title', text: '请输入标题' });
                        if (!hasDate) {
                            var now = new Date();
                            var ds = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日';
                            var insertPos = hasTitle ? 1 : 0;
                            items.splice(insertPos, 0, { level: 'level-date', text: '（' + ds + '）' });
                        }
                        if (!hasAuthor) items.push({ level: 'level-author', text: '' });
                        if (!hasTitle && !hasDate) { items.splice(0, 0, { kind: 'divider' }); }
                        collapsedIdx = {};
                        selectedIdx = -1;
                        paMirrorCollapsedIdx = {};
                        paMirrorSelectedIdx = -1;
                        paCurrentFileName = fileName;
                        save();
                        render();
                        closePaOpenModal();
                        showToast('已加载：' + fileName);
                    } catch (err) {
                        alert('打开失败：' + err.message);
                    }
                };
                reader.onerror = function() { alert('读取文件失败'); };
                reader.readAsText(file, 'UTF-8');
            }
            if (typeof fileObj.getFile === 'function') {
                fileObj.getFile().then(function(f) { readAndLoadPaFile(f); }).catch(function() { showToast('读取文件失败'); });
            } else {
                readAndLoadPaFile(fileObj);
            }
        }
        function paPopulateSaveFileList(files) {
            var body = document.getElementById('paSaveFileBody');
            var empty = document.getElementById('paSaveFileEmpty');
            if (files.length === 0) {
                body.innerHTML = '';
                empty.style.display = 'block';
                return;
            }
            empty.style.display = 'none';
            body.innerHTML = '';
            for (var i = 0; i < files.length; i++) {
                paRenderSaveFileRow(files[i], i);
            }
        }
        function paRenderSaveFileRow(fname, idx) {
            var body = document.getElementById('paSaveFileBody');
            var tr = document.createElement('tr');
            tr.innerHTML = '<td>' + (idx + 1) + '</td><td style="text-align:left;padding-left:15px;">' + fname + '</td><td><input type="radio" name="paSaveRadio" value="' + fname.replace(/"/g,'&quot;') + '"></td>';
            tr.addEventListener('click', function(e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
                var radio = tr.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
                var allRows = body.querySelectorAll('tr');
                for (var j = 0; j < allRows.length; j++) allRows[j].classList.remove('selected');
                tr.classList.add('selected');
            });
            body.appendChild(tr);
        }
        window.confirmPaSaveOverwrite = function() {
            var selected = document.querySelector('#paSaveFileBody input[type="radio"]:checked');
            if (!selected) {
                showToast('请选择要覆盖的文件');
                return;
            }
            var fileName = selected.value;
            if (!confirm('覆盖文件 "' + fileName + '" ？')) return;
            var fileObj = paSaveCachedFileMap[fileName];
            if (!fileObj) {
                showToast('文件数据不可用，请刷新列表');
                return;
            }
            if (typeof fileObj.createWritable === 'function') {
                var hasImg = paItemsHaveImages();
                var content;
                if (paIsMhtFile(fileName)) content = paBuildMhtContent(fileName);
                else {
                    var data = { version: 1, exportedAt: new Date().toISOString(), items: items };
                    content = 'var problemAnalysisData = ' + JSON.stringify(data, null, 2) + ';';
                }
                fileObj.createWritable().then(function(writable) {
                    writable.write(content);
                    writable.close();
                    paCurrentFileName = fileName;
                    closePaSaveModal();
                    showToast(hasImg ? '内容含图片，已保存为 mht 载体：' + fileName : '已覆盖：' + fileName);
                }).catch(function() { fallbackPaSave(fileName); });
            } else {
                fallbackPaSave(fileName);
            }
        }
        window.confirmPaSaveAsNew = function() {
            var now = new Date();
            var ts = now.getFullYear() + ('0'+(now.getMonth()+1)).slice(-2) + ('0'+now.getDate()).slice(-2) + '-' + ('0'+now.getHours()).slice(-2) + ('0'+now.getMinutes()).slice(-2);
            var defaultTitle = '';
            for (var si = 0; si < items.length; si++) {
                if (items[si] && items[si].level === 'level-title') {
                    defaultTitle = (items[si].text || '').replace(/[\/\\?*:<>|"]/g, '_').replace(/\s+/g, '');
                    break;
                }
            }
            var hasImg = paItemsHaveImages();
            var ext = hasImg ? '.mht' : '.js';
            var fileName = prompt('请输入文件名（' + ext + '）：', ts + (defaultTitle ? ' ' + defaultTitle : '') + ext);
            if (!fileName) return;
            if (!/\.(js|mht|mhtml)$/i.test(fileName)) fileName += ext;
            fallbackPaSave(fileName);
        }
        window.paItemsHaveImages = function() {
            try {
                for (var i = 0; i < items.length; i++) {
                    var t = items[i] && items[i].text;
                    if (typeof t === 'string' && (t.indexOf('<img') !== -1 || t.indexOf('data:image') !== -1)) return true;
                }
            } catch (e) {}
            return false;
        }
        function paMhtBoundary() { return '----=_NextPart_NotepadEditor_' + Date.now() + '_' + Math.floor(Math.random() * 100000); }
        function paBuildMhtPayload() {
            var data = { version: 1, exportedAt: new Date().toISOString(), items: items };
            return JSON.stringify(data);
        }
        window.paBuildMhtContent = function(fileName) {
            var json = paBuildMhtPayload();
            var b64 = btoa(unescape(encodeURIComponent(json)));
            var boundary = paMhtBoundary();
            var crlf = '\r\n';
            var html = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body>'
                + '<div id="problemAnalysisData" data-editor-carrier="1" data-payload="' + b64 + '"></div>'
                + '</body></html>';
            var mht = 'From: <Saved by NotepadEditor>' + crlf
                + 'Subject: ' + (fileName || 'editor data') + crlf
                + 'Date: ' + new Date().toUTCString() + crlf
                + 'MIME-Version: 1.0' + crlf
                + 'Content-Type: multipart/related; boundary="' + boundary + '"; type="text/html"' + crlf
                + crlf
                + '--' + boundary + crlf
                + 'Content-Type: text/html; charset="utf-8"' + crlf
                + 'Content-Transfer-Encoding: 8bit' + crlf
                + crlf
                + html + crlf
                + '--' + boundary + '--' + crlf;
            return mht;
        }
        window.paExtractMhtPayload = function(raw) {
            if (!raw) return null;
            var m = raw.match(/data-payload="([A-Za-z0-9+/=\s]+)"/);
            if (m) {
                try {
                    var b64 = m[1].replace(/\s+/g, '');
                    return decodeURIComponent(escape(atob(b64)));
                } catch (e) {}
            }
            var m2 = raw.match(/data-payload="([^"]+)"/);
            if (m2) {
                try { return decodeURIComponent(escape(atob(m2[1].replace(/\s+/g, '')))); } catch (e2) {}
            }
            return null;
        }
        function paIsMhtFile(fileName) { return /\.(mht|mhtml)$/i.test(fileName || ''); }
        function fallbackPaSave(fileName) {
            try {
                var hasImg = paItemsHaveImages();
                if (hasImg && !paIsMhtFile(fileName)) {
                    fileName = (fileName || 'editor').replace(/\.(js|mht|mhtml)$/i, '') + '.mht';
                }
                var content, mime;
                if (paIsMhtFile(fileName)) {
                    content = paBuildMhtContent(fileName);
                    mime = 'message/rfc822';
                } else {
                    var data = { version: 1, exportedAt: new Date().toISOString(), items: items };
                    content = 'var problemAnalysisData = ' + JSON.stringify(data, null, 2) + ';';
                    mime = 'application/javascript;charset=utf-8';
                }
                var blob = new Blob([content], { type: mime });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
                paCurrentFileName = fileName;
                closePaSaveModal();
                if (hasImg && paIsMhtFile(fileName)) showToast('内容含图片，已保存为 mht 载体：' + fileName);
                else showToast('已保存：' + fileName);
            } catch (e) {
                alert('保存失败：' + e.message);
            }
        }
        function initPaFileInputs() {
            var openInput = document.getElementById('paOpenFolderInput');
            if (openInput) {
                openInput.addEventListener('change', function(e) {
                    var files = e.target.files;
                    if (!files || files.length === 0) return;
                    var folderName = '';
                    if (files[0].webkitRelativePath) {
                        folderName = files[0].webkitRelativePath.split('/')[0];
                        document.getElementById('paOpenModalPathText').textContent = folderName;
                        document.getElementById('paOpenModalPath').style.display = 'flex';
                    }
                    paOpenCachedFileMap = {};
                    paOpenCachedFiles = [];
                    var seen = new Set();
                    for (var i = 0; i < files.length; i++) {
                        var fname = files[i].name;
                        if (fname.toLowerCase().endsWith('.js') && !seen.has(fname)) {
                            seen.add(fname);
                            paOpenCachedFiles.push(fname);
                            paOpenCachedFileMap[fname] = files[i];
                        }
                    }
                    paOpenCachedFiles.sort().reverse();
                    paPopulateOpenFileList(paOpenCachedFiles);
                    e.target.value = '';
                });
            }
            var saveInput = document.getElementById('paSaveFolderInput');
            if (saveInput) {
                saveInput.addEventListener('change', function(e) {
                    var files = e.target.files;
                    if (!files || files.length === 0) return;
                    var folderName = '';
                    if (files[0].webkitRelativePath) {
                        folderName = files[0].webkitRelativePath.split('/')[0];
                        document.getElementById('paSaveModalPathText').textContent = folderName;
                        document.getElementById('paSaveModalPath').style.display = 'flex';
                    }
                    paSaveCachedFileMap = {};
                    paSaveCachedFiles = [];
                    var seen = new Set();
                    for (var i = 0; i < files.length; i++) {
                        var fname = files[i].name;
                        if (fname.toLowerCase().endsWith('.js') && !seen.has(fname)) {
                            seen.add(fname);
                            paSaveCachedFiles.push(fname);
                            paSaveCachedFileMap[fname] = files[i];
                        }
                    }
                    paSaveCachedFiles.sort().reverse();
                    paPopulateSaveFileList(paSaveCachedFiles);
                    e.target.value = '';
                });
            }
        }
        initPaFileInputs();

        // 自动恢复上次选择的编辑器文件夹
        (async function tryRestorePaOpenDirHandle() {
            try {
                var saved = await idbGet('paOpenDirHandle');
                if (!saved) return;
                if (typeof verifyPermission === 'function') {
                    var ok = await verifyPermission(saved, true);
                    if (!ok) return;
                }
                paOpenDirHandle = saved;
                document.getElementById('paOpenModalPathText').textContent = saved.name;
                document.getElementById('paOpenModalPath').style.display = 'flex';
                // 自动扫描文件列表
                paOpenCachedFileMap = {};
                paOpenCachedFiles = [];
                try {
                    var entries = [];
                    for await (var entry of saved.values()) {
                        entries.push(entry);
                    }
                    for (var i = 0; i < entries.length; i++) {
                        var entry = entries[i];
                        if (entry.kind === 'file' && entry.name.toLowerCase().match(/\.(js|mht|mhtml)$/)) {
                            paOpenCachedFiles.push(entry.name);
                            paOpenCachedFileMap[entry.name] = entry;
                        }
                    }
                    paOpenCachedFiles.sort().reverse();
                } catch(e) {}
            } catch(e) {}
        })();

        // 自动恢复上次选择的编辑器保存文件夹
        (async function tryRestorePaSaveDirHandle() {
            try {
                var saved = await idbGet('paSaveDirHandle');
                if (!saved) return;
                if (typeof verifyPermission === 'function') {
                    var ok = await verifyPermission(saved, true);
                    if (!ok) return;
                }
                paSaveDirHandle = saved;
                document.getElementById('paSaveModalPathText').textContent = saved.name;
                document.getElementById('paSaveModalPath').style.display = 'flex';
            } catch(e) {}
        })();

        window.paToggleA4Mode = function() {
            if (paA4Mode) {
                paA4Mode = false;
                render();
            } else {
                paA4Mode = true;
                var overlay = document.getElementById('paPreviewOverlay');
                var editor = document.getElementById('paPreviewEditor');
                var body = document.getElementById('paBody');
                if (overlay && overlay.classList.contains('show') && editor) {
                    editor.innerHTML = _buildA4Html(items);
                    editor.contentEditable = 'false';
                } else if (body && body.classList.contains('paTextMode')) {
                    body.innerHTML = _buildA4Html(items);
                } else if (body) {
                    if (overlay) overlay.classList.remove('show');
                    body.className = 'paTextMode';
                    body.innerHTML = _buildA4Html(items);
                }
            }
        };
        window.paApplyLevelFilter = function(val) {
            if (val === 'all' && paA4Mode) { paA4Mode = false; }
            var btn = document.getElementById('paLevelFilterBtn');
            if (btn) {
                var labels = { 'all': '显示', '1': '一级标题', '2': '二级标题', '3': '三级标题' };
                btn.textContent = labels[val] || '显示';
                btn.setAttribute('data-value', val);
            }
            collapsedIdx = {};
            paFilterActive = (val !== 'all');
            if (val === '1') {
                for (var i = 0; i < items.length; i++) {
                    if (items[i] && items[i].level === 'level-1') collapsedIdx[i] = true;
                }
            } else if (val === '2') {
                for (var i2 = 0; i2 < items.length; i2++) {
                    if (items[i2] && items[i2].level === 'level-2') collapsedIdx[i2] = true;
                }
            } else if (val === '3') {
                for (var i3 = 0; i3 < items.length; i3++) {
                    if (items[i3] && items[i3].level === 'level-3') collapsedIdx[i3] = true;
                }
            }
            selectedIdx = -1;
            render();
        };
        window.paMirrorApplyLevelFilter = function(val) {
            var btn = document.getElementById('paMirrorLevelFilterBtn');
            if (btn) {
                var labels = { 'all': '显示', '1': '一级标题', '2': '二级标题', '3': '三级标题' };
                btn.textContent = labels[val] || '显示';
                btn.setAttribute('data-value', val);
            }
            if (paMirrorMode === 2) {
                paOtherMirrorCollapsedIdx = {};
                paOtherMirrorFilterActive = (val !== 'all');
                var sourceItems = paOtherItems;
                if (val === '1') {
                    for (var i = 0; i < sourceItems.length; i++) {
                        if (sourceItems[i] && sourceItems[i].level === 'level-1') paOtherMirrorCollapsedIdx[i] = true;
                    }
                } else if (val === '2') {
                    for (var i2 = 0; i2 < sourceItems.length; i2++) {
                        if (sourceItems[i2] && sourceItems[i2].level === 'level-2') paOtherMirrorCollapsedIdx[i2] = true;
                    }
                } else if (val === '3') {
                    for (var i3 = 0; i3 < sourceItems.length; i3++) {
                        if (sourceItems[i3] && sourceItems[i3].level === 'level-3') paOtherMirrorCollapsedIdx[i3] = true;
                    }
                }
                paOtherMirrorSelectedIdx = -1;
                renderOtherMirror();
                return;
            }
            paMirrorCollapsedIdx = {};
            paMirrorFilterActive = (val !== 'all');
            if (val === '1') {
                for (var i = 0; i < items.length; i++) {
                    if (items[i] && items[i].level === 'level-1') paMirrorCollapsedIdx[i] = true;
                }
            } else if (val === '2') {
                for (var i2 = 0; i2 < items.length; i2++) {
                    if (items[i2] && items[i2].level === 'level-2') paMirrorCollapsedIdx[i2] = true;
                }
            } else if (val === '3') {
                for (var i3 = 0; i3 < items.length; i3++) {
                    if (items[i3] && items[i3].level === 'level-3') paMirrorCollapsedIdx[i3] = true;
                }
            }
            paMirrorSelectedIdx = -1;
            if (paMirrorMode === 0) renderMirror();
            if (paMirrorMode === 1) paRenderOutline();
        };
        window.paAutoFormat = function() {
            alert('自动格式化功能占位');
        };
        // ==========  序号  ==========
        var CN_NUM = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];
        var CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
        function detectSeqStyle(text) {
            if (!text) return null;
            var s = text.replace(/^\s+/, '');
            // 1. 一、 二、
            for (var i = 0; i < CN_NUM.length; i++) {
                if (s.indexOf(CN_NUM[i] + '、') === 0) return { kind: 'cn-dun', idx: i };
            }
            // 2. （一） （二） 或 (一)
            var fullBracket = s.match(/^（([一二三四五六七八九十]+)）/);
            if (fullBracket) {
                var idx1 = CN_NUM.indexOf(fullBracket[1]);
                if (idx1 >= 0) return { kind: 'cn-fullbracket', idx: idx1 };
            }
            var halfBracket = s.match(/^\(([一二三四五六七八九十]+)\)/);
            if (halfBracket) {
                var idx2 = CN_NUM.indexOf(halfBracket[1]);
                if (idx2 >= 0) return { kind: 'cn-halfbracket', idx: idx2 };
            }
            // 3. 1. 2. 3.
            var digDot = s.match(/^(\d+)\./);
            if (digDot) return { kind: 'dig-dot', idx: parseInt(digDot[1], 10) - 1 };
            // 4. 1、 2、 3、
            var digDun = s.match(/^(\d+)、/);
            if (digDun) return { kind: 'dig-dun', idx: parseInt(digDun[1], 10) - 1 };
            // 5. ①②③
            if (s.length > 0) {
                var circIdx = CIRCLED.indexOf(s.charAt(0));
                if (circIdx >= 0) return { kind: 'circled', idx: circIdx };
            }
            // 6. 一是 二是 ...
            for (var j = 0; j < CN_NUM.length; j++) {
                if (s.indexOf(CN_NUM[j] + '是') === 0) return { kind: 'cn-shi', idx: j };
                if (s.indexOf(CN_NUM[j] + '要') === 0) return { kind: 'cn-yao', idx: j };
            }
            // 7. 第一×，第二×... (第一后可跟一个非标点字符，再跟 逗号/句号/空格 等)
            var diRest = s.match(/^第([一二三四五六七八九十]+)/);
            if (diRest) {
                var numStr = diRest[1];
                var idxD = CN_NUM.indexOf(numStr);
                if (idxD < 0) return null;
                var after = s.substring(1 + numStr.length);
                // 第一， / 第一。
                if (/^[，,。.]/.test(after)) return { kind: 'di-plain', idx: idxD };
                // 第一X，/ 第一X。/ 第一X空格 （X=一个字符）
                var m = after.match(/^(.)[，,。.\s]/);
                if (m) return { kind: 'di-char', idx: idxD, suffixChar: m[1] };
                return null;
            }
            return null;
        }
        function rewriteSeq(text, style, newIdx) {
            var s = text.replace(/^\s+/, '');
            var leading = text.substring(0, text.length - s.length);
            var prefix, body;
            switch (style.kind) {
                case 'cn-dun': {
                    body = s.replace(/^[一二三四五六七八九十]+、/, '');
                    prefix = CN_NUM[newIdx] + '、';
                    break;
                }
                case 'cn-fullbracket': {
                    body = s.replace(/^（[一二三四五六七八九十]+）/, '');
                    prefix = '（' + CN_NUM[newIdx] + '）';
                    break;
                }
                case 'cn-halfbracket': {
                    body = s.replace(/^\([一二三四五六七八九十]+\)/, '');
                    prefix = '(' + CN_NUM[newIdx] + ')';
                    break;
                }
                case 'dig-dot': {
                    body = s.replace(/^\d+\./, '');
                    prefix = (newIdx + 1) + '.';
                    break;
                }
                case 'dig-dun': {
                    body = s.replace(/^\d+、/, '');
                    prefix = (newIdx + 1) + '、';
                    break;
                }
                case 'circled': {
                    body = s.substring(1);
                    prefix = CIRCLED[newIdx] || s.charAt(0);
                    break;
                }
                case 'cn-shi': {
                    body = s.replace(/^[一二三四五六七八九十]+是/, '');
                    prefix = CN_NUM[newIdx] + '是';
                    break;
                }
                case 'cn-yao': {
                    body = s.replace(/^[一二三四五六七八九十]+要/, '');
                    prefix = CN_NUM[newIdx] + '要';
                    break;
                }
                case 'di-plain': {
                    body = s.replace(/^第[一二三四五六七八九十]+/, '');
                    prefix = '第' + CN_NUM[newIdx];
                    break;
                }
                case 'di-char': {
                    body = s.replace(/^第[一二三四五六七八九十]+./, '');
                    prefix = '第' + CN_NUM[newIdx] + (style.suffixChar || '');
                    break;
                }
                default:
                    return text;
            }
            return leading + prefix + body;
        }
        function renumberHeadingsAtLevel(level) {
            // collect indices + styles
            var slots = [];
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (!it || it.kind === 'divider' || it.level !== level) continue;
                var st = detectSeqStyle(it.text || '');
                slots.push({ idx: i, style: st });
            }
            // find the dominant style (first non-null)
            var domStyle = null;
            for (var k = 0; k < slots.length; k++) {
                if (slots[k].style) { domStyle = slots[k].style; break; }
            }
            if (!domStyle) return;
            var counter = 0;
            for (var j = 0; j < slots.length; j++) {
                var s = slots[j].style;
                if (!s || s.kind !== domStyle.kind) continue;
                var newText = rewriteSeq(items[slots[j].idx].text || '', s, counter);
                items[slots[j].idx].text = newText;
                counter++;
            }
        }
        function renumberHeadingsScoped() {
            // Level-1: one group across all items
            renumberLevel1();
            // Level-2: scoped per level-1
            renumberLevel2Scoped();
            // Level-3: scoped per level-2
            renumberLevel3Scoped();
        }
        function renumberLevel1() {
            renumberLevel1From(items);
        }
        function renumberLevel1From(arr) {
            var domStyle = null;
            var idxs = [];
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].level === 'level-1') {
                    idxs.push(i);
                    if (!domStyle) {
                        var st = detectSeqStyle(arr[i].text || '');
                        if (st) domStyle = st;
                    }
                }
            }
            if (!domStyle) return;
            var counter = 0;
            for (var j = 0; j < idxs.length; j++) {
                var s = detectSeqStyle(arr[idxs[j]].text || '');
                if (!s || s.kind !== domStyle.kind) continue;
                arr[idxs[j]].text = rewriteSeq(arr[idxs[j]].text || '', s, counter);
                counter++;
            }
        }
        function renumberLevel2Scoped() {
            renumberLevel2ScopedFrom(items);
        }
        function renumberLevel2ScopedFrom(arr) {
            var groupStart = 0;
            for (var i = 0; i <= arr.length; i++) {
                if (i === arr.length || (arr[i] && arr[i].level === 'level-1')) {
                    renumberLevelInRangeFrom('level-2', groupStart, i, arr);
                    groupStart = i + 1;
                }
            }
        }
        function renumberLevel3Scoped() {
            renumberLevel3ScopedFrom(items);
        }
        function renumberLevel3ScopedFrom(arr) {
            var groupStart = 0;
            for (var i = 0; i <= arr.length; i++) {
                var isBoundary = (i === arr.length) || (arr[i] && (arr[i].level === 'level-1' || arr[i].level === 'level-2'));
                if (isBoundary) {
                    renumberLevelInRangeFrom('level-3', groupStart, i, arr);
                    groupStart = i + 1;
                }
            }
        }
        function renumberLevelInRange(level, start, end) {
            renumberLevelInRangeFrom(level, start, end, items);
        }
        function renumberLevelInRangeFrom(level, start, end, arr) {
            var domStyle = null;
            var idxs = [];
            for (var i = start; i < end; i++) {
                if (arr[i] && arr[i].level === level) {
                    idxs.push(i);
                    if (!domStyle) {
                        var st = detectSeqStyle(arr[i].text || '');
                        if (st) domStyle = st;
                    }
                }
            }
            if (!domStyle) return;
            var counter = 0;
            for (var j = 0; j < idxs.length; j++) {
                var s = detectSeqStyle(arr[idxs[j]].text || '');
                if (!s || s.kind !== domStyle.kind) continue;
                arr[idxs[j]].text = rewriteSeq(arr[idxs[j]].text || '', s, counter);
                counter++;
            }
        }
        function renumberHeadingsScopedFrom(arr) {
            renumberLevel1From(arr);
            renumberLevel2ScopedFrom(arr);
            renumberLevel3ScopedFrom(arr);
        }
        window.paRenumber = function() {
            if (paMirrorMode === 2) {
                renumberHeadingsScopedFrom(paOtherItems);
                renderOtherMirror();
                return;
            }
            renumberHeadingsScoped();
            save();
            render();
        };

        function buildPreviewHtml() {
            return _buildPreviewHtmlFrom(items);
        }
        function buildOtherPreviewHtml() {
            return _buildPreviewHtmlFrom(paOtherItems);
        }
        function buildExtensionHtml() {
            return _buildPreviewHtmlFrom(items, true);
        }
        function _buildPreviewHtmlFrom(sourceItems, includeRefs) {
            function _fontStyle(level) {
                return FORMAT_STANDARD.inlineStyle(level);
            }
            function _paraStyle(level) {
                return FORMAT_STANDARD.paraStyle(level);
            }
            function _buildExtraStyle(it) {
                var s = '';
                if (it.bg) {
                    var bgMap = { red: '#ffcdd2', yellow: '#fff3cd', blue: '#d4e6f1', green: '#d5f5e3', orange: '#fdebd0', gray: '#e0e0e0', purple: '#e8daef' };
                    if (bgMap[it.bg]) s += 'background:' + bgMap[it.bg] + ';';
                }
                if (it.marks) {
                    if (it.marks.bold) s += 'font-weight:bold;';
                    if (it.marks.italic) s += 'font-style:italic;';
                    var deco = [];
                    if (it.marks.underline) deco.push('underline');
                    if (it.marks.strike) deco.push('line-through');
                    if (deco.length) s += 'text-decoration:' + deco.join(' ') + ';';
                    if (it.marks.color) {
                        var cmap = { red: '#c0392b', blue: '#2980b9', black: '#000', gray: '#888' };
                        if (cmap[it.marks.color]) s += 'color:' + cmap[it.marks.color] + ';';
                    }
                }
                return s;
            }
            function _makeSpanAttrs(level, it) {
                var attrs = 'data-level="' + level + '"';
                var fs;
                if (it && it.fontFamily) {
                    var lv = FORMAT_STANDARD.levels[level] || FORMAT_STANDARD.levels['level-body'];
                    fs = 'font-family:' + it.fontFamily + ';font-size:' + lv.fontSize + ';';
                    if (it.marks && it.marks.bold) fs += 'font-weight:bold;';
                    else if (lv.fontWeight) fs += 'font-weight:' + lv.fontWeight + ';';
                } else {
                    fs = _fontStyle(level);
                }
                var extra = _buildExtraStyle(it);
                attrs += ' style="' + fs + extra + '"';
                if (it.bg) attrs += ' data-bg="' + it.bg + '"';
                if (it.marks) attrs += ' data-marks=\'' + JSON.stringify(it.marks) + '\'';
                if (it.collapsed) attrs += ' data-collapsed="1"';
                if (it.tag) attrs += ' data-tag="' + it.tag.replace(/"/g,'&quot;') + '"';
                if (Array.isArray(it.refs) && it.refs.length) attrs += ' data-refs="' + encodeURIComponent(JSON.stringify(it.refs)) + '"';
                return attrs;
            }
            function _formatWithParens(text) {
                if (/<[a-zA-Z]/.test(text)) return text;
                var result = '';
                var last = 0;
                var re = /（([^）]{2,})）/g;
                var m;
                while ((m = re.exec(text)) !== null) {
                    result += paEscapeHtml(text.substring(last, m.index));
                    result += '<span style="font-size:14px;font-family:\'楷体_GB2312\',\'KaiTi_GB2312\',\'KaiTi\',\'楷体\',serif;">（' + paEscapeHtml(m[1]) + '）</span>';
                    last = m.index + m[0].length;
                }
                result += paEscapeHtml(text.substring(last));
                return result;
            }
            var html = '';
            var i = 0;
            while (i < sourceItems.length) {
                var it = sourceItems[i];
                if (it.kind === 'divider') {
                    html += '<p style="margin:0;line-height:1.8;font-family:\'仿宋_GB2312\',\'仿宋\',serif;font-size:16px;">&nbsp;</p>';
                    i++;
                    continue;
                }
                var level = it.level || 'level-body';
                html += '<p style="' + _paraStyle(level) + '">';
                html += '<span ' + _makeSpanAttrs(level, it) + '>' + _formatWithParens(it.text || '') + '</span>';
                while (i + 1 < sourceItems.length) {
                    var next = sourceItems[i + 1];
                    if (next.kind === 'divider') break;
                    var merged = false;
                    if (sourceItems[i].noBreakAfter || next.noBreakBefore) merged = true;
                    if (!merged) break;
                    html += '<span data-mp="1" style="display:none"></span>';
                    var nextLevel = next.level || 'level-body';
                    html += '<span ' + _makeSpanAttrs(nextLevel, next) + '>' + _formatWithParens(next.text || '') + '</span>';
                    i++;
                }
                html += '</p>';
                // 扩展屏模式：把该段落挂靠的参考段落一并输出（带参考样式与标记）
                if (includeRefs && Array.isArray(it.refs) && it.refs.length) {
                    for (var ri = 0; ri < it.refs.length; ri++) {
                        var ref = it.refs[ri] || {};
                        var refLevel = ref.level || 'level-body';
                        html += '<p data-pa-ref="1" style="' + _paraStyle(refLevel) + 'background:#fffdf0;border-left:3px solid #f1c40f;">';
                        html += '<span ' + _makeSpanAttrs(refLevel, ref) + '>' + _formatWithParens(ref.text || '') + '</span>';
                        html += '</p>';
                    }
                }
                i++;
            }
            if (!html) html = '<p>（编辑器内容为空）</p>';
            return html;
        }
        function paEscapeHtml(s) {
            var d = document.createElement('div');
            d.textContent = s == null ? '' : String(s);
            return d.innerHTML;
        }
        function _paHtmlToPlainTextKeepBreaks(html) {
            var td = document.createElement('div');
            td.innerHTML = html;
            var brs = td.querySelectorAll('br');
            for (var bi = 0; bi < brs.length; bi++) {
                brs[bi].parentNode.replaceChild(document.createTextNode('\n'), brs[bi]);
            }
            var blocks = td.querySelectorAll('div,p,li,tr');
            for (var bi = 0; bi < blocks.length; bi++) {
                blocks[bi].appendChild(document.createTextNode('\n'));
            }
            return (td.textContent || '').replace(/\n{2,}/g, '\n').replace(/^\n+/, '').replace(/\n+$/, '');
        }
        function paFormatParens(text) {
            if (/<[a-zA-Z]/.test(text)) return text;
            var result = '';
            var last = 0;
            var re = /（([^）]{2,})）/g;
            var m;
            while ((m = re.exec(text)) !== null) {
                result += paEscapeHtml(text.substring(last, m.index));
                result += '<span style="font-size:14px;font-family:\'楷体_GB2312\',\'KaiTi_GB2312\',\'KaiTi\',\'楷体\',serif;">（' + paEscapeHtml(m[1]) + '）</span>';
                last = m.index + m[0].length;
            }
            result += paEscapeHtml(text.substring(last));
            return result;
        }
        var _savedMergeState = null;
        var _savedOtherMergeState = null;
        var paViewMode = 1;
        function _saveMergeState() { try { _savedMergeState = JSON.parse(JSON.stringify(items.map(function(x) { return { noBreakAfter: !!x.noBreakAfter, noBreakBefore: !!x.noBreakBefore }; }))); } catch(e) { _savedMergeState = null; } }
        function _restoreMergeState() {
            if (!_savedMergeState || !_savedMergeState.length) return;
            var len = Math.min(_savedMergeState.length, items.length);
            for (var mi = 0; mi < len; mi++) {
                if (items[mi].kind === 'divider') continue;
                if (_savedMergeState[mi].noBreakAfter) items[mi].noBreakAfter = true;
                if (_savedMergeState[mi].noBreakBefore) items[mi].noBreakBefore = true;
            }
        }
        function _saveOtherMergeState() { try { _savedOtherMergeState = JSON.parse(JSON.stringify(paOtherItems.map(function(x) { return { noBreakAfter: !!x.noBreakAfter, noBreakBefore: !!x.noBreakBefore }; }))); } catch(e) { _savedOtherMergeState = null; } }
        function _restoreOtherMergeState() {
            if (!_savedOtherMergeState || !_savedOtherMergeState.length) return;
            var len = Math.min(_savedOtherMergeState.length, paOtherItems.length);
            for (var mi = 0; mi < len; mi++) {
                if (paOtherItems[mi].kind === 'divider') continue;
                if (_savedOtherMergeState[mi].noBreakAfter) paOtherItems[mi].noBreakAfter = true;
                if (_savedOtherMergeState[mi].noBreakBefore) paOtherItems[mi].noBreakBefore = true;
            }
        }
        window.paNextViewMode = function() {
            var btn = document.getElementById('paPreviewBtn');
            var body = document.getElementById('paBody');
            var mirror = document.getElementById('problemAnalysisMirror');
            var overlay = document.getElementById('paPreviewOverlay');
            var editor = document.getElementById('paPreviewEditor');
            if (!btn || !body) return;
            if (paViewMode === 0 && overlay && overlay.classList.contains('show')) {
                syncPreviewBackToItems(editor, false);
                _restoreMergeState();
                overlay.classList.remove('show');
                body.style.display = '';
            }
            paViewMode = (paViewMode + 1) % 2;
            if (paViewMode === 0) {
                if (_paSavedGuideHideState === null) _paSavedGuideHideState = _paHideMarkedAllHidden;
                _paHideMarkedAllHidden = false;
                btn.textContent = '导图';
                btn.style.background = '#dbeafe';
                btn.style.borderColor = '#b1d4f7';
                if (mirror && paMirrorVisible) mirror.style.display = '';
                body.style.display = 'none';
                _saveMergeState();
                editor.innerHTML = buildPreviewHtml();
                overlay.classList.add('show');
                renderMirror();
            } else {
                if (_paSavedGuideHideState !== null) { _paHideMarkedAllHidden = _paSavedGuideHideState; _paSavedGuideHideState = null; }
                btn.textContent = '文字';
                btn.style.background = '#ffe0e0';
                btn.style.borderColor = '#f5b7b7';
                if (mirror && paMirrorVisible) mirror.style.display = '';
                render();
                renderMirror();
            }
        };
        window.paMirrorNextViewMode = function() {
            if (paMirrorMode === 2) {
                var overlay = document.getElementById('paMirrorPreviewOverlay');
                var editor = document.getElementById('paMirrorPreviewEditor');
                var btn = document.getElementById('paMirrorPreviewBtn');
                var body = document.getElementById('paMirrorBody');
                if (!overlay || !editor || !btn || !body) return;
                if (paOtherMirrorViewMode === 1 && overlay.classList.contains('show')) {
                    syncPreviewBackToItems(editor, true);
                    _restoreOtherMergeState();
                    overlay.classList.remove('show');
                    renderOtherMirror();
                }
                paOtherMirrorViewMode = (paOtherMirrorViewMode + 1) % 2;
                if (paOtherMirrorViewMode === 0) {
                    btn.textContent = '文字';
                    btn.style.background = '#dbeafe';
                    btn.style.borderColor = '#b1d4f7';
                    body.style.display = '';
                    overlay.classList.remove('show');
                    renderOtherMirror();
                } else {
                    btn.textContent = '导图';
                    btn.style.background = '#ffe0e0';
                    btn.style.borderColor = '#f5b7b7';
                    body.style.display = 'none';
                    _saveOtherMergeState();
                    editor.innerHTML = buildOtherPreviewHtml();
                    overlay.classList.add('show');
                }
                return;
            }
            var overlay = document.getElementById('paMirrorPreviewOverlay');
            var editor = document.getElementById('paMirrorPreviewEditor');
            var btn = document.getElementById('paMirrorPreviewBtn');
            var body = document.getElementById('paMirrorBody');
            if (!overlay || !editor || !btn || !body) return;
            if (paMirrorViewMode === 1 && overlay.classList.contains('show')) {
                syncPreviewBackToItems(editor, false);
                _restoreMergeState();
                overlay.classList.remove('show');
                render();
            }
            paMirrorViewMode = (paMirrorViewMode + 1) % 2;
            if (paMirrorViewMode === 0) {
                btn.textContent = '文档';
                btn.style.background = '#dbeafe';
                btn.style.borderColor = '#b1d4f7';
                body.style.display = '';
                overlay.classList.remove('show');
                renderMirror();
            } else {
                btn.textContent = '导图';
                btn.style.background = '#ffe0e0';
                btn.style.borderColor = '#f5b7b7';
                body.style.display = 'none';
                _saveMergeState();
                editor.innerHTML = buildPreviewHtml();
                overlay.classList.add('show');
                setTimeout(function() { applyPaMirrorZoom(); }, 10);
            }
        };
        function syncPreviewBackToItems(editor, isOther) {
            var ps = editor.querySelectorAll('p');
            var newItems = [];
            var afterStartPart = false;
            var seenDivider = false;
            function _detectMarksFromNode(el) {
                if (!el) return null;
                var inner = el.innerHTML || '';
                var m = null;
                if (inner.indexOf('<b>') !== -1 || inner.indexOf('<strong>') !== -1 || inner.indexOf('font-weight:bold') !== -1 || inner.indexOf('font-weight: bold') !== -1) { m = m || {}; m.bold = true; }
                if (inner.indexOf('<i>') !== -1 || inner.indexOf('<em>') !== -1 || inner.indexOf('font-style:italic') !== -1 || inner.indexOf('font-style: italic') !== -1) { m = m || {}; m.italic = true; }
                if (inner.indexOf('<u>') !== -1 || inner.indexOf('text-decoration:underline') !== -1 || inner.indexOf('text-decoration: underline') !== -1) { m = m || {}; m.underline = true; }
                if (inner.indexOf('<s>') !== -1 || inner.indexOf('<strike>') !== -1 || inner.indexOf('line-through') !== -1) { m = m || {}; m.strike = true; }
                var cm = inner.match(/color:\s*(#[^;'\"\s]+|[^;'\"\s]+)/i);
                if (cm) {
                    var cv = cm[1].toLowerCase();
                    var cmap = { '#c0392b':'red', '#2980b9':'blue', '#000':'black', '#000000':'black', '#888':'gray', '#888888':'gray' };
                    m = m || {}; m.color = cmap[cv] || cv;
                }
                return m ? m : null;
            }
            function _readSpanProps(spans) {
                var level = 'level-body';
                var bg = null, marks = null, collapsed = false, tag = null, refs = null;
                for (var spi = 0; spi < spans.length; spi++) {
                    var sp = spans[spi];
                    var dl = sp.getAttribute('data-level');
                    if (dl) { level = dl; }
                    var dbg = sp.getAttribute('data-bg');
                    if (dbg) bg = dbg;
                    var dmarks = sp.getAttribute('data-marks');
                    if (dmarks) { try { marks = JSON.parse(dmarks); } catch(e) {} }
                    if (sp.getAttribute('data-collapsed')) collapsed = true;
                    var drefs = sp.getAttribute('data-refs');
                    if (drefs) { try { refs = JSON.parse(decodeURIComponent(drefs)); } catch(e) {} }
                    var dt = sp.getAttribute('data-tag');
                    if (dt) tag = dt;
                    var detected = _detectMarksFromNode(sp);
                    if (detected) {
                        if (!marks) marks = {};
                        for (var mk in detected) {
                            if (marks[mk] === undefined) marks[mk] = detected[mk];
                        }
                    }
                }
                if (!dl) {
                    var sStyle = (spans[0] ? (spans[0].getAttribute('style') || '') : '').toLowerCase();
                    if (sStyle.indexOf('方正小标宋') !== -1 || sStyle.indexOf('fzxiaobiaosong') !== -1) level = 'level-title';
                    else if (sStyle.indexOf('黑体') !== -1 || sStyle.indexOf('simhei') !== -1) level = 'level-1';
                    else if ((sStyle.indexOf('楷体') !== -1 || sStyle.indexOf('kaiti') !== -1) && sStyle.indexOf('黑体') === -1) level = 'level-2';
                    else if (sStyle.indexOf('仿宋') !== -1 || sStyle.indexOf('fangsong') !== -1) level = 'level-body';
                }
                return { level: level, bg: bg, marks: marks, collapsed: collapsed, tag: tag, refs: refs };
            }
            for (var i = 0; i < ps.length; i++) {
                var p = ps[i];
                var nodes = [];
                for (var ci = 0; ci < p.childNodes.length; ci++) nodes.push(p.childNodes[ci]);
                var hasMp = false, itemSpanCount = 0;
                for (var nc = 0; nc < nodes.length; nc++) {
                    if (nodes[nc].nodeType === 1 && nodes[nc].tagName === 'SPAN') {
                        if (nodes[nc].getAttribute('data-mp')) hasMp = true;
                        else if (nodes[nc].getAttribute('data-level')) itemSpanCount++;
                    }
                }
                if (hasMp || itemSpanCount > 1) {
                    var segments = [{ texts: [], spans: [] }];
                    for (var ni = 0; ni < nodes.length; ni++) {
                        var n = nodes[ni];
                        if (n.nodeType === 3) {
                            segments[segments.length - 1].texts.push(n.nodeValue || '');
                        } else if (n.nodeType === 1 && n.tagName === 'SPAN') {
                            if (n.getAttribute('data-mp')) {
                                segments.push({ texts: [], spans: [] });
                            } else if (n.getAttribute('data-level')) {
                                if (segments[segments.length - 1].spans.length > 0) {
                                    segments.push({ texts: [], spans: [] });
                                }
                                segments[segments.length - 1].spans.push(n);
                                segments[segments.length - 1].texts.push(n.textContent || '');
                            } else {
                                segments[segments.length - 1].spans.push(n);
                                segments[segments.length - 1].texts.push(n.textContent || '');
                            }
                        }
                    }
                    for (var si = 0; si < segments.length; si++) {
                        var seg = segments[si];
                        var txt = seg.texts.join('').replace(/\s+$/g, '');
                        var isBlank = txt.replace(/[\s\u00a0]/g, '').length === 0;
                        if (isBlank && seg.spans.length === 0) continue;
                        var props = _readSpanProps(seg.spans);
                        var item = { level: props.level, text: txt };
                        if (props.bg) item.bg = props.bg;
                        if (props.marks) item.marks = props.marks;
                        if (props.collapsed) item.collapsed = true;
                        if (props.tag) item.tag = props.tag;
                        if (props.refs && props.refs.length) item.refs = props.refs;
                        if (si > 0) item.noBreakBefore = true;
                        if (si < segments.length - 1) item.noBreakAfter = true;
                        newItems.push(item);
                    }
                } else {
                    var txt = (p.innerText || p.textContent || '').replace(/\r?\n$/, '');
                    var style = (p.getAttribute('style') || '').toLowerCase();
                    var firstSpan = p.querySelector('span[data-level]');
                    var spanLevel = firstSpan ? firstSpan.getAttribute('data-level') : null;
                    var isBlank = txt.replace(/[\s\u00a0]/g, '').length === 0;
                    if (isBlank) {
                        if (newItems.length > 0 && !seenDivider && !newItems.some(function(x) { return x.kind === 'divider'; })) {
                            newItems.push({ kind: 'divider' });
                            seenDivider = true;
                            afterStartPart = true;
                        }
                        continue;
                    }
                    var level = spanLevel || 'level-body';
                    if (!spanLevel) {
                        if (style.indexOf('方正小标宋') !== -1 || style.indexOf('fzxiaobiaosong') !== -1) level = 'level-title';
                        else if (style.indexOf('text-align:center') !== -1 && (style.indexOf('楷体') !== -1 || style.indexOf('kaiti') !== -1)) {
                            level = afterStartPart ? 'level-body' : (newItems.some(function(x) { return x.level === 'level-date'; }) ? 'level-author' : 'level-date');
                        }
                        else if (style.indexOf('黑体') !== -1 || style.indexOf('simhei') !== -1) level = 'level-1';
                        else if ((style.indexOf('楷体') !== -1 || style.indexOf('kaiti') !== -1) && style.indexOf('黑体') === -1) level = 'level-2';
                        else if ((style.indexOf('仿宋') !== -1 || style.indexOf('fangsong') !== -1) && style.indexOf('bold') !== -1) level = 'level-3';
                    }
                    var item = { level: level, text: txt };
                    if (firstSpan) {
                        var dbg = firstSpan.getAttribute('data-bg');
                        if (dbg) item.bg = dbg;
                        var dmarks = firstSpan.getAttribute('data-marks');
                        if (dmarks) { try { item.marks = JSON.parse(dmarks); } catch(e) {} }
                        if (firstSpan.getAttribute('data-collapsed')) item.collapsed = true;
                        var dt = firstSpan.getAttribute('data-tag');
                        if (dt) item.tag = dt;
                        var drefs1 = firstSpan.getAttribute('data-refs');
                        if (drefs1) { try { var rp = JSON.parse(decodeURIComponent(drefs1)); if (rp && rp.length) item.refs = rp; } catch(e) {} }
                    }
                    newItems.push(item);
                }
            }
            if (newItems.length) {
                if (isOther) { paOtherItems = newItems; _savedOtherMergeState = null; }
                else { items = newItems; _savedMergeState = null; }
            }
        }
        window.paCopy = function() {
            var overlay = document.getElementById('paPreviewOverlay');
            var html = '';
            var plain = '';
            if (overlay && overlay.classList.contains('show')) {
                var editor = document.getElementById('paPreviewEditor');
                html = editor.innerHTML;
                plain = editor.innerText || '';
            } else {
                html = buildPreviewHtml();
                var tmp = document.createElement('div');
                tmp.innerHTML = html;
                plain = tmp.innerText || '';
            }
            function fallbackCopy() {
                try {
                    var t = document.createElement('textarea');
                    t.value = plain;
                    document.body.appendChild(t);
                    t.select();
                    document.execCommand('copy');
                    document.body.removeChild(t);
                    alert('已复制（纯文本）到剪贴板');
                } catch (e2) {
                    alert('复制失败：' + e2.message);
                }
            }
            try {
                if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
                    var blobHtml = new Blob([html], { type: 'text/html' });
                    var blobText = new Blob([plain], { type: 'text/plain' });
                    var ci = new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText });
                    navigator.clipboard.write([ci]).then(function() {
                        alert('已复制到剪贴板');
                    }, function() {
                        fallbackCopy();
                    });
                } else {
                    fallbackCopy();
                }
            } catch (e) {
                fallbackCopy();
            }
        };
        var _paExportTabState = { extract: {}, export: {} };
        window.switchPaExportTab = function(tab) {
            var dlg = document.getElementById('paExportDialog');
            var tabs = dlg.querySelectorAll('.paExportTab');
            var currentTab = '';
            for (var ti = 0; ti < tabs.length; ti++) { if (tabs[ti].classList.contains('active')) { currentTab = tabs[ti].dataset.tab; break; } }
            if (currentTab && currentTab !== tab) {
                var modeRadios = dlg.querySelectorAll('input[name="paExportMode"]');
                var mode = '';
                for (var mi = 0; mi < modeRadios.length; mi++) { if (modeRadios[mi].checked) { mode = modeRadios[mi].value; break; } }
                var filterRadios = dlg.querySelectorAll('input[name="paExportFilter"]');
                var filterMode = '';
                for (var fi = 0; fi < filterRadios.length; fi++) { if (filterRadios[fi].checked) { filterMode = filterRadios[fi].value; break; } }
                var scopeRadios = dlg.querySelectorAll('input[name="paExportScope"]');
                var scope = '';
                for (var si = 0; si < scopeRadios.length; si++) { if (scopeRadios[si].checked) { scope = scopeRadios[si].value; break; } }
                var kw = document.getElementById('paExportKeywords');
                _paExportTabState[currentTab] = { mode: mode, filterMode: filterMode, scope: scope, keywords: kw ? kw.value : '' };
            }
            for (var ti = 0; ti < tabs.length; ti++) tabs[ti].classList.toggle('active', tabs[ti].dataset.tab === tab);
            var ok = document.getElementById('paExportDlgOk');
            var isExtract = tab === 'extract';
            ok.textContent = isExtract ? '提取到剪贴板' : '确认导出';
            ok.style.background = isExtract ? '#8e44ad' : '#27ae60';
            ok.style.borderColor = isExtract ? '#5B2C6F' : '#229954';
            var suffix = isExtract ? '提取' : '导出';
            var el = document.getElementById('paExportLabelFull');
            if (el) { var s = el.querySelector('span'); if (s) s.textContent = '全部' + suffix; }
            el = document.getElementById('paExportLabelPartial');
            if (el) { var s = el.querySelector('span'); if (s) s.textContent = '部分' + suffix; }
            el = document.getElementById('paExportLabelExclude');
            if (el) { var s = el.querySelector('span'); if (s) s.textContent = isExtract ? '提取' : '导出'; }
            el = document.getElementById('paExportLabelInclude');
            if (el) { var s = el.querySelector('span'); if (s) s.textContent = isExtract ? '只提取' : '只导出'; }
            var saved = _paExportTabState[tab];
            if (saved && saved.keywords) {
                var modeRadios = dlg.querySelectorAll('input[name="paExportMode"]');
                for (var mi = 0; mi < modeRadios.length; mi++) { modeRadios[mi].checked = (modeRadios[mi].value === (saved.mode || 'full')); }
                var filterRadios = dlg.querySelectorAll('input[name="paExportFilter"]');
                for (var fi = 0; fi < filterRadios.length; fi++) { filterRadios[fi].checked = (filterRadios[fi].value === (saved.filterMode || 'exclude')); }
                var scopeRadios = dlg.querySelectorAll('input[name="paExportScope"]');
                for (var si = 0; si < scopeRadios.length; si++) { scopeRadios[si].checked = (scopeRadios[si].value === (saved.scope || 'self')); }
                var kw = document.getElementById('paExportKeywords');
                if (kw) kw.value = saved.keywords || '';
                var partialOpts = document.getElementById('paExportPartialOpts');
                if (saved.mode === 'partial') { partialOpts.classList.add('show'); } else { partialOpts.classList.remove('show'); }
                var scopeDiv = document.getElementById('paExportScope');
                var indicator = document.getElementById('paExportFilterIndicator');
                if (saved.mode === 'partial' && saved.filterMode) {
                    scopeDiv.style.display = 'flex';
                    if (indicator) indicator.style.display = 'inline';
                } else {
                    scopeDiv.style.display = 'none';
                    if (indicator) indicator.style.display = 'none';
                }
            } else {
                var modeRadios = dlg.querySelectorAll('input[name="paExportMode"]');
                for (var mi = 0; mi < modeRadios.length; mi++) { modeRadios[mi].checked = (modeRadios[mi].value === 'full'); }
                var partialOpts = document.getElementById('paExportPartialOpts');
                partialOpts.classList.remove('show');
                var scopeDiv = document.getElementById('paExportScope');
                scopeDiv.style.display = 'none';
                var indicator = document.getElementById('paExportFilterIndicator');
                if (indicator) indicator.style.display = 'none';
                var kw = document.getElementById('paExportKeywords');
                if (kw) kw.value = '';
            }
        };
        window.paShowExportDialog = function() {
            var dlg = document.getElementById('paExportDialog');
            var box = dlg.querySelector('.paExportDlgBox');
            var ok = document.getElementById('paExportDlgOk');
            var cancel = document.getElementById('paExportDlgCancel');
            var modeRadios = dlg.querySelectorAll('input[name="paExportMode"]');
            var partialOpts = document.getElementById('paExportPartialOpts');
            var keywordsInput = document.getElementById('paExportKeywords');
            var scopeDiv = document.getElementById('paExportScope');
            var scopeRadios = scopeDiv.querySelectorAll('input[name="paExportScope"]');
            var indicator = document.getElementById('paExportFilterIndicator');
            var filterRadios = dlg.querySelectorAll('input[name="paExportFilter"]');
            if (!dlg || !ok || !cancel) return;
            _paExportTabState = { extract: {}, export: {} };
            keywordsInput.value = '';
            for (var mi = 0; mi < modeRadios.length; mi++) modeRadios[mi].checked = (modeRadios[mi].value === 'full');
            partialOpts.classList.remove('show');
            scopeDiv.style.display = 'none';
            if (indicator) indicator.style.display = 'none';
            for (var si = 0; si < scopeRadios.length; si++) scopeRadios[si].checked = (scopeRadios[si].value === 'self');
            dlg.style.left = Math.max(4, Math.round((window.innerWidth - 420) / 2)) + 'px';
            dlg.style.top = Math.max(4, Math.round((window.innerHeight - 300) / 2)) + 'px';
            switchPaExportTab('extract');
            dlg.classList.add('show');
            function onModeChange() {
                var val = '';
                for (var mi = 0; mi < modeRadios.length; mi++) { if (modeRadios[mi].checked) { val = modeRadios[mi].value; break; } }
                if (val === 'partial') {
                    partialOpts.classList.add('show');
                    onFilterChange();
                } else {
                    partialOpts.classList.remove('show');
                    scopeDiv.style.display = 'none';
                    if (indicator) indicator.style.display = 'none';
                }
            }
            function onFilterChange() {
                var fv = '';
                for (var fi = 0; fi < filterRadios.length; fi++) { if (filterRadios[fi].checked) { fv = filterRadios[fi].value; break; } }
                if (fv) {
                    scopeDiv.style.display = 'flex';
                    if (indicator) indicator.style.display = 'inline';
                } else {
                    scopeDiv.style.display = 'none';
                    if (indicator) indicator.style.display = 'none';
                }
            }
            function close() {
                dlg.classList.remove('show');
                for (var mi = 0; mi < modeRadios.length; mi++) modeRadios[mi].removeEventListener('change', onModeChange);
                for (var fi = 0; fi < filterRadios.length; fi++) filterRadios[fi].removeEventListener('change', onFilterChange);
                ok.removeEventListener('click', onOk);
                cancel.removeEventListener('click', onCancel);
            }
            function getCurrentTab() {
                var tabs = dlg.querySelectorAll('.paExportTab');
                for (var ti = 0; ti < tabs.length; ti++) { if (tabs[ti].classList.contains('active')) return tabs[ti].dataset.tab; }
                return 'extract';
            }
            function onOk() {
                close();
                var tab = getCurrentTab();
                var mode = '';
                for (var mi = 0; mi < modeRadios.length; mi++) { if (modeRadios[mi].checked) { mode = modeRadios[mi].value; break; } }
                var kwText = keywordsInput.value.trim();
                var scope = '';
                for (var si = 0; si < scopeRadios.length; si++) { if (scopeRadios[si].checked) { scope = scopeRadios[si].value; break; } }
                if (tab === 'extract') {
                    paExtractToClipboard(mode, kwText, scope);
                } else {
                    paExport(mode, kwText, scope);
                }
            }
            function onCancel() { close(); }
            for (var mi = 0; mi < modeRadios.length; mi++) modeRadios[mi].addEventListener('change', onModeChange);
            for (var fi = 0; fi < filterRadios.length; fi++) filterRadios[fi].addEventListener('change', onFilterChange);
            ok.addEventListener('click', onOk);
            cancel.addEventListener('click', onCancel);
        };
        window.paExtractToClipboard = function(mode, keywords, scope) {
            mode = mode || 'full';
            scope = scope || 'self';
            var overlay = document.getElementById('paPreviewOverlay');
            var editor = document.getElementById('paPreviewEditor');
            var needRestore = false;
            if (!overlay.classList.contains('show')) {
                editor.innerHTML = buildPreviewHtml();
                needRestore = true;
            }
            if (mode === 'partial' && keywords) {
                var kwList = keywords.split(/\s+/).filter(function(k) { return k.length > 0; });
                if (kwList.length > 0) {
                    var filterRadios = document.querySelectorAll('#paExportDialog input[name="paExportFilter"]');
                    var filterMode = '';
                    for (var fi = 0; fi < filterRadios.length; fi++) { if (filterRadios[fi].checked) { filterMode = filterRadios[fi].value; break; } }
                    if (!filterMode) filterMode = 'exclude';
                    var paras = editor.querySelectorAll('p');
                    var hideMap = {};
                    for (var pi = 0; pi < paras.length; pi++) {
                        var pText = paras[pi].innerText || '';
                        var matched = false;
                        for (var ki = 0; ki < kwList.length; ki++) { if (pText.indexOf(kwList[ki]) !== -1) { matched = true; break; } }
                        var keep = (filterMode === 'include') ? matched : !matched;
                        hideMap[pi] = !keep;
                    }
                    if (scope === 'with-children') {
                        var _lo = function(lvl) { return LEVEL_ORDER[lvl] !== undefined ? LEVEL_ORDER[lvl] : 99; };
                        for (var pi = 0; pi < paras.length; pi++) {
                            var pText = paras[pi].innerText || '';
                            var matched = false;
                            for (var ki = 0; ki < kwList.length; ki++) { if (pText.indexOf(kwList[ki]) !== -1) { matched = true; break; } }
                            if (matched) {
                                var fs = paras[pi].querySelector('span[data-level]');
                                if (fs) {
                                    var baseOrder = _lo(fs.getAttribute('data-level'));
                                    if (baseOrder < 5) {
                                        for (var sj = pi + 1; sj < paras.length; sj++) {
                                            var sjFs = paras[sj].querySelector('span[data-level]');
                                            var sjOrder = sjFs ? _lo(sjFs.getAttribute('data-level')) : 99;
                                            if (sjOrder <= baseOrder) break;
                                            hideMap[sj] = (filterMode === 'include') ? false : true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    for (var pi = 0; pi < paras.length; pi++) {
                        if (hideMap[pi]) paras[pi].style.display = 'none';
                    }
                }
            }
            var htmlParts = [];
            var visibleParas = editor.querySelectorAll('p');
            for (var pi = 0; pi < visibleParas.length; pi++) {
                if (visibleParas[pi].style.display !== 'none') {
                    htmlParts.push(visibleParas[pi].outerHTML);
                }
            }
            var resultHtml = htmlParts.join('');
            if (needRestore) editor.innerHTML = '';
            if (!resultHtml) { alert('没有可提取的内容'); return; }
            if (navigator.clipboard && navigator.clipboard.write) {
                var blob = new Blob([resultHtml], { type: 'text/html' });
                navigator.clipboard.write([
                    new ClipboardItem({ 'text/html': blob })
                ]).then(function() {
                    alert('已提取到剪贴板（含格式）');
                }).catch(function() {
                    var ta = document.createElement('textarea');
                    ta.value = resultHtml.replace(/<[^>]+>/g, '');
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    alert('已提取到剪贴板（纯文本）');
                });
            } else {
                var ta = document.createElement('textarea');
                ta.value = resultHtml.replace(/<[^>]+>/g, '');
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                alert('已提取到剪贴板');
            }
        };
        function _updateHideBtnState() {
            var btn = document.getElementById('paHideBtn');
            if (!btn) return;
            if (selectedIdx >= 0 && selectedIdx < items.length && items[selectedIdx].paHidden) {
                btn.classList.add('paHideBtnActive');
            } else {
                btn.classList.remove('paHideBtnActive');
            }
        }
        window.paToggleHideMark = function() {
            var idx = selectedIdx;
            if (idx < 0 || idx >= items.length) return;
            pushUndo();
            var it = items[idx];
            var oldVal = !!it.paHidden;
            var newVal = !oldVal;
            it.paHidden = newVal;
            if (newVal && HEADING_LEVELS[it.level]) {
                var baseOrder = LEVEL_ORDER[it.level];
                for (var si = idx + 1; si < items.length; si++) {
                    var sit = items[si];
                    if (sit.kind === 'divider') break;
                    var sOrder = LEVEL_ORDER[sit.level];
                    if (sOrder !== undefined && sOrder <= baseOrder) break;
                    sit.paHidden = true;
                }
            }
            if (!newVal && HEADING_LEVELS[it.level]) {
                var baseOrder = LEVEL_ORDER[it.level];
                for (var si = idx + 1; si < items.length; si++) {
                    var sit = items[si];
                    if (sit.kind === 'divider') break;
                    var sOrder = LEVEL_ORDER[sit.level];
                    if (sOrder !== undefined && sOrder <= baseOrder) break;
                    sit.paHidden = false;
                }
            }
            save();
            render();
        };
        window.paToggleAllHidden = function() {
            _paHideMarkedAllHidden = !_paHideMarkedAllHidden;
            saveHideState();
            render();
            if (paViewMode === 0) {
                var overlay = document.getElementById('paPreviewOverlay');
                var editor = document.getElementById('paPreviewEditor');
                if (overlay && overlay.classList.contains('show') && editor) {
                    editor.innerHTML = buildPreviewHtml();
                }
            }
        };
        function saveHideState() {
            try { DataLayer.set('problemAnalysisHideState', { allHidden: _paHideMarkedAllHidden }) } catch (e) {}
        }
        function loadHideState() {
            try {
                var raw = DataLayer.getRaw('problemAnalysisHideState');
                if (raw) {
                    var st = JSON.parse(raw);
                    if (st && typeof st.allHidden === 'boolean') _paHideMarkedAllHidden = st.allHidden;
                }
            } catch (e) {}
        }
        window.paClearHidden = function() {
            for (var i = 0; i < items.length; i++) {
                if (items[i].kind !== 'divider') {
                    delete items[i].paHidden;
                }
            }
            _paHideMarkedAllHidden = false;
            saveHideState();
            save();
            render();
        };
        window.paShowShortcutDialog = function() {
            var dlg = document.getElementById('paShortcutDialog');
            if (dlg) dlg.classList.add('show');
        };
        window.switchShortcutTab = function(name) {
            var tabs = document.querySelectorAll('#paShortcutDialog .notepadOutlineTab');
            for (var i = 0; i < tabs.length; i++) {
                tabs[i].classList.toggle('active', tabs[i].dataset.stab === name);
            }
            var contents = document.querySelectorAll('#paShortcutDialog .paShortcutTabContent');
            for (var i = 0; i < contents.length; i++) {
                contents[i].classList.toggle('show', contents[i].id === 'paShortcut' + name.charAt(0).toUpperCase() + name.slice(1) + 'Tab');
            }
        };
        document.addEventListener('click', function(e) {
            var sd = document.getElementById('paShortcutDialog');
            if (sd && sd.classList.contains('show') && !e.target.closest('#paShortcutDialog') && !e.target.closest('.paShortcutBtn')) {
                sd.classList.remove('show');
            }
        });

        window.paExport = async function(mode, keywords, scope) {
            mode = mode || 'full';
            scope = scope || 'self';
            var overlay = document.getElementById('paPreviewOverlay');
            var editor = document.getElementById('paPreviewEditor');
            var needRestore = false;
            if (!overlay.classList.contains('show')) {
                editor.innerHTML = buildPreviewHtml();
                needRestore = true;
            }
            if (mode === 'partial' && keywords) {
                var kwList = keywords.split(/\s+/).filter(function(k) { return k.length > 0; });
                if (kwList.length > 0) {
                    var filterRadios = document.querySelectorAll('#paExportDialog input[name="paExportFilter"]');
                    var filterMode = '';
                    for (var fi = 0; fi < filterRadios.length; fi++) { if (filterRadios[fi].checked) { filterMode = filterRadios[fi].value; break; } }
                    var paras = editor.querySelectorAll('p');
                    var hideMap = {};
                    for (var pi = 0; pi < paras.length; pi++) {
                        var pText = paras[pi].innerText || '';
                        var matched = false;
                        for (var ki = 0; ki < kwList.length; ki++) { if (pText.indexOf(kwList[ki]) !== -1) { matched = true; break; } }
                        var keep = (filterMode === 'include') ? matched : !matched;
                        hideMap[pi] = !keep;
                    }
                    if (scope === 'with-children') {
                        var _lo = function(lvl) { return LEVEL_ORDER[lvl] !== undefined ? LEVEL_ORDER[lvl] : 99; };
                        for (var pi = 0; pi < paras.length; pi++) {
                            var pText = paras[pi].innerText || '';
                            var matched = false;
                            for (var ki = 0; ki < kwList.length; ki++) { if (pText.indexOf(kwList[ki]) !== -1) { matched = true; break; } }
                            if (matched) {
                                var fs = paras[pi].querySelector('span[data-level]');
                                if (fs) {
                                    var baseOrder = _lo(fs.getAttribute('data-level'));
                                    if (baseOrder < 5) {
                                        for (var sj = pi + 1; sj < paras.length; sj++) {
                                            var sjFs = paras[sj].querySelector('span[data-level]');
                                            var sjOrder = sjFs ? _lo(sjFs.getAttribute('data-level')) : 99;
                                            if (sjOrder <= baseOrder) break;
                                            hideMap[sj] = (filterMode === 'include') ? false : true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    for (var pi = 0; pi < paras.length; pi++) {
                        if (hideMap[pi]) paras[pi].style.display = 'none';
                    }
                }
            }
            try {
                if (typeof getDocTemplate !== 'function' || typeof collectParagraphs !== 'function' || typeof buildDocBodyXml !== 'function' || typeof ensureDocDirHandle !== 'function' || typeof sanitizeDocFileName !== 'function') {
                    alert('导出功能依赖的笔记导出模块未加载');
                    return;
                }
                var tpl = getDocTemplate();
                if (!tpl) { alert('未找到文档模板'); return; }
                var paragraphs = collectParagraphs(editor);
                if (!paragraphs || !paragraphs.length) { alert('编辑器内容为空，无法导出'); return; }
                var bodyXml = buildDocBodyXml(paragraphs);
                var xml = tpl.replace('__DOC_BODY__', bodyXml);
                var now = new Date();
                var ts = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
                var title = '';
                for (var i = 0; i < items.length; i++) {
                    if (items[i].kind === 'divider') continue;
                    if (items[i].level === 'level-title') { title = (items[i].text || '').trim(); break; }
                }
                if (!title) {
                    for (var j = 0; j < items.length; j++) {
                        if (items[j].kind === 'divider') continue;
                        if (items[j].text && items[j].text.trim()) { title = items[j].text.trim(); break; }
                    }
                }
                if (!title) title = '编辑器';
                if (title.length > 30) title = title.substring(0, 30);
                var fileName = sanitizeDocFileName(ts + ' ' + title + '.docx');
                var blob = new Blob([xml], { type: 'application/msword' });
                var dirHandle = await ensureDocDirHandle();
                if (dirHandle && dirHandle.getFileHandle) {
                    try {
                        var fh = await dirHandle.getFileHandle(fileName, { create: true });
                        var w = await fh.createWritable({ keepExistingData: false });
                        await w.write(blob);
                        await w.close();
                        updateFooterTimestamp();
                        alert('已导出: ' + fileName);
                        return;
                    } catch (e) {
                        alert('写入失败，改为下载: ' + e.message);
                    }
                }
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                updateFooterTimestamp();
                alert('已下载: ' + fileName);
            } finally {
                if (needRestore) editor.innerHTML = '';
            }
        };
        var _paSearchActive = false;
        var _paSearchContext = 'main';
        var _paSearchHighlightColors = ['paSearchHighlight0','paSearchHighlight1','paSearchHighlight2','paSearchHighlight3','paSearchHighlight4'];
        window.paToggleSearch = function(ctx) {
            ctx = ctx || 'main';
            var modal = document.getElementById('paSearchModal');
            if (_paSearchActive) {
                paClearSearch();
                if (_paSearchContext === ctx) return;
            }
            _paSearchContext = ctx;
            modal.classList.add('show');
            var panelId = (ctx === 'mirror') ? 'problemAnalysisMirror' : 'problemAnalysisPanel';
            var bodyId = (ctx === 'mirror') ? 'paMirrorBody' : 'paBody';
            var editorId = (ctx === 'mirror') ? 'paMirrorPreviewEditor' : 'paPreviewEditor';
            var panel = document.getElementById(panelId);
            if (!panel) { modal.classList.remove('show'); return; }
            var panelRect = panel.getBoundingClientRect();
            var searchBtn = panel.querySelector('.paActionBtn[onclick*="paToggleSearch"],.paActionBtn[onclick*="paToggleSearch(' + "'" + ctx + "'" + ')"]');
            if (!searchBtn) searchBtn = panel.querySelector('button.paActionBtn:last-child');
            var searchBtnRect = searchBtn ? searchBtn.getBoundingClientRect() : null;
            var box = document.getElementById('paSearchBox');
            var inputEl = document.getElementById('paSearchInput');
            var inputHeight = inputEl ? inputEl.offsetHeight : 30;
            var boxH = Math.round(inputHeight * 1.2);
            var panelPadding = 24;
            var boxW = Math.floor(Math.max(200, panelRect.width - panelPadding));
            box.style.width = boxW + 'px';
            box.style.minWidth = boxW + 'px';
            box.style.height = boxH + 'px';
            var left = panelRect.left + (panelRect.width - boxW) / 2;
            var top = searchBtnRect ? (searchBtnRect.top - boxH - 4) : (panelRect.bottom - boxH - 60);
            box.style.left = Math.floor(left) + 'px';
            box.style.top = Math.floor(top) + 'px';
            _paSearchActive = true;
            document.getElementById('paSearchInput').value = '';
            document.getElementById('paSearchInput').focus();
            var body = document.getElementById(bodyId);
            if (body) body.classList.add('paSearching');
            var previewEditor = document.getElementById(editorId);
            if (previewEditor) previewEditor.contentEditable = 'false';
            if (previewEditor) {
                var savedInput = document.querySelector('#paSearchModal ._paSavedEditorHtml');
                if (!savedInput) {
                    savedInput = document.createElement('input');
                    savedInput.type = 'hidden';
                    savedInput.className = '_paSavedEditorHtml';
                    document.getElementById('paSearchModal').appendChild(savedInput);
                }
            }
        };
        window.paClearSearch = function() {
            document.getElementById('paSearchModal').classList.remove('show');
            _paSearchActive = false;
            var panels = ['paBody', 'paMirrorBody'];
            for (var pi = 0; pi < panels.length; pi++) {
                var body = document.getElementById(panels[pi]);
                if (!body) continue;
                body.classList.remove('paSearching');
                var editorId = (panels[pi] === 'paMirrorBody') ? 'paMirrorPreviewEditor' : 'paPreviewEditor';
                var previewEditor = document.getElementById(editorId);
                if (previewEditor) previewEditor.contentEditable = 'true';
                var items = body.querySelectorAll('.paItem');
                for (var si = 0; si < items.length; si++) {
                    items[si].style.display = '';
                    var spans = items[si].querySelectorAll('.paSearchHighlight0,.paSearchHighlight1,.paSearchHighlight2,.paSearchHighlight3,.paSearchHighlight4');
                    for (var hi = 0; hi < spans.length; hi++) {
                        var parent = spans[hi].parentNode;
                        parent.replaceChild(document.createTextNode(spans[hi].textContent), spans[hi]);
                        parent.normalize();
                    }
                }
                if (previewEditor && previewEditor.querySelector('p')) {
                    var ps = previewEditor.querySelectorAll('p');
                    for (var pj = 0; pj < ps.length; pj++) ps[pj].style.display = '';
                    var hls = previewEditor.querySelectorAll('.paSearchHighlight0,.paSearchHighlight1,.paSearchHighlight2,.paSearchHighlight3,.paSearchHighlight4');
                    for (var hj = 0; hj < hls.length; hj++) {
                        var pr = hls[hj].parentNode;
                        pr.replaceChild(document.createTextNode(hls[hj].textContent), hls[hj]);
                        pr.normalize();
                    }
                }
            }
        };
        window.paRefreshSearch = function() {
            var inp = document.getElementById('paSearchInput');
            if (inp) inp.dispatchEvent(new Event('input'));
        };
        (function() {
            var input = document.getElementById('paSearchInput');
            if (!input) return;
            var _savedTextModeHtml = null;
            input.addEventListener('input', function() {
                var text = this.value.trim();
                var bodyId = (_paSearchContext === 'mirror') ? 'paMirrorBody' : 'paBody';
                var body = document.getElementById(bodyId);
                if (!body) return;
                var isTextMode = (_paSearchContext !== 'mirror' && paViewMode === 0) || (_paSearchContext === 'mirror' && window.paMirrorMode === 2 && window.paOtherMirrorViewMode === 0);
                function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
                function clearAllHighlights() {
                    if (isTextMode) {
                        if (_savedTextModeHtml) {
                            var editor = document.getElementById('paPreviewEditor');
                            if (editor) { editor.innerHTML = _savedTextModeHtml; _savedTextModeHtml = null; }
                        }
                        var allPs = body.querySelectorAll('#paPreviewEditor p, #paMirrorPreviewEditor p');
                        for (var pi = 0; pi < allPs.length; pi++) allPs[pi].style.display = '';
                        return;
                    }
                    var items2 = body.querySelectorAll('.paItem');
                    for (var si2 = 0; si2 < items2.length; si2++) {
                        items2[si2].style.display = '';
                        var spans2 = items2[si2].querySelectorAll('.paSearchHighlight0,.paSearchHighlight1,.paSearchHighlight2,.paSearchHighlight3,.paSearchHighlight4');
                        for (var hi2 = 0; hi2 < spans2.length; hi2++) {
                            var p = spans2[hi2].parentNode;
                            p.replaceChild(document.createTextNode(spans2[hi2].textContent), spans2[hi2]);
                            p.normalize();
                        }
                    }
                }
                if (!text) { clearAllHighlights(); return; }
                var keywords = text.split(/\s+/).map(function(s){return s.trim();}).filter(function(s){return s;});
                if (keywords.length === 0) { clearAllHighlights(); return; }
                var colorIdx = {};
                var nextColor = 0;
                for (var ki = 0; ki < keywords.length; ki++) {
                    var kw = keywords[ki];
                    if (!colorIdx[kw]) {
                        colorIdx[kw] = _paSearchHighlightColors[nextColor % _paSearchHighlightColors.length];
                        nextColor++;
                    }
                }
                if (isTextMode) {
                    var editorId = (_paSearchContext === 'mirror') ? 'paMirrorPreviewEditor' : 'paPreviewEditor';
                    var editor = document.getElementById(editorId);
                    if (!editor) { clearAllHighlights(); return; }
                    if (!_savedTextModeHtml) _savedTextModeHtml = editor.innerHTML;
                    else editor.innerHTML = _savedTextModeHtml;
                    var allPs = editor.querySelectorAll('p');
                    for (var pi2 = 0; pi2 < allPs.length; pi2++) {
                        var pEl = allPs[pi2];
                        var childSpans = pEl.querySelectorAll('span[data-level]');
                        var fullText = '';
                        var spanTexts = [];
                        for (var si = 0; si < childSpans.length; si++) {
                            var txt = childSpans[si].textContent || '';
                            spanTexts.push(txt);
                            fullText += txt;
                        }
                        var ranges = [];
                        for (var kj = 0; kj < keywords.length; kj++) {
                            var kw2 = keywords[kj];
                            var pos = 0;
                            while ((pos = fullText.indexOf(kw2, pos)) !== -1) {
                                ranges.push({ start: pos, end: pos + kw2.length, cls: colorIdx[kw2] });
                                pos += kw2.length;
                            }
                        }
                        if (ranges.length === 0) { pEl.style.display = 'none'; continue; }
                        pEl.style.display = '';
                        ranges.sort(function(a,b){return a.start - b.start;});
                        var merged = [ranges[0]];
                        for (var ri = 1; ri < ranges.length; ri++) {
                            var last = merged[merged.length - 1];
                            if (ranges[ri].start <= last.end) {
                                if (ranges[ri].end > last.end) last.end = ranges[ri].end;
                            } else {
                                merged.push(ranges[ri]);
                            }
                        }
                        var spanIdx = 0;
                        var offset = 0;
                        for (var si2 = 0; si2 < childSpans.length; si2++) {
                            var span = childSpans[si2];
                            var st = spanTexts[si2];
                            var spanRanges = [];
                            for (var mi = 0; mi < merged.length; mi++) {
                                var r = merged[mi];
                                var rs = r.start - offset;
                                var re = r.end - offset;
                                if (re <= 0) continue;
                                if (rs >= st.length) continue;
                                rs = Math.max(0, rs);
                                re = Math.min(st.length, re);
                                if (rs < re) spanRanges.push({ start: rs, end: re, cls: r.cls });
                            }
                            offset += st.length;
                            if (spanRanges.length === 0) { span.innerHTML = escHtml(st); continue; }
                            var html = '';
                            var cp = 0;
                            for (var mi2 = 0; mi2 < spanRanges.length; mi2++) {
                                var sr = spanRanges[mi2];
                                if (sr.start > cp) html += escHtml(st.substring(cp, sr.start));
                                html += '<span class="' + sr.cls + '">' + escHtml(st.substring(sr.start, sr.end)) + '</span>';
                                cp = sr.end;
                            }
                            if (cp < st.length) html += escHtml(st.substring(cp));
                            span.innerHTML = html;
                        }
                    }
                    return;
                }
                var allItems = body.querySelectorAll('.paItem');
                for (var ai = 0; ai < allItems.length; ai++) {
                    var item = allItems[ai];
                    var textEl = item.querySelector('.paItemText');
                    if (!textEl) { item.style.display = ''; continue; }
                    var originalText = textEl.textContent;
                    var ranges = [];
                    for (var kj = 0; kj < keywords.length; kj++) {
                        var kw2 = keywords[kj];
                        var pos = 0;
                        while ((pos = originalText.indexOf(kw2, pos)) !== -1) {
                            ranges.push({ start: pos, end: pos + kw2.length, cls: colorIdx[kw2] });
                            pos += kw2.length;
                        }
                    }
                    if (ranges.length === 0) { item.style.display = 'none'; continue; }
                    ranges.sort(function(a,b){return a.start - b.start;});
                    var merged = [ranges[0]];
                    for (var ri = 1; ri < ranges.length; ri++) {
                        var last = merged[merged.length - 1];
                        if (ranges[ri].start <= last.end) {
                            if (ranges[ri].end > last.end) last.end = ranges[ri].end;
                        } else {
                            merged.push(ranges[ri]);
                        }
                    }
                    item.style.display = '';
                    var html = '';
                    var cp = 0;
                    for (var mi = 0; mi < merged.length; mi++) {
                        var r = merged[mi];
                        if (r.start > cp) html += escHtml(originalText.substring(cp, r.start));
                        html += '<span class="' + r.cls + '">' + escHtml(originalText.substring(r.start, r.end)) + '</span>';
                        cp = r.end;
                    }
                    if (cp < originalText.length) html += escHtml(originalText.substring(cp));
                    textEl.innerHTML = html;
                }
            });
        })();
        (function() {
            var closeBtn = document.getElementById('paSearchCloseBtn');
            if (closeBtn) closeBtn.onclick = paClearSearch;
        })();
        window.paExtract = function() {
            var modal = document.getElementById('paExtractModal');
            modal.classList.add('show');
            var saved = DataLayer.getRaw('paFilterInput') || '';
            var inputEl = document.getElementById('paExtractInput');
            inputEl.value = saved || '';
            inputEl.placeholder = '【×级标题】关键字1、关键字2【正文】关键字3、关键字4、关键字5';
            document.getElementById('paExtractOutput').value = '';
            inputEl.focus();
        };
        window.closePaExtractModal = function() {
            document.getElementById('paExtractModal').classList.remove('show');
        };
        (function() {
            var modal = document.getElementById('paExtractModal');
            var handle = document.getElementById('paExtractDragHandle');
            if (!modal || !handle) return;
            handle.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;
                e.preventDefault();
                var rect = modal.getBoundingClientRect();
                var startX = e.clientX, startY = e.clientY;
                var startLeft = rect.left, startTop = rect.top;
                function onMove(ev) {
                    var dx = ev.clientX - startX;
                    var dy = ev.clientY - startY;
                    modal.style.left = Math.max(0, startLeft + dx) + 'px';
                    modal.style.top = Math.max(0, startTop + dy) + 'px';
                    modal.style.alignItems = 'flex-start';
                    modal.style.justifyContent = 'flex-start';
                }
                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        })();
        (function() {
            var mPanel = document.getElementById('problemAnalysisMirror');
            var mHandle = document.getElementById('paMirrorDragHandle');
            if (mPanel && mHandle) {
                mHandle.addEventListener('dblclick', function(e) {
                    if (e.target.closest('.paToolbar') || e.target.closest('button') || e.target.closest('input')) return;
                    paMaximizePanel('mirror');
                });
                mHandle.addEventListener('mousedown', function(e) {
                    if (e.target.closest('.paToolbar') || e.target.closest('.paTabTitleWrap') || e.target.closest('button') || e.target.closest('input')) return;
                    if (e.button !== 0) return;
                    e.preventDefault();
                    var rect = mPanel.getBoundingClientRect();
                    var startX = e.clientX, startY = e.clientY;
                    var startLeft = rect.left, startTop = rect.top;
                    function onMove(ev) {
                        var dx = ev.clientX - startX;
                        var dy = ev.clientY - startY;
                        var newLeft = Math.max(0, Math.min(window.innerWidth - 80, startLeft + dx));
                        var newTop = Math.max(0, Math.min(window.innerHeight - 40, startTop + dy));
                        mPanel.style.left = newLeft + 'px';
                        mPanel.style.top = newTop + 'px';
                    }
                    function onUp() {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    }
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }
            var handle = document.getElementById('paMirrorResizeHandle');
            if (!handle) return;
            handle.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;
                e.preventDefault();
                var mainPanel = document.getElementById('problemAnalysisPanel');
                var panel = document.getElementById('problemAnalysisMirror');
                var rect = panel.getBoundingClientRect();
                var startX = e.clientX;
                var startW = rect.width;
                function onMove(ev) {
                    var dx = ev.clientX - startX;
                    var newW = Math.max(320, startW + dx);
                    panel.style.width = newW + 'px';
                }
                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            var handleTop = document.getElementById('paMirrorResizeHandleTop');
            if (handleTop) {
                handleTop.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    var panel = document.getElementById('problemAnalysisMirror');
                    var rect = panel.getBoundingClientRect();
                    var startY = e.clientY;
                    var startTop = rect.top;
                    var startH = rect.height;
                    function onMove(ev) {
                        var dy = ev.clientY - startY;
                        var newTop = Math.max(20, Math.min(startTop + dy, startTop + startH - 120));
                        var newH = startH - (newTop - startTop);
                        panel.style.top = newTop + 'px';
                        panel.style.height = newH + 'px';
                        var mainPanel = document.getElementById('problemAnalysisPanel');
                        if (paMirrorVisible && mainPanel) {
                            mainPanel.style.top = panel.style.top;
                            mainPanel.style.height = panel.style.height;
                            _paPositionMirrorDivider();
                        }
                    }
                    function onUp() {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    }
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }
        })();
        (function initPaMainDragResize() {
            var panel = document.getElementById('problemAnalysisPanel');
            var handle = document.getElementById('paDragHandle');
            if (!panel || !handle) return;
            function detachIfEmbedded() {
                var rightPanel = document.getElementById('rightPanel');
                if (panel.parentNode === rightPanel) {
                    var mc = document.getElementById('mainContent');
                    var rect = panel.getBoundingClientRect();
                    if (mc) mc.appendChild(panel);
                    panel.classList.add('paFixedMode');
                    panel.style.left = rect.left + 'px';
                    panel.style.top = rect.top + 'px';
                    panel.style.width = rect.width + 'px';
                    panel.style.height = rect.height + 'px';
                    panel.style.right = 'auto';
                    panel.style.bottom = 'auto';
                    if (rightPanel) rightPanel.classList.remove('has-editor');
                }
            }
            handle.addEventListener('mousedown', function(e) {
                if (e.target.closest('.paToolbar') || e.target.closest('.paTabTitleWrap') || e.target.closest('button') || e.target.closest('input') || e.target.closest('.paDropdownWrap')) return;
                if (e.button !== 0) return;
                e.preventDefault();
                detachIfEmbedded();
                var rect = panel.getBoundingClientRect();
                var startX = e.clientX, startY = e.clientY;
                var startLeft = rect.left, startTop = rect.top, startW = rect.width;
                function onMove(ev) {
                    var newLeft = Math.max(0, Math.min(window.innerWidth - 80, startLeft + ev.clientX - startX));
                    var newTop = Math.max(0, Math.min(window.innerHeight - 40, startTop + ev.clientY - startY));
                    panel.style.left = newLeft + 'px';
                    panel.style.top = newTop + 'px';
                    panel.style.right = 'auto';
                    panel.style.width = startW + 'px';
                    if (paMirrorVisible) _paPositionMirrorDivider();
                }
                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            var resizeR = document.getElementById('paResizeHandle');
            if (resizeR) {
                resizeR.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    detachIfEmbedded();
                    var rect = panel.getBoundingClientRect();
                    var startX = e.clientX, startW = rect.width;
                    function onMove(ev) {
                        var newW = Math.max(320, Math.min(window.innerWidth - rect.left - 8, startW + ev.clientX - startX));
                        panel.style.width = newW + 'px';
                        if (paMirrorVisible) _paPositionMirrorDivider();
                    }
                    function onUp() {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    }
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }
            var resizeB = document.getElementById('paResizeHandleBottom');
            if (resizeB) {
                resizeB.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    detachIfEmbedded();
                    var rect = panel.getBoundingClientRect();
                    var startY = e.clientY, startH = rect.height;
                    function onMove(ev) {
                        var newH = Math.max(120, Math.min(window.innerHeight - rect.top - 8, startH + ev.clientY - startY));
                        panel.style.height = newH + 'px';
                        if (paMirrorVisible) {
                            var mirror = document.getElementById('problemAnalysisMirror');
                            if (mirror) { mirror.style.top = panel.style.top; mirror.style.height = panel.style.height; }
                            _paPositionMirrorDivider();
                        }
                    }
                    function onUp() {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    }
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }
            var resizeL = document.getElementById('paResizeHandleLeft');
            if (resizeL) {
                resizeL.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    detachIfEmbedded();
                    var rect = panel.getBoundingClientRect();
                    var startX = e.clientX, startLeft = rect.left, startW = rect.width;
                    var rectRight = rect.right;
                    function onMove(ev) {
                        var newLeft = Math.max(0, Math.min(rectRight - 320, startLeft + ev.clientX - startX));
                        var newW = rectRight - newLeft;
                        panel.style.left = newLeft + 'px';
                        panel.style.width = newW + 'px';
                        if (paMirrorVisible) _paPositionMirrorDivider();
                    }
                    function onUp() {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    }
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }
            var resizeT = document.getElementById('paResizeHandleTop');
            if (resizeT) {
                resizeT.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    detachIfEmbedded();
                    var rect = panel.getBoundingClientRect();
                    var startY = e.clientY, startTop = rect.top, startH = rect.height;
                    var rectBottom = rect.bottom;
                    function onMove(ev) {
                        var newTop = Math.max(0, Math.min(rectBottom - 120, startTop + ev.clientY - startY));
                        var newH = rectBottom - newTop;
                        panel.style.top = newTop + 'px';
                        panel.style.height = newH + 'px';
                        if (paMirrorVisible) {
                            var mirror = document.getElementById('problemAnalysisMirror');
                            if (mirror) { mirror.style.top = panel.style.top; mirror.style.height = panel.style.height; }
                            _paPositionMirrorDivider();
                        }
                    }
                    function onUp() {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    }
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }
        })();
        window.paDoExtract = function() {
            var isOther = paMirrorMode === 2;
            var sourceItems = isOther ? paOtherItems : items;
            var subtreeEndFn = isOther ? computeOtherSubtreeEnd : computeSubtreeEnd;
            var inputEl = document.getElementById('paExtractInput');
            var input = inputEl.value.trim();
            if (!input) {
                var def = '输入示例：【×级标题】关键字1、关键字2【正文】关键字3、关键字4、关键字5\n表示将要在内容包含关键字1或者关键字2的×级标题的所属区域内，提取含有关键字3或者关键字4或者关键字5的段落；多个关键字中间用、隔开';
                inputEl.value = def;
                inputEl.focus();
                inputEl.selectionStart = 0;
                inputEl.selectionEnd = def.length;
                return;
            }
            DataLayer.setRaw('paFilterInput', input);
            var output = document.getElementById('paExtractOutput');
            var levelMap = {
                '标题': 'level-title', '密级': 'level-secret', '日期': 'level-date', '作者': 'level-author',
                '一级标题': 'level-1', '一级': 'level-1',
                '二级标题': 'level-2', '二级': 'level-2',
                '三级标题': 'level-3', '三级': 'level-3',
                '正文': 'level-body'
            };
            var rules = [];
            var re = /【([^】]+)】([^【]*)/g;
            var match;
            while ((match = re.exec(input)) !== null) {
                var levelName = match[1];
                var kwText = match[2];
                var level = levelMap[levelName];
                if (!level) { showToast('不认识的层级：' + levelName); return; }
                var keywords = kwText.split('、').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
                rules.push({ level: level, keywords: keywords });
            }
            if (rules.length === 0) { showToast('未识别到提取规则'); return; }
            for (var ri = 1; ri < rules.length; ri++) {
                if (LEVEL_ORDER[rules[ri].level] <= LEVEL_ORDER[rules[ri-1].level]) {
                    showToast('层级顺序必须按：一级标题 > 二级标题 > 三级标题 > 正文'); return;
                }
            }
            function matchKeywords(text, keywords) {
                if (!keywords || keywords.length === 0) return true;
                for (var k = 0; k < keywords.length; k++) {
                    if (text.indexOf(keywords[k]) !== -1) return true;
                }
                return false;
            }
            function extractInRange(startIdx, endIdx, ruleIdx, resultArr) {
                if (ruleIdx >= rules.length) return;
                var rule = rules[ruleIdx];
                var isLast = (ruleIdx === rules.length - 1);
                var i = startIdx;
                while (i < endIdx) {
                    var it = sourceItems[i];
                    if (it && it.kind !== 'divider' && it.level === rule.level) {
                        if (rule.keywords.length === 0 || matchKeywords(it.text, rule.keywords)) {
                            if (isLast) {
                                var txt = it.text;
                                if (typeof txt === 'string' && /<[a-zA-Z]/.test(txt)) { var d = document.createElement('div'); d.innerHTML = txt; txt = d.textContent || d.innerText || ''; }
                                resultArr.push(txt);
                            } else {
                                var subEnd = subtreeEndFn(i);
                                extractInRange(i + 1, subEnd, ruleIdx + 1, resultArr);
                            }
                        }
                    }
                    i++;
                }
            }
            var results = [];
            extractInRange(0, sourceItems.length, 0, results);
            output.value = results.join('\n');
        };
        window.paCopyExtractResult = function() {
            var output = document.getElementById('paExtractOutput');
            var text = output.value;
            if (!text) { showToast('没有可复制的内容'); return; }
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(function() { showToast('已复制到剪贴板'); }).catch(function() { showToast('复制失败'); });
            } else {
                output.select();
                document.execCommand('copy');
                showToast('已复制到剪贴板');
            }
        };
        (function() {
            document.addEventListener('dblclick', function(e) {
                var editor = document.getElementById('paPreviewEditor');
                if (!editor) return;
                if (editor.contains(e.target)) {
                    paTextEditable = true;
                    editor.setAttribute('contenteditable', 'true');
                    editor.focus();
                }
            });
        })();
        function _paTextKeyGuard(e) {
            if (paViewMode !== 0) return;
            if (paTextEditable) return;
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT')) return;
            if (e.target && e.target.closest) {
                if (e.target.closest('#paPreviewEditor') || e.target.closest('.paItemText')) { e.preventDefault(); e.stopPropagation(); }
            }
        }
        document.addEventListener('keydown', _paTextKeyGuard, true);
        window.paExtensionGetEditor = function() {
            try {
                var html = buildExtensionHtml();
                return { html: _paExtensionSanitize(html), textMode: true };
            } catch (e) {
                try {
                    var body = document.getElementById('paBody');
                    return { html: _paExtensionSanitize(body ? body.innerHTML : ''), textMode: false };
                } catch (e2) {
                    return { html: '', textMode: false };
                }
            }
        };
        function _paExtensionSanitize(html) {
            try {
                var tmp = document.createElement('div');
                tmp.innerHTML = html || '';
                tmp.querySelectorAll('.paExpandIcon, .paToggleBtn, .paCollapseIcon, .paTagIcon').forEach(function(el) { el.parentNode && el.parentNode.removeChild(el); });
                var collapsed = tmp.querySelectorAll('[data-collapsed]');
                for (var i = 0; i < collapsed.length; i++) {
                    collapsed[i].removeAttribute('data-collapsed');
                    collapsed[i].classList.remove('collapsed');
                    collapsed[i].style.display = '';
                }
                var all = tmp.querySelectorAll('*');
                for (var j = 0; j < all.length; j++) {
                    if (all[j].style && all[j].style.display === 'none') all[j].style.display = '';
                }
                return tmp.innerHTML;
            } catch (e) { return html || ''; }
        }
        window.paExtensionBuildOutline = function(rootEl) {
            try {
                if (!rootEl) return [];
                var out = [];
                var ps = Array.prototype.slice.call(rootEl.querySelectorAll('p'));
                for (var i = 0; i < ps.length; i++) {
                    var p = ps[i];
                    if (p.getAttribute('data-pa-ref')) continue; // 提纲不包含参考段落
                    var dataLevel = p.getAttribute('data-level') || '';
                    if (dataLevel === 'secret' || dataLevel === 'recipient' || dataLevel === 'attachment' || p.getAttribute('data-attachment-style')) continue;
                    var info = _npOutlineDisplayInfo(p);
                    if (info) {
                        var ff = _npOutlineFontFamily(p, info.text, info.isArticleTitle ? 1 : info.level);
                        out.push({ text: info.text, level: info.isArticleTitle ? 1 : info.level, fontFamily: ff.family, bold: ff.bold });
                    }
                    var extra = _npOutlineExtraEntries(p);
                    for (var ei = 0; ei < extra.length; ei++) {
                        if (info && extra[ei].text === info.text) continue;
                        var ex = extra[ei];
                        var ff2 = _npOutlineFontFamily(p, ex.text, ex.level);
                        out.push({ text: ex.text, level: ex.level, fontFamily: ff2.family, bold: ff2.bold });
                    }
                }
                return out;
            } catch (e) { return []; }
        };
        function _npOutlineFontFamily(p, text, level) {
            var def = '仿宋_GB2312,FangSong_GB2312,FangSong,仿宋,serif';
            var bold = true;
            if (level === 1) { def = '黑体,SimHei,sans-serif'; bold = true; }
            else if (level === 2) { def = '楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif'; bold = false; }
            var target = (text || '').replace(/^\s+|\s+$/g, '');
            try {
                var nodes = p.querySelectorAll ? p.querySelectorAll('span,font,b,strong') : [];
                for (var ni = 0; ni < nodes.length; ni++) {
                    var nt = (nodes[ni].textContent || '').replace(/^\s+|\s+$/g, '');
                    if (!nt || (target && nt.indexOf(target) === -1 && target.indexOf(nt) === -1)) continue;
                    var nff = (nodes[ni].style && nodes[ni].style.fontFamily || '').toLowerCase();
                    if (nff.indexOf('黑体') !== -1 || nff.indexOf('simhei') !== -1) return { family: '黑体,SimHei,sans-serif', bold: true };
                    if (nff.indexOf('小标宋') !== -1 || nff.indexOf('fzxiaobiaosong') !== -1) return { family: '方正小标宋简体,FZXiaoBiaoSong,SimSun,serif', bold: false };
                    if (nff.indexOf('楷体') !== -1 || nff.indexOf('kaiti') !== -1) return { family: '楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', bold: false };
                    if (nff.indexOf('仿宋') !== -1 || nff.indexOf('fangsong') !== -1) return { family: '仿宋_GB2312,FangSong_GB2312,FangSong,仿宋,serif', bold: true };
                }
                var pff = (p.style && p.style.fontFamily || '').toLowerCase();
                if (pff.indexOf('黑体') !== -1 || pff.indexOf('simhei') !== -1) return { family: '黑体,SimHei,sans-serif', bold: true };
                if (pff.indexOf('小标宋') !== -1 || pff.indexOf('fzxiaobiaosong') !== -1) return { family: '方正小标宋简体,FZXiaoBiaoSong,SimSun,serif', bold: false };
                if (pff.indexOf('楷体') !== -1 || pff.indexOf('kaiti') !== -1) return { family: '楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', bold: false };
                if (pff.indexOf('仿宋') !== -1 || pff.indexOf('fangsong') !== -1) return { family: '仿宋_GB2312,FangSong_GB2312,FangSong,仿宋,serif', bold: true };
            } catch (e) {}
            return { family: def, bold: bold };
        }
        window.paExtensionBuildNoteOutline = function(html) {
            try {
                var tmp = document.createElement('div');
                tmp.style.position = 'absolute';
                tmp.style.left = '-99999px';
                tmp.innerHTML = html || '';
                document.body.appendChild(tmp);
                var out = window.paExtensionBuildOutline(tmp);
                document.body.removeChild(tmp);
                return out;
            } catch (e) { return []; }
        };
    })();
    function toggleClearCheck(item) {
        var cb = item.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = !cb.checked;
    }
    window.showClearDataDialog = function() {
        document.getElementById('clearDataModal').classList.add('show');
    };
    window.closeClearDataDialog = function() {
        document.getElementById('clearDataModal').classList.remove('show');
    };
    window.confirmClearData = function() {
        var clearLog = document.getElementById('clearDataLog').checked;
        var clearReminder = document.getElementById('clearDataReminder').checked;
        var clearNote = document.getElementById('clearDataNote').checked;
        var clearNotepad = document.getElementById('clearDataNotepad').checked;
            var clearEditorEl = document.getElementById('clearDataEditor');
            var clearEditor = !!(clearEditorEl && clearEditorEl.checked);
        if (!clearLog && !clearReminder && !clearNote && !clearNotepad && !clearEditor) {
            showToast('请至少选择一项要清空的数据类型');
            return;
        }
        if (clearLog) {
            S.reportData = {};
            try { DataLayer.remove('reportDataCache'); } catch (e) {}
        }
        if (clearReminder) {
            S.reminders = [];
            try { DataLayer.remove('reminders'); } catch (e) {}
        }
        if (clearNote) {
            notes = [];
            _noteCategories = [{ id: 0, name: '默认' }];
            _noteCurrentCategory = 0;
            try { DataLayer.remove('notes'); } catch (e) {}
            try { DataLayer.remove('noteCategories'); } catch (e) {}
            try { DataLayer.remove('noteCurrentCategory'); } catch (e) {}
            refreshNoteCategorySelect();
        }
        if (clearNotepad) {
            S.notepadData = ['', '', '', '', ''];
            S.notepadTitles = ['…', '…', '…', '…', '…'];
            S.notepadEditorData = [{html:'', bold:false}, {html:'', bold:false}, {html:'', bold:false}, {html:'', bold:false}, {html:'', bold:false}];
            S.notepadFontSizes = [14, 14, 14, 14, 14];
            S.notepadNotebookStyles = [false, false, false, false, false];
            S.notepadLabels = ['1', '2', '3', '4', '5'];
            var titleInput = document.getElementById('notepadTitle');
            if (titleInput) titleInput.value = notepadTitles[currentNotepadTab];
            syncEditorFromData();
            try { DataLayer.remove('notepadCache'); } catch (e) {}
            try { DataLayer.remove('notepadFontSizesCache'); } catch (e) {}
        }
        if (clearEditor) {
            if (typeof window.paSetItems === 'function') {
                window.paSetItems([{level:'level-1', text:'（空白）'}]);
            } else {
                try { DataLayer.set('problemAnalysisItems', [{level:'level-1', text:'（空白）'}]) } catch (e) {}
            }
            try { DataLayer.remove('problemAnalysisHideState'); } catch (e) {}
        }
        document.getElementById('clearDataModal').classList.remove('show');
        renderCalendar();
        renderReminders();
        renderNotes();
        renderTrackContent();
        saveCurrentEditor();
        showToast('已清空所选数据');
    };
