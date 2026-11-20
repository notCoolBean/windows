/* ============================================================
   main.js — 启动初始化
   2026-11-03：删除编辑器模块与主页后，程序只剩「致知笔记」单一版块，
   启动即进入笔记三栏工作区，不再有版块切换。
   ============================================================ */

(function () {
    function el(id) { return document.getElementById(id); }

    /* 默认铺位：宽度占满可视区；上边距 = 顶栏底部 + 5px，下边距 = 屏幕底部 - 5px。
       麒麟系统上自动适配经常对不齐，这里直接按视口算死，保证开箱即对齐。
       注意：启动时 notepad.js 会加 notepadFullscreen 并置 npUserMoved=1，
       并把面板贴到 #rightPanel（那边有 15px margin，所以看起来"没对齐"），
       因此这里必须先撤掉全屏类、并忽略那个启动期标记。 */
    function applyDefaultPanelRect() {
        var panel = el('notepadPanel');
        if (!panel) return;
        /* 只在用户真的拖动过之后才保留他的位置 */
        if (panel.dataset.npUserResized === '1') return;
        panel.classList.remove('notepadFullscreen');
        var z = 1;
        try { z = parseFloat(DataLayer.getRaw('mainZoom')) || 1; } catch (e) { z = 1; }
        /* 顶栏底部作为上边界（面板不能盖住顶栏按钮） */
        var top = 0;
        var hd = el('mainHeader');
        if (hd) top = hd.getBoundingClientRect().bottom;
        var topCss = (top + 5) / z;
        var h = (window.innerHeight - 5) / z - topCss;
        panel.style.left = '0px';
        panel.style.top = topCss + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.width = (window.innerWidth / z) + 'px';
        panel.style.height = Math.max(240, h) + 'px';
        panel.dataset.npDefaultRect = '1';
    }
    window.applyDefaultPanelRect = applyDefaultPanelRect;

    /* 确保笔记面板处于显示状态（它是 position:fixed 浮层） */
    function enterNotepad() {
        var panel = el('notepadPanel');
        if (panel && !panel.classList.contains('show')) {
            if (typeof toggleNotepad === 'function') toggleNotepad();
            else panel.classList.add('show');
        } else if (panel) {
            panel.classList.add('show');
        }
        var rp = el('rightPanel');
        if (rp) rp.style.display = 'flex';
        applyDefaultPanelRect();
        /* 不再调用 autoFitNotepadHeight() / fitNotepadToLogArea()：
           它们会把面板缩回 rightPanel 的大小，与「默认宽度 = 屏幕宽度、上下留 5px」冲突。 */
        setTimeout(applyDefaultPanelRect, 0);
        setTimeout(applyDefaultPanelRect, 120);
        setTimeout(applyDefaultPanelRect, 400);
    }

    /* 兼容旧调用点（notepad.js 等内部仍可能调用 gwShowNote） */
    window.gwShowNote = enterNotepad;
    window.gwShowHome = enterNotepad;
    window.gwShowEditor = enterNotepad;

    function bindHeader() {
        var zIn = document.getElementById('zoomInBtn');
        var zOut = document.getElementById('zoomOutBtn');
        var fs = document.getElementById('headerLogo');
        if (zIn) zIn.addEventListener('click', function () { changeMainZoom(0.1); });
        if (zOut) zOut.addEventListener('click', function () { changeMainZoom(-0.1); });
        if (fs) fs.addEventListener('click', function () { toggleBrowserFullscreen(); });
    }

    function initNotepad() {
        if (typeof updateNotepadTabs === 'function') updateNotepadTabs();
        if (typeof updateNotepadTabStyle === 'function') updateNotepadTabStyle();
        if (typeof syncEditorFromData === 'function') syncEditorFromData();
        if (typeof applyNotepadZoom === 'function') applyNotepadZoom();
        if (typeof initCopyButton === 'function') initCopyButton();
        /* 不再调用 autoFitNotepadHeight()：它会把面板缩回 rightPanel 的高度，
           与「默认宽度 = 屏幕宽度、上下留 5px」冲突。尺寸统一由 applyDefaultPanelRect() 决定。 */
    }

    function boot() {
        bindHeader();
        initNotepad();
        if (typeof applyMainZoom === 'function') applyMainZoom();
        enterNotepad();
        /* 兜底守护：notepad.js 内部多处会调 autoFitNotepadHeight / fitNotepadToLogArea
           把面板尺寸改回去（麒麟上表现为「对不齐、要手动拖」）。
           用户没手动拖过之前，定时把尺寸校正回默认铺位。 */
        if (!window._npDefaultRectGuard) {
            window._npDefaultRectGuard = setInterval(function () {
                var p = el('notepadPanel');
                if (!p) return;
                if (p.dataset.npUserResized === '1') return;
                if (p.classList.contains('notepadFullscreen')) { applyDefaultPanelRect(); return; }
                var z = 1;
                try { z = parseFloat(DataLayer.getRaw('mainZoom')) || 1; } catch (e) { z = 1; }
                var hd = el('mainHeader');
                var wantT = ((hd ? hd.getBoundingClientRect().bottom : 0) + 5) / z;
                var wantW = window.innerWidth / z;
                var wantH = (window.innerHeight - 5) / z - wantT;
                if (Math.abs(p.offsetWidth - wantW) > 2 ||
                    Math.abs(p.offsetHeight - wantH) > 2 ||
                    Math.abs(p.offsetTop - wantT) > 2 ||
                    Math.abs(p.offsetLeft) > 2) {
                    applyDefaultPanelRect();
                }
            }, 300);
        }
        window.addEventListener('resize', function () {
            applyDefaultPanelRect();
            if (typeof updateNotepadToolbarScroll === 'function') updateNotepadToolbarScroll();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
