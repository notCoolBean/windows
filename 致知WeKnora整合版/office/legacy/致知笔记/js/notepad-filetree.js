/* ============================================================
   notepad-filetree.js — 笔记模块的「本地文件夹」层
   左栏不再是内存里的 5 个页签，而是一个真实的本地文件夹：
      · 打开模块时恢复上次选的文件夹
      · 递归扫描，只列「各级文件夹 + 其中的 .js 文件」，其他文件不显示
      · 点开一个 .js 就读进编辑区（占第 1 页签），编辑过程自动写缓存
      · 点「保存」直接写回这个 .js
      · 新增：新建类别（文件夹）/ 新建笔记（.js）
   两种后端（启动时自动选择）：
      · bridge   —— 有「致知办公助手」本机服务（127.0.0.1:8737）时优先用
    　  麒麟/奇安信/360 等浏览器不支持 showDirectoryPicker，只能走这条路：
        /api/pick-folder 选目录、/api/ls 列目录、/api/read 读、/api/write 写、
        /api/mkdir、/api/rmdir、/api/rename-dir、/api/rename、/api/delete 管理。
      · fsapi    —— 浏览器原生 File System Access API（Edge/Chrome）
    与 notepad.js 的约定：源模块不改，只调用它导出的全局函数。
   ============================================================ */
