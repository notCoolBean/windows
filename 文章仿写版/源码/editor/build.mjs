import { build } from 'esbuild';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const result = await build({
  entryPoints: ['editor.js'], outfile: '../web/editor.js', bundle: true, format: 'esm',
  target: ['safari16.4', 'chrome100'], minify: true, metafile: true, legalComments: 'eof',
});
const packages = new Set();
for (const file of Object.keys(result.metafile.inputs)) {
  const match = file.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  if (match) packages.add(match[1]);
}
const notices = [];
for (const dir of [...packages].sort()) {
  const meta = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  const license = (await readdir(dir)).find(name => /^(license|licence)(\.\w+)?$/i.test(name));
  if (!license) throw Error('Missing license for ' + meta.name);
  notices.push(meta.name + ' ' + meta.version + '\n' + await readFile(path.join(dir, license), 'utf8'));
}
await writeFile('../web/editor-licenses.txt', notices.join('\n\n'));
