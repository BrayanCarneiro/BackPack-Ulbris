import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import RunSync from '../src/systems/RunSync.js';
import { encodeRun, decodeRun } from '../src/systems/runCodec.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';

class Storage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
function raw(gold) { const s = new ShoppingSession({ classId: 'arthur', opponentSeed: 7 }); s.gold = gold; return encodeRun(s); }
function database() {
  const server = { row: { revision: 0, raw: null, operationId: null, updatedAt: null }, offline: false, loseResponse: false, gate: null };
  server.request = async (method, data) => {
    if (server.offline) throw new Error('offline');
    if (method === 'GET') return structuredClone(server.row);
    if (server.gate) await server.gate;
    if (server.row.operationId === data.operationId && server.row.raw === data.raw) return structuredClone(server.row);
    if (server.row.revision !== data.revision) throw Object.assign(new Error('conflict'), { status: 409 });
    server.row = { revision: data.revision + 1, raw: data.raw, operationId: data.operationId, updatedAt: Date.now() };
    if (server.loseResponse) { server.loseResponse = false; throw new Error('response lost'); }
    return structuredClone(server.row);
  };
  return server;
}
function sync(t, server, storage, owner = 'account-A') {
  const controller = new RunSync({ owner, storage, request: server.request, makeId: randomUUID, retryMs: 100000 });
  t.after(() => controller.dispose());
  return controller;
}

test('migra save antigo da conta e recupera do banco depois de apagar o navegador', async t => {
  const server = database(), storage = new Storage(), saved = raw(9);
  storage.setItem('ulbris.current-run.account-A', saved);
  const first = sync(t, server, storage);
  await first.refresh();
  assert.equal(server.row.raw, saved);
  assert.equal(first.state().status, 'saved');
  first.dispose(); storage.clear();
  const restored = sync(t, server, storage);
  await restored.refresh();
  assert.equal(decodeRun(restored.raw).session.gold, 9);
  assert.equal(server.row.revision, 1);
});

test('serializa alterações durante uma gravação e evita repetir estado idêntico', async t => {
  const server = database(), storage = new Storage();
  const controller = sync(t, server, storage); await controller.refresh();
  let release;
  server.gate = new Promise(resolve => { release = resolve; });
  const first = raw(10), latest = raw(4);
  controller.write(first); controller.write(latest);
  release(); server.gate = null;
  await controller.flush();
  assert.equal(server.row.raw, latest);
  assert.equal(server.row.revision, 2);
  controller.write(latest); await controller.flush();
  assert.equal(server.row.revision, 2);
  assert.equal([...storage.values.keys()].filter(key => key.includes('.pending.')).length, 0);
});

test('recupera confirmação perdida sem duplicar a gravação após recarregar', async t => {
  const server = database(), storage = new Storage();
  const first = sync(t, server, storage); await first.refresh();
  server.loseResponse = true;
  first.write(raw(8)); await first.sending;
  assert.equal(first.state().status, 'offline');
  assert.equal(server.row.revision, 1);
  first.dispose();
  const restored = sync(t, server, storage); await restored.refresh();
  assert.equal(restored.state().status, 'saved');
  assert.equal(server.row.revision, 1);
  assert.equal(decodeRun(restored.raw).session.gold, 8);
});

test('preserva alterações offline e envia ao reconectar, incluindo encerramento da jornada', async t => {
  const server = database(), storage = new Storage();
  const first = sync(t, server, storage); await first.refresh();
  first.write(raw(12)); await first.flush();
  server.offline = true;
  first.write(raw(5)); await first.sending;
  assert.equal(first.state().pending, true);
  first.dispose(); server.offline = false;
  const restored = sync(t, server, storage); await restored.refresh();
  assert.equal(decodeRun(server.row.raw).session.gold, 5);
  assert.equal(server.row.revision, 2);
  server.offline = true;
  restored.write(null); await restored.sending;
  restored.dispose(); server.offline = false;
  const ended = sync(t, server, storage); await ended.refresh();
  assert.equal(server.row.raw, null);
  assert.equal(ended.raw, null);
  assert.equal(server.row.revision, 3);
});

test('duas abas não sobrescrevem progresso novo; resolução mantém backup do rascunho', async t => {
  const server = database(), storage = new Storage();
  const first = sync(t, server, storage), second = sync(t, server, storage);
  await first.refresh(); await second.refresh();
  const saved = raw(11), draft = raw(3);
  first.write(saved); await first.flush();
  second.write(draft); await second.sending;
  assert.equal(second.state().status, 'conflict');
  assert.equal(server.row.raw, saved);
  assert.equal(second.raw, draft);
  await second.refresh({ useDatabase: true });
  assert.equal(second.state().status, 'saved');
  assert.equal(second.raw, saved);
  assert.ok([...storage.values].some(([key, value]) => key.includes('.backup.') && JSON.parse(value).raw === draft));
  assert.equal(server.row.revision, 1);
});

test('sessão inválida bloqueia envio sem apagar rascunho; banco funciona sem localStorage', async t => {
  const server = database(), storage = new Storage();
  const controller = sync(t, server, storage); await controller.refresh();
  controller.request = async () => { throw Object.assign(new Error('session expired'), { status: 401 }); };
  controller.write(raw(6)); await controller.sending;
  assert.equal(controller.state().status, 'auth');
  assert.ok([...storage.values.keys()].some(key => key.includes('.pending.')));
  const blockedStorage = { getItem() { throw new Error(); }, setItem() { throw new Error(); }, removeItem() { throw new Error(); } };
  const withoutStorage = sync(t, server, blockedStorage); await withoutStorage.refresh();
  withoutStorage.write(raw(7)); await withoutStorage.flush();
  assert.equal(withoutStorage.state().status, 'saved');
  assert.equal(decodeRun(server.row.raw).session.gold, 7);
});

test('um rascunho corrompido não impede recuperar outras alterações pendentes', async t => {
  const server = database(), storage = new Storage();
  storage.setItem('ulbris.current-run.account-A.pending.broken', '{broken');
  const first = sync(t, server, storage); await first.refresh();
  server.loseResponse = true;
  first.write(raw(10)); first.write(raw(4)); await first.sending;
  first.dispose();
  const restored = sync(t, server, storage); await restored.refresh();
  assert.equal(restored.state().status, 'saved');
  assert.equal(decodeRun(server.row.raw).session.gold, 4);
  assert.equal(server.row.revision, 2);
});

test('uma alteração confirmada evita regravar valores idênticos no armazenamento', async t => {
  const server = database(), storage = new Storage();
  const controller = sync(t, server, storage); await controller.refresh();
  let writes = 0;
  const store = storage.setItem.bind(storage);
  storage.setItem = (key, value) => { writes++; store(key, value); };
  controller.write(raw(8)); await controller.flush();
  assert.equal(controller.state().status, 'saved');
  assert.ok(writes <= 4, `Evitar gravações duplicadas: ${writes} escritas`);
});
