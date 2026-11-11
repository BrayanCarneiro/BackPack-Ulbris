import test from 'node:test';
import assert from 'node:assert/strict';
import ShoppingSession from '../src/systems/ShoppingSession.js';
import { allItems } from '../src/data/shopCatalog.js';
import { getReadyFusions, getFusionProgress } from '../src/utils/itemFusions.js';

const ids = ['blue-crystal', 'red-crystal', 'white-crystal', 'black-crystal'];
const piece = (id, x, y, extra = {}) => ({ ...allItems.find(item => item.id === id),
  catalogId: id, id, x, y, ...extra });
const permutations = values => values.length ? values.flatMap((value, index) =>
  permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest])) : [[]];
const shapes = {
  horizontal: [[0, 0], [1, 0], [2, 0], [3, 0]],
  vertical: [[0, 0], [0, 1], [0, 2], [0, 3]],
  square: [[0, 0], [1, 0], [0, 1], [1, 1]],
  corner: [[0, 0], [1, 0], [1, 1], [2, 1]],
};

for (const [shape, coordinates] of Object.entries(shapes)) {
  test(`dourado: ${shape} aceita todas as 24 ordens, mostra prontidão e funde após batalha`, () => {
    for (const [index, order] of permutations(ids).entries()) {
      const session = new ShoppingSession();
      session.board.bags.push(piece('traveler-bag', 0, 0));
      session.board.items.push(...order.map((id, i) => piece(id, ...coordinates[i], { rotation: (i % 4) * 90 })));
      const before = structuredClone(session.board.items);
      const ready = getReadyFusions(session.board.items);
      assert.equal(ready.length, 1);
      assert.equal(ready[0].resultId, 'golden-crystal');
      assert.equal(new Set([ready[0].targetId, ...ready[0].consumedIds]).size, 4);
      assert.deepEqual(session.board.items, before, 'Preview does not mutate the board');
      assert.equal(getFusionProgress(session.board.items, ready).length, 0);
      const blue = before.find(item => item.catalogId === 'blue-crystal');
      assert.equal(session.beginBattle(), true);
      assert.deepEqual(session.pendingFusions, ready);
      assert.equal(session.finishBattle(['victory', 'defeat', 'draw'][index % 3]).fusions, 1);
      assert.equal(session.board.items.length, 1);
      assert.equal(session.board.items[0].catalogId, 'golden-crystal');
      assert.deepEqual([session.board.items[0].x, session.board.items[0].y], [blue.x, blue.y]);
    }
  });
}

test('progresso reconhece uma cadeia parcial, desaparece ao guardar e completa ao reconectar', () => {
  const items = ids.map((id, index) => piece(id, index, 0));
  items[3].x = null; items[3].y = null;
  assert.equal(getReadyFusions(items).length, 0);
  const partial = getFusionProgress(items)[0];
  assert.deepEqual(partial.ingredients.map(item => item.count), [1, 1, 0]);
  Object.assign(items[3], { x: 3, y: 0 });
  assert.equal(getReadyFusions(items).length, 1);
  Object.assign(items[1], { x: null, y: null });
  assert.deepEqual(getFusionProgress(items)[0].ingredients.map(item => item.count), [0, 0, 0]);
});

test('diagonais, lacunas, outras peças e cores repetidas não substituem a conexão das quatro cores', () => {
  assert.equal(getReadyFusions(ids.map((id, i) => piece(id, i, i))).length, 0);
  const disconnected = ids.map((id, i) => piece(id, i ? i + 1 : 0, 0));
  assert.equal(getReadyFusions(disconnected).length, 0);
  assert.equal(getReadyFusions([...disconnected, piece('vital-crystal', 1, 0)]).length, 0);
  const repeatedBridge = [piece('blue-crystal', 0, 0), piece('red-crystal', 1, 0),
    piece('red-crystal', 2, 0, { id: 'red-copy' }), piece('white-crystal', 3, 0), piece('black-crystal', 4, 0)];
  assert.equal(getReadyFusions(repeatedBridge).length, 0);
});

test('duas receitas usam oito peças distintas, sem consumir cópias extras', () => {
  const items = [0, 2].flatMap(y => ids.map((id, x) => piece(id, x, y, { id: `${id}-${y}` })));
  const ready = getReadyFusions(items);
  assert.equal(ready.length, 2);
  assert.equal(new Set(ready.flatMap(fusion => [fusion.targetId, ...fusion.consumedIds])).size, 8);
  const extra = piece('red-crystal', 0, 1, { id: 'extra-red' });
  assert.equal(getReadyFusions([...items, extra]).length, 2);
});
