"""Assemble native offline packages with validated, shared model weights."""
from pathlib import Path
import argparse
import os
import plistlib
import shutil
import subprocess
import tempfile
import zipfile
from bundle_models import prepare as prepare_models

ROOT = Path(__file__).resolve().parent
REPO = ROOT / 'WeKnora'
WORKSPACE = ROOT.parent
BUILD = ROOT / '.build-tools'
DIST = ROOT / 'dist'
NAME = '致知知识工作台'
MAC_RUNTIME = WORKSPACE / 'MiniCPM本地看图/办公集成版/本地看图.app/Contents'
WIN_SUITE = WORKSPACE / '致知离线工作台'


def office_files(dest):
    dest.mkdir(parents=True, exist_ok=True)
    if dest.resolve() != (ROOT / 'office').resolve():
        shutil.copy2(ROOT / 'office/bridge.py', dest)
        shutil.copy2(ROOT / 'office/parse_document.py', dest)
        shutil.copytree(ROOT / 'office/vendor', dest / 'vendor', dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    for folder in ('多维分析','致知笔记','记事本','资料查询'):
        shutil.copytree(WIN_SUITE / '应用' / folder, dest / 'legacy' / folder, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns('.DS_Store','__pycache__','*.pyc'))
    for tool, source, main in [
        ('writer', WORKSPACE / '文章仿写版/源码', 'writer.py'),
        ('office', WIN_SUITE, 'suite.py'),
    ]:
        target = dest / tool
        target.mkdir(exist_ok=True)
        shutil.copy2(source / main, target)
        if tool == 'office':
            script = (target / main).read_text()
            script = script.replace("request=urllib.request.Request(api+'/v1/chat/completions'", "request=urllib.request.Request((api.rsplit('/',1)[0]+'/vision' if image else api)+'/v1/chat/completions'")
            (target / main).write_text(script)
        shutil.copy2(source / 'rag.py', target)
        shutil.copytree(source / 'web', target / 'web', dirs_exist_ok=True)
        for path in (target / 'web').glob('*'):
            if path.suffix not in ('.html', '.js') or path.name == 'editor.js':
                continue
            text = path.read_text()
            for name in ('ui.js', 'ui.css', 'editor.js', 'api', 'model'):
                text = text.replace('"/' + name + '"', '"./' + name + '"')
                text = text.replace("'/" + name + "'", "'./" + name + "'")
            if tool == 'writer' and path.name == 'ui.js':
                text = text.replace("el('chooseModel').onclick=()=>el('modelFile').click();",
                                    "el('chooseModel').onclick=()=>status('请从 WeKnora 左侧「离线模型」导入或切换模型。');")
            path.write_text(text)


def common(dest):
    for name in ('dict','licenses'):
        for file in (dest / name).rglob('*'):
            if file.is_file(): file.chmod(file.stat().st_mode | 0o200)
    if not (REPO / 'frontend/dist/index.html').is_file():
        raise RuntimeError('请先构建前端')
    shutil.copytree(REPO / 'frontend/dist', dest / 'web', dirs_exist_ok=True)
    shutil.copytree(REPO / 'config', dest / 'config', dirs_exist_ok=True)
    dictionary = BUILD / 'gopath/pkg/mod/github.com/yanyiwu/gojieba@v1.4.7/deps/cppjieba/dict'
    shutil.copytree(dictionary, dest / 'dict', dirs_exist_ok=True)
    shutil.copytree(REPO / 'migrations/sqlite', dest / 'migrations/sqlite', dirs_exist_ok=True)
    shutil.copytree(REPO / 'licenses', dest / 'licenses', dirs_exist_ok=True)
    for file in ('LICENSE', 'THIRD_PARTY_NOTICES.md'):
        shutil.copy2(REPO / file, dest)
    # Corresponding-source archives required by upstream's bundled licenses.
    for line in (REPO / 'licenses/sources/modules.tsv').read_text().splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        module, version, *_ = line.split()
        archive = BUILD / 'gopath/pkg/mod/cache/download' / module / '@v' / (version + '.zip')
        if not archive.is_file():
            raise RuntimeError('缺少许可证对应源码: ' + str(archive))
        shutil.copy2(archive, dest / 'licenses/sources' / (module.rsplit('/', 1)[-1] + '-' + version + '.zip'))
    (dest / '.env.lite').write_text('GIN_MODE=release\nLOG_LEVEL=info\nDB_DRIVER=sqlite\nRETRIEVE_DRIVER=sqlite\nSTREAM_MANAGER_TYPE=memory\n')
    office_files(dest / 'office')


def mac():
    binary = BUILD / 'zhizhi-mac'
    if not binary.is_file():
        raise RuntimeError('macOS 编译产物不存在')
    contents = DIST / (NAME + '.app') / 'Contents'
    resources = contents / 'Resources'
    (contents / 'MacOS').mkdir(parents=True, exist_ok=True)
    resources.mkdir(parents=True, exist_ok=True)
    shutil.copy2(binary, contents / 'MacOS/Zhizhi')
    common(resources)
    prepare_models(resources / 'bundled-models')
    if not (resources / 'python').exists():
        subprocess.run(['cp', '-cR', str(MAC_RUNTIME / 'Resources/python'), str(resources / 'python')], check=True)
    runtime = resources / 'runtime'
    runtime.mkdir(exist_ok=True)
    for source in [MAC_RUNTIME / 'MacOS/llama-server', *sorted((MAC_RUNTIME / 'MacOS').glob('*.dylib'))]:
        shutil.copy2(source, runtime)
    shutil.copy2(MAC_RUNTIME / 'Resources/LICENSE-llama.cpp', runtime)
    shutil.copy2(ROOT / 'branding/Zhizhi.icns', resources / 'Zhizhi.icns')
    (contents / 'Info.plist').write_bytes(plistlib.dumps({
        'CFBundlePackageType':'APPL','CFBundleName':NAME,'CFBundleDisplayName':NAME,
        'CFBundleIdentifier':'local.zhizhi.weknora','CFBundleExecutable':'Zhizhi',
        'CFBundleShortVersionString':'0.2.0','CFBundleVersion':'2',
        'CFBundleIconFile':'Zhizhi','LSMinimumSystemVersion':'13.3','NSHighResolutionCapable':True,
    }))
    subprocess.run(['codesign','--force','--deep','--sign','-',str(contents.parent)],check=True)
    subprocess.run(['codesign','--verify','--deep','--strict',str(contents.parent)],check=True)
    print(contents.parent)


def windows():
    binary = BUILD / 'zhizhi-windows.exe'
    if not binary.is_file():
        raise RuntimeError('Windows 编译产物不存在')
    target = DIST / 'Windows-x64'
    target.mkdir(parents=True,exist_ok=True)
    shutil.copy2(binary,target / 'Zhizhi.exe')
    common(target)
    shutil.copytree(WIN_SUITE / 'runtime',target / 'runtime',dirs_exist_ok=True)
    webview = BUILD / 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'
    if not webview.is_file() or webview.stat().st_size < 50 * 1024 ** 2:
        raise RuntimeError('缺少完整 WebView2 x64 离线安装器')
    shutil.copy2(webview, target / 'runtime')
    shutil.copytree(WIN_SUITE / '应用/办公助手/python',target / 'python',dirs_exist_ok=True)
    shutil.copy2(ROOT / 'branding/Zhizhi.ico',target / 'Zhizhi.ico')
    if any(target.rglob('*.gguf')):
        raise RuntimeError('Windows 模型应放在安装器旁的 bundled-models，以避免安装器体积限制')
    subprocess.run(['makensis','-V2','-DPAYLOAD='+str(target),'-DOUTPUT='+str(DIST/'Zhizhi-WeKnora-Setup-x64.exe'),str(ROOT/'installer.nsi')],check=True)
    windows_full()


def windows_full():
    full = DIST / 'Windows-Full'
    full.mkdir(exist_ok=True)
    shutil.copy2(DIST / 'Zhizhi-WeKnora-Setup-x64.exe', full)
    prepare_models(full / 'bundled-models')
    shutil.copy2(ROOT / 'README.md', full / '使用说明.md')
    with zipfile.ZipFile(DIST / 'Zhizhi-WeKnora-Windows-x64-Full.zip', 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
        for source in sorted(full.rglob('*')):
            if source.is_file(): archive.write(source, source.relative_to(full.parent))


def dmg():
    with tempfile.TemporaryDirectory(dir=BUILD) as temp:
        staging=Path(temp)/'image'
        staging.mkdir()
        subprocess.run(['cp','-cR',str(DIST/(NAME+'.app')),str(staging)],check=True)
        (staging/'Applications').symlink_to('/Applications')
        output=DIST/'Zhizhi-WeKnora-macOS-Apple.dmg'
        subprocess.run(['hdiutil','create','-ov','-srcfolder',str(staging),'-volname',NAME,'-format','UDZO',str(output)],check=True)
        subprocess.run(['hdiutil','verify',str(output)],check=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('target',choices=['office','mac','windows','windows-full','dmg'])
    args=parser.parse_args()
    DIST.mkdir(exist_ok=True)
    if args.target=='office': office_files(ROOT/'office')
    elif args.target=='mac': mac()
    elif args.target=='windows': windows()
    elif args.target=='windows-full': windows_full()
    else: dmg()
