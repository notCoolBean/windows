/* ============================================================
   store.js — 共享状态与数据层
   所有模块共享的状态集中在 state 对象中，通过 window.S / window.DataLayer 访问
   ============================================================ */

var _ls = localStorage;

// ---- 共享状态对象 ----
var S = {
    // 日历
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),
    selectedDate: new Date(),

    // 提醒
    reminders: JSON.parse(_ls.getItem('reminders')) || [],

    // 笔记
    notes: (function() { try { return JSON.parse(_ls.getItem('notes')) || []; } catch(e) { return []; } })(),
    _noteCategories: (function() { try { return JSON.parse(_ls.getItem('noteCategories')) || [{ id: 0, name: '默认' }]; } catch(e) { return [{ id: 0, name: '默认' }]; } })(),
    _noteCurrentCategory: (function() { var v = _ls.getItem('noteCurrentCategory'); if (v === 'all') return 'all'; var n = parseInt(v, 10); return isNaN(n) ? 0 : n; })(),

    // 记事本
    notepadData: ['', '', '', '', ''],
    notepadTitles: ['…', '…', '…', '…', '…'],
    notepadLabels: ['1', '2', '3', '4', '5'],
    notepadEditorData: [],
    notepadFontSizes: [14, 14, 14, 14, 14],
    notepadNotebookStyles: [false, false, false, false, false],
    currentNotepadTab: 0,
    notepadVisible: false,
    notepadTileMode: 'normal', // 'normal' | 'tile' | 'stack'

    // 记事本内部状态
    _notepadInitialBounds: null,
    _writeNoteMode: false,
    _materialMode: false,
    _materialActiveTab: 'outline',
    _materialNoteTab: -1,
    _materialSearchMatches: [],
    _materialSearchIndex: -1,
    _materialSearchOriginal: {},
    _materialBgColor: _ls.getItem('materialEditorBgColor') || 'none',
    _materialFullscreen: false,
    _materialSplitRatio: 0.2,
    _materialAssistZoomMap: (function () {
        try { var m = JSON.parse(_ls.getItem('materialAssistZoomMap') || 'null'); if (m && typeof m === 'object') return m; } catch (e) {}
        return {};
    })(),
    _materialAssistZoom: parseFloat(_ls.getItem('materialAssistZoom') || '1') || 1,
    _materialSavedArticlePs: null,
    _notepadTabScrollTop: [0, 0, 0, 0, 0],
    _notepadOutlineWasOpen: false,
    _notepadWorkHidden: false,
    _writeNoteArticleDirty: false,
    _enterSplitInfo: null,
    _autoFormatEnabled: false,
    tileVisible: false,
    _tileSplitDivider: null,
    _stackSplitDivider: null,
    _stackActiveTab: 0,

    // 工作日志
    currentTrackMode: 'report',
    trackFilterState: null,
    reportData: {},
    colWidths: [50, 100, 120, 400, 80, 80],
    resizingCol: null,
    startX: 0,
    startWidth: 0,
    editingRowIndex: null,
    editingDateKey: null,
    editingPendingInsert: false,
    editingInsertAfterIndex: -1,
    currentAttachments: [],
    _editingAttachIndex: -1,
    datePickerYear: new Date().getFullYear(),
    datePickerMonth: new Date().getMonth(),
    datePickerTarget: null,
    customPickerTarget: null,
    customPickerMode: false,
    currentSortCol: null,
    currentSortDir: 'asc',
    contextMenuTarget: null,
    _pageViewCtxEntry: null,
    currentDataFileName: '',
    currentDetailAttachments: [],
    categoryList: [],
    timeRangeType: 'day',
    timeRangeStart: new Date(),
    timeRangeEnd: new Date(),
    pageViewFilterDateKey: '',
    timelineShowSubItems: false,
    searchKeyword: '',
    workLogExportMode: false,
    _showAllRecords: false,
    _stagedLogKeys: {},
    _deferLogRefresh: false,

    // 常量
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    statusOrder: { 'urgent': 0, 'normal': 1, 'done': 2, 'memo': 3, 'cancel': 4 },
    browserViewableExts: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'html', 'htm', 'js', 'css', 'txt', 'pdf', 'json', 'xml', 'md']
};

