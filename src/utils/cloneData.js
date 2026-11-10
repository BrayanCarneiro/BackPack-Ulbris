// Game snapshots contain plain records and arrays. The fallback supports older browsers.
export function clonePlainData(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const copy = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  for (const key of Object.keys(value)) copy[key] = clonePlainData(value[key], seen);
  return copy;
}

export const cloneData = value => typeof globalThis.structuredClone === 'function'
  ? globalThis.structuredClone(value) : clonePlainData(value);
