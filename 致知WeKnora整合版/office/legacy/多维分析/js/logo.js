/* ============================================================
   Logo 图标：单击切换浏览器全屏 / 退出全屏（真正的窗口全屏，无地址栏）。
     全屏后点击小程序图标会在页内「全屏运行层」打开，右下角「主页」返回切换。
   ============================================================ */
(function () {
  const logo = document.getElementById('appLogo');
  if (!logo) return;
  logo.style.cursor = 'pointer';
  logo.title = '单击进入 / 退出全屏';
  logo.addEventListener('click', function () {
    if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
      const ex = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (ex) ex.call(document);
      return;
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) {
      try { const r = req.call(el); if (r && r.catch) r.catch(function () {}); } catch (e) {}
    }
  });
})();

