import test from 'node:test';
import assert from 'node:assert/strict';
import Combat from '../src/systems/Combat.js';

const board = (id, count) => ({ bags: [], items: Array.from({ length: count }, (_, index) => ({
  id: `${id}-${index}`, catalogId: id, x: index, y: 0,
})) });
const empty = { bags: [], items: [] };
function attacks(id, count) {
  const combat = new Combat(board(id, count), empty, { random: () => 0.99 });
  return combat.advance(30000).filter(event => event.type === 'attack');
}

test('arco isolado mantém cadência; dois arcos exigem suporte de estamina', () => {
  const single = attacks('bow', 1), dual = attacks('bow', 2);
  assert.equal(single.length, 10);
  assert.ok(dual.length < single.length * 2);
  assert.equal(new Set(dual.map(event => event.itemId)).size, 2);
});

test('dois machados mantêm ambos ativos com a nova economia de estamina', () => {
  const dual = attacks('battle-axe', 2);
  assert.ok(dual.length >= 14);
  const counts = [0, 1].map(index => dual.filter(event => event.itemId === `battle-axe-${index}`).length);
  assert.ok(Math.abs(counts[0] - counts[1]) <= 1);
});
