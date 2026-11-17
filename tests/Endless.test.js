import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import PackingBoard from '../src/systems/PackingBoard.js';
import { createOpponent } from '../src/data/opponents.js';
import { difficultyLevels, getDifficulty } from '../src/data/difficulty.js';
import { roundIncome } from '../src/data/economy.js';
import { runProgress } from '../src/data/runRules.js';

function fight(session, result = 'victory') {
  assert.equal(session.beginBattle(), true);
  return session.finishBattle(result);
}

function conqueredRun() {
  const session = new ShoppingSession({ classId: 'arthur' });
  for (let i = 0; i < 10; i++) fight(session);
  return session;
}

test('décima vitória pausa a jornada; continuar mantém inventário e concede renda uma única vez', () => {
  const session = conqueredRun();
  assert.equal(session.runResult, 'victory');
  assert.equal(session.beginBattle(), false);
  assert.equal(session.difficulty, 3);
  const board = session.board;
  const snapshot = structuredClone(session.winningBoard);
  const gold = session.gold;
  assert.equal(session.continueEndless(), true);
  assert.equal(session.board, board);
  assert.equal(session.lives, 5);
  assert.equal(session.round, 11);
  assert.equal(session.gold, gold + roundIncome(11));
  assert.equal(session.continueEndless(), false);
  assert.equal(session.gold, gold + roundIncome(11));
  assert.equal(session.difficulty, 5);
  fight(session);
  assert.equal(session.runResult, null);
  assert.equal(session.wins, 11);
  assert.deepEqual(session.winningBoard, snapshot);
  assert.match(runProgress(session), /Infinito/);
  assert.doesNotMatch(runProgress(session), /11\/10|difícil|DEUS/);
});

test('infinito sobe após cada dez batalhas concluídas e permanece em DEUS sem encerrar por vitórias', () => {
  const session = conqueredRun();
  session.continueEndless();
  for (let i = 0; i < 65; i++) {
    assert.equal(session.difficulty, Math.min(9, 5 + Math.floor(i / 10)));
    // Invalid and duplicate reports cannot advance difficulty.
    assert.equal(session.finishBattle('victory'), null);
    fight(session, i === 0 ? 'draw' : i === 1 ? 'defeat' : 'victory');
    assert.equal(session.runResult, null);
  }
  assert.equal(session.lives, 3);
  assert.equal(session.endlessBattles, 65);
  assert.equal(session.difficulty, 9);
  for (let i = 0; i < 3; i++) fight(session, 'defeat');
  assert.equal(session.runResult, 'defeat');
  assert.equal(session.beginBattle(), false);
  assert.equal(session.continueEndless(), false);
});

test('somente uma vitória de campanha permite continuar; cancelar não conta uma batalha infinita', () => {
  const fresh = new ShoppingSession();
  assert.equal(fresh.continueEndless(), false);
  const npc = new ShoppingSession({ campaign: false });
  for (let i = 0; i < 10; i++) fight(npc);
  assert.equal(npc.continueEndless(), false);
  const session = conqueredRun();
  session.continueEndless();
  session.beginBattle();
  session.cancelBattle();
  assert.equal(session.finishBattle('defeat'), null);
  assert.equal(session.endlessBattles, 0);
  assert.equal(session.lives, 5);
});

test('nove níveis geram mochilas legais com recursos crescentes e compras independentes', () => {
  assert.equal(difficultyLevels.length, 9);
  let previousBudget = 0;
  const opponents = [];
  for (let difficulty = 1; difficulty <= 9; difficulty++) {
    const opponent = createOpponent(11, 0, { difficulty, includeHistory: false });
    opponents.push(opponent);
    assert.equal(opponent.difficulty, difficulty);
    assert.ok(opponent.budget > previousBudget);
    previousBudget = opponent.budget;
    assert.ok(opponent.spent <= opponent.budget);
    const board = new PackingBoard(opponent.board);
    for (const piece of board.items) {
      assert.equal(board.getPlacementError('item', piece.id, piece.x, piece.y), null);
    }
    const empty = new PackingBoard({ columns: 8, rows: 8, bags: [], items: [] });
    for (const bag of board.bags) {
      assert.equal(empty.getDisplacedBags(bag).length, 0);
      empty.bags.push(bag);
      assert.equal(empty.getPlacementError('bag', bag.id, bag.x, bag.y), null);
    }
  }
  assert.ok(opponents[4].spent > opponents[2].spent);
  assert.ok(opponents[8].spent > opponents[4].spent);
  assert.ok(opponents[8].board.items.length > opponents[2].board.items.length);
  assert.deepEqual(createOpponent(11, 0, { includeHistory: false }), opponents[2]);
  assert.equal(getDifficulty(3).skill, 'intermediate');
  assert.equal(getDifficulty(5).skill, 'expert');
  assert.throws(() => getDifficulty(10), RangeError);
});

test('rodadas além do antigo limite e muito distantes mantêm adversários válidos e histórico limitado', () => {
  assert.ok(createOpponent(14, 1, { includeHistory: false }).board.items.length);
  const far = createOpponent(1000000, 1, { difficulty: 5 });
  assert.equal(far.history.length, 30);
  const mature = createOpponent(31, 1, { difficulty: 5 });
  assert.deepEqual(far, mature);
  far.board.items[0].x = 99;
  assert.notEqual(createOpponent(1000000, 1, { difficulty: 5 }).board.items[0].x, 99);
});