// ---- 笔记页数据容错（防止旧版数据/空快照覆盖已有笔记内容）----
function _npIsBlankHtml(html) {
    var s = String(html == null ? '' : html);
    s = s.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&#160;/g, ' ');
    return !s.replace(/[\s\u3000\u00a0\u200b\ufeff]/g, '').length;
}
function _npPlainTextToHtml(txt) {
    var esc = (typeof window !== 'undefined' && typeof window.escapeHtml === 'function')
        ? window.escapeHtml
        : function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var lines = String(txt == null ? '' : txt).split(/\r?\n/);
    var out = '';
    for (var i = 0; i < lines.length; i++) {
        var t = lines[i].replace(/^\s+|\s+$/g, '');
        out += '<p style="margin:0;line-height:1.8;font-family:仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif;font-size:16px;text-align:left;text-indent:2em;">' +
            (t ? esc(t) : '&nbsp;') + '</p>';
    }
    return out;
}
// 逐页合并：incoming 为空页时保留 current（或从旧版 notepadData 纯文本回填），避免空快照整页清空
function _npMergeNotepadEditorData(incoming, current, legacyTexts) {
    var out = [];
    for (var i = 0; i < 5; i++) {
        var inc = incoming ? incoming[i] : null;
        var cur = current ? current[i] : null;
        var incHtml = (inc && typeof inc === 'object') ? (inc.html || '') : (typeof inc === 'string' ? inc : '');
        var curHtml = (cur && typeof cur === 'object') ? (cur.html || '') : (typeof cur === 'string' ? cur : '');
        var html = incHtml;
        if (_npIsBlankHtml(html)) {
            var legacy = (legacyTexts && typeof legacyTexts[i] === 'string') ? legacyTexts[i] : '';
            if (!_npIsBlankHtml(curHtml)) html = curHtml;
            else if (legacy && legacy.trim()) html = _npPlainTextToHtml(legacy);
            else html = curHtml || html;
        }
        out.push({
            html: html,
            bold: !!((inc && inc.bold) || (cur && cur.bold))
        });
    }
    return out;
}
function _npMergeNotepadTitles(incoming, current) {    var out = [];
    for (var i = 0; i < 5; i++) {
        var inc = (incoming && incoming[i] != null) ? String(incoming[i]) : '';
        var cur = (current && current[i] != null) ? String(current[i]) : '';
        var incEmpty = !inc || inc === '…';
        out.push((incEmpty && cur && cur !== '…') ? cur : inc);
    }
    return out;
}

// ---- 从工作日志文件夹加载 appdata.js 持久化数据 ----
var _pendingSavedData = null;
var _persistentDataLoaded = false;
var _persistentDataCallbacks = [];

// 注册回调：当持久化数据加载完成（或超时放弃）后调用
function onPersistentDataReady(cb) {
    if (_persistentDataLoaded) {
        setTimeout(cb, 0);
    } else {
        _persistentDataCallbacks.push(cb);
    }
}

function _firePersistentDataReady() {
    if (_persistentDataLoaded) return;
    _persistentDataLoaded = true;
    console.log('[store] 持久化数据加载流程结束');
    for (var i = 0; i < _persistentDataCallbacks.length; i++) {
        try { _persistentDataCallbacks[i](); } catch (e) { console.warn('[store] 回调执行失败:', e); }
    }
    _persistentDataCallbacks = [];
}

