"""Apply the narrowly scoped loopback adapter to a build-local Wails copy."""
from pathlib import Path
import shutil

root = Path('/workspace')
source = root / '.build-tools/gopath/pkg/mod/github.com/wailsapp/wails/v2@v2.12.0'
target = Path('/build/wails-v2.12.0')
if not target.exists():
    shutil.copytree(source, target)
for path in target.rglob('*'):
    if path.is_file():
        path.chmod(path.stat().st_mode | 0o200)
frontend = target / 'internal/frontend/desktop/linux/frontend.go'
content = frontend.read_text()
marker = '\t\tresult.assets = assets\n'
if 'result.startZhizhiLoopback()' not in content:
    assert content.count(marker) == 1
    frontend.write_text(content.replace(marker, marker + '\t\tresult.startZhizhiLoopback()\n'))
shutil.copy2(root / 'linux/zhizhi_loopback.go', frontend.parent / 'zhizhi_loopback.go')
shutil.copy2(root / 'linux/zhizhi_loopback_test.go', frontend.parent / 'zhizhi_loopback_test.go')
