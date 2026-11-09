import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
let values = {};
try {
  const local = await readFile(resolve(root, '.env.local'), 'utf8');
  for (const line of local.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch (error) {if (error.code !== 'ENOENT') throw error;}
values = {...values, ...process.env};
const env = values.VITE_CLOUDBASE_ENV_ID;
const accessKey = values.VITE_PUBLISHABLE_KEY;
const config = env && accessKey ? {enabled: true, env, region: values.VITE_CLOUDBASE_REGION || 'ap-shanghai', accessKey} : {enabled: false};
await writeFile(resolve(root, 'dist/cloud-config.json'), JSON.stringify(config) + '\n');
console.log('Cloud save configuration: ' + (config.enabled ? 'enabled (publishable key only)' : 'disabled; local play remains available'));