// 从工作日志文件夹读取 appdata.js（通过 _saveDataDirHandle，由 work-log.js 设置）
function _tryLoadAppdataFromWorkLogFolder() {
    if (_pendingSavedData) return Promise.resolve();
    if (!_saveDataDirHandle) {
        console.log('[store] _tryLoadAppdata: _saveDataDirHandle 为空');
        return Promise.resolve();
    }
    if (!_saveDataDirHandle.getDirectoryHandle) {
        console.log('[store] _tryLoadAppdata: 不支持 getDirectoryHandle');
        return Promise.resolve();
    }
    console.log('[store] _tryLoadAppdata: 开始读取 appdata.js');
    return _saveDataDirHandle.getDirectoryHandle('js', { create: false }).then(function (dh) {
        return dh.getFileHandle('appdata.js', { create: false });
    }).then(function (fh) {
        return fh.getFile();
    }).then(function (file) {
        return file.text();
    }).then(function (text) {
        // 用贪婪匹配提取 JSON 对象（从第一个 { 到最后一个 }）
        var match = text.match(/var\s+savedData\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
        if (!match) {
            console.log('[store] _tryLoadAppdata: 正则匹配失败');
            return;
        }
        try {
            var sd = JSON.parse(match[1]);
            if (!sd || typeof sd !== 'object') return;
            var hasData = false;
            for (var _k in sd) { if (sd.hasOwnProperty(_k)) { hasData = true; break; } }
            if (!hasData) return;
            console.log('[store] 从工作日志文件夹加载到 appdata.js 数据');
            _pendingSavedData = sd;
            _applyPersistentData();
        } catch (e) {
            console.warn('[store] 解析工作日志文件夹 appdata.js 失败:', e);
        }
    }).catch(function (e) {
        console.warn('[store] _tryLoadAppdata 读取失败:', e);
    });
}

// 重试加载：_saveDataDirHandle 可能还未从 IndexedDB 恢复
function _retryLoadAppdata(attempt) {
    if (_pendingSavedData) return; // _applyPersistentData 会触发回调
    if (attempt > 10) {
        console.log('[store] 工作日志文件夹 appdata.js 加载超时，使用 localStorage 数据');
        _firePersistentDataReady();
        return;
    }
    _tryLoadAppdataFromWorkLogFolder().then(function () {
        if (!_pendingSavedData) {
            setTimeout(function () { _retryLoadAppdata(attempt + 1); }, 500);
        }
        // 如果 _pendingSavedData 已设置，_applyPersistentData 内部会触发回调
    });
}

function _applyPersistentData() {
    var sd = _pendingSavedData;
    if (sd) {
        try {
            console.log('[store] 应用 appdata.js 持久化数据');
            if (sd.reminders) S.reminders = sd.reminders;
            if (sd.reportData) S.reportData = sd.reportData;
            if (sd.notes) { window.notes = sd.notes; S.notes = sd.notes; }
            if (sd.noteCategories) { window._noteCategories = sd.noteCategories; S._noteCategories = sd.noteCategories; }
            if (sd.noteCurrentCategory !== undefined) { window._noteCurrentCategory = sd.noteCurrentCategory; S._noteCurrentCategory = sd.noteCurrentCategory; }
            if (sd.notepad) {
                var np = sd.notepad;
                if (np.data) S.notepadData = np.data;
                if (np.labels) S.notepadLabels = np.labels;
                // 逐页合并，空页保留本地缓存，避免旧 appdata.js 把某些页面清空
                S.notepadTitles = _npMergeNotepadTitles(np.titles, S.notepadTitles);
                S.notepadEditorData = _npMergeNotepadEditorData(np.editorData, S.notepadEditorData, np.data);
                if (np.fontSizes) S.notepadFontSizes = np.fontSizes;
                if (np.notebookStyles) S.notepadNotebookStyles = np.notebookStyles;
            }
            if (sd.editorBoard) S._editorBoard = sd.editorBoard;
            // 同步到 localStorage 以便其他代码读取
            try {
                _ls.setItem('reminders', JSON.stringify(S.reminders));
                _ls.setItem('reportDataCache', JSON.stringify(S.reportData));
                if (S.notes) _ls.setItem('notes', JSON.stringify(S.notes));
                if (S._noteCategories) _ls.setItem('noteCategories', JSON.stringify(S._noteCategories));
            } catch (e) {}
        } catch (e) {
            console.warn('[store] 应用持久化数据失败:', e);
        }
        _pendingSavedData = null;
        _firePersistentDataReady();
    } else {
        // 从工作日志文件夹异步加载
        _retryLoadAppdata(1);
    }
}
// 在所有模块加载完成后应用持久化数据
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _applyPersistentData);
} else {
    setTimeout(_applyPersistentData, 0);
}

// ---- 文件持久化保存 ----
var _saveDataDirHandle = null;

function saveToPersistentFile() {
    var data = {
        reminders: S.reminders,
        reportData: S.reportData,
        notes: typeof notes !== 'undefined' ? notes : (S.notes || null),
        noteCategories: typeof _noteCategories !== 'undefined' ? _noteCategories : (S._noteCategories || null),
        noteCurrentCategory: typeof _noteCurrentCategory !== 'undefined' ? _noteCurrentCategory : (S._noteCurrentCategory || null),
        notepad: {
            data: S.notepadData,
            titles: S.notepadTitles,
            labels: S.notepadLabels,
            editorData: S.notepadEditorData,
            fontSizes: S.notepadFontSizes,
            notebookStyles: S.notepadNotebookStyles
        },
        editorBoard: S._editorBoard || null,
        savedAt: new Date().toISOString()
    };
    var content = '// 应用数据持久化文件 — 请勿手动编辑\n// 由应用自动保存，最近更新: ' + data.savedAt + '\nvar savedData = ' + JSON.stringify(data, null, 2) + ';\n';
    // 使用 File System Access API 静默写入（需用户先选择过文件夹）
    if (_saveDataDirHandle) {
        _saveDataDirHandle.getDirectoryHandle('js', { create: true }).then(function (dh) {
            return dh.getFileHandle('appdata.js', { create: true });
        }).then(function (fh) {
            return fh.createWritable();
        }).then(function (w) {
            return w.write(content).then(function () { return w.close(); });
        }).then(function () {
            console.log('[store] 数据已持久化到 appdata.js');
        }).catch(function (e) {
            console.warn('[store] 写入 appdata.js 失败:', e);
            _saveDataDirHandle = null;
        });
    }
    // 无目录句柄时仅依赖 localStorage 缓存，不弹出下载
}

