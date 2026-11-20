"""Prepare text, vision, and embedding weights and redistribution notices."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent

def prepare(destination):
    destination.mkdir(parents=True, exist_ok=True)
    original = ROOT.parent / '致知离线工作台/models'
    sources = {
        'Qwen3-4B-Instruct-2507-Q4_K_M.gguf': ROOT / '.build-tools/Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
        'MiniCPM-V4-Q4.gguf': original / 'model.gguf',
        'MiniCPM-V4-mmproj.gguf': original / 'vision.gguf',
        'bge-small-zh-v1.5-f16.gguf': ROOT / '.build-tools/bge-small-zh-v1.5-f16.gguf',
    }
    hashes = {}
    for name, source in sources.items():
        target = destination / name
        if sys.platform == 'darwin':
            subprocess.run(['cp', '-c', str(source), str(target)], check=True)
        else:
            shutil.copy2(source, target)
        digest = hashlib.sha256()
        with target.open('rb') as file:
            for chunk in iter(lambda: file.read(1024*1024), b''):
                digest.update(chunk)
        hashes[name] = digest.hexdigest()
    text, main, vision, embed = sources
    if hashes[text] != '3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597':
        raise RuntimeError('Qwen 模型与固定版本上游 SHA-256 不符')
    manifest = [
        {'kind':'KnowledgeQA', 'file':text, 'sha256':hashes[text]},
        {'kind':'Embedding', 'file':embed, 'sha256':hashes[embed]},
        {'kind':'VLLM', 'file':main, 'sha256':hashes[main], 'projection':vision, 'projection_sha256':hashes[vision]},
    ]
    (destination / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    shutil.copy2(original / 'LICENSE-Apache-2.0.txt', destination / 'LICENSE-MiniCPM-Apache-2.0.txt')
    shutil.copy2(original / 'MODEL-CARD.md', destination / 'MiniCPM-MODEL-CARD.md')
    for source in (ROOT / 'model-assets').iterdir():
        if source.is_file(): shutil.copy2(source, destination / source.name)
    print(destination)

if __name__ == '__main__': prepare(ROOT / 'bundled-models')
