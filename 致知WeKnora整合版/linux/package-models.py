"""Create a separate text/retrieval model kit for the 8 GB ARM64 package."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'bundled-models'
kit = ROOT / '.build-tools/kylin-arm64/致知模型包'
destination = kit / 'bundled-models'
destination.mkdir(parents=True, exist_ok=True)
entries = [row for row in json.loads((source / 'manifest.json').read_text())
           if row['kind'] in ('KnowledgeQA', 'Embedding')]
assert {row['kind'] for row in entries} == {'KnowledgeQA', 'Embedding'}
for row in entries:
    original = source / row['file']
    target = destination / row['file']
    if sys.platform == 'darwin':
        subprocess.run(['cp', '-c', str(original), str(target)], check=True)
    else:
        shutil.copy2(original, target)
    digest = hashlib.sha256()
    with target.open('rb') as stream:
        for data in iter(lambda: stream.read(8 * 1024**2), b''):
            digest.update(data)
    assert digest.hexdigest() == row['sha256'], row['file']
(destination / 'manifest.json').write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n')
for item in (ROOT / 'model-assets').iterdir():
    if item.is_file():
        shutil.copy2(item, destination / item.name)
lines = []
for path in sorted(destination.iterdir()):
    if path.name == 'SHA256SUMS':
        continue
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(8 * 1024**2), b''):
            digest.update(data)
    lines.append(digest.hexdigest() + '  ' + path.name + '\n')
(destination / 'SHA256SUMS').write_text(''.join(lines))
shutil.copy2(ROOT / 'linux/import-models.sh', kit / '导入模型.sh')
(kit / '导入模型.sh').chmod(0o755)
(kit / '使用说明.txt').write_text(
    '先安装致知程序，再在本目录运行：sh 导入模型.sh\n'
    '模型导入到当前账户下，完成后即可拔掉 U 盘。首次启动将自动验证并注册模型。\n'
    '包含 Qwen3-4B-Instruct-2507 Q4_K_M 文字模型与 BGE 中文向量模型。\n'
    '针对 8 GB 飞腾电脑，默认使用 CPU、单模型进程、4096 上下文。\n'
    '本标准模型包用于文字问答、知识库检索和办公仿写，不包含视觉模型。\n'
    '视觉模型仍可从离线模型页面另行导入，但其内存与速度需要真机验证。\n'
    '升级程序无需重复导入模型；用户资料保存在 ~/.config/致知知识工作台。\n')
output = ROOT / 'dist/麒麟V10-飞腾ARM64'
output.mkdir(parents=True, exist_ok=True)
archive_path = output / '致知-文字与检索模型包.zip'
with zipfile.ZipFile(archive_path, 'w', compression=zipfile.ZIP_STORED) as archive:
    for path in sorted(kit.rglob('*')):
        if path.is_file():
            archive.write(path, path.relative_to(kit.parent))
print(archive_path, archive_path.stat().st_size)
