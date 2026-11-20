/* ============================================================
   notepad.js — 记事本模块
   ============================================================ */

        function autoFitNotepadHeight() {
            var panel = document.getElementById('notepadPanel');
            if (!panel) return;
            var z = 1;
            try { z = parseFloat(DataLayer.getRaw('mainZoom')) || 1; } catch(e) {}
            var rp = document.getElementById('rightPanel');
            if (rp && rp.offsetParent !== null) {
                var rr = rp.getBoundingClientRect();
                panel.style.top = (rr.top / z) + 'px';
                panel.style.height = (rr.height / z) + 'px';
                panel.style.bottom = 'auto';
                return;
            }
            var header = document.getElementById('mainHeader');
            var footer = document.getElementById('mainFooter');
            if (!header || !footer) return;
            var hRect = header.getBoundingClientRect();
            var fRect = footer.getBoundingClientRect();
            panel.style.top = ((hRect.bottom + 15) / z) + 'px';
            panel.style.height = ((fRect.top - 30 - hRect.bottom) / z) + 'px';
            panel.style.bottom = 'auto';
        }
        function toggleNotepad() {
            var panel = document.getElementById('notepadPanel');
            if (!panel) return;
            if (_writeNoteMode || _materialMode) {
                if (!_notepadWorkHidden) {
                    _autoSaveIfDirty();
                    panel.classList.remove('show');
                    panel.classList.add('write-note-hidden');
                    panel.style.display = 'none';
                    if (_materialMode) {
                        var assist = document.getElementById('materialAssistPanel');
                        if (assist) assist.style.display = 'none';
                    } else {
                        var modal = document.getElementById('notepadOutlineModal');
                        if (modal) modal.classList.remove('show');
                    }
                    S._notepadWorkHidden = true;
                    S.notepadVisible = false;
                } else {
                    panel.style.display = '';
                    panel.classList.add('show');
                    panel.classList.remove('write-note-hidden');
                    if (_materialMode) {
                        var assist2 = document.getElementById('materialAssistPanel');
                        if (assist2) assist2.style.display = '';
                        _materialLayout();
                    } else {
                        var modal2 = document.getElementById('notepadOutlineModal');
                        if (modal2) modal2.classList.add('show');
                        _layoutWriteNoteByWorkRects();
                    }
                    S._notepadWorkHidden = false;
                    S.notepadVisible = true;
                }
                return;
            }
            S.notepadVisible = !notepadVisible;
            if (notepadVisible) {
                if (!_notepadInitialBounds) { S._notepadInitialBounds = { top: panel.style.top, left: panel.style.left, width: panel.style.width, height: panel.style.height, bottom: panel.style.bottom }; }
                var editor = document.getElementById('notepadEditor');
                if (editor) {
                    editor.querySelectorAll('.materialOutlineHighlight').forEach(function(el) { el.classList.remove('materialOutlineHighlight'); });
                }
                panel.classList.add('show');
                autoFitNotepadHeight();
                /* 启动路径不再标记 npUserMoved：那会让默认满宽铺位失效 */
                _npSyncTitleDisplay();
                syncEditorFromData();
                if (typeof setNotepadDisplayMode === 'function' && _notepadDisplayMode !== 'right') {
                    setTimeout(function() {
                        _npSuppressDisplayToast = true;
                        setNotepadDisplayMode('right');
                        setTimeout(function() { _npSuppressDisplayToast = false; }, 80);
                    }, 0);
                }
                setTimeout(updateNotepadToolbarScroll, 60);
                if (_notepadOutlineWasOpen) setTimeout(function() { showNotepadOutlineModal(); }, 50);
            } else {
                saveCurrentEditor();
                var modal3 = document.getElementById('notepadOutlineModal');
                S._notepadOutlineWasOpen = modal3 && modal3.classList.contains('show');
                if (_notepadOutlineWasOpen) closeNotepadOutlineModal();
                panel.classList.remove('show');
                delete panel.dataset.npUserMoved;
                hideTile();
            }
        }
        function updateFooterTimestamp() {
            var el = document.getElementById('footerTimestamp');
            if (!el) return;
            var now = new Date();
            var ts = String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
            var count = 1;
            try {
                var saved = DataLayer.getRaw('notepadSaveCount');
                if (saved !== null) {
                    count = parseInt(saved, 10);
                    if (!isFinite(count) || count < 0) count = 0;
                    count++;
                } else {
                    var text = el.textContent || '';
                    var m = text.match(/（第(\d+)次）/);
                    count = m ? parseInt(m[1], 10) + 1 : 1;
                }
                DataLayer.setRaw('notepadSaveCount', String(count));
            } catch (e) { count = 1; }
            el.textContent = ts + '（第' + count + '次）更新';
        }
        (function initNotepadDragResize() {
            var panel = document.getElementById('notepadPanel');
            var handle = document.getElementById('notepadDragHandle');
            var resize = document.getElementById('npResizeHandle');
            if (!panel || !handle || !resize) return;
            resize.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                panel.dataset.npUserMoved = '1';
                panel.dataset.npUserResized = '1';
                    var z0 = _npMainZoom();
                    var rect = _npScreenRect(panel);
                    var startX = e.clientX;
                    var startRight = rect.right;
                    function onMove(ev) {
                        var newRight = Math.max(rect.left + 280 * z0, Math.min(window.innerWidth - 8, startRight + ev.clientX - startX));
                        var newW = (newRight - rect.left) / z0;
                        if (tileVisible && (notepadTileMode === 'stack' || notepadTileMode === 'tile')) {
                            _applyTileSplit(newRight / z0);
                        } else {
                            panel.style.width = newW + 'px';
                        }
                    }

                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    updateNotepadSearchWidth();
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            handle.addEventListener('mousedown', function(e) {
                if (_writeNoteMode) return;
                if (e.target.closest('.notepadTabsRight') || e.target.closest('#notepadTabCtxMenu')) return;
                if (e.target.closest('input')) return;
                if (e.target.closest('button')) return;
                if (e.button !== 0) return;
                e.preventDefault();
                panel.dataset.npUserMoved = '1';
                panel.dataset.npUserResized = '1';
                var z = parseFloat(DataLayer.getRaw('mainZoom') || '1');
                var rect = panel.getBoundingClientRect();
                var startX = e.clientX, startY = e.clientY;
                var startCssLeft = rect.left / z, startCssTop = rect.top / z;
                panel.style.left = startCssLeft + 'px';
                panel.style.top = startCssTop + 'px';
                function onMove(ev) {
                    var newLeft = Math.max(0, Math.min(window.innerWidth - 80, startCssLeft + (ev.clientX - startX) / z));
                    var newTop = Math.max(0, Math.min(window.innerHeight - 40, startCssTop + (ev.clientY - startY) / z));
                    panel.style.left = newLeft + 'px';
                    panel.style.top = newTop + 'px';
                    if (tileVisible) _syncTileLayoutFromPanel();
                }
                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
            var resizeTop2 = document.getElementById('npResizeHandleTop');
            if (resizeTop2) {
                resizeTop2.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    anchorToLeft();
                    var z0 = _npMainZoom();
                    var rect = _npScreenRect(panel);
                    var startY = e.clientY;
                    var startTop = rect.top;
                    function onMove(ev) {
                        var newTop = Math.max(0, Math.min(rect.bottom - 120 * z0, startTop + ev.clientY - startY));
                        var newH = (rect.bottom - newTop) / z0;
                        panel.style.top = (newTop / z0) + 'px';
                        panel.style.height = newH + 'px';
                        if (_writeNoteMode) {
                            var omc = document.getElementById('notepadOutlineModalContent');
                            if (omc) { omc.style.top = newTop + 'px'; omc.style.height = (newH * z0) + 'px'; }
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
            var resizeBottom2 = document.getElementById('npResizeHandleBottom');
            if (resizeBottom2) {
                resizeBottom2.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    panel.dataset.npUserMoved = '1';
                    panel.dataset.npUserResized = '1';
                    var z0 = _npMainZoom();
                    var rect = _npScreenRect(panel);
                    var startY = e.clientY;
                    var startBottom = rect.bottom;
                    function onMove(ev) {
                        var newBottom = Math.max(rect.top + 120 * z0, Math.min(window.innerHeight - 8, startBottom + ev.clientY - startY));
                        var newH = (newBottom - rect.top) / z0;
                        panel.style.height = newH + 'px';
                        if (_writeNoteMode) {
                            var omc = document.getElementById('notepadOutlineModalContent');
                            if (omc) { omc.style.height = (newH * z0) + 'px'; }
                        }
                        if (tileVisible) _syncTileLayoutFromPanel();
                    }
                    function onUp() {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                    }
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }
            var resizeLeft = document.getElementById('npResizeHandleLeft');
            if (resizeLeft) {
                resizeLeft.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    panel.dataset.npUserMoved = '1';
                    panel.dataset.npUserResized = '1';
                    var z0 = _npMainZoom();
                    var rect = _npScreenRect(panel);
                    var startX = e.clientX;
                    var startLeft = rect.left;
                    function onMove(ev) {
                        var newLeftScreen = Math.max(0, Math.min(rect.right - 280 * z0, startLeft + ev.clientX - startX));
                        var newW = (rect.right - newLeftScreen) / z0;
                        var newLeft = newLeftScreen / z0;
                        panel.style.width = newW + 'px';
                        panel.style.left = newLeft + 'px';
                        if (_writeNoteMode) {
                            var omc = document.getElementById('notepadOutlineModalContent');
                            if (omc) omc.style.width = Math.max(150, newLeftScreen - _npScreenRect(omc).left) + 'px';
                        }
                        if (tileVisible) _syncTileLayoutFromPanel();
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
        (function initNotepadOutlineDrag() {
            var content = document.getElementById('notepadOutlineModalContent');
            if (!content) return;
            var rh = content.querySelector('.notepadOutlineResizeHandle');
            var rr = content.querySelector('.notepadOutlineResizeRight');
            var rb = content.querySelector('.notepadOutlineResizeBottom');
            function makeResizer(handle, isRight, isBottom) {
                handle.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault(); e.stopPropagation();
                    var rect = content.getBoundingClientRect();
                    var startX = e.clientX, startY = e.clientY;
                    var startW = rect.width, startH = rect.height;
                    function onMove(ev) {
                        var dw = isRight ? ev.clientX - startX : 0;
                        var dh = isBottom ? ev.clientY - startY : 0;
                        var newW = Math.max(150, startW + dw);
                        var newH = Math.max(120, startH + dh);
                        content.style.width = Math.round(newW) + 'px';
                        content.style.height = Math.round(newH) + 'px';
                        var panel = document.getElementById('notepadPanel');
                        if (panel && (isRight || isBottom)) {
                            _npSyncOutlinePanel(content, panel);
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
            if (rh) makeResizer(rh, true, true);
            if (rr) makeResizer(rr, true, false);
            if (rb) makeResizer(rb, false, true);
            content.addEventListener('mousedown', function(e) {
                if (_writeNoteMode) return;
                if (e.button !== 0) return;
                if (e.target.classList.contains('notepadOutlineResizeHandle') || e.target.classList.contains('notepadOutlineResizeRight') || e.target.classList.contains('notepadOutlineResizeBottom')) return;
                if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'LI' || e.target.closest('.notepadOutlineDirItem')) return;
                e.preventDefault();
                var rect = content.getBoundingClientRect();
                var startX = e.clientX, startY = e.clientY;
                var startLeft = rect.left, startTop = rect.top;
                content.style.left = startLeft + 'px';
                content.style.top = startTop + 'px';
                content.style.transform = 'none';
                function onMove(ev) {
                    content.style.left = (startLeft + ev.clientX - startX) + 'px';
                    content.style.top = (startTop + ev.clientY - startY) + 'px';
                }
                function onUp() {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        })();
        (function initNotepadDblClick() {
            var handle = document.getElementById('notepadDragHandle');
            var p = document.getElementById('notepadPanel');
            if (handle) {
                handle.addEventListener('dblclick', function(e) {
                    if (e.target.closest('.notepadTabsRight') || e.target.closest('button') || e.target.closest('input')) return;
                    if (p) { p.dataset.npUserMoved = '1'; p.dataset.npUserResized = '1'; }
                    autoFitNotepadHeight();
                    if (tileVisible && (notepadTileMode === 'tile' || notepadTileMode === 'stack')) _syncTileLayoutFromPanel();
                });
            }
        })();
        function updateNotepadWindowModeMenu() {
            var panel = document.getElementById('notepadPanel');
            var item = document.getElementById('notepadToolbarToggleItem');
            if (item && panel) item.textContent = panel.classList.contains('toolbars-hidden') ? '显示工具栏' : '隐藏工具栏';
        }
        function toggleNotepadToolbars() {
            var panel = document.getElementById('notepadPanel');
            var btn = document.getElementById('notepadSettingsBtn');
            if (!panel) return;
            var hidden = panel.classList.toggle('toolbars-hidden');
            if (btn) btn.classList.toggle('active', hidden);
            updateNotepadWindowModeMenu();
        }
        function updateNotepadToolbarScroll() {
            var scroller = document.getElementById('notepadToolbarScroller');
            var strip = document.getElementById('notepadToolbarStrip');
            var leftBtn = document.getElementById('notepadToolbarScrollLeft');
            var rightBtn = document.getElementById('notepadToolbarScrollRight');
            if (!scroller || !strip || !leftBtn || !rightBtn) return;
            var overflow = (strip.scrollWidth - strip.clientWidth) > 2;
            if (!overflow) {
                leftBtn.classList.remove('visible');
                rightBtn.classList.remove('visible');
                return;
            }
            leftBtn.classList.toggle('visible', strip.scrollLeft > 1);
            rightBtn.classList.toggle('visible', strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 1);
        }
        function scrollNotepadToolbar(dir) {
            var strip = document.getElementById('notepadToolbarStrip');
            if (!strip) return;
            strip.scrollLeft += dir * 120;
            setTimeout(updateNotepadToolbarScroll, 220);
        }
        (function() {
            function _bindNotepadToolbarScroll() {
                var scroller = document.getElementById('notepadToolbarScroller');
                var strip = document.getElementById('notepadToolbarStrip');
                if (!scroller || !strip) return;
                strip.addEventListener('scroll', updateNotepadToolbarScroll, { passive: true });
                window.addEventListener('resize', updateNotepadToolbarScroll);
                if (typeof ResizeObserver !== 'undefined') {
                    try {
                        var ro = new ResizeObserver(function() { updateNotepadToolbarScroll(); });
                        ro.observe(scroller);
                        ro.observe(strip);
                    } catch (roEx) {}
                }
                setTimeout(updateNotepadToolbarScroll, 300);
            }
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _bindNotepadToolbarScroll);
            else _bindNotepadToolbarScroll();
        })();
        var _notepadSavedRange = null;
        var _notepadDirectoryEntries = [];
        var _notepadDirBrowseSourceHtml = null;
        _notepadDirBrowseMode = false;
        var _notepadDirCtxIndex = -1;
        _notepadDirCurrentIdx = -1;
        var _lastSelectedDirIdx = -1;
        var _lastSelectedStructIdx = -1;
        var _structArticleIdx = -1;
        var _notepadDirActiveHide = false;
        var _notepadHiddenArticleHeadingHtml = null;
        function _notepadDirEndBrowse(restore) {
            var editor = document.getElementById('notepadEditor');
            if (_notepadDirBrowseMode && restore && editor && _notepadDirBrowseSourceHtml != null) editor.innerHTML = _notepadDirBrowseSourceHtml;
            _notepadDirBrowseMode = false;
            _notepadDirBrowseSourceHtml = null;
            _notepadDirCurrentIdx = -1;
            var panel = document.getElementById('notepadPanel');
            if (panel) panel.classList.remove('notepad-dir-browse-active');
        }
        function _notepadDirSourceRoot() {
            var tmp = document.createElement('div');
            var editor = document.getElementById('notepadEditor');
            tmp.innerHTML = _notepadDirBrowseSourceHtml != null ? _notepadDirBrowseSourceHtml : (editor ? editor.innerHTML : '');
            return tmp;
        }
        function _notepadDirSetPrompt() {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            editor.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#999;font-family:SimHei,黑体,sans-serif;font-size:16px;">请在左侧列表中选择要显示的标题</div>';
            editor.scrollTop = 0;
        }
        function _notepadDirArticleRange(root, didx) {
            var entry = _notepadDirectoryEntries[didx];
            var allPs = root ? root.querySelectorAll('p') : [];
            var start = entry && isFinite(entry.index) ? entry.index : -1;
            if (start < 0 || !allPs[start]) return null;
            var end = _npArticleEndIndex(allPs, start);
            return { ps: allPs, start: start, end: end };
        }
        function _notepadDirSaveCurrentArticle(skipCache) {
            if (!_notepadDirBrowseMode || _notepadDirCurrentIdx < 0) return;
            var editor = document.getElementById('notepadEditor');
            var sourceRoot = _notepadDirSourceRoot();
            var range = _notepadDirArticleRange(sourceRoot, _notepadDirCurrentIdx);
            if (!editor || !range) return;
            var tmp = document.createElement('div');
            tmp.innerHTML = _stripNotepadArticleSeparators(editor.innerHTML || '');
            var ref = range.ps[range.end] || null;
            for (var i = range.end - 1; i >= range.start; i--) range.ps[i].remove();
            var nodes = Array.prototype.slice.call(tmp.childNodes);
            for (var ni = 0; ni < nodes.length; ni++) sourceRoot.insertBefore(nodes[ni], ref);
            _notepadDirBrowseSourceHtml = sourceRoot.innerHTML;
            notepadEditorData[currentNotepadTab].html = _notepadDirBrowseSourceHtml;
            _scanNotepadDirectoryEntries();
            if (!skipCache) _saveNotepadToCache();
        }
        function _notepadDirShowEntry(didx) {
            var editor = document.getElementById('notepadEditor');
            var sourceRoot = _notepadDirSourceRoot();
            if (!editor || !sourceRoot) return;
            var range = _notepadDirArticleRange(sourceRoot, didx);
            if (!range) return;
            var html = '';
            for (var hi = range.start; hi < range.end; hi++) html += range.ps[hi].outerHTML;
            editor.innerHTML = html || '<p></p>';
            if (typeof _npEditorResetUndoHistory === 'function') _npEditorResetUndoHistory();
            var openPs = editor.querySelectorAll('p');
            for (var oi = 0; oi < openPs.length; oi++) { openPs[oi].setAttribute('data-collapsed', 'false'); openPs[oi].style.display = ''; }
            editor.scrollTop = 0;
            _notepadDirCurrentIdx = didx;
            _refreshNotepadArticleSeparators(editor);
            _clearWriteNoteArticleDirty();
            _updateStructForArticle(didx);
        }
        function _notepadDirSelectEntry(didx) {
            if (_notepadDirCurrentIdx === didx) return;
            _autoSaveIfDirty();
            _lastSelectedDirIdx = didx;
            var dirTabEl = document.getElementById('notepadOutlineDirTab');
            if (dirTabEl) {
                var sibs = dirTabEl.querySelectorAll('.notepadOutlineSelected');
                for (var si = 0; si < sibs.length; si++) sibs[si].classList.remove('notepadOutlineSelected');
                var item = dirTabEl.querySelector('[data-dir-idx="' + didx + '"]');
                if (item) item.classList.add('notepadOutlineSelected');
            }
            _notepadDirShowEntry(didx);
        }
        function _notepadDirRefreshSelect(didx) {
            _scanNotepadDirectoryEntries();
            _renderDirTab();
            _notepadDirCurrentIdx = -1;
            _notepadDirSelectEntry(Math.max(0, Math.min(didx, _notepadDirectoryEntries.length - 1)));
        }
        function _notepadDirDelete(didx) {
            _notepadDirSaveCurrentArticle();
            var sourceRoot = _notepadDirSourceRoot();
            var range = _notepadDirArticleRange(sourceRoot, didx);
            if (!sourceRoot || !range) return;
            var entry = _notepadDirectoryEntries[didx];
            var title = entry ? (entry.label || entry.articleText || '') : '';
            if (!confirm('即将删除《' + title + '》，是否继续？')) return;
            for (var i = range.end - 1; i >= range.start; i--) range.ps[i].remove();
            _notepadDirBrowseSourceHtml = sourceRoot.innerHTML;
            notepadEditorData[currentNotepadTab].html = _notepadDirBrowseSourceHtml;
            _saveNotepadToCache();
            _notepadDirRefreshSelect(didx);
        }
        function _notepadDirMove(didx, dir) {
            _notepadDirSaveCurrentArticle();
            var sourceRoot = _notepadDirSourceRoot();
            var entries = _notepadDirectoryEntries;
            var targetIdx = didx + dir;
            if (!sourceRoot || targetIdx < 0 || targetIdx >= entries.length) { showToast(dir < 0 ? '已经是第一篇' : '已经是最后一篇'); return; }
            var curRange = _notepadDirArticleRange(sourceRoot, didx);
            var tgtRange = _notepadDirArticleRange(sourceRoot, targetIdx);
            if (!curRange || !tgtRange) return;
            var parts = [];
            for (var i = 0; i < curRange.ps.length; i++) parts.push(curRange.ps[i].outerHTML);
            var curHtml = parts.slice(curRange.start, curRange.end);
            var tgtHtml = parts.slice(tgtRange.start, tgtRange.end);
            var newParts;
            if (dir < 0) newParts = [].concat(parts.slice(0, tgtRange.start), curHtml, tgtHtml, parts.slice(curRange.end));
            else newParts = [].concat(parts.slice(0, curRange.start), tgtHtml, curHtml, parts.slice(tgtRange.end));
            sourceRoot.innerHTML = newParts.join('');
            _notepadDirBrowseSourceHtml = sourceRoot.innerHTML;
            notepadEditorData[currentNotepadTab].html = _notepadDirBrowseSourceHtml;
            _saveNotepadToCache();
            _notepadDirRefreshSelect(targetIdx);
        }
        function _notepadDirInsertAfter(didx) {
            _notepadDirSaveCurrentArticle();
            var sourceRoot = _notepadDirSourceRoot();
            var entry = _notepadDirectoryEntries[didx];
            if (!sourceRoot || !entry) return;
            var allPs = sourceRoot.querySelectorAll('p');
            var start = isFinite(entry.index) ? entry.index : -1;
            if (start < 0 || !allPs[start]) return;
            var end = _npArticleEndIndex(allPs, start);
            var now = new Date();
            var y = now.getFullYear();
            var m = String(now.getMonth() + 1).padStart(2, '0');
            var d = String(now.getDate()).padStart(2, '0');
            var dateStr = y + m + d;
            var dateCn = '（' + y + '年' + parseInt(m, 10) + '月' + parseInt(d, 10) + '日）';
            var newIndex = document.createElement('p');
            newIndex.setAttribute('data-outline-level', '1');
            newIndex.style.cssText = 'margin:0 0 0.5em;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:left;text-indent:0;color:#1a2a4a;';
            newIndex.textContent = dateStr + ' 标题';
            var newTitle = document.createElement('p');
            newTitle.setAttribute('data-level', 'title');
            newTitle.style.cssText = 'margin:0;line-height:1.8;font-family:方正小标宋,FZXiaoBiaoSong,serif;font-size:20px;text-align:center;text-indent:0;';
            newTitle.innerHTML = '<span style="font-family:方正小标宋,FZXiaoBiaoSong,serif;font-size:20px;">标题</span>';
            var newDate = document.createElement('p');
            newDate.setAttribute('data-level', 'date');
            newDate.style.cssText = 'margin:0;line-height:1.8;font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;font-size:16px;text-align:center;text-indent:0;';
            newDate.innerHTML = '<span style="font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;font-size:16px;">' + dateCn + '</span>';
            var newBlank = document.createElement('p');
            newBlank.style.cssText = 'margin:0;line-height:1.8;font-family:仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif;font-size:16px;text-align:left;text-indent:2em;';
            newBlank.innerHTML = '&nbsp;';
            var newBody = document.createElement('p');
            newBody.style.cssText = 'margin:0;line-height:1.8;font-family:仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif;font-size:16px;text-align:left;text-indent:2em;';
            newBody.textContent = '×××。';
            var ref = allPs[end] || null;
            sourceRoot.insertBefore(newBody, ref);
            sourceRoot.insertBefore(newBlank, newBody);
            sourceRoot.insertBefore(newDate, newBlank);
            sourceRoot.insertBefore(newTitle, newDate);
            sourceRoot.insertBefore(newIndex, newTitle);
            _notepadDirBrowseSourceHtml = sourceRoot.innerHTML;
            notepadEditorData[currentNotepadTab].html = _notepadDirBrowseSourceHtml;
            _saveNotepadToCache();
            _notepadDirRefreshSelect(didx + 1);
            var editor = document.getElementById('notepadEditor');
            if (editor) {
                var title = editor.querySelector('p[data-level="title"]');
                if (title) {
                    var range = document.createRange();
                    range.selectNodeContents(title);
                    var sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                    title.focus && title.focus();
                }
            }
        }
        function _notepadDirRestoreHidden() {
            if (_notepadDirBrowseMode) _notepadDirEndBrowse(true);
            if (!_notepadDirActiveHide) return;
            _notepadDirActiveHide = false;
            _notepadHiddenArticleHeadingHtml = null;
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var ps = editor.querySelectorAll('p[data-dir-hidden="true"]');
            for (var i = 0; i < ps.length; i++) {
                ps[i].removeAttribute('data-dir-hidden');
                ps[i].style.display = '';
            }
            var headings = editor.querySelectorAll('p[data-outline-level="1"][data-collapsed="true"]');
            for (var i = 0; i < headings.length; i++) {
                _toggleArticleCollapse(editor, headings[i], true);
            }
        }
        function _notepadDirReapplyHide() {
            if (!_notepadHiddenArticleHeadingHtml) return;
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var ps = editor.querySelectorAll('p');
            var articleStart = -1, articleEnd = ps.length;
            for (var i = 0; i < ps.length; i++) {
                if (ps[i].outerHTML === _notepadHiddenArticleHeadingHtml ||
                    (ps[i].getAttribute('data-outline-level') === '1' && ps[i].textContent.trim() === 
                     (function(){var d=document.createElement('div');d.innerHTML=_notepadHiddenArticleHeadingHtml;var fp=d.querySelector('p');return fp?fp.textContent.trim():'';})())) {
                    articleStart = i; articleEnd = _npArticleEndIndex(ps, i); continue;
                }
            }
            if (articleStart === -1) return;
            for (var i = 0; i < ps.length; i++) {
                if (i >= articleStart && i < articleEnd) {
                    ps[i].style.display = '';
                } else {
                    ps[i].setAttribute('data-dir-hidden', 'true');
                    ps[i].style.display = 'none';
                }
            }
            _notepadDirActiveHide = true;
        }
        function _notepadDirShowOnlyArticle(clickedP) {
            _notepadDirRestoreHidden();
            var editor = document.getElementById('notepadEditor');
            if (!editor || !clickedP) return;
            var ps = editor.querySelectorAll('p');
            var articleStart = -1, articleEnd = ps.length;
            for (var i = 0; i < ps.length; i++) {
                if (ps[i] === clickedP) { articleStart = i; articleEnd = _npArticleEndIndex(ps, i); continue; }
            }
            if (articleStart === -1) return;
            _notepadHiddenArticleHeadingHtml = clickedP.outerHTML;
            for (var i = 0; i < ps.length; i++) {
                if (i >= articleStart && i < articleEnd) {
                    ps[i].style.display = '';
                } else {
                    ps[i].setAttribute('data-dir-hidden', 'true');
                    ps[i].style.display = 'none';
                }
            }
            _notepadDirActiveHide = true;
        }
        function _refreshOutlineIfOpen() {
            var modal = document.getElementById('notepadOutlineModal');
            if (modal && modal.classList.contains('show')) {
                _updateOutlineBg();
                _scanNotepadDirectoryEntries();
                var dirTab = document.getElementById('notepadOutlineDirTab');
                if (dirTab && dirTab.classList.contains('show')) {
                    _renderDirTab();
                } else {
                    _notepadOutlineRenderStruct();
                }
            }
            var mirrorPanel = document.getElementById('problemAnalysisMirror');
            if (mirrorPanel && mirrorPanel.classList.contains('show') && typeof paMirrorMode !== 'undefined' && paMirrorMode === 1 && typeof paRenderOutline === 'function') {
                paRenderOutline();
            }
            /* 中部「标题 / 提纲」页：层级变了要立即重排（标题改正文后不再留在提纲里） */
            if (typeof window._npRefreshOutlinePage === 'function') window._npRefreshOutlinePage();
        }
        function _notepadPositionToolbarMenu(btn, menu) {
            if (!btn || !menu) return;
            var strip = document.getElementById('notepadToolbarStrip');
            if (!strip || !strip.contains(menu)) return;
            // 用 fixed 定位脱离工具栏的横向裁剪，避免下拉菜单被 overflow 截断
            menu.style.position = 'fixed';
            menu.style.left = '0px';
            menu.style.top = '0px';
            menu.style.right = 'auto';
            var r = btn.getBoundingClientRect();
            var mw = menu.offsetWidth, mh = menu.offsetHeight;
            var left = r.right - mw;
            if (left < 4) left = 4;
            if (left + mw > window.innerWidth - 4) left = window.innerWidth - mw - 4;
            var top = r.bottom + 2;
            if (top + mh > window.innerHeight - 4) top = r.top - mh - 2;
            if (top < 4) top = 4;
            menu.style.left = left + 'px';
            menu.style.top = top + 'px';
        }
        function notepadToggleDropdown(e, id) {
            e.stopPropagation();
            var editor = document.getElementById('notepadEditor');
            var sel = window.getSelection();
            if (sel.rangeCount > 0 && editor && editor.contains(sel.anchorNode)) {
                _notepadSavedRange = sel.getRangeAt(0);
            }
            var menuId = 'notepad' + id.charAt(0).toUpperCase() + id.slice(1) + 'Menu';
            var menu = document.getElementById(menuId);
            var wasShown = menu && menu.classList.contains('show');
            paCloseDropdowns();
            if (menu && !wasShown) {
                if (id === 'display') _notepadSyncDisplayMenu();
                menu.classList.add('show');
                _notepadPositionToolbarMenu(e.currentTarget, menu);
            }
        }
        function _notepadInvisOn() { return !!window._npShowInvisibles; }
        /* 「显示」菜单两项是开关，文案随当前状态改写 */
        function _notepadSyncDisplayMenu() {
            var lineEl = document.getElementById('notepadDisplayLineItem');
            if (lineEl) lineEl.textContent = notepadNotebookStyles[currentNotepadTab] ? '取消行线' : '显示行线';
            var invEl = document.getElementById('notepadDisplayInvisItem');
            if (invEl) invEl.textContent = _notepadInvisOn() ? '关闭隐藏字符' : '显示隐藏字符';
        }
        function _notepadRestoreSelection() {
            if (_notepadSavedRange) {
                var editor = document.getElementById('notepadEditor');
                var sel = window.getSelection();
                if (!sel.rangeCount || !editor.contains(sel.anchorNode) || sel.getRangeAt(0).collapsed) {
                    try { sel.removeAllRanges(); sel.addRange(_notepadSavedRange); } catch(e) {}
                }
            }
        }
        document.addEventListener('mousedown', function(e) {
            if (e.target.closest('#notepadPanel .paDropdownBtn') && !e.target.closest('#notepadPanel .paDropdownMenu')) {
                if (!e.target.closest('.notepadSearchBtn')) e.preventDefault();
            }
        });
        function _markWriteNoteArticleDirty() {
            if (!_writeNoteMode && !_materialMode && !_notepadDirBrowseMode) return;
            S._writeNoteArticleDirty = true;
        }
        function _clearWriteNoteArticleDirty() {
            S._writeNoteArticleDirty = false;
        }
        function _autoSaveIfDirty() {
            if (_writeNoteArticleDirty && (_writeNoteMode || _materialMode || _notepadDirBrowseMode)) {
                saveWriteNoteArticle();
            }
        }
        function saveWriteNoteArticle() {
            if (_notepadDirBrowseMode && _notepadDirCurrentIdx >= 0) _notepadDirSaveCurrentArticle();
            else saveCurrentEditor();
            updateFooterTimestamp();
            _clearWriteNoteArticleDirty();
            showToast('当前文章已缓存');
        }
        var _npEditorBoundTab = -1;
        function _npGetEditorBoundTab() { return _npEditorBoundTab; }
        function syncEditorFromData() {
            var editor = document.getElementById('notepadEditor');
            _notepadDirActiveHide = false;
            _notepadHiddenArticleHeadingHtml = null;
                editor.innerHTML = notepadEditorData[currentNotepadTab].html;
                _npEditorBoundTab = currentNotepadTab;
                if (typeof _npEditorResetUndoHistory === 'function') _npEditorResetUndoHistory();
                _refreshNotepadArticleSeparators(editor);
                if (_materialMode) _renderMaterialOutline();

            var hiddenPs = editor.querySelectorAll('p[data-dir-hidden="true"]');
            for (var i = 0; i < hiddenPs.length; i++) {
                hiddenPs[i].removeAttribute('data-dir-hidden');
                hiddenPs[i].style.display = '';
            }
            editor.style.fontSize = notepadFontSizes[currentNotepadTab] + 'px';
            _applyNotepadNotebookStyle();
            if (_notepadTabScrollTop && isFinite(_notepadTabScrollTop[currentNotepadTab])) {
                editor.scrollTop = _notepadTabScrollTop[currentNotepadTab];
            }
        }
        function saveCurrentEditor() {
            if (window._npReplaceActive) return;
            var editor = document.getElementById('notepadEditor');
            // 编辑器内容与当前页签不一致时禁止回写，避免未打开/切换中的空编辑器把某页内容清空
            if (_npEditorBoundTab !== currentNotepadTab) {
                if (_npEditorBoundTab < 0) {
                    if (!editor || !(editor.innerHTML || '').trim()) return;
                    _npEditorBoundTab = currentNotepadTab;
                } else {
                    return;
                }
            }
            if (!editor) return;
            // 编辑器未渲染/为空、面板未打开而缓存中该页有内容时，禁止回写（启动时自动缓存会清空整页）
            var _npPanel = document.getElementById('notepadPanel');
            var _npPanelShown = !!(_npPanel && _npPanel.classList.contains('show') && _npPanel.style.display !== 'none');
            var _npEdBlank = !(editor.innerHTML || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
            var _npCurHtml = (notepadEditorData[currentNotepadTab] && notepadEditorData[currentNotepadTab].html) || '';
            if (_npEdBlank && !_npPanelShown && !_notepadDirBrowseMode && _npCurHtml.replace(/<[^>]*>/g, '').trim()) return;
            if (_notepadDirBrowseMode) {
                if (_notepadDirCurrentIdx >= 0 && _notepadDirBrowseSourceHtml != null) {
                    _notepadDirSaveCurrentArticle(true);
                } else if (_notepadDirBrowseSourceHtml != null) {
                    notepadEditorData[currentNotepadTab].html = _notepadDirBrowseSourceHtml;
                }
                _saveNotepadToCache();
                return;
            }
            _refreshNotepadArticleSeparators(editor);
            /* 保存时只在脱离文档的副本上去掉 display:none / data-dir-hidden。
               以前这里对 live 编辑器先 _notepadDirRestoreHidden() 再 _notepadDirReapplyHide()，
               每 600ms 自动缓存一次就把隐藏段落全部显示再藏回去：索引标题在视野里时整屏闪，
               滚到下面时内容不动、但滚动条高度来回跳。 */
            var _saveTmp = document.createElement('div');
            _saveTmp.innerHTML = editor.innerHTML;
            var _hidPs = _saveTmp.querySelectorAll('p[data-dir-hidden="true"], p[style*="display:none"], p[style*="display: none"]');
            for (var _hpi = 0; _hpi < _hidPs.length; _hpi++) {
                _hidPs[_hpi].removeAttribute('data-dir-hidden');
                _hidPs[_hpi].style.display = '';
            }
            notepadEditorData[currentNotepadTab].html = _stripNotepadArticleSeparators(_saveTmp.innerHTML);
            var curSize = parseInt(editor.style.fontSize) || 14;
            notepadFontSizes[currentNotepadTab] = curSize;
            if (!_notepadTabScrollTop) S._notepadTabScrollTop = [0,0,0,0,0];
            _notepadTabScrollTop[currentNotepadTab] = editor.scrollTop;
            _saveNotepadToCache();
        }
        function _refreshNotepadArticleSeparators(editor) {
            editor = editor || document.getElementById('notepadEditor');
            if (!editor) return;
            var ps = editor.querySelectorAll('p');
            var articleCount = 0;
            var pendingIndex = null;
            function _isIndex(p) {
                return p && p.getAttribute('data-outline-level') === '1';
            }
        function _isTitle(p) {
                return p && p.getAttribute('data-level') === 'title';
        }
            for (var i = 0; i < ps.length; i++) {
                var p = ps[i];
                /* 只在真的有这个类时改动，避免每次自动缓存都让所有段落样式失效一次。 */
                if (p.classList.contains('np-article-separator')) p.classList.remove('np-article-separator');
                if (_isTitle(p)) {
                    articleCount++;
                    if (articleCount > 1) {
                        var _sep = pendingIndex || p;
                        if (!_sep.classList.contains('np-article-separator')) _sep.classList.add('np-article-separator');
                    }
                    pendingIndex = null;
                    continue;
                }
                if (_isIndex(p)) {
                    pendingIndex = p;
                    continue;
                }
                if ((p.textContent || '').trim()) {
                    pendingIndex = null;
                }
            }
        }
        function _stripNotepadArticleSeparators(html) {
            if (!html || html.indexOf('np-article-separator') === -1) return html;
            var tmp = document.createElement('div');
            tmp.innerHTML = html;
            var nodes = tmp.querySelectorAll('.np-article-separator');
            for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('np-article-separator');
            return tmp.innerHTML;
        }
        function _npMarkManual(el) {
            if (el && el.nodeType === 1) el.setAttribute('data-manual', '1');
        }
        function _npMarkManualRange(range) {
            if (!range || range.collapsed) return;
            try {
                var container = range.commonAncestorContainer;
                var root = container.nodeType === 1 ? container : container.parentNode;
                if (!root) return;
                var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
                var nodes = [];
                while (walker.nextNode()) {
                    var n = walker.currentNode;
                    if (range.intersectsNode(n)) nodes.push(n);
                }
                for (var i = 0; i < nodes.length; i++) nodes[i].setAttribute('data-manual', '1');
            } catch(e) {}
        }
        function _npMarkManualPara(p) {
            if (p && p.nodeType === 1) p.setAttribute('data-manual', '1');
        }
        function _npIsManualPara(el) {
            if (!el) return false;
            if (el.nodeType !== 1) el = el.parentNode;
            while (el && el.tagName !== 'P' && el.tagName !== 'DIV' && el.id !== 'notepadEditor') el = el.parentNode;
            if (!el || el.id === 'notepadEditor') return false;
            return el.getAttribute('data-manual') === '1' || !!(el.querySelector && el.querySelector('[data-manual="1"]'));
        }
        function _npManualLooksArticleTitle(el, text) {
            if (!el || el.nodeType !== 1) return false;
            var txt = (text || el.textContent || '').replace(/^\s+|\s+$/g, '');
            if (!txt || txt.length > 80) return false;
            var st = el.style || {};
            var ff = ((st.fontFamily || '') + ' ' + (el.innerHTML || '')).toLowerCase();
            var isCenter = st.textAlign === 'center' || /text-align\s*:\s*center/i.test(el.getAttribute('style') || '');
            var isTitleFont = ff.indexOf('方正小标宋') !== -1 || ff.indexOf('fzxiaobiaosong') !== -1;
            var isTitleSize = st.fontSize === '20px' || /font-size\s*:\s*20px/i.test(el.getAttribute('style') || '') || /font-size\s*:\s*20px/i.test(el.innerHTML || '');
            return isCenter && isTitleFont && isTitleSize;
        }
        function _npIsArticleTitlePara(p) {
            if (!p || p.nodeType !== 1 || p.tagName !== 'P') return false;
            if (p.getAttribute('data-outline-level') === '1') return true;
            if (p.getAttribute('data-level') === 'title') return true;
            if (_npManualLooksArticleTitle(p, p.textContent || '')) return true;
            var ff = p.style.fontFamily || '';
            if ((p.style.fontSize === '20px' || p.style.fontSize === '20pt') &&
                (ff.indexOf('方正小标宋简体') !== -1 || ff.indexOf('FZXiaoBiaoSong') !== -1) &&
                (p.style.textAlign === 'center' || /text-align\s*:\s*center/i.test(p.getAttribute('style') || ''))) return true;
            return false;
        }
        // 计算从 start 开始的“当前文章”结束位置（不含该位置）。
        // 文章之间以大纲一级（data-outline-level="1" 的索引标题）或独立文章标题分隔；
        // 但“当前文章自己的标题”（索引标题紧跟着的那个 data-level="title"/手动标题）不能当作边界，
        // 否则 range/toggle 会在标题处截断，导致正文无法展开。
        function _npIsIndexPara(p) {
            if (!p || p.nodeType !== 1) return false;
            if (p.getAttribute('data-outline-level') !== '1') return false;
            // 索引标题本身若同时被标记为文章标题（合并成一段），仍视为该文章的开始
            return true;
        }
        function _npIsOwnArticleTitlePara(p) {
            if (!p || p.nodeType !== 1) return false;
            if (p.getAttribute('data-level') === 'title') return true;
            return _npManualLooksArticleTitle(p, p.textContent || '');
        }
        function _npArticleEndIndex(ps, start) {
            if (!ps || start < 0 || start >= ps.length) return ps ? ps.length : 0;
            var startIsIndex = ps[start].getAttribute('data-outline-level') === '1';
            var skippedOwnTitle = !startIsIndex;
            for (var pi = start + 1; pi < ps.length; pi++) {
                var p = ps[pi];
                var isOwnTitle = _npIsOwnArticleTitlePara(p);
                // data-outline-level="1" 同时带 data-level="title"/手动标题时，仅在紧跟索引标题时视为本篇标题
                if (p.getAttribute('data-outline-level') === '1') {
                    if (isOwnTitle && pi === start + 1 && !skippedOwnTitle) { skippedOwnTitle = true; continue; }
                    return pi;
                }
                if (_npIsArticleTitlePara(p)) {
                    if (!skippedOwnTitle) { skippedOwnTitle = true; continue; }
                    return pi;
                }
            }
            return ps.length;
        }
        function _npHasManualSpan(el) {
            if (!el || !el.querySelectorAll) return false;
            return el.querySelectorAll('[data-manual-span="1"]').length > 0;
        }
        function _npIsWholeParaManual(el) {
            if (!el) return false;
            var spans = el.querySelectorAll('[data-manual-span="1"]');
            if (!spans.length) return false;
            var manualText = '';
            for (var i = 0; i < spans.length; i++) manualText += (spans[i].textContent || '');
            var allText = (el.textContent || '').replace(/[\s\xa0\u200b\uFEFF]+/g, '');
            var mText = manualText.replace(/[\s\xa0\u200b\uFEFF]+/g, '');
            return !!allText && mText === allText;
        }
        function _npMixedManualParaHtml(el, paraStyle, bodyInlineStyle) {
            if (!el) return '';
            var out = '';
            var bodyInline = bodyInlineStyle || '';
            function emitNonManual(node) {
                if (node.nodeType === 3) {
                    var t = node.nodeValue || '';
                    if (!t) return;
                    if (bodyInline) out += '<span style="' + bodyInline + '">' + escapeHtml(t) + '</span>';
                    else out += escapeHtml(t);
                    return;
                }
                if (node.nodeType !== 1) return;
                if (node.getAttribute && node.getAttribute('data-manual-span') === '1') {
                    out += node.outerHTML;
                    return;
                }
                var kids = node.childNodes;
                for (var i = 0; i < kids.length; i++) emitNonManual(kids[i]);
            }
            for (var ci = 0; ci < el.childNodes.length; ci++) emitNonManual(el.childNodes[ci]);
            if (!out) out = escapeHtml(el.textContent || '');
            return '<p style="' + paraStyle + '">' + out + '</p>';
        }
        function _npManualSkipOuterHTML(el, text) {
            if (!el || !el.outerHTML) return '';
            if (!_npManualLooksArticleTitle(el, text)) return el.outerHTML;
            var clone = el.cloneNode(true);
            clone.removeAttribute('data-outline-level');
            clone.removeAttribute('data-collapsed');
            clone.removeAttribute('data-level');
            return clone.outerHTML;
        }
        function _npCleanEmptyOutlineMarkers(root) {
            if (!root || !root.querySelectorAll) return;
            var nodes = root.querySelectorAll('[data-outline-level="1"]');
            for (var i = 0; i < nodes.length; i++) {
                var el = nodes[i];
                var txt = (el.textContent || '').replace(/[\s\xa0\u200b\uFEFF]+/g, '');
                if (txt) continue;
                el.removeAttribute('data-outline-level');
                el.removeAttribute('data-collapsed');
            }
        }
        // 判断段落是否是真正的索引标题（大纲一级只允许索引标题使用）
        function _npIsTitleStylePara(p) {
            var ta = (p.style.textAlign || '').toLowerCase();
            var ff = (p.style.fontFamily || '').replace(/["']/g, '').toLowerCase();
            var fs = (p.style.fontSize || '').toLowerCase();
            return (fs === '20px' || fs === '20pt') && ta === 'center' &&
                (ff.indexOf('小标宋') !== -1 || ff.indexOf('xiaobiaosong') !== -1);
        }
        // 文本/样式层面像索引（不含小标宋标题样式）
        function _npLooksLikeIndexPara(p) {
            if (!p || p.nodeType !== 1 || p.tagName !== 'P') return false;
            if (p.getAttribute('data-np-index') === '1') return true;
            var txt = (p.textContent || '').replace(/\u00a0/g, ' ').replace(/^\s+|\s+$/g, '');
            if (!txt) return false;
            if (/^【[^】]{1,40}】/.test(txt)) return true;
            if (_npLooksLikeNumericIndexLine(txt, null)) return true;
            // 已明确标为其它层级（主送/日期/作者/密级/附件/文章标题）的不是索引
            var lv = p.getAttribute('data-level') || '';
            if (lv) return false;
            // 主送单位等以冒号结尾的段落不是索引
            if (/[：:]$/.test(txt)) return false;
            var ta = (p.style.textAlign || '').toLowerCase();
            var ff = (p.style.fontFamily || '').replace(/["']/g, '').toLowerCase();
            var fs = (p.style.fontSize || '').toLowerCase();
            // 索引标题权威样式：楷体 16px、左对齐、顶格（正文是仿宋，日期/作者居中）
            return (fs === '16px' || fs === '16pt') && ta !== 'center' &&
                (ff.indexOf('楷体') !== -1 || ff.indexOf('kaiti') !== -1);
        }
        // 上方是否已有索引标题（用于判断小标宋标题是否本身就是索引锚点）
        function _npHasIndexParaBefore(p) {
            var prev = p.previousElementSibling;
            while (prev && prev.tagName !== 'P') prev = prev.previousElementSibling;
            while (prev && !(prev.textContent || '').replace(/[\s\u00a0\u200b\uFEFF]+/g, '')) {
                prev = prev.previousElementSibling;
            }
            return !!prev && _npLooksLikeIndexPara(prev);
        }
        function _npIsIndexTitlePara(p) {
            if (!p || p.nodeType !== 1 || p.tagName !== 'P') return false;
            if (p.getAttribute('data-np-index') === '1') return true;
            var txt = (p.textContent || '').replace(/\u00a0/g, ' ').replace(/^\s+|\s+$/g, '');
            if (!txt) return false;
            var lv = p.getAttribute('data-level') || '';
            if (lv === 'date' || lv === 'author' || lv === 'secret' ||
                lv === 'attachment' || lv === 'recipient') return false;
            // 没有独立索引行时，文章标题（小标宋 20px 居中）本身就是折叠锚点；
            // 若上方已有索引标题，则它只是文章标题，不再重复持有大纲一级。
            if (_npIsTitleStylePara(p)) return !_npHasIndexParaBefore(p);
            if (lv === 'title') return !_npHasIndexParaBefore(p);
            return _npLooksLikeIndexPara(p);
        }
        // 归一大纲一级标记：非索引段落一律清除，避免残留的小三角干扰索引收起
        function _npNormalizeOutlineMarkers(root) {
            if (!root || !root.querySelectorAll) return;
            var nodes = root.querySelectorAll('p[data-outline-level="1"]');
            for (var i = 0; i < nodes.length; i++) {
                var p = nodes[i];
                if (_npIsIndexTitlePara(p)) continue;
                p.removeAttribute('data-outline-level');
                p.removeAttribute('data-collapsed');
                if (p.style && p.style.paddingLeft) p.style.paddingLeft = '';
            }
        }
        function _splitManualParagraphAt(p, splitOffset, originalRange) {
            // p: 手动格式的段落，splitOffset: 分割位置（句号后的字符索引），originalRange: 当前selection range
            // 在splitOffset处分割段落，前半部分保留手动格式，后半部分创建新段落不带手动标记
            if (!p || p.id === 'notepadEditor') return;
            // 使用TreeWalker找到分割点对应的文本节点
            var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
            var currentOffset = 0;
            var splitNode = null;
            var splitNodeOffset = 0;
            var totalLen = 0;
            var node;
            while (node = walker.nextNode()) {
                var nodeLen = node.nodeValue.length;
                totalLen += nodeLen;
                if (currentOffset + nodeLen >= splitOffset) {
                    splitNode = node;
                    splitNodeOffset = splitOffset - currentOffset;
                    break;
                }
                currentOffset += nodeLen;
            }
            if (!splitNode) return;
            var newP = document.createElement(p.tagName);
            var style = p.getAttribute('style') || '';
            newP.setAttribute('style', style);
            newP.removeAttribute('data-manual');
            if (splitOffset < totalLen) {
                if (splitNodeOffset > 0 && splitNodeOffset < splitNode.nodeValue.length) {
                    splitNode = splitNode.splitText(splitNodeOffset);
                }
                var nextNode;
                while (splitNode) {
                    nextNode = splitNode.nextSibling;
                    newP.appendChild(splitNode);
                    splitNode = nextNode;
                }
            }
            var manuals = newP.querySelectorAll('[data-manual="1"],[data-manual-span="1"]');
            for (var mi = 0; mi < manuals.length; mi++) { manuals[mi].removeAttribute('data-manual'); manuals[mi].removeAttribute('data-manual-span'); }
            p.parentNode.insertBefore(newP, p.nextSibling);
            try {
                var newRange = document.createRange();
                newRange.setStart(newP, 0);
                newRange.collapse(true);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(newRange);
            } catch(e) {}
        }
        function _npGetEditorSelectionRange() {
            var editor = document.getElementById('notepadEditor');
            _notepadRestoreSelection();
            var sel = window.getSelection();
            if (!sel.rangeCount || !editor.contains(sel.anchorNode)) {
                editor.focus(); sel = window.getSelection();
                if (!sel.rangeCount || !editor.contains(sel.anchorNode)) return null;
            }
            var range = sel.getRangeAt(0);
            if (range.collapsed) return null;
            return { range: range, sel: sel, editor: editor };
        }
        function _npCleanPropInNode(root, prop, unwrapTagList) {
            if (!root) return;
            var tags = unwrapTagList || [];
            if (tags.length) {
                var sel = root.querySelectorAll(tags.join(','));
                for (var i = sel.length - 1; i >= 0; i--) {
                    var el = sel[i];
                    var pn = el.parentNode;
                    if (!pn) continue;
                    while (el.firstChild) pn.insertBefore(el.firstChild, el);
                    pn.removeChild(el);
                }
            }
            var all = root.querySelectorAll('*');
            for (var j = 0; j < all.length; j++) {
                var e = all[j];
                if (e.style && e.style[prop]) e.style[prop] = '';
                if (e.style && e.style.cssText === '') e.removeAttribute('style');
            }
        }
        function _npWrapTextNodesInFragment(frag, wrapperCreator) {
            var walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT, null, false);
            var textNodes = [];
            while (walker.nextNode()) {
                var tn = walker.currentNode;
                if ((tn.nodeValue || '').length > 0) textNodes.push(tn);
            }
            for (var i = 0; i < textNodes.length; i++) {
                var tn = textNodes[i];
                var w = wrapperCreator();
                tn.parentNode.replaceChild(w, tn);
                w.appendChild(tn);
            }
        }
        function _npApplyUnifiedFormat(range, sel, editor, prop, value, unwrapTagList, tagWrapper) {
            var frag = range.extractContents();
            var tmp = document.createElement('div');
            tmp.appendChild(frag);
            _npCleanPropInNode(tmp, prop, unwrapTagList);
            if (tagWrapper) {
                _npWrapTextNodesInFragment(tmp, function() {
                    var w = document.createElement(tagWrapper);
                    w.style[prop] = value;
                    return w;
                });
            } else {
                _npWrapTextNodesInFragment(tmp, function() {
                    var w = document.createElement('span');
                    w.style[prop] = value;
                    return w;
                });
            }
            while (tmp.firstChild) range.insertNode(tmp.firstChild);
            _npMarkManualRange(sel.getRangeAt(0));
            var _pp = sel.anchorNode;
            if (_pp && _pp.nodeType === 3) _pp = _pp.parentNode;
            while (_pp && _pp !== editor && _pp.tagName !== 'P' && _pp.tagName !== 'DIV') _pp = _pp.parentNode;
            if (_pp && _pp !== editor) _npMarkManualPara(_pp);
            range.collapse(false);
            _refreshOutlineIfOpen();
        }
        function _npIsProtectedLiveFormatPara(p) {
            if (!p || p.nodeType !== 1) return false;
            if (p.getAttribute('data-outline-level') === '1') return true;
            var dl = p.getAttribute('data-level');
            if (dl === 'title' || dl === 'date' || dl === 'author') return true;
            var st = p.getAttribute('style') || '';
            if (/text-align\s*:\s*center/i.test(st) && /方正小标宋|FZXiaoBiaoSong/i.test(st) && /font-size\s*:\s*20px/i.test(st)) return true;
            if (/text-align\s*:\s*center/i.test(st) && /楷体|KaiTi/i.test(st) && /font-size\s*:\s*(16|18)px/i.test(st)) return true;
            return false;
        }
        // 强制补齐段落首行缩进：避免样式被整体覆盖、内联 span 或后置样式重排后缩进丢失
        function _npEnsureParaIndent(p, indent) {
            if (!p || p.nodeType !== 1) return;
            var want = (indent == null || indent === '') ? '2em' : String(indent);
            try { p.style.setProperty('text-indent', want, 'important'); } catch (e) { p.style.textIndent = want; }
            // 排除会让 text-indent 失效的块级设置（仅处理本程序写入的排版属性）
            if (p.style.display && /flex|grid/i.test(p.style.display)) { p.style.display = ''; }
            // 段落内部若存在把整段包起来的行内元素，去掉其可能覆盖的缩进/首行占位
            var spans = p.querySelectorAll('[data-np-indent-reset="1"]');
            for (var i = 0; i < spans.length; i++) spans[i].removeAttribute('data-np-indent-reset');
        }
        // 按层级补齐缩进（正文/一级/二级/三级标题为 2 字符；标题、索引、主送等为 0）
        function _npApplyLevelIndent(p, level) {
            if (!p || p.nodeType !== 1) return;
            var c = FORMAT_STANDARD.levels[level] || FORMAT_STANDARD.levels['level-body'];
            _npEnsureParaIndent(p, c && c.textIndent != null ? c.textIndent : '2em');
        }
        function _setParagraphFormat(p, level) {
            var c = FORMAT_STANDARD.levels[level];
            if (!c) { return; }
            var _generic = { serif:1, 'sans-serif':1, monospace:1, cursive:1, fantasy:1, 'system-ui':1 };
            var ff = c.fontFamily.split(',').map(function(f) { var t = f.trim(); return _generic[t] ? t : "'" + t + "'"; }).join(',');
            var css = 'font-family:' + ff + ';font-size:' + c.fontSize + ';text-align:' + c.textAlign + ';text-indent:' + c.textIndent + ';line-height:1.8;margin:0;';
            if (level === 'level-attachment') {
                var atText = (p.textContent || '').replace(/^\s+|\s+$/g, '');
                var atKind = /^附件[：:]\s*1[.．、]/.test(atText) ? 'prefix' : 'item';
                p.setAttribute('data-attachment-style', atKind);
                css = atKind === 'prefix'
                    ? 'font-family:仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif;font-size:16px;text-align:left;text-indent:2em;line-height:1.8;margin:0;'
                    : 'font-family:仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif;font-size:16px;text-align:left;text-indent:-1em;margin-left:6em;line-height:1.8;margin-top:0;margin-bottom:0;';
            }
                if (c.fontWeight) css += 'font-weight:' + c.fontWeight + ';';
                p.setAttribute('style', css);
            _npApplyLevelIndent(p, level);
            p.removeAttribute('data-last-format-level');
            p.setAttribute('data-last-format-level', level);
            if (level === 'level-1') { p.setAttribute('data-outline-level', '2'); } else { p.removeAttribute('data-outline-level'); }
        }
        function _getCharOffset(container, range) {
            var offset = 0, node = range.startContainer, nodeOffset = range.startOffset;
            if (node === container) return nodeOffset;
            var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            while (walker.nextNode()) {
                if (walker.currentNode === node) { offset += nodeOffset; break; }
                offset += (walker.currentNode.textContent || '').length;
            }
            return offset;
        }
        function _setCursorAtCharOffset(container, offset) {
            var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            var accumulated = 0;
            while (walker.nextNode()) {
                var len = (walker.currentNode.textContent || '').length;
                if (accumulated + len >= offset) {
                    var range = document.createRange();
                    range.setStart(walker.currentNode, Math.min(offset - accumulated, len));
                    range.collapse(true);
                    window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
                    return;
                }
                accumulated += len;
            }
        }
        function _npLiveFormatNorm(s) {
            return String(s == null ? '' : s).replace(/[\s\u00a0\u200b]/g, '');
        }
        function _npLiveFormatSetHtml(p, html, origText) {
            p.innerHTML = html;
            if (_npLiveFormatNorm(p.textContent) !== _npLiveFormatNorm(origText)) {
                p.innerHTML = '<span style="' + FORMAT_STANDARD.inlineStyle('level-body') + '">' + escapeHtml(origText) + '</span>';
                console.warn('liveFormat text mismatch, restored plain body; expected len=' + origText.length + ' got len=' + (p.textContent || '').length);
            }
        }
        function _applyLiveFormat(targetPara) {
            try {
                var editor = document.getElementById('notepadEditor');
                if (!editor) return;
                var sel = window.getSelection();
                var range = null;
                var node = null;
                var p = null;
                if (targetPara && targetPara.nodeType === 1 && editor.contains(targetPara) &&
                    (targetPara.tagName === 'P' || targetPara.tagName === 'DIV')) {
                    /* 供粘贴后成批排版调用：不要求段落处于当前选区 */
                    p = targetPara;
                    node = p;
                    if (sel && sel.rangeCount && p.contains(sel.anchorNode)) {
                        range = sel.getRangeAt(0);
                    } else {
                        range = document.createRange();
                        range.selectNodeContents(p);
                        range.collapse(false);
                    }
                } else {
                    if (!sel.rangeCount) return;
                    range = sel.getRangeAt(0);
                    node = sel.anchorNode;
                    if (!node) return;
                    p = node.nodeType === 3 ? node.parentNode : node;
                    while (p && p !== editor && p.tagName !== 'P' && p.tagName !== 'DIV') p = p.parentNode;
                }
                if (!p || p === editor) {
                    if (node.nodeType === 3 && node.parentNode === editor) {
                        var textNode = node;
                        var charOff = sel.anchorOffset;
                        var wrapDiv = document.createElement('div');
                        textNode.parentNode.insertBefore(wrapDiv, textNode);
                        wrapDiv.appendChild(textNode);
                        p = wrapDiv;
                        try {
                            var r = document.createRange();
                            r.setStart(textNode, Math.min(charOff, textNode.textContent.length));
                            r.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(r);
                            range = sel.getRangeAt(0);
                        } catch(e) {}
                    } else {
                        return;
                    }
                }
                if (_npIsProtectedLiveFormatPara(p)) return;
                if (_npIsManualPara(p)) return;
                var text = p.textContent || '';
                var trimmed = text.replace(/^\s+|\s+$/g, '');
                if (_enterSplitInfo) {
                    var suffix = _enterSplitInfo.text.substring(_enterSplitInfo.offset);
                    if (text === suffix) { S._enterSplitInfo = null; _setParagraphFormat(p, 'level-body'); return; }
                    S._enterSplitInfo = null;
                }
                if (!trimmed) {
                    /* 空段（通常是 Enter 新起的一行）要连同浏览器克隆过来的内联 span 一起清掉，
                       否则后续输入仍会落进上一段的楷体/黑体 span 里。 */
                    _setParagraphFormat(p, 'level-body');
                    p.innerHTML = '<br>';
                    try {
                        var emptyRange = document.createRange();
                        emptyRange.setStart(p, 0);
                        emptyRange.collapse(true);
                        var emptySel = window.getSelection();
                        emptySel.removeAllRanges();
                        emptySel.addRange(emptyRange);
                    } catch (e0) {}
                    return;
                }
                var hk = _notepadMatchHK(trimmed);
                if (!hk) {
            var regChRe = /^(第[一二三四五六七八九十百千万亿○零〇]+)(编|章|节)(?:\s+|　|$)/;
                    var regChMatch = trimmed.match(regChRe);
                    if (regChMatch && '，、；。：！？…'.indexOf(trimmed.charAt(trimmed.length - 1)) === -1 && trimmed.length <= 50) {
                        var editor2 = document.getElementById('notepadEditor');
                        var prevSame2 = false, nextSame2 = false;
                        if (editor2) {
                            var allPs2 = editor2.querySelectorAll('p');
                            for (var pi2 = 0; pi2 < allPs2.length; pi2++) {
                                if (allPs2[pi2] === p) {
                                    if (pi2 > 0) {
                                        var prevTxt2 = (allPs2[pi2 - 1].textContent || '').replace(/^\s+|\s+$/g, '');
                                        prevSame2 = !!prevTxt2.match(regChRe);
                                    }
                                    if (pi2 < allPs2.length - 1) {
                                        var nextTxt2 = (allPs2[pi2 + 1].textContent || '').replace(/^\s+|\s+$/g, '');
                                        nextSame2 = !!nextTxt2.match(regChRe);
                                    }
                                    break;
                                }
                            }
                        }
                        if (!prevSame2 && !nextSame2) {
                            var charOffset = _getCharOffset(p, range);
                            var regLevel = regChMatch[2] === '节' ? 'level-regulation-section' : 'level-regulation-chapter';
                            var regSpan = FORMAT_STANDARD.inlineStyle(regLevel);
                            p.setAttribute('style', 'font-family:' + (regLevel === 'level-regulation-section' ? '楷体_GB2312,楷体,KaiTi,serif' : '黑体,SimHei,sans-serif') + ';font-size:16px;font-weight:normal;text-align:center;text-indent:0;line-height:1.8;margin:0.5em 0;');
                            _npLiveFormatSetHtml(p, '<span style="' + regSpan + '">' + escapeHtml(text) + '</span>', text);
                            _setCursorAtCharOffset(p, charOffset);
                            return;
                        }
                    }
                    var charOffset = _getCharOffset(p, range);
                    _setParagraphFormat(p, 'level-body');
                    _npLiveFormatSetHtml(p, _formatBodyMaybeRegulationClause(text), text);
                    _setCursorAtCharOffset(p, charOffset);
                    return;
                }
                var level;
                if (hk === 'num-dun' || hk === 'cn-verb' || hk === 'cn-di') {
                    var prevLv = 0;
                    var _liveL2Seq = null;
                    var _liveL3Seq = null;
                    var _liveVerbSeq = null;
                    var _liveVerbLevel = 0;
                    var editor = document.getElementById('notepadEditor');
                    if (editor) {
                        var allPs = editor.querySelectorAll('p');
                        for (var pi = 0; pi < allPs.length; pi++) {
                            if (allPs[pi] === p) break;
                            var pt = (allPs[pi].textContent || '').replace(/^\s+|\s+$/g, '');
                            var phk = _notepadMatchHK(pt);
                            if (phk === 'num-dun' || phk === 'cn-di') {
                                var prevNumSeq = _npFmt_detectSeqStyle(pt);
                                if (prevNumSeq) {
                                    _liveL2Seq = prevNumSeq;
                                    _liveL3Seq = prevNumSeq;
                                }
                                var dlNumCheck = _detectHeadingDisplayLevel(allPs[pi]);
                                if (dlNumCheck !== null) prevLv = dlNumCheck;
                                continue;
                            }
                            if (phk === 'cn-verb') {
                                var prevVerbSeq = _npFmt_detectSeqStyle(pt);
                                if (prevVerbSeq) {
                                    var dlVerbCheck = _detectHeadingDisplayLevel(allPs[pi]);
                                    if (dlVerbCheck !== null) {
                                        _liveVerbSeq = prevVerbSeq;
                                        _liveVerbLevel = dlVerbCheck;
                                        prevLv = dlVerbCheck;
                                    }
                                }
                                continue;
                            }
                            var dl = _detectHeadingDisplayLevel(allPs[pi]);
                            if (dl !== null) {
                                prevLv = dl;
                            }
                        }
                    }
                    var _liveState = { parentHeadingLevel: prevLv, lastL2Seq: _liveL2Seq, lastL3Seq: _liveL3Seq, lastVerbSeq: _liveVerbSeq, lastVerbLevel: _liveVerbLevel };
                    if (hk === 'num-dun' || hk === 'cn-verb') {
                        var prevP = p.previousElementSibling;
                        while (prevP && prevP.tagName !== 'P') prevP = prevP.previousElementSibling;
                        if (prevP) {
                            var prevPTxt = (prevP.textContent || '').replace(/^\s+|\s+$/g, '');
                            var prevPHK = _notepadMatchHK(prevPTxt);
                         if (prevPHK === hk && _detectHeadingDisplayLevel(prevP) === null) {
                             var prevSeq = _npFmt_detectSeqStyle(prevPTxt);
                             var curSeq = _npFmt_detectSeqStyle(trimmed);
                             if (prevSeq && curSeq && prevSeq.kind === curSeq.kind && prevSeq.idx + 1 === curSeq.idx) {
                                 if (hk === 'cn-verb') {
                                     var prevVerbLevel = _detectHeadingDisplayLevel(prevP);
                                     level = prevVerbLevel === 3 ? 'level-3' : 'level-2';
                                 } else {
                                     level = 'level-body';
                                 }
                             }
                         }
                        }
                    }
                    if (!level) {
                        level = _npFmt_decideHeadingCtx('heading_ctx', hk, text, trimmed, _liveState);
                    }
                } else {
                    level = (hk === 'cn-dun') ? 'level-1' : 'level-2';
                }
                var forcedLv = p.getAttribute('data-autoformat-heading');
                if (forcedLv) {
                    var lvMap = { '1': 'level-1', '2': 'level-2', '3': 'level-3' };
                    if (lvMap[forcedLv]) level = lvMap[forcedLv];
                }
                var split = (hk === 'cn-verb') ? _npSplitCnHeadingText(text) : extractFirstSentence(text);
                var hi = FORMAT_STANDARD.inlineStyle(level);
                if (!split.rest) {
                    var charOffset = _getCharOffset(p, range);
                    _setParagraphFormat(p, level);
                    _npLiveFormatSetHtml(p, '<span style="' + hi + '">' + escapeHtml(text) + '</span>', text);
                    _setCursorAtCharOffset(p, charOffset);
                    return;
                }
                var charOffset = _getCharOffset(p, range);
                _setParagraphFormat(p, level);
                var restCnLevel = level === 'level-1' ? 'level-2' : 'level-3';
                _npLiveFormatSetHtml(p, '<span style="' + hi + '">' + escapeHtml(split.sentence) + '</span>' + (level === 'level-body' ? _formatRestBody(split.rest, restCnLevel) : _plainBodySpan(split.rest, restCnLevel)), text);
                _setCursorAtCharOffset(p, charOffset);
            } catch(e) { console.error('_applyLiveFormat error:', e); }
        }
        /* 粘贴之后按纯文本重新落段，再按自动格式整理：
           网页 / Word 带进来的背景色、字体、图片、行内样式一律不保留，避免粘完版面乱掉。 */
        function _npFormatPastedPara(p) {
            if (!p || p.nodeType !== 1 || p.tagName !== 'P') return;
            var ed = document.getElementById('notepadEditor');
            if (!ed) return;
            if (p.getAttribute('data-outline-level') === '1' || p.getAttribute('data-level') === 'title' ||
                p.getAttribute('data-level') === 'date' || p.getAttribute('data-level') === 'author') return;
            var imgs = p.querySelectorAll('img');
            if (imgs.length) {
                /* 带图片的段落按「独占图片段」处理：文字保留，图片保留，只清掉其它内联装饰 */
                for (var mi = 0; mi < imgs.length; mi++) {
                    var img = imgs[mi];
                    img.removeAttribute('width');
                    img.removeAttribute('height');
                    img.setAttribute('draggable', 'false');
                    if (img.parentNode !== p) { p.appendChild(img); }
                }
            }
            var text = (p.textContent || '').replace(/\u00a0/g, ' ');
            if (!text.replace(/[\s\u00a0\u200b]/g, '')) {
                if (imgs.length) p.style.setProperty('text-indent', '0');
                return;
            }
            p.removeAttribute('data-manual');
            p.removeAttribute('data-autoformat-heading');
            var mans = p.querySelectorAll('[data-manual="1"],[data-manual-span="1"],[data-manual-level]');
            for (var k = 0; k < mans.length; k++) {
                mans[k].removeAttribute('data-manual');
                mans[k].removeAttribute('data-manual-span');
                mans[k].removeAttribute('data-manual-level');
            }
            /* 去掉网页/Word 带来的内联色、背景、行内字体，只留纯文本 */
            var inner = p.querySelectorAll('[style],[color],[bgcolor],[class]');
            for (var si = 0; si < inner.length; si++) {
                var el = inner[si];
                if (el.tagName === 'IMG') continue;
                el.removeAttribute('style');
                el.removeAttribute('color');
                el.removeAttribute('bgcolor');
                el.removeAttribute('class');
            }
            if (imgs.length) return;
            /* 纯文字：段落里的 span/strong 等全部摊平成文本，再交给自动格式重新排版 */
            var flat = document.createElement('p');
            flat.textContent = text;
            p.innerHTML = '';
            while (flat.firstChild) p.appendChild(flat.firstChild);
            try { _applyLiveFormat(p); } catch (e1) {}
        }
        /* ===== 粘贴字号整体缩放 =====
           WPS / Word 整篇复制进来时，字号往往比公文基准大或小（标题二号、正文三号…），
           但字体和层级是对的。这里按「文章标题 → 一级标题 → 二级标题 → 正文」的顺序
           找基准段，用它的原字号和 FORMAT_STANDARD 的目标字号算出比例，再把粘入内容里
           所有绝对字号统一乘一遍。只写 font-size，字体、加粗、data-* 层级标记一律不动。 */
        var _NP_PASTE_SCALE_MIN = 0.4;
        var _NP_PASTE_SCALE_MAX = 4;
        function _npPasteFontPx(v) {
            if (v == null || v === '') return 0;
            if (typeof v === 'number') return isFinite(v) && v > 0 ? v : 0;
            var m = String(v).replace(/\s+/g, '').match(/^(\d*\.?\d+)(px|pt|pc|em|rem|%|in|cm|mm)?$/i);
            if (!m) return 0;
            var n = parseFloat(m[1]);
            if (!isFinite(n) || n <= 0) return 0;
            var u = (m[2] || 'px').toLowerCase();
            var k = { px: 1, pt: 96 / 72, pc: 16, em: 16, rem: 16, '%': 0.16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 };
            return n * (k[u] || 1);
        }
        function _npPasteInlineFontPx(el) {
            if (!el || el.nodeType !== 1) return 0;
            var raw = '';
            try { raw = el.style && el.style.fontSize; } catch (e) {}
            if (!raw) {
                var st = el.getAttribute && el.getAttribute('style');
                if (st) { var mm = st.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/i); if (mm) raw = mm[1]; }
            }
            if (!raw || /^(inherit|initial|unset|revert)$/i.test(String(raw).trim())) return 0;
            return _npPasteFontPx(raw);
        }
        function _npPasteFontAttrPx(v) {
            var n = parseInt(v, 10);
            return (n >= 1 && n <= 7) ? [10, 13, 16, 18, 24, 32, 48][n - 1] : 0;
        }
        function _npPasteTextSize(el) {
            var best = 0, bestLen = -1;
            if (!el || !el.querySelectorAll) return 0;
            var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
            while (walker.nextNode()) {
                var tn = walker.currentNode;
                var txt = (tn.textContent || '').replace(/[\s\u00a0\u200b]/g, '');
                if (!txt || !tn.parentNode || tn.parentNode.nodeType !== 1) continue;
                var px = 0;
                try { px = parseFloat(window.getComputedStyle(tn.parentNode).fontSize) || 0; } catch (e) {}
                if (px > 0 && txt.length > bestLen) { best = px; bestLen = txt.length; }
            }
            if (!best) { try { best = parseFloat(window.getComputedStyle(el).fontSize) || 0; } catch (e2) {} }
            return best || 0;
        }
        function _npPasteStdPx(level) {
            var lv = (window.FORMAT_STANDARD && FORMAT_STANDARD.levels) ? FORMAT_STANDARD.levels[level] : null;
            return (lv && _npPasteFontPx(lv.fontSize)) || 16;
        }
        function _npPasteTitleLike(text) {
            if (!text || text.length > 60) return false;
            if (/[。；;，,、]$/.test(text)) return false;
            if (/[。；]/.test(text.slice(0, -1))) return false;
            if (/^(附件|主题词|抄送|印发|签发)/.test(text)) return false;
            if (typeof _notepadMatchHK === 'function' && _notepadMatchHK(text)) return false;
            return true;
        }
        /* 取这次粘贴真正新增的「最外层块」，按文档顺序排好做字号采样 */
        function _npPasteNewBlocks(editor, newEls) {
            var set = (typeof Set === 'function') ? new Set(newEls) : null;
            var seen = [], out = [];
            for (var i = 0; i < newEls.length; i++) {
                var el = newEls[i];
                if (!el || el.nodeType !== 1 || !editor.contains(el)) continue;
                var top = el;
                while (top.parentNode && top.parentNode !== editor && (!set || set.has(top.parentNode))) top = top.parentNode;
                if (seen.indexOf(top) !== -1) continue;
                seen.push(top);
                out.push(top);
            }
            out.sort(function (a, b) { return (a.compareDocumentPosition(b) & 4) ? -1 : 1; });
            return out;
        }
        /* 返回 { scale, level, from, to, changed }；不改尺寸时返回 null 或 scale=1 */
        function _npNormalizePastedFontScale(blocks, beforeEls) {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return null;
            var newEls = [], i, j;
            if (beforeEls && typeof beforeEls.has === 'function') {
                var all = editor.querySelectorAll('*');
                for (i = 0; i < all.length; i++) if (!beforeEls.has(all[i])) newEls.push(all[i]);
            } else {
                var src = blocks || [];
                for (i = 0; i < src.length; i++) {
                    if (!src[i] || src[i].nodeType !== 1) continue;
                    newEls.push(src[i]);
                    var kids = src[i].querySelectorAll ? src[i].querySelectorAll('*') : [];
                    for (j = 0; j < kids.length; j++) newEls.push(kids[j]);
                }
            }
            if (!newEls.length) return null;
            /* 纯文本粘贴没有字号可调，别动 */
            var hasAbs = false;
            for (i = 0; i < newEls.length; i++) {
                if (_npPasteInlineFontPx(newEls[i]) ||
                    (newEls[i].tagName === 'FONT' && _npPasteFontAttrPx(newEls[i].getAttribute('size')))) { hasAbs = true; break; }
            }
            if (!hasAbs) return null;
            var blockList = _npPasteNewBlocks(editor, newEls);
            var measured = [], totalChars = 0;
            for (i = 0; i < blockList.length; i++) {
                var b = blockList[i];
                var txt = (b.textContent || '').replace(/[\s\u00a0\u200b]/g, '');
                if (!txt) continue;
                totalChars += txt.length;
                var px = _npPasteTextSize(b);
                if (px > 0) measured.push({ el: b, text: txt, size: px });
            }
            if (!measured.length) return null;
            /* 单个短句的零散粘贴不算整篇，不缩放 */
            if (measured.length < 2 && totalChars < 30) return null;
            var base = _npPickPasteBaseline(measured);
            if (!base) return null;
            var scale = base.target / base.size;
            if (!isFinite(scale) || scale <= 0) return null;
            scale = Math.max(_NP_PASTE_SCALE_MIN, Math.min(_NP_PASTE_SCALE_MAX, scale));
            if (Math.abs(scale - 1) < 0.05) return { scale: 1, level: base.level, from: base.size, to: base.target, changed: 0 };
            var changed = 0;
            for (i = 0; i < newEls.length; i++) if (_npScalePastedElFont(newEls[i], scale)) changed++;
            return { scale: scale, level: base.level, from: base.size, to: base.target, changed: changed };
        }
        function _npPickPasteBaseline(measured) {
            var i, firstL1 = null, firstL2 = null;
            for (i = 0; i < measured.length; i++) {
                var hk = (typeof _notepadMatchHK === 'function') ? _notepadMatchHK(measured[i].text) : null;
                if (!firstL1 && hk === 'cn-dun') firstL1 = measured[i];
                if (!firstL2 && (hk === 'cn-verb' || hk === 'num-dun')) firstL2 = measured[i];
            }
            if (measured.length >= 2) {
                var maxRec = measured[0], maxOther = 0;
                for (i = 1; i < measured.length; i++) if (measured[i].size > maxRec.size) maxRec = measured[i];
                for (i = 0; i < measured.length; i++) if (measured[i] !== maxRec) maxOther = Math.max(maxOther, measured[i].size);
                if (_npPasteTitleLike(maxRec.text) && maxRec.size >= maxOther * 1.06) {
                    return { level: 'level-title', size: maxRec.size, target: _npPasteStdPx('level-title') };
                }
            }
            if (firstL1) return { level: 'level-1', size: firstL1.size, target: _npPasteStdPx('level-1') };
            if (firstL2) return { level: 'level-2', size: firstL2.size, target: _npPasteStdPx('level-2') };
            return { level: 'level-body', size: measured[0].size, target: _npPasteStdPx('level-body') };
        }
        function _npScalePastedElFont(el, scale) {
            if (!el || el.nodeType !== 1) return false;
            var tag = el.tagName;
            if (tag === 'IMG' || tag === 'BR' || tag === 'HR') return false;
            var px = _npPasteInlineFontPx(el);
            var fromAttr = false;
            if (!px && tag === 'FONT') {
                px = _npPasteFontAttrPx(el.getAttribute('size'));
                fromAttr = !!px;
            }
            if (!px) return false;
            var next = Math.round(px * scale * 2) / 2;
            if (next < 6) next = 6;
            if (next > 96) next = 96;
            try {
                if (fromAttr) el.removeAttribute('size');
                el.style.fontSize = next + 'px';
            } catch (e) { return false; }
            return true;
        }
        window._npNormalizePastedFontScale = _npNormalizePastedFontScale;
        // Parenthetical phrases that are normal body text, not small annotations.
        // Add new stable phrases here when they are confirmed.
        var _notepadBodyParenExceptions = [
            /* 组织 / 主体并列：括号里是对前文的补充说明，不是小字注释 */
            '党委（党组）', '党委（党工委）', '党委（党支部）', '党委（支部）',
            '党组', '党委', '党工委', '党支部', '支部',
            '国家（地区）', '地区', '国家',
            '国务院（办公厅）', '办公厅',
            '人民代表大会（常委会）', '常委会',
            '中国人民政治协商会议（政协）', '政协',
            '纪律检查委员会（纪委监委）', '纪委监委',
            /* 行政区划 / 层级并列 */
            '自治区、直辖市', '省（自治区、直辖市）', '自治区', '直辖市',
            '市（地、州、盟）', '县（市、区、旗）', '乡镇（街道）', '村（社区）',
            '市、区', '县、区', '乡、镇', '街道', '社区',
            /* 单位 / 人员 / 范围 */
            '部门（单位）', '机关（事业单位）', '企业（含个体工商户）',
            '领导（干部）', '党员（干部）', '职工（群众）', '居民（村民）',
            '部门', '单位', '机关', '事业单位', '企业', '个人', '家庭',
            '干部', '群众', '职工', '居民', '村民',
            /* 学历 / 条件补充 */
            '本科（含）以上', '专科（含）以上', '硕士（含）以上', '博士（含）以上',
            '本科', '专科', '硕士', '博士',
            /* 释义性括号 */
            '以下简称', '下称', '以下称', '包括', '不包括', '含', '不含',
            '其中包括', '其中不包括', '其中', '即', '指', '简称', '统称'
        ];
        function _notepadIsBodyParenException(value) {
            var t = (value || '').replace(/^\s+|\s+$/g, '');
            var inner = t.replace(/^[（(]|[）)]$/g, '').replace(/\s+/g, '');
            if (!inner) return false;
            for (var i = 0; i < _notepadBodyParenExceptions.length; i++) {
                var raw = String(_notepadBodyParenExceptions[i] || '').replace(/\s+/g, '');
                if (!raw) continue;
                /* 整条比对（如「自治区、直辖市」「党组」） */
                var flat = raw.replace(/[（）()]/g, '');
                if (inner === flat) return true;
                /* 「党委（党组）」这种：括号内容单独命中「党组」也算 */
                var open = raw.search(/[（(]/);
                if (open >= 0) {
                    var after = raw.substring(open + 1).replace(/[）)]/g, '');
                    if (after && inner === after) return true;
                    var before = raw.substring(0, open);
                    if (before && inner === before) return true;
                }
                /* 兼容「以下简称××」这类前缀写法，但不再做任意位置包含匹配 */
                if (flat.length >= 2 && inner.indexOf(flat) === 0) return true;
            }
            return false;
        }
        /* 「一是 / 二是」这类标记算不算新层级起点：
           段首、或句号/分号/冒号/问号/感叹号之后 → 一定算；
           逗号、顿号之后，只有当这一小句是「≤40 字的短句 + 句末标点」时才算。
           这样「3月份以来，一是服务国产平台。」能当场认成二级标题，
           而「在干一件、成一件中」这种句子中间的标记仍留在正文里。 */
        function _npCnMarkAllowed(text, idx) {
            if (!idx) return true;
            var t = String(text || '');
            var prev = t.charAt(idx - 1);
            if (/[\s。；：！？．…]/.test(prev)) return true;
            if (!/[，,、]/.test(prev)) return false;
            for (var i = idx; i < t.length; i++) {
                if (/[。；！？．…]/.test(t.charAt(i))) return (i - idx) <= 40;
            }
            return false;
        }

        function _formatBodyWithRemarks(text, cnLevel) {
            var sb = FORMAT_STANDARD.inlineStyle('level-body');
            var sr = FORMAT_STANDARD.inlineStyle('level-remark');
            var sc = FORMAT_STANDARD.inlineStyle(cnLevel || 'level-3');
            var pos = [];
            var reParen = /（([^）]{2,})）|\(([^)]{2,})\)/g, mP;
            while ((mP = reParen.exec(text)) !== null) {
                if (/^(?:（\s*\d{4}年\d{1,2}月\d{1,2}日\s*）|\(\s*\d{4}年\d{1,2}月\d{1,2}日\s*\))$/.test(mP[0]) || _notepadIsBodyParenException(mP[0])) continue;
                pos.push({ i: mP.index, t: 'paren', v: mP[0] });
            }
            var reN = /(\d+)[.、．]/g, mN;
            while ((mN = reN.exec(text)) !== null) {
                if (mN.index === 0 || /[\s。；：,，、．]/.test(text.charAt(mN.index - 1))) pos.push({ i: mN.index, t: 'num' });
            }
            var reC = /([一二三四五六七八九十]+)[是要看抓查学紧盯聚焦]/g, mC;
            while ((mC = reC.exec(text)) !== null) {
                /* 段首 / 句末标点后必然算；逗号、顿号后仅限短句（见 _npCnMarkAllowed） */
                if (_npCnMarkAllowed(text, mC.index)) pos.push({ i: mC.index, t: 'cn' });
            }
            if (!pos.length) return '<span style="' + sb + '">' + escapeHtml(text) + '</span>';
            pos.sort(function(a, b) { return a.i - b.i; });
            var h = '', li = 0;
            for (var pi = 0; pi < pos.length; pi++) {
                var p = pos[pi];
                if (p.i < li) continue;
                if (p.i > li) h += '<span style="' + sb + '">' + escapeHtml(text.substring(li, p.i)) + '</span>';
                if (p.t === 'paren') {
                    h += '<span style="' + sr + '">' + escapeHtml(p.v) + '</span>';
                    li = p.i + p.v.length;
                } else {
                    var segEnd = pi + 1 < pos.length ? pos[pi + 1].i : text.length;
                    var seg = text.substring(p.i, segEnd);
                    var sp = (p.t === 'cn') ? _npSplitCnHeadingText(seg) : extractFirstSentenceL3(seg);
                    h += '<span style="' + sc + '">' + escapeHtml(sp.sentence) + '</span>';
                    if (sp.rest) h += '<span style="' + sb + '">' + escapeHtml(sp.rest) + '</span>';
                    li = segEnd;
                }
            }
            if (li < text.length) h += '<span style="' + sb + '">' + escapeHtml(text.substring(li)) + '</span>';
            return h;
        }
        function _formatRestBody(rest, cnLevel) {
            if (!rest) return '';
            var sc = FORMAT_STANDARD.inlineStyle(cnLevel || 'level-3'), sb = FORMAT_STANDARD.inlineStyle('level-body');
            var pos = [];
            var _reN = /(\d+)[.、．]/g, _m;
            while ((_m = _reN.exec(rest)) !== null) {
                if (_m.index === 0 || /[\s。；：,，、．]/.test(rest.charAt(_m.index - 1))) pos.push({ i: _m.index, t: 'n' });
            }
            var _reC = /([一二三四五六七八九十]+)[是要看抓查学紧盯聚焦]/g, _m2;
            while ((_m2 = _reC.exec(rest)) !== null) {
                if (_npCnMarkAllowed(rest, _m2.index)) pos.push({ i: _m2.index, t: 'c' });
            }
            if (!pos.length) return _formatBodyWithRemarks(rest, cnLevel);
            pos.sort(function(a, b) { return a.i - b.i; });
            var h = '', li = 0;
            for (var pi = 0; pi < pos.length; pi++) {
                var p = pos[pi];
                if (p.i > li) h += _formatRestBody(rest.substring(li, p.i), cnLevel);
                var segEnd = pi + 1 < pos.length ? pos[pi + 1].i : rest.length;
                var seg = rest.substring(p.i, segEnd);
                var sp = (p.t === 'c') ? _npSplitCnHeadingText(seg) : extractFirstSentenceL3(seg);
                h += '<span style="' + sc + '">' + escapeHtml(sp.sentence) + '</span>';
                if (sp.rest) h += _formatRestBody(sp.rest, cnLevel);
                li = segEnd;
            }
            if (li < rest.length) h += _formatRestBody(rest.substring(li), cnLevel);
            return h;
        }
        function _plainBodySpan(text, cnLevel) {
            if (!text) return '';
            return _formatBodyWithRemarks(text, cnLevel);
        }
        function _formatBodyMaybeRegulationClause(text) {
            text = (text || '').replace(/&nbsp;/gi, ' ').replace(/\u00a0/g, ' ');
            var regClauseRe = /^(第[一二三四五六七八九十百千万亿○零〇]+条)/;
            var m = text.match(regClauseRe);
            if (!m) return _formatBodyWithRemarks(text);
            var clause = m[1];
            var rest = text.substring(clause.length);
            var sReg = FORMAT_STANDARD.inlineStyle('level-regulation-chapter');
            if (rest.length === 0) return '<span style="' + sReg + '">' + escapeHtml(clause) + '</span>';
            var after = rest.replace(/^\s*/, '');
            var spacing = after.length < rest.length ? rest.substring(0, rest.length - after.length).replace(/\u00a0/g, ' ') : '  ';
            var spacedRest = spacing + after;
            return '<span style="' + sReg + '">' + escapeHtml(clause) + '</span>' + _formatBodyWithRemarks(spacedRest);
        }
        function _setNotepadAutoFormatEnabled(on, silent) {
            S._autoFormatEnabled = !!on;
            var icon = document.getElementById('notepadAutoFormatIcon');
            if (icon) icon.textContent = _autoFormatEnabled ? '☑' : '☐';
            var hint = document.getElementById('notepadAutoFormatHint');
            if (hint) hint.style.display = _autoFormatEnabled ? '' : 'none';
            if (!silent) showToast(_autoFormatEnabled ? '自动格式已打开' : '自动格式已关闭');
        }
          function toggleAutoFormat() {
             _setNotepadAutoFormatEnabled(!_autoFormatEnabled, false);
          }
          function autoRecognizeHeadings() {
             var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var ps = null;
            if (typeof _materialCurrentArticlePs === 'function') ps = _materialCurrentArticlePs(editor);
            if (!ps || !ps.length) ps = Array.prototype.slice.call(editor.querySelectorAll('p'));
            if (!ps.length) { showToast('没有可识别的段落'); return; }
            var count = 0;
             var ctx = { parentHeadingLevel: 0, lastHeadingLevel: 0, lastL2Seq: null, lastL3Seq: null, lastVerbSeq: null, lastVerbLevel: 0 };
            for (var i = 0; i < ps.length; i++) {
                var p = ps[i];
                var txt = (p.textContent || '').replace(/^\s+|\s+$/g, '');
                if (!txt || txt === '（空）' || txt === '(空)') continue;
                if (p.getAttribute('data-level') === 'date' || p.getAttribute('data-level') === 'author') continue;
                if (p.getAttribute('data-outline-level') === '1') continue;
                var existing = _detectHeadingDisplayLevel(p);
                if (existing !== null) {
                    p.setAttribute('data-ai-heading-level', String(existing));
                     if (existing === 1) { ctx.parentHeadingLevel = 1; ctx.lastHeadingLevel = 1; ctx.lastL3Seq = null; ctx.lastL2Seq = null; ctx.lastVerbSeq = null; ctx.lastVerbLevel = 0; }
                     else if (existing === 2) { ctx.parentHeadingLevel = 2; ctx.lastHeadingLevel = 2; ctx.lastL3Seq = null; ctx.lastL2Seq = null; ctx.lastVerbSeq = null; ctx.lastVerbLevel = 0; }
                     else { ctx.lastHeadingLevel = 3; ctx.lastVerbSeq = _npFmt_detectSeqStyle(txt) || ctx.lastVerbSeq; ctx.lastVerbLevel = 3; ctx.lastL3Seq = _npFmt_detectSeqStyle(txt) || ctx.lastL3Seq; }
                    continue;
                }
                p.removeAttribute('data-ai-heading-level');
                var hk = _notepadMatchHK(txt);
                var aiLv = 0;
                if (!hk) continue;
                if (hk === 'cn-dun') aiLv = 1;
                else if (hk === 'cn-paren') aiLv = 2;
                else if (hk === 'cn-di') aiLv = 2;
                else {
                    var dec = _npFmt_decideHeadingCtx('heading_ctx', hk, txt, txt, ctx);
                    if (dec === 'level-1') aiLv = 1;
                    else if (dec === 'level-2') aiLv = 2;
                    else if (dec === 'level-3') aiLv = 3;
                }
                if (!aiLv) continue;
                 if (hk === 'cn-verb' || hk === 'num-dun' || hk === 'cn-di') {
                     var forcedSeq = _npFmt_detectSeqStyle(txt);
                     if (aiLv === 2) { ctx.parentHeadingLevel = 2; ctx.lastHeadingLevel = 2; ctx.lastL3Seq = null; ctx.lastL2Seq = forcedSeq || ctx.lastL2Seq; ctx.lastVerbSeq = forcedSeq || ctx.lastVerbSeq; ctx.lastVerbLevel = 2; }
                     else if (aiLv === 3) { ctx.lastHeadingLevel = 3; ctx.lastL3Seq = forcedSeq || ctx.lastL3Seq; ctx.lastVerbSeq = forcedSeq || ctx.lastVerbSeq; ctx.lastVerbLevel = 3; }
                 } else if (aiLv === 1) { ctx.parentHeadingLevel = 1; ctx.lastHeadingLevel = 1; ctx.lastL3Seq = null; ctx.lastL2Seq = null; ctx.lastVerbSeq = null; ctx.lastVerbLevel = 0; }
                 else if (aiLv === 2) { ctx.parentHeadingLevel = 2; ctx.lastHeadingLevel = 2; ctx.lastL3Seq = null; ctx.lastL2Seq = null; ctx.lastVerbSeq = null; ctx.lastVerbLevel = 0; }
                p.setAttribute('data-ai-heading-level', String(aiLv));
                count++;
            }
            saveCurrentEditor();
            if (_materialMode) _renderMaterialOutline();
            else { var olm = document.getElementById('notepadOutlineModal'); if (olm && olm.classList.contains('show')) _notepadOutlineRenderStruct(); }
            _materialMirrorSync();
            showToast(count ? ('已识别 ' + count + ' 个标题') : '未发现新的标题');
        }
         function convertNotepadArticleFormat(mode) {
             var editor = document.getElementById('notepadEditor');
            if (!editor) return;
             var ps = typeof _materialCurrentArticlePs === 'function' ? _materialCurrentArticlePs(editor) : Array.prototype.slice.call(editor.querySelectorAll('p'));
             if (!ps || !ps.length) { showToast('本篇没有可转换的内容'); return; }
             var large = mode === 'large';
              function kindOf(p) {
                  var stored = p.getAttribute('data-format-kind');
                  var dl = p.getAttribute('data-level');
                  var text = (p.textContent || '').trim();
                  var ff = (p.style.fontFamily || '').replace(/[\'\"]/g, '').toLowerCase();
                  var fs = p.style.fontSize || '';
                   if (stored === 'date' || stored === 'author' || dl === 'date' || dl === 'author') return stored === 'author' || dl === 'author' ? 'author' : 'date';
                    if (dl === 'date' || /^(?:（\s*\d{4}年\d{1,2}月\d{1,2}日\s*）|\(\s*\d{4}年\d{1,2}月\d{1,2}日\s*\))$/.test(text)) return 'date';
                    if (dl === 'author') return 'author';
                   if (dl === 'secret') return 'level-secret';
                   if (dl === 'attachment') return 'level-attachment';
                  if (dl === 'recipient' || /^主送单位[：:]/.test(text)) return 'recipient';
                  if (dl === 'title' || ff.indexOf('小标宋') !== -1 || ff.indexOf('fzxiaobiaosong') !== -1) return 'title';
                  var hk = typeof _notepadMatchHK === 'function' ? _notepadMatchHK(text) : null;
                  if (hk === 'cn-dun') return 'level-1';
                  if (hk === 'cn-paren') return 'level-2';
                  if (hk === 'cn-verb') {
                      var seq = typeof _npFmt_detectSeqStyle === 'function' ? _npFmt_detectSeqStyle(text) : null;
                      var all = p.parentNode ? p.parentNode.querySelectorAll('p') : [];
                      var pi = -1;
                      for (var ai = 0; ai < all.length; ai++) if (all[ai] === p) { pi = ai; break; }
                      for (var bi = pi - 1; bi >= 0; bi--) {
                          var prevText = (all[bi].textContent || '').trim();
                          if (_notepadMatchHK(prevText) === 'cn-verb') {
                              var prevSeq = _npFmt_detectSeqStyle(prevText);
                              if (!seq || !prevSeq || prevSeq.kind !== seq.kind || prevSeq.idx + 1 !== seq.idx) break;
                              var prevKind = all[bi].getAttribute('data-format-kind');
                              if (prevKind === 'level-2' || prevKind === 'level-3') return prevKind;
                              var prevLv = _detectHeadingDisplayLevel(all[bi]);
                              if (prevLv === 2 || prevLv === 3) return 'level-' + prevLv;
                          }
                      }
                      var parentLevel = 1;
                      for (var ci = pi - 1; ci >= 0; ci--) {
                          var prior = all[ci];
                          var priorKind = prior.getAttribute('data-format-kind');
                          var priorLv = _detectHeadingDisplayLevel(prior);
                          if (priorKind === 'level-3' || priorLv === 3) { parentLevel = 2; break; }
                          if (priorKind === 'level-2' || priorKind === 'level-1' || priorLv === 1 || priorLv === 2) { parentLevel = priorLv === 2 || priorKind === 'level-2' ? 2 : 1; break; }
                      }
                      return parentLevel <= 1 ? 'level-2' : 'level-3';
                  }
                   if (stored && stored !== 'body') return stored;
                  if (ff.indexOf('黑体') !== -1 || ff.indexOf('simhei') !== -1) return 'level-1';
                  if ((ff.indexOf('楷体') !== -1 || ff.indexOf('kaiti') !== -1) && (fs === '14px' || fs === '14pt')) return 'remark';
                  if (ff.indexOf('楷体') !== -1 || ff.indexOf('kaiti') !== -1) return 'level-2';
                  if (ff.indexOf('仿宋') !== -1 || ff.indexOf('fangsong') !== -1) return (p.style.fontWeight || '').toLowerCase() === 'bold' ? 'level-3' : 'body';
                   if (((/^（[^（）]{1,80}）$/.test(text) || /^\([^()]{1,80}\)$/.test(text)) && !_notepadIsBodyParenException(text)) || /^【[^】]{1,80}】$/.test(text)) return 'remark';
                  return 'body';
              }
             function normalStyle(kind) {
                  var map = { title:'level-title', date:'level-date', author:'level-author', recipient:'level-recipient', 'level-1':'level-1', 'level-2':'level-2', 'level-3':'level-3', body:'level-body', remark:'level-remark', 'level-secret':'level-secret', 'level-attachment':'level-attachment' };
                 return FORMAT_STANDARD.levels[map[kind]] || FORMAT_STANDARD.levels['level-body'];
             }
             function cssFor(style, align, indent, lineHeight) {
                  var ff = style.fontFamily || '仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif';
                  var fs = style.fontSize || '16px';
                  var fw = style.fontWeight || 'normal';
                  var ta = align || style.textAlign || 'left';
                  var ti = indent || style.textIndent || '0';
                  var lh = lineHeight || '1.8';
                  return 'font-family:' + ff + ';font-size:' + fs + ';font-weight:' + fw + ';text-align:' + ta + ';text-indent:' + ti + ';line-height:' + lh + ';margin:0;';
              }
             function convertRemarkText(text) {
                 if (large) return text.replace(/^\(([^()]{1,80})\)$/, '【$1】').replace(/^（([^（）]{1,80})）$/, '【$1】');
                 return text.replace(/^【([^】]{1,80})】$/, '（$1）');
             }
               function transformInlineHtml(html, toLarge, paragraphKind, paragraphFont) {
                   var box = document.createElement('div');
                   if (paragraphFont) box.style.fontFamily = paragraphFont;
                   box.innerHTML = html;
                  function sizeOf(style) { return parseFloat(style.fontSize || '') || 0; }
                  function walk(node, inherited) {
                      if (node.nodeType === 3) {
                          if ((node.nodeValue || '').trim()) {
                              var st = node.parentNode && node.parentNode.style ? node.parentNode.style : inherited;
                              var ff = (st.fontFamily || inherited.fontFamily || '').replace(/[\'\"]/g, '').toLowerCase();
                               var parentBold = node.parentNode && node.parentNode.style && (node.parentNode.style.fontWeight === 'bold' || node.parentNode.style.fontWeight === '700');
                               var headingFont = paragraphKind === 'level-1' ? 'font-family:黑体,SimHei,sans-serif;' : paragraphKind === 'level-2' ? 'font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;' : paragraphKind === 'level-3' && parentBold ? 'font-family:黑体,SimHei,sans-serif;' : '';
                               var css = '';
                               if (toLarge) {
                                   if (paragraphKind === 'date' || paragraphKind === 'author') css = 'font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;font-size:18px;';
                                   else if (headingFont) css = headingFont + 'font-size:18px;';
                                   else css = 'font-family:宋体,SimSun,serif;font-size:18px;';
                                   node.parentNode.setAttribute('style', css + 'font-weight:' + (parentBold ? 'bold' : 'normal') + ';');
                               } else {
                                   if (paragraphKind === 'date' || paragraphKind === 'author') css = 'font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;font-size:16px;';
                                   else if (headingFont) css = headingFont + 'font-size:16px;';
                                   else if (ff.indexOf('楷体') !== -1 || ff.indexOf('kaiti') !== -1) css = 'font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;font-size:16px;';
                                   else css = 'font-family:仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif;font-size:16px;';
                                   node.parentNode.setAttribute('style', css + 'font-weight:' + (parentBold ? 'bold' : 'normal') + ';');
                               }
                          }
                          return;
                      }
                      if (node.nodeType !== 1) return;
                      var own = node.style || inherited;
                      var kids = Array.prototype.slice.call(node.childNodes);
                      for (var k = 0; k < kids.length; k++) walk(kids[k], own);
                  }
                  var roots = Array.prototype.slice.call(box.childNodes);
                  for (var i = 0; i < roots.length; i++) walk(roots[i], box.style);
                  return box.innerHTML;
              }
              for (var i = 0; i < ps.length; i++) {
                  var p = ps[i];
                  var kind = kindOf(p);
                  var text = (p.textContent || '').replace(/\u200b/g, '');
                  if (!text.trim()) continue;
                  var align = p.style.textAlign || '';
                  var indent = p.style.textIndent || '';
                  var oldHtml = p.innerHTML;
                  if (kind === 'remark') text = convertRemarkText(text);
                  var style = normalStyle(kind);
                  var lineHeight = large ? (kind === 'date' || kind === 'author' ? '28.6pt' : '31.5pt') : '1.8';
                  if (large) {
                      style = { fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight:'bold', textAlign:align, textIndent:indent };
                  }
                  p.setAttribute('data-format-kind', kind);
                  p.setAttribute('data-format-source-font', (normalStyle(kind).fontFamily || '').toLowerCase());
                  p.setAttribute('style', cssFor(style, align, indent, lineHeight));
                  p.removeAttribute('data-ai-heading-level');
                  p.removeAttribute('data-manual');
                  p.removeAttribute('data-autoformat-heading');
                  if (kind === 'title') { p.setAttribute('data-level', 'title'); p.removeAttribute('data-outline-level'); }
                  else if (kind === 'date') { p.setAttribute('data-level', 'date'); p.removeAttribute('data-outline-level'); }
                  else if (kind === 'author') { p.setAttribute('data-level', 'author'); p.removeAttribute('data-outline-level'); }
                  else if (kind === 'recipient') { p.setAttribute('data-level', 'recipient'); p.removeAttribute('data-outline-level'); }
                  else { p.removeAttribute('data-level'); if (kind === 'level-1') p.setAttribute('data-outline-level', '2'); else p.removeAttribute('data-outline-level'); }
                   if (large) {
                        p.innerHTML = transformInlineHtml(oldHtml, true, kind, style.fontFamily);
                       if (kind === 'level-3') {
                           p.setAttribute('data-large-l3', '1');
                       }
                       if (kind === 'remark') p.innerHTML = '<span style="font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;font-size:16px;font-weight:bold;">' + escapeHtml(text) + '</span>';
                   } else {
                       p.removeAttribute('data-large-l3');
                        p.innerHTML = transformInlineHtml(oldHtml, false, kind, style.fontFamily);
                      if (kind === 'remark') p.innerHTML = '<span style="font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;font-size:16px;font-weight:normal;">' + escapeHtml(text) + '</span>';
                  }
              }
             saveCurrentEditor();
             updateFooterTimestamp();
             _refreshOutlineIfOpen();
             if (_materialMode) _renderMaterialOutline();
             _materialMirrorSync();
             showToast(large ? '已转换为大字版' : '已转换为普通字号');
         }

        function _saveNotepadToCache() {
            try {
                var saveEditorData = [];
                for (var si = 0; si < npTabCount(); si++) {
                    var ed = notepadEditorData[si] || {html:'', bold:false};
                    var cleanHtml = ed.html;
                    if (cleanHtml) {
                        var tmp = document.createElement('div');
                        tmp.innerHTML = cleanHtml;
                        var hidden = tmp.querySelectorAll('p[data-dir-hidden="true"]');
                        for (var hi = 0; hi < hidden.length; hi++) {
                            hidden[hi].removeAttribute('data-dir-hidden');
                            hidden[hi].style.display = '';
                        }
                        cleanHtml = tmp.innerHTML;
                    }
                    saveEditorData[si] = {html: cleanHtml, bold: ed.bold};
                }
                DataLayer.set('notepadCache', {
                    titles: notepadTitles,
                    editorData: saveEditorData,
                    fontSizes: notepadFontSizes,
                    labels: notepadLabels,
                    notebookStyles: notepadNotebookStyles,
                    currentTab: currentNotepadTab,
                    currentDataFileName: currentDataFileName
                })
                DataLayer.set('notepadFontSizesCache', notepadFontSizes)
                var _npCacheOk = DataLayer.get('notepadCache');
                if (!_npCacheOk && !window._npCacheQuotaWarned) {
                    window._npCacheQuotaWarned = true;
                    console.error('[notepad] 笔记缓存写入失败，可能是浏览器存储空间不足');
                    if (typeof showToast === 'function') showToast('文稿缓存写入失败，请及时另存为文件');
                }
            } catch (e) { console.warn('[notepad] 保存笔记缓存异常:', e); }
        }
        function cleanEmptyReportData() {
            for (var k in reportData) {
                if (Array.isArray(reportData[k])) {
                    reportData[k] = reportData[k].filter(function(item) {
                        if (!item || !(item._pendingInsert || item.category || item.content)) return false;
                        // 内容为空的普通日志不留存（周工作分项、正在编辑的占位除外）
                        if (typeof window._logRecordEmpty === 'function' && window._logRecordEmpty(item)) return false;
                        return true;
                    });
                    if (reportData[k].length === 0) {
                        delete reportData[k];
                    }
                }
            }
        }
        function _saveReportToCache() {
            cleanEmptyReportData();
            try {
                DataLayer.set('reportDataCache', reportData)
            } catch (e) {}
        }
        var _notepadLastSearch = '';
        var _notepadHLIndex = -1;
        var _notepadSearchDrag = null;
        /* 检索框定位：默认贴在检索按钮右侧（右侧放不下就翻到左侧），
           宽度尽量大，但右缘不超过顶栏最右的折叠箭头按钮。
           拖动过以后（wrap.dataset.moved = '1'）就不再自动定位。 */
        function _notepadSearchWidthLimits() {
            var btn = document.getElementById('notepadSearchBtn');
            var grow = document.getElementById('zoomInBtn');
            var header = document.getElementById('mainHeader');
            var br = btn ? btn.getBoundingClientRect() : null;
            var gr = grow ? grow.getBoundingClientRect() : null;
            var hr = header ? header.getBoundingClientRect() : null;
            var rightLimit = gr ? gr.left - 10 : (window.innerWidth - 12);
            return { btn: br, grow: gr, header: hr, rightLimit: rightLimit };
        }

        function _notepadPositionSearchBox() {
            var wrap = document.getElementById('notepadSearchWrap');
            var btn = document.getElementById('notepadSearchBtn');
            if (!wrap || !btn) return;
            if (wrap.dataset.moved === '1') return;

            var lim = _notepadSearchWidthLimits();
            var rect = lim.btn;
            var hr = lim.header;

            var gap = 8;
            var minW = 380;
            var rightAvail = Math.max(0, lim.rightLimit - (rect.right + gap));
            var leftAvail = Math.max(0, rect.left - gap - 8);

            /* 默认放在检索按钮右侧；右侧实在放不下才翻到左侧 */
            var placeRight = rightAvail >= minW;
            var avail = placeRight ? rightAvail : leftAvail;
            var width = Math.min(avail, 640);
            if (width < minW) width = Math.min(minW, Math.max(avail, 240));

            wrap.style.width = Math.round(width) + 'px';
            wrap.style.maxWidth = Math.round(width) + 'px';

            var left = placeRight ? (rect.right + gap) : (rect.left - gap - width);
            wrap.style.left = Math.round(Math.max(8, left)) + 'px';

            var bh = wrap.offsetHeight || 36;
            var top = rect.top + (rect.height - bh) / 2;
            if (hr) top = Math.max(hr.top + 8, Math.min(hr.bottom - bh - 4, top));
            wrap.style.top = Math.round(top) + 'px';
        }
        function updateNotepadSearchWidth() {
            var input = document.getElementById('notepadSearchInput');
            var wrap = document.getElementById('notepadSearchWrap');
            if (!input || !wrap) return;
            /* 输入框自适应剩余空间（flex:1），不再写死宽度，避免撑破外壳 */
            input.style.width = '';
            input.style.minWidth = '0px';
        }
        function _bindNotepadSearchDrag() {
            var wrap = document.getElementById('notepadSearchWrap');
            if (!wrap || wrap._npDragBound) return;
            wrap._npDragBound = true;

            var state = null;
            var shouldDrag = function (t) {
                if (!t) return true;
                if (t.closest('.notepadSearchInput, input, button, label, .notepadSearchNav')) return false;
                return true;
            };

            wrap.addEventListener('mousedown', function (e) {
                if (e.button !== 0) return;
                if (!shouldDrag(e.target)) return;
                state = {
                    x: e.clientX,
                    y: e.clientY,
                    left: wrap.getBoundingClientRect().left,
                    top: wrap.getBoundingClientRect().top
                };
                wrap.classList.add('npDragging');
                e.preventDefault();
            });

            document.addEventListener('mousemove', function (e) {
                if (!state) return;
                var w = wrap.offsetWidth;
                var h = wrap.offsetHeight;
                var nx = Math.max(4, Math.min(window.innerWidth - w - 4, state.left + (e.clientX - state.x)));
                var ny = Math.max(4, Math.min(window.innerHeight - h - 4, state.top + (e.clientY - state.y)));
                wrap.style.left = Math.round(nx) + 'px';
                wrap.style.top = Math.round(ny) + 'px';
                wrap.dataset.moved = '1';
            });

            document.addEventListener('mouseup', function () {
                if (!state) return;
                state = null;
                wrap.classList.remove('npDragging');
            });
        }
        function closeNotepadSearch() {
            var wrap = document.getElementById('notepadSearchWrap');
            var btn = document.getElementById('notepadSearchBtn');
            var input = document.getElementById('notepadSearchInput');
            if (!wrap || !btn || !input) return;
            wrap.style.display = 'none';
            btn.classList.remove('active');
            input.value = '';
            _notepadLastSearch = '';
            var ed = document.getElementById('notepadEditor');
            if (ed) {
                var cleanHtml = notepadStripHighlights(ed.innerHTML);
                ed.innerHTML = cleanHtml;
                if (notepadEditorData[currentNotepadTab]) {
                    notepadEditorData[currentNotepadTab].html = cleanHtml;
                }
            }
            notepadHighlightTabs('');
            var filter = document.getElementById('notepadSearchFilter');
            if (filter) filter.checked = false;
            if (ed) {
                var ps = ed.querySelectorAll('p');
                for (var pi = 0; pi < ps.length; pi++) ps[pi].style.display = '';
            }
        }
        function toggleNotepadSearch(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            var btn = document.getElementById('notepadSearchBtn');
            var wrap = document.getElementById('notepadSearchWrap');
            var input = document.getElementById('notepadSearchInput');
            if (!btn || !wrap || !input) return;
            var isHidden = wrap.style.display === 'none' || getComputedStyle(wrap).display === 'none';
            if (isHidden) {
                wrap.style.display = 'flex';
                btn.classList.add('active');
                input.value = '';
                _notepadLastSearch = '';
                _notepadExpandAllTabsForSearch();
                notepadHighlightTabs('', true);
                updateNotepadSearchWidth();
                _notepadPositionSearchBox();
                _bindNotepadSearchDrag();
                /* 面板刚显示时中部三栏还在布局，等两帧后再定位一次，确保左缘对齐编辑区 */
                requestAnimationFrame(function () {
                    _notepadPositionSearchBox();
                    requestAnimationFrame(_notepadPositionSearchBox);
                });
                setTimeout(function() { input.focus(); }, 0);
            } else {
                closeNotepadSearch();
            }
        }
        function updateNotepadSearchCount() {
            var count = document.getElementById('notepadSearchCount');
            if (!count) return;
            var nav = document.getElementById('notepadSearchNav');
            if (!_notepadLastSearch) { count.textContent = ''; if (nav) nav.classList.remove('show'); return; }
            var hls = notepadCollectHighlights();
            var total = hls.length;
            if (total === 0) { count.textContent = '0/0'; if (nav) nav.classList.remove('show'); return; }
            var idx = Math.min(Math.max(_notepadHLIndex, 0), total - 1);
            count.textContent = (idx + 1) + '/' + total;
            if (nav) nav.classList.add('show');
        }
        function notepadCollectHighlights() {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return [];
            return Array.prototype.slice.call(editor.querySelectorAll('span.notepadSearchHL0, span.notepadSearchHL1, span.notepadSearchHL2, span.notepadSearchHL3, span.notepadSearchHL4'));
        }
        function notepadFocusHighlightAt(index) {
            var hls = notepadCollectHighlights();
            if (!hls.length) { updateNotepadSearchCount(); return false; }
            var allHL = document.getElementById('notepadEditor').querySelectorAll('span.notepadSearchHL0, span.notepadSearchHL1, span.notepadSearchHL2, span.notepadSearchHL3, span.notepadSearchHL4');
            for (var k = 0; k < allHL.length; k++) allHL[k].classList.remove('focused');
            if (index < 0) index = hls.length - 1;
            if (index >= hls.length) index = 0;
            _notepadHLIndex = index;
            var el = hls[index];
            el.classList.add('focused');
            updateNotepadSearchCount();
            try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { el.scrollIntoView(); }
            return true;
        }
        function notepadHasMatchInTab(idx) {
            if (!notepadEditorData[idx] || !notepadEditorData[idx].html) return false;
            return notepadEditorData[idx].html.indexOf('notepadSearchHL') !== -1;
        }
        function notepadSwitchToTabWithMatch(direction) {
            var start = currentNotepadTab;
            for (var step = 1; step <= 5; step++) {
                var ti = (start + direction * step + 5) % 5;
                if (notepadHasMatchInTab(ti)) {
                    switchNotepadTab(ti);
                    setTimeout(function() {
                        var hls = notepadCollectHighlights();
                        if (!hls.length) { updateNotepadSearchCount(); return; }
                        if (direction > 0) notepadFocusHighlightAt(0);
                        else notepadFocusHighlightAt(hls.length - 1);
                    }, 30);
                    return true;
                }
            }
            return false;
        }
        function notepadSearchNext() {
            var hls = notepadCollectHighlights();
            if (!hls.length) { updateNotepadSearchCount(); notepadSwitchToTabWithMatch(1); return; }
            if (_notepadHLIndex + 1 >= hls.length) {
                if (notepadSwitchToTabWithMatch(1)) return;
                notepadFocusHighlightAt(0);
            } else {
                notepadFocusHighlightAt(_notepadHLIndex + 1);
            }
        }
        function notepadSearchPrev() {
            var hls = notepadCollectHighlights();
            if (!hls.length) { updateNotepadSearchCount(); notepadSwitchToTabWithMatch(-1); return; }
            if (_notepadHLIndex - 1 < 0) {
                if (notepadSwitchToTabWithMatch(-1)) return;
                notepadFocusHighlightAt(hls.length - 1);
            } else {
                notepadFocusHighlightAt(_notepadHLIndex - 1);
            }
        }
        function notepadStripHighlights(html) {
            return (html || '').replace(/<span class="notepadSearchHL[0-4](?: focused)?">([\s\S]*?)<\/span>/g, '$1');
        }
        function _notepadExpandAllInHtml(html) {
            if (!html) return html || '';
            var tmp = document.createElement('div');
            tmp.innerHTML = html;
            var ps = tmp.querySelectorAll('p');
            for (var i = 0; i < ps.length; i++) {
                if (ps[i].getAttribute('data-outline-level') === '1') ps[i].setAttribute('data-collapsed', 'false');
                ps[i].style.display = '';
            }
            return tmp.innerHTML;
        }
        function _notepadExpandAllTabsForSearch() {
            for (var i = 0; i < npTabCount(); i++) {
                if (notepadEditorData[i]) notepadEditorData[i].html = _notepadExpandAllInHtml(notepadEditorData[i].html || '');
            }
            var editor = document.getElementById('notepadEditor');
            if (editor) {
                var ps = editor.querySelectorAll('p');
                for (var pi = 0; pi < ps.length; pi++) {
                    if (ps[pi].getAttribute('data-outline-level') === '1') ps[pi].setAttribute('data-collapsed', 'false');
                    ps[pi].style.display = '';
                }
            }
        }
        function notepadHighlightTabs(keyword, force) {
            saveCurrentEditor();
            var raw = (keyword || '').replace(/^\s+|\s+$/g, '');
            var changed = raw !== _notepadLastSearch;
            if (!changed && !force) return;
            if (changed) _notepadLastSearch = raw;
            _notepadHLIndex = -1;
            var hlColors = ['notepadSearchHL0','notepadSearchHL1','notepadSearchHL2','notepadSearchHL3','notepadSearchHL4'];
            for (var i = 0; i < npTabCount(); i++) {
                if (!notepadEditorData[i]) continue;
                notepadEditorData[i].html = _notepadExpandAllInHtml(notepadStripHighlights(notepadEditorData[i].html));
            }
            if (raw) {
                var parts = raw.split(/\s+/).map(function(s) { return s.replace(/^\s+|\s+$/g, ''); }).filter(function(s) { return s.length > 0; });
                if (parts.length > 0) {
                    var patterns = [];
                    for (var pi = 0; pi < parts.length; pi++) {
                        patterns.push({ re: new RegExp('(' + parts[pi].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), cls: hlColors[pi % hlColors.length] });
                    }
                    for (var k = 0; k < npTabCount(); k++) {
                        if (!notepadEditorData[k]) continue;
                        notepadEditorData[k].html = notepadHighlightHtml(notepadEditorData[k].html, patterns);
                    }
                }
            }
            var editor = document.getElementById('notepadEditor');
            if (editor) editor.innerHTML = notepadEditorData[currentNotepadTab].html || '';
            if (typeof tileVisible !== 'undefined' && tileVisible) _refreshTilePreviewContent();
            var filter = document.getElementById('notepadSearchFilter');
            if (filter && filter.checked && raw && editor) {
                var allPs = editor.querySelectorAll('p');
                for (var pi = 0; pi < allPs.length; pi++) {
                    var p = allPs[pi];
                    if (p.getAttribute('data-outline-level') === '1') { p.style.display = ''; continue; }
                    p.style.display = p.querySelector('span.notepadSearchHL0, span.notepadSearchHL1, span.notepadSearchHL2, span.notepadSearchHL3, span.notepadSearchHL4') ? '' : 'none';
                }
            }
            updateNotepadSearchCount();
        }
        function notepadHighlightHtml(html, patterns) {
            if (!html || !patterns || !patterns.length) return html;
            var wrap = document.createElement('div');
            wrap.innerHTML = html;
            var hlClasses = {};
            for (var pi = 0; pi < patterns.length; pi++) hlClasses[patterns[pi].cls] = 1;
            (function walk(node) {
                if (node.nodeType === 3) {
                    var t = node.nodeValue;
                    if (!t) return;
                    var allMatches = [];
                    for (var pi = 0; pi < patterns.length; pi++) {
                        var pat = patterns[pi];
                        pat.re.lastIndex = 0;
                        var m;
                        while ((m = pat.re.exec(t)) !== null) {
                            allMatches.push({ start: m.index, end: m.index + m[0].length, cls: pat.cls });
                            if (m.index === pat.re.lastIndex) pat.re.lastIndex++;
                        }
                    }
                    if (allMatches.length === 0) return;
                    allMatches.sort(function(a,b){return a.start - b.start || b.end - a.end;});
                    var merged = [allMatches[0]];
                    for (var mi = 1; mi < allMatches.length; mi++) {
                        var last = merged[merged.length - 1];
                        if (allMatches[mi].start < last.end) continue;
                        merged.push(allMatches[mi]);
                    }
                    var frag = document.createDocumentFragment();
                    var lastIdx = 0;
                    for (var mi = 0; mi < merged.length; mi++) {
                        var r = merged[mi];
                        if (r.start > lastIdx) frag.appendChild(document.createTextNode(t.substring(lastIdx, r.start)));
                        var span = document.createElement('span');
                        span.className = r.cls;
                        span.textContent = t.substring(r.start, r.end);
                        frag.appendChild(span);
                        lastIdx = r.end;
                    }
                    if (lastIdx < t.length) frag.appendChild(document.createTextNode(t.substring(lastIdx)));
                    node.parentNode.replaceChild(frag, node);
                    return;
                }
                if (node.nodeType !== 1) return;
                for (var cls in hlClasses) { if (node.classList && node.classList.contains(cls)) return; }
                var children = [];
                for (var ci = 0; ci < node.childNodes.length; ci++) children.push(node.childNodes[ci]);
                for (var cj = 0; cj < children.length; cj++) walk(children[cj]);
            })(wrap);
            return wrap.innerHTML;
        }
        (function bindNotepadSearchInput() {
            function bindFilter() {
                var filter = document.getElementById('notepadSearchFilter');
                if (filter && !filter._nsFilterBound) {
                    filter._nsFilterBound = true;
                    filter.addEventListener('change', function() {
                        var input = document.getElementById('notepadSearchInput');
                        var kw = input ? input.value : '';
                        notepadHighlightTabs(kw || '', true);
                        if (!kw) {
                            var editor = document.getElementById('notepadEditor');
                            if (editor) {
                                var ps = editor.querySelectorAll('p');
                                for (var pi = 0; pi < ps.length; pi++) ps[pi].style.display = '';
                            }
                        }
                    });
                }
            }
            document.addEventListener('DOMContentLoaded', function() {
                var input = document.getElementById('notepadSearchInput');
                if (!input) return;
                input.addEventListener('input', function() { notepadHighlightTabs(input.value); });
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') { input.value = ''; notepadHighlightTabs(''); toggleNotepadSearch(); }
                });
                bindFilter();
            });
            setTimeout(function() {
                var input = document.getElementById('notepadSearchInput');
                if (input && !input._npSearchBound) {
                    input._npSearchBound = true;
                    input.addEventListener('input', function() { notepadHighlightTabs(input.value); });
                    input.addEventListener('keydown', function(e) {
                        if (e.key === 'Escape') { input.value = ''; notepadHighlightTabs(''); closeNotepadSearch(); }
                    });
                    bindFilter();
                    _bindNotepadSearchDrag();
                }
            }, 0);
        })();

        function _updateOutlineBg() {
            var content = document.querySelector('.notepadOutlineModalContent');
            if (!content) return;
            for (var i = 0; i < npTabCount(); i++) {
                content.classList.toggle('notepadOutline-bg' + (i % 5), i === currentNotepadTab);
            }
        }
        function _applyNotepadNotebookStyle() {
            var editor = document.getElementById('notepadEditor');
            if (editor) {
                editor.classList.toggle('notebook-style', !!notepadNotebookStyles[currentNotepadTab]);
                _refreshNotepadArticleSeparators(editor);
            }
        }
        function toggleNotepadNotebookStyle(idx) {
            idx = parseInt(idx, 10);
            if (!isFinite(idx) || idx < 0 || idx >= npTabCount()) return;
            notepadNotebookStyles[idx] = !notepadNotebookStyles[idx];
            if (idx === currentNotepadTab) _applyNotepadNotebookStyle();
            _saveNotepadToCache();
            _notepadSyncDisplayMenu();
            showToast(notepadNotebookStyles[idx] ? '已显示行线' : '已取消行线');
        }
        /* ---------------- 隐藏字符：只画可编辑的空格 · 与换行 ↵ ----------------
           只画一层绝对定位覆盖层，不改 contenteditable 里的正文，避免污染缓存与导出。
           段末隐式换行不画；空段落（<p><br></p>）显式换行必须画。 */
        function _npInvisLayer() {
            var host = document.getElementById('notepadEditorHost');
            if (!host) {
                var ed0 = document.getElementById('notepadEditor');
                if (!ed0) return null;
                var content = ed0.parentNode;
                if (!content) return null;
                host = document.createElement('div');
                host.id = 'notepadEditorHost';
                host.className = 'npEditorHost';
                content.insertBefore(host, ed0);
                host.appendChild(ed0);
                var zoomBar = document.getElementById('notepadEditorZoomBar');
                var hideBtn = document.getElementById('notepadEditorHideBtn');
                if (zoomBar && zoomBar.parentNode === content) content.insertBefore(zoomBar, host.nextSibling);
                if (hideBtn && hideBtn.parentNode === content) content.insertBefore(hideBtn, zoomBar ? zoomBar.nextSibling : host.nextSibling);
            }
            var layer = host.querySelector('.npInvisLayer');
            if (!layer) {
                layer = document.createElement('div');
                layer.className = 'npInvisLayer';
                host.appendChild(layer);
            }
            return layer;
        }
        function _npInvisNextTop(r) {
            for (var i = 0; i < r.length; i++) {
                if (r[i].width > 1 || r[i].height <= 1) return r[i].top + r[i].height / 2;
            }
            return r.length ? r[0].top + r[0].height / 2 : 0;
        }
        function _npInvisAdd(frag, txt, x, y) {
            var s = document.createElement('span');
            s.className = 'npInvis';
            s.textContent = txt;
            s.style.left = Math.round(x) + 'px';
            s.style.top = Math.round(y) + 'px';
            frag.appendChild(s);
        }
        function renderNotepadInvisibles() {
            var ed = document.getElementById('notepadEditor');
            if (!ed) return;
            var layer = _npInvisLayer();
            if (!layer) return;
            var on = _notepadInvisOn();
            if (layer.parentNode) layer.parentNode.classList.toggle('npInvisOn', on);
            if (!on) { layer.innerHTML = ''; return; }
            var frag = document.createDocumentFragment();
            var hostRect = layer.parentNode.getBoundingClientRect();
            var walker = document.createTreeWalker(ed, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false);
            var node;
            while ((node = walker.nextNode())) {
                if (node.nodeType === 1) {
                    /* BR 由所属段落在下面统一处理：段内换行画 ↵，段末那个换行符不画，空段落要画 */
                    if (node === ed) continue;
                    var tag = node.tagName;
                    if (tag !== 'P' && tag !== 'DIV') continue;
                    var kids = node.childNodes;
                    var onlyBr = kids.length === 1 && kids[0].nodeType === 1 && kids[0].tagName === 'BR';
                    var rp = document.createRange();
                    rp.selectNodeContents(node);
                    var rectsP = rp.getClientRects();
                    if (!rectsP || !rectsP.length) continue;
                    if (onlyBr) {
                        /* 空段落：把段内那个换行符画出来 */
                        _npInvisAdd(frag, '↵', rectsP[0].left - hostRect.left - 4, rectsP[0].top - hostRect.top);
                    } else {
                        /* 段内换行（Shift+Enter）逐行画 ↵，段末隐式换行不画 */
                        var lastMeaningful = null;
                        for (var li = kids.length - 1; li >= 0; li--) {
                            var lk = kids[li];
                            if (lk.nodeType === 3 && !String(lk.nodeValue || '').replace(/[\s\u00a0\u3000]/g, '')) continue;
                            lastMeaningful = lk;
                            break;
                        }
                        for (var bi = 0; bi < kids.length; bi++) {
                            var kb = kids[bi];
                            if (kb.nodeType !== 1 || kb.tagName !== 'BR') continue;
                            if (kb === lastMeaningful) continue;
                            var rb = document.createRange();
                            rb.selectNode(kb);
                            var rectsB = rb.getClientRects();
                            if (rectsB && rectsB.length) _npInvisAdd(frag, '↵', rectsB[0].left - hostRect.left - 4, rectsB[0].top - hostRect.top);
                        }
                    }
                    continue;
                }
                var val = node.nodeValue || '';
                if (!/[ \t\u3000\u00a0]/.test(val)) continue;
                var base = 0;
                var lastTop = -9999;
                for (var i = 0; i < val.length; i++) {
                    var ch = val.charAt(i);
                    if (!/[ \t\u3000\u00a0]/.test(ch)) continue;
                    var r = document.createRange();
                    try { r.setStart(node, i); r.setEnd(node, i + 1); } catch (e) { continue; }
                    var rcs = r.getClientRects();
                    if (!rcs || !rcs.length) continue;
                    var top = _npInvisNextTop(rcs);
                    if (Math.abs(top - lastTop) > 2) { base = 0; lastTop = top; }
                    _npInvisAdd(frag, '·', rcs[0].left - hostRect.left + rcs[0].width / 2 + base, top - hostRect.top);
                    base += 2;
                }
            }
            layer.innerHTML = '';
            layer.appendChild(frag);
        }
        function toggleNotepadInvisibles() {
            window._npShowInvisibles = !_notepadInvisOn();
            try { localStorage.setItem('npShowInvisibles', window._npShowInvisibles ? '1' : '0'); } catch (e) {}
            _notepadSyncDisplayMenu();
            renderNotepadInvisibles();
            showToast(window._npShowInvisibles ? '已显示隐藏字符' : '已关闭隐藏字符');
        }
        window.toggleNotepadInvisibles = toggleNotepadInvisibles;
        window.renderNotepadInvisibles = renderNotepadInvisibles;
        function updateNotepadTabStyle() {
            var tabs = document.querySelectorAll('.notepadTabBtn');
            var colorClasses = ['color0','color1','color2','color3','color4'];
            var stackGrey = tileVisible && (notepadTileMode === 'stack' || notepadTileMode === 'tile');
            for (var i = 0; i < tabs.length; i++) {
                for (var c = 0; c < colorClasses.length; c++) tabs[i].classList.remove(colorClasses[c]);
                tabs[i].classList.add('color' + (i % 5));
                tabs[i].style.background = '';
                tabs[i].style.color = '';
                tabs[i].classList.toggle('active', i === currentNotepadTab);
                if (stackGrey && i !== currentNotepadTab) {
                    tabs[i].style.background = '#9e9e9e';
                    tabs[i].style.color = '#fff';
                    tabs[i].style.opacity = '1';
                } else {
                    tabs[i].style.opacity = i === currentNotepadTab ? '1' : '0.8';
                }
            }
        }
        function switchNotepadTab(index) {
            saveCurrentEditor();
            S.currentNotepadTab = index;
            updateNotepadTabStyle();
            _updateOutlineBg();
            document.getElementById('notepadTitle').className = 'notepadTitle color' + (index % 5);
            _npSyncTitleDisplay();
            document.getElementById('notepadEditor').className = 'notepadEditor bg' + (index % 5);
            _applyNotepadNotebookStyle();
            syncEditorFromData();
            applyNotepadZoom();
            if (tileVisible) showTile(notepadTileMode);
            var sw = document.getElementById('notepadSearchWrap');
            if (sw && getComputedStyle(sw).display !== 'none') {
                _notepadExpandAllTabsForSearch();
                var si = document.getElementById('notepadSearchInput');
                notepadHighlightTabs(si ? si.value : '', true);
            }
            updateNotepadSearchCount();
            _saveNotepadToCache();
        }
        function editNotepadTab(index, event) { /* removed: tabs are now non-editable */ }
        function saveNotepadTab(index, input) { /* legacy noop */ }
        function _npSyncTitleDisplay() {
            var el = document.getElementById('notepadTitle');
            if (!el) return;
            var t = notepadTitles[currentNotepadTab] || '';
            el.value = t;
            el.title = t || '（无标题）点击可修改标题';
        }
        function showNotepadRename() {
            var modal = document.getElementById('notepadRenameModal');
            var input = document.getElementById('notepadRenameInput');
            if (!modal || !input) return;
            input.value = notepadTitles[currentNotepadTab] || '';
            modal.classList.add('show');
            setTimeout(function() { try { input.focus(); input.select(); } catch (e) {} }, 30);
        }
        function closeNotepadRename() {
            var modal = document.getElementById('notepadRenameModal');
            if (modal) modal.classList.remove('show');
        }
        function confirmNotepadRename() {
            var input = document.getElementById('notepadRenameInput');
            if (!input) return;
            var val = (input.value || '').replace(/^\s+|\s+$/g, '');
            notepadTitles[currentNotepadTab] = val;
            _npSyncTitleDisplay();
            closeNotepadRename();
            if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
            if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
            if (typeof tileVisible !== 'undefined' && tileVisible && typeof showTile === 'function') showTile(notepadTileMode);
            if (typeof showToast === 'function') showToast('标题已修改');
        }
        
        function copyNotepad(isDoubleClick) { saveCurrentEditor(); if (isDoubleClick) { var contents = [], nonEmptyCount = 0; for (var i = 0; i < npTabCount(); i++) { var title = notepadTitles[i] || '…'; var html = notepadEditorData[i].html || ''; var text = html.replace(/<[^>]*>/g, ''); if (title !== '…' || text.trim()) { contents.push(title + '\n' + text); nonEmptyCount++; } } if (nonEmptyCount === 0) { showToast('没有非空窗口可复制'); return; } navigator.clipboard.writeText(contents.join('\n\n')).then(function() { showToast('已复制' + nonEmptyCount + '个窗口内容'); }).catch(function() { showToast('复制失败'); }); } else { var title = notepadTitles[currentNotepadTab] || '…'; var editor = document.getElementById('notepadEditor'); var text = editor.innerText || ''; navigator.clipboard.writeText(title + '\n' + text).then(function() { showToast('已复制当前窗口内容到剪贴板！'); }).catch(function() { showToast('复制失败'); }); } }
        function initCopyButton() { var btn = document.getElementById('copyBtn'); var clickTimer = null; btn.addEventListener('click', function(e) { if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; } clickTimer = setTimeout(function() { copyNotepad(false); clickTimer = null; }, 300); }); btn.addEventListener('dblclick', function(e) { if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; } copyNotepad(true); }); }
        
        function openNotepad() { document.getElementById('notepadOpenInput').click(); }
        
        function loadNotepadFile(event) {
            var file = event.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var content = e.target.result;
                    if (/日志模板\.js$/i.test(file.name || '') || /var\s+savedData\s*=/.test(content)) {
                        loadDataContent(content, file.name || '');
                        return;
                    }
                    var groups = content.split(/\n\n/);
                    for (var i = 0; i < Math.min(groups.length, npTabCount()); i++) {
                        var parts = groups[i].split('||');
                        if (parts.length >= 5) {
                            notepadLabels[i] = parts[0].trim(); notepadTitles[i] = parts[1].trim();
                            notepadEditorData[i] = {html: parts[2] || '', bold: parts[3] === '1'};
                            notepadFontSizes[i] = parseInt(parts[4]) || 14;
                        } else if (parts.length >= 3) {
                            notepadLabels[i] = parts[0].trim(); notepadTitles[i] = parts[1].trim();
                            notepadEditorData[i].html = parts.slice(2).join('||');
                        }
                    }
                    updateNotepadTabs();
                    _npSyncTitleDisplay();
                    syncEditorFromData();
                    _saveNotepadToCache();
                    showToast('打开成功！');
                } catch (err) { showToast('打开失败：' + err.message); }
            };
            reader.onerror = function() { showToast('文件读取失败'); };
            reader.readAsText(file, 'UTF-8');
            event.target.value = '';
        }
        
        function saveNotepad() {
            saveCurrentEditor();
            var lines = [];
            for (var i = 0; i < npTabCount(); i++) {
                var ed = notepadEditorData[i] || {html:'', bold:false};
                var fs = notepadFontSizes[i] || 14;
                lines.push(notepadLabels[i] + '||' + notepadTitles[i] + '||' + ed.html + '||' + (ed.bold?'1':'0') + '||' + fs);
            }
            var content = lines.join('\n\n');
            var now = new Date();
            var fileName = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + ' 笔记.js';
            var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = '笔记/' + fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('已保存');
        }
        
        function updateNotepadTabs() { var tabs = document.querySelectorAll('.notepadTabBtn'); for (var i = 0; i < tabs.length; i++) tabs[i].textContent = String(i + 1); }
        function _npDirectoryLabel(txt) {
            txt = (txt || '').replace(/^\s+|\s+$/g, '');
            var m = txt.match(/^【[^】]+】\s*/);
            return m ? (txt.substring(m[0].length).trim() || txt) : txt;
        }
        function _scanNotepadDirectoryEntries() {
            var root = _notepadDirSourceRoot();
            _notepadDirectoryEntries = [];
            if (root) {
                var ps = root.querySelectorAll('p');
                var indexArticle = false;
                var indexOwnTitleSeen = false;
                for (var pi = 0; pi < ps.length; pi++) {
                    var p = ps[pi];
                    var txt = p.textContent.trim();
                    if (!txt) continue;
                    if (p.getAttribute('data-outline-level') === '1') {
                        var _mergedTitle = p.getAttribute('data-level') === 'title';
                        if (_mergedTitle && indexArticle && !indexOwnTitleSeen) {
                            indexOwnTitleSeen = true;
                            continue;
                        }
                        _notepadDirectoryEntries.push({ label: _npDirectoryLabel(txt), articleText: txt, index: pi });
                        indexArticle = !_mergedTitle;
                        indexOwnTitleSeen = _mergedTitle;
                        continue;
                    }
                    if (_npIsArticleTitlePara(p)) {
                        // 一篇文章只收录一个标题：有索引标题时忽略其后的文章标题
                        if (indexArticle && !indexOwnTitleSeen) { indexOwnTitleSeen = true; continue; }
                        _notepadDirectoryEntries.push({ label: _npDirectoryLabel(txt), articleText: txt, index: pi });
                        indexArticle = false;
                        indexOwnTitleSeen = false;
                    }
                }
            }
        }
        function refreshNotepadOutlineModal() {
            var modal = document.getElementById('notepadOutlineModal');
            if (!modal || !modal.classList.contains('show')) {
                showNotepadOutlineModal();
                return;
            }
            // 1) 先把最新改动写入缓存（不重新选择文章，右侧显示保持不变）
            var editor = document.getElementById('notepadEditor');
            if (_notepadDirBrowseMode && _notepadDirCurrentIdx >= 0 && _notepadDirBrowseSourceHtml != null) {
                _notepadDirSaveCurrentArticle();
            } else if (editor) {
                // 直接从当前编辑器 DOM 重新读取（包含尚未保存的改动与手动设置的层级），不使用可能过期的缓存
                _refreshNotepadArticleSeparators(editor);
                _notepadDirBrowseSourceHtml = editor.innerHTML;
                if (notepadEditorData[currentNotepadTab]) notepadEditorData[currentNotepadTab].html = editor.innerHTML;
                _saveNotepadToCache();
                _scanNotepadDirectoryEntries();
            } else {
                _scanNotepadDirectoryEntries();
            }
            // 2) 重新渲染左侧提纲（保留原选中项，不清除右侧文章显示）
            var dirTab = document.getElementById('notepadOutlineDirTab');
            if (dirTab && dirTab.classList.contains('show')) {
                _renderDirTab();
            } else {
                _notepadOutlineRenderStruct();
            }
            showToast('已更新提纲');
        }
        function showNotepadOutlineModal() {
            _notepadDirRestoreHidden();
            var editorForSource = document.getElementById('notepadEditor');
            if (editorForSource) _notepadDirBrowseSourceHtml = notepadEditorData[currentNotepadTab] && notepadEditorData[currentNotepadTab].html ? notepadEditorData[currentNotepadTab].html : _stripNotepadArticleSeparators(editorForSource.innerHTML);
            _notepadDirBrowseMode = true;
            var browsePanel = document.getElementById('notepadPanel');
            if (browsePanel && !_writeNoteMode && !_materialMode) browsePanel.classList.add('notepad-dir-browse-active');
            var modal = document.getElementById('notepadOutlineModal');
            var content = modal.querySelector('.notepadOutlineModalContent');
            var notepadP = document.getElementById('notepadPanel');
            if (content) {
                var wrCss = _npWorkRects();
                var wrScreen = _npWorkScreenRects();
                _npSetScreenBox(content, wrScreen.left);
                content.style.transform = 'none';
                if (notepadP && notepadP.classList.contains('show')) {
                    _npSetBox(notepadP, wrCss.right);
                    notepadP.style.right = 'auto';
                    notepadP.dataset.npUserMoved = '1';
                }
            }
            _updateOutlineBg();
            _scanNotepadDirectoryEntries();
            modal.classList.add('show');
            switchOutlineTab('dir');
            _notepadDirSetPrompt();
        }
        function _toggleArticleCollapse(editor, articleP, collapsed) {
            var ps = editor.querySelectorAll('p');
            var start = -1;
            for (var ci = 0; ci < ps.length; ci++) {
                if (ps[ci] === articleP) { start = ci; break; }
            }
            if (start < 0) return;
            var end = _npArticleEndIndex(ps, start);
            for (var hi = start + 1; hi < end; hi++) {
                ps[hi].style.display = collapsed ? 'none' : '';
            }
        }
        function _updateStructForArticle(didx) {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var entry = _notepadDirectoryEntries[didx];
            if (!entry) return;
            _structArticleIdx = didx;
            _notepadOutlineRenderStruct();
        }
        function closeNotepadOutlineModal() {
            _restoreFromWriteNote();
            _notepadDirEndBrowse(true);
            _notepadDirRestoreHidden();
            document.getElementById('notepadOutlineModal').classList.remove('show');
            autoFitNotepadHeight();
        }
         /* 从日期段落里取出用于索引标题前缀的日期串。
            支持：20260325 / 202603 / 0325 / 2026年3月25日 / 3月25日 / 2026-03-25 / 2026.3.25
            有日就带上日；只有年月则输出 6 位；只有月日则原样输出 4 位（按用户约定不补年份）。 */
         function _npExtractIndexDate(text) {
             var s = String(text == null ? '' : text).replace(/\u00a0/g, ' ').trim();
             if (!s) return '';
             var m;
             // 2026年3月25日 / 2026年3月
             m = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*[日号])?/);
             if (m) {
                 var y = m[1], mo = String(parseInt(m[2], 10)).padStart(2, '0');
                 if (m[3]) return y + mo + String(parseInt(m[3], 10)).padStart(2, '0');
                 return y + mo;
             }
             // 3月25日 / 3月
             m = s.match(/(\d{1,2})\s*月(?:\s*(\d{1,2})\s*[日号])?/);
             if (m) {
                 var mo2 = String(parseInt(m[1], 10)).padStart(2, '0');
                 if (m[2]) return mo2 + String(parseInt(m[2], 10)).padStart(2, '0');
                 return mo2;
             }
             // 2026-03-25 / 2026.3.25 / 2026/03/25
             m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
             if (m) return m[1] + String(parseInt(m[2], 10)).padStart(2, '0') + String(parseInt(m[3], 10)).padStart(2, '0');
             // 纯数字：20260325 / 202603 / 0325
             m = s.match(/^\s*(\d{8}|\d{6}|\d{4})\s*$/);
             if (m) return m[1];
             // 段内夹着 8/6/4 位数字时取第一个
             m = s.match(/(?:^|\D)(\d{8}|\d{6})(?:\D|$)/);
             if (m) return m[1];
             m = s.match(/(?:^|\D)(\d{4})(?:\D|$)/);
             if (m) return m[1];
             return '';
         }
         function _npConvertParaToArticleTitle(p) {
             if (!p || p.nodeType !== 1) return false;
             var txt = (p.textContent || '').replace(/^\s+|\s+$/g, '');
             if (!txt) return false;
             p.removeAttribute('data-outline-level');
             p.removeAttribute('data-collapsed');
             p.setAttribute('data-level', 'title');
             p.setAttribute('style', FORMAT_STANDARD.paraStyle('level-title'));
             p.innerHTML = '<span style="' + FORMAT_STANDARD.inlineStyle('level-title') + '">' + escapeHtml(txt) + '</span>';
             _npMarkManualPara(p);
             _npEnsureParaIndent(p, '0');
             return true;
         }
         function addNotepadDirEntry() {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var sel = window.getSelection();
            var range = null;
            var contextPara = (typeof _npCtxArticlePara !== 'undefined') ? _npCtxArticlePara : null;
            if (_notepadCtxRange && editor.contains(_notepadCtxRange.startContainer)) {
                range = _notepadCtxRange;
                try { sel.removeAllRanges(); sel.addRange(range); } catch (ctxEx) {}
            } else {
                _notepadRestoreSelection();
                sel = window.getSelection();
                if (sel.rangeCount > 0 && editor.contains(sel.anchorNode)) range = sel.getRangeAt(0);
            }
            if (!range && sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) range = sel.getRangeAt(0);
            if (!range) { showToast('请将光标置于文章标题上'); return; }
            function _getP(node) {
                var p = node && node.nodeType === 3 ? node.parentNode : node;
                while (p && p !== editor && p.tagName !== 'P') p = p.parentNode;
                return p && p !== editor && p.tagName === 'P' ? p : null;
            }
            function _looksTitle(p) {
                if (!p) return false;
                if (p.getAttribute('data-outline-level') === '1') return true;
                if (p.getAttribute('data-level') === 'title') return true;
                return _npManualLooksArticleTitle(p, p.textContent || '');
            }
            var startP = contextPara && editor.contains(contextPara) ? contextPara : _getP(range.startContainer);
            var endP = _getP(range.endContainer);
            if (!startP) { showToast('请将光标置于文章标题上'); return; }
            if (!endP) endP = startP;
            if (range.collapsed) { endP = startP; }
            var ps = editor.querySelectorAll('p');
            var startIdx = -1, endIdx = -1;
            for (var i = 0; i < ps.length; i++) {
                if (ps[i] === startP) startIdx = i;
                if (ps[i] === endP) endIdx = i;
            }
            if (startIdx < 0) { showToast('请将光标置于文章标题上'); return; }
            if (endIdx < 0) endIdx = startIdx;
            if (startIdx > endIdx) { var tmpIdx = startIdx; startIdx = endIdx; endIdx = tmpIdx; }
            var titleParas = [];
            for (var pi = startIdx; pi <= endIdx; pi++) {
                var txt = (ps[pi].textContent || '').replace(/^\s+|\s+$/g, '');
                if (!txt) continue;
                if (/^【/.test(txt) || ps[pi].getAttribute('data-outline-level') === '1') { showToast('已是索引标题，不能重复添加'); return; }
                titleParas.push(ps[pi]);
            }
            if (!titleParas.length) { showToast('请将光标置于文章标题上'); return; }
            // 段落层级不是文章标题时，先转换为文章标题，再添加索引
            var _npConvertedToTitle = 0;
            for (var cti = 0; cti < titleParas.length; cti++) {
                if (!_looksTitle(titleParas[cti])) {
                    if (_npConvertParaToArticleTitle(titleParas[cti])) _npConvertedToTitle++;
                }
            }
             var firstP = titleParas[0];
             // 索引必须紧贴在「第一篇被选中的段落」之前。
             // 只有该段之前紧邻的密级/附件/主送抬头行，才允许索引插在它们之前。
             var insertBeforeP = firstP;
             for (var articleScan = startIdx - 1; articleScan >= 0; articleScan--) {
                 var scanP = ps[articleScan];
                 if (scanP.getAttribute('data-outline-level') === '1') break;
                 var scanLevel = scanP.getAttribute('data-level') || '';
                 var scanText = (scanP.textContent || '').replace(/^\s+|\s+$/g, '');
                 if (scanLevel === 'secret' || scanLevel === 'attachment' || /^×密|^x密|^★|^附件(?:\s*[：:]?\s*\d+)?$/.test(scanText)) insertBeforeP = scanP;
                 else break;
             }
             var existingIndexP = null;
             for (var backIdx = startIdx - 1, scanned = 0; backIdx >= 0 && scanned < 3; backIdx--, scanned++) {
                 var backP = ps[backIdx];
                 var backText = (backP.textContent || '').replace(/^\s+|\s+$/g, '');
                 if (!backText) continue;
                 var backIsTitle = backP.getAttribute('data-level') === 'title';
                 var backIsIndex = backP.getAttribute('data-outline-level') === '1' && !backIsTitle;
                 if (!backIsIndex && !backIsTitle && /^【[^】]+】/.test(backText)) backIsIndex = true;
                 if (backIsIndex) {
                     existingIndexP = backP;
                     break;
                 }
             }
             if (existingIndexP) {
                 var existLabel = (existingIndexP.textContent || '').replace(/^\s+|\s+$/g, '');
                 if (!confirm('当前文章标题前已有索引标题：\n' + existLabel + '\n是否继续添加新的索引标题？')) return;
             }
            var headingText = [];
            for (var ti = 0; ti < titleParas.length; ti++) headingText.push((titleParas[ti].textContent || '').replace(/^\s+|\s+$/g, ''));
            headingText = headingText.join(' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
            var bracketP = document.createElement('p');
            bracketP.setAttribute('data-outline-level', '1');
            bracketP.style.cssText = 'margin:0 0 0.5em;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:left;text-indent:0;color:#1a2a4a;';
            var indexText = headingText;
            if (!/^\d{6}(?:\s|$)/.test(indexText)) {
                var articleMonth = '';
                for (var di = firstP.nextElementSibling; di; di = di.nextElementSibling) {
                    if (di.tagName !== 'P') continue;
                    if (di.getAttribute('data-outline-level') === '1') break;
                    var dateText = (di.textContent || '').replace(/^\s+|\s+$/g, '');
                    if (di.getAttribute('data-level') !== 'date' && di.getAttribute('data-level') !== 'author' &&
                        !/\d{4}\s*年\s*\d{1,2}\s*月/.test(dateText) &&
                        !/^\d{6,8}$/.test(dateText) && !/^\d{4}$/.test(dateText)) continue;
                    articleMonth = _npExtractIndexDate(dateText);
                    if (articleMonth) break;
                }
                if (articleMonth) indexText = articleMonth + '  ' + indexText;
            }
            bracketP.textContent = indexText;
            if (existingIndexP) {
                var _exLabel = String(existingIndexP.textContent || '').replace(/\u00a0/g, ' ').replace(/^\s+|\s+$/g, '');
                var _newLabel = String(indexText || '').replace(/\u00a0/g, ' ').replace(/^\s+|\s+$/g, '');
                var _stripPrefix = function (v) { return v.replace(/^【[^】]*】\s*/, '').replace(/^\d{8}\s+/, '').replace(/^\d{4}\s*年\s*\d{1,2}\s*月[^\s]*\s*/, ''); };
                if (_exLabel === _newLabel || _stripPrefix(_exLabel) === _stripPrefix(_newLabel)) {
                    showToast('该文章已有同名索引标题，无需重复添加');
                    return;
                }
            }
             editor.insertBefore(bracketP, insertBeforeP);
            for (var ri = 0; ri < titleParas.length; ri++) {
                titleParas[ri].removeAttribute('data-outline-level');
                titleParas[ri].removeAttribute('data-collapsed');
                titleParas[ri].setAttribute('data-level', 'title');
                _npEnsureParaIndent(titleParas[ri], '0');
            }
            saveCurrentEditor();
            _refreshOutlineIfOpen();
             showToast(_npConvertedToTitle ? ('已将 ' + _npConvertedToTitle + ' 段设为文章标题并添加索引') : '已添加索引');
         }
         function notepadAddIndexFromMenu(e) {
             if (e && e.stopPropagation) e.stopPropagation();
             try {
                 addNotepadDirEntry();
             } catch (err) {
                 console.error('添加索引失败:', err);
                 showToast('添加索引失败：' + (err && err.message ? err.message : '程序异常'));
             }
             var menu = document.getElementById('notepadCtxMenu');
             if (menu) menu.classList.remove('show');
             _notepadCtxRange = null;
             _npCtxArticlePara = null;
         }
        function moveNotepadArticle(dir) {
            _notepadRestoreSelection();
            var editor = document.getElementById('notepadEditor');
            var sel = window.getSelection();
            if (!sel.rangeCount || !editor.contains(sel.anchorNode)) { showToast('请将光标置于要移动的文章中'); return; }
            var node = sel.getRangeAt(0).startContainer;
            var cursorP = node.nodeType === 3 ? node.parentNode : node;
            while (cursorP && cursorP !== editor && cursorP.tagName !== 'P') cursorP = cursorP.parentNode;
            if (!cursorP || cursorP === editor) { showToast('请将光标置于文章中'); return; }
            var ps = editor.querySelectorAll('p');
            if (ps.length < 2) { showToast('没有可移动的文章'); return; }
            var articles = [];
            for (var i = 0; i < ps.length; i++) {
                if (ps[i].getAttribute('data-outline-level') === '1') {
                    articles.push({ startIdx: i, endIdx: -1 });
                }
            }
            if (articles.length === 0) { showToast('没有文章'); return; }
            for (var i = 0; i < articles.length; i++) {
                articles[i].endIdx = (i + 1 < articles.length) ? articles[i + 1].startIdx : ps.length;
            }
            var cursorIdx = -1;
            for (var i = 0; i < ps.length; i++) { if (ps[i] === cursorP) { cursorIdx = i; break; } }
            var curIdx = -1;
            for (var ai = 0; ai < articles.length; ai++) {
                if (cursorIdx >= articles[ai].startIdx && cursorIdx < articles[ai].endIdx) { curIdx = ai; break; }
            }
            if (curIdx === -1) { showToast('请将光标置于文章区域'); return; }
            var parts = [];
            for (var i = 0; i < ps.length; i++) parts.push(ps[i].outerHTML);
            var cur = articles[curIdx];
            var newParts;
            if (dir === -1) {
                if (curIdx === 0) { showToast('已经是第一篇'); return; }
                var prev = articles[curIdx - 1];
                newParts = [].concat(parts.slice(0, prev.startIdx), parts.slice(cur.startIdx, cur.endIdx), parts.slice(prev.startIdx, cur.startIdx), parts.slice(cur.endIdx));
            } else {
                if (curIdx >= articles.length - 1) { showToast('已经是最后一篇'); return; }
                var next = articles[curIdx + 1];
                newParts = [].concat(parts.slice(0, cur.startIdx), parts.slice(cur.endIdx, next.endIdx), parts.slice(cur.startIdx, cur.endIdx), parts.slice(next.endIdx));
            }
            editor.innerHTML = newParts.join('');
            saveCurrentEditor();
            updateFooterTimestamp();
            showToast(dir === -1 ? '已上移' : '已下移');
        }
        /* 取文章（以索引标题为起点）的 DOM 范围：articles[i] = {startIdx, endIdx} */
        function _npArticleRanges(editor) {
            var ps = editor.querySelectorAll('p');
            var articles = [];
            for (var i = 0; i < ps.length; i++) {
                if (ps[i].getAttribute('data-outline-level') === '1') articles.push({ startIdx: i, endIdx: -1 });
            }
            for (var j = 0; j < articles.length; j++) {
                articles[j].endIdx = (j + 1 < articles.length) ? articles[j + 1].startIdx : ps.length;
            }
            return articles;
        }
        /* 把第 from 篇文章移动到第 to 个位置（0 起，按当前文章顺序） */
        function moveArticleToIndex(from, to) {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return false;
            var ps = editor.querySelectorAll('p');
            var articles = _npArticleRanges(editor);
            if (from < 0 || from >= articles.length) return false;
            if (to < 0) to = 0;
            if (to > articles.length - 1) to = articles.length - 1;
            if (from === to) return false;
            var parts = [];
            for (var i = 0; i < ps.length; i++) parts.push(ps[i].outerHTML);
            var seq = [];
            for (var a = 0; a < articles.length; a++) seq.push(a);
            seq.splice(from, 1);
            seq.splice(to, 0, from);
            var out = [];
            for (var s = 0; s < seq.length; s++) {
                var r = articles[seq[s]];
                out = out.concat(parts.slice(r.startIdx, r.endIdx));
            }
            editor.innerHTML = out.join('');
            saveCurrentEditor();
            updateFooterTimestamp();
            _refreshOutlineIfOpen();
            return true;
        }
        /* 按日期排序文章；desc=true 为日期逆序（新的在前） */
        function sortNotepadArticlesByDate(desc) {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return false;
            var ps = editor.querySelectorAll('p');
            var articles = _npArticleRanges(editor);
            if (articles.length < 2) { showToast('只有一篇文章，无需排序'); return false; }
            var keys = [];
            for (var a = 0; a < articles.length; a++) {
                var key = '';
                for (var i = articles[a].startIdx; i < articles[a].endIdx; i++) {
                    var lv = ps[i].getAttribute('data-level') || '';
                    var txt = (ps[i].textContent || '').trim();
                    if (lv === 'date' || /^(\d{6,8}|\d{4})$/.test(txt) || /\d{4}\s*年\s*\d{1,2}\s*月/.test(txt)) {
                        key = _npExtractIndexDate(txt);
                        if (key.length >= 4) break;
                    }
                }
                if (!key) {
                    var ititle = (ps[articles[a].startIdx].textContent || '').trim();
                    var im = ititle.match(/^(\d{6,8}|\d{4})(?:\s|$)/);
                    if (im) key = im[1];
                }
                keys.push({ idx: a, key: key || '' });
            }
            keys.sort(function (x, y) {
                if (!x.key && !y.key) return x.idx - y.idx;
                if (!x.key) return 1;
                if (!y.key) return -1;
                var c = x.key < y.key ? -1 : (x.key > y.key ? 1 : 0);
                return desc ? -c : c;
            });
            var parts = [];
            for (var p2 = 0; p2 < ps.length; p2++) parts.push(ps[p2].outerHTML);
            var out = [];
            for (var k = 0; k < keys.length; k++) {
                var r = articles[keys[k].idx];
                out = out.concat(parts.slice(r.startIdx, r.endIdx));
            }
            editor.innerHTML = out.join('');
            saveCurrentEditor();
            updateFooterTimestamp();
            _refreshOutlineIfOpen();
            showToast(desc ? '已按日期逆序排列' : '已按日期顺序排列');
            return true;
        }
        function deleteNotepadArticle() {
            _notepadRestoreSelection();
            var editor = document.getElementById('notepadEditor');
            var sel = window.getSelection();
            if (!sel.rangeCount || !editor.contains(sel.anchorNode)) { showToast('请将光标置于要删除的文章中'); return; }
            var node = sel.getRangeAt(0).startContainer;
            var cursorP = node.nodeType === 3 ? node.parentNode : node;
            while (cursorP && cursorP !== editor && cursorP.tagName !== 'P') cursorP = cursorP.parentNode;
            if (!cursorP || cursorP === editor) { showToast('请将光标置于文章中'); return; }
            var ps = editor.querySelectorAll('p');
            if (ps.length < 2) { showToast('没有可删除的文章'); return; }
            var articles = [];
            for (var i = 0; i < ps.length; i++) {
                if (ps[i].getAttribute('data-outline-level') === '1') {
                    articles.push({ startIdx: i, endIdx: -1, text: ps[i].textContent.trim() });
                }
            }
            if (articles.length === 0) { showToast('没有文章'); return; }
            for (var i = 0; i < articles.length; i++) {
                articles[i].endIdx = (i + 1 < articles.length) ? articles[i + 1].startIdx : ps.length;
            }
            var cursorIdx = -1;
            for (var i = 0; i < ps.length; i++) { if (ps[i] === cursorP) { cursorIdx = i; break; } }
            var curIdx = -1;
            for (var ai = 0; ai < articles.length; ai++) {
                if (cursorIdx >= articles[ai].startIdx && cursorIdx < articles[ai].endIdx) { curIdx = ai; break; }
            }
            if (curIdx === -1) { showToast('请将光标置于文章区域'); return; }
            var title = articles[curIdx].text || '未命名';
            if (!confirm('将删除当前文章《' + title + '》，是否继续？')) return;
            var parts = [];
            for (var i = 0; i < ps.length; i++) parts.push(ps[i].outerHTML);
            parts.splice(articles[curIdx].startIdx, articles[curIdx].endIdx - articles[curIdx].startIdx);
            editor.innerHTML = parts.join('');
            saveCurrentEditor();
            updateFooterTimestamp();
            showToast('已删除《' + title + '》');
        }
        function insertNotepadArticle(before) {
            _notepadRestoreSelection();
            var editor = document.getElementById('notepadEditor');
            var now = new Date();
            var y = now.getFullYear();
            var m = String(now.getMonth() + 1).padStart(2, '0');
            var d = String(now.getDate()).padStart(2, '0');
            var dateStr = y + m + d;
            var dateCn = '（' + y + '年' + parseInt(m) + '月' + parseInt(d) + '日）';
            var insertHtml = '<p data-outline-level="1" style="margin:0 0 0.5em;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:left;text-indent:0;color:#1a2a4a;">' + dateStr + ' 标题</p>'
                + '<p data-level="title" style="margin:0;line-height:1.8;font-family:方正小标宋,FZXiaoBiaoSong,serif;font-size:20px;text-align:center;text-indent:0;">标题</p>'
                + '<p data-level="date" style="margin:0;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:center;text-indent:0;">' + dateCn + '</p>'
                + '<p style="margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:2em;">&nbsp;</p>'
                + '<p style="margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:2em;">×××。</p>';
            var ps = editor.querySelectorAll('p');
            if (ps.length === 0) {
                editor.innerHTML = insertHtml;
                saveCurrentEditor();
                updateFooterTimestamp();
                showToast('已增加一篇');
                return;
            }
            var sel = window.getSelection();
            if (!sel.rangeCount || !editor.contains(sel.anchorNode)) { showToast('请将光标置于文章中'); return; }
            var node = sel.getRangeAt(0).startContainer;
            var cursorP = node.nodeType === 3 ? node.parentNode : node;
            while (cursorP && cursorP !== editor && cursorP.tagName !== 'P') cursorP = cursorP.parentNode;
            if (!cursorP || cursorP === editor) { showToast('请将光标置于文章中'); return; }
            var articles = [];
            for (var i = 0; i < ps.length; i++) {
                if (ps[i].getAttribute('data-outline-level') === '1') articles.push({ startIdx: i, endIdx: -1 });
            }
            if (articles.length === 0) {
                editor.innerHTML = (editor.innerHTML || '') + insertHtml;
                saveCurrentEditor();
                updateFooterTimestamp();
                showToast('已增加一篇');
                return;
            }
            for (var i = 0; i < articles.length; i++) {
                articles[i].endIdx = (i + 1 < articles.length) ? articles[i + 1].startIdx : ps.length;
            }
            var cursorIdx = -1;
            for (var i = 0; i < ps.length; i++) { if (ps[i] === cursorP) { cursorIdx = i; break; } }
            var curIdx = -1;
            for (var ai = 0; ai < articles.length; ai++) {
                if (cursorIdx >= articles[ai].startIdx && cursorIdx < articles[ai].endIdx) { curIdx = ai; break; }
            }
            if (curIdx === -1) { showToast('请将光标置于文章区域'); return; }
            var parts = [];
            for (var i = 0; i < ps.length; i++) parts.push(ps[i].outerHTML);
            var insertIdx = before ? articles[curIdx].startIdx : articles[curIdx].endIdx;
            parts.splice(insertIdx, 0, insertHtml);
            editor.innerHTML = parts.join('');
            saveCurrentEditor();
            updateFooterTimestamp();
            showToast(before ? '已在本篇之前增加一篇' : '已在本篇之后增加一篇');
        }
        function insertNotepadParagraphAtCursor() {
            _notepadRestoreSelection();
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var sel = window.getSelection();
            if (!sel.rangeCount || !editor.contains(sel.anchorNode)) { showToast('请将光标置于文稿内容中'); return; }
            var node = sel.getRangeAt(0).startContainer;
            var cursorP = node.nodeType === 3 ? node.parentNode : node;
            while (cursorP && cursorP !== editor && cursorP.tagName !== 'P') cursorP = cursorP.parentNode;
            if (!cursorP || cursorP === editor) { showToast('请将光标置于文稿内容中'); return; }
            var isBlank = !(cursorP.textContent || '').replace(/[\s\xa0\u200b\uFEFF]+/g, '') && !cursorP.querySelector('img');
            var targetP;
            if (isBlank) {
                targetP = cursorP;
                if (!targetP.innerHTML) targetP.innerHTML = '<br>';
            } else {
                targetP = document.createElement('p');
                targetP.style.cssText = cursorP.getAttribute('style') || 'margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:2em;';
                targetP.innerHTML = '<br>';
                cursorP.parentNode.insertBefore(targetP, cursorP.nextSibling);
            }
            saveCurrentEditor();
            updateFooterTimestamp();
            try {
                var range = document.createRange();
                range.setStart(targetP, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            } catch (e) {}
            showToast(isBlank ? '已在当前位置插入段落' : '已在当前段落之后插入新段落');
        }
        function _notepadSetAllArticlesCollapsed(collapsed) {
            if (_notepadDirActiveHide) { _notepadDirRestoreHidden(); }
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var headings = editor.querySelectorAll('p[data-outline-level="1"]');
            if (headings.length === 0) { showToast('没有可收起/展开的文章'); return; }
            for (var i = 0; i < headings.length; i++) {
                headings[i].setAttribute('data-collapsed', collapsed ? 'true' : 'false');
                _toggleArticleCollapse(editor, headings[i], collapsed);
            }
            saveCurrentEditor();
            showToast(collapsed ? '已全部收起' : '已全部展开');
        }
        function toggleAllNotepadArticles() {
            if (_notepadDirActiveHide) { _notepadDirRestoreHidden(); }
            var editor = document.getElementById('notepadEditor');
            var headings = editor.querySelectorAll('p[data-outline-level="1"]');
            if (headings.length === 0) { showToast('没有可收起的文章'); return; }
            var anyCollapsed = false;
            for (var i = 0; i < headings.length; i++) {
                if (headings[i].getAttribute('data-collapsed') === 'true') { anyCollapsed = true; break; }
            }
            var newCollapsed = !anyCollapsed;
            for (var i = 0; i < headings.length; i++) {
                headings[i].setAttribute('data-collapsed', newCollapsed ? 'true' : 'false');
                _toggleArticleCollapse(editor, headings[i], newCollapsed);
            }
            if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
            showToast(newCollapsed ? '已全部收起' : '已全部展开');
        }
        var _notepadOutlineDirReversed = false;
        var _notepadOutlineStructExpanded = true;
        var _notepadOutlineZoom = 1;
        function _npOutlineDisplayInfo(p, opts) {
            opts = opts || {};
            if (!p) return null;
            var txt = (p.textContent || '').replace(/^\s+|\s+$/g, '');
            if (!txt || txt === '（空）' || txt === '(空)') return null;
            if (p.getAttribute('data-level') === 'date' || p.getAttribute('data-level') === 'author') return null;
            // 合并段（索引标题 + 文章标题）优先按文章标题处理
            if (p.getAttribute('data-level') === 'title') {
                return { text: txt.replace(/^【[^】]*】\s*/, '').replace(/^\s+|\s+$/g, '') || txt, level: 1, isArticleTitle: true, element: p };
            }
            if (p.getAttribute('data-outline-level') === '1') {
                if (opts.indexAsTitle) {
                    var label = txt.replace(/^【[^】]*】\s*/, '').replace(/^\s+|\s+$/g, '') || txt;
                    return { text: label, level: 1, isArticleTitle: true, element: p };
                }
                return null;
            }
            if (p.getAttribute('data-level') === 'title') return { text: txt, level: 1, isArticleTitle: true, element: p };
            if (p.getAttribute('data-manual') === '1' && !p.getAttribute('data-level')) return null;
            var lv = p.getAttribute('data-outline-level') === '2' ? 1 : (p.getAttribute('data-outline-level') === '3' ? 2 : null);
            if (lv === null) {
                var aiLv = p.getAttribute('data-ai-heading-level');
                if (aiLv === '1' || aiLv === '2' || aiLv === '3') lv = parseInt(aiLv, 10);
            }
            if (lv === null) return null;
            var first;
            if (p.getAttribute('data-manual') === '1') {
                first = _extractManualHeadingText(p, lv);
                if (!first) first = extractFirstSentence(txt).sentence || '';
            } else {
                first = extractFirstSentence(txt).sentence || '';
            }
            first = first.replace(/^\s+|\s+$/g, '');
            if (!first || first === '（空）' || first === '(空)') return null;
            /* 文字实际字体必须与层级一致（一级黑体 / 二级楷体 / 三级仿宋加粗）。
               段落标签残留、但整段已被改成仿宋时不再当标题，避免提纲冒出不存在的标题。 */
            if (typeof window._npTextFontLevel === 'function') {
                var _npFontLv = null;
                try { _npFontLv = window._npTextFontLevel(p, first); } catch (e5) { _npFontLv = null; }
                if (_npFontLv === null || _npFontLv !== lv) return null;
            }
            return { text: first, level: lv, isArticleTitle: false, element: p };
        }
        function _npIsRemarkTextNode(node, root) {
            var el = node && node.nodeType === 1 ? node : (node ? node.parentNode : null);
            while (el && el !== root) {
                if (el.nodeType === 1) {
                    var sf = (el.style.fontFamily || '').replace(/[\'"]/g, '').toLowerCase();
                    var fs = el.style.fontSize || '';
                    var fw = (el.style.fontWeight || '').toLowerCase();
                    if ((sf.indexOf('楷体') !== -1 || sf.indexOf('kaiti') !== -1) && (fs === '14px' || fs === '14pt') && fw !== 'bold') return true;
                }
                el = el.parentNode;
            }
            return false;
        }
        function _npIsRemarkOnlyPara(p) {
            if (!p || p.nodeType !== 1) return false;
            var text = (p.textContent || '').replace(/[\s\xa0\u200b\uFEFF]+/g, '');
            if (!text) return false;
            var remarkText = '';
            var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
            while (walker.nextNode()) {
                var t = (walker.currentNode.textContent || '').replace(/[\s\xa0\u200b\uFEFF]+/g, '');
                if (!t) continue;
                if (!_npIsRemarkTextNode(walker.currentNode, p)) return false;
                remarkText += t;
            }
            return remarkText === text;
        }
        function _detectHeadingDisplayLevel(p) {
            if (_npIsRemarkOnlyPara(p)) return null;
            var ff = (p.style.fontFamily || '').replace(/[\'"]/g, '').toLowerCase();
            var fw = (p.style.fontWeight || '').toLowerCase();
            var ta = (p.style.textAlign || '').toLowerCase();
            var fs = p.style.fontSize;
            if (ta === 'center' && (fs === '20px' || fs === '20pt') && ff.indexOf('小标宋') !== -1) return 1;
            if ((ff.indexOf('黑体') !== -1 || ff.indexOf('simhei') !== -1) && ff.indexOf('小标宋') === -1) return 1;
            if (ff.indexOf('楷体') !== -1 || ff.indexOf('kaiti') !== -1) return 2;
            if ((ff.indexOf('仿宋') !== -1 || ff.indexOf('fangsong') !== -1) && fw === 'bold') return 3;
            var lv = p.getAttribute('data-outline-level');
            if (lv === '2') return 1;
            if (lv === '3') return 2;
            //  manual para: check span styles first to avoid text-pattern early return
            if (p.getAttribute('data-manual') === '1') {
                var spans = p.querySelectorAll('span');
                for (var si = 0; si < spans.length; si++) {
                    var sf = (spans[si].style.fontFamily || '').replace(/['"]/g, '').toLowerCase();
                    var sfw = (spans[si].style.fontWeight || '').toLowerCase();
                    if ((sf.indexOf('黑体') !== -1 || sf.indexOf('simhei') !== -1) && sf.indexOf('小标宋') === -1) return 1;
                    if (sf.indexOf('楷体') !== -1 || sf.indexOf('kaiti') !== -1) return 2;
                    if ((sf.indexOf('仿宋') !== -1 || sf.indexOf('fangsong') !== -1) && sfw === 'bold') return 3;
                }
            }
            var tr = (p.textContent || '').replace(/^\s+|\s+$/g, '');
            if (tr.match(/^([一二三四五六七八九十]+)、/)) return 1;
            if (tr.match(/^(第[一二三四五六七八九十]+)[，,]/)) return 2;
            if (tr.match(/^（[一二三四五六七八九十]+）/) || tr.match(/^\([一二三四五六七八九十]+\)/)) return 2;
            if (tr.match(/^(\d+)[.、．]/)) return null;
            if (tr.match(/^[一二三四五六七八九十]+[是要看抓查学紧盯聚焦]/)) return null;
            if (p.getAttribute('data-manual') === '1') {
                var spans = p.querySelectorAll('span');
                for (var si = 0; si < spans.length; si++) {
                    var sf = (spans[si].style.fontFamily || '').replace(/['"]/g, '').toLowerCase();
                    var sfw = (spans[si].style.fontWeight || '').toLowerCase();
                    if ((sf.indexOf('黑体') !== -1 || sf.indexOf('simhei') !== -1) && sf.indexOf('小标宋') === -1) return 1;
                    if (sf.indexOf('楷体') !== -1 || sf.indexOf('kaiti') !== -1) return 2;
                    if ((sf.indexOf('仿宋') !== -1 || sf.indexOf('fangsong') !== -1) && sfw === 'bold') return 3;
                }
            }
            return null;
        }
        function _extractManualHeadingText(p, lv) {
            var spans = p.querySelectorAll('span');
            for (var si = 0; si < spans.length; si++) {
                var sf = (spans[si].style.fontFamily || '').replace(/['"]/g, '').toLowerCase();
                var sfw = (spans[si].style.fontWeight || '').toLowerCase();
                var spanLevel = null;
                if ((sf.indexOf('黑体') !== -1 || sf.indexOf('simhei') !== -1) && sf.indexOf('小标宋') === -1) spanLevel = 1;
                else if (sf.indexOf('楷体') !== -1 || sf.indexOf('kaiti') !== -1) spanLevel = 2;
                else if ((sf.indexOf('仿宋') !== -1 || sf.indexOf('fangsong') !== -1) && sfw === 'bold') spanLevel = 3;
                if (spanLevel === lv) {
                    var txt = (spans[si].textContent || '').replace(/^\s+|\s+$/g, '');
                    if (txt) return txt;
                }
            }
            return '';
        }
        function _npManualNodeHeadingLevel(node, root) {
            if (_npIsRemarkTextNode(node, root)) return null;
            var el = node && node.nodeType === 1 ? node : node.parentNode;
            while (el && el !== root) {
                if (el.nodeType === 1) {
                    var sf = (el.style.fontFamily || '').replace(/[\'"]/g, '').toLowerCase();
                    var sfw = (el.style.fontWeight || '').toLowerCase();
                    var sfs = el.style.fontSize || '';
                    if ((sf.indexOf('黑体') !== -1 || sf.indexOf('simhei') !== -1) && sf.indexOf('小标宋') === -1) return 1;
                    if ((sf.indexOf('楷体') !== -1 || sf.indexOf('kaiti') !== -1) && !(sfs === '14px' || sfs === '14pt')) return 2;
                    if ((sf.indexOf('仿宋') !== -1 || sf.indexOf('fangsong') !== -1) && sfw === 'bold') return 3;
                }
                el = el.parentNode;
            }
            return null;
        }
        function _npOutlineExtraEntries(p) {
            var extra = [];
            if (p.getAttribute('data-manual') !== '1') return extra;
            var seen = {};
            var cur = null;
            function flush() {
                if (!cur) return;
                var txt = cur.text.replace(/^\s+|\s+$/g, '');
                if (txt && !/^[。．.，,、；;：:！!？?（）()【】\[\]《》<>“”"'‘’]+$/.test(txt) && !seen[txt]) {
                    extra.push({ text: txt, level: cur.level });
                    seen[txt] = true;
                }
                cur = null;
            }
            var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
            while (walker.nextNode()) {
                var t = walker.currentNode.textContent || '';
                if (!t) continue;
                var lv = _npManualNodeHeadingLevel(walker.currentNode, p);
                if (lv === null) { flush(); continue; }
                if (!cur || cur.level !== lv) { flush(); cur = { text: '', level: lv }; }
                cur.text += t;
            }
            flush();
            return extra;
        }
        function _notepadOutlineRenderStruct() {
            _updateOutlineBg();
            var list = document.getElementById('notepadOutlineList');
            list.innerHTML = '';
            var editor = document.getElementById('notepadEditor');
            if (_structArticleIdx >= 0 && _structArticleIdx < _notepadDirectoryEntries.length) {
                var entry = _notepadDirectoryEntries[_structArticleIdx];
                if (!entry) return;
                var ps = editor.querySelectorAll('p');
                var startIdx = -1;
                for (var pi = 0; pi < ps.length; pi++) {
                    if (ps[pi].textContent.trim() === entry.articleText && _npIsArticleTitlePara(ps[pi])) {
                        startIdx = pi; break;
                    }
                }
                if (startIdx === -1) return;
                var endIdx = _npArticleEndIndex(ps, startIdx);
                var titleLi = document.createElement('li');
                var titleText = '';
                var _startIsIndex = ps[startIdx].getAttribute('data-outline-level') === '1';
                if (_startIsIndex) {
                    titleText = _npDirectoryLabel(entry.articleText || ps[startIdx].textContent || '');
                } else {
                    for (var tpi = startIdx; tpi < endIdx; tpi++) {
                        var tInfo = _npOutlineDisplayInfo(ps[tpi]);
                        if (tInfo && tInfo.isArticleTitle) { titleText = tInfo.text; break; }
                    }
                }
                titleLi.textContent = titleText || entry.label || '(未命名文章)';
                titleLi.style.fontFamily = '方正小标宋简体,FZXiaoBiaoSong,SimSun,serif';
                 titleLi.style.fontWeight = 'bold';
                 titleLi.style.paddingLeft = '6px';
                 titleLi.style.fontWeight = 'normal';
                 titleLi.style.boxSizing = 'border-box';
                 titleLi.style.textIndent = '0';
                 titleLi.style.marginLeft = '0';
                titleLi.style.color = '#2c3e50';
                titleLi.style.cursor = 'default';
                titleLi.style.borderBottom = '2px solid #667eea';
                titleLi.style.marginBottom = '4px';
                var titleP = ps[startIdx];
                titleLi.onclick = function() { if (titleP) titleP.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
                list.appendChild(titleLi);
                var headingItems = [];
                for (var pi = startIdx + 1; pi < endIdx; pi++) {
                    var p = ps[pi];
                    var info = _npOutlineDisplayInfo(p);
                    if (info && info.isArticleTitle) continue;
                    if (info) headingItems.push({ p: p, level: info.level, text: info.text });
                    // 手动设置的层级（applyNotepadLevel）整段会被标记为 data-manual 且 _npOutlineDisplayInfo 返回 null，
                    // 这里必须独立收集其附加层级标题，否则手动设置的二级标题不会出现在笔记提纲中
                    var extra = _npOutlineExtraEntries(p);
                    for (var ei = 0; ei < extra.length; ei++) {
                        if (!info || extra[ei].text !== info.text) headingItems.push({ p: p, level: extra[ei].level, text: extra[ei].text });
                    }
                }
                if (headingItems.length > 0) {
                    var minLevel = 1;
                    for (var hi = 0; hi < headingItems.length; hi++) {
                        if (headingItems[hi].level < minLevel) minLevel = headingItems[hi].level;
                    }
                    for (var hi = 0; hi < headingItems.length; hi++) {
                        var relLevel = headingItems[hi].level - minLevel + 1;
                        if (relLevel < 1) relLevel = 1;
                        if (relLevel > 3) relLevel = 3;
                        if (!_notepadOutlineStructExpanded && relLevel !== 1) continue;
                        var li = document.createElement('li');
                        var tp = headingItems[hi].p;
                        li.textContent = headingItems[hi].text;
                        if (_notepadOutlineStructExpanded) {
                            if (relLevel === 2) li.style.paddingLeft = '1em';
                            else if (relLevel === 3) li.style.paddingLeft = '2em';
                        } else {
                            if (relLevel === 2) li.style.marginLeft = '16px';
                            else if (relLevel === 3) li.style.marginLeft = '32px';
                        }
                            if (relLevel === 1) li.style.fontFamily = '黑体,SimHei,sans-serif';
                            if (relLevel === 2) li.style.fontFamily = '楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif';
                            if (relLevel === 3) { li.style.fontFamily = '仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif'; li.style.fontWeight = 'bold'; }
                            _notepadOutlineBindStructItem(li, { text: headingItems[hi].text, element: tp, level: headingItems[hi].level, isArticleTitle: false });
                            (function(tp) { li.onclick = function() { tp.scrollIntoView({ behavior: 'smooth', block: 'center' }); }; })(tp);
                            list.appendChild(li);
                    }
                } else {
                    var li = document.createElement('li');
                    li.textContent = '（该文章下无层级标题）'; li.style.cursor = 'default'; li.style.color = '#999';
                    list.appendChild(li);
                }
            } else {
                var headings = [];
                if (editor) {
                    var ps = editor.querySelectorAll('p');
                    for (var i = 0; i < ps.length; i++) {
                        var p = ps[i];
                        var info = _npOutlineDisplayInfo(p);
                        if (info) headings.push({ text: info.text, element: p, level: String(info.level), isArticleTitle: info.isArticleTitle });
                        var extra = _npOutlineExtraEntries(p);
                        for (var ei = 0; ei < extra.length; ei++) {
                            if (extra[ei].text !== info.text) headings.push({ text: extra[ei].text, element: p, level: String(extra[ei].level), isArticleTitle: false });
                        }
                    }
                }
                var hasArticleTitle = false;
                for (var ht = 0; ht < headings.length; ht++) { if (headings[ht].isArticleTitle) { hasArticleTitle = true; break; } }
                if (hasArticleTitle) headings = headings.filter(function(h) { return h.isArticleTitle; });
                if (headings.length === 0) {
                    var li = document.createElement('li');
                    li.textContent = '（暂无文章标题）';
                    li.style.cursor = 'default';
                    li.style.color = '#999';
                    list.appendChild(li);
                } else {
                    for (var i = 0; i < headings.length; i++) {
                        (function(idx) {
                            var p = headings[idx].element;
                            var level = headings[idx].level;
                            if (!_notepadOutlineStructExpanded && level !== '1' && level !== '2') return;
                            if (!_notepadOutlineStructExpanded && level === '2' && !p.getAttribute('data-outline-level')) return;
                            var li = document.createElement('li');
                            li.textContent = headings[idx].text;
                            if (_notepadOutlineStructExpanded) {
                                if (level === '2' || level === '3') {
                                    li.style.paddingLeft = level === '2' ? '1em' : '2em';
                                }
                            } else {
                                if (level === '2') li.style.marginLeft = '16px';
                                else if (level === '3') li.style.marginLeft = '32px';
                            }
                            if (level === '1' || !level) li.style.fontFamily = '黑体,SimHei,sans-serif';
                            if (level === '2') li.style.fontFamily = '楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif';
                            if (level === '3') { li.style.fontFamily = '仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif'; li.style.fontWeight = 'bold'; }
                            _notepadOutlineBindStructItem(li, { text: headings[idx].text, element: p, level: parseInt(level || '1', 10), isArticleTitle: headings[idx].isArticleTitle });
                            li.onclick = function() {
                                _lastSelectedStructIdx = idx;
                                var sibs = list.querySelectorAll('.notepadOutlineSelected');
                                for (var si = 0; si < sibs.length; si++) sibs[si].classList.remove('notepadOutlineSelected');
                                li.classList.add('notepadOutlineSelected');
                                if (headings[idx].element && headings[idx].element.parentNode) {
                                    headings[idx].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                            };
                            list.appendChild(li);
                        })(i);
                    }
                }
                if (_lastSelectedStructIdx >= 0 && _lastSelectedStructIdx < list.children.length) {
                    list.children[_lastSelectedStructIdx].classList.add('notepadOutlineSelected');
                }
            }
        }
        function switchOutlineTab(tab) {
            var editor = document.getElementById('notepadEditor');
            var tabs = document.querySelectorAll('.notepadOutlineTab');
            for (var t = 0; t < tabs.length; t++) tabs[t].classList.toggle('active', tabs[t].getAttribute('data-otab') === tab);
            var dirTab = document.getElementById('notepadOutlineDirTab');
            var structTab = document.getElementById('notepadOutlineStructTab');
            dirTab.classList.toggle('show', tab === 'dir');
            structTab.classList.toggle('show', tab === 'struct');
            var structBtn = document.querySelector('.notepadOutlineTab[data-otab="struct"]');
            if (structBtn) {
                if (tab === 'struct') {
                    if (structBtn.textContent.indexOf('>>') === -1) structBtn.textContent = '>> ' + structBtn.textContent.trim();
                } else {
                    structBtn.textContent = structBtn.textContent.replace(/^>>\s*/, '');
                }
            }
            var orderBtn = document.getElementById('notepadOutlineOrderBtn');
            var expandBtn = document.getElementById('notepadOutlineExpandBtn');
            if (tab === 'dir') {
                orderBtn.style.display = '';
                if (orderBtn) orderBtn.textContent = _notepadOutlineDirReversed ? '逆序' : '顺序';
                expandBtn.style.display = 'none';
                _renderDirTab();
            } else {
                orderBtn.style.display = 'none';
                expandBtn.style.display = '';
                if (expandBtn) expandBtn.textContent = _notepadOutlineStructExpanded ? '收起' : '展开';
                _notepadOutlineRenderStruct();
            }
        }
        function _renderDirTab() {
            _updateOutlineBg();
            var editor = document.getElementById('notepadEditor');
            var sourceRoot = _notepadDirSourceRoot();
            var dirTabEl = document.getElementById('notepadOutlineDirTab');
            dirTabEl.innerHTML = '';
            if (!_notepadDirectoryEntries || _notepadDirectoryEntries.length === 0) {
                dirTabEl.innerHTML = '<div style="padding:12px;color:#999;font-size:14px;text-align:center;">（暂无目录）</div>';
                return;
            }
            var indices = [];
            for (var i = 0; i < _notepadDirectoryEntries.length; i++) indices.push(i);
            if (_notepadOutlineDirReversed) indices.reverse();
            for (var di = 0; di < indices.length; di++) {
                (function(didx) {
                    var div = document.createElement('div');
                    div.className = 'notepadOutlineDirItem';
                    div.dataset.dirIdx = didx;
                    div.textContent = _notepadDirectoryEntries[didx].label;
                    div.onclick = function() { _notepadDirSelectEntry(didx); };
                    div.oncontextmenu = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        _notepadDirCtxIndex = didx;
                        var menu = document.getElementById('notepadDirCtxMenu');
                        if (!menu) return;
                        menu.style.left = e.clientX + 'px';
                        menu.style.top = e.clientY + 'px';
                        menu.classList.add('show');
                    };
                    dirTabEl.appendChild(div);
                })(indices[di]);
            }
            if (_lastSelectedDirIdx >= 0) {
                var selItem = dirTabEl.querySelector('[data-dir-idx="' + _lastSelectedDirIdx + '"]');
                if (selItem) selItem.classList.add('notepadOutlineSelected');
            }
        }
        function notepadOutlineToggleOrder() {
            _notepadOutlineDirReversed = !_notepadOutlineDirReversed;
            var btn = document.getElementById('notepadOutlineOrderBtn');
            if (btn) btn.textContent = _notepadOutlineDirReversed ? '逆序' : '顺序';
            _renderDirTab();
        }
        function notepadOutlineToggleExpand() {
            _notepadOutlineStructExpanded = !_notepadOutlineStructExpanded;
            var btn = document.getElementById('notepadOutlineExpandBtn');
            if (btn) btn.textContent = _notepadOutlineStructExpanded ? '收起' : '展开';
            _notepadOutlineRenderStruct();
        }
        function _refreshTilePreviewContent() {
            var container = document.getElementById('tileContainer');
            if (!container || !tileVisible) return;
            var bgColors = ['bg0','bg1','bg2','bg3','bg4'];
            if (notepadTileMode === 'stack') {
                var textarea = container.querySelector('.stackContent .tileTextarea');
                if (textarea) {
                    textarea.className = 'tileTextarea ' + bgColors[_stackActiveTab];
                    textarea.innerHTML = (notepadEditorData[_stackActiveTab] && notepadEditorData[_stackActiveTab].html) || '';
                    _npWinZoomApplyTextarea(textarea, (_npWinZoomLoad()[_stackActiveTab] || 1));
                }
                return;
            }
            var wins = _tileVisibleWindows();
            for (var i = 0; i < wins.length; i++) {
                var idx = parseInt(wins[i].dataset.tabIndex, 10);
                var txt = wins[i].querySelector('.tileTextarea');
                if (txt && isFinite(idx)) {
                    txt.innerHTML = (notepadEditorData[idx] && notepadEditorData[idx].html) || '';
                    _npWinZoomApplyTextarea(txt, (_npWinZoomLoad()[idx] || 1));
                }
            }
        }
        function _switchStackTab(tabIndex) {
            S._stackActiveTab = tabIndex;
            var container = document.getElementById('tileContainer');
            if (!container) return;
            var btns = container.querySelectorAll('.stackTabBtn');
            for (var i = 0; i < btns.length; i++) {
                btns[i].classList.toggle('active', parseInt(btns[i].dataset.stackTabIndex, 10) === tabIndex);
            }
            var content = container.querySelector('.stackContent');
            if (content) {
                var textarea = content.querySelector('.tileTextarea');
                if (textarea) {
                    textarea.className = 'tileTextarea bg' + tabIndex;
                    textarea.innerHTML = (notepadEditorData[tabIndex] && notepadEditorData[tabIndex].html) || '';
                    _npWinZoomApplyTextarea(textarea, (_npWinZoomLoad()[tabIndex] || 1));
                }
                var oldBar = content.querySelector(':scope > .tileZoomBar');
                if (oldBar) oldBar.remove();
                content.appendChild(_buildTileZoomBar(tabIndex));
            }
            updateNotepadTabStyle();
        }
        function _removeStackSplitDivider() {
            if (_stackSplitDivider) {
                _stackSplitDivider.remove();
                S._stackSplitDivider = null;
            }
        }
        function _tileVisibleWindows() {
            var container = document.getElementById('tileContainer');
            return container ? Array.prototype.slice.call(container.querySelectorAll('.tileWindow')) : [];
        }
        function _tileSaveRatios() {
            var container = document.getElementById('tileContainer');
            var wins = _tileVisibleWindows();
            if (!container || !wins.length) return [];
            var totalW = Math.max(1, container.getBoundingClientRect().width);
            var ratios = [];
            for (var i = 0; i < wins.length; i++) ratios.push(Math.max(0.05, wins[i].getBoundingClientRect().width / totalW));
            var sum = ratios.reduce(function(a, b) { return a + b; }, 0) || 1;
            for (var j = 0; j < ratios.length; j++) ratios[j] = ratios[j] / sum;
            return ratios;
        }
        function _rebalanceTilePositionsByRatios(ratios) {
            if (notepadTileMode === 'stack') return;
            var container = document.getElementById('tileContainer');
            if (!container) return;
            var wins = _tileVisibleWindows();
            if (wins.length === 0) { hideTile(); return; }
            var gap = 6;
            var totalW = Math.max(200, container.offsetWidth || container.getBoundingClientRect().width);
            var usableW = Math.max(80, totalW - gap * (wins.length - 1));
            if (!ratios || ratios.length !== wins.length) {
                ratios = [];
                for (var r = 0; r < wins.length; r++) ratios.push(1 / wins.length);
            }
            var sum = ratios.reduce(function(a, b) { return a + b; }, 0) || 1;
            var leftPos = 0;
            for (var i = 0; i < wins.length; i++) {
                var w = (i === wins.length - 1) ? (totalW - leftPos) : Math.max(80, usableW * ratios[i] / sum);
                wins[i].style.left = leftPos + 'px';
                wins[i].style.width = w + 'px';
                wins[i].style.top = '0px';
                wins[i].style.bottom = '0px';
                leftPos += w + gap;
            }
        }
        function _applyTileSplit(dividerX, ratios) {
            var panel = document.getElementById('notepadPanel');
            var container = document.getElementById('tileContainer');
            var layer = document.getElementById('notepadDockLayer');
            if (!panel || !container || !layer) return;
            var pr = _dockRect(panel);
            var maxRight = layer.clientWidth - 8;
            var rawX = parseFloat(dividerX);
            if (!isFinite(rawX) || rawX <= pr.left) rawX = pr.right;
            var x = Math.max(pr.left + 220, Math.min(maxRight - 220, rawX));
            _npSetBox(panel, { left: pr.left, top: pr.top, width: x - pr.left, height: pr.height });
            _npSetBox(container, { left: x, top: pr.top, width: Math.max(220, maxRight - x), height: pr.height });
            container.style.position = 'absolute';
            container.style.zoom = '';
            if (notepadTileMode === 'tile') _rebalanceTilePositionsByRatios(ratios);
            if (notepadTileMode === 'stack') container.classList.add('stack-mode');
            if (_stackSplitDivider) {
                _stackSplitDivider.style.left = x + 'px';
                _stackSplitDivider.style.top = pr.top + 'px';
                _stackSplitDivider.style.height = pr.height + 'px';
                _stackSplitDivider.style.display = 'block';
            }
            updateNotepadSearchWidth();
        }
        function _applyStackSplit(dividerX) {
            _applyTileSplit(dividerX);
        }
        function _syncTileLayoutFromPanel() {
            if (!tileVisible) return;
            var panel = document.getElementById('notepadPanel');
            var container = document.getElementById('tileContainer');
            if (!panel || !container) return;
            var ratios = _tileSaveRatios();
            var layer = document.getElementById('notepadDockLayer');
            var pr = _dockRect(panel);
            var maxRight = layer.clientWidth - 8;
            _npSetBox(container, { left: pr.right, top: pr.top, width: Math.max(220, maxRight - pr.right), height: pr.height });
            container.style.zoom = '';
            if (notepadTileMode === 'tile') _rebalanceTilePositionsByRatios(ratios);
            if (_stackSplitDivider) {
                _stackSplitDivider.style.left = pr.right + 'px';
                _stackSplitDivider.style.top = pr.top + 'px';
                _stackSplitDivider.style.height = pr.height + 'px';
                _stackSplitDivider.style.display = 'block';
            }
        }
        function _setupStackSplitDivider() {
            _removeStackSplitDivider();
            var divider = document.createElement('div');
            divider.className = 'stackSplitDivider';
            document.body.appendChild(divider);
            S._stackSplitDivider = divider;
            divider.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                divider.classList.add('dragging');
                var layer = document.getElementById('notepadDockLayer');
                function onMove(ev) { var lr = layer.getBoundingClientRect(); _applyTileSplit(ev.clientX - lr.left); }
                function onUp() {
                    divider.classList.remove('dragging');
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        }

        
        function setTileMode(mode) {
            if (mode === 'normal') {
                hideTile();
            } else {
                showTile(mode);
            }
            updateNotepadTabStyle();
        }
        var NP_WIN_ZOOM_KEY = 'notepadWinZoomCache';
        var _npWinZoomCache = null;
        function _npWinZoomLoad() {
            if (_npWinZoomCache) return _npWinZoomCache;
            var arr = [];
            for (var _zi = 0; _zi < npTabCount(); _zi++) arr.push(1);
            try {
                var raw = DataLayer.getRaw(NP_WIN_ZOOM_KEY);
                if (raw) {
                    var p = JSON.parse(raw);
                    if (Array.isArray(p) && p.length >= npTabCount()) {
                        for (var i = 0; i < npTabCount(); i++) {
                            if (typeof p[i] === 'number' && isFinite(p[i])) arr[i] = Math.min(3, Math.max(0.4, p[i]));
                        }
                    }
                }
            } catch (e) {}
            _npWinZoomCache = arr;
            return arr;
        }
        function _npWinZoomSave() {
            try { DataLayer.set(NP_WIN_ZOOM_KEY, _npWinZoomCache) } catch (e) {}
        }
        function _npWinZoomApplyTextarea(ta, ratio) {
            if (ta && typeof ratio === 'number' && isFinite(ratio)) {
                ta.style.fontSize = Math.round(14 * ratio * 100) / 100 + 'px';
                ta.style.zoom = Math.max(0.4, Math.min(3, ratio));
            }
        }
        function _buildTileZoomBar(tabIdx) {
            var bar = document.createElement('div');
            bar.className = 'tileZoomBar';
            var btnIn = document.createElement('button');
            btnIn.type = 'button';
            btnIn.className = 'tileZoomBtn';
            btnIn.title = '放大';
            var imgIn = document.createElement('img');
            imgIn.src = 'data/enlarge-1.ico';
            imgIn.alt = '放大';
            btnIn.appendChild(imgIn);
            btnIn.onclick = function(e) { e.stopPropagation(); _npWinZoom(tabIdx, 1); };
            var btnOut = document.createElement('button');
            btnOut.type = 'button';
            btnOut.className = 'tileZoomBtn';
            btnOut.title = '缩小';
            var imgOut = document.createElement('img');
            imgOut.src = 'data/reduce-1.ico';
            imgOut.alt = '缩小';
            btnOut.appendChild(imgOut);
            btnOut.onclick = function(e) { e.stopPropagation(); _npWinZoom(tabIdx, -1); };
            bar.appendChild(btnIn);
            bar.appendChild(btnOut);
            return bar;
        }
        function _npWinZoom(tabIdx, delta) {
            var arr = _npWinZoomLoad();
            var cur = arr[tabIdx] || 1;
            cur = delta < 0 ? Math.max(0.4, cur / 1.1) : Math.min(3, cur * 1.1);
            arr[tabIdx] = cur;
            _npWinZoomSave();
            var ratio = arr[tabIdx];
            if (notepadTileMode === 'tile') {
                var wins = _tileVisibleWindows();
                for (var i = 0; i < wins.length; i++) {
                    if (parseInt(wins[i].dataset.tabIndex, 10) === tabIdx) {
                        _npWinZoomApplyTextarea(wins[i].querySelector('.tileTextarea'), ratio);
                    }
                }
            } else if (notepadTileMode === 'stack') {
                var container = document.getElementById('tileContainer');
                _npWinZoomApplyTextarea(container ? container.querySelector('.stackContent .tileTextarea') : null, ratio);
            }
        }
        var notepadPanelWidth = 360;
        var tileZIndex = 99;
        var _npOriginalParent = null;
        var _npOriginalNext = null;
        var _tileOriginalParent = null;
        var _tileOriginalNext = null;
        var leftPanelHidden = false;
        function toggleCalendar() {
            var panel = document.getElementById('leftPanel');
            leftPanelHidden = !leftPanelHidden;
            if (leftPanelHidden) {
                panel.style.display = 'none';
                document.getElementById('calendarToggleBtn').style.opacity = '0.5';
            } else {
                panel.style.display = 'flex';
                document.getElementById('calendarToggleBtn').style.opacity = '1';
            }
            setTimeout(function() { renderTrackContent(); }, 50);
        }
        function changeNotepadWidth(delta) {
            var panel = document.getElementById('notepadPanel');
            notepadPanelWidth = Math.max(200, Math.min(800, notepadPanelWidth + delta * 20));
            panel.style.width = notepadPanelWidth + 'px';
            if (tileVisible) _applyTileSplit(_npCssRect(panel).right);
        }
        function _enterNotepadDockLayer() {
            var layer = document.getElementById('notepadDockLayer');
            var panel = document.getElementById('notepadPanel');
            var container = document.getElementById('tileContainer');
            if (!layer || !panel || !container) return;
            if (!layer.classList.contains('show')) layer.classList.add('show');
            if (panel.parentNode !== layer) {
                _npOriginalParent = panel.parentNode;
                _npOriginalNext = panel.nextSibling;
                layer.appendChild(panel);
            }
            if (container.parentNode !== layer) {
                _tileOriginalParent = container.parentNode;
                _tileOriginalNext = container.nextSibling;
                layer.appendChild(container);
            }
            panel.style.zoom = '';
            panel.style.display = 'flex';
            container.style.zoom = '';
        }
        function _exitNotepadDockLayer() {
            var layer = document.getElementById('notepadDockLayer');
            var panel = document.getElementById('notepadPanel');
            var container = document.getElementById('tileContainer');
            if (panel && _npOriginalParent && panel.parentNode === layer) _npOriginalParent.insertBefore(panel, _npOriginalNext);
            if (container && _tileOriginalParent && container.parentNode === layer) _tileOriginalParent.insertBefore(container, _tileOriginalNext);
            if (layer) layer.classList.remove('show');
            if (panel) panel.style.zoom = _npMainZoom();
            if (container) container.style.zoom = '';
        }
        function _dockRect(el) {
            var layer = document.getElementById('notepadDockLayer');
            var lr = layer.getBoundingClientRect();
            var r = el.getBoundingClientRect();
            return { left:r.left - lr.left, top:r.top - lr.top, right:r.right - lr.left, bottom:r.bottom - lr.top, width:r.width, height:r.height };
        }
        function _syncPanelDefaultBoundsForZoom(zv) {
            var zVal = parseFloat(zv) || _npMainZoom();
            if (!_notepadInitialBounds) S._notepadInitialBounds = { top:'75px', left:'15px', width:'1180px', height:'', bottom:'15px' };
            _notepadInitialBounds.top = (75 / zVal) + 'px';
            _notepadInitialBounds.left = (15 / zVal) + 'px';
            _notepadInitialBounds.width = (Math.min(1180, window.innerWidth - 30) / zVal) + 'px';
            _notepadInitialBounds.bottom = (15 / zVal) + 'px';
            if (typeof window !== 'undefined') window.syncPanelDefaultBoundsForZoom = _syncPanelDefaultBoundsForZoom;
        }
        if (typeof window !== 'undefined') window.syncPanelDefaultBoundsForZoom = _syncPanelDefaultBoundsForZoom;
        function _resetNotepadPanelForTile() {
            var panel = document.getElementById('notepadPanel');
            var layer = document.getElementById('notepadDockLayer');
            var rp = document.getElementById('rightPanel');
            if (!panel || !layer) return;
            panel.classList.remove('notepadFullscreen');
            var top = 15, height = Math.max(220, layer.clientHeight - 30);
            if (rp) {
                var lr = layer.getBoundingClientRect();
                var rr = rp.getBoundingClientRect();
                top = rr.top - lr.top;
                height = rr.height;
            }
            panel.style.left = '15px';
            panel.style.top = top + 'px';
            panel.style.width = Math.min(1180, window.innerWidth - 30) + 'px';
            panel.style.height = height + 'px';
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
            panel.dataset.npUserMoved = '1';
        }
        function showTile(mode) {
            if (!mode) mode = notepadTileMode || 'tile';
            saveCurrentEditor();
            _enterNotepadDockLayer();
            _resetNotepadPanelForTile();
            var container = document.getElementById('tileContainer');
            container.innerHTML = '';
            container.classList.remove('stack-mode');
            _removeStackSplitDivider();
            var panel = document.getElementById('notepadPanel');
            var pr0 = _dockRect(panel);
            var splitX = pr0.right;
            var layer = document.getElementById('notepadDockLayer');
            var maxRight = layer.clientWidth - 8;
            _npSetBox(container, { left: pr0.right, top: pr0.top, width: Math.max(220, maxRight - pr0.right), height: pr0.height });
            panel.style.right = 'auto';
            container.style.position = 'absolute';
            container.style.zoom = '';
            container.classList.add('show');
            var totalW = container.offsetWidth || Math.max(220, maxRight - pr0.right);
            totalW = Math.max(200, totalW);
            var tabCount = 0;
            for (var ti = 0; ti < npTabCount(); ti++) { if (ti !== currentNotepadTab) tabCount++; }
            if (tabCount === 0) { showToast('没有可平铺的窗口'); return; }
            var gap = 6;
            var colors = ['color0','color1','color2','color3','color4'];
            var bgColors = ['bg0','bg1','bg2','bg3','bg4'];
            var leftPos = 0;
            var isStack = (mode === 'stack');
            S.tileVisible = true;
            S.notepadTileMode = mode || 'tile';
            if (isStack) {
                var otherTabs = [];
                for (var ti = 0; ti < npTabCount(); ti++) { if (ti !== currentNotepadTab) otherTabs.push(ti); }
                if (otherTabs.length === 0) { showToast('没有可叠放的窗口'); return; }
                container.classList.add('stack-mode');
                _stackActiveTab = otherTabs[0];
                var stackHeader = document.createElement('div');
                stackHeader.className = 'stackHeader';
                for (var s = 0; s < otherTabs.length; s++) {
                    var tabIdx = otherTabs[s];
                    var tabBtn = document.createElement('button');
                    tabBtn.className = 'stackTabBtn ' + colors[tabIdx];
                    tabBtn.textContent = '' + (tabIdx + 1);
                    tabBtn.dataset.stackTabIndex = tabIdx;
                    if (s === 0) tabBtn.classList.add('active');
                    (function(idx) {
                        tabBtn.onclick = function() { _switchStackTab(idx); };
                    })(tabIdx);
                    stackHeader.appendChild(tabBtn);
                }
                container.appendChild(stackHeader);
                var stackContent = document.createElement('div');
                stackContent.className = 'stackContent';
                var stackTextarea = document.createElement('div');
                stackTextarea.className = 'tileTextarea ' + bgColors[_stackActiveTab];
                stackTextarea.style.whiteSpace = 'pre-wrap';
                stackTextarea.innerHTML = (notepadEditorData[_stackActiveTab] && notepadEditorData[_stackActiveTab].html) || '';
                _npWinZoomApplyTextarea(stackTextarea, (_npWinZoomLoad()[_stackActiveTab] || 1));
                stackContent.appendChild(stackTextarea);
                stackContent.appendChild(_buildTileZoomBar(_stackActiveTab));
                container.appendChild(stackContent);
                _setupStackSplitDivider();
                _applyStackSplit(splitX);
            } else {
                var eachW = (totalW - gap * (tabCount - 1)) / tabCount;
                eachW = Math.max(150, eachW);
                var leftPos = 0;
                for (var i = 0; i < npTabCount(); i++) {
                    if (i === currentNotepadTab) continue;
                    var win = document.createElement('div');
                    win.className = 'tileWindow';
                    win.dataset.tabIndex = i;
                    win.style.left = leftPos + 'px';
                    win.style.width = (leftPos + eachW > totalW - gap ? (totalW - leftPos) : eachW) + 'px';
                    win.style.top = '0px';
                    win.style.bottom = '0px';
                    win.style.zIndex = '1';
                    var winClose = document.createElement('button');
                    winClose.className = 'tileWinClose';
                    winClose.textContent = '×';
                    winClose.title = '关闭此窗口';
                    (function(w) {
                        winClose.onclick = function(e) {
                            e.stopPropagation();
                            var wins = _tileVisibleWindows();
                            var removeIndex = wins.indexOf(w);
                            var ratios = _tileSaveRatios();
                            w.remove();
                            if (removeIndex >= 0) ratios.splice(removeIndex, 1);
                            rebalanceTilePositions(ratios);
                        };
                    })(win);
                    win.appendChild(winClose);
                    var tileHeader = document.createElement('div');
                    tileHeader.className = 'tileHeader';
                    var numBlock = document.createElement('div');
                    numBlock.className = 'tileNumBlock ' + colors[i % 5];
                    numBlock.textContent = '' + (i + 1);
                    tileHeader.appendChild(numBlock);
                    var tileTitle = document.createElement('div');
                    tileTitle.className = 'tileTitle ' + colors[i % 5];
                    tileTitle.appendChild(document.createTextNode(notepadTitles[i] || '…'));
                    tileHeader.appendChild(tileTitle);
                    win.appendChild(tileHeader);
                    var tileContent = document.createElement('div');
                    tileContent.className = 'tileContent';
                    var tileTextarea = document.createElement('div');
                    tileTextarea.className = 'tileTextarea ' + bgColors[i % 5];
                    tileTextarea.style.whiteSpace = 'pre-wrap';
                    tileTextarea.innerHTML = (notepadEditorData[i] && notepadEditorData[i].html) || '';
                    _npWinZoomApplyTextarea(tileTextarea, (_npWinZoomLoad()[i] || 1));
                    tileContent.appendChild(tileTextarea);
                    tileContent.appendChild(_buildTileZoomBar(i));
                    win.appendChild(tileContent);
                    (function(w) {
                        w.addEventListener('mousedown', function() {
                            tileZIndex++;
                            w.style.zIndex = tileZIndex;
                        }, true);
                        tileHeader.addEventListener('mousedown', function(e) {
                            if (e.target.tagName === 'BUTTON') return;
                            tileZIndex++;
                            w.style.zIndex = tileZIndex;
                        });
                    })(win);
                    var resizeHandle = document.createElement('div');
                    resizeHandle.style.cssText = 'position:absolute;right:0;top:0;bottom:0;width:6px;cursor:col-resize;z-index:10;background:transparent;';
                    (function(w) {
                        var isResizing = false, startX = 0, startW = 0;
                        resizeHandle.addEventListener('mousedown', function(e) {
                            e.stopPropagation();
                            isResizing = true;
                            startX = e.clientX;
                            startW = w.offsetWidth;
                            document.addEventListener('mousemove', onResize);
                            document.addEventListener('mouseup', function() {
                                isResizing = false;
                                document.removeEventListener('mousemove', onResize);
                            });
                        });
                        function onResize(e) {
                            if (!isResizing) return;
                            var diff = e.clientX - startX;
                            var newW = Math.max(80, startW + diff);
                            w.style.width = newW + 'px';
                            w.style.flex = 'none';
                            rebalanceTilePositions(_tileSaveRatios());
                        }
                    })(win);
                    win.appendChild(resizeHandle);
                    container.appendChild(win);
                    leftPos += eachW + gap;
                }
            }
            if (!isStack) _applyTileSplit(splitX);
            updateNotepadTabStyle();
        }
        function rebalanceTilePositions(ratios) {
            _rebalanceTilePositionsByRatios(ratios);
        }
        function hideTile() {
            if (_tileSplitDivider) { S._tileSplitDivider = null; }
            _removeStackSplitDivider();
            var container = document.getElementById('tileContainer');
            container.classList.remove('show', 'stack-mode');
            container.innerHTML = '';
            S.tileVisible = false;
            S.notepadTileMode = 'normal';
            S._stackActiveTab = 0;
            _exitNotepadDockLayer();
            updateNotepadTabStyle();
        }
        /* 清空：只清掉编辑框中「当前显示范围」里的正文，保留索引标题、文章标题、作者/日期。
           - 显示全文时：清空每篇文章的正文，保留每篇的索引标题 / 文章标题 / 作者日期
           - 只显示某一篇时：只清这一篇的正文，保留这一篇的索引标题 / 文章标题 / 作者日期 */
        function _npIsClearKeepPara(p) {
            var lv = p.getAttribute('data-level') || '';
            if (p.getAttribute('data-outline-level') === '1') return true;
            if (lv === 'title' || lv === 'date' || lv === 'author') return true;
            return false;
        }
        function clearNotepad() {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var single = false;
            try {
                if (typeof window.npIsSingleArticleView === 'function') single = !!window.npIsSingleArticleView();
            } catch (e) { }
            _npShowClearConfirm(single ? '将清空当前显示这一篇文章的正文（保留索引标题、文章标题和作者/日期），是否继续？'
                : '将清空所有文章的正文（保留每篇的索引标题、文章标题和作者/日期），是否继续？', function () {
                var bk = _npBackupBeforeFormat(editor, '清空');
                editor.innerHTML = _npBuildClearedHtml(editor, single);
                // 清空是有意删减正文，跳过「文字变少」校验，但保留撤销快照
                if (bk && typeof window._npPushUndoSnapshot === 'function') {
                    try { window._npPushUndoSnapshot(bk.html, null, editor.scrollTop); } catch (e) { }
                }
                saveCurrentEditor();
                updateFooterTimestamp();
                _refreshOutlineIfOpen();
                if (typeof window.npRenderDirList === 'function') { try { window.npRenderDirList(); } catch (e) { } }
                showToast(single ? '已清空本篇正文' : '已清空所有正文');
            });
        }
        /* 生成清空后的 HTML：保留结构性段落，清掉正文/普通段落 */
        function _npBuildClearedHtml(editor, single) {
            var ps = editor.querySelectorAll('p');
            var out = [];
            for (var i = 0; i < ps.length; i++) {
                var p = ps[i];
                if (p.style.display === 'none') { out.push(p.outerHTML); continue; }
                if (_npIsClearKeepPara(p)) { out.push(p.outerHTML); continue; }
                if (p.querySelector('img')) { out.push(p.outerHTML); continue; }
                // 其余正文段落：清掉文字，保留空的段落结构（不输出）
            }
            if (!out.length) out.push('<p><br></p>');
            return out.join('');
        }
        function _npShowClearConfirm(message, onConfirm) {
            var old = document.getElementById('npClearConfirmModal');
            if (old && old.parentNode) old.parentNode.removeChild(old);
            var overlay = document.createElement('div');
            overlay.id = 'npClearConfirmModal';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:10100;display:flex;align-items:center;justify-content:center;';
            var box = document.createElement('div');
            box.style.cssText = 'background:#fff;border-radius:12px;padding:24px 28px;width:400px;max-width:90%;box-shadow:0 12px 40px rgba(0,0,0,0.25);';
            var msg = document.createElement('div');
            msg.textContent = message;
            msg.style.cssText = 'font-size:14px;color:#333;line-height:1.7;margin-bottom:20px;';
            box.appendChild(msg);
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
            var cancel = document.createElement('button');
            cancel.textContent = '取消';
            cancel.style.cssText = 'padding:8px 18px;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;color:#333;cursor:pointer;font-size:13px;';
            var ok = document.createElement('button');
            ok.textContent = '确定清空';
            ok.style.cssText = 'padding:8px 18px;border:none;border-radius:6px;background:#c0392b;color:#fff;cursor:pointer;font-size:13px;';
            row.appendChild(cancel);
            row.appendChild(ok);
            box.appendChild(row);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            function close(run) {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                if (run && onConfirm) onConfirm();
            }
            ok.addEventListener('click', function () { close(true); });
            cancel.addEventListener('click', function () { close(false); });
            overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(false); });
            document.addEventListener('keydown', function esc(e) {
                if (e.key === 'Escape') { document.removeEventListener('keydown', esc, true); close(false); }
            }, true);
            setTimeout(function () { ok.focus(); }, 0);
        }
        var notepadZoomLevels = [1, 1, 1, 1, 1];
        function notepadScrollToStart() {
            var editor = document.getElementById('notepadEditor');
            if (editor) { editor.scrollTop = 0; }
        }
        function notepadScrollToEnd() {
            var editor = document.getElementById('notepadEditor');
            if (editor) { editor.scrollTop = editor.scrollHeight; }
        }
        function _notepadArticleHeadings() {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return [];
            var nodes = editor.querySelectorAll('p[data-outline-level="1"]');
            var arr = [];
            for (var i = 0; i < nodes.length; i++) {
                if ((nodes[i].textContent || '').replace(/[\s\xa0\u200b\uFEFF]+/g, '')) arr.push(nodes[i]);
            }
            return arr;
        }
        function _notepadScrollToHeading(el) {
            if (!el) return;
            try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            catch(e) { el.scrollIntoView(); }
        }
        function notepadScrollToPrevArticle() {
            var editor = document.getElementById('notepadEditor');
            var hs = _notepadArticleHeadings();
            if (!editor || !hs.length) { showToast('没有文章标题'); return; }
            var er = editor.getBoundingClientRect();
            var curTop = er.top + 2;
            var target = null;
            for (var i = 0; i < hs.length; i++) {
                if (hs[i].getBoundingClientRect().top < curTop - 2) target = hs[i];
                else break;
            }
            if (!target) target = hs[0];
            _notepadScrollToHeading(target);
        }
        function notepadScrollToNextArticle() {
            var editor = document.getElementById('notepadEditor');
            var hs = _notepadArticleHeadings();
            if (!editor || !hs.length) { showToast('没有文章标题'); return; }
            var er = editor.getBoundingClientRect();
            var curTop = er.top + 2;
            var target = null;
            for (var i = 0; i < hs.length; i++) {
                if (hs[i].getBoundingClientRect().top > curTop + 2) { target = hs[i]; break; }
            }
            if (!target) target = hs[hs.length - 1];
            _notepadScrollToHeading(target);
        }
        function _notepadIsHighlightColor(bg) {
            if (!bg) return false;
            bg = String(bg).replace(/\s+/g, '').toLowerCase();
            if (!bg || bg === 'transparent' || bg === 'rgba(0,0,0,0)' || bg === 'white' || bg === '#fff' || bg === '#ffffff' || bg === 'rgb(255,255,255)') return false;
            return true;
        }
        function _notepadHighlightNodes() {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return [];
            var all = editor.querySelectorAll('*');
            var arr = [];
            for (var i = 0; i < all.length; i++) {
                var el = all[i];
                var st = el.style || {};
                if (_notepadIsHighlightColor(st.backgroundColor) || _notepadIsHighlightColor(st.background) || el.getAttribute('bgcolor')) arr.push(el);
            }
            return arr;
        }
        function _notepadScrollToElement(el) {
            if (!el) return;
            try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            catch(e) { el.scrollIntoView(); }
        }
        function notepadScrollToPrevHighlight() {
            var editor = document.getElementById('notepadEditor');
            var hs = _notepadHighlightNodes();
            if (!editor || !hs.length) { showToast('没有高亮标记'); return; }
            var er = editor.getBoundingClientRect();
            var curTop = er.top + 2;
            var target = null;
            for (var i = 0; i < hs.length; i++) {
                if (hs[i].getBoundingClientRect().top < curTop - 2) target = hs[i];
                else break;
            }
            if (!target) target = hs[0];
            _notepadScrollToElement(target);
        }
        function notepadScrollToNextHighlight() {
            var editor = document.getElementById('notepadEditor');
            var hs = _notepadHighlightNodes();
            if (!editor || !hs.length) { showToast('没有高亮标记'); return; }
            var er = editor.getBoundingClientRect();
            var curTop = er.top + 2;
            var target = null;
            for (var i = 0; i < hs.length; i++) {
                if (hs[i].getBoundingClientRect().top > curTop + 2) { target = hs[i]; break; }
            }
            if (!target) target = hs[hs.length - 1];
            _notepadScrollToElement(target);
        }
        function notepadZoomIn() {
            notepadZoomLevels[currentNotepadTab] = Math.min(notepadZoomLevels[currentNotepadTab] + 0.1, 2);
            applyNotepadZoom();
            showToast('缩放: ' + Math.round(notepadZoomLevels[currentNotepadTab] * 100) + '%');
            showNotepadEditorZoomBar();
        }
        function notepadZoomOut() {
            notepadZoomLevels[currentNotepadTab] = Math.max(notepadZoomLevels[currentNotepadTab] - 0.1, 0.5);
            applyNotepadZoom();
            showToast('缩放: ' + Math.round(notepadZoomLevels[currentNotepadTab] * 100) + '%');
            showNotepadEditorZoomBar();
        }
        function showNotepadEditorZoomBar() {
            var bar = document.getElementById('notepadEditorZoomBar');
            if (bar) bar.style.display = 'flex';
        }
        function hideNotepadEditorZoomBar() {
            var bar = document.getElementById('notepadEditorZoomBar');
            if (bar) bar.style.display = 'none';
        }
        function notepadWindowZoomIn() {
            if (typeof window.changeMainZoom === 'function') window.changeMainZoom(0.1);
        }
        function notepadWindowZoomOut() {
            if (typeof window.changeMainZoom === 'function') window.changeMainZoom(-0.1);
        }
        function fitNotepadToLogArea() {
            var panel = document.getElementById('notepadPanel');
            var rp = document.getElementById('rightPanel');
            if (!panel || !rp) return;
            var rect = _npCssRect(rp);
            panel.style.top = rect.top + 'px';
            panel.style.left = rect.left + 'px';
            panel.style.width = rect.width + 'px';
            panel.style.height = rect.height + 'px';
        }
        function _npMainZoom() {
            var z = 1;
            try { z = parseFloat(DataLayer.getRaw('mainZoom')) || 1; } catch(e) {}
            return z;
        }
        function _npCssRect(el) {
            var z = _npMainZoom();
            var r = el.getBoundingClientRect();
            return { left: r.left / z, top: r.top / z, right: r.right / z, bottom: r.bottom / z, width: r.width / z, height: r.height / z };
        }
        function _npScreenRect(el) {
            var r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        }
        function _npIsVisible(el) {
            return !!(el && el.offsetParent !== null && getComputedStyle(el).display !== 'none');
        }
        function _npWorkRects() {
            var lp = document.getElementById('leftPanel');
            var rp = document.getElementById('rightPanel');
            if (_npIsVisible(lp) && _npIsVisible(rp)) {
                var lr = _npCssRect(lp);
                var rr = _npCssRect(rp);
                var left = { left: lr.left, top: rr.top, right: lr.right, bottom: rr.bottom, width: lr.width, height: rr.height };
                var right = { left: rr.left, top: rr.top, right: rr.right, bottom: rr.bottom, width: rr.width, height: rr.height };
                return { left: left, right: right };
            }
            var z = _npMainZoom();
            var top = 0, bottom = window.innerHeight / z;
            var header = document.getElementById('mainHeader');
            var footer = document.getElementById('mainFooter');
            if (header) top = header.getBoundingClientRect().bottom / z;
            if (footer) bottom = footer.getBoundingClientRect().top / z;
            var split = Math.round((window.innerWidth / z) * 0.25);
            return { left: { left: 0, top: top, right: split, bottom: bottom, width: split, height: bottom - top }, right: { left: split, top: top, right: window.innerWidth / z, bottom: bottom, width: window.innerWidth / z - split, height: bottom - top } };
        }
        function _npWorkScreenRects() {
            var lp = document.getElementById('leftPanel');
            var rp = document.getElementById('rightPanel');
            if (_npIsVisible(lp) && _npIsVisible(rp)) {
                var lr = _npScreenRect(lp);
                var rr = _npScreenRect(rp);
                return { left: { left: lr.left, top: rr.top, right: lr.right, bottom: rr.bottom, width: lr.width, height: rr.height }, right: rr };
            }
            var top = 0, bottom = window.innerHeight;
            var header = document.getElementById('mainHeader');
            var footer = document.getElementById('mainFooter');
            if (header) top = header.getBoundingClientRect().bottom;
            if (footer) bottom = footer.getBoundingClientRect().top;
            var split = Math.round(window.innerWidth * 0.25);
            return { left: { left: 0, top: top, right: split, bottom: bottom, width: split, height: bottom - top }, right: { left: split, top: top, right: window.innerWidth, bottom: bottom, width: window.innerWidth - split, height: bottom - top } };
        }
        function _npSetBox(el, r) {
            if (!el || !r) return;
            el.style.left = r.left + 'px';
            el.style.top = r.top + 'px';
            el.style.width = r.width + 'px';
            el.style.height = r.height + 'px';
            el.style.bottom = 'auto';
        }
        function _npSetScreenBox(el, r) {
            if (!el || !r) return;
            el.style.left = r.left + 'px';
            el.style.top = r.top + 'px';
            el.style.width = r.width + 'px';
            el.style.height = r.height + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }
        // 参照写材料 syncDivider：目录/辅助窗口右侧贴住日志右边框（_npWorkRects().right.right），
        // 拖动目录宽度时联动右侧编辑窗口，保证右边缘与日志右对齐、左右无空隙
        function _npSyncOutlinePanel(omc, panel) {
            if (!omc || !panel) return;
            var cr = _npCssRect(omc);
            var wr = _npWorkRects();
            panel.style.left = cr.right + 'px';
            panel.style.top = cr.top + 'px';
            panel.style.height = cr.height + 'px';
            panel.style.width = Math.max(280, wr.right.right - cr.right) + 'px';
            panel.style.bottom = 'auto';
            updateNotepadSearchWidth();
        }
        var _notepadDisplayMode = null;
        var _notepadSavedEditorHtml = null;
        function setNotepadDisplayMode(mode) {
            var panel = document.getElementById('notepadPanel');
            if (!panel) return;
            var btn = document.getElementById('notepadDisplayBtn');
            var menu = document.getElementById('notepadDisplayMenu');
            var hlItem = document.getElementById('notepadDisplayHlItem');
            if (_writeNoteMode && !_materialMode && mode !== 'write') _autoSaveIfDirty();
            if (_notepadDisplayMode === mode) {
                if (_materialMode) { _exitMaterialMode(); return; }
                if (_writeNoteMode) { _exitWriteNoteMode(); return; }
                _notepadDisplayMode = null;
                _notepadSavedEditorHtml = null;
                btn.textContent = '显示';
                btn.classList.remove('displayModeActive');
                if (panel.classList.contains('notepadFullscreen')) {
                    panel.classList.remove('notepadFullscreen');
                    if (!_writeNoteMode) {
                        panel.style.top = '';
                        panel.style.left = '';
                        panel.style.width = '';
                        panel.style.height = '';
                    }
                }
                var editor = document.getElementById('notepadEditor');
                if (editor) {
                    var ps = editor.querySelectorAll('p');
                    for (var i = 0; i < ps.length; i++) ps[i].style.display = '';
                }
                var items = menu.querySelectorAll('.paDropdownItem');
                for (var i = 0; i < items.length; i++) items[i].classList.remove('paDropdownItemActive');
                if (hlItem) { hlItem.textContent = '只显示高亮'; hlItem.setAttribute('data-dmode', 'highlight'); }
                showToast('已还原');
                return;
            }
            _notepadDisplayMode = mode;
            if (_writeNoteMode && mode !== 'write') { _exitWriteNoteMode(); }
            if (_materialMode && mode !== 'material') { _exitMaterialMode(); }
            saveCurrentEditor();
            btn.textContent = '显示';
            var items = menu.querySelectorAll('.paDropdownItem');
            for (var i = 0; i < items.length; i++) items[i].classList.remove('paDropdownItemActive');
            if (mode === 'right') {
                btn.classList.remove('displayModeActive');
                var ri = menu.querySelector('.paDropdownItem[data-dmode="right"]');
                if (ri) ri.classList.add('paDropdownItemActive');
                _applyNotepadDisplayRight(panel);
            } else if (mode === 'center') {
                btn.classList.remove('displayModeActive');
                var ci = menu.querySelector('.paDropdownItem[data-dmode="center"]');
                if (ci) ci.classList.add('paDropdownItemActive');
                _applyNotepadDisplayCenter(panel);
            } else if (mode === 'highlight') {
                if (hlItem) { hlItem.textContent = '显示全部'; hlItem.setAttribute('data-dmode', 'showall'); hlItem.classList.add('paDropdownItemActive'); }
                _applyNotepadDisplayHighlight(panel);
            } else if (mode === 'write') {
                _enterWriteNoteMode(panel);
            } else if (mode === 'material') {
                _enterMaterialMode(panel);
            }
        }
        function _applyNotepadDisplayRight(panel) {
            panel.classList.add('notepadFullscreen');
            fitNotepadToLogArea();
            if (!_npSuppressDisplayToast) showToast('已切换到 满屏（右）');
        }
        var _npSuppressDisplayToast = false;
        function _applyNotepadDisplayCenter(panel) {
            panel.classList.add('notepadFullscreen');
            setTimeout(function() {
                var z = 1;
                try { z = parseFloat(DataLayer.getRaw('mainZoom')) || 1; } catch(e) {}
                var leftP = document.getElementById('leftPanel');
                var rightP = document.getElementById('rightPanel');
                if (!leftP || !rightP) return;
                var lr = leftP.getBoundingClientRect();
                var rr = rightP.getBoundingClientRect();
                panel.style.left = (lr.left / z) + 'px';
                panel.style.top = (rr.top / z) + 'px';
                panel.style.width = ((rr.left + rr.width - lr.left) / z) + 'px';
                panel.style.height = (rr.height / z) + 'px';
                panel.style.bottom = 'auto';
                showToast('已切换到 满屏（中）');
            }, 0);
        }
        function _applyNotepadDisplayHighlight(panel) {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var ps = editor.querySelectorAll('p');
            for (var i = 0; i < ps.length; i++) {
                var p = ps[i];
                var hasHl = false;
                var allEls = p.querySelectorAll('*');
                for (var j = 0; j < allEls.length; j++) {
                    var bg = allEls[j].style.backgroundColor || allEls[j].style.background || '';
                    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
                        var whiteRe = /^rgba?\(\s*255\s*,\s*255\s*,\s*255/i;
                        if (!whiteRe.test(bg) && bg.toLowerCase() !== '#fff' && bg.toLowerCase() !== '#ffffff' && bg.toLowerCase() !== 'white') {
                            hasHl = true;
                            break;
                        }
                    }
                }
                p.style.display = hasHl ? '' : 'none';
            }
            var btn = document.getElementById('notepadDisplayBtn');
            if (btn) btn.classList.add('displayModeActive');
            showToast('已切换到 只显示高亮');
        }
        function _refitNotepadIfFullscreen() {
            var panel = document.getElementById('notepadPanel');
            if (!panel || !panel.classList.contains('show')) return;
            if (_materialMode) {
                _materialLayout();
            } else if (_writeNoteMode) {
                _layoutWriteNoteByWorkRects();
            } else if (tileVisible) {
                _applyTileSplit(_npCssRect(panel).right);
            } else {
                var rp = document.getElementById('rightPanel');
                if (rp) {
                    var rect = _npCssRect(rp);
                    panel.style.top = rect.top + 'px';
                    panel.style.height = rect.height + 'px';
                    panel.style.bottom = 'auto';
                }
            }
            if (_notepadDisplayMode === 'center') {
                _applyNotepadDisplayCenter(panel);
            } else if (_notepadDisplayMode === 'right') {
                requestAnimationFrame(function() { fitNotepadToLogArea(); });
            }
        }
        window.addEventListener('resize', _refitNotepadIfFullscreen);
        document.addEventListener('fullscreenchange', _refitNotepadIfFullscreen);
        document.addEventListener('webkitfullscreenchange', _refitNotepadIfFullscreen);
        function _materialLayout(splitX) {
            var panel = document.getElementById('notepadPanel');
            var assist = document.getElementById('materialAssistPanel');
            var divider = document.getElementById('mainSplitDivider');
            if (!panel || !assist) return;
            panel.classList.add('materialDividerHidden');
            assist.classList.add('materialDividerHidden');
            if (divider) divider.classList.add('materialDividerHidden');
            var wrCss = _npWorkRects();
            var wrScreen = _npWorkScreenRects();
            var left = wrCss.left.left;
            var right = wrCss.right.right;
            var x = (splitX == null) ? wrCss.right.left : splitX;
            x = Math.max(left + 180, Math.min(right - 280, x));
            if (splitX == null && !_materialFullscreen) {
                _npSetScreenBox(assist, wrScreen.left);
                _npSetBox(panel, wrCss.right);
                S._materialSplitRatio = (wrCss.right.left - left) / Math.max(1, right - left);
                assist.style.right = 'auto';
                panel.style.right = 'auto';
            } else {
                var top = _materialFullscreen ? 0 : wrCss.right.top;
                var bottom = _materialFullscreen ? window.innerHeight / _npMainZoom() : wrCss.right.bottom;
                var h = bottom - top;
                S._materialSplitRatio = (x - left) / Math.max(1, right - left);
                _npSetBox(assist, { left: left, top: top, width: x - left, height: h });
                _npSetBox(panel, { left: x, top: top, width: right - x, height: h });
                assist.style.right = 'auto';
                panel.style.right = 'auto';
            }
            updateNotepadSearchWidth();
        }
        function _bindMaterialAssistManualAdjust() {
            var assist = document.getElementById('materialAssistPanel');
            var panel = document.getElementById('notepadPanel');
            if (!assist || !panel || assist._manualAdjustBound) return;
            assist._manualAdjustBound = true;
            function syncDivider() {
                var ar = _npCssRect(assist);
                panel.style.left = ar.right + 'px';
                panel.style.top = ar.top + 'px';
                panel.style.height = ar.height + 'px';
                var wr = _npWorkRects();
                panel.style.width = Math.max(280, wr.right.right - ar.right) + 'px';
                panel.style.bottom = 'auto';
                updateNotepadSearchWidth();
            }
            function resizeBy(handle, useW, useH) {
                if (!handle) return;
                handle.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    var z = _npMainZoom();
                    var r = _npCssRect(assist);
                    var startX = e.clientX, startY = e.clientY;
                    function onMove(ev) {
                        if (useW) assist.style.width = Math.max(180, r.width + (ev.clientX - startX) / z) + 'px';
                        if (useH) assist.style.height = Math.max(120, r.height + (ev.clientY - startY) / z) + 'px';
                        syncDivider();
                    }
                    function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }
            resizeBy(assist.querySelector('.materialAssistResizeRight'), true, false);
            resizeBy(assist.querySelector('.materialAssistResizeBottom'), false, true);
            resizeBy(assist.querySelector('.materialAssistResizeHandle'), true, true);
            assist.addEventListener('mousedown', function(e) {
                if (!_materialMode || e.button !== 0) return;
                if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea') || e.target.closest('li') || e.target.closest('.paDropdownMenu')) return;
                if (e.target.closest('.materialAssistResizeRight') || e.target.closest('.materialAssistResizeBottom') || e.target.closest('.materialAssistResizeHandle')) return;
                e.preventDefault();
                var z = _npMainZoom();
                var r = _npCssRect(assist);
                var startX = e.clientX, startY = e.clientY;
                function onMove(ev) {
                    assist.style.left = (r.left + (ev.clientX - startX) / z) + 'px';
                    assist.style.top = (r.top + (ev.clientY - startY) / z) + 'px';
                    syncDivider();
                }
                function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        }
        function _materialMirrorApplyViewStyle() {
            var view = document.getElementById('materialMirrorView');
            if (!view) return;
            var tab = currentNotepadTab;
            var baseFs = parseInt(notepadFontSizes[currentNotepadTab]) || 14;
            view.style.fontSize = baseFs + 'px';
            var zEditor = parseFloat(notepadZoomLevels[currentNotepadTab]) || 1;
            var zAssist = parseFloat(_materialAssistZoomOf('mirror')) || 1;
            view.style.zoom = Math.round(zEditor * zAssist * 100) / 100;
        }
        function _materialMirrorRefresh() {
            var editor = document.getElementById('notepadEditor');
            var view = document.getElementById('materialMirrorView');
            if (!view || !editor) return;
            var tab = currentNotepadTab;
            view.className = 'materialMirrorView bg' + tab;
            view.innerHTML = editor.innerHTML || '';
            var hidePs = view.querySelectorAll('p[data-dir-hidden="true"]');
            for (var i = 0; i < hidePs.length; i++) { hidePs[i].removeAttribute('data-dir-hidden'); hidePs[i].style.display = ''; }
            var allPs = view.querySelectorAll('p');
            for (var j = 0; j < allPs.length; j++) {
                if ((allPs[j].style.textAlign || '') !== 'center') allPs[j].style.textAlign = 'justify';
            }
            _materialMirrorApplyViewStyle();
        }
        function _materialMirrorSync() {
            if (_materialActiveTab === 'mirror') _materialMirrorRefresh();
        }
        function _applyMaterialAssistZoom() {
            var map = {
                outline: document.getElementById('materialOutlineList'),
                whiteboard: document.getElementById('materialWhiteboard'),
                note: document.getElementById('materialNoteView'),
                mirror: document.getElementById('materialMirrorView')
            };
            for (var k in map) {
                var el = map[k];
                if (!el) continue;
                if (k === 'mirror') continue;
                el.style.fontSize = Math.round(14 * _materialAssistZoomOf(k)) + 'px';
            }
            _materialMirrorApplyViewStyle();
        }
        function _materialAssistZoomSet(tab, val) {
            tab = tab || _materialActiveTab || 'outline';
            if (!_materialAssistZoomMap) S._materialAssistZoomMap = {};
            _materialAssistZoomMap[tab] = Math.max(0.6, Math.min(2, val));
            if (tab === 'outline') S._materialAssistZoom = _materialAssistZoomMap[tab];
            _materialAssistZoomSave();
            _applyMaterialAssistZoom();
        }
        function materialAssistZoomIn() {
            var tab = _materialActiveTab || 'outline';
            _materialAssistZoomSet(tab, _materialAssistZoomOf(tab) + 0.1);
        }
        function materialAssistZoomOut() {
            var tab = _materialActiveTab || 'outline';
            _materialAssistZoomSet(tab, _materialAssistZoomOf(tab) - 0.1);
        }
        function materialAssistRefresh() {
            if (_materialActiveTab === 'mirror') _materialMirrorRefresh();
            else _renderMaterialOutline();
        }
        function _materialCurrentArticlePs(editor) {
            if (!editor) return [];
            var ps = Array.prototype.slice.call(editor.querySelectorAll('p'));
            if (!ps.length) return [];
            var sel = window.getSelection();
            var curP = null;
            if (sel.rangeCount && editor.contains(sel.anchorNode)) {
                var n = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
                while (n && n !== editor && n.tagName !== 'P') n = n.parentNode;
                if (n && n !== editor) curP = n;
            }
            var curIdx = curP ? ps.indexOf(curP) : -1;
            if (curIdx < 0) curIdx = 0;
            var start = 0;
            for (var i = curIdx; i >= 0; i--) { if (ps[i].getAttribute('data-outline-level') === '1') { start = i; break; } }
            // 索引标题与文章标题分成两段时，合并为同一篇，索引标题优先
            if (start > 0 && ps[start].getAttribute('data-level') === 'title' &&
                ps[start - 1].getAttribute('data-outline-level') === '1' &&
                ps[start - 1].getAttribute('data-level') !== 'title') {
                start = start - 1;
            }
            // 索引标题后紧跟的文章标题（含 data-level="title" 合并段）仍属于同一篇
            var end = _npArticleEndIndex(ps, start);
            return ps.slice(start, end);
        }
        var _materialOutlineItems = [];
        var _materialOutlineCut = null;
        var _materialOutlineCtxMode = 'material';
        var _materialOutlineCtxItem = null;
        function _refreshMaterialOutlineContext() {
            if (_materialOutlineCtxMode === 'notepad') _notepadOutlineRenderStruct();
            else _renderMaterialOutline();
        }
        function _notepadOutlineBindStructItem(li, item) {
            if (!li || !item) return;
            li.oncontextmenu = function(e) { _showMaterialOutlineCtx(e, item, 'notepad'); };
        }
        function _bindMaterialOutlineListEvents(list) {
            if (!list || list._materialOutlineBound) return;
            list._materialOutlineBound = true;
            list.addEventListener('contextmenu', function(e) {
                var li = e.target.closest('li[data-moutline-idx]');
                if (!li || !list.contains(li)) return;
                var item = _materialOutlineItems[parseInt(li.getAttribute('data-moutline-idx'), 10)];
                if (item) _showMaterialOutlineCtx(e, item);
            });
        }
        function _npMaterialInlineWords(p, headingText, headingLevel) {
            var entries = [];
            var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
            var cur = null, offset = 0;
            function flush() {
                if (cur) {
                    var txt = cur.text.replace(/^\s+|\s+$/g, '');
                    if (txt) entries.push({ text: txt, level: cur.level, startOffset: cur.startOffset, endOffset: offset });
                }
                cur = null;
            }
            while (walker.nextNode()) {
                var t = walker.currentNode.textContent || '';
                var lv = _npManualNodeHeadingLevel(walker.currentNode, p);
                if (lv === null) { flush(); offset += t.length; continue; }
                if (!cur || cur.level !== lv) { flush(); cur = { text: t, level: lv, startOffset: offset }; offset += t.length; continue; }
                cur.text += t; offset += t.length;
            }
            flush();
            var found = -1;
            var hText = (headingText || '').replace(/^\s+|\s+$/g, '');
            for (var ei = 0; ei < entries.length; ei++) {
                var eText = (entries[ei].text || '').replace(/^\s+|\s+$/g, '');
                if (eText.indexOf(hText) === 0 && entries[ei].level === headingLevel) { found = ei; break; }
            }
            if (found === -1) return -1;
            var next = -1;
            for (var ni = found + 1; ni < entries.length; ni++) {
                if (entries[ni].level === headingLevel) { next = ni; break; }
            }
            var totalText = p.textContent || '';
            var from = entries[found].startOffset;
            var to = next >= 0 ? entries[next].startOffset : totalText.length;
            var seg = totalText.substring(from, to);
            return seg.replace(/\s/g, '').length;
        }
        function _npMatchHeadingAncestry(candidateP, ancestors, editor) {
            if (!ancestors || !ancestors.length) return true;
            if (!candidateP || !editor) return false;
            var allP = editor.querySelectorAll('p');
            var idx = -1;
            for (var i = 0; i < allP.length; i++) { if (allP[i] === candidateP) { idx = i; break; } }
            if (idx < 0) return true;
            var before = [];
            for (var b = idx - 1; b >= 0; b--) {
                var lv = _detectHeadingDisplayLevel(allP[b]);
                if (lv !== null) {
                    var t = (allP[b].textContent || '').replace(/^\s+|\s+$/g, '');
                    before.push({ level: lv, text: t });
                }
            }
            var ok = 0;
            for (var a = 0; a < ancestors.length; a++) {
                var target = (ancestors[a].text || '').replace(/^\s+|\s+$/g, '');
                if (!target) { ok++; continue; }
                for (var c = 0; c < before.length; c++) {
                    if (before[c].level === ancestors[a].level && before[c].text.indexOf(target) >= 0) { ok++; break; }
                }
            }
            return ok >= Math.max(1, Math.floor(ancestors.length * 0.8));
        }
        function _npMaterialJumpToHeading(target, item, editor) {
            editor = editor || document.getElementById('notepadEditor');
            if (!editor) return;
            function _searchByText() {
                if (!item || !item.text || !editor) return null;
                var allP = editor.querySelectorAll('p');
                var st = item.text.replace(/^\s+|\s+$/g, '');
                if (!st) return null;
                var candidates = [];
                for (var pi = 0; pi < allP.length; pi++) {
                    var pt = (allP[pi].textContent || '').replace(/^\s+|\s+$/g, '');
                    if (pt.indexOf(st) >= 0) { candidates.push({ p: allP[pi], pi: pi }); }
                }
                if (!candidates.length) {
                    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
                    while (walker.nextNode()) {
                        var t = walker.currentNode;
                        if ((t.textContent || '').indexOf(st) >= 0) {
                            var par = t.parentElement;
                            while (par && par !== editor && par.tagName !== 'P' && par.tagName !== 'DIV') par = par.parentElement;
                            if (par && par !== editor) {
                                var pa = -1;
                                for (var pi2 = 0; pi2 < allP.length; pi2++) if (allP[pi2] === par) { pa = pi2; break; }
                                candidates.push({ p: par, pi: pa });
                            }
                        }
                    }
                }
                if (!candidates.length) return null;
                if (candidates.length === 1) return candidates[0].p;
                var anc = (item.ancestors || []).filter(function(a) { return a && a.text; });
                var best = null, bestScore = -1;
                for (var ci = 0; ci < candidates.length; ci++) {
                    var score = 0;
                    if (anc.length) {
                        if (_npMatchHeadingAncestry(candidates[ci].p, anc, editor)) score += 100;
                        else score += (-100);
                    }
                    if (typeof item.index === 'number' && candidates[ci].pi >= 0) {
                        score -= Math.abs(candidates[ci].pi - (item.index || 0));
                    }
                    if (score > bestScore) { bestScore = score; best = candidates[ci].p; }
                }
                return best;
            }
            function _isValid(el) {
                return el && el.nodeType === 1 && el.parentNode && editor.contains(el);
            }
            if (!_isValid(target)) target = _searchByText();
            if (!target) return;
            editor.querySelectorAll('.materialOutlineHighlight').forEach(function(el) { el.classList.remove('materialOutlineHighlight'); });
            target.classList.add('materialOutlineHighlight');
            if (target._materialOutlineHighlightTimer) clearTimeout(target._materialOutlineHighlightTimer);
            target._materialOutlineHighlightTimer = setTimeout(function() { target.classList.remove('materialOutlineHighlight'); target._materialOutlineHighlightTimer = null; }, 2100);
            _npScrollEditorCenter(target);
            requestAnimationFrame(function() {
                if (!_isValid(target)) target = _searchByText();
                if (!target) return;
                _npScrollEditorCenter(target);
                var ed = document.getElementById('notepadEditor');
                if (ed) {
                    var tr2 = target.getBoundingClientRect();
                    var sr2 = ed.getBoundingClientRect();
                    if (tr2.bottom < sr2.top + 4 || tr2.top > sr2.bottom - 4) {
                        try { target.scrollIntoView(true); } catch(e3) {}
                    }
                }
            });
        }
        function _npScrollEditorCenter(el) {
            var editor = document.getElementById('notepadEditor');
            if (!el || !editor) return;
            var cur = el.parentElement;
            var sc = editor;
            while (cur && cur !== editor && cur !== document.body && cur !== document.documentElement) {
                var cs = getComputedStyle(cur);
                if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowY === 'overlay') && cur.scrollHeight > cur.clientHeight + 1) { sc = cur; break; }
                cur = cur.parentElement;
            }
            var tr = el.getBoundingClientRect();
            var sr = sc.getBoundingClientRect();
            var z = (sr.width / Math.max(1, sc.offsetWidth || 1)) || (_npMainZoom() || 1);
            var delta = (tr.top - sr.top) - (sr.height - tr.height) / 2;
            sc.scrollTop = Math.max(0, sc.scrollTop + delta / z);
        }
         function _renderMaterialOutline() {
            var list = document.getElementById('materialOutlineList');
            var editor = document.getElementById('notepadEditor');
            if (!list) return;
            _bindMaterialOutlineListEvents(list);
            _materialOutlineItems = [];
            list.innerHTML = '';
            if (editor) {
                editor.querySelectorAll('.materialOutlineHighlight').forEach(function(el) { el.classList.remove('materialOutlineHighlight'); });
            }
            var headings = [];
            var ps = [];
            if (editor) {
                ps = _materialCurrentArticlePs(editor);
                for (var i = 0; i < ps.length; i++) {
                     var p = ps[i];
                     var dataLevel = p.getAttribute('data-level') || '';
                     if (dataLevel === 'secret' || dataLevel === 'recipient' || dataLevel === 'attachment' || p.getAttribute('data-attachment-style')) continue;
                     var info = _npOutlineDisplayInfo(p);
                    if (info) {
                        if (info.isArticleTitle) info.level = 1;
                        headings.push({ text: info.text, element: p, level: info.level, index: i, isArticleTitle: info.isArticleTitle });
                    }
                    var extra = _npOutlineExtraEntries(p);
                    for (var ei = 0; ei < extra.length; ei++) {
                        if (!info || extra[ei].text !== info.text) {
                         var extraItem = { text: extra[ei].text, element: p, level: extra[ei].level, index: i, isArticleTitle: false };
                             if (dataLevel === 'secret' || dataLevel === 'recipient' || dataLevel === 'attachment') continue;
                            if (extraItem.isArticleTitle) extraItem.level = 1;
                            headings.push(extraItem);
                        }
                    }
                }
            }
            if (!headings.length) {
                var empty = document.createElement('li');
                empty.textContent = '（暂无提纲）';
                empty.style.color = '#999';
                empty.style.cursor = 'default';
                list.appendChild(empty);
                return;
            }
             var titleItem = null;
             var subHeadings = [];
             function _outlineFontFromRight(item) {
                 var p = item && item.element;
                 if (!p) return null;
                 var target = (item.text || '').replace(/^\s+|\s+$/g, '');
                 var nodes = p.querySelectorAll ? p.querySelectorAll('span,font,b,strong') : [];
                 for (var ni = 0; ni < nodes.length; ni++) {
                     var nt = (nodes[ni].textContent || '').replace(/^\s+|\s+$/g, '');
                     if (!nt || (target && nt.indexOf(target) === -1 && target.indexOf(nt) === -1)) continue;
                     var nff = ((nodes[ni].style && nodes[ni].style.fontFamily) || '').replace(/[\'\"]/g, '').toLowerCase();
                     if (nff.indexOf('黑体') !== -1 || nff.indexOf('simhei') !== -1) return { family: '黑体,SimHei,sans-serif', bold: true };
                     if (nff.indexOf('小标宋') !== -1 || nff.indexOf('fzxiaobiaosong') !== -1) return { family: '方正小标宋简体,FZXiaoBiaoSong,SimSun,serif', bold: false };
                     if (nff.indexOf('楷体') !== -1 || nff.indexOf('kaiti') !== -1) return { family: '楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', bold: false };
                     if (nff.indexOf('仿宋') !== -1 || nff.indexOf('fangsong') !== -1) return { family: '仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif', bold: true };
                 }
                 var pff = ((p.style && p.style.fontFamily) || '').replace(/[\'\"]/g, '').toLowerCase();
                 if (pff.indexOf('黑体') !== -1 || pff.indexOf('simhei') !== -1) return { family: '黑体,SimHei,sans-serif', bold: true };
                 if (pff.indexOf('小标宋') !== -1 || pff.indexOf('fzxiaobiaosong') !== -1) return { family: '方正小标宋简体,FZXiaoBiaoSong,SimSun,serif', bold: false };
                 if (pff.indexOf('楷体') !== -1 || pff.indexOf('kaiti') !== -1) return { family: '楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', bold: false };
                 if (pff.indexOf('仿宋') !== -1 || pff.indexOf('fangsong') !== -1) return { family: '仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif', bold: true };
                 return null;
             }
            for (var h = 0; h < headings.length; h++) {
                if (headings[h].isArticleTitle) { titleItem = headings[h]; }
                else { subHeadings.push(headings[h]); }
            }
            // 一篇文章只显示一个标题：有索引标题时以索引标题为准，文章标题不再单列
            if (ps.length && ps[0] && ps[0].getAttribute && ps[0].getAttribute('data-outline-level') === '1') {
                var _idxTxt = (ps[0].textContent || '').replace(/^\s+|\s+$/g, '');
                if (_idxTxt) {
                    titleItem = { text: _npDirectoryLabel(_idxTxt), element: ps[0], level: 1, index: 0, isArticleTitle: true };
                }
            }
            var mhBase = titleItem ? 1 : 0;
            if (titleItem) {
                var titleLi = document.createElement('li');
                var titleIdx = _materialOutlineItems.push(titleItem) - 1;
                titleLi.setAttribute('data-moutline-idx', titleIdx);
                titleLi.textContent = titleItem.text;
                titleLi.style.fontFamily = '方正小标宋简体,FZXiaoBiaoSong,SimSun,serif';
                titleLi.style.fontWeight = 'bold';
                titleLi.style.color = '#2c3e50';
                titleLi.style.cursor = 'pointer';
                titleLi.style.borderBottom = '2px solid #667eea';
                titleLi.style.marginBottom = '4px';
                titleLi.setAttribute('data-mhidx', '0');
                list.appendChild(titleLi);
            }
            if (!subHeadings.length && titleItem) {
                var empty = document.createElement('li');
                empty.textContent = '（该文章下无层级标题）';
                empty.style.cursor = 'default';
                empty.style.color = '#999';
                list.appendChild(empty);
            } else {
                var minLevel = 1;
                for (var hi = 0; hi < subHeadings.length; hi++) {
                    if (subHeadings[hi].level < minLevel) minLevel = subHeadings[hi].level;
                }
                var _prevHeadByLevel = {};
                for (var _ahi = 0; _ahi < subHeadings.length; _ahi++) {
                    var _thisItem = subHeadings[_ahi];
                    var _anc = [];
                    for (var _al = 1; _al < _thisItem.level; _al++) {
                        if (_prevHeadByLevel[_al]) {
                            _anc.push({ text: _prevHeadByLevel[_al].text || '', level: _al });
                        }
                    }
                    _thisItem.ancestors = _anc;
                    _prevHeadByLevel[_thisItem.level] = _thisItem;
                }
                for (var hi = 0; hi < subHeadings.length; hi++) {
                    (function(idx) {
                        var item = subHeadings[idx];
                        var relLevel = item.level - minLevel + 1;
                        if (relLevel < 1) relLevel = 1;
                        if (relLevel > 3) relLevel = 3;
                        var li = document.createElement('li');
                        var outlineIdx = _materialOutlineItems.push(item) - 1;
                        li.setAttribute('data-moutline-idx', outlineIdx);
                        li.setAttribute('data-mhidx', String(mhBase + idx));
                        li.textContent = item.text;
                         if (relLevel === 1) li.style.paddingLeft = '6px';
                         else if (relLevel === 2) li.style.paddingLeft = 'calc(1em + 6px)';
                         else if (relLevel === 3) li.style.paddingLeft = 'calc(2em + 6px)';
                         var rightFont = _outlineFontFromRight(item);
                         if (rightFont) {
                             li.style.fontFamily = rightFont.family;
                             li.style.fontWeight = 'normal';
                         } else if (relLevel === 1) li.style.fontFamily = '黑体,SimHei,sans-serif';
                         else if (relLevel === 2) li.style.fontFamily = '楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif';
                         else if (relLevel === 3) { li.style.fontFamily = '仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif'; li.style.fontWeight = 'normal'; }
                        var chars;
                        var inlineSib = null;
                        for (var si = 0; si < subHeadings.length; si++) {
                            if (subHeadings[si] !== item && subHeadings[si].element === item.element) { inlineSib = subHeadings[si]; break; }
                        }
                        if (inlineSib) {
                            chars = _npMaterialInlineWords(item.element, item.text, item.level);
                        }
                        if (chars === undefined || chars < 0) {
                            var endIdx = ps.length;
                            for (var j = item.index + 1; j < ps.length; j++) {
                                var nl = _detectHeadingDisplayLevel(ps[j]);
                                if (nl !== null && nl <= item.level) { endIdx = j; break; }
                            }
                            var text = '';
                            for (var k = item.index; k < endIdx; k++) text += ps[k].textContent || '';
                            chars = text.replace(/\s/g, '').length;
                        }
                        li.title = '本部分' + chars + '字';
                        li.onmouseenter = function(e) { _showMaterialWordTip(e, this.title); };
                        li.onmousemove = function(e) { _moveMaterialWordTip(e); };
                        li.onmouseleave = function() { _hideMaterialWordTip(); };
                        list.appendChild(li);
                    })(hi);
                }
            }
            var mhItems = [];
            if (titleItem) { mhItems.push(titleItem); }
            for (var hi = 0; hi < subHeadings.length; hi++) mhItems.push(subHeadings[hi]);
            list._mhData = mhItems;
            if (list._oldMhListener) { list.removeEventListener('click', list._oldMhListener); list._oldMhListener = null; }
            list._mhClickBound = true;
            var handler = function(e) {
                var li = e.target.closest('li[data-mhidx]');
                if (!li || !this.contains(li)) return;
                var idx = parseInt(li.getAttribute('data-mhidx'), 10);
                var item = this._mhData && this._mhData[idx];
                if (!item) return;
                var target = item.element;
                var editor = document.getElementById('notepadEditor');
                _npMaterialJumpToHeading(target, item, editor);
            };
            list._oldMhListener = handler;
            list.addEventListener('click', handler);
        }
        function _materialOutlineCnNum(n) {
            var arr = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];
            return arr[n] || String(n + 1);
        }
        function _materialOutlineSeqStyle(text) {
            text = (text || '').replace(/^\s+/, '');
            var m = text.match(/^([一二三四五六七八九十]+)、/);
            if (m) return { kind:'cn-dun', old:m[0] };
            m = text.match(/^（([一二三四五六七八九十]+)）/);
            if (m) return { kind:'cn-paren', old:m[0] };
            m = text.match(/^(\d+)([.、．])/);
            if (m) return { kind:'num', old:m[0], punct:m[2] };
            m = text.match(/^([一二三四五六七八九十]+)(是|要|看|抓|查|学|紧盯|聚焦)/);
            if (m) return { kind:'cn-verb', old:m[0], verb:m[2] };
            if (text.length > 0) {
                var _circled = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
                var _ci = _circled.indexOf(text.charAt(0));
                if (_ci >= 0) return { kind:'circled', old:text.charAt(0) };
            }
            m = text.match(/^\((\d+)\)/);
            if (m) return { kind:'dig-paren', old:m[0] };
            return null;
        }
        function _materialOutlineRewriteSeq(text, style, idx) {
            if (!style) return text;
            var rep = style.old;
            if (style.kind === 'cn-dun') rep = _materialOutlineCnNum(idx) + '、';
            else if (style.kind === 'cn-paren') rep = '（' + _materialOutlineCnNum(idx) + '）';
            else if (style.kind === 'num') rep = String(idx + 1) + style.punct;
            else if (style.kind === 'cn-verb') rep = _materialOutlineCnNum(idx) + style.verb;
            else if (style.kind === 'circled') { var _c = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳']; rep = _c[idx] || style.old; }
            else if (style.kind === 'dig-paren') rep = '(' + String(idx + 1) + ')';
            return (text || '').replace(style.old, rep);
        }
        function _materialOutlineReplaceText(p, oldText, newText) {
            oldText = (oldText || '').replace(/^\s+|\s+$/g, '');
            if (!p || !oldText || oldText === newText) return false;
            var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
            while (walker.nextNode()) {
                var n = walker.currentNode;
                if (_npIsRemarkTextNode(n, p)) continue;
                var s = n.textContent || '';
                var idx = s.indexOf(oldText);
                if (idx >= 0) { n.textContent = s.substring(0, idx) + newText + s.substring(idx + oldText.length); return true; }
            }
            return false;
        }
        function _materialOutlineEntriesForRenumber() {
            var editor = document.getElementById('notepadEditor');
            var ps = _materialCurrentArticlePs(editor);
            var out = [];
            for (var i = 0; i < ps.length; i++) {
                var p = ps[i];
                var info = _npOutlineDisplayInfo(p);
                if (info && !info.isArticleTitle) out.push({ p:p, text:info.text, level:info.level });
                var extra = _npOutlineExtraEntries(p);
                for (var ei = 0; ei < extra.length; ei++) if (!info || extra[ei].text !== info.text) out.push({ p:p, text:extra[ei].text, level:extra[ei].level });
            }
            return out;
        }
        function _materialOutlineRenumberRange(entries, level, start, end) {
            var style = null, idxs = [];
            for (var i = start; i < end; i++) if (entries[i].level === level) { idxs.push(i); if (!style) style = _materialOutlineSeqStyle(entries[i].text); }
            if (!style) return;
            for (var j = 0; j < idxs.length; j++) {
                var it = entries[idxs[j]];
                var st = _materialOutlineSeqStyle(it.text);
                if (!st || st.kind !== style.kind) continue;
                var nt = _materialOutlineRewriteSeq(it.text, st, j);
                var np = _materialOutlineRewriteSeq(st.old, st, j);
                if (_materialOutlineReplaceText(it.p, st.old, np)) it.text = nt;
            }
        }
        function materialOutlineAutoRenumber() {
            var entries = _materialOutlineEntriesForRenumber();
            _materialOutlineRenumberRange(entries, 1, 0, entries.length);
            var s = 0;
            for (var i = 0; i <= entries.length; i++) if (i === entries.length || entries[i].level === 1) { _materialOutlineRenumberRange(entries, 2, s, i); s = i + 1; }
            s = 0;
            for (var j = 0; j <= entries.length; j++) if (j === entries.length || entries[j].level <= 2) { _materialOutlineRenumberRange(entries, 3, s, j); s = j + 1; }
            saveCurrentEditor();
            _refreshMaterialOutlineContext();
            _renderMaterialOutline();
            showToast('已自动调整序号');
        }
        function _materialOutlineTextPoint(p, offset) {
            var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
            var pos = 0;
            while (walker.nextNode()) {
                var n = walker.currentNode;
                var len = (n.textContent || '').length;
                if (offset <= pos + len) return { node: n, offset: Math.max(0, offset - pos) };
                pos += len;
            }
            return { node: p, offset: p.childNodes.length };
        }
        function _materialOutlineInlineEntries(p) {
            var text = p ? (p.textContent || '') : '';
            var info0 = _npOutlineDisplayInfo(p);
            var extra = p ? _npOutlineExtraEntries(p) : [];
            var entries = [];
            var from = info0 && info0.text ? text.indexOf(info0.text) + info0.text.length : 0;
            if (from < 0) from = 0;
            for (var i = 0; i < extra.length; i++) {
                var t = extra[i].text || '';
                var idx = text.indexOf(t, from);
                if (idx < 0) idx = text.indexOf(t);
                if (idx < 0) continue;
                entries.push({ text: t, level: extra[i].level, start: idx });
                from = idx + t.length;
            }
            entries.sort(function(a, b) { return a.start - b.start; });
            return entries;
        }
        function _materialOutlineMoveInline(item, dir) {
            var p = item && item.element;
            var entries = _materialOutlineInlineEntries(p);
            var cur = -1;
            for (var i = 0; i < entries.length; i++) if (entries[i].level === item.level && entries[i].text === item.text) { cur = i; break; }
            if (cur < 0) return false;
            var target = -1;
            if (dir < 0) {
                for (var a = cur - 1; a >= 0; a--) if (entries[a].level === item.level) { target = a; break; }
                if (target < 0) { showToast('已经是本层级第一项'); return true; }
                var curEnd = (cur + 1 < entries.length && entries[cur + 1].level <= item.level) ? entries[cur + 1].start : (p.textContent || '').length;
                var curRange = document.createRange();
                var curStartPoint = _materialOutlineTextPoint(p, entries[cur].start);
                var curEndPoint = _materialOutlineTextPoint(p, curEnd);
                curRange.setStart(curStartPoint.node, curStartPoint.offset);
                curRange.setEnd(curEndPoint.node, curEndPoint.offset);
                var frag = curRange.extractContents();
                var targetPoint = _materialOutlineTextPoint(p, entries[target].start);
                var targetRange = document.createRange();
                targetRange.setStart(targetPoint.node, targetPoint.offset);
                targetRange.collapse(true);
                targetRange.insertNode(frag);
            } else {
                for (var b = cur + 1; b < entries.length; b++) if (entries[b].level === item.level) { target = b; break; }
                if (target < 0) { showToast('已经是本层级最后一项'); return true; }
                var targetEnd = (target + 1 < entries.length && entries[target + 1].level <= item.level) ? entries[target + 1].start : (p.textContent || '').length;
                var targetRange2 = document.createRange();
                var targetStartPoint = _materialOutlineTextPoint(p, entries[target].start);
                var targetEndPoint = _materialOutlineTextPoint(p, targetEnd);
                targetRange2.setStart(targetStartPoint.node, targetStartPoint.offset);
                targetRange2.setEnd(targetEndPoint.node, targetEndPoint.offset);
                var frag2 = targetRange2.extractContents();
                var curPoint = _materialOutlineTextPoint(p, entries[cur].start);
                var curRange2 = document.createRange();
                curRange2.setStart(curPoint.node, curPoint.offset);
                curRange2.collapse(true);
                curRange2.insertNode(frag2);
            }
            return true;
        }
        function _materialOutlineSectionEnd(ps, start, level) {
            var end = ps.length;
            for (var i = start + 1; i < ps.length; i++) { var lv = _detectHeadingDisplayLevel(ps[i]); if (lv !== null && lv <= level) { end = i; break; } }
            return end;
        }
        function _materialOutlineInlineIndex(item) {
            var p = item && item.element;
            var entries = _materialOutlineInlineEntries(p);
            for (var i = 0; i < entries.length; i++) if (entries[i].level === item.level && entries[i].text === item.text) return { entries: entries, index: i };
            return null;
        }
        function _materialOutlineIsInlineItem(item) {
            for (var mi = 0; mi < _materialOutlineItems.length; mi++) if (_materialOutlineItems[mi] !== item && _materialOutlineItems[mi].element === item.element) return true;
            return false;
        }
        function _materialOutlineCutInline(item) {
            var p = item && item.element;
            var info = _materialOutlineInlineIndex(item);
            if (!p || !info) return false;
            var entries = info.entries, cur = info.index;
            var end = (cur + 1 < entries.length && entries[cur + 1].level <= item.level) ? entries[cur + 1].start : (p.textContent || '').length;
            var range = document.createRange();
            var sp = _materialOutlineTextPoint(p, entries[cur].start);
            var ep = _materialOutlineTextPoint(p, end);
            range.setStart(sp.node, sp.offset);
            range.setEnd(ep.node, ep.offset);
            _materialOutlineCut = { fragment: range.extractContents(), inline: true };
            return true;
        }
        function _materialOutlinePasteInlineAfter(item) {
            var p = item && item.element;
            if (!p || !_materialOutlineCut || !_materialOutlineCut.fragment) return false;
            var info = _materialOutlineInlineIndex(item);
            var end = (p.textContent || '').length;
            if (info) {
                var entries = info.entries, cur = info.index;
                end = (cur + 1 < entries.length && entries[cur + 1].level <= item.level) ? entries[cur + 1].start : end;
            }
            var point = _materialOutlineTextPoint(p, end);
            var range = document.createRange();
            range.setStart(point.node, point.offset);
            range.collapse(true);
            range.insertNode(_materialOutlineCut.fragment);
            return true;
        }
        function _materialOutlineCutItem(item) {
            var editor = document.getElementById('notepadEditor');
            if (!editor || !item || !item.element) return;
            if (_materialOutlineIsInlineItem(item)) {
                if (_materialOutlineCutInline(item)) { saveCurrentEditor(); _refreshMaterialOutlineContext(); showToast('已剪切'); }
                return;
            }
            var ps = Array.prototype.slice.call(editor.querySelectorAll('p'));
            var start = ps.indexOf(item.element);
            if (start < 0) return;
            var end = _materialOutlineSectionEnd(ps, start, item.level);
            _materialOutlineCut = { nodes: [], level: item.level };
            for (var i = start; i < end; i++) _materialOutlineCut.nodes.push(ps[i]);
            for (var j = 0; j < _materialOutlineCut.nodes.length; j++) editor.removeChild(_materialOutlineCut.nodes[j]);
            saveCurrentEditor();
            _refreshMaterialOutlineContext();
            showToast('已剪切');
        }
        function _materialOutlinePasteAfter(item) {
            var editor = document.getElementById('notepadEditor');
            if (!editor || !item || !item.element || !_materialOutlineCut) return;
            if (_materialOutlineCut.inline) {
                if (_materialOutlinePasteInlineAfter(item)) { _materialOutlineCut = null; materialOutlineAutoRenumber(); saveCurrentEditor(); _refreshMaterialOutlineContext(); showToast('已粘贴'); }
                return;
            }
            if (!_materialOutlineCut.nodes || !_materialOutlineCut.nodes.length) return;
            var ps = Array.prototype.slice.call(editor.querySelectorAll('p'));
            var start = ps.indexOf(item.element);
            if (start < 0) return;
            var end = _materialOutlineSectionEnd(ps, start, item.level);
            var ref = end < ps.length ? ps[end] : null;
            var frag = document.createDocumentFragment();
            for (var i = 0; i < _materialOutlineCut.nodes.length; i++) frag.appendChild(_materialOutlineCut.nodes[i]);
            editor.insertBefore(frag, ref);
            _materialOutlineCut = null;
            materialOutlineAutoRenumber();
            saveCurrentEditor();
            _refreshMaterialOutlineContext();
            showToast('已粘贴');
        }
        function _materialOutlineMove(item, dir) {
            var editor = document.getElementById('notepadEditor');
            if (!editor || !item || !item.element) return;
            var ps = Array.prototype.slice.call(editor.querySelectorAll('p'));
            var start = ps.indexOf(item.element);
            if (start < 0) return;
            for (var mi = 0; mi < _materialOutlineItems.length; mi++) if (_materialOutlineItems[mi] !== item && _materialOutlineItems[mi].element === item.element) { if (_materialOutlineMoveInline(item, dir)) { materialOutlineAutoRenumber(); saveCurrentEditor(); } else showToast('段内标题无法移动'); return; }
            var end = _materialOutlineSectionEnd(ps, start, item.level);
            var targetStart = -1, targetEnd = -1;
            if (dir < 0) {
                for (var p = start - 1; p >= 0; p--) { var pl = _detectHeadingDisplayLevel(ps[p]); if (pl === item.level) { targetStart = p; break; } if (pl !== null && pl < item.level) break; }
                if (targetStart < 0) { showToast('已经是本层级第一项'); return; }
                targetEnd = start;
                var frag = document.createDocumentFragment();
                for (var a = start; a < end; a++) frag.appendChild(ps[a]);
                editor.insertBefore(frag, ps[targetStart]);
            } else {
                for (var n = end; n < ps.length; n++) { var nl = _detectHeadingDisplayLevel(ps[n]); if (nl !== null && nl < item.level) break; if (nl === item.level) { targetStart = n; break; } }
                if (targetStart < 0) { showToast('已经是本层级最后一项'); return; }
                targetEnd = ps.length;
                for (var b = targetStart + 1; b < ps.length; b++) { var bl = _detectHeadingDisplayLevel(ps[b]); if (bl !== null && bl <= item.level) { targetEnd = b; break; } }
                var ref = targetEnd < ps.length ? ps[targetEnd] : null;
                var frag2 = document.createDocumentFragment();
                for (var c = start; c < end; c++) frag2.appendChild(ps[c]);
                editor.insertBefore(frag2, ref);
            }
            materialOutlineAutoRenumber();
            saveCurrentEditor();
            _refreshMaterialOutlineContext();
        }
        function _showMaterialOutlineCtx(e, item, mode) {
            e.preventDefault();
            e.stopPropagation();
            _materialOutlineCtxMode = mode || 'material';
            var menu = document.getElementById('materialOutlineCtxMenu');
            if (!menu) {
                menu = document.createElement('div');
                menu.id = 'materialOutlineCtxMenu';
                menu.className = 'paContextMenu';
                menu.innerHTML = '<div class="paCtxItem" data-moutline-action="edit" style="font-size:15px;padding:10px 20px;">修改</div><div class="paCtxItem" data-moutline-action="cut" style="font-size:15px;padding:10px 20px;">剪切</div><div class="paCtxItem" data-moutline-action="paste" style="font-size:15px;padding:10px 20px;display:none;">粘贴</div><div class="paCtxItem" data-moutline-action="up" style="font-size:15px;padding:10px 20px;">上移</div><div class="paCtxItem" data-moutline-action="down" style="font-size:15px;padding:10px 20px;">下移</div>';
                document.body.appendChild(menu);
                menu.addEventListener('click', function(ev) {
                    var actionItem = ev.target.closest('.paCtxItem');
                    if (!actionItem) return;
                    var curItem = menu._materialItem;
                    var action = actionItem.getAttribute('data-moutline-action');
                    if (action === 'cut') { menu.classList.remove('show'); _materialOutlineCutItem(curItem); return; }
                    if (action === 'paste') { menu.classList.remove('show'); _materialOutlinePasteAfter(curItem); return; }
                    if (action === 'up') { menu.classList.remove('show'); _materialOutlineMove(curItem, -1); return; }
                    if (action === 'down') { menu.classList.remove('show'); _materialOutlineMove(curItem, 1); return; }
                    if (action === 'edit') {
                        menu.classList.remove('show');
                        var editor = document.getElementById('notepadEditor');
                        if (!editor || !curItem || !curItem.element) return;
                        var fontFamily = '黑体,SimHei,sans-serif';
                        var fontSize = '18px';
                        if (curItem.level === 2) fontFamily = '楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif';
                        else if (curItem.level === 3) fontFamily = '仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif';
                        var dlg = document.getElementById('materialOutlineEditDialog');
                        if (!dlg) {
                            dlg = document.createElement('div');
                            dlg.id = 'materialOutlineEditDialog';
                            dlg.style.cssText = 'position:fixed;z-index:2147483601;background:#fff;border:2px solid #667eea;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.3);padding:20px;min-width:360px;max-width:500px;';
                            dlg.innerHTML = '<div style="font-size:16px;font-weight:bold;color:#2c3e50;margin-bottom:12px;cursor:move;" id="materialOutlineEditTitle">修改提纲</div><div style="background:#fff;border:1px solid #ddd;border-radius:4px;padding:10px 14px;font-size:18px;outline:none;min-height:24px;max-height:120px;overflow-y:auto;" id="materialOutlineEditInput" contenteditable="true"></div><div style="text-align:right;margin-top:14px;display:flex;justify-content:flex-end;gap:8px;"><button style="padding:8px 24px;border:none;border-radius:4px;cursor:pointer;font-size:15px;background:#667eea;color:white;" id="materialOutlineEditOk">保存</button><button style="padding:8px 24px;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-size:15px;background:#f5f5f5;color:#333;" id="materialOutlineEditCancel">取消</button></div>';
                            document.body.appendChild(dlg);
                            var editInput = dlg.querySelector('#materialOutlineEditInput');
                            if (editInput) {
                                editInput.addEventListener('paste', function(ev) {
                                    ev.preventDefault();
                                    var dt = ev.clipboardData || window.clipboardData;
                                    var t = dt ? (dt.getData('text/plain') || dt.getData('Text') || dt.getData('text')) : '';
                                    if (!t && dt) {
                                        var hp = dt.getData('text/html') || '';
                                        if (hp) { var hpD = document.createElement('div'); hpD.innerHTML = hp; t = hpD.textContent || hpD.innerText || ''; }
                                    }
                                    if (t) { try { document.execCommand('insertText', false, t); } catch(e0) {} }
                                });
                                editInput.addEventListener('keydown', function(ev) {
                                    if (ev.key === 'Enter' && !ev.shiftKey) {
                                        ev.preventDefault();
                                        var okBtn2 = document.getElementById('materialOutlineEditOk');
                                        if (okBtn2) okBtn2.click();
                                    }
                                });
                            }
                            dlg.addEventListener('mousedown', function(ev) {
                                var title = ev.target.closest('#materialOutlineEditTitle');
                                if (!title) return;
                                var offX = ev.clientX - dlg.offsetLeft;
                                var offY = ev.clientY - dlg.offsetTop;
                                function onMove(mv) { dlg.style.left = Math.max(4, Math.min(window.innerWidth - dlg.offsetWidth - 4, mv.clientX - offX)) + 'px'; dlg.style.top = Math.max(4, Math.min(window.innerHeight - dlg.offsetHeight - 4, mv.clientY - offY)) + 'px'; }
                                function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
                                document.addEventListener('mousemove', onMove);
                                document.addEventListener('mouseup', onUp);
                                ev.preventDefault();
                            });
                        }
                        var input = document.getElementById('materialOutlineEditInput');
                        var okBtn = document.getElementById('materialOutlineEditOk');
                        var cancelBtn = document.getElementById('materialOutlineEditCancel');
                        input.style.fontFamily = fontFamily;
                        input.style.fontSize = fontSize;
                        input.innerText = curItem.text;
                        dlg.style.left = Math.max(4, Math.round((window.innerWidth - 400) / 2)) + 'px';
                        dlg.style.top = Math.max(4, Math.round((window.innerHeight - 220) / 2)) + 'px';
                        dlg.classList.add('show');
                        dlg.style.display = 'block';
                        setTimeout(function() { input.focus(); var r = document.createRange(); r.selectNodeContents(input); r.collapse(false); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }, 30);
                        okBtn.onclick = function() {
                            var val = (input.innerText || '').replace(/^\s+|\s+$/g, '');
                            var oldVal = menu._materialOldText || curItem.text;
                            if (val && val !== oldVal) {
                                if (_materialOutlineReplaceText(curItem.element, oldVal, val)) saveCurrentEditor();
                                curItem.text = val;
                                _refreshMaterialOutlineContext();
                            }
                            dlg.style.display = 'none';
                            dlg.classList.remove('show');
                        };
                        cancelBtn.onclick = function() { dlg.style.display = 'none'; dlg.classList.remove('show'); };
                    }
                });
                document.addEventListener('click', function(ev) {
                    if (menu.classList.contains('show') && !ev.target.closest('#materialOutlineCtxMenu')) {
                        menu.classList.remove('show');
                    }
                });
            }
            menu._materialItem = item;
            menu._materialOldText = item && item.text ? item.text : '';
            var pasteItem = menu.querySelector('[data-moutline-action="paste"]');
            if (pasteItem) pasteItem.style.display = _materialOutlineCut ? '' : 'none';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            menu.classList.add('show');
        }
        function _showMaterialWordTip(e, text) {
            var tip = document.getElementById('paTagTooltip');
            if (!tip) return;
            tip.textContent = text || '';
            tip.classList.add('show');
            _moveMaterialWordTip(e);
        }
        function _moveMaterialWordTip(e) {
            var tip = document.getElementById('paTagTooltip');
            if (!tip || !tip.classList.contains('show')) return;
            var left = e.clientX + 12, top = e.clientY + 12;
            if (left + tip.offsetWidth > window.innerWidth - 8) left = e.clientX - tip.offsetWidth - 12;
            if (top + tip.offsetHeight > window.innerHeight - 8) top = e.clientY - tip.offsetHeight - 12;
            tip.style.left = Math.max(4, left) + 'px';
            tip.style.top = Math.max(4, top) + 'px';
        }
        function _hideMaterialWordTip() {
            var tip = document.getElementById('paTagTooltip');
            if (tip) tip.classList.remove('show');
        }
        function toggleMaterialFullscreen() {
            if (!_materialMode) return;
            S._materialFullscreen = !_materialFullscreen;
            _materialLayout();
        }
         function _renderMaterialNoteMenu() {
             var menu = document.getElementById('materialNoteMenu');
             if (!menu) return;
             menu.innerHTML = '';
             for (var i = 0; i < npTabCount(); i++) {
                 var item = document.createElement('div');
                item.className = 'paDropdownItem';
                item.textContent = '窗口' + (i + 1) + '：' + (notepadTitles[i] || '…');
                (function(idx) { item.onclick = function() { switchMaterialNoteTab(idx); paCloseDropdowns(); }; })(i);
                menu.appendChild(item);
             }
         }
         function _updateMaterialNoteButton() {
             var btn = document.querySelector('.materialNoteMain');
             if (btn) btn.textContent = _materialNoteTab >= 0 ? ('窗口' + (_materialNoteTab + 1)) : '其他窗口';
         }
         function _renderMaterialNoteView() {
             var view = document.getElementById('materialNoteView');
             if (!view) return;
             _updateMaterialNoteButton();
             if (_materialNoteTab < 0) { view.className = 'bg0'; view.innerHTML = ''; return; }
             view.className = 'bg' + _materialNoteTab;
            var tmp = document.createElement('div');
            tmp.innerHTML = (notepadEditorData[_materialNoteTab] && notepadEditorData[_materialNoteTab].html) || '';
            var ps = tmp.querySelectorAll('p');
            for (var i = 0; i < ps.length; i++) { ps[i].removeAttribute('data-collapsed'); ps[i].style.display = ''; }
            view.innerHTML = tmp.innerHTML;
            var vps = view.querySelectorAll('p');
            for (var j = 0; j < vps.length; j++) {
                if ((vps[j].style.textAlign || '') !== 'center') vps[j].style.textAlign = 'justify';
            }
        }
        function switchMaterialAssistTab(tab, skipSearch) {
            S._materialActiveTab = tab;
            var tabs = document.querySelectorAll('.materialAssistTab');
            for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i].getAttribute('data-mtab') === tab);
            var panes = document.querySelectorAll('.materialAssistPane');
            for (var i = 0; i < panes.length; i++) panes[i].classList.remove('show');
            var paneId = tab === 'outline' ? 'materialOutlinePane' : (tab === 'whiteboard' ? 'materialWhiteboardPane' : (tab === 'mirror' ? 'materialMirrorPane' : 'materialNotePane'));
            var pane = document.getElementById(paneId);
            if (pane) pane.classList.add('show');
            if (tab === 'outline') _renderMaterialOutline();
            if (tab === 'mirror') _materialMirrorRefresh();
            if (tab === 'note') { _renderMaterialNoteMenu(); _renderMaterialNoteView(); }
            _applyMaterialAssistZoom();
            if (!skipSearch) materialDoSearch();
        }
        function toggleMaterialNoteMenu(e) {
            e.preventDefault();
            e.stopPropagation();
            var menu = document.getElementById('materialNoteMenu');
            var wasOpen = menu && menu.classList.contains('show');
            switchMaterialAssistTab('note');
            _renderMaterialNoteMenu();
            paCloseDropdowns();
            var assist = document.getElementById('materialAssistPanel');
            if (menu && assist) {
                var wrap = menu.closest('.materialNoteWrap');
                menu.style.left = wrap ? (-wrap.offsetLeft) + 'px' : '0px';
                menu.style.width = Math.max(120, assist.getBoundingClientRect().width - 16) + 'px';
                if (!wasOpen) menu.classList.add('show');
            }
        }
         function switchMaterialNoteTab(idx) {
             saveCurrentEditor();
             S._materialNoteTab = idx;
            _renderMaterialNoteView();
            materialDoSearch();
        }
        function _materialSearchRoots() {
            var roots = [];
            var editor = document.getElementById('notepadEditor');
            var whiteboardView = document.getElementById('materialWhiteboardSearchView');
            var noteView = document.getElementById('materialNoteView');
            var mirrorView = document.getElementById('materialMirrorView');
            var outline = document.getElementById('materialOutlineList');
            if (editor) roots.push(editor);
            if (whiteboardView) roots.push(whiteboardView);
            if (noteView) roots.push(noteView);
            if (mirrorView) roots.push(mirrorView);
            if (outline) roots.push(outline);
            return roots;
        }
        function _clearMaterialSearch() {
            var roots = _materialSearchRoots();
            for (var ri = 0; ri < roots.length; ri++) {
                var root = roots[ri];
                if (!root) continue;
                root.classList.remove('materialSearchHit');
                if (root.tagName === 'TEXTAREA') continue;
                root.innerHTML = root.innerHTML.replace(/<span class="notepadSearchHL[0-4]( focused)?">([\s\S]*?)<\/span>/g, '$2');
                var items = root.querySelectorAll('[data-material-search-hidden="1"]');
                for (var i = 0; i < items.length; i++) { items[i].style.display = ''; items[i].removeAttribute('data-material-search-hidden'); }
            }
            S._materialSearchMatches = [];
            S._materialSearchIndex = -1;
            var wbPane = document.getElementById('materialWhiteboardPane');
            if (wbPane) wbPane.classList.remove('searching');
        }
        function _escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
        function _updateMaterialWhiteboardSearchView(keyword) {
            var wb = document.getElementById('materialWhiteboard');
            var view = document.getElementById('materialWhiteboardSearchView');
            var pane = document.getElementById('materialWhiteboardPane');
            if (!wb || !view || !pane) return;
            var kw = (keyword || '').trim();
            if (!kw) {
                view.innerHTML = '';
                pane.classList.remove('searching');
                return;
            }
            var parts = kw.split(/\s+/).filter(Boolean);
            if (!parts.length) return;
            var text = wb.value || '';
            var html = escapeHtml(text).replace(/\n/g, '<br>');
            for (var i = 0; i < parts.length; i++) {
                var re = new RegExp('(' + _escapeRegExp(escapeHtml(parts[i])) + ')', 'gi');
                html = html.replace(re, '<span class="notepadSearchHL' + (i % 5) + '">$1</span>');
            }
            view.innerHTML = html || '&nbsp;';
            pane.classList.add('searching');
        }
        var _materialSearchTimer = null;
        function materialDoSearch() {
            if (_materialSearchTimer) clearTimeout(_materialSearchTimer);
            _materialSearchTimer = setTimeout(function() {
                _materialSearchTimer = null;
                _clearMaterialSearch();
                var input = document.getElementById('materialSearchInput');
                var count = document.getElementById('materialSearchCount');
                var nav = document.getElementById('materialSearchNav');
                var filter = document.getElementById('materialSearchFilter');
                var kw = input ? input.value.trim() : '';
                _updateMaterialWhiteboardSearchView(kw);
                if (!kw) { if (count) count.textContent = ''; if (nav) nav.classList.remove('show'); return; }
                var parts = kw.split(/\s+/).filter(Boolean);
                if (!parts.length) return;
                var roots = _materialSearchRoots();
                for (var r = 0; r < roots.length; r++) {
                    var root = roots[r];
                    if (!root) continue;
                    if (root.tagName === 'TEXTAREA') continue;
                    var html = root.innerHTML;
                    for (var i = 0; i < parts.length; i++) {
                        var re = new RegExp('(' + _escapeRegExp(parts[i]) + ')', 'gi');
                        html = html.replace(re, '<span class="notepadSearchHL' + (i % 5) + '">$1</span>');
                    }
                    root.innerHTML = html;
                    var matches = Array.prototype.slice.call(root.querySelectorAll('span.notepadSearchHL0,span.notepadSearchHL1,span.notepadSearchHL2,span.notepadSearchHL3,span.notepadSearchHL4'));
                    if (matches.length) {
                        root.classList.add('materialSearchHit');
                        for (var m = 0; m < matches.length; m++) _materialSearchMatches.push(matches[m]);
                    }
                    if (filter && filter.checked) {
                        var rows = root.querySelectorAll('li, p, div');
                        for (var rr = 0; rr < rows.length; rr++) {
                            if (!rows[rr].querySelector('span.notepadSearchHL0,span.notepadSearchHL1,span.notepadSearchHL2,span.notepadSearchHL3,span.notepadSearchHL4')) {
                                rows[rr].style.display = 'none';
                                rows[rr].setAttribute('data-material-search-hidden', '1');
                            }
                        }
                    }
                }
                if (_materialSearchMatches.length) {
                    S._materialSearchIndex = 0;
                    _focusMaterialSearch();
                }
                if (count) count.textContent = _materialSearchMatches.length ? ('1/' + _materialSearchMatches.length) : '0/0';
                if (nav) nav.classList.toggle('show', _materialSearchMatches.length > 0);
            }, 120);
        }
        function _focusMaterialSearch() {
            for (var i = 0; i < _materialSearchMatches.length; i++) {
                var it = _materialSearchMatches[i];
                var node = it && it.el ? it.el : it;
                if (node && node.classList) node.classList.remove('focused');
            }
            var item = _materialSearchMatches[_materialSearchIndex];
            if (!item) return;
            if (item.kind === 'textarea' && item.el) {
                item.el.focus();
                try { item.el.setSelectionRange(item.pos, item.pos + item.len); } catch (e) {}
                item.el.classList.add('materialSearchHit');
                if (item.el.scrollIntoView) item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                var el = item.el || item;
                if (el.classList) el.classList.add('focused');
                if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            var count = document.getElementById('materialSearchCount');
            if (count) count.textContent = (_materialSearchIndex + 1) + '/' + _materialSearchMatches.length;
        }
        function materialSearchNext() {
            if (!_materialSearchMatches.length) return;
            S._materialSearchIndex = (_materialSearchIndex + 1) % _materialSearchMatches.length;
            _focusMaterialSearch();
        }
        function materialSearchPrev() {
            if (!_materialSearchMatches.length) return;
            S._materialSearchIndex = (_materialSearchIndex - 1 + _materialSearchMatches.length) % _materialSearchMatches.length;
            _focusMaterialSearch();
        }
        var _materialSearchDrag = null;
        function _materialPositionSearchBox() {
            var wrap = document.getElementById('materialSearchWrap');
            var btn = document.getElementById('materialSearchBtn');
            if (!wrap || !btn) return;
            var rect = btn.getBoundingClientRect();
            var left = Math.min(window.innerWidth - wrap.offsetWidth - 8, Math.max(8, rect.left));
            var top = Math.min(window.innerHeight - wrap.offsetHeight - 8, Math.max(8, rect.bottom + 8));
            wrap.style.left = left + 'px';
            wrap.style.top = top + 'px';
        }
        function _bindMaterialSearchDrag() {
            var handle = document.getElementById('materialSearchDragHandle');
            var wrap = document.getElementById('materialSearchWrap');
            if (!handle || !wrap || handle._boundDrag) return;
            handle._boundDrag = true;
            handle.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;
                _materialSearchDrag = { startX: e.clientX, startY: e.clientY, left: parseInt(wrap.style.left || '0', 10) || 0, top: parseInt(wrap.style.top || '0', 10) || 0 };
                e.preventDefault();
                e.stopPropagation();
            });
            document.addEventListener('mousemove', function(e) {
                if (!_materialSearchDrag) return;
                wrap.style.left = Math.max(8, Math.min(window.innerWidth - wrap.offsetWidth - 8, _materialSearchDrag.left + (e.clientX - _materialSearchDrag.startX))) + 'px';
                wrap.style.top = Math.max(8, Math.min(window.innerHeight - wrap.offsetHeight - 8, _materialSearchDrag.top + (e.clientY - _materialSearchDrag.startY))) + 'px';
            });
            document.addEventListener('mouseup', function() { _materialSearchDrag = null; });
        }
        function closeMaterialSearch() {
            var wrap = document.getElementById('materialSearchWrap');
            var btn = document.getElementById('materialSearchBtn');
            var input = document.getElementById('materialSearchInput');
            if (!wrap || !btn || !input) return;
            wrap.style.display = 'none';
            btn.classList.remove('active');
            input.value = '';
            S._materialSearchMatches = [];
            S._materialSearchIndex = -1;
            S._materialSearchOriginal = {};
            var roots = _materialSearchRoots();
            for (var ri = 0; ri < roots.length; ri++) {
                var root = roots[ri];
                if (!root || root.tagName === 'TEXTAREA') continue;
                var items = root.querySelectorAll('[data-material-search-hidden="1"]');
                for (var i = 0; i < items.length; i++) { items[i].style.display = ''; items[i].removeAttribute('data-material-search-hidden'); }
                root.innerHTML = root.innerHTML.replace(/<span class="notepadSearchHL[0-4]( focused)?">([\s\S]*?)<\/span>/g, '$2');
            }
            var wbPane = document.getElementById('materialWhiteboardPane');
            if (wbPane) wbPane.classList.remove('searching');
            var wbView = document.getElementById('materialWhiteboardSearchView');
            if (wbView) wbView.innerHTML = '';
            var filter = document.getElementById('materialSearchFilter');
            if (filter) filter.checked = false;
            var count = document.getElementById('materialSearchCount');
            if (count) count.textContent = '';
            var nav = document.getElementById('materialSearchNav');
            if (nav) nav.classList.remove('show');
            materialDoSearch();
        }
        function toggleMaterialSearch(e) {
            e.preventDefault();
            e.stopPropagation();
            var wrap = document.getElementById('materialSearchWrap');
            var btn = document.getElementById('materialSearchBtn');
            var input = document.getElementById('materialSearchInput');
            if (!wrap) return;
            var show = wrap.style.display === 'none' || getComputedStyle(wrap).display === 'none';
            wrap.style.display = show ? 'flex' : 'none';
            if (btn) btn.classList.toggle('active', show);
            if (show && input) {
                _materialPositionSearchBox();
                _bindMaterialSearchDrag();
                setTimeout(function() { input.focus(); }, 0);
            } else {
                closeMaterialSearch();
            }
        }
        function _applyMaterialEditorBg(color) {
            S._materialBgColor = color || 'none';
            try { DataLayer.setRaw('materialEditorBgColor', _materialBgColor); } catch(e) {}
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var map = { none:'#fff', yellow:'#fffde7', blue:'#eef7ff', green:'#f1fff3', pink:'#fff3f5', purple:'#faf3ff' };
            var darkMap = { none:'#000', yellow:'#6b5a08', blue:'#153b63', green:'#145326', pink:'#6a1d2a', purple:'#51226a' };
            if (_materialBgColor === 'invert') {
                var base = DataLayer.getRaw('materialEditorBgBase') || 'none';
                editor.style.backgroundColor = darkMap[base] || '#000';
                editor.style.color = '#fff';
            } else {
                try { DataLayer.setRaw('materialEditorBgBase', _materialBgColor); } catch(e) {}
                editor.style.backgroundColor = map[_materialBgColor] || '#fff';
                editor.style.color = '';
            }
        }
        function _clearMaterialEditorBg() {
            var editor = document.getElementById('notepadEditor');
            if (editor) { editor.style.backgroundColor = ''; editor.style.color = ''; }
        }
        function _enterMaterialMode(panel) {
            if (tileVisible || notepadTileMode !== 'normal') hideTile();
            S._notepadWorkHidden = false;
            S.notepadVisible = true;
            panel.style.display = '';
            panel.classList.add('show', 'material-active');
            panel.classList.remove('write-note-active', 'write-note-hidden', 'notepad-dir-browse-active');
            var outlineModal = document.getElementById('notepadOutlineModal');
            if (outlineModal) outlineModal.classList.remove('show');
             S._materialMode = true;
             S._writeNoteMode = true;
             S._materialNoteTab = -1;
            var assist = document.getElementById('materialAssistPanel');
            if (assist) assist.classList.add('show');
            _setNotepadAutoFormatEnabled(true, true);
            var settingsBtn = document.getElementById('notepadSettingsBtn');
            if (settingsBtn && !settingsBtn.classList.contains('active')) toggleNotepadToolbars();
            var tabs = document.getElementById('notepadDragHandle');
            if (tabs) tabs.style.display = 'none';
            var editor = document.getElementById('notepadEditor');
            if (editor) { editor.style.minHeight = '60vh'; editor.classList.remove('notebook-style'); _applyMaterialEditorBg(_materialBgColor); }
            if (editor) {
                var allPs = Array.prototype.slice.call(editor.querySelectorAll('p'));
                if (allPs.length) {
                    var curPs = _materialCurrentArticlePs(editor);
                    S._materialSavedArticlePs = curPs;
                    for (var pi = 0; pi < allPs.length; pi++) {
                        if (curPs.indexOf(allPs[pi]) === -1) {
                            allPs[pi].style.display = 'none';
                        }
                    }
                }
            }
            var wb = document.getElementById('materialWhiteboard');
            if (wb) {
                try { wb.value = DataLayer.getRaw('materialWhiteboard') || ''; } catch(e) {}
                wb.oninput = function() {
                    try { DataLayer.setRaw('materialWhiteboard', wb.value || ''); } catch(e) {}
                    var sw = document.getElementById('materialSearchWrap');
                    if (sw && getComputedStyle(sw).display !== 'none') _updateMaterialWhiteboardSearchView(document.getElementById('materialSearchInput') ? document.getElementById('materialSearchInput').value : '');
                };
            }
            S._materialSplitRatio = 0.2;
            S._materialFullscreen = false;
             _materialLayout();
             _bindMaterialAssistManualAdjust();
             _applyMaterialAssistZoom();
             autoRecognizeHeadings();
             switchMaterialAssistTab('outline');
            var mi = document.querySelector('#notepadDisplayMenu .paDropdownItem[data-dmode="material"]');
            if (mi) mi.classList.add('paDropdownItemActive');
            var btn = document.getElementById('notepadDisplayBtn');
            if (btn) btn.classList.add('displayModeActive');
            showToast('已进入写材料模式');
        }
        function exitMaterialToDefaultNotepad() {
            if (!_materialMode) return;
            _exitMaterialMode();
            var panel = document.getElementById('notepadPanel');
            if (panel) {
                panel.style.display = '';
                panel.classList.add('show');
                autoFitNotepadHeight();
                panel.dataset.npUserMoved = '1';
                panel.dataset.npUserResized = '1';
            }
            S.notepadVisible = true;
        }
        function _exitMaterialMode() {
            if (!_materialMode) return;
            _autoSaveIfDirty();
            S._materialMode = false;
            S._materialFullscreen = false;
            var assist = document.getElementById('materialAssistPanel');
            if (assist) { assist.classList.remove('show', 'materialDividerHidden'); assist.style.display = ''; }
            S._notepadWorkHidden = false;
            var panel0 = document.getElementById('notepadPanel');
            if (panel0) panel0.classList.remove('write-note-active', 'write-note-hidden', 'material-active', 'notepad-dir-browse-active', 'materialDividerHidden');
            var divider = document.getElementById('mainSplitDivider');
            if (divider) divider.classList.remove('materialDividerHidden');
            var mn = document.getElementById('materialNoteMenu');
            if (mn) mn.classList.remove('show');
            var sw = document.getElementById('materialSearchWrap');
            if (sw) sw.style.display = 'none';
            var sb = document.getElementById('materialSearchBtn');
            if (sb) sb.classList.remove('active');
            S._writeNoteMode = false;
            if (_materialSavedArticlePs != null) {
                var editor = document.getElementById('notepadEditor');
                if (editor) {
                    var allPs = editor.querySelectorAll('p');
                    for (var pi = 0; pi < allPs.length; pi++) allPs[pi].style.display = '';
                }
                S._materialSavedArticlePs = null;
            }
            var editor = document.getElementById('notepadEditor');
            if (editor) {
                editor.querySelectorAll('.materialOutlineHighlight').forEach(function(el) { el.classList.remove('materialOutlineHighlight'); });
            }
            _notepadDisplayMode = null;
            var panel = document.getElementById('notepadPanel');
            if (panel && _notepadInitialBounds) {
                panel.style.top = _notepadInitialBounds.top;
                panel.style.left = _notepadInitialBounds.left;
                panel.style.width = _notepadInitialBounds.width;
                panel.style.height = _notepadInitialBounds.height;
                panel.style.bottom = _notepadInitialBounds.bottom || '';
            }
            var tabs = document.getElementById('notepadDragHandle');
            if (tabs) tabs.style.display = '';
            var editor = document.getElementById('notepadEditor');
            if (editor) { editor.style.minHeight = ''; _clearMaterialEditorBg(); _applyNotepadNotebookStyle(); }
            var settingsBtn = document.getElementById('notepadSettingsBtn');
            if (settingsBtn && settingsBtn.classList.contains('active')) toggleNotepadToolbars();
            var btn = document.getElementById('notepadDisplayBtn');
            if (btn) btn.classList.remove('displayModeActive');
            var items = document.querySelectorAll('#notepadDisplayMenu .paDropdownItem');
            for (var i = 0; i < items.length; i++) items[i].classList.remove('paDropdownItemActive');
        }
        (function bindMaterialSearchInput() {
            setTimeout(function() {
                var input = document.getElementById('materialSearchInput');
                var filter = document.getElementById('materialSearchFilter');
                if (input) input.addEventListener('input', materialDoSearch);
                if (filter) filter.addEventListener('change', materialDoSearch);
                _bindMaterialSearchDrag();
            }, 0);
        })();
        function _enterWriteNoteMode(panel) {
            if (tileVisible || notepadTileMode !== 'normal') hideTile();
            S._notepadWorkHidden = false;
            S.notepadVisible = true;
            panel.style.display = '';
            panel.classList.add('show', 'write-note-active');
            panel.classList.remove('write-note-hidden', 'material-active', 'notepad-dir-browse-active');
            _clearWriteNoteArticleDirty();
            S._writeNoteMode = true;
            var dirItem = document.querySelector('#notepadDirMenu .paDropdownItem:first-child');
            if (dirItem) { dirItem.click(); }
            setTimeout(function() {
                _setNotepadAutoFormatEnabled(true, true);
                notepadNotebookStyles[currentNotepadTab] = true;
                _applyNotepadNotebookStyle();
                _saveNotepadToCache();
                var settingsBtn = document.getElementById('notepadSettingsBtn');
                if (settingsBtn && !settingsBtn.classList.contains('active')) {
                    toggleNotepadToolbars();
                }
                var tabs = document.getElementById('notepadDragHandle');
                if (tabs) tabs.style.display = 'none';
                var editor = document.getElementById('notepadEditor');
                if (editor) { editor.style.minHeight = '60vh'; }
                var omc = document.getElementById('notepadOutlineModalContent');
                _layoutWriteNoteByWorkRects();
                _setupWriteNoteDivider();
                showToast('已进入记文稿模式');
            }, 50);
        }
        function _exitWriteNoteMode() {
            if (!_writeNoteMode) return;
            S._writeNoteMode = false;
            _notepadDisplayMode = null;
            var panel = document.getElementById('notepadPanel');
            if (panel) {
                var btn = document.getElementById('notepadDisplayBtn');
                if (btn) btn.classList.remove('displayModeActive');
                var tabs = document.getElementById('notepadDragHandle');
                if (tabs) tabs.style.display = '';
                var editor = document.getElementById('notepadEditor');
                if (editor) { editor.style.minHeight = ''; }
                if (_notepadInitialBounds) {
                    panel.style.top = _notepadInitialBounds.top;
                    panel.style.left = _notepadInitialBounds.left;
                    panel.style.width = _notepadInitialBounds.width;
                    panel.style.height = _notepadInitialBounds.height;
                    panel.style.bottom = _notepadInitialBounds.bottom || '';
                }
                menu = document.getElementById('notepadDisplayMenu');
                if (menu) {
                    var items = menu.querySelectorAll('.paDropdownItem');
                    for (var i = 0; i < items.length; i++) items[i].classList.remove('paDropdownItemActive');
                    var hlItem = document.getElementById('notepadDisplayHlItem');
                    if (hlItem) { hlItem.textContent = '只显示高亮'; hlItem.setAttribute('data-dmode', 'highlight'); }
                }
                var editorEl = document.getElementById('notepadEditor');
                if (editorEl) {
                    var ps = editorEl.querySelectorAll('p');
                    for (var i = 0; i < ps.length; i++) ps[i].style.display = '';
                }
                var settingsBtn = document.getElementById('notepadSettingsBtn');
                if (settingsBtn && settingsBtn.classList.contains('active')) {
                    toggleNotepadToolbars();
                }
            }
            _removeWriteNoteDivider();
            S._notepadWorkHidden = false;
            if (panel) panel.classList.remove('write-note-active', 'write-note-hidden', 'material-active', 'notepad-dir-browse-active');
            _clearWriteNoteArticleDirty();
        }
        function _restoreFromWriteNote() {
            if (_writeNoteMode) {
                _exitWriteNoteMode();
            }
        }
        _materialSplitRatio = 0.2;
        _materialFullscreen = false;

        function _layoutWriteNoteByWorkRects() {
            var panel = document.getElementById('notepadPanel');
            var omc = document.getElementById('notepadOutlineModalContent');
            var divider = document.getElementById('mainSplitDivider');
            if (!panel || !omc) return;
            panel.classList.add('materialDividerHidden');
            if (divider) divider.classList.add('materialDividerHidden');
            var wrCss = _npWorkRects();
            var wrScreen = _npWorkScreenRects();
            _npSetScreenBox(omc, wrScreen.left);
            _npSetBox(panel, wrCss.right);
            panel.style.right = 'auto';
            updateNotepadSearchWidth();
        }

        function _setupWriteNoteDivider() {
            var panel = document.getElementById('notepadPanel');
            var omc = document.getElementById('notepadOutlineModalContent');
            var divider = document.getElementById('mainSplitDivider');
            if (!panel || !omc) return;
            panel.classList.add('materialDividerHidden');
            if (divider) divider.classList.add('materialDividerHidden');

            var outlineRR = omc.querySelector('.notepadOutlineResizeRight');
            if (outlineRR) outlineRR.style.display = '';
            var outlineRH = omc.querySelector('.notepadOutlineResizeHandle');
            if (outlineRH) outlineRH.style.display = '';
            var outlineRB = omc.querySelector('.notepadOutlineResizeBottom');
            if (outlineRB) outlineRB.style.display = '';

            var npHandles = ['npResizeHandle', 'npResizeHandleTop', 'npResizeHandleBottom', 'npResizeHandleLeft'];
            npHandles.forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.style.display = '';
            });

            if (outlineRR && !outlineRR._npresizeBound) {
                outlineRR._npresizeBound = true;
                outlineRR.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    var startX = e.clientX;
                    var z = _npMainZoom();
                    var omcRect = _npCssRect(omc);
                    var omcStartW = omcRect.width;

                    function onMove(ev) {
                        var dx = (ev.clientX - startX) / z;
                        var wr = _npWorkRects();
                        var maxW = Math.max(150, wr.right.right - omcRect.left - 280);
                        var newOmcW = Math.min(maxW, omcStartW + dx);
                        omc.style.left = omcRect.left + 'px';
                        omc.style.width = newOmcW + 'px';
                        _npSyncOutlinePanel(omc, panel);
                    }

                    function onUp() {
                        document.removeEventListener('mousemove', onMove);
                        document.removeEventListener('mouseup', onUp);
                        updateNotepadSearchWidth();
                    }

                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                });
            }

            // Link outline modal move to panel (dragging the outline modal body)
            var origOmcMove = omc._writeNoteMoveHandler;
            if (origOmcMove) omc.removeEventListener('mousedown', origOmcMove);

            var omcDownHandler = function(e) {
                if (e.button !== 0) return;
                if (e.target.closest('button') || e.target.closest('li') || e.target.closest('.notepadOutlineDirItem')) return;
                if (e.target.closest('.notepadOutlineResizeRight') || e.target.closest('.notepadOutlineResizeHandle') || e.target.closest('.notepadOutlineResizeBottom')) return;
                e.preventDefault();
                var z2 = _npMainZoom();
                var omcRect2 = _npCssRect(omc);
                var panelRect2 = _npCssRect(panel);
                var startX2 = e.clientX, startY2 = e.clientY;
                var startLeft2 = omcRect2.left, startTop2 = omcRect2.top;
                var startOmcW2 = omcRect2.width;
                var startPanelW2 = panelRect2.width;

                function onMove2(ev) {
                    var dx2 = (ev.clientX - startX2) / z2;
                    var dy2 = (ev.clientY - startY2) / z2;
                    var newLeft = startLeft2 + dx2;
                    var newTop = startTop2 + dy2;
                    omc.style.left = newLeft + 'px';
                    omc.style.top = newTop + 'px';
                    panel.style.left = (newLeft + startOmcW2) + 'px';
                    panel.style.top = newTop + 'px';
                    panel.style.width = startPanelW2 + 'px';
                }

                function onUp2() {
                    document.removeEventListener('mousemove', onMove2);
                    document.removeEventListener('mouseup', onUp2);
                    _syncWriteNoteHeights();
                }

                document.addEventListener('mousemove', onMove2);
                document.addEventListener('mouseup', onUp2);
            };
            omc._writeNoteMoveHandler = omcDownHandler;
            omc.addEventListener('mousedown', omcDownHandler);

            // Link panel move to outline modal (drag panel by its body)
            var panelHandle = document.getElementById('notepadDragHandle');
            if (panelHandle) {
                var panelDownHandler = function(e) {
                    if (e.button !== 0) return;
                    if (e.target.closest('.notepadTabsRight') || e.target.closest('#notepadTabCtxMenu')) return;
                    if (e.target.closest('input') || e.target.closest('button')) return;
                    e.preventDefault();
                    var z3 = _npMainZoom();
                    var omcRect3 = _npCssRect(omc);
                    var panelRect3 = _npCssRect(panel);
                    var startX3 = e.clientX, startY3 = e.clientY;
                    var startPanelLeft3 = panelRect3.left;
                    var startTop3 = panelRect3.top;
                    var startOmcW3 = omcRect3.width;

                    function onMove3(ev) {
                        var dx3 = (ev.clientX - startX3) / z3;
                        var dy3 = (ev.clientY - startY3) / z3;
                        var newPanelLeft = startPanelLeft3 + dx3;
                        var newTop = startTop3 + dy3;
                        panel.style.left = newPanelLeft + 'px';
                        panel.style.top = newTop + 'px';
                        omc.style.left = (newPanelLeft - startOmcW3) + 'px';
                        omc.style.top = newTop + 'px';
                    }

                    function onUp3() {
                        document.removeEventListener('mousemove', onMove3);
                        document.removeEventListener('mouseup', onUp3);
                        _syncWriteNoteHeights();
                    }

                    document.addEventListener('mousemove', onMove3);
                    document.addEventListener('mouseup', onUp3);
                };
                panelHandle._writeNoteMoveHandler = panelDownHandler;
                panelHandle.addEventListener('mousedown', panelDownHandler);
            }
        }

        function _removeWriteNoteDivider() {
            var omc = document.getElementById('notepadOutlineModalContent');
            var panel = document.getElementById('notepadPanel');
            var divider = document.getElementById('mainSplitDivider');
            if (panel) panel.classList.remove('materialDividerHidden');
            if (divider) divider.classList.remove('materialDividerHidden');
            if (omc) {
                var outlineRR = omc.querySelector('.notepadOutlineResizeRight');
                if (outlineRR) outlineRR.style.display = '';
                var outlineRH = omc.querySelector('.notepadOutlineResizeHandle');
                if (outlineRH) outlineRH.style.display = '';
                var outlineRB = omc.querySelector('.notepadOutlineResizeBottom');
                if (outlineRB) outlineRB.style.display = '';

                // Show panel resize handles again
                var npHandles2 = ['npResizeHandle', 'npResizeHandleTop', 'npResizeHandleBottom', 'npResizeHandleLeft'];
                npHandles2.forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el) el.style.display = '';
                });

                if (omc._writeNoteMoveHandler) {
                    omc.removeEventListener('mousedown', omc._writeNoteMoveHandler);
                    omc._writeNoteMoveHandler = null;
                }
            }
            var panelHandle = document.getElementById('notepadDragHandle');
            if (panelHandle && panelHandle._writeNoteMoveHandler) {
                panelHandle.removeEventListener('mousedown', panelHandle._writeNoteMoveHandler);
                panelHandle._writeNoteMoveHandler = null;
            }
        }

        function _syncWriteNoteHeights() {
            if (!_writeNoteMode) return;
            var panel = document.getElementById('notepadPanel');
            var omc = document.getElementById('notepadOutlineModalContent');
            if (!panel || !omc) return;
            var panelH = panel.getBoundingClientRect().height;
            var panelTop = panel.getBoundingClientRect().top;
            var omcH = omc.getBoundingClientRect().height;
            var omcTop = omc.getBoundingClientRect().top;
            if (Math.abs(panelH - omcH) > 2 || Math.abs(panelTop - omcTop) > 2) {
                var maxH = Math.max(panelH, omcH);
                var minTop = Math.min(panelTop, omcTop);
                panel.style.height = maxH + 'px';
                panel.style.top = minTop + 'px';
                omc.style.height = maxH + 'px';
                omc.style.top = minTop + 'px';
            }
        }
        function applyNotepadZoom() {
            var editor = document.getElementById('notepadEditor');
            if (editor) {
                editor.style.zoom = notepadZoomLevels[currentNotepadTab];
            }
        }
        function notepadOutlineZoomIn() {
            _notepadOutlineZoom = Math.min(_notepadOutlineZoom + 0.1, 2);
            applyNotepadOutlineZoom();
            showToast('提纲缩放: ' + Math.round(_notepadOutlineZoom * 100) + '%');
        }
        function notepadOutlineZoomOut() {
            _notepadOutlineZoom = Math.max(_notepadOutlineZoom - 0.1, 0.5);
            applyNotepadOutlineZoom();
            showToast('提纲缩放: ' + Math.round(_notepadOutlineZoom * 100) + '%');
        }
        function applyNotepadOutlineZoom() {
            var dirTab = document.getElementById('notepadOutlineDirTab');
            var structTab = document.getElementById('notepadOutlineStructTab');
            var z = _notepadOutlineZoom;
            if (dirTab) dirTab.style.zoom = z;
            if (structTab) structTab.style.zoom = z;
        }
        var editModalFontSize = parseInt(DataLayer.getRaw('editModalFontSize')) || 20;
        if ([16,18,20,22,24].indexOf(editModalFontSize) < 0) editModalFontSize = 20;
        function applyEditModalFontSize(fontSize) {
            editModalFontSize = fontSize;
            DataLayer.setRaw('editModalFontSize', fontSize);
            var ids = ['editContent', 'editRemark'];
            for (var i = 0; i < ids.length; i++) {
                var el = document.getElementById(ids[i]);
                if (el) el.style.fontSize = fontSize + 'px';
            }
            var weekBodies = document.querySelectorAll('.editWeekPopupBody');
            for (var w = 0; w < weekBodies.length; w++) {
                weekBodies[w].style.fontSize = fontSize + 'px';
            }
            var row = document.getElementById('editModalFontRow');
            if (row) {
                var spans = row.querySelectorAll('span');
                for (var j = 0; j < spans.length; j++) {
                    var fs = parseInt(spans[j].getAttribute('data-fs'), 10);
                    spans[j].style.color = (fs === fontSize) ? '#000' : '#999';
                    spans[j].style.fontWeight = (fs === fontSize) ? 'bold' : 'normal';
                }
            }
        }
        var subItemStatusFontSize = parseInt(DataLayer.getRaw('subItemStatusFontSize')) || 24;
        if ([20,22,24,26,28].indexOf(subItemStatusFontSize) < 0) subItemStatusFontSize = 24;
        function applySubItemStatusFontSize(fontSize) {
            subItemStatusFontSize = fontSize;
            DataLayer.setRaw('subItemStatusFontSize', fontSize);
            var items = document.querySelectorAll('#subItemStatusBody .subStatusItem');
            for (var i = 0; i < items.length; i++) {
                items[i].style.fontSize = fontSize + 'px';
            }
            var row = document.getElementById('subItemStatusFontRow');
            if (row) {
                var spans = row.querySelectorAll('span');
                for (var j = 0; j < spans.length; j++) {
                    var fs = parseInt(spans[j].getAttribute('data-fs'), 10);
                    spans[j].style.color = (fs === fontSize) ? '#000' : '#999';
                    spans[j].style.fontWeight = (fs === fontSize) ? 'bold' : 'normal';
                }
            }
        }
        function changeNotepadFontSize(delta) {
            var sel = window.getSelection();
            if (!sel.rangeCount || !sel.anchorNode) {
                showToast('请选择要改变字号的文字');
                return;
            }
            var range = sel.getRangeAt(0);
            if (range.collapsed) {
                showToast('请选择要改变字号的文字');
                return;
            }
            var curSize = 14;
            var parentEl = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
            if (parentEl) {
                var parentSize = window.getComputedStyle(parentEl).fontSize;
                if (parentSize) curSize = parseInt(parentSize) || 14;
            }
            var newSize;
            if (delta === 1) {
                newSize = Math.min(72, curSize + 1);
            } else {
                newSize = Math.max(8, curSize - 1);
            }
            var contents = range.extractContents();
            var wrapper = document.createElement('span');
            wrapper.style.fontSize = newSize + 'px';
            wrapper.appendChild(contents);
            range.insertNode(wrapper);
            sel.removeAllRanges();
            var newRange = document.createRange();
            newRange.selectNodeContents(wrapper);
            sel.addRange(newRange);
        }
        function applyFont(fontFamily) {
            var info = _npGetEditorSelectionRange();
            if (!info) return;
            var map = {SimHei:'黑体', KaiTi:'楷体_GB2312', FangSong:'仿宋_GB2312', FZXiaoBiaoSong:'方正小标宋简体'};
            var fname = map[fontFamily] || fontFamily;
            _npApplyUnifiedFormat(info.range, info.sel, info.editor, 'fontFamily', fname, null, 'span');
        }
        function toggleBold() {
            var info = _npGetEditorSelectionRange();
            if (!info) return;
            _npApplyUnifiedFormat(info.range, info.sel, info.editor, 'fontWeight', 'bold', ['B','STRONG'], 'b');
            var boldBtn = document.getElementById('boldBtn');
            if (boldBtn) boldBtn.classList.add('active');
            info.sel.removeAllRanges();
        }
        function applyFontSizeSelect(value) {
            if (!value) return;
            var info = _npGetEditorSelectionRange();
            if (!info) { showToast('请先选择要改变字号的文字'); return; }
            _npApplyUnifiedFormat(info.range, info.sel, info.editor, 'fontSize', value + 'px', ['FONT'], 'span');
            info.sel.removeAllRanges();
            _npSetLastFormat('字号 ' + value, function () { applyFontSizeSelect(value); });
        }
function extractFirstSentence(txt) { for (var i = 0; i < txt.length; i++) { var ch = txt.charAt(i); if (ch === '。' || ch === '！' || ch === '；' || ch === '．') { return { sentence: txt.substring(0, i + 1), rest: txt.substring(i + 1) }; } } return { sentence: txt, rest: '' }; }
function extractFirstSentenceL3(txt) { for (var i = 0; i < txt.length; i++) { var ch = txt.charAt(i); if (ch === '。' || ch === '！' || ch === '；') { return { sentence: txt.substring(0, i + 1), rest: txt.substring(i + 1) }; } } return { sentence: txt, rest: '' }; }
        /* 句中「一是/一要/一抓……」的分段规则：
           1. 标题只到第一个句号/分号/感叹号；
           2. 标题内若先出现逗号/顿号，说明「一是讲政治，……」只是列举提示，
              此时只把「一是」标成层级标题，后面全部回正文。 */
        function _npSplitCnHeadingText(txt) {
            var lead = (String(txt).match(/^\s*/) || [''])[0].length;
            var s = String(txt).substring(lead);
            var mm = s.match(/^([一二三四五六七八九十]+)[是要看抓查学紧盯聚焦]/);
            if (!mm) return extractFirstSentence(txt);
            var end = -1;
            for (var i = 0; i < s.length; i++) {
                var ch = s.charAt(i);
                if (ch === '。' || ch === '！' || ch === '；') { end = i; break; }
            }
            if (end < 0) return { sentence: txt, rest: '' };
            var sentence = s.substring(0, end + 1);
            var rest = s.substring(end + 1);
            var comma = sentence.search(/[，,、]/);
            var markerLen = mm[0].length;
            if (comma >= markerLen) {
                return { sentence: txt.substring(0, lead + markerLen), rest: s.substring(markerLen) };
            }
            return { sentence: txt.substring(0, lead + end + 1), rest: rest };
        }
        window._npSplitCnHeadingText = _npSplitCnHeadingText;
        function countMiddleNonPeriodPunct(sentence) { var endIdx = sentence.length; while (endIdx > 0 && '。！；'.indexOf(sentence.charAt(endIdx - 1)) !== -1) endIdx--; var puncts = '，、：？…,:?'; var count = 0; for (var i = 0; i < endIdx; i++) { if (puncts.indexOf(sentence.charAt(i)) !== -1) count++; } return count; }
        function styleYiShi(txt, levelCtx) {
            var pattern = /([一二三四五六七八九十])(是|要|看|抓|查|学)/g;
            var result = '';
            var lastIdx = 0;
            var m;
            pattern.lastIndex = 0;
            while ((m = pattern.exec(txt)) !== null) {
                var startPos = m.index;
                var endPos = startPos + m[0].length;
                var valid = false;
                if (startPos === 0) {
                    valid = true;
                } else {
                    var p = startPos - 1;
                    while (p >= 0 && /\s/.test(txt.charAt(p))) p--;
                    if (p < 0) valid = true;
                    else if ('。；：！…'.indexOf(txt.charAt(p)) !== -1) valid = true;
                }
                if (valid) {
                    result += escapeHtml(txt.substring(lastIdx, startPos));
                    var marker = m[0];
                    if (levelCtx === 1) {
                        result += '<span style="font-family:楷体_GB2312,楷体,KaiTi,serif;">' + escapeHtml(marker) + '</span>';
                    } else {
                        result += '<b>' + escapeHtml(marker) + '</b>';
                    }
                    lastIdx = endPos;
                }
            }
            result += escapeHtml(txt.substring(lastIdx));
            return result;
        }
        function _notepadIsBlockTagName(tag) {
            return (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'li' || tag === 'blockquote' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6' || tag === 'pre');
        }
        function isBlankText(t) { return /^[\s\xa0]*$/.test(t); }
        function _notepadCollectLinesWithGaps(root) {
            var items = [];
            var buf = '';
            var lineOpen = false;
            var curBlockEl = null;
            var curBlockManual = false;
            function endsWithBlank() { return items.length > 0 && items[items.length - 1].blank; }
            function commitLine() {
                var trimmed = buf.replace(/^[\s\xa0]+|[\s\xa0]+$/g, '');
                if (trimmed.length === 0) {
                    if (items.length > 0 && !endsWithBlank()) items.push({ text: '', blank: true });
                } else {
                    items.push({ text: buf, blank: false, manual: curBlockManual, el: curBlockEl });
                }
                buf = '';
                lineOpen = false;
            }
            function walk(node) {
                if (node.nodeType === 3) {
                    var txt = node.nodeValue || '';
                    if (!txt) return;
                    if (isBlankText(txt)) {
                        var prev = node.previousSibling, next = node.nextSibling;
                        var prevBlock = prev && prev.nodeType === 1 && _notepadIsBlockTagName((prev.tagName || '').toLowerCase());
                        var nextBlock = next && next.nodeType === 1 && _notepadIsBlockTagName((next.tagName || '').toLowerCase());
                        if (prevBlock || nextBlock) return;
                    }
                    var segs = txt.split('\n');
                    for (var s = 0; s < segs.length; s++) {
                        if (s > 0) commitLine();
                        buf += segs[s];
                        if (segs[s].length > 0) lineOpen = true;
                    }
                    return;
                }
                if (node.nodeType !== 1) return;
                var tag = (node.tagName || '').toLowerCase();
                if (tag === 'br') { commitLine(); return; }
                var isBlock = _notepadIsBlockTagName(tag);
                if (isBlock) {
                    if (lineOpen || buf.length > 0) commitLine();
                    lineOpen = true;
                    curBlockEl = node;
                    curBlockManual = (node.getAttribute && node.getAttribute('data-manual') === '1') || !!(node.querySelector && node.querySelector('[data-manual="1"]'));
                }
                for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
                if (isBlock) { commitLine(); curBlockEl = null; curBlockManual = false; }
            }
            for (var ci = 0; ci < root.childNodes.length; ci++) walk(root.childNodes[ci]);
            if (buf.length > 0 || lineOpen) commitLine();
            while (items.length > 0 && items[items.length - 1].blank) items.pop();
            while (items.length > 0 && items[0].blank) items.shift();
            return items;
        }
        function _notepadMatchHK(tr) {
            if (tr.match(/^(第[一二三四五六七八九十]+)[，,]/)) return 'cn-di';
            if (tr.match(/^([一二三四五六七八九十]+)、/)) return 'cn-dun';
            if (tr.match(/^（[一二三四五六七八九十]+）/) || tr.match(/^\([一二三四五六七八九十]+\)/)) return 'cn-paren';
            if (tr.match(/^[一二三四五六七八九十]+[是要看抓查学紧盯聚焦]/)) return 'cn-verb';
            if (tr.match(/^(\d+)[.、．]/)) return 'num-dun';
            return null;
        }
        var _npFmt_CN_NUM = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];
        var _npFmt_CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
        function _npFmt_detectSeqStyle(text) {
            if (!text) return null;
            var s = text.replace(/^\s+/, '');
            for (var i = 0; i < _npFmt_CN_NUM.length; i++) {
                if (s.indexOf(_npFmt_CN_NUM[i] + '、') === 0) return { kind: 'cn-dun', idx: i };
            }
            var fullBracket = s.match(/^（([一二三四五六七八九十]+)）/);
            if (fullBracket) { var idx1 = _npFmt_CN_NUM.indexOf(fullBracket[1]); if (idx1 >= 0) return { kind: 'cn-fullbracket', idx: idx1 }; }
            var halfBracket = s.match(/^\(([一二三四五六七八九十]+)\)/);
            if (halfBracket) { var idx2 = _npFmt_CN_NUM.indexOf(halfBracket[1]); if (idx2 >= 0) return { kind: 'cn-halfbracket', idx: idx2 }; }
            var digDot = s.match(/^(\d+)\./);
            if (digDot) return { kind: 'dig-num', idx: parseInt(digDot[1], 10) - 1 };
            var digDun = s.match(/^(\d+)、/);
            if (digDun) return { kind: 'dig-num', idx: parseInt(digDun[1], 10) - 1 };
            if (s.length > 0) { var circIdx = _npFmt_CIRCLED.indexOf(s.charAt(0)); if (circIdx >= 0) return { kind: 'circled', idx: circIdx }; }
            for (var j = 0; j < _npFmt_CN_NUM.length; j++) {
                if (s.indexOf(_npFmt_CN_NUM[j] + '是') === 0) return { kind: 'cn-shi', idx: j };
                if (s.indexOf(_npFmt_CN_NUM[j] + '要') === 0) return { kind: 'cn-yao', idx: j };
            }
            var diRest = s.match(/^第([一二三四五六七八九十]+)/);
            if (diRest) {
                var numStr = diRest[1];
                var idxD = _npFmt_CN_NUM.indexOf(numStr);
                if (idxD < 0) return null;
                var after = s.substring(1 + numStr.length);
                if (/^[，,。.]/.test(after)) return { kind: 'di-plain', idx: idxD };
                var m = after.match(/^(.)[，,。.\s]/);
                if (m) return { kind: 'di-char', idx: idxD, suffixChar: m[1] };
                return null;
            }
            return null;
        }
        function _npFmt_decideHeadingCtx(kind, hk, text, trimmed, state) {
            state = state || {};
            var parentHeadingLevel = state.parentHeadingLevel || 0;
            var lastL2Seq = state.lastL2Seq || null;
            var lastL3Seq = state.lastL3Seq || null;
            var lastVerbSeq = state.lastVerbSeq || null;
            var lastVerbLevel = state.lastVerbLevel || 0;
            if (kind === 'L1') {
                state.parentHeadingLevel = 1;
                state.lastHeadingLevel = 1;
                state.lastL3Seq = null;
                state.lastVerbSeq = null;
                state.lastVerbLevel = 0;
                return 'level-1';
            }
            if (kind === 'L2') {
                state.parentHeadingLevel = 2;
                state.lastHeadingLevel = 2;
                state.lastL3Seq = null;
                state.lastVerbSeq = null;
                state.lastVerbLevel = 0;
                return 'level-2';
            }
            if (kind === 'L3') {
                state.lastHeadingLevel = 3;
                state.lastL3Seq = _npFmt_detectSeqStyle(trimmed) || lastL3Seq;
                state.lastVerbSeq = null;
                state.lastVerbLevel = 0;
                return 'level-3';
            }
            if (kind === 'heading_ctx') {
                var curSeq = null;
                if (hk === 'cn-verb' || hk === 'num-dun' || hk === 'cn-di') {
                    curSeq = _npFmt_detectSeqStyle(trimmed);
                }
                if (!curSeq) {
                    state.lastHeadingLevel = 4;
                    state.lastVerbSeq = null;
                    state.lastVerbLevel = 0;
                    return 'level-body';
                }
                if (hk === 'cn-verb') {
                    var isVerbCont = lastVerbSeq && lastVerbLevel && curSeq.kind === lastVerbSeq.kind && curSeq.idx === lastVerbSeq.idx + 1;
                    if (isVerbCont) {
                        state.lastHeadingLevel = lastVerbLevel;
                        state.parentHeadingLevel = lastVerbLevel;
                        state.lastVerbSeq = curSeq;
                        return 'level-' + lastVerbLevel;
                    }
                    var verbLevel = parentHeadingLevel <= 0 ? 1 : (parentHeadingLevel === 1 ? 2 : Math.min(3, parentHeadingLevel + 1));
                    state.lastHeadingLevel = verbLevel;
                    state.parentHeadingLevel = verbLevel;
                    state.lastVerbSeq = curSeq;
                    state.lastVerbLevel = verbLevel;
                    state.lastL2Seq = verbLevel === 2 ? curSeq : lastL2Seq;
                    state.lastL3Seq = verbLevel === 3 ? curSeq : null;
                    return 'level-' + verbLevel;
                }
                state.lastVerbSeq = null;
                state.lastVerbLevel = 0;
                if (parentHeadingLevel <= 1) {
                    state.lastHeadingLevel = 2;
                    state.parentHeadingLevel = 2;
                    state.lastL3Seq = null;
                    state.lastL2Seq = curSeq;
                    return 'level-2';
                }
                var isL2cont = lastL2Seq && curSeq.kind === lastL2Seq.kind && curSeq.idx === lastL2Seq.idx + 1;
                if (isL2cont) {
                    state.lastHeadingLevel = 2;
                    state.parentHeadingLevel = 2;
                    state.lastL3Seq = null;
                    state.lastL2Seq = curSeq;
                    return 'level-2';
                }
                var isL3cont = lastL3Seq && curSeq.kind === lastL3Seq.kind && curSeq.idx === lastL3Seq.idx + 1;
                if (isL3cont) {
                    state.lastHeadingLevel = 3;
                    state.lastL3Seq = curSeq;
                    return 'level-3';
                }
                if (curSeq.idx > 0) {
                    state.lastHeadingLevel = 4;
                    return 'level-body';
                }
                state.lastHeadingLevel = 3;
                state.lastL3Seq = curSeq;
                return 'level-3';
            }
            return 'level-body';
        }
        // 主送单位段落内不能出现逗号；有逗号的段落按正文处理
        function _npRecipientTextHasComma(text) {
            return /[，,]/.test(String(text == null ? '' : text));
        }
        // 主送单位段落样式（顶格、楷体、左对齐）
        function _npRecipientParaStyle() {
            var c = (window.FORMAT_STANDARD && FORMAT_STANDARD.levels && FORMAT_STANDARD.levels['level-recipient']) || null;
            if (!c) return 'margin:0;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:left;text-indent:0;';
            return FORMAT_STANDARD.paraStyle('level-recipient') + FORMAT_STANDARD.inlineStyle('level-recipient');
        }
        // 后置识别主送单位：文章标题后第一个非空正文段若以「：」结尾，则标记为主送单位
        function _npApplyRecipientFormat(html) {
            if (!html || html.indexOf('<p') === -1) return html;
            var temp = document.createElement('div');
            temp.innerHTML = html;
            var ps = temp.querySelectorAll('p');
            var changed = false;
            for (var i = 0; i < ps.length; i++) {
                var p = ps[i];
                var isTitle = p.getAttribute('data-level') === 'title' ||
                    (p.getAttribute('data-outline-level') === '1' && p.getAttribute('data-level') !== 'date' && p.getAttribute('data-level') !== 'author');
                if (!isTitle) continue;
                for (var j = i + 1; j < ps.length; j++) {
                    var np = ps[j];
                    var nText = (np.textContent || '').replace(/\u00a0/g, ' ').replace(/^\s+|\s+$/g, '');
                    if (!nText) continue;
                    var nLevel = np.getAttribute('data-level') || '';
                    if (np.getAttribute('data-outline-level') === '1') break;
                    if (nLevel === 'date' || nLevel === 'author' || nLevel === 'secret' || nLevel === 'attachment') continue;
                    var inner = (np.textContent || '').replace(/^\s+|\s+$/g, '');
                    if (nLevel === 'recipient') {
                        if (_npRecipientTextHasComma(nText)) {
                            np.removeAttribute('data-level');
                            np.removeAttribute('data-outline-level');
                            np.setAttribute('style', FORMAT_STANDARD.fullStyle('level-body'));
                            if (inner) np.innerHTML = '<span style="' + FORMAT_STANDARD.inlineStyle('level-body') + '">' + escapeHtml(inner) + '</span>';
                            changed = true;
                        }
                        break;
                    }
                    if (nText.length > 100) break;
                    if (!/[：:]\s*$/.test(nText)) break;
                    if (nText.indexOf('。') !== -1) break;
                    if (_npRecipientTextHasComma(nText)) break;
                    if (typeof _notepadMatchHK === 'function' && _notepadMatchHK(nText)) break;
                    if (/^\d+[.．、]/.test(nText) || /^[一二三四五六七八九十]+[、.]/.test(nText) || /^[（(]/.test(nText)) break;
                    if (/^(附件|主题词|抄送|印发|抄报)/.test(nText)) break;
                    np.setAttribute('data-level', 'recipient');
                    np.removeAttribute('data-outline-level');
                    np.setAttribute('style', _npRecipientParaStyle());
                    if (inner) np.innerHTML = '<span style="' + FORMAT_STANDARD.inlineStyle('level-recipient') + '">' + escapeHtml(inner) + '</span>';
                    changed = true;
                    break;
                }
            }
            return changed ? temp.innerHTML : html;
        }
        // 判断一行是否为“索引标题”（如 202610 关于××的通知、【2026】202610 关于××的通知）。
        // 索引标题有独立样式（楷体 16px、左对齐、顶格），绝不能被当成文章标题。
        function _npLooksLikeIndexLine(trimmed, el) {
            if (!trimmed) return false;
            // 纯日期行不是索引（交由日期/作者逻辑处理）
            var isPureDate = /^\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?$/.test(trimmed) ||
                /^\d{4}\s*[-.\/]\s*\d{1,2}\s*[-.\/]\s*\d{1,2}$/.test(trimmed) ||
                /^\d{6}$/.test(trimmed) || /^\d{8}$/.test(trimmed);
            if (isPureDate) return false;
            if (el && el.nodeType === 1) {
                // 已标记为文章标题的段落优先按文章标题处理
                if (el.getAttribute('data-level') === 'title') return false;
                // 已有大纲一级标记且不是文章标题 → 就是索引标题
                if (el.getAttribute('data-outline-level') === '1') return true;
                // 手动设置为小标宋居中的大标题，不当作索引
                if (_npManualLooksArticleTitle(el, trimmed)) return false;
            }
            if (/^【[^】]{1,40}】/.test(trimmed)) return true;
            if (trimmed.length > 60) return false;
            if ('，、；。！？…,;!?'.indexOf(trimmed.charAt(trimmed.length - 1)) !== -1) return false;
            // 6~8 位数字日期（202610 / 20261021），必须带分隔符再接标题文字
            if (/^\d{6,8}(?:\s+|\s*[、.．:：])[\u4e00-\u9fff《“（(]/.test(trimmed)) return true;
            // 年月形式必须带分隔符，避免把正文里的“2026年10月……”误判
            if (/^\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?(?:\s+|\s*[、.．:：])[\u4e00-\u9fff《“（(]/.test(trimmed)) return true;
            return false;
        }
        // 6~8 位数字日期开头的索引行（202610 关于×× / 20261021 关于××），与位置无关
        function _npLooksLikeNumericIndexLine(trimmed, el) {
            if (!trimmed || trimmed.length > 60) return false;
            if (el && el.nodeType === 1 && el.getAttribute('data-level') === 'title') return false;
            if ('，、；。！？…,;!?'.indexOf(trimmed.charAt(trimmed.length - 1)) !== -1) return false;
            return /^\d{6,8}(?:\s+|\s*[、.．:：])[\u4e00-\u9fff《“（(]/.test(trimmed);
        }
        // 日期行（（2026年10月21日）/ 2026年10月21日 / 2026-10-21），公文开头的日期不属于标题
        function _npIsDateLikeLine(t) {
            if (!t || t.length > 30) return false;
            if (/^[（(]\s*\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?\s*[）)]$/.test(t)) return true;
            if (/^\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?$/.test(t)) return true;
            if (/^\d{4}\s*[-.\/]\s*\d{1,2}\s*[-.\/]\s*\d{1,2}$/.test(t)) return true;
            return false;
        }
        // 在 items 第 i 行之后找“文章标题”行下标：跳过空行与日期行，遇到正文/主送/层级序号即放弃
        function _npFindArticleTitleAfter(items, i) {
            for (var k = i + 1; k < items.length; k++) {
                if (!items[k] || items[k].blank || items[k]._skip) continue;
                var t = (items[k].text || '').replace(/^\s+|\s+$/g, '');
                if (!t) continue;
                if (_npIsDateLikeLine(t)) continue;
                if (/[：:]\s*$/.test(t)) return -1;
                if (t.length > 60) return -1;
                if ('，、；。！？…,;:!?'.indexOf(t.charAt(t.length - 1)) !== -1) return -1;
                if (/^[一二三四五六七八九十]+[、.]/.test(t) || /^\d+[.、．]/.test(t)) return -1;
                if (/^【/.test(t)) return -1;
                return k;
            }
            return -1;
        }
        function _npNextLooksArticleTitle(items, i) {
            return _npFindArticleTitleAfter(items, i) >= 0;
        }
        // 索引标题统一段落样式（楷体 16px、左对齐、顶格），与“添加索引”生成的一致
        function _npIndexParaHtml(text) {
            return '<p data-outline-level="1" data-np-index="1" style="margin:0 0 0.5em;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:left;text-indent:0;color:#1a2a4a;">' + escapeHtml(text) + '</p>';
        }
        function _notepadCoreFormat(items, isBracketLine, dirEntries, ctxSkipped, ctxStartCount, explicitLevels, skipManual) {
            var lastHeadingLevel = 0;
            var parentHeadingLevel = 0;
            var lastL2Seq = null;
            var lastL3Seq = null;
            var lastVerbSeq = null;
            var lastVerbLevel = 0;
            var formattedParas = [];
            var afterStartPart = ctxSkipped || false;
            var startPartCount = ctxStartCount || 0;
            var awaitingArticleTitle = false;
            var attachmentTitlePending = false;
            var attachmentBlock = false;
            var attachmentCount = 0;
            var l1Count = 0;
            var lastCentered = false;
            var nonEmptyIndex = -1;
            var blankParaHtml = '<p style="margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;">&nbsp;</p>';
            var localEntries = dirEntries || [];
            var regulationMode = false;
            for (var rmi = 0; rmi < items.length; rmi++) {
                if (!items[rmi].blank && /^第[一二三四五六七八九十百千万亿○零〇]+条/.test((items[rmi].text || '').replace(/^\s+|\s+$/g, ''))) {
                    regulationMode = true;
                    break;
                }
            }
            // Pre-pass: detect heading candidates hierarchically
            var _autoL1Pattern = null;
            var _autoL2Pattern = null;
            var candidates = [];
            for (var ii = 0; ii < items.length; ii++) {
                var itx = items[ii];
                if (itx.blank) { candidates.push({ blank: true }); continue; }
                var tx = itx.text;
                var tr = tx.replace(/^\s+|\s+$/g, '');
                var kind = 'body';
                var hk = _notepadMatchHK(tr);
                if (hk === 'num-dun' || hk === 'cn-verb' || hk === 'cn-di') {
                    kind = 'heading_ctx';
                } else if (hk) {
                    if (!_autoL1Pattern) { _autoL1Pattern = hk; kind = 'L1'; _autoL2Pattern = null; }
                    else if (hk === _autoL1Pattern) { kind = 'L1'; _autoL2Pattern = null; }
                    else if (!_autoL2Pattern) { _autoL2Pattern = hk; kind = 'L2'; }
                    else if (hk === _autoL2Pattern) { kind = 'L2'; }
                    else { kind = 'body'; }
                }
                candidates.push({ blank: false, kind: kind, hk: hk });
            }
            // Second pass: detect unpunctuated paragraphs as auto-L1
            var noPunctCount = 0;
            var noPunctIdxs = [];
            for (var ii = 0; ii < items.length; ii++) {
                var cit = items[ii];
                if (cit.blank) continue;
                var ctr = cit.text.replace(/^\s+|\s+$/g, '');
                if (isBracketLine[ii]) continue;
                if (candidates[ii].kind !== 'body') continue;
                if (ctr.length > 50) continue;
                if ('，、；。：！？…'.indexOf(ctr.charAt(ctr.length - 1)) !== -1) continue;
                noPunctCount++;
                noPunctIdxs.push(ii);
            }
            if (noPunctCount >= 2) {
                for (var ni = 0; ni < noPunctIdxs.length; ni++) {
                    candidates[noPunctIdxs[ni]].kind = 'L1';
                }
            }
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                if (it._skip) { continue; }
                if (it.blank) {
                    if (afterStartPart) formattedParas.push(blankParaHtml);
                    continue;
                }
                nonEmptyIndex++;
                 var text = it.text.replace(/^\s+/, '');
                 var trimmed = text.replace(/^\s+|\s+$/g, '');
                 // Handle attachment markers before article/title detection so they are emitted once.
                 if (/^附件[：:]/.test(trimmed)) {
                     attachmentCount++;
                     attachmentBlock = true;
                     var earlyAttachmentKind = attachmentCount === 1 ? 'prefix' : 'item';
                     var earlyAttachmentStyle = earlyAttachmentKind === 'prefix'
                         ? 'font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:2em;line-height:1.8;margin:0;'
                          : 'font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:-1em;line-height:1.8;margin:0;margin-left:6em;';
                     formattedParas.push('<p data-level="attachment" data-attachment-style="' + earlyAttachmentKind + '" style="' + earlyAttachmentStyle + '">' + escapeHtml(text) + '</p>');
                     continue;
                 }
                 if (attachmentBlock && /^\d+[.．、]/.test(trimmed)) {
                      formattedParas.push('<p data-level="attachment" data-attachment-style="item" style="font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:-1em;line-height:1.8;margin:0;margin-left:6em;">' + escapeHtml(text) + '</p>');
                     continue;
                 }
                 attachmentBlock = false;
                 if (/^附件(?:\s*[：:]?\s*\d+)?$/.test(trimmed) && !/[，、；。：！？….,;:!?]$/.test(trimmed)) {
                     formattedParas.push('<p data-level="secret" style="' + FORMAT_STANDARD.fullStyle('level-secret') + '">' + escapeHtml(text) + '</p>');
                     afterStartPart = true;
                      startPartCount = 1;
                      awaitingArticleTitle = true;
                      attachmentTitlePending = true;
                      continue;
                  }
                  if (awaitingArticleTitle && !/[，、；。：！？….,;:!?]$/.test(trimmed)) {
                      if (!attachmentTitlePending) localEntries.push({ label: trimmed, articleText: trimmed });
                      formattedParas.push('<p' + (attachmentTitlePending ? '' : ' data-outline-level="1" data-level="title"') + ' style="' + FORMAT_STANDARD.fullStyle('level-title') + '">' + escapeHtml(text) + '</p>');
                      startPartCount = 1;
                      awaitingArticleTitle = false;
                      attachmentTitlePending = false;
                      lastCentered = true;
                      continue;
                 }
                  var startDateMatch = trimmed.match(/^(?:（\d{4}年\d{1,2}月\d{1,2}日）|\(\d{4}年\d{1,2}月\d{1,2}日\))$/);
                  if (!it.blank && !afterStartPart && startDateMatch && startPartCount >= 1 && startPartCount <= 2) {
                       formattedParas.push('<p data-level="date" style="margin:0;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:center;text-indent:0;">' + escapeHtml(text) + '</p>');
                     startPartCount = Math.max(startPartCount, 2);
                     continue;
                 }
                if (skipManual && it.el && _npHasManualSpan(it.el) && !_npIsWholeParaManual(it.el)) {
                    var _mmFinalKind = (candidates[i] && candidates[i].kind) || 'body';
                    if (explicitLevels && explicitLevels[i]) _mmFinalKind = explicitLevels[i];
                    var _mmParaStyle = FORMAT_STANDARD.fullStyle('level-body');
                    var _mmBodyInline = FORMAT_STANDARD.inlineStyle('level-body');
                    if (_mmFinalKind === 'L1') {
                        l1Count++; lastHeadingLevel = 1; parentHeadingLevel = 1; lastL3Seq = null;
                        _mmParaStyle = FORMAT_STANDARD.paraStyle('level-1');
                    } else if (_mmFinalKind === 'L2') {
                        lastHeadingLevel = 2; parentHeadingLevel = 2; lastL3Seq = null;
                        _mmParaStyle = FORMAT_STANDARD.paraStyle('level-2');
                    } else if (_mmFinalKind === 'L3') {
                        lastHeadingLevel = 3;
                        _mmParaStyle = FORMAT_STANDARD.paraStyle('level-3');
                    } else if (_mmFinalKind === 'heading_ctx') {
                        var _mmCtxState = { parentHeadingLevel: parentHeadingLevel, lastL2Seq: lastL2Seq, lastL3Seq: lastL3Seq, lastVerbSeq: lastVerbSeq, lastVerbLevel: lastVerbLevel };
                        var _mmDecLvl = _npFmt_decideHeadingCtx(_mmFinalKind, candidates[i].hk, text, trimmed, _mmCtxState);
                        parentHeadingLevel = _mmCtxState.parentHeadingLevel || parentHeadingLevel;
                        lastHeadingLevel = _mmCtxState.lastHeadingLevel || lastHeadingLevel;
                        lastL2Seq = _mmCtxState.lastL2Seq || null;
                        lastL3Seq = _mmCtxState.lastL3Seq || null;
                        lastVerbSeq = _mmCtxState.lastVerbSeq || null;
                        lastVerbLevel = _mmCtxState.lastVerbLevel || 0;
                        _mmParaStyle = FORMAT_STANDARD.paraStyle(_mmDecLvl);
                        _mmBodyInline = FORMAT_STANDARD.inlineStyle(_mmDecLvl);
                    }
                    var _mmHtml = _npMixedManualParaHtml(it.el, _mmParaStyle, _mmBodyInline);
                    if (afterStartPart || nonEmptyIndex > 1) {
                        formattedParas.push(_mmHtml);
                    } else {
                        afterStartPart = true;
                        formattedParas.push(_mmHtml);
                    }
                    continue;
                }
                if (skipManual && (it.manual || (it.el && it.el.getAttribute && it.el.getAttribute('data-manual') === '1'))) {
                    var _mk = (candidates[i] && candidates[i].hk) || null;
                    var _mkind = (candidates[i] && candidates[i].kind) || 'body';
                    if (_mkind === 'L1') {
                        lastHeadingLevel = 1; parentHeadingLevel = 1; lastL3Seq = null;
                    } else if (_mkind === 'L2') {
                        lastHeadingLevel = 2; parentHeadingLevel = 2; lastL3Seq = null;
                        var _mseq = _npFmt_detectSeqStyle(trimmed);
                        if (_mseq && (_mseq.kind === 'cn-shi' || _mseq.kind === 'cn-yao')) lastL2Seq = _mseq;
                    } else if (_mkind === 'L3') {
                        lastHeadingLevel = 3;
                        var _mseq3 = _npFmt_detectSeqStyle(trimmed);
                        if (_mseq3) lastL3Seq = _mseq3;
                    } else if (_mkind === 'heading_ctx') {
                        var _mctxState = { parentHeadingLevel: parentHeadingLevel, lastL2Seq: lastL2Seq, lastL3Seq: lastL3Seq, lastVerbSeq: lastVerbSeq, lastVerbLevel: lastVerbLevel };
                        _npFmt_decideHeadingCtx(_mkind, _mk, text, trimmed, _mctxState);
                        parentHeadingLevel = _mctxState.parentHeadingLevel || parentHeadingLevel;
                        lastHeadingLevel = _mctxState.lastHeadingLevel || lastHeadingLevel;
                        lastL2Seq = _mctxState.lastL2Seq || null;
                        lastL3Seq = _mctxState.lastL3Seq || null;
                        lastVerbSeq = _mctxState.lastVerbSeq || null;
                        lastVerbLevel = _mctxState.lastVerbLevel || 0;
                    }
                    var _manualHtml = _npManualSkipOuterHTML(it.el, text);
                    if (afterStartPart || nonEmptyIndex > 1) {
                        formattedParas.push(_manualHtml);
                    } else {
                        afterStartPart = true;
                        formattedParas.push(_manualHtml);
                    }
                    continue;
                }
                // 索引标题（202610 关于××的通知 / 【2026】202610 关于××的通知）必须保持索引样式，
                // 不能和文章标题（小标宋 20px 居中）混用。
                var _npIdxLine = !!isBracketLine[i];
                if (!_npIdxLine && it.el && typeof _npLooksLikeIndexPara === 'function' && _npLooksLikeIndexPara(it.el)) {
                    _npIdxLine = true;
                }
                // 文本形态识别：6~8 位数字日期开头的索引行（202610 / 20261021）在任何位置都识别；
                // 年月形式与【】形式只在文章开头识别，避免正文中段的年份表述被误判。
                var _npAtArticleStart = !afterStartPart || nonEmptyIndex < 3 || (i > 0 && items[i - 1].blank);
                if (!_npIdxLine && _npLooksLikeNumericIndexLine(trimmed) &&
                    ((it.el && typeof _npIsIndexTitlePara === 'function' && _npIsIndexTitlePara(it.el)) || _npFindArticleTitleAfter(items, i) >= 0)) {
                    _npIdxLine = true;
                }
                if (!_npIdxLine && _npAtArticleStart && _npLooksLikeIndexLine(trimmed, null)) {
                    _npIdxLine = true;
                }
                if (_npIdxLine) {
                    var bracketMatch = trimmed.match(/^【([^】]+)】/);
                    var dirLabel = bracketMatch ? trimmed.substring(bracketMatch[0].length).trim() : trimmed;
                    localEntries.push({ label: dirLabel, articleText: trimmed });
                    formattedParas.push(_npIndexParaHtml(text));
                    l1Count++;
                    startPartCount = 1;
                    afterStartPart = true;
                    lastCentered = false;
                    var _npTitleIdx = _npFindArticleTitleAfter(items, i);
                    // 索引之后可能先有日期行，再是文章标题；日期照旧输出，只有真正的标题段落设为文章标题样式
                    for (var sk = i + 1; sk < items.length; sk++) {
                        if (items[sk].blank || items[sk]._skip) continue;
                        var _skTxt = items[sk].text.replace(/^\s+|\s+$/g, '');
                        if (_npTitleIdx >= 0 && sk < _npTitleIdx) {
                            var _skLv = startPartCount === 1 ? 'date' : (startPartCount === 2 ? 'author' : '');
                            formattedParas.push('<p' + (_skLv ? ' data-level="' + _skLv + '"' : '') + ' style="margin:0;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:center;text-indent:0;">' + escapeHtml(items[sk].text) + '</p>');
                            startPartCount++;
                            items[sk]._skip = true;
                            continue;
                        }
                        if (sk === _npTitleIdx) {
                            formattedParas.push('<p data-level="title" style="' + FORMAT_STANDARD.fullStyle('level-title') + '">' + escapeHtml(_skTxt || items[sk].text) + '</p>');
                            items[sk]._skip = true;
                        }
                        break;
                    }
                    var subB = sk + 1;
                    while (subB < items.length && startPartCount < 3) {
                        if (items[subB].blank) { subB++; continue; }
                        var stB = items[subB].text.replace(/^\s+|\s+$/g, '');
                        if (stB.length <= 50 && '，、；。：！？…'.indexOf(stB.charAt(stB.length - 1)) === -1 && !stB.match(/^[一二三四五六七八九十]/) && !stB.match(/^\d+[.、．]/)) {
                            var lvB = startPartCount === 1 ? 'date' : (startPartCount === 2 ? 'author' : '');
                             formattedParas.push('<p' + (lvB ? ' data-level="' + lvB + '"' : '') + ' style="margin:0;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:center;text-indent:0;">' + escapeHtml(items[subB].text) + '</p>');
                            startPartCount++;
                            items[subB]._skip = true;
                            subB++;
                        } else break;
                    }
                    continue;
                }
                var bodyBase = 'margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:2em;';
                var paraBase = 'margin:0;line-height:1.8;font-size:16px;text-align:left;text-indent:2em;';
                if (!afterStartPart) {
                    var isStartPart = false;
                    if (!trimmed) {
                        isStartPart = true;
                    } else if ((trimmed.indexOf('★') !== -1 || /^×密/.test(trimmed) || /^x密/i.test(trimmed) || /^附件(?:\s*[：:]?\s*\d+)?$/.test(trimmed)) && trimmed.length <= 8 && nonEmptyIndex < 3) {
                        formattedParas.push('<p data-level="secret" style="' + FORMAT_STANDARD.fullStyle('level-secret') + '">' + escapeHtml(text) + '</p>');
                         startPartCount = 1; awaitingArticleTitle = true; attachmentTitlePending = true; isStartPart = true;
                    } else if (nonEmptyIndex < 4 && trimmed.length <= 50) {
                        var hasPunct = '，、；。：！？…'.indexOf(trimmed.charAt(trimmed.length - 1)) !== -1;
                        if (!hasPunct && l1Count === 0 && !trimmed.match(/^[一二三四五六七八九十]/) && !trimmed.match(/^\d+[.、．]/)) {
                            if (startPartCount === 0) {
                                localEntries.push({ label: trimmed, articleText: trimmed });
                                formattedParas.push('<p data-outline-level="1" style="margin:0;line-height:1.8;font-family:方正小标宋,FZXiaoBiaoSong,serif;font-size:20px;text-align:center;text-indent:0;"><span style="font-family:方正小标宋,FZXiaoBiaoSong,serif;font-size:20px;">' + escapeHtml(text) + '</span></p>');
                                startPartCount++; isStartPart = true; lastCentered = true;
                            } else if (startPartCount <= 2) {
                                if (awaitingArticleTitle) {
                                    if (!attachmentTitlePending) localEntries.push({ label: trimmed, articleText: trimmed });
                                    formattedParas.push('<p' + (attachmentTitlePending ? '' : ' data-outline-level="1" data-level="title"') + ' style="' + FORMAT_STANDARD.fullStyle('level-title') + '">' + escapeHtml(text) + '</p>');
                                    startPartCount = 1; awaitingArticleTitle = false; isStartPart = true; lastCentered = true;
                                    attachmentTitlePending = false;
                                    continue;
                                }
                                var levelAttr = startPartCount === 1 ? 'date' : (startPartCount === 2 ? 'author' : '');
                                 formattedParas.push('<p' + (levelAttr ? ' data-level="' + levelAttr + '"' : '') + ' style="margin:0;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:center;text-indent:0;">' + escapeHtml(text) + '</p>');
                                startPartCount++; isStartPart = true; lastCentered = true;
                            }
                        }
                    }
                    if (isStartPart) continue;
                    afterStartPart = true;
                    if (lastCentered) formattedParas.push(blankParaHtml);
                }
                if (afterStartPart && startPartCount > 0 && startPartCount < 3 && trimmed.length <= 50 && '，、；。：！？…'.indexOf(trimmed.charAt(trimmed.length - 1)) === -1 && !trimmed.match(/^[一二三四五六七八九十]/) && !trimmed.match(/^\d+[.、．]/)) {
                    if (awaitingArticleTitle) {
                        if (!attachmentTitlePending) localEntries.push({ label: trimmed, articleText: trimmed });
                        formattedParas.push('<p' + (attachmentTitlePending ? '' : ' data-outline-level="1" data-level="title"') + ' style="' + FORMAT_STANDARD.fullStyle('level-title') + '">' + escapeHtml(text) + '</p>');
                        startPartCount = 1; awaitingArticleTitle = false; lastCentered = true;
                        attachmentTitlePending = false;
                        continue;
                    }
                    var _lvRem = startPartCount === 1 ? 'date' : 'author';
                     var _lvRemColor = _lvRem === 'date' ? 'color:#0b3d91;' : '';
                             formattedParas.push('<p data-level="' + _lvRem + '" style="margin:0;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:center;text-indent:0;' + _lvRemColor + '">' + escapeHtml(text) + '</p>');
                    startPartCount++;
                    continue;
                }
                if (afterStartPart && i > 0 && items[i-1].blank && trimmed.length <= 50 && '，、；。：！？…'.indexOf(trimmed.charAt(trimmed.length - 1)) === -1) {
                    var _hk2 = _notepadMatchHK(trimmed);
                    if (!_hk2) {
                        var _nextNonBlank = -1;
                        for (var _nn = i + 1; _nn < items.length; _nn++) {
                            if (!items[_nn].blank && !items[_nn]._skip) { _nextNonBlank = _nn; break; }
                        }
                        var _isNewArticle = _nextNonBlank === -1;
                        if (!_isNewArticle) {
                            var _nt = items[_nextNonBlank].text.replace(/^\s+|\s+$/g, '');
                            if (_nt && _nt.length <= 50 && '，、；。：！？…'.indexOf(_nt.charAt(_nt.length - 1)) === -1 &&
                                !_nt.match(/^[一二三四五六七八九十]/) && !_nt.match(/^\d+[.、．]/)) {
                                _isNewArticle = true;
                            }
                        }
                        if (_isNewArticle) {
                            localEntries.push({ label: trimmed, articleText: trimmed });
                            formattedParas.push('<p data-outline-level="1" style="margin:0;line-height:1.8;font-family:方正小标宋,FZXiaoBiaoSong,serif;font-size:20px;text-align:center;text-indent:0;"><span style="font-family:方正小标宋,FZXiaoBiaoSong,serif;font-size:20px;">' + escapeHtml(text) + '</span></p>');
                            l1Count++;
                            startPartCount = 1;
                            lastCentered = true;
                            var _naIdx = i + 1;
                            while (_naIdx < items.length && startPartCount < 3) {
                                if (items[_naIdx].blank || items[_naIdx]._skip) { _naIdx++; continue; }
                                var _nt2 = items[_naIdx].text.replace(/^\s+|\s+$/g, '');
                                if (_nt2.length <= 50 && '，、；。：！？…'.indexOf(_nt2.charAt(_nt2.length - 1)) === -1 && !_nt2.match(/^[一二三四五六七八九十]/) && !_nt2.match(/^\d+[.、．]/)) {
                                    var _lv = startPartCount === 1 ? 'date' : (startPartCount === 2 ? 'author' : '');
                                     formattedParas.push('<p' + (_lv ? ' data-level="' + _lv + '"' : '') + ' style="margin:0;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:center;text-indent:0;">' + escapeHtml(items[_naIdx].text) + '</p>');
                                    startPartCount++;
                                    items[_naIdx]._skip = true;
                                    _naIdx++;
                                } else break;
                            }
                            continue;
                        }
                    }
                }
                if (/^附件[：:]/.test(trimmed)) {
                    attachmentCount++;
                    attachmentBlock = true;
                    var attachmentKind = attachmentCount === 1 ? 'prefix' : 'item';
                    var attachmentStyle = attachmentKind === 'prefix' ? 'font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:2em;line-height:1.8;margin:0;' : 'font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:-1em;line-height:1.8;margin:0;margin-left:6em;';
                    formattedParas.push('<p data-level="attachment" data-attachment-style="' + attachmentKind + '" style="' + attachmentStyle + '">' + escapeHtml(text) + '</p>');
                    continue;
                }
                if (attachmentBlock && /^\d+[.．、]/.test(trimmed)) {
                    formattedParas.push('<p data-level="attachment" data-attachment-style="item" style="font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:-1em;line-height:1.8;margin:0;margin-left:6em;">' + escapeHtml(text) + '</p>');
                    continue;
                }
                if (regulationMode && /^(?:（[一二三四五六七八九十百千万亿]+）|\([一二三四五六七八九十百千万亿]+\)|\d+[.、．])/.test(trimmed)) {
                    formattedParas.push('<p style="' + FORMAT_STANDARD.fullStyle('level-body') + '">' + _formatBodyMaybeRegulationClause(text) + '</p>');
                    continue;
                }
                var finalKind = (candidates[i] && candidates[i].kind) || 'body';
                if (explicitLevels && explicitLevels[i]) finalKind = explicitLevels[i];
                if (finalKind === 'L1') {
                    l1Count++;
                    lastHeadingLevel = 1;
                    parentHeadingLevel = 1;
                    lastL3Seq = null;
                    var split1 = extractFirstSentence(text);
                    var h1 = '<span style="' + FORMAT_STANDARD.inlineStyle('level-1') + '">' + escapeHtml(split1.sentence) + '</span>';
                    var r1 = _plainBodySpan(split1.rest, 'level-2');
                    formattedParas.push('<p data-outline-level="2" style="' + FORMAT_STANDARD.paraStyle('level-1') + '">' + h1 + r1 + '</p>');
                    continue;
                }
                if (finalKind === 'L2') {
                    var _l2Lvl = '2';
                    lastHeadingLevel = 2;
                    parentHeadingLevel = 2;
                    lastL3Seq = null;
                    var _npos2 = _findNumDunPositions(text);
                    var _cpos2 = _findCnShiPositions(text);
                    var _allPos2 = _npos2.concat(_cpos2).sort(function(a,b){return a-b;});
                    if (_allPos2.length >= 2) {
                        var _all2Html = '';
                        // 序号之前的前置文字（如“（一）强化政治引领……”）必须保留，
                        // 否则会被 substring 从第一个序号开始截断而整句丢失。
                        if (_allPos2[0] > 0) {
                            var _pre2 = text.substring(0, _allPos2[0]);
                            var _preSplit2 = extractFirstSentence(_pre2);
                            _all2Html += '<span style="' + FORMAT_STANDARD.inlineStyle('level-' + _l2Lvl) + '">' + escapeHtml(_preSplit2.sentence) + '</span>';
                            if (_preSplit2.rest) _all2Html += _plainBodySpan(_preSplit2.rest);
                        }
                        for (var _ni = 0; _ni < _allPos2.length; _ni++) {
                            var _ns2 = _allPos2[_ni], _ne2 = _ni + 1 < _allPos2.length ? _allPos2[_ni + 1] : text.length;
                            var _nt2 = text.substring(_ns2, _ne2);
                            var _nsplit2 = extractFirstSentence(_nt2);
                            var _nh2 = '<span style="' + FORMAT_STANDARD.inlineStyle('level-' + _l2Lvl) + '">' + escapeHtml(_nsplit2.sentence) + '</span>';
                            var _nr2 = _plainBodySpan(_nsplit2.rest);
                            _all2Html += _nh2 + _nr2;
                        }
                        formattedParas.push('<p style="' + FORMAT_STANDARD.paraStyle('level-' + _l2Lvl) + '">' + _all2Html + '</p>');
                    } else {
                        var split2 = extractFirstSentence(text);
                        var h2 = '<span style="' + FORMAT_STANDARD.inlineStyle('level-' + _l2Lvl) + '">' + escapeHtml(split2.sentence) + '</span>';
                        var r2 = _plainBodySpan(split2.rest);
                        formattedParas.push('<p style="' + FORMAT_STANDARD.paraStyle('level-' + _l2Lvl) + '">' + h2 + r2 + '</p>');
                    }
                    continue;
                }
                if (finalKind === 'heading_ctx') {
                    var _ctxState = { parentHeadingLevel: parentHeadingLevel, lastL2Seq: lastL2Seq, lastL3Seq: lastL3Seq, lastVerbSeq: lastVerbSeq, lastVerbLevel: lastVerbLevel };
                    var _decLvl = _npFmt_decideHeadingCtx(finalKind, candidates[i].hk, text, trimmed, _ctxState);
                    parentHeadingLevel = _ctxState.parentHeadingLevel || parentHeadingLevel;
                    lastHeadingLevel = _ctxState.lastHeadingLevel || lastHeadingLevel;
                    lastL2Seq = _ctxState.lastL2Seq || null;
                    lastL3Seq = _ctxState.lastL3Seq || null;
                    lastVerbSeq = _ctxState.lastVerbSeq || null;
                    lastVerbLevel = _ctxState.lastVerbLevel || 0;
                    var _hctxSplit = (_decLvl === 'level-3') ? extractFirstSentenceL3(text) : extractFirstSentence(text);
                    var _hctxH = '<span style="' + FORMAT_STANDARD.inlineStyle(_decLvl) + '">' + escapeHtml(_hctxSplit.sentence) + '</span>';
                    var _hctxR = _plainBodySpan(_hctxSplit.rest);
                    formattedParas.push('<p style="' + FORMAT_STANDARD.paraStyle(_decLvl) + '">' + _hctxH + _hctxR + '</p>');
                    continue;
                }
                function _findNumDunPositions(t) { var r = [], re = /(\d+)[.、．]/g, m; while ((m = re.exec(t)) !== null) { if (m.index === 0 || /[\s。；：,，、．]/.test(t.charAt(m.index - 1))) r.push(m.index); } return r; }
                function _findCnShiPositions(t) { var r = [], re = /([一二三四五六七八九十]+)[是要]/g, m; while ((m = re.exec(t)) !== null) { if (m.index === 0 || /[\s。；：,，、．]/.test(t.charAt(m.index - 1))) r.push(m.index); } return r; }
                if (finalKind === 'L3') {
                    lastHeadingLevel = 3;
                    var split3 = extractFirstSentenceL3(text);
                    var h3 = '<span style="' + FORMAT_STANDARD.inlineStyle('level-3') + '">' + escapeHtml(split3.sentence) + '</span>';
                    var r3 = _plainBodySpan(split3.rest);
                    formattedParas.push('<p style="' + FORMAT_STANDARD.paraStyle('level-3') + '">' + h3 + r3 + '</p>');
                    continue;
                }
                var regChRe = /^(第[一二三四五六七八九十百千万亿○零〇]+)(编|章|节)(?:\s+|　|$)/;
                var regChMatch = trimmed.match(regChRe);
                if (regChMatch && '，、；。：！？….,;:!?'.indexOf(trimmed.charAt(trimmed.length - 1)) === -1 && trimmed.length <= 80) {
                    var prevSame = i > 0 && !items[i - 1].blank && regChRe.test(items[i - 1].text.replace(/^\s+|\s+$/g, ''));
                    var nextSame = i < items.length - 1 && !items[i + 1].blank && regChRe.test(items[i + 1].text.replace(/^\s+|\s+$/g, ''));
                    if (!prevSame && !nextSame) {
                        var regLevel = regChMatch[2] === '节' ? 'level-regulation-section' : 'level-regulation-chapter';
                        var regSpan = FORMAT_STANDARD.inlineStyle(regLevel);
                        formattedParas.push('<p data-level="' + regLevel + '" style="font-family:' + (regLevel === 'level-regulation-section' ? '楷体_GB2312,楷体,KaiTi,serif' : '黑体,SimHei,sans-serif') + ';font-size:16px;font-weight:normal;text-align:center;text-indent:0;line-height:1.8;margin:0.5em 0;"><span style="' + regSpan + '">' + escapeHtml(text) + '</span></p>');
                        continue;
                    }
                }
                formattedParas.push('<p style="' + FORMAT_STANDARD.fullStyle('level-body') + '">' + _formatBodyMaybeRegulationClause(text) + '</p>');
            }
             var html = formattedParas.join('\n');
             return _npApplyRecipientFormat(html);
        }
        var _npFmtConfirmModal = null;
        function _npShowFormatConfirm(message, onConfirm) {
            if (_npFmtConfirmModal) { document.body.removeChild(_npFmtConfirmModal); _npFmtConfirmModal = null; }
            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);z-index:10099;display:flex;align-items:center;justify-content:center;';
            var box = document.createElement('div');
            box.style.cssText = 'background:#fff;border-radius:12px;padding:24px 28px;width:380px;max-width:90%;box-shadow:0 12px 40px rgba(0,0,0,0.25);font-family:SimSun,宋体,serif;';
            var msg = document.createElement('div');
            msg.textContent = message;
            msg.style.cssText = 'font-size:14px;color:#333;line-height:1.6;margin-bottom:16px;';
            box.appendChild(msg);
            var cbRow = document.createElement('label');
            cbRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;color:#555;margin-bottom:18px;cursor:pointer;user-select:none;';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = true;
            cb.style.margin = '0';
            cbRow.appendChild(cb);
            var cbText = document.createElement('span');
            cbText.textContent = '跳过手动设置格式的段落（保留其原格式）';
            cbRow.appendChild(cbText);
            box.appendChild(cbRow);
            var btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
            var cancelBtn = document.createElement('button');
            cancelBtn.textContent = '取消';
            cancelBtn.style.cssText = 'padding:8px 18px;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;color:#333;cursor:pointer;font-size:14px;';
            var okBtn = document.createElement('button');
            okBtn.textContent = '确定';
            okBtn.style.cssText = 'padding:8px 18px;border:none;border-radius:6px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;cursor:pointer;font-size:14px;';
            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(okBtn);
            box.appendChild(btnRow);
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            _npFmtConfirmModal = overlay;
            function close(result) {
                if (_npFmtConfirmModal === overlay) { document.body.removeChild(overlay); _npFmtConfirmModal = null; }
                if (result && onConfirm) onConfirm(cb.checked);
            }
            okBtn.addEventListener('click', function() { close(true); });
            cancelBtn.addEventListener('click', function() { close(false); });
            overlay.addEventListener('mousedown', function(e) { if (e.target === overlay) close(false); });
            setTimeout(function() { okBtn.focus(); }, 0);
        }
        // 文字保全：统计可读字数（忽略空白与 HTML 结构），用于格式操作前后比对
        // 说明：自动格式会主动剔除【一级】/【二级】/【三级】这类层级标记，比对前先归一化掉，避免误判丢字
        function _npTextForCompare(root) {
            if (!root) return '';
            var txt = (root.textContent || '')
                .replace(/【[一二三]级】/g, '')
                .replace(/[\s\r\n\t]+/g, '')
                .replace(/[\u00a0\u3000\u200b\u200c\u200d\ufeff]/g, '');
            return txt;
        }
        function _npCountChars(root) {
            return _npTextForCompare(root).length;
        }
        // 记录备份快照（供丢失恢复使用）；不压撤销栈，避免提前失败时污染撤销
        var _npFormatBackup = null;
        function _npBackupBeforeFormat(editor, label) {
            if (!editor) return null;
            _npFormatBackup = {
                label: label || '格式操作',
                html: editor.innerHTML,
                text: _npTextForCompare(editor),
                media: editor.querySelectorAll('img,table,svg,video,audio,canvas,iframe,object,embed').length,
                time: Date.now()
            };
            return _npFormatBackup;
        }
        // 操作完成后统一处理：先压撤销快照（保证 Ctrl+Z 回到整理前），再比对字数
        // 自动格式统一文字颜色为纯黑：清掉段落/内联元素上的彩色，保留加粗、字体、字号等
        function _npNormalizeTextColor(root) {
            if (!root) return;
            var nodes = root.querySelectorAll('[style]');
            for (var i = 0; i < nodes.length; i++) {
                var el = nodes[i];
                if (el.style.color) el.style.removeProperty('color');
                if (el.style.webkitTextFillColor) el.style.removeProperty('-webkit-text-fill-color');
                if (el.getAttribute('color')) el.removeAttribute('color');
                if (!el.getAttribute('style')) el.removeAttribute('style');
            }
            var fonts = root.querySelectorAll('font');
            for (var f = 0; f < fonts.length; f++) {
                if (fonts[f].getAttribute('color')) fonts[f].removeAttribute('color');
            }
        }
        function _npCommitFormat(editor, backup, opts) {
            if (editor && backup && typeof window._npPushUndoSnapshot === 'function') {
                try { window._npPushUndoSnapshot(backup.html, null, editor.scrollTop); } catch (e) { }
            }
            return _npVerifyAfterFormat(editor, backup, opts);
        }
        // 操作后比对：若文字变少，自动回滚并告警，绝不静默丢字
        function _npVerifyAfterFormat(editor, backup, opts) {
            if (!editor || !backup) return true;
            var after = _npTextForCompare(editor);
            var mediaAfter = editor.querySelectorAll('img,table,svg,video,audio,canvas,iframe,object,embed').length;
            var mediaLost = (backup.media != null && mediaAfter < backup.media);
            if (after.length >= backup.text.length && !mediaLost) {
                if (after.length !== backup.text.length) {
                    // 文字变多不算丢失，仅记录日志
                    console.warn('[格式保全] 字数增加：' + backup.text.length + ' → ' + after.length + '（' + backup.label + '）');
                }
                return true;
            }
            var lost = _npFindLostText(backup.text, after);
            console.error('[格式保全] 检测到内容丢失：' + backup.text.length + ' → ' + after.length + '（' + backup.label + '）丢失片段：' + lost);
            editor.innerHTML = backup.html;
            if (typeof window._npDropUndoSnapshot === 'function') {
                try { window._npDropUndoSnapshot(backup.html); } catch (e) { }
            }
            var msg = mediaLost
                ? '格式整理会丢失图片或表格，已自动恢复原文并取消本次操作。\n请先把图片单独放一段再重置格式。'
                : ('格式整理会丢失文字，已自动恢复原文并取消本次操作。\n' + (lost ? '丢失内容示例：' + lost.slice(0, 40) + '\n' : '') + '请检查该段落格式后重试。');
            if (typeof showToast === 'function') showToast(mediaLost ? '检测到图片丢失，已恢复原文' : '检测到文字丢失，已恢复原文');
            try { alert(msg); } catch (e) { }
            if (opts && opts.onRestore) { try { opts.onRestore(); } catch (e2) { } }
            return false;
        }
        // 找出原文中缺失的片段（用于告警提示）
        function _npFindLostText(beforeText, afterText) {
            if (!beforeText) return '';
            var i = 0, n = Math.min(beforeText.length, afterText.length);
            while (i < n && beforeText.charAt(i) === afterText.charAt(i)) i++;
            var j = 0;
            while (j < n - i && beforeText.charAt(beforeText.length - 1 - j) === afterText.charAt(afterText.length - 1 - j)) j++;
            var lost = beforeText.substring(i, beforeText.length - j);
            if (lost.length > 0) return lost;
            return beforeText.substring(i, Math.max(i + 1, beforeText.length - (afterText.length - i)));
        }
        function autoFormatDoc(skipConfirm, forcedSkipManual) {
            function _doFormat(skipManual) {
            var editor = document.getElementById('notepadEditor');
            var items = _notepadCollectLinesWithGaps(editor);
            if (items.length === 0) {
                var rawText = editor.innerText || editor.textContent || '';
                var rawLines = rawText.split('\n');
                var itemsFromText = [];
                for (var rli = 0; rli < rawLines.length; rli++) {
                    if (rawLines[rli].trim()) {
                        itemsFromText.push({ text: rawLines[rli], blank: false });
                    } else if (itemsFromText.length > 0 && !itemsFromText[itemsFromText.length - 1].blank) {
                        itemsFromText.push({ text: '', blank: true });
                    }
                }
                while (itemsFromText.length > 0 && itemsFromText[itemsFromText.length - 1].blank) itemsFromText.pop();
                items = itemsFromText;
            }
            if (skipManual) {
                var _edPs = editor.querySelectorAll('p');
                for (var _pi = 0; _pi < items.length && _pi < _edPs.length; _pi++) {
                    if (!items[_pi].blank) {
                        if (!items[_pi].el) items[_pi].el = _edPs[_pi];
                        if (!items[_pi].manual) items[_pi].manual = _edPs[_pi].getAttribute('data-manual') === '1';
                    }
                }
            }
            var isBracketLine = [];
            var explicitLevels = [];
            for (var bi = 0; bi < items.length; bi++) {
                explicitLevels[bi] = null;
                isBracketLine[bi] = false;
                if (items[bi].blank) continue;
                var bt = items[bi].text.replace(/^\s+|\s+$/g, '');
                if (/【(一|二|三)级】/.test(bt)) {
                    items[bi].text = bt.replace(/【[一二三]级】/g, '').replace(/^\s+|\s+$/g, '');
                }
                if (/^【[^】]+】/.test(items[bi].text.replace(/^\s+|\s+$/g, ''))) isBracketLine[bi] = true;
            }
            _notepadDirectoryEntries = [];
            var _bkFmt = _npBackupBeforeFormat(editor, '重置格式（全部）');
            var html = _notepadCoreFormat(items, isBracketLine, _notepadDirectoryEntries, false, 0, explicitLevels, skipManual);
            var savedScrollTop = editor.scrollTop;
            var savedScrollHeight = editor.scrollHeight;
            editor.innerHTML = html;
            _npCleanEmptyOutlineMarkers(editor);
            _npNormalizeTextColor(editor);
            _npNormalizeOutlineMarkers(editor);
            if (!_npCommitFormat(editor, _bkFmt)) return;
            var oldMax = savedScrollHeight - editor.clientHeight;
            var newMax = editor.scrollHeight - editor.clientHeight;
            if (oldMax > 0 && newMax > 0) {
                editor.scrollTop = Math.round(savedScrollTop * newMax / oldMax);
            } else {
                editor.scrollTop = Math.min(savedScrollTop, editor.scrollHeight);
            }
            saveCurrentEditor();
            updateFooterTimestamp();
            _refreshOutlineIfOpen();
            if (!skipConfirm) showToast('自动格式调整完成');
            }
            if (skipConfirm) { _doFormat(forcedSkipManual !== false); return; }
            _npShowFormatConfirm('将清除当前页面的文字格式，自动调整为常见公文格式，是否继续？', function(skipManual) {
                _doFormat(skipManual);
            });
        }
        /* 重置格式（全部）：按「编辑框当前显示的范围」决定重置多少
           - 中部标题栏选「全文」/ 编辑区显示全文 → 重置整篇（autoFormatDoc）
           - 选中某一篇文章 / 编辑区只显示这一篇 → 只重置这一篇（autoFormatDocCurrent） */
        function npResetFormatVisible() {
            var single = false;
            try {
                if (typeof window.npIsSingleArticleView === 'function') single = !!window.npIsSingleArticleView();
            } catch (e) { single = false; }
            if (single) autoFormatDocCurrent();
            else autoFormatDoc();
        }
        function autoFormatDocCurrent() {
            var editor = document.getElementById('notepadEditor');
            _notepadRestoreSelection();
            var savedRange = null;
            var s = window.getSelection();
            if (s.rangeCount && editor.contains(s.anchorNode)) {
                savedRange = s.getRangeAt(0).cloneRange();
            }
            _npShowFormatConfirm('将清除当前文章的文字格式，自动调整为常见公文格式，是否继续？', function(skipManual) {
            var sel = window.getSelection();
            if ((!sel.rangeCount || !editor.contains(sel.anchorNode)) && savedRange) {
                sel.removeAllRanges();
                sel.addRange(savedRange);
            }
            if (!sel.rangeCount || !editor.contains(sel.anchorNode)) { showToast('请将光标置于文章中'); return; }
            var node = sel.getRangeAt(0).startContainer;
            var cursorP = node.nodeType === 3 ? node.parentNode : node;
            while (cursorP && cursorP !== editor && cursorP.tagName !== 'P' && cursorP.tagName !== 'DIV') cursorP = cursorP.parentNode;
            if (!cursorP || cursorP === editor) { showToast('请将光标置于文章中'); return; }
            _npCleanEmptyOutlineMarkers(editor);
            _npNormalizeOutlineMarkers(editor);
            var ps = editor.querySelectorAll('p, div');
            if (ps.length < 2) { autoFormatDoc(true, skipManual); return; }
            var articles = [];
            for (var i = 0; i < ps.length; i++) {
                if (ps[i].getAttribute('data-outline-level') === '1') articles.push({ startIdx: i, endIdx: -1 });
            }
            if (articles.length === 0) { autoFormatDoc(true, skipManual); return; }
            for (var i = 0; i < articles.length; i++) {
                articles[i].endIdx = (i + 1 < articles.length) ? articles[i + 1].startIdx : ps.length;
            }
            var cursorIdx = -1;
            for (var i = 0; i < ps.length; i++) { if (ps[i] === cursorP) { cursorIdx = i; break; } }
            var curIdx = -1;
            for (var ai = 0; ai < articles.length; ai++) {
                if (cursorIdx >= articles[ai].startIdx && cursorIdx < articles[ai].endIdx) { curIdx = ai; break; }
            }
            if (curIdx === -1) { showToast('请将光标置于文章区域'); return; }
            var parts = [];
            for (var i = 0; i < ps.length; i++) parts.push(ps[i].outerHTML);
            var cur = articles[curIdx];
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = parts.slice(cur.startIdx, cur.endIdx).join('');
            var items = _notepadCollectLinesWithGaps(tempDiv);
            if (items.length === 0) { showToast('文章内容为空'); return; }
            var isBracketLine = [];
            var explicitLevels = [];
            for (var bi = 0; bi < items.length; bi++) {
                explicitLevels[bi] = null;
                isBracketLine[bi] = false;
                if (items[bi].blank) continue;
                var bt = items[bi].text.replace(/^\s+|\s+$/g, '');
                if (/【(一|二|三)级】/.test(bt)) {
                    items[bi].text = bt.replace(/【[一二三]级】/g, '').replace(/^\s+|\s+$/g, '');
                }
                if (/^【[^】]+】/.test(items[bi].text.replace(/^\s+|\s+$/g, ''))) isBracketLine[bi] = true;
            }
            if (window._notepadDiag) {
                console.log('_nPD items(' + items.length + '):');
                items.forEach(function(it,idx){ if (!it.blank) console.log('  ' + idx + ': [' + it.text.substring(0,50) + '] hk=' + (_notepadMatchHK(it.text)||'null')); });
            }
            var dummyEntries = [];
            var _bkCur = _npBackupBeforeFormat(editor, '重置格式（本篇）');
            var html = _notepadCoreFormat(items, isBracketLine, dummyEntries, false, 0, explicitLevels, skipManual);
            var blankRe = /^<p[^>]*>(&nbsp;|\s*)<\/p>$/i;
            var trailingBlanks = 0;
            for (var ti = cur.endIdx - 1; ti >= cur.startIdx; ti--) {
                if (blankRe.test(parts[ti])) trailingBlanks++;
                else break;
            }
            var blankCount = trailingBlanks || 1;
            var blankParaHtml = '<p style="margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;">&nbsp;</p>';
            var trailingHtml = '';
            for (var bi = 0; bi < blankCount; bi++) trailingHtml += blankParaHtml;
            var newParts = [].concat(parts.slice(0, cur.startIdx), html, trailingHtml, parts.slice(cur.endIdx));
            var savedScrollTop = editor.scrollTop;
            var savedScrollHeight = editor.scrollHeight;
            editor.innerHTML = newParts.join('');
            _npCleanEmptyOutlineMarkers(editor);
            _npNormalizeTextColor(editor);
            _npNormalizeOutlineMarkers(editor);
            if (!_npCommitFormat(editor, _bkCur)) return;
            var oldMax = savedScrollHeight - editor.clientHeight;
            var newMax = editor.scrollHeight - editor.clientHeight;
            if (oldMax > 0 && newMax > 0) {
                editor.scrollTop = Math.round(savedScrollTop * newMax / oldMax);
            } else {
                editor.scrollTop = Math.min(savedScrollTop, editor.scrollHeight);
            }
            saveCurrentEditor();
            updateFooterTimestamp();
            _refreshOutlineIfOpen();
            showToast('重置格式（本篇）完成');
            });
        }
        function autoFormatDocSelected(skipConfirm) {
            skipConfirm = true;
            var editor = document.getElementById('notepadEditor');
            var savedSel = window.getSelection();
            if (!savedSel.rangeCount || savedSel.isCollapsed || !editor.contains(savedSel.anchorNode) || !editor.contains(savedSel.focusNode)) {
                _notepadRestoreSelection();
                savedSel = window.getSelection();
                if (!savedSel.rangeCount || savedSel.isCollapsed || !editor.contains(savedSel.anchorNode) || !editor.contains(savedSel.focusNode)) {
                    showToast('请选取要格式化的文字');
                    return;
                }
            }
            function _doFormatSelected(skipManual) {
            var sel = window.getSelection();
            if ((!sel.rangeCount || sel.isCollapsed || !editor.contains(sel.anchorNode) || !editor.contains(sel.focusNode)) && savedSel.rangeCount && !savedSel.isCollapsed && editor.contains(savedSel.anchorNode)) {
                sel.removeAllRanges();
                sel.addRange(savedSel.getRangeAt(0).cloneRange());
            }
            if (!sel.rangeCount || sel.isCollapsed || !editor.contains(sel.anchorNode) || !editor.contains(sel.focusNode)) { showToast('请选取要格式化的文字'); return; }
            var range = sel.getRangeAt(0).cloneRange();
            _npCleanEmptyOutlineMarkers(editor);
            _npNormalizeOutlineMarkers(editor);
            var ps = editor.querySelectorAll('p');
            if (ps.length < 2) { autoFormatDoc(true, skipManual); return; }
            var startContainer = range.startContainer;
            var endContainer = range.endContainer;
            var sp = startContainer.nodeType === 3 ? startContainer.parentNode : startContainer;
            while (sp && sp !== editor && sp.tagName !== 'P') sp = sp.parentNode;
            if (!sp || sp.tagName !== 'P') { showToast('请选取有效的段落'); return; }
            var ep = endContainer.nodeType === 3 ? endContainer.parentNode : endContainer;
            while (ep && ep !== editor && ep.tagName !== 'P') ep = ep.parentNode;
            if (!ep || ep.tagName !== 'P') { showToast('请选取有效的段落'); return; }
            var startIdx = -1, endIdx = -1;
            for (var i = 0; i < ps.length; i++) {
                if (ps[i] === sp) startIdx = i;
                if (ps[i] === ep) endIdx = i;
            }
            if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) { showToast('选取区域无效'); return; }
            /* 图片 / 表格 / 视频等非文字内容一旦被重排会直接消失，先明确拦下，避免「内容丢失」 */
            var _richSel = 'img,table,svg,video,audio,canvas,iframe,object,embed';
            for (var ri = startIdx; ri <= endIdx; ri++) {
                if (ps[ri].querySelector && ps[ri].querySelector(_richSel)) {
                    showToast('选区含图片或表格，已跳过重置格式');
                    return;
                }
            }
            var parts = [];
            for (var i = 0; i < ps.length; i++) parts.push(ps[i].outerHTML);
            var _artStart = -1, _hasCtx = false;
            for (var i = startIdx; i >= 0; i--) { if (ps[i].getAttribute('data-outline-level') === '1') { _artStart = i; break; } }
            if (_artStart === -1) _artStart = 0;
            _hasCtx = _artStart < startIdx;
            var tempDiv = document.createElement('div');
            if (_hasCtx) {
                tempDiv.innerHTML = parts.slice(_artStart, endIdx + 1).join('');
                var _allItems = _notepadCollectLinesWithGaps(tempDiv);
                var _ctxCount = 0;
                if (startIdx > _artStart) {
                    var ctxDiv = document.createElement('div');
                    ctxDiv.innerHTML = parts.slice(_artStart, startIdx).join('');
                    _ctxCount = _notepadCollectLinesWithGaps(ctxDiv).length;
                }
                for (var si = 0; si < _ctxCount && si < _allItems.length; si++) { _allItems[si]._skip = true; }
                var items = _allItems;
            } else {
                tempDiv.innerHTML = parts.slice(startIdx, endIdx + 1).join('');
                var items = _notepadCollectLinesWithGaps(tempDiv);
            }
            if (items.length === 0) { showToast('选取内容为空'); return; }
            var isBracketLine = [];
            var explicitLevels = [];
            for (var bi = 0; bi < items.length; bi++) {
                explicitLevels[bi] = null;
                isBracketLine[bi] = false;
                if (items[bi].blank) continue;
                var bt = items[bi].text.replace(/^\s+|\s+$/g, '');
                if (/【(一|二|三)级】/.test(bt)) {
                    items[bi].text = bt.replace(/【[一二三]级】/g, '').replace(/^\s+|\s+$/g, '');
                }
                if (/^【[^】]+】/.test(items[bi].text.replace(/^\s+|\s+$/g, ''))) isBracketLine[bi] = true;
            }
            var dummyEntries = [];
            var _ctxStartCount = 0;
            if (_hasCtx) {
                var _seenL1 = false;
                for (var cci = _artStart; cci < startIdx; cci++) {
                    if (!ps[cci] || ps[cci].tagName !== 'P') continue;
                    var cct = (ps[cci].textContent || '').replace(/^\s+|\s+$/g, '');
                    if (!cct) continue;
                    if (ps[cci].getAttribute('data-outline-level') === '1') { _seenL1 = true; continue; }
                    if (!_seenL1) continue;
                    if (_ctxStartCount >= 3) break;
                    var dl = ps[cci].getAttribute('data-level');
                    if (dl === 'date') { _ctxStartCount = Math.max(_ctxStartCount, 2); continue; }
                    if (dl === 'author') { _ctxStartCount = Math.max(_ctxStartCount, 3); continue; }
                    if (cct.length <= 50 && '，、；。：！？…'.indexOf(cct.charAt(cct.length - 1)) === -1 && !cct.match(/^[一二三四五六七八九十]/) && !cct.match(/^\d+[.、．]/)) {
                        _ctxStartCount = _ctxStartCount === 0 ? 1 : Math.min(_ctxStartCount + 1, 3);
                    }
                }
            }
            var savedScrollTop = editor.scrollTop;
            var savedScrollHeight = editor.scrollHeight;
            var _bkSel = _npBackupBeforeFormat(editor, '重置格式（选取部分）');
            var html = _notepadCoreFormat(items, isBracketLine, dummyEntries, !!_hasCtx, _ctxStartCount, explicitLevels, skipManual);
            /* 按编辑区的全部直接子节点拼接，避免把选区外的 DIV / 图片 / 裸文本一起抹掉 */
            var childNodes = Array.prototype.slice.call(editor.childNodes);
            var nodeStart = childNodes.indexOf(ps[startIdx]);
            var nodeEnd = childNodes.indexOf(ps[endIdx]);
            if (nodeStart < 0 || nodeEnd < 0) { nodeStart = -1; }
            var newHtml;
            if (nodeStart < 0) {
                newHtml = [].concat(parts.slice(0, startIdx).map(function (h) { return h; }), html, parts.slice(endIdx + 1)).join('');
            } else {
                var blocked = false;
                for (var ci = nodeStart; ci <= nodeEnd; ci++) {
                    var cn = childNodes[ci];
                    if (cn.nodeType === 1 && cn.tagName !== 'P') { blocked = true; break; }
                    if (cn.nodeType === 3 && String(cn.nodeValue || '').replace(/\s/g, '')) { blocked = true; break; }
                }
                if (blocked) { showToast('选区含非段落内容，已跳过重置格式'); return; }
                var headHtml = childNodes.slice(0, nodeStart).map(function (n) { return n.nodeType === 1 ? n.outerHTML : (n.nodeValue || ''); }).join('');
                var tailHtml = childNodes.slice(nodeEnd + 1).map(function (n) { return n.nodeType === 1 ? n.outerHTML : (n.nodeValue || ''); }).join('');
                newHtml = headHtml + html + tailHtml;
            }
            editor.innerHTML = newHtml;
            _npCleanEmptyOutlineMarkers(editor);
            _npNormalizeTextColor(editor);
            _npNormalizeOutlineMarkers(editor);
            if (!_npCommitFormat(editor, _bkSel)) return;
            var oldMax = savedScrollHeight - editor.clientHeight;
            var newMax = editor.scrollHeight - editor.clientHeight;
            if (oldMax > 0 && newMax > 0) {
                editor.scrollTop = Math.round(savedScrollTop * newMax / oldMax);
            } else {
                editor.scrollTop = Math.min(savedScrollTop, editor.scrollHeight);
            }
            saveCurrentEditor();
            updateFooterTimestamp();
            _refreshOutlineIfOpen();
            showToast('重置格式（选取部分）完成');
            }
            _doFormatSelected(false);
        }
        function autoFormatAppend() {
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var _bkAppend = _npBackupBeforeFormat(editor, '追加格式（本篇）');
            // -- helpers --
            function _matchHK(tr) {
                if (tr.match(/^([一二三四五六七八九十]+)、/) || tr.match(/^(第[一二三四五六七八九十]+)[，,]/)) return 'cn-dun';
                if (tr.match(/^（[一二三四五六七八九十]+）/) || tr.match(/^\([一二三四五六七八九十]+\)/)) return 'cn-paren';
                if (tr.match(/^[一二三四五六七八九十]+[是要看抓查学]/)) return 'cn-verb';
            if (tr.match(/^(\d+)[.、．]/)) return 'num-dun';
                return null;
            }
            function _primaryFF(ff) { return (ff || '').split(',')[0].replace(/['"\s]/g, '').toLowerCase(); }
            function _paraFF(level) { var c = FORMAT_STANDARD.levels[level]; return c ? _primaryFF(c.fontFamily) : ''; }
            function _mapLevel(grp) {
                return grp === 'title' ? 'level-title' : grp === 'date' ? 'level-date' : grp === 'author' ? 'level-author' : grp === 'bracket' ? 'level-body' : grp === 'L1' ? 'level-1' : grp === 'L2' ? 'level-2' : grp === 'L3' ? 'level-3' : 'level-body';
            }
            function _leafSpan(p) {
                var all = p.querySelectorAll('span');
                for (var i = all.length - 1; i >= 0; i--) {
                    var s = all[i];
                    for (var c = 0; c < s.childNodes.length; c++) {
                        if (s.childNodes[c].nodeType === 3 && s.childNodes[c].textContent.trim()) return s;
                    }
                }
                return all.length > 0 ? all[0] : null;
            }
            function _leafFF(p) { var s = _leafSpan(p); return s ? (s.style.fontFamily || '') : ''; }
            function _copySpanStyle(srcSpan, dstSpan) {
                if (!srcSpan || !dstSpan) return;
                var sp = srcSpan.style;
                if (sp.fontFamily) dstSpan.style.fontFamily = sp.fontFamily;
                if (sp.fontSize) dstSpan.style.fontSize = sp.fontSize;
                if (sp.fontWeight) dstSpan.style.fontWeight = sp.fontWeight;
                if (sp.fontStyle) dstSpan.style.fontStyle = sp.fontStyle;
                if (sp.color) dstSpan.style.color = sp.color;
                if (sp.textDecoration) dstSpan.style.textDecoration = sp.textDecoration;
            }
            function _copyPStyle(templateP, targetP) {
                var tp = templateP.style, pp = targetP.style;
                if (tp.textAlign) pp.textAlign = tp.textAlign;
                if (tp.textIndent) pp.textIndent = tp.textIndent;
                if (tp.lineHeight) pp.lineHeight = tp.lineHeight;
                if (tp.fontFamily) pp.fontFamily = tp.fontFamily;
                if (tp.fontSize) pp.fontSize = tp.fontSize;
                if (tp.fontWeight) pp.fontWeight = tp.fontWeight;
                if (tp.color) pp.color = tp.color;
            }
            // Find current article
            var sel = window.getSelection();
            if (!sel.rangeCount || !editor.contains(sel.anchorNode)) { showToast('请将光标置于文章中'); return; }
            var node = sel.getRangeAt(0).startContainer;
            var cursorP = node.nodeType === 3 ? node.parentNode : node;
            while (cursorP && cursorP !== editor && cursorP.tagName !== 'P') cursorP = cursorP.parentNode;
            if (!cursorP || cursorP === editor) { showToast('请将光标置于文章中'); return; }
            var allParas = editor.querySelectorAll('p');
            var articleStart = -1, articleEnd = allParas.length;
            for (var pi = 0; pi < allParas.length; pi++) {
                if (allParas[pi].getAttribute('data-outline-level') === '1') {
                    if (articleStart === -1) {
                        var found = false;
                        for (var pj = pi; pj < allParas.length; pj++) {
                            if (allParas[pj] === cursorP) { found = true; break; }
                            if (allParas[pj].getAttribute('data-outline-level') === '1' && pj !== pi) break;
                        }
                        if (found) { articleStart = pi; continue; }
                    } else {
                        articleEnd = pi; break;
                    }
                }
            }
            if (articleStart === -1) { showToast('请将光标置于文章区域'); return; }
            var paras = [];
            for (var pi = articleStart; pi < articleEnd; pi++) paras.push(allParas[pi]);
            if (paras.length === 0) { showToast('没有可追加格式的内容'); return; }
            // -- classify paragraphs --
            var groups = { title: [], L1: [], L2: [], L3: [], body: [], bracket: [], date: [], author: [] };
            var _autoL1Pattern = null;
            var _autoL2Pattern = null;
            for (var i = 0; i < paras.length; i++) {
                var p = paras[i];
                var text = p.textContent || '';
                var trimmed = text.replace(/^\s+|\s+$/g, '');
                if (!trimmed) continue;
                if (/^【[^】]+】/.test(trimmed)) { groups.bracket.push(p); continue; }
                if (p.getAttribute('data-outline-level') === '1') {
                    // 索引标题（楷体 16px 左对齐、非文章标题）单独归类，避免被当成文章标题传播字体字号
                    if (p.getAttribute('data-level') === 'title' &&
                        !_npLooksLikeNumericIndexLine(trimmed) && !/^【[^】]{1,40}】/.test(trimmed)) {
                        groups.title.push(p);
                    } else {
                        groups.bracket.push(p);
                    }
                    continue;
                }
                var hk = _matchHK(trimmed);
                if (hk) {
                    if (hk === 'num-dun' || hk === 'cn-verb') {
                        if (!_autoL2Pattern) { _autoL2Pattern = hk; groups.L2.push(p); }
                        else if (hk === _autoL2Pattern) { groups.L2.push(p); }
                        else { groups.L3.push(p); }
                    } else if (!_autoL1Pattern) { _autoL1Pattern = hk; _autoL2Pattern = null; groups.L1.push(p); }
                    else if (hk === _autoL1Pattern) { _autoL2Pattern = null; groups.L1.push(p); }
                    else if (!_autoL2Pattern) { _autoL2Pattern = hk; groups.L2.push(p); }
                    else if (hk === _autoL2Pattern) { groups.L2.push(p); }
                    else { groups.L3.push(p); }
                } else {
                    var pf = (p.style.fontFamily || '').replace(/['"]/g, '').toLowerCase();
                    if (p.style.textAlign === 'center') {
                        if (pf.indexOf('楷体') !== -1) { groups.date.push(p); continue; }
                        if (pf.indexOf('小标宋') !== -1) { groups.title.push(p); continue; }
                    }
                    groups.body.push(p);
                }
            }
            // -- propagate user changes within each group --
            function _propagateGroup(grp, levelKey) {
                var ps = groups[grp];
                if (ps.length < 2) return;
                var template = null;
                var tLeafFF = null;
                for (var j = 0; j < ps.length; j++) {
                    if (template) break;
                    var ff = _leafFF(ps[j]);
                    if (ff && _primaryFF(ff) !== _paraFF(levelKey)) {
                        template = ps[j];
                        tLeafFF = ff;
                    }
                }
                // Also check <p>‑level font-family
                if (!template) {
                    for (var j2 = 0; j2 < ps.length; j2++) {
                        if (template) break;
                        if (ps[j2].style.fontFamily && _primaryFF(ps[j2].style.fontFamily) !== _paraFF(levelKey)) {
                            template = ps[j2];
                        }
                    }
                }
                if (template) {
                    for (var k = 0; k < ps.length; k++) {
                        if (ps[k] === template) continue;
                        var dst = _leafSpan(ps[k]);
                        var src = _leafSpan(template);
                        _copySpanStyle(src, dst);
                        _copyPStyle(template, ps[k]);
                    }
                }
            }
            _propagateGroup('title', 'level-title');
            _propagateGroup('date', 'level-date');
            _propagateGroup('author', 'level-author');
            _propagateGroup('bracket', 'level-body');
            _propagateGroup('L1', 'level-1');
            _propagateGroup('L2', 'level-2');
            _propagateGroup('L3', 'level-3');
            _propagateGroup('body', 'level-body');
            // -- detect date/author paragraphs after manually marked level-1 headings --
            for (var di = 0; di < paras.length; di++) {
                if (paras[di].getAttribute('data-outline-level') !== '1') continue;
                var dateCount = 0;
                for (var dj = di + 1; dj < paras.length && dateCount < 2; dj++) {
                    var np = paras[dj];
                    if (np.getAttribute('data-outline-level') === '1') break;
                    var nt = (np.textContent || '').trim();
                    if (!nt) continue;
                    // 文章标题、索引行、主送单位不参与日期/作者识别
                    if (np.getAttribute('data-level') === 'title' || np.getAttribute('data-level') === 'recipient') break;
                    if (_npManualLooksArticleTitle(np, nt) || _npLooksLikeIndexLine(nt, np) || _npLooksLikeNumericIndexLine(nt, np)) break;
                    if ('，、；。：！？…'.indexOf(nt.charAt(nt.length - 1)) !== -1) break;
                    if (nt.length > 30) break;
                    if (nt.match(/^[一二三四五六七八九十]/) || nt.match(/^\d+[.、．]/)) break;
                    np.setAttribute('data-level', dateCount === 0 ? 'date' : 'author');
                    np.style.fontFamily = '楷体_GB2312,楷体,KaiTi,serif';
                    np.style.fontSize = '18px';
                    np.style.textAlign = 'center';
                    np.style.textIndent = '0';
                    np.style.margin = '0';
                    np.style.lineHeight = '1.8';
                    dateCount++;
                }
            }
            // -- handle 一是……二是…… patterns inside body paragraphs --
            for (var bi = 0; bi < groups.body.length; bi++) {
                var bp = groups.body[bi];
                var spans = bp.querySelectorAll('span');
                if (spans.length < 2) continue;
                var yishiFF = null;
                var bodyStd = _paraFF('level-body');
                for (var si = 0; si < spans.length; si++) {
                    var stxt = spans[si].textContent || '';
                    if (stxt.match(/^[一二三四五六七八九十]/) && _primaryFF(spans[si].style.fontFamily) !== bodyStd) {
                        yishiFF = spans[si].style.fontFamily;
                        break;
                    }
                }
                if (yishiFF) {
                    for (var sj = 0; sj < spans.length; sj++) {
                        var st2 = spans[sj].textContent || '';
                        if (st2.match(/^[一二三四五六七八九十]/) && _primaryFF(spans[sj].style.fontFamily) === bodyStd) {
                            spans[sj].style.fontFamily = yishiFF;
                        }
                    }
                }
            }
            if (!_npCommitFormat(editor, _bkAppend)) return;
            saveCurrentEditor();
            updateFooterTimestamp();
            _refreshOutlineIfOpen();
            showToast('追加格式（本篇）完成');
        }
         function replaceOuterBrackets(html, openA, closeA, openB, closeB) {
             var out = '';
             var i = 0;
             var len = html.length;
            while (i < len) {
                var ch = html.charAt(i);
                if (ch === '<') {
                    // copy HTML tag verbatim
                    var end = html.indexOf('>', i);
                    if (end === -1) { out += html.substring(i); break; }
                    out += html.substring(i, end + 1);
                    i = end + 1;
                    continue;
                }
                if (ch === openA || ch === openB) {
                    // Skip brackets already inside an opening <span> tag (preserves title/heading formatting)
                    var _insideSpan = false;
                    for (var _si = i - 1; _si >= 0; _si--) {
                        var _sc = html.charAt(_si);
                        if (_sc === '>') {
                            var _st = html.lastIndexOf('<', _si);
                            if (_st >= 0 && html.substring(_st, _si + 1).match(/^<span\b/i)) {
                                var _cl = html.indexOf('</span>', _si + 1);
                                if (_cl === -1 || _cl > i) _insideSpan = true;
                            }
                            break;
                        }
                        if (_sc === '<') break;
                    }
                    if (_insideSpan) { out += ch; i++; continue; }
                    var start = i;
                    var depth = 0;
                    var j = i;
                    var foundEnd = -1;
                    while (j < len) {
                        var cj = html.charAt(j);
                        if (cj === '<') {
                            var te = html.indexOf('>', j);
                            if (te === -1) { j = len; break; }
                            j = te + 1;
                            continue;
                        }
                        if (cj === openA || cj === openB) depth++;
                        else if (cj === closeA || cj === closeB) {
                            depth--;
                            if (depth === 0) { foundEnd = j; break; }
                        }
                        j++;
                    }
                    if (foundEnd !== -1) {
                        var inner = html.substring(start, foundEnd + 1);
                        var plain = inner.replace(/<[^>]+>/g, '');
                        var innerText = plain.substring(1, plain.length - 1);
                        // Skip 中文序号 like （一）
                        if (/^[一二三四五六七八九十]+$/.test(innerText.replace(/[\s]/g, ''))) {
                            out += inner;
                        } else if (innerText.replace(/[\s]/g, '').length < 2) {
                            out += inner;
                        } else {
                            out += '<span style="font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:14px;">' + inner + '</span>';
                        }
                        i = foundEnd + 1;
                        continue;
                    }
                }
                out += ch;
                i++;
            }
            return out;
        }
        async function readClipboardText() {
            try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    return await navigator.clipboard.readText();
                }
            } catch (e) {}
            return null;
        }
        function _buildPasteHtml(text) {
            var lines = text.split('\n');
            var html = '';
            var bodyStyle = 'margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:2em;';
            var secretStyle = 'margin:0;line-height:1.8;font-family:黑体,SimHei,sans-serif;font-size:16px;text-align:left;text-indent:0;';
            var recipientStyle = 'margin:0;line-height:1.8;font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;font-size:16px;text-align:left;text-indent:0;';
            for (var li = 0; li < lines.length; li++) {
                var raw = lines[li];
                var trimmed = raw.replace(/^\s+|\s+$/g, '');
                if (!trimmed) {
                    html += '<p style="' + bodyStyle + '">&nbsp;</p>';
                    continue;
                }
                var esc = escapeHtml(trimmed);
                if ((trimmed.indexOf('密') !== -1 || trimmed.indexOf('★') !== -1) && trimmed.length <= 30) {
                    html += '<p style="' + secretStyle + '">' + esc + '</p>';
                } else if (/^[……‥]+[:：]/.test(trimmed) || /^\.\.\.[:：]/.test(trimmed)) {
                    html += '<p style="' + recipientStyle + '">' + esc + '</p>';
                } else {
                    html += '<p style="' + bodyStyle + '">' + esc + '</p>';
                }
            }
            return html;
        }
        async function pastePlainOverwrite() {
            if (!confirm('即将清除编辑框内容，并将复制内容以纯文本格式粘入，是否继续？')) return;
            var editor = document.getElementById('notepadEditor');
            var text = await readClipboardText();
            if (text === null) {
                showToast('读取剪贴板失败，请授权访问剪贴板后重试');
                return;
            }
            editor.innerHTML = _buildPasteHtml(text);
            saveCurrentEditor();
            updateFooterTimestamp();
            showToast('已粘入（覆盖）');
        }
        async function pastePlainAppend() {
            if (!confirm('将复制内容以纯文本格式粘到当前编辑框现有内容的最后，是否继续？')) return;
            var editor = document.getElementById('notepadEditor');
            var text = await readClipboardText();
            if (text === null) {
                showToast('读取剪贴板失败，请授权访问剪贴板后重试');
                return;
            }
            editor.innerHTML = editor.innerHTML + _buildPasteHtml(text);
            saveCurrentEditor();
            updateFooterTimestamp();
            showToast('已粘入（追加）');
        }
        var docDirHandle = null;
        function getDocTemplate() {
            var tpl = document.getElementById('docxTemplate');
            return tpl ? tpl.textContent : '';
        }
        function escapeXml(s) {
            return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        }
        function mapFontFamily(ff) {
            ff = (ff || '').toLowerCase();
            if (ff.indexOf('方正小标宋') !== -1 || ff.indexOf('fzxiaobiaosong') !== -1) return '方正小标宋简体';
            if (ff.indexOf('黑体') !== -1 || ff.indexOf('simhei') !== -1) return '黑体';
            if (ff.indexOf('楷体_gb2312') !== -1 || ff.indexOf('楷体') !== -1 || ff.indexOf('kaiti') !== -1) return '楷体_GB2312';
            if (ff.indexOf('仿宋_gb2312') !== -1 || ff.indexOf('仿宋') !== -1 || ff.indexOf('fangsong') !== -1) return '仿宋_GB2312';
            return '仿宋_GB2312';
        }
        function pxToHalfPt(px) {
            var n = parseFloat(px);
            if (!isFinite(n) || n <= 0) return 32;
            return Math.round(n * 2);
        }
        function alignToJc(a) {
            if (a === 'center') return 'center';
            if (a === 'right') return 'right';
            if (a === 'justify') return 'both';
            if (a === 'left') return 'left';
            return '';
        }
        function collectParagraphs(editor) {
            var paras = [];
            var currentRuns = [];
             var currentStyle = { align: '', indent: '', marginLeft: '', pageBreakBefore: false };
            var paragraphStyleSet = false;
            function isBlockTag(tag) {
                return (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'li' || tag === 'blockquote' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6' || tag === 'pre');
            }
            function isBlockNode(n) {
                return n && n.nodeType === 1 && isBlockTag((n.tagName || '').toLowerCase());
            }
            function findBlockAncestor(node) {
                var a = node.parentNode;
                while (a && a !== editor) {
                    if (a.nodeType === 1 && isBlockTag((a.tagName || '').toLowerCase())) return a;
                    a = a.parentNode;
                }
                return editor;
            }
            function hasContentAfter(brNode) {
                var stopAt = findBlockAncestor(brNode);
                var cur = brNode;
                while (cur && cur !== stopAt) {
                    var s = cur.nextSibling;
                    while (s) {
                        if (s.nodeType === 3) {
                            if (!/^\s*$/.test(s.nodeValue)) return true;
                        } else if (s.nodeType === 1) {
                            var tg = (s.tagName || '').toLowerCase();
                            if (tg === 'br') return true;
                            var rawTxt = (s.textContent || '').replace(/[\s\u00a0]+/g, '');
                            if (rawTxt.length > 0) return true;
                            if (s.querySelector && s.querySelector('br')) return true;
                        }
                        s = s.nextSibling;
                    }
                    cur = cur.parentNode;
                }
                return false;
            }
             function flush() {
                 paras.push({ align: currentStyle.align, indent: currentStyle.indent, marginLeft: currentStyle.marginLeft || '', lineHeight: currentStyle.lineHeight || '', pageBreakBefore: !!currentStyle.pageBreakBefore, runs: currentRuns });
                currentRuns = [];
                 currentStyle = { align: '', indent: '', marginLeft: '', pageBreakBefore: false, lineHeight: '' };
                paragraphStyleSet = false;
            }
            function walk(node, inherited) {
                if (node.nodeType === 3) {
                    var txt = node.nodeValue;
                    if (!txt) return;
                    if (isBlankText(txt)) {
                        var prev = node.previousSibling;
                        var next = node.nextSibling;
                        var prevBlock = prev && isBlockNode(prev);
                        var nextBlock = next && isBlockNode(next);
                        if (prevBlock || nextBlock) return;
                    }
                    currentRuns.push({ text: txt, font: inherited.font, size: inherited.size, bold: inherited.bold, italic: inherited.italic, underline: inherited.underline });
                    return;
                }
                if (node.nodeType !== 1) return;
                var tag = node.tagName.toLowerCase();
                if (node.style && node.style.display === 'none') { return; }
                if (tag === 'br') {
                    if (hasContentAfter(node)) {
                      var saved = { align: currentStyle.align, indent: currentStyle.indent, marginLeft: currentStyle.marginLeft, pageBreakBefore: currentStyle.pageBreakBefore };
                        flush();
                        currentStyle = saved;
                        paragraphStyleSet = true;
                    }
                    return;
                }
                var style = node.style || {};
                var computed;
                try { computed = window.getComputedStyle(node); } catch(e) { computed = {}; }
                var newInherited = {
                    font: inherited.font,
                    size: inherited.size,
                    bold: inherited.bold,
                    italic: inherited.italic,
                    underline: inherited.underline
                };
                var ff = (style.fontFamily || (computed && computed.fontFamily) || '');
                if (ff) newInherited.font = mapFontFamily(ff);
                var fs = (style.fontSize || (computed && computed.fontSize) || '');
                if (fs) newInherited.size = pxToHalfPt(fs);
                var fw = (style.fontWeight || (computed && computed.fontWeight) || '');
                if (tag === 'b' || tag === 'strong') newInherited.bold = true;
                else if (fw) {
                    var fwN = parseInt(fw, 10);
                    if (!isNaN(fwN)) newInherited.bold = fwN >= 600;
                    else if (fw === 'bold' || fw === 'bolder') newInherited.bold = true;
                    else if (fw === 'normal' || fw === 'lighter') newInherited.bold = false;
                }
                if (tag === 'i' || tag === 'em') newInherited.italic = true;
                if (tag === 'u') newInherited.underline = true;
                var td = (style.textDecoration || (computed && computed.textDecoration) || '');
                if (td && td.indexOf('underline') !== -1) newInherited.underline = true;
                 var isBlock = isBlockTag(tag);
                 if (isBlock) {
                     if (currentRuns.length > 0 || paragraphStyleSet) flush();
                     var ta = style.textAlign || (computed && computed.textAlign) || '';
                     var ti = style.textIndent || (computed && computed.textIndent) || '';
                     currentStyle.align = alignToJc(ta);
                     currentStyle.indent = ti;
                      currentStyle.lineHeight = style.lineHeight || (computed && computed.lineHeight) || '';
                      currentStyle.marginLeft = style.marginLeft || (computed && computed.marginLeft) || '';
                      if (node.getAttribute('data-level') === 'attachment') {
                          currentStyle.indent = style.textIndent || (computed && computed.textIndent) || '';
                          currentStyle.marginLeft = style.marginLeft || (computed && computed.marginLeft) || '';
                      }
                      var paraText = (node.textContent || '').replace(/^\s+|\s+$/g, '');
                      // 分页只放在独立的“附件/附件1/附件一”标记前，不放在“附件：1.”列表首项前。
                      var isAttachmentPara = /^附件(?:\s*[：:]?\s*(?:\d+|[一二三四五六七八九十]+))?$/.test(paraText);
                      currentStyle.pageBreakBefore = isAttachmentPara;
                     paragraphStyleSet = true;
                }
                for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i], newInherited);
                if (isBlock) {
                    flush();
                }
            }
            var defaultInherited = { font: '仿宋_GB2312', size: 32, bold: false, italic: false, underline: false };
            for (var i = 0; i < editor.childNodes.length; i++) walk(editor.childNodes[i], defaultInherited);
            if (currentRuns.length > 0 || paragraphStyleSet) flush();
            return paras;
        }
        function buildRunXml(run) {
            var font = run.font || '仿宋_GB2312';
            var sz = run.size || 32;
            var rpr = '<w:rPr><w:rFonts w:ascii="' + escapeXml(font) + '" w:h-ansi="' + escapeXml(font) + '" w:fareast="' + escapeXml(font) + '" w:cs="' + escapeXml(font) + '" w:hint="fareast"/>';
            if (run.bold) rpr += '<w:b/><w:b-cs/>'; else rpr += '<w:b w:val="off"/><w:b-cs/>';
            if (run.italic) rpr += '<w:i/>'; else rpr += '<w:i w:val="off"/>';
            if (run.underline) rpr += '<w:u w:val="single"/>';
            rpr += '<w:color w:val="auto"/><w:sz w:val="' + sz + '"/><w:sz-cs w:val="' + sz + '"/><w:lang w:val="EN-US" w:fareast="ZH-CN"/></w:rPr>';
            var text = run.text || '';
            var parts = text.split(/(\t)/);
            var body = '';
            for (var i = 0; i < parts.length; i++) {
                if (parts[i] === '\t') {
                    body += '<w:r>' + rpr + '<w:tab/></w:r>';
                } else if (parts[i].length > 0) {
                    body += '<w:r>' + rpr + '<w:t xml:space="preserve">' + escapeXml(parts[i]) + '</w:t></w:r>';
                }
            }
            return body;
        }
         function lineHeightToTwips(lineHeight, runs) {
             var raw = String(lineHeight || '').trim().toLowerCase();
             var value = parseFloat(raw);
             if (!isFinite(value) || value <= 0) value = 1.8;
             var unit = raw.replace(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/, '').trim();
             var fontPt = 16;
             if (runs && runs.length) {
                 var halfPt = parseFloat(runs[0].size);
                 if (isFinite(halfPt) && halfPt > 0) fontPt = halfPt / 2;
             }
             var points = unit === 'pt' ? value : (unit === 'px' ? value * 0.75 : value * fontPt);
             if (!isFinite(points) || points <= 0) points = fontPt * 1.8;
             return Math.max(1, Math.round(points * 20));
         }
         function buildParagraphXml(para) {
             var jc = para.align;
             var lineTwips = lineHeightToTwips(para.lineHeight, para.runs);
             if (!jc || jc === 'left' || jc === 'start') jc = 'both';
             var indent = '';
             var ti = (para.indent || '').trim();
             if (ti && ti !== '0' && ti !== '0px' && ti !== '0em') {
                if (ti.indexOf('2em') !== -1) indent = '<w:ind w:first-line="640" w:first-line-chars="200"/>';
                else if (ti.indexOf('4em') !== -1) indent = '<w:ind w:first-line="1280" w:first-line-chars="400"/>';
                else if (/(-?\d+(?:\.\d+)?)em/.test(ti)) {
                    var em = parseFloat(RegExp.$1);
                    var fl = Math.round(em * 320);
                    var fc = Math.round(em * 100);
                    indent = '<w:ind w:first-line="' + fl + '" w:first-line-chars="' + fc + '"/>';
                } else if (/(-?\d+(?:\.\d+)?)px/.test(ti)) {
                    var px = parseFloat(RegExp.$1);
                    var fl2 = Math.round(px * 15);
                    indent = '<w:ind w:first-line="' + fl2 + '"/>';
                }
            } else if (ti === '0' || ti === '0px' || ti === '0em') {
                indent = '<w:ind w:left="0" w:right="0" w:first-line="0" w:first-line-chars="0"/>';
            }
             var marginLeftRaw = String(para.marginLeft || '').trim().toLowerCase();
             var marginLeft = parseFloat(marginLeftRaw);
             var marginLeftTwips = 0;
             if (isFinite(marginLeft) && marginLeft > 0) {
                 if (marginLeftRaw.indexOf('em') !== -1) {
                     var baseHalfPt = para.runs && para.runs.length && isFinite(parseFloat(para.runs[0].size)) ? parseFloat(para.runs[0].size) : 32;
                     marginLeftTwips = Math.round(marginLeft * (baseHalfPt / 2) * 20);
                 } else {
                     marginLeftTwips = Math.round(marginLeft * 15);
                 }
             }
             if (marginLeftTwips && /^-\s*\d/.test(ti)) {
                 var hangingEm = parseFloat(ti);
                 if (isFinite(hangingEm) && hangingEm < 0) indent = '<w:ind w:left="' + marginLeftTwips + '" w:hanging="' + Math.round(Math.abs(hangingEm) * 320) + '"/>';
             } else if (marginLeftTwips && !indent) {
                 indent = '<w:ind w:left="' + marginLeftTwips + '"/>';
             }
             var ppr = '<w:pPr>';
             if (para.pageBreakBefore) ppr += '<w:pageBreakBefore/>';
             ppr += '<w:spacing w:line="' + lineTwips + '" w:line-rule="exact"/>';
            if (indent) ppr += indent;
            ppr += '<w:jc w:val="' + jc + '"/>';
            ppr += '<w:rPr><w:rFonts w:ascii="仿宋_GB2312" w:h-ansi="仿宋_GB2312" w:fareast="仿宋_GB2312" w:cs="仿宋_GB2312" w:hint="fareast"/><w:sz w:val="32"/><w:sz-cs w:val="32"/></w:rPr>';
            ppr += '</w:pPr>';
            var runsXml = '';
            if (para.runs.length === 0) {
                return '<w:p>' + ppr + '</w:p>';
            }
            for (var i = 0; i < para.runs.length; i++) {
                var r = para.runs[i];
                var segs = (r.text || '').split('\n');
                for (var s = 0; s < segs.length; s++) {
                    if (segs[s].length > 0) {
                        runsXml += buildRunXml({ text: segs[s], font: r.font, size: r.size, bold: r.bold, italic: r.italic, underline: r.underline });
                    }
                    if (s < segs.length - 1) {
                        runsXml += '<w:r><w:br/></w:r>';
                    }
                }
            }
            return '<w:p>' + ppr + runsXml + '</w:p>';
        }
        function buildDocBodyXml(paragraphs) {
            var out = '';
            for (var i = 0; i < paragraphs.length; i++) out += buildParagraphXml(paragraphs[i]);
            if (out === '') out = '<w:p></w:p>';
            return out;
        }
        function sanitizeDocFileName(name) {
            return String(name).replace(/[\\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
        }
        var IDB_NAME = 'notepadExport';
        var IDB_STORE = 'handles';
        function idbOpen() {
            return new Promise(function(resolve, reject) {
                try {
                    var r = indexedDB.open(IDB_NAME, 1);
                    r.onupgradeneeded = function() {
                        var db = r.result;
                        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
                    };
                    r.onsuccess = function() { resolve(r.result); };
                    r.onerror = function() { reject(r.error); };
                } catch (e) { reject(e); }
            });
        }
        async function idbPut(key, val) {
            try {
                var db = await idbOpen();
                return await new Promise(function(resolve, reject) {
                    var tx = db.transaction(IDB_STORE, 'readwrite');
                    tx.objectStore(IDB_STORE).put(val, key);
                    tx.oncomplete = function() { resolve(); };
                    tx.onerror = function() { reject(tx.error); };
                });
            } catch (e) {}
        }
        async function idbGet(key) {
            try {
                var db = await idbOpen();
                return await new Promise(function(resolve, reject) {
                    var tx = db.transaction(IDB_STORE, 'readonly');
                    var rq = tx.objectStore(IDB_STORE).get(key);
                    rq.onsuccess = function() { resolve(rq.result); };
                    rq.onerror = function() { reject(rq.error); };
                });
            } catch (e) { return null; }
        }
        async function verifyPermission(handle, readWrite) {
            if (!handle || !handle.queryPermission) return true;
            var opts = readWrite ? { mode: 'readwrite' } : { mode: 'read' };
            try {
                if ((await handle.queryPermission(opts)) === 'granted') return true;
                if ((await handle.requestPermission(opts)) === 'granted') return true;
            } catch(e) {}
            return false;
        }
        async function tryRestoreDocDirHandle() {
            if (docDirHandle) return docDirHandle;
            var saved = await idbGet('docDirHandle');
            if (!saved) return null;
            var ok = await verifyPermission(saved, true);
            if (!ok) return null;
            docDirHandle = saved;
            return docDirHandle;
        }
        async function pickExportRootAndResolveDocDir() {
            if (!window.showDirectoryPicker) return null;
            try {
                showToast('请选择导出文件夹');
                var dirHandle = await window.showDirectoryPicker({ id: 'notepad-root-dir', mode: 'readwrite' });
                docDirHandle = dirHandle;
                await idbPut('docDirHandle', dirHandle);
                return dirHandle;
            } catch (e) {
                return null;
            }
        }
        async function ensureDocDirHandle() {
            if (docDirHandle) {
                if (await verifyPermission(docDirHandle, true)) return docDirHandle;
            }
            var restored = await tryRestoreDocDirHandle();
            if (restored) return restored;
            return await pickExportRootAndResolveDocDir();
        }
        var notebookRootHandle = null;
        async function tryRestoreNotebookRoot() {
            var saved = await idbGet('notebookRootHandle');
            if (!saved) return null;
            var ok = await verifyPermission(saved, true);
            if (!ok) return null;
            notebookRootHandle = saved;
            return notebookRootHandle;
        }
        async function pickNotebookRoot() {
            if (!window.showDirectoryPicker) { showToast('当前浏览器不支持选择文件夹'); return null; }
            try {
                var rootHandle = await window.showDirectoryPicker({ id: 'notebook-root', mode: 'readwrite' });
                notebookRootHandle = rootHandle;
                await idbPut('notebookRootHandle', rootHandle);
                showToast('已设置根目录: ' + rootHandle.name);
                return rootHandle;
            } catch (e) {
                showToast('选择已取消');
                return null;
            }
        }
        async function autoResolveDirsFromRoot() {
            if (!notebookRootHandle) return;
            try {
                // 先尝试获取已存在的"工作日志"目录，不自动创建
                workLogDirHandle = await notebookRootHandle.getDirectoryHandle('工作日志');
                scanFolderName = '工作日志';
                // 通知 store.js 加载 appdata.js
                if (typeof window.setSaveDataDirHandle === 'function') {
                    try { window.setSaveDataDirHandle(workLogDirHandle); } catch(e) {}
                }
            } catch(e) {
                // 如果目录不存在，尝试从 IndexedDB 恢复之前保存的 handle
                try {
                    var savedHandle = await idbGet('workLogDirHandle');
                    if (savedHandle) {
                        var ok = await verifyPermission(savedHandle, true);
                        if (ok) {
                            workLogDirHandle = savedHandle;
                            scanFolderName = savedHandle.name;
                            // 通知 store.js 加载 appdata.js
                            if (typeof window.setSaveDataDirHandle === 'function') {
                                try { window.setSaveDataDirHandle(workLogDirHandle); } catch(e) {}
                            }
                        }
                    }
                } catch(e2) {}
            }
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
            } catch(e) {}
        }
        async function exportNotepadDoc() {
            saveCurrentEditor();
            var editor = document.getElementById('notepadEditor');
            if (!editor) { showToast('未找到编辑框'); return; }
            var tpl = getDocTemplate();
            if (!tpl) { showToast('未找到文档模板'); return; }
            var paragraphs = collectParagraphs(editor);
            if (paragraphs.length === 0) { showToast('当前文稿内容为空，无法导出'); return; }
            var bodyXml = buildDocBodyXml(paragraphs);
            var xml = tpl.replace('__DOC_BODY__', bodyXml);
            var now = new Date();
            var ts = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
            var title = '';
            try { title = (document.getElementById('notepadTitle') || {}).value || ''; } catch(e) {}
            title = title.trim();
            if (!title || title === '…') title = notepadTitles[currentNotepadTab] || '';
            if (!title || title === '…') title = '文稿';
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
                    showToast('已导出: ' + fileName);
                    return;
                } catch(e) {
                    showToast('写入失败，改为下载: ' + e.message);
                }
            }
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            updateFooterTimestamp();
            showToast('已下载: ' + fileName);
        }
        var _NP_FONT_LABEL = { SimHei: '黑体', KaiTi: '楷体', FangSong: '仿宋', FZXiaoBiaoSong: '方正小标宋简体' };
        function applyFontSelect(value) {
            if (!value) return;
            applyFont(value);
            _npSetLastFormat('字体 ' + (_NP_FONT_LABEL[value] || value), function () { applyFontSelect(value); });
        }
        function indentParagraph() {
            var editor = document.getElementById('notepadEditor');
            var sel = window.getSelection();
            if (!sel.rangeCount) { editor.focus(); sel = window.getSelection(); if (!sel.rangeCount) return; }
            var node = sel.anchorNode;
            while (node && node !== editor && node.parentNode !== editor) node = node.parentNode;
            if (!node || node === editor) {
                var range = sel.getRangeAt(0);
                var p = document.createElement('p');
                p.style.textIndent = '4em';
                p.style.margin = '0';
                var text = range.extractContents();
                p.appendChild(text);
                range.insertNode(p);
                _npMarkManualPara(p);
                var newRange = document.createRange();
                newRange.setStart(p, 0);
                newRange.collapse(true);
                sel.removeAllRanges(); sel.addRange(newRange);
                _refreshOutlineIfOpen();
                return;
            }
            var existingIndent = node.style && node.style.textIndent;
            if (existingIndent && existingIndent !== '' && existingIndent !== '0' && existingIndent !== '0px') {
                node.style.textIndent = '';
            } else {
                node.style.textIndent = '4em';
            }
            _npMarkManualPara(node);
            _refreshOutlineIfOpen();
        }
        function applyAlign(value) {
            if (!value) return;
            var editor = document.getElementById('notepadEditor');
            _notepadRestoreSelection();
            var sel = window.getSelection();
            if (!sel.rangeCount) { editor.focus(); sel = window.getSelection(); if (!sel.rangeCount) { return; } }
            var node = sel.anchorNode;
            while (node && node !== editor && node.parentNode !== editor) node = node.parentNode;
            if (!node || node === editor) {
                var range = sel.getRangeAt(0);
                var p = document.createElement('p');
                p.style.textAlign = value;
                p.style.margin = '0';
                var text = range.extractContents();
                p.appendChild(text);
                range.insertNode(p);
                _npMarkManualPara(p);
            } else {
                node.style.textAlign = value;
                _npMarkManualPara(node);
            }
            _refreshOutlineIfOpen();
            var _npAlignLabel = { left: '左对齐', center: '居中对齐', right: '右对齐', justify: '两端对齐' };
            _npSetLastFormat(_npAlignLabel[value] || '对齐', function () { applyAlign(value); });
        }
        function applyNotepadStyle(style) {
            var editor = document.getElementById('notepadEditor');
            _notepadRestoreSelection();
            var sel = window.getSelection();
            if (!sel.rangeCount || !editor.contains(sel.anchorNode)) { editor.focus(); sel = window.getSelection(); if (!sel.rangeCount) return; }
            if (style === 'normal') {
                var _r = sel.getRangeAt(0);
                var _pNode = _r.startContainer;
                if (_pNode.nodeType === 3) _pNode = _pNode.parentNode;
                while (_pNode && _pNode !== editor && _pNode.tagName !== 'P' && _pNode.tagName !== 'DIV') _pNode = _pNode.parentNode;
                document.execCommand('removeFormat');
                if (_r && !_r.collapsed) _npMarkManualRange(_r);
                if (_pNode && _pNode !== editor) _npMarkManualPara(_pNode);
                _refreshOutlineIfOpen();
                return;
            }
            var fmtMap = {
                bold:      { prop: 'fontWeight',  val: 'bold',       tags: ['B','STRONG'],                 wrap: 'b' },
                italic:    { prop: 'fontStyle',   val: 'italic',     tags: ['I','EM'],                     wrap: 'i' },
                underline: { prop: 'textDecoration', val: 'underline', tags: ['U','INS'],                  wrap: 'u' },
                strike:    { prop: 'textDecoration', val: 'line-through', tags: ['S','STRIKE','DEL'],     wrap: 's' }
            };
            var f = fmtMap[style];
            if (!f) return;
            var range = sel.getRangeAt(0);
            if (range.collapsed) return;
            _npApplyUnifiedFormat(range, sel, editor, f.prop, f.val, f.tags, f.wrap);
            sel.removeAllRanges();
            var _npStyleLabel = { bold: '加粗', italic: '斜体', underline: '下划线', strike: '删除线' };
            _npSetLastFormat(_npStyleLabel[style] || '文字样式', function () { applyNotepadStyle(style); });
        }
        function cleanNotepadBlankLines() {
            if (!confirm('将清除多余空行，是否继续？')) return;
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var paras = editor.querySelectorAll('p');
            if (paras.length === 0) return;
            var items = [];
            for (var i = 0; i < paras.length; i++) {
                var raw = (paras[i].textContent || '').replace(/\s/g, '').replace(/\u00a0/g, '');
                items.push({ el: paras[i], blank: raw.length === 0 });
            }
            if (items.length === 0) { showToast('没有内容'); return; }
            var bodyStart = items.length;
            for (var i = 0; i < items.length; i++) {
                if (items[i].blank) continue;
                var p = items[i].el;
                var isBracket = p.getAttribute('data-outline-level') === '1';
                var ta = (p.style.textAlign || '').toLowerCase();
                if (!isBracket && ta !== 'center') { bodyStart = i; break; }
            }
            var result = [];
            var removedCount = 0;
            var addedCount = 0;
            var blankHtml = '<p style="margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:2em;">&nbsp;</p>';
            var i = 0;
            while (i < items.length) {
                if (items[i].blank) {
                    var j = i;
                    while (j < items.length && items[j].blank) j++;
                    var prevIdx = -1, nextIdx = -1;
                    for (var k = i - 1; k >= 0; k--) { if (!items[k].blank) { prevIdx = k; break; } }
                    for (var k = j; k < items.length; k++) { if (!items[k].blank) { nextIdx = k; break; } }
                    var keep = false;
                    var prevPara = prevIdx >= 0 ? items[prevIdx].el : null;
                    var nextPara = nextIdx >= 0 ? items[nextIdx].el : null;
                    var prevLevel = prevPara ? (prevPara.getAttribute('data-level') || '') : '';
                    var nextIsArticle = !!(nextPara && nextPara.getAttribute('data-outline-level') === '1');
                    if (nextIsArticle && prevIdx >= 0) {
                        // 每篇文章结尾与下一篇文章开始之间统一保留两个空行。
                        var keepCount = Math.min(2, j - i);
                        for (var bi = 0; bi < keepCount; bi++) result.push(items[i + bi].el);
                        for (var ba = keepCount; ba < 2; ba++) { result.push({ outerHTML: blankHtml }); addedCount++; }
                        if (j - i > 2) removedCount += (j - i) - 2;
                        i = j;
                        continue;
                    }
                    // 保留作者/日期段落后的空行，以及下一篇文章标题前的空行。
                    if (prevLevel === 'date' || prevLevel === 'author' || nextIsArticle) keep = true;
                    if (prevIdx >= 0 && nextIdx >= 0) {
                        if (prevIdx < bodyStart || nextIdx < bodyStart) keep = true;
                    }
                    if (keep) result.push(items[i].el);
                    else removedCount += j - i;
                    i = j;
                } else {
                    result.push(items[i].el);
                    if (i + 1 < items.length && !items[i + 1].blank && items[i + 1].el.getAttribute('data-outline-level') === '1') {
                        // 没有现成空行时，补足文章之间的两个空行。
                        result.push({ outerHTML: blankHtml });
                        result.push({ outerHTML: blankHtml });
                        addedCount += 2;
                    }
                    i++;
                }
            }
            if (!removedCount && !addedCount) { showToast('清除了0个空行，补充了0个空行'); return; }
            var html = '';
            for (var di = 0; di < result.length; di++) html += result[di].outerHTML;
            editor.innerHTML = html;
            saveCurrentEditor();
            updateFooterTimestamp();
            _refreshOutlineIfOpen();
            showToast('清除了' + removedCount + '个空行，补充了' + addedCount + '个空行');
        }
        function cleanNotepadSpaces() {
            if (!confirm('仅清除各个层级标题段落和正文段落中的空格，不清理标题、空行及其他段落，是否继续？')) return;
            var editor = document.getElementById('notepadEditor');
            if (!editor) return;
            var paras = editor.querySelectorAll('p');
            var removedSpaces = 0;
            for (var i = 0; i < paras.length; i++) {
                var p = paras[i];
                var dataLevel = p.getAttribute('data-level') || '';
                var text = p.textContent || '';
                // 空段落原样保留，清除空格只作用于有内容的标题或正文段落。
                if (!text.replace(/[\s\u3000\u00a0\u200b\ufeff]/g, '')) continue;
                if (p.getAttribute('data-outline-level') === '1' ||
                    dataLevel === 'index' || dataLevel === 'title' || dataLevel === 'date' ||
                    dataLevel === 'author' || dataLevel === 'recipient' || dataLevel === 'remark' ||
                    dataLevel === 'secret' || dataLevel === 'attachment') continue;
                var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
                var textNodes = [];
                while (walker.nextNode()) textNodes.push(walker.currentNode);
                for (var j = 0; j < textNodes.length; j++) {
                    var node = textNodes[j];
                    var oldText = node.nodeValue || '';
                    var newText = oldText.replace(/[ \u3000\u00a0\t]/g, '');
                    if (newText !== oldText) {
                        node.nodeValue = newText;
                        removedSpaces += (oldText.match(/[ \u3000\u00a0\t]/g) || []).length;
                    }
                }
            }
            if (!removedSpaces) { showToast('清除了0个空格'); return; }
            saveCurrentEditor();
            updateFooterTimestamp();
            _refreshOutlineIfOpen();
            showToast('清除了' + removedSpaces + '个空格');
        }
        function applyParagraphStyle(mode) {
            var editor = document.getElementById('notepadEditor');
            _notepadRestoreSelection();
            var sel = window.getSelection();
            if (!sel.rangeCount) { editor.focus(); sel = window.getSelection(); if (!sel.rangeCount) return; }
            var _bkPara = _npBackupBeforeFormat(editor, '段落格式-' + mode);
            var node = sel.anchorNode;
            while (node && node !== editor && node.nodeName !== 'P' && node.nodeName !== 'DIV') node = node.parentNode;
            if (!node || node === editor) node = document.createElement('div');
            var range = sel.getRangeAt(0);
            if (mode === 'title') {
                var p = document.createElement('p');
                p.style.fontFamily = '方正小标宋简体';
                p.style.fontSize = '20px';
                p.style.textAlign = 'center';
                p.style.textIndent = '0';
                p.style.margin = '0';
                p.appendChild(range.extractContents());
                range.deleteContents();
                range.insertNode(p);
                p.removeAttribute('data-outline-level');
                p.removeAttribute('data-np-index');
                _npMarkManualPara(p);
                sel.removeAllRanges();
                var r = document.createRange(); r.selectNodeContents(p); r.collapse(false); sel.addRange(r);
            } else if (mode === 'indent') {
                var paras = editor.querySelectorAll('p');
                var target = node;
                var start = -1, end = -1;
                for (var i = 0; i < paras.length; i++) {
                    if (paras[i] === target) { start = i; break; }
                }
                if (start === -1) return;
                var text = target.textContent.trim();
                var firstChar = text.length > 0 ? text[0] : '';
                if (target.style.textAlign === 'center') {} else if (target.style.fontSize === '20px' && target.style.fontFamily && target.style.fontFamily.indexOf('方正小标宋简体') !== -1) {} else {
                    if (firstChar.match(/[\u4e00-\u9fff]/)) {
                        var curIndent = target.style.textIndent || '';
                        if (curIndent === '2em' || curIndent === '32px') { target.style.textIndent = '0'; } else { target.style.textIndent = '2em'; }
                    } else { target.style.textIndent = '2em'; }
                }
                _npMarkManualPara(target);
            } else if (mode === 'normal') {
                var paras = editor.querySelectorAll('p');
                var target = node;
                for (var i = 0; i < paras.length; i++) {
                    if (paras[i] === target) {
                        target.style.fontFamily = '仿宋_GB2312';
                        target.style.fontSize = '16px';
                        target.style.textAlign = 'left';
                        target.style.textIndent = '0';
                        target.style.margin = '0';
                        target.removeAttribute('data-outline-level');
                        var _subManuals = target.querySelectorAll('[data-manual="1"],[data-manual-span="1"]');
                        for (var si = 0; si < _subManuals.length; si++) { _subManuals[si].removeAttribute('data-manual'); _subManuals[si].removeAttribute('data-manual-span'); }
                        _npMarkManualPara(target);
                        _npMarkManualPara(target);
                        break;
                    }
                }
            }
            if (!_npCommitFormat(editor, _bkPara)) return;
            _refreshOutlineIfOpen();
        }

        var _npLastFormat = null;
        function _npLevelLabel(level) {
            var m = { 'level-index':'索引标题', 'level-title':'文章标题', 'level-date':'作者/日期', 'level-recipient':'主送单位', 'level-1':'一级标题', 'level-2':'二级标题', 'level-3':'三级标题', 'level-body':'正文', 'level-remark':'注释', 'level-secret':'密级/附件', 'level-attachment':'附件' };
            return m[level] || '格式';
        }
        function _npSetLastFormat(label, repeatFn) {
            if (typeof label === 'string' && typeof repeatFn === 'function') _npLastFormat = { label: label, repeatFn: repeatFn };
        }
        function _npGetLastFormatLabel() { return _npLastFormat && _npLastFormat.label ? _npLastFormat.label : ''; }
        function _npRepeatLastFormat() {
            if (!_npLastFormat || typeof _npLastFormat.repeatFn !== 'function') {
                if (typeof showToast === 'function') showToast('暂无可重复的格式操作');
                return false;
            }
            _npLastFormat.repeatFn();
            if (typeof showToast === 'function') showToast('已重复：' + _npLastFormat.label);
            return true;
        }
        function applyNotepadLevel(level) {
            _npSetLastFormat(_npLevelLabel(level), function() { applyNotepadLevel(level); });
            var editor = document.getElementById('notepadEditor');
            _notepadRestoreSelection();
            var sel = window.getSelection();
            if (!sel.rangeCount) { editor.focus(); sel = window.getSelection(); if (!sel.rangeCount) return; }
            var range = sel.getRangeAt(0);
            var hasSel = !range.collapsed;
            // 层级格式会改写段内 HTML，先备份全文，结束后比对字数
            var _bkNpLevel = _npBackupBeforeFormat(editor, '层级格式-' + _npLevelLabel(level));
            // 记录本次操作涉及的段落，保存前统一补齐首行缩进，避免格式设置后缩进丢失
            var _npFmtTargetParas = [];
            var _npRecipientDemoted = 0;
            try {
                var _npAllParas = editor.querySelectorAll('p');
                if (hasSel && range.intersectsNode) {
                    for (var _nptp = 0; _nptp < _npAllParas.length; _nptp++) {
                        if (range.intersectsNode(_npAllParas[_nptp])) _npFmtTargetParas.push(_npAllParas[_nptp]);
                    }
                } else {
                    var _npCur = _npGetContainingP(range.startContainer);
                    if (_npCur) _npFmtTargetParas.push(_npCur);
                }
            } catch (_npFmtErr) { _npFmtTargetParas = []; }
            // 判断某段是否被选区整段覆盖（首尾空白不计），用于决定是否套用段落格式
            function _npRangeCoversPara(rng, p) {
                try {
                    var before = document.createRange();
                    before.selectNodeContents(p);
                    before.setEnd(rng.startContainer, rng.startOffset);
                    var after = document.createRange();
                    after.selectNodeContents(p);
                    after.setStart(rng.endContainer, rng.endOffset);
                    return before.toString().trim().length === 0 &&
                           after.toString().trim().length === 0;
                } catch (e) { return false; }
            }
            function _npGetContainingP(node) {
                var directDiv = null;
                var cur = node;
                while (cur && cur !== editor) {
                    if (cur.nodeName === 'P') return cur;
                    if (cur.parentNode === editor && cur.nodeName === 'DIV' && !directDiv) directDiv = cur;
                    cur = cur.parentNode;
                }
                return directDiv;
            }
            // 层级 -> 大纲级别（data-outline-level）。只有索引标题是一级。
            function _outlineLevelFor(lv) {
                if (lv === 'level-index') return '1';
                if (lv === 'level-title') return null;
                if (lv === 'level-1') return '2';
                if (lv === 'level-2') return '3';
                return null;
            }
            // 整段设置：段落格式（字体/字号/对齐/缩进）+ 文字格式 + 大纲级别
            function _applyFullPara(p, lv) {
                var txt = p.textContent;
                if (lv === 'level-recipient' && _npRecipientTextHasComma(txt)) {
                    lv = 'level-body';
                    _npRecipientDemoted++;
                }
                if (lv === 'level-attachment') {
                    var atText = txt.replace(/^\s+|\s+$/g, '');
                    p.setAttribute('data-attachment-style', /^附件[：:]\s*1[.．、]/.test(atText) ? 'prefix' : 'item');
                } else {
                    p.removeAttribute('data-attachment-style');
                }
                _setParagraphFormat(p, lv);
                var ol = _outlineLevelFor(lv);
                if (ol) p.setAttribute('data-outline-level', ol);
                else p.removeAttribute('data-outline-level');
                if (lv === 'level-index') p.setAttribute('data-np-index', '1');
                else p.removeAttribute('data-np-index');
                if (lv === 'level-title') p.setAttribute('data-level', 'title');
                else if (lv === 'level-date') p.setAttribute('data-level', 'date');
                else if (lv === 'level-author') p.setAttribute('data-level', 'author');
                else if (lv === 'level-secret') p.setAttribute('data-level', 'secret');
                else if (lv === 'level-attachment') p.setAttribute('data-level', 'attachment');
                else if (lv === 'level-recipient') p.setAttribute('data-level', 'recipient');
                else p.removeAttribute('data-level');
                var hi = FORMAT_STANDARD.inlineStyle(lv);
                p.innerHTML = '<span style="' + hi + '">' + escapeHtml(txt) + '</span>';
                _npMarkManualPara(p);
                // 重写 innerHTML 后再补一次缩进，确保正文首行缩进 2 字符稳定生效
                _npApplyLevelIndent(p, lv);
            }
            // 仅文字格式（字体/字号/粗细）：不动段落格式、不拆段、不断行
            function _applyInlineOnly(rng) {
                var frag = rng.extractContents();
                var tmp = document.createElement('div');
                tmp.appendChild(frag);
                _npCleanPropInNode(tmp, 'fontFamily', ['FONT']);
                _npCleanPropInNode(tmp, 'fontSize', []);
                if (level === 'level-3') _npCleanPropInNode(tmp, 'fontWeight', ['B', 'STRONG']);
                var inlineCss = FORMAT_STANDARD.inlineStyle(level);
                _npWrapTextNodesInFragment(tmp, function () {
                    var w = document.createElement('span');
                    w.setAttribute('style', inlineCss);
                    w.setAttribute('data-manual-span', '1');
                    if (level) w.setAttribute('data-manual-level', level);
                    return w;
                });
                var _ofrag = document.createDocumentFragment();
                while (tmp.firstChild) _ofrag.appendChild(tmp.firstChild);
                rng.insertNode(_ofrag);
                rng.collapse(false);
            }
            if (hasSel) {
                var sP = _npGetContainingP(range.startContainer);
                var eP = _npGetContainingP(range.endContainer);
                if (sP && eP && sP === eP) {
                    // 单段选取
                    var beforeRange = document.createRange();
                    beforeRange.selectNodeContents(sP);
                    beforeRange.setEnd(range.startContainer, range.startOffset);
                    var beforeText = beforeRange.toString();
                    var afterRange = document.createRange();
                    afterRange.selectNodeContents(sP);
                    afterRange.setStart(range.endContainer, range.endOffset);
                    var afterText = afterRange.toString();
                    var isWholePara = beforeText.trim().length === 0 && afterText.trim().length === 0;
                    if (isWholePara) {
                        // 选取整段：设置段落+文字格式
                        _applyFullPara(sP, level);
                    } else {
                        // 段内部分选取：仅文字格式，不拆段
                        _applyInlineOnly(range);
                        _npMarkManualPara(sP);
                    }
                } else {
                    // 跨段选取：先找出被整段选中的段落（必须在改写 DOM 之前判断），
                    // 这些段直接套用完整段落+文字格式；首尾只被部分选中的段沿用文字格式。
                    var allParas = editor.querySelectorAll('p');
                    var inRangeParas = [];
                    for (var i = 0; i < allParas.length; i++) {
                        if (range.intersectsNode && range.intersectsNode(allParas[i])) inRangeParas.push(allParas[i]);
                    }
                    var wholeParas = [];
                    var partialParas = [];
                    for (var wi = 0; wi < inRangeParas.length; wi++) {
                        if (_npRangeCoversPara(range, inRangeParas[wi])) wholeParas.push(inRangeParas[wi]);
                        else partialParas.push(inRangeParas[wi]);
                    }
                    // 先处理部分选中的段落（只改文字格式，会改动 DOM）
                    if (partialParas.length) {
                        var partRange = range.cloneRange();
                        _applyInlineOnly(partRange);
                        for (var pj = 0; pj < partialParas.length; pj++) _npMarkManualPara(partialParas[pj]);
                    }
                    // 再对整段选中的段落套完整格式（整段重写 innerHTML，不依赖原 range）
                    for (var wj = 0; wj < wholeParas.length; wj++) _applyFullPara(wholeParas[wj], level);
                }
            } else {
                // 无选取：对光标所在整段设置段落+文字格式
                var curP = _npGetContainingP(sel.anchorNode);
                if (curP) _applyFullPara(curP, level);
            }
            _npNormalizeOutlineMarkers(editor);
            _refreshNotepadArticleSeparators(editor);
            // 保存前统一补齐缩进：段落层级决定缩进值，避免内联样式覆盖导致缩进丢失
            for (var _npri = 0; _npri < _npFmtTargetParas.length; _npri++) {
                var _nprp = _npFmtTargetParas[_npri];
                if (!_nprp || !editor.contains(_nprp)) continue;
                var _nprl = _nprp.getAttribute('data-level') || '';
                var _nprIndent = '2em';
                if (_nprl === 'title' || _nprl === 'recipient' || _nprl === 'secret') _nprIndent = '0';
                else if (_nprp.getAttribute('data-outline-level') === '1') _nprIndent = '0';
                else if (_nprp.getAttribute('data-attachment-style') === 'item') _nprIndent = '-1em';
                else if (_nprp.style.textAlign === 'center') _nprIndent = '0';
                else if (level === 'level-title' || level === 'level-secret' || level === 'level-index') _nprIndent = '0';
                else if (level === 'level-body' || level === 'level-1' || level === 'level-2' || level === 'level-3' || level === 'level-attachment') _nprIndent = '2em';
                _npEnsureParaIndent(_nprp, _nprIndent);
            }
            if (_npRecipientDemoted && typeof showToast === 'function') {
                showToast('主送单位含逗号，已按正文格式处理');
            }
            if (!_npCommitFormat(editor, _bkNpLevel)) return;
            saveCurrentEditor();
            _refreshOutlineIfOpen();
            if (typeof window._npRefreshOutlinePage === 'function') window._npRefreshOutlinePage();
            if (_autoFormatEnabled) _applyLiveFormat();
        }

        function updateNotepadIndexTitle() {
            if (typeof window._npUpdateIndexTitleImpl === 'function') {
                window._npUpdateIndexTitleImpl();
            }
        }

// ---- 笔记替换 ----
    var _npReplaceColors = ['#fff176', '#64b5f6', '#ef5350', '#81c784', '#ce93d8', '#ffb74d', '#4db6ac', '#f06292'];
    var _npReplaceCtxRange = null;
    var _npReplaceOccurrences = [];
    var _npReplaceExecuted = false;
    var _npReplaceReplaced = [];
    var _npReplaceActiveRow = -1;
    var _npReplaceRefreshTimer = null;
    function _npReplaceBoxEl() { return document.querySelector('#notepadReplaceModal .npReplaceBox'); }
    function _npReplaceEsc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function _npReplaceIsWild(ch) { return ch === 'X' || ch === 'x' || ch === '*' || ch === '-' || ch === '×'; }
    function _npReplaceParse(str) {
        var segs = [], cur = '';
        for (var i = 0; i < str.length; i++) {
            if (_npReplaceIsWild(str.charAt(i))) { segs.push(cur); cur = ''; }
            else cur += str.charAt(i);
        }
        segs.push(cur);
        return { segs: segs, wc: segs.length - 1 };
    }
    function _npReplaceRegex(segs, wc) {
        var esc = function(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
        if (wc <= 0) return new RegExp(esc(segs[0]), 'g');
        var parts = [];
        for (var i = 0; i < segs.length; i++) {
            parts.push(esc(segs[i]));
            if (i < segs.length - 1) parts.push('([\\s\\S]*?)');
        }
        return new RegExp(parts.join(''), 'g');
    }
    function _npReplaceRenderReplace(replaceStr, groups) {
        var p = _npReplaceParse(replaceStr);
        if (p.wc <= 0) return p.segs[0];
        var out = '';
        for (var i = 0; i < p.segs.length; i++) {
            out += p.segs[i];
            if (i < groups.length) out += (groups[i] == null ? '' : groups[i]);
        }
        return out;
    }
    function _npReplaceCenterBox() {
        var box = _npReplaceBoxEl();
        if (!box) return;
        var w = box.offsetWidth || 460, h = box.offsetHeight || 300;
        var left = Math.max(8, Math.round((window.innerWidth - w) / 2));
        var top = Math.max(8, Math.round((window.innerHeight - h) / 3));
        box.style.left = left + 'px';
        box.style.top = top + 'px';
    }
    function _npReplaceApplyDefaultLayout() {
        var box = _npReplaceBoxEl();
        if (!box) return;
        var src = null;
        if (_materialMode) src = document.getElementById('materialAssistPanel');
        else if (_writeNoteMode) src = document.getElementById('notepadOutlineModalContent');
        var sr = src ? src.getBoundingClientRect() : null;
        var vis = !!(src && sr && sr.width > 0 && sr.height > 0 && getComputedStyle(src).display !== 'none');
        if (vis) {
            var r = sr;
            box.style.maxHeight = 'none';
            box.style.width = Math.round(r.width) + 'px';
            box.style.height = Math.round(r.height) + 'px';
            box.style.left = Math.round(r.left) + 'px';
            box.style.top = Math.round(r.top) + 'px';
        } else {
            box.style.maxHeight = '88vh';
            box.style.width = '380px';
            box.style.height = '540px';
            _npReplaceCenterBox();
        }
    }
    function _npReplaceSetupHint() {
        var hint = document.getElementById('npReplaceHint');
        var txt = document.getElementById('npReplaceHintText');
        if (!hint || !txt) return;
        hint.classList.remove('marquee');
        txt.style.removeProperty('--npHintShift');
        void hint.offsetWidth;
        var overflow = txt.scrollWidth - hint.clientWidth;
        if (overflow > 2) {
            txt.style.setProperty('--npHintShift', (-(overflow + 16)) + 'px');
            txt.style.animationDuration = Math.max(4, Math.round(overflow / 45)) + 's';
            hint.classList.add('marquee');
        }
    }
    function _npReplaceMoveToLeft() {
        var box = _npReplaceBoxEl();
        if (!box) return;
        var leftEdge = 8;
        try {
            var wr = _npWorkScreenRects();
            if (wr && wr.left) leftEdge = wr.left.left;
        } catch (e) {}
        var h = box.offsetHeight || 300;
        var top = box.offsetTop || 60;
        top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
        if (top < 8) top = 8;
        box.style.left = Math.max(4, Math.round(leftEdge)) + 'px';
        box.style.top = Math.round(top) + 'px';
    }
    function _npReplaceEnsureBind() {
        var box = _npReplaceBoxEl();
        if (!box || box.dataset.npBound === '1') return;
        box.dataset.npBound = '1';
        var head = box.querySelector('.npReplaceHead');
        if (head) {
            head.addEventListener('mousedown', function(e) {
                if (e.target && e.target.tagName === 'BUTTON') return;
                e.preventDefault();
                var sx = e.clientX, sy = e.clientY;
                var ox = box.offsetLeft, oy = box.offsetTop;
                function mv(ev) {
                    var nx = Math.max(0, Math.min(ox + (ev.clientX - sx), window.innerWidth - 40));
                    var ny = Math.max(0, Math.min(oy + (ev.clientY - sy), window.innerHeight - 30));
                    box.style.left = nx + 'px';
                    box.style.top = ny + 'px';
                }
                function up() {
                    document.removeEventListener('mousemove', mv);
                    document.removeEventListener('mouseup', up);
                }
                document.addEventListener('mousemove', mv);
                document.addEventListener('mouseup', up);
            });
        }
        var res = document.getElementById('npReplaceResult');
        if (res) {
            res.addEventListener('click', function(e) {
                var del = e.target.closest ? e.target.closest('.npReplaceResultDel') : null;
                if (del) {
                    e.preventDefault();
                    _npReplaceRemoveOcc(parseInt(del.getAttribute('data-nprow'), 10), parseInt(del.getAttribute('data-npocc'), 10));
                    return;
                }
                var line = e.target.closest ? e.target.closest('.npReplaceOccLine') : null;
                if (line) {
                    e.preventDefault();
                    _npReplaceJumpTo(parseInt(line.getAttribute('data-nprow'), 10), parseInt(line.getAttribute('data-npocc'), 10));
                    return;
                }
                var a = e.target.closest ? e.target.closest('.npReplaceResultLink') : null;
                if (a) {
                    e.preventDefault();
                    _npReplaceJumpTo(parseInt(a.getAttribute('data-nprow'), 10), parseInt(a.getAttribute('data-npocc'), 10));
                }
            });
            res.addEventListener('contextmenu', function(e) {
                var line = e.target.closest ? e.target.closest('.npReplaceOccLine') : null;
                if (!line) return;
                e.preventDefault();
                _npShowOccMenu(parseInt(line.getAttribute('data-nprow'), 10), parseInt(line.getAttribute('data-npocc'), 10), e.clientX, e.clientY);
            });
        }
        var occMenu = document.getElementById('npReplaceOccMenu');
        if (occMenu && occMenu.dataset.npBound !== '1') {
            occMenu.dataset.npBound = '1';
            occMenu.addEventListener('click', function(e) {
                var item = e.target.closest ? e.target.closest('.npReplaceOccMenuItem') : null;
                if (!item) return;
                e.preventDefault();
                _npReplaceApplyOccMenu();
            });
            document.addEventListener('click', function(e) {
                var m = document.getElementById('npReplaceOccMenu');
                if (m && m.classList.contains('show') && !e.target.closest('#npReplaceOccMenu')) _npHideOccMenu();
            });
        }
        var scopeRadios = document.querySelectorAll('input[name="npReplaceScope"]');
        for (var si = 0; si < scopeRadios.length; si++) {
            scopeRadios[si].addEventListener('change', function() { _npReplaceScheduleRefresh(); });
        }
    }
    var _npOccMenuTarget = null;
    function _npShowOccMenu(rowIdx, occIdx, x, y) {
        var rowEls = document.getElementById('npReplaceRows');
        var row = rowEls ? rowEls.querySelectorAll('.npReplaceRow')[rowIdx] : null;
        var occ = row ? (row.__occs || [])[occIdx] : null;
        if (!occ) return;
        _npOccMenuTarget = { rowIdx: rowIdx, occIdx: occIdx };
        var menu = document.getElementById('npReplaceOccMenu');
        if (!menu) return;
        var item = menu.querySelector('.npReplaceOccMenuItem');
        if (item) item.textContent = occ.replaced ? '撤销替换' : '替换';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.add('show');
    }
    function _npHideOccMenu() {
        var menu = document.getElementById('npReplaceOccMenu');
        if (menu) menu.classList.remove('show');
        _npOccMenuTarget = null;
    }
    function _npReplaceApplyOccMenu() {
        if (!_npOccMenuTarget) return;
        var t = _npOccMenuTarget;
        _npHideOccMenu();
        var rowEls = document.getElementById('npReplaceRows');
        var row = rowEls ? rowEls.querySelectorAll('.npReplaceRow')[t.rowIdx] : null;
        var occ = row ? (row.__occs || [])[t.occIdx] : null;
        if (!occ) return;
        if (occ.replaced) _npReplaceUndoSingle(t.rowIdx, occ);
        else _npReplaceSingleOcc(t.rowIdx, occ);
        _npReplaceRenderList(t.rowIdx);
    }
    function _npReplaceOccParentP(occ) {
        var sp = occ.spans[0];
        var n = sp;
        while (n && n.tagName !== 'P') n = n.parentElement;
        return n || null;
    }
    function _npReplaceSingleOcc(rowIdx, occ) {
        var rowsWrap = document.getElementById('npReplaceRows');
        var row = rowsWrap ? rowsWrap.querySelectorAll('.npReplaceRow')[rowIdx] : null;
        if (!row || !occ.spans.length || !occ.spans[0].parentNode) return;
        var rv = row.querySelector('.npReplaceReplace');
        var newText = _npReplaceRenderReplace(rv ? rv.value : '', occ.groups);
        var first = occ.spans[0], last = occ.spans[occ.spans.length - 1];
        var range = document.createRange();
        range.setStartBefore(first); range.setEndAfter(last);
        range.deleteContents();
        var span = document.createElement('span');
        span.className = occ.cls;
        span.textContent = newText;
        range.insertNode(span);
        occ.newText = newText;
        occ.spans = [span];
        occ.replaced = true;
        occ.sentKw = newText;
        _npReplaceRefreshOccSentence(occ);
        if (_npReplaceReplaced.indexOf(occ) < 0) _npReplaceReplaced.push(occ);
        _npReplaceExecuted = true;
        if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    }
    function _npReplaceUndoSingle(rowIdx, occ) {
        if (!occ.spans.length || !occ.spans[0].parentNode) return;
        var sp = occ.spans[0];
        var ns = document.createElement('span');
        ns.className = occ.cls;
        ns.textContent = occ.originalText;
        sp.parentNode.replaceChild(ns, sp);
        occ.spans = [ns];
        occ.replaced = false;
        occ.newText = '';
        occ.sentKw = occ.originalText;
        var idx = _npReplaceReplaced.indexOf(occ);
        if (idx >= 0) _npReplaceReplaced.splice(idx, 1);
        _npReplaceExecuted = _npReplaceReplaced.length > 0;
        if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    }
    function npReplaceClear() {
        var rowsWrap = document.getElementById('npReplaceRows');
        if (rowsWrap) {
            var rowEls = rowsWrap.querySelectorAll('.npReplaceRow');
            for (var i = 0; i < rowEls.length; i++) {
                var f = rowEls[i].querySelector('.npReplaceFind'); if (f) f.value = '';
                var rv = rowEls[i].querySelector('.npReplaceReplace'); if (rv) rv.value = '';
                var b = rowEls[i].querySelector('.npReplaceCountBadge');
                if (b) { b.textContent = '0'; b.classList.remove('show'); }
                rowEls[i].__occs = [];
            }
        }
        _npHideOccMenu();
        _npClearReplaceHighlights();
        _npReplaceActiveRow = -1;
        _npReplaceClearResult();
        _npReplaceExecuted = false;
        _npReplaceReplaced = [];
        if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
    }
    function _npReplaceClearResult() {
        var res = document.getElementById('npReplaceResult');
        if (res) { res.innerHTML = ''; res.style.display = 'none'; }
        _npReplaceOccurrences = [];
    }
    function _npReplaceScheduleRefresh() {
        if (_npReplaceRefreshTimer) clearTimeout(_npReplaceRefreshTimer);
        _npReplaceRefreshTimer = setTimeout(function() { _npReplaceRefreshTimer = null; _npReplaceRefreshAll(); }, 220);
    }
    function _npReplaceUnwrapSpans(spans) {
        if (!spans) return;
        for (var i = 0; i < spans.length; i++) {
            var sp = spans[i];
            if (sp && sp.parentNode) {
                var parent = sp.parentNode;
                while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
                parent.removeChild(sp);
            }
        }
    }
    function _npReplaceBuildOriginal(frag, occ, pat) {
        for (var i = 0; i < pat.segs.length; i++) {
            if (pat.segs[i]) {
                var s = document.createElement('span');
                s.className = occ.cls;
                s.textContent = pat.segs[i];
                frag.appendChild(s);
                occ.spans.push(s);
            }
            if (i < occ.groups.length && occ.groups[i]) frag.appendChild(document.createTextNode(occ.groups[i]));
        }
    }
    function _npReplaceScanTextNode(tn, re, rowIdx, pat, cls, occs) {
        var text = tn.nodeValue || '';
        if (!text) return;
        re.lastIndex = 0;
        var m, matches = [];
        while ((m = re.exec(text)) !== null) {
            if (m[0].length === 0) { re.lastIndex++; continue; }
            matches.push(m);
        }
        if (!matches.length) return;
        var frag = document.createDocumentFragment();
        var last = 0;
        for (var i = 0; i < matches.length; i++) {
            var mm = matches[i];
            if (mm.index > last) frag.appendChild(document.createTextNode(text.slice(last, mm.index)));
            var occ = { rowIdx: rowIdx, cls: cls, find: mm[0], groups: mm.slice(1), spans: [], replaced: false, originalText: mm[0], newText: '', pat: pat, sentBefore: '', sentKw: mm[0], sentAfter: '' };
            _npReplaceBuildOriginal(frag, occ, pat);
            occs.push(occ);
            last = mm.index + mm[0].length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        if (tn.parentNode) tn.parentNode.replaceChild(frag, tn);
    }
    function _npReplaceOccOffsets(p, occ) {
        try {
            var r1 = document.createRange();
            r1.setStart(p, 0); r1.setEndBefore(occ.spans[0]);
            var start = r1.toString().length;
            var r2 = document.createRange();
            r2.setStart(p, 0); r2.setEndAfter(occ.spans[occ.spans.length - 1]);
            var end = r2.toString().length;
            return { start: start, end: end };
        } catch (e) { return null; }
    }
    function _npReplaceSentence(p, occ) {
        var off = _npReplaceOccOffsets(p, occ);
        if (!off) return;
        var text = p.textContent || '';
        var bounds = '，。…；：\n';
        var s = off.start;
        while (s > 0 && bounds.indexOf(text.charAt(s - 1)) < 0) s--;
        var e = off.end;
        while (e < text.length && bounds.indexOf(text.charAt(e)) < 0) e++;
        if (e < text.length && text.charAt(e) !== '\n') e++;
        occ.sentBefore = text.slice(s, off.start);
        occ.sentKw = text.slice(off.start, off.end);
        occ.sentAfter = text.slice(off.end, e);
    }
    function _npReplaceScanParagraph(p, re, rowIdx, pat, cls, occs) {
        var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
        var nodes = [], n;
        while ((n = walker.nextNode())) nodes.push(n);
        for (var i = 0; i < nodes.length; i++) _npReplaceScanTextNode(nodes[i], re, rowIdx, pat, cls, occs);
    }
    function _npReplaceRefreshAll() {
        _npReplaceExecuted = false;
        _npReplaceReplaced = [];
        _npClearReplaceHighlights();
        _npReplaceOccurrences = [];
        var rowsWrap = document.getElementById('npReplaceRows');
        if (!rowsWrap) return;
        var rowEls = rowsWrap.querySelectorAll('.npReplaceRow');
        var scopeEl = document.querySelector('input[name="npReplaceScope"]:checked');
        var scope = scopeEl ? scopeEl.value : 'current';
        var ps = _npReplaceScopeParagraphs(scope);
        for (var r = 0; r < rowEls.length; r++) {
            var f = rowEls[r].querySelector('.npReplaceFind');
            var find = f ? f.value : '';
            rowEls[r].__occs = [];
            var badge = rowEls[r].querySelector('.npReplaceCountBadge');
            if (!find || !ps.length) { if (badge) badge.classList.remove('show'); continue; }
            var pat = _npReplaceParse(find);
            var re = _npReplaceRegex(pat.segs, pat.wc);
            var cls = 'npReplaceHL' + (r % 8);
            var occs = rowEls[r].__occs;
            for (var pi = 0; pi < ps.length; pi++) {
                var before = occs.length;
                _npReplaceScanParagraph(ps[pi], re, r, pat, cls, occs);
                for (var ni = before; ni < occs.length; ni++) _npReplaceSentence(ps[pi], occs[ni]);
            }
            if (badge) {
                badge.textContent = occs.length;
                if (occs.length > 0) badge.classList.add('show'); else badge.classList.remove('show');
            }
        }
        if (_npReplaceActiveRow >= 0) _npReplaceRenderList(_npReplaceActiveRow);
        else _npReplaceClearResult();
    }
    function _npReplaceToggleRowList(row) {
        var rows = document.getElementById('npReplaceRows');
        if (!rows) return;
        var rowEls = Array.prototype.slice.call(rows.querySelectorAll('.npReplaceRow'));
        var idx = rowEls.indexOf(row);
        if (idx < 0) return;
        if (_npReplaceActiveRow === idx) {
            _npReplaceActiveRow = -1;
            _npReplaceClearResult();
        } else {
            _npReplaceActiveRow = idx;
            _npReplaceRenderList(idx);
        }
    }
    function _npReplaceRenderList(rowIdx) {
        var res = document.getElementById('npReplaceResult');
        if (!res) return;
        var rowsWrap = document.getElementById('npReplaceRows');
        var rowEls = rowsWrap ? rowsWrap.querySelectorAll('.npReplaceRow') : [];
        var row = rowEls[rowIdx];
        if (!row) { res.innerHTML = ''; res.style.display = 'none'; return; }
        var occs = row.__occs || [];
        var html = '<div class="npReplaceResultTotal">第' + (rowIdx + 1) + '组 命中 ' + occs.length + ' 处（左键跳转，右键替换/撤销，点 × 取消该处高亮）</div>';
        if (!occs.length) html += '<div class="npReplaceResultEmpty">未找到匹配内容。</div>';
        else {
            html += '<div class="npReplaceResultSentList">';
            for (var i = 0; i < occs.length; i++) {
                var occ = occs[i];
                var kwCls = occ.replaced ? 'npReplaceSentKwReplaced' : 'npReplaceSentKw';
                html += '<div class="npReplaceOccLine" data-nprow="' + rowIdx + '" data-npocc="' + i + '">' +
                    '<span class="npReplaceOccSent">' + _npReplaceEsc(occ.sentBefore) +
                    '<span class="' + kwCls + '">' + _npReplaceEsc(occ.sentKw) + '</span>' +
                    _npReplaceEsc(occ.sentAfter) + '</span>' +
                    '<button type="button" class="npReplaceResultDel" data-nprow="' + rowIdx + '" data-npocc="' + i + '" title="取消该处高亮">×</button></div>';
            }
            html += '</div>';
        }
        res.innerHTML = html;
        res.style.display = 'block';
    }
    function _npReplaceJumpTo(rowIdx, occIdx) {
        var rowsWrap = document.getElementById('npReplaceRows');
        var rowEls = rowsWrap ? rowsWrap.querySelectorAll('.npReplaceRow') : [];
        var row = rowEls[rowIdx];
        if (!row) return;
        var occ = (row.__occs || [])[occIdx];
        if (!occ || !occ.spans.length || !occ.spans[0].parentNode) return;
        var target = occ.spans[0];
        try { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        catch (e) { try { target.scrollIntoView(); } catch (e2) {} }
        for (var i = 0; i < occ.spans.length; i++) {
            (function(sp) {
                sp.classList.add('npReplaceFlash');
                setTimeout(function() { sp.classList.remove('npReplaceFlash'); }, 1400);
            })(occ.spans[i]);
        }
    }
    function _npReplaceRemoveOcc(rowIdx, occIdx) {
        var rowsWrap = document.getElementById('npReplaceRows');
        var rowEls = rowsWrap ? rowsWrap.querySelectorAll('.npReplaceRow') : [];
        var row = rowEls[rowIdx];
        if (!row) return;
        var occs = row.__occs || [];
        var occ = occs[occIdx];
        if (!occ) return;
        _npReplaceUnwrapSpans(occ.spans);
        occs.splice(occIdx, 1);
        var badge = row.querySelector('.npReplaceCountBadge');
        if (badge) {
            badge.textContent = occs.length;
            if (occs.length > 0) badge.classList.add('show'); else badge.classList.remove('show');
        }
        _npReplaceRenderList(rowIdx);
    }
    function npOpenReplaceDialog(ctxRange) {
        _npReplaceCtxRange = ctxRange || null;
        _npReplaceExecuted = false;
        _npReplaceReplaced = [];
        _npReplaceActiveRow = -1;
        _npReplaceClearResult();
        _npClearReplaceHighlights();
        window._npReplaceActive = true;
        var rows = document.getElementById('npReplaceRows');
        if (rows) {
            rows.innerHTML = '';
            for (var i = 0; i < 5; i++) npReplaceAddRow();
        }
        var modal = document.getElementById('notepadReplaceModal');
        if (modal) modal.classList.add('show');
        _npReplaceEnsureBind();
        _npReplaceApplyDefaultLayout();
        _npReplaceSetupHint();
        var first = rows ? rows.querySelector('.npReplaceFind') : null;
        if (first) setTimeout(function() { try { first.focus(); } catch (e) {} }, 30);
    }
    function npReplaceAddRow() {
        var rows = document.getElementById('npReplaceRows');
        if (!rows) return;
        var row = document.createElement('div');
        row.className = 'npReplaceRow';
        row.__occs = [];
        var wrap = document.createElement('div');
        wrap.className = 'npReplaceFindWrap';
        var find = document.createElement('input');
        find.type = 'text'; find.className = 'npReplaceFind';
        var badge = document.createElement('button');
        badge.type = 'button'; badge.className = 'npReplaceCountBadge'; badge.title = '点击查看/取消高亮'; badge.textContent = '0';
        wrap.appendChild(find); wrap.appendChild(badge);
        var sep = document.createElement('span');
        sep.className = 'npReplaceRowSep'; sep.textContent = '替换为';
        var rep = document.createElement('input');
        rep.type = 'text'; rep.className = 'npReplaceReplace';
        var del = document.createElement('button');
        del.type = 'button'; del.className = 'npReplaceRowDel'; del.title = '删除本组'; del.textContent = '×';
        del.onclick = function() { if (row.parentNode) { row.parentNode.removeChild(row); _npReplaceRefreshAll(); } };
        find.addEventListener('input', function() { _npReplaceScheduleRefresh(); });
        badge.onclick = function() { _npReplaceToggleRowList(row); };
        row.appendChild(wrap); row.appendChild(sep); row.appendChild(rep); row.appendChild(del);
        rows.appendChild(row);
    }
    function _npReplaceScopeParagraphs(scope) {
        var editor = document.getElementById('notepadEditor');
        if (!editor) return [];
        var ps = Array.prototype.slice.call(editor.querySelectorAll('p'));
        if (scope !== 'current') return ps;
        var anchor = null;
        var r = _npReplaceCtxRange;
        if (!r) {
            var s = window.getSelection();
            if (s && s.rangeCount > 0) r = s.getRangeAt(0);
        }
        if (r && r.startContainer && editor.contains(r.startContainer)) {
            var n = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer;
            while (n && n !== editor && n.tagName !== 'P') n = n.parentElement;
            if (n && n !== editor) anchor = n;
        }
        if (!anchor) return ps;
        var ai = ps.indexOf(anchor);
        if (ai < 0) return ps;
        var start = 0;
        for (var j = ai; j >= 0; j--) {
            if (ps[j].getAttribute('data-outline-level') === '1') { start = j; break; }
        }
        var allPs = editor.querySelectorAll('p');
        var end = _npArticleEndIndex(allPs, start);
        return ps.slice(start, end);
    }
    function _npClearReplaceHighlights() {
        var editor = document.getElementById('notepadEditor');
        if (!editor) return;
        var guard = 0, sp;
        while ((sp = editor.querySelector('span[class*="npReplaceHL"]')) && guard++ < 200000) {
            var t = document.createTextNode(sp.textContent || '');
            if (sp.parentNode) sp.parentNode.replaceChild(t, sp);
        }
        try { editor.normalize(); } catch (e) {}
    }
    function npReplaceHide(save) {
        _npClearReplaceHighlights();
        _npReplaceClearResult();
        var modal = document.getElementById('notepadReplaceModal');
        if (modal) modal.classList.remove('show');
        window._npReplaceActive = false;
        _npReplaceActiveRow = -1;
        _npReplaceExecuted = false;
        _npReplaceReplaced = [];
        if (save !== false && typeof saveCurrentEditor === 'function') saveCurrentEditor();
    }
    function npReplaceClose() { npReplaceHide(true); }
    function _npReplaceReverseAll() {
        var list = _npReplaceReplaced.slice().reverse();
        for (var i = 0; i < list.length; i++) {
            var occ = list[i];
            var sp = occ.spans[0];
            if (sp && sp.parentNode) sp.parentNode.replaceChild(document.createTextNode(occ.originalText), sp);
        }
        var editor = document.getElementById('notepadEditor');
        if (editor) { try { editor.normalize(); } catch (e) {} }
        _npReplaceExecuted = false;
        _npReplaceReplaced = [];
    }
    function npReplaceCancel() {
        if (_npReplaceExecuted && _npReplaceReplaced.length) {
            var ok = false;
            try { ok = window.confirm('是否要取消刚才的替换操作？'); } catch (e) { ok = true; }
            if (ok) { _npReplaceReverseAll(); npReplaceHide(true); }
            return;
        }
        npReplaceHide(true);
    }
    function npReplaceRun() {
        var rowsWrap = document.getElementById('npReplaceRows');
        if (!rowsWrap) return;
        var rowEls = rowsWrap.querySelectorAll('.npReplaceRow');
        var anyFind = false;
        for (var i = 0; i < rowEls.length; i++) {
            var f0 = rowEls[i].querySelector('.npReplaceFind');
            if (f0 && f0.value) { anyFind = true; break; }
        }
        if (!anyFind) { showToast('请至少填写一组查找内容'); return; }
        _npReplaceRefreshAll();
        var emptyCount = 0, emptyNames = [];
        for (var eq = 0; eq < rowEls.length; eq++) {
            var qf = rowEls[eq].querySelector('.npReplaceFind');
            var qv = rowEls[eq].querySelector('.npReplaceReplace');
            var qfind = qf ? qf.value : '';
            if (!qfind) continue;
            if (qv && qv.value) continue;
            var qoccs = rowEls[eq].__occs || [];
            if (qoccs.length > 0) { emptyCount += qoccs.length; emptyNames.push('“' + qfind + '”'); }
        }
        if (emptyCount > 0) {
            var okEmpty = false;
            try { okEmpty = window.confirm('替换内容为空，将删掉 ' + emptyCount + ' 处 ' + emptyNames.join('、') + '，是否继续？'); }
            catch (e) { okEmpty = true; }
            if (!okEmpty) return;
        }
        var results = [];
        var total = 0;
        for (var r = 0; r < rowEls.length; r++) {
            var f = rowEls[r].querySelector('.npReplaceFind');
            var rv = rowEls[r].querySelector('.npReplaceReplace');
            var find = f ? f.value : '';
            if (!find) continue;
            var occs = rowEls[r].__occs || [];
            var count = 0;
            for (var oi = 0; oi < occs.length; oi++) {
                var occ = occs[oi];
                if (!occ.spans.length || !occ.spans[0].parentNode) continue;
                var newText = _npReplaceRenderReplace(rv ? rv.value : '', occ.groups);
                var first = occ.spans[0], last = occ.spans[occ.spans.length - 1];
                var range = document.createRange();
                range.setStartBefore(first); range.setEndAfter(last);
                range.deleteContents();
                var span = document.createElement('span');
                span.className = occ.cls;
                span.textContent = newText;
                range.insertNode(span);
                occ.newText = newText;
                occ.spans = [span];
                occ.replaced = true;
                _npReplaceReplaced.push(occ);
                count++;
            }
            if (count > 0) { total += count; results.push({ rowIdx: r, find: find, replace: rv ? rv.value : '', count: count, occs: occs }); }
        }
        _npReplaceExecuted = _npReplaceReplaced.length > 0;
        if (total === 0) showToast('没有可替换的高亮内容');
        if (typeof _scanNotepadDirectoryEntries === 'function') { try { _scanNotepadDirectoryEntries(); } catch (e) {} }
        _npReplaceRenderResults(results, total);
        _npReplaceMoveToLeft();
    }
    function _npReplaceRefreshOccSentence(occ) {
        var p = _npReplaceOccParentP(occ);
        if (p) _npReplaceSentence(p, occ);
    }
    function _npReplaceRenderResults(results, total) {
        var res = document.getElementById('npReplaceResult');
        if (!res) return;
        var html = '<div class="npReplaceResultTotal">共替换 ' + total + ' 处</div>';
        for (var i = 0; i < results.length; i++) {
            var rr = results[i];
            var color = _npReplaceColors[rr.rowIdx % 8];
            html += '<div class="npReplaceResultGroup"><span class="npReplaceResultDot" style="background:' + color + '"></span>第' + (rr.rowIdx + 1) + '组 「' + _npReplaceEsc(rr.find) + '」→「' + _npReplaceEsc(rr.replace || '（删除）') + '」：' + rr.count + ' 处</div>';
            html += '<div class="npReplaceResultSentList">';
            for (var k = 0; k < rr.occs.length; k++) {
                var occ = rr.occs[k];
                if (!occ.replaced) continue;
                _npReplaceRefreshOccSentence(occ);
                html += '<div class="npReplaceOccLine" data-nprow="' + rr.rowIdx + '" data-npocc="' + k + '">' +
                    '<span class="npReplaceOccSent">' + _npReplaceEsc(occ.sentBefore) +
                    '<span class="npReplaceSentKwReplaced">' + _npReplaceEsc(occ.sentKw) + '</span>' +
                    _npReplaceEsc(occ.sentAfter) + '</span></div>';
            }
            html += '</div>';
        }
        if (total === 0) html += '<div class="npReplaceResultEmpty">无内容被替换。</div>';
        res.innerHTML = html;
        res.style.display = 'block';
    }

// ---- Window exports for HTML inline handlers ----
    window.autoFitNotepadHeight = autoFitNotepadHeight;
    window.toggleNotepad = toggleNotepad;
    window.updateFooterTimestamp = updateFooterTimestamp;
    window.updateNotepadWindowModeMenu = updateNotepadWindowModeMenu;
    window.toggleNotepadToolbars = toggleNotepadToolbars;
    window.updateNotepadToolbarScroll = updateNotepadToolbarScroll;
    window.scrollNotepadToolbar = scrollNotepadToolbar;
    window._notepadDirEndBrowse = _notepadDirEndBrowse;
    window._notepadDirSourceRoot = _notepadDirSourceRoot;
    window._notepadDirSetPrompt = _notepadDirSetPrompt;
    window._notepadDirArticleRange = _notepadDirArticleRange;
    window._notepadDirSaveCurrentArticle = _notepadDirSaveCurrentArticle;
    window._notepadDirShowEntry = _notepadDirShowEntry;
    window._notepadDirSelectEntry = _notepadDirSelectEntry;
    window._notepadDirRefreshSelect = _notepadDirRefreshSelect;
    window._notepadDirDelete = _notepadDirDelete;
    window._notepadDirMove = _notepadDirMove;
    window._notepadDirInsertAfter = _notepadDirInsertAfter;
    window._notepadDirRestoreHidden = _notepadDirRestoreHidden;
    window._notepadDirReapplyHide = _notepadDirReapplyHide;
    window._notepadDirShowOnlyArticle = _notepadDirShowOnlyArticle;
    window._refreshOutlineIfOpen = _refreshOutlineIfOpen;
    window.notepadToggleDropdown = notepadToggleDropdown;
    window._notepadRestoreSelection = _notepadRestoreSelection;
    window._markWriteNoteArticleDirty = _markWriteNoteArticleDirty;
    window._clearWriteNoteArticleDirty = _clearWriteNoteArticleDirty;
    window._autoSaveIfDirty = _autoSaveIfDirty;
    window.saveWriteNoteArticle = saveWriteNoteArticle;
    window.syncEditorFromData = syncEditorFromData;
    window._npGetEditorBoundTab = _npGetEditorBoundTab;
    window._npEditorBindCurrentTab = function () { _npEditorBoundTab = currentNotepadTab; };
    window.saveCurrentEditor = saveCurrentEditor;
    window._refreshNotepadArticleSeparators = _refreshNotepadArticleSeparators;
    window._stripNotepadArticleSeparators = _stripNotepadArticleSeparators;
    window._npMarkManual = _npMarkManual;
    window._npMarkManualRange = _npMarkManualRange;
    window._npMarkManualPara = _npMarkManualPara;
    window._npIsManualPara = _npIsManualPara;
    window._npManualLooksArticleTitle = _npManualLooksArticleTitle;
    window._npHasManualSpan = _npHasManualSpan;
    window._npIsWholeParaManual = _npIsWholeParaManual;
    window._npMixedManualParaHtml = _npMixedManualParaHtml;
    window._npManualSkipOuterHTML = _npManualSkipOuterHTML;
    window._npCleanEmptyOutlineMarkers = _npCleanEmptyOutlineMarkers;
    window._splitManualParagraphAt = _splitManualParagraphAt;
    window._npGetEditorSelectionRange = _npGetEditorSelectionRange;
    window._npSetLastFormat = _npSetLastFormat;
    window._npGetLastFormatLabel = _npGetLastFormatLabel;
    window._npRepeatLastFormat = _npRepeatLastFormat;
    window._npCleanPropInNode = _npCleanPropInNode;
    window._npWrapTextNodesInFragment = _npWrapTextNodesInFragment;
    window._npApplyUnifiedFormat = _npApplyUnifiedFormat;
    window._npIsProtectedLiveFormatPara = _npIsProtectedLiveFormatPara;
    window._setParagraphFormat = _setParagraphFormat;
    window._getCharOffset = _getCharOffset;
    window._setCursorAtCharOffset = _setCursorAtCharOffset;
            window._applyLiveFormat = _applyLiveFormat;
    window._npFormatPastedPara = _npFormatPastedPara;
    window._notepadIsBodyParenException = _notepadIsBodyParenException;
    window._npCnMarkAllowed = _npCnMarkAllowed;
    window._formatBodyWithRemarks = _formatBodyWithRemarks;
    window._formatRestBody = _formatRestBody;
    window._plainBodySpan = _plainBodySpan;
    window._formatBodyMaybeRegulationClause = _formatBodyMaybeRegulationClause;
    window._setNotepadAutoFormatEnabled = _setNotepadAutoFormatEnabled;
    window._saveNotepadToCache = _saveNotepadToCache;
    window.cleanEmptyReportData = cleanEmptyReportData;
    window._saveReportToCache = _saveReportToCache;
    window._notepadPositionSearchBox = _notepadPositionSearchBox;
    window.updateNotepadSearchWidth = updateNotepadSearchWidth;
    window._bindNotepadSearchDrag = _bindNotepadSearchDrag;
    window.closeNotepadSearch = closeNotepadSearch;
    window.toggleNotepadSearch = toggleNotepadSearch;
    window.updateNotepadSearchCount = updateNotepadSearchCount;
    window.notepadCollectHighlights = notepadCollectHighlights;
    window.notepadFocusHighlightAt = notepadFocusHighlightAt;
    window.notepadHasMatchInTab = notepadHasMatchInTab;
    window.notepadSwitchToTabWithMatch = notepadSwitchToTabWithMatch;
    window.notepadSearchNext = notepadSearchNext;
    window.notepadSearchPrev = notepadSearchPrev;
    window.notepadStripHighlights = notepadStripHighlights;
    window._notepadExpandAllInHtml = _notepadExpandAllInHtml;
    window._notepadExpandAllTabsForSearch = _notepadExpandAllTabsForSearch;
    window.notepadHighlightTabs = notepadHighlightTabs;
    window.notepadHighlightHtml = notepadHighlightHtml;
    window._updateOutlineBg = _updateOutlineBg;
    window._applyNotepadNotebookStyle = _applyNotepadNotebookStyle;
    window.toggleNotepadNotebookStyle = toggleNotepadNotebookStyle;
    window.updateNotepadTabStyle = updateNotepadTabStyle;
    window.switchNotepadTab = switchNotepadTab;
    window.editNotepadTab = editNotepadTab;
    window.saveNotepadTab = saveNotepadTab;
    window.copyNotepad = copyNotepad;
    window.initCopyButton = initCopyButton;
    window.openNotepad = openNotepad;
    window.loadNotepadFile = loadNotepadFile;
    window.saveNotepad = saveNotepad;
    window.updateNotepadTabs = updateNotepadTabs;
    window._scanNotepadDirectoryEntries = _scanNotepadDirectoryEntries;
    window.refreshNotepadOutlineModal = refreshNotepadOutlineModal;
    window.showNotepadOutlineModal = showNotepadOutlineModal;
    window._toggleArticleCollapse = _toggleArticleCollapse;
    window._updateStructForArticle = _updateStructForArticle;
    window.closeNotepadOutlineModal = closeNotepadOutlineModal;
    window.addNotepadDirEntry = addNotepadDirEntry;
        window.moveNotepadArticle = moveNotepadArticle;
        window.moveArticleToIndex = moveArticleToIndex;
        window.sortNotepadArticlesByDate = sortNotepadArticlesByDate;
        window.deleteNotepadArticle = deleteNotepadArticle;
    window.insertNotepadArticle = insertNotepadArticle;
    window.insertNotepadParagraphAtCursor = insertNotepadParagraphAtCursor;
    window._notepadSetAllArticlesCollapsed = _notepadSetAllArticlesCollapsed;
    window.toggleAllNotepadArticles = toggleAllNotepadArticles;
    window._npOutlineDisplayInfo = _npOutlineDisplayInfo;
    window._npIsRemarkTextNode = _npIsRemarkTextNode;
    window._npIsRemarkOnlyPara = _npIsRemarkOnlyPara;
    window._detectHeadingDisplayLevel = _detectHeadingDisplayLevel;
    window._extractManualHeadingText = _extractManualHeadingText;
    window._npManualNodeHeadingLevel = _npManualNodeHeadingLevel;
    window._npOutlineExtraEntries = _npOutlineExtraEntries;
    window._notepadOutlineRenderStruct = _notepadOutlineRenderStruct;
    window.switchOutlineTab = switchOutlineTab;
    window._renderDirTab = _renderDirTab;
    window.notepadOutlineToggleOrder = notepadOutlineToggleOrder;
    window.notepadOutlineToggleExpand = notepadOutlineToggleExpand;
    window._refreshTilePreviewContent = _refreshTilePreviewContent;
    window._switchStackTab = _switchStackTab;
    window._removeStackSplitDivider = _removeStackSplitDivider;
    window._tileVisibleWindows = _tileVisibleWindows;
    window._tileSaveRatios = _tileSaveRatios;
    window._rebalanceTilePositionsByRatios = _rebalanceTilePositionsByRatios;
    window._applyTileSplit = _applyTileSplit;
    window._applyStackSplit = _applyStackSplit;
    window._syncTileLayoutFromPanel = _syncTileLayoutFromPanel;
    window._setupStackSplitDivider = _setupStackSplitDivider;
    window.setTileMode = setTileMode;
    window._npWinZoomLoad = _npWinZoomLoad;
    window._npWinZoomSave = _npWinZoomSave;
    window._npWinZoomApplyTextarea = _npWinZoomApplyTextarea;
    window._buildTileZoomBar = _buildTileZoomBar;
    window._npWinZoom = _npWinZoom;
    window.toggleCalendar = toggleCalendar;
    window.changeNotepadWidth = changeNotepadWidth;
    window._enterNotepadDockLayer = _enterNotepadDockLayer;
    window._exitNotepadDockLayer = _exitNotepadDockLayer;
    window._dockRect = _dockRect;
    window._syncPanelDefaultBoundsForZoom = _syncPanelDefaultBoundsForZoom;
    window._resetNotepadPanelForTile = _resetNotepadPanelForTile;
    window.showTile = showTile;
    window.rebalanceTilePositions = rebalanceTilePositions;
    window.hideTile = hideTile;
    window.clearNotepad = clearNotepad;
    window.notepadScrollToStart = notepadScrollToStart;
    window.notepadScrollToEnd = notepadScrollToEnd;
    window._notepadArticleHeadings = _notepadArticleHeadings;
    window._notepadScrollToHeading = _notepadScrollToHeading;
    window.notepadScrollToPrevArticle = notepadScrollToPrevArticle;
    window.notepadScrollToNextArticle = notepadScrollToNextArticle;
    window._notepadIsHighlightColor = _notepadIsHighlightColor;
    window._notepadHighlightNodes = _notepadHighlightNodes;
    window._notepadScrollToElement = _notepadScrollToElement;
    window.notepadScrollToPrevHighlight = notepadScrollToPrevHighlight;
    window.notepadScrollToNextHighlight = notepadScrollToNextHighlight;
    window.notepadZoomIn = notepadZoomIn;
    window.notepadZoomOut = notepadZoomOut;
    window.showNotepadEditorZoomBar = showNotepadEditorZoomBar;
    window.hideNotepadEditorZoomBar = hideNotepadEditorZoomBar;
    window.notepadWindowZoomIn = notepadWindowZoomIn;
    window.notepadWindowZoomOut = notepadWindowZoomOut;
    window.fitNotepadToLogArea = fitNotepadToLogArea;
    window._npMainZoom = _npMainZoom;
    window._npCssRect = _npCssRect;
    window._npScreenRect = _npScreenRect;
    window._npIsVisible = _npIsVisible;
    window._npWorkRects = _npWorkRects;
    window._npWorkScreenRects = _npWorkScreenRects;
    window._npSetBox = _npSetBox;
    window._npSetScreenBox = _npSetScreenBox;
    window._npSyncOutlinePanel = _npSyncOutlinePanel;
    window.setNotepadDisplayMode = setNotepadDisplayMode;
    window._applyNotepadDisplayRight = _applyNotepadDisplayRight;
    window._applyNotepadDisplayCenter = _applyNotepadDisplayCenter;
    window._applyNotepadDisplayHighlight = _applyNotepadDisplayHighlight;
    window._refitNotepadIfFullscreen = _refitNotepadIfFullscreen;
    window._materialLayout = _materialLayout;
    window._bindMaterialAssistManualAdjust = _bindMaterialAssistManualAdjust;
    window._materialMirrorApplyViewStyle = _materialMirrorApplyViewStyle;
    window._materialMirrorRefresh = _materialMirrorRefresh;
    window._materialMirrorSync = _materialMirrorSync;
    window._applyMaterialAssistZoom = _applyMaterialAssistZoom;
    window._materialAssistZoomSet = _materialAssistZoomSet;
    window.materialAssistZoomIn = materialAssistZoomIn;
    window.materialAssistZoomOut = materialAssistZoomOut;
    window.materialAssistRefresh = materialAssistRefresh;
    window._materialCurrentArticlePs = _materialCurrentArticlePs;
    window._refreshMaterialOutlineContext = _refreshMaterialOutlineContext;
    window._notepadOutlineBindStructItem = _notepadOutlineBindStructItem;
    window._bindMaterialOutlineListEvents = _bindMaterialOutlineListEvents;
    window._npMaterialInlineWords = _npMaterialInlineWords;
    window._npMatchHeadingAncestry = _npMatchHeadingAncestry;
    window._npMaterialJumpToHeading = _npMaterialJumpToHeading;
    window._npScrollEditorCenter = _npScrollEditorCenter;
    window._materialOutlineCnNum = _materialOutlineCnNum;
    window._materialOutlineSeqStyle = _materialOutlineSeqStyle;
    window._materialOutlineRewriteSeq = _materialOutlineRewriteSeq;
    window._materialOutlineReplaceText = _materialOutlineReplaceText;
    window._materialOutlineEntriesForRenumber = _materialOutlineEntriesForRenumber;
    window._materialOutlineRenumberRange = _materialOutlineRenumberRange;
    window.materialOutlineAutoRenumber = materialOutlineAutoRenumber;
    window._materialOutlineTextPoint = _materialOutlineTextPoint;
    window._materialOutlineInlineEntries = _materialOutlineInlineEntries;
    window._materialOutlineMoveInline = _materialOutlineMoveInline;
    window._materialOutlineSectionEnd = _materialOutlineSectionEnd;
    window._materialOutlineInlineIndex = _materialOutlineInlineIndex;
    window._materialOutlineIsInlineItem = _materialOutlineIsInlineItem;
    window._materialOutlineCutInline = _materialOutlineCutInline;
    window._materialOutlinePasteInlineAfter = _materialOutlinePasteInlineAfter;
    window._materialOutlineCutItem = _materialOutlineCutItem;
    window._materialOutlinePasteAfter = _materialOutlinePasteAfter;
    window._materialOutlineMove = _materialOutlineMove;
    window._showMaterialOutlineCtx = _showMaterialOutlineCtx;
    window._showMaterialWordTip = _showMaterialWordTip;
    window._moveMaterialWordTip = _moveMaterialWordTip;
    window._hideMaterialWordTip = _hideMaterialWordTip;
    window.toggleMaterialFullscreen = toggleMaterialFullscreen;
    window.switchMaterialAssistTab = switchMaterialAssistTab;
    window.toggleMaterialNoteMenu = toggleMaterialNoteMenu;
    window._materialSearchRoots = _materialSearchRoots;
    window._clearMaterialSearch = _clearMaterialSearch;
    window._escapeRegExp = _escapeRegExp;
    window._updateMaterialWhiteboardSearchView = _updateMaterialWhiteboardSearchView;
    window.materialDoSearch = materialDoSearch;
    window._focusMaterialSearch = _focusMaterialSearch;
    window.materialSearchNext = materialSearchNext;
    window.materialSearchPrev = materialSearchPrev;
    window._materialPositionSearchBox = _materialPositionSearchBox;
    window._bindMaterialSearchDrag = _bindMaterialSearchDrag;
    window.closeMaterialSearch = closeMaterialSearch;
    window.toggleMaterialSearch = toggleMaterialSearch;
    window._applyMaterialEditorBg = _applyMaterialEditorBg;
    window._clearMaterialEditorBg = _clearMaterialEditorBg;
    window._enterMaterialMode = _enterMaterialMode;
    window.exitMaterialToDefaultNotepad = exitMaterialToDefaultNotepad;
    window._exitMaterialMode = _exitMaterialMode;
    window._enterWriteNoteMode = _enterWriteNoteMode;
    window._exitWriteNoteMode = _exitWriteNoteMode;
    window._restoreFromWriteNote = _restoreFromWriteNote;
    window._layoutWriteNoteByWorkRects = _layoutWriteNoteByWorkRects;
    window._setupWriteNoteDivider = _setupWriteNoteDivider;
    window._removeWriteNoteDivider = _removeWriteNoteDivider;
    window._syncWriteNoteHeights = _syncWriteNoteHeights;
    window.applyNotepadZoom = applyNotepadZoom;
    window.notepadOutlineZoomIn = notepadOutlineZoomIn;
    window.notepadOutlineZoomOut = notepadOutlineZoomOut;
    window.applyNotepadOutlineZoom = applyNotepadOutlineZoom;
    window.applyEditModalFontSize = applyEditModalFontSize;
    window.applySubItemStatusFontSize = applySubItemStatusFontSize;
    window.changeNotepadFontSize = changeNotepadFontSize;
    window.applyFont = applyFont;
    window.toggleBold = toggleBold;
    window.applyFontSizeSelect = applyFontSizeSelect;
    window.countMiddleNonPeriodPunct = countMiddleNonPeriodPunct;
    window.styleYiShi = styleYiShi;
    window._notepadIsBlockTagName = _notepadIsBlockTagName;
    window.isBlankText = isBlankText;
    window._notepadCollectLinesWithGaps = _notepadCollectLinesWithGaps;
    window._notepadMatchHK = _notepadMatchHK;
    window._npFmt_detectSeqStyle = _npFmt_detectSeqStyle;
    window._npFmt_decideHeadingCtx = _npFmt_decideHeadingCtx;
    window._notepadCoreFormat = _notepadCoreFormat;
    window._npShowFormatConfirm = _npShowFormatConfirm;
    window.autoFormatDoc = autoFormatDoc;
        window.autoFormatDocCurrent = autoFormatDocCurrent;
        window.npResetFormatVisible = npResetFormatVisible;
    window.autoFormatDocSelected = autoFormatDocSelected;
    window.autoFormatAppend = autoFormatAppend;
    window._buildPasteHtml = _buildPasteHtml;
    window.getDocTemplate = getDocTemplate;
    window.escapeXml = escapeXml;
    window.mapFontFamily = mapFontFamily;
    window.pxToHalfPt = pxToHalfPt;
    window.alignToJc = alignToJc;
    window.collectParagraphs = collectParagraphs;
    window.buildRunXml = buildRunXml;
    window.buildDocBodyXml = buildDocBodyXml;
    window.sanitizeDocFileName = sanitizeDocFileName;
    window.idbOpen = idbOpen;
    window.applyFontSelect = applyFontSelect;
    window.indentParagraph = indentParagraph;
    window.applyAlign = applyAlign;
    window.applyNotepadStyle = applyNotepadStyle;
    window.cleanNotepadBlankLines = cleanNotepadBlankLines;
    window.cleanNotepadSpaces = cleanNotepadSpaces;
    window.applyParagraphStyle = applyParagraphStyle;
    window.applyNotepadLevel = applyNotepadLevel;
    window.updateNotepadIndexTitle = updateNotepadIndexTitle;
    window.notepadZoomLevels = notepadZoomLevels;
    window.tryRestoreDocDirHandle = tryRestoreDocDirHandle;
    window.tryRestoreNotebookRoot = tryRestoreNotebookRoot;
    window._renderMaterialOutline = _renderMaterialOutline;
    window.ensureDocDirHandle = ensureDocDirHandle;
    window.npOpenReplaceDialog = npOpenReplaceDialog;
    window.npReplaceAddRow = npReplaceAddRow;
    window.npReplaceRun = npReplaceRun;
    window.npReplaceClose = npReplaceClose;
    window.npReplaceCancel = npReplaceCancel;
    window.npReplaceClear = npReplaceClear;
