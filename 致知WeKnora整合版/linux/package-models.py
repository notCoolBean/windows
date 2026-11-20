"""Build the shared external MiniCPM model archive for both computer packages."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'bundled-models'
kit = ROOT / '.build-tools/minicpm47/model-kit'
if kit.exists():
    shutil.rmtree(kit)
kit.mkdir(parents=True)
destination = kit / 'bundled-models'
if sys.platform == 'darwin':
    subprocess.run(['cp', '-cR', str(source), str(destination)], check=True)
else:
    shutil.copytree(source, destination)
entries = json.loads((destination / 'manifest.json').read_text())
expected = {row['file']: row['sha256'] for row in entries}
expected.update({row['projection']: row['projection_sha256'] for row in entries if row.get('projection')})
assert {p.name for p in destination.glob('*.gguf')} == set(expected)
lines = []
for path in sorted(destination.iterdir()):
    if path.name == 'SHA256SUMS' or not path.is_file():
        continue
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(8 * 1024**2), b''):
            digest.update(data)
    if path.name in expected:
        assert digest.hexdigest() == expected[path.name], path.name
    lines.append(digest.hexdigest() + '  ' + path.name + '\n')
(destination / 'SHA256SUMS').write_text(''.join(lines))
shutil.copy2(ROOT / 'linux/import-models.sh', kit / '导入模型.sh')
(kit / '导入模型.sh').chmod(0o755)
(kit / '模型说明.txt').write_text(
    'MiniCPM-V 4.7 1B Q4_K_M 主权重和配套 F16 视觉组件。文字与看图共用同一份主权重。\n'
    '知识库使用本地关键词检索，无需向量模型。\n'
    + 'Windows：把本 ZIP 解压到程序安装器所在目录，确保 bundled-models 与安装器同级，再运行安装器。\n'
    '麒麟：先安装 .run 程序包，再解压本 ZIP，在解压目录运行 sh 导入模型.sh。\n'
    '首次打开应用会自动校验并注册模型。升级会保留已有用户模型与知识库，不自动删除历史模型。\n')
archive_path = ROOT / '.build-tools/minicpm47/致知-MiniCPM-V4.7-1B-模型包.zip'
with zipfile.ZipFile(archive_path, 'w', compression=zipfile.ZIP_STORED) as archive:
    for path in sorted(kit.rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(kit))
for name in ('雷神-Windows11-x64-MiniCPM-V4.7-1B', '联想-麒麟V10-ARM64-MiniCPM-V4.7-1B'):
    output = ROOT / 'dist' / name
    output.mkdir(parents=True, exist_ok=True)
    target = output / archive_path.name
    if sys.platform == 'darwin':
        subprocess.run(['cp', '-c', str(archive_path), str(target)], check=True)
    else:
        shutil.copy2(archive_path, target)
    print(target, target.stat().st_size)
