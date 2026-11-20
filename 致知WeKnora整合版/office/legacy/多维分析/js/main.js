/* ============================================================
   main.js — 多维分析 · 渲染与初始化
   记录模块（record.js）为唯一主体，本文件负责启动流程：
     加载缓存 → 渲染 → 绑定交互 → 默认打开「要事记录」
   ============================================================ */

function renderAll() {
  renderRecordModule();
}

function init() {
  // 1) 加载工作记录缓存（项目 / 类别 / 事件 / 态势选择）
  loadRecordData();

  // 2) 渲染
  renderAll();

  // 3) 记录面板作为唯一主体：置为激活（.main-content.active → display:flex）
  const tr = document.getElementById('tab-record');
  if (tr) tr.classList.add('active');

  // 4) 项目记录：左侧编辑区实时监听，内容变化即时刷新右侧时间轴
  const rpi = document.getElementById('recProjectInput');
  if (rpi) rpi.addEventListener('input', recProjectInputHandler);

  // 4.1) 项目记录：粘贴自动格式化 / 日期链接右键菜单
  if (typeof recProjectBindPaste === 'function') recProjectBindPaste();
  if (typeof recAttachBindContext === 'function') recAttachBindContext();

  // 5) 总体进程：点击外部关闭「选择」下拉
  document.addEventListener('click', hideSituSelMenu);

  // 5.1) 自动保存缓存：定期（20s）/ 切到后台 / 关闭前
  if (typeof recAutoSave === 'function') {
    setInterval(function() { recAutoSave(true); }, 20000);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') recAutoSave(true);
    });
    window.addEventListener('pagehide', function() { recAutoSave(true); });
    window.addEventListener('beforeunload', function() { recAutoSave(true); });
  }

  // 6) 默认打开「数据管理」（第一个按钮）
  const first = document.querySelector('#opRecord .op-btn2[data-kind="datamanage"]');
  if (first) recBtn1Click(first, 'datamanage');

  // 7) 顶栏：检测本地桥接服务连接情况（每次打开检测一次）
  if (typeof recSvcStatusCheck === 'function') setTimeout(function() { recSvcStatusCheck(true); }, 0);
}

document.addEventListener('DOMContentLoaded', init);
