import { decodeRun } from './runCodec.js';

const validRevision = value => Number.isSafeInteger(value) && value >= 0;
const blocked = new Set(['conflict', 'auth', 'error']);

// One controller per signed-in account. The database is authoritative; each
// page keeps its own durable outbox so two tabs cannot erase each other's draft.
export default class RunSync {
  constructor({ owner, request, storage,
    makeId = () => crypto.randomUUID(), notify = () => {}, retryMs = 3000 }) {
    this.owner = owner;
    this.request = request;
    this.storageOk = true;
    try { this.storage = storage ?? globalThis.localStorage; }
    catch {
      this.storageOk = false;
      this.storage = { getItem: () => null, setItem() { throw new Error('Storage blocked'); }, removeItem() {} };
    }
    this.makeId = makeId;
    this.notify = notify;
    this.retryMs = retryMs;
    this.key = `ulbris.current-run.${owner}`;
    this.metaKey = `${this.key}.database`;
    this.prefix = `${this.key}.pending.`;
    this.outboxKey = this.prefix + makeId();
    this.status = 'loading';
    this.disposed = false;
    this.timer = null;
    this.sending = null;
    this.loading = null;
    this.operation = null;
    this.recovered = [];
    const meta = this.readJSON(this.metaKey);
    this.revision = validRevision(meta?.revision) ? meta.revision : null;
    this.serverRaw = meta?.raw ?? null;
    this.raw = this.read(this.key);
    this.dirty = this.raw !== this.serverRaw;
    const drafts = this.findDrafts();
    this.multipleDrafts = new Set(drafts.map(row => JSON.stringify({ revision: row.data.revision,
      raw: row.data.raw, operation: row.data.operation }))).size > 1;
    if (drafts.length) {
      const latest = drafts.sort((a, b) => b.data.savedAt - a.data.savedAt)[0].data;
      this.raw = latest.raw;
      this.revision = latest.revision;
      this.serverRaw = latest.serverRaw;
      this.operation = latest.operation;
      this.dirty = true;
      this.recovered = drafts;
    }
  }

  read(key) { try { return this.storage.getItem(key); } catch { this.storageOk = false; return null; } }
  readJSON(key) { try { return JSON.parse(this.read(key)); } catch { return null; } }
  put(key, value) {
    try {
      if (this.read(key) !== value) this.storage.setItem(key, value);
      return true;
    }
    catch { this.storageOk = false; return false; }
  }
  remove(key) { try { this.storage.removeItem(key); } catch { this.storageOk = false; } }

  findDrafts() {
    const rows = [];
    try {
      for (let index = 0; index < this.storage.length; index++) {
        const key = this.storage.key(index);
        if (!key?.startsWith(this.prefix)) continue;
        try {
          const value = this.read(key), data = JSON.parse(value);
          if (!data || (data.revision !== null && !validRevision(data.revision))) continue;
          if (data.raw !== null) decodeRun(data.raw);
          rows.push({ key, value, data });
        } catch { /* Skip only the damaged entry; keep scanning other drafts. */ }
      }
    } catch { /* A damaged draft never replaces a database save. */ }
    return rows;
  }

  state() {
    const local = this.storageOk ? 'Progresso guardado neste navegador.' : 'Mantenha o jogo aberto: a cópia no navegador falhou.';
    const messages = {
      loading: 'Carregando jornada da conta…', saving: 'Salvando jornada na conta…',
      saved: this.raw === null ? 'Conta sincronizada.' : 'Jornada salva no banco local.',
      offline: `Servidor indisponível. ${local} Tentaremos novamente.`,
      conflict: 'A jornada mudou em outra aba. Seu rascunho foi preservado; carregue a versão do banco no menu.',
      auth: `Entre novamente para salvar na conta. ${local}`,
      error: 'Não foi possível validar a jornada da conta. A cópia existente foi preservada.',
    };
    return { status: this.status, message: messages[this.status], revision: this.revision,
      pending: this.dirty, owner: this.owner };
  }

  signal(status) { this.status = status; if (!this.disposed) this.notify(this.state()); }

  persist() {
    if (this.raw === null) this.remove(this.key);
    else this.put(this.key, this.raw);
    if (this.revision !== null) this.put(this.metaKey, JSON.stringify({ revision: this.revision, raw: this.serverRaw }));
    if (this.dirty) this.put(this.outboxKey, JSON.stringify({ revision: this.revision,
      serverRaw: this.serverRaw, raw: this.raw, operation: this.operation, savedAt: Date.now() }));
    else {
      this.remove(this.outboxKey);
      // Do not delete a draft that another still-open page has changed.
      for (const row of this.recovered) if (this.read(row.key) === row.value) this.remove(row.key);
      this.recovered = [];
    }
  }

