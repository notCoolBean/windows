var lunarInfo = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520
];

var solarMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

var tianGan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
var diZhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
var animals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
var lunarMonthName = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
var lunarDayName = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
                     '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                     '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

var solarFestivals = {
    '1-1': '元旦', '2-14': '情人节', '3-8': '妇女节', '3-12': '植树节', '4-1': '愚人节',
    '5-1': '劳动节', '5-4': '青年节', '6-1': '儿童节', '7-1': '建党节', '8-1': '建军节',
    '9-10': '教师节', '10-1': '国庆节', '12-24': '平安夜', '12-25': '圣诞节'
};

var lunarFestivals = {
    '1-1': '春节', '1-15': '元宵节', '5-5': '端午节', '7-7': '七夕', '7-15': '中元节',
    '8-15': '中秋节', '9-9': '重阳节', '12-8': '腊八节'
};

var holidays = {
    '2025-1-1': '元旦',
    '2025-1-28': '春节', '2025-1-29': '春节', '2025-1-30': '春节', '2025-1-31': '春节',
    '2025-2-1': '春节', '2025-2-2': '春节', '2025-2-3': '春节', '2025-2-4': '春节',
    '2025-4-4': '清明', '2025-4-5': '清明', '2025-4-6': '清明',
    '2025-5-1': '劳动节', '2025-5-2': '劳动节', '2025-5-3': '劳动节', '2025-5-4': '劳动节', '2025-5-5': '劳动节',
    '2025-5-31': '端午', '2025-6-1': '端午', '2025-6-2': '端午',
    '2025-10-1': '国庆', '2025-10-2': '国庆', '2025-10-3': '国庆', '2025-10-4': '国庆',
    '2025-10-5': '国庆', '2025-10-6': '中秋', '2025-10-7': '国庆', '2025-10-8': '国庆',

    '2026-1-1': '元旦', '2026-1-2': '元旦', '2026-1-3': '元旦',
    '2026-2-15': '春节', '2026-2-16': '春节', '2026-2-17': '春节', '2026-2-18': '春节',
    '2026-2-19': '春节', '2026-2-20': '春节', '2026-2-21': '春节', '2026-2-22': '春节', '2026-2-23': '春节',
    '2026-4-4': '清明', '2026-4-5': '清明', '2026-4-6': '清明',
    '2026-5-1': '劳动节', '2026-5-2': '劳动节', '2026-5-3': '劳动节', '2026-5-4': '劳动节', '2026-5-5': '劳动节',
    '2026-6-19': '端午', '2026-6-20': '端午', '2026-6-21': '端午',
    '2026-9-25': '中秋', '2026-9-26': '中秋', '2026-9-27': '中秋',
    '2026-10-1': '国庆', '2026-10-2': '国庆', '2026-10-3': '国庆', '2026-10-4': '国庆',
    '2026-10-5': '国庆', '2026-10-6': '国庆', '2026-10-7': '国庆'
};

var workdays = {
    '2025-1-26': '调休', '2025-2-8': '调休', '2025-4-27': '调休',
    '2025-9-28': '调休', '2025-10-11': '调休',

    '2026-1-4': '调休', '2026-2-14': '调休', '2026-2-28': '调休',
    '2026-5-9': '调休', '2026-9-20': '调休', '2026-10-10': '调休'
};

function lYearDays(y) {
    var sum = 348;
    for (var i = 0x8000; i > 0x8; i >>= 1) {
        sum += (lunarInfo[y - 1900] & i) ? 1 : 0;
    }
    return sum + leapDays(y);
}

function leapMonth(y) {
    return lunarInfo[y - 1900] & 0xf;
}

function leapDays(y) {
    if (leapMonth(y)) {
        return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29;
    }
    return 0;
}

function monthDays(y, m) {
    return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29;
}

// m 0-indexed (0=Jan..11=Dec)
function solarDays(y, m) {
    if (m === 1) {
        return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : 28;
    }
    return solarMonth[m];
}

// m 0-indexed
function solar2lunar(y, m, d) {
    if (y < 1900 || y > 2100) return null;
    var target = Date.UTC(y, m, d);
    var base = Date.UTC(1900, 0, 31);
    var offset = Math.floor((target - base) / 86400000);
    if (offset < 0) return null;

    var lunarY = 1900;
    while (lunarY <= 2100) {
        var yd = lYearDays(lunarY);
        if (offset < yd) break;
        offset -= yd;
        lunarY++;
    }

    var leap = leapMonth(lunarY);
    var isLeap = false;
    var lunarM = 1;
    var daysInMonth = 0;

    while (lunarM <= 12) {
        daysInMonth = monthDays(lunarY, lunarM);
        if (offset < daysInMonth) {
            isLeap = false;
            break;
        }
        offset -= daysInMonth;
        if (lunarM === leap) {
            daysInMonth = leapDays(lunarY);
            if (offset < daysInMonth) {
                isLeap = true;
                break;
            }
            offset -= daysInMonth;
        }
        lunarM++;
    }

    var lunarD = offset + 1;

    return {
        year: lunarY,
        month: lunarM,
        day: lunarD,
        isLeap: isLeap,
        monthStr: (isLeap ? '闰' : '') + lunarMonthName[lunarM - 1] + '月',
        dayStr: lunarDayName[lunarD - 1],
        ganZhi: tianGan[(lunarY - 4) % 10] + diZhi[(lunarY - 4) % 12],
        animal: animals[(lunarY - 4) % 12]
    };
}

function getFestival(y, m, d, lunar) {
    var solarKey = (m + 1) + '-' + d;
    if (solarFestivals[solarKey]) return solarFestivals[solarKey];

    if (lunar && !lunar.isLeap) {
        var lunarKey = lunar.month + '-' + lunar.day;
        if (lunarFestivals[lunarKey]) return lunarFestivals[lunarKey];
        if (lunar.month === 12 && lunar.day === monthDays(lunar.year, 12)) return '除夕';
        if (lunar.day === 1) return lunar.monthStr;
    }
    return null;
}

function getHoliday(y, m, d) {
    var key = y + '-' + (m + 1) + '-' + d;
    if (holidays[key]) return { type: 'holiday', name: holidays[key] };
    if (workdays[key]) return { type: 'workday', name: workdays[key] };
    return null;
}
