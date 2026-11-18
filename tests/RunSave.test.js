import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import Combat from '../src/systems/Combat.js';
import { SAVE_KEY, encodeRun, decodeRun, loadRun, autoSave, saveRun, clearRun, setRunOwner } from '../src/systems/RunSave.js';

function prepared() {
  const session = new ShoppingSession({ classId: 'arthur', opponentSeed: 7 });
  session.buy('sword');
  session.buy('refined-iron');
  session.board.move('item', 'sword', 0, 0);
  session.board.move('item', 'refined-iron', 1, 1);
  session.toggleOfferLock(5);
  session.board.store('item', 'refined-iron', 1);
  return session;
}

test('retoma compras, posições, giros, reserva e adversários com objetos funcionais', () => {
  const original = prepared();
  const restored = decodeRun(encodeRun(original)).session;
  const state = session => JSON.parse(encodeRun(session)).state;
  // Canonical serialization supplies zero for implicit initial rotations.
  assert.equal(restored.gold, original.gold);
  assert.equal(restored.opponentSeed, 7);
  assert.deepEqual(restored.offers, original.offers);
  assert.deepEqual([...restored.purchaseCounts], [...original.purchaseCounts]);
  assert.equal(restored.board.items.find(item => item.id === 'refined-iron').rotation, 90);
  assert.equal(restored.board.items.find(item => item.id === 'refined-iron').x, null);
  assert.equal(restored.board.move('item', 'refined-iron', 1, 1), null);
  assert.equal(restored.beginBattle(), true);
  assert.equal(restored.finishBattle('victory').fusions, 1);
  assert.equal(restored.round, 2);
  assert.ok(restored.offers[5].locked);
  assert.equal(restored.finishBattle('victory'), null, 'resultado não duplica renda/fusão');
  const fused = decodeRun(encodeRun(restored)).session;
  assert.equal(fused.board.items[0].catalogId, 'iron-sword');
  assert.equal(fused.board.items[0].id, 'sword');
  assert.equal(fused.board.items[0].price, restored.board.items[0].price);
  assert.deepEqual(state(fused), state(decodeRun(encodeRun(fused)).session));
  assert.ok(new Combat(fused.board, original.board));
  fused.offers[0] = { id: 'sword', sold: false, locked: false };
  fused.gold = 10;
  assert.equal(fused.buy('sword', 0), null);
  assert.equal(fused.board.items[1].id, 'sword#2');
});

test('preserva Juramento e escolha de fusão sem salvar batalha em andamento', () => {
  const session = prepared();
  session.board.items[0].oathBattles = 1;
  session.board.items[0].fusionTargetId = 'refined-iron';
  const raw = encodeRun(session);
  session.beginBattle();
  assert.throws(() => encodeRun(session));
  const restored = decodeRun(raw).session;
  assert.equal(restored.pendingFusions, null);
  assert.equal(restored.round, 1);
  assert.equal(restored.board.items[0].oathBattles, 1);
  assert.equal(restored.board.items[0].fusionTargetId, 'refined-iron');
});

test('retoma a escolha das dez vitórias e o infinito sem pagar renda duas vezes', () => {
  const session = prepared();
  session.wins = 9;
  session.round = 10;
  session.beginBattle();
  session.finishBattle('victory');
  const saved = decodeRun(encodeRun(session, 'victory'));
  assert.equal(saved.phase, 'victory');
  assert.ok(saved.session.winningBoard);
  assert.equal(saved.session.continueEndless(), true);
  const gold = saved.session.gold;
  const endless = decodeRun(encodeRun(saved.session)).session;
  assert.equal(endless.endless, true);
  assert.equal(endless.round, 11);
  assert.equal(endless.gold, gold);
  assert.equal(endless.continueEndless(), false);
  assert.equal(endless.gold, gold);
});

test('rejeita dados corrompidos, versões diferentes e posições inválidas', () => {
  const raw = encodeRun(prepared());
  const invalid = change => {
    const data = JSON.parse(raw);
    change(data);
    assert.throws(() => decodeRun(JSON.stringify(data)));
  };
  assert.throws(() => decodeRun('{'));
  assert.throws(() => decodeRun('null'));
  invalid(data => { data.format = 999; });
  invalid(data => { data.rules = 'old'; });
  invalid(data => { data.state.classId = 'unknown'; });
  invalid(data => { data.state.gold = -1; });
  invalid(data => { data.state.board.items[0].x = 7; });
  invalid(data => { data.state.board.bags[0].x = null; });
  invalid(data => { data.state.board.items[0].catalogId = 'missing'; });
  invalid(data => { data.state.board.items[1].id = 'sword'; });
  invalid(data => { data.state.purchaseCounts = []; });
  invalid(data => { data.state.offers = []; });
  assert.equal(loadRun({ getItem: () => raw }).status, 'ok');
  assert.equal(loadRun({ getItem: () => '{' }).status, 'unavailable');
  assert.equal(loadRun({ getItem: () => null }).status, 'empty');
});

