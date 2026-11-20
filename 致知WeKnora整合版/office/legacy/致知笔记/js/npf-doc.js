/* 致知笔记 · 预览栏「本地」页：.doc（Word 97-2003，OLE 复合文档）解析
   从 10--谈话助手 脚本/js/parse.js 抽取，仅保留 OLE 二进制解析与富文本块还原，
   工具生成，勿手改。重建需带回：textScore / cleanDocText / OLE 全段 / sigOf / docMainText。
   对外只暴露 window.NpfDoc 三个方法。 */
(function () {
  'use strict';
  const TZ = window.TZ || (window.TZ = {});
  if (!TZ.esc) TZ.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  };

  function textScore(text) {
    let score = 0;
    ['谈话', '笔录', '记录', '问：', '答：', '时间', '姓名', '性别', '内容'].forEach(function (k) {
      if (text.indexOf(k) >= 0) score += 20;
    });
    if (score === 0) {
      let cjk = 0;
      for (let i = 0; i < text.length && i < 4000; i++) {
        const c = text.charCodeAt(i);
        if (c >= 0x4e00 && c <= 0x9fff) cjk++;
      }
      score = Math.min(cjk / 10, 15);
    } else {
      score += Math.min(text.length / 5000, 10);
    }
    if (text.indexOf('\uFFFD') >= 0) score -= 30;
    return score;
  }

  /* ---------- OLE 复合文档（.doc / .xls 的容器） ----------
     Word 97-2003 是「WordDocument 流 + 0Table/1Table 流」：正文位置和编码记在
     piece table（CLX）里，不在流的开头。之前按固定偏移扫全文，正文字符和
     字体表、页脚碎片混在一起，评分一乱就挑中碎片（表现为乱码）。 */
  const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

  function isOleBytes(bytes) {
    if (!bytes || bytes.length < 512) return false;
    for (let i = 0; i < 8; i++) { if (bytes[i] !== OLE_MAGIC[i]) return false; }
    return true;
  }

  function readOle(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const u16 = function (off) { return b[off] | (b[off + 1] << 8); };
    const u32 = function (off) {
      return (b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24)) >>> 0;
    };
    const ss = 1 << u16(0x1e);
    if (!ss || ss > 65536) return null;
    const miniSize = 1 << u16(0x20);
    const numFat = u32(0x2c);
    const dirStart = u32(0x30);
    const miniCut = u32(0x38);
    const miniFatStart = u32(0x3c);
    const difStart = u32(0x44);
    const numDif = u32(0x48);
    const END = 0xfffffffa;

    const sector = function (n) {
      const off = (n + 1) * ss;
      return b.subarray(off, Math.min(off + ss, b.length));
    };
    /* FAT 扇区号：头里先放 109 个，不够的去 DIFAT 链里继续取 */
    const fatSectors = [];
    for (let i = 0; i < 109 && fatSectors.length < numFat; i++) {
      const v = u32(0x4c + i * 4);
      if (v < END) fatSectors.push(v);
    }
    let dif = difStart;
    let guardDif = 0;
    while (dif < END && fatSectors.length < numFat && guardDif++ < 1024) {
      const s = sector(dif);
      const n = Math.floor(ss / 4) - 1;
      for (let i = 0; i < n && fatSectors.length < numFat; i++) {
        const v = s[i * 4] | (s[i * 4 + 1] << 8) | (s[i * 4 + 2] << 16) | (s[i * 4 + 3] << 24);
        if ((v >>> 0) < END) fatSectors.push(v >>> 0);
      }
      const last = ss - 4;
      dif = (s[last] | (s[last + 1] << 8) | (s[last + 2] << 16) | (s[last + 3] << 24)) >>> 0;
    }
    const fat = [];
    fatSectors.forEach(function (sn) {
      const s = sector(sn);
      for (let i = 0; i + 4 <= s.length; i += 4) {
        fat.push((s[i] | (s[i + 1] << 8) | (s[i + 2] << 16) | (s[i + 3] << 24)) >>> 0);
      }
    });
    const chain = function (start) {
      const out = [];
      let n = start;
      let guard = 0;
      while (n < END && guard++ < 100000) { out.push(n); n = fat[n]; }
      return out;
    };
    const readStream = function (start, size) {
      const parts = chain(start).map(sector);
      let len = 0;
      parts.forEach(function (p) { len += p.length; });
      const out = new Uint8Array(len);
      let at = 0;
      parts.forEach(function (p) { out.set(p, at); at += p.length; });
      return out.slice(0, Math.min(size, len));
    };

    const dirParts = chain(dirStart).map(sector);
    let dirLen = 0;
    dirParts.forEach(function (p) { dirLen += p.length; });
    const dir = new Uint8Array(dirLen);
    let at = 0;
    dirParts.forEach(function (p) { dir.set(p, at); at += p.length; });
    const du32 = function (o) {
      return (dir[o] | (dir[o + 1] << 8) | (dir[o + 2] << 16) | (dir[o + 3] << 24)) >>> 0;
    };
    const entries = {};
    let root = null;
    for (let i = 0; i + 128 <= dir.length; i += 128) {
      const nameLen = dir[i + 64] | (dir[i + 65] << 8);
      if (!nameLen) continue;
      /* 目录项名字是 UTF-16LE（含结尾 0），按 16 位逐个读 */
      let name = '';
      for (let k = 0; k + 1 < nameLen - 2 && k + 1 < 64; k += 2) {
        const c = dir[i + k] | (dir[i + k + 1] << 8);
        if (!c) break;
        name += String.fromCharCode(c);
      }
      const item = {
        name: name,
        type: dir[i + 66],
        start: du32(i + 116),
        size: du32(i + 120)
      };
      if (item.type === 5) root = item;
      if (item.name) entries[item.name] = item;
    }

    /* 小于 miniCut 的流在 mini stream 里（Root Entry 的流按 64 字节切片） */
    let miniFat = null;
    if (miniFatStart < END) {
      const mf = readStream(miniFatStart, 0x7fffffff);
      miniFat = [];
      for (let i = 0; i + 4 <= mf.length; i += 4) {
        miniFat.push((mf[i] | (mf[i + 1] << 8) | (mf[i + 2] << 16) | (mf[i + 3] << 24)) >>> 0);
      }
    }
    const miniStream = root ? readStream(root.start, root.size) : null;
    const readMini = function (start, size) {
      const out = [];
      let n = start;
      let guard = 0;
      while (n < END && guard++ < 100000 && miniFat) {
        out.push(miniStream.subarray(n * miniSize, n * miniSize + miniSize));
        n = miniFat[n];
      }
      let len = 0;
      out.forEach(function (p) { len += p.length; });
      const buf = new Uint8Array(len);
      let off = 0;
      out.forEach(function (p) { buf.set(p, off); off += p.length; });
      return buf.slice(0, Math.min(size, len));
    };

    return {
      entries: entries,
      read: function (name) {
        const e = entries[name];
        if (!e) return null;
        if (e.size < miniCut) return readMini(e.start, e.size);
        return readStream(e.start, e.size);
      }
    };
  }

  /* ---------- DOC（Word 97-2003）----------
     优先级：OLE piece table（准确）→ 老办法扫全文（残缺文件兜底）。 */
  function docPieceText(ole) {
    const wd = ole.read('WordDocument');
    if (!wd || wd.length < 0x200) return null;
    const u16 = function (o) { return wd[o] | (wd[o + 1] << 8); };
    const u32 = function (o) {
      return (wd[o] | (wd[o + 1] << 8) | (wd[o + 2] << 16) | (wd[o + 3] << 24)) >>> 0;
    };
    if (u16(0) !== 0xa5ec) return null;
    const flags = u16(0x0a);
    const tableName = (flags & 0x0200) ? '1Table' : '0Table';
    const tbl = ole.read(tableName) || ole.read(tableName === '0Table' ? '1Table' : '0Table');
    if (!tbl) return null;

    /* FibRgFcLcb97：fibBase(32) + csw(2) + rgw(28) + cslw(2) + rglw(88) + cbRgFcLcb(2)，
       fcClx 是第 33 对（0 起算） */
    const base = 32 + 2 + 28 + 2 + 88 + 2;
    if (wd.length < base + 34 * 8) return null;
    const fcClx = u32(base + 33 * 8);
    const lcbClx = u32(base + 33 * 8 + 4);
    if (!lcbClx || fcClx + lcbClx > tbl.length) return null;

    let p = fcClx;
    const end = fcClx + lcbClx;
    let plc = null;
    while (p + 1 < end) {
      const kind = tbl[p];
      if (kind === 0x01) {
        if (p + 3 > end) break;
        const cb = tbl[p + 1] | (tbl[p + 2] << 8);
        p += 3 + cb;
      } else if (kind === 0x02) {
        if (p + 5 > end) break;
        const lcb = (tbl[p + 1] | (tbl[p + 2] << 8) | (tbl[p + 3] << 16) | (tbl[p + 4] << 24)) >>> 0;
        plc = tbl.subarray(p + 5, Math.min(p + 5 + lcb, end));
        break;
      } else {
        break;
      }
    }
    if (!plc || plc.length < 16) return null;
    const pieces = (plc.length - 4) / 12;
    if (!(pieces >= 1)) return null;
    const pu32 = function (o) {
      return (plc[o] | (plc[o + 1] << 8) | (plc[o + 2] << 16) | (plc[o + 3] << 24)) >>> 0;
    };
    const cpAt = function (i) { return pu32(i * 4); };
    const dec = new TextDecoder('gbk');
    let out = '';
    for (let i = 0; i < pieces; i++) {
      const cpStart = cpAt(i);
      const cpEnd = cpAt(i + 1);
      if (cpEnd <= cpStart) continue;
      const off = (pieces + 1) * 4 + i * 8;
      if (off + 8 > plc.length) break;
      const fcRaw = pu32(off);
      const compressed = (fcRaw & 0x40000000) !== 0;
      const fc = fcRaw & 0x3fffffff;
      const chars = cpEnd - cpStart;
      if (compressed) {
        /* 压缩 piece：每字符 1 字节，fc 是「字节偏移 × 2」 */
        const from = Math.floor(fc / 2);
        const raw = wd.subarray(from, Math.min(from + chars, wd.length));
        out += dec.decode(raw);
      } else {
        const from = fc;
        const raw = wd.subarray(from, Math.min(from + chars * 2, wd.length));
        let s = '';
        for (let k = 0; k + 1 < raw.length; k += 2) s += String.fromCharCode(raw[k] | (raw[k + 1] << 8));
        out += s;
      }
    }
    return cleanDocText(out);
  }

  /* 域代码 / 图片占位 / 单元格标记 → 正常空白 */
  function cleanDocText(raw) {
    if (!raw) return null;
    const out = String(raw).replace(/[\u0000-\u0008\u000b-\u001f]/g, function (c) {
      if (c === '\u0007') return '\t';
      if (c === '\u000d' || c === '\u000a') return '\n';
      return '';
    }).replace(/\t+\n/g, '\n');
    return out.trim() ? out : null;
  }

  /* ---------- DOC 富格式（FKP + SPRM）----------
     纯文本只能给出文字，样式全丢。Word 97 的字符/段落属性存在 CHPX / PAPX 里：
     PlcfbteChpx(12) / PlcfbtePapx(13) 指向 FKP 页，页里按 fc 分 run，每个 run
     带一串 SPRM。这里解析成与 .docx 相同的 {para, runs} 块结构，交给 docview 渲染。

     有意不解析 STSH 样式表：WPS 导出的文件里 cbStd 的字节语义与规范不符，
     cupx>0 时还跟一段 UPX，边界不稳。直接格式（FKP）已经覆盖字号/字体/粗体/
     下划线/颜色/对齐/缩进/行距，对预览足够。 */

  const SPRA_LEN = [1, 1, 2, 4, 2, 2, 0, 0];

  /* SPRM 操作数长度：低 3 位不是 spra，要用 (sprm >> 13) & 7。
     spra=6 是变长：CHPX 里 1 字节 cb，PAPX 里 2 字节。 */
  function readSprms(buf, chopx) {
    const out = [];
    let i = 0;
    while (i + 1 < buf.length) {
      const sprm = buf[i] | (buf[i + 1] << 8);
      const spra = (sprm >> 13) & 0x7;
      let len = SPRA_LEN[spra];
      let start = i + 2;
      if (spra === 6) {
        if (chopx) { len = buf[start]; start += 1; }
        else { len = buf[start] | (buf[start + 1] << 8); start += 2; }
      }
      if (len > 0x8000 || start + len > buf.length) break;
      out.push({ op: sprm, val: buf.subarray(start, start + len) });
      i = start + len;
    }
    return out;
  }

  /* SPRM 表：只保留预览用得到的那些 */
  function readChpx(sprms) {
    const r = {};
    sprms.forEach(function (s) {
      const v = s.val;
      switch (s.op) {
        case 0x4a43: /* sprmCHps：半磅 */
          if (v.length >= 2) r.size = (v[0] | (v[1] << 8)) / 2;
          break;
        case 0x4a4f: /* CRgFtc0 西文 */
          if (v.length >= 2) r.ftcAscii = v[0] | (v[1] << 8);
          break;
        case 0x4a50: /* CRgFtc1 中文 */
          if (v.length >= 2) r.ftcEast = v[0] | (v[1] << 8);
          break;
        case 0x4a51: /* CRgFtc2 复杂文种 */
          if (v.length >= 2) r.ftcOther = v[0] | (v[1] << 8);
          break;
        case 0x2A3E: /* sprmCKul：下划线类型 */
          if (v[0] === 1) r.underline = true;
          break;
        case 0x2A42: /* sprmCFDStrike：删除线 */
          if (v[0] === 1) r.strike = true;
          break;
        case 0x4b48: /* sprmCFBold */
          if (v[0] === 1 || v[0] === 0x81) r.bold = true;
          break;
        case 0x4b49: /* sprmCFItalic */
          if (v[0] === 1 || v[0] === 0x81) r.italic = true;
          break;
        case 0x6870: /* sprmCCv：真实色值（Word 97 里是 COLORREF 4 字节） */
          if (v.length >= 4) {
            const n = v[0] | (v[1] << 8) | (v[2] << 16) | (v[3] << 24);
            const auto = (n & 0xff000000) !== 0;
            if (!auto && !(v[0] === 0 && v[1] === 0 && v[2] === 0 && v[3] === 0xff)) {
              const hex = function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); };
              r.color = '#' + hex(n) + hex(n >> 8) + hex(n >> 16);
            }
          } else if (v.length === 1) {
            const tbl = [null, '#000000', '#0000ff', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#ffff00', '#ffffff'];
            if (tbl[v[0]]) r.color = tbl[v[0]];
          }
          break;
        case 0x2052: /* sprmCIco：颜色索引 */
          if (v[0] === 0) r.color = '#000000';
          else if (v[0] === 1) r.color = '#0000ff';
          else if (v[0] === 2) r.color = '#00ffff';
          else if (v[0] === 3) r.color = '#00ff00';
          else if (v[0] === 4) r.color = '#ff00ff';
          else if (v[0] === 5) r.color = '#ff0000';
          else if (v[0] === 6) r.color = '#ffff00';
          else if (v[0] === 7) r.color = '#ffffff';
          break;
        case 0x4a54: /* sprmCCv：真实色值（COLORREF，0x00BBGGRR） */
          if (v.length >= 4) {
            const n = v[0] | (v[1] << 8) | (v[2] << 16) | (v[3] << 24);
            const auto = (n & 0xff000000) !== 0;
            if (!auto) {
              const hex = function (x) { return ('0' + x.toString(16)).slice(-2); };
              r.color = '#' + hex(n & 0xff) + hex((n >> 8) & 0xff) + hex((n >> 16) & 0xff);
            }
          }
          break;
        case 0x0835: if (v[0] === 1) r.bold = true; break;
        case 0x0836: if (v[0] === 1) r.italic = true; break;
        default: break;
      }
    });
    return r;
  }

  function twipPx(t) { return t / 15; }

  function readPapx(sprms) {
    const p = {};
    sprms.forEach(function (s) {
      const v = s.val;
      const u16v = v.length >= 2 ? (v[0] | (v[1] << 8)) : 0;
      switch (s.op) {
        case 0x2403: /* sprmPJc：0左 1中 2右 3两端 */
        case 0x2461: /* sprmPJc80 */
          if (v[0] === 1) p.align = 'center';
          else if (v[0] === 2) p.align = 'right';
          else if (v[0] === 3) p.align = 'both';
          else if (v[0] === 0) p.align = 'left';
          break;
        case 0x2405: /* sprmPDxaLeft：左缩进（twip） */
          if (v.length >= 2) p.indentLeft = (v[0] | (v[1] << 8)) / 15;
          break;
        case 0x8417: /* sprmPDxaLeft：左缩进 */
          if (v.length >= 2) p.indentLeft = (v[0] | (v[1] << 8)) / 15;
          break;
        case 0x845D: /* sprmPDxaLeft80 */
          if (v.length >= 2) p.indentLeft = (v[0] | (v[1] << 8)) / 15;
          break;
        case 0x8418: /* sprmPDxaRight */
          if (v.length >= 2) p.indentRight = (v[0] | (v[1] << 8)) / 15;
          break;
        case 0x2447: /* sprmPDxaLeft1：首行缩进（twip） */
        case 0x8421:
        case 0x8460:
          if (v.length >= 2) {
            const tw = v[0] | (v[1] << 8);
            if (tw) p.indentFirst = tw / 15;
          }
          break;
        case 0x4457: /* sprmPDyaLine：2 字节，值 / 100 = 倍数（200 = 2 倍） */
          if (v.length >= 2) {
            const line = v[0] | (v[1] << 8);
            if (line > 0 && line <= 2000) p.lineHeight = line / 100;
          }
          break;
        case 0x6412: /* sprmPItap：表格缩进层级，与段落行距无关，忽略 */
          break;
        case 0xA413: /* sprmPDyaBefore：段前 */
          if (v.length >= 2) p.spaceBefore = (v[0] | (v[1] << 8)) / 20;
          break;
        case 0xA414: /* sprmPDyaAfter：段后 */
          if (v.length >= 2) p.spaceAfter = (v[0] | (v[1] << 8)) / 20;
          break;
        default: break;
      }
    });
    return p;
  }

  /* PAPX / CHPX 的 FKP 页：PlcfbteChpx(12) / PlcfbtePapx(13) */
  function docFkpPages(wd, tbl, wdU32, idx) {
    const fcAt = wdU32(154 + idx * 8);
    const lcbAt = wdU32(154 + idx * 8 + 4);
    if (!lcbAt || fcAt + lcbAt > tbl.length) return [];
    const cnt = (lcbAt - 4) / 8;
    if (!(cnt >= 1)) return [];
    const u32 = function (o) {
      return (tbl[o] | (tbl[o + 1] << 8) | (tbl[o + 2] << 16) | (tbl[o + 3] << 24)) >>> 0;
    };
    const pages = [];
    for (let k = 0; k < cnt; k++) {
      const a = u32(fcAt + k * 4);
      const b = u32(fcAt + (k + 1) * 4);
      const pn = u32(fcAt + (cnt + 1) * 4 + k * 4);
      pages.push({ fcFirst: a, fcLim: b, pn: pn });
    }
    return pages;
  }

  function readFkpPage(wd, pn) {
    const off = pn * 512;
    if (off + 512 > wd.length) return null;
    return wd.subarray(off, off + 512);
  }

  /* CHPX：rgfc[n+1] 紧跟 rgb[n]（每项 1 字节，值 ×2 是页内偏移） */
  function docChpxRuns(wd, tbl, wdU32) {
    const pages = docFkpPages(wd, tbl, wdU32, 12);
    const runs = [];
    pages.forEach(function (pg) {
      const page = readFkpPage(wd, pg.pn);
      if (!page) return;
      const n = page[511];
      if (!n || n > 100) return;
      const rgbAt = (n + 1) * 4;
      for (let i = 0; i < n; i++) {
        const at = i * 4;
        const fcS = (page[at] | (page[at + 1] << 8) | (page[at + 2] << 16) | (page[at + 3] << 24)) >>> 0;
        const bt = at + 4;
        const fcE = (page[bt] | (page[bt + 1] << 8) | (page[bt + 2] << 16) | (page[bt + 3] << 24)) >>> 0;
        const inner = page[rgbAt + i] * 2;
        if (inner >= 500) continue;
        const cb = page[inner];
        const props = cb ? readChpx(readSprms(page.subarray(inner + 1, inner + 1 + cb), true)) : {};
        runs.push({ fcS: fcS, fcE: fcE, props: props });
      }
    });
    runs.sort(function (a, b) { return a.fcS - b.fcS; });
    return runs;
  }

  /* PAPX：rgbx[n] 每项 13 字节（BxPap），前 4 字节是 pn，后续是 bOffset；
     实际从 page[pn*512] 取 PAPX，第 1 字节是 cb，正文里前 1 字节是 istd。 */
  function docPapxRuns(wd, tbl, wdU32, styles) {
    const pages = docFkpPages(wd, tbl, wdU32, 13);
    const runs = [];
    pages.forEach(function (pg) {
      const page = readFkpPage(wd, pg.pn);
      if (!page) return;
      const n = page[511];
      if (!n || n > 100) return;
      const bxAt = (n + 1) * 4;
      for (let i = 0; i < n; i++) {
        const at = i * 4;
        const fcS = (page[at] | (page[at + 1] << 8) | (page[at + 2] << 16) | (page[at + 3] << 24)) >>> 0;
        const bt = at + 4;
        const fcE = (page[bt] | (page[bt + 1] << 8) | (page[bt + 2] << 16) | (page[bt + 3] << 24)) >>> 0;
        const bx = page[bxAt + i * 13];
        const off = bx * 2;
        if (off >= 500) continue;
        /* PAPX 布局：cb(1B，为 0 时只占 1 字节) + cbData(2B) + istd(1B) + sprms */
        const q = off + (page[off] ? 1 : 1);
        if (q + 3 > 512) continue;
        const cbData = page[q] | (page[q + 1] << 8);
        const istd = page[q + 2];
        const bodyStart = q + 3;
        let props = {};
        if (cbData && bodyStart + cbData <= 512) {
          props = readPapx(readSprms(page.subarray(bodyStart, bodyStart + cbData), false));
        }
        /* 直接格式没写到的，从样式表补（WPS 常把缩进/对齐留在样式里） */
        const style = styles && styles[istd];
        if (style) {
          Object.keys(style.para).forEach(function (k) {
            if (props[k] == null) props[k] = style.para[k];
          });
        }
        runs.push({ fcS: fcS, fcE: fcE, props: props, istd: istd });
      }
    });
    runs.sort(function (a, b) { return a.fcS - b.fcS; });
    return runs;
  }

  /* 字体表 Sttbfffn：每条 cbFfn 后跟 flag/权重/字符集 + xszFfn（UTF-16，含结尾 0） */
  function docFonts(wd, tbl, wdU32) {
    const fc = wdU32(154 + 15 * 8);
    const lcb = wdU32(154 + 15 * 8 + 4);
    if (!lcb || fc + lcb > tbl.length) return [];
    const buf = tbl.subarray(fc, fc + lcb);
    const names = [];
    /* Sttbfffn：cbFfnM1(1B) + cData(2B) + 前 3 字节头，之后每条 cbFfn 后跟名字（UTF-16） */
    let p = 4;
    let guard = 0;
    while (p + 40 < buf.length && guard++ < 256) {
      const cbFfn = buf[p];
      if (!cbFfn || cbFfn === 0xff) break;
      const raw = buf.subarray(p + 40, p + cbFfn + 1);
      let name = '';
      for (let k = 0; k + 1 < raw.length; k += 2) {
        const c = raw[k] | (raw[k + 1] << 8);
        if (!c) break;
        name += String.fromCharCode(c);
      }
      names.push(name);
      p += cbFfn + 1;
    }
    return names;
  }

  /* 样式表 STSH：只需要 istd → 段落属性的映射（WPS 常把首行缩进、对齐放样式里）。
     递推不可靠（cbStd 的字节语义与规范不一致），改用「扫描名字位置反推起点」：
     xstzName 固定在 STD 起点 +16，所以起点 = 名字位置 - 18。 */
  function docStyles(tbl, wdU32) {
    /* FibRgFcLcb 里 Stshf 是第 1 对（第 0 对是 StshfOrig） */
    const fc = wdU32(154 + 1 * 8);
    const lcb = wdU32(154 + 1 * 8 + 4);
    if (!lcb || fc + lcb > tbl.length) return null;
    const stsh = tbl.subarray(fc, fc + lcb);
    const u16 = function (b, o) { return b[o] | (b[o + 1] << 8); };

    /* 先扫出所有 (istd, 名字位置) */
    const found = [];
    const scanFrom = Math.min(64, stsh.length);
    for (let p = scanFrom; p + 4 < stsh.length; p++) {
      const cch = u16(stsh, p);
      if (!cch || cch > 30) continue;
      const end = p + 2 + cch * 2;
      if (end + 2 > stsh.length) continue;
      if (stsh[end] !== 0 || stsh[end + 1] !== 0) continue;
      let name = '';
      let ok = true;
      for (let k = 0; k < cch; k++) {
        const c = u16(stsh, p + 2 + k * 2);
        if (c < 0x20 || c === 0xfffd) { ok = false; break; }
        name += String.fromCharCode(c);
      }
      if (!ok || !name) continue;
      found.push({ nameAt: p, name: name });
    }

    const map = {};
    found.forEach(function (f) {
      const start = f.nameAt - 20;
      if (start < 0 || start + 2 > stsh.length) return;
      const sti = u16(stsh, start + 2);
      const istd = sti & 0x0fff;
      const stk = (sti >> 12) & 0x0f;
      /* stk: 1=段落，2=字符；其余（含 0）按段落处理 */
      if (stk === 2) return;
      const map1 = { istd: istd, name: f.name, para: {} };
      /* STD 里名字之后是 UPX 数组：cch 后紧接着 2 字节 0，再按 cupx 个 UPX。
         直接用 readSprms 扫整段尾部的 PAPX 结构（cb 2B + sprms）。 */
      const tail = stsh.subarray(f.nameAt + 2 + f.name.length * 2 + 2);
      for (let q = 0; q + 3 < tail.length; q++) {
        const cb = tail[q] | (tail[q + 1] << 8);
        if (!cb || cb > 0x1000 || q + 2 + cb > tail.length) continue;
        const sprms = readSprms(tail.subarray(q + 2, q + 2 + cb), false);
        if (!sprms.length) continue;
        const p = readPapx(sprms);
        if (Object.keys(p).length) {
          ['align', 'indentLeft', 'indentFirst', 'lineHeight', 'lineHeightPx',
            'spaceBefore', 'spaceAfter', 'indentFirstChars'].forEach(function (k) {
              if (p[k] != null && map1.para[k] == null) map1.para[k] = p[k];
            });
        }
        break;
      }
      map[istd] = map1;
    });
    return map;
  }

  /* 把 FKP 的 fc 区间和 piece table 的字符区间对应起来：
     piece 给「字符 → fc」，FKP 给「fc 区间 → 属性」。
     压缩 piece（1 字节/字符）要先换算成 fc，再查属性。 */
  function docRichBlocks(ole) {
    const wd = ole.read('WordDocument');
    if (!wd || wd.length < 0x200) return null;
    const wdU32 = function (o) {
      return (wd[o] | (wd[o + 1] << 8) | (wd[o + 2] << 16) | (wd[o + 3] << 24)) >>> 0;
    };
    const wdU16 = function (o) { return wd[o] | (wd[o + 1] << 8); };
    if (wdU16(0) !== 0xa5ec) return null;
    const flags = wdU16(0x0a);
    const tableName = (flags & 0x0200) ? '1Table' : '0Table';
    const tbl = ole.read(tableName) || ole.read(tableName === '0Table' ? '1Table' : '0Table');
    if (!tbl) return null;

    /* FIB 里的 rgFcLcb 起点按 csw/cslw 动态算，别硬编码 */
    const csw = wdU16(32);
    let p = 34 + csw * 2;
    const cslw = wdU16(p);
    p += 2 + cslw * 4 + 2;
    const rgFcLcb = p;

    const u32t = function (o) {
      return (tbl[o] | (tbl[o + 1] << 8) | (tbl[o + 2] << 16) | (tbl[o + 3] << 24)) >>> 0;
    };
    const fcClx = wdU32(rgFcLcb + 33 * 8);
    const lcbClx = wdU32(rgFcLcb + 33 * 8 + 4);
    if (!lcbClx || fcClx + lcbClx > tbl.length) return null;

    /* piece table */
    let q = fcClx;
    const endClx = fcClx + lcbClx;
    let plc = null;
    while (q + 1 < endClx) {
      const kind = tbl[q];
      if (kind === 1) {
        if (q + 3 > endClx) break;
        q += 3 + (tbl[q + 1] | (tbl[q + 2] << 8));
      } else if (kind === 2) {
        if (q + 5 > endClx) break;
        const lcb = u32t(q + 1);
        plc = tbl.subarray(q + 5, Math.min(q + 5 + lcb, endClx));
        break;
      } else break;
    }
    if (!plc || plc.length < 16) return null;
    const pieces = (plc.length - 4) / 12;
    if (!(pieces >= 1)) return null;
    const pu32 = function (o) {
      return (plc[o] | (plc[o + 1] << 8) | (plc[o + 2] << 16) | (plc[o + 3] << 24)) >>> 0;
    };
    const cpOf = function (i) { return pu32(i * 4); };

    const chpx = docChpxRuns(wd, tbl, function (o) { return wdU32(o); });
    const styles = docStyles(tbl, function (o) { return wdU32(o); });
    const papx = docPapxRuns(wd, tbl, function (o) { return wdU32(o); }, styles);
    const fontNames = docFonts(wd, tbl, function (o) { return wdU32(o); });

    const gbk = new TextDecoder('gbk');

    /* 每个 piece → 一段 (fc, 字符) 序列；同时记录「字符 → fc」以便查属性 */
    const segments = [];
    for (let i = 0; i < pieces; i++) {
      const cpS = cpOf(i);
      const cpE = cpOf(i + 1);
      if (cpE <= cpS) continue;
      const off = (pieces + 1) * 4 + i * 8;
      if (off + 8 > plc.length) continue;
      /* PCD = flags(2B) + fc(4B) + prm(2B)：fc 在 +2 */
      const fcRaw = pu32(off + 2);
      const compressed = (fcRaw & 0x40000000) !== 0;
      const fcBase = fcRaw & 0x3fffffff;
      const count = cpE - cpS;
      segments.push({ cpS: cpS, cpE: cpE, fcBase: fcBase, compressed: compressed, count: count });
    }
    if (!segments.length) return null;

    /* 字符偏移 → 字（fc） */
    function fcOf(pos) {
      for (let i = 0; i < segments.length; i++) {
        const s = segments[i];
        if (pos < s.cpS || pos >= s.cpE) continue;
        const d = pos - s.cpS;
        return s.compressed ? s.fcBase + d : s.fcBase + d * 2;
      }
      return -1;
    }

    function runAt(arr, fc) {
      for (let i = 0; i < arr.length; i++) {
        if (fc >= arr[i].fcS && fc < arr[i].fcE) return arr[i];
      }
      return arr.length ? arr[arr.length - 1] : null;
    }

    /* 读一段字符（跨 piece 也能拼） */
    const totalCp = segments[segments.length - 1].cpE;
    const chars = [];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (s.compressed) {
        const from = Math.floor(s.fcBase / 2);
        const raw = wd.subarray(from, Math.min(from + s.count, wd.length));
        chars.push(gbk.decode(raw));
      } else {
        const from = s.fcBase;
        const raw = wd.subarray(from, Math.min(from + s.count * 2, wd.length));
        let str = '';
        for (let k = 0; k + 1 < raw.length; k += 2) str += String.fromCharCode(raw[k] | (raw[k + 1] << 8));
        chars.push(str);
      }
    }

    /* 拼成「字符 + 其 fc」，再按 \r 分段 */
    const full = [];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const str = chars[i];
      for (let k = 0; k < str.length && k < s.count; k++) {
        full.push({ ch: str[k], pos: s.cpS + k, fc: s.compressed ? s.fcBase + k : s.fcBase + k * 2 });
      }
    }

    const blocks = [];
    let cur = null;
    /* 域代码过滤：「　 PAGE \* MERGEFORMAT 1 」这种东西会直接印到预览里。
       \x13 = 域开始，\x14 = 分隔（前面是域代码，后面是域结果），\x15 = 域结束。
       域代码整段丢掉；域结果（如页码 1）保留。嵌套域靠 fieldDepth 计数，不能只看单层。 */
    let fieldDepth = 0;
    const fieldInCode = [];
    const flush = function () {
      if (!cur) return;
      if (cur.runs.length) blocks.push(cur);
      cur = null;
    };
    for (let i = 0; i < full.length; i++) {
      const item = full[i];
      const code = item.ch.charCodeAt(0);

      /* 域控制符先处理，不进正文 */
      if (code === 0x13) { fieldDepth++; fieldInCode[fieldDepth] = true; continue; }
      if (code === 0x14) { if (fieldDepth > 0) fieldInCode[fieldDepth] = false; continue; }
      if (code === 0x15) { if (fieldDepth > 0) { fieldInCode[fieldDepth] = false; fieldDepth--; } continue; }
      if (fieldInCode[fieldDepth]) continue;   /* 域代码本体，丢弃 */

      /* \r = 段落结束；\u000c = 分页 */
      if (code === 0x0d || code === 0x0c) { flush(); continue; }
      if (code < 0x20 && code !== 0x09) {
        if (!cur) continue;
        if (code === 0x07) { cur.runs.push({ text: '\t' }); continue; }
        continue;
      }
      if (!cur) {
        const pap = runAt(papx, item.fc);
        cur = { runs: [], para: pap ? pap.props : {} };
      }
      const chpRun = runAt(chpx, item.fc);
      const props = chpRun ? chpRun.props : {};
      const last = cur.runs[cur.runs.length - 1];
      if (last && last._sig === sigOf(props)) {
        last.text += item.ch;
      } else {
        const run = { text: item.ch, _sig: sigOf(props) };
        if (props.bold) run.bold = true;
        if (props.italic) run.italic = true;
        if (props.underline) run.underline = true;
        if (props.strike) run.strike = true;
        if (props.size) run.size = props.size;
        if (props.color) run.color = props.color;
        /* 字体回退链：中文文档往往只写 ftcAscii/ftcOther，ftcEast 为空，
           只认 ftcEast 会丢字体（见成果台 file-preview 卡）。顺序不能反。 */
        const ftc = props.ftcEast != null ? props.ftcEast
                  : (props.ftcOther != null ? props.ftcOther : props.ftcAscii);
        if (ftc != null && fontNames[ftc]) run.font = fontNames[ftc];
        cur.runs.push(run);
      }
    }
    flush();

    /* 页脚残片过滤：.clx 不区分正文与页脚，Word 会把页脚里的页码
       「— 2 —」当正文顺序输出。只剔除“全行只是页码”的尾部段落，
       正文里偶然出现数字不会被误伤。 */
    var PAGE_LINE = /^(?:—|-|–|_|\.)+\s*\d+\s*(?:—|-|–|_|\.)+$/;
    var isPageLine = function (b) {
      var t = b.runs.map(function (r) { return r.text; }).join('').replace(/[\s\u00a0]/g, '');
      return t.length > 0 && t.length <= 12 && PAGE_LINE.test(t);
    };
    while (blocks.length && isPageLine(blocks[blocks.length - 1])) blocks.pop();

    if (!blocks.length) return null;
    return {
      blocks: blocks,
      fonts: fontNames,
      stats: { chpx: chpx.length, papx: papx.length, blocks: blocks.length, totalCp: totalCp }
    };
  }

  function sigOf(o) {
    return [o.bold ? 1 : 0, o.italic ? 1 : 0, o.underline ? 1 : 0,
      o.strike ? 1 : 0, o.size || 0, o.color || '',
      o.ftcEast != null ? o.ftcEast : (o.ftcOther != null ? o.ftcOther : (o.ftcAscii || ''))].join('|');
  }

  /* WPS 等编辑器会写一个「空 piece」的 CLX，正文却留在 fcMin..fcMac：
     piece table 拼不出像样文本时，直接按 UTF-16LE 读这一段主文本。 */
  function docMainText(ole, wd) {
    if (!wd || wd.length < 0x200) return null;
    const u16 = function (o) { return wd[o] | (wd[o + 1] << 8); };
    const u32 = function (o) {
      return (wd[o] | (wd[o + 1] << 8) | (wd[o + 2] << 16) | (wd[o + 3] << 24)) >>> 0;
    };
    if (u16(0) !== 0xa5ec) return null;
    const fcMin = u32(0x18);
    const fcMac = u32(0x1c);
    if (!(fcMac > fcMin) || fcMac > wd.length) return null;
    let s = '';
    const stop = Math.min(fcMac, wd.length);
    for (let i = fcMin; i + 1 < stop; i += 2) {
      s += String.fromCharCode(wd[i] | (wd[i + 1] << 8));
    }
    return cleanDocText(s);
  }

  window.NpfDoc = {
    /* 是否是 Word 97-2003 的 OLE 二进制 */
    isOle: function (bytes) {
      const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      return isOleBytes(b);
    },
    /* 解析成富文本块：{ blocks:[{runs:[...], para:{...}}] }，失败返回 null */
    richBlocks: function (bytes) {
      const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      if (!isOleBytes(b)) return null;
      try {
        const ole = readOle(b);
        return ole ? docRichBlocks(ole) : null;
      } catch (e) {
        return null;
      }
    },
    /* 只要纯文本，作为富文本解析失败后的兜底 */
    plainText: function (bytes) {
      const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
      if (!isOleBytes(b)) return '';
      try {
        const ole = readOle(b);
        if (!ole) return '';
        const wd = ole.streams && (ole.streams['WordDocument'] || ole.streams['worddocument']);
        if (!wd) return '';
        const t = docMainText(ole, wd);
        if (t) return t;
        const p = docPieceText(ole);
        return p || '';
      } catch (e) {
        return '';
      }
    }
  };
})();
