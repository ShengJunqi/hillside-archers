import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(resolve(root, 'dist', name), 'utf8');
const [html, css, mobileCss, ...modules] = await Promise.all([
  read('index.html'), read('style.css'), read('mobile.css'),
  read('combat.mjs'), read('body.mjs'), read('core.mjs'), read('emotes.mjs'), read('render.mjs'), read('input.mjs'), read('display.mjs'), read('save-transfer.mjs'), read('app.mjs'),
]);
// Keep dependency order; imports/exports are removed only for the standalone file.
const code = modules.map(source => source
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/\bexport /g, '')).join('\n');
const standalone = html
  .replace('<link rel="stylesheet" href="mobile.css">', '<style>' + mobileCss + '</style>')
  .replace('<link rel="stylesheet" href="style.css">', '<style>' + css + '</style>')
  .replace('<script type="module" src="app.mjs"></script>', '<script>\n' + code + '\n</script>')
  .replace('<a href="download.html" download="坡地弓手.html">下载离线版 ↓</a>', '<span>离线版 · 一箭过山河</span>');
if (standalone === html || /<script[^>]+src=/.test(standalone)) {
  throw new Error('Page structure changed: update the offline bundler before publishing.');
}
await writeFile(resolve(root, 'dist/download.html'), standalone);
console.log('Built dist/download.html (' + Buffer.byteLength(standalone) + ' bytes).');
