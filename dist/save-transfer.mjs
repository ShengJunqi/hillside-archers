import {validSave} from './core.mjs';

const PROGRESS_PREFIX = 'HA2:';
const PROGRESS_FIELDS = ['targetBest', 'checkpoint', 'best', 'embers', 'bow', 'life'];

export function encodeProgress(save) {
  // validSave contains only numbers, booleans and ASCII keys; btoa is sufficient.
  return PROGRESS_PREFIX + btoa(JSON.stringify(validSave(save)));
}

export function decodeProgress(code) {
  if (typeof code !== 'string' || code.length > 8192) throw new Error('进度代码无效或过长，请重新复制。');
  const text = code.trim();
  if (!text.startsWith(PROGRESS_PREFIX)) throw new Error('请粘贴 HA2: 开头的完整进度代码。');
  let data;
  try {data = JSON.parse(atob(text.slice(PROGRESS_PREFIX.length).replace(/\s/g, '')));} catch {throw new Error('进度代码不完整，请重新复制。');}
  if (!data || Array.isArray(data) || data.version !== 2 || typeof data.unlocked !== 'boolean' ||
      PROGRESS_FIELDS.some(key => !Number.isSafeInteger(data[key]) || data[key] < 0)) {
    throw new Error('无法识别这个进度版本，请使用本游戏导出的代码。');
  }
  return validSave(data);
}

export function mergeProgress(current, incoming) {
  const one = validSave(current), two = validSave(incoming);
  const merged = {...one, unlocked: one.unlocked || two.unlocked};
  // Importing twice must not duplicate currency or replace stronger progress.
  for (const key of PROGRESS_FIELDS) merged[key] = Math.max(one[key], two[key]);
  return validSave(merged);
}
