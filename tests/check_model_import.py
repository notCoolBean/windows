import contextlib, http.client, json, os, re, subprocess, sys, tempfile
from pathlib import Path
from urllib.parse import urlsplit, quote
root=Path(sys.argv[1]).resolve()
model=Path(sys.argv[2]).resolve()
binary=root/'python/python.exe' if os.name=='nt' else root.parent/'python/bin/python3.11'
@contextlib.contextmanager
def app(data):
    sub=subprocess.Popen([binary,'-I','-B',root/'writer.py','--app-bundle'],env=dict(os.environ,LOCALAPPDATA=data),stdin=subprocess.PIPE,stdout=subprocess.PIPE)
    try:
        addr=sub.stdout.readline().decode().strip()
        u=urlsplit(addr)
        def call(path,body=None,headers=None):
            c=http.client.HTTPConnection(u.hostname,u.port,timeout=600)
            try:
                c.request('GET' if body is None else 'POST',path,body,headers or {})
                r=c.getresponse()
                return r.status,r.read()
            finally: c.close()
        code,index=call('/')
        assert code==200 and b'id="chooseModel"' in index
        session=re.search(rb'name="session" content="([^"]+)"',index).group(1).decode()
        auth={'Origin':addr,'X-Session':session}
        def post(action,**kwargs):
            return call('/api',json.dumps(dict(action=action,**kwargs)).encode(),auth)
        yield post,call,auth
    finally:
        sub.stdin.close()
        sub.wait(timeout=30)
with tempfile.TemporaryDirectory() as data:
    with app(data) as (post,call,auth):
        assert json.loads(post('modelStatus')[1])=={'ready':False}
        with model.open('rb') as f:
            code,body=call('/model',f,{**auth,'Content-Length':str(model.stat().st_size),'X-Model-Name':quote(model.name)})
        print('import',code,body,flush=True)
        assert code==200 and json.loads(body)['ready']
        code,body=call('/model',b'GGUF'+bytes(64),{**auth,'X-Model-Name':'bad.gguf'})
        assert code==400,body
        assert json.loads(post('modelStatus')[1])['name']==model.name
    with app(data) as (post,_,__):
        assert json.loads(post('modelStatus')[1])['ready']
        code,body=post('generate',sample='清晨，街角的店开了门。茶香缓缓飘过来。',topic='写一段关于雨后散步的短文，五十字。')
        events=[json.loads(line) for line in body.splitlines()]
        assert code==200 and events[-1]['type']=='done' and any(x['type']=='text' for x in events),events[-1]
        print('restart, failed replacement and article generation passed',flush=True)
