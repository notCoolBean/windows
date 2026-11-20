/* ============================================================================
 * path-picker.js —— 文件 / 文件夹选择器（致知办公助手通用组件）
 *
 * 作用：在 HTML 小程序里放一个按钮，点击后弹出「系统文件/文件夹选择框」，
 *       选好后把绝对路径回填到输入框。借本机桥接服务（办公助手服务.py）实现，
 *       从而突破浏览器 file:// 无法取得真实路径的限制。
 *
 * 依赖：桥接服务在运行（默认 http://127.0.0.1:8737，可由 window.ZZ_BRIDGE.url
 *       或 localStorage['zz-bridge-url'] 覆盖）。
 *
 * 用法（二选一）：
 *   1) 只取路径：
 *        ZzPick.pick('file').then(r => { if (r.ok) console.log(r.path); });
 *        ZzPick.pick('dir', { title: '请选择文件夹' });
 *   2) 绑定按钮 + 回填输入框（推荐）：
 *        ZzPick.attach('#btnPickFile', { mode: 'file',  input: '#fPath' });
 *        ZzPick.attach(document.getElementById('btnPickFolder'), { mode: 'dir', input: fields.path });
 *
 * 说明：优先调用系统原生选择框（zenity/kdialog/qarma、Windows 系统对话框）；
 *       若系统缺少图形选择工具，则自动回退为「页面内文件浏览器」（用 /api/ls 列目录）。
 * ==========================================================================*/
