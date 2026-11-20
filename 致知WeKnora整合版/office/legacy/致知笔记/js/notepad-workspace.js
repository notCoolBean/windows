/* ============================================================
   notepad-workspace.js — 文稿三栏工作区
   左：主题列表（序号 + 主题名 + 字数，可拖动排序，颜色随位置）
   中：标题 / 提纲（标题与编辑区光标联动）
   右：编辑区（沿用原笔记主体：工具栏 + 编辑框）
   依赖：store.js 的 npTabCount / npAddNotepadTab / npRemoveNotepadTab / npMoveNotepadTab
   ============================================================ */
(function () {
    var SIDES_KEY = 'wenbaoSidesVisible';
    var VIS_KEY = 'npPaneVisible';
    var RATIO_KEY = 'npPaneRatios';
    var DIRMODE_KEY = 'npDirMode';
    var TIME_KEY = 'npTopicTimes';
    var _dirTimer = null;
    var _mirrorTimer = null;
    var _inputDirKey = '';
    var _inputOutlineKey = '';
    var _pendingDelete = -1;
    var _caretTimer = null;

    // 三栏宽度与显隐状态
    var _vis = { topic: true, dir: true };
var _lastSide = 'topic';
    var _ratios = { topic: 0.2, dir: 0.3 };   // 相对「工作区宽度 - 拖动条」
    var _cur = { topic: 0, dir: 0, total: 0 };
    var MIN_TOPIC = 130;
    var MIN_DIR = 150;
    var MIN_EDITOR = 260;

    // 中栏状态
    var _dirMode = 'titles';   // 'titles' | 'outline'
    var _selArticle = -1;      // 当前选中的文章（_entries 下标）
    var _articleOnly = -1;     // >=0 表示右侧只显示这一篇（隐藏其余段落）
    var _userPickedArticle = false; // 用户手动点过中部标题；为 false 时保持「全文」选中
    var _caretPara = -1;
    var _lockedArticleEl = null;   // 单篇显示锁定的索引/标题段落，编辑后据此重套隐藏
    var _singleGuardTimer = null;
    var _singleGuardApplying = false;

    // 每个主题的创建 / 最近更新时间（与页签同序，存在本地）
    var _times = [];

    function $(id) { return document.getElementById(id); }

    function tabCount() {
        return (typeof window.npTabCount === 'function') ? window.npTabCount() : (notepadTitles.length || 5);
    }

    function plainText(html) {
        var s = String(html == null ? '' : html).replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ');
        return s.replace(/[\s\u3000\u00a0\u200b\ufeff]/g, '');
    }

    function topicName(i) {
        var t = (notepadTitles[i] || '').replace(/^\s+|\s+$/g, '');
        if (!t || t === '…') return '未命名';
        return t;
    }

    function pad2(n) { return n < 10 ? ('0' + n) : String(n); }

    /* ---------------- 主题的创建 / 更新时间 ---------------- */
    function loadTimes() {
        var arr = [];
        try { arr = JSON.parse(localStorage.getItem(TIME_KEY) || '[]') || []; } catch (e) { arr = []; }
        if (!Array.isArray(arr)) arr = [];
        _times = arr.map(function (t) {
            var c = t && parseInt(t.c, 10); var u = t && parseInt(t.u, 10);
            if (!isFinite(c) || c <= 0) c = Date.now();
            if (!isFinite(u) || u <= 0) u = c;
            return { c: c, u: u };
        });
        ensureTimes(tabCount());
    }

    function ensureTimes(n) {
        while (_times.length < n) _times.push({ c: Date.now(), u: Date.now() });
        if (_times.length > n) _times.length = n;
    }

    function saveTimes() {
        try { localStorage.setItem(TIME_KEY, JSON.stringify(_times)); } catch (e) {}
    }

    function touchTime(i) {
        if (!(i >= 0) || i >= _times.length) return;
        _times[i].u = Date.now();
        saveTimes();
    }

    // 20260506
    function ymd(ms) {
        if (!isFinite(ms) || ms <= 0) return '';
        var d = new Date(ms);
        return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
    }

    /* ---------------- 左栏：主题列表 ---------------- */
    // 单个主题内的文章数 / 字数（当前篇读编辑区实时内容，其余读缓存）
    function topicStats(i) {
        var html = '';
        if (i === currentNotepadTab) {
            var ed = $('notepadEditor');
            html = ed ? ed.innerHTML : ((notepadEditorData[i] || {}).html || '');
        } else {
            html = (notepadEditorData[i] || {}).html || '';
        }
        var words = plainText(html).length;
        var articles = 0;
        if (words) {
            var tmp = document.createElement('div');
            tmp.innerHTML = html;
            articles = articleEntryList(Array.prototype.slice.call(tmp.querySelectorAll('p'))).length;
            if (!articles) articles = 1;
        }
        return { words: words, articles: articles };
    }

    function renderTopicList() {
        if (typeof window.npLibActive === 'function' && window.npLibActive() &&
            typeof window.npLibRender === 'function') {
            window.npLibRender();
            return;
        }
        var box = $('npTopicList');
        if (!box) return;
        var n = tabCount();
        ensureTimes(n);
        var frag = document.createDocumentFragment();
        for (var i = 0; i < n; i++) {
            var item = document.createElement('div');
            item.className = 'npTopicItem tp' + (i % 5) + (i === currentNotepadTab ? ' active' : '') +
                (_pendingDelete === i ? ' confirming' : '');
            item.setAttribute('data-tab-index', String(i));
            /* 原生悬停提示 = 主题全名（取代原来的「右键：…」） */
            item.setAttribute('title', topicName(i));

            var num = document.createElement('span');
            num.className = 'npTopicNum';
            num.textContent = pad2(i + 1);

            var main = document.createElement('div');
            main.className = 'npTopicMain';

            var name = document.createElement('div');
            name.className = 'npTopicName';
            name.textContent = topicName(i);

            var detail = document.createElement('div');
            detail.className = 'npTopicDetail';
            var time = document.createElement('span');
            time.className = 'npTopicTime';
            var t = _times[i] || { c: 0, u: 0 };
            time.textContent = ymd(t.c) + ' 创建　' + ymd(t.u) + ' 更新';
            detail.appendChild(time);

            main.appendChild(name);
            main.appendChild(detail);
            item.appendChild(num);
            item.appendChild(main);
            frag.appendChild(item);
        }
        box.innerHTML = '';
        box.appendChild(frag);

        // 名称未截断时，悬停不再重复显示同一行
        var items = box.querySelectorAll('.npTopicItem');
        for (var j = 0; j < items.length; j++) {
            var nm = items[j].querySelector('.npTopicName');
            if (nm && nm.scrollWidth > nm.clientWidth + 1) items[j].classList.add('npNameClipped');
        }

        var meta = $('npTopicTotal');
        if (meta) {
            var st = topicStats(currentNotepadTab);
            meta.textContent = '共 ' + st.articles + ' 篇 · ' + st.words + ' 字';
        }
    }

    function onTopicListClick(e) {
        if (_suppressClick) { _suppressClick = false; return; }
        var item = e.target.closest('.npTopicItem');
        if (!item) return;
        var idx = parseInt(item.getAttribute('data-tab-index'), 10);
        if (!isFinite(idx) || idx === currentNotepadTab) return;
        if (typeof switchNotepadTab === 'function') switchNotepadTab(idx);
    }

    function onTopicListDblClick(e) {
        var item = e.target.closest('.npTopicItem');
        if (!item) return;
        var idx = parseInt(item.getAttribute('data-tab-index'), 10);
        if (!isFinite(idx)) return;
        if (idx !== currentNotepadTab && typeof switchNotepadTab === 'function') switchNotepadTab(idx);
        if (typeof showNotepadRename === 'function') showNotepadRename();
    }

    /* ---------------- 主题右键菜单：重命名 / 删除 / 复制 ---------------- */
    var _ctxEl = null;
    var _ctxIdx = -1;

    function closeTopicCtx() {
        if (_ctxEl) { _ctxEl.remove(); _ctxEl = null; }
        _ctxIdx = -1;
        _pendingDelete = -1;
    }

    function openTopicCtx(idx, x, y) {
        closeTopicCtx();
        _ctxIdx = idx;
        var el = document.createElement('div');
        el.className = 'npTopicCtx';
        el.innerHTML =
            '<div class="npTopicCtxItem" data-act="rename">重命名</div>' +
            '<div class="npTopicCtxItem" data-act="clone">复制此笔记</div>' +
            '<div class="npTopicCtxItem npDanger" data-act="delete">删除此笔记</div>';
        document.body.appendChild(el);
        var w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, x)) + 'px';
        el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, y)) + 'px';
        _ctxEl = el;

        el.addEventListener('click', function (ev) {
            var it = ev.target.closest('.npTopicCtxItem');
            if (!it) return;
            var act = it.getAttribute('data-act');
            var i = _ctxIdx;
            if (act === 'rename') {
                closeTopicCtx();
                if (typeof showNotepadRename === 'function') showNotepadRename();
                return;
            }
            if (act === 'clone') {
                closeTopicCtx();
                if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
                if (typeof window.npCloneNotepadTab === 'function') {
                    var ni = window.npCloneNotepadTab(i);
                    ensureTimes(ni + 1);
                    _times[ni] = { c: Date.now(), u: Date.now() };
                    saveTimes();
                    if (typeof switchNotepadTab === 'function') switchNotepadTab(ni);
                    if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
                    if (typeof showToast === 'function') showToast('已复制为第 ' + (ni + 1) + ' 个主题');
                }
                return;
            }
            if (act === 'delete') {
                if (it.getAttribute('data-confirm') !== '1') {
                    it.setAttribute('data-confirm', '1');
                    it.textContent = '确认删除（再点一次）';
                    setTimeout(function () {
                        if (it && it.isConnected && it.getAttribute('data-confirm') === '1') {
                            it.removeAttribute('data-confirm');
                            it.textContent = '删除此笔记';
                        }
                    }, 4000);
                    return;
                }
                closeTopicCtx();
                if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
                window.npRemoveNotepadTab(i);
                if (_times.length > i) { _times.splice(i, 1); saveTimes(); }
                if (typeof switchNotepadTab === 'function') switchNotepadTab(Math.min(i, tabCount() - 1));
                if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
                if (typeof showToast === 'function') showToast('已删除该主题');
            }
        });
    }

    function onTopicContextMenu(e) {
        var item = e.target.closest('.npTopicItem');
        if (!item) return;
        e.preventDefault();
        var idx = parseInt(item.getAttribute('data-tab-index'), 10);
        if (!isFinite(idx)) return;
        if (idx !== currentNotepadTab && typeof switchNotepadTab === 'function') switchNotepadTab(idx);
        openTopicCtx(idx, e.clientX, e.clientY);
    }

    /* ---------------- 拖动调整主题顺序（颜色随位置） ---------------- */
    var _order = null;
    var _suppressClick = false;

    function clearDropMarks() {
        var marks = document.querySelectorAll('.npTopicItem.npDropBefore, .npTopicItem.npDropAfter');
        for (var i = 0; i < marks.length; i++) {
            marks[i].classList.remove('npDropBefore', 'npDropAfter');
        }
    }

    function insertIndexAt(clientY) {
        var items = document.querySelectorAll('#npTopicList .npTopicItem');
        for (var i = 0; i < items.length; i++) {
            var r = items[i].getBoundingClientRect();
            if (clientY < r.top + r.height / 2) return i;
        }
        return items.length;
    }

    function startOrder(e) {
        if (e.button !== 0) return;
        var item = e.target.closest('.npTopicItem');
        if (!item) return;
        var idx = parseInt(item.getAttribute('data-tab-index'), 10);
        if (!isFinite(idx)) return;
        _order = { x: e.clientX, y: e.clientY, idx: idx, item: item, moved: false };
    }

    function moveOrder(e) {
        if (!_order || !_order.item) return;
        if (!_order.moved) {
            if (Math.abs(e.clientX - _order.x) < 5 && Math.abs(e.clientY - _order.y) < 5) return;
            _order.moved = true;
            _order.item.classList.add('npDragging');
            document.body.classList.add('npOrdering');
        }
        clearDropMarks();
        var items = document.querySelectorAll('#npTopicList .npTopicItem');
        var ins = insertIndexAt(e.clientY);
        if (ins > 0 && items[ins - 1] && items[ins - 1] !== _order.item) {
            items[ins - 1].classList.add('npDropAfter');
        } else if (ins < items.length && items[ins] && items[ins] !== _order.item) {
            items[ins].classList.add('npDropBefore');
        }
        e.preventDefault();
    }

    function endOrder() {
        if (!_order) return;
        var moved = _order.moved;
        var from = _order.idx;
        var item = _order.item;
        _order = null;
        document.body.classList.remove('npOrdering');

        var rows = document.querySelectorAll('#npTopicList .npTopicItem');
        var to = -1;
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].classList.contains('npDropAfter')) { to = i + 1; break; }
            if (rows[i].classList.contains('npDropBefore')) { to = i; break; }
        }
        clearDropMarks();
        if (item) item.classList.remove('npDragging');
        if (moved) {
            _suppressClick = true;
            setTimeout(function () { _suppressClick = false; }, 400);
        }
        if (!moved || to < 0) return;
        if (to > from) to -= 1;
        if (to === from) return;
        if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
        if (typeof window.npMoveNotepadTab !== 'function') return;
        var newIdx = window.npMoveNotepadTab(from, to);
        ensureTimes(tabCount());
        if (_times.length > from) {
            var moved = _times.splice(from, 1)[0];
            _times.splice(Math.min(newIdx, _times.length), 0, moved);
            saveTimes();
        }
        if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
        if (typeof showToast === 'function') showToast('已调整到第 ' + (newIdx + 1) + ' 位');
        if (typeof switchNotepadTab === 'function') switchNotepadTab(newIdx);
        else refreshAll();
    }

    function addTopic() {
        if (typeof window.npLibActive === 'function' && window.npLibActive()) {
            if (typeof window.npLibAddMenu === 'function') window.npLibAddMenu($('npTopicAddBtn'));
            return;
        }
        if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
        var idx = window.npAddNotepadTab();
        ensureTimes(idx + 1);
        _times[idx] = { c: Date.now(), u: Date.now() };
        saveTimes();
        if (_dirMode === 'outline') _selArticle = 0;
        if (typeof switchNotepadTab === 'function') switchNotepadTab(idx);
        if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
        if (typeof showToast === 'function') showToast('已新增第 ' + (idx + 1) + ' 个主题');
        var box = $('npTopicList');
        var last = box && box.lastElementChild;
        if (last && last.scrollIntoView) last.scrollIntoView({ block: 'nearest' });
        if (typeof showNotepadRename === 'function') setTimeout(showNotepadRename, 60);
    }

    /* ---------------- 中栏：标题 / 提纲 ---------------- */
    function editorParagraphs() {
        var ed = $('notepadEditor');
        if (!ed) return [];
        return Array.prototype.slice.call(ed.querySelectorAll('p'));
    }

    function directoryLabel(txt) {
        txt = (txt || '').replace(/^\s+|\s+$/g, '');
        var m = txt.match(/^【[^】]+】\s*/);
        return m ? (txt.substring(m[0].length).trim() || txt) : txt;
    }

    function isArticleTitlePara(p) {
        if (!p) return false;
        if (typeof window._npIsArticleTitlePara === 'function') {
            try { return !!window._npIsArticleTitlePara(p); } catch (e) {}
        }
        if (p.getAttribute('data-outline-level') === '1') return true;
        return p.getAttribute('data-level') === 'title';
    }

    /* 两个索引标题之间只有空白 / 标题 / 日期 / 作者，没有正文：视为重复插入的索引 */
    function indexRunOnlyBetween(ps, fromExclusive, toExclusive) {
        for (var i = fromExclusive + 1; i < toExclusive; i++) {
            var p = ps[i];
            var txt = String(p && p.textContent || '').replace(/^\s+|\s+$/g, '');
            if (!txt) continue;
            var lv = p.getAttribute('data-level') || '';
            if (p.getAttribute('data-outline-level') === '1') continue;
            if (lv === 'title' || lv === 'date' || lv === 'author') continue;
            return false;
        }
        return true;
    }

    // 扫描文章标题（只有索引标题才算一篇；普通「文章标题」段落只是标题）
    function scanArticles(ps) {
        var out = [];
        for (var i = 0; i < ps.length; i++) {
            var p = ps[i];
            var txt = (p.textContent || '').replace(/^\s+|\s+$/g, '');
            if (!txt) continue;
            if (p.getAttribute('data-outline-level') !== '1') continue;
            /* 索引插入时标题段落会同时带 data-outline-level 和 data-level="title"，
               两段文字相同，合并标题只算一篇，跳过紧随其后的重复标题段 */
            var prev = out.length ? out[out.length - 1] : null;
            if (prev && p.getAttribute('data-level') === 'title') {
                var inner = String(p.textContent || '').replace(/^\s+|\s+$/g, '');
                if (prev.label && prev.label.indexOf(inner) >= 0 && i - prev.idx <= 2) continue;
            }
            /* 同一篇被重复写了两行索引（中间没有正文）时只留第一行，避免标题列表重复 3 次 */
            if (prev && prev.pendingDup && indexRunOnlyBetween(ps, prev.idx, i)) { continue; }
            if (prev) prev.pendingDup = false;
            var _label = directoryLabel(txt);
            out.push({ idx: i, el: p, label: _label, pendingDup: true });
        }
        return out;
    }

    /* 判断某一段之后是否还跟着「文章标题」——新建索引时要拆分的标志 */
    function nextParaIsArticleTitle(ps, from) {
        for (var i = from + 1; i < ps.length; i++) {
            var txt = (ps[i].textContent || '').replace(/^\s+|\s+$/g, '');
            if (!txt) continue;
            return isArticleTitlePara(ps[i]);
        }
        return false;
    }

    /* 标题列表 / 单篇定位共用：只认索引标题（普通文章标题段落只属于当前篇） */
    function articleEntryList(ps) {
        return scanArticles(ps);
    }

    function articleSnapshot(seq) {
        var ps = editorParagraphs();
        var entries = articleEntryList(ps);
        var e = entries[seq];
        if (!e) return null;
        var start = e.idx;
        var end = (seq + 1 < entries.length) ? entries[seq + 1].idx : ps.length;
        var box = document.createElement('div');
        for (var i = start; i < end; i++) {
            var c = ps[i].cloneNode(true);
            /* 单篇视图会给非当前篇的段落写 display:none / data-dir-hidden，
               快照必须去掉，否则关联到小窗后是空白。 */
            c.style.display = '';
            c.removeAttribute('data-dir-hidden');
            c.removeAttribute('data-collapsed');
            box.appendChild(c);
        }
        var html = box.innerHTML;
        var noteTitle = '';
        try { noteTitle = (typeof notepadTitles !== 'undefined' && notepadTitles[currentNotepadTab]) || ''; } catch (err) {}
        return { kind: 'article', title: e.label, noteTitle: noteTitle, html: html, name: e.label, seq: seq };
    }

    function caretPara() {
        var ed = $('notepadEditor');
        if (!ed) return null;
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        var node = sel.anchorNode;
        if (!node || !ed.contains(node)) return null;
        var el = node.nodeType === 3 ? node.parentNode : node;
        while (el && el !== ed && el.tagName !== 'P' && el.tagName !== 'DIV') el = el.parentNode;
        return (el && el !== ed) ? el : null;
    }

    function caretParagraphIndex() {
        var ed = $('notepadEditor');
        if (!ed) return -1;
        var sel = window.getSelection();
        if (!sel || !sel.rangeCount) return -1;
        var node = sel.anchorNode;
        if (!node || !ed.contains(node)) return -1;
        var el = node.nodeType === 3 ? node.parentNode : node;
        while (el && el !== ed && el.tagName !== 'P') el = el.parentNode;
        if (!el || el === ed || el.tagName !== 'P') return -1;
        var ps = editorParagraphs();
        for (var i = 0; i < ps.length; i++) if (ps[i] === el) return i;
        return -1;
    }

    // 光标落在哪篇文章里（返回文章在 entries 中的下标）
    function articleIndexAt(entries, paraIdx) {
        if (!entries.length || paraIdx < 0) return -1;
        var hit = -1;
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].idx <= paraIdx) hit = i;
            else break;
        }
        return hit;
    }

    /* 切到「标题 / 提纲」页时，按光标所在文章同步选中态；
       用户还没有手动点过标题时也要能看出当前正在编辑哪一篇。 */
    function selectArticleForPage() {
        var entries = articleEntryList(editorParagraphs());
        if (!entries.length) { _selArticle = -1; return; }
        if (_articleOnly >= 0) {
            _selArticle = Math.min(_articleOnly, entries.length - 1);
            _userPickedArticle = true;
            return;
        }
        var at = articleIndexAt(entries, caretParagraphIndex());
        if (at >= 0) {
            _selArticle = at;
            _userPickedArticle = true;
        } else if (_selArticle < 0 || _selArticle >= entries.length) {
            _selArticle = 0;
        }
    }

    function renderDirToggle() {
        var tabs = document.querySelectorAll('#npDirTabs .npDirTab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle('active', tabs[i].getAttribute('data-dirmode') === _dirMode);
        }
    }

    /* 提纲页底部工具条：刷新 / 字数。固定在栏目最下方（不跟列表一起滚动）。 */
    var OUTLINE_COUNT_KEY = 'npOutlineShowCount';
    var _outlineShowCount = false;
    try { _outlineShowCount = localStorage.getItem(OUTLINE_COUNT_KEY) === '1'; } catch (e0) {}

    function removeDirOutlineFoot() {
        var old = document.getElementById('npDirOutlineFoot');
        if (old && old.parentNode) old.parentNode.removeChild(old);
    }

    /* 统计范围文字的字数（中文按字计，去掉空白与零宽字符） */
    function npCharCount(text) {
        return String(text == null ? '' : text).replace(/[\s\u3000\u00a0\u200b\ufeff]/g, '').length;
    }

    function renderDirRefreshBtn() {
        removeDirOutlineFoot();
        if (_dirMode !== 'outline') return;
        var pane = $('npDirPane');
        if (!pane) return;
        var wrap = document.createElement('div');
        wrap.className = 'npDirOutlineFoot';
        wrap.id = 'npDirOutlineFoot';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'npPaneBtn npDirRefreshNow';
        btn.id = 'npDirRefreshNow';
        btn.title = '按编辑区当前内容重新读取提纲';
        btn.textContent = '刷新';
        btn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            _inputOutlineKey = '';
            renderDirList();
            showToast('提纲已刷新');
        });
        wrap.appendChild(btn);

        var countBtn = document.createElement('button');
        countBtn.type = 'button';
        countBtn.className = 'npPaneBtn npDirCountBtn' + (_outlineShowCount ? ' active' : '');
        countBtn.id = 'npDirCountBtn';
        countBtn.title = _outlineShowCount ? '隐藏字数' : '显示字数';
        countBtn.textContent = '字数';
        countBtn.setAttribute('aria-pressed', _outlineShowCount ? 'true' : 'false');
        countBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            _outlineShowCount = !_outlineShowCount;
            try { localStorage.setItem(OUTLINE_COUNT_KEY, _outlineShowCount ? '1' : '0'); } catch (e) {}
            _inputOutlineKey = '';
            renderDirList();
        });
        wrap.appendChild(countBtn);

        pane.appendChild(wrap);
    }

    function renderDirEmpty(text, cls) {
        var box = $('npDirList');
        if (!box) return;
        var empty = document.createElement('div');
        empty.className = 'npDirEmpty' + (cls ? ' ' + cls : '');
        empty.textContent = text;
        box.appendChild(empty);
    }

    /* 「显示全部笔记」行右侧的工具按钮绑定（每次渲染都会重建，故幂等绑定） */
    function bindDirAllTools() {
        var asc = $('npDirSortAsc');
        if (asc && !asc._npBound) {
            asc._npBound = true;
            asc.addEventListener('click', function (ev) {
                ev.stopPropagation();
                pickWithGuard(function () {
                    if (typeof window.sortNotepadArticlesByDate === 'function') window.sortNotepadArticlesByDate(false);
                    renderDirList();
                });
            });
        }
        var desc = $('npDirSortDesc');
        if (desc && !desc._npBound) {
            desc._npBound = true;
            desc.addEventListener('click', function (ev) {
                ev.stopPropagation();
                pickWithGuard(function () {
                    if (typeof window.sortNotepadArticlesByDate === 'function') window.sortNotepadArticlesByDate(true);
                    renderDirList();
                });
            });
        }
        var rf = $('npDirRefreshBtn');
        if (rf && !rf._npBound) {
            rf._npBound = true;
            rf.addEventListener('click', function (ev) {
                ev.stopPropagation();
                if (typeof window.saveCurrentEditor === 'function') window.saveCurrentEditor();
                renderDirList();
                if (typeof renderTopicList === 'function') renderTopicList();
            });
        }
    }

    function renderTitleList(entries, hasContent) {
        var box = $('npDirList');
        if (!entries.length) {
            renderDirEmpty(hasContent ? '尚未添加索引标题' : '此笔记尚无内容', hasContent ? 'unnamed' : '');
            return;
        }
        if (entries.length > 1 || _articleOnly >= 0) {
            var allRow = document.createElement('div');
            allRow.className = 'npDirItem npDirAll' + (_articleOnly < 0 && _selArticle < 0 ? ' selected' : '');
            allRow.setAttribute('data-article-index', '-1');
            allRow.title = '显示整篇笔记（全部内容）';
            var allLabel = document.createElement('span');
            allLabel.className = 'npDirLabel';
            allLabel.textContent = '显示全部笔记';
            allRow.appendChild(allLabel);

            /* 「显示全部笔记」这一行右侧：顺序 / 逆序 / 刷新（整体右对齐） */
            var tools = document.createElement('div');
            tools.className = 'npDirAllTools';
            tools.innerHTML =
                '<button type="button" class="npPaneBtn npDirSort" id="npDirSortAsc" title="按日期正序排列">顺序</button>' +
                '<button type="button" class="npPaneBtn npDirSort" id="npDirSortDesc" title="按日期逆序排列">逆序</button>' +
                '<button type="button" class="npPaneBtn npPaneBtnIcon npDirRefresh" id="npDirRefreshBtn" title="按当前内容刷新">⟳</button>';
            allRow.appendChild(tools);
            tools.addEventListener('click', function (ev) { ev.stopPropagation(); });

            allRow.addEventListener('click', function (ev) {
                if (ev.target.closest('.npDirAllTools')) return;
                pickWithGuard(function () { showWholeDocument(); });
            });
            box.appendChild(allRow);
            bindDirAllTools();
        }
        for (var i = 0; i < entries.length; i++) {
            (function (entry, seq) {
                var row = document.createElement('div');
                row.className = 'npDirItem' + (i === _selArticle ? ' selected' : '');
                row.setAttribute('data-article-index', String(seq - 1));
                row.setAttribute('data-article-seq', String(seq - 1));
                row.setAttribute('draggable', 'true');

                var num = document.createElement('span');
                num.className = 'npDirNum';
                num.textContent = String(seq);

                var label = document.createElement('span');
                label.className = 'npDirLabel';
                label.textContent = entry.label;

                row.appendChild(num);
                row.appendChild(label);
                row.addEventListener('click', function () {
                    pickWithGuard(function () {
                        _selArticle = seq - 1;
                        selectArticle(entry, row, box);
                    });
                });
                row.addEventListener('contextmenu', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    openDirRowCtx(ev, entry, seq - 1);
                });
                row.addEventListener('dragstart', function (ev) {
                    _dirDrag = { from: seq - 1, row: row };
                    row.classList.add('npDragging');
                    try {
                        ev.dataTransfer.effectAllowed = 'move';
                        ev.dataTransfer.setData('text/plain', String(seq - 1));
                    } catch (e2) {}
                });
                row.addEventListener('dragend', function () {
                    row.classList.remove('npDragging');
                    clearDirDropMarks();
                    _dirDrag = null;
                });
                row.addEventListener('dragover', function (ev) {
                    if (!_dirDrag) return;
                    ev.preventDefault();
                    try { ev.dataTransfer.dropEffect = 'move'; } catch (e2) {}
                    clearDirDropMarks();
                    var r = row.getBoundingClientRect();
                    if (ev.clientY < r.top + r.height / 2) row.classList.add('npDropBefore');
                    else row.classList.add('npDropAfter');
                });
                row.addEventListener('drop', function (ev) {
                    if (!_dirDrag) return;
                    ev.preventDefault();
                    ev.stopPropagation();
                    var from = _dirDrag.from;
                    var to = seq - 1;
                    var r = row.getBoundingClientRect();
                    if (ev.clientY >= r.top + r.height / 2) to = to + 1;
                    clearDirDropMarks();
                    row.classList.remove('npDragging');
                    var drag = _dirDrag; _dirDrag = null;
                    if (drag && drag.row) drag.row.classList.remove('npDragging');
                    if (from === to || from === to - 1) { renderDirList(); return; }
                    pickWithGuard(function () {
                        var target = to > from ? to - 1 : to;
                        if (typeof window.moveArticleToIndex === 'function' && window.moveArticleToIndex(from, target)) {
                            showToast('已调整文章顺序');
                        }
                        renderDirList();
                    });
                });
                box.appendChild(row);
            })(entries[i], i + 1);
        }
    }

    /* 提纲条目的右键菜单：修改 / 剪切 / 上移 / 下移（沿用旧版 .paContextMenu 外观） */
    function closeOutlineItemCtx() {
        var old = document.getElementById('npOutlineItemCtx');
        if (old) old.parentNode.removeChild(old);
    }

    function openOutlineItemCtx(ev, it) {
        closeOutlineItemCtx();
        var menu = document.createElement('div');
        menu.id = 'npOutlineItemCtx';
        menu.className = 'paContextMenu';
        menu.innerHTML =
            '<div class="paCtxItem" data-npo-action="edit">修改</div>' +
            '<div class="paCtxItem" data-npo-action="cut">剪切</div>' +
            '<div class="paCtxItem" data-npo-action="up">上移</div>' +
            '<div class="paCtxItem" data-npo-action="down">下移</div>';
        document.body.appendChild(menu);

        var item = { text: it.text, element: it.el, level: it.level };
        var after = function () {
            if (typeof window.saveCurrentEditor === 'function') window.saveCurrentEditor();
            renderDirList();
        };

        menu.addEventListener('click', function (e2) {
            var el = e2.target.closest('[data-npo-action]');
            if (!el) return;
            var act = el.getAttribute('data-npo-action');
            closeOutlineItemCtx();
            if (act === 'cut') {
                if (typeof window._materialOutlineCutItem === 'function') window._materialOutlineCutItem(item);
                after();
            } else if (act === 'up') {
                if (typeof window._materialOutlineMove === 'function') window._materialOutlineMove(item, -1);
                after();
            } else if (act === 'down') {
                if (typeof window._materialOutlineMove === 'function') window._materialOutlineMove(item, 1);
                after();
            } else if (act === 'edit') {
                editOutlineItemText(item, after);
            }
        });

        var mw = menu.offsetWidth, mh = menu.offsetHeight;
        var x = ev.clientX, y = ev.clientY;
        if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
        if (y + mh > window.innerHeight - 8) y = window.innerHeight - mh - 8;
        menu.style.left = Math.max(4, x) + 'px';
        menu.style.top = Math.max(4, y) + 'px';
        menu.classList.add('show');

        setTimeout(function () {
            document.addEventListener('click', function close(e3) {
                if (e3.target.closest && e3.target.closest('#npOutlineItemCtx')) return;
                document.removeEventListener('click', close);
                closeOutlineItemCtx();
            });
        }, 0);
    }

    /* 修改提纲条目的文字：小型输入弹窗，确定后写回段落并刷新 */
    function editOutlineItemText(item, done) {
        if (!item || !item.element) return;
        var dlg = document.getElementById('npOutlineEditDlg');
        if (dlg) dlg.parentNode.removeChild(dlg);
        dlg = document.createElement('div');
        dlg.id = 'npOutlineEditDlg';
        dlg.className = 'npOutlineEditDlg';
        dlg.innerHTML =
            '<div class="npOutlineEditTitle">修改提纲</div>' +
            '<input type="text" class="npOutlineEditInput" id="npOutlineEditInput" />' +
            '<div class="npOutlineEditOps">' +
            '<button type="button" class="npOutlineEditBtn ghost" id="npOutlineEditCancel">取消</button>' +
            '<button type="button" class="npOutlineEditBtn ok" id="npOutlineEditOk">确定</button>' +
            '</div>';
        document.body.appendChild(dlg);
        dlg.style.left = Math.max(4, Math.round((window.innerWidth - 360) / 2)) + 'px';
        dlg.style.top = Math.max(4, Math.round((window.innerHeight - 170) / 2)) + 'px';

        var input = dlg.querySelector('#npOutlineEditInput');
        input.value = item.text || '';
        var close = function () {
            if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
        };
        dlg.querySelector('#npOutlineEditCancel').addEventListener('click', close);
        dlg.querySelector('#npOutlineEditOk').addEventListener('click', function () {
            var val = String(input.value || '').replace(/^\s+|\s+$/g, '');
            var old = item.text || '';
            if (val && val !== old && typeof window._materialOutlineReplaceText === 'function') {
                if (window._materialOutlineReplaceText(item.element, old, val) && done) done();
            }
            close();
        });
        input.addEventListener('keydown', function (e2) {
            if (e2.key === 'Enter') { e2.preventDefault(); dlg.querySelector('#npOutlineEditOk').click(); }
            else if (e2.key === 'Escape') close();
        });
        setTimeout(function () { input.focus(); input.select(); }, 0);
    }

    /* 中部标题栏：拖动排序状态 + 拖动标记 */
    var _dirDrag = null;
    function clearDirDropMarks() {
        var marks = document.querySelectorAll('#npDirList .npDirItem.npDropBefore, #npDirList .npDirItem.npDropAfter');
        for (var i = 0; i < marks.length; i++) marks[i].classList.remove('npDropBefore', 'npDropAfter');
    }

    /* 中部标题栏：右键菜单（新建/删除/日期顺序/日期逆序） */
    /* 把光标放到指定段落，供「上移/下移/增加一篇」这类依赖光标的操作定位 */
    function focusArticlePara(p) {
        if (!p) return;
        try {
            var r = document.createRange();
            r.selectNodeContents(p);
            r.collapse(true);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
            window._notepadCtxRange = r;
            window._npCtxArticlePara = p;
        } catch (e) { }
    }
    /* 在指定文章之后插入一篇（模板与老版记事本 insertNotepadArticle 一致） */
    function insertArticleAfter(entry, index) {
        var ed = $('notepadEditor');
        if (!ed) return;
        var ps = Array.prototype.slice.call(ed.querySelectorAll('p'));
        var entries = scanArticles(ps);
        if (typeof index === 'number' && index >= 0 && entries[index]) {
            entry = entries[index];
        }
        if (!entry || !entry.el) return;
        var pos = ps.indexOf(entry.el);
        if (pos < 0) return;
        var at = -1;
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].el === entry.el) { at = i; break; }
        }
        var end = ps.length;
        if (at >= 0 && at + 1 < entries.length) {
            end = entries[at + 1].idx;
        } else if (at < 0) {
            for (var j = pos + 1; j < ps.length; j++) {
                if (ps[j].getAttribute('data-outline-level') === '1') {
                    end = j;
                    break;
                }
            }
        }
        var now = new Date();
        var y = now.getFullYear();
        var m = String(now.getMonth() + 1).padStart(2, '0');
        var d = String(now.getDate()).padStart(2, '0');
        var dateStr = y + m + d;
        var dateCn = '（' + y + '年' + parseInt(m, 10) + '月' + parseInt(d, 10) + '日）';
        var insertHtml = '<p data-outline-level="1" style="margin:0 0 0.5em;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:left;text-indent:0;color:#1a2a4a;">' + dateStr + ' 标题</p>' +
            '<p data-level="title" style="margin:0;line-height:1.8;font-family:方正小标宋,FZXiaoBiaoSong,serif;font-size:20px;text-align:center;text-indent:0;">标题</p>' +
            '<p data-level="date" style="margin:0;line-height:1.8;font-family:楷体_GB2312,楷体,KaiTi,serif;font-size:16px;text-align:center;text-indent:0;">' + dateCn + '</p>' +
            '<p style="margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:2em;">&nbsp;</p>' +
            '<p style="margin:0;line-height:1.8;font-family:仿宋_GB2312,仿宋,serif;font-size:16px;text-align:left;text-indent:2em;">×××。</p>';
        var anchor = ps[end - 1];
        if (anchor) anchor.insertAdjacentHTML('afterend', insertHtml);
        else ed.insertAdjacentHTML('beforeend', insertHtml);
        if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
        if (typeof window.updateFooterTimestamp === 'function') window.updateFooterTimestamp();
        showToast('已在本篇之后增加一篇');
        return at >= 0 ? at + 1 : -1;
    }

    /* 新建一篇后直接选中它（不留在「显示全部笔记」） */
    function selectArticleByIndex(seq) {
        var ed = $('notepadEditor');
        var box = $('npDirList');
        if (!ed || !box || seq < 0) return false;
        var entries = articleEntryList(Array.prototype.slice.call(ed.querySelectorAll('p')));
        var entry = entries[seq];
        if (!entry) return false;
        _selArticle = seq;
        _userPickedArticle = true;
        renderDirList();
        _selArticle = seq;
        var row = box.querySelector('.npDirItem[data-article-seq="' + seq + '"]');
        selectArticle(entry, row, box);
        return true;
    }

    /* ---------------- 索引标题：右键按下方文章标题更新 ---------------- */

    function collectArticleTitleTexts(indexEl) {
        var out = [];
        var p = indexEl ? indexEl.nextElementSibling : null;
        var started = false;
        while (p) {
            if (p.tagName === 'P') {
                if (p.getAttribute('data-outline-level') === '1') break;
                var txt = String(p.textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
                if (txt) {
                    var isTitle = p.getAttribute('data-level') === 'title';
                    if (!isTitle && typeof window._npIsArticleTitlePara === 'function') {
                        try { isTitle = !!window._npIsArticleTitlePara(p); } catch (e) {}
                    }
                    if (isTitle) {
                        started = true;
                        out.push(txt);
                    } else if (started) {
                        break;
                    }
                }
            }
            p = p.nextElementSibling;
        }
        return out;
    }

    function splitIndexPrefix(raw) {
        var s = String(raw == null ? '' : raw).replace(/\u00a0/g, ' ').replace(/^\s+|\s+$/g, '');
        var prefix = '';
        var m = s.match(/^【[^】]{1,40}】\s*/);
        if (m) { prefix += m[0]; s = s.slice(m[0].length); }
        m = s.match(/^(?:\d{8}|\d{6}|\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*[日号])?|\d{1,2}\s*月(?:\s*\d{1,2}\s*[日号])?|\d{4}[-./]\d{1,2}[-./]\d{1,2})\s*/);
        if (m) { prefix += m[0]; s = s.slice(m[0].length); }
        return { prefix: prefix, rest: s };
    }

    function updateIndexTitle(indexEl) {
        if (!indexEl || !indexEl.parentNode) return false;
        var titles = collectArticleTitleTexts(indexEl);
        if (!titles.length) {
            showToast('索引下方没有找到文章标题');
            return false;
        }
        var merged = titles.join(' ').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
        if (!merged) {
            showToast('索引下方没有找到文章标题');
            return false;
        }
        var oldText = String(indexEl.textContent || '').replace(/\u00a0/g, ' ').replace(/^\s+|\s+$/g, '');
        var parts = splitIndexPrefix(oldText);
        var nextText = parts.prefix + merged;
        if (nextText === oldText) {
            showToast('索引标题已是最新');
            return true;
        }
        indexEl.textContent = nextText;
        if (typeof window.saveCurrentEditor === 'function') {
            try { window.saveCurrentEditor(); } catch (e) {}
        }
        var ed = $('notepadEditor');
        if (ed) {
            try { ed.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) {}
        }
        if (_articleOnly >= 0 && _lockedArticleEl === indexEl && typeof window._notepadDirShowOnlyArticle === 'function') {
            try { window._notepadDirShowOnlyArticle(indexEl); } catch (e3) {}
        }
        renderDirList();
        showToast('索引标题已更新');
        return true;
    }

    window.npUpdateIndexTitle = updateIndexTitle;

    function openDirRowCtx(ev, entry, index) {
        closeDirRowCtx();
        var menu = document.createElement('div');
        menu.className = 'npDirCtx';
        menu.id = 'npDirCtxMenu';

        function addItem(text, danger, handler) {
            var it = document.createElement('div');
            it.className = 'npDirCtxItem' + (danger ? ' danger' : '');
            it.textContent = text;
            it.addEventListener('mousedown', function (e2) { e2.stopPropagation(); });
            it.addEventListener('click', function (e2) {
                e2.stopPropagation();
                closeDirRowCtx();
                handler();
            });
            menu.appendChild(it);
        }
        addItem('新建一篇', false, function () {
            if (!entry || !entry.el) return;
            showWholeDocument();
            var newSeq = insertArticleAfter(entry, index);
            renderDirList();
            if (typeof newSeq === 'number' && newSeq >= 0) selectArticleByIndex(newSeq);
        });
        if (entry && entry.el &&
            entry.el.getAttribute('data-outline-level') === '1' &&
            entry.el.getAttribute('data-level') !== 'title' &&
            collectArticleTitleTexts(entry.el).length) {
            addItem('更新索引', false, function () {
                updateIndexTitle(entry.el);
            });
        }
        addItem('上移一篇', false, function () {
            if (!entry || !entry.el) return;
            pickWithGuard(function () {
                focusArticlePara(entry.el);
                if (typeof window.moveNotepadArticle === 'function') window.moveNotepadArticle(-1);
                renderDirList();
            });
        });
        addItem('下移一篇', false, function () {
            if (!entry || !entry.el) return;
            pickWithGuard(function () {
                focusArticlePara(entry.el);
                if (typeof window.moveNotepadArticle === 'function') window.moveNotepadArticle(1);
                renderDirList();
            });
        });

        // 导出：html（整体/分割）、docx（相当于导出全部文章）
        function addSub(text, items) {
            var wrap = document.createElement('div');
            wrap.className = 'npDirCtxSub';
            wrap.textContent = text + ' ▸';
            var sub = document.createElement('div');
            sub.className = 'npDirCtxSubMenu';
            items.forEach(function (it) {
                var el = document.createElement('div');
                el.className = 'npDirCtxItem';
                el.textContent = it.text;
                el.addEventListener('mousedown', function (e2) { e2.stopPropagation(); });
                el.addEventListener('click', function (e2) {
                    e2.stopPropagation();
                    closeDirRowCtx();
                    it.run();
                });
                sub.appendChild(el);
            });
            wrap.appendChild(sub);
            menu.appendChild(wrap);
        }
        function runExport(which) {
            if (typeof window.npExportFromMenu === 'function') window.npExportFromMenu(which);
            else showToast('导出功能不可用');
        }
        addSub('导出 html', [
            { text: '整体导出', run: function () { runExport('html-all'); } },
            { text: '分割导出', run: function () { runExport('html-split'); } }
        ]);
        addSub('导出 docx', [
            { text: '全部文章', run: function () { runExport('docx-all'); } }
        ]);
        addSub('添加到小窗', [0, 1, 2, 3, 4].map(function (slot) {
            return {
                text: '窗口 ' + (slot + 1) +
                    (window.npMultiView && typeof window.npMultiView.slotMark === 'function'
                        ? window.npMultiView.slotMark(slot) : ''),
                run: function () {
                    var snap = articleSnapshot(index);
                    if (!snap) { showToast('这篇文章的内容不可用'); return; }
                    if (window.npMultiView && typeof window.npMultiView.assign === 'function') {
                        window.npMultiView.assign(slot, snap);
                    } else {
                        showToast('多窗预览模块未加载');
                    }
                }
            };
        }));
        addItem('删除这篇', true, function () {
            if (!entry || !entry.el) return;
            pickWithGuard(function () {
                var ed = notepadEditor;
                if (!ed) return;
                if (typeof window._notepadDirShowOnlyArticle === 'function') {
                    try { window._notepadDirShowOnlyArticle(entry.el); } catch (e3) {}
                }
                var rng = document.createRange();
                rng.selectNodeContents(entry.el);
                rng.collapse(true);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(rng);
                window._notepadCtxRange = rng;
                if (typeof window.deleteNotepadArticle === 'function') window.deleteNotepadArticle();
                renderDirList();
            });
        });

        document.body.appendChild(menu);
        var mw = menu.offsetWidth, mh = menu.offsetHeight;
        var x = ev.clientX, y = ev.clientY;
        if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
        if (y + mh > window.innerHeight - 8) y = window.innerHeight - mh - 8;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    }
    function closeDirRowCtx() {
        var old = document.getElementById('npDirCtxMenu');
        if (old) old.parentNode.removeChild(old);
    }
    document.addEventListener('mousedown', function (e) {
        if (e.button === 2) return;
        var m = document.getElementById('npDirCtxMenu');
        if (m && !m.contains(e.target)) closeDirRowCtx();
    }, true);
    window.addEventListener('resize', closeDirRowCtx);
    document.addEventListener('scroll', closeDirRowCtx, true);

    /* 点击标题：右侧只显示这一篇文章（复用 notepad.js 的隐藏式单篇显示） */
    function selectArticle(entry, row, box) {
        var all = box.querySelectorAll('.npDirItem');
        for (var k = 0; k < all.length; k++) all[k].classList.remove('selected');
        if (row) row.classList.add('selected');
        _userPickedArticle = true;
        if (!entry || !entry.el) return;
        if (typeof window._notepadDirShowOnlyArticle === 'function') {
            try {
                window._notepadDirShowOnlyArticle(entry.el);
                _articleOnly = _selArticle;
                _lockedArticleEl = entry.el;
                var ed = $('notepadEditor');
                if (ed) ed.scrollTop = 0;
                if (typeof window.npRefreshExportBtn === 'function') window.npRefreshExportBtn();
                return;
            } catch (e) {}
        }
        if (entry.el.scrollIntoView) entry.el.scrollIntoView({ block: 'start' });
        if (typeof window.npRefreshExportBtn === 'function') window.npRefreshExportBtn();
    }

    /* 打开另一篇笔记后：中部选中态回到「全文」，右侧回到整篇顶部 */
    function resetArticleSelection() {
        if (typeof window._notepadDirRestoreHidden === 'function') {
            try { window._notepadDirRestoreHidden(); } catch (e) {}
        }
        _articleOnly = -1;
        _selArticle = -1;
        _userPickedArticle = false;
        _pickPending = false;
        _lockedArticleEl = null;
        window.npArticleAfterGuard = null;
        renderDirList();
        autoSelectOnlyArticle();
    }

    /* 整篇笔记只有一篇时，打开就直接进单篇视图（内容一样，但导出按钮可用）。
       多篇的笔记仍从「显示全部笔记」开始，由用户点标题决定。 */
    function autoSelectOnlyArticle() {
        if (_dirMode !== 'titles' || _articleOnly >= 0) return;
        var rows = document.querySelectorAll('#npDirList .npDirItem[data-article-index]');
        if (rows.length !== 1) return;
        var idx = parseInt(rows[0].getAttribute('data-article-index'), 10);
        if (!(idx >= 0)) return;
        var entries = articleEntryList(editorParagraphs());
        if (entries.length !== 1) return;
        _selArticle = 0;
        _userPickedArticle = true;
        selectArticle(entries[0], rows[0], $('npDirList'));
    }
    window.npAutoSelectOnlyArticle = autoSelectOnlyArticle;

    /* 新建笔记后：直接选中第一篇文章，右侧只显示它（索引随之进入标题列表） */
    function selectFirstArticle() {
        if (typeof window._notepadDirRestoreHidden === 'function') {
            try { window._notepadDirRestoreHidden(); } catch (e) {}
        }
        renderDirList();
        var rows = document.querySelectorAll('#npDirList .npDirItem[data-article-index]');
        if (!rows.length) return;
        var row = rows[0];
        var idx = parseInt(row.getAttribute('data-article-index'), 10);
        var label = (row.querySelector('.npDirLabel') || {}).textContent || '';
        var ps = editorParagraphs();
        var entries = articleEntryList(ps);
        var entry = null;
        for (var i = 0; i < entries.length; i++) {
            if (i === idx) { entry = entries[i]; break; }
        }
        _selArticle = idx;
        _userPickedArticle = true;
        if (entry) selectArticle(entry, row, $('npDirList'));
        else if (label) { row.classList.add('selected'); }
    }

    /* 中部点击统一入口：有未保存改动时先询问，确认后才执行切换动作 */
    var _pickPending = false;

    function pickWithGuard(action) {
        if (_pickPending) return;
        var guard = window.npArticleBeforeSwitch;
        if (typeof guard !== 'function' || guard()) { action(); return; }
        _pickPending = true;
        window.npArticleAfterGuard = function (ok) {
            window.npArticleAfterGuard = null;
            _pickPending = false;
            if (ok) action();
        };
    }

    function showWholeDocument() {
        if (typeof window._notepadDirRestoreHidden === 'function') {
            try { window._notepadDirRestoreHidden(); } catch (e) {}
        }
        _articleOnly = -1;
        _selArticle = -1;
        _userPickedArticle = false;
        _lockedArticleEl = null;
        /* 单篇时点过标题，光标可能还留在某一段里；不改它的话「显示全部笔记」后
           npIsSingleArticleView() 会按「隐藏/显示混杂」的旧状态判断，导出仍按单篇切片，
           看到的正文就不是整窗了。这里把光标收回到编辑区开头，回到真正的「全文」。 */
        var _ed = $('notepadEditor');
        if (_ed) {
            try {
                var _r = document.createRange();
                _r.setStart(_ed, 0);
                _r.collapse(true);
                var _s = window.getSelection();
                _s.removeAllRanges();
                _s.addRange(_r);
            } catch (e) {}
        }
        renderDirList();
    }

    /* ---------------- 单篇显示锁 ----------------
       编辑器里的粘贴 / 删除等操作会直接增删 <p>，新旧段落混杂时
       notepad.js 的 display:none 标记会丢失，界面退回全文。
       这里记住被点击的那一段（索引标题或文章标题），改动后重新定位并重套隐藏。 */

    function _npArticleHash(el) {
        if (!el) return '';
        return plainText(el.textContent) + '|' + String(el.getAttribute('data-level') || '');
    }

    function lockCurrentArticle() {
        var ed = $('notepadEditor');
        if (!ed || _articleOnly < 0) { _lockedArticleEl = null; return; }
        var ps = Array.prototype.slice.call(ed.querySelectorAll('p'));
        var entries = articleEntryList(ps);
        var e = entries[_selArticle];
        _lockedArticleEl = e && e.el ? e.el : null;
        if (!_lockedArticleEl) {
            var cur = _articleOnly;
            _lockedArticleEl = (entries[cur] && entries[cur].el) || null;
        }
    }

    /* 在改动后的文档里找回锁定的那一段：先按对象比，再按文字比 */
    function relocateLockedArticle(ps) {
        if (!_lockedArticleEl) return null;
        if (_lockedArticleEl.style && _lockedArticleEl.style.display === 'none') _lockedArticleEl.style.display = '';
        if (_lockedArticleEl.parentNode && ps.indexOf(_lockedArticleEl) >= 0) {
            return _lockedArticleEl;
        }
            var want = _npArticleHash(_lockedArticleEl);
            if (!want) return null;
            var startIdx = -1;
            var lockedLevel = String(_lockedArticleEl.getAttribute('data-level') || '');
            var lockedText = plainText(_lockedArticleEl.textContent);
            for (var i = 0; i < ps.length; i++) {
                if (_npArticleHash(ps[i]) === want) { startIdx = i; break; }
            }
            if (startIdx < 0 && lockedText) {
                /* 文字被改过（比如在索引行里打字）：优先取「文字相同或以原文字开头」的那一段，
                   再退到同层级里开头若干字一致的那一段 */
                for (var k = 0; k < ps.length; k++) {
                    var tk = plainText(ps[k].textContent);
                    if (tk === lockedText && String(ps[k].getAttribute('data-level') || '') === lockedLevel) { startIdx = k; break; }
                }
                if (startIdx < 0) {
                    var prefix = lockedText.slice(0, 6);
                    for (var j = 0; j < ps.length; j++) {
                        var t = plainText(ps[j].textContent);
                        if (t.indexOf(prefix) === 0 && String(ps[j].getAttribute('data-level') || '') === lockedLevel) { startIdx = j; break; }
                    }
                }
            }
            if (startIdx < 0) return null;
        _lockedArticleEl = ps[startIdx];
        return ps[startIdx];
    }

    function computeArticleEnd(ps, seq, entries) {
        var start = entries[seq].idx;
        var stop = (seq + 1 < entries.length) ? entries[seq + 1].idx : ps.length;
        /* 有索引标题（或被当成唯一一篇的文章标题）时可完整显示到下一篇；
           只认索引标题，普通文章标题段落本身不会单独成篇。 */
        if (ps[start] && ps[start].getAttribute('data-outline-level') === '1') return stop;
        return stop;
    }

    function articleBounds(ps, anchor, entries) {
        var seq = -1;
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].el === anchor) { seq = i; break; }
        }
        if (seq >= 0) return { start: entries[seq].idx, end: computeArticleEnd(ps, seq, entries) };
        /* 索引标题文字被删空时它不再是 entry，仍按「下一个索引标题」划界 */
        var start = ps.indexOf(anchor);
        if (start < 0) return null;
        var end = ps.length;
        for (var j = start + 1; j < ps.length; j++) {
            if (ps[j].getAttribute('data-outline-level') === '1') { end = j; break; }
        }
        return { start: start, end: end };
    }

    function articleLockIntact(ps, anchor) {
        var entries = articleEntryList(ps);
        var b = articleBounds(ps, anchor, entries);
        if (!b) return false;
        for (var j = 0; j < ps.length; j++) {
            var marked = ps[j].getAttribute('data-dir-hidden') === 'true';
            if (j >= b.start && j < b.end) { if (marked) return false; }
            else if (!marked) return false;
        }
        return true;
    }

    function applyArticleLock(ps, anchor) {
        var entries = articleEntryList(ps);
        var b = articleBounds(ps, anchor, entries);
        if (!b) return;
        for (var j = 0; j < ps.length; j++) {
            if (j >= b.start && j < b.end) {
                ps[j].removeAttribute('data-dir-hidden');
                ps[j].style.display = '';
            } else {
                ps[j].setAttribute('data-dir-hidden', 'true');
                ps[j].style.display = 'none';
            }
        }
    }

    function reapplyArticleLock() {
        if (_articleOnly < 0 || _singleGuardApplying) return;
        var ed = $('notepadEditor');
        if (!ed || !_lockedArticleEl) return;
        /* 正在写材料 / 目录浏览模式时由 notepad.js 自己接管显示 */
        if (typeof window._notepadDirBrowseMode !== 'undefined' && window._notepadDirBrowseMode) return;
        var ps = Array.prototype.slice.call(ed.querySelectorAll('p'));
        var anchor = relocateLockedArticle(ps);
        if (!anchor) return;
        if (articleLockIntact(ps, anchor)) return;
        _singleGuardApplying = true;
        try {
            /* 先走一次 notepad.js 的入口，把它内部的 _notepadDirActiveHide 置为 true，
               这样用户点「显示全部笔记」时它才会真的还原。 */
            if (typeof window._notepadDirShowOnlyArticle === 'function') {
                try { window._notepadDirShowOnlyArticle(anchor); } catch (e0) {}
            }
            applyArticleLock(ps, anchor);
            /* 同步 notepad.js 的记账，保证它自己的还原逻辑还能用 */
            var d = document.createElement('div');
            d.innerHTML = anchor.outerHTML;
            var clone = d.querySelector('p');
            if (clone) {
                clone.removeAttribute('data-dir-hidden');
                clone.style.display = '';
                window._notepadHiddenArticleHeadingHtml = clone.outerHTML;
            }
        } finally {
            _singleGuardApplying = false;
        }
    }

    function scheduleArticleLock() {
        if (_singleGuardTimer) clearTimeout(_singleGuardTimer);
        _singleGuardTimer = setTimeout(function () {
            _singleGuardTimer = null;
            if (_articleOnly < 0) return;
            reapplyArticleLock();
        }, 30);
    }

    window.npReapplyArticleLock = reapplyArticleLock;
    window.npLockCurrentArticle = lockCurrentArticle;

    /* 判断段落的「黑体」是不是整段意义上的：
       - 段落自身 font-family 是黑体 → 算（这是用层级菜单/工具栏设的标题）；
       - 段落里只有部分 span 是黑体（用户单独选几个字设成黑体）→ 不算。
       用于修正「正文里局部文字设黑体被误判成一级标题」。 */
    /* 手动设过格式（applyNotepadLevel）且当前是正文段：不管字体残留成什么样都不进提纲。
       否则「设成一级标题 → 再设回正文」后，段内 span 还带着黑体，重新打开笔记时会被
       _detectHeadingDisplayLevel 当作一级标题，提纲里又多出一条。 */
    function isManualBodyPara(p) {
        if (!p || p.nodeType !== 1) return false;
        if (p.getAttribute('data-manual') !== '1') return false;
        if (p.getAttribute('data-outline-level') || p.getAttribute('data-level') ||
            p.getAttribute('data-ai-heading-level') || p.getAttribute('data-manual-level') ||
            p.getAttribute('data-autoformat-heading')) return false;
        if (p.querySelector && p.querySelector('[data-manual-level]')) return false;
        return true;
    }

    /* 段落或段内文字是否真的用了标题字体：黑体 / 楷体 / 仿宋加粗 / 小标宋。
       只靠 data-outline-level 残留标记不够——「改成正文」后标记可能已经清掉，
       但段内 span 仍残留标题字体；反过来旧数据里也会有标记在、字体早就是正文的情况。 */
    function hasHeadingFont(p) {
        if (!p || p.nodeType !== 1) return false;
        if (isManualBodyPara(p)) return false;
        var pf = String(p.style && p.style.fontFamily || '').replace(/['"]/g, '').toLowerCase();
        var pfw = String(p.style && p.style.fontWeight || '').toLowerCase();
        if (pf.indexOf('小标宋') !== -1) return true;
        if (pf.indexOf('黑体') !== -1 || pf.indexOf('simhei') !== -1) return true;
        if (pf.indexOf('楷体') !== -1 || pf.indexOf('kaiti') !== -1) return true;
        if ((pf.indexOf('仿宋') !== -1 || pf.indexOf('fangsong') !== -1) && pfw === 'bold') return true;
        var spans = p.querySelectorAll('span');
        for (var i = 0; i < spans.length; i++) {
            var sf = String(spans[i].style && spans[i].style.fontFamily || '').replace(/['"]/g, '').toLowerCase();
            var sfw = String(spans[i].style && spans[i].style.fontWeight || '').toLowerCase();
            if (sf.indexOf('小标宋') !== -1) return true;
            if (sf.indexOf('黑体') !== -1 || sf.indexOf('simhei') !== -1) return true;
            if (sf.indexOf('楷体') !== -1 || sf.indexOf('kaiti') !== -1) return true;
            if ((sf.indexOf('仿宋') !== -1 || sf.indexOf('fangsong') !== -1) && sfw === 'bold') return true;
        }
        return false;
    }

    /* 「实际字体级别」：逐字取浏览器计算后的字体（内联样式、<font face>、继承都算），
       按字符占比判定。段落样式写着黑体、但整段文字被 span 改成仿宋时，这里返回 0（正文）。
       0 = 正文 / 无标题字体，1 = 黑体（一级），2 = 楷体（二级），3 = 仿宋加粗（三级）。 */
    function npNodeFontLevel(node, p) {
        var el = node && node.nodeType === 3 ? node.parentNode : node;
        if (!el || el.nodeType !== 1) return 0;
        var ff = '', fw = '';
        try {
            var cs = window.getComputedStyle(el);
            if (cs) { ff = String(cs.fontFamily || ''); fw = String(cs.fontWeight || ''); }
        } catch (e0) {}
        if (!ff && el.style) ff = el.style.fontFamily || '';
        if (!fw && el.style) fw = el.style.fontWeight || '';
        ff = ff.replace(/["']/g, '').toLowerCase();
        if (ff.indexOf('小标宋') !== -1 || ff.indexOf('fzxiao') !== -1) return 1;
        if (ff.indexOf('黑体') !== -1 || ff.indexOf('simhei') !== -1) return 1;
        if (ff.indexOf('楷体') !== -1 || ff.indexOf('kaiti') !== -1) return 2;
        if ((ff.indexOf('仿宋') !== -1 || ff.indexOf('fangsong') !== -1) && /bold|[789]00/.test(fw.toLowerCase())) return 3;
        return 0;
    }

    /* 按「提纲上显示的那段文字」判定它实际用的字体级别：
       只有这部分文字里 ≥60% 的字符是对应标题字体，才算标题。
       ——这样正文里局部设黑体、或整段被改成仿宋（段落标签残留黑体）都不会再冒到提纲。 */
    function npTextFontLevel(p, labelText) {
        if (!p || p.nodeType !== 1) return null;
        var want = String(labelText == null ? (p.textContent || '') : labelText)
            .replace(/[\s\u3000\u00a0\u200b]/g, '').length;
        if (!want) return null;
        var counts = [0, 0, 0, 0];
        var seen = 0;
        var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null, false);
        while (seen < want && walker.nextNode()) {
            var t = walker.currentNode.textContent || '';
            var lv = npNodeFontLevel(walker.currentNode, p);
            for (var i = 0; i < t.length && seen < want; i++) {
                if (/[\s\u3000\u00a0\u200b]/.test(t.charAt(i))) continue;
                counts[lv]++;
                seen++;
            }
        }
        if (!seen) return null;
        var best = 0, bestN = 0;
        for (var k = 1; k <= 3; k++) {
            if (counts[k] > bestN) { best = k; bestN = counts[k]; }
        }
        if (!best || bestN / seen < 0.6) return null;
        return best;
    }
    window._npTextFontLevel = npTextFontLevel;

    function isWholeParaHeiti(p) {
        if (!p || p.nodeType !== 1) return false;
        if (isManualBodyPara(p)) return false;
        var lv = p.getAttribute('data-outline-level');
        /* 用户明确设定过层级（含 2/3 级）时按原逻辑走 */
        if (lv === '2' || lv === '3') return true;

        var pf = String(p.style && p.style.fontFamily || '').replace(/['"]/g, '').toLowerCase();
        if ((pf.indexOf('黑体') !== -1 || pf.indexOf('simhei') !== -1) && pf.indexOf('小标宋') === -1) return true;

        /* 段落本体不是黑体：检查是否「整段文字都在黑体 span 里」 */
        var spans = p.querySelectorAll('span');
        if (!spans.length) return false;
        var allText = String(p.textContent || '').replace(/[\s\u3000\u00a0\u200b]/g, '');
        if (!allText) return false;
        var heitiText = '';
        for (var i = 0; i < spans.length; i++) {
            var sf = String(spans[i].style && spans[i].style.fontFamily || '').replace(/['"]/g, '').toLowerCase();
            if ((sf.indexOf('黑体') !== -1 || sf.indexOf('simhei') !== -1) && sf.indexOf('小标宋') === -1) {
                heitiText += String(spans[i].textContent || '').replace(/[\s\u3000\u00a0\u200b]/g, '');
            }
        }
        /* 只有「全部文字都是黑体」才认一级标题；局部黑体忽略 */
        return !!heitiText && heitiText === allText;
    }

    /* 提纲识别口径：字体样式 + 层级标记 必须同时满足。
       - 层级标记（marker）：data-outline-level=2/3、data-level=title、
         data-ai-heading-level=1/2/3、data-manual-level 任一条存在；
       - 字体只用来区分「几级」，不能单独把一段正文定性成标题
         （否则正文里设成楷体 / 注释字号也会冒到提纲里）。 */
    function hasOutlineMarker(p) {
        if (!p || p.nodeType !== 1) return false;
        var ol = p.getAttribute('data-outline-level');
        if (ol === '2' || ol === '3') return true;
        if (p.getAttribute('data-level') === 'title') return true;
        var ai = p.getAttribute('data-ai-heading-level');
        if (ai === '1' || ai === '2' || ai === '3') return true;
        if (p.getAttribute('data-manual-level')) return true;
        /* 手动分层时层级常挂在段内 span 上（applyNotepadLevel 部分选中） */
        if (p.querySelector && p.querySelector('[data-manual-level]')) return true;
        return false;
    }

    // 与 notepad.js「目录 → 打开目录 → 文稿提纲」同一套内容与样式
    // 段落没有 data-outline-level 时，用 _detectHeadingDisplayLevel 识别层级（必须同时有 marker）
    function autoOutlineInfo(p) {
        if (!p || p.nodeType !== 1) return null;
        var dl = p.getAttribute('data-level');
        if (dl === 'date' || dl === 'author' || dl === 'title') return null;
        if (p.getAttribute('data-outline-level') === '1') return null;
        var txt = (p.textContent || '').replace(/^\s+|\s+$/g, '');
        if (!txt || txt === '（空）' || txt === '(空)') return null;
        /* 没有层级标记 → 不管字体多像标题，都不进提纲 */
        if (!hasOutlineMarker(p)) return null;
        if (!hasHeadingFont(p)) return null;
        var lv = null;
        if (typeof window._detectHeadingDisplayLevel === 'function') {
            try { lv = window._detectHeadingDisplayLevel(p); } catch (e) { lv = null; }
        }
        if (lv === null || lv === undefined) return null;
        var text = txt;
        if (p.getAttribute('data-manual') === '1' && typeof window._extractManualHeadingText === 'function') {
            var mt = '';
            try { mt = window._extractManualHeadingText(p, lv) || ''; } catch (e) { mt = ''; }
            if (mt) text = mt;
        }
        // 只取首句，避免整段正文挤进提纲
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            if (ch === '。' || ch === '！' || ch === '；' || ch === '．') {
                text = text.substring(0, i + 1);
                break;
            }
        }
        text = text.replace(/^\s+|\s+$/g, '');
        if (!text) return null;
        /* 文字实际字体必须和层级对得上：一级=黑体、二级=楷体、三级=仿宋加粗。
           段落标签写着黑体、但整段被改成仿宋（或只有局部几个字黑体）→ 不算标题。 */
        var fontLv = npTextFontLevel(p, text);
        if (fontLv === null || fontLv !== lv) return null;
        return { text: text, level: lv, isArticleTitle: false };
    }

    function collectOutline(entries, articleIdx, ps) {
        var items = [];
        if (articleIdx < 0 || articleIdx >= entries.length) return items;
        var start = entries[articleIdx].idx;
        var end = (articleIdx + 1 < entries.length) ? entries[articleIdx + 1].idx : ps.length;
        for (var i = start + 1; i < end; i++) {
            var p = ps[i];
            var info = null;
            if (typeof window._npOutlineDisplayInfo === 'function') {
                try { info = window._npOutlineDisplayInfo(p); } catch (e) { info = null; }
            }
            if (info && info.isArticleTitle) continue;
            /* 标记在、但那段文字实际早已不是标题字体（例如级标题改回正文、或段落被改成仿宋）
               → 不进提纲；判定按「提纲显示的文字」逐字取实际字体。 */
            if (info && npTextFontLevel(p, info.text || '') !== (info.level || 1)) info = null;
            if (!info) info = autoOutlineInfo(p);   // 自动识别：黑体/楷体/仿宋加粗 + 中文序号
            if (info && npTextFontLevel(p, info.text || '') !== (info.level || 1)) info = null;
            if (info) items.push({ el: p, level: info.level || 1, text: info.text || '' });
            // 手动设置层级的段落：附加条目也要收集（与源程序一致）
            var extra = [];
            if (typeof window._npOutlineExtraEntries === 'function') {
                try { extra = window._npOutlineExtraEntries(p) || []; } catch (e) { extra = []; }
            }
            for (var ei = 0; ei < extra.length; ei++) {
                /* 口径统一为「字体 + 层级标记」：
                   段落/片段没有层级标记（只是字体像标题）→ 不算；1 级还要整段黑体。 */
                if (!hasOutlineMarker(p)) continue;
                if ((extra[ei].level || 1) === 1 && !isWholeParaHeiti(p)) continue;
                if (!info || extra[ei].text !== info.text) {
                    items.push({ el: p, level: extra[ei].level || 1, text: extra[ei].text || '' });
                }
            }
        }
        return items;
    }

    function renderOutlineList(entries, ps) {
        var box = $('npDirList');
        if (!entries.length) {
            renderDirEmpty('此笔记尚无内容');
            return;
        }
        if (_selArticle < 0) _selArticle = 0;
        if (_selArticle >= entries.length) _selArticle = entries.length - 1;
        var entry = entries[_selArticle];

        var ul = document.createElement('ul');
        ul.className = 'npOutlineStruct' + (_outlineShowCount ? ' npOutlineWithCount' : '');
        box.appendChild(ul);

        /* 字数：文章标题 = 整篇；标题条目 = 自身到下一个同级或更高层级标题之前 */
        var articleChars = '';
        if (_outlineShowCount) {
            /* 索引标题行只是列表抬头，不计入总字数；合并标题（data-level=title）本身要算 */
            var aStart = entry.idx + ((entry.el && entry.el.getAttribute('data-level') === 'title') ? 0 : 1);
            var aEnd = (entry.el && typeof computeArticleEnd === 'function')
                ? computeArticleEnd(ps, _selArticle, entries) : ps.length;
            if (!(aEnd > aStart)) aEnd = ps.length;
            for (var ai = aStart; ai < aEnd && ai < ps.length; ai++) {
                articleChars += ps[ai].textContent || '';
            }
        }

        // 文章标题（同源程序：小标宋 + 蓝色下边线）
        var titleLi = document.createElement('li');
        titleLi.className = 'npOutlineTitle';
        titleLi.textContent = entry.label;
        titleLi.title = entry.label;
        if (_outlineShowCount) appendOutlineCount(titleLi, npCharCount(articleChars));
        titleLi.addEventListener('click', function () {
            if (entry.el && entry.el.scrollIntoView) entry.el.scrollIntoView({ block: 'start' });
        });
        ul.appendChild(titleLi);

        var items = collectOutline(entries, _selArticle, ps);
        if (!items.length) {
            var none = document.createElement('li');
            none.className = 'npOutlineNone';
            none.textContent = '（该文章下无层级标题）';
            ul.appendChild(none);
            return;
        }

        var minLevel = 1;
        for (var mi = 0; mi < items.length; mi++) {
            if (items[mi].level < minLevel) minLevel = items[mi].level;
        }
        for (var i = 0; i < items.length; i++) {
            (function (it) {
                var relLevel = it.level - minLevel + 1;
                if (relLevel < 1) relLevel = 1;
                if (relLevel > 3) relLevel = 3;

                var li = document.createElement('li');
                li.textContent = it.text;
                li.setAttribute('data-outline-level-shown', String(relLevel));
                if (relLevel === 2) li.style.paddingLeft = '1em';
                else if (relLevel === 3) li.style.paddingLeft = '2em';
                if (relLevel === 1) li.style.fontFamily = '黑体,SimHei,sans-serif';
                if (relLevel === 2) li.style.fontFamily = '楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif';
                if (relLevel === 3) {
                    li.style.fontFamily = '仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif';
                    li.style.fontWeight = 'bold';
                }
                if (typeof window._notepadOutlineBindStructItem === 'function') {
                    try {
                        window._notepadOutlineBindStructItem(li, {
                            text: it.text, element: it.el, level: it.level, isArticleTitle: false
                        });
                    } catch (e) {}
                }
                /* 那个绑定会挂上写材料模式自己的右键菜单（oncontextmenu），
                   中部提纲页统一走本模块的「修改 / 剪切 / 上移 / 下移」，这里解绑。 */
                li.oncontextmenu = null;
                li.addEventListener('click', function () {
                    if (it.el && it.el.scrollIntoView) it.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    var sibs = ul.querySelectorAll('.npOutlineSelected');
                    for (var si = 0; si < sibs.length; si++) sibs[si].classList.remove('npOutlineSelected');
                    li.classList.add('npOutlineSelected');
                });
                li.addEventListener('contextmenu', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    openOutlineItemCtx(ev, it);
                });
                if (_outlineShowCount) {
                    var segEnd = (entry.el && typeof computeArticleEnd === 'function')
                        ? computeArticleEnd(ps, _selArticle, entries) : ps.length;
                    if (!(segEnd > 0)) segEnd = ps.length;
                    for (var ni = i + 1; ni < items.length; ni++) {
                        if ((items[ni].level || 1) <= (it.level || 1)) {
                            var nex = ps.indexOf(items[ni].el);
                            if (nex >= 0) { segEnd = nex; break; }
                        }
                    }
                    var segStart = ps.indexOf(it.el);
                    var segChars = '';
                    if (segStart >= 0) {
                        for (var si2 = segStart; si2 < segEnd && si2 < ps.length; si2++) {
                            segChars += ps[si2].textContent || '';
                        }
                    }
                    appendOutlineCount(li, npCharCount(segChars));
                }
                ul.appendChild(li);
            })(items[i]);
        }
    }

    /* 把字数标签追加到行尾并右对齐 */
    function appendOutlineCount(li, n) {
        var span = document.createElement('span');
        span.className = 'npOutlineCount';
        span.textContent = n + '字';
        span.title = '本范围共 ' + n + ' 字（含标题自身）';
        li.appendChild(span);
        li.classList.add('npOutlineCounted');
    }

    /* 提纲页的内容指纹：文章 + 每个标题的层级 / 文字 / 段落下标。
       段落从一级标题改成正文后，指纹变化 → 提纲立即重排。 */
    function _outlineKey(entries) {
        if (_dirMode !== 'outline' || !entries.length) return '';
        var ps = editorParagraphs();
        var seq = Math.max(0, Math.min(_selArticle, entries.length - 1));
        var items = collectOutline(entries, seq, ps);
        var parts = [entries[seq].label + '@' + entries[seq].idx];
        for (var i = 0; i < items.length; i++) {
            parts.push(items[i].text + '#' + items[i].level + '#' + ps.indexOf(items[i].el));
        }
        return parts.join('\u0001');
    }

    function renderDirList() {
        var box = $('npDirList');
        if (!box) return;
        var keepScroll = box.scrollTop;
        if (_dirMode === 'titles' && _articleOnly >= 0) _userPickedArticle = true;
        renderDirToggle();
        removeDirOutlineFoot();

        if (_dirMode === 'mirror') { renderMirror(box); return; }
        if (_dirMode === 'whiteboard') { renderWhiteboard(box); return; }
        box.classList.remove('npDirMirror', 'npDirWhiteboard');

        var ps = editorParagraphs();
        var entries = articleEntryList(ps);
        var ed = $('notepadEditor');
        var hasContent = !!(ed && plainText(ed.innerHTML));

        // 光标位置 → 选中文章；光标不在文章里时保留上次选择，首次进入默认第一篇
        // 未手动点过标题时保持「全文」选中（右侧显示整篇），光标移动不抢占选中态
        _caretPara = caretParagraphIndex();
        if (_userPickedArticle) {
            var at = articleIndexAt(entries, _caretPara);
            if (at >= 0 && _articleOnly < 0) _selArticle = at;
            else if (_selArticle >= entries.length) _selArticle = entries.length - 1;
            if (_selArticle < 0 && entries.length) _selArticle = 0;
        } else {
            _selArticle = -1;
            _articleOnly = -1;
        }

        box.innerHTML = '';
        if (_dirMode === 'outline') renderOutlineList(entries, ps);
        else renderTitleList(entries, hasContent);
        if (_dirMode === 'outline') renderDirRefreshBtn();
        _inputDirKey = _dirEntriesKey(entries);
        if (_dirMode === 'outline') _inputOutlineKey = _outlineKey(entries);
        try { box.scrollTop = keepScroll; } catch (e) {}
        if (typeof window.npRefreshExportBtn === 'function') window.npRefreshExportBtn();
    }

    /* ---------------- 目录栏：镜像（照搬写材料模式的镜像） ---------------- */
    function renderMirror(box) {
        var ed = $('notepadEditor');
        box.classList.remove('npDirWhiteboard');
        box.classList.add('npDirMirror');
        var view = box.querySelector('.npMirrorView');
        if (!view) {
            box.innerHTML = '';
            view = document.createElement('div');
            view.className = 'npMirrorView';
            box.appendChild(view);
        }
        /* 重绘前记住滚动位置，重绘后还原，避免一刷新就跳回开头 */
        var keepScroll = box.scrollTop;

        /* 只镜像当前正在编辑的那一篇（显示单篇时），全文时镜像全部 */
        var tmp = document.createElement('div');
        var srcHtml = '';
        if (ed) {
            try {
                if (typeof window.npIsSingleArticleView === 'function' && window.npIsSingleArticleView()) {
                    var psAll = Array.prototype.slice.call(ed.querySelectorAll('p'));
                    var single = psAll.filter(function (p) { return p.style.display !== 'none'; });
                    tmp.innerHTML = single.map(function (p) { return p.outerHTML; }).join('');
                } else {
                    tmp.innerHTML = ed.innerHTML;
                }
            } catch (e) {
                tmp.innerHTML = ed.innerHTML;
            }
            if (!tmp.innerHTML) tmp.innerHTML = ed.innerHTML;
        }
        var ps = tmp.querySelectorAll('p');
        for (var i = 0; i < ps.length; i++) {
            ps[i].removeAttribute('data-collapsed');
            ps[i].style.display = '';
        }
        var srcHtml = tmp.innerHTML;
        if (view._npMirrorSrc === srcHtml) {
            box.scrollTop = keepScroll;
            view.scrollTop = keepScroll;
            return;
        }

        /* 按段落 diff：只替换内容真的变了的段，避免每敲一个字就重绘整篇镜像。 */
        var srcNodes = Array.prototype.slice.call(tmp.children);
        var dstNodes = Array.prototype.slice.call(view.children);
        if (srcNodes.length !== dstNodes.length) {
            view.innerHTML = srcHtml;
        } else {
            for (var d = 0; d < srcNodes.length; d++) {
                var sn = srcNodes[d], dn = dstNodes[d];
                if (sn.tagName !== dn.tagName) { view.innerHTML = srcHtml; break; }
                if (sn.outerHTML === dn.outerHTML) continue;
                /* 复制属性（style / class / data-*），保留镜像自己的对齐方式 */
                var keepAlign = dn.style.textAlign;
                while (dn.attributes.length) dn.removeAttribute(dn.attributes[0].name);
                for (var ai = 0; ai < sn.attributes.length; ai++) {
                    dn.setAttribute(sn.attributes[ai].name, sn.attributes[ai].value);
                }
                dn.innerHTML = sn.innerHTML;
                if (keepAlign && keepAlign !== 'center') dn.style.textAlign = 'justify';
            }
        }
        view._npMirrorSrc = srcHtml;
        var vps = view.querySelectorAll('p');
        for (var j = 0; j < vps.length; j++) {
            if ((vps[j].style.textAlign || '') !== 'center') vps[j].style.textAlign = 'justify';
        }
        var fs = (ed && parseInt(getComputedStyle(ed).fontSize, 10)) || 14;
        if (view.style.fontSize !== fs + 'px') view.style.fontSize = fs + 'px';

        box.scrollTop = keepScroll;
        view.scrollTop = keepScroll;
    }

    /* 镜像页实时同步：只在「镜像」页显示时刷新，且保持滚动位置 */
    function scheduleMirrorSync() {
        if (_dirMode !== 'mirror') return;
        if (_mirrorTimer) clearTimeout(_mirrorTimer);
        _mirrorTimer = setTimeout(function () {
            _mirrorTimer = null;
            if (_dirMode !== 'mirror') return;
            var box = $('npDirList');
            if (!box) return;
            renderMirror(box);
        }, 180);
    }
    window._npScheduleMirrorSync = scheduleMirrorSync;

    /* 层级按钮 / 重置格式之后由 notepad.js 主动叫一次：
       手动改格式时只有 data-* 和样式变化，未必有 input，提纲要立即按正文口径重排。 */
    window._npRefreshOutlinePage = function () {
        if (_dirMode !== 'outline') return;
        _inputOutlineKey = '';
        renderDirList();
    };

    /* ---------------- 目录栏：白板（照搬写材料模式的白板） ---------------- */
    var WB_KEY = 'npWhiteboardText';
    var WB_ZOOM_KEY = 'npWhiteboardZoom';
    var WB_ZOOM_MIN = 0.6;
    var WB_ZOOM_MAX = 2.4;

    function loadWbZoom() {
        var z = parseFloat(localStorage.getItem(WB_ZOOM_KEY));
        if (!isFinite(z) || z < WB_ZOOM_MIN || z > WB_ZOOM_MAX) z = 1;
        return Math.round(z * 10) / 10;
    }

    /* 从编辑区复制进白板时，段落之间会多出空行：
       编辑区每段是 <p>，浏览器给 text/plain 时 <p> 后是 \n\n（块级自带一空行），
       再按行保留就变成「正文 + 空行 + 正文」。
       处理：块级本身已带段分隔，因此每段之间只保留一层换行；
       原文里用户自己敲出的连续空行也压成一层，白板里不再出现成片空行。 */
    function _wbCleanPastedText(text) {
        var s = String(text || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
        s = s.replace(/[ \t\u3000]+$/gm, '');
        var lines = s.split('\n');
        var out = [];
        var prevBlank = false;
        for (var i = 0; i < lines.length; i++) {
            var blank = !lines[i].replace(/[\s\u3000]/g, '');
            if (blank && prevBlank) continue;
            out.push(blank ? '' : lines[i]);
            prevBlank = blank;
        }
        while (out.length && out[out.length - 1] === '') out.pop();
        return out.join('\n');
    }

    /* 浏览器把每个 <p> 导出成「正文\n\n」，行拆分后会出现一半的空行；
       这里进一步把「行 → 空行 → 行」压成「行 → 行」。 */
    function _wbCollapseBlankLines(text) {
        return String(text || '').replace(/\n[ \t\u3000]*\n/g, '\n');
    }

    function _wbInsertText(ta, text, html) {
        var clean = _wbCleanPastedText(text);
        if (!clean && html) {
            var box = document.createElement('div');
            box.innerHTML = html;
            /* 块级元素之间补一个换行，段内 <br> 也算一个换行，避免整段糊成一行 */
            var blocks = box.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,tr');
            var parts = [];
            for (var bi = 0; bi < blocks.length; bi++) {
                var bt = String(blocks[bi].textContent || '').replace(/[\s\u3000\u00a0]+/g, ' ').trim();
                if (bt) parts.push(bt);
            }
            clean = _wbCleanPastedText(parts.join('\n'));
        }
        clean = _wbCollapseBlankLines(clean);
        if (!clean) return false;
        var start = ta.selectionStart, end = ta.selectionEnd;
        var val = ta.value || '';
        var head = val.substring(0, start);
        var tail = val.substring(end);
        /* 前后已经有换行时不要再补，避免又出现空行 */
        var needHead = head && !/\n$/.test(head) ? '\n' : '';
        var needTail = tail && !/^\n/.test(tail) ? '\n' : '';
        ta.value = head + needHead + clean + needTail + tail;
        var pos = (head + needHead + clean).length;
        try { ta.setSelectionRange(pos, pos); } catch (e) {}
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }

    function _wbApplyZoom(ta, z) {
        if (!ta) return;
        ta.style.fontSize = Math.round(13 * z) + 'px';
        var label = document.getElementById('npWhiteboardZoomValue');
        if (label) label.textContent = Math.round(z * 100) + '%';
    }

    function _wbZoomStep(delta) {
        var ta = document.getElementById('npWhiteboard');
        if (!ta) return;
        var z = loadWbZoom() + delta;
        z = Math.min(WB_ZOOM_MAX, Math.max(WB_ZOOM_MIN, z));
        z = Math.round(z * 10) / 10;
        try { localStorage.setItem(WB_ZOOM_KEY, String(z)); } catch (e) {}
        _wbApplyZoom(ta, z);
    }

    function renderWhiteboard(box) {
        box.classList.remove('npDirMirror');
        box.classList.add('npDirWhiteboard');
        var stage = box.querySelector('.npWhiteboardStage');
        if (!stage) {
            box.innerHTML = '';
            stage = document.createElement('div');
            stage.className = 'npWhiteboardStage';
            var ta0 = document.createElement('textarea');
            ta0.className = 'npWhiteboard';
            ta0.id = 'npWhiteboard';
            ta0.spellcheck = false;
            ta0.placeholder = '临时粘贴内容到这里，自动暂存到本机缓存。';
            try { ta0.value = localStorage.getItem(WB_KEY) || ''; } catch (e) {}
            ta0.addEventListener('input', function () {
                try { localStorage.setItem(WB_KEY, ta0.value || ''); } catch (e) {}
            });
            /* 粘贴清洗：先把纯文本的空行压平，再交给浏览器插入 */
            ta0.addEventListener('paste', function (ev) {
                var cd = ev.clipboardData;
                if (!cd) return;
                var text = cd.getData('text/plain') || '';
                var html = cd.getData('text/html') || '';
                ev.preventDefault();
                _wbInsertText(ta0, text, html);
            });
            var zoom = document.createElement('div');
            zoom.className = 'npWhiteboardZoom';
            zoom.innerHTML = '<button type="button" class="npWbZoomBtn" data-wbzoom="-1" title="缩小">−</button>'
                + '<span class="npWhiteboardZoomValue" id="npWhiteboardZoomValue">100%</span>'
                + '<button type="button" class="npWbZoomBtn" data-wbzoom="1" title="放大">+</button>';
            stage.appendChild(ta0);
            box.appendChild(stage);
            stage.appendChild(zoom);
        }
        var ta = stage.querySelector('.npWhiteboard');
        var zoomBox = stage.querySelector('.npWhiteboardZoom');
        if (zoomBox && !zoomBox.dataset.bound) {
            zoomBox.dataset.bound = '1';
            zoomBox.addEventListener('click', function (ev) {
                var b = ev.target && ev.target.closest ? ev.target.closest('[data-wbzoom]') : null;
                if (!b) return;
                _wbZoomStep((parseFloat(b.getAttribute('data-wbzoom')) || 0) * 0.1);
            });
        }
        _wbApplyZoom(ta, loadWbZoom());
    }

    /* 正文输入后只刷新中间标题列表，且条目没变就不重建 DOM。
       以前这里每次都 renderDirList + renderTopicList + renderPreview，
       麒麟上每停一次键就整块重绘三栏，看起来就是屏幕在闪。 */
    function _dirEntriesKey(entries) {
        var parts = [];
        for (var i = 0; i < entries.length; i++) {
            parts.push((entries[i].label || '') + '@' + entries[i].idx + '@' +
                (entries[i].el && entries[i].el.getAttribute('data-outline-level') || ''));
        }
        return parts.join('\u0001');
    }

    function scheduleDirRefresh() {
        if (_dirTimer) clearTimeout(_dirTimer);
        _dirTimer = setTimeout(function () {
            _dirTimer = null;
            var entries = articleEntryList(editorParagraphs());
            var key = _dirEntriesKey(entries);
            if (key === _inputDirKey) return;
            _inputDirKey = key;
            renderDirList();
        }, 400);
    }

    /* 光标移动只更新标题行的选中态，不重建整块列表。 */
    function scheduleCaretSync() {
        if (_caretTimer) clearTimeout(_caretTimer);
        _caretTimer = setTimeout(function () {
            _caretTimer = null;
            if (_dirMode !== 'titles' && _dirMode !== 'outline') return;
            var box = $('npDirList');
            if (!box) return;
            var entries = articleEntryList(editorParagraphs());
            var at = articleIndexAt(entries, caretParagraphIndex());
            var prevSel = _selArticle;
            if (at >= 0 && _articleOnly < 0) _selArticle = at;
            if (_dirMode === 'outline') {
                /* 提纲按段识别层级：光标换文章、或正文改了层级（标题改回正文）都要重排 */
                var okey = _outlineKey(entries);
                var oselChanged = (_selArticle !== prevSel);
                _selArticle = (_selArticle >= 0 && _selArticle < entries.length) ? _selArticle : (entries.length ? 0 : -1);
                if (oselChanged || (_selArticle === prevSel && _inputOutlineKey !== okey)) {
                    _inputOutlineKey = okey;
                    renderDirList();
                }
                return;
            }
            var allRow = box.querySelector('.npDirAll');
            if (allRow) allRow.classList.toggle('selected', _articleOnly < 0 && _selArticle < 0);
            if (at >= 0 && _articleOnly < 0) _userPickedArticle = true;
            var rows = box.querySelectorAll('.npDirItem[data-article-seq]');
            for (var i = 0; i < rows.length; i++) {
                var seq = parseInt(rows[i].getAttribute('data-article-seq'), 10);
                rows[i].classList.toggle('selected', seq === _selArticle);
            }
            if (typeof window.npRefreshExportBtn === 'function') window.npRefreshExportBtn();
        }, 60);
    }

    function setDirMode(mode) {
        if (mode !== 'titles' && mode !== 'outline' && mode !== 'mirror' && mode !== 'whiteboard') return;
        var changed = (_dirMode !== mode);
        _dirMode = mode;
        try { localStorage.setItem(DIRMODE_KEY, mode); } catch (e) {}
        /* 进入「标题 / 提纲」页时先按光标同步选中文章：
           否则切过去看到的是上一次的选择，和正在编辑的这篇对不上。 */
        if (changed && (mode === 'titles' || mode === 'outline')) selectArticleForPage();
        renderDirList();
    }

    /* ---------------- 预览栏：其他主题 / 本地文件 ---------------- */
    var PREV_KEY = 'npPreviewOn';
    var PREVMODE_KEY = 'npPreviewMode';
    var PREVTOPIC_KEY = 'npPreviewTopic';
    var _prevOn = false;
    var _prevMode = 'others';
    var _prevTopic = -1;

    function loadPreviewState() {
        /* 启动默认不显示「参考资料」：不再读 npPreviewOn 的上次状态，
           一律从关闭开始（用户本次打开仍可用，只是不跨启动记忆）。 */
        _prevOn = false;
        try { localStorage.setItem(PREV_KEY, '0'); } catch (e) {}
        try {
            var m = localStorage.getItem(PREVMODE_KEY);
            if (m === 'others' || m === 'files' || m === 'attach') _prevMode = m;
        } catch (e) {}
        try { _prevTopic = parseInt(localStorage.getItem(PREVTOPIC_KEY), 10); } catch (e) {}
        if (!isFinite(_prevTopic)) _prevTopic = -1;
    }

    function savePreviewState() {
        try { localStorage.setItem(PREV_KEY, _prevOn ? '1' : '0'); } catch (e) {}
        try { localStorage.setItem(PREVMODE_KEY, _prevMode); } catch (e) {}
        try { localStorage.setItem(PREVTOPIC_KEY, String(_prevTopic)); } catch (e) {}
    }

    /* 与写材料模式的「其他窗口」一致：只读展示另一个主题的内容 */
    function renderPreview() {
        var ws = $('npWorkspace');
        var pane = $('npPreviewPane');
        if (!ws || !pane) return;
        ws.classList.toggle('np-preview-on', _prevOn);
        ws.classList.toggle('np-mv-on', mvOpen());
        pane.setAttribute('aria-hidden', _prevOn ? 'false' : 'true');
        updatePreviewWidth();
        syncTopButtons();

        var tabs = document.querySelectorAll('#npPrevTabs .npDirTab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle('active', tabs[i].getAttribute('data-prevmode') === _prevMode);
        }
        var others = $('npPrevOthersPane');
        var files = $('npPrevFilesPane');
        var att = $('npPrevAttachPane');
        if (others) others.classList.toggle('show', _prevMode === 'others');
        if (files) files.classList.toggle('show', _prevMode === 'files');
        if (att) att.classList.toggle('show', _prevMode === 'attach');

        /* 功能区随模式切换：笔记=检索框 + 检索按钮 / 本地=3 个文件夹按钮 / 附件=添加按钮。
           笔记页的「收起」让位给「检索」（整栏仍可由顶栏「参考资料」按钮关掉）。 */
        var searchEl = $('npPrevSearchWrap');
        var slotEl = $('npPrevFolderSlots');
        var addEl = $('npAttachAddBtn');
        var closeEl = $('npPrevCloseBtn');
        if (searchEl) searchEl.style.display = _prevMode === 'others' ? '' : 'none';
        if (slotEl) slotEl.style.display = _prevMode === 'files' ? '' : 'none';
        if (addEl) addEl.style.display = _prevMode === 'attach' ? '' : 'none';
        if (closeEl) closeEl.style.display = _prevMode === 'others' ? 'none' : '';
        if (_prevOn) {
            try {
                if (_prevMode === 'files' && typeof window.npFvRender === 'function') window.npFvRender();
                if (_prevMode === 'attach' && typeof window.npAttachRender === 'function') window.npAttachRender();
            } catch (e) {}
        }
        if (_prevMode !== 'others' || !_prevOn) return;

        /* 笔记页：全文检索 + 多关键字高亮（实现在 js/notepad-prevsearch.js） */
        if (window.npPrevSearch && typeof window.npPrevSearch.mount === 'function') {
            try { window.npPrevSearch.mount(); } catch (e) {}
        }
    }

    function togglePreview() {
        _prevOn = !_prevOn;
        savePreviewState();
        renderPreview();
    }

    function setPrevMode(mode) {
        if (mode !== 'others' && mode !== 'files' && mode !== 'attach') return;
        if (_prevMode !== mode && typeof window.npCloseViewer === 'function') {
            try { window.npCloseViewer(); } catch (e) {}
        }
        _prevMode = mode;
        savePreviewState();
        renderPreview();
    }

    function closePreview() {
        _prevOn = false;
        savePreviewState();
        renderPreview();
    }

    /* ---------------- 三栏宽度 ---------------- */
    function loadPaneState() {
        /* 启动默认显示「数据」+「文章列表」：忽略上次的显隐记忆，
           一律从两栏可见开始；用户本次的收起/展开仍会保存（只不跨启动生效）。 */
        _vis.topic = true;
        _vis.dir = true;
        try { localStorage.setItem(VIS_KEY, JSON.stringify({ topic: true, dir: true })); } catch (e) {}
        try {
            var r = JSON.parse(localStorage.getItem(RATIO_KEY) || 'null');
            if (r && r.topic > 0.05 && r.dir > 0.05 && r.topic + r.dir < 0.95) {
                _ratios.topic = r.topic;
                _ratios.dir = r.dir;
            }
        } catch (e) {}
        try {
            var m = localStorage.getItem(DIRMODE_KEY);
            if (m === 'titles' || m === 'outline' || m === 'mirror' || m === 'whiteboard') _dirMode = m;
        } catch (e) {}
    }

    function savePaneState() {
        try { localStorage.setItem(VIS_KEY, JSON.stringify({ topic: _vis.topic, dir: _vis.dir })); } catch (e) {}
        try { localStorage.setItem(RATIO_KEY, JSON.stringify(_ratios)); } catch (e) {}
    }

    function visibleSplitterWidth(ws) {
        var list = ws.querySelectorAll('.npSplitter');
        var w = 0;
        for (var i = 0; i < list.length; i++) {
            if (getComputedStyle(list[i]).display !== 'none') w += list[i].offsetWidth;
        }
        return w;
    }

    function setPx(t, d) {
        var ws = $('npWorkspace');
        if (!ws) return;
        ws.style.setProperty('--npTopicW', t + 'px');
        ws.style.setProperty('--npDirW', d + 'px');
    }

    // 按比例排布；先扣掉拖动条占位
    function layoutByRatios() {
        var ws = $('npWorkspace');
        if (!ws) return;
        var total = ws.clientWidth - visibleSplitterWidth(ws);
        if (total <= 0) return;
        /* 预览栏开着时左两栏不能按 2:3:5 铺满整个工作区（会把编辑区挤出容器），
           改由 updatePreviewWidth → reflowForPreview 统一排布。 */
        if (overlayOn()) { updatePreviewWidth(); return; }        var t = Math.round(total * _ratios.topic);
        var d = Math.round(total * _ratios.dir);
        t = Math.max(MIN_TOPIC, t);
        d = Math.max(MIN_DIR, d);
        if (t + d > total - MIN_EDITOR) {
            var k = (total - MIN_EDITOR) / (t + d);
            t = Math.max(MIN_TOPIC, Math.round(t * k));
            d = Math.max(MIN_DIR, Math.round(d * k));
        }
        _cur = { topic: t, dir: d, total: total };
        setPx(t, d);
    }

    /* 预览栏宽度 = 数据文件栏 + 拖动条 + 文章列表栏（预览栏正盖在这两栏之上）。
       编辑区的 margin-left 也取这个值，所以两侧严丝合缝、不会留空白。
       两栏都收起时回退到「视口 40%」的下限。 */
    /* 预览栏 / 多窗预览共用同一条「覆盖层」布局：都要把编辑区向右让位。 */
    function overlayOn() { return _prevOn || mvOpen(); }

    function syncOverlayLayout() {
        var ws = $('npWorkspace');
        if (!ws) return;
        ws.classList.toggle('np-preview-on', _prevOn);
        ws.classList.toggle('np-mv-on', mvOpen());
        updatePreviewWidth();
    }

    function updatePreviewWidth() {
        var ws = $('npWorkspace');
        if (!ws) return;
        var minW = Math.round(window.innerWidth * 0.4);
        var sp = visibleSplitterWidth(ws);
        var total = ws.clientWidth - sp;
        var w;
        if (_prevManualW > 0) {
            /* 用户手动拖过右边框：以手动宽为准，但要给编辑区留出最小宽度。
               _prevManualW 不跟着窗口缩放改写，窗口变窄后仍按当前容器重新限幅。 */
            w = Math.max(MIN_PREV_MANUAL, Math.min(_prevManualW, Math.max(MIN_PREV_MANUAL, total - MIN_EDITOR)));
        } else {
            /* 自动：左两栏按 2:3:5 的比例占工作区的前 5 份，预览栏正好盖住它们 */
            var wantT = _vis.topic ? _ratios.topic : 0;
            var wantD = _vis.dir ? _ratios.dir : 0;
            w = (wantT + wantD) > 0 ? Math.round(total * (wantT + wantD)) : minW;
            if (w <= 0) w = minW;
            w += sp;
        }
        /* 不能把编辑区挤没 */
        var maxW = Math.max(MIN_EDITOR, ws.clientWidth - MIN_EDITOR - 20);
        w = Math.min(w, maxW);
        /* 打开中：让左两栏合计与预览栏宽对齐（单一数据源 = --npPrevW），
           否则编辑区被 margin-left 推走后会和左两栏之间留出空档。 */
        if (overlayOn() && !_reflowing) {
            _reflowing = true;
            try { reflowForPreview(w); } finally { _reflowing = false; }
        }
        ws.style.setProperty('--npPrevW', w + 'px');
        /* 附件 / 本地页的预览浮层 #npAttachViewer 挂在 #notepadPanel 下（不在工作区内），
           取不到工作区上的变量，这里同步一份，否则它只能退回 50% 与预览栏对不齐。 */
        var panel = $('notepadPanel');
        if (panel) panel.style.setProperty('--npPrevW', w + 'px');
        _prevW = w;
        /* 预览栏 / 多窗关闭时编辑区不再需要让位 */
        if (!overlayOn()) ws.style.setProperty('--npPrevShift', '0px');
    }
    var _reflowing = false;

    /* ---------------- 预览栏右边框拖动 ---------------- */
    var _prevManualW = 0;   /* >0 表示用户手动拖过 */
    var _prevW = 0;
    var MIN_PREV_MANUAL = 260;

    function bindPrevResizer() {
        var rz = $('npPrevResizer');
        var ws = $('npWorkspace');
        if (!rz || !ws || rz._npBound) return;
        rz._npBound = true;
        var dragging = false;

        function maxAllowedPrev() {
            var minLeft = (_vis.topic ? MIN_TOPIC : 0) + (_vis.dir ? MIN_DIR : 0) + visibleSplitterWidth(ws);
            return Math.max(MIN_PREV_MANUAL, ws.clientWidth - minLeft - MIN_EDITOR);
        }
        function applyFromX(clientX) {
            var r = ws.getBoundingClientRect();
            var w = Math.round(clientX - r.left);
            var maxW = maxAllowedPrev();
            w = Math.max(MIN_PREV_MANUAL, Math.min(w, maxW));
            _prevManualW = w;
            _prevW = w;
            ws.style.setProperty('--npPrevW', w + 'px');
            reflowForPreview(w);
            if (mvOpen() && window.npMultiView && typeof window.npMultiView.syncWidth === 'function') {
                window.npMultiView.syncWidth();
            }
        }

        rz.addEventListener('pointerdown', function (e) {
            if (e.button !== 0) return;
            e.preventDefault();
            dragging = true;
            rz.classList.add('npDragging');
            document.body.classList.add('npPrevResizing');
            try { rz.setPointerCapture(e.pointerId); } catch (err) {}
            applyFromX(e.clientX);
        });
        rz.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            e.preventDefault();
            applyFromX(e.clientX);
        });
        function end(ev) {
            if (!dragging) return;
            dragging = false;
            rz.classList.remove('npDragging');
            document.body.classList.remove('npPrevResizing');
            try { if (ev && ev.pointerId != null) rz.releasePointerCapture(ev.pointerId); } catch (err) {}
            try { window.dispatchEvent(new Event('resize')); } catch (err) {}
        }
        rz.addEventListener('pointerup', end);
        rz.addEventListener('pointercancel', end);
        rz.addEventListener('lostpointercapture', end);
        rz.addEventListener('dblclick', function (e) {
            /* 双击恢复自动宽度（与左侧两栏对齐） */
            e.preventDefault();
            _prevManualW = 0;
            updatePreviewWidth();
        });
    }

    /* 预览栏是 absolute 覆盖层，不占 flex 流，正好盖住「数据文件栏 + 文章列表栏」。
       拖动右边框时：预览栏加宽 → 左两栏按比例补足（编辑区宽度 = 工作区 - 预览栏宽）。
       ⚠️ 左两栏合计必须**等于** prevW，否则编辑区（margin-left = prevW）与预览栏右缘之间会留出空档。 */
    function reflowForPreview(prevW) {
        var ws = $('npWorkspace');
        if (!ws || !overlayOn()) return;
        var sp = visibleSplitterWidth(ws);
        var total = ws.clientWidth - sp;
        if (total <= 0) return;
        /* 左两栏合计 + 拖动条 = 预览栏宽，编辑区从预览栏右缘开始，
           这样既不会压住编辑区，也不会在两者之间留空档。 */
        var leftSum = Math.max(0, Math.min(prevW - sp, total - MIN_EDITOR));
        var wantT = _vis.topic ? _ratios.topic : 0;
        var wantD = _vis.dir ? _ratios.dir : 0;
        var k = (wantT + wantD) > 0 ? leftSum / (wantT + wantD) : 0;
        var t = _vis.topic ? Math.max(MIN_TOPIC, Math.round(wantT * k)) : 0;
        var d = _vis.dir ? Math.max(MIN_DIR, Math.round(wantD * k)) : 0;
        /* 超出则从目录栏开始收，收到下限再从话题栏收 */
        var over = t + d - leftSum;
        if (over > 0) {
            var cut = Math.min(over, Math.max(0, d - (_vis.dir ? MIN_DIR : 0)));
            d -= cut; over -= cut;
            if (over > 0) t = Math.max(MIN_TOPIC, t - over);
        }
        _cur = { topic: t, dir: d, total: total };
        setPx(t, d);
        /* 左两栏是 flex 实占（宽 0~leftSum），编辑区只需再让出「预览栏宽 - 左两栏实占」这一段 */
        var shift = Math.max(0, prevW - sp - (t + d));
        ws.style.setProperty('--npPrevShift', shift + 'px');
    }

    /* ---------------- 显隐 ---------------- */
    function syncControls() {
        var panel = $('notepadPanel');
        var topicPane = $('npTopicPane');
        var dirPane = $('npDirPane');
        var topicSplit = $('npSplitterTopic');
        var dirSplit = $('npSplitterDir');

        if (topicPane) topicPane.style.display = _vis.topic ? '' : 'none';
        if (dirPane) dirPane.style.display = _vis.dir ? '' : 'none';
        if (topicSplit) topicSplit.style.display = _vis.topic ? '' : 'none';
        if (dirSplit) dirSplit.style.display = _vis.dir ? '' : 'none';

        var both = _vis.topic && _vis.dir;
        if (panel) panel.classList.toggle('np-no-sides', !_vis.topic && !_vis.dir);

        var bt = $('npToggleTopicBtn');
        if (bt) bt.classList.toggle('active', _vis.topic);
        var bd = $('npToggleDirBtn');
        if (bd) bd.classList.toggle('active', _vis.dir);

        syncTopButtons();

        var arrow = $('npCollapseTopicBtn');
        if (arrow) {
            arrow.textContent = _vis.topic ? '‹' : '›';
            arrow.title = _vis.topic ? '收起笔记列表' : '展开笔记列表';
            arrow.setAttribute('aria-expanded', _vis.topic ? 'true' : 'false');
        }

        var master = $('npSidesToggle');
        if (master) {
            master.textContent = both ? '三栏' : ((_vis.topic || _vis.dir) ? '双栏' : '单栏');
            master.title = both ? '收起主题列表与标题栏' : '展开主题列表与标题栏';
        }
        layoutByRatios();
    }

    /* 顶栏三组按钮：①数据文件 + 文章列表（各点各的，互不影响）②参考资料 ③多窗预览。
       第二、三组互斥，点亮时自动展开左右两栏做底。 */
    function syncTopButtons() {
        var map = { topic: 'npToggleTopicBtn', dir: 'npToggleDirBtn', preview: 'npPreviewBtn', multiview: 'npMultiViewBtn' };
        var on = {
            topic: !!_vis.topic,
            dir: !!_vis.dir,
            preview: !!_prevOn,
            multiview: mvOpen()
        };
        Object.keys(map).forEach(function (k) {
            var b = $(map[k]);
            if (b) b.classList.toggle('active', !!on[k]);
        });
    }

    function setPane(pane, visible) {
        if (pane !== 'topic' && pane !== 'dir') return;
        _vis[pane] = !!visible;
        savePaneState();
        syncControls();
    }

    /* 顶栏三组按钮：①数据文件 + 文章列表（各点各的）②参考资料 ③多窗预览。
       参考资料 / 多窗预览 同处右栏位置，二者互斥；点它们时展开左右两栏做底。 */
    function previewOn() { return !!_prevOn; }

    function mvOpen() {
        return !!(window.npMultiView && window.npMultiView._state && window.npMultiView._state.open);
    }

    function activatePage(page) {
        var changed = false;
        if (page === 'topic' || page === 'dir') {
            var hadPreview = _prevOn;
            _lastSide = page;
            if (_prevOn) { _prevOn = false; savePreviewState(); changed = true; }
            if (mvOpen() && typeof window.npMultiView.close === 'function') { window.npMultiView.close(); changed = true; }
            if (!_vis[page]) {
                _vis[page] = true;
                savePaneState();
                changed = true;
            }
            syncControls();
            if (hadPreview) renderPreview();
        } else if (page === 'editor') {
            if (_prevOn) { _prevOn = false; savePreviewState(); changed = true; }
            if (mvOpen() && typeof window.npMultiView.close === 'function') { window.npMultiView.close(); changed = true; }
            syncControls();
        } else if (page === 'preview') {
            if (!_prevOn) { _prevOn = true; savePreviewState(); changed = true; }
            if (mvOpen() && typeof window.npMultiView.close === 'function') window.npMultiView.close();
            if (!_vis.topic || !_vis.dir) {
                _vis.topic = true;
                _vis.dir = true;
                savePaneState();
                changed = true;
            }
            syncControls();
            renderPreview();
        } else if (page === 'multiview' && typeof window.npMultiView.open === 'function') {
            if (_prevOn) { _prevOn = false; savePreviewState(); }
            if (!_vis.topic || !_vis.dir) {
                _vis.topic = true;
                _vis.dir = true;
                savePaneState();
            }
            syncControls();
            renderPreview();
            window.npMultiView.open();
            changed = true;
        }
        if (changed && typeof notepadEditorResize === 'function') {
            try { notepadEditorResize(); } catch (e) {}
        }
        return changed;
    }

    /* togglePane 保留「点两次收起」的老行为；
       展开某一栏时只收起右侧浮层（参考资料 / 多窗预览），不影响另一侧栏位。 */
    function togglePane(pane) {
        if (!_vis[pane]) {
            if (_prevOn) { _prevOn = false; savePreviewState(); renderPreview(); }
            if (mvOpen() && typeof window.npMultiView.close === 'function') window.npMultiView.close();
        }
        setPane(pane, !_vis[pane]);
        if (_vis[pane]) _lastSide = pane;
        syncTopButtons();
    }

    function toggleSides() {
        var both = _vis.topic && _vis.dir;
        _vis.topic = !both;
        _vis.dir = !both;
        savePaneState();
        syncControls();
        try { localStorage.setItem(SIDES_KEY, both ? '0' : '1'); } catch (e) {}
        if (typeof notepadEditorResize === 'function') notepadEditorResize();
    }

    function applySides(visible) {
        _vis.topic = !!visible;
        _vis.dir = !!visible;
        savePaneState();
        syncControls();
    }

    /* ---------------- 拖动调节栏宽 ---------------- */
    var _drag = null;

    function startDrag(which, e) {
        var ws = $('npWorkspace');
        if (!ws) return;
        var total = ws.clientWidth - visibleSplitterWidth(ws);
        _drag = { which: which, startX: e.clientX, topic: _cur.topic, dir: _cur.dir, total: total };
        document.body.classList.add('npSplitting');
        var sp = e.currentTarget;
        if (sp) sp.classList.add('npDragging');
        e.preventDefault();
    }

    function moveDrag(e) {
        if (!_drag) return;
        var dx = e.clientX - _drag.startX;
        var t = _drag.topic;
        var d = _drag.dir;
        var total = _drag.total;

        if (_drag.which === 'topic') {
            t = Math.round(_drag.topic + dx);
            d = Math.round(_drag.dir - dx);
            if (t < MIN_TOPIC) { d -= (MIN_TOPIC - t); t = MIN_TOPIC; }
            if (d < MIN_DIR) { t -= (MIN_DIR - d); d = MIN_DIR; }
        } else {
            d = Math.round(_drag.dir + dx);
            if (d < MIN_DIR) d = MIN_DIR;
            if (total - t - d < MIN_EDITOR) d = Math.max(MIN_DIR, total - t - MIN_EDITOR);
        }
        if (total - t - d < MIN_EDITOR) t = Math.max(MIN_TOPIC, total - d - MIN_EDITOR);

        _cur = { topic: t, dir: d, total: total };
        setPx(t, d);
        if (typeof notepadEditorResize === 'function') notepadEditorResize();
    }

    function endDrag() {
        if (!_drag) return;
        document.body.classList.remove('npSplitting');
        var list = document.querySelectorAll('.npSplitter.npDragging');
        for (var i = 0; i < list.length; i++) list[i].classList.remove('npDragging');
        if (_cur.total > 0) {
            _ratios.topic = Math.round(_cur.topic / _cur.total * 1000) / 1000;
            _ratios.dir = Math.round(_cur.dir / _cur.total * 1000) / 1000;
            savePaneState();
        }
        _drag = null;
    }

    function resetWidths() {
        _ratios = { topic: 0.2, dir: 0.3 };
        savePaneState();
        layoutByRatios();
        if (typeof showToast === 'function') showToast('栏宽已恢复 2:3:5');
    }

    function bindSplitters() {
        var list = document.querySelectorAll('.npSplitter');
        for (var i = 0; i < list.length; i++) {
            (function (sp) {
                var which = sp.getAttribute('data-splitter');
                sp.addEventListener('mousedown', function (e) { startDrag(which, e); });
                sp.addEventListener('dblclick', resetWidths);
            })(list[i]);
        }
        document.addEventListener('mousemove', moveDrag);
        document.addEventListener('mouseup', endDrag);
        window.addEventListener('blur', endDrag);
    }

    /* ---------------- 检索栏：在顶栏原地展开 ---------------- */
    var _searchHome = null;
    var _searchDocked = false;

    function dockSearch() {
        var wrap = $('notepadSearchWrap');
        var host = $('npHdrSearchHost');
        var ops = $('npHeaderOps');
        if (!wrap || !host) return;
        if (!_searchHome) _searchHome = { parent: wrap.parentNode, next: wrap.nextSibling };
        if (wrap.parentNode !== host) host.appendChild(wrap);
        wrap.classList.add('npHdrDock');
        wrap.style.left = '';
        wrap.style.top = '';
        var handle = $('notepadSearchDragHandle');
        if (handle) handle._boundDrag = true;
        if (ops) ops.classList.add('npSearching');
        _searchDocked = true;
        bindSearchKeys();
    }

    function undockSearch() {
        var wrap = $('notepadSearchWrap');
        var ops = $('npHeaderOps');
        if (wrap) {
            wrap.classList.remove('npHdrDock');
            wrap.style.left = '';
            wrap.style.top = '';
            if (_searchHome && _searchHome.parent && wrap.parentNode !== _searchHome.parent) {
                _searchHome.parent.insertBefore(wrap, _searchHome.next);
            }
        }
        if (ops) ops.classList.remove('npSearching');
        _searchDocked = false;
    }

    var _origSearchToggle = window.toggleNotepadSearch;
    if (typeof _origSearchToggle === 'function' && !_origSearchToggle.__npWrapped) {
        var wrappedSearch = function (e) {
            if (e && e.preventDefault) { e.preventDefault(); e.stopPropagation(); }
            var wrap = $('notepadSearchWrap');
            var ops = $('npHeaderOps');
            var wasHidden = !wrap || getComputedStyle(wrap).display === 'none';
            var r;
            if (wasHidden) {
                /* 2026-11-03：不再停靠进顶栏，改为从检索键向左展开，
                   左缘与下方编辑板块左缘对齐（_notepadPositionSearchBox 负责定位） */
                r = _origSearchToggle.call(this, null);
                if (ops) ops.classList.remove('npSearching');
                if (wrap) wrap.classList.remove('npHdrDock');
                if (typeof window._notepadPositionSearchBox === 'function') {
                    window._notepadPositionSearchBox();
                }
                bindSearchKeys();
            } else {
                r = _origSearchToggle.call(this, null);
                undockSearch();
            }
            return r;
        };
        wrappedSearch.__npWrapped = true;
        window.toggleNotepadSearch = wrappedSearch;
        toggleNotepadSearch = wrappedSearch;
    }

    var _origSearchClose = window.closeNotepadSearch;
    if (typeof _origSearchClose === 'function' && !_origSearchClose.__npWrapped) {
        var wrappedClose = function () {
            var r = _origSearchClose.apply(this, arguments);
            undockSearch();
            return r;
        };
        wrappedClose.__npWrapped = true;
        window.closeNotepadSearch = wrappedClose;
        closeNotepadSearch = wrappedClose;
    }

    // 停靠后的检索栏用回车走「下一条」，Shift+回车「上一条」
    function bindSearchKeys() {
        var input = $('notepadSearchInput');
        if (!input || input._npKeysBound) return;
        input._npKeysBound = true;
        input.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' || e.isComposing) return;
            if (!_searchDocked) return;
            e.preventDefault();
            if (e.shiftKey) {
                if (typeof notepadSearchPrev === 'function') notepadSearchPrev();
            } else {
                if (typeof notepadSearchNext === 'function') notepadSearchNext();
            }
            input.focus();
        });
    }

    /* ---------------- 初始化与挂钩 ---------------- */
    function refreshAll() {
        renderTopicList();
        renderDirList();
        renderPreview();
        if (typeof autoSelectOnlyArticle === 'function') autoSelectOnlyArticle();
    }

    function bind() {
        var list = $('npTopicList');
        if (list) {
            list.addEventListener('click', onTopicListClick);
            list.addEventListener('dblclick', onTopicListDblClick);
            list.addEventListener('mousedown', startOrder);
            list.addEventListener('contextmenu', onTopicContextMenu);
        }
        document.addEventListener('mousemove', moveOrder);
        document.addEventListener('mouseup', endOrder);
        document.addEventListener('mousedown', function (e) {
            if (_ctxEl && !e.target.closest('.npTopicCtx')) closeTopicCtx();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && _ctxEl) closeTopicCtx();
        });
        window.addEventListener('blur', function () { if (_order) { _order = null; document.body.classList.remove('npOrdering'); clearDropMarks(); } });
        window.addEventListener('resize', closeTopicCtx);

        var addBtn = $('npTopicAddBtn');
        if (addBtn) addBtn.addEventListener('click', addTopic);

        bindSearchKeys();

        var dirRefresh = $('npDirRefreshBtn');
        if (dirRefresh) {
            dirRefresh.addEventListener('click', function () {
                if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
                renderDirList();
                renderTopicList();
            });
        }

        /* 栏头「顺序 / 逆序」：按日期正序 / 逆序排列文章 */
        var sortAsc = $('npDirSortAsc');
        if (sortAsc && !sortAsc._npBound) {
            sortAsc._npBound = true;
            sortAsc.addEventListener('click', function () {
                pickWithGuard(function () {
                    if (typeof window.sortNotepadArticlesByDate === 'function') window.sortNotepadArticlesByDate(false);
                    renderDirList();
                });
            });
        }
        var sortDesc = $('npDirSortDesc');
        if (sortDesc && !sortDesc._npBound) {
            sortDesc._npBound = true;
            sortDesc.addEventListener('click', function () {
                pickWithGuard(function () {
                    if (typeof window.sortNotepadArticlesByDate === 'function') window.sortNotepadArticlesByDate(true);
                    renderDirList();
                });
            });
        }

        var dirTabs = $('npDirTabs');
        if (dirTabs) {
            dirTabs.addEventListener('click', function (e) {
                var btn = e.target.closest('.npDirTab');
                if (!btn) return;
                setDirMode(btn.getAttribute('data-dirmode'));
            });
        }

        var topicToggle = $('npToggleTopicBtn');
        if (topicToggle) topicToggle.addEventListener('click', function () {
            if (_vis.topic && !_prevOn && !mvOpen()) togglePane('topic');
            else { _lastSide = 'topic'; activatePage('topic'); }
        });
        var dirToggle = $('npToggleDirBtn');
        if (dirToggle) dirToggle.addEventListener('click', function () {
            if (_vis.dir && !_prevOn && !mvOpen()) togglePane('dir');
            else { _lastSide = 'dir'; activatePage('dir'); }
        });

        var prevBtn = $('npPreviewBtn');
        if (prevBtn) prevBtn.addEventListener('click', function () {
            if (_prevOn) { _prevOn = false; savePreviewState(); renderPreview(); syncTopButtons(); }
            else activatePage('preview');
        });
        var prevClose = $('npPrevCloseBtn');
        if (prevClose) prevClose.addEventListener('click', closePreview);
        var prevTabs = $('npPrevTabs');
        if (prevTabs) {
            prevTabs.addEventListener('click', function (e) {
                var b = e.target.closest('.npDirTab');
                if (!b) return;
                setPrevMode(b.getAttribute('data-prevmode'));
            });
        }

        bindSplitters();
    bindPrevResizer();

        window.addEventListener('resize', function () { layoutByRatios(); });
        if (window.ResizeObserver) {
            var ws = $('npWorkspace');
            if (ws) {
                var ro = new ResizeObserver(function () { if (!_drag) layoutByRatios(); });
                ro.observe(ws);
            }
        }

        var ed = $('notepadEditor');
        if (ed) {
            /* 自动格式实时排版：与老版记事本一致，input 时只处理光标所在段，
               不再等段落格式按钮 / 保存后才生效。合成输入期间跳过。 */
            var _npAfComposing = false;
            var _npAfTimer = null;
            var _npAfRetry = null;
            var _npAfLastTok = '';
            var _npAfLastAt = 0;
            var NP_AF_REPEAT_MS = 1500;
            /* 判断光标所在段在自动格式下会变成什么层级，返回 level-1 / level-2 / level-3 / null（正文） */
            function _npAfExpectedLevel(p) {
                try {
                    var txt = (p.textContent || '').replace(/^\s+|\s+$/g, '');
                    if (!txt) return null;
                    if (typeof window._notepadMatchHK !== 'function') return undefined;
                    var hk = window._notepadMatchHK(txt);
                    if (!hk) return null;
                    var forced = p.getAttribute('data-autoformat-heading');
                    if (forced) { var m = { '1': 'level-1', '2': 'level-2', '3': 'level-3' }; if (m[forced]) return m[forced]; }
                    if (hk === 'cn-dun') return 'level-1';
                    if (hk === 'num-dun' || hk === 'cn-verb' || hk === 'cn-di') return undefined;
                    return 'level-2';
                } catch (e) { return undefined; }
            }
            /* 段内排版计划指纹：层级相同也可能要重排——
               1）「三、主动加强研究创新。」后面继续输入正文，正文该当场变仿宋；
               2）在这段正文里再输入「一是服务国产平台。」，这一句该当场变二级楷体。
               只看 data-last-format-level 会把这种情况判成「已排好」，所以同样用
               指纹记一份「有没有正文尾巴 / 尾巴里有没有新的小标题」。 */
            function _npAfFirstSentence(txt) {
                var t = String(txt || '');
                for (var i = 0; i < t.length; i++) {
                    if (/[。！；．]/.test(t.charAt(i))) return { sentence: t.substring(0, i + 1), rest: t.substring(i + 1) };
                }
                return { sentence: t, rest: '' };
            }
            function _npAfPlanSignature(p) {
                var txt = (p.textContent || '').replace(/^\s+|\s+$/g, '');
                if (!txt) return 'empty';
                var lv = _npAfExpectedLevel(p);
                if (lv === undefined) return '';
                var sig = lv || 'level-body';
                if (typeof window._notepadMatchHK !== 'function') return sig;
                var hk = window._notepadMatchHK(txt);
                if (!hk) return sig;
                var split = (hk === 'cn-verb' && typeof window._npSplitCnHeadingText === 'function')
                    ? window._npSplitCnHeadingText(txt) : _npAfFirstSentence(txt);
                if (!split || !split.rest) return sig;
                sig += '|rest';
                var rest = split.rest;
                var reC = /([一二三四五六七八九十]+)[是要看抓查学紧盯聚焦]|（[一二三四五六七八九十]+）|(\d+)[.、．]/g;
                var m;
                while ((m = reC.exec(rest)) !== null) {
                    var ok = true;
                    if (/^[一二三四五六七八九十]/.test(m[0])) {
                        ok = (typeof window._npCnMarkAllowed === 'function') ? window._npCnMarkAllowed(rest, m.index)
                            : (m.index === 0 || /[\s。；：！？．…]/.test(rest.charAt(m.index - 1)));
                    }
                    if (!ok) continue;
                    sig += '|cn';
                    /* 这一小句是否已经打完（打完后正文断句位置会变） */
                    for (var k = m.index; k < rest.length; k++) {
                        if (/[。；！？．…]/.test(rest.charAt(k))) { sig += '|end'; break; }
                    }
                    break;
                }
                return sig;
            }
            function _npAfParaSettled(p) {
                var exp = _npAfExpectedLevel(p);
                if (exp === undefined) return false;
                var cur = String(p.getAttribute('data-last-format-level') || '');
                if (!cur) return false;
                if (cur !== (exp || 'level-body')) return false;
                var plan = _npAfPlanSignature(p);
                if (p._npAfPlan === undefined || p._npAfPlan !== plan) return false;
                return true;
            }
            /* 回车新起的一段如果继承了上一段的手动格式/mark，后续编号就不会被自动识别。
               只清理「刚产生的新段」：段落自身 data-manual 或整段被一个 manual span 包住。 */
            function clearNewParaManual(p) {
                if (!p || p.nodeType !== 1 || p.tagName !== 'P') return;
                var inherited = p.getAttribute('data-manual') === '1';
                var kids = p.querySelectorAll('[data-manual="1"],[data-manual-span="1"]');
                if (!inherited && !kids.length) return;
                var isWholeSpan = false;
                if (p.childNodes.length === 1 && p.firstChild && p.firstChild.nodeType === 1 &&
                    p.firstChild.getAttribute('data-manual') === '1') isWholeSpan = true;
                if (!inherited && !isWholeSpan) return;
                p.removeAttribute('data-manual');
                for (var i = 0; i < kids.length; i++) {
                    kids[i].removeAttribute('data-manual');
                    kids[i].removeAttribute('data-manual-span');
                    kids[i].removeAttribute('data-manual-level');
                }
                p.removeAttribute('data-last-format-level');
            }
            function _npRunLiveFormat(token) {
                try {
                    if (token && token === _npAfLastTok) return;
                    var sel = window.getSelection();
                    if (!sel || !sel.rangeCount) return;
                    var node = sel.anchorNode;
                    if (!node || !ed.contains(node)) return;
                    var p = node.nodeType === 3 ? node.parentNode : node;
                    while (p && p !== ed && p.tagName !== 'P' && p.tagName !== 'DIV') p = p.parentNode;
                    if (!p || p === ed) return;
                    if (_npAfParaSettled(p)) return;
                    if (typeof window._applyLiveFormat !== 'function') return;
                    window._applyLiveFormat();
                    try { p._npAfPlan = _npAfPlanSignature(p); } catch (e1) {}
                    if (token) _npAfLastTok = token;
                    _npAfLastAt = Date.now();
                } catch (e) {}
            }
            function _npContentChangedByAutoFormat() {
                if (!_npAfLastAt) return false;
                return Date.now() - _npAfLastAt < NP_AF_REPEAT_MS;
            }
            function _npLiveFormatNow(token) {
                _npAfTimer = null;
                if (!window.S || !window.S._autoFormatEnabled) return;
                if (_npAfComposing) return;
                if (typeof window._applyLiveFormat !== 'function') return;
                if (window._npSkipNextLiveFormat) { window._npSkipNextLiveFormat = false; return; }
                if (window._npPasteGuardUntil && window._npPasteGuardUntil > Date.now()) return;
                /* 有文字选区时不要自动排版：会把用户的选区折叠掉（重置格式 / 高亮 / 替换后尤其明显） */
                var selNow = window.getSelection();
                if (selNow && selNow.rangeCount && !selNow.isCollapsed) return;
                /* 同步一次：输入完「一、」「（一）」这类编号时，只在内容真的变了才排版；
                   程序自己改写的 HTML 不再触发连锁排版，避免屏幕上一直闪 */
                _npRunLiveFormat(token);
                if (_npAfRetry) clearTimeout(_npAfRetry);
                _npAfRetry = setTimeout(function () {
                    _npAfRetry = null;
                    _npLiveFormatNow(null);
                }, 600);
            }
            function _npScheduleLiveFormat(token) {
                if (!window.S || !window.S._autoFormatEnabled) return;
                if (_npAfComposing) return;
                if (_npAfTimer) clearTimeout(_npAfTimer);
                _npAfTimer = setTimeout(function () { _npLiveFormatNow(token); }, 80);
            }
            /* 打字跟随：光标落入编辑区下方 6 行 / 25% 以内时，每次跨到新的一行只向上推一行，
               视线停在屏幕同一位置。只在自动格式开启且光标折叠时生效。 */
            var _npCaretLine = 0;
            var _npCaretPushedAt = '';
            var _npCaretTimer = null;
            function _npCaretRowOf(range) {
                var r = range.getClientRects();
                var rect = (r && r.length) ? r[r.length - 1] : range.getBoundingClientRect();
                if (!rect || (!rect.height && !rect.width)) return null;
                return rect;
            }
            function _npFollowCaretNow() {
                if (!window.S || !window.S._autoFormatEnabled) return;
                var sel = window.getSelection();
                if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
                if (!sel.anchorNode || !ed.contains(sel.anchorNode)) return;
                var range = sel.getRangeAt(0).cloneRange();
                var rect = _npCaretRowOf(range);
                if (!rect) return;
                var box = ed.getBoundingClientRect();
                var lh = parseFloat(getComputedStyle(ed).lineHeight) || 0;
                if (!lh || !isFinite(lh)) lh = parseFloat(getComputedStyle(ed).fontSize) * 1.6 || 24;
                var threshold = Math.max(lh * 6, box.height * 0.25);
                var room = box.bottom - rect.bottom;
                if (room >= threshold) { _npCaretLine = 0; return; }
                var line = Math.round(rect.top / lh);
                if (line === _npCaretLine) return;
                _npCaretLine = line;
                var st = ed.scrollTop;
                var max = Math.max(0, ed.scrollHeight - ed.clientHeight);
                if (max <= 0) return;
                var key = line + '|' + Math.round(st);
                if (key === _npCaretPushedAt) return;
                _npCaretPushedAt = key;
                ed.scrollTop = Math.min(max, st + Math.max(lh, lh - room));
                if (window._npSyncInvisibles) window._npSyncInvisibles();
            }
            function _npScheduleFollowCaret() {
                if (_npCaretTimer) clearTimeout(_npCaretTimer);
                _npCaretTimer = setTimeout(function () {
                    _npCaretTimer = null;
                    try { _npFollowCaretNow(); } catch (e) {}
                }, 30);
            }
            window._npFollowCaretNow = _npFollowCaretNow;
            window._npScheduleFollowCaret = _npScheduleFollowCaret;
            window._npContentChangedByAutoFormat = _npContentChangedByAutoFormat;
            window._npRunLiveFormat = _npRunLiveFormat;
            window._npScheduleLiveFormat = _npScheduleLiveFormat;
            ed.addEventListener('compositionstart', function () { _npAfComposing = true; });
            ed.addEventListener('compositionend', function () {
                _npAfComposing = false;
                _npScheduleLiveFormat();
            });
            ed.addEventListener('input', function (e) {
                touchTime(currentNotepadTab);
                scheduleDirRefresh();
                scheduleCaretSync();
                scheduleMirrorSync();
                if (e && e.isComposing) return;
                if (e && (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop')) return;
                var sel0 = window.getSelection();
                var tok = ed.innerText || '';
                if (sel0 && sel0.rangeCount) {
                    var n0 = sel0.anchorNode;
                    var p0 = n0 && n0.nodeType === 3 ? n0.parentNode : n0;
                    while (p0 && p0 !== ed && p0.tagName !== 'P' && p0.tagName !== 'DIV') p0 = p0.parentNode;
                    tok += '|' + (p0 && p0 !== ed ? (p0.textContent || '') : '') + '|' + sel0.anchorOffset;
                    /* 回车拆出的新段落会继承上一段的 data-manual，导致自动格式不再识别后续标题；
                       新段的纯净输入（普通打字 / 回车 / 撤销）一律摘掉手动标记。 */
                    if (p0 && p0 !== ed && /^(insertText|insertParagraph|insertLineBreak|insertCompositionText|deleteContentBackward|deleteContentForward|historyUndo|historyRedo)$/.test(e.inputType || '')) {
                        try { clearNewParaManual(p0); } catch (e2) {}
                    }
                }
                _npScheduleLiveFormat(tok);
                _npScheduleFollowCaret();
            });
            ed.addEventListener('compositionend', _npScheduleFollowCaret);
            ed.addEventListener('blur', function () { renderDirList(); renderTopicList(); renderPreview(); });

            /* 隐藏字符覆盖层：内容 / 滚动 / 尺寸变化后节流重画 */
            var _npInvisTimer = null;
            window._npSyncInvisibles = function () {
                if (!window._npShowInvisibles) return;
                if (typeof window.renderNotepadInvisibles !== 'function') return;
                if (_npInvisTimer) clearTimeout(_npInvisTimer);
                _npInvisTimer = setTimeout(function () {
                    _npInvisTimer = null;
                    try { window.renderNotepadInvisibles(); } catch (e) {}
                }, 120);
            };
            ed.addEventListener('input', window._npSyncInvisibles);
            ed.addEventListener('keyup', window._npSyncInvisibles);
            ed.addEventListener('scroll', function () { window._npSyncInvisibles(); });
            window.addEventListener('resize', function () { window._npSyncInvisibles(); });
            ed.addEventListener('wheel', function () { _npCaretLine = 0; _npCaretPushedAt = ''; }, { passive: true });
            ed.addEventListener('click', scheduleCaretSync);
            ed.addEventListener('mouseup', scheduleCaretSync);
            ed.addEventListener('keyup', scheduleCaretSync);
            ed.addEventListener('focus', scheduleCaretSync);

            /* 粘贴 / 删除 / 拖放之后，单篇视图的隐藏标记可能被浏览器重建段落时抹掉 */
            ed.addEventListener('input', scheduleArticleLock);
            ed.addEventListener('keyup', function (e) {
                if (e.key === 'Delete' || e.key === 'Backspace') scheduleArticleLock();
            });
            ed.addEventListener('paste', function () {
                setTimeout(scheduleArticleLock, 0);
                var before = caretPara();
                var beforeAll = Array.prototype.slice.call(ed.querySelectorAll('p,div'));
                var beforeIdx = before ? beforeAll.indexOf(before) : -1;
                /* 字号缩放要按「粘贴前的原样」量，先记一份节点快照；
                   同时记下光标所在段落的文字与长度，用来确认粘贴真的落到了别的段落里 */
                var beforeNodes = null;
                if (typeof Set === 'function') {
                    beforeNodes = new Set();
                    var allNow = ed.querySelectorAll('*');
                    for (var bi = 0; bi < allNow.length; bi++) beforeNodes.add(allNow[bi]);
                }
                var bText = before ? (before.textContent || '').length : 0;
                setTimeout(function () {
                    var after = caretPara();
                    if (!after) return;
                    var afterLen = (after.textContent || '').length;
                    /* 浏览器把内容并进了光标所在段落，原段落长度没变，说明粘贴没生效 */
                    if (before && after === before && afterLen === bText) return;
                    var all = Array.prototype.slice.call(ed.querySelectorAll('p,div'));
                    var i1 = all.indexOf(after);
                    if (i1 < 0) { all = [after]; i1 = 0; }
                    /* 内容并进光标段时，从这一段开始算；否则按粘贴前的位置兜底 */
                    var i0 = (before && after === before) ? i1 : (beforeIdx >= 0 ? Math.min(beforeIdx, i1) : i1);
                    var range = [];
                    for (var ri = i0; ri <= i1; ri++) range.push(all[ri]);
                    /* 1) 整篇粘贴：按标题 → 一级 → 二级 → 正文的基准把字号整体缩到公文尺寸。
                       只改 font-size，字体与层级不动；自动格式没开也照样生效。 */
                    if (typeof window._npNormalizePastedFontScale === 'function') {
                        var scaled = null;
                        try { scaled = window._npNormalizePastedFontScale(range, beforeNodes); } catch (e3) {}
                        if (scaled && scaled.scale && scaled.scale !== 1 &&
                            !(window.S && window.S._autoFormatEnabled) && typeof showToast === 'function') {
                            showToast('粘贴字号已按' + (scaled.level === 'level-title' ? '文章标题' :
                                scaled.level === 'level-1' ? '一级标题' :
                                scaled.level === 'level-2' ? '二级标题' : '正文') +
                                '基准整体调整 ×' + Math.round(scaled.scale * 100) / 100);
                        }
                    }
                    /* 2) 自动格式开启时再清样式、定层级（会按层级写回标准字号） */
                    if (!window.S || !window.S._autoFormatEnabled) return;
                    if (typeof window._npFormatPastedPara !== 'function') return;
                    for (var i2 = 0; i2 < range.length; i2++) {
                        try { window._npFormatPastedPara(range[i2]); } catch (e4) {}
                    }
                    if (after && ed.contains(after) && after.tagName === 'P') {
                        try {
                            var r = document.createRange();
                            r.selectNodeContents(after);
                            r.collapse(false);
                            var s = window.getSelection();
                            s.removeAllRanges();
                            s.addRange(r);
                        } catch (e2) {}
                    }
                    scheduleDirRefresh();
                    scheduleCaretSync();
                    scheduleMirrorSync();
                }, 0);
            });
            ed.addEventListener('cut', function () { setTimeout(scheduleArticleLock, 0); });
            ed.addEventListener('drop', function () { setTimeout(scheduleArticleLock, 0); });
            if (window.MutationObserver) {
                var mo = new MutationObserver(function () {
                    if (window._npSyncInvisibles) window._npSyncInvisibles();
                    if (_articleOnly >= 0) scheduleArticleLock();
                    /* 手动改层级 / 重置格式不一定触发 input：DOM 变了就重算选中态与提纲 */
                    if (_dirMode === 'titles' || _dirMode === 'outline') scheduleCaretSync();
                    /* 自动格式自己改写 HTML 时不再连排（否则一直闪）；
                       粘贴、拖入、外部写入等没有 input 事件的变更才走这里补一次 */
                    if (!window.S || !window.S._autoFormatEnabled) return;
                    if (_npAfComposing) return;
                    if (_npContentChangedByAutoFormat()) return;
                    if (window._npSkipNextLiveFormat || (window._npPasteGuardUntil && window._npPasteGuardUntil > Date.now())) return;
                    _npScheduleLiveFormat('mut');
                });
                mo.observe(ed, {
                    childList: true, subtree: true, characterData: true,
                    attributes: true,
                    /* 层级标记也算：同一段改成正文时文字没变，只有 data-* 变了 */
                    attributeFilter: ['data-dir-hidden', 'style', 'data-level', 'data-outline-level',
                        'data-manual', 'data-ai-heading-level', 'data-manual-level', 'data-autoformat-heading']
                });
            }
        }

        // 兼容旧开关：曾用 wenbaoSidesVisible 记录整体显隐
        var legacy = null;
        try { legacy = localStorage.getItem(SIDES_KEY); } catch (e) {}
        loadPaneState();
        loadTimes();
        if (legacy === '0' && !localStorage.getItem(VIS_KEY)) {
            _vis.topic = false;
            _vis.dir = false;
        }
        syncControls();
    }

    // 包装切换与样式刷新，切换到哪一篇就同步三栏
    var _origSwitch = window.switchNotepadTab;
    if (typeof _origSwitch === 'function' && !_origSwitch.__npWrapped) {
        var wrapped = function (index) {
            var r = _origSwitch.apply(this, arguments);
            _pendingDelete = -1;
            _selArticle = -1;
            _articleOnly = -1;
            _userPickedArticle = false;
            _lockedArticleEl = null;
            refreshAll();
            return r;
        };
        wrapped.__npWrapped = true;
        window.switchNotepadTab = wrapped;
        switchNotepadTab = wrapped;
    }

    var _origRename = window.confirmNotepadRename;
    if (typeof _origRename === 'function' && !_origRename.__npWrapped) {
        var wrappedRename = function () {
            var r = _origRename.apply(this, arguments);
            touchTime(currentNotepadTab);
            refreshAll();
            return r;
        };
        wrappedRename.__npWrapped = true;
        window.confirmNotepadRename = wrappedRename;
        confirmNotepadRename = wrappedRename;
    }

    // 面板从隐藏切到显示时补一次排布（此时才有真实宽度）
    var _origToggle = window.toggleNotepad;
    if (typeof _origToggle === 'function' && !_origToggle.__npWrapped) {
        var wrappedToggle = function () {
            var r = _origToggle.apply(this, arguments);
            setTimeout(function () {
                layoutByRatios();
                refreshAll();
                if (typeof window.npLibStart === 'function') {
                    try {
                        var p = window.npLibStart();
                        if (p && typeof p.then === 'function') {
                            p.then(function (ready) {
                                if (ready === false && !window._npLibPrompted &&
                                    typeof window.npLibChooseFolder === 'function') {
                                    window._npLibPrompted = true;
                                    setTimeout(function () {
                                        window.npLibChooseFolder().then(function (picked) {
                                            if (!picked) window._npLibPrompted = false;
                                        });
                                    }, 120);
                                }
                            });
                        }
                    } catch (e) {}
                }
            }, 30);
            return r;
        };
        wrappedToggle.__npWrapped = true;
        window.toggleNotepad = wrappedToggle;
        toggleNotepad = wrappedToggle;
    }

    var _origStyle = window.updateNotepadTabStyle;
    if (typeof _origStyle === 'function' && !_origStyle.__npWrapped) {
        var wrappedStyle = function () {
            var r = _origStyle.apply(this, arguments);
            renderTopicList();
            return r;
        };
        wrappedStyle.__npWrapped = true;
        window.updateNotepadTabStyle = wrappedStyle;
        updateNotepadTabStyle = wrappedStyle;
    }

    /* 单篇「重置格式（全部）」：notepad.js 的 autoFormatDocCurrent 只按
       data-outline-level="1" 分篇，点了标题却把光标放到正文会让它回退到全文。
       这里按「编辑区当前可见的段落」重新收口，只格式化这部分：
       - 先把当前篇前后的节点整段摘下来，autoFormatDoc 只看到当前篇，
         避免 _npVerifyAfterFormat 因全文比对而误判丢字
       - 整理完再把前后节点接回去，最后重新套用单篇过滤 */
    var _npFmtOnly = null;
    function npResetFormatSingle() {
        var ed = $('notepadEditor');
        var orig = window._npResetFormatVisibleOriginal;
        if (!ed || _npFmtOnly || typeof window.autoFormatDoc !== 'function') {
            return (typeof orig === 'function') ? orig() : undefined;
        }
        var ps = Array.prototype.slice.call(ed.querySelectorAll('p'));
        var shownIdx = [];
        for (var i = 0; i < ps.length; i++) {
            if (ps[i].style.display !== 'none' && ps[i].getAttribute('data-dir-hidden') !== 'true') shownIdx.push(i);
        }
        /* 麒麟上偶发：_articleOnly 还在，但 display:none 被清掉。
           这时按 scanArticles 的文章边界补出当前篇范围。 */
        if (shownIdx.length === ps.length && _articleOnly >= 0) {
            var arts = articleEntryList(ps);
            var ae = arts[_articleOnly];
            if (ae) {
                var astart = ae.idx;
                var aend = (_articleOnly + 1 < arts.length) ? arts[_articleOnly + 1].idx : ps.length;
                shownIdx = [];
                for (var ai = astart; ai < aend; ai++) shownIdx.push(ai);
            }
        }
        if (ps.length < 2 || shownIdx.length === 0 || shownIdx.length === ps.length) {
            return (typeof orig === 'function') ? orig() : undefined;
        }
        var startP = ps[shownIdx[0]];
        var endP = ps[shownIdx[shownIdx.length - 1]];
        var nodes = Array.prototype.slice.call(ed.childNodes);
        var startNode = startP;
        var endNode = endP;
        var si = nodes.indexOf(startNode);
        var ei = nodes.indexOf(endNode);
        if (si < 0 || ei < 0) return (typeof orig === 'function') ? orig() : undefined;
        var prefixHtml = '';
        var suffixHtml = '';
        var n;
        for (n = 0; n < si; n++) prefixHtml += nodes[n].nodeType === 1 ? nodes[n].outerHTML : (nodes[n].nodeValue || '');
        for (n = ei + 1; n < nodes.length; n++) suffixHtml += nodes[n].nodeType === 1 ? nodes[n].outerHTML : (nodes[n].nodeValue || '');
        var before = ed.innerHTML;
        var removed = false;
        function restore() {
            _npFmtOnly = null;
            try {
                if (removed) {
                    var inner = ed.innerHTML;
                    ed.innerHTML = prefixHtml + inner + suffixHtml;
                    removed = false;
                }
                if (ed.innerHTML !== before) {
                    if (typeof saveCurrentEditor === 'function') saveCurrentEditor();
                    if (typeof updateFooterTimestamp === 'function') updateFooterTimestamp();
                }
            } catch (e) {}
            if (_articleOnly >= 0) renderDirList();
        }
        function run(skipManual) {
            if (removed) return;
            _npFmtOnly = true;
            removed = true;
            for (n = si - 1; n >= 0; n--) { try { ed.removeChild(nodes[n]); } catch (e) {} }
            for (n = ei + 1; n < nodes.length; n++) { try { ed.removeChild(nodes[n]); } catch (e) {} }
            try { window.autoFormatDoc(true, skipManual); }
            finally { restore(); }
        }
        try {
            if (typeof window._npShowFormatConfirm === 'function') {
                window._npShowFormatConfirm('将清除当前文章的文字格式，自动调整为常见公文格式，是否继续？', run);
            } else {
                run(true);
            }
        } catch (e) {
            restore();
        }
        return undefined;
    }

    /* 用可见范围版替换 notepad.js 的分派；原函数保留给「显示全文」用 */
    if (typeof window.npResetFormatVisible === 'function' && !window.npResetFormatVisible.__npSingle) {
        window._npResetFormatVisibleOriginal = window.npResetFormatVisible;
        var _npResetFormatWrapped = function () {
            if (typeof window.npIsSingleArticleView === 'function' && window.npIsSingleArticleView()) {
                return npResetFormatSingle();
            }
            return window._npResetFormatVisibleOriginal();
        };
        _npResetFormatWrapped.__npSingle = true;
        window.npResetFormatVisible = _npResetFormatWrapped;
    }

    window.npRenderTopicList = renderTopicList;
    window.npRenderDirList = renderDirList;
    window.npDirArticleSnapshot = articleSnapshot;
    /* 当前是否只显示单篇文章（false = 显示全文）
       以 _articleOnly 为主，同时按编辑区实际隐藏状态兜底：
       某些平台（麒麟）重绘 / 缩放时会丢失 _articleOnly，导致导出按钮一直灰。 */
    window.npIsSingleArticleView = function () {
        if (_articleOnly >= 0) return true;
        var ed = $('notepadEditor');
        if (!ed) return false;
        var ps = ed.querySelectorAll('p');
        var hidden = 0;
        var shown = 0;
        for (var i = 0; i < ps.length; i++) {
            var p = ps[i];
            if (!(p.textContent || '').trim()) continue;
            if (p.style.display === 'none' || p.getAttribute('data-dir-hidden') === 'true') hidden++;
            else shown++;
        }
        return hidden > 0 && shown > 0;
    };

    /* 导出按钮的可用性：显示单篇，或者光标落在某一篇里（中间标题行已标出当前篇）。
       导出统一以「当前篇」为准，因此这两种情况都能导出。 */
    window.npHasExportTarget = function () {
        if (window.npIsSingleArticleView()) return true;
        var ps = editorParagraphs();
        var entries = articleEntryList(ps);
        if (!entries.length) return false;
        if (entries.length === 1) return true;
        return articleIndexAt(entries, caretParagraphIndex()) >= 0;
    };

    /* 把光标定位到当前选中的那一篇（导出前调用，保证导出的就是中间标着的那篇） */
    window.npFocusSelectedArticle = function () {
        var ed = $('notepadEditor');
        if (!ed) return false;
        var ps = editorParagraphs();
        var entries = articleEntryList(ps);
        if (!entries.length) return false;
        var seq = _articleOnly >= 0 ? _articleOnly : _selArticle;
        if (seq < 0) seq = articleIndexAt(entries, caretParagraphIndex());
        if (seq < 0) seq = 0;
        var entry = entries[Math.min(seq, entries.length - 1)];
        if (!entry || !entry.el) return false;
        try {
            var r = document.createRange();
            r.setStart(entry.el, 0);
            r.collapse(true);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
            return true;
        } catch (e) { return false; }
    };
    window.npRefreshWorkspace = refreshAll;
    window.npAddNotepadTopic = addTopic;
    window.npToggleWorkspaceSides = toggleSides;
    window.npTogglePane = togglePane;
    window.npSetPane = setPane;
    window.npActivatePage = activatePage;
    window.npSyncTopButtons = syncTopButtons;
    window.npInsertArticleAfter = insertArticleAfter;
    window.npShowWholeDocument = showWholeDocument;
    window.npSelectArticleByIndex = selectArticleByIndex;
    window.npSyncOverlayLayout = syncOverlayLayout;
    window.npTopView = {
        activate: activatePage,
        sync: syncTopButtons,
        closed: function (kind) {
            if (kind === 'multiview' && !mvOpen()) {
                if (_lastSide !== 'topic' && _lastSide !== 'dir') _lastSide = 'topic';
                syncTopButtons();
            }
        }
    };
    window.npResetArticleSelection = resetArticleSelection;
    window.npSelectFirstArticle = selectFirstArticle;
    window.npSetDirMode = setDirMode;
    window.npMoveTopic = function (from, to) {
        if (typeof window.npMoveNotepadTab !== 'function') return from;
        var n = window.npMoveNotepadTab(from, to);
        if (typeof _saveNotepadToCache === 'function') _saveNotepadToCache();
        refreshAll();
        return n;
    };
    window.npResetPaneWidths = resetWidths;
    window.npLayoutWorkspace = layoutByRatios;

    loadPreviewState();
    try { window._npShowInvisibles = localStorage.getItem('npShowInvisibles') === '1'; } catch (eInv) { window._npShowInvisibles = false; }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            bind(); refreshAll();
            if (window._npShowInvisibles && typeof window.renderNotepadInvisibles === 'function') {
                setTimeout(window.renderNotepadInvisibles, 60);
            }
        });
    } else {
        setTimeout(function () {
            bind(); refreshAll();
            if (window._npShowInvisibles && typeof window.renderNotepadInvisibles === 'function') {
                setTimeout(window.renderNotepadInvisibles, 60);
            }
        }, 0);
    }
})();
