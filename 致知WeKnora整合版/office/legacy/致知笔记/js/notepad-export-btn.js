/* 保存按钮右侧的「导出 ▾」：导出「当前这一篇」。
   可用条件二选一：
     · 编辑区正在显示单篇（点过中部标题）
     · 光标落在某一篇里（中间标题行会标出当前篇）
   只打开笔记、还没点任何标题时按钮保持灰色并提示先选文章。
   三个选项复用原有的「导出当前文章」逻辑：
     docx → confirmNotepadExportDocxCurrent
     js   → confirmNotepadExportJsCurrent
     html → confirmNotepadExportHtmlCurrent */
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }

    function isSingleView() {
        try {
            if (typeof window.npIsSingleArticleView === 'function') return !!window.npIsSingleArticleView();
        } catch (e) { }
        return false;
    }

    /* 是否可以导出：单篇视图，或光标所在的那一篇（由 notepad-workspace 判定） */
    function hasTarget() {
        try {
            if (typeof window.npHasExportTarget === 'function') return !!window.npHasExportTarget();
        } catch (e) { }
        return isSingleView();
    }

    /* 把光标放到要导出的那一篇：单篇视图取第一个可见段落，
       全文视图取中间标着的那一篇（npFocusSelectedArticle）。 */
    function focusTargetArticle() {
        if (!isSingleView() && typeof window.npFocusSelectedArticle === 'function') {
            try { if (window.npFocusSelectedArticle()) return true; } catch (e) { }
        }
        var editor = $('notepadEditor');
        if (!editor) return false;
        var ps = editor.querySelectorAll('p');
        var visible = [];
        for (var i = 0; i < ps.length; i++) {
            if (ps[i].style.display === 'none' || ps[i].getAttribute('data-dir-hidden') === 'true') continue;
            if (!(ps[i].textContent || '').trim()) continue;
            visible.push(ps[i]);
        }
        if (!visible.length) return false;
        var target = visible[0];
        try {
            var r = document.createRange();
            r.setStart(target, 0);
            r.collapse(true);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
        } catch (e) { }
        return true;
    }

    function paint(on) {
        var btn = $('npExportBtn');
        if (!btn) return;
        btn.classList.toggle('npExportDisabled', !on);
        btn.setAttribute('aria-disabled', on ? 'false' : 'true');
        btn.title = on ? '导出当前这一篇' : '请先在中间选择要导出的文章';
    }

    function refreshExportBtn() { paint(hasTarget()); }

    window.npRefreshExportBtn = refreshExportBtn;

    window.npExportSingle = function (which) {
        try { if (typeof window.paCloseDropdowns === 'function') window.paCloseDropdowns(); } catch (e) { }
        if (!hasTarget()) { showToast('请先在中间选择要导出的文章'); return; }
        var map = {
            'docx-current': 'confirmNotepadExportDocxCurrent',
            'js-current': 'confirmNotepadExportJsCurrent',
            'html-current': 'confirmNotepadExportHtmlCurrent'
        };
        var fn = map[which];
        if (!fn || typeof window[fn] !== 'function') { showToast('导出功能不可用'); return; }
        focusTargetArticle();
        /* 告诉 js 导出：这次只导出当前这一篇（全文视图也一样），别整窗打包 */
        window._npExportArticleOnly = true;
        setTimeout(function () { window._npExportArticleOnly = false; }, 5000);
        try { window[fn](); } catch (e) { showToast('导出失败：' + (e && e.message ? e.message : e)); }
    };

    function init() {
        refreshExportBtn();
        /* 标题行一按下就点亮导出的那一段等待时间：
           mousedown 到 click 处理之间有一次刷新窗口，
           点第一篇时那一瞬按钮仍是灰的，看着像「点了几下才生效」。 */
        var list = $('npDirList');
        if (list && !list._npExpDown) {
            list._npExpDown = true;
            list.addEventListener('mousedown', function (e) {
                var row = e.target && e.target.closest ? e.target.closest('.npDirItem[data-article-index]') : null;
                if (!row) return;
                var idx = parseInt(row.getAttribute('data-article-index'), 10);
                if (!isFinite(idx) || idx < 0) return;
                paint(true);
            }, true);
        }
        var menu = $('notepadExportMenu');
        if (menu && !menu._npExpBound) {
            menu._npExpBound = true;
            menu.addEventListener('mousedown', function (e) {
                if (!hasTarget()) { e.preventDefault(); e.stopPropagation(); }
            }, true);
        }
    }

    /* 兜底：编辑器内容变化、窗口缩放后都再刷新一次，
       避免只在启动时算过一次、之后一直保持灰色（麒麟上尤其明显）。 */
    function watch() {
        var ed = $('notepadEditor');
        if (ed && !ed._npExpWatch) {
            ed._npExpWatch = true;
            ed.addEventListener('input', refreshExportBtn);
            ed.addEventListener('keyup', refreshExportBtn);
            ed.addEventListener('mouseup', refreshExportBtn);
        }
        window.addEventListener('resize', refreshExportBtn);
        /* 低频轮询兜底：状态变化只在必要时写类，几乎无开销 */
        if (!window._npExpTimer) {
            window._npExpTimer = setInterval(refreshExportBtn, 500);
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.addEventListener('load', function () { init(); watch(); });
})();
