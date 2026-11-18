import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { decodeRun } from '../src/systems/runCodec.js';

const derive = promisify(scrypt);
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE = 'ulbris_session';
const USERNAME = /^[a-zA-Z0-9_]{3,24}$/;
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const publicUser = row => row ? { id: row.id, username: row.username,
  avatar: { kind: row.avatar_kind, id: row.avatar_id }, createdAt: row.created_at } : null;

class AccountError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

export function createAccounts({ databasePath, now = Date.now, scryptCost = 131072,
  secureCookie = process.env.NODE_ENV === 'production', origin = process.env.ULBRIS_ORIGIN,
  maxAttempts = 30 } = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
      avatar_kind TEXT NOT NULL DEFAULT 'class', avatar_id TEXT NOT NULL DEFAULT 'arthur'
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS journeys (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL, raw TEXT, operation_id TEXT NOT NULL, updated_at INTEGER NOT NULL
    ) STRICT;`);
  const findUser = db.prepare('SELECT * FROM users WHERE username = ?');
  const insertUser = db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)');
  const insertSession = db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const cleanupSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
  const getSession = db.prepare(`SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE token_hash = ? AND expires_at > ?`);
  const getJourney = db.prepare('SELECT revision, raw, operation_id AS operationId, updated_at AS updatedAt FROM journeys WHERE user_id = ?');
  const putJourney = db.prepare(`INSERT INTO journeys (user_id, revision, raw, operation_id, updated_at)
    SELECT ?, ?, ?, ?, ? WHERE ? = 0 OR EXISTS (SELECT 1 FROM journeys WHERE user_id = ?)
    ON CONFLICT(user_id) DO UPDATE SET revision = excluded.revision, raw = excluded.raw,
      operation_id = excluded.operation_id, updated_at = excluded.updated_at
    WHERE journeys.revision = excluded.revision - 1`);
  const attempts = new Map();
  let inFlight = 0;
  let closed = false;

  function rateLimit(key, limit, duration = 15 * 60 * 1000) {
    const time = now();
    let entry = attempts.get(key);
    if (!entry || entry.until <= time) {
      if (attempts.size >= 10000) attempts.delete(attempts.keys().next().value);
      entry = { count: 0, until: time + duration };
      attempts.set(key, entry);
    }
    if (++entry.count > limit) throw new AccountError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  }

  async function passwordHash(password, salt = randomBytes(16)) {
    const hash = await derive(password, salt, 64, { N: scryptCost, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
    return `scrypt$${scryptCost}$${salt.toString('base64')}$${hash.toString('base64')}`;
  }

  async function verify(password, stored) {
    const [, cost, salt, expected] = stored.split('$');
    const actual = await derive(password, Buffer.from(salt, 'base64'), 64,
      { N: Number(cost), r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
    return timingSafeEqual(actual, Buffer.from(expected, 'base64'));
  }

  function cookie(res, token = '', maxAge = 0) {
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`);
  }

  function sessionToken(req) {
    const value = req.headers.cookie?.split(';').map(value => value.trim())
      .find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
  }

  function newSession(req, res, user) {
    cleanupSessions.run(now());
    const previous = sessionToken(req);
    if (previous) deleteSession.run(tokenHash(previous));
    const token = randomBytes(32).toString('base64url');
    insertSession.run(tokenHash(token), user.id, now() + SESSION_MS);
    cookie(res, token, SESSION_MS / 1000);
  }

  function reply(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(data));
  }

  async function body(req, limit = 8192) {
    if (!req.headers['content-type']?.startsWith('application/json')) {
      throw new AccountError(415, 'Envie os dados em JSON.');
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw new AccountError(413, 'Os dados enviados são muito grandes.');
      chunks.push(chunk);
    }
    try {
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
      return data;
    } catch { throw new AccountError(400, 'Dados inválidos.'); }
  }

  async function handle(req, res) {
    const path = req.url?.split('?')[0];
    if (!path?.startsWith('/api/auth/') && path !== '/api/run') return false;
    let reserved = false;
    try {
      if (closed) throw new AccountError(503, 'Contas temporariamente indisponíveis.');
      let journeyOwner;
      if (path === '/api/run') {
        const token = sessionToken(req);
        journeyOwner = token ? getSession.get(tokenHash(token), now()) : null;
        if (!journeyOwner) throw new AccountError(401, 'Entre novamente para salvar sua jornada na conta.', 'session_expired');
        if (req.headers['x-run-owner'] !== journeyOwner.id) {
          throw new AccountError(409, 'A conta deste navegador mudou. Entre novamente antes de salvar.', 'account_changed');
        }
        if (req.method === 'GET') {
          reply(res, 200, getJourney.get(journeyOwner.id) ?? { revision: 0, raw: null, operationId: null, updatedAt: null });
          return true;
        }
      }
      if (req.method === 'GET' && path === '/api/auth/session') {
        const token = sessionToken(req);
        const user = token ? getSession.get(tokenHash(token), now()) : null;
        if (token && !user) cookie(res);
        reply(res, 200, { user: publicUser(user) });
        return true;
      }
      if (req.method !== 'POST') throw new AccountError(405, 'Método não permitido.');
      const expectedOrigin = origin ?? `${secureCookie ? 'https' : 'http'}://${req.headers.host}`;
      if (req.headers.origin !== expectedOrigin || req.headers['sec-fetch-site'] === 'cross-site') {
        throw new AccountError(403, 'Requisição não permitida.');
      }
      if (path === '/api/run') {
        rateLimit(`run:${journeyOwner.id}`, 300, 60000);
        const data = await body(req, 8 * 1024 * 1024);
        if (!Number.isSafeInteger(data.revision) || data.revision < 0 || data.revision >= Number.MAX_SAFE_INTEGER
          || typeof data.operationId !== 'string' || !/^[a-zA-Z0-9-]{16,100}$/.test(data.operationId)) {
          throw new AccountError(400, 'Versão da jornada inválida.');
        }
        if (data.raw !== null) {
          try {
            const saved = decodeRun(data.raw);
            if (Object.hasOwn(saved, 'ownerId') && saved.ownerId !== journeyOwner.id) throw new Error('Wrong journey owner');
          }
          catch { throw new AccountError(400, 'A jornada enviada está inválida ou incompatível.'); }
        }
        const current = getJourney.get(journeyOwner.id);
        // Retrying a request whose response was lost must not apply it twice.
        if (current?.operationId === data.operationId && current.raw === data.raw) {
          reply(res, 200, current); return true;
        }
        if ((current?.revision ?? 0) !== data.revision || current?.operationId === data.operationId) {
          throw new AccountError(409, 'Sua jornada mudou em outra aba. Carregue a versão do banco antes de continuar.', 'run_conflict');
        }
        const changed = putJourney.run(journeyOwner.id, data.revision + 1, data.raw,
          data.operationId, now(), data.revision, journeyOwner.id);
        if (!changed.changes) throw new AccountError(409, 'Sua jornada mudou em outra aba.', 'run_conflict');
        reply(res, 200, getJourney.get(journeyOwner.id));
        return true;
      }
      if (path === '/api/auth/logout') {
        const token = sessionToken(req);
        if (token) deleteSession.run(tokenHash(token));
        cookie(res);
        reply(res, 200, { user: null });
        return true;
      }
      if (!['/api/auth/register', '/api/auth/login'].includes(path)) throw new AccountError(404, 'Endereço não encontrado.');
      const ip = req.socket.remoteAddress ?? 'local';
      rateLimit(`ip:${ip}`, maxAttempts);
      if (inFlight >= 2) throw new AccountError(429, 'Há acessos em andamento. Tente novamente em instantes.');
      inFlight++; reserved = true;
      const data = await body(req);
      const username = typeof data.username === 'string' ? data.username.trim() : '';
      const password = data.password;
      if (!USERNAME.test(username)) throw new AccountError(400, 'Use de 3 a 24 letras, números ou _ no usuário.');
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        throw new AccountError(400, 'A senha precisa ter de 8 a 128 caracteres.');
      }
      const attemptKey = `user:${ip}:${username.toLowerCase()}`;
      rateLimit(attemptKey, 8);
      let user;
      if (path === '/api/auth/register') {
        const hash = await passwordHash(password);
        const id = randomUUID();
        try { insertUser.run(id, username, hash, now()); }
        catch (error) {
          if (error.message.includes('UNIQUE constraint failed: users.username')) {
            throw new AccountError(409, 'Esse usuário já está em uso. Escolha outro nome.');
          }
          throw error;
        }
        user = findUser.get(username);
      } else {
        user = findUser.get(username);
        // Unknown accounts still perform the same expensive password derivation.
        const dummy = `scrypt$${scryptCost}$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(64).toString('base64')}`;
        const matches = await verify(password, user?.password_hash ?? dummy);
        if (!matches || !user) throw new AccountError(401, 'Usuário ou senha incorretos.');
      }
      newSession(req, res, user);
      attempts.delete(attemptKey);
      reply(res, path.endsWith('/register') ? 201 : 200, { user: publicUser(user) });
    } catch (error) {
      reply(res, error.status ?? 500, { error: error.status ? error.message : 'Não foi possível acessar sua conta. Tente novamente.',
        ...(error.code ? { code: error.code } : {}) });
    } finally { if (reserved) inFlight--; }
    return true;
  }

  return { handle, close() { if (!closed) { closed = true; db.close(); } } };
}
