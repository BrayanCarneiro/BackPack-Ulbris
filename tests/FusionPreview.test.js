import test from 'node:test';
import assert from 'node:assert/strict';
import { getReadyFusions, getFusionProgress } from '../src/utils/itemFusions.js';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { allItems } from '../src/data/shopCatalog.js';

const item = (catalogId, id, x, y, extra = {}) => ({
  ...allItems.find(piece => piece.id === catalogId), catalogId, id, x, y, ...extra,
});
const armorItems = () => [item('leather-chestplate', 'armor', 2, 2),
  item('refined-iron', 'iron-a', 1, 3), item('refined-iron', 'iron-b', 4, 4)];

test('preview is read-only and agrees with the completed fusion; readiness follows storage and movement', () => {
  const session = new ShoppingSession();
  session.board.bags.push({ id: 'bag', kind: 'bag', x: 0, y: 0, width: 8, height: 8 });
  session.board.items.push(...armorItems());
  const before = structuredClone(session.board.items);
  const ready = getReadyFusions(session.board.items);
  assert.equal(ready.length, 1);
  assert.deepEqual(session.board.items, before);
  assert.equal(session.pendingFusions, null);
  session.board.store('item', 'iron-b');
  assert.equal(getReadyFusions(session.board.items).length, 0);
  assert.deepEqual(getFusionProgress(session.board.items)[0].ingredients,
    [{ id: 'refined-iron', required: 2, count: 1 }]);
  session.board.move('item', 'iron-b', 7, 7);
  assert.equal(getReadyFusions(session.board.items).length, 0);
  session.board.move('item', 'iron-b', 4, 4);
  session.beginBattle();
  assert.deepEqual(session.pendingFusions, ready);
  assert.equal(session.finishBattle('victory').fusions, 1);
  assert.equal(session.board.items[0].catalogId, ready[0].resultId);
});

test('preview resolves competing recipes without highlighting the same iron twice', () => {
  const items = [item('sword', 'sword', 0, 0), item('shield', 'shield', 2, 0),
    item('refined-iron', 'iron', 1, 0)];
  const ready = getReadyFusions(items);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].resultId, 'iron-sword');
  assert.equal(getFusionProgress(items).find(entry => entry.resultId === 'iron-shield').ingredients[0].count, 0);
});

test('star recipes update on rotation and partial progress excludes diagonal, stored and missing ingredients', () => {
  const items = [item('iron-armor', 'armor', 1, 0), item('carmine-stone', 'stone', 0, 0),
    item('vital-crystal', 'crystal', 3, 0)];
  assert.equal(getReadyFusions(items).length, 1);
  items[1].rotation = 180;
  assert.equal(getReadyFusions(items).length, 0);
  assert.deepEqual(getFusionProgress(items)[0].ingredients, [
    { id: 'carmine-stone', required: 1, count: 0 }, { id: 'vital-crystal', required: 1, count: 1 },
  ]);
  items[1].rotation = 0;
  items[2].y = 3;
  assert.equal(getReadyFusions(items).length, 0);
  assert.equal(getFusionProgress(items)[0].ingredients[1].count, 0);
  items[2].x = null;
  items[2].y = null;
  assert.equal(getFusionProgress(items)[0].ingredients[1].count, 0);
  items.pop();
  assert.equal(getFusionProgress(items)[0].ingredients[1].count, 0);
});

test('duplicate ingredients and multiple ready recipes remain distinct', () => {
  const items = [...armorItems(), item('hatchet', 'axe-a', 5, 0), item('hatchet', 'axe-b', 6, 0)];
  const ready = getReadyFusions(items);
  assert.deepEqual(ready.map(fusion => fusion.resultId).sort(), ['battle-axe', 'iron-armor']);
  const ids = ready.flatMap(fusion => [fusion.targetId, ...fusion.consumedIds]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(getFusionProgress(items).length, 0);
  items.splice(2, 1);
  assert.equal(getFusionProgress(items)[0].ingredients[0].count, 1);
});
