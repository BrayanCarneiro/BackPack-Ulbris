import { setRunOwner, getRunSync, setRunSync, notifyRunStatus } from '../systems/RunSave.js';
import RunSync from '../systems/RunSync.js';

let state = { user: null, available: false };
let startup;
const subscribers = new Set();

async function update(user, available = true) {
  setRunOwner(user?.id ?? null);
  if (user) {
    let sync = getRunSync();
    if (!sync || sync.owner !== user.id) {
      sync = new RunSync({ owner: user.id,
        request: (method, data, options) => request('../run', method === 'GET' ? undefined : data,
          { ...options, timeoutMs: method === 'GET' ? 3000 : 10000, headers: { 'X-Run-Owner': user.id } }),
        notify: () => { if (getRunSync() === sync) notifyRunStatus(); },
      });
      setRunSync(sync);
      await sync.refresh();
    } else if (sync.state().status === 'auth') await sync.refresh();
  } else setRunSync(null);
  state = { user, available };
  for (const callback of subscribers) callback(state);
  return state;
}

async function request(path, data, { timeoutMs = 10000, headers = {}, keepalive = false } = {}) {
  const base = new URL('api/auth/', new URL(import.meta.env.BASE_URL, window.location.href));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(path, base), { method: data ? 'POST' : 'GET',
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal, keepalive,
      headers: { ...headers, ...(data ? { 'Content-Type': 'application/json' } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}) });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Contas indisponíveis neste endereço. Você pode continuar como visitante.');
    }
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error ?? 'Não foi possível acessar sua conta.'),
      { status: response.status, code: result.code });
    return result;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) {
      throw new Error('Não foi possível conectar às contas. Tente novamente em instantes.');
    }
    throw error;
  } finally { clearTimeout(timeout); }
}

export const account = {
  get state() { return state; },
  subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
  initialize() {
    startup ??= this.refresh(3000).catch(() => update(null, false));
    return startup;
  },
  async refresh(timeoutMs) { const data = await request('session', undefined, { timeoutMs }); return update(data.user); },
  async login(username, password) { const data = await request('login', { username, password }); return update(data.user); },
  async register(username, password) { const data = await request('register', { username, password }); return update(data.user); },
  async logout() { await getRunSync()?.flush(); await request('logout', {}); return update(null); },
};
