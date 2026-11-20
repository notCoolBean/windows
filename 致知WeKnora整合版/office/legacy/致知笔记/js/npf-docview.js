/* 致知笔记 · 预览用 DOCX / MHT / HTML 渲染
   精简自 10--谈话助手 的 脚本/js/docview.js + 脚本/js/parse.js，
   只保留渲染所需的 zip 解压、编码识别与 mht 解析，不含任何笔录业务。
   注意：本文件由工具生成，改动请同步上游后重新生成。 */
(function () {
    'use strict';

    function attr(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    var TZ = { attr: attr, esc: esc };
    TZ.DocParse = {};

  function decodeText(bytes, headerCharset) {
    const head = String(headerCharset || '').toLowerCase();
    const order = [];
    if (head.indexOf('gb') >= 0 || head.indexOf('936') >= 0) order.push('gbk');
    else if (head.indexOf('big5') >= 0) order.push('big5');
    ['utf-8', 'gbk', 'big5', 'utf-16le'].forEach(function (e) {
      if (order.indexOf(e) < 0) order.push(e);
    });
    let best = '', bestScore = -1;
    for (let i = 0; i < order.length; i++) {
      let text;
      try { text = new TextDecoder(order[i]).decode(bytes); } catch (e) { continue; }
      const score = textScore(text);
      if (score > bestScore) { bestScore = score; best = text; }
      if (score > 0 && text.indexOf('\uFFFD') < 0) break;
    }
    return best;
  }

  /* ---------- 字节工具 ---------- */

  function bytesToStringLimited(bytes, start, end) {
    let s = '';
    const stop = Math.min(end, bytes.length);
    const chunk = 0x8000;
    for (let i = start; i < stop; i += chunk) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, stop)));
    }
    return s;
  }

  function latin1Bytes(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
    return out;
  }

  function findAllBytes(hay, needle, from, to) {
    const res = [];
    const n = needle.length;
    const limit = Math.min(to, hay.length) - n;
    for (let i = from; i <= limit; i++) {
      let ok = true;
      for (let j = 0; j < n; j++) { if (hay[i + j] !== needle[j]) { ok = false; break; } }
      if (ok) { res.push(i); i += n - 1; }
    }
    return res;
  }

  /* ---------- MHTML ---------- */

  function parseMhtml(bytes) {
    const parts = parseMhtmlParts(bytes);
    if (!parts.length) return decodeText(bytes.slice(0, Math.min(bytes.length, 8 << 20)), 'gbk');
    return parts[0].text;
  }

  // 返回所有 text/html 段（正文段在最前，页眉/页脚可能是独立段）

  function parseMhtmlParts(bytes) {
    const headStr = bytesToStringLimited(bytes, 0, Math.min(bytes.length, 1 << 20));
    const bMatch = headStr.match(/boundary="?([^"\r\n;]+)"?/i);
    const fallback = decodeText(bytes.slice(0, Math.min(bytes.length, 8 << 20)), 'gbk');
    if (!bMatch) return [{ text: fallback }];
    const enc = (headStr.match(/charset="?([\w-]+)"?/i) || [])[1] || '';

    const bBytes = latin1Bytes('--' + bMatch[1]);
    const positions = findAllBytes(bytes, bBytes, 0, Math.min(bytes.length, 64 << 20) + bBytes.length);
    if (!positions.length) return [{ text: decodeText(bytes.slice(0, Math.min(bytes.length, 8 << 20)), enc || 'gbk') }];

    const parts = [];
    for (let i = 0; i < positions.length - 1; i++) {
      const segStart = positions[i] + bBytes.length;
      const segEnd = positions[i + 1];
      if (segEnd - segStart < 8) continue;
      const segHeader = bytesToStringLimited(bytes, segStart, Math.min(segEnd, segStart + 2048));
      if (!/content-type:\s*text\/html/i.test(segHeader)) continue;
      const hOff = headerBodyOffset(bytes, segStart, segEnd);
      const bodyStart = segStart + hOff;
      const partBytes = bytes.slice(bodyStart, Math.max(bodyStart, segEnd - 2));
      const isQP = /content-transfer-encoding:\s*quoted-printable/i.test(segHeader);
      const raw = isQP ? decodeQpToBytes(partBytes) : partBytes;
      const loc = (segHeader.match(/content-location:\s*([^\r\n]+)/i) || [])[1] || '';
      parts.push({ text: decodeText(raw, enc), location: loc });
    }
    if (!parts.length) return [{ text: decodeText(bytes.slice(0, Math.min(bytes.length, 8 << 20)), enc || 'gbk') }];
    // 正文段（非 header/footer）优先；否则取最长的一段
    const main = parts.filter(function (p) { return !/header|footer/i.test(p.location); });
    const ordered = (main.length ? main : parts.slice()).sort(function (a, b) { return b.text.length - a.text.length; });
    const rest = parts.filter(function (p) { return ordered.indexOf(p) < 0; });
    return ordered.concat(rest);
  }

  function headerBodyOffset(bytes, start, end) {
    const limit = Math.min(end, start + 4096);
    for (let i = start; i + 3 < limit; i++) {
      if (bytes[i] === 13 && bytes[i + 1] === 10 && bytes[i + 2] === 13 && bytes[i + 3] === 10) return i + 4 - start;
      if (bytes[i] === 10 && bytes[i + 1] === 10) return i + 2 - start;
    }
    return 0;
  }

  // quoted-printable → 原始字节（=XX 还原，保留原文编码）

  function decodeQpToBytes(bytes) {
    const out = [];
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b === 0x3d) { // '='
        if (i + 2 < bytes.length && isHex(bytes[i + 1]) && isHex(bytes[i + 2])) {
          out.push(parseInt(String.fromCharCode(bytes[i + 1], bytes[i + 2]), 16));
          i += 2;
        } else if (bytes[i + 1] === 13 && bytes[i + 2] === 10) {
          i += 2;
        } else if (bytes[i + 1] === 10) {
          i += 1;
        } else {
          out.push(b);
        }
      } else {
        out.push(b);
      }
    }
    return new Uint8Array(out);
  }

  function isHex(b) {
    return (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x46) || (b >= 0x61 && b <= 0x66);
  }

  /* ---------- HTML → 文本 ---------- */

  function htmlToText(html) {
    let s = String(html || '');
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    s = s.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
    s = s.replace(/<br\s*\/?>/gi, '\n');
    s = s.replace(/<\/(p|div|tr|table|h[1-6]|li|section|article)>/gi, '\n');
    s = s.replace(/<\/(td|th)>/gi, '\u3000');
    s = s.replace(/<[^>]+>/g, '');
    s = decodeEntities(s);
    s = s.replace(/\u00a0/g, ' ');
    return s.replace(/[ \t\f\v]+/g, ' ');
  }

  function decodeEntities(s) {
    const named = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ldquo: '\u201c', rdquo: '\u201d', mdash: '\u2014' };
    return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (m, body) {
      if (body[0] === '#') {
        const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
        return isNaN(code) ? m : String.fromCharCode(code);
      }
      return named[body] != null ? named[body] : m;
    });
  }

  /* ---------- DOCX ---------- */

  function isZipBytes(bytes) {
    return bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  }

  function flatOpcParts(raw) {
    const re = /<pkg:part\b[^>]*>/ig;
    const marks = [];
    let m;
    while ((m = re.exec(raw))) {
      // WPS / 部分另存工具会把属性写成单引号
      let name = (/pkg:name\s*=\s*"([^"]*)"/i.exec(m[0]) || [])[1] ||
        (/pkg:name\s*=\s*'([^']*)'/i.exec(m[0]) || [])[1] || '';
      try { name = decodeURIComponent(name); } catch (e) { /* 保留原值 */ }
      marks.push({ start: m.index, end: m.index + m[0].length, name: name });
    }
    return marks.map(function (mark, i) {
      const stop = i + 1 < marks.length ? marks[i + 1].start : raw.length;
      return { name: mark.name, xml: raw.slice(mark.end, stop) };
    });
  }

  // WordprocessingML → 纯文本：单元格用制表符、行用换行，标签/值分列时后续仍能对齐

  function wordXmlToText(xml, tabChar) {
    const tab = tabChar == null ? '\u3000' : tabChar;
    let s = String(xml || '');
    s = s.replace(/<w:(instrText|delText)\b[^>]*>[\s\S]*?<\/w:\1>/g, '');
    s = s.replace(/<w:(tab|ptab)\b[^>]*\/>/g, tab);
    s = s.replace(/<w:(br|cr)\b[^>]*\/>/g, '\n');
    s = s.replace(/<\/w:tc>/g, '\t');
    s = s.replace(/<\/w:tr>/g, '\n');
    s = s.replace(/<\/w:p>/g, '\n');
    s = s.replace(/<[^>]+>/g, '');
    return decodeEntities(s);
  }

  function parseFlatOpc(bytes) {
    const raw = decodeText(bytes, 'utf-8');
    if (!/<pkg:package\b|<w:wordDocument\b|<w:document\b/i.test(raw)) return null;
    const parts = flatOpcParts(raw);
    let docXml = '';
    parts.forEach(function (p) {
      if (!docXml && /^\/word\/document\d*\.xml$/i.test(p.name)) docXml = p.xml;
    });
    if (!docXml) {
      const at = raw.search(/<w:document\b/i);
      docXml = at >= 0 ? raw.slice(at) : raw;
    }
    const bodyAt = /<w:body\b/i.exec(docXml);
    let bodyXml = bodyAt ? docXml.slice(bodyAt.index) : docXml;
    // 部件没拆出来（属性写法异常）：直接在整份 XML 里截 <w:body>…</w:body>
    if (!bodyAt) {
      const direct = /<w:body\b[\s\S]*?<\/w:body>/i.exec(raw);
      if (direct) bodyXml = direct[0];
    }
    if (!/<w:t[\s>]/i.test(bodyXml)) {
      // 再退一步：Flat OPC 里正文一定在 <w:body> 内，直接按标签抓文本
      const anyBody = /<w:body\b[\s\S]*$/i.exec(raw);
      if (anyBody) bodyXml = anyBody[0];
    }
    const headers = [];
    parts.forEach(function (p) {
      if (!/^\/word\/(header|footer)\d*\.xml$/i.test(p.name)) return;
      const t = wordXmlToText(p.xml, ' ').trim();
      if (t) headers.push(t);
    });
    return { text: wordXmlToText(bodyXml, '\u3000'), headers: headers };
  }

  /* ---------- 包读取门面（供 docview.js 渲染文档结构） ----------
     ZIP（OOXML）与 Flat OPC 统一成同一套接口，调用方不必关心底层格式。
     条目名一律去掉前导“/”，与 ZIP 内的写法（word/document.xml）一致。 */

  function pkgName(name) {
    return String(name || '').replace(/^\/+/, '');
  }

  function base64ToBytes(b64) {
    const bin = atob(String(b64 || '').replace(/\s+/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // Flat OPC 的 part 内容可能是 <pkg:xmlData>（XML）或 <pkg:binaryData>（base64 图片）

  function flatPartIndex(raw) {
    const index = {};
    flatOpcParts(raw).forEach(function (part) {
      const name = pkgName(part.name);
      if (!name || index[name]) return;
      const xmlAt = /<pkg:xmlData\b[^>]*>/i.exec(part.xml);
      if (xmlAt) {
        const rest = part.xml.slice(xmlAt.index + xmlAt[0].length);
        const end = rest.toLowerCase().indexOf('</pkg:xmldata>');
        index[name] = { text: (end >= 0 ? rest.slice(0, end) : rest).trim() };
        return;
      }
      const binAt = /<pkg:binaryData\b[^>]*>([\s\S]*?)<\/pkg:binaryData>/i.exec(part.xml);
      if (binAt) index[name] = { base64: binAt[1] };
    });
    return index;
  }

  async function openPackage(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (isZipBytes(bytes)) {
      const names = zipEntryNames(bytes);
      return {
        kind: 'zip',
        names: function () { return names.slice(); },
        has: function (name) { return names.indexOf(pkgName(name)) >= 0; },
        text: async function (name) {
          const data = await readZipEntry(bytes, pkgName(name));
          return data ? decodeText(data, 'utf-8') : '';
        },
        bytes: async function (name) {
          return await readZipEntry(bytes, pkgName(name));
        }
      };
    }
    const raw = decodeText(bytes, 'utf-8');
    if (!/<pkg:package\b/i.test(raw)) return null;
    const index = flatPartIndex(raw);
    const entries = Object.keys(index);
    return {
      kind: 'flat',
      names: function () { return entries.slice(); },
      has: function (name) { return Object.prototype.hasOwnProperty.call(index, pkgName(name)); },
      text: async function (name) {
        const item = index[pkgName(name)];
        if (!item) return '';
        return item.base64 != null ? decodeText(base64ToBytes(item.base64), 'utf-8') : item.text;
      },
      bytes: async function (name) {
        const item = index[pkgName(name)];
        if (!item) return null;
        if (item.base64 != null) return base64ToBytes(item.base64);
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(item.text);
        return latin1Bytes(unescape(encodeURIComponent(item.text)));
      }
    };
  }

  function zipEntryNames(bytes) {
    const eocd = findSig(bytes, 0x06054b50, Math.max(0, bytes.length - 66000), bytes.length);
    if (eocd < 0) return [];
    const cdCount = readU16(bytes, eocd + 10);
    let ptr = readU32(bytes, eocd + 16);
    const names = [];
    for (let i = 0; i < cdCount && ptr + 46 <= bytes.length; i++) {
      if (readU32(bytes, ptr) !== 0x02014b50) break;
      const nameLen = readU16(bytes, ptr + 28);
      const extraLen = readU16(bytes, ptr + 30);
      const commentLen = readU16(bytes, ptr + 32);
      names.push(bytesToStringLimited(bytes, ptr + 46, ptr + 46 + nameLen));
      ptr += 46 + nameLen + extraLen + commentLen;
    }
    return names;
  }

  async function readZipEntry(bytes, name) {
    const eocd = findSig(bytes, 0x06054b50, Math.max(0, bytes.length - 66000), bytes.length);
    if (eocd < 0) return null;
    const cdCount = readU16(bytes, eocd + 10);
    let ptr = readU32(bytes, eocd + 16);
    for (let i = 0; i < cdCount && ptr + 46 <= bytes.length; i++) {
      if (readU32(bytes, ptr) !== 0x02014b50) break;
      const method = readU16(bytes, ptr + 10);
      const compSize = readU32(bytes, ptr + 20);
      const nameLen = readU16(bytes, ptr + 28);
      const extraLen = readU16(bytes, ptr + 30);
      const commentLen = readU16(bytes, ptr + 32);
      const localOff = readU32(bytes, ptr + 42);
      const entryName = bytesToStringLimited(bytes, ptr + 46, ptr + 46 + nameLen);
      if (entryName === name) {
        const lNameLen = readU16(bytes, localOff + 26);
        const lExtraLen = readU16(bytes, localOff + 28);
        const dataStart = localOff + 30 + lNameLen + lExtraLen;
        const raw = bytes.subarray(dataStart, dataStart + compSize);
        if (method === 0) return raw;
        if (method === 8) return await inflateRaw(raw);
        return null;
      }
      ptr += 46 + nameLen + extraLen + commentLen;
    }
    return null;
  }

  async function inflateRaw(raw) {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch (e) {
        // 部分麒麟/国产浏览器不支持 deflate-raw，退回纯 JS 解压
      }
    }
    return inflateRawJs(raw);
  }

  // 纯 JS DEFLATE（RFC 1951）解压，供不支持 DecompressionStream('deflate-raw') 的浏览器使用

  function inflateRawJs(input) {
    const src = input instanceof Uint8Array ? input : new Uint8Array(input);
    let out = new Uint8Array(Math.max(1024, src.length * 4));
    let outLen = 0;
    let bitBuf = 0, bitCnt = 0, pos = 0, pad = 0;
    // deflate 末尾不足一字节时按 0 补齐，但只允许少量补齐，避免掩盖真实截断
    function readByte() {
      if (pos < src.length) return src[pos++];
      if (pad++ > 4) throw new Error('docx 数据不完整');
      return 0;
    }

    function ensure(n) {
      if (outLen + n <= out.length) return;
      let size = out.length;
      while (size < outLen + n) size *= 2;
      const next = new Uint8Array(size);
      next.set(out.subarray(0, outLen));
      out = next;
    }
    function bits(n) {
      while (bitCnt < n) {
        bitBuf |= readByte() << bitCnt;
        bitCnt += 8;
      }
      const v = bitBuf & ((1 << n) - 1);
      bitBuf >>>= n;
      bitCnt -= n;
      return v;
    }
    function alignByte() { bitBuf = 0; bitCnt = 0; }

    // 固定 Huffman 表（RFC 1951 §3.2.6）
    const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
    const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
    const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

    function buildTable(lengths) {
      const maxBits = Math.max.apply(null, lengths.concat([1]));
      const counts = new Array(maxBits + 2).fill(0);
      for (let i = 0; i < lengths.length; i++) if (lengths[i]) counts[lengths[i]]++;
      // 规范 Huffman：逐长度推算每个码的起始值（RFC 1951 §3.2.2）
      const nextCode = new Array(maxBits + 2).fill(0);
      let code = 0;
      for (let len = 1; len <= maxBits; len++) {
        code = (code + counts[len - 1]) << 1;
        nextCode[len] = code;
      }
      nextCode[1] = 0;
      const table = new Array(1 << maxBits);
      for (let sym = 0; sym < lengths.length; sym++) {
        const len = lengths[sym];
        if (!len) continue;
        let c = nextCode[len]++;
        let rev = 0;
        for (let b = 0; b < len; b++) { rev = (rev << 1) | (c & 1); c >>>= 1; }
        const step = 1 << len;
        for (let j = rev; j < table.length; j += step) table[j] = (sym << 4) | len;
      }
      return { table: table, maxBits: maxBits };
    }

    function decodeSym(t) {
      const shift = t.maxBits;
      while (bitCnt < shift) {
        bitBuf |= readByte() << bitCnt;
        bitCnt += 8;
      }
      const entry = t.table[bitBuf & ((1 << shift) - 1)];
      if (entry == null) throw new Error('docx 压缩数据损坏');
      const len = entry & 15;
      bitBuf >>>= len;
      bitCnt -= len;
      return entry >> 4;
    }

    let fixedLit = null, fixedDist = null;
    function fixedTables() {
      if (fixedLit) return;
      const lit = new Array(288);
      for (let i = 0; i < 144; i++) lit[i] = 8;
      for (let i = 144; i < 256; i++) lit[i] = 9;
      for (let i = 256; i < 280; i++) lit[i] = 7;
      for (let i = 280; i < 288; i++) lit[i] = 8;
      fixedLit = buildTable(lit);
      fixedDist = buildTable(new Array(30).fill(5));
    }

    let last = 0;
    while (!last) {
      last = bits(1);
      const type = bits(2);
      if (type === 0) {
        alignByte();
        if (pos + 4 > src.length) throw new Error('docx 数据不完整');
        const len = src[pos] | (src[pos + 1] << 8);
        pos += 4;
        if (pos + len > src.length) throw new Error('docx 数据不完整');
        ensure(len);
        out.set(src.subarray(pos, pos + len), outLen);
        outLen += len;
        pos += len;
      } else if (type === 1) {
        fixedTables();
        while (true) {
          const sym = decodeSym(fixedLit);
          if (sym < 256) { ensure(1); out[outLen++] = sym; }
          else if (sym === 256) break;
          else {
            const li = sym - 257;
            if (li >= LBASE.length) throw new Error('docx 压缩数据损坏');
            const length = LBASE[li] + bits(LEXT[li]);
            const ds = decodeSym(fixedDist);
            if (ds >= DBASE.length) throw new Error('docx 压缩数据损坏');
            const dist = DBASE[ds] + bits(DEXT[ds]);
            ensure(length);
            for (let i = 0; i < length; i++) { out[outLen] = out[outLen - dist]; outLen++; }
          }
        }
      } else if (type === 2) {
        const hlit = bits(5) + 257;
        const hdist = bits(5) + 1;
        const hclen = bits(4) + 4;
        const order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        const cl = new Array(19).fill(0);
        for (let i = 0; i < hclen; i++) cl[order[i]] = bits(3);
        const clTable = buildTable(cl);
        const lens = [];
        while (lens.length < hlit + hdist) {
          const sym = decodeSym(clTable);
          if (sym < 16) lens.push(sym);
          else if (sym === 16) {
            const prev = lens[lens.length - 1];
            let n = 3 + bits(2);
            while (n--) lens.push(prev);
          } else if (sym === 17) {
            let n = 3 + bits(3);
            while (n--) lens.push(0);
          } else {
            let n = 11 + bits(7);
            while (n--) lens.push(0);
          }
        }
        const litTable = buildTable(lens.slice(0, hlit));
        const distTable = buildTable(lens.slice(hlit));
        while (true) {
          const sym = decodeSym(litTable);
          if (sym < 256) { ensure(1); out[outLen++] = sym; }
          else if (sym === 256) break;
          else {
            const li = sym - 257;
            if (li >= LBASE.length) throw new Error('docx 压缩数据损坏');
            const length = LBASE[li] + bits(LEXT[li]);
            const ds = decodeSym(distTable);
            if (ds >= DBASE.length) throw new Error('docx 压缩数据损坏');
            const dist = DBASE[ds] + bits(DEXT[ds]);
            ensure(length);
            for (let i = 0; i < length; i++) { out[outLen] = out[outLen - dist]; outLen++; }
          }
        }
      } else {
        throw new Error('docx 压缩数据损坏');
      }
    }
    return out.subarray(0, outLen);
  }

  function findSig(bytes, sig, from, to) {
    for (let i = to - 4; i >= from; i--) {
      if (bytes[i] === (sig & 0xff) && bytes[i + 1] === ((sig >> 8) & 0xff) &&
        bytes[i + 2] === ((sig >> 16) & 0xff) && bytes[i + 3] === ((sig >> 24) & 0xff)) return i;
    }
    return -1;
  }

  function readU16(b, i) { return b[i] | (b[i + 1] << 8); }

  function readU32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }

  /* ---------- DOC（OLE 二进制，尽力而为） ---------- */

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

  function kids(el) {
    const out = [];
    if (!el) return out;
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1) out.push(n);
    }
    return out;
  }

  function kid(el, name) {
    const list = kids(el);
    for (let i = 0; i < list.length; i++) {
      if (list[i].localName === name) return list[i];
    }
    return null;
  }

  function kidAll(el, name) {
    return kids(el).filter(function (n) { return n.localName === name; });
  }

  function attr(el, name) {
    if (!el || !el.attributes) return null;
    for (let i = 0; i < el.attributes.length; i++) {
      const at = el.attributes[i];
      if (at.localName === name && at.namespaceURI !== 'http://www.w3.org/2000/xmlns/') return at.value;
    }
    return null;
  }

  function parseXml(text) {
    if (!text) return null;
    let doc = null;
    try { doc = new DOMParser().parseFromString(text, 'application/xml'); } catch (e) { return null; }
    if (!doc || !doc.documentElement) return null;
    if (doc.getElementsByTagName('parsererror').length) return null;
    return doc;
  }

  function num(v, def) {
    const n = parseFloat(v);
    return isNaN(n) ? (def == null ? 0 : def) : n;
  }

  function twip(v) { return num(v) / TWIP_PER_PX; }

  function px(v) { return Math.round(v * 100) / 100; }

  function on(el) {
    if (!el) return false;
    const v = attr(el, 'val');
    return !(v === '0' || v === 'false' || v === 'off');
  }

  /* ---------- 关系表 / 样式表 ---------- */

  function parseRels(xml) {
    const map = {};
    const doc = parseXml(xml);
    if (!doc) return map;
    const list = doc.getElementsByTagName('*');
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      if (el.localName !== 'Relationship') continue;
      const id = attr(el, 'Id');
      if (!id) continue;
      map[id] = {
        target: String(attr(el, 'Target') || '').replace(/^\.\//, ''),
        external: attr(el, 'TargetMode') === 'External'
      };
    }
    return map;
  }

  // 把 rels 里的目标路径换算成包内条目名（处理 ../media/x.png）

  function resolveTarget(base, target) {
    const t = String(target || '');
    if (!t) return '';
    if (t.charAt(0) === '/') return t.replace(/^\/+/, '');
    const parts = (base + '/' + t).split('/');
    const out = [];
    parts.forEach(function (seg) {
      if (!seg || seg === '.') return;
      if (seg === '..') out.pop();
      else out.push(seg);
    });
    return out.join('/');
  }

  function readRPr(el) {
    const res = {};
    if (!el) return res;
    const b = kid(el, 'b');
    if (b) res.bold = on(b);
    const it = kid(el, 'i');
    if (it) res.italic = on(it);
    const u = kid(el, 'u');
    if (u) res.underline = attr(u, 'val') === 'none' ? false : on(u);
    const st = kid(el, 'strike') || kid(el, 'dstrike');
    if (st) res.strike = on(st);
    const sz = kid(el, 'sz');
    if (sz) res.size = num(attr(sz, 'val')) / 2;
    if (!res.size) {
      const szcs = kid(el, 'szCs');
      if (szcs) res.size = num(attr(szcs, 'val')) / 2;
    }
    const fonts = kid(el, 'rFonts');
    if (fonts) {
      const f = attr(fonts, 'eastAsia') || attr(fonts, 'ascii') || attr(fonts, 'hAnsi');
      if (f) res.font = f;
    }
    const color = kid(el, 'color');
    if (color) {
      const v = attr(color, 'val');
      if (v && v !== 'auto' && /^[0-9a-fA-F]{6}$/.test(v)) res.color = '#' + v;
    }
    const hl = kid(el, 'highlight');
    if (hl) {
      const v = String(attr(hl, 'val') || '').toLowerCase();
      if (HIGHLIGHT[v]) res.background = HIGHLIGHT[v];
    }
    const shd = kid(el, 'shd');
    if (shd) {
      const fill = attr(shd, 'fill');
      if (fill && fill !== 'auto' && /^[0-9a-fA-F]{6}$/.test(fill)) res.background = '#' + fill;
    }
    const va = kid(el, 'vertAlign');
    if (va) {
      const v = attr(va, 'val');
      if (v === 'superscript') res.vertAlign = 'super';
      else if (v === 'subscript') res.vertAlign = 'sub';
    }
    return res;
  }

  function readPPr(el) {
    const res = {};
    if (!el) return res;
    const jc = kid(el, 'jc');
    if (jc) res.align = attr(jc, 'val');
    const ind = kid(el, 'ind');
    if (ind) {
      if (attr(ind, 'left') != null) res.indentLeft = twip(attr(ind, 'left'));
      if (attr(ind, 'firstLine') != null) res.indentFirst = twip(attr(ind, 'firstLine'));
      if (attr(ind, 'hanging') != null) res.indentFirst = -twip(attr(ind, 'hanging'));
    }
    const sp = kid(el, 'spacing');
    if (sp) {
      if (attr(sp, 'before') != null) res.spaceBefore = twip(attr(sp, 'before'));
      if (attr(sp, 'after') != null) res.spaceAfter = twip(attr(sp, 'after'));
      const line = attr(sp, 'line');
      const rule = attr(sp, 'lineRule');
      if (line != null) {
        if (rule === 'exact' || rule === 'atLeast') res.lineHeightPx = twip(line);
        else res.lineHeight = num(line) / 240;
      }
    }
    const numPr = kid(el, 'numPr');
    if (numPr) {
      const ilvl = kid(numPr, 'ilvl');
      res.listLevel = ilvl ? num(attr(ilvl, 'val'), 0) : 0;
      res.list = true;
    }
    const outline = kid(el, 'outlineLvl');
    if (outline) res.outline = num(attr(outline, 'val'), 9);
    return res;
  }

  function readStyles(xml) {
    const res = { defaults: { run: {}, para: {} }, styles: {} };
    const doc = parseXml(xml);
    if (!doc) return res;
    const root = doc.documentElement;
    const def = kid(root, 'docDefaults');
    if (def) {
      const rpr = kid(def, 'rPrDefault');
      if (rpr) res.defaults.run = readRPr(kid(rpr, 'rPr'));
      const ppr = kid(def, 'pPrDefault');
      if (ppr) res.defaults.para = readPPr(kid(ppr, 'pPr'));
    }
    kidAll(root, 'style').forEach(function (style) {
      const id = attr(style, 'styleId');
      if (!id) return;
      res.styles[id] = {
        type: attr(style, 'type') || 'paragraph',
        basedOn: attr(style, 'basedOn') || '',
        run: readRPr(kid(style, 'rPr')),
        para: readPPr(kid(style, 'pPr'))
      };
    });
    return res;
  }

  function mix(base, extra) {
    const out = {};
    Object.keys(base || {}).forEach(function (k) { out[k] = base[k]; });
    Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }

  // 沿 basedOn 链解析样式（带环检测）

  function styleChain(styles, id, kind) {
    const out = [];
    let cur = id;
    let guard = 0;
    while (cur && styles.styles[cur] && guard++ < 20) {
      out.unshift(styles.styles[cur]);
      cur = styles.styles[cur].basedOn;
    }
    return out.map(function (s) { return kind === 'run' ? s.run : s.para; });
  }

  function runStyleOf(rPrEl, styles, kind) {
    let acc = mix({}, styles.defaults[kind]);
    const rStyle = rPrEl && kid(rPrEl, 'rStyle');
    if (rStyle) {
      styleChain(styles, attr(rStyle, 'val'), kind).forEach(function (p) { acc = mix(acc, p); });
    }
    return acc;
  }

  /* ---------- 样式 → CSS ---------- */

  function runCss(p) {
    const css = [];
    if (p.bold) css.push('font-weight:700');
    if (p.italic) css.push('font-style:italic');
    const deco = [];
    if (p.underline) deco.push('underline');
    if (p.strike) deco.push('line-through');
    if (deco.length) css.push('text-decoration:' + deco.join(' '));
    if (p.size) css.push('font-size:' + px(p.size * 4 / 3) + 'px');
    if (p.font) css.push('font-family:' + fontStack(p.font));
    if (p.color) css.push('color:' + p.color);
    if (p.background) css.push('background-color:' + p.background);
    if (p.vertAlign) css.push('vertical-align:' + p.vertAlign + ';font-size:.75em');
    return css.join(';');
  }

  function fontStack(name) {
    const clean = String(name || '').replace(/["'\\<>]/g, '');
    const alias = {
      '仿宋_GB2312': ['FangSong_GB2312', 'FangSong', '仿宋', 'STFangsong'],
      '仿宋': ['FangSong_GB2312', 'FangSong', 'STFangsong'],
      '黑体': ['SimHei', 'STHeiti', 'Microsoft YaHei'],
      '楷体_GB2312': ['KaiTi_GB2312', 'KaiTi', '楷体', 'STKaiti'],
      '楷体': ['KaiTi_GB2312', 'KaiTi', 'STKaiti'],
      '宋体': ['SimSun', 'STSong', 'Songti SC'],
      '微软雅黑': ['Microsoft YaHei', 'PingFang SC'],
      '方正小标宋简体': ['FZXiaoBiaoSong-B05S', 'SimSun']
    };
    const extra = alias[clean] || [];
    const list = [clean].concat(extra).concat(['serif']);
    return list.filter(function (v, i) { return v && list.indexOf(v) === i; })
      .map(function (v) { return "'" + v + "'"; }).join(',');
  }

  function paraCss(p) {
    const css = [];
    if (p.align && ALIGN[p.align]) css.push('text-align:' + ALIGN[p.align]);
    if (p.indentLeft) css.push('margin-left:' + px(p.indentLeft) + 'px');
    if (p.indentFirst) css.push('text-indent:' + px(p.indentFirst) + 'px');
    if (p.spaceBefore) css.push('margin-top:' + px(p.spaceBefore) + 'px');
    if (p.spaceAfter) css.push('margin-bottom:' + px(p.spaceAfter) + 'px');
    if (p.lineHeightPx) css.push('line-height:' + px(p.lineHeightPx) + 'px');
    else if (p.lineHeight && p.lineHeight > 0.8) css.push('line-height:' + px(p.lineHeight));
    if (p.list) css.push('padding-left:' + (18 + (p.listLevel || 0) * 16) + 'px;text-indent:-12px');
    return css.join(';');
  }

  /* ---------- 图片 ---------- */

  function placeholder(name, why) {
    return '<span class="dv-img-missing" title="' + TZ.attr(why || '') + '">' +
      TZ.esc('[图片：' + (name || '未命名') + (why ? ' · ' + why : '') + ']') + '</span>';
  }

  function imageHtml(ctx, relId, cx, cy, alt) {
    if (!relId) return '';
    const rel = ctx.rels[relId];
    if (!rel) return placeholder(alt || '图片', '');
    if (ctx.images >= MAX_IMAGES) return placeholder(alt || '图片', '数量超限');
    const w = cx ? Math.round(cx / EMU_PER_PX) : 0;
    const h = cy ? Math.round(cy / EMU_PER_PX) : 0;
    const sizeStyle = (w ? 'width:' + w + 'px;' : '') + (h ? 'height:' + h + 'px;' : '') +
      (w ? '' : 'max-width:100%;');
    if (rel.external) {
      return placeholder(alt || rel.target.split('/').pop(), '外部图片');
    }
    const target = resolveTarget('word', rel.target);
    const ext = (target.split('.').pop() || '').toLowerCase();
    if (!MIME_BY_EXT[ext]) return placeholder(alt || target.split('/').pop(), '格式不支持');
    ctx.images++;
    const cached = ctx.media[target];
    if (!cached) return placeholder(alt || target.split('/').pop(), '');
    return '<img class="dv-img" src="' + cached + '" alt="' + TZ.attr(alt || '') +
      '" style="' + sizeStyle + '">';
  }

  function collectImageTargets(rels) {
    const out = {};
    Object.keys(rels).forEach(function (id) {
      if (rels[id].external) return;
      const target = resolveTarget('word', rels[id].target);
      const ext = (target.split('.').pop() || '').toLowerCase();
      if (MIME_BY_EXT[ext] && /^word\/media\//i.test(target)) out[target] = MIME_BY_EXT[ext];
    });
    return out;
  }

  /* ---------- 行内渲染 ---------- */

  function renderInline(parent, ctx) {
    const out = [];
    kids(parent).forEach(function (el) {
      const name = el.localName;
      if (name === 'r') { out.push(renderRun(el, ctx)); return; }
      if (name === 'hyperlink') {
        const inner = renderInline(el, ctx);
        const rel = ctx.rels[attr(el, 'id')];
        const href = rel && rel.external ? rel.target : '';
        if (href && !/^\s*javascript:/i.test(href)) {
          out.push('<a class="dv-link" href="' + TZ.attr(href) +
            '" target="_blank" rel="noopener noreferrer">' + inner + '</a>');
        } else {
          out.push('<span class="dv-link">' + inner + '</span>');
        }
        return;
      }
      if (name === 'sdt') {
        const content = kid(el, 'sdtContent');
        if (content) out.push(renderInline(content, ctx));
        return;
      }
      if (name === 'ins' || name === 'smartTag' || name === 'customXml' || name === 'moveTo' ||
        name === 'fldSimple' || name === 'dir' || name === 'bdo') {
        out.push(renderInline(el, ctx));
        return;
      }
      if (name === 'AlternateContent') {
        const choice = kid(el, 'Choice');
        if (choice) out.push(renderInline(choice, ctx));
        return;
      }
      if (name === 'drawing' || name === 'pict' || name === 'object') {
        out.push(renderDrawing(el, ctx));
      }
    });
    return out.join('');
  }

  function renderRun(el, ctx) {
    const rPr = kid(el, 'rPr');
    const props = mix(runStyleOf(rPr, ctx.styles, 'run'), readRPr(rPr));
    const parts = [];
    kids(el).forEach(function (n) {
      const name = n.localName;
      if (name === 't') {
        parts.push(TZ.esc(n.textContent || ''));
      } else if (name === 'tab' || name === 'ptab') {
        parts.push('\u3000');
      } else if (name === 'br') {
        parts.push(attr(n, 'type') === 'page' ? '<hr class="dv-pagebreak">' : '<br>');
      } else if (name === 'cr') {
        parts.push('<br>');
      } else if (name === 'noBreakHyphen') {
        parts.push('-');
      } else if (name === 'drawing' || name === 'pict' || name === 'object') {
        parts.push(renderDrawing(n, ctx));
      }
    });
    const html = parts.join('');
    if (!html) return '';
    const css = runCss(props);
    return css ? '<span class="dv-r" style="' + css + '">' + html + '</span>' : html;
  }

  function renderDrawing(el, ctx) {
    if (el.localName === 'pict') {
      // VML（旧版 Word）：<v:shape><v:imagedata r:id="rId5">
      const shape = kid(el, 'shape');
      const im = shape ? kid(shape, 'imagedata') : null;
      if (!im) return '';
      return imageHtml(ctx, attr(im, 'id') || attr(im, 'embed'), 0, 0, attr(im, 'title'));
    }
    if (el.localName === 'object') {
      const im = kid(el, 'imagedata');
      return im ? imageHtml(ctx, attr(im, 'id'), 0, 0, '') : '';
    }
    const container = kid(el, 'inline') || kid(el, 'anchor');
    if (!container) return '';
    const extent = kid(container, 'extent');
    const cx = extent ? num(attr(extent, 'cx')) : 0;
    const cy = extent ? num(attr(extent, 'cy')) : 0;
    let rid = '';
    let alt = '';
    (function walk(node) {
      if (!node || rid) return;
      kids(node).forEach(function (n) {
        if (rid) return;
        if (n.localName === 'blip') {
          rid = attr(n, 'embed') || attr(n, 'link') || '';
          const descr = attr(n, 'descr');
          if (descr) alt = descr;
        } else if (n.localName === 'cNvPr') {
          alt = attr(n, 'descr') || attr(n, 'name') || alt;
        }
        walk(n);
      });
    })(kid(container, 'graphic') || container);
    return imageHtml(ctx, rid, cx, cy, alt);
  }

  /* ---------- 段落 / 表格 ---------- */

  function paraProps(el, ctx) {
    const pPr = kid(el, 'pPr');
    let props = mix({}, ctx.styles.defaults.para);
    const pStyle = pPr && kid(pPr, 'pStyle');
    if (pStyle) {
      styleChain(ctx.styles, attr(pStyle, 'val'), 'para').forEach(function (p) { props = mix(props, p); });
    }
    props = mix(props, readPPr(pPr));
    // 段落标记自带的 run 属性决定整段基础字号/字体
    const markRpr = pPr && kid(pPr, 'rPr');
    if (markRpr) props = mix(props, readRPr(markRpr));
    return props;
  }

  function renderParagraph(el, ctx) {
    const props = paraProps(el, ctx);
    const inner = renderInline(el, ctx);
    const css = paraCss(props);
    const style = css ? ' style="' + css + '"' : '';
    const cls = 'dv-p' + (props.list ? ' dv-li' : '') + (props.outline === 0 ? ' dv-h1' : '');
    if (!inner) return ctx.blockCount === 0 ? '' : '<p class="' + cls + ' dv-blank"' + style + '>&nbsp;</p>';
    ctx.blockCount++;
    const bullet = props.list ? '<span class="dv-bullet">•</span>' : '';
    return '<p class="' + cls + '"' + style + '>' + bullet + inner + '</p>';
  }

  function cellBorderCss(tcPr) {
    const borders = tcPr && kid(tcPr, 'tcBorders');
    if (!borders) return '';
    const css = [];
    ['top', 'left', 'bottom', 'right'].forEach(function (side) {
      const el = kid(borders, side);
      if (!el) return;
      const val = attr(el, 'val');
      if (!val || val === 'nil' || val === 'none') {
        css.push('border-' + side + ':0');
        return;
      }
      const sz = Math.max(1, Math.round(num(attr(el, 'sz'), 4) / 8));
      const color = attr(el, 'color');
      css.push('border-' + side + ':' + sz + 'px solid ' +
        (color && color !== 'auto' && /^[0-9a-fA-F]{6}$/.test(color) ? '#' + color : '#666'));
    });
    return css.join(';');
  }

  function renderTable(el, ctx) {
    const gridEl = kid(el, 'tblGrid');
    const grid = gridEl ? kidAll(gridEl, 'gridCol').map(function (c) { return twip(attr(c, 'w')); }) : [];
    const tblPrEl = kid(el, 'tblPr');
    const cmEl = tblPrEl && kid(tblPrEl, 'tblCellMar');
    const cmL = cmEl && kid(cmEl, 'left');
    const cmR = cmEl && kid(cmEl, 'right');
    const cellMar = (cmL || cmR)
      ? Math.max(twip(attr(cmL || {}, 'w') || 0), twip(attr(cmR || {}, 'w') || 0))
      : null;
    const rows = kidAll(el, 'tr');
    const rowsHtml = [];
    // vMerge 续行：记录上一行每列是否被跨行占用，续行直接跳过该格即可（HTML rowspan 已在起始格写出）
    let carry = {};

    rows.forEach(function (tr) {
      const trPr = kid(tr, 'trPr');
      const heightEl = trPr && kid(trPr, 'trHeight');
      const trStyle = heightEl ? ' style="height:' + px(twip(attr(heightEl, 'val'))) + 'px"' : '';
      const cellHtml = [];
      let col = 0;

      kidAll(tr, 'tc').forEach(function (tc) {
        const tcPr = kid(tc, 'tcPr');
        const spanEl = tcPr && kid(tcPr, 'gridSpan');
        const span = spanEl ? Math.max(1, num(attr(spanEl, 'val'), 1)) : 1;
        const vEl = tcPr && kid(tcPr, 'vMerge');
        const vVal = vEl ? attr(vEl, 'val') : null;

        if (vEl && vVal !== 'restart') {
          // 续行：之前已由起始格 rowspan 覆盖，跳过
          carry[col] = (carry[col] || 0) + 1;
          col += span;
          return;
        }

        const inner = renderCells(tc, ctx);
        const attrs = [];
        if (span > 1) attrs.push('colspan="' + span + '"');
        if (vEl && vVal === 'restart') {
          const rowspan = countVMerge(rows, tr, col);
          if (rowspan > 1) attrs.push('rowspan="' + rowspan + '"');
        }
        const width = tcPr && kid(tcPr, 'tcW');
        const wVal = width ? attr(width, 'w') : null;
        const wType = width ? attr(width, 'type') : null;
        let widthCss = '';
        if (wVal && wType !== 'auto') {
          if (wType === 'pct') {
            widthCss = 'width:' + px(num(wVal) / 50) + '%';
          } else {
            widthCss = 'width:' + px(twip(wVal)) + 'px';
          }
        } else if (grid[col] && grid.length) {
          widthCss = 'width:' + px(grid[col]) + 'px';
        }
        const shd = tcPr && kid(tcPr, 'shd');
        const fill = shd ? attr(shd, 'fill') : null;
        const bgCss = fill && fill !== 'auto' && /^[0-9a-fA-F]{6}$/.test(fill) ? 'background:#' + fill : '';
        const vAlignEl = tcPr && kid(tcPr, 'vAlign');
        const vAlign = vAlignEl ? attr(vAlignEl, 'val') : '';
        const vCss = vAlign === 'center' ? 'vertical-align:middle' :
          vAlign === 'bottom' ? 'vertical-align:bottom' : '';
          /* Word 允许单行短文本（含标点悬挂）不折行；这里对短标签同样不折，
           否则 20px 楷体 5 字塞进 95px 格子会被拆成两行。 */
        const shortText = inner.replace(/<[^>]*>/g, '').trim();
        const nowrap = shortText && shortText.length <= 14 &&
          shortText.indexOf('\n') < 0 && inner.indexOf('<table') < 0 &&
          inner.indexOf('</p><p') < 0 && cellMar === 0;
        const innerFixed = nowrap
          ? inner.replace(/<p class="dv-p"/g, '<p class="dv-p dv-nw"')
          : inner;
        if (nowrap) attrs.push('class="dv-nw-cell"');
        const css = [cellBorderCss(tcPr), widthCss, bgCss, vCss].filter(Boolean).join(';');
        cellHtml.push('<td' + (attrs.length ? ' ' + attrs.join(' ') : '') +
          (css ? ' style="' + css + '"' : '') + '>' + innerFixed + '</td>');
        col += span;
      });

      rowsHtml.push('<tr' + trStyle + '>' + cellHtml.join('') + '</tr>');
    });

    // 表格级边框：优先表样式，缺省给细线，保证可读
    const tblPr = tblPrEl;
    const borders = tblPr && kid(tblPr, 'tblBorders');
    let tableBorder = '1px solid #b9c6d4';
    if (borders) {
      const top = kid(borders, 'top');
      const val = top ? attr(top, 'val') : '';
      if (val === 'nil' || val === 'none') tableBorder = '0';
      else {
        const sz = Math.max(1, Math.round(num(attr(top, 'sz'), 4) / 8));
        const color = attr(top, 'color');
        tableBorder = sz + 'px solid ' +
          (color && color !== 'auto' && /^[0-9a-fA-F]{6}$/.test(color) ? '#' + color : '#b9c6d4');
      }
    }
    const tblWEl = tblPr && kid(tblPr, 'tblW');
    const tblWType = tblWEl ? attr(tblWEl, 'type') : null;
    let tableW = 0;
    if (tblWEl && tblWType !== 'pct' && tblWType !== 'auto') tableW = twip(attr(tblWEl, 'w'));
    if (!tableW) tableW = grid.reduce(function (a, b) { return a + b; }, 0);
    /* 有 tblGrid 就写 colgroup + fixed 布局：否则浏览器按内容重排列宽，
       合并单元格较多的首行会被压成几条窄带，整张表竖排。 */
    let cols = '';
    if (grid.length && tableW > 0) {
      const sum = grid.reduce(function (a, b) { return a + b; }, 0) || 1;
      cols = '<colgroup>' + grid.map(function (w) {
        return '<col style="width:' + (Math.round((w / sum) * tableW * 100) / 100) + 'px">';
      }).join('') + '</colgroup>';
    }
    const styleCss = (tableW > 0 ? 'width:' + px(tableW) + 'px;' : '') +
      'border:' + tableBorder + ';border-collapse:collapse';
    return '<table class="dv-table" style="' + styleCss + '">' + cols +
      rowsHtml.join('') + '</table>';
  }

  // 统计某列从当前行开始的纵向合并格数（含自身）

  function countVMerge(rows, startTr, targetCol) {
    let count = 1;
    let started = false;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] === startTr) { started = true; continue; }
      if (!started) continue;
      let col = 0;
      let merged = false;
      kidAll(rows[i], 'tc').some(function (tc) {
        const tcPr = kid(tc, 'tcPr');
        const spanEl = tcPr && kid(tcPr, 'gridSpan');
        const span = spanEl ? Math.max(1, num(attr(spanEl, 'val'), 1)) : 1;
        if (col === targetCol) {
          const vEl = tcPr && kid(tcPr, 'vMerge');
          merged = !!(vEl && attr(vEl, 'val') !== 'restart');
          return true;
        }
        col += span;
        return false;
      });
      if (!merged) break;
      count++;
    }
    return count;
  }

  // 单元格内容：段落 + 嵌套表格

  function renderCells(tc, ctx) {
    const out = [];
    kids(tc).forEach(function (n) {
      if (n.localName === 'p') out.push(renderParagraph(n, ctx));
      else if (n.localName === 'tbl') out.push(renderTable(n, ctx));
      else if (n.localName === 'sdt') {
        const content = kid(n, 'sdtContent');
        if (content) out.push(renderCells(content, ctx));
      }
    });
    return out.join('');
  }

  /* ---------- 正文遍历 ---------- */

  function renderBody(body, ctx) {
    const out = [];
    kids(body).forEach(function (el) {
      if (ctx.stopped) return;
      if (ctx.blockCount > MAX_BLOCKS) { ctx.stopped = true; return; }
      const name = el.localName;
      if (name === 'p') out.push(renderParagraph(el, ctx));
      else if (name === 'tbl') out.push(renderTable(el, ctx));
      else if (name === 'sdt') {
        const content = kid(el, 'sdtContent');
        if (content) out.push(renderBody(content, ctx));
      } else if (name === 'sectPr') {
        // 分节属性只影响纸张，忽略
      }
    });
    return out.join('');
  }

  /* ---------- MHTML（.mht）：正文 + 内联图片 ---------- */

  function decodeQs(s) {
    try { return decodeURIComponent(String(s || '')); } catch (e) { return String(s || ''); }
  }

  function qpDecodeToBytes(text) {
    const s = String(text || '').replace(/=\r?\n/g, '');
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s.charAt(i);
      if (ch === '=' && /^[0-9a-fA-F]{2}$/.test(s.substr(i + 1, 2))) {
        out.push(parseInt(s.substr(i + 1, 2), 16));
        i += 2;
      } else {
        out.push(s.charCodeAt(i) & 0xff);
      }
    }
    return new Uint8Array(out);
  }

  function base64ToBytes(b64) {
    const bin = atob(String(b64 || '').replace(/\s+/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* ---------- MHTML / MIME 拆解 ---------- */
  // 折叠头（续行以空格或制表符开头，WPS/Outlook 常见）

  function mimeHeaderLines(block) {
    const lines = [];
    String(block || '').split(/\r?\n/).forEach(function (line) {
      if (/^[ \t]/.test(line) && lines.length) {
        lines[lines.length - 1] += ' ' + line.replace(/^[ \t]+/, '');
      } else {
        lines.push(line);
      }
    });
    const headers = {};
    lines.forEach(function (line) {
      const m = /^([^:]+):\s*([\s\S]*)$/.exec(line);
      if (!m) return;
      const key = m[1].trim().toLowerCase();
      const value = m[2].trim();
      headers[key] = headers[key] ? headers[key] + ' ' + value : value;
    });
    return headers;
  }

  function boundaryOf(headers) {
    const ct = String((headers && headers['content-type']) || '');
    const m = /boundary\s*=\s*"?([^";\r\n\s]+)"?/i.exec(ct);
    return m ? m[1] : '';
  }

  // 拆成扁平的 part 列表：{ headers, contentType, location, contentId, encoding, body }

  function parseMimeParts(raw, boundary) {
    const text = String(raw || '');
    let b = boundary;
    if (!b) {
      const head = text.slice(0, 8192);
      const m = /boundary\s*=\s*"?([^";\r\n\s]+)"?/i.exec(head);
      b = m ? m[1] : '';
    }
    if (!b) return [];
    const segs = text.split('--' + b);
    const out = [];
    for (let i = 1; i < segs.length; i++) {
      const seg = segs[i];
      if (/^--\s*$/.test(seg.trim()) || !seg.trim()) continue;
      const at = /\r?\n\r?\n/.exec(seg);
      const head = at ? seg.slice(0, at.index) : seg;
      const body = at ? seg.slice(at.index + at[0].length) : '';
      const headers = mimeHeaderLines(head);
      if (!headers['content-type']) continue;
      const ct = headers['content-type'] || '';
      if (/^\s*multipart\//i.test(ct)) {
        const inner = boundaryOf(headers);
        if (!inner) continue;
        parseMimeParts(body, inner).forEach(function (p) { out.push(p); });
        continue;
      }
      out.push({
        headers: headers,
        contentType: ct,
        location: headers['content-location'] || '',
        contentId: headers['content-id'] || '',
        encoding: (headers['content-transfer-encoding'] || '').toLowerCase(),
        body: body
      });
    }
    return out;
  }

  function mhtBytesOf(part) {
    const body = String(part.body || '');
    if (/base64/.test(part.encoding)) {
      try { return base64ToBytes(body); } catch (e) { /* 落到下面 */ }
    }
    if (/quoted-printable/.test(part.encoding)) return qpDecodeToBytes(body);
    const out = new Uint8Array(body.length);
    for (let i = 0; i < body.length; i++) out[i] = body.charCodeAt(i) & 0xff;
    return out;
  }

  function mhtCharsetOf(part) {
    const ct = String(part.contentType || '');
    const m = /charset\s*=\s*"?([\w-]+)"?/i.exec(ct);
    return m ? m[1].toLowerCase() : '';
  }

  // MIME 头是纯 ASCII，必须逐字节解（否则会被误判成 UTF-16LE 导致结构全乱）

  function bytesToLatin1(bytes) {
    let out = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    return out;
  }

  /* 网页编码嗅探：part 头 → <meta charset> → BOM → UTF-8 严格 → GBK */

  function normalizeImageRef(value) {
    let ref = String(value == null ? '' : value).trim();
    ref = ref.replace(/^cid:/i, '').replace(/^file:\/\//i, '');
    ref = ref.replace(/^\/+/g, '').replace(/\\/g, '/');
    try { ref = decodeURIComponent(ref); } catch (e) { /* 保留原值 */ }
    ref = ref.split(/[?#]/)[0].replace(/^\.\//, '');
    return ref;
  }

  function resourceLookup(resources, ref) {
    if (!resources || !ref) return null;
    const normalized = normalizeImageRef(ref);
    if (!normalized) return null;
    const base = normalized.split('/').pop();
    const parts = normalized.split('/').filter(Boolean);
    const suffixes = [];
    for (let i = 0; i < parts.length; i++) suffixes.push(parts.slice(i).join('/'));
    const keys = [String(ref).trim(), normalized, base].concat(suffixes);
    keys.push.apply(keys, keys.map(function (key) { return String(key).toLowerCase(); }));
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key && Object.prototype.hasOwnProperty.call(resources, key)) return resources[key];
    }
    return null;
  }

  function isRemoteRef(ref) {
    return /^(https?:|data:|blob:|\/\/)/i.test(String(ref || ''));
  }

  /* 把 html 里的 cid / 相对路径图片换成 data:；找不到的直接删掉，避免一大片碎图标 */

  function resolveHtmlResources(html, resources) {
    const src = String(html || '');
    if (!/\<img|imagedata|url\(/i.test(src)) return src;
    if (typeof DOMParser === 'undefined') return src;
    let doc;
    try { doc = new DOMParser().parseFromString(src, 'text/html'); } catch (e) { return src; }
    const root = doc.body || doc.documentElement;
    if (!root) return src;

    // VML：<v:imagedata src="..."> → <img>
    const all = root.getElementsByTagName('*');
    const vml = [];
    for (let i = 0; i < all.length; i++) {
      const name = String(all[i].localName || all[i].tagName || '').toLowerCase();
      if (!/(^|:)imagedata$/.test(name)) continue;
      const raw = all[i].getAttribute('src') || all[i].getAttribute('o:href') || all[i].getAttribute('href');
      if (raw) vml.push({ node: all[i], ref: raw });
    }
    vml.forEach(function (item) {
      const hit = resourceLookup(resources, item.ref);
      if (!hit) return;
      const img = doc.createElement('img');
      img.setAttribute('src', hit);
      const shape = item.node.parentNode;
      const host = shape && shape.parentNode ? shape.parentNode : shape;
      const target = shape && /shape$/i.test(String(shape.localName || '')) ? shape : item.node;
      if (host) host.replaceChild(img, target);
    });

    Array.prototype.forEach.call(root.querySelectorAll('img'), function (img) {
      const raw = img.getAttribute('src') || '';
      if (!raw) { img.remove(); return; }
      if (isRemoteRef(raw)) return;
      const hit = resourceLookup(resources, raw);
      if (hit) { img.setAttribute('src', hit); return; }
      img.remove();
    });

    Array.prototype.forEach.call(root.querySelectorAll('[style]'), function (el) {
      const st = el.getAttribute('style') || '';
      if (st.indexOf('url(') < 0) return;
      const next = st.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/gi, function (whole, u) {
        if (isRemoteRef(u)) return whole;
        const hit = resourceLookup(resources, u);
        return hit ? 'url(' + hit + ')' : 'none';
      });
      if (next !== st) el.setAttribute('style', next);
    });

    return root.innerHTML;
  }

  function bytesToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    return btoa(bin);
  }

  /* 纯 .htm/.html：嗅探编码后净化，再解析同目录常见图片引用（读不到的删掉） */

  const MAX_BLOCKS = 3000;
  const MAX_IMAGES = 100;
  const EMU_PER_PX = 9525;
  const TWIP_PER_PX = 15;

  const MIME_BY_EXT = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml',
    tif: 'image/tiff', tiff: 'image/tiff'
  };

  const HIGHLIGHT = {
    yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff',
    blue: '#0000ff', red: '#ff0000', darkblue: '#000080', darkcyan: '#008080',
    darkgreen: '#008000', darkmagenta: '#800080', darkred: '#800000',
    darkyellow: '#808000', gray: '#808080', lightgray: '#c0c0c0', black: '#000000'
  };

  const ALIGN = {
    left: 'left', start: 'left', right: 'right', end: 'right',
    center: 'center', both: 'justify', justify: 'justify', distribute: 'justify'
  };

  /* ---------- DOM 小工具（按 localName 取，忽略命名空间前缀） ---------- */

  function asciiHead(bytes, max) {
    const n = Math.min(bytes.length, max || 8192);
    let out = '';
    for (let i = 0; i < n; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  async function renderDocx(bytes) {
    const pkg = await TZ.DocParse.openPackage(bytes);
    if (!pkg) return null;
    const docXml = await pkg.text('word/document.xml');
    if (!docXml) return null;
    const rels = parseRels(await pkg.text('word/_rels/document.xml.rels'));
    const styles = readStyles(await pkg.text('word/styles.xml'));
    const media = {};
    const urls = [];
    const targets = collectImageTargets(rels);
    const names = Object.keys(targets);
    for (let i = 0; i < names.length && i < MAX_IMAGES; i++) {
      const data = await pkg.bytes(names[i]);
      if (!data || !data.length) continue;
      const url = URL.createObjectURL(new Blob([data], { type: targets[names[i]] }));
      media[names[i]] = url;
      urls.push(url);
    }
    const doc = parseXml(docXml);
    if (!doc) return null;
    const body = kid(doc.documentElement, 'body');
    if (!body) return null;
    const sect = kid(body, 'sectPr');
    const pgSz = sect && kid(sect, 'pgSz');
    const pgW = pgSz ? num(attr(pgSz, 'w'), 0) : 0;
    // Word 默认页宽 21cm = 11906 twip；减去左右页边距才是正文宽度
    const marginL = num(attr(sect && kid(sect, 'pgMar') || {}, 'left'), 1800);
    const marginR = num(attr(sect && kid(sect, 'pgMar') || {}, 'right'), 1800);
    const textWidth = (pgW || 11906) - marginL - marginR;

    const ctx = { rels: rels, styles: styles, media: media, images: 0, blockCount: 0, stopped: false };
    let headHtml = '';
    const headRefs = sect ? kidAll(sect, 'headerReference') : [];
    const order = { first: 0, default: 1, even: 2 };
    headRefs.sort(function (a, b) {
      return (order[attr(a, 'type')] == null ? 9 : order[attr(a, 'type')]) -
        (order[attr(b, 'type')] == null ? 9 : order[attr(b, 'type')]);
    });
    for (let hi = 0; hi < headRefs.length && hi < 2; hi++) {
      const rid = attr(headRefs[hi], 'id') || attr(headRefs[hi], 'embed');
      const rel = rels[rid];
      if (!rel || !rel.target || rel.external) continue;
      const t = String(rel.target);
      const path = t.charAt(0) === '/' ? t.slice(1) : 'word/' + t;
      const headXml = await pkg.text(path);
      if (!headXml) continue;
      const headDoc = parseXml(headXml);
      const hdr = headDoc && headDoc.documentElement;
      if (!hdr) continue;
      const piece = renderBody(hdr, ctx).trim();
      if (piece) { headHtml += '<div class="dv-head">' + piece + '</div>'; break; }
    }
    const html = headHtml + renderBody(body, ctx);
    return {
      html: html,
      urls: urls,
      truncated: ctx.stopped,
      blocks: ctx.blockCount,
      /* 原稿正文宽度（twip → px），让调用方按栏宽等比缩放 */
      width: Math.max(200, Math.round(twip(textWidth)))
    };
  }

  /* 按原稿宽度缩放：外层固定原宽，内层 scale 填满容器，避免窄栏把表格压扁 */

  function fitWrapped(html, width) {
    const w = Math.round(width || 800);
    return '<div class="dv-fit" data-w="' + w + '">' +
      '<div class="dv-fit-inner" style="width:' + w + 'px">' + html + '</div>' +
      '</div>';
  }

  /* 量容器宽度后等比缩放；transform 不改变布局高度，需手动写回 */

  function bindFit(scope) {
    const root = scope || document;
    const fits = root.querySelectorAll ? root.querySelectorAll('.dv-fit') : [];
    Array.prototype.forEach.call(fits, function (fit) {
      const inner = fit.firstElementChild;
      if (!inner) return;
      const natural = parseFloat(inner.getAttribute('data-w')) || inner.getBoundingClientRect().width;
      const avail = fit.clientWidth;
      if (!natural || !avail) return;
      const scale = Math.min(1, avail / natural);
      inner.style.transform = scale < 0.999 ? 'scale(' + (Math.round(scale * 1000) / 1000) + ')' : '';
      fit.style.height = scale < 0.999 ? Math.ceil(inner.offsetHeight * scale) + 'px' : '';
    });
  }

  function renderMht(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    const raw = bytesToLatin1(b);
    const parts = parseMimeParts(raw);
    if (!parts.length) return null;

    const resources = {};
    const htmlParts = [];
    parts.forEach(function (part) {
      const ct = String(part.contentType || '').trim();
      if (/^text\/html\b/i.test(ct)) { htmlParts.push(part); return; }
      if (!/^(image\/|application\/octet-stream)/i.test(ct)) return;
      let data;
      try { data = mhtBytesOf(part); } catch (e) { return; }
      if (!data || !data.length) return;
      const mime = /^image\//i.test(ct) ? ct.split(';')[0].trim() : 'application/octet-stream';
      let b64;
      try { b64 = bytesToBase64(data); } catch (e) { return; }
      const url = 'data:' + mime + ';base64,' + b64;
      const cid = String(part.contentId || '').replace(/^<|>$/g, '').trim();
      const loc = String(part.location || '').replace(/^file:\/\/\/?/i, '').trim();
      const keyBase = (cid || loc).split(/[\\/]/).pop();
      [cid, loc, keyBase].forEach(function (key) {
        if (!key) return;
        const normalized = normalizeImageRef(key);
        resources[key] = url;
        resources[normalized] = url;
        resources[String(key).toLowerCase()] = url;
        resources[normalized.toLowerCase()] = url;
      });
    });

    if (!htmlParts.length) {
      // 没有 text/html 段：整份当网页按键误判兜底
      return sanitizeHtml(decodeHtmlBytes(b, ''));
    }

    // 正文优先：跳过页眉/页脚页，再取最长的一段
    const main = htmlParts.filter(function (p) {
      return !/header|footer/i.test(String(p.location || ''));
    }).sort(function (a, b2) { return b2.body.length - a.body.length; })[0] ||
      htmlParts.sort(function (a, b2) { return b2.body.length - a.body.length; })[0];

    let html;
    try {
      html = decodeHtmlBytes(mhtBytesOf(main), mhtCharsetOf(main));
    } catch (e) {
      html = '';
    }
    if (!html) return null;
    html = sanitizeHtml(html);
    html = resolveHtmlResources(html, resources);
    return html;
  }

  function renderHtml(bytes, resources) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    let html = '';
    try { html = decodeHtmlBytes(b, ''); } catch (e) { html = ''; }
    if (!html) return '';
    html = sanitizeHtml(html);
    if (resources && Object.keys(resources).length) html = resolveHtmlResources(html, resources);
    return html;
  }

  /* ---------- 网页净化：去脚本与事件属性，保留排版 ---------- */

  function sanitizeHtml(html) {
    let s = String(html || '');
    s = s.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<script\b[^>]*\/?>/gi, '');
    s = s.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
    s = s.replace(/<object\b[\s\S]*?<\/object>/gi, '');
    s = s.replace(/<embed\b[^>]*>/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
    s = s.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*(\2)/gi, '$1=$2#$3');
    s = s.replace(/<(meta|link)\b[^>]*>/gi, '');
    return s;
  }

  /* ---------- 主入口 ---------- */

  function plainHtml(text, note) {
    const body = '<pre class="dv-plain">' + TZ.esc(String(text || '')) + '</pre>';
    const tip = note ? '<div class="dv-note">' + TZ.esc(note) + '</div>' : '';
    return tip + body;
  }

  /* 判断是否 Word 文档：ZIP 头，或 Flat OPC。
     注意不能用 decodeText 猜编码——前 4KB 是纯 ASCII 的 XML 声明，
     启发式会误判成 UTF-16LE（MHT 踩过同一个坑），改为逐字节拉丁解。 */

  function isDocx(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (TZ.DocParse.isZipBytes(b)) return true;
    const head = asciiHead(b, 8192);
    return /<pkg:package\b/i.test(head) ||
      (/<\?mso-application\b/i.test(head) && /<w:document\b|<w:body\b/i.test(head));
  }

  function decodeHtmlBytes(bytes, charset) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    let hint = String(charset || '').toLowerCase();
    if (!hint) {
      const head = bytesToLatin1(b.subarray(0, Math.min(b.length, 4096)));
      const m = /charset\s*=\s*["']?\s*([\w-]+)/i.exec(head);
      if (m) hint = m[1].toLowerCase();
    }
    if (/^(gb2312|gbk|gb18030|cp936|x-gbk|csgb2312|chinese|iso-?ir-?58)/.test(hint)) hint = 'gbk';
    if (/^utf-?16/.test(hint)) {
      try { return new TextDecoder('utf-16le').decode(b); } catch (e) { /* ignore */ }
    }
    return TZ.DocParse.decodeText(b, hint);
  }


    /* ---------- Word 97-2003 .doc：来自 npf-doc.js 的块结构 ---------- */
    /* 与 docx 共用 runCss/paraCss，保证两种格式观感一致。
       正文段落没写首行缩进时补 2em（中文公文习惯，WPS 里靠样式实现）。 */
    function renderDocFormat(rich) {
        if (!rich || !rich.blocks || !rich.blocks.length) return null;
        const out = [];
        rich.blocks.forEach(function (b) {
            const para = b.para || {};
            const css = [];
            const pc = paraCss(para);
            if (pc) css.push(pc);
            const text = (b.runs || []).map(function (r) { return r.text || ''; }).join('');
            const bigSize = (b.runs || []).reduce(function (m, r) { return Math.max(m, r.size || 0); }, 0);
            const looksTitle = bigSize >= 20 && text.trim().length > 0 && text.trim().length <= 40;
            if (looksTitle && !para.align) css.push('text-align:center');
            const isHead = para.align === 'center' || looksTitle ||
                /^\s*(纪律检查委员会|[一二三四五六七八九十]+、)/.test(text);
            if (!para.indentFirst && !para.indentLeft && !isHead && text.length > 12) {
                css.push('text-indent:2em');
            }
            const html = (b.runs || []).map(function (r) {
                const rc = runCss(r);
                if (!/[\u0000-\u001f]/.test(r.text || '') || /\S/.test(r.text)) {
                    const body = TZ.esc ? TZ.esc(r.text) : r.text;
                    return rc ? '<span style="' + rc + '">' + body + '</span>' : body;
                }
                return '';
            }).join('');
            out.push('<p class="dv-p"' + (css.length ? ' style="' + css.join(';') + '"' : '') + '>' +
                (html || '&nbsp;') + '</p>');
        });
        return {
            ok: true,
            blocks: rich.blocks.length,
            html: '<div class="dv-sheet dv-doc">' + out.join('') + '</div>',
            stats: rich.stats
        };
    }

    TZ.DocParse.decodeText = decodeText;
    TZ.DocParse.htmlToText = htmlToText;
    TZ.DocParse.openPackage = openPackage;
    TZ.DocParse.isZipBytes = isZipBytes;

    TZ.DocView = {
        renderDocx: renderDocx,
        renderDocFormat: renderDocFormat,
        fitWrapped: fitWrapped,
        bindFit: bindFit,
        renderMht: renderMht,
        renderHtml: renderHtml,
        sanitizeHtml: sanitizeHtml,
        plainHtml: plainHtml,
        isDocx: isDocx
    };

    window.NpfDocView = TZ.DocView;
    window.NpfDocParse = TZ.DocParse;
})();
