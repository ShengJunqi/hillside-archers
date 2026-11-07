export const VIEW_KEY = 'hillside-archers-view-v1';
export function validView(value) {
  return ['auto', 'desktop', 'mobile'].includes(value) ? value : 'auto';
}
export function readView(storage) {
  try {return validView(storage.getItem(VIEW_KEY));} catch {return 'auto';}
}
export function writeView(storage, value) {
  try {storage.setItem(VIEW_KEY, validView(value)); return true;} catch {return false;}
}
export function resolveView(preference, {width, height, coarse = false}) {
  const mode = validView(preference);
  const layout = mode === 'auto' ? (width <= 900 || (coarse && width <= 1100) ? 'mobile' : 'desktop') : mode;
  // On a large computer, an explicit mobile choice presents a usable phone-shaped view.
  const handset = layout === 'mobile' && mode === 'mobile' && !coarse && width > 600;
  return {layout, handset, orientation: handset || height >= width ? 'portrait' : 'landscape'};
}