test('agrupa ações, evita regravar estado igual e mantém o último save se faltar espaço', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored = null, writes = 0, errors = 0;
  const storage = { setItem(key, raw) { assert.equal(key, SAVE_KEY); stored = raw; writes++; },
    getItem: () => stored, removeItem() { stored = null; } };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    const session = prepared();
    const saver = autoSave(session, () => errors++, { delay: 10 });
    saver.flush();
    assert.equal(writes, 1);
    for (let i = 0; i < 10; i++) { session.gold++; saver.schedule(); }
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.equal(writes, 2);
    saver.flush();
    assert.equal(writes, 2);
    session.gold++;
    saver.schedule();
    saver.flush(); // pagehide/shutdown must persist even before debounce expires.
    assert.equal(loadRun().session.gold, session.gold);
    const beforeBattle = stored;
    session.beginBattle();
    saver.flush();
    assert.equal(stored, beforeBattle);
    session.cancelBattle();
    storage.setItem = () => { throw new Error('quota'); };
    session.gold++;
    saver.flush();
    assert.equal(errors, 1);
    assert.equal(stored, beforeBattle);
    assert.equal(saveRun(session), false);
    assert.equal(clearRun(), true);
    assert.equal(loadRun().status, 'empty');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    assert.equal(loadRun().status, 'unavailable');
    assert.equal(saveRun(session), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('cada conta e visitante mantêm saves distintos; gravações pendentes continuam no dono original', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } });
  try {
    const guest = prepared(); guest.gold = 9;
    setRunOwner(); saveRun(guest);
    setRunOwner('conta-A');
    assert.equal(loadRun().status, 'empty');
    const first = prepared(); first.gold = 4;
    saveRun(first);
    const pending = autoSave(first);
    first.gold = 3; pending.schedule();
    setRunOwner('conta-B');
    const second = prepared(); second.gold = 7;
    saveRun(second); pending.flush();
    assert.equal(loadRun().session.gold, 7);
    clearRun();
    setRunOwner('conta-A'); assert.equal(loadRun().session.gold, 3);
    setRunOwner(); assert.equal(loadRun().session.gold, 9);
    assert.throws(() => setRunOwner('../invalida'));
  } finally {
    setRunOwner();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('sair da conta não transforma uma sessão já iniciada em jornada de visitante', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } });
  try {
    setRunOwner('conta-A');
    const session = prepared();
    assert.equal(saveRun(session), true);
    setRunOwner();
    assert.equal(saveRun(session), false, 'salvamento atrasado deve continuar pertencendo à conta original');
    assert.equal(loadRun().status, 'empty');
    assert.equal(values.has(SAVE_KEY), false);
    setRunOwner('conta-B');
    assert.equal(saveRun(session), false);
    assert.equal(loadRun().status, 'empty');
    setRunOwner('conta-A');
    assert.equal(loadRun().status, 'ok');
  } finally {
    setRunOwner();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('save marcado com outra conta nunca aparece como visitante nem em outra conta', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } });
  try {
    setRunOwner('conta-A');
    const session = prepared(); saveRun(session);
    const raw = values.get(`${SAVE_KEY}.conta-A`);
    assert.equal(JSON.parse(raw).ownerId, 'conta-A');
    values.set(SAVE_KEY, raw);
    setRunOwner(); assert.equal(loadRun().status, 'empty');
    values.set(`${SAVE_KEY}.conta-B`, raw);
    setRunOwner('conta-B'); assert.equal(loadRun().status, 'empty');
    assert.equal(clearRun(session), false, 'cena antiga não pode apagar o save de outra conta');
    setRunOwner('conta-A');
    const resumed = loadRun().session;
    setRunOwner();
    assert.equal(saveRun(resumed), false, 'uma sessão restaurada também mantém seu dono');
  } finally {
    setRunOwner();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
