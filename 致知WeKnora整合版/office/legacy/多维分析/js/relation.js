/* ============================================================
   人物关系（relation.js）
   一级「人物关系」页：左侧人员信息与关系编辑，右侧可拖拽的关系拓扑图
   数据保存在 localStorage：duowei-relation-v1
   ============================================================ */
(function () {
  if (window.__recRelationLoaded) return;
  window.__recRelationLoaded = true;

  var REL_KEY = 'duowei-relation-v1';
  var REL_THEME_KEY = 'duowei-relation-theme-v1';
  var COLOR_KEYS = ['red', 'blue', 'green', 'yellow', 'purple', 'white', 'cyan'];
  var COLOR_NAMES = { red: '红色', blue: '蓝色', green: '绿色', yellow: '黄色', purple: '紫色', white: '白色', cyan: '青色' };
  var COLOR_HEX = {
    red: '#e05263', blue: '#4aa8ff', green: '#46c37b', yellow: '#f0b556',
    purple: '#a78bfa', white: '#f2f7ff', cyan: '#33d6ff'
  };
  var REL_R = 27;
  // 关系词里出现这些词 → 连线画虚线（不确定 / 传闻类关系）
  var DASH_WORDS = ['疑似', '可能', '好像', '类似', '据说', '传闻', '或许', '疑为', '大约', '不确定', '大概', '似乎', '恐怕', '是否'];
  var relZoom = 1;                 // 拓扑图缩放：1 = 100%
  var relFullMode = 0;             // 0=右侧区域 1=中部满屏 2=整屏全屏
  var relScreenHome = null;        // 整屏时记录原位置
  var relMultiPick = false;        // 色圆按钮多选模式
  var relPickColors = {};          // 多选模式下被点中的色系
  var relSelIds = [];              // Ctrl 选中的人员（用于建立关系）
  var relClusterId = '';           // 右键按下时作为整体的锚点人员
  var relClusterIds = {};          // 本次拖动一起移动的人员
  var relLinkPair = null;          // 关系弹窗里的两个人员 id
  var relLinkEditId = '';          // 关系弹窗正在编辑的关系 id
  var relPan = loadView();         // 画布视图平移（无限画布，存 localStorage）
  var panDrag = null;              // 右键拖动背景时的起始状态
  var bendDrag = null;             // 拖动叠加连线中间圆点调弧度
  var relNoteOn = {};              // 当前可见批注：stepId -> true
  var relNoteVer = 0;              // 批注 DOM 需要重建的版本号
  var relNoteDrawn = -1;           // 已绘制的版本号
  var relNoteEditIdx = -1;         // 正在编辑批注的步骤下标
  var REL_PAN_LIMIT = 100000;      // 平移/坐标的安全上限

  var REL_CSS = [
    '#recRelationPanel { flex: 1; min-height: 0; display: flex; overflow: hidden; }',
    '#recRelationPanel.hidden { display: none; }',
    '.rel-wrap { flex: 1; min-height: 0; display: flex; width: 100%; }',
    '.rel-col { display: flex; flex-direction: column; min-width: 0; min-height: 0; }',
    '.rel-listcol { flex: 0 0 360px; background: var(--da-surface2); border-right: 1px solid var(--da-line); }',
    '.rel-graphcol { flex: 1 1 0; background: var(--da-surface); }',
    '.rel-head { display: flex; align-items: center; gap: 10px; flex-shrink: 0; height: 40px; padding: 0 10px;',
    '  background: var(--da-head); border-bottom: 1px solid rgba(90, 170, 255, 0.35); }',
    '.rel-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 700; color: #eaf6ff;',
    '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-color-filter { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }',
    '.rel-color-btn { width: 18px; height: 18px; padding: 0; cursor: pointer; border-radius: 50%;',
    '  background: var(--rc); border: 1px solid rgba(255, 255, 255, 0.28); opacity: 0.62;',
    '  transition: opacity .15s, transform .15s, box-shadow .15s; }',
    '.rel-color-btn:hover { opacity: 1; transform: scale(1.1); }',
    '.rel-color-btn.on { opacity: 1; border-color: #fff; transform: scale(1.16);',
    '  box-shadow: 0 0 0 2px rgba(8, 20, 38, 0.9), 0 0 0 3.5px var(--rc), 0 0 12px var(--rc); }',
    '.rel-hint { flex-shrink: 0; font-size: 12px; color: rgba(180, 214, 248, 0.75); }',
    '.rel-add { flex-shrink: 0; height: 25px; padding: 0 12px; cursor: pointer; font-family: inherit; font-size: 12.5px;',
    '  color: #eaf6ff; background: rgba(30, 70, 130, 0.65); border: 1px solid rgba(90, 170, 255, 0.5); border-radius: 6px; }',
    '.rel-add:hover { background: rgba(50, 120, 210, 0.85); color: #fff; }',
    '.rel-menu-wrap { position: relative; flex-shrink: 0; }',
    '.rel-more { width: 25px; height: 25px; padding: 0 0 6px; cursor: pointer; font-family: inherit; font-size: 17px; line-height: 1;',
    '  color: #eaf6ff; background: rgba(30, 70, 130, 0.65); border: 1px solid rgba(90, 170, 255, 0.5); border-radius: 6px; }',
    '.rel-more:hover { background: rgba(50, 120, 210, 0.85); color: #fff; }',
    '.rel-menu { position: absolute; z-index: 60; top: calc(100% + 4px); right: 0; min-width: 118px; padding: 4px;',
    '  display: flex; flex-direction: column; gap: 1px; background: rgba(8, 20, 38, 0.98);',
    '  border: 1px solid rgba(90, 170, 255, 0.45); border-radius: 7px; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.62); }',
    '.rel-menu.hidden { display: none; }',
    '.rel-menu-item { padding: 7px 12px; cursor: pointer; font-family: inherit; font-size: 12.5px; color: #dce9f8;',
    '  text-align: left; background: none; border: 0; border-radius: 5px; }',
    '.rel-menu-item:hover { background: rgba(60, 130, 215, 0.4); color: #fff; }',
    '.rel-list { flex: 1; min-height: 0; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px; }',
    '.rel-empty { padding: 34px 14px; text-align: center; color: var(--da-dim); font-size: 13px; line-height: 1.9; }',
    '.rel-card { position: relative; padding: 10px 11px; border-radius: 10px; background: rgba(12, 28, 50, 0.62);',
    '  border: 1px solid var(--da-line); transition: border-color .15s, box-shadow .15s; }',
    '.rel-card:hover { border-color: var(--da-line-2); }',
    '.rel-card.sel { border-color: #9ef0ff; box-shadow: 0 0 0 1px rgba(158, 240, 255, 0.4), 0 0 16px rgba(0, 210, 255, 0.28); }',
    '.rel-card.confirm { border-color: #e05a5a; box-shadow: 0 0 0 1px rgba(224, 90, 90, 0.5); }',
    '.rel-card-head { display: flex; align-items: center; gap: 8px; }',
    '.rel-card:not(.sel) .rel-card-head { cursor: pointer; }',
    '.rel-card:not(.sel):hover .rel-name { color: #fff; }',
    '.rel-dot { flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%; background: var(--rc, #4aa8ff);',
    '  box-shadow: 0 0 8px var(--rc, #4aa8ff); }',
    '.rel-name { font-size: 14px; font-weight: 700; color: #eaf6ff; white-space: nowrap; }',
    '.rel-org { flex: 1; min-width: 0; font-size: 12px; color: var(--da-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-mini { flex-shrink: 0; height: 22px; padding: 0 8px; cursor: pointer; font-family: inherit; font-size: 11.5px;',
    '  color: #cfe6ff; background: rgba(16, 38, 68, 0.7); border: 1px solid rgba(90, 170, 255, 0.35); border-radius: 5px; }',
    '.rel-mini:hover { background: rgba(42, 92, 155, 0.9); color: #fff; }',
    '.rel-mini.rel-danger:hover { background: rgba(170, 50, 60, 0.9); border-color: #e88; color: #fff; }',
    '.rel-mini.rel-danger-on { background: #b3243b; border-color: #ff9a9a; color: #fff; }',
    '.rel-links { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }',
    '.rel-chip { display: inline-flex; align-items: center; gap: 1px; max-width: 100%; padding: 0 6px;',
    '  cursor: pointer; font-family: inherit; font-size: 10.5px; line-height: 1.65; color: #dce9f8;',
    '  background: rgba(70, 140, 220, 0.12); border: 1px solid rgba(90, 170, 255, 0.28); border-radius: 999px; }',
    '.rel-chip:hover { border-color: #7fc4ff; background: rgba(70, 140, 220, 0.26); }',
    '.rel-chip.on { border-color: #9ef0ff; background: rgba(40, 140, 220, 0.5); color: #fff;',
    '  box-shadow: 0 0 8px rgba(0, 210, 255, 0.45); }',
    '.rel-chip-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-chip-rel { flex-shrink: 0; color: #9ef0ff; font-size: 10px; }',
    '.rel-add-form { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }',
    '.rel-input { height: 24px; padding: 0 7px; font-family: inherit; font-size: 12px; color: #eaf6ff;',
    '  background: rgba(6, 16, 32, 0.85); border: 1px solid var(--da-line-2); border-radius: 5px; outline: none; min-width: 0; }',
    '.rel-input:focus { border-color: var(--da-accent); box-shadow: 0 0 8px rgba(74, 168, 255, 0.35); }',
    '.rel-sel { flex: 0 0 100px; width: 100px; padding-right: 18px; }',
    '.rel-combo { position: relative; flex: 0 0 100px; display: flex; align-items: center; }',
    '.rel-combo-btn { position: absolute; right: 3px; top: 50%; width: 15px; height: 18px; padding: 0; transform: translateY(-50%);',
    '  cursor: pointer; font-family: inherit; font-size: 9px; line-height: 1; color: #9fbcd8; background: none; border: 0; }',
    '.rel-combo-btn:hover { color: #fff; }',
    '.rel-combo-list { position: absolute; z-index: 40; top: calc(100% + 3px); left: 0; width: 196px; max-height: 168px; overflow-y: auto;',
    '  padding: 3px; display: flex; flex-direction: column; gap: 1px; background: rgba(8, 20, 38, 0.98);',
    '  border: 1px solid rgba(90, 170, 255, 0.45); border-radius: 6px; box-shadow: 0 12px 26px rgba(0, 0, 0, 0.6); }',
    '.rel-combo-list.hidden { display: none; }',
    '.rel-opt { display: flex; align-items: baseline; gap: 6px; width: 100%; padding: 4px 7px; cursor: pointer;',
    '  font-family: inherit; font-size: 12px; color: #dce9f8; text-align: left; background: none; border: 0; border-radius: 4px; }',
    '.rel-opt:hover, .rel-opt.on { background: rgba(60, 130, 215, 0.38); color: #fff; }',
    '.rel-opt-name { flex-shrink: 0; }',
    '.rel-opt-org { min-width: 0; font-size: 10.5px; color: rgba(150, 190, 230, 0.8); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-opt-empty { padding: 6px 8px; font-size: 11.5px; color: var(--da-dim); }',
    '.rel-rel { flex: 1 1 84px; }',
    '.rel-dir { display: flex; align-items: center; gap: 2px; }',
    '.rel-dir-btn { width: 22px; height: 24px; padding: 0; cursor: pointer; font-family: inherit; font-size: 12px;',
    '  line-height: 1; color: #9fbcd8; background: rgba(16, 38, 68, 0.7); border: 1px solid rgba(90, 170, 255, 0.3); border-radius: 5px; }',
    '.rel-dir-btn.active { color: #fff; background: linear-gradient(160deg, #1c92e0, #0a7ec9); border-color: #9ef0ff; }',
    '.rel-graph { flex: 1; min-height: 0; position: relative; overflow: hidden;',
    '  background-color: var(--da-surface);',
    '  background-image: radial-gradient(circle, rgba(90, 150, 220, 0.16) 1px, transparent 1px);',
    '  background-position: 0 0; }',
    '.rel-graph svg { display: block; width: 100%; height: 100%; touch-action: none; user-select: none; -webkit-user-select: none; }',
    '.rel-graph-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;',
    '  color: var(--da-dim); font-size: 13px; line-height: 2; text-align: center; padding: 20px; }',
    '.rel-node { cursor: grab; }',
    '.rel-node.dragging { cursor: grabbing; }',
    '.rel-node-shape { transition: transform .22s ease, opacity .22s ease; transform-origin: center; transform-box: fill-box; }',
    '.rel-node.rel-dim .rel-node-shape, .rel-node.rel-dim .rel-node-label { transform: scale(0.7); opacity: 0.7; }',
    '.rel-node-label { transition: transform .22s ease, opacity .22s ease; transform-origin: center; transform-box: fill-box; }',
    '.rel-link-line { stroke: rgba(96, 160, 235, 0.5); stroke-width: 1.4; }',
    '.rel-link-label { font-family: inherit; font-size: 11px; fill: #a9cdea; paint-order: stroke; stroke: rgba(7, 18, 34, 0.92); stroke-width: 4px; }',
    '.rel-info-box { width: 780px; max-width: 94vw; }',
    '.rel-info-grid { display: flex; gap: 16px; align-items: stretch; }',
    '.rel-info-left { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 10px; }',
    '.rel-info-right { flex: 0 0 186px; display: flex; flex-direction: column; gap: 8px; align-items: center; }',
    '.rel-row { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: rgba(190, 215, 240, 0.85); }',
    '.rel-row > span:first-child { flex: 0 0 84px; text-align: right; }',
    '.rel-row input { flex: 1 1 0; min-width: 0; height: 32px; padding: 0 9px; font-family: inherit; font-size: 13px;',
    '  color: #eaf6ff; background: rgba(6, 16, 32, 0.9); border: 1px solid var(--da-line-2); border-radius: 6px; outline: none; }',
    '.rel-row input:focus { border-color: var(--da-accent); box-shadow: 0 0 8px rgba(74, 168, 255, 0.3); }',
    '.rel-field { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; color: rgba(190, 215, 240, 0.85); }',
    '.rel-field textarea { padding: 7px 9px; font-family: inherit; font-size: 13px; color: #eaf6ff; line-height: 1.8;',
    '  background: rgba(6, 16, 32, 0.9); border: 1px solid var(--da-line-2); border-radius: 6px; outline: none; resize: vertical; }',
    '.rel-field textarea:focus { border-color: var(--da-accent); box-shadow: 0 0 8px rgba(74, 168, 255, 0.3); }',
    '.rel-photo { width: 178px; height: 246px; box-sizing: border-box; padding: 12px; position: relative; overflow: hidden;',
    '  display: flex; align-items: center; justify-content: center; text-align: center; cursor: text; outline: none;',
    '  color: rgba(160, 200, 240, 0.72); background: rgba(8, 20, 38, 0.55);',
    '  border: 1.5px dashed rgba(120, 190, 255, 0.55); border-radius: 10px; transition: border-color .18s, background .18s; }',
    '.rel-photo:hover, .rel-photo:focus { border-color: #9ef0ff; background: rgba(20, 50, 90, 0.6); color: #dceeff; }',
    '.rel-photo.ready { border-color: #9ef0ff; box-shadow: 0 0 0 3px rgba(158, 240, 255, 0.18); background: rgba(20, 50, 90, 0.6); }',
    '.rel-photo.dragover { border-color: #9ef0ff; background: rgba(30, 70, 120, 0.7); }',
    '.rel-photo img { display: none; width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }',
    '.rel-photo.has { padding: 0; border-style: solid; border-color: rgba(120, 190, 255, 0.45); cursor: text; }',
    '.rel-photo.has img { display: block; }',
    '.rel-photo.has .rel-photo-empty { display: none; }',
    '.rel-photo-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }',
    '.rel-photo-tip { font-size: 13px; letter-spacing: .5px; color: rgba(190, 220, 250, 0.85); }',
    '.rel-photo-add { width: 86px; height: 86px; padding: 0 0 5px; cursor: pointer; font-size: 50px; line-height: 1;',
    '  font-family: inherit; color: #9ef0ff; background: rgba(10, 30, 56, 0.75); border: 2px dashed rgba(120, 190, 255, 0.75);',
    '  border-radius: 16px; display: flex; align-items: center; justify-content: center; transition: all .18s; }',
    '.rel-photo-add:hover { color: #fff; border-color: #9ef0ff; background: rgba(30, 80, 140, 0.75); box-shadow: 0 0 14px rgba(0, 210, 255, 0.35); }',
    '.rel-photo-sub { padding: 0 6px; font-size: 11px; line-height: 1.6; color: rgba(150, 190, 230, 0.62); }',
    '.rel-colors { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }',
    '.rel-swatch { width: 22px; height: 22px; padding: 0; cursor: pointer; border-radius: 50%;',
    '  border: 2px solid rgba(255, 255, 255, 0.22); }',
    '.rel-swatch:hover { border-color: rgba(255, 255, 255, 0.65); }',
    '.rel-swatch.on { border-color: #fff; box-shadow: 0 0 0 2px rgba(158, 240, 255, 0.85); }',
    '.rel-color-name { font-size: 12px; color: rgba(180, 214, 248, 0.8); }',
    '.rel-profile { display: flex; flex-direction: column; gap: 14px; }',
    '.rel-profile-top { display: flex; align-items: center; gap: 14px; }',
    '.rel-avatar { flex-shrink: 0; width: 58px; height: 58px; border-radius: 50%; overflow: hidden; display: flex;',
    '  align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: #eaf6ff;',
    '  background: radial-gradient(circle at 35% 30%, rgba(120, 205, 255, 0.9), rgba(12, 52, 96, 0.95));',
    '  border: 1px solid rgba(158, 240, 255, 0.5); box-shadow: 0 0 16px rgba(0, 210, 255, 0.35); }',
    '.rel-avatar img { width: 100%; height: 100%; object-fit: cover; }',
    '.rel-avatar-name { width: 100%; height: 100%; padding: 3px; box-sizing: border-box; display: flex;',
    '  align-items: center; justify-content: center; text-align: center; font-weight: 700; line-height: 1.12;',
    '  word-break: break-all; letter-spacing: 0; }',
    '.rel-profile-name { font-size: 18px; font-weight: 700; color: #eaf6ff; }',
    '.rel-profile-org { margin-top: 4px; font-size: 12.5px; color: var(--da-dim); }',
    '.rel-profile-sec { padding-top: 12px; border-top: 1px dashed var(--da-line-2); }',
    '.rel-profile-label { margin-bottom: 7px; font-size: 12px; letter-spacing: 1px; color: rgba(160, 200, 240, 0.8); }',
    '.rel-profile-info { font-size: 13px; line-height: 1.9; color: var(--da-text); white-space: pre-wrap; }',
    '.rel-profile-links { display: flex; flex-wrap: wrap; gap: 5px; }',
    '.rel-profile-link { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--da-muted); }',
    '.rel-profile-link b { color: #eaf6ff; font-weight: 600; }',
    '.rel-profile-arrow { color: #9ef0ff; }',

    '/* ---- 第 37 轮：多选色系 / 缩放 / 版记 / 簇拖动 / 关系弹窗 ---- */',
    '.rel-color-filter.multi { padding: 3px 6px; border: 1px dashed rgba(158, 240, 255, 0.8);',
    '  border-radius: 999px; background: rgba(40, 140, 220, 0.12); }',
    '.rel-color-filter.multi .rel-color-btn { opacity: 0.85; }',
    '.rel-head-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }',
    '.rel-ico-btn { width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center;',
    '  padding: 0; cursor: pointer; color: #dceeff; background: rgba(12, 32, 60, 0.55);',
    '  border: 1px solid rgba(90, 170, 255, 0.4); border-radius: 6px; font-family: inherit; }',
    '.rel-ico-btn:hover { background: rgba(30, 70, 130, 0.85); color: #fff; }',
    '.rel-ico-btn.active { color: #fff; background: linear-gradient(160deg, #1c92e0, #0a7ec9);',
    '  border-color: #9ef0ff; box-shadow: 0 0 10px rgba(0, 210, 255, 0.45); }',
    '.rel-zoom { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }',
    '.rel-zoom-btn { width: 22px; height: 24px; padding: 0 0 2px; cursor: pointer; font-family: inherit; font-size: 14px;',
    '  line-height: 1; color: #dceeff; background: rgba(12, 32, 60, 0.55);',
    '  border: 1px solid rgba(90, 170, 255, 0.4); border-radius: 5px; }',
    '.rel-zoom-btn:hover { background: rgba(30, 70, 130, 0.85); color: #fff; }',
    '.rel-zoom-val { min-width: 42px; text-align: center; font-size: 11.5px; color: #cfe6ff; cursor: pointer;',
    '  user-select: none; }',
    '.rel-zoom-val:hover { color: #fff; }',
    '.rel-graph { border-bottom: none; }',
    '.rel-wrap.rel-g-mid .rel-listcol, .rel-wrap.rel-g-full .rel-listcol { display: none; }',
    /* 整屏全屏：关系拓扑独占视口 */
    '#relGraphCol.rel-g-screen { position: fixed !important; inset: 0 !important;',
    '  width: auto !important; height: auto !important; margin: 0 !important;',
    '  border-radius: 0; z-index: 45000; display: flex; flex-direction: column;',
    '  min-width: 0; min-height: 0; background: var(--da-surface); }',
    'body.rel-g-screen-lock { overflow: hidden; }',
    '.rel-link-line.rel-dash { stroke-dasharray: 7 5; }',
    '.rel-node.rel-pick .rel-node-shape { filter: drop-shadow(0 0 8px #9ef0ff); }',
    '.rel-node.rel-pick > .rel-node-shape > circle:last-of-type,',
    '.rel-node.rel-pick > .rel-node-shape > circle { stroke-width: 2.6; }',
    '.rel-node.rel-cluster { cursor: move; }',
    '.rel-link-modal { width: 720px; max-width: 94vw; }',
    '/* 单行布局：人员：框  关系：框  → ← ↔  人员：框 */',
    '.rel-lk-line { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }',
    '.rel-lk-lab { flex-shrink: 0; font-size: 12px; letter-spacing: .5px; color: rgba(160, 200, 240, 0.85); }',
    '.rel-lk-input { height: 32px; box-sizing: border-box; padding: 0 9px; font-family: inherit;',
    '  font-size: 13px; color: #eaf6ff; background: rgba(6, 16, 32, 0.9);',
    '  border: 1px solid var(--da-line-2); border-radius: 7px; outline: none; min-width: 0; }',
    '.rel-lk-input:focus { border-color: var(--da-accent); box-shadow: 0 0 8px rgba(74, 168, 255, 0.3); }',
    '.rel-lk-name { flex: 0 0 96px; width: 96px; font-weight: 700; text-align: center; }',
    '.rel-lk-rel { flex: 1 1 auto; min-width: 90px; }',
    '.rel-lk-head-hint { flex: 1; min-width: 0; margin: 0 12px; text-align: right; font-size: 11px;',
    '  color: rgba(170, 210, 255, 0.7); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-lk-head-hint.warn { color: #f0b556; }',
    '.rel-lk-dirs { display: flex; gap: 4px; flex-shrink: 0; }',
    '.rel-lk-dirs button { height: 26px; min-width: 28px; padding: 0 6px; cursor: pointer; font-family: inherit; font-size: 13px;',
    '  color: #9fbcd8; background: rgba(16, 38, 68, 0.7); border: 1px solid rgba(90, 170, 255, 0.3);',
    '  border-radius: 6px; }',
    '.rel-lk-dirs button.on { color: #fff; background: linear-gradient(160deg, #1c92e0, #0a7ec9);',
    '  border-color: #9ef0ff; }',
    '.rel-lk-list { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--da-line-2);',
    '  display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; }',
    '.rel-lk-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 7px;',
    '  background: rgba(12, 28, 50, 0.62); border: 1px solid var(--da-line); }',
    '.rel-lk-row.on { border-color: #9ef0ff; box-shadow: 0 0 0 1px rgba(158, 240, 255, 0.3); }',
    '.rel-lk-row-text { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; font-size: 12.5px;',
    '  color: #dce9f8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-lk-row-text b { color: #eaf6ff; font-weight: 600; }',
    '.rel-lk-row-arrow { flex-shrink: 0; color: #9ef0ff; font-size: 13px; }',
    '.rel-lk-row-dash { flex-shrink: 0; padding: 0 4px; font-size: 10px; color: #f0b556;',
    '  border: 1px dashed rgba(240, 181, 86, 0.7); border-radius: 999px; }',
    '.rel-lk-empty { padding: 8px 4px; font-size: 12px; color: var(--da-dim); }',
    '.rel-head-input { flex-shrink: 0; height: 24px; margin-left: 14px; padding: 0 12px; cursor: pointer;',
    '  font-family: inherit; font-size: 12px; letter-spacing: .5px; color: #cfe6ff;',
    '  background: rgba(16, 38, 68, 0.8); border: 1px solid rgba(90, 170, 255, 0.45); border-radius: 6px; }',
    '.rel-head-input:hover { background: rgba(42, 92, 155, 0.9); color: #fff; }',
    '.rel-head-input.active { color: #fff; background: linear-gradient(160deg, #1c92e0, #0a7ec9); border-color: #9ef0ff; }',
    '.rel-batch { display: flex; gap: 14px; min-height: 360px; }',
    '.rel-batch-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 8px; }',
    '.rel-batch-title { font-size: 12px; letter-spacing: 1px; color: rgba(160, 200, 240, 0.85);',
    '  display: flex; align-items: center; gap: 8px; }',
    '.rel-batch-count { font-size: 11px; color: #9ef0ff; }',
    '#relBatchText { flex: 1; min-height: 260px; padding: 9px 10px; resize: none; box-sizing: border-box;',
    '  font-family: inherit; font-size: 12.5px; line-height: 1.75; color: #eaf6ff;',
    '  background: rgba(6, 16, 32, 0.9); border: 1px solid var(--da-line-2); border-radius: 7px; outline: none; }',
    '#relBatchText:focus { border-color: var(--da-accent); box-shadow: 0 0 8px rgba(74, 168, 255, 0.3); }',
    '.rel-batch-tools { display: flex; gap: 6px; justify-content: flex-end; }',
    '.rel-batch-list { flex: 1; min-height: 0; max-height: 320px; overflow-y: auto;',
    '  display: flex; flex-direction: column; gap: 7px; padding-right: 4px; }',
    '.rel-batch-card { padding: 8px 10px; border-radius: 7px; background: rgba(12, 28, 50, 0.66);',
    '  border: 1px solid var(--da-line); }',
    '.rel-batch-card.dup { border-color: rgba(240, 181, 86, 0.7); background: rgba(60, 44, 12, 0.5); }',
    '.rel-batch-card-head { display: flex; align-items: baseline; gap: 8px; min-width: 0; }',
    '.rel-batch-name { font-size: 13.5px; font-weight: 700; color: #eaf6ff; }',
    '.rel-batch-org { flex: 1; min-width: 0; font-size: 11.5px; color: rgba(170, 205, 240, 0.8);',
    '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-batch-tag { flex-shrink: 0; padding: 0 5px; font-size: 10px; line-height: 1.6; color: #f0b556;',
    '  border: 1px solid rgba(240, 181, 86, 0.7); border-radius: 999px; }',
    '.rel-batch-info { margin-top: 4px; font-size: 11.5px; line-height: 1.6;',
    '  color: rgba(190, 215, 240, 0.82); white-space: pre-wrap; word-break: break-word; }',
    '.rel-batch-empty { padding: 24px 10px; text-align: center; font-size: 12px; line-height: 1.9;',
    '  color: var(--da-dim); }',
    '.rel-batch-hint { margin-right: auto; font-size: 11.5px; color: rgba(160, 198, 236, 0.7); }',
    '.rel-info-links { padding-top: 10px; border-top: 1px dashed var(--da-line-2); }',
    '.rel-info-links-head { display: flex; align-items: center; justify-content: space-between;',
    '  margin-bottom: 7px; font-size: 12px; letter-spacing: 1px; color: rgba(160, 200, 240, 0.8); }',
    '.rel-add-form { align-items: flex-start; }',
    '.rel-note { flex: 1 1 140px; height: 54px; min-height: 54px; padding: 5px 8px; resize: vertical;',
    '  line-height: 1.45; font-size: 11.5px; box-sizing: border-box; }',
    '.rel-save { align-self: center; }',
    '.rel-graph { cursor: default; }',
    '.rel-graph.panning { cursor: grabbing; }',
    '.rel-link-label { cursor: pointer; }',
    '.rel-link-label:hover { fill: #fff; }',
    '.rel-tip { position: fixed; z-index: 60000; display: none; max-width: 320px; max-height: 240px;',
    '  overflow: auto; padding: 8px 11px; pointer-events: none; font-size: 12px; line-height: 1.6;',
    '  color: #dce9f8; white-space: pre-wrap; word-break: break-word;',
    '  background: rgba(8, 20, 38, 0.97); border: 1px solid rgba(90, 170, 255, 0.45);',
    '  border-radius: 8px; box-shadow: 0 8px 26px rgba(0, 0, 0, 0.55); }',
    '.rel-tip-head { display: block; margin-bottom: 4px; font-size: 11px;',
    '  color: #9ef0ff; letter-spacing: .5px; }',
    '.rel-lk-note { width: 100%; box-sizing: border-box; min-height: 56px; padding: 6px 9px;',
    '  font-family: inherit; font-size: 12px; line-height: 1.5; color: #eaf6ff;',
    '  background: rgba(6, 16, 32, 0.9); border: 1px solid var(--da-line-2); border-radius: 7px;',
    '  outline: none; resize: vertical; }',
    '.rel-lk-note:focus { border-color: var(--da-accent); box-shadow: 0 0 8px rgba(74, 168, 255, 0.3); }',
    '.rel-lk-note-row { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }',
    '.rel-lk-note-row > label { font-size: 11.5px; letter-spacing: .5px; color: rgba(160, 200, 240, 0.8); }',
    '.rel-lk-row-note { flex: 1 1 100%; margin-top: 3px; font-size: 11px; line-height: 1.5;',
    '  color: rgba(170, 205, 240, 0.78); white-space: pre-wrap; word-break: break-word; }',
    /* ---- 问题分析（第 41 轮，蓝色调） ---- */
    '.rel-listcol, .rel-graphcol { position: relative; }',
    /* 分析按钮：关系拓扑标题栏右侧，蓝色主按钮 */
    '.rel-analysis-btn { flex-shrink: 0; height: 25px; padding: 0 11px; cursor: pointer; font-family: inherit;',
    '  font-size: 12px; font-weight: 700; letter-spacing: .5px; color: #eaf6ff;',
    '  background: linear-gradient(160deg, rgba(40, 116, 190, 0.95), rgba(20, 78, 140, 0.95));',
    '  border: 1px solid rgba(110, 190, 255, 0.62); border-radius: 6px;',
    '  box-shadow: inset 0 1px 0 rgba(190, 230, 255, 0.22); }',
    '.rel-analysis-btn:hover { color: #fff; border-color: #9ef0ff;',
    '  background: linear-gradient(160deg, rgba(56, 146, 226, 1), rgba(24, 98, 172, 1));',
    '  box-shadow: inset 0 1px 0 rgba(210, 240, 255, 0.3), 0 0 10px rgba(74, 168, 255, 0.45); }',
    '.rel-analysis-btn.on { color: #06243d; border-color: #d5f2ff;',
    '  background: linear-gradient(160deg, #9ef0ff, #4aa8ff);',
    '  box-shadow: 0 0 12px rgba(74, 168, 255, 0.6); }',
    /* 覆盖层：盖住左栏人员列表，整体蓝色调 */
    /* 问题分析 = 左栏第 2 页（与人员列表互斥） */
    '.rel-listcol.page-issue .rel-list { display: none; }',
    '.rel-page-tab { flex: 1; min-width: 0; text-align: left; padding: 0; cursor: pointer;',
    '  font-family: inherit; font-size: 13px; font-weight: 700; color: #eaf6ff; background: none;',
    '  border: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-page-tab:hover { color: #9ef0ff; }',
    '.rel-page-tab.on { color: #9ef0ff; }',
    '.rel-page-tab::after { content: " ⇄"; font-size: 10px; opacity: .6; }',
    '.rel-head-tools { display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: auto; }',
    '.rel-head-tools .rel-add, .rel-head-tools .rel-more, .rel-head-tools .rel-issue-mini {',
    '  white-space: nowrap; flex-shrink: 0; }',
    '.rel-head-tools .rel-color-filter { margin-right: 2px; }',
    '.rel-issue-panel { position: relative; flex: 1 1 auto; min-height: 0; z-index: 30;',
    '  display: none; flex-direction: column; border-top: none; box-shadow: none;',
    '  background: linear-gradient(180deg, rgba(16, 38, 64, 0.98), rgba(8, 20, 36, 0.99));',
    '  border-top: 1px solid rgba(90, 170, 255, 0.35);',
    '  box-shadow: inset 0 1px 0 rgba(160, 210, 255, 0.08); }',
    '.rel-issue-panel.show { display: flex; }',
    /* 整屏全屏时的浮动窗口：左上角默认位置，可拖动 */
    '.rel-issue-panel.rel-issue-float { position: fixed; left: 12px; top: 58px; right: auto; bottom: auto;',
    '  width: 380px; max-width: calc(100vw - 24px); height: calc(100vh - 92px);',
    '  max-height: calc(100vh - 92px); min-height: 240px; z-index: 46000;',
    '  border: 1px solid rgba(90, 170, 255, 0.55); border-radius: 10px;',
    '  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(160, 210, 255, 0.1); }',
    '.rel-issue-panel.rel-issue-float .rel-issue-bar { cursor: move; user-select: none;',
    '  border-radius: 10px 10px 0 0; }',
    '.rel-issue-panel.rel-issue-float .rel-issue-body { overflow-y: auto; }',
    '.rel-issue-drag { display: none; }',
    '.rel-issue-panel.rel-issue-float .rel-issue-drag { display: block; flex: 0 0 20px;',
    '  cursor: move; background: rgba(26, 60, 100, 0.75); border-radius: 10px 10px 0 0;',
    '  border-bottom: 1px solid rgba(90, 170, 255, 0.3); position: relative; }',
    '.rel-issue-panel.rel-issue-float .rel-issue-drag::after { content: ""; position: absolute;',
    '  left: 50%; top: 50%; width: 34px; height: 3px; transform: translate(-50%, -50%);',
    '  border-radius: 2px; background: rgba(150, 200, 240, 0.5); }',
    '.rel-issue-bar { flex-shrink: 0; display: flex; align-items: center; gap: 7px; height: 40px; padding: 0 10px;',
    '  border-bottom: 1px solid rgba(90, 170, 255, 0.28);',
    '  background: linear-gradient(180deg, rgba(26, 60, 100, 0.7), rgba(14, 32, 56, 0.25)); }',
    '.rel-issue-title { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 700; letter-spacing: 1px;',
    '  color: #bfe6ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-issue-body { flex: 1; min-height: 0; overflow-y: auto; padding: 9px; display: flex; flex-direction: column; gap: 7px; }',
    '.rel-issue-empty { padding: 26px 12px; text-align: center; font-size: 12px; line-height: 1.9; color: var(--da-dim); }',
    '.rel-issue-row { position: relative; display: flex; align-items: center; gap: 7px; padding: 7px 9px; cursor: pointer;',
    '  border-radius: 8px; background: linear-gradient(180deg, rgba(26, 54, 90, 0.72), rgba(12, 30, 54, 0.82));',
    '  border: 1px solid rgba(90, 170, 255, 0.24); transition: border-color .15s, background .15s; }',
    '.rel-issue-row:hover { background: linear-gradient(180deg, rgba(38, 78, 126, 0.9), rgba(18, 44, 78, 0.92));',
    '  border-color: rgba(110, 200, 255, 0.6); }',
    '.rel-issue-row.active { background: linear-gradient(180deg, rgba(34, 96, 158, 0.95), rgba(16, 56, 100, 0.95));',
    '  border-color: #7fd4ff; box-shadow: inset 3px 0 0 0 #7fd4ff, 0 0 10px rgba(74, 168, 255, 0.28); }',
    '.rel-issue-row.dragging { opacity: .55; }',
    '.rel-issue-idx { flex-shrink: 0; width: 18px; text-align: center; font-size: 11px; font-weight: 700;',
    '  color: #6fc4ff; font-variant-numeric: tabular-nums; }',
    '.rel-issue-name { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 700; color: #eaf6ff;',
    '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-issue-sub { flex-shrink: 0; font-size: 10.5px; color: rgba(160, 205, 245, 0.72); }',
    '.rel-issue-mini { flex-shrink: 0; height: 22px; padding: 0 7px; cursor: pointer; font-family: inherit;',
    '  font-size: 11px; color: #cfe9ff; background: rgba(30, 70, 116, 0.7);',
    '  border: 1px solid rgba(90, 170, 255, 0.45); border-radius: 5px; }',
    '.rel-issue-mini:hover { background: rgba(48, 110, 176, 0.95); color: #fff; border-color: #9ef0ff; }',
    '.rel-fx-row .rel-issue-mini { padding: 0 5px; font-size: 10.5px; }',
    '.rel-fx-row .rel-fx-color { width: 28px; height: 20px; }',
    '.rel-issue-mini.danger:hover { background: rgba(150, 46, 46, 0.9); border-color: #e07070; color: #fff; }',
    '.rel-issue-field { display: flex; flex-direction: column; gap: 5px; }',
    '.rel-issue-field > label { font-size: 11.5px; letter-spacing: .5px; color: rgba(170, 212, 250, 0.85); }',
    '.rel-issue-input, .rel-issue-desc { width: 100%; box-sizing: border-box; padding: 7px 9px;',
    '  font-family: inherit; font-size: 12.5px; line-height: 1.6; color: #eaf6ff;',
    '  background: rgba(6, 18, 32, 0.92); border: 1px solid rgba(90, 170, 255, 0.3);',
    '  border-radius: 6px; outline: none; }',
    '.rel-issue-desc { min-height: 136px; resize: vertical; }',
    '.rel-issue-input:focus, .rel-issue-desc:focus { border-color: #7fd4ff; box-shadow: 0 0 8px rgba(74, 168, 255, 0.35); }',
    /* 涉及对象：一行一人，至少露出 6 行；未勾选 70% 透明，勾选后实心 */
    '.rel-issue-checks { display: flex; flex-direction: column; gap: 2px; min-height: 138px; max-height: 232px;',
    '  overflow-y: auto; padding: 2px 0; background: none; border: none; }',
    '.rel-issue-chk { display: flex; align-items: center; gap: 7px; height: 22px; padding: 0 5px;',
    '  border-radius: 5px; cursor: pointer; font-size: 12px; color: #d8e9fb; opacity: .7;',
    '  transition: opacity .15s, background .15s; }',
    '.rel-issue-chk:hover { opacity: .92; background: rgba(40, 88, 140, 0.5); }',
    '.rel-issue-chk.on { opacity: 1; font-weight: 700; color: #eaf6ff; background: rgba(30, 78, 128, 0.55); }',
    '.rel-issue-chk input { flex-shrink: 0; accent-color: #4aa8ff; margin: 0; }',
    '.rel-issue-chk .dot { flex-shrink: 0; width: 8px; height: 8px; border-radius: 50%; background: var(--rc); }',
    '.rel-issue-chk .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    /* 三个分区：具体情形 / 涉及对象 / 关联关系 */
    '.rel-isec { flex-shrink: 0; border-radius: 8px; background: rgba(14, 34, 58, 0.6);',
    '  border: 1px solid rgba(90, 170, 255, 0.22); overflow: hidden; }',
    '.rel-isec-head { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 9px;',
    '  cursor: pointer; user-select: none; background: rgba(22, 50, 82, 0.72);',
    '  transition: background .15s; }',
    '.rel-isec-head:hover { background: rgba(34, 74, 118, 0.9); }',
    '.rel-isec-head.open { border-bottom: 1px solid rgba(90, 170, 255, 0.22); }',
    /* 标题栏右侧的「步骤 / 脚本」切换 */
    '.rel-isec-tabs { margin-left: auto; display: flex; align-items: center; gap: 2px; flex-shrink: 0;',
    '  padding: 2px; border-radius: 6px; background: rgba(8, 24, 42, 0.7);',
    '  border: 1px solid rgba(90, 170, 255, 0.28); }',
    '.rel-isec-tab { height: 20px; padding: 0 9px; cursor: pointer; font-family: inherit; font-size: 11px;',
    '  color: #a9cdea; background: transparent; border: 0; border-radius: 4px; }',
    '.rel-isec-tab:hover { color: #e6f5ff; }',
    '.rel-isec-tab.on { color: #06243d; background: #6fc4ff; font-weight: 700; }',
    /* 脚本模式：透明 textarea 叠在高亮层上 */
    '.rel-script-wrap { position: relative; width: 100%; min-width: 0; border-radius: 7px;',
    '  border: 1px solid rgba(90, 170, 255, 0.32); background: rgba(6, 20, 36, 0.94); overflow: hidden; }',
    '.rel-script-hl, .rel-script-area { box-sizing: border-box; width: 100%; margin: 0;',
    '  padding: 6px 10px 6px 34px; font-family: "SimSun", "宋体", "Noto Serif CJK SC", serif;',
    '  font-size: 12px; line-height: 20px; letter-spacing: 0; white-space: pre-wrap;',
    '  word-break: break-word; border: 0; tab-size: 2; }',
    '.rel-script-hl { display: block; min-height: 132px; color: #cfe4f7; pointer-events: none;',
    '  overflow-wrap: break-word; background: rgba(8, 26, 46, 0.55); }',
    '.rel-script-hl .sl { position: relative; min-height: 20px; line-height: 20px;',
    '  white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word; }',
    '.rel-script-hl .sl.blank { min-height: 10px; height: 10px; line-height: 10px; }',
    /* 步骤行：去掉「：」后整行居中、绿色黑体不加粗、上方留半行 */
    '.rel-script-hl .sl.step-head { text-align: center; margin-top: 10px; padding: 3px 0 2px;',
    '  font-family: "SimHei", "黑体", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;',
    '  font-weight: 400; color: #7fe3a6; letter-spacing: 2px; -webkit-text-fill-color: #7fe3a6; }',
    /* 行首实心圆序号：人员用其颜色，关系用出发方颜色 */
    '.rel-script-hl .sn { position: absolute; left: -24px; top: 1px; width: 16px; height: 16px;',
    '  border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;',
    '  font-family: "SimHei", "Microsoft YaHei", sans-serif; font-size: 9.5px; line-height: 1;',
    '  font-weight: 700; color: #fff; background: #6fc4ff; box-shadow: 0 0 0 1px rgba(255,255,255,.18); }',
    '.rel-script-hl .sn.wide { font-size: 8px; letter-spacing: -0.5px; }',
    '.rel-script-area { position: absolute; inset: 0; height: 100%; resize: none; outline: none;',
    '  background: transparent; color: transparent; caret-color: #9ef0ff; overflow: auto; }',
    '.rel-script-area::selection { background: rgba(111, 196, 255, 0.35); }',
    '.rel-script-hl .k { font-family: "SimHei", "黑体", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;',
    '  font-weight: 700; color: #74b7e6; }',
    '.rel-script-hl .s { color: #e3c88a; }',
    '.rel-script-hl .note { color: #8ecf9a; }',
    '.rel-script-hl .num { color: #e0a9b9; }',
    '.rel-script-hl .col { color: #b4a4d8; }',
    '.rel-script-hl .step { font-family: "SimHei", "黑体", "Microsoft YaHei", sans-serif;',
    '  font-weight: 400; color: #7fe3a6; }',
    '.rel-script-hl .dim { color: rgba(150, 190, 225, 0.5); }',
    '.rel-script-tools { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }',
    /* 脚本编辑弹窗：宽高由 JS 设为中部满屏尺寸 */
    '.rel-script-mask { z-index: 48000; }',
    '.rel-script-box { display: flex; flex-direction: column; overflow: hidden;',
    '  width: auto; max-width: none; max-height: none; }',
    '.rel-script-box .modal-body.rel-script-body { flex: 1 1 auto; min-height: 0; display: flex; padding: 10px 12px 4px; }',
    '.rel-script-wrap-lg { flex: 1 1 auto; min-height: 0; display: flex; }',
    '.rel-script-wrap-lg .rel-script-hl { flex: 1 1 auto; min-height: 100%; overflow: hidden; }',
    '.rel-script-wrap-lg .rel-script-area { position: absolute; inset: 0; height: 100%; }',
    '.rel-script-ops { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; padding-right: 8px; }',
    '.rel-script-foot { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; justify-content: flex-end;',
    '  padding: 8px 12px 10px; border-top: 1px solid rgba(90, 170, 255, 0.22); }',
    '.rel-script-foot .rel-issue-hint { margin-right: auto; }',
    '.rel-issue-mini.primary { color: #06243d; background: #6fc4ff; border-color: #6fc4ff; font-weight: 700; }',
    '.rel-issue-mini.primary:hover { background: #9ef0ff; border-color: #9ef0ff; color: #04202f; }',
    /* 弹窗共用结构缺失时的兜底 */
    '.rel-script-box .modal-head { flex: 0 0 auto; }',
    '.rel-isec-arrow { flex-shrink: 0; width: 14px; font-size: 13px; line-height: 1; color: #7fd4ff; }',
    '.rel-isec-title { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 700; letter-spacing: .5px;',
    '  font-family: "SimHei", "黑体", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;',
    '  color: #bfe6ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-isec-body { padding: 8px 9px; display: flex; flex-direction: column; gap: 7px; }',
    '.rel-issue-name-input { font-weight: 700; }',
    '.rel-issue-name-row { display: flex; flex-direction: row; align-items: center; gap: 6px; }',
    '.rel-issue-name-row .rel-issue-name-input { flex: 1 1 auto; width: auto; min-width: 0; }',
    '.rel-issue-name-lab { flex-shrink: 0; font-size: 12.5px; font-weight: 700; letter-spacing: .5px;',
    '  font-family: "SimHei", "黑体", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif; color: #bfe6ff; }',
    '.rel-issue-field { flex-shrink: 0; }',
    '.rel-issue-steps { display: flex; flex-direction: column; gap: 6px; width: 100%; min-width: 0;',
    '  box-sizing: border-box; }',
    '.rel-issue-step { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 7px;',
    '  width: 100%; min-width: 0; box-sizing: border-box; overflow: visible; position: relative;',
    '  font-size: 11.5px; color: #d4e6f8; background: rgba(16, 38, 64, 0.88);',
    '  border: 1px solid rgba(90, 170, 255, 0.22); cursor: pointer; transition: border-color .15s, background .15s; }',
    '.rel-issue-step:hover { border-color: rgba(110, 200, 255, 0.5); }',
    /* 人员步骤：蓝调；关系步骤：绿调 */
    '.rel-issue-step.is-link { background: rgba(12, 40, 32, 0.9); border-color: rgba(80, 200, 140, 0.28); }',
    '.rel-issue-step.is-link:hover { border-color: rgba(95, 224, 160, 0.6); }',
    '.rel-issue-step.is-link.open { background: rgba(16, 56, 44, 0.96); border-color: #5fe0a0;',
    '  box-shadow: inset 3px 0 0 0 #5fe0a0; }',
    '.rel-issue-fx.is-link { background: rgba(9, 32, 26, 0.94); border-color: rgba(80, 200, 140, 0.34); }',
    '.rel-issue-fx.is-link .rel-fx-item > span { color: rgba(150, 230, 185, 0.85); }',
    '.rel-issue-fx.is-link .rel-fx-item output { color: #7ff0b8; }',
    '.rel-issue-fx.is-link .rel-fx-seg { border-color: rgba(80, 200, 140, 0.4); }',
    '.rel-issue-fx.is-link .rel-fx-seg button { color: #c9f5dd; background: rgba(10, 40, 30, 0.8);',
    '  border-right-color: rgba(80, 200, 140, 0.25); }',
    '.rel-issue-fx.is-link .rel-fx-seg button.on { color: #04261a; background: #5fe0a0; }',
    '.rel-issue-fx.is-link .rel-fx-item input[type=range] { accent-color: #46d18c; }',
    '.rel-issue-step.open { border-color: #7fd4ff; background: rgba(26, 62, 104, 0.95);',
    '  box-shadow: inset 3px 0 0 0 #7fd4ff; }',
    '.rel-issue-step .n { flex-shrink: 0; width: 18px; height: 18px; border-radius: 50%;',
    '  display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700;',
    '  color: #06243d; background: var(--nc, #6fc4ff); box-shadow: 0 0 0 2px rgba(6, 24, 42, 0.55); }',
    /* 合并块：首步编号变按钮（实心=收起 / 空心=展开），成员空位对齐 */
    '.rel-issue-step .n-grp { padding: 0; cursor: pointer; font-family: inherit; border: 1px solid var(--nc, #6fc4ff); }',
    '.rel-issue-step .n-grp.open { color: var(--nc, #6fc4ff); background: transparent; }',
    '.rel-issue-step .n-grp:hover { box-shadow: 0 0 0 2px rgba(6, 24, 42, 0.55), 0 0 8px var(--nc, #6fc4ff); }',
    '.rel-issue-step .n-blank { background: transparent; box-shadow: none; }',
    '.rel-step-row.folded { display: none; }',
    '.rel-step-row.sel .rel-issue-step { border-color: #ffd97a; box-shadow: 0 0 0 1px rgba(255, 217, 122, 0.5); }',
    '.rel-issue-step.is-mem { border-left-style: dashed; }',
    '.rel-issue-step .txt { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-issue-step .txt b { color: #9ef0ff; font-weight: 700; }',
    '.rel-issue-hint { font-size: 11px; line-height: 1.6; color: rgba(160, 205, 245, 0.62); }',
    /* 编辑界面内的效果设置 */
    /* 动效参数：仅展开的步骤显示；每项独占一行、宽度自适应不溢出 */
    '.rel-issue-fx { display: none; box-sizing: border-box; width: auto; margin: -1px 0 0 0;',
    '  padding: 7px 9px 9px; border-radius: 0 0 7px 7px;',
    '  background: rgba(10, 30, 52, 0.92); border: 1px solid rgba(90, 170, 255, 0.34);',
    '  border-top: none; box-sizing: border-box; width: 100%; min-width: 0; }',
    '.rel-issue-fx.show { display: block; }',
    '.rel-fx-grid { display: flex; flex-direction: column; gap: 6px; width: 100%; min-width: 0;',
    '  box-sizing: border-box; }',
    '.rel-fx-item { display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0;',
    '  box-sizing: border-box; font-size: 11px; color: #cfe2f4; }',
    '.rel-fx-item > span { flex: 0 0 auto; min-width: 30px; color: rgba(170, 212, 250, 0.8); }',
    '.rel-fx-item input[type=range] { flex: 1 1 auto; min-width: 40px; width: 100%; accent-color: #4aa8ff; }',
    '.rel-fx-item output { flex: 0 0 auto; min-width: 34px; text-align: right; font-variant-numeric: tabular-nums;',
    '  color: #9ef0ff; }',
    '.rel-fx-swatches { display: flex; gap: 5px; flex-wrap: wrap; }',
    '.rel-fx-swatch { width: 17px; height: 17px; padding: 0; cursor: pointer; border-radius: 50%;',
    '  background: var(--fc); border: 1px solid rgba(255, 255, 255, 0.3); opacity: .7; }',
    '.rel-fx-swatch.on { opacity: 1; border-color: #fff; box-shadow: 0 0 0 2px rgba(8, 20, 36, 0.9), 0 0 0 3px var(--fc); }',
    /* 自选颜色：与预设色板同样大小的圆形取色器 */
    '.rel-fx-pick { width: 17px; height: 17px; padding: 0; cursor: pointer; border-radius: 50%;',
    '  border: 1px solid rgba(255, 255, 255, 0.5); opacity: .8;',
    '  background: conic-gradient(#ff6b6b, #ffd97a, #a5f3a0, #7fe0ff, #e0a6ff, #ff6b6b); }',
    '.rel-fx-pick.on { opacity: 1; border-color: #fff; box-shadow: 0 0 0 2px rgba(8, 20, 36, 0.9), 0 0 0 3px #fff; }',
    '.rel-fx-pick::-webkit-color-swatch-wrapper { padding: 0; }',
    '.rel-fx-pick::-webkit-color-swatch { border: none; border-radius: 50%; opacity: 0; }',
    '.rel-fx-pick.on::-webkit-color-swatch { opacity: 1; }',
    '.rel-fx-breath.on { color: #06243d; background: #9ef0ff; border-color: #d5f2ff; font-weight: 700; }',
    '.rel-fx-color { flex-shrink: 0; width: 34px; height: 22px; padding: 0 1px; cursor: pointer;',
    '  background: transparent; border: 1px solid rgba(90, 170, 255, 0.45); border-radius: 5px; }',
    '.rel-fx-color::-webkit-color-swatch-wrapper { padding: 1px; }',
    '.rel-fx-color::-webkit-color-swatch { border: none; border-radius: 3px; }',
    '.rel-fx-seg { display: inline-flex; flex: 0 1 auto; min-width: 0; border-radius: 6px; overflow: hidden;',
    '  border: 1px solid rgba(90, 170, 255, 0.35); }',
    '.rel-fx-seg button { height: 22px; padding: 0 7px; cursor: pointer; font-family: inherit; font-size: 11px;',
    '  color: #cfe9ff; background: rgba(14, 34, 58, 0.8); border: none; border-right: 1px solid rgba(90, 170, 255, 0.25); }',
    '.rel-fx-seg button:last-child { border-right: none; }',
    '.rel-fx-seg button.on { color: #06243d; background: #6fc4ff; font-weight: 700; }',
    /* 同一行并排（人员：缩放 / 透明 / 呼吸；连线：颜色 + 粗细） */
    '.rel-fx-row { display: flex; flex-direction: row; align-items: center; gap: 10px; flex-wrap: nowrap;',
    '  width: 100%; min-width: 0; box-sizing: border-box; }',
    '.rel-fx-row .rel-fx-item { width: auto; flex: 0 1 auto; min-width: 0; gap: 5px; }',
    '.rel-fx-row .rel-fx-item > span { min-width: 0; font-size: 10.5px; }',
    /* 数字步进控件：− 数值 + */
    '.rel-fx-stepper { display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0; }',
    '.rel-fx-stepbtn { width: 15px; height: 20px; padding: 0; cursor: pointer; font-family: inherit;',
    '  font-size: 12px; line-height: 1; color: #cfe9ff; background: rgba(24, 56, 92, 0.85);',
    '  border: 1px solid rgba(90, 170, 255, 0.4); border-radius: 4px; }',
    '.rel-fx-stepbtn:hover { background: rgba(48, 110, 176, 0.95); color: #fff; border-color: #9ef0ff; }',
    '.rel-fx-num { width: 30px; height: 20px; padding: 0 1px; box-sizing: border-box; text-align: center;',
    '  font-family: inherit; font-size: 11px; color: #9ef0ff; font-variant-numeric: tabular-nums;',
    '  background: rgba(6, 18, 32, 0.92); border: 1px solid rgba(90, 170, 255, 0.3); border-radius: 4px;',
    '  outline: none; }',
    '.rel-fx-num:focus { border-color: #7fd4ff; box-shadow: 0 0 6px rgba(74, 168, 255, 0.35); }',
    '.rel-fx-suffix { flex: 0 0 auto; font-size: 10px; color: rgba(170, 212, 250, 0.7); }',
    '.rel-issue-fx.is-link .rel-fx-stepbtn { color: #c9f5dd; background: rgba(10, 40, 30, 0.8);',
    '  border-color: rgba(80, 200, 140, 0.4); }',
    '.rel-issue-fx.is-link .rel-fx-num { color: #7ff0b8; }',
    /* 叠加连线：在原始连线上方独立画一层；原始连线维持「未涉及」透明度 */
    '.rel-fx-overlay { fill: none; pointer-events: none; opacity: 0; stroke-linecap: round; }',
    '.rel-fx-overlay.on { opacity: .95; }',
    '.rel-fx-knob { fill: #9ef0ff; stroke: #06243d; stroke-width: 1.2; opacity: 0; pointer-events: none; }',
    '.rel-fx-knob.on { opacity: .95; pointer-events: auto; cursor: grab; }',
    '.rel-fx-head { fill: none; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; opacity: 0; }',
    '.rel-fx-head.on { opacity: .98; }',
    '.rel-note-layer { pointer-events: none; }',
    '.rel-note { pointer-events: auto; cursor: move; }',
    '.rel-note.dragging { cursor: grabbing; }',
    '.rel-note-bg { fill: rgba(6, 20, 36, 0.92); stroke: rgba(126, 214, 255, 0.75); stroke-width: 1; }',
    '.rel-note.is-link .rel-note-bg { stroke: rgba(95, 224, 160, 0.8); }',
    '.rel-note-tx { fill: #f2fbff; font-family: inherit;', 
    '  dominant-baseline: auto; paint-order: stroke; }',
    '.rel-fly { position: fixed; z-index: 48000; width: 14px; height: 14px; border-radius: 50%;',
    '  margin: -7px 0 0 -7px; pointer-events: none; background: #9ef0ff;',
    '  box-shadow: 0 0 12px #6fc4ff, 0 0 26px rgba(111, 196, 255, 0.6);',
    '  transition: transform .62s cubic-bezier(.35, .02, .3, 1), opacity .62s ease; }',
    '.rel-issue-step.just-added { animation: relAdded .9s ease; }',
    '@keyframes relAdded { 0% { box-shadow: 0 0 0 0 rgba(158, 240, 255, 0.85); }',
    '  100% { box-shadow: 0 0 0 14px rgba(158, 240, 255, 0); } }',
    '.rel-issue-step[draggable="true"] { cursor: grab; }',
    '.rel-issue-step.dragging { opacity: .5; }',
    '.rel-step-top { display: flex; align-items: center; gap: 5px; min-width: 0; }',
    '.rel-step-note { flex: 0 0 auto; width: 20px; height: 22px; padding: 0; cursor: pointer;',
    '  font-family: inherit; font-size: 13px; line-height: 20px; text-align: center;',
    '  color: #9ec9ee; background: rgba(14, 34, 58, 0.85);',
    '  border: 1px solid rgba(90, 170, 255, 0.4); border-radius: 5px; }',
    '.rel-step-note:hover { border-color: #9ef0ff; color: #fff; }',
    '.rel-step-note.on { color: #06243d; background: #9ef0ff; border-color: #d5f2ff; font-weight: 700; }',
    '.rel-issue-step.is-link .rel-step-note { color: #c9f5dd; background: rgba(10, 40, 30, 0.85);',
    '  border-color: rgba(80, 200, 140, 0.4); }',
    '.rel-issue-step.is-link .rel-step-note.on { color: #04261a; background: #5fe0a0; border-color: #b9ffdc; }',
    '.rel-step-ic { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;',
    '  width: 15px; height: 15px; color: #7fd4ff; }',
    '.rel-step-ic.is-link { color: #5fe0a0; }',
    '.rel-step-del { position: absolute; right: -6px; top: -7px; z-index: 3; display: none;',
    '  width: 16px; height: 16px; padding: 0; cursor: pointer; font-family: inherit; font-size: 12px;',
    '  line-height: 14px; text-align: center; color: #fff; background: #d94a4a;',
    '  border: 1px solid #ffb3b3; border-radius: 50%; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.55); }',
    '.rel-issue-step.open .rel-step-del, .rel-issue-step:hover .rel-step-del { display: block; }',
    '.rel-step-del:hover { background: #ff5f5f; border-color: #fff; }',
    '.rel-issue-step { flex-direction: column; align-items: stretch; gap: 5px; }',
    '.rel-step-time { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; min-width: 0; }',
    '.rel-step-time .rel-dur-lab { font-size: 9.5px; letter-spacing: 0; }',
    '.rel-dur { display: inline-flex; align-items: center; gap: 3px; }',
    '.rel-dur-lab { font-size: 10.5px; color: rgba(170, 212, 250, 0.75); }',
    '.rel-dur-sel { height: 22px; padding: 0 2px; cursor: pointer; font-family: inherit; font-size: 10.5px;',
    '  color: #cfe9ff; background: rgba(14, 34, 58, 0.9); border: 1px solid rgba(90, 170, 255, 0.35);',
    '  border-radius: 5px; outline: none; }',
    '.rel-issue-fx.is-link .rel-dur-sel { color: #c9f5dd; background: rgba(10, 40, 30, 0.85);',
    '  border-color: rgba(80, 200, 140, 0.4); }',
    '.rel-step-row { display: flex; align-items: stretch; gap: 5px; min-width: 0; position: relative; }',
    /* 只在不同「步骤（动作）」之间画细白线；同一动作内的多个模块之间不画。
       第 59 轮：线上留 5px，线下留 15px（下宽上窄，视觉上更贴着上一组）——
       gap=6 + margin-top=14 = 20px，线放 top:-15px → 线上 5px、线下 15px */
    '.rel-step-row.act-start { margin-top: 14px; }',
    '.rel-step-row.act-start::before { content: ""; position: absolute; left: 2px; right: 2px; top: -15px;',
    '  height: 1px; background: rgba(255, 255, 255, 0.42); box-shadow: 0 0 4px rgba(255, 255, 255, 0.22);',
    '  pointer-events: none; }',
    /* 同一动作左边框同色；相邻动作交替（0=蓝 / 1=青绿） */
    '.rel-issue-step.grp0 { border-left: 3px solid #4aa8ff; }',
    '.rel-issue-step.grp1 { border-left: 3px solid #34d3b4; }',
    '.rel-issue-step.grp0.is-link { border-left-color: #4aa8ff; }',
    '.rel-issue-step.grp1.is-link { border-left-color: #34d3b4; }',
    /* 同时 / 之后：单按钮切换 */
    '.rel-tm-btn { height: 22px; min-width: 40px; padding: 0 8px; cursor: pointer; font-family: inherit;',
    '  font-size: 11px; color: #cfe9ff; background: rgba(14, 34, 58, 0.85);',
    '  border: 1px solid rgba(90, 170, 255, 0.4); border-radius: 5px; }',
    '.rel-tm-btn:hover { border-color: #9ef0ff; color: #fff; }',
    '.rel-tm-btn.with { color: #06243d; background: #6fc4ff; border-color: #9ef0ff; font-weight: 700; }',
    '.rel-issue-fx.is-link .rel-tm-btn { color: #c9f5dd; background: rgba(10, 40, 30, 0.85);',
    '  border-color: rgba(80, 200, 140, 0.4); }',
    '.rel-issue-step.is-link .rel-tm-btn { color: #c9f5dd; background: rgba(10, 40, 30, 0.85);',
    '  border-color: rgba(80, 200, 140, 0.4); }',
    '.rel-issue-step.is-link .rel-tm-btn.with { color: #04261a; background: #5fe0a0; }',
    '.rel-step-col { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }',
    '.rel-step-menu { position: fixed; z-index: 47000; min-width: 118px; padding: 4px;',
    '  display: none; flex-direction: column; gap: 1px; background: rgba(8, 20, 38, 0.98);',
    '  border: 1px solid rgba(90, 170, 255, 0.5); border-radius: 7px;',
    '  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.62); }',
    '.rel-step-menu.show { display: flex; }',
    '.rel-step-menu button { padding: 6px 10px; cursor: pointer; text-align: left; font-family: inherit;',
    '  font-size: 12px; color: #dce9f8; background: none; border: 0; border-radius: 5px; }',
    '.rel-step-menu button:hover { background: rgba(60, 130, 215, 0.4); color: #fff; }',
    '.rel-issue-hint-foot { margin-top: auto; padding: 6px 2px 2px; font-size: 10.5px;',
    '  border-top: 1px dashed rgba(90, 170, 255, 0.2); }',
    '.rel-issue-tools { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }',
    '.rel-issue-tools .grow { flex: 1; }',
    /* 问题概述浮框（拓扑图右上角） */
    '.rel-issue-card { position: absolute; right: 12px; top: 52px; z-index: 20; width: 300px; max-width: 42%;',
    '  display: none; flex-direction: column; gap: 6px; padding: 11px 12px;',
    '  border-radius: 10px; background: rgba(8, 22, 38, 0.95);',
    '  border: 1px solid rgba(90, 170, 255, 0.6);',
    '  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(160, 220, 255, 0.14); }',
    '.rel-issue-card.show { display: flex; }',
    '.rel-issue-card-head { display: flex; align-items: center; gap: 7px; cursor: move; user-select: none; }',
    '.rel-issue-card-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 700; color: #9ef0ff;',
    '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.rel-issue-card-close { flex-shrink: 0; width: 18px; height: 18px; padding: 0; cursor: pointer;',
    '  font-family: inherit; font-size: 13px; line-height: 1; color: #b8d8f4;',
    '  background: transparent; border: 1px solid rgba(90, 170, 255, 0.4); border-radius: 4px; }',
    '.rel-issue-card-close:hover { color: #fff; border-color: #9ef0ff; }',
    '.rel-issue-card-desc { max-height: 116px; overflow-y: auto; font-size: 12px; line-height: 1.7;',
    '  color: #d6e8fa; white-space: pre-wrap; word-break: break-word; }',
    '.rel-issue-card-meta { display: flex; gap: 10px; font-size: 11px; color: rgba(160, 205, 245, 0.75); }',
    '.rel-issue-card-meta b { color: #7fd4ff; font-weight: 700; }',
    /* 演示态：未涉及人员/关系变暗 */
    '.rel-node.rel-dim2 .rel-node-shape, .rel-node.rel-dim2 .rel-node-label { opacity: .18; filter: grayscale(.7); }',
    '.rel-link.rel-link-muted .rel-link-line { opacity: .1; }',
    '.rel-link.rel-link-muted .rel-link-label { opacity: .12; }',
    /* 涉及关系：原始连线保持「未涉及」的透明度，高亮由叠加层 rel-fx-overlay 承担 */
    '.rel-link.rel-link-hit .rel-link-line { opacity: .1; }',
    '.rel-link.rel-link-hit .rel-link-label { opacity: .12; }',
    /* 血管流动：沿线滚动的虚线 */
    '.rel-flow-line { fill: none; pointer-events: none; stroke: #7fd4ff; stroke-width: 3.4;',
    '  stroke-linecap: round; opacity: 0; transition: opacity .25s ease; }',
    '.rel-flow-line.on { opacity: .95; stroke-dasharray: 18 22; animation: relFlowDash .9s linear infinite; }',
    '@keyframes relFlowDash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -40; } }',
    '.rel-flow-glow { fill: none; pointer-events: none; stroke: #9ef0ff; stroke-linecap: round;',
    '  opacity: 0; filter: blur(3px); transition: opacity .25s ease; }',
    '.rel-flow-glow.on { opacity: .45; }',
    /* 演示步骤：人员缩放 / 透明度 / 外发光 */
    '.rel-node.rel-fx .rel-node-shape { transition: transform .4s ease, opacity .4s ease, filter .4s ease; }',
    '.rel-node.rel-fx .rel-node-label { transition: opacity .5s ease; }',
    /* 呼吸：光晕环单独一层，压在圆与文字之下，只沿圆的轮廓发光 */
    '.rel-node-breath { opacity: 0; pointer-events: none; }',
    '@keyframes relBreath { 0%, 100% { opacity: .18;',
    '  filter: drop-shadow(0 0 0.6px var(--bc)); }',
    '  50% { opacity: .42; filter: drop-shadow(0 0 1.2px var(--bc))',
    '  drop-shadow(0 0 2.8px var(--bc)) drop-shadow(0 0 4.8px var(--bc)); } }',
    '.rel-node.rel-breath .rel-node-breath { animation: relBreath 2.6s ease-in-out infinite; }',
    '@media (prefers-reduced-motion: reduce) { .rel-node.rel-breath .rel-node-breath { animation-duration: 6s; } }',
    /* 演示工具条（拓扑图底部居中） */
    '.rel-demo-bar { position: absolute; left: 50%; bottom: 46px; z-index: 20; transform: translateX(-50%);',
    '  display: none; align-items: center; gap: 7px; padding: 7px 10px; border-radius: 999px;',
    '  background: rgba(8, 22, 38, 0.95); border: 1px solid rgba(90, 170, 255, 0.55);',
    '  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55); }',
    '.rel-demo-bar.show { display: flex; }',
    '.rel-demo-bar { cursor: move; user-select: none; }',
    '.rel-demo-sub { font-size: 10.5px; color: rgba(158, 240, 255, 0.72); min-width: 0; }',
    '.rel-demo-sub:empty { display: none; }',
    /* 步内进度（2/5）：可点，点了才逐个跳子步 */
    '.rel-demo-sub:not(:empty) { cursor: pointer; padding: 1px 6px; border-radius: 999px;',
    '  border: 1px solid rgba(90, 170, 255, 0.45); background: rgba(20, 52, 88, 0.7);',
    '  font-variant-numeric: tabular-nums; transition: all .15s ease; }',
    '.rel-demo-sub:not(:empty):hover { color: #fff; border-color: #9ef0ff;',
    '  box-shadow: 0 0 10px rgba(74, 168, 255, 0.5); }',
    '.rel-dragging { opacity: .96; box-shadow: 0 14px 40px rgba(0, 0, 0, 0.7); }',
    '.rel-demo-step { min-width: 44px; text-align: center; font-size: 11.5px; font-weight: 700;',
    '  color: #9ef0ff; font-variant-numeric: tabular-nums; }',
    /* 端点/路径选择标记 */
    '.rel-node.rel-path-sel .rel-node-shape { filter: drop-shadow(0 0 10px #7fd4ff); }',
    '.rel-link.rel-path-sel .rel-link-line { stroke: #9ef0ff; stroke-width: 3; }'
  ].join('\n');

  var REL_PANEL = '' +
    '<div id="recRelationPanel" class="rec-panel hidden">' +
    '  <div class="rel-wrap">' +
    '    <div class="rel-col rel-listcol">' +
    '      <div class="rel-head">' +
    '        <button type="button" class="rel-page-tab" id="relPageTab"' +
    '          onclick="recRelPageToggle()" title="单击切换：人员列表 / 问题分析">人员列表</button>' +
    '        <span class="rel-head-tools" id="relListTools">' +
    '          <span class="rel-color-filter" id="relColorFilter"></span>' +
    '          <button class="rel-add" onclick="recRelAddPerson()">＋新增</button>' +
    '          <div class="rel-menu-wrap">' +
    '            <button class="rel-more" onclick="recRelToggleMenu(event)" title="更多操作">…</button>' +
    '            <div class="rel-menu hidden" id="relMoreMenu">' +
    '              <button class="rel-menu-item" onclick="recRelExportCsv()">导出 CSV</button>' +
    '              <button class="rel-menu-item" onclick="recRelImportCsv()">导入 CSV</button>' +
    '              <button class="rel-menu-item" onclick="recRelExportJs()">导出 JS</button>' +
    '              <button class="rel-menu-item" onclick="recRelImportJs()">导入 JS</button>' +
    '            </div>' +
    '          </div>' +
    '        </span>' +
    '        <span class="rel-head-tools" id="relIssueTools" style="display:none;">' +
    '          <button class="rel-issue-mini" id="relIssueBack" style="display:none;"' +
    '            onclick="recRelIssueBack()">← 返回列表</button>' +
    '          <button class="rel-add" id="relIssueNew"' +
    '            onclick="recRelIssueNew()" title="新增问题">＋新增</button>' +
    '        </span>' +
    '      </div>' +
    '      <div class="rel-list" id="relList"></div>' +
    '      <div class="rel-issue-panel" id="relIssuePanel">' +
    '        <div class="rel-issue-drag" title="拖动可移动浮窗"></div>' +
    '        <div class="rel-issue-body" id="relIssueBody"></div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="rel-col rel-graphcol" id="relGraphCol">' +
    '      <div class="rel-head">' +
    '        <span class="rel-title">关系拓扑</span>' +
    '        <button class="rel-analysis-btn" id="relAnalysisBtn" style="display:none;"' +
    '          onclick="recRelAnalysisToggle()" title="全屏下打开 / 收起问题分析（浮在拓扑图左侧）">分析</button>' +
    '        <span class="rel-pick-bar" id="relPickBar" style="display:none;">' +
    '          <span class="rel-pick-count" id="relPickCount">已选 0 人</span>' +
    '          <button class="rel-add" onclick="recRelOpenPairLink()">添加关系</button>' +
    '          <button class="rel-mini" onclick="recRelClearPick()">取消选择</button>' +
    '        </span>' +
    '        <span class="rel-head-right">' +
    '          <span class="rel-zoom">' +
    '            <button class="rel-zoom-btn" onclick="recRelZoom(-1)" title="缩小拓扑图">−</button>' +
    '            <span class="rel-zoom-val" id="relZoomVal" onclick="recRelZoom(0)" title="点击恢复 100%">100%</span>' +
    '            <button class="rel-zoom-btn" onclick="recRelZoom(1)" title="放大拓扑图">+</button>' +
    '          </span>' +
    '          <button class="rel-ico-btn" onclick="recRelCenterView()" title="画布回到原点">' +
    '            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
    '              <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
    '              <path d="M8 1v3M8 12v3M1 8h3M12 8h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
    '          </button>' +
    '          <button class="rel-ico-btn" onclick="recRelShot()" title="把拓扑图另存为图片">' +
    '            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
    '              <path d="M2 5.5h2.4L6 3.5h4l1.6 2H14v7.5H2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
    '              <circle cx="8" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' +
    '          </button>' +
    '          <button class="rel-ico-btn" id="relFullBtn" onclick="recRelToggleFull()" title="中部满屏">' +
    '            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
    '              <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '          </button>' +
    '        </span>' +
    '      </div>' +
    '      <div class="rel-graph" id="relGraph"></div>' +
    '      <div class="rel-issue-card" id="relIssueCard">' +
    '        <div class="rel-issue-card-head">' +
    '          <span class="rel-issue-card-title" id="relIssueCardTitle"></span>' +
    '          <button class="rel-issue-card-close" onclick="recRelIssueCardHide()" title="关闭概述框（不退出演示）">×</button>' +
    '        </div>' +
    '        <div class="rel-issue-card-desc" id="relIssueCardDesc"></div>' +
    '        <div class="rel-issue-card-meta" id="relIssueCardMeta"></div>' +
    '      </div>' +
    '      <div class="rel-demo-bar" id="relDemoBar">' +
    '        <button class="rel-issue-mini" onclick="recRelIssueDemoPrevStep()" title="上一步（整步）">&#171;</button>' +
    '        <span class="rel-demo-step" id="relDemoStep">0/0</span>' +
    '        <span class="rel-demo-sub" id="relDemoSub" onclick="recRelIssueDemoSubStep(1)"' +
    '          onpointerdown="event.stopPropagation()" title="点击逐个播放本步子步骤"></span>' +
    '        <button class="rel-issue-mini" onclick="recRelIssueDemoNextStep()" title="下一步：自动播完该步骤的全部子步骤">&#187;</button>' +
    '        <button class="rel-issue-mini" onclick="recRelIssueDemoAuto()" title="从第 0 步自动播放一次">自动</button>' +
    '        <button class="rel-issue-mini" onclick="recRelIssueCardToggle()" title="显示/隐藏问题概述框">概述</button>' +
    '        <button class="rel-issue-mini" onclick="recRelIssueDemoStop()">退出</button>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  var REL_MODALS = '' +
    /* 脚本编辑弹窗（双击「脚本」页签打开）：宽高等于中部满屏尺寸 */
    '<div id="relScriptModal" class="modal-mask rel-script-mask" style="display:none;">' +
    '  <div class="modal-box rel-script-box" id="relScriptBox">' +
    '    <div class="modal-head"><span class="m-title">脚本编辑</span>' +
    '      <span class="rel-script-ops">' +
    '        <button class="rel-issue-mini" onclick="recRelScriptModalApply()">应用脚本</button>' +
    '        <button class="rel-issue-mini" onclick="recRelScriptModalReset()">还原</button>' +
    '      </span>' +
    '      <span class="modal-close" onclick="recRelScriptModalClose()">×</span></div>' +
    '    <div class="modal-body rel-script-body">' +
    '      <div class="rel-script-wrap rel-script-wrap-lg">' +
    '        <div class="rel-script-hl" id="relScriptModalHl"></div>' +
    '        <textarea class="rel-script-area" id="relScriptModalArea" spellcheck="false"' +
    '          oninput="recRelScriptModalInput(this)" onscroll="recRelScriptModalScroll(this)"' +
    '          onblur="recRelIssueScriptBlur(this)"></textarea>' +
    '      </div>' +
    '    </div>' +
    '    <div class="modal-foot rel-script-foot">' +
    '      <span class="rel-issue-hint" id="relScriptModalTip">编辑后点「返回」关闭并写回步骤</span>' +
    '      <button class="rel-issue-mini primary" onclick="recRelScriptModalClose()">返回</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div id="relInfoModal" class="modal-mask" style="display:none;">' +
    '  <div class="modal-box rel-info-box">' +
    '    <div class="modal-head"><span class="m-title">编辑人员信息</span>' +
    '      <button type="button" class="rel-head-input" id="relBatchBtn" onclick="recRelBatchToggle()" title="一次粘贴多人信息，自动拆分到人员列表">窗口输入</button>' +
    '      <span class="modal-close" onclick="recRelInfoClose()">×</span></div>' +
    '    <div class="modal-body" id="relInfoBody">' +
    '      <div class="rel-info-grid">' +
    '        <div class="rel-info-left">' +
    '          <div class="rel-row"><span>姓名</span><input id="relInfoName" type="text" maxlength="24" placeholder="请输入姓名"></div>' +
    '          <div class="rel-row"><span>单位 / 职务</span><input id="relInfoOrg" type="text" maxlength="60" placeholder="如：某单位 部门负责人"></div>' +
    '          <label class="rel-field">其他信息（每行一段）' +
    '            <textarea id="relInfoText" rows="6" placeholder="可填写履历、性格、关联事项等，每行一段"></textarea></label>' +
    '          <div class="rel-field">颜色' +
    '            <div class="rel-colors" id="relInfoColors"></div></div>' +
    '          <div class="rel-info-links">' +
    '            <div class="rel-info-links-head"><span>关系人</span>' +
    '              <button type="button" class="rel-mini" onclick="recRelInfoAddLink()">＋添加关系</button></div>' +
    '            <div class="rel-links" id="relInfoLinks"></div>' +
    '          </div>' +
    '        </div>' +
    '        <div class="rel-info-right">' +
    '          <div class="rel-photo" id="relPhotoBox" tabindex="0" onclick="recRelFocusPhoto(event)" title="点击此处后按 Ctrl+V 粘贴图片，或点 + 选择图片文件">' +
    '            <img id="relPhotoImg" alt="">' +
    '            <div class="rel-photo-empty">' +
    '              <span class="rel-photo-tip">点击此处粘入图片</span>' +
    '              <button type="button" class="rel-photo-add" onclick="event.stopPropagation();recRelPickPhoto()" title="从文件中选择图片">+</button>' +
    '              <span class="rel-photo-sub">Ctrl+V 粘贴 · 点 + 选文件</span>' +
    '            </div>' +
    '          </div>' +
    '          <button class="rel-mini" onclick="recRelClearPhoto()">清除照片</button>' +
    '        </div>' +
    '      </div>' +
    '      <div class="rel-batch" id="relBatchPane" style="display:none;">' +
    '        <div class="rel-batch-col rel-batch-in">' +
    '          <div class="rel-batch-title">粘贴 / 输入人员信息</div>' +
    '          <textarea id="relBatchText" spellcheck="false"></textarea>' +
    '          <div class="rel-batch-tools">' +
    '            <button type="button" class="rel-mini" onclick="recRelBatchSample()">填入示例</button>' +
    '            <button type="button" class="rel-mini" onclick="recRelBatchPreview()">整理预览</button>' +
    '          </div>' +
    '        </div>' +
    '        <div class="rel-batch-col rel-batch-out">' +
    '          <div class="rel-batch-title">整理结果 <span id="relBatchCount" class="rel-batch-count">0 人</span></div>' +
    '          <div class="rel-batch-list" id="relBatchList"></div>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="modal-foot" id="relInfoFootNormal">' +
    '      <button class="btn" onclick="recRelInfoClose()">取消</button>' +
    '      <button class="btn btn-primary" onclick="recRelInfoSave()">保存</button>' +
    '    </div>' +
    '    <div class="modal-foot" id="relBatchFoot" style="display:none;">' +
    '      <span class="rel-batch-hint">每段以「【姓名】」开头，可一次粘贴多人</span>' +
    '      <button class="btn" onclick="recRelBatchToggle()">返回表单</button>' +
    '      <button class="btn btn-primary" onclick="recRelBatchCommit()">加入人员列表</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div id="relCardModal" class="modal-mask" style="display:none;">' +
    '  <div class="modal-box modal-narrow">' +
    '    <div class="modal-head"><span class="m-title">人员名片</span>' +
    '      <span class="modal-close" onclick="recRelCardClose()">×</span></div>' +
    '    <div class="modal-body" id="relCardBody"></div>' +
    '    <div class="modal-foot">' +
    '      <button class="btn" onclick="recRelCardClose()">关闭</button>' +
    '      <button class="btn btn-primary" onclick="recRelCardEdit()">编辑资料</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div id="relLinkModal" class="modal-mask" style="display:none;">' +
    '  <div class="modal-box rel-link-modal">' +
    '    <div class="modal-head"><span class="m-title" id="relLinkTitle">添加关系</span>' +
    '      <span class="rel-lk-head-hint" id="relLkHint">含「疑似 / 可能 / 好像 / 类似」等词时自动画虚线</span>' +
    '      <span class="modal-close" onclick="recRelLinkClose()">×</span></div>' +
    '    <div class="modal-body">' +
    '      <div class="rel-lk-line">' +
    '        <span class="rel-lk-lab">人员：</span>' +
    '        <input class="rel-lk-input rel-lk-name" id="relLkNameA" type="text" maxlength="24" list="relLkPeopleList" autocomplete="off" placeholder="姓名" oninput="recRelSyncLinkPair()">' +
    '        <span class="rel-lk-lab">关系：</span>' +
    '        <input class="rel-lk-input rel-lk-rel" id="relLkRel" type="text" maxlength="30" placeholder="如 夫妻 / 疑似情人" oninput="recRelLinkHint()">' +
    '        <div class="rel-lk-dirs" id="relLkDirs">' +
    '          <button type="button" data-dir="to" onclick="recRelLinkDir(\'to\')" title="左侧人员 → 右侧人员">→</button>' +
    '          <button type="button" data-dir="from" onclick="recRelLinkDir(\'from\')" title="右侧人员 → 左侧人员">←</button>' +
    '          <button type="button" data-dir="both" onclick="recRelLinkDir(\'both\')" title="双向">↔</button>' +
    '        </div>' +
    '        <span class="rel-lk-lab">人员：</span>' +
    '        <input class="rel-lk-input rel-lk-name" id="relLkNameB" type="text" maxlength="24" list="relLkPeopleList" autocomplete="off" placeholder="姓名" oninput="recRelSyncLinkPair()">' +
    '      </div>' +
    '      <datalist id="relLkPeopleList"></datalist>' +
    '      <div class="rel-lk-note-row"><label>备注（可多段）</label>' +
    '        <textarea id="relLkNote" class="rel-lk-note" placeholder="可填写这条关系的详细信息、依据、时间等，支持多段"></textarea></div>' +
    '      <div class="rel-lk-list" id="relLkList"></div>' +
    '    </div>' +
    '    <div class="modal-foot">' +
    '      <button class="btn" onclick="recRelLinkClose()">取消</button>' +
    '      <button class="btn btn-primary" id="relLkSave" onclick="recRelLinkSave()">保存</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div id="relNoteModal" class="modal-mask" style="display:none;">' +
    '  <div class="modal-box modal-narrow">' +
    '    <div class="modal-head"><span class="m-title">编辑批注</span>' +
    '      <span class="modal-close" onclick="recRelNoteClose()">×</span></div>' +
    '    <div class="modal-body">' +
    '      <div class="rel-issue-field"><span class="rel-issue-name-lab" id="relNoteWho"></span>' +
    '        <textarea class="rel-issue-desc" id="relNoteText" rows="6"' +
    '          placeholder="输入批注文字，演示时显示在拓扑图上，可自动换行"></textarea></div>' +
    '    </div>' +
    '    <div class="modal-foot">' +
    '      <button class="btn" onclick="recRelNoteClose()">取消</button>' +
    '      <button class="btn btn-primary" onclick="recRelNoteSave()">保存</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<input type="file" id="relPhotoInput" accept="image/*" style="display:none">' +
    '<div class="rel-tip" id="relTip"></div>' +
    '<input type="file" id="relCsvInput" accept=".csv,text/csv" style="display:none">' +
    '<input type="file" id="relJsInput" accept=".js,.json,application/javascript,application/json" style="display:none">';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function trunc(v, n) {
    var s = String(v || '');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function newId(pre) {
    return pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }
  function dirArrow(d) { return d === 'from' ? '←' : (d === 'both' ? '↔' : '→'); }
  function flipDir(d) { return d === 'to' ? 'from' : (d === 'from' ? 'to' : 'both'); }

  function normalize(d) {
    var out = { people: [], links: [], issues: [] };
    try {
      if (!d || !Array.isArray(d.people)) return out;
      out.people = d.people.filter(function (p) { return p && p.id; }).map(function (p) {
        return {
          id: String(p.id),
          name: String(p.name == null ? '' : p.name),
          org: String(p.org == null ? '' : p.org),
          info: Array.isArray(p.info) ? p.info.map(String) : [],
          color: COLOR_HEX[p.color] ? String(p.color) : '',
          photo: typeof p.photo === 'string' ? p.photo : '',
          x: typeof p.x === 'number' && isFinite(p.x) ? p.x : null,
          y: typeof p.y === 'number' && isFinite(p.y) ? p.y : null
        };
      });
      out.people.forEach(function (p, i) {
        if (!p.color) p.color = COLOR_KEYS[i % COLOR_KEYS.length];
      });
      var ids = {};
      out.people.forEach(function (p) { ids[p.id] = true; });
      out.links = (Array.isArray(d.links) ? d.links : []).filter(function (l) {
        return l && l.id && ids[l.from] && ids[l.to] && l.from !== l.to;
      }).map(function (l) {
        return {
          id: String(l.id),
          from: String(l.from),
          to: String(l.to),
          rel: String(l.rel == null ? '' : l.rel),
          note: String(l.note == null ? '' : l.note),
          dir: (l.dir === 'from' || l.dir === 'both') ? l.dir : 'to'
        };
      });
      var goods = {};
      out.people.forEach(function (p) { goods[p.id] = true; });
      out.issues = (Array.isArray(d.issues) ? d.issues : []).map(function (q) {
        if (!q || typeof q !== 'object') return null;
        var steps = (Array.isArray(q.steps) ? q.steps : []).filter(function (s) {
          return s && (s.type === 'person' ? goods[s.ref] : (s.type === 'link' && out.links.some(function (l) { return l.id === s.ref; })));
        }).map(function (s) {
          return {
            id: String(s.id || ''),
            type: s.type,
            ref: String(s.ref),
      timing: s.timing === 'with' ? 'with' : 'after',
            dur: normDur(s.dur),
            note: String(s.note == null ? '' : s.note),
            noteOn: s.noteOn ? 1 : 0,
            mgrp: String(s.mgrp == null ? '' : s.mgrp),
            noff: (s.noff && typeof s.noff === 'object')
              ? { x: Number(s.noff.x) || 0, y: Number(s.noff.y) || 0 } : null,
            fx: issueNormFx(s.type, s.fx)
          };
        });
        return {
          id: String(q.id || ''),
          title: String(q.title == null ? '' : q.title) || '未命名问题',
          desc: String(q.desc == null ? '' : q.desc),
          people: (Array.isArray(q.people) ? q.people : []).filter(function (id) { return goods[id]; }).map(String),
          steps: steps
        };
      }).filter(function (q) { return q && q.id; });
    } catch (e) { }
    return out;
  }

  function loadView() {
    try {
      var v = JSON.parse(localStorage.getItem(REL_KEY + ':view') || 'null');
      if (v && typeof v === 'object') {
        return {
          x: typeof v.x === 'number' && isFinite(v.x) ? v.x : 0,
          y: typeof v.y === 'number' && isFinite(v.y) ? v.y : 0
        };
      }
    } catch (e) { }
    return { x: 0, y: 0 };
  }
  function saveView() {
    try { localStorage.setItem(REL_KEY + ':view', JSON.stringify(relPan)); } catch (e) { }
  }

  function load() {
    try {
      var raw = localStorage.getItem(REL_KEY);
      var t = null;
      try { t = JSON.parse(localStorage.getItem(REL_THEME_KEY) || 'null'); } catch (e2) { t = null; }
      if (t && typeof t === 'object') {
        relThemeName = typeof t.name === 'string' ? t.name : '';
        relThemeFile = typeof t.file === 'string' ? t.file : '';
      }
      if (!raw) return { people: [], links: [] };
      return normalize(JSON.parse(raw));
    } catch (e) { }
    return { people: [], links: [] };
  }

  var relThemeName = '';
  var relThemeFile = '';
  var relData = load();
  var relModalId = '';
  var relCardId = '';
  var relEditingLink = '';
  var relEditingCard = '';
  var relFormNew = false;
  var relSelId = '';
  var relColorFilter = '';
  var relDraftColor = 'blue';
  var relDraftPhoto = '';
  var dragId = '';
  var lastDownId = '';
  var startPos = {};               // 簇拖动起始坐标
  var dragOrigin = null;           // 簇拖动起点（SVG 坐标）
  var animRaf = 0;
  var animT0 = (window.performance && performance.now) ? performance.now() : Date.now();
  var dispPos = {};

  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }
  // 演示中所有编辑入口统一拦截：提示先退出演示（返回 true 表示已拦截）
  function demoLockEditing() {
    if (!relIssueDemo.on) return false;
    toast('请先退出演示模式，再编辑关联关系');
    return true;
  }
  function save() {
    try { localStorage.setItem(REL_KEY, JSON.stringify(relData)); }
    catch (e) { toast('保存失败：浏览器本地存储空间不足（照片过多或过大）'); }
  }
  function personById(id) {
    for (var i = 0; i < relData.people.length; i++) if (relData.people[i].id === id) return relData.people[i];
    return null;
  }
  function colorKeyOf(p) {
    if (!p) return 'blue';
    return COLOR_HEX[p.color] ? p.color : 'blue';
  }
  function colorOf(p) { return COLOR_HEX[colorKeyOf(p)]; }
  function linkById(id) {
    for (var i = 0; i < relData.links.length; i++) if (relData.links[i].id === id) return relData.links[i];
    return null;
  }
  function relFromView(link, pid) {
    return link.from === pid ? link.dir : flipDir(link.dir);
  }

  function relColorsInUse() {
    var seen = {};
    relData.people.forEach(function (p) { seen[colorKeyOf(p)] = true; });
    return COLOR_KEYS.filter(function (k) { return seen[k]; });
  }

  function renderColorFilter() {
    var box = document.getElementById('relColorFilter');
    if (!box) return;
    var used = relColorsInUse();
    if (relColorFilter && used.indexOf(relColorFilter) < 0) relColorFilter = '';
    box.classList.toggle('multi', relMultiPick);
    box.style.display = used.length ? '' : 'none';
    box.innerHTML = used.map(function (k) {
      var n = relData.people.filter(function (p) { return colorKeyOf(p) === k; }).length;
      var on = relMultiPick ? !!relPickColors[k] : relColorFilter === k;
      return '<button type="button" class="rel-color-btn' + (on ? ' on' : '') + '"' +
        ' data-color="' + k + '" style="--rc:' + COLOR_HEX[k] + '"' +
        ' title="' + COLOR_NAMES[k] + '人员 ' + n + ' 人（' +
        (relMultiPick ? '单击多选，双击退出多选' : '点击筛选，双击多选') + '）"></button>';
    }).join('');
  }

  // 多选模式下生效的色系集合；单选模式返回空数组
  function pickColorSet() {
    if (!relMultiPick) return [];
    return COLOR_KEYS.filter(function (k) { return !!relPickColors[k]; });
  }

  function inPickColors(p) {
    if (!p) return true;
    if (!relMultiPick) return !relColorFilter || colorKeyOf(p) === relColorFilter;
    var set = pickColorSet();
    if (!set.length) return true;
    return set.indexOf(colorKeyOf(p)) >= 0;
  }

  function setMultiPick(on) {
    relMultiPick = !!on;
    relPickColors = {};
    if (relMultiPick) {
      if (relColorFilter) { relPickColors[relColorFilter] = true; relColorFilter = ''; }
      toast('已进入多选模式：单击圆按钮可同时选多个，双击任意圆按钮退出');
    } else {
      toast('已退出多选模式');
    }
    renderList();
    applyGraphFilter();
  }

  // 左侧颜色筛选联动右侧拓扑图：选中色系正常显示，其余缩小到 70% / 透明度 70%
  function applyGraphFilter() {
    var svg = document.querySelector('#relGraph svg');
    if (!svg) return;
    var nodes = svg.querySelectorAll('.rel-node');
    for (var i = 0; i < nodes.length; i++) {
      var p = personById(nodes[i].getAttribute('data-id'));
      var dim = !!(p && !inPickColors(p));
      if (dim) nodes[i].classList.add('rel-dim');
      else nodes[i].classList.remove('rel-dim');
    }
  }

  function renderList() {
    var box = document.getElementById('relList');
    if (!box) return;
    renderColorFilter();
    if (!relData.people.length) {
      box.innerHTML = '<div class="rel-empty">还没有人员信息<br>点击右上角「＋新增」开始建立人物关系</div>';
      return;
    }
    var shown = relData.people.filter(function (p) { return inPickColors(p); });
    if (!shown.length) {
      box.innerHTML = '<div class="rel-empty">该颜色下暂无人员<br>再次点击颜色按钮可显示全部</div>';
      return;
    }
    var editing = relEditingLink ? linkById(relEditingLink) : null;
    box.innerHTML = shown.map(function (p) {
      var color = colorOf(p);
      var isSel = relSelId === p.id;
      var others = relData.people.filter(function (o) { return o.id !== p.id; });
      var mine = relData.links.filter(function (l) { return l.from === p.id || l.to === p.id; });
      var editThis = isSel && !relFormNew && editing && relEditingCard === p.id;
      var formOpen = isSel && (relFormNew || editThis);
      var head = '<div class="rel-card-head" data-act="' + (isSel ? '' : 'toggle') + '">' +
        '<span class="rel-dot"></span>' +
        '<span class="rel-name">' + esc(p.name || '未命名人员') + '</span>' +
        '<span class="rel-org">' + esc(p.org) + '</span>' +
        (isSel ? '<button class="rel-mini" data-act="edit">编辑</button>' : '') +
        (isSel ? '<button class="rel-mini rel-danger" data-act="del">删除</button>' : '') +
        '</div>';
      if (!isSel) {
        return '<div class="rel-card" data-id="' + esc(p.id) + '" style="--rc:' + color + '">' + head + '</div>';
      }
      var chips = mine.map(function (l) {
        var out = l.from === p.id;
        var other = personById(out ? l.to : l.from);
        if (!other) return '';
        var on = editThis && editing.id === l.id ? ' on' : '';
        return '<button type="button" class="rel-chip' + on + '" data-act="chip" data-link="' + esc(l.id) + '"' +
          ' data-note="' + esc(l.note || '') + '"' +
          ' data-full="' + esc(other.name + ' · ' + (l.rel || '关联')) + '"' +
          ' title="点击编辑该关系">' +
          '<span class="rel-chip-name">' + esc(other.name) + '</span>' +
          '<span class="rel-chip-rel">【' + esc(l.rel || '关联') + '】</span></button>';
      }).join('');
      var curOther = editThis ? (function () {
        var out = editing.from === p.id;
        return personById(out ? editing.to : editing.from);
      })() : null;
      var opts = others.map(function (o) {
        var on = curOther && curOther.id === o.id ? ' on' : '';
        return '<button type="button" class="rel-opt' + on + '" data-act="opt" data-pid="' + esc(o.id) + '" data-name="' + esc(o.name) + '">' +
          '<span class="rel-opt-name">' + esc(o.name) + '</span>' +
          (o.org ? '<span class="rel-opt-org">' + esc(o.org) + '</span>' : '') + '</button>';
      }).join('');
      var viewDir = editThis ? relFromView(editing, p.id) : 'to';
      var dirBtn = function (d, l) {
        return '<button class="rel-dir-btn' + (viewDir === d ? ' active' : '') + '" data-act="dir" data-dir="' + d + '" title="' + l + '">' + dirArrow(d) + '</button>';
      };
      var curNote = editThis ? (editing.note || '') : '';
      var formHtml = formOpen
        ? '<div class="rel-add-form">' +
        '<div class="rel-combo">' +
        '<input class="rel-input rel-sel" type="text" autocomplete="off" placeholder="' + (others.length ? '选择人员' : '无其他人员') + '"' +
        ' value="' + esc(curOther ? curOther.name : '') + '" data-pid="' + esc(curOther ? curOther.id : '') + '"' +
        (others.length ? '' : ' disabled') + '>' +
        '<button type="button" class="rel-combo-btn" data-act="combo">▼</button>' +
        '<div class="rel-combo-list hidden">' + (opts || '<div class="rel-opt-empty">暂无可关联人员</div>') +
        '<div class="rel-opt-empty" data-empty="1" style="display:none">没有匹配的人员</div></div>' +
        '</div>' +
        '<input class="rel-input rel-rel" placeholder="关系，如 夫妻" value="' + (editThis ? esc(editing.rel) : '') + '">' +
        '<div class="rel-dir">' +
        dirBtn('to', '本人在前，指向对方') +
        dirBtn('from', '对方在前，指向本人') +
        dirBtn('both', '双向关系') +
        '</div>' +
        '<textarea class="rel-input rel-note" placeholder="备注（可多段）" title="这条关系的备注，可换行输入多段">' +
        esc(curNote) + '</textarea>' +
        '<button class="rel-mini rel-save" data-act="save-link">保存</button>' +
        '</div>'
        : '<div class="rel-add-form"><button class="rel-mini" data-act="new-link">添加关系</button></div>';
      return '<div class="rel-card sel" data-id="' + esc(p.id) + '" style="--rc:' + color + '">' +
        head +
        (chips ? '<div class="rel-links">' + chips + '</div>' : '') +
        formHtml +
        '</div>';
    }).join('');
  }

  function layoutPeople(W, H) {
    var miss = relData.people.filter(function (p) { return p.x === null || p.y === null; });
    if (miss.length) {
      var cx = relPan.x + W / 2, cy = relPan.y + H / 2;
      var rx = Math.max(70, Math.min(W / 2 - 80, 250));
      var ry = Math.max(60, Math.min(H / 2 - 70, 200));
      var total = Math.max(1, relData.people.length);
      relData.people.forEach(function (p, i) {
        if (p.x !== null && p.y !== null) return;
        var ang = -Math.PI / 2 + (Math.PI * 2 * i) / total;
        p.x = Math.round(cx + Math.cos(ang) * rx);
        p.y = Math.round(cy + Math.sin(ang) * ry);
      });
      save();
    }
    // 无限画布：允许节点在视口外，仅做安全范围限制
    relData.people.forEach(function (p) {
      p.x = Math.max(-REL_PAN_LIMIT, Math.min(REL_PAN_LIMIT, p.x));
      p.y = Math.max(-REL_PAN_LIMIT, Math.min(REL_PAN_LIMIT, p.y));
    });
  }

  function initials(name) {
    var s = String(name || '').trim();
    if (!s) return '?';
    return Array.from(s).slice(0, 2).join('');
  }
  function avatarFontSize(name) {
    var n = Math.max(1, Array.from(String(name || '').trim()).length);
    if (n <= 2) return 20;
    if (n === 3) return 15.5;
    if (n === 4) return 12.5;
    if (n === 5) return 10.5;
    return 9.5;
  }
  function nameFontSize(name) {
    var n = Math.max(1, Array.from(String(name || '')).length);
    var maxW = REL_R * 2 - 8;
    return Math.max(8, Math.min(16, Math.floor(maxW / n)));
  }

  function renderGraph() {
    var box = document.getElementById('relGraph');
    if (!box) return;
    if (animRaf) { cancelAnimationFrame(animRaf); animRaf = 0; }
    dragId = '';
    if (!relData.people.length) {
      box.innerHTML = '<div class="rel-graph-empty">暂无人员关系<br>在左侧新增人员并添加关系后，这里会生成关系拓扑图</div>';
      return;
    }
    var W = Math.max(320, Math.round(box.clientWidth) || 880);
    var H = Math.max(240, Math.round(box.clientHeight) || 560);
    layoutPeople(W, H);

    var defs = '<defs>' +
      '<marker id="relArrowEnd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="#7fc4ff"></path></marker>' +
      '<marker id="relArrowStart" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto">' +
      '<path d="M10,0 L0,5 L10,10 z" fill="#7fc4ff"></path></marker>' +
      '</defs>';

    var pairCount = {};
    var linkEls = relData.links.map(function (l) {
      if (!personById(l.from) || !personById(l.to)) return '';
      var key = [l.from, l.to].sort().join('|');
      var idx = pairCount[key] || 0;
      pairCount[key] = idx + 1;
      var off = idx * 14;
      var dash = isUncertainRel(l.rel);
      return '<g class="rel-link" data-id="' + esc(l.id) + '" data-from="' + esc(l.from) + '" data-to="' + esc(l.to) + '"' +
        ' data-dir="' + esc(l.dir) + '" data-off="' + off + '" data-dash="' + (dash ? '1' : '0') + '">' +
        '<line class="rel-flow-glow"></line>' +
        '<line class="rel-link-line' + (dash ? ' rel-dash' : '') + '"></line>' +
        '<line class="rel-flow-line" stroke-dasharray="16 48"></line>' +
        '<path class="rel-fx-overlay" d="" marker-end="none"></path>' +
        '<circle class="rel-fx-knob" r="5" data-lid="' + esc(l.id) + '"></circle>' +
        '<text class="rel-link-label" text-anchor="middle" dominant-baseline="middle">' + esc(l.rel || '') + '</text>' +
        '</g>';
    }).join('');

    var nodeEls = relData.people.map(function (p, i) {
      var color = colorOf(p);
      var g = '<g class="rel-node" data-id="' + esc(p.id) + '" data-phase="' + (i * 1.7).toFixed(2) + '">';
      g += '<circle class="rel-node-breath" r="' + REL_R + '" fill="none" stroke="' + color + '" stroke-width="6"></circle>';
      g += '<g class="rel-node-shape">';
      g += '<circle r="' + (REL_R + 8) + '" fill="' + color + '" opacity="0.12"></circle>';
      g += '<circle r="' + REL_R + '" fill="' + color + '" fill-opacity="0.22" stroke="' + color + '" stroke-width="1.8"></circle>';
      if (p.photo) {
        var clipId = 'relclip' + p.id;
        g += '<clipPath id="' + clipId + '"><circle r="' + REL_R + '"></circle></clipPath>';
        g += '<image href="' + p.photo + '" clip-path="url(#' + clipId + ')" x="' + (-REL_R) + '" y="' + (-REL_R) + '"' +
          ' width="' + (REL_R * 2) + '" height="' + (REL_R * 2) + '" preserveAspectRatio="xMidYMid slice"></image>';
        g += '<circle r="' + REL_R + '" fill="none" stroke="' + color + '" stroke-width="1.8"></circle>';
        g += '<text class="rel-node-label" y="' + (REL_R + 18) + '" text-anchor="middle" font-size="11.5" fill="#dff0ff" style="pointer-events:none;">' + esc(trunc(p.name || '未命名人员', 12)) + '</text>';
        if (p.org) g += '<text class="rel-node-label" y="' + (REL_R + 32) + '" text-anchor="middle" font-size="10" fill="rgba(150,190,230,.72)" style="pointer-events:none;">' + esc(trunc(p.org, 16)) + '</text>';
      } else {
        var fs = nameFontSize(p.name || '未命名人员');
        g += '<text y="' + Math.round(fs * 0.36) + '" text-anchor="middle" font-size="' + fs + '" fill="#eaf6ff" font-weight="700" style="pointer-events:none;">' + esc(p.name || '未命名人员') + '</text>';
        if (p.org) g += '<text class="rel-node-label" y="' + (REL_R + 18) + '" text-anchor="middle" font-size="10.5" fill="rgba(170,205,240,.78)" style="pointer-events:none;">' + esc(trunc(p.org, 16)) + '</text>';
      }
      g += '</g></g>';
      return g;
    }).join('');

    var headEls = relData.links.filter(function (l) {
      return personById(l.from) && personById(l.to);
    }).map(function (l) {
      return '<path class="rel-fx-head" data-lid="' + esc(l.id) + '" d=""></path>';
    }).join('');
    box.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + relPan.x + ' ' + relPan.y + ' ' + W + ' ' + H + '">' + defs +
      '<g class="rel-links">' + linkEls + '</g>' +
      '<g class="rel-nodes">' + nodeEls + '</g>' +
      '<g class="rel-fx-top">' + headEls + '</g>' +
      '<g class="rel-note-layer"></g></svg>';

    var svg = box.querySelector('svg');
    if (svg) {
      var labelEls = svg.querySelectorAll('.rel-link-label');
      for (var li = 0; li < labelEls.length; li++) {
        (function (el) {
          var lid = el.parentNode.getAttribute('data-id');
          el.style.cursor = 'pointer';
          el.addEventListener('mouseenter', function (ev) {
            var l = linkById(lid);
            if (!l) return;
            var d0 = relFromView(l, l.from);
            var ar = d0 === 'both' ? ' ↔ ' : (d0 === 'from' ? ' ← ' : ' → ');
            showTip(l.note || '', ev, (l.rel || '关联') + ' · ' + personLabel(l.from) + ar + personLabel(l.to));
          });
          el.addEventListener('mousemove', positionTip);
          el.addEventListener('mouseleave', hideTip);
          el.addEventListener('dblclick', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            var l = linkById(lid);
            if (!l) return;
            hideTip();
            openLinkModal(l.from, l.to, l.id);
          });
        })(labelEls[li]);
      }
      svg.addEventListener('pointerdown', onPointerDown);
      svg.addEventListener('pointermove', onPointerMove);
      svg.addEventListener('pointerup', onPointerUp);
      svg.addEventListener('pointercancel', onPointerUp);
      svg.addEventListener('dblclick', onGraphDblClick);
      svg.addEventListener('contextmenu', onGraphContextMenu);
      applyZoom();
    }
    dispPos = {};
    applyPositions();
    applyGraphFilter();
    applyPickMarks();
    applyIssueState();
    updateFootTip();
    startAnim();
    syncNotes();
  }

  // 关系词是否含不确定表述 → 虚线
  function isUncertainRel(rel) {
    var s = String(rel || '');
    if (!s) return false;
    for (var i = 0; i < DASH_WORDS.length; i++) {
      if (DASH_WORDS[i] && s.indexOf(DASH_WORDS[i]) >= 0) return true;
    }
    return false;
  }

  // 无限画布：平移通过 viewBox 实现，节点坐标 = 世界坐标
  function applyView() {
    var box = document.getElementById('relGraph');
    var svg = box ? box.querySelector('svg') : null;
    if (!svg) return;
    var W = Math.max(320, Math.round(box.clientWidth) || 880);
    var H = Math.max(240, Math.round(box.clientHeight) || 560);
    svg.setAttribute('viewBox', relPan.x + ' ' + relPan.y + ' ' + W + ' ' + H);
    var gz = 26 * (relZoom || 1);
    box.style.backgroundSize = gz + 'px ' + gz + 'px';
    box.style.backgroundPosition = (-relPan.x * (relZoom || 1)) + 'px ' + (-relPan.y * (relZoom || 1)) + 'px';
  }

  // 缩放：把 scale 作用在 svg 上，容器保持裁剪
  function applyZoom() {
    var graph = document.getElementById('relGraph');
    var svg = graph ? graph.querySelector('svg') : null;
    if (!svg) return;
    svg.style.transformOrigin = '0 0';
    svg.style.transform = relZoom === 1 ? '' : 'scale(' + relZoom + ')';
    applyView();
    var val = document.getElementById('relZoomVal');
    if (val) val.textContent = Math.round(relZoom * 100) + '%';
  }

  function setZoom(next) {
    relZoom = Math.min(2, Math.max(0.5, Math.round(next * 100) / 100));
    applyZoom();
    applyPositions();
  }

  function applyPositions(seconds) {
    var svg = document.querySelector('#relGraph svg');
    if (!svg) return;
    var nodes = svg.querySelectorAll('.rel-node');
    for (var i = 0; i < nodes.length; i++) {
      var g = nodes[i];
      var p = personById(g.getAttribute('data-id'));
      if (!p || p.x === null) continue;
      var dx = 0, dy = 0;
      if (typeof seconds === 'number' && p.id !== dragId) {
        var ph = parseFloat(g.getAttribute('data-phase')) || 0;
        dx = Math.sin(seconds * 0.9 + ph) * 2.2;
        dy = Math.cos(seconds * 0.7 + ph * 1.3) * 1.8;
      }
      dispPos[p.id] = { x: p.x + dx, y: p.y + dy };
      g.setAttribute('transform', 'translate(' + (p.x + dx).toFixed(2) + ',' + (p.y + dy).toFixed(2) + ')');
    }
    updateLinks(svg);
    layoutNotes();
  }

  function updateLinks(svg) {
    var groups = svg.querySelectorAll('.rel-link');
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      var a = dispPos[g.getAttribute('data-from')];
      var b = dispPos[g.getAttribute('data-to')];
      var line = g.querySelector('.rel-link-line');
      var label = g.querySelector('.rel-link-label');
      var flow = g.querySelector('.rel-flow-line');
      var glow = g.querySelector('.rel-flow-glow');
      if (!a || !b) { g.setAttribute('visibility', 'hidden'); continue; }
      g.removeAttribute('visibility');
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / d, uy = dy / d;
      var off = parseFloat(g.getAttribute('data-off')) || 0;
      var px = -uy * off, py = ux * off;
      var sx = a.x + ux * (REL_R + 3) + px, sy = a.y + uy * (REL_R + 3) + py;
      var ex = b.x - ux * (REL_R + 3) + px, ey = b.y - uy * (REL_R + 3) + py;
      line.setAttribute('x1', sx.toFixed(2));
      line.setAttribute('y1', sy.toFixed(2));
      line.setAttribute('x2', ex.toFixed(2));
      line.setAttribute('y2', ey.toFixed(2));
      if (flow) {
        // dir=from 时流向反向（血管从 to 端涌向 from 端），both 按 from→to
        var back = (g.getAttribute('data-dir') === 'from') !== (g.getAttribute('data-flow-rev') === '1');
        flow.setAttribute('x1', (back ? ex : sx).toFixed(2)); flow.setAttribute('y1', (back ? ey : sy).toFixed(2));
        flow.setAttribute('x2', (back ? sx : ex).toFixed(2)); flow.setAttribute('y2', (back ? sy : ey).toFixed(2));
      }
      if (glow) {
        glow.setAttribute('x1', sx.toFixed(2)); glow.setAttribute('y1', sy.toFixed(2));
        glow.setAttribute('x2', ex.toFixed(2)); glow.setAttribute('y2', ey.toFixed(2));
      }
      var ov = g.querySelector('.rel-fx-overlay');
      var knob = g.querySelector('.rel-fx-knob');
      if (ov && g.getAttribute('data-fx-on') === '1') {
        var bend = parseFloat(g.getAttribute('data-fx-bend')) || 0;
        var curve = g.getAttribute('data-fx-shape') === 'curve';
        var rev = g.getAttribute('data-fx-rev') === '1';
        var p1x = rev ? ex : sx, p1y = rev ? ey : sy;
        var p2x = rev ? sx : ex, p2y = rev ? sy : ey;
        if (curve) {
          var mx = (p1x + p2x) / 2, my = (p1y + p2y) / 2;
          var cx = mx - uy * bend * 2, cy = my + ux * bend * 2;
          ov.setAttribute('d', 'M' + p1x.toFixed(2) + ',' + p1y.toFixed(2) +
            ' Q' + cx.toFixed(2) + ',' + cy.toFixed(2) + ' ' + p2x.toFixed(2) + ',' + p2y.toFixed(2));
          if (knob) {
            knob.setAttribute('cx', (mx - uy * bend).toFixed(2));
            knob.setAttribute('cy', (my + ux * bend).toFixed(2));
          }
        } else {
          ov.setAttribute('d', 'M' + p1x.toFixed(2) + ',' + p1y.toFixed(2) +
            ' L' + p2x.toFixed(2) + ',' + p2y.toFixed(2));
          if (knob) { knob.setAttribute('cx', ((p1x + p2x) / 2).toFixed(2)); knob.setAttribute('cy', ((p1y + p2y) / 2).toFixed(2)); }
        }
        // 箭头：整条线均分人字形（»»»»），无缝循环滚动；顺向 from→to，逆向 to→from
        var head = (svg.querySelector('.rel-fx-top .rel-fx-head[data-lid="' + g.getAttribute('data-id') + '"]') ||
          g.querySelector('.rel-fx-head'));
        if (head) {
          if (g.getAttribute('data-fx-arrow') === '1') {
            var sw = parseFloat(ov.style.strokeWidth) || 2.6;
            var lx = ex - sx, ly = ey - sy;   // 实际连线段（from → to，与 rev 无关）
            var len = Math.sqrt(lx * lx + ly * ly) || 1;
            var fux = lx / len, fuy = ly / len;
            var size = Math.max(7, sw * 2.7);
            var cnt = Math.max(1, Math.min(18, Math.round(len / (size * 1.05))));
            var frac = ((performance.now() / 1000) * 1.35) % 1;   // 0..1 无缝推进
            var d = '';
            for (var ci = 0; ci < cnt; ci++) {
              var u = (ci + (rev ? 1 - frac : frac)) / cnt;       // 0..1 沿线位置
              var dist = u * len;
              if (dist < size * 0.45 || dist > len - size * 0.45) continue;
              var tux = rev ? -fux : fux, tuy = rev ? -fuy : fuy;
              var bx = sx + fux * dist, by = sy + fuy * dist;
              var nx = -tuy, ny = tux;
              var hw = size * 0.66;
              var tipx = bx + tux * size * 0.5, tipy = by + tuy * size * 0.5;
              var ax = bx - tux * size * 0.5, ay = by - tuy * size * 0.5;
              d += 'M' + (ax + nx * hw).toFixed(2) + ',' + (ay + ny * hw).toFixed(2) +
                ' L' + tipx.toFixed(2) + ',' + tipy.toFixed(2) +
                ' L' + (ax - nx * hw).toFixed(2) + ',' + (ay - ny * hw).toFixed(2) + ' ';
            }
            head.setAttribute('d', d);
            head.style.stroke = ov.style.stroke;
            head.style.strokeWidth = Math.max(1.9, sw * 1.2).toFixed(2);
            head.classList.add('on');
          } else {
            head.classList.remove('on');
          }
        }
        ov.setAttribute('marker-end', 'none');
        ov.setAttribute('marker-start', 'none');
      }
      var dir = g.getAttribute('data-dir');
      line.setAttribute('marker-end', (dir === 'to' || dir === 'both') ? 'url(#relArrowEnd)' : 'none');
      line.setAttribute('marker-start', (dir === 'from' || dir === 'both') ? 'url(#relArrowStart)' : 'none');      if (label) {
        label.setAttribute('x', ((sx + ex) / 2 + px * 0.6).toFixed(2));
        label.setAttribute('y', ((sy + ey) / 2 + py * 0.6 - 3).toFixed(2));
        if (!label.textContent) label.setAttribute('visibility', 'hidden');
      }
    }
  }

  function startAnim() {
    function step(t) {
      var panel = document.getElementById('recRelationPanel');
      if (panel && !panel.classList.contains('hidden') && !document.hidden) {
        applyPositions((t - animT0) / 1000);
      }
      animRaf = requestAnimationFrame(step);
    }
    animRaf = requestAnimationFrame(step);
  }

  function onPointerDown(e) {
    // 叠加连线的弧度拖点：拖动它改变曲线弧度（绕开人员）
    var knob = e.target && e.target.closest ? e.target.closest('.rel-fx-knob.on') : null;
    if (knob && e.button !== 2) {
      e.preventDefault();
      e.stopPropagation();
      startBendDrag(knob, e);
      return;
    }
    // 右键：节点上 = 整体拖动相连人员；背景上 = 平移画布
    // 新增动作模式下：右键只弹「新增动作」菜单，不拖拽
    if (e.button === 2) {
      e.preventDefault();
      if (relStepAdd.mode) return;
      var gn = e.target && e.target.closest ? e.target.closest('.rel-node') : null;
      if (!gn) { startPan(e); return; }
      startClusterDrag(gn.getAttribute('data-id'), e);
      return;
    }
    if (e.button !== undefined && e.button !== 0) return;
    var g = e.target && e.target.closest ? e.target.closest('.rel-node') : null;
    if (!g) return;
    var p = personById(g.getAttribute('data-id'));
    if (!p) return;
    // Ctrl / Cmd + 单击：加入或移出选中集合（用于建立关系）
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleSelId(p.id);
      return;
    }
    dragId = p.id;
    lastDownId = p.id;
    relClusterIds = {};
    g.classList.add('dragging');
    try { g.ownerSVGElement.setPointerCapture(e.pointerId); } catch (err) { }
    selectCard(p.id);
  }

  function startBendDrag(knob, e) {
    var svg = document.querySelector('#relGraph svg');
    if (!svg) return;
    var g = knob.parentNode;
    var lid = knob.getAttribute('data-lid');
    var a = dispPos[g.getAttribute('data-from')];
    var b = dispPos[g.getAttribute('data-to')];
    if (!a || !b) return;
    var loc = svgPoint(svg, e.clientX, e.clientY);
    if (!loc) return;
    var dx = b.x - a.x, dy = b.y - a.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / d, uy = dy / d;
    bendDrag = { lid: lid, g: g, ax: a.x, ay: a.y, bx: b.x, by: b.y, ux: ux, uy: uy, center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    try { svg.setPointerCapture(e.pointerId); } catch (err) { }
  }

  function startPan(e) {
    var box = document.getElementById('relGraph');
    var svg = box ? box.querySelector('svg') : null;
    if (!svg) return;
    hideTip();
    panDrag = { sx: e.clientX, sy: e.clientY, px: relPan.x, py: relPan.y };
    box.classList.add('panning');
    try { svg.setPointerCapture(e.pointerId); } catch (err) { }
  }

  function startClusterDrag(anchorId, e) {
    var anchor = personById(anchorId);
    if (!anchor) return;
    // 与锚点直接相连的人员 + 锚点自身，作为一个整体移动
    var set = {};
    set[anchorId] = true;
    relData.links.forEach(function (l) {
      if (l.from === anchorId) set[l.to] = true;
      else if (l.to === anchorId) set[l.from] = true;
    });
    // 只有确实连了人（3 人以上）才当整体拖，否则按单人拖
    var ids = Object.keys(set);
    relClusterId = anchorId;
    relClusterIds = {};
    if (ids.length > 2) {
      ids.forEach(function (id) { relClusterIds[id] = true; });
      startPos = {};
      ids.forEach(function (id) {
        var q = personById(id);
        if (q) startPos[id] = { x: q.x, y: q.y };
      });
    } else {
      startPos = {};
      startPos[anchorId] = { x: anchor.x, y: anchor.y };
      relClusterIds[anchorId] = true;
    }
    dragId = anchorId;
    lastDownId = anchorId;
    dragOrigin = null;
    var svg = document.querySelector('#relGraph svg');
    if (svg) {
      try { svg.setPointerCapture(e.pointerId); } catch (err) { }
      var loc = svgPoint(svg, e.clientX, e.clientY);
      if (loc) dragOrigin = loc;
    }
    var g = document.querySelector('#relGraph .rel-node[data-id="' + anchorId + '"]');
    if (g) g.classList.add('dragging');
  }

  function svgPoint(svg, cx, cy) {
    var ctm = svg.getScreenCTM();
    if (!ctm) return null;
    var pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    return pt.matrixTransform(ctm.inverse());
  }

  function toggleSelId(id) {
    var i = relSelIds.indexOf(id);
    if (i >= 0) relSelIds.splice(i, 1);
    else {
      relSelIds.push(id);
      if (relSelIds.length > 2) relSelIds.shift();
    }
    applyPickMarks();
    renderPickBar();
    updateFootTip();
    if (relSelIds.length) {
      var p = personById(relSelIds[relSelIds.length - 1]);
      if (p) toast('已选中：' + (p.name || '未命名人员') + '（共 ' + relSelIds.length + ' 人）');
    }
  }

  function applyPickMarks() {
    var nodes = document.querySelectorAll('#relGraph .rel-node');
    for (var i = 0; i < nodes.length; i++) {
      var on = relSelIds.indexOf(nodes[i].getAttribute('data-id')) >= 0;
      nodes[i].classList.toggle('rel-pick', on);
    }
    renderPickBar();
  }

  function renderPickBar() {
    var bar = document.getElementById('relPickBar');
    var cnt = document.getElementById('relPickCount');
    if (!bar) return;
    bar.style.display = relSelIds.length ? '' : 'none';
    if (cnt) cnt.textContent = '已选 ' + relSelIds.length + ' 人';
  }

  function clearPick() {
    relSelIds = [];
    applyPickMarks();
    renderPickBar();
    updateFootTip();
  }

  function onPointerMove(e) {
    if (bendDrag) {
      var svgB = document.querySelector('#relGraph svg');
      var locB = svgB ? svgPoint(svgB, e.clientX, e.clientY) : null;
      if (!locB) return;
      var nx = -bendDrag.uy, ny = bendDrag.ux;
      var bend = (locB.x - bendDrag.center.x) * nx + (locB.y - bendDrag.center.y) * ny;
      var step = bendDrag.g.getAttribute('data-fx-shape') === 'curve' ? 1 : 1;
      bendDrag.g.setAttribute('data-fx-bend', (bend * step).toFixed(2));
      updateLinks(svgB);
      return;
    }
    if (panDrag) {
      var dxp = (e.clientX - panDrag.sx) / (relZoom || 1);
      var dyp = (e.clientY - panDrag.sy) / (relZoom || 1);
      relPan.x = panDrag.px - dxp;
      relPan.y = panDrag.py - dyp;
      applyView();
      return;
    }
    if (!dragId) return;
    var svg = document.querySelector('#relGraph svg');
    if (!svg) return;
    var loc = svgPoint(svg, e.clientX, e.clientY);
    if (!loc) return;
    var W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height;
    if (relClusterId && relClusterId === dragId && startPos[dragId] && dragOrigin) {
      var dx = loc.x - dragOrigin.x, dy = loc.y - dragOrigin.y;
      Object.keys(relClusterIds).forEach(function (id) {
        var q = personById(id);
        if (!q || !startPos[id]) return;
        q.x = Math.max(-REL_PAN_LIMIT, Math.min(REL_PAN_LIMIT, startPos[id].x + dx));
        q.y = Math.max(-REL_PAN_LIMIT, Math.min(REL_PAN_LIMIT, startPos[id].y + dy));
      });
    } else {
      var p = personById(dragId);
      if (!p) return;
      p.x = Math.max(-REL_PAN_LIMIT, Math.min(REL_PAN_LIMIT, loc.x));
      p.y = Math.max(-REL_PAN_LIMIT, Math.min(REL_PAN_LIMIT, loc.y));
    }
    applyPositions();
  }

  function onPointerUp() {
    if (bendDrag) {
      var bg = bendDrag.g, blid = bendDrag.lid;
      var bendVal = parseFloat(bg.getAttribute('data-fx-bend')) || 0;
      bendDrag = null;
      var q0 = issueById(relIssueEditId);
      if (q0) {
        (q0.steps || []).forEach(function (s) {
          if (s.type === 'link' && s.ref === blid) s.fx.bend = Math.round(bendVal);
        });
        save();
      }
      return;
    }
    if (panDrag) {
      panDrag = null;
      var pb = document.getElementById('relGraph');
      if (pb) pb.classList.remove('panning');
      saveView();
      return;
    }
    if (!dragId) return;
    var g = document.querySelector('#relGraph .rel-node[data-id="' + dragId + '"]');
    if (g) g.classList.remove('dragging');
    dragId = '';
    relClusterId = '';
    relClusterIds = {};
    startPos = {};
    dragOrigin = null;
    save();
  }

  // 右键：单纯拖动整体，不弹菜单；新增动作模式下弹「新增动作」
  function onGraphContextMenu(e) {
    e.preventDefault();
    if (!relStepAdd.mode) return;
    var q = issueById(relIssueEditId);
    if (!q) return;
    var node = e.target && e.target.closest ? e.target.closest('.rel-node') : null;
    var link = e.target && e.target.closest ? e.target.closest('.rel-link') : null;
    var lbl = e.target && e.target.closest ? e.target.closest('.rel-link-label') : null;
    var items = [];
    if (relStepAdd.mode === 'person') {
      if (!node) { toast('请右键一名人员'); return; }
      var pid = node.getAttribute('data-id');
      items.push({ text: '＋ 新增人员（' + personLabel(pid) + '）', fn: function () {
        addStepWithFly('person', pid, node);
      } });
    } else {
      if (link || lbl) {
        var lid = (link || lbl.parentNode).getAttribute('data-id');
        var lk = linkById(lid);
        var nm = lk ? ((lk.rel || '关联') + ' · ' + personLabel(lk.from) + '—' + personLabel(lk.to)) : '';
        items.push({ text: '＋ 新增关系（' + nm + '）', fn: function () {
          addStepWithFly('link', lid, link || lbl);
        } });
      } else if (node) {
        var pid2 = node.getAttribute('data-id');
        var pair = relSelIds.length === 2 ? relSelIds.slice() : (relSelIds.length === 1 ? [relSelIds[0], pid2] : []);
        if (pair.length === 2 && pair[0] !== pair[1]) {
          items.push({ text: '＋ 新增关系（' + personLabel(pair[0]) + '—' + personLabel(pair[1]) + '）', fn: function () {
            addStepLinkWithFly(pair[0], pair[1], node);
          } });
        } else {
          items.push({ text: '需先按住 Ctrl 选中 2 人', fn: null, disabled: true });
        }
      } else {
        toast('请右键关系线，或 Ctrl 选两人后右键人员');
        return;
      }
    }
    showActMenu(e, items);
  }

  // 拓扑右键「新增动作」菜单
  function showActMenu(e, items) {
    var m = document.getElementById('relActMenu');
    if (!m) {
      m = document.createElement('div');
      m.id = 'relActMenu';
      m.className = 'rel-step-menu';
      document.body.appendChild(m);
      m.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('button[data-i]') : null;
        if (!b) return;
        var fn = (m.__fns || [])[Number(b.getAttribute('data-i'))];
        hideActMenu();
        if (fn) fn();
      });
    }
    var html = '';
    (m.__fns = []);
    items.forEach(function (it, i) {
      if (it.disabled) {
        html += '<button type="button" disabled style="opacity:.5;cursor:default;">' + esc(it.text) + '</button>';
        return;
      }
      m.__fns.push(it.fn);
      html += '<button type="button" data-i="' + (m.__fns.length - 1) + '">' + esc(it.text) + '</button>';
    });
    m.innerHTML = html;
    m.style.left = Math.min(e.clientX, window.innerWidth - 260) + 'px';
    m.style.top = Math.min(e.clientY, window.innerHeight - 90) + 'px';
    m.classList.add('show');
  }
  function hideActMenu() {
    var m = document.getElementById('relActMenu');
    if (m) m.classList.remove('show');
  }

  // 新增动作：先记下来源位置，重绘后从图中飞入列表
  function addStepWithFly(type, ref, srcEl) {
    var r = srcEl && srcEl.getBoundingClientRect ? srcEl.getBoundingClientRect() : null;
    var box = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    issueAddStep(type, ref);
    relStepAdd.mode = '';
    relStepAdd.from = '';
    document.querySelectorAll('#relGraph .rel-node').forEach(function (x) { x.classList.remove('rel-pick'); });
    if (box) flyToSteps(box);
    flashLastStep(relIssueStepOpen);
  }
  function addStepLinkWithFly(a, b, srcEl) {
    var r = srcEl && srcEl.getBoundingClientRect ? srcEl.getBoundingClientRect() : null;
    var box = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    var exist = relData.links.filter(function (l) {
      return (l.from === a && l.to === b) || (l.from === b && l.to === a);
    })[0];
    if (exist) {
      issueAddStep('link', exist.id);
      toast('两人已有关系，已加入列表：' + (exist.rel || '关联'));
    } else {
      var nl = { id: newId('l'), from: a, to: b, rel: '关联', dir: 'to', note: '' };
      relData.links.push(nl);
      save();
      renderList();
      renderGraph();
      issueAddStep('link', nl.id);
      toast('已新建关系并加入列表：' + personLabel(a) + ' → ' + personLabel(b));
    }
    relStepAdd.mode = '';
    relStepAdd.from = '';
    clearPick();
    if (box) flyToSteps(box);
    flashLastStep(relIssueStepOpen);
  }
  // 飞入动效：从拓扑图上的点飞到左侧「关联关系」列表
  function flyToSteps(box) {
    var panel = document.getElementById('relIssuePanel');
    if (!panel || panel.offsetParent === null) return;
    var area = panel.querySelector('.rel-issue-steps') || panel;
    var b = area.getBoundingClientRect();
    var dot = document.createElement('div');
    dot.className = 'rel-fly';
    dot.style.left = box.x + 'px';
    dot.style.top = box.y + 'px';
    document.body.appendChild(dot);
    var dx = (b.left + b.width / 2) - box.x;
    var dy = (b.top + 24) - box.y;
    requestAnimationFrame(function () {
      dot.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.35)';
      dot.style.opacity = '.15';
    });
    setTimeout(function () { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 680);
  }
  function flashLastStep(sid) {
    setTimeout(function () {
      var el = sid ? document.querySelector('#relIssueBody .rel-issue-step[data-sid="' + sid + '"]') : null;
      if (!el) {
        var rows = document.querySelectorAll('#relIssueBody .rel-issue-step');
        el = rows[rows.length - 1];
      }
      if (!el) return;
      el.classList.add('just-added');
      setTimeout(function () { el.classList.remove('just-added'); }, 900);
    }, 40);
  }

  function personLabel(id) {
    var p = personById(id);
    return p ? (p.name || '未命名人员') : '?';
  }

  // 统一浮窗（备注 / 关系说明），定位跟随鼠标
  function showTip(text, ev, head) {
    var tip = document.getElementById('relTip');
    if (!tip) return;
    var body = String(text == null ? '' : text).trim();
    if (!body && !head) { hideTip(); return; }
    tip.innerHTML = (head ? '<span class="rel-tip-head">' + esc(head) + '</span>' : '') +
      (body ? esc(body) : '<span style="color:rgba(160,200,240,.6)">（暂无备注）</span>');
    tip.style.display = 'block';
    positionTip(ev);
  }

  function positionTip(ev) {
    var tip = document.getElementById('relTip');
    if (!tip || tip.style.display === 'none') return;
    var e2 = ev || {};
    var cw = window.innerWidth, ch = window.innerHeight;
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = (typeof e2.clientX === 'number' ? e2.clientX : cw / 2) + 16;
    var y = (typeof e2.clientY === 'number' ? e2.clientY : ch / 2) + 18;
    if (x + tw > cw - 8) x = Math.max(8, cw - tw - 8);
    if (y + th > ch - 8) y = Math.max(8, ch - th - 8);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  function hideTip() {
    var tip = document.getElementById('relTip');
    if (tip) tip.style.display = 'none';
  }
  // 浮窗只在鼠标停在「…」按钮上时存在：鼠标一旦移出即关闭（面板重绘后也不会残留）
  function relTipHoverGuard() {
    if (document.documentElement.getAttribute('data-rel-tip-guard')) return;
    document.documentElement.setAttribute('data-rel-tip-guard', '1');
    document.addEventListener('mousemove', function (e) {
      var tip = document.getElementById('relTip');
      if (!tip || tip.style.display === 'none') return;
      var onBtn = e.target && e.target.closest ? e.target.closest('.rel-step-note') : null;
      if (!onBtn) hideTip();
    });
    document.addEventListener('mousedown', function () {
      var tip = document.getElementById('relTip');
      if (tip && tip.style.display !== 'none') hideTip();
    });
    document.addEventListener('pointermove', function (e) { noteDragMove(e); });
    document.addEventListener('pointerup', function () { noteDragEnd(); });
    document.addEventListener('pointercancel', function () { noteDragEnd(); });
  }

  // 演示中：← / → 等价于「上一步 / 下一步」（在输入框内不拦截）
  function relDemoKeyNav(e) {
    if (!e || e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (!relIssueDemo || !relIssueDemo.on) return;
    var tg = e.target;
    var typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable);
    if (typing) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') recRelIssueDemoPrevStep();
    else recRelIssueDemoNextStep();
  }

  function updateFootTip() {
    var tip = document.getElementById('setbarRelTip');
    if (!tip) return;
    if (relIssueDemo.on) {
      var dq = issueById(relIssueDemo.id);
      tip.textContent = '演示中：' + (dq ? dq.title : '') + ' · 「» / «」或 ← / → 逐步讲解 · 右上角 × 退出';
      return;
    }
    if (relIssueOpen) {
      tip.textContent = '问题分析：单击问题选中并标注拓扑图 · 双击进入编辑 · 「演示」播放关系发展';
      return;
    }
    if (relSelIds.length === 2) {
      tip.textContent = '已选 2 人 · 点上方「添加关系」建立关系 · Ctrl+单击可取消选择';
    } else if (relSelIds.length === 1) {
      tip.textContent = '已选 1 人 · 再按住 Ctrl 点击另一人可建立关系';
    } else if (relMultiPick) {
      tip.textContent = '多选模式 · 单击圆按钮叠加色系 · 双击任意圆按钮退出';
    } else {
      tip.textContent = '左键拖动节点 · 右键拖背景平移画布 · 右键拖节点带走相连人员 · 双击节点看名片 · 双击关系名编辑 · Ctrl+单击选人';
    }
  }

  function onGraphDblClick(e) {
    // 新增人员：双击 1 人 → 加入关联关系列表
    if (relStepAdd.mode === 'person') {
      var gn0 = e.target && e.target.closest ? e.target.closest('.rel-node') : null;
      e.preventDefault();
      e.stopPropagation();
      if (gn0) {
        issueAddStep('person', gn0.getAttribute('data-id'));
        relStepAdd.mode = '';
        toast('已添加人员步骤：' + personLabel(gn0.getAttribute('data-id')));
      } else {
        toast('请双击一名人员');
      }
      return;
    }
    // 新增关系：双击已有连线 → 直接加入列表
    if (relStepAdd.mode === 'link') {
      var lg0 = e.target && e.target.closest ? e.target.closest('.rel-link') : null;
      if (lg0) {
        e.preventDefault();
        e.stopPropagation();
        issueAddStep('link', lg0.getAttribute('data-id'));
        relStepAdd.mode = '';
        toast('已添加关系步骤');
        return;
      }
    }
    var g = e.target && e.target.closest ? e.target.closest('.rel-node') : null;
    var id = g ? g.getAttribute('data-id') : lastDownId;
    if (!id) return;
    e.preventDefault();
    showCard(id);
  }

  function selectCard(id) {
    var p = personById(id);
    if (!p) return;
    if (relColorFilter && colorKeyOf(p) !== relColorFilter) relColorFilter = '';
    if (relSelId === id) return;
    relSelId = id;
    relFormNew = false;
    relEditingLink = '';
    relEditingCard = '';
    renderList();
    var card = document.querySelector('#relList .rel-card[data-id="' + id + '"]');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest' });
  }

  function deselectCard() {
    relSelId = '';
    relFormNew = false;
    relEditingLink = '';
    relEditingCard = '';
    renderList();
  }

  function addPerson() {
    // 单选筛选状态（恰好一个色圆被点中）→ 新人员默认用这个色系
    var seedColor = '';
    if (relMultiPick) {
      var set = pickColorSet();
      if (set.length === 1) seedColor = set[0];
    } else if (relColorFilter) {
      seedColor = relColorFilter;
    }
    var p = {
      id: newId('p'),
      name: '新人员' + (relData.people.length + 1),
      org: '',
      info: [],
      color: seedColor || COLOR_KEYS[relData.people.length % COLOR_KEYS.length],
      photo: '',
      x: null,
      y: null
    };
    relData.people.push(p);
    save();
    relSelId = p.id;
    renderList();
    renderGraph();
    openInfo(p.id);
  }

  function removePerson(id) {
    relData.people = relData.people.filter(function (p) { return p.id !== id; });
    relData.links = relData.links.filter(function (l) { return l.from !== id && l.to !== id; });
    if (relEditingCard === id) { relEditingLink = ''; relEditingCard = ''; }
    if (relSelId === id) relSelId = '';
    save();
    renderList();
    renderGraph();
  }

  function addLink(fromId, toId, rel, dir, note) {
    if (!fromId || !toId || fromId === toId) return;
    relData.links.push({
      id: newId('l'),
      from: fromId,
      to: toId,
      rel: String(rel || '').trim() || '关联',
      note: String(note || '').replace(/\r\n/g, '\n').trim(),
      dir: dir === 'from' || dir === 'both' ? dir : 'to'
    });
    save();
    renderList();
    renderGraph();
  }

  function updateLink(id, pid, otherId, rel, dir, note) {
    var l = linkById(id);
    if (!l || !otherId || pid === otherId) return;
    l.from = pid;
    l.to = otherId;
    l.rel = String(rel || '').trim() || '关联';
    l.note = String(note || '').replace(/\r\n/g, '\n').trim();
    l.dir = dir === 'from' || dir === 'both' ? dir : 'to';
    save();
    renderList();
    renderGraph();
  }

  function removeLink(id) {
    relData.links = relData.links.filter(function (l) { return l.id !== id; });
    if (relEditingLink === id) { relEditingLink = ''; relEditingCard = ''; }
    save();
    renderList();
    renderGraph();
  }

  function openInfo(id) {
    var p = personById(id);
    if (!p) return;
    relModalId = id;
    relDraftColor = colorKeyOf(p);
    relDraftPhoto = p.photo || '';
    var m = document.getElementById('relInfoModal');
    if (!m) return;
    document.getElementById('relInfoName').value = p.name;
    document.getElementById('relInfoOrg').value = p.org;
    document.getElementById('relInfoText').value = (p.info || []).join('\n');
    renderColors();
    renderInfoLinks(p.id);
    renderPhoto();
    relBatchClose();
    m.style.display = 'flex';
    setTimeout(function () {
      var el = document.getElementById('relInfoName');
      if (el) { el.focus(); el.select(); }
    }, 30);
  }

  function renderColors() {
    var box = document.getElementById('relInfoColors');
    if (!box) return;
    box.innerHTML = COLOR_KEYS.map(function (k) {
      return '<button type="button" class="rel-swatch' + (relDraftColor === k ? ' on' : '') + '" data-color="' + k + '"' +
        ' style="background:' + COLOR_HEX[k] + '" title="' + COLOR_NAMES[k] + '"></button>';
    }).join('') + '<span class="rel-color-name">' + (COLOR_NAMES[relDraftColor] || '') + '</span>';
  }

  // 人员编辑弹窗里的「关系人」：已有关系标签（点击可编辑/删除）+ 添加关系按钮
  function renderInfoLinks(pid) {
    var box = document.getElementById('relInfoLinks');
    if (!box) return;
    var mine = relData.links.filter(function (l) { return l.from === pid || l.to === pid; });
    if (!mine.length) {
      box.innerHTML = '<span class="rel-lk-empty">暂无关系，点右侧「＋添加关系」建立</span>';
      return;
    }
    box.innerHTML = mine.map(function (l) {
      var out = l.from === pid;
      var other = personById(out ? l.to : l.from);
      if (!other) return '';
      var dash = isUncertainRel(l.rel);
      return '<button type="button" class="rel-chip" data-link="' + esc(l.id) + '"' +
        ' title="点击编辑 / 删除该关系">' +
        '<span class="rel-chip-name">' + esc(other.name) + '</span>' +
        '<span class="rel-chip-rel">【' + esc(l.rel || '关联') + '】</span>' +
        (dash ? '<span class="rel-lk-row-dash">虚</span>' : '') +
        '</button>';
    }).join('');
  }

  // ================= 关系弹窗（两个人 + 关系 + 方向 + 已有关系列表） =================
  function openLinkModal(aId, bId, editId) {
    var a = personById(aId);
    var b = personById(bId);
    if (!a || !b) return;
    relLinkPair = { a: aId, b: bId };
    relLinkEditId = editId || '';
    var m = document.getElementById('relLinkModal');
    if (!m) return;
    var t = document.getElementById('relLinkTitle');
    if (t) t.textContent = editId ? '编辑关系' : '添加关系';
    fillLinkPeopleList();
    var aBox = document.getElementById('relLkNameA');
    var bBox = document.getElementById('relLkNameB');
    if (aBox) aBox.value = a.name || '';
    if (bBox) bBox.value = b.name || '';
    var input = document.getElementById('relLkRel');
    var dir = 'to';
    if (editId) {
      var l = linkById(editId);
      if (l) {
        input.value = l.rel || '';
        var noteEl = document.getElementById('relLkNote');
        if (noteEl) noteEl.value = l.note || '';
        // 统一到「A→B」视角：若数据里 from 是 B，则方向取反
        var view = relFromView(l, aId);
        dir = view === 'from' ? 'from' : (view === 'both' ? 'both' : 'to');
      }
    } else {
      input.value = '';
      var noteEl2 = document.getElementById('relLkNote');
      if (noteEl2) noteEl2.value = '';
    }
    recRelLinkDir(dir);
    renderLinkList();
    m.style.display = 'flex';
    setTimeout(function () { try { input.focus(); input.select(); } catch (e) { } }, 40);
  }

  function openPairLink() {
    if (relSelIds.length !== 2) {
      toast('请按住 Ctrl 点击选中两个人员');
      return;
    }
    // 已有关系则直接进入编辑
    var a = relSelIds[0], b = relSelIds[1];
    var exist = relData.links.filter(function (l) {
      return (l.from === a && l.to === b) || (l.from === b && l.to === a);
    })[0];
    openLinkModal(a, b, exist ? exist.id : '');
  }

  function openInfoAddLink() {
    if (!relModalId) return;
    var others = relData.people.filter(function (o) { return o.id !== relModalId; });
    if (!others.length) { toast('还没有其他人员可关联'); return; }
    openLinkModal(relModalId, others[0].id, '');
    // 人员 B 留空，由用户在输入框里填写（可从下拉候选里选）
    var bBox = document.getElementById('relLkNameB');
    if (bBox) {
      bBox.value = '';
      relLinkPair.b = '';
      renderLinkList();
      var relInput = document.getElementById('relLkRel');
      if (relInput) relInput.value = '';
      setTimeout(function () { try { bBox.focus(); } catch (e) { } }, 60);
    }
  }

  // 关系弹窗的人员候选（datalist）
  function fillLinkPeopleList() {
    var dl = document.getElementById('relLkPeopleList');
    if (!dl) return;
    dl.innerHTML = relData.people.map(function (p) {
      return '<option value="' + esc(p.name || '') + '"></option>';
    }).join('');
  }

  // 按姓名找人员；deleteable=false 时不新建
  function personByName(name, createIfMissing) {
    var key = String(name || '').trim();
    if (!key) return null;
    for (var i = 0; i < relData.people.length; i++) {
      if ((relData.people[i].name || '').trim() === key) return relData.people[i];
    }
    if (!createIfMissing) return null;
    var seed = '';
    if (relMultiPick) {
      var set = pickColorSet();
      if (set.length === 1) seed = set[0];
    } else if (relColorFilter) {
      seed = relColorFilter;
    }
    var np = {
      id: newId('p'),
      name: key,
      org: '',
      info: [],
      color: seed || COLOR_KEYS[relData.people.length % COLOR_KEYS.length],
      photo: '',
      x: null,
      y: null
    };
    relData.people.push(np);
    return np;
  }

  // 输入框里改了姓名 → 同步 relLinkPair 并刷新已有关系列表
  function syncLinkPairFromInputs() {
    if (!relLinkPair) return;
    var aEl = document.getElementById('relLkNameA');
    var bEl = document.getElementById('relLkNameB');
    var pa = personByName(aEl ? aEl.value : '', false);
    var pb = personByName(bEl ? bEl.value : '', false);
    if (pa) relLinkPair.a = pa.id;
    if (pb) relLinkPair.b = pb.id;
    renderLinkList();
  }

  function renderLinkList() {
    var box = document.getElementById('relLkList');
    if (!box || !relLinkPair) return;
    var a = relLinkPair.a, b = relLinkPair.b;
    var pa = personById(a), pb = personById(b);
    var aName = pa ? (pa.name || '') : ((document.getElementById('relLkNameA') || {}).value || '').trim();
    var bName = pb ? (pb.name || '') : ((document.getElementById('relLkNameB') || {}).value || '').trim();
    var mine = (a && b) ? relData.links.filter(function (l) {
      return (l.from === a && l.to === b) || (l.from === b && l.to === a);
    }) : [];
    if (!mine.length) {
      box.innerHTML = '<div class="rel-lk-empty">这两人之间还没有关系，可直接在上方填写后保存</div>';
      return;
    }
    box.innerHTML = mine.map(function (l) {
      var out = l.from === a;
      var other = personById(out ? l.to : l.from);
      var d = relFromView(l, a);
      var arrow = d === 'both' ? '↔' : (d === 'from' ? '←' : '→');
      var dash = isUncertainRel(l.rel);
      var noteHtml = l.note ? '<div class="rel-lk-row-note">' + esc(trunc(l.note, 120)) + '</div>' : '';
      return '<div class="rel-lk-row' + (relLinkEditId === l.id ? ' on' : '') + '" data-link="' + esc(l.id) + '">' +
        '<span class="rel-lk-row-text"><b>' + esc(aName || '—') + '</b>' +
        '<span class="rel-lk-row-arrow">' + arrow + '</span>' +
        '<span>' + esc(l.rel || '关联') + '</span></span>' +
        (dash ? '<span class="rel-lk-row-dash">虚线</span>' : '') +
        noteHtml +
        '<button class="rel-mini" data-act="lk-edit" data-link="' + esc(l.id) + '">编辑</button>' +
        '<button class="rel-mini rel-danger" data-act="lk-del" data-link="' + esc(l.id) + '">删除</button>' +
        '</div>';
    }).join('');
  }

  function recRelLinkDir(d) {
    var box = document.getElementById('relLkDirs');
    if (box) {
      var bs = box.querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-dir') === d);
    }
    var hint = document.getElementById('relLkHint');
    if (hint) {
      var input = document.getElementById('relLkRel');
      var un = !!(input && isUncertainRel(input.value));
      hint.textContent = un
        ? '含不确定词 → 拓扑图画虚线'
        : '含「疑似 / 可能 / 好像 / 类似」等词时自动画虚线';
      hint.classList.toggle('warn', un);
    }
  }

  function currentLinkDir() {
    var on = document.querySelector('#relLkDirs button.on');
    return on ? on.getAttribute('data-dir') : 'to';
  }

  function saveLinkModal() {
    if (!relLinkPair) return;
    var aEl = document.getElementById('relLkNameA');
    var bEl = document.getElementById('relLkNameB');
    var nameA = aEl ? aEl.value.trim() : '';
    var nameB = bEl ? bEl.value.trim() : '';
    if (!nameA || !nameB) { toast('请填写两个人员的姓名'); return; }
    var pa = personByName(nameA, true);
    var pb = personByName(nameB, true);
    if (!pa || !pb) { toast('人员姓名无效'); return; }
    if (pa.id === pb.id) { toast('同一人不能和自己建立关系'); return; }
    // 姓名发生过改动：编辑时保留原关系 id，新增则视为新关系
    var nameChanged = (relLinkPair.a !== pa.id) || (relLinkPair.b !== pb.id);
    relLinkPair.a = pa.id;
    relLinkPair.b = pb.id;
    var a = pa.id, b = pb.id;
    var rel = document.getElementById('relLkRel').value.trim();
    var noteEl = document.getElementById('relLkNote');
    var note = noteEl ? noteEl.value.replace(/\r\n/g, '\n').trim() : '';
    var dir = currentLinkDir();
    var view = dir;                       // 弹窗视角：A → B
    var from = a, to = b;
    var store = view === 'from' ? 'from' : (view === 'both' ? 'both' : 'to');
    var l = relLinkEditId && !nameChanged ? linkById(relLinkEditId) : null;
    if (l) {
      l.from = from; l.to = to; l.rel = rel || '关联'; l.dir = store; l.note = note;
    } else {
      relData.links.push({
        id: newId('l'), from: from, to: to, rel: rel || '关联', dir: store, note: note
      });
    }
    save();
    closeLinkModal(true);
    renderList();
    renderGraph();
    if (document.getElementById('relInfoModal').style.display !== 'none' && relModalId) {
      renderInfoLinks(relModalId);
    }
    toast(isUncertainRel(rel) ? '关系已保存（不确定关系，显示为虚线）' : '关系已保存');
  }

  function removeLinkModal(lid) {
    relData.links = relData.links.filter(function (l) { return l.id !== lid; });
    if (relEditingLink === lid) { relEditingLink = ''; relEditingCard = ''; }
    if (relLinkEditId === lid) {
      relLinkEditId = '';
      var input = document.getElementById('relLkRel');
      if (input) input.value = '';
    }
    save();
    renderLinkList();
    renderList();
    renderGraph();
    if (relModalId) renderInfoLinks(relModalId);
    toast('关系已删除');
  }

  function closeLinkModal(saved) {
    var m = document.getElementById('relLinkModal');
    if (m) m.style.display = 'none';
    relLinkPair = null;
    relLinkEditId = '';
    if (!saved) renderPickBar();
  }

  // ================= 缩放 / 截图 / 三态满屏 =================
  function zoomBy(step) {
    if (step === 0) setZoom(1);
    else setZoom(relZoom + step * 0.1);
  }

  function toggleFull() {
    relFullMode = (relFullMode + 1) % 3;
    applyFull();
  }

  // 人员列表 / 问题分析 = 左栏两页；整屏全屏时左栏整体隐藏，问题分析改为左侧浮窗
  var relFloatPos = { x: 12, y: 58 };
  function syncIssuePanelHost() {
    var panel = document.getElementById('relIssuePanel');
    var host = document.querySelector('#recRelationPanel .rel-listcol');
    if (!panel || !host) return;
    var screen = relFullMode >= 2;
    var float = screen && !!relIssueOpen;
    panel.classList.toggle('rel-issue-float', float);
    var target = float ? document.body : host;
    if (panel.parentNode !== target) target.appendChild(panel);
    if (float) {
      panel.style.left = relFloatPos.x + 'px';
      panel.style.top = relFloatPos.y + 'px';
    } else {
      panel.style.left = '';
      panel.style.top = '';
    }
    host.classList.toggle('page-issue', !!relIssueOpen && !screen);
    var tab = document.getElementById('relPageTab');
    if (tab) {
      tab.textContent = relIssueOpen ? (relIssueEditId ? '编辑' : '问题分析') : '人员列表';
      tab.classList.toggle('on', !!relIssueOpen);
    }
    // 标题栏右侧按钮组：人员列表 / 问题分析（列表或编辑）
    var lt = document.getElementById('relListTools');
    var it = document.getElementById('relIssueTools');
    if (lt) lt.style.display = relIssueOpen ? 'none' : '';
    if (it) it.style.display = relIssueOpen ? '' : 'none';
    var back = document.getElementById('relIssueBack');
    if (back) back.style.display = relIssueEditId ? '' : 'none';
    var nw = document.getElementById('relIssueNew');
    if (nw) nw.style.display = relIssueEditId ? 'none' : '';
    var ab = document.getElementById('relAnalysisBtn');
    if (ab) {
      ab.style.display = screen ? '' : 'none';
      ab.classList.toggle('on', !!relIssueOpen);
    }
  }
  // 通用拖动：handle 上加指针事件，超出视口自动夹住
  function makeDraggable(el, handle, key, onMove) {
    if (!el || !handle || handle.getAttribute('data-drag')) return;
    handle.setAttribute('data-drag', '1');
    handle.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var t = e.target;
      if (t && t.closest && t.closest('button, input, textarea, select, a')) return;
      var er = el.getBoundingClientRect();
      var ox = er.left, oy = er.top;
      var sx = e.clientX, sy = e.clientY;
      var fixed = getComputedStyle(el).position === 'fixed';
      if (!fixed) {
        var parent = el.offsetParent || el.parentNode;
        var pr = parent.getBoundingClientRect();
        ox -= pr.left; oy -= pr.top;
      }
      el.style.left = ox + 'px';
      el.style.top = oy + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.transform = 'none';
      el.classList.add('rel-dragging');
      function move(ev) {
        var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
        var nx = ox + ev.clientX - sx, ny = oy + ev.clientY - sy;
        nx = Math.max(2, Math.min(vw - er.width - 2, nx));
        ny = Math.max(2, Math.min(vh - 28, ny));
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
        if (onMove) onMove(nx, ny);
      }
      function up() {
        el.classList.remove('rel-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      e.preventDefault();
      e.stopPropagation();
    });
  }
  function bindDragTargets() {
    var panel = document.getElementById('relIssuePanel');
    makeDraggable(panel, panel ? panel.querySelector('.rel-issue-drag') : null, null, function (x, y) {
      if (relFullMode >= 2) { relFloatPos.x = x; relFloatPos.y = y; }
    });
    makeDraggable(document.getElementById('relIssueCard'),
      document.querySelector('#relIssueCard .rel-issue-card-head'));
    makeDraggable(document.getElementById('relDemoBar'), document.getElementById('relDemoBar'));
  }
  function applyFull() {
    var col = document.getElementById('relGraphCol');
    var wrap = document.querySelector('#recRelationPanel .rel-wrap');
    var btn = document.getElementById('relFullBtn');
    if (!col) return;
    var screen = relFullMode >= 2;
    if (wrap) {
      wrap.classList.toggle('rel-g-mid', relFullMode >= 1 && !screen);
      wrap.classList.toggle('rel-g-full', screen);
    }
    col.classList.toggle('rel-g-screen', screen);
    if (screen) {
      if (!relScreenHome) {
        relScreenHome = { parent: col.parentNode, next: col.nextSibling };
        document.body.appendChild(col);
      }
      document.body.classList.add('rel-g-screen-lock');
    } else if (relScreenHome) {
      var home = relScreenHome;
      relScreenHome = null;
      document.body.classList.remove('rel-g-screen-lock');
      if (home.parent) home.parent.insertBefore(col, home.next && home.next.parentNode === home.parent ? home.next : null);
    }
    if (btn) {
      btn.classList.toggle('active', relFullMode >= 1);
      btn.title = relFullMode === 0 ? '中部满屏' : (relFullMode === 1 ? '再点：整屏全屏' : '再点：恢复原样');
    }
    syncIssuePanelHost();
    setTimeout(function () {
      renderGraph();
      applyPositions();
      syncIssuePanelHost();
    }, 40);
  }

  // 截图：只导出拓扑图区域（不含标题栏与版记）
  function takeShot() {
    var box = document.getElementById('relGraph');
    var svg = box ? box.querySelector('svg') : null;
    if (!svg) { toast('拓扑图还没有内容'); return; }
    var clone = svg.cloneNode(true);
    var w = svg.viewBox.baseVal.width || box.clientWidth;
    var h = svg.viewBox.baseVal.height || box.clientHeight;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    clone.style.transform = '';
    // 把当前样式内联（外部 <style> 不会随序列化带过去）
    clone.querySelectorAll('.rel-link-line').forEach(function (el) {
      el.setAttribute('stroke', 'rgba(96,160,235,0.5)');
      el.setAttribute('stroke-width', '1.4');
      if (el.classList.contains('rel-dash')) el.setAttribute('stroke-dasharray', '7 5');
    });
    clone.querySelectorAll('.rel-link-label').forEach(function (el) {
      el.setAttribute('font-size', '11');
      el.setAttribute('fill', '#a9cdea');
      el.setAttribute('font-family', 'sans-serif');
    });
    clone.querySelectorAll('.rel-node-label').forEach(function (el) {
      el.setAttribute('font-family', 'sans-serif');
    });
    clone.querySelectorAll('text').forEach(function (el) {
      if (!el.getAttribute('font-family')) el.setAttribute('font-family', 'sans-serif');
    });
    var xml = new XMLSerializer().serializeToString(clone);
    var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    var img = new Image();
    img.onload = function () {
      var scale = 2;
      var cv = document.createElement('canvas');
      cv.width = Math.round(w * scale);
      cv.height = Math.round(h * scale);
      var c2 = cv.getContext('2d');
      c2.fillStyle = '#050a16';
      c2.fillRect(0, 0, cv.width, cv.height);
      c2.drawImage(img, 0, 0, cv.width, cv.height);
      var name = relSafeName(relThemeName || '人物关系') + '-拓扑图-' + stamp() + '.png';
      try {
        cv.toBlob(function (blob) {
          if (!blob) { toast('截图失败：无法生成图片'); return; }
          var a2 = document.createElement('a');
          a2.href = URL.createObjectURL(blob);
          a2.download = name;
          document.body.appendChild(a2);
          a2.click();
          setTimeout(function () { URL.revokeObjectURL(a2.href); if (a2.parentNode) a2.parentNode.removeChild(a2); }, 500);
          toast('拓扑图已另存为 ' + name);
        }, 'image/png');
      } catch (e) {
        toast('截图失败：' + (e && e.message ? e.message : '浏览器限制'));
      }
    };
    img.onerror = function () { toast('截图失败：拓扑图无法转换为图片'); };
    img.src = url;
  }

  function stamp() {
    var d = new Date();
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
  }

  function renderPhoto() {    var box = document.getElementById('relPhotoBox');
    var img = document.getElementById('relPhotoImg');
    if (!box || !img) return;
    if (relDraftPhoto) {
      img.src = relDraftPhoto;
      box.classList.add('has');
    } else {
      img.removeAttribute('src');
      box.classList.remove('has');
    }
    box.classList.remove('ready');
  }

  function pickPhoto() {
    var input = document.getElementById('relPhotoInput');
    if (input) input.click();
  }

  function focusPhoto(ev) {
    var box = document.getElementById('relPhotoBox');
    if (!box) return;
    if (ev && ev.target && ev.target.closest && ev.target.closest('.rel-photo-add')) return;
    try { box.focus(); } catch (e) {}
    box.classList.add('ready');
  }

  function pastePhoto(ev) {
    var m = document.getElementById('relInfoModal');
    if (!m || m.style.display === 'none') return;
    var t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    var items = (ev.clipboardData && ev.clipboardData.items) || [];
    var file = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && /^image\//.test(items[i].type || '')) {
        file = items[i].getAsFile();
        if (file) break;
      }
    }
    if (!file) return;
    ev.preventDefault();
    readPhoto(file, function (url) {
      if (url) {
        relDraftPhoto = url;
        renderPhoto();
        toast('已粘贴图片');
      } else toast('无法读取剪贴板中的图片');
    });
  }

  function dropPhoto(ev) {
    var box = document.getElementById('relPhotoBox');
    if (box) box.classList.remove('dragover');
    var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (!f) return;
    ev.preventDefault();
    readPhoto(f, function (url) {
      if (url) { relDraftPhoto = url; renderPhoto(); }
      else toast('无法读取该图片');
    });
  }

  function clearPhoto() {
    relDraftPhoto = '';
    renderPhoto();
  }

  function readPhoto(file, cb) {
    if (!file || !/^image\//.test(file.type || '')) { cb(''); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 260;
        var w = img.width || max, h = img.height || max;
        var scale = Math.min(1, max / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var cv = document.createElement('canvas');
        cv.width = cw;
        cv.height = ch;
        cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
        try { cb(cv.toDataURL('image/jpeg', 0.85)); } catch (e) { cb(''); }
      };
      img.onerror = function () { cb(''); };
      img.src = reader.result;
    };
    reader.onerror = function () { cb(''); };
    reader.readAsDataURL(file);
  }

  function closeInfo() {
    var m = document.getElementById('relInfoModal');
    if (m) m.style.display = 'none';
    relModalId = '';
    relDraftPhoto = '';
  }

  function saveInfo() {
    var p = personById(relModalId);
    if (!p) { closeInfo(); return; }
    var name = document.getElementById('relInfoName').value.trim();
    p.name = name || '未命名人员';
    p.org = document.getElementById('relInfoOrg').value.trim();
    p.info = document.getElementById('relInfoText').value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(function (s) { return s; });
    p.color = COLOR_HEX[relDraftColor] ? relDraftColor : colorKeyOf(p);
    p.photo = relDraftPhoto || '';
    save();
    closeInfo();
    renderList();
    renderGraph();
  }

  function showCard(id) {
    var p = personById(id);
    if (!p) return;
    relCardId = id;
    var body = document.getElementById('relCardBody');
    var m = document.getElementById('relCardModal');
    if (!body || !m) return;
    var mine = relData.links.filter(function (l) { return l.from === id || l.to === id; });
    var linkHtml = mine.map(function (l) {
      var out = l.from === id;
      var other = personById(out ? l.to : l.from);
      if (!other) return '';
      return '<div class="rel-profile-link"><span class="rel-profile-arrow">' + dirArrow(relFromView(l, id)) + '</span>' +
        '<span>' + esc(l.rel || '关联') + '</span><b>' + esc(other.name) + '</b></div>';
    }).join('');
    var avatar = p.photo
      ? '<img src="' + p.photo + '" alt="">'
      : '<span class="rel-avatar-name" style="font-size:' + avatarFontSize(p.name) + 'px">' + esc(p.name || '未命名人员') + '</span>';
    body.innerHTML = '<div class="rel-profile">' +
      '<div class="rel-profile-top">' +
      '<div class="rel-avatar" style="border-color:' + colorOf(p) + '">' + avatar + '</div>' +
      '<div><div class="rel-profile-name">' + esc(p.name || '未命名人员') + '</div>' +
      '<div class="rel-profile-org">' + esc(p.org || '未填写单位 / 职务') + '</div></div>' +
      '</div>' +
      '<div class="rel-profile-sec"><div class="rel-profile-label">其他信息</div>' +
      '<div class="rel-profile-info">' + (p.info.length ? esc(p.info.join('\n')) : '暂无其他信息') + '</div></div>' +
      '<div class="rel-profile-sec"><div class="rel-profile-label">关系</div>' +
      '<div class="rel-profile-links">' + (linkHtml || '<div class="rel-profile-link">暂无关系</div>') + '</div></div>' +
      '</div>';
    m.style.display = 'flex';
  }

  function closeCard() {
    var m = document.getElementById('relCardModal');
    if (m) m.style.display = 'none';
    relCardId = '';
  }

  function filterOptions(listEl, q) {
    var opts = listEl.querySelectorAll('.rel-opt');
    var shown = 0;
    for (var i = 0; i < opts.length; i++) {
      var nm = (opts[i].getAttribute('data-name') || '').toLowerCase();
      var ok = !q || nm.indexOf(q) >= 0;
      opts[i].style.display = ok ? '' : 'none';
      if (ok) shown++;
    }
    var em = listEl.querySelector('[data-empty]');
    if (em) em.style.display = (opts.length && !shown) ? '' : 'none';
  }

  function bindList() {
    var box = document.getElementById('relList');
    if (!box || box.getAttribute('data-bound')) return;
    box.setAttribute('data-bound', '1');
    box.addEventListener('click', function (e) {
      var card = e.target.closest ? e.target.closest('.rel-card') : null;
      if (!card) return;
      var id = card.getAttribute('data-id');
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'toggle') { selectCard(id); return; }
      if (!act) { deselectCard(); return; }
      if (act === 'edit') { openInfo(id); return; }
      if (act === 'del') {
        if (card.classList.contains('confirm')) { removePerson(id); return; }
        card.classList.add('confirm');
        btn.textContent = '确认删除';
        btn.classList.add('rel-danger-on');
        setTimeout(function () {
          if (!card.parentNode) return;
          card.classList.remove('confirm');
          btn.textContent = '删除';
          btn.classList.remove('rel-danger-on');
        }, 3000);
        return;
      }
      if (act === 'chip') {
        var lid = btn.getAttribute('data-link');
        relFormNew = false;
        if (relEditingLink === lid && relEditingCard === id) {
          relEditingLink = '';
          relEditingCard = '';
        } else {
          relEditingLink = lid;
          relEditingCard = id;
        }
        renderList();
        return;
      }
      if (act === 'new-link') {
        relFormNew = true;
        relEditingLink = '';
        relEditingCard = '';
        renderList();
        var ci = box.querySelector('.rel-card[data-id="' + id + '"] .rel-sel');
        if (ci) {
          ci.focus();
          var cl0 = box.querySelector('.rel-card[data-id="' + id + '"] .rel-combo-list');
          if (cl0) { cl0.classList.remove('hidden'); filterOptions(cl0, ''); }
        }
        return;
      }
      if (act === 'dir') {
        var sibs = card.querySelectorAll('[data-act="dir"]');
        for (var i = 0; i < sibs.length; i++) sibs[i].classList.toggle('active', sibs[i] === btn);
        return;
      }
      if (act === 'combo') {
        var cl = card.querySelector('.rel-combo-list');
        if (cl) {
          cl.classList.toggle('hidden');
          if (!cl.classList.contains('hidden')) {
            var inp = card.querySelector('.rel-sel');
            if (inp) { inp.focus(); inp.select(); }
          }
        }
        return;
      }
      if (act === 'opt') {
        var oi = card.querySelector('.rel-sel');
        if (oi) {
          oi.value = btn.getAttribute('data-name') || '';
          oi.setAttribute('data-pid', btn.getAttribute('data-pid') || '');
        }
        var ol = card.querySelector('.rel-combo-list');
        if (ol) ol.classList.add('hidden');
        var ri = card.querySelector('.rel-rel');
        if (ri) ri.focus();
        return;
      }
      if (act === 'save-link') {
        var sel = card.querySelector('.rel-sel');
        var noteEl = card.querySelector('.rel-note');
        var relInput = card.querySelector('.rel-rel');
        var dirBtn = card.querySelector('.rel-dir-btn.active');
        var otherId = sel ? (sel.getAttribute('data-pid') || '') : '';
        if (!otherId && sel) {
          var typed = sel.value.trim();
          for (var pi = 0; pi < relData.people.length; pi++) {
            var pp = relData.people[pi];
            if (pp.id !== id && pp.name === typed) { otherId = pp.id; break; }
          }
        }
        var relText = relInput ? relInput.value : '';
        var noteText = noteEl ? noteEl.value : '';
        var dir = dirBtn ? dirBtn.getAttribute('data-dir') : 'to';
        if (!otherId) { toast('请选择关联人员'); return; }
        var isNew = relFormNew;
        var lid = relEditingLink;
        relFormNew = false;
        relEditingLink = '';
        relEditingCard = '';
        if (isNew) addLink(id, otherId, relText, dir, noteText);
        else updateLink(lid, id, otherId, relText, dir, noteText);
        return;
      }
    });
    box.addEventListener('mouseover', function (e) {
      var chip = e.target.closest ? e.target.closest('.rel-chip') : null;
      if (!chip) return;
      if (chip === box.__lastChip) return;
      box.__lastChip = chip;
      showTip(chip.getAttribute('data-note') || '', e, chip.getAttribute('data-full') || '');
    });
    box.addEventListener('mousemove', function (e) {
      var chip = e.target.closest ? e.target.closest('.rel-chip') : null;
      if (!chip) { box.__lastChip = null; hideTip(); return; }
      positionTip(e);
    });
    box.addEventListener('mouseout', function (e) {
      var chip = e.target.closest ? e.target.closest('.rel-chip') : null;
      if (!chip) return;
      var to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('.rel-chip') : null;
      if (to === chip) return;
      box.__lastChip = null;
      hideTip();
    });
    box.addEventListener('focusin', function (e) {
      var el = e.target;
      if (!el || !el.classList || !el.classList.contains('rel-sel')) return;
      var card = el.closest('.rel-card');
      if (!card) return;
      var listEl = card.querySelector('.rel-combo-list');
      if (!listEl) return;
      listEl.classList.remove('hidden');
      filterOptions(listEl, '');
    });
    box.addEventListener('input', function (e) {
      var el = e.target;
      if (!el || !el.classList || !el.classList.contains('rel-sel')) return;
      el.setAttribute('data-pid', '');
      var card = el.closest('.rel-card');
      if (!card) return;
      var listEl = card.querySelector('.rel-combo-list');
      if (!listEl) return;
      listEl.classList.remove('hidden');
      filterOptions(listEl, el.value.trim().toLowerCase());
    });
    box.addEventListener('keydown', function (e) {
      if (!e.target || !e.target.classList) return;
      if (e.target.classList.contains('rel-sel')) {
        if (e.key === 'Enter' || e.key === 'Tab') {
          var c0 = e.target.closest('.rel-card');
          var l0 = c0 ? c0.querySelector('.rel-combo-list') : null;
          var vis = l0 ? Array.prototype.filter.call(l0.querySelectorAll('.rel-opt'), function (b) { return b.style.display !== 'none'; }) : [];
          if (vis.length === 1) {
            e.target.value = vis[0].getAttribute('data-name') || '';
            e.target.setAttribute('data-pid', vis[0].getAttribute('data-pid') || '');
            if (l0) l0.classList.add('hidden');
            if (e.key === 'Enter') e.preventDefault();
          } else if (e.key === 'Enter' && l0) {
            l0.classList.remove('hidden');
            e.preventDefault();
          }
        } else if (e.key === 'Escape') {
          var c1 = e.target.closest('.rel-card');
          var l1 = c1 ? c1.querySelector('.rel-combo-list') : null;
          if (l1) l1.classList.add('hidden');
        }
        return;
      }
      if (e.key !== 'Enter' || !e.target.classList.contains('rel-rel')) return;
      e.preventDefault();
      var card = e.target.closest('.rel-card');
      if (!card) return;
      var btn = card.querySelector('[data-act="save-link"]');
      if (btn) btn.click();
    });
    var filt = document.getElementById('relColorFilter');
    if (filt && !filt.getAttribute('data-bound')) {
      filt.setAttribute('data-bound', '1');
      // 左键：单选筛选；多选模式下左键切换单个色系。双击任意圆按钮进出多选模式。
      // 用 e.detail 区分：双击的第二次 click detail=2，跳过单击处理，避免状态被改乱。
      filt.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.rel-color-btn') : null;
        if (!b) return;
        if (e.detail > 1) return;
        applyColorClick(b.getAttribute('data-color'));
      });
      filt.addEventListener('dblclick', function (e) {
        var b = e.target.closest ? e.target.closest('.rel-color-btn') : null;
        if (!b) return;
        e.preventDefault();
        setMultiPick(!relMultiPick);
      });
    }
  }

  function applyColorClick(k) {
    if (!k) return;
    if (relMultiPick) {
      relPickColors[k] = !relPickColors[k];
    } else {
      relColorFilter = relColorFilter === k ? '' : k;
      if (relSelId) {
        var sp = personById(relSelId);
        if (relColorFilter && (!sp || colorKeyOf(sp) !== relColorFilter)) {
          relSelId = '';
          relEditingLink = '';
          relEditingCard = '';
        }
      }
    }
    renderList();
    applyGraphFilter();
    applyPickMarks();
  }

  function bindModals() {
    relTipHoverGuard();
    if (!document.documentElement.getAttribute('data-rel-out')) {
      document.documentElement.setAttribute('data-rel-out', '1');
      document.addEventListener('mousedown', function (e) {
        var inCombo = e.target && e.target.closest ? e.target.closest('.rel-combo') : null;
        if (inCombo) return;
        var lists = document.querySelectorAll('#relList .rel-combo-list');
        for (var i = 0; i < lists.length; i++) lists[i].classList.add('hidden');
      });
    }
    var sm = document.getElementById('relScriptModal');
    if (sm && !sm.getAttribute('data-bound')) {
      sm.setAttribute('data-bound', '1');
      sm.addEventListener('mousedown', function (e) { if (e.target === sm) recRelScriptModalClose(); });
    }
    ['relInfoModal', 'relCardModal', 'relLinkModal'].forEach(function (mid) {
      var m = document.getElementById(mid);
      if (!m || m.getAttribute('data-bound')) return;
      m.setAttribute('data-bound', '1');
      m.addEventListener('mousedown', function (e) {
        if (e.target !== m) return;
        if (mid === 'relInfoModal') closeInfo();
        else if (mid === 'relLinkModal') closeLinkModal(false);
        else closeCard();
      });
    });
    // 人员编辑弹窗里的关系标签：点击打开关系弹窗
    var infoLinks = document.getElementById('relInfoLinks');
    if (infoLinks && !infoLinks.getAttribute('data-bound')) {
      infoLinks.setAttribute('data-bound', '1');
      infoLinks.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.rel-chip') : null;
        if (!b) return;
        var lid = b.getAttribute('data-link');
        var l = linkById(lid);
        if (!l) return;
        openLinkModal(l.from, l.to, l.id);
      });
    }
    // 关系弹窗内的列表（编辑 / 删除）
    var lkList = document.getElementById('relLkList');
    if (lkList && !lkList.getAttribute('data-bound')) {
      lkList.setAttribute('data-bound', '1');
      lkList.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!btn) return;
        var lid = btn.getAttribute('data-link');
        var act = btn.getAttribute('data-act');
        if (act === 'lk-del') { removeLinkModal(lid); return; }
        if (act === 'lk-edit') {
          var l = linkById(lid);
          if (!l) return;
          var a = relLinkPair ? relLinkPair.a : l.from;
          var b = personById(a === l.from ? l.to : l.from);
          if (b) openLinkModal(a, b.id, l.id);
        }
      });
    }
    // 关系输入框实时提示「不确定词 → 虚线」
    var lkInput = document.getElementById('relLkRel');
    if (lkInput && !lkInput.getAttribute('data-bound')) {
      lkInput.setAttribute('data-bound', '1');
      lkInput.addEventListener('input', function () { recRelLinkDir(currentLinkDir()); });
      lkInput.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        saveLinkModal();
      });
    }
    var batchText = document.getElementById('relBatchText');
    if (batchText && !batchText.getAttribute('data-bound')) {
      batchText.setAttribute('data-bound', '1');
      batchText.addEventListener('input', relBatchPreview);
      batchText.addEventListener('paste', function () { setTimeout(relBatchPreview, 0); });
    }
    var colors = document.getElementById('relInfoColors');
    if (colors && !colors.getAttribute('data-bound')) {
      colors.setAttribute('data-bound', '1');
      colors.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.rel-swatch') : null;
        if (!b) return;
        relDraftColor = b.getAttribute('data-color');
        renderColors();
      });
    }
    var fileInput = document.getElementById('relPhotoInput');
    if (fileInput && !fileInput.getAttribute('data-bound')) {
      fileInput.setAttribute('data-bound', '1');
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (f) {
          readPhoto(f, function (url) {
            if (url) { relDraftPhoto = url; renderPhoto(); }
            else toast('无法读取该图片');
          });
        }
        fileInput.value = '';
      });
    }
    var csvInput = document.getElementById('relCsvInput');
    if (csvInput && !csvInput.getAttribute('data-bound')) {
      csvInput.setAttribute('data-bound', '1');
      csvInput.addEventListener('change', function () { relReadFile(csvInput, relImportCsvText); });
    }
    var jsInput = document.getElementById('relJsInput');
    if (jsInput && !jsInput.getAttribute('data-bound')) {
      jsInput.setAttribute('data-bound', '1');
      jsInput.addEventListener('change', function () { relReadFile(jsInput, relImportJsText); });
    }
    if (!document.documentElement.getAttribute('data-rel-menu-out')) {
      document.documentElement.setAttribute('data-rel-menu-out', '1');
      document.addEventListener('click', function (e) {
        var wrap = e.target && e.target.closest ? e.target.closest('.rel-menu-wrap') : null;
        if (!wrap) recRelHideMenu();
        var sm = e.target && e.target.closest ? e.target.closest('.rel-step-menu') : null;
        if (!sm) { hideStepMenu(); hideActMenu(); }
        var keep = e.target && e.target.closest ? e.target.closest('.rel-step-row, .rel-step-menu, #relGraph') : null;
        if (!keep && relStepAdd.mode) cancelStepAdd();
      });
    }
    var photoBox = document.getElementById('relPhotoBox');
    if (photoBox && !photoBox.getAttribute('data-bound')) {      photoBox.setAttribute('data-bound', '1');
      photoBox.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        photoBox.classList.add('dragover');
      });
      photoBox.addEventListener('dragleave', function () { photoBox.classList.remove('dragover'); });
      photoBox.addEventListener('drop', dropPhoto);
    }
    if (!document.documentElement.getAttribute('data-rel-photo-paste')) {
      document.documentElement.setAttribute('data-rel-photo-paste', '1');
      document.addEventListener('paste', pastePhoto);
    }
    if (!document.documentElement.getAttribute('data-rel-keys')) {
      document.documentElement.setAttribute('data-rel-keys', '1');
      document.addEventListener('keydown', relDemoKeyNav);
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var a = document.getElementById('relInfoModal');
      var b = document.getElementById('relCardModal');
      var c = document.getElementById('relLinkModal');
      var d = document.getElementById('relNoteModal');
      if (d && d.style.display !== 'none') recRelNoteClose();
      else if (c && c.style.display !== 'none') closeLinkModal(false);
      else if (a && a.style.display !== 'none') closeInfo();
      else if (b && b.style.display !== 'none') closeCard();
    });
  }

  /* ================= 问题分析（第 41 轮） ================= */
  var relIssueOpen = false;      // 左栏覆盖层是否展开
  var relIssueEditId = '';       // 正在编辑的问题 id（空 = 列表模式）
  var relIssueSelId = '';        // 列表中选中的问题（用于概述框）
  var relIssueStepOpen = '';     // 当前展开动效参数的步骤 id（空 = 全部收起）
  var relIssueGrpOpen = {};      // 合并步骤组是否展开（组成员默认收起）
  var relStepSel = [];           // Ctrl 多选的步骤 id（用 id 而非下标，合并/展开后不会错位）
  var relIssueSecOpen = { desc: false, people: false, steps: false };  // 三个分区是否展开
  var relIssueStepMode = 'steps';   // 关联关系分区：steps=列表 / script=脚本
  // frame = 已开始的步骤数（当前步 = frame-1）；sub = 当前步内已出现的子步下标
  var relIssueDemo = { on: false, id: '', frame: 0, timer: 0, sub: -1, painted: {} };
  // 演示节奏：单段动画 0.4 秒；每个「之后」都在上一并列组动画结束后再等 0.6 秒
  var REL_FX_DUR = 0.4;
  var REL_FX_GAP = 0.6;
  var relIssueCardHidden = false;   // 概述框被手动关掉（仅隐藏浮框，演示继续）

  function issueList() { return Array.isArray(relData.issues) ? relData.issues : []; }
  function issueById(id) {
    var a = issueList();
    for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }
  function issueNewId() { return newId('q'); }

  function issueNormFx(type, fx) {
    var f = fx && typeof fx === 'object' ? fx : {};
    if (type === 'link') {
      return {
        color: typeof f.color === 'string' && f.color ? f.color : '#ffd97a',
        dash: f.dash === 'solid' ? 'solid' : 'dash',
        width: typeof f.width === 'number' ? Math.min(12, Math.max(0.4, f.width)) : 1.5,
        dir: f.dir === 'reverse' ? 'reverse' : 'auto',
        arrow: f.arrow === 0 || f.arrow === '0' ? 0 : 1,
        shape: 'line',
        bend: 0
      };
    }
    return {
      scale: typeof f.scale === 'number' ? Math.min(2, Math.max(0.4, f.scale)) : 1.15,
      // 透明度：100 = 不透明（默认），0 = 全透明
      opacity: typeof f.opacity === 'number' ? Math.min(1, Math.max(0, f.opacity)) : 1,
      glow: typeof f.glow === 'number' ? Math.min(100, Math.max(0, f.glow)) : 70,
      breath: f.breath ? 1 : 0,
      pcolor: typeof f.pcolor === 'string' ? f.pcolor : ''
    };
  }
  function issueNormStep(s) {
    if (!s || (s.type !== 'person' && s.type !== 'link') || !s.ref) return null;
    return {
      id: String(s.id || newId('s')),
      type: s.type,
      ref: String(s.ref),
      timing: s.timing === 'with' ? 'with' : (s.timing === 'before' ? 'before' : 'after'),
      dur: normDur(s.dur),
      note: String(s.note == null ? '' : s.note),
      noteOn: s.noteOn ? 1 : 0,
      mgrp: String(s.mgrp == null ? '' : s.mgrp),
      noff: (s.noff && typeof s.noff === 'object')
        ? { x: Number(s.noff.x) || 0, y: Number(s.noff.y) || 0 } : null,
      fx: issueNormFx(s.type, s.fx)
    };
  }
  function normDur(v) {
    var t = String(v == null ? '' : v);
    if (t === 'last') return 'last';
    if (/^act[0-9]+$/.test(t)) return t;
    return 'self';
  }
  function issueNorm(q) {
    if (!q || typeof q !== 'object') return null;
    var steps = (Array.isArray(q.steps) ? q.steps : []).map(issueNormStep).filter(Boolean);
    var ppl = (Array.isArray(q.people) ? q.people : []).map(String);
    steps.forEach(function (s) {
      if (s.type === 'person' && ppl.indexOf(s.ref) < 0) ppl.push(s.ref);
    });
    return {
      id: String(q.id || issueNewId()),
      title: String(q.title == null ? '' : q.title) || '未命名问题',
      desc: String(q.desc == null ? '' : q.desc),
      people: ppl,
      steps: steps
    };
  }

  function issuePeople(iss) { return iss && Array.isArray(iss.people) ? iss.people : []; }
  function issueLinkIds(iss) {
    if (!iss) return [];
    var hit = {};
    var explicit = 0;
    (iss.steps || []).forEach(function (s) {
      if (s.type === 'link' && linkById(s.ref)) { hit[s.ref] = true; explicit++; }
    });
    if (!explicit) {
      var set = {};
      issuePeople(iss).forEach(function (id) { set[id] = true; });
      relData.links.forEach(function (l) { if (set[l.from] && set[l.to]) hit[l.id] = true; });
    }
    return Object.keys(hit);
  }

  function renderIssuePanel() {
    syncIssuePanelHost();
    var panel = document.getElementById('relIssuePanel');
    var body = document.getElementById('relIssueBody');
    if (!panel || !body) return;
    panel.classList.toggle('show', relIssueOpen);
    if (!relIssueOpen) return;
    body.innerHTML = relIssueEditId ? issueEditHtml() : issueListHtml();
  }

  function issueListHtml() {
    var list = issueList();
    if (!list.length) {
      return '<div class="rel-issue-empty">还没有问题<br>点右上角「＋新增」建立第一个问题</div>';
    }
    var html = '';
    list.forEach(function (q, i) {
      var act = q.id === relIssueSelId ? ' active' : '';
      html += '<div class="rel-issue-row' + act + '" draggable="true" data-id="' + esc(q.id) + '"' +
        ' data-idx="' + i + '" onclick="recRelIssueSelect(\'' + esc(q.id) + '\')"' +
        ' ondblclick="recRelIssueEdit(\'' + esc(q.id) + '\')"' +
        ' ondragstart="recRelIssueDragStart(event,this)" ondragover="recRelIssueDragOver(event,this)"' +
        ' ondragend="recRelIssueDragEnd(event,this)" ondrop="recRelIssueDrop(event,this)">' +
        '<span class="rel-issue-idx">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' +
        '<span class="rel-issue-name">' + esc(q.title) + '</span>' +
        '<span class="rel-issue-sub">' + issuePeople(q).length + ' 人 / ' + (q.steps || []).length + ' 步</span>' +
        '<button class="rel-issue-mini" onclick="event.stopPropagation();recRelIssueDemoStart(\'' + esc(q.id) + '\')" title="在拓扑图演示这个问题">演示</button>' +
        '<button class="rel-issue-mini danger" onclick="event.stopPropagation();recRelIssueRemove(\'' + esc(q.id) + '\')" title="删除该问题">×</button>' +
        '</div>';
    });
    html += '<div class="rel-issue-hint rel-issue-hint-foot">单击选中并演示 · 双击进入编辑 · 拖动可排序</div>';
    return html;
  }

  // 步骤纯文本（用于 title 提示，不用在可见行内）
  function issueStepText(s) {
    if (s.type === 'person') {
      var p = personById(s.ref);
      return '人员：' + (p ? (p.name || '未命名人员') : '（已删除）');
    }
    var l = linkById(s.ref);
    if (!l) return '关系：（已删除）';
    var a = personById(l.from), b = personById(l.to);
    var ar = l.dir === 'both' ? ' ↔ ' : (l.dir === 'from' ? ' ← ' : ' → ');
    return '关系：' + (a ? a.name : '?') + ar + (b ? b.name : '?') + '（' + (l.rel || '关联') + '）';
  }
  // 步骤显示名：人员只留姓名；关系只留「甲 ⇄ 乙」，不带备注
  function issueStepName(s) {
    if (s.type === 'person') {
      var p = personById(s.ref);
      return p ? (p.name || '未命名人员') : '（已删除）';
    }
    var l = linkById(s.ref);
    if (!l) return '（已删除）';
    var a = personById(l.from), b = personById(l.to);
    return (a ? a.name : '?') + ' ⇄ ' + (b ? b.name : '?');
  }
  var ICON_PERSON = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">' +
    '<circle cx="8" cy="5" r="2.7" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M2.9 13.6c0-2.6 2.3-4.4 5.1-4.4s5.1 1.8 5.1 4.4" fill="none"' +
    ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  var ICON_LINK = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">' +
    '<path d="M6.6 9.4a2.9 2.9 0 0 0 4.1 0l2.1-2.1a2.9 2.9 0 0 0-4.1-4.1l-1 1" ' +
    'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M9.4 6.6a2.9 2.9 0 0 0-4.1 0L3.2 8.7a2.9 2.9 0 0 0 4.1 4.1l1-1" ' +
    'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  // 合并块：连续且 mgrp 相同的步骤算一组
  function stepBlocks(q) {
    var blocks = [], cur = null;
    (q.steps || []).forEach(function (s, i) {
      var g = String(s.mgrp || '');
      if (g && cur && cur.gid === g) cur.idx.push(i);
      else if (g) { cur = { gid: g, idx: [i] }; blocks.push(cur); }
      else { cur = null; blocks.push({ gid: '', idx: [i] }); }
    });
    return blocks;
  }
  function issueEditHtml() {
    var q = issueById(relIssueEditId);
    if (!q) { relIssueEditId = ''; return issueListHtml(); }
    // 动作编号：合并块共用首步编号；同时（with）的步骤与上一步同号 = 同一动作
    var stepNo = [], grpHead = [], grpMem = [], grpId = [];
    var lastNo = 0;
    stepBlocks(q).forEach(function (b) {
      var no;
      if (b.gid) no = ++lastNo;
      else {
        var s0 = q.steps[b.idx[0]];
        no = (s0.timing === 'with' && lastNo > 0) ? lastNo : ++lastNo;
      }
      b.no = no;
      b.idx.forEach(function (i, k) {
        stepNo[i] = no;
        grpHead[i] = (b.gid && k === 0) ? b.gid : '';
        grpMem[i] = !!b.gid && k > 0;
        grpId[i] = b.gid || '';
      });
    });
    var timeSeg = function (i, s) {
      var withIt = s.timing === 'with';
      // 单按钮切换：同时 ↔ 之后
      var seg = '<button type="button" class="rel-tm-btn' + (withIt ? ' with' : '') + '"' +
        ' title="点击切换：同时 / 之后"' +
        ' onclick="event.stopPropagation();recRelIssueTiming(' + i + ',\'' + (withIt ? 'after' : 'with') + '\')">' +
        (withIt ? '同时' : '之后') + '</button>';
      var cur = s.dur || 'self';
      var mine = stepNo[i] || 1;
      var opts = '<option value="self"' + (cur === 'self' ? ' selected' : '') + '>本动作</option>';
      for (var an = 1; an <= lastNo; an++) {
        if (an === mine) continue;
        opts += '<option value="act' + an + '"' + (cur === 'act' + an ? ' selected' : '') + '>动作' + an + '</option>';
      }
      opts += '<option value="last"' + (cur === 'last' ? ' selected' : '') + '>最后</option>';
      return seg + '<div class="rel-dur"><span class="rel-dur-lab">持续到</span>' +
        '<select class="rel-dur-sel" onclick="event.stopPropagation()"' +
        ' onchange="event.stopPropagation();recRelIssueDur(' + i + ',this.value)">' + opts + '</select></div>';
    };
    var slider = function (i, key, label, min, max, step, val, suffix) {
      return '<label class="rel-fx-item"><span>' + label + '</span>' +
        '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"' +
        ' oninput="recRelIssueFx(' + i + ',\'' + key + '\',this.value,this)"><output>' + val + (suffix || '') + '</output></label>';
    };
    // 数字步进：− 数值 +（可点按钮或直接输入）
    var numberCtl = function (i, key, label, val, step, suffix) {
      return '<div class="rel-fx-item"><span>' + label + '</span>' +
        '<div class="rel-fx-stepper">' +
        '<button type="button" class="rel-fx-stepbtn" title="减少"' +
        ' onclick="event.stopPropagation();recRelIssueFxStep(' + i + ',\'' + key + '\',-' + step + ')">−</button>' +
        '<input type="text" class="rel-fx-num" data-num="' + key + '" value="' + val + '"' +
        ' oninput="recRelIssueFxDraft(this)"' +
        ' ondblclick="recRelIssueFxNumRestore(this,event,' + i + ',\'' + key + '\')"' +
        ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.blur();}"' +
        ' onblur="recRelIssueFx(' + i + ',\'' + key + '\',this.value,this)">' +
        '<button type="button" class="rel-fx-stepbtn" title="增加"' +
        ' onclick="event.stopPropagation();recRelIssueFxStep(' + i + ',\'' + key + '\',' + step + ')">+</button>' +
        '</div>' + (suffix ? '<span class="rel-fx-suffix">' + suffix + '</span>' : '') + '</div>';
    };
    var fxHtml = function (i, s) {
      if (s.type === 'person') {
        var pc = s.fx.pcolor || (personById(s.ref) ? colorOf(personById(s.ref)) : '#7fd4ff');
        return '<div class="rel-fx-grid"><div class="rel-fx-row">' +
          numberCtl(i, 'scale', '缩放', Math.round(s.fx.scale * 100), 5, '%') +
          numberCtl(i, 'opacity', '透明', Math.round(s.fx.opacity * 100), 5, '') +
          '<div class="rel-fx-item">' +
          '<button type="button" class="rel-issue-mini rel-fx-breath' + (s.fx.breath ? ' on' : '') + '"' +
          ' onclick="event.stopPropagation();recRelIssueBreath(' + i + ')" title="开启/关闭该人员的呼吸外发光">呼吸</button>' +
          '<input type="color" class="rel-fx-color" value="' + esc(pc) + '" title="呼吸光颜色"' +
          ' oninput="event.stopPropagation();recRelIssuePColor(' + i + ',this.value)">' +
          '</div>' +
          '</div></div>';
      }
      var cols = ['#ffffff', '#7fe0ff', '#a5f3a0', '#ffd97a', '#ff8a80', '#e0a6ff'];
      var arrowOn = s.fx.arrow !== 0;
      return '<div class="rel-fx-grid">' +
        '<div class="rel-fx-row">' +
        '<div class="rel-fx-item"><span>颜色</span><span class="rel-fx-swatches">' +
        cols.map(function (c) {
          return '<button type="button" class="rel-fx-swatch' + (s.fx.color.toLowerCase() === c ? ' on' : '') + '"' +
            ' data-fc="' + c + '" style="--fc:' + c + '" title="' + c + '"' +
            ' onclick="event.stopPropagation();recRelIssueFx(' + i + ',\'color\',\'' + c + '\')"></button>';
        }).join('') +
        '<input type="color" class="rel-fx-pick' + (cols.indexOf(s.fx.color.toLowerCase()) < 0 ? ' on' : '') + '"' +
        ' value="' + esc(s.fx.color) + '" title="自选颜色"' +
        ' oninput="event.stopPropagation();recRelIssueColor(' + i + ',this.value,this)">' +
        '</span></div>' +
        numberCtl(i, 'width', '粗细', s.fx.width, 0.2, '') +
        '</div>' +
        '<div class="rel-fx-row">' +
        '<div class="rel-fx-seg">' +
        '<button type="button" class="' + (arrowOn ? '' : 'on') + '" title="只画直线，不画箭头"' +
        ' onclick="event.stopPropagation();recRelIssueFx(' + i + ',\'arrow\',0)">直线</button>' +
        '<button type="button" class="' + (arrowOn ? 'on' : '') + '" title="叠加流动箭头"' +
        ' onclick="event.stopPropagation();recRelIssueFx(' + i + ',\'arrow\',1)">箭头</button>' +
        '</div>' +
        (arrowOn ? '<div class="rel-fx-seg">' +
          '<button type="button" class="' + (s.fx.dir === 'reverse' ? '' : 'on') + '" title="箭头顺向流动"' +
          ' onclick="event.stopPropagation();recRelIssueFx(' + i + ',\'dir\',\'auto\')">顺向</button>' +
          '<button type="button" class="' + (s.fx.dir === 'reverse' ? 'on' : '') + '" title="箭头反向流动"' +
          ' onclick="event.stopPropagation();recRelIssueFx(' + i + ',\'dir\',\'reverse\')">逆向</button>' +
          '</div>' : '') +
        '</div>' +
        '</div>';
    };
    var stepsHtml = (q.steps || []).map(function (s, i) {
      var head = grpHead[i];                 // 合并块首步：编号按钮可展开/收起
      var mem = grpMem[i];                   // 合并块成员：无编号、缩进对齐
      // 展开态按「所属组 id」取：成员行的 head 恒为空，按 head 判定会在重渲染时把成员折回去
      var gOpen = grpId[i] ? !!relIssueGrpOpen[grpId[i]] : (head ? !!relIssueGrpOpen[head] : false);
      var open = (relIssueStepOpen === s.id) ? ' open' : '';
      var isP = s.type === 'person';
      var nc = isP ? (personById(s.ref) ? colorOf(personById(s.ref)) : '#6fc4ff') : '#5fe0a0';
      // 同一动作（同时发生）左边框同色；相邻动作交替配色
      var grp = (stepNo[i] - 1) % 2;
      var nCell;
      if (head) {
        nCell = '<button type="button" class="n n-grp' + (gOpen ? ' open' : '') + '"' +
          ' onclick="event.stopPropagation();recRelIssueGrpToggle(\'' + esc(head) + '\')"' +
          ' title="展开/收起同组步骤（共 ' + (gOpen ? '收起' : '展开') + '）">' + stepNo[i] + '</button>';
      } else if (mem) {
        nCell = '<span class="n n-blank"></span>';
      } else {
        nCell = '<span class="n">' + stepNo[i] + '</span>';
      }
      var sel = relStepSel.indexOf(s.id) >= 0 ? ' sel' : '';
      var fold = (mem && !gOpen) ? ' folded' : '';
      // 只有「步骤（动作）」之间才加分割线：编号变了才算新步骤，同组 / 同时的模块之间不加
      var actStart = i > 0 && stepNo[i] !== stepNo[i - 1];
      return '<div class="rel-step-row' + sel + fold + (actStart ? ' act-start' : '') + '" data-idx="' + i + '" data-grp="' + esc(grpId[i]) + '"' +
        ' draggable="true"' +
        ' ondragstart="recRelIssueStepDragStart(event,this)" ondragover="recRelIssueStepDragOver(event,this)"' +
        ' ondragend="recRelIssueStepDragEnd(event,this)" ondrop="recRelIssueStepDrop(event,this)"' +
        ' oncontextmenu="recRelIssueStepMenu(event,' + i + ')">' +
        '<div class="rel-step-col">' +
        '<div class="rel-issue-step grp' + grp + ' ' + (isP ? 'is-person' : 'is-link') + open + (mem ? ' is-mem' : '') + '" data-sid="' + esc(s.id) + '"' +
        ' data-idx="' + i + '" style="--nc:' + esc(nc) + '"' +
        ' onclick="recRelIssueStepClick(event,' + i + ')"' +
        ' title="点击展开/收起该步参数；Ctrl+点击可多选后合并；右键新增人员/关系；按住可上下拖动">' +
        '<div class="rel-step-top">' +
        nCell +
        '<span class="rel-step-ic' + (isP ? '' : ' is-link') + '" title="' + esc(issueStepText(s)) + '">' +
        (isP ? ICON_PERSON : ICON_LINK) + '</span>' +
        '<span class="txt" title="' + esc(issueStepText(s)) + '">' + esc(issueStepName(s)) + '</span>' +
        '<button class="rel-step-note' + (s.noteOn ? ' on' : '') + '" type="button"' +
        ' onclick="event.stopPropagation();recRelIssueNoteToggle(' + i + ')"' +
        ' ondblclick="event.stopPropagation();recRelIssueNoteEdit(' + i + ')"' +
        ' onmouseenter="recRelIssueNoteHover(event,' + i + ')" onmouseleave="hideTip()"' +
        ' title="批注：单击显示/隐藏 · 双击编辑 · 悬停查看">…</button>' +
        '<span class="rel-step-time">' + timeSeg(i, s) + '</span>' +
        '</div>' +
        '<button class="rel-step-del" onclick="event.stopPropagation();recRelIssueStepDel(' + i + ')"' +
        ' title="删除该步">×</button>' +
        '</div>' +
        '<div class="rel-issue-fx ' + (isP ? 'is-person' : 'is-link') + (open ? ' show' : '') + '" data-fx="' + esc(s.id) + '">' + fxHtml(i, s) + '</div>' +
        '</div></div>';
    }).join('');
    var picked = issuePeople(q);
    var ppl = relData.people.slice().sort(function (a, b) {
      var ia = COLOR_KEYS.indexOf(colorKeyOf(a)), ib = COLOR_KEYS.indexOf(colorKeyOf(b));
      if (ia !== ib) return ia - ib;
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
    }).map(function (p) {
      var on = picked.indexOf(p.id) >= 0;
      return '<label class="rel-issue-chk' + (on ? ' on' : '') + '" style="--rc:' + colorOf(p) + '">' +
        '<input type="checkbox"' + (on ? ' checked' : '') + ' onchange="recRelIssuePerson(\'' + esc(p.id) + '\',this.checked)">' +
        '<span class="dot"></span><span class="nm">' + esc(p.name || '未命名人员') + '</span></label>';
    }).join('');
    var sec = function (key, title, inner, extra, right) {
      var open = relIssueSecOpen[key] !== false;
      return '<div class="rel-isec' + (extra ? ' ' + extra : '') + '">' +
        '<div class="rel-isec-head' + (open ? ' open' : '') + '" onclick="recRelIssueSec(\'' + key + '\')">' +
        '<span class="rel-isec-arrow">' + (open ? '▾' : '▸') + '</span>' +
        '<span class="rel-isec-title">' + title + '</span>' + (right || '') + '</div>' +
        '<div class="rel-isec-body"' + (open ? '' : ' style="display:none"') + '>' + inner + '</div></div>';
    };
    return '<div class="rel-issue-field rel-issue-name-row"><span class="rel-issue-name-lab">主题：</span>' +
      '<input class="rel-issue-input rel-issue-name-input" value="' + esc(q.title) + '"' +
      ' oninput="recRelIssueTitle(this.value)" placeholder="名称" title="问题名称"></div>' +
      sec('desc', '具体情形',
        '<textarea class="rel-issue-desc" rows="6" oninput="recRelIssueDesc(this.value)" placeholder="简述问题事实、关键节点与涉及范围">' + esc(q.desc) + '</textarea>') +
      sec('people', '涉及对象',
        '<div class="rel-issue-checks">' + (ppl || '<span class="rel-issue-hint">还没有人员</span>') + '</div>') +
      sec('steps', '关联关系', (relIssueStepMode === 'script'
        ? issueScriptPaneHtml(q)
        : '<div class="rel-issue-steps" oncontextmenu="recRelStepAddMenu(event)" title="右键新增步骤">' + (stepsHtml || '<div class="rel-issue-hint">还没有步骤：点下方「＋新增步骤」或在步骤上右键，然后到右侧拓扑图右键人员 / 关系添加</div>') + '</div>' +
        '<div class="rel-issue-tools" oncontextmenu="recRelStepAddMenu(event)">' +
        '<button class="rel-issue-mini" onclick="recRelStepAddMenu(event)" title="新增步骤">＋ 新增步骤</button>' +
        '<button class="rel-issue-mini" onclick="recRelIssueDemoStart(\'' + esc(q.id) + '\')">演示</button>' +
        '</div>'), '',
        '<span class="rel-isec-tabs" onclick="event.stopPropagation()">' +
        '<button type="button" class="rel-isec-tab' + (relIssueStepMode !== 'script' ? ' on' : '') + '"' +
        ' onclick="recRelIssueStepMode(\'steps\')" title="列表模式：逐条编辑步骤与参数">步骤</button>' +
        '<button type="button" class="rel-isec-tab' + (relIssueStepMode === 'script' ? ' on' : '') + '"' +
        ' onclick="recRelIssueStepMode(\'script\')" ondblclick="recRelScriptModalOpen()"' +
        ' title="脚本模式：用文本批量编辑参数（双击：放大编辑）">脚本</button>' +
        '</span>');
  }

  function recRelIssueTitle(v) {
    if (demoLockEditing()) return;
    var q = issueById(relIssueEditId);
    if (!q) return;
    q.title = String(v || '');
    save();
  }
  function recRelIssueDesc(v) {
    if (demoLockEditing()) return;
    var q = issueById(relIssueEditId);
    if (!q) return;
    q.desc = String(v || '');
    save();
  }
  function recRelIssuePerson(pid, on) {
    if (demoLockEditing()) return;
    var q = issueById(relIssueEditId);
    if (!q) return;
    var i = q.people.indexOf(pid);
    if (on && i < 0) q.people.push(pid);
    if (!on && i >= 0) q.people.splice(i, 1);
    save();
    // 右侧拓扑实时点亮 / 取消点亮
    applyIssueState();
  }
  // 关联关系：步骤列表 ⇄ 脚本
  function recRelIssueStepMode(mode) {
    mode = (mode === 'script') ? 'script' : 'steps';
    if (mode === relIssueStepMode) return;
    if (demoLockEditing()) return;
    if (mode === 'script') relIssueScriptSync(q_of());
    relIssueStepMode = mode;
    renderIssuePanel();
  }
  function q_of() { return issueById(relIssueEditId); }
  /* ---------- 脚本模式（第 57 轮）：步骤 ⇄ 文本 ---------- */
  function scriptKey(name) { return '\u300c' + name + '\u300d'; }
  function scriptHex2rgb(h) {
    var t = String(h || '').replace('#', '');
    if (t.length === 3) t = t[0] + t[0] + t[1] + t[1] + t[2] + t[2];
    if (!/^[0-9a-fA-F]{6}$/.test(t)) t = '7fd4ff';
    return { r: parseInt(t.slice(0, 2), 16), g: parseInt(t.slice(2, 4), 16), b: parseInt(t.slice(4, 6), 16) };
  }
  function scriptRgb2hex(r, g, b) {
    var f = function (n) {
      var v = Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
      return (v < 16 ? '0' : '') + v.toString(16);
    };
    return '#' + f(r) + f(g) + f(b);
  }
  function scriptRgbText(hex) { var c = scriptHex2rgb(hex); return '(' + c.r + ',' + c.g + ',' + c.b + ')'; }
  function scriptStepNo(q) {
    var out = [], last = 0;
    stepBlocks(q).forEach(function (b) {
      var no;
      if (b.gid) no = ++last;
      else {
        var s0 = q.steps[b.idx[0]];
        no = (s0.timing === 'with' && last > 0) ? last : ++last;
      }
      b.idx.forEach(function (i) { out[i] = no; });
    });
    return out;
  }
  function scriptDurText(d) {
    if (d === 'last') return '最后';
    var m = /^act([0-9]+)$/.exec(String(d || ''));
    return m ? ('动作' + m[1]) : '本动作';
  }
  function scriptDurVal(t) {
    var v = String(t || '').trim();
    if (v === '最后') return 'last';
    var m = /^动作\s*([0-9]+)$/.exec(v);
    return m ? ('act' + m[1]) : 'self';
  }
  function scriptNameOf(s) {
    if (s.type === 'person') {
      var p = personById(s.ref);
      return p ? (p.name || '未命名人员') : '（已删除）';
    }
    var l = linkById(s.ref);
    if (!l) return '（已删除）';
    var a = personById(l.from), b = personById(l.to);
    return (a ? a.name : '?') + ' ⇄ ' + (b ? b.name : '?');
  }
  function scriptStepLine(s) {
    var out = [];
    out.push(scriptKey(s.type === 'person' ? '人员' : '关系') + scriptNameOf(s));
    // 第 59 轮：批注内容始终跟在字段名后面（为空则后面什么都不写）
    var note = String(s.note || '').trim();
    out.push(scriptKey(s.noteOn ? '显示批注' : '不显示批注') + (note ? note : ''));
    // 第 59 轮：时点前加字段名「开始播放」
    out.push(scriptKey('开始播放') + (s.timing === 'with' ? '同时' : '之后'));
    out.push(scriptKey('结束时间') + scriptDurText(s.dur));
    if (s.type === 'person') {
      out.push(scriptKey('缩放') + Math.round(s.fx.scale * 100));
      out.push(scriptKey('透明度') + Math.round(s.fx.opacity * 100));
      out.push(scriptKey('呼吸发光') +
        (s.fx.breath ? scriptRgbText(s.fx.pcolor || (personById(s.ref) ? colorOf(personById(s.ref)) : '#7fd4ff')) : '无'));
    } else {
      out.push(scriptKey('连线颜色') + scriptRgbText(s.fx.color));
      out.push(scriptKey('粗细') + s.fx.width);
      out.push(scriptKey('形状') + (s.fx.arrow === 0 ? '直线' : ('箭头-' + (s.fx.dir === 'reverse' ? '逆向' : '顺向'))));
    }
    return out.join('  ');
  }
  // 脚本纯文本：步骤标题「步骤N」（不带冒号），其后空一行再写模块
  function issueStepScript(q) {
    if (!q) return '';
    var nos = scriptStepNo(q);
    var out = [], cur = 0;
    (q.steps || []).forEach(function (s, i) {
      var no = nos[i] || 0;
      if (no !== cur) {
        cur = no;
        if (out.length) out.push('');
        out.push('步骤' + no);
      }
      out.push(scriptStepLine(s));
    });
    return out.join('\n');
  }
  // 高亮层用的逐行模型：{ kind: 'blank'|'step'|'item', no, s, idx }
  function scriptLineModel(q) {
    if (!q) return [];
    var nos = scriptStepNo(q);
    var rows = [], cur = 0, inStep = 0;
    (q.steps || []).forEach(function (s, i) {
      var no = nos[i] || 0;
      if (no !== cur) {
        cur = no;
        inStep = 0;
        if (rows.length) rows.push({ kind: 'blank', s: null });
        rows.push({ kind: 'step', no: no, s: null });
      }
      inStep++;
      rows.push({ kind: 'item', no: no, idx: inStep, s: s });
    });
    return rows;
  }
  // 取「键」到下一个「之间的值
  function scriptVal(rest, key) {
    var k = scriptKey(key);
    var i = rest.indexOf(k);
    if (i < 0) return '';
    var tail = rest.slice(i + k.length);
    var j = tail.indexOf('\u300c');
    return (j >= 0 ? tail.slice(0, j) : tail).trim();
  }
  function scriptPersonByName(nm) {
    var t = String(nm || '').trim();
    if (!t) return null;
    for (var i = 0; i < relData.people.length; i++) {
      if (String(relData.people[i].name || '').trim() === t) return relData.people[i];
    }
    return null;
  }
  function scriptLinkByName(a, b) {
    var pa = scriptPersonByName(a), pb = scriptPersonByName(b);
    if (!pa || !pb) return null;
    for (var i = 0; i < relData.links.length; i++) {
      var l = relData.links[i];
      if ((l.from === pa.id && l.to === pb.id) || (l.from === pb.id && l.to === pa.id)) return l;
    }
    return null;
  }
  function scriptParseItem(line, kind) {
    var rest = line.replace(/^\u300c(人员|关系)\u300d/, '');
    var at = rest.indexOf('\u300c');
    var name = (at >= 0 ? rest.slice(0, at) : rest).trim();
    if (at >= 0) rest = rest.slice(at);
    var it = {
      type: kind === '人员' ? 'person' : 'link', ref: '',
      note: '', noteOn: 0, timing: 'after', dur: 'self', fx: {}
    };
    if (kind === '人员') {
      var p = scriptPersonByName(name);
      if (!p) return null;
      it.ref = p.id;
    } else {
      var names = name.split(/\s*(?:⇄|↔|⇆|→|←|—|、|和)\s*/).filter(Boolean);
      if (names.length < 2) return null;
      var l = scriptLinkByName(names[0], names[1]);
      if (!l) return null;
      it.ref = l.id;
    }
    // 批注：显示/不显示 + 内容（内容到下一个「字段名」为止；为空则 just 字段名）
    var mNote = /\u300c(显示批注|不显示批注)\u300d/.exec(rest);
    if (mNote) {
      it.noteOn = mNote[1] === '显示批注' ? 1 : 0;
      var tail = rest.slice(mNote.index + mNote[0].length);
      var j = tail.indexOf('\u300c');
      var txt = (j >= 0 ? tail.slice(0, j) : tail);
      txt = txt.replace(/(?:^|\s)(?:之后|同时)(?:\s|$).*$/, '').trim();
      if (txt.charAt(0) === '\u300c' && txt.charAt(txt.length - 1) === '\u300d') txt = txt.slice(1, -1);
      it.note = txt;
    }
    // 时点：优先看「开始播放」字段；兼容旧的裸词写法
    var tm = scriptVal(rest, '开始播放');
    if (tm.indexOf('同时') >= 0) it.timing = 'with';
    else if (tm.indexOf('之后') >= 0) it.timing = 'after';
    else {
      var plain = rest.replace(/\u300c[^\u300d]*\u300d/g, ' ');
      if (/(?:^|\s)同时(?:\s|$)/.test(plain)) it.timing = 'with';
    }
    it.dur = scriptDurVal(scriptVal(rest, '结束时间'));
    if (it.type === 'person') {
      var sc = parseFloat(scriptVal(rest, '缩放'));
      var op = parseFloat(scriptVal(rest, '透明度'));
      it.fx.scale = isFinite(sc) ? sc / 100 : 1.15;
      it.fx.opacity = isFinite(op) ? op / 100 : 1;
      var bh = scriptVal(rest, '呼吸发光');
      it.fx.breath = (bh && bh !== '无') ? 1 : 0;
      if (it.fx.breath) {
        var m3 = /\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)/.exec(bh);
        it.fx.pcolor = m3 ? scriptRgb2hex(m3[1], m3[2], m3[3]) : '';
      }
    } else {
      var mc = /\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)/.exec(rest);
      it.fx.color = mc ? scriptRgb2hex(mc[1], mc[2], mc[3]) : '#ffd97a';
      var w = parseFloat(scriptVal(rest, '粗细'));
      it.fx.width = isFinite(w) ? w : 1.5;
      var sh = scriptVal(rest, '形状');
      it.fx.arrow = sh.indexOf('直线') >= 0 ? 0 : 1;
      it.fx.dir = sh.indexOf('逆向') >= 0 ? 'reverse' : 'auto';
    }
    return it;
  }
  function scriptParse(text, q) {
    var lines = String(text == null ? '' : text).split(/\r?\n/);
    var blocks = [], cur = null, bad = [];
    lines.forEach(function (raw, ln) {
      var line = String(raw || '').trim();
      if (!line) return;
      var mStep = /^步骤\s*([0-9]+)\s*[:：]?$/.exec(line);
      if (mStep) {
        var no = Number(mStep[1]) || (blocks.length + 1);
        cur = null;
        for (var i = 0; i < blocks.length; i++) if (blocks[i].no === no) cur = blocks[i];
        if (!cur) { cur = { no: no, items: [] }; blocks.push(cur); }
        return;
      }
      var mType = /^\u300c(人员|关系)\u300d/.exec(line);
      if (!mType) { bad.push(ln + 1); return; }
      if (!cur) { cur = { no: blocks.length + 1, items: [] }; blocks.push(cur); }
      var it = scriptParseItem(line, mType[1]);
      if (!it) { bad.push(ln + 1); return; }
      cur.items.push(it);
    });
    blocks.sort(function (a, b) { return a.no - b.no; });
    return { blocks: blocks, bad: bad };
  }
  // 解析结果写回问题；保留原有 id，合并组按「同一步骤内多个模块」重建
  function issueScriptApply(text) {
    var q = issueById(relIssueEditId);
    if (!q) return { ok: false, msg: '没有正在编辑的问题' };
    var res = scriptParse(text, q);
    if (!res.blocks.length) return { ok: false, msg: '脚本里还没有有效步骤' };
    var old = q.steps || [];
    var next = [], k = 0;
    res.blocks.forEach(function (b) {
      var gid = b.items.length > 1 ? newId('g') : '';
      b.items.forEach(function (it, j) {
        var base = old[k] || null;
        k++;
        next.push({
          id: (base && base.id) ? base.id : newId('s'),
          type: it.type,
          ref: it.ref,
          timing: j === 0 ? 'after' : (it.timing === 'after' ? 'with' : it.timing),
          dur: it.dur,
          note: it.note,
          noteOn: it.noteOn,
          mgrp: gid,
          noff: base ? base.noff : null,
          fx: issueNormFx(it.type, it.fx)
        });
        if (it.type === 'person' && q.people.indexOf(it.ref) < 0) q.people.push(it.ref);
        if (it.type === 'link') {
          var l = linkById(it.ref);
          if (l) {
            if (q.people.indexOf(l.from) < 0) q.people.push(l.from);
            if (q.people.indexOf(l.to) < 0) q.people.push(l.to);
          }
        }
      });
    });
    q.steps = next;
    relIssueStepOpen = '';
    relStepSel = [];
    save();
    renderIssuePanel();
    applyIssueState();
    return {
      ok: res.bad.length === 0,
      msg: res.bad.length ? ('第 ' + res.bad.join('、') + ' 行无法识别（人名或关系不存在）') : ('已应用 ' + next.length + ' 个模块')
    };
  }

  // 高亮：字段名加粗黑体、内容按类型上色（宋体）
  var SCRIPT_FIELD_CLS = { '人员': 's', '关系': 's', '显示批注': 'note', '不显示批注': 'note',
    '开始播放': 's', '结束时间': 's', '形状': 's', '缩放': 'num', '透明度': 'num', '粗细': 'num',
    '呼吸发光': 'col', '连线颜色': 'col' };
  var SCRIPT_BARE_RE = /(之后|同时|箭头-顺向|箭头-逆向|直线|无)/g;
  // 裸词（时点 / 形状）按强调色
  function scriptBareHtml(text) {
    return esc(String(text || '')).replace(SCRIPT_BARE_RE, function (m) {
      return '<span class="s">' + m + '<\/span>';
    });
  }
  // 字段值：先切出裸词（之后/同时/无…），余下按字段类型上色
  function scriptValHtml(text, cls) {
    if (!text) return '';
    var out = '', last = 0, m;
    var re = /(之后|同时|箭头-顺向|箭头-逆向|直线|无)/g;
    while ((m = re.exec(text))) {
      out += scriptValSeg(text.slice(last, m.index), cls);
      out += '<span class="s">' + esc(m[1]) + '<\/span>';
      last = re.lastIndex;
    }
    return out + scriptValSeg(text.slice(last), cls);
  }
  function scriptValSeg(text, cls) {
    if (!text) return '';
    if (cls === 'col') {
      var out = '', last = 0, m;
      var re = /\(\s*[0-9]+\s*,\s*[0-9]+\s*,\s*[0-9]+\s*\)/g;
      while ((m = re.exec(text))) {
        out += esc(text.slice(last, m.index));
        out += '<span class="col">' + esc(m[0]) + '<\/span>';
        last = re.lastIndex;
      }
      return out + esc(text.slice(last));
    }
    if (!cls) return esc(text);
    return '<span class="' + cls + '">' + esc(text) + '<\/span>';
  }
  function scriptLineHtml(line) {
    if (!line) return '';
    var out = '';
    var head = /^(步骤\s*[0-9]+\s*[:：])/.exec(line);
    if (head) { out += '<span class="step">' + esc(head[1]) + '<\/span>'; line = line.slice(head[1].length); }
    var marks = [], m, re = /\u300c([^\u300d]*)\u300d/g, last = 0;
    while ((m = re.exec(line))) marks.push({ s: m.index, e: re.lastIndex, key: m[1] });
    if (!marks.length) return out + scriptBareHtml(line);
    for (var i = 0; i < marks.length; i++) {
      out += scriptBareHtml(line.slice(last, marks[i].s));
      out += '<span class="k">\u300c' + esc(marks[i].key) + '\u300d<\/span>';
      var vEnd = i + 1 < marks.length ? marks[i + 1].s : line.length;
      out += scriptValHtml(line.slice(marks[i].e, vEnd), SCRIPT_FIELD_CLS[marks[i].key] || '');
      last = vEnd;
    }
    return out;
  }
  function issueScriptHighlight(text) {
    return String(text == null ? '' : text).split('\n').map(function (ln) {
      return '<div class="sl">' + scriptLineHtml(ln) + '</div>';
    }).join('');
  }
  // 步骤标题行（步骤N）：绿色黑体居中，不加粗、不带冒号
  function scriptStepHeadHtml(no) {
    return '<div class="sl step-head">步骤' + esc(String(no)) + '</div>';
  }
  // 行首实心圆序号：人员用人物颜色，关系用出发方颜色；序号在步骤内重新计数
  function scriptSeqBallHtml(s, idx) {
    var color = '#6fc4ff';
    if (s.type === 'person') {
      var p = personById(s.ref);
      color = p ? colorOf(p) : '#6fc4ff';
    } else {
      var l = linkById(s.ref);
      var a = l ? personById(l.from) : null;
      color = a ? colorOf(a) : '#5fe0a0';
    }
    var txt = String(idx);
    var wide = txt.length > 1 ? ' wide' : '';
    return '<span class="sn' + wide + '" style="background:' + esc(color) + '">' + esc(txt) + '</span>';
  }
  // 按行模型渲染（编辑弹窗 / 面板内都用这一套，保证所见即所存）
  function issueScriptModelHtml(q) {
    return scriptLineModel(q).map(function (r) {
      if (r.kind === 'blank') return '<div class="sl blank"></div>';
      if (r.kind === 'step') return scriptStepHeadHtml(r.no);
      return '<div class="sl has-sn">' + scriptSeqBallHtml(r.s, r.idx) + scriptLineHtml(scriptStepLine(r.s)) + '</div>';
    }).join('');
  }
  function issueScriptPaneHtml(q) {
    var txt = issueStepScript(q);
    return '<div class="rel-script-wrap">' +
      '<div class="rel-script-hl" id="relScriptHl">' + issueScriptModelHtml(q) + '</div>' +
      '<textarea class="rel-script-area" id="relScriptArea" spellcheck="false"' +
      ' placeholder="步骤1：&#10;\u300c人员\u300d姓名  \u300c显示批注\u300d内容  之后  \u300c结束时间\u300d本动作  \u300c缩放\u300d100 ..."' +
      ' oninput="recRelIssueScriptInput(this)"' +
      ' onscroll="recRelIssueScriptScroll(this)"' +
      ' onblur="recRelIssueScriptBlur(this)">' + esc(txt) + '</textarea>' +
      '</div>' +
      '<div class="rel-script-tools">' +
      '<button class="rel-issue-mini" onclick="recRelIssueScriptApply()" title="把脚本内容写回步骤列表">应用脚本</button>' +
      '<button class="rel-issue-mini" onclick="recRelIssueScriptReset()" title="按当前步骤重新生成脚本">还原</button>' +
      '<button class="rel-issue-mini" onclick="recRelIssueStepMode(\'steps\')" title="回到列表模式">返回列表</button>' +
      '<span class="rel-issue-hint" id="relScriptTip">脚本改动按「应用脚本」生效</span>' +
      '</div>';
  }
  // 输入时只重画高亮层（不动 textarea，避免打断光标）
  function recRelIssueScriptInput(el) {
    var hl = document.getElementById('relScriptHl');
    if (hl) {
      var q = issueById(relIssueEditId);
      var tidy = q ? issueStepScript(q) : '';
      if (q && el.value !== tidy && tidy.replace(/\s+/g, '') === el.value.replace(/\s+/g, '')) {
        // 只差空白：按模型重画，保留行首序号
        hl.innerHTML = issueScriptModelHtml(q);
      } else {
        hl.innerHTML = issueScriptHighlight(el.value);
      }
    }
    recRelIssueScriptScroll(el);
  }
  function recRelIssueScriptScroll(el) {
    var hl = document.getElementById('relScriptHl');
    if (!hl || !el) return;
    hl.style.transform = 'translate(' + (-el.scrollLeft) + 'px,' + (-el.scrollTop) + 'px)';
    hl.style.minHeight = (el.scrollHeight + 2) + 'px';
  }
  // 失焦时自动整理格式（重排字段顺序与空格）
  function recRelIssueScriptBlur(el) {
    if (!el) return;
    var q = issueById(relIssueEditId);
    if (!q) return;
    var res = scriptParse(el.value, q);
    if (!res.blocks.length) return;
    var tmp = { steps: [] };
    res.blocks.forEach(function (b) {
      b.items.forEach(function (it) {
        tmp.steps.push({ type: it.type, ref: it.ref, timing: it.timing, dur: it.dur,
          note: it.note, noteOn: it.noteOn, mgrp: b.items.length > 1 ? 'g' + b.no : '',
          fx: issueNormFx(it.type, it.fx) });
      });
    });
    var tidy = issueStepScript(tmp);
    if (tidy && tidy !== el.value) {
      el.value = tidy;
      recRelIssueScriptInput(el);
    }
  }
  function recRelIssueScriptApply() {
    var el = document.getElementById('relScriptArea');
    if (!el) return;
    var r = issueScriptApply(el.value);
    toast(r.msg);
    var tip = document.getElementById('relScriptTip');
    if (tip) tip.textContent = r.msg;
  }
  function recRelIssueScriptReset() {
    var el = document.getElementById('relScriptArea');
    var q = issueById(relIssueEditId);
    if (!el || !q) return;
    el.value = issueStepScript(q);
    recRelIssueScriptInput(el);
  }
  /* ---------- 脚本编辑弹窗（双击「脚本」页签）：宽高 = 中部满屏 ---------- */
  function recRelScriptModalOpen() {
    if (demoLockEditing()) return;
    var q = issueById(relIssueEditId);
    if (!q) return;
    relIssueStepMode = 'script';
    if (relIssueOpen) renderIssuePanel();
    var mask = document.getElementById('relScriptModal');
    var box = document.getElementById('relScriptBox');
    var area = document.getElementById('relScriptModalArea');
    var hl = document.getElementById('relScriptModalHl');
    if (!mask || !box || !area || !hl) return;
    var r = relMidScreenRect();
    box.style.width = r.w + 'px';
    box.style.height = r.h + 'px';
    box.style.left = r.x + 'px';
    box.style.top = r.y + 'px';
    mask.style.display = 'flex';
    area.value = issueStepScript(q);
    hl.innerHTML = issueScriptModelHtml(q);
    area.scrollTop = 0; area.scrollLeft = 0;
    recRelScriptModalScroll(area);
    setTimeout(function () { try { area.focus(); } catch (e) {} }, 40);
  }
  // 中部满屏的尺寸与位置（与关系拓扑「中部满屏」同尺寸）
  function relMidScreenRect() {
    var rect = null;
    var mid = document.querySelector('.middle-area');
    if (mid) { var r0 = mid.getBoundingClientRect(); if (r0.width > 40 && r0.height > 40) rect = r0; }
    if (!rect) {
      var tab = document.getElementById('tab-record');
      if (tab) { var r1 = tab.getBoundingClientRect(); if (r1.width > 40 && r1.height > 40) rect = r1; }
    }
    if (!rect) {
      var w = Math.min(window.innerWidth - 40, 1180);
      var h = Math.min(window.innerHeight - 80, 760);
      return { x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2), w: Math.round(w), h: Math.round(h) };
    }
    return { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) };
  }
  function recRelScriptModalInput(el) {
    var hl = document.getElementById('relScriptModalHl');
    if (hl) {
      var q = issueById(relIssueEditId);
      var tidy = q ? issueStepScript(q) : '';
      if (q && tidy.replace(/\s+/g, '') === el.value.replace(/\s+/g, '')) hl.innerHTML = issueScriptModelHtml(q);
      else hl.innerHTML = issueScriptHighlight(el.value);
    }
    recRelScriptModalScroll(el);
    // 与面板内脚本框实时同步
    var pane = document.getElementById('relScriptArea');
    if (pane && pane.value !== el.value) {
      pane.value = el.value;
      recRelIssueScriptInput(pane);
    }
  }
  function recRelScriptModalScroll(el) {
    var hl = document.getElementById('relScriptModalHl');
    if (!hl || !el) return;
    hl.style.transform = 'translate(' + (-el.scrollLeft) + 'px,' + (-el.scrollTop) + 'px)';
  }
  function recRelScriptModalApply() {
    var area = document.getElementById('relScriptModalArea');
    if (!area) return;
    var r = issueScriptApply(area.value);
    var tip = document.getElementById('relScriptModalTip');
    if (tip) tip.textContent = r.msg;
    toast(r.msg);
    var q = issueById(relIssueEditId);
    if (q) {
      var hl = document.getElementById('relScriptModalHl');
      if (hl) hl.innerHTML = issueScriptModelHtml(q);
      area.value = issueStepScript(q);
      var pane = document.getElementById('relScriptArea');
      if (pane) { pane.value = area.value; recRelIssueScriptInput(pane); }
      recRelScriptModalScroll(area);
    }
  }
  function recRelScriptModalReset() {
    var area = document.getElementById('relScriptModalArea');
    var q = issueById(relIssueEditId);
    if (!area || !q) return;
    area.value = issueStepScript(q);
    var hl = document.getElementById('relScriptModalHl');
    if (hl) hl.innerHTML = issueScriptModelHtml(q);
    recRelScriptModalScroll(area);
  }
  function recRelScriptModalClose() {
    var mask = document.getElementById('relScriptModal');
    var area = document.getElementById('relScriptModalArea');
    // 关闭时自动写回（用户编辑后点「返回」即生效）
    if (area && area.value.trim()) recRelScriptModalApply();
    if (mask) mask.style.display = 'none';
  }
  // 从列表切到脚本时，用当前步骤刷新文本框（保留用户未应用的草稿）
  function relIssueScriptSync(q) {
    var el = document.getElementById('relScriptArea');
    if (!el || !q) return;
    if (!el.value.trim()) {
      el.value = issueStepScript(q);
      recRelIssueScriptInput(el);
    }
  }

  // 分区标题：展开 / 收起
  function recRelIssueSec(key) {
    relIssueSecOpen[key] = !(relIssueSecOpen[key] !== false);
    renderIssuePanel();
  }
  // 批注：单击显示/隐藏（延时避开双击）、双击编辑、悬停预览
  var relNoteClickTimer = 0;
  function recRelIssueNoteToggle(i) {
    if (demoLockEditing()) return;
    if (relNoteClickTimer) { clearTimeout(relNoteClickTimer); relNoteClickTimer = 0; }
    relNoteClickTimer = setTimeout(function () {
      relNoteClickTimer = 0;
      var q = issueById(relIssueEditId);
      if (!q || !q.steps[i]) return;
      var s = q.steps[i];
      if (!String(s.note || '').trim()) { recRelIssueNoteEdit(i); return; }
      s.noteOn = s.noteOn ? 0 : 1;
      save();
      applyIssueState();
      renderIssuePanel();
    }, 230);
  }
  function recRelIssueNoteEdit(i) {
    if (demoLockEditing()) return;
    if (relNoteClickTimer) { clearTimeout(relNoteClickTimer); relNoteClickTimer = 0; }
    var q = issueById(relIssueEditId);
    if (!q || !q.steps[i]) return;
    relNoteEditIdx = i;
    hideTip();
    var who = document.getElementById('relNoteWho');
    if (who) who.textContent = issueStepName(q.steps[i]) + ' 的批注';
    var ta = document.getElementById('relNoteText');
    if (ta) ta.value = String(q.steps[i].note || '');
    var box = document.getElementById('relNoteModal');
    if (box) box.style.display = 'flex';
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }
  function recRelNoteClose() {
    var box = document.getElementById('relNoteModal');
    if (box) box.style.display = 'none';
    relNoteEditIdx = -1;
  }
  function recRelNoteSave() {
    var q = issueById(relIssueEditId);
    var i = relNoteEditIdx;
    if (!q || !q.steps[i]) { recRelNoteClose(); return; }
    var ta = document.getElementById('relNoteText');
    var txt = ta ? String(ta.value || '').trim() : '';
    q.steps[i].note = txt;
    if (!txt) q.steps[i].noteOn = 0;
    else q.steps[i].noteOn = 1;
    save();
    recRelNoteClose();
    renderIssuePanel();
    applyIssueState();
  }
  function recRelIssueNoteHover(ev, i) {
    var q = issueById(relIssueEditId);
    if (!q || !q.steps[i]) return;
    var txt = String(q.steps[i].note || '').trim();
    var head = '批注 · ' + (q.steps[i].noteOn ? '显示中' : '已隐藏');
    showTip(txt || '双击此按钮可输入批注文字', ev, head);
    var btn = ev && ev.currentTarget;
    var tip = document.getElementById('relTip');
    if (btn && tip && btn.getBoundingClientRect) {
      var r = btn.getBoundingClientRect();
      tip.style.left = Math.round(r.left - tip.offsetWidth - 10) + 'px';
      tip.style.top = Math.round(Math.min(r.top - 4, window.innerHeight - tip.offsetHeight - 8)) + 'px';
      if (parseFloat(tip.style.left) < 8) {
        tip.style.left = Math.round(r.right + 10) + 'px';
      }
    }
  }

  // 呼吸外发光开关
  function recRelIssueBreath(i) {
    var q = issueById(relIssueEditId);
    if (!q || !q.steps[i]) return;
    q.steps[i].fx.breath = q.steps[i].fx.breath ? 0 : 1;
    save();
    renderIssuePanel();
    applyIssueState();
  }
  // 关系连线颜色（预设 / 自选共用）：不重渲染，避免取色器拖动时被刷掉
  function recRelIssueColor(i, val, el) {
    if (demoLockEditing()) return;
    var q = issueById(relIssueEditId);
    if (!q || !q.steps[i]) return;
    var c = String(val || '');
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) return;
    q.steps[i].fx.color = c;
    save();
    var box = el && el.closest ? el.closest('.rel-fx-swatches') : null;
    if (box) {
      var hit = false;
      var sw = box.querySelectorAll('.rel-fx-swatch');
      for (var k = 0; k < sw.length; k++) {
        var same = String(sw[k].getAttribute('data-fc') || '').toLowerCase() === c.toLowerCase();
        if (same) hit = true;
        sw[k].classList.toggle('on', same);
      }
      var pk = box.querySelector('.rel-fx-pick');
      if (pk) pk.classList.toggle('on', !hit);
    }
    applyIssueState();
  }
  // 呼吸光颜色
  function recRelIssuePColor(i, val) {
    var q = issueById(relIssueEditId);
    if (!q || !q.steps[i]) return;
    q.steps[i].fx.pcolor = String(val || '');
    save();
    applyIssueState();
  }

  // 单击步骤：普通点击=展开参数；Ctrl/Shift 点击=多选（用于合并）
  // 选中态按步骤 id 记录：合并 / 展开收起都会让行下标变化，用下标会选错行
  function stepIdOf(i) {
    var q = issueById(relIssueEditId);
    return (q && q.steps[i]) ? q.steps[i].id : '';
  }
  function recRelIssueStepClick(e, i) {
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      if (e.preventDefault) e.preventDefault();
      var sid = stepIdOf(i);
      if (!sid) return;
      var k = relStepSel.indexOf(sid);
      if (k >= 0) relStepSel.splice(k, 1); else relStepSel.push(sid);
      syncStepSel();
      return;
    }
    var q = issueById(relIssueEditId);
    if (!q || !q.steps[i]) return;
    recRelIssueStepOpen(q.steps[i].id);
  }
  function syncStepSel() {
    var rows = document.querySelectorAll('#relIssueBody .rel-step-row');
    for (var i = 0; i < rows.length; i++) {
      var cell = rows[i].querySelector('.rel-issue-step');
      var sid = cell ? cell.getAttribute('data-sid') : '';
      rows[i].classList.toggle('sel', !!sid && relStepSel.indexOf(sid) >= 0);
    }
    if (relStepSel.length > 1) toast('已选 ' + relStepSel.length + ' 步：右键可合并到同一步骤');
  }
  // 合并块展开 / 收起
  function recRelIssueGrpToggle(gid) {
    if (!gid) return;
    var open = !relIssueGrpOpen[gid];
    relIssueGrpOpen[gid] = open;
    var rows = document.querySelectorAll('#relIssueBody .rel-step-row');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute('data-grp') !== gid) continue;
      if (!rows[i].querySelector('.n-grp')) rows[i].classList.toggle('folded', !open);
    }
    var btns = document.querySelectorAll('#relIssueBody .n-grp');
    for (var j = 0; j < btns.length; j++) {
      var row2 = btns[j].closest('.rel-step-row');
      if (row2 && row2.getAttribute('data-grp') === gid) btns[j].classList.toggle('open', open);
    }
  }
  // 合并：选中 ≥2 步 → 同一个动作（演示时一帧播完）
  // 合并到同一步骤：第一个被选步骤所在的组为宿主，其余步骤（含别的组的）依次并入宿主末尾。
  // 合并到同一步骤：目标组取「右键那一步所属的组」；若它不是组员，则取选中项里第一个已有的组；
  // 都没有就新建一组。组外的选中步骤统一并入该组末尾（组首仍为「之后」，其余为「同时」）。
  function recRelIssueStepMerge(anchorIdx) {
    var q = issueById(relIssueEditId);
    if (!q || relStepSel.length < 2) return;
    var picked = q.steps.filter(function (st) { return relStepSel.indexOf(st.id) >= 0; });
    if (picked.length < 2) { toast('请选择至少两个步骤'); return; }
    var anchor = (typeof anchorIdx === 'number' && anchorIdx >= 0) ? q.steps[anchorIdx] : null;
    var gid = anchor ? String(anchor.mgrp || '') : '';
    if (!gid) {
      for (var i = 0; i < picked.length; i++) {
        if (picked[i].mgrp) { gid = String(picked[i].mgrp); break; }
      }
    }
    var members = gid ? q.steps.filter(function (st) { return String(st.mgrp || '') === gid; }) : [];
    if (!members.length) {
      // 新建组：仍然只允许把连续相邻的步骤合并到一起，避免打乱播放顺序
      var firstAt = q.steps.indexOf(picked[0]);
      var contiguous = true;
      for (var ci = 0; ci < picked.length; ci++) {
        if (q.steps.indexOf(picked[ci]) !== firstAt + ci) { contiguous = false; break; }
      }
      if (!contiguous) { toast('只能合并连续相邻的步骤'); return; }
      gid = newId('g');
      var head = picked[0];
      head.mgrp = gid;
      members = [head];
    }
    var incoming = [];
    picked.forEach(function (st) {
      if (!st) return;
      if (String(st.mgrp || '') === gid) return;
      if (incoming.indexOf(st) < 0) incoming.push(st);
    });
    if (!incoming.length) {
      // 组内时序也顺手归位
      members[0].timing = 'after';
      members.slice(1).forEach(function (st) { st.timing = 'with'; });
      relIssueGrpOpen[gid] = true;
      relStepSel = [];
      renderIssuePanel();
      hideStepMenu();
      toast('所选步骤已在同一步骤中');
      return;
    }
    incoming.forEach(function (st) { st.mgrp = gid; });
    var block = members.concat(incoming);
    block[0].timing = 'after';
    block.slice(1).forEach(function (st) { st.timing = 'with'; });
    // 插入点：块首成员在原列表中的位置，换算成「移走整块之后」的下标
    var headAt = q.steps.indexOf(block[0]);
    var rest = [];
    var at = 0;
    q.steps.forEach(function (st, idx) {
      if (block.indexOf(st) >= 0) return;
      if (idx < headAt) at++;
      rest.push(st);
    });
    rest.splice.apply(rest, [at, 0].concat(block));
    q.steps = rest;
    // 第 59 轮：合并后保持展开，方便继续调参 / 继续并入其他步骤
    relIssueGrpOpen[gid] = true;
    relStepSel = [];
    relIssueStepOpen = '';
    save();
    renderIssuePanel();
    applyIssueState();
    hideStepMenu();
    toast('已合并到同一步骤（共 ' + block.length + ' 个子步骤）');
  }
  function recRelIssueStepUnmerge() {
    var q = issueById(relIssueEditId);
    if (!q || !relStepSel.length) return;
    (q.steps || []).forEach(function (st) {
      if (relStepSel.indexOf(st.id) >= 0) st.mgrp = '';
    });
    relStepSel = [];
    save();
    renderIssuePanel();
    applyIssueState();
    hideStepMenu();
    toast('已取消合并');
  }
  // 合并组「预览效果」：该组内的几步在拓扑图上依次点亮一遍，播完停住
  var grpPreviewTimer = 0;
  function clearGrpPreview() {
    if (grpPreviewTimer) { clearTimeout(grpPreviewTimer); grpPreviewTimer = 0; }
  }
  function recRelIssueGrpPreview(gid) {
    if (relIssueDemo.on) return;
    var q = issueById(relIssueEditId);
    if (!q || !gid) return;
    var list = (q.steps || []).filter(function (s) { return String(s.mgrp || '') === String(gid); });
    if (!list.length) return;
    clearGrpPreview();
    var shown = 1;
    var tick = function () {
      grpPreviewTimer = 0;
      clearDemoStyles();
      applyScopeDim(q);
      var k;
      for (k = 0; k < shown && k < list.length; k++) applyStepFx(list[k], { anim: k === shown - 1 });
      syncNoteLayer();
      layoutNotes();
      if (shown < list.length) {
        shown++;
        grpPreviewTimer = setTimeout(tick, 760);
      }
    };
    tick();
  }
  // 点中某条步骤 → 只展开它的动效参数（再点一次收起）
  function recRelIssueStepOpen(sid) {
    relIssueStepOpen = (relIssueStepOpen === sid) ? '' : sid;
    var rows = document.querySelectorAll('#relIssueBody .rel-issue-step');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('open', rows[i].getAttribute('data-sid') === relIssueStepOpen);
    }
    var fxs = document.querySelectorAll('#relIssueBody .rel-issue-fx');
    for (var j = 0; j < fxs.length; j++) {
      fxs[j].classList.toggle('show', fxs[j].getAttribute('data-fx') === relIssueStepOpen);
    }
    // 调试：展开哪一步就立刻在拓扑图上呈现该步效果
    applyIssueState();
  }
  // 数值框编辑中：只记录输入内容，等失焦/回车再落盘并应用
  function recRelIssueFxDraft(el) {
    if (!el) return;
    el.setAttribute('data-dirty', '1');
  }
  // 记住「上一个非默认值」：双击数字框时回填，省得重新输入
  var relFxLastVal = {};
  var REL_FX_DEF = { scale: 115, opacity: 100, width: 1.5 };
  function recRelIssueFxNumRestore(el, ev, i, key) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var v = relFxLastVal[key];
    if (v == null) return;
    var box = document.querySelector('#relIssueBody .rel-issue-fx.show .rel-fx-num[data-num="' + key + '"]') || el;
    recRelIssueFx(i, key, v, box);
  }
  function recRelIssueFx(i, key, val, el) {
    if (demoLockEditing()) return;
    var q = issueById(relIssueEditId);
    if (!q || !q.steps[i]) return;
    var s = q.steps[i];
    var enumKey = (key === 'color' || key === 'dash' || key === 'dir' || key === 'shape');
    if (enumKey) {
      s.fx[key] = String(val);
    } else if (key === 'arrow') {
      s.fx.arrow = Number(val) ? 1 : 0;
    } else {
      var n = Number(val);
      if (!isFinite(n)) return;
      if (key === 'scale') s.fx.scale = n > 10 ? n / 100 : n;
      else if (key === 'opacity') s.fx.opacity = n > 1 ? n / 100 : n;
      else s.fx[key] = n;
      s.fx = issueNormFx(s.type, s.fx);
    }
    save();
    if (enumKey || key === 'arrow') {
      renderIssuePanel();
    } else if (el && el.classList && el.classList.contains('rel-fx-num')) {
      var shown = key === 'scale' ? Math.round(s.fx.scale * 100)
        : (key === 'opacity' ? Math.round(s.fx.opacity * 100) : s.fx[key]);
      el.value = shown;
      el.removeAttribute('data-dirty');
      if (REL_FX_DEF[key] != null && Math.abs(shown - REL_FX_DEF[key]) > 1e-6) relFxLastVal[key] = shown;
    }
    applyIssueState();
  }
  // − / + 步进：按界面单位（缩放 % / 透明 %）加减，再走普通输入路径落盘
  function recRelIssueFxStep(i, key, delta) {
    if (demoLockEditing()) return;
    var q = issueById(relIssueEditId);
    if (!q || !q.steps[i]) return;
    var cur = (key === 'scale') ? q.steps[i].fx.scale * 100
      : (key === 'opacity' ? q.steps[i].fx.opacity * 100 : q.steps[i].fx[key]);
    var next = Number(cur) + Number(delta);
    var box = document.querySelector('#relIssueBody .rel-issue-fx.show .rel-fx-num[data-num="' + key + '"]');
    recRelIssueFx(i, key, next, box);
  }
  // 关联关系步骤：按住行上下拖动排序
  var issueStepFrom = -1;
  function recRelIssueStepDragStart(e, el) {
    issueStepFrom = parseInt(el.getAttribute('data-idx'), 10);
    el.classList.add('dragging');
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(issueStepFrom)); } catch (err) { }
  }
  function recRelIssueStepDragOver(e) { e.preventDefault(); }
  function recRelIssueStepDragEnd(e, el) { el.classList.remove('dragging'); issueStepFrom = -1; }
  function recRelIssueStepDrop(e, el) {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('dragging');
    var to = parseInt(el.getAttribute('data-idx'), 10);
    var q = issueById(relIssueEditId);
    if (!q || isNaN(to) || issueStepFrom < 0 || issueStepFrom === to) { issueStepFrom = -1; return; }
    if (issueStepFrom >= q.steps.length || to >= q.steps.length) { issueStepFrom = -1; return; }
    var moved = q.steps.splice(issueStepFrom, 1)[0];
    q.steps.splice(to, 0, moved);
    issueStepFrom = -1;
    relIssueStepOpen = '';
    save();
    renderIssuePanel();
    applyIssueState();
  }
  // 持续到：self=本动作 / act<n>=动作n / last=最后
  function recRelIssueDur(i, v) {
    var q = issueById(relIssueEditId);
    if (!q || !q.steps[i]) return;
    q.steps[i].dur = normDur(v);
    save();
    renderIssuePanel();
    applyIssueState();
  }
  // 步骤菜单：新增人员 / 新增关系
  var relStepMenuIdx = -1;
  var relStepMenuGrp = '';      // 右键所在步骤的合并组 id（用于「预览效果」）
  function recRelIssueStepMenu(e, i) {
    if (relIssueDemo.on) return;
    e.preventDefault();
    e.stopPropagation();
    var q = issueById(relIssueEditId);
    if (!q || !q.steps[i]) return;
    relStepMenuIdx = i;
    showStepMenu(e);
  }
  // 「＋新增步骤」按钮 / 空列表提示：不依赖已有步骤
  function recRelStepAddMenu(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (e && e.preventDefault) e.preventDefault();
    if (relIssueDemo.on) return;
    if (!issueById(relIssueEditId)) return;
    relStepMenuIdx = -1;
    showStepMenu(e);
  }
  function showStepMenu(e) {
    var m = document.getElementById('relStepMenu');
    if (!m) {
      m = document.createElement('div');
      m.id = 'relStepMenu';
      m.className = 'rel-step-menu';
      document.body.appendChild(m);
      m.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('button[data-act]') : null;
        if (!b) return;
        var act = b.getAttribute('data-act');
        var at = relStepMenuIdx;    // hideStepMenu 会清掉，先记下右键所在步骤
        hideStepMenu();
        if (act === 'add-person') startStepAdd('person', at);
        else if (act === 'add-link') startStepAdd('link', at);
        else if (act === 'merge') recRelIssueStepMerge(at);
        else if (act === 'unmerge') recRelIssueStepUnmerge();
        else if (act === 'preview') recRelIssueGrpPreview(relStepMenuGrp);
      });
    }
    var q0 = issueById(relIssueEditId);
    var selCnt = relStepSel.length;
    var canMerge = selCnt > 1;
    var canUnmerge = false;
    if (q0) (q0.steps || []).forEach(function (st) { if (relStepSel.indexOf(st.id) >= 0 && st.mgrp) canUnmerge = true; });
    if (!canMerge && relStepMenuIdx >= 0 && q0 && q0.steps[relStepMenuIdx] && q0.steps[relStepMenuIdx].mgrp) {
      canUnmerge = true;
    }
    // 右键落在合并组首步上 → 提供「预览效果」
    relStepMenuGrp = '';
    if (q0 && relStepMenuIdx >= 0 && q0.steps[relStepMenuIdx]) {
      var rid = String(q0.steps[relStepMenuIdx].mgrp || '');
      if (rid) relStepMenuGrp = rid;
    }
    m.innerHTML = '<button data-act="add-person" type="button">＋ 新增人员</button>' +
      '<button data-act="add-link" type="button">＋ 新增关系</button>' +
      (canMerge ? '<button data-act="merge" type="button">⛓ 合并到同一步骤（' + selCnt + '）</button>' : '') +
      (relStepMenuGrp ? '<button data-act="preview" type="button">▶ 预览效果</button>' : '') +
      (canUnmerge ? '<button data-act="unmerge" type="button">⛓ 取消合并</button>' : '');
    m.style.left = Math.min(e.clientX, window.innerWidth - 140) + 'px';
    m.style.top = Math.min(e.clientY, window.innerHeight - 90) + 'px';
    m.classList.add('show');
  }
  function hideStepMenu() {
    var m = document.getElementById('relStepMenu');
    if (m) m.classList.remove('show');
    relStepMenuIdx = -1;
  }
  // 新增动作模式：person=右键人员；link=右键关系线，或 Ctrl 选两人后右键
  var relStepAdd = { mode: '', from: '', afterIdx: -1 };
  // idx = 右键所在步骤下标：新步骤插到它后面（-1 = 追加到末尾）
  function startStepAdd(mode, idx) {
    if (demoLockEditing()) return;
    var q = issueById(relIssueEditId);
    if (!q) return;
    relStepAdd.mode = mode;
    relStepAdd.from = '';
    relStepAdd.afterIdx = (idx == null ? -1 : idx);
    if (mode === 'person') toast('新增人员：到右侧拓扑图右键人员 →「新增人员」');
    else toast('新增关系：右键关系线 →「新增关系」；或 Ctrl 选两人后右键任一人员');
    document.querySelectorAll('#relGraph .rel-node').forEach(function (n) { n.classList.remove('rel-path-sel'); });
  }
  function cancelStepAdd() {
    if (!relStepAdd.mode) return;
    relStepAdd.mode = '';
    relStepAdd.from = '';
    relStepAdd.afterIdx = -1;
    document.querySelectorAll('#relGraph .rel-node').forEach(function (n) { n.classList.remove('rel-path-sel'); });
    toast('已退出新增');
  }

  function recRelIssueTiming(i, timing) {
    var q = issueById(relIssueEditId);
    if (!q || !q.steps[i]) return;
    q.steps[i].timing = (timing === 'with') ? 'with' : 'after';
    save();
    renderIssuePanel();
    applyIssueState();
  }
  function recRelIssueStepMove(i, d) {
    relIssueStepOpen = '';
    var q = issueById(relIssueEditId);
    if (!q) return;
    var j = i + d;
    if (j < 0 || j >= q.steps.length) return;
    var t = q.steps[i]; q.steps[i] = q.steps[j]; q.steps[j] = t;
    save();
    renderIssuePanel();
  }
  function recRelIssueStepDel(i) {
    if (demoLockEditing()) return;
    relIssueStepOpen = '';
    var q = issueById(relIssueEditId);
    if (!q) return;
    q.steps.splice(i, 1);
    save();
    renderIssuePanel();
  }

  function issueAddStep(type, ref) {
    var q = issueById(relIssueEditId);
    if (!q) return;
    var ns = { id: newId('s'), type: type, ref: String(ref), timing: 'after', dur: 'self', fx: issueNormFx(type, null) };
    // 插到右键所在步骤的后面；若那里是合并组，则插到该组末尾，避免把组拆开
    var at = -1;
    var ai = relStepAdd.afterIdx;
    if (ai != null && ai >= 0 && ai < q.steps.length) {
      var gid = String(q.steps[ai].mgrp || '');
      at = ai + 1;
      if (gid) { while (at < q.steps.length && String(q.steps[at].mgrp || '') === gid) at++; }
    }
    if (at < 0 || at > q.steps.length) q.steps.push(ns);
    else q.steps.splice(at, 0, ns);
    // 新增完直接选中该步，进入参数编辑态
    relIssueStepOpen = ns.id;
    relStepAdd.afterIdx = -1;
    if (type === 'person' && q.people.indexOf(ref) < 0) q.people.push(ref);
    if (type === 'link') {
      var l = linkById(ref);
      if (l) {
        if (q.people.indexOf(l.from) < 0) q.people.push(l.from);
        if (q.people.indexOf(l.to) < 0) q.people.push(l.to);
      }
    }
    save();
    renderIssuePanel();
    renderGraph();
    applyIssueState();
    scrollToStep(ns.id);
  }
  // 让新加的步骤滚进可视区，方便直接调参数
  function scrollToStep(sid) {
    setTimeout(function () {
      var el = document.querySelector('#relIssueBody .rel-issue-step[data-sid="' + sid + '"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }, 40);
  }

  function renderIssueCard() {
    var card = document.getElementById('relIssueCard');
    var q = issueById(relIssueDemo.on ? relIssueDemo.id : relIssueSelId);
    if (!card) return;
    var show = !!(q && !relIssueCardHidden && (relIssueDemo.on || (relIssueOpen && !relIssueEditId)));
    card.classList.toggle('show', show);
    if (!show) return;
    var t = document.getElementById('relIssueCardTitle');
    var d = document.getElementById('relIssueCardDesc');
    var m = document.getElementById('relIssueCardMeta');
    if (t) t.textContent = q.title;
    if (d) d.textContent = q.desc || '（暂无问题描述）';
    if (m) {
      var total = demoFrames(q).length;
      m.innerHTML = '<span>涉及人员 <b>' + issuePeople(q).length + '</b></span>' +
        '<span>涉及关系 <b>' + issueLinkIds(q).length + '</b></span>' +
        (relIssueDemo.on ? '<span>步骤 <b>' + (relIssueDemo.frame) + '/' + total + '</b></span>' : '');
    }
  }

  // 关闭 / 重新显示概述框：只影响浮框，不影响演示进度与控制栏
  function recRelIssueCardHide() {
    relIssueCardHidden = true;
    renderIssueCard();
  }
  function recRelIssueCardToggle() {
    relIssueCardHidden = !relIssueCardHidden;
    renderIssueCard();
  }
  // 未配置步骤时：按「涉及关系」自动生成帧，保证点「演示」就能看到流动
  function demoFrames(q) {
    var frames = [];
    var list = q.steps || [];
    if (!list.length) {
      return issueLinkIds(q).map(function (id) {
        return [{ type: 'link', ref: id, timing: 'after', fx: issueNormFx('link', null) }];
      });
    }
    list.forEach(function (s) {
      var gid = String(s.mgrp || '');
      var last = frames.length ? frames[frames.length - 1] : null;
      if (gid) {
        // 同一合并块 = 同一帧；块内仍按「同时 / 之后」的原顺序排列
        var same = last && last.some(function (x) { return String(x.mgrp || '') === gid; });
        if (same) { last.push(s); return; }
        frames.push([s]);
        return;
      }
      if (!frames.length || (s.timing !== 'with' && s.timing !== 'before')) frames.push([]);
      frames[frames.length - 1].push(s);
    });
    return frames;
  }
  /* ---------- 面板开关 / 列表交互 ---------- */
  function recRelPageToggle() {
    relIssueOpen = !relIssueOpen;
    if (!relIssueOpen) {
      relIssueEditId = '';
      relIssueStepOpen = '';
      // 整屏全屏 + 演示中：只收起「问题分析」栏，演示与控制栏继续（第 60 轮）
      if (relIssueDemo.on && relFullMode < 2) stopDemo();
    }
    renderIssuePanel();
    applyIssueState();
    updateFootTip();
  }
  function recRelIssueSelect(id) {
    relIssueSelId = (relIssueSelId === id) ? '' : id;
    renderIssuePanel();
    renderIssueCard();
  }
  function recRelIssueEdit(id) {
    if (demoLockEditing()) return;
    relIssueEditId = id;
    relIssueSelId = id;
    relIssueSecOpen = { desc: false, people: false, steps: false };
    renderIssuePanel();
    renderIssueCard();
    applyIssueState();
  }
  function recRelIssueBack() {
    relIssueEditId = '';
    relIssueStepOpen = '';
    renderIssuePanel();
    applyIssueState();
  }
  function recRelIssueNew() {
    if (demoLockEditing()) return;
    var nm = window.prompt('请输入问题名称', '新问题');
    if (nm === null) return;
    var q = issueNorm({ id: issueNewId(), title: String(nm).trim() || '新问题', desc: '', people: [], steps: [] });
    relData.issues = issueList().concat([q]);
    save();
    relIssueSelId = q.id;
    relIssueEditId = q.id;
    relIssueSecOpen = { desc: false, people: false, steps: false };
    renderIssuePanel();
    renderIssueCard();
    applyIssueState();
    toast('已新增问题：' + q.title);
  }
  function recRelIssueRemove(id) {
    if (demoLockEditing()) return;
    var q = issueById(id);
    if (!q) return;
    if (!window.confirm('确认删除问题「' + q.title + '」？')) return;
    relData.issues = issueList().filter(function (x) { return x.id !== id; });
    if (relIssueSelId === id) relIssueSelId = '';
    if (relIssueEditId === id) relIssueEditId = '';
    if (relIssueDemo.id === id) stopDemo();
    save();
    renderIssuePanel();
    renderIssueCard();
    applyIssueState();
    toast('已删除该问题');
  }
  var issueDragFrom = -1;
  function recRelIssueDragStart(e, el) {
    issueDragFrom = parseInt(el.getAttribute('data-idx'), 10);
    el.classList.add('dragging');
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(issueDragFrom)); } catch (err) { }
  }
  function recRelIssueDragOver(e) { e.preventDefault(); }
  function recRelIssueDragEnd(e, el) { el.classList.remove('dragging'); issueDragFrom = -1; }
  function recRelIssueDrop(e, el) {
    e.preventDefault();
    el.classList.remove('dragging');
    var to = parseInt(el.getAttribute('data-idx'), 10);
    var list = issueList();
    if (isNaN(to) || issueDragFrom < 0 || issueDragFrom === to || issueDragFrom >= list.length || to >= list.length) {
      issueDragFrom = -1;
      return;
    }
    var moved = list.splice(issueDragFrom, 1)[0];
    list.splice(to, 0, moved);
    relData.issues = list;
    issueDragFrom = -1;
    save();
    renderIssuePanel();
  }

  /* ---------- 演示 ---------- */
  function issueScope(iss) {
    var inScope = {};
    issuePeople(iss).forEach(function (id) { inScope[id] = true; });
    var links = {};
    issueLinkIds(iss).forEach(function (id) { links[id] = true; });
    return { people: inScope, links: links };
  }
  function clearDemoStyles() {
    // 第 59 轮：批注与线段同生共死 —— 每次清场都把批注层一并清空，
    // 需要显示的批注由调用方随后 applyStepFx / addNote 重新补上。
    var layer0 = document.querySelector('#relGraph .rel-note-layer');
    if (layer0) while (layer0.firstChild) layer0.removeChild(layer0.firstChild);
    var tops = document.querySelectorAll('#relGraph .rel-fx-top .rel-fx-head');
    for (var ti = 0; ti < tops.length; ti++) {
      tops[ti].classList.remove('on');
      tops[ti].style.stroke = '';
      tops[ti].style.strokeWidth = '';
      tops[ti].setAttribute('d', '');
    }
    var nodes = document.querySelectorAll('#relGraph .rel-node');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.remove('rel-dim2', 'rel-fx', 'rel-breath');
      var bh0 = nodes[i].querySelector('.rel-node-breath');
      if (bh0) { bh0.style.stroke = ''; bh0.style.removeProperty('--bc'); }
      var sh = nodes[i].querySelector('.rel-node-shape');
      var lb = nodes[i].querySelectorAll('.rel-node-label');
      if (sh) { sh.style.transform = ''; sh.style.opacity = ''; sh.style.filter = ''; sh.style.removeProperty('--bc'); }
      for (var k = 0; k < lb.length; k++) lb[k].style.opacity = '';
    }
    var links = document.querySelectorAll('#relGraph .rel-link');
    for (var j = 0; j < links.length; j++) {
      links[j].classList.remove('rel-link-hit', 'rel-link-muted', 'rel-path-sel');
      var fl = links[j].querySelector('.rel-flow-line');
      var gl = links[j].querySelector('.rel-flow-glow');
      if (fl) { fl.classList.remove('on'); fl.style.visibility = ''; }
      if (gl) { gl.classList.remove('on'); gl.style.visibility = ''; }
      var ln = links[j].querySelector('.rel-link-line');
      if (ln) {
        ln.style.stroke = ''; ln.style.strokeWidth = ''; ln.style.strokeDasharray = ''; ln.style.opacity = '';
      }
      var lbl = links[j].querySelector('.rel-link-label');
      if (lbl) lbl.style.opacity = '';
      links[j].removeAttribute('data-fx-on');
      links[j].removeAttribute('data-fx-shape');
      links[j].removeAttribute('data-fx-arrow');
      links[j].removeAttribute('data-fx-rev');
      links[j].removeAttribute('data-fx-bend');
      links[j].removeAttribute('data-flow-rev');
      if (links[j]._fxDraw) { clearTimeout(links[j]._fxDraw); links[j]._fxDraw = 0; }
      links[j].removeAttribute('data-fx-drawing');
      links[j].removeAttribute('data-fx-dash');
      var ovc = links[j].querySelector('.rel-fx-overlay');
      if (ovc) {
        ovc.classList.remove('on');
        ovc.style.stroke = ''; ovc.style.strokeWidth = ''; ovc.style.strokeDasharray = '';
        ovc.style.strokeDashoffset = ''; ovc.style.transition = '';
        ovc.style.filter = ''; ovc.style.visibility = '';
        ovc.setAttribute('d', '');
      }
      var kc = links[j].querySelector('.rel-fx-knob');
      if (kc) kc.classList.remove('on');
      var hc = links[j].querySelector('.rel-fx-head');
      if (hc) { hc.classList.remove('on'); hc.style.fill = ''; hc.setAttribute('d', ''); }
    }
  }
  // 只做「范围内点亮 / 范围外变暗」，不含动效（演示 / 合并组预览共用）
  function applyScopeDim(q) {
    if (!q) return;
    var scope = issueScope(q);
    var nodes = document.querySelectorAll('#relGraph .rel-node');
    for (var i = 0; i < nodes.length; i++) {
      var id = nodes[i].getAttribute('data-id');
      if (!scope.people[id]) nodes[i].classList.add('rel-dim2');
    }
    var links = document.querySelectorAll('#relGraph .rel-link');
    for (var j = 0; j < links.length; j++) {
      var lid = links[j].getAttribute('data-id');
      if (scope.links[lid]) links[j].classList.add('rel-link-hit');
      else links[j].classList.add('rel-link-muted');
    }
  }
  function applyIssueState() {
    clearDemoStyles();
    var q = relIssueDemo.on ? issueById(relIssueDemo.id) : (relIssueOpen ? issueById(relIssueSelId) : null);
    if (!q) { renderIssueCard(); return; }
    applyScopeDim(q);
    if (relIssueDemo.on) applyDemoFrame(true);
    else {
      // 第 59 轮：批注只在「演示 / 正在调参的那一步」出现，不再把所有步骤的批注一次铺开，
      // 因此退出演示后批注随线段一起消失。
      syncNoteLayer();
      layoutNotes();
      applyLiveFx();
    }
    renderIssueCard();
  }
  // 编辑态：正在调参的那一步立刻作用到拓扑图，便于边调边看
  function liveFxStep() {
    if (relIssueDemo.on || !relIssueOpen || !relIssueEditId || !relIssueStepOpen) return null;
    var q = issueById(relIssueEditId);
    if (!q) return null;
    var found = null;
    (q.steps || []).forEach(function (s) { if (s.id === relIssueStepOpen) found = s; });
    return found;
  }
  function applyLiveFx() {
    var s = liveFxStep();
    if (s) applyStepFx(s);
  }
  // 单步动效落到拓扑图（演示与实时调试共用）
  function applyStepFx(s, opts) {
    if (!s) return;
    var anim = !!(opts && opts.anim);
    if (s.note && s.noteOn) addNote(s);
    if (s.type === 'person') {
      var g = document.querySelector('#relGraph .rel-node[data-id="' + s.ref + '"]');
      if (!g) return;
      g.classList.add('rel-fx');
      var sh = g.querySelector('.rel-node-shape');
      if (!sh) return;
      sh.style.transform = 'scale(' + s.fx.scale + ')';
      sh.style.opacity = String(s.fx.opacity);
      if (s.fx.breath) {
        var bc = s.fx.pcolor || (personById(s.ref) ? colorOf(personById(s.ref)) : '#7fd4ff');
        var bh = g.querySelector('.rel-node-breath');
        if (bh) { bh.style.stroke = bc; bh.style.setProperty('--bc', bc); }
        g.classList.add('rel-breath');
      } else if (s.fx.glow > 0) {
        sh.style.filter = 'drop-shadow(0 0 ' + Math.round(s.fx.glow / 6) + 'px rgba(127, 212, 255, ' + (s.fx.glow / 100).toFixed(2) + '))';
      }
      return;
    }
    var lg = document.querySelector('#relGraph .rel-link[data-id="' + s.ref + '"]');
    if (!lg) return;
    // 叠加层：原连线保持未涉及透明度，这里单独画一条新的高亮连线
    lg.setAttribute('data-fx-on', '1');
    lg.setAttribute('data-fx-rev', s.fx.dir === 'reverse' ? '1' : '0');
    lg.setAttribute('data-fx-shape', s.fx.shape === 'curve' ? 'curve' : 'line');
    lg.setAttribute('data-fx-arrow', s.fx.arrow === 0 ? '0' : '1');
    lg.setAttribute('data-fx-bend', String(s.fx.bend || 0));
    lg.setAttribute('data-fx-dash', s.fx.dash === 'dash' ? '1' : '0');
    var arrowMode = s.fx.arrow !== 0;
    var ov = lg.querySelector('.rel-fx-overlay');
    if (ov) {
      ov.classList.add('on');
      ov.style.stroke = s.fx.color;
      ov.style.strokeWidth = s.fx.width + 'px';
      ov.style.strokeDasharray = s.fx.dash === 'dash' ? '8 6' : '';
      ov.style.filter = 'drop-shadow(0 0 5px ' + s.fx.color + ')';
      // 箭头模式：不要底下的线，只留人字形
      ov.style.visibility = '';
    }
    var knob = lg.querySelector('.rel-fx-knob');
    if (knob) {
      if (s.fx.shape === 'curve') knob.classList.add('on');
      else knob.classList.remove('on');
    }
    var fl = lg.querySelector('.rel-flow-line');
    var gl = lg.querySelector('.rel-flow-glow');
    if (fl) { fl.style.stroke = s.fx.color; fl.classList.add('on'); fl.style.visibility = 'hidden'; }
    if (gl) { gl.style.stroke = s.fx.color; gl.classList.add('on'); gl.style.visibility = 'hidden'; }
    var svgNow = document.querySelector('#relGraph svg');
    if (svgNow) updateLinks(svgNow);
    drawFxLine(lg, ov, arrowMode, anim);
  }
  // 线段按方向逐段出现：0.4 秒内从起点画到终点，画完再放箭头 / 流动光
  function drawFxLine(lg, ov, arrowMode, animate) {
    if (!lg || !ov) return;
    if (lg._fxDraw) { clearTimeout(lg._fxDraw); lg._fxDraw = 0; }
    var head = document.querySelector('#relGraph .rel-fx-top .rel-fx-head[data-lid="' + lg.getAttribute('data-id') + '"]') ||
      lg.querySelector('.rel-fx-head');
    var fl = lg.querySelector('.rel-flow-line');
    var gl = lg.querySelector('.rel-flow-glow');
    if (!animate) {
      // 非演示（调参 / 静态呈现）：不播画线，直接落终态
      ov.style.transition = '';
      ov.style.strokeDasharray = lg.getAttribute('data-fx-dash') === '1' ? '8 6' : '';
      ov.style.strokeDashoffset = '';
      ov.style.visibility = arrowMode ? 'hidden' : '';
      if (fl) fl.style.visibility = arrowMode ? 'hidden' : '';
      if (gl) gl.style.visibility = arrowMode ? 'hidden' : '';
      var svA = document.querySelector('#relGraph svg');
      if (svA) updateLinks(svA);
      if (arrowMode) {
        var hA = document.querySelector('#relGraph .rel-fx-top .rel-fx-head[data-lid="' + lg.getAttribute('data-id') + '"]') || head;
        if (hA && hA.getAttribute('d')) hA.classList.add('on');
      }
      return;
    }
    var len = 0;
    try { len = ov.getTotalLength ? ov.getTotalLength() : 0; } catch (e) { len = 0; }
    if (len > 0) {
      ov.style.transition = 'none';
      ov.style.strokeDasharray = len + ' ' + len;
      ov.style.strokeDashoffset = String(len);
      ov.style.visibility = '';
      if (head) head.classList.remove('on');
      void ov.getBoundingClientRect();
      ov.style.transition = 'stroke-dashoffset ' + REL_FX_DUR + 's linear';
      ov.style.strokeDashoffset = '0';
    }
    lg._fxDraw = setTimeout(function () {
      lg._fxDraw = 0;
      ov.style.transition = '';
      ov.style.strokeDasharray = lg.getAttribute('data-fx-dash') === '1' ? '8 6' : '';
      ov.style.strokeDashoffset = '';
      if (arrowMode) ov.style.visibility = 'hidden';
      if (fl) fl.style.visibility = arrowMode ? 'hidden' : '';
      if (gl) gl.style.visibility = arrowMode ? 'hidden' : '';
      // 先重算连线（人字形 d 在 updateLinks 里生成），再点亮箭头
      var sv = document.querySelector('#relGraph svg');
      if (sv) updateLinks(sv);
      if (arrowMode) {
        var hd = document.querySelector('#relGraph .rel-fx-top .rel-fx-head[data-lid="' + lg.getAttribute('data-id') + '"]') || head;
        if (hd && hd.getAttribute('d')) hd.classList.add('on');
      }
    }, REL_FX_DUR * 1000 + 20);
  }
  // ---- 拓扑批注：人员挂节点上方，关系挂连线中央 ----
  function noteUnits(ch) {
    var c = ch.charCodeAt(0);
    if (c < 0x2e80) return 0.55;
    return 1;
  }
  function noteWrap(text, maxUnits) {
    var out = [];
    String(text == null ? '' : text).split(/\n/).forEach(function (para) {
      var line = '', w = 0;
      for (var i = 0; i < para.length; i++) {
        var ch = para.charAt(i);
        var u = noteUnits(ch);
        if (w + u > maxUnits && line) { out.push(line); line = ''; w = 0; }
        line += ch; w += u;
      }
      out.push(line);
    });
    return out.length ? out : [''];
  }
  function addNote(s) {
    var layer = document.querySelector('#relGraph .rel-note-layer');
    if (!layer) return;
    var old = layer.querySelector('.rel-note[data-step="' + s.id + '"]');
    if (old) { old.setAttribute('data-on', '1'); return; }
    var el = noteEl(s);
    el.setAttribute('data-on', '1');
    layer.appendChild(el);
    fitNote(el);
  }
  // 量出真实文字宽度，把框收到刚好包住文字
  function fitNote(g) {
    var rect = g.querySelector('.rel-note-bg');
    var txs = g.querySelectorAll('.rel-note-tx');
    if (!rect || !txs.length) return;
    var maxW = 0;
    for (var i = 0; i < txs.length; i++) {
      var w = 0;
      try { w = txs[i].getComputedTextLength(); } catch (e) { w = 0; }
      if (w > maxW) maxW = w;
    }
    if (!maxW) return;
    var w2 = Math.ceil(maxW + 14);
    rect.setAttribute('width', String(w2));
    g.setAttribute('data-w', String(w2));
  }
  // 同步批注层：只保留本次应显示的批注（拖动中的元素不删）
  function syncNoteLayer() {
    var layer = document.querySelector('#relGraph .rel-note-layer');
    if (!layer) return;
    var gs = layer.querySelectorAll('.rel-note');
    for (var i = 0; i < gs.length; i++) {
      if (noteDrag && noteDrag.g === gs[i]) continue;
      if (gs[i].getAttribute('data-on') === '1') { gs[i].removeAttribute('data-on'); continue; }
      layer.removeChild(gs[i]);
    }
  }
  function noteEl(s) {
    var FS = 10.5, LH = 15, PADX = 7, PADY = 5, MAXU = 14;
    var lines = noteWrap(s.note, MAXU);
    var uw = 0;
    lines.forEach(function (l) {
      var w = 0;
      for (var i = 0; i < l.length; i++) w += noteUnits(l.charAt(i));
      if (w > uw) uw = w;
    });
    var w = Math.round(uw * FS + PADX * 2);
    var h = Math.round(lines.length * LH + PADY * 2);
    var NS = 'http://www.w3.org/2000/svg';
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'rel-note' + (s.type === 'link' ? ' is-link' : ''));
    g.setAttribute('data-step', s.id);
    g.setAttribute('data-kind', s.type);
    g.setAttribute('data-ref', s.ref);
    g.setAttribute('data-w', String(w));
    g.setAttribute('data-h', String(h));
    var r = document.createElementNS(NS, 'rect');
    r.setAttribute('class', 'rel-note-bg');
    // 第 59 轮：外框跟人走 —— 人员用本人颜色，关系用出发方（from）的颜色
    var strokeC = '';
    if (s.type === 'link') {
      var lk = linkById(s.ref);
      var src = lk ? personById(lk.from) : null;
      if (src) strokeC = colorOf(src);
    } else {
      var who = personById(s.ref);
      if (who) strokeC = colorOf(who);
    }
    if (strokeC) { r.style.stroke = strokeC; r.style.strokeOpacity = '0.85'; }
    r.setAttribute('width', String(w));
    r.setAttribute('height', String(h));
    r.setAttribute('rx', '6');
    g.appendChild(r);
    for (var li = 0; li < lines.length; li++) {
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('class', 'rel-note-tx');
      t.setAttribute('x', String(PADX));
      t.setAttribute('y', String(PADY + LH * li + FS));
      t.setAttribute('text-anchor', 'start');
      t.setAttribute('font-size', String(FS));
      t.textContent = lines[li] || ' ';
      g.appendChild(t);
    }
    g.addEventListener('pointerdown', noteDragStart);
    return g;
  }
  // 批注拖动：偏移量存进步骤（随主题一起保存）
  var noteDrag = null;
  function noteDragStart(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    var g = e.currentTarget;
    var sid = g.getAttribute('data-step');
    var q = issueById(relIssueDemo.on ? relIssueDemo.id : (relIssueOpen ? relIssueSelId : ''));
    if (!q) return;
    var s = null;
    (q.steps || []).forEach(function (x) { if (x.id === sid) s = x; });
    if (!s) return;
    var svg = document.querySelector('#relGraph svg');
    var p0 = svg ? svgPoint(svg, e.clientX, e.clientY) : null;
    if (!p0) return;
    var tf = g.getAttribute('transform') || '';
    var m = /translate\(([-0-9.]+),([-0-9.]+)\)/.exec(tf);
    var bx = m ? parseFloat(m[1]) : 0, by = m ? parseFloat(m[2]) : 0;
    noteDrag = { g: g, s: s, x0: p0.x, y0: p0.y, bx: bx, by: by };
    g.classList.add('dragging');
  }
  function noteDragMove(e) {
    if (!noteDrag) return;
    var svg = document.querySelector('#relGraph svg');
    if (!svg) return;
    var p = svgPoint(svg, e.clientX, e.clientY);
    if (!p) return;
    var nx = noteDrag.bx + (p.x - noteDrag.x0);
    var ny = noteDrag.by + (p.y - noteDrag.y0);
    noteDrag.g.setAttribute('transform', 'translate(' + nx.toFixed(1) + ',' + ny.toFixed(1) + ')');
    noteDrag.ox = nx - noteDrag.bx;
    noteDrag.oy = ny - noteDrag.by;
  }
  function noteDragEnd() {
    if (!noteDrag) return;
    var d = noteDrag;
    noteDrag = null;
    d.g.classList.remove('dragging');
    if (d.ox == null) return;
    var base = d.s.noff && typeof d.s.noff === 'object' ? d.s.noff : { x: 0, y: 0 };
    d.s.noff = { x: Math.round((base.x || 0) + d.ox), y: Math.round((base.y || 0) + d.oy) };
    save();
    layoutNotes();
  }
  function noteOffset(sid) {
    var q = relIssueDemo.on ? issueById(relIssueDemo.id) : (relIssueOpen ? issueById(relIssueSelId) : null);
    if (!q) return { x: 0, y: 0 };
    var hit = null;
    (q.steps || []).forEach(function (x) { if (x.id === sid && x.noff) hit = x.noff; });
    return hit ? { x: Number(hit.x) || 0, y: Number(hit.y) || 0 } : { x: 0, y: 0 };
  }
  function layoutNotes() {
    var layer = document.querySelector('#relGraph .rel-note-layer');
    if (!layer || !layer.firstChild) return;
    var gs = layer.querySelectorAll('.rel-note');
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      var w = parseFloat(g.getAttribute('data-w')) || 60;
      var h = parseFloat(g.getAttribute('data-h')) || 24;
      var x = 0, y = 0, found = false;
      if (g.getAttribute('data-kind') === 'person') {
        var p = dispPos[g.getAttribute('data-ref')];
        if (p) { x = p.x - w / 2; y = p.y - REL_R - 10 - h; found = true; }
      } else {
        var lg = document.querySelector('#relGraph .rel-link[data-id="' + g.getAttribute('data-ref') + '"]');
        if (lg) {
          var a = dispPos[lg.getAttribute('data-from')];
          var b = dispPos[lg.getAttribute('data-to')];
          if (a && b) {
            var off = parseFloat(lg.getAttribute('data-off')) || 0;
            var dx = b.x - a.x, dy = b.y - a.y;
            var d = Math.sqrt(dx * dx + dy * dy) || 1;
            var mx = (a.x + b.x) / 2 + (-dy / d) * off;
            var my = (a.y + b.y) / 2 + (dx / d) * off;
            x = mx - w / 2; y = my - h - 9;
            found = true;
          }
        }
      }
      if (noteDrag && noteDrag.g === g) continue;
      if (!found) { g.setAttribute('visibility', 'hidden'); continue; }
      g.removeAttribute('visibility');
      var off = noteOffset(g.getAttribute('data-step'));
      g.setAttribute('transform', 'translate(' + (x + off.x).toFixed(1) + ',' + (y + off.y).toFixed(1) + ')');
    }
  }
  function syncNotes() {
    layoutNotes();
  }
  // 把步骤展开成「子步（模块）」时间轴：
  //   每个动画 REL_FX_DUR = 0.4s；「同时」与上一个子步同起点；
  //   「之后」= 上一个子步动画结束 + REL_FX_GAP = 0.6s（跨步骤同样规则）。
  function demoSubs(q) {
    var frames = demoFrames(q);
    var subs = [];
    var prev = null;
    frames.forEach(function (grp, fi) {
      grp.forEach(function (s) {
        var st;
        if (!prev) st = 0;
        else if (s.timing === 'with' || s.timing === 'before') st = prev.start;
        else st = prev.start + prev.dur + REL_FX_GAP;
        var rec = { s: s, frame: fi, start: st, dur: REL_FX_DUR };
        subs.push(rec);
        prev = rec;
      });
    });
    return subs;
  }
  // 每个子步的结束时刻：
  //   本动作(self)  = 本步骤（动作）最后一个子步动画结束时
  //   动作N(actN)   = 第 N 个步骤开始播放时
  //   最后(last)    = 一直亮到演示结束
  function demoSubEnds(subs) {
    var firstOfFrame = {}, lastOfFrame = {};
    subs.forEach(function (r) {
      if (firstOfFrame[r.frame] == null) firstOfFrame[r.frame] = r.start;
      var e = r.start + r.dur;
      if (!(lastOfFrame[r.frame] >= e)) lastOfFrame[r.frame] = e;
    });
    subs.forEach(function (r) {
      var d = r.s.dur || 'self';
      if (d === 'last') r.end = Infinity;
      else if (d === 'self') r.end = lastOfFrame[r.frame];
      else {
        var an = parseInt(String(d).replace('act', ''), 10) - 1;
        r.end = (firstOfFrame[an] == null) ? Infinity : firstOfFrame[an];
      }
    });
    return subs;
  }
  // 渲染到「已出现前 n 个子步」的状态
  function applyDemoFrame(instant) {
    var q = issueById(relIssueDemo.id);
    if (!q) return;
    var subs = demoSubEnds(demoSubs(q));
    var frames = demoFrames(q);
    clearDemoStyles();
    applyScopeDim(q);
    var now = (relIssueDemo.sub >= 0 && relIssueDemo.sub < subs.length)
      ? subs[relIssueDemo.sub].start : 0;
    for (var i = 0; i <= relIssueDemo.sub && i < subs.length; i++) {
      var r = subs[i];
      // 结束时间到了就熄灭（本动作 = 动画结束；动作N = 该步开始；最后 = 一直亮）
      if (now >= r.end) continue;
      applyStepFx(r.s, { anim: i === relIssueDemo.sub });
    }
    if (relIssueDemo.sub >= 0 && relIssueDemo.sub < subs.length) {
      relIssueDemo.frame = subs[relIssueDemo.sub].frame + 1;
    } else relIssueDemo.frame = 0;
    syncNoteLayer();
    var bar = document.getElementById('relDemoBar');
    if (bar) bar.classList.add('show');
    var lbl = document.getElementById('relDemoStep');
    if (lbl) lbl.textContent = relIssueDemo.frame + '/' + frames.length;
    // 同一步骤内有多个子步时，单独显示步内进度，避免影响「步/总」的既有格式
    var subLbl = document.getElementById('relDemoSub');
    if (subLbl) {
      var txt = '';
      if (relIssueDemo.sub >= 0 && relIssueDemo.sub < subs.length) {
        var curFrame = subs[relIssueDemo.sub].frame;
        var inFrame = 0, done = 0;
        subs.forEach(function (r, i) {
          if (r.frame !== curFrame) return;
          inFrame++;
          if (i <= relIssueDemo.sub) done++;
        });
        if (inFrame > 1) txt = done + '/' + inFrame;
      }
      subLbl.textContent = txt;
    }
    renderIssueCard();
  }
  function stopDemo() {
    if (relIssueDemo.timer) { clearTimeout(relIssueDemo.timer); relIssueDemo.timer = 0; }
    relIssueDemo.on = false;
    relIssueDemo.id = '';
    relIssueDemo.frame = 0;
    relIssueDemo.sub = -1;
    relIssueStepOpen = '';
    var bar = document.getElementById('relDemoBar');
    if (bar) bar.classList.remove('show');
    if (relIssueOpen && relIssueEditId) renderIssuePanel();
    applyIssueState();
    updateFootTip();
  }
  function demoAutoplay() {
    if (!relIssueDemo.on) return;
    var q = issueById(relIssueDemo.id);
    if (!q) { stopDemo(); return; }
    var subs = demoSubs(q);
    if (relIssueDemo.sub + 1 >= subs.length) {
      relIssueDemo.timer = 0;
      relIssueDemo.frame = demoFrames(q).length;
      renderIssueCard();
      return;
    }
    var next = relIssueDemo.sub + 1;
    var prevStart = relIssueDemo.sub >= 0 ? subs[relIssueDemo.sub].start : 0;
    var delay = Math.max(0, subs[next].start - prevStart) * 1000;
    relIssueDemo.timer = setTimeout(function () {
      if (!relIssueDemo.on) return;
      relIssueDemo.sub = next;
      applyDemoFrame(false);
      demoAutoplay();
    }, delay);
  }
  function recRelIssueDemoStart(id) {    var q = issueById(id);
    if (!q) return;
    if (relIssueDemo.timer) { clearTimeout(relIssueDemo.timer); relIssueDemo.timer = 0; }
    relIssueOpen = true;
    relIssueSelId = id;
    relIssueDemo.on = true;
    relIssueDemo.id = id;
    relIssueDemo.frame = 0;
    relIssueDemo.sub = -1;
    relIssueCardHidden = false;
    renderIssuePanel();
    applyDemoFrame(true);
    updateFootTip();
    toast('演示：' + q.title + '（共 ' + demoFrames(q).length + ' 步）· 点 » 逐步播放');
  }
  function recRelIssueDemoStop() { stopDemo(); }
  function recRelIssueDemoStep(d) {
    if (!relIssueDemo.on) return;
    var q = issueById(relIssueDemo.id);
    if (!q) return;
    if (relIssueDemo.timer) { clearTimeout(relIssueDemo.timer); relIssueDemo.timer = 0; }
    var subs = demoSubs(q);
    var max = subs.length - 1;
    relIssueDemo.sub = Math.max(-1, Math.min(max, relIssueDemo.sub + (d > 0 ? 1 : -1)));
    applyDemoFrame(false);
  }
  /* ---------- 第 60 轮：» 一次播完整步（含其全部子步）；子步数字可点，点了才逐个跳 ---------- */
  function demoFrameRange(q, frameIdx) {
    var subs = demoSubs(q), first = -1, last = -1;
    subs.forEach(function (r, i) {
      if (r.frame !== frameIdx) return;
      if (first < 0) first = i;
      last = i;
    });
    return { subs: subs, first: first, last: last };
  }
  // 从当前子步继续，按时间轴自动播到 lastSub（含）
  function demoPlayUntil(lastSub) {
    if (!relIssueDemo.on) return;
    var q = issueById(relIssueDemo.id);
    if (!q) return;
    var subs = demoSubs(q);
    if (lastSub < 0 || lastSub >= subs.length || relIssueDemo.sub >= lastSub) {
      relIssueDemo.timer = 0;
      return;
    }
    var next = relIssueDemo.sub + 1;
    var prevStart = relIssueDemo.sub >= 0 ? subs[relIssueDemo.sub].start : 0;
    var delay = Math.max(0, subs[next].start - prevStart) * 1000;
    relIssueDemo.timer = setTimeout(function () {
      if (!relIssueDemo.on) return;
      relIssueDemo.sub = next;
      applyDemoFrame(false);
      if (next < lastSub) demoPlayUntil(lastSub);
      else relIssueDemo.timer = 0;
    }, delay);
  }
  function recRelIssueDemoNextStep() {
    if (!relIssueDemo.on) return;
    var q = issueById(relIssueDemo.id);
    if (!q) return;
    if (relIssueDemo.timer) { clearTimeout(relIssueDemo.timer); relIssueDemo.timer = 0; }
    var frames = demoFrames(q);
    var subs = demoSubs(q);
    var cur = (relIssueDemo.sub >= 0 && relIssueDemo.sub < subs.length) ? subs[relIssueDemo.sub].frame : -1;
    var range = cur >= 0 ? demoFrameRange(q, cur) : null;
    // 当前步还没播完：先把本步剩余子步播完
    if (range && relIssueDemo.sub < range.last) { demoPlayUntil(range.last); return; }
    var target = cur + 1;
    if (target >= frames.length) return;
    var t = demoFrameRange(q, target);
    if (t.first < 0) return;
    if (t.first === t.last) { relIssueDemo.sub = t.last; applyDemoFrame(false); return; }
    demoPlayUntil(t.last);
  }
  function recRelIssueDemoPrevStep() {
    if (!relIssueDemo.on) return;
    var q = issueById(relIssueDemo.id);
    if (!q) return;
    if (relIssueDemo.timer) { clearTimeout(relIssueDemo.timer); relIssueDemo.timer = 0; }
    var subs = demoSubs(q);
    var cur = (relIssueDemo.sub >= 0 && relIssueDemo.sub < subs.length) ? subs[relIssueDemo.sub].frame : -1;
    if (cur < 0) return;
    var range = demoFrameRange(q, cur);
    // 本步播到一半：先回到本步起点；已在起点则退到上一步末尾
    if (range.first >= 0 && relIssueDemo.sub > range.first) {
      relIssueDemo.sub = range.first;
      applyDemoFrame(false);
      return;
    }
    var prev = cur - 1;
    if (prev < 0) { relIssueDemo.sub = -1; applyDemoFrame(false); return; }
    var pr = demoFrameRange(q, prev);
    relIssueDemo.sub = pr.last >= 0 ? pr.last : -1;
    applyDemoFrame(false);
  }
  // 点「2/5」：每次前进一个子步（旧行为），用于手工逐子步核对
  function recRelIssueDemoSubStep(d) {
    recRelIssueDemoStep(d > 0 ? 1 : -1);
  }
  // 自动：从第 0 步开始连续播一次（再点一次可中止）
  function recRelIssueDemoAuto() {
    if (!relIssueDemo.on) return;
    if (relIssueDemo.timer) {
      clearTimeout(relIssueDemo.timer);
      relIssueDemo.timer = 0;
      return;
    }
    var q = issueById(relIssueDemo.id);
    if (!q) return;
    if (relIssueDemo.sub < 0 || relIssueDemo.sub >= demoSubs(q).length - 1) {
      relIssueDemo.sub = -1;
      relIssueDemo.frame = 0;
      applyDemoFrame(true);
    }
    demoAutoplay();
  }
  function recRelIssueDemoReplay() { recRelIssueDemoAuto(); }

  window.recRelPageToggle = recRelPageToggle;
  window.recRelAnalysisToggle = recRelPageToggle;
  window.recRelIssueSelect = recRelIssueSelect;
  window.recRelIssueEdit = recRelIssueEdit;
  window.recRelIssueBack = recRelIssueBack;
  window.recRelIssueNew = recRelIssueNew;
  window.recRelIssueRemove = recRelIssueRemove;
  window.recRelIssueDragStart = recRelIssueDragStart;
  window.recRelIssueDragOver = recRelIssueDragOver;
  window.recRelIssueDragEnd = recRelIssueDragEnd;
  window.recRelIssueDrop = recRelIssueDrop;
  window.recRelIssueDemoStart = recRelIssueDemoStart;
  window.recRelIssueDemoStop = recRelIssueDemoStop;
  window.recRelIssueDemoStep = recRelIssueDemoStep;
  window.recRelIssueDemoNextStep = recRelIssueDemoNextStep;
  window.recRelIssueDemoPrevStep = recRelIssueDemoPrevStep;
  window.recRelIssueDemoSubStep = recRelIssueDemoSubStep;
  window.recRelIssueDemoReplay = recRelIssueDemoReplay;
  window.recRelIssueDemoAuto = recRelIssueDemoAuto;
