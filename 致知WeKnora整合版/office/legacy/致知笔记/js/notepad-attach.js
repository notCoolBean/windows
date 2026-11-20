/* 致知笔记 · 预览栏「附件」页
   图片 / 文件 / 文件夹三态；图片用「粘入图片」按钮读剪贴板或「选择图片」从磁盘选，
   页面级 Ctrl+V 不再响应（会与右侧编辑区的粘图冲突）。
   数据改存本机 localStorage（键 npAttachments）：
     - 图片：读入后按最长边 1800px、JPEG 0.85 压成 dataURL 内嵌（换机器会丢，但零依赖）
     - 文件 / 文件夹：只存绝对路径，打开时交给「致知办公助手」的 /api/open
   添加一律强制输入别名（图片 / 文件 / 文件夹统一），别名留空就不入库。
   单击打开：图片在附件区上方的浮层里预览（图片等比铺满、支持上一张/下一张、
    全屏占满中部三栏），点 × 或 Esc 返回列表；文件 / 文件夹交给系统默认程序。右键删除。 */
(function () {
    'use strict';

    var KEY = 'npAttachments';
    var BRIDGE_DEFAULT = 'http://127.0.0.1:8737';
    var TYPE_DIR = 'data/type/';
    /* 麒麟等环境 localStorage 上限约 5MB，图片必须压得很小才放得下：
       最长边先压到 1280，还超标就 960 → 720，质量同步降到 0.6。 */
    var IMG_MAX_EDGE = 1280;
    var IMG_QUALITY = 0.75;
    var IMG_KEEP_BYTES = 150 * 1024;
    var IMG_TARGET_BYTES = 220 * 1024;
    var IMG_STEPS = [
        { edge: 1280, q: 0.75 },
        { edge: 960, q: 0.68 },
        { edge: 720, q: 0.6 }
    ];

    var ICON_MAP = {
        doc: 'docx', docx: 'docx', wps: 'docx', rtf: 'docx',
        xls: 'excel', xlsx: 'excel', et: 'excel', csv: 'csv',
        ppt: 'excel', pptx: 'excel', dps: 'excel',
        pdf: 'pdf', txt: 'txt', md: 'txt', log: 'txt',
        json: 'json', js: 'json', html: 'html', htm: 'html', mht: 'html', mhtml: 'html',
        png: 'picture', jpg: 'picture', jpeg: 'picture', gif: 'picture', bmp: 'picture',
        webp: 'picture', svg: 'picture', tif: 'picture', tiff: 'picture',
        mp4: 'movie', avi: 'movie', mkv: 'movie', mov: 'movie', wmv: 'movie',
        mp3: 'music', wav: 'music', flac: 'music', m4a: 'music',
        psd: 'psd', zip: 'winrar', rar: 'winrar', '7z': 'winrar'
    };

    var _items = null;
    var _view = { index: -1 };
    var _viewerFind = { timer: null, base: '', active: false };

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
        var m = String(name || '').match(/\.([A-Za-z0-9]{1,6})$/);
        return m ? m[1].toLowerCase() : '';
    }
    function iconFor(item) {
        if (item.kind === 'folder') return TYPE_DIR + 'folder.ico';
        if (item.kind === 'image') return TYPE_DIR + 'picture.ico';
        return TYPE_DIR + (ICON_MAP[extOf(item.name || item.src)] || 'file') + '.ico';
    }
    function fileNameOf(p) {
        var s = String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
        var parts = s.split('/');
        return parts[parts.length - 1] || s;
    }
    function isAbsolute(p) {
        var s = String(p || '').replace(/\\/g, '/');
        return /^[A-Za-z]:\//.test(s) || s.charAt(0) === '/';
    }
    function labelOf(it) {
        return it.alias || it.name || fileNameOf(it.src) || '附件';
    }

    /* ---------------- 存储 ---------------- */
    function load() {
        if (_items) return _items;
        try {
            var arr = JSON.parse(localStorage.getItem(KEY) || '[]');
            _items = Array.isArray(arr) ? arr : [];
        } catch (e) { _items = []; }
        return _items;
    }
    /* 存储满时自动淘汰「最老的图片附件」腾空间，最多淘汰到只剩这一张，
       避免一粘截图就弹「本地存储已满」（麒麟上 localStorage 只有约 5MB）。 */
    function save(items) {
        var list = items.slice();
        for (var guard = 0; guard < 40; guard++) {
            try {
                localStorage.setItem(KEY, JSON.stringify(list));
                if (list.length !== items.length) {
                    var cut = items.length - list.length;
                    toast('存储空间不足，已自动移除 ' + cut + ' 张最早的图片');
                }
                _items = list;
                return true;
            } catch (e) {
                /* 找最老的图片附件删掉；没有图片就把非图片附件也考虑进来 */
                var victim = -1;
                for (var i = 0; i < list.length; i++) {
                    if (list[i].kind === 'image') { victim = i; break; }
                }
                if (victim < 0 && list.length > 1) victim = 0;
                if (victim < 0) {
                    toast('附件太大，浏览器本地存储已满，请删除部分附件后重试');
                    return false;
                }
                list.splice(victim, 1);
            }
        }
        toast('附件太大，浏览器本地存储已满，请删除部分附件后重试');
        return false;
    }

    function uid() {
        return 'att' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    /* ---------------- 别名输入 ---------------- */
    /* 添加附件一律先问别名；返回 Promise<string|null>（null = 取消） */
    /* suggest = 输入框预填的别名；full = 下方展示的完整路径 / 文件名（含后缀） */
    function askAlias(kind, suggest, full) {
        var label = kind === 'image' ? '图片' : (kind === 'folder' ? '文件夹' : '文件');
        return new Promise(function (resolve) {
            var css = [
                '.npa-overlay{position:fixed;inset:0;z-index:99995;background:rgba(20,40,34,.42);display:flex;align-items:center;justify-content:center;}',
                '.npa{width:360px;max-width:92vw;background:#FFF;border:1px solid #CFDCD5;border-radius:10px;box-shadow:0 18px 48px rgba(20,50,40,.26);overflow:hidden;font:13px/1.5 "Microsoft YaHei","Noto Sans CJK SC",system-ui,sans-serif;color:#2A3A34;}',
                '.npa-hd{padding:11px 14px;background:#F5FAF7;border-bottom:1px solid #E4EDE8;font-weight:600;font-size:13.5px;color:#2E6B5E;}',
                '.npa-bd{padding:14px;}',
                '.npa-bd input{width:100%;box-sizing:border-box;height:32px;padding:0 9px;border:1px solid #CFDCD5;border-radius:6px;font-size:13px;color:#2A3A34;outline:none;}',
                '.npa-bd input:focus{border-color:#2E6B5E;box-shadow:0 0 0 2px rgba(46,107,94,.14);}',
                '.npa-tip{margin-top:7px;font-size:11.5px;color:#8AA29A;word-break:break-all;}',
                '.npa-ft{display:flex;gap:9px;justify-content:flex-end;padding:0 14px 13px;}',
                '.npa-ft button{height:30px;padding:0 15px;border-radius:6px;border:1px solid #CFDCD5;background:#FFF;color:#3E6B5C;font-size:12.5px;cursor:pointer;}',
                '.npa-ft .ok{background:#2E6B5E;border-color:#2E6B5E;color:#FFF;font-weight:600;}'
            ].join('');
            var st = document.getElementById('npa-style');
            if (!st) {
                st = document.createElement('style');
                st.id = 'npa-style';
                st.textContent = css;
                document.head.appendChild(st);
            }
            var ov = document.createElement('div');
            ov.className = 'npa-overlay';
            ov.innerHTML =
                '<div class="npa"><div class="npa-hd">为' + label + '命名</div>' +
                '<div class="npa-bd"><input type="text" maxlength="80" placeholder="请输入别名（必填）">' +
                '<div class="npa-tip"></div></div>' +
                '<div class="npa-ft"><button type="button" class="ok">确定</button>' +
                '<button type="button" class="cancel">取消</button></div></div>';
            document.body.appendChild(ov);
            var inp = ov.querySelector('input');
            var tip = ov.querySelector('.npa-tip');
            /* 下方那行显示文件（夹）的完整名称，含后缀名 */
            var fullText = String(full || suggest || '');
            tip.textContent = fullText;
            tip.title = fullText;
            /* 输入框默认填入建议名字，用户可直接回车确认或改名 */
            inp.value = String(suggest || '');
            var finished = false;
            function done(v) {
                if (finished) return;
                if (v === '' && inp.value.trim()) v = inp.value.trim();
                finished = true;
                document.removeEventListener('keydown', onKey);
                if (ov.parentNode) ov.parentNode.removeChild(ov);
                resolve(v);
            }
            function submit() {
                var v = String(inp.value || '').trim();
                if (!v) { tip.textContent = '别名不能为空'; inp.focus(); return; }
                done(v);
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); done(null); }
                else if (e.key === 'Enter') { e.preventDefault(); submit(); }
            }
            document.addEventListener('keydown', onKey);
            ov.querySelector('.ok').addEventListener('click', submit);
            ov.querySelector('.cancel').addEventListener('click', function () { done(null); });
            ov.addEventListener('mousedown', function (e) { if (e.target === ov) done(null); });
            setTimeout(function () { try { inp.focus(); } catch (e) {} }, 0);
        });
    }

    /* ---------------- 渲染 ---------------- */
    function render() {
        var grid = $('npAttachGrid');
        var count = $('npAttachCount');
        var items = load();
        if (count) count.textContent = items.length ? (items.length + ' 个附件') : '暂无附件';
        if (!grid) return;
        if (!items.length) {
            grid.innerHTML = '<div class="npFvEmpty">还没有附件。<br>点上方「粘入图片 / 选择图片 / 加文件 / 加文件夹」添加。</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var label = labelOf(it);
            var thumb = (it.kind === 'image' && it.src)
                ? '<img class="thumb" src="' + esc(it.src) + '" alt="">'
                : '<img class="thumb" style="object-fit:contain;padding:10px" src="' + esc(iconFor(it)) + '" alt="">';
            html += '<div class="npAttachItem" data-index="' + i + '" data-kind="' + esc(it.kind) +
                '" title="' + esc(label + '\n' + (it.kind === 'image' ? '（内嵌图片）' : it.src) + '\n单击打开，右键删除') + '">' +
                thumb + '<div class="lb">' + esc(label) + '</div></div>';
        }
        grid.innerHTML = html;
    }

    /* ---------------- 图片压缩 ---------------- */
    function dataUrlBytes(src) {
        var s = String(src || '');
        var i = s.indexOf(',');
        if (i < 0) return 0;
        var pad = (s.charAt(s.length - 1) === '=' ? 1 : 0) + (s.charAt(s.length - 2) === '=' ? 1 : 0);
        return Math.floor((s.length - i - 1) * 3 / 4) - pad;
    }

    /* 逐级压缩，直到低于 IMG_TARGET_BYTES 或试完所有档位 */
    function shrinkDataUrl(src) {
        return new Promise(function (resolve) {
            var s = String(src || '');
            var before = dataUrlBytes(s);
            if (!/^data:image\//i.test(s) || before <= IMG_KEEP_BYTES) {
                resolve({ src: s, before: before, after: before });
                return;
            }
            var img = new Image();
            img.onload = function () {
                try {
                    var w0 = img.naturalWidth || img.width || 0;
                    var h0 = img.naturalHeight || img.height || 0;
                    if (!w0 || !h0) { resolve({ src: s, before: before, after: before }); return; }
                    var best = s;
                    var bestBytes = before;
                    for (var i = 0; i < IMG_STEPS.length; i++) {
                        var step = IMG_STEPS[i];
                        var scale = Math.min(1, step.edge / Math.max(w0, h0));
                        var w = Math.max(1, Math.round(w0 * scale));
                        var h = Math.max(1, Math.round(h0 * scale));
                        var cv = document.createElement('canvas');
                        cv.width = w;
                        cv.height = h;
                        var ctx = cv.getContext('2d');
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, w, h);
                        ctx.drawImage(img, 0, 0, w, h);
                        var out = cv.toDataURL('image/jpeg', step.q);
                        var bytes = dataUrlBytes(out);
                        if (bytes < bestBytes) { best = out; bestBytes = bytes; }
                        if (bestBytes <= IMG_TARGET_BYTES) break;
                    }
                    resolve({ src: best, before: before, after: bestBytes });
                } catch (e) {
                    resolve({ src: s, before: before, after: before });
                }
            };
            img.onerror = function () { resolve({ src: s, before: before, after: before }); };
            img.src = s;
        });
    }

    /* 图片入库：先压缩，再强制输入别名 */
    function addImageDataUrl(src, name) {
        if (!src) { toast('图片读取失败'); return Promise.resolve(false); }
        return shrinkDataUrl(src).then(function (r) {
            if (!r.src) { toast('图片读取失败'); return false; }
            var suggest = String(name || '').replace(/\.[^.]+$/, '') || '';
            return askAlias('image', suggest, String(name || '')).then(function (alias) {
                if (!alias) return false;
                var items = load().slice();
                items.push({
                    id: uid(), kind: 'image', src: r.src,
                    name: name || ('图片' + (items.filter(function (x) { return x.kind === 'image'; }).length + 1) + '.jpg'),
                    alias: alias
                });
                if (!save(items)) return false;
                render();
                var kb = Math.round(r.after / 1024);
                toast('已添加图片「' + alias + '」' + (kb ? '（' + kb + ' KB）' : ''));
                return true;
            });
        });
    }

    function addImageFile(file) {
        if (!file) return Promise.resolve(false);
        return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onload = function () {
                addImageDataUrl(String(reader.result || ''), file.name).then(resolve);
            };
            reader.onerror = function () { toast('读取图片失败'); resolve(false); };
            reader.readAsDataURL(file);
        });
    }

    /* ---------------- 本机服务 ---------------- */
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
            fetch(bridgeBase() + pathname, opt).then(function (r) { return r.json(); })
                .then(function (d) {
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

    /* 把一条路径加进附件列表（强制别名） */
    function pushPathItem(kind, p) {
        var name = fileNameOf(p);
        var suggest = kind === 'folder' ? name : String(name || '').replace(/\.[^.]+$/, '');
        /* 下方提示显示完整名称（文件含后缀），预填用去掉后缀的建议名 */
        return askAlias(kind, suggest, name || String(p || '')).then(function (alias) {
            if (!alias) return false;
            var items = load().slice();
            items.push({ id: uid(), kind: kind, src: String(p), name: name, alias: alias });
            if (!save(items)) return false;
            render();
            toast('已添加' + (kind === 'folder' ? '文件夹' : '文件') + '「' + alias + '」');
            return true;
        });
    }

    /* 系统选择框不可用（麒麟常见：无 zenity / kdialog，tkinter 也可能缺）时的页面内浏览 */
    function pickByBrowsing(kind) {
        var fn = window.npPickPath;
        if (typeof fn !== 'function') { toast('本机没有可用的文件选择方式，请升级后重试'); return Promise.resolve(false); }
        var start = '';
        try { start = window.npLibRootPath ? window.npLibRootPath() : ''; } catch (e) {}
        return Promise.resolve(fn({
            mode: kind === 'folder' ? 'dir' : 'file',
            title: kind === 'folder' ? '选择文件夹' : '选择文件',
            start: start || '~'
        })).then(function (r) {
            if (!r || !r.ok || !r.path) return false;
            return pushPathItem(kind, r.path);
        });
    }

    function addPath(kind) {
        var mode = kind === 'folder' ? 'dir' : 'file';
        return bridgeJson('/api/pick-folder', { title: kind === 'folder' ? '选择文件夹' : '选择文件', mode: mode }, 300000)
            .then(function (d) {
                if (!d) { toast('未连接「致知办公助手」服务（127.0.0.1:8737）'); return false; }
                var p = d.path || d.dir || '';
                if (!d.ok || !p) {
                    if (d.need_path) return pickByBrowsing(kind);
                    if (d.error && d.error !== '已取消' && d.error !== '未选择'
                        && !/tkinter|图形界面|图形选择/.test(String(d.error))) toast(d.error);
                    return false;
                }
                return pushPathItem(kind, p);
            });
    }

    function addByInput(kind) {
        var inp = document.createElement('input');
        inp.type = 'file';
        if (kind === 'image') inp.accept = 'image/*';
        inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.addEventListener('change', function () {
            var f = inp.files && inp.files[0];
            document.body.removeChild(inp);
            if (!f) return;
            if (kind === 'image') {
                addImageFile(f);
            } else {
                toast('浏览器不允许读取文件绝对路径，请改用「加文件」按钮');
            }
        });
        inp.click();
    }

    /* 按钮「粘入图片」：点击后才读系统剪贴板里的图片。
       不放行页面级 Ctrl+V，避免与右侧编辑器的「粘入图片」冲突。 */
    function pasteImageFromClipboard() {
        if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
            toast('当前浏览器不支持读取剪贴板，请用「选择图片」按钮');
            return;
        }
        toast('正在读取剪贴板…');
        navigator.clipboard.read().then(function (items) {
            var pending = null;
            for (var i = 0; i < items.length; i++) {
                var type = (items[i].types || []).filter(function (t) { return t.indexOf('image/') === 0; })[0];
                if (type) { pending = items[i].getType(type); break; }
            }
            if (!pending) { toast('剪贴板里没有图片，请先截图复制'); return; }
            pending.then(function (blob) {
                var fr = new FileReader();
                fr.onload = function () { addImageDataUrl(String(fr.result || ''), ''); };
                fr.onerror = function () { toast('读取剪贴板图片失败'); };
                fr.readAsDataURL(blob);
            }).catch(function () {
                toast('读取剪贴板图片失败，请用「选择图片」按钮');
            });
        }).catch(function () {
            toast('读取剪贴板被拒绝，请用「选择图片」按钮');
        });
    }

    function readClipboardImage() {
        return new Promise(function (resolve) {
            if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') { resolve(false); return; }
            navigator.clipboard.read().then(function (items) {
                var pending = null;
                for (var i = 0; i < items.length; i++) {
                    var type = (items[i].types || []).filter(function (t) { return t.indexOf('image/') === 0; })[0];
                    if (type) { pending = items[i].getType(type); break; }
                }
                if (!pending) { resolve(false); return; }
                pending.then(function (blob) {
                    var fr = new FileReader();
                    fr.onload = function () {
                        addImageDataUrl(String(fr.result || ''), '').then(function (ok) { resolve(!!ok); });
                    };
                    fr.onerror = function () { resolve(false); };
                    fr.readAsDataURL(blob);
                }).catch(function () { resolve(false); });
            }).catch(function () { resolve(false); });
        });
    }

    /* ---------------- 图片查看器（覆盖在附件区上方的浮层） ---------------- */
    function viewerEl(name) { return $(name); }

    /* 列表里的图片附件（上一张 / 下一张只在这些之间切换） */
    function imageIndexes() {
        var items = load();
        var out = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].kind === 'image' && items[i].src) out.push(i);
        }
        return out;
    }

    function showViewer(idx) {
        var items = load();
        var it = items[idx];
        if (!it || it.kind !== 'image' || !it.src) return;
        var box = $('npAttachViewer');
        var img = $('npAttachViewerImg');
        var nm = $('npAttachViewerName');
        if (!box || !img) return;
        _view.index = idx;
        setStageMode('image');
        var st0 = stageEl();
        if (st0) st0.classList.add('pannable');
        img.src = it.src;
        if (nm) nm.textContent = labelOf(it);
        _nativePath = '';
        syncNativeBtn();
        setKindLabel('\u56fe\u7247');
        resetViewerFind();
        box.classList.add('show');
        syncNavButtons();
        syncZoomBar();
    }

    /* ================= 非图片附件的本界面预览 ================= */
    /* 能在本界面里看的：docx / doc / pdf / html / mht / 文本 / 文件夹列表；
       看不了的（如 zip、exe）直接提示用默认程序。 */
    function extOf(p) {
        var m = String(p || '').match(/\.([A-Za-z0-9]+)\s*$/);
        return m ? m[1].toLowerCase() : '';
    }

    function docBodyEl() { return $('npAttachDocBody'); }
    function stageEl() { return $('npAttachViewerStage'); }

    function setStageMode(mode) {
        var st = stageEl();
        var body = docBodyEl();
        var img = $('npAttachViewerImg');
        var isDoc = mode === 'doc';
        if (st) {
            st.classList.toggle('docmode', isDoc);
            st.classList.remove('pdfmode');
        }
        if (body) {
            if (!isDoc && window.NpPdfView) { try { window.NpPdfView.destroy(body); } catch (e) {} }
            body.hidden = !isDoc;
            if (!isDoc) body.innerHTML = '';
            if (!isDoc) body.classList.remove('npPdfBody');
        }
        if (img) { img.style.display = isDoc ? 'none' : ''; }
        /* doc 模式默认不拖；PDF / 图片分别在它们自己的渲染函数里打开 pannable */
        if (mode === 'doc' && st) st.classList.remove('pannable', 'is-zoomed');
        if (mode === 'image' && st) st.classList.remove('is-zoomed');
        resetPan();
    }

    function setKindLabel(txt) {
        var k = $('npAttachViewerKind');
        if (k) k.textContent = txt || '';
    }

    /* ---------------- 预览框底栏检索 ---------------- */
    function viewerCore() { return window.npSearchCore || null; }

    function resetViewerFind() {
        if (_viewerFind.timer) { clearTimeout(_viewerFind.timer); _viewerFind.timer = null; }
        _viewerFind.base = '';
        _viewerFind.active = false;
        var input = $('npViewerFindInput');
        if (input) input.value = '';
        var count = $('npViewerFindCount');
        if (count) count.textContent = '';
    }

    function wrapViewerMarks(root, entries) {
        var c = viewerCore();
        if (!c) return 0;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                var pn = node.parentNode;
                if (pn && /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(pn.nodeName)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var nodes = [], starts = [], full = '';
        while (walker.nextNode()) {
            var node = walker.currentNode;
            nodes.push(node);
            starts.push(full.length);
            full += node.nodeValue;
        }
        if (!nodes.length || !full) return 0;
        var ranges = c.scanMarks(full, entries);
        if (!ranges.length) return 0;
        for (var i = 0; i < nodes.length; i++) {
            var tn = nodes[i];
            var ns = starts[i], ne = ns + tn.nodeValue.length;
            var local = [];
            for (var r = 0; r < ranges.length; r++) {
                var it = ranges[r];
                if (it.end <= ns || it.start >= ne) continue;
                local.push({
                    start: Math.max(0, it.start - ns),
                    end: Math.min(tn.nodeValue.length, it.end - ns),
                    gi: it.gi || 0
                });
            }
            if (!local.length) continue;
            var value = tn.nodeValue;
            var frag = document.createDocumentFragment();
            var cursor = 0;
            local.forEach(function (item) {
                if (item.start > cursor) frag.appendChild(document.createTextNode(value.slice(cursor, item.start)));
                var span = document.createElement('span');
                span.className = 'npViewerHl npViewerHl' + (item.gi % 5);
                span.textContent = value.slice(item.start, item.end);
                frag.appendChild(span);
                cursor = item.end;
            });
            if (cursor < value.length) frag.appendChild(document.createTextNode(value.slice(cursor)));
            tn.parentNode.replaceChild(frag, tn);
        }
        return ranges.length;
    }

    function applyViewerFind() {
        var input = $('npViewerFindInput');
        var count = $('npViewerFindCount');
        var body = docBodyEl();
        if (!input || !body || body.hidden) {
            if (count) count.textContent = '';
            return;
        }
        if (_viewerFind.active) body.innerHTML = _viewerFind.base;
        else _viewerFind.base = body.innerHTML;
        _viewerFind.active = false;
        var c = viewerCore();
        var groups = c ? c.parseGroups(input.value) : [];
        if (!groups.length) { if (count) count.textContent = ''; return; }
        var entries = c.entriesOf(groups);
        var n = wrapViewerMarks(body, entries);
        if (n) _viewerFind.active = true;
        if (count) count.textContent = n ? (n + ' 处') : '0 处';
    }

    /* 底栏「默认程序打开」的目标路径 */
    var _nativePath = '';
    function syncNativeBtn() {
        var b = $('npAttachOpenNative');
        if (b) b.style.display = _nativePath ? '' : 'none';
    }
    /* PDF 用的 blob URL，关闭预览时回收 */
    var _pdfUrl = '';
    /* PDF 页状态：关闭 / 换文件时复位 */
    var _pdfPage = 1;
    var _pdfTotal = 0;

    function isPdfMode() {
        var body = docBodyEl();
        return !!(body && !body.hidden && body.classList.contains('npPdfBody'));
    }

    /* 上一页 / 下一页：图片态是上一张 / 下一张，PDF 态是上一页 / 下一页 */
    function syncPdfNav() {
        var pv = $('npAttachViewerPrev');
        var nx = $('npAttachViewerNext');
        var pdf = isPdfMode();
        if (pv) {
            pv.textContent = pdf ? '上一页' : '上一张';
            pv.title = pdf ? '上一页（PgUp）' : '上一张';
        }
        if (nx) {
            nx.textContent = pdf ? '下一页' : '下一张';
            nx.title = pdf ? '下一页（PgDn）' : '下一张';
        }
        if (pdf) {
            var off = _pdfTotal < 2;
            if (pv) { pv.disabled = off; pv.style.opacity = off ? '.45' : ''; }
            if (nx) { nx.disabled = off; nx.style.opacity = off ? '.45' : ''; }
        }
    }

    /* 缩放：PDF 走 pdf.js 重渲染，其余保持原来的图片平移 / 文档 zoom */
    function pdfZoom(next) {
        if (window.NpPdfView) window.NpPdfView.setScale(docBodyEl(), next);
    }

    function bridgeGet(url, timeout) {
        return fetch(BRIDGE_DEFAULT + url, { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .catch(function () { return null; });
    }

    function bridgePost(url, body, timeout) {
        return fetch(BRIDGE_DEFAULT + url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        }).then(function (r) { return r.json(); }).catch(function () { return null; });
    }

    function readBytes(path) {
        return bridgeGet('/api/read?path=' + encodeURIComponent(path), 30000).then(function (d) {
            if (!d || d.ok === false || !d.base64) return null;
            try {
                var bin = atob(d.base64);
                var out = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
                return out;
            } catch (e) { return null; }
        });
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function humanSize(n) {
        n = Number(n) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1024 / 1024).toFixed(1) + ' MB';
    }

    function showDocViewer(idx) {
        var items = load();
        var it = items[idx];
        if (!it) return;
        var abs = String(it.src || '');
        _view.index = idx;
        _nativePath = abs;
        syncNativeBtn();
        var box = $('npAttachViewer');
        var nm = $('npAttachViewerName');
        if (box) box.classList.add('show');
        if (nm) nm.textContent = labelOf(it);
        setStageMode('doc');
        var body = docBodyEl();
        if (!body) return;
        resetViewerFind();
        body.innerHTML = '<div class="npAttachDirEmpty">正在读取…</div>';
        renderAttachment(abs, it).then(syncZoomBar).catch(function (e) {
            body.innerHTML = '<div class="npAttachDirEmpty">本界面无法预览这个附件（' +
                esc(e && e.message ? e.message : e) + '），可点底部「默认程序打开」。</div>';
        });
    }

    /* 按类型分派渲染；失败时抛错让底栏提示默认程序 */
    function renderAttachment(abs, it) {
        var ext = extOf(abs);
        var body = docBodyEl();

        /* 文件夹：列出一级内容 */
        if (it && it.kind === 'folder') return renderFolder(abs, body);

        /* 图片类：本界面直接给图（外部路径无法用 img src，走读字节） */
        if (['png','jpg','jpeg','gif','bmp','webp','svg','ico'].indexOf(ext) >= 0) {
            return renderImageFile(abs, ext, body);
        }
        if (ext === 'pdf') return renderPdf(abs, body);
        if (ext === 'html' || ext === 'htm' || ext === 'mht' || ext === 'mhtml') return renderWeb(abs, ext, body);
        if (['docx','doc','rtf','wps','odt'].indexOf(ext) >= 0) return renderWord(abs, ext, body);
        if (['txt','md','json','js','css','xml','log','csv','ini','cfg','py','sh','bat','ps1','yml','yaml','sql','c','cpp','h','java'].indexOf(ext) >= 0) {
            return renderText(abs, body);
        }
        throw new Error('不支持的格式 .' + (ext || '?'));
    }

    function renderImageFile(abs, ext, body) {
        return readBytes(abs).then(function (bytes) {
            if (!bytes) throw new Error('读不到文件');
            var mime = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif',
                         bmp:'image/bmp', webp:'image/webp', svg:'image/svg+xml', ico:'image/x-icon' }[ext] || 'application/octet-stream';
            var b64 = '';
            var CH = 0x8000;
            for (var i = 0; i < bytes.length; i += CH) {
                b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
            }
            var img = $('npAttachViewerImg');
            if (img) {
                img.src = 'data:' + mime + ';base64,' + btoa(b64);
                img.style.display = '';
            }
            var st = stageEl();
            if (st) { st.classList.remove('docmode'); st.classList.add('pannable'); }
            if (body) { body.hidden = true; }
            resetPan();
            setKindLabel(ext.toUpperCase() + ' 图片');
        });
    }

    function renderPdf(abs, body) {
        /* 服务端没有静态文件接口，只能读字节后用 pdf.js 逐页画到 canvas 上：
           内嵌浏览器 iframe 只能显示前两页且无法缩放，所以这里不再用 iframe。 */
        return readBytes(abs).then(function (bytes) {
            if (!bytes) throw new Error('读不到文件');
            if (!window.NpPdfView) throw new Error('PDF 预览组件未加载');
            var st = stageEl();
            if (st) {
                st.classList.remove('pannable', 'is-zoomed');
                st.classList.add('pdfmode');
            }
            resetPan();
            body.hidden = false;
            body.classList.add('npPdfBody');
            setKindLabel('PDF');
            var pv = $('npAttachViewerPrev'), nx = $('npAttachViewerNext');
            if (pv) pv.style.display = '';
            if (nx) nx.style.display = '';
            _pdfTotal = 0;
            _pdfPage = 1;
            syncPdfNav();
            return window.NpPdfView.render(body, bytes, {
                fit: true,
                onZoom: function (scale) {
                    var p = panState();
                    p.scale = scale;
                    syncZoomLabel();
                },
                onPage: function (page, total) {
                    _pdfPage = page;
                    _pdfTotal = total;
                    syncPdfNav();
                }
            }).then(function () {
                body.scrollTop = 0;
                syncZoomBar();
                return true;
            });
        });
    }

    function renderWeb(abs, ext, body) {
        return readBytes(abs).then(function (bytes) {
            if (!bytes) throw new Error('读不到文件');
            var html = '';
            if (typeof window.NpfDocView === 'function' || (window.NpfDocView && window.NpfDocView.renderMht)) {
                var dv = window.NpfDocView;
                if (ext === 'mht' || ext === 'mhtml') {
                    html = dv.renderMht ? dv.renderMht(bytes, abs) : '';
                } else {
                    html = dv.renderHtml ? dv.renderHtml(bytes, abs) : '';
                }
            }
            if (!html) throw new Error('页面渲染失败');
            body.innerHTML = '<div class="npfDocPage">' + html + '</div>';
            setKindLabel(ext.toUpperCase());
            return true;
        });
    }

    function renderWord(abs, ext, body) {
        return readBytes(abs).then(function (bytes) {
            if (!bytes) throw new Error('读不到文件');
            var dv = window.NpfDocView;
            var isZipDoc = /^(docx|odt)$/.test(ext);
            if (isZipDoc && dv && dv.renderDocx) {
                /* renderDocx 是 async，要等它 */
                return Promise.resolve(dv.renderDocx(bytes, abs)).then(function (res) {
                    var h = (res && res.html) ? res.html : res;
                    if (!h) throw new Error('docx 渲染为空');
                    var inner = h;
                    if (res && res.html && res.width && dv.fitWrapped) {
                        inner = dv.fitWrapped(res.html, res.width);
                    }
                    body.innerHTML = '<div class="npfDocPage">' + inner + '</div>';
                    if (dv.bindFit) { try { dv.bindFit(body); } catch (e) {} }
                    setKindLabel('Word 文档');
                    return true;
                });
            }
            /* .doc（OLE）：这里必须取 res.html。renderDocFormat 返回的是
               { html, width } 对象，直接拼字符串会渲染出 [object Object]。
               与 notepad-preview.js 的 renderDocument() 保持同一写法。 */
            var html = '';
            var wrapWidth = 0;
            if (window.NpfDoc && window.NpfDoc.isOle && window.NpfDoc.isOle(bytes)) {
                var rich = null;
                try { rich = window.NpfDoc.richBlocks(bytes); } catch (e) { rich = null; }
                if (rich && dv && dv.renderDocFormat) {
                    var resDoc = null;
                    try { resDoc = dv.renderDocFormat(rich); } catch (e) { resDoc = null; }
                    if (resDoc && resDoc.html) {
                        html = resDoc.html;
                        if (resDoc.width) wrapWidth = resDoc.width;
                    }
                }
            }
            if (!html) {
                var txt = (window.NpfDoc && window.NpfDoc.plainText) ? window.NpfDoc.plainText(bytes)
                    : (window.NpfDocParse && window.NpfDocParse.docPlainText ? window.NpfDocParse.docPlainText(bytes) : '');
                html = txt ? '<pre>' + esc(txt) + '</pre>' : '';
            }
            if (!html) {
                body.innerHTML = '<div class="npAttachDirEmpty">这份文档没有可显示的正文（可能已加密）。</div>';
                setKindLabel('Word 文档');
                return true;
            }
            /* 固定版心宽度的（公文 A4）用 fitWrapped 适配到预览框 */
            var inner = html;
            if (dv.fitWrapped && wrapWidth) inner = dv.fitWrapped(html, wrapWidth);
            body.innerHTML = '<div class="npfDocPage">' + inner + '</div>';
            if (dv.bindFit) { try { dv.bindFit(body); } catch (e) {} }
            setKindLabel('Word 文档');
            return true;
        });
    }

    function renderText(abs, body) {
        return readBytes(abs).then(function (bytes) {
            if (!bytes) throw new Error('读不到文件');
            var txt = new TextDecoder('utf-8').decode(bytes);
            body.innerHTML = '<pre>' + esc(txt) + '</pre>';
            setKindLabel('文本');
            return true;
        });
    }

    function renderFolder(abs, body) {
        return bridgeGet('/api/ls?path=' + encodeURIComponent(abs), 15000).then(function (d) {
            if (!d || d.ok === false) throw new Error('列不出目录内容');
            var list = d.items || d.entries || d.list || [];
            if (!list.length) {
                body.innerHTML = '<div class="npAttachDirEmpty">这个文件夹是空的。</div>';
                return true;
            }
            list.sort(function (a, b) {
                var da = a.isDir || a.dir || a.type === 'dir';
                var db = b.isDir || b.dir || b.type === 'dir';
                if (da !== db) return da ? -1 : 1;
                return String(a.name || '').localeCompare(String(b.name || ''), 'zh');
            });
            var html = '<ul class="npAttachDirList">';
            for (var i = 0; i < list.length; i++) {
                var e = list[i];
                var isDir = e.isDir || e.dir || e.type === 'dir';
                var nm = e.name || e.base || '';
                var full = e.path || (abs.replace(/[\\/]+$/, '') + '/' + nm);
                var sz = e.size != null ? humanSize(e.size) : '';
                html += '<li class="' + (isDir ? 'dir' : 'file') + '" data-path="' + esc(full) + '" data-dir="' + (isDir ? '1' : '0') + '">' +
                    (typeof typeIconFor === 'function'
                        ? '<img class="npAttachDirIcon" src="' + esc(typeIconFor(nm, isDir)) + '" alt="">'
                        : '') +
                    '<span class="npAttachDirName" title="' + esc(full) + '">' + esc(nm) + '</span>' +
                    '<span class="npAttachDirSize">' + esc(sz) + '</span></li>';
            }
            html += '</ul>';
            body.innerHTML = html;
            setKindLabel('文件夹 · ' + list.length + ' 项');
            /* 点目录继续往里走，点文件换成那个文件的预览 */
            body.onclick = function (ev) {
                var li = ev.target.closest('li[data-path]');
                if (!li) return;
                var pth = li.getAttribute('data-path');
                var isDir = li.getAttribute('data-dir') === '1';
                _nativePath = pth;
                if (isDir) {
                    body.innerHTML = '<div class="npAttachDirEmpty">正在读取…</div>';
                    renderFolder(pth, body).catch(function (e) {
                        body.innerHTML = '<div class="npAttachDirEmpty">' + esc(e.message || e) + '</div>';
                    });
                } else {
                    body.innerHTML = '<div class="npAttachDirEmpty">正在读取…</div>';
                    renderAttachment(pth, { kind: 'file', src: pth }).catch(function (e) {
                        body.innerHTML = '<div class="npAttachDirEmpty">本界面无法预览（' +
                            esc(e.message || e) + '），可点底部「默认程序打开」。</div>';
                    });
                }
            };
            return true;
        });
    }

    /* ---------------- 图片 / PDF 的手型拖动平移 ---------------- */
    /* 规则：能在预览框里看到的图片与 PDF，鼠标在里面就是手型；
       画面尺寸超出预览框时，按住可拖动看到其余部分。 */
    var _pan = { active: false, sx: 0, sy: 0, ox: 0, oy: 0 };

    function panState() {
        if (!_pan.state) _pan.state = { x: 0, y: 0, scale: 1 };
        return _pan.state;
    }

    function isPdfIframe() {
        var b = docBodyEl();
        return !!(b && !b.hidden && b.querySelector('iframe'));
    }

    function applyPan() {
        var st = panState();
        var img = $('npAttachViewerImg');
        var b = docBodyEl();
        if (isPdfMode() && window.NpPdfView) {
            window.NpPdfView.setScale(b, st.scale);
            syncZoomLabel();
            return;
        }
        var fr = (b && !b.hidden) ? b.querySelector('iframe') : null;
        if (img && img.style.display !== 'none' && img.getAttribute('src')) {
            img.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px)' +
                (st.scale !== 1 ? ' scale(' + st.scale + ')' : '');
        }
        if (fr) {
            /* 旧版 iframe 分支保留兜底；PDF 正常走上面的 pdf.js */
            try { fr.style.zoom = (st.scale !== 1 ? String(st.scale) : ''); } catch (e) {}
            if (b) {
                b.scrollLeft = -st.x;
                b.scrollTop = -st.y;
            }
        }
        syncZoomLabel();
    }

    function syncZoomLabel() {
        var lab = $('npAttachZoomLabel');
        if (lab) lab.textContent = Math.round(panState().scale * 100) + '%';
    }

    function syncZoomBar() {
        var bar = $('npAttachZoom');
        var st = stageEl();
        var show = !!(st && (st.classList.contains('pannable') || st.classList.contains('docmode') || st.classList.contains('pdfmode')));
        if (bar) bar.hidden = !show;
        syncZoomLabel();
    }

    function setViewerZoom(next) {
        var st = stageEl();
        if (!st) return;
        var scale = Math.max(0.3, Math.min(4, next));
        /* PDF：交给 pdf.js 重渲染（底栏 −/+/Ctrl+滚轮 都是缩放页面本身） */
        if (isPdfMode()) {
            pdfZoom(scale);
            return;
        }
        var panMode = st.classList.contains('pannable');
        var docMode = st.classList.contains('docmode');
        if (!panMode && !docMode) return;
        /* docx / doc / html / 文本：直接缩放正文容器，图片仍走平移那套 */
        if (docMode && !panMode) {
            var body = docBodyEl();
            if (body) body.style.zoom = scale === 1 ? '' : String(scale);
            var p = panState();
            p.scale = scale;
            syncZoomLabel();
            return;
        }
        var cur = panState();
        cur.scale = scale;
        if (scale <= 1.001) { cur.x = 0; cur.y = 0; }
        st.classList.toggle('is-zoomed', scale > 1.001);
        clampPan(cur);
        applyPan();
    }

    function resetPan() {
        _pan.state = { x: 0, y: 0, scale: 1 };
        var img = $('npAttachViewerImg');
        if (img) img.style.transform = '';
        var b = docBodyEl();
        var fr = b ? b.querySelector('iframe') : null;
        if (fr) { try { fr.style.zoom = ''; } catch (e) {} }
        if (b) { b.scrollLeft = 0; b.scrollTop = 0; try { b.style.zoom = ''; } catch (e) {} }
        var st = stageEl();
        if (st) st.classList.remove('panning');
        syncNavButtons();
        syncZoomBar();
    }

    function isPanTarget() {
        var st = stageEl();
        if (!st || !st.classList.contains('pannable')) return false;
        return true;
    }

    /* 内容是否超出预览框（只有超出时才允许手型拖动，否则点一下就乱移） */
    function contentOverflows() {
        var st = stageEl();
        if (!st) return false;
        var stR = st.getBoundingClientRect();
        var img = $('npAttachViewerImg');
        if (img && img.style.display !== 'none' && img.getAttribute('src')) {
            var r = img.getBoundingClientRect();
            return r.width > stR.width + 1 || r.height > stR.height + 1;
        }
        var b = docBodyEl();
        if (b && !b.hidden) {
            return b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1;
        }
        return false;
    }

    /* 拖动时把图片位移限制在「不露出预览框背景」的范围内 */
    function clampPan(cur) {
        var img = $('npAttachViewerImg');
        if (!img || img.style.display === 'none' || !img.getAttribute('src')) return cur;
        var st = stageEl();
        if (!st) return cur;
        var stR = st.getBoundingClientRect();
        var r = img.getBoundingClientRect();
        var maxX = Math.max(0, (r.width - stR.width) / 2 + 8);
        var maxY = Math.max(0, (r.height - stR.height) / 2 + 8);
        cur.x = Math.max(-maxX, Math.min(maxX, cur.x));
        cur.y = Math.max(-maxY, Math.min(maxY, cur.y));
        return cur;
    }

    function bindPan() {
        var st = stageEl();
        if (!st || st._npPanBound) return;
        st._npPanBound = true;

        st.addEventListener('pointerdown', function (e) {
            if (!isPanTarget() || e.button !== 0) return;
            if (e.target.closest('button')) return;
            /* 内容没超出预览框就不起拖动，避免误移 */
            if (!contentOverflows()) return;
            _pan.active = true;
            _pan.sx = e.clientX;
            _pan.sy = e.clientY;
            var cur = panState();
            _pan.ox = cur.x;
            _pan.oy = cur.y;
            st.classList.add('panning');
            try { st.setPointerCapture(e.pointerId); } catch (err) {}
            e.preventDefault();
        });
        st.addEventListener('pointermove', function (e) {
            if (!_pan.active) return;
            var cur = panState();
            cur.x = _pan.ox + (e.clientX - _pan.sx);
            cur.y = _pan.oy + (e.clientY - _pan.sy);
            clampPan(cur);
            applyPan();
            e.preventDefault();
        });
        function endPan(ev) {
            if (!_pan.active) return;
            _pan.active = false;
            st.classList.remove('panning');
            try { if (ev && ev.pointerId != null) st.releasePointerCapture(ev.pointerId); } catch (err) {}
        }
        st.addEventListener('pointerup', endPan);
        st.addEventListener('pointercancel', endPan);
        st.addEventListener('lostpointercapture', endPan);

        /* 滚轮：按住 Ctrl 才缩放（放大 / 缩小），普通滚轮交还给预览框自己滚 */
        st.addEventListener('wheel', function (e) {
            if (!e.ctrlKey) return;          /* 不拦普通滚轮 */
            /* PDF：缩放页面（pdf.js 重渲染），交给底栏缩放那一套 */
            if (isPdfMode()) {
                e.preventDefault();
                var s0 = panState().scale || 1;
                var st2 = e.deltaY < 0 ? 0.12 : -0.12;
                setViewerZoom(s0 * (1 + st2));
                return;
            }
            if (!isPanTarget()) return;
            e.preventDefault();
            var cur = panState();
            var step = e.deltaY < 0 ? 0.12 : -0.12;
            var next = cur.scale * (1 + step);
            next = Math.max(0.4, Math.min(next, 6));
            cur.scale = next;
            st.classList.toggle('is-zoomed', next > 1.001);
            /* 缩放后重置偏移，避免旧位移把内容推出可视区 */
            if (next <= 1.001) { cur.x = 0; cur.y = 0; }
            else clampPan(cur);
            applyPan();
        }, { passive: false });
    }

    /* 底栏「默认程序打开」 */
    function openNative() {
        if (!_nativePath) { toast('没有可打开的路径'); return; }
        openPath(_nativePath);
    }

    /* 上一页 / 下一页：PDF 态翻页；图片态在图片附件之间循环切换 */
    function stepViewer(delta) {
        if (isPdfMode()) {
            if (window.NpPdfView) window.NpPdfView.step(docBodyEl(), delta);
            return;
        }
        var idxs = imageIndexes();
        if (idxs.length < 2) return;
        var pos = idxs.indexOf(_view.index);
        if (pos < 0) pos = 0;
        pos = (pos + delta + idxs.length) % idxs.length;
        showViewer(idxs[pos]);
    }

    function syncNavButtons() {
        if (isPdfMode()) { syncPdfNav(); return; }
        var prev = $('npAttachViewerPrev');
        var next = $('npAttachViewerNext');
        if (prev) { prev.textContent = '上一张'; prev.title = '上一张'; }
        if (next) { next.textContent = '下一张'; next.title = '下一张'; }
        var idxs = imageIndexes();
        var off = idxs.length < 2;
        if (prev) { prev.disabled = off; prev.style.opacity = off ? '.45' : ''; }
        if (next) { next.disabled = off; next.style.opacity = off ? '.45' : ''; }
    }

    function closeViewer() {
        resetViewerFind();
        var box = $('npAttachViewer');
        if (box) { box.classList.remove('show'); box.classList.remove('full'); }
        var body0 = docBodyEl();
        if (body0 && window.NpPdfView) { try { window.NpPdfView.destroy(body0); } catch (e) {} }
        _pdfPage = 1;
        _pdfTotal = 0;
        resetPan();
        var img = $('npAttachViewerImg');
        if (img) { img.removeAttribute('src'); img.style.display = ''; }
        var body = docBodyEl();
        if (body) { body.innerHTML = ''; body.hidden = true; body.onclick = null; body.classList.remove('npPdfBody'); }
        var st = stageEl();
        if (st) st.classList.remove('docmode', 'pdfmode');
        _nativePath = '';
        syncNativeBtn();
        setKindLabel('');
        if (_pdfUrl) { try { URL.revokeObjectURL(_pdfUrl); } catch (e) {} _pdfUrl = ''; }
        _view.external = false;
        var pv = $('npAttachViewerPrev'); if (pv) pv.style.display = '';
        var nx = $('npAttachViewerNext'); if (nx) nx.style.display = '';
        _view.index = -1;
        var full = $('npAttachFullBtn');
        if (full) full.textContent = '全屏';
    }

    /* 全屏 = 铺满中部三栏工作区（不含顶栏、左栏），而不是整个浏览器窗口 */
    function middleRect() {
        var ws = $('npWorkspace');
        var r = ws ? ws.getBoundingClientRect() : null;
        if (r && r.width > 40 && r.height > 40) return r;
        var body = $('npPrevBody');
        return body ? body.getBoundingClientRect() : null;
    }

    function placeFullBox() {
        var box = $('npAttachViewer');
        if (!box || !box.classList.contains('full')) return;
        var r = middleRect();
        if (!r) return;
        box.style.top = Math.round(r.top) + 'px';
        box.style.left = Math.round(r.left) + 'px';
        box.style.width = Math.round(r.width) + 'px';
        box.style.height = Math.round(r.height) + 'px';
    }

    function toggleFull() {
        var box = $('npAttachViewer');
        if (!box) return;
        var btn = $('npAttachFullBtn');
        var on = box.classList.toggle('full');
        if (btn) btn.textContent = on ? '退出全屏' : '全屏';
        if (on) placeFullBox();
        else {
            box.style.top = '';
            box.style.left = '';
            box.style.width = '';
            box.style.height = '';
        }
    }

    function bindViewer() {
        bindPan();
        var oath = $('npAttachOpenNative');
        if (oath) oath.addEventListener('click', openNative);
        var prev = $('npAttachViewerPrev');
        if (prev) prev.addEventListener('click', function () { stepViewer(-1); });
        var next = $('npAttachViewerNext');
        if (next) next.addEventListener('click', function () { stepViewer(1); });
        var fb = $('npAttachFullBtn');
        if (fb) fb.addEventListener('click', toggleFull);
        var zo = $('npAttachZoomOut');
        if (zo) zo.addEventListener('click', function () { setViewerZoom(panState().scale - 0.1); });
        var zi = $('npAttachZoomIn');
        if (zi) zi.addEventListener('click', function () { setViewerZoom(panState().scale + 0.1); });
        var zl = $('npAttachZoomLabel');
        if (zl) zl.addEventListener('click', function () { setViewerZoom(1); });
        var vf = $('npViewerFindInput');
        if (vf) {
            vf.addEventListener('input', function () {
                if (_viewerFind.timer) clearTimeout(_viewerFind.timer);
                _viewerFind.timer = setTimeout(function () {
                    _viewerFind.timer = null;
                    applyViewerFind();
                }, 180);
            });
            vf.addEventListener('keydown', function (e) {
                e.stopPropagation();
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (_viewerFind.timer) { clearTimeout(_viewerFind.timer); _viewerFind.timer = null; }
                    applyViewerFind();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    vf.value = '';
                    applyViewerFind();
                }
            });
        }
        var vc = $('npAttachViewerClose');
        if (vc) vc.addEventListener('click', closeViewer);

        window.addEventListener('resize', function () {
            var box = $('npAttachViewer');
            if (!box || !box.classList.contains('show')) return;
            if (box.classList.contains('full')) placeFullBox();
        });

        /* Esc 关闭预览；PDF 态 PgUp / PgDn 翻页 */
        document.addEventListener('keydown', function (e) {
            var box = $('npAttachViewer');
            if (!box || !box.classList.contains('show')) return;
            if (e.key === 'Escape') { e.preventDefault(); closeViewer(); return; }
            if (!isPdfMode()) return;
            if (e.key === 'PageUp') { e.preventDefault(); stepViewer(-1); }
            else if (e.key === 'PageDown') { e.preventDefault(); stepViewer(1); }
        });
    }

    /* ---------------- 打开 / 删除 ---------------- */
    function openPath(abs) {
        bridgeJson('/api/open', { path: abs }, 8000).then(function (d) {
            if (!d || !d.ok) toast(d ? (d.error || '打开失败') : '未连接「致知办公助手」服务');
        });
    }

    function openItem(it, idx) {
        if (!it) return;
        if (it.kind === 'image') {
            showViewer(idx);
            return;
        }
        /* 非图片：优先在本界面内预览，预览底栏再给「默认程序打开」 */
        var p = String(it.src || '');
        if (!p || it.local || !isAbsolute(p)) {
            toast('这个附件没有可用的绝对路径，请删除后重新添加');
            return;
        }
        showDocViewer(idx);
    }

    function removeAt(i) {
        var items = load().slice();
        var it = items[i];
        if (!it) return;
        var name = labelOf(it);
        if (!window.confirm('确定删除附件「' + name + '」吗？')) return;
        items.splice(i, 1);
        if (save(items)) {
            if (_view.index === i) closeViewer();
            else if (_view.index > i) _view.index -= 1;
            render();
            toast('已删除附件');
        }
    }

    function closeAttachCtx() {
        var el = $('npAttachCtxMenu');
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function assignAttachToWin(idx, slot) {
        var it = load()[idx];
        if (!it || it.kind === 'folder') return;
        if (!(window.npMultiView && typeof window.npMultiView.assign === 'function')) {
            toast('多窗预览模块未加载');
            return;
        }
        var label = labelOf(it) || it.alias || it.name || '附件';
        if (it.kind === 'image') {
            window.npMultiView.assign(slot, {
                kind: 'image', src: it.src, name: label, title: label
            });
        } else {
            window.npMultiView.assign(slot, {
                kind: 'file', path: it.src, name: label, title: label
            });
        }
    }

    function showAttachMenu(idx, x, y) {
        closeAttachCtx();
        var it = load()[idx];
        if (!it) return;
        var canWin = it.kind !== 'folder';
        var winItems = [0, 1, 2, 3, 4].map(function (slot) {
            var mark = (window.npMultiView && typeof window.npMultiView.slotMark === 'function')
                ? window.npMultiView.slotMark(slot) : '';
            return '<div class="npTopicCtxItem" data-attachmv="' + slot + '">窗口 ' + (slot + 1) + mark + '</div>';
        }).join('');
        var el = document.createElement('div');
        el.className = 'npTopicCtx npLibCtx';
        el.id = 'npAttachCtxMenu';
        el.innerHTML =
            (canWin
                ? '<div class="npTopicCtxItem npLibCtxHasSub" data-attachsub="mv">' +
                  '<span>添加到小窗</span><span class="npLibCtxArrow">▸</span>' +
                  '<div class="npLibCtxSub">' + winItems + '</div></div>'
                : '') +
            '<div class="npTopicCtxItem npDanger" data-attachdel="1">删除</div>';
        document.body.appendChild(el);
        var w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, x)) + 'px';
        el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, y)) + 'px';
        el.addEventListener('click', function (ev) {
            var mv = ev.target.closest('[data-attachmv]');
            if (mv) {
                closeAttachCtx();
                assignAttachToWin(idx, parseInt(mv.getAttribute('data-attachmv'), 10));
                return;
            }
            var del = ev.target.closest('[data-attachdel]');
            if (del) {
                closeAttachCtx();
                removeAt(idx);
            }
        });
    }

    /* ---------------- 粘贴截图 ---------------- */
    /* 只有焦点在「粘入图片」按钮上时才拦截 Ctrl+V 并提示；
       右侧编辑区、检索框等任何其他焦点都必须走浏览器 / 编辑区自己的粘贴。 */
    function bindPaste() {
        if (document._npAttachPaste) return;
        document._npAttachPaste = true;
        document.addEventListener('paste', function (e) {
            var pane = $('npPrevAttachPane');
            if (!pane || !pane.classList.contains('show')) return;
            var ae = document.activeElement;
            if (!ae || !ae.closest || !ae.closest('[data-attact="paste"]')) return;
            var tag = (e.target && e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            e.preventDefault();
            e.stopPropagation();
            toast('请点「粘入图片」按钮添加截图');
        }, true);
    }

    /* ---------------- 事件 ---------------- */
    function bind() {
        document.addEventListener('click', function (e) {
            var t = e.target.closest('[data-attact]');
            if (t) {
                var act = t.getAttribute('data-attact');
                if (act === 'paste') pasteImageFromClipboard();
                else if (act === 'image') addByInput('image');
                else if (act === 'file') addPath('file');
                else if (act === 'folder') addPath('folder');
                return;
            }
            var add = e.target.closest('#npAttachAddBtn');
            if (add) {
                addByInput('image');
                return;
            }
            var item = e.target.closest('.npAttachItem');
            if (item && item.closest('#npAttachGrid')) {
                var idx = parseInt(item.getAttribute('data-index'), 10);
                openItem(load()[idx], idx);
            }
        }, true);

        document.addEventListener('contextmenu', function (e) {
            var item = e.target.closest('.npAttachItem');
            if (!item || !item.closest('#npAttachGrid')) return;
            e.preventDefault();
            showAttachMenu(parseInt(item.getAttribute('data-index'), 10), e.clientX, e.clientY);
        });

        document.addEventListener('mousedown', function (e) {
            var menu = $('npAttachCtxMenu');
            if (menu && !menu.contains(e.target)) closeAttachCtx();
        }, true);

        bindPaste();
        bindViewer();
    }

    window.npAttachRender = function () { _items = null; load(); render(); };

    /* 共享查看器：本地页也用它预览（样式、尺寸、拖动、手型一致） */
    window.npOpenViewer = function (opts) {
        opts = opts || {};
        var box = $('npAttachViewer');
        var nm = $('npAttachViewerName');
        if (!box) return;
        _view.external = true;
        _nativePath = opts.path || '';
        syncNativeBtn();
        if (nm) nm.textContent = opts.name || '';
        box.classList.add('show');
        var bar = $('npAttachViewerPrev');
        var nx = $('npAttachViewerNext');
        /* 本地页单文件预览：上一张/下一张隐藏 */
        if (bar) { bar.style.display = 'none'; }
        if (nx) { nx.style.display = 'none'; }
        setStageMode('doc');
        var body = docBodyEl();
        resetViewerFind();
        if (body) body.innerHTML = '<div class="npAttachDirEmpty">正在读取…</div>';
        /* 直接给 HTML（笔记页的某一篇文章）：不读盘，原样渲染 */
        if (opts.html) {
            if (body) body.innerHTML = opts.html;
            setKindLabel(opts.label || '文章');
            syncZoomBar();
            return Promise.resolve(true);
        }
        return Promise.resolve(renderAttachment(opts.path, { kind: opts.kind || 'file', src: opts.path }))
            .then(function (r) { syncZoomBar(); return r; })
            .catch(function (e) {
                if (body) body.innerHTML = '<div class="npAttachDirEmpty">本界面无法预览（' +
                    esc(e && e.message ? e.message : e) + '），可点底部「默认程序打开」。</div>';
            });
    };
    window.npCloseViewer = function () { closeViewer(); };
    window.npViewerIsOpen = function () {
        var box = $('npAttachViewer');
        return !!(box && box.classList.contains('show'));
    };
    window.npAttachList = function () { return load().slice(); };
    window.npAttachClear = function () { if (save([])) { closeViewer(); render(); } };
    window.npAttachOpenImage = function (idx) { showViewer(idx); };
    /* 调试 / 自动化测试用：直接走别名输入流程 */
    window.npAttachAskAlias = askAlias;
    window.npAttachAddPath = pushPathItem;
    window.npAttachAddImage = addImageDataUrl;

    bind();
})();
