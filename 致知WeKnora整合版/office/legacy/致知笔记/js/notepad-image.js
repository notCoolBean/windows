/* ============================================================
   notepad-image.js — 文稿编辑框插图（粘贴截图）
   1) 粘入图片后自动整理：独占一段、水平居中、单倍行距、宽度与文字行等宽
   2) 单击图片出现控制点，拖角 / 拖边可等比缩放；双击恢复等宽
   3) 宽度以百分比存在图片的内联样式里，随编辑框宽度自适应
   ============================================================ */
(function () {
    var IMG_RATIO_ATTR = 'data-npimgw';
    var LINE_CLASS = 'npImgLine';
    var SEL_CLASS = 'npImgSel';
    var MIN_W = 40;

    var _cur = null;        /* 当前选中的 img */
    var _box = null;        /* 控制点覆盖层 */
    var _badge = null;
    var _drag = null;
    var _timer = null;

    function $(id) { return document.getElementById(id); }
    function ed() { return $('notepadEditor'); }

    function isImgLine(el) {
        return !!(el && el.nodeType === 1 && el.tagName === 'P' && el.classList.contains(LINE_CLASS));
    }

    /* 编辑框正文可用宽度（去掉内边距） */
    function contentWidth() {
        var e = ed();
        if (!e) return 600;
        var cs = getComputedStyle(e);
        var w = e.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
        return Math.max(MIN_W, Math.round(w));
    }

    function lineStyle(p) {
        p.classList.add(LINE_CLASS);
        /* data-manual=1：让源程序的自动格式跳过这一段，避免把图片行改回正文并冲掉图片 */
        p.setAttribute('data-manual', '1');
        p.style.textAlign = 'center';
        p.style.textIndent = '0';
        p.style.lineHeight = '1';
        p.style.margin = '0.35em 0';
        p.style.padding = '0';
    }

    function applyImage(img) {
        if (!img || img.tagName !== 'IMG') return;
        img.classList.add('npImg');
        img.style.display = 'block';
        img.style.margin = '0 auto';
        img.style.height = 'auto';
        img.style.maxWidth = '100%';
        img.style.cursor = 'pointer';
        var ratio = parseFloat(img.getAttribute(IMG_RATIO_ATTR));
        if (!(ratio > 0)) ratio = 100;
        if (ratio > 100) ratio = 100;
        if (ratio < 5) ratio = 5;
        img.setAttribute(IMG_RATIO_ATTR, String(ratio));
        img.style.width = ratio.toFixed(2).replace(/\.?0+$/, '') + '%';
    }

    /* 把一张裸图片整理成独占一段的图片行 */
    function adoptImage(img) {
        if (!img || img.getAttribute('data-npimg') === '1') {
            applyImage(img);
            return;
        }
        img.setAttribute('data-npimg', '1');
        var host = img.parentNode;
        var p = null;
        var el = img;
        while (el && el !== ed()) {
            if (el.nodeType === 1 && (el.tagName === 'P' || el.tagName === 'DIV')) { p = el; break; }
            el = el.parentNode;
        }
        var restText = '';
        var textBefore = '';
        var textAfter = '';
        if (p) {
            var clone = p.cloneNode(true);
            var ci = clone.querySelector('img[data-npimg="1"]');
            if (ci) ci.parentNode.removeChild(ci);
            restText = (clone.textContent || '').replace(/[\s\u00a0\u200b]/g, '');
            /* 记录图片前后各自的文字（供拆段用） */
            var hit = !p.contains(img);
            var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
            while (walker.nextNode()) {
                var tn = walker.currentNode;
                var t2 = tn.textContent || '';
                if (!hit) {
                    if (tn.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING) textBefore += t2;
                    else { hit = true; textAfter += t2; }
                } else {
                    textAfter += t2;
                }
            }
        }
        if (p && !restText && !p.querySelector('img:not([data-npimg="1"])')) {
            /* 整段只有这张图：直接把它变成图片行 */
            p.innerHTML = '';
            lineStyle(p);
            p.appendChild(img);
            applyImage(img);
            return;
        }
        /* 图与文字混排：拆成「前文 / 图片行 / 后文」三段 */
        var np = document.createElement('p');
        lineStyle(np);
        if (host) host.removeChild(img);
        np.appendChild(img);
        var beforeTxt = textBefore.replace(/^[\s\u00a0\u200b]+|[\s\u00a0\u200b]+$/g, '');
        var afterTxt = textAfter.replace(/^[\s\u00a0\u200b]+|[\s\u00a0\u200b]+$/g, '');
        if (p && p.parentNode) {
            var baseStyle = p.getAttribute('style') || '';
            p.parentNode.insertBefore(np, p.nextSibling);
            if (!beforeTxt) {
                /* 图片在段首：原段只留后文，图片放到它前面 */
                p.textContent = afterTxt;
                p.parentNode.insertBefore(np, p);
                if (!afterTxt) p.parentNode.removeChild(p);
            } else if (!afterTxt) {
                /* 图片在段尾：原段只留前文，图片放到它后面 */
                p.textContent = beforeTxt;
            } else {
                /* 图片在段中：拆成两段，图片居中 */
                p.textContent = beforeTxt;
                var ap = document.createElement('p');
                ap.setAttribute('style', baseStyle);
                ap.textContent = afterTxt;
                np.parentNode.insertBefore(ap, np.nextSibling);
            }
        } else if (ed()) {
            ed().appendChild(np);
        }
        applyImage(img);
    }

    /* 幂等整理：包裹裸图、恢复被自动格式改掉的图片行样式 */
    function normalize() {
        var e = ed();
        if (!e) return;
        if (_cur && (!document.contains(_cur) || !e.contains(_cur))) deselect();
        var imgs = e.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) adoptImage(imgs[i]);
        var lines = e.querySelectorAll('p.' + LINE_CLASS);
        for (var j = 0; j < lines.length; j++) {
            var p = lines[j];
            if (p.style.textAlign !== 'center') lineStyle(p);
            if (p.style.textIndent !== '0px' && p.style.textIndent !== '0') p.style.textIndent = '0';
        }
    }

    function scheduleNormalize(delay) {
        if (_timer) clearTimeout(_timer);
        _timer = setTimeout(function () { _timer = null; normalize(); }, delay == null ? 60 : delay);
    }

    /* ---------------- 控制点覆盖层 ---------------- */
    function ensureBox() {
        if (_box) return _box;
        _box = document.createElement('div');
        _box.className = 'npImgBox';
        _box.setAttribute('hidden', '');
        var dirs = ['nw', 'ne', 'sw', 'se', 'w', 'e'];
        for (var i = 0; i < dirs.length; i++) {
            var h = document.createElement('span');
            h.className = 'npImgH npImgH-' + dirs[i];
            h.setAttribute('data-dir', dirs[i]);
            _box.appendChild(h);
        }
        _badge = document.createElement('span');
        _badge.className = 'npImgBadge';
        _box.appendChild(_badge);
        document.body.appendChild(_box);
        _box.addEventListener('mousedown', onHandleDown);
        return _box;
    }

    function placeBox() {
        if (!_cur || !_box || _box.hasAttribute('hidden')) return;
        var r = _cur.getBoundingClientRect();
        _box.style.left = Math.round(r.left) + 'px';
        _box.style.top = Math.round(r.top) + 'px';
        _box.style.width = Math.round(r.width) + 'px';
        _box.style.height = Math.round(r.height) + 'px';
        var ratio = parseFloat(_cur.getAttribute(IMG_RATIO_ATTR)) || 100;
        if (_badge) _badge.textContent = ratio.toFixed(0) + '%';
    }

    function select(img) {
        if (_cur === img) { placeBox(); return; }
        deselect();
        _cur = img;
        img.classList.add(SEL_CLASS);
        ensureBox().removeAttribute('hidden');
        placeBox();
    }

    function deselect() {
        if (_cur) _cur.classList.remove(SEL_CLASS);
        _cur = null;
        if (_box) _box.setAttribute('hidden', '');
    }

    function onHandleDown(e) {
        var h = e.target.closest ? e.target.closest('.npImgH') : null;
        if (!h || !_cur) return;
        e.preventDefault();
        e.stopPropagation();
        var dir = h.getAttribute('data-dir');
        var r = _cur.getBoundingClientRect();
        var p = _cur.closest('p');
        var cw = p ? p.clientWidth : contentWidth();
        _drag = {
            dir: dir,
            startX: e.clientX,
            startW: r.width,
            cw: cw,
            west: dir.indexOf('w') !== -1,
            cur: _cur
        };
        document.body.classList.add('npImgResizing');
    }

    function onMove(e) {
        if (!_drag) return;
        var delta = e.clientX - _drag.startX;
        if (_drag.west) delta = -delta;
        var w = _drag.startW + delta;
        if (w < MIN_W) w = MIN_W;
        if (w > _drag.cw) w = _drag.cw;
        var ratio = _drag.cw > 0 ? (w / _drag.cw) * 100 : 100;
        _drag.cur.setAttribute(IMG_RATIO_ATTR, String(ratio));
        _drag.cur.style.width = ratio.toFixed(2) + '%';
        placeBox();
        e.preventDefault();
    }

    function onUp() {
        if (!_drag) return;
        _drag = null;
        document.body.classList.remove('npImgResizing');
        if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
        if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
        if (typeof window.npRenderDirList === 'function') window.npRenderDirList();
    }

    /* ---------------- 事件绑定 ---------------- */
    function onClick(e) {
        var e2 = ed();
        if (!e2) return;
        var img = e.target && e.target.tagName === 'IMG' ? e.target : null;
        if (img && e2.contains(img)) {
            select(img);
            return;
        }
        if (_cur && !(_box && _box.contains(e.target))) deselect();
    }

    function onMouseDown(e) {
        var img = e.target && e.target.tagName === 'IMG' ? e.target : null;
        if (!img || !ed() || !ed().contains(img)) return;
        /* 点击图片不落光标，避免误输入把图挤掉 */
        e.preventDefault();
        select(img);
    }

    function onDblClick(e) {
        var img = e.target && e.target.tagName === 'IMG' ? e.target : null;
        if (!img || !ed() || !ed().contains(img)) return;
        e.preventDefault();
        img.setAttribute(IMG_RATIO_ATTR, '100');
        img.style.width = '100%';
        select(img);
        if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
        if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
    }

    function onPaste(e) {
        var e2 = ed();
        if (!e2 || !e2.contains(e.target)) return;
        var dt = e.clipboardData;
        var hasImage = false;
        if (dt && dt.items) {
            for (var i = 0; i < dt.items.length; i++) {
                if (dt.items[i].kind === 'file' && /^image\//.test(dt.items[i].type)) { hasImage = true; break; }
            }
        }
        if (!hasImage && dt && dt.types) {
            for (var t = 0; t < dt.types.length; t++) {
                if (dt.types[t] === 'Files') { hasImage = true; break; }
            }
        }
        if (!hasImage) return;
        /* 让浏览器先完成默认粘贴，再整理 */
        setTimeout(function () { normalize(); }, 0);
        setTimeout(function () { normalize(); }, 120);
    }

    function bind() {
        var e2 = ed();
        if (!e2) return;
        ensureBox();
        document.addEventListener('click', onClick, true);
        e2.addEventListener('mousedown', onMouseDown, true);
        e2.addEventListener('dblclick', onDblClick, true);
        e2.addEventListener('paste', onPaste, true);
        e2.addEventListener('input', function () { scheduleNormalize(80); });
        e2.addEventListener('scroll', placeBox, true);
        window.addEventListener('scroll', placeBox, true);
        window.addEventListener('resize', function () { deselect(); scheduleNormalize(60); });
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);
        document.addEventListener('keydown', function (ev) {
            if (ev.key === 'Escape') deselect();
        });
        if (window.ResizeObserver) {
            try {
                new ResizeObserver(function () { placeBox(); }).observe(e2);
            } catch (err) {}
        }
        /* 切换主题 / 从缓存恢复内容后重新整理 */
        ['npRenderTopicList', 'syncEditorFromData', 'npRefreshWorkspace'].forEach(function (fn) {
            var orig = window[fn];
            if (typeof orig !== 'function' || orig.__npImgWrapped) return;
            var wrapped = function () {
                var r = orig.apply(this, arguments);
                scheduleNormalize(120);
                return r;
            };
            wrapped.__npImgWrapped = true;
            window[fn] = wrapped;
        });
        normalize();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(bind, 60); });
    } else {
        setTimeout(bind, 60);
    }

    window.npNormalizeImages = normalize;
    window.npDeselectImage = deselect;
})();
