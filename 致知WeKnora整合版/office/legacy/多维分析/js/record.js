/* ============================================================
   工作记录模块（record.js）— 自带 HTML + CSS + JS 的独立模块
   迁移到其它程序时，只需复制本文件并在页面 </body> 前引入：
       <script src="js/record.js"></script>
   加载时自动向页面注入 工作记录面板(#tab-record) 与 相关弹窗，
   以及本模块专用样式。逻辑函数保持全局作用域，供内联事件调用。
   ============================================================ */
/* ---- 截图防护：本程序截屏一律调用系统截图工具，禁用浏览器屏幕共享选择器
        （getDisplayMedia 会弹出「选择要分享什么」窗口，必须彻底屏蔽） ---- */
(function () {
  try {
    var md = navigator.mediaDevices;
    if (md) {
      try { delete md.getDisplayMedia; } catch (e) {}
      try {
        Object.defineProperty(md, 'getDisplayMedia', { value: undefined, configurable: true, writable: true });
      } catch (e) {}
    }
    try { delete navigator.getDisplayMedia; } catch (e) {}
    try {
      Object.defineProperty(navigator, 'getDisplayMedia', { value: undefined, configurable: true, writable: true });
    } catch (e) {}
  } catch (e) {}
})();
/* ---- 本模块样式与结构：加载时自动注入（自带 HTML/CSS，独立可迁移） ---- */
(function () {
  var MODULE_CSS = [
    "/* 表格管理 — 工作记录模块样式（record.js 自动注入） */",
    "",
    "",
    "/* ---- 工作记录 ---- */",
    ".rec-panel { flex: 1; min-height: 0; display: flex; overflow: hidden; }",
    ".rec-panel.hidden { display: none; }",
    ".rec-left { flex: 0 0 45%; min-width: 200px; display: flex; flex-direction: column; border-right: 1px solid #dfe6e9; }",
    ".rec-right { flex: 1; min-width: 0; display: flex; flex-direction: column; }",
    ".rec-divider { width: 6px; cursor: col-resize; background: #cfd8e3; flex-shrink: 0; transition: background .15s; }",
    ".rec-divider:hover, .rec-divider.dragging { background: #0984e3; }",
    ".rec-notepad { flex: 1; min-height: 0; padding: 12px; border: none; outline: none; font-size: 15px; font-family: 'FangSong_GB2312','仿宋_GB2312','FangSong','仿宋',serif; line-height: 1.8; resize: none; overflow-y: auto; white-space: pre-wrap; word-break: break-all; background: #eaf3fd; }",
    ".rec-table-toolbar { display: flex; gap: 6px; padding: 6px 8px; border-bottom: 1px solid #dfe6e9; flex-shrink: 0; background: #fafbfc; }",
    ".rec-table-wrap { flex: 1; min-height: 0; overflow-y: auto; }",
    ".rec-table { width: 100%; border-collapse: collapse; font-size: 13px; }",
    ".rec-table th { background: #f0f1f3; border: 1px solid #bbb; padding: 6px 8px; text-align: center; font-weight: bold; position: sticky; top: 0; z-index: 1; }",
    ".rec-table td { border: 1px solid #d0d4da; padding: 4px 8px; vertical-align: middle; }",
    ".rec-table td input[type=\"checkbox\"] { cursor: pointer; }",
    ".rec-table .rec-event-time { width: 160px; }",
    ".rec-table .rec-event-content { min-width: 200px; }",
    ".rec-table .rec-event-note { min-width: 120px; }",
    ".rec-table .rec-event-action { width: 60px; text-align: center; }",
    ".rec-situ-toolbar { display: flex; gap: 8px; padding: 10px; border-bottom: 1px solid #dfe6e9; flex-shrink: 0; }",
    ".rec-situ-container { flex: 1; min-height: 0; overflow-y: auto; background: #fff; }",
    ".rec-cat-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 6px; background: #fcfcfc; }",
    ".rec-cat-row.dragging { opacity: .5; }",
    ".rec-cat-row.drag-over { box-shadow: inset 0 2px 0 0 #0984e3; }",
    ".rec-cat-name { flex: 1; padding: 5px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; outline: none; }",
    ".rec-cat-name:focus { border-color: #0984e3; }",
    ".rec-cat-del { border: none; background: transparent; color: #c0392b; font-size: 15px; cursor: pointer; }",
    ".rec-cat-del:hover { background: #fdecea; }",
    ".rec-cat-add { margin-top: 8px; }",
    ".rec-sel-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 6px; background: #fcfcfc; }",
    ".rec-sel-chk { cursor: pointer; }",
    ".rec-sel-name { flex: 1; font-size: 13px; }",
    ".rec-sel-color { width: 24px; height: 24px; border-radius: 4px; cursor: pointer; border: 1px solid #ccc; }",
    ".rec-sel-order { display: flex; gap: 4px; }",
    ".rec-sel-order button { padding: 2px 8px; font-size: 11px; border: 1px solid #ddd; background: #fff; border-radius: 3px; cursor: pointer; }",
    ".rec-sel-order button:hover { background: #e3f2fd; }",
    "",
    "/* ---- 工作记录：项目列表（三级区，可拖动排序、双击编辑） ---- */",
    ".rec-project-item { cursor: grab; }",
    ".rec-project-item.dragging { opacity: .5; }",
    ".rec-project-item.drag-over { box-shadow: inset 0 2px 0 0 #0984e3; }",
    ".rec-project-item.active { background: #0984e3; color: #fff; border-radius: 4px; padding: 2px 8px; }",
    ".rec-proj-tier3 { flex-wrap: nowrap; min-width: 0; max-width: 100%; }",
    ".rec-proj-scroll-btn { flex-shrink: 0; width: 20px; height: 20px; border: 1px solid #a3c9f5; background: #fff; color: #0984e3; border-radius: 4px; cursor: pointer; font-size: 12px; line-height: 1; padding: 0; }",
    ".rec-proj-scroll-btn:hover { background: #e3f2fd; }",
    ".rec-proj-list { display: flex; align-items: center; gap: 10px; max-width: 70vw; min-width: 0; flex: 0 1 auto; overflow-x: auto; overflow-y: hidden; flex-shrink: 1; scrollbar-width: none; }",
    ".rec-proj-list::-webkit-scrollbar { display: none; }",
    ".rec-proj-list .rec-project-item { flex-shrink: 0; }",
    ".rec-proj-add { flex-shrink: 0; }",
    "",
    "/* ---- 工作记录：项目面板（左文字区 + 右时间轴） ---- */",
    ".rec-proj-left { flex: 0 0 45%; min-width: 200px; display: flex; flex-direction: column; border-right: 1px solid #dfe6e9; }",
    ".rec-proj-right { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #fff; }",
    ".rec-proj-head { position: relative; display: flex; align-items: center; height: 40px; padding: 0 10px; background: #0D47A1; border-radius: 6px 6px 0 0; flex-shrink: 0; }",
    ".rec-proj-head-center { position: absolute; left: 50%; transform: translateX(-50%); }",
    ".rec-proj-head .btn-primary { background: #fff; color: #0D47A1; border: 1px solid #fff; box-shadow: none; }",
    ".rec-proj-head .btn-primary:hover { background: #e3f2fd; }",
    ".rec-proj-foot { height: 3px; background: #5a5a5a; border-radius: 0 0 6px 6px; flex-shrink: 0; }",
    ".rec-proj-name { font-family: 'SimHei','黑体',sans-serif; font-size: 14px; font-weight: 700; color: #fff; max-width: 28%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".rec-tl-head-title { font-family: 'SimHei','黑体',sans-serif; font-size: 14px; font-weight: bold; color: #fff; }",
    ".rec-zoom-group { display: flex; align-items: center; gap: 4px; margin-left: auto; }",
    ".rec-zoom-btn { width: 22px; height: 22px; border: 1px solid rgba(255,255,255,.6); background: transparent; color: #fff; border-radius: 4px; cursor: pointer; font-size: 15px; line-height: 1; padding: 0; }",
    ".rec-zoom-btn:hover { background: rgba(255,255,255,.22); }",
    ".rec-zoom-val { color: #fff; font-size: 12px; min-width: 38px; text-align: center; }",
    "",
    "/* ---- 工作记录：项目时间轴（参照 电子记事本「以页面文字样式显示日志」） ---- */",
    ".rec-tl-container { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(0,0,0,.15) transparent; }",
    ".rec-tl-container::-webkit-scrollbar { width: 8px; }",
    ".rec-tl-container::-webkit-scrollbar-track { background: transparent; }",
    ".rec-tl-container::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 4px; }",
    ".rec-tl-container::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,.25); }",
    ".rec-tl-sheet { padding: 15px 20px; font-family: 'FangSong_GB2312','仿宋_GB2312','FangSong','仿宋',serif; font-size: 15px; line-height: 1.8; color: #333; }",
    ".rec-tl-group { position: relative; padding-left: 36px; padding-bottom: 8px; }",
    ".rec-tl-group:not(:first-child) { margin-top: 14px; }",
    ".rec-tl-group::before { content: ''; position: absolute; left: -7px; top: 6px; width: 12px; height: 12px; background: #1565c0; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 2px #1565c0; z-index: 2; }",
    ".rec-tl-group::after { content: ''; position: absolute; left: -2.5px; top: 0; bottom: 0; width: 3px; background: #1565c0; z-index: 1; }",
    ".rec-tl-group:not(:first-child)::after { top: -14px; }",
    ".rec-tl-date { font-family: 'SimHei','黑体',sans-serif; font-size: 14px; color: #0D47A1; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #d6e4f5; padding-bottom: 4px; }",
    ".rec-tl-title { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-family: 'SimHei','黑体',sans-serif; font-size: 15px; font-weight: bold; color: #1b3a6e; margin-bottom: 4px; border-bottom: 1px dashed #d6e4f5; padding-bottom: 4px; }",
    ".rec-tl-title-orig { flex: 1; min-width: 0; }",
    ".rec-tl-stdtime { flex-shrink: 0; font-family: 'SimSun','宋体',serif; font-size: 12px; font-weight: normal; color: #555; white-space: nowrap; }",
    ".rec-tl-line { font-family: 'FangSong_GB2312','仿宋_GB2312','FangSong','仿宋',serif; font-size: 15px; color: #333; line-height: 1.8; white-space: pre-wrap; word-break: break-all; border-bottom: 1px dashed #d6e4f5; padding-bottom: 2px; }",
    ".rec-tl-note { font-family: 'KaiTi_GB2312','楷体_GB2312','KaiTi','楷体',serif; font-size: 13px; color: #5b7ba8; margin-top: 2px; font-style: normal; border-bottom: 1px dashed #d6e4f5; padding-bottom: 4px; }",
    ".rec-tl-last { border-bottom: 2px solid #a9c8ec !important; padding-bottom: 6px !important; }",
    ".rec-tl-empty { text-align: center; padding: 60px 20px; color: #aaa; font-size: 14px; font-family: 'SimHei','黑体',sans-serif; }",
    ".rec-tl-item { transition: background .2s; cursor: pointer; }",
    ".rec-tl-item.active { background: #eaf3fd; outline: 1px solid #0D47A1; outline-offset: 4px; border-radius: 2px; }",
    ".rec-notepad[contenteditable=\"true\"]:empty:before { content: attr(data-ph); color: #b2bec3; pointer-events: none; }",
    ".rec-tl-link { color: #0D47A1; text-decoration: underline; cursor: pointer; transition: background .25s; }",
    ".rec-tl-link:hover { color: #1565c0; }",
    ".rec-tl-link.flash { background: #ffe58f; box-shadow: 0 0 0 2px #ffe58f; border-radius: 2px; }",
    "",
    "/* ---- 工作记录：总体进程（左侧项目列表 2 : 右侧多维态势图 8） ---- */",
    ".situ-wrap { flex: 1; min-height: 0; display: flex; overflow: hidden; }",
    ".situ-left { flex: 0 0 20%; min-width: 160px; max-width: 320px; display: flex; flex-direction: column; border-right: 1px solid #dfe6e9; background: #f7f9fb; }",
    ".situ-left.hidden { display: none; }",
    ".situ-right { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #fff; position: relative; }",
    ".situ-left-head { position: relative; display: flex; align-items: center; height: 40px; padding: 0 10px; background: #0D47A1; border-radius: 6px 0 0 0; flex-shrink: 0; }",
    ".situ-left-head-left { position: relative; }",
    ".situ-sel-btn { border: 1px solid rgba(255,255,255,.6); background: transparent; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; padding: 3px 8px; }",
    ".situ-sel-btn:hover { background: rgba(255,255,255,.22); }",
    ".situ-sel-menu { position: absolute; left: 0; top: calc(100% + 4px); min-width: 90px; background: #fff; border: 1px solid #dfe6e9; border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,.18); z-index: 22000; }",
    ".situ-sel-menu-item { padding: 7px 14px; font-size: 12px; color: #2d3436; cursor: pointer; white-space: nowrap; }",
    ".situ-sel-menu-item:hover { background: #e3f2fd; color: #0984e3; }",
    ".situ-left-title { position: absolute; left: 50%; transform: translateX(-50%); font-family: 'SimHei','黑体',sans-serif; font-size: 14px; font-weight: bold; color: #fff; }",
    ".situ-left-body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px; }",
    ".situ-proj-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 5px; cursor: pointer; opacity: .3; transition: opacity .15s, background .15s; user-select: none; margin-bottom: 2px; }",
    ".situ-proj-item:hover { background: #eef3f8; }",
    ".situ-proj-item.on { opacity: 1; }",
    ".situ-proj-item.dragging { opacity: .5; }",
    ".situ-proj-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(0,0,0,.15); }",
    ".situ-proj-name { flex: 1; font-size: 13px; color: #2d3436; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".situ-proj-empty { color: #b2bec3; font-size: 12px; text-align: center; padding: 20px 0; }",
    ".situ-right-head { display: flex; align-items: center; height: 40px; padding: 0 14px; background: #0D47A1; border-radius: 0 6px 0 0; flex-shrink: 0; gap: 10px; }",
    ".situ-right-title { font-family: 'SimHei','黑体',sans-serif; font-size: 14px; font-weight: bold; color: #fff; flex-shrink: 0; }",
    ".situ-detail { flex: 1; min-width: 0; color: #fff; font-size: 12px; overflow-x: auto; overflow-y: hidden; white-space: nowrap; scrollbar-width: none; }",
    ".situ-detail::-webkit-scrollbar { display: none; }",
    ".situ-set-btn { flex-shrink: 0; }",
    ".situ-size-group { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }",
    ".situ-size-group.hidden { display: none; }",
    ".situ-size-btn { border: 1px solid rgba(255,255,255,.6); background: transparent; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; padding: 3px 8px; white-space: nowrap; }",
    ".situ-size-btn:hover { background: rgba(255,255,255,.22); }",
    ".situ-zoom-val { color: #fff; font-size: 12px; min-width: 36px; text-align: center; }",
    ".situ-chart { flex: 1; min-height: 0; overflow: auto; background: #fff; position: relative; cursor: grab; }",
    ".situ-chart.rec-panning { cursor: grabbing; scroll-behavior: auto; }",
    ".rec-proj-multi.rec-panning { cursor: grabbing; }",
    ".situ-chart-empty { color: #b2bec3; font-size: 14px; text-align: center; padding: 60px 20px; }",
    ".situ-timeline { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; overflow: hidden; background: #fff; z-index: 10; }",
    ".situ-tl-head { display: flex; align-items: center; height: 40px; padding: 0 14px; background: #0D47A1; border-radius: 0 6px 0 0; flex-shrink: 0; gap: 10px; }",
    ".situ-tl-title { font-family: 'SimHei','黑体',sans-serif; font-size: 14px; font-weight: bold; color: #fff; flex-shrink: 0; }",
    ".situ-tl-sort-group { display: flex; align-items: center; gap: 4px; margin-left: auto; }",
    ".situ-tl-sort-btn { border: 1px solid rgba(255,255,255,.6); background: transparent; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; padding: 3px 10px; white-space: nowrap; transition: all .15s; }",
    ".situ-tl-sort-btn:hover { background: rgba(255,255,255,.22); }",
    ".situ-tl-sort-btn.active { background: #fff; color: #0D47A1; font-weight: 600; }",
    ".situ-tl-body { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 20px 12px 20px; position: relative; }",
    ".situ-tl-body::before { content: ''; position: absolute; left: 39px; top: 12px; bottom: 12px; width: 3px; background: #666; z-index: 0; }",
    ".situ-tl-m-head { display: flex; align-items: center; margin-top: 10px; margin-bottom: 6px; padding-top: 8px; border-top: 1px dashed #ddd; position: relative; padding-left: 36px; z-index: 1; }",
    ".situ-tl-m-head:first-child { margin-top: 0; border-top: none; padding-top: 0; }",
    ".situ-tl-m-head .situ-tl-m-dot { position: absolute; left: 34px; top: 50%; transform: translateY(-50%); width: 12px; height: 12px; border-radius: 50%; background: #666; z-index: 2; }",
    ".situ-tl-m-head .situ-tl-m-dot::after { content: ''; position: absolute; left: -3px; top: -3px; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #666; }",
    ".situ-tl-m-head .situ-tl-m-label { font-family: 'SimHei','黑体',sans-serif; font-size: 16px; font-weight: bold; color: #666; }",
    ".situ-tl-m-item { display: flex; align-items: flex-start; margin-bottom: 14px; position: relative; padding-left: 36px; z-index: 1; }",
    ".situ-tl-m-item .situ-tl-item-dot { flex-shrink: 0; width: 12px; height: 12px; margin-top: 4px; margin-right: 8px; border-radius: 50%; z-index: 2; background: #666 !important; border: 1px solid #666; box-shadow: 0 0 0 3px #fff, 0 0 0 5px #666; cursor: default; position: relative; }",
    ".situ-tl-m-item .situ-tl-item-body { flex: 1; }",
    ".situ-tl-m-item .situ-tl-item-date { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-family: 'SimHei','黑体',sans-serif; font-size: 14px; font-weight: bold; margin-bottom: 2px; }",
    ".situ-tl-m-item .situ-tl-item-date .situ-tl-item-project { font-family: 'KaiTi_GB2312','楷体_GB2312','KaiTi','楷体',serif; }",
    ".situ-tl-m-item .situ-tl-item-date .situ-tl-item-project { flex-shrink: 0; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'SimHei','黑体',sans-serif; font-size: 12px; font-weight: normal; color: #555; }",
    ".situ-tl-m-item .situ-tl-item-content { font-family: 'FangSong_GB2312','仿宋_GB2312','FangSong','仿宋',serif; font-size: 14px; line-height: 1.7; color: #333; white-space: pre-wrap; word-break: break-all; }",
    ".situ-tl-m-item .situ-tl-item-note { font-family: 'KaiTi_GB2312','楷体_GB2312','KaiTi','楷体',serif; font-size: 12px; color: #c8d4e2; font-style: normal; margin-top: 2px; }",
    ".situ-tl-m-item:hover, .situ-tl-m-item.tl-active { background: transparent; border-radius: 4px; }",
    ".situ-tl-m-item:hover::after, .situ-tl-m-item.tl-active::after { content: ''; position: absolute; left: 0; right: -10px; top: -5px; bottom: -5px; background: #f0f6ff; border-radius: 4px; z-index: 0; pointer-events: none; }",
    ".situ-tl-m-item.tl-active::after { box-shadow: 0 0 0 1px #b0c4de inset; }",
    ".situ-tl-body { position: relative; padding: 12px 20px; }",
    ".situ-tl-body::before { display: none; }",
    ".situ-tl-sheet { position: relative; }",
    ".situ-tl-sheet::before { content: ''; position: absolute; left: 19px; top: 0; bottom: 0; width: 2px; background: #1f67bd; z-index: 0; }",
    ".situ-tl-m-head { margin-top: 24px; margin-bottom: 14px; min-height: 24px; padding-top: 0; padding-left: 39px; align-items: center; z-index: 1; }",
    ".situ-tl-m-head:first-child { margin-top: 8px; }",
    ".situ-tl-m-head { border-top: 0; }",
    ".situ-tl-m-head::before { display: none; }",
    ".situ-tl-m-head .situ-tl-m-dot { left: 16px; width: 8px; height: 8px; background: #1f67bd; }",
    ".situ-tl-m-head .situ-tl-m-dot::after { left: -3px; top: -3px; width: 12px; height: 12px; border: 2px solid #1f67bd; }",
    ".situ-tl-m-head .situ-tl-m-label { color: #1f67bd; }",
    ".situ-tl-m-item { margin-left: 22px; padding-left: 17px; z-index: 1; }",
    ".situ-tl-divider { height: 1px; margin: 0 0 14px 24px; position: relative; z-index: 4; pointer-events: none; }",
    ".situ-tl-divider-inner { border-bottom: 1px dashed #b8b8b8; }",
    ".situ-tl-divider-month { height: 2px; border-bottom: 2px solid #a9c7ee; }",
    ".situ-tl-m-item::before { display: none; }",
    ".situ-tl-m-item .situ-tl-item-dot { display: none; }",
    ".situ-tl-m-item .situ-tl-item-body { position: relative; z-index: 1; }",
    ".situ-tl-head .situ-set-btn { margin-left: auto; }",
    ".situ-tl-empty { text-align: center; padding: 60px 20px; color: #aaa; font-size: 14px; font-family: 'SimHei','黑体',sans-serif; }",
    ".situ-chart-inner { position: relative; padding: 2px 0 16px; }",
    ".situ-axis { position: relative; z-index: 5; background: #e8ecf1; }",
    ".situ-axis-freeze { position: sticky; top: 2px; left: 0; z-index: 20000; display: flex; align-items: center; justify-content: center; height: 36px; margin-bottom: -36px; background: #16405e; color: #fff; font-size: 13px; font-family: 'SimHei','黑体',sans-serif; font-weight: bold; border-bottom: 2px solid #16405e; }",
    ".situ-axis-freeze-title { pointer-events: none; }",
    ".situ-axis-scroll-btn { position: absolute; top: 0; width: 30px; height: 36px; padding: 0; border: 0; outline: 0; appearance: none; background: transparent !important; color: #fff; font-family: 'SimHei','黑体',sans-serif; font-size: 14px; font-weight: 700; line-height: 36px; cursor: pointer; z-index: 1; }",
    ".situ-axis-scroll-btn.left { left: 8px; }",
    ".situ-axis-scroll-btn.right { right: 8px; }",
    ".situ-axis-scroll-btn:hover { background: transparent !important; color: #fff; }",
    ".situ-axis-col { position: absolute; top: 0; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #636e72; border-left: 1px solid #f0f2f5; white-space: nowrap; z-index: 7; background: transparent !important; }",
    ".situ-axis-col > * { position: relative; z-index: 9; }",
    ".situ-axis-col.hl { color: #000; font-size: 15px; font-weight: 700; }",
    ".situ-axis-col.month-mark { font-family: 'SimHei','黑体',sans-serif; font-weight: bold; align-items: flex-end; padding-bottom: 8px; }",
    ".situ-axis-col.month-mark .mm-wrap { display: inline-flex; align-items: baseline; line-height: 1; }",
    ".situ-axis-col.month-mark .mm-num { font-size: 16px; line-height: 1; }",
    ".situ-axis-col.month-mark .mm-unit { font-size: 12px; font-weight: normal; line-height: 1; }",
    ".situ-ellipsis { font-size: 16px; font-weight: 700; color: #999; letter-spacing: 2px; }",
    ".situ-ellipsis-month { font-size: 18px; font-weight: 700; letter-spacing: 2px; }",
    ".situ-track { display: flex; border-bottom: 1px solid #f0f2f5; position: relative; z-index: 10; }",
    "  .situ-track-label { flex-shrink: 0; position: sticky; left: 0; z-index: 20000; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; font-family: 'SimHei','黑体',sans-serif; padding: 0 6px; text-align: center; overflow: hidden; word-break: break-all; line-height: 1.3; isolation: isolate; }",
    ".situ-track-body { position: relative; z-index: 11; }",
    ".situ-track-line { position: absolute; left: 0; right: 0; top: 50%; height: 2px; background: #e0e6ee; }",
    ".situ-event { position: absolute; display: flex; flex-direction: column; justify-content: center; border-radius: 4px; border-left: 3px solid; font-size: 12px; color: #2d3436; cursor: pointer; overflow: hidden; padding: 2px 8px 2px 6px; }",
    ".situ-event.situ-event-float { box-shadow: 0 4px 12px rgba(0,0,0,.4), 0 1px 3px rgba(0,0,0,.3); border: 1px solid rgba(0,0,0,.25); }",
    ".situ-event-time { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0; }",
    ".situ-event-content { color: #555; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; white-space: normal; word-break: break-all; line-height: 1.4; }",
    ".situ-vline { position: absolute; z-index: 1; pointer-events: none; }",
    ".situ-event.situ-event-selected { outline: 3px solid var(--event-border-color, #5a5a5a); outline-offset: -1px; }",
    ".situ-event-tip { position: fixed; z-index: 46000; max-width: 360px; background: #1b3a6e; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; box-shadow: 0 4px 12px rgba(0,0,0,.35); display: none; pointer-events: none; }",
    "",
    "/* 项目编辑弹窗：名称标签收窄（间隔缩到约 20%） */",
    "#recProjectModal .f-label { width: 64px; min-width: 0; }",
    "#recProjectModal .rec-proj-color { width: 46px; height: 28px; padding: 1px; border: 1px solid #cfd8e3; border-radius: 6px; background: transparent; cursor: pointer; }",
    "#recProjectModal .rec-proj-color::-webkit-color-swatch-wrapper { padding: 0; }",
    "#recProjectModal .rec-proj-color::-webkit-color-swatch { border: none; border-radius: 4px; }",
    "",
    "/* ===== 事件附件（图片 / 文件·文件夹链接）===== */",
    ".rec-shot-btn { margin-left: 8px; }",
    ".rec-attach-img { position: relative; }",
    ".rec-attach-img.dragging { opacity: .45; }",
    ".rec-attach-img.drag-over { border-color: #4aa8ff; box-shadow: 0 0 0 2px rgba(74,168,255,.4); }",
    ".rec-attach-move { position: absolute; left: 4px; top: 4px; z-index: 2; padding: 1px 7px; font-size: 11.5px; line-height: 16px; color: #cfe4ff; background: rgba(6,14,26,.72); border: 1px solid rgba(90,170,255,.45); border-radius: 5px; cursor: grab; user-select: none; }",
    ".rec-attach-move::before { content: ''; display: inline-block; width: 8px; height: 8px; margin-right: 5px; vertical-align: -1px; background-image: radial-gradient(circle, #9fc4ea 1.2px, transparent 1.5px); background-size: 4px 4px; }",
    ".rec-attach-img.dragging .rec-attach-move { cursor: grabbing; }",
    ".rec-shot-tip { position: fixed; left: 50%; top: 42%; transform: translate(-50%,-50%); z-index: 42000; display: none; min-width: 280px; padding: 22px 30px; text-align: center; color: #e6f1ff; background: rgba(8,20,38,.96); border: 1px solid rgba(90,170,255,.5); border-radius: 12px; box-shadow: 0 18px 48px rgba(0,20,60,.7); pointer-events: none; }",
    ".rec-shot-num { font-size: 46px; font-weight: 700; color: #4aa8ff; line-height: 1.1; }",
    ".rec-shot-txt { margin-top: 8px; font-size: 13.5px; color: #b9d4ee; }",
    ".rec-shot-txt b { color: #7fc0ff; }",
    ".rec-save-btn { height: 26px; padding: 0 10px; margin-right: 6px; font-size: 12.5px; color: #9fd0ff; background: rgba(30,70,130,.5); border: 1px solid rgba(90,170,255,.45); border-radius: 6px; cursor: pointer; }",
    ".rec-save-btn:hover { background: rgba(50,120,210,.7); color: #fff; }",
    ".rec-ctx-menu { position: fixed; z-index: 40000; min-width: 150px; padding: 5px; background: #16273f; border: 1px solid rgba(90,170,255,.45); border-radius: 8px; box-shadow: 0 12px 30px rgba(0,20,60,.6); display: none; }",
    ".rec-ctx-item { padding: 7px 12px; font-size: 13px; color: #dbeaff; border-radius: 5px; cursor: pointer; white-space: nowrap; }",
    ".rec-ctx-item:hover { background: rgba(60,140,235,.35); }",
    ".rec-attach-event { font-size: 12.5px; color: #9dc2ea; background: rgba(30,70,130,.25); border-left: 3px solid #4aa8ff; padding: 7px 10px; border-radius: 5px; margin-bottom: 12px; max-height: 54px; overflow: auto; }",
    ".rec-attach-sec-title { font-size: 13px; font-weight: 700; color: #cfe4ff; margin: 6px 0 8px; }",
    ".rec-attach-tip { font-weight: 400; font-size: 11.5px; color: #6f96bf; margin-left: 8px; }",
    ".rec-attach-drop { border: 1.5px dashed rgba(90,170,255,.45); border-radius: 10px; padding: 10px; min-height: 118px; background: rgba(10,22,40,.35); outline: none; }",
    ".rec-attach-drop:focus, .rec-attach-drop.hot { border-color: #4aa8ff; box-shadow: 0 0 0 3px rgba(74,168,255,.18); }",
    ".rec-attach-imglist { display: flex; flex-wrap: wrap; gap: 10px; }",
    ".rec-attach-empty { width: 100%; color: #6f96bf; font-size: 12.5px; text-align: center; padding: 30px 0; }",
    ".rec-attach-img { width: 168px; border: 1px solid rgba(90,170,255,.3); border-radius: 8px; overflow: hidden; background: rgba(8,18,34,.7); }",
    ".rec-attach-img img { display: block; width: 168px; height: 112px; object-fit: cover; cursor: zoom-in; background: #04080f; }",
    ".rec-attach-img-foot { display: flex; align-items: center; gap: 4px; padding: 4px; }",
    ".rec-attach-img-foot input { flex: 1; min-width: 0; height: 24px; padding: 0 6px; font-size: 12px; color: #cfe4ff; background: rgba(8,18,34,.9); border: 1px solid rgba(90,170,255,.3); border-radius: 5px; outline: none; }",
    ".rec-attach-del { flex-shrink: 0; width: 22px; height: 22px; border: none; border-radius: 5px; background: rgba(150,40,40,.35); color: #ffb3b3; cursor: pointer; font-size: 14px; line-height: 1; }",
    ".rec-attach-del:hover { background: rgba(200,50,50,.6); color: #fff; }",
    ".rec-attach-tools { margin: 8px 0 14px; }",
    ".rec-attach-linkadd { display: flex; gap: 6px; margin-bottom: 8px; }",
    ".rec-attach-linkadd input { flex: 1; min-width: 0; height: 30px; padding: 0 8px; font-size: 12.5px; color: #cfe4ff; background: rgba(8,18,34,.9); border: 1px solid rgba(90,170,255,.3); border-radius: 6px; outline: none; }",
    ".rec-attach-linklist { display: flex; flex-direction: column; gap: 6px; }",
    ".rec-attach-link { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(20,42,78,.4); border: 1px solid rgba(90,170,255,.25); border-radius: 7px; }",
    ".rec-attach-link-ico { flex-shrink: 0; font-size: 11px; color: #8fc8ff; background: rgba(30,70,130,.55); border: 1px solid rgba(90,170,255,.35); border-radius: 4px; padding: 1px 6px; }",
    ".rec-attach-link-path { flex: 1; min-width: 0; font-size: 12.5px; color: #b9d4ee; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".rec-attach-open { flex-shrink: 0; height: 24px; padding: 0 10px; font-size: 12px; color: #8fc8ff; background: rgba(30,70,130,.5); border: 1px solid rgba(90,170,255,.4); border-radius: 5px; cursor: pointer; }",
    ".rec-attach-open:hover { background: rgba(50,120,210,.65); color: #fff; }",
    ".rec-attach-viewimgs { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }",
    ".rec-attach-vimg { width: 180px; border: 1px solid rgba(90,170,255,.3); border-radius: 8px; overflow: hidden; background: rgba(8,18,34,.7); }",
    ".rec-attach-vimg img { display: block; width: 180px; height: 120px; object-fit: cover; cursor: zoom-in; }",
    ".rec-attach-vimg .cap { padding: 5px 8px; font-size: 12px; color: #9dc2ea; word-break: break-all; }",
    ".rec-tl-attach { display: inline-flex; align-items: center; margin-left: 8px; padding: 0 5px; font-size: 14px; line-height: 1; color: #4aa8ff; cursor: pointer; border-radius: 5px; }",
    ".rec-tl-attach:hover { background: rgba(74,168,255,.25); }",
    ".rec-lb { position: fixed; inset: 0; z-index: 41000; background: rgba(2,6,14,.94); display: none; }",
    ".rec-lb.show { display: block; }",
    ".rec-lb-stage { position: absolute; inset: 0 0 52px 0; overflow: hidden; cursor: grab; }",
    ".rec-lb-stage.dragging { cursor: grabbing; }",
    ".rec-lb-stage img { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; max-width: none; }",
    ".rec-lb-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 52px; display: flex; align-items: center; gap: 10px; padding: 0 16px; background: rgba(10,20,38,.96); border-top: 1px solid rgba(90,170,255,.3); }",
    ".rec-lb-name { font-size: 13px; color: #cfe4ff; }",
    ".rec-lb-note { font-size: 12.5px; color: #8fb4dd; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".rec-lb-spacer { flex: 1; }",
    ".rec-lb-btn { height: 30px; padding: 0 12px; font-size: 12.5px; color: #8fc8ff; background: rgba(30,70,130,.5); border: 1px solid rgba(90,170,255,.4); border-radius: 6px; cursor: pointer; }",
    ".rec-lb-btn:hover { background: rgba(50,120,210,.65); color: #fff; }",
    ".rec-lb-scale { font-size: 12.5px; color: #cfe4ff; min-width: 44px; text-align: center; }",
    "",
    "/* ===== 项目编辑：多项目勾选 + 多窗口 + 合并时间轴 ===== */",
    ".rec3-item-chk { flex: 0 0 auto; width: 14px; height: 14px; margin: 0 7px 0 1px; cursor: pointer; accent-color: #0984e3; }",
    ".rec-proj-multi { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; padding: 10px; overflow: hidden; background: var(--da-surface); }",
    ".rec-proj-win { flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; border: 1px solid #cfd8e3; border-radius: 6px; background: #eaf3fd; overflow: hidden; }",
    ".rec-proj-win-head { flex: 0 0 auto; display: flex; align-items: center; gap: 7px; height: 28px; padding: 0 10px; background: #0D47A1; color: #fff; font-family: 'SimHei','黑体',sans-serif; font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".rec-proj-win-dot { flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%; }",
    ".rec-proj-win-body { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 12px; outline: none; white-space: pre-wrap; word-break: break-all; font-size: 15px; font-family: 'FangSong_GB2312','仿宋_GB2312','FangSong','仿宋',serif; line-height: 1.8; color: #333; }",
    ".rec-proj-win-body[contenteditable=\"true\"]:empty:before { content: attr(data-ph); color: #b2bec3; pointer-events: none; }",
    ".rec-mtl { padding: 12px 20px; }",
    ".rec-mtl .situ-tl-m-item { border-radius: 4px; cursor: pointer; transition: filter .15s; }",
    ".rec-mtl .situ-tl-m-item:hover { filter: brightness(0.96); }",
    ".rec-mtl .situ-tl-m-item:hover::after, .rec-mtl .situ-tl-m-item.tl-active::after { display: none; }",
    ".rec-mtl-item.rec-mtl-active { outline: 2px solid #0D47A1; outline-offset: 2px; }",
    "",
    "/* ===== 时间事件附件标记：含附件的日期与无附件区分 ===== */",
    ".rec-tl-link-attach { color: #c0392b; font-weight: 700; text-decoration-thickness: 2px; text-underline-offset: 2px; }",
    ".rec-tl-link-attach:hover { color: #a5281c; }",
    ".rec-tl-item-has-attach .rec-tl-title { color: #c0392b; border-bottom-color: #f0c4bd; }",
    ".rec-tl-item-has-attach .rec-tl-title-orig::before { content: '\\25CF'; color: #e17055; font-size: 11px; margin-right: 4px; vertical-align: 1px; }",
    ".rec-mtl-item-has-attach .situ-tl-item-date > span:first-child { border-bottom: 2px solid #e17055; }",
    ".situ-tl-item-attach { flex: 0 0 auto; margin-left: 8px; padding: 0 5px; border-radius: 3px; background: #fdecea; color: #c0392b; font-size: 11px; font-family: 'SimHei','黑体',sans-serif; font-weight: 700; }",
    "",
    "",
    "/* ---- 12. 项目列表显隐 + 多选「全屏」聚焦 + 时间轴圆点（第12次） ---- */",
    "#recProjectPanel .rec3-wrap { position: relative; }",
    "#recProjectPanel .rec-list-reveal { display: none; position: absolute; left: 10px; top: 11px; z-index: 6;",
    "  width: 24px; height: 22px; align-items: center; justify-content: center; padding: 0;",
    "  font-family: Consolas, monospace; font-size: 13px; line-height: 1; cursor: pointer;",
    "  color: #bfe0ff; background: rgba(20,42,74,.9); border: 1px solid var(--da-line-2); border-radius: 6px; }",
    "#recProjectPanel .rec-list-reveal:hover { background: rgba(38,84,140,.95); color: #fff; }",
    "#recProjectPanel .rec3-wrap.rec-list-collapsed .rec3-listcol,",
    "#recProjectPanel .rec3-wrap.rec-list-collapsed .rec3-listcol + .rec3-divider { display: none; }",
    "#recProjectPanel .rec3-wrap.rec-list-collapsed .rec-list-reveal { display: inline-flex; }",
    "#recProjectPanel .rec3-wrap.rec-list-collapsed .rec3-contentcol .rec3-head { padding-left: 44px; }",
    ".rec-add-btn { height: 26px; padding: 0 12px; font-size: 12.5px; color: #eaf6ff;",
    "  background: rgba(30,70,130,.5); border: 1px solid rgba(90,170,255,.45); border-radius: 6px; cursor: pointer; }",
    ".rec-add-btn:hover { background: rgba(50,120,210,.7); color: #fff; }",
    ".rec-collapse-btn { width: 26px; height: 26px; padding: 0; font-family: Consolas, monospace; font-size: 13px;",
    "  line-height: 1; color: #bfe0ff; background: rgba(30,70,130,.5); border: 1px solid rgba(90,170,255,.45); border-radius: 6px; cursor: pointer; }",
    ".rec-collapse-btn:hover { background: rgba(50,120,210,.7); color: #fff; }",
    "/* 时间轴事件模块右移 + 竖线上同色实心圆（与模块垂直居中） */",
    ".rec-mtl .situ-tl-m-item { margin-left: 34px; padding-left: 14px; }",
    ".rec-mtl .situ-tl-m-item::before { content: \"\"; display: block; position: absolute; left: -20px; top: 50%;",
    "  width: 12px; height: 12px; margin-top: -6px; border-radius: 50%; z-index: 3;",
    "  background: var(--pc, #1f67bd); box-shadow: 0 0 0 3px var(--da-surface), 0 0 8px var(--pc, #1f67bd); }",
    ".rec-mtl .situ-tl-divider { margin-left: 34px; }",
    "",
    "",
    "/* ---- 15. 时间轴列：纵向排列 / 横向分布 + 全屏 ---- */",
    ".rec-tl-view-group { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }",
    ".rec-tl-view-btn { height: 24px; padding: 0 10px; font-family: inherit; font-size: 12px; letter-spacing: .5px;",
    "  cursor: pointer; white-space: nowrap; color: #cfe6ff; background: rgba(12, 32, 60, 0.55);",
    "  border: 1px solid rgba(90, 170, 255, 0.4); border-radius: 6px; }",
    ".rec-tl-view-btn:hover { background: rgba(30, 70, 130, 0.85); color: #fff; }",
    ".rec-tl-view-btn.active { color: #fff; background: linear-gradient(160deg, #1c92e0, #0a7ec9);",
    "  border-color: #9ef0ff; box-shadow: 0 0 10px rgba(0, 210, 255, 0.45); }",
    ".rec-tl-full-btn { flex-shrink: 0; width: 26px; height: 26px; display: inline-flex; align-items: center;",
    "  justify-content: center; padding: 0; cursor: pointer; color: #dceeff; background: rgba(12, 32, 60, 0.55);",
    "  border: 1px solid rgba(90, 170, 255, 0.4); border-radius: 6px; }",
    ".rec-tl-full-btn:hover { background: rgba(30, 70, 130, 0.85); color: #fff; }",
    ".rec-tl-full-btn.active { color: #fff; background: linear-gradient(160deg, #1c92e0, #0a7ec9);",
    "  border-color: #9ef0ff; box-shadow: 0 0 10px rgba(0, 210, 255, 0.45); }",
    ".rec3-tl-body { flex: 1; min-height: 0; display: flex; position: relative; }",
    ".rec3-tl-body > #recProjectTimeline,",
    ".rec3-tl-body > #situChartContainer { flex: 1; min-height: 0; min-width: 0; }",
    "#recProjectPanel.rec-tl-full .rec3-listcol,",
    "#recProjectPanel.rec-tl-full .rec3-contentcol,",
    "#recProjectPanel.rec-tl-full .rec3-divider { display: none; }",
    "#recProjectPanel.rec-tl-full .rec3-tlcol { border-left: none; }",
    "/* 检索命中：当前项高亮（纵向排列 / 横向分布通用） */",
    ".rec-mtl-item.rec-search-current { outline: 2px solid #9ef0ff; outline-offset: -2px; }",
    ".situ-event.rec-search-current { outline: 2px solid #9ef0ff; outline-offset: 1px; }",
    "",
    "",
    "/* ===== 项目编辑：顶栏检索（第20次） ===== */",
    ".rec-proj-search-wrap { flex: 1 1 0; min-width: 220px; display: flex; align-items: center; gap: 8px;",
    "  padding-left: 14px; }",
    ".rec-proj-search-wrap.hidden { display: none !important; }",
    ".rec-proj-search-wrap .rec-search-box { flex: 1 1 auto; min-width: 80px; height: 30px; padding: 0 12px;",
    "  font-size: 13px; border-radius: 6px; background: rgba(6, 16, 32, 0.85); }",
    ".rec-proj-search-wrap .rec-search-box:focus { border-color: var(--da-accent); box-shadow: 0 0 10px rgba(74, 168, 255, 0.35); }",
    ".rec-proj-search-wrap .rec-search-count { flex: 0 0 auto; min-width: 34px; text-align: center; }",
    ".rec-proj-search-wrap .setbar-mini { flex: 0 0 auto; height: 28px; padding: 0 10px; }",
    ".rec-proj-search-wrap .setbar-only { flex: 0 0 auto; white-space: nowrap; }",
    "",
    "",
    "/* ===== 数据管理：检索 + 双栏主题列表（第29次） ===== */",
    ".rec-data-search-wrap { flex: 1 1 0; min-width: 220px; display: flex; align-items: center;",
    "  padding-left: 14px; }",
    ".rec-data-search-wrap.hidden { display: none !important; }",
    ".rec-data-search-pill { position: relative; flex: 1 1 auto; display: flex; align-items: center;",
    "  height: 32px; padding: 0 14px 0 36px; border-radius: 999px;",
    "  background: rgba(8, 18, 34, 0.62); border: 1px solid var(--da-line-2);",
    "  box-shadow: inset 0 1px 0 rgba(160, 210, 255, 0.07), 0 8px 22px rgba(0, 10, 30, 0.42);",
    "  transition: border-color 0.16s ease, box-shadow 0.16s ease; }",
    ".rec-data-search-pill:focus-within { border-color: var(--da-accent);",
    "  box-shadow: inset 0 1px 0 rgba(160, 210, 255, 0.1), 0 0 0 1px rgba(74, 168, 255, 0.35), 0 8px 24px rgba(0, 10, 30, 0.5); }",
    ".rec-data-search-ico { position: absolute; left: 13px; top: 50%; width: 15px; height: 15px;",
    "  margin-top: -7.5px; color: #6f92b8; pointer-events: none; }",
    ".rec-data-search { flex: 1 1 auto; min-width: 0; height: 100%; padding: 0; font-family: inherit;",
    "  font-size: 13px; color: #eaf6ff; outline: none; background: transparent; border: none; }",
    ".rec-data-search::placeholder { color: #6f92b8; }",
    "#recDataPanel .rec-data-cols { flex: 1; min-height: 0; display: flex; gap: 16px; padding: 14px 16px; }",
    "#recDataPanel .rec-data-wrap { padding: 0; }",
    "#recDataPanel .rec-data-col { flex: 1 1 0; min-width: 0; min-height: 0; display: flex; flex-direction: column;",
    "  border-radius: 14px; border: 1px solid rgba(90, 170, 255, 0.22); overflow: hidden;",
    "  background: linear-gradient(180deg, rgba(20, 40, 70, 0.55), rgba(9, 20, 38, 0.72));",
    "  box-shadow: inset 0 1px 0 rgba(160, 210, 255, 0.08), 0 14px 34px rgba(0, 8, 24, 0.45); }",
    "#recDataPanel .rec-data-col-head { display: flex; align-items: center; gap: 9px; flex-shrink: 0;",
    "  height: 44px; padding: 0 14px; font-size: 13px; font-weight: 700; color: #dceeff;",
    "  background: linear-gradient(180deg, rgba(34, 66, 108, 0.72), rgba(14, 30, 54, 0.35));",
    "  border-bottom: 1px solid rgba(90, 170, 255, 0.22); }",
    "#recDataPanel .rec-data-col-ico { width: 24px; height: 24px; border-radius: 7px; flex-shrink: 0;",
    "  display: inline-flex; align-items: center; justify-content: center; color: #7fe0ff;",
    "  background: linear-gradient(160deg, rgba(51, 214, 255, 0.28), rgba(28, 146, 224, 0.18));",
    "  border: 1px solid rgba(90, 190, 255, 0.45); box-shadow: inset 0 1px 0 rgba(200, 240, 255, 0.22); }",
    "#recDataPanel .rec-data-col-ico svg { width: 14px; height: 14px; display: block; }",
    "#recDataPanel .rec-data-col-rel .rec-data-col-ico { color: #d0b0ff;",
    "  background: linear-gradient(160deg, rgba(160, 110, 255, 0.3), rgba(110, 60, 200, 0.18));",
    "  border-color: rgba(170, 130, 255, 0.45); }",
    "#recDataPanel .rec-data-col-hint { margin-left: auto; font-size: 11.5px; font-weight: 400; color: var(--da-dim); }",
    "#recDataPanel .rec-data-list { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; gap: 9px;",
    "  display: flex; flex-direction: column; }",
    "#recDataPanel .rec-data-item { position: relative; display: flex; align-items: center; gap: 12px;",
    "  padding: 10px 12px; cursor: pointer; border-radius: 11px;",
    "  background: linear-gradient(180deg, rgba(26, 50, 84, 0.78), rgba(12, 26, 48, 0.86));",
    "  border: 1px solid rgba(90, 140, 200, 0.28);",
    "  box-shadow: inset 0 1px 0 rgba(170, 215, 255, 0.07), 0 6px 16px rgba(0, 8, 24, 0.35);",
    "  transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease; }",
    "#recDataPanel .rec-data-item:hover { transform: translateY(-1px); border-color: rgba(120, 190, 255, 0.6);",
    "  box-shadow: inset 0 1px 0 rgba(170, 215, 255, 0.1), 0 10px 24px rgba(0, 10, 30, 0.5); }",
    "#recDataPanel .rec-data-item.active { border-color: #9ef0ff;",
    "  background: linear-gradient(160deg, rgba(30, 104, 176, 0.92), rgba(10, 52, 96, 0.95));",
    "  box-shadow: inset 0 1px 0 rgba(210, 245, 255, 0.16), 0 0 0 1px rgba(158, 240, 255, 0.45), 0 0 18px rgba(0, 210, 255, 0.4); }",
    "#recDataPanel .rec-data-item.dragging { opacity: 0.42; }",
    "#recDataPanel .rec-data-item.drag-over { border-color: #9ef0ff; box-shadow: 0 0 0 1px rgba(158, 240, 255, 0.45); }",
    "#recDataPanel .rec-data-idx { flex-shrink: 0; width: 34px; height: 34px; border-radius: 10px;",
    "  display: inline-flex; align-items: center; justify-content: center;",
    "  font: 800 17px/1 \"Segoe UI\", Arial, sans-serif; letter-spacing: 0.3px; color: #04121f;",
    "  background: linear-gradient(160deg, #63e6ff, #1a8fe0);",
    "  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 4px 12px rgba(0, 170, 255, 0.35); }",
    "#recDataPanel .rec-data-idx-rel { background: linear-gradient(160deg, #d3a6ff, #7b46d8);",
    "  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 4px 12px rgba(150, 90, 255, 0.35); }",
    "#recDataPanel .rec-data-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }",
    "#recDataPanel .rec-data-name { font-size: 15px; font-weight: 600; color: var(--da-text);",
    "  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    "#recDataPanel .rec-data-item.active .rec-data-name { color: #fff; }",
    "#recDataPanel .rec-data-file { font-size: 11.5px; color: var(--da-dim);",
    "  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    "#recDataPanel .rec-data-grip { flex-shrink: 0; width: 12px; height: 20px; cursor: grab; opacity: 0.45;",
    "  background-image: radial-gradient(circle, rgba(160, 205, 255, 0.95) 1.2px, transparent 1.3px);",
    "  background-size: 6px 6px; background-position: center; }",
    "#recDataPanel .rec-data-item:hover .rec-data-grip { opacity: 0.85; }",
    "#recDataPanel .rec-data-add { display: flex; align-items: center; justify-content: center; gap: 8px;",
    "  min-height: 46px; margin-top: 1px; cursor: pointer; border-radius: 11px;",
    "  border: 1px dashed rgba(110, 175, 240, 0.45); background: rgba(12, 28, 50, 0.35);",
    "  color: #7fb6e8; font-size: 13px; transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease; }",
    "#recDataPanel .rec-data-add:hover { background: rgba(24, 58, 100, 0.55);",
    "  border-color: rgba(150, 215, 255, 0.8); color: #d6f0ff; }",
    ".rec-data-add-plus { position: relative; width: 13px; height: 13px; }",
    ".rec-data-add-plus::before, .rec-data-add-plus::after { content: \"\"; position: absolute;",
    "  background: currentColor; border-radius: 1px; }",
    ".rec-data-add-plus::before { left: 6px; top: 0; width: 1.5px; height: 13px; }",
    ".rec-data-add-plus::after { left: 0; top: 6px; width: 13px; height: 1.5px; }",
    "#recDataPanel .rec-data-empty { padding: 22px 12px; text-align: center; color: var(--da-dim); font-size: 13px;",
    "  border: 1px dashed rgba(110, 175, 240, 0.3); border-radius: 11px; }",
    "",
    "",
    "/* ===== 项目编辑：中栏 / 时间轴栏可拖动调宽（第19次） ===== */",
    "#recProjectPanel .rec3-divider:hover, #recProjectPanel .rec3-divider.dragging { background: rgba(74, 168, 255, 0.55); }",
    "body.rec-col-dragging { cursor: col-resize; user-select: none; }",
    "",
    "/* ===== 横向分布：事件附件椭圆按钮（第19次） ===== */",
    ".situ-event-attach-btn { position: absolute; display: inline-flex; align-items: center; justify-content: center;",
    "  height: 18px; padding: 0 10px; border-radius: 999px; font-family: 'SimHei', '黑体', sans-serif;",
    "  font-size: 11px; line-height: 1; color: #0D47A1; background: linear-gradient(180deg, #ffffff 0%, #eaf4ff 55%, #d6e9ff 100%); border: 1px solid rgba(13, 71, 161, 0.65);",
    "  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 0 rgba(13, 71, 161, 0.16); cursor: pointer; z-index: 2;",
    "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".situ-event-attach-btn:hover { background: linear-gradient(180deg, #f4fbff 0%, #dcefff 55%, #c6e2ff 100%); color: #08306b; border-color: #0D47A1; }",
    "",
    "/* ===== 横向分布：项目内容日期 → 事件块定位闪烁（第19次） ===== */",
    ".situ-event.flash { box-shadow: 0 0 0 3px #9ef0ff, 0 0 16px rgba(158, 240, 255, 0.9) !important; z-index: 10001 !important; }",
    "",
    "",
    "/* ===== 事件附件：双击日期编辑 + 文件/文件夹分栏（第22次） ===== */",
    ".rec-tl-link { cursor: pointer; }",
    ".rec-tl-link:hover { text-decoration: underline; }",
    ".rec-attach-sec-title .rec-attach-tip { font-weight: 400; }",
    ".rec-attach-linklist:empty { display: none; }",
    "",
    "/* 备注：纵向浅灰 / 横向角标 + 悬停浮窗 */",
    ".situ-event .situ-event-remark-badge { position: absolute; top: 1px; right: 2px; padding: 0 3px; border-radius: 3px; font-family: 'KaiTi_GB2312','楷体_GB2312','KaiTi','楷体',serif; font-size: 10px; line-height: 13px; color: #6b4a12; background: rgba(255, 255, 255, 0.82); pointer-events: none; }",
    ".situ-event-tip { max-width: 360px; }",
    ".situ-axis-tip { max-width: 260px; }",
    "",
    "/* ===== 横向分布：事件模块内联标签 / 备注图标 / 内容省略浮窗（第28次） ===== */",
    ".situ-event { justify-content: flex-start; padding: 1px 8px 1px 6px; }",
    ".situ-event-top { display: flex; align-items: center; gap: 4px; min-width: 0; flex: 0 0 auto; }",
    ".situ-event-top .situ-event-time { flex: 0 1 auto; min-width: 0; }",
    ".situ-event-attach { flex: 0 0 auto; padding: 0 6px; border-radius: 999px; font-family: 'SimHei','黑体',sans-serif;",
    "  font-size: 10.5px; line-height: 15px; color: #0D47A1; background: linear-gradient(180deg, #ffffff 0%, #eaf4ff 58%, #d5e8ff 100%);",
    "  border: 1px solid rgba(13, 71, 161, 0.55); cursor: pointer; white-space: nowrap;",
    "  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 0 rgba(13, 71, 161, 0.18); }",
    ".situ-event-attach:hover { background: linear-gradient(180deg, #f4fbff 0%, #dcefff 58%, #c4e0ff 100%); color: #08306b; }",
    ".situ-event-remark-ico { flex: 0 0 auto; margin-left: auto; display: inline-flex; align-items: center; justify-content: center;",
    "  width: 16px; height: 16px; border-radius: 50%; color: #6b4a12; background: rgba(255,255,255,.86); cursor: pointer; }",
    ".situ-event-remark-ico:hover { background: #fff; color: #3d2a05; }",
    ".situ-event-content { flex: 1 1 auto; min-height: 0; overflow: hidden; }",
    ".situ-event-more { position: absolute; right: 3px; bottom: 2px; display: none; padding: 0 4px;",
    "  font-family: Consolas, monospace; font-size: 13px; line-height: 12px; color: #fff;",
    "  background: rgba(0,0,0,.4); border-radius: 4px; cursor: pointer; }",
    ".situ-event.rec-overflow .situ-event-more { display: block; }",
    ".situ-event-detail { position: fixed; z-index: 47000; display: none; width: 380px; max-width: calc(100vw - 24px);",
    "  background: rgba(9,26,48,.98); border: 1px solid rgba(90,170,255,.55); border-radius: 8px;",
    "  box-shadow: 0 14px 38px rgba(0,0,0,.65); overflow: hidden; }",
    ".situ-event-detail-head { display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 12px; cursor: move;",
    "  background: rgba(20,48,88,.95); border-bottom: 1px solid rgba(90,170,255,.3); }",
    ".situ-event-detail-title { flex: 1; min-width: 0; font-size: 12.5px; color: #cfe4ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".situ-event-detail-close { flex: 0 0 auto; width: 22px; height: 22px; border: none; border-radius: 5px;",
    "  background: rgba(150,40,40,.35); color: #ffb3b3; cursor: pointer; font-size: 14px; line-height: 1; }",
    ".situ-event-detail-close:hover { background: rgba(200,50,50,.6); color: #fff; }",
    ".situ-event-detail-body { padding: 10px 12px 12px; max-height: 52vh; overflow: auto;",
    "  font-size: 12.5px; line-height: 1.8; color: #e6f0ff; white-space: pre-wrap; word-break: break-all; }",
    "/* ===== 已取消识别的日期（普通文本，右键可恢复） ===== */",
    ".rec-tl-nodate { color: inherit; cursor: context-menu; }",
    ".rec-tl-nodate:hover { background: rgba(120, 160, 210, .22); border-radius: 2px; }",
    "/* ===== 全屏三态：mode2 整屏（时间轴行置于屏幕最上方） ===== */",
    "#recProjectPanel.rec-tl-screen { position: fixed; inset: 0; z-index: 45000; margin: 0; padding: 0; border-radius: 0;",
    "  border: none; background: #0a1a2f; box-shadow: none; }",
    "#recProjectPanel.rec-tl-screen .rec3-wrap,",
    "#recProjectPanel.rec-tl-screen .rec3-tlcol,",
    "#recProjectPanel.rec-tl-screen .rec3-tl-body { height: 100%; min-height: 0; }",
    "body.rec-tl-screen-lock { overflow: hidden; }",
    "/* ===== 编辑项目：7 个预设色圆 + 自选颜色 ===== */",
    ".rec-proj-colors { display: inline-flex; align-items: center; gap: 8px; vertical-align: middle; }",
    ".rec-proj-swatch { width: 24px; height: 24px; padding: 0; border-radius: 50%; cursor: pointer;",
    "  border: 2px solid rgba(255,255,255,.28); box-shadow: 0 0 0 1px rgba(0,0,0,.35) inset; }",
    ".rec-proj-swatch:hover { border-color: rgba(255,255,255,.7); }",
    ".rec-proj-swatch.active { border-color: #fff; box-shadow: 0 0 0 2px rgba(90,170,255,.95); }",
    "#recProjectModal .rec-proj-color { margin-left: 10px; vertical-align: middle; }",
    "/* ===== 中部顶栏：项目色圆（列表隐藏后控制显示事项） ===== */",
    ".rec-proj-dots { display: flex; align-items: center; gap: 5px; margin-left: 2px; flex: 0 1 auto; min-width: 0; overflow: hidden; }",
    ".rec-proj-dot { width: 14px; height: 14px; padding: 0; border-radius: 50%; cursor: pointer; flex: 0 0 auto;",
    "  border: 1px solid rgba(255,255,255,.4); opacity: .72; transition: transform .12s, box-shadow .12s, opacity .12s; }",
    ".rec-proj-dot:hover { opacity: 1; transform: scale(1.18); }",
    ".rec-proj-dot.active { opacity: 1; transform: scale(1.08); box-shadow: 0 0 0 2px rgba(130,205,255,.95), 0 0 7px rgba(80,170,255,.75); }",
    "/* ===== 中部编辑框：含附件的日期 → 右上角实心圆数字 ===== */",
    ".rec-tl-link { position: relative; }",
    ".rec-tl-link.rec-tl-link-attach::after { content: attr(data-badge); position: absolute; top: -7px; right: -8px;",
    "  width: 15px; height: 15px; box-sizing: border-box; padding: 0; border-radius: 50%; background: #d64545; color: #fff;",
    "  font: 700 9px/15px Arial, sans-serif; text-align: center; text-decoration: none;",
    "  pointer-events: none; z-index: 2; box-shadow: 0 0 0 1px rgba(10, 26, 47, 0.6); }",
    "",
    "/* ===== 第30次：附件数字徽标正圆立体 / 标题栏色点居中 + active 内实心点 ===== */",
    ".rec-tl-link.rec-tl-link-attach::after { width: 15px; height: 15px; min-width: 15px; padding: 0; border-radius: 50%;",
    "  background: radial-gradient(circle at 32% 26%, #ff9090 0%, #e35555 40%, #c02c2c 100%) !important;",
    "  box-shadow: 0 0 0 1px rgba(10, 26, 47, 0.62), inset 0 1px 1px rgba(255, 255, 255, 0.6), inset 0 -1px 1px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.45) !important;",
    "  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.32); }",
    ".rec-proj-dots { position: absolute !important; left: 50% !important; top: 50% !important; transform: translate(-50%, -50%) !important; margin-left: 0 !important; flex: 0 0 auto !important; justify-content: center !important; }",
    "#recProjectPanel .rec3-head { position: relative !important; }",
    ".rec-proj-dot { position: relative; }",
    ".rec-proj-dot.active { transform: none !important; box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.55), 0 0 6px rgba(120, 200, 255, 0.55) !important; }",
    ".rec-proj-dot.active::after { content: ''; position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px 0 0 -3px;",
    "  border-radius: 50%; background: #fff; box-shadow: 0 0 3px rgba(0, 0, 0, 0.55), inset 0 0 1px rgba(0, 0, 0, 0.35); }",
    "/* ===== 第31次：附件数字徽标文字精确居中 / 附件粗下划线由时间轴移到项目编辑区 ===== */",
    ".rec-tl-link.rec-tl-link-attach::after { display: flex !important; align-items: center !important; justify-content: center !important;",
    "  font: 700 10px/1 Arial, Helvetica, sans-serif !important; letter-spacing: 0 !important; text-indent: 0 !important;",
    "  text-align: center !important; padding: 0 !important; }",
    "/* 时间轴（纵向排列）：取消含附件日期的粗下划线，仅保留「附件N个」标签 */",
    ".rec-mtl-item-has-attach .situ-tl-item-date > span:first-child { border-bottom: none !important; }",
    ".rec-tl-item-has-attach .rec-tl-title { border-bottom-color: transparent !important; }",
    "/* 项目编辑区（单项目记事本 / 多项目窗体）：含附件的日期改用粗下划线标记 */",
    ".rec-notepad .rec-tl-link-attach, .rec-proj-win-body .rec-tl-link-attach, .rec-project-input .rec-tl-link-attach {",
    "  text-decoration: none !important; border-bottom: 3px solid #e17055 !important; padding-bottom: 1px !important; font-weight: 700 !important; }",
    ".rec-notepad .rec-tl-link-attach:hover, .rec-proj-win-body .rec-tl-link-attach:hover, .rec-project-input .rec-tl-link-attach:hover { border-bottom-color: #c0392b !important; }",
    "/* 第63轮：单/多选统一为「记事本编辑窗」卡片；背景色按项目淡化区分 */",
    ".rec-proj-win { background: #fff; border: 1px solid #dbe3ec; border-radius: 8px; box-shadow: 0 2px 10px rgba(15,40,80,.08); }",
    ".rec-proj-win-head { height: 34px; padding: 0 14px; justify-content: center; background: #fff; color: #2c3e50; border-bottom: 1px solid #eef1f5; font-family: 'SimHei','黑体',sans-serif; font-size: 15px; font-weight: 700; border-radius: 8px 8px 0 0; position: relative; }",
    ".rec-proj-win-head .rec-proj-win-dot { position: absolute; left: 12px; top: 50%; margin-top: -4px; }",
    ".rec-proj-win-body { background: #fff; color: #2c3e50; padding: 14px 18px; font-family: 'SimSun','宋体',serif; font-size: 15px; line-height: 1.9; }",
    ".rec-proj-win-single { flex: 1 1 0; min-height: 0; margin: 10px; }",
    ".rec-proj-multi { background: transparent; gap: 10px; }",
    ""
  ].join('\n');
  var MODULE_PANEL_HTML = [
    "    <div class=\"main-content\" id=\"tab-record\">",
    "      <div id=\"recDataPanel\" class=\"rec-panel hidden\">",
    "        <div class=\"rec-data-wrap\">",
    "          <div class=\"rec-data-cols\">",
    "            <div class=\"rec-data-col\">",
    "              <div class=\"rec-data-col-head\"><span class=\"rec-data-col-ico\"><svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.6' stroke-linecap='round'><path d='M2 4h12M2 8h12M2 12h7'/></svg></span><span>项目主题</span><span class=\"rec-data-col-hint\">双击读取到「项目编辑」</span></div>",
    "              <div class=\"rec-data-list\" id=\"recDataFileList\"></div>",
    "            </div>",
    "            <div class=\"rec-data-col rec-data-col-rel\">",
    "              <div class=\"rec-data-col-head\"><span class=\"rec-data-col-ico\"><svg viewBox='0 0 16 16' fill='none' stroke='currentColor' stroke-width='1.6' stroke-linecap='round'><circle cx='5.4' cy='5.2' r='2.4'/><circle cx='10.8' cy='10.6' r='2.4'/><path d='M7.3 6.6 9 9.2'/></svg></span><span>人物主题</span><span class=\"rec-data-col-hint\">双击进入「人物关系」</span></div>",
    "              <div class=\"rec-data-list\" id=\"recRelFileList\"></div>",
    "            </div>",
    "          </div>",
    "        </div>",
    "      </div>",
    "      <div id=\"recProjectPanel\" class=\"rec-panel hidden\">",
    "        <div class=\"rec3-wrap\">",
    "          <div class=\"rec3-col rec3-listcol\">",
    "            <div class=\"rec3-head\">",
    "              <span class=\"rec3-title\" id=\"recThemeName\">项目列表</span>",
    "              <div class=\"rec3-head-actions\">",
    "                <button class=\"rec-add-btn\" title=\"新增子项\" onclick=\"addRecProject()\">＋新增</button>",
    "                <button class=\"rec-collapse-btn\" id=\"recListToggle\" title=\"收起项目列表\" onclick=\"recToggleListCol()\">&lt;&lt;</button>",
    "              </div>",
    "            </div>",
    "            <div class=\"rec3-list-body\" id=\"recSubList\"></div>",
    "          </div>",
    "          <div class=\"rec3-divider\" id=\"recListDivider\"></div>",
    "          <div class=\"rec3-col rec3-contentcol\">",
    "            <button class=\"rec-list-reveal\" id=\"recListReveal\" title=\"展开项目列表\" onclick=\"recToggleListCol()\">&gt;&gt;</button>",
    "            <div class=\"rec3-head\">",
    "              <span class=\"rec3-title\" id=\"recProjectTitle\">项目</span>",
    "              <button class=\"btn btn-primary btn-sm\" onclick=\"recProjectAutoRecognize()\">自动识别</button>",
    "              <div class=\"rec-proj-dots\" id=\"recProjDotBar\"></div>",
    "              <div class=\"rec-zoom-group\">",
    "                <button class=\"rec-zoom-btn\" title=\"缩小编辑框文字\" onclick=\"recProjectZoom(-1)\">−</button>",
    "                <span class=\"rec-zoom-val\" id=\"recProjZoomVal\">100%</span>",
    "                <button class=\"rec-zoom-btn\" title=\"放大编辑框文字\" onclick=\"recProjectZoom(1)\">＋</button>",
    "              </div>",
    "            </div>",
    "            <div class=\"rec-proj-win rec-proj-win-single\" id=\"recProjectWinSingle\">",
    "              <div class=\"rec-proj-win-head\" id=\"recProjSingleHead\"><span class=\"rec-proj-win-dot\" id=\"recProjSingleDot\"></span><span id=\"recProjSingleName\">项目</span></div>",
    "              <div class=\"rec-proj-toolbar\" id=\"recProjSingleBar\"></div>",
    "              <div id=\"recProjectInput\" class=\"rec-proj-win-body\" contenteditable=\"true\" data-ph=\"在此粘贴项目内容，右侧自动生成时间轴事件（自上而下）...\" oninput=\"recProjectInputHandler()\" onblur=\"recProjFlushPersist()\"></div>",
    "            </div>",
    "            <div id=\"recProjectMulti\" class=\"rec-proj-multi hidden\"></div>",
    "          </div>",
    "          <div class=\"rec3-divider\" id=\"recTlDivider\"></div>",
    "          <div class=\"rec3-col rec3-tlcol\">",
    "            <div class=\"rec3-head\">",
    "              <span class=\"rec3-title\">时间轴</span>",
    "              <div class=\"rec-tl-view-group\">",
    "                <button class=\"rec-tl-view-btn active\" data-view=\"v\" title=\"按时间纵向排列事件\" onclick=\"recSetTlView('v')\">纵向排列</button>",
    "                <button class=\"rec-tl-view-btn\" data-view=\"h\" title=\"按项目横向分布展示多维态势图\" onclick=\"recSetTlView('h')\">横向分布</button>",
    "              </div>",
    "              <button class=\"rec-tl-full-btn\" id=\"recTlFullBtn\" title=\"全屏显示时间轴\" onclick=\"recToggleTlFull()\"><svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" aria-hidden=\"true\"><path d=\"M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></button>",
    "            </div>",
    "            <div class=\"rec3-tl-body\">",
    "              <div id=\"recProjectTimeline\" class=\"rec-tl-container\"></div>",
    "              <div id=\"situChartContainer\" class=\"situ-chart hidden\"></div>",
    "            </div>",
    "          </div>",
    "        </div>",
    "      </div>",
    "    </div>"
  ].join('\n');
  var MODULE_MODALS_HTML = [
    "<!-- 工作记录 - 类别设置弹窗 -->",
    "<div id=\"recCatModal\" class=\"modal-mask\" style=\"display:none;\">",
    "  <div class=\"modal-box modal-narrow\">",
    "    <div class=\"modal-head\">",
    "      <span class=\"m-title\">类别设置</span>",
    "      <span class=\"modal-close\" onclick=\"closeRecCatModal()\">&times;</span>",
    "    </div>",
    "    <div class=\"modal-body\">",
    "      <div id=\"recCatList\"></div>",
    "      <div class=\"rec-cat-add\">",
    "        <button class=\"btn btn-outline btn-sm\" onclick=\"addRecCatRow()\">+ 新增类别</button>",
    "      </div>",
    "    </div>",
    "    <div class=\"modal-foot\">",
    "      <div class=\"modal-foot-center\">",
    "        <button class=\"btn btn-primary\" onclick=\"saveRecCatSettings()\">保存</button>",
    "        <button class=\"btn btn-outline\" onclick=\"closeRecCatModal()\">关闭</button>",
    "      </div>",
    "    </div>",
    "  </div>",
    "</div>",
    "",
    "<!-- 工作记录 - 多维态势选择事件弹窗 -->",
    "<div id=\"recSelectModal\" class=\"modal-mask\" style=\"display:none;\">",
    "  <div class=\"modal-box\" style=\"width:600px;\">",
    "    <div class=\"modal-head\">",
    "      <span class=\"m-title\">选择事件类别</span>",
    "      <span class=\"modal-close\" onclick=\"closeRecSelectModal()\">&times;</span>",
    "    </div>",
    "    <div class=\"modal-body\">",
    "      <div style=\"font-size:12px;color:#b2bec3;margin-bottom:10px;\">勾选要纳入态势图的类别，拖动调整顺序，点击色块选择颜色</div>",
    "      <div id=\"recSelectList\"></div>",
    "    </div>",
    "    <div class=\"modal-foot\">",
    "      <div class=\"modal-foot-center\">",
    "        <button class=\"btn btn-primary\" onclick=\"saveRecSelectSettings()\">确定</button>",
    "        <button class=\"btn btn-outline\" onclick=\"closeRecSelectModal()\">取消</button>",
    "      </div>",
    "    </div>",
    "  </div>",
    "</div>",
    "",
    "<!-- 工作记录 - 项目编辑弹窗 -->",
    "<div id=\"recProjectModal\" class=\"modal-mask\" style=\"display:none;\">",
    "  <div class=\"modal-box modal-narrow\">",
    "    <div class=\"modal-head\">",
    "      <span class=\"m-title\" id=\"recProjectModalTitle\">项目</span>",
    "      <span class=\"modal-close\" onclick=\"closeRecProjectModal()\">&times;</span>",
    "    </div>",
    "    <div class=\"modal-body\">",
    "      <div class=\"form-row\">",
    "        <div class=\"f-label\">项目名称</div>",
    "        <div class=\"f-value\"><input type=\"text\" id=\"recProjectNameInput\" placeholder=\"输入项目名称\"></div>",
    "      </div>",
    "      <div class=\"form-row\">",
    "        <div class=\"f-label\">颜色</div>",
    "        <div class=\"f-value\"><div class=\"rec-proj-colors\" id=\"recProjectColorPalette\"></div><input type=\"color\" id=\"recProjectColorInput\" class=\"rec-proj-color\" value=\"#3498db\" title=\"自定义颜色\" oninput=\"recProjectColorCustom(this)\"></div>",
    "      </div>",
    "    </div>",
    "    <div class=\"modal-foot rec-project-modal-foot\">",
    "      <button class=\"btn btn-dark-delete\" id=\"recProjectDeleteBtn\" style=\"display:none;\" onclick=\"deleteRecProject()\">删除</button>",
    "      <button class=\"btn btn-confirm-red\" onclick=\"confirmRecProject()\">确定</button>",
    "      <button class=\"btn btn-outline\" onclick=\"closeRecProjectModal()\">取消</button>",
    "    </div>",
    "  </div>",
    "</div>",
    "",
    "<!-- 工作记录 - 数据管理导出弹窗（勾选项目导出 .js） -->",
    "<div id=\"recExportModal\" class=\"modal-mask\" style=\"display:none;\">",
    "  <div class=\"modal-box\" style=\"width:520px;\">",
    "    <div class=\"modal-head\">",
    "      <span class=\"m-title\">导出工作记录</span>",
    "      <span class=\"modal-close\" onclick=\"closeRecExportModal()\">&times;</span>",
    "    </div>",
    "    <div class=\"modal-body\">",
    "      <div style=\"font-size:12px;color:#b2bec3;line-height:1.7;margin-bottom:10px;\">勾选要导出的项目（默认全部勾选），点击「导出」写入 .js 数据文件：</div>",
    "      <div id=\"recExportProjList\"></div>",
    "    </div>",
    "    <div class=\"modal-foot\">",
    "      <div class=\"modal-foot-center\">",
    "        <button class=\"btn btn-primary\" onclick=\"doRecExport()\">导出</button>",
    "        <button class=\"btn btn-outline\" onclick=\"closeRecExportModal()\">取消</button>",
    "      </div>",
    "    </div>",
    "  </div>",
    "</div>",
    "<!-- 事件附件 - 编辑弹窗 -->",
    "<div id=\"recAttachModal\" class=\"modal-mask\" style=\"display:none;\">",
    "  <div class=\"modal-box\" style=\"width:780px;\">",
    "    <div class=\"modal-head\">",
    "      <span class=\"m-title\">事件附件</span>",
    "      <span class=\"modal-close\" onclick=\"recAttachCloseModal()\">&times;</span>",
    "    </div>",
    "    <div class=\"modal-body\">",
    "      <div class=\"rec-attach-event\" id=\"recAttachEventText\"></div>",
    "",
    "      <div class=\"rec-attach-sec-title\">图片<span class=\"rec-attach-tip\">支持 Ctrl+V 粘贴、拖入图片，或点击「选择图片」「截屏」</span></div>",
    "      <div class=\"rec-attach-drop\" id=\"recAttachDrop\" tabindex=\"0\">",
    "        <div class=\"rec-attach-imglist\" id=\"recAttachImgList\"></div>",
    "      </div>",
    "      <div class=\"rec-attach-tools\">",
    "        <button type=\"button\" class=\"btn btn-outline btn-sm\" onclick=\"document.getElementById('recAttachFileInput').click()\">选择图片</button>",
    "        <input type=\"file\" id=\"recAttachFileInput\" accept=\"image/*\" multiple style=\"display:none\" onchange=\"recAttachPickImages(this)\">",
    "        <button type=\"button\" class=\"btn btn-outline btn-sm rec-shot-btn\" title=\"截屏（Ctrl+Alt+Z）：调用系统截图工具，拖动框选区域，双击（或回车）确认\" onclick=\"recAttachCapture()\">截屏 Ctrl+Alt+Z</button>",
    "      </div>",
    "",
    "      <div class=\"rec-attach-sec-title\">其他文件<span class=\"rec-attach-tip\">输入或粘贴路径，或点击「选择文件」</span></div>",
    "      <div class=\"rec-attach-linkadd\">",
    "        <input type=\"text\" id=\"recAttachLinkInput\" placeholder=\"粘贴文件完整路径，例：D:\\资料\\报告.docx 或 /home/用户名/文档/报告.docx\" onkeydown=\"if(event.key==='Enter'){event.preventDefault();recAttachAddLink('file');}\">",
    "        <button type=\"button\" class=\"btn btn-outline btn-sm\" onclick=\"recAttachAddLink('file')\">添加</button>",
    "        <button type=\"button\" class=\"btn btn-outline btn-sm\" title=\"调用「办公助手」选择本地文件\" onclick=\"recAttachPickPath('file')\">选择文件…</button>",
    "      </div>",
    "      <div class=\"rec-attach-linklist\" id=\"recAttachFileList\"></div>",
    "",
    "      <div class=\"rec-attach-sec-title\">文件夹<span class=\"rec-attach-tip\">输入或粘贴路径，或点击「选择文件夹」</span></div>",
    "      <div class=\"rec-attach-linkadd\">",
    "        <input type=\"text\" id=\"recAttachDirInput\" placeholder=\"粘贴文件夹完整路径，例：D:\\资料\\ 或 /home/用户名/桌面/项目\" onkeydown=\"if(event.key==='Enter'){event.preventDefault();recAttachAddLink('dir');}\">",
    "        <button type=\"button\" class=\"btn btn-outline btn-sm\" onclick=\"recAttachAddLink('dir')\">添加</button>",
    "        <button type=\"button\" class=\"btn btn-outline btn-sm\" title=\"调用「办公助手」选择本地文件夹\" onclick=\"recAttachPickPath('dir')\">选择文件夹…</button>",
    "      </div>",
    "      <div class=\"rec-attach-linklist\" id=\"recAttachDirList\"></div>",
    "    </div>",
    "    <div class=\"modal-foot\">",
    "      <button type=\"button\" class=\"btn btn-outline\" onclick=\"recAttachCloseModal()\">取消</button>",
    "      <button type=\"button\" class=\"btn btn-primary\" onclick=\"recAttachSave()\">确定</button>",
    "    </div>",
    "  </div>",
    "</div>",
    "",
    "<!-- 事件附件 - 查看弹窗 -->",
    "<div id=\"recAttachViewModal\" class=\"modal-mask\" style=\"display:none;\">",
    "  <div class=\"modal-box\" style=\"width:740px;\">",
    "    <div class=\"modal-head\">",
    "      <span class=\"m-title\">查看附件</span>",
    "      <span class=\"modal-close\" onclick=\"recAttachViewClose()\">&times;</span>",
    "    </div>",
    "    <div class=\"modal-body\">",
    "      <div class=\"rec-attach-event\" id=\"recAttachViewEventText\"></div>",
    "      <div class=\"rec-attach-viewimgs\" id=\"recAttachViewImgs\"></div>",
    "      <div class=\"rec-attach-linklist\" id=\"recAttachViewLinks\"></div>",
    "    </div>",
    "    <div class=\"modal-foot\">",
    "      <button type=\"button\" class=\"btn btn-primary\" onclick=\"recAttachViewClose()\">关闭</button>",
    "    </div>",
    "  </div>",
    "</div>",
    "",
    "<!-- 事件附件 - 原图灯箱 -->",
    "<div id=\"recAttachLightbox\" class=\"rec-lb\">",
    "  <div class=\"rec-lb-stage\" id=\"recLbStage\"><img id=\"recLbImg\" alt=\"原图\"></div>",
    "  <div class=\"rec-lb-bar\">",
    "    <span class=\"rec-lb-name\" id=\"recLbName\"></span>",
    "    <span class=\"rec-lb-note\" id=\"recLbNote\"></span>",
    "    <span class=\"rec-lb-spacer\"></span>",
    "    <button type=\"button\" class=\"rec-lb-btn\" onclick=\"recLbZoom(-1)\">－</button>",
    "    <span class=\"rec-lb-scale\" id=\"recLbScale\">100%</span>",
    "    <button type=\"button\" class=\"rec-lb-btn\" onclick=\"recLbZoom(1)\">＋</button>",
    "    <button type=\"button\" class=\"rec-lb-btn\" onclick=\"recLbPrev()\">‹ 上一张</button>",
    "    <button type=\"button\" class=\"rec-lb-btn\" onclick=\"recLbNext()\">下一张 ›</button>",
    "    <button type=\"button\" class=\"rec-lb-btn\" onclick=\"recLbClose()\">关闭</button>",
    "  </div>",
    "</div>",
    ""
  ].join('\n');
  function inject() {
    if (document.getElementById('recordModuleStyle')) return;
    var mid = document.querySelector('.middle-area');
    if (!document.body || !mid) { document.addEventListener('DOMContentLoaded', inject); return; }
    var style = document.createElement('style');
    style.id = 'recordModuleStyle';
    style.textContent = MODULE_CSS;
    document.head.appendChild(style);
    var host = document.createElement('div');
    host.className = 'main-content';
    host.id = 'tab-record';
    var tpl = new DOMParser().parseFromString(MODULE_PANEL_HTML, 'text/html').getElementById('tab-record');
    host.innerHTML = tpl ? tpl.innerHTML : MODULE_PANEL_HTML;
    mid.appendChild(host);
    var wrap = document.createElement('div');
    wrap.id = 'recordModuleModals';
    wrap.innerHTML = MODULE_MODALS_HTML;
    document.body.appendChild(wrap);
  }
  inject();
})();

// ====== 主题数据注册（供「数据」文件夹下的 js 文件与 index.js 调用）======
window.__daThemeIndex = [];
window.__daPendingTheme = null;
window.DaThemeIndex = function (list) { window.__daThemeIndex = Array.isArray(list) ? list : []; };
window.DaRegisterTheme = function (data) { window.__daPendingTheme = (data && typeof data === 'object') ? data : null; };
window.__daRelationIndex = [];
window.__daPendingRelation = null;
window.DaRelationIndex = function (list) { window.__daRelationIndex = Array.isArray(list) ? list : []; };
window.DaRegisterRelation = function (data) { window.__daPendingRelation = (data && typeof data === 'object') ? data : null; };

// ====== 以下为工作记录模块逻辑（保持原样，全局作用域） ======
// ================================================================
// 工作记录模块（类别 + 记事本时间事件 + 多维态势）
// 注：本模块函数曾缺失导致 init/renderAll 抛错，此处补全最小可用实现
// ================================================================
const REC_CACHE_KEY = 'bgzgl_record_v1';
let recCats = [];       // [{name,color}]
let recEvents = [];     // [{time,content,note}]
let recSituSel = [];    // 态势图选中的类别下标
// 兼容原导出/导入/清空逻辑引用（导出数据「工作记录」范围、导入 js 还原）：
let recCategories = [], recCategoryColors = {}, recData = {}, recCurrentCat = '', recSituCats = [], recSituOrder = [];
let recProjects = [], recCurrentProject = '';
let recProjectTexts = {};   // {项目名: 文字内容}，用于左侧文字区与右侧时间轴
let recProjectHtmls = {};   // {项目名: 格式化后的 innerHTML}，用于切换回来还原编辑状态
let recDomToken = 0;        // 中部编辑区 DOM 的绑定版本（载入新主题时递增）
let recDomProject = '';     // 单窗口 DOM 当前绑定的项目名
let recDomStale = false;    // 中部 DOM 与当前项目数据不一致（换主题/重绘前），禁止回写
let recThemeName = '';      // 当前已加载的主题（数据文件）名
let recDataSelFile = '';    // 数据管理页当前选中的数据文件名
let recDataRelSelFile = ''; // 数据管理页当前选中的人物关系主题文件名
let recThemeTrackMeta = {}; // {项目名:{color}} 主题子项元数据（颜色，可选）
let recProjectAttachments = {};
let recThemeStore = {}; // {主题文件:{attachments:{项目:{事件键:桶}},colors:{项目:色}}} 按主题文件缓存编辑结果 // {项目名: {事件键: {images:[{src,note}], links:[{path,label}]}}} 事件附件
let recProjZoom = 1;        // 左侧编辑框缩放（会话级）
let recTlZoom = 1;          // 右侧时间轴缩放（会话级）
let recProjChecked = new Set();    // 项目编辑：左侧勾选的项目名（多选，多选时中部多窗口、右侧合并时间轴）
let recProjFocus = '';             // 多选模式下中部「全屏」聚焦的项目名（空=上下排列）
let recSituSelProjs = new Set();   // 总体进程：选中的项目名
let recSituProjVisible = true;     // 总体进程：左侧项目列表窗口是否显示
let recSituProjDragFrom = -1;      // 总体进程：项目列表拖动来源索引
let recSituEventW = 150;           // 总体进程：事件块宽度（px）
let recSituEventH = 72;            // 总体进程：事件块高度（px）
let recSituAlignDi = -1;           // 总体进程：点击事件后的对标竖线所在日期列（-1 无）
let recSituAlignColor = '#5a5a5a';  // 对标矩形颜色
let recSituAlignBorder = '#5a5a5a'; // 对标矩形深色边框
let recSituAlignWidth = 1;          // 对标矩形宽度
let recSituAlignLeft = 0;            // 对标矩形左边沿（时间轴内部坐标）
let recSituAlignEventKey = '';       // 当前对标矩形对应的事件
let recSituTopEventKey = '';       // 横向分布：最近点击的事件键，保证重叠事件临时置顶
let recSituZoomLevel = 1;          // 总体进程：整体缩放比例
let recSituSizeGroupVisible = false;// 总体进程：尺寸/缩放按钮组显隐
// 总体进程检索状态（必须在初始化和三级操作栏渲染前声明）
let recSearchQuery = '';
let recSearchMatches = [];
let recSearchIndex = 0;
let recSearchOnly = false;

const SITU_COLORS = ['#b3243b', '#0f7d8c', '#7a35ab', '#1e7a3e', '#a85a08', '#3361d6', '#6f7226'];
const SITU_DARK_COLORS = ['#6e1423', '#08505a', '#4a1f6b', '#114a26', '#6b3a05', '#1d3a85', '#454818'];
// 时间轴：统一浅灰背景；每列底部 2px 实线按月份交替 蓝/青
const SITU_AXIS_LIGHT = '#0e2138';
const SITU_AXIS_LINE = ['#0984e3', '#00bcd4'];

const REC_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#3498db', '#9b59b6', '#e84393', '#0984e3', '#00b894'];

// 第63轮：正文渲染版本。旧缓存里存的是「公文格式」HTML，版本不符时整批丢弃、由原文重生
const REC_RENDER_VER = 65;
function loadRecordData() {
  recCats = [];
  recEvents = [];
  recSituSel = [];
  recProjects = [];
  recCurrentProject = '';
  recProjectTexts = {};
  recProjectHtmls = {};
  recThemeTrackMeta = {};
  recProjectAttachments = {};
  recThemeStore = {};
  recProjChecked = new Set();
  recSituSelProjs = new Set();
  recSituProjVisible = true;
  recSituProjDragFrom = -1;
  let hasSavedSituSelection = false;
  try {
    const raw = localStorage.getItem(REC_CACHE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d) {
        if (Array.isArray(d.cats)) recCats = d.cats;
        if (Array.isArray(d.events)) recEvents = d.events;
        if (Array.isArray(d.situSel)) recSituSel = d.situSel;
        if (Array.isArray(d.projects)) recProjects = d.projects.map(function(v){ return String(v || '').trim(); }).filter(Boolean);
        if (typeof d.currentProject === 'string') recCurrentProject = d.currentProject;
        if (d.projectTexts && typeof d.projectTexts === 'object') recProjectTexts = d.projectTexts;
        if (d.projectHtmls && typeof d.projectHtmls === 'object' && d.renderVer === REC_RENDER_VER) recProjectHtmls = d.projectHtmls;
        if (d.themeTrackMeta && typeof d.themeTrackMeta === 'object') recThemeTrackMeta = d.themeTrackMeta;
        if (typeof d.themeName === 'string') recThemeName = d.themeName;
        if (typeof d.dataSelFile === 'string') recDataSelFile = d.dataSelFile;
        if (d.attachments && typeof d.attachments === 'object') recProjectAttachments = d.attachments;
        if (d.themeStore && typeof d.themeStore === 'object') recThemeStore = d.themeStore;
        if (Array.isArray(d.situSelProjs)) {
          hasSavedSituSelection = true;
          recSituSelProjs = new Set(d.situSelProjs);
        }
        if (typeof d.situProjVisible === 'boolean') recSituProjVisible = d.situProjVisible;
        if (typeof d.situEventW === 'number') recSituEventW = d.situEventW;
        if (typeof d.situEventH === 'number') recSituEventH = d.situEventH;
        if (typeof d.situZoomLevel === 'number') recSituZoomLevel = d.situZoomLevel;
        if (d.tlView === 'h' || d.tlView === 'v') recTlView = d.tlView;
        if (typeof d.situShowLabel === 'boolean') recSituShowLabel = d.situShowLabel;
        if (Array.isArray(d.projChecked)) recProjChecked = new Set(d.projChecked);
      }
    }
  } catch (e) {}
  if (!recCats.length) {
    recCats = [
      { name: '重点', color: REC_COLORS[0] },
      { name: '常规', color: REC_COLORS[5] },
      { name: '完成', color: REC_COLORS[3] }
    ];
  }
  if (!recProjects.length) recProjects = ['项目一', '项目二', '项目三', '项目四', '项目五'];
  // 旧缓存没有选中项目字段时默认展示全部项目；用户明确取消全选后仍保留空选择。
  if (!hasSavedSituSelection) recProjects.forEach(function(p) {
    if (recProjectHasContent(p)) recSituSelProjs.add(p);
  });
  if (!recCurrentProject || recProjects.indexOf(recCurrentProject) < 0) recCurrentProject = recProjects[0] || '';
  recSyncLegacy();
  saveRecordData();
}

function recProjectHasContent(name) {
  return String(recProjectTexts[name] || '').replace(/\s/g, '').length > 0;
}

function recThemeStoreSync() {
  if (!recDataSelFile) return;
  recThemeStore[recDataSelFile] = { attachments: recProjectAttachments, colors: recThemeTrackMeta };
}
function saveRecordData() {
  try { recThemeStoreSync(); } catch (e) {}
  try {
    localStorage.setItem(REC_CACHE_KEY, JSON.stringify({ cats: recCats, events: recEvents, situSel: recSituSel, projects: recProjects, currentProject: recCurrentProject, renderVer: REC_RENDER_VER, projectTexts: recProjectTexts, projectHtmls: recProjectHtmls, situSelProjs: Array.from(recSituSelProjs), situProjVisible: recSituProjVisible, situEventW: recSituEventW, situEventH: recSituEventH, situZoomLevel: recSituZoomLevel, tlView: recTlView, situShowLabel: recSituShowLabel, projChecked: Array.from(recProjChecked), themeTrackMeta: recThemeTrackMeta, themeName: recThemeName, dataSelFile: recDataSelFile, attachments: recProjectAttachments, themeStore: recThemeStore }));
  } catch (e) {}
  recSyncLegacy();
}

// 同步旧字段名（导出/导入 js 数据与 clearAllData 引用）
function recSyncLegacy() {
  recCategories = recCats.map(function(c) { return c.name; });
  recCategoryColors = {};
  recCats.forEach(function(c) { recCategoryColors[c.name] = c.color; });
  recData = { events: recEvents, situSel: recSituSel };
  if (!recCurrentCat && recCategories.length) recCurrentCat = recCategories[0];
}

function renderRecordModule() {
  recRenderTlColumn();
  recRenderSetbarMode();
}

function recBtn1Click(btn, kind) {
  const rp = document.getElementById('recRelationPanel');
  const pp = document.getElementById('recProjectPanel');
  const dp = document.getElementById('recDataPanel');
  const group = document.getElementById('opRecord');
  const t3 = document.getElementById('recTier3');
  const wasActive = btn ? btn.classList.contains('active') : false;
  if (recActiveKind === 'project' && kind !== 'project' && typeof recAutoSave === 'function') recAutoSave(true);
  recActiveKind = kind || 'datamanage';
  const dataSearch = document.getElementById('recDataSearchWrap');
  if (dataSearch) dataSearch.classList.toggle('hidden', recActiveKind !== 'datamanage');
  if (group) group.querySelectorAll('.op-btn2').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  // 数据管理（默认）：数据文件夹 js 文件列表
  if (kind === 'datamanage') {
    if (dp) dp.classList.remove('hidden');
    if (pp) pp.classList.add('hidden');
    if (rp) rp.classList.add('hidden');
    recRenderDataPage();
    recDataRefreshFromDisk();
    if (wasActive && t3 && !t3.classList.contains('hidden')) {
      t3.classList.add('hidden');
      t3.innerHTML = '';
    } else {
      recRenderDataManageTier3();
    }
    recRenderSetbarMode();
    updateMenuArrows();
    return;
  }
  // 项目编辑：子项列表 / 内容 / 时间轴 三栏
  if (kind === 'project') {
    if (dp) dp.classList.add('hidden');
    if (pp) pp.classList.remove('hidden');
    if (rp) rp.classList.add('hidden');
    recRenderSubList();
    if (wasActive && t3 && !t3.classList.contains('hidden')) {
      t3.classList.add('hidden');
      t3.innerHTML = '';
    } else {
      recRenderProjectTier3();
    }
    if (recProjects.length) {
      const cur = recProjects.indexOf(recCurrentProject);
      recOpenProject(cur >= 0 ? cur : 0);
    } else {
      recRenderProjectPanels();
    }
    recRenderTlColumn();
    recRenderSetbarMode();
    updateMenuArrows();
    return;
  }
  // 人物关系：左侧人员关系列表 + 右侧关系拓扑图
  if (dp) dp.classList.add('hidden');
  if (pp) pp.classList.add('hidden');
  if (rp) rp.classList.remove('hidden');
  if (t3) { t3.classList.add('hidden'); t3.innerHTML = ''; }
  if (typeof recRenderRelation === 'function') recRenderRelation();
  recRenderSetbarMode();
  updateMenuArrows();
}

// 按 kind 激活一级按钮（供程序内部切换调用）
function recActivateKind(kind) {
  const btn = document.querySelector('#opRecord .op-btn2[data-kind="' + kind + '"]');
  if (btn) recBtn1Click(btn, kind);
}

// ---- 数据管理：检索 + 双栏主题列表（项目进程 / 人物关系，可拖动排序） ----
const REC_DATA_ORDER_KEY = 'duowei-data-page-order-v1';
const REC_DATA_DIR_KEY = '数据/项目信息';
const REC_DATA_DIR_REL = '数据/人物关系';
const REC_DATA_FS_API = 'http://127.0.0.1:8737/api/ls?path=';
let recDataQuery = '';
let recDataDrag = null;
let recDataDisk = { themes: null, rels: null };
let recDataFsToken = 0;

function recAppBaseDir() {
  let p = String(location.pathname || '').replace(/\\/g, '/');
  try { p = decodeURIComponent(p); } catch (e) {}
  p = p.replace(/[^/]*$/, '');
  if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
  return p;
}
function recDataFsFiles(dir, cb) {
  let done = false;
  const finish = function(list) { if (done) return; done = true; cb(list); };
  let ac = null;
  try { ac = new AbortController(); } catch (e) {}
  const timer = setTimeout(function() { try { if (ac) ac.abort(); } catch (e) {} finish(null); }, 1500);
  const opt = ac ? { signal: ac.signal, cache: 'no-store' } : { cache: 'no-store' };
  fetch(REC_DATA_FS_API + encodeURIComponent(recAppBaseDir() + dir), opt)
    .then(function(r) { return (r && r.ok) ? r.json() : null; })
    .then(function(d) {
      clearTimeout(timer);
      if (!d || !d.ok || !Array.isArray(d.entries)) { finish(null); return; }
      finish(d.entries.filter(function(e) {
        return e && e.type === 'file' && /\.js$/i.test(e.name || '') && !/^index\.js$/i.test(e.name);
      }).map(function(e) { return e.name; }));
    })
    .catch(function() { clearTimeout(timer); finish(null); });
}
function recDataRefreshFromDisk() {
  const token = ++recDataFsToken;
  let pending = 2;
  const apply = function(themes, rels) {
    if (token !== recDataFsToken) return;
    if (themes) recDataDisk.themes = themes;
    if (rels) recDataDisk.rels = rels;
    if (--pending <= 0) recRenderDataPage();
  };
  recDataFsFiles(REC_DATA_DIR_KEY, function(list) { apply(list, null); });
  recDataFsFiles(REC_DATA_DIR_REL, function(list) { apply(null, list); });
}

function recDataOrderLoad() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(REC_DATA_ORDER_KEY) || '{}') || {}; } catch (e) {}
  return { themes: Array.isArray(d.themes) ? d.themes : [], relations: Array.isArray(d.relations) ? d.relations : [] };
}
function recDataOrderSave(o) {
  try { localStorage.setItem(REC_DATA_ORDER_KEY, JSON.stringify(o)); } catch (e) {}
}
function recDataOrdered(files, saved) {
  const out = [];
  saved.forEach(function(f) { if (files.indexOf(f) >= 0 && out.indexOf(f) < 0) out.push(f); });
  files.forEach(function(f) { if (out.indexOf(f) < 0) out.push(f); });
  return out;
}
function recDataIndexEntries(index, disk) {
  const map = {};
  (index || []).forEach(function(it) {
    const file = (typeof it === 'string') ? it : String(it.file || '');
    if (!file) return;
    map[file] = file.replace(/\.js$/i, '');
  });
  const files = (disk && disk.length !== undefined) ? disk.slice() : Object.keys(map);
  const out = [];
  files.forEach(function(file) {
    if (!file || out.some(function(x) { return x.file === file; })) return;
    out.push({ file: file, theme: file.replace(/\.js$/i, '') });
  });
  return out;
}
function recDataThemeEntries() {
  return recDataIndexEntries(window.__daThemeIndex, recDataDisk.themes);
}
function recDataRelationEntries() {
  return recDataIndexEntries(window.__daRelationIndex, recDataDisk.rels);
}
function recDataMatch(it, q) {
  if (!q) return true;
  return (it.theme + ' ' + it.file).toLowerCase().indexOf(q) >= 0;
}
function recDataSeq(n) {
  return n < 10 ? '0' + n : String(n);
}
function recDataItemHtml(kind, it, file, active, idx, seq) {
  const rel = (kind === 'rel');
  return '<div class="rec-data-item' + (active ? ' active' : '') + '" draggable="true"' +
    ' data-file="' + escapeHtml(file) + '" data-idx="' + idx + '" title="' + escapeHtml(file) + '"' +
    ' onclick="' + (rel ? 'recDataRelSelect' : 'recDataSelect') + '(this)"' +
    ' ondblclick="' + (rel ? 'recDataRelOpen' : 'recDataOpen') + '(this)"' +
    ' ondragstart="recDataDragStart(event,this)" ondragover="recDataDragOver(event)"' +
    ' ondragend="recDataDragEnd(event)" ondrop="recDataDrop(event,this)">' +
    '<span class="rec-data-idx' + (rel ? ' rec-data-idx-rel' : '') + '">' + seq + '</span>' +
    '<span class="rec-data-main">' +
    '<span class="rec-data-name">' + escapeHtml(it.theme) + '</span>' +
    '<span class="rec-data-file">' + escapeHtml(file) + '</span>' +
    '</span>' +
    '<span class="rec-data-grip" title="拖动调整顺序"></span>' +
    '</div>';
}
function recDataAddHtml(kind) {
  const rel = (kind === 'rel');
  return '<div class="rec-data-add" onclick="recDataNew(\'' + (rel ? 'rel' : 'theme') + '\')">' +
    '<span class="rec-data-add-plus"></span>' +
    '<span>新增' + (rel ? '人物主题' : '项目主题') + '</span>' +
    '</div>';
}
function recRenderDataPage() {
  const themeBox = document.getElementById('recDataFileList');
  const relBox = document.getElementById('recRelFileList');
  if (!themeBox && !relBox) return;
  recDataBindCtx(themeBox, 'theme');
  recDataBindCtx(relBox, 'rel');
  const q = String(recDataQuery || '').trim().toLowerCase();
  const order = recDataOrderLoad();
  const themeEntries = recDataThemeEntries();
  const relEntries = recDataRelationEntries();
  const themeOrder = recDataOrdered(themeEntries.map(function(x) { return x.file; }), order.themes);
  const relOrder = recDataOrdered(relEntries.map(function(x) { return x.file; }), order.relations);
  const themeByFile = {}, relByFile = {};
  themeEntries.forEach(function(x) { themeByFile[x.file] = x; });
  relEntries.forEach(function(x) { relByFile[x.file] = x; });
  if (themeBox) {
    let html = '';
    let shown = 0;
    themeOrder.forEach(function(file, idx) {
      const it = themeByFile[file];
      if (!it || !recDataMatch(it, q)) return;
      shown++;
      html += recDataItemHtml('theme', it, file, file === recDataSelFile, idx, recDataSeq(shown));
    });
    let body = shown ? html : '<div class="rec-data-empty">' + (q ? '没有匹配的项目主题' : '数据清单为空（数据/项目信息/index.js）') + '</div>';
    if (!q) body += recDataAddHtml('theme');
    themeBox.innerHTML = body;
  }
  if (relBox) {
    let html = '';
    let shown = 0;
    relOrder.forEach(function(file, idx) {
      const it = relByFile[file];
      if (!it || !recDataMatch(it, q)) return;
      shown++;
      html += recDataItemHtml('rel', it, file, file === recDataRelSelFile, idx, recDataSeq(shown));
    });
    let body = shown ? html : '<div class="rec-data-empty">' + (q ? '没有匹配的人物主题' : '暂无人物主题（在「人物关系」页保存）') + '</div>';
    if (!q) body += recDataAddHtml('rel');
    relBox.innerHTML = body;
  }
}
function recDataFilter(v) {
  recDataQuery = String(v || '');
  recRenderDataPage();
}
function recDataDragStart(e, el) {
  const list = el.parentNode;
  const kind = list && list.id === 'recRelFileList' ? 'rel' : 'theme';
  recDataDrag = { kind: kind, from: parseInt(el.getAttribute('data-idx'), 10) };
  el.classList.add('dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', el.getAttribute('data-file') || ''); } catch (err) {}
  }
}
function recDataDragOver(e) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget;
  document.querySelectorAll('#recDataPanel .rec-data-item.drag-over').forEach(function(n) { if (n !== el) n.classList.remove('drag-over'); });
  if (el && el.classList) el.classList.add('drag-over');
}
function recDataDragEnd(e) {
  if (e && e.currentTarget) e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('#recDataPanel .rec-data-item.drag-over').forEach(function(n) { n.classList.remove('drag-over'); });
  recDataDrag = null;
}
function recDataDrop(e, el) {
  e.preventDefault();
  if (!recDataDrag) return;
  const list = el.parentNode;
  const kind = list && list.id === 'recRelFileList' ? 'rel' : 'theme';
  if (kind !== recDataDrag.kind) { recDataDrag = null; return; }
  const to = parseInt(el.getAttribute('data-idx'), 10);
  const from = recDataDrag.from;
  const order = recDataOrderLoad();
  const files = kind === 'rel' ? recDataRelationEntries().map(function(x) { return x.file; }) : recDataThemeEntries().map(function(x) { return x.file; });
  const arr = recDataOrdered(files, kind === 'rel' ? order.relations : order.themes);
  if (from >= 0 && from < arr.length && to >= 0 && to < arr.length && from !== to) {
    const item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
    if (kind === 'rel') order.relations = arr; else order.themes = arr;
    recDataOrderSave(order);
  }
  recDataDrag = null;
  recRenderDataPage();
}
function recDataSelect(el) {
  recDataSelFile = el.getAttribute('data-file') || '';
  const items = document.querySelectorAll('#recDataFileList .rec-data-item');
  items.forEach(function(n) { n.classList.toggle('active', n === el); });
}
function recDataRelSelect(el) {
  recDataRelSelFile = el.getAttribute('data-file') || '';
  const items = document.querySelectorAll('#recRelFileList .rec-data-item');
  items.forEach(function(n) { n.classList.toggle('active', n === el); });
}
function recDataOpen(el) {
  recDataSelect(el);
  recLoadTheme(el.getAttribute('data-file'));
}
function recDataRelOpen(el) {
  recDataRelSelect(el);
  recLoadRelationTheme(el.getAttribute('data-file'));
}

// ---- 数据管理：右键菜单（改名 / 删除 / 新增），直接写盘到「数据」文件夹 ----
const REC_DATA_WRITE_API = 'http://127.0.0.1:8737/api/';
function recDataApi(name, body) {
  return fetch(REC_DATA_WRITE_API + name, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  }).then(function(r) {
    if (!r) return null;
    return r.json().then(function(d) { return d || null; }, function() { return null; }).then(function(d) {
      if (r.status === 404) return { ok: false, error: '服务版本过旧，缺少「' + name + '」接口，请升级并重启本地服务（sh/办公助手服务.py）' };
      if (r.ok) return d;
      if (d && d.ok === false && d.error) return d;
      return { ok: false, error: '服务返回 ' + r.status };
    });
  }).catch(function() { return null; });
}
function recDataDirOf(kind) { return kind === 'rel' ? REC_DATA_DIR_REL : REC_DATA_DIR_KEY; }
function recDataFileName(name) {
  return String(name == null ? '' : name).replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '').trim();
}
function recDataDiskPath(kind, file) { return recAppBaseDir() + recDataDirOf(kind) + '/' + file; }
function recDataEnsureCtx() {
  let m = document.getElementById('recDataCtxMenu');
  if (!m) {
    m = document.createElement('div');
    m.id = 'recDataCtxMenu';
    m.className = 'rec-ctx-menu';
    document.body.appendChild(m);
  }
  return m;
}
function recDataHideCtx() {
  const m = document.getElementById('recDataCtxMenu');
  if (m) m.style.display = 'none';
}
function recDataShowCtx(x, y, kind, file) {
  const m = recDataEnsureCtx();
  let h = '';
  if (file) {
    h += '<div class="rec-ctx-item" data-act="rename">改名</div>';
    h += '<div class="rec-ctx-item" data-act="delete">删除</div>';
  }
  h += '<div class="rec-ctx-item" data-act="new">新增主题</div>';
  m.innerHTML = h;
  m.style.display = 'block';
  const w = m.offsetWidth || 150, hh = m.offsetHeight || 34;
  m.style.left = Math.max(4, Math.min(x, window.innerWidth - w - 6)) + 'px';
  m.style.top = Math.max(4, Math.min(y, window.innerHeight - hh - 6)) + 'px';
  m.onclick = function(e) {
    let it = e.target;
    while (it && it !== m && !(it.getAttribute && it.getAttribute('data-act'))) it = it.parentNode;
    if (!it || it === m) return;
    const act = it.getAttribute('data-act');
    recDataHideCtx();
    if (act === 'rename') recDataRename(kind, file);
    else if (act === 'delete') recDataDelete(kind, file);
    else if (act === 'new') recDataNew(kind);
  };
  if (!window.__daDataCtxOut) {
    window.__daDataCtxOut = true;
    document.addEventListener('click', function(e) {
      const mm = document.getElementById('recDataCtxMenu');
      if (mm && mm.style.display === 'block' && !mm.contains(e.target)) recDataHideCtx();
    });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') recDataHideCtx(); });
    window.addEventListener('blur', recDataHideCtx);
  }
}
function recDataBindCtx(box, kind) {
  if (!box || box.__daCtxBound) return;
  box.__daCtxBound = true;
  box.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    const item = e.target && e.target.closest ? e.target.closest('.rec-data-item') : null;
    recDataShowCtx(e.clientX, e.clientY, kind, item ? (item.getAttribute('data-file') || '') : '');
  });
}
function recDataRefreshAfterWrite() {
  recDataDisk = { themes: null, rels: null };
  recDataRefreshFromDisk();
}
// 写盘接口失败时的统一提示：区分「未连接」与「服务版本过旧」
function recDataFail(prefix, d) {
  recSvcStatusCheck(true);
  let msg;
  if (d && d.error) msg = d.error;
  else msg = '未连接本地服务（127.0.0.1:8737），请先启动「致知办公助手」';
  showToast(prefix + '：' + msg);
}
function recDataNew(kind) {
  const label = kind === 'rel' ? '人物关系主题' : '项目主题';
  const nm = window.prompt('请输入新的' + label + '名称', kind === 'rel' ? '新人物关系主题' : '新项目主题');
  if (nm === null) return;
  const base = recDataFileName(nm) || (kind === 'rel' ? '新人物关系主题' : '新项目主题');
  const file = base + '.js';
  let content;
  if (kind === 'rel') {
    content = '// 多维分析 · 人物关系主题\n// 主题：' + base + '\n\nDaRegisterRelation(' +
      JSON.stringify({ theme: base, people: [], links: [] }, null, 2) + ');\n';
  } else {
    content = '// 多维分析 · 主题数据\n// 主题：' + base + '\n// 保存：' + recNowStamp() + '\n\nDaRegisterTheme(' +
      JSON.stringify({ theme: base, tracks: [] }, null, 2) + ');\n';
  }
  recDataApi('write', { path: recDataDiskPath(kind, file), content: content }).then(function(d) {
    if (!d || !d.ok) { recDataFail('新增失败', d); return; }
    recDataRefreshAfterWrite();
    showToast('已新增' + label + '：' + base);
  });
}
function recDataRename(kind, file) {
  const cur = String(file || '').replace(/\.js$/i, '');
  const nm = window.prompt('请输入新的主题名称', cur);
  if (nm === null) return;
  const base = recDataFileName(nm);
  if (!base || base === cur) return;
  recDataApi('rename', { path: recDataDiskPath(kind, file), name: base }).then(function(d) {
    if (!d || !d.ok) { recDataFail('改名失败', d); return; }
    const nf = (d.data && d.data.name) || (base + '.js');
    const o = recDataOrderLoad();
    const key = kind === 'rel' ? 'relations' : 'themes';
    if (Array.isArray(o[key])) o[key] = o[key].map(function(f) { return f === file ? nf : f; });
    recDataOrderSave(o);
    if (kind === 'rel' && recDataRelSelFile === file) recDataRelSelFile = nf;
    if (kind === 'theme' && recDataSelFile === file) recDataSelFile = nf;
    recDataRefreshAfterWrite();
    showToast('已改名为：' + nf);
  });
}
function recDataDelete(kind, file) {
  const name = String(file || '');
  if (!window.confirm('确认删除主题文件「' + name + '」？此操作不可撤销。')) return;
  recDataApi('delete', { path: recDataDiskPath(kind, file) }).then(function(d) {
    if (!d || !d.ok) { recDataFail('删除失败', d); return; }
    const o = recDataOrderLoad();
    const key = kind === 'rel' ? 'relations' : 'themes';
    if (Array.isArray(o[key])) o[key] = o[key].filter(function(f) { return f !== file; });
    recDataOrderSave(o);
    if (kind === 'rel' && recDataRelSelFile === file) recDataRelSelFile = '';
    if (kind === 'theme' && recDataSelFile === file) recDataSelFile = '';
    recDataRefreshAfterWrite();
    showToast('已删除：' + name);
  });
}

// ---- 顶栏：本地桥接服务连接状态（打开程序即检测；单击切换为署名，再单击切回并重新检测） ----
const REC_SVC_PING = 'http://127.0.0.1:8737/api/ping';
const REC_SVC_NEED = ['ls', 'write', 'rename', 'delete'];
let recSvcBrandOn = false;
function recSvcPaint(state, text) {
  const el = document.getElementById('recSvcStatus');
  if (!el) return;
  el.classList.remove('on', 'off', 'warn', 'busy');
  if (state) el.classList.add(state);
  const t = el.querySelector('.rec-svc-text');
  if (t) t.textContent = text;
  if (!recSvcBrandOn) el.title = text;
}
function recSvcBrand() {
  const el = document.getElementById('recSvcStatus');
  if (!el) return;
  recSvcBrandOn = !recSvcBrandOn;
  el.classList.toggle('brand', recSvcBrandOn);
  if (recSvcBrandOn) {
    el.classList.remove('on', 'off', 'warn', 'busy');
    el.title = '单击返回本地服务状态';
  } else {
    recSvcStatusCheck(false);
  }
}
function recSvcStatusCheck(silent) {
  if (recSvcBrandOn) return;
  recSvcPaint('busy', '检测中…');
  let done = false;
  const finish = function(state, text) {
    if (done) return;
    done = true;
    recSvcPaint(state, text);
    if (!silent && window.__daSvcToast) showToast(text);
  };
  let ac = null;
  try { ac = new AbortController(); } catch (e) {}
  const timer = setTimeout(function() { try { if (ac) ac.abort(); } catch (e) {} finish('off', '未连接本地服务'); }, 2500);
  const opt = ac ? { signal: ac.signal, cache: 'no-store' } : { cache: 'no-store' };
  fetch(REC_SVC_PING, opt).then(function(r) { return r.ok ? r.json() : null; }).then(function(d) {
    clearTimeout(timer);
    if (!d || !d.ok) { finish('off', '未连接本地服务'); return; }
    // 旧版服务 /api/ping 不返回 features 字段，视为版本过旧（缺少写盘接口）
    if (!Array.isArray(d.features)) { finish('warn', '服务版本过旧，请升级并重启'); return; }
    const missing = REC_SVC_NEED.filter(function(f) { return d.features.indexOf(f) < 0; });
    if (missing.length) finish('warn', '服务版本过旧（缺 ' + missing.join('/') + '）');
    else finish('on', '已连接本地服务');
  }).catch(function() { clearTimeout(timer); finish('off', '未连接本地服务'); });
}
function recSvcStatusClick() {
  recSvcBrand();
}
function recSvcStatusKey(e) {
  if (e && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); recSvcBrand(); }
}

// 动态载入人物关系主题文件（数据/人物关系/<file>），载入后直接进入「人物关系」页
function recLoadRelationTheme(file) {
  if (!file) return;
  window.__daPendingRelation = null;
  const s = document.createElement('script');
  s.src = '数据/人物关系/' + encodeURI(file);
  s.async = false;
  s.onload = function() {
    const d = window.__daPendingRelation;
    if (s.parentNode) s.parentNode.removeChild(s);
    if (!d || !Array.isArray(d.people)) { showToast('人物关系数据无效：' + file); return; }
    if (typeof window.relApplyTheme !== 'function') { showToast('人物关系模块未就绪'); return; }
    window.relApplyTheme(d, file);
    recActivateKind('relation');
    showToast('已载入人物关系主题：' + (d.theme || String(file).replace(/\.js$/i, '')));
  };
  s.onerror = function() {
    if (s.parentNode) s.parentNode.removeChild(s);
    showToast('无法读取关系数据文件：' + file);
  };
  document.body.appendChild(s);
}

// 动态载入并应用主题文件（数据/项目信息/<file>）
function recLoadTheme(file) {
  if (!file) return;
  window.__daPendingTheme = null;
  const s = document.createElement('script');
  s.src = '数据/项目信息/' + encodeURI(file);
  s.async = false;
  s.onload = function() {
    const d = window.__daPendingTheme;
    if (s.parentNode) s.parentNode.removeChild(s);
    if (!d || !Array.isArray(d.tracks)) { showToast('主题数据无效：' + file); return; }
    recApplyTheme(d, file);
  };
  s.onerror = function() {
    if (s.parentNode) s.parentNode.removeChild(s);
    showToast('无法读取数据文件：' + file);
  };
  document.body.appendChild(s);
}

// 将主题数据应用到「项目编辑」（子项 = 事件轨道）
function applyRecThemeStore() {
  const st = recDataSelFile ? recThemeStore[recDataSelFile] : null;
  if (!st) return;
  if (st.attachments && typeof st.attachments === 'object') {
    recProjects.forEach(function(name) { if (st.attachments[name]) recProjectAttachments[name] = st.attachments[name]; });
  }
  if (st.colors && typeof st.colors === 'object') {
    recProjects.forEach(function(name) { if (st.colors[name] && st.colors[name].color) recThemeTrackMeta[name] = { color: st.colors[name].color }; });
  }
}
function recApplyTheme(d, file) {
  // 中部 DOM 即将换成新主题内容：先声明为「陈旧」，避免切换过程中把旧 DOM 的空白回写到新数据
  recDomStale = true;
  recDomProject = '';
  recDomToken++;
  recThemeName = String(file || '').replace(/\.js$/i, '') || (d && d.theme) || '';
  recThemeTrackMeta = {};
  recProjects = [];
  recProjectTexts = {};
  recProjectHtmls = {};
  recProjectAttachments = {};
  (d.tracks || []).forEach(function(t) {
    const name = String(t.name || '').trim();
    if (!name || recProjects.indexOf(name) >= 0) return;
    recProjects.push(name);
    recThemeTrackMeta[name] = { color: t.color || '' };
    if (t.attachments && typeof t.attachments === 'object') recProjectAttachments[name] = t.attachments;
    const events = Array.isArray(t.events) ? t.events : [];
    // 第68轮：主题文件里带了用户排版后的 HTML（字体/字号/对齐/缩进/层级），优先原样还原，
    // 否则只按原文重渲染，重置格式的结果会在刷新后丢失
    const savedHtml = (typeof t.html === 'string' && t.html.trim()) ? t.html : '';
    if (typeof t.text === 'string' && t.text.trim()) {
      // 新版主题带原文：整段还原，无日期内容不丢
      recProjectTexts[name] = t.text;
      recProjectHtmls[name] = savedHtml;
      return;
    }
    recProjectTexts[name] = events.map(function(ev) {
      let line = String(ev.name || '').trim();
      if (ev.description) line += ' 【' + String(ev.description).trim() + '】';
      return line;
    }).filter(Boolean).join('\n');
    recProjectHtmls[name] = savedHtml;   // 无 HTML 时留空 → 显示纯文本，点「自动识别」再生成链接
  });
  recCurrentProject = recProjects[0] || '';
  recSituSelProjs = new Set(recProjects.filter(function(p) { return recProjectHasContent(p); }));
  recDataSelFile = file || recDataSelFile;
  applyRecThemeStore();
  saveRecordData();
  recRenderDataPage();
  recActivateKind('project');
  showToast('已读取主题「' + recThemeName + '」（' + recProjects.length + ' 个子项）');
}

// 重新加载数据清单（数据/项目信息/index.js）
function recReloadThemeIndex() {
  const s = document.createElement('script');
  s.src = '数据/项目信息/index.js?t=' + Date.now();
  s.async = false;
  s.onload = function() {
    if (s.parentNode) s.parentNode.removeChild(s);
    recRenderDataPage();
    showToast('数据清单已刷新');
  };
  s.onerror = function() {
    if (s.parentNode) s.parentNode.removeChild(s);
    showToast('无法读取数据清单（数据/项目信息/index.js）');
  };
  document.body.appendChild(s);
}


// ---- 多维视图：三级区（选择项目 + 检索） ----
let recSituViewMode = 'h'; // 固定横向分布（纵向排列已迁移到「项目编辑」的多项目时间轴）
// 时间轴列：'v'=纵向排列（事件清单） 'h'=横向分布（多维态势图）
let recTlView = 'v';
let recTlFullMode = 0;             // 0=右侧区域 / 1=中部满屏 / 2=整屏全屏
let recSituShowLabel = true;       // 横向分布：是否显示左侧「时间轴 + 轨道名称」列
let recTlScreenHome = null;        // 整屏全屏时记录面板原位置
// 当前一级页面（底部设置栏据此显示检索 / 排列设置）
let recActiveKind = 'datamanage';
let recTimelineSort = 'asc'; // 'asc'=由远至近 'desc'=由近至远
function recRenderSituTier3() {
  const t3 = document.getElementById('recTier3');
  if (!t3) return;
  t3.innerHTML = '<div class="op-tier3-inner">' +
    '<button class="op-btn3' + (recSituProjVisible ? ' situ-on' : '') + '" onclick="toggleSituProjList()" title="点击打开或隐藏项目列表">选择项目</button>' +
    '<input type="text" id="recSearchInput" class="rec-search-box" placeholder="检索" oninput="recDoSearch()" value="' + escapeHtml(recSearchQuery) + '">' +
    '<span class="rec-search-count" id="recSearchCount">' + recSearchCountText() + '</span>' +
    '<button class="op-btn3" onclick="recSearchPrev()" title="上一个命中">上一条</button>' +
    '<button class="op-btn3" onclick="recSearchNext()" title="下一个命中">下一条</button>' +
    '<label class="op-btn3-label"><input type="checkbox" id="recSearchOnlyChk" onchange="recToggleSearchOnly()"' + (recSearchOnly ? ' checked' : '') + '>仅匹配</label>' +
    '</div>';
  t3.classList.remove('hidden');
}

// ---- 数据管理：导出 / 导入 / 清空（备份、恢复、清空工作记录数据）----
let recExportSelProjs = new Set();   // 导出弹窗中勾选的项目名

function recRenderDataManageTier3() {
  const t3 = document.getElementById('recTier3');
  if (!t3) return;
  t3.innerHTML = '';
  t3.classList.add('hidden');
}

function openRecExportModal() {
  if (!recProjects.length) { showToast('暂无工作记录数据可导出'); return; }
  recExportSelProjs = new Set(recProjects);
  renderRecExportList();
  document.getElementById('recExportModal').style.display = 'flex';
}
function closeRecExportModal() {
  document.getElementById('recExportModal').style.display = 'none';
}
function renderRecExportList() {
  const cont = document.getElementById('recExportProjList');
  if (!cont) return;
  let html = '';
  recProjects.forEach(function(name, i) {
    const on = recExportSelProjs.has(name) ? ' checked' : '';
    html += '<label class="export-opt" style="cursor:pointer;">' +
      '<input type="checkbox" data-name="' + escapeHtml(name) + '"' + on + ' onchange="recExportToggle(this)">' +
      '<span class="export-opt-name">' + escapeHtml(name) + '</span>' +
      '</label>';
  });
  cont.innerHTML = html;
}
function recExportToggle(chk) {
  const name = chk.getAttribute('data-name');
  if (chk.checked) recExportSelProjs.add(name);
  else recExportSelProjs.delete(name);
}
function doRecExport() {
  const sel = recProjects.filter(function(p){ return recExportSelProjs.has(p); });
  if (!sel.length) { showToast('请至少勾选一个项目'); return; }
  const texts = {}, htmls = {};
  sel.forEach(function(name){
    if (recProjectTexts[name] !== undefined) texts[name] = recProjectTexts[name];
    if (recProjectHtmls[name] !== undefined) htmls[name] = recProjectHtmls[name];
  });
  const data = {
    type: 'record',
    cats: recCats,
    events: recEvents,
    situSel: recSituSel,
    projects: sel,
    projectTexts: texts,
    projectHtmls: htmls,
    themeTrackMeta: recThemeTrackMeta,
    attachments: recProjectAttachments
  };
  closeRecExportModal();
  writeRecJs(data);
}
function writeRecJs(data) {
  const filename = timestampNow() + ' 工作记录.js';
  const content = 'var __REC_DATA = ' + JSON.stringify(data, null, 2) + ';';
  if (window.showDirectoryPicker) {
    window.showDirectoryPicker().then(function(dirHandle) {
      return dirHandle.getFileHandle(filename, { create: true }).then(function(fh){
        return fh.createWritable().then(function(w){ return w.write(content).then(function(){ return w.close(); }); });
      });
    }).then(function(){
      showToast('已导出到「' + filename + '」');
    }).catch(function(){
      recDownloadJs(filename, content);
    });
  } else {
    recDownloadJs(filename, content);
  }
}
function recDownloadJs(filename, content) {
  const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('已导出工作记录：' + filename);
}
function recImportData() {
  const input = document.getElementById('recFileInput');
  if (input) { input.value = ''; input.click(); }
}
function parseRecJs(text) {
  const m = text.match(/var\s+__REC_DATA\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!m) return null;
  try {
    const data = new Function('return (' + m[1] + ');')();
    if (data && typeof data === 'object' && (Array.isArray(data.projects) || Array.isArray(data.cats))) return data;
  } catch(e) {}
  return null;
}
function handleRecFileInput(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  readFileAsText(file).then(function(text){
    const data = parseRecJs(text);
    if (!data) { showToast('不是有效的工作记录数据文件（请选择「数据管理-导出」生成的.js 文件）'); return; }
    if (!confirm('导入将先清空当前工作记录数据，确认导入？')) return;
    recCats = Array.isArray(data.cats) && data.cats.length ? data.cats : [{ name: '重点', color: REC_COLORS[0] }, { name: '常规', color: REC_COLORS[5] }, { name: '完成', color: REC_COLORS[3] }];
    recEvents = Array.isArray(data.events) ? data.events : [];
    recSituSel = Array.isArray(data.situSel) ? data.situSel : [];
    recProjects = Array.isArray(data.projects) ? data.projects.map(function(v){ return String(v == null ? '' : v).trim(); }).filter(Boolean) : [];
    if (!recProjects.length) recProjects = ['项目一', '项目二', '项目三', '项目四', '项目五'];
    recProjectTexts = (data.projectTexts && typeof data.projectTexts === 'object') ? data.projectTexts : {};
    recProjectHtmls = (data.projectHtmls && typeof data.projectHtmls === 'object') ? data.projectHtmls : {};
    recThemeTrackMeta = (data.themeTrackMeta && typeof data.themeTrackMeta === 'object') ? data.themeTrackMeta : {};
    recProjectAttachments = (data.attachments && typeof data.attachments === 'object') ? data.attachments : {};
    recCurrentProject = recProjects[0] || '';
    recSituSelProjs = new Set();
    recSyncLegacy();
    saveRecordData();
    renderRecordModule();
    recRenderDataManageTier3();
    showToast('已导入工作记录数据');
  }).catch(function(err){ showToast('读取文件失败：' + err); });
}
function recClearData() {
  if (!confirm('确认清空全部工作记录数据？')) return;
  recCats = [{ name: '重点', color: REC_COLORS[0] }, { name: '常规', color: REC_COLORS[5] }, { name: '完成', color: REC_COLORS[3] }];
  recEvents = [];
  recSituSel = [];
  recProjects = ['项目一', '项目二', '项目三', '项目四', '项目五'];
  recCurrentProject = recProjects[0];
  recProjectTexts = {};
  recProjectHtmls = {};
  recThemeTrackMeta = {};
  recProjectAttachments = {};
  recSituSelProjs = new Set();
  recSyncLegacy();
  saveRecordData();
  renderRecordModule();
  showToast('工作记录数据已清空');
}

// ---- 项目记录：项目列表（预设 项目一~五，双击编辑/删除，拖动排序，+添加）----
let recProjectDragFrom = -1;
let recProjectEditIndex = -1;   // -1 表示新增

function recRenderProjectTier3() {
  const t3 = document.getElementById('recTier3');
  if (!t3) return;
  t3.innerHTML = '';
  t3.classList.add('hidden');
}

// 项目编辑：第一栏子项列表（彩点前加勾选框，多选时中部多窗口、右侧合并时间轴）
function recRenderSubList() {
  const box = document.getElementById('recSubList');
  if (!box) return;
  let html = '';
  const activeName = recProjFocus || recCurrentProject;
  recProjects.forEach(function(name, i) {
    const active = (name === activeName) ? ' active' : '';
    const checked = recProjChecked.has(name) ? ' checked' : '';
    const color = (recThemeTrackMeta[name] && recThemeTrackMeta[name].color) ? recThemeTrackMeta[name].color : '';
    const dot = color ? '<span class="rec3-item-dot" style="background:' + escapeHtml(color) + '"></span>' : '<span class="rec3-item-dot rec3-dot-empty"></span>';
    html += '<div class="rec3-item' + active + '" draggable="true" title="单击打开，双击编辑/删除，拖动调整顺序；勾选可多选（多选时中部上下排列多个窗口）"' +
      ' onclick="recOpenProject(' + i + ')" ondblclick="openRecProjectModal(' + i + ')"' +
      ' ondragstart="recProjectDragStart(event,' + i + ')" ondragover="recProjectDragOver(event)"' +
      ' ondragend="recProjectDragEnd()" ondrop="recProjectDrop(event,' + i + ')">' +
      '<input type="checkbox" class="rec3-item-chk"' + checked + ' title="单击勾选/取消；双击全选或全不选（中部按勾选上下排列窗口）"' +
      ' onclick="recProjChkClick(event,' + i + ',this)" ondblclick="event.stopPropagation();event.preventDefault()">' +
      dot + '<span class="rec3-item-name">' + escapeHtml(name) + '</span></div>';
  });
  box.innerHTML = html || '<div class="rec3-empty">暂无子项<br>请到「数据管理」双击数据文件</div>';
  if (window.__ftRefreshTheme) window.__ftRefreshTheme();
  recRenderProjDots();
}

// 勾选框单击=切换该项；420ms 内双击=全选/全不选（列表会重建，故用时间戳判定）
var recChkLast = { i: -1, t: 0, wasAll: false };
function recProjChkClick(ev, i, chk) {
  if (ev) ev.stopPropagation();
  var now = Date.now();
  if (recChkLast.i === i && now - recChkLast.t < 420) {
    var target = !recChkLast.wasAll;
    recChkLast = { i: -1, t: 0, wasAll: false };
    recToggleAllProjCheck(target);
    return;
  }
  recChkLast = { i: i, t: now, wasAll: reqall() };
  recToggleProjCheck(i, chk);
}
function reqall() {
  if (!recProjects.length) return false;
  return recProjects.every(function(p) { return recProjChecked.has(p); });
}

// 勾选/取消勾选项目（勾选变为 1 个时同步为当前项目）
function recToggleProjCheck(i, chk) {
  const name = recProjects[i];
  if (!name) return;
  if (chk && chk.checked) recProjChecked.add(name); else recProjChecked.delete(name);
  // 勾选只作用于右侧时间轴，不改中部当前项目
  recProjFocus = '';
  saveRecordData();
  recRenderSubList();
  recRenderTlColumn();
}

// 双击任一勾选框：全选 / 全不选
function recToggleAllProjCheck(selectAll) {
  if (!recProjects.length) return;
  recProjChecked.clear();
  if (selectAll !== false) recProjects.forEach(function(p) { recProjChecked.add(p); });
  // 全选 / 全不选同样只作用于右侧时间轴
  recProjFocus = '';
  saveRecordData();
  recRenderSubList();
  recRenderTlColumn();
}

// 项目列表左右三角按钮滚动（保留兼容）
function recProjectScroll(dir) {
  const list = document.getElementById('recSubList');
  if (!list) return;
  list.scrollBy({ left: dir * 200, behavior: 'smooth' });
}

// 项目列表（左栏）显隐切换：收起后中部左上角出现「>>」可再次展开
function recToggleListCol() {
  const wrap = document.querySelector('#recProjectPanel .rec3-wrap');
  if (!wrap) return;
  const hidden = wrap.classList.toggle('rec-list-collapsed');
  const btn = document.getElementById('recListToggle');
  if (btn) btn.textContent = hidden ? '>>' : '<<';
  if (btn) btn.title = hidden ? '展开项目列表' : '收起项目列表';
  recRenderProjDots();
}

// 项目点击后保留选中效果（与下方内容对应），点下一个恢复
function recMarkActiveProject(name) {
  const items = document.querySelectorAll('#recSubList .rec3-item');
  items.forEach(function(el) {
    const nm = el.querySelector('.rec3-item-name');
    el.classList.toggle('active', !!nm && nm.textContent === name);
  });
}

function recProjectDragStart(e, i) {
  recProjectDragFrom = i;
  if (e.target) e.target.classList.add('dragging');
}
function recProjectDragOver(e) { if (e.preventDefault) e.preventDefault(); }
function recProjectDragEnd() {
  document.querySelectorAll('#recSubList .rec3-item').forEach(function(el){ el.classList.remove('dragging'); });
  recProjectDragFrom = -1;
}
function recProjectDrop(e, to) {
  if (e.preventDefault) e.preventDefault();
  if (recProjectDragFrom >= 0 && recProjectDragFrom !== to && recProjectDragFrom < recProjects.length) {
    const item = recProjects.splice(recProjectDragFrom, 1)[0];
    recProjects.splice(to, 0, item);
    saveRecordData();
    recRenderSubList();
  }
  recProjectDragFrom = -1;
}

function addRecProject() {
  recProjectEditIndex = -1;
  const title = document.getElementById('recProjectModalTitle');
  const del = document.getElementById('recProjectDeleteBtn');
  const input = document.getElementById('recProjectNameInput');
  if (input) input.value = '';
  recProjectColorSet(REC_PROJ_PRESETS[recProjects.length % REC_PROJ_PRESETS.length]);
  if (title) title.textContent = '新增项目';
  if (del) del.style.display = 'none';
  const m = document.getElementById('recProjectModal');
  if (m) m.style.display = 'flex';
  if (input) setTimeout(function(){ input.focus(); }, 0);
}

function openRecProjectModal(i) {
  if (i < 0 || i >= recProjects.length) return;
  recProjectEditIndex = i;
  const title = document.getElementById('recProjectModalTitle');
  const del = document.getElementById('recProjectDeleteBtn');
  const input = document.getElementById('recProjectNameInput');
  const name = recProjects[i];
  if (input) input.value = name;
  recProjectColorSet((recThemeTrackMeta[name] && recThemeTrackMeta[name].color) || REC_PROJ_PRESETS[i % REC_PROJ_PRESETS.length]);
  if (title) title.textContent = '编辑项目';
  if (del) del.style.display = '';
  const m = document.getElementById('recProjectModal');
  if (m) m.style.display = 'flex';
  if (input) setTimeout(function(){ input.select(); }, 0);
}

function closeRecProjectModal() {
  const m = document.getElementById('recProjectModal');
  if (m) m.style.display = 'none';
}

function confirmRecProject() {
  const input = document.getElementById('recProjectNameInput');
  const colorEl = document.getElementById('recProjectColorInput');
  const name = String(input ? input.value : '').trim();
  const color = colorEl ? colorEl.value : '';
  if (!name) { showToast('项目名称不能为空'); return; }
  if (recProjectEditIndex >= 0) {
    const oldName = recProjects[recProjectEditIndex];
    if (oldName !== name && recProjects.indexOf(name) >= 0) { showToast('已存在同名项目'); return; }
    recProjects[recProjectEditIndex] = name;
    if (oldName !== name) {
      if (recProjectTexts[oldName] !== undefined) { recProjectTexts[name] = recProjectTexts[oldName]; delete recProjectTexts[oldName]; }
      if (recProjectHtmls[oldName] !== undefined) { recProjectHtmls[name] = recProjectHtmls[oldName]; delete recProjectHtmls[oldName]; }
      if (recThemeTrackMeta[oldName] !== undefined) { recThemeTrackMeta[name] = recThemeTrackMeta[oldName]; delete recThemeTrackMeta[oldName]; }
      if (recProjectAttachments[oldName] !== undefined) { recProjectAttachments[name] = recProjectAttachments[oldName]; delete recProjectAttachments[oldName]; }
      if (recProjChecked.has(oldName)) { recProjChecked.delete(oldName); recProjChecked.add(name); }
      if (recCurrentProject === oldName) recCurrentProject = name;
      if (recProjFocus === oldName) recProjFocus = name;
    }
  } else {
    if (recProjects.indexOf(name) >= 0) { showToast('已存在同名项目'); return; }
    recProjects.push(name);
  }
  recThemeTrackMeta[name] = recThemeTrackMeta[name] || {};
  if (color) recThemeTrackMeta[name].color = color;
  saveRecordData();
  closeRecProjectModal();
  recRenderSubList();
  showToast(recProjectEditIndex >= 0 ? '项目已更新' : '已新增项目「' + name + '」');
}

function deleteRecProject() {
  if (recProjectEditIndex < 0 || recProjectEditIndex >= recProjects.length) return;
  const name = recProjects[recProjectEditIndex];
  if (!confirm('删除项目「' + name + '」？')) return;
  recProjects.splice(recProjectEditIndex, 1);
  delete recProjectTexts[name];
  delete recProjectHtmls[name];
  delete recThemeTrackMeta[name];
  delete recProjectAttachments[name];
  recProjChecked.delete(name);
  if (recProjFocus === name) recProjFocus = '';
  if (recCurrentProject === name) recCurrentProject = recProjects[0] || '';
  saveRecordData();
  closeRecProjectModal();
  recRenderSubList();
  showToast('项目已删除');
}

// ---- 项目记录：打开项目（左文字区 + 右时间轴） ----
// 多选模式下：单击项目 = 中部「全屏」该项目；再次单击同一项目 = 取消全屏，恢复上下排列
function recOpenProject(i) {
  if (i < 0 || i >= recProjects.length) return;
  if (typeof recAutoSave === 'function') recAutoSave(true);
  const name = recProjects[i];
  recCurrentProject = name;
  recProjFocus = '';
  saveRecordData();
  const pp = document.getElementById('recProjectPanel');
  const rp = document.getElementById('recRelationPanel');
  if (rp) rp.classList.add('hidden');
  if (pp) pp.classList.remove('hidden');
  recRenderSubList();
  recRenderProjectPanels();
}

// 当前应显示的项目集合：勾选优先（1 个=单窗口，多个=多窗口）；未勾选时显示当前项目单窗口
function recProjectVisibleList() {
  const chk = recProjects.filter(function(p) { return recProjChecked.has(p); });
  if (chk.length) return chk;
  if (recCurrentProject) return [recCurrentProject];
  return recProjects.length ? [recProjects[0]] : [];
}
// 单窗口模式下的项目名
// 第65轮：中部编辑窗固定显示「当前点击的项目」，与勾选无关
function recMiddleProjectName() {
  return recCurrentProject || recProjects[0] || '';
}
function recSingleProjectName() {
  return recMiddleProjectName();
}
// 项目颜色（优先主题元数据色，否则用态势色板）
function recProjColor(name) {
  const meta = recThemeTrackMeta[name];
  if (meta && meta.color) return meta.color;
  const i = recProjects.indexOf(name);
  return SITU_COLORS[(i < 0 ? 0 : i) % SITU_COLORS.length];
}
// 编辑项目：7 个预设色圆 + 自选颜色
const REC_PROJ_PRESETS = ['#b3243b', '#0f7d8c', '#7a35ab', '#1e7a3e', '#a85a08', '#3361d6', '#6f7226'];
function recProjectColorSet(color) {
  const cur = String(color || REC_PROJ_PRESETS[0]);
  const input = document.getElementById('recProjectColorInput');
  if (input) input.value = cur;
  const box = document.getElementById('recProjectColorPalette');
  if (!box) return;
  let html = '';
  REC_PROJ_PRESETS.forEach(function(c) {
    html += '<button type="button" class="rec-proj-swatch' + (c.toLowerCase() === cur.toLowerCase() ? ' active' : '') + '"' +
      ' data-color="' + c + '" style="background:' + c + '" title="' + c + '"' +
      ' onclick="recProjectColorPick(this,\'' + c + '\')"></button>';
  });
  box.innerHTML = html;
}
function recProjectColorPick(btn, color) {
  const input = document.getElementById('recProjectColorInput');
  if (input) input.value = color;
  document.querySelectorAll('#recProjectColorPalette .rec-proj-swatch').forEach(function(n) { n.classList.remove('active'); });
  if (btn) btn.classList.add('active');
}
function recProjectColorCustom(input) {
  const v = String((input && input.value) || '').toLowerCase();
  document.querySelectorAll('#recProjectColorPalette .rec-proj-swatch').forEach(function(n) {
    n.classList.toggle('active', String(n.getAttribute('data-color') || '').toLowerCase() === v);
  });
}
// 中部顶栏：项目色圆（项目列表收起后仍可切换项目）
function recRenderProjDots() {
  const bar = document.getElementById('recProjDotBar');
  if (!bar) return;
  const wrap = document.querySelector('#recProjectPanel .rec3-wrap');
  if (!wrap || !wrap.classList.contains('rec-list-collapsed')) {
    bar.innerHTML = '';
    bar.style.display = 'none';
    return;
  }
  const activeName = recProjFocus || recCurrentProject;
  let html = '';
  recProjects.forEach(function(name, i) {
    html += '<button type="button" class="rec-proj-dot' + (name === activeName ? ' active' : '') + '"' +
      ' data-idx="' + i + '" style="background:' + escapeHtml(recProjColor(name)) + '"' +
      ' title="' + escapeHtml(name) + '" onclick="recProjDotClick(' + i + ')"></button>';
  });
  bar.innerHTML = html;
  bar.style.display = '';
}
function recProjDotClick(i) {
  recOpenProject(i);
}

// CSS 属性选择器转义（用于 data-proj 匹配）
function recCssAttr(v) {
  return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// 渲染中部内容区（单窗口 / 多窗口）与右侧时间轴
function recRenderProjectPanels() {
  // 第65轮：中部始终只渲染「当前项目」单窗铺满；勾选只影响右侧时间轴
  recProjFocus = '';
  const single = document.getElementById('recProjectInput');
  const multi = document.getElementById('recProjectMulti');
  const title = document.getElementById('recProjectTitle');
  const name = recMiddleProjectName();
  if (multi) { multi.classList.add('hidden'); multi.innerHTML = ''; }
  const sc = document.getElementById('recProjectWinSingle');
  if (sc) sc.classList.remove('hidden');
  if (single) single.classList.remove('hidden');
  if (title) title.textContent = name || '项目';
  const nm = document.getElementById('recProjSingleName');
  const dt = document.getElementById('recProjSingleDot');
  if (sc && name) sc.setAttribute('data-proj', name);
  if (nm) nm.textContent = name || '未选择项目';
  const tint = name ? recTintHex(recProjColor(name), 0.9) : '#ffffff';
  if (dt) dt.style.background = name ? recProjColor(name) : '#d5dbe3';
  if (single) single.style.background = tint;
  recProjPaintSingle(name);
  recLoadSingleProject(name);
  recProjectBindPaste();
  recAttachBindContext();
  recRenderTlColumn();
  recBindColDividers();
  recRenderProjDots();
}

// 第64轮：项目卡片结构（标题栏 / 工具栏 / 正文 / 底栏），单选与多选共用
function recProjCardHtml(name, inner) {
  const color = recProjColor(name);
  const headBg = recDarkenHex(color, 0.45);
  const tint = recTintHex(color, 0.9);
  const line = recTintHex(color, 0.72);
  return '<div class="rec-proj-win" data-proj="' + escapeHtml(name) + '">' +
    '<div class="rec-proj-win-head" style="background:' + headBg + '">' +
      '<span class="rec-proj-win-dot" style="background:' + escapeHtml(color) + '"></span>' + escapeHtml(name) + '</div>' +
    '<div class="rec-proj-toolbar"></div>' +
    '<div class="rec-proj-win-body" contenteditable="true" data-ph="在此粘贴内容…" oninput="recProjWinInput(this)" onblur="recProjFlushPersist()" ' +
      'style="background:' + tint + ';--dc:' + escapeHtml(color) + ';--line:' + line + '">' + inner + '</div>' +
    '</div>';
}

// 第64轮：单窗口按项目色描边（标题栏深色 + 浅底 + 装饰线色）
function recProjPaintSingle(name) {
  const color = name ? recProjColor(name) : '#d5dbe3';
  const head = document.getElementById('recProjSingleHead');
  const body = document.getElementById('recProjectInput');
  const card = document.getElementById('recProjectWinSingle');
  const bar = document.querySelector('#recProjectWinSingle .rec-proj-toolbar');
  if (head) head.style.background = name ? recDarkenHex(color, 0.45) : '#0D47A1';
  if (body) {
    body.style.background = name ? recTintHex(color, 0.9) : '#ffffff';
    body.style.setProperty('--dc', color);
    body.style.setProperty('--line', name ? recTintHex(color, 0.72) : '#e3e8ef');
  }
  if (card) card.setAttribute('data-proj', name || '');
  if (bar) bar.setAttribute('data-proj', name || '');
  if (window.daProjMount && card) daProjMount(card.parentNode || card);
}

// 单窗口：把项目内容载入 #recProjectInput（首次自动识别格式）
function recLoadSingleProject(name) {
  const input = document.getElementById('recProjectInput');
  if (!input) return;
  const key = name || recCurrentProject;
  if (recProjectHtmls[key]) {
    input.innerHTML = recProjectHtmls[key];
  } else {
    const res = recFormatProjectText(recProjectTexts[key] || '', key);
    input.innerHTML = res.html;
    recProjectHtmls[key] = res.html;
  }
  // DOM 现在与该项目一致，允许回写
  recDomProject = key;
  recDomStale = false;
}

// 多窗口：中部从上到下等高的多个可编辑窗口
function recRenderProjWindows(list) {
  const box = document.getElementById('recProjectMulti');
  if (!box) return;
  const show = recProjFocus ? list.filter(function(n) { return n === recProjFocus; }) : list;
  box.classList.toggle('rec-multi-focus', !!recProjFocus);
  let html = '';
  show.forEach(function(name) {
    const color = recProjColor(name);
    let inner = recProjectHtmls[name];
    if (inner === undefined || inner === '') {
      inner = recFormatProjectText(recProjectTexts[name] || '', name).html;
      recProjectHtmls[name] = inner;
    }
    html += recProjCardHtml(name, inner);
  });
  box.innerHTML = html;
  recDomProject = '';
  recDomStale = false;
  if (window.daProjMount) daProjMount(box);
}

// 多窗口：任一窗口内容变化 → 保存并刷新右侧合并时间轴（不重绘窗口本身，保留光标）
function recProjWinInput(el) {
  const win = el.closest ? el.closest('.rec-proj-win') : null;
  if (!win) return;
  const name = win.getAttribute('data-proj') || '';
  if (!name) return;
  recProjectTexts[name] = el.innerText || '';
  recProjectHtmls[name] = el.innerHTML;
  recProjSchedulePersist();
  recProjScheduleTimeline();
}

// ---- 输入节流：内存即时更新，localStorage 落盘与时间轴重绘合并到空闲时（避免逐字卡顿） ----
let recProjSaveTimer = 0;
let recProjTlTimer = 0;
function recProjSchedulePersist() {
  if (recProjSaveTimer) clearTimeout(recProjSaveTimer);
  recProjSaveTimer = setTimeout(function() {
    recProjSaveTimer = 0;
    saveRecordData();
  }, 450);
}
function recProjScheduleTimeline() {
  if (recProjTlTimer) clearTimeout(recProjTlTimer);
  recProjTlTimer = setTimeout(function() {
    recProjTlTimer = 0;
    if (recTlView === 'v') recRenderProjectTimeline();
    else recRenderSituChart();
  }, 300);
}
// 立即落盘（离开输入区 / 切换项目 / 保存前调用），并取消待执行的节流任务
function recProjFlushPersist() {
  if (recProjTlTimer) { clearTimeout(recProjTlTimer); recProjTlTimer = 0; }
  if (recProjSaveTimer) { clearTimeout(recProjSaveTimer); recProjSaveTimer = 0; }
  saveRecordData();
}

// 点击右侧合并时间轴条目 → 中部对应窗口滚动到对应内容并高亮
function recTimelineItemClick(el, ei) {
  const prev = document.querySelector('#recProjectTimeline .rec-tl-item.active');
  if (prev && prev !== el) prev.classList.remove('active');
  el.classList.add('active');
  recFlashLink(ei);
}

// 合并时间轴：点击条目 → 中部对应窗口定位 + 高亮
// 多选模式下：若点击的属于其它项目，则把中部「全屏」切换到该项目（左侧列表同步选中）
function recMtlJump(el) {
  const proj = el.getAttribute('data-proj') || '';
  const ti = parseInt(el.getAttribute('data-ti'), 10);
  if (proj && recCurrentProject !== proj) {
    recProjFocus = '';
    recCurrentProject = proj;
    saveRecordData();
    recRenderSubList();
    recRenderProjectPanels();
  }
  recMtlHighlight(proj, ti);
}

// 高亮时间轴条目并滚动中部窗口到对应日期链接
function recMtlHighlight(proj, ti) {
  const box = document.getElementById('recProjectTimeline');
  if (box) box.querySelectorAll('.rec-mtl-item.rec-mtl-active').forEach(function(n) { n.classList.remove('rec-mtl-active'); });
  const item = box ? box.querySelector('.rec-mtl-item[data-proj="' + recCssAttr(proj) + '"][data-ti="' + ti + '"]') : null;
  if (item) { item.classList.add('rec-mtl-active'); item.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  let win = document.querySelector('#recProjectMulti .rec-proj-win[data-proj="' + recCssAttr(proj) + '"]');
  if (!win) {
    const inp = document.getElementById('recProjectInput');
    if (inp && !inp.classList.contains('hidden')) win = inp;
  }
  if (!win) return;
  if (isNaN(ti)) { win.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  const link = win.querySelector('a.rec-tl-link[data-ei="' + ti + '"]');
  if (!link) { win.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  link.scrollIntoView({ block: 'center', behavior: 'smooth' });
  link.classList.add('flash');
  setTimeout(function() { link.classList.remove('flash'); }, 900);
}

// 右侧时间轴条目上的附件徽标 → 打开对应事件附件（单/多项目通用）
function recMtlAttachOpen(el) {
  const item = el.closest ? el.closest('.rec-mtl-item') : null;
  if (!item) return;
  const proj = item.getAttribute('data-proj') || '';
  const ti = parseInt(item.getAttribute('data-ti'), 10);
  const input = document.getElementById('recProjectInput');
  const live = input && !input.classList.contains('hidden') && proj === recSingleProjectName();
  const events = recNormalizeEvents(recExtractStructuredEvents(live ? (input.innerText || '') : (recProjectTexts[proj] || '')));
  const built = recBuildTimelineOrder(events);
  const ev = events[built.order[ti]];
  if (!ev) return;
  recAttachOpenView({ proj: proj, key: recEventLocator(ev), ev: ev });
}

// ---- 缩放：左侧编辑框 / 右侧时间轴 ----
function recProjectZoom(delta) {
  recProjZoom = Math.round(Math.min(2, Math.max(0.6, recProjZoom + delta * 0.1)) * 100) / 100;
  const input = document.getElementById('recProjectInput');
  if (input) input.style.zoom = recProjZoom;
  const val = document.getElementById('recProjZoomVal');
  if (val) val.textContent = Math.round(recProjZoom * 100) + '%';
}
function recTimelineZoom(delta) {
  recTlZoom = Math.round(Math.min(2, Math.max(0.6, recTlZoom + delta * 0.1)) * 100) / 100;
  const c = document.getElementById('recProjectTimeline');
  if (c) c.style.zoom = recTlZoom;
  const val = document.getElementById('recTlZoomVal');
  if (val) val.textContent = Math.round(recTlZoom * 100) + '%';
}

// ---- 时间轴列：纵向排列 / 横向分布 / 全屏 ----
function recTlSearchProjects() {
  const list = recProjectVisibleList();
  return list.length ? list : recProjects;
}
function recSetTlView(mode) {
  recTlView = mode === 'h' ? 'h' : 'v';
  saveRecordData();
  recRenderTlColumn();
  recRenderSetbarMode();
}
function recToggleTlFull() {
  const p = document.getElementById('recProjectPanel');
  if (!p) return;
  recTlFullMode = (recTlFullMode + 1) % 3;
  applyRecTlFull();
  recRenderTlColumn();
}
function applyRecTlFull() {
  const p = document.getElementById('recProjectPanel');
  const btn = document.getElementById('recTlFullBtn');
  if (!p) return;
  const screen = recTlFullMode >= 2;
  p.classList.toggle('rec-tl-full', recTlFullMode >= 1);
  p.classList.toggle('rec-tl-screen', screen);
  if (screen) {
    if (!recTlScreenHome) {
      recTlScreenHome = { parent: p.parentNode, next: p.nextSibling };
      document.body.appendChild(p);
    }
    document.body.classList.add('rec-tl-screen-lock');
  } else if (recTlScreenHome) {
    const home = recTlScreenHome;
    recTlScreenHome = null;
    document.body.classList.remove('rec-tl-screen-lock');
    if (home.parent) home.parent.insertBefore(p, home.next && home.next.parentNode === home.parent ? home.next : null);
  }
  if (btn) {
    btn.classList.toggle('active', recTlFullMode >= 1);
    btn.title = recTlFullMode === 0 ? '全屏显示时间轴' : (recTlFullMode === 1 ? '再点：整屏全屏' : '再点：恢复右侧显示');
  }
}
function recToggleSituLabel() {
  recSituShowLabel = !recSituShowLabel;
  const b = document.getElementById('situLabelBtn');
  if (b) b.classList.toggle('active', recSituShowLabel);
  saveRecordData();
  recRenderSituChart();
}
function recBindPanAll() {
  const c = document.getElementById("situChartContainer");
  if (c) recBindPanScroll(c);
  const multi = document.getElementById("recProjectMulti");
  if (multi) recBindPanScroll(multi, { skip: ".rec-proj-win, input, textarea, button, a, .rec-tl-link" });
}
function recRenderTlColumn() {
  const v = document.getElementById('recProjectTimeline');
  const h = document.getElementById('situChartContainer');
  const isH = recTlView === 'h';
  if (v) v.classList.toggle('hidden', isH);
  if (h) h.classList.toggle('hidden', !isH);
  document.querySelectorAll('.rec-tl-view-btn').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-view') === recTlView);
  });
  if (isH) {
    recRenderSituChart();
    if (h) h.style.zoom = recSituZoomLevel;
    const val = document.getElementById('situZoomVal');
    if (val) val.textContent = Math.round(recSituZoomLevel * 100) + '%';
  } else {
    recRenderProjectTimeline();
    if (v) v.style.zoom = recTlZoom;
  }
  recBindPanAll();
  recUpdateSearchCount();
}
// 底部设置栏：只在底部显示排列方式；检索框已移到顶栏
function recRenderSetbarMode() {
  const box = document.getElementById('setbarModeGroup');
  const isProject = recActiveKind === 'project';
  const ps = document.getElementById('recProjSearchWrap');
  if (ps) ps.classList.toggle('hidden', !isProject);
  if (!box) return;
  if (!isProject) {
    box.classList.remove('show');
    box.innerHTML = '';
    if (typeof window.__ftRefreshTheme === 'function') window.__ftRefreshTheme();
    return;
  }
  let html = '';
  if (recTlView === 'v') {
    html = '<span class="setbar-mode-label">纵向排列</span>' +
      '<button class="setbar-mini' + (recTimelineSort === 'asc' ? ' active' : '') + '" title="按时间由远至近排列" onclick="recSetTimelineSort(\'asc\')">时间顺序</button>' +
      '<button class="setbar-mini' + (recTimelineSort === 'desc' ? ' active' : '') + '" title="按时间由近至远排列" onclick="recSetTimelineSort(\'desc\')">时间逆序</button>' +
      '<button class="setbar-mini" title="导出事件脉络文档" onclick="exportSituTimelineDoc()">导出文档</button>' +
      '<span class="setbar-zoom">' +
      '<button class="setbar-mini" title="缩小时间轴" onclick="recTimelineZoom(-1)">−</button>' +
      '<span class="setbar-zoom-val" id="recTlZoomVal">' + Math.round(recTlZoom * 100) + '%</span>' +
      '<button class="setbar-mini" title="放大时间轴" onclick="recTimelineZoom(1)">＋</button>' +
      '</span>';
  } else {
    html = '<button class="setbar-mini' + (recSituShowLabel ? ' active' : '') + '" id="situLabelBtn" title="显示 / 隐藏时间轴与轨道名称列" onclick="recToggleSituLabel()">项目名称</button>' +
      '<button class="setbar-mini" title="事件宽度减小" onclick="recSituEventResize(\'w\',-1)">宽度-</button>' +
      '<button class="setbar-mini" title="事件宽度增大" onclick="recSituEventResize(\'w\',1)">宽度+</button>' +
      '<button class="setbar-mini" title="事件高度减小" onclick="recSituEventResize(\'h\',-1)">高度-</button>' +
      '<button class="setbar-mini" title="事件高度增大" onclick="recSituEventResize(\'h\',1)">高度+</button>' +
      '<span class="setbar-zoom">' +
      '<button class="setbar-mini" title="整体缩小" onclick="recSituZoom(-1)">−</button>' +
      '<span class="setbar-zoom-val" id="situZoomVal">' + Math.round(recSituZoomLevel * 100) + '%</span>' +
      '<button class="setbar-mini" title="整体放大" onclick="recSituZoom(1)">＋</button>' +
      '</span>';
  }
  box.innerHTML = html;
  box.classList.add('show');
  const input = document.getElementById('recSearchInput');
  if (input && input.value !== recSearchQuery) input.value = recSearchQuery;
  const chk = document.getElementById('recSearchOnlyChk');
  if (chk) chk.checked = recSearchOnly;
  recUpdateSearchCount();
  if (typeof window.__ftRefreshTheme === 'function') window.__ftRefreshTheme();
}

function recProjectInputHandler() {
  const name = recSingleProjectName();
  if (!name) return;
  const input = document.getElementById('recProjectInput');
  if (input) {
    recProjectTexts[name] = input.innerText || '';
    recProjectHtmls[name] = input.innerHTML;
  }
  recProjSchedulePersist();
  recProjScheduleTimeline();
}

// ---- 三栏分隔条拖动：左列表宽度 / 中栏与时间轴栏比例（第19次） ----
const REC_COL_WIDTH_KEY = 'duowei-rec-col-width-v1';
let recColDrag = null;

function recColWidthLoad() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(REC_COL_WIDTH_KEY) || '{}') || {}; } catch (e) {}
  return { list: (typeof d.list === 'number' ? d.list : 0), content: (typeof d.content === 'number' ? d.content : 0) };
}
function recColWidthSave() {
  const wrap = document.querySelector('#recProjectPanel .rec3-wrap');
  const list = document.querySelector('#recProjectPanel .rec3-listcol');
  const content = document.querySelector('#recProjectPanel .rec3-contentcol');
  if (!wrap || !list || !content) return;
  const wrapW = wrap.getBoundingClientRect().width;
  if (!wrapW) return;
  try {
    localStorage.setItem(REC_COL_WIDTH_KEY, JSON.stringify({
      list: Math.round(list.getBoundingClientRect().width),
      content: Math.round(content.getBoundingClientRect().width / wrapW * 1000) / 10
    }));
  } catch (e) {}
}
function applyRecColWidths() {
  const wrap = document.querySelector('#recProjectPanel .rec3-wrap');
  const list = document.querySelector('#recProjectPanel .rec3-listcol');
  const content = document.querySelector('#recProjectPanel .rec3-contentcol');
  const tl = document.querySelector('#recProjectPanel .rec3-tlcol');
  if (!wrap || !list || !content || !tl) return;
  const cfg = recColWidthLoad();
  if (cfg.list > 0) list.style.flex = '0 0 ' + cfg.list + 'px';
  if (cfg.content > 0) {
    content.style.flex = '0 0 ' + cfg.content + '%';
    tl.style.flex = '1 1 0';
  }
}
function recColDividerStart(e) {
  const div = e.currentTarget;
  const wrap = document.querySelector('#recProjectPanel .rec3-wrap');
  if (!wrap) return;
  const divs = Array.from(wrap.querySelectorAll('.rec3-divider'));
  const which = divs.indexOf(div) === 0 ? 'list' : 'content';
  const target = which === 'list'
    ? document.querySelector('#recProjectPanel .rec3-listcol')
    : document.querySelector('#recProjectPanel .rec3-contentcol');
  if (!target) return;
  e.preventDefault();
  recColDrag = { which: which, startX: e.clientX, startW: target.getBoundingClientRect().width,
    wrapW: wrap.getBoundingClientRect().width, div: div };
  div.classList.add('dragging');
  document.body.classList.add('rec-col-dragging');
  document.addEventListener('mousemove', recColDividerMove);
  document.addEventListener('mouseup', recColDividerEnd);
}
function recColDividerMove(e) {
  if (!recColDrag) return;
  const wrap = document.querySelector('#recProjectPanel .rec3-wrap');
  const list = document.querySelector('#recProjectPanel .rec3-listcol');
  const content = document.querySelector('#recProjectPanel .rec3-contentcol');
  const tl = document.querySelector('#recProjectPanel .rec3-tlcol');
  if (!wrap || !list || !content || !tl) return;
  const dx = e.clientX - recColDrag.startX;
  if (recColDrag.which === 'list') {
    const max = Math.min(460, Math.max(160, recColDrag.wrapW * 0.5));
    const w = Math.max(140, Math.min(max, recColDrag.startW + dx));
    list.style.flex = '0 0 ' + Math.round(w) + 'px';
  } else {
    const pct = Math.max(25, Math.min(75, (recColDrag.startW + dx) / wrap.getBoundingClientRect().width * 100));
    content.style.flex = '0 0 ' + pct + '%';
    tl.style.flex = '1 1 0';
  }
}
function recColDividerEnd() {
  if (!recColDrag) return;
  if (recColDrag.div) recColDrag.div.classList.remove('dragging');
  document.body.classList.remove('rec-col-dragging');
  document.removeEventListener('mousemove', recColDividerMove);
  document.removeEventListener('mouseup', recColDividerEnd);
  recColDrag = null;
  recColWidthSave();
}

// 一次性把三栏分隔条接上拖动（divider 是静态 DOM，可重复调用）
function recBindColDividers() {
  const wrap = document.querySelector('#recProjectPanel .rec3-wrap');
  if (!wrap) return;
  wrap.querySelectorAll('.rec3-divider').forEach(function(div) {
    if (div.getAttribute('data-col-bound')) return;
    div.setAttribute('data-col-bound', '1');
    div.addEventListener('mousedown', recColDividerStart);
  });
  applyRecColWidths();
}

// ---- 公文格式排版（参照 电子记事本 笔记窗口「重置格式（本篇）」规则） ----
const REC_FMT = {
  title: 'margin:0;line-height:1.8;font-family:方正小标宋简体,FZXiaoBiaoSong,SimSun,serif;font-size:20px;text-align:center;text-indent:0;',
  center: 'margin:0;line-height:1.8;font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;font-size:16px;text-align:center;text-indent:0;',
  secret: 'margin:0;line-height:1.8;font-family:黑体,SimHei,sans-serif;font-size:16px;text-align:left;text-indent:0;',
  h1: 'margin:0;line-height:1.8;font-family:黑体,SimHei,sans-serif;font-size:16px;text-align:left;text-indent:2em;',
  h2: 'margin:0;line-height:1.8;font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;font-size:16px;text-align:left;text-indent:2em;',
  h3: 'margin:0;line-height:1.8;font-family:仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif;font-size:16px;font-weight:bold;text-align:left;text-indent:2em;',
  body: 'margin:0;line-height:1.8;font-family:仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif;font-size:16px;text-align:left;text-indent:2em;',
  remark: 'font-family:楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif;font-size:14px;'
};

// 颜色加深（备注底色：项目色系的深色）
function recDarkenHex(hex, ratio) {
  let h = String(hex || '').replace(/^#/, '').trim();
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) h = '1b3a6e';
  const n = parseInt(h, 16);
  const k = Math.max(0, Math.min(0.9, ratio));
  function p2(v) { return ('0' + Math.round(v).toString(16)).slice(-2); }
  return '#' + p2(((n >> 16) & 255) * (1 - k)) + p2(((n >> 8) & 255) * (1 - k)) + p2((n & 255) * (1 - k));
}
// 第63轮：单选卡片与多选窗口共用 .rec-proj-win，用「是否位于 #recProjectMulti 内」区分两者
function recWinIsMulti(win) {
  return !!(win && win.parentNode && win.parentNode.id === 'recProjectMulti');
}

// 第63轮：项目色 → 极浅背景色（k=0 原色，k=1 纯白），用于区分窗口
function recTintHex(hex, k) {
  const n = parseInt(String(hex || '').replace('#', ''), 16);
  if (isNaN(n)) return '#ffffff';
  function p2(v) { return ('0' + Math.round(v).toString(16)).slice(-2); }
  const mix = function(v) { return Math.round(v * (1 - k) + 255 * k); };
  return '#' + p2(mix((n >> 16) & 255)) + p2(mix((n >> 8) & 255)) + p2(mix(n & 255));
}
function recRemarkBgOf(proj) {
  return recDarkenHex(proj ? recProjColor(proj) : '#1b3a6e', 0.55);
}
function recRemarkSpan(text, proj) {
  var bg = recRemarkBgOf(proj);
  return '<span class="rec-remark" style="--rm-c:' + bg + ';' + REC_FMT.remark + 'color:#fff;background:' + bg +
    ';border-radius:3px;padding:0 2px;box-decoration-break:clone;-webkit-box-decoration-break:clone;">' +
    escapeHtml(text) + '</span>';
}
// 取消识别的日期：前置不可见标记（WORD JOINER），打断句首/句后日期匹配
const REC_NODATE = '\u2060';
const REC_NODATE_SRC = '\\u2060';
function recHasNoDateMark(s) { return String(s || '').indexOf(REC_NODATE) !== -1; }
function recStripNoDateMark(s) { return String(s || '').split(REC_NODATE).join(''); }
// 判断一段文字是否含日期（会被识别为时间事件），用于排除其被当作标题
function recHasDateToken(tr) {
  const s = String(tr || '').replace(/\u2060/g, '').replace(/【[\s\S]*?】/g, '');
  return /(\d{4}\s*[.\-]|\d{4}\s*年|\d{1,2}\s*月\s*\d{1,2}\s*日|\d{1,2}\s*月(?!份)|\d{1,2}\s*日|时间[：:]|上午|下午|中午|晚上|早上|次日|第二日|第二天|当日|同日|当天|次月|次年)/.test(s);
}

function recMatchHK(tr) {
  if (tr.match(/^(第[一二三四五六七八九十]+)[，,]/)) return 'cn-di';
  if (tr.match(/^([一二三四五六七八九十]+)、/)) return 'cn-dun';
  if (tr.match(/^（[一二三四五六七八九十]+）/) || tr.match(/^\([一二三四五六七八九十]+\)/)) return 'cn-paren';
  if (tr.match(/^[一二三四五六七八九十]+[是要看抓查学紧盯聚焦]/)) return 'cn-verb';
  if (tr.match(/^(\d+)[.、．]/)) return 'num-dun';
  return null;
}

function recExtractFirstSentenceL3(txt) {
  for (var i = 0; i < txt.length; i++) {
    var ch = txt.charAt(i);
    if (ch === '。' || ch === '！' || ch === '；') return { sentence: txt.substring(0, i + 1), rest: txt.substring(i + 1) };
  }
  return { sentence: txt, rest: '' };
}

// 正文内联：（）括号注 楷体、数字./中文+要|是 加粗（level-3）；【】备注统一楷体小一号 + 项目色深底白字
function recFormatBodyInline(text, proj) {
  if (!text) return '';
  if (!/【/.test(text)) return recFmtInlineNormal(text);
  let h = '', li = 0, m;
  const re = /【[\s\S]*?】/g;
  while ((m = re.exec(text)) !== null) {
    if (m.index > li) h += recFmtInlineNormal(text.substring(li, m.index));
    h += recRemarkSpan(m[0], proj);
    li = m.index + m[0].length;
  }
  if (li < text.length) h += recFmtInlineNormal(text.substring(li));
  return h;
}
function recFmtInlineNormal(text) {
  if (!text) return '';
  const sr = REC_FMT.remark, s3 = REC_FMT.h3;
  const pos = [];
  const reParen = /（([^）]{2,})）/g;
  let mP;
  while ((mP = reParen.exec(text)) !== null) {
    if (/^（\s*\d{4}年\d{1,2}月\d{1,2}日\s*）$/.test(mP[0])) continue;
    pos.push({ i: mP.index, t: 'paren', v: mP[0] });
  }
  const reN = /(\d+)[.、．]/g;
  let mN;
  while ((mN = reN.exec(text)) !== null) {
    if (mN.index === 0 || /[\s。；：,，、．]/.test(text.charAt(mN.index - 1))) pos.push({ i: mN.index, t: 'num' });
  }
  const reC = /([一二三四五六七八九十]+)[是要]/g;
  let mC;
  while ((mC = reC.exec(text)) !== null) {
    if (mC.index === 0 || /[\s。；：,，、．]/.test(text.charAt(mC.index - 1))) pos.push({ i: mC.index, t: 'cn' });
  }
  if (!pos.length) return escapeHtml(text);
  pos.sort(function(a, b) { return a.i - b.i; });
  let h = '', li = 0;
  for (let pi = 0; pi < pos.length; pi++) {
    const p = pos[pi];
    if (p.i < li) continue;
    if (p.i > li) h += escapeHtml(text.substring(li, p.i));
    if (p.t === 'paren') {
      h += '<span style="' + sr + '">' + escapeHtml(p.v) + '</span>';
      li = p.i + p.v.length;
    } else {
      const segEnd = pi + 1 < pos.length ? pos[pi + 1].i : text.length;
      const seg = text.substring(p.i, segEnd);
      const sp = recExtractFirstSentenceL3(seg);
      h += '<span style="' + s3 + '">' + escapeHtml(sp.sentence) + '</span>';
      if (sp.rest) h += escapeHtml(sp.rest);
      li = segEnd;
    }
  }
  if (li < text.length) h += escapeHtml(text.substring(li));
  return h;
}

// 判断段落是否以句末标点结尾（忽略行尾的【备注】标记，避免把带备注的正文误判为标题）
function recEndsWithStop(tr) {
  let s = String(tr || '').replace(/(\s*【[^】]*】)+\s*$/, '').replace(/\s+$/, '');
  if (!s) s = String(tr || '').replace(/\s+$/, '');
  const end = s ? s.charAt(s.length - 1) : '';
  return '，、；。：！？…》】”")）.'.indexOf(end) !== -1;
}

function recFormatItems(items) {
  const paras = [];
  let afterStartPart = false;
  let startPartCount = 0;
  let l1Count = 0;
  // 预扫描：标题层级候选（参照 _notepadCoreFormat）
  const candidates = [];
  let autoL1 = null, autoL2 = null;
  items.forEach(function(it) {
    if (it.blank) { candidates.push({ blank: true }); return; }
    const tr = it.text.trim();
    const hk = recMatchHK(tr);
    let kind = 'body';
    if (hk === 'num-dun' || hk === 'cn-verb' || hk === 'cn-di') kind = 'heading_ctx';
    else if (hk) {
      if (!autoL1) { autoL1 = hk; kind = 'L1'; autoL2 = null; }
      else if (hk === autoL1) { kind = 'L1'; autoL2 = null; }
      else if (!autoL2) { autoL2 = hk; kind = 'L2'; }
      else if (hk === autoL2) { kind = 'L2'; }
      else kind = 'body';
    }
    candidates.push({ blank: false, kind: kind, hk: hk });
  });
  // 无标点的短段（≤50字、无结尾标点）≥2 处视为一级标题
  let noPunctCount = 0;
  items.forEach(function(it, i) {
    if (it.blank) return;
    const tr = it.text.trim();
    if (candidates[i].kind !== 'body') return;
    if (tr.length > 50) return;
    if (recEndsWithStop(tr)) return;
    noPunctCount++;
  });
  if (noPunctCount >= 2) {
    items.forEach(function(it, i) {
      if (it.blank) return;
      const tr = it.text.trim();
      if (candidates[i].kind !== 'body') return;
      if (tr.length > 50) return;
      if (recEndsWithStop(tr)) return;
      candidates[i].kind = 'L1';
    });
  }
  let nonEmptyIndex = -1;
  items.forEach(function(it, i) {
    if (it.blank) return;   // 段落之间不产生空段落
    nonEmptyIndex++;
    const text = it.text.replace(/^\s+/, '');
    const trimmed = text.trim();
    // 公文首部：密级/★ 标记
    if (!afterStartPart) {
      let isStartPart = false;
      if ((trimmed.indexOf('密') !== -1 || trimmed.indexOf('★') !== -1) && trimmed.length <= 15 && nonEmptyIndex < 3) {
        paras.push({ style: REC_FMT.secret, text: text });
        startPartCount++; isStartPart = true;
      } else if (nonEmptyIndex < 4 && trimmed.length <= 50) {
        const hasPunct = '，、；。：！？…'.indexOf(trimmed.charAt(trimmed.length - 1)) !== -1;
        if (!hasPunct && !recHasDateToken(trimmed) && l1Count === 0 && !trimmed.match(/^[一二三四五六七八九十]/) && !trimmed.match(/^\d+[.、．]/)) {
          if (startPartCount === 0) {
            paras.push({ style: REC_FMT.title, text: text });
            startPartCount++; isStartPart = true;
          } else if (startPartCount <= 2) {
            paras.push({ style: REC_FMT.center, text: text });
            startPartCount++; isStartPart = true;
          }
        }
      }
      if (isStartPart) return;
      afterStartPart = true;
    }
    const kind = (candidates[i] && candidates[i].kind) || 'body';
    if (kind === 'L1') { l1Count++; paras.push({ style: REC_FMT.h1, text: text }); return; }
    if (kind === 'L2') { paras.push({ style: REC_FMT.h2, text: text }); return; }
    if (kind === 'L3' || kind === 'heading_ctx') { paras.push({ style: REC_FMT.h3, text: text }); return; }
    paras.push({ style: REC_FMT.body, text: text });
  });
  return paras;
}

// 拆分事件时间字符串「标准时间（原文日期）」→ { std, orig }（无（）时 orig=整串、std 空）
function splitEvTime(time) {
  const s = String(time || '');
  const m = s.match(/^(.*?)[（(]([^（）()]*)[）)]\s*$/);
  if (m) return { std: m[1].trim(), orig: m[2].trim() };
  return { std: '', orig: s.trim() };
}

// 某月最后一天（m 1-12）
function monthLastDay(y, m) {
  return new Date(y, m, 0).getDate();
}

// 模糊时段边界：月初=前5天、月底=后5天、上旬=1-10、中旬=11-20、下旬=21-月末
function monthPeriodBounds(y, m, kind) {
  const last = monthLastDay(y, m);
  if (kind === '初') return { s: 1, e: Math.min(5, last) };
  if (kind === '上旬') return { s: 1, e: Math.min(10, last) };
  if (kind === '中旬') return { s: Math.min(11, last), e: Math.min(20, last) };
  if (kind === '下旬') return { s: Math.min(21, last), e: last };
  if (kind === '底') return { s: Math.max(1, last - 4), e: last };
  return { s: 1, e: last };
}
function durationDateValue(r, key, manual) {
  const v = manual || (key ? r.cells[headers.indexOf(key)] : '');
  return parseDateParts(v);
}
function durationLabelDays(cat, r) {
  const a = durationDateValue(r, cat.start, cat.startManual), b = durationDateValue(r, cat.end, cat.endManual);
  if (!a || !b || a.y === null || b.y === null || a.m === null || b.m === null || a.d === null || b.d === null) return null;
  return Math.max(0, Math.round((new Date(b.y, b.m - 1, b.d) - new Date(a.y, a.m - 1, a.d)) / 86400000));
}
function durationLabelValue(cat, r) {
  const days = durationLabelDays(cat, r); if (days === null) return '';
  const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30), d = days % 30;
  switch (cat.format || 'months-days') { case 'years-months': return y + '年' + (m ? m + '个月' : ''); case 'months': return Math.floor(days / 30) + '个月'; case 'months-days': return Math.floor(days / 30) + '个月' + (d ? d + '天' : ''); default: return days + '天'; }
}
function durationLabelTip(cat, r) {
  const a = cat.startManual || (cat.start ? r.cells[headers.indexOf(cat.start)] : ''), b = cat.endManual || (cat.end ? r.cells[headers.indexOf(cat.end)] : ''), days = durationLabelDays(cat, r);
  return a + '——' + b + '，共' + (days === null ? 0 : days) + '天';
}

function quarterPeriodBounds(y, q) {
  const sm = (q - 1) * 3 + 1;
  return { sm: sm, sd: 1, em: sm + 2, ed: monthLastDay(y, sm + 2) };
}

// 季度范围：一至二季度 / 一、二季度 / 第一至第二季度 / 第一、二季度 / 一季度至二季度
// 返回 {year, sm, sd, em, ed}：一至二季度 → 1月至6月
function parseQuarterRangeToken(t, year) {
  const CN = '[一二三四1-4]';
  const s = String(t || '').replace(/\s+/g, '');
  const yp = s.match(/^(\d{4})年/);
  const yr = yp ? parseInt(yp[1], 10) : year;
  const body = yp ? s.slice(yp[0].length) : s;
  const re = new RegExp('^(?:第)?(' + CN + ')(?:季度)?\\s*(?:[至—–~－\\-到]|[、,])\\s*(?:第)?(' + CN + ')(?:季度)$');
  const m = body.match(re);
  if (!m) return null;
  year = yr;
  function q(v) { const i = '一二三四'.indexOf(v); return i >= 0 ? i + 1 : parseInt(v, 10); }
  const q1 = q(m[1]), q2 = q(m[2]);
  if (!(q1 >= 1 && q1 <= 4 && q2 >= 1 && q2 <= 4)) return null;
  const lo = Math.min(q1, q2), hi = Math.max(q1, q2);
  const sm = (lo - 1) * 3 + 1, em = hi * 3;
  return { year: year, sm: sm, sd: 1, em: em, ed: monthLastDay(year, em) };
}

// 月份 前/后：2026年6月前 → 上一个月（5月1日至5月底）；2026年6月后 → 本月（6月1日至6月底）
function parseMonthBeforeAfterToken(t, year) {
  const m = String(t || '').replace(/\s+/g, '').match(/^(?:(\d{4})年)?(\d{1,2})月(前(?!后)|后)$/);
  if (!m) return null;
  let y = m[1] ? parseInt(m[1], 10) : year;
  let mo = parseInt(m[2], 10);
  if (!y || mo < 1 || mo > 12) return null;
  if (m[3] === '前') {
    mo -= 1;
    if (mo < 1) { mo = 12; y -= 1; }
  }
  return { year: y, sm: mo, sd: 1, em: mo, ed: monthLastDay(y, mo) };
}

// 解析时间段原文（中文）→ {year, sm, sd, em, ed} 或 null
// 支持：6月上旬 / 6月底 / 6月至7月 / 6月3日至7月底 / 6月初至7月 / 25日至27日 / 2026年6月上旬 等
// 仅处理 模糊(初/旬/底) 或 起止范围；单纯 6月 / 6月3日 返回 null 交由旧逻辑
function parsePeriodToken(tok, year, month) {
  year = year || 2000; month = month || 1;
  let t = String(tok || '').replace(/\s+/g, '');
  if (!t) return null;
  const ym = t.match(/^(\d{4})年/);
  if (ym) { year = parseInt(ym[1], 10); t = t.slice(ym[0].length); }
  // 季度范围：一至二季度 / 一、二季度 / 第一至第二季度 / 第一、二季度
  const qr = parseQuarterRangeToken(t, year);
  if (qr) return qr;
  // 月份前后：2026年6月前 → 5月；2026年6月后 → 6月
  const mb = parseMonthBeforeAfterToken(t, year);
  if (mb) return mb;
  const parts = t.split(/至|—|–|~|－|-|到/);
  if (parts.length > 2) return null;
  function parsePart(p) {
    if (!p) return null;
    let m = p.match(/^(\d{1,2})月(\d{1,2})日$/);
    if (m) return { m: parseInt(m[1], 10), d: parseInt(m[2], 10), kind: null };
    m = p.match(/^(\d{1,2})月(初|上旬|中旬|下旬|底)$/);
    if (m) return { m: parseInt(m[1], 10), kind: m[2] };
    m = p.match(/^(\d{1,2})月$/);
    if (m) return { m: parseInt(m[1], 10), kind: null };
    m = p.match(/^(\d{1,2})日$/);
    if (m) return { m: null, d: parseInt(m[1], 10), kind: null };
    m = p.match(/^([一二三四1-4])季度$/);
    if (m) return { q: '一二三四'.indexOf(m[1]) >= 0 ? '一二三四'.indexOf(m[1]) + 1 : parseInt(m[1], 10), kind: 'quarter' };
    return null;
  }
  const a = parsePart(parts[0]);
  if (!a) return null;
  if (parts.length === 1 && !a.kind) return null;
  const b = parts.length > 1 ? parsePart(parts[1]) : null;
  let sm, sd, em, ed;
  if (a.kind === 'quarter') { const qb = quarterPeriodBounds(year, a.q); sm = qb.sm; sd = qb.sd; }
  else if (a.kind) { const bd = monthPeriodBounds(year, a.m, a.kind); sm = a.m; sd = bd.s; }
  else if (a.d != null) { sm = (a.m != null) ? a.m : month; sd = a.d; }
  else { sm = a.m; sd = 1; }
  if (b) {
    if (b.kind === 'quarter') { const qb = quarterPeriodBounds(year, b.q); em = qb.em; ed = qb.ed; }
    else if (b.kind) { const bd = monthPeriodBounds(year, b.m, b.kind); em = b.m; ed = bd.e; }
    else if (b.d != null) { em = (b.m != null) ? b.m : sm; ed = b.d; }
    else { em = b.m; ed = monthLastDay(year, b.m); }
  } else {
    if (a.kind === 'quarter') { const qb = quarterPeriodBounds(year, a.q); em = qb.em; ed = qb.ed; }
    else if (a.kind) { const bd = monthPeriodBounds(year, a.m, a.kind); em = a.m; ed = bd.e; }
    else if (a.d != null) { em = sm; ed = sd; }
    else { em = a.m; ed = monthLastDay(year, a.m); }
  }
  return { year: year, sm: sm, sd: sd, em: em, ed: ed };
}
function periodStartKey(p) { return p.year + '.' + (p.sm < 10 ? '0' : '') + p.sm + '.' + (p.sd < 10 ? '0' : '') + p.sd; }
function periodEndKey(p) { return p.year + '.' + (p.em < 10 ? '0' : '') + p.em + '.' + (p.ed < 10 ? '0' : '') + p.ed; }

// 模糊/起止时间 token 的正则片段（要求含 初/旬/底 或 至 范围，供提取与标记共用）
function periodRangeSource() {
  const SEP = '[至—–~－\\-到]';
  const MON = '(?:\\d{4}\\s*年\\s*)?\\d{1,2}\\s*月';
  const DAY = '\\d{1,2}\\s*日';
  const KIND = '(?:初|上旬|中旬|下旬|底)';
  const QUARTER = '(?:[一二三四1-4]季度)';
  const QN = '(?:[一二三四1-4])';
  const kindMon = MON + '\\s*' + KIND;
  const monEnd = MON + '(?:\\s*' + KIND + '|\\s*' + DAY + ')?';
  // 季度范围：一至二季度 / 一、二季度 / 第一至第二季度 / 第一、二季度 / 一季度至二季度
  const quarterRange = '(?:\\d{4}\\s*年\\s*)?第?' + QN + '(?:\\s*季度)?\\s*(?:' + SEP + '|[、,])\\s*第?' + QN + '\\s*季度';
  // 月份前后：2026年6月前 / 2026年6月后（排除「前后」这一 2 字后缀）
  const monBeforeAfter = MON + '(?:前(?!后)|后)';
  return '(?:' +
    quarterRange + '|' +
    monBeforeAfter + '|' +
    kindMon + '(?:\\s*' + SEP + '\\s*' + MON + '(?:\\s*' + KIND + ')?)?' + '|' +
    '(?:\\d{4}\\s*年\\s*)?' + QUARTER + '|' +
    MON + '(?:\\s*' + DAY + ')?\\s*' + SEP + '\\s*(?:' + monEnd + '|' + DAY + ')' + '|' +
    DAY + '\\s*' + SEP + '\\s*' + DAY +
  ')';
}

// 匹配文本开头的模糊/起止时段 token（返回匹配串或 null）
function matchPeriodTokenAtStart(text) {
  const re = new RegExp('^(' + periodRangeSource() + ')');
  const m = String(text || '').match(re);
  return m ? m[1] : null;
}

// 从事件原文日期串解析时间段「结束日期键」，返回 "yyyy.mm.dd"；无法解析/单日则返回 null
// 支持：2026年4月5日至10日、2026年6月、2026年5月至6月、2026.04.05-2026.04.10、2026.04-2026.04 等
function resolveRangeEndKey(startKey, orig) {
  function p2(n) { n = parseInt(n, 10); return (n < 10 ? '0' : '') + n; }
  const sm = String(startKey || '').match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (!sm) return null;
  const y0 = parseInt(sm[1], 10), m0 = parseInt(sm[2], 10), d0 = parseInt(sm[3], 10);
  const s = String(orig || '').trim();
  if (!s) return null;
  // 模糊时段（月初/上旬/中旬/下旬/月底）或起止范围 → 用 parsePeriodToken 解析起止
  const pp = parsePeriodToken(s, y0, m0);
  if (pp) {
    const ek = periodEndKey(pp);
    if (ek !== startKey) return ek;
  }
  // 无起止分隔符：整月 / 整年
  if (!/[至—–~－\-到]/.test(s)) {
    let mm = s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月$/);
    if (mm) { const y = parseInt(mm[1], 10), mo = parseInt(mm[2], 10); return y + '.' + p2(mo) + '.' + p2(monthLastDay(y, mo)); }
    mm = s.match(/^(\d{4})\s*年$/);
    if (mm) return mm[1] + '.12.31';
    mm = s.match(/^(\d{4})\.(\d{1,2})$/);
    if (mm) { const y = parseInt(mm[1], 10), mo = parseInt(mm[2], 10); return y + '.' + p2(mo) + '.' + p2(monthLastDay(y, mo)); }
    return null;
  }
  // 有起止分隔符：取末尾结束部分
  const tail = s.split(/[至—–~－\-到]/).slice(-1)[0].trim();
  if (!tail) return null;
  let m = tail.match(/^(\d{4})\s*[.\-年]\s*(\d{1,2})\s*[.\-月]\s*(\d{1,2})\s*日?/);
  if (m) return m[1] + '.' + p2(m[2]) + '.' + p2(m[3]);
  m = tail.match(/^(\d{4})\s*[.\-年]\s*(\d{1,2})\s*月?/);
  if (m) { const y = parseInt(m[1], 10), mo = parseInt(m[2], 10); return y + '.' + p2(mo) + '.' + p2(monthLastDay(y, mo)); }
  m = tail.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) { const mo = parseInt(m[1], 10), dd = parseInt(m[2], 10); return y0 + '.' + p2(mo) + '.' + p2(dd); }
  m = tail.match(/^(\d{1,2})\s*月/);
  if (m) { const mo = parseInt(m[1], 10); return y0 + '.' + p2(mo) + '.' + p2(monthLastDay(y0, mo)); }
  m = tail.match(/^(\d{1,2})\s*日/);
  if (m) return y0 + '.' + p2(m0) + '.' + p2(m[1]);
  return null;
}

// 判断事件原文是否至少有一端精确到日（中文日格式或点/横线日期格式）。
function situHasConcreteDay(orig) {
  const s = String(orig || '').replace(/\s+/g, '');
  return /\d{1,2}日/.test(s) || /\d{4}[.\-]\d{1,2}[.\-]\d{1,2}/.test(s);
}

// 月初、月底、各旬及季度均属于粗略时间：保留起始日期，但隐藏月末独立日期刻度。
function situIsRoughPeriod(orig) {
  const s = String(orig || '').replace(/\s+/g, '');
  return /初|月底|上旬|中旬|下旬|底|[一二三四1-4]季度/.test(s);
}

// 整月时间段的时间轴结束边界：用下月1日作为右边界，但不把本月最后一天显示成独立刻度。
function resolveAxisEndKey(startKey, orig) {
  const s = String(orig || '').trim().replace(/\s+/g, '');
  if (!s || /[至—–~－\-到]/.test(s)) {
    // 跨月/跨年范围若结束部分只到月份，同样以结束月下月1日作为边界。
    const tail = s.split(/[至—–~－\-到]/).slice(-1)[0] || '';
    if (!/^(?:\d{4}年)?\d{1,2}月$/.test(tail)) return null;
    const m = tail.match(/^(?:(\d{4})年)?(\d{1,2})月$/);
    if (!m) return null;
    const base = situParseDate(startKey);
    const y = m[1] ? parseInt(m[1], 10) : (base ? base.y : 0);
    const mo = parseInt(m[2], 10);
    const d = new Date(y, mo, 1);
    return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.01';
  }
  const m = s.match(/^(?:(\d{4})年)?(\d{1,2})月$/);
  if (!m) return null;
  const base = situParseDate(startKey);
  const y = m[1] ? parseInt(m[1], 10) : (base ? base.y : 0);
  const mo = parseInt(m[2], 10);
  const d = new Date(y, mo, 1);
  return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.01';
}

// 识别纯月份事件，避免把整月结束日误显示成月末日期刻度。
function parseSituMonthRange(orig, baseYear) {
  const s = String(orig || '').replace(/\s+/g, '');
  const qm = s.match(/^(?:(\d{4})年)?([一二三四1-4])季度$/);
  if (qm) {
    const y = qm[1] ? parseInt(qm[1], 10) : parseInt(baseYear, 10);
    const q = '一二三四'.indexOf(qm[2]) >= 0 ? '一二三四'.indexOf(qm[2]) + 1 : parseInt(qm[2], 10);
    if (y && q >= 1 && q <= 4) return { startYear: y, startMonth: (q - 1) * 3 + 1, endYear: y, endMonth: q * 3 };
  }
  // 季度范围：一至二季度 / 第一、二季度 等 → 起止月份连续
  const qr = parseQuarterRangeToken(s, parseInt(baseYear, 10));
  if (qr) return { startYear: qr.year, startMonth: qr.sm, endYear: qr.year, endMonth: qr.em };
  // 月份前后：6月前 → 5月；6月后 → 6月
  const mb = parseMonthBeforeAfterToken(s, parseInt(baseYear, 10));
  if (mb) return { startYear: mb.year, startMonth: mb.sm, endYear: mb.year, endMonth: mb.em };
  const m = s.match(/^(?:(\d{4})年)?(\d{1,2})月(?:至(?:(\d{4})年)?(\d{1,2})月)?$/);
  if (!m) return null;
  const startYear = m[1] ? parseInt(m[1], 10) : parseInt(baseYear, 10);
  const startMonth = parseInt(m[2], 10);
  const endYear = m[3] ? parseInt(m[3], 10) : startYear;
  const endMonth = m[4] ? parseInt(m[4], 10) : startMonth;
  if (!startYear || !startMonth || !endYear || !endMonth) return null;
  return { startYear: startYear, startMonth: startMonth, endYear: endYear, endMonth: endMonth };
}

// 枚举 startKey~endKey 之间每一天（含首尾），返回 ["yyyy.mm.dd",...]
function enumerateDateKeys(startKey, endKey) {
  const s = situParseDate(startKey), e = situParseDate(endKey);
  if (!s || !e) return [String(startKey || '')];
  const out = [];
  const cur = new Date(s.y, s.m - 1, s.d);
  const endD = new Date(e.y, e.m - 1, e.d);
  if (cur > endD) return [String(startKey || '')];
  while (cur <= endD) {
    out.push(cur.getFullYear() + '.' + pad2(cur.getMonth() + 1) + '.' + pad2(cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// 事件归一化：把 content 里残留的【】备注提取到 remark；并为每个事件计算 startKey/endKey（时间段）
function recNormalizeEvents(events) {
  events.forEach(function(ev){
    if (!ev.remark && /【/.test(String(ev.content || ''))) {
      const remarks = [];
      const re = /【([\s\S]*?)】/g;
      let m;
      while ((m = re.exec(String(ev.content || '')))) remarks.push(m[1]);
      ev.remark = remarks.join('\n');
      ev.content = String(ev.content || '').replace(/【[\s\S]*?】/g, '').trim();
    }
    // 备注去重：同一条事件只保留自己的备注，重复出现的题注只留一份
    if (ev.remark) {
      const seen = {};
      ev.remark = String(ev.remark).split(/\r?\n/).map(function(x){ return String(x).trim(); })
        .filter(function(x){ if (!x || seen[x]) return false; seen[x] = 1; return true; })
        .join('\n');
    }
    const startKey = String(ev.sortKey || '').split(' ')[0];
    ev.startKey = startKey;
    const tt = splitEvTime(ev.time);
    ev.endKey = resolveRangeEndKey(startKey, tt.orig) || startKey;
  });
  return events;
}

// 时间轴排序：按 sortKey 升序（由远至近，稳定），返回 { order(排序后的文档序), timelineIndex(文档序→时间轴索引) }
function recBuildTimelineOrder(events) {
  const order = events.map(function(_, i){ return i; });
  order.sort(function(a, b){
    const ka = String(events[a].sortKey || ''), kb = String(events[b].sortKey || '');
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return a - b;
  });
  const timelineIndex = new Array(events.length);
  order.forEach(function(docIdx, tlIdx){ timelineIndex[docIdx] = tlIdx; });
  return { order: order, timelineIndex: timelineIndex };
}

// 日期显示文字：带括号的自定义时间（如「2008年4月（2008年夏天某一天）」）只显示括号内文字
function recDateDisplayText(raw) {
  const s = String(raw || '');
  const m = s.match(/^[^（(]*[（(]([^（）()]+)[）)]\s*$/);
  return (m && m[1].trim()) ? m[1].trim() : s;
}

// 第65轮：所有项目的日期链接统一深蓝色，不再跟随项目色
const REC_LINK_COLOR = '#0D47A1';

// 在一段文字中找出所有日期 token（句首或 。； 之后），逐个包超链接，其余走行内排版
// timelineIndex：文档序事件 → 时间轴索引 的映射（保证左侧日期链接到排序后时间轴的正确条目）
function recMarkAllDates(body, ei, eventCount, timelineIndex, proj, events, plain, linkColor) {
  if (!linkColor) linkColor = REC_LINK_COLOR;
  const fmtInline = plain ? escapeHtml : function(s) { return recFormatBodyInline(s, proj); };
  const SEP = '[至—–~－\\-到]';   // 起止分隔符
  const TSUF = '(?:上午|下午|中午|晚上|早上|\\d{1,2}时(?:半|\\d{1,2}分?)?)?';
  // 起止范围尾部：至/—/~/到 + (完整日期 | 月日 | 月 | 日)
  const RANGE = '(?:\\s*' + SEP + '\\s*(?:(?:\\d{4}\\s*年)?\\s*\\d{1,2}\\s*月\\s*(?:\\d{1,2}\\s*日)?|\\d{1,2}\\s*日))?';
  const PERIOD = periodRangeSource();   // 模糊/起止时段（6月上旬、6月至7月、25日至27日 等），优先匹配
  const TSUF2 = '(?:以来|以后|之前|之后|左右|至今|前后|过后)?';   // 日期后 2 字后缀（以来/以后/至今/左右/之后…）
  const src =
    '(^|[。；\\n\\r])([\\s\\u2060]*)((?:' +
      PERIOD + '|' +
      '\\d{4}[.\\-]\\d{1,2}(?:[.\\-]\\d{1,2})?(?:\\s*' + SEP + '\\s*\\d{4}[.\\-]\\d{1,2}(?:[.\\-]\\d{1,2})?)?' +  // 点格式 + 起止
      '|\\d{4}\\s{2,}' +
      '|时间[：:][^\\n，。；]*' +
      '|\\d{4}\\s*年\\s*\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日' + TSUF + RANGE +  // 年月日 + 起止
      '|\\d{4}\\s*年\\s*\\d{1,2}\\s*月' + RANGE +                            // 年月 + 起止
      '|\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日' + TSUF +
      '|\\d{1,2}\\s*月' +
      '|\\d{1,2}\\s*日' + TSUF +
      '|上午|下午|中午|晚上|早上|次日|第二日|第二天|当日|同日|当天|次月|次年' +
    ')' + TSUF2 + ')(?![份])';
  const re = new RegExp(src, 'g');
  // 【】内的备注：不识别为时间事件
  const remarkRanges = [];
  const reRm = /【[\s\S]*?】/g;
  let mRm;
  while ((mRm = reRm.exec(body)) !== null) remarkRanges.push([mRm.index, mRm.index + mRm[0].length]);
  function inRemark(idx) {
    for (let ri = 0; ri < remarkRanges.length; ri++) {
      if (idx >= remarkRanges[ri][0] && idx < remarkRanges[ri][1]) return remarkRanges[ri][1];
    }
    return 0;
  }
  let html = '';
  let lastIndex = 0;
  let m;
  while ((m = re.exec(body)) !== null) {
    const rmEnd = inRemark(m.index + m[1].length + m[2].length);
    if (rmEnd) { re.lastIndex = Math.max(re.lastIndex, rmEnd); continue; }
    const nodate = recHasNoDateMark(m[2]);
    if (nodate) {
      // 已「取消识别」的日期：只渲染为可右键的普通文本
      html += fmtInline(body.substring(lastIndex, m.index) + m[1]);
      html += '<span class="rec-tl-nodate" title="已取消识别 · 右键可恢复">' +
        escapeHtml(m[2]) + escapeHtml(m[3]) + '</span>';
      lastIndex = m.index + m[0].length;
      continue;
    }
    html += fmtInline(body.substring(lastIndex, m.index) + m[1] + m[2]);
    const ti = (ei < eventCount) ? (timelineIndex ? timelineIndex[ei] : ei) : -1;
    if (ti >= 0) {
      const ev0 = (events && ei < events.length) ? events[ei] : null;
      const attachN = (proj && ev0) ? recEventAttachCount(proj, ev0) : 0;
      const hasA = attachN ? ' rec-tl-link-attach' : '';
      const _loc = (proj && ev0) ? recEventLocator(ev0) : '';
      const _lc = linkColor ? ' style="color:' + escapeHtml(linkColor) + ';text-decoration-color:' + escapeHtml(linkColor) + '"' : '';
      html += '<a class="rec-tl-link' + hasA + '" href="javascript:void(0)"' + _lc + ' data-ei="' + ti + '"' +
        (attachN ? ' data-badge="' + attachN + '"' : '') +
        (proj ? ' data-proj="' + escapeHtml(proj) + '"' : '') +
        (_loc ? ' data-loc="' + escapeHtml(encodeURIComponent(_loc)) + '"' : '') +
        ' title="' + (hasA ? '该事件含附件 · 双击可编辑附件' : '双击此日期可添加附件') + '"' +
        ' onclick="recJumpToTimeline(this)" ondblclick="recAttachEditByLoc(this)">' + escapeHtml(recDateDisplayText(m[3])) + '</a>';
      ei++;
    } else {
      html += escapeHtml(m[3]);
    }
    lastIndex = m.index + m[0].length;
  }
  html += fmtInline(body.substring(lastIndex));
  return { html: html, ei: ei };
}

// 将段落渲染为 <p>，日期 token 包超链接；保留段落缩进、段落间无空行
function recRenderParasWithLinks(paras, eventCount, timelineIndex, proj, events, linkColor) {
  let ei = 0;
  const out = paras.map(function(p) {
    const lead = p.text.match(/^\s*/)[0];
    const body = p.text.slice(lead.length);
    const res = recMarkAllDates(body, ei, eventCount, timelineIndex, proj, events, false, linkColor);
    ei = res.ei;
    return '<p style="' + p.style + '">' + escapeHtml(lead) + res.html + '</p>';
  });
  return out.join('');
}

// 第64轮：公文格式渲染（自动识别 / 重置格式专用）——公文版式 + 彩色日期链接 + 附件标签
function recFormatProjectPublish(raw, proj) {
  const txt = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n');
  if (!txt.trim()) return { html: '', count: 0, text: txt };
  const clean = txt.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const events = recNormalizeEvents(recExtractStructuredEvents(clean));
  const built = recBuildTimelineOrder(events);
  const items = [];
  clean.split('\n').forEach(function(ln) { if (ln.trim()) items.push({ text: ln, blank: false }); });
  const paras = recFormatItems(items);
  return {
    html: recRenderParasWithLinks(paras, events.length, built.timelineIndex, proj, events, REC_LINK_COLOR),
    count: events.length,
    text: txt
  };
}

// 第63轮：只加日期链接的纯文本渲染——按原换行输出 <br>，不做任何排版
function recRenderPlainWithLinks(raw, eventCount, timelineIndex, proj, events, linkColor) {
  const lines = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n').split('\n');
  let ei = 0;
  const out = lines.map(function(ln) {
    if (!ln) return '';
    const res = recMarkAllDates(ln, ei, eventCount, timelineIndex, proj, events, true, linkColor || REC_LINK_COLOR);
    ei = res.ei;
    return res.html;
  });
  return out.join('<br>');
}

// 自动识别核心：整理公文格式（无空段落）+ 提取事件 + 日期加超链接，返回 {html,count,text}
// 第63轮：自动识别只做一件事——给日期加超链接；文字、段落、空行原样保留（不再套公文格式）
function recFormatProjectText(raw, proj) {
  raw = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n');
  if (!raw.trim()) return { html: '', count: 0, text: '' };
  const events = recNormalizeEvents(recExtractStructuredEvents(raw));
  const built = recBuildTimelineOrder(events);
  return { html: recRenderPlainWithLinks(raw, events.length, built.timelineIndex, proj, events), count: events.length, text: raw };
}

// 把中部当前编辑内容（单窗口/多窗口）同步进内存（不写缓存、不提示）
// 关键：只有 DOM 确实渲染的是该项目时才回写，否则会把上一个主题的空白内容覆盖到新数据上
function recProjectSyncLive() {
  if (recDomStale) return 0;
  const list = recProjectVisibleList();
  let n = 0;
  if (list.length >= 2) {
    const wins = document.querySelectorAll('#recProjectMulti .rec-proj-win');
    if (!wins.length) return 0;
    wins.forEach(function(win) {
      const name = win.getAttribute('data-proj') || '';
      const body = win.querySelector('.rec-proj-win-body');
      if (!name || !body) return;
      if (list.indexOf(name) < 0) return;
      recProjectTexts[name] = body.innerText || '';
      recProjectHtmls[name] = body.innerHTML;
      n++;
    });
  } else if (list.length === 1) {
    const name = list[0];
    if (recDomProject !== name) return 0;
    const input = document.getElementById('recProjectInput');
    if (input && !input.classList.contains('hidden')) {
      recProjectTexts[name] = input.innerText || '';
      recProjectHtmls[name] = input.innerHTML;
      recDomProject = name;
      n = 1;
    }
  }
  return n;
}

// 保存缓存：把中部当前编辑内容（单窗口/多窗口）同步进内存与 localStorage
function recProjectSaveCache() {
  const list = recProjectVisibleList();
  if (!list.length) { showToast('没有可保存的项目内容'); return; }
  const n = recProjectSyncLive();
  if (!n) { showToast('没有可保存的项目内容'); return; }
  saveRecordData();
  showToast('已保存到缓存（刷新页面后仍保留）');
}

// 自动保存：定期 / 切换项目 / 关闭前，静默同步并写入 localStorage
function recAutoSave(silent) {
  if (!recProjects.length) return false;
  const n = recProjectSyncLive();
  if (!n) return false;
  saveRecordData();
  return true;
}

// 项目文本 → { events, built }：优先取正在编辑的 DOM 内容，否则取缓存
function recProjectEventsOf(proj) {
  let text = '';
  const win = proj ? document.querySelector('#recProjectMulti .rec-proj-win[data-proj="' + recCssAttr(proj) + '"] .rec-proj-win-body') : null;
  const input = document.getElementById('recProjectInput');
  if (win) text = win.innerText || '';
  else if (input && !input.classList.contains('hidden')) text = input.innerText || '';
  else text = recProjectTexts[proj] || '';
  const events = recNormalizeEvents(recExtractStructuredEvents(text));
  return { text: text, events: events, built: recBuildTimelineOrder(events) };
}
function recProjectEventByEi(proj, ei) {
  const r = recProjectEventsOf(proj);
  const docIdx = r.built.order[ei];
  if (docIdx === undefined) return null;
  return r.events[docIdx] || null;
}
// 时间轴索引 → sortKey
function recProjectSortKeyMap(proj) {
  const r = recProjectEventsOf(proj);
  const map = [];
  r.built.order.forEach(function(docIdx, tlIdx) {
    map[tlIdx] = String(r.events[docIdx].sortKey || '');
  });
  return map;
}
// 段落首个日期链接对应的 sortKey
function recParaSortKey(p, map) {
  const link = p.querySelector('a.rec-tl-link[data-ei]');
  if (!link) return '';
  const ei = parseInt(link.getAttribute('data-ei'), 10);
  if (isNaN(ei)) return '';
  return map[ei] || '';
}

// 第63轮：正文不再有 <p>，改为按行（<br> 分界）组织；旧主题的 <p> 仍按独立行处理
function recBodyLines(box) {
  const lines = [[]];
  function walk(node) {
    Array.prototype.forEach.call(node.childNodes, function(n) {
      if (n.nodeType === 1 && n.tagName === 'BR') { lines.push([]); return; }
      if (n.nodeType === 1 && n.tagName === 'P') { walk(n); lines.push([]); return; }
      if (n.nodeType === 1 && n.querySelector && n.querySelector('br,p')) { walk(n); return; }
      lines[lines.length - 1].push(n);
    });
  }
  walk(box);
  return lines;
}
function recLineLinks(nodes) {
  const out = [];
  nodes.forEach(function(n) {
    if (n.nodeType !== 1) return;
    if (n.matches && n.matches('a.rec-tl-link[data-ei]')) out.push(n);
    if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll('a.rec-tl-link[data-ei]'), function(a) { out.push(a); });
  });
  return out;
}
function recLineSortKey(nodes, map) {
  const links = recLineLinks(nodes);
  for (let i = 0; i < links.length; i++) {
    const ei = parseInt(links[i].getAttribute('data-ei'), 10);
    if (!isNaN(ei) && map[ei]) return map[ei];
  }
  return '';
}

// 右键「自动排序」：把该日期所在行按时间顺序插到正确位置，再整体重排重新编号
function recProjectAutoSortLink(link) {
  if (!link) { showToast('未找到日期链接'); return; }
  const win = link.closest ? link.closest('.rec-proj-win') : null;
  const box = win ? win.querySelector('.rec-proj-win-body') : document.getElementById('recProjectInput');
  const proj = win ? (win.getAttribute('data-proj') || '') : recSingleProjectName();
  if (!box || !proj) return;
  const map = recProjectSortKeyMap(proj);
  const ei = parseInt(link.getAttribute('data-ei'), 10);
  const key = isNaN(ei) ? '' : map[ei];
  if (!key) { showToast('该段没有可排序的日期'); return; }
  const lines = recBodyLines(box);
  const cur = lines.findIndex(function(g) { return g.indexOf(link) >= 0; });
  if (cur < 0) { showToast('未找到所在段落'); return; }
  let target = -1;
  for (let i = 0; i < lines.length; i++) {
    if (i === cur) continue;
    const k = recLineSortKey(lines[i], map);
    if (k && k > key) { target = i; break; }
  }
  const at = target < 0 ? lines.length : (target > cur ? target - 1 : target);
  if (at === cur) { showToast('已在该时间位置'); return; }
  const texts = lines.map(function(g) { return g.map(function(n) { return n.textContent || ''; }).join(''); });
  const moved = texts.splice(cur, 1)[0];
  texts.splice(at, 0, moved);
  const res = recFormatProjectText(texts.join('\n'), proj);
  if (recWinIsMulti(win)) {
    recProjectTexts[proj] = res.text;
    recProjectHtmls[proj] = res.html;
    saveRecordData();
    recRenderProjWindows(recProjectVisibleList());
  } else {
    recProjectTexts[proj] = res.text;
    box.innerHTML = res.html;
    recProjectHtmls[proj] = res.html;
    saveRecordData();
  }
  recRenderTlColumn();
  showToast('已按时间自动排序');
}

// 第65轮：按现有 DOM 的块样式重建（保留已排版段落），只重新识别日期链接
function recProjectCollectBlocks(box) {
  const out = [];
  let buf = '';
  const flush = function() {
    if (buf.replace(/[\s\u3000\u2060]/g, '')) out.push({ text: buf, style: '', level: '', plain: true });
    buf = '';
  };
  Array.prototype.forEach.call(box.childNodes, function(n) {
    if (n.nodeType === 1 && n.tagName === 'BR') { flush(); return; }
    if (n.nodeType === 1 && /^(P|DIV|H1|H2|H3)$/.test(n.tagName)) {
      flush();
      out.push({ text: n.textContent || '', style: n.getAttribute('style') || '', level: n.getAttribute('data-level') || '', plain: !n.getAttribute('style') });
      return;
    }
    buf += n.textContent || '';
  });
  flush();
  return out;
}

function recProjectRenderBlocks(blocks, proj) {
  const text = blocks.map(function(b) { return b.text; }).join('\n');
  const events = recNormalizeEvents(recExtractStructuredEvents(text));
  const built = recBuildTimelineOrder(events);
  let ei = 0;
  const parts = [];
  blocks.forEach(function(b) {
    const res = recMarkAllDates(b.text, ei, events.length, built.timelineIndex, proj, events, !!b.plain, REC_LINK_COLOR);
    ei = res.ei;
    if (b.style) {
      parts.push('<p style="' + b.style + '"' + (b.level ? ' data-level="' + escapeHtml(b.level) + '"' : '') + '>' + res.html + '</p>');
    } else {
      parts.push(res.html + '<br>');
    }
  });
  return { html: parts.join(''), text: text, count: events.length };
}

function recProjectRerenderPreserve(box, proj) {
  if (!box) return null;
  const r = recProjectRenderBlocks(recProjectCollectBlocks(box), proj || recMiddleProjectName());
  box.innerHTML = r.html;
  if (proj) {
    recProjectTexts[proj] = r.text;
    recProjectHtmls[proj] = r.html;
  }
  saveRecordData();
  recRenderTlColumn();
  return r;
}

// 把一段纯文本按公文格式生成 <p> 片段（只用于粘入 / 选区）
function recProjectFormatFragmentHtml(text) {
  const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
  const items = [];
  lines.forEach(function(ln) { if (ln.trim()) items.push({ text: ln.replace(/[ \t]+$/, ''), blank: false }); });
  if (!items.length) return '';
  return recFormatItems(items).map(function(p) {
    return '<p style="' + p.style + '">' + escapeHtml(p.text) + '</p>';
  }).join('');
}

// 选区自动格式：只改选中的这段文字（段落级），返回是否处理了选区
function recProjectFormatRegion(box, proj) {
  if (!box) return false;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  if (!box.contains(range.commonAncestorContainer)) return false;
  const raw = range.toString();
  if (!raw.replace(/[\s\u3000]/g, '')) return false;
  const html = recProjectFormatFragmentHtml(raw);
  if (!html) return false;
  range.deleteContents();
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  range.insertNode(tpl.content);
  try { sel.removeAllRanges(); } catch (e) {}
  recProjectRerenderPreserve(box, proj);
  return true;
}

// 粘贴：去掉网页样式后插入纯文本，并立即按自动识别规则重排版
function recProjectInsertPlainText(box, text) {
  box.focus();
  let ok = false;
  try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
  if (!ok) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    } else {
      box.appendChild(document.createTextNode(text));
    }
  }
}
function recProjectFormatOne(proj, box) {
  const r = recProjectRerenderPreserve(box, proj);
  showToast(r && r.count ? '已粘贴并自动格式化（识别到 ' + r.count + ' 条事件）' : '已粘贴并自动格式化');
}
function recProjectHandlePaste(e) {
  if (!e.clipboardData) return;
  const dt = e.clipboardData;
  if (dt.files && dt.files.length) return;
  const text = dt.getData('text/plain');
  if (!text) return;
  e.preventDefault();
  const win = e.target.closest ? e.target.closest('.rec-proj-win') : null;
  const box = win ? win.querySelector('.rec-proj-win-body') : document.getElementById('recProjectInput');
  if (!box) return;
  const proj = win ? (win.getAttribute('data-proj') || '') : recSingleProjectName();
  if (!proj) return;
  // 第65轮：只把粘入的这段转成公文段落，已有内容的格式原样保留
  const sel0 = window.getSelection();
  let range = null;
  // 只有编辑框真正获得焦点时才按光标插入；否则追加到末尾（避免旧选区把内容插到开头）
  if (document.activeElement === box && sel0 && sel0.rangeCount && box.contains(sel0.getRangeAt(0).commonAncestorContainer)) range = sel0.getRangeAt(0);
  const html = recProjectFormatFragmentHtml(text);
  if (range) {
    range.deleteContents();
    if (html) {
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      range.insertNode(tpl.content);
    }
  } else {
    box.insertAdjacentHTML('beforeend', html);
  }
  const r = recProjectRerenderPreserve(box, proj);
  showToast(r && r.count ? '已粘贴并自动格式化（识别到 ' + r.count + ' 条事件）' : '已粘贴并自动格式化');
}
function recProjectBindPaste() {
  const input = document.getElementById('recProjectInput');
  if (input && !input.__daPasteBound) {
    input.__daPasteBound = true;
    input.addEventListener('paste', recProjectHandlePaste);
  }
  const multi = document.getElementById('recProjectMulti');
  if (multi && !multi.__daPasteBound) {
    multi.__daPasteBound = true;
    multi.addEventListener('paste', recProjectHandlePaste);
  }
}

// 自动识别：读取编辑框当前内容，整理格式并把日期加超链接（多窗口时处理全部窗口）
function recProjectAutoRecognize() {
  const input = document.getElementById('recProjectInput');
  if (!input) return;
  const name = recMiddleProjectName();
  if (!name) return;
  // 第65轮：有选区时只格式化选区（Ctrl+Shift+E 同此路径）
  if (recProjectFormatRegion(input, name)) {
    showToast('已按公文格式排版选区');
    return;
  }
  const res = recFormatProjectPublish(input.innerText || '', name);
  if (!res.text) { showToast('内容为空，无法识别'); return; }
  recProjectTexts[name] = res.text;
  input.innerHTML = res.html;
  recProjectHtmls[name] = res.html;
  recRenderTlColumn();
  saveRecordData();
  showToast(res.count ? '已自动识别 ' + res.count + ' 条事件' : '已整理格式（未识别到事件）');
}

// ---- 事件提取（参照 多维事件分析 笔记模块 ExtractStructuredEvents 逻辑/规则）----
function recExtractStructuredEvents(text) {
  function pad(n) { n = parseInt(n, 10); if (isNaN(n)) return n; return n < 10 ? '0' + n : '' + n; }
  function escHtml(s) { return escapeHtml(s); }
  var results = [];
  var lines = String(text || '').split(/\r?\n/);
  // 规则1：履历行（如 2026.08-2026.12、2026.08.03 单一日期）
  var resumePattern = /^\d{4}[.\-]\d{1,2}/;
  var hasResumeLine = false;
  for (var ci = 0; ci < lines.length; ci++) { if (resumePattern.test(lines[ci].trim())) { hasResumeLine = true; break; } }
  if (hasResumeLine) {
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (recHasNoDateMark(line)) continue;
      var resumeM = line.match(/^(\d{4})[.\-](\d{1,2})(?:[.\-](\d{1,2}))?\s*[-–—~至]\s*(\d{4})[.\-](\d{1,2})(?:[.\-](\d{1,2}))?\s*(?:[（(][^）)]*[）)])?\s*/);
      var singleM = null;
      if (!resumeM) singleM = line.match(/^(\d{4})[.\-](\d{1,2})(?:[.\-](\d{1,2}))?\s*/);
      if (resumeM || singleM) {
        var m = resumeM || singleM;
        var y1 = m[1], mo1 = m[2], d1 = m[3];
        var sortKey = y1 + '.' + (parseInt(mo1) < 10 ? '0' : '') + parseInt(mo1) + '.' + (d1 ? (parseInt(d1) < 10 ? '0' : '') + parseInt(d1) : '01');
        var displayTime = '';
        if (resumeM) {
          var startPart = y1 + '.' + (parseInt(mo1) < 10 ? '0' : '') + parseInt(mo1);
          if (d1) startPart += '.' + (parseInt(d1) < 10 ? '0' : '') + parseInt(d1);
          var endPart = m[4] + '.' + (parseInt(m[5]) < 10 ? '0' : '') + parseInt(m[5]);
          if (m[6]) endPart += '.' + (parseInt(m[6]) < 10 ? '0' : '') + parseInt(m[6]);
          displayTime = startPart + '（' + startPart + '-' + endPart + '）';
        } else {
          var sp = y1 + '.' + (parseInt(mo1) < 10 ? '0' : '') + parseInt(mo1);
          if (d1) sp += '.' + (parseInt(d1) < 10 ? '0' : '') + parseInt(d1);
          displayTime = sp + '（' + sp + '）';
        }
        var rest = line.substring(m[0].length);
        var durM = rest.match(/^[（(][^）)]*[）)]\s*/);
        if (durM) rest = rest.substring(durM[0].length);
        rest = rest.trim();
        var remarks = [];
        var bracketRegex = /【([\s\S]*?)】/g;
        var bMatch;
        while ((bMatch = bracketRegex.exec(rest)) !== null) remarks.push(bMatch[1]);
        rest = rest.replace(/【[\s\S]*?】/g, '').trim();
        results.push({ time: displayTime, content: rest, remark: remarks.join('\n'), sortKey: sortKey });
      }
    }
    if (results.length > 0) return results;
  }
  // 规则2：仅年份行（如 2026  xxxx）
  var yearOnlyPattern = /^\d{4}\s{2,}/;
  var hasYearOnlyLine = false;
  for (var cy = 0; cy < lines.length; cy++) { if (yearOnlyPattern.test(lines[cy].trim())) { hasYearOnlyLine = true; break; } }
  if (hasYearOnlyLine) {
    var yearOnlyResults = [];
    for (var yi = 0; yi < lines.length; yi++) {
      var yline = lines[yi].trim();
      if (!yline) continue;
      if (recHasNoDateMark(yline)) continue;
      var yearMatch = yline.match(/^(\d{4})\s{2,}([\s\S]*)/);
      if (yearMatch) {
        var yr = yearMatch[1];
        var yrest = yearMatch[2].trim();
        var remarkY = '';
        var rMatch = yrest.match(/【([\s\S]*?)】/);
        if (rMatch) { remarkY = rMatch[1]; yrest = yrest.replace(/【[\s\S]*?】/g, '').trim(); }
        yearOnlyResults.push({ time: yr + '.01（' + yr + '）', content: yrest, remark: remarkY, sortKey: yr + '.01.01' });
      }
    }
    if (yearOnlyResults.length > 0) return yearOnlyResults;
  }
  // 规则3：结构化「时间：/内容：/备注：」
  var currentGroup = null;
  for (var gi = 0; gi < lines.length; gi++) {
    var gline = lines[gi].trim();
    if (!gline) {
      if (currentGroup && currentGroup.time) {
        if (!currentGroup.content) currentGroup.content = '';
        if (!currentGroup.remark) currentGroup.remark = '';
        results.push(currentGroup);
        currentGroup = null;
      }
      continue;
    }
    var noDateLine = recHasNoDateMark(gline);
    if (noDateLine) gline = recStripNoDateMark(gline);
    var tm = noDateLine ? null : gline.match(/^时间[：:]\s*([\s\S]*)/);
    var cm = gline.match(/^(?:内容|事件)[：:]\s*([\s\S]*)/);
    var rm = gline.match(/^备注[：:]\s*([\s\S]*)/);
    if (tm) {
      if (currentGroup && currentGroup.time) {
        if (!currentGroup.content) currentGroup.content = '';
        if (!currentGroup.remark) currentGroup.remark = '';
        results.push(currentGroup);
      }
      currentGroup = { time: tm[1].trim(), content: '', remark: '', sortKey: '' };
      var sortM = currentGroup.time.match(/(\d{4})[.\-年](\d{1,2})[.\-月]?(\d{1,2})?[.\-日]?\s*(\d{1,2})?[时:]?(\d{1,2})?[分:]?/);
      if (sortM) {
        currentGroup.sortKey = sortM[1] + '.' + (sortM[2] ? (parseInt(sortM[2]) < 10 ? '0' : '') + parseInt(sortM[2]) : '01') + '.' + (sortM[3] ? (parseInt(sortM[3]) < 10 ? '0' : '') + parseInt(sortM[3]) : '01');
        if (sortM[4]) currentGroup.sortKey += ' ' + (parseInt(sortM[4]) < 10 ? '0' : '') + parseInt(sortM[4]) + ':' + (sortM[5] ? (parseInt(sortM[5]) < 10 ? '0' : '') + parseInt(sortM[5]) : '00');
      }
    } else if (cm && currentGroup) {
      currentGroup.content = cm[1].trim();
    } else if (rm && currentGroup) {
      currentGroup.remark = rm[1].trim();
    } else if (currentGroup) {
      if (!currentGroup.content) currentGroup.content = gline;
      else currentGroup.content += ' ' + gline;
    }
  }
  if (currentGroup && currentGroup.time) {
    if (!currentGroup.content) currentGroup.content = '';
    if (!currentGroup.remark) currentGroup.remark = '';
    results.push(currentGroup);
  }
  // 规则4：兜底——按句切分，识别行内时间词（年/月/日/时/点/分/上午/下午…），上下文标准化
  if (results.length === 0) {
    function SplitTextToSegments(text) {
      var segments = [], buffer = '';
      for (var si = 0; si < text.length; si++) {
        var ch = text[si];
        if ('。；\n\r\v'.indexOf(ch) !== -1) {
          buffer += ch;
          if (buffer.trim() || /[\r\n]/.test(buffer)) segments.push(buffer);
          buffer = '';
        } else { buffer += ch; }
      }
      if (buffer.trim()) segments.push(buffer);
      return segments;
    }
    function IsValidTimeToken(token) {
      if (!token) return false;
      var keywords = ['年', '月', '日', '时', '点', '分', '当', '次', '同', '第', '上午', '下午', '中午', '晚上', '早上'];
      var hasKeyword = false;
      for (var k = 0; k < keywords.length; k++) { if (token.indexOf(keywords[k]) !== -1) { hasKeyword = true; break; } }
      if (/^[（(]\d{4}\.\d{1,2}(?:\.\d{1,2})?[）)]$/.test(token)) return true;
      if (/^\d{4}\s*年\s*\d{1,2}\s*月?\s*(?:至|—|-|~)\s*\d{1,2}(?:月|日)$/.test(token)) return true;
      // 季度与季度范围：一季度 / 一至二季度 / 一、二季度 / 第一至第二季度（无年份前缀时也需识别）
      if (/季度/.test(token)) return true;
      if (/^第?[一二三四1-4](?:季度)?\s*(?:[至—–~－\-到]|[、,])\s*第?[一二三四1-4]季度$/.test(token)) return true;
      if (!hasKeyword) return false;
      if (token === '同步') return false;
      return true;
    }
    function StandardizeTime(rawStr, ctx) {
      var hasDay = false, hasTime = false;
      // 模糊/起止时段（6月上旬、6月至7月、25日至27日 等）：解析起止，标准时间用起始日
      var perTok = matchPeriodTokenAtStart(rawStr);
      if (perTok && perTok === String(rawStr).trim()) {
        var pp = parsePeriodToken(perTok, ctx.year || 2026, ctx.month || 1);
        if (pp) {
          ctx.year = pp.year; ctx.month = pp.sm; ctx.day = pp.sd;
          return { str: periodStartKey(pp) + '（' + perTok + '）', sortKey: periodStartKey(pp) };
        }
      }
      var rangeMatch = rawStr.match(/(\d{4})\s*年\s*(\d{1,2})\s*月?\s*(?:至|—|-|~)\s*\d{1,2}(?:月|日)/);
      if (rangeMatch) { var y = rangeMatch[1], m = pad(rangeMatch[2]); return { str: y + '.' + m + '（' + rawStr + '）', sortKey: y + '.' + m + '.01' }; }
      var bracketMatch = rawStr.match(/[（(](\d{4})\.(\d{1,2})(?:\.(\d{1,2}))?[）)]/);
      if (bracketMatch) {
        var by = bracketMatch[1], bm = pad(bracketMatch[2]), bd = '';
        var bsortKey = '';
        if (bracketMatch[3]) { bd = '.' + pad(bracketMatch[3]); bsortKey = by + '.' + bm + bd; } else { bsortKey = by + '.' + bm + '.01'; }
        return { str: by + '.' + bm + bd + '（——）', sortKey: bsortKey };
      }
      var mt = rawStr.match(/(\d{4})年/); if (mt) ctx.year = parseInt(mt[1]);
      mt = rawStr.match(/(\d{1,2})月/); if (mt) ctx.month = parseInt(mt[1]);
      mt = rawStr.match(/(\d{1,2})日/); if (mt) ctx.day = parseInt(mt[1]), hasDay = true;
      if (rawStr.match(/次年/)) { ctx.year++; ctx.month = 1; ctx.day = 1; hasDay = true; }
      else if (rawStr.match(/次月/)) { ctx.month++; if (ctx.month > 12) { ctx.month = 1; ctx.year++; } ctx.day = 1; hasDay = true; }
      else if (rawStr.match(/次日|第二[日天]/)) {
        var dim = new Date(ctx.year, ctx.month, 0).getDate();
        ctx.day++; if (ctx.day > dim) { ctx.day = 1; ctx.month++; if (ctx.month > 12) { ctx.month = 1; ctx.year++; } } hasDay = true;
      } else if (rawStr.match(/当日|同日|当天/)) { hasDay = true; }
      mt = rawStr.match(/(\d{1,2})[时点](\d{1,2})分?(?:左右|前|后)?/);
      if (mt) { ctx.hour = parseInt(mt[1]); ctx.minute = parseInt(mt[2]); hasTime = true; }
      else { mt = rawStr.match(/(\d{1,2})[时点](?:左右|前|后)?/); if (mt) { ctx.hour = parseInt(mt[1]); ctx.minute = 0; hasTime = true; } }
      var stdPart = '', sortKey = '';
      if (ctx.year && ctx.month) {
        if (hasDay) { stdPart = ctx.year + '.' + pad(ctx.month) + '.' + pad(ctx.day); sortKey = stdPart; if (hasTime) stdPart += ' ' + pad(ctx.hour) + ':' + pad(ctx.minute); }
        else { stdPart = ctx.year + '.' + pad(ctx.month); sortKey = stdPart + '.01'; }
      }
      return { str: stdPart + '（' + rawStr + '）', sortKey: sortKey };
    }
    var ctx = { year: 2026, month: 1, day: 1, hour: 0, minute: 0 };
    // 单段文本 → 事件（自带日期前缀才算）；主分支与「续行里又出现新日期」共用
    function tryDateSeg(workSeg) {
      var perTok = matchPeriodTokenAtStart(workSeg);
      var timeMatch = perTok ? [perTok] : workSeg.match(/^((\d{4}\s*年\s*\d{1,2}\s*月?\s*(?:至|—|-|~)\s*\d{1,2}(?:月|日))|(?:[（(]\d{4}\.\d{1,2}(?:\.\d{1,2})?[）)])|(?:当日|同日|当天|次日|第二[日天]|次月|次年)|(?:\d{4}年)?(?:\d{1,2}月)?(?:\d{1,2}日)?(?:\s*\d{1,2}[时点](?:\d{1,2}分?)?(?:左右|前|后)?|上午|下午|中午|晚上|早上)?(?:以来|以后|之前|之后|左右|至今|前后|过后)?)/);
      if (!timeMatch || !IsValidTimeToken(timeMatch[0])) return null;
      var rawTime = timeMatch[0];
      var eventContent = workSeg.substring(rawTime.length).trim();
      // 自定义显示时间：「2008年4月（2008年夏天某一天）」→ 排序按 2008年4月，显示只用括号内文字
      var customLabel = '';
      var cusM = eventContent.match(/^[（(]([^）)]+)[）)]\s*/);
      if (cusM) { customLabel = cusM[1].trim(); eventContent = eventContent.substring(cusM[0].length).trim(); }
      if (eventContent.indexOf('至') === 0) {
        var endIdx = eventContent.indexOf('日'); if (endIdx === -1) endIdx = eventContent.indexOf('月');
        if (endIdx !== -1) { rawTime += eventContent.substring(0, endIdx + 1); eventContent = eventContent.substring(endIdx + 1).trim(); }
      }
      if (/^[，,、：:]/.test(eventContent)) eventContent = eventContent.substring(1).trim();
      var stdResult = StandardizeTime(rawTime, ctx);
      if (customLabel) {
        var stdBase = String(stdResult.str || '').replace(/[（(][^）)]*[）)]\s*$/, '');
        stdResult = { str: stdBase + '（' + customLabel + '）', sortKey: stdResult.sortKey };
      }
      var remark = '';
      var remarkMatch = eventContent.match(/【(.*?)】/);
      if (remarkMatch) { remark = remarkMatch[1]; eventContent = eventContent.replace(remarkMatch[0], '').trim(); }
      return { time: stdResult.str, sortKey: stdResult.sortKey, content: eventContent, remark: remark };
    }
    var segments = SplitTextToSegments(text);
    var stopAppending = false;
    for (var sgi = 0; sgi < segments.length; sgi++) {
      var seg = segments[sgi]; if (!seg) continue;
      if (recHasNoDateMark(seg)) { stopAppending = true; continue; }
      var evNew = tryDateSeg(seg.trim());
      if (evNew) { stopAppending = false; results.push(evNew); continue; }
      // 独立成行的【】备注 → 上一条事件的备注
      var rmLine = seg.match(/^\s*【([\s\S]*?)】\s*$/);
      if (rmLine && results.length > 0) {
        var lastEv = results[results.length - 1];
        lastEv.remark = lastEv.remark ? (lastEv.remark + '\n' + rmLine[1]) : rmLine[1];
        if (/[\r\n]/.test(seg)) stopAppending = true;
        continue;
      }
      // 续行：先摘出【】备注，再判断剩余文字是否自带日期（自带则另起一条）
      var rest = String(seg);
      if (results.length > 0) {
        var tailRm = rest.match(/【([\s\S]*?)】/);
        if (tailRm) {
          var last0 = results[results.length - 1];
          last0.remark = last0.remark ? (last0.remark + '\n' + tailRm[1]) : tailRm[1];
          rest = rest.replace(/【[\s\S]*?】/g, '');
        }
      }
      if (rest.trim()) {
        var evRest = tryDateSeg(rest.trim());
        if (evRest) { results.push(evRest); stopAppending = false; continue; }
        if (results.length > 0 && !stopAppending) results[results.length - 1].content += rest;
      }
      if (/[\r\n]/.test(seg)) stopAppending = true;
    }
  }
  return results;
}

// 给左侧编辑框文字加上时间标记（标记对应时间轴条目），点击标记定位到时间轴
function recJumpToTimeline(el) {
  const ei = parseInt(el.getAttribute('data-ei'), 10);
  if (isNaN(ei)) return;
  const win = el.closest ? el.closest('.rec-proj-win') : null;
  if (recTlView !== 'v') {
    const proj = win ? (win.getAttribute('data-proj') || '') : recSingleProjectName();
    if (proj) recSituJumpToEvent(proj, ei);
    return;
  }
  if (recWinIsMulti(win)) {
    const proj = win.getAttribute('data-proj') || '';
    const item = document.querySelector('#recProjectTimeline .rec-mtl-item[data-proj="' + recCssAttr(proj) + '"][data-ti="' + ei + '"]');
    if (item) {
      const box = document.getElementById('recProjectTimeline');
      if (box) box.querySelectorAll('.rec-mtl-item.rec-mtl-active').forEach(function(n) { n.classList.remove('rec-mtl-active'); });
      item.classList.add('rec-mtl-active');
      item.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return;
  }
  recActivateTimelineItem(ei, false);
}

// 项目内容 → 横向分布：点击日期标记，横向图滚动到该事件并选中事件块
function recSituJumpToEvent(proj, ti) {
  const c = document.getElementById('situChartContainer');
  if (!c) return;
  if (c.classList.contains('hidden')) recSetTlView('h');
  const sel = '.situ-event[data-proj="' + recCssAttr(proj) + '"][data-ti="' + ti + '"]';
  let el = c.querySelector(sel);
  if (!el) { recRenderSituChart(); el = c.querySelector(sel); }
  if (!el) { showToast('横向分布中没有找到该事件'); return; }
  const key = el.getAttribute('data-event-key') || '';
  if (!key) return;
  const changed = recSituAlignEventKey !== key || recSituTopEventKey !== key;
  if (changed) {
    recSituTopEventKey = key;
    recSituAlignDi = parseInt(el.getAttribute('data-di'), 10);
    recSituAlignEventKey = key;
    recSituAlignColor = el.getAttribute('data-event-color') || '#5a5a5a';
    recSituAlignBorder = el.getAttribute('data-event-border') || '#5a5a5a';
    recSituAlignLeft = parseFloat(el.getAttribute('data-event-left')) || 0;
    recSituAlignWidth = Math.max(1, parseFloat(el.getAttribute('data-event-width')) || recSituEventW);
    recRenderSituChart();
    el = c.querySelector(sel) || el;
  }
  const bar = document.getElementById('situDetailBar');
  if (bar) bar.textContent = el.getAttribute('data-tip') || '';
  situScrollTo(el, c);
  el.classList.add('flash');
  setTimeout(function() { el.classList.remove('flash'); }, 900);
}
function situScrollTo(el, c) {
  const cr = c.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const labelW = (c.querySelector('.situ-track-label') || { getBoundingClientRect: function() { return { width: 0 }; } }).getBoundingClientRect().width;
  const left = c.scrollLeft + (r.left - cr.left) - labelW - Math.max(0, (c.clientWidth - labelW - r.width) / 2);
  const top = c.scrollTop + (r.top - cr.top) - Math.max(40, (c.clientHeight - r.height) / 2);
  if (c.scrollTo) {
    c.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior: 'smooth' });
  } else {
    c.scrollLeft = Math.max(0, left);
    c.scrollTop = Math.max(0, top);
  }
}

// 高亮右侧时间轴条目（1px 深蓝框 + 4px 间隔），并可选闪亮左侧对应日期
function recActivateTimelineItem(ei, flashLeft) {
  const box = document.getElementById('recProjectTimeline');
  if (box) box.querySelectorAll('.rec-tl-item.active, .rec-mtl-item.rec-mtl-active').forEach(function(n) { n.classList.remove('active', 'rec-mtl-active'); });
  let item = document.getElementById('recTlItem' + ei);
  if (!item) {
    const proj = recSingleProjectName();
    item = box ? box.querySelector('.rec-mtl-item[data-proj="' + recCssAttr(proj) + '"][data-ti="' + ei + '"]') : null;
  }
  if (item) {
    item.classList.add(item.classList.contains('rec-mtl-item') ? 'rec-mtl-active' : 'active');
    item.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  if (flashLeft !== false) recFlashLink(ei);
}

function recClearTimelineActive() {
  const box = document.getElementById('recProjectTimeline');
  if (box) box.querySelectorAll('.rec-tl-item.active, .rec-mtl-item.rec-mtl-active').forEach(function(n) { n.classList.remove('active', 'rec-mtl-active'); });
}

// 左侧内容里对应的日期高亮闪烁一下并滚入视野
function recFlashLink(ei) {
  const link = document.querySelector('#recProjectInput a.rec-tl-link[data-ei="' + ei + '"]');
  if (!link) return;
  link.scrollIntoView({ block: 'center', behavior: 'smooth' });
  link.classList.add('flash');
  setTimeout(function(){ link.classList.remove('flash'); }, 900);
}

function recDateKeyOf(sk) {
  const m = String(sk || '').match(/^(\d{4})\.(\d{2})/);
  return m ? m[1] + '.' + m[2] : '';
}
function recDateLabelOf(sk) {
  const m = String(sk || '').match(/^(\d{4})\.(\d{2})(?:\.(\d{2}))?/);
  if (!m) return '';
  let s = m[1] + '年' + parseInt(m[2], 10) + '月';
  if (m[3]) s += parseInt(m[3], 10) + '日';
  return s;
}

// 右侧时间轴：自上而下，按日期分组（红点+竖线），参照电子记事本「以页面文字样式显示日志」；
// 事件按 sortKey 由远至近排序；日期行左侧显示原文日期、右侧显示深灰宋体小一号的标准时间
function recRenderProjectTimeline() {
  recAttachBindContext();
  const c = document.getElementById('recProjectTimeline');
  if (!c) return;
  const list = recProjectVisibleList();
  if (!list.length) {
    c.innerHTML = '<div class="rec-tl-empty">粘贴内容后，此处自动生成时间轴事件</div>';
    return;
  }
  const input = document.getElementById('recProjectInput');
  const midProj = recMiddleProjectName();
  const textOf = function(name) {
    if (name === midProj && input && !input.classList.contains('hidden')) return input.innerText || '';
    return recProjectTexts[name] || '';
  };
  recRenderProjectTimelineMerged(c, list, textOf);
}

// 右侧时间轴（单项目 / 多项目统一为合并样式）：各项目事件按时间合并在一起，
// 每项带所属项目色系的浅色背景 + 左侧色条；点击定位到中部对应窗口内容。
function recRenderProjectTimelineMerged(c, list, textOf) {
  if (!textOf) textOf = function(name) { return recProjectTexts[name] || ''; };
  const all = [];
  list.forEach(function(name) {
    const evs = recNormalizeEvents(recExtractStructuredEvents(textOf(name)));
    const built = recBuildTimelineOrder(evs);
    const color = recProjColor(name);
    evs.forEach(function(ev, docIdx) {
      all.push({ name: name, ev: ev, ti: built.timelineIndex[docIdx], color: color, sortKey: String(ev.sortKey || '') });
    });
  });
  const dir = recTimelineSort === 'desc' ? -1 : 1;
  all.sort(function(a, b) {
    if (a.sortKey < b.sortKey) return -1 * dir;
    if (a.sortKey > b.sortKey) return 1 * dir;
    return 0;
  });
  const curMatch = recSearchMatches[recSearchIndex] || null;
  const curSig = curMatch ? recSearchSignature(curMatch.project, curMatch.event) : '';
  const rows = all.filter(function(item) {
    return !recSearchOnly || recSearchHits(item.name, item.ev).length;
  });
  if (!rows.length) {
    c.innerHTML = '<div class="rec-tl-empty">' +
      (recSearchOnly && recSearchQuery.trim() ? '没有匹配的事件' : '所选项目暂无事件') + '</div>';
    return;
  }
  function ymOf(item) {
    const d = situParseDate(item.ev.sortKey);
    return d ? (d.y + '年' + d.m + '月') : '';
  }
  let html = '<div class="rec-mtl"><div class="situ-tl-sheet">';
  let lastYM = '';
  rows.forEach(function(item, idx) {
    const ev = item.ev;
    const ym = ymOf(item);
    if (ym && ym !== lastYM) {
      html += '<div class="situ-tl-m-head"><div class="situ-tl-m-dot"></div><div class="situ-tl-m-label">' + escapeHtml(ym) + '</div></div>';
      lastYM = ym;
    }
    let dateText = '';
    if (ev.time) { const tt = splitEvTime(ev.time); dateText = tt.orig || ev.time; }
    const tint = situColorAlpha(item.color, 0.18);
    const _mac = recEventAttachCount(item.name, ev);
    const hits = recSearchHits(item.name, ev);
    const isCur = !!curSig && recSearchSignature(item.name, ev) === curSig;
    html += '<div class="situ-tl-m-item rec-mtl-item' + (_mac ? ' rec-mtl-item-has-attach' : '') + (isCur ? ' rec-search-current' : '') + '" data-proj="' + escapeHtml(item.name) + '" data-ti="' + item.ti + '"' +
      ' style="--pc:' + escapeHtml(item.color) + ';background:' + escapeHtml(tint) + ';box-shadow:inset 4px 0 0 0 ' + escapeHtml(item.color) + ';cursor:pointer;"' +
      ' onclick="recMtlJump(this)" title="点击定位到中部「' + escapeHtml(item.name) + '」窗口对应内容">';
    html += '<div class="situ-tl-item-body">';
    html += '<div class="situ-tl-item-date" style="color:' + escapeHtml(item.color) + '"><span>' + hlCellText(dateText, hits) + '</span>' +
      (_mac ? '<span class="situ-tl-item-attach" title="查看附件（' + _mac + ' 项）" onclick="event.stopPropagation();recMtlAttachOpen(this)">附件' + _mac + '个</span>' : '') +
      '<span class="situ-tl-item-project" style="color:' + escapeHtml(item.color) + '">' + hlCellText('「' + item.name + '」', hits) + '</span></div>';
    if (ev.content) html += '<div class="situ-tl-item-content">' + hlCellText(ev.content, hits) + '</div>';
    if (ev.remark) html += '<div class="situ-tl-item-note">' + hlCellText(ev.remark, hits) + '</div>';
    html += '</div></div>';
    const nextYM = idx + 1 < rows.length ? ymOf(rows[idx + 1]) : '';
    html += '<div class="situ-tl-divider ' + (nextYM === ym ? 'situ-tl-divider-inner' : 'situ-tl-divider-month') + '"></div>';
  });
  html += '</div></div>';
  c.innerHTML = html;
}

// ---- 保存主题到「数据」文件夹内的 js 文件 ----
function recNowStamp() {
  const d = new Date();
  function p(n) { return n < 10 ? '0' + n : '' + n; }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function recDottedToDash(k) {
  const m = String(k || '').match(/^(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})$/);
  if (!m) return '';
  function p(n) { n = parseInt(n, 10); return n < 10 ? '0' + n : '' + n; }
  return m[1] + '-' + p(m[2]) + '-' + p(m[3]);
}
// 由当前编辑内容反向生成主题 js 的 events（name 采用「日期,正文」原格式）
function recThemeEventsForSave(name) {
  const raw = String(recProjectTexts[name] || '');
  if (!raw.trim()) return [];
  const events = recNormalizeEvents(recExtractStructuredEvents(raw));
  return events.map(function(ev) {
    const tm = String(ev.time || '').match(/[（(]([^（）()]*)[）)]\s*$/);
    const token = tm ? tm[1] : String(ev.time || '').split('（')[0];
    const content = String(ev.content || '').replace(/\s*\n\s*/g, ' ').trim();
    const item = { name: (token ? token + ',' : '') + content };
    item.start = recDottedToDash(ev.startKey || ev.sortKey);
    item.end = recDottedToDash(ev.endKey) || item.start;
    item.description = String(ev.remark || '').replace(/\s*\n\s*/g, ' ').trim();
    item.showTime = token || '';
    return item;
  });
}
function recBuildThemeContent() {
  const theme = String(recDataSelFile || '').replace(/\.js$/i, '') || recThemeName;
  const tracks = recProjects.map(function(name) {
    const meta = recThemeTrackMeta[name] || {};
    const t = { name: name, color: meta.color || '' };
    const at = recProjectAttachments[name];
    if (at && Object.keys(at).length) t.attachments = at;
    t.events = recThemeEventsForSave(name);
    // 原文一并保存：无法识别成日期事件的行（无日期的说明、备注等）也必须原样保留
    const rawText = String(recProjectTexts[name] || '');
    if (rawText.trim()) t.text = rawText;
    // 第68轮：排版结果（文字/段落/层级）整段存进主题文件，刷新或重新读取主题后不被重渲染冲掉
    const rawHtml = String(recProjectHtmls[name] || '');
    if (rawHtml.trim()) { t.html = rawHtml; t.htmlVer = REC_RENDER_VER; }
    return t;
  });
  return '// 多维分析 · 主题数据\n// 主题：' + theme + '\n// 保存：' + recNowStamp() + '\n\nDaRegisterTheme(' + JSON.stringify({ theme: theme, tracks: tracks }, null, 2) + ');\n';
}
function recSaveThemeJs() {
  if (!recDataSelFile) { showToast('请先在「数据管理」双击读取一个主题'); return; }
  const fileName = recDataSelFile;
  recProjectSyncLive();
  const content = recBuildThemeContent();
  recDataApi('write', { path: recDataDiskPath('theme', fileName), content: content }).then(function(res) {
    if (res && res.ok !== false) {
      showToast('保存成功：' + fileName);
      if (typeof window.__ftRefreshTheme === 'function') window.__ftRefreshTheme();
      if (typeof recDataRefreshAfterWrite === 'function') recDataRefreshAfterWrite();
      return;
    }
    // 写盘失败：先把内容落到本地缓存，再让用户选择文件覆盖保存
    saveRecordData();
    const why = (res && res.error) ? res.error : '本地服务未连接';
    showToast('未能写入文件（' + why + '），已保存到缓存，请选择文件覆盖保存');
    recSaveContentToPickedFile(content, fileName, 'theme');
  });
}

// 无法经本地服务写盘时的兜底：打开系统「保存」对话框，让用户选择文件覆盖保存
// 优先 File System Access API（离线可用），不可用时退化为下载 js 文件
function recSaveContentToPickedFile(content, fileName, dirKind) {
  const name = fileName || '主题.js';
  const done = function() {
    showToast('已保存（覆盖）：' + name);
    if (typeof window.__ftRefreshTheme === 'function') window.__ftRefreshTheme();
    if (typeof recDataRefreshAfterWrite === 'function') recDataRefreshAfterWrite();
  };
  if (typeof window.showSaveFilePicker === 'function') {
    window.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: '主题数据', accept: { 'text/javascript': ['.js'] } }]
    }).then(function(handle) {
      return handle.createWritable().then(function(w) {
        return w.write(content).then(function() { return w.close(); });
      });
    }).then(done).catch(function(err) {
      if (err && err.name === 'AbortError') { showToast('已取消保存，内容仍保留在缓存中'); return; }
      recDownloadJs(name, content);
      showToast('已导出 ' + name + '，请用它覆盖「' + (dirKind === 'rel' ? '数据/人物关系' : '数据/项目信息') + '」中的同名文件');
    });
    return;
  }
  recDownloadJs(name, content);
  showToast('已导出 ' + name + '，请用它覆盖「' + (dirKind === 'rel' ? '数据/人物关系' : '数据/项目信息') + '」中的同名文件');
}
// ---- 事件附件（图片 / 文件·文件夹链接）----
let recAttachTarget = null;
let recAttachDraft = null;
let recPathWaitBlur = false;
let recAttachViewImages = [];
let recAttachViewLinks = [];
let recLbItems = [], recLbIndex = 0, recLbScaleV = 1, recLbX = 0, recLbY = 0;

function recEventLocator(ev) {
  if (!ev) return '';
  if (ev.id) return 'id:' + ev.id;
  return 'd:' + String(ev.sortKey || '') + '\u0001' + String(ev.time || '');
}
function recCurrentEventsParsed() {
  const input = document.getElementById('recProjectInput');
  const text = input ? (input.innerText || '') : (recProjectTexts[recCurrentProject] || '');
  return recNormalizeEvents(recExtractStructuredEvents(text));
}
function recCurrentEventByEi(ei) {
  const events = recCurrentEventsParsed();
  const built = recBuildTimelineOrder(events);
  const docIdx = built.order[ei];
  if (docIdx === undefined) return null;
  return events[docIdx] || null;
}
function recEventAttach(proj, key, create) {
  if (!proj || !key) return null;
  if (!recProjectAttachments[proj]) { if (!create) return null; recProjectAttachments[proj] = {}; }
  const map = recProjectAttachments[proj];
  if (!map[key]) { if (!create) return null; map[key] = { images: [], links: [] }; }
  const b = map[key];
  if (!b.images) b.images = [];
  if (!b.links) b.links = [];
  return b;
}
function recEventAttachCount(proj, ev) {
  const b = recEventAttach(proj, recEventLocator(ev), false);
  if (!b) return 0;
  return (b.images ? b.images.length : 0) + (b.links ? b.links.length : 0);
}
function recAttachInText(ev) {
  if (!ev) return '';
  const head = ev.start ? String(ev.start) + ' ' : '';
  let body = String(ev.name || '') + ' ' + String(ev.content || '').replace(/\n/g, ' ');
  body = body.replace(/\s+/g, ' ').trim();
  if (body.length > 46) body = body.slice(0, 46) + '…';
  return (head + body).trim();
}
function recAttachIsDir(p) {
  const str = String(p || '');
  if (/[\\/]+$/.test(str)) return true;
  return !/\.[A-Za-z0-9]{1,6}$/.test(str);
}
function recAttachKind(l) {
  return recAttachLinkKind(l);
}
function recAttachLinkKind(l) {
  if (l && l.type === 'dir') return '文件夹';
  if (l && l.type === 'file') return '文件';
  return recAttachIsDir(l && l.path) ? '文件夹' : '文件';
}
function recAttachFindLink(node) {
  let el = node;
  while (el && el !== document) {
    if (el.tagName === 'A' && el.classList && el.classList.contains('rec-tl-link')) return el;
    el = el.parentNode;
  }
  return null;
}
function recAttachFindNoDate(node) {
  let el = node;
  while (el && el !== document) {
    if (el.classList && el.classList.contains('rec-tl-nodate')) return el;
    el = el.parentNode;
  }
  return null;
}
function recNoDateTargetBox(node) {
  const win = node && node.closest ? node.closest('.rec-proj-win') : null;
  if (win) return { box: win.querySelector('.rec-proj-win-body'), win: win, proj: win.getAttribute('data-proj') || '' };
  const input = document.getElementById('recProjectInput');
  return { box: input, win: null, proj: recSingleProjectName() };
}
function recNoDateRerender(ctx) {
  const box = ctx && ctx.box;
  if (!box) return;
  recProjectRerenderPreserve(box, ctx.proj);
}
function recCancelRecognizeDate(link) {
  if (!link || !link.parentNode) { showToast('未找到该日期'); return; }
  const ctx = recNoDateTargetBox(link);
  const t = document.createTextNode(REC_NODATE + (link.textContent || ''));
  link.parentNode.replaceChild(t, link);
  recNoDateRerender(ctx);
  showToast('已取消识别该日期');
}
function recRestoreRecognizeDate(span) {
  if (!span || !span.parentNode) { showToast('未找到该日期'); return; }
  const ctx = recNoDateTargetBox(span);
  const t = document.createTextNode(recStripNoDateMark(span.textContent || ''));
  span.parentNode.replaceChild(t, span);
  recNoDateRerender(ctx);
  showToast('已恢复识别该日期');
}
function daOpenPath(p) {
  p = String(p || '').trim().replace(/^["']+|["']+$/g, '');
  if (!p) { showToast('路径为空'); return; }
  const isDir = recAttachIsDir(p);
  const act = isDir ? 'folder' : (/\.(docx?|xlsx?|pptx?|wps|et|dps|pdf|txt|csv)$/i.test(p) ? 'wps' : 'exec');
  const url = 'zzoffice://open?act=' + act + '&target=' + encodeURIComponent(p);
  recPathWaitBlur = true;
  try { window.location.href = url; } catch (e) {}
  setTimeout(function() {
    if (recPathWaitBlur) {
      recPathWaitBlur = false;
      showToast('未能打开：需已注册 zzoffice:// 协议处理器');
    }
  }, 1500);
}
function recAttachEnsureCtx() {
  let m = document.getElementById('recAttachCtxMenu');
  if (!m) {
    m = document.createElement('div');
    m.id = 'recAttachCtxMenu';
    m.className = 'rec-ctx-menu';
    document.body.appendChild(m);
  }
  return m;
}
function recAttachHideCtx() {
  const m = document.getElementById('recAttachCtxMenu');
  if (m) m.style.display = 'none';
}
function recAttachShowCtxMenu(x, y, target) {
  const m = recAttachEnsureCtx();
  if (target && target.nodate) {
    m.innerHTML = '<div class="rec-ctx-item" data-act="restore">恢复识别</div>';
    m.style.display = 'block';
    const w0 = m.offsetWidth || 130, h0 = m.offsetHeight || 30;
    m.style.left = Math.max(4, Math.min(x, window.innerWidth - w0 - 6)) + 'px';
    m.style.top = Math.max(4, Math.min(y, window.innerHeight - h0 - 6)) + 'px';
    m.onclick = function(e) {
      let it = e.target;
      while (it && it !== m && !(it.getAttribute && it.getAttribute('data-act'))) it = it.parentNode;
      if (!it || it === m) return;
      recAttachHideCtx();
      if (it.getAttribute('data-act') === 'restore') recRestoreRecognizeDate(target.nodate);
    };
    return;
  }
  const n = recEventAttachCount(target.proj, target.ev);
  let h = '<div class="rec-ctx-item" data-act="edit">' + (n ? '编辑附件…' : '添加附件…') + '</div>';
  if (n) h += '<div class="rec-ctx-item" data-act="view">查看附件</div>';
  h += '<div class="rec-ctx-item" data-act="sort">自动排序</div>';
  h += '<div class="rec-ctx-item" data-act="canceldate">取消识别</div>';
  m.innerHTML = h;
  m.style.display = 'block';
  const w = m.offsetWidth || 150, hh = m.offsetHeight || 34;
  m.style.left = Math.max(4, Math.min(x, window.innerWidth - w - 6)) + 'px';
  m.style.top = Math.max(4, Math.min(y, window.innerHeight - hh - 6)) + 'px';
  m.onclick = function(e) {
    let it = e.target;
    while (it && it !== m && !(it.getAttribute && it.getAttribute('data-act'))) it = it.parentNode;
    if (!it || it === m) return;
    const act = it.getAttribute('data-act');
    recAttachHideCtx();
    if (act === 'edit') recAttachOpenEdit(target);
    else if (act === 'sort') recProjectAutoSortLink(target.link);
    else if (act === 'canceldate') recCancelRecognizeDate(target.link);
    else recAttachOpenView(target);
  };
}
function recAttachBindContext() {
  const input = document.getElementById('recProjectInput');
  if (input && !input.__daCtxBound) {
    input.__daCtxBound = true;
    input.addEventListener('contextmenu', function(e) {
      const nd = recAttachFindNoDate(e.target);
      if (nd) {
        e.preventDefault();
        recAttachShowCtxMenu(e.clientX, e.clientY, { nodate: nd });
        return;
      }
      const link = recAttachFindLink(e.target);
      if (!link) return;
      e.preventDefault();
      const ei = parseInt(link.getAttribute('data-ei'), 10);
      const ev = recCurrentEventByEi(ei);
      if (!ev) return;
      recAttachShowCtxMenu(e.clientX, e.clientY, { proj: recCurrentProject, key: recEventLocator(ev), ev: ev, link: link });
    });
  }
  const multi = document.getElementById('recProjectMulti');
  if (multi && !multi.__daCtxBound) {
    multi.__daCtxBound = true;
    multi.addEventListener('contextmenu', function(e) {
      const nd = recAttachFindNoDate(e.target);
      if (nd) {
        e.preventDefault();
        recAttachShowCtxMenu(e.clientX, e.clientY, { nodate: nd });
        return;
      }
      const link = recAttachFindLink(e.target);
      if (!link) return;
      const win = link.closest ? link.closest('.rec-proj-win') : null;
      const proj = win ? (win.getAttribute('data-proj') || '') : '';
      if (!proj) return;
      e.preventDefault();
      const ei = parseInt(link.getAttribute('data-ei'), 10);
      const ev = recProjectEventByEi(proj, ei);
      if (!ev) return;
      recAttachShowCtxMenu(e.clientX, e.clientY, { proj: proj, key: recEventLocator(ev), ev: ev, link: link });
    });
  }
}
let recAttachDragFrom = -1;
function recAttachDragStart(e, i) {
  recAttachDragFrom = i;
  try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch (err) {}
  const card = e.currentTarget;
  if (card && card.classList) card.classList.add('dragging');
}
function recAttachDragOver(e, i) {
  if (recAttachDragFrom < 0) return;
  e.preventDefault();
  try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
  const card = e.currentTarget;
  if (card && card.classList) card.classList.add('drag-over');
}
function recAttachDragLeave(e) {
  const card = e.currentTarget;
  if (card && card.classList) card.classList.remove('drag-over');
}
function recAttachDragEnd() {
  recAttachDragFrom = -1;
  const nodes = document.querySelectorAll('#recAttachImgList .rec-attach-img');
  for (let k = 0; k < nodes.length; k++) nodes[k].classList.remove('dragging', 'drag-over');
}
function recAttachDrop(e, i) {
  e.preventDefault();
  const from = recAttachDragFrom;
  recAttachDragEnd();
  if (!recAttachDraft || from < 0 || from === i) return;
  const arr = recAttachDraft.images;
  if (from >= arr.length || i >= arr.length) return;
  const moved = arr.splice(from, 1)[0];
  arr.splice(i, 0, moved);
  recAttachRenderDraft();
  showToast('已调整图片顺序');
}

// ---- 截屏：优先本程序直接捕获；不可用时 3 秒倒计时后调用系统截图 ----
function recAppDir() {
  try {
    let u = decodeURIComponent(String(window.location.href).split('#')[0].split('?')[0]);
    if (u.indexOf('file://') !== 0) return '';
    let rest = u.replace(/^file:\/\//, '');
    if (/^\/[A-Za-z]:/.test(rest)) rest = rest.slice(1);
    const i = rest.lastIndexOf('/');
    return i >= 0 ? rest.slice(0, i + 1) : '';
  } catch (e) { return ''; }
}
function recAttachShotTip() {
  let el = document.getElementById('recAttachShotTip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'recAttachShotTip';
    el.className = 'rec-shot-tip';
    document.body.appendChild(el);
  }
  return el;
}
// ---- 截屏：调用系统截图工具（自动冻结画面 → 拖动框选 → 双击/回车确认），再把结果自动读入图片框 ----
//   通道 1：本地服务（127.0.0.1:8737）运行 sh/截图.sh --print，脚本回传 base64，页面直接插图；
//   通道 2：zzoffice:// 调起 sh/截图.sh，回到本窗口时自动读取系统剪贴板。
function recAttachCapture() {
  if (window.__daCapturing) return;
  const m = document.getElementById('recAttachModal');
  if (!m || m.style.display === 'none') { showToast('请先打开附件窗口'); return; }
  window.__daCapturing = true;
  recAttachShotTipShow('正在调用系统截图：请拖动框选区域，双击（或回车）确认');
  recAttachServiceShot(function(handled) {
    window.__daCapturing = false;
    if (!handled) recAttachSystemShot();
  });
}
function recAttachServiceShot(cb) {
  let settled = false;
  const done = function(ok) { if (settled) return; settled = true; cb(ok); };
  let ac = null;
  try { ac = new AbortController(); } catch (e) {}
  const timer = setTimeout(function() { try { if (ac) ac.abort(); } catch (e) {} done(false); }, 1600);
  const opt = ac ? { signal: ac.signal, cache: 'no-store' } : { cache: 'no-store' };
  fetch('http://127.0.0.1:8737/api/ping', opt).then(function(r) {
    return r && r.ok ? r.json() : null;
  }).then(function(d) {
    if (settled) return;
    clearTimeout(timer);
    if (!d || !d.ok) { done(false); return; }
    recAttachShotJob(done);
  }).catch(function() {
    if (settled) return;
    clearTimeout(timer);
    done(false);
  });
}
function recAttachShotJob(done) {
  fetch('http://127.0.0.1:8737/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ argv: ['截图.sh', '--print'] })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (!d || !d.ok || !d.id) { done(false); return; }
    recAttachShotTipShow('请在系统截图工具中框选区域，双击（或回车）确认');
    const t0 = Date.now();
    const poll = function() {
      fetch('http://127.0.0.1:8737/api/job?id=' + encodeURIComponent(d.id), { cache: 'no-store' })
        .then(function(r) { return r.json(); })
        .then(function(j) {
          if (!j || !j.ok) { done(false); return; }
          if (j.running && Date.now() - t0 < 180000) { setTimeout(poll, 400); return; }
          const hit = String(j.out || '').match(/DAIMG:([A-Za-z0-9+/=]{32,})/);
          if (hit) {
            recAttachShotTipHide();
            if (recAttachDraft) {
              recAttachDraft.images.push({ src: 'data:image/png;base64,' + hit[1], note: '' });
              recAttachRenderDraft();
              showToast('已截取并插入图片');
            }
            done(true);
            return;
          }
          if (/未找到可用的系统截图工具/.test(String(j.out || ''))) {
            recAttachShotTipShow('未找到可用的系统截图工具，请先安装 kylin-screenshot / deepin-screenshot / flameshot 等，或直接按 Ctrl+V 粘贴图片');
            done(true);
            return;
          }
          recAttachShotTipShow('已截图：请回到本窗口自动读入（或按 Ctrl+V 粘贴）');
          recAttachClipboardImageSoon();
          done(true);
        })
        .catch(function() { done(false); });
    };
    setTimeout(poll, 400);
  }).catch(function() { done(false); });
}
function recAttachShotTipShow(txt) {
  const el = recAttachShotTip();
  if (!el) return;
  el.innerHTML = '<div class="rec-shot-txt">' + escapeHtml(txt) + '</div>';
  el.style.display = 'block';
}
function recAttachShotTipHide() {
  const el = document.getElementById('recAttachShotTip');
  if (el) el.style.display = 'none';
}
function recAttachClipboardImageSoon() {
  let n = 0;
  const tick = function() {
    n++;
    recAttachClipboardImage(function(ok) {
      if (ok) { recAttachShotTipHide(); return; }
      if (n < 8) setTimeout(tick, 700);
    });
  };
  setTimeout(tick, 400);
}
function recAttachClipboardImage(cb) {
  const fin = function(ok) { if (typeof cb === 'function') cb(ok); };
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') { fin(false); return; }
  if (window.__daClipBusy) { fin(false); return; }
  window.__daClipBusy = true;
  navigator.clipboard.read().then(function(items) {
    let p = Promise.resolve(false);
    for (let i = 0; i < items.length; i++) {
      const types = items[i].types || [];
      const t = types.filter(function(x) { return x.indexOf('image/') === 0; })[0];
      if (!t) continue;
      p = items[i].getType(t).then(function(blob) {
        return new Promise(function(res) {
          const fr = new FileReader();
          fr.onload = function() {
            if (recAttachDraft) {
              recAttachDraft.images.push({ src: String(fr.result), note: '' });
              recAttachRenderDraft();
              showToast('已从剪贴板读入截图');
            }
            res(true);
          };
          fr.onerror = function() { res(false); };
          fr.readAsDataURL(blob);
        });
      });
      break;
    }
    return p;
  }).catch(function() { return false; }).then(function(ok) {
    window.__daClipBusy = false;
    fin(!!ok);
  });
}
function recAttachSystemShot() {
  recAttachShotTipShow('正在调用系统截图…请框选区域，双击（或回车）确认');
  recAttachInvokeSystemShot();
}
function recAttachInvokeSystemShot() {
  const dir = recAppDir();
  if (dir) {
    try { window.location.href = 'zzoffice://open?act=exec&target=' + encodeURIComponent(dir + 'sh/截图.sh'); } catch (e) {}
    window.__daShotInvoked = true;
    recAttachShotTipShow('已调用系统截图：请框选区域；回到本窗口将自动读入（或按 Ctrl+V 粘贴）');
    setTimeout(function() { recAttachShotTipHide(); }, 5000);
    return;
  }
  recAttachShotTipShow('请用系统截图快捷键（如 PrintScreen / Ctrl+Alt+A）截图后，在本窗口按 Ctrl+V 粘贴');
  setTimeout(function() { recAttachShotTipHide(); }, 6000);
}
function recAttachRenderDraft() {
  const list = document.getElementById('recAttachImgList');
  if (list) {
    let h = '';
    recAttachDraft.images.forEach(function(it, i) {
      h += '<div class="rec-attach-img" data-i="' + i + '" draggable="true"' +
        ' ondragstart="recAttachDragStart(event,' + i + ')"' +
        ' ondragover="recAttachDragOver(event,' + i + ')"' +
        ' ondragleave="recAttachDragLeave(event)"' +
        ' ondrop="recAttachDrop(event,' + i + ')"' +
        ' ondragend="recAttachDragEnd()">' +
        (recAttachDraft.images.length > 1 ? '<span class="rec-attach-move" title="按住拖动调整顺序">拖动排序</span>' : '') +
        '<img src="' + it.src + '" alt="图片" draggable="false" onclick="recLbOpen(recAttachDraft.images,' + i + ')">' +
        '<div class="rec-attach-img-foot">' +
        '<input type="text" placeholder="备注…" value="' + escapeHtml(it.note || '') + '" oninput="recAttachSetNote(' + i + ',this.value)">' +
        '<button type="button" class="rec-attach-del" title="删除" onclick="recAttachRemoveImg(' + i + ')">&times;</button>' +
        '</div></div>';
    });
    if (!recAttachDraft.images.length) h = '<div class="rec-attach-empty">暂无图片：在下方框内 Ctrl+V 粘贴、拖入图片，或点击「选择图片」</div>';
    list.innerHTML = h;
  }
  recAttachRenderLinks();
}
function recAttachRenderLinks() {
  if (!recAttachDraft) return;
  const files = [], dirs = [];
  recAttachDraft.links.forEach(function(l, i) {
    if (recAttachLinkKind(l) === '文件夹') dirs.push({ l: l, i: i });
    else files.push({ l: l, i: i });
  });
  recAttachRenderLinkBox(document.getElementById('recAttachFileList'), files);
  recAttachRenderLinkBox(document.getElementById('recAttachDirList'), dirs);
}
function recAttachRenderLinkBox(box, arr) {
  if (!box) return;
  let h = '';
  arr.forEach(function(it) {
    const l = it.l;
    h += '<div class="rec-attach-link">' +
      '<span class="rec-attach-link-ico">' + recAttachLinkKind(l) + '</span>' +
      '<span class="rec-attach-link-path" title="' + escapeHtml(l.path) + '">' + escapeHtml(l.label || l.path) + '</span>' +
      '<button type="button" class="rec-attach-open" onclick="recAttachDraftOpen(' + it.i + ')">打开</button>' +
      '<button type="button" class="rec-attach-del" title="删除" onclick="recAttachRemoveLink(' + it.i + ')">&times;</button>' +
      '</div>';
  });
  box.innerHTML = h || '<div class="rec-attach-empty" style="padding:6px 0">暂无</div>';
}
function recAttachSetNote(i, v) {
  if (recAttachDraft && recAttachDraft.images[i]) recAttachDraft.images[i].note = v;
}
function recAttachRemoveImg(i) {
  if (!recAttachDraft) return;
  recAttachDraft.images.splice(i, 1);
  recAttachRenderDraft();
}
function recAttachRemoveLink(i) {
  if (!recAttachDraft) return;
  recAttachDraft.links.splice(i, 1);
  recAttachRenderLinks();
}
function recAttachDraftOpen(i) {
  const l = recAttachDraft && recAttachDraft.links[i];
  if (l) daOpenPath(l.path);
}
function recAttachAddLink(kind) {
  const isDir = kind === 'dir';
  const inp = document.getElementById(isDir ? 'recAttachDirInput' : 'recAttachLinkInput');
  if (!inp) return;
  const v = String(inp.value || '').trim();
  if (!v) { showToast(isDir ? '请输入文件夹路径' : '请输入文件路径'); return; }
  if (!recAttachDraft) return;
  recAttachDraft.links.push({ path: v, label: '', type: isDir ? 'dir' : 'file' });
  inp.value = '';
  recAttachRenderLinks();
}
function recAttachAddImageFiles(files) {
  (files || []).forEach(function(f) {
    if (!f || !/^image\//.test(f.type || '')) return;
    const r = new FileReader();
    r.onload = function() {
      if (!recAttachDraft) return;
      recAttachDraft.images.push({ src: String(r.result), note: '' });
      recAttachRenderDraft();
    };
    r.readAsDataURL(f);
  });
}
function recAttachPickImages(input) {
  const files = input && input.files ? Array.prototype.slice.call(input.files) : [];
  recAttachAddImageFiles(files);
  if (input) input.value = '';
}
// 选择本地文件 / 文件夹：优先用「办公助手」的联动选择器 js/path-picker.js（ZzPick），
// 未加载时退回直连本地服务 /api/pick-folder。选好后把绝对路径加入对应列表。
function recAttachFindEventByLoc(proj, loc) {
  if (!proj || !loc) return null;
  let raw = recProjectTexts[proj] || '';
  const single = document.getElementById('recProjectInput');
  if (single && !single.classList.contains('hidden') && recSingleProjectName() === proj) {
    raw = single.innerText || raw;
  }
  const evs = recNormalizeEvents(recExtractStructuredEvents(raw));
  for (let i = 0; i < evs.length; i++) {
    if (recEventLocator(evs[i]) === loc) return evs[i];
  }
  return null;
}
function recAttachEditByLoc(el) {
  if (!el) return;
  const proj = el.getAttribute('data-proj') || '';
  const loc = el.getAttribute('data-loc') || '';
  const ev = recAttachFindEventByLoc(proj, decodeURIComponent(loc));
  if (!ev) { showToast('未找到对应事件'); return; }
  recAttachOpenEdit({ proj: proj, key: loc, ev: ev });
}
function recAttachPickPath(kind) {
  const mode = kind === 'dir' ? 'dir' : 'file';
  const add = function(p) {
    if (!p || !recAttachDraft) return;
    recAttachDraft.links.push({ path: p, label: '', type: mode === 'dir' ? 'dir' : 'file' });
    recAttachRenderLinks();
    showToast('已添加' + (mode === 'dir' ? '文件夹' : '文件'));
  };
  if (window.ZzPick && typeof window.ZzPick.pick === 'function') {
    window.ZzPick.pick(mode, { title: mode === 'dir' ? '请选择文件夹' : '请选择文件' }).then(function(res) {
      if (res && res.ok && res.path) add(res.path);
      else if (res && res.error && !res.cancelled) showToast('选择失败：' + res.error);
    }).catch(function(e) {
      showToast('选择失败：' + ((e && e.message) || e));
    });
    return;
  }
  recAttachPickPathDirect(mode, add);
}
function recAttachPickPathDirect(mode, add) {
  let done = false;
  const timer = setTimeout(function() {
    if (done) return; done = true;
    showToast('未检测到本地「办公助手」服务（127.0.0.1:8737）');
  }, 5000);
  fetch('http://127.0.0.1:8737/api/pick-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: mode === 'dir' ? '选择文件夹' : '选择文件', mode: mode })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (done) return; done = true; clearTimeout(timer);
    const p = d && (d.path || d.folder);
    if (p) add(p); else showToast('未获取到路径');
  }).catch(function() {
    if (done) return; done = true; clearTimeout(timer);
    showToast('未检测到本地「办公助手」服务（127.0.0.1:8737）');
  });
}
function recAttachInitDrop() {
  const drop = document.getElementById('recAttachDrop');
  if (!drop || drop.__daDrop) return;
  drop.__daDrop = true;
  ['dragenter', 'dragover'].forEach(function(t) {
    drop.addEventListener(t, function(e) { e.preventDefault(); drop.classList.add('hot'); });
  });
  drop.addEventListener('dragleave', function() { drop.classList.remove('hot'); });
  drop.addEventListener('drop', function(e) {
    e.preventDefault();
    drop.classList.remove('hot');
    const files = e.dataTransfer && e.dataTransfer.files ? Array.prototype.slice.call(e.dataTransfer.files) : [];
    recAttachAddImageFiles(files);
  });
}
function recAttachOpenEdit(target) {
  recAttachTarget = target;
  const b = recEventAttach(target.proj, target.key, false) || { images: [], links: [] };
  recAttachDraft = {
    images: (b.images || []).map(function(x) { return { src: x.src, note: x.note || '' }; }),
    links: (b.links || []).map(function(x) { return { path: x.path, label: x.label || '' }; })
  };
  const t = document.getElementById('recAttachEventText');
  if (t) t.textContent = recAttachInText(target.ev);
  recAttachRenderDraft();
  recAttachInitDrop();
  const m = document.getElementById('recAttachModal');
  if (m) m.style.display = 'flex';
  const drop = document.getElementById('recAttachDrop');
  if (drop) { try { drop.focus(); } catch (e) {} }
}
function recAttachCloseModal() {
  const m = document.getElementById('recAttachModal');
  if (m) m.style.display = 'none';
  recAttachTarget = null;
  recAttachDraft = null;
}
function recAttachSave() {
  if (!recAttachTarget || !recAttachDraft) { recAttachCloseModal(); return; }
  const proj = recAttachTarget.proj, key = recAttachTarget.key;
  const imgs = recAttachDraft.images.filter(function(x) { return x && x.src; });
  const links = recAttachDraft.links.filter(function(x) { return x && x.path; });
  if (imgs.length || links.length) {
    const b = recEventAttach(proj, key, true);
    b.images = imgs;
    b.links = links;
  } else if (recProjectAttachments[proj] && recProjectAttachments[proj][key]) {
    delete recProjectAttachments[proj][key];
  }
  try { saveRecordData(); } catch (e) {}
  recRenderTlColumn();
  recAttachCloseModal();
  showToast('附件已保存');
}
function recAttachOpenViewEi(ei) {
  const ev = recCurrentEventByEi(ei);
  if (!ev) return;
  recAttachOpenView({ proj: recCurrentProject, key: recEventLocator(ev), ev: ev });
}
function recAttachOpenView(target) {
  const b = recEventAttach(target.proj, target.key, false);
  const imgs = (b && b.images) ? b.images : [];
  const links = (b && b.links) ? b.links : [];
  recAttachViewImages = imgs;
  recAttachViewLinks = links;
  const t = document.getElementById('recAttachViewEventText');
  if (t) t.textContent = recAttachInText(target.ev);
  const box = document.getElementById('recAttachViewImgs');
  if (box) {
    let h = '';
    imgs.forEach(function(it, i) {
      h += '<div class="rec-attach-vimg" data-i="' + i + '">' +
        '<img src="' + it.src + '" alt="图片" onclick="recLbOpen(recAttachViewImages,' + i + ')">' +
        (it.note ? '<div class="cap">' + escapeHtml(it.note) + '</div>' : '') +
        '</div>';
    });
    box.innerHTML = h;
  }
  const lb = document.getElementById('recAttachViewLinks');
  if (lb) {
    let h = '';
    links.forEach(function(l, i) {
      h += '<div class="rec-attach-link">' +
        '<span class="rec-attach-link-ico">' + recAttachKind(l) + '</span>' +
        '<span class="rec-attach-link-path" title="' + escapeHtml(l.path) + '">' + escapeHtml(l.label || l.path) + '</span>' +
        '<button type="button" class="rec-attach-open" onclick="recAttachViewOpen(' + i + ')">打开</button>' +
        '</div>';
    });
    lb.innerHTML = h;
  }
  const m = document.getElementById('recAttachViewModal');
  if (m) m.style.display = 'flex';
}
function recAttachViewOpen(i) {
  const l = recAttachViewLinks[i];
  if (l) daOpenPath(l.path);
}
function recAttachViewClose() {
  const m = document.getElementById('recAttachViewModal');
  if (m) m.style.display = 'none';
  recAttachViewImages = [];
  recAttachViewLinks = [];
}
function recLbOpen(items, idx) {
  if (!items || !items.length) return;
  recLbItems = items.filter(function(x) { return x && x.src; });
  if (!recLbItems.length) return;
  recLbIndex = Math.max(0, Math.min(idx || 0, recLbItems.length - 1));
  const lb = document.getElementById('recAttachLightbox');
  if (!lb) return;
  lb.classList.add('show');
  recLbShow();
}
function recLbShow() {
  const it = recLbItems[recLbIndex];
  if (!it) return;
  const img = document.getElementById('recLbImg');
  if (img) img.src = it.src;
  const nm = document.getElementById('recLbName');
  if (nm) nm.textContent = '图片 ' + (recLbIndex + 1) + ' / ' + recLbItems.length;
  const nt = document.getElementById('recLbNote');
  if (nt) nt.textContent = it.note || '';
  const boot = function() { recLbReset(); };
  const im = document.getElementById('recLbImg');
  if (im && !im.complete) im.onload = boot; else setTimeout(boot, 0);
}
function recLbReset() {
  const stage = document.getElementById('recLbStage');
  const img = document.getElementById('recLbImg');
  if (!stage || !img) return;
  const sw = stage.clientWidth || 1, sh = stage.clientHeight || 1;
  const iw = img.naturalWidth || sw, ih = img.naturalHeight || sh;
  recLbScaleV = Math.min(sw / iw, sh / ih, 1) || 1;
  recLbX = (sw - iw * recLbScaleV) / 2;
  recLbY = (sh - ih * recLbScaleV) / 2;
  recLbApply();
}
function recLbApply() {
  const img = document.getElementById('recLbImg');
  if (img) img.style.transform = 'translate(' + recLbX + 'px,' + recLbY + 'px) scale(' + recLbScaleV + ')';
  const sc = document.getElementById('recLbScale');
  if (sc) sc.textContent = Math.round(recLbScaleV * 100) + '%';
}
function recLbZoom(d) {
  const stage = document.getElementById('recLbStage');
  if (!stage || !document.getElementById('recLbImg')) return;
  const cx = stage.clientWidth / 2, cy = stage.clientHeight / 2;
  const old = recLbScaleV;
  let next = old * (d > 0 ? 1.25 : 0.8);
  next = Math.max(0.1, Math.min(8, next));
  recLbX = cx - (cx - recLbX) * (next / old);
  recLbY = cy - (cy - recLbY) * (next / old);
  recLbScaleV = next;
  recLbApply();
}
function recLbPrev() {
  if (recLbIndex > 0) { recLbIndex--; recLbShow(); }
}
function recLbNext() {
  if (recLbIndex < recLbItems.length - 1) { recLbIndex++; recLbShow(); }
}
function recLbClose() {
  const lb = document.getElementById('recAttachLightbox');
  if (lb) lb.classList.remove('show');
  recLbItems = [];
}
function recHideAttachOverlays() {
  recAttachHideCtx();
  recAttachCloseModal();
  recAttachViewClose();
  recLbClose();
}
function recAttachInitGlobal() {
  if (window.__daAttachGlobal) return;
  window.__daAttachGlobal = true;
  document.addEventListener('paste', function(e) {
    const m = document.getElementById('recAttachModal');
    if (!m || m.style.display === 'none') return;
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const files = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file' && /^image\//.test(it.type || '')) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) { e.preventDefault(); recAttachAddImageFiles(files); }
  });
  document.addEventListener('blur', function() { recPathWaitBlur = false; });
  window.addEventListener('focus', function() {
    if (!window.__daShotInvoked) return;
    window.__daShotInvoked = false;
    const m = document.getElementById('recAttachModal');
    if (!m || m.style.display === 'none') return;
    recAttachClipboardImageSoon();
  });
  document.addEventListener('click', function(e) {
    const menu = document.getElementById('recAttachCtxMenu');
    if (menu && menu.style.display === 'block' && !menu.contains(e.target)) recAttachHideCtx();
    const eb = document.getElementById('recAttachModal');
    if (eb && e.target === eb) recAttachCloseModal();
    const vb = document.getElementById('recAttachViewModal');
    if (vb && e.target === vb) recAttachViewClose();
    const lb = document.getElementById('recAttachLightbox');
    if (lb && lb.classList.contains('show') && (e.target === lb || e.target.id === 'recLbStage')) recLbClose();
  });
  document.addEventListener('keydown', function(e) {
    const am = document.getElementById('recAttachModal');
    if (am && am.style.display !== 'none' && am.style.display !== '' && e.ctrlKey && e.altKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) {
      e.preventDefault();
      recAttachCapture();
      return;
    }
    const lb = document.getElementById('recAttachLightbox');
    if (lb && lb.classList.contains('show')) {
      if (e.key === 'Escape') { recLbClose(); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { recLbPrev(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { recLbNext(); e.preventDefault(); }
      return;
    }
    if (e.key === 'Escape') {
      recAttachHideCtx();
      const m = document.getElementById('recAttachModal');
      if (m && m.style.display !== 'none' && m.style.display !== '') { recAttachCloseModal(); return; }
      const v = document.getElementById('recAttachViewModal');
      if (v && v.style.display !== 'none' && v.style.display !== '') recAttachViewClose();
    }
  });
  const stage = document.getElementById('recLbStage');
  if (stage && !stage.__daDrag) {
    stage.__daDrag = true;
    let sx = 0, sy = 0, dragging = false;
    stage.addEventListener('mousedown', function(e) {
      if (e.button !== 0) return;
      dragging = true; sx = e.clientX; sy = e.clientY;
      stage.classList.add('dragging');
      e.preventDefault();
    });
    stage.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      recLbX += e.clientX - sx; recLbY += e.clientY - sy;
      sx = e.clientX; sy = e.clientY;
      recLbApply();
    });
    document.addEventListener('mouseup', function() {
      if (dragging) { dragging = false; stage.classList.remove('dragging'); }
    });
    stage.addEventListener('wheel', function(e) {
      e.preventDefault();
      recLbZoom(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }
}
if (document.getElementById('recAttachLightbox')) { recAttachInitGlobal(); }
else { document.addEventListener('DOMContentLoaded', function() { setTimeout(recAttachInitGlobal, 0); }); }

// ---- 类别设置弹窗 ----
function openRecCatModal() {
  const m = document.getElementById('recCatModal');
  if (m) m.style.display = 'flex';
  recRenderCatList();
}
function closeRecCatModal() {
  const m = document.getElementById('recCatModal');
  if (m) m.style.display = 'none';
}
function recRenderCatList() {
  const list = document.getElementById('recCatList');
  if (!list) return;
  let html = '';
  recCats.forEach(function(c, i) {
    html += '<div class="rec-cat-row" data-idx="' + i + '" draggable="true" ondragstart="recCatDragStart(event,' + i + ')" ondragover="recCatDragOver(event)" ondragend="recCatDragEnd()" ondrop="recCatDrop(event,' + i + ')">' +
      '<span class="rec-cat-drag">⋮⋮</span>' +
      '<input type="text" class="rec-cat-name" value="' + escapeHtml(c.name) + '" oninput="recCatRename(this,' + i + ')">' +
      '<input type="color" class="rec-cat-color" value="' + (c.color || '#3498db') + '" oninput="recCatPickColor(this,' + i + ')">' +
      '<span class="rec-cat-del" onclick="recCatDelete(' + i + ')">✕</span>' +
      '</div>';
  });
  list.innerHTML = html;
}
let recCatDragFrom = -1;
function addRecCatRow() {
  recCats.push({ name: '新类别', color: REC_COLORS[recCats.length % REC_COLORS.length] });
  recRenderCatList();
}
function recCatRename(el, i) {
  if (i >= 0 && i < recCats.length) recCats[i].name = el.value;
}
function recCatPickColor(el, i) {
  if (i >= 0 && i < recCats.length) recCats[i].color = el.value;
}
function recCatDelete(i) {
  if (i >= 0 && i < recCats.length) recCats.splice(i, 1);
  recRenderCatList();
}
function recCatDragStart(e, i) { recCatDragFrom = i; if (e.target) e.target.classList.add('dragging'); }
function recCatDragOver(e) { if (e.preventDefault) e.preventDefault(); }
function recCatDragEnd() {
  document.querySelectorAll('#recCatList .rec-cat-row').forEach(function(el) { el.classList.remove('dragging'); });
  recCatDragFrom = -1;
}
function recCatDrop(e, to) {
  if (e.preventDefault) e.preventDefault();
  if (recCatDragFrom >= 0 && recCatDragFrom !== to && recCatDragFrom < recCats.length) {
    const item = recCats.splice(recCatDragFrom, 1)[0];
    recCats.splice(to, 0, item);
    recRenderCatList();
  }
  recCatDragFrom = -1;
}
function saveRecCatSettings() {
  saveRecordData();
  closeRecCatModal();
  showToast('类别设置已保存');
}

// ---- 多维态势 - 选择事件类别弹窗 ----
function openRecSelectModal() {
  const m = document.getElementById('recSelectModal');
  if (m) m.style.display = 'flex';
  recRenderSelectList();
}
function closeRecSelectModal() {
  const m = document.getElementById('recSelectModal');
  if (m) m.style.display = 'none';
}
function recRenderSelectList() {
  const list = document.getElementById('recSelectList');
  if (!list) return;
  let html = '';
  recCats.forEach(function(c, i) {
    const on = recSituSel.indexOf(i) >= 0;
    html += '<div class="rec-select-row' + (on ? ' on' : '') + '" data-idx="' + i + '" draggable="true" ondragstart="recSituDragStart(event,' + i + ')" ondragover="recSituDragOver(event)" ondragend="recSituDragEnd()" ondrop="recSituDrop(event,' + i + ')">' +
      '<input type="checkbox" class="rec-situ-chk" ' + (on ? 'checked' : '') + ' onchange="recSituToggleCat(' + i + ')">' +
      '<span class="rec-cat-drag">⋮⋮</span>' +
      '<span class="rec-situ-name">' + escapeHtml(c.name) + '</span>' +
      '<input type="color" class="rec-cat-color" value="' + (c.color || '#3498db') + '" oninput="recSituPickColor(this,' + i + ')">' +
      '</div>';
  });
  list.innerHTML = html || '<div style="color:#b2bec3;padding:12px;">暂无类别，请先到「类别设置」添加</div>';
}
let recSituDragFrom = -1;
function recSituToggleCat(i) { recSituToggle(i); }
function recSituToggle(i) {
  const idx = recSituSel.indexOf(i);
  if (idx >= 0) recSituSel.splice(idx, 1);
  else recSituSel.push(i);
  recSituSel.sort(function(a, b) { return a - b; });
}
function recSituPickColor(el, i) {
  if (i >= 0 && i < recCats.length) recCats[i].color = el.value;
  saveRecordData();
}
function recSituDragStart(e, i) { recSituDragFrom = i; if (e.target) e.target.classList.add('dragging'); }
function recSituDragOver(e) { if (e.preventDefault) e.preventDefault(); }
function recSituDragEnd() {
  document.querySelectorAll('#recSelectList .rec-select-row').forEach(function(el) { el.classList.remove('dragging'); });
  recSituDragFrom = -1;
}
function recSituDrop(e, to) {
  if (e.preventDefault) e.preventDefault();
  if (recSituDragFrom >= 0 && recSituDragFrom !== to && recSituDragFrom < recCats.length) {
    const item = recCats.splice(recSituDragFrom, 1)[0];
    recCats.splice(to, 0, item);
    recSituSel = recSituSel.map(function(v) { return v === recSituDragFrom ? to : (v === to ? recSituDragFrom : v); });
    recRenderSelectList();
  }
  recSituDragFrom = -1;
}
function saveRecSelectSettings() {
  saveRecordData();
  closeRecSelectModal();
  showToast('态势事件选择已保存');
}

// ---- 多维态势图 ----
// ---- 总体进程：渲染（项目列表 + 态势图） ----
function recRenderSitu() {
  recRenderTlColumn();
}

// 项目列表：每个项目前一个小圆点（不同背景色），点击 100%/30% 透明度，可拖动排序
function recRenderSituProjList() {
  const list = document.getElementById('situProjList');
  if (!list) return;
  let html = '';
  recProjects.forEach(function(name, i) {
    const on = recSituSelProjs.has(name);
    const color = SITU_COLORS[i % SITU_COLORS.length];
    html += '<div class="situ-proj-item' + (on ? ' on' : '') + '" draggable="true" ' +
      ' ondragstart="recSituProjDragStart(event,' + i + ')" ondragover="recSituProjDragOver(event)" ' +
      ' ondragend="recSituProjDragEnd()" ondrop="recSituProjDrop(event,' + i + ')" ' +
      ' onclick="toggleSituSelProject(' + i + ')" title="点击选中/取消，拖动调整顺序">' +
      '<span class="situ-proj-dot" style="background:' + color + ';"></span>' +
      '<span class="situ-proj-name">' + escapeHtml(name) + '</span>' +
      '</div>';
  });
  list.innerHTML = html || '<div class="situ-proj-empty">暂无项目</div>';
}

function toggleSituSelProject(i) {
  const name = recProjects[i];
  if (!name) return;
  if (recSituSelProjs.has(name)) recSituSelProjs.delete(name);
  else recSituSelProjs.add(name);
  saveRecordData();
  recRenderSitu();
}
function recSituSelectAll() {
  recProjects.forEach(function(p){ recSituSelProjs.add(p); });
  hideSituSelMenu();
  saveRecordData();
  recRenderSitu();
}
function recSituSelectInvert() {
  recProjects.forEach(function(p){ if (recSituSelProjs.has(p)) recSituSelProjs.delete(p); else recSituSelProjs.add(p); });
  hideSituSelMenu();
  saveRecordData();
  recRenderSitu();
}
function recSituSelectNone() {
  recSituSelProjs.clear();
  hideSituSelMenu();
  saveRecordData();
  recRenderSitu();
}
function recSituProjDragStart(e, i) { recSituProjDragFrom = i; if (e.target) e.target.classList.add('dragging'); }
function recSituProjDragOver(e) { if (e.preventDefault) e.preventDefault(); }
function recSituProjDragEnd() {
  document.querySelectorAll('#situProjList .situ-proj-item').forEach(function(el){ el.classList.remove('dragging'); });
  recSituProjDragFrom = -1;
}
function recSituProjDrop(e, to) {
  if (e.preventDefault) e.preventDefault();
  if (recSituProjDragFrom >= 0 && recSituProjDragFrom !== to && recSituProjDragFrom < recProjects.length) {
    const item = recProjects.splice(recSituProjDragFrom, 1)[0];
    recProjects.splice(to, 0, item);
    saveRecordData();
    recRenderSitu();
  }
  recSituProjDragFrom = -1;
}

// 左侧项目列表窗口显示/隐藏
function toggleSituProjList() {
  recSituProjVisible = !recSituProjVisible;
  const left = document.getElementById('situLeftPanel');
  if (left) left.classList.toggle('hidden', !recSituProjVisible);
  saveRecordData();
  recRenderSituTier3();
}

// 选择下拉菜单
function toggleSituSelMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('situSelMenu');
  if (menu) menu.classList.toggle('hidden');
}
function hideSituSelMenu() {
  const menu = document.getElementById('situSelMenu');
  if (menu) menu.classList.add('hidden');
}

function recSituDateKey(sk) {
  return String(sk || '').split(' ')[0];
}

// 周几（周日..周六）
function situWeekdayName(dk) {
  const p = situParseDate(dk);
  if (!p) return '';
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[new Date(p.y, p.m - 1, p.d).getDay()];
}

// 时间轴日期模块的完整时间文案：日 → 「2026年3月8日（周三）」，折叠月 → 「2026年3月」，
// 天省略号 → 「2026年5月10日至12日（共3日）」，月省略号 → 「2026年3月至4月（2个月、61天）」
function situAxisFullTime(u) {
  if (!u) return '';
  if (u.isMonth) return u.y + '年' + u.month + '月';
  if (u.ellipsis) {
    if (u.ellType === 'month') {
      const sy = u.ellStartYear, sm = u.ellStartMonth, ey = u.ellEndYear, em = u.ellEndMonth;
      const ymStr = sy === ey ? (sm + '月至' + em + '月') : (sy + '年' + sm + '月至' + ey + '年' + em + '月');
      return ymStr + '（' + u.ellMonthCount + '个月、' + u.ellDayCount + '天）';
    }
    return u.y + '年' + u.month + '月' + u.ellStart + '日至' + u.ellEnd + '日（共' + u.ellDayCount + '日）';
  }
  return u.y + '年' + u.month + '月' + u.d + '日（' + situWeekdayName(u.key) + '）';
}

// 解析 "yyyy.mm.dd" 日期键 → {y,m,d,n}（n=yyyy*10000+mm*100+dd 可比较整数）
function situParseDate(dk) {
  const m = String(dk || '').match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (!m) return null;
  return { y: parseInt(m[1], 10), m: parseInt(m[2], 10), d: parseInt(m[3], 10), n: parseInt(m[1], 10) * 10000 + parseInt(m[2], 10) * 100 + parseInt(m[3], 10) };
}

// 以日期为单位构建时间轴列：有事件日=默认宽显示「×月×日」；
// 连续无事件日合并为天省略号「…」（悬停「×月×日至×日（共N日）」）；
// 连续≥2个月无事件合并为月省略号「…」（月标记样式，悬停「×月至×月（N个月、N天）」）；
// 整月无事件（单独一个月）折叠为单列显示「×月」；每月1日始终作为月标记；
// 返回 [{key,label,width,x,month,mIndex,y,d,hasEvent,isMonth,monthMark,ellipsis,ellType,ellStart,ellEnd}]
function buildSituAxisUnits(eventDateKeys, eventStartDates, eventBoundaryDates, eventMonthRanges, eventRanges) {
  const dayKeys = Object.keys(eventDateKeys || {}).map(situParseDate).filter(Boolean);
  if (!dayKeys.length) return [];
  dayKeys.sort(function(a, b){ return a.n - b.n; });
  const evW = recSituEventW;
  const colW = evW + 12;      // 有事件日：当前默认宽度（随事件宽度联动）
  const ellipsisW = 36;        // 省略号列宽度（天/月省略号共用）
  const monthMinW = 28;        // 月节点最短宽度
  const start = new Date(dayKeys[0].y, dayKeys[0].m - 1, 1);
  const lastDay = dayKeys[dayKeys.length - 1];
  const lastKey = lastDay.y + '.' + pad2(lastDay.m) + '.' + pad2(lastDay.d);
  const rangeLast = (eventRanges || []).reduce(function(max, r) {
    return Math.max(max, r.end || 0);
  }, 0);
  const rangeEnd = rangeLast ? situParseDate(String(Math.floor(rangeLast / 10000)) + '.' + pad2(Math.floor(rangeLast / 100) % 100) + '.' + pad2(rangeLast % 100)) : null;
  const end = rangeEnd
    ? new Date(rangeEnd.y, rangeEnd.m - 1, rangeEnd.d)
    : (eventBoundaryDates && eventBoundaryDates[lastKey]
    ? new Date(lastDay.y, lastDay.m - 1, lastDay.d)
    : new Date(lastDay.y, lastDay.m, 0)); // 普通日期仍覆盖其所在整月，保证月初节点可见
  const hasEvent = {};
    dayKeys.forEach(function(d){
      const dk = d.y + '.' + pad2(d.m) + '.' + pad2(d.d);
      hasEvent[dk] = eventDateKeys[dk] === true;
    });
  // 逐日枚举，按月份分组
  const monthGroups = [];
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear(), m = cur.getMonth() + 1, d = cur.getDate();
    const ym = y + '.' + pad2(m);
    const dk = ym + '.' + pad2(d);
    let g = monthGroups[monthGroups.length - 1];
    if (!g || g.ym !== ym) { g = { ym: ym, m: m, y: y, days: [] }; monthGroups.push(g); }
    g.days.push({ y: y, d: d, dk: dk, has: !!hasEvent[dk], boundary: !!(eventBoundaryDates && eventBoundaryDates[dk]) });
    cur.setDate(cur.getDate() + 1);
  }
  // 先标记每月是否有事件
  monthGroups.forEach(function(g){
    g.hasEvent = g.days.some(function(d){ return d.has; });
    g.hasBoundary = g.days.some(function(d){ return d.boundary; });
    g.monthRange = (eventMonthRanges || {})[g.ym] || null;
  });
  const units = [];
  let x = 0;
  let mi = 0; // 月索引（用于底部横线颜色交替）
  let i = 0;
  while (i < monthGroups.length) {
    const g = monthGroups[i];
    // 边缘月若含日级事件，则展开为日级刻度，保证嵌套在整月事件内的事件不被丢弃。
    const edgeExpand = !!g.monthRange && (g.ym === g.monthRange.start || g.ym === g.monthRange.end) &&
      g.days.some(function(d){ return d.d > 1 && d.has; });
      if (g.monthRange && !edgeExpand) {
       // 事件覆盖的月份全部直接显示月份；只有完全没有事件覆盖的月份才允许省略。
      const range = g.monthRange;
      const isEdgeMonth = g.ym === range.start || g.ym === range.end;
      if (isEdgeMonth) {
        units.push({ key: g.days[0].dk, label: String(g.m), width: monthMinW, x: x,
          month: g.m, mIndex: mi, y: g.y, d: 1, hasEvent: true,
          isMonth: false, monthMark: true, monthRange: true });
        x += monthMinW;
      } else {
        const startSerial = range.startYear * 12 + range.startMonth;
        const endSerial = range.endYear * 12 + range.endMonth;
        units.push({ key: g.ym + '.month', label: String(g.m), width: ellipsisW, x: x,
           month: g.m, mIndex: mi, y: g.y, d: 1, hasEvent: false,
           isMonth: true, monthMark: false, ellipsis: false, ellType: 'month', monthRange: true,
           ellStartMonth: g.m, ellEndMonth: g.m, ellStartYear: g.y, ellEndYear: g.y,
           ellMonthCount: 1, ellDayCount: g.days.length });
        x += ellipsisW;
      }
      if (isEdgeMonth) {
        units.push({ key: g.ym + '.rest', label: '…', width: ellipsisW, x: x,
           month: g.m, mIndex: mi, y: g.y, d: 2, hasEvent: false,
           isMonth: false, monthMark: false, ellipsis: true, ellType: 'day', monthRange: true,
           monthRangeEdge: true,
           ellStart: 2, ellEnd: monthLastDay(g.y, g.m), ellDayCount: Math.max(0, monthLastDay(g.y, g.m) - 1) });
        x += ellipsisW;
      }
      mi++;
      i++;
      continue;
    }
    if (!g.hasEvent) {
      // 整月事件的结束边界落在下月1日：显示该月节点，不再把它折叠成普通省略号。
      if (g.hasBoundary) {
        const boundaryDay = g.days[0];
        units.push({
          key: boundaryDay.dk, label: String(g.m), width: ellipsisW, x: x,
          month: g.m, mIndex: mi, y: boundaryDay.y, d: 1,
          hasEvent: false, axisBoundary: true, isMonth: false, monthMark: true
        });
        x += ellipsisW;
        mi++;
        i++;
        continue;
      }
      // 无事件月：向后扫描连续无事件月
      const startMi = i;
      while (i < monthGroups.length && !monthGroups[i].hasEvent && !monthGroups[i].hasBoundary) i++;
      const count = i - startMi;
      if (count >= 2) {
        // ≥2个月：合并为月省略号
        const gStart = monthGroups[startMi];
        const gEnd = monthGroups[i - 1];
        const sY = gStart.y, sM = gStart.m;
        const eY = gEnd.y, eM = gEnd.m;
        // 计算总天数
        const sDate = new Date(sY, sM - 1, 1);
        const eDate = new Date(eY, eM, 0);
        const totalDays = Math.round((eDate - sDate) / 86400000) + 1;
        const label = sY === eY ? (sM + '月至' + eM + '月') : (sY + '年' + sM + '月至' + eY + '年' + eM + '月');
        units.push({
          key: gStart.ym, label: label, width: ellipsisW, x: x,
          month: sM, mIndex: mi, y: sY, d: 1,
          hasEvent: false, axisBoundary: false, isMonth: false, monthMark: false,
          ellipsis: true, ellType: 'month',
          ellStartMonth: sM, ellEndMonth: eM, ellStartYear: sY, ellEndYear: eY, ellMonthCount: count, ellDayCount: totalDays
        });
        x += ellipsisW;
        mi += count;
      } else {
        // 单独1个无事件月：直接显示月份，不使用省略号。
        units.push({
          key: g.ym, label: String(g.m), width: ellipsisW, x: x,
          month: g.m, mIndex: mi, y: g.days[0].y, d: 1,
          hasEvent: false, axisBoundary: false, isMonth: true, monthMark: false,
          ellipsis: false, ellType: 'month',
          ellStartMonth: g.m, ellEndMonth: g.m, ellStartYear: g.days[0].y, ellEndYear: g.days[0].y, ellMonthCount: 1, ellDayCount: g.days.length
        });
        x += ellipsisW;
        mi++;
      }
    } else {
      // 有事件的月份：先输出月标记（1日），再合并连续空日为天省略号
      const days = g.days;
      const edgeUnitStart = edgeExpand ? units.length : -1;
      let di = 0;
      // 1日始终作为月标记输出（不论1日是否有事件）
      const firstDay = days[0];
      // 1日有事件开始时用宽列（colW），否则用窄列（ellipsisW）
      const firstDayWide = firstDay.has && eventStartDates && eventStartDates[firstDay.dk];
       // 第一个时间刻度至少使用事件默认宽度，避免事件块被窄刻度压缩。
       const firstW = firstDayWide ? Math.max(colW, evW) : Math.max(ellipsisW, evW);
       if (!firstDay.has) {
        // 1日无事件：月标记与后续空日一起省略，但月标记仍需输出
        // 先输出月标记列
         units.push({ key: firstDay.dk, label: String(g.m), width: firstW, x: x, month: g.m, mIndex: mi, y: firstDay.y, d: 1, hasEvent: false, isMonth: false, monthMark: true });
         x += firstW;
        di = 1;
        // 跳过1日后面的连续空日（在后续天省略号中合并处理）
      } else {
        // 1日有事件：正常输出
        units.push({ key: firstDay.dk, label: String(g.m), width: firstW, x: x, month: g.m, mIndex: mi, y: firstDay.y, d: 1, hasEvent: true, isMonth: false, monthMark: true });
        x += firstW;
        di = 1;
      }
      mi++;
      // 处理2日及之后的天
      while (di < days.length) {
        if (days[di].has) {
          units.push({ key: days[di].dk, label: g.m + '月' + days[di].d + '日', width: colW, x: x, month: g.m, mIndex: mi - 1, y: days[di].y, d: days[di].d, hasEvent: true, isMonth: false, monthMark: false });
          x += colW;
          di++;
        } else {
          const startIdx = di;
          while (di < days.length && !days[di].has) di++;
          const endIdx = di - 1;
          const startD = days[startIdx].d;
          const endD = days[endIdx].d;
          const dayCount = endD - startD + 1;
          units.push({
            key: days[startIdx].dk, label: g.m + '月' + startD + '日至' + endD + '日', width: ellipsisW, x: x,
            month: g.m, mIndex: mi - 1, y: days[startIdx].y, d: startD,
            hasEvent: false, isMonth: false, monthMark: false,
            ellipsis: true, ellType: 'day', ellStart: startD, ellEnd: endD, ellDayCount: dayCount
          });
          x += ellipsisW;
        }
      }
      if (edgeExpand) {
        // 边缘月展开出的日级刻度整体标记为月级范围，使月级事件仍铺满整月，
        // 同时让月内各日事件获得可用刻度 key。
        for (let u = edgeUnitStart; u < units.length; u++) {
          units[u].monthRange = true;
          if (!units[u].hasEvent) units[u].monthRangeEdge = true;
        }
      }
      i++;
    }
  }
  // 时间刻度优先：只要日/月省略号被任一事件区间经过，就固定为一个默认事件宽度。
  // 事件块随后按刻度边界铺开，不再由事件块反向撑宽时间轴。
  const ranges = eventRanges || [];
  units.forEach(function(u) {
    if (!u.ellipsis || !ranges.length) return;
    let unitStart = null, unitEnd = null;
    if (u.ellType === 'day') {
      unitStart = u.y * 10000 + u.month * 100 + u.ellStart;
      unitEnd = u.y * 10000 + u.month * 100 + u.ellEnd;
    } else {
      unitStart = u.ellStartYear * 10000 + u.ellStartMonth * 100 + 1;
      unitEnd = u.ellEndYear * 10000 + u.ellEndMonth * 100 + monthLastDay(u.ellEndYear, u.ellEndMonth);
    }
    const covered = ranges.filter(function(r){ return r.start <= unitEnd && r.end >= unitStart; });
    // 具体到日的事件优先：其经过的省略号保持最小宽度；仅纯月份事件经过时才扩展到150px。
    const hasConcrete = covered.some(function(r){ return r.concreteDay; });
    const hasMonthOnly = covered.some(function(r){ return !r.concreteDay && !r.rough; });
    if (hasConcrete || covered.some(function(r){ return r.rough; })) u.width = ellipsisW;
    else if (hasMonthOnly && !u.monthRangeEdge) u.width = evW;
  });
  let axisX = 0;
  units.forEach(function(u){ u.x = axisX; axisX += u.width; });

  // 按每条事件单独保证最小宽度：若事件范围不足默认宽度，只扩展该事件范围内的最后一个省略号。
  ranges.forEach(function(r) {
    const coveredIndexes = [];
    units.forEach(function(u, i) {
      let us, ue;
      if (u.ellipsis && u.ellType === 'day') {
        us = u.y * 10000 + u.month * 100 + u.ellStart;
        ue = u.y * 10000 + u.month * 100 + u.ellEnd;
      } else if (u.ellipsis && u.ellType === 'month') {
        us = u.ellStartYear * 10000 + u.ellStartMonth * 100 + 1;
        ue = u.ellEndYear * 10000 + u.ellEndMonth * 100 + monthLastDay(u.ellEndYear, u.ellEndMonth);
      } else {
        const d = situParseDate(u.key);
        if (!d) return;
        us = ue = d.n;
      }
      if (r.start <= ue && r.end >= us) coveredIndexes.push(i);
    });
    if (!coveredIndexes.length) return;
     const first = coveredIndexes[0], last = coveredIndexes[coveredIndexes.length - 1];
     if (units[first].width < evW) {
       units[first].width = evW;
       let firstX = 0;
       units.forEach(function(u, idx){ u.x = firstX; firstX += u.width; });
     }
    const spanWidth = units[last].x + units[last].width - units[first].x;
    if (spanWidth >= evW) return;
    const candidates = coveredIndexes.filter(function(i){ return units[i].ellipsis && !units[i].monthRangeEdge; });
    if (!candidates.length) return;
    units[candidates[candidates.length - 1]].width += evW - spanWidth;
    let x2 = 0;
    units.forEach(function(u){ u.x = x2; x2 += u.width; });
  });
  return units;
}

function situColorAlpha(color, alpha) {
  const m = String(color || '').match(/^#([0-9a-f]{6})$/i);
  if (!m) return color || '#e8ecf1';
  const n = parseInt(m[1], 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}

// 右侧多维态势图：横向分轨时间轴（时间轴以日期为单位，参照 电子记事本 日志态势图）
// 时间段事件（含起止日期）自动横向铺满对应刻度；期间嵌套的新事件单独浮动显示并带阴影
function recRenderSituChart() {
  const c = document.getElementById('situChartContainer');
  if (!c) return;
  const selected = recTlSearchProjects();
  if (!selected.length) {
    c.innerHTML = '<div class="situ-chart-empty">请在左侧勾选项目以生成态势图</div>';
    return;
  }
  const tracks = [];
  const eventDateKeys = {};
  const eventBoundaryDates = {};
  const eventMonthRanges = {};
  const eventStartDates = {};   // 仅记录事件开始日（不含结束日）
  const eventRanges = [];       // 事件覆盖的日期区间，用于决定省略号刻度宽度
  // 单项目时以编辑框实时内容为准，保证与左侧内容、附件挂载完全一致
  const liveInput = document.getElementById('recProjectInput');
  const liveSingle = selected.length === 1 ? selected[0] : '';
  const liveVisible = !!(liveInput && !liveInput.classList.contains('hidden') && liveInput.offsetParent !== null);
  const situTextOf = function(name) {
    if (name === liveSingle && liveVisible) return liveInput.innerText || '';
    return recProjectTexts[name] || '';
  };
  selected.forEach(function(name, ti) {
    const evs = recNormalizeEvents(recExtractStructuredEvents(situTextOf(name)));
    const items = evs.map(function(ev) {
      const hits = recSearchHits(name, ev);
      if (recSearchOnly && !hits.length) return null;
        let startKey = ev.startKey || recSituDateKey(ev.sortKey);
       let endKey = ev.endKey || startKey;
       const startDate = situParseDate(startKey);
       const evTimeParts = splitEvTime(ev.time);
       const eventOrig = evTimeParts.orig || ev.time || '';
        const monthRange = parseSituMonthRange(eventOrig, startDate && startDate.y);
        const roughPeriod = situIsRoughPeriod(eventOrig);
        const quarterPeriod = /[一二三四1-4]季度/.test(eventOrig.replace(/\s+/g, '')) ||
          /第?[一二三四1-4](?:季度)?[至、,][第]?[一二三四1-4]季度/.test(eventOrig.replace(/\s+/g, ''));
        const roughBounds = roughPeriod ? parsePeriodToken(eventOrig, startDate && startDate.y, startDate && startDate.m) : null;
        if (roughBounds && !quarterPeriod) {
          startKey = periodStartKey(roughBounds);
          endKey = periodEndKey(roughBounds);
        }
       // 纯月份跨年度范围不能沿用旧的模糊结束日解析结果，直接使用识别出的结束年月月末。
        if (monthRange) {
         endKey = monthRange.endYear + '.' + pad2(monthRange.endMonth) + '.' + pad2(monthLastDay(monthRange.endYear, monthRange.endMonth));
       }
       const axisEndKey = monthRange ? endKey : (resolveAxisEndKey(startKey, eventOrig) || endKey);
      // 时间轴刻度：标记起止日（中间日不标，保持窄列；事件块横向铺满起止列）
       eventDateKeys[startKey] = true;
        if (monthRange && (!roughPeriod || quarterPeriod)) {
         const cursor = new Date(monthRange.startYear, monthRange.startMonth - 1, 1);
         const stop = new Date(monthRange.endYear, monthRange.endMonth - 1, 1);
         const startMonth = monthRange.startYear + '.' + pad2(monthRange.startMonth);
         const endMonth = monthRange.endYear + '.' + pad2(monthRange.endMonth);
         while (cursor <= stop) {
           const ym = cursor.getFullYear() + '.' + pad2(cursor.getMonth() + 1);
          eventMonthRanges[ym] = { start: startMonth, end: endMonth, pureMonth: !roughPeriod };
           cursor.setMonth(cursor.getMonth() + 1);
         }
         eventDateKeys[startMonth + '.01'] = true;
         eventDateKeys[endMonth + '.01'] = true;
        } else if (!roughPeriod && axisEndKey !== endKey) {
        // 整月/跨月事件改用月级时间轴：不加入结束月下月1日，也不显示月末日期。
        const endDate = situParseDate(endKey);
         const startDate = situParseDate(startKey);
        if (startDate && endDate) {
          const startMonth = startDate.y + '.' + pad2(startDate.m);
          const endMonth = endDate.y + '.' + pad2(endDate.m);
          const cursor = new Date(startDate.y, startDate.m - 1, 1);
          const stop = new Date(endDate.y, endDate.m - 1, 1);
          while (cursor <= stop) {
            const ym = cursor.getFullYear() + '.' + pad2(cursor.getMonth() + 1);
            eventMonthRanges[ym] = { start: startMonth, end: endMonth };
            cursor.setMonth(cursor.getMonth() + 1);
          }
          eventDateKeys[startMonth + '.01'] = true;
          eventDateKeys[endMonth + '.01'] = true;
        }
       } else if (!roughPeriod) {
         eventDateKeys[endKey] = true;
       }
       eventStartDates[startKey] = true;
       const rangeStart = situParseDate(startKey);
       const rangeEnd = situParseDate(endKey);
       if (rangeStart && rangeEnd) {
          eventRanges.push({
            start: rangeStart.n,
            end: rangeEnd.n,
            concreteDay: situHasConcreteDay(eventOrig),
            rough: roughPeriod
          });
        }
        return { startKey: startKey, endKey: endKey, roughEndKey: roughBounds ? periodEndKey(roughBounds) : endKey, axisEndKey: axisEndKey, endExclusive: !!monthRange || axisEndKey !== endKey, roughPeriod: roughPeriod, quarterPeriod: quarterPeriod, time: ev.time, orig: eventOrig, content: ev.content, remark: ev.remark, hits: hits, searchCurrent: recSearchMatchIndex(name, ev) === recSearchIndex };
    }).filter(Boolean);
    tracks.push({ name: name, ci: ti % SITU_COLORS.length, events: items });
  });
  const units = buildSituAxisUnits(eventDateKeys, eventStartDates, eventBoundaryDates, eventMonthRanges, eventRanges);
  if (!units.length) {
    c.innerHTML = '<div class="situ-chart-empty">所选项目暂无事件，请先在项目记录中粘贴内容</div>';
    return;
  }
  const dateIndex = {};
  const monthRangeEndIndex = {};
  const roughEndIndex = {};
  units.forEach(function(u, i){
    if (u.hasEvent || u.axisBoundary || u.monthRange) dateIndex[u.key] = i;
    // 月级事件的结束点必须落在结束月最后一个刻度的右边界，不能停在结束月月初。
    if (u.monthRange) monthRangeEndIndex[u.y + '.' + pad2(u.month)] = i;
    if (u.ellipsis) {
      const us = u.ellType === 'day'
        ? u.y * 10000 + u.month * 100 + u.ellStart
        : u.ellStartYear * 10000 + u.ellStartMonth * 100 + 1;
      const ue = u.ellType === 'day'
        ? u.y * 10000 + u.month * 100 + u.ellEnd
        : u.ellEndYear * 10000 + u.ellEndMonth * 100 + monthLastDay(u.ellEndYear, u.ellEndMonth);
      roughEndIndex[us + ':' + ue] = i;
    }
  });
  const labelW = recSituShowLabel ? 120 : 0, axisH = 36;
  const evH = recSituEventH, evW = recSituEventW;
  const rowH = evH + 4;
  const bodyW = units.reduce(function(s, u){ return s + u.width; }, 0);
  let html = '<div class="situ-chart-inner" style="width:' + (labelW + bodyW) + 'px;">';
  if (labelW) html += '<div class="situ-axis-freeze" style="width:' + labelW + 'px;">' +
    '<button class="situ-axis-scroll-btn left" title="向左移动一个默认宽度" onpointerdown="situAxisScrollStart(-1,event)" onpointerup="situAxisScrollStop(event)" onpointerleave="situAxisScrollStop(event)" onpointercancel="situAxisScrollStop(event)" onclick="situAxisScrollClick(-1,event)">&lt;&lt;</button>' +
    '<span class="situ-axis-freeze-title">时间轴</span>' +
    '<button class="situ-axis-scroll-btn right" title="向右移动一个默认宽度" onpointerdown="situAxisScrollStart(1,event)" onpointerup="situAxisScrollStop(event)" onpointerleave="situAxisScrollStop(event)" onpointercancel="situAxisScrollStop(event)" onclick="situAxisScrollClick(1,event)">&gt;&gt;</button>' +
    '</div>';
  // 时间轴：统一浅灰背景，每列底部 2px 实线按月份交替蓝/青；无事件的 1 日显示大号纯黑黑体月标记
  html += '<div class="situ-axis" style="width:' + bodyW + 'px;margin-left:' + labelW + 'px;height:' + axisH + 'px;">';
  units.forEach(function(u, di) {
    const hl = (di === recSituAlignDi) ? ' hl' : '';
     const mm = (u.monthMark || u.isMonth) ? ' month-mark' : '';
    const line = SITU_AXIS_LINE[u.mIndex % 2];
    // 月标记：文字用与底部横线同色，左侧加 1px 同色实线；内容为 大号数字 + 小号「月」
    // 月省略号：用月标记样式显示「…」（与底部横线同色）
    // 天省略号：灰色「…」
     const inner = (u.monthMark || u.isMonth)
       ? '<span class="mm-wrap"><span class="mm-num">' + escapeHtml(u.label) + '</span><span class="mm-unit">月</span></span>'
      : (u.ellipsis && u.ellType === 'month' ? '<span class="situ-ellipsis-month" style="color:' + line + '">…</span>'
      : (u.ellipsis ? '<span class="situ-ellipsis">…</span>' : escapeHtml(u.label)));
     const mmStyle = (u.monthMark || u.isMonth || (u.ellipsis && u.ellType === 'month'))
       ? 'color:' + line + ';border-left:1px solid ' + line + ';'
      : '';
     const unitEnd = u.x + u.width;
     const alignEnd = recSituAlignLeft + recSituAlignWidth;
     const isAlignedUnit = recSituAlignDi >= 0 && u.x < alignEnd && unitEnd > recSituAlignLeft;
     const alignBg = isAlignedUnit ? situColorAlpha(recSituAlignColor, .8) : SITU_AXIS_LIGHT;
     const alignTop = isAlignedUnit ? 'border-top:2px solid ' + recSituAlignBorder + ';' : '';
     html += '<div class="situ-axis-col' + hl + mm + '" data-di="' + di + '" data-ftime="' + escapeHtml(situAxisFullTime(u)) + '" style="left:' + u.x + 'px;width:' + u.width + 'px;background:' + alignBg + ';border-bottom:2px solid ' + line + ';' + alignTop + mmStyle + '" onmouseover="situAxisTipShow(this)" onmouseout="situAxisTipHide()" onclick="situAxisClick(this)">' + inner + '</div>';
   });
   html += '</div>';
  // 点击事件的对标竖线（贯穿上下）
  if (recSituAlignDi >= 0 && recSituAlignDi < units.length) {
    html += '<div class="situ-vline" style="left:' + (labelW + recSituAlignLeft) + 'px;top:2px;bottom:16px;width:' + recSituAlignWidth + 'px;background:' + recSituAlignColor + ';opacity:.4;"></div>';
  }
  // 轨道
  tracks.forEach(function(tr) {
    const color = SITU_COLORS[tr.ci];
    const dark = SITU_DARK_COLORS[tr.ci];
    const tlEvents = recNormalizeEvents(recExtractStructuredEvents(situTextOf(tr.name)));
    const tlMap = recBuildTimelineOrder(tlEvents).timelineIndex;
    const trackH = evH + 4;          // 事件模块上下各留 2px
    const evTop = 2;
    html += '<div class="situ-track" style="height:' + trackH + 'px;">';
    if (labelW) html += '<div class="situ-track-label" style="width:' + labelW + 'px;height:' + trackH + 'px;background:' + dark + ';border-bottom:3px solid ' + color + ';">' + escapeHtml(tr.name) + '</div>';
    html += '<div class="situ-track-body" style="width:' + bodyW + 'px;">';
    html += '<div class="situ-track-line"></div>';
    // 计算每个事件块起止列（单位索引）与浮动判定：单日事件若落在某时间段跨度内则浮动显示
     const evs = tr.events.map(function(ev, eventOrder) {
       const startDate = situParseDate(ev.startKey);
       const endDate = situParseDate(ev.endKey);
       const startMonthKey = startDate ? startDate.y + '.' + pad2(startDate.m) + '.01' : ev.startKey;
       const endMonthKey = endDate ? endDate.y + '.' + pad2(endDate.m) + '.01' : ev.endKey;
       const si = dateIndex[ev.endExclusive ? startMonthKey : ev.startKey];
        let ei = ev.endExclusive
          ? monthRangeEndIndex[endMonthKey.substring(0, 7)]
          : dateIndex[ev.axisEndKey || ev.endKey];
        if (ev.roughPeriod && !ev.endExclusive) {
          const endNum = parseInt(String(ev.roughEndKey || ev.endKey).replace(/\D/g, ''), 10);
          const roughUnit = units.filter(function(u) {
            if (!u.ellipsis) return false;
            const us = u.ellType === 'day' ? u.y * 10000 + u.month * 100 + u.ellStart : u.ellStartYear * 10000 + u.ellStartMonth * 100 + 1;
            const ue = u.ellType === 'day' ? u.y * 10000 + u.month * 100 + u.ellEnd : u.ellEndYear * 10000 + u.ellEndMonth * 100 + monthLastDay(u.ellEndYear, u.ellEndMonth);
            return endNum >= us && endNum <= ue;
          })[0];
          if (roughUnit) ei = units.indexOf(roughUnit);
        }
      if (si === undefined || ei === undefined) return null;
       return { ev: ev, si: si, ei: ei, span: (ei - si), eventOrder: eventOrder };
    }).filter(Boolean);
     evs.forEach(function(it) {
      it.floated = false;
      it.overlapGroup = -1;
      for (let j = 0; j < evs.length; j++) {
        if (j === evs.indexOf(it)) continue;
        const other = evs[j];
        if (it.si <= other.ei && other.si <= it.ei) { it.floated = true; break; }
      }
     });
     // 连通的区间归为同一重合组，组内事件默认按后出现者置顶。
     let groupCount = 0;
     evs.forEach(function(it, idx) {
       if (it.overlapGroup >= 0) return;
       const group = groupCount++;
       const queue = [idx];
       it.overlapGroup = group;
       while (queue.length) {
         const qi = queue.shift(), q = evs[qi];
         evs.forEach(function(other, oi) {
           if (other.overlapGroup >= 0) return;
           if (q.si <= other.ei && other.si <= q.ei) { other.overlapGroup = group; queue.push(oi); }
         });
       }
     });
     const overlapGroups = {};
     evs.forEach(function(it){ if (it.floated) (overlapGroups[it.overlapGroup] || (overlapGroups[it.overlapGroup] = [])).push(it); });
     Object.keys(overlapGroups).forEach(function(gk) {
       const group = overlapGroups[gk];
       const top = group.reduce(function(a, b){ return a.eventOrder > b.eventOrder ? a : b; });
       group.forEach(function(it){ it.overlap = true; it.defaultTop = top === it; });
     });
    // 时间段（大跨度）在底层先渲染，单日事件后渲染浮于其上（带阴影）
    const order = evs.map(function(it){ return it; }).sort(function(a, b){ return b.span - a.span; });
     order.forEach(function(it) {
       const ev = it.ev;
       const uStart = units[it.si], uEnd = units[it.ei];
        const left = uStart.x;
        const width = (uEnd.x + uEnd.width) - left;
       const tip = (ev.orig ? ev.orig + '  ' : '') + (ev.content || '') + (ev.remark ? '【' + ev.remark + '】' : '');
       const floatCls = it.floated ? ' situ-event-float' : '';
       const searchCls = ev.searchCurrent ? ' rec-search-current' : '';
       const eventHits = ev.hits || [];
         const eventKey = tr.name + '\u0001' + it.eventOrder;
         const tlIdx = tlMap[it.eventOrder];
         const attachN = recEventAttachCount(tr.name, tlEvents[it.eventOrder] || ev);
          const isTop = recSituTopEventKey ? recSituTopEventKey === eventKey : !!it.defaultTop;
          const selectedCls = recSituAlignEventKey === eventKey ? ' situ-event-selected' : '';
         const zIndex = isTop ? 10000 : (it.eventOrder + 1);
         const overlapCls = it.overlap ? ' situ-event-overlap' + (isTop ? ' situ-event-overlap-top' : '') : '';
         const groupKey = it.overlap ? tr.name + '\u0001g' + it.overlapGroup : '';
          html += '<div class="situ-event' + floatCls + overlapCls + selectedCls + searchCls + '" data-di="' + it.si + '" data-event-left="' + left + '" data-event-width="' + width + '" data-event-color="' + escapeHtml(color) + '" data-event-border="' + escapeHtml(dark) + '" data-tip="' + escapeHtml(tip) + '" data-overlap-group="' + escapeHtml(groupKey) + '"' +
          ' data-event-key="' + escapeHtml(eventKey) + '"' +
          ' data-proj="' + escapeHtml(tr.name) + '" data-ti="' + (tlIdx === undefined ? '' : tlIdx) + '"' +
          (ev.remark ? ' data-remark="' + escapeHtml(ev.remark) + '"' : '') +
          ' style="left:' + left + 'px;top:' + evTop + 'px;width:' + width + 'px;height:' + evH + 'px;z-index:' + zIndex + ';--event-border-color:' + dark + ';background:' + color + ';border-left-color:' + dark + ';" onclick="situEventClick(this)">' +
          '<div class="situ-event-top">' +
          (ev.orig ? '<span class="situ-event-time">' + hlCellText(ev.orig, eventHits) + '</span>' : '') +
          (attachN > 0 ? '<span class="situ-event-attach" data-proj="' + escapeHtml(tr.name) + '" data-ti="' + (tlIdx === undefined ? '' : tlIdx) + '"' +
            ' title="查看该事件的附件" onclick="event.stopPropagation();situAttachOpen(event,this)">附件' + attachN + '个</span>' : '') +
          (ev.remark ? '<span class="situ-event-remark-ico" title="备注" onmouseenter="situRemarkTipShow(this)" onmouseleave="situRemarkTipHide()"' +
            ' onclick="event.stopPropagation();situRemarkTipShow(this,true)">' +
            '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
            '<path d="M8 7.1v4.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
            '<circle cx="8" cy="4.9" r=".95" fill="currentColor"/></svg></span>' : '') +
          '</div>' +
          '<span class="situ-event-content">' + hlCellText(ev.content || '', eventHits) + '</span>' +
          '<span class="situ-event-more" title="查看完整内容" onmouseenter="situEventDetailHover(this)" onmouseleave="situEventDetailHoverOut()" onclick="event.stopPropagation();situEventDetailOpen(this)">…</span>' +
          '</div>';
     });
     html += '</div></div>';
  });
  html += '</div>';
  c.innerHTML = html;
  recSituMarkOverflow(c);
  recBindSituPan();
  const multi = document.getElementById("recProjectMulti");
  if (multi) recBindPanScroll(multi, { skip: ".rec-proj-win, input, textarea, button, a, .rec-tl-link" });
}

// 右键按住空白处拖动 = 平移滚动容器（横向分布 / 项目编辑画布）
// 只响应空白背景：落在 .situ-event 等可交互元素上不接管，
// 避免与事件块的点击、悬停、附件按钮冲突。
function recBindPanScroll(el, opts) {
  if (!el || el.__daPanBound) return;
  el.__daPanBound = true;
  const skipSel = (opts && opts.skip) || ".situ-event, .situ-track-label, input, textarea, button, a";
  let drag = null;
  el.addEventListener("pointerdown", function(e) {
    if (e.button !== 2) return;
    const t = e.target;
    if (t && t.closest && t.closest(skipSel)) return;
    e.preventDefault();
    drag = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    el.classList.add("rec-panning");
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
  });
  el.addEventListener("pointermove", function(e) {
    if (!drag) return;
    e.preventDefault();
    el.scrollLeft = drag.sl - (e.clientX - drag.x);
    el.scrollTop = drag.st - (e.clientY - drag.y);
  });
  function endPan() {
    if (!drag) return;
    drag = null;
    el.classList.remove("rec-panning");
  }
  el.addEventListener("pointerup", endPan);
  el.addEventListener("pointercancel", endPan);
  el.addEventListener("contextmenu", function(e) {
    // 空白处右键只用于拖动，不弹系统菜单；事件块上保留浏览器默认行为
    const t = e.target;
    if (t && t.closest && t.closest(skipSel)) return;
    e.preventDefault();
  });
}

// 横向分布：把「右键拖空白平移」挂到态势图容器上（渲染只改 innerHTML，容器本身不变）
function recBindSituPan() {
  const c = document.getElementById("situChartContainer");
  if (c) recBindPanScroll(c);
}

// 标记内容溢出的事件块，显示右下角「…」
function recSituMarkOverflow(c) {
  if (!c) return;
  c.querySelectorAll('.situ-event').forEach(function(box) {
    const body = box.querySelector('.situ-event-content');
    if (!body) return;
    const many = box.querySelector('.situ-event-more');
    const over = body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1;
    box.classList.toggle('rec-overflow', !!over);
    if (many) many.title = over ? '内容未显示完整，点击查看' : '';
  });
}

// 事件块尺寸调节：宽度+/-、高度+/-
function recSituEventResize(dim, delta) {
  const step = 10;
  if (dim === 'w') {
    recSituEventW = Math.max(80, Math.min(400, recSituEventW + delta * step));
  } else {
    recSituEventH = Math.max(44, Math.min(200, recSituEventH + delta * step));
  }
  saveRecordData();
  recRenderSituChart();
}

// 事件脉络：排序切换
function recSetTimelineSort(sort) {
  recTimelineSort = sort === 'desc' ? 'desc' : 'asc';
  recRenderTlColumn();
  recRenderSetbarMode();
}

// 事件脉络：渲染打散后按时间排序的多项目事件
function recRenderSituTimeline() {
  const c = document.getElementById('situTimelineContainer');
  if (!c) return;
  const oldGroup = document.getElementById('situTimelineSizeGroup');
  const settingsVisible = !!oldGroup && !oldGroup.classList.contains('hidden');
  const selected = recTlSearchProjects();
  let html = '<div class="situ-tl-head"><span class="situ-tl-title">事件脉络</span>' +
    '<button class="situ-size-btn situ-set-btn" id="situTimelineSetBtn" title="点击展开相关设置项" onclick="toggleSituTimelineSettings()">设置</button>' +
    '<div class="situ-size-group hidden" id="situTimelineSizeGroup"><div class="situ-tl-sort-group">' +
    '<button class="situ-tl-sort-btn' + (recTimelineSort === 'asc' ? ' active' : '') + '" data-sort="asc" onclick="recSetTimelineSort(\'asc\')">由远至近</button>' +
    '<button class="situ-tl-sort-btn' + (recTimelineSort === 'desc' ? ' active' : '') + '" data-sort="desc" onclick="recSetTimelineSort(\'desc\')">由近至远</button>' +
    '<button class="situ-tl-sort-btn" onclick="exportSituTimelineDoc()" title="导出事件脉络文档">导出文档</button>' +
    '<button class="situ-size-btn" title="整体缩小" onclick="recSituZoom(-1)">−</button><span class="situ-zoom-val" id="situTimelineZoomVal">' + Math.round(recSituZoomLevel * 100) + '%</span><button class="situ-size-btn" title="整体放大" onclick="recSituZoom(1)">＋</button>' +
    '</div></div></div>';
  if (!selected.length) {
    html += '<div class="situ-tl-body"><div class="situ-tl-empty">请在左侧勾选项目以生成事件脉络</div></div>';
    c.innerHTML = html;
    toggleSituTimelineSettings(settingsVisible);
    return;
  }
  // 收集所有事件，带项目信息
  const allEvents = [];
  selected.forEach(function(name) {
    const evs = recNormalizeEvents(recExtractStructuredEvents(recProjectTexts[name] || ''));
    const ci = recProjects.indexOf(name);
    const color = SITU_COLORS[ci % SITU_COLORS.length];
    const dark = SITU_DARK_COLORS[ci % SITU_DARK_COLORS.length];
    evs.forEach(function(ev) {
      const sk = ev.sortKey || '';
      allEvents.push({ ev: ev, projName: name, color: color, dark: dark, sortKey: sk });
    });
  });
  // 排序
  allEvents.sort(function(a, b) {
    return recTimelineSort === 'asc' ? a.sortKey.localeCompare(b.sortKey) : b.sortKey.localeCompare(a.sortKey);
  });
  html += '<div class="situ-tl-body"><div class="situ-tl-sheet">';
  if (!allEvents.length) {
    html += '<div class="situ-tl-empty">所选项目暂无事件</div>';
  }
  const visibleEvents = allEvents.filter(function(item){ return !recSearchOnly || recSearchHits(item.projName, item.ev).length; });
  function timelineItemYM(item) {
    const ev = item.ev;
    if (ev.startKey && ev.endKey && ev.startKey !== ev.endKey) {
      const sd = situParseDate(ev.startKey);
      if (sd) return sd.y + '年' + sd.m + '月';
    }
    const d = situParseDate(ev.sortKey);
    return d ? d.y + '年' + d.m + '月' : '';
  }
  let lastYM = '';
  visibleEvents.forEach(function(item, idx) {
    const ev = item.ev;
    const hits = recSearchHits(item.projName, ev);
    const searchCurrent = recSearchMatchIndex(item.projName, ev) === recSearchIndex;
    const color = item.color;
    const dark = item.dark;
    // splitEvTime：保留原始日期时段，右侧改显示所属项目名称
    let origText = '';
    if (ev.time) {
      const tt = splitEvTime(ev.time);
      origText = tt.orig || ev.time;
    }
    // 日期时段保持要事日志原文，不用标准化日期覆盖显示。
    let dateText = origText;
    const ym = timelineItemYM(item);
    // 月份分组头
    if (ym && ym !== lastYM) {
      html += '<div class="situ-tl-m-head"><div class="situ-tl-m-dot"></div><div class="situ-tl-m-label">' + escapeHtml(ym) + '</div></div>';
      lastYM = ym;
    }
    const nextYM = idx + 1 < visibleEvents.length ? timelineItemYM(visibleEvents[idx + 1]) : '';
    const sepClass = nextYM === ym ? ' tl-sep-inner' : ' tl-sep-month';
    html += '<div class="situ-tl-m-item' + sepClass + (searchCurrent ? ' rec-search-current' : '') + '" data-idx="' + idx + '" onclick="recToggleTlActive(this)">';
    html += '<div class="situ-tl-item-dot" style="background:' + color + '" title="' + escapeHtml(item.projName) + '"></div>';
    html += '<div class="situ-tl-item-body">';
    html += '<div class="situ-tl-item-date" style="color:' + dark + '"><span>' + hlCellText(dateText, hits) + '</span>';
     html += '<span class="situ-tl-item-project" style="color:' + dark + '">' + hlCellText('「' + item.projName + '」', hits) + '</span>';
    html += '</div>';
    if (ev.content) html += '<div class="situ-tl-item-content">' + hlCellText(ev.content, hits) + '</div>';
    if (ev.remark) html += '<div class="situ-tl-item-note">' + hlCellText(ev.remark, hits) + '</div>';
    html += '</div></div>';
    html += '<div class="situ-tl-divider ' + (nextYM === ym ? 'situ-tl-divider-inner' : 'situ-tl-divider-month') + '"></div>';
  });
  html += '</div></div>';
  c.innerHTML = html;
  const body = c.querySelector('.situ-tl-body');
  if (body) body.style.zoom = recSituZoomLevel;
  toggleSituTimelineSettings(settingsVisible);
}

let situAxisScrollTimer = 0;
let situAxisScrollMoved = false;
function situAxisScrollTarget() {
  return document.getElementById('situChartContainer');
}
function situAxisScrollClick(dir, e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (situAxisScrollMoved) { situAxisScrollMoved = false; return; }
  const c = situAxisScrollTarget();
  if (c) c.scrollBy({ left: dir * recSituEventW, behavior: 'smooth' });
}
function situAxisScrollStart(dir, e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  situAxisScrollMoved = false;
  situAxisScrollStop();
    situAxisScrollTimer = window.setInterval(function() {
    const c = situAxisScrollTarget();
    if (!c) return;
    situAxisScrollMoved = true;
    c.scrollLeft += dir * 16;
  }, 40);
}
function situAxisScrollStop(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (situAxisScrollTimer) { window.clearInterval(situAxisScrollTimer); situAxisScrollTimer = 0; }
}

function recSearchSignature(project, ev) {
  return String(project || '') + '\u0001' + String(ev && ev.sortKey || '') + '\u0001' + String(ev && ev.time || '') + '\u0001' + String(ev && ev.content || '') + '\u0001' + String(ev && ev.remark || '');
}
function recParseSearchQuery(q) {
  q = String(q || '').trim().replace(/\s*(?:并且|且)\s*/g, '-').replace(/\s*或\s*/g, ' ');
  return parseSearchQuery(q);
}
function recSearchHits(project, ev) {
  const kws = recParseSearchQuery(recSearchQuery);
  if (!kws.length) return [];
  const text = [project, ev && ev.time, ev && ev.content, ev && ev.remark].join(' ').toLowerCase();
  const hits = [];
  kws.forEach(function(subs) {
    if (subs.length && subs.every(function(s){ return text.indexOf(String(s).toLowerCase()) >= 0; })) {
      subs.forEach(function(s){ if (hits.indexOf(s) < 0) hits.push(s); });
    }
  });
  return hits;
}
function recSearchMatchIndex(project, ev) {
  const sig = recSearchSignature(project, ev);
  for (let i = 0; i < recSearchMatches.length; i++) {
    if (recSearchSignature(recSearchMatches[i].project, recSearchMatches[i].event) === sig) return i;
  }
  return -1;
}
function recBuildSearchMatches() {
  recSearchMatches = [];
  if (!recParseSearchQuery(recSearchQuery).length) { recSearchIndex = 0; return; }
  recTlSearchProjects().forEach(function(project) {
    const events = recNormalizeEvents(recExtractStructuredEvents(recProjectTexts[project] || ''));
    events.forEach(function(event) {
      if (recSearchHits(project, event).length) recSearchMatches.push({ project: project, event: event });
    });
  });
  if (recSearchIndex >= recSearchMatches.length) recSearchIndex = Math.max(0, recSearchMatches.length - 1);
}
function recSearchCountText() {
  if (!recSearchQuery.trim()) return '0/0';
  return recSearchMatches.length ? (recSearchIndex + 1) + '/' + recSearchMatches.length : '0/0';
}
function recUpdateSearchCount() {
  const el = document.getElementById('recSearchCount');
  if (el) el.textContent = recSearchCountText();
}
function recDoSearch() {
  const input = document.getElementById('recSearchInput');
  recSearchQuery = input ? input.value : '';
  recSearchIndex = 0;
  recBuildSearchMatches();
  recUpdateSearchCount();
  recRenderTlColumn();
}
function recSearchPrev() {
  if (!recSearchMatches.length) return;
  recSearchIndex = (recSearchIndex - 1 + recSearchMatches.length) % recSearchMatches.length;
  recUpdateSearchCount();
  recRenderTlColumn();
  recScrollToSearchMatch();
}
function recSearchNext() {
  if (!recSearchMatches.length) return;
  recSearchIndex = (recSearchIndex + 1) % recSearchMatches.length;
  recUpdateSearchCount();
  recRenderTlColumn();
  recScrollToSearchMatch();
}
function recToggleSearchOnly() {
  const chk = document.getElementById('recSearchOnlyChk');
  recSearchOnly = chk ? chk.checked : !recSearchOnly;
  recRenderTlColumn();
  recScrollToSearchMatch();
}
function recClearSearch() {
  recSearchQuery = '';
  recSearchMatches = [];
  recSearchIndex = 0;
  recSearchOnly = false;
}
function recScrollToSearchMatch() {
  const el = document.querySelector('.rec-search-current');
  if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
}
function recToggleTlActive(el) {
  if (el.classList.contains('tl-active')) {
    el.classList.remove('tl-active');
  } else {
    el.parentNode.querySelectorAll('.tl-active').forEach(function(n){ n.classList.remove('tl-active'); });
    el.classList.add('tl-active');
  }
}

// ---- 事件脉络导出文档 ----
function tlEscapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function tlMapFont(ff) {
  ff = (ff || '').toLowerCase();
  if (ff.indexOf('黑体') !== -1 || ff.indexOf('simhei') !== -1) return '黑体';
  if (ff.indexOf('楷体_gb2312') !== -1 || ff.indexOf('楷体') !== -1 || ff.indexOf('kaiti') !== -1) return '楷体_GB2312';
  if (ff.indexOf('仿宋_gb2312') !== -1 || ff.indexOf('仿宋') !== -1 || ff.indexOf('fangsong') !== -1) return '仿宋_GB2312';
  return '仿宋_GB2312';
}
function tlBuildRunXml(text, font, sz, bold) {
  font = font || '仿宋_GB2312';
  sz = sz || 32;
  var rpr = '<w:rPr><w:rFonts w:ascii="' + tlEscapeXml(font) + '" w:h-ansi="' + tlEscapeXml(font) + '" w:fareast="' + tlEscapeXml(font) + '" w:cs="' + tlEscapeXml(font) + '" w:hint="fareast"/>';
  if (bold) rpr += '<w:b/><w:b-cs/>'; else rpr += '<w:b w:val="off"/><w:b-cs/>';
  rpr += '<w:i w:val="off"/><w:u w:val="off"/>';
  rpr += '<w:color w:val="auto"/><w:sz w:val="' + sz + '"/><w:sz-cs w:val="' + sz + '"/><w:lang w:val="EN-US" w:fareast="ZH-CN"/></w:rPr>';
  return '<w:r>' + rpr + '<w:t xml:space="preserve">' + tlEscapeXml(text) + '</w:t></w:r>';
}
function tlBuildParaXml(runs, align, indent, font, sz, bold, lineSpacing) {
  var ppr = '<w:pPr>';
  ppr += '<w:spacing w:line="' + (lineSpacing || 572) + '" w:line-rule="exact"/>';
  if (indent) ppr += indent;
  ppr += '<w:jc w:val="' + (align || 'both') + '"/>';
  ppr += '<w:rPr><w:rFonts w:ascii="' + tlEscapeXml(font || '仿宋_GB2312') + '" w:h-ansi="' + tlEscapeXml(font || '仿宋_GB2312') + '" w:fareast="' + tlEscapeXml(font || '仿宋_GB2312') + '" w:cs="' + tlEscapeXml(font || '仿宋_GB2312') + '" w:hint="fareast"/>';
  if (bold) ppr += '<w:b/><w:b-cs/>'; else ppr += '<w:b w:val="off"/><w:b-cs/>';
  ppr += '<w:sz w:val="' + (sz || 32) + '"/><w:sz-cs w:val="' + (sz || 32) + '"/></w:rPr>';
  ppr += '</w:pPr>';
  var body = '';
  for (var i = 0; i < runs.length; i++) {
    var r = runs[i];
    body += tlBuildRunXml(r.text, r.font || font, r.size || sz, r.bold !== undefined ? r.bold : bold);
  }
  return '<w:p>' + ppr + body + '</w:p>';
}
function exportSituTimelineDoc() {
  var selected = recTlSearchProjects();
  if (!selected.length) { showToast('请先勾选项目'); return; }
  // 收集所有事件
  var allEvents = [];
  selected.forEach(function(name) {
    var evs = recNormalizeEvents(recExtractStructuredEvents(recProjectTexts[name] || ''));
    evs.forEach(function(ev) {
      allEvents.push({ ev: ev, projName: name, sortKey: ev.sortKey || '' });
    });
  });
  allEvents.sort(function(a, b) {
    return recTimelineSort === 'asc' ? a.sortKey.localeCompare(b.sortKey) : b.sortKey.localeCompare(a.sortKey);
  });
  if (!allEvents.length) { showToast('所选项目暂无事件'); return; }
  // 构建段落
  var paragraphs = [];
  var lastYM = '';
  allEvents.forEach(function(item) {
    var ev = item.ev;
    var ym = '';
    if (ev.startKey && ev.endKey && ev.startKey !== ev.endKey) {
      var sd = situParseDate(ev.startKey);
      if (sd) ym = sd.y + '年' + sd.m + '月';
    } else if (ev.sortKey) {
      var d = situParseDate(ev.sortKey);
      if (d) ym = d.y + '年' + d.m + '月';
    }
    // 月份标题（黑体、不加粗、左对齐、无缩进、前加·装饰）
    if (ym && ym !== lastYM) {
      paragraphs.push({ runs: [{ text: '·' + ym }], align: 'left', font: '黑体', sz: 32, bold: false, indent: '' });
      lastYM = ym;
    }
    // 日期时段 + 内容 + 备注：忠于原文，直接使用窗口中的日期时段原文（如「次日」「2025年7月以来」）
    var dateText = '';
    if (ev.time) dateText = splitEvTime(ev.time).orig || ev.time;
    // 正文：首行缩进2字符，仿宋_GB2312，两端对齐
    var runs = [];
    var prefix = dateText ? dateText + '，' : '';
    var content = ev.content || '';
    runs.push({ text: prefix + content });
    paragraphs.push({ runs: runs, align: 'both', font: '仿宋_GB2312', sz: 32, bold: false, indent: '<w:ind w:first-line="640" w:first-line-chars="200"/>' });
    // 备注（楷体）
    if (ev.remark) {
      paragraphs.push({ runs: [{ text: '备注：' + ev.remark }], align: 'both', font: '楷体_GB2312', sz: 28, bold: false, indent: '<w:ind w:first-line="640" w:first-line-chars="200"/>' });
    }
  });
  // 标题段落：事件脉络（方正小标宋）
  paragraphs.unshift({ runs: [{ text: '事件脉络' }], align: 'center', font: '方正小标宋简体', sz: 44, bold: false, indent: '' });
  // 标题后空一行
  paragraphs.splice(1, 0, { runs: [{ text: '' }], align: '', font: '仿宋_GB2312', sz: 32, bold: false, indent: '' });
  // 构建文档XML
  var bodyXml = '';
  for (var i = 0; i < paragraphs.length; i++) {
    var p = paragraphs[i];
    bodyXml += tlBuildParaXml(p.runs, p.align, p.indent || '', p.font, p.sz, p.bold);
  }
  if (!bodyXml) bodyXml = '<w:p></w:p>';
  var tpl = document.getElementById('docxTemplate');
  if (!tpl) { showToast('文档模板未找到'); return; }
  var xml = tpl.textContent.replace('__DOC_BODY__', bodyXml);
  var now = new Date();
  var ts = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  var fileName = ts + ' 事件脉络.doc';
  var blob = new Blob([xml], { type: 'application/msword' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  showToast('已导出：' + fileName);
}

// 整体缩放：时间轴 + 轨道名称 + 轨道
function recSituZoom(delta) {
  recSituZoomLevel = Math.round(Math.min(1.6, Math.max(0.6, recSituZoomLevel + delta * 0.1)) * 100) / 100;
  const c = document.getElementById('situChartContainer');
  if (c) c.style.zoom = recSituZoomLevel;
  const body = document.querySelector('#situTimelineContainer .situ-tl-body');
  if (body) body.style.zoom = recSituZoomLevel;
  const val = document.getElementById('situZoomVal');
  if (val) val.textContent = Math.round(recSituZoomLevel * 100) + '%';
  const tlVal = document.getElementById('situTimelineZoomVal');
  if (tlVal) tlVal.textContent = Math.round(recSituZoomLevel * 100) + '%';
  saveRecordData();
}

// 纵向排列设置按钮：控制排序、导出和缩放按钮组显隐
function toggleSituTimelineSettings(force) {
  const g = document.getElementById('situTimelineSizeGroup');
  const btn = document.getElementById('situTimelineSetBtn');
  if (!g || !btn) return;
  const show = typeof force === 'boolean' ? force : g.classList.contains('hidden');
  g.classList.toggle('hidden', !show);
  btn.textContent = show ? '>>' : '设置';
  btn.title = show ? '点击收起相关设置项' : '点击展开相关设置项';
}

// 设置按钮：控制尺寸/缩放按钮组显隐
function toggleSituSizeGroup() {
  recSituSizeGroupVisible = !recSituSizeGroupVisible;
  const g = document.getElementById('situSizeGroup');
  if (g) g.classList.toggle('hidden', !recSituSizeGroupVisible);
  const btn = document.getElementById('situSetBtn');
  if (btn) {
    btn.textContent = recSituSizeGroupVisible ? '>>' : '设置';
    btn.title = recSituSizeGroupVisible ? '点击收起相关设置项' : '点击展开相关设置项';
  }
}

// 点击事件：顶部显示详情 + 该列前对标竖线 + 高亮日期
function situEventClick(el) {
  const group = el ? el.getAttribute('data-overlap-group') : '';
  const initialEventKey = el ? (el.getAttribute('data-event-key') || '') : '';
  let target = el;
  let targetKey = initialEventKey;
  let members = [];
  if (group) {
    // 重合区域按组轮换：同一重合区域再次点击时切换到组内下一个事件。
    members = Array.from(document.querySelectorAll('.situ-event')).filter(function(node) {
      return node.getAttribute('data-overlap-group') === group;
    });
    const currentPos = members.findIndex(function(node) {
      return node.getAttribute('data-event-key') === recSituAlignEventKey;
    });
    const clickedPos = members.findIndex(function(node) {
      return node.getAttribute('data-event-key') === initialEventKey;
    });
    if (currentPos >= 0 && currentPos === clickedPos && members.length > 1) {
      target = members[(clickedPos + 1) % members.length];
      targetKey = target.getAttribute('data-event-key') || initialEventKey;
    }
  }
  // 非重合区域再次点击同一事件，取消焦点和对标矩形。
  if (!group && targetKey && recSituAlignEventKey === targetKey) {
    recSituTopEventKey = '';
    recSituAlignDi = -1;
    recSituAlignEventKey = '';
    recSituAlignColor = '#5a5a5a';
    recSituAlignBorder = '#5a5a5a';
    recSituAlignLeft = 0;
    recSituAlignWidth = 1;
    recRenderSituChart();
    return;
  }
  el = target;
  recSituTopEventKey = targetKey;
  const di = parseInt(el.getAttribute('data-di'), 10);
  const clickedEventKey = el.getAttribute('data-event-key') || '';
  if (!isNaN(di)) {
    if (recSituAlignEventKey === clickedEventKey && clickedEventKey) {
      recSituAlignDi = -1;
      recSituAlignEventKey = '';
      recSituAlignColor = '#5a5a5a';
      recSituAlignBorder = '#5a5a5a';
      recSituAlignLeft = 0;
      recSituAlignWidth = 1;
    } else {
      recSituAlignDi = di;
      recSituAlignEventKey = clickedEventKey;
      recSituAlignColor = el.getAttribute('data-event-color') || '#5a5a5a';
      recSituAlignBorder = el.getAttribute('data-event-border') || '#5a5a5a';
      recSituAlignLeft = parseFloat(el.getAttribute('data-event-left')) || 0;
      recSituAlignWidth = Math.max(1, parseFloat(el.getAttribute('data-event-width')) || recSituEventW);
    }
    recRenderSituChart();
    const jt = parseInt(el.getAttribute('data-ti'), 10);
    const jp = el.getAttribute('data-proj') || '';
    if (jp && !isNaN(jt) && recSituAlignEventKey === clickedEventKey) recSituJump(jp, jt);
  }
  const tip = el ? el.getAttribute('data-tip') : '';
  const bar = document.getElementById('situDetailBar');
  if (bar) bar.textContent = tip || '';
}

// 横向分布：点击事件块 → 中部对应项目窗口定位到该事件并高亮
function recSituJump(proj, ti) {
  if (proj && recCurrentProject !== proj) {
    recProjFocus = '';
    recCurrentProject = proj;
    saveRecordData();
    recRenderSubList();
    recRenderProjectPanels();
  }
  recMtlHighlight(proj, ti);
}

// 横向分布：事件块下方「附件N个」→ 打开附件窗口
function situAttachOpen(e, el) {
  if (e && e.stopPropagation) e.stopPropagation();
  const proj = el.getAttribute('data-proj') || '';
  const ti = parseInt(el.getAttribute('data-ti'), 10);
  if (!proj || isNaN(ti)) return;
  const input = document.getElementById('recProjectInput');
  const live = input && !input.classList.contains('hidden') && proj === recSingleProjectName();
  const events = recNormalizeEvents(recExtractStructuredEvents(live ? (input.innerText || '') : (recProjectTexts[proj] || '')));
  const built = recBuildTimelineOrder(events);
  const ev = events[built.order[ti]];
  if (!ev) return;
  recAttachOpenView({ proj: proj, key: recEventLocator(ev), ev: ev });
}

// 事件模块悬停提示：只显示备注（【】内内容，不含【】），字号与事件模块一致
function situTipEnsure(id, cls) {
  let tip = document.getElementById(id);
  if (!tip) {
    tip = document.createElement('div');
    tip.id = id;
    tip.className = cls;
    document.body.appendChild(tip);
  }
  return tip;
}
function situEventTipShow(el) {
  const rm = el.getAttribute('data-remark');
  if (!rm) return;
  const tip = situTipEnsure('situEventTip', 'situ-event-tip');
  if (!tip) return;
  tip.textContent = rm;
  tip.style.display = 'block';
  const r = el.getBoundingClientRect();
  let x = r.left, y = r.bottom + 4;
  if (x + 360 > window.innerWidth) x = Math.max(4, window.innerWidth - 364);
  if (y + 80 > window.innerHeight) y = Math.max(4, r.top - 60);
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
function situEventTipHide() {
  const tip = document.getElementById('situEventTip');
  if (tip) tip.style.display = 'none';
}

// 横向分布：备注图标（悬停 / 点击显示备注浮框）
let recSituRemarkPinned = false;
function situRemarkTipShow(el, pin) {
  const box = el && el.closest ? el.closest('.situ-event') : null;
  const rm = box ? box.getAttribute('data-remark') : '';
  if (!rm) return;
  const tip = situTipEnsure('situEventTip', 'situ-event-tip');
  if (!tip) return;
  tip.textContent = rm;
  tip.style.display = 'block';
  const r = el.getBoundingClientRect();
  let x = r.left - 8, y = r.bottom + 6;
  const w = tip.offsetWidth || 300, h = tip.offsetHeight || 60;
  if (x + w > window.innerWidth - 8) x = Math.max(4, window.innerWidth - w - 10);
  if (y + h > window.innerHeight - 8) y = Math.max(4, r.top - h - 6);
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
  if (pin) recSituRemarkPinned = true;
}
function situRemarkTipHide() {
  if (recSituRemarkPinned) return;
  situEventTipHide();
}
if (!window.__daRemarkOut) {
  window.__daRemarkOut = true;
  document.addEventListener('click', function() {
    if (!recSituRemarkPinned) return;
    recSituRemarkPinned = false;
    situEventTipHide();
  });
}

// 横向分布：「…」悬停 200ms 自动弹出完整内容（移开取消），点击立即弹出
let situDetailHoverTimer = null;
function situEventDetailHover(el) {
  situEventDetailHoverOut();
  situDetailHoverTimer = setTimeout(function() { situDetailHoverTimer = null; situEventDetailOpen(el); }, 200);
}
function situEventDetailHoverOut() {
  if (situDetailHoverTimer) { clearTimeout(situDetailHoverTimer); situDetailHoverTimer = null; }
}
// 横向分布：内容超出 → 右下角「…」打开完整内容浮窗（可拖动，点击别处关闭）
function situEventDetailOpen(el) {
  const box = el && el.closest ? el.closest('.situ-event') : null;
  if (!box) return;
  let d = document.getElementById('situEventDetail');
  if (!d) {
    d = document.createElement('div');
    d.id = 'situEventDetail';
    d.className = 'situ-event-detail';
    document.body.appendChild(d);
    d.addEventListener('mousedown', situEventDetailDragStart);
  }
  const tip = box.getAttribute('data-tip') || '';
  const proj = box.getAttribute('data-proj') || '';
  d.innerHTML = '<div class="situ-event-detail-head"><span class="situ-event-detail-title">' + escapeHtml(proj) + '</span>' +
    '<button type="button" class="situ-event-detail-close" title="关闭" onclick="situEventDetailClose(event)">×</button></div>' +
    '<div class="situ-event-detail-body">' + escapeHtml(tip) + '</div>';
  d.style.display = 'block';
  const r = box.getBoundingClientRect();
  const w = d.offsetWidth || 380, h = d.offsetHeight || 200;
  let x = r.left, y = r.bottom + 6;
  if (x + w > window.innerWidth - 10) x = Math.max(10, window.innerWidth - w - 12);
  if (y + h > window.innerHeight - 10) y = Math.max(10, r.top - h - 6);
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  if (!window.__daDetailOut) {
    window.__daDetailOut = true;
    document.addEventListener('mousedown', function(e) {
      const p = document.getElementById('situEventDetail');
      if (!p || p.style.display !== 'block') return;
      if (p.contains(e.target)) return;
      situEventDetailClose();
    });
  }
}
function situEventDetailClose(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const d = document.getElementById('situEventDetail');
  if (d) d.style.display = 'none';
}
let situDetailDrag = null;
function situEventDetailDragStart(e) {
  const d = document.getElementById('situEventDetail');
  if (!d || !e.target.closest || !e.target.closest('.situ-event-detail-head')) return;
  if (e.target.closest('.situ-event-detail-close')) return;
  situDetailDrag = { dx: e.clientX - d.offsetLeft, dy: e.clientY - d.offsetTop };
  e.preventDefault();
  window.addEventListener('mousemove', situEventDetailDragMove);
  window.addEventListener('mouseup', situEventDetailDragEnd);
}
function situEventDetailDragMove(e) {
  if (!situDetailDrag) return;
  const d = document.getElementById('situEventDetail');
  if (!d) return;
  const w = d.offsetWidth, h = d.offsetHeight;
  d.style.left = Math.max(4, Math.min(e.clientX - situDetailDrag.dx, window.innerWidth - w - 6)) + 'px';
  d.style.top = Math.max(4, Math.min(e.clientY - situDetailDrag.dy, window.innerHeight - h - 6)) + 'px';
}
function situEventDetailDragEnd() {
  situDetailDrag = null;
  window.removeEventListener('mousemove', situEventDetailDragMove);
  window.removeEventListener('mouseup', situEventDetailDragEnd);
}

// 时间轴日期模块：悬停/点击显示完整时间（如 2026年3月8日（周三））
function situAxisTipShow(el) {
  const ft = el.getAttribute('data-ftime');
  if (!ft) return;
  const tip = situTipEnsure('situAxisTip', 'situ-event-tip situ-axis-tip');
  if (!tip) return;
  tip.textContent = ft;
  tip.style.display = 'block';
  const r = el.getBoundingClientRect();
  let x = r.left, y = r.bottom + 4;
  if (x + 260 > window.innerWidth) x = Math.max(4, window.innerWidth - 264);
  if (y + 50 > window.innerHeight) y = Math.max(4, r.top - 40);
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
function situAxisTipHide() {
  const tip = document.getElementById('situAxisTip');
  if (tip) tip.style.display = 'none';
}
function situAxisClick(el) {
  situAxisTipShow(el);
  const di = parseInt(el.getAttribute('data-di'), 10);
  if (isNaN(di)) return;
  if (recSituAlignDi === di) recSituAlignDi = -1;
  else recSituAlignDi = di;
  recSituAlignColor = '#5a5a5a';
  recSituAlignBorder = '#5a5a5a';
  recSituAlignWidth = 1;
  recSituAlignLeft = 0;
  recSituAlignEventKey = '';
  recRenderSituChart();
}

