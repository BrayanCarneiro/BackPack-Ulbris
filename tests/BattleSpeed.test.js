import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';
import { createOpponent } from '../src/data/opponents.js';
import { seededRandom } from '../src/utils/seededRandom.js';

function simulate(player, enemy, seed, speeds, frames) {
  const combat = new Combat(player, enemy, { random: seededRandom(seed) });
  const events = [];
  for (let frame = 0; frame < 30000 && !combat.result; frame++) {
    events.push(...combat.advance(frames[frame % frames.length] * speeds[frame % speeds.length]));
  }
  assert.ok(combat.result, 'A batalha precisa terminar');
  return { result: combat.result, elapsedMs: combat.elapsedMs, fighters: combat.fighters, events };
}

for (const round of [1, 5, 11]) {
  test(`1x, 2x, 3x e mudanças de velocidade preservam todos os eventos na rodada ${round}`, () => {
    const player = createOpponent(round, 3).board;
    const enemy = createOpponent(round, 17).board;
    for (let seed = 1; seed <= 100; seed++) {
      const expected = simulate(player, enemy, seed, [1], [1000 / 60]);
      for (const speed of [2, 3]) {
        assert.deepEqual(simulate(player, enemy, seed, [speed], [1000 / 60]), expected,
          `Semente ${seed}, velocidade ${speed}x`);
      }
      assert.deepEqual(simulate(player, enemy, seed, [1, 2, 3, 3, 1], [8, 16, 33, 150, 1000]), expected,
        `Semente ${seed}, mudanças de velocidade e frames irregulares`);
    }
  });
}

test('fadiga e armadura alta têm o mesmo resultado em 1x, 2x e 3x', () => {
  const board = { bags: [], items: Array.from({ length: 12 }, (_, i) => ({
    id: `shield-${i}`, catalogId: 'shield', x: 0, y: 0,
  })) };
  const expected = simulate(board, board, 42, [1], [1000 / 60]);
  assert.equal(expected.result, 'draw');
  assert.equal(expected.fighters.player.armor, 60);
  assert.ok(expected.events.some(event => event.type === 'fatigue'));
  for (const speed of [2, 3]) {
    assert.deepEqual(simulate(board, board, 42, [speed], [1000 / 60]), expected);
  }
});
