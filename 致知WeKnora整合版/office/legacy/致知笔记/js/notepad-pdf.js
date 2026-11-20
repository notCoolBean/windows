/* 致知笔记 · PDF 页内预览
   本机离线使用 pdfjs-dist 3.11 legacy 版（js/vendor/pdf.min.js）。
   支持：整份 PDF 逐页渲染、上一页/下一页、Ctrl+滚轮缩放、底栏 −/100%/+ 缩放。
   局部预览（参考资料 / 附件查看器）默认按容器宽度适配；多窗预览按窗口缩放比例渲染。 */
(function (w) {
    'use strict';

    var WORKER = 'js/vendor/pdf.worker.min.js';
    var states = typeof WeakMap === 'function' ? new WeakMap() : null;
    var DPR = Math.min(2, w.devicePixelRatio || 1);

    function lib() {
        var l = w.pdfjsLib;
        if (!l || typeof l.getDocument !== 'function') return null;
        try {
            if (l.GlobalWorkerOptions && !l.GlobalWorkerOptions.workerSrc) {
                l.GlobalWorkerOptions.workerSrc = WORKER;
            }
        } catch (e) {}
        return l;
    }

    function clamp(v, a, b) {
        return Math.max(a, Math.min(b, v));
    }

    function notifyZoom(s) {
        if (typeof s.onZoom === 'function') {
            try { s.onZoom(s.scale); } catch (e) {}
        }
    }

    function notifyPage(s) {
        if (typeof s.onPage === 'function') {
            try { s.onPage(s.page, s.total); } catch (e) {}
        }
    }

    function cancelTasks(s) {
        s.token++;
        if (s.tasks && s.tasks.length) {
            s.tasks.forEach(function (t) { try { t.cancel(); } catch (e) {} });
        }
        s.tasks = [];
    }

    function renderPage(s, n, token) {
        if (!s.doc || token !== s.token) return Promise.resolve();
        var item = s.pages[n - 1];
        if (!item) return Promise.resolve();
        return s.doc.getPage(n).then(function (page) {
            if (token !== s.token) return;
            var vp = page.getViewport({ scale: s.scale });
            var cv = item.canvas;
            cv.width = Math.max(1, Math.floor(vp.width * DPR));
            cv.height = Math.max(1, Math.floor(vp.height * DPR));
            cv.style.width = Math.floor(vp.width) + 'px';
            cv.style.height = Math.floor(vp.height) + 'px';
            item.el.style.width = Math.floor(vp.width) + 'px';
            var ctx = cv.getContext('2d');
            if (!ctx) return;
            var task = page.render({
                canvasContext: ctx,
                viewport: vp,
                transform: DPR !== 1 ? [DPR, 0, 0, DPR, 0, 0] : null
            });
            s.tasks.push(task);
            return task.promise.then(function () {
                item.ready = true;
            }).catch(function (e) {
                if (e && e.name !== 'RenderingCancelledException') {
                    if (w.console && console.warn) console.warn('[npPdf] page ' + n, e);
                }
            });
        });
    }

    function renderAll(s) {
        if (!s.doc || !s.pages.length) return;
        cancelTasks(s);
        var token = s.token;
        var n = 1;
        function next() {
            if (token !== s.token || n > s.total) return;
            var at = n++;
            renderPage(s, at, token).then(next, next);
        }
        next();
    }

    function buildPages(s) {
        var box = s.host.querySelector('.npPdfPages');
        if (!box) return;
        box.innerHTML = '';
        s.pages = [];
        for (var i = 1; i <= s.total; i++) {
            var el = document.createElement('div');
            el.className = 'npPdfPage';
            el.setAttribute('data-page', String(i));
            var cv = document.createElement('canvas');
            el.appendChild(cv);
            box.appendChild(el);
            s.pages.push({ el: el, canvas: cv, ready: false });
        }
    }

    function bindScroll(s) {
        var view = s.host.querySelector('.npPdfView');
        if (!view) return;
        var timer = null;
        view.addEventListener('scroll', function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () {
                timer = null;
                if (!s.pages.length) return;
                var top = view.scrollTop + 16;
                var cur = 1;
                for (var i = 0; i < s.pages.length; i++) {
                    var el = s.pages[i].el;
                    if (el.offsetTop <= top) cur = i + 1;
                    else break;
                }
                if (cur !== s.page) {
                    s.page = cur;
                    notifyPage(s);
                }
            }, 90);
        });
    }

    function destroy(host) {
        if (!host || !states) return;
        var s = states.get(host);
        if (!s) return;
        cancelTasks(s);
        if (s.doc) { try { s.doc.destroy(); } catch (e) {} }
        states.delete(host);
        host.classList.remove('npPdfBody');
        try { host.style.removeProperty('height'); } catch (e) {}
    }

    function render(host, bytes, opts) {
        if (!host) return Promise.reject(new Error('no host'));
        destroy(host);
        var l = lib();
        if (!l) return Promise.reject(new Error('PDF 组件未加载'));
        opts = opts || {};
        var s = {
            host: host,
            doc: null,
            total: 0,
            page: 1,
            scale: 1,
            fit: opts.fit !== false,
            token: 0,
            pages: [],
            tasks: [],
            onZoom: opts.onZoom,
            onPage: opts.onPage
        };
        if (states) states.set(host, s);
        host.classList.add('npPdfBody');
        host.innerHTML = '<div class="npPdfView"><div class="npPdfPages"></div></div>';
        var view = host.querySelector('.npPdfView');
        var data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
        var s0 = s;
        host._npPdfState = s0;
        return l.getDocument({
            data: data,
            isEvalSupported: false,
            useWorkerFetch: false,
            useSystemFonts: true
        }).promise.then(function (doc) {
            if (!states || states.get(host) !== s) {
                try { doc.destroy(); } catch (e) {}
                return false;
            }
            s.doc = doc;
            s.total = doc.numPages || 0;
            return doc.getPage(1).then(function (page) {
                var vp = page.getViewport({ scale: 1 });
                var avail = (view && view.clientWidth) || host.clientWidth || 600;
                s.scale = s.fit ? clamp((avail - 22) / vp.width, 0.3, 2) : 1;
                buildPages(s);
                bindScroll(s);
                notifyZoom(s);
                notifyPage(s);
                renderAll(s);
                return true;
            });
        }).catch(function (e) {
            if (w.console && console.warn) console.warn('[npPdf] render failed', e);
            if (host) host.innerHTML = '<div class="npPdfError">PDF 渲染失败：' + (e && e.message ? e.message : e) + '</div>';
            throw e;
        });
    }

    function stateOf(host) {
        if (!host || !states) return null;
        return states.get(host) || null;
    }

    function setScale(host, scale) {
        var s = stateOf(host);
        if (!s) return;
        var next = clamp(Number(scale) || 1, 0.3, 4);
        if (Math.abs(next - s.scale) < 0.001) return;
        s.scale = next;
        notifyZoom(s);
        renderAll(s);
    }

    function step(host, delta) {
        var s = stateOf(host);
        if (!s || !s.pages.length) return;
        var next = clamp(s.page + (delta || 0), 1, s.total);
        if (next === s.page) return;
        s.page = next;
        var item = s.pages[next - 1];
        var view = s.host.querySelector('.npPdfView');
        if (item && view) {
            view.scrollTop = Math.max(0, item.el.offsetTop - 8);
        }
        notifyPage(s);
    }

    function fit(host) {
        var s = stateOf(host);
        if (!s || !s.doc) return;
        var view = s.host.querySelector('.npPdfView');
        var avail = (view && view.clientWidth) || s.host.clientWidth || 600;
        s.doc.getPage(1).then(function (page) {
            var vp = page.getViewport({ scale: 1 });
            s.scale = clamp((avail - 22) / vp.width, 0.3, 2);
            notifyZoom(s);
            renderAll(s);
        });
    }

    w.NpPdfView = {
        render: render,
        destroy: destroy,
        setScale: setScale,
        step: step,
        fit: fit,
        state: stateOf
    };
})(window);