  validateRemote(remote) {
    if (!remote || !validRevision(remote.revision)) throw Object.assign(new Error('Invalid save response'), { status: 400 });
    if (remote.raw !== null) {
      try {
        const saved = decodeRun(remote.raw);
        if (Object.hasOwn(saved, 'ownerId') && saved.ownerId !== this.owner) throw new Error('Wrong journey owner');
      }
      catch { throw Object.assign(new Error('Incompatible database save'), { status: 400 }); }
    }
    return remote;
  }

  failure(error) {
    if (error.status === 401 || error.code === 'account_changed') this.signal('auth');
    else if (error.status === 409) this.signal('conflict');
    else if (error.status === 400 || error.status === 413) this.signal('error');
    else { this.signal('offline'); if (this.dirty) this.retry(); }
  }

  retry() {
    if (this.disposed || this.timer || blocked.has(this.status)) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.revision === null) void this.refresh();
      else void this.pump();
    }, this.retryMs);
    this.timer.unref?.();
  }

  async refresh({ useDatabase = false } = {}) {
    if (this.disposed) return;
    if (this.loading) return this.loading;
    if (this.sending) await this.sending;
    this.loading = (async () => {
      try {
        const remote = this.validateRemote(await this.request('GET'));
        if (this.disposed) return;
        if (useDatabase) {
          // Preserve this page's draft before the user chooses the database copy.
          if (this.dirty && !this.put(`${this.key}.backup.${this.makeId()}`, JSON.stringify({
            raw: this.raw, revision: this.revision, savedAt: Date.now() }))) {
            this.signal('error'); return;
          }
          for (const row of this.recovered) {
            if (!this.put(`${this.key}.backup.${this.makeId()}`, row.value)) { this.signal('error'); return; }
          }
          this.operation = null; this.dirty = false; this.multipleDrafts = false;
          this.raw = remote.raw;
        } else if (this.multipleDrafts) {
          this.signal('conflict'); return;
        } else if (this.operation) {
          if (remote.operationId === this.operation.operationId && remote.raw === this.operation.raw) {
            this.operation = null;
            this.dirty = this.raw !== remote.raw;
          } else if (remote.revision !== this.operation.revision) {
            this.signal('conflict'); return;
          }
        } else if (this.dirty && this.raw !== remote.raw) {
          if ((this.revision === null && remote.revision !== 0)
            || (this.revision !== null && this.revision !== remote.revision)) {
            this.signal('conflict'); return;
          }
        } else { this.raw = remote.raw; this.dirty = false; }
        this.revision = remote.revision;
        this.serverRaw = remote.raw;
        this.persist();
        this.signal(this.dirty ? 'saving' : 'saved');
      } catch (error) { if (!this.disposed) this.failure(error); }
      finally { this.loading = null; }
    })();
    await this.loading;
    if (this.dirty && !blocked.has(this.status) && this.status !== 'offline') await this.pump();
  }

  write(raw) {
    if (this.disposed) return false;
    if (this.raw === raw) return true;
    if (typeof raw === 'string' && typeof this.raw === 'string'
      && raw.slice(raw.indexOf(',"phase"')) === this.raw.slice(this.raw.indexOf(',"phase"'))) return true;
    this.raw = raw;
    this.dirty = true;
    this.persist();
    if (!blocked.has(this.status)) {
      this.signal('saving');
      if (this.revision === null) void this.refresh();
      else void this.pump();
    } else this.signal(this.status);
    return true;
  }

  pump() {
    if (this.disposed || this.loading || this.sending || !this.dirty
      || this.revision === null || blocked.has(this.status)) return this.sending;
    clearTimeout(this.timer); this.timer = null;
    this.operation ??= { revision: this.revision, operationId: this.makeId(), raw: this.raw };
    const operation = this.operation;
    this.persist();
    this.signal('saving');
    this.sending = (async () => {
      let success = false;
      try {
        const keepalive = new TextEncoder().encode(JSON.stringify(operation)).length < 60000;
        const remote = this.validateRemote(await this.request('POST', operation, { keepalive }));
        if (this.disposed) return;
        if (remote.operationId !== operation.operationId || remote.raw !== operation.raw
          || remote.revision !== operation.revision + 1) {
          throw Object.assign(new Error('Another save was committed'), { status: 409 });
        }
        this.revision = remote.revision;
        this.serverRaw = remote.raw;
        this.operation = null;
        this.dirty = this.raw !== remote.raw;
        this.persist();
        this.signal(this.dirty ? 'saving' : 'saved');
        success = true;
      } catch (error) { if (!this.disposed) this.failure(error); }
      finally {
        this.sending = null;
        if (!this.disposed && this.dirty && success) void this.pump();
      }
    })();
    return this.sending;
  }

  async flush() {
    if (this.loading) await this.loading;
    if (this.dirty && !blocked.has(this.status)) {
      if (this.revision === null) await this.refresh();
      else await this.pump();
    }
    while (this.sending && !blocked.has(this.status) && this.status !== 'offline') await this.sending;
    return !this.dirty;
  }

  dispose() { this.disposed = true; clearTimeout(this.timer); this.timer = null; }
}
