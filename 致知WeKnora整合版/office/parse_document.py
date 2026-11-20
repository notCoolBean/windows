"""Text extraction for offline knowledge ingestion. No network or Office install."""
import io
import json
from pathlib import Path
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0,str(Path(__file__).resolve().parent/'vendor'))
MAX_XML=64*1024*1024


def xml(archive,name):
    info=archive.getinfo(name)
    if info.file_size>MAX_XML:
        raise ValueError('文档解压后过大，请拆分后导入。')
    data=archive.read(name)
    if b'<!DOCTYPE' in data.upper():
        raise ValueError('不支持包含 DTD 的文档。')
    return ET.fromstring(data)


def extract(data,kind):
    if kind=='pdf':
        from pypdf import PdfReader
        reader=PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ValueError('请先解除 PDF 密码保护再导入。')
        if len(reader.pages)>2000:
            raise ValueError('PDF 超过 2000 页，请拆分后导入。')
        pages=[]
        for number,page in enumerate(reader.pages,1):
            text=page.extract_text() or ''
            if not text.strip():
                raise ValueError(f'PDF 第 {number} 页没有可提取的文字；请先进行 OCR 后导入，或将图片交给视觉模型识别。')
            pages.append(f'## 第 {number} 页\n\n{text}')
        return '\n\n'.join(pages)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if sum(item.file_size for item in archive.infolist())>128*1024*1024:
            raise ValueError('文档解压后超过 128 MB，请拆分后导入。')
        if kind=='docx':
            root=xml(archive,'word/document.xml')
            ns='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            return '\n'.join(''.join(node.text or '' for node in p.iter(ns+'t')) for p in root.iter(ns+'p'))
        if kind=='pptx':
            names=sorted((n for n in archive.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)),key=lambda n:int(re.search(r'slide(\d+)',n).group(1)))
            ns='{http://schemas.openxmlformats.org/drawingml/2006/main}'
            return '\n\n'.join(f'## 幻灯片 {i}\n'+ '\n'.join(n.text or '' for n in xml(archive,name).iter(ns+'t')) for i,name in enumerate(names,1))
        if kind=='xlsx':
            ns='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
            strings=[]
            if 'xl/sharedStrings.xml' in archive.namelist():
                strings=[''.join(t.text or '' for t in si.iter(ns+'t')) for si in xml(archive,'xl/sharedStrings.xml').iter(ns+'si')]
            output=[]
            names=sorted(n for n in archive.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml',n))
            for name in names:
                output.append('## '+name.rsplit('/',1)[-1])
                for row in xml(archive,name).iter(ns+'row'):
                    values=[]
                    for cell in row.findall(ns+'c'):
                        value=cell.findtext(ns+'v','')
                        if cell.get('t')=='s': value=strings[int(value)]
                        elif cell.get('t')=='inlineStr': value=''.join(n.text or '' for n in cell.iter(ns+'t'))
                        values.append(f"{cell.get('r','')}: {value}")
                    output.append(' | '.join(values))
            return '\n'.join(output)
    raise ValueError('不支持此文档类型。')


if __name__=='__main__':
    try:
        text=extract(sys.stdin.buffer.read(51*1024*1024),sys.argv[1])
        if not text.strip(): raise ValueError('文档未包含可提取的文字。')
        if len(text)>10_000_000: raise ValueError('文档文字过多，请拆分后导入。')
        print(json.dumps({'text':text},ensure_ascii=False))
    except Exception as error:
        print(str(error),file=sys.stderr)
        raise SystemExit(1)
