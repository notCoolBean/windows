"""Build one local writing package using the existing offline runtimes."""
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tempfile

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


def mac_app():
    contents = OUT/'轻量版'/(NAME+'.app')/'Contents'
    res = contents/'Resources'
    binary = contents/'MacOS'
    binary.mkdir(parents=True,exist_ok=True)
    app_files(res/'writer')
    if not (res/'python').exists():
        subprocess.run(['cp','-cR',OLD_MAC/'Resources/python',res/'python'],check=True)
    shutil.copy2(OLD_MAC/'Resources/LICENSE-llama.cpp',res)
    for path in [*sorted((OLD_MAC/'MacOS').glob('*.dylib')), OLD_MAC/'MacOS/llama-server']:
        shutil.copy2(path,binary/path.name)
    props = plistlib.loads((OLD_MAC/'Info.plist').read_bytes())
    props.update(CFBundleName=NAME,CFBundleDisplayName=NAME,CFBundleIdentifier='local.zhizhi.writer',
                 CFBundleExecutable='Writer',CFBundleShortVersionString='1.2.0',CFBundleVersion='3',CFBundleIconFile='Writer')
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
        subprocess.run(['cp','-cR',OUT/'轻量版'/(NAME+'.app'),staging],check=True)
        (staging/'Applications').symlink_to('/Applications')
        dmg = Path(temp)/'output.dmg'
        subprocess.run(['hdiutil','create','-srcfolder',staging,'-volname',NAME,'-format','UDZO','-imagekey','zlib-level=2',dmg],check=True)
        subprocess.run(['hdiutil','verify',dmg],check=True)
        dmg.replace(OUT/'轻量版'/(NAME+'-Apple芯片.dmg'))


def windows():
    with tempfile.TemporaryDirectory(dir=OUT) as temp:
        root = Path(temp)/NAME
        app_files(root)
        shutil.copytree(SUITE/'runtime',root/'runtime')
        shutil.copytree(SUITE/'应用/办公助手/python',root/'python')
        shutil.copy2(SRC/'Writer.ico',root)
        if any(p.suffix.lower()=='.gguf' for p in root.rglob('*')):
            raise ValueError('安装包中不能包含模型文件。')
        output=Path(temp)/'setup.exe'
        subprocess.run(['makensis','-V2','-DPAYLOAD='+str(root),'-DOUTPUT='+str(output), SRC/'installer.nsi'],check=True)
        output.replace(OUT/'Zhizhi-Writer-Setup-x64.exe')

if __name__=='__main__':
    {'app':mac_app,'dmg':mac_dmg,'windows':windows}[sys.argv[1]]()
