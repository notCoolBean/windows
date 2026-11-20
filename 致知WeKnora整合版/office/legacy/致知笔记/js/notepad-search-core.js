/* 致知笔记 · 检索公共内核（参考资料检索 / 多窗预览检索 / 编辑区替换窗共用）
   - 空格 = 或者：每组关键字一种高亮色，最多 5 组循环
   - `-` / `－` = 并且：同一段落里都要出现
   - 逐「字符」匹配，字符之间允许空白（兼容 Word 粘贴出的零散空格） */
(function () {
    'use strict';

    var COLORS = 5;
    var COLOR_HEX = ['#FFE082', '#90CAF9', '#FF8A80', '#A5D6A7', '#CE93D8'];
    var _regCache = Object.create(null);

    function parseGroups(raw) {
        return String(raw == null ? '' : raw).trim().split(/\s+/).filter(Boolean)
            .map(function (group) {
                return group.split(/[-－]/).map(function (t) { return t.trim(); }).filter(Boolean);
            })
            .filter(function (g) { return g.length; });
    }

    function termReg(term) {
        var key = String(term == null ? '' : term).replace(/\s+/g, '');
        if (!key) return null;
        if (_regCache[key]) return _regCache[key];
        var chars = Array.from(key).map(function (c) {
            return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        });
        var re = new RegExp(chars.join('\\s*'), 'gi');
        _regCache[key] = re;
        return re;
    }

    function groupMatches(text, group) {
        return group.every(function (term) {
            var re = termReg(term);
            if (!re) return true;
            re.lastIndex = 0;
            return re.test(text);
        });
    }

    /* 一组关键字在一段文本里出现的次数 */
    function countTerm(text, term) {
        var re = termReg(term);
        if (!re) return 0;
        re.lastIndex = 0;
        var n = 0, m;
        while ((m = re.exec(text))) {
            if (!m[0]) { re.lastIndex++; continue; }
            n++;
            if (m.index === re.lastIndex) re.lastIndex++;
        }
        return n;
    }

    /* 一组关键字在若干段落文本里出现的总次数（段落需先满足「且」条件） */
    function countGroup(paragraphs, group) {
        var hits = 0;
        (paragraphs || []).forEach(function (text) {
            if (!text) return;
            if (!groupMatches(text, group)) return;
            group.forEach(function (term) { hits += countTerm(text, term); });
        });
        return hits;
    }

    /* 所有组的关键字命中区间（带 gi，供文字高亮用） */
    function scanMarks(text, entries) {
        var marks = [];
        (entries || []).forEach(function (entry) {
            (entry.terms || []).forEach(function (term) {
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

    function esc(text) {
        return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
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

    function entriesOf(groups) {
        return (groups || []).map(function (terms, gi) { return { terms: terms, gi: gi }; });
    }

    window.npSearchCore = {
        COLORS: COLORS,
        COLOR_HEX: COLOR_HEX,
        parseGroups: parseGroups,
        termReg: termReg,
        groupMatches: groupMatches,
        countTerm: countTerm,
        countGroup: countGroup,
        scanMarks: scanMarks,
        markHtml: markHtml,
        entriesOf: entriesOf
    };
})();