// 请求用户选择数据目录（用于后续静默写入）
function requestDataDir() {
    if (!window.showDirectoryPicker) {
        console.warn('[store] 浏览器不支持 File System Access API');
        return Promise.resolve(null);
    }
    return window.showDirectoryPicker({ mode: 'readwrite' }).then(function (handle) {
        _saveDataDirHandle = handle;
        // 把句柄与名字持久化，重启后 work-log.js 的恢复流程能一并取回
        try { if (typeof idbPut === 'function') idbPut('saveDataDirHandle', handle); } catch (e) {}
        try { if (typeof idbPut === 'function') idbPut('dataDirName', handle.name); } catch (e) {}
        try { _ls.setItem('dataDirName', handle.name); } catch (e) {}
        console.log('[store] 已选择数据目录:', handle.name);
        return handle;
    }).catch(function (e) {
        console.warn('[store] 选择数据目录取消或失败:', e);
        return null;
    });
}

// ---- 从 localStorage 加载缓存 ----
(function _loadAllCaches() {
    var _pendingFileName = '';
    try {
        var raw = _ls.getItem('notepadCache');
        if (raw) {
            var c = JSON.parse(raw);
            if (c.titles) S.notepadTitles = c.titles;
            if (c.editorData) S.notepadEditorData = c.editorData;
            if (c.fontSizes) S.notepadFontSizes = c.fontSizes;
            if (c.labels) S.notepadLabels = c.labels;
            if (Array.isArray(c.notebookStyles) && c.notebookStyles.length === 5) S.notepadNotebookStyles = c.notebookStyles.map(function (v) { return !!v; });
            if (typeof c.currentTab === 'number') S.currentNotepadTab = c.currentTab;
            if (c.currentDataFileName) { S.currentDataFileName = c.currentDataFileName; _pendingFileName = c.currentDataFileName; }
        }
    } catch (e) { console.warn('[store] notepadCache load error:', e); }
    try {
        var fsRaw = _ls.getItem('notepadFontSizesCache');
        if (fsRaw) { var fs = JSON.parse(fsRaw); if (fs && fs.length === 5) S.notepadFontSizes = fs; }
    } catch (e) { console.warn('[store] notepadFontSizesCache load error:', e); }
    try {
        var rRaw = _ls.getItem('reportDataCache');
        if (rRaw) S.reportData = JSON.parse(rRaw);
    } catch (e) { console.warn('[store] reportDataCache load error:', e); }
    // 延迟调用 updateLastLoadedFile，等 work-log.js 加载后
    if (_pendingFileName) {
        S._pendingFileName = _pendingFileName;
    }
})();

// 初始化 notepadEditorData
for (var ndi = 0; ndi < 5; ndi++) {
    if (!S.notepadEditorData[ndi]) S.notepadEditorData[ndi] = { html: '', bold: false };
}

// ---- 辅助函数 ----
function _materialAssistZoomOf(tab) {
    tab = tab || S._materialActiveTab || 'outline';
    var v = S._materialAssistZoomMap[tab];
    if (typeof v === 'number' && isFinite(v)) return Math.max(0.6, Math.min(2, v));
    if (tab === 'outline') return S._materialAssistZoom;
    return S._materialAssistZoom;
}

function _materialAssistZoomSave() {
    try { _ls.setItem('materialAssistZoomMap', JSON.stringify(S._materialAssistZoomMap)); }
    catch (e) { S._materialAssistZoomMap = {}; }
}

function toggleTimelineSubItems(checked) {
    S.timelineShowSubItems = !!checked;
    // renderTrackContent 将在 main.js 中注入
    if (typeof window._renderTrackContent === 'function') window._renderTrackContent();
}

function _stagedKey(dateKey, origIndex) { return dateKey + '::' + origIndex; }
function _clearStagedLogKeys() { S._stagedLogKeys = {}; }

function _isItemInCurrentRange(item, dateKey) {
    var yh = _yearFromKey(dateKey);
    return S.timeRangeType === 'day'
        ? dateRangeContains(item.startTime, item.endTime, S.timeRangeStart, yh)
        : isItemInTimeRange(item.startTime, item.endTime, yh);
}