window.recRelIssueCardHide = recRelIssueCardHide;
window.recRelIssueCardToggle = recRelIssueCardToggle;

  window.recRelIssueTitle = recRelIssueTitle;
  window.recRelIssueDesc = recRelIssueDesc;
  window.recRelIssuePerson = recRelIssuePerson;
  window.recRelIssueFx = recRelIssueFx;
  window.recRelIssueFxDraft = recRelIssueFxDraft;
  window.recRelIssueFxStep = recRelIssueFxStep;
  window.recRelIssueFxNumRestore = recRelIssueFxNumRestore;
  window.hideTip = hideTip;
  window.showTip = showTip;
  window.recRelIssueStepDragStart = recRelIssueStepDragStart;
  window.recRelIssueStepDragOver = recRelIssueStepDragOver;
  window.recRelIssueStepDragEnd = recRelIssueStepDragEnd;
  window.recRelIssueStepDrop = recRelIssueStepDrop;
  window.recRelIssueStepOpen = recRelIssueStepOpen;
  window.recRelIssueStepClick = recRelIssueStepClick;
  window.recRelIssueGrpToggle = recRelIssueGrpToggle;
  window.recRelIssueStepMerge = recRelIssueStepMerge;
  window.recRelIssueStepUnmerge = recRelIssueStepUnmerge;
  window.recRelIssueSec = recRelIssueSec;