(function () {
  'use strict';

  var BRIDGE_DEFAULT = 'http://127.0.0.1:8737';
  var LAST_DIR_KEY = 'zz-pick-last-dir';

  function bridgeBase() {
    return (window.ZZ_BRIDGE && window.ZZ_BRIDGE.url) ||
      (function () { try { return localStorage.getItem('zz-bridge-url'); } catch (e) { return null; } })() ||
      BRIDGE_DEFAULT;
  }

  function _(sel) {
    if (!sel) return null;
    if (typeof sel === 'string') {
      if (sel.charAt(0) === '#' || /^[a-z]+[.#\[]/i.test(sel)) return document.querySelector(sel);
      var byId = document.getElementById(sel);
      return byId || document.querySelector(sel);
    }
    return sel;
  }

  function postJSON(path, body) {
    return fetch(bridgeBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }

  /* ---------------- 原生系统选择框 ---------------- */
  function pickNative(mode, title) {
    return postJSON('/api/pick-folder', { title: title, mode: mode });
  }

  function isCancel(err) { return /已取消|未选择|取消/.test(String(err || '')); }

  /* ---------------- 页面内文件浏览器（回退） ---------------- */
  var CSS = [
    '.zzpick-overlay{position:fixed;inset:0;z-index:99999;background:rgba(6,10,20,.5);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);}',
    '.zzpick{width:560px;max-width:94vw;max-height:80vh;display:flex;flex-direction:column;background:#0f172a;color:#e6edf7;border:1px solid rgba(120,170,255,.28);border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.55);overflow:hidden;font:13.5px/1.5 "Microsoft YaHei","PingFang SC",system-ui,sans-serif;}',
    '.zzpick-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(120,170,255,.16);}',
    '.zzpick-title{font-weight:600;font-size:14px;}',
    '.zzpick-close{margin-left:auto;width:28px;height:28px;border:0;border-radius:8px;background:rgba(255,255,255,.06);color:#cfe0ff;font-size:18px;line-height:1;cursor:pointer;}',
    '.zzpick-close:hover{background:rgba(255,255,255,.14);}',
    '.zzpick-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;}',
    '.zzpick-bar button{height:30px;padding:0 10px;border:1px solid rgba(120,170,255,.28);border-radius:8px;background:rgba(120,170,255,.1);color:#cfe0ff;font-size:12.5px;cursor:pointer;}',
    '.zzpick-bar button:hover{background:rgba(120,170,255,.22);}',
    '.zzpick-path{flex:1;min-width:0;height:30px;padding:0 10px;border:1px solid rgba(120,170,255,.18);border-radius:8px;background:rgba(0,0,0,.28);color:#9fb6d8;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.zzpick-list{flex:1;min-height:180px;overflow:auto;padding:4px 8px 8px;}',
    '.zzpick-row{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:8px;cursor:pointer;user-select:none;}',
    '.zzpick-row:hover{background:rgba(120,170,255,.14);}',
    '.zzpick-ic{width:16px;height:16px;flex:0 0 16px;background-size:contain;background-repeat:no-repeat;background-position:center;}',
    '.zzpick-ic.dir{background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23f0b429\' d=\'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\'/%3E%3C/svg%3E");}',
    '.zzpick-ic.file{background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%2360a5fa\' d=\'M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z\'/%3E%3C/svg%3E");}',
    '.zzpick-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.zzpick-row.picked{background:rgba(59,130,246,.28);}',
    '.zzpick-row .zzpick-check{width:15px;height:15px;flex:0 0 15px;border:1px solid rgba(160,190,240,.55);border-radius:4px;background:rgba(0,0,0,.25);}',
    '.zzpick-row.picked .zzpick-check{background:#3b82f6;border-color:#3b82f6;box-shadow:inset 0 0 0 2px rgba(255,255,255,.85);}',
    '.zzpick-row .zzpick-enter{font-size:11.5px;color:#8fb4ff;padding:1px 6px;border-radius:6px;background:rgba(120,170,255,.12);}',
    '.zzpick-row .zzpick-enter:hover{background:rgba(120,170,255,.3);}',
    '.zzpick-row .tag{font-size:11px;color:#8aa2c6;}',
    '.zzpick-empty{padding:24px 12px;text-align:center;color:#8aa2c6;}',
    '.zzpick-fail{padding:20px 14px;color:#ff9a9a;word-break:break-all;}',
    '.zzpick-foot{display:flex;gap:10px;justify-content:flex-end;padding:12px 14px;border-top:1px solid rgba(120,170,255,.16);}',
    '.zzpick-foot button{height:34px;padding:0 16px;border-radius:9px;border:1px solid rgba(120,170,255,.28);background:rgba(255,255,255,.05);color:#dbe7f8;font-size:13px;cursor:pointer;}',
    '.zzpick-foot .primary{background:linear-gradient(180deg,#3b82f6,#2563eb);border-color:transparent;color:#fff;font-weight:600;}',
    '.zzpick-foot button:hover{filter:brightness(1.08);}'
  ].join('');

  function ensureStyle() {
    if (document.getElementById('zzpick-style')) return;
    var s = document.createElement('style');
    s.id = 'zzpick-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function joinPath(dir, name) {
    var sep = /\\/.test(dir) ? '\\' : '/';
    return String(dir).replace(/[\\/]+$/, '') + sep + name;
  }
  function parentOf(p) {
    var s = String(p).replace(/[\\/]+$/, '');
    if (!s || s === '/') return '/';                 /* 已在根目录 */
    if (/^[A-Za-z]:$/.test(s)) return s + '\\';      /* "C:" -> "C:\" */
    var m = s.match(/^(.*)[\\/][^\\/]+$/);
    if (!m) return s;
    var up = m[1];
    if (!up) return '/';                             /* "/home" -> "/" */
    if (/^[A-Za-z]:$/.test(up)) return up + '\\';    /* "D:\xxx" -> "D:\" */
    return up;
  }
  function dirOfPath(p) {
    var s = String(p).replace(/^["'\u201c\u201d\u2018\u2019]+|["'\u201c\u201d\u2018\u2019]+$/g, '').trim().replace(/[\\/]+$/, '');
    if (!s) return '';
    if (/^[A-Za-z]:$/.test(s)) return s;
    var m = s.match(/^(.*)[\\/][^\\/]+$/);
    if (!m) return '';
    return m[1] || (s.indexOf('\\') >= 0 ? s.slice(0, 2) : '/');
  }

  function getLastDir() {
    try { return localStorage.getItem(LAST_DIR_KEY) || ''; } catch (e) { return ''; }
  }
  function setLastDir(p) {
    try { localStorage.setItem(LAST_DIR_KEY, p); } catch (e) {}
  }

  function ls(path) {
    return fetch(bridgeBase() + '/api/ls?path=' + encodeURIComponent(path), { cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (t) {
          try { return JSON.parse(t); }
          catch (e) { throw new Error('返回内容不是有效 JSON（HTTP ' + r.status + '）'); }
        });
      });
  }

  /* 打开页面内浏览器；返回 Promise<{ok, path} | {ok:false, cancelled} | {ok:false, error}> */
  function browse(mode, opts) {
    opts = opts || {};
    var multi = !!opts.multiple;
    return new Promise(function (resolve) {
      ensureStyle();
      var start = opts.start || getLastDir() || (opts.input ? dirOfPath(_(opts.input) && _(opts.input).value) : '') || '~';
      var cur = start;
      var done = false;
      var selected = {};

      var overlay = document.createElement('div');
      overlay.className = 'zzpick-overlay';
      overlay.innerHTML =
        '<div class="zzpick">' +
          '<div class="zzpick-head"><span class="zzpick-title"></span>' +
            '<button type="button" class="zzpick-close" aria-label="关闭">×</button></div>' +
          '<div class="zzpick-bar">' +
            '<button type="button" class="zzpick-up">⬆ 上级</button>' +
            '<button type="button" class="zzpick-home">🏠 主目录</button>' +
            '<div class="zzpick-path"></div>' +
          '</div>' +
          '<div class="zzpick-list"></div>' +
          '<div class="zzpick-foot">' +
            (multi ? '<button type="button" class="zzpick-ok primary">确定（已选 0 项）</button>' : '') +
            (mode === 'dir' && !multi ? '<button type="button" class="zzpick-ok primary">选择当前文件夹</button>' : '') +
            '<button type="button" class="zzpick-cancel">取消</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      var listEl = overlay.querySelector('.zzpick-list');
      var pathEl = overlay.querySelector('.zzpick-path');
      var okBtn = overlay.querySelector('.zzpick-ok');
      overlay.querySelector('.zzpick-title').textContent =
        opts.title || (mode === 'file' ? '请选择文件' : '请选择文件夹');

      function selectedPaths() {
        return Object.keys(selected).filter(function (k) { return selected[k]; });
      }
      function syncOk() {
        if (!okBtn || !multi) return;
        okBtn.textContent = '确定（已选 ' + selectedPaths().length + ' 项）';
      }
      function finish(res) {
        if (done) return;
        done = true;
        document.removeEventListener('keydown', onKey);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (res && res.ok && (res.path || (res.paths && res.paths.length))) {
          setLastDir(dirOfPath(res.path || res.paths[0]) || res.path || res.paths[0]);
        }
        resolve(res);
      }
      function onKey(e) { if (e.key === 'Escape') finish({ ok: false, cancelled: true }); }
      document.addEventListener('keydown', onKey);

      overlay.querySelector('.zzpick-close').addEventListener('click', function () { finish({ ok: false, cancelled: true }); });
      overlay.querySelector('.zzpick-cancel').addEventListener('click', function () { finish({ ok: false, cancelled: true }); });
      overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) finish({ ok: false, cancelled: true }); });
      if (okBtn) okBtn.addEventListener('click', function () {
        if (multi) {
          var paths = selectedPaths();
          if (!paths.length) return;
          finish({ ok: true, path: paths[0], paths: paths });
        } else {
          finish({ ok: true, path: cur });
        }
      });

      overlay.querySelector('.zzpick-up').addEventListener('click', function () {
        var up = parentOf(cur);
        if (up && up !== cur) load(up);
      });
      overlay.querySelector('.zzpick-home').addEventListener('click', function () { load('~'); });

      function render(data) {
        listEl.innerHTML = '';
        var entries = (data && data.entries) || [];
        if (!entries.length) {
          var e = document.createElement('div');
          e.className = 'zzpick-empty';
          e.textContent = '（此文件夹为空）';
          listEl.appendChild(e);
          return;
        }
        entries.forEach(function (en) {
          var isDir = en.type === 'dir';
          var row = document.createElement('div');
          row.className = 'zzpick-row';
          var ic = document.createElement('span');
          ic.className = 'zzpick-ic ' + (isDir ? 'dir' : 'file');
          var nm = document.createElement('span');
          nm.className = 'nm';
          nm.textContent = en.name;
          var full = joinPath(cur, en.name);
          if (multi) {
            var ck = document.createElement('span');
            ck.className = 'zzpick-check';
            row.appendChild(ck);
          }
          row.appendChild(ic);
          row.appendChild(nm);
          if (!isDir && en.ext) {
            var tg = document.createElement('span');
            tg.className = 'tag';
            tg.textContent = en.ext;
            row.appendChild(tg);
          }
          if (multi) {
            if (isDir) {
              var enter = document.createElement('span');
              enter.className = 'zzpick-enter';
              enter.textContent = '进入 ›';
              enter.addEventListener('click', function (ev) {
                ev.stopPropagation();
                load(full);
              });
              row.appendChild(enter);
            }
            row.classList.toggle('picked', !!selected[full]);
            row.addEventListener('click', function () {
              toggle(full, row);
            });
            nm.addEventListener('click', function (ev) {
              ev.stopPropagation();
              toggle(full, row);
            });
            ic.addEventListener('click', function (ev) {
              ev.stopPropagation();
              toggle(full, row);
            });
            if (isDir) row.title = '点名称选中该文件夹，点「进入 ›」浏览其中内容';
          } else {
            row.addEventListener('click', function () {
              if (isDir) { load(full); }
              else if (mode === 'file') { finish({ ok: true, path: full }); }
            });
          }
          listEl.appendChild(row);
        });
        if (data && data.truncated) {
          var t = document.createElement('div');
          t.className = 'zzpick-empty';
          t.textContent = '（项目过多，仅显示前 ' + entries.length + ' 项）';
          listEl.appendChild(t);
        }
        syncOk();
      }

      function toggle(full, row) {
        selected[full] = !selected[full];
        if (!selected[full]) delete selected[full];
        if (row) row.classList.toggle('picked', !!selected[full]);
        syncOk();
      }

      function showFail(p, msg) {
        pathEl.textContent = p;
        listEl.innerHTML = '';
        var f = document.createElement('div');
        f.className = 'zzpick-fail';
        f.textContent = msg;
        listEl.appendChild(f);
      }

      function load(p) {
        listEl.innerHTML = '<div class="zzpick-empty">读取中…</div>';
        ls(p).then(function (data) {
          if (!data || !data.ok) {
            showFail(p, '无法打开：' + ((data && data.error) || '未知错误'));
            return;
          }
          cur = data.path || p;
          pathEl.textContent = cur;
          pathEl.title = cur;
          try {
            render(data);
          } catch (e) {
            if (window.console && console.error) console.error('[ZzPick] 渲染目录失败:', p, e);
            showFail(cur, '显示内容出错：' + ((e && e.message) || e));
          }
        }).catch(function (err) {
          if (window.console && console.warn) console.warn('[ZzPick] /api/ls 请求失败:', p, err);
          showFail(p, '未连接桥接服务（请先启动办公助手，再重试）' +
            ((err && err.message) ? '　' + err.message : ''));
        });
      }

      load(cur);
    });
  }

  /* ---------------- 对外主入口 ---------------- */
  function pick(mode, opts) {
    opts = opts || {};
    mode = (mode === 'file') ? 'file' : 'dir';
    var title = opts.title || (mode === 'file' ? '请选择文件' : '请选择文件夹');
    if (opts.multiple) {
      /* 桥接服务的原生选择框一次只返回一个路径，多选走页面内浏览器 */
      return browse(mode, opts);
    }
    return pickNative(mode, title).then(function (res) {
      if (res && res.ok && res.path) return { ok: true, path: res.path };
      if (res && isCancel(res.error)) return { ok: false, cancelled: true, error: res.error };
      /* 系统无图形选择工具 / 其它失败 -> 回退页面内浏览器 */
      return browse(mode, opts);
    }).catch(function () {
      /* 桥接不可达：仍尝试页面内浏览器（会给出明确提示） */
      return browse(mode, opts);
    });
  }

  function choose(mode, opts) {
    opts = opts || {};
    return pick(mode, opts).then(function (res) {
      if (res && res.ok && (res.path || (res.paths && res.paths.length))) {
        var input = _(opts.input);
        if (input) {
          input.value = (res.paths && res.paths.length > 1) ? res.paths.join('\n') : res.path;
          try {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e) {}
        }
        if (typeof opts.onPick === 'function') {
          if (res.paths && res.paths.length > 1) {
            res.paths.forEach(function (p) { opts.onPick(p, res); });
          } else {
            opts.onPick(res.path, res);
          }
        }
      } else if (res && res.error && !res.cancelled) {
        if (typeof opts.onError === 'function') opts.onError(res.error, res);
      }
      return res;
    });
  }

  /* 绑定一个按钮：点击即选择并回填 */
  function attach(btnOrSel, opts) {
    var btn = _(btnOrSel);
    if (!btn) return null;
    opts = opts || {};
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      choose(opts.mode, opts);
    });
    return btn;
  }

  window.ZzPick = {
    base: bridgeBase,
    pick: pick,
    choose: choose,
    browse: browse,
    attach: attach
  };
})();
