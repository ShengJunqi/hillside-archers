import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(resolve(root, 'dist', name), 'utf8');
const [html, css, mobileCss, arenaCss, ...modules] = await Promise.all([
  read('index.html'), read('style.css'), read('mobile.css'), read('arena.css'),
  read('names.mjs'), read('combat.mjs'), read('body.mjs'), read('encounters.mjs'), read('core.mjs'), read('emotes.mjs'), read('feedback.mjs'), read('scenery.mjs'), read('render.mjs'), read('input.mjs'), read('display.mjs'), read('save-transfer.mjs'), read('cloud-save.mjs'), read('cloud-client.mjs'), read('cloud-ui.mjs'), read('app.mjs'),
]);
// Keep dependency order; imports/exports are removed only for the standalone file.
let code = modules.map(source => source
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/\bexport /g, '')).join('\n');
for(const name of ['storybook','impasto','moonlit','paper','harbor','earth']){const bytes=await readFile(resolve(root,'dist/art',name+'.webp'));code=code.replace('art/'+name+'.webp','data:image/webp;base64,'+bytes.toString('base64'));}
let offlineArenaCss=arenaCss;
for(const [file,mime] of [['SmileySans-Oblique.woff2','font/woff2'],['BarlowCondensed-Bold.ttf','font/ttf']]){
 const bytes=await readFile(resolve(root,'dist/fonts',file));
 offlineArenaCss=offlineArenaCss.replace('fonts/'+file,'data:'+mime+';base64,'+bytes.toString('base64'));
}
const fontLicenses=await Promise.all(['SmileySans-OFL.txt','BarlowCondensed-OFL.txt'].map(f=>read('fonts/'+f)));
const standalone = html
  .replace('data-layout="desktop"', 'data-layout="desktop" data-offline="true"')
  .replace('<link rel="stylesheet" href="mobile.css">', '<style>' + mobileCss + '</style>')
  .replace('<link rel="stylesheet" href="style.css">', '<style>' + css + '</style>')
  .replace('<link rel="stylesheet" href="arena.css">', '<style>' + offlineArenaCss + '</style><!-- Font licenses\n' + fontLicenses.map(s=>s.replace(/[ \t]+$/gm,'')).join('\n\n') + '\n-->')
  .replace('<script type="module" src="app.mjs"></script>', '<script>\n' + code + '\n</script>')
  .replace('<a href="download.html" download="坡地弓手.html">下载离线版 ↓</a>', '<span>离线版 · 一箭过山河</span>');
if (standalone === html || /<script[^>]+src=/.test(standalone)) {
  throw new Error('Page structure changed: update the offline bundler before publishing.');
}
await writeFile(resolve(root, 'dist/download.html'), standalone);
console.log('Built dist/download.html (' + Buffer.byteLength(standalone) + ' bytes).');