window.recRelIssueStepMode = recRelIssueStepMode;
window.recRelIssueScriptInput = recRelIssueScriptInput;
window.recRelScriptModalOpen = recRelScriptModalOpen;
window.recRelScriptModalInput = recRelScriptModalInput;
window.recRelScriptModalScroll = recRelScriptModalScroll;
window.recRelScriptModalApply = recRelScriptModalApply;
window.recRelScriptModalReset = recRelScriptModalReset;
window.recRelScriptModalClose = recRelScriptModalClose;
window.recRelIssueScriptScroll = recRelIssueScriptScroll;
window.recRelIssueScriptBlur = recRelIssueScriptBlur;
window.recRelIssueScriptApply = recRelIssueScriptApply;
window.recRelIssueScriptReset = recRelIssueScriptReset;
  window.recRelIssueNoteToggle = recRelIssueNoteToggle;
  window.recRelIssueNoteEdit = recRelIssueNoteEdit;
  window.recRelIssueNoteHover = recRelIssueNoteHover;
  window.recRelNoteClose = recRelNoteClose;
  window.recRelNoteSave = recRelNoteSave;
  window.recRelIssueBreath = recRelIssueBreath;
  window.recRelIssuePColor = recRelIssuePColor;
window.recRelIssueColor = recRelIssueColor;
window.recRelIssueGrpPreview = recRelIssueGrpPreview;
  window.recRelIssueTiming = recRelIssueTiming;
  window.recRelIssueDur = recRelIssueDur;
  window.recRelIssueStepMenu = recRelIssueStepMenu;
  window.recRelStepAddMenu = recRelStepAddMenu;
  window.recRelIssueStepMove = recRelIssueStepMove;
  window.recRelIssueStepDel = recRelIssueStepDel;

  function renderAll() {
    bindViewport();
    bindList();
    bindModals();
    bindDragTargets();
    renderList();
    renderGraph();
    renderIssuePanel();
    renderIssueCard();
  }

  function themeSaveMeta() {
    window.relThemeName = relThemeName;
    window.relThemeFile = relThemeFile;
    try { localStorage.setItem(REL_THEME_KEY, JSON.stringify({ name: relThemeName, file: relThemeFile })); } catch (e) { }
  }
  function relApplyTheme(d, file) {
    relData = normalize(d);
    relThemeName = String(file || '').replace(/\.js$/i, '') || (d && typeof d.theme === 'string' && d.theme) || '';
    relThemeFile = file || '';
    themeSaveMeta();
    save();
    relSelId = '';
    relCardId = '';
    relEditingLink = '';
    relEditingCard = '';
    relColorFilter = '';
    dispPos = {};
    if (typeof window.__ftRefreshTheme === 'function') window.__ftRefreshTheme();
    renderAll();
  }
  function relGetThemeData() {
    return {
      theme: relThemeName || '未命名人物关系',
      people: relData.people,
      links: relData.links,
      issues: issueList()
    };
  }
  function relSafeName(n) {
    return String(n || '').replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '').trim() || '未命名人物关系';
  }
  function relDownloadJs(fileName, content) {
    var blob = new Blob([content], { type: 'text/javascript;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 400);
  }
  function relSaveThemeJs() {
    if (!relThemeName) {
      var nm = window.prompt('请输入人物关系主题名称', '人物关系主题');
      if (nm === null) return;
      relThemeName = String(nm).trim() || '人物关系主题';
    }
    var fileName = relSafeName(relThemeName) + '.js';
    themeSaveMeta();
    var payload = relGetThemeData();
    var content = '// 多维分析 · 人物关系主题\n// 主题：' + relThemeName + '\n\nDaRegisterRelation(' +
      JSON.stringify(payload, null, 2) + ');\n';
    if (typeof recDataApi === 'function' && typeof recDataDiskPath === 'function') {
      recDataApi('write', { path: recDataDiskPath('rel', fileName), content: content }).then(function (res) {
        if (res && res.ok !== false) {
          relThemeFile = fileName;
          themeSaveMeta();
          toast('保存成功：' + fileName);
          if (typeof recDataRefreshAfterWrite === 'function') recDataRefreshAfterWrite();
          if (typeof window.__ftRefreshTheme === 'function') window.__ftRefreshTheme();
          return;
        }
        // 写盘失败：先落缓存，再让用户选择文件覆盖保存
        save();
        var why = (res && res.error) ? res.error : '本地服务未连接';
        toast('未能写入文件（' + why + '），已保存到缓存，请选择文件覆盖保存');
        if (typeof recSaveContentToPickedFile === 'function') recSaveContentToPickedFile(content, fileName, 'rel');
        else relDownloadJs(fileName, content);
      });
    } else {
      relDownloadJs(fileName, content);
      toast('已下载 ' + fileName + '，请放入「数据/人物关系」并在该文件夹 index.js 中登记');
    }
  }

  function recRelToggleMenu(ev) {
    if (ev) { ev.stopPropagation(); }
    var m = document.getElementById('relMoreMenu');
    if (m) m.classList.toggle('hidden');
  }
  function recRelHideMenu() {
    var m = document.getElementById('relMoreMenu');
    if (m) m.classList.add('hidden');
  }
  function relMenuDownload(fileName, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 400);
  }
  function relCsvCell(v) {
    var s = String(v == null ? '' : v);
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function relExportCsv() {
    recRelHideMenu();
    var head = ['姓名', '单位职务', '颜色', '其他信息'];
    var rows = relData.people.map(function (p) {
      return [p.name, p.org, COLOR_NAMES[colorKeyOf(p)] || '', (p.info || []).join(' / ')].map(relCsvCell).join(',');
    });
    var csv = '\ufeff' + head.join(',') + '\r\n' + rows.join('\r\n') + '\r\n';
    relMenuDownload(relSafeName(relThemeName || '人员列表') + '.csv', csv, 'text/csv;charset=utf-8');
    toast('已导出 CSV（不含照片）');
  }
  function relExportJs() {
    recRelHideMenu();
    var payload = { theme: relThemeName || '未命名人物关系', people: relData.people, links: relData.links };
    var content = '// 多维分析 · 人员列表导出（含照片）\n// 主题：' + (relThemeName || '') + '\n\nDaRegisterRelation(' +
      JSON.stringify(payload, null, 2) + ');\n';
    relMenuDownload(relSafeName(relThemeName || '人员列表') + '.js', content, 'text/javascript;charset=utf-8');
    toast('已导出 JS（含照片）');
  }
  function recRelImportCsv() {
    recRelHideMenu();
    var input = document.getElementById('relCsvInput');
    if (input) input.click();
  }
  function recRelImportJs() {
    recRelHideMenu();
    var input = document.getElementById('relJsInput');
    if (input) input.click();
  }
  function relParseCsv(text) {
    text = String(text || '').replace(/^\ufeff/, '');
    var rows = [], row = [], cell = '', inQ = false, i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        cell += ch; i++; continue;
      }
      if (ch === '"') { inQ = true; i++; continue; }
      if (ch === ',') { row.push(cell); cell = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
      cell += ch; i++;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function relColorKeyByName(name) {
    var n = String(name || '').trim();
    for (var i = 0; i < COLOR_KEYS.length; i++) if (COLOR_NAMES[COLOR_KEYS[i]] === n) return COLOR_KEYS[i];
    return '';
  }
  function relImportCsvText(text) {
    var rows = relParseCsv(text).filter(function (r) { return r.length && !r.every(function (c) { return !String(c).trim(); }); });
    if (!rows.length) { toast('CSV 内容为空'); return; }
    var start = 0;
    var first = rows[0].join('|');
    if (first.indexOf('姓名') >= 0 || first.indexOf('单位职务') >= 0 || first.indexOf('单位/职务') >= 0) start = 1;
    var people = [];
    for (var r = start; r < rows.length; r++) {
      var c = rows[r];
      var name = String(c[0] == null ? '' : c[0]).trim();
      if (!name) continue;
      var org = String(c[1] == null ? '' : c[1]).trim();
      var color = relColorKeyByName(c[2]) || COLOR_KEYS[people.length % COLOR_KEYS.length];
      var info = String(c[3] == null ? '' : c[3]).split(/\s*[\/｜|]\s*|\r?\n/).map(function (s) { return s.trim(); }).filter(function (s) { return s; });
      people.push({ id: newId('p'), name: name, org: org, info: info, color: color, photo: '', x: null, y: null });
    }
    if (!people.length) { toast('未解析到人员数据'); return; }
    if (!window.confirm('将用导入的 ' + people.length + ' 名人员替换当前列表（含照片，照片不会从 CSV 恢复），是否继续？')) return;
    relData.people = people;
    relData.links = [];
    relSelId = ''; relCardId = ''; relEditingLink = ''; relEditingCard = ''; relColorFilter = ''; dispPos = {};
    save();
    renderAll();
    toast('已导入 ' + people.length + ' 名人员');
  }
  function relImportJsText(text) {
    var data = null;
    var m = String(text || '').match(/DaRegisterRelation\s*\(([\s\S]*)\)\s*;?\s*$/);
    var jsonStr = m ? m[1] : text;
    try { data = JSON.parse(jsonStr); } catch (e) { data = null; }
    if (!data || !Array.isArray(data.people)) { toast('无法解析该 JS 文件'); return; }
    var d = normalize(data);
    if (!d.people.length) { toast('该文件不含人员数据'); return; }
    if (!window.confirm('将用导入的 ' + d.people.length + ' 名人员替换当前列表（含照片与关系），是否继续？')) return;
    relData = d;
    if (data.theme && typeof data.theme === 'string') { relThemeName = data.theme; themeSaveMeta(); }
    relSelId = ''; relCardId = ''; relEditingLink = ''; relEditingCard = ''; relColorFilter = ''; dispPos = {};
    save();
    if (typeof window.__ftRefreshTheme === 'function') window.__ftRefreshTheme();
    renderAll();
    toast('已导入 ' + d.people.length + ' 名人员');
  }
  function relReadFile(input, cb) {
    var f = input && input.files && input.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () { cb(String(reader.result || '')); };
    reader.onerror = function () { toast('读取文件失败'); };
    reader.readAsText(f, 'utf-8');
    input.value = '';
  }

  function relRenameTheme(n) {
    var v = String(n == null ? '' : n).trim();
    if (!v) return;
    relThemeName = v;
    themeSaveMeta();
    if (typeof window.__ftRefreshTheme === 'function') window.__ftRefreshTheme();
  }

  window.relThemeName = relThemeName;
  window.relRenameTheme = relRenameTheme;
  window.relApplyTheme = relApplyTheme;
  window.relGetThemeData = relGetThemeData;
  window.relSaveThemeJs = relSaveThemeJs;
  window.recRenderRelation = renderAll;
  window.recRelAddPerson = addPerson;
  window.recRelEditInfo = openInfo;
  window.recRelInfoClose = closeInfo;
  window.recRelInfoSave = saveInfo;
  window.recRelPickPhoto = pickPhoto;
  window.recRelFocusPhoto = focusPhoto;
  window.recRelClearPhoto = clearPhoto;
  window.recRelShowCard = showCard;
  window.recRelCardClose = closeCard;
  window.recRelCardEdit = function () {
    var id = relCardId;
    closeCard();
    if (id) openInfo(id);
  };
  window.recRelToggleMenu = recRelToggleMenu;
  window.recRelExportCsv = relExportCsv;
  window.recRelImportCsv = recRelImportCsv;
  window.recRelExportJs = relExportJs;
  window.recRelImportJs = recRelImportJs;
  window.recRelZoom = zoomBy;
  window.recRelShot = takeShot;
  window.recRelToggleFull = toggleFull;
  window.recRelCenterView = function () {
    relPan = { x: 0, y: 0 };
    saveView();
    applyView();
    applyPositions();
    toast('画布已回到原点');
  };
  window.recRelOpenPairLink = openPairLink;
  window.recRelClearPick = clearPick;
  window.recRelInfoAddLink = openInfoAddLink;
  window.recRelLinkClose = function () { closeLinkModal(false); };
  window.recRelLinkDir = recRelLinkDir;
  window.recRelLinkSave = saveLinkModal;
  window.recRelSyncLinkPair = recRelSyncLinkPair;
  window.recRelLinkHint = recRelLinkHint;

  function bindViewport() {
    if (document.documentElement.getAttribute('data-rel-viewport')) return;
    document.documentElement.setAttribute('data-rel-viewport', '1');
    window.addEventListener('resize', function () {
      var panel = document.getElementById('recRelationPanel');
      if (!panel || panel.classList.contains('hidden')) return;
      applyView();
    });
  }

  // ====== 窗口输入：批量粘贴多人信息 ======
  var REL_BATCH_SAMPLE = '【姓名】张三【单位/职务】某某局 副局长【其他信息】负责项目审批。\n长期分管基建口。\n' +
    '【姓名】李四【单位/职务】某某公司 总经理【其他信息】与张三在 2019 年有业务往来。\n' +
    '【姓名】王五【单位/职务】某某局 科员';

  function relBatchOpen() {
    var pane = document.getElementById('relBatchPane');
    var body = document.getElementById('relInfoBody');
    var grid = body ? body.querySelector('.rel-info-grid') : null;
    var footN = document.getElementById('relInfoFootNormal');
    var footB = document.getElementById('relBatchFoot');
    var btn = document.getElementById('relBatchBtn');
    if (!pane || !grid) return;
    grid.style.display = 'none';
    pane.style.display = 'flex';
    if (footN) footN.style.display = 'none';
    if (footB) footB.style.display = 'flex';
    if (btn) btn.classList.add('active');
    var title = document.querySelector('#relInfoModal .m-title');
    if (title) title.textContent = '窗口输入（批量添加人员）';
    var ta = document.getElementById('relBatchText');
    if (ta && !ta.value.trim()) ta.value = REL_BATCH_SAMPLE;
    relBatchPreview();
    if (ta) { ta.focus(); ta.setSelectionRange(0, 0); }
  }

  function relBatchClose() {
    var pane = document.getElementById('relBatchPane');
    var body = document.getElementById('relInfoBody');
    var grid = body ? body.querySelector('.rel-info-grid') : null;
    var footN = document.getElementById('relInfoFootNormal');
    var footB = document.getElementById('relBatchFoot');
    var btn = document.getElementById('relBatchBtn');
    if (pane) pane.style.display = 'none';
    if (grid) grid.style.display = '';
    if (footN) footN.style.display = '';
    if (footB) footB.style.display = 'none';
    if (btn) btn.classList.remove('active');
    var title2 = document.querySelector('#relInfoModal .m-title');
    if (title2) title2.textContent = '编辑人员信息';
  }

  function relBatchToggle() {
    var pane = document.getElementById('relBatchPane');
    if (pane && pane.style.display !== 'none') relBatchClose();
    else relBatchOpen();
  }

  // 解析：以【姓名】/【单位/职务】/【其他信息】为分段标记，允许任意空白与换行
  function parseBatchPeople(text) {
    var raw = String(text || '').replace(/\r\n?/g, '\n');
    var marks = [
      { key: 'name', re: /【\s*姓\s*名\s*】/g },
      { key: 'org', re: /【\s*单\s*位\s*[\/／]?\s*职\s*务\s*】/g },
      { key: 'info', re: /【\s*其\s*他\s*信\s*息\s*】/g }
    ];
    var hits = [];
    marks.forEach(function (m) {
      var mt;
      m.re.lastIndex = 0;
      while ((mt = m.re.exec(raw)) !== null) {
        hits.push({ key: m.key, start: mt.index, end: mt.index + mt[0].length });
      }
    });
    hits.sort(function (a, b) { return a.start - b.start; });
    if (!hits.length) {
      // 没写标记：按空行分段，每段首行当姓名、次行当作单位、其余当其他信息
      return raw.split(/\n\s*\n+/).map(function (blk) {
        var lines = blk.split('\n').map(function (t) { return t.trim(); }).filter(Boolean);
        if (!lines.length) return null;
        return { name: lines[0], org: lines[1] || '', info: lines.slice(2) };
      }).filter(Boolean);
    }
    var out = [];
    var cur = null;
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      var next = hits[i + 1];
      var val = raw.slice(h.end, next ? next.start : raw.length);
      if (h.key === 'name') {
        if (cur) out.push(cur);
        cur = { name: '', org: '', info: [] };
        cur.name = val.replace(/\s+/g, ' ').trim();
      } else if (!cur) {
        // 缺【姓名】的开头字段直接忽略
        continue;
      } else if (h.key === 'org') {
        cur.org = val.replace(/\s+/g, ' ').trim();
      } else {
        cur.info = val.split('\n').map(function (t) { return t.trim(); }).filter(Boolean);
      }
    }
    if (cur) out.push(cur);
    return out.filter(function (p) { return p.name; });
  }

  function relBatchParse() {
    var ta = document.getElementById('relBatchText');
    return parseBatchPeople(ta ? ta.value : '');
  }

  function relBatchPreview() {
    var list = document.getElementById('relBatchList');
    var cnt = document.getElementById('relBatchCount');
    if (!list) return;
    var people = relBatchParse();
    if (cnt) cnt.textContent = people.length + ' 人';
    if (!people.length) {
      list.innerHTML = '<div class="rel-batch-empty">左侧输入或粘贴人员信息后，这里会自动整理成人员卡片<br>' +
        '格式：【姓名】××【单位/职务】××××【其他信息】××××</div>';
      return;
    }
    var exists = {};
    relData.people.forEach(function (p) { exists[(p.name || '').trim()] = true; });
    var seen = {};
    list.innerHTML = people.map(function (p) {
      var dup = !!exists[p.name] || !!seen[p.name];
      seen[p.name] = true;
      return '<div class="rel-batch-card' + (dup ? ' dup' : '') + '">' +
        '<div class="rel-batch-card-head">' +
        '<span class="rel-batch-name">' + esc(p.name) + '</span>' +
        '<span class="rel-batch-org">' + esc(p.org || '未填写单位 / 职务') + '</span>' +
        (dup ? '<span class="rel-batch-tag">重名</span>' : '') +
        '</div>' +
        (p.info.length ? '<div class="rel-batch-info">' + esc(p.info.join('\n')) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  function relBatchSample() {
    var ta = document.getElementById('relBatchText');
    if (!ta) return;
    ta.value = REL_BATCH_SAMPLE;
    relBatchPreview();
    ta.focus();
  }

  function recRelLinkHint() {
    recRelLinkDir(currentLinkDir());
  }

  function recRelSyncLinkPair() {
    syncLinkPairFromInputs();
  }

  function relBatchCommit() {
    var people = relBatchParse();
    if (!people.length) { toast('没有识别到人员，请按【姓名】…格式填写'); return; }
    var seed = '';
    if (relMultiPick) {
      var set = pickColorSet();
      if (set.length === 1) seed = set[0];
    } else if (relColorFilter) {
      seed = relColorFilter;
    }
    // 「＋新增」会先建一个空白占位人员；用户改用批量录入时把它清掉，
    // 否则列表里会多出一个「新人员N」。
    if (relModalId) {
      var placeholder = personById(relModalId);
      var hasLink = relData.links.some(function (l) { return l.from === relModalId || l.to === relModalId; });
      if (placeholder && !hasLink &&
        !(placeholder.org || '').trim() &&
        !(placeholder.info && placeholder.info.length) &&
        !(placeholder.photo || '') &&
        /^新人员\d+$/.test((placeholder.name || '').trim())) {
        relData.people = relData.people.filter(function (p) { return p.id !== relModalId; });
      }
    }
    var base = relData.people.length;
    var added = 0;
    people.forEach(function (bp, i) {
      relData.people.push({
        id: newId('p'),
        name: bp.name,
        org: bp.org || '',
        info: bp.info || [],
        color: seed || COLOR_KEYS[(base + i) % COLOR_KEYS.length],
        photo: '',
        x: null,
        y: null
      });
      added++;
    });
    save();
    renderList();
    renderGraph();
    var ta = document.getElementById('relBatchText');
    if (ta) ta.value = '';
    relBatchClose();
    closeInfo();
    toast('已加入 ' + added + ' 名人员');
  }

  window.recRelBatchToggle = relBatchToggle;
  window.recRelBatchSample = relBatchSample;
  window.recRelBatchPreview = relBatchPreview;
  window.recRelBatchCommit = relBatchCommit;

  function inject() {
    if (document.getElementById('recRelationPanel')) return;
    var mid = document.querySelector('.middle-area');
    if (!document.body || !mid) { document.addEventListener('DOMContentLoaded', inject); return; }
    if (!document.getElementById('relationStyle')) {
      var st = document.createElement('style');
      st.id = 'relationStyle';
      st.textContent = REL_CSS;
      document.head.appendChild(st);
    }
    var host = document.getElementById('tab-record');
    if (!host) { document.addEventListener('DOMContentLoaded', inject); return; }
    var tpl = document.createElement('div');
    tpl.innerHTML = REL_PANEL;
    host.appendChild(tpl.firstElementChild);
    var mw = document.createElement('div');
    mw.id = 'relationModals';
    mw.innerHTML = REL_MODALS;
    document.body.appendChild(mw);
    bindModals();
    bindDragTargets();
  }

  inject();

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var panel = document.getElementById('recRelationPanel');
      if (!panel || panel.classList.contains('hidden')) return;
      renderList();
      renderGraph();
      syncIssuePanelHost();
    }, 220);
  });
})();
