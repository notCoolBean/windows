"""Assemble a private ARM64 desktop runtime; run inside the build container."""
from pathlib import Path
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from package import common

BUILD = ROOT / '.build-tools/kylin-arm64'
PAYLOAD = BUILD / 'payload'
OUTPUT = ROOT / 'dist/联想-麒麟V10-ARM64-MiniCPM-V4.7-1B'
SYSTEM_LIBS = {'libc.so.6', 'libm.so.6', 'libpthread.so.0', 'libdl.so.2',
               'librt.so.1', 'libresolv.so.2', 'libutil.so.1', 'ld-linux-aarch64.so.1'}


def copy_tree(source, target):
    shutil.copytree(source, target, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '.DS_Store'))


def elf(path):
    if not path.is_file() or path.is_symlink():
        return False
    with path.open('rb') as stream:
        return stream.read(4) == b'\x7fELF'


def checksums(folder):
    lines = []
    for path in sorted(folder.rglob('*')):
        if not path.is_file() or path.is_symlink() or path.name == 'SHA256SUMS':
            continue
        digest = hashlib.sha256()
        with path.open('rb') as stream:
            for data in iter(lambda: stream.read(8 * 1024**2), b''):
                digest.update(data)
        lines.append(digest.hexdigest() + '  ' + str(path.relative_to(folder)) + '\n')
    (folder / 'SHA256SUMS').write_text(''.join(lines))


