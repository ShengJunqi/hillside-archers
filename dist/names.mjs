export const DEFAULT_NAMES = ['青松', '赤岩'];
export const MAX_NAME_LENGTH = 8;

export function cleanName(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(text).slice(0, MAX_NAME_LENGTH).join('') || fallback;
}
export function normalizeNames(names) {
  return DEFAULT_NAMES.map((fallback, i) => cleanName(Array.isArray(names) ? names[i] : undefined, fallback));
}
export function storyNames(text, names) {
  const pair = normalizeNames(names);
  // One pass prevents a nickname containing an original name being substituted twice.
  return String(text).replace(/青松|赤岩/g, original => pair[original === '青松' ? 0 : 1]);
}
