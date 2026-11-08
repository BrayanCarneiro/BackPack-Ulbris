import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import PackingBoard from '../src/systems/PackingBoard.js';
import Combat from '../src/systems/Combat.js';
import { createOpponent } from '../src/data/opponents.js';
import { combatRules } from '../src/data/combatItems.js';

test('jornada termina na oitava vitória e não aceita compras ou novas batalhas', () => {
  const session = new ShoppingSession();
  for (let i = 1; i <= 8; i++) {
    assert.equal(session.beginBattle(), true);
    assert.equal(session.finishBattle('victory').round, i);
    assert.equal(session.wins, i);
    assert.equal(session.lives, 4);
    assert.equal(session.finishBattle('victory'), null);
  }
  assert.equal(session.runResult, 'victory');
  assert.equal(session.beginBattle(), false);
  assert.ok(session.buy('sword'));
  assert.ok(session.getCompletionError());
  assert.equal(session.round, 8);
});

test('derrotas e empates custam uma vida; a quarta perda encerra a jornada', () => {
  const session = new ShoppingSession();
  for (const result of ['victory', 'defeat', 'draw', 'defeat', 'draw']) {
    session.beginBattle();
    session.finishBattle(result);
  }
  assert.equal(session.wins, 1);
  assert.equal(session.losses, 2);
  assert.equal(session.draws, 2);
  assert.equal(session.lives, 0);
  assert.equal(session.runResult, 'defeat');
  assert.equal(session.round, 5);
  assert.equal(session.finishBattle('victory'), null);
  const fresh = new ShoppingSession();
  assert.equal(fresh.round, 1);
  assert.equal(fresh.wins, 0);
  assert.equal(fresh.lives, 4);
  assert.equal(fresh.runResult, null);
  assert.equal(fresh.board.items.length, 0);
});

test('resultado inválido e cancelar uma preparação não alteram vidas ou vitórias', () => {
  const session = new ShoppingSession();
  assert.equal(session.finishBattle('victory'), null);
  session.beginBattle();
  assert.equal(session.beginBattle(), false);
  assert.equal(session.finishBattle('invalid'), null);
  session.cancelBattle();
  assert.equal(session.finishBattle('defeat'), null);
  assert.equal(session.wins, 0);
  assert.equal(session.lives, 4);
  assert.equal(session.round, 1);
});

test('todos os rivais têm equipamentos legais, independentes e dificuldade progressiva', () => {
  const profiles = new Set();
  for (let round = 1; round <= 11; round++) {
    const opponent = createOpponent(round);
    profiles.add(opponent.profile);
    const board = new PackingBoard(opponent.board);
    const empty = new PackingBoard({ ...opponent.board, bags: [], items: [] });
    for (const bag of board.bags) {
      assert.equal(empty.getDisplacedBags(bag).length, 0);
      empty.bags.push(bag);
    }
    assert.equal(new Set([...board.bags, ...board.items].map(piece => piece.id)).size,
      board.bags.length + board.items.length);
    for (const item of board.items) {
      assert.equal(board.getPlacementError('item', item.id, item.x, item.y), null,
        `Rodada ${round}: ${item.catalogId}`);
    }
    const combat = new Combat(board, createOpponent(round).board, { random: () => 0.5 });
    combat.advance(180000);
    assert.ok(combat.result, `Rodada ${round} precisa terminar`);
  }
  assert.equal(profiles.size, 3);
  assert.ok(createOpponent(7).board.items.some(item => item.catalogId === 'iron-sword'));
  assert.ok(createOpponent(10).board.items.length > createOpponent(1).board.items.length);
  const original = createOpponent(1);
  original.board.items[0].x = 99;
  assert.equal(createOpponent(1).board.items[0].x, 0);
  assert.throws(() => createOpponent(0), RangeError);
});

test('fadiga começa após 60 segundos, ignora defesa e encerra lutas sem armas', () => {
  const board = { bags: [], items: [{ id: 'shield', x: 0, y: 0 }] };
  const combat = new Combat(board, board);
  assert.deepEqual(combat.advance(combatRules.fatigueStartsAt * 1000), []);
  assert.equal(combat.fighters.player.health, 30);
  const events = combat.advance(1000);
  assert.equal(events.filter(event => event.type === 'fatigue').length, 2);
  assert.equal(combat.fighters.player.health, 29.4);
  assert.equal(combat.fighters.player.armor, 9);
  combat.advance(1000);
  assert.equal(combat.fighters.player.health, 28.2);
  combat.advance(100000);
  assert.equal(combat.result, 'draw');
  assert.equal(combat.fighters.player.health, 0);
  assert.equal(combat.fighters.enemy.health, 0);
  assert.deepEqual(combat.advance(1000), []);
});

test('fadiga preserva simultaneidade e resultado independente do tamanho dos frames', () => {
  const board = { bags: [], items: [{ id: 'potion', x: 0, y: 0 }] };
  const first = new Combat(board, board);
  const second = new Combat(board, board);
  first.advance(120000);
  for (let i = 0; i < 1200; i++) second.advance(100);
  assert.equal(first.result, 'draw');
  assert.equal(first.fighters.player.potions[0].consumed, true);
  assert.deepEqual(first.fighters, second.fighters);
  assert.equal(first.elapsedMs, second.elapsedMs);
});