(function () {
    var IDB_KEY = 'wenbaoLibRootHandle';
    var ROOT_NAME_KEY = 'wenbaoLibRootName';
    var ROOT_PATH_KEY = 'wenbaoLibRootPath';
    var BACKEND_KEY = 'wenbaoLibBackend';
    var OPEN_PATH_KEY = 'wenbaoLibOpenPath';
    var COLLAPSE_KEY = 'wenbaoLibCollapsed';
    var DOCS_KEY = 'wenbaoLibDocs';
    var MAX_DEPTH = 6;
    var MAX_FILES = 800;

    var _root = null;           /* FileSystemDirectoryHandle（fsapi）或 null（bridge） */
    var _rootName = '';
    var _rootPath = '';         /* bridge：文件夹绝对路径 */
    var _backend = '';          /* 'fsapi' | 'bridge' */
    var _tree = null;           /* [{kind:'dir'|'file', name, path, handle, children}] */
    var _fileCount = 0;
    var _openPath = '';         /* bridge 模式下为绝对路径；fsapi 为相对路径 */
    var _openTitle = '';
    var _openHandle = null;
    var _dirty = false;
    var _collapsed = {};
    var _busy = false;
    var _cacheWarned = false;
    var _ctxEl = null;
    var _cacheTimer = null;
    var _dragPath = null;
    var _dragKind = null;
    function clearTreeDropMarks() {
        var marks = document.querySelectorAll('#npTopicList .npTreeDropTarget');
        for (var i = 0; i < marks.length; i++) marks[i].classList.remove('npTreeDropTarget');
    }


    function $(id) { return document.getElementById(id); }
    function toast(msg) { if (typeof showToast === 'function') showToast(msg); }
    function esc(s) {
        return (typeof escapeHtml === 'function') ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s);
    }

    function isLegacy() { return !!window.npLibLegacy; }
    function active() { return !isLegacy(); }

    /* ---------------- 本机桥接服务（致知办公助手 127.0.0.1:8737） ----------------
       麒麟/奇安信可信浏览器没有 showDirectoryPicker，选不了文件夹。
       办公助手已经常驻本机服务，这里直接复用：
         /api/ping 探活 → /api/pick-folder 弹系统选择框 → /api/ls 列目录
         → /api/read + /api/write 读写 .js → mkdir/rmdir/rename/delete 管理
       服务不可用时自动退回浏览器原生 File System Access API。 */
    var BRIDGE_DEFAULT = 'http://127.0.0.1:8737';
    var BRIDGE_TTL = 8000;
    var _bridgeState = null;
    var _bridgeAt = 0;

    function bridgeBase() {
        try {
            if (window.ZZ_BRIDGE && window.ZZ_BRIDGE.url) return String(window.ZZ_BRIDGE.url);
            var saved = localStorage.getItem('zz-bridge-url');
            if (saved) return saved;
        } catch (e) {}
        return BRIDGE_DEFAULT;
    }

    function bridgeJson(pathname, payload, ms) {
        return new Promise(function (resolve) {
            var settled = false;
            var ctl = null;
            try { ctl = window.AbortController ? new AbortController() : null; } catch (e) { ctl = null; }
            var timer = setTimeout(function () {
                if (settled) return;
                settled = true;
                try { if (ctl) ctl.abort(); } catch (e) {}
                resolve(null);
            }, ms || 5000);
            var opt = ctl ? { signal: ctl.signal, cache: 'no-store' } : { cache: 'no-store' };
            if (payload) {
                opt.method = 'POST';
                opt.headers = { 'Content-Type': 'application/json' };
                opt.body = JSON.stringify(payload);
            }
            fetch(bridgeBase() + pathname, opt).then(function (r) {
                return r.json();
            }).then(function (d) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(d);
            }).catch(function () {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(null);
            });
        });
    }

    /* 探测一次本机服务：返回 {reachable, canManage, features}
       canManage 要求 pick-folder + ls + read + write 都在（老版本服务没有 mkdir，
       仍可用，只是新建类别会提示更新）。 */
    function probeBridge(force) {
        /* 测试 / 强制原生模式：window.npLibNoBridge = true 直接判定服务不可用 */
        if (window.npLibNoBridge) {
            renderBridgePill({ reachable: false, canManage: false, canFolder: false, features: [], os: '' });
            return Promise.resolve({ reachable: false, canManage: false, canFolder: false, features: [], os: '' });
        }
        var now = Date.now();
        if (!force && _bridgeState && _bridgeState.reachable && now - _bridgeAt < BRIDGE_TTL) {
            return Promise.resolve(_bridgeState);
        }
        return bridgeJson('/api/ping', null, 2500).then(function (d) {
            var feats = (d && Array.isArray(d.features)) ? d.features : [];
            var has = function (f) { return feats.indexOf(f) >= 0; };
            _bridgeState = {
                reachable: !!(d && d.ok),
                canManage: !!(d && d.ok && has('pick-folder') && has('ls') && has('read') && has('write')),
                canFolder: !!(d && d.ok && has('mkdir') && has('rmdir')),
                features: feats,
                os: (d && d.os) || ''
            };
            _bridgeAt = now;
            renderBridgePill(_bridgeState);
            return _bridgeState;
        });
    }

    function bridgeOn() { return _backend === 'bridge'; }

    /* ---------------- 左上角：本机服务状态标签 ----------------
       参考 10--谈话助手 的 bridgePill：常驻显示是否连上「致知办公助手」，
       点标签或「重试」按钮重新探测。 */
    function renderBridgePill(state) {
        var pill = $('npBridgePill');
        var text = $('npBridgeText');
        var retry = $('npBridgeRetry');
        if (!pill || !text) return;
        var st = state || _bridgeState;
        var cls = 'checking';
        var label = '检测中';
        var tip = '正在检测「致知办公助手」本机服务（127.0.0.1:8737）…';
        if (st && st.reachable && st.canFolder) {
            cls = 'ok';
            label = '已连接本地服务';
            tip = ['本机服务正常（' + (st.os || '本机') + '）',
                '支持：选择文件夹 / 列目录 / 读写笔记 / 新建与删除类别',
                '点此重新检测。'].join('\n');
        } else if (st && st.reachable && st.canManage) {
            cls = 'part';
            label = '服务需更新';
            tip = ['本机服务在运行，但缺少 mkdir / rmdir 接口。',
                '「新建类别」「删除类别」不可用，请更新「致知办公助手」到最新版。',
                '已具备：' + (st.features.join('、') || '无'),
                '点此重新检测。'].join('\n');
        } else if (st && st.reachable) {
            cls = 'old';
            label = '服务能力不全';
            tip = ['本机服务在运行，但缺少选目录 / 读取 / 写入接口。',
                '请更新「致知办公助手」到最新版。',
                '已具备：' + (st.features.join('、') || '无'),
                '点此重新检测。'].join('\n');
        } else if (st) {
            cls = 'off';
            label = '未连接本地服务';
            tip = ['未检测到「致知办公助手」本机服务（127.0.0.1:8737）。',
                '选择文件夹、读写笔记需要它运行：请先在办公助手里启动服务。',
                '点此重新检测。'].join('\n');
        }
        pill.className = 'npBridgePill ' + cls;
        pill.title = tip;
        text.textContent = label;
        if (retry) retry.className = 'npBridgeRetry' + (cls === 'ok' ? ' hidden' : '');
    }

    function refreshBridgePill() {
        renderBridgePill(null);
        return probeBridge(true).then(function (st) {
            renderBridgePill(st);
            return st;
        });
    }

    function bridgeErr(d, fallback) {
        if (d && d.error) return String(d.error);
        return fallback || '本机服务无响应';
    }

    function joinPath(dir, name) {
        var d = String(dir || '').replace(/[\\/]+$/, '');
        if (!d) return String(name || '');
        var sep = d.indexOf('\\') >= 0 ? '\\' : '/';
        return d + sep + name;
    }

    function baseName(p) {
        var s = String(p || '').replace(/[\\/]+$/, '');
        var idx = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        return idx < 0 ? s : s.substring(idx + 1);
    }

    function parentDir(p) {
        var s = String(p || '').replace(/[\\/]+$/, '');
        var idx = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        return idx <= 0 ? s : s.substring(0, idx);
    }

    /* ---------------- 存储 ---------------- */
    function loadCollapsed() {
        var o = {};
        try { o = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}') || {}; } catch (e) { o = {}; }
        _collapsed = (o && typeof o === 'object') ? o : {};
    }
    function saveCollapsed() {
        try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(_collapsed)); } catch (e) {}
    }
    function loadDocs() {
        var o = null;
        try { o = JSON.parse(localStorage.getItem(DOCS_KEY) || 'null'); } catch (e) { o = null; }
        return (o && typeof o === 'object') ? o : {};
    }
    function cacheSet(path, html) {
        if (!path) return;
        try {
            var all = loadDocs();
            all[path] = html || '';
            var text = JSON.stringify(all);
            if (text.length > 3.5 * 1024 * 1024) all = {};
            all[path] = html || '';
            localStorage.setItem(DOCS_KEY, JSON.stringify(all));
        } catch (e) {
            if (!_cacheWarned) {
                _cacheWarned = true;
                console.warn('[notepad-filetree] 缓存写入失败，可能是容量不足', e);
            }
        }
    }
    function cacheGet(path) {
        var all = loadDocs();
        return (path && typeof all[path] === 'string') ? all[path] : null;
    }

    /* ---------------- 文件系统 ---------------- */
    async function idbGetHandle() {
        try {
            if (typeof window.idbGet === 'function') return await window.idbGet(IDB_KEY);
        } catch (e) {}
        return await new Promise(function (resolve) {
            try {
                var r = indexedDB.open('notepadExport', 1);
                r.onupgradeneeded = function () {
                    var db = r.result;
                    if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
                };
                r.onsuccess = function () {
                    try {
                        var db = r.result;
                        var tx = db.transaction('handles', 'readonly');
                        var rq = tx.objectStore('handles').get(IDB_KEY);
                        rq.onsuccess = function () { resolve(rq.result || null); };
                        rq.onerror = function () { resolve(null); };
                    } catch (e) { resolve(null); }
                };
                r.onerror = function () { resolve(null); };
            } catch (e) { resolve(null); }
        });
    }

    async function idbPutHandle(handle) {
        try {
            if (typeof window.idbPut === 'function') return await window.idbPut(IDB_KEY, handle);
        } catch (e) {}
        try {
            var db = await new Promise(function (resolve, reject) {
                var r = indexedDB.open('notepadExport', 1);
                r.onupgradeneeded = function () {
                    var d = r.result;
                    if (!d.objectStoreNames.contains('handles')) d.createObjectStore('handles');
                };
                r.onsuccess = function () { resolve(r.result); };
                r.onerror = function () { reject(r.error); };
            });
            await new Promise(function (resolve) {
                var tx = db.transaction('handles', 'readwrite');
                tx.objectStore('handles').put(handle, IDB_KEY);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { resolve(); };
            });
        } catch (e) {}
    }

    async function ensurePerm(handle, readWrite) {
        if (!handle) return false;
        if (typeof handle.queryPermission !== 'function') return true;   /* 测试用假句柄 */
        var opts = { mode: readWrite ? 'readwrite' : 'read' };
        try {
            if ((await handle.queryPermission(opts)) === 'granted') return true;
            if (typeof handle.requestPermission === 'function' &&
                (await handle.requestPermission(opts)) === 'granted') return true;
        } catch (e) {}
        return false;
    }

    /* 递归扫描：只收文件夹与 .js */
    async function scanTree(dirHandle, path, depth) {
        if (!dirHandle || typeof dirHandle.values !== 'function') return [];
        if (depth > MAX_DEPTH || _fileCount > MAX_FILES) return [];
        var dirs = [], files = [];
        try {
            for await (var h of dirHandle.values()) {
                if (!h || !h.name || h.name.charAt(0) === '.') continue;
                if (h.kind === 'directory') dirs.push(h);
                else if (h.kind === 'file' && /\.js$/i.test(h.name)) files.push(h);
            }
        } catch (e) {
            return [];
        }
        dirs.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'zh'); });
        files.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'zh'); });
        var out = [];
        for (var i = 0; i < dirs.length; i++) {
            var dp = path + dirs[i].name + '/';
            out.push({
                kind: 'dir',
                name: dirs[i].name,
                path: dp,
                handle: dirs[i],
                children: await scanTree(dirs[i], dp, depth + 1)
            });
        }
        for (var j = 0; j < files.length && _fileCount <= MAX_FILES; j++) {
            _fileCount++;
            out.push({ kind: 'file', name: files[j].name, path: path + files[j].name, handle: files[j] });
        }
        return out;
    }

    /* 桥接模式递归扫描：/api/ls 逐层列目录，只收文件夹与 .js */
    async function scanBridge(dir, depth) {
        if (!dir || depth > MAX_DEPTH || _fileCount > MAX_FILES) return [];
        var d = await bridgeJson('/api/ls?path=' + encodeURIComponent(dir), null, 8000);
        if (!d || !d.ok) return [];
        var entries = Array.isArray(d.entries) ? d.entries : [];
        var dirs = [], files = [];
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (!e || !e.name || e.name.charAt(0) === '.') continue;
            if (e.type === 'dir') dirs.push(e);
            else if (e.type === 'file' && /\.js$/i.test(e.name)) files.push(e);
        }
        dirs.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'zh'); });
        files.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'zh'); });
        var out = [];
        for (var j = 0; j < dirs.length; j++) {
            var dp = joinPath(dir, dirs[j].name);
            out.push({
                kind: 'dir',
                name: dirs[j].name,
                path: dp,
                handle: null,
                children: await scanBridge(dp, depth + 1)
            });
        }
        for (var k = 0; k < files.length && _fileCount <= MAX_FILES; k++) {
            _fileCount++;
            out.push({ kind: 'file', name: files[k].name, path: joinPath(dir, files[k].name), handle: null });
        }
        return out;
    }

    function countFiles(nodes) {
        var n = 0;
        for (var i = 0; i < (nodes || []).length; i++) {
            if (nodes[i].kind === 'file') n++;
            else n += countFiles(nodes[i].children);
        }
        return n;
    }

    /* ---------------- 同级排序（拖动上下调整顺序） ----------------
       文件系统本身没有顺序，这里按「父目录」把同级节点顺序记到 localStorage，
       每次扫描完按记录重排；新出现的节点排在已记录节点之后。 */
    var _orderKey = 'npLibOrder';
    var _orderMap = null;

    function loadOrder() {
        if (_orderMap) return _orderMap;
        try { _orderMap = JSON.parse(localStorage.getItem(_orderKey) || '{}') || {}; }
        catch (e) { _orderMap = {}; }
        return _orderMap;
    }
    function saveOrder() {
        try { localStorage.setItem(_orderKey, JSON.stringify(_orderMap || {})); } catch (e) {}
    }

    /* 按记录顺序排序一个数组；parentKey 为空串代表根目录 */
    function sortByOrder(nodes, parentKey) {
        if (!nodes || !nodes.length) return nodes;
        var map = loadOrder();
        var seq = map[parentKey] || [];
        if (!seq.length) return nodes;
        var idx = {};
        for (var s = 0; s < seq.length; s++) idx[seq[s]] = s;
        return nodes.slice().sort(function (a, b) {
            var ia = idx[a.name], ib = idx[b.name];
            if (ia === undefined && ib === undefined) return 0;
            if (ia === undefined) return 1;
            if (ib === undefined) return -1;
            return ia - ib;
        });
    }

    /* 扫描完成后统一套用记录顺序（根 + 每个子目录） */
    function applyOrder(nodes, parentKey) {
        if (!nodes || !nodes.length) return nodes;
        var out = sortByOrder(nodes, parentKey || '');
        for (var i = 0; i < out.length; i++) {
            if (out[i].kind === 'dir') out[i].children = applyOrder(out[i].children || [], out[i].path);
        }
        return out;
    }

    /* 找到某目录节点的直接子节点数组；parentPath 为空时返回根数组 */
    function childrenOf(parentPath) {
        if (!parentPath) return _tree;
        for (var i = 0; i < (_tree || []).length; i++) {
            var n = _tree[i];
            if (n.kind === 'dir' && n.path === parentPath) return n.children || [];
            if (n.kind === 'dir') {
                var r = childrenOfIn(n.children, parentPath);
                if (r) return r;
            }
        }
        return null;
    }
    function childrenOfIn(list, parentPath) {
        for (var i = 0; i < (list || []).length; i++) {
            var n = list[i];
            if (n.kind !== 'dir') continue;
            if (n.path === parentPath) return n.children || [];
            var r = childrenOfIn(n.children, parentPath);
            if (r) return r;
        }
        return null;
    }

    function reorderSibling(srcPath, tPath, below) {
        var parentPath = parentOf(srcPath);
        var list = childrenOf(parentPath);
        if (!list || !list.length) { renderList(); return; }
        var srcName = baseName(srcPath), tName = baseName(tPath);
        var names = [];
        for (var i = 0; i < list.length; i++) names.push(list[i].name);
        var from = names.indexOf(srcName);
        if (from < 0) { renderList(); return; }
        names.splice(from, 1);
        var to = names.indexOf(tName);
        if (to < 0) { renderList(); return; }
        names.splice(below ? to + 1 : to, 0, srcName);

        var map = loadOrder();
        map[parentPath || ''] = names;
        saveOrder();

        var pos = {};
        for (var k = 0; k < names.length; k++) pos[names[k]] = k;
        list.sort(function (a, b) {
            var ia = pos[a.name], ib = pos[b.name];
            if (ia === undefined) return 1;
            if (ib === undefined) return -1;
            return ia - ib;
        });
        renderList();
    }

    /* 统计：笔记文件数 + 直接包含笔记文件的文件夹（类别）数。
       类别只算「笔记文件所在的直接文件夹」，不含纯父级目录、不含子层级累加。 */
    function countTreeStats(nodes) {
        var files = 0, dirs = 0;
        function walk(list) {
            if (!list) return false;          // 本层是否直接含笔记文件
            var hasFile = false;
            for (var i = 0; i < list.length; i++) {
                if (list[i].kind === 'file') { files++; hasFile = true; }
                else {
                    var childHas = walk(list[i].children || []);
                    if (childHas) dirs++;     // 该文件夹直接含有笔记文件，记作一个类别
                }
            }
            return hasFile;
        }
        walk(nodes);
        return { files: files, dirs: dirs };
    }

    async function rescan() {
        _fileCount = 0;
        if (bridgeOn()) {
            if (!_rootPath) { _tree = null; return; }
            _tree = applyOrder(await scanBridge(_rootPath, 0), '');
            return;
        }
        if (!_root) { _tree = null; return; }
        _tree = applyOrder(await scanTree(_root, '', 0), '');
    }

    function findNode(path) {
        var stack = (_tree || []).slice();
        while (stack.length) {
            var n = stack.shift();
            if (n.path === path) return n;
            if (n.children) stack = n.children.concat(stack);
        }
        return null;
    }

    /* 扫描结果里找不到精确路径时的兜底：按文件名 + 所在目录找 */
    function findByStem(name, parentPath) {
        var want = name + '.js';
        var files = allFiles();
        for (var i = 0; i < files.length; i++) {
            if (files[i].name !== want) continue;
            if (!parentPath) return files[i];
            if (parentOf(files[i].path) === parentPath) return files[i];
        }
        for (var j = 0; j < files.length; j++) if (files[j].name === want) return files[j];
        return null;
    }

    function allFiles() {
        var out = [];
        (function walk(nodes) {
            for (var i = 0; i < (nodes || []).length; i++) {
                if (nodes[i].kind === 'file') out.push(nodes[i]);
                else walk(nodes[i].children);
            }
        })(_tree || []);
        return out;
    }

    function decodeBytes(buf) {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, '');
        } catch (e) {
            try { return new TextDecoder('gb18030').decode(buf); }
            catch (e2) { return new TextDecoder('utf-8').decode(buf); }
        }
    }

    function b64ToBytes(b64) {
        var bin = atob(String(b64 || ''));
        var out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out.buffer;
    }

    async function readText(handle) {
        if (bridgeOn()) {
            var d = await bridgeJson('/api/read?path=' + encodeURIComponent(handle), null, 10000);
            if (!d || !d.ok) throw new Error(bridgeErr(d, '读取失败'));
            return decodeBytes(b64ToBytes(d.base64));
        }
        if (!handle || typeof handle.getFile !== 'function') throw new Error('无法读取文件');
        var file = await handle.getFile();
        var buf = await file.arrayBuffer();
        return decodeBytes(buf);
    }

    /* 写回一个 .js（两种后端统一入口） */
    async function writeText(target, text) {
        if (bridgeOn()) {
            var d = await bridgeJson('/api/write', { path: target, content: text }, 15000);
            if (!d || !d.ok) throw new Error(bridgeErr(d, '写入失败'));
            return true;
        }
        var w = await target.createWritable();
        await w.write(text);
        await w.close();
        return true;
    }

    /* ---------------- .js 文件格式 ---------------- */
    /* 扫描花括号，跳过字符串与转义，避免 HTML 里的 "};" 提前截断 */
    function matchBrace(s, start) {
        var depth = 0, inStr = false, quote = '', escd = false;
        for (var i = start; i < s.length; i++) {
            var ch = s.charAt(i);
            if (inStr) {
                if (escd) { escd = false; continue; }
                if (ch === '\\') { escd = true; continue; }
                if (ch === quote) { inStr = false; }
                continue;
            }
            if (ch === '"' || ch === "'") { inStr = true; quote = ch; continue; }
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) return i;
            }
        }
        return -1;
    }

    function parseNoteJs(text, fallbackTitle) {
        var s = String(text == null ? '' : text);
        var data = null;
        var m = s.search(/var\s+savedData\s*=/);
        if (m >= 0) {
            var start = s.indexOf('{', m);
            if (start >= 0) {
                var end = matchBrace(s, start);
                if (end > start) {
                    try { data = JSON.parse(s.substring(start, end + 1)); } catch (e) { data = null; }
                }
            }
        }
        if (!data && typeof window.parseNotepadJsData === 'function') {
            try { data = window.parseNotepadJsData(s); } catch (e) { data = null; }
        }
        var html = '', title = '';
        if (data) {
            var f = data.file || null;
            if (f) {
                if (typeof f.html === 'string') html = f.html;
                if (f.title) title = String(f.title);
            }
            var np = data.notepad || null;
            if (np) {
                if (!html && Array.isArray(np.editorData)) {
                    for (var i = 0; i < np.editorData.length; i++) {
                        var ed = np.editorData[i];
                        if (ed && typeof ed.html === 'string' && ed.html.trim()) {
                            html = ed.html;
                            if (!title && np.titles && np.titles[i] && np.titles[i] !== '…') title = String(np.titles[i]);
                            break;
                        }
                    }
                }
                if (!html && Array.isArray(np.data)) {
                    for (var j = 0; j < np.data.length; j++) {
                        if (typeof np.data[j] === 'string' && np.data[j].trim()) { html = np.data[j]; break; }
                    }
                }
                if (!title && Array.isArray(np.titles)) {
                    for (var k = 0; k < np.titles.length; k++) {
                        if (np.titles[k] && np.titles[k] !== '…') { title = String(np.titles[k]); break; }
                    }
                }
            }
        }
        /* 已经解析出 savedData 时，空 html 就是「真的没有正文」，
           不能把整个 .js 源码当成正文（否则删完最后一篇会把源码灌进编辑区）。 */
        if (!html && !data) {
            if (/<p[\s>]/i.test(s)) html = s;
            else if (s.trim()) {
                html = (typeof window._npPlainTextToHtml === 'function')
                    ? window._npPlainTextToHtml(s.trim())
                    : '<p>' + esc(s.trim()) + '</p>';
            }
        }
        if (!title) title = fallbackTitle || '';
        return { html: html, title: title, parsed: !!data };
    }

    function stem(name) { return String(name || '').replace(/\.js$/i, ''); }

    /* 新建笔记的正文模板：带一个索引标题，让中部「标题」列表立刻有一条索引 */
    function noteTemplateHtml(title) {
        var t = title || '新笔记';
        var safe = String(t).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
        return '<p data-outline-level="1">【索引】' + safe + '</p><p><br></p>';
    }

    function buildNoteJs(title, html) {
        var t = title || '';
        var data = {
            file: { version: 1, title: t, updatedAt: new Date().toISOString() },
            notepad: {
                titles: [t],
                labels: ['1'],
                data: [''],
                editorData: [{ html: html || '', bold: false }],
                fontSizes: [14],
                notebookStyles: [false],
                zoomLevels: [1],
                singleFile: true
            }
        };
        return '// 笔记文件 - 由「致知笔记」笔记模块生成，可手动编辑\n' +
            'var savedData = ' + JSON.stringify(data, null, 2) + ';\n';
    }

    /* ---------------- 与编辑区对接 ---------------- */
    function modelHtml() {
        var d = (typeof notepadEditorData !== 'undefined' && notepadEditorData[0]) ? notepadEditorData[0] : null;
        return (d && typeof d.html === 'string') ? d.html : '';
    }

    function flushCurrent() {
        if (!_openPath) return;
        try {
            if (window._notepadDirBrowseMode && typeof window._notepadDirSaveCurrentArticle === 'function') {
                window._notepadDirSaveCurrentArticle(true);
            } else if (typeof window.saveCurrentEditor === 'function') {
                window.saveCurrentEditor();
            }
        } catch (e) { console.warn('[notepad-filetree] 保存当前内容失败', e); }
        try { if (typeof window._saveNotepadToCache === 'function') window._saveNotepadToCache(); } catch (e) {}
        cacheSet(_openPath, modelHtml());
    }

    /* 新建笔记后自动选中模板里的第一篇文章（让左侧 / 中部索引立刻有焦点） */
    var _focusFirstArticleOnApply = false;

    function applyDoc(html, title) {
        try { if (typeof window._notepadDirRestoreHidden === 'function') window._notepadDirRestoreHidden(); } catch (e) {}
        try { if (typeof window._notepadDirEndBrowse === 'function') window._notepadDirEndBrowse(false); } catch (e) {}

        if (typeof currentNotepadTab !== 'undefined' && currentNotepadTab !== 0) {
            try { window.switchNotepadTab(0); } catch (e) {}
        }
        if (typeof notepadTitles !== 'undefined') notepadTitles[0] = title || '';
        if (typeof notepadEditorData !== 'undefined') {
            if (!notepadEditorData[0]) notepadEditorData[0] = { html: '', bold: false };
            notepadEditorData[0].html = html || '';
            notepadEditorData[0].bold = false;
        }
        if (typeof window._npEditorBindCurrentTab === 'function') window._npEditorBindCurrentTab();

        var ed = $('notepadEditor');
        if (ed) {
            ed.innerHTML = html || '<p><br></p>';
            ed.scrollTop = 0;
            ed.className = 'notepadEditor bg0';
        }
        var ti = $('notepadTitle');
        if (ti) {
            ti.value = title || '';
            ti.title = title || '（无标题）点击可修改标题';
            ti.className = 'notepadTitle color0';
        }
        try { if (typeof window._npEditorResetUndoHistory === 'function') window._npEditorResetUndoHistory(); } catch (e) {}
        try { if (typeof window._saveNotepadToCache === 'function') window._saveNotepadToCache(); } catch (e) {}
        try { if (typeof window.updateFooterTimestamp === 'function') window.updateFooterTimestamp(); } catch (e) {}
        var focusFirst = !!(_focusFirstArticleOnApply);
        _focusFirstArticleOnApply = false;
        if (focusFirst && typeof window.npSelectFirstArticle === 'function') {
            try { window.npSelectFirstArticle(); } catch (e) {}
        } else {
            try { if (typeof window.npResetArticleSelection === 'function') window.npResetArticleSelection(); } catch (e) {}
        }
        try { if (typeof window.npRefreshWorkspace === 'function') window.npRefreshWorkspace(); } catch (e) {}
        clearDirty();
    }
    /* ---------------- 渲染左栏 ---------------- */
    function renderList() {
        var box = $('npTopicList');
        if (!box) return;
        bindNewTarget();
        box.className = 'npTopicList npTreeList';
        box.innerHTML = '';

        var meta = $('npTopicTotal');
        if (meta) {
            /* 顶部标签改为「计数」：只显示数字，详情点开浮窗查看 */
            if (_root || _rootPath) {
                var st0 = countTreeStats(_tree);
                meta.textContent = st0.files + ' / ' + st0.dirs;
            } else {
                meta.textContent = '计数';
            }
        }

        if (!_root && !_rootPath) { renderPickRoot(box); return; }
        /* 原「📁 文件夹名 + 本机服务 + 刷新」整行已移除；文件夹选择与刷新都在栏头按钮上 */

        if (!_tree || !_tree.length) {
            var empty = document.createElement('div');
            empty.className = 'npLibEmpty';
            empty.textContent = '这个文件夹里还没有 .js 笔记，点右上角「＋ 新增」新建一篇。';
            box.appendChild(empty);
            return;
        }
        renderNodes(box, _tree, 0);
        var _navW = npHeadNav;
        if (_navW && _navW._npSyncNav) setTimeout(_navW._npSyncNav, 0);
    }

    function renderNodes(box, nodes, depth) {
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (node.kind === 'dir') {
                box.appendChild(makeFolderRow(node, depth));
                if (!_collapsed[node.path]) renderNodes(box, node.children || [], depth + 1);
            } else {
                box.appendChild(makeFileRow(node, depth));
            }
        }
    }

    function padLeft(el, depth) { el.style.paddingLeft = (10 + depth * 14) + 'px'; }


    /* ---------------- 文件类型图标（data/type/*.ico，与谈话助手同一套） ---------------- */
    var TYPE_ICON_DIR = 'data/type/';
    var EXT_ICON = {
        js: 'json.ico', json: 'json.ico',
        txt: 'txt.ico', md: 'txt.ico', log: 'txt.ico', ini: 'txt.ico',
        csv: 'csv.ico',
        doc: 'docx.ico', docx: 'docx.ico', wps: 'docx.ico', rtf: 'docx.ico',
        xls: 'excel.ico', xlsx: 'excel.ico', et: 'excel.ico',
        pdf: 'pdf.ico',
        htm: 'html.ico', html: 'html.ico', mht: 'html.ico', mhtml: 'html.ico',
        zip: 'winrar.ico', rar: 'winrar.ico', '7z': 'winrar.ico', tar: 'winrar.ico', gz: 'winrar.ico',
        png: 'picture.ico', jpg: 'picture.ico', jpeg: 'picture.ico', gif: 'picture.ico',
        bmp: 'picture.ico', webp: 'picture.ico', svg: 'picture.ico',
        mp4: 'movie.ico', avi: 'movie.ico', mkv: 'movie.ico', mov: 'movie.ico',
        mp3: 'music.ico', wav: 'music.ico', flac: 'music.ico',
        psd: 'psd.ico', ai: 'psd.ico'
    };

    function extOf(name) {
        var m = String(name || '').match(/\.([A-Za-z0-9]+)$/);
        return m ? m[1].toLowerCase() : '';
    }

    function typeIconFor(name, isDir) {
        if (isDir) return TYPE_ICON_DIR + 'folder.ico';
        var file = EXT_ICON[extOf(name)];
        return TYPE_ICON_DIR + (file || 'file.ico');
    }

    function iconImg(name, isDir, cls) {
        return '<img class="' + cls + '" src="' + esc(typeIconFor(name, isDir)) +
            '" alt="" draggable="false">';
    }

    function makeFolderRow(node, depth) {
        var row = document.createElement('div');
        row.className = 'npTreeFolder' + (_collapsed[node.path] ? ' collapsed' : '');
        row.setAttribute('data-lib-path', node.path);
        row.setAttribute('data-lib-kind', 'dir');
        row.title = node.path;
        row.setAttribute('draggable', 'true');
        padLeft(row, depth);
        row.innerHTML = '<span class="npTreeArrow">' + (_collapsed[node.path] ? '▸' : '▾') + '</span>' +
            iconImg(node.name, true, 'npTreeIcon') +
            '<span class="npTreeName">' + esc(node.name) + '</span>' +
            '<span class="npTreeCount">' + countFiles(node.children) + '</span>';
        return row;
    }

    function makeFileRow(node, depth) {
        var row = document.createElement('div');
        row.className = 'npTreeFile' + (node.path === _openPath ? ' active' : '');
        row.setAttribute('data-lib-path', node.path);
        row.setAttribute('data-lib-kind', 'file');
        row.title = node.path;
        row.setAttribute('draggable', 'true');
        padLeft(row, depth);
        row.innerHTML = iconImg(node.name, false, 'npTreeIcon') +
            '<span class="npTreeName">' + esc(stem(node.name)) + '</span>' +
            '<span class="npTreeExt">.js</span>';
        return row;
    }

    function renderPickRoot(box) {
        var wrap = document.createElement('div');
        wrap.className = 'npLibPick';
        var nativeOk = !!window.showDirectoryPicker;
        wrap.innerHTML = '<div class="npLibPickTitle">先选择一个本地文件夹</div>' +
            '<div class="npLibPickDesc">左侧只显示该文件夹里的各级文件夹和 .js 笔记；' +
            '编辑时自动存缓存，点「保存」直接写回这个 .js。</div>' +
            '<div class="npLibPickBtns">' +
            '<button type="button" class="npLibPickBtn" data-libact="pick">选择文件夹</button>' +
            '<button type="button" class="npLibPickBtn ghost" data-libact="path">输入路径</button>' +
            '</div>' +
            (nativeOk ? '' :
                '<div class="npLibPickDesc">本浏览器不支持原生选择文件夹，将通过「致知办公助手」本机服务' +
                '（127.0.0.1:8737）选择；若弹不出选择框，点「输入路径」直接填文件夹完整路径。</div>');
        box.appendChild(wrap);
    }

    function renderAuth(box) {
        var wrap = document.createElement('div');
        wrap.className = 'npLibPick';
        wrap.innerHTML = '<div class="npLibPickTitle">需要重新授权</div>' +
            '<div class="npLibPickDesc">上次的文件夹是「' + esc(_rootName || '') + '」，浏览器需要再确认一次读写权限。</div>' +
            '<div class="npLibPickBtns">' +
            '<button type="button" class="npLibPickBtn" data-libact="reauth">重新授权</button>' +
            '<button type="button" class="npLibPickBtn" data-libact="pick">换个文件夹</button>' +
            '</div>';
        box.appendChild(wrap);
    }
    /* ---------------- 写保护：内容变动标记 + 切换前询问 ---------------- */
    var _dirtyHint = null;

    function currentDocLabel() {
        return _openTitle || (_openPath ? stem(_openPath) : '当前笔记');
    }

    /* 编辑器内容变动即标记未保存；保存成功后标记清零 */
    function markDirty() {
        if (_dirty) return;
        _dirty = true;
        showDirtyHint();
    }

    function clearDirty() {
        _dirty = false;
        hideDirtyHint();
    }

    function showDirtyHint() {
        var pane = $('npEditorPane');
        if (!pane) return;
        if (pane.querySelector('.npDirtyHint')) return;
        var tag = document.createElement('div');
        tag.className = 'npDirtyHint';
        tag.id = 'npDirtyHint';
        tag.innerHTML = '<span class="npDirtyDot"></span>未保存';
        tag.title = '右侧内容已改动，点左侧笔记或中部标题会先询问是否保存';
        var status = $('npEditorStatus');
        var auto = $('notepadAutoFormatHint');
        if (status) status.insertBefore(tag, auto && auto.parentNode === status ? auto : null);
        else pane.appendChild(tag);
    }

    function hideDirtyHint() {
        var tag = $('npDirtyHint');
        if (tag && tag.parentNode) tag.parentNode.removeChild(tag);
        var pane = $('npEditorPane');
        if (pane) {
            var left = pane.querySelectorAll('.npDirtyHint');
            for (var i = 0; i < left.length; i++) left[i].parentNode.removeChild(left[i]);
        }
    }

    /* 三按钮询问：true=已保存 / false=不保存 / null=取消 */
    function askUnsaved(targetLabel) {
        return new Promise(function (resolve) {
            var mask = document.createElement('div');
            mask.className = 'npLibModalMask';
            var box = document.createElement('div');
            box.className = 'npLibModal npLibModalAsk';
            box.innerHTML = '<div class="npLibModalTitle">当前笔记有未保存的修改</div>' +
                '<div class="npLibModalMsg">「' + esc(currentDocLabel()) + '」的内容改动还没有写入文件，' +
                '是否先保存再打开「' + esc(targetLabel || '其他笔记') + '」？</div>' +
                '<div class="npLibModalBtns">' +
                '<button type="button" class="npLibModalBtn" data-act="cancel">取消</button>' +
                '<button type="button" class="npLibModalBtn" data-act="discard">不保存</button>' +
                '<button type="button" class="npLibModalBtn primary" data-act="save">保存并继续</button></div>';
            mask.appendChild(box);
            document.body.appendChild(mask);
            setTimeout(function () {
                var b = box.querySelector('[data-act="save"]');
                if (b) try { b.focus(); } catch (e) {}
            }, 30);
            var settled = false;
            function done(v) {
                if (settled) return;
                settled = true;
                if (mask.parentNode) mask.parentNode.removeChild(mask);
                resolve(v);
            }
            box.addEventListener('click', function (e) {
                var b = e.target.closest('[data-act]');
                if (!b) return;
                var act = b.getAttribute('data-act');
                done(act === 'save' ? true : (act === 'discard' ? false : null));
            });
            mask.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') { e.preventDefault(); done(null); }
                else if (e.key === 'Enter') { e.preventDefault(); done(true); }
            });
        });
    }

    var _guardRunning = false;

    /* 切换前拦截：有改动则询问；返回 true 表示可以继续切换 */
    async function guardDirty(node) {
        if (!_dirty || !_openPath) return true;
        _guardRunning = true;
        var label = node && node.kind === 'file' ? stem(node.name) : (node == null ? '其他文章' : '整篇笔记');
        try {
            // 先落一下内存中的编辑器内容，保证待保存的是最新内容
            try {
                if (typeof window._notepadDirBrowseMode !== 'undefined' && window._notepadDirBrowseMode &&
                    typeof window._notepadDirSaveCurrentArticle === 'function') {
                    window._notepadDirSaveCurrentArticle(true);
                } else if (typeof window.saveCurrentEditor === 'function') {
                    window.saveCurrentEditor();
                }
            } catch (e) {}
            var choice = await askUnsaved(label);
            if (choice === null) return false;
            if (choice === false) { clearDirty(); return true; }
            await saveToFile();
            return !_dirty;
        } finally {
            _guardRunning = false;
        }
    }

    /* 供中部标题列表同步调用：无改动 → true（直接切）；有改动 → false 并异步询问，
       询问结束后回调 window.npArticleAfterGuard(ok) 由中部决定是否继续切换 */
    window.npArticleBeforeSwitch = function () {
        if (!_dirty) return true;
        if (_guardRunning) return false;
        guardDirty(null).then(function (ok) {
            if (typeof window.npArticleAfterGuard === 'function') window.npArticleAfterGuard(ok);
        }, function () {
            if (typeof window.npArticleAfterGuard === 'function') window.npArticleAfterGuard(false);
        });
        return false;
    };

    /* 中部切换文章时用：只返回是否还有未保存改动（不弹窗），
       真正的询问交给 pickWithGuard 统一走一次。 */
    window.npFileDirty = function () { return !!_dirty; };

    /* 打开新笔记后：重置中部选中态为「全文」，右侧回到整篇顶部 */
    function resetWorkspaceSelection() {
        try {
            if (typeof window.npResetArticleSelection === 'function') window.npResetArticleSelection();
        } catch (e) {}
        var ed = $('notepadEditor');
        if (ed) ed.scrollTop = 0;
    }

    /* ---------------- 打开 / 保存 ---------------- */
    async function openFile(node) {
        if (!node || node.kind !== 'file' || _busy) return;
        if (node.path === _openPath) { renderList(); return; }
        if (!(await guardDirty(node))) return;
        flushCurrent();
        _busy = true;
        try {
            var text = '';
            try { text = await readText(bridgeOn() ? node.path : node.handle); }
            catch (e) { text = cacheGet(node.path) || ''; }
            var parsed = parseNoteJs(text, stem(node.name));
            if (!parsed.html) {
                var cached = cacheGet(node.path);
                if (cached) parsed.html = cached;
            }
            _openPath = node.path;
            _openHandle = bridgeOn() ? node.path : node.handle;
            _openTitle = parsed.title || stem(node.name);
            applyDoc(parsed.html, _openTitle);
            cacheSet(_openPath, modelHtml());
            persistOpenState();
            renderList();
            toast('已打开笔记：' + (_openTitle || stem(node.name)));
        } catch (e) {
            toast('打开失败：' + (e && e.message ? e.message : e));
        } finally {
            _busy = false;
        }
    }

    async function saveToFile() {
        if (!_rootPath && !_root) { toast('请先选择笔记文件夹'); return; }
        if (!_openPath || !_openHandle) { toast('请先在左侧选择一个笔记文件'); return; }
        flushCurrent();
        if (!bridgeOn() && !(await ensurePerm(_openHandle, true))) {
            toast('没有写入权限，请点「文件夹」重新选择');
            return;
        }
        try {
            var html = modelHtml();
            var text = buildNoteJs(_openTitle || stem(_openPath), html);
            await writeText(_openHandle, text);
            clearDirty();
            cacheSet(_openPath, html);
            toast('已保存：' + (_openTitle || stem(_openPath)));
            renderList();
        } catch (e) {
            toast('保存失败：' + (e && e.message ? e.message : e));
        }
    }

    /* 输入时自动写缓存（不落盘，落盘只走「保存」） */
    function scheduleCache() {
        if (!_openPath) return;
        markDirty();
        if (_cacheTimer) clearTimeout(_cacheTimer);
        _cacheTimer = setTimeout(function () {
            _cacheTimer = null;
            try {
                if (window._notepadDirBrowseMode && typeof window._notepadDirSaveCurrentArticle === 'function') {
                    window._notepadDirSaveCurrentArticle(true);
                } else if (typeof window.saveCurrentEditor === 'function') {
                    window.saveCurrentEditor();
                }
                if (typeof window._saveNotepadToCache === 'function') window._saveNotepadToCache();
                cacheSet(_openPath, modelHtml());
            } catch (e) {}
        }, 600);
    }

    function persistOpenState() {
        try { localStorage.setItem(OPEN_PATH_KEY, _openPath || ''); } catch (e) {}
    }

    function rememberRoot(handle) {
        _backend = 'fsapi';
        _root = handle;
        _rootPath = '';
        _rootName = (handle && handle.name) ? handle.name : '';
        try {
            localStorage.setItem(ROOT_NAME_KEY, _rootName);
            localStorage.setItem(ROOT_PATH_KEY, '');
            localStorage.setItem(BACKEND_KEY, _backend);
        } catch (e) {}
        idbPutHandle(handle);
    }

    function rememberBridgeRoot(path) {
        _backend = 'bridge';
        _root = null;
        _rootPath = String(path || '');
        _rootName = baseName(_rootPath);
        try {
            localStorage.setItem(ROOT_NAME_KEY, _rootName);
            localStorage.setItem(ROOT_PATH_KEY, _rootPath);
            localStorage.setItem(BACKEND_KEY, _backend);
        } catch (e) {}
    }

    function openFirstAvailable() {
        var last = '';
        try { last = localStorage.getItem(OPEN_PATH_KEY) || ''; } catch (e) {}
        var node = findNode(last) || allFiles()[0];
        return node ? openFile(node) : Promise.resolve();
    }

    async function chooseRoot() {
        /* 优先本机服务：麒麟 / 奇安信等没有 showDirectoryPicker 的浏览器靠它选目录 */
        var st = await probeBridge(true);
        if (st && st.canManage) {
            var picked = await bridgeJson('/api/pick-folder', { title: '请选择笔记文件夹', mode: 'dir' }, 120000);
            if (!picked) { toast('本机服务无响应，请先在「致知办公助手」里启动服务'); return false; }
            if (!picked.ok) {
                if (!picked.error) return false;                   /* 用户取消 */
                if (picked.need_path) {                            /* 机器上没有图形选择工具 */
                    return browseAndPick();
                }
                toast('选择文件夹失败：' + bridgeErr(picked));
                return false;
            }
            return useBridgeRoot(picked.path || picked.dir);
        }
        if (!window.showDirectoryPicker) {
            toast('当前浏览器不支持选择文件夹，请先启动「致知办公助手」服务');
            return false;
        }
        var handle = null;
        try {
            handle = await window.showDirectoryPicker({ id: 'wenbao-library', mode: 'readwrite' });
        } catch (e) {
            if (e && e.name === 'AbortError') return false;
            toast('选择文件夹失败：' + (e && e.message ? e.message : e));
            return false;
        }
        rememberRoot(handle);
        await rescan();
        renderList();
        try { if (typeof window.npRefreshWorkspace === 'function') window.npRefreshWorkspace(); } catch (e) {}
        await openFirstAvailable();
        toast('已选择文件夹：' + _rootName);
        return true;
    }

    /* 切换到（或切换到同一个）桥接根目录 */
    async function useBridgeRoot(path) {
        if (!path) { toast('没有拿到文件夹路径'); return false; }
        rememberBridgeRoot(path);
        await rescan();
        renderList();
        try { if (typeof window.npRefreshWorkspace === 'function') window.npRefreshWorkspace(); } catch (e) {}
        await openFirstAvailable();
        toast('已选择文件夹：' + _rootName);
        return true;
    }

    /* 本机没有任何图形选择工具时的兜底：页面内文件浏览器（用 /api/ls 逐级浏览）。
       这是麒麟/奇安信上唯一靠得住的方式——系统弹窗弹不出来（没装 zenity/kdialog，
       tkinter 也可能没有），但 /api/ls 一定可用。参考 10--谈话助手 的 ZzPick.browse。 */
    var BROWSE_CSS = [
        '.npbw-overlay{position:fixed;inset:0;z-index:99999;background:rgba(20,40,34,.42);display:flex;align-items:center;justify-content:center;}',
        '.npbw{width:560px;max-width:94vw;max-height:80vh;display:flex;flex-direction:column;background:#FFFFFF;color:#2A3A34;border:1px solid #CFDCD5;border-radius:12px;box-shadow:0 22px 60px rgba(20,50,40,.28);overflow:hidden;font:13px/1.5 "Microsoft YaHei","PingFang SC",system-ui,sans-serif;}',
        '.npbw-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #E4EDE8;}',
        '.npbw-title{font-weight:600;font-size:14px;color:#2E6B5E;}',
        '.npbw-close{margin-left:auto;width:28px;height:28px;border:0;border-radius:8px;background:#F1F6F3;color:#4A6A5E;font-size:18px;line-height:1;cursor:pointer;}',
        '.npbw-close:hover{background:#E2EDE7;}',
        '.npbw-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#F7FBF9;}',
        '.npbw-bar button{height:30px;padding:0 10px;border:1px solid #CFDCD5;border-radius:7px;background:#FFF;color:#3E6B5C;font-size:12.5px;cursor:pointer;}',
        '.npbw-bar button:hover{background:#EDF4F0;}',
        '.npbw-path{flex:1;min-width:0;height:30px;line-height:30px;padding:0 10px;border:1px solid #DDE8E2;border-radius:7px;background:#FFF;color:#5A7A6E;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '.npbw-list{flex:1;min-height:200px;overflow:auto;padding:4px 8px 8px;}',
        '.npbw-row{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:7px;cursor:pointer;user-select:none;}',
        '.npbw-row:hover{background:#EDF4F0;}',
        '.npbw-row.on{background:#DCEFE7;box-shadow:inset 0 0 0 1px #9DCBBB;}',
        '.npbw-ic{width:16px;height:16px;flex:0 0 16px;object-fit:contain;}',
        '.npbw-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        '.npbw-row .tag{font-size:11px;color:#8AA29A;}',
        '.npbw-empty{padding:24px 12px;text-align:center;color:#8AA29A;}',
        '.npbw-fail{padding:20px 14px;color:#B23A32;word-break:break-all;}',
        '.npbw-foot{display:flex;gap:10px;justify-content:flex-end;padding:12px 14px;border-top:1px solid #E4EDE8;}',
        '.npbw-foot button{height:34px;padding:0 16px;border-radius:8px;border:1px solid #CFDCD5;background:#FFF;color:#3E6B5C;font-size:13px;cursor:pointer;}',
        '.npbw-foot .primary{background:#2E6B5E;border-color:#2E6B5E;color:#FFF;font-weight:600;}',
        '.npbw-foot button:hover{filter:brightness(1.05);}'
    ].join('');

    function ensureBrowseStyle() {
        if (document.getElementById('npbw-style')) return;
        var s = document.createElement('style');
        s.id = 'npbw-style';
        s.textContent = BROWSE_CSS;
        document.head.appendChild(s);
    }

    /* 通用页面内路径选择器（供预览栏、附件页、笔记左栏共用）。
       opts.mode : 'dir' 只选文件夹 | 'file' 可选文件夹或文件
       opts.title: 标题文字
       opts.start: 起始目录
       返回 Promise<{ok, path, isDir} | {ok:false, cancelled:true}> */
    function browsePath(opts) {
        opts = opts || {};
        var mode = opts.mode === 'file' ? 'file' : 'dir';
        return new Promise(function (resolve) {
            ensureBrowseStyle();
            var start = opts.start || _rootPath || '~';
            var cur = start;
            var picked = null;
            var done = false;

            var overlay = document.createElement('div');
            overlay.className = 'npbw-overlay';
            overlay.innerHTML =
                '<div class="npbw">' +
                '<div class="npbw-head"><span class="npbw-title">' + esc(opts.title || (mode === 'file' ? '选择文件' : '选择文件夹')) + '</span>' +
                '<button type="button" class="npbw-close" aria-label="关闭">×</button></div>' +
                '<div class="npbw-bar">' +
                '<button type="button" class="npbw-up">⬆ 上级</button>' +
                '<button type="button" class="npbw-home">🏠 主目录</button>' +
                '<div class="npbw-path"></div>' +
                '</div>' +
                '<div class="npbw-list"></div>' +
                '<div class="npbw-foot">' +
                '<button type="button" class="npbw-ok primary">' + (mode === 'file' ? '选择' : '选择当前文件夹') + '</button>' +
                '<button type="button" class="npbw-cancel">取消</button>' +
                '</div></div>';
            document.body.appendChild(overlay);

            var listEl = overlay.querySelector('.npbw-list');
            var pathEl = overlay.querySelector('.npbw-path');

            function finish(res) {
                if (done) return;
                done = true;
                document.removeEventListener('keydown', onKey);
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                resolve(res);
            }
            function onKey(e) { if (e.key === 'Escape') finish({ ok: false, cancelled: true }); }
            document.addEventListener('keydown', onKey);

            overlay.querySelector('.npbw-close').addEventListener('click', function () { finish({ ok: false, cancelled: true }); });
            overlay.querySelector('.npbw-cancel').addEventListener('click', function () { finish({ ok: false, cancelled: true }); });
            overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) finish({ ok: false, cancelled: true }); });
            overlay.querySelector('.npbw-ok').addEventListener('click', function () {
                if (mode === 'file' && picked) finish({ ok: true, path: picked, isDir: false });
                else finish({ ok: true, path: cur, isDir: true });
            });

            overlay.querySelector('.npbw-up').addEventListener('click', function () {
                var up = parentDir(cur);
                if (up && up !== cur) load(up);
            });
            overlay.querySelector('.npbw-home').addEventListener('click', function () { load('~'); });

            function render(data) {
                listEl.innerHTML = '';
                var entries = (data && data.entries) || [];
                if (!entries.length) {
                    var e = document.createElement('div');
                    e.className = 'npbw-empty';
                    e.textContent = '（此文件夹为空）';
                    listEl.appendChild(e);
                    return;
                }
                for (var i = 0; i < entries.length; i++) {
                    (function (en) {
                        var isDir = en.type === 'dir';
                        var row = document.createElement('div');
                        row.className = 'npbw-row';
                        row.innerHTML = iconImg(en.name, isDir, 'npbw-ic') +
                            '<span class="nm">' + esc(en.name) + '</span>' +
                            (!isDir && en.ext ? '<span class="tag">' + esc(en.ext) + '</span>' : '');
                        var full = joinPath(cur, en.name);
                        row.addEventListener('click', function () {
                            if (isDir) { picked = null; load(full); return; }
                            if (mode !== 'file') return;
                            var prev = listEl.querySelector('.npbw-row.on');
                            if (prev) prev.classList.remove('on');
                            row.classList.add('on');
                            picked = full;
                            pathEl.textContent = full;
                            pathEl.title = full;
                        });
                        row.addEventListener('dblclick', function () {
                            if (!isDir) finish({ ok: true, path: full, isDir: false });
                        });
                        listEl.appendChild(row);
                    })(entries[i]);
                }
                if (data && data.truncated) {
                    var t = document.createElement('div');
                    t.className = 'npbw-empty';
                    t.textContent = '（项目过多，仅显示前 ' + entries.length + ' 项）';
                    listEl.appendChild(t);
                }
            }

            function showFail(p, msg) {
                pathEl.textContent = p;
                pathEl.title = p;
                listEl.innerHTML = '';
                var f = document.createElement('div');
                f.className = 'npbw-fail';
                f.textContent = msg;
                listEl.appendChild(f);
            }

            function load(p) {
                listEl.innerHTML = '<div class="npbw-empty">读取中…</div>';
                bridgeJson('/api/ls?path=' + encodeURIComponent(p), null, 8000).then(function (data) {
                    if (!data) { showFail(p, '未连接本机服务，请先启动「致知办公助手」后重试'); return; }
                    if (!data.ok) { showFail(p, '无法打开：' + (data.error || '未知错误')); return; }
                    cur = data.path || p;
                    pathEl.textContent = cur;
                    pathEl.title = cur;
                    render(data);
                });
            }

            load(start);
        });
    }

    /* 只选文件夹的包装（笔记左栏沿用） */
    function browseDir(startPath) {
        return browsePath({ mode: 'dir', title: '选择笔记文件夹', start: startPath || _rootPath || '~' })
            .then(function (r) { return r && r.ok ? { ok: true, path: r.path } : { ok: false, cancelled: true }; });
    }

    /* 系统弹窗不可用（没装 zenity/kdialog、tkinter 也没有）时的主兜底：
       直接在页面里浏览文件夹（/api/ls 逐级列目录），选好点「选择当前文件夹」 */
    async function browseAndPick() {
        if (!bridgeOn()) {
            var st = await probeBridge(true);
            if (!st || !st.reachable) { toast('本机服务未启动，请先打开「致知办公助手」'); return false; }
            _backend = 'bridge';
        }
        var res = await browseDir(_rootPath || '~');
        if (!res || !res.ok || !res.path) return false;
        return useBridgeRoot(res.path);
    }

    /* 最后手段：手填 / 粘贴路径（浏览器也打不开时用） */
    async function askPathManually() {
        var def = _rootPath || '';
        var p = await askName('手动输入笔记文件夹路径', def || '例如 /home/用户名/文档/笔记');
        if (p === null) return false;
        p = String(p).replace(/^\s+|\s+$/g, '');
        if (!p) return false;
        var d = await bridgeJson('/api/ls?path=' + encodeURIComponent(p), null, 8000);
        if (!d || !d.ok) {
            toast('打不开这个文件夹：' + bridgeErr(d, '路径不存在'));
            return false;
        }
        return useBridgeRoot(d.path || p);
    }

    async function reauth() {
        if (bridgeOn() || _rootPath) {
            /* 桥接模式没有「授权」概念：重新探测 + 重新扫描即可 */
            var st = await probeBridge(true);
            if (st && st.reachable) {
                await rescan();
                renderList();
                toast('已恢复访问：' + _rootName);
                return;
            }
            toast('本机服务未启动，请先打开「致知办公助手」');
            return;
        }
        if (!_root) { chooseRoot(); return; }
        if (await ensurePerm(_root, true)) {
            await rescan();
            renderList();
            toast('已恢复访问：' + (_rootName || _root.name));
            return;
        }
        toast('授权未通过，请换个文件夹');
    }

    async function start() {
        if (!active()) return false;
        bindNewTarget();
        loadCollapsed();
        var last = '';
        try { last = localStorage.getItem(OPEN_PATH_KEY) || ''; } catch (e) {}

        /* 已处在桥接模式：直接重扫 */
        if (bridgeOn() && _rootPath) {
            await rescan();
            renderList();
            var n0 = findNode(last);
            if (n0) await openFile(n0);
            return true;
        }
        if (!bridgeOn() && _root) { await rescan(); renderList(); return true; }

        /* 老版本只存了 handle：先按 fsapi 恢复 */
        var savedPath = '';
        var savedBackend = '';
        try {
            savedPath = localStorage.getItem(ROOT_PATH_KEY) || '';
            savedBackend = localStorage.getItem(BACKEND_KEY) || '';
        } catch (e) {}

        /* 探测本机服务：能用就优先桥接（linux 浏览器唯一路径） */
        var st = await probeBridge(true);
        if (st && st.canManage && savedPath && savedBackend === 'bridge') {
            var ls = await bridgeJson('/api/ls?path=' + encodeURIComponent(savedPath), null, 5000);
            if (ls && ls.ok) {
                rememberBridgeRoot(savedPath);
                await rescan();
                renderList();
                var n1 = findNode(last);
                if (n1) await openFile(n1);
                return true;
            }
        }

        var saved = await idbGetHandle();
        if (!saved) { renderList(); return false; }
        _root = saved;
        _backend = 'fsapi';
        try { _rootName = localStorage.getItem(ROOT_NAME_KEY) || saved.name || ''; }
        catch (e) { _rootName = saved.name || ''; }
        var ok = await ensurePerm(saved, true);
        if (!ok) {
            /* 浏览器原生权限没恢复：若本机服务可用，直接换桥接模式，免得用户点两次 */
            if (st && st.canManage) {
                var picked0 = await bridgeJson('/api/pick-folder', { title: '请选择笔记文件夹', mode: 'dir' }, 120000);
                if (picked0 && picked0.ok && (picked0.path || picked0.dir)) {
                    rememberBridgeRoot(picked0.path || picked0.dir);
                    await rescan();
                    renderList();
                    await openFirstAvailable();
                    return true;
                }
            }
            _root = null;
            var box = $('npTopicList');
            if (box) {
                box.className = 'npTopicList npTreeList';
                box.innerHTML = '';
                renderAuth(box);
            }
            var meta0 = $('npTopicTotal');
            if (meta0) meta0.textContent = '待授权';
            return false;
        }
        await rescan();
        renderList();
        var node = findNode(last);
        if (node) await openFile(node);
        return true;
    }
    /* ---------------- 新建 / 重命名 / 删除 ---------------- */
    /* fsapi：相对路径以 '/' 结尾；bridge：绝对路径。统一在这里转成「父文件夹」 */
    function folderOfPath(path) {
        if (path) {
            if (bridgeOn()) return null;                    /* bridge 直接用 parentDir(path) */
            var idx = String(path).lastIndexOf('/');
            if (idx < 0) return _root;
            var node = findNode(path.substring(0, idx + 1));
            return (node && node.kind === 'dir') ? node.handle : _root;
        }
        return bridgeOn() ? null : _root;
    }

    function parentOf(path) {
        if (bridgeOn()) {
            var pd = parentDir(path);
            return String(path || '').charAt(0) === '/' ? pd + '/' : pd;
        }
        var idx = String(path || '').lastIndexOf('/');
        return idx < 0 ? '' : path.substring(0, idx + 1);
    }

    function joinRel(parentPath, name) {
        if (bridgeOn()) return joinPath(parentPath || _rootPath, name);
        return (parentPath || '') + name;
    }

    function badName(name) { return !name || /[\\/:*?"<>|]/.test(name); }

    function askName(title, defVal) {
        return new Promise(function (resolve) {
            var mask = document.createElement('div');
            mask.className = 'npLibModalMask';
            var box = document.createElement('div');
            box.className = 'npLibModal';
            box.innerHTML = '<div class="npLibModalTitle">' + esc(title) + '</div>' +
                '<input type="text" class="npLibModalInput" spellcheck="false">' +
                '<div class="npLibModalBtns">' +
                '<button type="button" class="npLibModalBtn" data-ok="0">取消</button>' +
                '<button type="button" class="npLibModalBtn primary" data-ok="1">确定</button></div>';
            mask.appendChild(box);
            document.body.appendChild(mask);
            var input = box.querySelector('.npLibModalInput');
            input.value = defVal || '';
            setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 30);
            function done(ok) {
                var v = (input.value || '').replace(/^\s+|\s+$/g, '');
                if (mask.parentNode) mask.parentNode.removeChild(mask);
                resolve(ok ? v : null);
            }
            box.addEventListener('click', function (e) {
                var b = e.target.closest('[data-ok]');
                if (!b) return;
                done(b.getAttribute('data-ok') === '1');
            });
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); done(true); }
                else if (e.key === 'Escape') { e.preventDefault(); done(false); }
            });
        });
    }

    function confirmBox(title, msg) {
        return new Promise(function (resolve) {
            var mask = document.createElement('div');
            mask.className = 'npLibModalMask';
            var box = document.createElement('div');
            box.className = 'npLibModal';
            box.innerHTML = '<div class="npLibModalTitle">' + esc(title) + '</div>' +
                '<div class="npLibModalMsg">' + esc(msg) + '</div>' +
                '<div class="npLibModalBtns">' +
                '<button type="button" class="npLibModalBtn" data-ok="0">取消</button>' +
                '<button type="button" class="npLibModalBtn primary danger" data-ok="1">确定删除</button></div>';
            mask.appendChild(box);
            document.body.appendChild(mask);
            setTimeout(function () {
                var b = box.querySelector('[data-ok="1"]');
                if (b) try { b.focus(); } catch (e) {}
            }, 30);
            box.addEventListener('click', function (e) {
                var b = e.target.closest('[data-ok]');
                if (!b) return;
                var ok = b.getAttribute('data-ok') === '1';
                if (mask.parentNode) mask.parentNode.removeChild(mask);
                resolve(ok);
            });
            mask.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') {
                    if (mask.parentNode) mask.parentNode.removeChild(mask);
                    resolve(false);
                }
            });
        });
    }

    async function addFolder(parentPath) {
        if (!_rootPath && !_root) { toast('请先选择笔记文件夹'); return; }
        if (parentPath === undefined || parentPath === null) parentPath = currentNewDir();
        var name = await askName('新建类别（在「' + newTargetLabel(parentPath) + '」中）', '新类别');
        if (name === null) return;
        if (badName(name)) { toast('名称不能为空，也不能包含 \\ / : * ? " < > |'); return; }
        try {
            if (bridgeOn()) {
                var d0 = await bridgeJson('/api/mkdir', { path: joinPath(parentPath || _rootPath, name) }, 8000);
                if (!d0 || !d0.ok) { toast('新建类别失败：' + bridgeErr(d0, '本机服务无响应')); return; }
            } else {
                var dir = folderOfPath(parentPath);
                if (!dir) { toast('请先选择笔记文件夹'); return; }
                if (!(await ensurePerm(dir, true))) { toast('没有写入权限'); return; }
                await dir.getDirectoryHandle(name, { create: true });
            }
            if (parentPath) _collapsed[parentPath] = false;
            saveCollapsed();
            await rescan();
            renderList();
            toast('已新建类别：' + name + '（位置：' + newTargetLabel(parentPath) + '）');
        } catch (e) { toast('新建类别失败：' + (e && e.message ? e.message : e)); }
    }

    async function addNote(parentPath) {
        if (!_rootPath && !_root) { toast('请先选择笔记文件夹'); return; }
        if (parentPath === undefined || parentPath === null) parentPath = currentNewDir();
        var name = await askName('新建笔记（在「' + newTargetLabel(parentPath) + '」中，文件名 名称.js）', '新笔记');
        if (name === null) return;
        name = name.replace(/\.js$/i, '');
        if (badName(name)) { toast('名称不能为空，也不能包含 \\ / : * ? " < > |'); return; }
        try {
            if (bridgeOn()) {
                var target = joinPath(parentPath || _rootPath, name + '.js');
                var d1 = await bridgeJson('/api/write', { path: target, content: buildNoteJs(name, noteTemplateHtml(name)) }, 10000);
                if (!d1 || !d1.ok) { toast('新建笔记失败：' + bridgeErr(d1, '本机服务无响应')); return; }
            } else {
                var dir = folderOfPath(parentPath);
                if (!dir) { toast('请先选择笔记文件夹'); return; }
                if (!(await ensurePerm(dir, true))) { toast('没有写入权限'); return; }
                var fh = await dir.getFileHandle(name + '.js', { create: true });
                await writeText(fh, buildNoteJs(name, noteTemplateHtml(name)));
            }
            if (parentPath) _collapsed[parentPath] = false;
            saveCollapsed();
            await rescan();
            var want = joinRel(parentPath, name + '.js');
            var node = findNode(want) || findByStem(name, parentPath);
            _focusFirstArticleOnApply = true;
            if (node) await openFile(node);
            else renderList();
            toast('已新建笔记：' + name + '.js（位置：' + newTargetLabel(parentPath) + '）');
        } catch (e) { toast('新建笔记失败：' + (e && e.message ? e.message : e)); }
    }

    async function renameNode(node) {
        if (!node) return;
        flushCurrent();
        var oldStem = node.kind === 'file' ? stem(node.name) : node.name;
        var name = await askName(node.kind === 'file' ? '重命名笔记（不含 .js）' : '重命名类别', oldStem);
        if (name === null) return;
        if (node.kind === 'file') name = name.replace(/\.js$/i, '');
        if (badName(name)) { toast('名称不能为空，也不能包含 \\ / : * ? " < > |'); return; }
        if (name === oldStem) return;
        var parentPath = parentOf(node.path);
        try {
            if (bridgeOn()) {
                if (node.kind === 'file') {
                    var r1 = await bridgeJson('/api/rename', { path: node.path, name: name + '.js' }, 10000);
                    if (!r1 || !r1.ok) { toast('重命名失败：' + bridgeErr(r1)); return; }
                    if (_openPath === node.path) {
                        _openPath = (r1.data && r1.data.path) || joinRel(parentPath, name + '.js');
                        _openHandle = _openPath;
                        _openTitle = name;
                        persistOpenState();
                    }
                } else {
                    var r2 = await bridgeJson('/api/rename-dir', { path: node.path, name: name }, 15000);
                    if (!r2 || !r2.ok) { toast('重命名失败：' + bridgeErr(r2)); return; }
                    var newDir = (r2.data && r2.data.path) || joinRel(parentPath, name);
                    if (_openPath && _openPath.indexOf(node.path) === 0) {
                        var sep = newDir.indexOf('\\') >= 0 ? '\\' : '/';
                        var tail = _openPath.substring(node.path.length).replace(/^[\\/]+/, '');
                        _openPath = newDir + sep + tail;
                        if (_openHandle) _openHandle = _openPath;
                        persistOpenState();
                    }
                }
                await rescan();
                renderList();
                toast('已重命名：' + name);
                return;
            }
            var dir = folderOfPath(node.path);
            if (node.kind === 'file') {
                var src = await readText(node.handle);
                var fh = await dir.getFileHandle(name + '.js', { create: true });
                await writeText(fh, src);
                await dir.removeEntry(node.name);
                if (_openPath === node.path) {
                    _openPath = parentPath + name + '.js';
                    _openHandle = fh;
                    _openTitle = name;
                    persistOpenState();
                }
            } else {
                await copyDirRecursive(node.handle, dir, name);
                await dir.removeEntry(node.name, { recursive: true });
                if (_openPath && _openPath.indexOf(node.path) === 0) {
                    _openPath = parentPath + name + '/' + _openPath.substring(node.path.length);
                    persistOpenState();
                }
            }
            await rescan();
            renderList();
            toast('已重命名：' + name);
        } catch (e) { toast('重命名失败：' + (e && e.message ? e.message : e)); }
    }

    async function copyDirRecursive(srcDir, destParent, newName) {
        var dest = await destParent.getDirectoryHandle(newName, { create: true });
        for await (var h of srcDir.values()) {
            if (h.kind === 'directory') {
                await copyDirRecursive(h, dest, h.name);
            } else if (h.kind === 'file') {
                var f = await h.getFile();
                var nf = await dest.getFileHandle(h.name, { create: true });
                var w = await nf.createWritable();
                await w.write(await f.arrayBuffer());
                await w.close();
            }
        }
    }

    /* 拖动笔记到另一个文件夹：走本机服务 /api/move 真正搬动文件（等价于剪切） */
    async function moveNoteToFolder(srcPath, targetDir) {
        if (!srcPath || !targetDir) return;
        if (!bridgeOn()) { toast('拖动移动需要本机服务（127.0.0.1:8737）可用'); return; }
        var srcNode = findNode(srcPath);
        var srcName = srcNode ? srcNode.name : '';
        var targetLabel = targetDir === _rootPath ? (_rootName || '根文件夹') :
            (function () { var n = findNode(targetDir); return n ? n.name : targetDir; })();
        if (!confirm('将把《' + stem(srcName) + '》移动到「' + targetLabel + '」，是否继续？')) return;
        flushCurrent();
        try {
            var r = await bridgeJson('/api/move', { path: srcPath, dest_dir: targetDir }, 20000);
            if (!r || !r.ok) {
                if (r && /未知接口|404/.test(String(r.error || ''))) {
                    toast('本机服务版本过旧，缺少移动接口，请更新「致知办公助手」');
                } else {
                    toast('移动失败：' + bridgeErr(r, '本机服务无响应'));
                }
                renderList();
                return;
            }
            var newPath = (r.data && r.data.path) || joinPath(targetDir, srcName);
            if (_openPath === srcPath) {
                _openPath = newPath;
                _openHandle = newPath;
                persistOpenState();
            }
            await rescan();
            renderList();
            toast('已移动到「' + targetLabel + '」');
        } catch (e) {
            toast('移动失败：' + (e && e.message ? e.message : e));
            renderList();
        }
    }

    async function deleteNode(node) {
        if (!node) return;
        flushCurrent();
        var label = node.kind === 'file' ? stem(node.name) : node.name;
        var msg = node.kind === 'file'
            ? '笔记「' + label + '」会从磁盘上真正删除，无法撤销。'
            : '类别「' + label + '」及其中所有文件会从磁盘上真正删除，无法撤销。';
        var ok = await confirmBox('确定删除？', msg);
        if (!ok) return;
        try {
            if (bridgeOn()) {
                if (node.kind === 'file') {
                    var d0 = await bridgeJson('/api/delete', { path: node.path }, 10000);
                    if (!d0 || !d0.ok) { toast('删除失败：' + bridgeErr(d0)); return; }
                } else {
                    var d1 = await bridgeJson('/api/rmdir', { path: node.path, recursive: true }, 30000);
                    if (!d1 || !d1.ok) { toast('删除失败：' + bridgeErr(d1)); return; }
                }
            } else {
                var dir = folderOfPath(node.path);
                if (node.kind === 'file') await dir.removeEntry(node.name);
                else await dir.removeEntry(node.name, { recursive: true });
            }
            var hit = _openPath === node.path ||
                (node.kind === 'dir' && _openPath.indexOf(node.path) === 0);
            if (hit) {
                _openPath = '';
                _openHandle = null;
                _openTitle = '';
                persistOpenState();
                applyDoc('', '');
            }
            await rescan();
            renderList();
            toast('已删除：' + label);
        } catch (e) { toast('删除失败：' + (e && e.message ? e.message : e)); }
    }
    /* ---------------- 右键菜单 ---------------- */
    function closeCtx() {
        if (_ctxEl) { _ctxEl.remove(); _ctxEl = null; }
    }

    function assignToWin(node, slot) {
        if (!(slot >= 0 && slot < 5) || !node) return;
        if (!(window.npMultiView && typeof window.npMultiView.assign === 'function')) {
            toast('多窗预览模块未加载');
            return;
        }
        window.npMultiView.assign(slot, {
            kind: 'note', path: node.path, name: node.name, title: stem(node.name)
        });
    }

    function openCtx(node, x, y) {
        closeCtx();
        var isDir = node.kind === 'dir';
        var mvItems = isDir ? '' : [0, 1, 2, 3, 4].map(function (slot) {
            var mark = (window.npMultiView && typeof window.npMultiView.slotMark === 'function')
                ? window.npMultiView.slotMark(slot) : '';
            return '<div class="npTopicCtxItem" data-libact="mv" data-mvslot="' + slot + '">窗口 ' + (slot + 1) + mark + '</div>';
        }).join('');
        var mvSub = isDir ? '' :
            '<div class="npTopicCtxItem npLibCtxHasSub" data-libsub="mv">' +
            '<span>添加到小窗</span><span class="npLibCtxArrow">▸</span>' +
            '<div class="npLibCtxSub">' + mvItems + '</div></div>';
        var el = document.createElement('div');
        el.className = 'npTopicCtx npLibCtx';
        el.innerHTML =
            (isDir
                ? '<div class="npTopicCtxItem" data-libact="new-note">新建笔记</div>' +
                  '<div class="npTopicCtxItem" data-libact="new-folder">新建子类别</div>' +
                  '<div class="npTopicCtxItem" data-libact="rename">重命名类别</div>' +
                  '<div class="npTopicCtxItem npDanger" data-libact="delete">删除类别</div>'
                : '<div class="npTopicCtxItem" data-libact="open">打开</div>' +
                  mvSub +
                  '<div class="npTopicCtxItem" data-libact="rename">重命名</div>' +
                  '<div class="npTopicCtxItem npLibCtxHasSub" data-libsub="html">' +
                  '<span>导出 html</span><span class="npLibCtxArrow">▸</span>' +
                  '<div class="npLibCtxSub">' +
                  '<div class="npTopicCtxItem" data-libact="export-html-all">整体导出</div>' +
                  '<div class="npTopicCtxItem" data-libact="export-html-split">分割导出</div>' +
                  '</div></div>' +
                  '<div class="npTopicCtxItem" data-libact="export-docx">导出 docx</div>' +
                  '<div class="npTopicCtxItem npDanger" data-libact="delete">删除文件</div>');
        document.body.appendChild(el);
        var w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, x)) + 'px';
        el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, y)) + 'px';
        _ctxEl = el;
        el.addEventListener('click', function (ev) {
            var it = ev.target.closest('[data-libact]');
            if (!it) return;
            var act = it.getAttribute('data-libact');
            closeCtx();
            if (act === 'open') openFile(node);
            else if (act === 'mv') assignToWin(node, parseInt(it.getAttribute('data-mvslot'), 10));
            else if (act === 'new-note') addNote(node.path);
            else if (act === 'new-folder') addFolder(node.path);
            else if (act === 'rename') renameNode(node);
            else if (act === 'delete') deleteNode(node);
            else if (act === 'export-html-all' || act === 'export-html-split' || act === 'export-docx') {
                /* 先切到该文件，再走标题栏右键的同一套导出函数 */
                var nd = findNode(node.path);
                if (nd) {
                    openFile(nd).then(function () {
                        if (act === 'export-docx') {
                            if (typeof window.confirmNotepadExportDocxAll === 'function') window.confirmNotepadExportDocxAll();
                            else toast('当前版本不支持导出 docx');
                        } else if (typeof window.confirmNotepadExportHtmlSplit === 'function' && act === 'export-html-split') {
                            window.confirmNotepadExportHtmlSplit();
                        } else if (typeof window.confirmNotepadExportHtmlCurrent === 'function') {
                            window.confirmNotepadExportHtmlCurrent();
                        } else toast('当前版本不支持导出 html');
                    });
                }
            }
        });
    }

    /* ---------------- 事件绑定 ---------------- */
    function bind() {
        var list = $('npTopicList');
        if (list && !list._npLibBound) {
            list._npLibBound = true;
            list.addEventListener('click', function (e) {
                var act = e.target.closest('[data-libact]');
                if (act) {
                    var a = act.getAttribute('data-libact');
                    if (a === 'pick') chooseRoot();
                    else if (a === 'path') askPathManually();
                    else if (a === 'reauth') reauth();
                    else if (a === 'refresh') {
                        rescan().then(function () { renderList(); toast('已刷新'); });
                    }
                    return;
                }
                var row = e.target.closest('[data-lib-path]');
                if (!row) return;
                var path = row.getAttribute('data-lib-path');
                var kind = row.getAttribute('data-lib-kind');
                if (kind === 'dir') {
                    _collapsed[path] = !_collapsed[path];
                    saveCollapsed();
                    renderList();
                } else {
                    var node = findNode(path);
                    if (node) openFile(node);
                }
            });
            list.addEventListener('contextmenu', function (e) {
                var row = e.target.closest('[data-lib-path]');
                if (!row) return;
                e.preventDefault();
                var node = findNode(row.getAttribute('data-lib-path'));
                if (node) openCtx(node, e.clientX, e.clientY);
            });
            /* ---- 拖动：把笔记拖到另一个文件夹（等价于剪切到该文件夹） ---- */
            list.addEventListener('dragstart', function (e) {
                var row = e.target.closest('[data-lib-path]');
                if (!row) return;
                var path = row.getAttribute('data-lib-path');
                var kind = row.getAttribute('data-lib-kind');
                if (kind !== 'file') { e.preventDefault(); return; }
                _dragPath = path;
                _dragKind = kind;
                row.classList.add('npTreeDragging');
                try {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', path);
                } catch (e2) {}
            });
            list.addEventListener('dragend', function (e) {
                var row = e.target.closest('[data-lib-path]');
                if (row) row.classList.remove('npTreeDragging');
                clearTreeDropMarks();
                _dragPath = null;
                _dragKind = null;
            });
            list.addEventListener('dragover', function (e) {
                if (!_dragPath) return;
                var row = e.target.closest('[data-lib-path]');
                if (!row) return;
                var tPath = row.getAttribute('data-lib-path');
                if (tPath === _dragPath) return;
                // 同一层：上下拖动排序
                if (parentOf(_dragPath) === parentOf(tPath)) {
                    e.preventDefault();
                    try { e.dataTransfer.dropEffect = 'move'; } catch (e2) {}
                    clearTreeDropMarks();
                    var rr = row.getBoundingClientRect();
                    var below = (e.clientY - rr.top) > rr.height / 2;
                    row.classList.add(below ? 'npTreeDropAfter' : 'npTreeDropBefore');
                    return;
                }
                // 跨层：只能放进文件夹；拖到文件上时，视为放进该文件所在的文件夹
                var tKind = row.getAttribute('data-lib-kind');
                var targetDir = tKind === 'dir' ? tPath : parentOf(tPath);
                if (!targetDir) return;
                if (parentOf(_dragPath) === targetDir) return;
                e.preventDefault();
                try { e.dataTransfer.dropEffect = 'move'; } catch (e2) {}
                clearTreeDropMarks();
                row.classList.add('npTreeDropTarget');
            });
            list.addEventListener('dragleave', function (e) {
                var row = e.target.closest('[data-lib-path]');
                if (row) row.classList.remove('npTreeDropTarget');
            });
            list.addEventListener('drop', function (e) {
                if (!_dragPath) return;
                var row = e.target.closest('[data-lib-path]');
                if (!row) return;
                e.preventDefault();
                e.stopPropagation();
                var srcPath = _dragPath;
                var tPath = row.getAttribute('data-lib-path');
                var tKind = row.getAttribute('data-lib-kind');
                var below = row.classList.contains('npTreeDropAfter');
                // 同一层：本地重排（文件在磁盘上的顺序不变，排序结果记在 localStorage）
                if (parentOf(srcPath) === parentOf(tPath)) {
                    clearTreeDropMarks();
                    _dragPath = null;
                    _dragKind = null;
                    reorderSibling(srcPath, tPath, below);
                    return;
                }
                var targetDir = tKind === 'dir' ? tPath : parentOf(tPath);
                clearTreeDropMarks();
                _dragPath = null;
                _dragKind = null;
                if (!targetDir || srcPath === tPath || parentOf(srcPath) === targetDir) { renderList(); return; }
                moveNoteToFolder(srcPath, targetDir);
            });
            document.addEventListener('mousedown', function (e) {
                if (_ctxEl && !e.target.closest('.npLibCtx')) closeCtx();
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && _ctxEl) closeCtx();
            });
            window.addEventListener('resize', closeCtx);
        }

        var folderBtn = $('npLibFolderBtn');
        if (folderBtn) {
            /* 鼠标滑过：在按钮下方浮出当前文件夹路径 */
            if (!folderBtn._npTipBound) {
                folderBtn._npTipBound = true;
                folderBtn.addEventListener('mouseenter', function () {
                    var old = document.getElementById('npFolderTip');
                    if (old) old.parentNode.removeChild(old);
                    var p = _rootPath || _rootName || '';
                    var tip = document.createElement('div');
                    tip.id = 'npFolderTip';
                    tip.className = 'npFolderTip';
                    tip.textContent = p || '尚未选择数据文件夹';
                    document.body.appendChild(tip);
                    var r = folderBtn.getBoundingClientRect();
                    tip.style.left = Math.max(6, Math.min(window.innerWidth - tip.offsetWidth - 6, r.left)) + 'px';
                    tip.style.top = (r.bottom + 5) + 'px';
                });
                folderBtn.addEventListener('mouseleave', function () {
                    var old = document.getElementById('npFolderTip');
                    if (old) old.parentNode.removeChild(old);
                });
            }
            if (!folderBtn._npLibBound) {
                folderBtn._npLibBound = true;
                folderBtn.addEventListener('click', function () { chooseRoot(); });
            }
        }

        /* 左上角状态标签：点一下重新检测；「重试」按钮同效 */
        var pill = $('npBridgePill');
        if (pill && !pill._npLibBound) {
            pill._npLibBound = true;
            pill.addEventListener('click', function () {
                refreshBridgePill().then(function (st) {
                    if (st && st.reachable) toast('本机服务已连接');
                    else toast('未检测到本机服务，请先打开「致知办公助手」');
                });
            });
        }
        var retryBtn = $('npBridgeRetry');
        if (retryBtn && !retryBtn._npLibBound) {
            retryBtn._npLibBound = true;
            retryBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                refreshBridgePill().then(function (st) {
                    toast(st && st.reachable ? '本机服务已连接' : '未检测到本机服务');
                });
            });
        }
        /* 顶栏最右箭头：收起 / 展开左侧笔记列表（与「列表」按钮同一套状态） */
        var arrow = $('npCollapseTopicBtn');
        if (arrow && !arrow._npLibBound) {
            arrow._npLibBound = true;
            arrow.addEventListener('click', function (e) {
                e.preventDefault();
                if (typeof window.npTogglePane === 'function') window.npTogglePane('topic');
                else if (typeof window.npToggleWorkspaceSides === 'function') window.npToggleWorkspaceSides();
            });
        }

        /* 栏头「计数」：点一下弹浮窗，显示类别数与笔记文件数 */
        var countBtn = $('npTopicTotal');
        if (countBtn && !countBtn._npLibBound) {
            countBtn._npLibBound = true;
            countBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var el = $('npCountPop');
                if (el) { el.parentNode.removeChild(el); return; }
                if (!_root && !_rootPath) { toast('还没有选择数据文件夹'); return; }
                var st = countTreeStats(_tree);
                var pop = document.createElement('div');
                pop.id = 'npCountPop';
                pop.className = 'npCountPop';
                pop.innerHTML =
                    '<div class="npCountPopTitle">数据统计</div>' +
                    '<div class="npCountPopRow"><span>类别</span><b>' + st.dirs + '</b><span class="u">个</span></div>' +
                    '<div class="npCountPopRow"><span>笔记文件</span><b>' + st.files + '</b><span class="u">个</span></div>' +
                    '<div class="npCountPopTip">类别 = 直接存放笔记文件的文件夹</div>';
                document.body.appendChild(pop);
                var r = countBtn.getBoundingClientRect();
                pop.style.left = Math.max(6, Math.min(window.innerWidth - pop.offsetWidth - 6, r.left)) + 'px';
                pop.style.top = (r.bottom + 6) + 'px';
                setTimeout(function () {
                    document.addEventListener('click', function close() {
                        document.removeEventListener('click', close);
                        var p2 = $('npCountPop');
                        if (p2) p2.parentNode.removeChild(p2);
                    }, { once: true });
                }, 0);
            });
        }

        /* 栏头按钮组：一行显示，放不下时左右箭头滑动 */
        var navWrap = npHeadNav;
        var navScroll = npHeadNavScroll;
        if (navWrap && navScroll && !navWrap._npNavBound) {
            navWrap._npNavBound = true;
            var edgeL = npHeadNavLeft;
            var edgeR = npHeadNavRight;
            var syncNav = function () {
                var need = navScroll.scrollWidth > navScroll.clientWidth + 1;
                navWrap.classList.toggle('npNavHasScroll', need);
                if (edgeL) edgeL.disabled = navScroll.scrollLeft <= 1;
                if (edgeR) edgeR.disabled = navScroll.scrollLeft + navScroll.clientWidth >= navScroll.scrollWidth - 1;
            };
            if (edgeL) edgeL.addEventListener('click', function (e) {
                e.preventDefault();
                navScroll.scrollLeft -= 40;
            });
            if (edgeR) edgeR.addEventListener('click', function (e) {
                e.preventDefault();
                navScroll.scrollLeft += 40;
            });
            navScroll.addEventListener('scroll', syncNav);
            window.addEventListener('resize', syncNav);
            navWrap._npSyncNav = syncNav;
            setTimeout(syncNav, 0);
        }

        /* 栏头刷新按钮（原在「笔记 / 本机服务」行上，已移到 +新增 右侧） */
        var libRefresh = $('npLibRefreshBtn');
        if (libRefresh && !libRefresh._npLibBound) {
            libRefresh._npLibBound = true;
            libRefresh.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (!_root && !_rootPath) { toast('还没有选择数据文件夹'); return; }
                rescan().then(function () { renderList(); toast('已刷新'); });
            });
        }

        var ed = $('notepadEditor');
        if (ed && !ed._npLibInput) {
            ed._npLibInput = true;
            ed.addEventListener('input', function () { markDirty(); scheduleCache(); });
        }

        if (!window._npLibKeyBound) {
            window._npLibKeyBound = true;
            document.addEventListener('keydown', function (e) {
                if (!active()) return;
                if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
                if (String(e.key).toLowerCase() !== 's') return;
                var panel = $('notepadPanel');
                if (!panel || !panel.classList.contains('show')) return;
                if (!_openPath) return;
                e.preventDefault();
                saveToFile();
            }, true);
        }
    }

    /* ---------------- 新建位置：跟随左栏点选的那一行 ---------------- */
    /* 点文件夹 → 建在它里面；点笔记 → 建在它同级；点空白 / 根行 → 根目录 */
    var _newTargetDir = null;

    function dirOfKind(path, kind) {
        if (kind === 'dir') return path;
        if (kind === 'file') return parentOf(path);
        return '';
    }

    function captureNewTarget(e) {
        var box = $('npTopicList');
        if (!box) return;
        var row = e.target && e.target.closest ? e.target.closest('[data-lib-path]') : null;
        if (row && box.contains(row)) {
            _newTargetDir = dirOfKind(row.getAttribute('data-lib-path'), row.getAttribute('data-lib-kind'));
        } else if (e.target === box || (e.target && e.target.id === 'npTopicList')) {
            _newTargetDir = '';
        }
    }

    function currentNewDir() {
        if (_newTargetDir === null) return _openPath ? parentOf(_openPath) : '';
        if (!_newTargetDir) return '';
        var p = _newTargetDir;
        var withSlash = /[\\/]$/.test(p) ? p : p + '/';
        if (findNode(withSlash) || findNode(p)) return p;
        return '';
    }

    function newTargetLabel(dir) {
        if (!dir) return _rootName || baseName(_rootPath || '') || '根目录';
        var n = findNode(/[\\/]$/.test(dir) ? dir : dir + '/') || findNode(dir);
        return (n && n.name) || baseName(dir) || dir;
    }

    function openAddMenu(btn, x, y) {
        closeCtx();
        var currentDir = currentNewDir();
        var el = document.createElement('div');
        el.className = 'npTopicCtx npLibCtx';
        el.innerHTML = '<div class="npTopicCtxItem" data-libact="new-folder">新建类别（文件夹）</div>' +
            '<div class="npTopicCtxItem" data-libact="new-note">新建笔记（.js 文件）</div>';
        document.body.appendChild(el);
        var r = btn ? btn.getBoundingClientRect() : null;
        var px = r ? r.right - el.offsetWidth : (x || 10);
        var py = r ? r.bottom + 4 : (y || 10);
        el.style.left = Math.max(6, Math.min(window.innerWidth - el.offsetWidth - 6, px)) + 'px';
        el.style.top = Math.max(6, Math.min(window.innerHeight - el.offsetHeight - 6, py)) + 'px';
        _ctxEl = el;
        el.addEventListener('click', function (ev) {
            var it = ev.target.closest('[data-libact]');
            if (!it) return;
            var act = it.getAttribute('data-libact');
            closeCtx();
            if (act === 'new-folder') addFolder(currentDir);
            else if (act === 'new-note') addNote(currentDir);
        });
    }

    /* 记下用户点选的位置，供「＋ 新增」与右键新建使用 */
    function bindNewTarget() {
        var box = $('npTopicList');
        if (!box || box._npNewTargetBound) return;
        box._npNewTargetBound = true;
        box.addEventListener('mousedown', captureNewTarget, true);
        box.addEventListener('click', captureNewTarget, true);
    }

    window.npLibNewTarget = function () { return currentNewDir(); };

    /* 右侧工具栏「保存」：一键把当前笔记写回 .js 文件（不再有下拉菜单） */
    window.npSaveCurrentNote = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        closeCtx();
        if (!_openPath) {
            try { if (typeof window.saveCurrentEditor === 'function') window.saveCurrentEditor(); } catch (err) {}
            toast('还没有打开笔记文件，内容已存到本机缓存');
            return;
        }
        toast('正在保存到 ' + currentDocLabel() + '.js …');
        saveToFile();
    };

    /* 「显示」菜单里的导出入口（原来挂在保存下拉上） */
    window.npExportFromMenu = function (which) {
        try { if (typeof window.paCloseDropdowns === 'function') window.paCloseDropdowns(); } catch (e) {}
        var map = {
            'js-current': 'confirmNotepadExportJsCurrent',
            'js-all': 'confirmNotepadExportJsAll',
            'html-all': 'confirmNotepadExportHtml',
            'html-split': 'confirmNotepadExportHtmlSplit',
            'html-current': 'confirmNotepadExportHtmlCurrent',
            'docx-current': 'confirmNotepadExportDocxCurrent',
            'docx-all': 'confirmNotepadExportDocxAll'
        };
        var fn = map[which];
        if (!fn || typeof window[fn] !== 'function') { toast('导出功能不可用'); return; }
        try { window[fn](); } catch (e) { toast('导出失败：' + (e && e.message ? e.message : e)); }
    };

    /* ---------------- 对外接口 ---------------- */
    window.npLibActive = active;
    window.npLibRender = renderList;
    window.npLibStart = start;
    window.npLibSave = saveToFile;
    window.npLibChooseFolder = chooseRoot;
    window.npLibAddFolder = addFolder;
    window.npLibAddNote = addNote;
    window.npLibAddMenu = function (anchor) { openAddMenu(anchor, 0, 0); };
    window.npLibOpenPath = function () { return _openPath; };
    window.npLibRootName = function () { return _rootName; };
    window.npLibTree = function () { return _tree; };
    window.npLibRefresh = function () { return rescan().then(function () { renderList(); }); };
    window.npLibSetRoot = function (handle) {   /* 测试用：直接注入假句柄 */
        rememberRoot(handle);
        return rescan().then(function () { renderList(); });
    };
    window.npLibCurrentNode = function () { return _openPath ? findNode(_openPath) : null; };

    /* 桥接后端：探测 / 注入（测试与「重新连接服务」按钮用） */
    window.npLibProbe = function () { return probeBridge(true); };
    window.npLibBridgeState = function () { return _bridgeState; };
    window.npLibRefreshPill = refreshBridgePill;
    window.npLibBrowsePick = browseAndPick;
    window.npLibRootPath = function () { return _rootPath || ''; };
    /* 预览栏「笔记」页检索用：按树节点读一篇笔记并解析成 html/title */
    window.npLibReadNode = async function (node) {
        if (!node) throw new Error('笔记不存在');
        var text = await readText(bridgeOn() ? node.path : (node.handle || node.path));
        return parseNoteJs(text, node.name || '');
    };
    /* 已打开/保存过的笔记缓存（path -> html），检索优先用它，少读磁盘 */
    window.npLibDocsCache = loadDocs;
    /* 只把第 seq 篇文章的正文写回 .js：其余文章原样保留 */
    window.npLibWriteArticle = async function (node, seq, html) {
        if (!node) throw new Error('笔记不存在');
        var raw = await readText(bridgeOn() ? node.path : (node.handle || node.path));
        var cur = parseNoteJs(raw, node.name || '');
        if (!cur || !cur.html) throw new Error('读不到原文件');
        var next = spliceArticle(cur.html, seq, html || '');
        if (next === null) throw new Error('文章定位失败，请刷新后重试');
        /* 删除保护：原本有多篇、删完却剩 0 篇，或一次少掉多篇，都视为分块错位，拒绝写入 */
        var beforeN = countArticleBlocks(cur.html);
        var afterN = countArticleBlocks(next);
        if ((beforeN > 1 && afterN === 0) || afterN < beforeN - 1) throw new Error('文章定位异常（' + beforeN + '→' + afterN + '），已取消本次写入');
        var out = patchNoteHtml(raw, next) || buildNoteJs(cur.title, next);
        await writeText(bridgeOn() ? node.path : (node.handle || node.path), out);
        cacheSet(node.path, next);
        return true;
    };

    /* 只替换 savedData 里的正文，其他字段（字号/样式/多标签）原样保留 */
    function patchNoteHtml(raw, html) {
        var s = String(raw == null ? '' : raw);
        var m = s.search(/var\s+savedData\s*=/);
        if (m < 0) return null;
        var start = s.indexOf('{', m);
        if (start < 0) return null;
        var end = matchBrace(s, start);
        if (end <= start) return null;
        var data;
        try { data = JSON.parse(s.substring(start, end + 1)); } catch (e) { return null; }
        var done = false;
        if (data && data.file && typeof data.file.html === 'string') {
            data.file.html = html;
            done = true;
        }
        if (!done && data && data.notepad && Array.isArray(data.notepad.editorData) && data.notepad.editorData[0]) {
            data.notepad.editorData[0].html = html;
            done = true;
        }
        if (!done && data && data.notepad && Array.isArray(data.notepad.data) && typeof data.notepad.data[0] === 'string') {
            data.notepad.data[0] = html;
            done = true;
        }
        if (!done) return null;
        return s.substring(0, start) + JSON.stringify(data, null, 2) + s.substring(end + 1);
    }

    /* 用 html 替换 fullHtml 里的第 seq 篇文章，返回新的整篇 html；越界返回 null。
       分块口径必须与 notepad-prevsearch.js 的 articleEntries 一致：
       只有索引标题开新篇，普通文章标题只是本篇内容，否则 seq 错位会删错内容。 */
    function spliceArticle(fullHtml, seq, html) {
        var box = document.createElement('div');
        box.innerHTML = fullHtml || '';
        var nodes = Array.prototype.slice.call(box.childNodes);
        var blocks = [], cur = null;
        /* 与中部 scanArticles 同一口径：重复索引标题之间没有正文时只算一篇 */
        function indexRunOnlyBetween(fromExclusive, toExclusive) {
            for (var i = fromExclusive + 1; i < toExclusive; i++) {
                var q = nodes[i];
                if (q.nodeType === 3) { if (String(q.nodeValue || '').replace(/^\s+|\s+$/g, '')) return false; continue; }
                if (q.nodeType !== 1) continue;
                var qt = String(q.textContent || '').replace(/^\s+|\s+$/g, '');
                if (!qt) continue;
                if (q.tagName !== 'P') return false;
                if (q.getAttribute('data-outline-level') === '1') continue;
                var lv = q.getAttribute('data-level') || '';
                if (lv === 'title' || lv === 'date' || lv === 'author') continue;
                return false;
            }
            return true;
        }
        nodes.forEach(function (el, i) {
            var isP = el.nodeType === 1 && el.tagName === 'P';
            var txt = isP ? (el.textContent || '').replace(/^\s+|\s+$/g, '') : '';
            if (!isP || !txt) {
                if (cur) cur.items.push(el);
                return;
            }
            if (el.getAttribute('data-outline-level') === '1') {
                var prev = blocks.length ? blocks[blocks.length - 1] : null;
                if (prev && prev.pendingDup && indexRunOnlyBetween(prev.idx, i)) return;
                if (prev) prev.pendingDup = false;
                cur = { items: [el], idx: i, pendingDup: true };
                blocks.push(cur);
                return;
            }
            if (cur) cur.items.push(el);
        });
        if (!blocks.length || seq < 0 || seq >= blocks.length) return null;
        var wrap = document.createElement('div');
        wrap.innerHTML = '<p>__NPTMP__</p>' + (html || '');
        var frag = document.createDocumentFragment();
        Array.prototype.slice.call(wrap.childNodes).forEach(function (el) {
            if (el.nodeType === 1 && el.tagName === 'P' && (el.textContent || '') === '__NPTMP__') return;
            frag.appendChild(el);
        });
        var target = blocks[seq].items[0];
        target.parentNode.insertBefore(frag, target);
        blocks[seq].items.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
        return box.innerHTML;
    }
    function countArticleBlocks(html) {
        var box = document.createElement('div');
        box.innerHTML = html || '';
        var ps = Array.prototype.slice.call(box.querySelectorAll('p'));
        var n = 0, idxs = [];
        ps.forEach(function (p, i) {
            var txt = (p.textContent || '').replace(/^\s+|\s+$/g, '');
            if (!txt) return;
            if (p.getAttribute('data-outline-level') !== '1') return;
            idxs.push({ i: i, p: p });
        });
        for (var k = 0; k < idxs.length; k++) {
            var prev = k ? idxs[k - 1] : null;
            if (prev) {
                /* 两个索引标题之间只有标题/日期/作者，算同一次重复写入 */
                var onlyMeta = true;
                for (var j = prev.i + 1; j < idxs[k].i; j++) {
                    var q = ps[j];
                    var qt = (q.textContent || '').replace(/^\s+|\s+$/g, '');
                    if (!qt) continue;
                    var lv = q.getAttribute('data-level') || '';
                    if (lv !== 'title' && lv !== 'date' && lv !== 'author') { onlyMeta = false; break; }
                }
                if (onlyMeta) continue;
            }
            n++;
        }
        return n;
    }
    /* 通用页面内路径选择器：预览栏 / 附件页在系统弹窗不可用（无 zenity/tkinter）时用 */
    window.npPickPath = browsePath;

    /* 多窗预览「选择文件」：优先系统文件选择框，没有图形工具时退回页面内浏览 */
    window.npPickLocalFile = function (opts) {
        opts = opts || {};
        var title = opts.title || '选择文件';
        var start = opts.start || _rootPath || '~';
        return bridgeJson('/api/pick-folder', { title: title, mode: 'file' }, 300000).then(function (d) {
            if (d && d.ok && (d.path || d.dir)) return { ok: true, path: d.path || d.dir, isDir: false };
            if (d && d.need_path) return browsePath({ mode: 'file', title: title, start: start });
            if (!d) return browsePath({ mode: 'file', title: title, start: start });
            return { ok: false, cancelled: true, error: d.error || '' };
        });
    };
    window.npLibBackend = function () { return _backend || '(未选)'; };
    window.npLibBridgeOn = bridgeOn;
    window.npLibSetBridgeRoot = function (path) {   /* 测试用：直接指定文件夹绝对路径 */
        rememberBridgeRoot(path);
        return rescan().then(function () { renderList(); });
    };
    window.npLibUseNative = function () {           /* 从桥接切回浏览器原生选择 */
        _backend = 'fsapi';
        _root = null;
        _rootPath = '';
        try { localStorage.setItem(BACKEND_KEY, _backend); localStorage.setItem(ROOT_PATH_KEY, ''); } catch (e) {}
        return start();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { bind(); if (active()) start(); });
    } else {
        setTimeout(function () { bind(); if (active()) start(); }, 0);
    }
})();