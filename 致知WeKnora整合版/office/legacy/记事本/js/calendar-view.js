/* ============================================================
   calendar-view.js — 日历渲染与日期选择
   ============================================================ */

function renderCalendar() {
    var title = document.getElementById('calendarTitle');
    title.textContent = S.currentYear + '年' + (S.currentMonth + 1) + '月';
    var daysContainer = document.getElementById('calendarDays');
    daysContainer.innerHTML = '';
    var firstDay = new Date(S.currentYear, S.currentMonth, 1).getDay();
    var daysInMonth = solarDays(S.currentYear, S.currentMonth);
    var daysInPrevMonth = S.currentMonth === 0 ? solarDays(S.currentYear - 1, 11) : solarDays(S.currentYear, S.currentMonth - 1);
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + today.getMonth() + '-' + today.getDate();
    var selectedStr = S.selectedDate.getFullYear() + '-' + S.selectedDate.getMonth() + '-' + S.selectedDate.getDate();
    var dayCount = 1;
    var nextMonthDay = 1;
    var startOffset = firstDay === 0 ? 6 : firstDay - 1;
    for (var i = 0; i < 42; i++) {
        var cell = document.createElement('div');
        cell.className = 'dayCell';
        var year, month, day, isOtherMonth = false;
        if (i < startOffset) { day = daysInPrevMonth - startOffset + i + 1; year = S.currentMonth === 0 ? S.currentYear - 1 : S.currentYear; month = S.currentMonth === 0 ? 11 : S.currentMonth - 1; isOtherMonth = true; }
        else if (dayCount <= daysInMonth) { day = dayCount++; year = S.currentYear; month = S.currentMonth; }
        else { day = nextMonthDay++; year = S.currentMonth === 11 ? S.currentYear + 1 : S.currentYear; month = S.currentMonth === 11 ? 0 : S.currentMonth + 1; isOtherMonth = true; }
        var cellDateStr = year + '-' + month + '-' + day;
        var isToday = cellDateStr === todayStr;
        var isSelected = cellDateStr === selectedStr;
        var actualDayOfWeek = new Date(year, month, day).getDay();
        var isWeekend = actualDayOfWeek === 0 || actualDayOfWeek === 6;
        var key = getDateKeyFor(year, month, day);
        var hasReminder = S.reminders.some(function (r) { return r.date === key; });
        var holiday = getHoliday(year, month, day);
        if (isOtherMonth) cell.classList.add('otherMonth');
        if (isToday) cell.classList.add('today');
        if (isSelected) cell.classList.add('selected');
        if (isWeekend) cell.classList.add('weekend');
        if (hasReminder && !isToday) cell.classList.add('hasReminder');
        if (holiday && holiday.type === 'holiday' && !isToday && !hasReminder) cell.classList.add('isHoliday');
        if (holiday && holiday.type === 'workday' && !isToday && !hasReminder) cell.classList.add('isWorkday');
        var lunar = solar2lunar(year, month, day);
        var festival = getFestival(year, month, day, lunar);
        var dayNum = document.createElement('div'); dayNum.className = 'dayNum'; dayNum.textContent = day;
        var lunarDay = document.createElement('div'); lunarDay.className = 'lunarDay';
        if (holiday) { lunarDay.textContent = holiday.name; lunarDay.classList.add('festival'); }
        else if (festival) { lunarDay.textContent = festival; lunarDay.classList.add('festival'); }
        else if (lunar) { lunarDay.textContent = lunar.dayStr; }
        cell.appendChild(dayNum); cell.appendChild(lunarDay);
        // 工作日志模式下的"+"按钮（hover显示）
        var addBtn = document.createElement('div');
        addBtn.className = 'dayCellAddBtn';
        addBtn.textContent = '+';
        addBtn.title = '新增日志';
        (function (y, m, d) {
            addBtn.onclick = function (e) {
                e.stopPropagation();
                if (typeof addEntryForDate === 'function') {
                    addEntryForDate(y, m, d);
                }
            };
        })(year, month, day);
        cell.appendChild(addBtn);
        (function (y, m, d, cellEl) {
            var clickTimer = null;
            cellEl.onclick = function () {
                // 延迟执行单击，给双击留出判定时间：双击时取消单击处理。
                if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }
                clickTimer = setTimeout(function () {
                    clickTimer = null;
                    selectDate(y, m, d);
                }, 240);
            };
            cellEl.ondblclick = function () {
                if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
                // 双击用于新增/编辑备忘，只同步选中日期，不切换日志时间范围。
                selectDateKeepView(y, m, d);
                var dk = getDateKeyFor(y, m, d);
                var existing = S.reminders.filter(function (r) { return r.date === dk; });
                if (existing.length > 0) showReminderEdit(existing[0].id);
                else showAddReminderModal(dk);
            };
        })(year, month, day, cell);
        daysContainer.appendChild(cell);
    }
}

function selectDate(year, month, day) {
    S.selectedDate = new Date(year, month, day);
    renderCalendar();
    renderReminders(true);
    // 注意：点击日期只更新选中日期与备忘区，不改写顶部时间范围显示，也不联动切换工作日志视图。
    // 日志视图仍由顶部时间范围选择器和日历格子的"+"按钮控制，避免周工作页被切成日视图。
}

// 只更新选中日期，不改变日志时间范围/视图模式（供双击备忘等场景使用）
function selectDateKeepView(year, month, day) {
    S.selectedDate = new Date(year, month, day);
    renderCalendar();
    renderReminders(true);
}

function changeMonth(delta) {
    S.currentMonth += delta;
    if (S.currentMonth < 0) { S.currentMonth = 11; S.currentYear--; }
    else if (S.currentMonth > 11) { S.currentMonth = 0; S.currentYear++; }
    renderCalendar();
}

function goToday() {
    var today = new Date();
    S.currentYear = today.getFullYear();
    S.currentMonth = today.getMonth();
    S.selectedDate = new Date(today);
    initTimeRange();
    renderCalendar();
    renderReminders(true);
    renderTrackContent();
}

function getDateKey() {
    return getDateKeyFor(S.selectedDate.getFullYear(), S.selectedDate.getMonth(), S.selectedDate.getDate());
}

function getDateKeyFor(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// ---- 导出 ----
// ---- 挂载到 window ----
window.renderCalendar = renderCalendar;
window.selectDate = selectDate;
window.selectDateKeepView = selectDateKeepView;
window.changeMonth = changeMonth;
window.goToday = goToday;
window.getDateKey = getDateKey;
window.getDateKeyFor = getDateKeyFor;
