import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createAppServer } from '../server/index.js';

async function fixture(t, options = {}) {
  const server = createAppServer({ databasePath: ':memory:', scryptCost: 1024, ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { server, origin, async call(path, data, cookie, overrides = {}) {
    const response = await fetch(`${origin}/api/auth/${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { ...(data === undefined ? {} : { Origin: origin, 'Content-Type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}), ...overrides },
      ...(data === undefined ? {} : { body: typeof data === 'string' ? data : JSON.stringify(data) }) });
    return { status: response.status, cookie: response.headers.get('set-cookie'), data: await response.json() };
  } };
}
const credentials = { username: 'Cavaleiro_01', password: 'Senha de teste 123!' };
const cookieValue = value => value.split(';')[0];

test('cadastro sem email gera perfil do Arthur e sessão protegida, sem expor a senha', async t => {
  const app = await fixture(t);
  const result = await app.call('register', credentials);
  assert.equal(result.status, 201);
  assert.equal(result.data.user.username, credentials.username);
  assert.deepEqual(result.data.user.avatar, { kind: 'class', id: 'arthur' });
  assert.deepEqual(Object.keys(result.data.user).sort(), ['avatar', 'createdAt', 'id', 'username']);
  assert.match(result.cookie, /HttpOnly/);
  assert.match(result.cookie, /SameSite=Strict/);
  const session = await app.call('session', undefined, cookieValue(result.cookie));
  assert.deepEqual(session.data.user, result.data.user);
  assert.equal((await app.call('session')).data.user, null);
});

test('login aceita caixa diferente, rejeita duplicação, senha incorreta e usuário inexistente', async t => {
  const app = await fixture(t);
  await app.call('register', credentials);
  const duplicate = await app.call('register', { ...credentials, username: 'cAVALEIRO_01' });
  assert.equal(duplicate.status, 409);
  const wrong = await app.call('login', { ...credentials, password: 'Senha incorreta' });
  const missing = await app.call('login', { ...credentials, username: 'desconhecido' });
  assert.equal(wrong.status, 401);
  assert.deepEqual(missing.data, wrong.data);
  const login = await app.call('login', { ...credentials, username: 'cavaleiro_01' });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.username, credentials.username);
});

test('sair invalida o token no servidor e a sessão expira após sete dias', async t => {
  let now = Date.now();
  const app = await fixture(t, { now: () => now });
  const registered = await app.call('register', credentials);
  const token = cookieValue(registered.cookie);
  assert.equal((await app.call('logout', {}, token)).status, 200);
  assert.equal((await app.call('session', undefined, token)).data.user, null);
  const logged = await app.call('login', credentials);
  now += 7 * 24 * 60 * 60 * 1000 + 1;
  const expired = await app.call('session', undefined, cookieValue(logged.cookie));
  assert.equal(expired.data.user, null);
  assert.match(expired.cookie, /Max-Age=0/);
});

test('trocar a conta revoga a sessão anterior e não modifica o perfil da outra conta', async t => {
  const app = await fixture(t);
  const first = await app.call('register', credentials);
  const second = await app.call('register', { ...credentials, username: 'outro_usuario' }, cookieValue(first.cookie));
  assert.notEqual(first.data.user.id, second.data.user.id);
  assert.equal((await app.call('session', undefined, cookieValue(first.cookie))).data.user, null);
  assert.equal((await app.call('session', undefined, cookieValue(second.cookie))).data.user.username, 'outro_usuario');
});

test('valida credenciais, limita o corpo e rejeita requisições de outra origem', async t => {
  const app = await fixture(t);
  for (const username of ['', 'ab', '../invasor', '<script>', 'a'.repeat(25)]) {
    assert.equal((await app.call('register', { ...credentials, username })).status, 400);
  }
  assert.equal((await app.call('register', { ...credentials, password: 'curta' })).status, 400);
  assert.equal((await app.call('register', '{')).status, 400);
  assert.equal((await app.call('register', 'a'.repeat(9000))).status, 413);
  assert.equal((await app.call('register', credentials, null, { Origin: 'https://outro.example' })).status, 403);
  assert.equal((await app.call('register', credentials, null, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await app.call('session', undefined, 'ulbris_session=alterado')).data.user, null);
});

test('limita tentativas repetidas sem bloquear o primeiro login válido', async t => {
  const app = await fixture(t, { maxAttempts: 3 });
  assert.equal((await app.call('register', credentials)).status, 201);
  assert.equal((await app.call('login', credentials)).status, 200);
  assert.equal((await app.call('login', { ...credentials, password: 'Errada 123' })).status, 401);
  assert.equal((await app.call('login', credentials)).status, 429);
});

test('contas e tokens persistem no SQLite com scrypt e somente hash dos tokens', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ulbris-accounts-'));
  const databasePath = join(directory, 'accounts.sqlite');
  // Exercise the production password cost once; other HTTP tests use a cheaper test-only cost.
  const app = await fixture(t, { databasePath, scryptCost: 131072 });
  const registered = await app.call('register', credentials);
  assert.equal(registered.status, 201);
  const db = new DatabaseSync(databasePath, { readOnly: true });
  const stored = db.prepare('SELECT password_hash FROM users').get();
  const session = db.prepare('SELECT token_hash FROM sessions').get();
  assert.match(stored.password_hash, /^scrypt\$131072\$/);
  assert.ok(!stored.password_hash.includes(credentials.password));
  assert.notEqual(session.token_hash, cookieValue(registered.cookie).split('=')[1]);
  db.close();
  await new Promise(resolve => app.server.close(resolve));
  const restarted = await fixture(t, { databasePath });
  t.after(() => rm(directory, { recursive: true, force: true }));
  assert.equal((await restarted.call('session', undefined, cookieValue(registered.cookie))).data.user.id, registered.data.user.id);
  assert.equal((await restarted.call('login', credentials)).status, 200);
});

test('servidor estático não expõe fontes, banco ou arquivos fora do build', async t => {
  const app = await fixture(t);
  for (const path of ['/.local-data/accounts.sqlite', '/server/accounts.js', '/package.json', '/%2e%2e%5cpackage.json']) {
    assert.equal((await fetch(app.origin + path)).status, 404);
  }
});
