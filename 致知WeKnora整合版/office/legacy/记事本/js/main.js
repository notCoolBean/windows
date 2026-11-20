/* ============================================================
   main.js — 应用初始化脚本
   在所有模块加载后执行初始化逻辑
   ============================================================ */

// ---- 初始化 ----
console.log('[main.js] 所有模块已加载，状态对象:', window.S);

// 延迟调用 store.js 中待处理的 updateLastLoadedFile
if (S._pendingFileName && typeof window.updateLastLoadedFile === 'function') {
    window.updateLastLoadedFile(S._pendingFileName);
    delete S._pendingFileName;
}

// 初始渲染
renderCalendar();
renderReminders(true);

// 将 renderTrackContent 注入到 store.js 的 toggleTimelineSubItems
if (typeof window.renderTrackContent === 'function') {
    window._renderTrackContent = window.renderTrackContent;
}

// 编辑器模块已迁出：清理旧版本残留的显示状态，保证日志区始终可见
(function clearEditorResidue() {
    try {
        var rp = document.getElementById('rightPanel');
        if (rp) rp.classList.remove('has-editor');
        var legacy = document.getElementById('paHiddenLegacy');
        if (legacy) legacy.style.display = 'none';
        var panel = document.getElementById('problemAnalysisPanel');
        if (panel) panel.classList.remove('show', 'paFixedMode');
        var mirror = document.getElementById('problemAnalysisMirror');
        if (mirror) mirror.classList.remove('show');
        var divider = document.getElementById('paMirrorDivider');
        if (divider) divider.style.display = 'none';
    } catch (e) {}
})();
