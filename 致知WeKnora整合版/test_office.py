"""Exercise the retained office services without a GUI or external network."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parent


class OfficeBridgeTest(unittest.TestCase):
    @unittest.skipUnless(os.environ.get('ZZ_TEST_MODEL_URL'), 'requires a live local model gateway')
    def test_actual_models(self):
        client=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for tool in ('writer','office'):
            with self.subTest(tool=tool), tempfile.TemporaryDirectory() as data:
                env=dict(os.environ,LOCALAPPDATA=data,XDG_CONFIG_HOME=data,ZZ_MODEL_URL=os.environ['ZZ_TEST_MODEL_URL'],ZZ_MODEL_KEY=os.environ['ZZ_TEST_MODEL_KEY'])
                process=subprocess.Popen([sys.executable,'-B',str(ROOT/'office/bridge.py'),tool],
                                         env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
                try:
                    origin=process.stdout.readline().strip()
                    with client.open(origin,timeout=5) as response: page=response.read().decode()
                    key=re.search(r'name="?session"? content="([^"]+)"',page).group(1)
                    payload=({'action':'generate','sample':'清晨，同学们走进图书馆。书页间的知识，点亮了新的一天。','topic':'写一段 100 字以内的读书活动短文，正文必须包含“明德学校”四个字，不编造时间和人数。'} if tool=='writer'
                             else {'action':'proof','text':'今天的天气非常好，同学们正在认真地读书。'})
                    request=urllib.request.Request(origin+'/api',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','Origin':origin,'X-Session':key})
                    with client.open(request,timeout=240) as response:
                        if tool=='writer':
                            events=[json.loads(line) for line in response if line.strip()]
                            self.assertTrue(any(event['type']=='done' for event in events),events)
                            self.assertFalse(any(event['type']=='error' for event in events),events)
                            answer=''.join(event['value'] for event in events if event['type']=='text')
                            self.assertIn('明德',answer)
                        else:
                            result=json.load(response)['result']
                            self.assertIn('同学们',result['answer'])
                finally:
                    process.stdin.close()
                    try: process.wait(timeout=10)
                    except subprocess.TimeoutExpired: process.kill();process.wait()
                    stderr=process.stderr.read()
                    process.stdout.close();process.stderr.close()
                    self.assertEqual(process.returncode,0,stderr)

    def test_legacy_pages_and_parent_shutdown(self):
        client=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        for tool in ('analysis','notes','notepad','query'):
            with self.subTest(tool=tool):
                process=subprocess.Popen([sys.executable,'-B',str(ROOT/'office/bridge.py'),tool],
                                         stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
                try:
                    origin=process.stdout.readline().strip()
                    self.assertTrue(origin.startswith('http://127.0.0.1:'),origin)
                    with client.open(origin,timeout=5) as response:
                        self.assertEqual(response.status,200)
                        self.assertIn('<html',response.read().decode().lower())
                    bad=urllib.request.Request(origin,headers={'Host':'untrusted.example'})
                    with self.assertRaises(urllib.error.HTTPError) as rejected:
                        client.open(bad,timeout=5)
                    self.assertEqual(rejected.exception.code,403)
                finally:
                    process.stdin.close()
                    try: process.wait(timeout=10)
                    except subprocess.TimeoutExpired: process.kill();process.wait()
                    stderr=process.stderr.read()
                    process.stdout.close();process.stderr.close()
                    self.assertEqual(process.returncode,0,stderr)

    def test_pages_assets_and_session_protection(self):
        for tool in ('writer','office'):
            with self.subTest(tool=tool), tempfile.TemporaryDirectory() as data:
                env=dict(os.environ,LOCALAPPDATA=data,XDG_CONFIG_HOME=data,ZZ_MODEL_URL='http://127.0.0.1:1/primary',ZZ_MODEL_KEY='test')
                process=subprocess.Popen([sys.executable,'-B',str(ROOT/'office/bridge.py'),tool],
                                         env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
                try:
                    origin=process.stdout.readline().strip()
                    self.assertTrue(origin.startswith('http://127.0.0.1:'),origin)
                    client=urllib.request.build_opener(urllib.request.ProxyHandler({}))
                    with client.open(origin,timeout=5) as response:
                        page=response.read().decode()
                        self.assertIn("frame-ancestors 'self'",response.headers['Content-Security-Policy'])
                    key=re.search(r'name="?session"? content="([^"]+)"',page).group(1)
                    for asset in ('ui.js','ui.css','logo.png'):
                        with client.open(origin+'/'+asset,timeout=5) as response:
                            self.assertEqual(response.status,200)
                    payload=json.dumps({'action':'history' if tool=='writer' else 'list'}).encode()
                    bad=urllib.request.Request(origin+'/api',data=payload,headers={'Content-Type':'application/json','Origin':origin})
                    with self.assertRaises(urllib.error.HTTPError) as rejected:
                        client.open(bad,timeout=5)
                    self.assertEqual(rejected.exception.code,403)
                    good=urllib.request.Request(origin+'/api',data=payload,headers={'Content-Type':'application/json','Origin':origin,'X-Session':key})
                    with client.open(good,timeout=5) as response:
                        self.assertEqual(response.status,200)
                        json.load(response)
                    self.assertTrue((Path(data)/'致知知识工作台/office/knowledge.sqlite3').is_file())
                finally:
                    process.stdin.close()
                    try: process.wait(timeout=10)
                    except subprocess.TimeoutExpired: process.kill();process.wait()
                    stderr=process.stderr.read()
                    process.stdout.close();process.stderr.close()
                    self.assertEqual(process.returncode,0,stderr)

if __name__=='__main__': unittest.main()
