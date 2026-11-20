/* 致知笔记 · 编辑区右键菜单
   编辑器模块删除后编辑区丢了右键菜单，这里重建。
   菜单顺序（2026-11-05 第八轮按用户要求确定）：
     1. 打开/取消自动格式      —— 始终显示，文案随状态切换
     2. 插入符号               —— 始终显示；面板支持自定义符号增删改
     3. 层级 ▸                 —— 仅选中内容时显示，子项同工具条「层级」
     4. 添加索引               —— 仅选区/光标在文章标题段落时显示
     5. 高亮背景色 ▸           —— 仅选中内容时显示，5 色
     6. 替换                   —— 始终显示，打开替换窗口
     7. 缩放 ▸                 —— 始终显示
     8. 隐藏/展开功能栏        —— 始终显示，文案随状态切换
     9. 重复格式操作（Ctrl+Shift+A） —— 仅有选区且有可重复操作时显示，直接显示操作名

   实际弹出顺序（与上面一致）：自动格式 → 插入符号 → 层级 → 添加索引 → 高亮背景色 → 替换 → 缩放 → 隐藏功能栏 →【分隔线】→ 重复格式操作
   原则：每项都调项目里已有的函数，不另起一套实现。 */
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }
    function editor() { return $('notepadEditor'); }
    function toast(msg) { if (typeof window.showToast === 'function') window.showToast(msg); }

    var MENU_ID = 'npEditorCtxMenu';
    var _ctxRange = null;
    var _preCtxRange = null;

    /* ---------------- 选区保存 ----------------
       浏览器在右键 mousedown 后会把选区折叠掉，到 contextmenu 时
       getSelection() 已经是空的，所以必须提前存。 */
    function saveCtxRange() {
        var ed = editor();
        if (!ed) return null;
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        var r = sel.getRangeAt(0);
        if (!ed.contains(r.startContainer)) return null;
        _ctxRange = r.cloneRange();
        return _ctxRange;
    }

    function restoreCtxRange() {
        var ed = editor();
        var r = _ctxRange;
        if (!r || !ed) return;
        try {
            if (!r.startContainer.isConnected || !ed.contains(r.startContainer)) return;
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
            if (typeof window._npSetSavedRange === 'function') window._npSetSavedRange(r);
        } catch (e) {}
    }

    /* 「添加索引」还要把选区同步给 notepad.js：
       它优先读 _notepadCtxRange / _npCtxArticlePara，光恢复浏览器选区不够。
       麒麟下右键常把选区折叠，这里按 startContainer 取段落兜底。 */
    function syncIndexSelection() {
        var ed = editor();
        if (!ed) return;
        var sel = window.getSelection();
        var r = null;
        if (sel && sel.rangeCount) {
            var sr = sel.getRangeAt(0);
            if (ed.contains(sr.startContainer)) r = sr;
        }
        if (!r && _ctxRange) r = _ctxRange;
        if (!r) return;
        try {
            var p = r.startContainer;
            if (p && p.nodeType === 3) p = p.parentNode;
            while (p && p !== ed && !/^(P|DIV)$/.test(p.tagName)) p = p.parentNode;
            if (p && p !== ed) window._npCtxArticlePara = p;
            var clone = r.cloneRange();
            window._notepadCtxRange = clone;
            if (typeof window._npSetSavedRange === 'function') window._npSetSavedRange(clone);
        } catch (e) {}
    }

    function hasSelection() {
        return !!(_ctxRange && !_ctxRange.collapsed);
    }

    /* 光标/选区所在的段落元素 */
    function ctxParagraph() {
        var ed = editor();
        if (!ed || !_ctxRange) return null;
        var node = _ctxRange.startContainer;
        if (node && node.nodeType === 3) node = node.parentNode;
        while (node && node !== ed && !/^(P|DIV)$/.test(node.tagName)) node = node.parentNode;
        return (node && node !== ed) ? node : null;
    }

    /* 是否在「文章标题」段落（用于「添加索引」的显示判断） */
    function inArticleTitlePara() {
        var p = ctxParagraph();
        if (!p) return false;
        try {
            if (window._npIsArticleTitlePara && window._npIsArticleTitlePara(p)) return true;
        } catch (e) {}
        var lv = p.getAttribute('data-outline-level');
        if (lv === 'title') return true;
        /* 兜底：本身是文章标题样式（居中 + 大字号） */
        var cls = p.className || '';
        return /npArticleTitle|article-title/.test(cls);
    }

    /* ---------------- 菜单构建 ---------------- */
    function mkItem(id, text, run) {
        var row = document.createElement('div');
        row.className = 'paCtxItem';
        row.setAttribute('data-npctx', id);
        var label = document.createElement('span');
        label.textContent = text;
        row.appendChild(label);
        row.addEventListener('click', function (ev) {
            ev.stopPropagation();
            hideMenu();
            if (run) { restoreCtxRange(); run(); }
        });
        return row;
    }

    function mkSub(id, text, sub) {
        var row = document.createElement('div');
        row.className = 'paCtxItem paCtxHasSub';
        row.setAttribute('data-npctx', id);
        var label = document.createElement('span');
        label.textContent = text;
        row.appendChild(label);
        var arrow = document.createElement('span');
        arrow.className = 'paCtxArrow';
        arrow.textContent = '▸';
        row.appendChild(arrow);
        var box = document.createElement('div');
        box.className = 'paCtxSubmenu';
        sub.forEach(function (s) { box.appendChild(s); });
        row.appendChild(box);
        return row;
    }

    function mkDivider() {
        var d = document.createElement('div');
        d.className = 'paCtxDivider';
        return d;
    }

    function buildMenu() {
        var menu = document.createElement('div');
        menu.className = 'paContextMenu';
        menu.id = MENU_ID;

        /* 1. 自动格式 */
        menu.appendChild(mkItem('autoFormat', '打开自动格式', toggleAutoFormat));

        /* 2. 插入符号（始终显示） */
        menu.appendChild(mkItem('insertSymbol', '插入符号', openSymbolPanel));

        /* 3. 层级（有选区才显示） */
        var levelItems = [
            ['level-index', '索引标题'], ['level-title', '文章标题'], ['level-date', '作者/日期'],
            ['level-recipient', '主送单位'], ['level-1', '一级标题'], ['level-2', '二级标题'],
            ['level-3', '三级标题'], ['level-body', '正文'], ['level-remark', '注释'],
            ['level-secret', '密级/附件'], ['level-attachment', '附件']
        ];
        menu.appendChild(mkSub('level', '层级', levelItems.map(function (it) {
            return mkItem(it[0], it[1], function () { applyLevel(it[0]); });
        })));

        /* 4. 添加索引（文章标题段落才显示） */
        menu.appendChild(mkItem('addIndex', '添加索引', addIndex));

        /* 4b. 更新索引（右键落在索引标题段落上才显示） */
        menu.appendChild(mkItem('updateIndex', '更新索引', updateIndex));

        /* 5. 高亮背景色（有选区才显示），最后一项固定为「取消背景色」 */
        var highlightItems = COLORS.map(function (c, ci) {
            var row = document.createElement('div');
            row.className = 'paCtxItem';
            var sw = document.createElement('span');
            sw.className = 'paCtxBgSwatch';
            sw.style.background = c[1];
            sw.style.borderColor = c[2];
            row.appendChild(sw);
            var lb = document.createElement('span');
            lb.textContent = c[3];
            row.appendChild(lb);
            var kbd = document.createElement('span');
            kbd.className = 'paCtxKbd';
            kbd.textContent = 'Ctrl+Shift+' + (ci + 1);
            row.appendChild(kbd);
            row.addEventListener('click', function (ev) {
                ev.stopPropagation();
                hideMenu();
                restoreCtxRange();
                applyHighlight(c[1], c[3]);
            });
            return row;
        });
        highlightItems.push(mkItem('highlightClear', '取消背景色', clearHighlight));
        menu.appendChild(mkSub('highlight', '高亮背景色', highlightItems));

        /* 6. 替换 */
        menu.appendChild(mkItem('replace', '替换', openReplace));

        /* 7. 缩放 */
        menu.appendChild(mkSub('zoom', '缩放', [
            mkItem('zoomIn', '放大', function () { if (typeof notepadZoomIn === 'function') notepadZoomIn(); }),
            mkItem('zoomOut', '缩小', function () { if (typeof notepadZoomOut === 'function') notepadZoomOut(); })
        ]));

        /* 8. 隐藏功能栏 */
        menu.appendChild(mkItem('showSettings', '隐藏功能栏', toggleSettings));

        /* 9. 重复格式操作 */
        menu.appendChild(mkDivider());
        menu.appendChild(mkItem('repeatFormat', '重复格式操作（Ctrl+Shift+A）', repeatFormat));

        document.body.appendChild(menu);
        return menu;
    }

    function ensureMenu() { return $(MENU_ID) || buildMenu(); }

    function hideMenu() {
        var m = $(MENU_ID);
        if (m) m.classList.remove('show');
        closeSymbolPanel();
        closeReplaceDialog();
    }

    function setVisible(id, show) {
        var el = document.querySelector('#' + MENU_ID + ' [data-npctx="' + id + '"]');
        if (el) el.style.display = show ? '' : 'none';
    }

    function setText(id, text) {
        var el = document.querySelector('#' + MENU_ID + ' [data-npctx="' + id + '"] span');
        if (el) el.textContent = text;
    }

    /* 按当前上下文刷新显示 / 文案 */
    function refreshMenu() {
        var menu = $(MENU_ID);
        if (!menu) return;

        /* 1. 自动格式 */
        var on = window.S ? !!window.S._autoFormatEnabled : false;
        setText('autoFormat', on ? '取消自动格式' : '打开自动格式');

        /* 3. 层级：有选区才显示 */
        var sel = hasSelection();
        setVisible('level', sel);

        /* 4. 添加索引：光标在文章标题段落，或选中该段落，都显示 */
        setVisible('addIndex', inArticleTitlePara() || inArticleTitleParaWithCursor());
        /* 4b. 更新索引：右键落在索引标题段落上 */
        setVisible('updateIndex', inIndexPara());

        /* 5. 高亮：有选区才显示 */
        setVisible('highlight', sel);

        /* 8. 隐藏功能栏：按状态切文案 */
        var panel = $('notepadPanel');
        var hidden = !!(panel && panel.classList.contains('toolbars-hidden'));
        setText('showSettings', hidden ? '展开功能栏' : '隐藏功能栏');

        /* 9. 重复格式操作：有选区 + 有可重复操作，直接显示操作名 */
        var label = (typeof window._npGetLastFormatLabel === 'function') ? window._npGetLastFormatLabel() : '';
        var showRepeat = sel && !!label;
        setVisible('repeatFormat', showRepeat);
        if (showRepeat) setText('repeatFormat', label + '（Ctrl+Shift+A）');

        /* 分隔线也跟着隐藏（重复格式在最末，前面那条线没有其它用途） */
        var divs = menu.querySelectorAll('.paCtxDivider');
        if (divs.length) divs[divs.length - 1].style.display = showRepeat ? '' : 'none';
    }

    /* 是否右键在索引标题段落上（只有索引标题可以「更新索引」） */
    function inIndexPara() {
        var p = ctxParagraph();
        if (!p) return false;
        if (p.getAttribute('data-outline-level') !== '1') return false;
        if (window._npIsIndexTitlePara) {
            try { return !!window._npIsIndexTitlePara(p); } catch (e) {}
        }
        return p.getAttribute('data-level') !== 'title';
    }

    /* 用索引下面紧跟的文章标题重写索引标题 */
    function updateIndex() {
        var p = ctxParagraph();
        if (!p) { toast('请将光标放在索引标题上'); return; }
        if (typeof window.npUpdateIndexTitle !== 'function') { toast('更新索引功能不可用'); return; }
        try { window.npUpdateIndexTitle(p); } catch (e) { toast('更新索引失败'); }
    }

    /* 光标折叠时判断是否在文章标题段落 */
    function inArticleTitleParaWithCursor() {
        var p = ctxParagraph();
        if (!p) return false;
        if (window._npIsArticleTitlePara) {
            try { return !!window._npIsArticleTitlePara(p); } catch (e) {}
        }
        return p.getAttribute('data-outline-level') === 'title';
    }

    function placeMenu(menu, x, y) {
        menu.classList.add('show');
        menu.style.left = '0px';
        menu.style.top = '0px';
        var r = menu.getBoundingClientRect();
        var left = x, top = y;
        if (left + r.width > window.innerWidth - 6) left = Math.max(6, x - r.width);
        if (top + r.height > window.innerHeight - 6) top = Math.max(6, y - r.height);
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
        fitSubmenus(menu);
    }

    /* 二级子菜单自动内收：
       一级菜单已按视口放过，但子菜单是 hover 时才显示的绝对定位块，
       默认向右(+左100%)、向上(-4px)展开，靠近屏幕右边/下边时会被切掉。
       做法：先在隐藏状态量出每个子菜单的真实尺寸，按父项位置决定
       「向右还是向左」、并微调 top 让它在视口内。 */
    var ITEM_GAP = 3;
    function fitSubmenus(menu) {
        var subs = menu.querySelectorAll('.paCtxHasSub');
        var vw = window.innerWidth, vh = window.innerHeight;
        for (var i = 0; i < subs.length; i++) {
            var row = subs[i];
            var sub = row.querySelector('.paCtxSubmenu');
            if (!sub) continue;
            /* 重置，便于每次都用默认值重算 */
            sub.style.left = '';
            sub.style.right = '';
            sub.style.top = '';
            sub.style.maxHeight = '';
            sub.style.overflowY = '';
            sub.style.overflowX = '';
            sub.style.maxWidth = '';

            /* 临时显示以量尺寸（visibility 隐藏不影响布局） */
            var prevVis = sub.style.visibility;
            sub.style.visibility = 'hidden';
            sub.style.display = 'block';
            var sr = sub.getBoundingClientRect();
            sub.style.display = '';
            sub.style.visibility = prevVis;
            if (!sr.width) continue;

            var rowR = row.getBoundingClientRect();
            var menuR = menu.getBoundingClientRect();

            /* 横向：默认向右展开（menuLeft + menuWidth）；放不下就翻到左侧。
               直接用内联 left/right 控制，避免被别的 display 规则干扰。 */
            var rightEdge = menuR.left + menuR.width + sr.width;
            var leftEdge = menuR.left - sr.width;
            if (rightEdge > vw - 6) {
                if (leftEdge >= 6) {
                    sub.style.left = 'auto';
                    sub.style.right = '100%';
                } else {
                    /* 两边都放不下：贴右边，并允许横向滚动 */
                    sub.style.left = 'auto';
                    sub.style.right = '0';
                    sub.style.maxWidth = Math.max(120, vw - 12) + 'px';
                    sub.style.overflowX = 'auto';
                }
            }

            /* 纵向：子菜单默认 top:-4px（对齐父项顶部）；底边超视口就上提 */
            var subTopBase = rowR.top - 4;
            var subH = sr.height;
            var overflowBottom = subTopBase + subH - (vh - 6);
            if (overflowBottom > 0) {
                var newTop = -4 - overflowBottom;
                /* 上提后不能把子菜单顶出屏幕上方 */
                var minTop = (6 - rowR.top);
                if (newTop < minTop) {
                    newTop = minTop;
                    /* 实在放不下就给最大高度 + 纵向滚动 */
                    sub.style.maxHeight = Math.max(120, vh - 12) + 'px';
                    sub.style.overflowY = 'auto';
                }
                sub.style.top = Math.round(newTop) + 'px';
            }
        }
    }

    /* ---------------- 各项动作 ---------------- */
    function toggleAutoFormat() {
        if (typeof window._setNotepadAutoFormatEnabled === 'function') {
            var on = window.S ? !!window.S._autoFormatEnabled : false;
            window._setNotepadAutoFormatEnabled(!on);
        }
    }

    function toggleSettings() {
        if (typeof window.toggleNotepadToolbars === 'function') window.toggleNotepadToolbars();
    }

    function applyLevel(lv) {
        if (typeof window.applyNotepadLevel === 'function') window.applyNotepadLevel(lv);
        else toast('层级功能不可用');
    }

    function addIndex() {
        restoreCtxRange();
        syncIndexSelection();
        try {
            if (typeof window.addNotepadDirEntry === 'function') window.addNotepadDirEntry();
            else toast('当前环境不支持该操作');
        } finally {
            window._notepadCtxRange = null;
            window._npCtxArticlePara = null;
        }
    }

    /* 5 种高亮背景色（顺序固定，Ctrl+Shift+1~5 与之对应） */
    var COLORS = [
        ['yellow', '#fff176', '#fdd835', '黄色'],
        ['blue', '#42a5f5', '#1e88e5', '蓝色'],
        ['red', '#ef5350', '#e53935', '红色'],
        ['green', '#66bb6a', '#43a047', '绿色'],
        ['purple', '#ab47bc', '#8e24aa', '紫色']
    ];

    /* applyHighlight(bg, name, repeat)
       repeat=true 表示这次调用来自「重复格式操作」或快捷键：
       不再注册新的重复项，避免把重复项自身覆盖掉。 */
    function applyHighlight(bg, name, repeat) {
        var ed = editor();
        var sel = window.getSelection();
        /* 重复操作 / 快捷键：当前选区若在编辑区内就直接用；否则回退到右键存的选区 */
        if (!sel || !sel.rangeCount || sel.isCollapsed || !sel.anchorNode || !ed || !ed.contains(sel.anchorNode)) {
            restoreCtxRange();
            sel = window.getSelection();
        }
        if (!ed || !sel || !sel.rangeCount || sel.isCollapsed) {
            toast('请先选取要加高亮的文字');
            return;
        }
        try {
            if (typeof window._npApplyUnifiedFormat === 'function' && typeof window._npMarkManualRange === 'function') {
                var range = sel.getRangeAt(0);
                window._npApplyUnifiedFormat(range, sel, ed, 'backgroundColor', bg, [], 'span');
                sel.removeAllRanges();
            } else {
                document.execCommand('hiliteColor', false, bg);
            }
            if (!repeat && typeof window._npSetLastFormat === 'function') {
                window._npSetLastFormat(name + '高亮', function () {
                    applyHighlight(bg, name, true);
                });
            }
            if (typeof window.onNotepadInput === 'function') { try { window.onNotepadInput(); } catch (e) {} }
            toast('已设为' + name + '高亮');
        } catch (e) {
            toast('高亮失败：' + (e && e.message ? e.message : e));
        }
    }

    /* 取消选区文字的底色：只清 backgroundColor，不动字体 / 字号 / 粗细 */
    function clearHighlight() {
        var ed = editor();
        var sel = window.getSelection();
        if (!ed || !sel || !sel.rangeCount || sel.isCollapsed) {
            toast('请先选取要取消背景色的文字');
            return;
        }
        try {
            var ok = false;
            try { ok = document.execCommand('hiliteColor', false, 'transparent'); } catch (e0) { ok = false; }
            if (!ok && typeof window._npApplyUnifiedFormat === 'function') {
                var range = sel.getRangeAt(0);
                window._npApplyUnifiedFormat(range, sel, ed, 'backgroundColor', '', ['SPAN', 'FONT', 'MARK'], 'span');
            }
            /* execCommand 会留下 style="" 的空壳；透明色也一并清掉 */
            var allStyled = ed.querySelectorAll('[style]');
            for (var i = 0; i < allStyled.length; i++) {
                var st = allStyled[i].getAttribute('style') || '';
                if (!st.replace(/\s+/g, '')) { allStyled[i].removeAttribute('style'); continue; }
                if (/background(?:-color)?\s*:\s*(?:transparent|rgba\(0,\s*0,\s*0,\s*0\))/i.test(st)) {
                    allStyled[i].style.backgroundColor = '';
                    allStyled[i].style.background = '';
                    if (!(allStyled[i].getAttribute('style') || '').replace(/\s+/g, '')) allStyled[i].removeAttribute('style');
                }
            }
            if (typeof window.onNotepadInput === 'function') { try { window.onNotepadInput(); } catch (e) {} }
            toast('已取消背景色');
        } catch (e2) {
            toast('取消背景色失败：' + (e2 && e2.message ? e2.message : e2));
        }
    }

    function repeatFormat() {
        if (typeof window._npRepeatLastFormat === 'function') window._npRepeatLastFormat();
        else toast('暂无可重复的格式操作');
    }

    function openReplace() {
        if (typeof window.npOpenReplaceDialog === 'function') {
            window.npOpenReplaceDialog(_ctxRange);
        } else {
            toast('替换功能未加载');
        }
    }

    /* ---------------- 插入符号面板 ---------------- */
    var SYM_KEY = 'npCustomSymbols';
    var SYM_DEFAULT = ['○', '◇', '“”', '《》', '【】', '·', '……', '～', '：', '★', '☆', '￥'];
    var CIRCLE = (function () {
        var a = [];
        for (var i = 1; i <= 20; i++) a.push('①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'[i - 1]);
        return a;
    })();
    var PAREN = (function () {
        var a = [];
        for (var i = 1; i <= 20; i++) a.push('⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽⑾⑿⒀⒁⒂⒃⒄⒅⒆⒇'[i - 1]);
        return a;
    })();

    var _symTab = 'custom';
    var _symEditing = false;

    function loadCustomSymbols() {
        try {
            var v = JSON.parse(localStorage.getItem(SYM_KEY) || 'null');
            if (Array.isArray(v) && v.length) return v;
        } catch (e) {}
        return SYM_DEFAULT.slice();
    }

    function saveCustomSymbols(list) {
        try { localStorage.setItem(SYM_KEY, JSON.stringify(list)); } catch (e) {}
    }

    function symbolList() {
        if (_symTab === 'circle') return CIRCLE;
        if (_symTab === 'paren') return PAREN;
        return loadCustomSymbols();
    }

    function renderSymbolGrid() {
        var grid = $('npSymbolGrid');
        if (!grid) return;
        var list = symbolList();
        grid.innerHTML = '';
        list.forEach(function (sym, idx) {
            var wrap = document.createElement('div');
            wrap.className = 'npSymbolItemWrap';
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'npSymbolItem';
            b.textContent = sym;
            b.title = sym;
            b.addEventListener('mousedown', function (e) { e.preventDefault(); });
            b.addEventListener('click', function () {
                restoreCtxRange();
                document.execCommand('insertText', false, sym);
                if (typeof window.onNotepadInput === 'function') { try { window.onNotepadInput(); } catch (e) {} }
                closeSymbolPanel();
            });
            wrap.appendChild(b);
            /* 只有「自定义符号」页、编辑态才显示删除角标 */
            if (_symEditing && _symTab === 'custom') {
                var del = document.createElement('button');
                del.type = 'button';
                del.className = 'npSymbolDel';
                del.textContent = '×';
                del.title = '删除这个符号';
                del.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
                del.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var cur = loadCustomSymbols();
                    cur.splice(idx, 1);
                    saveCustomSymbols(cur);
                    renderSymbolGrid();
                });
                wrap.appendChild(del);
            }
            grid.appendChild(wrap);
        });
        if (!list.length) {
            grid.innerHTML = '<div class="npSymbolEmpty">还没有自定义符号，点「编辑」后可在下方添加。</div>';
        }
    }

    function syncSymbolTabs() {
        var tabs = document.querySelectorAll('#npSymbolPanel .npSymbolTab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle('active', tabs[i].getAttribute('data-npsymtab') === _symTab);
        }
        var panel = $('npSymbolPanel');
        if (panel) panel.classList.toggle('editing', _symEditing && _symTab === 'custom');
        var editBtn = $('npSymbolEditBtn');
        if (editBtn) {
            editBtn.classList.toggle('active', _symEditing);
            editBtn.textContent = _symEditing ? '完成' : '编辑';
            editBtn.style.display = _symTab === 'custom' ? '' : 'none';
        }
    }

    function closeSymbolPanel() {
        var p = $('npSymbolPanel');
        if (p && p.classList.contains('show')) {
            p.classList.remove('show');
            _symEditing = false;
        }
    }

    function openSymbolPanel() {
        var p = $('npSymbolPanel');
        if (!p) { buildSymbolPanel(); p = $('npSymbolPanel'); }
        if (!p) return;
        if (p.classList.contains('show')) { closeSymbolPanel(); return; }
        _symTab = 'custom';
        _symEditing = false;
        syncSymbolTabs();
        renderSymbolGrid();
        /* 定位到右键处 */
        var r = _ctxRange ? _ctxRange.getBoundingClientRect() : null;
        p.classList.add('show');
        p.style.left = '0px';
        p.style.top = '0px';
        var pr = p.getBoundingClientRect();
        var left = r ? r.left : (window.innerWidth / 2 - pr.width / 2);
        var top = r ? (r.bottom + 8) : (window.innerHeight / 2 - pr.height / 2);
        if (left + pr.width > window.innerWidth - 10) left = window.innerWidth - pr.width - 10;
        if (left < 10) left = 10;
        if (top + pr.height > window.innerHeight - 10) top = Math.max(10, (r ? r.top : 0) - pr.height - 8);
        p.style.left = left + 'px';
        p.style.top = top + 'px';
    }

    function buildSymbolPanel() {
        var old = $('npSymbolPanel');
        if (old) old.remove();

        var panel = document.createElement('div');
        panel.id = 'npSymbolPanel';
        panel.className = 'npSymbolPanel';

        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'npSymbolClose';
        close.textContent = '×';
        close.title = '关闭';
        close.addEventListener('click', closeSymbolPanel);
        panel.appendChild(close);

        var tabs = document.createElement('div');
        tabs.className = 'npSymbolTabs';
        [['custom', '自定义符号'], ['circle', '圆圈序号'], ['paren', '括弧序号']].forEach(function (t) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'npSymbolTab';
            b.setAttribute('data-npsymtab', t[0]);
            b.textContent = t[1];
            b.addEventListener('click', function () {
                _symTab = t[0];
                _symEditing = false;
                syncSymbolTabs();
                renderSymbolGrid();
            });
            tabs.appendChild(b);
        });
        panel.appendChild(tabs);

        var grid = document.createElement('div');
        grid.className = 'npSymbolGrid';
        grid.id = 'npSymbolGrid';
        panel.appendChild(grid);

        var bottom = document.createElement('div');
        bottom.className = 'npSymbolBottom';

        var custom = document.createElement('div');
        custom.className = 'npSymbolCustom';
        var input = document.createElement('input');
        input.type = 'text';
        input.id = 'npSymbolCustomInput';
        input.placeholder = '输入符号，如 §';
        input.maxLength = 6;
        custom.appendChild(input);
        var addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = '添加';
        addBtn.addEventListener('click', function () {
            var v = (input.value || '').trim();
            if (!v) { toast('请输入要添加的符号'); return; }
            var cur = loadCustomSymbols();
            if (cur.indexOf(v) >= 0) { toast('这个符号已经在列表里了'); return; }
            cur.push(v);
            saveCustomSymbols(cur);
            input.value = '';
            renderSymbolGrid();
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
        });
        custom.appendChild(addBtn);
        bottom.appendChild(custom);

        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'npSymbolEditBtn';
        editBtn.id = 'npSymbolEditBtn';
        editBtn.textContent = '编辑';
        editBtn.addEventListener('click', function () {
            _symEditing = !_symEditing;
            syncSymbolTabs();
            renderSymbolGrid();
            if (_symEditing) { var i2 = $('npSymbolCustomInput'); if (i2) i2.focus(); }
        });
        bottom.appendChild(editBtn);
        panel.appendChild(bottom);

        document.body.appendChild(panel);
    }

    /* ---------------- 替换窗口（单组，参照老版记事本） ---------------- */
    var _rpl = { occs: [], timer: null, find: '', cls: 'npRplHL' };

    function rplEsc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    /* 老版规则：X / x / * / - / × 都是通配符，可跨任意文字 */
    function rplIsWild(ch) { return ch === 'X' || ch === 'x' || ch === '*' || ch === '-' || ch === '×'; }
    function rplParse(str) {
        var segs = [], cur = '';
        for (var i = 0; i < str.length; i++) {
            if (rplIsWild(str.charAt(i))) { segs.push(cur); cur = ''; }
            else cur += str.charAt(i);
        }
        segs.push(cur);
        return { segs: segs, wc: segs.length - 1 };
    }
    function rplRegex(segs, wc) {
        var escRe = function (s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
        if (wc <= 0) return new RegExp(escRe(segs[0]), 'g');
        var parts = [];
        for (var i = 0; i < segs.length; i++) {
            parts.push(escRe(segs[i]));
            if (i < segs.length - 1) parts.push('([\\s\\S]*?)');
        }
        return new RegExp(parts.join(''), 'g');
    }
    function rplRenderReplace(replaceStr, groups) {
        var p = rplParse(replaceStr);
        if (p.wc <= 0) return p.segs[0];
        var out = '';
        for (var i = 0; i < p.segs.length; i++) {
            out += p.segs[i];
            if (i < groups.length) out += (groups[i] == null ? '' : groups[i]);
        }
        return out;
    }

    function unwrapRplSpans() {
        var ed = editor();
        if (!ed) return;
        var spans = ed.querySelectorAll('span.' + _rpl.cls);
        for (var i = 0; i < spans.length; i++) {
            var sp = spans[i], parent = sp.parentNode;
            if (!parent) continue;
            while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
            parent.removeChild(sp);
        }
    }

    function rplParagraphs() {
        var ed = editor();
        if (!ed) return [];
        var ps = Array.prototype.slice.call(ed.querySelectorAll('p'));
        return ps.length ? ps : [ed];
    }

    function rplBuildOriginal(frag, occ, pat) {
        for (var i = 0; i < pat.segs.length; i++) {
            if (pat.segs[i]) {
                var s = document.createElement('span');
                s.className = occ.cls;
                s.textContent = pat.segs[i];
                frag.appendChild(s);
                occ.spans.push(s);
            }
            if (i < occ.groups.length) frag.appendChild(document.createTextNode(occ.groups[i] || ''));
        }
    }

    function rplScanTextNode(tn, re, pat, occs) {
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
            var occ = {
                cls: _rpl.cls, find: mm[0], groups: mm.slice(1), spans: [],
                replaced: false, originalText: mm[0], newText: '',
                sentBefore: '', sentKw: mm[0], sentAfter: ''
            };
            rplBuildOriginal(frag, occ, pat);
            occs.push(occ);
            last = mm.index + mm[0].length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        if (tn.parentNode) tn.parentNode.replaceChild(frag, tn);
    }

    function rplScanParagraph(p, re, pat, occs) {
        var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
        var nodes = [], n;
        while ((n = walker.nextNode())) nodes.push(n);
        for (var i = 0; i < nodes.length; i++) rplScanTextNode(nodes[i], re, pat, occs);
    }

    function rplSentence(p, occ) {
        try {
            var r1 = document.createRange();
            r1.setStart(p, 0);
            r1.setEndBefore(occ.spans[0]);
            var start = r1.toString().length;
            var r2 = document.createRange();
            r2.setStart(p, 0);
            r2.setEndAfter(occ.spans[occ.spans.length - 1]);
            var end = r2.toString().length;
            var text = p.textContent || '';
            var bounds = '，。…；：\n';
            var s = start;
            while (s > 0 && bounds.indexOf(text.charAt(s - 1)) < 0) s--;
            var e = end;
            while (e < text.length && bounds.indexOf(text.charAt(e)) < 0) e++;
            if (e < text.length && text.charAt(e) !== '\n') e++;
            occ.sentBefore = text.slice(s, start);
            occ.sentKw = text.slice(start, end);
            occ.sentAfter = text.slice(end, e);
        } catch (err) {}
    }

    function renderRplList() {
        var res = $('npRplResult');
        if (!res) return;
        var occs = _rpl.occs || [];
        var html = '<div class="npRplResultTotal">命中 ' + occs.length + ' 处' +
            (occs.length ? '（点某一条替换这一处，再点一次撤销）' : '') + '</div>';
        if (!occs.length) {
            html += '<div class="npRplResultEmpty">' + (_rpl.find ? '没有找到匹配内容。' : '输入关键字后在这里列出匹配的句子。') + '</div>';
        } else {
            html += '<div class="npRplResultSentList">';
            for (var i = 0; i < occs.length; i++) {
                var occ = occs[i];
                var kwCls = occ.replaced ? 'npRplSentKwReplaced' : 'npRplSentKw';
                html += '<div class="npRplOccLine" data-rplocc="' + i + '" title="' +
                    (occ.replaced ? '点击撤销这一处的替换' : '点击把这一处替换掉') + '">' +
                    '<span class="npRplOccSent">' + rplEsc(occ.sentBefore) +
                    '<span class="' + kwCls + '">' + rplEsc(occ.replaced ? occ.newText : occ.sentKw) + '</span>' +
                    rplEsc(occ.sentAfter) + '</span>' +
                    (occ.replaced ? '<span class="npRplOccDone">已替换</span>' : '') + '</div>';
            }
            html += '</div>';
        }
        res.innerHTML = html;
        res.style.display = 'block';
    }

    function refreshReplace() {
        if (_rpl.timer) { clearTimeout(_rpl.timer); _rpl.timer = null; }
        var findInp = $('npReplaceFind');
        var find = findInp ? findInp.value : '';
        _rpl.find = find;
        unwrapRplSpans();
        _rpl.occs = [];
        var badge = $('npRplCount');
        if (!find) {
            if (badge) { badge.textContent = '0'; badge.classList.remove('show'); }
            renderRplList();
            return;
        }
        var pat = rplParse(find);
        var re = rplRegex(pat.segs, pat.wc);
        var occs = _rpl.occs;
        var ps = rplParagraphs();
        for (var pi = 0; pi < ps.length; pi++) {
            var before = occs.length;
            rplScanParagraph(ps[pi], re, pat, occs);
            for (var ni = before; ni < occs.length; ni++) rplSentence(ps[pi], occs[ni]);
        }
        if (badge) {
            badge.textContent = String(occs.length);
            badge.classList.add('show');
        }
        renderRplList();
    }

    function markRplDirty() {
        if (typeof window.onNotepadInput === 'function') { try { window.onNotepadInput(); } catch (e) {} }
        if (typeof saveCurrentEditor === 'function') { try { saveCurrentEditor(); } catch (e) {} }
    }

    function replaceOneCore(occ, repInp) {
        if (!occ || !occ.spans.length || !occ.spans[0].parentNode) return false;
        if (occ.replaced) {
            var sp = occ.spans[0];
            var back = document.createElement('span');
            back.className = occ.cls;
            back.textContent = occ.originalText;
            sp.parentNode.replaceChild(back, sp);
            occ.spans = [back];
            occ.replaced = false;
            occ.newText = '';
            occ.sentKw = occ.originalText;
            return true;
        }
        var newText = rplRenderReplace(repInp ? repInp.value : '', occ.groups);
        var first = occ.spans[0], last = occ.spans[occ.spans.length - 1];
        var range = document.createRange();
        range.setStartBefore(first);
        range.setEndAfter(last);
        range.deleteContents();
        var span = document.createElement('span');
        span.className = occ.cls;
        span.textContent = newText;
        range.insertNode(span);
        occ.newText = newText;
        occ.spans = [span];
        occ.replaced = true;
        occ.sentKw = newText;
        return true;
    }

    function toggleReplaceOcc(idx) {
        var occ = _rpl.occs[idx];
        if (!occ) return;
        replaceOneCore(occ, $('npReplaceWith'));
        markRplDirty();
        renderRplList();
        var hint = $('npReplaceHint');
        if (hint) hint.textContent = occ.replaced ? '已替换这一处' : '已撤销这一处';
    }

    function closeReplaceDialog() {
        if (_rpl.timer) { clearTimeout(_rpl.timer); _rpl.timer = null; }
        unwrapRplSpans();
        _rpl.occs = [];
        _rpl.find = '';
        var m = $('npReplaceDialog');
        if (m) m.classList.remove('show');
    }

    function buildReplaceDialog() {
        var old = $('npReplaceDialog');
        if (old) old.remove();

        var mask = document.createElement('div');
        mask.id = 'npReplaceDialog';
        mask.className = 'npReplaceDialog';

        var box = document.createElement('div');
        box.className = 'npRplBox';

        var head = document.createElement('div');
        head.className = 'npRplHead';
        var title = document.createElement('span');
        title.className = 'npRplHeadText';
        title.textContent = '替换';
        head.appendChild(title);
        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'npRplClose';
        close.textContent = '×';
        close.title = '关闭';
        close.addEventListener('click', closeReplaceDialog);
        head.appendChild(close);
        box.appendChild(head);

        function row(labelText, inputId, placeholder) {
            var r = document.createElement('div');
            r.className = 'npRplRow';
            var lb = document.createElement('label');
            lb.className = 'npRplLabel';
            lb.textContent = labelText;
            lb.setAttribute('for', inputId);
            r.appendChild(lb);
            var wrap = document.createElement('div');
            wrap.className = 'npRplFindWrap';
            var inp = document.createElement('input');
            inp.type = 'text';
            inp.id = inputId;
            inp.placeholder = placeholder;
            wrap.appendChild(inp);
            r.appendChild(wrap);
            box.appendChild(r);
            return { input: inp, wrap: wrap };
        }
        var findRow = row('查找', 'npReplaceFind', '要查找的内容（X / * / - 可作通配符）');
        var badge = document.createElement('button');
        badge.type = 'button';
        badge.id = 'npRplCount';
        badge.className = 'npRplCount';
        badge.title = '当前命中数量';
        badge.textContent = '0';
        findRow.wrap.appendChild(badge);
        var repInp = row('替换为', 'npReplaceWith', '替换成什么（留空 = 删除）').input;

        var hint = document.createElement('div');
        hint.className = 'npRplHint';
        hint.id = 'npReplaceHint';
        box.appendChild(hint);

        var res = document.createElement('div');
        res.className = 'npRplResult';
        res.id = 'npRplResult';
        box.appendChild(res);

        var btns = document.createElement('div');
        btns.className = 'npRplBtns';
        var runBtn = document.createElement('button');
        runBtn.type = 'button';
        runBtn.className = 'npRplRunBtn';
        runBtn.textContent = '全部替换';
        runBtn.addEventListener('click', doReplaceAll);
        btns.appendChild(runBtn);
        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'npRplCancelBtn';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', closeReplaceDialog);
        btns.appendChild(cancelBtn);
        box.appendChild(btns);

        mask.appendChild(box);
        mask.addEventListener('mousedown', function (e) {
            if (e.target === mask) closeReplaceDialog();
        });
        document.body.appendChild(mask);

        findRow.input.addEventListener('input', function () {
            if (_rpl.timer) clearTimeout(_rpl.timer);
            _rpl.timer = setTimeout(function () { _rpl.timer = null; refreshReplace(); }, 220);
        });
        findRow.input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); refreshReplace(); }
        });
        repInp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); refreshReplace(); }
        });
        res.addEventListener('click', function (e) {
            var line = e.target.closest('[data-rplocc]');
            if (!line) return;
            toggleReplaceOcc(parseInt(line.getAttribute('data-rplocc'), 10));
        });
    }

    function openReplaceDialog(range) {
        var m = $('npReplaceDialog');
        if (!m) { buildReplaceDialog(); m = $('npReplaceDialog'); }
        if (!m) return;
        var findInp = $('npReplaceFind');
        var repInp = $('npReplaceWith');
        var selText = range ? String(range.toString() || '') : '';
        if (findInp) findInp.value = selText;
        if (repInp && !repInp.value) repInp.value = '';
        var hint = $('npReplaceHint');
        if (hint) hint.textContent = '';
        _rpl.occs = [];
        m.classList.add('show');
        setTimeout(function () {
            if (findInp) { findInp.focus(); findInp.select(); }
            if (selText) refreshReplace();
            else renderRplList();
        }, 30);
    }

    function doReplaceAll() {
        var findInp = $('npReplaceFind');
        var repInp = $('npReplaceWith');
        var find = findInp ? findInp.value : '';
        if (!find) { toast('请输入要查找的内容'); if (findInp) findInp.focus(); return; }
        if (_rpl.timer) { clearTimeout(_rpl.timer); _rpl.timer = null; }
        if (_rpl.find !== find) refreshReplace();
        var occs = _rpl.occs.slice();
        var count = 0;
        for (var i = 0; i < occs.length; i++) {
            if (occs[i].replaced) continue;
            if (replaceOneCore(occs[i], repInp)) count++;
        }
        renderRplList();
        markRplDirty();
        var hint = $('npReplaceHint');
        if (hint) hint.textContent = count ? ('已替换 ' + count + ' 处') : '没有需要替换的内容';
        toast(count ? ('已替换 ' + count + ' 处') : '没有需要替换的内容');
    }

    /* ---------------- 事件绑定 ---------------- */
    function onContextMenu(e) {
        var ed = editor();
        if (!ed) return;
        if (!ed.contains(e.target)) return;
        if (e.target.closest && e.target.closest('#npAttachViewer')) return;
        e.preventDefault();
        e.stopPropagation();

        if (_preCtxRange) {
            _ctxRange = _preCtxRange.cloneRange();
        } else {
            saveCtxRange();
        }
        var menu = ensureMenu();
        refreshMenu();
        placeMenu(menu, e.clientX, e.clientY);
    }

    function init() {
        if (document._npCtxBound) return;
        document._npCtxBound = true;

        /* 右键 mousedown 先存选区（此时选区还没被折叠） */
        document.addEventListener('mousedown', function (e) {
            if (e.button !== 2) return;
            var ed = editor();
            if (!ed || !ed.contains(e.target)) { _preCtxRange = null; return; }
            var sel = window.getSelection();
            if (sel && sel.rangeCount && !sel.isCollapsed) {
                var r = sel.getRangeAt(0);
                if (ed.contains(r.startContainer)) { _preCtxRange = r.cloneRange(); return; }
            }
            /* 折叠光标也要记，供「添加索引」判断段落 */
            if (sel && sel.rangeCount) {
                var r2 = sel.getRangeAt(0);
                if (ed.contains(r2.startContainer)) { _preCtxRange = r2.cloneRange(); return; }
            }
            _preCtxRange = null;
        }, true);

        document.addEventListener('contextmenu', onContextMenu, true);

        document.addEventListener('mousedown', function (e) {
            var m = $(MENU_ID);
            if (m && m.classList.contains('show') && !m.contains(e.target)) hideMenu();
            var sp = $('npSymbolPanel');
            if (sp && sp.classList.contains('show') && !sp.contains(e.target)) closeSymbolPanel();
        }, true);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { hideMenu(); return; }
            if (!(e.ctrlKey && e.shiftKey) || e.altKey) return;
            var ed = editor();
            var sel = window.getSelection();
            var anchor = sel && sel.anchorNode;
            if (!ed || (!ed.contains(document.activeElement) && !ed.contains(anchor))) return;
            var key = String(e.key || '').toLowerCase();
            /* Ctrl+Shift+1~5：5 种高亮背景色（与右键「高亮背景色」顺序一致）。
               Shift+数字在多数键盘上 e.key 是 ! @ # $ %，必须优先看 e.code，
               否则会像实机反馈那样「右键能用、快捷键没反应」。 */
            var digit = -1;
            var code = String(e.code || '');
            var mCode = code.match(/^(?:Digit|Numpad)([1-5])$/);
            if (mCode) digit = parseInt(mCode[1], 10) - 1;
            else if (/^[1-5]$/.test(key)) digit = parseInt(key, 10) - 1;
            else {
                var shifted = '!@#$%'.indexOf(key);
                if (shifted >= 0) digit = shifted;
            }
            if (digit >= 0 && COLORS[digit]) {
                e.preventDefault(); e.stopPropagation();
                var c = COLORS[digit];
                /* 快捷键触发时当前选区就是目标，applyHighlight 会优先用它 */
                applyHighlight(c[1], c[3]);
                return;
            }
            if (key === 'a') {
                e.preventDefault(); e.stopPropagation();
                if (typeof window._npRepeatLastFormat === 'function') window._npRepeatLastFormat();
            } else if (key === 'e') {
                /* Ctrl+Shift+E 与搜狗输入法「切换中英文」冲突：只在确实选中文字时接管，
                   未选中时放行给输入法，否则会导致输入法一直卡在英文状态 */
                var selNow = window.getSelection();
                if (!selNow || !selNow.rangeCount || selNow.isCollapsed ||
                    String(selNow.toString() || '').length === 0) return;
                e.preventDefault(); e.stopPropagation();
                resetSelectedFormat();
            }
        }, true);

        window.addEventListener('resize', hideMenu);
    }

    /* Ctrl+Shift+E：重置选取部分的格式，不跳转、保持选区与滚动 */
    function resetSelectedFormat() {
        var ed = editor();
        if (!ed) return;
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount || sel.isCollapsed) {
            toast('请先选取要重置格式的文字');
            return;
        }
        var selText = String(sel.toString() || '');
        var startNode = sel.anchorNode;
        var para = startNode && startNode.nodeType === 3 ? startNode.parentNode : startNode;
        while (para && para !== ed && !/^(P|DIV)$/.test(para.tagName)) para = para.parentNode;
        var paraIdx = -1;
        if (para && para !== ed) {
            var blocks = Array.prototype.slice.call(ed.children).filter(function (x) { return /^(P|DIV)$/.test(x.tagName); });
            paraIdx = blocks.indexOf(para);
        }
        var offsetInPara = 0;
        if (startNode && startNode.nodeType === 3 && para && para !== ed) {
            var pre = document.createRange();
            pre.selectNodeContents(para);
            pre.setEnd(startNode, sel.anchorOffset);
            offsetInPara = pre.toString().length;
        }
        var pane = $('npEditorPane') || ed;
        var scroller = ed.scrollTop;
        var paneTop = pane.scrollTop;

        if (typeof window.autoFormatDocSelected !== 'function') { toast('重置格式功能不可用'); return; }
        window.autoFormatDocSelected(true);
        restoreSelectionAfterReset(selText, paraIdx, offsetInPara, selText.length);
        ed.scrollTop = scroller;
        pane.scrollTop = paneTop;
    }

    function restoreSelectionAfterReset(selText, paraIdx, offsetInPara, len) {
        var ed = editor();
        if (!ed || !selText) return false;
        var blocks = Array.prototype.slice.call(ed.children).filter(function (x) { return /^(P|DIV)$/.test(x.tagName); });
        var target = (paraIdx >= 0 && paraIdx < blocks.length) ? blocks[paraIdx] : null;
        if (!target || String(target.textContent || '').indexOf(selText) < 0) {
            var all = ed.querySelectorAll('p,div');
            target = null;
            for (var i = 0; i < all.length; i++) {
                if (String(all[i].textContent || '').indexOf(selText) >= 0) { target = all[i]; break; }
            }
        }
        if (!target) return false;
        var walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null, false);
        var pos = 0, startNode = null, startOff = 0, endNode = null, endOff = 0, n;
        while ((n = walker.nextNode())) {
            var v = n.nodeValue || '';
            if (!startNode && offsetInPara >= pos && offsetInPara <= pos + v.length) {
                startNode = n; startOff = Math.min(offsetInPara - pos, v.length);
            }
            if (startNode && !endNode && offsetInPara + len <= pos + v.length) {
                endNode = n; endOff = Math.min(offsetInPara + len - pos, v.length);
            }
            pos += v.length;
        }
        if (!startNode || !endNode) return false;
        try {
            var r = document.createRange();
            r.setStart(startNode, startOff);
            r.setEnd(endNode, endOff);
            var s = window.getSelection();
            s.removeAllRanges();
            s.addRange(r);
            return true;
        } catch (e) { return false; }
    }

    window.npEditorCtxMenu = { init: init, hide: hideMenu, openSymbolPanel: openSymbolPanel, openReplace: openReplaceDialog };
    window.npOpenReplaceDialog = openReplaceDialog;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
