import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { createOpponent } from '../src/data/opponents.js';
import { seededRandom } from '../src/utils/seededRandom.js';
import { shopAutomatically } from '../src/systems/AutoShopper.js';
import Combat from '../src/systems/Combat.js';

function restorePlacement(session, snapshot) {
  // Placement is replayed onto actually purchased inventory, never injected.
  for (const item of session.board.items) assert.equal(session.board.store('item', item.id), null);
  for (const bag of session.board.bags) assert.equal(session.board.store('bag', bag.id), null);
  for (const kind of ['bag', 'item']) {
    const target = kind === 'bag' ? snapshot.bags : snapshot.items;
    const owned = session.board.getPieces(kind);
    assert.deepEqual(owned.map(p => p.id).sort(), target.map(p => p.id).sort());
    for (const piece of target) {
      const actual = owned.find(p => p.id === piece.id);
      assert.equal(actual.catalogId, piece.catalogId);
      assert.equal(actual.price, piece.price);
      const turns = ((piece.rotation ?? 0) - (actual.rotation ?? 0)) / 90;
      if (kind === 'bag') {
        assert.equal(session.board.getDisplacedBags(piece).length, 0);
      }
      assert.equal(session.board.move(kind, piece.id, piece.x, piece.y, turns), null);
      assert.equal(actual.width, piece.width);
      assert.equal(actual.height, piece.height);
    }
  }
}

test('32 históricos rivais são reproduzíveis com ofertas, custos, renda e fusões reais', () => {
  for (let roster = 0; roster < 32; roster++) {
    for (const finalRound of [9, 10, 11]) {
      const opponent = createOpponent(finalRound, roster);
      const profileIndex = ['balanced', 'offensive', 'defensive'].indexOf(opponent.profile);
      const session = new ShoppingSession({ random: seededRandom(83017 + roster * 7919 + profileIndex * 101), campaign: false, opponentSeed: roster });
      let income = 14;
      for (const entry of opponent.history) {
        assert.equal(session.round, entry.round);
        for (const action of entry.actions) {
          const before = session.gold;
          if (action.buy) {
            assert.equal(session.offers[action.slot].id, action.buy);
            assert.equal(session.buy(action.buy, action.slot), null);
            assert.equal(before - session.gold, action.price);
          } else {
            assert.equal(session.reroll(), null);
            assert.equal(before - session.gold, 1);
          }
          assert.equal(session.gold, action.gold);
          assert.ok(session.gold >= 0);
        }
        restorePlacement(session, entry.board);
        assert.equal(session.getCompletionError(), null);
        assert.equal(session.gold, entry.gold);
        if (entry.round === finalRound) {
          assert.deepEqual(session.board.items, opponent.board.items);
          assert.equal(income, opponent.budget);
          assert.equal(session.gold + opponent.shoppingSpent, income);
          break;
        }
        assert.equal(session.beginBattle(), true);
        const combat = new Combat(session.board, session.board, { random: seededRandom(991 + roster * 103 + session.round) });
        combat.advance(180000);
        assert.equal(combat.result, entry.result);
        const report = session.finishBattle(combat.result);
        assert.deepEqual(report.fusionNames, entry.fusions);
        income += report.income;
      }
    }
  }
});

test('rival é estável ao consultar novamente, isolado por jornada e por cópia', () => {
  const before = createOpponent(4, 19);
  createOpponent(11, 19);
  assert.deepEqual(createOpponent(4, 19), before);
  const copy = createOpponent(4, 19);
  copy.board.items[0].x = 99;
  copy.history[0].actions.length = 0;
  assert.deepEqual(createOpponent(4, 19), before);
  assert.notDeepEqual(createOpponent(6, 19).board, createOpponent(6, 20).board);
  assert.throws(() => createOpponent(12), RangeError);
  assert.throws(() => createOpponent(1, -1), RangeError);
});

test('comprador avançado usa receita real na primeira loja; iniciante mantém conjunto básico', () => {
  const expert = new ShoppingSession({ random: seededRandom(9), opponentSeed: 0 });
  const beginner = new ShoppingSession({ random: seededRandom(9), opponentSeed: 0 });
  shopAutomatically(expert, { skill: 'expert' });
  shopAutomatically(beginner, { skill: 'beginner' });
  assert.equal(expert.beginBattle(), true);
  assert.equal(expert.pendingFusions[0].resultId, 'iron-sword');
  assert.equal(beginner.board.items.filter(p => p.catalogId === 'shield').length, 1);
  assert.equal(beginner.board.items.filter(p => p.catalogId === 'potion').length, 1);
  assert.ok(!beginner.board.items.some(p => p.catalogId === 'iron-sword'));
});
