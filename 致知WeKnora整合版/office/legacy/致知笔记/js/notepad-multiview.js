(function () {
    'use strict';

    /* 多窗预览：5 个小窗口，每个可关联一篇笔记或一个本地文件。
       在「数据」「文章列表」「参考资料·笔记 / 本地」列表右键「添加到小窗 → 窗口 N」即完成关联，
       只有点顶栏「多窗预览」时才会把这个模块显示出来。
       每窗独立缩放、独立检索（只高亮 + 命中计数，不列结果）。 */

    var COLORS = 5;
    /* 与编辑区右键高亮同一套颜色 */
    var MARK_COLORS = [
        ['黄色', '#fff176'],
        ['蓝色', '#42a5f5'],
        ['红色', '#ef5350'],
        ['绿色', '#66bb6a'],
        ['紫色', '#ab47bc']
    ];
    var KEY = 'npMultiViewState';
    var ZMIN = 0.4, ZMAX = 3, ZSTEP = 1.1;
    var FIND_DELAY = 220;
    var MIN_RATIO = 0.28;

    var state = {
        open: false,
        tile: false,
        active: 0,
        order: [0, 1, 2, 3, 4],
        ratios: [1, 1, 1, 1, 1],
        q: ['', '', '', '', ''],
        slots: []
    };

    var _findTimers = [null, null, null, null, null];
    var _divDrag = null;
    var _memoId = -1;
    var _markRange = null;
    var _markWin = null;
    var _tipEl = null;
    var _tipTimer = null;

    function $(id) { return document.getElementById(id); }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function toast(msg) {
        if (typeof window.showToast === 'function') { try { window.showToast(msg); return; } catch (e) {} }
        if (typeof window.toast === 'function') { try { window.toast(msg); return; } catch (e) {} }
    }

    function baseName(p) {
        var s = String(p || '').replace(/[\\/]+$/, '');
        return s.split(/[\\/]/).pop() || s;
    }

    function stemOf(name) { return String(name || '').replace(/\.[^.]+$/, ''); }

    function extOf(name) {
        var m = String(name || '').match(/\.([^.\\/]+)$/);
        return m ? m[1].toLowerCase() : '';
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function blankSlot(id) {
        return {
            id: id, kind: '', path: '', name: '', title: '',
            memo: '', seq: -1, src: '', html: '', zoom: 1, hidden: false, error: '',
            marks: []
        };
    }

    function ensureSlots() {
        if (!Array.isArray(state.slots)) state.slots = [];
        for (var i = 0; i < COLORS; i++) {
            if (!state.slots[i] || typeof state.slots[i] !== 'object') state.slots[i] = blankSlot(i);
            state.slots[i].id = i;
            var z = Number(state.slots[i].zoom);
            state.slots[i].zoom = (isFinite(z) && z > 0) ? clamp(z, ZMIN, ZMAX) : 1;
            state.slots[i].hidden = !!state.slots[i].hidden;
            if (!Array.isArray(state.slots[i].marks)) state.slots[i].marks = [];
            if (!state.slots[i].findJump || typeof state.slots[i].findJump !== 'object') state.slots[i].findJump = null;
            if (!state.slots[i].findPos || typeof state.slots[i].findPos !== 'object') state.slots[i].findPos = null;
            if (!state.slots[i].kind) {
                state.slots[i].hidden = false;
                state.slots[i].html = '';
                state.slots[i].error = '';
                state.slots[i].marks = [];
                state.slots[i].findJump = null;
                state.slots[i].findPos = null;
            }
        }
        state.slots.length = COLORS;
        var order = [];
        (state.order || []).forEach(function (id) {
            id = parseInt(id, 10);
            if (id >= 0 && id < COLORS && order.indexOf(id) < 0) order.push(id);
        });
        for (var j = 0; j < COLORS; j++) if (order.indexOf(j) < 0) order.push(j);
        state.order = order;
        for (var r = 0; r < COLORS; r++) {
            var v = Number(state.ratios && state.ratios[r]);
            state.ratios[r] = (isFinite(v) && v > 0) ? v : 1;
        }
        state.active = (state.active >= 0 && state.active < COLORS) ? state.active : 0;
    }

    function loadState() {
        try {
            var raw = localStorage.getItem(KEY);
            if (raw) {
                var o = JSON.parse(raw);
                if (o && typeof o === 'object') {
                    state.tile = !!o.tile;
                    state.active = parseInt(o.active, 10) || 0;
                    if (Array.isArray(o.order)) state.order = o.order;
                    if (Array.isArray(o.ratios)) state.ratios = o.ratios;
                    if (Array.isArray(o.slots)) state.slots = o.slots;
                }
            }
        } catch (e) {}
        ensureSlots();
    }

    function saveState() {
        function dump(dropNoteHtml) {
            var slots = state.slots.map(function (s) {
                return {
                    id: s.id, kind: s.kind, path: s.path, name: s.name, title: s.title,
                    memo: s.memo, seq: (s.seq == null ? -1 : s.seq),
                    html: (s.kind === 'article' || (s.kind === 'note' && !dropNoteHtml)) ? (s.html || '') : '',
                    zoom: s.zoom, hidden: !!s.hidden,
                    marks: (s.marks || []).slice(0, 400),
                    findJump: s.findJump || null
                };
            });
            return JSON.stringify({
                tile: state.tile, active: state.active,
                order: state.order, ratios: state.ratios, slots: slots
            });
        }
        try {
            localStorage.setItem(KEY, dump(false));
        } catch (e) {
            try { localStorage.setItem(KEY, dump(true)); } catch (e2) {}
        }
    }

    function hasContent(s) { return !!(s && s.kind); }

    function currentEditorHtml() {
        var ed = $('notepadEditor');
        return ed ? (ed.innerHTML || '') : '';
    }

    function currentNoteTitle() {
        try {
            if (typeof notepadTitles !== 'undefined' && notepadTitles[currentNotepadTab]) {
                return notepadTitles[currentNotepadTab];
            }
        } catch (e) {}
        var node = (typeof window.npLibCurrentNode === 'function') ? window.npLibCurrentNode() : null;
        if (node && node.name) return stemOf(node.name);
        return '当前笔记';
    }

    function currentNotePath() {
        try { if (typeof window.npLibOpenPath === 'function') return window.npLibOpenPath() || ''; } catch (e) {}
        return '';
    }

    function findTreeNode(path) {
        if (!path || typeof window.npLibTree !== 'function') return null;
        var hit = null;
        (function walk(list) {
            for (var i = 0; i < (list || []).length && !hit; i++) {
                var n = list[i];
                if (!n) continue;
                if (n.kind === 'file' && n.path === path) { hit = n; return; }
                if (n.kind === 'dir' && n.children) walk(n.children);
            }
        })(window.npLibTree() || []);
        return hit;
    }

    function resolveNoteHtml(path) {
        var curPath = currentNotePath();
        if (!path || path.indexOf('mem:') === 0 || (curPath && path === curPath)) {
            return Promise.resolve(currentEditorHtml());
        }
        try {
            if (typeof window.npLibDocsCache === 'function') {
                var cache = window.npLibDocsCache() || {};
                if (cache[path]) return Promise.resolve(cache[path]);
            }
        } catch (e) {}
        var node = findTreeNode(path);
        if (node && typeof window.npLibReadNode === 'function') {
            return Promise.resolve(window.npLibReadNode(node)).then(function (r) {
                return (r && r.html) || '';
            });
        }
        return Promise.resolve('');
    }

    function loadSlotHtml(s, force) {
        if (!s || s.kind !== 'note') return Promise.resolve();
        if (s.html && !force) return Promise.resolve();
        return resolveNoteHtml(s.path).then(function (html) {
            if (html) { s.html = html; s.error = ''; }
            else if (!s.html) s.error = '读取失败，或这篇笔记没有内容';
        }).catch(function () {
            if (!s.html) s.error = '读取失败';
        });
    }

    /* ---------------- 尺寸：与参考资料栏同宽同位 ---------------- */
    function ensureWidth() {
        var sec = $('npMultiView');
        var ws = $('npWorkspace');
        if (!sec || !ws) return;
        var w = 0;
        var pv = $('npPreviewPane');
        if (pv && getComputedStyle(pv).display !== 'none') w = pv.offsetWidth;
        if (!w && ws.style.getPropertyValue('--npPrevW')) {
            w = parseFloat(ws.style.getPropertyValue('--npPrevW')) || 0;
        }
        if (!w) {
            var t = $('npTopicPane'), d = $('npDirPane');
            var sp1 = $('npSplitterTopic'), sp2 = $('npSplitterDir');
            if (t && getComputedStyle(t).display !== 'none') w += t.offsetWidth;
            if (d && getComputedStyle(d).display !== 'none') w += d.offsetWidth;
            if (sp1 && getComputedStyle(sp1).display !== 'none') w += sp1.offsetWidth;
            if (sp2 && getComputedStyle(sp2).display !== 'none') w += sp2.offsetWidth;
        }
        if (!w) w = Math.round(window.innerWidth * 0.4);
        sec.style.width = Math.max(240, w) + 'px';
    }

    function open() {
        ensureSlots();
        state.open = true;
        var sec = $('npMultiView');
        if (sec) {
            sec.classList.add('show');
            sec.setAttribute('aria-hidden', 'false');
        }
        ensureWidth();
        render();
        if (window.npTopView && typeof window.npTopView.sync === 'function') window.npTopView.sync();
        /* 与参考资料栏同款：打开时让编辑区向右让位、拖动条可用 */
        if (typeof window.npSyncOverlayLayout === 'function') window.npSyncOverlayLayout();
        state.slots.forEach(function (s) {
            if (s.kind === 'note' && !s.hidden && !s.html) {
                loadSlotHtml(s, true).then(function () { if (state.open) refreshWin(s); });
            }
        });
    }

    function close() {
        state.open = false;
        var sec = $('npMultiView');
        if (sec) {
            sec.classList.remove('show');
            sec.setAttribute('aria-hidden', 'true');
        }
        closePicker();
        closeCtxMenu();
        hideTip();
        revokeAll();
        var btn = $('npMultiViewBtn');
        if (btn) btn.classList.remove('active');
        if (typeof window.npSyncOverlayLayout === 'function') window.npSyncOverlayLayout();
        if (window.npTopView && typeof window.npTopView.closed === 'function') window.npTopView.closed('multiview');
    }

    function toggle() { if (state.open) close(); else open(); }

    function revokeAll() {
        var list = document.querySelectorAll('#npMultiView .npMvDocInner');
        for (var i = 0; i < list.length; i++) {
            if (typeof window.npFvRevokeInto === 'function') {
                try { window.npFvRevokeInto(list[i]); } catch (e) {}
            }
        }
    }

    /* ---------------- 渲染 ---------------- */
    function render() {
        ensureSlots();
        var btn = $('npMultiViewBtn');
        if (btn) btn.classList.toggle('active', state.open);
        var sec = $('npMultiView');
        if (!sec || !state.open) return;
        sec.classList.toggle('npMvTiled', state.tile);
        ensureWidth();
        renderTabs();
        renderHead();
        renderBody();
    }

    function renderTabs() {
        var host = $('npMvTabs');
        if (!host) return;
        host.innerHTML = '';
        state.order.forEach(function (id) {
            var s = state.slots[id];
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'npMvTab npMvTabC' + id +
                (id === state.active ? ' active' : '') +
                (hasContent(s) ? ' linked' : '') +
                (s.hidden ? ' off' : '');
            b.setAttribute('data-mvid', String(id));
            b.setAttribute('draggable', 'true');
            b.title = '窗口 ' + (id + 1) + (hasContent(s) ? '：' + (s.title || s.name) : '（未关联）');
            b.textContent = String(id + 1);
            host.appendChild(b);
        });
        if (!state.tile) {
            var s2 = state.slots[state.active];
            var me = host.querySelector('[data-mvid="' + state.active + '"]');
            if (me) me.classList.add('active');
        }
    }

    function renderHead() {
        var s = state.slots[state.active];
        var t = $('npMvCurTitle');
        if (t) {
            var label = '窗口 ' + (state.active + 1) + '：' +
                (hasContent(s) ? (s.title || s.name || '未命名') : '未关联内容');
            if (s && s.memo) label += '　·　' + s.memo;
            t.textContent = label;
            t.title = label;
        }
        var tb = $('npMvTileBtn');
        if (tb) {
            tb.classList.toggle('active', state.tile);
            tb.textContent = '平铺';
        }
    }

    function emptyHtml(s) {
        var id = s ? s.id : state.active;
        return '<div class="npMvEmpty">' +
            '<div class="npMvEmptyTitle">窗口 ' + (id + 1) + ' 还没有关联内容</div>' +
            '<div class="npMvEmptyHint">在「数据」「文章列表」「参考资料 · 笔记 / 本地」列表上右键 →「添加到小窗 → 窗口 ' + (id + 1) + '」即可关联。</div>' +
            '<button type="button" class="npMvEmptyPick">在这里选择笔记</button>' +
            '</div>';
    }

    function bindEmptyPick(root, id) {
        var btn = root.querySelector('.npMvEmptyPick');
        if (!btn) return;
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            state.active = id;
            renderTabs();
            renderHead();
            openPicker();
        });
    }

    function renderBody() {
        var body = $('npMvBody');
        if (!body) return;
        revokeAll();
        body.innerHTML = '';
        if (!state.tile) {
            body.classList.remove('npMvTiling');
            var s = state.slots[state.active];
            var win = makeWin(s, false);
            body.appendChild(win);
            if (hasContent(s)) fillWin(s, win);
            return;
        }
        body.classList.add('npMvTiling');
        var vis = visibleSlots();
        if (!vis.length) {
            var box = document.createElement('div');
            box.className = 'npMvWin npMvBg0';
            box.setAttribute('data-mvwin', '0');
            box.innerHTML = emptyHtml(state.slots[state.active]);
            body.appendChild(box);
            bindEmptyPick(box, state.active);
            return;
        }
        vis.forEach(function (s, i) {
            if (i) {
                var dv = document.createElement('div');
                dv.className = 'npMvDiv';
                dv.setAttribute('data-left', String(vis[i - 1].id));
                dv.setAttribute('data-right', String(s.id));
                body.appendChild(dv);
                bindDivider(dv);
            }
            var w = makeWin(s, true);
            body.appendChild(w);
            fillWin(s, w);
        });
        applyRatios();
    }

    function visibleSlots() {
        return state.order.map(function (id) { return state.slots[id]; })
            .filter(function (x) { return x && !x.hidden && hasContent(x); });
    }

    function makeWin(s, tiled) {
        var win = document.createElement('div');
        win.className = 'npMvWin npMvBg' + s.id + (tiled ? ' npMvWinTiled' : '');
        win.setAttribute('data-mvwin', String(s.id));
        win.style.flexGrow = String(state.ratios[s.id] || 1);

        if (tiled) {
            var head = document.createElement('div');
            head.className = 'npMvWinHead';
            head.innerHTML =
                '<span class="npMvWinDot npMvDotC' + s.id + '"></span>' +
                '<span class="npMvWinName">' + esc(s.title || s.name || ('窗口 ' + (s.id + 1))) + '</span>' +
                (s.memo ? '<span class="npMvWinMemo" title="' + esc(s.memo) + '">' + esc(s.memo) + '</span>' : '') +
                '<button type="button" class="npMvWinClose" title="关闭这个窗口">×</button>';
            var closeBtn = head.querySelector('.npMvWinClose');
            closeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closeTile(s.id);
            });
            win.appendChild(head);
        }

        var doc = document.createElement('div');
        doc.className = 'npMvDoc';
        doc.setAttribute('data-mvdoc', String(s.id));
        var inner = document.createElement('div');
        inner.className = 'npMvDocInner';
        doc.appendChild(inner);

        if (!hasContent(s)) {
            var empty = document.createElement('div');
            empty.innerHTML = emptyHtml(s);
            doc.appendChild(empty.firstChild);
        }
        win.appendChild(doc);

        if (hasContent(s)) {
            buildTools(win, s);
            buildFind(win, s);
        }
        bindEmptyPick(win, s.id);
        return win;
    }

    function closeTile(id) {
        var s = state.slots[id];
        if (!s) return;
        s.hidden = true;
        state.ratios = [1, 1, 1, 1, 1];
        if (state.active === id) {
            var next = visibleSlots()[0];
            state.active = next ? next.id : id;
        }
        saveState();
        render();
    }

    function locateInner(win) {
        return win ? win.querySelector('.npMvDocInner') : null;
    }

    function fillWin(s, win) {
        var inner = locateInner(win);
        if (!inner) return;
        if (s.kind === 'note' && !s.html && !s.error) {
            inner.innerHTML = '<div class="npMvLoading">正在读取…</div>';
            loadSlotHtml(s).then(function () {
                if (!state.open) return;
                renderContent(s, inner).then(function () {
                    applyZoom(s, inner);
                    bindPdfWheel(s, win, inner);
                    applyFind(s, win);
                });
            });
            applyZoom(s, inner);
            return;
        }
        renderContent(s, inner).then(function () {
            applyZoom(s, inner);
            bindPdfWheel(s, win, inner);
            applyFind(s, win);
        });
    }

    /* 多窗里的本地 PDF：Ctrl+滚轮直接按窗口缩放比例重排（通用于所有内容，PDF 也是） */
    function bindPdfWheel(s, win, inner) {
        if (!inner || inner._npPdfWheel) return;
        inner._npPdfWheel = true;
        inner.addEventListener('wheel', function (e) {
            if (!e.ctrlKey) return;
            if (!inner.querySelector('.npPdfBody')) return;
            e.preventDefault();
            var z = (s.zoom || 1) * (e.deltaY < 0 ? 1.12 : 1 / 1.12);
            setZoom(s, z, win, win.querySelector('.npMvZoomLabel'));
        }, { passive: false });
    }

    function renderContent(s, inner) {
        if (!inner) return Promise.resolve();
        if (s.kind === 'image') {
            if (!s.src) {
                inner.innerHTML = '<div class="npMvNoteBody"><div class="npMvEmptyInline">（图片附件已失效，请重新添加）</div></div>';
            } else {
                inner.innerHTML = '<div class="npMvNoteBody npMvImageBody"><img alt="" src="' + esc(s.src) + '"></div>';
            }
            return Promise.resolve();
        }
        if (s.kind === 'file') {
            if (typeof window.npFvRenderInto !== 'function') {
                inner.innerHTML = '<div class="npMvNoteBody"><div class="npMvEmptyInline">本地预览组件未加载。</div></div>';
                return Promise.resolve();
            }
            var node = { kind: 'file', path: s.path, name: s.name, ext: extOf(s.name) };
            return Promise.resolve(window.npFvRenderInto(inner, node)).catch(function (e) {
                inner.innerHTML = '<div class="npMvNoteBody"><div class="npMvEmptyInline">预览失败：' +
                    esc(e && e.message ? e.message : e) + '</div></div>';
            });
        }
        var html = s.html || '';
        if (s.error && !html) {
            inner.innerHTML = '<div class="npMvNoteBody"><div class="npMvEmptyInline">' + esc(s.error) + '</div></div>';
            return Promise.resolve();
        }
        if (!html) {
            /* 文章快照可能还没取到正文（例如刷新后从 localStorage 恢复）：补一次 */
            if (s.kind === 'article' && typeof window.npDirArticleSnapshot === 'function') {
                var snap = null;
                try { snap = window.npDirArticleSnapshot(s.seq); } catch (e) { snap = null; }
                if (snap && snap.html) {
                    s.html = snap.html;
                    s.title = s.title || snap.title;
                    s.noteTitle = s.noteTitle || snap.noteTitle;
                    html = s.html;
                    saveState();
                }
            }
        }
        if (!html) {
            inner.innerHTML = '<div class="npMvNoteBody"><div class="npMvEmptyInline">（该笔记暂无内容）</div></div>';
            return Promise.resolve();
        }
        var from = (s.kind === 'article' && s.noteTitle)
            ? ('<div class="npMvNoteFrom">来自：' + esc(s.noteTitle) + '</div>') : '';
        inner.innerHTML = from + '<div class="npMvNoteBody">' + html + '</div>';
        return Promise.resolve();
    }

    function buildTools(win, s) {
        var bar = document.createElement('div');
        bar.className = 'npMvTools';
        bar.innerHTML =
            '<button type="button" class="npMvTool npMvZoomOut" title="缩小">−</button>' +
            '<button type="button" class="npMvTool npMvZoomLabel" title="恢复 100%">' + Math.round(s.zoom * 100) + '%</button>' +
            '<button type="button" class="npMvTool npMvZoomIn" title="放大">＋</button>' +
            '<button type="button" class="npMvTool npMvFindBtn" title="在本窗口检索">🔍</button>';
        var label = bar.querySelector('.npMvZoomLabel');
        bar.querySelector('.npMvZoomOut').addEventListener('click', function (e) {
            e.preventDefault();
            setZoom(s, s.zoom / ZSTEP, win, label);
        });
        bar.querySelector('.npMvZoomIn').addEventListener('click', function (e) {
            e.preventDefault();
            setZoom(s, s.zoom * ZSTEP, win, label);
        });
        label.addEventListener('click', function (e) {
            e.preventDefault();
            setZoom(s, 1, win, label);
        });
        bar.querySelector('.npMvFindBtn').addEventListener('click', function (e) {
            e.preventDefault();
            var find = win.querySelector('.npMvFind');
            if (!find) return;
            find.hidden = !find.hidden;
            if (!find.hidden) {
                var input = find.querySelector('.npMvFindInput');
                if (input) { input.focus(); input.select(); }
            }
        });
        win.appendChild(bar);
    }

    function setZoom(s, value, win, label) {
        s.zoom = clamp(Math.round(value * 100) / 100, ZMIN, ZMAX);
        applyZoom(s, locateInner(win));
        if (label) label.textContent = Math.round(s.zoom * 100) + '%';
        saveState();
    }

    function applyZoom(s, inner) {
        if (!inner) return;
        var pdf = inner.querySelector('.npPdfBody');
        if (pdf && window.NpPdfView) {
            /* PDF 按页面比例重新渲染，不能用 CSS zoom：
               否则 canvas 被整体拉伸，字发虚，检索高亮也会错位。 */
            inner.style.zoom = '';
            window.NpPdfView.setScale(pdf, s.zoom || 1);
            return;
        }
        inner.style.zoom = String(s.zoom || 1);
    }

    function buildFind(win, s) {
        var box = document.createElement('div');
        box.className = 'npMvFind';
        box.hidden = true;
        box.innerHTML =
            '<span class="npMvFindGrip" title="拖动检索框">⋮⋮</span>' +
            '<input type="text" class="npMvFindInput" placeholder="在当前窗内检索（空格=或者，- =并且）" autocomplete="off" spellcheck="false">' +
            '<span class="npMvFindCount">0 处</span>' +
            '<button type="button" class="npMvFindCancel" title="取消检索">×</button>' +
            '<span class="npMvTerms"></span>' +
            '<div class="npMvFindActions">' +
            '<button type="button" class="npMvFindClear">清除</button>' +
            '<button type="button" class="npMvFindClose">关闭</button>' +
            '</div>';
        var input = box.querySelector('.npMvFindInput');
        var count = box.querySelector('.npMvFindCount');
        input.value = state.q[s.id] || '';
        input.addEventListener('input', function () {
            var id = s.id;
            if (_findTimers[id]) clearTimeout(_findTimers[id]);
            _findTimers[id] = setTimeout(function () {
                _findTimers[id] = null;
                runFind(s, win, input.value, count);
            }, FIND_DELAY);
        });
        input.addEventListener('keydown', function (e) {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                if (_findTimers[s.id]) { clearTimeout(_findTimers[s.id]); _findTimers[s.id] = null; }
                runFind(s, win, input.value, count);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                input.value = '';
                runFind(s, win, '', count);
            }
        });
        function clearFind(keepOpen) {
            input.value = '';
            if (_findTimers[s.id]) { clearTimeout(_findTimers[s.id]); _findTimers[s.id] = null; }
            runFind(s, win, '', count);
            s.findJump = null;
            if (keepOpen) { box.hidden = false; input.focus(); }
        }
        box.querySelector('.npMvFindCancel').addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            clearFind(false);
            box.hidden = true;
        });
        box.querySelector('.npMvFindClear').addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            clearFind(true);
        });
        box.querySelector('.npMvFindClose').addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            box.hidden = true;
        });
        box.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            if (e.target.closest('input, button')) return;
            e.preventDefault();
            var wr = win.getBoundingClientRect();
            var br = box.getBoundingClientRect();
            var startX = e.clientX, startY = e.clientY;
            var startL = br.left - wr.left, startT = br.top - wr.top;
            function move(ev) {
                var l = clamp(startL + ev.clientX - startX, 0, Math.max(0, wr.width - box.offsetWidth));
                var t = clamp(startT + ev.clientY - startY, 0, Math.max(0, wr.height - box.offsetHeight));
                box.style.left = l + 'px';
                box.style.top = t + 'px';
                box.style.right = 'auto';
                box.style.bottom = 'auto';
                s.findPos = { left: l, top: t };
            }
            function up() {
                document.removeEventListener('mousemove', move, true);
                document.removeEventListener('mouseup', up, true);
                saveState();
            }
            document.addEventListener('mousemove', move, true);
            document.addEventListener('mouseup', up, true);
        });
        if (s.findPos) {
            box.style.left = s.findPos.left + 'px';
            box.style.top = s.findPos.top + 'px';
            box.style.right = 'auto';
            box.style.bottom = 'auto';
        }
        win.appendChild(box);
    }

    function runFind(s, win, raw, countEl) {
        state.q[s.id] = raw;
        var inner = locateInner(win);
        if (!inner) return;
        var groups = parseGroups(raw);
        s.findJump = null;
        renderContent(s, inner).then(function () {
            applyZoom(s, inner);
            var n = highlight(inner, raw, groups);
            applyMarks(s, inner);
            if (countEl) countEl.textContent = n ? (n + ' 处') : '0 处';
            renderFindTerms(win, groups, groups.length ? groupCounts(inner, groups) : []);
        });
    }

    /* 检索条上的彩色数量圆点：每组一个，数字 = 该组在本窗口命中的次数 */
    function renderFindTerms(win, groups, counts) {
        var host = win.querySelector('.npMvTerms');
        if (!host) return;
        if (!groups.length) {
            host.innerHTML = '';
            host.hidden = true;
            return;
        }
        host.hidden = false;
        host.innerHTML = groups.map(function (group, gi) {
            var label = group.join('-');
            return '<span class="npSearchTerm" data-mvgi="' + gi + '" data-mvlabel="' + esc(label) + '" title="点击跳到下一处">' +
                '<span class="npSearchTermText">' + esc(label) + '</span>' +
                '<span class="npSearchDot npSearchDot' + (gi % COLORS) + '">' + ((counts && counts[gi]) || 0) + '</span>' +
                '</span>';
        }).join('');
        var terms = host.querySelectorAll('.npSearchTerm');
        for (var i = 0; i < terms.length; i++) {
            (function (term) {
                var gi = parseInt(term.getAttribute('data-mvgi'), 10);
                term.addEventListener('mousedown', function (e) { e.stopPropagation(); });
                term.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var winEl = term.closest ? term.closest('.npMvWin') : null;
                    var slot = winEl ? state.slots[parseInt(winEl.getAttribute('data-mvwin'), 10)] : null;
                    if (slot) focusMatch(slot, winEl, gi, null);
                });
            })(terms[i]);
        }
    }

    function focusMatch(s, win, gi, forceIdx, silent) {
        if (!s || !win) return -1;
        var inner = locateInner(win);
        if (!inner) return -1;
        var all = inner.querySelectorAll('.npMvHl');
        var hits = [];
        for (var i = 0; i < all.length; i++) {
            if (all[i].classList.contains('npMvHl' + gi)) hits.push(all[i]);
        }
        if (!hits.length) return -1;
        var idx = (forceIdx == null || forceIdx < 0) ? 0 : forceIdx;
        if (s.findJump && s.findJump.gi === gi && forceIdx == null) idx = (s.findJump.idx + 1) % hits.length;
        idx = Math.max(0, Math.min(hits.length - 1, idx));
        for (var k = 0; k < all.length; k++) all[k].classList.remove('npMvHlFocus');
        var el = hits[idx];
        el.classList.add('npMvHlFocus');
        s.findJump = { gi: gi, idx: idx };
        var doc = win.querySelector('.npMvDoc');
        if (doc) {
            var dr = doc.getBoundingClientRect();
            var er = el.getBoundingClientRect();
            doc.scrollTop += (er.top - dr.top) - (doc.clientHeight / 2) + (er.height / 2);
        }
        var term = win.querySelector('.npSearchTerm[data-mvgi="' + gi + '"] .npSearchTermText');
        if (term) {
            var label = win.querySelector('.npSearchTerm[data-mvgi="' + gi + '"]');
            var base = label ? (label.getAttribute('data-mvlabel') || term.textContent || '') : '';
            term.textContent = base + ' ' + (idx + 1) + '/' + hits.length;
        }
        if (!silent) return idx;
        return idx;
    }

    /* ---------------- 临时高亮标记（只读标记，不写回笔记文件） ---------------- */
    var _marksDrag = null;

    function applyMarks(s, inner) {
        if (!inner) return;
        tagMarkBlocks(inner);
        var list = s && s.marks;
        if (!list || !list.length) return;
        clearMarksDeep(inner);
        var body = inner.querySelector('.npMvNoteBody') || inner;
        var blocks = leafBlocks(body);
        for (var i = 0; i < blocks.length; i++) {
            var block = blocks[i];
            var bIdx = parseInt(block.getAttribute('data-mvb'), 10);
            if (!(bIdx >= 0)) continue;
            var marks = [];
            for (var k = 0; k < list.length; k++) {
                if (list[k].b === bIdx) marks.push(list[k]);
            }
            if (!marks.length) continue;
            applyMarksToBlock(block, marks);
        }
    }

    function textNodesOf(block) {
        var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                var pn = node.parentNode;
                if (pn && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(pn.nodeName)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var out = [];
        while (walker.nextNode()) out.push(walker.currentNode);
        return out;
    }

    function applyMarksToBlock(block, marks) {
        var nodes = textNodesOf(block);
        if (!nodes.length) return;
        marks = marks.slice().sort(function (a, b) { return b.start - a.start; });
        var total = 0, i, k;
        for (i = 0; i < nodes.length; i++) total += nodes[i].nodeValue.length;
        for (k = 0; k < marks.length; k++) {
            var m = marks[k];
            var start = clamp(m.start, 0, total);
            var end = clamp(m.end, 0, total);
            if (end <= start) continue;
            nodes = textNodesOf(block);
            var offset = 0, done = false;
            for (i = 0; i < nodes.length && !done; i++) {
                var tn = nodes[i];
                var len = tn.nodeValue.length;
                var ns = offset, ne = offset + len;
                offset = ne;
                if (ne <= start || ns >= end) continue;
                var s0 = Math.max(0, start - ns);
                var s1 = Math.min(len, end - ns);
                if (s1 <= s0) continue;
                var target = tn;
                if (s0 > 0) target = tn.splitText(s0);
                var take = s1 - s0;
                if (take < target.nodeValue.length) target.splitText(take);
                var span = document.createElement('span');
                span.className = 'npMvMark';
                var color = MARK_COLORS[m.ci] || MARK_COLORS[0];
                span.style.backgroundColor = color[1];
                span.title = '右键可取消此处高亮';
                span.setAttribute('data-mvc', String(m.ci));
                target.parentNode.replaceChild(span, target);
                span.appendChild(target);
                done = true;
            }
        }
    }

    function clearMarksDeep(node) {
        if (!node || !node.querySelectorAll) return;
        var spans = node.querySelectorAll('span.npMvMark');
        for (var i = 0; i < spans.length; i++) {
            var sp = spans[i], parent = sp.parentNode;
            if (!parent) continue;
            while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
            parent.removeChild(sp);
        }
    }

    function markBlockIndex(block) {
        var v = parseInt(block.getAttribute('data-mvb'), 10);
        return v >= 0 ? v : -1;
    }

    function selectionToMark(s, win) {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
        var range = sel.getRangeAt(0);
        var inner = locateInner(win);
        if (!inner || !inner.contains(range.commonAncestorContainer)) return null;
        var startBlock = null, endBlock = null;
        var node = range.startContainer;
        while (node && node !== inner && !(node.nodeType === 1 && node.hasAttribute('data-mvb'))) node = node.parentNode;
        if (node && node !== inner) startBlock = node;
        node = range.endContainer;
        while (node && node !== inner && !(node.nodeType === 1 && node.hasAttribute('data-mvb'))) node = node.parentNode;
        if (node && node !== inner) endBlock = node;
        if (!startBlock) return null;
        if (startBlock !== endBlock) {
            /* 跨段选区只记第一段，避免段落错位 */
            range = range.cloneRange();
            range.setEnd(startBlock, startBlock.childNodes.length);
        }
        var pre = range.cloneRange();
        pre.selectNodeContents(startBlock);
        pre.setEnd(range.startContainer, range.startOffset);
        var start = pre.toString().length;
        var text = range.toString();
        if (!start && !text) return null;
        return { b: markBlockIndex(startBlock), start: start, end: start + Math.max(text.length, 1), ci: 0 };
    }

    function addMark(s, win, ci) {
        saveSelection(s, win);
        var m = selectionToMark(s, win);
        if (!m) { toast('请先选中要加高亮的文字'); return; }
        var inner = locateInner(win);
        clearMarksDeep(inner);
        m.ci = ci;
        m.text = (function () {
            var body = inner.querySelector('.npMvNoteBody') || inner;
            var blk = body.querySelector('[data-mvb="' + m.b + '"]');
            var t = blk ? (blk.textContent || '') : '';
            return t.substring(m.start, m.end).slice(0, 60);
        })();
        s.marks = s.marks || [];
        s.marks.push(m);
        saveState();
        applyMarks(s, inner);
        try { selectArticleAgain(s, win); } catch (e) {}
        toast('已标记为' + MARK_COLORS[ci][0] + '高亮');
    }

    function clearMarksNear(s, win) {
        saveSelection(s, win);
        var inner = locateInner(win);
        if (!inner) return;
        var target = selectionToMark(s, win);
        if (!target) {
            if (!(s.marks || []).length) { toast('当前窗口没有高亮标记'); return; }
            s.marks = [];
            clearMarksDeep(inner);
            saveState();
            toast('已清除本窗口全部高亮');
            return;
        }
        var before = s.marks.length;
        s.marks = s.marks.filter(function (m) {
            return !(m.b === target.b && m.start < target.end && m.end > target.start);
        });
        clearMarksDeep(inner);
        saveState();
        applyMarks(s, inner);
        try { selectArticleAgain(s, win); } catch (e) {}
        toast(s.marks.length < before ? '已取消此处高亮' : '此处没有高亮');
    }

    /* 选区定位：用块索引 + 文本偏移（记录在 data-mvs / data-mvo） */
    function saveSelection(s, win) {
        var sel = window.getSelection();
        var inner = locateInner(win);
        if (!inner || !sel || !sel.rangeCount || sel.isCollapsed) {
            s.sel = null;
            return;
        }
        var range = sel.getRangeAt(0);
        if (!inner.contains(range.commonAncestorContainer)) { s.sel = null; return; }
        var node = range.startContainer;
        while (node && node !== inner && !(node.nodeType === 1 && node.hasAttribute('data-mvs'))) node = node.parentNode;
        var node2 = range.endContainer;
        while (node2 && node2 !== inner && !(node2.nodeType === 1 && node2.hasAttribute('data-mvs'))) node2 = node2.parentNode;
        if (!node || node === inner) { s.sel = null; return; }
        function off(block, container, offset) {
            var pre = document.createRange();
            pre.selectNodeContents(block);
            try { pre.setEnd(container, offset); } catch (e) { return 0; }
            return pre.toString().length;
        }
        s.sel = {
            b0: parseInt(node.getAttribute('data-mvs'), 10),
            o0: off(node, range.startContainer, range.startOffset),
            b1: node2 && node2 !== inner ? parseInt(node2.getAttribute('data-mvs'), 10) : -1,
            o1: node2 && node2 !== inner ? off(node2, range.endContainer, range.endOffset) : 0
        };
    }

    function selectArticleAgain(s, win) {
        var sel = window.getSelection();
        if (!s.sel || !sel) return;
        var inner = locateInner(win);
        if (!inner) return;
        var body = inner.querySelector('.npMvNoteBody') || inner;
        var b0 = body.querySelector('[data-mvs="' + s.sel.b0 + '"]');
        if (!b0) return;
        function at(block, offset) {
            var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
            var acc = 0, tn;
            while ((tn = walker.nextNode())) {
                var len = tn.nodeValue.length;
                if (acc + len >= offset) return { node: tn, offset: offset - acc };
                acc += len;
            }
            return { node: block, offset: block.childNodes.length };
        }
        var a = at(b0, s.sel.o0);
        var range = document.createRange();
        try {
            range.setStart(a.node, Math.min(a.offset, a.node.nodeValue ? a.node.nodeValue.length : 0));
            var b1 = s.sel.b1 >= 0 ? body.querySelector('[data-mvs="' + s.sel.b1 + '"]') : null;
            if (b1) {
                var z = at(b1, s.sel.o1);
                range.setEnd(z.node, Math.min(z.offset, z.node.nodeValue ? z.node.nodeValue.length : 0));
            } else {
                range.collapse(true);
            }
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (e) {}
    }

    /* 标记用的块索引与选区定位索引分开记，避免互相覆盖 */
    function tagMarkBlocks(root) {
        var body = root.querySelector && (root.querySelector('.npMvNoteBody') || root);
        if (!body) return;
        var blocks = leafBlocks(body);
        for (var i = 0; i < blocks.length; i++) {
            blocks[i].setAttribute('data-mvb', String(i));
            blocks[i].setAttribute('data-mvs', String(i));
        }
    }

    function buildMarkMenu(x, y, s, win) {
        closeCtxMenu();
        var el = document.createElement('div');
        el.className = 'npMvCtx npMvMarkMenu';
        el.id = 'npMvMarkMenu';
        var head = document.createElement('div');
        head.className = 'npMvCtxHead';
        head.textContent = '高亮背景色';
        el.appendChild(head);
        MARK_COLORS.forEach(function (c, ci) {
            var it = document.createElement('button');
            it.type = 'button';
            it.className = 'npMvCtxItem';
            it.setAttribute('data-npmvmark', String(ci));
            it.innerHTML = '<span class="npMvCtxSwatch" style="background:' + c[1] + '"></span>' +
                '<span class="npMvCtxName">' + MARK_COLORS[ci][0] + '</span>' +
                '<span class="npMvCtxKey">Ctrl+Shift+' + (ci + 1) + '</span>';
            it.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
            it.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closeCtxMenu();
                addMark(s, win, ci);
            });
            el.appendChild(it);
        });
        var clr = document.createElement('button');
        clr.type = 'button';
        clr.className = 'npMvCtxItem npMvCtxDanger';
        clr.setAttribute('data-npmvmark', 'clear');
        clr.textContent = '取消背景色';
        clr.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
        clr.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            closeCtxMenu();
            clearMarksNear(s, win);
        });
        el.appendChild(clr);
        document.body.appendChild(el);
        var w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, x)) + 'px';
        el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, y)) + 'px';
    }

    function applyFind(s, win) {
        var raw = state.q[s.id] || '';
        var box = win.querySelector('.npMvFind');
        var count = win.querySelector('.npMvFindCount');
        var input = win.querySelector('.npMvFindInput');
        if (!raw) {
            if (input) input.value = '';
            if (count) count.textContent = '0 处';
            renderFindTerms(win, [], []);
            var empty = locateInner(win);
            if (empty) applyMarks(s, empty);
            return;
        }
        if (box) box.hidden = false;
        if (input) input.value = raw;
        var inner = locateInner(win);
        if (!inner) return;
        var groups = parseGroups(raw);
        var n = highlight(inner, raw, groups);
        applyMarks(s, inner);
        if (count) count.textContent = n ? (n + ' 处') : '0 处';
        renderFindTerms(win, groups, groups.length ? groupCounts(inner, groups) : []);
        if (s.findJump) { try { focusMatch(s, win, s.findJump.gi, s.findJump.idx); } catch (e) {} }
    }

    var BLOCK_TAGS = { P: 1, LI: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, TD: 1, TH: 1, PRE: 1, BLOCKQUOTE: 1, DIV: 1 };

    /* 检索规则统一走 notepad-search-core.js（空格=或者、-=并且、按组配色） */
    function core() {
        return window.npSearchCore || null;
    }

    function parseGroups(raw) {
        var c = core();
        if (c) return c.parseGroups(raw);
        return String(raw == null ? '' : raw).trim().split(/\s+/).filter(Boolean)
            .map(function (group) {
                return group.split(/[-－]/).map(function (t) { return t.trim(); }).filter(Boolean);
            })
            .filter(function (g) { return g.length; });
    }

    function termReg(term) {
        var c = core();
        if (c) return c.termReg(term);
        return null;
    }

    function groupMatches(text, group) {
        var c = core();
        if (c) return c.groupMatches(text, group);
        return false;
    }

    function scanTerms(text, entries) {
        var c = core();
        if (!c) return [];
        return c.scanMarks(text, entries);
    }

    /* 每组关键字出现次数：用于检索条上的彩色数量圆点 */
    function groupCounts(root, groups) {
        var c = core();
        if (!c || !root || !groups.length) return [];
        var texts = leafBlocks(root).map(function (b) { return b.textContent || ''; });
        return groups.map(function (group) { return c.countGroup(texts, group); });
    }

    function leafBlocks(root) {
        var out = [];
        var all = root.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,td,th,pre,blockquote,div');
        for (var i = 0; i < all.length; i++) {
            var el = all[i], nested = false;
            for (var c = el.firstElementChild; c; c = c.nextElementSibling) {
                if (BLOCK_TAGS[c.tagName]) { nested = true; break; }
            }
            if (!nested) out.push(el);
        }
        return out;
    }

    function wrapInBlock(block, entries) {
        var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                var pn = node.parentNode;
                if (pn && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(pn.nodeName)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var nodes = [], starts = [], full = '';
        while (walker.nextNode()) {
            var node = walker.currentNode;
            nodes.push(node);
            starts.push(full.length);
            full += node.nodeValue;
        }
        if (!nodes.length || !full) return 0;
        var ranges = scanTerms(full, entries);
        if (!ranges.length) return 0;
        for (var i = 0; i < nodes.length; i++) {
            var tn = nodes[i];
            var ns = starts[i], ne = ns + tn.nodeValue.length;
            var local = [];
            for (var r = 0; r < ranges.length; r++) {
                var it = ranges[r];
                if (it.end <= ns || it.start >= ne) continue;
                local.push({
                    start: Math.max(0, it.start - ns),
                    end: Math.min(tn.nodeValue.length, it.end - ns),
                    gi: it.gi || 0
                });
            }
            if (!local.length) continue;
            var value = tn.nodeValue;
            var frag = document.createDocumentFragment();
            var cursor = 0;
            local.forEach(function (item) {
                if (item.start > cursor) frag.appendChild(document.createTextNode(value.slice(cursor, item.start)));
                var span = document.createElement('span');
                span.className = 'npMvHl npMvHl' + (item.gi % COLORS);
                span.textContent = value.slice(item.start, item.end);
                frag.appendChild(span);
                cursor = item.end;
            });
            if (cursor < value.length) frag.appendChild(document.createTextNode(value.slice(cursor)));
            tn.parentNode.replaceChild(frag, tn);
        }
        return ranges.length;
    }

    function highlight(root, raw, groups) {
        groups = groups || parseGroups(raw);
        if (!groups.length) return 0;
        var entries = (core() ? core().entriesOf(groups) : groups.map(function (t, gi) { return { terms: t, gi: gi }; }));
        var total = 0;
        leafBlocks(root).forEach(function (block) {
            var text = block.textContent || '';
            if (!text) return;
            var hit = groups.some(function (g) { return groupMatches(text, g); });
            if (!hit) return;
            total += wrapInBlock(block, entries);
        });
        return total;
    }

    /* ---------------- 平铺宽度 ---------------- */
    function applyRatios() {
        var body = $('npMvBody');
        if (!body) return;
        var wins = body.querySelectorAll('.npMvWin');
        for (var i = 0; i < wins.length; i++) {
            var id = parseInt(wins[i].getAttribute('data-mvwin'), 10);
            wins[i].style.flexGrow = String(state.ratios[id] || 1);
        }
    }

    function bindDivider(dv) {
        dv.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            e.preventDefault();
            var leftId = parseInt(dv.getAttribute('data-left'), 10);
            var rightId = parseInt(dv.getAttribute('data-right'), 10);
            var lw = dv.previousElementSibling, rw = dv.nextElementSibling;
            if (!lw || !rw) return;
            _divDrag = {
                leftId: leftId, rightId: rightId,
                lw: lw, rw: rw,
                leftW: lw.getBoundingClientRect().width,
                rightW: rw.getBoundingClientRect().width,
                startX: e.clientX,
                ratioL: state.ratios[leftId] || 1,
                ratioR: state.ratios[rightId] || 1
            };
            dv.classList.add('dragging');
            document.body.classList.add('npMvDivDragging');
            try { dv.setPointerCapture(e.pointerId); } catch (err) {}
        });
    }

    document.addEventListener('mousemove', function (e) {
        if (!_divDrag) return;
        var d = _divDrag;
        var pair = d.leftW + d.rightW;
        if (!pair) return;
        var dx = e.clientX - d.startX;
        var min = Math.min(MIN_RATIO * pair, pair / 2);
        var newLeft = clamp(d.leftW + dx, min, pair - min);
        var totalRatio = d.ratioL + d.ratioR;
        state.ratios[d.leftId] = totalRatio * (newLeft / pair);
        state.ratios[d.rightId] = totalRatio * ((pair - newLeft) / pair);
        applyRatios();
    });

    document.addEventListener('mouseup', function () {
        if (!_divDrag) return;
        _divDrag = null;
        var dv = document.querySelector('.npMvDiv.dragging');
        if (dv) dv.classList.remove('dragging');
        document.body.classList.remove('npMvDivDragging');
        saveState();
    });

    /* ---------------- 关联 / 选择笔记 ---------------- */
    function assign(id, target) {
        if (!(id >= 0 && id < COLORS) || !target) return;
        var s = state.slots[id];
        ensureSlots();
        s = state.slots[id];
        s.kind = target.kind || 'note';
        s.path = target.path || '';
        s.name = target.name || '';
        s.title = target.title || target.name || baseName(target.path) || ('窗口 ' + (id + 1));
        s.memo = s.memo || '';
        s.seq = (target.seq == null ? -1 : target.seq);
        s.src = target.src || '';
        s.html = target.html || '';
        s.marks = [];
        s.findJump = null;
        s.findPos = null;
        s.error = '';
        s.hidden = false;
        s.zoom = s.zoom || 1;
        state.active = id;
        saveState();
        if (s.kind === 'note' && !s.html) {
            loadSlotHtml(s).then(function () {
                if (state.open) refreshWin(s);
            });
        }
        if (state.open) render();
        toast('已关联到窗口 ' + (id + 1) + '：' + (s.title || '未命名') + '（点顶栏「多窗预览」查看）');
    }

    function refreshWin(s) {
        if (!state.open) return;
        var body = $('npMvBody');
        if (!body) return;
        var win = body.querySelector('.npMvWin[data-mvwin="' + s.id + '"]');
        if (!win) { render(); return; }
        var inner = locateInner(win);
        if (!inner) return;
        renderContent(s, inner).then(function () {
            applyZoom(s, inner);
            applyFind(s, win);
        });
    }

    function clearSlot(id) {
        var s = state.slots[id];
        if (!s) return;
        var memo = s.memo || '';
        state.slots[id] = blankSlot(id);
        state.slots[id].memo = memo;
        state.ratios = [1, 1, 1, 1, 1];
        saveState();
        render();
    }

    /* 顶栏「选择文件」：系统文件框选一个本地文件，关联到当前窗口只读预览 */
    function pickLocalFileForSlot() {
        var id = state.active;
        var fn = window.npPickLocalFile;
        if (typeof fn !== 'function') { toast('本机没有可用的文件选择方式，请升级后重试'); return; }
        var start = '';
        try { start = window.npLibRootPath ? window.npLibRootPath() : ''; } catch (e) {}
        Promise.resolve(fn({ title: '选择文件', start: start || '~' })).then(function (r) {
            if (!r || !r.ok || !r.path || r.isDir) {
                if (r && r.error && r.error !== '已取消' && r.error !== '未选择') toast(r.error);
                return;
            }
            var name = baseName(r.path);
            assign(id, { kind: 'file', path: r.path, name: name, title: name });
        }).catch(function () { toast('选择文件失败'); });
    }

    function clearActiveSlot() {
        var id = state.active;
        clearSlot(id);
        toast('已清空窗口 ' + (id + 1));
    }

    function noteTargets() {
        var out = [];
        var seen = Object.create(null);
        var curPath = currentNotePath();
        var ed = $('notepadEditor');
        var curHtml = currentEditorHtml();
        if (curPath || (ed && curHtml && curHtml.replace(/<p><br><\/p>/gi, '').trim())) {
            var p = curPath || 'mem:0';
            out.push({
                kind: 'note', path: p,
                name: curPath ? baseName(curPath) : '',
                title: currentNoteTitle(),
                folder: '当前编辑区',
                html: curPath ? '' : curHtml
            });
            seen[p] = true;
        }
        var tree = (typeof window.npLibTree === 'function') ? (window.npLibTree() || []) : [];
        (function walk(nodes, folder) {
            for (var i = 0; i < (nodes || []).length; i++) {
                var n = nodes[i];
                if (!n) continue;
                if (n.kind === 'dir') {
                    walk(n.children, folder ? folder + ' / ' + n.name : n.name);
                } else if (n.kind === 'file' && /\.js$/i.test(n.name || '') && !seen[n.path]) {
                    seen[n.path] = true;
                    out.push({
                        kind: 'note', path: n.path, name: n.name,
                        title: stemOf(n.name), folder: folder || '根目录'
                    });
                }
            }
        })(tree, '');
        return out;
    }

    function openPicker() {
        var p = $('npMvPicker');
        if (!p) return;
        p.hidden = false;
        var input = $('npMvPickerInput');
        if (input) { input.value = ''; input.focus(); }
        renderPicker();
    }

    function closePicker() {
        var p = $('npMvPicker');
        if (p) p.hidden = true;
    }

    function renderPicker() {
        var host = $('npMvPickerList');
        if (!host) return;
        var input = $('npMvPickerInput');
        var key = (input ? input.value : '').trim().toLowerCase();
        var list = noteTargets().filter(function (t) {
            if (!key) return true;
            return (t.title + ' ' + t.folder + ' ' + (t.name || '')).toLowerCase().indexOf(key) >= 0;
        });
        if (!list.length) {
            host.innerHTML = '<div class="npMvPickEmpty">没有可选的笔记。请先在左侧「数据」里选择文件夹。</div>';
            return;
        }
        var html = '';
        list.forEach(function (t, i) {
            var cur = state.slots[state.active];
            var isCur = cur && cur.kind === t.kind && cur.path === t.path && (t.path || cur.title === t.title);
            html += '<button type="button" class="npMvPickRow' + (isCur ? ' cur' : '') + '" data-mvpick="' + i + '">' +
                '<span class="npMvPickName">' + esc(t.title || t.name) + '</span>' +
                '<span class="npMvPickFolder">' + esc(t.folder || '') + '</span>' +
                '</button>';
        });
        host.innerHTML = html;
        host._targets = list;
        host.onclick = function (e) {
            var row = e.target.closest ? e.target.closest('[data-mvpick]') : null;
            if (!row) return;
            var idx = parseInt(row.getAttribute('data-mvpick'), 10);
            var t = list[idx];
            if (!t) return;
            closePicker();
            assign(state.active, t);
        };
    }

    /* ---------------- 备注 ---------------- */
    function openMemo(id) {
        var s = state.slots[id];
        if (!s) return;
        var m = $('npMvMemoMask');
        if (!m) return;
        _memoId = id;
        var title = $('npMvMemoTitle');
        if (title) title.textContent = '窗口 ' + (id + 1) + ' 备注' +
            (hasContent(s) ? '（' + (s.title || s.name) + '）' : '');
        var ta = $('npMvMemoInput');
        if (ta) { ta.value = s.memo || ''; setTimeout(function () { try { ta.focus(); } catch (e) {} }, 30); }
        m.hidden = false;
    }

    function closeMemo() {
        var m = $('npMvMemoMask');
        if (m) m.hidden = true;
        _memoId = -1;
    }

    function saveMemo(clear) {
        var id = _memoId;
        if (!(id >= 0 && id < COLORS)) { closeMemo(); return; }
        var ta = $('npMvMemoInput');
        var s = state.slots[id];
        if (s) {
            s.memo = clear ? '' : String((ta && ta.value) || '').trim().slice(0, 200);
            saveState();
            renderTabs();
            renderHead();
            if (state.tile) renderBody();
        }
        closeMemo();
    }

    /* ---------------- 悬停提示 ---------------- */
    function ensureTip() {
        if (_tipEl && document.body.contains(_tipEl)) return _tipEl;
        _tipEl = document.createElement('div');
        _tipEl.id = 'npMvTip';
        _tipEl.className = 'npMvTip';
        _tipEl.hidden = true;
        document.body.appendChild(_tipEl);
        return _tipEl;
    }

    function showTip(btn) {
        var id = parseInt(btn.getAttribute('data-mvid'), 10);
        var s = state.slots[id];
        if (!s) return;
        var tip = ensureTip();
        var lines = [];
        lines.push('窗口 ' + (id + 1));
        if (hasContent(s)) lines.push('内容：' + (s.title || s.name || '未命名'));
        else lines.push('未关联内容');
        if (s.memo) lines.push('备注：' + s.memo);
        tip.textContent = '';
        lines.forEach(function (line, i) {
            var row = document.createElement('div');
            row.className = i === 0 ? 'npMvTipTitle' : 'npMvTipLine';
            row.textContent = line;
            tip.appendChild(row);
        });
        tip.hidden = false;
        var r = btn.getBoundingClientRect();
        var w = tip.offsetWidth, h = tip.offsetHeight;
        var left = clamp(r.left, 8, window.innerWidth - w - 8);
        var top = r.bottom + 7;
        if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 7);
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
    }

    function hideTip() {
        if (_tipTimer) { clearTimeout(_tipTimer); _tipTimer = null; }
        if (_tipEl) _tipEl.hidden = true;
    }

    /* ---------------- 右键菜单（参考资料两栏用） ---------------- */
    function closeCtxMenu() {
        var ids = ['npMvCtxMenu', 'npMvMarkMenu'];
        for (var i = 0; i < ids.length; i++) {
            var old = $(ids[i]);
            if (old && old.parentNode) old.parentNode.removeChild(old);
        }
    }

    function showAssignMenu(x, y, target) {
        if (!target) return;
        closeCtxMenu();
        var el = document.createElement('div');
        el.className = 'npMvCtx';
        el.id = 'npMvCtxMenu';
        var head = document.createElement('div');
        head.className = 'npMvCtxHead';
        head.textContent = '添加到小窗';
        el.appendChild(head);
        state.order.forEach(function (id) {
            var s = state.slots[id];
            var it = document.createElement('button');
            it.type = 'button';
            it.className = 'npMvCtxItem';
            it.innerHTML = '<span class="npMvCtxDot npMvDotC' + id + '"></span>' +
                '<span class="npMvCtxName">窗口 ' + (id + 1) + '</span>' +
                '<span class="npMvCtxTick">' + (hasContent(s) ? '✓' : '') + '</span>' +
                '<span class="npMvCtxNow">' + (hasContent(s) ? esc(s.title || s.name || '') : '') + '</span>';
            it.addEventListener('mousedown', function (e) { e.stopPropagation(); });
            it.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closeCtxMenu();
                assign(id, target);
            });
            el.appendChild(it);
        });
        if (typeof target.onDelete === 'function') {
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'npMvCtxItem npMvCtxDanger';
            del.textContent = '删除';
            del.addEventListener('mousedown', function (e) { e.stopPropagation(); });
            del.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closeCtxMenu();
                target.onDelete();
            });
            el.appendChild(del);
        }
        document.body.appendChild(el);
        var w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, x)) + 'px';
        el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, y)) + 'px';
    }

    function bindLists() {
        var tree = $('npPvResTree');
        if (tree && !tree._npMvCtxBound) {
            tree._npMvCtxBound = true;
            tree.addEventListener('contextmenu', function (e) {
                var item = e.target.closest ? e.target.closest('.npPvItem') : null;
                if (item) {
                    var idx = parseInt(item.getAttribute('data-idx'), 10);
                    var st = window.npPrevSearch && window.npPrevSearch._state;
                    var r = st && st.results && st.results[idx];
                    if (r) {
                        e.preventDefault();
                        e.stopPropagation();
                        showAssignMenu(e.clientX, e.clientY, {
                            kind: 'note', path: r.path, name: r.name,
                            title: r.title || r.name, html: r.html
                        });
                        return;
                    }
                }
                var bf = e.target.closest ? e.target.closest('[data-browse-file]') : null;
                if (bf) {
                    var path = bf.getAttribute('data-browse-file');
                    var nm = bf.querySelector ? bf.querySelector('.npTreeName') : null;
                    e.preventDefault();
                    e.stopPropagation();
                    showAssignMenu(e.clientX, e.clientY, {
                        kind: 'note', path: path, name: baseName(path),
                        title: (nm && nm.textContent) || stemOf(baseName(path))
                    });
                }
            });
        }
        var fv = $('npFvBody');
        if (fv && !fv._npMvCtxBound) {
            fv._npMvCtxBound = true;
            fv.addEventListener('contextmenu', function (e) {
                var row = e.target.closest ? e.target.closest('.npFvRow') : null;
                if (!row) return;
                if (row.getAttribute('data-kind') === 'dir') return;
                var path = row.getAttribute('data-path');
                if (!path) return;
                e.preventDefault();
                e.stopPropagation();
                var name = row.getAttribute('data-name') || baseName(path);
                showAssignMenu(e.clientX, e.clientY, {
                    kind: 'file', path: path, name: name, title: name,
                    onDelete: function () {
                        if (typeof window.npFvDeleteFile === 'function') window.npFvDeleteFile(path);
                    }
                });
            });
        }
    }

    /* ---------------- 页签拖动排序 ---------------- */
    function bindTabs() {
        var host = $('npMvTabs');
        if (!host || host._npMvBound) return;
        host._npMvBound = true;
        var dragId = -1;

        host.addEventListener('click', function (e) {
            var b = e.target.closest ? e.target.closest('.npMvTab') : null;
            if (!b) return;
            var id = parseInt(b.getAttribute('data-mvid'), 10);
            if (!(id >= 0 && id < COLORS)) return;
            state.active = id;
            var s = state.slots[id];
            if (s.hidden) { s.hidden = false; saveState(); }
            render();
        });
        host.addEventListener('dblclick', function (e) {
            var b = e.target.closest ? e.target.closest('.npMvTab') : null;
            if (!b) return;
            e.preventDefault();
            openMemo(parseInt(b.getAttribute('data-mvid'), 10));
        });
        host.addEventListener('dragstart', function (e) {
            var b = e.target.closest ? e.target.closest('.npMvTab') : null;
            if (!b) return;
            dragId = parseInt(b.getAttribute('data-mvid'), 10);
            b.classList.add('dragging');
            try {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(dragId));
            } catch (err) {}
            hideTip();
        });
        host.addEventListener('dragover', function (e) {
            if (dragId < 0) return;
            var b = e.target.closest ? e.target.closest('.npMvTab') : null;
            if (!b) return;
            e.preventDefault();
            try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
            var tabs = host.querySelectorAll('.npMvTab');
            for (var i = 0; i < tabs.length; i++) {
                tabs[i].classList.remove('drop-before', 'drop-after');
            }
            var r = b.getBoundingClientRect();
            b.classList.add(e.clientX < r.left + r.width / 2 ? 'drop-before' : 'drop-after');
        });
        host.addEventListener('drop', function (e) {
            if (dragId < 0) return;
            var b = e.target.closest ? e.target.closest('.npMvTab') : null;
            if (!b) return;
            e.preventDefault();
            var overId = parseInt(b.getAttribute('data-mvid'), 10);
            var r = b.getBoundingClientRect();
            var after = e.clientX >= r.left + r.width / 2;
            var from = state.order.indexOf(dragId);
            if (from < 0) { dragId = -1; return; }
            state.order.splice(from, 1);
            var to = state.order.indexOf(overId);
            if (to < 0) to = state.order.length;
            if (after) to += 1;
            state.order.splice(to, 0, dragId);
            dragId = -1;
            saveState();
            render();
        });
        host.addEventListener('dragend', function () {
            dragId = -1;
            var tabs = host.querySelectorAll('.npMvTab');
            for (var i = 0; i < tabs.length; i++) {
                tabs[i].classList.remove('dragging', 'drop-before', 'drop-after');
            }
        });
        host.addEventListener('mouseover', function (e) {
            var b = e.target.closest ? e.target.closest('.npMvTab') : null;
            if (!b) return;
            if (_tipTimer) { clearTimeout(_tipTimer); _tipTimer = null; }
            _tipTimer = setTimeout(function () { showTip(b); }, 260);
        });
        host.addEventListener('mouseout', function (e) {
            var to = e.relatedTarget;
            var b = e.target.closest ? e.target.closest('.npMvTab') : null;
            if (b && (!to || !b.contains(to))) hideTip();
        });
        host.addEventListener('mouseleave', hideTip);
    }

    /* ---------------- 初始化 ---------------- */
    function rememberMarkRange(win) {
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount || sel.isCollapsed) return;
        var range = sel.getRangeAt(0);
        var inner = locateInner(win);
        if (!inner || !inner.contains(range.commonAncestorContainer)) return;
        _markRange = range.cloneRange();
        _markWin = win;
    }

    function restoreMarkRange() {
        if (!_markRange || !_markRange.startContainer || !_markRange.startContainer.isConnected) return;
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(_markRange);
    }

    /* 多窗预览里的选中文字：右键 5 色高亮 + 取消背景色，Ctrl+Shift+1~5 快捷键 */
    function bindMarkMenu() {
        document.addEventListener('mousedown', function (e) {
            if (e.button !== 2) return;
            var doc = e.target.closest ? e.target.closest('#npMultiView .npMvDoc') : null;
            if (!doc) return;
            var win = doc.closest('.npMvWin');
            if (win) rememberMarkRange(win);
        }, true);
        document.addEventListener('contextmenu', function (e) {
            var doc = e.target.closest ? e.target.closest('#npMultiView .npMvDoc') : null;
            if (!doc) return;
            var win = doc.closest('.npMvWin');
            if (!win) return;
            var id = parseInt(win.getAttribute('data-mvwin'), 10);
            var s = state.slots[id];
            if (!s || !hasContent(s)) return;
            e.preventDefault();
            e.stopPropagation();
            if (_markWin === win) restoreMarkRange();
            var sel = window.getSelection();
            var collapsed = !sel || !sel.rangeCount || sel.isCollapsed;
            if (collapsed) {
                closeCtxMenu();
                if (!(s.marks || []).length) { toast('请先选中文字再右键'); return; }
                var el0 = document.createElement('div');
                el0.className = 'npMvCtx npMvMarkMenu';
                el0.id = 'npMvMarkMenu';
                var h0 = document.createElement('div');
                h0.className = 'npMvCtxHead';
                h0.textContent = '高亮背景色';
                el0.appendChild(h0);
                var clearAll = document.createElement('button');
                clearAll.type = 'button';
                clearAll.className = 'npMvCtxItem npMvCtxDanger';
                clearAll.textContent = '清除本窗口全部高亮';
                clearAll.addEventListener('mousedown', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
                clearAll.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    closeCtxMenu();
                    s.marks = [];
                    clearMarksDeep(locateInner(win));
                    saveState();
                    toast('已清除本窗口全部高亮');
                });
                el0.appendChild(clearAll);
                document.body.appendChild(el0);
                var w0 = el0.offsetWidth, h0p = el0.offsetHeight;
                el0.style.left = Math.max(6, Math.min(window.innerWidth - w0 - 6, e.clientX)) + 'px';
                el0.style.top = Math.max(6, Math.min(window.innerHeight - h0p - 6, e.clientY)) + 'px';
                return;
            }
            buildMarkMenu(e.clientX, e.clientY, s, win);
        }, true);
        document.addEventListener('keydown', function (e) {
            if (!state.open || !e.ctrlKey || !e.shiftKey || e.altKey) return;
            var n = -1;
            var code = e.code || '';
            if (/^Digit[1-5]$/.test(code)) n = parseInt(code.slice(5), 10) - 1;
            else if (/^Numpad[1-5]$/.test(code)) n = parseInt(code.slice(6), 10) - 1;
            else if (/^[1-5]$/.test(e.key)) n = parseInt(e.key, 10) - 1;
            else if ('!@#$%'.indexOf(e.key) >= 0) n = '!@#$%'.indexOf(e.key);
            if (n < 0) return;
            var win = _markWin;
            var sel = window.getSelection();
            if (!win || !document.contains(win)) {
                var active = document.querySelector('#npMultiView .npMvWin');
                win = active;
            }
            if (!win) return;
            var inner = locateInner(win);
            if (!inner || !sel || !sel.rangeCount) return;
            if (!inner.contains(sel.getRangeAt(0).commonAncestorContainer)) {
                restoreMarkRange();
                sel = window.getSelection();
                if (!sel || !sel.rangeCount || !inner.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
            }
            e.preventDefault();
            e.stopPropagation();
            var id = parseInt(win.getAttribute('data-mvwin'), 10);
            var s = state.slots[id];
            if (s) addMark(s, win, n);
        }, true);
    }

    function bind() {
        bindMarkMenu();
        var top = $('npMultiViewBtn');
        if (top && !top._npMvBound) {
            top._npMvBound = true;
            top.addEventListener('click', function (e) {
                e.preventDefault();
                if (state.open) close();
                else if (typeof window.npActivatePage === 'function') window.npActivatePage('multiview');
                else open();
            });
        }
        var closeBtn = $('npMvCloseBtn');
        if (closeBtn && !closeBtn._npMvBound) {
            closeBtn._npMvBound = true;
            closeBtn.addEventListener('click', function (e) { e.preventDefault(); close(); });
        }
        var tileBtn = $('npMvTileBtn');
        if (tileBtn && !tileBtn._npMvBound) {
            tileBtn._npMvBound = true;
            tileBtn.addEventListener('click', function (e) {
                e.preventDefault();
                state.tile = !state.tile;
                state.ratios = [1, 1, 1, 1, 1];
                saveState();
                render();
            });
        }
        var pickBtn = $('npMvPickBtn');
        if (pickBtn && !pickBtn._npMvBound) {
            pickBtn._npMvBound = true;
            pickBtn.addEventListener('click', function (e) {
                e.preventDefault();
                var p = $('npMvPicker');
                if (p && !p.hidden) closePicker();
                else openPicker();
            });
        }
        var pickFileBtn = $('npMvPickFileBtn');
        if (pickFileBtn && !pickFileBtn._npMvBound) {
            pickFileBtn._npMvBound = true;
            pickFileBtn.addEventListener('click', function (e) {
                e.preventDefault();
                if ($('npMvPicker') && !$('npMvPicker').hidden) closePicker();
                pickLocalFileForSlot();
            });
        }
        var clearBtn = $('npMvClearBtn');
        if (clearBtn && !clearBtn._npMvBound) {
            clearBtn._npMvBound = true;
            clearBtn.addEventListener('click', function (e) {
                e.preventDefault();
                if ($('npMvPicker') && !$('npMvPicker').hidden) closePicker();
                clearActiveSlot();
            });
        }
        var pickInput = $('npMvPickerInput');
        if (pickInput && !pickInput._npMvBound) {
            pickInput._npMvBound = true;
            pickInput.addEventListener('input', renderPicker);
            pickInput.addEventListener('keydown', function (e) {
                e.stopPropagation();
                if (e.key === 'Escape') { e.preventDefault(); closePicker(); }
            });
        }
        var pickClose = $('npMvPickerClose');
        if (pickClose && !pickClose._npMvBound) {
            pickClose._npMvBound = true;
            pickClose.addEventListener('click', function (e) { e.preventDefault(); closePicker(); });
        }
        var pickClear = $('npMvPickerClear');
        if (pickClear && !pickClear._npMvBound) {
            pickClear._npMvBound = true;
            pickClear.addEventListener('click', function (e) {
                e.preventDefault();
                closePicker();
                clearSlot(state.active);
            });
        }
        var memoClose = $('npMvMemoClose');
        if (memoClose && !memoClose._npMvBound) {
            memoClose._npMvBound = true;
            memoClose.addEventListener('click', function (e) { e.preventDefault(); closeMemo(); });
        }
        var memoCancel = $('npMvMemoCancel');
        if (memoCancel && !memoCancel._npMvBound) {
            memoCancel._npMvBound = true;
            memoCancel.addEventListener('click', function (e) { e.preventDefault(); closeMemo(); });
        }
        var memoSave = $('npMvMemoSave');
        if (memoSave && !memoSave._npMvBound) {
            memoSave._npMvBound = true;
            memoSave.addEventListener('click', function (e) { e.preventDefault(); saveMemo(false); });
        }
        var memoClear = $('npMvMemoClear');
        if (memoClear && !memoClear._npMvBound) {
            memoClear._npMvBound = true;
            memoClear.addEventListener('click', function (e) { e.preventDefault(); saveMemo(true); });
        }
        var mask = $('npMvMemoMask');
        if (mask && !mask._npMvBound) {
            mask._npMvBound = true;
            mask.addEventListener('mousedown', function (e) {
                if (e.target === mask) closeMemo();
            });
        }
        bindTabs();
        bindLists();
        document.addEventListener('mousedown', function (e) {
            if (_tipEl && !_tipEl.hidden) hideTip();
            var ctx = $('npMvCtxMenu') || $('npMvMarkMenu');
            if (ctx && !ctx.contains(e.target)) closeCtxMenu();
            var picker = $('npMvPicker');
            if (picker && !picker.hidden && !picker.contains(e.target)) {
                var pb = $('npMvPickBtn');
                if (!(pb && pb.contains(e.target))) closePicker();
            }
        }, true);
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var m = $('npMvMemoMask');
            if (m && !m.hidden) { e.preventDefault(); closeMemo(); return; }
            var p = $('npMvPicker');
            if (p && !p.hidden) { e.preventDefault(); closePicker(); return; }
            if ($('npMvCtxMenu') || $('npMvMarkMenu')) { e.preventDefault(); closeCtxMenu(); return; }
            if (state.open) { e.preventDefault(); close(); }
        });
        window.addEventListener('resize', function () {
            if (!state.open) return;
            ensureWidth();
        });
    }

    loadState();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }

    window.npMultiView = {
        open: open,
        close: close,
        toggle: toggle,
        assign: assign,
        clear: clearSlot,
        showAssignMenu: showAssignMenu,
        refresh: function () { if (state.open) render(); },
        syncWidth: ensureWidth,
        slotMark: function (id) { return hasContent(state.slots[id]) ? ' ✓' : ''; },
        slotOccupied: function (id) { return hasContent(state.slots[id]); },
        _state: state
    };
})();




