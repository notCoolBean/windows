"""Build one local writing package using the existing offline models and runtimes."""
from pathlib import Path
import hashlib
import plistlib
import shutil
import subprocess
import sys
import tempfile
import zipfile

SRC = Path(__file__).resolve().parent
OUT = SRC.parent
SUITE = OUT.parent/'致知离线工作台'
OLD_MAC = OUT.parent/'MiniCPM本地看图/办公集成版/本地看图.app/Contents'
NAME = '致知文章仿写'


def app_files(dest):
    dest.mkdir(parents=True,exist_ok=True)
    for name in ['writer.py','rag.py']:
        shutil.copy2(SRC/name,dest/name)
    shutil.copytree(SRC/'web',dest/'web',dirs_exist_ok=True)


def models(dest):
    dest.mkdir(parents=True,exist_ok=True)
    for name in ['model.gguf','MODEL-CARD.md','LICENSE-Apache-2.0.txt']:
        subprocess.run(['cp','-c',SUITE/'models'/name,dest/name],check=True)


def mac_app():
    contents = OUT/(NAME+'.app')/'Contents'
    res = contents/'Resources'
    binary = contents/'MacOS'
    binary.mkdir(parents=True,exist_ok=True)
    app_files(res/'writer')
    models(res/'models')
    if not (res/'python').exists():
        subprocess.run(['cp','-cR',OLD_MAC/'Resources/python',res/'python'],check=True)
    shutil.copy2(OLD_MAC/'Resources/LICENSE-llama.cpp',res)
    for path in [*sorted((OLD_MAC/'MacOS').glob('*.dylib')), OLD_MAC/'MacOS/llama-server']:
        shutil.copy2(path,binary/path.name)
    props = plistlib.loads((OLD_MAC/'Info.plist').read_bytes())
    props.update(CFBundleName=NAME,CFBundleDisplayName=NAME,CFBundleIdentifier='local.zhizhi.writer',
                 CFBundleExecutable='Writer',CFBundleShortVersionString='1.1',CFBundleVersion='2',CFBundleIconFile='Writer')
    (contents/'Info.plist').write_bytes(plistlib.dumps(props))
    shutil.copy2(SRC/'Writer.icns',res)
    with tempfile.TemporaryDirectory() as temp:
        subprocess.run(['swiftc','-parse-as-library','-O','-target','arm64-apple-macosx13.3',
                        '-module-cache-path',str(Path(temp)/'swift'),SRC/'Writer.swift','-o',binary/'Writer'],check=True)
    subprocess.run(['codesign','--force','--sign','-',contents.parent],check=True)
    subprocess.run(['codesign','--verify','--deep','--strict',contents.parent],check=True)


def mac_dmg():
    with tempfile.TemporaryDirectory(dir=OUT) as temp:
        staging = Path(temp)/'image'
        staging.mkdir()
        subprocess.run(['cp','-cR',OUT/(NAME+'.app'),staging],check=True)
        (staging/'Applications').symlink_to('/Applications')
        dmg = Path(temp)/'output.dmg'
        subprocess.run(['hdiutil','create','-srcfolder',staging,'-volname',NAME,'-format','UDZO','-imagekey','zlib-level=2',dmg],check=True)
        subprocess.run(['hdiutil','verify',dmg],check=True)
        dmg.replace(OUT/(NAME+'-Apple芯片.dmg'))


def windows():
    with tempfile.TemporaryDirectory(dir=OUT) as temp:
        root = Path(temp)/NAME
        app_files(root)
        models(root/'models')
        shutil.copytree(SUITE/'runtime',root/'runtime')
        shutil.copytree(SUITE/'应用/办公助手/python',root/'python')
        shutil.copy2(SRC/'Writer.ico',root)
        for name in ['Start.cmd','Install.cmd','start.ps1','install.ps1']:
            text=(SUITE/name).read_text(encoding='utf-8-sig').replace('致知离线工作台',NAME)
            text=text.replace('应用\\办公助手\\python\\python.exe','python\\python.exe').replace('suite.py','writer.py')
            text=text.replace('应用\\办公助手\\图标\\办公助手.ico','Writer.ico')
            (root/name).write_bytes(text.replace('\n','\r\n').encode('utf-8-sig' if name.endswith('.ps1') else 'ascii'))
        paths=sorted(p for p in root.rglob('*') if p.is_file() and p.name!='.DS_Store')
        def digest(f):
            h=hashlib.sha256()
            for block in iter(lambda:f.read(4<<20),b''):
                h.update(block)
            return h.hexdigest()
        sums={}
        for p in paths:
            with p.open('rb') as f:
                sums[p.relative_to(root).as_posix()]=digest(f)
        assert sums['models/model.gguf']=='b0ff610e9c92b30389ff1e0dd40fffed3c1f02a9d34a735fd5fba6a5ad25672b'
        manifest=root/'SHA256SUMS.txt'
        manifest.write_bytes(''.join(f'{h}  {name}\r\n' for name,h in sums.items()).encode())
        output=Path(temp)/'output.zip'
        with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as z:
            for p in [*paths,manifest]:
                z.write(p,NAME+'/'+p.relative_to(root).as_posix(),compress_type=zipfile.ZIP_STORED if p.suffix=='.gguf' else zipfile.ZIP_DEFLATED)
        with zipfile.ZipFile(output) as z:
            for name,expected in sums.items():
                with z.open(NAME+'/'+name) as f:
                    assert digest(f)==expected,name
            assert z.read(NAME+'/SHA256SUMS.txt')==manifest.read_bytes()
        output.replace(OUT/(NAME+'-Windows-x64.zip'))
        print(len(paths),'verified')

if __name__=='__main__':
    {'app':mac_app,'dmg':mac_dmg,'windows':windows}[sys.argv[1]]()
