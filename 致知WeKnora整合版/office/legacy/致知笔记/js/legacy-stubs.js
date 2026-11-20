/* ============================================================
   legacy-stubs.js — 日志模块遗留弹窗的空实现
   本程序不提供工作日志 / 日历 / 备忘 / 通讯录版块，
   但 HTML 中保留了少量源程序弹窗（编辑记录、子项状态、日期选择等）。
   这些弹窗不被两个版块的核心流程调用，此处统一置空，避免点击时报错。
   ============================================================ */

(function () {
    var names = [
        '_onAttachPathInput', '_tsQuickDate', '_tsQuickTime',
        'applySubItemWeekAction', 'attachPick', 'autoRenumberEditContent',
        'closeAttachDetail', 'closeDatePicker', 'closeEditModal',
        'closeSubItemStatusModal', 'closeSubItemTsEditor', 'closeTrackFilterModal',
        'closeWeekPopups', 'confirmSubItemStatus', 'confirmSubItemTsEditor',
        'confirmTrackFilter', 'datePickerChangeMonth', 'exportSubItemStatusDoc',
        'handleAttachAction', 'handleEditStatusChange', 'onWeekLinkSelectChange',
        'openDatePicker', 'saveEditModal', 'setSubItemWeekMode',
        'showWeekWorkPopup', 'sortSubItemStatus', 'toggleEndTimeAuto',
        'toggleWeekWorkPopup', 'loadDataFile'
    ];

    function hideModal(id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('show');
    }

    for (var i = 0; i < names.length; i++) {
        (function (name) {
            if (typeof window[name] === 'function') return;
            window[name] = function () { return false; };
        })(names[i]);
    }

    /* 少数需要「关闭」语义的，做成真关闭而不是纯空函数 */
    window.closeEditModal = function () { hideModal('editModal'); };
    window.closeSubItemStatusModal = function () { hideModal('subItemStatusModal'); };
    window.closeSubItemTsEditor = function () { hideModal('subItemTsModal'); };
    window.closeTrackFilterModal = function () { hideModal('trackFilterModal'); };
    window.closeAttachDetail = function () { hideModal('attachDetailModal'); };
    window.closeDatePicker = function () { hideModal('datePickerModal'); };
    window.closeWeekPopups = function () {
        hideModal('editWeekPopup');
        hideModal('weekWorkPopup');
    };
})();
