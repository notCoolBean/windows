/* 致知笔记 · 预览栏「本地」页
   三个文件夹槽位（各存一个绝对路径）+ 文件树 + 右侧只读预览。
   目录数据与「用默认程序打开」都走「致知办公助手」本机服务（127.0.0.1:8737）：
     /api/ping 探活 → /api/ls 列目录 → /api/read 取字节（base64）→ /api/open 系统打开
   本机服务不可用时给出提示，不弹系统文件框（麒麟上本程序本就依赖该服务）。 */
(function () {
    'use strict';

    var BRIDGE_DEFAULT = 'http://127.0.0.1:8737';
    var SLOT_KEY = 'npPrevFolderSlots';
    var SLOT_CUR_KEY = 'npPrevFolderCur';
    var SLOT_TITLES = ['文件夹 1', '文件夹 2', '文件夹 3'];

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
        bmp: 'picture.ico', webp: 'picture.ico', svg: 'picture.ico', tif: 'picture.ico', tiff: 'picture.ico',
        mp4: 'movie.ico', avi: 'movie.ico', mkv: 'movie.ico', mov: 'movie.ico',
        mp3: 'music.ico', wav: 'music.ico', flac: 'music.ico',
        psd: 'psd.ico', ai: 'psd.ico'
    };
    var IMAGE_EXT = { png: 1, jpg: 1, jpeg: 1, gif: 1, bmp: 1, webp: 1, svg: 1, ico: 1 };
    var DOC_EXT = { doc: 1, docx: 1, wps: 1, rtf: 1 };

    var _slots = ['', '', ''];
    var _cur = 0;
    var _tree = null;
    var _expanded = {};
    var _file = null;
    var _busy = false;
    var _seq = 0;

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return (typeof escapeHtml === 'function') ? escapeHtml(String(s == null ? '' : s))
            : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function toast(msg) {
        if (typeof showToast === 'function') showToast(msg);
        else if (window.TZ && window.TZ.toast) window.TZ.toast(msg);
    }

    function extOf(name) {
        var m = String(name || '').match(/\.([A-Za-z0-9]+)$/);
        return m ? m[1].toLowerCase() : '';
    }
    function iconFor(name, isDir) {
        if (isDir) return TYPE_ICON_DIR + 'folder.ico';
        return TYPE_ICON_DIR + (EXT_ICON[extOf(name)] || 'file.ico');
    }
    function iconTag(name, isDir) {
        return '<img src="' + esc(iconFor(name, isDir)) + '" alt="" draggable="false">';
    }

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
            }, ms || 8000);
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

    function base64ToBytes(b64) {
        var bin = atob(String(b64 || ''));
        var out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }
    function bytesToText(bytes) {
        var dec = null;
        try { dec = new TextDecoder('utf-8', { fatal: true }); } catch (e) { dec = null; }
        if (dec) {
            try { return dec.decode(bytes); } catch (e) {}
        }
        try { return new TextDecoder('gbk').decode(bytes); } catch (e) {}
        return new TextDecoder('utf-8').decode(bytes);
    }

    /* ---------------- 槽位 ---------------- */
    function loadSlots() {
        try {
            var arr = JSON.parse(localStorage.getItem(SLOT_KEY) || 'null');
            if (arr && arr.length) {
                for (var i = 0; i < 3; i++) _slots[i] = typeof arr[i] === 'string' ? arr[i] : '';
            }
        } catch (e) {}
        try {
            var c = parseInt(localStorage.getItem(SLOT_CUR_KEY) || '0', 10);
            _cur = isFinite(c) && c >= 0 && c < 3 ? c : 0;
        } catch (e) { _cur = 0; }
    }
    function saveSlots() {
        try {
            localStorage.setItem(SLOT_KEY, JSON.stringify(_slots));
            localStorage.setItem(SLOT_CUR_KEY, String(_cur));
        } catch (e) {}
    }

    function renderSlots() {
        var host = $('npPrevFolderSlots');
        if (!host) return;
        var html = '';
        for (var i = 0; i < 3; i++) {
            var p = _slots[i];
            var name = p ? p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() : '';
            var cls = 'npPrevSlot' + (p ? ' set' : '') + (i === _cur ? ' cur' : '');
            var tip = p ? name : (SLOT_TITLES[i] + '\n单击选择文件夹');
            html += '<button type="button" class="' + cls + '" data-slot="' + i + '" title="' + esc(tip) + '">' +
                iconTag(name || 'folder', true) + '</button>';
        }
        host.innerHTML = html;
    }

    function slotName(i) {
        var p = _slots[i] || '';
        if (!p) return SLOT_TITLES[i] + '（未选择）';
        return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
    }

    /* 拿到路径后的统一落地 */
    function applySlotPath(i, p) {
        _slots[i] = String(p);
        _cur = i;
        saveSlots();
        renderSlots();
        loadTree();
        toast('已选择' + SLOT_TITLES[i] + '：' + slotName(i));
        return true;
    }

    /* 系统选择框不可用（麒麟上常见：没有 zenity/kdialog，tkinter 也可能缺）时，
       退到页面内文件浏览器（/api/ls 逐级浏览），这条路径一定可用 */
    function pickSlotBrowsing(i) {
        var start = _slots[i] || (typeof window.npLibRootPath === 'function' ? window.npLibRootPath() : '') || '~';
        var fn = window.npPickPath;
        if (typeof fn !== 'function') { toast('本机没有可用的文件选择方式，请升级后重试'); return Promise.resolve(false); }
        return Promise.resolve(fn({ mode: 'dir', title: '选择' + SLOT_TITLES[i], start: start })).then(function (r) {
            if (!r || !r.ok || !r.path) return false;
            return applySlotPath(i, r.path);
        });
    }

    function pickSlot(i) {
        return bridgeJson('/api/pick-folder', { title: '选择' + SLOT_TITLES[i], mode: 'dir' }, 120000).then(function (d) {
            if (!d) { toast('未连接「致知办公助手」服务（127.0.0.1:8737）'); return false; }
            var p = d.path || d.folder || d.dir || '';
            if (!d.ok || !p) {
                if (d.need_path) return pickSlotBrowsing(i);
                if (d.error && d.error !== '已取消' && d.error !== '未选择'
                    && !/tkinter|图形界面|图形选择/.test(String(d.error))) toast(d.error);
                return false;
            }
            return applySlotPath(i, p);
        });
    }

    /* 双击槽位：直接打开文件夹选择器，选完后清空旧列表并重新读取 */
    function reselectSlot(i) {
        _slots[i] = '';
        if (_cur === i) { _file = null; _tree = null; }
        saveSlots();
        renderSlots();
        loadTree();
        return pickSlot(i);
    }

    function useSlot(i) {
        if (!_slots[i]) return pickSlot(i);
        if (i === _cur) return Promise.resolve(true);
        _cur = i;
        saveSlots();
        renderSlots();
        _file = null;
        return loadTree();
    }

    /* ---------------- 文件树 ---------------- */
    function loadTree() {
        var root = _slots[_cur];
        var body = $('npFvBody');
        var pathEl = $('npFvPath');
        if (pathEl) {
            if (root) {
                var leaf = root.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || root;
                pathEl.innerHTML = '<span class="npFvPathText" title="' + esc(root) + '">' + esc(root) + '</span>' +
                    '<span class="npFvPathTag" title="' + esc(leaf) + '">' + esc(leaf) + '</span>';
            } else {
                pathEl.innerHTML = '<span class="npFvPathText">（未选择文件夹，点上方文件夹图标选择）</span>';
            }
        }
        _file = null;
        if (!root) {
            _tree = null;
            var treeHost = $('npFvTree');
            var treeView = $('npFvView');
            if (treeHost) treeHost.innerHTML = '<div class="npFvEmpty">还没有选择文件夹。<br>点标题行右侧的文件夹图标，选一个目录后这里会列出文件。</div>';
            if (treeView) treeView.innerHTML = '';
            return Promise.resolve(false);
        }
        _busy = true;
        var mine = ++_seq;
        var loading = $('npFvTree');
        if (loading) loading.innerHTML = '<div class="npFvEmpty">正在读取…</div>';
        return bridgeJson('/api/ls?path=' + encodeURIComponent(root), null, 20000).then(function (d) {
            if (mine !== _seq) return false;
            _busy = false;
            if (!d || d.ok === false) {
                _tree = null;
                var fail = $('npFvTree');
                if (fail) {
                    fail.innerHTML = '<div class="npFvEmpty">' +
                        (d ? esc(d.error || '读取失败') : '未连接「致知办公助手」服务（127.0.0.1:8737）') +
                        '<br>请确认办公助手已启动后重试。</div>';
                }
                return false;
            }
            _tree = buildTree(root, (d.entries || []));
            renderTree();
            return true;
        });
    }

    function joinPath(dir, name) {
        var d = String(dir || '').replace(/[\\/]+$/, '');
        if (!d) return name;
        var sep = d.indexOf('\\') >= 0 || /^[A-Za-z]:/.test(d) ? '\\' : '/';
        return d + sep + name;
    }

    function buildTree(root, entries) {
        var dirs = [], files = [];
        for (var i = 0; i < entries.length; i++) {
            var en = entries[i] || {};
            var name = en.name || '';
            if (!name || name === '.' || name === '..') continue;
            var isDir = en.type === 'dir' || en.dir === true;
            if (isDir) {
                dirs.push({ kind: 'dir', name: name, path: joinPath(root, name), children: null, loaded: false });
            } else {
                files.push({ kind: 'file', name: name, path: joinPath(root, name), ext: extOf(name) });
            }
        }
        dirs.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); });
        files.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); });
        return dirs.concat(files);
    }

    function renderTree() {
        var host = $('npFvTree');
        var view = $('npFvView');
        if (!host || !view) {
            var body = $('npFvBody');
            if (!body) return;
            body.innerHTML = '<div class="npFvTree" id="npFvTree"></div>' +
                '<div class="npFvView" id="npFvView"></div>';
            host = $('npFvTree');
            view = $('npFvView');
            if (!host || !view) return;
        }
        host.innerHTML = '';
        if (!_tree || !_tree.length) {
            host.innerHTML = '<div class="npFvEmpty">（此文件夹为空）</div>';
        } else {
            walk(_tree, 0, host);
        }
        if (!view.innerHTML) {
            view.innerHTML = '<div class="npFvEmpty">左侧点文件即可在这里预览；不支持的类型会调系统默认程序打开。</div>';
        }
        var cur = _file;
        if (cur) {
            var rows = host.querySelectorAll('.npFvRow');
            for (var i = 0; i < rows.length; i++) {
                rows[i].classList.toggle('cur', rows[i].getAttribute('data-path') === cur.path);
            }
        }
    }

    function walk(nodes, depth, host) {
        for (var i = 0; i < nodes.length; i++) {
            (function (node) {
                var row = document.createElement('div');
                var isDir = node.kind === 'dir';
                row.className = 'npFvRow';
                row.setAttribute('data-path', node.path);
                row.setAttribute('data-kind', isDir ? 'dir' : 'file');
                row.setAttribute('data-name', node.name);
                row.title = node.path;
                row.style.paddingLeft = (4 + depth * 12) + 'px';
                var arrow = isDir ? (_expanded[node.path] ? '▾' : '▸') : '';
                row.innerHTML = '<span class="npFvArrow">' + arrow + '</span>' +
                    iconTag(node.name, isDir) + '<span class="nm">' + esc(node.name) + '</span>';
                row.addEventListener('click', function () {
                    if (isDir) toggleDir(node);
                    else openFile(node);
                });
                host.appendChild(row);
                if (isDir && _expanded[node.path] && node.children) {
                    walk(node.children, depth + 1, host);
                }
            })(nodes[i]);
        }
    }

    function toggleDir(node) {
        if (_expanded[node.path]) {
            _expanded[node.path] = false;
            renderTree();
            return;
        }
        if (node.loaded) {
            _expanded[node.path] = true;
            renderTree();
            return;
        }
        bridgeJson('/api/ls?path=' + encodeURIComponent(node.path), null, 20000).then(function (d) {
            if (!d || d.ok === false) {
                toast(d ? (d.error || '读取失败') : '未连接「致知办公助手」服务');
                return;
            }
            node.children = buildTree(node.path, d.entries || []);
            node.loaded = true;
            _expanded[node.path] = true;
            renderTree();
        });
    }

    /* ---------------- 预览调度 ---------------- */
    function fileUrl(p) {
        var s = String(p || '').replace(/\\/g, '/');
        if (/^[A-Za-z]:\//.test(s)) return 'file:///' + s;
        if (s.charAt(0) === '/') return 'file://' + s;
        return 'file:///' + s;
    }

    function openFile(node) {
        _file = node;
        var view = $('npFvView');
        if (!view) { renderTree(); return; }
        var rows = document.querySelectorAll('#npFvBody .npFvRow');
        for (var i = 0; i < rows.length; i++) {
            rows[i].classList.toggle('cur', rows[i].getAttribute('data-path') === node.path);
        }
        showFile(node, view);
    }

    function fileHead(node) {
        return '<div class="npFvFileHead" title="' + esc(node.path) + '">' + esc(node.name) + '</div>';
    }

    function showFile(node, view) {
        var ext = node.ext || extOf(node.name);
        var mine = ++_seq;

        if (IMAGE_EXT[ext]) {
            view.innerHTML = fileHead(node) + '<div class="npFvFileBody"><img class="npFvImg" src="' +
                esc(fileUrl(node.path)) + '" alt=""></div>';
            return;
        }

        if (ext === 'pdf') {
            if (!window.NpPdfView) {
                view.innerHTML = fileHead(node) + '<div class="npFvFileBody"><div class="npFvEmpty">PDF 预览组件未加载。</div></div>';
                return;
            }
            var oldHost = view.querySelector('.npFvPdfHost');
            if (oldHost && window.NpPdfView) { try { window.NpPdfView.destroy(oldHost); } catch (e) {} }
            var host = document.createElement('div');
            host.className = 'npFvPdfHost';
            view.innerHTML = fileHead(node) +
                '<div class="npFvPdfBar">' +
                '<button type="button" class="npFvPdfPrev" title="上一页（PgUp）">上一页</button>' +
                '<span class="npFvPdfPage">1 / 1</span>' +
                '<button type="button" class="npFvPdfNext" title="下一页（PgDn）">下一页</button>' +
                '</div>';
            view.appendChild(host);
            var prevBtn = view.querySelector('.npFvPdfPrev');
            var nextBtn = view.querySelector('.npFvPdfNext');
            var pageLabel = view.querySelector('.npFvPdfPage');
            function syncLocalPdfPage(page, total) {
                if (pageLabel) pageLabel.textContent = (page || 1) + ' / ' + (total || 1);
                if (prevBtn) prevBtn.disabled = !(total > 1);
                if (nextBtn) nextBtn.disabled = !(total > 1);
            }
            if (prevBtn) prevBtn.addEventListener('click', function () { window.NpPdfView.step(host, -1); });
            if (nextBtn) nextBtn.addEventListener('click', function () { window.NpPdfView.step(host, 1); });
            readBytes(node.path).then(function (bytes) {
                if (mine !== _seq) return;
                if (!bytes) { view.innerHTML = fileHead(node) + '<div class="npFvFileBody"><div class="npFvEmpty">读取失败，可双击标题用默认程序打开。</div></div>'; return; }
                try { window.NpPdfView.destroy(view); } catch (e) {}
                window.NpPdfView.render(host, bytes, { fit: true, onPage: syncLocalPdfPage }).catch(function () {});
            });
            return;
        }

        if (ext === 'txt' || ext === 'md' || ext === 'log' || ext === 'csv' || ext === 'ini' ||
            ext === 'json' || ext === 'js') {
            view.innerHTML = fileHead(node) + '<div class="npFvFileBody"><div class="npFvEmpty">正在读取…</div></div>';
            readBytes(node.path).then(function (bytes) {
                if (mine !== _seq) return;
                if (!bytes) { view.innerHTML = fileHead(node) + '<div class="npFvFileBody"><div class="npFvEmpty">读取失败，可双击标题用默认程序打开。</div></div>'; return; }
                var text = bytesToText(bytes).slice(0, 400 * 1024);
                view.innerHTML = fileHead(node) + '<div class="npFvFileBody"><pre class="npFvPre">' +
                    esc(text) + '</pre></div>';
            });
            return;
        }

        if (DOC_EXT[ext] || ext === 'htm' || ext === 'html' || ext === 'mht' || ext === 'mhtml') {
            view.innerHTML = fileHead(node) + '<div class="npFvFileBody"><div class="npFvEmpty">正在解析…</div></div>';
            readBytes(node.path).then(function (bytes) {
                if (mine !== _seq) return;
                if (!bytes) { view.innerHTML = fileHead(node) + '<div class="npFvFileBody"><div class="npFvEmpty">读取失败，可双击标题用默认程序打开。</div></div>'; return; }
                renderDocument(view, node, bytes, ext);
            });
            return;
        }

        view.innerHTML = fileHead(node) + '<div class="npFvFileBody"><div class="npFvEmpty">该格式不能在页面内预览。' +
            '<br>双击标题行或用「用默认程序打开」查看。</div></div>';
    }

    function renderDocument(view, node, bytes, ext, noHead) {
        var DV = window.NpfDocView;
        var into = !!noHead;
        if (!DV) {
            view.innerHTML = into ? '<div class="npFvEmpty">预览组件未加载。</div>'
                : fileHead(node) + '<div class="npFvFileBody"><div class="npFvEmpty">预览组件未加载。</div></div>';
            return;
        }
        var html = '';
        if (ext === 'htm' || ext === 'html') {
            html = DV.renderHtml(bytes, {});
        } else if (ext === 'mht' || ext === 'mhtml') {
            html = DV.renderMht(bytes);
        } else if (DV.isDocx(bytes)) {
            DV.renderDocx(bytes).then(function (res) {
                if (!res || !res.html) {
                    view.innerHTML = (into ? '' : fileHead(node) + '<div class="npFvFileBody">') +
                        '<div class="npFvEmpty">这份文档没有可显示的正文（可能已加密或只含图片）。</div>' +
                        (into ? '' : '</div>');
                    return;
                }
                var inner = res.html;
                if (DV.fitWrapped && res.width) inner = DV.fitWrapped(inner, res.width);
                view.innerHTML = (into ? '' : fileHead(node) + '<div class="npFvFileBody">') +
                    inner + (into ? '' : '</div>');
                if (DV.bindFit) { try { DV.bindFit(view); } catch (e) {} }
            }).catch(function (e) {
                if (window.console && console.warn) console.warn('[npFv] docx 渲染失败', e);
                view.innerHTML = (into ? '' : fileHead(node) + '<div class="npFvFileBody">') +
                    '<div class="npFvEmpty">解析失败，可用默认程序打开。</div>' + (into ? '' : '</div>');
            });
            return;
        } else if (window.NpfDoc && window.NpfDoc.isOle(bytes)) {
            /* Word 97-2003（OLE 二进制）：按 FKP + SPRM 还原字号/颜色/对齐/缩进，
               解析失败再回落纯文本。.wps / .rtf 若内容其实是 OLE 也走这里。 */
            var rich = null;
            try { rich = window.NpfDoc.richBlocks(bytes); } catch (e) { rich = null; }
            var resDoc = null;
            try { resDoc = rich ? DV.renderDocFormat(rich) : null; } catch (e) { resDoc = null; }
            if (resDoc && resDoc.html) {
                view.innerHTML = (into ? '' : fileHead(node) + '<div class="npFvFileBody">') +
                    resDoc.html + (into ? '' : '</div>');
                if (DV.bindFit) { try { DV.bindFit(view); } catch (e) {} }
                return;
            }
            var plain = '';
            try { plain = window.NpfDoc.plainText(bytes) || ''; } catch (e) { plain = ''; }
            if (!plain && window.NpfDocParse && window.NpfDocParse.docPlainText) {
                try { plain = window.NpfDocParse.docPlainText(bytes) || ''; } catch (e) { plain = ''; }
            }
            view.innerHTML = (into ? '' : fileHead(node) + '<div class="npFvFileBody">') +
                (plain ? '<pre class="npFvPre">' + esc(plain) + '</pre>'
                       : '<div class="npFvEmpty">没有可显示的内容（可能已加密）。</div>') + (into ? '' : '</div>');
            return;
        } else {
            html = '<pre class="npFvPre">' + esc(window.NpfDocParse ? window.NpfDocParse.docPlainText(bytes) : '') + '</pre>';
        }
        if (!html || !/<[a-z]/i.test(html)) {
            view.innerHTML = (into ? '' : fileHead(node) + '<div class="npFvFileBody">') +
                '<div class="npFvEmpty">没有可显示的内容。</div>' + (into ? '' : '</div>');
            return;
        }
        view.innerHTML = (into ? '' : fileHead(node) + '<div class="npFvFileBody">') + html + (into ? '' : '</div>');
    }

    function readBytes(path) {
        return bridgeJson('/api/read?path=' + encodeURIComponent(path), null, 30000).then(function (d) {
            if (!d || d.ok === false || !d.base64) return null;
            try { return base64ToBytes(d.base64); } catch (e) { return null; }
        });
    }

    /* ---------------- 供多窗预览复用：渲染到指定容器 ---------------- */
    var _intoUrls = typeof WeakMap === 'function' ? new WeakMap() : null;

    function intoHead(node, inner) {
        if (!node) return;
        var head = document.createElement('div');
        head.className = 'npFvFileHead';
        head.title = node.path || '';
        head.textContent = node.name || '';
        inner.appendChild(head);
    }

    function intoBody(inner, cls) {
        var body = document.createElement('div');
        body.className = 'npFvFileBody' + (cls ? ' ' + cls : '');
        inner.appendChild(body);
        return body;
    }

    function intoEmpty(inner, text) {
        var body = intoBody(inner);
        body.innerHTML = '<div class="npFvEmpty">' + esc(text) + '</div>';
    }

    function npFvRevokeInto(inner) {
        if (!inner) return;
        if (window.NpPdfView) {
            var hosts = inner.querySelectorAll('.npPdfBody');
            for (var i = 0; i < hosts.length; i++) { try { window.NpPdfView.destroy(hosts[i]); } catch (e) {} }
        }
        if (!_intoUrls) return;
        var urls = _intoUrls.get(inner);
        if (!urls) return;
        urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
        _intoUrls.delete(inner);
    }

    function npFvRenderInto(inner, node) {
        if (!inner || !node) return Promise.resolve(false);
        npFvRevokeInto(inner);
        inner.innerHTML = '';
        intoHead(node, inner);
        var ext = node.ext || extOf(node.name);

        if (IMAGE_EXT[ext]) {
            return readBytes(node.path).then(function (bytes) {
                if (!bytes) { intoEmpty(inner, '读取失败，可用默认程序打开。'); return false; }
                var mime = {
                    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
                    bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon'
                }[ext] || 'application/octet-stream';
                var url = URL.createObjectURL(new Blob([bytes], { type: mime }));
                if (_intoUrls) {
                    var arr = _intoUrls.get(inner) || [];
                    arr.push(url);
                    _intoUrls.set(inner, arr);
                }
                var body = intoBody(inner);
                var img = document.createElement('img');
                img.className = 'npFvImg';
                img.alt = '';
                img.src = url;
                body.appendChild(img);
                return true;
            }).catch(function () { intoEmpty(inner, '读取失败。'); return false; });
        }

        if (ext === 'pdf') {
            return readBytes(node.path).then(function (bytes) {
                if (!bytes) { intoEmpty(inner, '读取失败，可用默认程序打开。'); return false; }
                if (!window.NpPdfView) { intoEmpty(inner, 'PDF 预览组件未加载。'); return false; }
                var body = intoBody(inner, 'npMvPdfBody');
                return window.NpPdfView.render(body, bytes, { fit: false }).then(function () { return true; })
                    .catch(function () { intoEmpty(inner, 'PDF 渲染失败，可用默认程序打开。'); return false; });
            }).catch(function () { intoEmpty(inner, '读取失败。'); return false; });
        }

        if (ext === 'txt' || ext === 'md' || ext === 'log' || ext === 'csv' || ext === 'ini' ||
            ext === 'json' || ext === 'js' || ext === 'css' || ext === 'xml' || ext === 'py' ||
            ext === 'sh' || ext === 'bat' || ext === 'ps1' || ext === 'yml' || ext === 'yaml' || ext === 'sql') {
            return readBytes(node.path).then(function (bytes) {
                if (!bytes) { intoEmpty(inner, '读取失败，可用默认程序打开。'); return false; }
                var text = bytesToText(bytes).slice(0, 400 * 1024);
                var body = intoBody(inner);
                var pre = document.createElement('pre');
                pre.className = 'npFvPre';
                pre.textContent = text;
                body.appendChild(pre);
                return true;
            }).catch(function () { intoEmpty(inner, '读取失败。'); return false; });
        }

        if (DOC_EXT[ext] || ext === 'htm' || ext === 'html' || ext === 'mht' || ext === 'mhtml') {
            return readBytes(node.path).then(function (bytes) {
                if (!bytes) { intoEmpty(inner, '读取失败，可用默认程序打开。'); return false; }
                var body = intoBody(inner);
                renderDocument(body, node, bytes, ext, true);
                return true;
            }).catch(function () { intoEmpty(inner, '读取失败。'); return false; });
        }

        intoEmpty(inner, '该格式不能在页面内预览。可用默认程序打开。');
        return Promise.resolve(false);
    }

    function openWithSystem(path) {
        return bridgeJson('/api/open', { path: path }, 8000).then(function (d) {
            if (!d || d.ok === false) toast(d ? (d.error || '打开失败') : '未连接「致知办公助手」服务');
        });
    }

    /* ---------------- 入口 ---------------- */
    function bind() {
        var host = $('npPrevFolderSlots');
        if (host && !host._npFvBound) {
            host._npFvBound = true;
            host.addEventListener('click', function (e) {
                var b = e.target.closest('.npPrevSlot');
                if (!b) return;
                var i = parseInt(b.getAttribute('data-slot'), 10);
                if (!isFinite(i)) return;
                useSlot(i);
            });
            host.addEventListener('dblclick', function (e) {
                var b = e.target.closest('.npPrevSlot');
                if (!b) return;
                e.preventDefault();
                var i = parseInt(b.getAttribute('data-slot'), 10);
                if (!isFinite(i)) return;
                reselectSlot(i);
            });
        }
        var body = $('npFvBody');
        if (body && !body._npFvDbl) {
            body._npFvDbl = true;
            body.addEventListener('dblclick', function (e) {
                var path = e.target.closest('.npFvFileHead');
                if (path && _file) openWithSystem(_file.path);
            });
        }
    }

    function render() {
        loadSlots();
        renderSlots();
        bind();
        if (!_tree) loadTree();
        else renderTree();
    }

    window.npFvRender = render;
    window.npFvLoadSlots = loadSlots;
    window.npFvLoadTree = loadTree;
    window.npFvDeleteFile = function (path) {
        var p = String(path || '');
        if (!p) return Promise.resolve(false);
        if (!window.confirm('确定删除文件「' + p.split(/[\\/]/).pop() + '」吗？')) return Promise.resolve(false);
        return bridgeJson('/api/delete', { path: p }, 15000).then(function (d) {
            if (!d || !d.ok) {
                toast(d ? (d.error || '删除失败') : '未连接「致知办公助手」服务');
                return false;
            }
            if (_file && _file.path === p) {
                _file = null;
                var view = $('npFvView');
                if (view) view.innerHTML = '<div class="npFvEmpty">文件已删除。</div>';
            }
            toast('已删除：' + p.split(/[\\/]/).pop());
            return loadTree().then(function () { return true; });
        });
    };
    window.npFvOpenWithSystem = openWithSystem;
    window.npFvRenderInto = npFvRenderInto;
    window.npFvShowFile = showFile;
    window.npFvRevokeInto = npFvRevokeInto;
    window.npFvSlots = function () { return _slots.slice(); };
    window.npFvCurrent = function () { return { slot: _cur, root: _slots[_cur] || '', file: _file && _file.path }; };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
