import { encodeRun, decodeRun } from './runCodec.js';
export { encodeRun, decodeRun } from './runCodec.js';

export const SAVE_KEY = 'ulbris.current-run';
let runOwner = null;
let synchronizer = null;
const sessionOwners = new WeakMap();
export const getRunOwner = () => runOwner;
export function bindRunSession(session, owner = runOwner) {
  if (!sessionOwners.has(session)) sessionOwners.set(session, owner);
  return sessionOwners.get(session) === owner;
}
function ownedRun(raw) {
  const saved = decodeRun(raw);
  if (Object.hasOwn(saved, 'ownerId') && saved.ownerId !== runOwner) return { status: 'empty' };
  bindRunSession(saved.session);
  return { status: 'ok', ...saved };
}
const subscribers = new Set();
export const getRunSync = () => synchronizer;
export const getRunStatus = () => synchronizer?.state() ?? null;
export function subscribeRunStatus(callback) { subscribers.add(callback); return () => subscribers.delete(callback); }
export function notifyRunStatus() { for (const callback of subscribers) callback(getRunStatus()); }
export function setRunSync(sync) { synchronizer = sync; notifyRunStatus(); }
export async function refreshRunSave(options) { await synchronizer?.refresh(options); }
export function setRunOwner(id = null) {
  if (id !== null && (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(id))) {
    throw new Error('Conta inválida.');
  }
  if (runOwner !== id) { synchronizer?.dispose(); synchronizer = null; }
  runOwner = id;
}
export const runSaveKey = () => runOwner ? `${SAVE_KEY}.${runOwner}` : SAVE_KEY;
export function loadRun(storage) {
  try {
    if (!storage && synchronizer) {
      const { status, message } = synchronizer.state();
      if (['conflict', 'error', 'auth'].includes(status) || (status === 'offline' && synchronizer.raw === null)) {
        return { status: 'unavailable', message };
      }
      return synchronizer.raw === null ? { status: 'empty' } : ownedRun(synchronizer.raw);
    }
    storage ??= globalThis.localStorage;
    const raw = storage.getItem(runSaveKey());
    return raw === null ? { status: 'empty' } : ownedRun(raw);
  } catch {
    return { status: 'unavailable', message: 'Não foi possível carregar a jornada salva. Os dados podem estar incompatíveis ou o armazenamento indisponível.' };
  }
}

export function saveRun(session, phase = 'shop') {
  try {
    if (!bindRunSession(session)) return false;
    const raw = encodeRun(session, phase, runOwner);
    if (synchronizer) return synchronizer.write(raw);
    globalThis.localStorage.setItem(runSaveKey(), raw);
    return true;
  } catch { return false; }
}

export function clearRun(session) {
  try {
    if (session && !bindRunSession(session)) return false;
    if (synchronizer) return synchronizer.write(null);
    globalThis.localStorage.removeItem(runSaveKey()); return true;
  }
  catch { return false; }
}

// No frame polling: only committed UI changes schedule a write.
export function autoSave(session, onError, { delay = 250 } = {}) {
  const owner = runOwner;
  const belongsToOwner = bindRunSession(session, owner);
  const storageKey = runSaveKey();
  let timer = null;
  let lastState = null;
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    if (session.pendingFusions !== null || session.runResult) return;
    try {
      if (!belongsToOwner) { onError?.(); return; }
      const raw = encodeRun(session, 'shop', owner);
      // savedAt changes even when gameplay does not.
      const state = raw.slice(raw.indexOf(',"phase"'));
      if (state === lastState) return;
      if (synchronizer && storageKey === runSaveKey()) synchronizer.write(raw);
      else globalThis.localStorage.setItem(storageKey, raw);
      lastState = state;
    } catch { onError?.(); }
  };
  return { flush, schedule() { clearTimeout(timer); timer = setTimeout(flush, delay); } };
}
