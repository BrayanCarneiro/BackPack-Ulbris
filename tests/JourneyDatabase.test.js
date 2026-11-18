import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server/index.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { encodeRun, decodeRun } from '../src/systems/runCodec.js';

async function app(t, options = {}) {
  const server = createAppServer({ databasePath: ':memory:', scryptCost: 1024, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function call(path, data, user, headers = {}) {
    const response = await fetch(origin + path, { method: data === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json',
        ...(user ? { Cookie: user.cookie, 'X-Run-Owner': user.id } : {}), ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function register(username = 'jogador_A') {
    const result = await call('/api/auth/register', { username, password: 'Senha teste 123' });
    assert.equal(result.status, 201);
    return { id: result.data.user.id, cookie: result.cookie };
  }
  return { server, call, register };
}
function prepared() {
  const session = new ShoppingSession({ classId: 'arthur', opponentSeed: 7 });
  session.buy('sword'); session.buy('refined-iron'); session.toggleOfferLock(5);
  session.board.move('item', 'sword', 0, 0); session.board.store('item', 'refined-iron', 1);
  return encodeRun(session);
}
const operation = (revision, raw) => ({ revision, raw, operationId: randomUUID() });

test('jornada exige sessão e pertence somente à conta autenticada', async t => {
  const api = await app(t), first = await api.register(), second = await api.register('jogador_B');
  assert.equal((await api.call('/api/run')).status, 401);
  assert.equal((await api.call('/api/run', operation(0, prepared()), first)).status, 200);
  assert.equal((await api.call('/api/run', undefined, second)).data.raw, null);
  assert.equal((await api.call('/api/run', operation(0, prepared()), second, { 'X-Run-Owner': first.id })).status, 409);
  const owned = JSON.parse(prepared()); owned.ownerId = first.id;
  assert.equal((await api.call('/api/run', operation(0, JSON.stringify(owned)), second)).status, 400);
  owned.ownerId = null;
  assert.equal((await api.call('/api/run', operation(0, JSON.stringify(owned)), second)).status, 400);
  assert.equal((await api.call('/api/run', undefined, first)).data.revision, 1);
  assert.equal((await api.call('/api/run', operation(1, null), first, { Origin: 'https://other.example' })).status, 403);
});

test('preserva loja, mochila, reserva e rotação; rejeita save inválido sem destruir o anterior', async t => {
  const api = await app(t), user = await api.register(), raw = prepared();
  await api.call('/api/run', operation(0, raw), user);
  const loaded = await api.call('/api/run', undefined, user);
  const session = decodeRun(loaded.data.raw).session;
  assert.equal(session.offers[5].locked, true);
  assert.equal(session.board.items[0].x, 0);
  assert.equal(session.board.items[1].x, null);
  assert.equal(session.board.items[1].rotation, 90);
  assert.equal((await api.call('/api/run', operation(1, '{broken'), user)).status, 400);
  assert.equal((await api.call('/api/run', undefined, user)).data.raw, raw);
});

test('gravação idempotente, conflito entre abas e tombstone impedem duplicação e ressurreição', async t => {
  const api = await app(t), user = await api.register();
  const first = operation(0, prepared());
  assert.equal((await api.call('/api/run', first, user)).data.revision, 1);
  assert.equal((await api.call('/api/run', first, user)).data.revision, 1);
  assert.equal((await api.call('/api/run', operation(0, null), user)).status, 409);
  const clear = operation(1, null);
  assert.equal((await api.call('/api/run', clear, user)).data.revision, 2);
  assert.equal((await api.call('/api/run', clear, user)).data.revision, 2);
  assert.equal((await api.call('/api/run', first, user)).status, 409);
  assert.equal((await api.call('/api/run', undefined, user)).data.raw, null);
});

test('a jornada persiste após reiniciar servidor e entrar novamente sem nenhum cache do navegador', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ulbris-journey-'));
  const databasePath = join(directory, 'accounts.sqlite');
  const first = await app(t, { databasePath }), user = await first.register();
  const raw = prepared(); await first.call('/api/run', operation(0, raw), user);
  await new Promise(resolve => first.server.close(resolve));
  const restarted = await app(t, { databasePath });
  t.after(() => rm(directory, { recursive: true, force: true }));
  const logged = await restarted.call('/api/auth/login', { username: 'jogador_A', password: 'Senha teste 123' });
  const saved = await restarted.call('/api/run', undefined, { id: logged.data.user.id, cookie: logged.cookie });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.raw, raw);
});
