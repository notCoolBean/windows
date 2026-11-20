"""Prepare the pinned MiniCPM-V 4.7 1B weights and redistribution notices."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent


def prepare(destination):
    source = ROOT / '.build-tools/minicpm47'
    notices = ROOT / 'model-assets/minicpm47'
    release = json.loads((notices / 'source.json').read_text())
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=destination.parent) as temporary:
        staging = Path(temporary) / 'bundled-models'
        staging.mkdir()
        for entry in release['files']:
            original = source / entry['file']
            target = staging / entry['file']
            if sys.platform == 'darwin':
                subprocess.run(['cp', '-c', str(original), str(target)], check=True)
            else:
                shutil.copy2(original, target)
            digest = hashlib.sha256()
            with target.open('rb') as stream:
                for block in iter(lambda: stream.read(8 * 1024**2), b''):
                    digest.update(block)
            if target.stat().st_size != entry['size'] or digest.hexdigest() != entry['sha256']:
                raise RuntimeError('模型与固定版本校验值不符: ' + entry['file'])
        main, vision = release['files']
        manifest = [
            {'kind': 'KnowledgeQA', 'file': main['file'], 'sha256': main['sha256']},
            {'kind': 'VLLM', 'file': main['file'], 'sha256': main['sha256'],
             'projection': vision['file'], 'projection_sha256': vision['sha256']},
        ]
        (staging / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        for item in notices.iterdir():
            if item.is_file():
                shutil.copy2(item, staging / item.name)
        # Replace only the generated bundle, after all new weights are verified.
        # Never touch imported models in the application's user data directory.
        if destination.exists():
            shutil.rmtree(destination)
        shutil.move(str(staging), destination)
    print(destination)


if __name__ == '__main__':
    prepare(ROOT / 'bundled-models')
