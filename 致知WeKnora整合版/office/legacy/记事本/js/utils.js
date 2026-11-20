/* ============================================================
   utils.js — 共享工具函数
   ============================================================ */

/**
 * HTML 转义：将文本中的特殊字符转为 HTML 实体
 */
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 显示 Toast 提示消息（2秒自动消失）
 */
function showToast(msg) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function () {
        toast.classList.remove('show');
    }, 2000);
}

/**
 * 切换折叠/展开状态
 */
function toggleExpand(id) {
    var el = document.getElementById(id);
    el.classList.toggle('expanded');
    var btn = el.parentElement.querySelector('.expandBtn');
    if (btn) btn.textContent = el.classList.contains('expanded') ? '… 收起' : '…';
}

// ---- 挂载到 window ----
window.escapeHtml = escapeHtml;
window.showToast = showToast;
window.toggleExpand = toggleExpand;