def main():
    if os.uname().machine != 'aarch64' or sys.platform != 'linux':
        raise SystemExit('Run in the Linux ARM64 build container')
    if PAYLOAD.exists():
        shutil.rmtree(PAYLOAD)
    PAYLOAD.mkdir(parents=True)
    common(PAYLOAD)
    shutil.copy2(ROOT / '.build-tools/zhizhi-linux-arm64', PAYLOAD / 'Zhizhi')
    copy_tree(BUILD / 'python', PAYLOAD / 'python')
    for pattern in ('*.a', '*.o'):
        for archive in (PAYLOAD / 'python').rglob(pattern):
            archive.unlink()
    copy_tree(BUILD / 'runtime', PAYLOAD / 'runtime')
    shutil.copy2(ROOT / 'branding/logo.png', PAYLOAD / 'zhizhi.png')
    shutil.copy2(ROOT / 'linux/launch.sh', PAYLOAD / 'launch.sh')
    (PAYLOAD / 'launch.sh').chmod(0o755)

    libroot = Path('/usr/lib/aarch64-linux-gnu')
    copy_tree(libroot / 'webkit2gtk-4.0', PAYLOAD / 'libexec/webkit2gtk-4.0')
    copy_tree(libroot / 'gdk-pixbuf-2.0/2.10.0/loaders', PAYLOAD / 'lib/gdk-pixbuf-2.0/2.10.0/loaders')
    copy_tree(libroot / 'gio/modules', PAYLOAD / 'lib/gio/modules')
    shutil.copy2(libroot / 'gdk-pixbuf-2.0/gdk-pixbuf-query-loaders', PAYLOAD / 'libexec/gdk-pixbuf-query-loaders')
    for name in ('glib-2.0/schemas', 'mime', 'icons/Adwaita', 'icons/hicolor'):
        copy_tree(Path('/usr/share') / name, PAYLOAD / 'share' / name)

    # Copy the transitive ELF dependencies privately; never distribute or replace glibc.
    dependencies = set()
    for binary in list(PAYLOAD.rglob('*')):
        if not elf(binary):
            continue
        result = subprocess.run(['ldd', str(binary)], text=True, capture_output=True)
        if 'not found' in result.stdout:
            raise RuntimeError(str(binary) + '\n' + result.stdout)
        dependencies.update(Path(p) for p in re.findall(r'=> (/\S+)', result.stdout))
    library_dir = PAYLOAD / 'lib'
    library_dir.mkdir(exist_ok=True)
    packages = set()
    for source in sorted(dependencies):
        if source.name in SYSTEM_LIBS or source.is_relative_to(PAYLOAD):
            continue
        shutil.copy2(source, library_dir / source.name)
        owner = subprocess.run(['dpkg-query', '-S', str(source)], text=True, capture_output=True)
        if owner.returncode == 0:
            packages.add(owner.stdout.split(': ')[0])
    shutil.copy2('/build/cxx/usr/lib/aarch64-linux-gnu/libstdc++.so.6', library_dir / 'libstdc++.so.6')
    # Ubuntu's release WebKit ignores WEBKIT_EXEC_PATH. Relocate only its two
    # compiled helper-directory strings; the launcher fixes cwd to this payload.
    # Keep byte offsets unchanged, and fail if a different library layout is used.
    webkit = library_dir / 'libwebkit2gtk-4.0.so.37'
    data = webkit.read_bytes()
    for suffix in ('/injected-bundle/', ''):
        old = ('/usr/lib/aarch64-linux-gnu/webkit2gtk-4.0' + suffix).encode() + b'\0'
        new = ('./libexec/webkit2gtk-4.0' + suffix).encode() + b'\0'
        if data.count(old) != 1:
            raise RuntimeError('Unexpected WebKit helper path layout')
        data = data.replace(old, new + b'\0' * (len(old) - len(new)))
    webkit.write_bytes(data)
    notice = PAYLOAD / 'licenses/linux-runtime'
    notice.mkdir(parents=True)
    versions = []
    for package in sorted(packages):
        version = subprocess.check_output(['dpkg-query', '-W', '-f=${binary:Package}\t${Version}\t${source:Package}\t${source:Version}\n', package], text=True)
        versions.append(version)
        copyright_file = Path('/usr/share/doc') / package.split(':')[0] / 'copyright'
        if copyright_file.exists():
            shutil.copy2(copyright_file, notice / (package.replace(':', '-') + '.copyright'))
    (notice / 'packages.tsv').write_text(''.join(versions))
    shutil.copy2(ROOT / 'linux/build-arm64-runtime.sh', notice / 'build-arm64-runtime.sh')
    shutil.copy2(ROOT / 'linux/package-arm64.py', notice / 'package-arm64.py')
    shutil.copy2(BUILD / 'libstdcxx-source.json', notice / 'libstdcxx-source.json')
    shutil.copy2('/build/cxx/usr/share/doc/gcc-16-base/copyright', notice / 'libstdcxx.copyright')
    # Ship the modified desktop dependency's corresponding source alongside its license.
    with tarfile.open(PAYLOAD / 'licenses/sources/wails-v2.12.0-zhizhi.tar.gz', 'w:gz') as archive:
        archive.add('/build/wails-v2.12.0', arcname='wails-v2.12.0-zhizhi')
    for name in ('webkit2gtk.dsc', 'webkit2gtk_2.38.6.orig.tar.xz',
                 'webkit2gtk_2.38.6-0ubuntu0.20.04.1.debian.tar.xz'):
        shutil.copy2(BUILD / name, PAYLOAD / 'licenses/sources' / name)

    for binary in PAYLOAD.rglob('*'):
        if not elf(binary):
            continue
        relative = os.path.relpath(library_dir, binary.parent)
        # Each library has its own relative lookup path; no global LD_LIBRARY_PATH.
        subprocess.run(['patchelf', '--set-rpath', '$ORIGIN:$ORIGIN/' + relative, str(binary)], check=True)
        subprocess.run(['strip', '--strip-unneeded', str(binary)], check=True)
    if list(PAYLOAD.rglob('*.gguf')):
        raise RuntimeError('Program package must not contain model weights')
    checksums(PAYLOAD)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    archive = BUILD / 'payload.tar.gz'
    with tarfile.open(archive, 'w:gz', compresslevel=6) as tar:
        for item in sorted(PAYLOAD.iterdir()):
            tar.add(item, arcname=item.name)
    installer = OUTPUT / '致知-麒麟V10-ARM64-安装.run'
    with installer.open('wb') as output:
        output.write((ROOT / 'linux/install-header.sh').read_bytes())
        with archive.open('rb') as source:
            shutil.copyfileobj(source, output)
    installer.chmod(0o755)
    print(installer, installer.stat().st_size)


if __name__ == '__main__':
    main()