// ---- 数据层抽象 (localStorage 封装) ----
var DataLayer = {
    get: function (key) {
        try { var v = _ls.getItem(key); return v !== null ? JSON.parse(v) : null; } catch (e) { console.warn('[DataLayer.get] parse error for key="' + key + '":', e); return null; }
    },
    set: function (key, value) {
        try { _ls.setItem(key, JSON.stringify(value)); return true; } catch (e) { console.error('[DataLayer.set] FAILED for key="' + key + '":', e); return false; }
    },
    remove: function (key) {
        try { _ls.removeItem(key); } catch (e) { console.warn('[DataLayer.remove] error for key="' + key + '":', e); }
    },
    getRaw: function (key) {
        try { return _ls.getItem(key); } catch (e) { console.warn('[DataLayer.getRaw] error for key="' + key + '":', e); return null; }
    },
    setRaw: function (key, value) {
        try { _ls.setItem(key, value); } catch (e) { console.error('[DataLayer.setRaw] FAILED for key="' + key + '":', e); }
    }
};

// ---- 兼容层：将状态挂载到 window 以支持内联事件处理器和未迁移的代码 ----
window.S = S;
window.DataLayer = DataLayer;
window.toggleTimelineSubItems = toggleTimelineSubItems;
window._stagedKey = _stagedKey;
window._clearStagedLogKeys = _clearStagedLogKeys;
window._isItemInCurrentRange = _isItemInCurrentRange;
window.saveToPersistentFile = saveToPersistentFile;
window.requestDataDir = requestDataDir;
window.onPersistentDataReady = onPersistentDataReady;
window._npIsBlankHtml = _npIsBlankHtml;
window._npPlainTextToHtml = _npPlainTextToHtml;
window._npMergeNotepadEditorData = _npMergeNotepadEditorData;
window._npMergeNotepadTitles = _npMergeNotepadTitles;
window.setSaveDataDirHandle = function(h) {
    console.log('[store] setSaveDataDirHandle 被调用, _pendingSavedData:', !!_pendingSavedData);
    _saveDataDirHandle = h;
    if (h) {
        if (!_pendingSavedData) {
            // 先加载 appdata.js，加载成功后再保存
            _tryLoadAppdataFromWorkLogFolder().then(function() {
                console.log('[store] _tryLoadAppdata 完成');
                try { saveToPersistentFile(); } catch (e) {}
            });
        }
    }
};

// 将常用状态也挂载到 window（兼容旧代码中的直接引用）
var _windowStateKeys = [
    'currentYear', 'currentMonth', 'selectedDate', 'reminders',
    'notes', '_noteCategories', '_noteCurrentCategory',
    'notepadData', 'notepadTitles', 'notepadLabels', 'notepadEditorData',
    'notepadFontSizes', 'notepadNotebookStyles', 'currentNotepadTab',
    'notepadVisible', 'notepadTileMode', 'currentTrackMode', 'reportData',
    'colWidths', 'timeRangeType', 'timeRangeStart', 'timeRangeEnd',
    'searchKeyword', 'currentDataFileName', 'categoryList',
    'weekDays', 'statusOrder', 'browserViewableExts',
    '_writeNoteMode', '_materialMode', '_materialActiveTab',
    'tileVisible', 'trackFilterState', 'workLogExportMode',
    '_showAllRecords', 'timelineShowSubItems', 'pageViewFilterDateKey',
    'editingRowIndex', 'editingDateKey', 'currentAttachments',
    'resizingCol', 'startX', 'startWidth',
    'datePickerYear', 'datePickerMonth', 'datePickerTarget',
    'customPickerTarget', 'customPickerMode',
    'currentSortCol', 'currentSortDir', 'contextMenuTarget',
    '_stagedLogKeys', '_deferLogRefresh',
    '_notepadInitialBounds', '_materialBgColor', '_materialFullscreen',
    '_materialSplitRatio', '_materialAssistZoomMap', '_materialAssistZoom',
    '_materialSavedArticlePs', '_notepadTabScrollTop',
    '_notepadOutlineWasOpen', '_notepadWorkHidden',
    '_writeNoteArticleDirty', '_enterSplitInfo', '_autoFormatEnabled',
    '_tileSplitDivider', '_stackSplitDivider', '_stackActiveTab',
    '_editingAttachIndex', 'currentDetailAttachments', '_pageViewCtxEntry',
    '_materialNoteTab', '_materialSearchMatches', '_materialSearchIndex',
    '_materialSearchOriginal'
];

_windowStateKeys.forEach(function (key) {
    Object.defineProperty(window, key, {
        get: function () { return S[key]; },
        set: function (v) { S[key] = v; },
        configurable: true,
        enumerable: true
    });
});
