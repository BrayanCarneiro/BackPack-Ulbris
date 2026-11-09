import test from 'node:test';
import assert from 'node:assert/strict';
import { allItems } from '../src/data/shopCatalog.js';
import { rotateFootprint, getFootprintCells, occupiesCell } from '../src/utils/rotation.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { getItemDetails } from '../src/utils/itemDetails.js';
import { getCombatItem } from '../src/data/combatItems.js';

test('machadinha tem cabo de duas células e lâmina lateral, sem estrelas', () => {
  const item = allItems.find(item => item.id === 'hatchet');
  assert.deepEqual([item.width, item.height], [2, 2]);
  assert.deepEqual(item.cells, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]);
  assert.equal(getCombatItem(item).fusionCatalyst, undefined);
  const details = getItemDetails(item);
  assert.ok(details.effects.some(text => text.includes('3 espaços')));
  assert.ok(details.effects.some(text => text.includes('Fusão por contato')));
  assert.equal(details.effects.some(text => text.includes('Estrelas de fusão:')), false);
  let rotated = item;
  for (let i = 0; i < 4; i++) {
    rotated = rotateFootprint(rotated, 1);
    assert.equal(getFootprintCells(rotated).length, 3);
  }
  assert.deepEqual(rotated.cells, item.cells);
});

function session({ rotation = 0, blocked = false, edge = false } = {}) {
  const s = new ShoppingSession({ random: () => 0.5 });
  s.gold = 100;
  s.offers = ['traveler-bag', 'hatchet', 'hatchet', 'potion'].map(id => ({ id, sold: false, locked: false }));
  for (const offer of [...s.offers]) assert.equal(s.buy(offer.id), null);
  s.board.move('bag', 'traveler-bag', 0, 0);
  if (rotation) {
    assert.equal(s.board.move('item', 'hatchet', 2, 0, 1), null);
    assert.equal(s.board.move('item', 'hatchet#2', 0, 0, 1), null);
  } else {
    assert.equal(s.board.move('item', 'hatchet', 0, edge ? 1 : 0), null);
    assert.equal(s.board.move('item', 'hatchet#2', 1, edge ? 2 : 1), null);
  }
  if (blocked) assert.equal(s.board.move('item', 'potion', 1, 3), null);
  return s;
}

test('machado tem cabo de três células e lâmina lateral; os quatro giros mantêm quatro células', () => {
  const original = allItems.find(item => item.id === 'battle-axe');
  assert.deepEqual(original.cells, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }]);
  let shape = { ...original, x: 0, y: 0 };
  for (let i = 0; i < 4; i++) {
    assert.equal(getFootprintCells(shape).length, 4);
    shape = rotateFootprint(shape, 1);
  }
  assert.deepEqual(shape.cells, original.cells);
  assert.ok(getItemDetails('battle-axe').effects.some(text => text.includes('Formato de machado') && text.includes('4 espaços')));
});

test('fusão adota o novo formato, preserva giro e mantém espaços vazios utilizáveis', () => {
  for (const rotation of [0, 90]) {
    const s = session({ rotation });
    const target = s.board.items.find(item => item.id === 'hatchet#2');
    const before = { x: target.x, y: target.y };
    s.beginBattle();
    assert.equal(s.finishBattle('victory').fusions, 1);
    assert.equal(target.catalogId, 'battle-axe');
    assert.equal(target.rotation, rotation);
    assert.deepEqual({ x: target.x, y: target.y }, before);
    assert.equal(target.cells.length, 4);
    assert.deepEqual([target.width, target.height], rotation ? [3, 2] : [2, 3]);
    assert.equal(s.board.getPlacementError('item', target.id, target.x, target.y), null);
    const hole = rotation ? { x: target.x, y: target.y + 1 } : { x: target.x + 1, y: target.y + 1 };
    assert.equal(occupiesCell(target, hole.x, hole.y), false);
    assert.equal(s.board.move('item', 'potion', hole.x, hole.y), null);
  }
});

test('resultado maior vai para a reserva se o cabo maior colidir ou ficar sem mochila', () => {
  for (const options of [{ blocked: true }, { edge: true }]) {
    const s = session(options);
    const before = structuredClone(s.board.items.find(item => item.id === 'potion'));
    s.beginBattle();
    const report = s.finishBattle('victory');
    assert.equal(report.fusions, 1);
    assert.deepEqual(report.storedFusionNames, ['Machado de batalha']);
    const result = s.board.items.find(item => item.catalogId === 'battle-axe');
    assert.deepEqual([result.x, result.y], [null, null]);
    assert.equal(result.cells.length, 4);
    assert.deepEqual(s.board.items.find(item => item.id === 'potion'), before);
    assert.equal(s.board.move('item', result.id, 0, 0), null);
  }
});

test('machadinhas fundem por contato real, inclusive vertical, sem diagonais, distância ou reserva', () => {
  for (const [x, y, shouldFuse] of [[0, 2, true], [2, 0, true], [2, 1, false], [2, 2, false], [null, null, false]]) {
    const s = session();
    assert.equal(s.board.store('item', 'hatchet#2'), null);
    if (x !== null) assert.equal(s.board.move('item', 'hatchet#2', x, y), null);
    s.beginBattle();
    assert.equal(s.finishBattle('victory').fusions, shouldFuse ? 1 : 0, `Target at ${x},${y}`);
  }
});
