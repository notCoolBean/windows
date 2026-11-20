"""Offline document retrieval and checks. All offsets refer to the imported text."""
import base64
import csv
from collections import Counter
import io
import json
import math
import re
import sqlite3
import zipfile
import xml.etree.ElementTree as ET


def connect(path):
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db


def initialize(db):
    db.executescript("""
    CREATE TABLE IF NOT EXISTS docs(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,role TEXT NOT NULL,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS chunks(id INTEGER PRIMARY KEY AUTOINCREMENT,doc INTEGER REFERENCES docs(id) ON DELETE CASCADE,start INTEGER,body TEXT);
    CREATE TABLE IF NOT EXISTS sheets(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,grid TEXT NOT NULL);
    """)


def insert_doc(db, title, role, body):
    title, body = title.strip(), body.strip().replace('\r\n','\n')
    if not title or not body or len(title)>160 or len(body)>500000 or role not in ('资料','范文','生活指南'):
        raise ValueError('请填写标题（最多 160 字）、正文（最多 50 万字）并选择用途。')
    doc = db.execute('INSERT INTO docs(title,role,body) VALUES(?,?,?)',(title,role,body)).lastrowid
    pos=0
    while pos<len(body):
        end=min(pos+420,len(body))
        if end<len(body):
            cut=max(body.rfind(c,pos+220,end) for c in '。！？；\n')
            if cut>=0: end=cut+1
        db.execute('INSERT INTO chunks(doc,start,body) VALUES(?,?,?)',(doc,pos,body[pos:end]))
        if end==len(body): break
        pos=end-48
    return doc


def terms(text):
    counts=Counter()
    for word in re.findall(r'[\u3400-\u9fff]+|[a-z0-9]+',text.lower()):
        if '\u3400'<=word[0]<='\u9fff':
            counts.update(word[i:i+2] for i in range(len(word)-1))
            if len(word)==1: counts[word]+=1
        else: counts[word]+=1
    return counts


def retrieve(db,query,role='资料',limit=4):
    query=terms(query)
    rows=db.execute('SELECT c.id,c.start,c.body,d.title,d.id AS doc FROM chunks c JOIN docs d ON d.id=c.doc WHERE d.role=? ORDER BY c.id',(role,)).fetchall()
    matches=[]; df=Counter(); length=0
    for row in rows:
        tokens=terms(row['body']+' '+row['title'])
        hits={t:tokens[t] for t in query if tokens[t]}
        n=sum(tokens.values())
        length+=n
        if hits:
            df.update(hits.keys()); matches.append((row,n,hits))
    N=len(rows)
    scored=[]
    for row,n,hits in matches:
        score=sum(math.log1p((N-df[t]+0.5)/(df[t]+0.5))*f*2.2/(f+1.2*(0.25+0.75*n/max(1,length/N))) for t,f in hits.items())
        scored.append((score,dict(row)))
    return [r for _,r in sorted(scored,key=lambda pair:-pair[0])[:limit]]


def import_text(name,encoded):
    data=base64.b64decode(encoded,validate=True)
    if len(data)>8*1024**2: raise ValueError('文件上限为 8 MB。')
    if name.lower().endswith('.docx'):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            item=z.getinfo('word/document.xml')
            if item.file_size>12*1024**2: raise ValueError('文档正文过大。')
            xml=z.read(item)
            if b'<!DOCTYPE' in xml.upper(): raise ValueError('文档 XML 格式不受支持。')
            root=ET.fromstring(xml)
            ns='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            return '\n'.join(''.join(t.text or '' for t in p.iter(ns+'t')) for p in root.iter(ns+'p'))
    if not name.lower().endswith(('.txt','.md','.csv','.tsv')): raise ValueError('不支持此文件类型。')
    if data.startswith((b'\xff\xfe',b'\xfe\xff')): return data.decode('utf-16')
    try: return data.decode('utf-8-sig')
    except UnicodeDecodeError: return data.decode('gb18030')


def review(text,sources,style):
    issues=[]
    normal=lambda s: re.sub(r'[\W_]','',s).lower()
    ref=normal(style)
    gram=16
    for i,line in enumerate(text.splitlines(),1):
        if not line.strip(): continue
        ids=[int(x) for x in re.findall(r'[【\[]S(\d+)[】\]]',line,re.I)]
        if any(not 1<=x<=len(sources) for x in ids): issues.append(f'第 {i} 行有无效来源编号。')
        clean=re.sub(r'[【\[]S\d+[】\]]','',line,flags=re.I)
        cited=' '.join(sources[x-1]['body'] for x in ids if 1<=x<=len(sources))
        if sources and not ids and len(clean)>20: issues.append(f'第 {i} 行未标出处，请核对其中的事实。')
        nums=lambda s:set(re.findall(r'\d+(?:[.,]\d+)*%?',s))
        missing=nums(clean)-nums(cited)
        if missing: issues.append(f'第 {i} 行数字未在所引原文中找到：'+ '、'.join(sorted(missing)))
        n=normal(clean)
        common=next((n[j:j+gram] for j in range(len(n)-gram+1) if n[j:j+gram] in ref),None)
        if common: issues.append(f'第 {i} 行与范文连续重合至少 {gram} 字：“{common}”。')
    return issues


def read_grid(text,sep):
    rows=list(csv.reader(io.StringIO(text),delimiter=sep))
    if not rows or len(rows)>2000 or max(map(len,rows))>64: raise ValueError('请提供 1–2000 行、最多 64 列的数据。')
    return rows
