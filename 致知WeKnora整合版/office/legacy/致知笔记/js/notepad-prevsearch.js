/* 致知笔记 · 预览栏「笔记」页：全文检索 + 多关键字多色高亮
   规则与 `10--谈话助手` 的预览区检索一致：
     - 空格 = 或者，每组一种高亮色（最多 5 组循环配色）
     - `-`  = 并且，同一段里必须都出现
   结果呈现：左侧「文件夹 → 命中笔记」树，右侧只读正文并高亮。 */
(function () {
    'use strict';

    var COLORS = 5;
    var BLOCK_SEL = 'p,li,h1,h2,h3,h4,h5,h6,td,th,div,section,article,blockquote,pre,dd,dt,figcaption';
    var SENT_RE = /[^，,。.;；!！?？…\n]+(?:[…]{2,}|[，,。.;；!！?？…\n])?/g;
    var PH_TEXT = '检索笔记：空格=或者，- =并且';

    var state = {
        groups: [],
        entries: [],
        results: [],
        sel: -1,
        open: Object.create(null),
        seq: 0,
        bound: false,
        timer: null,
        browsing: false,
        browseSel: '',
        painted: '',
        lastQuery: '',
        pathMap: Object.create(null)
    };
    var noteCache = Object.create(null);   /* path -> { html, title, at } */
    var regCache = Object.create(null);

    function $(id) { return document.getElementById(id); }
    function esc(text) {
        return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function toast(msg) {
        if (typeof showToast === 'function') showToast(msg);
    }

    /* 检索条下方：每组关键字 + 实心圆数量（颜色 = 该组高亮色） */
    function renderTermBadges(counts) {
        var host = $('npPrevTerms');
        if (!host) return;
        var groups = state.groups || [];
        if (!groups.length) {
            host.innerHTML = '';
            host.hidden = true;
            return;
        }
        host.hidden = false;
        host.innerHTML = groups.map(function (group, gi) {
            var n = (counts && counts[gi]) || 0;
            return '<span class="npSearchTerm">' +
                '<span class="npSearchTermText">' + esc(group.join('-')) + '</span>' +
                '<span class="npSearchDot npSearchDot' + (gi % COLORS) + '">' + n + '</span>' +
                '</span>';
        }).join('');
    }

    /* ---------------- 关键字 ---------------- */
    function parseGroups(raw) {
        return String(raw == null ? '' : raw).trim().split(/\s+/).filter(Boolean)
            .map(function (group) {
                return group.split(/[-－]/).map(function (t) { return t.trim(); }).filter(Boolean);
            })
            .filter(function (group) { return group.length; });
    }

    /* 字间容错：Word 另存的网页常在汉字之间插空格 */
    function termReg(term) {
        var key = String(term == null ? '' : term).replace(/\s+/g, '');
        if (!key) return null;
        if (regCache[key]) return regCache[key];
        var chars = Array.from(key).map(function (c) {
            return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        });
        var re = new RegExp(chars.join('\\s*'), 'gi');
        regCache[key] = re;
        return re;
    }

    function textMatches(text, groups) {
        if (!text) return false;
        return groups.some(function (group) {
            return group.every(function (term) {
                var re = termReg(term);
                if (!re) return true;
                re.lastIndex = 0;
                return re.test(text);
            });
        });
    }

    function scanMarks(text, entries) {
        var marks = [];
        entries.forEach(function (entry) {
            entry.terms.forEach(function (term) {
                var re = termReg(term);
                if (!re) return;
                re.lastIndex = 0;
                var m;
                while ((m = re.exec(text))) {
                    if (!m[0]) { re.lastIndex++; continue; }
                    marks.push({ start: m.index, end: m.index + m[0].length, gi: entry.gi });
                    if (m.index === re.lastIndex) re.lastIndex++;
                }
            });
        });
        if (!marks.length) return [];
        marks.sort(function (a, b) { return a.start - b.start || (b.end - b.start) - (a.end - a.start); });
        var kept = [], lastEnd = -1;
        marks.forEach(function (r) {
            if (r.start < lastEnd) return;
            kept.push(r);
            lastEnd = r.end;
        });
        return kept;
    }

    function markHtml(text, entries) {
        var kept = scanMarks(text, entries);
        if (!kept.length) return esc(text);
        var out = '', cursor = 0;
        kept.forEach(function (r) {
            out += esc(text.slice(cursor, r.start));
            out += '<span class="npPvHl npPvHl' + (r.gi % COLORS) + '">' + esc(text.slice(r.start, r.end)) + '</span>';
            cursor = r.end;
        });
        return out + esc(text.slice(cursor));
    }

    /* ---------------- 取数：树节点 / 内存页 ---------------- */
    function folderOf(path, fallback) {
        var p = String(path == null ? '' : path);
        var base = (typeof window.npLibRootPath === 'function' ? window.npLibRootPath() : '') || '';
        if (base && p.indexOf(base) === 0) p = p.slice(base.length);
        p = p.replace(/^[\\/]+/, '');
        var seg = p.split(/[\\/]/);
        if (seg.length > 1) seg.pop();
        else seg = [];
        return seg.filter(Boolean).join(' / ') || fallback || '根目录';
    }

    function collectTargets() {
        var out = [];
        if (typeof window.npLibActive === 'function' && window.npLibActive() &&
            typeof window.npLibTree === 'function') {
            (function walk(nodes, folder) {
                for (var i = 0; i < (nodes || []).length; i++) {
                    var n = nodes[i];
                    if (!n) continue;
                    if (n.kind === 'file') {
                        if (!/\.js$/i.test(n.name || '')) continue;
                        out.push({
                            path: n.path,
                            name: n.name,
                            title: String(n.name || '').replace(/\.js$/i, ''),
                            folder: folder || '根目录',
                            node: n
                        });
                    } else if (n.kind === 'dir') {
                        var sub = folder ? folder + ' / ' + n.name : n.name;
                        walk(n.children, sub);
                    }
                }
            })(window.npLibTree() || [], '');
            return out;
        }
        /* 旧页签模式（没有文件夹层）：检索内存里的各篇 */
        var count = 0;
        if (typeof tabCount === 'function') count = tabCount();
        else if (typeof notepadEditorData !== 'undefined' && notepadEditorData) count = Object.keys(notepadEditorData).length;
        var cur = (typeof currentNotepadTab !== 'undefined' && currentNotepadTab >= 0) ? currentNotepadTab : -1;
        for (var i = 0; i < count; i++) {
            out.push({
                path: 'mem:' + i,
                name: '第 ' + (i + 1) + ' 篇',
                title: (typeof topicName === 'function' ? topicName(i) : ('第 ' + (i + 1) + ' 篇')),
                folder: '当前窗口',
                memory: true,
                index: i
            });
        }
        if (cur < 0 || (out.length && !out.some(function (o) { return o.index === cur; }))) {
            var ed = $('notepadEditor');
            var live = ed ? String(ed.innerHTML || '') : '';
            if (live) {
                out.push({
                    path: 'mem:live',
                    name: '当前编辑',
                    title: '当前编辑',
                    folder: '当前窗口',
                    memory: true,
                    index: -1,
                    html: live
                });
            }
        }
        return out;
    }

    function isLib() {
        return (typeof window.npLibActive === 'function' && window.npLibActive() &&
            typeof window.npLibTree === 'function');
    }

    function nameStem(name) {
        return String(name || '').replace(/\.js$/i, '');
    }

    function countFiles(nodes) {
        var n = 0;
        (nodes || []).forEach(function (x) {
            if (x.kind === 'file') n++;
            else n += countFiles(x.children);
        });
        return n;
    }

    function loadOne(target) {
        return new Promise(function (resolve) {
            if (target.memory) {
                if (typeof target.html === 'string') {
                    resolve({ html: target.html, title: target.title });
                    return;
                }
                var html = '';
                var cur = (typeof currentNotepadTab !== 'undefined') ? currentNotepadTab : -1;
                if (target.index === cur) {
                    var ed = $('notepadEditor');
                    html = ed ? ed.innerHTML : '';
                }
                if (!html) {
                    var data = (typeof notepadEditorData !== 'undefined') ? notepadEditorData[target.index] : null;
                    if (data && data.html) html = data.html;
                }
                resolve({ html: html || '', title: target.title });
                return;
            }
            var hit = noteCache[target.path];
            var fresh = hit && (Date.now() - hit.at < 60000);
            if (fresh) { resolve(hit); return; }
            var cached = null;
            try {
                if (typeof window.npLibDocsCache === 'function') {
                    var all = window.npLibDocsCache() || {};
                    if (typeof all[target.path] === 'string') cached = all[target.path];
                }
            } catch (e) { cached = null; }
            if (cached) {
                var one = { html: cached, title: target.title, at: Date.now() };
                noteCache[target.path] = one;
                resolve(one);
                return;
            }
            if (typeof window.npLibReadNode !== 'function' || !target.node) { resolve(null); return; }
            Promise.resolve(window.npLibReadNode(target.node)).then(function (r) {
                if (!r) { resolve(null); return; }
                var rec = { html: r.html || '', title: r.title || target.title, at: Date.now() };
                noteCache[target.path] = rec;
                resolve(rec);
            }).catch(function () { resolve(null); });
        });
    }

    function mapLimit(items, limit, fn) {
        return new Promise(function (resolve) {
            var out = new Array(items.length);
            var next = 0, running = 0, done = 0;
            if (!items.length) { resolve(out); return; }
            function pump() {
                while (running < limit && next < items.length) {
                    (function (idx) {
                        running++;
                        Promise.resolve(fn(items[idx])).then(function (r) {
                            out[idx] = r;
                        }).catch(function () {
                            out[idx] = null;
                        }).then(function () {
                            running--; done++;
                            if (done === items.length) resolve(out);
                            else pump();
                        });
                    })(next++);
                }
            }
            pump();
        });
    }

    /* ---------------- 正文工具 ---------------- */
    function blocksOf(root) {
        var all = Array.prototype.slice.call(root.querySelectorAll(BLOCK_SEL));
        var leaves = all.filter(function (el) { return !el.querySelector(BLOCK_SEL); });
        return leaves.length ? leaves : [root];
    }

    /* 段落之间补换行：摘要取句时不把两段粘成一句 */
    function plainOf(html) {
        var box = document.createElement('div');
        box.innerHTML = String(html || '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote|pre|dd|dt)>/gi, '\n');
        return (box.textContent || '').replace(/\u00a0/g, ' ');
    }

    function sentenceRanges(text) {
        var out = [], m;
        SENT_RE.lastIndex = 0;
        while ((m = SENT_RE.exec(text))) {
            if (!m[0].trim()) continue;
            out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
        }
        return out;
    }

    function snippetOf(html, groups) {
        var text = plainOf(html);
        var ranges = sentenceRanges(text);
        for (var i = 0; i < ranges.length; i++) {
            if (textMatches(ranges[i].text, groups)) {
                var s = String(ranges[i].text).replace(/^\s+/, '');
                return s.length > 90 ? s.slice(0, 90) + '…' : s;
            }
        }
        var flat = text.replace(/\s+/g, ' ').trim();
        return flat.length > 90 ? flat.slice(0, 90) + '…' : flat;
    }

    /* ---------------- 分析 ---------------- */
    function analyze(loaded, groups, targets) {
        state.browsing = false;
        state.painted = '';
        var entries = groups.map(function (terms, gi) { return { terms: terms, gi: gi }; });
        state.entries = entries;
        var results = [];
        var groupHits = groups.map(function () { return 0; });
        for (var i = 0; i < loaded.length; i++) {
            var item = loaded[i];
            var t = targets[i];
            if (!item || !item.html) continue;
            var text = plainOf(item.html);
            if (t.title) text += '\n' + t.title;
            var hits = 0;
            entries.forEach(function (entry, gi) {
                if (!textMatches(text, [entry.terms])) return;
                entry.terms.forEach(function (term) {
                    var re = termReg(term);
                    if (!re) return;
                    re.lastIndex = 0;
                    var m;
                    while ((m = re.exec(text))) {
                        if (!m[0]) { re.lastIndex++; continue; }
                        hits++;
                        groupHits[gi] = (groupHits[gi] || 0) + 1;
                        if (m.index === re.lastIndex) re.lastIndex++;
                    }
                });
            });
            if (!hits) continue;
            results.push({
                path: t.path,
                name: t.name,
                title: item.title || t.title,
                folder: t.folder,
                html: item.html,
                hits: hits,
                snippet: snippetOf(item.html, groups)
            });
        }
        state.results = results;
        state.sel = -1;
        renderTermBadges(groupHits);
        renderResults();
        updateHint();
        if (results.length) select(0);
        else {
            var doc = $('npPrevDoc');
            if (doc) doc.innerHTML = '<div class="npPvEmpty">没有命中的笔记。<br>换个词试试；空格表示或者，<b>-</b> 表示并且（例如：<code>通知-会议</code>）。</div>';
        }
    }

    /* ---------------- 渲染 ---------------- */
    function renderResults() {
        var host = $('npPvResTree');
        if (!host) return;
        var list = state.results;
        if (state.groups.length && !list.length) {
            host.innerHTML = '<div class="npPvEmpty">没有命中的笔记。</div>';
            return;
        }
        if (!state.groups.length) {
            host.innerHTML = '<div class="npPvEmpty">输入关键字后，这里按文件夹列出命中的笔记。<br>空格=或者，<b>-</b>=并且；最多 5 组不同高亮色。</div>';
            return;
        }
        var order = [];
        var groupsMap = Object.create(null);
        list.forEach(function (r) {
            if (!groupsMap[r.folder]) {
                groupsMap[r.folder] = [];
                order.push(r.folder);
            }
            groupsMap[r.folder].push(r);
        });
        var html = '';
        order.forEach(function (folder) {
            var rows = groupsMap[folder];
            var open = state.open[folder] !== false;
            html += '<div class="npPvFolderRow" data-folder="' + esc(folder) + '" title="' + esc(folder) + '">' +
                '<span class="npPvArrow">' + (open ? '▾' : '▸') + '</span>' +
                '<img src="data/type/folder.ico" alt="" draggable="false">' +
                '<span class="nm">' + esc(folder) + '</span><em>' + rows.length + '</em></div>';
            if (!open) return;
            rows.forEach(function (r) {
                var idx = list.indexOf(r);
                html += '<button type="button" class="npPvItem' + (idx === state.sel ? ' on' : '') +
                    '" data-idx="' + idx + '" title="' + esc(r.path) + '">' +
                    '<img src="data/type/json.ico" alt="" draggable="false">' +
                    '<span class="nm">' + esc(r.title || r.name) + '</span>' +
                    '<em>' + r.hits + '</em>' +
                    '<span class="sn">' + markHtml(r.snippet, state.entries) + '</span>' +
                    '</button>';
            });
        });
        host.innerHTML = html;
        var cur = host.querySelector('.npPvItem.on');
        if (cur && cur.scrollIntoView) {
            try { cur.scrollIntoView({ block: 'nearest' }); } catch (e) {}
        }
    }

    /* ---------------- 默认浏览：复用「数据」栏的文件树样式 ---------------- */
    function indexTargets() {
        var map = Object.create(null);
        if (isLib()) {
            (function walk(nodes, folder) {
                (nodes || []).forEach(function (n) {
                    if (!n) return;
                    if (n.kind === 'dir') {
                        walk(n.children, folder ? folder + ' / ' + n.name : n.name);
                    } else if (/\.js$/i.test(n.name || '')) {
                        map[n.path] = {
                            path: n.path, name: n.name, title: nameStem(n.name),
                            folder: folder || '根目录', node: n
                        };
                    }
                });
            })(window.npLibTree() || [], '');
        } else {
            collectTargets().forEach(function (t) { map[t.path] = t; });
        }
        return map;
    }

    function browseSig() {
        var closed = [];
        Object.keys(state.open).forEach(function (k) {
            if (state.open[k] === false) closed.push(k);
        });
        closed.sort();
        var count = Object.keys(state.pathMap || {}).length;
        var root = (typeof window.npLibRootPath === 'function' ? window.npLibRootPath() : '') || '';
        return (isLib() ? 'lib' : 'mem') + '|' + root + '|' + count + '|' +
            closed.join(',') + '|' + (state.browseSel || '');
    }

    function browseToggle(path) {
        state.open[path] = state.open[path] === false;
        renderBrowse(true);
    }

    function selectPath(path, force) {
        var host = $('npPvResTree');
        if (host) {
            var rows = host.querySelectorAll('[data-browse-file]');
            for (var i = 0; i < rows.length; i++) {
                rows[i].classList.toggle('active', rows[i].getAttribute('data-browse-file') === path);
            }
        }
        state.browseSel = path;
        if (!force && state.painted === path) return;
        var target = state.pathMap[path];
        if (!target) return;
        state.painted = path;
        loadOne(target).then(function (rec) {
            if (state.painted !== path) return;
            renderArticles(rec, path);
        });
    }

    function renderBrowse(force) {
        var host = $('npPvResTree');
        if (!host) return;
        var sig = browseSig();
        if (!force && state.browsing && host.getAttribute('data-sig') === sig) return;
        state.browsing = true;
        state.groups = [];
        state.entries = [];
        state.sel = -1;
        state.pathMap = indexTargets();
        renderLegend();

        var html = '';
        if (isLib()) {
            var tree = window.npLibTree() || [];
            if (!tree.length) {
                html = '<div class="npPvEmpty">这个文件夹里还没有 .js 笔记。</div>';
            } else {
                html = '<div class="npTreeList npPvTreeList">';
                (function walk(nodes, depth) {
                    (nodes || []).forEach(function (n) {
                        if (!n) return;
                        if (n.kind === 'dir') {
                            var open = state.open[n.path] !== false;
                            html += '<div class="npTreeFolder' + (open ? '' : ' collapsed') +
                                '" data-browse-dir="' + esc(n.path) + '" title="' + esc(n.path) + '" style="padding-left:' +
                                (8 + depth * 14) + 'px">' +
                                '<span class="npTreeArrow">' + (open ? '▾' : '▸') + '</span>' +
                                '<img class="npTreeIcon" src="data/type/folder.ico" alt="" draggable="false">' +
                                '<span class="npTreeName">' + esc(n.name) + '</span>' +
                                '<span class="npTreeCount">' + countFiles(n.children) + '</span></div>';
                            if (open) walk(n.children, depth + 1);
                        } else if (/\.js$/i.test(n.name || '')) {
                            var active = state.browseSel === n.path;
                            html += '<div class="npTreeFile' + (active ? ' active' : '') +
                                '" data-browse-file="' + esc(n.path) + '" title="' + esc(n.path) + '" style="padding-left:' +
                                (8 + depth * 14) + 'px">' +
                                '<img class="npTreeIcon" src="data/type/json.ico" alt="" draggable="false">' +
                                '<span class="npTreeName">' + esc(nameStem(n.name)) + '</span>' +
                                '<span class="npTreeExt">.js</span></div>';
                        }
                    });
                })(tree, 0);
                html += '</div>';
            }
        } else {
            var items = collectTargets();
            if (!items.length) {
                html = '<div class="npPvEmpty">还没有可预览的笔记。</div>';
            } else {
                html = '<div class="npTreeList npPvTreeList">';
                items.forEach(function (t) {
                    var active = state.browseSel === t.path;
                    html += '<div class="npTreeFile' + (active ? ' active' : '') +
                        '" data-browse-file="' + esc(t.path) + '" title="' + esc(t.path) + '" style="padding-left:10px">' +
                        '<img class="npTreeIcon" src="data/type/json.ico" alt="" draggable="false">' +
                        '<span class="npTreeName">' + esc(t.title || t.name) + '</span></div>';
                });
                html += '</div>';
            }
        }
        host.innerHTML = html;
        host.setAttribute('data-sig', browseSig());
        updateHint();

        /* 选中：保留上次 → 当前打开的笔记 → 第一篇 */
        var sel = state.browseSel;
        if (!sel || !state.pathMap[sel]) {
            var cur = (typeof window.npLibOpenPath === 'function') ? (window.npLibOpenPath() || '') : '';
            if (cur && state.pathMap[cur]) sel = cur;
            else {
                var first = Object.keys(state.pathMap)[0] || '';
                sel = first;
            }
        }
        if (sel) {
            state.painted = '';
            selectPath(sel, true);
        } else {
            state.painted = '';
            var doc = $('npPrevDoc');
            if (doc) doc.innerHTML = '<div class="npPvEmpty">左侧还没有笔记。</div>';
        }    }

    function renderLegend() {
        var box = $('npPrevLegend');
        if (!box) return;
        box.innerHTML = '';
        state.groups.forEach(function (group, gi) {
            var label = group.join('+');
            box.insertAdjacentHTML('beforeend',
                '<span class="npPrevLegendItem" title="' + esc(label) + '">' +
                '<i class="npPrevDot npPrevDot' + (gi % COLORS) + '"></i>' +
                '<b>' + esc(label.length > 12 ? label.slice(0, 12) + '…' : label) + '</b></span>');
        });
    }

    function updateHint() {
        var hint = $('npPrevHint');
        if (!hint) return;
        if (!state.groups.length) {
            hint.textContent = '';
            return;
        }
        if (!state.results.length) {
            hint.textContent = '无匹配';
            return;
        }
        var total = 0;
        state.results.forEach(function (r) { total += r.hits; });
        hint.textContent = '命中 ' + state.results.length + ' 篇 · ' + total + ' 处';
    }

    function collectRanges(root, list) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                var pn = node.parentNode;
                if (pn && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(pn.nodeName)) return NodeFilter.FILTER_REJECT;
                if (pn && pn.classList && pn.classList.contains('npPvHl')) return NodeFilter.FILTER_REJECT;
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
        if (!nodes.length || !full) return null;
        var kept = scanMarks(full, list);
        if (!kept.length) return null;
        return { nodes: nodes, starts: starts, ranges: kept };
    }

    function wrapRanges(hit) {
        var nodes = hit.nodes, starts = hit.starts, ranges = hit.ranges;
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var ns = starts[i], ne = ns + node.nodeValue.length;
            var local = [];
            for (var r = 0; r < ranges.length; r++) {
                var it = ranges[r];
                if (it.end <= ns || it.start >= ne) continue;
                local.push({
                    start: Math.max(0, it.start - ns),
                    end: Math.min(node.nodeValue.length, it.end - ns),
                    gi: it.gi
                });
            }
            if (!local.length) continue;
            var value = node.nodeValue;
            var frag = document.createDocumentFragment();
            var cursor = 0;
            local.forEach(function (item) {
                if (item.start > cursor) frag.appendChild(document.createTextNode(value.slice(cursor, item.start)));
                var span = document.createElement('span');
                span.className = 'npPvHl npPvHl' + (item.gi % COLORS);
                span.textContent = value.slice(item.start, item.end);
                frag.appendChild(span);
                cursor = item.end;
            });
            if (cursor < value.length) frag.appendChild(document.createTextNode(value.slice(cursor)));
            node.parentNode.replaceChild(frag, node);
        }
    }

    function paintDoc(res) {
        var doc = $('npPrevDoc');
        if (!doc) return;
        if (!res || !res.html) {
            doc.innerHTML = '<div class="npPvEmpty">左侧点一篇文章，这里会列出它的内容。</div>';
            return;
        }
        var html = res.html || '';
        var from = res.noteTitle ? ('<div class="npPvNoteFrom">来自：' + esc(res.noteTitle) + '</div>') : '';
        doc.innerHTML = from + html;
        var ps = doc.querySelectorAll('p');
        for (var i = 0; i < ps.length; i++) {
            ps[i].removeAttribute('data-collapsed');
            ps[i].style.display = '';
        }
        if (!state.entries.length) { doc.scrollTop = 0; return; }
        blocksOf(doc).forEach(function (block) {
            var text = block.textContent || '';
            if (!text) return;
            var hit = state.entries.filter(function (e) { return textMatches(text, [e.terms]); });
            if (!hit.length) return;
            var ranges = collectRanges(block, hit);
            if (ranges) wrapRanges(ranges);
        });
        doc.scrollTop = 0;
    }

    /* 右栏：文章列表（点击打开共用预览窗口） */
    function renderArticles(rec, path) {
        var doc = $('npPrevDoc');
        if (!doc) return;
        var entries = articleEntries(rec);
        if (!entries.length) {
            doc.innerHTML = '<div class="npPvEmpty">这篇笔记还没有文章标题。<br>用「层级」把首段设为文章标题后，这里会按文章列出。</div>';
            return;
        }
        var html = '<div class="npPvListHead">' +
            '<span class="npPvListTitle">' + esc(rec && rec.title ? rec.title : '文章列表') + '</span>' +
            '<span class="npPvListCount">' + entries.length + ' 篇</span></div>' +
            '<div class="npPvArticleList">';
        entries.forEach(function (e, i) {
            html += '<button type="button" class="npPvArticle" data-artpath="' + esc(path || '') +
                '" data-artseq="' + i + '" title="' + esc(e.title) + '">' +
                '<span class="npPvArtNum">' + (i + 1) + '</span>' +
                '<span class="npPvArtName">' + esc(e.title) + '</span>' +
                '<span class="npPvArtHits">' + (e.hits ? e.hits + ' 处' : '') + '</span></button>';
        });
        html += '</div>';
        doc.innerHTML = html;
        doc.scrollTop = 0;
    }

    /* 把一篇笔记的 html 按索引标题切成若干段（与中部「文章列表」同一口径） */
    function articleEntries(rec) {
        if (!rec || !rec.html) return [];
        var box = document.createElement('div');
        box.innerHTML = rec.html;
        var ps = Array.prototype.slice.call(box.querySelectorAll('p'));
        var out = [];
        var cur = null;
        /* 与中部 scanArticles 同一口径：两个索引标题之间只有空段 / 标题 / 日期 / 作者，
           算同一次索引的重复写入，只保留第一个，否则文章列表会重复 N 行。 */
        function indexRunOnlyBetween(fromExclusive, toExclusive) {
            for (var i = fromExclusive + 1; i < toExclusive; i++) {
                var q = ps[i];
                var qt = String(q && q.textContent || '').replace(/^\s+|\s+$/g, '');
                if (!qt) continue;
                if (q.getAttribute('data-outline-level') === '1') continue;
                var lv = q.getAttribute('data-level') || '';
                if (lv === 'title' || lv === 'date' || lv === 'author') continue;
                return false;
            }
            return true;
        }
        /* 单篇视图保存过的笔记会把非当前篇写成 display:none / data-dir-hidden。
           预览窗口没有中部那套显示锁，直接渲染这些段会整篇空白；这里在副本上去掉。 */
        function cleanP(p) {
            var c = p.cloneNode(true);
            c.removeAttribute('data-dir-hidden');
            c.removeAttribute('data-collapsed');
            c.removeAttribute('hidden');
            c.style.display = '';
            if (!c.getAttribute('style')) c.removeAttribute('style');
            return c.outerHTML;
        }
        ps.forEach(function (p, i) {
            var txt = (p.textContent || '').replace(/^\s+|\s+$/g, '');
            if (!txt) return;
            /* 只有索引标题开新篇；普通文章标题只是本篇内容 */
            if (p.getAttribute('data-outline-level') !== '1') {
                if (cur) cur.parts.push(cleanP(p));
                return;
            }
            var prev = out.length ? out[out.length - 1] : null;
            if (prev && prev.pendingDup && indexRunOnlyBetween(prev.idx, i)) return;
            if (prev) prev.pendingDup = false;
            var idxLabel = txt.replace(/^【[^】]+】\s*/, '').trim() || txt;
            cur = { title: idxLabel, parts: [cleanP(p)], hits: 0, idx: i, pendingDup: true };
            out.push(cur);
        });
        out.forEach(function (e) {
            var t = document.createElement('div');
            t.innerHTML = e.parts.join('');
            var text = t.textContent || '';
            var hits = 0;
            (state.entries || []).forEach(function (entry) {
                if (!textMatches(text, [entry.terms])) return;
                entry.terms.forEach(function (term) {
                    var re = termReg(term);
                    if (!re) return;
                    re.lastIndex = 0;
                    var m;
                    while ((m = re.exec(text))) {
                        if (!m[0]) { re.lastIndex++; continue; }
                        hits++;
                        if (m.index === re.lastIndex) re.lastIndex++;
                    }
                });
            });
            e.hits = hits;
        });
        return out;
    }

    var _artCache = { path: '', entries: [] };

    function openArticle(path, seq) {
        var target = state.pathMap[path];
        if (!target) return;
        loadOne(target).then(function (rec) {
            if (!rec) return;
            var entries = articleEntries(rec);
            var e = entries[seq];
            if (!e) return;
            var label = e.title;
            var fname = String(target.name || '').replace(/\.js$/i, '') + ' - ' + label + '.html';
            if (typeof window.npOpenViewer === 'function') {
                window.npOpenViewer({
                    path: '', name: fname, kind: 'file', label: label,
                    html: '<div class="npfDocPage">' + e.parts.join('') + '</div>'
                });
            }
        });
    }

    function deleteArticle(target, seq, title) {
        if (!target || (!target.path && !target.handle) || typeof window.npLibWriteArticle !== 'function') {
            toast('当前模式不支持删除文章');
            return;
        }
        if (!window.confirm('确定删除文章「' + title + '」吗？\n只删除这一篇，同篇笔记的其他文章保留。')) return;
        window.npLibWriteArticle(target, seq, '').then(function () {
            noteCache = Object.create(null);
            state.entries = [];
            state.painted = '';
            toast('已删除文章：' + title);
            return window.npLibRefresh ? window.npLibRefresh() : null;
        }).then(function () {
            var r = state.results[state.sel];
            if (r) selectPath(r.path, true);
        }).catch(function (err) {
            toast('删除失败：' + (err && err.message ? err.message : err));
        });
    }

    function select(idx) {
        var res = state.results[idx];
        if (!res) return;
        state.sel = idx;
        renderArticles(res, res.path);
        var host = $('npPvResTree');
        if (host) {
            var rows = host.querySelectorAll('.npPvItem');
            for (var i = 0; i < rows.length; i++) {
                rows[i].classList.toggle('on', parseInt(rows[i].getAttribute('data-idx'), 10) === idx);
            }
        }
    }

    /* ---------------- 检索 ---------------- */
    function runSearch() {
        var input = $('npPrevSearchInput');
        if (!input) return;
        var raw = input.value;
        state.lastQuery = raw;
        state.groups = parseGroups(raw);
        renderTermBadges([]);
        renderLegend();
        updateHint();
        if (!state.groups.length) {
            state.results = [];
            state.entries = [];
            state.sel = -1;
            state.painted = '';
            renderBrowse(true);
            return;
        }
        var targets = collectTargets();
        if (!targets.length) {
            state.results = [];
            state.browsing = false;
            renderResults();
            var doc2 = $('npPrevDoc');
            if (doc2) doc2.innerHTML = '<div class="npPvEmpty">还没有可检索的笔记。<br>先在左侧选一个文件夹，或打开一篇笔记。</div>';
            return;
        }
        state.browsing = false;
        state.painted = '';
        var seq = ++state.seq;
        var host = $('npPvResTree');
        if (host) {
            host.removeAttribute('data-sig');
            host.innerHTML = '<div class="npPvEmpty">正在检索 ' + targets.length + ' 篇笔记…</div>';
        }
        mapLimit(targets, 4, loadOne).then(function (loaded) {
            if (seq !== state.seq) return;
            analyze(loaded, state.groups, targets);
        });
    }

    function scheduleSearch() {
        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(function () {
            state.timer = null;
            runSearch();
        }, 260);
    }

    /* ---------------- 挂载 ---------------- */
    function bind() {
        if (state.bound) return;
        var input = $('npPrevSearchInput');
        var btn = $('npPrevSearchBtn');
        var host = $('npPvResTree');
        var doc = $('npPrevDoc');
        if (!input || !btn || !host || !doc) return;
        state.bound = true;
        input.setAttribute('placeholder', PH_TEXT);

        doc.addEventListener('click', function (e) {
            var row = e.target.closest ? e.target.closest('.npPvArticle') : null;
            if (!row) return;
            e.preventDefault();
            openArticle(row.getAttribute('data-artpath'), parseInt(row.getAttribute('data-artseq'), 10));
        });

        doc.addEventListener('contextmenu', function (e) {
            var row = e.target.closest ? e.target.closest('.npPvArticle') : null;
            if (!row) return;
            var path = row.getAttribute('data-artpath');
            var seq = parseInt(row.getAttribute('data-artseq'), 10);
            var target = state.pathMap[path];
            if (!target || !(window.npMultiView && typeof window.npMultiView.showAssignMenu === 'function')) return;
            e.preventDefault();
            e.stopPropagation();
            loadOne(target).then(function (rec) {
                var entry = articleEntries(rec)[seq];
                if (!entry) return;
                window.npMultiView.showAssignMenu(e.clientX, e.clientY, {
                    kind: 'article',
                    title: entry.title,
                    name: entry.title,
                    noteTitle: rec && rec.title ? rec.title : nameStem(target.name),
                    html: entry.parts.join(''),
                    onDelete: function () {
                        deleteArticle(target, seq, entry.title);
                    }
                });
            });
        });

        input.addEventListener('input', scheduleSearch);
        input.addEventListener('keydown', function (e) {
            e.stopPropagation();
            if (e.key === 'Enter') {
                e.preventDefault();
                if (state.timer) { clearTimeout(state.timer); state.timer = null; }
                runSearch();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                input.value = '';
                if (state.timer) { clearTimeout(state.timer); state.timer = null; }
                runSearch();
                input.blur();
            }
        });
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            if (state.timer) { clearTimeout(state.timer); state.timer = null; }
            runSearch();
        });

        host.addEventListener('click', function (e) {
            var folder = e.target.closest ? e.target.closest('.npPvFolderRow') : null;
            if (folder) {
                var key = folder.getAttribute('data-folder');
                state.open[key] = state.open[key] === false;
                renderResults();
                return;
            }
            var item = e.target.closest ? e.target.closest('.npPvItem') : null;
            if (item) { select(parseInt(item.getAttribute('data-idx'), 10)); return; }
            var dir = e.target.closest ? e.target.closest('[data-browse-dir]') : null;
            if (dir) { browseToggle(dir.getAttribute('data-browse-dir')); return; }
            var file = e.target.closest ? e.target.closest('[data-browse-file]') : null;
            if (file) selectPath(file.getAttribute('data-browse-file'));
        });
    }

    function mount() {
        bind();
        var q = $('npPrevSearchInput');
        var raw = q ? q.value : '';

        /* 刚打开 / 换了文件夹：清缓存，按当前关键字重来 */
        var root = ((typeof window.npLibRootPath === 'function' ? window.npLibRootPath() : '') || '') + '|' +
            (typeof window.npLibActive === 'function' && window.npLibActive() ? 'lib' : 'mem');
        if (state.root !== undefined && state.root !== root) {
            noteCache = Object.create(null);
            state.results = [];
            state.sel = -1;
            state.painted = '';
            state.browseSel = '';
            state.browsing = false;
            if (q && raw.trim()) {
                state.lastQuery = raw;
                setTimeout(runSearch, 0);
                return;
            }
        }
        state.root = root;

        /* 有关键字 → 结果列表；没关键字 → 默认显示全部笔记（同「数据」栏） */
        if (raw.trim()) {
            if (!state.results.length || state.lastQuery !== raw || !state.entries.length) {
                state.lastQuery = raw;
                runSearch();
            }
            return;
        }
        state.lastQuery = '';
        if (state.groups.length) {
            state.groups = [];
            state.entries = [];
            state.results = [];
            state.sel = -1;
        }
        if (!state.pathMap) state.pathMap = Object.create(null);
        renderBrowse(false);
    }

    function invalidate() {
        noteCache = Object.create(null);
    }

    window.npPrevSearch = {
        mount: mount,
        run: runSearch,
        invalidate: invalidate,
        parseGroups: parseGroups,
        _state: state
    };
})();
