"""Run a retained office tool against the desktop-managed offline model."""
import contextlib
import json
import os
from pathlib import Path
import sys
import urllib.request
import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
tool = sys.argv[1]
legacy = {'analysis':('多维分析','多维分析.html'), 'notes':('致知笔记','致知笔记.html'),
          'notepad':('记事本','电子记事本.html'), 'query':('资料查询','查询工具.html')}
if tool in legacy:
    folder, entry = legacy[tool]
    class LegacyHandler(SimpleHTTPRequestHandler):
        def log_message(self, *args): pass
        def list_directory(self, path): self.send_error(403)
        def do_GET(self):
            if self.headers.get('Host') != origin[7:]:
                return self.send_error(403)
            if self.path == '/':
                from urllib.parse import quote
                self.path = '/' + quote(entry)
            super().do_GET()
    handler = functools.partial(LegacyHandler, directory=str(ROOT/'legacy'/folder))
    with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
        origin = f'http://127.0.0.1:{server.server_port}'
        print(origin, flush=True)
        def wait_for_parent():
            sys.stdin.buffer.read()
            server.shutdown()
        threading.Thread(target=wait_for_parent, daemon=True).start()
        server.serve_forever()
    raise SystemExit(0)
if tool not in ('writer', 'office'):
    raise SystemExit('Unknown office tool')
sys.path.insert(0, str(ROOT / tool))
module = __import__('writer' if tool == 'writer' else 'suite')
if sys.platform.startswith('linux'):
    data_root = Path(os.environ.get('XDG_CONFIG_HOME') or Path.home() / '.config')
else:
    data_root = Path(os.environ.get('LOCALAPPDATA') or Path.home() / 'Library/Application Support')
module.DATA = data_root / '致知知识工作台' / 'office'
module.DB = module.DATA / 'knowledge.sqlite3'
endpoint = os.environ['ZZ_MODEL_URL']
key = os.environ['ZZ_MODEL_KEY']

if tool == 'writer':
    def active_model():
        req = urllib.request.Request(endpoint + '/v1/models', headers={'Authorization': 'Bearer ' + key})
        try:
            with module.HTTP.open(req, timeout=200) as response:
                json.load(response)
            return None, {'ready': True, 'name': '统一离线文字模型'}
        except OSError:
            return None, {'ready': False}

    def start_engine(pulse, model=None):
        module.endpoint = endpoint
        module.ENGINE_KEY = key
    module.active_model = active_model
    module.start_engine = start_engine
    # Model files are managed only by the native import flow.
    def import_model(*args):
        raise ValueError('请从左侧「离线模型」导入或切换模型。')
    module.import_model = import_model
else:
    def start_engine():
        module.api = endpoint
        module.engine_key = key
    module.start_engine = start_engine

# The native reverse proxy maps the same-origin embedded view to loopback.
# Keep the original host, origin and session-token checks in the tool handlers.
original_header = module.Handler.send_header
def send_header(self, name, value):
    if name.lower() == 'x-frame-options':
        value = 'SAMEORIGIN'
    if name.lower() == 'content-security-policy':
        value = value.replace("frame-ancestors 'none'", "frame-ancestors 'self'")
    return original_header(self, name, value)
module.Handler.send_header = send_header
sys.argv = [sys.argv[0], '--app-bundle', '--headless']
module.run()
