/* format-standard.js — 公文排版基准（FORMAT_STANDARD）
   从 problem-analysis.js 抽出的纯数据 + 样式函数，编辑器模块已移除，
   但 notepad.js 的自动格式 / 层级排版全部依赖它，故单独成文件。 */

(function() {
        var LEVEL_ORDER = { 'level-title': 0, 'level-date': 0.5, 'level-author': 0.6, 'level-recipient': 0.7, 'level-secret': 0.8, 'level-attachment': 0.9, 'level-1': 1, 'level-2': 2, 'level-3': 3, 'level-body': 4 };
        var HEADING_LEVELS = { 'level-title': true, 'level-1': true, 'level-2': true, 'level-3': true };
        var FORMAT_STANDARD = { };
        window.FORMAT_STANDARD = FORMAT_STANDARD;
        Object.assign(FORMAT_STANDARD, {
            lineHeight: '1.8', margin: '0',
            levels: {
                'level-title':    { fontFamily:'方正小标宋简体,FZXiaoBiaoSong,SimSun,serif', fontSize:'20px', fontWeight:'', textAlign:'center', textIndent:'0', bg:'' },
                'level-index':    { fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'0', bg:'' },
                'level-date':     { fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'16px', fontWeight:'', textAlign:'center', textIndent:'0', bg:'' },
                'level-author':   { fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'16px', fontWeight:'', textAlign:'center', textIndent:'0', bg:'' },
                'level-recipient':{ fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'0', bg:'' },
                    'level-secret':   { fontFamily:'黑体,SimHei,sans-serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'0', bg:'' },
                'level-attachment': { fontFamily:'仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'2em', bg:'' },
                'level-1':        { fontFamily:'黑体,SimHei,sans-serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'2em', bg:'' },
                'level-2':        { fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'2em', bg:'' },
                'level-3':        { fontFamily:'仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif', fontSize:'16px', fontWeight:'bold', textAlign:'left', textIndent:'2em', bg:'' },
                'level-body':     { fontFamily:'仿宋_GB2312,FangSong_GB2312,仿宋,FangSong,serif', fontSize:'16px', fontWeight:'', textAlign:'left', textIndent:'2em', bg:'' },
                'level-remark':   { fontFamily:'楷体_GB2312,KaiTi_GB2312,KaiTi,楷体,serif', fontSize:'14px', fontWeight:'', textAlign:'left', textIndent:'0', bg:'' },
                'level-regulation-chapter': { fontFamily:'黑体,SimHei,sans-serif', fontSize:'16px', fontWeight:'', textAlign:'center', textIndent:'0', bg:'' },
                'level-regulation-section': { fontFamily:'楷体_GB2312,楷体,KaiTi,serif', fontSize:'16px', fontWeight:'', textAlign:'center', textIndent:'0', bg:'' }
            },
            inlineStyle: function(lv) {
                var c = this.levels[lv] || this.levels['level-body'];
                var _generic = { serif:1, 'sans-serif':1, monospace:1, cursive:1, fantasy:1, 'system-ui':1 };
                var ff = c.fontFamily.split(',').map(function(f) { var t = f.trim(); return !_generic[t] && t.indexOf("'") === -1 && t.indexOf('"') === -1 ? "'" + t + "'" : t; }).join(',');
                var s = 'font-family:' + ff + ';font-size:' + c.fontSize + ';';
                if (c.fontWeight) s += 'font-weight:' + c.fontWeight + ';';
                else s += 'font-weight:normal;';
                return s;
            },
            paraStyle: function(lv) {
                var c = this.levels[lv] || this.levels['level-body'];
                var s = 'margin:' + this.margin + ';line-height:' + this.lineHeight + ';text-indent:' + c.textIndent + ';text-align:' + c.textAlign + ';';
                s += 'content-visibility:auto;contain:layout style;';
                return s;
            },
            fullStyle: function(lv) {
                return this.paraStyle(lv) + this.inlineStyle(lv);
            }
        });
})();
